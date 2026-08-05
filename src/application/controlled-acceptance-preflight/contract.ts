import {
  governedFollowUpEditingRequestSchema,
  governedInitialGenerationRequestSchema,
  governedSkillAuthorityEnvelopeSchema,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { z } from "zod";

const fingerprintSchema = z.string().trim().min(1).max(240);
const safeIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/);
const versionSchema = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+$/);

/** This contract is deliberately inert until an explicit authorization is supplied. */
export const CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION = "1.0.0" as const;

export const controlledAcceptanceLifecycleExerciseSchema = z.enum([
  "preview-only",
  "reject",
  "accept",
  "accept-undo",
  "accept-undo-redo",
]);

export const controlledAcceptanceReviewStageSchema = z.enum([
  "proposal-retained",
  "previewed",
  "rejected",
  "accepted",
  "undone",
  "redone",
]);

export const controlledAcceptanceProviderConfigurationSchema = z
  .object({
    providerId: safeIdSchema,
    /** Safe model identity only. Credentials and provider options are never accepted here. */
    modelId: safeIdSchema.nullable(),
  })
  .strict();

export const controlledAcceptanceEvidenceRetentionSchema = z
  .object({
    /** The preflight foundation intentionally supports only deterministic in-memory retention. */
    kind: z.literal("in-memory"),
    destinationId: safeIdSchema,
  })
  .strict();

export const controlledAcceptanceCaseSchema = z
  .object({
    caseId: safeIdSchema,
    caseVersion: versionSchema,
    executionKind: z.enum(["initialGeneration", "followUpEditing"]),
    requestIdentity: safeIdSchema,
    locale: z.enum(["en", "fi"]),
    authority: governedSkillAuthorityEnvelopeSchema,
    /** Binds the declared profiles or selected slots to the governed request without duplicating them. */
    declaredPageAuthorityFingerprint: fingerprintSchema,
    providerConfiguration: controlledAcceptanceProviderConfigurationSchema,
    expectedModelId: safeIdSchema.nullable(),
    maximumProviderCalls: z.number().int().min(0).max(10),
    expectedReviewStages: z.array(controlledAcceptanceReviewStageSchema).min(1).max(6),
    lifecycleExercise: controlledAcceptanceLifecycleExerciseSchema,
    evidenceRetention: controlledAcceptanceEvidenceRetentionSchema,
    /** Explicit canonical P10A-05C or P10A-05D-02 input; never natural-language routing. */
    execution: z.unknown(),
  })
  .strict();

export const controlledLiveCallAuthorizationSchema = z
  .object({
    kind: z.literal("controlled-live-provider-call"),
    authorizationId: safeIdSchema,
    caseId: safeIdSchema,
    caseVersion: z.literal(CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION),
    authorityFingerprint: fingerprintSchema,
    caseFingerprint: fingerprintSchema,
    providerId: safeIdSchema,
    maximumProviderCalls: z.number().int().positive().max(10),
    fingerprint: fingerprintSchema,
  })
  .strict();

export type ControlledAcceptanceCase = z.infer<typeof controlledAcceptanceCaseSchema>;
export type ControlledLiveCallAuthorization = z.infer<typeof controlledLiveCallAuthorizationSchema>;
export type ControlledAcceptanceLifecycleExercise = z.infer<
  typeof controlledAcceptanceLifecycleExerciseSchema
>;

export type ControlledAcceptanceFailureCode =
  | "malformed-case"
  | "unsupported-case-version"
  | "missing-live-authorization"
  | "invalid-live-authorization"
  | "stale-authority"
  | "invalid-provider-configuration"
  | "provider-allowance-exhausted"
  | "evidence-initialization-failed"
  | "provider-unavailable"
  | "provider-response-validation-failed"
  | "planning-proposal-rejected"
  | "stale-acceptance"
  | "protected-state-violation"
  | "lifecycle-failed";

export const controlledAcceptanceEvidenceSchema = z
  .object({
    caseId: safeIdSchema,
    caseVersion: z.literal(CONTROLLED_ACCEPTANCE_PREFLIGHT_VERSION),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    executionKind: z.enum(["initialGeneration", "followUpEditing"]),
    governedPackageId: safeIdSchema.nullable(),
    requestFingerprint: fingerprintSchema,
    authorityFingerprint: fingerprintSchema,
    projectId: safeIdSchema,
    projectRevision: z.number().int().nonnegative(),
    draftSnapshotId: safeIdSchema,
    draftRevision: z.number().int().nonnegative(),
    snapshotFingerprint: fingerprintSchema,
    manifest: z.object({ version: versionSchema, fingerprint: fingerprintSchema }).strict(),
    packageRegistry: z.object({ version: versionSchema, fingerprint: fingerprintSchema }).strict(),
    declaredPageAuthorityFingerprint: fingerprintSchema,
    commerceFingerprint: fingerprintSchema,
    approvedAssetFingerprint: fingerprintSchema.nullable(),
    provider: controlledAcceptanceProviderConfigurationSchema,
    providerAttemptCount: z.number().int().nonnegative(),
    providerCompletionCount: z.number().int().nonnegative(),
    providerOutcome: z.enum([
      "not-attempted",
      "completed",
      "rejected-before-call",
      "unavailable",
      "invalid-response",
    ]),
    planFingerprint: fingerprintSchema.nullable(),
    proposalFingerprint: fingerprintSchema.nullable(),
    reviewSummaryFingerprint: fingerprintSchema.nullable(),
    previewFingerprint: fingerprintSchema.nullable(),
    acceptanceFingerprint: fingerprintSchema.nullable(),
    undoFingerprint: fingerprintSchema.nullable(),
    redoFingerprint: fingerprintSchema.nullable(),
    protectedStateBeforeFingerprint: fingerprintSchema.nullable(),
    protectedStateAfterFingerprint: fingerprintSchema.nullable(),
    publishState: z.literal("not-published"),
    finalStatus: z.enum(["succeeded", "failed"]),
    failure: z.object({ code: z.string(), category: z.string() }).strict().nullable(),
    fingerprint: fingerprintSchema,
  })
  .strict();

export type ControlledAcceptanceEvidence = z.infer<typeof controlledAcceptanceEvidenceSchema>;

export type ControlledAcceptanceResult =
  | Readonly<{ ok: true; evidence: ControlledAcceptanceEvidence }>
  | Readonly<{
      ok: false;
      failure: Readonly<{ code: ControlledAcceptanceFailureCode; message: string }>;
      evidence: ControlledAcceptanceEvidence | null;
    }>;

export function controlledAcceptanceAuthorityFingerprint(
  authority: GovernedSkillAuthorityEnvelope,
): string {
  return `controlled-acceptance-authority-${canonicalValueFingerprint(authority)}`;
}

export function controlledLiveCallAuthorizationFingerprint(
  authorization: Omit<ControlledLiveCallAuthorization, "fingerprint">,
): string {
  return `controlled-live-call-${canonicalValueFingerprint(authorization)}`;
}

/** Binds an authorization to every material, non-secret acceptance-case input. */
export function controlledAcceptanceCaseFingerprint(input: ControlledAcceptanceCase): string {
  return `controlled-acceptance-case-${canonicalValueFingerprint(input)}`;
}

export function declaredPageAuthorityFingerprint(input: unknown): string {
  const initial = governedInitialGenerationRequestSchema.safeParse(input);
  if (initial.success) {
    return `controlled-page-authority-${canonicalValueFingerprint(initial.data.authority.profiles)}`;
  }
  const followUp = governedFollowUpEditingRequestSchema.safeParse(input);
  if (followUp.success) {
    return `controlled-page-authority-${canonicalValueFingerprint(followUp.data.authority.pages)}`;
  }
  throw new Error("A governed initial-generation or follow-up request is required.");
}
