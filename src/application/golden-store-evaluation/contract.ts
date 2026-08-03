import { approvedGenerationAssetContextSchema } from "@/application/ai-storefront-generation";
import { wholeStorefrontPageBlueprintMaterializationSchema } from "@/application/whole-storefront-generation-plan";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { storefrontSnapshotSchema } from "@/domain/storefront";
import { idSchema, localeSchema } from "@/domain/shared";
import { z } from "zod";

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
  "proposal-preview",
  "accepted-editor",
  "preview-route",
  "saved-reloaded",
  "published",
] as const;
export const goldenStoreEvaluationLocales = ["en", "fi"] as const;
export const goldenStoreEvaluationViewports = [375, 768, 1024, 1440] as const;

export const goldenStoreEvaluationSurfaceSchema = z.enum(goldenStoreEvaluationSurfaces);
export const goldenStoreEvaluationLifecycleStateSchema = z.enum(
  goldenStoreEvaluationLifecycleStates,
);
export const goldenStoreEvaluationViewportSchema = z.union([
  z.literal(375),
  z.literal(768),
  z.literal(1024),
  z.literal(1440),
]);

export type GoldenStoreEvaluationSurface = (typeof goldenStoreEvaluationSurfaces)[number];
export type GoldenStoreEvaluationLifecycleState =
  (typeof goldenStoreEvaluationLifecycleStates)[number];
export type GoldenStoreEvaluationLocale = (typeof goldenStoreEvaluationLocales)[number];
export type GoldenStoreEvaluationViewport = (typeof goldenStoreEvaluationViewports)[number];

const fingerprintSchema = z.string().trim().min(1).max(240);

export const goldenStoreRendererOutputSchema = z
  .object({
    target: z.enum(["proposal", "editor", "preview", "published"]),
    output: z.record(z.string(), z.unknown()),
  })
  .strict();

export const goldenStoreLifecycleEvidenceSchema = z
  .object({
    state: goldenStoreEvaluationLifecycleStateSchema,
    snapshot: storefrontSnapshotSchema,
    revision: z.number().int().nonnegative(),
    snapshotFingerprint: fingerprintSchema,
    canonicalCommerce: catalogueDisplayModelSchema,
    approvedAssets: approvedGenerationAssetContextSchema,
  })
  .strict();

export const goldenStoreResponsiveEvidenceSchema = z
  .object({
    lifecycle: goldenStoreEvaluationLifecycleStateSchema,
    surface: goldenStoreEvaluationSurfaceSchema,
    locale: localeSchema,
    viewport: goldenStoreEvaluationViewportSchema,
    responsiveStatus: z.enum(["passed", "failed"]),
    accessibilityStatus: z.enum(["passed", "failed"]),
    rendererOutput: goldenStoreRendererOutputSchema,
    /** A future browser screenshot or human-review reference; never canonical state. */
    screenshotReference: z.string().trim().min(1).max(500).nullable(),
  })
  .strict();

export const goldenStoreEvaluationInputSchema = z
  .object({
    evaluationId: z.string().trim().min(1).max(160),
    evaluationVersion: z.literal(GOLDEN_STORE_EVALUATION_CONTRACT_VERSION),
    fixture: z.object({ fixtureId: idSchema, projectId: idSchema }).strict(),
    canonicalBaseline: z
      .object({ snapshot: storefrontSnapshotSchema, snapshotFingerprint: fingerprintSchema })
      .strict(),
    manifest: z.object({ version: fingerprintSchema, fingerprint: fingerprintSchema }).strict(),
    pageBlueprintMaterializations: z
      .array(wholeStorefrontPageBlueprintMaterializationSchema)
      .length(3),
    lifecycle: z.array(goldenStoreLifecycleEvidenceSchema).length(5),
    responsiveEvidence: z.array(goldenStoreResponsiveEvidenceSchema).length(160),
  })
  .strict();

export type GoldenStoreLifecycleEvidence = z.infer<typeof goldenStoreLifecycleEvidenceSchema>;
export type GoldenStoreResponsiveEvidence = z.infer<typeof goldenStoreResponsiveEvidenceSchema>;
export type GoldenStoreEvaluationInput = z.infer<typeof goldenStoreEvaluationInputSchema>;

export type GoldenStoreDerivedLifecycleEvidence = Readonly<{
  state: GoldenStoreEvaluationLifecycleState;
  snapshotId: string;
  projectId: string;
  revision: number;
  snapshotFingerprint: string;
  navigationFingerprint: string;
  protectedCommerceFingerprint: string;
  approvedAssetFingerprint: string;
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
  profileId: string;
  locale: GoldenStoreEvaluationLocale;
  viewport: GoldenStoreEvaluationViewport;
  evidenceReference: string;
  rendererOutputFingerprint: string;
  screenshotReference: string | null;
}>;

export type GoldenStoreEvaluationRun = Readonly<{
  evaluationId: string;
  contractVersion: typeof GOLDEN_STORE_EVALUATION_CONTRACT_VERSION;
  fixture: GoldenStoreEvaluationInput["fixture"];
  canonicalBaseline: Readonly<{
    snapshotId: string;
    projectId: string;
    revision: number;
    snapshotFingerprint: string;
  }>;
  manifest: GoldenStoreEvaluationInput["manifest"];
  pageBlueprintMaterializations: readonly WholeStorefrontPageBlueprintMaterialization[];
  lifecycle: readonly GoldenStoreDerivedLifecycleEvidence[];
  scenarios: readonly GoldenStoreEvaluationScenario[];
  structuralAssertions: GoldenStoreStructuralAssertions;
  deterministicEvidence: Readonly<{
    baselineCurrent: true;
    manifestCurrent: true;
    profilesCurrent: true;
    matrixComplete: true;
  }>;
  structuralQualitySignals: Readonly<{
    pageBlueprintRolesCaptured: true;
    componentVariantsCaptured: true;
    boundedParametersCaptured: true;
    commerceBindingsCaptured: true;
    brandSystemFingerprint: string;
  }>;
  humanVisualReview: Readonly<{ status: "not-reviewed"; reviewer: null; notes: null }>;
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
      | "project-mismatch"
      | "snapshot-fingerprint"
      | "incomplete-matrix"
      | "failed-structural-evidence"
      | "lifecycle-parity"
      | "protected-state",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GoldenStoreEvaluationError";
  }
}
