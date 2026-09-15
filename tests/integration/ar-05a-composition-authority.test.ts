import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compilePageBlueprintComposition as compile } from "@/application/storefront-templates/compile-page-blueprint-composition";
import { validateCompiledPageBlueprintComposition as validate } from "@/application/storefront-templates/validate-page-blueprint-composition";
import { createPageBlueprintV2CandidateAuthority } from "@/application/storefront-templates/page-blueprint-v2-candidate-authority";
import {
  canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry,
  inactiveStructuralStorefrontFamilyCandidateRegistry,
} from "@/application/storefront-templates/structural-storefront-family-candidate-registry";
import { deriveInactiveCandidateNormalizedTopologyIndex } from "@/application/storefront-templates/structural-storefront-family-normalized-topology";
import {
  createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue,
  createStructuralStorefrontCapabilityContext,
} from "@/application/storefront-templates/structural-storefront-compatibility-contract";
import { evaluateInactiveStructuralStorefrontCandidateCompatibility } from "@/application/storefront-templates/structural-storefront-candidate-compatibility-evaluation";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import { pageModelSchema, storefrontSnapshotSchema } from "@/domain/storefront/storefront";
import {
  dynamicCommerceCollectionSearchArchetypeSchema,
  dynamicCommerceProductDetailArchetypeSchema,
} from "@/domain/storefront/dynamic-commerce-route";
import { ar05aFixture, ar05aReplaceCandidate } from "../helpers/ar-05a-composition-fixtures";
import {
  resolveRuntimeImportClosure,
  resolveInstalledZodEsmClosure,
} from "../helpers/ar-02-runtime-import-closure";
const clone = <T>(input: T): T => structuredClone(input);

describe("AR-05A real authorities without activation", () => {
  it.each(["collection", "search", "product-detail"] as const)(
    "retains %s dynamic references and rejects its actual indivisible inventory for a specific rule",
    (family) => {
      const fixture = ar05aFixture({ family, dynamic: true });
      const before = JSON.stringify(fixture.dynamic);
      expect(fixture.selection.regionAssignments.flatMap((entry) => entry.units)).toHaveLength(1);
      const missingRegion = family === "product-detail" ? "conversion" : "primary-discovery";
      expect(() => compile(fixture.selection, fixture.authority)).toThrow(
        `region cardinality unsatisfied for ${missingRegion}`,
      );
      const missing = clone(fixture.selection);
      missing.regionAssignments = missing.regionAssignments.filter(
        (entry) => entry.regionId !== missingRegion,
      );
      expect(() => compile(missing, fixture.authority)).toThrow(
        `required region ${missingRegion} is unassigned`,
      );
      const duplicate = clone(fixture.selection);
      duplicate.regionAssignments[1].units = duplicate.regionAssignments[0].units;
      expect(() => compile(duplicate, fixture.authority)).toThrow(/exactly once/);
      const anatomy = clone(fixture.selection);
      const parent = anatomy.regionAssignments[0].units[0];
      if (parent.kind === "anatomy") throw new Error("whole fixture");
      anatomy.regionAssignments[0].units = [
        { kind: "anatomy", parent, anatomySlotId: "product-controls" },
      ];
      expect(() => compile(anatomy, fixture.authority)).toThrow(
        /anatomy realization is not executable/,
      );
      const foreign = clone(fixture.selection);
      foreign.owner.id = "foreign_archetype";
      expect(() => compile(foreign, fixture.authority)).toThrow(/owner/);
      const badRef = clone(fixture.selection);
      badRef.regionAssignments[0].units = [{ kind: "presentation", slotId: "foreign_slot" }];
      expect(() => compile(badRef, fixture.authority)).toThrow(/foreign/);
      if (fixture.authority.owner.kind === "collection-search-archetype") {
        const actual = clone(fixture.dynamic.collectionSearchArchetypes[0]);
        actual.supportedContexts = [family === "search" ? "collection" : "search"];
        expect(() =>
          compile(fixture.selection, {
            ...fixture.authority,
            owner: {
              kind: "collection-search-archetype",
              context: family === "search" ? "search" : "collection",
              archetype: actual,
            },
          }),
        ).toThrow(/context/);
      }
      expect(JSON.stringify(fixture.dynamic)).toBe(before);
    },
  );
  it("allows only exact optional omissions from current fixture asset capacities and agrees with A08", () => {
    const fixture = ar05aFixture({ omission: true });
    expect(fixture.availableApprovedAssets).toHaveLength(0);
    expect(
      fixture.evidence.requiredRoleCapacities.map((entry) => entry.satisfiableMinimumCapacity),
    ).toEqual([0, 0]);
    const value = compile(fixture.selection, fixture.authority);
    expect(value.omissions.map((entry) => entry.regionId)).toEqual(["asset-region"]);
    expect(value.regionAssignments.some((entry) => entry.regionId === "asset-region")).toBe(false);
    expect(validate(clone(value), fixture.authority)).toEqual(value);
    const registry = canonicalizeInactiveStructuralStorefrontFamilyCandidateRegistry({
      contractSchemaVersion: "1.0.0",
      pageBlueprintCandidates: [fixture.candidate],
      familyCandidates: [],
    });
    const capabilityContext = createStructuralStorefrontCapabilityContext(registry, {
      contextSchemaVersion: "1.0.0",
      catalogueCardinality: "standard",
      factDepth: "standard",
      productComplexity: "mixed",
      navigationDepth: "standard",
      activeLocale: "en",
      availableLocales: ["en", "fi"],
      pageBlueprintAssetRoleCapacityEvidence: [fixture.evidence],
    });
    const evaluated = evaluateInactiveStructuralStorefrontCandidateCompatibility({
      candidateRegistry: registry,
      normalizedTopologyIndex: deriveInactiveCandidateNormalizedTopologyIndex(registry),
      capabilityContext,
      compatibilityProfileCatalogue:
        createInactiveStructuralStorefrontFamilyCompatibilityProfileCatalogue({
          contractSchemaVersion: "1.0.0",
          profiles: [],
        }),
    });
    expect(evaluated.pageBlueprintEvaluations[0]).toMatchObject({
      status: "omission-compatible",
      triggeredRegionIds: ["asset-region"],
      terminalDisposition: "omit-triggered-regions",
    });
    const permuted = {
      ...fixture.evidence,
      requiredRoleCapacities: [...fixture.evidence.requiredRoleCapacities].reverse(),
    };
    expect(
      validate(value, { ...fixture.authority, requiredAssetRoleCapacityEvidence: permuted }),
    ).toEqual(value);
  });
  it.each([
    "missing",
    "stale",
    "extra-role",
    "wrong-minimum",
    "missing-omission",
    "bad-fingerprint",
    "extra-assignment",
    "no-fallback",
    "unresolved-substitution",
  ] as const)("rejects %s capacity/omission evidence", (kind) => {
    const fixture = ar05aFixture({ omission: true });
    if (kind === "missing")
      fixture.authority = { ...fixture.authority, requiredAssetRoleCapacityEvidence: undefined };
    if (kind === "stale")
      fixture.authority = {
        ...fixture.authority,
        requiredAssetRoleCapacityEvidence: { ...fixture.evidence, blueprintVersion: "1.0.1" },
      };
    if (kind === "extra-role")
      fixture.evidence.requiredRoleCapacities.push({
        regionId: "foreign",
        role: "editorialImage",
        satisfiableMinimumCapacity: 0,
      });
    if (kind === "wrong-minimum")
      fixture.evidence.requiredRoleCapacities.forEach((entry) => {
        entry.satisfiableMinimumCapacity = 1;
      });
    if (kind === "missing-omission") fixture.selection.omissions = [];
    if (kind === "bad-fingerprint") fixture.selection.omissions[0].evidenceFingerprint = "stale";
    if (kind === "extra-assignment")
      fixture.selection.regionAssignments.push({
        regionId: "asset-region",
        realizationId: "whole-asset-region",
        units: [],
      });
    if (kind === "no-fallback" || kind === "unresolved-substitution") {
      const { candidateFingerprint: _old, ...material } = fixture.candidate;
      void _old;
      const replacement = createPageBlueprintV2CandidateAuthority({
        ...material,
        omissionSubstitutionFallback: {
          ...material.omissionSubstitutionFallback,
          regionFallbackRules:
            kind === "no-fallback"
              ? material.omissionSubstitutionFallback.regionFallbackRules.map((rule) => ({
                  ...rule,
                  terminalResolution: "fail-closed",
                }))
              : material.omissionSubstitutionFallback.regionFallbackRules,
          blueprintSubstitutionCandidates:
            kind === "unresolved-substitution"
              ? [{ blueprintId: "future-alternative", blueprintVersion: "1.0.0" }]
              : [],
        },
      });
      ar05aReplaceCandidate(fixture, replacement);
    }
    expect(() => compile(fixture.selection, fixture.authority)).toThrow();
  });
  it("does not reject unused substitutions when actual hero media supplies the required capacity", () => {
    const fixture = ar05aFixture({ omission: true });
    const { candidateFingerprint: _old, ...material } = fixture.candidate;
    void _old;
    const replacement = createPageBlueprintV2CandidateAuthority({
      ...material,
      assetRoleCompatibility: {
        ...material.assetRoleCompatibility,
        regionAssetRequirements: material.assetRoleCompatibility.regionAssetRequirements.map(
          (entry) => ({
            ...entry,
            roleRequirements: entry.roleRequirements.filter((role) => role.role === "heroDesktop"),
          }),
        ),
      },
      omissionSubstitutionFallback: {
        ...material.omissionSubstitutionFallback,
        blueprintSubstitutionCandidates: [
          { blueprintId: "future-alternative", blueprintVersion: "1.0.0" },
        ],
      },
    });
    const heroMedia = fixture.page.sections
      .filter((section) => section.component === "hero" && section.visible)
      .flatMap((section) => (section.content.media ? [section.content.media] : []));
    expect(heroMedia).toHaveLength(1);
    fixture.authority = {
      ...fixture.authority,
      candidate: replacement,
      requiredAssetRoleCapacityEvidence: {
        ...fixture.evidence,
        exactCandidateFingerprint: replacement.candidateFingerprint,
        requiredRoleCapacities: [
          {
            regionId: "asset-region",
            role: "heroDesktop",
            satisfiableMinimumCapacity: heroMedia.length,
          },
        ],
      },
    };
    fixture.selection.omissions = [];
    fixture.selection.regionAssignments.push({
      regionId: "asset-region",
      realizationId: "whole-asset-region",
      units: [],
    });
    fixture.selection.breakpoints = fixture.selection.breakpoints.map((entry, index) => ({
      ...entry,
      ruleFingerprint: canonicalValueFingerprint(
        replacement.responsiveRules.breakpointRules[index],
      ),
    }));
    expect(compile(fixture.selection, fixture.authority).omissions).toEqual([]);
  });
  it("keeps strict legacy readers and all active registries/root imports unchanged", () => {
    const fixture = ar05aFixture();
    const composition = compile(fixture.selection, fixture.authority);
    expect(pageModelSchema.safeParse({ ...fixture.page, composition }).success).toBe(false);
    expect(
      dynamicCommerceCollectionSearchArchetypeSchema.safeParse({
        ...fixture.dynamic.collectionSearchArchetypes[0],
        composition,
      }).success,
    ).toBe(false);
    expect(
      dynamicCommerceProductDetailArchetypeSchema.safeParse({
        ...fixture.dynamic.productDetailArchetypes[0],
        composition,
      }).success,
    ).toBe(false);
    expect(
      storefrontSnapshotSchema.safeParse({ compositionVersion: "1.0.0", composition }).success,
    ).toBe(false);
    expect(inactiveStructuralStorefrontFamilyCandidateRegistry.pageBlueprintCandidates).toEqual([]);
    expect(inactiveStructuralStorefrontFamilyCandidateRegistry.familyCandidates).toEqual([]);
    const trackedProduction = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
      .trim()
      .split("\n");
    const imported =
      /(?:from\s*|import\s*\(|require\s*\()["'][^"']*(?:compiled-page-blueprint-composition|compile-page-blueprint-composition|validate-page-blueprint-composition)["']/u;
    expect(
      trackedProduction.filter(
        (path) =>
          ![
            "src/domain/storefront/compiled-page-blueprint-composition.ts",
            "src/application/storefront-templates/compile-page-blueprint-composition.ts",
            "src/application/storefront-templates/validate-page-blueprint-composition.ts",
            "src/domain/storefront/storefront-composition-version.ts",
            "src/domain/storefront/dynamic-commerce-composition-version.ts",
            "src/application/storefront-templates/bind-storefront-composition.ts",
          ].includes(path) &&
          /\.[cm]?[jt]sx?$/u.test(path) &&
          imported.test(readFileSync(path, "utf8")),
      ),
    ).toEqual([]);
    expect(canonicalValueFingerprint(fixture.dynamic)).toBe(
      canonicalValueFingerprint(clone(fixture.dynamic)),
    );
  });
  it("resolves complete lower-domain and application closures including installed CJS and ESM packages", () => {
    const entries = [
      "src/domain/storefront/compiled-page-blueprint-composition.ts",
      "src/application/storefront-templates/compile-page-blueprint-composition.ts",
      "src/application/storefront-templates/validate-page-blueprint-composition.ts",
    ];
    const forbidden =
      /(?:\.tsx$|\.css$|^src\/(?:app|features|integrations|services|data)\/|^tests\/|^src\/components\/storefront\/|^src\/components\/registry\/(?:index|registry|contract|legacy-registry|renderer-observation|live-renderer-conformance|renderer-conformance)\.|^src\/application\/storefront-templates\/(?:index|materializer)\.|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$))/u;
    for (const entry of entries) {
      const closure = resolveRuntimeImportClosure(entry);
      expect(closure.runtimePaths.length).toBeGreaterThan(1);
      expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
      expect(closure.externalRuntimeImports.map((imported) => imported.specifier)).toEqual(["zod"]);
      if (entry.startsWith("src/domain"))
        expect(
          closure.runtimePaths.filter((path) => /^src\/(?:application|components)\//u.test(path)),
        ).toEqual([]);
    }
    const esm = resolveInstalledZodEsmClosure();
    expect(esm.runtimePaths.length).toBeGreaterThan(1);
    expect(esm.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
  });
});
