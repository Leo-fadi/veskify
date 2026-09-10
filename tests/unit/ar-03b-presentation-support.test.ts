import { describe, expect, it } from "vitest";
import * as facade from "@/application/dynamic-commerce-routes";
import {
  createCollectionArchetype,
  createProductArchetype,
  type LegacyDynamicPresentationEntry,
} from "@/application/dynamic-commerce-routes/archetype-presentation";
import { DynamicCommerceMigrationError } from "@/application/dynamic-commerce-routes/migration-contract";
import { migrateP10B18B03PresentationAuthority } from "@/application/dynamic-commerce-routes/presentation-compatibility";
import { projectSectionStyleOverrides } from "@/application/dynamic-commerce-routes/presentation-style";
import { failDynamicCommerceRouteAuthority } from "@/application/dynamic-commerce-routes/route-errors";
import { listCommercialCollectionSearchProfiles } from "@/application/storefront-templates/commercial-collection-search-profiles";
import { listCommercialPdpProfiles } from "@/application/storefront-templates/commercial-pdp-profiles";
import {
  approvedAssetPresentationSchema,
  createDynamicCommercePresentationAuthority,
  type DynamicCommercePresentationAuthority,
} from "@/domain/storefront";
import { createLegacyDynamicCommerceRouteScenario } from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";
import { historicalAuthority, normalizedError } from "../helpers/ar-03-route-boundary-observation";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";

const forbidden =
  /(?:\.(?:tsx|jsx|css)$|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$)|^src\/(?:app|features|services|integrations\/puck)\/|^src\/components\/registry\/(?:index|registry|legacy-registry)\.|^src\/application\/dynamic-commerce-routes\/(?:authority|index)\.ts$|^src\/application\/(?:bounded-storefront-synthesis|publishing|accepted-snapshot-publishing|prompted-storefront-design-compiler)\/|^src\/application\/storefront-templates\/materializer\.ts$)/i;

function migrated() {
  const scenario = createLegacyDynamicCommerceRouteScenario();
  const result = facade.migrateLegacyDynamicCommerceRoutes(
    scenario.legacySnapshot,
    scenario.catalogue,
  );
  if (result.status !== "migrated") throw new Error("Expected supported legacy migration.");
  return { scenario, result };
}

function assetEntries(required: boolean): LegacyDynamicPresentationEntry[] {
  const { legacySnapshot } = createLegacyDynamicCommerceRouteScenario();
  const page = legacySnapshot.pages.find(
    (p) => p.pageFamily?.profileId === "collection-editorial-discovery",
  )!;
  const section = page.sections[0];
  const presentation = approvedAssetPresentationSchema.parse({
    assetId: "asset_shared",
    role: "editorialImage",
    revision: "asset-r1",
    materialFingerprint: "approved-material",
    asset: {
      id: "asset_shared",
      url: "/assets/shared.jpg",
      alt: { en: "Approved image", fi: "Hyväksytty kuva" },
    },
  });
  const withAsset = {
    ...structuredClone(section),
    approvedAssetPresentations: [presentation],
    approvedAssetPlacements: [
      {
        type: "PLACE_APPROVED_SOURCE_ASSET" as const,
        pageId: page.id,
        componentId: section.id,
        componentType: section.component,
        assetSlotId: "collectionCommerceMedia",
        assetId: presentation.assetId,
        role: presentation.role,
        assetRevision: presentation.revision,
        materialFingerprint: presentation.materialFingerprint,
        sourceReferenceId: "source_approved",
        required,
      },
    ],
  };
  return [
    { page: structuredClone(page), section: withAsset },
    {
      page: { ...structuredClone(page), id: "another_collection" },
      section: structuredClone(section),
    },
  ];
}

describe("AR-03B presentation support", () => {
  it.each([
    "archetype-presentation",
    "presentation-compatibility",
    "migration-contract",
    "presentation-style",
  ])("keeps the complete %s runtime graph renderer-free", (name) => {
    const closure = resolveRuntimeImportClosure(
      `src/application/dynamic-commerce-routes/${name}.ts`,
    );
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(
      name === "archetype-presentation" || name === "presentation-compatibility" ? ["zod"] : [],
    );
  });

  it("shares the original public constructor without leaking internal helpers", () => {
    expect(facade.DynamicCommerceMigrationError).toBe(DynamicCommerceMigrationError);
    for (const name of [
      "createCollectionArchetype",
      "createProductArchetype",
      "projectSectionStyleOverrides",
      "failDynamicCommerceRouteAuthority",
      "migrateP10B18B03PresentationAuthority",
    ])
      expect(name in facade).toBe(false);
    const error = new DynamicCommerceMigrationError([
      {
        code: "conflicting-legacy-presentation",
        routeIds: ["route_one"],
        message: "An exact decision",
      },
    ]);
    expect(normalizedError(error)).toEqual({
      name: "DynamicCommerceMigrationError",
      message: "Legacy dynamic-commerce pages require an explicit migration decision.",
      decisions: error.decisions,
    });
  });

  it.each([
    undefined,
    null,
    false,
    0,
    "",
    { issues: [{ path: ["props", "cardVariant"], code: "invalid_value" }] },
  ])("retains exact route failure cause semantics for %j", (cause) => {
    try {
      failDynamicCommerceRouteAuthority("invalid-presentation", "Exact failure", cause);
    } catch (error) {
      expect(error).toBeInstanceOf(facade.DynamicCommerceRouteAuthorityError);
      expect(error).toMatchObject({
        name: "DynamicCommerceRouteAuthorityError",
        code: "invalid-presentation",
        message: "Exact failure",
      });
      expect((error as Error).cause).toBe(cause || undefined);
    }
  });

  it("preserves every registered builder result through the existing migration facade", () => {
    const { scenario, result } = migrated();
    const before = JSON.stringify(scenario);
    const { authorityFingerprint: _fingerprint, ...material } = result.authority;
    void _fingerprint;
    for (const profile of listCommercialCollectionSearchProfiles()) {
      const id = profile.profile!.id;
      const entries = scenario.legacySnapshot.pages
        .filter((p) => p.pageFamily?.profileId === id)
        .map((page) => ({ page, section: page.sections[0] }));
      const candidate = createCollectionArchetype(id, entries);
      const canonical = createDynamicCommercePresentationAuthority({
        ...material,
        collectionSearchArchetypes: material.collectionSearchArchetypes.map((a) =>
          a.id === candidate.id ? candidate : a,
        ),
      });
      expect(canonical.collectionSearchArchetypes.find((a) => a.id === candidate.id)).toEqual(
        result.authority.collectionSearchArchetypes.find((a) => a.profile.profileId === id),
      );
    }
    for (const profile of listCommercialPdpProfiles()) {
      const id = profile.profile!.id;
      const entries = scenario.legacySnapshot.pages
        .filter((p) => p.pageFamily?.profileId === id)
        .map((page) => ({ page, section: page.sections[0] }));
      const candidate = createProductArchetype(id, entries);
      const canonical = createDynamicCommercePresentationAuthority({
        ...material,
        productDetailArchetypes: material.productDetailArchetypes.map((a) =>
          a.id === candidate.id ? candidate : a,
        ),
      });
      expect(canonical.productDetailArchetypes.find((a) => a.id === candidate.id)).toEqual(
        result.authority.productDetailArchetypes.find(
          (a) =>
            a.profile.profileId === id &&
            a.id !== result.authority.fallbacks.productDetailArchetypeId,
        ),
      );
    }
    expect(JSON.stringify(scenario)).toBe(before);
    expect(
      facade.migrateLegacyDynamicCommerceRoutes(result.snapshot, scenario.catalogue).status,
    ).toBe("current");
  });

  it("upgrades both exact historical profiles once and keeps current authority identity", () => {
    const { result } = migrated();
    expect(migrateP10B18B03PresentationAuthority(result.authority)).toEqual({
      authority: result.authority,
      migrated: false,
    });
    expect(migrateP10B18B03PresentationAuthority(result.authority).authority).toBe(
      result.authority,
    );
    const legacy = historicalAuthority(result.authority);
    const before = JSON.stringify(legacy);
    const upgraded = migrateP10B18B03PresentationAuthority(legacy);
    expect(upgraded.migrated).toBe(true);
    expect(upgraded.authority.authorityRevision).toBe(legacy.authorityRevision + 1);
    expect(upgraded.authority.routeInventory).toEqual(legacy.routeInventory);
    expect(upgraded.authority.collectionRouteMappings).toEqual(legacy.collectionRouteMappings);
    expect(upgraded.authority.collectionSearchArchetypes).toEqual(
      result.authority.collectionSearchArchetypes,
    );
    expect(migrateP10B18B03PresentationAuthority(upgraded.authority).authority).toBe(
      upgraded.authority,
    );
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it.each([
    "fingerprint",
    "profileVersion",
    "id",
    "contexts",
    "responsive",
    "anatomy",
    "props",
    "style",
  ])("leaves a historical %s near miss unchanged", (field) => {
    const { result } = migrated();
    const old = historicalAuthority(result.authority);
    const target = structuredClone(
      old.collectionSearchArchetypes.find(
        (a) => a.profile.profileId === "collection-dense-search",
      )!,
    );
    const presentation = target.componentPresentations[0];
    if (field === "fingerprint") target.profile.fingerprint = "unknown-stale";
    if (field === "profileVersion") target.profile.profileVersion = "0.9.0";
    if (field === "id") target.id = "wrong_id";
    if (field === "contexts") target.supportedContexts = ["collection"];
    if (field === "responsive") target.responsivePosture[0].transformationIds = ["unknown"];
    if (field === "anatomy") presentation.anatomyId = "standard";
    if (field === "props") presentation.props.cardVariant = "standard";
    if (field === "style") presentation.styleOverrides = { surfaceTreatment: "unknown" } as never;
    const input = {
      ...structuredClone(result.authority),
      collectionSearchArchetypes: [target],
    } as DynamicCommercePresentationAuthority;
    const before = JSON.stringify(input);
    const output = migrateP10B18B03PresentationAuthority(input);
    expect(output).toEqual({ authority: input, migrated: false });
    expect(output.authority).toBe(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("retains optional asset disposition, required-asset decisions and incomplete provenance rejection", () => {
    const optional = assetEntries(false);
    const before = JSON.stringify(optional);
    expect(
      createCollectionArchetype("collection-editorial-discovery", optional)
        .componentPresentations[0].approvedAssetSelections,
    ).toEqual([]);
    const required = assetEntries(true);
    try {
      createCollectionArchetype("collection-editorial-discovery", required);
      throw new Error("Expected required asset decision");
    } catch (error) {
      expect(error).toBeInstanceOf(DynamicCommerceMigrationError);
      expect((error as DynamicCommerceMigrationError).decisions).toEqual([
        {
          code: "conflicting-legacy-presentation",
          routeIds: [required[0].page.id],
          message:
            "Routes sharing one archetype have required approved assets that are not reusable across every route.",
        },
      ]);
    }
    const shared = structuredClone(optional);
    shared[1] = {
      ...shared[1],
      section: {
        ...structuredClone(shared[0].section),
        approvedAssetPlacements: shared[0].section.approvedAssetPlacements!.map((p) => ({
          ...p,
          pageId: shared[1].page.id,
        })),
      },
    };
    const compact = createCollectionArchetype("collection-editorial-discovery", shared)
      .componentPresentations[0].approvedAssetSelections!;
    expect(compact).toHaveLength(1);
    expect(compact[0].presentation).toEqual(shared[0].section.approvedAssetPresentations![0]);
    expect(compact[0].presentation).not.toBe(shared[0].section.approvedAssetPresentations![0]);
    shared[0].section.approvedAssetPlacements![0].sourceReferenceId = "unknown_source";
    shared[0].section.approvedAssetPlacements![0].materialFingerprint = "stale";
    expect(() => createCollectionArchetype("collection-editorial-discovery", shared)).toThrow(
      "A dynamic-commerce approved asset has incomplete canonical placement authority.",
    );
    expect(JSON.stringify(optional)).toBe(before);
  });

  it.each(["slot", "role", "identity"])(
    "rejects an incompatible asset %s before returning presentation",
    (fault) => {
      const entries = assetEntries(false);
      const placement = entries[0].section.approvedAssetPlacements![0];
      if (fault === "slot") placement.assetSlotId = "unknown_slot";
      if (fault === "role") placement.role = "logo";
      if (fault === "identity") placement.assetId = "unknown_asset";
      const before = JSON.stringify(entries);
      expect(() => createCollectionArchetype("collection-editorial-discovery", entries)).toThrow(
        fault === "identity"
          ? "incomplete canonical placement authority"
          : "incompatible with its registered slot",
      );
      expect(JSON.stringify(entries)).toBe(before);
    },
  );

  it("preserves customized historical content and detached approved asset data during upgrade", () => {
    const { result } = migrated();
    const legacy = historicalAuthority(result.authority);
    const presentation = legacy.collectionSearchArchetypes.find(
      (a) => a.profile.profileId === "collection-dense-search",
    )!.componentPresentations[0];
    presentation.content.productsHeading = { en: "Selected products", fi: "Valitut tuotteet" };
    presentation.approvedAssetSelections = createCollectionArchetype(
      "collection-editorial-discovery",
      [assetEntries(false)[0]],
    ).componentPresentations[0].approvedAssetSelections;
    const before = JSON.stringify(legacy);
    const upgraded = migrateP10B18B03PresentationAuthority(legacy);
    const output = upgraded.authority.collectionSearchArchetypes.find(
      (a) => a.profile.profileId === "collection-dense-search",
    )!.componentPresentations[0];
    expect(upgraded.migrated).toBe(true);
    expect(output.content).toEqual(presentation.content);
    expect(output.approvedAssetSelections).toEqual(presentation.approvedAssetSelections);
    expect(output.approvedAssetSelections).not.toBe(presentation.approvedAssetSelections);
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it("rejects unknown profiles and conflicting card anatomy without mutating legacy sections", () => {
    expect(() => createCollectionArchetype("unknown")).toThrow(
      "Collection profile unknown is unavailable.",
    );
    expect(() => createProductArchetype("unknown")).toThrow("PDP profile unknown is unavailable.");
    const entries = assetEntries(false);
    entries[0].section.props.cardVariant = "compact";
    const before = JSON.stringify(entries);
    expect(() => createCollectionArchetype("collection-editorial-discovery", [entries[0]])).toThrow(
      "The legacy collection product-card anatomy conflicts with its registered profile.",
    );
    expect(JSON.stringify(entries)).toBe(before);
  });

  it("preserves style omission, surface translation and exact conflicts", () => {
    expect(projectSectionStyleOverrides(undefined)).toBeUndefined();
    expect(projectSectionStyleOverrides({})).toBeUndefined();
    expect(projectSectionStyleOverrides({ surfaceTreatment: "plain" })).toBeUndefined();
    expect(projectSectionStyleOverrides({ surfaceTreatment: "soft" })).toEqual({
      surface: "surface",
    });
    const input = { surfaceTreatment: "soft", surface: "primary" } as const;
    expect(() => projectSectionStyleOverrides(input)).toThrow(
      "Soft surface treatment conflicts with the explicit section surface.",
    );
    expect(input).toEqual({ surfaceTreatment: "soft", surface: "primary" });
  });
});
