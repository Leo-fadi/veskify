import { z } from "zod";
import { idSchema } from "@/domain/shared";

export const acceptedAiProposalAcceptanceRequestSchema = z
  .object({
    projectId: idSchema,
    proposalId: idSchema,
    acceptanceActionId: idSchema,
    expectedAuthorityRevision: z.number().int().nonnegative(),
    expectedProjectRevision: z.number().int().nonnegative(),
    expectedDraftId: idSchema,
    expectedDraftRevision: z.number().int().nonnegative(),
  })
  .strict();

export const acceptedAiProposalAcceptanceResultSchema = z
  .object({
    receiptId: idSchema,
    authoritativeRevision: z.number().int().nonnegative(),
  })
  .strict();

export type AcceptedAiProposalAcceptanceRequest = z.infer<
  typeof acceptedAiProposalAcceptanceRequestSchema
>;
export type AcceptedAiProposalAcceptanceResult = z.infer<
  typeof acceptedAiProposalAcceptanceResultSchema
>;

export type AcceptedAiReceiptWiringErrorCode =
  | "authentication-required"
  | "permission-denied"
  | "project-mismatch"
  | "proposal-mismatch"
  | "proposal-not-reviewed"
  | "stale-authority"
  | "acceptance-failed"
  | "invalid-request"
  | "unavailable";

export class AcceptedAiReceiptWiringError extends Error {
  constructor(
    readonly code: AcceptedAiReceiptWiringErrorCode,
    options?: ErrorOptions,
  ) {
    super("The governed proposal could not be accepted for trusted publication.", options);
    this.name = "AcceptedAiReceiptWiringError";
  }
}
