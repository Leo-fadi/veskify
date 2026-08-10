import {
  materializeContentSupportSnapshot,
  type ContentSupportFactAuthority,
} from "@/application/content-support-pages";
import {
  materializeStorefrontSiteMap,
  type PageFactEvidenceAuthority,
  type StorefrontSiteMapDecision,
} from "@/application/storefront-site-map";
import {
  getCommercialCollectionSearchProfile,
  getCommercialPdpProfile,
} from "@/application/storefront-templates";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
  type ApprovedAssetPresentation,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  materializeWholeStorefrontRuntimeSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import {
  dynamicCollectionCommerceBridgeDefinition,
  dynamicProductDetailBridgeDefinition,
  validateRegisteredSnapshot,
} from "@/components/registry";
import {
  canonicalStorefrontContentFingerprint,
  storefrontSnapshotSchema,
  validateCanonicalStorefrontSiteMap,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";

export const P10B14_PREMIUM_EDITORIAL_SELECTION = Object.freeze({
  directionId: "premiumEditorial" as const,
  sharedFrameProfileId: "centered-minimal" as const,
  homepageProfileId: "homepage-editorial-storytelling" as const,
  collectionProfileId: "collection-editorial-discovery" as const,
  searchProfileId: "collection-dense-search" as const,
  pdpProfileId: "pdp-high-consideration" as const,
});

export type P10B14PremiumEditorialSlice = Readonly<{
  snapshot: StorefrontSnapshot;
  planningInput: WholeStorefrontPlanningInput;
  plan: ReturnType<typeof createWholeStorefrontGenerationPlan>;
  proposal: ReturnType<typeof compileWholeStorefrontProposal>;
  siteMapFingerprint: string;
  snapshotFingerprint: string;
}>;

function collectionSection(
  snapshot: StorefrontSnapshot,
  planningInput: WholeStorefrontPlanningInput,
  profileId:
    | typeof P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId
    | typeof P10B14_PREMIUM_EDITORIAL_SELECTION.searchProfileId,
): SectionInstance {
  const collection = planningInput.catalogue.collections[0];
  const profile = getCommercialCollectionSearchProfile(profileId);
  const authority = profile?.profile?.commercialCollectionSearch;
  const slot = profile?.slots[0];
  if (!collection || !authority || !slot) {
    throw new Error(
      "The Premium Editorial slice requires registered search and collection authority.",
    );
  }
  const canonicalRevision = createWholeStorefrontGenerationTarget({
    ...planningInput,
    draft: snapshot,
  }).canonicalCommerceFingerprint;
  return {
    id: `section_p10b14_${profileId.replaceAll("-", "_")}`,
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

function productSeedSection(
  productId: string,
  relatedProductIds: readonly string[],
  canonicalRevision: string,
): SectionInstance {
  const profile = getCommercialPdpProfile(P10B14_PREMIUM_EDITORIAL_SELECTION.pdpProfileId);
  const authority = profile?.profile?.commercialProductDetail;
  if (!authority) throw new Error("The Premium Editorial slice requires registered PDP authority.");
  return {
    id: `section_p10b14_product_${productId.replaceAll("_", "-")}`,
    component: "dynamicProductDetail",
    variant: authority.dynamicProductDetailVariant,
    visible: true,
    content: {
      ...structuredClone(dynamicProductDetailBridgeDefinition.defaultContent),
      productId,
      relatedProductIds: [...relatedProductIds],
      canonicalRevision,
    },
    props: structuredClone(authority.dynamicProductDetailProps),
    approvedAssetPlacements: [],
    approvedAssetPresentations: [],
  };
}

/**
 * Converges the existing P10B-01–13 authorities into one canonical storefront.
 * The supplied site-map/evidence decisions remain the input authority; this function adds no
 * template, registry, page graph, commerce model, or renderer.
 */
export function materializeP10B14PremiumEditorialStorefront(
  input: Readonly<{
    planningInput: WholeStorefrontPlanningInput;
    siteMapDecision: StorefrontSiteMapDecision;
    pageEvidenceAuthority: PageFactEvidenceAuthority;
    contentFactAuthority: ContentSupportFactAuthority;
    approvedAssetPresentations: readonly ApprovedAssetPresentation[];
  }>,
): P10B14PremiumEditorialSlice {
  const siteMap = materializeStorefrontSiteMap({
    decision: input.siteMapDecision,
    baseSnapshot: input.planningInput.draft,
    catalogue: input.planningInput.catalogue,
    evidenceAuthority: input.pageEvidenceAuthority,
  });

  let snapshot = siteMap.snapshot;
  for (const page of snapshot.pages) {
    if (
      page.pageFamily &&
      [
        "about",
        "contact",
        "faq",
        "shipping-information",
        "returns-information",
        "policy-legal",
        "campaign-editorial",
        "generic-content",
        "store-locations",
      ].includes(page.pageFamily.familyId)
    ) {
      snapshot = materializeContentSupportSnapshot({
        snapshot,
        pageId: page.id,
        factAuthority: input.contentFactAuthority,
      }).snapshot;
    }
  }

  const target = createWholeStorefrontGenerationTarget({
    ...input.planningInput,
    draft: snapshot,
  });
  snapshot = storefrontSnapshotSchema.parse({
    ...snapshot,
    pages: snapshot.pages.map((page) => {
      if (page.pageFamily?.familyId === "search-results") {
        return {
          ...page,
          sections: [
            collectionSection(
              snapshot,
              input.planningInput,
              P10B14_PREMIUM_EDITORIAL_SELECTION.searchProfileId,
            ),
          ],
        };
      }
      if (page.pageFamily?.familyId === "collection" && page.sections.length === 0) {
        return {
          ...page,
          sections: [
            collectionSection(
              snapshot,
              input.planningInput,
              P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
            ),
          ],
        };
      }
      if (page.pageFamily?.familyId === "product-detail" && page.sections.length === 0) {
        const productId =
          page.pageFamily.commerceContext.kind === "product"
            ? page.pageFamily.commerceContext.productId
            : null;
        if (!productId)
          throw new Error("A product-detail page requires canonical product context.");
        return {
          ...page,
          sections: [
            productSeedSection(
              productId,
              input.planningInput.catalogue.products
                .map(({ id }) => id)
                .filter((id) => id !== productId),
              target.canonicalCommerceFingerprint,
            ),
          ],
        };
      }
      return page;
    }),
  });

  const planningInput = {
    ...structuredClone(input.planningInput),
    draft: snapshot,
  } satisfies WholeStorefrontPlanningInput;
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
    homepageProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.homepageProfileId,
    collectionProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.collectionProfileId,
    pdpProfileId: P10B14_PREMIUM_EDITORIAL_SELECTION.pdpProfileId,
  });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const materialized = materializeWholeStorefrontRuntimeSnapshot({
    runtime: proposal.proposedStorefront,
    planningInput,
    approvedAssetPresentations: input.approvedAssetPresentations,
  });
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
    siteMapFingerprint: siteMap.fingerprint,
    snapshotFingerprint: canonicalStorefrontContentFingerprint(materialized),
  });
}
