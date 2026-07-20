import { describe, expect, it } from "vitest";
import {
  AiStorefrontGenerationOrchestrator,
  buildAiStorefrontProviderRequest,
  createDeterministicMockStorefrontAIProvider,
  type AiStorefrontGenerationCommand,
  type AiStorefrontGenerationEvent,
  type AiStorefrontGenerationIdentity,
  type AiStorefrontProviderRequest,
  type StorefrontAIProvider,
} from "@/application/ai-storefront-generation";
import { aurumNordicSeed } from "@/data/seed";

const snapshot = aurumNordicSeed.draftSnapshot;
const home = snapshot.pages.find((page) => page.type === "home")!;
const collection = snapshot.pages.find((page) => page.type === "collection")!;
const product = snapshot.pages.find((page) => page.type === "product")!;

class DeferredStorefrontProvider implements StorefrontAIProvider {
  readonly id = "deterministic-storefront-mock";
  readonly calls: AiStorefrontProviderRequest[] = [];
  readonly #resolvers: Array<(value: unknown) => void> = [];

  proposeStorefront(request: AiStorefrontProviderRequest): Promise<unknown> {
    this.calls.push(structuredClone(request));
    return new Promise((resolve) => this.#resolvers.push(resolve));
  }

  async resolve(index: number) {
    const response = await createDeterministicMockStorefrontAIProvider().proposeStorefront(
      this.calls[index],
    );
    this.#resolvers[index](response);
  }
}

function command(
  storefrontProvider: StorefrontAIProvider,
  overrides: Partial<AiStorefrontGenerationCommand> = {},
): AiStorefrontGenerationCommand {
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
    affectedPageIds: [home.id, collection.id],
    affectedSectionTargets: [],
    designSystemTarget: {
      kind: "storefrontDesignSystem",
      projectId: aurumNordicSeed.project.id,
    },
    merchantInstruction: "Apply a warm premium style across the storefront.",
    activeLocale: "en",
    enabledLocales: ["en", "fi"],
    requestedScope: "storefront",
    capability: "approvedColorTypographyDirection",
    providerId: storefrontProvider.id,
    provider: storefrontProvider,
    importedContent: [],
    ...overrides,
  };
}

function identity(input: AiStorefrontGenerationCommand): AiStorefrontGenerationIdentity {
  const request = buildAiStorefrontProviderRequest(input, 1);
  return {
    context: {
      projectId: input.projectId,
      draftSnapshotId: input.draftSnapshotId,
      draftRevision: input.draftRevision,
      enabledLocales: [...request.enabledLocales],
      activeLocale: request.activeLocale,
      storefront: structuredClone(input.storefront),
    },
    target: structuredClone(request.target),
  };
}

function setup() {
  const storefrontProvider = new DeferredStorefrontProvider();
  const input = command(storefrontProvider);
  let current = identity(input);
  const events: AiStorefrontGenerationEvent[] = [];
  const orchestrator = new AiStorefrontGenerationOrchestrator({
    currentIdentity: () => structuredClone(current),
    analytics: { record: (event) => events.push(structuredClone(event)) },
  });
  return {
    storefrontProvider,
    input,
    events,
    orchestrator,
    setCurrent: (next: AiStorefrontGenerationIdentity) => {
      current = structuredClone(next);
    },
    current: () => structuredClone(current),
  };
}

describe("P4-05B storefront generation orchestration", () => {
  it("invokes the provider exactly once and creates one ready proposal without mutation", async () => {
    const fixture = setup();
    const activeDraft = structuredClone(fixture.input.storefront);
    const published = structuredClone(aurumNordicSeed.publishedSnapshot);
    const pending = fixture.orchestrator.generate(fixture.input);
    expect(fixture.storefrontProvider.calls).toHaveLength(1);
    expect(fixture.orchestrator.inspect().state).toBe("generating");
    await fixture.storefrontProvider.resolve(0);
    const result = await pending;
    expect(result.state).toBe("ready");
    expect(result.proposal?.target.affectedPageIds).toEqual(
      [...fixture.input.affectedPageIds].sort(),
    );
    expect(fixture.input.storefront).toEqual(activeDraft);
    expect(aurumNordicSeed.publishedSnapshot).toEqual(published);
  });

  it("deduplicates identical pending submissions", async () => {
    const fixture = setup();
    const first = fixture.orchestrator.generate(fixture.input);
    const second = fixture.orchestrator.generate({
      ...fixture.input,
      storefront: structuredClone(fixture.input.storefront),
      affectedPageIds: [...fixture.input.affectedPageIds],
      affectedSectionTargets: [...fixture.input.affectedSectionTargets],
      enabledLocales: [...fixture.input.enabledLocales],
    });
    expect(first).toBe(second);
    expect(fixture.storefrontProvider.calls).toHaveLength(1);
    await fixture.storefrontProvider.resolve(0);
    expect((await first).state).toBe("ready");
  });

  it.each([
    ["casing", "apply a warm premium style across the storefront."],
    ["trailing punctuation", "Apply a warm premium style across the storefront!!!"],
    ["whitespace", "  Apply   a warm premium style across the storefront.  "],
  ])("deduplicates equivalent %s while pending", async (_equivalence, merchantInstruction) => {
    const fixture = setup();
    const first = fixture.orchestrator.generate(fixture.input);
    const second = fixture.orchestrator.generate({ ...fixture.input, merchantInstruction });
    expect(second).toBe(first);
    expect(fixture.storefrontProvider.calls).toHaveLength(1);
    await fixture.storefrontProvider.resolve(0);
    expect((await second).state).toBe("ready");
  });

  it("deduplicates Unicode-equivalent instructions while pending", async () => {
    const fixture = setup();
    const composed = command(fixture.storefrontProvider, {
      merchantInstruction: "Käytä lämmintä premium-ilmettä koko kaupassa.",
    });
    const first = fixture.orchestrator.generate(composed);
    const second = fixture.orchestrator.generate({
      ...composed,
      merchantInstruction: composed.merchantInstruction.normalize("NFD"),
    });
    expect(second).toBe(first);
    expect(fixture.storefrontProvider.calls).toHaveLength(1);
    await fixture.storefrontProvider.resolve(0);
    expect((await second).state).toBe("ready");
  });

  it("lets a newer request supersede an older result", async () => {
    const fixture = setup();
    const older = fixture.orchestrator.generate(fixture.input);
    const newerCommand = command(fixture.storefrontProvider, {
      merchantInstruction:
        "Use a minimal Nordic colour and typography direction throughout the site.",
    });
    fixture.setCurrent(identity(newerCommand));
    const newer = fixture.orchestrator.generate(newerCommand);
    expect(fixture.storefrontProvider.calls).toHaveLength(2);
    await fixture.storefrontProvider.resolve(1);
    expect((await newer).state).toBe("ready");
    await fixture.storefrontProvider.resolve(0);
    expect((await older).state).toBe("superseded");
    expect(fixture.orchestrator.inspect().state).toBe("ready");
  });

  it("marks relevant page changes stale", async () => {
    const fixture = setup();
    const pending = fixture.orchestrator.generate(fixture.input);
    const changed = fixture.current();
    changed.context.storefront.pages.find((page) => page.id === home.id)!.title.en =
      "Relevant change";
    fixture.setCurrent(changed);
    await fixture.storefrontProvider.resolve(0);
    const result = await pending;
    expect(result.state).toBe("stale");
    expect(result.failure?.code).toBe("staleDraft");
  });

  it("marks an untargeted page change stale without creating a ready proposal", async () => {
    const fixture = setup();
    const pending = fixture.orchestrator.generate(fixture.input);
    const changed = fixture.current();
    changed.context.storefront.pages.find((page) => page.id === product.id)!.title.en =
      "Untargeted merchant edit";
    fixture.setCurrent(changed);
    await fixture.storefrontProvider.resolve(0);
    const result = await pending;
    expect(result.state).toBe("stale");
    expect(result.proposal).toBeNull();
    expect(fixture.orchestrator.inspect()).toMatchObject({ state: "stale", proposal: null });
  });

  it.each([
    [
      "navigation",
      (current: AiStorefrontGenerationIdentity) =>
        current.context.storefront.navigation.primary.reverse(),
    ],
    [
      "page ordering",
      (current: AiStorefrontGenerationIdentity) => {
        current.context.storefront.pageOrder.reverse();
        current.context.storefront.pages.reverse();
      },
    ],
  ])("marks %s changes stale", async (_change, mutate) => {
    const fixture = setup();
    const pending = fixture.orchestrator.generate(fixture.input);
    const changed = fixture.current();
    mutate(changed);
    fixture.setCurrent(changed);
    await fixture.storefrontProvider.resolve(0);
    expect((await pending).failure?.code).toBe("staleDraft");
  });

  it("ignores unrelated volatile UI state", async () => {
    const fixture = setup();
    const pending = fixture.orchestrator.generate(fixture.input);
    const unchangedIdentityWithUiState = {
      ...fixture.current(),
      uiState: { zoom: 0.8, panel: "layers" },
    };
    fixture.setCurrent(unchangedIdentityWithUiState);
    await fixture.storefrontProvider.resolve(0);
    expect((await pending).state).toBe("ready");
  });

  it("marks relevant design-system changes stale", async () => {
    const fixture = setup();
    const pending = fixture.orchestrator.generate(fixture.input);
    const changed = fixture.current();
    changed.context.storefront.brandSystem.colors.accent = "#B8860B";
    fixture.setCurrent(changed);
    await fixture.storefrontProvider.resolve(0);
    expect((await pending).failure?.code).toBe("staleDraft");
  });

  it("treats target changes as stale", async () => {
    const fixture = setup();
    const pending = fixture.orchestrator.generate(fixture.input);
    const changed = fixture.current();
    fixture.setCurrent({
      ...changed,
      target: { ...changed.target, designSystemTarget: null },
    });
    await fixture.storefrontProvider.resolve(0);
    expect((await pending).failure?.code).toBe("staleTarget");
  });

  it("treats a changed page target as a distinct request", async () => {
    const fixture = setup();
    const first = fixture.orchestrator.generate(fixture.input);
    const changedTarget = command(fixture.storefrontProvider, {
      affectedPageIds: [home.id, product.id],
    });
    fixture.setCurrent(identity(changedTarget));
    const second = fixture.orchestrator.generate(changedTarget);
    expect(fixture.storefrontProvider.calls).toHaveLength(2);
    expect(fixture.storefrontProvider.calls[0].requestId).not.toBe(
      fixture.storefrontProvider.calls[1].requestId,
    );
    await fixture.storefrontProvider.resolve(1);
    expect((await second).state).toBe("ready");
    await fixture.storefrontProvider.resolve(0);
    expect((await first).state).toBe("superseded");
  });

  it("treats a changed untargeted storefront baseline as a distinct request", async () => {
    const fixture = setup();
    const first = fixture.orchestrator.generate(fixture.input);
    const changedBaseline = command(fixture.storefrontProvider);
    changedBaseline.storefront.pages.find((page) => page.id === product.id)!.title.en =
      "New complete storefront baseline";
    fixture.setCurrent(identity(changedBaseline));
    const second = fixture.orchestrator.generate(changedBaseline);
    expect(fixture.storefrontProvider.calls).toHaveLength(2);
    expect(fixture.storefrontProvider.calls[0].targetFingerprint).toBe(
      fixture.storefrontProvider.calls[1].targetFingerprint,
    );
    expect(fixture.storefrontProvider.calls[0].storefrontBaselineFingerprint).not.toBe(
      fixture.storefrontProvider.calls[1].storefrontBaselineFingerprint,
    );
    await fixture.storefrontProvider.resolve(1);
    expect((await second).state).toBe("ready");
    await fixture.storefrontProvider.resolve(0);
    expect((await first).state).toBe("superseded");
  });

  it("treats locale-context changes as a distinct request", async () => {
    const fixture = setup();
    const first = fixture.orchestrator.generate(fixture.input);
    const finnish = command(fixture.storefrontProvider, { activeLocale: "fi" });
    fixture.setCurrent(identity(finnish));
    const second = fixture.orchestrator.generate(finnish);
    expect(fixture.storefrontProvider.calls).toHaveLength(2);
    expect(fixture.storefrontProvider.calls[0].requestId).not.toBe(
      fixture.storefrontProvider.calls[1].requestId,
    );
    await fixture.storefrontProvider.resolve(1);
    expect((await second).state).toBe("ready");
    await fixture.storefrontProvider.resolve(0);
    expect((await first).state).toBe("superseded");
  });

  it("allows an invalid newer command to supersede pending work", async () => {
    const fixture = setup();
    const older = fixture.orchestrator.generate(fixture.input);
    const invalid = fixture.orchestrator.generate({ ...fixture.input, merchantInstruction: "" });
    expect((await invalid).failure?.code).toBe("invalidCommand");
    await fixture.storefrontProvider.resolve(0);
    expect((await older).state).toBe("superseded");
    expect(fixture.orchestrator.inspect().state).toBe("failed");
  });

  it("keeps analytics privacy-safe and best-effort", async () => {
    const fixture = setup();
    const throwing = new AiStorefrontGenerationOrchestrator({
      currentIdentity: () => fixture.current(),
      analytics: {
        record: () => {
          throw new Error("analytics unavailable");
        },
      },
    });
    const first = fixture.orchestrator.generate(fixture.input);
    const second = throwing.generate(fixture.input);
    await fixture.storefrontProvider.resolve(0);
    await fixture.storefrontProvider.resolve(1);
    expect((await first).state).toBe("ready");
    expect((await second).state).toBe("ready");
    const serialized = JSON.stringify(fixture.events);
    expect(serialized).not.toContain(fixture.input.merchantInstruction);
    expect(serialized).not.toContain("Imported text");
    expect(serialized).not.toContain("operations");
    expect(fixture.events.map((event) => event.name)).toEqual([
      "storefront_prompt_submitted",
      "storefront_proposal_generated",
    ]);
  });
});
