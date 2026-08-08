import { deepFreeze, type StorefrontTemplatePagePlan } from "./contract";

function baselineProfile(
  id: string,
  pageType: StorefrontTemplatePagePlan["pageType"],
): StorefrontTemplatePagePlan {
  return {
    pageType,
    slots: [],
    pageBlueprint: {
      allowedNarrativeRoles: ["orientation"],
      requiredNarrativeRoles: [],
      flowRuleIds: [],
      maxRepeatedRole: 1,
      maxRepeatedComponentFamily: 1,
      boundedParameterConstraints: [],
      responsiveParameterIds: [],
    },
    profile: {
      id,
      version: "1.0.0",
      scope: pageType,
      orderedNarrativeRoles: [],
      roleCardinality: [],
      componentSelections: [],
      parameterDefaults: {},
      requiredBindingCategories: [],
      requiredAssetRoles: [],
      responsiveBreakpoints: ["mobile", "tablet", "desktop", "wide"],
      accessibilityContract: "registered-component-contracts",
    },
  };
}

/**
 * Minimal executable PageBlueprint authority for site-map/page-family proof.
 * These profiles intentionally contain no component anatomy. P10B-03 and the
 * later commercial profile tasks own material presentation capabilities.
 */
export const pageFamilyBaselinePagePlans = deepFreeze([
  baselineProfile("blueprint-site-map-home-baseline", "home"),
  baselineProfile("blueprint-site-map-collection-baseline", "collection"),
  baselineProfile("blueprint-site-map-search-baseline", "collection"),
  baselineProfile("blueprint-site-map-product-baseline", "product"),
  baselineProfile("blueprint-site-map-content-baseline", "content"),
  baselineProfile("blueprint-site-map-campaign-baseline", "landing"),
  baselineProfile("blueprint-site-map-cart-baseline", "cart"),
  baselineProfile("blueprint-site-map-checkout-baseline", "checkout"),
  baselineProfile("blueprint-site-map-state-baseline", "content"),
] satisfies readonly StorefrontTemplatePagePlan[]);
