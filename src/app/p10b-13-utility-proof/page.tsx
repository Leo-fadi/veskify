import {
  commercialUtilityProfileIdSchema,
  getCommercialUtilityProfile,
  materializeCommerceUtilityPage,
} from "@/application/storefront-templates";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  applyCommercialSharedFrame,
  canonicalValueFingerprint,
  getPageFamilyDefinition,
  PAGE_FAMILY_AUTHORITY_VERSION,
} from "@/domain/storefront";
import { P10B13UtilityProofClient } from "./utility-proof-client";
import type { PageModel } from "@/domain/storefront";

const familyFor = (state: string) =>
  state === "cart"
    ? "cart"
    : state === "checkout"
      ? "checkout"
      : state === "no-results"
        ? "no-results"
        : state === "empty"
          ? "empty-state"
          : state === "error"
            ? "error-state"
            : "not-found";

export default async function P10B13UtilityProofPage({
  searchParams,
}: {
  searchParams: Promise<{
    profile?: string;
    scenario?: string;
    locale?: string;
    capabilities?: string;
    handler?: string;
  }>;
}) {
  const query = await searchParams;
  const parsed = commercialUtilityProfileIdSchema.safeParse(query.profile);
  const profileId = parsed.success ? parsed.data : "commerce-utility-cart";
  const profile = getCommercialUtilityProfile(profileId)!;
  const authority = profile.profile!.commercialUtility!;
  const fixture = createP905aFreshMerchantFixture("modernTechnical");
  const draft = applyCommercialSharedFrame(
    fixture.planningInput.draft,
    authority.defaultSharedFrameProfileId,
  );
  const familyId = familyFor(authority.state);
  const definition = getPageFamilyDefinition(familyId);
  const basePage: PageModel = {
    id: `page_${canonicalValueFingerprint({ profileId, familyId }).slice(-24)}`,
    type: profile.pageType,
    slug:
      familyId === "cart"
        ? "/cart"
        : familyId === "checkout"
          ? "/checkout"
          : familyId === "no-results"
            ? "/states/no-results"
            : familyId === "empty-state"
              ? "/states/empty"
              : familyId === "error-state"
                ? "/states/error"
                : "/404",
    title: { en: "Storefront utility", fi: "Kaupan apunäkymä" },
    seo: {
      title: { en: "Storefront utility", fi: "Kaupan apunäkymä" },
      metaDescription: { en: "Storefront utility presentation", fi: "Kaupan apunäkymä" },
    },
    sections: [],
    pageFamily: {
      familyId,
      familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
      profileId,
      profileVersion: profile.profile!.version,
      localeCoverage: ["en", "fi"],
      sharedFrameId: "blueprint-shared-storefront-frame",
      sharedFrameVersion: "1.0.0",
      commerceContext: { kind: "none" },
      commerceOperationAuthority: definition.commerceOperationAuthority,
      navigationAreas: [],
      evidenceReferences: [],
    },
  };
  const utilityPage = materializeCommerceUtilityPage(basePage, profileId);
  const snapshot = { ...draft, pages: [...draft.pages, utilityPage] };
  return (
    <P10B13UtilityProofClient
      catalogue={fixture.aggregate.catalogue}
      activeLocale={query.locale === "fi" ? "fi" : "en"}
      actionCapabilities={query.capabilities === "none" ? "none" : "supported"}
      handlerAuthority={query.handler === "absent" ? "absent" : "present"}
      profile={profile.profile!}
      scenario={query.scenario}
      snapshot={snapshot}
      utilityPageId={utilityPage.id}
    />
  );
}
