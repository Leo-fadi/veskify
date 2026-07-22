import { describe, expect, it } from "vitest";
import { createStorefrontRenderContext } from "@/components/registry";
import {
  AiStorefrontGenerationOrchestrator,
  buildAiStorefrontProviderRequest,
  createAiStorefrontGenerationPlan,
  createDeterministicMockStorefrontAIProvider,
  validateAiStorefrontProviderResponse,
  type AiStorefrontGenerationCommand,
} from "@/application/ai-storefront-generation";
import {
  StorefrontProposalAcceptanceCoordinator,
  type AiStorefrontProposal,
} from "@/application/ai-storefront";
import { buildAiOperationRequest } from "@/application/ai-proposal-generation";
import { createDeterministicMockAIProvider } from "@/application/ai-provider";
import { aurumNordicSeed } from "@/data/seed";
import { canonicalValueString } from "@/domain/storefront";

const snapshot = aurumNordicSeed.draftSnapshot;
const home = snapshot.pages.find((page) => page.type === "home")!;
const hero = home.sections.find((section) => section.component === "hero")!;
const regressionInstruction =
  "Update the entire storefront with a Vesko-inspired colour palette: deep forest green, muted sage, warm off-white, charcoal text, and restrained soft-gold accents. Keep the current layout, typography, imagery, copy, products, prices, and section structure unchanged.";
const exactHexInstruction =
  "Apply this exact brand palette across the entire storefront: primary #173F35, secondary #82917B, accent #C2A35A, background #F7F2E8, surface #FFFFFF, text #292D2B, muted text #56615B, and border #D8D1BF. Keep typography unchanged.";

function command(
  merchantInstruction: string,
  overrides: Partial<AiStorefrontGenerationCommand> = {},
): AiStorefrontGenerationCommand {
  const provider = overrides.provider ?? createDeterministicMockStorefrontAIProvider();
  return {
    projectId: aurumNordicSeed.project.id,
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
    designSystemTarget: {
      kind: "storefrontDesignSystem",
      projectId: aurumNordicSeed.project.id,
    },
    merchantInstruction,
    activeLocale: "en",
    enabledLocales: ["en", "fi"],
    requestedScope: "storefront",
    capability: "approvedColorTypographyDirection",
    providerId: provider.id,
    provider,
    importedContent: [],
    ...overrides,
  };
}

function proposalContext(input: AiStorefrontGenerationCommand, requestSequence = 1) {
  const request = buildAiStorefrontProviderRequest(input, requestSequence);
  return {
    request,
    identity: {
      context: {
        projectId: input.projectId,
        draftSnapshotId: input.draftSnapshotId,
        draftRevision: input.draftRevision,
        enabledLocales: input.enabledLocales,
        activeLocale: input.activeLocale,
        storefront: structuredClone(input.storefront),
      },
      target: structuredClone(request.target),
    },
  };
}

async function readyProposal(input: AiStorefrontGenerationCommand) {
  const { request } = proposalContext(input);
  const response = await input.provider.proposeStorefront(request);
  return validateAiStorefrontProviderResponse(request, response).proposal;
}

function paletteOperation(proposal: AiStorefrontProposal) {
  const operations = proposal.operations.filter(
    ({ operation }) => operation.type === "APPLY_APPROVED_BRAND_COLOURS",
  );
  expect(operations).toHaveLength(1);
  const operation = operations[0].operation;
  if (operation.type !== "APPLY_APPROVED_BRAND_COLOURS") {
    throw new Error("Expected one canonical brand colour operation.");
  }
  return operation;
}

describe("P4.1-01 exact merchant brand palettes", () => {
  it("turns the required descriptive multi-colour instruction into a Ready proposal", async () => {
    const input = command(regressionInstruction);
    const { identity } = proposalContext(input);
    const orchestrator = new AiStorefrontGenerationOrchestrator({
      currentIdentity: () => structuredClone(identity),
    });

    const result = await orchestrator.generate(input);

    expect(result.state).toBe("ready");
    if (result.state !== "ready") throw new Error("Expected a Ready palette proposal.");
    expect(paletteOperation(result.proposal).colors).toMatchObject({
      primary: "#173F35",
      secondary: "#82917B",
      background: "#F7F2E8",
      text: "#292D2B",
      accent: "#C2A35A",
    });
    expect(result.proposal.operations).toHaveLength(1);
  });

  it("preserves exact role-labelled six-digit hex values", async () => {
    const input = command(exactHexInstruction);
    const plan = createAiStorefrontGenerationPlan(input);
    const proposal = await readyProposal(input);

    expect(plan.direction).toBe("exactBrandPalette");
    expect(plan.brandPalettePlan?.source).toBe("hex");
    expect(plan.brandPalettePlan?.colors).toEqual({
      primary: "#173F35",
      secondary: "#82917B",
      accent: "#C2A35A",
      background: "#F7F2E8",
      surface: "#FFFFFF",
      text: "#292D2B",
      mutedText: "#56615B",
      border: "#D8D1BF",
    });
    expect(paletteOperation(proposal).colors).toEqual(plan.brandPalettePlan?.colors);
  });

  it("keeps layout, content, navigation, and page order unchanged for a colour-only request", async () => {
    const input = command(regressionInstruction);
    const proposal = await readyProposal(input);

    expect(proposal.proposedStorefront.pages).toEqual(proposal.originalStorefront.pages);
    expect(proposal.proposedStorefront.navigation).toEqual(proposal.originalStorefront.navigation);
    expect(proposal.proposedStorefront.pageOrder).toEqual(proposal.originalStorefront.pageOrder);
  });

  it("honours explicit typography preservation with no typography permission or operation", async () => {
    const input = command(exactHexInstruction);
    const { request } = proposalContext(input);
    const proposal = await readyProposal(input);

    expect(request.permissionGrants).toEqual([
      expect.objectContaining({ operationTypes: ["APPLY_APPROVED_BRAND_COLOURS"] }),
    ]);
    expect(
      proposal.operations.some(
        ({ operation }) => operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY",
      ),
    ).toBe(false);
    expect(proposal.proposedStorefront.brandSystem.typography).toEqual(
      proposal.originalStorefront.brandSystem.typography,
    );
  });

  it("preserves imagery, product references, product facts, and all page content", async () => {
    const input = command(regressionInstruction);
    const { request } = proposalContext(input);
    const proposal = await readyProposal(input);

    expect(request).not.toHaveProperty("catalogue");
    expect(request).not.toHaveProperty("products");
    expect(proposal.proposedStorefront.pages).toEqual(input.storefront.pages);
    expect(proposal.proposedStorefront.brandSystem.imagery).toEqual(
      input.storefront.brandSystem.imagery,
    );
  });

  it("rejects invalid hex before invoking a provider", async () => {
    const input = command(
      "Set the storefront primary colour to #12GG45 and keep layout unchanged.",
    );
    let providerCalls = 0;
    const provider = {
      id: "invalid-hex-call-guard",
      proposeStorefront: () => {
        providerCalls += 1;
        return Promise.resolve({});
      },
    };
    const guarded = command(input.merchantInstruction, { provider, providerId: provider.id });
    const identity = {
      context: {
        projectId: guarded.projectId,
        draftSnapshotId: guarded.draftSnapshotId,
        draftRevision: guarded.draftRevision,
        enabledLocales: guarded.enabledLocales,
        activeLocale: guarded.activeLocale,
        storefront: structuredClone(guarded.storefront),
      },
      target: {
        scope: "storefront" as const,
        projectId: guarded.projectId,
        draftSnapshotId: guarded.draftSnapshotId,
        draftRevision: guarded.draftRevision,
        affectedPageIds: guarded.affectedPageIds,
        affectedSectionTargets: [],
        designSystemTarget: guarded.designSystemTarget,
        enabledLocales: guarded.enabledLocales,
        activeLocale: guarded.activeLocale,
      },
    };
    const orchestrator = new AiStorefrontGenerationOrchestrator({
      currentIdentity: () => identity,
    });

    const result = await orchestrator.generate(guarded);

    expect(result).toMatchObject({ state: "failed", failure: { code: "unsupportedRequest" } });
    expect(providerCalls).toBe(0);
  });

  it.each([
    ["CSS", "Set the palette with .storefront { color: #173F35; }"],
    ["code", "Set the colour with ```javascript\nalert(1)\n``` and #173F35."],
  ])("rejects %s injection before provider invocation", (_label, instruction) => {
    expect(() => createAiStorefrontGenerationPlan(command(instruction))).toThrow(/CSS|code/i);
  });

  it("rejects unknown brand token names instead of inventing a representation", () => {
    expect(() =>
      createAiStorefrontGenerationPlan(command("Set neonGlow: #FF00FF for the brand palette.")),
    ).toThrow(/not an approved brand token/i);
  });

  it("corrects only an unsafe text dependency and exposes a proposal warning", async () => {
    const instruction =
      "Apply this palette: primary #173F35, secondary #82917B, accent #C2A35A, background #FFFFFF, surface #FFFFFF, text #FFFFFF, muted text #555555, border #D8D1BF.";
    const input = command(instruction);
    const plan = createAiStorefrontGenerationPlan(input);
    const proposal = await readyProposal(input);

    expect(plan.brandPalettePlan?.colors.text).toBe("#111111");
    expect(plan.brandPalettePlan?.correctedTokens).toEqual(["text"]);
    expect(plan.brandPalettePlan?.warnings).toHaveLength(1);
    expect(proposal.summary.en).toMatch(/contrast.*adjusted/i);
    expect(paletteOperation(proposal).colors).toEqual(plan.brandPalettePlan?.colors);
  });

  it("does not grant global tokens to a selected-section palette request", () => {
    const before = structuredClone(snapshot.brandSystem);
    const displayContext = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot,
    });

    expect(() =>
      buildAiOperationRequest({
        projectId: aurumNordicSeed.project.id,
        draftSnapshotId: snapshot.id,
        draftRevision: snapshot.revision,
        page: home,
        target: { type: "section", pageId: home.id, sectionId: hero.id },
        merchantInstruction: "Set this section colour to deep forest green.",
        activeLocale: "en",
        enabledLocales: ["en", "fi"],
        brandSystem: snapshot.brandSystem,
        displayContext,
        importedContent: [],
        provider: createDeterministicMockAIProvider(),
      }),
    ).toThrow(/not supported|specific/i);
    expect(snapshot.brandSystem).toEqual(before);

    expect(() =>
      createAiStorefrontGenerationPlan(
        command(regressionInstruction, { designSystemTarget: null }),
      ),
    ).toThrow(/explicit storefront design-system target/i);
  });

  it("keeps deterministic mock-provider output byte-for-byte repeatable", async () => {
    const input = command(regressionInstruction);
    const { request } = proposalContext(input);

    const first = await input.provider.proposeStorefront(request);
    const second = await input.provider.proposeStorefront(request);

    expect(first).toEqual(second);
  });

  it("leaves active, stored, published, and history state unchanged when acceptance fails", async () => {
    const input = command(regressionInstruction);
    const proposal = structuredClone(await readyProposal(input));
    paletteOperation(proposal).colors.primary = "#315A7D";
    const coordinator = new StorefrontProposalAcceptanceCoordinator({
      proposal,
      activeDraft: structuredClone(snapshot),
      storedDraft: structuredClone(snapshot),
      publishedSnapshot: structuredClone(aurumNordicSeed.publishedSnapshot),
      catalogue: structuredClone(aurumNordicSeed.catalogue),
      enabledLocales: ["en", "fi"],
      activeLocale: "en",
      primaryLocale: "en",
    });
    const before = coordinator.inspect();

    const failed = coordinator.accept();

    expect(failed.state).toBe("failed");
    expect(failed.activeDraft).toEqual(before.activeDraft);
    expect(failed.storedDraft).toEqual(before.storedDraft);
    expect(failed.publishedSnapshot).toEqual(before.publishedSnapshot);
    expect(canonicalValueString(coordinator.inspectHistory())).toBe(
      canonicalValueString({ past: [], future: [] }),
    );
  });
});
