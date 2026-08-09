import { describe, expect, it } from "vitest";
import {
  getExecutablePageBlueprintProfile,
  listExecutablePageBlueprintProfiles,
  materializeExecutablePageBlueprint,
  sharedStorefrontFrameProfile,
  validateExecutablePageBlueprintRealization,
  type ExecutablePageBlueprintMaterializationError,
} from "@/application/storefront-templates";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";

function requiredProfile(profileId: string) {
  const profile = getExecutablePageBlueprintProfile(profileId);
  if (!profile) throw new Error(`Missing registered profile ${profileId}.`);
  return profile;
}

function bindingsFor(pageType: string) {
  return pageType === "home"
    ? (["navigation", "projectBrandContext", "collectionList", "productList"] as const)
    : pageType === "collection"
      ? (["collection", "productList"] as const)
      : pageType === "product"
        ? (["product"] as const)
        : ([] as const);
}

function materialize(profileId: string) {
  const pagePlan = requiredProfile(profileId);
  return materializeExecutablePageBlueprint({
    pagePlan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: bindingsFor(pagePlan.pageType),
  });
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return (error as ExecutablePageBlueprintMaterializationError).code;
  }
  return undefined;
}

describe("P10A-03 executable PageBlueprint profiles", () => {
  it("registers a shared frame plus deterministic commercial and page-family profiles", () => {
    expect(sharedStorefrontFrameProfile).toMatchObject({
      id: "blueprint-shared-storefront-frame",
      version: "1.0.0",
      requiredBindingCategories: ["navigation"],
    });
    const profiles = listExecutablePageBlueprintProfiles();
    expect(profiles).toHaveLength(18);
    expect(
      profiles.filter((plan) => plan.profile?.id.startsWith("blueprint-site-map-")),
    ).toHaveLength(9);
    expect(
      profiles.every(
        (plan) => plan.profile?.version === "1.0.0" && plan.profile.scope === plan.pageType,
      ),
    ).toBe(true);
  });

  it("materializes exact registered role and component order without unstable output", () => {
    const first = materialize("blueprint-brand-led-home");
    const second = materialize("blueprint-brand-led-home");
    expect(first).toEqual(second);
    expect(first.roleOrder).toEqual([
      "trust",
      "orientation",
      "orientation",
      "secondary-discovery",
      "campaign",
      "brand-story",
      "primary-discovery",
      "brand-proof",
      "trust",
      "continuation",
      "service",
    ]);
    expect(first.slots.map(({ component, variant }) => [component, variant])).toEqual([
      ["announcementBar", "singleLine"],
      ["header", "transparent"],
      ["homepageHero", "fullBleedOverlay"],
      ["homepageFeaturedCollections", "imageLed"],
      ["homepagePromotion", "imageLed"],
      ["homepageEditorial", "lookbookGallery"],
      ["homepageFeaturedProducts", "editorial"],
      ["homepageProof", "quoteSpotlight"],
      ["homepageTrust", "minimal"],
      ["newsletter", "inline"],
      ["footer", "editorial"],
    ]);
  });

  it.each([
    [
      "blueprint-brand-led-collection",
      "collection",
      ["orientation", "orientation", "secondary-discovery", "primary-discovery", "service"],
    ],
    [
      "blueprint-brand-led-product",
      "product",
      [
        "orientation",
        "product-focus",
        "conversion",
        "product-focus",
        "brand-proof",
        "brand-story",
        "continuation",
        "service",
      ],
    ],
  ] as const)("materializes the registered %s role order", (profileId, pageType, roleOrder) => {
    const materialized = materialize(profileId);
    expect(materialized.pageType).toBe(pageType);
    expect(materialized.roleOrder).toEqual(roleOrder);
    expect(materialized.fingerprint).toMatch(/^page-blueprint-/);
  });

  it("fails closed for unknown profiles, future versions, invalid profile structure, parameters, and bindings", () => {
    const base = requiredProfile("blueprint-balanced-home");
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: { ...structuredClone(base), profile: undefined },
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: bindingsFor(base.pageType),
        }),
      ),
    ).toBe("unknown-profile");

    const future = structuredClone(base);
    future.profile!.version = "2.0.0";
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: future,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: bindingsFor(future.pageType),
        }),
      ),
    ).toBe("unsupported-profile-version");

    const malformed = structuredClone(base);
    malformed.profile!.orderedNarrativeRoles.reverse();
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: malformed,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: bindingsFor(malformed.pageType),
        }),
      ),
    ).toBe("invalid-profile");

    const arbitraryParameter = structuredClone(base);
    arbitraryParameter.profile!.parameterDefaults = { rawCss: "display:grid" };
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: arbitraryParameter,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: bindingsFor(arbitraryParameter.pageType),
        }),
      ),
    ).toBe("invalid-parameter");

    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: base,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: [],
        }),
      ),
    ).toBe("missing-required-binding");

    const omittedBindings: unknown = {
      pagePlan: base,
      componentDefinitions: veskifyComponentDefinitionsV2,
    };
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint(
          omittedBindings as Parameters<typeof materializeExecutablePageBlueprint>[0],
        ),
      ),
    ).toBe("missing-required-binding");

    const collection = requiredProfile("blueprint-brand-led-collection");
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: collection,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: ["collection"],
        }),
      ),
    ).toBe("missing-required-binding");

    const product = requiredProfile("blueprint-brand-led-product");
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: product,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: [],
        }),
      ),
    ).toBe("missing-required-binding");

    const unknownAssetRole = structuredClone(base);
    unknownAssetRole.profile!.requiredAssetRoles = ["staleAssetRole"] as never;
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: unknownAssetRole,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: bindingsFor(unknownAssetRole.pageType),
        }),
      ),
    ).toBe("invalid-profile");

    const incompatibleAssetRole = structuredClone(base);
    incompatibleAssetRole.profile!.requiredAssetRoles = ["supportingContentImage"];
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: incompatibleAssetRole,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: bindingsFor(incompatibleAssetRole.pageType),
        }),
      ),
    ).toBe("incompatible-component");
  });

  it("resolves profile defaults at PageBlueprint authority without inventing instance overrides", () => {
    const profile = structuredClone(requiredProfile("blueprint-balanced-home"));
    profile.profile!.parameterDefaults = { sectionOrder: "registered", layoutModel: "grid" };
    const materialized = materializeExecutablePageBlueprint({
      pagePlan: profile,
      componentDefinitions: veskifyComponentDefinitionsV2,
      availableBindingCategories: [
        "navigation",
        "projectBrandContext",
        "collectionList",
        "productList",
      ],
      brandSystemParameterValues: { spacingScale: "compact" },
    });
    expect(
      materialized.slots.every((slot) => slot.boundedParameters.sectionOrder === "registered"),
    ).toBe(true);
    expect(materialized.slots.every((slot) => slot.boundedParameters.layoutModel === "grid")).toBe(
      true,
    );
    expect(
      materialized.slots.every((slot) => slot.boundedParameters.spacingScale === "compact"),
    ).toBe(true);
  });

  it.each(["blueprint-brand-led-collection", "blueprint-brand-led-product"])(
    "rejects a final %s composition when required commerce roles are omitted",
    (profileId) => {
      const pagePlan = requiredProfile(profileId);
      const materialization = materialize(profileId);
      const survivingSections = materialization.slots
        .filter((slot) => slot.component === "header" || slot.component === "footer")
        .map((slot) => ({ component: slot.component, variant: slot.variant }));
      expect(
        errorCode(() =>
          validateExecutablePageBlueprintRealization({
            pagePlan,
            materialization,
            componentDefinitions: veskifyComponentDefinitionsV2,
            sections: survivingSections,
          }),
        ),
      ).toBe("invalid-composition");
    },
  );
});
