import { beforeEach, describe, expect, it } from "vitest";
import {
  createDeterministicUrlBriefWorkflowService,
  OnboardingService,
} from "@/application/onboarding";
import { aurumNordicSeed } from "@/data/seed";
import {
  INTERMEDIATE_ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_SCHEMA_VERSION,
  onboardingSessionSchema,
} from "@/domain/onboarding";
import {
  BrowserOnboardingSessionRepository,
  ONBOARDING_SESSION_STORAGE_KEY,
} from "@/services/onboarding";

const start = Date.parse("2026-07-22T12:00:00.000Z");

function clock() {
  let tick = 0;
  return () => new Date(start + tick++ * 1_000).toISOString();
}

async function persistedService() {
  const now = clock();
  const repository = new BrowserOnboardingSessionRepository();
  await new OnboardingService(repository, {
    createId: () => "onboarding_persisted_url_brief",
    now,
  }).createSession();
  const service = createDeterministicUrlBriefWorkflowService(
    repository,
    { load: () => aurumNordicSeed.catalogue },
    { now, createSourceId: () => "source_persisted_fixture" },
  );
  return { repository, service, now };
}

describe("P7-02 onboarding workflow persistence and restoration", () => {
  beforeEach(() => localStorage.clear());

  it("restores source evidence and asset candidates through the onboarding repository", async () => {
    const { service } = await persistedService();
    await service.submitSourceUrl("https://merchant.example/store");
    const evidenceReady = await service.discover();
    expect(evidenceReady.discoveryResult?.evidence.length).toBeGreaterThan(0);
    expect(evidenceReady.discoveryResult?.assetCandidates.length).toBeGreaterThan(0);

    const refreshed = createDeterministicUrlBriefWorkflowService(
      new BrowserOnboardingSessionRepository(),
      { load: () => aurumNordicSeed.catalogue },
      { now: clock(), createSourceId: () => "source_persisted_fixture" },
    );
    const restored = await refreshed.restore();

    expect(restored.status).toBe("evidence-ready");
    expect(restored.discoveryResult?.evidence).toEqual(evidenceReady.discoveryResult?.evidence);
    expect(restored.discoveryResult?.assetCandidates).toEqual(
      evidenceReady.discoveryResult?.assetCandidates,
    );
  });

  it("restores interrupted discovery to its persisted last safe workflow state", async () => {
    const { repository, service, now } = await persistedService();
    await service.submitSourceUrl("https://merchant.example/store");
    const evidenceReady = await service.discover();
    const loaded = await repository.load();
    if (loaded.status !== "found") throw new Error("Expected a persisted onboarding session.");
    const currentSourceId = loaded.session.urlBriefWorkflow.currentSourceReferenceId;
    const interruptedAt = now();
    const interrupted = onboardingSessionSchema.parse({
      ...loaded.session,
      updatedAt: interruptedAt,
      urlBriefWorkflow: {
        ...loaded.session.urlBriefWorkflow,
        status: "discovering",
        lastSafeState: "evidence-ready",
        sourceReferences: loaded.session.urlBriefWorkflow.sourceReferences.map((source) =>
          source.id === currentSourceId
            ? { ...source, status: "discovering", failure: null }
            : source,
        ),
        updatedAt: interruptedAt,
      },
    });
    await repository.save(interrupted);

    const restored = await createDeterministicUrlBriefWorkflowService(
      new BrowserOnboardingSessionRepository(),
      { load: () => aurumNordicSeed.catalogue },
      { now: clock() },
    ).restore();

    expect(restored).toMatchObject({
      status: "evidence-ready",
      lastSafeState: "evidence-ready",
      failure: { code: "interrupted", retryable: true },
    });
    expect(restored.discoveryResult).toEqual(evidenceReady.discoveryResult);
  });

  it("migrates the existing v2 onboarding aggregate into an idle persisted URL workflow", async () => {
    const { repository } = await persistedService();
    const loaded = await repository.load();
    if (loaded.status !== "found") throw new Error("Expected a persisted onboarding session.");
    const withoutWorkflow: Record<string, unknown> = { ...loaded.session };
    delete withoutWorkflow.urlBriefWorkflow;
    localStorage.setItem(
      ONBOARDING_SESSION_STORAGE_KEY,
      JSON.stringify({
        ...withoutWorkflow,
        schemaVersion: INTERMEDIATE_ONBOARDING_SCHEMA_VERSION,
      }),
    );

    const migrated = await new BrowserOnboardingSessionRepository().load();

    expect(migrated).toMatchObject({
      status: "found",
      session: {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        urlBriefWorkflow: { status: "idle", lastSafeState: "idle" },
      },
    });
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      urlBriefWorkflow: { status: "idle" },
    });
  });
});
