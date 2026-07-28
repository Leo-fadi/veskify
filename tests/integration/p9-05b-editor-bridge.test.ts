// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { StorefrontProposalAcceptanceCoordinator } from "@/application/ai-storefront";
import { createWholeStorefrontPlanningRouteHandler } from "@/app/api/ai/whole-storefront-proposals/route";
import { createP905bLocalDemoGenerateHandler } from "@/app/api/demo/p9-05b/generate/route";
import {
  loadP905bLocalDemoEditorSession,
  p905bLocalDemoSession,
  resetP905bLocalDemo,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import type { WholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";

const token = "p9-05b-editor-bridge-token-for-focused-tests";
const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  VESKIFY_P9_05B_LOCAL_DEMO: "1",
  VESKIFY_P9_05B_LOCAL_DEMO_TOKEN: token,
} as const;

function provider(): WholeStorefrontPlanningProvider {
  return {
    id: "mocked-editor-bridge-provider",
    capabilities: {
      wholeStorefrontPlanning: true,
      structuredPlanOutput: true,
      approvedAssetReferences: true,
    },
    createPlan: (request) => Promise.resolve(request.planForDirection("modernTechnical")),
  };
}

async function generatedBridge() {
  const session = p905bLocalDemoSession(environment);
  const handler = createP905bLocalDemoGenerateHandler({
    environment,
    createProposalHandler: createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: provider,
    }),
  });
  const response = await handler(
    new Request("http://p9-05b.test/api/demo/p9-05b/generate", {
      method: "POST",
      headers: {
        origin: "http://p9-05b.test",
        "content-type": "application/json",
        "x-veskify-p9-05b-demo-token": token,
      },
      body: JSON.stringify({
        projectId: "project_lumo_fresh",
        sessionId: session.sessionId,
        merchantInstruction: "Create a modern technical storefront for Lumo Atelier.",
      }),
    }),
  );
  expect(response.status).toBe(200);
  return { session, bridge: await loadP905bLocalDemoEditorSession({ ...session, environment }) };
}

describe("P9-05B editor proposal bridge", () => {
  beforeEach(async () => {
    await resetP905bLocalDemo(environment);
  });

  it("loads the authoritative baseline into the canonical review, acceptance, save, reload, and publish lifecycle", async () => {
    const { bridge } = await generatedBridge();
    expect(bridge).not.toBeNull();
    const loaded = bridge!;
    const draft = loaded.aggregate.snapshots.find(
      (snapshot) => snapshot.id === loaded.aggregate.project.draftSnapshotId,
    )!;
    const published = loaded.aggregate.snapshots.find(
      (snapshot) => snapshot.id === loaded.aggregate.project.publishedSnapshotId,
    )!;
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

    expect(coordinator.inspect().state).toBe("ready");
    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    expect(coordinator.undo()).toEqual(draft);
    expect(coordinator.redo()).toEqual(accepted.activeDraft);

    const repository = new InMemoryProjectRepository([loaded.aggregate]);
    await repository.saveDraft(loaded.aggregate.project.id, accepted.activeDraft, {
      id: draft.id,
      revision: draft.revision,
    });
    const reloaded = await repository.get(loaded.aggregate.project.id);
    const savedDraft = reloaded.snapshots.find(
      (snapshot) => snapshot.id === reloaded.project.draftSnapshotId,
    )!;
    expect(savedDraft).toEqual(accepted.activeDraft);
    const publishedAggregate = await repository.publish(loaded.aggregate.project.id, {
      projectRevision: reloaded.project.revision,
      draft: {
        id: savedDraft.id,
        revision: savedDraft.revision,
        contentFingerprint: canonicalStorefrontContentFingerprint(savedDraft),
      },
      published: {
        id: published.id,
        revision: published.revision,
        contentFingerprint: canonicalStorefrontContentFingerprint(published),
      },
    });
    expect(publishedAggregate.project.publishedSnapshotId).not.toBe(published.id);
  });

  it("rejects cross-project and stale-session bridge loads", async () => {
    const { session, bridge } = await generatedBridge();
    expect(bridge).not.toBeNull();
    await expect(
      loadP905bLocalDemoEditorSession({
        projectId: "project_not_lumo",
        sessionId: session.sessionId,
        environment,
      }),
    ).resolves.toBeNull();
    await resetP905bLocalDemo(environment);
    await expect(loadP905bLocalDemoEditorSession({ ...session, environment })).resolves.toBeNull();
  });
});
