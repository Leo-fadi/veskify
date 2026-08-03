import { describe, expect, it } from "vitest";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import {
  p10a02ComponentCapabilityAudit,
  p10a02RendererTargets,
} from "../fixtures/p10a-02-repository-capability-audit";

describe("P10A-02 repository capability audit", () => {
  it("keeps every legacy renderer registration represented in the canonical V2 registry", () => {
    expect(p10a02ComponentCapabilityAudit.v1RegisteredComponentTypes).toHaveLength(19);
    expect(p10a02ComponentCapabilityAudit.v1TypesMissingV2Definition).toEqual([]);
    expect(p10a02ComponentCapabilityAudit.rendererTypesMissingV2Definition).toEqual([]);
  });

  it("keeps every V2 component type connected to either the legacy bridge or an all-surface renderer", () => {
    expect(p10a02ComponentCapabilityAudit.v2RegisteredComponentTypes).toHaveLength(25);
    expect(p10a02ComponentCapabilityAudit.v2RegisteredVariantCount).toBe(76);
    expect(p10a02ComponentCapabilityAudit.v2TypesMissingRegisteredRenderer).toEqual([]);
    expect(p10a02ComponentCapabilityAudit.v2TypesWithoutLegacyRegistryBridge).toEqual([
      "homepageCollectionNavigation",
      "homepageFeaturedCollections",
      "homepageFeaturedProducts",
      "homepageHero",
      "homepagePromotion",
      "homepageTrust",
    ]);
  });

  it("rejects duplicate family/variant identities and missing page-family compatibility", () => {
    const types = veskifyComponentDefinitionsV2.map((definition) => definition.type);
    expect(new Set(types).size).toBe(types.length);

    veskifyComponentDefinitionsV2.forEach((definition) => {
      const variants = definition.variants.map((variant) => variant.id);
      expect(new Set(variants).size, definition.type).toBe(variants.length);
      expect(definition.renderer.supportedTargets).toEqual(p10a02RendererTargets);
    });

    expect(p10a02ComponentCapabilityAudit.pageFamilyComponentCounts).toEqual({
      home: 16,
      collection: 6,
      product: 9,
    });
  });
});
