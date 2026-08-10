import type { ContentSupportFactAuthority } from "@/application/content-support-pages";
import {
  type PageFactEvidenceAuthority,
  type StorefrontSiteMapDecision,
} from "@/application/storefront-site-map";
import {
  materializeCompleteStorefrontSelection,
  type ApprovedAssetPresentation,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import type { StorefrontSnapshot } from "@/domain/storefront";

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
  plan: ReturnType<typeof materializeCompleteStorefrontSelection>["plan"];
  proposal: ReturnType<typeof materializeCompleteStorefrontSelection>["proposal"];
  siteMapFingerprint: string;
  snapshotFingerprint: string;
}>;

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
  return materializeCompleteStorefrontSelection({
    ...input,
    directionId: P10B14_PREMIUM_EDITORIAL_SELECTION.directionId,
    materializationIdPrefix: "p10b14",
  });
}
