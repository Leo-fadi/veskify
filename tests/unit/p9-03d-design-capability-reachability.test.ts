// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildWholeStorefrontPlanningProviderRequest } from "@/application/whole-storefront-generation-plan";
import { storefrontDesignSystemV1 } from "@/application/storefront-design-system";
import { veskifyComponentRegistry } from "@/components/registry";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { canonicalValueString } from "@/domain/storefront";
import {
  createP903dComponentVariantInventory,
  p903dDesignCapabilityInventory,
} from "../fixtures/p9-03d-design-capability-inventory";
import { generateP905aScenarioFromBaseline } from "../helpers/p9-05a-generation-harness";

const directionIds = ["premiumEditorial", "modernTechnical", "warmApproachable"] as const;

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

    expect(registered).toHaveLength(76);
    expect(new Set(audited).size).toBe(audited.length);
    expect(audited).toEqual(registered);
    expect(
      p903dDesignCapabilityInventory.componentVariants.reduce<Record<string, number>>(
        (counts, record) => ({
          ...counts,
          [record.status]: (counts[record.status] ?? 0) + 1,
        }),
        {},
      ),
    ).toEqual({
      "fully reachable": 34,
      "planner-visible but lost during compilation": 8,
      "registered but unreachable": 16,
      "render-only": 18,
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

    expect(recipes).toHaveLength(9);
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
      const scenario = await generateP905aScenarioFromBaseline(directionId, "warmApproachable");
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

      expect(compiledHeader?.variant).toBe("centered");
      expect(compiledCollection?.variant).toBe(expected[directionId].collection);
      expect(compiledProduct?.variant).toBe(expected[directionId].product);
      expect(canonicalHeader?.variant).toBe(expected[directionId].header);
      expect(canonicalHero?.variant).toBe(expected[directionId].hero);
      expect(canonicalCollection?.variant).toBe(expected[directionId].collection);
      expect(canonicalProduct?.variant).toBe(expected[directionId].product);
    }
  }, 40_000);

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
  });
});
