import { describe, expect, it } from "vitest";
import {
  adaptLegacyCommercialDesignGrammar,
  commercialDesignGrammarKnowledge,
  CommercialDesignGrammarKnowledgeError,
  createCommercialDesignGrammarKnowledge,
} from "@/application/design-skills";
import {
  getExecutablePageBlueprintProfile,
  listExecutablePageBlueprintProfiles,
  materializeExecutablePageBlueprint,
  type ExecutablePageBlueprintMaterialization,
} from "@/application/storefront-templates";
import {
  veskifyComponentCapabilityManifest,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import {
  commercialGrammarCategoryIds,
  commercialGrammarCompatibilityRelationSchema,
  commercialGrammarCompatibilityReferenceSchema,
  createCommercialGrammarCapability,
  resolveCommercialGrammarInheritance,
  type CommercialGrammarLayer,
} from "@/domain/component-platform";
import { aurumNordicBrandSystem, brandSystemSchema } from "@/domain/design-system";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";

function materialize(profileId = "blueprint-balanced-home") {
  const pagePlan = getExecutablePageBlueprintProfile(profileId);
  if (!pagePlan?.profile) throw new Error(`Missing executable profile ${profileId}.`);
  return materializeExecutablePageBlueprint({
    pagePlan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: pagePlan.profile.requiredBindingCategories,
  });
}

function knowledgeErrorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return error instanceof CommercialDesignGrammarKnowledgeError ? error.code : "unexpected";
  }
  return undefined;
}

function withFingerprint(
  materialization: ExecutablePageBlueprintMaterialization,
): ExecutablePageBlueprintMaterialization {
  const content = {
    profileId: materialization.profileId,
    profileVersion: materialization.profileVersion,
    pageType: materialization.pageType,
    roleOrder: materialization.roleOrder,
    slots: materialization.slots,
    requiredBindingCategories: materialization.requiredBindingCategories,
    requiredAssetRoles: materialization.requiredAssetRoles,
  };
  return {
    ...materialization,
    fingerprint: `page-blueprint-${canonicalValueFingerprint(canonicalValueString(content))}`,
  };
}

function registeredComponentWithVariant() {
  const component = veskifyComponentCapabilityManifest.manifest.entries.find(
    (entry) => entry.variants.length > 0,
  );
  if (!component) throw new Error("Expected a registered component variant.");
  return component;
}

describe("P10B-01 commercial design grammar and compatibility vocabulary", () => {
  it("registers every required commercial grammar category through one generated manifest", () => {
    expect(veskifyComponentCapabilityManifest.listCommercialGrammarCategories()).toHaveLength(27);
    expect(
      veskifyComponentCapabilityManifest
        .listCommercialGrammarCategories()
        .map((category) => category.id),
    ).toEqual([...commercialGrammarCategoryIds].sort());
    expect(veskifyComponentCapabilityManifest.manifest.commercialDesignGrammar.fingerprint).toMatch(
      /^commercial-design-grammar-/,
    );
    const values = veskifyComponentCapabilityManifest
      .listCommercialGrammarCategories()
      .flatMap((category) => category.values.map((value) => [category.id, value] as const));
    expect(
      veskifyComponentCapabilityManifest.manifest.commercialDesignGrammar.valueCompatibility,
    ).toHaveLength(values.length);
    for (const [categoryId, value] of values) {
      expect(
        veskifyComponentCapabilityManifest.getCommercialGrammarValueCompatibility(
          categoryId,
          value,
        ),
      ).toMatchObject({ categoryId, value, defaultRelation: "allowed" });
    }
  });

  it.each([
    ["typography", ["typography.posture", "typography.role", "typography.scale"]],
    ["layout", ["layout.container", "layout.sectionRhythm", "layout.gridRhythm"]],
    ["surface", ["surface.role"]],
    ["action", ["action.hierarchy"]],
    ["control", ["control.posture"]],
    ["shape", ["shape.border", "shape.radius", "shape.elevation"]],
    ["media", ["media.ratio", "media.crop", "media.focalPoint", "media.overlay"]],
    ["responsive", ["responsive.transformation"]],
    ["narrative", ["narrative.role"]],
  ] as const)("exposes the closed %s vocabulary", (domain, expectedIds) => {
    const categories = commercialDesignGrammarKnowledge.listCategories({
      reference: commercialDesignGrammarKnowledge.getReference(),
      domain,
    });
    expect(categories.map((category) => category.id)).toEqual(
      expect.arrayContaining([...expectedIds]),
    );
    expect(categories.every((category) => category.values.length > 0)).toBe(true);
  });

  it("registers the required commercial narrative functions without replacing legacy roles", () => {
    expect(
      veskifyComponentCapabilityManifest.getCommercialGrammarCategory("narrative.role")?.values,
    ).toEqual([
      "campaign",
      "continuation",
      "conversion",
      "discovery",
      "editorial",
      "introduction",
      "merchandising",
      "proof",
      "service",
      "utility",
    ]);
  });

  it("registers the complete bounded surface, action and responsive language", () => {
    expect(
      veskifyComponentCapabilityManifest.getCommercialGrammarCategory("typography.role")?.values,
    ).toEqual(
      expect.arrayContaining(["display", "heading", "body", "utility", "price", "emphasis"]),
    );
    expect(
      veskifyComponentCapabilityManifest.getCommercialGrammarCategory("surface.role")?.values,
    ).toEqual(
      expect.arrayContaining([
        "plain",
        "muted",
        "elevated",
        "contrast",
        "accent",
        "bordered",
        "inset",
        "overlay",
      ]),
    );
    expect(
      veskifyComponentCapabilityManifest.getCommercialGrammarCategory("action.hierarchy")?.values,
    ).toEqual(expect.arrayContaining(["primary", "secondary", "tertiary", "text-link"]));
    expect(
      veskifyComponentCapabilityManifest.getCommercialGrammarCategory("responsive.transformation")
        ?.values,
    ).toEqual(
      expect.arrayContaining([
        "preserve",
        "stack",
        "reorder",
        "collapse",
        "scroll",
        "condense",
        "hide-optional",
        "switch-layout",
      ]),
    );
  });

  it("declares one primary owner and explicit narrowing/selection authority per category", () => {
    for (const category of veskifyComponentCapabilityManifest.listCommercialGrammarCategories()) {
      expect(category.selectionLevels).toContain(category.primaryOwner);
      expect(category.narrowingLevels.length).toBeGreaterThan(0);
      expect(category.instanceOverrideAllowed).toBe(category.selectionLevels.includes("instance"));
    }
    expect(
      veskifyComponentCapabilityManifest.getCommercialGrammarCategory("typography.posture"),
    ).toMatchObject({ primaryOwner: "brandSystem", selectionLevels: ["brandSystem"] });
    expect(
      veskifyComponentCapabilityManifest.getCommercialGrammarCategory("narrative.role"),
    ).toMatchObject({ primaryOwner: "pageBlueprint", selectionLevels: ["pageBlueprint"] });
  });

  it("resolves BrandSystem to PageBlueprint to component to instance inheritance deterministically", () => {
    const resolution = veskifyComponentCapabilityManifest.resolveCommercialGrammar([
      {
        level: "brandSystem",
        selections: { "typography.posture": "editorial" },
      },
      {
        level: "pageBlueprint",
        constraints: { "layout.alignment": ["center"] },
        selections: { "layout.alignment": "center" },
      },
      { level: "componentVariant", constraints: { "layout.alignment": ["center"] } },
      { level: "instance", selections: { "layout.alignment": "center" } },
    ]);
    expect(resolution.issues).toEqual([]);
    expect(resolution.values["layout.alignment"]).toBe("center");
    expect(resolution.allowedValues["layout.alignment"]).toEqual(["center"]);
  });

  it("rejects lower-layer broadening", () => {
    const resolution = veskifyComponentCapabilityManifest.resolveCommercialGrammar([
      {
        level: "brandSystem",
        constraints: { "typography.posture": ["editorial", "modern"] },
      },
      {
        level: "pageBlueprint",
        constraints: { "typography.posture": ["editorial", "technical"] },
      },
    ]);
    expect(resolution.issues.map((issue) => issue.code)).toContain("ILLEGAL_GRAMMAR_BROADENING");
  });

  it("rejects empty narrowing intersections", () => {
    const resolution = veskifyComponentCapabilityManifest.resolveCommercialGrammar([
      { level: "brandSystem", constraints: { "layout.container": [] } },
    ]);
    expect(resolution.issues.map((issue) => issue.code)).toContain(
      "CONFLICTING_GRAMMAR_CONSTRAINT",
    );
  });

  it("rejects an instance selection outside its category authority", () => {
    const resolution = veskifyComponentCapabilityManifest.resolveCommercialGrammar([
      { level: "instance", selections: { "typography.posture": "editorial" } },
    ]);
    expect(resolution.issues.map((issue) => issue.code)).toContain("PROHIBITED_GRAMMAR_AUTHORITY");
  });

  it("permits only explicitly bounded instance overrides", () => {
    const valid = veskifyComponentCapabilityManifest.resolveCommercialGrammar([
      { level: "instance", selections: { "layout.alignment": "center" } },
    ]);
    const invalid = veskifyComponentCapabilityManifest.resolveCommercialGrammar([
      { level: "instance", selections: { "layout.container": "wide" } },
    ]);
    expect(valid.issues).toEqual([]);
    expect(valid.values["layout.alignment"]).toBe("center");
    expect(invalid.issues.map((issue) => issue.code)).toContain("PROHIBITED_GRAMMAR_AUTHORITY");
  });

  it("fails closed for unknown categories and unknown values", () => {
    const resolution = veskifyComponentCapabilityManifest.resolveCommercialGrammar([
      {
        level: "pageBlueprint",
        selections: {
          "unknown.category": "value",
          "layout.alignment": "diagonal",
        },
      },
    ]);
    expect(resolution.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["UNKNOWN_GRAMMAR_CATEGORY", "UNKNOWN_GRAMMAR_VALUE"]),
    );
  });

  it("rejects raw CSS, class and executable-style values with a typed error", () => {
    const resolution = veskifyComponentCapabilityManifest.resolveCommercialGrammar([
      {
        level: "instance",
        selections: { "layout.alignment": "style { display: grid; }" },
      },
    ]);
    expect(resolution.issues.map((issue) => issue.code)).toContain("UNBOUNDED_DESIGN_VALUE");
  });

  it("defines every required compatibility relationship as a closed schema", () => {
    expect(commercialGrammarCompatibilityRelationSchema.options).toEqual([
      "allowed",
      "prohibited",
      "requires",
      "mutuallyExclusive",
      "narrowingIntersection",
    ]);
    for (const reference of [
      { kind: "pageBlueprintProfile", profileId: "blueprint-balanced-home" },
      { kind: "componentFamily", family: "commerce" },
      { kind: "componentVariant", componentType: "homepageHero", variant: "editorial" },
      { kind: "responsiveMode", value: "stack" },
      { kind: "narrativeRole", value: "proof" },
      { kind: "assetRole", value: "editorialImage" },
      { kind: "mediaRequirement", value: "approvedAsset" },
    ]) {
      expect(commercialGrammarCompatibilityReferenceSchema.safeParse(reference).success).toBe(true);
    }
  });

  it("fails closed when art-directed media lacks approved asset authority", () => {
    const capability = createCommercialGrammarCapability();
    const resolution = resolveCommercialGrammarInheritance(capability, [
      { level: "brandSystem", selections: { "media.crop": "artDirected" } },
    ]);
    expect(
      veskifyComponentCapabilityManifest
        .evaluateCommercialGrammarCompatibility({
          values: resolution.values,
          mediaRequirements: [],
        })
        .map((issue) => issue.code),
    ).toContain("MISSING_GRAMMAR_REQUIREMENT");
    expect(
      veskifyComponentCapabilityManifest
        .evaluateCommercialGrammarCompatibility({
          values: resolution.values,
          mediaRequirements: ["approvedAsset"],
        })
        .map((issue) => issue.code),
    ).not.toContain("MISSING_GRAMMAR_REQUIREMENT");
  });

  it("rejects protected canonical-media incompatibility", () => {
    const capability = createCommercialGrammarCapability();
    const resolution = resolveCommercialGrammarInheritance(capability, [
      {
        level: "brandSystem",
        selections: { "media.crop": "artDirected", "media.focalPoint": "artDirected" },
      },
    ]);
    expect(
      veskifyComponentCapabilityManifest
        .evaluateCommercialGrammarCompatibility({
          values: resolution.values,
          mediaRequirements: ["approvedAsset", "canonicalProductMedia"],
        })
        .map((issue) => issue.code),
    ).toEqual(
      expect.arrayContaining(["INCOMPATIBLE_GRAMMAR_SELECTION", "INCOMPATIBLE_GRAMMAR_SELECTION"]),
    );
  });

  it("executes responsive narrowing intersection compatibility", () => {
    const capability = createCommercialGrammarCapability();
    const resolution = resolveCommercialGrammarInheritance(capability, []);
    expect(
      veskifyComponentCapabilityManifest
        .evaluateCommercialGrammarCompatibility({
          values: resolution.values,
          responsiveMode: "stack",
        })
        .map((issue) => issue.code),
    ).toContain("CONFLICTING_GRAMMAR_CONSTRAINT");
    expect(
      veskifyComponentCapabilityManifest.evaluateCommercialGrammarCompatibility({
        values: resolution.values,
        responsiveMode: "reflow",
      }),
    ).toEqual([]);
  });

  it("fails closed for the exact unknown compatibility category and value examples", () => {
    const unknownCategory =
      veskifyComponentCapabilityManifest.evaluateCommercialGrammarCompatibility({
        values: { "unknown.category": "value" },
      });
    const unknownValue = veskifyComponentCapabilityManifest.evaluateCommercialGrammarCompatibility({
      values: { "layout.alignment": "diagonal" },
    });
    expect(unknownCategory.map((issue) => issue.code)).toEqual(["UNKNOWN_GRAMMAR_CATEGORY"]);
    expect(unknownValue.map((issue) => issue.code)).toEqual(["UNKNOWN_GRAMMAR_VALUE"]);
    expect(unknownValue).not.toEqual([]);
  });

  it.each([
    [
      "PageBlueprint profile",
      { values: {}, profileId: "blueprint-unknown-profile" },
      "UNKNOWN_PAGE_BLUEPRINT_PROFILE",
    ],
    [
      "component family",
      { values: {}, componentFamily: "unknownFamily" },
      "UNKNOWN_COMPONENT_FAMILY",
    ],
    ["component type", { values: {}, componentType: "unknownComponent" }, "UNKNOWN_COMPONENT_TYPE"],
    ["responsive mode", { values: {}, responsiveMode: "diagonal" }, "UNKNOWN_RESPONSIVE_MODE"],
    ["narrative role", { values: {}, narrativeRole: "fabricatedClaim" }, "UNKNOWN_NARRATIVE_ROLE"],
    ["asset role", { values: {}, assetRoles: ["unknownAsset"] }, "UNKNOWN_ASSET_ROLE"],
    [
      "media requirement",
      { values: {}, mediaRequirements: ["inventedMedia"] },
      "UNKNOWN_MEDIA_REQUIREMENT",
    ],
  ] as const)("rejects an unknown %s before compatibility rules", (_label, input, expectedCode) => {
    const issues = veskifyComponentCapabilityManifest.evaluateCommercialGrammarCompatibility(input);
    expect(issues.map((issue) => issue.code)).toEqual([expectedCode]);
  });

  it("rejects an unknown variant through current component capability authority", () => {
    const component = registeredComponentWithVariant();
    const issues = veskifyComponentCapabilityManifest.evaluateCommercialGrammarCompatibility({
      values: {},
      componentType: component.componentType,
      variant: "unknownVariant",
    });
    expect(issues.map((issue) => issue.code)).toEqual(["UNKNOWN_COMPONENT_VARIANT"]);
  });

  it("allows registered authority with no active rule and distinguishes known incompatibility", () => {
    const component = registeredComponentWithVariant();
    const variant = component.variants[0];
    if (!variant) throw new Error("Expected a registered component variant.");
    const profile = veskifyComponentCapabilityManifest.manifest.profiles[0];
    if (!profile) throw new Error("Expected a registered PageBlueprint profile.");
    expect(
      veskifyComponentCapabilityManifest.evaluateCommercialGrammarCompatibility({
        values: { "layout.alignment": "center" },
        profileId: profile.profileId,
        componentFamily: component.family,
        componentType: component.componentType,
        variant: variant.id,
        assetRoles: ["editorialImage"],
        mediaRequirements: ["responsiveDerivative"],
      }),
    ).toEqual([]);

    const incompatible = veskifyComponentCapabilityManifest.evaluateCommercialGrammarCompatibility({
      values: { "media.crop": "artDirected" },
      mediaRequirements: ["approvedAsset", "canonicalProductMedia"],
    });
    expect(incompatible.map((issue) => issue.code)).toContain("INCOMPATIBLE_GRAMMAR_SELECTION");
    expect(incompatible.map((issue) => issue.code)).not.toContain("UNKNOWN_MEDIA_REQUIREMENT");
  });

  it.each([
    ["brandSystem", "typography.posture", "editorial", "modern"],
    ["pageBlueprint", "layout.alignment", "center", "split"],
    ["componentVariant", "layout.alignment", "center", "split"],
    ["instance", "layout.alignment", "center", "split"],
  ] as const)(
    "rejects duplicate %s authority layers independent of caller order",
    (level, categoryId, firstValue, secondValue) => {
      const capability = createCommercialGrammarCapability();
      const firstLayer = { level, selections: { [categoryId]: firstValue } };
      const secondLayer = { level, selections: { [categoryId]: secondValue } };
      const forward = resolveCommercialGrammarInheritance(capability, [firstLayer, secondLayer]);
      const reversed = resolveCommercialGrammarInheritance(capability, [secondLayer, firstLayer]);

      expect(forward.issues.map((issue) => issue.code)).toEqual([
        "DUPLICATE_GRAMMAR_AUTHORITY_LEVEL",
      ]);
      expect(reversed.issues).toEqual(forward.issues);
      expect(reversed.fingerprint).toBe(forward.fingerprint);
      expect(forward.values[categoryId]).toBe(
        capability.categories.find((category) => category.id === categoryId)?.defaultValue,
      );
    },
  );

  it("keeps a valid unique hierarchy caller-order independent", () => {
    const capability = createCommercialGrammarCapability();
    const layers: readonly CommercialGrammarLayer[] = [
      { level: "brandSystem" as const, selections: { "typography.posture": "editorial" } },
      {
        level: "pageBlueprint" as const,
        constraints: { "layout.alignment": ["center"] },
        selections: { "layout.alignment": "center" },
      },
      {
        level: "componentVariant" as const,
        constraints: { "layout.alignment": ["center"] },
      },
      { level: "instance" as const, selections: { "layout.alignment": "center" } },
    ];
    const forward = resolveCommercialGrammarInheritance(capability, layers);
    const reversed = resolveCommercialGrammarInheritance(capability, [...layers].reverse());
    expect(forward.issues).toEqual([]);
    expect(reversed).toEqual(forward);
  });

  it("produces stable order-insensitive authority and selection fingerprints", () => {
    const first = createCommercialGrammarCapability();
    const second = createCommercialGrammarCapability();
    const firstResolution = resolveCommercialGrammarInheritance(first, [
      {
        level: "pageBlueprint",
        selections: { "layout.alignment": "center", "layout.visualWeight": "heavy" },
      },
    ]);
    const secondResolution = resolveCommercialGrammarInheritance(second, [
      {
        level: "pageBlueprint",
        selections: { "layout.visualWeight": "heavy", "layout.alignment": "center" },
      },
    ]);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(firstResolution.fingerprint).toBe(secondResolution.fingerprint);
  });

  it("changes the selection fingerprint for a materially different choice", () => {
    const capability = createCommercialGrammarCapability();
    const centered = resolveCommercialGrammarInheritance(capability, [
      { level: "pageBlueprint", selections: { "layout.alignment": "center" } },
    ]);
    const split = resolveCommercialGrammarInheritance(capability, [
      { level: "pageBlueprint", selections: { "layout.alignment": "split" } },
    ]);
    expect(centered.fingerprint).not.toBe(split.fingerprint);
  });

  it("adapts valid v1.3 BrandSystem and PageBlueprint state deterministically without mutation", () => {
    const currentMaterialization = materialize();
    const beforeBrand = structuredClone(aurumNordicBrandSystem);
    const beforeMaterialization = structuredClone(currentMaterialization);
    const first = adaptLegacyCommercialDesignGrammar({
      brandSystem: aurumNordicBrandSystem,
      materialization: currentMaterialization,
      slotId: currentMaterialization.slots[0].slotId,
    });
    const second = adaptLegacyCommercialDesignGrammar({
      brandSystem: aurumNordicBrandSystem,
      materialization: currentMaterialization,
      slotId: currentMaterialization.slots[0].slotId,
    });
    expect(first).toEqual(second);
    expect(aurumNordicBrandSystem).toEqual(beforeBrand);
    expect(currentMaterialization).toEqual(beforeMaterialization);
    expect(brandSystemSchema.safeParse(aurumNordicBrandSystem).success).toBe(true);
  });

  it("reaches planning authority from BrandSystem through every executable P10A materialization", () => {
    const reference = commercialDesignGrammarKnowledge.getReference();
    for (const pagePlan of listExecutablePageBlueprintProfiles()) {
      if (!pagePlan.profile)
        throw new Error("Expected executable PageBlueprint profile authority.");
      const currentMaterialization = materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: pagePlan.profile.requiredBindingCategories,
      });
      for (const slot of currentMaterialization.slots) {
        const resolved = commercialDesignGrammarKnowledge.resolveMaterializedSlot({
          reference,
          brandSystem: aurumNordicBrandSystem,
          materialization: currentMaterialization,
          slotId: slot.slotId,
        });
        const repeated = commercialDesignGrammarKnowledge.resolveMaterializedSlot({
          reference,
          brandSystem: aurumNordicBrandSystem,
          materialization: currentMaterialization,
          slotId: slot.slotId,
        });
        expect(resolved.profileId).toBe(currentMaterialization.profileId);
        expect(resolved.pageBlueprintSelection.slotId).toBe(slot.slotId);
        expect(resolved.grammar.issues).toEqual([]);
        expect(repeated).toEqual(resolved);
      }
    }
  });

  it("fails closed for stale grammar and manifest references", () => {
    const reference = commercialDesignGrammarKnowledge.getReference();
    expect(
      knowledgeErrorCode(() =>
        commercialDesignGrammarKnowledge.listCategories({
          reference: { ...reference, fingerprint: "stale-grammar" },
        }),
      ),
    ).toBe("staleGrammar");
    expect(
      knowledgeErrorCode(() =>
        commercialDesignGrammarKnowledge.listCategories({
          reference: { ...reference, manifestFingerprint: "stale-manifest" },
        }),
      ),
    ).toBe("staleManifest");
  });

  it("rejects stale materialization and a different otherwise-valid variant", () => {
    const reference = commercialDesignGrammarKnowledge.getReference();
    const current = materialize();
    const stale = { ...current, fingerprint: "stale-materialization" };
    expect(
      knowledgeErrorCode(() =>
        commercialDesignGrammarKnowledge.resolveMaterializedSlot({
          reference,
          brandSystem: aurumNordicBrandSystem,
          materialization: stale,
          slotId: stale.slots[0].slotId,
        }),
      ),
    ).toBe("staleMaterialization");

    const selectedSlot = current.slots.find((slot) => {
      const capability = veskifyComponentCapabilityManifest.getByComponentType(slot.component);
      return capability && capability.variants.some((variant) => variant.id !== slot.variant);
    });
    if (!selectedSlot) throw new Error("Expected a slot with another registered variant.");
    const alternate = veskifyComponentCapabilityManifest
      .getByComponentType(selectedSlot.component)!
      .variants.find((variant) => variant.id !== selectedSlot.variant)!.id;
    const changed = withFingerprint({
      ...current,
      slots: current.slots.map((slot) =>
        slot.slotId === selectedSlot.slotId ? { ...slot, variant: alternate } : slot,
      ),
    });
    expect(
      knowledgeErrorCode(() =>
        commercialDesignGrammarKnowledge.resolveMaterializedSlot({
          reference,
          brandSystem: aurumNordicBrandSystem,
          materialization: changed,
          slotId: selectedSlot.slotId,
        }),
      ),
    ).toBe("staleMaterialization");
  });

  it("keeps query results immutable and exposes no registration operation", () => {
    const knowledge = createCommercialDesignGrammarKnowledge();
    const categories = knowledge.listCategories({ reference: knowledge.getReference() });
    expect(Object.isFrozen(categories)).toBe(true);
    expect(Object.isFrozen(categories[0])).toBe(true);
    expect(Reflect.set(categories[0], "defaultValue", "mutated")).toBe(false);
    expect(knowledge).not.toHaveProperty("register");
    expect(knowledge).not.toHaveProperty("mutate");
  });
});
