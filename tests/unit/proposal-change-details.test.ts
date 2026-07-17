import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DesignProposal } from "@/application/design-operations";
import {
  createDeterministicDesignProvider,
  type DesignPlannerInput,
} from "@/application/design-skills";
import { DesignAgentPanel } from "@/app/projects/[projectId]/editor/design-agent-panel";
import { proposalChangeDetails } from "@/app/projects/[projectId]/editor/proposal-change-details";
import type { DesignAgentSessionController } from "@/app/projects/[projectId]/editor/use-design-agent-session";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const displayContext = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
});

function input(merchantRequest: string): DesignPlannerInput {
  return {
    merchantRequest,
    activeLocale: "en",
    page: structuredClone(homepage),
    pageType: "home",
    brandSystem: structuredClone(aurumNordicSeed.draftSnapshot.brandSystem),
    displayContext: structuredClone(displayContext),
  };
}

function proposalFor(request: string) {
  const proposal = createDeterministicDesignProvider().propose(input(request)).proposal;
  if (!proposal) throw new Error(`Expected a proposal for: ${request}`);
  return proposal;
}

function affectedSectionIds(proposal: DesignProposal) {
  return new Set(
    proposal.operations.flatMap((operation) => {
      if ("sectionId" in operation) return [operation.sectionId];
      if (operation.type === "REORDER_SECTIONS") return operation.sectionIds;
      return [];
    }),
  );
}

function panelController(proposal: DesignProposal): DesignAgentSessionController {
  const noop = vi.fn();
  return {
    request: "Make the homepage feel more luxurious.",
    setRequest: noop,
    clarificationAnswer: "",
    setClarificationAnswer: noop,
    revision: "",
    setRevision: noop,
    session: {
      state: "proposalReady",
      plan: { affectedSectionIds: [...affectedSectionIds(proposal)] },
      assumptions: [],
    },
    proposal,
    visibleState: "proposalReady",
    statusMessage: "Proposal ready.",
    previewActive: true,
    blocksSave: true,
    controlsDisabled: false,
    submitRequest: noop,
    answerClarification: noop,
    reviseProposal: noop,
    regenerateProposal: noop,
    acceptProposal: noop,
    rejectProposal: noop,
    cancelSession: noop,
    restartSession: noop,
    closeForPageSwitch: noop,
    closeForPageMutation: noop,
  } as unknown as DesignAgentSessionController;
}

describe("merchant proposal change details", () => {
  it("groups a multi-section luxury proposal into one complete item per section", () => {
    const proposal = proposalFor("Make the homepage feel more luxurious.");
    const details = proposalChangeDetails(proposal, "en", "en");

    expect(details.items).toHaveLength(affectedSectionIds(proposal).size);
    expect(details.items.every((item) => item.sectionId !== null)).toBe(true);
    expect(details.items.some((item) => item.operationIndexes.length > 1)).toBe(true);
    expect(details.complete).toBe(true);
  });

  it("keeps every repeated operation represented in its section group", () => {
    const proposal = proposalFor("Make the homepage feel more luxurious.");
    const details = proposalChangeDetails(proposal, "en", "en");
    const represented = new Set(details.items.flatMap((item) => item.operationIndexes));

    expect(details.representedOperationIndexes).toEqual(
      proposal.operations.map((_, operationIndex) => operationIndex),
    );
    expect(represented.size).toBe(proposal.operations.length);
    expect(details.items.map((item) => item.summary).join(" ")).toMatch(
      /background|typography|spacing|layout|shapes/i,
    );
    expect(details.items.map((item) => item.summary).join(" ")).not.toMatch(
      /CHANGE_|APPLY_|section_home_/,
    );
  });

  it("groups added-section and content operations in English and Finnish", () => {
    const proposal = proposalFor("Add a campaign section.");
    const english = proposalChangeDetails(proposal, "en", "en");
    const finnish = proposalChangeDetails(proposal, "fi", "en");

    expect(english.items).toHaveLength(1);
    expect(english.items[0].operationIndexes).toEqual([0, 1, 2]);
    expect(english.items[0].summary).toMatch(/add this|English heading|English supporting/i);
    expect(finnish.items).toHaveLength(1);
    expect(finnish.items[0].operationIndexes).toEqual([0, 1, 2]);
    expect(finnish.items[0].summary).toMatch(/lisää tämä|englanninkielinen/i);
    expect(finnish.items[0].summary).not.toMatch(/ADD_APPROVED|CHANGE_LOCALIZED/);
  });

  it("falls back to the primary locale for a missing section title", () => {
    const proposal = structuredClone(proposalFor("Add a campaign section."));
    const sectionId = proposal.operations.find((operation) => "sectionId" in operation)?.sectionId;
    const section = proposal.proposedPage.sections.find((candidate) => candidate.id === sectionId)!;
    for (const field of ["title", "heading", "eyebrow"]) {
      const value = section.content[field];
      if (value && typeof value === "object") delete (value as { fi?: string }).fi;
    }

    const details = proposalChangeDetails(proposal, "fi", "en");

    expect(details.items[0].title).toBeTruthy();
    expect(details.items[0].title).toMatch(/[A-Za-z]/);
    expect(details.complete).toBe(true);
  });

  it("blocks acceptance when an operation cannot be represented", () => {
    const validProposal = proposalFor("Make the homepage feel more luxurious.");
    const proposal = {
      ...validProposal,
      operations: [...validProposal.operations, { type: "UNREPRESENTED_CHANGE" }],
    } as unknown as DesignProposal;
    const details = proposalChangeDetails(proposal, "en", "en");

    expect(details.complete).toBe(false);
    render(
      createElement(DesignAgentPanel, {
        controller: panelController(proposal),
        locale: "en",
        primaryLocale: "en",
        pageTitle: "Home",
      }),
    );
    expect(screen.getByRole("button", { name: "Accept and apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
});
