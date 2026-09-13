import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  resolveInstalledZodEsmClosure,
  resolveRuntimeImportClosure,
} from "../helpers/ar-02-runtime-import-closure";
import { observeSemanticFeatures } from "../helpers/ar-02l-semantic-feature-observation";
import * as compatibility from "@/application/storefront-templates";
import * as home from "@/application/storefront-templates/commercial-homepage-profiles";
import * as collection from "@/application/storefront-templates/commercial-collection-search-profiles";
import * as pdp from "@/application/storefront-templates/commercial-pdp-profiles";
import {
  semanticFeaturesFor,
  semanticExactInfluenceAxesFor,
  semanticOptionalFamilies,
  uniqueSemanticValues,
} from "@/application/prompted-storefront-design-compiler/semantic-capability-features";

const featureRoot =
  "src/application/prompted-storefront-design-compiler/semantic-capability-features.ts";
const forbidden =
  /(?:\.tsx$|\.css$|^src\/(?:app|features|integrations\/puck)\/|^src\/components\/storefront\/|^src\/components\/registry\/(?:index|registry|contract|legacy-registry|renderer-observation|live-renderer-conformance|renderer-conformance)\.|^src\/application\/storefront-templates\/(?:index|materializer)\.|^src\/application\/bounded-storefront-synthesis\/(?:index|synthesizer)\.|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$))/u;

function owners(file: string) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  return Object.fromEntries(
    ast.statements.flatMap((node) => {
      if (!ts.isImportDeclaration(node) || !node.importClause || node.importClause.isTypeOnly)
        return [];
      const bindings = node.importClause.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) return [];
      return bindings.elements
        .filter((entry) => !entry.isTypeOnly)
        .map((entry) => [entry.name.text, (node.moduleSpecifier as ts.StringLiteral).text]);
    }),
  );
}

describe("AR-02L actual semantic feature metadata", () => {
  it("resolves the full runtime/re-export/installed-package closure without renderers", () => {
    const result = resolveRuntimeImportClosure(featureRoot);
    expect(result.runtimePaths.length).toBeGreaterThan(100);
    expect(result.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(result.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
    const esm = resolveInstalledZodEsmClosure();
    expect(esm.runtimePaths.length).toBeGreaterThan(1);
    expect(esm.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
  });

  it("rejects the old barrel in an isolated fixture without editing the production root", () => {
    const before = readFileSync(featureRoot, "utf8");
    const scratch = join(tmpdir(), "veskify-batch-09/ar-02l/temp-fixtures");
    mkdirSync(scratch, { recursive: true });
    const fixture = join(mkdtempSync(join(scratch, "old-barrel-")), "control.ts");
    writeFileSync(
      fixture,
      'import { getCommercialHomepageProfile } from "@/application/storefront-templates";\nexport { getCommercialHomepageProfile };\n',
      { flag: "wx" },
    );
    expect(() => resolveRuntimeImportClosure(fixture)).toThrow(
      /Unresolved runtime import .*commerce-utility\.module\.css/u,
    );
    expect(readFileSync(featureRoot, "utf8")).toBe(before);
  });

  it("uses each defining getter and preserves compatibility function and complete profile values", () => {
    expect(owners(featureRoot)).toMatchObject({
      getCommercialCollectionSearchProfile:
        "@/application/storefront-templates/commercial-collection-search-profiles",
      getCommercialHomepageProfile:
        "@/application/storefront-templates/commercial-homepage-profiles",
      getCommercialPdpProfile: "@/application/storefront-templates/commercial-pdp-profiles",
    });
    expect(compatibility.getCommercialHomepageProfile).toBe(home.getCommercialHomepageProfile);
    expect(compatibility.getCommercialCollectionSearchProfile).toBe(
      collection.getCommercialCollectionSearchProfile,
    );
    expect(compatibility.getCommercialPdpProfile).toBe(pdp.getCommercialPdpProfile);
    for (const [profiles, getter, legacy] of [
      [
        home.listCommercialHomepageProfiles(),
        home.getCommercialHomepageProfile,
        compatibility.getCommercialHomepageProfile,
      ],
      [
        collection.listCommercialCollectionSearchProfiles(),
        collection.getCommercialCollectionSearchProfile,
        compatibility.getCommercialCollectionSearchProfile,
      ],
      [
        pdp.listCommercialPdpProfiles(),
        pdp.getCommercialPdpProfile,
        compatibility.getCommercialPdpProfile,
      ],
    ] as const) {
      for (const profile of profiles) {
        expect(getter(profile.profile!.id)).toEqual(profile);
        expect(legacy(profile.profile!.id)).toEqual(profile);
        expect(Object.isFrozen(getter(profile.profile!.id))).toBe(true);
      }
      expect(getter("unknown-profile")).toBeUndefined();
      expect(legacy("unknown-profile")).toBeUndefined();
    }
  });

  it("keeps actual resolver/influence callers and discloses the unresolved metadata chain", () => {
    const resolver =
      "src/application/prompted-storefront-design-compiler/semantic-compatibility-resolution.ts";
    expect(owners(resolver).semanticFeaturesFor).toBe("./semantic-capability-features");
    expect(owners(resolver).semanticExactInfluenceAxesFor).toBe("./semantic-capability-features");
    expect(owners(resolver).listCompatibleCoordinatedDirectionFactorizedCandidates).toBe(
      "@/application/bounded-storefront-synthesis",
    );
    expect(
      owners("src/application/bounded-storefront-synthesis/direction-registry.ts")
        .getCommercialHomepageProfile,
    ).toBe("@/application/storefront-templates");
    expect(() => resolveRuntimeImportClosure(resolver)).toThrow(/commerce-utility\.module\.css/u);
  });

  it("preserves the complete supported observation domain, failures, axes and immutability", () => {
    const observed = observeSemanticFeatures();
    expect(observed.candidateCount).toBe(159);
    expect(observed.observations).toHaveLength(311);
    expect(observed.axisIds).toHaveLength(14);
    expect(Object.values(observed.profileIds).map((ids) => ids.length)).toEqual([6, 4, 4, 4]);
    for (const [field, ids] of Object.entries(observed.profileIds))
      for (const id of ids)
        expect(
          observed.observations.find((row) => row.id === `${field}:${id}`)?.features.error,
        ).toBeUndefined();
    const failed = observed.observations.filter((row) => row.features.error);
    expect(failed).toHaveLength(7);
    for (const row of observed.observations) {
      if (!row.features.error) {
        expect(Object.keys(row.features.value as object)).toHaveLength(8);
        expect(row.features.frozen?.root).toBe(true);
        expect(row.features.frozen?.arrays.every(Boolean)).toBe(true);
        expect(Object.keys(row.axes.value as object)).toEqual(observed.axisIds);
        expect(row.axes.frozen?.root).toBe(true);
      }
      expect(row.optional.frozen?.root).toBe(true);
    }
    const first = observed.observations.find((row) => row.id === "first-failure:frame-and-home")!;
    expect(first.features.error).toEqual({
      name: "CommercialSharedFrameError",
      message: "Unknown shared-frame profile: unknown-frame.",
    });
    expect(first.axes.error).toEqual(first.features.error);
    const seed = observed.observations[0];
    expect(Reflect.set(semanticFeaturesFor(seed.selection), "commercialPosture", [])).toBe(false);
    expect(
      Reflect.set(
        semanticExactInfluenceAxesFor(seed.selection, seed.designDna),
        "direction-package",
        "changed",
      ),
    ).toBe(false);
    const duplicated = {
      ...seed.selection,
      includedOptionalPageFamilyIds: ["faq", "about", "faq", "unknown"],
    };
    const before = JSON.stringify(duplicated);
    expect(semanticOptionalFamilies(duplicated)).toEqual(["about", "faq"]);
    expect(JSON.stringify(duplicated)).toBe(before);
    expect(uniqueSemanticValues(["z", "a", "z"])).toEqual(["a", "z"]);
  });
});
