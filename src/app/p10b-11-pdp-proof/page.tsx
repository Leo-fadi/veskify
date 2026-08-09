import {
  commercialPdpProfileIdSchema,
  getCommercialPdpProfile,
} from "@/application/storefront-templates";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  materializeWholeStorefrontRuntimeSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import {
  P9_05A_COMPLEX_PRODUCT_ID,
  createP905aFreshMerchantFixture,
} from "@/data/demo/p9-05a-fresh-store-generation";
import {
  applyCommercialSharedFrame,
  canonicalStorefrontContentFingerprint,
} from "@/domain/storefront";
import { P10B11PdpProofClient } from "./pdp-proof-client";

const directionByProfile = {
  "pdp-standard-commerce": "modernTechnical",
  "pdp-high-consideration": "premiumEditorial",
  "pdp-gallery-led": "premiumEditorial",
  "pdp-variant-led": "modernTechnical",
} as const;

export default async function P10B11PdpProofPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const query = await searchParams;
  const parsed = commercialPdpProfileIdSchema.safeParse(query.profile);
  const profileId = parsed.success ? parsed.data : "pdp-standard-commerce";
  const profile = getCommercialPdpProfile(profileId)!;
  const authority = profile.profile!.commercialProductDetail!;
  const directionId = directionByProfile[profileId];
  const fixture = createP905aFreshMerchantFixture(directionId);
  const draft = applyCommercialSharedFrame(
    fixture.planningInput.draft,
    authority.defaultSharedFrameProfileId,
  );
  const planningInput = { ...fixture.planningInput, draft };
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId,
    pdpProfileId: profileId,
  });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const snapshot = materializeWholeStorefrontRuntimeSnapshot({
    runtime: proposal.proposedStorefront,
    planningInput,
    approvedAssetPresentations: fixture.assetPresentations,
  });
  const product = fixture.aggregate.catalogue.products.find(
    (entry) => entry.id === P9_05A_COMPLEX_PRODUCT_ID,
  )!;
  const productPage = snapshot.pages.find((page) => page.type === "product")!;
  const materialization = plan.pageBlueprintMaterializations.find(
    (entry) => entry.pageType === "product",
  )!;
  return (
    <P10B11PdpProofClient
      aggregate={fixture.aggregate}
      materializationFingerprint={materialization.fingerprint}
      productId={product.id}
      productPage={productPage}
      profileId={profileId}
      profileVersion={profile.profile!.version}
      responsiveArchitecture={authority.responsiveArchitecture}
      snapshot={snapshot}
      snapshotFingerprint={canonicalStorefrontContentFingerprint(snapshot)}
      structuralFingerprint={authority.structuralFingerprint}
    />
  );
}
