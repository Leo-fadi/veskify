import { describe, expect, it } from "vitest";
import {
  collectLiveRendererRegistrations,
  createLiveRendererConformanceReport,
  createRendererConformanceReport,
  veskifyComponentCapabilityManifest,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import { listExecutablePageBlueprintProfiles } from "@/application/storefront-templates";
import { protectedCommerceFieldPaths } from "@/domain/component-platform";
import type { RendererConformanceInput, RendererRegistration } from "@/components/registry";

function liveInput(overrides: Partial<RendererConformanceInput> = {}): RendererConformanceInput {
  return {
    componentDefinitions: veskifyComponentDefinitionsV2,
    pagePlans: listExecutablePageBlueprintProfiles(),
    manifestAuthority: veskifyComponentCapabilityManifest,
    rendererRegistrations: collectLiveRendererRegistrations(),
    ...overrides,
  };
}

function reportFor(overrides: Partial<RendererConformanceInput> = {}) {
  return createRendererConformanceReport(liveInput(overrides));
}

function collectionPlanWithDynamicCommerce(bindingCategories: readonly string[]) {
  const pagePlan = structuredClone(
    listExecutablePageBlueprintProfiles().find((candidate) => candidate.pageType === "collection"),
  );
  if (!pagePlan?.profile) throw new Error("Expected an executable collection profile.");
  const slot = pagePlan.slots[0];
  const selection = pagePlan.profile.componentSelections[0];
  Reflect.set(slot, "sectionType", "dynamicCollectionCommerce");
  Reflect.set(slot, "allowedVariants", ["standard", "editorial", "compact", "gallery"]);
  Reflect.set(slot, "defaultVariant", "standard");
  Reflect.set(selection, "component", "dynamicCollectionCommerce");
  Reflect.set(selection, "variants", ["standard", "editorial", "compact", "gallery"]);
  Reflect.set(selection, "defaultVariant", "standard");
  Reflect.set(pagePlan.profile, "requiredBindingCategories", bindingCategories);
  return pagePlan;
}

describe("P10A-04B registry, manifest, and renderer conformance", () => {
  it("traces every canonical component and variant to renderer-level target evidence", () => {
    const report = createLiveRendererConformanceReport();

    expect(report.findings.map((entry) => entry.id)).toContain(
      "renderer-targets:dynamicProductDetail",
    );
    expect(
      report.findings.filter((entry) =>
        entry.id.startsWith("renderer-variant-target:dynamicProductDetail:"),
      ),
    ).toHaveLength(5);
    expect(report.blockingDefects).toHaveLength(16);
    expect(report.metadataGaps).toHaveLength(28);
    expect(report.deliberateFutureCapabilities).toHaveLength(7);
    expect(report.commercialGaps).toHaveLength(0);
    expect(collectLiveRendererRegistrations()).toHaveLength(32);
    expect(veskifyComponentDefinitionsV2.flatMap((definition) => definition.variants)).toHaveLength(
      veskifyComponentCapabilityManifest.manifest.entries.flatMap((entry) => entry.variants).length,
    );
  });

  it("uses the live runtime maps rather than a second renderer inventory", () => {
    const registrations = collectLiveRendererRegistrations();
    const identities = registrations.map(
      (registration) => `${registration.adapterId}:${registration.exportName}`,
    );

    expect(new Set(identities).size).toBe(identities.length);
    expect(registrations.every((registration) => registration.variantCapabilities.length > 0)).toBe(
      true,
    );
    expect(
      registrations.map((registration) => registration.componentType).filter(Boolean),
    ).toHaveLength(32);
  });

  it("fails closed when a definition variant has no renderer-level support", () => {
    const registrations = collectLiveRendererRegistrations();
    const registration = registrations.find(
      (candidate) => candidate.componentType === "announcementBar",
    );
    if (!registration) throw new Error("Expected announcement bar renderer evidence.");
    const unsupportedVariant = registration.variantCapabilities[0].supportedVariants[0];
    const changed: RendererRegistration = {
      ...registration,
      variantCapabilities: registration.variantCapabilities.map((capability) => ({
        ...capability,
        supportedVariants: capability.supportedVariants.filter(
          (variant) => variant !== unsupportedVariant,
        ),
      })),
    };
    const report = reportFor({
      rendererRegistrations: registrations.map((candidate) =>
        candidate === registration ? changed : candidate,
      ),
    });

    expect(report.blockingDefects.map((entry) => entry.id)).toContain(
      `renderer-variant-target:announcementBar:${unsupportedVariant}:editor`,
    );
  });

  it("detects target-specific renderer support and undeclared variant fallback", () => {
    const registrations = collectLiveRendererRegistrations();
    const registration = registrations.find((candidate) => candidate.componentType === "header");
    if (!registration) throw new Error("Expected header renderer evidence.");
    const variant = registration.variantCapabilities[0].supportedVariants[0];
    const changed: RendererRegistration = {
      ...registration,
      variantCapabilities: registration.variantCapabilities.map((capability) =>
        capability.target === "preview"
          ? { ...capability, supportedVariants: [], fallbackVariants: [variant] }
          : capability,
      ),
    };
    const report = reportFor({
      rendererRegistrations: registrations.map((candidate) =>
        candidate === registration ? changed : candidate,
      ),
    });

    expect(report.blockingDefects.map((entry) => entry.id)).toContain(
      `renderer-variant-fallback:header:${variant}:preview`,
    );
    expect(
      report.blockingDefects
        .map((entry) => entry.id)
        .filter((id) => id.includes(`header:${variant}:`)),
    ).toHaveLength(1);
  });

  it("accepts every directly declared variant on every target", () => {
    const registration = collectLiveRendererRegistrations().find(
      (candidate) => candidate.componentType === "announcementBar",
    );
    if (!registration) throw new Error("Expected announcement bar renderer evidence.");

    expect(registration.variantCapabilities.map((capability) => capability.target)).toEqual([
      "editor",
      "preview",
      "published",
    ]);
    expect(
      registration.variantCapabilities.every(
        (capability) =>
          capability.supportedVariants.length === 4 && !capability.fallbackVariants?.length,
      ),
    ).toBe(true);
  });

  it("reports stale renderer variant metadata separately from direct support", () => {
    const registrations = collectLiveRendererRegistrations();
    const registration = registrations.find(
      (candidate) => candidate.componentType === "announcementBar",
    );
    if (!registration) throw new Error("Expected announcement bar renderer evidence.");
    const changed: RendererRegistration = {
      ...registration,
      variantCapabilities: registration.variantCapabilities.map((capability) => ({
        ...capability,
        supportedVariants: [...capability.supportedVariants, "retired-variant"],
      })),
    };
    const report = reportFor({
      rendererRegistrations: registrations.map((candidate) =>
        candidate === registration ? changed : candidate,
      ),
    });

    expect(report.metadataGaps.map((entry) => entry.id)).toContain(
      "renderer-stale-variant:announcementBar:retired-variant:editor",
    );
  });

  it("fails closed for missing, duplicate, orphan, and target-incomplete renderer registrations", () => {
    const registrations = [...collectLiveRendererRegistrations()];
    const first = registrations[0];
    const duplicate: RendererRegistration = { ...registrations[1] };
    const orphan: RendererRegistration = {
      adapterId: "testRenderer",
      exportName: "OrphanRenderer",
      supportedTargets: ["editor", "preview", "published"],
      variantCapabilities: [],
    };
    const incomplete: RendererRegistration = {
      ...registrations[1],
      supportedTargets: ["editor"],
    };
    const report = reportFor({
      rendererRegistrations: [...registrations.slice(1), duplicate, orphan, incomplete],
    });

    expect(report.blockingDefects.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        `missing-renderer:${first.componentType}`,
        `duplicate-renderer:${registrations[1].componentType}`,
        `orphan-renderer:${orphan.adapterId}:${orphan.exportName}`,
      ]),
    );
    expect(report.blockingDefects.some((entry) => entry.id.startsWith("renderer-targets:"))).toBe(
      true,
    );
  });

  it("reports renderer version provenance as a metadata gap without inventing a version authority", () => {
    const report = createLiveRendererConformanceReport();

    expect(
      report.metadataGaps.filter((entry) => entry.id.startsWith("renderer-version-unregistered:")),
    ).toHaveLength(veskifyComponentDefinitionsV2.length);
    expect(
      report.blockingDefects.filter((entry) => entry.id.startsWith("renderer-version-drift:")),
    ).toEqual([]);
  });

  it("detects a renderer version mismatch when a renderer supplies version evidence", () => {
    const registrations = collectLiveRendererRegistrations();
    const first = registrations[0];
    const report = reportFor({
      rendererRegistrations: [
        { ...first, version: { major: 9, minor: 9, patch: 9 } },
        ...registrations.slice(1),
      ],
    });

    expect(report.blockingDefects.map((entry) => entry.id)).toContain(
      `renderer-version-drift:${first.componentType}`,
    );
  });

  it("treats manifest-shaped external data as drift evidence, never execution authority", () => {
    const externalManifest = structuredClone(veskifyComponentCapabilityManifest.manifest);
    Reflect.set(externalManifest.entries[0].renderer, "exportName", "ExternalRenderer");
    const baseline = createLiveRendererConformanceReport();
    const report = reportFor({ externalManifest });

    expect(report.manifestFingerprint).toBe(baseline.manifestFingerprint);
    expect(report.findings.map((entry) => entry.id)).toContain("external-manifest-drift");
    expect(report.findings.filter((entry) => entry.category === "missing-renderer")).toEqual(
      baseline.findings.filter((entry) => entry.category === "missing-renderer"),
    );
  });

  it("validates PageBlueprint compatibility, bindings, assets, bounded parameters, and materialization", () => {
    const report = createLiveRendererConformanceReport();

    expect(
      report.blockingDefects.filter(
        (entry) => entry.category === "page-blueprint-compatibility-gap",
      ),
    ).toEqual([]);
    expect(report.blockingDefects.filter((entry) => entry.category === "binding-gap")).toHaveLength(
      9,
    );
    expect(report.blockingDefects.filter((entry) => entry.category === "asset-role-gap")).toEqual(
      [],
    );
    expect(
      report.blockingDefects.filter((entry) => entry.category === "bounded-parameter-gap"),
    ).toEqual([]);
    for (const pagePlan of listExecutablePageBlueprintProfiles()) {
      const profile = pagePlan.profile;
      if (!profile) throw new Error(`Missing executable profile for ${pagePlan.pageType}.`);
      expect(profile.componentSelections).toHaveLength(pagePlan.slots.length);
      expect(
        profile.componentSelections.map((selection) => [
          selection.slotId,
          selection.component,
          selection.defaultVariant,
          selection.variants,
        ]),
      ).toEqual(
        pagePlan.slots.map((slot) => [
          slot.id,
          slot.sectionType,
          slot.defaultVariant,
          slot.allowedVariants,
        ]),
      );
    }
  });

  it("validates every selected component required binding, alternatives, optional slots, and stale declarations", () => {
    const allRequired = reportFor({
      pagePlans: [collectionPlanWithDynamicCommerce(["collection", "productList"])],
    });
    expect(
      allRequired.blockingDefects.filter((entry) =>
        entry.id.startsWith("profile-component-binding:blueprint-"),
      ),
    ).toEqual([]);

    const missingOne = reportFor({
      pagePlans: [collectionPlanWithDynamicCommerce(["collection"])],
    });
    expect(
      missingOne.blockingDefects.some((entry) => entry.id.endsWith(":collectionProducts")),
    ).toBe(true);

    const optionalDefinitions = structuredClone(veskifyComponentDefinitionsV2);
    const dynamicCollection = optionalDefinitions.find(
      (definition) => definition.type === "dynamicCollectionCommerce",
    );
    if (!dynamicCollection) throw new Error("Expected dynamic collection definition.");
    Reflect.set(dynamicCollection.commerceBindingSlots[0], "acceptedSourceTypes", [
      "collection",
      "productList",
    ]);
    Reflect.set(dynamicCollection.commerceBindingSlots[1], "required", false);
    const alternativesAndOptional = reportFor({
      componentDefinitions: optionalDefinitions,
      pagePlans: [collectionPlanWithDynamicCommerce(["productList"])],
    });
    expect(
      alternativesAndOptional.blockingDefects.filter((entry) =>
        entry.id.startsWith("profile-component-binding:"),
      ),
    ).toEqual([]);

    const stale = reportFor({ pagePlans: [collectionPlanWithDynamicCommerce(["navigation"])] });
    expect(stale.blockingDefects.some((entry) => entry.id.endsWith(":navigation"))).toBe(true);
  });

  it("checks required bindings independently for multiple selected components", () => {
    const pagePlan = collectionPlanWithDynamicCommerce(["collection", "productList"]);
    const profile = pagePlan.profile;
    if (!profile) throw new Error("Expected executable collection profile.");
    const secondSlot = pagePlan.slots[1];
    const secondSelection = profile.componentSelections[1];
    Reflect.set(secondSlot, "sectionType", "dynamicProductDetail");
    Reflect.set(secondSlot, "allowedVariants", ["balanced"]);
    Reflect.set(secondSlot, "defaultVariant", "balanced");
    Reflect.set(secondSelection, "component", "dynamicProductDetail");
    Reflect.set(secondSelection, "variants", ["balanced"]);
    Reflect.set(secondSelection, "defaultVariant", "balanced");
    const definitions = structuredClone(veskifyComponentDefinitionsV2);
    const product = definitions.find((definition) => definition.type === "dynamicProductDetail");
    if (!product) throw new Error("Expected dynamic product definition.");
    Reflect.set(product, "supportedPageTypes", ["collection", "product"]);
    if (!product.commercialAnatomy) throw new Error("Expected dynamic product commercial anatomy.");
    Reflect.set(product.commercialAnatomy.compatibility, "allowedPageTypes", [
      "collection",
      "product",
    ]);
    const report = reportFor({ componentDefinitions: definitions, pagePlans: [pagePlan] });

    expect(
      report.blockingDefects.some(
        (entry) =>
          entry.id.includes("profile-component-binding") &&
          entry.componentType === "dynamicProductDetail",
      ),
    ).toBe(true);
  });

  it("confirms responsive and accessibility contracts for every live renderer path", () => {
    const report = createLiveRendererConformanceReport();

    expect(
      report.blockingDefects.filter((entry) => entry.category === "responsive-contract-gap"),
    ).toEqual([]);
    expect(
      report.blockingDefects.filter((entry) => entry.category === "accessibility-contract-gap"),
    ).toEqual([]);
  });

  it("closes every verified homepage commercial gap through a canonical bridge and profile", () => {
    const report = createLiveRendererConformanceReport();

    expect(report.commercialGaps).toEqual([]);
    const profileComponents = listExecutablePageBlueprintProfiles()
      .filter((plan) => plan.pageType === "home")
      .flatMap(
        (plan) => plan.profile?.componentSelections.map((selection) => selection.component) ?? [],
      );
    expect(profileComponents).toEqual(
      expect.arrayContaining([
        "homepageHero",
        "homepageFeaturedCollections",
        "homepageFeaturedProducts",
        "homepageCollectionNavigation",
        "homepagePromotion",
        "homepageTrust",
      ]),
    );
  });

  it("produces stable, immutable report evidence regardless of registration order", () => {
    const baseline = createLiveRendererConformanceReport();
    const reordered = reportFor({
      rendererRegistrations: [...collectLiveRendererRegistrations()].reverse(),
    });

    expect(reordered).toEqual(baseline);
    expect(Object.isFrozen(baseline)).toBe(true);
    expect(Object.isFrozen(baseline.findings)).toBe(true);
  });

  it("canonicalizes duplicate renderer registrations with differing metadata", () => {
    const registrations = collectLiveRendererRegistrations();
    const first = registrations[0];
    const firstVariant = first.variantCapabilities[0].supportedVariants[0];
    const duplicateEditor: RendererRegistration = {
      ...first,
      supportedTargets: ["editor"],
      variantCapabilities: [{ target: "editor", supportedVariants: [firstVariant] }],
      version: { major: 1, minor: 0, patch: 0 },
    };
    const duplicatePreview: RendererRegistration = {
      ...first,
      supportedTargets: ["preview"],
      variantCapabilities: [{ target: "preview", supportedVariants: [firstVariant] }],
      version: { major: 1, minor: 0, patch: 1 },
    };
    const forward = reportFor({
      rendererRegistrations: [...registrations, duplicateEditor, duplicatePreview],
    });
    const reversed = reportFor({
      rendererRegistrations: [...registrations, duplicatePreview, duplicateEditor].reverse(),
    });
    const changed = reportFor({
      rendererRegistrations: [
        ...registrations,
        duplicateEditor,
        { ...duplicatePreview, version: { major: 1, minor: 0, patch: 2 } },
      ],
    });

    expect(reversed.rendererRegistrationFingerprint).toBe(forward.rendererRegistrationFingerprint);
    expect(reversed.fingerprint).toBe(forward.fingerprint);
    expect(changed.rendererRegistrationFingerprint).not.toBe(
      forward.rendererRegistrationFingerprint,
    );
  });

  it("reports the target-specific dynamic V1/V2 ownership drift", () => {
    const report = createLiveRendererConformanceReport();

    expect(report.blockingDefects.map((entry) => entry.id)).toContain(
      "renderer-ownership-drift:dynamicProductDetail:editor",
    );
    expect(report.deliberateFutureCapabilities.map((entry) => entry.id)).toContain(
      "renderer-ownership-drift:dynamicCollectionCommerce:editor",
    );
  });

  it("changes the evidence fingerprint when renderer capability changes", () => {
    const baseline = createLiveRendererConformanceReport();
    const changed = reportFor({
      rendererRegistrations: collectLiveRendererRegistrations().slice(1),
    });

    expect(changed.fingerprint).not.toBe(baseline.fingerprint);
    expect(changed.manifestFingerprint).toBe(baseline.manifestFingerprint);
    expect(changed.blockingDefects.map((entry) => entry.category)).toContain("missing-renderer");
  });

  it("preserves protected commerce and asset contracts while producing evidence", () => {
    const protectedPaths = veskifyComponentDefinitionsV2.map((definition) => [
      definition.type,
      [...definition.protectedFields.readOnlyPaths],
      definition.assetSlots.map((slot) => ({ ...slot, acceptedRoles: [...slot.acceptedRoles] })),
    ]);
    createLiveRendererConformanceReport();

    expect(
      veskifyComponentDefinitionsV2.map((definition) => [
        definition.type,
        [...definition.protectedFields.readOnlyPaths],
        definition.assetSlots.map((slot) => ({ ...slot, acceptedRoles: [...slot.acceptedRoles] })),
      ]),
    ).toEqual(protectedPaths);
    expect(protectedCommerceFieldPaths.length).toBeGreaterThan(0);
  });
});
