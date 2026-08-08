import { z } from "zod";
import { validateComponentDefinitionV2 } from "@/domain/component-platform";
import { localizedTextSchema } from "@/domain/shared";
import { withCurrentComponentCommercialAnatomy } from "./commercial-anatomy";
import { canonicalProductCardAnatomyIdSchema } from "@/domain/product-card";

const trustItemSchema = z
  .object({
    id: z.string().trim().min(3).max(80),
    title: localizedTextSchema,
    body: localizedTextSchema.optional(),
  })
  .strict();

export const dynamicProductDetailVariantSchema = z.enum([
  "balanced",
  "editorial",
  "compact",
  "galleryDominant",
  "editorialSplit",
]);

export const dynamicProductDetailContentSchema = z
  .object({
    supportingHeading: localizedTextSchema.optional(),
    supportingBody: localizedTextSchema.optional(),
    trustItems: z.array(trustItemSchema).max(6).default([]),
    relatedHeading: localizedTextSchema,
    primaryActionLabel: localizedTextSchema,
  })
  .strict();

export const dynamicProductDetailPropsSchema = z
  .object({
    galleryLayout: z.enum(["thumbnails", "grid"]),
    optionDensity: z.enum(["compact", "comfortable"]),
    attributeLayout: z.enum(["groups", "table"]),
    showDescription: z.boolean(),
    showSku: z.boolean(),
    stickyMobileAction: z.boolean(),
    mediaTreatment: z.enum(["contained", "crop", "editorial"]).default("contained"),
    relatedCardVariant: canonicalProductCardAnatomyIdSchema.default("standard"),
  })
  .strict();

export const dynamicProductDetailStyleOverridesSchema = z
  .object({
    surfaceTreatment: z.enum(["plain", "soft"]).default("plain"),
  })
  .strict();

export const dynamicProductDetailDefaultContent = dynamicProductDetailContentSchema.parse({
  trustItems: [],
  relatedHeading: { en: "You may also like", fi: "Saatat myös pitää" },
  primaryActionLabel: { en: "Add to cart", fi: "Lisää ostoskoriin" },
});

export const dynamicProductDetailDefaultProps = dynamicProductDetailPropsSchema.parse({
  galleryLayout: "thumbnails",
  optionDensity: "comfortable",
  attributeLayout: "groups",
  showDescription: true,
  showSku: true,
  stickyMobileAction: true,
  mediaTreatment: "contained",
  relatedCardVariant: "standard",
});

export const dynamicProductDetailDefaultStyleOverrides =
  dynamicProductDetailStyleOverridesSchema.parse({ surfaceTreatment: "plain" });

const definitionInput = {
  type: "dynamicProductDetail",
  version: { major: 2, minor: 0, patch: 0 },
  title: { en: "Dynamic product detail", fi: "Dynaaminen tuotesivu" },
  merchantDescription: {
    en: "Shows any canonical product configuration without product-type-specific page code.",
    fi: "Näyttää minkä tahansa kanonisen tuotekokoonpanon ilman tuotetyyppikohtaista sivukoodia.",
  },
  family: "commerce",
  supportedPageTypes: ["product"],
  variants: [
    {
      id: "balanced",
      title: { en: "Balanced", fi: "Tasapainoinen" },
      compatibleDensity: ["standard", "spacious"],
    },
    {
      id: "editorial",
      title: { en: "Editorial", fi: "Toimituksellinen" },
      compatibleDensity: ["standard", "spacious"],
    },
    {
      id: "compact",
      title: { en: "Compact", fi: "Kompakti" },
      compatibleDensity: ["compact", "standard"],
    },
    {
      id: "galleryDominant",
      title: { en: "Gallery dominant", fi: "Galleria etusijalla" },
      compatibleDensity: ["standard", "spacious"],
    },
    {
      id: "editorialSplit",
      title: { en: "Editorial split", fi: "Toimituksellinen jako" },
      compatibleDensity: ["standard", "spacious"],
    },
  ],
  defaultVariant: "balanced",
  industryTags: [],
  contentSchema: z.toJSONSchema(dynamicProductDetailContentSchema),
  propsSchema: z.toJSONSchema(dynamicProductDetailPropsSchema),
  styleOverridesSchema: z.toJSONSchema(dynamicProductDetailStyleOverridesSchema),
  contentSlots: [
    {
      id: "supportingHeading",
      title: { en: "Supporting content heading", fi: "Tukisisällön otsikko" },
      localized: true,
      required: false,
    },
    {
      id: "supportingBody",
      title: { en: "Supporting content", fi: "Tukisisältö" },
      localized: true,
      required: false,
    },
    {
      id: "trustItems",
      title: { en: "Trust and service items", fi: "Luottamus- ja palvelusisällöt" },
      localized: true,
      required: false,
      maxItems: 6,
    },
    {
      id: "relatedHeading",
      title: { en: "Related products heading", fi: "Liittyvien tuotteiden otsikko" },
      localized: true,
      required: true,
    },
  ],
  commerceBindingSlots: [
    {
      id: "primaryProduct",
      title: { en: "Product", fi: "Tuote" },
      acceptedSourceTypes: ["product"],
      required: true,
      revisionRequired: true,
      emptyState: "message",
    },
    {
      id: "relatedProducts",
      title: { en: "Related products", fi: "Liittyvät tuotteet" },
      acceptedSourceTypes: ["productList"],
      required: false,
      revisionRequired: true,
      emptyState: "hide",
    },
  ],
  assetSlots: [
    {
      id: "productMedia",
      title: { en: "Canonical product media", fi: "Kanoninen tuotemedia" },
      acceptedRoles: ["productMainImage", "productAlternativeImage", "editorialImage"],
      required: false,
      minItems: 0,
      maxItems: 32,
    },
  ],
  editablePresentationFields: [
    {
      path: "content.supportingHeading",
      label: { en: "Supporting heading", fi: "Tukisisällön otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "content.supportingBody",
      label: { en: "Supporting content", fi: "Tukisisältö" },
      source: "content",
      control: "textarea",
      localized: true,
    },
    {
      path: "content.relatedHeading",
      label: { en: "Related products heading", fi: "Liittyvien tuotteiden otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "content.primaryActionLabel",
      label: { en: "Primary action label", fi: "Päätoiminnon teksti" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "props.galleryLayout",
      label: { en: "Gallery layout", fi: "Gallerian asettelu" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.optionDensity",
      label: { en: "Option spacing", fi: "Valintojen välit" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.attributeLayout",
      label: { en: "Specification layout", fi: "Teknisten tietojen asettelu" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.showDescription",
      label: { en: "Show description", fi: "Näytä kuvaus" },
      source: "props",
      control: "toggle",
      localized: false,
    },
    {
      path: "props.showSku",
      label: { en: "Show SKU", fi: "Näytä tuotetunnus" },
      source: "props",
      control: "toggle",
      localized: false,
    },
    {
      path: "props.stickyMobileAction",
      label: { en: "Sticky mobile action", fi: "Kiinteä mobiilitoiminto" },
      source: "props",
      control: "toggle",
      localized: false,
    },
    {
      path: "props.mediaTreatment",
      label: { en: "Product media treatment", fi: "Tuotemedian käsittely" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "styleOverrides.surfaceTreatment",
      label: { en: "Surface treatment", fi: "Pinnan tyyli" },
      source: "styleOverrides",
      control: "select",
      localized: false,
    },
  ],
  protectedFields: {
    readOnlyPaths: [
      "bindings.product.productId",
      "bindings.product.productTypeId",
      "bindings.product.sku",
      "bindings.product.price",
      "bindings.product.compareAtPrice",
      "bindings.product.availability",
      "bindings.product.variantId",
      "bindings.product.optionGroups",
      "bindings.product.optionValues",
      "commerce.product.productId",
      "commerce.product.productTypeId",
      "commerce.product.sku",
      "commerce.product.price",
      "commerce.product.compareAtPrice",
      "commerce.product.availability",
      "commerce.product.optionGroups",
      "commerce.product.selectedValues",
      "assets.*.provenance",
    ],
  },
  responsiveRules: [
    {
      breakpoints: ["mobile", "tablet", "desktop", "wide"],
      allowHorizontalOverflow: false,
      maxColumns: 2,
      notes: {
        en: "The gallery and product information recompose without product-type-specific layouts at 375, 768, 1024 and 1440 pixels.",
        fi: "Galleria ja tuotetiedot mukautuvat ilman tuotetyyppikohtaisia asetteluja 375, 768, 1024 ja 1440 pikselissä.",
      },
    },
  ],
  accessibilityRequirements: {
    keyboard: "Every option and gallery control is reachable and operable with a keyboard.",
    semantics:
      "The product uses one product article, one h1, grouped options and labelled specification regions.",
    labels:
      "Option values, disabled reasons, text limits, gallery media and primary-action state have accessible labels.",
    focus: "All interactive controls retain visible focus and project-baseline touch targets.",
    contrast: "The renderer consumes validated storefront design tokens for text and controls.",
    liveRegions:
      "Supplied primary-action and availability presentation messages are announced politely.",
  },
  designCompatibility: {
    allowedNarrativeRoles: ["product-focus", "product-proof", "conversion", "continuation"],
    allowedVisualWeights: ["medium", "heavy", "dominant"],
    allowedTransitionIntents: ["continuation", "contrast", "proof", "clarification", "conversion"],
    boundedParameterIds: [
      "layoutModel",
      "mediaPlacement",
      "productInformationPlacement",
      "galleryMode",
      "sectionWidth",
      "responsiveCollapse",
      "density",
      "surfaceTreatment",
      "visualWeight",
      "typographyRole",
      "imageTreatment",
      "borderTreatment",
      "shape",
      "spacingScale",
      "emphasis",
      "backgroundRole",
      "tone",
    ],
    blueprintProfilePolicy: "anyRegistered",
    compatibleBlueprintProfileIds: [],
    commerceRequirements: ["protected-product-context"],
  },
  migration: {
    policy: "stable",
    previousVersions: [],
    migrations: [],
  },
  renderer: {
    adapterId: "veskifyCommerceRenderer",
    exportName: "DynamicProductDetail",
    supportedTargets: ["editor", "preview", "published"],
  },
};

export const dynamicProductDetailDefinition = validateComponentDefinitionV2(
  withCurrentComponentCommercialAnatomy(definitionInput),
);

export type DynamicProductDetailContent = z.infer<typeof dynamicProductDetailContentSchema>;
export type DynamicProductDetailProps = z.infer<typeof dynamicProductDetailPropsSchema>;
export type DynamicProductDetailStyleOverrides = z.infer<
  typeof dynamicProductDetailStyleOverridesSchema
>;
export type DynamicProductDetailVariant = z.infer<typeof dynamicProductDetailVariantSchema>;
