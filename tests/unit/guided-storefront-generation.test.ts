import { describe, expect, it } from "vitest";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";
import { canonicalValueString, storefrontSnapshotSchema } from "@/domain/storefront";
import { validateRegisteredSnapshot } from "@/components/registry";
import {
  cloneGuidedStorefrontGenerationPlan,
  generateGuidedStorefront,
  validateGuidedStorefrontGenerationPlan,
  type GuidedStorefrontGenerationInput,
  GuidedStorefrontGenerationError,
} from "@/application/guided-storefront-generation";
import { planBrandFoundation } from "@/application/brand-foundation";

const createdAt = "2026-07-18T13:00:00.000Z";

function brief(overrides: Record<string, unknown> = {}) {
  return normalizeStorefrontDesignBriefInput({
    id: "brief_guided_generation_test",
    createdAt,
    updatedAt: createdAt,
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: "Northern Light Studio",
      shortDescription: "Quietly considered jewellery.",
      industry: "jewellery",
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    catalogueContext: "controlled-demo-catalogue",
    ...overrides,
  });
}

function input(
  overrides: Partial<GuidedStorefrontGenerationInput> = {},
): GuidedStorefrontGenerationInput {
  return {
    brief: brief(),
    projectId: "project_guided_generation_test",
    snapshotId: "snapshot_guided_generation_test",
    catalogueRef: "catalogue_controlled_demo",
    createdAt,
    ...overrides,
  };
}

describe("guided storefront generation orchestrator", () => {
  it("executes brand, template, and materialization in order", () => {
    const result = generateGuidedStorefront(input());
    expect(result.status).toBe("ready-with-warnings");
    expect(result.brandFoundationPlan.briefId).toBe(result.briefId);
    expect(result.templateSelectionPlan?.briefFingerprint).toMatch(/^brief-selection-v1_/);
    expect(result.initialStorefrontGenerationPlan?.templateSelectionPlanId).toBe(
      result.templateSelectionPlan?.id,
    );
    expect(result.generatedSnapshot).toEqual(
      result.initialStorefrontGenerationPlan?.generatedSnapshot,
    );
    expect(result.stageDiagnostics.map((stage) => [stage.stage, stage.status])).toEqual([
      ["brand-foundation", "executed"],
      ["template-selection", "executed"],
      ["storefront-materialization", "executed"],
    ]);
    expect(() => storefrontSnapshotSchema.parse(result.generatedSnapshot)).not.toThrow();
    expect(() => validateRegisteredSnapshot(result.generatedSnapshot!)).not.toThrow();
  });

  it("preserves empty-catalogue warnings and high-contrast brand warnings", () => {
    const result = generateGuidedStorefront(
      input({
        brief: brief({
          catalogueContext: "empty-catalogue",
          brandDirection: { preferredBrandColours: ["#ffffff"] },
          generationPreferences: { accessibilityPreference: "high-contrast" },
        }),
      }),
    );
    expect(result.status).toBe("ready-with-warnings");
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "EMPTY_CATALOGUE_MERCHANDISING"),
    ).toBe(true);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "preferred-colour-low-contrast"),
    ).toBe(true);
    expect(result.diagnostics.every((diagnostic) => diagnostic.stage)).toBe(true);
  });

  it.each([
    [
      "editorial",
      {
        brandDirection: { visualStyleDirection: "editorial", toneKeywords: ["story"] },
        generationPreferences: { contentEmphasis: "storytelling", visualDensity: "airy" },
      },
      "template_brand_led_editorial",
    ],
    [
      "catalogue-forward",
      {
        catalogueContext: "existing-vesko-catalogue",
        generationPreferences: { merchandisingEmphasis: "high", sectionRichness: "rich" },
      },
      "template_catalogue_forward_commerce",
    ],
  ])("supports the %s recommendation", (_label, overrides, templateId) => {
    const result = generateGuidedStorefront(input({ brief: brief(overrides) }));
    expect(result.templateSelectionPlan?.selectedTemplateId).toBe(templateId);
  });

  it("passes a valid merchant template override through P3-06", () => {
    const result = generateGuidedStorefront(
      input({ preferredTemplateId: "template_brand_led_editorial" }),
    );
    expect(result.templateSelectionPlan?.selectionSource).toBe("merchant-override");
    expect(result.templateSelectionPlan?.selectedTemplateId).toBe("template_brand_led_editorial");
  });

  it("blocks unknown overrides before materialization", () => {
    const result = generateGuidedStorefront(input({ preferredTemplateId: "template_unknown" }));
    expect(result.status).toBe("blocked");
    expect(result.generatedSnapshot).toBeNull();
    expect(result.initialStorefrontGenerationPlan).toBeNull();
    expect(result.templateSelectionPlan?.blockers.map((item) => item.code)).toContain(
      "unknown-template-override",
    );
    expect(result.stageDiagnostics[2].status).toBe("not-run");
  });

  it("blocks incomplete selection-critical briefs without materialization", () => {
    const result = generateGuidedStorefront(input({ brief: brief({ catalogueContext: null }) }));
    expect(result.status).toBe("blocked");
    expect(result.generatedSnapshot).toBeNull();
    expect(result.stageDiagnostics[1].status).toBe("executed");
    expect(result.stageDiagnostics[2].status).toBe("not-run");
  });

  it("is deterministic, immutable, and preserves explicit identifiers", () => {
    const first = generateGuidedStorefront(input());
    const second = generateGuidedStorefront(input());
    expect(first).toEqual(second);
    expect(first.id).toBe(second.id);
    expect(first.createdAt).toBe(createdAt);
    expect(Object.isFrozen(first)).toBe(true);
    const clone = structuredClone(first);
    clone.assumptions.push("changed");
    expect(first.assumptions).not.toContain("changed");
    expect(canonicalValueString(first.brandFoundationPlan.brandSystem)).toBe(
      canonicalValueString(planBrandFoundation(brief()).brandSystem),
    );
    expect(validateGuidedStorefrontGenerationPlan(first)).toEqual(first);
    expect(cloneGuidedStorefrontGenerationPlan(first)).toEqual(first);
  });

  it("does not mutate the input brief or its outputs", () => {
    const original = brief();
    const before = structuredClone(original);
    const result = generateGuidedStorefront(input({ brief: original }));
    expect(original).toEqual(before);
    const later = generateGuidedStorefront(input({ brief: original }));
    expect(later).toEqual(result);
  });

  it("throws a typed error for invalid input and does not disguise programming errors", () => {
    expect(() => generateGuidedStorefront({ brief: {} } as never)).toThrow(
      GuidedStorefrontGenerationError,
    );
    expect(() =>
      generateGuidedStorefront({
        ...input(),
        brief: { ...input().brief, schemaVersion: 99 },
      } as never),
    ).toThrow(GuidedStorefrontGenerationError);
  });
});
