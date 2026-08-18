import {
  commercialCollectionSearchProfileIdSchema,
  getCommercialCollectionSearchProfile,
} from "@/application/storefront-templates";
import {
  approvedGenerationAssetContextSchema,
  createApprovedGenerationAssetContextFingerprint,
} from "@/application/ai-storefront-generation";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  materializeWholeStorefrontRuntimeSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import {
  createP905aFreshMerchantFixture,
  P9_05A_COLLECTION_ID,
} from "@/data/demo/p9-05a-fresh-store-generation";
import {
  applyCommercialSharedFrame,
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
} from "@/domain/storefront";
import { P10B10CollectionSearchProofClient } from "./collection-search-proof-client";

const directionByProfile = {
  "collection-editorial-discovery": "premiumEditorial",
  "collection-catalogue-comparison": "modernTechnical",
  "collection-campaign-led-discovery": "premiumEditorial",
  "collection-dense-search": "modernTechnical",
} as const;

function approvedAssetContextForProfile(
  fixture: ReturnType<typeof createP905aFreshMerchantFixture>,
  profileId: keyof typeof directionByProfile,
) {
  if (profileId !== "collection-campaign-led-discovery") return fixture.assetContext;
  const assets = fixture.assetContext.assets.map((asset) =>
    asset.assetId === "asset_lumo_story"
      ? {
          ...asset,
          presentation: {
            ...asset.presentation,
            placementAuthority: {
              purposes: ["editorial-story", "collection-campaign"] as (
                "editorial-story" | "collection-campaign"
              )[],
              reusePolicy: "bounded-editorial" as const,
              responsiveSourceGroupId: null,
              viewportApplicability: ["mobile", "tablet", "desktop", "wide"] as (
                "mobile" | "tablet" | "desktop" | "wide"
              )[],
              collectionIds: [P9_05A_COLLECTION_ID],
              priority: 0,
            },
          },
        }
      : asset,
  );
  const context = {
    briefId: fixture.assetContext.briefId,
    briefRevision: fixture.assetContext.briefRevision,
    approvedEvidenceFingerprint: fixture.assetContext.approvedEvidenceFingerprint,
    assetReviewFingerprint: fixture.assetContext.assetReviewFingerprint,
    assets,
  };
  return approvedGenerationAssetContextSchema.parse({
    ...context,
    fingerprint: createApprovedGenerationAssetContextFingerprint(context),
  });
}

export default async function P10B10CollectionSearchProofPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const query = await searchParams;
  const parsed = commercialCollectionSearchProfileIdSchema.safeParse(query.profile);
  const profileId = parsed.success ? parsed.data : "collection-editorial-discovery";
  const profile = getCommercialCollectionSearchProfile(profileId)!;
  const authority = profile.profile!.commercialCollectionSearch!;
  const directionId = directionByProfile[profileId];
  const fixture = createP905aFreshMerchantFixture(directionId);
  const approvedAssetContext = approvedAssetContextForProfile(fixture, profileId);
  const draft = applyCommercialSharedFrame(
    fixture.planningInput.draft,
    authority.defaultSharedFrameProfileId,
  );
  const planningInput = { ...fixture.planningInput, draft, approvedAssetContext };
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId,
    collectionProfileId: profileId,
  });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const snapshot = materializeWholeStorefrontRuntimeSnapshot({
    runtime: proposal.proposedStorefront,
    planningInput,
    approvedAssetPresentations: fixture.assetPresentations,
  });
  const materialization = plan.pageBlueprintMaterializations.find(
    (entry) => entry.pageType === "collection",
  )!;
  const evidenceReferences = [
    {
      source: "merchant-approved" as const,
      authorityId: fixture.brief.id,
      revision: String(fixture.brief.revision),
      status: "approved" as const,
      approvalAuthorityId: fixture.brief.approval.actorId!,
      approvalFingerprint: fixture.brief.approvedEvidenceFingerprint!,
    },
  ];
  return (
    <P10B10CollectionSearchProofClient
      aggregate={fixture.aggregate}
      catalogue={fixture.aggregate.catalogue}
      componentAnatomyFingerprint={`collection-components-${canonicalValueFingerprint(
        snapshot.pages
          .find((page) => page.type === "collection")!
          .sections.map((section) => ({ component: section.component, variant: section.variant })),
      )}`}
      designDnaFingerprint={`design-dna-${canonicalValueFingerprint(snapshot.brandSystem)}`}
      evidenceReferences={evidenceReferences}
      materializationFingerprint={materialization.fingerprint}
      profileId={profileId}
      profileVersion={profile.profile!.version}
      snapshot={snapshot}
      snapshotFingerprint={canonicalStorefrontContentFingerprint(snapshot)}
      structuralFingerprint={authority.structuralFingerprint}
    />
  );
}
