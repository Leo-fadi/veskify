import { describe, expect, it } from "vitest";
import {
  AiProposalGenerationOrchestrator,
  type AiProposalEditorIdentity,
} from "@/application/ai-proposal-generation";
import { createDeterministicMockAIProvider } from "@/application/ai-provider";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";

describe("P4-03 proposal generation integration", () => {
  it("connects editor identity, planner permissions, provider validation and pending proposal", async () => {
    const page = aurumNordicSeed.draftSnapshot.pages.find(
      (candidate) => candidate.type === "home",
    )!;
    const sectionId = page.sections.find((section) => section.component === "hero")!.id;
    const current: AiProposalEditorIdentity = {
      projectId: aurumNordicSeed.project.id,
      draftSnapshotId: aurumNordicSeed.draftSnapshot.id,
      draftRevision: aurumNordicSeed.draftSnapshot.revision,
      target: { type: "section", pageId: page.id, sectionId },
    };
    const original = structuredClone(page);
    const orchestrator = new AiProposalGenerationOrchestrator({
      currentIdentity: () => current,
    });
    const result = await orchestrator.generate({
      ...current,
      page,
      merchantInstruction: "Improve the hero.",
      activeLocale: "en",
      enabledLocales: ["en", "fi"],
      brandSystem: aurumNordicSeed.draftSnapshot.brandSystem,
      displayContext: createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: "en",
        catalogue: aurumNordicSeed.catalogue,
        snapshot: aurumNordicSeed.draftSnapshot,
      }),
      importedContent: [],
      provider: createDeterministicMockAIProvider(),
    });

    expect(result.state).toBe("proposalReady");
    if (result.state !== "proposalReady") throw new Error("Expected ready proposal.");
    expect(result.proposal.proposal.status).toBe("pending");
    expect(result.proposal.proposal.originalPage).toEqual(original);
    expect(result.proposal.proposal.proposedPage).not.toEqual(original);
    expect(page).toEqual(original);
  });
});
