import { describe, expect, it } from "vitest";
import {
  executablePageBlueprintProfileSchema,
  getExecutablePageBlueprintProfile,
  listExecutablePageBlueprintProfiles,
  materializeExecutablePageBlueprint,
  validateNarrativeComposition,
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
import { createComponentCapabilityManifestAuthority } from "@/domain/component-platform";

type BindingCategory = Parameters<
  typeof materializeExecutablePageBlueprint
>[0]["availableBindingCategories"][number];

function manifest() {
  return skillCapabilityKnowledge.getManifestReference();
}

function cloneDefinitions() {
  return veskifyComponentDefinitionsV2.map((definition) => structuredClone(definition));
}

function registeredProfiles() {
  return listExecutablePageBlueprintProfiles().map((pagePlan) => {
    if (!pagePlan.profile) throw new Error(`Missing registered profile for ${pagePlan.pageType}.`);
    return pagePlan.profile;
  });
}

function cloneProfiles() {
  return registeredProfiles().map((profile) => structuredClone(profile));
}

function createAuthority(
  componentDefinitions: readonly unknown[] = veskifyComponentDefinitionsV2,
  executableProfiles: readonly unknown[] = registeredProfiles(),
) {
  return createComponentCapabilityManifestAuthority({
    componentDefinitions,
    executableProfiles,
    validateExecutableProfile: (profile) => executablePageBlueprintProfileSchema.parse(profile),
  });
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
  return { profile, component, slotId: component.slotId, variant };
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
    const { profile, component, slotId } = requiredHomeSelection();

    expect(
      errorCode(() =>
        skillCapabilityKnowledge.resolveSelection({
          manifest: manifest(),
          profileId: "invented-profile",
          slotId,
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
          slotId,
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
          slotId,
          componentType: component.componentType,
          variant: "invented-variant",
        }),
      ),
    ).toBe("unknownVariant");
  });

  it("validates profile/component/variant selections through the registered executable profile", () => {
    const { profile, component, slotId, variant } = requiredHomeSelection();
    const resolved = skillCapabilityKnowledge.resolveSelection({
      manifest: manifest(),
      profileId: profile.profileId,
      slotId,
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
      (selection) => selection.slotId === resolved.slotId,
    );
    expect(resolved.component.pageBlueprintCompatibility.policy).toBe("anyRegistered");
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
    const { profile, component, slotId, variant } = requiredHomeSelection();
    const context = skillCapabilityKnowledge.createProviderCapabilityContext({
      manifest: manifest(),
      selections: [
        {
          profileId: profile.profileId,
          slotId,
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

  it("fails closed when a page-type query conflicts with its executable profile", () => {
    const reference = manifest();
    const homeProfile = skillCapabilityKnowledge.listExecutableProfiles({
      manifest: reference,
      pageType: "home",
    })[0];
    const collectionProfile = skillCapabilityKnowledge.listExecutableProfiles({
      manifest: reference,
      pageType: "collection",
    })[0];
    if (!homeProfile || !collectionProfile) {
      throw new Error("Expected registered home and collection profiles.");
    }

    const matchingHomeComponents = skillCapabilityKnowledge.listCompatibleComponents({
      manifest: reference,
      pageType: "home",
      profileId: homeProfile.profileId,
    });
    expect(matchingHomeComponents.map((component) => component.componentType)).toEqual(
      expect.arrayContaining(["header", "footer"]),
    );
    expect(
      errorCode(() =>
        skillCapabilityKnowledge.listCompatibleComponents({
          manifest: reference,
          pageType: "product",
          profileId: homeProfile.profileId,
        }),
      ),
    ).toBe("incompatibleProfilePageType");
    expect(
      errorCode(() =>
        skillCapabilityKnowledge.listCompatibleComponents({
          manifest: reference,
          pageType: "home",
          profileId: collectionProfile.profileId,
        }),
      ),
    ).toBe("incompatibleProfilePageType");
    expect(
      errorCode(() =>
        skillCapabilityKnowledge.listCompatibleComponents({
          manifest: reference,
          profileId: "unknown-profile",
        }),
      ),
    ).toBe("unknownProfile");

    const unsupportedPageType = {
      manifest: reference,
      pageType: "home",
    } satisfies Parameters<typeof skillCapabilityKnowledge.listCompatibleComponents>[0];
    Reflect.set(unsupportedPageType, "pageType", "unsupported-page-type");
    expect(() => skillCapabilityKnowledge.listCompatibleComponents(unsupportedPageType)).toThrow(
      expect.objectContaining({ code: "unsupportedPageType" }),
    );
  });

  it("resolves component selections by slot so repeated components retain their registered variants", () => {
    const definitions = cloneDefinitions();
    const profiles = cloneProfiles();
    const homeProfile = profiles.find((profile) => profile.scope === "home");
    const heroDefinition = definitions.find((definition) => definition.type === "hero");
    const heroSelection = homeProfile?.componentSelections.find(
      (selection) => selection.component === "hero",
    );
    const repeatedHeroSlot = homeProfile?.componentSelections.find(
      (selection) => selection.component !== "hero",
    );
    const alternateVariant = heroDefinition?.variants.find(
      (variant) => variant.id !== heroSelection?.defaultVariant,
    )?.id;
    if (!homeProfile || !heroSelection || !repeatedHeroSlot || !alternateVariant) {
      throw new Error("Expected registered home hero selections and variants.");
    }
    Reflect.set(repeatedHeroSlot, "component", "hero");
    Reflect.set(repeatedHeroSlot, "variants", [alternateVariant]);
    Reflect.set(repeatedHeroSlot, "defaultVariant", alternateVariant);

    const consumer = createSkillCapabilityKnowledgeConsumer(createAuthority(definitions, profiles));
    const reference = consumer.getManifestReference();
    const primary = consumer.resolveSelection({
      manifest: reference,
      profileId: homeProfile.id,
      slotId: heroSelection.slotId,
      componentType: "hero",
      variant: heroSelection.defaultVariant,
    });
    const repeated = consumer.resolveSelection({
      manifest: reference,
      profileId: homeProfile.id,
      slotId: repeatedHeroSlot.slotId,
      componentType: "hero",
      variant: alternateVariant,
    });

    expect(primary.slotId).toBe(heroSelection.slotId);
    expect(primary.variant).toBe(heroSelection.defaultVariant);
    expect(repeated.slotId).toBe(repeatedHeroSlot.slotId);
    expect(repeated.variant).toBe(alternateVariant);
    expect(
      errorCode(() =>
        consumer.resolveSelection({
          manifest: reference,
          profileId: homeProfile.id,
          slotId: "missing-slot",
          componentType: "hero",
          variant: heroSelection.defaultVariant,
        }),
      ),
    ).toBe("unknownSlot");
    expect(
      errorCode(() =>
        consumer.resolveSelection({
          manifest: reference,
          profileId: homeProfile.id,
          slotId: heroSelection.slotId,
          componentType: "header",
          variant: "minimal",
        }),
      ),
    ).toBe("incompatibleProfileComponent");
  });

  it("preserves the canonical listed PageBlueprint compatibility policy", () => {
    const definitions = cloneDefinitions();
    const profiles = cloneProfiles();
    const homeProfile = profiles.find((profile) => profile.scope === "home");
    const otherProfile = profiles.find((profile) => profile.scope === "collection");
    const selection = homeProfile?.componentSelections[0];
    const definition = definitions.find((candidate) => candidate.type === selection?.component);
    if (!homeProfile || !otherProfile || !selection || !definition) {
      throw new Error("Expected registered profiles and a component selection.");
    }
    Reflect.set(definition.designCompatibility, "blueprintProfilePolicy", "listed");
    Reflect.set(definition.designCompatibility, "compatibleBlueprintProfileIds", [otherProfile.id]);

    const consumer = createSkillCapabilityKnowledgeConsumer(createAuthority(definitions, profiles));
    const reference = consumer.getManifestReference();
    expect(
      errorCode(() =>
        consumer.resolveSelection({
          manifest: reference,
          profileId: homeProfile.id,
          slotId: selection.slotId,
          componentType: definition.type,
          variant: selection.defaultVariant,
        }),
      ),
    ).toBe("incompatibleProfileComponent");
    expect(
      consumer
        .listCompatibleComponents({ manifest: reference })
        .find((component) => component.componentType === definition.type)
        ?.pageBlueprintCompatibility,
    ).toEqual({ policy: "listed", profileIds: [otherProfile.id] });

    const pagePlan = listExecutablePageBlueprintProfiles().find(
      (candidate) => candidate.profile?.id === homeProfile.id,
    );
    if (!pagePlan) throw new Error("Expected the P10A-03 homepage PageBlueprint.");
    const canonicalValidation = validateNarrativeComposition({
      pageType: "home",
      blueprintProfileId: homeProfile.id,
      pageBlueprint: pagePlan,
      components: definitions,
      sections: pagePlan.slots.map((slot) => ({
        id: slot.id,
        component: slot.sectionType,
        variant: slot.defaultVariant,
        narrativeRole: slot.narrativeRole,
        visualWeight: slot.visualWeight,
        transitionIntent: slot.transitionIntent,
      })),
    });
    expect(canonicalValidation.issues.map((issue) => issue.code)).toContain(
      "PAGE_BLUEPRINT_COMPONENT_INCOMPATIBLE",
    );

    const staleDefinitions = cloneDefinitions();
    const staleDefinition = staleDefinitions.find(
      (candidate) => candidate.type === definition.type,
    );
    if (!staleDefinition) throw new Error("Expected the selected registered component.");
    Reflect.set(staleDefinition.designCompatibility, "blueprintProfilePolicy", "listed");
    Reflect.set(staleDefinition.designCompatibility, "compatibleBlueprintProfileIds", [
      "stale-profile",
    ]);
    expect(() => createAuthority(staleDefinitions)).toThrow(
      /unknown executable PageBlueprint profile/,
    );
  });

  it("projects complete required and optional asset-slot capability contracts immutably", () => {
    const homeCapabilities = skillCapabilityKnowledge.listCompatibleComponents({
      manifest: manifest(),
      pageType: "home",
    });
    const liveBrandStory = homeCapabilities.find(
      (component) => component.componentType === "brandStory",
    );
    expect(liveBrandStory?.assetSlots).toContainEqual({
      slotId: "brandStoryMedia",
      acceptedRoles: ["editorialImage", "logo"],
      required: false,
      minItems: 0,
      maxItems: 1,
    });
    expect(
      homeCapabilities.find((component) => component.componentType === "homepageHero")?.assetSlots,
    ).toContainEqual(
      expect.objectContaining({
        slotId: "heroMedia",
        required: false,
        minItems: 0,
        maxItems: 1,
      }),
    );
    expect(
      skillCapabilityKnowledge
        .listCompatibleComponents({ manifest: manifest(), pageType: "collection" })
        .find((component) => component.componentType === "dynamicCollectionCommerce")?.assetSlots,
    ).toContainEqual(
      expect.objectContaining({
        slotId: "collectionCommerceMedia",
        required: false,
        minItems: 0,
        maxItems: 256,
      }),
    );

    const definitions = cloneDefinitions();
    const brandStory = definitions.find((definition) => definition.type === "brandStory");
    if (!brandStory) throw new Error("Expected the registered brandStory component.");
    Reflect.set(brandStory, "assetSlots", [
      {
        id: "brandStoryRequiredLogo",
        title: { en: "Required logo", fi: "Vaadittu logo" },
        acceptedRoles: ["logo"],
        required: true,
        minItems: 1,
        maxItems: 1,
      },
      ...brandStory.assetSlots,
    ]);
    const consumer = createSkillCapabilityKnowledgeConsumer(createAuthority(definitions));
    const projectedBrandStory = consumer
      .listCompatibleComponents({ manifest: consumer.getManifestReference(), pageType: "home" })
      .find((component) => component.componentType === "brandStory");
    if (!projectedBrandStory) throw new Error("Expected projected brandStory capability.");
    expect(projectedBrandStory.assetSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slotId: "brandStoryRequiredLogo",
          acceptedRoles: ["logo"],
          required: true,
          minItems: 1,
          maxItems: 1,
        }),
        expect.objectContaining({
          slotId: "brandStoryMedia",
          acceptedRoles: ["editorialImage", "logo"],
          required: false,
          minItems: 0,
          maxItems: 1,
        }),
      ]),
    );
    expect(Reflect.set(projectedBrandStory.assetSlots[0], "required", false)).toBe(false);

    const unsupportedAssetDefinitions = cloneDefinitions();
    const unsupportedBrandStory = unsupportedAssetDefinitions.find(
      (definition) => definition.type === "brandStory",
    );
    if (!unsupportedBrandStory) throw new Error("Expected the registered brandStory component.");
    Reflect.set(unsupportedBrandStory.assetSlots[0], "acceptedRoles", ["invented-asset-role"]);
    expect(() => createAuthority(unsupportedAssetDefinitions)).toThrow();
  });
});
