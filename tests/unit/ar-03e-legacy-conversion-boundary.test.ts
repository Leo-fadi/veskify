import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as facade from "@/application/dynamic-commerce-routes";
import * as migration from "@/application/dynamic-commerce-routes/legacy-migration";
import * as projection from "@/application/dynamic-commerce-routes/legacy-route-projection";
import * as schemas from "@/components/registry/dynamic-commerce-bridge-contract";
import * as bridge from "@/components/registry/dynamic-commerce-bridge";
import { getComponentDefinition } from "@/components/registry";
import { registeredDynamicCommerceCollectionArchetypeId } from "@/application/dynamic-commerce-routes/archetype-presentation";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { createDynamicCommercePresentationAuthority } from "@/domain/storefront";
import { createLegacyDynamicCommerceRouteScenario } from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";

const forbidden =
  /(?:\.(?:tsx|jsx|css)$|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$)|^src\/(?:app|features|services|integrations)\/|^src\/components\/registry\/(?:index|registry|legacy-registry|dynamic-commerce-bridge)\.|^src\/application\/dynamic-commerce-routes\/(?:authority|index)\.ts$|^src\/application\/(?:bounded-storefront-synthesis|whole-storefront-generation-plan|whole-storefront-proposal-lifecycle|publishing|accepted-snapshot-publishing|prompted-storefront-design-compiler)\/|^src\/application\/storefront-templates\/materializer\.ts$)/i;
const scenario = createLegacyDynamicCommerceRouteScenario();
const current = migration.requireMigratedDynamicCommerceSnapshot(
  scenario.legacySnapshot,
  scenario.catalogue,
);

describe("AR-03E legacy conversion ownership", () => {
  it.each([
    "src/application/dynamic-commerce-routes/legacy-migration.ts",
    "src/application/dynamic-commerce-routes/legacy-route-projection.ts",
    "src/components/registry/dynamic-commerce-bridge-contract.ts",
  ])("keeps the complete %s runtime closure renderer-free", (path) => {
    const graph = resolveRuntimeImportClosure(path);
    expect(graph.runtimePaths.filter((p) => forbidden.test(p))).toEqual([]);
    expect(graph.externalRuntimeImports.map((x) => x.specifier)).toEqual(["zod"]);
  });

  it("keeps the runtime resolver separate from migration, selection and editor execution", () => {
    const graph = resolveRuntimeImportClosure(
      "src/application/dynamic-commerce-routes/route-resolution.ts",
    );
    expect(
      graph.runtimePaths.filter((p) =>
        /\/(?:legacy-migration|legacy-route-projection|design-selection|editor-projection)\.ts$/.test(
          p,
        ),
      ),
    ).toEqual([]);
  });

  it("retains compatibility identities without exporting private helpers", () => {
    expect(Object.keys(migration).sort()).toEqual([
      "materializeCurrentDynamicCommercePresentationAuthority",
      "migrateLegacyDynamicCommerceRoutes",
      "requireMigratedDynamicCommerceSnapshot",
    ]);
    for (const [name, value] of Object.entries(migration))
      expect(facade[name as keyof typeof facade]).toBe(value);
    expect(Object.keys(projection).sort()).toEqual([
      "expandDynamicCommerceRoutePages",
      "reconcileMigratedRoutePageIdentities",
    ]);
    expect(facade.expandDynamicCommerceRoutePages).toBe(projection.expandDynamicCommerceRoutePages);
    expect(facade.registeredDynamicCommerceCollectionArchetypeId).toBe(
      registeredDynamicCommerceCollectionArchetypeId,
    );
    const file = resolve("src/application/dynamic-commerce-routes/authority.ts");
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    expect(
      ast.statements.every(
        (n) => ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause),
      ),
    ).toBe(true);
  });

  it("shares both original schemas across metadata, bridge definitions and registry entrypoints", () => {
    expect(Object.keys(schemas).sort()).toEqual([
      "dynamicCollectionCommerceBridgeContentSchema",
      "dynamicProductDetailBridgeContentSchema",
    ]);
    expect(bridge.dynamicCollectionCommerceBridgeContentSchema).toBe(
      schemas.dynamicCollectionCommerceBridgeContentSchema,
    );
    expect(bridge.dynamicProductDetailBridgeContentSchema).toBe(
      schemas.dynamicProductDetailBridgeContentSchema,
    );
    expect(bridge.dynamicCollectionCommerceBridgeDefinition.contentSchema).toBe(
      schemas.dynamicCollectionCommerceBridgeContentSchema,
    );
    expect(bridge.dynamicProductDetailBridgeDefinition.contentSchema).toBe(
      schemas.dynamicProductDetailBridgeContentSchema,
    );
    expect(getComponentDefinition("dynamicCollectionCommerce").contentSchema).toBe(
      schemas.dynamicCollectionCommerceBridgeContentSchema,
    );
    expect(getComponentDefinition("dynamicProductDetail").contentSchema).toBe(
      schemas.dynamicProductDetailBridgeContentSchema,
    );
    expect(schemas.dynamicCollectionCommerceBridgeContentSchema.shape.canonicalRevision).toBe(
      schemas.dynamicProductDetailBridgeContentSchema.shape.canonicalRevision,
    );
  });

  it.each([
    [
      schemas.dynamicCollectionCommerceBridgeContentSchema,
      bridge.dynamicCollectionCommerceBridgeDefinition.defaultContent,
    ],
    [
      schemas.dynamicProductDetailBridgeContentSchema,
      bridge.dynamicProductDetailBridgeDefinition.defaultContent,
    ],
  ] as const)(
    "preserves strict bridge fields, canonical revision bounds and defaults",
    (schema, content) => {
      const original = structuredClone(content);
      expect(schema.parse(content)).toEqual(original);
      expect(
        schema.parse({ ...content, canonicalRevision: "  retained  " }).canonicalRevision,
      ).toBe("retained");
      for (const canonicalRevision of ["", " ", "x".repeat(241), 17, null])
        expect(schema.safeParse({ ...content, canonicalRevision }).success).toBe(false);
      expect(schema.safeParse({ ...content, canonicalRevision: "x".repeat(240) }).success).toBe(
        true,
      );
      expect(schema.safeParse({ ...content, unregistered: true }).success).toBe(false);
      expect(schema.safeParse({ ...content, canonicalRevision: undefined }).success).toBe(false);
      expect(content).toEqual(original);
    },
  );

  it.each([
    [
      "src/application/whole-storefront-generation-plan/planner.ts",
      {
        dynamicCommerceDesignSelectionSchema: "design-selection-contract",
        DynamicCommerceDesignSelection: "design-selection-contract",
        validateDynamicCommerceDesignSelection: "design-selection",
        materializeCurrentDynamicCommercePresentationAuthority: "legacy-migration",
      },
    ],
    [
      "src/application/whole-storefront-generation-plan/complete-storefront-materializer.ts",
      {
        materializeCurrentDynamicCommercePresentationAuthority: "legacy-migration",
        requireMigratedDynamicCommerceSnapshot: "legacy-migration",
        validateDynamicCommerceDesignSelection: "design-selection",
        DynamicCommerceDesignSelection: "design-selection-contract",
        reconcileMigratedRoutePageIdentities: "legacy-route-projection",
      },
    ],
    [
      "src/application/bounded-storefront-synthesis/synthesizer.ts",
      {
        dynamicCommerceDesignSelectionSchema: "design-selection-contract",
        DynamicCommerceDesignSelection: "design-selection-contract",
        validateDynamicCommerceDesignSelection: "design-selection",
      },
    ],
  ] as const)("resolves every named %s import directly", (file, expected) => {
    const path = resolve(file),
      ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const cfg = ts.readConfigFile(resolve("tsconfig.json"), (path) => ts.sys.readFile(path)),
      options = ts.parseJsonConfigFileContent(cfg.config, ts.sys, process.cwd()).options;
    const found: Record<string, string> = {};
    for (const n of ast.statements.filter(ts.isImportDeclaration)) {
      const specifier = (n.moduleSpecifier as ts.StringLiteral).text;
      if (!specifier.startsWith("@/application/dynamic-commerce-routes")) continue;
      const bindings = n.importClause?.namedBindings;
      expect(bindings && ts.isNamedImports(bindings)).toBe(true);
      if (!bindings || !ts.isNamedImports(bindings)) throw Error("Expected named imports");
      for (const b of bindings.elements) found[b.name.text] = specifier;
      expect(
        ts.resolveModuleName(specifier, path, options, ts.sys).resolvedModule?.resolvedFileName,
      ).toBe(resolve(specifier.replace("@/", "src/") + ".ts"));
    }
    expect(found).toEqual(
      Object.fromEntries(
        Object.entries(expected).map(([name, leaf]) => [
          name,
          "@/application/dynamic-commerce-routes/" + leaf,
        ]),
      ),
    );
  });

  it("retains migration decisions and typed failures without source writes", () => {
    const source = structuredClone(scenario),
      before = structuredClone(source);
    expect(
      migration.migrateLegacyDynamicCommerceRoutes(source.legacySnapshot, source.catalogue).status,
    ).toBe("migrated");
    const wrong = { ...source.catalogue, id: "wrong_catalogue" };
    const result = migration.migrateLegacyDynamicCommerceRoutes(source.legacySnapshot, wrong);
    expect(result.status).toBe("requires-decision");
    if (result.status !== "requires-decision") throw Error("Expected exact decision");
    expect(result.decisions.map((d) => d.code)).toEqual(["missing-catalogue-identity"]);
    expect(() =>
      migration.requireMigratedDynamicCommerceSnapshot(source.legacySnapshot, wrong),
    ).toThrow(facade.DynamicCommerceMigrationError);
    expect(source).toEqual(before);
  });

  it("keeps search omission, route IDs and navigation in explicit expansion", () => {
    const input = structuredClone(current),
      before = structuredClone(input),
      search = input.dynamicCommercePresentation!.routeInventory.find((r) => r.kind === "search")!;
    const area = Object.values(input.navigation)[0];
    area.push({
      ...structuredClone(area[0]),
      id: "search_test_item",
      target: { type: "dynamic-commerce-route", routeId: search.id },
    });
    const expanded = projection.expandDynamicCommerceRoutePages(input, scenario.catalogue);
    expect(expanded.dynamicCommercePresentation).toBeUndefined();
    expect(expanded.pages.map((p) => p.id)).toEqual([
      ...before.pages.map((p) => p.id),
      ...before
        .dynamicCommercePresentation!.routeInventory.filter((r) => r.kind !== "search")
        .map((r) => r.id),
    ]);
    expect(
      Object.values(expanded.navigation)
        .flat()
        .some((item) => item.id === "search_test_item"),
    ).toBe(false);
    expect(input.dynamicCommercePresentation).toEqual(before.dynamicCommercePresentation);
    expect(
      migration.requireMigratedDynamicCommerceSnapshot(expanded, scenario.catalogue)
        .dynamicCommercePresentation,
    ).toBeDefined();
  });

  it("reconciles only exact decision identities and clones all retained material", () => {
    const source = createP10B14PremiumEditorialFixture(),
      catalogue = source.fixture.planningInput.catalogue;
    const draft = migration.requireMigratedDynamicCommerceSnapshot(
        source.slice.snapshot,
        catalogue,
      ),
      decision = structuredClone(source.siteMapDecision);
    const route = draft.dynamicCommercePresentation!.routeInventory.find(
      (r) => r.kind === "product",
    )!;
    const page = decision.pages.find((p) => p.route === route.route)!;
    page.existingPageId = route.id;
    const original = structuredClone({ draft, decision });
    const matched = projection.reconcileMigratedRoutePageIdentities(draft, decision);
    expect(matched.dynamicCommercePresentation).toBeUndefined();
    expect(matched.pages.find((p) => p.id === route.id)).toMatchObject({
      id: route.id,
      slug: route.route,
      sections: [],
    });
    expect(matched.pages.find((p) => p.id === route.id)!.title).not.toBe(page.title);
    for (const change of ["unknown-id", "route", "kind", "resource"]) {
      const altered = structuredClone(decision),
        p = altered.pages.find((p) => p.route === route.route)!;
      if (change === "unknown-id") p.existingPageId = "unknown_route";
      if (change === "route") p.route = "/products/mismatch";
      if (change === "kind") p.familyId = "collection";
      if (change === "resource")
        p.commerceContext = { kind: "product", productId: "unknown_product" };
      expect(
        projection
          .reconcileMigratedRoutePageIdentities(draft, altered)
          .pages.some((p) => p.id === route.id),
      ).toBe(false);
    }
    expect({ draft, decision }).toEqual(original);
    const expanded = projection.expandDynamicCommerceRoutePages(draft, catalogue);
    expect(projection.reconcileMigratedRoutePageIdentities(expanded, decision)).toEqual(expanded);
    expect(projection.reconcileMigratedRoutePageIdentities(expanded, decision)).not.toBe(expanded);
  });

  it("preserves a custom route identity in the transient reconciliation", () => {
    const source = createP10B14PremiumEditorialFixture(),
      draft = migration.requireMigratedDynamicCommerceSnapshot(
        source.slice.snapshot,
        source.fixture.planningInput.catalogue,
      ),
      decision = structuredClone(source.siteMapDecision);
    const authority = structuredClone(draft.dynamicCommercePresentation!),
      route = authority.routeInventory.find((r) => r.kind === "product")!;
    route.id = "custom_product_route";
    const { authorityFingerprint: ignored, ...material } = authority;
    void ignored;
    draft.dynamicCommercePresentation = createDynamicCommercePresentationAuthority(material);
    const page = decision.pages.find((p) => p.route === route.route)!;
    page.existingPageId = route.id;
    expect(
      projection
        .reconcileMigratedRoutePageIdentities(draft, decision)
        .pages.find((p) => p.id === route.id),
    ).toMatchObject({ id: route.id, sections: [] });
  });
});
