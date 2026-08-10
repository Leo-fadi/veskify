import { canonicalValueFingerprint } from "@/domain/storefront";
import type { BoundedStorefrontSynthesisResult } from "./synthesizer";

export type P10B15BrowserEvidence = Readonly<{
  intent: string;
  route: string;
  viewport: 375 | 768 | 1024 | 1440;
  reference: string;
  fingerprint: string;
}>;

export type P10B15SynthesisEvidenceManifest = Readonly<{
  version: "1.0.0";
  fixtureId: string;
  outcomes: readonly Readonly<{
    intent: string;
    synthesisFingerprint: string;
    snapshotFingerprint: string;
    siteMapFingerprint: string;
    frameFingerprint: string;
    profileFingerprints: readonly string[];
  }>[];
  browserEvidence: readonly P10B15BrowserEvidence[];
  humanReviews: readonly Readonly<{
    intent: string;
    reviewId: string;
    fingerprint: string;
    outcome: "passed";
  }>[];
  fingerprint: string;
}>;

export function createP10B15SynthesisEvidenceManifest(
  input: Readonly<{
    fixtureId: string;
    outcomes: Readonly<Record<string, BoundedStorefrontSynthesisResult>>;
    browserEvidence: readonly P10B15BrowserEvidence[];
    humanReviews: readonly Readonly<{
      intent: string;
      reviewId: string;
      fingerprint: string;
      outcome: "passed";
    }>[];
  }>,
): P10B15SynthesisEvidenceManifest {
  const outcomes = Object.entries(input.outcomes)
    .map(([intent, outcome]) => ({
      intent,
      synthesisFingerprint: outcome.decision.synthesisFingerprint,
      snapshotFingerprint: outcome.materialization.snapshotFingerprint,
      siteMapFingerprint: outcome.materialization.siteMapFingerprint,
      frameFingerprint: outcome.decision.sharedFrame.authorityFingerprint,
      profileFingerprints: outcome.decision.pageProfileSelections
        .map(({ profileFingerprint }) => profileFingerprint)
        .sort(),
    }))
    .sort((left, right) => left.intent.localeCompare(right.intent));
  const material = {
    version: "1.0.0" as const,
    fixtureId: input.fixtureId,
    outcomes,
    browserEvidence: [...input.browserEvidence]
      .map((entry) => structuredClone(entry))
      .sort(
        (left, right) =>
          left.intent.localeCompare(right.intent) ||
          left.route.localeCompare(right.route) ||
          left.viewport - right.viewport,
      ),
    humanReviews: [...input.humanReviews]
      .map((entry) => structuredClone(entry))
      .sort((left, right) => left.intent.localeCompare(right.intent)),
  };
  return Object.freeze({
    ...material,
    fingerprint: `p10b15-synthesis-evidence-${canonicalValueFingerprint(material)}`,
  });
}
