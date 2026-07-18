import { beforeEach, describe, expect, it } from "vitest";
import { OnboardingService } from "@/application/onboarding";
import { ONBOARDING_SCHEMA_VERSION, PREVIOUS_ONBOARDING_SCHEMA_VERSION } from "@/domain/onboarding";
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

  it("persists partial and completed Business basics through the same session aggregate", async () => {
    const service = new OnboardingService(new BrowserOnboardingSessionRepository(), {
      createId: () => "onboarding_business",
      now: () => "2026-07-18T08:00:00.000Z",
    });
    let session = await service.createSession();
    session = await service.selectCreationPath(session, "new-storefront");
    session = await service.advance(session);
    session = await service.updateBusinessIdentityField(session, "businessName", "Aurum Nordic");

    const partialResume = await new OnboardingService(
      new BrowserOnboardingSessionRepository(),
    ).resume();
    expect(partialResume).toMatchObject({
      status: "resumed",
      session: {
        activeStepId: "business-basics",
        designBrief: { businessIdentity: { businessName: "Aurum Nordic" } },
      },
    });

    if (partialResume.status !== "resumed") throw new Error("Expected a resumed session.");
    await service.completeBusinessBasics(session, {
      shortDescription: "A Helsinki jewellery studio.",
      industry: "jewellery",
      targetCustomer: "Customers looking for Nordic jewellery.",
      primaryMarket: "Finland",
    });
    const completeResume = await new OnboardingService(
      new BrowserOnboardingSessionRepository(),
    ).resume();
    expect(completeResume).toMatchObject({
      status: "resumed",
      session: {
        activeStepId: "existing-sources",
        completedStepIds: ["creation-path", "business-basics"],
      },
    });
  });

  it("migrates a persisted P3-01 session and writes the v2 aggregate back", async () => {
    localStorage.setItem(
      ONBOARDING_SESSION_STORAGE_KEY,
      JSON.stringify({
        id: "onboarding_migrate",
        schemaVersion: PREVIOUS_ONBOARDING_SCHEMA_VERSION,
        creationPath: "demo-preset",
        activeStepId: "business-basics",
        completedStepIds: ["creation-path"],
        skippedStepIds: [],
        selectedLanguages: ["en"],
        primaryLanguage: "en",
        status: "active",
        createdAt: "2026-07-18T08:00:00.000Z",
        updatedAt: "2026-07-18T08:00:00.000Z",
      }),
    );

    const result = await new OnboardingService(new BrowserOnboardingSessionRepository()).resume();

    expect(result).toMatchObject({
      status: "resumed",
      session: {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        creationPath: "demo-preset",
        designBrief: { creationContext: { type: "demo-storefront" } },
      },
    });
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      designBrief: { status: "collecting" },
    });
  });

  it("persists and resumes a redesign URL through O-03 and O-04", async () => {
    const service = new OnboardingService(new BrowserOnboardingSessionRepository(), {
      createId: () => "onboarding_sources",
      now: () => "2026-07-18T08:00:00.000Z",
    });
    let session = await service.createSession();
    session = await service.selectCreationPath(session, "redesign-existing-storefront");
    session = await service.advance(session);
    session = await service.completeBusinessBasics(session, {
      businessName: "Aurum Nordic",
      shortDescription: "A Helsinki jewellery studio.",
      industry: "jewellery",
      targetCustomer: "Customers looking for Nordic jewellery.",
      primaryMarket: "Finland",
    });
    await service.updateExistingStorefrontUrl(session, "  merchant.example.test/store  ");

    const resumed = await new OnboardingService(new BrowserOnboardingSessionRepository()).resume();
    expect(resumed).toMatchObject({
      status: "resumed",
      session: {
        activeStepId: "existing-sources",
        designBrief: {
          creationContext: {
            type: "redesign-existing-storefront",
            existingStorefrontUrl: "https://merchant.example.test/store",
          },
        },
      },
    });

    if (resumed.status !== "resumed") throw new Error("Expected a resumed session.");
    const complete = await service.completeExistingSources(resumed.session);
    expect(complete.activeStepId).toBe("brand-assets");
    expect(complete.completedStepIds).toContain("existing-sources");
  });

  it("treats a redesign session completed without a URL as corrupt on resume", async () => {
    const service = new OnboardingService(new BrowserOnboardingSessionRepository(), {
      createId: () => "onboarding_corrupt_sources",
      now: () => "2026-07-18T08:00:00.000Z",
    });
    let session = await service.createSession();
    session = await service.selectCreationPath(session, "redesign-existing-storefront");
    session = await service.advance(session);
    session = await service.completeBusinessBasics(session, {
      businessName: "Aurum Nordic",
      shortDescription: "A Helsinki jewellery studio.",
      industry: "jewellery",
      targetCustomer: "Customers looking for Nordic jewellery.",
      primaryMarket: "Finland",
    });

    localStorage.setItem(
      ONBOARDING_SESSION_STORAGE_KEY,
      JSON.stringify({
        ...session,
        activeStepId: "brand-assets",
        completedStepIds: [...session.completedStepIds, "existing-sources"],
      }),
    );

    await expect(
      new OnboardingService(new BrowserOnboardingSessionRepository()).resume(),
    ).resolves.toEqual({
      status: "corrupt",
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
