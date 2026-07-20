import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiProposalConfirmationOrchestrator } from "@/application/ai-proposal-confirmation";
import {
  AiProposalGenerationOrchestrator,
  type AiProposalEditorIdentity,
  type GeneratedAiProposal,
} from "@/application/ai-proposal-generation";
import { createDeterministicMockAIProvider } from "@/application/ai-provider";
import { InMemoryDesignProposalStore } from "@/application/design-operations";
import { CanonicalEditorHistory } from "@/application/editor-history";
import { DesignAgentPanel } from "@/app/projects/[projectId]/editor/design-agent-panel";
import type { DesignAgentSessionController } from "@/app/projects/[projectId]/editor/use-design-agent-session";
import { createStorefrontRenderContext, validateRegisteredPage } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";

const page = aurumNordicSeed.draftSnapshot.pages.find((candidate) => candidate.type === "home")!;
const displayContext = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: aurumNordicSeed.draftSnapshot,
});

function identity(currentPage = page): AiProposalEditorIdentity {
  return {
    projectId: aurumNordicSeed.project.id,
    draftSnapshotId: aurumNordicSeed.draftSnapshot.id,
    draftRevision: aurumNordicSeed.draftSnapshot.revision,
    target: { type: "page", pageId: page.id },
    page: structuredClone(currentPage),
  };
}

async function readyProposal(
  proposalStore: InMemoryDesignProposalStore,
  currentIdentity: () => AiProposalEditorIdentity,
) {
  const generation = new AiProposalGenerationOrchestrator({ proposalStore, currentIdentity });
  const result = await generation.generate({
    ...identity(),
    merchantInstruction: "Make the homepage feel more luxurious.",
    activeLocale: "en",
    enabledLocales: ["en", "fi"],
    brandSystem: aurumNordicSeed.draftSnapshot.brandSystem,
    displayContext,
    importedContent: [],
    provider: createDeterministicMockAIProvider(),
  });
  if (result.state !== "proposalReady") throw new Error("Expected a ready P4-03 proposal.");
  return result.proposal;
}

function controller(
  generatedProposal: GeneratedAiProposal,
  acceptProposal: () => void,
  rejectProposal: () => void,
): DesignAgentSessionController {
  const noop = vi.fn();
  const proposal = generatedProposal.proposal;
  return {
    request: "Make the homepage feel more luxurious.",
    setRequest: noop,
    clarificationAnswer: "",
    setClarificationAnswer: noop,
    revision: "",
    setRevision: noop,
    session: {
      state: "proposalReady",
      status: { en: "The proposal is ready to review.", fi: "Ehdotus on valmis." },
      selectedSectionId: null,
      affectedSectionIds: [
        ...new Set(
          proposal.operations.flatMap((operation) =>
            "sectionId" in operation ? [operation.sectionId] : [],
          ),
        ),
      ],
      assumptions: [],
      clarificationQuestion: null,
      failure: null,
    },
    generatedProposal,
    visibleState: "proposalReady",
    statusMessage: "The proposal is ready to review.",
    previewActive: true,
    blocksSave: true,
    controlsDisabled: false,
    generationRetryAvailable: false,
    submitRequest: noop,
    retryGeneration: noop,
    answerClarification: noop,
    reviseProposal: noop,
    regenerateProposal: noop,
    acceptProposal,
    rejectProposal,
    cancelSession: noop,
    restartSession: noop,
    closeForPageSwitch: noop,
    closeForPageMutation: noop,
    closeForSelectionChange: noop,
    closeForLocaleChange: noop,
  };
}

describe("P4-03 to P4-02 proposal confirmation integration", () => {
  it("renders the canonical ready proposal and accepts it as one undoable draft mutation", async () => {
    const proposalStore = new InMemoryDesignProposalStore();
    let current = identity();
    const generated = await readyProposal(proposalStore, () => current);
    const confirmation = new AiProposalConfirmationOrchestrator({
      proposalStore,
      currentIdentity: () => current,
    });
    const opened = confirmation.open(generated);
    const history = new CanonicalEditorHistory({
      validatePage: (candidate) => validateRegisteredPage(candidate, displayContext),
    });
    history.initialize(page);
    const publishedBefore = structuredClone(aurumNordicSeed.publishedSnapshot);
    let accepted = false;
    const accept = () => {
      if (accepted) return;
      accepted = true;
      expect(confirmation.beginAcceptance().state).toBe("accepting");
      const result = confirmation.completeAcceptance((acceptedPage) => {
        current = { ...current, page: history.commit(acceptedPage, "Apply design proposal") };
      });
      expect(result.state).toBe("accepted");
    };

    render(
      createElement(DesignAgentPanel, {
        controller: controller(generated, accept, vi.fn()),
        locale: "en",
        primaryLocale: "en",
        pageTitle: "Home",
      }),
    );

    expect(screen.getByLabelText("Design proposal")).toHaveTextContent("Affected page");
    expect(opened.generatedProposal?.permissionGrants).toEqual(generated.permissionGrants);
    expect(opened.generatedProposal?.targetFingerprint).toBe(generated.targetFingerprint);
    expect(opened.generatedProposal?.permissionFingerprint).toBe(generated.permissionFingerprint);
    expect(history.current(page.id)).toEqual(page);

    fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));

    expect(history.current(page.id)).toEqual(generated.proposal.proposedPage);
    expect(history.inspectTransactions(page.id).past).toHaveLength(1);
    expect(history.undo(page.id)).toEqual(page);
    expect(aurumNordicSeed.publishedSnapshot).toEqual(publishedBefore);
    expect(confirmation.inspect().generatedProposal?.permissionGrants).toEqual(
      generated.permissionGrants,
    );
  });

  it("rejects without draft mutation and closes stale or explicitly closed proposals", async () => {
    const rejectionStore = new InMemoryDesignProposalStore();
    let current = identity();
    const rejectedGenerated = await readyProposal(rejectionStore, () => current);
    const rejection = new AiProposalConfirmationOrchestrator({
      proposalStore: rejectionStore,
      currentIdentity: () => current,
    });
    rejection.open(rejectedGenerated);
    const draftBefore = structuredClone(current.page);
    render(
      createElement(DesignAgentPanel, {
        controller: controller(rejectedGenerated, vi.fn(), () => rejection.reject()),
        locale: "en",
        primaryLocale: "en",
        pageTitle: "Home",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(current.page).toEqual(draftBefore);
    expect(rejection.inspect().state).toBe("rejected");
    expect(() => rejection.beginAcceptance()).toThrow(/ready or retryable/i);

    const staleStore = new InMemoryDesignProposalStore();
    current = identity();
    const staleGenerated = await readyProposal(staleStore, () => current);
    const stale = new AiProposalConfirmationOrchestrator({
      proposalStore: staleStore,
      currentIdentity: () => current,
    });
    stale.open(staleGenerated);
    const changed = structuredClone(page);
    changed.title = { en: "Newer draft", fi: "Uudempi luonnos" };
    current = identity(changed);
    expect(stale.beginAcceptance().state).toBe("stale");
    expect(staleStore.inspect(staleGenerated.proposal.id).status).toBe("rejected");
    expect(() => stale.beginAcceptance()).toThrow(/ready or retryable/i);

    const closedStore = new InMemoryDesignProposalStore();
    current = identity();
    const closedGenerated = await readyProposal(closedStore, () => current);
    const closed = new AiProposalConfirmationOrchestrator({
      proposalStore: closedStore,
      currentIdentity: () => current,
    });
    closed.open(closedGenerated);
    expect(closed.close().state).toBe("closed");
    expect(() => closed.beginAcceptance()).toThrow(/ready or retryable/i);
  });

  it("rejects changed permission grants and keeps a failed application retryable and atomic", async () => {
    const tamperedStore = new InMemoryDesignProposalStore();
    let current = identity();
    const generated = await readyProposal(tamperedStore, () => current);
    const tampered = structuredClone(generated);
    tampered.permissionGrants[0].operationTypes = [
      ...tampered.permissionGrants[0].operationTypes,
      "REMOVE_OPTIONAL_SECTION",
    ];
    const invalidConfirmation = new AiProposalConfirmationOrchestrator({
      proposalStore: tamperedStore,
      currentIdentity: () => current,
    });
    expect(invalidConfirmation.open(tampered).state).toBe("failed");
    expect(invalidConfirmation.inspect().generatedProposal).toBeNull();
    expect(tamperedStore.inspect(generated.proposal.id).status).toBe("rejected");

    const retryStore = new InMemoryDesignProposalStore();
    current = identity();
    const retryGenerated = await readyProposal(retryStore, () => current);
    const retry = new AiProposalConfirmationOrchestrator({
      proposalStore: retryStore,
      currentIdentity: () => current,
    });
    retry.open(retryGenerated);
    expect(retry.beginAcceptance().state).toBe("accepting");
    const before = structuredClone(current.page);
    const failed = retry.completeAcceptance(() => {
      throw new Error("Injected editor transaction failure.");
    });
    expect(failed.state).toBe("failed");
    expect(failed.failure?.retryable).toBe(true);
    expect(current.page).toEqual(before);
    expect(retryStore.inspect(retryGenerated.proposal.id).status).toBe("pending");

    expect(retry.beginAcceptance().state).toBe("accepting");
    expect(
      retry.completeAcceptance((acceptedPage) => {
        current = { ...current, page: structuredClone(acceptedPage) };
      }).state,
    ).toBe("accepted");
    expect(current.page).toEqual(retryGenerated.proposal.proposedPage);
  });
});
