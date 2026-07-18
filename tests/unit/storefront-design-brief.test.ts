import { describe, expect, it } from "vitest";
import {
  STOREFRONT_DESIGN_BRIEF_SCHEMA_VERSION,
  StorefrontDesignBriefLifecycleError,
  StorefrontDesignBriefValidationError,
  cloneStorefrontDesignBrief,
  createEmptyStorefrontDesignBrief,
  evaluateStorefrontDesignBriefReadiness,
  normalizeStorefrontDesignBriefInput,
  storefrontDesignBriefSchema,
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
      toneKeywords: ["warm", "considered"],
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

  it("supports all three catalogue contexts without storing catalogue records", () => {
    const brief = readyBrief();
    for (const context of [
      "existing-vesko-catalogue",
      "controlled-demo-catalogue",
      "empty-catalogue",
    ] as const) {
      expect(
        updateStorefrontDesignBriefArea(brief, "catalogueContext", context).catalogueContext,
      ).toBe(context);
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

  it("normalizes merchant text, duplicate languages and supported catalogue aliases", () => {
    const brief = normalizeStorefrontDesignBriefInput({
      ...readyBrief(),
      businessIdentity: {
        ...readyBrief().businessIdentity,
        businessName: "  Aurum Nordic  ",
        secondaryMarkets: [" Sweden ", "sweden", " Denmark "],
      },
      languagePlan: { selectedLanguages: ["en", "en", "fi"], primaryLanguage: "en" },
      catalogueContext: "empty" as never,
    });

    expect(brief.businessIdentity.businessName).toBe("Aurum Nordic");
    expect(brief.businessIdentity.secondaryMarkets).toEqual(["Sweden", "Denmark"]);
    expect(brief.languagePlan.selectedLanguages).toEqual(["en", "fi"]);
    expect(brief.catalogueContext).toBe("empty-catalogue");
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
