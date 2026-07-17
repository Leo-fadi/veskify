import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { InMemoryDesignProposalStore } from "@/application/design-operations";
import {
  createDeterministicDesignProvider,
  type DesignSkillExecutionResult,
} from "@/application/design-skills";
import {
  InMemoryDesignAgentSessionStore,
  classifyRevisionInstruction,
  createDeterministicDesignAgent,
  designAgentSessionSchema,
  designAgentSessionStateSchema,
  type DeterministicDesignAgent,
  type StartDesignAgentSessionInput,
} from "@/application/design-agent";
import { createStorefrontRenderContext, validateRegisteredPage } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";

const homepage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "home")!;
const productPage = aurumNordicSeed.draftSnapshot.pages.find((page) => page.type === "product")!;

function displayContext(locale: "en" | "fi" = "en") {
  return createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: "en",
    catalogue: aurumNordicSeed.catalogue,
    snapshot: aurumNordicSeed.draftSnapshot,
  });
}

function startInput(
  overrides: Partial<StartDesignAgentSessionInput> = {},
): StartDesignAgentSessionInput {
  const page = overrides.page ?? homepage;
  const activeLocale = overrides.activeLocale ?? "en";
  return {
    sessionId: "session_test",
    projectId: aurumNordicSeed.project.id,
    page: structuredClone(page),
    pageType: page.type,
    activeLocale,
    brandSystem: structuredClone(aurumNordicSeed.draftSnapshot.brandSystem),
    displayContext: structuredClone(displayContext(activeLocale)),
    ...overrides,
  };
}

function start(
  agent: DeterministicDesignAgent,
  overrides: Partial<StartDesignAgentSessionInput> = {},
) {
  return agent.startSession(startInput(overrides)).session;
}

function submitReady(
  agent: DeterministicDesignAgent,
  request: string,
  overrides: Partial<StartDesignAgentSessionInput> = {},
) {
  const session = start(agent, overrides);
  const result = agent.submitRequest(session.id, request);
  expect(result.outcome).toBe("proposalReady");
  if (!result.proposal) throw new Error("Expected a ready proposal.");
  return { session: result.session, proposal: result.proposal };
}

function section(page: typeof homepage, component: string) {
  return page.sections.find((item) => item.component === component)!;
}

describe("design-agent session contract and store", () => {
  it("validates every supported session state", () => {
    expect(designAgentSessionStateSchema.options).toEqual([
      "idle",
      "classifying",
      "needsClarification",
      "planning",
      "generating",
      "proposalReady",
      "revising",
      "accepted",
      "rejected",
      "cancelled",
      "failed",
    ]);
    const agent = createDeterministicDesignAgent();
    expect(designAgentSessionSchema.parse(start(agent)).state).toBe("idle");
  });

  it("allows valid transitions and rejects invalid transitions", () => {
    const store = new InMemoryDesignAgentSessionStore(() => "2026-07-17T12:00:00.000Z");
    const agent = createDeterministicDesignAgent({ sessionStore: store });
    const session = start(agent);
    expect(store.transition(session.id, "classifying").state).toBe("classifying");
    expect(() => store.transition(session.id, "accepted")).toThrow(/classifying -> accepted/);
  });

  it("prevents duplicate IDs, returns immutable copies and lists only active page sessions", () => {
    const store = new InMemoryDesignAgentSessionStore();
    const agent = createDeterministicDesignAgent({ sessionStore: store });
    const first = start(agent);
    const copy = store.inspect(first.id);
    copy.originalPage.sections.length = 0;
    expect(store.inspect(first.id).originalPage.sections).not.toHaveLength(0);
    expect(() => store.create(first)).toThrow(/Duplicate design-agent session ID/);
    expect(store.listActive(first.projectId, first.pageId).map((item) => item.id)).toEqual([
      first.id,
    ]);
    agent.cancelSession(first.id);
    expect(store.listActive(first.projectId, first.pageId)).toEqual([]);
  });
});

describe("deterministic request orchestration", () => {
  it.each([
    ["luxury", "Make the homepage feel more luxurious.", "luxuryStyle"],
    ["minimal", "Make the layout more minimal.", "minimalNordicStyle"],
    ["campaign", "Add a campaign section.", "campaignSection"],
    ["hero", "Improve the hero.", "heroImprovement"],
  ])("runs the complete %s request workflow", (_label, request, intent) => {
    const agent = createDeterministicDesignAgent();
    const before = structuredClone(homepage);
    const { session, proposal } = submitReady(agent, request);
    expect(session.normalizedIntent).toBe(intent);
    expect(session.plan?.validation.valid).toBe(true);
    expect(session.activeProposalId).toBe(proposal.id);
    expect(proposal.status).toBe("pending");
    expect(homepage).toEqual(before);
    expect(validateRegisteredPage(proposal.proposedPage, displayContext())).toEqual(
      proposal.proposedPage,
    );
  });

  it.each([
    ["en" as const, "Make the homepage feel more luxurious."],
    ["fi" as const, "Tee etusivusta ylellisempi."],
  ])("preserves %s locale through classification, planning and proposal", (locale, request) => {
    const agent = createDeterministicDesignAgent();
    const { session, proposal } = submitReady(agent, request, { activeLocale: locale });
    expect(session.locale).toBe(locale);
    expect(session.classification?.locale).toBe(locale);
    expect(session.plan?.locale).toBe(locale);
    expect(proposal.summary[locale]).toBeTruthy();
  });

  it.each([
    ["Make it better.", "Make the layout more minimal."],
    ["Tee siitä parempi.", "Tee asettelusta pelkistetympi."],
  ])("asks one focused question and resumes deterministically for %s", (request, answer) => {
    const agent = createDeterministicDesignAgent();
    const session = start(agent, { activeLocale: request.startsWith("Tee") ? "fi" : "en" });
    const clarification = agent.submitRequest(session.id, request);
    expect(clarification.outcome).toBe("needsClarification");
    expect(clarification.session.clarificationQuestion).not.toBeNull();
    expect(clarification.session.classification?.clarifications).toHaveLength(1);
    const ready = agent.answerClarification(session.id, answer);
    expect(ready.outcome).toBe("proposalReady");
    expect(ready.session.clarificationAnswer).toBe(answer);
    expect(ready.session.normalizedIntent).toBe("minimalNordicStyle");
  });

  it.each([
    ["undefined context", undefined],
    ["empty context", {}],
    ["whitespace-only context", { objective: { en: "   " } }],
  ])(
    "asks for campaign direction with %s when catalogue context cannot provide it",
    (_label, campaign) => {
      const page = structuredClone(homepage);
      page.sections = page.sections.filter((item) => item.component !== "featuredCategories");
      const context = structuredClone(displayContext());
      context.catalogue.collections = [];
      const agent = createDeterministicDesignAgent();
      const session = start(agent, {
        page,
        displayContext: context,
        campaign,
      });
      const clarification = agent.submitRequest(session.id, "Add a campaign section.");
      expect(clarification.outcome).toBe("needsClarification");
      expect(clarification.message?.en).toBe("What should this campaign highlight?");
      const ready = agent.answerClarification(session.id, "Highlight our summer selection.");
      expect(ready.outcome).toBe("proposalReady");
      expect(ready.proposal?.summary.en).not.toMatch(/discount|delivery|price/i);
    },
  );

  it("returns unsupported requests as controlled failures without creating a proposal", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const create = vi.spyOn(proposalStore, "create");
    const agent = createDeterministicDesignAgent({ proposalStore });
    const session = start(agent);
    const result = agent.submitRequest(session.id, "Create an animated checkout script.");
    expect(result.outcome).toBe("unsupported");
    expect(result.session.state).toBe("failed");
    expect(result.session.failure?.code).toBe("unsupportedRequest");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("proposal revision", () => {
  it("rebuilds a luxury proposal from the original page while preserving the hero", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const first = submitReady(agent, "Make the homepage feel more luxurious.");
    expect(section(first.proposal.proposedPage, "hero")).not.toEqual(section(homepage, "hero"));
    const revised = agent.reviseProposal(first.session.id, "Keep the hero unchanged.", homepage);
    expect(revised.outcome).toBe("proposalReady");
    expect(revised.proposal?.id).not.toBe(first.proposal.id);
    expect(section(revised.proposal!.proposedPage, "hero")).toEqual(section(homepage, "hero"));
    expect(revised.session.revisionCount).toBe(1);
    expect(revised.session.proposalAttemptSequence).toBe(2);
    expect(proposalStore.inspect(first.proposal.id).status).toBe("rejected");
  });

  it("rebuilds a proposal from the original page with minimal styling", () => {
    const agent = createDeterministicDesignAgent();
    const first = submitReady(agent, "Make the homepage feel more luxurious.");
    const revised = agent.reviseProposal(first.session.id, "Make it more minimal.", homepage);
    expect(revised.session.normalizedIntent).toBe("minimalNordicStyle");
    expect(section(revised.proposal!.proposedPage, "header").variant).toBe("compact");
    expect(section(revised.proposal!.proposedPage, "productGrid").props.density).toBe("spacious");
  });

  it("rebuilds a campaign proposal as a validated no-change proposal", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const first = submitReady(agent, "Add a campaign section.");
    const revised = agent.reviseProposal(
      first.session.id,
      "Do not add a campaign section.",
      homepage,
    );
    expect(revised.outcome).toBe("proposalReady");
    expect(revised.proposal?.operations).toEqual([]);
    expect(revised.proposal?.proposedPage).toEqual(homepage);
    expect(proposalStore.inspect(first.proposal.id).status).toBe("rejected");
  });

  it.each([
    ["Keep the hero unchanged.", "keepHero"],
    ["Pidä hero ennallaan.", "keepHero"],
    ["Make it more minimal.", "makeMinimal"],
    ["Tee siitä pelkistetympi.", "makeMinimal"],
    ["Do not add a campaign section.", "omitCampaign"],
    ["Älä lisää kampanjaosiota.", "omitCampaign"],
    ["Start over.", "startOver"],
    ["Aloita alusta.", "startOver"],
  ])("recognizes the controlled revision %s", (instruction, kind) => {
    expect(classifyRevisionInstruction(instruction)).toBe(kind);
  });

  it("starts over from the original page and closes the pending proposal", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const first = submitReady(agent, "Make the homepage feel more luxurious.");
    const restarted = agent.reviseProposal(first.session.id, "Start over.", homepage);
    expect(restarted.outcome).toBe("restarted");
    expect(restarted.session.state).toBe("idle");
    expect(restarted.session.activeProposalId).toBeNull();
    expect(restarted.page).toEqual(homepage);
    expect(proposalStore.inspect(first.proposal.id).status).toBe("rejected");
  });

  it("keeps the previous valid proposal pending when a revision cannot execute", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const provider = createDeterministicDesignProvider(proposalStore);
    const originalExecute = provider.executeDesignPlan;
    vi.spyOn(provider, "executeDesignPlan").mockImplementation((plan, input, registry) => {
      if (plan.normalizedIntent === "minimalNordicStyle") {
        const valid = originalExecute(plan, input, registry);
        return {
          ...valid,
          proposedPage: valid.originalPage,
          validation: { valid: false, errors: ["Injected operation failure."] },
          failureReason: {
            en: "Injected operation failure.",
            fi: "Simuloitu toimintovirhe.",
          },
        } satisfies DesignSkillExecutionResult;
      }
      return originalExecute(plan, input, registry);
    });
    const agent = createDeterministicDesignAgent({ proposalProvider: provider });
    const first = submitReady(agent, "Make the homepage feel more luxurious.");
    const failed = agent.reviseProposal(first.session.id, "Make it more minimal.", homepage);
    expect(failed.outcome).toBe("revisionFailed");
    expect(failed.session.state).toBe("proposalReady");
    expect(failed.session.activeProposalId).toBe(first.proposal.id);
    expect(proposalStore.inspect(first.proposal.id).status).toBe("pending");
  });

  it("requires explicit restart before revising an accepted or rejected session", () => {
    const acceptedAgent = createDeterministicDesignAgent();
    const accepted = submitReady(acceptedAgent, "Make the layout more minimal.");
    acceptedAgent.acceptProposal(accepted.session.id, homepage);
    expect(() =>
      acceptedAgent.reviseProposal(accepted.session.id, "Keep the hero unchanged.", homepage),
    ).toThrow(/restart a closed session/);

    const rejectedAgent = createDeterministicDesignAgent();
    const rejected = submitReady(rejectedAgent, "Make the layout more minimal.");
    rejectedAgent.rejectProposal(rejected.session.id);
    expect(() =>
      rejectedAgent.reviseProposal(rejected.session.id, "Keep the hero unchanged.", homepage),
    ).toThrow(/restart a closed session/);
  });
});

describe("proposal regeneration", () => {
  it("regenerates a ready proposal from the original canonical page with a new identity", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const inputPage = structuredClone(homepage);
    const before = structuredClone(inputPage);
    const first = submitReady(agent, "Make the homepage feel more luxurious.", {
      page: inputPage,
    });
    const regenerated = agent.regenerateProposal(first.session.id, inputPage);
    expect(regenerated.outcome).toBe("proposalReady");
    expect(regenerated.session.state).toBe("proposalReady");
    expect(regenerated.proposal?.id).not.toBe(first.proposal.id);
    expect(regenerated.proposal?.proposedPage).toEqual(first.proposal.proposedPage);
    expect(regenerated.session.initialMerchantRequest).toBe(
      "Make the homepage feel more luxurious.",
    );
    expect(regenerated.session.plan?.requestedScope).toBe(first.session.plan?.requestedScope);
    expect(regenerated.session.proposalAttemptSequence).toBe(2);
    expect(regenerated.session.revisionCount).toBe(0);
    expect(proposalStore.inspect(first.proposal.id).status).toBe("rejected");
    expect(proposalStore.inspect(regenerated.proposal!.id).status).toBe("pending");
    expect(inputPage).toEqual(before);
  });

  it("preserves clarification context when regenerating", () => {
    const agent = createDeterministicDesignAgent();
    const session = start(agent);
    expect(agent.submitRequest(session.id, "Make it better.").outcome).toBe("needsClarification");
    const first = agent.answerClarification(session.id, "Make the layout more minimal.");
    const regenerated = agent.regenerateProposal(session.id, homepage);
    expect(regenerated.outcome).toBe("proposalReady");
    expect(regenerated.session.initialMerchantRequest).toBe("Make it better.");
    expect(regenerated.session.clarificationAnswer).toBe("Make the layout more minimal.");
    expect(regenerated.session.normalizedIntent).toBe("minimalNordicStyle");
    expect(regenerated.proposal?.id).not.toBe(first.proposal?.id);
  });

  it("preserves clarified campaign direction during regeneration", () => {
    const page = structuredClone(homepage);
    page.sections = page.sections.filter((item) => item.component !== "featuredCategories");
    const context = structuredClone(displayContext());
    context.catalogue.collections = [];
    const agent = createDeterministicDesignAgent();
    const session = start(agent, { page, displayContext: context });
    expect(agent.submitRequest(session.id, "Add a campaign section.").outcome).toBe(
      "needsClarification",
    );
    const first = agent.answerClarification(session.id, "Highlight our summer selection.");
    const regenerated = agent.regenerateProposal(session.id, page);
    expect(regenerated.outcome).toBe("proposalReady");
    expect(regenerated.session.clarificationAnswer).toBe("Highlight our summer selection.");
    expect(JSON.stringify(regenerated.proposal?.proposedPage)).toContain(
      "Highlight our summer selection.",
    );
    expect(regenerated.proposal?.proposedPage).toEqual(first.proposal?.proposedPage);
  });

  it("never collides across repeated regenerations", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const first = submitReady(agent, "Make the layout more minimal.");
    const second = agent.regenerateProposal(first.session.id, homepage);
    const third = agent.regenerateProposal(first.session.id, homepage);
    const fourth = agent.regenerateProposal(first.session.id, homepage);
    const ids = [first.proposal.id, second.proposal!.id, third.proposal!.id, fourth.proposal!.id];
    expect(new Set(ids).size).toBe(4);
    expect(agent.inspectSession(first.session.id).proposalAttemptSequence).toBe(4);
    expect(ids.slice(0, -1).map((id) => proposalStore.inspect(id).status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
    ]);
    expect(proposalStore.inspect(ids.at(-1)!).status).toBe("pending");
  });

  it("keeps a stale regeneration from consuming the pending proposal or input page", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const ready = submitReady(agent, "Make the layout more minimal.");
    const stalePage = structuredClone(homepage);
    section(stalePage, "hero").content.heading = { en: "Changed", fi: "Muuttunut" };
    const before = structuredClone(stalePage);
    const result = agent.regenerateProposal(ready.session.id, stalePage);
    expect(result.outcome).toBe("stale");
    expect(result.session.proposalAttemptSequence).toBe(1);
    expect(proposalStore.inspect(ready.proposal.id).status).toBe("pending");
    expect(stalePage).toEqual(before);
  });

  it.each([
    ["en" as const, "Make the layout more minimal.", /regenerated proposal/i],
    ["fi" as const, "Tee asettelusta pelkistetympi.", /uudelleen luotu ehdotus/i],
  ])("returns a merchant-facing %s regeneration status", (locale, request, status) => {
    const agent = createDeterministicDesignAgent();
    const ready = submitReady(agent, request, { activeLocale: locale });
    const regenerated = agent.regenerateProposal(ready.session.id, homepage);
    expect(regenerated.session.status[locale]).toMatch(status);
  });

  it("requires explicit restart after accepted, rejected or cancelled sessions", () => {
    const actions = ["accepted", "rejected", "cancelled"] as const;
    for (const action of actions) {
      const agent = createDeterministicDesignAgent();
      const ready = submitReady(agent, "Make the layout more minimal.");
      if (action === "accepted") agent.acceptProposal(ready.session.id, homepage);
      if (action === "rejected") agent.rejectProposal(ready.session.id);
      if (action === "cancelled") agent.cancelSession(ready.session.id);
      expect(() => agent.regenerateProposal(ready.session.id, homepage)).toThrow(
        /restart a closed session/,
      );
    }
  });

  it("does not reuse proposal identity after restart and the same request", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const first = submitReady(agent, "Make the layout more minimal.");
    agent.acceptProposal(first.session.id, homepage);
    const restarted = agent.restartSession(first.session.id);
    expect(restarted.session.proposalAttemptSequence).toBe(1);
    expect(restarted.session.revisionCount).toBe(0);
    const second = agent.submitRequest(first.session.id, "Make the layout more minimal.");
    expect(second.proposal?.id).not.toBe(first.proposal.id);
    expect(second.session.proposalAttemptSequence).toBe(2);
    expect(proposalStore.inspect(first.proposal.id).status).toBe("accepted");
    expect(proposalStore.inspect(second.proposal!.id).status).toBe("pending");
  });
});

describe("accept, reject, cancel and stale-base safety", () => {
  it("accepts through the existing lifecycle and returns the canonical proposed page", () => {
    const agent = createDeterministicDesignAgent();
    const ready = submitReady(agent, "Make the layout more minimal.");
    const accepted = agent.acceptProposal(ready.session.id, homepage);
    expect(accepted.outcome).toBe("accepted");
    expect(accepted.session.state).toBe("accepted");
    expect(accepted.page).toEqual(ready.proposal.proposedPage);
    expect(agent.inspectProposal(ready.session.id).status).toBe("accepted");
  });

  it("rejects and returns the unchanged original page", () => {
    const agent = createDeterministicDesignAgent();
    const ready = submitReady(agent, "Make the homepage feel more luxurious.");
    const rejected = agent.rejectProposal(ready.session.id);
    expect(rejected.session.state).toBe("rejected");
    expect(rejected.page).toEqual(homepage);
    expect(agent.inspectProposal(ready.session.id).status).toBe("rejected");
  });

  it("cancels only its active proposal and returns the original page", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const first = submitReady(agent, "Make the homepage feel more luxurious.", {
      sessionId: "session_first",
    });
    const secondSession = start(agent, { sessionId: "session_second" });
    const second = agent.submitRequest(secondSession.id, "Make the layout more minimal.");
    const cancelled = agent.cancelSession(first.session.id);
    expect(cancelled.session.state).toBe("cancelled");
    expect(cancelled.page).toEqual(homepage);
    expect(proposalStore.inspect(first.proposal.id).status).toBe("rejected");
    expect(proposalStore.inspect(second.proposal!.id).status).toBe("pending");
  });

  it("does not consume a proposal when accept detects a stale page", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const ready = submitReady(agent, "Make the layout more minimal.");
    const stalePage = structuredClone(homepage);
    const hero = section(stalePage, "hero");
    hero.content.heading = { en: "A newer draft heading", fi: "Uudempi otsikko" };
    const result = agent.acceptProposal(ready.session.id, stalePage);
    expect(result.outcome).toBe("stale");
    expect(result.session.state).toBe("proposalReady");
    expect(result.message?.en).toMatch(/Start a new request/);
    expect(proposalStore.inspect(ready.proposal.id).status).toBe("pending");
  });

  it("does not consume a proposal when revision detects a stale page", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const ready = submitReady(agent, "Make the homepage feel more luxurious.");
    const stalePage = structuredClone(homepage);
    section(stalePage, "hero").content.heading = { en: "Changed", fi: "Muuttunut" };
    const result = agent.reviseProposal(ready.session.id, "Keep the hero unchanged.", stalePage);
    expect(result.outcome).toBe("stale");
    expect(proposalStore.inspect(ready.proposal.id).status).toBe("pending");
  });

  it("treats locale switching as context, not a stale canonical-page change", () => {
    const agent = createDeterministicDesignAgent();
    const ready = submitReady(agent, "Make the layout more minimal.", { activeLocale: "en" });
    const currentPageAfterLocaleSwitch = structuredClone(homepage);
    const accepted = agent.acceptProposal(ready.session.id, currentPageAfterLocaleSwitch);
    expect(accepted.outcome).toBe("accepted");
  });
});

describe("session concurrency, determinism and safety boundaries", () => {
  it("isolates sessions for different pages", () => {
    const agent = createDeterministicDesignAgent();
    const home = start(agent, { sessionId: "session_home" });
    const product = start(agent, {
      sessionId: "session_product",
      page: productPage,
      pageType: "product",
    });
    agent.submitRequest(home.id, "Make the layout more minimal.");
    expect(agent.inspectSession(home.id).state).toBe("proposalReady");
    expect(agent.inspectSession(product.id).state).toBe("idle");
  });

  it("gives same-page sessions separate proposals and accepts only the selected one", () => {
    const proposalStore = new InMemoryDesignProposalStore();
    const agent = createDeterministicDesignAgent({ proposalStore });
    const firstSession = start(agent, { sessionId: "session_one" });
    const secondSession = start(agent, { sessionId: "session_two" });
    const first = agent.submitRequest(firstSession.id, "Make the layout more minimal.");
    const second = agent.submitRequest(secondSession.id, "Make the layout more minimal.");
    expect(first.proposal?.id).not.toBe(second.proposal?.id);
    agent.acceptProposal(firstSession.id, homepage);
    expect(proposalStore.inspect(first.proposal!.id).status).toBe("accepted");
    expect(proposalStore.inspect(second.proposal!.id).status).toBe("pending");
  });

  it("does not share session or proposal state between agent instances", () => {
    const first = createDeterministicDesignAgent();
    const second = createDeterministicDesignAgent();
    const ready = submitReady(first, "Make the layout more minimal.");
    expect(() => second.inspectSession(ready.session.id)).toThrow(/Unknown design-agent session/);
    const secondSession = start(second);
    expect(() => second.inspectProposal(secondSession.id)).toThrow(/has no proposal/);
  });

  it("produces deterministic plans, proposals and IDs for repeated isolated runs", () => {
    const first = createDeterministicDesignAgent();
    const second = createDeterministicDesignAgent();
    const firstReady = submitReady(first, "Make the homepage feel more luxurious.");
    const secondReady = submitReady(second, "Make the homepage feel more luxurious.");
    expect(firstReady.session.plan).toEqual(secondReady.session.plan);
    expect(firstReady.proposal).toEqual(secondReady.proposal);
  });

  it("rolls back a controlled planning failure and leaves the input page unchanged", () => {
    const agent = createDeterministicDesignAgent();
    const inputPage = structuredClone(homepage);
    const before = structuredClone(inputPage);
    const nonHeroId = section(homepage, "productGrid").id;
    const session = start(agent, { page: inputPage, selectedSectionId: nonHeroId });
    const result = agent.submitRequest(session.id, "Improve the hero.");
    expect(result.outcome).toBe("failed");
    expect(result.session.failure?.code).toBe("invalidPlan");
    expect(result.session.activeProposalId).toBeNull();
    expect(inputPage).toEqual(before);
  });

  it("preserves protected commerce truth, catalogue media and all input values", () => {
    const page = structuredClone(homepage);
    const context = structuredClone(displayContext());
    const beforePage = structuredClone(page);
    const beforeContext = structuredClone(context);
    const agent = createDeterministicDesignAgent();
    const session = start(agent, { page, displayContext: context });
    const ready = agent.submitRequest(session.id, "Make the homepage feel more luxurious.");
    agent.reviseProposal(session.id, "Make it more minimal.", page);
    expect(page).toEqual(beforePage);
    expect(context).toEqual(beforeContext);
    expect(
      context.catalogue.products.map(({ id, sku, price, stockStatus, images }) => ({
        id,
        sku,
        price,
        stockStatus,
        images,
      })),
    ).toEqual(
      beforeContext.catalogue.products.map(({ id, sku, price, stockStatus, images }) => ({
        id,
        sku,
        price,
        stockStatus,
        images,
      })),
    );
    expect(JSON.stringify(ready.proposal)).not.toMatch(/<script|javascript:|checkout operation/i);
  });

  it("has no storage, editor, Puck or publishing dependency and cannot write repositories", () => {
    const directory = join(process.cwd(), "src/application/design-agent");
    const files = readdirSync(directory).filter((file) => file.endsWith(".ts"));
    const source = files.map((file) => readFileSync(join(directory, file), "utf8")).join("\n");
    expect(source).not.toMatch(/services\/storage|indexeddb|integrations\/puck/i);
    expect(source).not.toMatch(/saveDraft|publishDraft|publishedSnapshot/);
    expect(source).not.toContain("src/app/projects");
  });
});
