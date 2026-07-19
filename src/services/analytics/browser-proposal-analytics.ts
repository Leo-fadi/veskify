import {
  proposalAnalyticsEventSchema,
  type ProposalAnalyticsEvent,
  type ProposalAnalyticsSink,
} from "@/application/analytics";

export const browserProposalAnalyticsEventType = "veskify:proposal-analytics";

export class BrowserProposalAnalyticsSink implements ProposalAnalyticsSink {
  track(input: ProposalAnalyticsEvent) {
    const event = proposalAnalyticsEventSchema.parse(structuredClone(input));
    globalThis.dispatchEvent(
      new CustomEvent<ProposalAnalyticsEvent>(browserProposalAnalyticsEventType, {
        detail: event,
      }),
    );
  }
}

export function createBrowserProposalAnalyticsSink() {
  return new BrowserProposalAnalyticsSink();
}
