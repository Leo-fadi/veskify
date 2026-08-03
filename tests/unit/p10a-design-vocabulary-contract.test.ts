import { describe, expect, it } from "vitest";
import {
  boundedParameterDefinitions,
  narrativeRoleIds,
  resolveBoundedParameterInheritance,
} from "@/domain/component-platform";
import {
  getTemplateById,
  listTemplates,
  validateNarrativeComposition,
  type NarrativeCompositionSection,
} from "@/application/storefront-templates";
import {
  dynamicCollectionCommerceDefinition,
  dynamicProductDetailDefinition,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";

const storefrontGenerationPageTypes = ["home", "collection", "product"] satisfies readonly (
  "home" | "collection" | "product"
)[];

function codes(result: ReturnType<typeof validateNarrativeComposition>) {
  return result.issues.map((entry) => entry.code);
}

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

  it("keeps every registered PageBlueprint internally satisfiable", () => {
    listTemplates().forEach((template) => {
      storefrontGenerationPageTypes.forEach((pageType) => {
        const plan = requiredPlan(template.id, pageType);
        expect(validate(pageType, sectionsFor(plan), plan), `${template.id}/${pageType}`).toEqual({
          valid: true,
          issues: [],
        });
      });
    });
  });

  it("keeps every registered product recipe satisfiable when optional product options are omitted", () => {
    listTemplates().forEach((template) => {
      const plan = requiredPlan(template.id, "product");
      const realized = sectionsFor(plan).filter(
        (section) =>
          plan.slots.find((slot) => slot.id === section.id)?.omitWhen !== "when-not-requested",
      );
      expect(validate("product", realized, plan), template.id).toEqual({ valid: true, issues: [] });
      expect(
        realized.some((section) => section.narrativeRole === "conversion"),
        template.id,
      ).toBe(true);
    });

    const optionalOnly = requiredPlan("template_brand_led_editorial", "product");
    optionalOnly.pageBlueprint.requiredNarrativeRoles = ["orientation", "product-focus", "service"];
    optionalOnly.slots = optionalOnly.slots.filter((slot) => slot.id !== "product-options");
    expect(validate("product", sectionsFor(optionalOnly), optionalOnly)).toEqual({
      valid: true,
      issues: [],
    });

    const conversionRequired = structuredClone(optionalOnly);
    conversionRequired.pageBlueprint.requiredNarrativeRoles.push("conversion");
    conversionRequired.slots = conversionRequired.slots.filter(
      (slot) => slot.narrativeRole !== "conversion",
    );
    expect(
      codes(validate("product", sectionsFor(conversionRequired), conversionRequired)),
    ).toContain("PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE");
  });

  it("returns stable errors for unknown roles and transition intents", () => {
    const plan = requiredPlan("template_brand_led_editorial", "home");
    const sections = sectionsFor(plan);
    sections[1] = { ...sections[1], narrativeRole: "unregistered-role" };
    sections[2] = { ...sections[2], transitionIntent: "unregistered-transition" };
    expect(validate("home", sections, plan).issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["UNKNOWN_NARRATIVE_ROLE", "UNKNOWN_TRANSITION_INTENT"]),
    );
  });

  it("fails closed for unknown and page-incompatible flow rules", () => {
    const plan = requiredPlan("template_brand_led_editorial", "home");
    plan.pageBlueprint.flowRuleIds = [
      "misspelled-rule",
      "pdp-product-focus-before-conversion",
      "no-adjacent-dominant-sections",
    ];
    expect(codes(validate("home", sectionsFor(plan), plan))).toEqual(
      expect.arrayContaining(["UNKNOWN_FLOW_RULE", "UNSUPPORTED_FLOW_RULE_PAGE_TYPE"]),
    );
    plan.pageBlueprint.flowRuleIds = ["no-adjacent-dominant-sections"];
    expect(validate("home", sectionsFor(plan), plan)).toEqual({ valid: true, issues: [] });
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

  it("enforces narrative-role visual-weight bounds before broad component compatibility", () => {
    const plan = requiredPlan("template_brand_led_editorial", "home");
    plan.pageBlueprint.allowedNarrativeRoles = ["trust"];
    plan.pageBlueprint.requiredNarrativeRoles = [];
    plan.pageBlueprint.flowRuleIds = [];
    const lightTrust: NarrativeCompositionSection = {
      id: "trust",
      component: "benefitIcons",
      variant: "minimal",
      narrativeRole: "trust",
      visualWeight: "light",
    };
    expect(validate("home", [lightTrust], plan)).toEqual({ valid: true, issues: [] });
    expect(validate("home", [{ ...lightTrust, visualWeight: "medium" }], plan)).toEqual({
      valid: true,
      issues: [],
    });
    expect(codes(validate("home", [{ ...lightTrust, visualWeight: "dominant" }], plan))).toContain(
      "UNSUPPORTED_ROLE_VISUAL_WEIGHT",
    );
    expect(
      codes(
        validate(
          "home",
          [{ ...lightTrust, narrativeRole: "unknown", visualWeight: "unknown" }],
          plan,
        ),
      ),
    ).toEqual(expect.arrayContaining(["UNKNOWN_NARRATIVE_ROLE"]));
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

  it("carries narrowed numeric bounds through every inheritance authority level", () => {
    const narrowed = resolveBoundedParameterInheritance("columnCount", [
      {
        level: "pageBlueprint",
        constraint: { parameterId: "columnCount", minimum: 2, maximum: 3 },
      },
      { level: "instance", value: 2 },
    ]);
    expect(narrowed).toMatchObject({
      effectiveMinimum: 2,
      effectiveMaximum: 3,
      value: 2,
      issues: [],
    });
    expect(
      resolveBoundedParameterInheritance("columnCount", [
        {
          level: "pageBlueprint",
          constraint: { parameterId: "columnCount", minimum: 2, maximum: 3 },
        },
        { level: "instance", value: 1 },
      ]).issues.map((entry) => entry.code),
    ).toContain("INVALID_BOUNDED_PARAMETER_VALUE");
    expect(
      resolveBoundedParameterInheritance("columnCount", [
        {
          level: "pageBlueprint",
          constraint: { parameterId: "columnCount", minimum: 2, maximum: 3 },
        },
        {
          level: "componentVariant",
          constraint: { parameterId: "columnCount", minimum: 1, maximum: 4 },
        },
      ]).issues.map((entry) => entry.code),
    ).toContain("ILLEGAL_INHERITANCE_BROADENING");
    expect(
      resolveBoundedParameterInheritance("columnCount", [
        {
          level: "pageBlueprint",
          constraint: { parameterId: "columnCount", minimum: 2, maximum: 3 },
        },
        {
          level: "componentVariant",
          constraint: { parameterId: "columnCount", minimum: 3, maximum: 2 },
        },
      ]).issues.map((entry) => entry.code),
    ).toContain("CONTRADICTORY_NUMERIC_RANGE");
    expect(
      resolveBoundedParameterInheritance("columnCount", [
        {
          level: "pageBlueprint",
          constraint: { parameterId: "columnCount", minimum: 2, maximum: 4 },
        },
        { level: "componentVariant", constraint: { parameterId: "columnCount", maximum: 3 } },
        { level: "instance", value: 3 },
      ]),
    ).toMatchObject({ effectiveMinimum: 2, effectiveMaximum: 3, value: 3, issues: [] });
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

  it("treats an explicit empty parameter allowlist as none while preserving legacy broad compatibility", () => {
    const plan = requiredPlan("template_brand_led_editorial", "collection");
    const none = structuredClone(dynamicCollectionCommerceDefinition);
    none.designCompatibility.boundedParameterIds = [];
    const section: NarrativeCompositionSection = {
      id: "collection",
      component: "dynamicCollectionCommerce",
      variant: "compact",
      narrativeRole: "primary-discovery",
      visualWeight: "heavy",
      parameters: { density: "compact" },
    };
    expect(
      codes(
        validateNarrativeComposition({
          pageType: "collection",
          blueprintProfileId: "template_brand_led_editorial",
          pageBlueprint: plan,
          components: [none],
          sections: [section],
        }),
      ),
    ).toContain("PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE");
    expect(
      validate(
        "collection",
        [
          {
            ...section,
            component: "collectionHeader",
            variant: "editorial",
            narrativeRole: "orientation",
            visualWeight: "heavy",
          },
        ],
        plan,
      ).issues.map((entry) => entry.parameterId),
    ).not.toContain("density");

    const densityOnly = structuredClone(dynamicCollectionCommerceDefinition);
    densityOnly.designCompatibility.boundedParameterIds = ["density"];
    const withDensity = validateNarrativeComposition({
      pageType: "collection",
      blueprintProfileId: "template_brand_led_editorial",
      pageBlueprint: plan,
      components: [densityOnly],
      sections: [section],
    });
    expect(withDensity.issues.map((entry) => entry.parameterId)).not.toContain("density");
    expect(
      codes(
        validateNarrativeComposition({
          pageType: "collection",
          blueprintProfileId: "template_brand_led_editorial",
          pageBlueprint: plan,
          components: [densityOnly],
          sections: [{ ...section, parameters: { shape: "rounded", unknownParameter: "x" } }],
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
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

  it("checks every conversion occurrence for immediately preceding protected product context", () => {
    const plan = requiredPlan("template_brand_led_editorial", "product");
    plan.pageBlueprint.allowedNarrativeRoles = ["product-focus", "conversion"];
    plan.pageBlueprint.requiredNarrativeRoles = [];
    plan.pageBlueprint.maxRepeatedRole = 3;
    plan.pageBlueprint.flowRuleIds = ["pdp-product-focus-before-conversion"];
    const focus: NarrativeCompositionSection = {
      id: "focus",
      component: "productGallery",
      variant: "thumbnails",
      narrativeRole: "product-focus",
      visualWeight: "dominant",
    };
    const conversion: NarrativeCompositionSection = {
      id: "conversion",
      component: "productInfo",
      variant: "premium",
      narrativeRole: "conversion",
      visualWeight: "heavy",
    };
    expect(validate("product", [focus, conversion], plan)).toEqual({ valid: true, issues: [] });
    expect(
      codes(validate("product", [focus, conversion, { ...conversion, id: "second" }], plan)),
    ).toContain("COMMERCE_SENSITIVE_PLACEMENT");
    expect(
      validate(
        "product",
        [focus, conversion, { ...focus, id: "focus-two" }, { ...conversion, id: "second" }],
        plan,
      ),
    ).toEqual({ valid: true, issues: [] });
    expect(codes(validate("product", [conversion, focus], plan))).toContain(
      "COMMERCE_SENSITIVE_PLACEMENT",
    );
    expect(
      codes(
        validate(
          "product",
          [
            focus,
            { ...focus, id: "distant", narrativeRole: "product-proof", visualWeight: "medium" },
            conversion,
          ],
          plan,
        ),
      ),
    ).toContain("COMMERCE_SENSITIVE_PLACEMENT");
  });
});
