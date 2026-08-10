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
import {
  dynamicCollectionCommerceBridgeDefinition,
  dynamicProductDetailBridgeDefinition,
  validateRegisteredSnapshot,
} from "@/components/registry";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  storefrontSnapshotSchema,
  validateCanonicalStorefrontSiteMap,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
} from "./planner";
import type { WholeStorefrontGenerationPlan, WholeStorefrontPlanningInput } from "./contract";
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
    props: structuredClone(authority.dynamicProductDetailProps),
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
    materializationIdPrefix?: string;
  }>,
): CompleteStorefrontMaterialization {
  const materializationIdPrefix = input.materializationIdPrefix ?? "complete";
  const siteMap = materializeStorefrontSiteMap({
    decision: input.siteMapDecision,
    baseSnapshot: input.planningInput.draft,
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
      if (
        ["search-results", "collection"].includes(page.pageFamily?.familyId ?? "") &&
        page.sections.length === 0
      ) {
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
      if (page.pageFamily?.familyId === "product-detail" && page.sections.length === 0) {
        const productId =
          page.pageFamily.commerceContext.kind === "product"
            ? page.pageFamily.commerceContext.productId
            : null;
        if (!productId) {
          throw new Error("A product-detail page requires canonical product context.");
        }
        return {
          ...page,
          sections: [
            productSection(
              productId,
              input.planningInput.catalogue.products
                .map(({ id }) => id)
                .filter((id) => id !== productId),
              target.canonicalCommerceFingerprint,
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
