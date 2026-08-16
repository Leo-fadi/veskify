import { z } from "zod";
import { canonicalProductCardAnatomyIdSchema } from "@/domain/product-card";
import {
  validateComponentDefinitionV2,
  type ComponentCommercialAnatomy,
  type ComponentDefinitionV2,
} from "@/domain/component-platform";
import { localizedTextSchema } from "@/domain/shared";
import { createRegisteredComponentCommercialAnatomy } from "./commercial-anatomy";

export const dynamicCollectionCommerceVariantSchema = z.enum([
  "standard",
  "editorial",
  "compact",
  "gallery",
  "editorialDiscovery",
  "catalogueComparison",
  "campaignLedDiscovery",
  "denseSearch",
]);

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
    cardVariant: canonicalProductCardAnatomyIdSchema,
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
    en: "Shows a canonical collection or transient search results with product cards without copying commerce facts.",
    fi: "Näyttää kanonisen malliston tai tilapäiset hakutulokset tuotekortteina kopioimatta kauppatietoja.",
  },
  family: "commerce",
  supportedPageTypes: ["collection"],
  variants: [
    { id: "standard", title: { en: "Standard", fi: "Tavallinen" } },
    { id: "editorial", title: { en: "Editorial", fi: "Toimituksellinen" } },
    { id: "compact", title: { en: "Compact", fi: "Kompakti" } },
    { id: "gallery", title: { en: "Gallery", fi: "Galleria" } },
    {
      id: "editorialDiscovery",
      title: { en: "Editorial discovery", fi: "Toimituksellinen löydettävyys" },
    },
    { id: "catalogueComparison", title: { en: "Catalogue comparison", fi: "Luettelon vertailu" } },
    {
      id: "campaignLedDiscovery",
      title: { en: "Campaign-led discovery", fi: "Kampanjavetoinen löydettävyys" },
    },
    { id: "denseSearch", title: { en: "Dense search", fi: "Tiivis haku" } },
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
      // Collection runtime requires this slot. Search runtime intentionally omits
      // it and binds only the transient result product list; the renderer's
      // discriminated conformance guard enforces the exact one-of contract.
      required: false,
      revisionRequired: true,
      emptyState: "message",
    },
    {
      id: "collectionProducts",
      title: { en: "Presented products", fi: "Näytettävät tuotteet" },
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
      acceptedRoles: [
        "collectionImage",
        "productMainImage",
        "productAlternativeImage",
        "editorialImage",
      ],
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
  designCompatibility: {
    allowedNarrativeRoles: [
      "orientation",
      "primary-discovery",
      "secondary-discovery",
      "campaign",
      "continuation",
    ],
    allowedVisualWeights: ["medium", "heavy", "dominant"],
    allowedTransitionIntents: ["continuation", "contrast", "clarification", "conversion", "reset"],
    boundedParameterIds: [
      "layoutModel",
      "columnCount",
      "filterPlacement",
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
    commerceRequirements: ["canonical-binding"],
  },
  migration: { policy: "stable", previousVersions: [], migrations: [] },
  renderer: {
    adapterId: "veskifyCommerceRenderer",
    exportName: "DynamicCollectionCommerce",
    supportedTargets: ["editor", "preview", "published"],
  },
};

const collectionRegions = [
  "frame",
  "media",
  "content",
  "heading",
  "merchandising",
  "actions",
] as const;

const commercialCollectionAnatomy = createRegisteredComponentCommercialAnatomy(
  definitionInput as unknown as ComponentDefinitionV2,
  {
    version: { major: 1, minor: 2, patch: 0 },
    regions: collectionRegions.map((id) => ({
      id,
      required: id === "frame" || id === "heading" || id === "merchandising",
    })),
    responsiveTransformations: [
      {
        id: "editorialCollectionStack",
        mode: "stack",
        breakpoints: ["mobile", "tablet"],
        fromPresentationMode: "editorialCollectionSpread",
        toPresentationMode: "editorialCollectionStack",
        affectedRegions: ["media", "content", "merchandising"],
      },
      {
        id: "collectionFilterDisclosure",
        mode: "disclosure",
        breakpoints: ["mobile", "tablet"],
        fromPresentationMode: "editorialCollectionSpread",
        toPresentationMode: "editorialFilterDisclosure",
        affectedRegions: ["actions", "merchandising"],
      },
      {
        id: "comparisonFilterDisclosure",
        mode: "disclosure",
        breakpoints: ["mobile", "tablet"],
        fromPresentationMode: "comparisonRail",
        toPresentationMode: "comparisonDisclosure",
        affectedRegions: ["actions", "merchandising"],
      },
      {
        id: "comparisonGridReflow",
        mode: "reflow",
        breakpoints: ["mobile", "tablet", "desktop", "wide"],
        fromPresentationMode: "comparisonRail",
        toPresentationMode: "comparisonGrid",
        affectedRegions: ["merchandising"],
      },
      {
        id: "campaignLeadStack",
        mode: "stack",
        breakpoints: ["mobile", "tablet"],
        fromPresentationMode: "campaignLeadIn",
        toPresentationMode: "campaignLeadStack",
        affectedRegions: ["media", "content", "merchandising"],
      },
      {
        id: "campaignFilterDisclosure",
        mode: "disclosure",
        breakpoints: ["mobile", "tablet"],
        fromPresentationMode: "campaignLeadIn",
        toPresentationMode: "campaignFilterDisclosure",
        affectedRegions: ["actions", "merchandising"],
      },
      {
        id: "denseFilterDisclosure",
        mode: "disclosure",
        breakpoints: ["mobile", "tablet"],
        fromPresentationMode: "denseSearchToolbar",
        toPresentationMode: "denseSearchDisclosure",
        affectedRegions: ["actions", "merchandising"],
      },
      {
        id: "denseGridReflow",
        mode: "reflow",
        breakpoints: ["mobile", "tablet", "desktop", "wide"],
        fromPresentationMode: "denseSearchToolbar",
        toPresentationMode: "denseSearchGrid",
        affectedRegions: ["merchandising"],
      },
    ],
    variants: definitionInput.variants.map((variant) => {
      const legacy = ["standard", "editorial", "compact", "gallery"].includes(variant.id);
      const structures = {
        editorialDiscovery: {
          regionOrder: ["frame", "media", "heading", "content", "merchandising", "actions"],
          omittedRegions: [],
          contentRelationship: "contentLed",
          ctaRelationship: "inline",
          merchandisingEmphasis: "supporting",
          navigationModel: "carousel",
          responsiveTransformationIds: ["editorialCollectionStack", "collectionFilterDisclosure"],
          presentationMode: "editorialCollectionSpread",
        },
        catalogueComparison: {
          regionOrder: ["frame", "heading", "actions", "merchandising", "content", "media"],
          omittedRegions: [],
          contentRelationship: "supporting",
          ctaRelationship: "inline",
          merchandisingEmphasis: "dominant",
          navigationModel: "disclosure",
          responsiveTransformationIds: ["comparisonFilterDisclosure", "comparisonGridReflow"],
          presentationMode: "comparisonRail",
        },
        campaignLedDiscovery: {
          regionOrder: ["frame", "media", "heading", "content", "actions", "merchandising"],
          omittedRegions: [],
          contentRelationship: "mediaLed",
          ctaRelationship: "separated",
          merchandisingEmphasis: "dominant",
          navigationModel: "carousel",
          responsiveTransformationIds: ["campaignLeadStack", "campaignFilterDisclosure"],
          presentationMode: "campaignLeadIn",
        },
        denseSearch: {
          regionOrder: ["frame", "heading", "actions", "merchandising", "media", "content"],
          omittedRegions: [],
          contentRelationship: "supporting",
          ctaRelationship: "inline",
          merchandisingEmphasis: "dominant",
          navigationModel: "disclosure",
          responsiveTransformationIds: ["denseFilterDisclosure", "denseGridReflow"],
          presentationMode: "denseSearchToolbar",
        },
      } as const;
      if (legacy) {
        return {
          variantId: variant.id,
          classification: "notYetP10BCommercialReady" as const,
          materialDifferences: [],
          finishingTokenIds: [],
          structure: {
            regionOrder: [...collectionRegions],
            omittedRegions: [],
            assetPlacements: [{ slotId: "collectionCommerceMedia", region: "media" as const }],
            contentRelationship: "balanced" as const,
            ctaRelationship: "inline" as const,
            merchandisingEmphasis: "balanced" as const,
            navigationModel: "toolbar" as const,
            responsiveTransformationIds: ["denseGridReflow"],
            presentationMode: "legacyCollection",
          },
        };
      }
      const structure = structures[variant.id as keyof typeof structures];
      return {
        variantId: variant.id,
        classification: "meaningfulStructuralVariant" as const,
        materialDifferences: [
          "hierarchy",
          "regionArrangement",
          "contentRelationship",
          "merchandisingEmphasis",
          "navigationModel",
          "responsiveTransformation",
          "presentationMode",
        ],
        finishingTokenIds: [],
        structure: {
          ...structure,
          assetPlacements: [{ slotId: "collectionCommerceMedia", region: "media" as const }],
        },
      };
    }) as unknown as ComponentCommercialAnatomy["variants"],
  },
);

export const dynamicCollectionCommerceDefinition = validateComponentDefinitionV2({
  ...definitionInput,
  commercialAnatomy: commercialCollectionAnatomy,
});

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
