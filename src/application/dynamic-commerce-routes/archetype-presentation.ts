import { getCommercialCollectionSearchProfile } from "@/application/storefront-templates/commercial-collection-search-profiles";
import { getCommercialPdpProfile } from "@/application/storefront-templates/commercial-pdp-profiles";
import { materializeExecutablePageBlueprint } from "@/application/storefront-templates/profile-materializer";
import {
  dynamicCollectionCommerceContentSchema,
  dynamicCollectionCommerceDefaultContent,
  dynamicCollectionCommerceDefaultProps,
  dynamicCollectionCommerceDefaultStyleOverrides,
  dynamicCollectionCommercePropsSchema,
} from "@/components/registry/dynamic-collection-commerce";
import {
  dynamicProductDetailContentSchema,
  dynamicProductDetailDefaultContent,
  dynamicProductDetailDefaultStyleOverrides,
  dynamicProductDetailPropsSchema,
} from "@/components/registry/dynamic-product-detail";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import {
  DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION,
  canonicalValueString,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommerceApprovedAssetSelection,
  type DynamicCommerceComponentPresentation,
  type DynamicCommerceProductDetailArchetype,
  type PageModel,
  type SectionInstance,
} from "@/domain/storefront";
import { failDynamicCommerceRouteAuthority as fail } from "./route-errors";
import { DynamicCommerceMigrationError } from "./migration-contract";

const COLLECTION_PROFILE_TO_ARCHETYPE = {
  "collection-editorial-discovery": "archetype_collection_editorial",
  "collection-catalogue-comparison": "archetype_collection_comparison",
  "collection-campaign-led-discovery": "archetype_collection_campaign",
  "collection-dense-search": "archetype_collection_search_dense",
} as const;

const PDP_PROFILE_TO_ARCHETYPE = {
  "pdp-standard-commerce": "archetype_pdp_standard",
  "pdp-high-consideration": "archetype_pdp_high_consideration",
  "pdp-gallery-led": "archetype_pdp_gallery",
  "pdp-variant-led": "archetype_pdp_configurable",
} as const;

export const GENERIC_PDP_ARCHETYPE_ID = "archetype_pdp_generic_fallback" as const;

export function collectionArchetypeId(profileId: string): string {
  return (
    COLLECTION_PROFILE_TO_ARCHETYPE[profileId as keyof typeof COLLECTION_PROFILE_TO_ARCHETYPE] ?? ""
  );
}

export function productArchetypeId(profileId: string): string {
  return PDP_PROFILE_TO_ARCHETYPE[profileId as keyof typeof PDP_PROFILE_TO_ARCHETYPE] ?? "";
}

export type LegacyDynamicPresentationEntry = Readonly<{
  page: PageModel;
  section: SectionInstance;
}>;

function compactApprovedAssetSelections(
  entries: readonly LegacyDynamicPresentationEntry[],
  expectedComponent: "dynamicCollectionCommerce" | "dynamicProductDetail",
): DynamicCommerceApprovedAssetSelection[] {
  const definition = veskifyComponentDefinitionsV2.find(({ type }) => type === expectedComponent);
  if (!definition) {
    return fail(
      "invalid-presentation",
      `Registered ${expectedComponent} approved-asset authority is unavailable.`,
    );
  }
  const routeSelections = entries.map(({ page, section }) => {
    if (section.component !== expectedComponent) {
      return fail(
        "invalid-presentation",
        "A compact dynamic-commerce asset selection targets the wrong component family.",
      );
    }
    return (section.approvedAssetPlacements ?? [])
      .map((placement) => {
        const slot = definition.assetSlots.find(({ id }) => id === placement.assetSlotId);
        if (!slot || !slot.acceptedRoles.includes(placement.role)) {
          return fail(
            "invalid-presentation",
            "An approved dynamic-commerce asset is incompatible with its registered slot.",
          );
        }
        const presentation = (section.approvedAssetPresentations ?? []).find(
          (candidate) =>
            candidate.assetId === placement.assetId &&
            candidate.asset.id === placement.assetId &&
            candidate.role === placement.role &&
            candidate.revision === placement.assetRevision &&
            candidate.materialFingerprint === placement.materialFingerprint,
        );
        if (
          placement.pageId !== page.id ||
          placement.componentId !== section.id ||
          placement.componentType !== section.component ||
          !presentation
        ) {
          return fail(
            "invalid-presentation",
            "A dynamic-commerce approved asset has incomplete canonical placement authority.",
          );
        }
        return {
          assetSlotId: placement.assetSlotId,
          assetId: placement.assetId,
          role: placement.role,
          assetRevision: placement.assetRevision,
          materialFingerprint: placement.materialFingerprint,
          sourceReferenceId: placement.sourceReferenceId,
          ...(placement.sourceProvenanceKind
            ? { sourceProvenanceKind: placement.sourceProvenanceKind }
            : {}),
          ...(placement.placementContext ? { placementContext: placement.placementContext } : {}),
          ...(placement.placementPurpose ? { placementPurpose: placement.placementPurpose } : {}),
          ...(placement.reusePolicy ? { reusePolicy: placement.reusePolicy } : {}),
          ...(placement.affinity ? { affinity: placement.affinity } : {}),
          ...(placement.responsiveSourceAssetIds
            ? { responsiveSourceAssetIds: [...placement.responsiveSourceAssetIds] }
            : {}),
          required: placement.required,
          presentation: structuredClone(presentation),
        } satisfies DynamicCommerceApprovedAssetSelection;
      })
      .sort(
        (left, right) =>
          left.assetSlotId.localeCompare(right.assetSlotId) ||
          left.assetId.localeCompare(right.assetId),
      );
  });
  const reusable = routeSelections[0] ?? [];
  const reusableFingerprints = new Set(
    reusable
      .filter((selection) =>
        routeSelections.every((selections) =>
          selections.some(
            (candidate) => canonicalValueString(candidate) === canonicalValueString(selection),
          ),
        ),
      )
      .map((selection) => canonicalValueString(selection)),
  );
  const routesWithNonReusableRequiredAssets = entries.flatMap(({ page }, index) =>
    (routeSelections[index] ?? []).some(
      (selection) =>
        selection.required && !reusableFingerprints.has(canonicalValueString(selection)),
    )
      ? [page.id]
      : [],
  );
  if (routesWithNonReusableRequiredAssets.length > 0) {
    throw new DynamicCommerceMigrationError([
      {
        code: "conflicting-legacy-presentation",
        routeIds: routesWithNonReusableRequiredAssets,
        message:
          "Routes sharing one archetype have required approved assets that are not reusable across every route.",
      },
    ]);
  }
  return reusable
    .filter((selection) => reusableFingerprints.has(canonicalValueString(selection)))
    .map((selection) => structuredClone(selection));
}

export function collectionPresentation(
  profileId: string,
  legacySection?: SectionInstance,
  approvedAssetSelections: readonly DynamicCommerceApprovedAssetSelection[] = [],
): DynamicCommerceComponentPresentation {
  const plan = getCommercialCollectionSearchProfile(profileId);
  const authority = plan?.profile?.commercialCollectionSearch;
  if (!plan?.profile || !authority) fail("stale-profile", "Collection profile is unavailable.");
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: ["collection", "productList"],
  });
  const slot = materialized.slots[0];
  if (!slot || slot.component !== "dynamicCollectionCommerce") {
    fail("stale-profile", "Collection profile has no canonical dynamic component slot.");
  }
  let content = structuredClone(dynamicCollectionCommerceDefaultContent);
  if (legacySection) {
    const {
      collectionId: _collectionId,
      productIds: _productIds,
      canonicalRevision: _canonicalRevision,
      ...presentationContent
    } = legacySection.content;
    void _collectionId;
    void _productIds;
    void _canonicalRevision;
    content = dynamicCollectionCommerceContentSchema.parse(presentationContent);
  }
  const parsedProps = dynamicCollectionCommercePropsSchema.parse(
    legacySection?.props ?? {
      ...dynamicCollectionCommerceDefaultProps,
      gridDensity: authority.gridDensity,
      cardVariant: authority.productCardAnatomyId,
      filterLayout: authority.filterLayout,
      conciseAttributeLimit:
        authority.productCardAnatomyId === "standard"
          ? 3
          : authority.productCardAnatomyId === "horizontal"
            ? 2
            : authority.productCardAnatomyId === "imageFirst"
              ? 1
              : 0,
      showChildCollections: authority.childCollectionTreatment !== "omit",
    },
  );
  if (legacySection && parsedProps.cardVariant !== authority.productCardAnatomyId) {
    fail(
      "invalid-presentation",
      "The legacy collection product-card anatomy conflicts with its registered profile.",
    );
  }
  return {
    slotId: slot.slotId,
    component: "dynamicCollectionCommerce",
    variant: legacySection?.variant ?? slot.variant,
    anatomyId: authority.productCardAnatomyId,
    visible: legacySection?.visible ?? true,
    content,
    props: structuredClone(parsedProps),
    styleOverrides: structuredClone(
      legacySection?.styleOverrides ?? dynamicCollectionCommerceDefaultStyleOverrides,
    ),
    boundedParameters: structuredClone(slot.boundedParameters),
    approvedAssetSelections: approvedAssetSelections.map((selection) => structuredClone(selection)),
  };
}

export function productPresentation(
  profileId: string,
  legacySection?: SectionInstance,
  approvedAssetSelections: readonly DynamicCommerceApprovedAssetSelection[] = [],
): DynamicCommerceComponentPresentation {
  const plan = getCommercialPdpProfile(profileId);
  const authority = plan?.profile?.commercialProductDetail;
  if (!plan?.profile || !authority) fail("stale-profile", "PDP profile is unavailable.");
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: ["product"],
  });
  const slot = materialized.slots[0];
  if (!slot || slot.component !== "dynamicProductDetail") {
    fail("stale-profile", "PDP profile has no canonical dynamic component slot.");
  }
  let content = structuredClone(dynamicProductDetailDefaultContent);
  if (legacySection) {
    const {
      productId: _productId,
      relatedProductIds: _relatedProductIds,
      canonicalRevision: _canonicalRevision,
      ...presentationContent
    } = legacySection.content;
    void _productId;
    void _relatedProductIds;
    void _canonicalRevision;
    content = dynamicProductDetailContentSchema.parse(presentationContent);
  }
  const parsedProps = dynamicProductDetailPropsSchema.parse(
    legacySection?.props ?? {
      ...authority.dynamicProductDetailProps,
      relatedCardVariant: authority.relatedProductCardAnatomyId,
    },
  );
  if (legacySection && parsedProps.relatedCardVariant !== authority.relatedProductCardAnatomyId) {
    fail(
      "invalid-presentation",
      "The legacy related-product-card anatomy conflicts with its registered profile.",
    );
  }
  return {
    slotId: slot.slotId,
    component: "dynamicProductDetail",
    variant: legacySection?.variant ?? slot.variant,
    anatomyId: authority.relatedProductCardAnatomyId,
    visible: legacySection?.visible ?? true,
    content,
    props: structuredClone(parsedProps),
    styleOverrides: structuredClone(
      legacySection?.styleOverrides ?? dynamicProductDetailDefaultStyleOverrides,
    ),
    boundedParameters: structuredClone(slot.boundedParameters),
    approvedAssetSelections: approvedAssetSelections.map((selection) => structuredClone(selection)),
  };
}

export function createCollectionArchetype(
  profileId: string,
  legacyEntries: readonly LegacyDynamicPresentationEntry[] = [],
  supportsSearch = ["collection-catalogue-comparison", "collection-dense-search"].includes(
    profileId,
  ),
): DynamicCommerceCollectionSearchArchetype {
  const plan = getCommercialCollectionSearchProfile(profileId);
  const profile = plan?.profile;
  const authority = profile?.commercialCollectionSearch;
  if (!plan || !profile || !authority) {
    return fail("stale-profile", `Collection profile ${profileId} is unavailable.`);
  }
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: ["collection", "productList"],
  });
  const id = collectionArchetypeId(profileId);
  if (!id) return fail("stale-profile", `Collection profile ${profileId} has no archetype ID.`);
  return {
    id,
    archetypeVersion: DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION,
    family: "collection-search" as const,
    supportedContexts: supportsSearch
      ? (["collection", "search"] as const)
      : (["collection"] as const),
    profile: {
      profileId,
      profileVersion: profile.version,
      fingerprint: materialized.fingerprint,
    },
    compatibleSharedFrameProfileIds: [...authority.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: authority.defaultSharedFrameProfileId,
    designDnaNarrowing: structuredClone(authority.designDnaNarrowing),
    componentPresentations: [
      collectionPresentation(
        profileId,
        legacyEntries[0]?.section,
        compactApprovedAssetSelections(legacyEntries, "dynamicCollectionCommerce"),
      ),
    ],
    responsivePosture: authority.responsiveArchitecture,
    artDirectionPosture: {
      imagePosture: authority.designDnaNarrowing.imagePosture[0],
      ratio: "natural",
      crop: authority.designDnaNarrowing.imagePosture[0] === "contained" ? "contain" : "editorial",
      overlay: "none",
    },
    fallbackBehavior: "use-family-fallback",
    commerceBindingPolicy: "runtime-collection-membership",
  };
}

export function createProductArchetype(
  profileId: string,
  legacyEntries: readonly LegacyDynamicPresentationEntry[] = [],
  generic = false,
): DynamicCommerceProductDetailArchetype {
  const plan = getCommercialPdpProfile(profileId);
  const profile = plan?.profile;
  const authority = profile?.commercialProductDetail;
  if (!plan || !profile || !authority) {
    return fail("stale-profile", `PDP profile ${profileId} is unavailable.`);
  }
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: ["product"],
  });
  const id = generic ? GENERIC_PDP_ARCHETYPE_ID : productArchetypeId(profileId);
  if (!id) return fail("stale-profile", `PDP profile ${profileId} has no archetype ID.`);
  return {
    id,
    archetypeVersion: DYNAMIC_COMMERCE_PRESENTATION_CONTRACT_VERSION,
    family: "product-detail" as const,
    profile: {
      profileId,
      profileVersion: profile.version,
      fingerprint: materialized.fingerprint,
    },
    compatibleSharedFrameProfileIds: [...authority.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: authority.defaultSharedFrameProfileId,
    designDnaNarrowing: structuredClone(authority.designDnaNarrowing),
    componentPresentations: [
      productPresentation(
        profileId,
        legacyEntries[0]?.section,
        compactApprovedAssetSelections(legacyEntries, "dynamicProductDetail"),
      ),
    ],
    responsivePosture: authority.responsiveArchitecture,
    artDirectionPosture: {
      imagePosture: authority.designDnaNarrowing.imagePosture[0],
      ratio: authority.designDnaNarrowing.imagePosture[0] === "contained" ? "portrait" : "natural",
      crop: authority.designDnaNarrowing.imagePosture[0] === "contained" ? "contain" : "editorial",
      overlay: "none",
    },
    fallbackBehavior: "use-family-fallback",
    optionArchitecture: "generic-canonical-options",
    commerceBindingPolicy: "runtime-protected-product",
  };
}
