import {
  commercialSharedFrameProfileIdSchema,
  type CommercialSharedFrameProfileId,
} from "@/domain/storefront";
import { localeSchema } from "@/domain/shared";
import { P10B06FrameProofClient } from "./frame-proof-client";

export default async function P10B06FrameProofPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string; dna?: string; locale?: string }>;
}) {
  const query = await searchParams;
  const parsedProfile = commercialSharedFrameProfileIdSchema.safeParse(query.profile);
  const profileId: CommercialSharedFrameProfileId = parsedProfile.success
    ? parsedProfile.data
    : "editorial-masthead";
  const parsedLocale = localeSchema.safeParse(query.locale);
  return (
    <P10B06FrameProofClient
      dna={query.dna}
      locale={parsedLocale.success ? parsedLocale.data : "en"}
      profileId={profileId}
    />
  );
}
