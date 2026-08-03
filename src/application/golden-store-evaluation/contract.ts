import { wholeStorefrontPageBlueprintMaterializationSchema } from "@/application/whole-storefront-generation-plan";
import type { StorefrontSnapshot } from "@/domain/storefront";
import type { z } from "zod";

export type WholeStorefrontPageBlueprintMaterialization = z.infer<
  typeof wholeStorefrontPageBlueprintMaterializationSchema
>;

/**
 * Versioned, renderer-independent evidence for a deterministic golden-store
 * evaluation. This is a test artifact, never a second storefront model.
 */
export const GOLDEN_STORE_EVALUATION_CONTRACT_VERSION = "1.0.0" as const;

export const goldenStoreEvaluationSurfaces = [
  "shared-frame",
  "home",
  "collection",
  "product",
] as const;
export const goldenStoreEvaluationLifecycleStates = [
  "baseline",
  "proposed-reviewable",
  "accepted",
  "saved-reloaded",
  "published",
] as const;
export const goldenStoreEvaluationLocales = ["en", "fi"] as const;
export const goldenStoreEvaluationViewports = [375, 768, 1024, 1440] as const;

export type GoldenStoreEvaluationSurface = (typeof goldenStoreEvaluationSurfaces)[number];
export type GoldenStoreEvaluationLifecycleState =
  (typeof goldenStoreEvaluationLifecycleStates)[number];
export type GoldenStoreEvaluationLocale = (typeof goldenStoreEvaluationLocales)[number];
export type GoldenStoreEvaluationViewport = (typeof goldenStoreEvaluationViewports)[number];

export type GoldenStoreLifecycleEvidence = Readonly<{
  state: GoldenStoreEvaluationLifecycleState;
  snapshot: StorefrontSnapshot;
  revision: number;
  snapshotFingerprint: string;
  protectedCommerceFingerprint: string;
  approvedAssetFingerprint: string;
  navigationFingerprint: string;
  rendererOutputFingerprint: string | null;
}>;

export type GoldenStoreResponsiveEvidence = Readonly<{
  lifecycle: GoldenStoreEvaluationLifecycleState;
  surface: GoldenStoreEvaluationSurface;
  locale: GoldenStoreEvaluationLocale;
  viewport: GoldenStoreEvaluationViewport;
  responsiveStatus: "passed" | "failed";
  accessibilityStatus: "passed" | "failed";
  rendererOutputFingerprint: string | null;
  /** A future browser screenshot reference; deliberately not canonical state. */
  screenshotReference: string | null;
}>;

export type GoldenStoreEvaluationInput = Readonly<{
  evaluationId: string;
  evaluationVersion: typeof GOLDEN_STORE_EVALUATION_CONTRACT_VERSION;
  fixture: Readonly<{ fixtureId: string; projectId: string }>;
  canonicalBaseline: Readonly<{
    snapshotId: string;
    revision: number;
    fingerprint: string;
  }>;
  manifest: Readonly<{ version: string; fingerprint: string }>;
  pageBlueprintMaterializations: readonly WholeStorefrontPageBlueprintMaterialization[];
  lifecycle: readonly GoldenStoreLifecycleEvidence[];
  responsiveEvidence: readonly GoldenStoreResponsiveEvidence[];
}>;

export type GoldenStoreStructuralAssertions = Readonly<{
  roleCardinality: true;
  requiredComponents: true;
  sharedFrameCoherence: true;
  bindingValidity: true;
  responsiveAccessibility: true;
  lifecycleParity: true;
  editorPreviewPublishParity: true;
  protectedStatePreserved: true;
}>;

export type GoldenStoreEvaluationScenario = Readonly<{
  lifecycle: GoldenStoreEvaluationLifecycleState;
  surface: GoldenStoreEvaluationSurface;
  locale: GoldenStoreEvaluationLocale;
  viewport: GoldenStoreEvaluationViewport;
  evidenceReference: string;
  screenshotReference: string | null;
}>;

export type GoldenStoreEvaluationRun = Readonly<{
  evaluationId: string;
  contractVersion: typeof GOLDEN_STORE_EVALUATION_CONTRACT_VERSION;
  fixture: GoldenStoreEvaluationInput["fixture"];
  canonicalBaseline: GoldenStoreEvaluationInput["canonicalBaseline"];
  manifest: GoldenStoreEvaluationInput["manifest"];
  pageBlueprintMaterializations: readonly WholeStorefrontPageBlueprintMaterialization[];
  lifecycle: readonly Omit<GoldenStoreLifecycleEvidence, "snapshot">[];
  scenarios: readonly GoldenStoreEvaluationScenario[];
  structuralAssertions: GoldenStoreStructuralAssertions;
  /** Deterministic facts only, not a judgement of commercial quality. */
  deterministicEvidence: Readonly<{
    baselineCurrent: true;
    manifestCurrent: true;
    profilesCurrent: true;
    matrixComplete: true;
  }>;
  /** Signals intentionally have no subjective scoring threshold in P10A-07A. */
  structuralQualitySignals: Readonly<{
    pageBlueprintRolesCaptured: true;
    componentVariantsCaptured: true;
    boundedParametersCaptured: true;
    commerceBindingsCaptured: true;
    brandSystemFingerprint: string;
  }>;
  humanVisualReview: Readonly<{
    status: "not-reviewed";
    reviewer: null;
    notes: null;
  }>;
  futureProviderEvidence: Readonly<{ status: "not-run"; references: readonly string[] }>;
  outcome: "passed";
  fingerprint: string;
}>;

export class GoldenStoreEvaluationError extends Error {
  constructor(
    readonly code:
      | "invalid-input"
      | "stale-baseline"
      | "stale-manifest"
      | "stale-profile"
      | "incomplete-matrix"
      | "failed-structural-evidence"
      | "lifecycle-parity"
      | "protected-state",
    message: string,
  ) {
    super(message);
    this.name = "GoldenStoreEvaluationError";
  }
}
