import { describe, expect, it } from "vitest";
import { aurumNordicBrandSystem } from "@/domain/design-system";
import { normalizeBrief } from "@/domain/design-brief";
import { validateRegisteredSnapshot, veskifyComponentRegistry } from "@/components/registry";
import {
  createInitialPageId,
  createInitialSectionId,
  materializeInitialStorefront,
  planStorefrontTemplateSelection,
  validateInitialStorefrontGenerationPlan,
} from "@/application/storefront-templates";

const createdAt = "2026-07-18T12:00:00.000Z";

function brief(overrides: Record<string, unknown> = {}) {
  return normalizeBrief({
    id: "brief_materializer_test",
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: "Northern Light Studio",
      shortDescription: "Jewellery with a quiet northern character.",
      industry: "jewellery",
      targetCustomer: "Thoughtful gift shoppers",
      primaryMarket: "Finland",
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en"], primaryLanguage: "en" },
    catalogueContext: "controlled-demo-catalogue",
    ...overrides,
  });
}

function input(templateId: string, briefInput = brief()) {
  const selection = planStorefrontTemplateSelection({
    brief: briefInput,
    preferredTemplateId: templateId,
  });
  return {
    brief: briefInput,
    templateSelectionPlan: selection,
    brandSystem: aurumNordicBrandSystem,
    projectId: "project_materializer_test",
    snapshotId: "snapshot_materializer_test",
    catalogueRef: "catalogue_controlled_demo",
    createdAt,
  };
}

function preTask6Selection(input: ReturnType<typeof planStorefrontTemplateSelection>) {
  return {
    ...structuredClone(input),
    schemaVersion: 2 as const,
    resolvedPagePlans: input.resolvedPagePlans.map(({ pageType, slots }) => ({
      pageType,
      slots: slots.map(
        ({
          id,
          required,
          sectionType,
          allowedVariants,
          defaultVariant,
          label,
          purpose,
          omitWhen,
        }) => ({
          id,
          required,
          sectionType,
          allowedVariants,
          defaultVariant,
          label,
          purpose,
          omitWhen,
        }),
      ),
    })),
  };
}

describe("deterministic initial storefront materializer", () => {
  it.each([
    "template_brand_led_editorial",
    "template_balanced_commerce",
    "template_catalogue_forward_commerce",
  ])("materializes the complete initial slice for %s", (templateId) => {
    const result = materializeInitialStorefront(input(templateId));
    expect(result.status).toBe("ready-with-warnings");
    expect(result.generatedSnapshot?.pages.map((page) => page.type)).toEqual([
      "home",
      "collection",
      "product",
    ]);
    expect(result.generatedSnapshot?.revision).toBe(0);
    expect(result.generatedSnapshot?.createdBy).toBe("agent");
    expect(result.generatedSnapshot?.createdAt).toBe(createdAt);
  });

  it("preserves exact resolved slot order and required sections", () => {
    const materialized = materializeInitialStorefront(input("template_balanced_commerce"));
    const selection = input("template_balanced_commerce").templateSelectionPlan;
    expect(
      materialized.generatedSnapshot?.pages.map((page) =>
        page.sections.map((section) => section.component),
      ),
    ).toEqual(
      selection.resolvedPagePlans.map((plan) =>
        plan.slots
          .filter(
            (slot) =>
              slot.omitWhen !== "when-not-requested" &&
              slot.omitWhen !== "when-imagery-is-unavailable",
          )
          .map((slot) => slot.sectionType),
      ),
    );
    selection.resolvedPagePlans.forEach((plan) => {
      const page = materialized.generatedSnapshot?.pages.find(
        (candidate) => candidate.type === plan.pageType,
      );
      plan.slots
        .filter((slot) => slot.required)
        .forEach((slot) => {
          expect(page?.sections.some((section) => section.component === slot.sectionType)).toBe(
            true,
          );
        });
    });
  });

  it("records an explicit empty-catalogue omission outcome without claiming commerce profiles", () => {
    const result = materializeInitialStorefront(
      input("template_brand_led_editorial", brief({ catalogueContext: "empty-catalogue" })),
    );
    expect(result.status).toBe("ready-with-warnings");
    expect(result.generatedSnapshot).toBeDefined();
    expect(result.provenance.profileMaterializations).toEqual([]);
    expect(result.provenance.omissions.some((entry) => entry.pageType === "collection")).toBe(true);
    expect(result.provenance.omissions.some((entry) => entry.pageType === "product")).toBe(true);
  });

  it("validates every generated section through the component registry", () => {
    const result = materializeInitialStorefront(input("template_catalogue_forward_commerce"));
    expect(result.generatedSnapshot).toBeDefined();
    expect(() => validateRegisteredSnapshot(result.generatedSnapshot!)).not.toThrow();
    result.generatedSnapshot?.pages.forEach((page) =>
      page.sections.forEach((section) =>
        expect(
          veskifyComponentRegistry[section.component as keyof typeof veskifyComponentRegistry],
        ).toBeDefined(),
      ),
    );
  });

  it("blocks a blocked selection and mismatched brief without creating a snapshot", () => {
    const blockedBrief = brief({ id: "brief_blocked", catalogueContext: null });
    const blockedSelection = planStorefrontTemplateSelection({ brief: blockedBrief });
    const blocked = materializeInitialStorefront({
      ...input("template_balanced_commerce"),
      brief: blockedBrief,
      templateSelectionPlan: blockedSelection,
    });
    expect(blocked.status).toBe("blocked");
    expect(blocked.generatedSnapshot).toBeNull();

    const mismatch = materializeInitialStorefront({
      ...input("template_balanced_commerce"),
      brief: brief({ id: "brief_other" }),
    });
    expect(mismatch.status).toBe("blocked");
    expect(mismatch.blockers.map((blocker) => blocker.code)).toContain("brief-id-mismatch");
  });

  it.each([
    ["industry", { businessIdentity: { industry: "fashion" } }],
    ["pages", { storefrontStructure: { pageTypes: ["home", "collection", "product", "about"] } }],
    ["catalogue", { catalogueContext: "existing-vesko-catalogue" }],
    ["preferences", { generationPreferences: { visualDensity: "airy" } }],
    ["assets", { brandDirection: { supportingImageAssetRefs: [{ id: "asset_supporting" }] } }],
  ])("blocks a stale selection when %s changes", (_label, overrides) => {
    const original = brief();
    const selection = planStorefrontTemplateSelection({
      brief: original,
      preferredTemplateId: "template_balanced_commerce",
    });
    const current = brief(overrides);
    const result = materializeInitialStorefront({
      ...input("template_balanced_commerce", original),
      brief: current,
      templateSelectionPlan: selection,
    });
    expect(result.status).toBe("blocked");
    expect(result.generatedSnapshot).toBeNull();
    expect(result.blockers.map((blocker) => blocker.code)).toContain("stale-template-selection");
  });

  it("allows copy-only brief changes and uses the current copy", () => {
    const original = brief();
    const selection = planStorefrontTemplateSelection({
      brief: original,
      preferredTemplateId: "template_balanced_commerce",
    });
    const current = brief({
      businessIdentity: {
        businessName: "Updated Studio",
        shortDescription: "A refreshed description.",
        industry: "jewellery",
      },
    });
    const result = materializeInitialStorefront({
      ...input("template_balanced_commerce", original),
      brief: current,
      templateSelectionPlan: selection,
    });
    expect(result.status).toBe("ready-with-warnings");
    expect(result.generatedSnapshot).not.toBeNull();
    expect(result.generatedSnapshot?.pages[0].sections[1]?.component).toBe("homepageHero");
  });

  it("blocks missing resolved page plans and forged plan composition", () => {
    const base = input("template_balanced_commerce");
    const missingHome = structuredClone(base.templateSelectionPlan);
    missingHome.resolvedPagePlans = missingHome.resolvedPagePlans.filter(
      (plan) => plan.pageType !== "home",
    );
    const missing = materializeInitialStorefront({ ...base, templateSelectionPlan: missingHome });
    expect(missing.status).toBe("blocked");
    expect(missing.blockers.map((blocker) => blocker.code)).toContain("missing-home-plan");

    const forged = structuredClone(base.templateSelectionPlan);
    forged.resolvedPagePlans[0].slots = forged.resolvedPagePlans[0].slots.slice(1);
    const result = materializeInitialStorefront({ ...base, templateSelectionPlan: forged });
    expect(result.status).toBe("blocked");
    expect(result.blockers.map((blocker) => blocker.code)).toContain("inconsistent-home-plan");

    const unsupportedVariant = structuredClone(base.templateSelectionPlan);
    unsupportedVariant.resolvedPagePlans[0].slots[0].allowedVariants = ["unsupported"];
    unsupportedVariant.resolvedPagePlans[0].slots[0].defaultVariant = "unsupported";
    const unsupported = materializeInitialStorefront({
      ...base,
      templateSelectionPlan: unsupportedVariant,
    });
    expect(unsupported.status).toBe("blocked");
    expect(unsupported.blockers.map((blocker) => blocker.code)).toContain("inconsistent-home-plan");
  });

  it("materializes a verified pre-Task-6 plan without changing protected execution state", () => {
    const current = input("template_balanced_commerce");
    const legacy = materializeInitialStorefront({
      ...current,
      templateSelectionPlan: preTask6Selection(current.templateSelectionPlan),
    });
    const modern = materializeInitialStorefront(current);
    expect(legacy.status).toBe("ready-with-warnings");
    expect(legacy.generatedSnapshot).toEqual(modern.generatedSnapshot);
    expect(legacy.generatedSnapshot?.catalogueRef).toBe(current.catalogueRef);
    expect(legacy.generatedSnapshot?.navigation).toEqual(modern.generatedSnapshot?.navigation);
  });

  it("keeps controlled content in the primary locale without inventing translation", () => {
    const fiBrief = brief({
      languagePlan: { selectedLanguages: ["fi"], primaryLanguage: "fi" },
      businessIdentity: {
        businessName: "Pohjoinen Studio",
        shortDescription: "Suomalainen korustudio.",
        industry: "jewellery",
      },
    });
    const result = materializeInitialStorefront(input("template_balanced_commerce", fiBrief));
    const hero = result.generatedSnapshot?.pages
      .find((page) => page.type === "home")
      ?.sections.find((section) => section.component === "homepageHero");
    expect(hero).toBeDefined();
  });

  it("supports EN/FI controlled navigation and explicit deterministic IDs", () => {
    const result = materializeInitialStorefront(input("template_balanced_commerce"));
    const snapshot = result.generatedSnapshot!;
    expect(snapshot.navigation.primary).toEqual([
      {
        id: "nav_home",
        label: { en: "Home", fi: "Etusivu" },
        target: { type: "page", pageId: createInitialPageId("project_materializer_test", "home") },
      },
      {
        id: "nav_shop",
        label: { en: "Shop", fi: "Kauppa" },
        target: {
          type: "page",
          pageId: createInitialPageId("project_materializer_test", "collection"),
        },
      },
    ]);
    expect(
      snapshot.navigation.primary.every((item) => {
        if (item.target.type !== "page") return false;
        const pageId = item.target.pageId;
        return snapshot.pages.some((page) => page.id === pageId);
      }),
    ).toBe(true);
    expect(createInitialSectionId(snapshot.pages[0].id, "header")).toMatch(/^section_[a-f0-9]{8}$/);
  });

  it("preserves the supplied BrandSystem, catalogueRef, and all inputs", () => {
    const materializationInput = input("template_balanced_commerce");
    const before = structuredClone(materializationInput);
    const result = materializeInitialStorefront(materializationInput);
    expect(result.generatedSnapshot?.brandSystem).toEqual(aurumNordicBrandSystem);
    expect(result.generatedSnapshot?.catalogueRef).toBe("catalogue_controlled_demo");
    expect(materializationInput).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(validateInitialStorefrontGenerationPlan(result)).toEqual(result);
    const clone = structuredClone(result);
    clone.generatedSnapshot!.pages[0].title.en = "Changed";
    expect(result.generatedSnapshot!.pages[0].title.en).not.toBe("Changed");
  });

  it("keeps page, section, and generation IDs stable for identical inputs", () => {
    const materializationInput = input("template_balanced_commerce");
    const first = materializeInitialStorefront(materializationInput);
    const second = materializeInitialStorefront(materializationInput);
    expect(first.id).toBe(second.id);
    expect(first.generatedPageIds).toEqual(second.generatedPageIds);
    expect(
      first.generatedSnapshot?.pages.flatMap((page) => page.sections.map((section) => section.id)),
    ).toEqual(
      second.generatedSnapshot?.pages.flatMap((page) => page.sections.map((section) => section.id)),
    );
  });

  it("fails invalid BrandSystem input safely", () => {
    expect(() =>
      materializeInitialStorefront({
        ...input("template_balanced_commerce"),
        brandSystem: { colors: {} } as never,
      }),
    ).toThrow(/input is invalid/i);
  });
});
