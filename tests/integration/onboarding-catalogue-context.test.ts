import { describe, expect, it } from "vitest";
import {
  mapBriefCatalogueContext,
  planStorefrontTemplateSelection,
} from "@/application/storefront-templates";
import {
  catalogueContextValues,
  createStorefrontDesignBriefFingerprint,
  normalizeStorefrontDesignBriefInput,
} from "@/domain/design-brief";

function brief(catalogueContext: (typeof catalogueContextValues)[number]) {
  return normalizeStorefrontDesignBriefInput({
    id: "brief_onboarding_catalogue_context",
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: "Aurum Nordic",
      shortDescription: "A Helsinki jewellery studio.",
      industry: "jewellery",
      targetCustomer: "Customers looking for Nordic jewellery.",
      primaryMarket: "Finland",
    },
    brandDirection: { visualStyleDirection: "editorial" },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en"], primaryLanguage: "en" },
    catalogueContext,
    generationPreferences: {},
  });
}

describe("O-06 catalogue context downstream handoff", () => {
  it("keeps every canonical context in the brief and distinguishes it in P3-06", () => {
    const plans = catalogueContextValues.map((catalogueContext) => {
      const currentBrief = brief(catalogueContext);
      return {
        catalogueContext,
        fingerprint: createStorefrontDesignBriefFingerprint(currentBrief),
        plannerContext: mapBriefCatalogueContext(catalogueContext),
        selection: planStorefrontTemplateSelection({ brief: currentBrief }),
      };
    });

    expect(plans.map((item) => item.catalogueContext)).toEqual([...catalogueContextValues]);
    expect(new Set(plans.map((item) => item.fingerprint)).size).toBe(3);
    expect(plans.map((item) => item.selection.briefFingerprint)).toHaveLength(3);
    expect(plans.map((item) => item.plannerContext)).toEqual(["existing", "demo", "empty"]);
  });

  it("keeps exact detached equivalents fingerprint-identical and changes only context when selected", () => {
    const first = brief("controlled-demo-catalogue");
    const detachedEquivalent = structuredClone(first);
    const changed = { ...first, catalogueContext: "empty-catalogue" as const };

    expect(createStorefrontDesignBriefFingerprint(first)).toBe(
      createStorefrontDesignBriefFingerprint(detachedEquivalent),
    );
    expect(createStorefrontDesignBriefFingerprint(first)).not.toBe(
      createStorefrontDesignBriefFingerprint(changed),
    );
  });
});
