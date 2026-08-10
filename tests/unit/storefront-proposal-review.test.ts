import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AiStorefrontProposal } from "@/application/ai-storefront";
import {
  aiStorefrontProviderResponseSchema,
  buildAiStorefrontProviderRequest,
  createDeterministicMockStorefrontAIProvider,
  type AiStorefrontGenerationCommand,
} from "@/application/ai-storefront-generation";
import { createStorefrontProposalReview } from "@/app/projects/[projectId]/editor/storefront-proposal-review";
import { DesignAgentPanel } from "@/app/projects/[projectId]/editor/design-agent-panel";
import type { DesignAgentSessionController } from "@/app/projects/[projectId]/editor/use-design-agent-session";
import { aurumNordicSeed } from "@/data/seed";
import { generateP905aHomepageOnlyScenarioFromBaseline } from "../helpers/p9-05a-generation-harness";

const snapshot = aurumNordicSeed.draftSnapshot;
let proposal: AiStorefrontProposal;
let homepageProposal: AiStorefrontProposal;
const homepageOnlyInstruction =
  "Redesign only the homepage as a bold modern technical landing page. Replace the current composition with a materially different layout: compact header, asymmetric hero, featured products near the top, structured collection discovery, specification-style brand story, and compact footer. Change section order, component variants, density, surfaces, and hierarchy—not just colours or typography. Preserve all products, prices, stock, media bindings, routes, and approved assets. Do not change the collection page or product page.";

beforeAll(async () => {
  const provider = createDeterministicMockStorefrontAIProvider();
  const command: AiStorefrontGenerationCommand = {
    projectId: snapshot.projectId,
    draftSnapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    storefront: {
      pageOrder: snapshot.pages.map((page) => page.id),
      pages: structuredClone(snapshot.pages),
      navigation: structuredClone(snapshot.navigation),
      brandSystem: structuredClone(snapshot.brandSystem),
    },
    affectedPageIds: snapshot.pages.map((page) => page.id),
    affectedSectionTargets: [],
    designSystemTarget: { kind: "storefrontDesignSystem", projectId: snapshot.projectId },
    merchantInstruction: "Apply a warm premium style across the storefront.",
    activeLocale: "en",
    enabledLocales: ["en", "fi"],
    requestedScope: "storefront",
    capability: "approvedColorTypographyDirection",
    providerId: provider.id,
    provider,
    importedContent: [],
  };
  const request = buildAiStorefrontProviderRequest(command, 1);
  proposal = aiStorefrontProviderResponseSchema.parse(
    await provider.proposeStorefront(request),
  ).proposal;
  homepageProposal = (
    await generateP905aHomepageOnlyScenarioFromBaseline("warmApproachable", homepageOnlyInstruction)
  ).proposal;
});

function homepageController(): DesignAgentSessionController {
  const noop = vi.fn();
  return {
    targetScope: "storefront",
    selectTarget: noop,
    selectedSectionEligible: false,
    request: homepageOnlyInstruction,
    setRequest: noop,
    clarificationAnswer: "",
    setClarificationAnswer: noop,
    revision: "",
    setRevision: noop,
    session: {
      state: "proposalReady",
      status: { en: "Proposal ready.", fi: "Ehdotus valmis." },
      selectedSectionId: null,
      affectedSectionIds: homepageProposal.operations.flatMap(({ operation }) =>
        "sectionId" in operation ? [operation.sectionId] : [],
      ),
      assumptions: [],
      clarificationQuestion: null,
      failure: null,
    },
    generatedProposal: null,
    generatedStorefrontProposal: homepageProposal,
    visibleState: "proposalReady",
    statusMessage: "Proposal ready.",
    previewActive: true,
    blocksSave: true,
    controlsDisabled: false,
    generationRetryAvailable: false,
    controlledStorefrontAcceptance: false,
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

describe("P4-05D storefront proposal review projection", () => {
  it("keeps a controlled imported proposal available for accept or reject only", () => {
    render(
      createElement(DesignAgentPanel, {
        controller: { ...homepageController(), controlledStorefrontAcceptance: true },
        locale: "en",
        primaryLocale: "en",
        pageTitle: "Homepage",
        storefrontPageCount: 3,
      }),
    );

    expect(screen.getByLabelText("Homepage design proposal")).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept and apply" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Regenerate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("How should this proposal change?")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Entire storefront" })).toBeDisabled();
    expect(screen.getByLabelText("Your request")).toBeDisabled();
    expect(screen.getByText(/controlled acceptance uses the generated proposal/i)).toBeVisible();
  });

  it("presents homepage-only scope and operation-derived confirmation copy in English and Finnish", () => {
    const englishReview = createStorefrontProposalReview(homepageProposal, "en", "en");
    const finnishReview = createStorefrontProposalReview(homepageProposal, "fi", "fi");

    expect(englishReview).toMatchObject({
      scope: "homepage",
      scopeLabel: "Homepage",
      affectedPageCount: 1,
      operationCount: 1,
      globalChanges: [],
    });
    expect(englishReview.heading).toBe("Homepage proposal · 1 planned layout change");
    expect(englishReview.confirmationBody).not.toMatch(
      /shared|collection|product page|multiple pages/i,
    );
    expect(finnishReview.scopeLabel).toBe("Etusivu");
    expect(finnishReview.heading).toContain("Etusivuehdotus");
    expect(finnishReview.confirmationBody).toContain("vain etusivun");

    const english = render(
      createElement(DesignAgentPanel, {
        controller: homepageController(),
        locale: "en",
        primaryLocale: "en",
        pageTitle: "Homepage",
        storefrontPageCount: 3,
      }),
    );
    const panel = screen.getByLabelText("Homepage design proposal");
    expect(panel).toHaveTextContent("Affected scopeHomepage");
    expect(panel).toHaveTextContent("Affected pages1");
    expect(panel).not.toHaveTextContent("Shared storefront design");
    expect(panel).not.toHaveTextContent("Entire storefront");
    fireEvent.click(screen.getByRole("button", { name: "Accept and apply" }));
    expect(screen.getByRole("dialog", { name: "Apply this homepage proposal?" })).toHaveTextContent(
      "This updates only the homepage",
    );
    expect(screen.getByRole("button", { name: "Apply homepage proposal" })).toBeVisible();
    english.unmount();

    render(
      createElement(DesignAgentPanel, {
        controller: homepageController(),
        locale: "fi",
        primaryLocale: "fi",
        pageTitle: "Etusivu",
        storefrontPageCount: 3,
      }),
    );
    expect(screen.getByLabelText("Etusivun suunnitteluehdotus")).toHaveTextContent(
      "Muutoksen laajuusEtusivu",
    );
    fireEvent.click(screen.getByRole("button", { name: "Hyväksy ja käytä" }));
    expect(
      screen.getByRole("dialog", { name: "Otetaanko tämä etusivuehdotus käyttöön?" }),
    ).toHaveTextContent("vain etusivun");
    expect(screen.getByRole("button", { name: "Ota etusivuehdotus käyttöön" })).toBeVisible();
  });

  it("represents every affected storefront page", () => {
    const review = createStorefrontProposalReview(proposal, "en", "en");
    expect(review.pages).toHaveLength(proposal.target.affectedPageIds.length);
    expect(review.affectedPageCount).toBe(proposal.target.affectedPageIds.length);
  });

  it("represents every validated operation exactly once", () => {
    const review = createStorefrontProposalReview(proposal, "en", "en");
    expect(review.representedOperationIndexes).toEqual(
      proposal.operations.map((_operation, index) => index),
    );
    expect(review.operationCount).toBe(proposal.operations.length);
  });

  it("groups explicit colour and typography operations as shared design changes", () => {
    const review = createStorefrontProposalReview(proposal, "en", "en");
    expect(review.globalChanges.map((change) => change.summary).join(" ")).toMatch(
      /brand colours.*brand typography/i,
    );
  });

  it("groups section operations beneath their merchant-readable pages", () => {
    const review = createStorefrontProposalReview(proposal, "en", "en");
    expect(review.pages.map((page) => page.title)).toEqual([
      "Homepage",
      "Rings",
      "Aurora Ring 585",
    ]);
    expect(review.pages.every((page) => page.items.length > 0)).toBe(true);
  });

  it("represents registered page compositions with bilingual merchant summaries", () => {
    const registered = structuredClone(proposal);
    const pageId = registered.target.affectedPageIds[0];
    const page = registered.proposedStorefront.pages.find((candidate) => candidate.id === pageId)!;
    registered.operations.push({
      order: registered.operations.length,
      target: { kind: "page", pageId },
      operation: {
        type: "APPLY_REGISTERED_PAGE_SECTIONS",
        sections: structuredClone(page.sections),
        removedSectionIds: [],
      },
    });

    const english = createStorefrontProposalReview(registered, "en", "en");
    const finnish = createStorefrontProposalReview(registered, "fi", "en");

    expect(english.complete).toBe(true);
    expect(
      english.pages
        .find((candidate) => candidate.pageId === pageId)
        ?.items.map((item) => item.summary),
    ).toContain(`Approved page composition with ${page.sections.length} sections.`);
    expect(
      finnish.pages
        .find((candidate) => candidate.pageId === pageId)
        ?.items.map((item) => item.summary),
    ).toContain(`Hyväksytty ${page.sections.length} osion sivurakenne.`);
  });

  it("renders Finnish merchant-readable page and section copy", () => {
    const review = createStorefrontProposalReview(proposal, "fi", "en");
    expect(review.pages[0].title).toBe("Etusivu");
    expect(
      review.pages
        .flatMap((page) => page.items)
        .map((item) => item.summary)
        .join(" "),
    ).toMatch(/tausta|typografia/);
  });

  it("blocks acceptance when an affected proposed page is missing", () => {
    const malformed = structuredClone(proposal);
    malformed.proposedStorefront.pages = malformed.proposedStorefront.pages.slice(1);
    const review = createStorefrontProposalReview(malformed, "en", "en");
    expect(review.complete).toBe(false);
    expect(review.blockers).toContain("One affected page cannot be represented safely.");
  });

  it("blocks acceptance when a global design change lacks reviewable operation coverage", () => {
    const malformed = structuredClone(proposal);
    malformed.operations = malformed.operations
      .filter(({ operation }) => operation.type !== "APPLY_APPROVED_BRAND_COLOURS")
      .map((operation, order) => ({ ...operation, order }));
    const review = createStorefrontProposalReview(malformed, "en", "en");
    expect(review.complete).toBe(false);
    expect(review.blockers).toContain(
      "The global storefront design changes are not fully represented.",
    );
  });

  it("marks a fully represented canonical proposal complete and blocker-free", () => {
    const review = createStorefrontProposalReview(proposal, "en", "en");
    expect(review.complete).toBe(true);
    expect(review.blockers).toEqual([]);
  });

  it("does not expose raw identities, operations, fingerprints, or JSON", () => {
    const review = createStorefrontProposalReview(proposal, "en", "en");
    const merchantCopy = JSON.stringify({
      globalChanges: review.globalChanges,
      pages: review.pages.map(({ title, items }) => ({ title, items })),
      warnings: review.warnings,
      blockers: review.blockers,
    });
    expect(merchantCopy).not.toMatch(
      /page_home|section_home|storefront_proposal_|storefront-target-|APPLY_APPROVED|"type":/,
    );
  });
});
