import { createHash } from "node:crypto";
import { z } from "zod";

import {
  availabilityOptionMediaProjectionSchema,
  canonicalProductMediaProjectionSchema,
  storefrontAvailabilityRecordSchema,
  storefrontDisplayAttributeSchema,
  storefrontOptionGroupProjectionSchema,
  storefrontSafeProductProjectionSchema,
  storefrontVariantProjectionSchema,
  VeskoIntegrationError,
  type AvailabilityOptionMediaProjection,
  type AvailabilityOptionMediaProjectionPort,
  type IntegrationFailureCode,
} from "@/application/vesko-integration";
import {
  productPresentationContextSchema,
  type ProductPresentationContext,
} from "@/domain/component-platform";
import type { CatalogueDisplayModel, ProductDisplayModel } from "@/domain/catalogue";
import {
  canonicalProductConfigurationResultSchema,
  type CanonicalProductConfigurationInput,
  type CanonicalProductConfigurationResolver,
} from "@/domain/product-presentation";
import { canonicalLocaleOrder, idSchema, type Locale, type LocalizedText } from "@/domain/shared";

const projectionShape = availabilityOptionMediaProjectionSchema.shape;

export const availabilityOptionMediaTransportProjectionSchema = z
  .object({
    tenantId: projectionShape.tenantId,
    storeId: projectionShape.storeId,
    storefrontProjectId: projectionShape.storefrontProjectId,
    catalogueId: projectionShape.catalogueId,
    catalogueRevision: projectionShape.catalogueRevision,
    productId: projectionShape.productId,
    revision: projectionShape.revision,
    supportedLocales: projectionShape.supportedLocales,
    productAvailabilityId: projectionShape.productAvailabilityId,
    availability: z.array(storefrontAvailabilityRecordSchema),
    attributes: z.array(storefrontDisplayAttributeSchema),
    optionGroups: z.array(storefrontOptionGroupProjectionSchema),
    variants: z.array(storefrontVariantProjectionSchema),
    media: z.array(canonicalProductMediaProjectionSchema),
  })
  .strict();

export type AvailabilityOptionMediaTransportProjection = z.infer<
  typeof availabilityOptionMediaTransportProjectionSchema
>;

export type AvailabilityOptionMediaLoadContext = Parameters<
  AvailabilityOptionMediaProjectionPort["load"]
>[0];

export interface CanonicalAvailabilityOptionMediaTransport {
  load(context: Readonly<AvailabilityOptionMediaLoadContext>): unknown;
}

export type AvailabilityOptionMediaProjectionAdapterInput = Readonly<{
  transport: CanonicalAvailabilityOptionMediaTransport;
}>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function stableId(prefix: string, source: string): string {
  const candidate = `${prefix}_${source}`;
  if (candidate.length <= 80 && idSchema.safeParse(candidate).success) return candidate;
  return `${prefix}_${createHash("sha256").update(source).digest("hex").slice(0, 24)}`;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((item) => {
      deepFreeze(item);
    });
  }
  return value;
}

function rawContainsUnsupportedLocale(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(rawContainsUnsupportedLocale);
  if (value === null || typeof value !== "object") return false;
  const entries = Object.entries(value as Record<string, unknown>);
  const supportedLocales = (value as Record<string, unknown>).supportedLocales;
  if (
    Array.isArray(supportedLocales) &&
    supportedLocales.some((locale) => locale !== "en" && locale !== "fi")
  ) {
    return true;
  }
  const isLocalizedTextCandidate =
    entries.length > 0 &&
    entries.every(
      ([key, item]) => key !== "id" && /^[a-z]{2}$/i.test(key) && typeof item === "string",
    );
  if (isLocalizedTextCandidate && entries.some(([key]) => key !== "en" && key !== "fi")) {
    return true;
  }
  return entries.some(([, item]) => rawContainsUnsupportedLocale(item));
}

function failureForValidation(error: z.ZodError): IntegrationFailureCode {
  const message = error.issues.map((issue) => issue.message).join(" ");
  if (/localized projection|supported project locales/i.test(message)) return "unsupportedLocale";
  if (/IDs must be unique|resolve unambiguously/i.test(message)) {
    return "duplicateCanonicalIdentity";
  }
  if (/dependency graph contains a cycle/i.test(message)) return "dependencyCycle";
  if (/option dependencies|dependency values/i.test(message)) return "brokenDependency";
  if (/variant combinations must be unique/i.test(message)) return "duplicateVariantCombination";
  if (/availability/i.test(message)) return "brokenAvailabilityReference";
  if (/media|canonical product media|alt text/i.test(message)) return "brokenMediaReference";
  if (/option value|variant dimension/i.test(message)) return "brokenOptionReference";
  return "malformedIntegrationResponse";
}

function normalizeProjection(
  projection: AvailabilityOptionMediaTransportProjection,
): AvailabilityOptionMediaProjection {
  const normalized = {
    ...projection,
    supportedLocales: canonicalLocaleOrder([...new Set(projection.supportedLocales)]),
    availability: [...projection.availability].sort((left, right) =>
      left.availabilityId.localeCompare(right.availabilityId),
    ),
    variants: [...projection.variants].sort((left, right) =>
      left.variantId.localeCompare(right.variantId),
    ),
    attributes: projection.attributes.map((attribute) => structuredClone(attribute)),
    optionGroups: projection.optionGroups.map((group) => structuredClone(group)),
    media: projection.media.map((media) => structuredClone(media)),
  };
  const candidate = { ...normalized, fingerprint: sha256(normalized) };
  const parsed = availabilityOptionMediaProjectionSchema.safeParse(candidate);
  if (!parsed.success) throw new VeskoIntegrationError(failureForValidation(parsed.error));
  return deepFreeze(parsed.data);
}

function assertIdentity(
  context: AvailabilityOptionMediaLoadContext,
  projection: AvailabilityOptionMediaTransportProjection,
): void {
  if (projection.tenantId !== context.tenantId || projection.storeId !== context.storeId) {
    throw new VeskoIntegrationError("tenantMismatch");
  }
  if (projection.storefrontProjectId !== context.storefrontProjectId) {
    throw new VeskoIntegrationError("projectMismatch");
  }
  if (projection.productId !== context.productId) {
    throw new VeskoIntegrationError("productNotFound");
  }
  if (context.expectedRevision !== undefined && projection.revision !== context.expectedRevision) {
    throw new VeskoIntegrationError("staleCatalogueProjection");
  }
}

export function createAvailabilityOptionMediaProjectionProvider(
  input: AvailabilityOptionMediaProjectionAdapterInput,
): AvailabilityOptionMediaProjectionPort {
  return {
    async load(context) {
      let raw: unknown;
      try {
        raw = await input.transport.load(deepFreeze(structuredClone(context)));
      } catch (error) {
        if (error instanceof VeskoIntegrationError) throw error;
        throw new VeskoIntegrationError("availabilityUnavailable");
      }
      if (rawContainsUnsupportedLocale(raw)) {
        throw new VeskoIntegrationError("unsupportedLocale");
      }
      const parsed = availabilityOptionMediaTransportProjectionSchema.safeParse(raw);
      if (!parsed.success) {
        throw new VeskoIntegrationError(failureForValidation(parsed.error));
      }
      assertIdentity(context, parsed.data);
      return normalizeProjection(parsed.data);
    },
  };
}

function localizedForProduct(product: ProductDisplayModel, value: string): LocalizedText {
  const locales = (["en", "fi"] as const).filter((locale) => product.title[locale] !== undefined);
  return Object.fromEntries(locales.map((locale) => [locale, value]));
}

function displayLabel(product: ProductDisplayModel, token: string): LocalizedText {
  const label = token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
  return localizedForProduct(product, label);
}

function scalarKey(value: string | number): string {
  return `${typeof value}:${String(value)}`;
}

type StandaloneVariantDimension = Readonly<{
  key: string;
  groupId: string;
  valueIdByKey: ReadonlyMap<string, string>;
  group: z.infer<typeof storefrontOptionGroupProjectionSchema>;
}>;

function standaloneVariantDimensions(product: ProductDisplayModel): StandaloneVariantDimension[] {
  if (product.variants.length === 0) return [];
  const excludedOperationalKeys = new Set(["availability", "stock", "stockStatus"]);
  const keys = Object.keys(product.variants[0]?.attributes ?? {}).filter(
    (key) => !excludedOperationalKeys.has(key),
  );
  const consistent = product.variants.every((variant) => {
    const candidate = Object.keys(variant.attributes).filter(
      (key) => !excludedOperationalKeys.has(key),
    );
    return candidate.length === keys.length && candidate.every((key, index) => key === keys[index]);
  });
  if (!consistent || keys.length === 0) {
    throw new VeskoIntegrationError("brokenOptionReference");
  }

  return keys.map((key) => {
    const groupId = stableId("variant_group", `${product.id}:${key}`);
    const valueIdByKey = new Map<string, string>();
    const values: z.infer<typeof storefrontOptionGroupProjectionSchema>["values"] = [];
    product.variants.forEach((variant) => {
      const rawValue = variant.attributes[key];
      if (rawValue === undefined || Array.isArray(rawValue)) {
        throw new VeskoIntegrationError("brokenOptionReference");
      }
      const keyValue = scalarKey(rawValue);
      if (valueIdByKey.has(keyValue)) return;
      const valueId = stableId("variant_value", `${product.id}:${key}:${keyValue}`);
      valueIdByKey.set(keyValue, valueId);
      values.push({
        id: valueId,
        label: localizedForProduct(product, String(rawValue)),
        value: String(rawValue),
        disabled: false,
        metadata: { canonicalDimension: key, canonicalValue: rawValue },
      });
    });
    return {
      key,
      groupId,
      valueIdByKey,
      group: storefrontOptionGroupProjectionSchema.parse({
        id: groupId,
        label: displayLabel(product, key),
        source: "variantDimension",
        required: true,
        presentation: values.length > 8 ? "dropdown" : "buttonGroup",
        values,
        dependsOn: [],
      }),
    };
  });
}

function standaloneOrderOptionGroups(
  product: ProductDisplayModel,
): z.infer<typeof storefrontOptionGroupProjectionSchema>[] {
  return (product.orderOptions ?? []).map((option) => {
    if (option.type === "text") {
      return storefrontOptionGroupProjectionSchema.parse({
        id: option.id,
        label: option.label,
        source: "orderOption",
        required: option.required,
        presentation: "textInput",
        values: [],
        dependsOn: [],
        textEntryConstraints: {
          minLength: option.required ? 1 : 0,
          maxLength: option.maxLength,
          characterPolicy: "unicodeText",
        },
      });
    }
    return storefrontOptionGroupProjectionSchema.parse({
      id: option.id,
      label: option.label,
      source: "orderOption",
      required: option.required,
      presentation: (option.values?.length ?? 0) > 8 ? "dropdown" : "buttonGroup",
      values: (option.values ?? []).map((label, index) => ({
        id: stableId("option_value", `${option.id}:${index + 1}`),
        label,
        value: String(index + 1),
        disabled: false,
        metadata: {},
      })),
      dependsOn: [],
    });
  });
}

function standaloneStatus(product: ProductDisplayModel) {
  return product.stockStatus ?? ("unavailable" as const);
}

function standaloneStockDisplay(product: ProductDisplayModel) {
  if (product.stockStatus === "inStock") return "show" as const;
  if (product.stockStatus === "lowStock") return "limited" as const;
  return "hide" as const;
}

function standaloneProductProjection(
  catalogue: CatalogueDisplayModel,
  product: ProductDisplayModel,
  identity: StandaloneAvailabilityOptionMediaIdentity,
  catalogueRevision: string,
): AvailabilityOptionMediaTransportProjection {
  const dimensions = standaloneVariantDimensions(product);
  const status = standaloneStatus(product);
  const productAvailabilityId = stableId("availability", product.id);
  const productPurchasable =
    product.price !== undefined && status !== "outOfStock" && status !== "unavailable";
  const revision = `${catalogueRevision}:${product.id}`.slice(0, 160);
  const availability: AvailabilityOptionMediaTransportProjection["availability"] = [
    {
      availabilityId: productAvailabilityId,
      scope: "product",
      status,
      purchasable: productPurchasable,
      stockDisplay: standaloneStockDisplay(product),
      expectedAvailabilityMessage: product.availabilityLabel,
      revision,
    },
    ...product.variants.map((variant) => ({
      availabilityId: stableId("availability", variant.id),
      scope: "variant" as const,
      variantId: variant.id,
      status,
      purchasable: productPurchasable,
      stockDisplay: standaloneStockDisplay(product),
      expectedAvailabilityMessage: product.availabilityLabel,
      revision,
    })),
  ];

  return availabilityOptionMediaTransportProjectionSchema.parse({
    ...identity,
    catalogueId: catalogue.id,
    catalogueRevision,
    productId: product.id,
    revision,
    supportedLocales: ["en", "fi"],
    productAvailabilityId,
    availability,
    attributes: Object.entries(product.attributes).map(([key, value], index) => ({
      attributeId: stableId("attribute", `${product.id}:${key}`),
      label: displayLabel(product, key),
      value: structuredClone(value),
      displayOrder: index,
      presentationRole: "specification",
    })),
    optionGroups: [
      ...dimensions.map((dimension) => dimension.group),
      ...standaloneOrderOptionGroups(product),
    ],
    variants: product.variants.map((variant) => ({
      variantId: variant.id,
      optionValueIds: dimensions.map((dimension) => {
        const rawValue = variant.attributes[dimension.key];
        if (rawValue === undefined || Array.isArray(rawValue)) {
          throw new VeskoIntegrationError("brokenOptionReference");
        }
        const valueId = dimension.valueIdByKey.get(scalarKey(rawValue));
        if (valueId === undefined) throw new VeskoIntegrationError("brokenOptionReference");
        return valueId;
      }),
      availabilityId: stableId("availability", variant.id),
      price: variant.price ?? product.price,
      compareAtPrice: product.compareAtPrice,
      mediaIds: [],
      purchasable: productPurchasable && (variant.price ?? product.price) !== undefined,
      revision,
    })),
    media: product.images.map((image, index) => ({
      assetId: image.id,
      productId: product.id,
      role: index === 0 ? "main" : "alternative",
      alt: image.alt,
      decorative: image.decorative,
      revision,
    })),
  });
}

export type StandaloneAvailabilityOptionMediaIdentity = Readonly<{
  tenantId: string;
  storeId: string;
  storefrontProjectId: string;
}>;

export function standaloneAvailabilityOptionMediaIdentity(
  catalogue: CatalogueDisplayModel,
): StandaloneAvailabilityOptionMediaIdentity {
  return deepFreeze({
    tenantId: stableId("tenant", catalogue.id),
    storeId: stableId("store", catalogue.id),
    storefrontProjectId: stableId("project", catalogue.id),
  });
}

export function createStandaloneAvailabilityOptionMediaProjectionAdapter(
  catalogue: CatalogueDisplayModel,
): AvailabilityOptionMediaProjectionPort {
  const source = structuredClone(catalogue);
  const identity = standaloneAvailabilityOptionMediaIdentity(source);
  const catalogueRevision = `standalone-${sha256(source).slice("sha256:".length, 33)}`;
  return createAvailabilityOptionMediaProjectionProvider({
    transport: {
      load(context) {
        const product = source.products.find((candidate) => candidate.id === context.productId);
        if (product === undefined) throw new VeskoIntegrationError("productNotFound");
        return standaloneProductProjection(source, product, identity, catalogueRevision);
      },
    },
  });
}

function localizedScalar(
  value: z.infer<typeof storefrontDisplayAttributeSchema>["value"],
  locales: readonly Locale[],
): LocalizedText {
  if (typeof value === "object" && !Array.isArray(value)) return value;
  const rendered = Array.isArray(value) ? value.join(", ") : String(value);
  return Object.fromEntries(locales.map((locale) => [locale, rendered]));
}

function pdpMedia(
  projection: AvailabilityOptionMediaProjection,
): ProductPresentationContext["media"] {
  return projection.media.map(({ assetId, role, alt, variantIds }) => ({
    assetId,
    role,
    alt,
    variantIds,
  }));
}

export function projectAvailabilityOptionMediaToProductPresentation(
  projection: AvailabilityOptionMediaProjection,
  productInput: unknown,
): ProductPresentationContext {
  const product = storefrontSafeProductProjectionSchema.parse(productInput);
  if (product.productId !== projection.productId) {
    throw new VeskoIntegrationError("productNotFound");
  }
  const availability = projection.availability.find(
    (record) => record.availabilityId === projection.productAvailabilityId,
  );
  const locales = canonicalLocaleOrder(projection.supportedLocales);
  return productPresentationContextSchema.parse({
    productId: product.productId,
    productTypeId: product.productTypeId,
    sku: product.sku,
    title: product.title,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    priceUnavailableReason: product.priceUnavailableReason,
    availability: availability?.expectedAvailabilityMessage ?? product.availabilityLabel,
    media: pdpMedia(projection),
    attributeGroups:
      projection.attributes.length === 0
        ? []
        : [
            {
              id: stableId("attribute_group", projection.productId),
              title: Object.fromEntries(
                locales.map((locale) => [
                  locale,
                  locale === "fi" ? "Tuotetiedot" : "Product details",
                ]),
              ),
              attributes: projection.attributes.map((attribute) => ({
                id: attribute.attributeId,
                label: attribute.label,
                value: localizedScalar(attribute.value, locales),
                unit: attribute.unit,
              })),
            },
          ],
    optionGroups: projection.optionGroups,
    selectedValues: [],
    unavailableCombinations: [],
    relatedProductIds: [],
    revision: projection.catalogueRevision,
  });
}

function priceState(
  variant: AvailabilityOptionMediaProjection["variants"][number] | undefined,
  product: z.infer<typeof storefrontSafeProductProjectionSchema>,
) {
  const price = variant?.price ?? product.price;
  return price === undefined
    ? { priceUnavailableReason: product.priceUnavailableReason }
    : {
        price,
        compareAtPrice: variant?.compareAtPrice ?? product.compareAtPrice,
      };
}

export function createAvailabilityOptionMediaResolver(
  projection: AvailabilityOptionMediaProjection,
  productInput: unknown,
): CanonicalProductConfigurationResolver {
  const product = storefrontSafeProductProjectionSchema.parse(productInput);
  if (product.productId !== projection.productId) {
    throw new VeskoIntegrationError("productNotFound");
  }
  const dimensionGroups = projection.optionGroups.filter(
    (group) => group.source === "variantDimension",
  );
  const valueGroup = new Map(
    dimensionGroups.flatMap((group) => group.values.map((value) => [value.id, group.id] as const)),
  );

  return {
    resolve(input: CanonicalProductConfigurationInput) {
      if (
        input.productId !== projection.productId ||
        input.catalogueRevision !== projection.catalogueRevision
      ) {
        throw new VeskoIntegrationError("staleCatalogueProjection");
      }
      const selected = new Map(
        input.selectedValues.map((selection) => [selection.groupId, selection.valueId]),
      );
      const text = new Map(input.textEntries.map((entry) => [entry.groupId, entry.value]));
      const complete = projection.optionGroups.every((group) => {
        if (!group.required) return true;
        return group.presentation === "textInput"
          ? (text.get(group.id)?.length ?? 0) >= (group.textEntryConstraints?.minLength ?? 0)
          : selected.has(group.id);
      });
      if (!complete) return canonicalProductConfigurationResultSchema.parse({ purchasable: false });

      const variant =
        dimensionGroups.length === 0
          ? undefined
          : projection.variants.find((candidate) =>
              candidate.optionValueIds.every(
                (valueId) => selected.get(valueGroup.get(valueId) ?? "") === valueId,
              ),
            );
      if (dimensionGroups.length > 0 && variant === undefined) {
        return canonicalProductConfigurationResultSchema.parse({ purchasable: false });
      }
      const availabilityId = variant?.availabilityId ?? projection.productAvailabilityId;
      const availability = projection.availability.find(
        (record) => record.availabilityId === availabilityId,
      );
      if (availability === undefined) {
        throw new VeskoIntegrationError("brokenAvailabilityReference");
      }
      const mediaAssetIds =
        variant === undefined || variant.mediaIds.length === 0
          ? projection.media.map((media) => media.assetId)
          : variant.mediaIds;
      return canonicalProductConfigurationResultSchema.parse({
        resolvedConfiguration: variant
          ? { kind: "variant", variantId: variant.variantId }
          : { kind: "baseProduct" },
        purchasable: availability.purchasable && (variant?.purchasable ?? true),
        ...priceState(variant, product),
        availability: availability.expectedAvailabilityMessage,
        mediaAssetIds,
        disabledOptionValues: [],
        warnings: [],
      });
    },
  };
}
