// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildP905bLocalDemoRequest,
  inspectP905bLocalDemo,
  loadP905bLocalDemoEditorSession,
  p905bLocalDemoRepository,
  p905bLocalDemoSession,
  resetP905bLocalDemo,
  synchronizeP905bLocalDemoAggregate,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import { createWholeStorefrontPlanningRouteHandler } from "@/app/api/ai/whole-storefront-proposals/route";
import { createP905bLocalDemoSynchronizationHandler } from "@/app/api/demo/p9-05b/synchronize/route";
import { StorefrontProposalAcceptanceCoordinator } from "@/application/ai-storefront";
import type { WholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import { InMemoryProjectRepository } from "@/services/storage";

const token = "p9-05c-authoritative-synchronization-test-token";
const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  VESKIFY_P9_05B_LOCAL_DEMO: "1",
  VESKIFY_P9_05B_LOCAL_DEMO_TOKEN: token,
} as const;

function provider(
  direction: "premiumEditorial" | "modernTechnical" | "warmApproachable" = "modernTechnical",
  reached: () => void = () => {},
): WholeStorefrontPlanningProvider {
  return {
    id: "p9-05c-direction-provider",
    capabilities: {
      wholeStorefrontPlanning: true,
      structuredPlanOutput: true,
      approvedAssetReferences: true,
    },
    createPlan(request) {
      reached();
      return Promise.resolve(request.planForDirection(direction));
    },
  };
}

async function savedBrowserAggregate() {
  const source = await p905bLocalDemoRepository(environment).get("project_lumo_fresh");
  const browser = new InMemoryProjectRepository([source]);
  const draft = source.snapshots.find(
    (snapshot) => snapshot.id === source.project.draftSnapshotId,
  )!;
  const changed = structuredClone(draft);
  changed.id = "snapshot_lumo_p9_05c_saved";
  changed.createdAt = new Date(Date.parse(draft.createdAt) + 1_000).toISOString();
  changed.pages[0].title.en = "Lumo Atelier after the first accepted proposal";
  await browser.saveDraft(source.project.id, changed, { id: draft.id, revision: draft.revision });
  return browser.get(source.project.id);
}

async function synchronizeSavedAggregate() {
  const session = p905bLocalDemoSession(environment);
  const before = await inspectP905bLocalDemo(environment);
  const aggregate = await savedBrowserAggregate();
  const result = await synchronizeP905bLocalDemoAggregate({
    projectId: "project_lumo_fresh",
    sessionId: session.sessionId,
    expectedRevision: before.authoritativeRevision,
    aggregate,
    environment,
  });
  return { aggregate, before, result, session };
}

describe("P9-05C authoritative local-demo synchronization", () => {
  beforeEach(async () => {
    await resetP905bLocalDemo(environment);
  });

  it("persists a validated saved aggregate and permits one follow-up whole-storefront proposal", async () => {
    const { before, result, session } = await synchronizeSavedAggregate();
    expect(result.authoritativeRevision).toBe(before.authoritativeRevision + 1);
    expect((await inspectP905bLocalDemo(environment)).authoritativeRevision).toBe(
      result.authoritativeRevision,
    );

    const reached = vi.fn();
    const handler = createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: () => provider("modernTechnical", reached),
    });
    const request = await buildP905bLocalDemoRequest(
      "Redesign the storefront in a modern technical direction with compact spacing.",
      environment,
    );
    const response = await handler(
      new Request("http://p9-05c.test/api/ai/whole-storefront-proposals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-veskify-p9-05b-session": session.sessionId,
        },
        body: JSON.stringify(request),
      }),
    );

    expect(response.status).toBe(200);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it("synchronizes an accepted initial direction before a warm colour follow-up uses its saved baseline", async () => {
    const session = p905bLocalDemoSession(environment);
    const selectedDirections: string[] = [];
    const handler = createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: () =>
        provider("premiumEditorial", () => {
          selectedDirections.push("premiumEditorial");
        }),
    });
    const initialRequest = await buildP905bLocalDemoRequest(
      "Create a premium editorial storefront for Lumo Atelier.",
      environment,
    );
    expect(
      (
        await handler(
          new Request("http://p9-05c.test/api/ai/whole-storefront-proposals", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-veskify-p9-05b-session": session.sessionId,
            },
            body: JSON.stringify(initialRequest),
          }),
        )
      ).status,
    ).toBe(200);

    const bridge = await loadP905bLocalDemoEditorSession({ ...session, environment });
    expect(bridge).not.toBeNull();
    const loaded = bridge!;
    const draft = loaded.aggregate.snapshots.find(
      (snapshot) => snapshot.id === loaded.aggregate.project.draftSnapshotId,
    );
    const published = loaded.aggregate.snapshots.find(
      (snapshot) => snapshot.id === loaded.aggregate.project.publishedSnapshotId,
    );
    if (!draft || !published || !loaded.proposal) {
      throw new Error("The initial P9-05C proposal bridge is incomplete.");
    }
    const coordinator = new StorefrontProposalAcceptanceCoordinator({
      proposal: loaded.proposal,
      activeDraft: draft,
      storedDraft: draft,
      publishedSnapshot: published,
      catalogue: loaded.aggregate.catalogue,
      enabledLocales: loaded.aggregate.project.enabledLocales,
      activeLocale: loaded.aggregate.project.primaryLocale,
      primaryLocale: loaded.aggregate.project.primaryLocale,
    });
    const accepted = coordinator.accept();
    expect(coordinator.undo()).toEqual(draft);
    expect(coordinator.redo()).toEqual(accepted.activeDraft);

    const browser = new InMemoryProjectRepository([loaded.aggregate]);
    await browser.saveDraft(loaded.aggregate.project.id, accepted.activeDraft, {
      id: draft.id,
      revision: draft.revision,
    });
    const saved = await browser.get(loaded.aggregate.project.id);
    const synchronization = await synchronizeP905bLocalDemoAggregate({
      projectId: loaded.aggregate.project.id,
      sessionId: session.sessionId,
      expectedRevision: loaded.authoritativeRevision,
      aggregate: saved,
      environment,
    });
    const synchronizedBridge = await loadP905bLocalDemoEditorSession({ ...session, environment });
    expect(synchronizedBridge?.aggregate).toEqual(saved);
    expect(synchronizedBridge?.authoritativeRevision).toBe(synchronization.authoritativeRevision);

    const warmFollowup = await buildP905bLocalDemoRequest(
      "Keep the structure, but make the colours warmer and more approachable.",
      environment,
    );
    const followupHandler = createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: () =>
        provider("warmApproachable", () => {
          selectedDirections.push("warmApproachable");
        }),
    });
    expect(
      (
        await followupHandler(
          new Request("http://p9-05c.test/api/ai/whole-storefront-proposals", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-veskify-p9-05b-session": session.sessionId,
            },
            body: JSON.stringify(warmFollowup),
          }),
        )
      ).status,
    ).toBe(200);
    expect(selectedDirections).toEqual(["premiumEditorial", "warmApproachable"]);
  });

  it("rejects stale, unauthorized, malformed, and protected-commerce synchronization without changing authority", async () => {
    const source = await p905bLocalDemoRepository(environment).get("project_lumo_fresh");
    const session = p905bLocalDemoSession(environment);
    const before = await inspectP905bLocalDemo(environment);

    await expect(
      synchronizeP905bLocalDemoAggregate({
        projectId: "project_lumo_fresh",
        sessionId: "x".repeat(43),
        expectedRevision: before.authoritativeRevision,
        aggregate: source,
        environment,
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
    await expect(
      synchronizeP905bLocalDemoAggregate({
        projectId: "project_lumo_fresh",
        sessionId: session.sessionId,
        expectedRevision: before.authoritativeRevision + 1,
        aggregate: source,
        environment,
      }),
    ).rejects.toMatchObject({ code: "stale" });
    await expect(
      synchronizeP905bLocalDemoAggregate({
        projectId: "project_lumo_fresh",
        sessionId: session.sessionId,
        expectedRevision: before.authoritativeRevision,
        aggregate: { project: source.project },
        environment,
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    const protectedMutation = structuredClone(source);
    protectedMutation.project.revision += 1;
    const firstProduct = protectedMutation.catalogue.products[0];
    if (!firstProduct) throw new Error("The P9-05C fixture must include a product.");
    firstProduct.stockStatus = "outOfStock";
    await expect(
      synchronizeP905bLocalDemoAggregate({
        projectId: "project_lumo_fresh",
        sessionId: session.sessionId,
        expectedRevision: before.authoritativeRevision,
        aggregate: protectedMutation,
        environment,
      }),
    ).rejects.toMatchObject({ code: "protectedCommerce" });

    expect(await inspectP905bLocalDemo(environment)).toEqual(before);
  });

  it("rejects a duplicate follow-up proposal after synchronization before provider selection", async () => {
    const { session } = await synchronizeSavedAggregate();
    const selected = vi.fn(() => provider());
    const handler = createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: selected,
    });
    const request = await buildP905bLocalDemoRequest(
      "Redesign the storefront in a modern technical direction with compact spacing.",
      environment,
    );
    const createRequest = () =>
      new Request("http://p9-05c.test/api/ai/whole-storefront-proposals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-veskify-p9-05b-session": session.sessionId,
        },
        body: JSON.stringify(request),
      });

    expect((await handler(createRequest())).status).toBe(200);
    expect((await handler(createRequest())).status).toBe(409);
    expect(selected).toHaveBeenCalledTimes(1);
  });

  it("keeps accepted active work separate from the saved bridge aggregate across reload", async () => {
    const session = p905bLocalDemoSession(environment);
    const saved = await p905bLocalDemoRepository(environment).get("project_lumo_fresh");
    const active = structuredClone(saved);
    const activeDraft = active.snapshots.find(
      (snapshot) => snapshot.id === active.project.draftSnapshotId,
    );
    if (!activeDraft) throw new Error("The local demo fixture must include its active draft.");
    activeDraft.pages[0].title.en = "Unsaved accepted storefront";
    const before = await inspectP905bLocalDemo(environment);

    await synchronizeP905bLocalDemoAggregate({
      projectId: saved.project.id,
      sessionId: session.sessionId,
      expectedRevision: before.authoritativeRevision,
      mode: "active",
      aggregate: active,
      environment,
    });

    const reloaded = await loadP905bLocalDemoEditorSession({ ...session, environment });
    expect(reloaded?.aggregate).toEqual(saved);
    expect(reloaded?.baselineFingerprint).toBe(before.baselineFingerprint);
    expect((await inspectP905bLocalDemo(environment)).aggregateFingerprint).not.toBe(
      before.aggregateFingerprint,
    );
  });

  it("serializes concurrent synchronization at one expected revision", async () => {
    const session = p905bLocalDemoSession(environment);
    const aggregate = await p905bLocalDemoRepository(environment).get("project_lumo_fresh");
    const before = await inspectP905bLocalDemo(environment);
    const results = await Promise.allSettled(
      [0, 1].map(() =>
        synchronizeP905bLocalDemoAggregate({
          projectId: aggregate.project.id,
          sessionId: session.sessionId,
          expectedRevision: before.authoritativeRevision,
          mode: "saved",
          aggregate,
          environment,
        }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejection = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejection?.reason).toMatchObject({ code: "stale" });
  });

  it("releases a failed proposal reservation so the same revision can be retried", async () => {
    const session = p905bLocalDemoSession(environment);
    const request = await buildP905bLocalDemoRequest(
      "Use a modern technical direction.",
      environment,
    );
    const requestFor = () =>
      new Request("http://p9-05c.test/api/ai/whole-storefront-proposals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-veskify-p9-05b-session": session.sessionId,
        },
        body: JSON.stringify(request),
      });
    const failing = createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: () => ({
        ...provider(),
        createPlan: () => Promise.reject(new Error("provider unavailable")),
      }),
    });
    expect((await failing(requestFor())).status).toBe(503);

    const retry = createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: () => provider(),
    });
    expect((await retry(requestFor())).status).toBe(200);
  });

  it("exposes only safe synchronization failures through the session-bound route", async () => {
    const handler = createP905bLocalDemoSynchronizationHandler({ environment });
    const source = await p905bLocalDemoRepository(environment).get("project_lumo_fresh");
    const response = await handler(
      new Request("http://p9-05c.test/api/demo/p9-05b/synchronize", {
        method: "POST",
        headers: { origin: "http://p9-05c.test", "content-type": "application/json" },
        body: JSON.stringify({
          projectId: "project_lumo_fresh",
          sessionId: "x".repeat(43),
          expectedRevision: source.project.revision,
          aggregate: source,
        }),
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      failure: { category: "permissionDenied", retryable: false },
    });
  });
});
