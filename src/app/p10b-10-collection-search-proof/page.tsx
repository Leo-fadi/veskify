import {
  commercialCollectionSearchProfileIdSchema,
  getCommercialCollectionSearchProfile,
} from "@/application/storefront-templates";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  materializeWholeStorefrontRuntimeSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
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
  const draft = applyCommercialSharedFrame(
    fixture.planningInput.draft,
    authority.defaultSharedFrameProfileId,
  );
  const planningInput = { ...fixture.planningInput, draft };
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
