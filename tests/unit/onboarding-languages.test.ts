import { describe, expect, it } from "vitest";
import {
  OnboardingLanguageValidationError,
  OnboardingService,
  validateOnboardingLanguageSelection,
} from "@/application/onboarding";
import {
  ONBOARDING_SCHEMA_VERSION,
  onboardingSessionSchema,
  type OnboardingSession,
} from "@/domain/onboarding";
import { createEmptyStorefrontDesignBrief, languagePlanSchema } from "@/domain/design-brief";
import type {
  OnboardingSessionRepository,
  OnboardingSessionLoadResult,
} from "@/services/onboarding";

const timestamp = "2026-07-18T08:00:00.000Z";

class MemoryOnboardingRepository implements OnboardingSessionRepository {
  session?: OnboardingSession;

  load(): Promise<OnboardingSessionLoadResult> {
    return Promise.resolve(
      this.session
        ? { status: "found", session: structuredClone(this.session) }
        : { status: "missing" },
    );
  }

  save(session: OnboardingSession): Promise<void> {
    this.session = structuredClone(onboardingSessionSchema.parse(session));
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.session = undefined;
    return Promise.resolve();
  }
}

async function languagesSession(repository: MemoryOnboardingRepository) {
  const service = new OnboardingService(repository, {
    createId: () => "onboarding_languages_test",
    now: () => timestamp,
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
  return { service, session };
}

function expectLanguageError(promise: Promise<unknown>, code: string) {
  return expect(promise).rejects.toMatchObject({
    name: "OnboardingLanguageValidationError",
    code,
  });
}

describe("canonical O-08 language selection", () => {
  it.each([
    ["English only", ["en"], "en", ["en"]],
    ["Finnish only", ["fi"], "fi", ["fi"]],
    ["English and Finnish in either input order", ["fi", "en"], "fi", ["en", "fi"]],
  ] as const)("accepts %s", (_label, selectedLanguages, primaryLanguage, canonical) => {
    expect(validateOnboardingLanguageSelection({ selectedLanguages, primaryLanguage })).toEqual({
      selectedLanguages: canonical,
      primaryLanguage,
    });
  });

  it.each([
    ["empty selection", { selectedLanguages: [], primaryLanguage: "en" }, "LANGUAGE_REQUIRED"],
    [
      "unsupported selection",
      { selectedLanguages: ["sv"], primaryLanguage: "sv" },
      "LANGUAGE_UNSUPPORTED",
    ],
    [
      "duplicate selection",
      { selectedLanguages: ["en", "en"], primaryLanguage: "en" },
      "LANGUAGE_DUPLICATE",
    ],
    [
      "missing primary",
      { selectedLanguages: ["en"], primaryLanguage: null },
      "PRIMARY_LANGUAGE_REQUIRED",
    ],
    [
      "unsupported primary",
      { selectedLanguages: ["en"], primaryLanguage: "sv" },
      "PRIMARY_LANGUAGE_UNSUPPORTED",
    ],
    [
      "primary outside selection",
      { selectedLanguages: ["en"], primaryLanguage: "fi" },
      "PRIMARY_LANGUAGE_NOT_SELECTED",
    ],
  ] as const)("rejects %s", (_label, input, code) => {
    expect(() => validateOnboardingLanguageSelection(input)).toThrow(
      expect.objectContaining({
        name: "OnboardingLanguageValidationError",
        code,
      }),
    );
  });

  it("keeps duplicate locale inputs strict at every canonical boundary", () => {
    expect(() => languagePlanSchema.parse({ selectedLanguages: ["en", "en"] })).toThrow();

    const session = onboardingSessionSchema.parse({
      id: "onboarding_duplicate_languages",
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
      designBrief: createEmptyStorefrontDesignBrief({
        id: "onboarding_duplicate_languages_brief",
        now: timestamp,
      }),
    });
    expect(() =>
      onboardingSessionSchema.parse({ ...session, selectedLanguages: ["en", "en"] }),
    ).toThrow();
  });

  it("completes O-08 atomically, synchronizes the brief, and preserves earlier data", async () => {
    const repository = new MemoryOnboardingRepository();
    const { service, session } = await languagesSession(repository);
    const before = structuredClone(session);

    const completed = await service.completeLanguages(session, {
      selectedLanguages: ["fi", "en"],
      primaryLanguage: "fi",
    });

    expect(completed.activeStepId).toBe("review-plan");
    expect(completed.completedStepIds).toContain("languages");
    expect(completed.skippedStepIds).not.toContain("languages");
    expect(completed.selectedLanguages).toEqual(["en", "fi"]);
    expect(completed.primaryLanguage).toBe("fi");
    expect(completed.designBrief.languagePlan).toEqual({
      selectedLanguages: ["en", "fi"],
      primaryLanguage: "fi",
    });
    expect(completed.designBrief.businessIdentity).toEqual(before.designBrief.businessIdentity);
    expect(completed.designBrief.catalogueContext).toBe(before.designBrief.catalogueContext);
    expect(repository.session).toEqual(completed);
  });

  it("updates O-08 without completing it and rejects a primary-language drift", async () => {
    const repository = new MemoryOnboardingRepository();
    const { service, session } = await languagesSession(repository);
    const updated = await service.updateLanguages(session, {
      selectedLanguages: ["fi", "en"],
      primaryLanguage: "en",
    });

    expect(updated.activeStepId).toBe("languages");
    expect(updated.completedStepIds).not.toContain("languages");
    expect(updated.selectedLanguages).toEqual(["en", "fi"]);
    expect(updated.designBrief.languagePlan).toEqual({
      selectedLanguages: ["en", "fi"],
      primaryLanguage: "en",
    });

    await expectLanguageError(
      service.updateLanguages(updated, {
        selectedLanguages: ["en"],
        primaryLanguage: "fi",
      }),
      "PRIMARY_LANGUAGE_NOT_SELECTED",
    );
    expect(repository.session).toEqual(updated);
  });

  it("rejects completion from the wrong step and malformed completed language state", async () => {
    const repository = new MemoryOnboardingRepository();
    const { service } = await languagesSession(repository);
    const wrongStep = await service.createSession();

    await expect(service.completeLanguages(wrongStep)).rejects.toMatchObject({
      name: "OnboardingTransitionError",
      code: "STEP_NOT_AVAILABLE",
    });

    const malformed = {
      ...wrongStep,
      activeStepId: "review-plan",
      completedStepIds: ["languages"],
      designBrief: {
        ...wrongStep.designBrief,
        languagePlan: { selectedLanguages: [], primaryLanguage: null },
      },
    };
    expect(() => onboardingSessionSchema.parse(malformed)).toThrow();
    expect(OnboardingLanguageValidationError).toBeDefined();
  });
});
