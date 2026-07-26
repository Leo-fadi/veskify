import { createHash } from "node:crypto";
import { z } from "zod";

import {
  availabilityOptionMediaProjectionSchema,
  canonicalProductMediaProjectionSchema,
  catalogueProjectionSchema,
  storefrontAvailabilityRecordSchema,
  storefrontDisplayAttributeSchema,
  storefrontOptionGroupProjectionSchema,
  storefrontVariantProjectionSchema,
  VeskoIntegrationError,
  type AvailabilityOptionMediaProjection,
  type AvailabilityOptionMediaProjectionPort,
  type CatalogueProjection,
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

function failureForValidation(error: z.ZodError): IntegrationFailureCode {
  const message = error.issues.map((issue) => issue.message).join(" ");
  const localizedFieldFailure = error.issues.some((issue) => {
    const path = issue.path;
    return (
      (path[0] === "availability" && path[2] === "expectedAvailabilityMessage") ||
      (path[0] === "attributes" && ["label", "value", "unit"].includes(String(path[2]))) ||
      (path[0] === "optionGroups" &&
        (["label", "helpText"].includes(String(path[2])) ||
          (path[2] === "values" && ["label", "unavailableReason"].includes(String(path[4]))) ||
          (path[2] === "textEntryConstraints" && path[3] === "placeholder"))) ||
      (path[0] === "media" && path[2] === "alt")
    );
  });
  if (localizedFieldFailure && /unrecognized key|localized projection/i.test(message)) {
    return "unsupportedLocale";
  }
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
      const rawSupportedLocales =
        raw !== null && typeof raw === "object"
          ? (raw as Record<string, unknown>).supportedLocales
          : undefined;
      if (
        Array.isArray(rawSupportedLocales) &&
        rawSupportedLocales.some((locale) => locale !== "en" && locale !== "fi")
      ) {
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
    const candidateKeys = new Set(candidate);
    return candidateKeys.size === keys.length && keys.every((key) => candidateKeys.has(key));
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
    const seenValueFingerprints = new Set<string>();
    const values = (option.values ?? []).map((label) => {
      const fingerprint = sha256({ optionId: option.id, label });
      if (seenValueFingerprints.has(fingerprint)) {
        throw new VeskoIntegrationError("duplicateCanonicalIdentity");
      }
      seenValueFingerprints.add(fingerprint);
      const digest = fingerprint.slice("sha256:".length);
      return {
        id: stableId("option_value", `${option.id}:${digest}`),
        label,
        value: digest,
        disabled: false,
        metadata: {},
      };
    });
    return storefrontOptionGroupProjectionSchema.parse({
      id: option.id,
      label: option.label,
      source: "orderOption",
      required: option.required,
      presentation: (option.values?.length ?? 0) > 8 ? "dropdown" : "buttonGroup",
      values,
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
  catalogueId: string,
  catalogueRevision: string,
): AvailabilityOptionMediaTransportProjection {
  const dimensions = standaloneVariantDimensions(product);
  const status = standaloneStatus(product);
  const productAvailabilityId = stableId("availability", product.id);
  const productPurchasable =
    product.price !== undefined && status !== "outOfStock" && status !== "unavailable";
  const availabilityAllowsPurchase = status !== "outOfStock" && status !== "unavailable";
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
    ...product.variants.map((variant) => {
      const resolvedPrice = variant.price ?? product.price;
      return {
        availabilityId: stableId("availability", variant.id),
        scope: "variant" as const,
        variantId: variant.id,
        status,
        purchasable: availabilityAllowsPurchase && resolvedPrice !== undefined,
        stockDisplay: standaloneStockDisplay(product),
        expectedAvailabilityMessage: product.availabilityLabel,
        revision,
      };
    }),
  ];

  return availabilityOptionMediaTransportProjectionSchema.parse({
    ...identity,
    catalogueId,
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
    variants: product.variants.map((variant) => {
      const resolvedPrice = variant.price ?? product.price;
      return {
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
        price: resolvedPrice,
        compareAtPrice: product.compareAtPrice,
        mediaIds: [],
        purchasable: availabilityAllowsPurchase && resolvedPrice !== undefined,
        revision,
      };
    }),
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

/**
 * The standalone catalogue revision is shared with the P9-03-to-P9-01
 * composition. Integrated environments inject their own opaque revision.
 */
export function standaloneAvailabilityOptionMediaCatalogueRevision(
  catalogue: CatalogueDisplayModel,
): string {
  return `standalone-${sha256(catalogue).slice("sha256:".length, 33)}`;
}

export type StandaloneAvailabilityOptionMediaAdapterOptions = Readonly<{
  identity?: StandaloneAvailabilityOptionMediaIdentity;
  catalogueId?: string;
  catalogueRevision?: string;
}>;

export function createStandaloneAvailabilityOptionMediaProjectionAdapter(
  catalogue: CatalogueDisplayModel,
  options: StandaloneAvailabilityOptionMediaAdapterOptions = {},
): AvailabilityOptionMediaProjectionPort {
  const source = structuredClone(catalogue);
  const identity = options.identity ?? standaloneAvailabilityOptionMediaIdentity(source);
  const catalogueId = options.catalogueId ?? source.id;
  const catalogueRevision =
    options.catalogueRevision ?? standaloneAvailabilityOptionMediaCatalogueRevision(source);
  return createAvailabilityOptionMediaProjectionProvider({
    transport: {
      load(context) {
        const product = source.products.find((candidate) => candidate.id === context.productId);
        if (product === undefined) throw new VeskoIntegrationError("productNotFound");
        return standaloneProductProjection(
          source,
          product,
          identity,
          catalogueId,
          catalogueRevision,
        );
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
  return projection.media.map(({ assetId, role, alt, decorative, variantIds }) => ({
    assetId,
    role,
    alt,
    decorative,
    variantIds,
  }));
}

function joinedCatalogueProduct(
  projection: AvailabilityOptionMediaProjection,
  catalogueInput: unknown,
): CatalogueProjection["products"][number] {
  const catalogueResult = catalogueProjectionSchema.safeParse(catalogueInput);
  if (!catalogueResult.success) {
    throw new VeskoIntegrationError("malformedIntegrationResponse");
  }
  const catalogue = catalogueResult.data;
  if (catalogue.tenantId !== projection.tenantId || catalogue.storeId !== projection.storeId) {
    throw new VeskoIntegrationError("tenantMismatch");
  }
  if (catalogue.storefrontProjectId !== projection.storefrontProjectId) {
    throw new VeskoIntegrationError("projectMismatch");
  }
  if (catalogue.catalogueId !== projection.catalogueId) {
    throw new VeskoIntegrationError("brokenCatalogueReference");
  }
  if (catalogue.revision !== projection.catalogueRevision) {
    throw new VeskoIntegrationError("staleCatalogueProjection");
  }
  const product = catalogue.products.find(
    (candidate) => candidate.productId === projection.productId,
  );
  if (product === undefined) throw new VeskoIntegrationError("productNotFound");
  return product;
}

export function projectAvailabilityOptionMediaToProductPresentation(
  projection: AvailabilityOptionMediaProjection,
  catalogueInput: unknown,
): ProductPresentationContext {
  const product = joinedCatalogueProduct(projection, catalogueInput);
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
              attributes: [...projection.attributes]
                .sort((left, right) => left.displayOrder - right.displayOrder)
                .map((attribute) => ({
                  id: attribute.attributeId,
                  label: attribute.label,
                  value: localizedScalar(attribute.value, locales),
                  unit: attribute.unit,
                  displayOrder: attribute.displayOrder,
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
  product: CatalogueProjection["products"][number],
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
  catalogueInput: unknown,
): CanonicalProductConfigurationResolver {
  const product = joinedCatalogueProduct(projection, catalogueInput);
  const dimensionGroups = projection.optionGroups.filter(
    (group) => group.source === "variantDimension",
  );
  const valueGroup = new Map(
    dimensionGroups.flatMap((group) => group.values.map((value) => [value.id, group.id] as const)),
  );
  const availabilityById = new Map(
    projection.availability.map((record) => [record.availabilityId, record]),
  );

  const dependenciesSatisfied = (
    group: (typeof projection.optionGroups)[number],
    selected: ReadonlyMap<string, string>,
  ) =>
    group.dependsOn.every((dependency) => {
      const selectedValue = selected.get(dependency.groupId);
      return (
        selectedValue !== undefined &&
        (dependency.valueIds === undefined || dependency.valueIds.includes(selectedValue))
      );
    });

  const variantCanBePurchased = (variant: (typeof projection.variants)[number]): boolean => {
    const availability = availabilityById.get(variant.availabilityId);
    return (
      availability?.purchasable === true &&
      variant.purchasable &&
      (variant.price ?? product.price) !== undefined
    );
  };

  const disabledValuesFor = (selected: ReadonlyMap<string, string>) =>
    dimensionGroups.flatMap((group) => {
      if (!dependenciesSatisfied(group, selected)) return [];
      return group.values.flatMap((value) => {
        const candidateSelections = new Map(selected);
        candidateSelections.set(group.id, value.id);
        const viable = projection.variants.some(
          (variant) =>
            variantCanBePurchased(variant) &&
            dimensionGroups.every((dimension) => {
              const selectedValue = candidateSelections.get(dimension.id);
              return (
                selectedValue === undefined ||
                variant.optionValueIds.some(
                  (valueId) =>
                    valueId === selectedValue && valueGroup.get(valueId) === dimension.id,
                )
              );
            }),
        );
        return viable ? [] : [{ groupId: group.id, valueId: value.id }];
      });
    });

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
      const disabledOptionValues = disabledValuesFor(selected);
      if (!complete) {
        return canonicalProductConfigurationResultSchema.parse({
          purchasable: false,
          disabledOptionValues,
        });
      }

      const variant =
        dimensionGroups.length === 0
          ? projection.variants.length === 1
            ? projection.variants[0]
            : undefined
          : projection.variants.find((candidate) =>
              candidate.optionValueIds.every(
                (valueId) => selected.get(valueGroup.get(valueId) ?? "") === valueId,
              ),
            );
      if (
        (dimensionGroups.length > 0 && variant === undefined) ||
        (dimensionGroups.length === 0 && projection.variants.length > 1)
      ) {
        return canonicalProductConfigurationResultSchema.parse({
          purchasable: false,
          disabledOptionValues,
        });
      }
      const availabilityId = variant?.availabilityId ?? projection.productAvailabilityId;
      const availability = projection.availability.find(
        (record) => record.availabilityId === availabilityId,
      );
      if (availability === undefined) {
        throw new VeskoIntegrationError("brokenAvailabilityReference");
      }
      const mediaAssetIds = variant?.mediaIds.length
        ? variant.mediaIds
        : projection.media
            .filter(
              (media) =>
                media.variantIds === undefined ||
                media.variantIds.length === 0 ||
                (variant !== undefined && media.variantIds.includes(variant.variantId)),
            )
            .map((media) => media.assetId);
      return canonicalProductConfigurationResultSchema.parse({
        resolvedConfiguration: variant
          ? { kind: "variant", variantId: variant.variantId }
          : { kind: "baseProduct" },
        purchasable:
          availability.purchasable &&
          (variant?.purchasable ?? true) &&
          (variant?.price ?? product.price) !== undefined,
        ...priceState(variant, product),
        availability: availability.expectedAvailabilityMessage,
        sku: variant?.sku,
        mediaAssetIds,
        disabledOptionValues,
        warnings: [],
      });
    },
  };
}
