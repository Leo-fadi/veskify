// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("server-only", () => ({}));

import { buildWholeStorefrontPlanningProviderRequest } from "@/application/whole-storefront-generation-plan";
import {
  storefrontDesignSystemV1,
  storefrontDesignSystemV1Schema,
} from "@/application/storefront-design-system";
import { veskifyComponentRegistry } from "@/components/registry";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  createP903dComponentVariantInventory,
  p903dDerivedComponentVariantCount,
  p903dDesignCapabilityInventory,
  preserveResponsiveRules,
  validateP903dComponentVariantInventory,
  validateP903dSystemCapabilityProvenance,
} from "../fixtures/p9-03d-design-capability-inventory";
import { generateP905aScenarioFromSelectedDirection } from "../helpers/p9-05a-generation-harness";

const directionIds = ["premiumEditorial", "modernTechnical", "warmApproachable"] as const;

const expectedComponentVariantStatusCounts = {
  "fully reachable": 29,
  "registered but unreachable": 20,
  "planner-visible but lost during compilation": 9,
  "render-only": 18,
} as const;

function componentVariantStatusCounts(
  records: typeof p903dDesignCapabilityInventory.componentVariants,
) {
  return records.reduce<Record<string, number>>(
    (counts, record) => ({
      ...counts,
      [record.status]: (counts[record.status] ?? 0) + 1,
    }),
    {},
  );
}

function refreshDesignSystemFingerprint(designSystem: typeof storefrontDesignSystemV1) {
  const material = Object.fromEntries(
    Object.entries(designSystem).filter(([key]) => key !== "fingerprint"),
  );
  designSystem.fingerprint = `storefront-design-system-${canonicalValueFingerprint(material)}`;
}

function documentedStatusCounts(documentation: string) {
  const rows = [
    ["Fully reachable", "fully reachable"],
    ["Registered but unreachable", "registered but unreachable"],
    ["Planner-visible but lost during compilation", "planner-visible but lost during compilation"],
    ["Render-only", "render-only"],
  ] as const;
  return Object.fromEntries(
    rows.map(([label, status]) => {
      const count = documentation.match(new RegExp(`\\| ${label}\\s+\\|\\s+(\\d+) \\|`))?.[1];
      if (!count) throw new Error(`P9-03D documentation does not report ${label}.`);
      return [status, Number(count)];
    }),
  );
}

describe("P9-03D design-capability reachability audit", () => {
  it("accounts for every registered component variant exactly once", () => {
    const registered = veskifyComponentDefinitionsV2
      .flatMap((definition) =>
        definition.variants.map(
          (variant) =>
            `component:${definition.type}@${definition.version.major}.${definition.version.minor}.${definition.version.patch}#${variant.id}`,
        ),
      )
      .sort();
    const audited = p903dDesignCapabilityInventory.componentVariants.map(
      (record) => record.canonicalId,
    );

    const documentation = readFileSync(
      resolve(process.cwd(), "docs/spec-addenda/P9-03D_DESIGN_CAPABILITY_REACHABILITY_AUDIT.md"),
      "utf8",
    );
    const documentedCount = Number(
      documentation.match(
        /V2 (?:registry|inventory) contains \*\*(\d+) component types and (\d+) component variants\*\*/,
      )?.[2],
    );
    const responsiveEvidence = p903dDesignCapabilityInventory.systemCapabilities.find(
      (record) => record.canonicalId === "responsive:375-768-1024-1440",
    );

    expect(p903dDerivedComponentVariantCount).toBe(registered.length);
    expect(documentedCount).toBe(p903dDerivedComponentVariantCount);
    expect(responsiveEvidence?.responsiveEvidenceVariantCount).toBe(
      p903dDerivedComponentVariantCount,
    );
    expect(new Set(audited).size).toBe(audited.length);
    expect(audited).toEqual(registered);
    validateP903dComponentVariantInventory(p903dDesignCapabilityInventory.componentVariants);
    const statusCounts = componentVariantStatusCounts(
      p903dDesignCapabilityInventory.componentVariants,
    );
    expect(statusCounts).toEqual(expectedComponentVariantStatusCounts);
    expect(Object.values(statusCounts).reduce((total, count) => total + count, 0)).toBe(
      p903dDerivedComponentVariantCount,
    );
  });

  it("keeps inventory, exact regression expectations and documentation status counts synchronized", () => {
    const documentation = readFileSync(
      resolve(process.cwd(), "docs/spec-addenda/P9-03D_DESIGN_CAPABILITY_REACHABILITY_AUDIT.md"),
      "utf8",
    );
    const inventoryCounts = componentVariantStatusCounts(
      p903dDesignCapabilityInventory.componentVariants,
    );

    expect(inventoryCounts).toEqual(expectedComponentVariantStatusCounts);
    expect(documentedStatusCounts(documentation)).toEqual(expectedComponentVariantStatusCounts);
    expect(Object.values(inventoryCounts).reduce((total, count) => total + count, 0)).toBe(
      p903dDerivedComponentVariantCount,
    );
  });

  it("rejects invalid partial remapping before evaluating audit reachability", () => {
    const invalidDesignSystem = structuredClone(storefrontDesignSystemV1);
    const modernTechnical = invalidDesignSystem.directions.find(
      (direction) => direction.id === "modernTechnical",
    );
    expect(modernTechnical).toBeDefined();
    modernTechnical!.componentSelections.header.variant = "editorial";
    refreshDesignSystemFingerprint(invalidDesignSystem);

    expect(() => storefrontDesignSystemV1Schema.parse(invalidDesignSystem)).toThrow(
      /coordinated component selection/i,
    );
    expect(() =>
      createP903dComponentVariantInventory({ designSystem: invalidDesignSystem }),
    ).toThrow(/coordinated component selection/i);
  });

  it("derives reachability from schema-valid coordinated remapping and rejects stale classifications", () => {
    const remappedDesignSystem = structuredClone(storefrontDesignSystemV1);
    const modernTechnical = remappedDesignSystem.directions.find(
      (direction) => direction.id === "modernTechnical",
    );
    expect(modernTechnical).toBeDefined();
    modernTechnical!.componentSelections.header.variant = "editorial";
    [
      modernTechnical!.homepageRecipeId,
      modernTechnical!.collectionRecipeId,
      modernTechnical!.productRecipeId,
    ].forEach((recipeId) => {
      const recipe = [
        ...remappedDesignSystem.homepageRecipes,
        ...remappedDesignSystem.collectionRecipes,
        ...remappedDesignSystem.productRecipes,
      ].find((candidate) => candidate.id === recipeId);
      const header = recipe?.sections.find((section) => section.component === "header");
      expect(header).toBeDefined();
      header!.variant = "editorial";
    });
    refreshDesignSystemFingerprint(remappedDesignSystem);
    const parsedRemapping = storefrontDesignSystemV1Schema.parse(remappedDesignSystem);

    const remapped = createP903dComponentVariantInventory({ designSystem: parsedRemapping });
    const header = (variant: string) =>
      remapped.find(
        (record) =>
          record.canonicalId.includes("component:header@") &&
          record.canonicalId.endsWith(`#${variant}`),
      );

    expect(header("editorial")?.status).toBe("fully reachable");
    expect(header("compact")?.status).toBe("registered but unreachable");
    validateP903dComponentVariantInventory(remapped, { designSystem: parsedRemapping });

    const stale = remapped.map((record) =>
      record.canonicalId.includes("component:header@") && record.canonicalId.endsWith("#compact")
        ? { ...record, status: "fully reachable" as const }
        : record,
    );
    expect(() =>
      validateP903dComponentVariantInventory(stale, { designSystem: parsedRemapping }),
    ).toThrow(/stale|fully reachable/i);
  });

  it("keeps legacy commerce replacement evidence distinct from coordinated direction selection", () => {
    [
      ["collectionHeader", "editorial"],
      ["filterBar", "horizontal"],
      ["productGallery", "thumbnails"],
      ["productInfo", "premium"],
      ["productOptions", "buttons"],
    ].forEach(([type, variant]) => {
      const record = p903dDesignCapabilityInventory.componentVariants.find(
        (candidate) =>
          candidate.canonicalId.includes(`component:${type}@`) &&
          candidate.canonicalId.endsWith(`#${variant}`),
      );
      expect(record?.plannerExposure.directionIds).toEqual([]);
      expect(record?.plannerExposure.blueprintIds.length).toBeGreaterThan(0);
      expect(record?.deterministicSelectionEvidence).toContain("planner:dynamic-page-replacement");
      expect(record?.proposalCompilerPreservation).toBe("dropped by dynamic-page replacement");
      expect(record?.status).toBe("planner-visible but lost during compilation");
    });
  });

  it("maps every page recipe and resolves every planner-exposed component ID", () => {
    const definitions = new Map(
      veskifyComponentDefinitionsV2.map((definition) => [definition.type, definition]),
    );
    const recipes = [
      ...storefrontDesignSystemV1.homepageRecipes,
      ...storefrontDesignSystemV1.collectionRecipes,
      ...storefrontDesignSystemV1.productRecipes,
    ];
    const recipeRecords = p903dDesignCapabilityInventory.systemCapabilities.filter((record) =>
      record.canonicalId.startsWith("page-recipe:"),
    );

    expect(recipeRecords).toHaveLength(recipes.length);
    expect(recipeRecords.map((record) => record.canonicalId).sort()).toEqual(
      recipes.map((recipe) => `page-recipe:${recipe.id}`).sort(),
    );
    recipes.forEach((recipe) => {
      recipe.sections.forEach((section) => {
        const definition = definitions.get(section.component);
        expect(definition, `${recipe.id}:${section.component}`).toBeDefined();
        expect(definition?.supportedPageTypes).toContain(recipe.pageType);
        expect(definition?.variants.map((variant) => variant.id)).toContain(section.variant);
      });
    });
  });

  it("reports the real-provider schema as registry-wide but selection as direction-bounded", () => {
    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    const request = buildWholeStorefrontPlanningProviderRequest(fixture.planningInput);

    expect(
      request.registry.flatMap((definition) =>
        definition.variants.map((variant) => `${definition.type}:${variant}`),
      ),
    ).toHaveLength(76);
    expect(request.directionOptions.map((direction) => direction.id)).toEqual(
      [...directionIds].sort(),
    );
    expect(request.directionOptions).toHaveLength(3);
    expect(request.expectedPlan.designSystemSelection.directionId).toBe("premiumEditorial");
  });

  it("proves dynamic variants compile directly while legacy direction variants are deferred", async () => {
    const expected = {
      premiumEditorial: {
        header: "transparent",
        hero: "fullBleed",
        collection: "editorial",
        product: "editorialSplit",
      },
      modernTechnical: {
        header: "compact",
        hero: "asymmetric",
        collection: "compact",
        product: "compact",
      },
      warmApproachable: {
        header: "centered",
        hero: "editorial",
        collection: "editorial",
        product: "balanced",
      },
    } as const;

    for (const directionId of directionIds) {
      const scenario = await generateP905aScenarioFromSelectedDirection(
        directionId,
        "warmApproachable",
      );
      const compiled = scenario.compiledProposal.proposedStorefront.pages.flatMap(
        (page) => page.components,
      );
      const canonical = scenario.proposal.proposedStorefront.pages.flatMap((page) => page.sections);
      const compiledHeader = compiled.find((component) => component.component === "header");
      const compiledCollection = compiled.find(
        (component) => component.component === "dynamicCollectionCommerce",
      );
      const compiledProduct = compiled.find(
        (component) => component.component === "dynamicProductDetail",
      );
      const canonicalHeader = canonical.find((section) => section.component === "header");
      const canonicalHero = canonical.find((section) => section.component === "hero");
      const canonicalCollection = canonical.find(
        (section) => section.component === "dynamicCollectionCommerce",
      );
      const canonicalProduct = canonical.find(
        (section) => section.component === "dynamicProductDetail",
      );

      expect(compiledHeader?.variant).toBe(expected[directionId].header);
      expect(compiledCollection?.variant).toBe(expected[directionId].collection);
      expect(compiledProduct?.variant).toBe(expected[directionId].product);
      expect(canonicalHeader?.variant).toBe(expected[directionId].header);
      expect(canonicalHero?.variant).toBe(expected[directionId].hero);
      expect(canonicalCollection?.variant).toBe(expected[directionId].collection);
      expect(canonicalProduct?.variant).toBe(expected[directionId].product);
    }
  }, 40_000);

  it("distinguishes announcement source retention from coordinated benefit-icons selection", () => {
    const record = (type: string, variant: string) =>
      p903dDesignCapabilityInventory.componentVariants.find(
        (candidate) =>
          candidate.canonicalId.includes(`component:${type}@`) &&
          candidate.canonicalId.endsWith(`#${variant}`),
      );
    const announcement = record("announcementBar", "singleLine");
    const benefitIcons = record("benefitIcons", "threeColumn");
    const modernTechnical = storefrontDesignSystemV1.directions.find(
      (direction) => direction.id === "modernTechnical",
    )!;
    const modernRecipe = storefrontDesignSystemV1.homepageRecipes.find(
      (recipe) => recipe.id === modernTechnical.homepageRecipeId,
    )!;

    expect(announcement?.proposalCompilerPreservation).toBe(
      "recipe variant is not compiled; source is retained",
    );
    expect(announcement?.canonicalSnapshotBoundary).toContain("no announcement selection");
    expect(Object.keys(modernTechnical.componentSelections)).not.toContain("announcement");
    expect(
      modernRecipe.sections.find((section) => section.component === "announcementBar")?.variant,
    ).toBe("singleLine");
    expect(benefitIcons?.proposalCompilerPreservation).toBe(
      "preserved by coordinated proposal compiler",
    );
    expect(benefitIcons?.canonicalSnapshotBoundary).toContain(
      "coordinatedRuntimeComponent applies the registered componentSelections entry",
    );
    expect(
      modernRecipe.sections.find((section) => section.component === "benefitIcons")?.variant,
    ).toBe("threeColumn");
    expect(modernTechnical.componentSelections.trust).toEqual({
      component: "benefitIcons",
      variant: "threeColumn",
    });
  });

  it("preserves complete responsive rules and keeps commerce contracts distinct", () => {
    const record = (type: string) =>
      p903dDesignCapabilityInventory.componentVariants.find((candidate) =>
        candidate.canonicalId.includes(`component:${type}@`),
      );
    const collectionRule = record("dynamicCollectionCommerce")?.responsiveContract[0];
    const productRule = record("dynamicProductDetail")?.responsiveContract[0];
    const minWidthRule = preserveResponsiveRules([
      {
        breakpoints: ["mobile", "tablet"],
        allowHorizontalOverflow: false,
        minWidthPx: 320,
        maxColumns: 1,
        notes: { en: "Minimum width", fi: "Vähimmäisleveys" },
      },
    ])[0];

    expect(collectionRule).toMatchObject({
      breakpoints: ["mobile", "tablet", "desktop", "wide"],
      allowHorizontalOverflow: false,
      maxColumns: 4,
    });
    expect(collectionRule?.notes?.en).toContain("375, 768, 1024 and 1440");
    expect(collectionRule?.notes?.fi).toContain("375, 768, 1024 ja 1440");
    expect(productRule).toMatchObject({ maxColumns: 2 });
    expect(productRule).not.toEqual(collectionRule);
    expect(minWidthRule).toMatchObject({
      minWidthPx: 320,
      maxColumns: 1,
      notes: { en: "Minimum width", fi: "Vähimmäisleveys" },
    });
  });

  it("identifies V2 homepage families as declared renderers without planner or Puck reachability", () => {
    const canonicalTypes = new Set(Object.keys(veskifyComponentRegistry));
    const routeBridgeGaps = p903dDesignCapabilityInventory.componentVariants.filter(
      (record) => record.status === "render-only",
    );

    expect(new Set(routeBridgeGaps.map((record) => record.canonicalId.split("@")[0]))).toEqual(
      new Set([
        "component:homepageHero",
        "component:homepageFeaturedCollections",
        "component:homepageFeaturedProducts",
        "component:homepageCollectionNavigation",
        "component:homepagePromotion",
        "component:homepageTrust",
      ]),
    );
    routeBridgeGaps.forEach((record) => {
      const type = record.canonicalId.slice("component:".length).split("@")[0];
      expect(canonicalTypes.has(type)).toBe(false);
      expect(record.editorRendering).toBe("declared renderer without route bridge");
      expect(record.previewRendering).toBe("declared renderer without route bridge");
      expect(record.publishedRendering).toBe("declared renderer without route bridge");
    });
  });

  it("is deterministic and distinguishes missing, incomplete and inaccessible capabilities", () => {
    const rerun = createP903dComponentVariantInventory();
    const systemById = new Map(
      p903dDesignCapabilityInventory.systemCapabilities.map((record) => [
        record.canonicalId,
        record,
      ]),
    );

    expect(canonicalValueString(rerun)).toBe(
      canonicalValueString(p903dDesignCapabilityInventory.componentVariants),
    );
    expect(systemById.get("border-treatment:direction-bundle")?.status).toBe("missing");
    expect(systemById.get("responsive:375-768-1024-1440")?.status).toBe("incomplete");
    expect(systemById.get("typography:modernSans")?.status).toBe("registered but unreachable");
    expect(systemById.get("page-recipe:productGallery")?.status).toBe("registered but unreachable");
    expect(systemById.get("responsive:375-768-1024-1440")?.responsiveEvidenceVariantCount).toBe(
      p903dDerivedComponentVariantCount,
    );
  });

  it("uses explicit capability provenance instead of a generic design-system source", () => {
    const systemCapabilities = p903dDesignCapabilityInventory.systemCapabilities;
    const byId = new Map(systemCapabilities.map((record) => [record.canonicalId, record]));
    const sources = (canonicalId: string) =>
      new Set(byId.get(canonicalId)?.provenance.map((provenance) => provenance.source));

    expect([...sources("localization:en-fi")]).toEqual(
      expect.arrayContaining([
        "src/domain/design-brief/storefront-design-brief.ts",
        "src/application/whole-storefront-generation-plan/planner.ts",
      ]),
    );
    expect([...sources("accessibility:registered-contracts")]).toEqual(
      expect.arrayContaining([
        "src/domain/component-platform/component-platform.ts",
        "src/components/registry/v2-registry.ts",
      ]),
    );
    validateP903dSystemCapabilityProvenance(systemCapabilities);
    expect(() =>
      validateP903dSystemCapabilityProvenance(
        systemCapabilities.map((record) =>
          record.canonicalId === "accessibility:registered-contracts"
            ? { ...record, provenance: [] }
            : record,
        ),
      ),
    ).toThrow(/missing/i);
    expect(() =>
      validateP903dSystemCapabilityProvenance([
        ...systemCapabilities.filter((record) => record.canonicalId !== "localization:en-fi"),
        {
          ...byId.get("localization:en-fi")!,
          provenance: [
            {
              source: "src/application/storefront-design-system/registry.ts",
              evidence: "Generic fallback",
            },
          ],
        },
      ]),
    ).toThrow(/inaccurate/i);
  });
});
