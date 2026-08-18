// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createBoundedStorefrontSynthesisDecision } from "@/application/bounded-storefront-synthesis";
import {
  compileSemanticStorefrontDesignIntentV1,
  deriveSemanticCapabilityIndex,
  executeCompiledSemanticStorefrontDesignIntentV1,
  prepareSemanticStorefrontDesignCompilationAuthority,
  resolveSemanticStorefrontCompatibility,
} from "@/application/prompted-storefront-design-compiler";
import {
  createPromptedStorefrontDesignRequestV2,
  createSemanticStorefrontDesignRequestV1,
  semanticStorefrontCurrentAuthorityFingerprint,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent";
import { createP10B16P03RawKarvonenStudioFixture } from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import { createP10B16P04RawAurumCommercialFixture } from "@/data/demo/p10b-16p-04-commercial-acceptance";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  semanticIntentFixture,
  type SemanticDriverOverrides,
} from "../fixtures/p10b-16p-04-semantic-intent";

const prompt = "Create a complete commercially credible jewellery storefront.";

function testAuthority(
  priorDiversityFingerprints: readonly string[] = [],
  fixtureKind: "karvonen" | "aurum" = "karvonen",
) {
  const fixture =
    fixtureKind === "aurum"
      ? createP10B16P04RawAurumCommercialFixture()
      : createP10B16P03RawKarvonenStudioFixture();
  const currentRequestInput = {
    merchantPrompt: prompt,
    project: fixture.aggregate.project,
    draft: fixture.planningInput.draft,
    catalogue: fixture.planningInput.catalogue,
    approvedBrief: fixture.brief,
    approvedAssetContext: fixture.planningInput.approvedAssetContext,
    priorDiversityEvidence: {
      recentAcceptedStructuralFingerprints: [],
      recentRejectedStructuralFingerprints: [...priorDiversityFingerprints],
      recentlyUsedPostureKeys: [],
      merchantAvoidancePreferenceKeys: [],
    },
  };
  const exact = createPromptedStorefrontDesignRequestV2(currentRequestInput);
  const compatibilityInput = {
    planningInput: fixture.planningInput,
    siteMapDecision: fixture.siteMapDecision,
    approvedEvidenceReferences: fixture.approvedEvidenceReferences,
  };
  const currentAuthorityFingerprint = semanticStorefrontCurrentAuthorityFingerprint(
    exact.request.currentAuthority,
  );
  const semanticCapabilityIndex = deriveSemanticCapabilityIndex({
    authority: compatibilityInput,
    currentAuthorityFingerprint,
  });
  const request = createSemanticStorefrontDesignRequestV1(exact, {
    semanticAuthorityFingerprint: semanticCapabilityIndex.semanticAuthorityFingerprint,
    semanticInfluenceAuthority: semanticCapabilityIndex.semanticInfluenceAuthority,
  });
  return {
    fixture,
    exact,
    currentRequestInput,
    compatibilityInput,
    currentAuthorityFingerprint,
    semanticCapabilityIndex,
    request,
  };
}

type TestAuthority = ReturnType<typeof testAuthority>;
type Compiled = ReturnType<typeof compileSemanticStorefrontDesignIntentV1>;
type Decision = Compiled["compiledDecision"];

function withPriorDiversity(
  authority: TestAuthority,
  priorDiversityFingerprints: readonly string[],
): TestAuthority {
  const currentRequestInput = {
    ...authority.currentRequestInput,
    priorDiversityEvidence: {
      ...authority.currentRequestInput.priorDiversityEvidence,
      recentRejectedStructuralFingerprints: [...priorDiversityFingerprints],
    },
  };
  const exact = createPromptedStorefrontDesignRequestV2(currentRequestInput);
  const currentAuthorityFingerprint = semanticStorefrontCurrentAuthorityFingerprint(
    exact.request.currentAuthority,
  );
  if (currentAuthorityFingerprint !== authority.currentAuthorityFingerprint) {
    throw new Error("Diversity evidence changed current exact storefront authority.");
  }
  const request = createSemanticStorefrontDesignRequestV1(exact, {
    semanticAuthorityFingerprint: authority.semanticCapabilityIndex.semanticAuthorityFingerprint,
    semanticInfluenceAuthority: authority.semanticCapabilityIndex.semanticInfluenceAuthority,
  });
  return { ...authority, exact, currentRequestInput, currentAuthorityFingerprint, request };
}

type DriverSet = Required<Omit<SemanticDriverOverrides, "designConceptSummary">>;
const premiumDrivers = {
  commercialPosture: "premium-editorial",
  density: "low",
  navigationPosture: "editorial",
  storyCatalogueBalance: "story-first",
  discoveryPosture: "editorial",
  configurableProductPosture: "guided",
  mobileHierarchy: "story-led",
  imageProminence: "image-led",
} satisfies DriverSet;
const technicalDrivers = {
  commercialPosture: "modern-technical",
  density: "high",
  navigationPosture: "compact",
  storyCatalogueBalance: "catalogue-first",
  discoveryPosture: "catalogue-comparison",
  configurableProductPosture: "technical",
  mobileHierarchy: "conversion-led",
  imageProminence: "balanced",
} satisfies DriverSet;
const minimalDrivers = {
  commercialPosture: "minimal-commerce",
  density: "balanced",
  navigationPosture: "minimal",
  storyCatalogueBalance: "balanced",
  discoveryPosture: "dense-search",
  configurableProductPosture: "standard",
  mobileHierarchy: "balanced",
  imageProminence: "restrained",
} satisfies DriverSet;

function promptFamily(label: string, base: DriverSet, overrides: Partial<DriverSet> = {}) {
  return { label, drivers: { ...base, ...overrides } };
}

const promptFamilies = [
  promptFamily("premium-editorial", premiumDrivers),
  promptFamily("modern-technical", technicalDrivers),
  promptFamily("minimal-commerce", minimalDrivers),
  promptFamily("warm-approachable", premiumDrivers, {
    commercialPosture: "warm-approachable",
    imageProminence: "balanced",
  }),
  promptFamily("bold-campaign", premiumDrivers, {
    commercialPosture: "bold-campaign",
    density: "balanced",
    discoveryPosture: "campaign",
    mobileHierarchy: "product-led",
  }),
  promptFamily("catalogue-comparison", technicalDrivers, {
    commercialPosture: "catalogue-comparison",
    navigationPosture: "catalogue",
  }),
  promptFamily("high-consideration-luxury", premiumDrivers, {
    commercialPosture: "high-consideration",
  }),
  promptFamily("fast-conversion", technicalDrivers, {
    commercialPosture: "fast-conversion",
    navigationPosture: "catalogue",
    discoveryPosture: "dense-search",
    configurableProductPosture: "standard",
  }),
  promptFamily("configurable-product-heavy", technicalDrivers, {
    density: "balanced",
    navigationPosture: "catalogue",
    storyCatalogueBalance: "balanced",
  }),
  promptFamily("simple-product-heavy", minimalDrivers, {
    density: "high",
    mobileHierarchy: "conversion-led",
  }),
  promptFamily("image-rich-editorial", premiumDrivers, {
    density: "balanced",
    discoveryPosture: "campaign",
    mobileHierarchy: "product-led",
  }),
  promptFamily("image-and-evidence-poor", minimalDrivers, {
    density: "low",
    discoveryPosture: "editorial",
  }),
];

const providerIntent = (
  request: SemanticStorefrontDesignRequestV1,
  label: string,
  drivers: SemanticDriverOverrides = {},
) => semanticIntentFixture(request, { designConceptSummary: label, ...drivers });

function compile(
  fixture: TestAuthority,
  label: string,
  drivers: SemanticDriverOverrides,
  preparedAuthority = prepareSemanticStorefrontDesignCompilationAuthority({
    originalRequest: fixture.request,
    currentRequestInput: fixture.currentRequestInput,
    compatibilityInput: fixture.compatibilityInput,
    semanticCapabilityIndex: fixture.semanticCapabilityIndex,
  }),
) {
  try {
    return compileSemanticStorefrontDesignIntentV1({
      originalRequest: fixture.request,
      providerIntent: providerIntent(fixture.request, label, drivers),
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      semanticCapabilityIndex: fixture.semanticCapabilityIndex,
      preparedAuthority,
    });
  } catch (cause) {
    const resolution = resolveSemanticStorefrontCompatibility({
      request: fixture.request,
      intent: providerIntent(fixture.request, label, drivers),
      compatibilityInput: fixture.compatibilityInput,
      semanticCapabilityIndex: fixture.semanticCapabilityIndex,
      trustedCurrentAuthorityFingerprint: fixture.currentAuthorityFingerprint,
    });
    throw new Error(
      `Semantic fixture ${label} did not compile: ${canonicalValueString(resolution.selection)}`,
      { cause },
    );
  }
}

function materialVector(decision: Decision): readonly string[] {
  return [
    decision.designDna.authorityFingerprint,
    decision.exactSelection.designSystemSpacingDensity,
    decision.sharedFrame.profileId,
    decision.sharedFrame.authorityFingerprint,
    decision.profiles.homepage.profileId,
    decision.profiles.collection.profileId,
    decision.profiles.productDetail.profileId,
    decision.productCardAnatomyIds.join("|"),
    decision.exactSelection.narrativePosture,
    decision.exactSelection.merchandisingPosture,
    decision.exactSelection.artDirectionPosture,
  ];
}

const deterministicDriverValues = {
  commercialPosture: [
    "premium-editorial",
    "modern-technical",
    "minimal-commerce",
    "warm-approachable",
    "bold-campaign",
    "catalogue-comparison",
    "high-consideration",
    "fast-conversion",
  ],
  density: ["low", "balanced", "high"],
  navigationPosture: ["editorial", "catalogue", "compact", "minimal"],
  storyCatalogueBalance: ["story-first", "balanced", "catalogue-first"],
  discoveryPosture: ["editorial", "catalogue-comparison", "campaign", "dense-search"],
  configurableProductPosture: ["standard", "guided", "technical"],
  mobileHierarchy: ["story-led", "product-led", "conversion-led", "balanced"],
  imageProminence: ["restrained", "balanced", "image-led"],
} as const satisfies Readonly<
  Record<Exclude<keyof SemanticDriverOverrides, "designConceptSummary">, readonly string[]>
>;

function deterministicDrivers(index: number): SemanticDriverOverrides {
  const choose = <T extends readonly string[]>(values: T, divisor: number) =>
    values[Math.floor(index / divisor) % values.length] as T[number];
  return {
    commercialPosture: choose(deterministicDriverValues.commercialPosture, 1),
    density: choose(deterministicDriverValues.density, 8),
    navigationPosture: choose(deterministicDriverValues.navigationPosture, 24),
    storyCatalogueBalance: choose(deterministicDriverValues.storyCatalogueBalance, 96),
    discoveryPosture: choose(deterministicDriverValues.discoveryPosture, 288),
    configurableProductPosture: choose(deterministicDriverValues.configurableProductPosture, 7),
    mobileHierarchy: choose(deterministicDriverValues.mobileHierarchy, 13),
    imageProminence: choose(deterministicDriverValues.imageProminence, 17),
  };
}

describe("P10B-16P-04F semantic scale and material influence", () => {
  it("strictly validates and compiles 1,000 noncontradictory intents with zero materialization", () => {
    const fixture = testAuthority();
    const before = canonicalValueString(fixture.fixture.planningInput.draft);
    const prepared = prepareSemanticStorefrontDesignCompilationAuthority({
      originalRequest: fixture.request,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      semanticCapabilityIndex: fixture.semanticCapabilityIndex,
    });
    const selections = new Set<string>();
    const structures = new Set<string>();

    for (let index = 0; index < 1_000; index += 1) {
      const compiled = compile(
        fixture,
        `supported-semantic-intent-${index}`,
        deterministicDrivers(index),
        prepared,
      );
      selections.add(canonicalValueFingerprint(compiled.resolution.selection));
      structures.add(compiled.compiledDecision.structuralFingerprint);
      expect(compiled.resolution.diagnostic.finalCandidateCount).toBe(1);
      expect(compiled.resolution.semanticCapabilityIndex).toBe(fixture.semanticCapabilityIndex);
      expect(compiled).not.toHaveProperty("materialization");
    }

    expect(selections.size).toBeGreaterThanOrEqual(10);
    expect(structures.size).toBeGreaterThanOrEqual(6);
    expect(canonicalValueString(fixture.fixture.planningInput.draft)).toBe(before);
  }, 600_000);

  it("compiles twelve prompt families into diverse exact metadata without synthesis", () => {
    const base = testAuthority();
    const before = canonicalValueString(base.fixture.planningInput.draft);
    const compiledFingerprints = new Set<string>();
    const structuralFingerprints = new Set<string>();
    const directionIds = new Set<string>();
    const frameIds = new Set<string>();
    const homepageProfileIds = new Set<string>();
    const collectionArchetypes = new Set<string>();
    const pdpArchetypes = new Set<string>();
    const productCards = new Set<string>();
    const responsiveModes = new Set<string>();
    const artDirections = new Set<string>();
    const exactByFamily = new Map<string, readonly string[]>();
    const priorStructures: string[] = [];

    for (const family of promptFamilies) {
      const fixture = withPriorDiversity(base, priorStructures);
      const compiled = compile(fixture, family.label, family.drivers);
      const decision = compiled.compiledDecision;
      compiledFingerprints.add(decision.compiledDecisionFingerprint);
      structuralFingerprints.add(decision.structuralFingerprint);
      directionIds.add(decision.designDna.directionId);
      frameIds.add(decision.sharedFrame.profileId);
      homepageProfileIds.add(decision.profiles.homepage.profileId);
      collectionArchetypes.add(decision.dynamicCommerceSelection.collectionArchetypeId);
      pdpArchetypes.add(decision.dynamicCommerceSelection.configurableArchetypeId);
      decision.productCardAnatomyIds.forEach((value) => productCards.add(value));
      responsiveModes.add(decision.responsiveArtDirection.responsiveMode);
      artDirections.add(decision.exactSelection.artDirectionPosture);
      exactByFamily.set(family.label, materialVector(decision));
      priorStructures.push(compiled.resolution.selectedStructuralFingerprint);
      expect(compiled).not.toHaveProperty("materialization");
    }

    expect.soft(compiledFingerprints.size).toBeGreaterThanOrEqual(10);
    expect.soft(structuralFingerprints.size).toBeGreaterThanOrEqual(6);
    expect.soft(directionIds.size).toBeGreaterThan(1);
    expect.soft(frameIds.size).toBeGreaterThanOrEqual(2);
    expect.soft(homepageProfileIds.size).toBeGreaterThanOrEqual(3);
    expect.soft(collectionArchetypes.size).toBeGreaterThanOrEqual(2);
    expect.soft(pdpArchetypes.size).toBeGreaterThanOrEqual(2);
    expect.soft(productCards.size).toBeGreaterThanOrEqual(2);
    expect.soft(responsiveModes.size).toBeGreaterThanOrEqual(2);
    expect.soft(artDirections.size).toBeGreaterThanOrEqual(2);

    const primary = ["premium-editorial", "modern-technical", "minimal-commerce"];
    for (let left = 0; left < primary.length; left += 1) {
      for (let right = left + 1; right < primary.length; right += 1) {
        const first = exactByFamily.get(primary[left])!;
        const second = exactByFamily.get(primary[right])!;
        expect
          .soft(
            first.filter((value, index) => value !== second[index]).length,
            `${primary[left]}/${primary[right]} must differ materially`,
          )
          .toBeGreaterThanOrEqual(4);
      }
    }
    expect
      .soft(exactByFamily.get("premium-editorial"))
      .not.toEqual(exactByFamily.get("image-rich-editorial"));
    expect(canonicalValueString(base.fixture.planningInput.draft)).toBe(before);
  }, 600_000);

  it("gives every advertised direct or compound semantic driver an exact causal witness", () => {
    const fixture = testAuthority([], "aurum");
    const prepared = prepareSemanticStorefrontDesignCompilationAuthority({
      originalRequest: fixture.request,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      semanticCapabilityIndex: fixture.semanticCapabilityIndex,
    });
    const baseline = promptFamilies[2].drivers;
    const cases = {
      commercialPosture: {
        driver: "commercialPosture",
        path: "commercialPosture",
        values: deterministicDriverValues.commercialPosture,
        selected: (decision: Decision) =>
          `${decision.designDna.authorityFingerprint}:${decision.designDna.directionId}`,
      },
      "globalVisualIntent.density": {
        driver: "density",
        baseline: {
          ...technicalDrivers,
          navigationPosture: "editorial",
          mobileHierarchy: "story-led",
        },
        path: "globalVisualIntent.density",
        values: deterministicDriverValues.density,
        selected: (decision: Decision) =>
          `${decision.exactSelection.designSystemSpacingDensity}:${decision.designDna.authorityFingerprint}`,
      },
      "sharedFrameIntent.navigationPosture": {
        driver: "navigationPosture",
        baseline: technicalDrivers,
        path: "sharedFrameIntent.navigationPosture",
        values: deterministicDriverValues.navigationPosture,
        selected: (decision: Decision) => decision.sharedFrame.profileId,
      },
      "homepageIntent.storyCatalogueBalance": {
        driver: "storyCatalogueBalance",
        baseline: {
          ...premiumDrivers,
          commercialPosture: "high-consideration",
          density: "balanced",
          navigationPosture: "minimal",
        },
        path: "homepageIntent.storyCatalogueBalance",
        values: deterministicDriverValues.storyCatalogueBalance,
        selected: (decision: Decision) => decision.profiles.homepage.profileId,
      },
      "collectionIntent.discoveryPosture": {
        driver: "discoveryPosture",
        path: "collectionIntent.discoveryPosture",
        values: deterministicDriverValues.discoveryPosture,
        selected: (decision: Decision) =>
          `${decision.profiles.collection.profileId}:${decision.profiles.search.profileId}:${decision.dynamicCommerceSelection.collectionArchetypeId}:${decision.dynamicCommerceSelection.searchArchetypeId}:${decision.productCardAnatomyIds.join("|")}`,
      },
      "pdpIntent.configurableProductPosture": {
        driver: "configurableProductPosture",
        baseline: minimalDrivers,
        path: "pdpIntent.configurableProductPosture",
        values: deterministicDriverValues.configurableProductPosture,
        selected: (decision: Decision) =>
          `${decision.profiles.productDetail.profileId}:${decision.dynamicCommerceSelection.configurableArchetypeId}`,
      },
      "responsiveAndArtDirectionIntent.mobileHierarchy": {
        driver: "mobileHierarchy",
        baseline: { ...technicalDrivers, navigationPosture: "catalogue" },
        path: "responsiveAndArtDirectionIntent.mobileHierarchy",
        values: deterministicDriverValues.mobileHierarchy,
        selected: (decision: Decision) => decision.sharedFrame.authorityFingerprint,
      },
      "responsiveAndArtDirectionIntent.imageProminence": {
        driver: "imageProminence",
        path: "responsiveAndArtDirectionIntent.imageProminence",
        values: deterministicDriverValues.imageProminence,
        selected: (decision: Decision) => decision.exactSelection.artDirectionPosture,
      },
    } as const;

    const selectableFields = fixture.semanticCapabilityIndex.semanticInfluenceAuthority.fields
      .filter(({ relationships }) =>
        relationships.some(({ mode }) => ["direct", "compound-driver"].includes(mode)),
      )
      .map(({ path }) => path)
      .sort();
    expect(fixture.semanticCapabilityIndex.semanticInfluenceAuthority.fields).toHaveLength(8);
    expect(selectableFields).toEqual(Object.keys(cases).sort());
    expect(fixture.request.semanticInfluenceAuthority).toEqual(
      fixture.semanticCapabilityIndex.semanticInfluenceAuthority,
    );
    const influenceByPath = new Map(
      fixture.semanticCapabilityIndex.semanticInfluenceAuthority.fields.map((field) => [
        field.path,
        field,
      ]),
    );
    expect(
      influenceByPath
        .get("sharedFrameIntent.navigationPosture")
        ?.relationships.find(({ exactAxisId }) => exactAxisId === "shared-frame"),
    ).toMatchObject({
      mode: "direct",
      reasonCode: "independent-exact-axis",
      providerDriverPath: "sharedFrameIntent.navigationPosture",
      coupledExactAxisIds: [],
      semanticValueCount: 4,
      exactValueCount: 4,
    });
    expect(
      influenceByPath
        .get("globalVisualIntent.density")
        ?.relationships.find(({ exactAxisId }) => exactAxisId === "spacing-density"),
    ).toMatchObject({
      mode: "compound-driver",
      reasonCode: "coupled-axis-provider-driver",
      providerDriverPath: "globalVisualIntent.density",
      coupledExactAxisIds: ["design-dna"],
      semanticValueCount: 3,
      exactValueCount: 4,
    });
    expect(
      influenceByPath
        .get("responsiveAndArtDirectionIntent.mobileHierarchy")
        ?.relationships.find(({ exactAxisId }) => exactAxisId === "frame-responsive-authority"),
    ).toMatchObject({
      mode: "compound-driver",
      reasonCode: "coupled-axis-provider-driver",
      providerDriverPath: "responsiveAndArtDirectionIntent.mobileHierarchy",
      coupledExactAxisIds: ["shared-frame"],
      semanticValueCount: 4,
      exactValueCount: 4,
    });
    expect(
      influenceByPath
        .get("responsiveAndArtDirectionIntent.imageProminence")
        ?.relationships.find(({ exactAxisId }) => exactAxisId === "art-direction-posture"),
    ).toMatchObject({
      mode: "compound-driver",
      reasonCode: "coupled-axis-provider-driver",
      providerDriverPath: "responsiveAndArtDirectionIntent.imageProminence",
      coupledExactAxisIds: [],
    });
    const driversByAxis = new Map<string, Set<string>>();
    for (const field of fixture.semanticCapabilityIndex.semanticInfluenceAuthority.fields) {
      expect(field.supportedValues.length).toBeGreaterThan(1);
      const drivers = field.relationships.filter(({ mode }) =>
        ["direct", "compound-driver"].includes(mode),
      );
      expect(drivers, `${field.path} must truthfully drive exact authority`).toHaveLength(1);
      for (const relationship of field.relationships) {
        expect(relationship.semanticValueCount).toBeGreaterThan(1);
        expect(relationship.exactValueCount).toBeGreaterThan(1);
        if (relationship.providerDriverPath !== null) {
          const axisDrivers = driversByAxis.get(relationship.exactAxisId) ?? new Set<string>();
          axisDrivers.add(relationship.providerDriverPath);
          driversByAxis.set(relationship.exactAxisId, axisDrivers);
        }
      }
    }
    expect([...driversByAxis.values()].every((drivers) => drivers.size === 1)).toBe(true);

    for (const field of selectableFields) {
      const causalCase = cases[field];
      expect(causalCase).toBeDefined();
      const exactValues = new Set<string>();
      const observations: string[] = [];
      for (const value of causalCase.values) {
        const drivers = {
          ...("baseline" in causalCase ? causalCase.baseline : baseline),
          [causalCase.driver]: value,
        } as SemanticDriverOverrides;
        const selected = causalCase.selected(
          compile(fixture, `causal-${field}-${value}`, drivers, prepared).compiledDecision,
        );
        exactValues.add(selected);
        observations.push(`${value}=${selected}`);
      }
      expect
        .soft(
          exactValues.size,
          `${causalCase.path} requires exact causal influence; observed ${observations.join(",")}`,
        )
        .toBeGreaterThan(1);
    }
  }, 300_000);

  it("does not use free-form concept-summary prose as a compatibility tie-break", () => {
    const fixture = testAuthority();
    const resolve = (designConceptSummary: string) =>
      resolveSemanticStorefrontCompatibility({
        request: fixture.request,
        intent: semanticIntentFixture(fixture.request, { designConceptSummary }),
        compatibilityInput: fixture.compatibilityInput,
        semanticCapabilityIndex: fixture.semanticCapabilityIndex,
        trustedCurrentAuthorityFingerprint: fixture.currentAuthorityFingerprint,
      });
    expect(resolve("A different safe concept summary.").selectedCandidateFingerprint).toBe(
      resolve("First safe concept summary.").selectedCandidateFingerprint,
    );
  });

  it("fails impossible authority with narrow stable error codes", () => {
    const fixture = testAuthority();
    const badHint = {
      ...fixture.request,
      trustedExactHints: {
        directionPackageId: "premium-editorial" as const,
        frameFamilyId: "compact-technical" as const,
      },
    };
    expect(() =>
      resolveSemanticStorefrontCompatibility({
        request: badHint,
        intent: semanticIntentFixture(badHint),
        compatibilityInput: fixture.compatibilityInput,
        semanticCapabilityIndex: fixture.semanticCapabilityIndex,
        trustedCurrentAuthorityFingerprint: fixture.currentAuthorityFingerprint,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid-trusted-hint" }));

    expect(() =>
      deriveSemanticCapabilityIndex({
        authority: fixture.compatibilityInput,
        currentAuthorityFingerprint: fixture.currentAuthorityFingerprint,
        maximumCandidateEvaluations: 1,
      }),
    ).toThrowError(expect.objectContaining({ code: "candidate-budget-exhausted" }));
    expect(() =>
      deriveSemanticCapabilityIndex({
        authority: fixture.compatibilityInput,
        currentAuthorityFingerprint: fixture.currentAuthorityFingerprint,
        maximumFactorEvaluations: 467,
      }),
    ).toThrowError(expect.objectContaining({ code: "candidate-budget-exhausted" }));
  });

  it("rejects a valid synthesis decision that is not fingerprint-bound to the compiled decision", () => {
    const fixture = testAuthority();
    const intent = providerIntent(fixture.request, "paired-synthesis-authority", premiumDrivers);
    const compileInput = {
      originalRequest: fixture.request,
      providerIntent: intent,
      currentRequestInput: fixture.currentRequestInput,
      compatibilityInput: fixture.compatibilityInput,
      semanticCapabilityIndex: fixture.semanticCapabilityIndex,
    };
    const compiled = compileSemanticStorefrontDesignIntentV1(compileInput);
    const expected = compiled.compiledDecision;
    const dynamic = expected.dynamicCommerceSelection;
    const { searchExecution: _searchExecution, productTypeMappings, ...dynamicSelection } = dynamic;
    void _searchExecution;
    const mismatchedSynthesisDecision = createBoundedStorefrontSynthesisDecision({
      ...fixture.compatibilityInput,
      request: {
        intent: "prompted-design-v2",
        deterministicSeed: "valid-but-not-compiled-for-this-decision",
      },
      exactSelection: expected.exactSelection,
      pageBlueprintSelectionOverrides: expected.pageBlueprintSelectionOverrides,
      approvedAssetRoleSelections: expected.approvedAssetRoleSelections,
      dynamicCommerceSelection: {
        ...dynamicSelection,
        productTypeMappings: Object.fromEntries(
          productTypeMappings.map(({ productTypeId, archetypeId }) => [productTypeId, archetypeId]),
        ),
      },
      promptedExecutionAuthority: {
        responsiveCapabilityKeys: expected.responsiveArtDirection.responsiveCapabilityKeys,
        artDirectionCapabilityKeys: expected.responsiveArtDirection.artDirectionCapabilityKeys,
        approvedAssetRoleKeys: expected.responsiveArtDirection.approvedAssetRoleKeys,
        desktopNarrativePriority: expected.narrative.desktopPriority,
        mobileNarrativePriority: expected.narrative.mobilePriority,
      },
    });

    expect(mismatchedSynthesisDecision.synthesisFingerprint).not.toBe(
      compiled.synthesisDecision.synthesisFingerprint,
    );
    expect(expected.exactAuthorityFingerprints).toContain(
      compiled.synthesisDecision.synthesisFingerprint,
    );
    expect(expected.exactAuthorityFingerprints).not.toContain(
      mismatchedSynthesisDecision.synthesisFingerprint,
    );
    expect(() =>
      executeCompiledSemanticStorefrontDesignIntentV1({
        ...compileInput,
        compiledDecision: expected,
        synthesisDecision: mismatchedSynthesisDecision,
        pageEvidenceAuthority: fixture.fixture.pageEvidenceAuthority,
        contentFactAuthority: fixture.fixture.contentFactAuthority,
        approvedAssetPresentations: fixture.fixture.approvedAssetPresentations,
      }),
    ).toThrowError(expect.objectContaining({ code: "stale-authority" }));
  });
});
