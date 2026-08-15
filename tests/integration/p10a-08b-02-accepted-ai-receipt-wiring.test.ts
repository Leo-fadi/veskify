// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { acceptedAiProposalAcceptanceResultSchema } from "@/application/accepted-ai-receipt-wiring";
import { AuthoritativeAcceptedAiReceiptService } from "@/application/accepted-ai-receipt-wiring/index.server";
import {
  AcceptedSnapshotReceiptError,
  InMemoryAcceptedSnapshotPublishReceiptRepository,
} from "@/application/accepted-snapshot-publishing";
import { preparePublish } from "@/application/publishing";
import type { WholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import { createP905bAcceptedAiReceiptRouteHandler } from "@/app/api/demo/p9-05b/accept/handler";
import { createP905bLocalDemoGenerateHandler } from "@/app/api/demo/p9-05b/generate/handler";
import {
  createP905bLocalDemoAcceptedAiAuthoritySource,
  createP905bLocalDemoAuthority,
  loadP905bLocalDemoEditorSession,
  p905bLocalDemoRepository,
  p905bLocalDemoSession,
  resetP905bLocalDemo,
  synchronizeP905bLocalDemoAggregate,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import { createServerWholeStorefrontPlanningHandler } from "@/integrations/ai/whole-storefront-runtime-authority";

const token = "p10a-08b-02-route-token-for-focused-tests";
const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  VESKIFY_P9_05B_LOCAL_DEMO: "1",
  VESKIFY_P9_05B_LOCAL_DEMO_TOKEN: token,
  VESKIFY_P10A_04C_LOCAL_DEMO: "1",
} as const;

function deterministicProvider(): WholeStorefrontPlanningProvider {
  return {
    id: "deterministic-p10a-08b-02-provider",
    capabilities: {
      wholeStorefrontPlanning: true,
      structuredPlanOutput: true,
      approvedAssetReferences: true,
    },
    createPlan: (request) => Promise.resolve(request.planForDirection("premiumEditorial")),
  };
}

async function generatedAuthority() {
  const session = p905bLocalDemoSession(environment);
  const generate = createP905bLocalDemoGenerateHandler({
    environment,
    createProposalHandler: createServerWholeStorefrontPlanningHandler({
      authority: createP905bLocalDemoAuthority(environment),
      selectProvider: deterministicProvider,
    }),
  });
  const response = await generate(
    new Request("http://p10a-08b-02.test/api/demo/p9-05b/generate", {
      method: "POST",
      headers: {
        origin: "http://p10a-08b-02.test",
        "content-type": "application/json",
        "x-veskify-p9-05b-demo-token": token,
      },
      body: JSON.stringify({
        projectId: "project_lumo_fresh",
        sessionId: session.sessionId,
        merchantInstruction: "Create a premium editorial storefront for Lumo Atelier.",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const bridge = await loadP905bLocalDemoEditorSession({ ...session, environment });
  if (!bridge?.proposal) throw new Error("Expected a server-retained governed proposal.");
  return { session, bridge };
}

function service(receipts: InMemoryAcceptedSnapshotPublishReceiptRepository) {
  return new AuthoritativeAcceptedAiReceiptService({
    projectRepository: p905bLocalDemoRepository(environment),
    receiptRepository: receipts,
    authoritySource: createP905bLocalDemoAcceptedAiAuthoritySource(environment),
    now: () => new Date("2026-08-07T11:00:00.000Z"),
  });
}

function acceptanceBody(
  authority: Awaited<ReturnType<typeof generatedAuthority>>,
  acceptanceActionId = "acceptance_action_active_route",
) {
  const { bridge } = authority;
  const draft = bridge.aggregate.snapshots.find(
    (snapshot) => snapshot.id === bridge.aggregate.project.draftSnapshotId,
  );
  if (!draft || !bridge.proposal) throw new Error("Expected an active draft and proposal.");
  return {
    projectId: bridge.aggregate.project.id,
    proposalId: bridge.proposal.id,
    acceptanceActionId,
    expectedAuthorityRevision: bridge.authoritativeRevision,
    expectedProjectRevision: bridge.aggregate.project.revision,
    expectedDraftId: draft.id,
    expectedDraftRevision: draft.revision,
  };
}

function acceptanceRequest(
  authority: Awaited<ReturnType<typeof generatedAuthority>>,
  body: unknown,
) {
  return new Request("http://p10a-08b-02.test/api/demo/p9-05b/accept", {
    method: "POST",
    headers: {
      origin: "http://p10a-08b-02.test",
      "content-type": "application/json",
      "x-veskify-p9-05b-session": authority.session.sessionId,
    },
    body: JSON.stringify(body),
  });
}

describe("P10A-08B-02 active accepted-AI route integration", () => {
  beforeEach(async () => {
    await resetP905bLocalDemo(environment);
  });

  it("accepts only bounded browser identities and rejects caller-supplied snapshot authority", async () => {
    const authority = await generatedAuthority();
    const receipts = new InMemoryAcceptedSnapshotPublishReceiptRepository();
    const handler = createP905bAcceptedAiReceiptRouteHandler({ service: service(receipts) });
    const body = acceptanceBody(authority);

    const rejected = await handler(
      acceptanceRequest(authority, {
        ...body,
        acceptedSnapshot: authority.bridge.aggregate.snapshots[0],
      }),
    );
    const accepted = await handler(acceptanceRequest(authority, body));
    const responseBody = (await accepted.json()) as Record<string, unknown>;

    expect(rejected.status).toBe(400);
    expect(accepted.status).toBe(200);
    expect(responseBody).toMatchObject({
      ok: true,
      acceptance: { authoritativeRevision: 1 },
    });
    const responseAcceptance = acceptedAiProposalAcceptanceResultSchema.parse(
      responseBody.acceptance,
    );
    expect(typeof responseAcceptance.receiptId).toBe("string");
    expect(JSON.stringify(responseBody)).not.toContain("snapshot");
    expect(JSON.stringify(responseBody)).not.toContain("runtime");
  });

  it("invalidates on undo/manual changes and revalidates exact redo", async () => {
    const authority = await generatedAuthority();
    const baseline = structuredClone(authority.bridge.aggregate);
    const receipts = new InMemoryAcceptedSnapshotPublishReceiptRepository();
    const acceptedAi = service(receipts);
    const result = await acceptedAi.accept(
      acceptanceBody(authority, "acceptance_action_authority_changes"),
      acceptanceRequest(authority, acceptanceBody(authority)),
    );
    const acceptedAggregate = await p905bLocalDemoRepository(environment).get(
      authority.bridge.aggregate.project.id,
    );
    await expect(
      preparePublish(authority.bridge.aggregate.project.id, p905bLocalDemoRepository(environment), {
        authority: {
          kind: "accepted-ai",
          receiptId: result.receiptId,
          receiptRepository: receipts,
          currentAuthoritySource: acceptedAi,
        },
      }),
    ).resolves.toMatchObject({ authority: { kind: "accepted-ai" } });

    await synchronizeP905bLocalDemoAggregate({
      projectId: baseline.project.id,
      sessionId: authority.session.sessionId,
      expectedRevision: result.authoritativeRevision,
      mode: "active",
      aggregate: baseline,
      environment,
    });
    await expect(
      preparePublish(baseline.project.id, p905bLocalDemoRepository(environment), {
        authority: {
          kind: "accepted-ai",
          receiptId: result.receiptId,
          receiptRepository: receipts,
          currentAuthoritySource: acceptedAi,
        },
      }),
    ).rejects.toEqual(expect.any(AcceptedSnapshotReceiptError));

    const redo = await synchronizeP905bLocalDemoAggregate({
      projectId: acceptedAggregate.project.id,
      sessionId: authority.session.sessionId,
      expectedRevision: result.authoritativeRevision + 1,
      mode: "active",
      aggregate: acceptedAggregate,
      environment,
    });
    await expect(
      preparePublish(acceptedAggregate.project.id, p905bLocalDemoRepository(environment), {
        authority: {
          kind: "accepted-ai",
          receiptId: result.receiptId,
          receiptRepository: receipts,
          currentAuthoritySource: acceptedAi,
        },
      }),
    ).resolves.toMatchObject({ authority: { kind: "accepted-ai" } });

    const changed = structuredClone(acceptedAggregate);
    const changedDraft = changed.snapshots.find(
      (snapshot) => snapshot.id === changed.project.draftSnapshotId,
    );
    if (!changedDraft) throw new Error("Expected the accepted draft.");
    changedDraft.brandSystem.colors.primary = "#224466";
    await synchronizeP905bLocalDemoAggregate({
      projectId: changed.project.id,
      sessionId: authority.session.sessionId,
      expectedRevision: redo.authoritativeRevision,
      mode: "active",
      aggregate: changed,
      environment,
    });
    await expect(
      preparePublish(changed.project.id, p905bLocalDemoRepository(environment), {
        authority: {
          kind: "accepted-ai",
          receiptId: result.receiptId,
          receiptRepository: receipts,
          currentAuthoritySource: acceptedAi,
        },
      }),
    ).rejects.toEqual(expect.any(AcceptedSnapshotReceiptError));
  });
});
