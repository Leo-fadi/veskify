import { z } from "zod";
import { generatedAiProposalSchema } from "@/application/ai-proposal-generation";
import { localizedTextSchema } from "@/domain/shared";
import type { PageModel } from "@/domain/storefront";

export const aiProposalConfirmationStateSchema = z.enum([
  "idle",
  "ready",
  "accepting",
  "accepted",
  "rejected",
  "failed",
  "stale",
  "closed",
]);

export const aiProposalConfirmationFailureSchema = z
  .object({
    code: z.enum(["applicationFailed", "stale", "invalidProposal"]),
    message: localizedTextSchema,
    retryable: z.boolean(),
  })
  .strict();

export const aiProposalConfirmationSnapshotSchema = z
  .object({
    state: aiProposalConfirmationStateSchema,
    generatedProposal: generatedAiProposalSchema.nullable(),
    failure: aiProposalConfirmationFailureSchema.nullable(),
  })
  .strict();

export type AiProposalConfirmationState = z.infer<typeof aiProposalConfirmationStateSchema>;
export type AiProposalConfirmationFailure = z.infer<typeof aiProposalConfirmationFailureSchema>;
export type AiProposalConfirmationSnapshot = z.infer<typeof aiProposalConfirmationSnapshotSchema>;

export type AiProposalConfirmationResult = Readonly<
  AiProposalConfirmationSnapshot & { page?: PageModel }
>;
