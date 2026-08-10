import { z } from "zod";
import { idSchema } from "@/domain/shared";

export const pageFactEvidenceSourceSchema = z.enum([
  "merchant-approved",
  "vesko-authoritative",
  "approved-source-evidence",
]);

export const pageFactEvidenceRequestSchema = z
  .object({
    source: pageFactEvidenceSourceSchema,
    authorityId: idSchema,
    revision: z.string().trim().min(1).max(120),
  })
  .strict();

export const pageFactEvidenceReferenceSchema = pageFactEvidenceRequestSchema
  .extend({
    status: z.literal("approved"),
    approvalAuthorityId: idSchema,
    approvalFingerprint: z.string().trim().min(1),
  })
  .strict();

export type PageFactEvidenceSource = z.infer<typeof pageFactEvidenceSourceSchema>;
export type PageFactEvidenceRequest = z.infer<typeof pageFactEvidenceRequestSchema>;
export type PageFactEvidenceReference = z.infer<typeof pageFactEvidenceReferenceSchema>;
