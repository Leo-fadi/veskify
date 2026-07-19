import { describe, expect, it } from "vitest";
import { proposalAnalyticsEventSchema } from "@/application/analytics";

const event = {
  name: "ai_proposal_generated",
  projectId: "project_aurum_nordic",
  timestamp: "2026-07-19T12:00:00.000Z",
  route: "/projects/project_aurum_nordic/editor",
  targetId: "section_home_hero",
} as const;

describe("proposal analytics contract", () => {
  it("accepts only the SDD proposal event names and minimum non-sensitive context", () => {
    expect(proposalAnalyticsEventSchema.parse(event)).toEqual(event);
    expect(
      proposalAnalyticsEventSchema.parse({ ...event, name: "ai_proposal_accepted" }),
    ).toMatchObject({ name: "ai_proposal_accepted" });
    expect(
      proposalAnalyticsEventSchema.parse({ ...event, name: "ai_proposal_rejected" }),
    ).toMatchObject({ name: "ai_proposal_rejected" });
  });

  it.each([
    ["merchant prompt", { merchantPrompt: "Make the homepage more premium." }],
    ["imported content", { importedContent: "Private catalogue content" }],
    ["provider secret", { providerSecret: "secret" }],
  ])("rejects analytics payloads containing %s", (_label, sensitivePayload) => {
    expect(() => proposalAnalyticsEventSchema.parse({ ...event, ...sensitivePayload })).toThrow();
  });
});
