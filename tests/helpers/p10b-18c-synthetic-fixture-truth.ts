import { materializeCurrentDynamicCommercePresentationAuthority } from "@/application/dynamic-commerce-routes";
import type { ContentSupportFactAuthority } from "@/application/content-support-pages";
import {
  deriveSemanticCapabilityIndex,
  prepareSemanticStorefrontDesignCompilationAuthority,
} from "@/application/prompted-storefront-design-compiler";
import {
  createPromptedStorefrontDesignRequestV2,
  createSemanticStorefrontDesignRequestV1,
  semanticStorefrontCurrentAuthorityFingerprint,
} from "@/application/prompted-storefront-design-intent";
import { storefrontSiteMapDecisionSchema } from "@/application/storefront-site-map";
import {
  catalogueDisplayModelSchema,
  type CatalogueDisplayModel,
  type ProductDisplayModel,
} from "@/domain/catalogue";
import { projectSchema } from "@/domain/project";
import {
  canonicalValueFingerprint,
  contentSupportFactDocumentSchema,
  contentSupportFactPayloadSchema,
  createContentSupportFactDocument,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import {
  createP10b18aShapeAuthorities,
  type P10b18aShapeAuthority,
} from "./p10b-18a-commercial-authority";

const CUSTOMER_LOCALES = ["en", "fi"] as const;
const SYNTHETIC_MEDIA_ROOT = "/seed-assets/p10b-18c-synthetic";
const INTERNAL_CUSTOMER_TERM =
  /\b(?:audit|test(?:-only)?|fixture|deterministic|verification|synthetic|internal|configuration[ -]class)\b/i;
const NEUTRAL_CUSTOMER_CATEGORY_TERM = /(?:jewel|koru|demo|catalog|katalog)/i;

const NEUTRAL_MERCHANT_COPY = {
  description: localized(
    "Configurable work desks and workspace furniture for focused spaces.",
    "Muunneltavia työpöytiä ja työtilakalusteita selkeisiin tiloihin.",
  ),
  audience: localized(
    "People creating focused home and professional workspaces.",
    "Selkeitä koti- ja työympäristöjä rakentavat asiakkaat.",
  ),
  categoryLabel: "workspace furniture",
  projectIndustry: "generic",
  briefIndustry: "home",
} as const;

type CustomerLocale = (typeof CUSTOMER_LOCALES)[number];
type LocalizedPair = Readonly<Record<CustomerLocale, string>>;
type SyntheticShapeId = "mixed-jewellery-watch" | "neutral-true-high-consideration";

export type P10b18cProductTruthMetadata = Readonly<{
  productId: string;
  productKind: "ring" | "watch" | "modular-desk";
  expectedProductType: string;
  expectedOptionGroupIds: readonly string[];
  expectedVariantAttributeCounts: readonly number[];
  expectedMediaCount: number;
  requiredMediaUrlToken: string | null;
  requiredAltToken: Readonly<Record<CustomerLocale, string>>;
}>;

export type P10b18cFixtureTruthMetadata = Readonly<{
  shapeId: SyntheticShapeId;
  enabledLocales: readonly CustomerLocale[];
  products: readonly P10b18cProductTruthMetadata[];
  internalDiagnostics?: Readonly<Record<string, unknown>>;
}>;

export type P10b18cFixtureTruthRevisionEvidence = Readonly<{
  revisionId:
    | "p10b-18c-neutral-synthetic-customer-truth-r1"
    | "p10b-18c-neutral-synthetic-customer-truth-r2"
    | "unchanged";
  sourceCatalogueFingerprint: string;
  correctedCatalogueFingerprint: string;
  sourceCommerceFingerprint: string;
  correctedCommerceFingerprint: string;
  sourceMediaFingerprint: string;
  correctedMediaFingerprint: string;
}>;

export type P10b18cShapeAuthority = P10b18aShapeAuthority &
  Readonly<{
    fixtureTruthMetadata: P10b18cFixtureTruthMetadata | null;
    fixtureTruthRevision: P10b18cFixtureTruthRevisionEvidence;
  }>;

export class P10b18cFixtureCustomerTruthError extends Error {
  readonly code = "p10b-18c-fixture-customer-truth";

  constructor(
    readonly path: string,
    readonly locale: CustomerLocale | null,
    readonly reason:
      | "missing-enabled-locale"
      | "empty-enabled-locale"
      | "english-fallback-customer-locale"
      | "customer-internal-terminology"
      | "customer-category-mismatch"
      | "product-truth-mismatch"
      | "media-truth-mismatch"
      | "option-truth-mismatch",
  ) {
    super(
      `P10B-18C fixture customer truth failed at ${path}${
        locale === null ? "" : ` [${locale}]`
      }: ${reason}.`,
    );
    this.name = "P10b18cFixtureCustomerTruthError";
  }
}

function localized(en: string, fi: string): LocalizedPair {
  return { en, fi };
}

function recordValue(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function localizedValue(value: unknown): Partial<Record<CustomerLocale, string>> | null {
  const record = recordValue(value);
  if (record === null || !("en" in record || "fi" in record)) return null;
  if (
    !Object.entries(record).every(
      ([key, entry]) => /^[a-z]{2}(?:-[A-Z]{2})?$/.test(key) && typeof entry === "string",
    )
  ) {
    return null;
  }
  return {
    ...(typeof record.en === "string" ? { en: record.en } : {}),
    ...(typeof record.fi === "string" ? { fi: record.fi } : {}),
  };
}

function languageNeutralValue(value: string): boolean {
  const normalized = value.trim();
  return (
    !/[A-Za-z]/.test(normalized) ||
    /^[\d\s.,+:/%€$-]+(?:cm|mm|m|kg|g|ml|l)?$/i.test(normalized) ||
    /^[A-Z0-9][A-Z0-9 .+&/-]{0,15}$/.test(normalized) ||
    normalized === "Karvonen" ||
    /^(?:https?:\/\/|\/|mailto:|tel:)/.test(normalized)
  );
}

function failTruth(
  path: string,
  locale: CustomerLocale | null,
  reason: ConstructorParameters<typeof P10b18cFixtureCustomerTruthError>[2],
): never {
  throw new P10b18cFixtureCustomerTruthError(path, locale, reason);
}

function inspectLocalizedCustomerValues(value: unknown, path: readonly string[]): void {
  const localizedText = localizedValue(value);
  if (localizedText !== null) {
    for (const locale of CUSTOMER_LOCALES) {
      const resolved = localizedText[locale];
      if (resolved === undefined) failTruth(path.join("."), locale, "missing-enabled-locale");
      if (resolved.trim().length === 0) failTruth(path.join("."), locale, "empty-enabled-locale");
      if (INTERNAL_CUSTOMER_TERM.test(resolved))
        failTruth(path.join("."), locale, "customer-internal-terminology");
    }
    if (
      localizedText.en === localizedText.fi &&
      localizedText.fi !== undefined &&
      !languageNeutralValue(localizedText.fi)
    ) {
      failTruth(path.join("."), "fi", "english-fallback-customer-locale");
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      inspectLocalizedCustomerValues(entry, [...path, String(index)]),
    );
    return;
  }
  const record = recordValue(value);
  if (record === null) return;
  for (const [key, entry] of Object.entries(record)) {
    inspectLocalizedCustomerValues(entry, [...path, key]);
  }
}

function inspectNeutralLocalizedCategoryValues(value: unknown, path: readonly string[]): void {
  const localizedText = localizedValue(value);
  if (localizedText !== null) {
    for (const locale of CUSTOMER_LOCALES) {
      const resolved = localizedText[locale];
      if (resolved !== undefined && NEUTRAL_CUSTOMER_CATEGORY_TERM.test(resolved)) {
        failTruth(path.join("."), locale, "customer-category-mismatch");
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      inspectNeutralLocalizedCategoryValues(entry, [...path, String(index)]),
    );
    return;
  }
  const record = recordValue(value);
  if (record === null) return;
  for (const [key, entry] of Object.entries(record)) {
    inspectNeutralLocalizedCategoryValues(entry, [...path, key]);
  }
}

function inspectNeutralPlainCustomerValues(
  values: Readonly<Record<string, unknown>>,
  path: readonly string[],
): void {
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "string") continue;
    if (value.trim().length === 0)
      failTruth([...path, key].join("."), null, "empty-enabled-locale");
    if (INTERNAL_CUSTOMER_TERM.test(value)) {
      failTruth([...path, key].join("."), null, "customer-internal-terminology");
    }
    if (NEUTRAL_CUSTOMER_CATEGORY_TERM.test(value)) {
      failTruth([...path, key].join("."), null, "customer-category-mismatch");
    }
  }
}

function inspectPlainCustomerProductValues(catalogue: CatalogueDisplayModel): void {
  catalogue.products.forEach((product, productIndex) => {
    if (product.sku !== undefined && INTERNAL_CUSTOMER_TERM.test(product.sku)) {
      failTruth(`catalogue.products.${productIndex}.sku`, null, "customer-internal-terminology");
    }
    for (const [key, value] of Object.entries(product.attributes)) {
      const customerValue = Array.isArray(value) ? value.join(" ") : String(value);
      if (INTERNAL_CUSTOMER_TERM.test(key) || INTERNAL_CUSTOMER_TERM.test(customerValue)) {
        failTruth(
          `catalogue.products.${productIndex}.attributes.${key}`,
          null,
          "customer-internal-terminology",
        );
      }
    }
    product.variants.forEach((variant, variantIndex) => {
      for (const [key, value] of Object.entries(variant.attributes)) {
        const customerValue = Array.isArray(value) ? value.join(" ") : String(value);
        if (INTERNAL_CUSTOMER_TERM.test(key) || INTERNAL_CUSTOMER_TERM.test(customerValue)) {
          failTruth(
            `catalogue.products.${productIndex}.variants.${variantIndex}.attributes.${key}`,
            null,
            "customer-internal-terminology",
          );
        }
        if (key === "Size" || key === "size" || key === "Availability" || key === "availability") {
          failTruth(
            `catalogue.products.${productIndex}.variants.${variantIndex}.attributes.${key}`,
            "fi",
            "english-fallback-customer-locale",
          );
        }
      }
    });
  });
}

export function assertP10b18cFixtureCustomerTruth(input: {
  shapeId: string;
  catalogue: unknown;
  siteMapDecision: unknown;
  metadata: P10b18cFixtureTruthMetadata;
  project?: unknown;
  draft?: unknown;
  approvedBriefBusinessIdentity?: unknown;
  contentFactDocuments?: readonly unknown[];
  internalDiagnostics?: unknown;
}): void {
  if (input.shapeId !== input.metadata.shapeId) {
    failTruth("metadata.shapeId", null, "product-truth-mismatch");
  }
  if (
    CUSTOMER_LOCALES.some((locale) => !input.metadata.enabledLocales.includes(locale)) ||
    input.metadata.enabledLocales.some((locale) => !CUSTOMER_LOCALES.includes(locale))
  ) {
    failTruth("metadata.enabledLocales", null, "missing-enabled-locale");
  }

  const catalogue = catalogueDisplayModelSchema.parse(structuredClone(input.catalogue));
  inspectLocalizedCustomerValues(catalogue, ["catalogue"]);
  inspectLocalizedCustomerValues(input.siteMapDecision, ["siteMapDecision"]);
  inspectPlainCustomerProductValues(catalogue);

  const project = input.project === undefined ? null : projectSchema.parse(input.project);
  const draft = input.draft === undefined ? null : storefrontSnapshotSchema.parse(input.draft);
  const contentFactDocuments = (input.contentFactDocuments ?? []).map((document) =>
    contentSupportFactDocumentSchema.parse(document),
  );
  if (draft !== null) inspectLocalizedCustomerValues(draft, ["draft"]);
  contentFactDocuments.forEach((document, index) =>
    inspectLocalizedCustomerValues(document.payload, ["contentFactDocuments", String(index)]),
  );

  if (input.shapeId === "neutral-true-high-consideration") {
    inspectNeutralLocalizedCategoryValues(catalogue, ["catalogue"]);
    inspectNeutralLocalizedCategoryValues(input.siteMapDecision, ["siteMapDecision"]);
    if (draft !== null) inspectNeutralLocalizedCategoryValues(draft, ["draft"]);
    contentFactDocuments.forEach((document, index) =>
      inspectNeutralLocalizedCategoryValues(document.payload, [
        "contentFactDocuments",
        String(index),
      ]),
    );
    if (project !== null) {
      inspectNeutralPlainCustomerValues(
        {
          name: project.name,
          industry: project.industry,
          businessName: project.businessProfile.name,
          description: project.businessProfile.description,
          audience: project.businessProfile.audience,
          market: project.businessProfile.market,
        },
        ["project"],
      );
    }
    const businessIdentity = recordValue(input.approvedBriefBusinessIdentity);
    if (businessIdentity !== null) {
      inspectNeutralPlainCustomerValues(businessIdentity, ["approvedBrief", "businessIdentity"]);
    }
  }

  if (catalogue.products.length !== input.metadata.products.length) {
    failTruth("catalogue.products", null, "product-truth-mismatch");
  }
  input.metadata.products.forEach((expected, productIndex) => {
    const product = catalogue.products[productIndex];
    if (
      product === undefined ||
      product.id !== expected.productId ||
      product.productType !== expected.expectedProductType
    ) {
      failTruth(`catalogue.products.${productIndex}.productType`, null, "product-truth-mismatch");
    }
    const optionIds = (product.orderOptions ?? []).map(({ id }) => id);
    if (
      canonicalValueFingerprint(optionIds) !==
      canonicalValueFingerprint(expected.expectedOptionGroupIds)
    ) {
      failTruth(`catalogue.products.${productIndex}.orderOptions`, null, "option-truth-mismatch");
    }
    const variantAttributeCounts = product.variants.map(
      ({ attributes }) => Object.keys(attributes).length,
    );
    if (
      canonicalValueFingerprint(variantAttributeCounts) !==
      canonicalValueFingerprint(expected.expectedVariantAttributeCounts)
    ) {
      failTruth(`catalogue.products.${productIndex}.variants`, null, "option-truth-mismatch");
    }
    if (product.images.length !== expected.expectedMediaCount) {
      failTruth(`catalogue.products.${productIndex}.images`, null, "media-truth-mismatch");
    }
    product.images.forEach((image, imageIndex) => {
      if (
        expected.requiredMediaUrlToken !== null &&
        !image.url.includes(expected.requiredMediaUrlToken)
      ) {
        failTruth(
          `catalogue.products.${productIndex}.images.${imageIndex}.url`,
          null,
          "media-truth-mismatch",
        );
      }
      const alt = localizedValue(image.alt);
      for (const locale of CUSTOMER_LOCALES) {
        if (!alt?.[locale]?.toLocaleLowerCase(locale).includes(expected.requiredAltToken[locale])) {
          failTruth(
            `catalogue.products.${productIndex}.images.${imageIndex}.alt`,
            locale,
            "media-truth-mismatch",
          );
        }
      }
    });
  });

  void input.internalDiagnostics;
}

const neutralOptionCopy = [
  {
    label: localized("Surface", "Pinta"),
    values: [
      localized("Natural tone", "Luonnollinen sävy"),
      localized("Dark tone", "Tumma sävy"),
      localized("Light tone", "Vaalea sävy"),
    ],
  },
  {
    label: localized("Width", "Leveys"),
    values: [
      localized("120 cm", "120 cm"),
      localized("160 cm", "160 cm"),
      localized("180 cm", "180 cm"),
    ],
  },
  {
    label: localized("Frame", "Runko"),
    values: [localized("Light frame", "Vaalea runko"), localized("Dark frame", "Tumma runko")],
  },
  {
    label: localized("Cable tray", "Kaapelikouru"),
    values: [localized("Without tray", "Ilman kourua"), localized("With tray", "Kourun kanssa")],
  },
] as const;

function correctedNeutralProduct(product: ProductDisplayModel): ProductDisplayModel {
  const media = ["modular-desk-front.svg", "modular-desk-side.svg", "modular-desk-detail.svg"];
  return {
    ...structuredClone(product),
    sku: "MOD-DESK-001",
    title: localized("Modular work desk", "Muunneltava työpöytä"),
    description: localized(
      "A configurable work desk with choices for surface, width, frame and cable tray.",
      "Muunneltava työpöytä, johon voi valita pinnan, leveyden, rungon ja kaapelikourun.",
    ),
    productType: "configurable-furniture",
    attributes: {},
    variants: product.variants.map((variant, variantIndex) => ({
      ...variant,
      label: localized(
        `Desk configuration ${variantIndex + 1}`,
        `Työpöytämalli ${variantIndex + 1}`,
      ),
      attributes: Object.fromEntries(
        Object.entries(variant.attributes).map(([key, value]) => {
          if (key === "Size" || key === "size") {
            return [
              "Kokoluokka",
              ["Kompakti", "Keskikokoinen", "Leveä"][variantIndex] ?? `Malli ${variantIndex + 1}`,
            ];
          }
          if (key === "Availability" || key === "availability") {
            return ["saatavuus", value];
          }
          return [key, value];
        }),
      ),
    })),
    images: product.images.map((image, imageIndex) => ({
      ...image,
      id: `p10b18c-neutral-desk-${imageIndex + 1}`,
      url: `${SYNTHETIC_MEDIA_ROOT}/${media[imageIndex % media.length]}`,
      alt: localized(
        `Modular work desk, view ${imageIndex + 1}`,
        `Muunneltava työpöytä, näkymä ${imageIndex + 1}`,
      ),
      decorative: false,
    })),
    orderOptions: (product.orderOptions ?? []).map((group, groupIndex) => {
      const copy = neutralOptionCopy[groupIndex];
      if (copy === undefined) return group;
      return {
        ...group,
        label: copy.label,
        values: (group.values ?? []).map(
          (_value, valueIndex) =>
            copy.values[valueIndex] ??
            localized(`Choice ${valueIndex + 1}`, `Vaihtoehto ${valueIndex + 1}`),
        ),
      };
    }),
  };
}

const correctedWatchCopy = [
  {
    sku: "WATCH-ROUND-001",
    title: localized("Round dial watch", "Pyöreä rannekello"),
    description: localized(
      "A wristwatch with a round dial and a clear hour display.",
      "Rannekello, jossa on pyöreä kellotaulu ja selkeä tuntinäyttö.",
    ),
    media: "watch-round.svg",
  },
  {
    sku: "WATCH-SQUARE-001",
    title: localized("Square dial watch", "Neliötauluinen rannekello"),
    description: localized(
      "A wristwatch with a square dial and a restrained profile.",
      "Rannekello, jossa on neliömäinen kellotaulu ja pelkistetty muoto.",
    ),
    media: "watch-square.svg",
  },
  {
    sku: "WATCH-MULTI-001",
    title: localized("Multi-dial watch", "Monitauluinen rannekello"),
    description: localized(
      "A wristwatch with a layered dial layout and clear markers.",
      "Rannekello, jossa on kerroksellinen kellotaulu ja selkeät merkinnät.",
    ),
    media: "watch-multidial.svg",
  },
] as const;

function correctedMixedProducts(products: readonly ProductDisplayModel[]): ProductDisplayModel[] {
  return products.map((product, productIndex) => {
    if (productIndex === 0) {
      return {
        ...structuredClone(product),
        title: localized("Sculpted ring", "Muotoiltu sormus"),
        description: localized(
          "A softly curved ring with selectable size.",
          "Pehmeästi kaartuva sormus, johon voi valita koon.",
        ),
        productType: "ring",
        attributes: {},
        variants: product.variants.map((variant, variantIndex) => ({
          ...variant,
          label: localized(
            `Sculpted ring ${variantIndex + 1}`,
            `Muotoiltu sormus ${variantIndex + 1}`,
          ),
          attributes: Object.fromEntries(
            Object.entries(variant.attributes).map(([key, value]) => [
              key === "Size" || key === "size"
                ? "koko"
                : key === "Availability" || key === "availability"
                  ? "saatavuus"
                  : key,
              value,
            ]),
          ),
        })),
        images: product.images.map((image, imageIndex) => ({
          ...image,
          alt: localized(
            `Sculpted ring, view ${imageIndex + 1}`,
            `Muotoiltu sormus, näkymä ${imageIndex + 1}`,
          ),
          decorative: false,
        })),
      };
    }
    const copy = correctedWatchCopy[productIndex - 1];
    if (copy === undefined) return product;
    return {
      ...structuredClone(product),
      sku: copy.sku,
      title: copy.title,
      description: copy.description,
      productType: "watch",
      attributes: {},
      variants: product.variants.map((variant, variantIndex) => ({
        ...variant,
        label: localized(
          `${copy.title.en} ${variantIndex + 1}`,
          `${copy.title.fi} ${variantIndex + 1}`,
        ),
        attributes: Object.fromEntries(
          Object.entries(variant.attributes).map(([key, value]) => [
            key === "Size" || key === "size"
              ? "koko"
              : key === "Availability" || key === "availability"
                ? "saatavuus"
                : key === "Material" || key === "material"
                  ? "materiaali"
                  : key === "Color" || key === "Colour" || key === "color" || key === "colour"
                    ? "väri"
                    : key,
            value,
          ]),
        ),
      })),
      images: product.images.map((image, imageIndex) => ({
        ...image,
        id: `p10b18c-mixed-watch-${productIndex}-${imageIndex + 1}`,
        url: `${SYNTHETIC_MEDIA_ROOT}/${copy.media}`,
        alt: localized(
          `${copy.title.en}, view ${imageIndex + 1}`,
          `${copy.title.fi}, näkymä ${imageIndex + 1}`,
        ),
        decorative: false,
      })),
    };
  });
}

function correctedCatalogue(source: P10b18aShapeAuthority): CatalogueDisplayModel {
  const isNeutral = source.id === "neutral-true-high-consideration";
  const products = isNeutral
    ? source.catalogue.products.map(correctedNeutralProduct)
    : correctedMixedProducts(source.catalogue.products);
  return catalogueDisplayModelSchema.parse({
    ...structuredClone(source.catalogue),
    products,
    collections: source.catalogue.collections.map((collection, collectionIndex) => ({
      ...structuredClone(collection),
      title: isNeutral
        ? localized(
            `Modular workspace ${collectionIndex + 1}`,
            `Muunneltava työtila ${collectionIndex + 1}`,
          )
        : localized(
            `Jewellery and watches ${collectionIndex + 1}`,
            `Korut ja kellot ${collectionIndex + 1}`,
          ),
      description: isNeutral
        ? localized(
            "Configurable furniture for a focused workspace.",
            "Muunneltavia kalusteita selkeään työtilaan.",
          )
        : localized(
            "Rings and watches presented as a concise everyday selection.",
            "Tiivis valikoima sormuksia ja rannekelloja arkeen.",
          ),
    })),
  });
}

type EntityReplacement = Readonly<{
  id: string;
  titleBefore: Partial<Record<CustomerLocale, string>>;
  descriptionBefore: Partial<Record<CustomerLocale, string>>;
  titleAfter: LocalizedPair;
  descriptionAfter: LocalizedPair;
}>;

function requireLocalizedPair(value: unknown, path: string): LocalizedPair {
  const pair = localizedValue(value);
  if (pair?.en === undefined) failTruth(path, "en", "missing-enabled-locale");
  if (pair.fi === undefined) failTruth(path, "fi", "missing-enabled-locale");
  return { en: pair.en, fi: pair.fi };
}

function replacementEntities(
  before: CatalogueDisplayModel,
  after: CatalogueDisplayModel,
): readonly EntityReplacement[] {
  const replacements: EntityReplacement[] = [];
  before.collections.forEach((entity, index) => {
    const next = after.collections[index];
    if (next === undefined) return;
    replacements.push({
      id: entity.id,
      titleBefore: localizedValue(entity.title) ?? {},
      descriptionBefore: localizedValue(entity.description) ?? {},
      titleAfter: requireLocalizedPair(next.title, `catalogue.collections.${index}.title`),
      descriptionAfter: requireLocalizedPair(
        next.description,
        `catalogue.collections.${index}.description`,
      ),
    });
  });
  before.products.forEach((entity, index) => {
    const next = after.products[index];
    if (next === undefined) return;
    replacements.push({
      id: entity.id,
      titleBefore: localizedValue(entity.title) ?? {},
      descriptionBefore: localizedValue(entity.description) ?? {},
      titleAfter: requireLocalizedPair(next.title, `catalogue.products.${index}.title`),
      descriptionAfter: requireLocalizedPair(
        next.description,
        `catalogue.products.${index}.description`,
      ),
    });
  });
  return replacements;
}

function referencedEntityId(value: unknown, depth = 0): string | null {
  if (depth > 3) return null;
  const record = recordValue(value);
  if (record === null) return null;
  for (const [key, entry] of Object.entries(record)) {
    if ((key === "productId" || key === "collectionId") && typeof entry === "string") {
      return entry;
    }
  }
  for (const entry of Object.values(record)) {
    const nested = referencedEntityId(entry, depth + 1);
    if (nested !== null) return nested;
  }
  return null;
}

function rewriteSiteMapLocalizedValue(
  source: Partial<Record<CustomerLocale, string>>,
  path: readonly string[],
  replacements: readonly EntityReplacement[],
  contextId: string | null,
  pageFamilyId: string | null,
): LocalizedPair {
  const context = replacements.find(({ id }) => id === contextId);
  const pathName = path.at(-1)?.toLocaleLowerCase() ?? "";
  const isDescription = /description|summary|body/.test(pathName);
  if (
    source.en === source.fi &&
    source.fi !== undefined &&
    !languageNeutralValue(source.fi) &&
    pathName === "metadescription"
  ) {
    if (pageFamilyId === "home") {
      return localized(
        "Explore the current storefront and its available products.",
        "Tutustu verkkokauppaan ja saatavilla oleviin tuotteisiin.",
      );
    }
    if (pageFamilyId === "about") {
      return localized(
        "Learn more about the store and its approach.",
        "Lue lisää kaupasta ja sen toimintatavasta.",
      );
    }
  }
  const entries = CUSTOMER_LOCALES.map((locale): readonly [CustomerLocale, string] => {
    const value = source[locale] ?? "";
    const matching =
      context ??
      replacements.find(({ titleBefore, descriptionBefore }) =>
        [...Object.values(titleBefore), ...Object.values(descriptionBefore)].some(
          (candidate) =>
            candidate !== undefined && candidate.length > 0 && value.includes(candidate),
        ),
      );
    if (matching === undefined) return [locale, value];
    const hadEntityText = [
      ...Object.values(matching.titleBefore),
      ...Object.values(matching.descriptionBefore),
    ].some(
      (candidate) => candidate !== undefined && candidate.length > 0 && value.includes(candidate),
    );
    if (!hadEntityText && !INTERNAL_CUSTOMER_TERM.test(value)) return [locale, value];
    return [
      locale,
      isDescription ? matching.descriptionAfter[locale] : matching.titleAfter[locale],
    ];
  });
  return Object.fromEntries(entries) as LocalizedPair;
}

function rewriteSiteMapCustomerTruth(
  value: unknown,
  replacements: readonly EntityReplacement[],
  path: readonly string[] = [],
  inheritedContextId: string | null = null,
  inheritedPageFamilyId: string | null = null,
): unknown {
  const localizedText = localizedValue(value);
  if (localizedText !== null) {
    return rewriteSiteMapLocalizedValue(
      localizedText,
      path,
      replacements,
      inheritedContextId,
      inheritedPageFamilyId,
    );
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      rewriteSiteMapCustomerTruth(
        entry,
        replacements,
        [...path, String(index)],
        inheritedContextId,
        inheritedPageFamilyId,
      ),
    );
  }
  const record = recordValue(value);
  if (record === null) return value;
  const contextId = referencedEntityId(record) ?? inheritedContextId;
  const pageFamilyId =
    typeof record.familyId === "string" ? record.familyId : inheritedPageFamilyId;
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      rewriteSiteMapCustomerTruth(entry, replacements, [...path, key], contextId, pageFamilyId),
    ]),
  );
}

function truthMetadata(
  shapeId: SyntheticShapeId,
  before: CatalogueDisplayModel,
  after: CatalogueDisplayModel,
): P10b18cFixtureTruthMetadata {
  return {
    shapeId,
    enabledLocales: CUSTOMER_LOCALES,
    products: after.products.map((product, productIndex) => ({
      productId: product.id,
      productKind:
        shapeId === "neutral-true-high-consideration"
          ? "modular-desk"
          : productIndex === 0
            ? "ring"
            : "watch",
      expectedProductType:
        shapeId === "neutral-true-high-consideration"
          ? "configurable-furniture"
          : productIndex === 0
            ? "ring"
            : "watch",
      expectedOptionGroupIds: (before.products[productIndex]?.orderOptions ?? []).map(
        ({ id }) => id,
      ),
      expectedVariantAttributeCounts: (before.products[productIndex]?.variants ?? []).map(
        ({ attributes }) => Object.keys(attributes).length,
      ),
      expectedMediaCount: before.products[productIndex]?.images.length ?? 0,
      requiredMediaUrlToken:
        shapeId === "neutral-true-high-consideration"
          ? "modular-desk"
          : productIndex === 0
            ? null
            : "watch-",
      requiredAltToken:
        shapeId === "neutral-true-high-consideration"
          ? localized("desk", "työpöytä")
          : productIndex === 0
            ? localized("ring", "sormus")
            : localized("watch", "rannekello"),
    })),
    internalDiagnostics: {
      correctionClass: "test-only fixture customer-truth revision",
      sourceShapeId: shapeId,
    },
  };
}

function commerceFingerprint(catalogue: CatalogueDisplayModel): string {
  return canonicalValueFingerprint({
    collections: catalogue.collections.map(({ id, productIds }) => ({ id, productIds })),
    products: catalogue.products.map((product) => {
      const { images, ...withoutImages } = product;
      void images;
      return withoutImages;
    }),
  });
}

function mediaFingerprint(catalogue: CatalogueDisplayModel): string {
  return canonicalValueFingerprint(catalogue.products.map(({ id, images }) => ({ id, images })));
}

function correctedCustomerCopy(
  shapeId: SyntheticShapeId,
  value: unknown,
  locale: CustomerLocale | null = null,
): unknown {
  const replacement =
    shapeId === "neutral-true-high-consideration"
      ? NEUTRAL_MERCHANT_COPY.description
      : localized(
          "A concise selection of rings and wristwatches.",
          "Tiivis valikoima sormuksia ja rannekelloja.",
        );
  if (typeof value === "string") {
    if (
      value === "Karvosen korujen demo-katalogi." ||
      value === "Karvonen jewellery demo catalogue." ||
      value === "Karvonen jewellery demo catalog." ||
      value === "Tiivis valikoima sormuksia ja rannekelloja." ||
      value === "A concise selection of rings and wristwatches."
    ) {
      return locale === "fi" || (locale === null && /Karvosen/.test(value))
        ? replacement.fi
        : replacement.en;
    }
    if (shapeId === "neutral-true-high-consideration") {
      if (
        value === "Korujen ostajat." ||
        value === "Jewellery buyers." ||
        value === "Jewelry buyers."
      ) {
        return locale === "en"
          ? NEUTRAL_MERCHANT_COPY.audience.en
          : NEUTRAL_MERCHANT_COPY.audience.fi;
      }
      if (value === "jewellery" || value === "jewelry") {
        return NEUTRAL_MERCHANT_COPY.categoryLabel;
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => correctedCustomerCopy(shapeId, entry, locale));
  }
  const record = recordValue(value);
  if (record === null) return value;
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      correctedCustomerCopy(shapeId, entry, key === "en" || key === "fi" ? key : locale),
    ]),
  );
}

function correctedContentFactAuthority(
  shapeId: SyntheticShapeId,
  source: P10b18aShapeAuthority,
): ContentSupportFactAuthority {
  if (shapeId !== "neutral-true-high-consideration") return source.contentFactAuthority;
  return Object.freeze({
    resolve(input: Parameters<ContentSupportFactAuthority["resolve"]>[0]) {
      const sourceDocument = source.contentFactAuthority.resolve(input);
      const correctedPayload = contentSupportFactPayloadSchema.parse(
        correctedCustomerCopy(shapeId, sourceDocument.payload),
      );
      const payload =
        correctedPayload.familyId === "about"
          ? contentSupportFactPayloadSchema.parse({
              ...correctedPayload,
              introduction: NEUTRAL_MERCHANT_COPY.description,
              blocks: correctedPayload.blocks.map((block) =>
                block.kind === "paragraph" && block.id === "business-description"
                  ? { ...block, body: NEUTRAL_MERCHANT_COPY.description }
                  : block,
              ),
              story:
                correctedPayload.story === undefined
                  ? undefined
                  : {
                      ...correctedPayload.story,
                      body: NEUTRAL_MERCHANT_COPY.description,
                    },
            })
          : correctedPayload;
      return createContentSupportFactDocument({
        evidence: sourceDocument.evidence,
        payload,
      });
    },
  });
}

function deriveCorrectedAuthority(source: P10b18aShapeAuthority): P10b18cShapeAuthority {
  const shapeId = source.id as SyntheticShapeId;
  const catalogue = correctedCatalogue(source);
  const metadata = truthMetadata(shapeId, source.catalogue, catalogue);
  const siteMapDecision = storefrontSiteMapDecisionSchema.parse(
    correctedCustomerCopy(
      shapeId,
      rewriteSiteMapCustomerTruth(
        structuredClone(source.siteMapDecision),
        replacementEntities(source.catalogue, catalogue),
      ),
    ),
  );
  const sourcePlanningInput = structuredClone(source.compatibilityInput.planningInput);
  const correctedProject = projectSchema.parse(
    shapeId === "neutral-true-high-consideration"
      ? {
          ...structuredClone(source.aggregate.project),
          industry: NEUTRAL_MERCHANT_COPY.projectIndustry,
          businessProfile: {
            ...structuredClone(source.aggregate.project.businessProfile),
            description: NEUTRAL_MERCHANT_COPY.description.fi,
            audience: NEUTRAL_MERCHANT_COPY.audience.fi,
          },
        }
      : structuredClone(source.aggregate.project),
  );
  const correctedBrief =
    shapeId === "neutral-true-high-consideration"
      ? {
          ...structuredClone(sourcePlanningInput.brief),
          businessIdentity: {
            ...structuredClone(sourcePlanningInput.brief.businessIdentity),
            shortDescription: NEUTRAL_MERCHANT_COPY.description.fi,
            industry: NEUTRAL_MERCHANT_COPY.briefIndustry,
            targetCustomer: NEUTRAL_MERCHANT_COPY.audience.fi,
          },
        }
      : structuredClone(sourcePlanningInput.brief);
  const { dynamicCommercePresentation: previousDynamicAuthority, ...draftWithoutAuthority } =
    sourcePlanningInput.draft;
  void previousDynamicAuthority;
  const canonicalDraftWithoutAuthority = storefrontSnapshotSchema.parse(
    correctedCustomerCopy(shapeId, draftWithoutAuthority),
  );
  const dynamicCommercePresentation = materializeCurrentDynamicCommercePresentationAuthority(
    canonicalDraftWithoutAuthority,
    catalogue,
  );
  const draft = storefrontSnapshotSchema.parse({
    ...canonicalDraftWithoutAuthority,
    dynamicCommercePresentation,
  });
  const planningInput = {
    ...sourcePlanningInput,
    brief: correctedBrief,
    catalogue,
    draft,
  };
  const contentFactAuthority = correctedContentFactAuthority(shapeId, source);
  const contentFactDocuments =
    shapeId === "neutral-true-high-consideration"
      ? siteMapDecision.pages.flatMap((page) =>
          page.familyId === "about"
            ? page.evidenceReferences.map((reference) =>
                contentFactAuthority.resolve({ familyId: "about", reference }),
              )
            : [],
        )
      : [];

  assertP10b18cFixtureCustomerTruth({
    shapeId,
    catalogue,
    siteMapDecision,
    metadata,
    project: correctedProject,
    draft,
    approvedBriefBusinessIdentity: correctedBrief.businessIdentity,
    contentFactDocuments,
    internalDiagnostics: metadata.internalDiagnostics,
  });

  const compatibilityInput = {
    ...structuredClone(source.compatibilityInput),
    planningInput,
    siteMapDecision,
  };
  const currentRequestInput = {
    ...structuredClone(source.currentRequestInput),
    project: correctedProject,
    draft,
    catalogue,
    approvedBrief: correctedBrief,
  };
  const exact = createPromptedStorefrontDesignRequestV2(currentRequestInput);
  const currentAuthorityFingerprint = semanticStorefrontCurrentAuthorityFingerprint(
    exact.request.currentAuthority,
  );
  const semanticCapabilityIndex = deriveSemanticCapabilityIndex({
    authority: compatibilityInput,
    currentAuthorityFingerprint,
  });
  const request = createSemanticStorefrontDesignRequestV1(exact, {
    semanticAuthorityFingerprint: semanticCapabilityIndex.semanticAuthorityFingerprint,
    semanticInfluenceAuthority: semanticCapabilityIndex.semanticInfluenceAuthority,
  });
  const preparedAuthority = prepareSemanticStorefrontDesignCompilationAuthority({
    originalRequest: request,
    currentRequestInput,
    compatibilityInput,
    semanticCapabilityIndex,
  });
  const correctedCommerceFingerprint = commerceFingerprint(catalogue);
  const correctedMediaFingerprint = mediaFingerprint(catalogue);
  const aggregate = {
    ...structuredClone(source.aggregate),
    project: correctedProject,
    catalogue,
    snapshots: source.aggregate.snapshots.map((snapshot) =>
      storefrontSnapshotSchema.parse(correctedCustomerCopy(shapeId, snapshot)),
    ),
  };

  return {
    ...source,
    aggregate,
    catalogue,
    siteMapDecision,
    currentRequestInput,
    compatibilityInput,
    semanticCapabilityIndex,
    request,
    preparedAuthority,
    contentFactAuthority,
    catalogueFingerprint: canonicalValueFingerprint(catalogue),
    commerceFingerprint: correctedCommerceFingerprint,
    mediaFingerprint: correctedMediaFingerprint,
    fixtureTruthMetadata: metadata,
    fixtureTruthRevision: {
      revisionId:
        shapeId === "neutral-true-high-consideration"
          ? "p10b-18c-neutral-synthetic-customer-truth-r2"
          : "p10b-18c-neutral-synthetic-customer-truth-r1",
      sourceCatalogueFingerprint: source.catalogueFingerprint,
      correctedCatalogueFingerprint: canonicalValueFingerprint(catalogue),
      sourceCommerceFingerprint: source.commerceFingerprint,
      correctedCommerceFingerprint,
      sourceMediaFingerprint: source.mediaFingerprint,
      correctedMediaFingerprint,
    },
  };
}

export function createP10b18cShapeAuthorities(
  includedShapeIds?: readonly string[],
): readonly P10b18cShapeAuthority[] {
  return createP10b18aShapeAuthorities(includedShapeIds).map((source) => {
    if (source.id === "mixed-jewellery-watch" || source.id === "neutral-true-high-consideration") {
      return deriveCorrectedAuthority(source);
    }
    return {
      ...source,
      fixtureTruthMetadata: null,
      fixtureTruthRevision: {
        revisionId: "unchanged",
        sourceCatalogueFingerprint: source.catalogueFingerprint,
        correctedCatalogueFingerprint: source.catalogueFingerprint,
        sourceCommerceFingerprint: source.commerceFingerprint,
        correctedCommerceFingerprint: source.commerceFingerprint,
        sourceMediaFingerprint: source.mediaFingerprint,
        correctedMediaFingerprint: source.mediaFingerprint,
      },
    };
  });
}
