import {
  commercialContentSupportProfileIdSchema,
  getCommercialContentSupportProfile,
} from "@/application/storefront-templates";
import { createP10B12ContentSupportProof } from "@/data/demo/p10b-12-content-support-proof";
import { contentSupportPageFamilyIdSchema } from "@/domain/storefront";
import { P10B12ContentSupportProofClient } from "./proof-client";

export default async function P10B12ContentSupportProofPage({
  searchParams,
}: {
  searchParams: Promise<{
    profile?: string;
    family?: string;
    locale?: string;
    media?: string;
    density?: string;
    action?: string;
  }>;
}) {
  const query = await searchParams;
  const parsed = commercialContentSupportProfileIdSchema.safeParse(query.profile);
  const profileId = parsed.success ? parsed.data : "content-about-story";
  const profile = getCommercialContentSupportProfile(profileId)!;
  if (!profile.profile?.commercialContentSupport)
    throw new Error(
      "The content/support proof profile must declare its content-support authority.",
    );
  const requestedFamily = contentSupportPageFamilyIdSchema.safeParse(query.family);
  const familyId =
    requestedFamily.success &&
    profile.profile.commercialContentSupport.pageFamilyIds.includes(requestedFamily.data)
      ? requestedFamily.data
      : profile.profile.commercialContentSupport.pageFamilyIds[0];
  const activeLocale = query.locale === "fi" ? "fi" : "en";
  const campaignActionAuthority =
    query.action === "paired" || query.action === "label-only" ? query.action : "absent";
  const proof = createP10B12ContentSupportProof({
    familyId,
    profileId,
    approvedMedia: query.media === "approved",
    sparse: query.density === "sparse",
    campaignActionAuthority,
  });
  return (
    <P10B12ContentSupportProofClient
      activeLocale={activeLocale}
      catalogueId="aurum"
      proof={proof}
    />
  );
}
