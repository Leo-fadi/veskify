import { describe, expect, it } from "vitest";
import * as routeAuthority from "@/application/dynamic-commerce-routes";
import {
  DynamicCommerceRouteAuthorityError,
  resolveCollectionContextArchetype,
  resolveProductComplexityArchetype,
} from "@/application/dynamic-commerce-routes";
import {
  DynamicCommerceRouteAuthorityError as extractedError,
  dynamicCommerceRouteAuthorityErrorCodes,
} from "@/application/dynamic-commerce-routes/route-errors";
import {
  resolveCollectionContextArchetype as extractedCollectionResolution,
  resolveProductComplexityArchetype as extractedProductResolution,
  selectProductComplexityRule,
} from "@/application/dynamic-commerce-routes/route-selection";
import * as routeSelection from "@/application/dynamic-commerce-routes/route-selection";
import { createDynamicCommerceProductMatchContext } from "@/application/dynamic-commerce-routes/product-match-context";
import { migrateLegacyDynamicCommerceRoutes } from "@/application/dynamic-commerce-routes";
import { createLegacyDynamicCommerceRouteScenario } from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";

describe("AR-03A route selection boundary", () => {
  it("preserves facade identity while keeping the product selector internal", () => {
    expect(DynamicCommerceRouteAuthorityError).toBe(extractedError);
    expect(resolveProductComplexityArchetype).toBe(extractedProductResolution);
    expect(resolveCollectionContextArchetype).toBe(extractedCollectionResolution);
    expect(routeAuthority.dynamicCommerceRouteAuthorityErrorCodes).toBe(
      dynamicCommerceRouteAuthorityErrorCodes,
    );
    expect("selectProductComplexityRule" in routeAuthority).toBe(false);
    expect("selectCollectionContextRule" in routeSelection).toBe(false);
    expect(dynamicCommerceRouteAuthorityErrorCodes).toEqual([
      "missing-authority",
      "stale-authority",
      "unknown-route",
      "unknown-commerce-identity",
      "unknown-archetype",
      "stale-profile",
      "incompatible-shared-frame",
      "invalid-presentation",
    ]);
  });

  it("retains inclusive bounded matching, highest-priority selection, and typed failures", () => {
    const { catalogue, legacySnapshot } = createLegacyDynamicCommerceRouteScenario();
    const result = migrateLegacyDynamicCommerceRoutes(legacySnapshot, catalogue);
    if (result.status === "requires-decision")
      throw new Error("Expected migrated route authority.");
    const product = catalogue.products[0];
    const productContext = createDynamicCommerceProductMatchContext(product);
    const productRule = result.authority.productComplexityRules[0];
    const productRules = [
      {
        ...productRule,
        id: "inclusive-product",
        priority: 20,
        match: {
          optionStructure: "any" as const,
          optionGroupCount: {
            minimum: productContext.optionGroupCount,
            maximum: productContext.optionGroupCount,
          },
          mediaAvailability: "any" as const,
          highConsideration: "any" as const,
        },
      },
      { ...productRule, id: "lower-product", priority: 10 },
    ];
    expect(selectProductComplexityRule({ product, rules: productRules }).id).toBe(
      "inclusive-product",
    );

    const collectionRule = result.authority.collectionContextRules[0];
    const collectionContext = {
      depth: 0,
      productCount: 2,
      childCollections: false,
      campaignEvidence: false,
      merchandisingDensity: "standard" as const,
    };
    const collectionRules = [
      {
        ...collectionRule,
        id: "inclusive-collection",
        priority: 20,
        archetypeId: "inclusive-collection-archetype",
        match: {
          depth: { minimum: 0, maximum: 0 },
          productCount: { minimum: 2, maximum: 2 },
          childCollections: "any" as const,
          campaignEvidence: "any" as const,
          merchandisingDensity: "any" as const,
        },
      },
      {
        ...collectionRule,
        id: "lower-collection",
        priority: 10,
        archetypeId: "lower-collection-archetype",
        match: {
          childCollections: "any" as const,
          campaignEvidence: "any" as const,
          merchandisingDensity: "any" as const,
        },
      },
    ];
    expect(
      resolveCollectionContextArchetype({ context: collectionContext, rules: collectionRules }),
    ).toBe("inclusive-collection-archetype");

    expect(() => resolveProductComplexityArchetype({ product, rules: [] })).toThrow(extractedError);
    try {
      resolveProductComplexityArchetype({ product, rules: [] });
    } catch (error) {
      expect(error).toBeInstanceOf(extractedError);
      expect(error).toMatchObject({
        code: "invalid-presentation",
        message: "No registered product matching rule supports the current canonical context.",
      });
    }
  });
});
