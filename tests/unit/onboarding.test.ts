import { describe, expect, it } from "vitest";
import {
  normalizeExistingStorefrontUrl,
  OnboardingMutationQueue,
  OnboardingService,
  OnboardingTransitionError,
  type VisualDirectionDraft,
  validateExistingStorefrontSource,
} from "@/application/onboarding";
import {
  ONBOARDING_SCHEMA_VERSION,
  PREVIOUS_ONBOARDING_SCHEMA_VERSION,
  migrateOnboardingSession,
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
import {
  createEmptyStorefrontDesignBrief,
  updateStorefrontDesignBriefArea,
} from "@/domain/design-brief";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function validSession(overrides: Partial<OnboardingSession> = {}): OnboardingSession {
  const creationPath = overrides.creationPath ?? null;
  let designBrief =
    overrides.designBrief ??
    createEmptyStorefrontDesignBrief({ id: "onboarding_test_brief", now: timestamp });
  if (!overrides.designBrief && creationPath) {
    designBrief = updateStorefrontDesignBriefArea(
      designBrief,
      "creationContext",
      {
        type:
          creationPath === "new-storefront"
            ? "new-storefront"
            : creationPath === "redesign-existing-storefront"
              ? "redesign-existing-storefront"
              : "demo-storefront",
      },
      timestamp,
    );
  }
  if (!overrides.designBrief && overrides.completedStepIds?.includes("business-basics")) {
    designBrief = updateStorefrontDesignBriefArea(
      designBrief,
      "businessIdentity",
      {
        businessName: "Aurum Nordic",
        shortDescription: "A Helsinki jewellery studio.",
        industry: "jewellery",
        targetCustomer: "Customers looking for Nordic jewellery.",
        primaryMarket: "Finland",
      },
      timestamp,
    );
  }
  const updatedAt =
    overrides.updatedAt ??
    new Date(Math.max(Date.parse(timestamp), Date.parse(designBrief.updatedAt))).toISOString();
  return onboardingSessionSchema.parse({
    id: "onboarding_test",
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    creationPath,
    activeStepId: "creation-path",
    completedStepIds: [],
    skippedStepIds: [],
    selectedLanguages: ["en"],
    primaryLanguage: "en",
    status: "active",
    createdAt: timestamp,
    updatedAt,
    designBrief,
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

const completeBusinessIdentity = {
  businessName: "Aurum Nordic",
  shortDescription: "A Helsinki jewellery studio.",
  industry: "jewellery" as const,
  targetCustomer: "Customers looking for Nordic jewellery.",
  primaryMarket: "Finland",
};

function businessBasicsSession(): OnboardingSession {
  const base = validSession({
    creationPath: "new-storefront",
    activeStepId: "business-basics",
    completedStepIds: ["creation-path"],
  });
  const designBrief = updateStorefrontDesignBriefArea(
    base.designBrief,
    "businessIdentity",
    completeBusinessIdentity,
    timestamp,
  );
  return onboardingSessionSchema.parse({ ...base, designBrief, updatedAt: designBrief.updatedAt });
}

function existingSourcesSession(
  creationPath: "new-storefront" | "redesign-existing-storefront" | "demo-preset",
  existingStorefrontUrl: string | null = null,
): OnboardingSession {
  const base = validSession({
    creationPath,
    activeStepId: "existing-sources",
    completedStepIds: ["creation-path", "business-basics"],
  });
  const designBrief = updateStorefrontDesignBriefArea(
    base.designBrief,
    "creationContext",
    { existingStorefrontUrl },
    timestamp,
  );
  return onboardingSessionSchema.parse({ ...base, designBrief, updatedAt: designBrief.updatedAt });
}

function resolvedExistingSourcesSession(
  creationPath: "new-storefront" | "redesign-existing-storefront" | "demo-preset",
  existingStorefrontUrl: string | null = null,
): OnboardingSession {
  const session = existingSourcesSession(creationPath, existingStorefrontUrl);
  return onboardingSessionSchema.parse({
    ...session,
    activeStepId: "brand-assets",
    completedStepIds: [...session.completedStepIds, "existing-sources"],
  });
}

function visualDirectionSession(overrides: Partial<OnboardingSession> = {}): OnboardingSession {
  const base = resolvedExistingSourcesSession("new-storefront");
  const designBrief = overrides.designBrief ?? base.designBrief;
  return onboardingSessionSchema.parse({
    ...base,
    activeStepId: "visual-direction",
    skippedStepIds: ["brand-assets"],
    designBrief,
    updatedAt: overrides.updatedAt ?? designBrief.updatedAt,
    ...overrides,
  });
}

const completeVisualDirectionDraft: VisualDirectionDraft = {
  visualStyleDirection: "editorial",
  typographyDirection: "mixed",
  imageryDirection: "lifestyle",
  toneKeywords: ["warm", "storytelling"],
  generationPreferences: {
    visualDensity: "airy",
    contentEmphasis: "storytelling",
    merchandisingEmphasis: "high",
    sectionRichness: "rich",
    accessibilityPreference: "high-contrast",
  },
};

describe("onboarding session schema", () => {
  it("accepts the canonical initial state", () => {
    expect(validSession()).toMatchObject({
      schemaVersion: 2,
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
    ["unsupported schema version", { schemaVersion: 99 }],
    ["updated before created", { updatedAt: "2026-07-17T08:00:00.000Z" }],
    ["jumped active step", { activeStepId: "brand-assets" }],
  ])("rejects %s", (_name, overrides) => {
    expect(() => onboardingSessionSchema.parse({ ...validSession(), ...overrides })).toThrow();
  });

  it("enforces the path-aware existing-sources completion invariants", () => {
    const redesignWithoutUrl = existingSourcesSession("redesign-existing-storefront");
    expect(() =>
      onboardingSessionSchema.parse({
        ...redesignWithoutUrl,
        activeStepId: "brand-assets",
        completedStepIds: [...redesignWithoutUrl.completedStepIds, "existing-sources"],
      }),
    ).toThrow();

    const completedRedesign = resolvedExistingSourcesSession(
      "redesign-existing-storefront",
      "https://merchant.example.test/store",
    );
    expect(completedRedesign.designBrief.creationContext.existingStorefrontUrl).toBe(
      "https://merchant.example.test/store",
    );

    const skippedRedesignWithUrl = existingSourcesSession(
      "redesign-existing-storefront",
      "https://merchant.example.test/store",
    );
    expect(() =>
      onboardingSessionSchema.parse({
        ...skippedRedesignWithUrl,
        activeStepId: "brand-assets",
        skippedStepIds: ["existing-sources"],
      }),
    ).toThrow();

    expect(() =>
      onboardingSessionSchema.parse({
        ...completedRedesign,
        skippedStepIds: ["existing-sources"],
      }),
    ).toThrow();

    expect(
      resolvedExistingSourcesSession("new-storefront").designBrief.creationContext
        .existingStorefrontUrl,
    ).toBeNull();
    expect(
      resolvedExistingSourcesSession("demo-preset").designBrief.creationContext
        .existingStorefrontUrl,
    ).toBeNull();
    expect(
      onboardingSessionSchema.parse({
        ...existingSourcesSession("new-storefront"),
        activeStepId: "brand-assets",
        skippedStepIds: ["existing-sources"],
      }).skippedStepIds,
    ).toEqual(["existing-sources"]);
  });

  it("enforces visual-direction completion and skip invariants", () => {
    expect(() =>
      onboardingSessionSchema.parse({
        ...visualDirectionSession(),
        activeStepId: "catalogue",
        completedStepIds: [
          "creation-path",
          "business-basics",
          "existing-sources",
          "visual-direction",
        ],
      }),
    ).toThrow();

    const completedBrief = updateStorefrontDesignBriefArea(
      updateStorefrontDesignBriefArea(
        visualDirectionSession().designBrief,
        "brandDirection",
        {
          visualStyleDirection: completeVisualDirectionDraft.visualStyleDirection,
          typographyDirection: completeVisualDirectionDraft.typographyDirection,
          imageryDirection: completeVisualDirectionDraft.imageryDirection,
          toneKeywords: [...completeVisualDirectionDraft.toneKeywords],
        },
        timestamp,
      ),
      "generationPreferences",
      completeVisualDirectionDraft.generationPreferences,
      timestamp,
    );
    const completed = onboardingSessionSchema.parse({
      ...visualDirectionSession({ designBrief: completedBrief }),
      activeStepId: "catalogue",
      completedStepIds: [
        "creation-path",
        "business-basics",
        "existing-sources",
        "visual-direction",
      ],
      skippedStepIds: ["brand-assets"],
      designBrief: completedBrief,
      updatedAt: completedBrief.updatedAt,
    });
    expect(completed.completedStepIds).toContain("visual-direction");

    const skippedWithValues = updateStorefrontDesignBriefArea(
      visualDirectionSession().designBrief,
      "brandDirection",
      { visualStyleDirection: "minimal", toneKeywords: ["warm"] },
      timestamp,
    );
    expect(() =>
      onboardingSessionSchema.parse({
        ...visualDirectionSession({ designBrief: skippedWithValues }),
        activeStepId: "catalogue",
        skippedStepIds: ["brand-assets", "visual-direction"],
      }),
    ).toThrow();

    const skippedWithPreferences = updateStorefrontDesignBriefArea(
      visualDirectionSession().designBrief,
      "generationPreferences",
      { visualDensity: "airy" },
      timestamp,
    );
    expect(() =>
      onboardingSessionSchema.parse({
        ...visualDirectionSession({ designBrief: skippedWithPreferences }),
        activeStepId: "catalogue",
        skippedStepIds: ["brand-assets", "visual-direction"],
      }),
    ).toThrow();
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
    expect(onboardingStepRegistry[4]).toMatchObject({ optional: true, completableNow: true });
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

  it("clears a redesign URL when the dedicated existing-sources skip runs", async () => {
    const { repository, service } = createService();
    const session = existingSourcesSession(
      "redesign-existing-storefront",
      "https://merchant.example.test/store",
    );
    await repository.save(session);

    const skipped = await service.skipExistingSources(session);

    expect(skipped.activeStepId).toBe("brand-assets");
    expect(skipped.completedStepIds).not.toContain("existing-sources");
    expect(skipped.skippedStepIds).toEqual(["existing-sources"]);
    expect(skipped.designBrief.creationContext.existingStorefrontUrl).toBeNull();
    expect(repository.session?.designBrief.creationContext.existingStorefrontUrl).toBeNull();
  });

  it("saves visual direction fields atomically and completes O-05", async () => {
    const { repository, service } = createService();
    const session = visualDirectionSession();
    await repository.save(session);

    const completed = await service.completeVisualDirection(session, completeVisualDirectionDraft);

    expect(completed.activeStepId).toBe("catalogue");
    expect(completed.completedStepIds).toContain("visual-direction");
    expect(completed.skippedStepIds).toEqual(["brand-assets"]);
    expect(completed.designBrief.brandDirection).toMatchObject({
      visualStyleDirection: completeVisualDirectionDraft.visualStyleDirection,
      typographyDirection: completeVisualDirectionDraft.typographyDirection,
      imageryDirection: completeVisualDirectionDraft.imageryDirection,
      toneKeywords: completeVisualDirectionDraft.toneKeywords,
    });
    expect(completed.designBrief.generationPreferences).toEqual(
      completeVisualDirectionDraft.generationPreferences,
    );
    expect(repository.session).toEqual(completed);
  });

  it("requires a style, keeps partial collecting drafts valid, and supports all style choices", async () => {
    const { service } = createService();
    const session = visualDirectionSession();
    await expect(service.completeVisualDirection(session)).rejects.toMatchObject({
      code: "VISUAL_STYLE_REQUIRED",
    });
    await expect(
      service.updateVisualDirection(session, {
        ...completeVisualDirectionDraft,
        visualStyleDirection: null,
      }),
    ).resolves.toMatchObject({ activeStepId: "visual-direction" });

    for (const style of ["minimal", "editorial", "luxury", "playful", "bold", "natural"] as const) {
      await expect(
        service.completeVisualDirection(session, {
          ...completeVisualDirectionDraft,
          visualStyleDirection: style,
        }),
      ).resolves.toMatchObject({ activeStepId: "catalogue" });
    }
  });

  it("clears only O-05 fields on the dedicated skip transition", async () => {
    const { service } = createService();
    const designBrief = updateStorefrontDesignBriefArea(
      updateStorefrontDesignBriefArea(
        visualDirectionSession().designBrief,
        "brandDirection",
        {
          logoAssetRef: { id: "asset_logo" },
          visualStyleDirection: "bold",
          typographyDirection: "serif",
          imageryDirection: "studio",
          toneKeywords: ["warm"],
        },
        timestamp,
      ),
      "generationPreferences",
      completeVisualDirectionDraft.generationPreferences,
      timestamp,
    );
    const session = visualDirectionSession({ designBrief });
    const skipped = await service.skipVisualDirection(session);

    expect(skipped.activeStepId).toBe("catalogue");
    expect(skipped.completedStepIds).not.toContain("visual-direction");
    expect(skipped.skippedStepIds).toContain("visual-direction");
    expect(skipped.designBrief.brandDirection).toMatchObject({
      logoAssetRef: { id: "asset_logo" },
      visualStyleDirection: null,
      typographyDirection: null,
      imageryDirection: null,
      toneKeywords: [],
    });
    expect(skipped.designBrief.generationPreferences).toEqual({
      visualDensity: "balanced",
      contentEmphasis: "balanced",
      merchandisingEmphasis: "balanced",
      sectionRichness: "balanced",
      accessibilityPreference: "standard",
    });
  });

  it("rejects unsupported or over-limit tone choices", async () => {
    const { service } = createService();
    const session = visualDirectionSession();
    await expect(
      service.updateVisualDirection(session, {
        ...completeVisualDirectionDraft,
        toneKeywords: ["storytelling", "warm"],
      }),
    ).resolves.toMatchObject({
      designBrief: { brandDirection: { toneKeywords: ["warm", "storytelling"] } },
    });
    await expect(
      service.updateVisualDirection(session, {
        ...completeVisualDirectionDraft,
        toneKeywords: ["unknown"],
      }),
    ).rejects.toMatchObject({ code: "VISUAL_TONE_KEYWORD_UNSUPPORTED" });
    await expect(
      service.updateVisualDirection(session, {
        ...completeVisualDirectionDraft,
        toneKeywords: ["warm", "calm", "friendly", "formal", "premium", "direct", "natural"],
      }),
    ).rejects.toMatchObject({ code: "VISUAL_TONE_KEYWORDS_LIMIT" });
  });

  it("does not advance from incomplete Business basics", async () => {
    const { service } = createService();
    const placeholder = validSession({
      creationPath: "new-storefront",
      activeStepId: "business-basics",
      completedStepIds: ["creation-path"],
    });
    await expect(service.advance(placeholder)).rejects.toMatchObject({
      code: "BUSINESS_BASICS_INCOMPLETE",
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

  it("creates one collecting brief with a stable identity and preserved timestamp", async () => {
    const { service } = createService();
    const session = await service.createSession();

    expect(session.designBrief).toMatchObject({
      id: "onboarding_test_brief",
      status: "collecting",
      createdAt: timestamp,
      creationContext: { type: null },
    });
    expect(session.designBrief.createdAt).toBe(session.createdAt);
    expect(session.designBrief).not.toHaveProperty("products");
  });

  it.each([
    ["new-storefront", "new-storefront"],
    ["redesign-existing-storefront", "redesign-existing-storefront"],
    ["demo-preset", "demo-storefront"],
  ] as const)("maps %s to the canonical brief context", async (path, context) => {
    const { service } = createService();
    const initial = await service.createSession();
    const selected = await service.selectCreationPath(initial, path);

    expect(selected.creationPath).toBe(path);
    expect(selected.designBrief.creationContext.type).toBe(context);
  });

  it("clears a redesign URL when changing to another creation path", async () => {
    const { service } = createService();
    const initial = await service.createSession();
    const redesign = await service.selectCreationPath(initial, "redesign-existing-storefront");
    const withUrlBrief = updateStorefrontDesignBriefArea(
      redesign.designBrief,
      "creationContext",
      { existingStorefrontUrl: "https://merchant.example.test" },
      timestamp,
    );
    const withUrl = onboardingSessionSchema.parse({
      ...redesign,
      designBrief: withUrlBrief,
      updatedAt: withUrlBrief.updatedAt,
    });
    const selected = await service.selectCreationPath(withUrl, "new-storefront");

    expect(selected.designBrief.creationContext).toEqual({
      type: "new-storefront",
      existingStorefrontUrl: null,
    });
  });

  it("rejects a session whose creation path and brief context drift apart", () => {
    const session = validSession({ creationPath: "new-storefront" });
    const driftedBrief = updateStorefrontDesignBriefArea(
      session.designBrief,
      "creationContext",
      { type: "demo-storefront" },
      timestamp,
    );

    expect(() =>
      onboardingSessionSchema.parse({
        ...session,
        designBrief: driftedBrief,
        updatedAt: driftedBrief.updatedAt,
      }),
    ).toThrow(/must agree/i);
  });

  it("updates business identity through immutable canonical brief helpers", async () => {
    const { service } = createService();
    const session = businessBasicsSession();
    const updated = await service.updateBusinessIdentityField(
      session,
      "businessName",
      "  Updated Nordic  ",
    );

    expect(session.designBrief.businessIdentity.businessName).toBe("Aurum Nordic");
    expect(updated.designBrief.businessIdentity.businessName).toBe("Updated Nordic");
    expect(updated.designBrief.businessIdentity.shortDescription).toBe(
      completeBusinessIdentity.shortDescription,
    );
    expect(updated.completedStepIds).not.toContain("business-basics");
  });

  it("classifies storage failures during field updates and preserves the prior session", async () => {
    const repository = new MemoryOnboardingRepository();
    const { service } = createService(repository);
    const session = businessBasicsSession();
    await repository.save(session);
    repository.saveError = new OnboardingStorageError();

    await expect(
      service.updateBusinessIdentityField(session, "businessName", "Unsaved change"),
    ).rejects.toBeInstanceOf(OnboardingStorageError);
    expect(repository.session).toEqual(session);
  });

  it("classifies storage failures during O-02 completion and does not hide programming errors", async () => {
    const repository = new MemoryOnboardingRepository();
    const { service } = createService(repository);
    const session = validSession({
      creationPath: "new-storefront",
      activeStepId: "business-basics",
      completedStepIds: ["creation-path"],
    });
    await repository.save(session);
    repository.saveError = new OnboardingStorageError();
    await expect(
      service.completeBusinessBasics(session, completeBusinessIdentity),
    ).rejects.toBeInstanceOf(OnboardingStorageError);

    const programmingError = new Error("unexpected save implementation error");
    repository.saveError = programmingError;
    await expect(service.completeBusinessBasics(session, completeBusinessIdentity)).rejects.toBe(
      programmingError,
    );
  });

  it("evaluates required O-02 fields without requiring later onboarding areas", () => {
    const { service } = createService();
    const session = validSession({
      creationPath: "new-storefront",
      activeStepId: "business-basics",
      completedStepIds: ["creation-path"],
    });
    const incomplete = service.evaluateBusinessBasics(session);
    expect(incomplete).toEqual({
      complete: false,
      missingFields: [
        "businessName",
        "shortDescription",
        "industry",
        "targetCustomer",
        "primaryMarket",
      ],
    });

    const complete = service.evaluateBusinessBasics(businessBasicsSession());
    expect(complete).toEqual({ complete: true, missingFields: [] });
  });

  it("completes O-02 only with valid fields and advances to deferred O-03", async () => {
    const { service } = createService();
    const incomplete = validSession({
      creationPath: "new-storefront",
      activeStepId: "business-basics",
      completedStepIds: ["creation-path"],
    });
    await expect(service.completeBusinessBasics(incomplete)).rejects.toEqual(
      expect.objectContaining({
        code: "BUSINESS_BASICS_INCOMPLETE",
      }),
    );

    const complete = await service.completeBusinessBasics(incomplete, completeBusinessIdentity);
    expect(complete).toMatchObject({
      activeStepId: "existing-sources",
      completedStepIds: ["creation-path", "business-basics"],
      designBrief: { status: "collecting" },
    });
    expect(complete.designBrief.businessIdentity).toMatchObject(completeBusinessIdentity);
  });

  it("goes back from O-03 without losing completed O-02 values", async () => {
    const { service } = createService();
    const complete = await service.completeBusinessBasics(
      validSession({
        creationPath: "new-storefront",
        activeStepId: "business-basics",
        completedStepIds: ["creation-path"],
      }),
      completeBusinessIdentity,
    );
    const back = await service.goBack(complete);

    expect(back.activeStepId).toBe("business-basics");
    expect(back.designBrief.businessIdentity).toMatchObject(completeBusinessIdentity);
    expect(back.completedStepIds).toContain("business-basics");
  });

  it("normalizes bare domains and rejects unsafe existing storefront URLs", () => {
    expect(normalizeExistingStorefrontUrl("  example.com/shop  ")).toBe("https://example.com/shop");
    expect(validateExistingStorefrontSource("https://example.com")).toEqual({
      valid: true,
      normalizedUrl: "https://example.com",
    });
    expect(validateExistingStorefrontSource("http://example.com")).toMatchObject({
      valid: false,
      code: "EXISTING_STOREFRONT_URL_INSECURE",
    });
    expect(validateExistingStorefrontSource("javascript:alert(1)")).toMatchObject({
      valid: false,
      code: "EXISTING_STOREFRONT_URL_UNSUPPORTED_PROTOCOL",
    });
    expect(validateExistingStorefrontSource("not a URL")).toMatchObject({
      valid: false,
      code: "EXISTING_STOREFRONT_URL_INVALID",
    });
  });

  it("requires a redesign URL but completes new and demo paths without one", async () => {
    const { service } = createService();
    const redesign = existingSourcesSession("redesign-existing-storefront");
    expect(service.evaluateExistingSourcesCompletion(redesign)).toEqual({
      complete: false,
      required: true,
      missingFields: ["existingStorefrontUrl"],
    });
    await expect(service.advance(redesign)).rejects.toMatchObject({
      code: "EXISTING_STOREFRONT_URL_REQUIRED",
    });

    await expect(service.advance(existingSourcesSession("new-storefront"))).resolves.toMatchObject({
      activeStepId: "brand-assets",
      completedStepIds: ["creation-path", "business-basics", "existing-sources"],
      designBrief: { creationContext: { existingStorefrontUrl: null } },
    });
    await expect(service.advance(existingSourcesSession("demo-preset"))).resolves.toMatchObject({
      activeStepId: "brand-assets",
      completedStepIds: ["creation-path", "business-basics", "existing-sources"],
      designBrief: { creationContext: { existingStorefrontUrl: null } },
    });
  });

  it("updates an existing storefront URL immutably and advances to Brand assets", async () => {
    const { service } = createService();
    const session = existingSourcesSession("redesign-existing-storefront");
    const updated = await service.updateExistingStorefrontUrl(session, "  example.com  ");

    expect(session.designBrief.creationContext.existingStorefrontUrl).toBeNull();
    expect(updated.designBrief.creationContext.existingStorefrontUrl).toBe("https://example.com");
    expect(updated.designBrief.businessIdentity).toEqual(session.designBrief.businessIdentity);
    expect(updated.designBrief.id).toBe(session.designBrief.id);
    expect(Date.parse(updated.designBrief.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(session.designBrief.updatedAt),
    );

    const complete = await service.completeExistingSources(updated);
    expect(complete.activeStepId).toBe("brand-assets");
    expect(complete.completedStepIds).toContain("existing-sources");
    expect(complete.designBrief.creationContext.existingStorefrontUrl).toBe("https://example.com");
  });

  it("preserves a valid URL when going back and returning to O-03", async () => {
    const { service } = createService();
    const saved = await service.updateExistingStorefrontUrl(
      existingSourcesSession("redesign-existing-storefront"),
      "https://merchant.example.test/store",
    );
    const completed = await service.completeExistingSources(saved);
    const back = await service.goBack(completed);

    expect(back.activeStepId).toBe("existing-sources");
    expect(back.designBrief.creationContext.existingStorefrontUrl).toBe(
      "https://merchant.example.test/store",
    );
  });

  it("does not let a redesign URL survive switching away and back", async () => {
    const { service } = createService();
    const initial = await service.selectCreationPath(
      await service.createSession(),
      "redesign-existing-storefront",
    );
    const withUrlBrief = updateStorefrontDesignBriefArea(
      initial.designBrief,
      "creationContext",
      { existingStorefrontUrl: "https://merchant.example.test" },
      timestamp,
    );
    const withUrl = onboardingSessionSchema.parse({
      ...initial,
      activeStepId: "creation-path",
      designBrief: withUrlBrief,
      updatedAt: withUrlBrief.updatedAt,
    });
    const newPath = await service.selectCreationPath(withUrl, "new-storefront");
    expect(newPath.designBrief.creationContext.existingStorefrontUrl).toBeNull();
    const redesignAgain = await service.selectCreationPath(newPath, "redesign-existing-storefront");
    expect(redesignAgain.designBrief.creationContext.existingStorefrontUrl).toBeNull();
  });

  it("classifies existing-source storage failures and programming errors", async () => {
    const repository = new MemoryOnboardingRepository();
    const { service } = createService(repository);
    const session = existingSourcesSession("redesign-existing-storefront");
    await repository.save(session);
    repository.saveError = new OnboardingStorageError();
    await expect(
      service.updateExistingStorefrontUrl(session, "https://merchant.example.test"),
    ).rejects.toBeInstanceOf(OnboardingStorageError);

    const programmingError = new Error("unexpected source save failure");
    repository.saveError = programmingError;
    await expect(
      service.updateExistingStorefrontUrl(session, "https://merchant.example.test"),
    ).rejects.toBe(programmingError);
  });

  it("retries an existing-sources skip after storage recovers", async () => {
    const repository = new MemoryOnboardingRepository();
    const { service } = createService(repository);
    const session = existingSourcesSession(
      "redesign-existing-storefront",
      "https://merchant.example.test",
    );
    await repository.save(session);
    repository.saveError = new OnboardingStorageError();

    await expect(service.skipExistingSources(session)).rejects.toBeInstanceOf(
      OnboardingStorageError,
    );
    repository.saveError = undefined;

    const skipped = await service.skipExistingSources(session);
    expect(skipped.activeStepId).toBe("brand-assets");
    expect(skipped.designBrief.creationContext.existingStorefrontUrl).toBeNull();
  });

  it("migrates a valid P3-01 session into one collecting brief", () => {
    const legacy = {
      id: "onboarding_legacy",
      schemaVersion: PREVIOUS_ONBOARDING_SCHEMA_VERSION,
      creationPath: "redesign-existing-storefront",
      activeStepId: "business-basics",
      completedStepIds: ["creation-path"],
      skippedStepIds: [],
      selectedLanguages: ["en"],
      primaryLanguage: "en",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    } as const;
    const migrated = migrateOnboardingSession(legacy);

    expect(migrated).toMatchObject({
      id: legacy.id,
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      creationPath: legacy.creationPath,
      activeStepId: "business-basics",
      completedStepIds: ["creation-path"],
      designBrief: {
        status: "collecting",
        creationContext: { type: "redesign-existing-storefront" },
      },
    });
    expect(migrated.designBrief.createdAt).toBe(legacy.createdAt);
  });

  it("downgrades an invalid legacy O-02 completion instead of inventing business data", () => {
    const legacy = {
      id: "onboarding_legacy_complete",
      schemaVersion: PREVIOUS_ONBOARDING_SCHEMA_VERSION,
      creationPath: "demo-preset",
      activeStepId: "existing-sources",
      completedStepIds: ["creation-path", "business-basics"],
      skippedStepIds: [],
      selectedLanguages: ["en"],
      primaryLanguage: "en",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    } as const;
    const migrated = migrateOnboardingSession(legacy);

    expect(migrated.activeStepId).toBe("business-basics");
    expect(migrated.completedStepIds).toEqual(["creation-path"]);
    expect(migrated.designBrief.businessIdentity.businessName).toBe("");
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

describe("onboarding mutation queue", () => {
  it("runs queued mutations against the latest session after earlier writes settle", async () => {
    const queue = new OnboardingMutationQueue();
    const firstWrite = deferred<void>();
    let latestSession = "initial";
    const seen: string[] = [];

    const autosave = queue.enqueue(async () => {
      seen.push(latestSession);
      await firstWrite.promise;
      latestSession = "business-value";
      return latestSession;
    });
    const back = queue.enqueue(() => {
      seen.push(latestSession);
      return Promise.resolve("creation-path");
    });

    await Promise.resolve();
    expect(seen).toEqual(["initial"]);
    firstWrite.resolve();
    await expect(autosave).resolves.toBe("business-value");
    await expect(back).resolves.toBe("creation-path");
    expect(seen).toEqual(["initial", "business-value"]);
  });

  it("preserves rapid field writes before Back and creation-path transitions", async () => {
    const queue = new OnboardingMutationQueue();
    const firstWrite = deferred<void>();
    let latestSession = { step: "business-basics", businessName: "", primaryMarket: "" };
    const seen: Array<typeof latestSession> = [];

    const firstField = queue.enqueue(async () => {
      seen.push({ ...latestSession });
      await firstWrite.promise;
      latestSession = { ...latestSession, businessName: "Aurum Nordic" };
      return latestSession;
    });
    const secondField = queue.enqueue(() => {
      seen.push({ ...latestSession });
      latestSession = { ...latestSession, primaryMarket: "Finland" };
      return Promise.resolve(latestSession);
    });
    const back = queue.enqueue(() => {
      seen.push({ ...latestSession });
      latestSession = { ...latestSession, step: "creation-path" };
      return Promise.resolve(latestSession);
    });

    firstWrite.resolve();
    await expect(firstField).resolves.toMatchObject({ businessName: "Aurum Nordic" });
    await expect(secondField).resolves.toMatchObject({ primaryMarket: "Finland" });
    await expect(back).resolves.toMatchObject({ step: "creation-path" });
    expect(seen).toEqual([
      { step: "business-basics", businessName: "", primaryMarket: "" },
      { step: "business-basics", businessName: "Aurum Nordic", primaryMarket: "" },
      { step: "business-basics", businessName: "Aurum Nordic", primaryMarket: "Finland" },
    ]);
  });

  it("pauses stale work after a storage failure and accepts work after recovery", async () => {
    const queue = new OnboardingMutationQueue();
    const storageError = new Error("storage unavailable");
    const failed = queue.enqueue(() => {
      try {
        throw storageError;
      } catch {
        queue.pause();
        return Promise.reject(storageError);
      }
    });
    const staleBack = queue.enqueue(() => Promise.resolve("stale-back"));

    await expect(failed).rejects.toBe(storageError);
    await expect(staleBack).resolves.toBeNull();

    queue.resume();
    await expect(queue.enqueue(() => Promise.resolve("retry"))).resolves.toBe("retry");
  });

  it("does not swallow programming errors and keeps later mutations usable", async () => {
    const queue = new OnboardingMutationQueue();
    const programmingError = new Error("unexpected bug");

    await expect(queue.enqueue(() => Promise.reject(programmingError))).rejects.toBe(
      programmingError,
    );
    await expect(queue.enqueue(() => Promise.resolve("next mutation"))).resolves.toBe(
      "next mutation",
    );
  });
});
