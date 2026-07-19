import { z } from "zod";
import {
  designIntentSchema,
  designPlanSchema,
  designRequestClassificationSchema,
} from "@/application/design-skills";
import { idSchema, isoDateTimeSchema, localeSchema, localizedTextSchema } from "@/domain/shared";
import { pageModelSchema, pageTypeSchema } from "@/domain/storefront";

export const designAgentSessionStateSchema = z.enum([
  "idle",
  "classifying",
  "needsClarification",
  "planning",
  "generating",
  "proposalReady",
  "accepting",
  "revising",
  "accepted",
  "rejected",
  "cancelled",
  "failed",
]);

export const designAgentFailureCodeSchema = z.enum([
  "unsupportedRequest",
  "invalidPlan",
  "executionFailed",
  "staleBase",
  "unsupportedRevision",
]);

export const designAgentFailureSchema = z
  .object({
    code: designAgentFailureCodeSchema,
    message: localizedTextSchema,
    details: z.array(z.string()),
  })
  .strict();

export const designAgentSessionSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    pageId: idSchema,
    pageType: pageTypeSchema,
    locale: localeSchema,
    originalPage: pageModelSchema,
    initialMerchantRequest: z.string().trim().min(1).max(2_000).nullable(),
    currentMerchantRequest: z.string().trim().min(1).max(2_000).nullable(),
    selectedSectionId: idSchema.nullable(),
    normalizedIntent: designIntentSchema.nullable(),
    classification: designRequestClassificationSchema.nullable(),
    plan: designPlanSchema.nullable(),
    activeProposalId: z
      .string()
      .regex(/^proposal_[a-f0-9]{8}$/)
      .nullable(),
    proposalAttemptSequence: z.number().int().nonnegative(),
    revisionCount: z.number().int().nonnegative(),
    assumptions: z.array(localizedTextSchema),
    clarificationQuestion: localizedTextSchema.nullable(),
    clarificationAnswer: z.string().trim().min(1).max(2_000).nullable(),
    revisionSummary: localizedTextSchema.nullable(),
    status: localizedTextSchema,
    state: designAgentSessionStateSchema,
    failure: designAgentFailureSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((session, context) => {
    if (session.originalPage.id !== session.pageId) {
      context.addIssue({
        code: "custom",
        path: ["pageId"],
        message: "Session page ID must match the original canonical page.",
      });
    }
    if (session.originalPage.type !== session.pageType) {
      context.addIssue({
        code: "custom",
        path: ["pageType"],
        message: "Session PageType must match the original canonical page.",
      });
    }
    if (session.state === "needsClarification" && !session.clarificationQuestion) {
      context.addIssue({
        code: "custom",
        path: ["clarificationQuestion"],
        message: "Clarification state requires one merchant-facing question.",
      });
    }
    if (
      ["proposalReady", "accepting", "revising", "accepted", "rejected"].includes(session.state) &&
      !session.activeProposalId
    ) {
      context.addIssue({
        code: "custom",
        path: ["activeProposalId"],
        message: `${session.state} requires an active proposal reference.`,
      });
    }
    if (session.state === "failed" && !session.failure) {
      context.addIssue({
        code: "custom",
        path: ["failure"],
        message: "Failed state requires controlled failure information.",
      });
    }
    if (Date.parse(session.updatedAt) < Date.parse(session.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "Session update time cannot precede its creation time.",
      });
    }
  });

export type DesignAgentSessionState = z.infer<typeof designAgentSessionStateSchema>;
export type DesignAgentFailureCode = z.infer<typeof designAgentFailureCodeSchema>;
export type DesignAgentFailure = z.infer<typeof designAgentFailureSchema>;
export type DesignAgentSession = z.infer<typeof designAgentSessionSchema>;
