import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createDynamicCommerceProductMatchContext,
  migrateLegacyDynamicCommerceRoutes,
  resolveProductComplexityArchetype,
} from "@/application/dynamic-commerce-routes";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { createRawKarvonenStorefrontFixture } from "@/data/demo/raw-karvonen-storefront-fixture";
import type { ProductDisplayModel } from "@/domain/catalogue";
import { createLegacyDynamicCommerceRouteScenario } from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";

function option(id: string) {
  return {
    id,
    type: "selection" as const,
    label: { en: id, fi: id },
    required: true,
    values: [
      { en: "One", fi: "Yksi" },
      { en: "Two", fi: "Kaksi" },
    ],
  };
}

function withOptions(product: ProductDisplayModel, count: number): ProductDisplayModel {
  return {
    ...structuredClone(product),
    variants: [],
    orderOptions: Array.from({ length: count }, (_, index) => option(`option_${index + 1}`)),
  };
}

describe("P10B-18B-04 bounded PDP quality authority", () => {
  it("classifies the dedicated product-context matrix without product-type rules", () => {
    const fixture = createP905aFreshMerchantFixture("modernTechnical");
    const simple = fixture.aggregate.catalogue.products.find(
      ({ variants }) => variants.length === 0,
    )!;
    const rich = createRawKarvonenStorefrontFixture().aggregate.catalogue.products.find(
      ({ images }) => images.length >= 3,
    )!;
    const simpleMulti = { ...structuredClone(simple), images: rich.images.slice(0, 2) };
    const light = withOptions(simpleMulti, 1);
    const moderate = withOptions(simpleMulti, 3);
    const complex = withOptions(simpleMulti, 4);
    const richConfigurable = withOptions(rich, 2);

    expect(createDynamicCommerceProductMatchContext(simple)).toMatchObject({
      optionStructure: "simple",
      configurationComplexity: "simple",
      mediaDepth: "sparse",
    });
    expect(createDynamicCommerceProductMatchContext(simpleMulti)).toMatchObject({
      optionStructure: "simple",
      mediaDepth: "standard",
    });
    expect(createDynamicCommerceProductMatchContext(light)).toMatchObject({
      optionGroupCount: 1,
      configurationComplexity: "light",
    });
    expect(createDynamicCommerceProductMatchContext(moderate)).toMatchObject({
      optionGroupCount: 3,
      configurationComplexity: "moderate",
    });
    expect(createDynamicCommerceProductMatchContext(complex)).toMatchObject({
      optionGroupCount: 4,
      configurationComplexity: "complex",
      decisionSupport: "high-consideration",
    });
    expect(createDynamicCommerceProductMatchContext(richConfigurable)).toMatchObject({
      optionStructure: "configurable",
      configurationComplexity: "moderate",
      mediaDepth: "rich",
    });
    expect(createDynamicCommerceProductMatchContext(simple, true).decisionSupport).toBe(
      "high-consideration",
    );
    expect(createDynamicCommerceProductMatchContext(simple, false).decisionSupport).toBe(
      "standard",
    );

    const source = readFileSync(
      "src/application/dynamic-commerce-routes/product-match-context.ts",
      "utf8",
    );
    expect(source).not.toMatch(/ring|jewellery|watch|aurum|karvonen/i);
  });

  it("routes ordinary, configurable and high-consideration facts and records the exact gallery frame gap", () => {
    const scenario = createLegacyDynamicCommerceRouteScenario();
    const migrated = migrateLegacyDynamicCommerceRoutes(
      scenario.legacySnapshot,
      scenario.catalogue,
    );
    if (migrated.status !== "migrated") throw new Error("Expected current dynamic authority.");
    const rules = migrated.authority.productComplexityRules;
    const simple = scenario.catalogue.products.find(
      ({ variants, orderOptions }) => variants.length === 0 && (orderOptions?.length ?? 0) === 0,
    )!;
    const rich = {
      ...structuredClone(simple),
      images: scenario.catalogue.products.flatMap(({ images }) => images).slice(0, 3),
    };
    const light = withOptions(simple, 1);
    const complex = withOptions(simple, 4);
    expect(resolveProductComplexityArchetype({ product: simple, rules })).toContain("standard");
    expect(resolveProductComplexityArchetype({ product: rich, rules })).toBe(
      "archetype_pdp_generic_fallback",
    );
    expect(rules.find(({ id }) => id === "product_rule_gallery")?.match).toMatchObject({
      optionStructure: "any",
      optionGroupCount: { minimum: 0, maximum: 3 },
      mediaCount: { minimum: 3, maximum: 100 },
      mediaDepth: "rich",
      highConsideration: "excluded",
    });
    expect(rules.find(({ id }) => id === "product_rule_configurable")?.match).toMatchObject({
      optionStructure: "configurable",
      configurationComplexity: "any",
    });
    expect(rules.find(({ id }) => id === "product_rule_options")?.match).toMatchObject({
      optionStructure: "configurable",
      configurationComplexity: "complex",
    });
    expect(rules.find(({ id }) => id === "product_rule_considered")?.match).toMatchObject({
      highConsideration: "required",
    });
    expect(createDynamicCommerceProductMatchContext(light).configurationComplexity).toBe("light");
    expect(createDynamicCommerceProductMatchContext(complex).decisionSupport).toBe(
      "high-consideration",
    );
  });
});
