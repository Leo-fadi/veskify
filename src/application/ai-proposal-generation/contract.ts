import { z } from "zod";
import { type AIProvider, untrustedImportedContentSchema } from "@/application/ai-provider";
import { designProposalSchema } from "@/application/design-operations";
import type { StorefrontRenderContext } from "@/components/registry";
import { brandSystemSchema } from "@/domain/design-system";
import { idSchema, localeSchema, localizedTextSchema } from "@/domain/shared";
import { pageModelSchema } from "@/domain/storefront";

export const editorProposalTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page"), pageId: idSchema }).strict(),
  z.object({ type: z.literal("section"), pageId: idSchema, sectionId: idSchema }).strict(),
]);

export const aiProposalGenerationCommandSchema = z
  .object({
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    page: pageModelSchema,
    target: editorProposalTargetSchema,
    merchantInstruction: z.string().trim().min(1).max(2_000),
    activeLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1).max(2),
    brandSystem: brandSystemSchema,
    displayContext: z.custom<StorefrontRenderContext>(),
    importedContent: z.array(untrustedImportedContentSchema).default([]),
    provider: z.custom<AIProvider>(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "proposeChange" in value &&
        typeof value.proposeChange === "function",
      "A valid AI operation provider is required.",
    ),
  })
  .strict()
  .superRefine((command, context) => {
    if (!command.enabledLocales.includes(command.activeLocale)) {
      context.addIssue({
        code: "custom",
        path: ["activeLocale"],
        message: "The active locale must be enabled for the storefront.",
      });
    }
    if (new Set(command.enabledLocales).size !== command.enabledLocales.length) {
      context.addIssue({
        code: "custom",
        path: ["enabledLocales"],
        message: "Enabled storefront locales must be unique.",
      });
    }
  });

export const aiProposalGenerationStateSchema = z.enum([
  "idle",
  "generating",
  "proposalReady",
  "failed",
  "stale",
  "superseded",
]);

export const aiProposalGenerationFailureCodeSchema = z.enum([
  "invalidCommand",
  "unsupportedRequest",
  "providerUnavailable",
  "validationFailed",
  "staleDraft",
  "staleTarget",
  "superseded",
]);

export const generatedAiProposalSchema = z
  .object({
    projectId: idSchema,
    pageId: idSchema,
    sectionId: idSchema.nullable(),
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    providerRequestId: z.string().min(1),
    providerId: z.string().min(1),
    proposal: designProposalSchema,
    observability: z
      .object({
        operationCount: z.number().int().nonnegative(),
        durationMs: z.number().nonnegative(),
        validation: z.literal("valid"),
      })
      .strict(),
  })
  .strict();

export const aiProposalGenerationFailureSchema = z
  .object({
    code: aiProposalGenerationFailureCodeSchema,
    message: localizedTextSchema,
    retryable: z.boolean(),
  })
  .strict();

export type EditorProposalTarget = z.infer<typeof editorProposalTargetSchema>;
export type AiProposalGenerationCommand = z.infer<typeof aiProposalGenerationCommandSchema>;
export type AiProposalGenerationState = z.infer<typeof aiProposalGenerationStateSchema>;
export type AiProposalGenerationFailure = z.infer<typeof aiProposalGenerationFailureSchema>;
export type GeneratedAiProposal = z.infer<typeof generatedAiProposalSchema>;

export type AiProposalEditorIdentity = Readonly<{
  projectId: string;
  draftSnapshotId: string;
  draftRevision: number;
  target: EditorProposalTarget;
  page: z.infer<typeof pageModelSchema>;
}>;

export type AiProposalGenerationEvent = Readonly<{
  name: "ai_prompt_submitted" | "ai_proposal_generated" | "generation_failed";
  projectId: string;
  pageId: string;
  sectionId?: string;
  providerId?: string;
  providerRequestId?: string;
  operationCount?: number;
  durationMs?: number;
  validation?: "valid" | "invalid";
  failureCode?: AiProposalGenerationFailure["code"];
}>;

export interface AiProposalGenerationAnalytics {
  record(event: AiProposalGenerationEvent): void;
}

export type AiProposalGenerationResult =
  | Readonly<{ state: "proposalReady"; proposal: GeneratedAiProposal; failure: null }>
  | Readonly<{
      state: "failed" | "stale" | "superseded";
      proposal: null;
      failure: AiProposalGenerationFailure;
    }>;
