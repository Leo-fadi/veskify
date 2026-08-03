import { describe, expect, it } from "vitest";
import {
  getExecutablePageBlueprintProfile,
  materializeExecutablePageBlueprint,
} from "@/application/storefront-templates";
import {
  createSkillCapabilityKnowledgeConsumer,
  listCurrentDesignSkillInventory,
  skillCapabilityKnowledge,
  SkillCapabilityKnowledgeError,
} from "@/application/design-skills";
import {
  veskifyComponentCapabilityManifest,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";

type BindingCategory = Parameters<
  typeof materializeExecutablePageBlueprint
>[0]["availableBindingCategories"][number];

function manifest() {
  return skillCapabilityKnowledge.getManifestReference();
}

function requiredHomeSelection() {
  const profile = skillCapabilityKnowledge.listExecutableProfiles({
    manifest: manifest(),
    pageType: "home",
  })[0];
  const component = profile?.componentSelections[0];
  if (!profile || !component) throw new Error("Expected a registered homepage capability.");
  const variant = component.defaultVariant;
  if (!variant) throw new Error("Expected a registered homepage component variant.");
  return { profile, component, variant };
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return error instanceof SkillCapabilityKnowledgeError ? error.code : "unexpected";
  }
  return undefined;
}

function bindingsFor(pageType: string): BindingCategory[] {
  if (pageType === "home") return ["navigation"];
  if (pageType === "collection") return ["collection", "productList"];
  if (pageType === "product") return ["product"];
  return [];
}

describe("P10A-05A skill capability knowledge boundary", () => {
  it("exposes immutable generated capability queries without renderer internals", () => {
    const reference = manifest();
    const profiles = skillCapabilityKnowledge.listExecutableProfiles({ manifest: reference });
    const components = skillCapabilityKnowledge.listCompatibleComponents({
      manifest: reference,
      pageType: "home",
      narrativeRole: "orientation",
    });

    expect(profiles.length).toBeGreaterThan(0);
    expect(components.length).toBeGreaterThan(0);
    expect(Object.isFrozen(reference)).toBe(true);
    expect(Object.isFrozen(profiles)).toBe(true);
    expect(Object.isFrozen(profiles[0])).toBe(true);
    expect(Object.isFrozen(components)).toBe(true);
    expect(Object.isFrozen(components[0])).toBe(true);
    expect(components[0]).not.toHaveProperty("renderer");
    expect(components[0]).not.toHaveProperty("contentSchema");
    expect(components[0]).not.toHaveProperty("propsSchema");
  });

  it("rejects unknown manifest versions and stale fingerprints before answering queries", () => {
    const reference = manifest();

    expect(
      errorCode(() =>
        skillCapabilityKnowledge.listExecutableProfiles({
          manifest: { ...reference, version: "999.0.0" },
        }),
      ),
    ).toBe("unknownManifestVersion");
    expect(
      errorCode(() =>
        skillCapabilityKnowledge.listCompatibleComponents({
          manifest: { ...reference, fingerprint: "component-capability-manifest-stale" },
        }),
      ),
    ).toBe("staleManifestFingerprint");
  });

  it("fails closed for invented profiles, components, and variants", () => {
    const { profile, component } = requiredHomeSelection();

    expect(
      errorCode(() =>
        skillCapabilityKnowledge.resolveSelection({
          manifest: manifest(),
          profileId: "invented-profile",
          componentType: component.componentType,
          variant: component.defaultVariant,
        }),
      ),
    ).toBe("unknownProfile");
    expect(
      errorCode(() =>
        skillCapabilityKnowledge.resolveSelection({
          manifest: manifest(),
          profileId: profile.profileId,
          componentType: "invented-component",
          variant: component.defaultVariant,
        }),
      ),
    ).toBe("unknownComponent");
    expect(
      errorCode(() =>
        skillCapabilityKnowledge.resolveSelection({
          manifest: manifest(),
          profileId: profile.profileId,
          componentType: component.componentType,
          variant: "invented-variant",
        }),
      ),
    ).toBe("unknownVariant");
  });

  it("validates profile/component/variant selections through the registered executable profile", () => {
    const { profile, component, variant } = requiredHomeSelection();
    const resolved = skillCapabilityKnowledge.resolveSelection({
      manifest: manifest(),
      profileId: profile.profileId,
      componentType: component.componentType,
      variant,
    });
    const pagePlan = getExecutablePageBlueprintProfile(resolved.profile.profileId);
    if (!pagePlan) throw new Error("Expected the P10A-03 executable profile.");
    const materialized = materializeExecutablePageBlueprint({
      pagePlan,
      componentDefinitions: veskifyComponentDefinitionsV2,
      availableBindingCategories: bindingsFor(resolved.profile.pageType),
    });

    const profileSelection = resolved.profile.componentSelections.find(
      (selection) => selection.componentType === resolved.component.componentType,
    );
    expect(profileSelection?.variants).toContain(variant);
    expect(materialized.slots).toContainEqual(
      expect.objectContaining({ component: resolved.component.componentType, variant }),
    );
  });

  it("does not let skill consumers mutate generated manifest or registry authority", () => {
    const { component } = requiredHomeSelection();
    const beforeFingerprint = veskifyComponentCapabilityManifest.manifest.fingerprint;
    const beforeVariant = veskifyComponentCapabilityManifest.getByComponentType(
      component.componentType,
    )?.defaultVariant;

    expect(Reflect.set(component, "componentType", "mutated-component")).toBe(false);
    expect(Reflect.set(component.variants, 0, "mutated-variant")).toBe(false);
    expect(component.componentType).not.toBe("mutated-component");
    expect(component.variants).not.toContain("mutated-variant");
    expect(veskifyComponentCapabilityManifest.manifest.fingerprint).toBe(beforeFingerprint);
    expect(
      veskifyComponentCapabilityManifest.getByComponentType(component.componentType)
        ?.defaultVariant,
    ).toBe(beforeVariant);
  });

  it("projects provider capability context without storefront, commerce, asset-instance, or renderer data", () => {
    const { profile, component, variant } = requiredHomeSelection();
    const context = skillCapabilityKnowledge.createProviderCapabilityContext({
      manifest: manifest(),
      selections: [
        {
          profileId: profile.profileId,
          componentType: component.componentType,
          variant,
        },
      ],
    });

    expect(context).toEqual({
      manifest: manifest(),
      profiles: [expect.objectContaining({ profileId: profile.profileId })],
      components: [expect.objectContaining({ componentType: component.componentType })],
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(context).not.toHaveProperty("storefront");
    expect(context).not.toHaveProperty("catalogue");
    expect(context).not.toHaveProperty("approvedAssetContext");
    expect(context.components[0]).not.toHaveProperty("renderer");
    expect(context.components[0]).not.toHaveProperty("protectedPaths");
    expect(context.components[0]).not.toHaveProperty("contentSchema");
    expect(JSON.stringify(context)).not.toContain("assetId");
    expect(JSON.stringify(context)).not.toContain("sku");
  });

  it("keeps the current eight-skill inventory complete, deterministic, and read-only", () => {
    const first = listCurrentDesignSkillInventory();
    const second = listCurrentDesignSkillInventory();

    expect(first).toEqual(second);
    expect(first.map((skill) => `${skill.id}@${skill.version}`)).toEqual([
      "addCampaignSection@1.0.0",
      "applyExactBrandPalette@1.0.0",
      "applyLuxuryStyle@1.0.0",
      "applyMinimalNordicStorefrontStyle@1.0.0",
      "applyMinimalNordicStyle@1.0.0",
      "applyRegisteredWholeStorefrontDirection@1.0.0",
      "applyWarmPremiumStorefrontStyle@1.0.0",
      "improveHero@1.0.0",
    ]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(Reflect.set(first[0], "id", "mutated-skill")).toBe(false);
  });

  it("accepts only a generated manifest authority rather than externally supplied manifest data", () => {
    const consumer = createSkillCapabilityKnowledgeConsumer();
    const reference = consumer.getManifestReference();

    expect(reference).toEqual(manifest());
    expect(
      errorCode(() =>
        consumer.createProviderCapabilityContext({
          manifest: { version: reference.version, fingerprint: "external-manifest-copy" },
          selections: [],
        }),
      ),
    ).toBe("staleManifestFingerprint");
  });
});
