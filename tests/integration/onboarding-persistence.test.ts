import { beforeEach, describe, expect, it } from "vitest";
import { OnboardingService } from "@/application/onboarding";
import {
  BrowserOnboardingSessionRepository,
  ONBOARDING_SESSION_STORAGE_KEY,
} from "@/services/onboarding";

describe("browser onboarding persistence", () => {
  beforeEach(() => localStorage.clear());

  it("persists valid transitions and returns detached validated sessions on refresh", async () => {
    const firstRepository = new BrowserOnboardingSessionRepository();
    const firstService = new OnboardingService(firstRepository, {
      createId: () => "onboarding_browser",
      now: () => "2026-07-18T08:00:00.000Z",
    });
    const initial = await firstService.createSession();
    const selected = await firstService.selectCreationPath(initial, "demo-preset");
    await firstService.advance(selected);

    const refreshedService = new OnboardingService(new BrowserOnboardingSessionRepository());
    const resumed = await refreshedService.resume();
    expect(resumed).toMatchObject({
      status: "resumed",
      session: { activeStepId: "business-basics", creationPath: "demo-preset" },
    });
    if (resumed.status !== "resumed") throw new Error("Expected a resumed session.");
    resumed.session.completedStepIds.push("existing-sources");
    const reloaded = await refreshedService.loadSession();
    expect(reloaded).toMatchObject({
      status: "found",
      session: { completedStepIds: ["creation-path"] },
    });
  });

  it("classifies corrupt and incompatible data as recoverable", async () => {
    const repository = new BrowserOnboardingSessionRepository();
    localStorage.setItem(ONBOARDING_SESSION_STORAGE_KEY, "not json");
    await expect(repository.load()).resolves.toEqual({ status: "corrupt" });

    localStorage.setItem(ONBOARDING_SESSION_STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }));
    await expect(repository.load()).resolves.toEqual({ status: "incompatible" });
  });

  it("is SSR-safe and does not alter unrelated project or commerce storage", async () => {
    const unavailable = new BrowserOnboardingSessionRepository({ getStorage: () => undefined });
    await expect(unavailable.load()).resolves.toEqual({ status: "unavailable" });

    localStorage.setItem("veskify:project-state", "unchanged");
    localStorage.setItem("veskify:catalogue-state", "unchanged");
    const service = new OnboardingService(new BrowserOnboardingSessionRepository(), {
      createId: () => "onboarding_isolated",
      now: () => "2026-07-18T08:00:00.000Z",
    });
    await service.createSession();
    expect(localStorage.getItem("veskify:project-state")).toBe("unchanged");
    expect(localStorage.getItem("veskify:catalogue-state")).toBe("unchanged");
  });
});
