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

describe("P10A-04B registry, manifest, and renderer conformance", () => {
  it("traces every canonical component and variant to a live renderer registration", () => {
    const report = createLiveRendererConformanceReport();

    expect(report.findings.filter((entry) => entry.category === "missing-renderer")).toEqual([]);
    expect(report.findings.filter((entry) => entry.category === "incompatible-variant")).toEqual(
      [],
    );
    expect(collectLiveRendererRegistrations()).toHaveLength(veskifyComponentDefinitionsV2.length);
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
    expect(registrations.every((registration) => registration.supportedTargets.length === 3)).toBe(
      true,
    );
    expect(
      registrations.map((registration) => registration.componentType).filter(Boolean),
    ).toHaveLength(23);
  });

  it("fails closed for missing, duplicate, orphan, and target-incomplete renderer registrations", () => {
    const registrations = [...collectLiveRendererRegistrations()];
    const first = registrations[0];
    const duplicate: RendererRegistration = { ...registrations[1] };
    const orphan: RendererRegistration = {
      adapterId: "testRenderer",
      exportName: "OrphanRenderer",
      supportedTargets: ["editor", "preview", "published"],
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
      12,
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

  it("confirms responsive and accessibility contracts for every live renderer path", () => {
    const report = createLiveRendererConformanceReport();

    expect(
      report.blockingDefects.filter((entry) => entry.category === "responsive-contract-gap"),
    ).toEqual([]);
    expect(
      report.blockingDefects.filter((entry) => entry.category === "accessibility-contract-gap"),
    ).toEqual([]);
  });

  it("classifies intentionally unbridged registered homepage capabilities as commercial gaps", () => {
    const report = createLiveRendererConformanceReport();

    expect(report.commercialGaps.map((entry) => entry.componentType)).toEqual([
      "homepageCollectionNavigation",
      "homepageFeaturedCollections",
      "homepageFeaturedProducts",
      "homepageHero",
      "homepagePromotion",
      "homepageTrust",
    ]);
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
