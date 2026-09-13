import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import {
  resolveInstalledZodEsmClosure,
  resolveRuntimeImportClosure,
} from "../helpers/ar-02-runtime-import-closure";
import { observeCoordinatedMetadata } from "../helpers/ar-02m-coordinated-metadata-observation";
import * as synthesis from "@/application/bounded-storefront-synthesis";
import {
  CompatibleCoordinatedDirectionCandidateBudgetError,
  listCompatibleCoordinatedDirectionFactorizedCandidates,
} from "@/application/bounded-storefront-synthesis/compatible-direction-selections";
import * as compatibility from "@/application/bounded-storefront-synthesis/compatible-direction-selections";
import * as coordinated from "@/application/bounded-storefront-synthesis/coordinated-directions";
import * as dynamicRoutes from "@/application/dynamic-commerce-routes";
import { dynamicCommerceDesignSelectionSchema } from "@/application/dynamic-commerce-routes/design-selection-contract";
import * as designSystem from "@/application/storefront-design-system";
import * as designSystemContract from "@/application/storefront-design-system/contract";
import * as brandSystems from "@/application/storefront-design-system/registered-brand-system";
import * as templates from "@/application/storefront-templates";
import * as collection from "@/application/storefront-templates/commercial-collection-search-profiles";
import * as homepage from "@/application/storefront-templates/commercial-homepage-profiles";
import * as pdp from "@/application/storefront-templates/commercial-pdp-profiles";
import { getExecutablePageBlueprintProfile } from "@/application/storefront-templates/registry";

const roots = [
  "src/application/bounded-storefront-synthesis/contract.ts",
  "src/application/bounded-storefront-synthesis/direction-registry.ts",
  "src/application/bounded-storefront-synthesis/compatible-direction-selections.ts",
  "src/application/prompted-storefront-design-compiler/semantic-compatibility-resolution.ts",
  "src/application/bounded-storefront-synthesis/direction-contract.ts",
  "src/application/prompted-storefront-design-compiler/semantic-capability-features.ts",
  "src/application/prompted-storefront-design-compiler/semantic-influence-authority.ts",
] as const;
const forbidden =
  /(?:\.(?:tsx|jsx|css)$|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$)|^src\/(?:app|features|integrations\/puck)\/|^src\/components\/storefront\/|^src\/components\/registry\/(?:index|registry|contract|legacy-registry|dynamic-commerce-bridge|renderer-observation|live-renderer-conformance|renderer-conformance)\.|^src\/application\/(?:storefront-templates\/(?:index|materializer)|ai-storefront-generation\/index|bounded-storefront-synthesis\/(?:index|synthesizer|coordinated-directions))\.|^src\/application\/(?:publishing|accepted-snapshot-publishing|storage)\/)/u;
const execution =
  /(?:^src\/application\/(?:storefront-draft-persistence|whole-storefront-proposal-lifecycle)\/|^src\/application\/whole-storefront-generation-plan\/complete-storefront-materializer\.ts$|^src\/application\/(?:storefront-templates|content-support-pages|storefront-site-map)\/(?:materializer|commerce-utility-materializer|profile-materializer)\.ts$|^src\/application\/(?:ai-storefront|prompted-storefront-design-compiler|design-skills)\/(?:executor|coordinator)\.ts$|^src\/data\/demo\/)/u;

function runtimeOwners(file: string) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  return Object.fromEntries(
    source.statements.flatMap((statement) => {
      if (
        !ts.isImportDeclaration(statement) ||
        !statement.importClause ||
        statement.importClause.isTypeOnly
      )
        return [];
      const bindings = statement.importClause.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) return [];
      return bindings.elements
        .filter((entry) => !entry.isTypeOnly)
        .map((entry) => [entry.name.text, (statement.moduleSpecifier as ts.StringLiteral).text]);
    }),
  );
}

describe("AR-02M coordinated metadata boundary", () => {
  it.each(roots)("resolves the complete renderer-free closure of %s", (root) => {
    const closure = resolveRuntimeImportClosure(root);
    expect(closure.runtimePaths.length).toBeGreaterThan(1);
    expect(
      closure.runtimePaths.filter((path) => forbidden.test(path) || execution.test(path)),
    ).toEqual([]);
    expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
  });

  it("retains the installed Zod ESM closure", () => {
    const closure = resolveInstalledZodEsmClosure();
    expect(closure.runtimePaths.length).toBeGreaterThan(1);
    expect(
      closure.runtimePaths.filter((path) => forbidden.test(path) || execution.test(path)),
    ).toEqual([]);
    expect(closure.externalRuntimeImports).toEqual([]);
  });

  it.each([
    "@/application/storefront-templates",
    "@/application/ai-storefront-generation",
    "@/application/bounded-storefront-synthesis",
  ])("rejects the old execution barrel %s in an isolated fixture", (specifier) => {
    const fixture = join(mkdtempSync(join(tmpdir(), "ar-02m-old-barrel-")), "control.ts");
    try {
      writeFileSync(fixture, `export * from "${specifier}";\n`);
      expect(() => {
        const closure = resolveRuntimeImportClosure(fixture);
        if (closure.runtimePaths.some((path) => forbidden.test(path) || execution.test(path)))
          throw new Error("Forbidden runtime edge");
      }).toThrow(/(?:Forbidden runtime edge|Unresolved runtime import.*\.css)/);
    } finally {
      rmSync(dirname(fixture), { recursive: true, force: true });
    }
  });

  it("connects each current consumer to its defining metadata owner", () => {
    const contract = runtimeOwners(roots[0]);
    expect(contract.storefrontDesignDirectionIdSchema).toBe(
      "@/application/storefront-design-system/contract",
    );
    expect(contract.commercialHomepageProfileIdSchema).toBe(
      "@/application/storefront-templates/commercial-homepage-profiles",
    );
    expect(contract.commercialCollectionSearchProfileIdSchema).toBe(
      "@/application/storefront-templates/commercial-collection-search-profiles",
    );
    expect(contract.commercialPdpProfileIdSchema).toBe(
      "@/application/storefront-templates/commercial-pdp-profiles",
    );
    expect(contract.dynamicCommerceDesignSelectionSchema).toBe(
      "@/application/dynamic-commerce-routes/design-selection-contract",
    );
    const directions = runtimeOwners(roots[1]);
    expect(directions.getCommercialHomepageProfile).toBe(
      "@/application/storefront-templates/commercial-homepage-profiles",
    );
    expect(directions.getCommercialCollectionSearchProfile).toBe(
      "@/application/storefront-templates/commercial-collection-search-profiles",
    );
    expect(directions.getCommercialPdpProfile).toBe(
      "@/application/storefront-templates/commercial-pdp-profiles",
    );
    const candidates = runtimeOwners(roots[2]);
    expect(candidates.resolveApprovedAssetPlacement).toBe(
      "@/application/ai-storefront-generation/approved-asset-placement-authority",
    );
    expect(candidates.executableProfile).toBe("@/application/storefront-templates/registry");
    const resolver = runtimeOwners(roots[3]);
    expect(resolver.listCompatibleCoordinatedDirectionFactorizedCandidates).toBe(
      "@/application/bounded-storefront-synthesis/compatible-direction-selections",
    );
    expect(resolver.registeredBrandSystemForDirection).toBe(
      "@/application/storefront-design-system/registered-brand-system",
    );
  });

  it("preserves compatibility export and nested schema identities", () => {
    expect(synthesis.boundedStorefrontSynthesisSelectionNarrowingSchema.shape.directionId).toBe(
      designSystemContract.storefrontDesignDirectionIdSchema,
    );
    expect(
      synthesis.boundedStorefrontSynthesisSelectionNarrowingSchema.shape.homepageProfileId,
    ).toBe(homepage.commercialHomepageProfileIdSchema);
    expect(
      synthesis.boundedStorefrontSynthesisSelectionNarrowingSchema.shape.collectionProfileId,
    ).toBe(collection.commercialCollectionSearchProfileIdSchema);
    expect(synthesis.boundedStorefrontSynthesisSelectionNarrowingSchema.shape.pdpProfileId).toBe(
      pdp.commercialPdpProfileIdSchema,
    );
    expect(designSystem.storefrontDesignDirectionIdSchema).toBe(
      designSystemContract.storefrontDesignDirectionIdSchema,
    );
    expect(templates.getCommercialHomepageProfile).toBe(homepage.getCommercialHomepageProfile);
    expect(templates.getCommercialCollectionSearchProfile).toBe(
      collection.getCommercialCollectionSearchProfile,
    );
    expect(templates.getCommercialPdpProfile).toBe(pdp.getCommercialPdpProfile);
    expect(templates.getExecutablePageBlueprintProfile).toBe(getExecutablePageBlueprintProfile);
    expect(designSystem.registeredBrandSystemForDirection).toBe(
      brandSystems.registeredBrandSystemForDirection,
    );
    expect(synthesis.boundedStorefrontSynthesisExactSelectionSchema.shape.directionId).toBe(
      designSystemContract.storefrontDesignDirectionIdSchema,
    );
    expect(synthesis.boundedStorefrontSynthesisSelectionNarrowingSchema.shape.searchProfileId).toBe(
      collection.commercialCollectionSearchProfileIdSchema,
    );
    expect(dynamicRoutes.dynamicCommerceDesignSelectionSchema).toBe(
      dynamicCommerceDesignSelectionSchema,
    );
    expect(
      synthesis.boundedStorefrontSynthesisDecisionSchema.shape.dynamicCommerceSelection.unwrap(),
    ).toBe(dynamicCommerceDesignSelectionSchema);
    expect(coordinated.CompatibleCoordinatedDirectionCandidateBudgetError).toBe(
      CompatibleCoordinatedDirectionCandidateBudgetError,
    );
    expect(coordinated.listCompatibleCoordinatedDirectionFactorizedCandidates).toBe(
      listCompatibleCoordinatedDirectionFactorizedCandidates,
    );
    expect(coordinated.resolveCompatibleCoordinatedDirectionPostureFactors).toBe(
      compatibility.resolveCompatibleCoordinatedDirectionPostureFactors,
    );
  });

  it("matches the retained complete baseline behavior without mutating inputs", () => {
    const observed = observeCoordinatedMetadata();
    expect(observed.fixtureUnchanged).toBe(true);
    expect(observed.rows).toHaveLength(163);
    expect(observed.rows.every((row) => row.inputUnchanged)).toBe(true);
    expect(observed.rows.filter((row) => "error" in (row.result as object))).toHaveLength(84);
    const byId = new Map(observed.rows.map((row) => [row.id, row]));
    expect(byId.get("inventory:campaign-allowed")?.result).toMatchObject({
      value: { finalCandidateCount: 255 },
    });
    expect(byId.get("inventory:campaign-denied")?.result).toMatchObject({
      value: { finalCandidateCount: 225 },
    });
    expect(byId.get("semantic:all-frames-avoided")?.result).toMatchObject({
      error: {
        name: "SemanticCompatibilityResolutionError",
        code: "no-compatible-selection",
        message: "Semantic authority contains no compatible selection.",
      },
    });
  }, 120000);
});
