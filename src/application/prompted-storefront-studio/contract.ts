import { aiStorefrontProviderResponseSchema } from "@/application/ai-storefront-generation";
import { pageFactEvidenceReferenceSchema } from "@/domain/storefront";
import { idSchema, localeSchema } from "@/domain/shared/schemas";
import { z } from "zod";

export const PROMPTED_STOREFRONT_STUDIO_OPERATION = "promptedStorefrontDesignV2" as const;
export const PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION = "2.0.0" as const;

const fingerprintSchema = z.string().min(1).max(240);

/**
 * The complete browser-to-server authority for normal initial storefront
 * generation. The browser supplies identity, exact merchant intent and scope
 * only; all planning, catalogue, evidence, asset and capability authority is
 * reconstructed and verified on the server.
 */
export const promptedStorefrontStudioGenerationRequestSchema = z
  .object({
    operation: z.literal(PROMPTED_STOREFRONT_STUDIO_OPERATION),
    contractVersion: z.literal(PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION),
    requestId: idSchema,
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    activeLocale: localeSchema,
    targetScope: z.literal("storefront"),
    merchantPrompt: z
      .string()
      .min(1)
      .max(12_000)
      .refine((value) => value.trim().length > 0, "A merchant prompt cannot be blank."),
  })
  .strict();

export type PromptedStorefrontStudioGenerationRequest = z.infer<
  typeof promptedStorefrontStudioGenerationRequestSchema
>;

/** Safe correlation evidence. It deliberately excludes the raw prompt and provider payload. */
export const promptedStorefrontStudioGenerationLineageSchema = z
  .object({
    providerId: z.string().min(1).max(120),
    modelId: z.string().min(1).max(240).nullable(),
    requestFingerprint: fingerprintSchema,
    promptFingerprint: fingerprintSchema,
    providerIntentFingerprint: fingerprintSchema,
    compiledDecisionFingerprint: fingerprintSchema,
    synthesisFingerprint: fingerprintSchema,
    structuralFingerprint: fingerprintSchema,
    candidateSnapshotFingerprint: fingerprintSchema,
    sourceProposalFingerprint: fingerprintSchema,
    currentAuthorityFingerprints: z.array(fingerprintSchema).min(1).max(64),
    materializationAuthorityFingerprint: fingerprintSchema,
    protectedCommerceBeforeFingerprint: fingerprintSchema,
    protectedCommerceAfterFingerprint: fingerprintSchema,
    protectedMediaBeforeFingerprint: fingerprintSchema,
    protectedMediaAfterFingerprint: fingerprintSchema,
    materializationCount: z.literal(1),
    providerCallCount: z.literal(1),
    retryCount: z.literal(0),
  })
  .strict();

export type PromptedStorefrontStudioGenerationLineage = z.infer<
  typeof promptedStorefrontStudioGenerationLineageSchema
>;

export const promptedStorefrontStudioGenerationSuccessSchema = z
  .object({
    ok: z.literal(true),
    proposal: aiStorefrontProviderResponseSchema,
    currentEvidenceReferences: z.array(pageFactEvidenceReferenceSchema),
    lineage: promptedStorefrontStudioGenerationLineageSchema,
  })
  .strict()
  .superRefine((response, context) => {
    const proposal = response.proposal;
    const generation = proposal.proposal.wholeStorefrontGeneration;
    const lineage = response.lineage;
    const mismatched =
      generation === undefined ||
      proposal.providerId !== lineage.providerId ||
      proposal.providerRequestId !== proposal.proposal.requestId ||
      proposal.metadata.operationCount !== 1 ||
      proposal.metadata.wholeStorefrontProposalFingerprint !== lineage.sourceProposalFingerprint ||
      generation.requestFingerprint !== lineage.requestFingerprint ||
      generation.promptFingerprint !== lineage.promptFingerprint ||
      generation.providerIntentFingerprint !== lineage.providerIntentFingerprint ||
      generation.sourceProposalFingerprint !== lineage.sourceProposalFingerprint ||
      generation.compiledDecisionFingerprint !== lineage.compiledDecisionFingerprint ||
      generation.synthesisFingerprint !== lineage.synthesisFingerprint ||
      generation.structuralFingerprint !== lineage.structuralFingerprint ||
      generation.candidateSnapshotFingerprint !== lineage.candidateSnapshotFingerprint ||
      generation.resultingSnapshotFingerprint !== lineage.candidateSnapshotFingerprint ||
      generation.materializationAuthorityFingerprint !==
        lineage.materializationAuthorityFingerprint;
    if (mismatched) {
      context.addIssue({
        code: "custom",
        path: ["lineage"],
        message:
          "Prompted storefront lineage must bind the exact provider response, source proposal, structural operation and candidate snapshot.",
      });
    }
  });

export type PromptedStorefrontStudioGenerationSuccess = z.infer<
  typeof promptedStorefrontStudioGenerationSuccessSchema
>;

export const promptedStorefrontStudioGenerationFailureCategorySchema = z.enum([
  "validation",
  "stale",
  "permissionDenied",
  "authenticationUnavailable",
  "projectMismatch",
  "tenantMismatch",
  "providerUnavailable",
  "malformedResponse",
  "internalFailure",
]);

export type PromptedStorefrontStudioGenerationFailureCategory = z.infer<
  typeof promptedStorefrontStudioGenerationFailureCategorySchema
>;

export const promptedStorefrontStudioGenerationFailureSchema = z
  .object({
    ok: z.literal(false),
    failure: z
      .object({
        category: promptedStorefrontStudioGenerationFailureCategorySchema,
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type PromptedStorefrontStudioGenerationFailure = z.infer<
  typeof promptedStorefrontStudioGenerationFailureSchema
>;

export const promptedStorefrontStudioGenerationResponseSchema = z.discriminatedUnion("ok", [
  promptedStorefrontStudioGenerationSuccessSchema,
  promptedStorefrontStudioGenerationFailureSchema,
]);

export type PromptedStorefrontStudioGenerationResponse = z.infer<
  typeof promptedStorefrontStudioGenerationResponseSchema
>;
