import type { HumanCommercialReviewRecord } from "@/application/human-commercial-review";
import { canonicalValueFingerprint } from "@/domain/storefront";
import type { CoordinatedDirectionResult } from "./coordinated-directions";
import { compareStorefrontDiversity } from "./diversity";

export const P10B16_DIRECTION_EVIDENCE_MANIFEST_VERSION = "1.0.0" as const;

export function createP10B16DirectionEvidenceManifest(input: {
  outcomes: Readonly<Record<string, readonly CoordinatedDirectionResult[]>>;
  reviews: readonly Readonly<{ directionId: string; record: HumanCommercialReviewRecord }>[];
}) {
  const outcomes = Object.entries(input.outcomes).flatMap(([directionId, values]) =>
    values.map((value, alternative) => ({
      directionId,
      alternative,
      directionFingerprint: value.directionFingerprint,
      diversityFingerprint: value.diversity.structuralFingerprint,
      snapshotFingerprint: value.synthesis.materialization.snapshotFingerprint,
      pageSetFingerprint: value.decision.siteMap.pageSetFingerprint,
      frameProfileId: value.decision.sharedFrame.profileId,
      homepageProfileId: value.decision.commercialProfiles.homepageProfileId,
      collectionProfileId: value.decision.commercialProfiles.collectionProfileId,
      pdpProfileId: value.decision.commercialProfiles.pdpProfileId,
    })),
  );
  const pairwise = Object.entries(input.outcomes).flatMap(([directionId, values]) =>
    values.flatMap((left, leftIndex) =>
      values.slice(leftIndex + 1).map((right, offset) => ({
        left: `${directionId}:${leftIndex}`,
        right: `${directionId}:${leftIndex + offset + 1}`,
        classification: compareStorefrontDiversity(left.diversity, right.diversity).classification,
      })),
    ),
  );
  const reviewFingerprints = input.reviews.map(({ directionId, record }) => ({
    directionId,
    reviewId: record.reviewId,
    reviewFingerprint: record.fingerprint,
  }));
  const material = {
    version: P10B16_DIRECTION_EVIDENCE_MANIFEST_VERSION,
    generatedAt: "2026-08-10T17:00:00.000Z",
    providerCalls: 0 as const,
    outcomes,
    pairwise,
    reviewFingerprints,
  };
  return Object.freeze({
    ...material,
    fingerprint: `p10b16-direction-evidence-${canonicalValueFingerprint(material)}`,
  });
}
