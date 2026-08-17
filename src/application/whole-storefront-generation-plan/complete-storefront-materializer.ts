import {
  materializeContentSupportSnapshot,
  type ContentSupportFactAuthority,
} from "@/application/content-support-pages";
import {
  materializeCurrentDynamicCommercePresentationAuthority,
  requireMigratedDynamicCommerceSnapshot,
  validateDynamicCommerceDesignSelection,
  type DynamicCommerceDesignSelection,
} from "@/application/dynamic-commerce-routes";
import {
  materializeStorefrontSiteMap,
  type PageFactEvidenceAuthority,
  type StorefrontSiteMapDecision,
} from "@/application/storefront-site-map";
import {
  getCommercialCollectionSearchProfile,
  getCommercialPdpProfile,
  commercialCollectionSearchProfileIdSchema,
  commercialHomepageProfileIdSchema,
  commercialPdpProfileIdSchema,
  type CommercialCollectionSearchProfileId,
  type CommercialPdpProfileId,
} from "@/application/storefront-templates";
import {
  compileWholeStorefrontProposal,
  materializeWholeStorefrontRuntimeSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import { migrateApprovedPresentationArtDirection } from "@/application/responsive-image-authority";
import { registeredBrandSystemForDirection } from "@/application/storefront-design-system";
import {
  dynamicCollectionCommerceBridgeDefinition,
  dynamicProductDetailBridgeDefinition,
  validateRegisteredSnapshot,
} from "@/components/registry";
import {
  canonicalStorefrontContentFingerprint,
  canonicalStorefrontSiteMapFingerprint,
  canonicalValueFingerprint,
  approvedAssetPresentationSchema,
  storefrontSnapshotSchema,
  validateCanonicalStorefrontSiteMap,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
} from "./planner";
import { WholeStorefrontGenerationPlanError } from "./contract";
import type {
  WholeStorefrontGenerationPlan,
  WholeStorefrontApprovedAssetRoleSelection,
  WholeStorefrontPageBlueprintSelectionOverride,
  WholeStorefrontPlanningInput,
} from "./contract";
import type { ApprovedAssetPresentation } from "./approved-brand-story-media";

const contentSupportFamilyIds = new Set([
  "about",
  "contact",
  "faq",
  "shipping-information",
  "returns-information",
  "policy-legal",
  "campaign-editorial",
  "generic-content",
  "store-locations",
]);

const RELATED_PRODUCT_LIMIT = 4;

/**
 * Derives bounded related merchandising without creating canonical catalogue relationships.
 * Existing collection order and catalogue order remain the only ordering authorities.
 */
export function selectBoundedRelatedProductIds(
  catalogue: CatalogueDisplayModel,
  productId: string,
): readonly string[] {
  const product = catalogue.products.find((candidate) => candidate.id === productId);
  if (!product) throw new Error(`Related merchandising product ${productId} is unavailable.`);

  const eligible = new Set(
    catalogue.products
      .filter(
        (candidate) =>
          candidate.id !== productId &&
          candidate.images.length > 0 &&
          candidate.price !== undefined &&
          (candidate.stockStatus === "inStock" || candidate.stockStatus === "lowStock"),
      )
      .map(({ id }) => id),
  );
  const selected: string[] = [];
  const append = (candidateId: string) => {
    if (
      eligible.has(candidateId) &&
      !selected.includes(candidateId) &&
      selected.length < RELATED_PRODUCT_LIMIT
    ) {
      selected.push(candidateId);
    }
  };

  catalogue.collections
    .filter(({ productIds }) => productIds.includes(productId))
    .forEach(({ productIds }) => productIds.forEach(append));
  catalogue.products
    .filter((candidate) => candidate.productType === product.productType)
    .forEach(({ id }) => append(id));
  catalogue.products.forEach(({ id }) => append(id));

  return Object.freeze(selected);
}

type DynamicRouteInventoryEntry = NonNullable<
  StorefrontSnapshot["dynamicCommercePresentation"]
>["routeInventory"][number];

function routeIdentityMatchesSiteMapPage(
  route: DynamicRouteInventoryEntry,
  page: StorefrontSiteMapDecision["pages"][number],
): boolean {
  if (route.route !== page.route) return false;
  if (route.kind === "collection") {
    return (
      page.familyId === "collection" &&
      page.commerceContext.kind === "collection" &&
      page.commerceContext.collectionId === route.collectionId
    );
  }
  if (route.kind === "product") {
    return (
      page.familyId === "product-detail" &&
      page.commerceContext.kind === "product" &&
      page.commerceContext.productId === route.productId
    );
  }
  return page.familyId === "search-results" && page.commerceContext.kind === "search";
}

/**
 * Migrated commerce routes are canonical identities even though they are no longer persisted as
 * concrete pages. Site-map rematerialization still needs an exact existing-page projection so it
 * can preserve those identities. The projection is deliberately transient: the later migration
 * boundary folds these pages back into the one compact dynamic-commerce authority.
 */
function reconcileMigratedRoutePageIdentities(
  draft: StorefrontSnapshot,
  decision: StorefrontSiteMapDecision,
): StorefrontSnapshot {
  const baseSnapshot = structuredClone(draft);
  const authority = baseSnapshot.dynamicCommercePresentation;
  if (!authority) return baseSnapshot;

  const existingPageIds = new Set(baseSnapshot.pages.map(({ id }) => id));
  const routesById = new Map(authority.routeInventory.map((route) => [route.id, route]));
  const transientRoutePages = decision.pages.flatMap((page) => {
    if (!page.existingPageId || existingPageIds.has(page.existingPageId)) return [];
    const route = routesById.get(page.existingPageId);
    if (!route || !routeIdentityMatchesSiteMapPage(route, page)) return [];
    return [
      {
        id: route.id,
        type: route.kind === "product" ? ("product" as const) : ("collection" as const),
        slug: route.route,
        title: structuredClone(page.title),
        seo: structuredClone(page.seo),
        sections: [],
      },
    ];
  });

  baseSnapshot.pages = [...baseSnapshot.pages, ...transientRoutePages];
  // A canonical snapshot cannot persist both concrete route pages and the compact route
  // inventory. Remove the compact authority only after its referenced identities are projected.
  delete baseSnapshot.dynamicCommercePresentation;
  return baseSnapshot;
}

export type CompleteStorefrontMaterialization = Readonly<{
  snapshot: StorefrontSnapshot;
  planningInput: WholeStorefrontPlanningInput;
  plan: WholeStorefrontGenerationPlan;
  proposal: ReturnType<typeof compileWholeStorefrontProposal>;
  siteMapFingerprint: string;
  snapshotFingerprint: string;
}>;

function materializedSectionId(
  kind: "collection" | "product",
  materializationIdPrefix: string,
  identity: Readonly<Record<string, string>>,
): string {
  return `section_${kind}_${canonicalValueFingerprint({ materializationIdPrefix, ...identity }).slice(-32)}`;
}

function collectionSection(
  snapshot: StorefrontSnapshot,
  planningInput: WholeStorefrontPlanningInput,
  profileId: CommercialCollectionSearchProfileId,
  materializationIdPrefix: string,
  pageId: string,
  collectionId?: string,
): SectionInstance {
  const collection = collectionId
    ? planningInput.catalogue.collections.find((candidate) => candidate.id === collectionId)
    : planningInput.catalogue.collections[0];
  const profile = getCommercialCollectionSearchProfile(profileId);
  const authority = profile?.profile?.commercialCollectionSearch;
  const slot = profile?.slots[0];
  if (!collection || !authority || !slot) {
    throw new Error(
      `Complete storefront materialization requires current ${profileId} collection authority.`,
    );
  }
  const canonicalRevision = createWholeStorefrontGenerationTarget({
    ...planningInput,
    draft: snapshot,
  }).canonicalCommerceFingerprint;
  return {
    id: materializedSectionId("collection", materializationIdPrefix, {
      pageId,
      profileId,
      collectionId: collection.id,
    }),
    component: "dynamicCollectionCommerce",
    variant: slot.defaultVariant,
    visible: true,
    content: {
      ...structuredClone(dynamicCollectionCommerceBridgeDefinition.defaultContent),
      collectionId: collection.id,
      productIds: [...collection.productIds],
      canonicalRevision,
    },
    props: {
      ...structuredClone(dynamicCollectionCommerceBridgeDefinition.defaultProps),
      gridDensity: authority.gridDensity,
      cardVariant: authority.productCardAnatomyId,
      filterLayout: authority.filterLayout,
      showChildCollections: authority.childCollectionTreatment !== "omit",
    },
    approvedAssetPlacements: [],
    approvedAssetPresentations: [],
  };
}

function productSection(
  productId: string,
  relatedProductIds: readonly string[],
  canonicalRevision: string,
  profileId: CommercialPdpProfileId,
  materializationIdPrefix: string,
  pageId: string,
): SectionInstance {
  const authority = getCommercialPdpProfile(profileId)?.profile?.commercialProductDetail;
  if (!authority) {
    throw new Error(`Complete storefront materialization requires current ${profileId} authority.`);
  }
  return {
    id: materializedSectionId("product", materializationIdPrefix, {
      pageId,
      profileId,
      productId,
    }),
    component: "dynamicProductDetail",
    variant: authority.dynamicProductDetailVariant,
    visible: true,
    content: {
      ...structuredClone(dynamicProductDetailBridgeDefinition.defaultContent),
      productId,
      relatedProductIds: [...relatedProductIds],
      canonicalRevision,
    },
    props: {
      ...structuredClone(authority.dynamicProductDetailProps),
      relatedCardVariant: authority.relatedProductCardAnatomyId,
    },
    approvedAssetPlacements: [],
    approvedAssetPresentations: [],
  };
}

function selectedProfile(snapshot: StorefrontSnapshot, familyId: string, label: string): string {
  const values = new Set(
    snapshot.pages
      .filter((page) => page.pageFamily?.familyId === familyId)
      .map((page) => page.pageFamily?.profileId)
      .filter((value): value is string => typeof value === "string"),
  );
  if (values.size !== 1) {
    throw new Error(`Complete storefront materialization requires one exact ${label} profile.`);
  }
  const [value] = values;
  if (!value) {
    throw new Error(`Complete storefront materialization requires one exact ${label} profile.`);
  }
  return value;
}

/**
 * Materializes one complete site-map selection through the existing site-map, PageBlueprint,
 * planner, proposal, StorefrontSnapshot, registry and renderer authorities. It is deliberately
 * selection-agnostic: callers may only supply already-registered profile and frame references.
 */
export function materializeCompleteStorefrontSelection(
  input: Readonly<{
    planningInput: WholeStorefrontPlanningInput;
    siteMapDecision: StorefrontSiteMapDecision;
    pageEvidenceAuthority: PageFactEvidenceAuthority;
    contentFactAuthority: ContentSupportFactAuthority;
    approvedAssetPresentations: readonly ApprovedAssetPresentation[];
    directionId: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"];
    designSystemNarrowing?: Readonly<{
      spacingDensity: "compact" | "standard" | "spacious";
      surfaceDepth: "flat" | "subtle" | "layered";
    }>;
    pageBlueprintSelectionOverrides?: readonly WholeStorefrontPageBlueprintSelectionOverride[];
    approvedAssetRoleSelections?: readonly WholeStorefrontApprovedAssetRoleSelection[];
    dynamicCommerceSelection?: DynamicCommerceDesignSelection;
    artDirectionPosture?: "contained" | "editorial" | "immersive";
    materializationIdPrefix?: string;
  }>,
): CompleteStorefrontMaterialization {
  const materializationIdPrefix = input.materializationIdPrefix ?? "complete";
  for (const selection of input.approvedAssetRoleSelections ?? []) {
    const presentation = input.approvedAssetPresentations.find(
      (candidate) =>
        candidate.assetId === selection.assetId &&
        candidate.role === selection.role &&
        candidate.revision === selection.assetRevision &&
        candidate.materialFingerprint === selection.materialFingerprint &&
        candidate.asset.id === selection.assetId,
    );
    if (!presentation) {
      throw new WholeStorefrontGenerationPlanError(
        "stale-approved-asset",
        "An exact approved asset-role selection has no matching renderer presentation authority.",
      );
    }
    for (const responsiveSourceAssetId of selection.responsiveSourceAssetIds ?? []) {
      if (
        !input.approvedAssetPresentations.some(
          (candidate) => candidate.assetId === responsiveSourceAssetId,
        )
      ) {
        throw new WholeStorefrontGenerationPlanError(
          "stale-approved-asset",
          "An exact responsive source selection has no matching approved presentation authority.",
        );
      }
    }
  }
  const sourceDynamicSelection = input.dynamicCommerceSelection
    ? validateDynamicCommerceDesignSelection(
        input.planningInput.draft,
        input.planningInput.catalogue,
        input.dynamicCommerceSelection,
      )
    : null;
  const baseSnapshot = reconcileMigratedRoutePageIdentities(
    input.planningInput.draft,
    input.siteMapDecision,
  );
  const siteMap = materializeStorefrontSiteMap({
    decision: input.siteMapDecision,
    baseSnapshot,
    catalogue: input.planningInput.catalogue,
    evidenceAuthority: input.pageEvidenceAuthority,
  });

  let snapshot = siteMap.snapshot;
  for (const page of snapshot.pages) {
    if (page.pageFamily && contentSupportFamilyIds.has(page.pageFamily.familyId)) {
      snapshot = materializeContentSupportSnapshot({
        snapshot,
        pageId: page.id,
        factAuthority: input.contentFactAuthority,
        ...(input.planningInput.approvedAssetContext
          ? {
              approvedAssetAuthority: {
                context: input.planningInput.approvedAssetContext,
                presentations: input.approvedAssetPresentations.map((presentation) =>
                  approvedAssetPresentationSchema.parse(presentation),
                ),
                placements: input.planningInput.requiredAssetPlacements,
              },
            }
          : {}),
      }).snapshot;
    }
  }

  const canonicalCommerceFingerprint = createWholeStorefrontGenerationTarget({
    ...input.planningInput,
    draft: snapshot,
  }).canonicalCommerceFingerprint;
  snapshot = storefrontSnapshotSchema.parse({
    ...snapshot,
    pages: snapshot.pages.map((page) => {
      if (["search-results", "collection"].includes(page.pageFamily?.familyId ?? "")) {
        return {
          ...page,
          sections: [
            collectionSection(
              snapshot,
              input.planningInput,
              commercialCollectionSearchProfileIdSchema.parse(page.pageFamily?.profileId),
              materializationIdPrefix,
              page.id,
              page.pageFamily?.commerceContext.kind === "collection"
                ? page.pageFamily.commerceContext.collectionId
                : undefined,
            ),
          ],
        };
      }
      if (page.pageFamily?.familyId === "product-detail") {
        const productId =
          page.pageFamily.commerceContext.kind === "product"
            ? page.pageFamily.commerceContext.productId
            : null;
        if (!productId) {
          throw new Error("A product-detail page requires canonical product context.");
        }
        const retainedProductRoute =
          input.planningInput.draft.dynamicCommercePresentation?.routeInventory.find(
            (route) => route.kind === "product" && route.id === page.id,
          );
        const retainedRelatedProductIds =
          retainedProductRoute?.kind === "product"
            ? retainedProductRoute.relatedProductIds
            : undefined;
        return {
          ...page,
          sections: [
            productSection(
              productId,
              retainedProductRoute?.kind === "product"
                ? [...(retainedRelatedProductIds ?? [])]
                : selectBoundedRelatedProductIds(input.planningInput.catalogue, productId),
              canonicalCommerceFingerprint,
              commercialPdpProfileIdSchema.parse(page.pageFamily.profileId),
              materializationIdPrefix,
              page.id,
            ),
          ],
        };
      }
      return page;
    }),
  });

  snapshot = storefrontSnapshotSchema.parse({
    ...snapshot,
    dynamicCommercePresentation: undefined,
  });
  const currentDynamicAuthority = materializeCurrentDynamicCommercePresentationAuthority(
    snapshot,
    input.planningInput.catalogue,
  );
  const reboundDynamicSelection = sourceDynamicSelection
    ? validateDynamicCommerceDesignSelection(
        snapshot,
        input.planningInput.catalogue,
        {
          ...sourceDynamicSelection,
          authorityFingerprint: currentDynamicAuthority.authorityFingerprint,
        },
        currentDynamicAuthority,
      )
    : null;
  const planningInput = {
    ...structuredClone(input.planningInput),
    draft: snapshot,
  } satisfies WholeStorefrontPlanningInput;
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId: input.directionId,
    homepageProfileId: commercialHomepageProfileIdSchema.parse(
      selectedProfile(snapshot, "home", "homepage"),
    ),
    collectionProfileId: commercialCollectionSearchProfileIdSchema.parse(
      selectedProfile(snapshot, "collection", "collection"),
    ),
    pdpProfileId: commercialPdpProfileIdSchema.parse(
      selectedProfile(snapshot, "product-detail", "PDP"),
    ),
    designSystemNarrowing: input.designSystemNarrowing,
    pageBlueprintSelectionOverrides: input.pageBlueprintSelectionOverrides,
    approvedAssetRoleSelections: input.approvedAssetRoleSelections,
    dynamicCommerceSelection: reboundDynamicSelection,
  });
  const executionBrandSystem = registeredBrandSystemForDirection(
    planningInput.draft.brandSystem,
    planningInput.recipeContext.designSystem,
    input.directionId,
    {
      spacingDensity:
        input.designSystemNarrowing?.spacingDensity ?? plan.designSystemSelection.spacingDensity,
      surfaceDepth:
        input.designSystemNarrowing?.surfaceDepth ?? plan.designSystemSelection.surfaceDepth,
    },
  );
  const executionPresentations = input.approvedAssetPresentations.map((presentation) => {
    const selection = plan.approvedAssetRoleSelections.find(
      ({ assetId }) => assetId === presentation.assetId,
    );
    const placement = plan.approvedAssetPlacements.find(
      ({ assetId }) => assetId === presentation.assetId,
    );
    if (!selection || !placement) return approvedAssetPresentationSchema.parse(presentation);
    const responsiveSources = (selection.responsiveSourceAssetIds ?? []).flatMap((assetId) => {
      const sourcePresentation = input.approvedAssetPresentations.find(
        (candidate) => candidate.assetId === assetId,
      );
      const sourceAsset = planningInput.approvedAssetContext?.assets.find(
        (candidate) => candidate.assetId === assetId,
      );
      if (!sourcePresentation || !sourceAsset) return [];
      const breakpoints = sourceAsset.presentation.placementAuthority?.viewportApplicability.filter(
        (breakpoint) => breakpoint === "mobile" || breakpoint === "tablet",
      ) ?? ["mobile" as const];
      if (breakpoints.length === 0) return [];
      return [
        {
          breakpoints,
          assetId: sourcePresentation.assetId,
          role: sourcePresentation.role,
          revision: sourcePresentation.revision,
          materialFingerprint: sourcePresentation.materialFingerprint,
          asset: sourcePresentation.asset,
        },
      ];
    });
    const enriched = approvedAssetPresentationSchema.parse({
      ...presentation,
      ...(responsiveSources.length ? { responsiveSources } : {}),
    });
    const component = planningInput.componentDefinitions.find(
      ({ type }) => type === placement.componentType,
    );
    if (!component) return enriched;
    const plannedVariant = plan.pagePlans
      .flatMap(({ components }) => components)
      .find(
        (candidate) => "instance" in candidate && candidate.instance.id === placement.componentId,
      );
    const variant =
      plannedVariant && "instance" in plannedVariant
        ? plannedVariant.instance.variant
        : planningInput.draft.sharedFrame?.header.id === placement.componentId
          ? planningInput.draft.sharedFrame.header.variant
          : component.defaultVariant;
    const approvedAsset = planningInput.approvedAssetContext?.assets.find(
      ({ assetId }) => assetId === presentation.assetId,
    );
    return migrateApprovedPresentationArtDirection({
      presentation: enriched,
      placement,
      component,
      variant,
      dna: executionBrandSystem.designDna!,
      provenanceKind: placement.sourceProvenanceKind ?? "sourceDiscovered",
      artDirectionPosture: input.artDirectionPosture,
      approvedResponsiveCrops: [
        ...(approvedAsset?.presentation.responsiveCrops ?? []),
        ...(selection.responsiveSourceAssetIds ?? []).flatMap(
          (assetId) =>
            planningInput.approvedAssetContext?.assets.find(
              (candidate) => candidate.assetId === assetId,
            )?.presentation.responsiveCrops ?? [],
        ),
      ],
      approvedSafeArea: approvedAsset?.presentation.safeArea,
    });
  });
  for (const placement of plan.approvedAssetPlacements) {
    const presentation = executionPresentations.find(
      (candidate) =>
        candidate.assetId === placement.assetId &&
        candidate.asset.id === placement.assetId &&
        candidate.role === placement.role &&
        candidate.revision === placement.assetRevision &&
        candidate.materialFingerprint === placement.materialFingerprint,
    );
    if (!presentation) {
      throw new WholeStorefrontGenerationPlanError(
        "stale-approved-asset",
        "A planned approved asset has no matching current renderer presentation authority.",
      );
    }
  }
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const legacyMaterialized = materializeWholeStorefrontRuntimeSnapshot({
    runtime: proposal.proposedStorefront,
    planningInput,
    approvedAssetPresentations: executionPresentations,
  });
  const materialized = requireMigratedDynamicCommerceSnapshot(
    legacyMaterialized,
    planningInput.catalogue,
  );
  validateCanonicalStorefrontSiteMap(materialized, {
    catalogue: planningInput.catalogue,
    enabledLocales: planningInput.project.enabledLocales,
  });
  validateRegisteredSnapshot(
    materialized,
    planningInput.catalogue,
    planningInput.project.enabledLocales[0],
    planningInput.project.enabledLocales[0],
    planningInput.project.enabledLocales,
  );
  return Object.freeze({
    snapshot: structuredClone(materialized),
    planningInput: structuredClone(planningInput),
    plan: structuredClone(plan),
    proposal: structuredClone(proposal),
    siteMapFingerprint: canonicalStorefrontSiteMapFingerprint(materialized),
    snapshotFingerprint: canonicalStorefrontContentFingerprint(materialized),
  });
}
