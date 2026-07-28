// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { aiStorefrontProviderResponseSchema } from "@/application/ai-storefront-generation";
import {
  requestWholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningProvider,
} from "@/application/whole-storefront-generation-plan";
import { createWholeStorefrontPlanningRouteHandler } from "@/app/api/ai/whole-storefront-proposals/route";
import { P9_05A_PROJECT_ID } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
} from "@/domain/storefront";
import {
  buildP905bLocalDemoRequest,
  createP905bLocalDemoAuthority,
  inspectP905bLocalDemo,
  p905bLocalDemoRepository,
  resetP905bLocalDemo,
  resetP905bLocalDemoProject,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";

const demoEnvironment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  VESKIFY_P9_05B_LOCAL_DEMO: "1",
} as const;

function mockedDirectionProvider(
  directionId: "premiumEditorial" | "modernTechnical" | "warmApproachable",
  reached: (selectedDirectionId: string) => void,
): WholeStorefrontPlanningProvider {
  return {
    id: "mocked-openai-direction-provider",
    capabilities: {
      wholeStorefrontPlanning: true,
      structuredPlanOutput: true,
      approvedAssetReferences: true,
    },
    createPlan(request) {
      reached(directionId);
      return Promise.resolve(request.planForDirection(directionId));
    },
  };
}

async function proposalRequest(merchantInstruction: string) {
  const request = await buildP905bLocalDemoRequest(merchantInstruction, demoEnvironment);
  return new Request("http://p9-05b.test/api/ai/whole-storefront-proposals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
}

describe("P9-05B local demo server authority", () => {
  beforeEach(async () => {
    await resetP905bLocalDemo(demoEnvironment);
  });

  it("loads the canonical fresh project and reaches the mocked provider through the actual route", async () => {
    const reached = vi.fn();
    const providerRequest = await buildP905bLocalDemoRequest(
      "Create a premium editorial storefront while preserving canonical commerce truth.",
      demoEnvironment,
    );
    const authoritativeContext = await createP905bLocalDemoAuthority(demoEnvironment).resolve(
      providerRequest,
      new Request("http://p9-05b.test/api/ai/whole-storefront-proposals"),
    );
    expect(authoritativeContext.planningInput.project.id).toBe(P9_05A_PROJECT_ID);
    const directPlan = await requestWholeStorefrontGenerationPlan({
      provider: mockedDirectionProvider("premiumEditorial", () => undefined),
      input: authoritativeContext.planningInput,
      currentInput: authoritativeContext.currentPlanningInput,
      merchantInstruction: providerRequest.instruction,
    });
    await expect(
      authoritativeContext.proposalEnvelope(providerRequest, directPlan),
    ).resolves.toMatchObject({
      metadata: { authoritativePlanningFingerprint: directPlan.fingerprint },
    });
    const handler = createWholeStorefrontPlanningRouteHandler({
      environment: demoEnvironment,
      selectProvider: () => mockedDirectionProvider("premiumEditorial", reached),
    });

    const response = await handler(
      await proposalRequest(
        "Create a premium editorial storefront while preserving canonical commerce truth.",
      ),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body).not.toMatchObject({
      failure: { category: "providerUnavailable" },
    });
    const envelope = aiStorefrontProviderResponseSchema.parse(body.proposal);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(
      envelope.proposal.operations.some(
        (operation) =>
          operation.operation.type === "APPLY_REGISTERED_BRAND_SYSTEM" &&
          operation.operation.directionId === "premiumEditorial",
      ),
    ).toBe(true);
    expect(envelope.metadata.authoritativePlanningFingerprint).toMatch(/^whole-storefront-plan-/);
  });

  it("fails closed outside explicit local demo configuration before selecting a provider", async () => {
    const reached = vi.fn();
    const environment = {
      NODE_ENV: "test",
      VESKIFY_RUNTIME_MODE: "integrated",
      VESKIFY_AI_PROVIDER: "openai",
    } as const;
    const handler = createWholeStorefrontPlanningRouteHandler({
      environment,
      selectProvider: () => mockedDirectionProvider("modernTechnical", reached),
    });

    const response = await handler(await proposalRequest("Create a modern technical storefront."));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      failure: { category: "providerUnavailable", retryable: true },
    });
    expect(reached).not.toHaveBeenCalled();
  });

  it.each([
    "Create a premium editorial storefront for Lumo Atelier.",
    "Create a modern technical storefront for Lumo Atelier.",
    "Create a warm and approachable storefront for Lumo Atelier.",
  ])(
    "uses one direction-neutral grant before the provider selects a registered direction",
    async (instruction) => {
      const request = await buildP905bLocalDemoRequest(instruction, demoEnvironment);
      expect(new Set(request.permissionGrants.map((grant) => grant.skillId))).toEqual(
        new Set(["applyRegisteredWholeStorefrontDirection"]),
      );
    },
  );

  it("replaces accepted, saved, published, and history state with the exact fixture baseline", async () => {
    const baseline = await inspectP905bLocalDemo(demoEnvironment);
    const repository = p905bLocalDemoRepository(demoEnvironment);
    const aggregate = await repository.get(P9_05A_PROJECT_ID);
    const draft = aggregate.snapshots.find(
      (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
    )!;
    const published = aggregate.snapshots.find(
      (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
    )!;
    const changed = structuredClone(draft);
    changed.id = "snapshot_lumo_p9_05b_generated_saved";
    changed.createdAt = new Date(Date.parse(draft.createdAt) + 1_000).toISOString();
    changed.pages[0].title.fi = "Generoitu P9-05B-kauppa";
    await repository.saveDraft(P9_05A_PROJECT_ID, changed, {
      id: draft.id,
      revision: draft.revision,
    });
    const saved = await repository.get(P9_05A_PROJECT_ID);
    await repository.publish(P9_05A_PROJECT_ID, {
      projectRevision: saved.project.revision,
      draft: {
        id: changed.id,
        revision: changed.revision,
        contentFingerprint: canonicalStorefrontContentFingerprint(changed),
      },
      published: {
        id: published.id,
        revision: published.revision,
        contentFingerprint: canonicalStorefrontContentFingerprint(published),
      },
    });
    expect((await inspectP905bLocalDemo(demoEnvironment)).aggregateFingerprint).not.toBe(
      baseline.aggregateFingerprint,
    );

    const resets = [];
    for (let index = 0; index < 3; index += 1) {
      resets.push(await resetP905bLocalDemo(demoEnvironment));
    }
    resets.forEach((reset) => {
      expect(reset).toEqual(baseline);
      expect(reset.aggregateFingerprint).toBe(reset.baselineFingerprint);
      expect(reset.historyCount).toBe(0);
    });
    const restored = await p905bLocalDemoRepository(demoEnvironment).get(P9_05A_PROJECT_ID);
    expect(canonicalValueFingerprint(restored)).toBe(baseline.baselineFingerprint);
    expect(restored.project.draftSnapshotId).toBe("snapshot_lumo_fresh_draft");
    expect(restored.project.publishedSnapshotId).toBe("snapshot_lumo_fresh_published");
  });

  it("refuses reset targets outside the isolated demo project", async () => {
    const baseline = await inspectP905bLocalDemo(demoEnvironment);

    await expect(
      resetP905bLocalDemoProject("project_not_the_demo", demoEnvironment),
    ).rejects.toThrow("cannot target another project");
    await expect(
      p905bLocalDemoRepository(demoEnvironment).get("project_not_the_demo"),
    ).rejects.toMatchObject({ code: "PROJECT_NOT_FOUND" });
    expect(await inspectP905bLocalDemo(demoEnvironment)).toEqual(baseline);
  });
});
