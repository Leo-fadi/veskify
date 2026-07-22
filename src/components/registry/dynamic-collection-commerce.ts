import { z } from "zod";
import { validateComponentDefinitionV2 } from "@/domain/component-platform";
import { localizedTextSchema } from "@/domain/shared";

export const dynamicCollectionCommerceVariantSchema = z.enum(["standard", "editorial", "compact"]);

export const dynamicCollectionCommerceContentSchema = z
  .object({
    filtersHeading: localizedTextSchema,
    productsHeading: localizedTextSchema,
    sortLabel: localizedTextSchema,
    clearLabel: localizedTextSchema,
    clearAllLabel: localizedTextSchema,
    filterTriggerLabel: localizedTextSchema,
    loadingLabel: localizedTextSchema,
    mediaPlaceholderLabel: localizedTextSchema,
  })
  .strict();

export const dynamicCollectionCommercePropsSchema = z
  .object({
    gridDensity: z.enum(["compact", "standard", "spacious"]),
    cardVariant: z.enum(["standard", "editorial", "compact", "imageFirst", "horizontal"]),
    filterLayout: z.enum(["sidebar", "horizontal"]),
    showDescription: z.boolean(),
    showProductCount: z.boolean(),
    showBadges: z.boolean(),
    conciseAttributeLimit: z.number().int().min(0).max(4),
    showChildCollections: z.boolean(),
  })
  .strict();

export const dynamicCollectionCommerceStyleOverridesSchema = z
  .object({
    surfaceTreatment: z.enum(["plain", "soft"]),
  })
  .strict();

export const dynamicCollectionCommerceDefaultContent = dynamicCollectionCommerceContentSchema.parse(
  {
    filtersHeading: { en: "Filters", fi: "Suodattimet" },
    productsHeading: { en: "Products", fi: "Tuotteet" },
    sortLabel: { en: "Sort products", fi: "Lajittele tuotteet" },
    clearLabel: { en: "Clear", fi: "Tyhjennä" },
    clearAllLabel: { en: "Clear all filters", fi: "Tyhjennä kaikki suodattimet" },
    filterTriggerLabel: { en: "Show filters", fi: "Näytä suodattimet" },
    loadingLabel: { en: "Loading products", fi: "Ladataan tuotteita" },
    mediaPlaceholderLabel: { en: "Product image unavailable", fi: "Tuotekuva ei ole saatavilla" },
  },
);

export const dynamicCollectionCommerceDefaultProps = dynamicCollectionCommercePropsSchema.parse({
  gridDensity: "standard",
  cardVariant: "standard",
  filterLayout: "sidebar",
  showDescription: true,
  showProductCount: true,
  showBadges: true,
  conciseAttributeLimit: 2,
  showChildCollections: true,
});

export const dynamicCollectionCommerceDefaultStyleOverrides =
  dynamicCollectionCommerceStyleOverridesSchema.parse({ surfaceTreatment: "plain" });

const definitionInput = {
  type: "dynamicCollectionCommerce",
  version: { major: 2, minor: 0, patch: 0 },
  title: { en: "Dynamic collection commerce", fi: "Dynaaminen mallistonäkymä" },
  merchantDescription: {
    en: "Shows a canonical collection, filters and product cards without copying commerce facts.",
    fi: "Näyttää kanonisen malliston, suodattimet ja tuotekortit kopioimatta kauppatietoja.",
  },
  family: "commerce",
  supportedPageTypes: ["collection"],
  variants: [
    { id: "standard", title: { en: "Standard", fi: "Tavallinen" } },
    { id: "editorial", title: { en: "Editorial", fi: "Toimituksellinen" } },
    { id: "compact", title: { en: "Compact", fi: "Kompakti" } },
  ],
  defaultVariant: "standard",
  industryTags: [],
  contentSchema: z.toJSONSchema(dynamicCollectionCommerceContentSchema),
  propsSchema: z.toJSONSchema(dynamicCollectionCommercePropsSchema),
  styleOverridesSchema: z.toJSONSchema(dynamicCollectionCommerceStyleOverridesSchema),
  contentSlots: [
    {
      id: "filtersHeading",
      title: { en: "Filters heading", fi: "Suodatinten otsikko" },
      localized: true,
      required: true,
    },
    {
      id: "productsHeading",
      title: { en: "Products heading", fi: "Tuotteiden otsikko" },
      localized: true,
      required: true,
    },
  ],
  commerceBindingSlots: [
    {
      id: "primaryCollection",
      title: { en: "Collection", fi: "Mallisto" },
      acceptedSourceTypes: ["collection"],
      required: true,
      revisionRequired: true,
      emptyState: "message",
    },
    {
      id: "collectionProducts",
      title: { en: "Collection products", fi: "Malliston tuotteet" },
      acceptedSourceTypes: ["productList"],
      required: true,
      revisionRequired: true,
      emptyState: "message",
    },
    {
      id: "childCollections",
      title: { en: "Child collections", fi: "Alamallistot" },
      acceptedSourceTypes: ["collectionList"],
      required: false,
      revisionRequired: true,
      emptyState: "hide",
    },
  ],
  assetSlots: [
    {
      id: "collectionCommerceMedia",
      title: { en: "Collection and product media", fi: "Mallisto- ja tuotemedia" },
      acceptedRoles: ["collectionImage", "productMainImage"],
      required: false,
      minItems: 0,
      maxItems: 256,
    },
  ],
  editablePresentationFields: [
    {
      path: "content.filtersHeading",
      label: { en: "Filters heading", fi: "Suodatinten otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "content.productsHeading",
      label: { en: "Products heading", fi: "Tuotteiden otsikko" },
      source: "content",
      control: "text",
      localized: true,
    },
    {
      path: "props.gridDensity",
      label: { en: "Grid density", fi: "Ruudukon tiheys" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.cardVariant",
      label: { en: "Product card style", fi: "Tuotekortin tyyli" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.filterLayout",
      label: { en: "Filter layout", fi: "Suodatinten asettelu" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.showDescription",
      label: { en: "Show collection description", fi: "Näytä malliston kuvaus" },
      source: "props",
      control: "toggle",
      localized: false,
    },
    {
      path: "props.showProductCount",
      label: { en: "Show product count", fi: "Näytä tuotemäärä" },
      source: "props",
      control: "toggle",
      localized: false,
    },
    {
      path: "props.showBadges",
      label: { en: "Show canonical badges", fi: "Näytä kanoniset tunnisteet" },
      source: "props",
      control: "toggle",
      localized: false,
    },
    {
      path: "props.conciseAttributeLimit",
      label: { en: "Concise attribute count", fi: "Lyhyiden ominaisuuksien määrä" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.showChildCollections",
      label: { en: "Show child collections", fi: "Näytä alamallistot" },
      source: "props",
      control: "toggle",
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
      "bindings.collection.collectionId",
      "bindings.collection.productIds",
      "bindings.collection.filters",
      "bindings.product.productId",
      "bindings.product.productTypeId",
      "bindings.product.sku",
      "bindings.product.price",
      "bindings.product.compareAtPrice",
      "bindings.product.availability",
      "commerce.collection.collectionId",
      "commerce.collection.productIds",
      "commerce.collection.filters",
      "commerce.collection.sorting",
      "commerce.product.productId",
      "commerce.product.productTypeId",
      "commerce.product.sku",
      "commerce.product.price",
      "commerce.product.compareAtPrice",
      "commerce.product.availability",
      "assets.*.provenance",
    ],
  },
  responsiveRules: [
    {
      breakpoints: ["mobile", "tablet", "desktop", "wide"],
      allowHorizontalOverflow: false,
      maxColumns: 4,
      notes: {
        en: "Product cards reflow and filters collapse at 375, 768, 1024 and 1440 pixels without product-type-specific layouts.",
        fi: "Tuotekortit mukautuvat ja suodattimet sulkeutuvat 375, 768, 1024 ja 1440 pikselissä ilman tuotetyyppikohtaisia asetteluja.",
      },
    },
  ],
  accessibilityRequirements: {
    keyboard:
      "Product navigation, filter, sort and child-collection controls are keyboard operable.",
    semantics:
      "The collection has one h1, labelled controls, product-list semantics and coherent price states.",
    labels: "Every product, filter, range, sort and mobile filter control has an accessible name.",
    focus: "Interactive controls retain visible focus and project-baseline touch targets.",
    contrast: "The renderer consumes validated storefront design tokens for text and controls.",
    liveRegions: "Loading and result-count presentation state is announced politely.",
  },
  migration: { policy: "stable", previousVersions: [], migrations: [] },
  renderer: {
    adapterId: "veskifyCommerceRenderer",
    exportName: "DynamicCollectionCommerce",
    supportedTargets: ["editor", "preview", "published"],
  },
};

export const dynamicCollectionCommerceDefinition = validateComponentDefinitionV2(definitionInput);

export type DynamicCollectionCommerceContent = z.infer<
  typeof dynamicCollectionCommerceContentSchema
>;
export type DynamicCollectionCommerceProps = z.infer<typeof dynamicCollectionCommercePropsSchema>;
export type DynamicCollectionCommerceStyleOverrides = z.infer<
  typeof dynamicCollectionCommerceStyleOverridesSchema
>;
export type DynamicCollectionCommerceVariant = z.infer<
  typeof dynamicCollectionCommerceVariantSchema
>;
