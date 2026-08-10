import {
  commercialContentSupportProfileIdSchema,
  getCommercialContentSupportProfile,
} from "@/application/storefront-templates";
import { createP10B12ContentSupportProof } from "@/data/demo/p10b-12-content-support-proof";
import { P10B12ContentSupportProofClient } from "./proof-client";

export default async function P10B12ContentSupportProofPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const query = await searchParams;
  const parsed = commercialContentSupportProfileIdSchema.safeParse(query.profile);
  const profileId = parsed.success ? parsed.data : "content-about-story";
  const profile = getCommercialContentSupportProfile(profileId)!;
  if (!profile.profile?.commercialContentSupport)
    throw new Error(
      "The content/support proof profile must declare its content-support authority.",
    );
  const familyId = profile.profile.commercialContentSupport.pageFamilyIds[0];
  const proof = createP10B12ContentSupportProof({ familyId, profileId });
  return <P10B12ContentSupportProofClient catalogueId="aurum" proof={proof} />;
}
