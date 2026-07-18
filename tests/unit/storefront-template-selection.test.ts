import { describe, expect, it } from "vitest";
import { normalizeBrief } from "@/domain/design-brief";
import {
  cloneStorefrontTemplateSelectionPlan,
  createStorefrontTemplateSelectionBriefFingerprint,
  evaluateStorefrontTemplateCandidates,
  getTemplatePagePlan,
  listTemplates,
  mapBriefCatalogueContext,
  planStorefrontTemplateSelection,
  validateStorefrontTemplateSelectionPlan,
} from "@/application/storefront-templates";

function brief(overrides: Record<string, unknown> = {}) {
  return normalizeBrief({
    id: "brief_selection_test",
    creationContext: { type: "new-storefront" },
    businessIdentity: { industry: "other" },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en"], primaryLanguage: "en" },
    catalogueContext: "empty-catalogue",
    ...overrides,
  });
}

describe("deterministic storefront template selection", () => {
  it("maps every brief catalogue context through the canonical boundary", () => {
    expect(mapBriefCatalogueContext("existing-vesko-catalogue")).toBe("existing");
    expect(mapBriefCatalogueContext("controlled-demo-catalogue")).toBe("demo");
    expect(mapBriefCatalogueContext("empty-catalogue")).toBe("empty");
  });

  it("evaluates all built-in candidates through the registry resolver", () => {
    const result = evaluateStorefrontTemplateCandidates(brief());
    expect(result.candidates.map((candidate) => candidate.templateId)).toEqual([
      "template_brand_led_editorial",
      "template_balanced_commerce",
      "template_catalogue_forward_commerce",
    ]);
    expect(result.candidates.every((candidate) => candidate.compatible)).toBe(true);
    expect(result.candidates.every((candidate) => candidate.reasonCodes.length >= 0)).toBe(true);
  });

  it("recommends brand-led editorial for luxury storytelling", () => {
    const result = planStorefrontTemplateSelection({
      brief: brief({
        brandDirection: {
          visualStyleDirection: "luxury",
          toneKeywords: ["craft", "story"],
        },
        generationPreferences: {
          visualDensity: "airy",
          contentEmphasis: "storytelling",
          merchandisingEmphasis: "low",
        },
      }),
    });
    expect(result.selectedTemplateId).toBe("template_brand_led_editorial");
    expect(result.explanation.en).toMatch(/storytelling/i);
  });

  it("recommends catalogue-forward commerce for discovery priorities", () => {
    const result = planStorefrontTemplateSelection({
      brief: brief({
        catalogueContext: "existing-vesko-catalogue",
        brandDirection: { toneKeywords: ["discovery", "comparison"] },
        generationPreferences: {
          visualDensity: "compact",
          merchandisingEmphasis: "high",
          sectionRichness: "rich",
        },
      }),
    });
    expect(result.selectedTemplateId).toBe("template_catalogue_forward_commerce");
    expect(result.explanation.fi).toMatch(/löytäm/i);
  });

  it("uses the balanced foundation for incomplete or mixed optional preferences", () => {
    const result = planStorefrontTemplateSelection({ brief: brief() });
    expect(result.selectedTemplateId).toBe("template_balanced_commerce");
    expect(result.status).toBe("selected-with-warnings");
  });

  it.each([
    ["storytelling", { contentEmphasis: "storytelling", visualDensity: "airy" }],
    ["merchandising", { merchandisingEmphasis: "high", sectionRichness: "rich" }],
    ["density", { visualDensity: "compact", merchandisingEmphasis: "high" }],
    ["richness", { sectionRichness: "rich", merchandisingEmphasis: "high" }],
    ["visual style", { visualDensity: "airy", contentEmphasis: "storytelling" }],
  ])("applies the %s signal deterministically", (_name, generationPreferences) => {
    const result = planStorefrontTemplateSelection({
      brief: brief({
        brandDirection: { visualStyleDirection: "editorial" },
        generationPreferences,
      }),
    });
    expect(result.candidates).toHaveLength(3);
    expect(result.selectedTemplateId).toBeDefined();
  });

  it("uses a fixed balanced-first tie break and stable plan identity", () => {
    const input = { brief: brief() };
    const first = planStorefrontTemplateSelection(input);
    const second = planStorefrontTemplateSelection(input);
    expect(first.selectedTemplateId).toBe("template_balanced_commerce");
    expect(first.id).toBe(second.id);
    expect(first).toEqual(second);
  });

  it("binds plans to a deterministic, order-normalized selection fingerprint", () => {
    const first = brief({
      brandDirection: { toneKeywords: ["Craft", "story"] },
      storefrontStructure: { pageTypes: ["product", "home", "collection"] },
    });
    const second = brief({
      brandDirection: { toneKeywords: ["story", "craft"] },
      storefrontStructure: { pageTypes: ["collection", "product", "home"] },
    });
    expect(createStorefrontTemplateSelectionBriefFingerprint(first)).toBe(
      createStorefrontTemplateSelectionBriefFingerprint(second),
    );
    expect(planStorefrontTemplateSelection({ brief: first }).briefFingerprint).toMatch(
      /^brief-selection-v1_[0-9a-f]{8}$/,
    );
  });

  it("changes the fingerprint for selection-relevant inputs but not merchant copy", () => {
    const base = brief();
    const copy = brief({
      businessIdentity: { businessName: "A new name", industry: "other" },
    });
    const changed = brief({ catalogueContext: "existing-vesko-catalogue" });
    expect(createStorefrontTemplateSelectionBriefFingerprint(base)).toBe(
      createStorefrontTemplateSelectionBriefFingerprint(copy),
    );
    expect(createStorefrontTemplateSelectionBriefFingerprint(base)).not.toBe(
      createStorefrontTemplateSelectionBriefFingerprint(changed),
    );
  });

  it("rejects the previous persisted selection schema version", () => {
    const plan = planStorefrontTemplateSelection({ brief: brief() });
    expect(() => validateStorefrontTemplateSelectionPlan({ ...plan, schemaVersion: 1 })).toThrow();
  });

  it("changes selection when a meaningful preference crosses the policy threshold", () => {
    const balanced = planStorefrontTemplateSelection({ brief: brief() });
    const catalogue = planStorefrontTemplateSelection({
      brief: brief({
        generationPreferences: { merchandisingEmphasis: "high", sectionRichness: "rich" },
        catalogueContext: "existing-vesko-catalogue",
      }),
    });
    expect(balanced.selectedTemplateId).not.toBe(catalogue.selectedTemplateId);
  });

  it("preserves the empty-catalogue resolver warning", () => {
    const result = planStorefrontTemplateSelection({ brief: brief() });
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "EMPTY_CATALOGUE_MERCHANDISING",
    );
  });

  it("resolves existing and demo catalogue contexts without changing the mapping", () => {
    const existing = planStorefrontTemplateSelection({
      brief: brief({ catalogueContext: "existing-vesko-catalogue" }),
    });
    const demo = planStorefrontTemplateSelection({
      brief: brief({ catalogueContext: "controlled-demo-catalogue" }),
    });
    expect(existing.candidates.every((candidate) => candidate.compatible)).toBe(true);
    expect(demo.warnings.map((warning) => warning.code)).toContain("DEMO_CATALOGUE_CONTENT");
  });

  it("blocks missing selection-critical brief inputs", () => {
    const cases = [
      ["creationContext", { creationContext: {} }],
      ["industry", { businessIdentity: {} }],
      ["homepage", { storefrontStructure: { pageTypes: [] } }],
      ["collection page", { storefrontStructure: { pageTypes: ["home", "product"] } }],
      ["product page", { storefrontStructure: { pageTypes: ["home", "collection"] } }],
      ["catalogue context", { catalogueContext: null }],
    ] as const;
    cases.forEach(([label, overrides]) => {
      const result = planStorefrontTemplateSelection({ brief: brief(overrides) });
      expect(result.status, label).toBe("blocked");
      expect(result.selectedTemplateId, label).toBeNull();
      expect(result.blockers.length, label).toBeGreaterThan(0);
      if (label === "catalogue context") {
        expect(result.candidates.every((candidate) => !candidate.compatible)).toBe(true);
      }
    });
  });

  it("supports a valid merchant override and does not silently fall back for an unknown one", () => {
    const override = planStorefrontTemplateSelection({
      brief: brief({
        generationPreferences: { merchandisingEmphasis: "high", sectionRichness: "rich" },
      }),
      preferredTemplateId: "template_brand_led_editorial",
    });
    expect(override.selectionSource).toBe("merchant-override");
    expect(override.selectedTemplateId).toBe("template_brand_led_editorial");
    expect(override.explanation.fi).toMatch(/valitsemasi/i);

    const unknown = planStorefrontTemplateSelection({
      brief: brief(),
      preferredTemplateId: "template_unknown",
    });
    expect(unknown.status).toBe("blocked");
    expect(unknown.selectedTemplateId).toBeNull();
    expect(unknown.blockers.map((blocker) => blocker.code)).toContain("unknown-template-override");

    const blockedOverride = planStorefrontTemplateSelection({
      brief: brief({ catalogueContext: null }),
      preferredTemplateId: "template_brand_led_editorial",
    });
    expect(blockedOverride.status).toBe("blocked");
    expect(blockedOverride.selectedTemplateId).toBeNull();
  });

  it("includes resolved plans and keeps registry, input, and result state immutable", () => {
    const input = brief({ catalogueContext: "controlled-demo-catalogue" });
    const before = structuredClone(input);
    const result = planStorefrontTemplateSelection({ brief: input });
    expect(result.resolvedPagePlans.map((plan) => plan.pageType)).toEqual([
      "home",
      "collection",
      "product",
    ]);
    expect(input).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(listTemplates()[0])).toBe(true);
    expect(getTemplatePagePlan("template_balanced_commerce", "product")).toBeDefined();
    const clone = cloneStorefrontTemplateSelectionPlan(result);
    expect(clone).not.toBe(result);
    expect(() => {
      (clone as { id: string }).id = "changed";
    }).toThrow();
    expect(validateStorefrontTemplateSelectionPlan(result)).toEqual(result);
  });
});
