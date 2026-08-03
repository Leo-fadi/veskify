import { describe, expect, it } from "vitest";
import {
  listExecutablePageBlueprintProfiles,
  materializeExecutablePageBlueprint,
} from "@/application/storefront-templates";
import {
  veskifyComponentCapabilityManifest,
  veskifyComponentDefinitionsV2,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import {
  boundedParametersById,
  createComponentCapabilityManifestAuthority,
  protectedCommerceFieldPaths,
  serializeComponentCapabilityManifest,
} from "@/domain/component-platform";

function bindingCategoriesFor(pageType: string) {
  if (pageType === "home") return ["navigation"] as const;
  if (pageType === "collection") return ["collection", "productList"] as const;
  if (pageType === "product") return ["product"] as const;
  return [] as const;
}

function cloneDefinitions() {
  return veskifyComponentDefinitionsV2.map((definition) => structuredClone(definition));
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
    const first = createComponentCapabilityManifestAuthority(veskifyComponentDefinitionsV2);
    const reordered = createComponentCapabilityManifestAuthority(
      [...veskifyComponentDefinitionsV2].reverse(),
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
    const baseline = createComponentCapabilityManifestAuthority(veskifyComponentDefinitionsV2);
    const changed = createComponentCapabilityManifestAuthority(changedDefinitions);
    const type = changedDefinitions[0].type;

    expect(changed.manifest.fingerprint).not.toBe(baseline.manifest.fingerprint);
    expect(changed.getByComponentType(type)?.fingerprint).not.toBe(
      baseline.getByComponentType(type)?.fingerprint,
    );
  });

  it("fails closed for duplicate identities and malformed closed-vocabulary metadata", () => {
    expect(() =>
      createComponentCapabilityManifestAuthority([
        ...veskifyComponentDefinitionsV2,
        structuredClone(veskifyComponentDefinitionsV2[0]),
      ]),
    ).toThrow(/Duplicate ComponentDefinitionV2 identities/);

    const duplicateVariant = cloneDefinitions();
    Reflect.set(duplicateVariant[0], "variants", [
      ...duplicateVariant[0].variants,
      structuredClone(duplicateVariant[0].variants[0]),
    ]);
    expect(() => createComponentCapabilityManifestAuthority(duplicateVariant)).toThrow(
      /variants must not contain duplicates/,
    );

    const invalidPageType = cloneDefinitions();
    Reflect.set(invalidPageType[0], "supportedPageTypes", ["unknown-page-type"]);
    expect(() => createComponentCapabilityManifestAuthority(invalidPageType)).toThrow();

    const invalidRole = cloneDefinitions();
    Reflect.set(invalidRole[0].designCompatibility, "allowedNarrativeRoles", ["unknown-role"]);
    expect(() => createComponentCapabilityManifestAuthority(invalidRole)).toThrow();

    const invalidBinding = cloneDefinitions();
    const componentWithBinding = invalidBinding.find(
      (definition) => definition.commerceBindingSlots.length > 0,
    );
    if (!componentWithBinding) throw new Error("Expected a live component with a binding slot.");
    Reflect.set(componentWithBinding.commerceBindingSlots[0], "acceptedSourceTypes", [
      "unknown-binding",
    ]);
    expect(() => createComponentCapabilityManifestAuthority(invalidBinding)).toThrow();

    const invalidAssetRole = cloneDefinitions();
    const componentWithAsset = invalidAssetRole.find(
      (definition) => definition.assetSlots.length > 0,
    );
    if (!componentWithAsset) throw new Error("Expected a live component with an asset slot.");
    Reflect.set(componentWithAsset.assetSlots[0], "acceptedRoles", ["unknown-asset-role"]);
    expect(() => createComponentCapabilityManifestAuthority(invalidAssetRole)).toThrow();
  });

  it("projects all controlled capability metadata and preserves protected commerce boundaries", () => {
    for (const definition of veskifyComponentDefinitionsV2) {
      const entry = veskifyComponentCapabilityManifest.getByComponentType(definition.type);
      const registryDefinition = veskifyComponentRegistryV2.get(definition.type);
      if (!entry || !registryDefinition) {
        throw new Error(`Missing live component capability for ${definition.type}.`);
      }

      expect(entry.commerceBindingSlots).toEqual(
        [...definition.commerceBindingSlots].sort((left, right) => left.id.localeCompare(right.id)),
      );
      expect(entry.assetSlots).toEqual(
        [...definition.assetSlots].sort((left, right) => left.id.localeCompare(right.id)),
      );
      expect(entry.contentSlots).toEqual(
        [...definition.contentSlots].sort((left, right) => left.id.localeCompare(right.id)),
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
