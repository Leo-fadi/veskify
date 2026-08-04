import { describe, expect, it } from "vitest";
import {
  executablePageBlueprintProfileSchema,
  listExecutablePageBlueprintProfiles,
  materializeExecutablePageBlueprint,
} from "@/application/storefront-templates";
import {
  veskifyComponentCapabilityManifest,
  veskifyComponentDefinitionsV2,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import {
  boundedParameterDefinitions,
  boundedParametersById,
  createComponentCapabilityManifestAuthority,
  protectedCommerceFieldPaths,
  serializeComponentCapabilityManifest,
} from "@/domain/component-platform";
import { adaptV1ComponentDefinitionToV2 } from "@/components/registry/v2-compatibility";
import { veskifyComponentRegistry } from "@/components/registry/registry";

function bindingCategoriesFor(pageType: string) {
  if (pageType === "home") {
    return ["navigation", "projectBrandContext", "collectionList", "productList"] as const;
  }
  if (pageType === "collection") return ["collection", "productList"] as const;
  if (pageType === "product") return ["product"] as const;
  return [] as const;
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

function definitionFor(componentType: string) {
  const definition = veskifyComponentDefinitionsV2.find(
    (candidate) => candidate.type === componentType,
  );
  if (!definition) throw new Error(`Missing registered component ${componentType}.`);
  return definition;
}

describe("P10A-04A generated component capability manifest", () => {
  it("projects every live registered component and variant exactly once without a manual inventory", () => {
    const liveTypes = veskifyComponentDefinitionsV2.map((definition) => definition.type).sort();
    const manifestEntries = veskifyComponentCapabilityManifest.manifest.entries;

    expect(manifestEntries.map((entry) => entry.componentType)).toEqual(liveTypes);
    expect(manifestEntries).toHaveLength(veskifyComponentDefinitionsV2.length);
    expect(manifestEntries.flatMap((entry) => entry.variants)).toHaveLength(
      veskifyComponentDefinitionsV2.reduce(
        (total, definition) => total + definition.variants.length,
        0,
      ),
    );

    for (const definition of veskifyComponentDefinitionsV2) {
      const entry = veskifyComponentCapabilityManifest.getByComponentType(definition.type);
      expect(entry).toBeDefined();
      expect(entry?.defaultVariant).toBe(definition.defaultVariant);
      expect(entry?.variants.map((variant) => variant.id)).toEqual(
        definition.variants.map((variant) => variant.id).sort(),
      );
    }
  });

  it("produces canonical ordering, serialization, and fingerprints for identical registry input", () => {
    const first = createAuthority();
    const reordered = createAuthority(
      [...veskifyComponentDefinitionsV2].reverse(),
      [...registeredProfiles()].reverse(),
    );

    expect(first.manifest.entries.map((entry) => entry.componentType)).toEqual(
      [...first.manifest.entries]
        .map((entry) => entry.componentType)
        .sort((left, right) => left.localeCompare(right)),
    );
    expect(serializeComponentCapabilityManifest(first.manifest)).toBe(
      serializeComponentCapabilityManifest(reordered.manifest),
    );
    expect(first.manifest.fingerprint).toBe(reordered.manifest.fingerprint);
    expect(first.manifest.entries.map((entry) => entry.fingerprint)).toEqual(
      reordered.manifest.entries.map((entry) => entry.fingerprint),
    );
  });

  it("changes the affected fingerprint when registered capability metadata changes", () => {
    const changedDefinitions = cloneDefinitions();
    Reflect.set(changedDefinitions[0].renderer, "exportName", "ManifestCapabilityChanged");
    const baseline = createAuthority();
    const changed = createAuthority(changedDefinitions);
    const type = changedDefinitions[0].type;

    expect(changed.manifest.fingerprint).not.toBe(baseline.manifest.fingerprint);
    expect(changed.getByComponentType(type)?.fingerprint).not.toBe(
      baseline.getByComponentType(type)?.fingerprint,
    );
  });

  it("projects registered executable profiles and fingerprints profile capability changes", () => {
    const authority = createAuthority();
    const changedProfiles = cloneProfiles();
    Reflect.set(changedProfiles[0], "version", "1.0.1");
    const changed = createAuthority(veskifyComponentDefinitionsV2, changedProfiles);

    expect(authority.manifest.profiles.map((profile) => profile.profileId)).toEqual(
      registeredProfiles()
        .map((profile) => profile.id)
        .sort(),
    );
    expect(authority.getByProfileId(changedProfiles[0].id)?.profileVersion).toBe("1.0.0");
    expect(changed.manifest.fingerprint).not.toBe(authority.manifest.fingerprint);
  });

  it("fails closed for missing, stale, and invalid executable profile capability references", () => {
    const missingProfile = cloneDefinitions();
    Reflect.set(missingProfile[0].designCompatibility, "blueprintProfilePolicy", "listed");
    Reflect.set(missingProfile[0].designCompatibility, "compatibleBlueprintProfileIds", [
      "unknown-profile",
    ]);
    expect(() => createAuthority(missingProfile)).toThrow(
      /unknown executable PageBlueprint profile/,
    );

    const staleComponentProfile = cloneProfiles();
    Reflect.set(staleComponentProfile[0].componentSelections[0], "component", "unknown-component");
    expect(() => createAuthority(veskifyComponentDefinitionsV2, staleComponentProfile)).toThrow(
      /references unknown component/,
    );

    const staleVariantProfile = cloneProfiles();
    Reflect.set(staleVariantProfile[0].componentSelections[0], "variants", ["unknown-variant"]);
    Reflect.set(staleVariantProfile[0].componentSelections[0], "defaultVariant", "unknown-variant");
    expect(() => createAuthority(veskifyComponentDefinitionsV2, staleVariantProfile)).toThrow(
      /references unknown .* variant/,
    );
  });

  it("canonicalizes set-like nested metadata without changing execution-ordered profile selections", () => {
    const firstDefinitions = cloneDefinitions();
    const reorderedDefinitions = cloneDefinitions();
    const firstBindingSlot = firstDefinitions.find(
      (definition) => definition.commerceBindingSlots.length > 0,
    )?.commerceBindingSlots[0];
    const reorderedBindingSlot = reorderedDefinitions.find(
      (definition) => definition.commerceBindingSlots.length > 0,
    )?.commerceBindingSlots[0];
    const firstAssetSlot = firstDefinitions.find((definition) => definition.assetSlots.length > 0)
      ?.assetSlots[0];
    const reorderedAssetSlot = reorderedDefinitions.find(
      (definition) => definition.assetSlots.length > 0,
    )?.assetSlots[0];
    if (!firstBindingSlot || !reorderedBindingSlot || !firstAssetSlot || !reorderedAssetSlot) {
      throw new Error("Expected registered binding and asset slots.");
    }
    Reflect.set(firstBindingSlot, "acceptedSourceTypes", ["asset", "navigation"]);
    Reflect.set(reorderedBindingSlot, "acceptedSourceTypes", ["navigation", "asset"]);
    Reflect.set(firstAssetSlot, "acceptedRoles", ["editorialImage", "logo"]);
    Reflect.set(reorderedAssetSlot, "acceptedRoles", ["logo", "editorialImage"]);

    const reorderedProfiles = cloneProfiles();
    const profileWithBindings = reorderedProfiles.find(
      (profile) => profile.requiredBindingCategories.length > 1,
    );
    if (!profileWithBindings)
      throw new Error("Expected a registered profile with binding categories.");
    Reflect.set(
      profileWithBindings,
      "requiredBindingCategories",
      [...profileWithBindings.requiredBindingCategories].reverse(),
    );

    expect(serializeComponentCapabilityManifest(createAuthority(firstDefinitions).manifest)).toBe(
      serializeComponentCapabilityManifest(
        createAuthority(reorderedDefinitions, reorderedProfiles).manifest,
      ),
    );
  });

  it("fails closed for duplicate identities and malformed closed-vocabulary metadata", () => {
    expect(() =>
      createAuthority([
        ...veskifyComponentDefinitionsV2,
        structuredClone(veskifyComponentDefinitionsV2[0]),
      ]),
    ).toThrow(/Duplicate ComponentDefinitionV2 identities/);

    const duplicateVariant = cloneDefinitions();
    Reflect.set(duplicateVariant[0], "variants", [
      ...duplicateVariant[0].variants,
      structuredClone(duplicateVariant[0].variants[0]),
    ]);
    expect(() => createAuthority(duplicateVariant)).toThrow(/variants must not contain duplicates/);

    const invalidPageType = cloneDefinitions();
    Reflect.set(invalidPageType[0], "supportedPageTypes", ["unknown-page-type"]);
    expect(() => createAuthority(invalidPageType)).toThrow();

    const invalidRole = cloneDefinitions();
    Reflect.set(invalidRole[0].designCompatibility, "allowedNarrativeRoles", ["unknown-role"]);
    expect(() => createAuthority(invalidRole)).toThrow();

    const invalidBinding = cloneDefinitions();
    const componentWithBinding = invalidBinding.find(
      (definition) => definition.commerceBindingSlots.length > 0,
    );
    if (!componentWithBinding) throw new Error("Expected a live component with a binding slot.");
    Reflect.set(componentWithBinding.commerceBindingSlots[0], "acceptedSourceTypes", [
      "unknown-binding",
    ]);
    expect(() => createAuthority(invalidBinding)).toThrow();

    const invalidAssetRole = cloneDefinitions();
    const componentWithAsset = invalidAssetRole.find(
      (definition) => definition.assetSlots.length > 0,
    );
    if (!componentWithAsset) throw new Error("Expected a live component with an asset slot.");
    Reflect.set(componentWithAsset.assetSlots[0], "acceptedRoles", ["unknown-asset-role"]);
    expect(() => createAuthority(invalidAssetRole)).toThrow();
  });

  it("projects all controlled capability metadata and preserves protected commerce boundaries", () => {
    for (const definition of veskifyComponentDefinitionsV2) {
      const entry = veskifyComponentCapabilityManifest.getByComponentType(definition.type);
      const registryDefinition = veskifyComponentRegistryV2.get(definition.type);
      if (!entry || !registryDefinition) {
        throw new Error(`Missing live component capability for ${definition.type}.`);
      }

      expect(entry.commerceBindingSlots).toEqual(
        definition.commerceBindingSlots
          .map((slot) => ({ ...slot, acceptedSourceTypes: [...slot.acceptedSourceTypes].sort() }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      );
      expect(entry.assetSlots).toEqual(
        definition.assetSlots
          .map((slot) => ({ ...slot, acceptedRoles: [...slot.acceptedRoles].sort() }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      );
      expect(entry.contentSlots).toEqual(
        [...definition.contentSlots].sort((left, right) => left.id.localeCompare(right.id)),
      );
      expect(entry.contentSchema.type).toBe(definition.contentSchema.type);
      expect(Object.keys(entry.contentSchema.properties).sort()).toEqual(
        Object.keys(definition.contentSchema.properties).sort(),
      );
      expect(Object.keys(entry.propsSchema.properties).sort()).toEqual(
        Object.keys(definition.propsSchema.properties).sort(),
      );
      expect(Object.keys(entry.styleOverridesSchema.properties).sort()).toEqual(
        Object.keys(definition.styleOverridesSchema.properties).sort(),
      );
      expect(entry.boundedParameters.map((parameter) => parameter.id)).toEqual(
        [...definition.designCompatibility.boundedParameterIds].sort(),
      );
      expect(
        entry.boundedParameters.every((parameter) => boundedParametersById.has(parameter.id)),
      ).toBe(true);
      expect(entry.responsiveRules).toEqual(
        definition.responsiveRules
          .map((rule) => ({ ...rule, breakpoints: [...rule.breakpoints].sort() }))
          .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
      );
      expect(entry.accessibilityRequirements).toEqual(definition.accessibilityRequirements);
      expect(entry.protectedPaths).toEqual(
        [
          ...new Set([...protectedCommerceFieldPaths, ...definition.protectedFields.readOnlyPaths]),
        ].sort(),
      );
      expect(registryDefinition.protectedFields).toEqual(definition.protectedFields);
      expect(registryDefinition.assetSlots).toEqual(definition.assetSlots);
    }
  });

  it("preserves OR semantics for required binding and asset slots", () => {
    const changedDefinitions = cloneDefinitions();
    const componentWithBinding = changedDefinitions.find(
      (definition) => definition.commerceBindingSlots.length > 0,
    );
    const componentWithAsset = changedDefinitions.find(
      (definition) => definition.assetSlots.length > 0,
    );
    if (!componentWithBinding || !componentWithAsset) {
      throw new Error("Expected registered binding and asset slots.");
    }
    const bindingSlot = componentWithBinding.commerceBindingSlots[0];
    const assetSlot = componentWithAsset.assetSlots[0];
    Reflect.set(bindingSlot, "required", true);
    Reflect.set(bindingSlot, "acceptedSourceTypes", ["asset", "navigation"]);
    Reflect.set(assetSlot, "required", true);
    Reflect.set(assetSlot, "minItems", 1);
    Reflect.set(assetSlot, "acceptedRoles", ["editorialImage", "logo"]);

    const authority = createAuthority(changedDefinitions);
    expect(
      authority.getByComponentType(componentWithBinding.type)?.requiredCommerceBindingSlots,
    ).toContainEqual({ slotId: bindingSlot.id, acceptedSourceTypes: ["asset", "navigation"] });
    expect(
      authority.getByComponentType(componentWithAsset.type)?.requiredAssetSlots,
    ).toContainEqual({
      slotId: assetSlot.id,
      acceptedRoles: ["editorialImage", "logo"],
    });
  });

  it("projects deeply immutable schemas and fingerprints schema changes", () => {
    const authority = createAuthority();
    const entry = authority.manifest.entries.find(
      (candidate) => Object.keys(candidate.contentSchema.properties).length > 0,
    );
    if (!entry) throw new Error("Expected a registered component content schema.");
    expect(Object.isFrozen(entry.contentSchema)).toBe(true);
    expect(Object.isFrozen(entry.contentSchema.properties)).toBe(true);
    expect(Reflect.set(entry.contentSchema.properties, "mutated", { type: "string" })).toBe(false);

    const changedDefinitions = cloneDefinitions();
    const changedDefinition = changedDefinitions.find(
      (definition) => Object.keys(definition.contentSchema.properties).length > 0,
    );
    if (!changedDefinition) throw new Error("Expected a mutable content schema fixture.");
    Reflect.set(changedDefinition.contentSchema.properties, "manifestReviewField", {
      type: "string",
    });
    const changed = createAuthority(changedDefinitions);
    expect(changed.manifest.fingerprint).not.toBe(authority.manifest.fingerprint);
    expect(
      changed.getByComponentType(changedDefinition.type)?.contentSchema.properties,
    ).toHaveProperty("manifestReviewField");
  });

  it("rejects family-incompatible parameters and keeps adapted V1 content parameters family-compatible", () => {
    const incompatibleDefinitions = cloneDefinitions();
    const definition = incompatibleDefinitions.find((candidate) =>
      boundedParameterDefinitions.some(
        (parameter) => !parameter.compatibleComponentFamilies.includes(candidate.family),
      ),
    );
    if (!definition) throw new Error("Expected an incompatible parameter fixture.");
    const incompatibleParameter = boundedParameterDefinitions.find(
      (parameter) => !parameter.compatibleComponentFamilies.includes(definition.family),
    );
    if (!incompatibleParameter) throw new Error("Missing incompatible bounded parameter fixture.");
    Reflect.set(definition.designCompatibility, "boundedParameterIds", [incompatibleParameter.id]);
    expect(() => createAuthority(incompatibleDefinitions)).toThrow(
      new RegExp(`Component ${definition.type} family ${definition.family} is incompatible`),
    );

    for (const legacyDefinition of Object.values(veskifyComponentRegistry)) {
      const adapted = adaptV1ComponentDefinitionToV2(legacyDefinition);
      expect(
        adapted.designCompatibility.boundedParameterIds.every((parameterId) =>
          boundedParametersById
            .get(parameterId)
            ?.compatibleComponentFamilies.includes(adapted.family),
        ),
      ).toBe(true);
    }
  });

  it("offers only immutable, read-only capability queries", () => {
    const authority = veskifyComponentCapabilityManifest;
    const entry = authority.manifest.entries[0];
    const externalCopy = structuredClone(authority.manifest);

    expect(Object.isFrozen(authority)).toBe(true);
    expect(Object.isFrozen(authority.manifest)).toBe(true);
    expect(Object.isFrozen(authority.manifest.entries)).toBe(true);
    expect(Object.isFrozen(entry.variants)).toBe(true);
    const familyResults = authority.getByFamily(entry.family);
    expect(Object.isFrozen(familyResults)).toBe(true);
    expect(() => Reflect.apply(Array.prototype.push, authority.manifest.entries, [entry])).toThrow(
      TypeError,
    );
    expect(() => Reflect.apply(Array.prototype.push, entry.variants, [entry.variants[0]])).toThrow(
      TypeError,
    );
    expect(() => Reflect.apply(Array.prototype.push, familyResults, [entry])).toThrow(TypeError);

    Reflect.set(externalCopy.entries[0], "allowedPageTypes", []);
    expect(authority.getByComponentType(entry.componentType)?.allowedPageTypes).toEqual(
      definitionFor(entry.componentType).supportedPageTypes.slice().sort(),
    );
    expect(veskifyComponentRegistryV2.get(entry.componentType)).toEqual(
      definitionFor(entry.componentType),
    );
  });

  it("answers canonical page-type and narrative-role compatibility queries", () => {
    const entries = veskifyComponentCapabilityManifest.manifest.entries;
    const pageTypes = [...new Set(entries.flatMap((entry) => entry.allowedPageTypes))];
    const narrativeRoles = [...new Set(entries.flatMap((entry) => entry.narrativeRoles))];

    for (const pageType of pageTypes) {
      expect(
        veskifyComponentCapabilityManifest
          .getCompatibleForPageType(pageType)
          .map((entry) => entry.componentType),
      ).toEqual(
        entries
          .filter((entry) => entry.allowedPageTypes.includes(pageType))
          .map((entry) => entry.componentType),
      );
    }
    for (const role of narrativeRoles) {
      expect(
        veskifyComponentCapabilityManifest
          .getCompatibleForNarrativeRole(role)
          .map((entry) => entry.componentType),
      ).toEqual(
        entries
          .filter((entry) => entry.narrativeRoles.includes(role))
          .map((entry) => entry.componentType),
      );
    }
  });

  it("resolves P10A-03 profile component and variant declarations through the manifest while execution remains on live definitions", () => {
    for (const pagePlan of listExecutablePageBlueprintProfiles()) {
      for (const selection of pagePlan.profile!.componentSelections) {
        const capability = veskifyComponentCapabilityManifest.getByComponentType(
          selection.component,
        );
        expect(capability).toBeDefined();
        expect(capability?.allowedPageTypes).toContain(pagePlan.pageType);
        expect(
          selection.variants.every((variant) =>
            capability?.variants.some((item) => item.id === variant),
          ),
        ).toBe(true);
      }

      const materialized = materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: bindingCategoriesFor(pagePlan.pageType),
      });
      expect(materialized.profileId).toBe(pagePlan.profile!.id);
    }
  });
});
