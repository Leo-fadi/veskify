import { beforeAll, describe, expect, it } from "vitest";
import type { AiStorefrontProposal } from "@/application/ai-storefront";
import {
  aiStorefrontProviderResponseSchema,
  buildAiStorefrontProviderRequest,
  createDeterministicMockStorefrontAIProvider,
  type AiStorefrontGenerationCommand,
} from "@/application/ai-storefront-generation";
import { createStorefrontProposalReview } from "@/app/projects/[projectId]/editor/storefront-proposal-review";
import { aurumNordicSeed } from "@/data/seed";

const snapshot = aurumNordicSeed.draftSnapshot;
let proposal: AiStorefrontProposal;

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
});

describe("P4-05D storefront proposal review projection", () => {
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
