import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GeneratedAiProposal } from "@/application/ai-proposal-generation";
import { InMemoryDesignProposalStore, type DesignProposal } from "@/application/design-operations";
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

function generatedEnvelope(proposal: DesignProposal): GeneratedAiProposal {
  return {
    projectId: aurumNordicSeed.project.id,
    pageId: proposal.originalPage.id,
    sectionId: null,
    draftSnapshotId: aurumNordicSeed.draftSnapshot.id,
    draftRevision: aurumNordicSeed.draftSnapshot.revision,
    providerRequestId: "provider_request_panel_test",
    providerId: "panel-test",
    editorTarget: { type: "page", pageId: proposal.originalPage.id },
    targetFingerprint: "proposal-page-panel-test",
    permissionGrants: [
      {
        skillId: "panelTestSkill",
        skillVersion: "1.0.0",
        skillScope: "page",
        operationTypes: ["CHANGE_SECTION_VARIANT"],
        target: { kind: "page", pageId: proposal.originalPage.id },
      },
    ],
    permissionFingerprint: "proposal-permissions-panel-test",
    proposal,
    observability: {
      operationCount: proposal.operations.length,
      durationMs: 0,
      validation: "valid",
    },
  };
}

function panelController(
  proposal: DesignProposal,
  state: "proposalReady" | "accepting" | "failed" = "proposalReady",
): DesignAgentSessionController {
  const noop = vi.fn();
  return {
    targetScope: "page",
    selectTarget: noop,
    selectedSectionEligible: false,
    request: "Make the homepage feel more luxurious.",
    setRequest: noop,
    clarificationAnswer: "",
    setClarificationAnswer: noop,
    revision: "",
    setRevision: noop,
    session: {
      state,
      status: { en: "Proposal ready.", fi: "Ehdotus valmis." },
      selectedSectionId: null,
      affectedSectionIds: [...affectedSectionIds(proposal)],
      assumptions: [],
      clarificationQuestion: null,
      failure:
        state === "failed"
          ? {
              message: {
                en: "The proposal could not be applied safely.",
                fi: "Ehdotusta ei voitu soveltaa turvallisesti.",
              },
              retryable: true,
            }
          : null,
    },
    generatedProposal: generatedEnvelope(proposal),
    generatedStorefrontProposal: null,
    visibleState: state,
    statusMessage:
      state === "failed" ? "The proposal could not be applied safely." : "Proposal ready.",
    previewActive: true,
    blocksSave: true,
    controlsDisabled: state === "accepting",
    generationRetryAvailable: false,
    canUndoStorefront: false,
    canRedoStorefront: false,
    submitRequest: noop,
    retryGeneration: noop,
    answerClarification: noop,
    reviseProposal: noop,
    regenerateProposal: noop,
    acceptProposal: noop,
    rejectProposal: noop,
    cancelSession: noop,
    restartSession: noop,
    closeForPageSwitch: noop,
    closeForPageMutation: noop,
    closeForSelectionChange: noop,
    closeForLocaleChange: noop,
    undoStorefront: () => false,
    redoStorefront: () => false,
    clearStorefrontHistory: noop,
  };
}

describe("merchant proposal change details", () => {
  it("renders the requested outcome, target, operation count and safe diagnostics", () => {
    const proposal = proposalFor("Add a campaign section.");
    render(
      createElement(DesignAgentPanel, {
        controller: panelController(proposal),
        locale: "en",
        primaryLocale: "en",
        pageTitle: "Home",
      }),
    );

    const card = screen.getByLabelText("Design proposal");
    expect(card).toHaveTextContent(proposal.summary.en!);
    expect(card).toHaveTextContent("Affected page");
    expect(card).toHaveTextContent("Home");
    expect(card).toHaveTextContent("Planned changes");
    expect(card).toHaveTextContent(String(proposal.operations.length));
    expect(card).toHaveTextContent("No warnings for this validated proposal.");
    expect(card).not.toHaveTextContent("ADD_APPROVED_SECTION");
  });

  it("announces accepting and localized retryable failure states without internal details", () => {
    const proposal = proposalFor("Make the layout more minimal.");
    const view = render(
      createElement(DesignAgentPanel, {
        controller: panelController(proposal, "accepting"),
        locale: "en",
        primaryLocale: "en",
        pageTitle: "Home",
      }),
    );
    expect(screen.getByRole("button", { name: "Applying proposal…" })).toBeDisabled();

    const failedController = panelController(proposal, "failed");
    failedController.statusMessage = "Ehdotusta ei voitu soveltaa turvallisesti.";
    view.rerender(
      createElement(DesignAgentPanel, {
        controller: failedController,
        locale: "fi",
        primaryLocale: "en",
        pageTitle: "Etusivu",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/turvallisesti/i);
    expect(screen.getByRole("button", { name: "Yritä soveltamista uudelleen" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Hylkää" })).toBeEnabled();
    expect(screen.queryByText(/Internal detail/)).not.toBeInTheDocument();
  });

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

  it("shows only sections that actually move in a partial reorder in English and Finnish", () => {
    const sectionIds = homepage.sections.map((section) => section.id);
    const reorderedIds = [...sectionIds];
    [reorderedIds[2], reorderedIds[3]] = [reorderedIds[3], reorderedIds[2]];
    const proposal = new InMemoryDesignProposalStore().create({
      originalPage: homepage,
      operations: [{ type: "REORDER_SECTIONS", sectionIds: reorderedIds }],
      context: displayContext,
    });

    const english = proposalChangeDetails(proposal, "en", "en");
    const finnish = proposalChangeDetails(proposal, "fi", "en");
    const movedSectionIds = new Set([sectionIds[2], sectionIds[3]]);

    expect(new Set(english.items.map((item) => item.sectionId))).toEqual(movedSectionIds);
    expect(english.items).toHaveLength(2);
    expect(english.items.map((item) => item.summary)).toEqual([
      "New page position: 3.",
      "New page position: 4.",
    ]);
    expect(finnish.items.map((item) => item.sectionId)).toEqual(
      english.items.map((item) => item.sectionId),
    );
    expect(finnish.items.map((item) => item.summary)).toEqual([
      "Uusi paikka sivulla: 3.",
      "Uusi paikka sivulla: 4.",
    ]);
    expect(english.representedOperationIndexes).toEqual([0]);
    expect(finnish.representedOperationIndexes).toEqual([0]);
    expect(english.complete).toBe(true);
    expect(finnish.complete).toBe(true);
    expect(english.items.some((item) => item.sectionId === sectionIds[0])).toBe(false);
    expect(english.items.some((item) => item.sectionId === sectionIds[1])).toBe(false);
    expect(english.items.some((item) => item.sectionId === sectionIds.at(-1))).toBe(false);
  });

  it("keeps acceptance blocked when a reorder has no representable moved section", () => {
    const proposal = new InMemoryDesignProposalStore().create({
      originalPage: homepage,
      operations: [
        {
          type: "REORDER_SECTIONS",
          sectionIds: homepage.sections.map((section) => section.id),
        },
      ],
      context: displayContext,
    });
    const details = proposalChangeDetails(proposal, "en", "en");

    expect(details.items).toHaveLength(0);
    expect(details.representedOperationIndexes).toHaveLength(0);
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
