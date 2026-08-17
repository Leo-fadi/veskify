import { materializeCurrentDynamicCommercePresentationAuthority } from "@/application/dynamic-commerce-routes";
import {
  compileSemanticStorefrontDesignIntentV1,
  deriveSemanticCapabilityIndex,
  prepareSemanticStorefrontDesignCompilationAuthority,
} from "@/application/prompted-storefront-design-compiler";
import {
  createPromptedStorefrontDesignRequestV2,
  createSemanticStorefrontDesignRequestV1,
  semanticStorefrontCurrentAuthorityFingerprint,
} from "@/application/prompted-storefront-design-intent";
import { storefrontSiteMapDecisionSchema } from "@/application/storefront-site-map";
import { createRawKarvonenStorefrontFixture } from "@/data/demo/raw-karvonen-storefront-fixture";
import {
  P10B16P04_COMMERCIAL_DRAFT_ID,
  createP10B16P04RawAurumCommercialFixture,
} from "@/data/demo/p10b-16p-04-commercial-acceptance";
import {
  catalogueDisplayModelSchema,
  type CatalogueDisplayModel,
  type ProductDisplayModel,
} from "@/domain/catalogue";
import { canonicalValueFingerprint, storefrontSnapshotSchema } from "@/domain/storefront";
import { semanticIntentFixture } from "../fixtures/p10b-16p-04-semantic-intent";

const JEWELLERY_PROMPT = "Create a complete commercially credible jewellery storefront.";
const NEUTRAL_PROMPT =
  "Create a complete commercially credible storefront for this canonical product catalogue.";
const AURUM_APPROVED_ASSET_PROMPT =
  "Create a complete commercially credible jewellery and watch storefront for the fictional, production-disabled Aurum Nordic acceptance merchant using only its approved evidence and presentation assets.";

export const p10b18aSemanticVariations = [
  {
    id: "premium-story-image",
    drivers: {
      commercialPosture: "premium-editorial",
      density: "low",
      navigationPosture: "editorial",
      storyCatalogueBalance: "story-first",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "story-led",
      imageProminence: "image-led",
    },
  },
  {
    id: "premium-product-restrained",
    drivers: {
      commercialPosture: "premium-editorial",
      density: "balanced",
      navigationPosture: "editorial",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "campaign",
      configurableProductPosture: "guided",
      mobileHierarchy: "product-led",
      imageProminence: "restrained",
    },
  },
  {
    id: "technical-catalogue-dense",
    drivers: {
      commercialPosture: "modern-technical",
      density: "high",
      navigationPosture: "compact",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "catalogue-comparison",
      configurableProductPosture: "technical",
      mobileHierarchy: "conversion-led",
      imageProminence: "balanced",
    },
  },
  {
    id: "technical-conversion-contained",
    drivers: {
      commercialPosture: "modern-technical",
      density: "balanced",
      navigationPosture: "catalogue",
      storyCatalogueBalance: "balanced",
      discoveryPosture: "dense-search",
      configurableProductPosture: "standard",
      mobileHierarchy: "conversion-led",
      imageProminence: "restrained",
    },
  },
  {
    id: "minimal-product-first",
    drivers: {
      commercialPosture: "minimal-commerce",
      density: "balanced",
      navigationPosture: "minimal",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "dense-search",
      configurableProductPosture: "standard",
      mobileHierarchy: "conversion-led",
      imageProminence: "restrained",
    },
  },
  {
    id: "minimal-story-airy",
    drivers: {
      commercialPosture: "minimal-commerce",
      density: "low",
      navigationPosture: "minimal",
      storyCatalogueBalance: "story-first",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "story-led",
      imageProminence: "balanced",
    },
  },
  {
    id: "premium-conversion-led",
    drivers: {
      commercialPosture: "high-consideration",
      density: "balanced",
      navigationPosture: "editorial",
      storyCatalogueBalance: "balanced",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "conversion-led",
      imageProminence: "image-led",
    },
  },
  {
    id: "technical-simple-heavy",
    drivers: {
      commercialPosture: "fast-conversion",
      density: "high",
      navigationPosture: "catalogue",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "dense-search",
      configurableProductPosture: "standard",
      mobileHierarchy: "product-led",
      imageProminence: "balanced",
    },
  },
] as const;

export type P10b18aSemanticVariation = (typeof p10b18aSemanticVariations)[number];

type AuditShape = Readonly<{
  id: string;
  catalogue: CatalogueDisplayModel;
  fixtureAuthority: "karvonen-raw" | "p10b16p04j-aurum-approved";
  fixtureKind:
    | "canonical-subcatalogue"
    | "neutral-synthetic"
    | "hybrid-synthetic"
    | "approved-fictional-merchant";
  merchantPrompt: string;
  assertions: readonly (
    "high-consideration" | "mixed-jewellery-watch" | "approved-presentation-assets"
  )[];
}>;

function sourceFixture() {
  return createRawKarvonenStorefrontFixture();
}

function aurumApprovedSourceFixture() {
  return createP10B16P04RawAurumCommercialFixture();
}

const neutralText = (value: string) => ({ en: value, fi: value });

function catalogueShapeFromProducts(
  id: string,
  productsInput: readonly ProductDisplayModel[],
  fixtureKind: AuditShape["fixtureKind"] = "canonical-subcatalogue",
  assertions: AuditShape["assertions"] = [],
): AuditShape {
  const source = sourceFixture();
  const products = structuredClone(productsInput);
  const productIds = new Set(products.map((product) => product.id));
  const collections = source.planningInput.catalogue.collections
    .map((collection, index) => {
      const retained = {
        ...structuredClone(collection),
        productIds: collection.productIds.filter((productId) => productIds.has(productId)),
      };
      return fixtureKind === "canonical-subcatalogue"
        ? retained
        : {
            ...retained,
            title: neutralText(`Neutral audit collection ${index + 1}`),
            description: neutralText(
              "Deterministic test-only collection used for authority stratification.",
            ),
          };
    })
    .filter((collection) => collection.productIds.length > 0);
  return {
    id,
    fixtureAuthority: "karvonen-raw",
    fixtureKind,
    merchantPrompt: fixtureKind === "canonical-subcatalogue" ? JEWELLERY_PROMPT : NEUTRAL_PROMPT,
    assertions,
    catalogue: catalogueDisplayModelSchema.parse({
      ...structuredClone(source.planningInput.catalogue),
      products,
      collections,
    }),
  };
}

function catalogueShape(id: string, accept: (product: ProductDisplayModel) => boolean): AuditShape {
  return catalogueShapeFromProducts(
    id,
    sourceFixture().planningInput.catalogue.products.filter(accept),
  );
}

function isConfigurable(product: ProductDisplayModel) {
  return product.variants.length > 0 || (product.orderOptions?.length ?? 0) > 0;
}

function neutralHighConsiderationProduct(base: ProductDisplayModel): ProductDisplayModel {
  return {
    id: base.id,
    sku: "AUDIT-CONSIDERED-001",
    title: neutralText("Neutral modular worktable"),
    description: neutralText(
      "A deterministic audit-only configurable product with four canonical option groups.",
    ),
    price: { amount: 1_200, currency: "EUR" },
    stockStatus: "inStock",
    images: base.images.map((image, index) => ({
      ...structuredClone(image),
      alt: neutralText(`Neutral audit worktable view ${index + 1}`),
    })),
    productType: "configurable-furniture",
    attributes: { fixturePurpose: "audit-only", configurationClass: "high-consideration" },
    variants: [],
    orderOptions: [
      {
        id: "option_audit_worktop",
        type: "selection",
        label: neutralText("Worktop"),
        required: true,
        values: [neutralText("Oak"), neutralText("Linoleum")],
      },
      {
        id: "option_audit_width",
        type: "selection",
        label: neutralText("Width"),
        required: true,
        values: [neutralText("120 cm"), neutralText("160 cm")],
      },
      {
        id: "option_audit_frame",
        type: "selection",
        label: neutralText("Frame"),
        required: true,
        values: [neutralText("Natural"), neutralText("Black")],
      },
      {
        id: "option_audit_cable",
        type: "selection",
        label: neutralText("Cable management"),
        required: false,
        values: [neutralText("None"), neutralText("Tray")],
      },
    ],
  };
}

function mixedJewelleryWatchProducts(
  products: readonly ProductDisplayModel[],
): ProductDisplayModel[] {
  return products.slice(0, 4).map((base, index) =>
    index === 0
      ? {
          ...structuredClone(base),
          title: neutralText("Neutral audit jewellery product"),
          description: neutralText(
            "Deterministic audit-only jewellery content paired with watch products.",
          ),
          images: base.images.map((image, imageIndex) => ({
            ...structuredClone(image),
            alt: neutralText(`Neutral jewellery audit view ${imageIndex + 1}`),
          })),
        }
      : {
          id: base.id,
          sku: `AUDIT-WATCH-${index}`,
          title: neutralText(`Neutral audit watch ${index}`),
          description: neutralText("Deterministic audit-only watch catalogue content."),
          price: { amount: 300 + index * 100, currency: "EUR" },
          stockStatus: "inStock",
          images: base.images.map((image, imageIndex) => ({
            ...structuredClone(image),
            alt: neutralText(`Neutral watch audit view ${imageIndex + 1}`),
          })),
          productType: "watch",
          attributes: { fixturePurpose: "audit-only", ordinal: index },
          variants: [],
        },
  );
}

function auditShapes() {
  const source = sourceFixture();
  const aurum = aurumApprovedSourceFixture();
  const all = source.planningInput.catalogue.products;
  const configurable = all.filter(isConfigurable);
  const simple = all.filter((product) => !isConfigurable(product));
  const smallCatalogueProductIds = new Set(all.slice(0, 2).map(({ id }) => id));
  return [
    catalogueShapeFromProducts(
      "neutral-true-high-consideration",
      [neutralHighConsiderationProduct(all[0])],
      "neutral-synthetic",
      ["high-consideration"],
    ),
    catalogueShapeFromProducts(
      "mixed-jewellery-watch",
      mixedJewelleryWatchProducts(all),
      "hybrid-synthetic",
      ["mixed-jewellery-watch"],
    ),
    catalogueShapeFromProducts("simple-product-heavy-small", simple.slice(0, 3)),
    catalogueShapeFromProducts("configurable-product-heavy-medium", configurable),
    catalogueShape(
      "canonical-product-media-rich-presentation-asset-poor",
      (product) => product.images.length >= 2,
    ),
    catalogueShape("image-evidence-poor", (product) => product.images.length === 1),
    catalogueShape("small-catalogue", ({ id }) => smallCatalogueProductIds.has(id)),
    catalogueShape("medium-mixed-jewellery", () => true),
    {
      id: "aurum-approved-presentation-image-rich",
      catalogue: catalogueDisplayModelSchema.parse(structuredClone(aurum.planningInput.catalogue)),
      fixtureAuthority: "p10b16p04j-aurum-approved",
      fixtureKind: "approved-fictional-merchant",
      merchantPrompt: AURUM_APPROVED_ASSET_PROMPT,
      assertions: ["approved-presentation-assets"],
    },
  ];
}

function representativeRoutes(
  catalogue: CatalogueDisplayModel,
  siteMapDecision: ReturnType<typeof storefrontSiteMapDecisionSchema.parse>,
) {
  const routeForProduct = (product: ProductDisplayModel | undefined) =>
    siteMapDecision.pages.find(
      ({ commerceContext }) =>
        commerceContext.kind === "product" && commerceContext.productId === product?.id,
    )?.route ?? null;
  const representativeCollection = catalogue.collections.reduce<
    CatalogueDisplayModel["collections"][number] | undefined
  >(
    (selected, collection) =>
      !selected || collection.productIds.length > selected.productIds.length
        ? collection
        : selected,
    undefined,
  );
  return {
    collection:
      siteMapDecision.pages.find(
        ({ commerceContext }) =>
          commerceContext.kind === "collection" &&
          commerceContext.collectionId === representativeCollection?.id,
      )?.route ?? null,
    simpleProduct: routeForProduct(catalogue.products.find((product) => !isConfigurable(product))),
    configurableProduct: routeForProduct(
      catalogue.products.find(
        (product) => isConfigurable(product) && (product.orderOptions?.length ?? 0) < 4,
      ),
    ),
    highConsiderationProduct: routeForProduct(
      catalogue.products.find((product) => (product.orderOptions?.length ?? 0) >= 4),
    ),
  };
}

function commerceFingerprint(catalogue: CatalogueDisplayModel) {
  return canonicalValueFingerprint(
    catalogue.products.map((product) => ({
      id: product.id,
      sku: product.sku ?? null,
      title: product.title,
      description: product.description ?? null,
      brand: product.brand ?? null,
      category: product.category ?? null,
      price: product.price ?? null,
      compareAtPrice: product.compareAtPrice ?? null,
      priceUnavailableReason: product.priceUnavailableReason ?? null,
      availabilityLabel: product.availabilityLabel ?? null,
      stockStatus: product.stockStatus ?? null,
      productType: product.productType,
      attributes: product.attributes,
      variants: product.variants,
      orderOptions: product.orderOptions ?? [],
    })),
  );
}

function mediaFingerprint(catalogue: CatalogueDisplayModel) {
  return canonicalValueFingerprint(
    catalogue.products.map(({ id, images }) => ({ productId: id, images })),
  );
}

export function createP10b18aShapeAuthorities() {
  const karvonenSource = sourceFixture();
  const aurumSource = aurumApprovedSourceFixture();
  return auditShapes().map(
    ({ id, catalogue, fixtureAuthority, fixtureKind, merchantPrompt, assertions }) => {
      const source =
        fixtureAuthority === "p10b16p04j-aurum-approved" ? aurumSource : karvonenSource;
      const collectionIds = new Set(catalogue.collections.map((collection) => collection.id));
      const productIds = new Set(catalogue.products.map((product) => product.id));
      const retainedPages = source.siteMapDecision.pages.filter(({ commerceContext }) => {
        if (commerceContext.kind === "collection") {
          return collectionIds.has(commerceContext.collectionId);
        }
        if (commerceContext.kind === "product") return productIds.has(commerceContext.productId);
        return true;
      });
      const retainedKeys = new Set(retainedPages.map(({ key }) => key));
      const siteMapDecision = storefrontSiteMapDecisionSchema.parse({
        ...structuredClone(source.siteMapDecision),
        pages: retainedPages.map((page) => {
          const cloned = structuredClone(page);
          if (cloned.parentKey && !retainedKeys.has(cloned.parentKey)) delete cloned.parentKey;
          if (
            (fixtureKind === "neutral-synthetic" || fixtureKind === "hybrid-synthetic") &&
            cloned.commerceContext.kind === "collection"
          ) {
            const selectedCollectionId = cloned.commerceContext.collectionId;
            const collection = catalogue.collections.find(
              ({ id: collectionId }) => collectionId === selectedCollectionId,
            );
            if (collection) {
              cloned.title = structuredClone(collection.title);
              cloned.seo = {
                title: structuredClone(collection.title),
                metaDescription: structuredClone(collection.description),
              };
              cloned.navigation = cloned.navigation.map((entry) => ({
                ...entry,
                label: structuredClone(collection.title),
              }));
            }
          }
          if (
            (fixtureKind === "neutral-synthetic" || fixtureKind === "hybrid-synthetic") &&
            cloned.commerceContext.kind === "product"
          ) {
            const selectedProductId = cloned.commerceContext.productId;
            const product = catalogue.products.find(
              ({ id: productId }) => productId === selectedProductId,
            );
            if (product) {
              cloned.title = structuredClone(product.title);
              cloned.seo = {
                title: structuredClone(product.title),
                metaDescription: structuredClone(product.description ?? product.title),
              };
            }
          }
          return cloned;
        }),
      });
      const executionPlanningInput = { ...source.executionPlanningInput, catalogue };
      const dynamicCommercePresentation = materializeCurrentDynamicCommercePresentationAuthority(
        executionPlanningInput.draft,
        catalogue,
      );
      const currentDraft = storefrontSnapshotSchema.parse({
        ...structuredClone(executionPlanningInput.draft),
        dynamicCommercePresentation,
      });
      if (
        fixtureAuthority === "p10b16p04j-aurum-approved" &&
        currentDraft.id !== P10B16P04_COMMERCIAL_DRAFT_ID
      ) {
        throw new Error("The P10B-18A Aurum stratum must use the raw P04J draft authority.");
      }
      const planningInput = {
        ...executionPlanningInput,
        draft: currentDraft,
      };
      const currentRequestInput = {
        merchantPrompt,
        project: source.aggregate.project,
        draft: planningInput.draft,
        catalogue,
        approvedBrief: source.brief,
        approvedAssetContext: planningInput.approvedAssetContext,
        priorDiversityEvidence: {
          recentAcceptedStructuralFingerprints: [],
          recentRejectedStructuralFingerprints: [],
          recentlyUsedPostureKeys: [],
          merchantAvoidancePreferenceKeys: [],
        },
      };
      const exact = createPromptedStorefrontDesignRequestV2(currentRequestInput);
      const compatibilityInput = {
        planningInput,
        siteMapDecision,
        approvedEvidenceReferences: source.approvedEvidenceReferences,
      };
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
      return {
        id,
        catalogue,
        fixtureAuthority,
        fixtureKind,
        assertions,
        fixtureSetup: {
          sourceDraftId: planningInput.draft.id,
          sourceDraftKind:
            fixtureAuthority === "p10b16p04j-aurum-approved"
              ? ("p04j-raw-draft" as const)
              : ("karvonen-raw-draft" as const),
          fixtureBootstrapMaterializationCount:
            fixtureAuthority === "p10b16p04j-aurum-approved" ? 1 : 0,
          matrixCaseMaterializationCount: 0,
        },
        currentRequestInput,
        compatibilityInput,
        semanticCapabilityIndex,
        request,
        preparedAuthority,
        siteMapDecision,
        aggregate: source.aggregate,
        pageEvidenceAuthority: source.pageEvidenceAuthority,
        contentFactAuthority: source.contentFactAuthority,
        approvedAssetPresentations: source.approvedAssetPresentations,
        representativeRoutes: representativeRoutes(catalogue, siteMapDecision),
        approvedEvidenceFingerprint: source.brief.approvedEvidenceFingerprint ?? null,
        approvedAssetContextFingerprint: planningInput.approvedAssetContext?.fingerprint ?? null,
        approvedAssetPresentationFingerprint: canonicalValueFingerprint(
          source.approvedAssetPresentations,
        ),
        catalogueFingerprint: canonicalValueFingerprint(catalogue),
        commerceFingerprint: commerceFingerprint(catalogue),
        mediaFingerprint: mediaFingerprint(catalogue),
      };
    },
  );
}

export type P10b18aShapeAuthority = ReturnType<typeof createP10b18aShapeAuthorities>[number];

export function selectP10b18aAuditCase(shapeId: string, variationId: string) {
  const authority = createP10b18aShapeAuthorities().find(({ id }) => id === shapeId);
  const variation = p10b18aSemanticVariations.find(({ id }) => id === variationId);
  if (!authority || !variation) {
    throw new Error(`Unknown P10B-18A audit case ${shapeId}/${variationId}.`);
  }
  return { authority, variation };
}

export function compileP10b18aAuditCase(
  authority: P10b18aShapeAuthority,
  variation: P10b18aSemanticVariation,
) {
  return compileSemanticStorefrontDesignIntentV1({
    originalRequest: authority.request,
    providerIntent: semanticIntentFixture(authority.request, {
      designConceptSummary: `${authority.id}:${variation.id}`,
      ...variation.drivers,
    }),
    currentRequestInput: authority.currentRequestInput,
    compatibilityInput: authority.compatibilityInput,
    semanticCapabilityIndex: authority.semanticCapabilityIndex,
    preparedAuthority: authority.preparedAuthority,
  });
}

export type P10b18aCompiledAuditResult = ReturnType<typeof compileP10b18aAuditCase>;

export function p10b18aMaterializerConsumedDesignAuthority(
  decision: P10b18aCompiledAuditResult["synthesisDecision"],
) {
  return {
    directionId: decision.designDna.directionId,
    designSystemNarrowing: {
      spacingDensity: decision.designDna.spacingDensity,
      surfaceDepth: decision.designDna.surfaceDepth,
    },
    sharedFrameProfileId: decision.sharedFrame.profileId,
    includedPageKeys: decision.siteMap.pageKeys,
    pageProfiles: decision.pageProfileSelections.map(
      ({ pageKey, familyId, profileId, profileVersion }) => ({
        pageKey,
        familyId,
        profileId,
        profileVersion,
      }),
    ),
    pageBlueprintSelectionOverrides: decision.pageBlueprintSelectionOverrides,
    approvedAssetRoleSelections: decision.approvedAssetRoleSelections.map((selection) => ({
      profileId: selection.profileId,
      slotId: selection.slotId,
      component: selection.component,
      assetSlotId: selection.assetSlotId,
      role: selection.role,
      assetId: selection.assetId,
      assetRevision: selection.assetRevision,
      materialFingerprint: selection.materialFingerprint,
    })),
    dynamicCommerceSelection: decision.dynamicCommerceSelection
      ? {
          collectionArchetypeId: decision.dynamicCommerceSelection.collectionArchetypeId,
          searchArchetypeId: decision.dynamicCommerceSelection.searchArchetypeId,
          standardSimpleArchetypeId: decision.dynamicCommerceSelection.standardSimpleArchetypeId,
          configurableArchetypeId: decision.dynamicCommerceSelection.configurableArchetypeId,
          galleryLedArchetypeId: decision.dynamicCommerceSelection.galleryLedArchetypeId,
          highConsiderationArchetypeId:
            decision.dynamicCommerceSelection.highConsiderationArchetypeId,
          genericFallbackArchetypeId: decision.dynamicCommerceSelection.genericFallbackArchetypeId,
          productTypeMappings: decision.dynamicCommerceSelection.productTypeMappings,
        }
      : null,
  };
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function p10b18aNormalizedDesignTopology(result: P10b18aCompiledAuditResult) {
  const decision = result.synthesisDecision;
  const dna = result.compiledDecision.designDna.value;
  const familyByPageKey = new Map(
    decision.pageProfileSelections.map(({ pageKey, familyId }) => [pageKey, familyId]),
  );
  return {
    directionId: decision.designDna.directionId,
    designDnaCategories: {
      typography: dna.typography,
      spacing: dna.spacing,
      surfaces: dna.surfaces,
      controls: dna.controls,
      density: dna.density,
      media: dna.media,
    },
    sharedFrameProfileId: decision.sharedFrame.profileId,
    pageProfileSequence: uniqueSorted(
      decision.pageProfileSelections.map(
        ({ familyId, profileId, profileVersion }) => `${familyId}:${profileId}@${profileVersion}`,
      ),
    ),
    componentVariantAnatomySequence: uniqueSorted(
      decision.componentChoices.map(
        ({ pageKey, slotId, component, variant, anatomyId }) =>
          `${familyByPageKey.get(pageKey) ?? "unknown"}:${slotId}:${component}:${variant}:${anatomyId ?? "none"}`,
      ),
    ),
    boundedLayoutParameters: decision.boundedParameters,
    approvedAssetPlacementModes: uniqueSorted(
      decision.approvedAssetRoleSelections.map(
        ({ profileId, slotId, component, assetSlotId, role }) =>
          `${profileId}:${slotId}:${component}:${assetSlotId}:${role}`,
      ),
    ),
    dynamicArchetypeRoles: decision.dynamicCommerceSelection
      ? {
          collection: decision.dynamicCommerceSelection.collectionArchetypeId,
          search: decision.dynamicCommerceSelection.searchArchetypeId,
          standardSimple: decision.dynamicCommerceSelection.standardSimpleArchetypeId,
          configurable: decision.dynamicCommerceSelection.configurableArchetypeId,
          galleryLed: decision.dynamicCommerceSelection.galleryLedArchetypeId,
          highConsideration: decision.dynamicCommerceSelection.highConsiderationArchetypeId,
          genericFallback: decision.dynamicCommerceSelection.genericFallbackArchetypeId,
          productTypeMappedArchetypes: uniqueSorted(
            Object.values(decision.dynamicCommerceSelection.productTypeMappings),
          ),
        }
      : null,
    responsiveMode: "unavailable-in-materializer-design-authority",
  };
}

export function p10b18aDirectionLabelFreeNormalizedDesignTopology(
  result: P10b18aCompiledAuditResult,
) {
  const topology = p10b18aNormalizedDesignTopology(result);
  return {
    designDnaCategories: topology.designDnaCategories,
    sharedFrameProfileId: topology.sharedFrameProfileId,
    pageProfileSequence: topology.pageProfileSequence,
    componentVariantAnatomySequence: topology.componentVariantAnatomySequence,
    boundedLayoutParameters: topology.boundedLayoutParameters,
    approvedAssetPlacementModes: topology.approvedAssetPlacementModes,
    dynamicArchetypeRoles: topology.dynamicArchetypeRoles,
    responsiveMode: topology.responsiveMode,
  };
}

export function p10b18aMaterializerDesignAuthorityFingerprint(result: P10b18aCompiledAuditResult) {
  return `p10b18a-materializer-design-authority-${canonicalValueFingerprint(
    p10b18aMaterializerConsumedDesignAuthority(result.synthesisDecision),
  )}`;
}

export function p10b18aNormalizedDesignTopologyFingerprint(result: P10b18aCompiledAuditResult) {
  return `p10b18a-design-topology-${canonicalValueFingerprint(
    p10b18aNormalizedDesignTopology(result),
  )}`;
}

export function p10b18aDirectionLabelFreeNormalizedDesignTopologyFingerprint(
  result: P10b18aCompiledAuditResult,
) {
  return `p10b18a-direction-label-free-design-topology-${canonicalValueFingerprint(
    p10b18aDirectionLabelFreeNormalizedDesignTopology(result),
  )}`;
}
