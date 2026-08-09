import {
  commercialHomepageProfileIdSchema,
  getCommercialHomepageProfile,
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
import { P10B09HomepageProofClient } from "./homepage-proof-client";

const directionByProfile = {
  "homepage-editorial-storytelling": "premiumEditorial",
  "homepage-commerce-led-discovery": "modernTechnical",
  "homepage-minimal-brand-commerce": "warmApproachable",
  "homepage-campaign-led": "premiumEditorial",
  "homepage-collection-gateway": "modernTechnical",
  "homepage-high-consideration": "warmApproachable",
} as const;

export default async function P10B09HomepageProofPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const query = await searchParams;
  const parsed = commercialHomepageProfileIdSchema.safeParse(query.profile);
  const profileId = parsed.success ? parsed.data : "homepage-editorial-storytelling";
  const profile = getCommercialHomepageProfile(profileId)!;
  const authority = profile.profile!.commercialHomepage!;
  const directionId = directionByProfile[profileId];
  const fixture = createP905aFreshMerchantFixture(directionId);
  const draft = applyCommercialSharedFrame(
    fixture.planningInput.draft,
    authority.defaultSharedFrameProfileId,
  );
  const planningInput = { ...fixture.planningInput, draft };
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId,
    homepageProfileId: profileId,
  });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const snapshot = materializeWholeStorefrontRuntimeSnapshot({
    runtime: proposal.proposedStorefront,
    planningInput,
    approvedAssetPresentations: fixture.assetPresentations,
  });
  const homepage = snapshot.pages.find((page) => page.type === "home")!;
  const homepageMaterialization = plan.pageBlueprintMaterializations.find(
    (entry) => entry.pageType === "home",
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
    <P10B09HomepageProofClient
      catalogue={fixture.aggregate.catalogue}
      componentAnatomyFingerprint={`homepage-components-${canonicalValueFingerprint(
        homepage.sections.map((section) => ({
          component: section.component,
          variant: section.variant,
        })),
      )}`}
      designDnaFingerprint={`design-dna-${canonicalValueFingerprint(snapshot.brandSystem)}`}
      evidenceReferences={evidenceReferences}
      profileId={profileId}
      profileVersion={profile.profile!.version}
      productCardAnatomyId={authority.productCardAnatomyId}
      materializationFingerprint={homepageMaterialization.fingerprint}
      snapshot={snapshot}
      snapshotFingerprint={canonicalStorefrontContentFingerprint(snapshot)}
      structuralFingerprint={authority.structuralFingerprint}
    />
  );
}
