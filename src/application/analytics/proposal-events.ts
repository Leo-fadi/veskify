import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";

export const proposalAnalyticsEventNameSchema = z.enum([
  "ai_prompt_submitted",
  "ai_proposal_generated",
  "ai_proposal_accepted",
  "ai_proposal_rejected",
  "generation_failed",
]);

export const proposalAnalyticsEventSchema = z
  .object({
    name: proposalAnalyticsEventNameSchema,
    projectId: idSchema,
    timestamp: isoDateTimeSchema,
    route: z.string().startsWith("/"),
    targetId: idSchema,
    durationMs: z.number().nonnegative().optional(),
  })
  .strict();

export type ProposalAnalyticsEvent = z.infer<typeof proposalAnalyticsEventSchema>;

export interface ProposalAnalyticsSink {
  track(event: ProposalAnalyticsEvent): void;
}

export const noopProposalAnalyticsSink: ProposalAnalyticsSink = {
  track: () => undefined,
};
