import { beforeEach, describe, expect, it } from "vitest";
import { createApprovedStorefrontProject } from "@/application/approved-storefront-project";
import { createInitialProjectAggregate } from "@/application/initial-project-aggregate";
import { createStorefrontGenerationReview } from "@/application/storefront-generation-review";
import { generateGuidedStorefront } from "@/application/guided-storefront-generation";
import { initialAggregateFixture } from "../helpers/initial-project-aggregate";
import { InMemoryProjectRepository } from "@/services/storage";
import {
  BrowserOnboardingSessionRepository,
  ONBOARDING_SESSION_STORAGE_KEY,
} from "@/services/onboarding";
import { OnboardingService } from "@/application/onboarding";
import { onboardingSessionSchema } from "@/domain/onboarding";

beforeEach(() => localStorage.clear());

describe("O-08 language persistence and propagation", () => {
  it("round-trips canonical language state through browser persistence", async () => {
    const repository = new BrowserOnboardingSessionRepository();
    const service = new OnboardingService(repository, {
      createId: () => "onboarding_languages_browser",
      now: () => "2026-07-18T08:00:00.000Z",
    });
    let session = await service.createSession();
    session = await service.selectCreationPath(session, "new-storefront");
    session = await service.advance(session);
    session = await service.completeBusinessBasics(session, {
      businessName: "Aurum Nordic",
      shortDescription: "A Helsinki jewellery studio.",
      industry: "jewellery",
      targetCustomer: "Customers looking for Nordic jewellery.",
      primaryMarket: "Finland",
    });
    session = await service.skipExistingSources(session);
    session = await service.skip(session);
    session = await service.skipVisualDirection(session);
    session = await service.completeCatalogueContext(session, "existing-vesko-catalogue");
    session = onboardingSessionSchema.parse({
      ...session,
      activeStepId: "languages",
      completedStepIds: [...session.completedStepIds, "pages"],
    });
    await repository.save(session);

    const completed = await service.completeLanguages(session, {
      selectedLanguages: ["fi", "en"],
      primaryLanguage: "fi",
    });
    const resumed = await new OnboardingService(new BrowserOnboardingSessionRepository()).resume();

    expect(resumed).toMatchObject({
      status: "resumed",
      session: {
        activeStepId: "review-plan",
        selectedLanguages: ["en", "fi"],
        primaryLanguage: "fi",
        designBrief: {
          languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "fi" },
        },
      },
    });
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      selectedLanguages: ["en", "fi"],
      designBrief: { languagePlan: { selectedLanguages: ["en", "fi"] } },
    });
    expect(completed.designBrief.languagePlan.primaryLanguage).toBe("fi");

    const reverseOrdered = {
      ...completed,
      selectedLanguages: ["fi", "en"],
      designBrief: {
        ...completed.designBrief,
        languagePlan: { ...completed.designBrief.languagePlan, selectedLanguages: ["fi", "en"] },
      },
    };
    localStorage.setItem(ONBOARDING_SESSION_STORAGE_KEY, JSON.stringify(reverseOrdered));
    const canonicalized = await new BrowserOnboardingSessionRepository().load();
    expect(canonicalized).toMatchObject({
      status: "found",
      session: {
        selectedLanguages: ["en", "fi"],
        designBrief: { languagePlan: { selectedLanguages: ["en", "fi"] } },
      },
    });
    if (canonicalized.status === "found") {
      expect(canonicalized.session.createdAt).toBe(completed.createdAt);
      expect(canonicalized.session.updatedAt).toBe(completed.updatedAt);
      expect(canonicalized.session.designBrief.businessIdentity).toEqual(
        completed.designBrief.businessIdentity,
      );
    }
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      selectedLanguages: ["en", "fi"],
      designBrief: { languagePlan: { selectedLanguages: ["en", "fi"] } },
    });

    const malformed = structuredClone(reverseOrdered);
    malformed.selectedLanguages = ["sv"];
    localStorage.setItem(ONBOARDING_SESSION_STORAGE_KEY, JSON.stringify(malformed));
    await expect(new BrowserOnboardingSessionRepository().load()).resolves.toEqual({
      status: "corrupt",
    });
  });

  it("passes canonical languages through P3-10, P3-13, P3-15 and P3-17", async () => {
    const input = initialAggregateFixture({
      suffix: "languages-propagation",
      selectedLanguages: ["fi", "en"],
      primaryLanguage: "fi",
    });

    expect(input.brief.languagePlan).toEqual({
      selectedLanguages: ["en", "fi"],
      primaryLanguage: "fi",
    });
    const generated = generateGuidedStorefront({
      brief: input.brief,
      projectId: "project_languages_propagation",
      snapshotId: "snapshot_languages_propagation",
      catalogueRef: input.catalogue.id,
      createdAt: input.brief.createdAt,
    });
    expect(generated.generatedSnapshot?.pages[0].title.fi).toBe(
      input.brief.businessIdentity.businessName,
    );

    const review = createStorefrontGenerationReview(generated, input.brief);
    expect(review.languagePlan).toEqual({
      selectedLanguages: ["en", "fi"],
      primaryLanguage: "fi",
    });

    const aggregate = createInitialProjectAggregate({
      ...input,
      guidedGenerationPlan: generated,
      review,
    });
    expect(aggregate.project.primaryLocale).toBe("fi");
    expect(aggregate.project.enabledLocales).toEqual(["en", "fi"]);

    const repository = new InMemoryProjectRepository([]);
    const result = await createApprovedStorefrontProject({
      ...input,
      guidedGenerationPlan: generated,
      review,
      repository,
    });
    await expect(repository.get(result.projectId)).resolves.toMatchObject({
      project: { primaryLocale: "fi", enabledLocales: ["en", "fi"] },
    });
  });
});
