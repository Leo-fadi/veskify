import { describe, expect, it } from "vitest";
import {
  boundedParameterDefinitions,
  narrativeRoleIds,
  resolveBoundedParameterInheritance,
} from "@/domain/component-platform";
import {
  getTemplateById,
  validateNarrativeComposition,
  type NarrativeCompositionSection,
} from "@/application/storefront-templates";
import {
  dynamicCollectionCommerceDefinition,
  dynamicProductDetailDefinition,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";

function requiredPlan(templateId: string, pageType: "home" | "collection" | "product") {
  const plan = getTemplateById(templateId)?.pagePlans.find(
    (candidate) => candidate.pageType === pageType,
  );
  if (!plan) throw new Error(`Missing ${pageType} plan for ${templateId}.`);
  return structuredClone(plan);
}

function sectionsFor(plan: ReturnType<typeof requiredPlan>): NarrativeCompositionSection[] {
  return plan.slots.map((slot) => ({
    id: slot.id,
    component: slot.sectionType,
    variant: slot.defaultVariant,
    narrativeRole: slot.narrativeRole,
    visualWeight: slot.visualWeight,
    transitionIntent: slot.transitionIntent,
  }));
}

function validate(
  pageType: "home" | "collection" | "product",
  sections: readonly NarrativeCompositionSection[],
  plan = requiredPlan("template_brand_led_editorial", pageType),
) {
  return validateNarrativeComposition({
    pageType,
    blueprintProfileId: "template_brand_led_editorial",
    pageBlueprint: plan,
    components: veskifyComponentDefinitionsV2,
    sections,
  });
}

describe("P10A Task 6 design vocabulary and narrative contracts", () => {
  it("registers the complete controlled narrative-role vocabulary", () => {
    expect(narrativeRoleIds).toEqual([
      "orientation",
      "primary-discovery",
      "secondary-discovery",
      "product-focus",
      "product-proof",
      "brand-story",
      "brand-proof",
      "education",
      "campaign",
      "trust",
      "service",
      "conversion",
      "continuation",
    ]);
  });

  it.each(["home", "collection", "product"] as const)(
    "validates the registered %s PageBlueprint narrative flow",
    (pageType) => {
      const plan = requiredPlan("template_brand_led_editorial", pageType);
      const result = validate(pageType, sectionsFor(plan), plan);
      expect(result).toEqual({ valid: true, issues: [] });
    },
  );

  it("returns stable errors for unknown roles and transition intents", () => {
    const plan = requiredPlan("template_brand_led_editorial", "home");
    const sections = sectionsFor(plan);
    sections[1] = { ...sections[1], narrativeRole: "unregistered-role" };
    sections[2] = { ...sections[2], transitionIntent: "unregistered-transition" };
    expect(validate("home", sections, plan).issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["UNKNOWN_NARRATIVE_ROLE", "UNKNOWN_TRANSITION_INTENT"]),
    );
  });

  it("rejects prohibited adjacency, invalid opening and invalid closing roles", () => {
    const plan = requiredPlan("template_brand_led_editorial", "home");
    plan.pageBlueprint.flowRuleIds = [
      "trust-cannot-directly-precede-discovery",
      "orientation-opens-page",
      "service-closes-page",
    ];
    const sections: NarrativeCompositionSection[] = [
      {
        id: "trust",
        component: "header",
        variant: "centered",
        narrativeRole: "trust",
        visualWeight: "light",
      },
      {
        id: "products",
        component: "productGrid",
        variant: "editorial",
        narrativeRole: "primary-discovery",
        visualWeight: "heavy",
      },
      {
        id: "ends-wrong",
        component: "newsletter",
        variant: "inline",
        narrativeRole: "continuation",
        visualWeight: "light",
      },
    ];
    const codes = validate("home", sections, plan).issues.map((entry) => entry.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "PROHIBITED_ADJACENCY",
        "INVALID_OPENING_ROLE",
        "INVALID_CLOSING_ROLE",
      ]),
    );
  });

  it("enforces registered visual-weight and transition-intent rules", () => {
    const plan = requiredPlan("template_brand_led_editorial", "home");
    plan.pageBlueprint.flowRuleIds = [
      "no-adjacent-dominant-sections",
      "orientation-to-discovery-transition",
    ];
    const sections: NarrativeCompositionSection[] = [
      {
        id: "orientation",
        component: "hero",
        variant: "editorial",
        narrativeRole: "orientation",
        visualWeight: "dominant",
        transitionIntent: "proof",
      },
      {
        id: "products",
        component: "productGrid",
        variant: "editorial",
        narrativeRole: "primary-discovery",
        visualWeight: "dominant",
      },
    ];
    expect(validate("home", sections, plan).issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["INVALID_VISUAL_WEIGHT_SEQUENCE", "PROHIBITED_ADJACENCY"]),
    );
  });

  it("distinguishes bounded structural and visual parameters", () => {
    expect(
      boundedParameterDefinitions.find((definition) => definition.id === "layoutModel")?.category,
    ).toBe("structural");
    expect(
      boundedParameterDefinitions.find((definition) => definition.id === "density")?.category,
    ).toBe("visual");
  });

  it("resolves inheritance deterministically and rejects broadening or forbidden instance overrides", () => {
    expect(
      resolveBoundedParameterInheritance("density", [
        {
          level: "pageBlueprint",
          constraint: { parameterId: "density", allowedValues: ["compact", "standard"] },
        },
        { level: "componentVariant", value: "compact" },
        { level: "instance", value: "standard" },
      ]),
    ).toMatchObject({ value: "standard", issues: [] });
    expect(
      resolveBoundedParameterInheritance("density", [
        { level: "pageBlueprint", constraint: { parameterId: "density", allowedValues: ["airy"] } },
      ]).issues.map((entry) => entry.code),
    ).toContain("ILLEGAL_INHERITANCE_BROADENING");
    expect(
      resolveBoundedParameterInheritance("layoutModel", [
        { level: "instance", value: "grid" },
      ]).issues.map((entry) => entry.code),
    ).toContain("PROHIBITED_INSTANCE_OVERRIDE");
  });

  it("validates explicit ComponentDefinitionV2 compatibility against PageBlueprints and parameters", () => {
    const plan = requiredPlan("template_brand_led_editorial", "collection");
    const incompatibleCollection = structuredClone(dynamicCollectionCommerceDefinition);
    incompatibleCollection.designCompatibility.allowedNarrativeRoles = ["secondary-discovery"];
    incompatibleCollection.designCompatibility.blueprintProfilePolicy = "listed";
    incompatibleCollection.designCompatibility.compatibleBlueprintProfileIds = ["other-blueprint"];
    const result = validateNarrativeComposition({
      pageType: "collection",
      blueprintProfileId: "template_brand_led_editorial",
      pageBlueprint: plan,
      components: [incompatibleCollection, dynamicProductDetailDefinition],
      sections: [
        {
          id: "collection",
          component: "dynamicCollectionCommerce",
          variant: "compact",
          narrativeRole: "primary-discovery",
          visualWeight: "heavy",
          parameters: { density: "unbounded" },
        },
      ],
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "UNSUPPORTED_COMPONENT_ROLE",
        "PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE",
        "INVALID_BOUNDED_PARAMETER_VALUE",
      ]),
    );
  });

  it("rejects repeated roles, repeated component families, incompatible parameter combinations and commerce separation", () => {
    const plan = requiredPlan("template_brand_led_editorial", "product");
    plan.pageBlueprint.maxRepeatedRole = 1;
    plan.pageBlueprint.maxRepeatedComponentFamily = 1;
    const result = validateNarrativeComposition({
      pageType: "product",
      blueprintProfileId: "template_brand_led_editorial",
      pageBlueprint: plan,
      components: [dynamicProductDetailDefinition],
      sections: [
        {
          id: "focus",
          component: "dynamicProductDetail",
          variant: "compact",
          narrativeRole: "product-focus",
          visualWeight: "heavy",
          parameters: { productInformationPlacement: "besideMedia", filterPlacement: "sidebar" },
        },
        {
          id: "between",
          component: "dynamicProductDetail",
          variant: "compact",
          narrativeRole: "product-proof",
          visualWeight: "medium",
        },
        {
          id: "conversion",
          component: "dynamicProductDetail",
          variant: "compact",
          narrativeRole: "conversion",
          visualWeight: "heavy",
        },
      ],
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "EXCESSIVE_REPEATED_COMPONENT_FAMILY",
        "INCOMPATIBLE_PARAMETER_COMBINATION",
        "COMMERCE_SENSITIVE_PLACEMENT",
      ]),
    );
  });
});
