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
import { migrateLegacyDynamicCommerceRoutes } from "@/application/dynamic-commerce-routes";
import { aurumNordicSeed } from "@/data/seed";
import { generateP905aHomepageOnlyScenarioFromBaseline } from "../helpers/p9-05a-generation-harness";
import { createLegacyDynamicCommerceRouteScenario } from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";

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

function dynamicCommerceMigrationProposal(): AiStorefrontProposal {
  const { catalogue, legacySnapshot } = createLegacyDynamicCommerceRouteScenario();
  const migration = migrateLegacyDynamicCommerceRoutes(legacySnapshot, catalogue);
  if (migration.status !== "migrated") throw new Error("The review fixture did not migrate.");
  const operations: AiStorefrontProposal["operations"] = legacySnapshot.pages.map(
    (page, order) => ({
      order,
      target: { kind: "page", pageId: page.id },
      operation: {
        type: "APPLY_REGISTERED_PAGE_SECTIONS",
        sections: structuredClone(page.sections),
        removedSectionIds: [],
      },
    }),
  );
  return {
    ...structuredClone(proposal),
    projectId: legacySnapshot.projectId,
    draftSnapshotId: legacySnapshot.id,
    draftRevision: legacySnapshot.revision,
    target: {
      ...structuredClone(proposal.target),
      scope: "storefront",
      projectId: legacySnapshot.projectId,
      draftSnapshotId: legacySnapshot.id,
      draftRevision: legacySnapshot.revision,
      affectedPageIds: legacySnapshot.pages.map(({ id }) => id),
      affectedSectionTargets: [],
      designSystemTarget: null,
    },
    originalStorefront: {
      pageOrder: legacySnapshot.pages.map(({ id }) => id),
      pages: structuredClone(legacySnapshot.pages),
      navigation: structuredClone(legacySnapshot.navigation),
      brandSystem: structuredClone(legacySnapshot.brandSystem),
    },
    proposedStorefront: {
      pageOrder: migration.snapshot.pages.map(({ id }) => id),
      pages: structuredClone(migration.snapshot.pages),
      navigation: structuredClone(migration.snapshot.navigation),
      brandSystem: structuredClone(migration.snapshot.brandSystem),
      dynamicCommercePresentation: structuredClone(migration.authority),
    },
    affectedPages: structuredClone(legacySnapshot.pages),
    affectedDesignState: null,
    operations,
    dynamicCommerceMigration: {
      kind: "canonicalDynamicCommerceMigration",
      contractVersion: "1.0.0",
      legacyProjectionFingerprint: `v1_1_${"a".repeat(64)}`,
      resultingProjectionFingerprint: `v1_1_${"b".repeat(64)}`,
      resultingAuthorityFingerprint: migration.authority.authorityFingerprint,
    },
  };
}

function canonicalGenerationProposal(): AiStorefrontProposal {
  const { snapshot } = (() => {
    const scenario = createLegacyDynamicCommerceRouteScenario();
    const migration = migrateLegacyDynamicCommerceRoutes(
      scenario.legacySnapshot,
      scenario.catalogue,
    );
    if (migration.status !== "migrated") throw new Error("The generation fixture did not migrate.");
    return { snapshot: migration.snapshot };
  })();
  const sourcePage = snapshot.pages.find(({ type }) => type === "home") ?? snapshot.pages[0];
  if (!sourcePage) throw new Error("The generation fixture requires one raw source page.");
  const proposedStorefront = {
    pageOrder: snapshot.pages.map(({ id }) => id),
    pages: structuredClone(snapshot.pages),
    navigation: structuredClone(snapshot.navigation),
    brandSystem: structuredClone(snapshot.brandSystem),
    dynamicCommercePresentation: structuredClone(snapshot.dynamicCommercePresentation),
  };
  return {
    ...structuredClone(proposal),
    target: {
      ...structuredClone(proposal.target),
      scope: "storefront",
      affectedPageIds: [sourcePage.id],
      affectedSectionTargets: [],
    },
    originalStorefront: {
      pageOrder: [sourcePage.id],
      pages: [structuredClone(sourcePage)],
      navigation: structuredClone(snapshot.navigation),
      brandSystem: structuredClone(snapshot.brandSystem),
      dynamicCommercePresentation: structuredClone(snapshot.dynamicCommercePresentation),
    },
    proposedStorefront,
    affectedPages: [structuredClone(sourcePage)],
    affectedDesignState: null,
    permissionGrants: [],
    operations: [],
    assetPlacementOperations: [],
    dynamicCommerceMigration: undefined,
    wholeStorefrontGeneration: {
      kind: "canonicalWholeStorefrontGeneration",
      contractVersion: "1.0.0",
      order: 0,
      operationType: "APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION",
      target: {
        kind: "storefront",
        projectId: proposal.projectId,
        draftSnapshotId: proposal.draftSnapshotId,
        draftRevision: proposal.draftRevision,
      },
      permission: {
        skillId: "compilePromptedStorefrontDesignIntentV2",
        skillVersion: "2.0.0",
        skillScope: "storefront",
        operationTypes: ["APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION"],
        target: {
          kind: "storefront",
          projectId: proposal.projectId,
          draftSnapshotId: proposal.draftSnapshotId,
          draftRevision: proposal.draftRevision,
        },
      },
      requestFingerprint: "request-fingerprint",
      promptFingerprint: "prompt-fingerprint",
      providerIntentFingerprint: "provider-intent-fingerprint",
      sourceProposalFingerprint: "source-proposal-fingerprint",
      synthesisFingerprint: "synthesis-fingerprint",
      structuralFingerprint: "structural-fingerprint",
      candidateSnapshotFingerprint: "resulting-snapshot",
      sourceProjectionFingerprint: "source-projection",
      operationProjectionFingerprint: "source-projection",
      resultingProjectionFingerprint: "resulting-projection",
      resultingSnapshotFingerprint: "resulting-snapshot",
      compiledDecisionFingerprint: "compiled-decision",
      materializationAuthorityFingerprint: "materialization-authority",
    },
  };
}

describe("P4-05D storefront proposal review projection", () => {
  it("represents the exact canonical generation candidate instead of reporting zero legacy operations", () => {
    const generated = canonicalGenerationProposal();
    const authority = generated.proposedStorefront.dynamicCommercePresentation;
    if (!authority) throw new Error("The generated review fixture requires route authority.");
    const review = createStorefrontProposalReview(generated, "en", "en");

    expect(review.complete).toBe(true);
    expect(review.operationCount).toBe(1);
    expect(review.materialChangeCount).toBeGreaterThan(1);
    expect(review.pages.map(({ pageId }) => pageId)).toEqual(
      generated.proposedStorefront.pageOrder,
    );
    expect(review.pages.every(({ items }) => items.length === 1)).toBe(true);
    expect(review.pages[0]?.items[0]?.summary).toMatch(/complete page composition/i);
    expect(review.dynamicCommerceConvergence).toBeNull();
    expect(review.canonicalGeneration).toMatchObject({
      staticPageCount: generated.proposedStorefront.pages.length,
      collectionSearchArchetypeCount: authority.collectionSearchArchetypes.length,
      productDetailArchetypeCount: authority.productDetailArchetypes.length,
      runtimeRouteCount: authority.routeInventory.length,
    });
    expect(review.heading).toMatch(/static pages.*commerce design archetypes/i);
    expect(review.confirmationBody).toMatch(/raw starting state.*one unsaved draft change/i);
  });

  it("reviews legacy route convergence as canonical static pages and reusable archetypes", () => {
    const migrationProposal = dynamicCommerceMigrationProposal();
    const migrationAuthority = migrationProposal.proposedStorefront.dynamicCommercePresentation;
    if (!migrationAuthority) throw new Error("The review fixture has no migration authority.");
    const review = createStorefrontProposalReview(migrationProposal, "en", "en");

    expect(review.complete).toBe(true);
    expect(review.blockers).toEqual([]);
    expect(review.pages).toHaveLength(migrationProposal.proposedStorefront.pages.length);
    expect(review.affectedPageCount).toBe(
      migrationProposal.proposedStorefront.pages.length +
        migrationAuthority.collectionSearchArchetypes.length +
        migrationAuthority.productDetailArchetypes.length,
    );
    expect(review.dynamicCommerceConvergence).toMatchObject({
      staticPageCount: migrationProposal.proposedStorefront.pages.length,
      collectionSearchArchetypeCount: 3,
      productDetailArchetypeCount: 3,
      archetypeCount: 6,
      runtimeRouteCount: 20,
      collectionRouteCount: 9,
      productRouteCount: 10,
      searchRouteCount: 1,
    });
    expect(review.dynamicCommerceConvergence?.operationIndexes).toHaveLength(20);
    expect(review.dynamicCommerceConvergence?.summary).toMatch(
      /20 product, collection, and search route-specific designs converge into 6 reusable design archetypes/i,
    );
    expect(review.dynamicCommerceConvergence?.protectedBindingSummary).toMatch(
      /ordered collection membership.*canonical product media remain protected/i,
    );
    expect(review.confirmationBody).toMatch(
      /route-specific pages converge.*protected Vesko commerce bindings remain unchanged/i,
    );
    expect(review.representedOperationIndexes).toEqual(
      migrationProposal.operations.map((_operation, index) => index),
    );
  });

  it("discloses canonical migration counts and protected bindings before acceptance", () => {
    const migrationProposal = dynamicCommerceMigrationProposal();
    render(
      createElement(DesignAgentPanel, {
        controller: {
          ...homepageController(),
          generatedStorefrontProposal: migrationProposal,
          session: {
            ...homepageController().session!,
            affectedSectionIds: migrationProposal.operations.flatMap(({ operation }) =>
              "sectionId" in operation ? [operation.sectionId] : [],
            ),
          },
          controlledStorefrontAcceptance: true,
        },
        locale: "en",
        primaryLocale: "en",
        pageTitle: "Homepage",
        storefrontPageCount: 14,
      }),
    );

    const disclosure = screen.getByTestId("dynamic-commerce-migration-review");
    expect(disclosure).toHaveTextContent("Canonical dynamic-commerce route convergence");
    expect(disclosure).toHaveTextContent("Static pages13");
    expect(disclosure).toHaveTextContent("Commerce archetypes6");
    expect(disclosure).toHaveTextContent("Runtime commerce routes20");
    expect(disclosure).toHaveTextContent("canonical product media remain protected");
    expect(screen.getByRole("button", { name: "Accept and apply" })).toBeEnabled();
  });

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
