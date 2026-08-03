import { describe, expect, it } from "vitest";
import {
  getExecutablePageBlueprintProfile,
  listExecutablePageBlueprintProfiles,
  materializeExecutablePageBlueprint,
  sharedStorefrontFrameProfile,
  type ExecutablePageBlueprintMaterializationError,
} from "@/application/storefront-templates";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";

function requiredProfile(profileId: string) {
  const profile = getExecutablePageBlueprintProfile(profileId);
  if (!profile) throw new Error(`Missing registered profile ${profileId}.`);
  return profile;
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
  it("registers a shared frame and deterministic home, collection, and product profiles", () => {
    expect(sharedStorefrontFrameProfile).toMatchObject({
      id: "blueprint-shared-storefront-frame",
      version: "1.0.0",
      requiredBindingCategories: ["navigation"],
    });
    expect(listExecutablePageBlueprintProfiles()).toHaveLength(9);
    expect(
      listExecutablePageBlueprintProfiles().every(
        (plan) => plan.profile?.version === "1.0.0" && plan.profile.scope === plan.pageType,
      ),
    ).toBe(true);
  });

  it("materializes exact registered role and component order without unstable output", () => {
    const home = requiredProfile("blueprint-brand-led-home");
    const first = materializeExecutablePageBlueprint({
      pagePlan: home,
      componentDefinitions: veskifyComponentDefinitionsV2,
    });
    const second = materializeExecutablePageBlueprint({
      pagePlan: home,
      componentDefinitions: veskifyComponentDefinitionsV2,
    });
    expect(first).toEqual(second);
    expect(first.roleOrder).toEqual([
      "trust",
      "orientation",
      "orientation",
      "secondary-discovery",
      "primary-discovery",
      "brand-story",
      "brand-proof",
      "continuation",
      "service",
    ]);
    expect(first.slots.map(({ component, variant }) => [component, variant])).toEqual([
      ["announcementBar", "singleLine"],
      ["header", "centered"],
      ["hero", "editorial"],
      ["featuredCategories", "editorialCards"],
      ["productGrid", "editorial"],
      ["brandStory", "editorial"],
      ["benefitIcons", "threeColumn"],
      ["newsletter", "inline"],
      ["footer", "columns"],
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
    const materialized = materializeExecutablePageBlueprint({
      pagePlan: requiredProfile(profileId),
      componentDefinitions: veskifyComponentDefinitionsV2,
    });
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
  });
});
