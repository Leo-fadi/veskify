import { describe, expect, it } from "vitest";
import { OnboardingService, OnboardingTransitionError } from "@/application/onboarding";
import {
  ONBOARDING_SCHEMA_VERSION,
  onboardingSessionSchema,
  onboardingStepIds,
  onboardingStepRegistry,
  type OnboardingSession,
} from "@/domain/onboarding";
import {
  OnboardingStorageError,
  type OnboardingSessionLoadResult,
  type OnboardingSessionRepository,
} from "@/services/onboarding";

class MemoryOnboardingRepository implements OnboardingSessionRepository {
  session?: OnboardingSession;
  saveError?: Error;

  load(): Promise<OnboardingSessionLoadResult> {
    return Promise.resolve(
      this.session
        ? { status: "found", session: structuredClone(this.session) }
        : { status: "missing" },
    );
  }

  save(session: OnboardingSession): Promise<void> {
    if (this.saveError) return Promise.reject(this.saveError);
    this.session = structuredClone(onboardingSessionSchema.parse(session));
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.session = undefined;
    return Promise.resolve();
  }
}

const timestamp = "2026-07-18T08:00:00.000Z";

function validSession(overrides: Partial<OnboardingSession> = {}): OnboardingSession {
  return onboardingSessionSchema.parse({
    id: "onboarding_test",
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    creationPath: null,
    activeStepId: "creation-path",
    completedStepIds: [],
    skippedStepIds: [],
    selectedLanguages: ["en"],
    primaryLanguage: "en",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  });
}

function createService(repository = new MemoryOnboardingRepository()) {
  let tick = 0;
  return {
    repository,
    service: new OnboardingService(repository, {
      createId: () => "onboarding_test",
      now: () => new Date(Date.parse(timestamp) + tick++ * 1_000).toISOString(),
    }),
  };
}

describe("onboarding session schema", () => {
  it("accepts the canonical initial state", () => {
    expect(validSession()).toMatchObject({
      schemaVersion: 1,
      activeStepId: "creation-path",
      selectedLanguages: ["en"],
    });
  });

  it.each([
    ["duplicate completed steps", { completedStepIds: ["creation-path", "creation-path"] }],
    ["duplicate skipped steps", { skippedStepIds: ["existing-sources", "existing-sources"] }],
    [
      "completed and skipped overlap",
      { completedStepIds: ["creation-path"], skippedStepIds: ["creation-path"] },
    ],
    ["required step skipped", { skippedStepIds: ["creation-path"] }],
    ["unsupported step", { activeStepId: "unknown-step" }],
    ["unsupported language", { selectedLanguages: ["sv"] }],
    ["primary language outside selection", { selectedLanguages: ["en"], primaryLanguage: "fi" }],
    ["unsupported schema version", { schemaVersion: 2 }],
    ["updated before created", { updatedAt: "2026-07-17T08:00:00.000Z" }],
    ["jumped active step", { activeStepId: "brand-assets" }],
  ])("rejects %s", (_name, overrides) => {
    expect(() => onboardingSessionSchema.parse({ ...validSession(), ...overrides })).toThrow();
  });
});

describe("onboarding step registry", () => {
  it("defines O-01 through O-09 once in deterministic order with central navigation", () => {
    expect(onboardingStepRegistry.map((step) => step.id)).toEqual(onboardingStepIds);
    expect(onboardingStepRegistry.map((step) => step.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(onboardingStepRegistry[0]).toMatchObject({
      previousStepId: null,
      nextStepId: "business-basics",
      optional: false,
      completableNow: true,
    });
    expect(onboardingStepRegistry[2]).toMatchObject({ optional: true });
    expect(onboardingStepRegistry.at(-1)).toMatchObject({ nextStepId: null });
    expect(onboardingStepRegistry.every((step) => step.title.en && step.title.fi)).toBe(true);
  });
});

describe("onboarding application service", () => {
  it("selects a creation path, advances atomically, goes back, and preserves the choice", async () => {
    const { repository, service } = createService();
    const initial = await service.createSession();
    const selected = await service.selectCreationPath(initial, "new-storefront");
    expect(repository.session?.creationPath).toBe("new-storefront");

    const advanced = await service.advance(selected);
    expect(advanced.activeStepId).toBe("business-basics");
    expect(advanced.completedStepIds).toEqual(["creation-path"]);

    const returned = await service.goBack(advanced);
    expect(returned.activeStepId).toBe("creation-path");
    expect(returned.creationPath).toBe("new-storefront");
    expect(returned.completedStepIds).toEqual(["creation-path"]);
  });

  it("rejects advancing without a creation path and leaves repository state unchanged", async () => {
    const { repository, service } = createService();
    const initial = await service.createSession();
    const before = structuredClone(repository.session);

    await expect(service.advance(initial)).rejects.toMatchObject({
      code: "CREATION_PATH_REQUIRED",
    });
    expect(repository.session).toEqual(before);
  });

  it("rejects skipping required steps and supports optional-step skipping", async () => {
    const { repository, service } = createService();
    const initial = await service.createSession();
    await expect(service.skip(initial)).rejects.toBeInstanceOf(OnboardingTransitionError);

    const optional = validSession({
      creationPath: "demo-preset",
      activeStepId: "existing-sources",
      completedStepIds: ["creation-path", "business-basics"],
    });
    await repository.save(optional);
    const skipped = await service.skip(optional);
    expect(skipped.activeStepId).toBe("brand-assets");
    expect(skipped.skippedStepIds).toEqual(["existing-sources"]);
  });

  it("does not pretend foundation placeholders are completable", async () => {
    const { service } = createService();
    const placeholder = validSession({
      creationPath: "new-storefront",
      activeStepId: "business-basics",
      completedStepIds: ["creation-path"],
    });
    await expect(service.advance(placeholder)).rejects.toMatchObject({
      code: "STEP_NOT_AVAILABLE",
    });
  });

  it("resumes saved state and resets with a new monotonic clean identity supplied by the caller", async () => {
    const repository = new MemoryOnboardingRepository();
    let id = 0;
    const service = new OnboardingService(repository, {
      createId: () => `onboarding_${++id}`,
      now: () => timestamp,
    });
    const first = await service.createSession();
    const selected = await service.selectCreationPath(first, "redesign-existing-storefront");
    await service.advance(selected);

    await expect(service.resume()).resolves.toMatchObject({
      status: "resumed",
      session: { activeStepId: "business-basics" },
    });
    const reset = await service.reset();
    expect(reset).toMatchObject({
      id: "onboarding_2",
      activeStepId: "creation-path",
      creationPath: null,
    });
  });

  it("creates and returns a new session when resume finds no saved session", async () => {
    const { repository, service } = createService();

    await expect(service.resume()).resolves.toMatchObject({
      status: "new",
      session: { activeStepId: "creation-path" },
    });
    expect(repository.session).toMatchObject({ activeStepId: "creation-path" });
  });

  it("returns controlled unavailable storage when the first session save fails", async () => {
    const { repository, service } = createService();
    repository.saveError = new OnboardingStorageError();

    await expect(service.resume()).resolves.toEqual({ status: "unavailable" });
    expect(repository.session).toBeUndefined();
  });

  it("does not hide non-storage programming errors during initial creation", async () => {
    const { repository, service } = createService();
    const programmingError = new Error("unexpected invariant failure");
    repository.saveError = programmingError;

    await expect(service.resume()).rejects.toBe(programmingError);
  });

  it("keeps the prior session intact when a transition cannot be persisted", async () => {
    const { repository, service } = createService();
    const initial = await service.createSession();
    const before = structuredClone(repository.session);
    repository.saveError = new Error("save failed");

    await expect(service.selectCreationPath(initial, "demo-preset")).rejects.toThrow("save failed");
    expect(repository.session).toEqual(before);
    expect(initial.creationPath).toBeNull();
  });

  it("reports progress without exposing mutable state", () => {
    const { service } = createService();
    const session = validSession({
      creationPath: "demo-preset",
      activeStepId: "existing-sources",
      completedStepIds: ["creation-path", "business-basics"],
    });
    expect(service.inspectProgress(session)).toEqual({
      current: 3,
      total: 9,
      completed: 2,
      skipped: 0,
      percent: 22,
    });
  });
});
