import { describe, expect, it } from "vitest";
import {
  STOREFRONT_DESIGN_BRIEF_SCHEMA_VERSION,
  StorefrontDesignBriefLifecycleError,
  StorefrontDesignBriefValidationError,
  cloneStorefrontDesignBrief,
  createEmptyStorefrontDesignBrief,
  evaluateStorefrontDesignBriefReadiness,
  imageryDirectionValues,
  normalizeStorefrontDesignBriefInput,
  storefrontDesignBriefSchema,
  toneKeywordValues,
  typographyDirectionValues,
  updateStorefrontDesignBriefArea,
  validateStorefrontDesignBrief,
} from "@/domain/design-brief";

const now = "2026-07-18T10:00:00.000Z";

function readyBrief() {
  return normalizeStorefrontDesignBriefInput({
    id: "brief_aurum",
    schemaVersion: STOREFRONT_DESIGN_BRIEF_SCHEMA_VERSION,
    status: "collecting",
    createdAt: now,
    updatedAt: now,
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: "Aurum Nordic",
      shortDescription: "A Helsinki jewellery studio.",
      industry: "jewellery",
      targetCustomer: "Customers looking for lasting Nordic jewellery.",
      primaryMarket: "Finland",
    },
    brandDirection: {
      preferredBrandColours: ["#8A5A2B"],
      typographyDirection: "mixed",
      visualStyleDirection: "editorial",
      imageryDirection: "studio",
      toneKeywords: ["warm", "elegant"],
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    catalogueContext: "controlled-demo-catalogue",
  });
}

describe("StorefrontDesignBrief", () => {
  it("creates a valid empty collecting brief with safe defaults", () => {
    const brief = createEmptyStorefrontDesignBrief({ id: "brief_empty", now });

    expect(brief).toMatchObject({
      id: "brief_empty",
      schemaVersion: 1,
      status: "collecting",
      creationContext: { type: null, existingStorefrontUrl: null },
      storefrontStructure: { pageTypes: [] },
      languagePlan: { selectedLanguages: [], primaryLanguage: null },
      catalogueContext: null,
      generationPreferences: {
        visualDensity: "balanced",
        accessibilityPreference: "standard",
      },
    });
    expect(() => storefrontDesignBriefSchema.parse(brief)).not.toThrow();
  });

  it("requires the supported schema version", () => {
    const brief = readyBrief();
    expect(() => validateStorefrontDesignBrief({ ...brief, schemaVersion: 2 })).toThrow(
      StorefrontDesignBriefValidationError,
    );
  });

  it("uses the exact SDD 8.3 guided-choice values", () => {
    expect(toneKeywordValues).toEqual([
      "elegant",
      "modern",
      "warm",
      "bold",
      "minimal",
      "playful",
      "technical",
    ]);
    expect(imageryDirectionValues).toEqual([
      "studio",
      "lifestyle",
      "editorial",
      "product-focused",
      "mixed",
    ]);
    expect(typographyDirectionValues).toEqual(["serif-led", "sans-led", "mixed", "strong", "soft"]);
    for (const toneKeyword of toneKeywordValues) {
      expect(
        normalizeStorefrontDesignBriefInput({ brandDirection: { toneKeywords: [toneKeyword] } })
          .brandDirection.toneKeywords,
      ).toEqual([toneKeyword]);
    }
    for (const imageryDirection of imageryDirectionValues) {
      expect(
        normalizeStorefrontDesignBriefInput({ brandDirection: { imageryDirection } }).brandDirection
          .imageryDirection,
      ).toBe(imageryDirection);
    }
    for (const typographyDirection of typographyDirectionValues) {
      expect(
        normalizeStorefrontDesignBriefInput({ brandDirection: { typographyDirection } })
          .brandDirection.typographyDirection,
      ).toBe(typographyDirection);
    }
    for (const merchandisingEmphasis of ["subtle", "balanced", "campaign-led"] as const) {
      expect(
        normalizeStorefrontDesignBriefInput({
          generationPreferences: { merchandisingEmphasis },
        }).generationPreferences.merchandisingEmphasis,
      ).toBe(merchandisingEmphasis);
    }
  });

  const obsoleteGuidedChoiceValues: ReadonlyArray<readonly [string, unknown]> = [
    ["typography", { brandDirection: { typographyDirection: "system" } }],
    ["typography", { brandDirection: { typographyDirection: "serif" } }],
    ["typography", { brandDirection: { typographyDirection: "sans" } }],
    ["promotion", { generationPreferences: { merchandisingEmphasis: "low" } }],
    ["promotion", { generationPreferences: { merchandisingEmphasis: "high" } }],
    ...[
      "calm",
      "friendly",
      "formal",
      "premium",
      "accessible",
      "direct",
      "inspiring",
      "concise",
      "storytelling",
      "natural",
    ].map((toneKeyword) => ["tone", { brandDirection: { toneKeywords: [toneKeyword] } }] as const),
  ];

  it.each(obsoleteGuidedChoiceValues)(
    "rejects obsolete %s values instead of retaining hidden aliases",
    (_kind, input) => {
      expect(() => normalizeStorefrontDesignBriefInput(input as never)).toThrow(
        StorefrontDesignBriefValidationError,
      );
    },
  );

  it("validates new-storefront and redesign contexts without crawling the URL", () => {
    expect(readyBrief().creationContext).toEqual({
      type: "new-storefront",
      existingStorefrontUrl: null,
    });

    const redesign = updateStorefrontDesignBriefArea(
      readyBrief(),
      "creationContext",
      { type: "redesign-existing-storefront", existingStorefrontUrl: "https://shop.example.test" },
      "2026-07-18T10:01:00.000Z",
    );
    expect(redesign.creationContext.existingStorefrontUrl).toBe("https://shop.example.test");
  });

  it("rejects a redesign with an invalid URL and reports a typed error", () => {
    expect(() =>
      normalizeStorefrontDesignBriefInput({
        creationContext: {
          type: "redesign-existing-storefront",
          existingStorefrontUrl: "http://shop.example.test",
        },
      }),
    ).toThrow(StorefrontDesignBriefValidationError);
  });

  it("represents the demo storefront context", () => {
    const brief = updateStorefrontDesignBriefArea(
      createEmptyStorefrontDesignBrief({ id: "brief_demo", now }),
      "creationContext",
      { type: "demo-storefront" },
      "2026-07-18T10:01:00.000Z",
    );
    expect(brief.creationContext.type).toBe("demo-storefront");
  });

  it("reports business identity blockers", () => {
    const result = evaluateStorefrontDesignBriefReadiness(
      updateStorefrontDesignBriefArea(
        createEmptyStorefrontDesignBrief({ id: "brief_identity", now }),
        "creationContext",
        { type: "new-storefront" },
        "2026-07-18T10:01:00.000Z",
      ),
    );

    expect(result.ready).toBe(false);
    expect(result.blockingIssues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "missing-business-name",
        "missing-business-description",
        "missing-industry",
        "missing-target-customer",
        "missing-primary-market",
      ]),
    );
  });

  it("requires a homepage and rejects duplicate page types", () => {
    const brief = readyBrief();
    expect(() =>
      updateStorefrontDesignBriefArea(brief, "storefrontStructure", {
        pageTypes: ["collection", "product"],
      }),
    ).toThrow(/homepage is required/i);
    expect(() =>
      updateStorefrontDesignBriefArea(brief, "storefrontStructure", {
        pageTypes: ["home", "collection", "collection"],
      }),
    ).toThrow(/unique/i);
  });

  it.each([
    ["home only", ["home"]],
    ["home plus collection", ["home", "collection"]],
    ["home plus product", ["home", "product"]],
  ] as const)("keeps %s collecting and blocks its missing core page", (_label, pageTypes) => {
    const brief = updateStorefrontDesignBriefArea(readyBrief(), "storefrontStructure", {
      pageTypes: [...pageTypes],
    });
    const result = evaluateStorefrontDesignBriefReadiness(brief);

    expect(brief.status).toBe("collecting");
    expect(result.ready).toBe(false);
    expect(result.blockingIssues).toEqual(
      expect.arrayContaining([expect.objectContaining({ area: "storefrontStructure" })]),
    );
  });

  it("requires stable blockers for every missing core page", () => {
    const result = evaluateStorefrontDesignBriefReadiness(
      updateStorefrontDesignBriefArea(readyBrief(), "storefrontStructure", { pageTypes: [] }),
    );

    expect(result.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-homepage",
          area: "storefrontStructure",
        }),
        expect.objectContaining({
          code: "missing-collection-page",
          area: "storefrontStructure",
        }),
        expect.objectContaining({ code: "missing-product-page", area: "storefrontStructure" }),
      ]),
    );
  });

  it("is structurally ready only with the homepage, collection and product pages", () => {
    const result = evaluateStorefrontDesignBriefReadiness(readyBrief());

    expect(result.ready).toBe(true);
    expect(result.blockingIssues).toHaveLength(0);
    expect(result.completedAreas).toContain("storefrontStructure");
  });

  it("does not allow ready or consumed briefs to omit a core page", () => {
    const partial = updateStorefrontDesignBriefArea(readyBrief(), "storefrontStructure", {
      pageTypes: ["home"],
    });

    for (const status of ["ready", "consumed"] as const) {
      try {
        validateStorefrontDesignBrief({ ...partial, status });
        throw new Error("Expected the lifecycle validation to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(StorefrontDesignBriefValidationError);
        expect((error as StorefrontDesignBriefValidationError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ code: "missing-collection-page" }),
            expect.objectContaining({ code: "missing-product-page" }),
          ]),
        );
      }
    }
  });

  it("supports EN, FI and EN/FI plans while rejecting an invalid primary language", () => {
    const brief = readyBrief();
    expect(
      updateStorefrontDesignBriefArea(brief, "languagePlan", {
        selectedLanguages: ["en"],
        primaryLanguage: "en",
      }).languagePlan,
    ).toEqual({ selectedLanguages: ["en"], primaryLanguage: "en" });
    expect(
      updateStorefrontDesignBriefArea(brief, "languagePlan", {
        selectedLanguages: ["fi"],
        primaryLanguage: "fi",
      }).languagePlan,
    ).toEqual({ selectedLanguages: ["fi"], primaryLanguage: "fi" });
    expect(
      updateStorefrontDesignBriefArea(brief, "languagePlan", {
        selectedLanguages: ["en", "fi"],
        primaryLanguage: "fi",
      }).languagePlan,
    ).toEqual({ selectedLanguages: ["en", "fi"], primaryLanguage: "fi" });
    expect(() =>
      updateStorefrontDesignBriefArea(brief, "languagePlan", {
        selectedLanguages: ["en"],
        primaryLanguage: "fi",
      }),
    ).toThrow(/primary language must be selected/i);

    const invalidPrimary = {
      ...brief,
      languagePlan: { selectedLanguages: ["en"], primaryLanguage: "fi" },
    };
    expect(evaluateStorefrontDesignBriefReadiness(invalidPrimary).blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-primary-language", area: "languagePlan" }),
      ]),
    );
  });

  it("keeps catalogue context design-only and warns only for an empty catalogue", () => {
    const brief = readyBrief();
    for (const context of [
      "existing-vesko-catalogue",
      "controlled-demo-catalogue",
      "empty-catalogue",
    ] as const) {
      const updated = updateStorefrontDesignBriefArea(brief, "catalogueContext", context);
      const result = evaluateStorefrontDesignBriefReadiness(updated);

      expect(updated.catalogueContext).toBe(context);
      expect(Object.keys(updated)).not.toContain("products");
      expect(Object.keys(updated)).not.toContain("catalogue");
      if (context === "empty-catalogue") {
        expect(result.ready).toBe(true);
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "sample-catalogue-required",
              area: "catalogueContext",
            }),
          ]),
        );
      } else {
        expect(result.warnings.map(({ code }) => code)).not.toContain("sample-catalogue-required");
      }
    }
  });

  it("blocks generation until required areas are complete and warns without a logo", () => {
    const incomplete = readyBrief();
    const result = evaluateStorefrontDesignBriefReadiness(incomplete);
    expect(result.ready).toBe(true);
    expect(result.blockingIssues).toHaveLength(0);
    expect(result.warnings.map(({ code }) => code)).toContain("missing-logo");

    const redesign = updateStorefrontDesignBriefArea(incomplete, "creationContext", {
      type: "redesign-existing-storefront",
      existingStorefrontUrl: null,
    });
    const redesignReadiness = evaluateStorefrontDesignBriefReadiness(redesign);
    expect(redesignReadiness.ready).toBe(false);
    expect(redesignReadiness.blockingIssues.map(({ code }) => code)).toContain(
      "missing-redesign-url",
    );
  });

  it("does not partially mutate the original when updating one area", () => {
    const brief = readyBrief();
    const before = structuredClone(brief);
    const updated = updateStorefrontDesignBriefArea(brief, "businessIdentity", {
      businessName: "Updated Nordic",
    });

    expect(brief).toEqual(before);
    expect(updated.businessIdentity.businessName).toBe("Updated Nordic");
    expect(updated.brandDirection).toEqual(brief.brandDirection);
    expect(updated.updatedAt).not.toBe(brief.updatedAt);

    const later = updateStorefrontDesignBriefArea(updated, "businessIdentity", {}, now);
    expect(Date.parse(later.updatedAt)).toBeGreaterThan(Date.parse(updated.updatedAt));
  });

  it("clones independently and rejects edits to consumed briefs", () => {
    const brief = readyBrief();
    const clone = cloneStorefrontDesignBrief(brief);
    clone.businessIdentity.businessName = "Cloned Nordic";
    expect(brief.businessIdentity.businessName).toBe("Aurum Nordic");

    const consumed = validateStorefrontDesignBrief({ ...brief, status: "consumed" });
    expect(() => updateStorefrontDesignBriefArea(consumed, "businessIdentity", {})).toThrow(
      StorefrontDesignBriefLifecycleError,
    );
  });

  it("normalizes merchant text and duplicate languages without catalogue aliases", () => {
    const brief = normalizeStorefrontDesignBriefInput({
      ...readyBrief(),
      businessIdentity: {
        ...readyBrief().businessIdentity,
        businessName: "  Aurum Nordic  ",
        secondaryMarkets: [" Sweden ", "sweden", " Denmark "],
      },
      languagePlan: { selectedLanguages: ["en", "en", "fi"], primaryLanguage: "en" },
    });

    expect(brief.businessIdentity.businessName).toBe("Aurum Nordic");
    expect(brief.businessIdentity.secondaryMarkets).toEqual(["Sweden", "Denmark"]);
    expect(brief.languagePlan.selectedLanguages).toEqual(["en", "fi"]);
    expect(brief.catalogueContext).toBe("controlled-demo-catalogue");
    expect(() =>
      normalizeStorefrontDesignBriefInput({ ...readyBrief(), catalogueContext: "empty" as never }),
    ).toThrow(StorefrontDesignBriefValidationError);
  });

  it.each([
    ["unsupported locale before English", ["sv", "en"]],
    ["unsupported locale after English", ["en", "sv"]],
  ] as const)(
    "rejects %s instead of filtering it during normalization",
    (_label, selectedLanguages) => {
      expect(() =>
        normalizeStorefrontDesignBriefInput({
          languagePlan: { selectedLanguages, primaryLanguage: "en" },
        } as never),
      ).toThrow(StorefrontDesignBriefValidationError);
    },
  );

  it("rejects an unsupported primary language through the locale boundary", () => {
    expect(() =>
      normalizeStorefrontDesignBriefInput({
        languagePlan: { selectedLanguages: ["en"], primaryLanguage: "sv" },
      } as never),
    ).toThrow(StorefrontDesignBriefValidationError);
  });

  it("canonicalizes valid locales and preserves supported duplicate normalization", () => {
    expect(
      normalizeStorefrontDesignBriefInput({
        languagePlan: { selectedLanguages: ["fi", "en"], primaryLanguage: "fi" },
      }).languagePlan,
    ).toEqual({ selectedLanguages: ["en", "fi"], primaryLanguage: "fi" });
    expect(
      normalizeStorefrontDesignBriefInput({
        languagePlan: { selectedLanguages: ["en", "en", "fi"], primaryLanguage: "en" },
      }).languagePlan,
    ).toEqual({ selectedLanguages: ["en", "fi"], primaryLanguage: "en" });
  });

  it("never silently removes an unsupported locale from the selected list", () => {
    try {
      normalizeStorefrontDesignBriefInput({
        languagePlan: { selectedLanguages: ["sv", "en"], primaryLanguage: "en" },
      } as never);
      throw new Error("Expected unsupported locale validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(StorefrontDesignBriefValidationError);
      expect((error as StorefrontDesignBriefValidationError).issues[0]).toMatchObject({
        path: ["languagePlan", "selectedLanguages", 0],
      });
    }
  });

  it("maps unsupported values to typed validation issues rather than exposing Zod errors", () => {
    try {
      validateStorefrontDesignBrief({ ...readyBrief(), catalogueContext: "provider-prompt" });
      throw new Error("Expected validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(StorefrontDesignBriefValidationError);
      expect((error as Error).name).not.toBe("ZodError");
      expect((error as StorefrontDesignBriefValidationError).issues[0]).toMatchObject({
        path: ["catalogueContext"],
      });
    }
  });
});
