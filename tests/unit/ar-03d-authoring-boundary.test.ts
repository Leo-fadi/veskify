import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createCollectionArchetype } from "@/application/dynamic-commerce-routes/archetype-presentation";
import * as facade from "@/application/dynamic-commerce-routes";
import * as contract from "@/application/dynamic-commerce-routes/design-selection-contract";
import * as selection from "@/application/dynamic-commerce-routes/design-selection";
import * as editor from "@/application/dynamic-commerce-routes/editor-projection";
import { DynamicCommerceRouteAuthorityError } from "@/application/dynamic-commerce-routes/route-errors";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  approvedAssetPresentationSchema,
  canonicalValueFingerprint,
  createDynamicCommercePresentationAuthority,
  isDynamicCommerceArchetypeCompatibleWithSharedFrame,
  type DynamicCommercePresentationAuthority,
} from "@/domain/storefront";
import { createLegacyDynamicCommerceRouteScenario } from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";
import { normalizedError } from "../helpers/ar-03-route-boundary-observation";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";

function fixture() {
  const source = createLegacyDynamicCommerceRouteScenario();
  const snapshot = facade.requireMigratedDynamicCommerceSnapshot(
    source.legacySnapshot,
    source.catalogue,
  );
  return { snapshot, catalogue: source.catalogue };
}
function repin(
  input: ReturnType<typeof fixture>,
  edit: (a: DynamicCommercePresentationAuthority) => void,
) {
  const a = structuredClone(input.snapshot.dynamicCommercePresentation!);
  edit(a);
  const { authorityFingerprint: omitted, ...material } = a;
  void omitted;
  input.snapshot.dynamicCommercePresentation = createDynamicCommercePresentationAuthority(material);
}
function design(input: ReturnType<typeof fixture>): contract.DynamicCommerceDesignSelection {
  const a = input.snapshot.dynamicCommercePresentation!;
  const compatible = (
    p:
      | DynamicCommercePresentationAuthority["productDetailArchetypes"][number]
      | DynamicCommercePresentationAuthority["collectionSearchArchetypes"][number],
  ) =>
    !input.snapshot.sharedFrame ||
    isDynamicCommerceArchetypeCompatibleWithSharedFrame(p, input.snapshot.sharedFrame.profileId);
  const product = a.productDetailArchetypes.find(
    (p) => p.id !== a.fallbacks.productDetailArchetypeId && compatible(p),
  )!;
  return {
    authorityFingerprint: a.authorityFingerprint,
    collectionArchetypeId: a.collectionSearchArchetypes.find(
      (p) => p.supportedContexts.includes("collection") && compatible(p),
    )!.id,
    searchArchetypeId: a.collectionSearchArchetypes.find(
      (p) => p.supportedContexts.includes("search") && compatible(p),
    )!.id,
    standardSimpleArchetypeId: product.id,
    configurableArchetypeId: product.id,
    galleryLedArchetypeId: product.id,
    highConsiderationArchetypeId: product.id,
    genericFallbackArchetypeId: a.fallbacks.productDetailArchetypeId,
    productTypeMappings: Object.fromEntries(
      input.catalogue.products.map((p) => [
        canonicalProductTypePresentationId(p.productType),
        product.id,
      ]),
    ),
  };
}
const forbidden =
  /(?:\.(?:tsx|jsx|css)$|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$)|^src\/(?:app|features|services|integrations\/puck)\/|^src\/components\/registry\/(?:index|registry|legacy-registry|dynamic-commerce-bridge)\.|^src\/application\/dynamic-commerce-routes\/(?:authority|index|legacy-migration|legacy-route-projection)\.ts$|^src\/application\/(?:bounded-storefront-synthesis|whole-storefront-generation-plan|whole-storefront-proposal-lifecycle|publishing|accepted-snapshot-publishing|prompted-storefront-design-compiler)\/|^src\/application\/storefront-templates\/materializer\.ts$)/i;

describe("AR-03D authoring ownership", () => {
  it.each(["design-selection-contract", "design-selection", "editor-projection"])(
    "keeps the complete %s runtime closure narrow",
    (name) => {
      const graph = resolveRuntimeImportClosure(
        `src/application/dynamic-commerce-routes/${name}.ts`,
      );
      expect(graph.runtimePaths.filter((p) => forbidden.test(p))).toEqual([]);
      expect(graph.externalRuntimeImports.map((x) => x.specifier)).toEqual(["zod"]);
      if (name !== "editor-projection")
        expect(graph.runtimePaths).not.toContain(
          "src/application/dynamic-commerce-routes/route-resolution.ts",
        );
      if (name === "editor-projection")
        expect(graph.runtimePaths).not.toContain(
          "src/application/dynamic-commerce-routes/design-selection.ts",
        );
    },
  );

  it("shares each moved public value and one error/schema implementation", () => {
    for (const owner of [contract, selection, editor]) {
      for (const [name, value] of Object.entries(owner))
        expect(facade[name as keyof typeof facade]).toBe(value);
    }
    expect(Object.keys(facade).sort()).toEqual(
      [
        "DynamicCommerceDesignSelectionError",
        "DynamicCommerceMigrationError",
        "DynamicCommerceRouteAuthorityError",
        "applyDynamicCommerceArchetypePage",
        "applyDynamicCommerceDesignSelection",
        "createDynamicCommerceProductMatchContext",
        "dynamicCommerceDesignSelectionSchema",
        "dynamicCommerceRouteAuthorityErrorCodes",
        "dynamicCommerceRouteForCollection",
        "dynamicCommerceRouteForProduct",
        "dynamicCommerceRouteSectionId",
        "expandDynamicCommerceRoutePages",
        "materializeCurrentDynamicCommercePresentationAuthority",
        "materializeDynamicCommerceDesignSelectionAuthority",
        "materializeDynamicCommerceDesignSelectionFromAuthority",
        "migrateLegacyDynamicCommerceRoutes",
        "projectDynamicCommerceArchetypePages",
        "registeredDynamicCommerceCollectionArchetypeId",
        "requireMigratedDynamicCommerceSnapshot",
        "resolveCollectionContextArchetype",
        "resolveDynamicCommerceRoutePage",
        "resolveDynamicCommerceRuntimeBindingPolicy",
        "resolveProductComplexityArchetype",
        "validateCurrentDynamicCommercePresentationAuthority",
        "validateDynamicCommerceDesignSelection",
      ].sort(),
    );
    const cause = new Error("retained cause");
    const error = new contract.DynamicCommerceDesignSelectionError(
      "invalid-selection",
      "exact message",
      { cause },
    );
    expect(error).toBeInstanceOf(facade.DynamicCommerceDesignSelectionError);
    expect(error.name).toBe("DynamicCommerceDesignSelectionError");
    expect(error.code).toBe("invalid-selection");
    expect(error.message).toBe("exact message");
    expect(error.cause).toBe(cause);
  });

  it.each([
    [
      "src/application/whole-storefront-generation-plan/planner.ts",
      {
        dynamicCommerceDesignSelectionSchema: "design-selection-contract",
        DynamicCommerceDesignSelection: "design-selection-contract",
        validateDynamicCommerceDesignSelection: "design-selection",
        materializeCurrentDynamicCommercePresentationAuthority: "",
      },
    ],
    [
      "src/app/projects/[projectId]/editor/editor-draft-state.ts",
      {
        applyDynamicCommerceArchetypePage: "editor-projection",
        projectDynamicCommerceArchetypePages: "editor-projection",
      },
    ],
    [
      "src/app/projects/[projectId]/editor/project-editor-client.tsx",
      {
        projectDynamicCommerceArchetypePages: "editor-projection",
      },
    ],
  ] as const)("resolves the named %s consumer to its real owner", (file, expected) => {
    const root = process.cwd();
    const path = resolve(root, file);
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const cfg = ts.readConfigFile(resolve(root, "tsconfig.json"), (path) => ts.sys.readFile(path));
    const options = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root).options;
    const found: Record<string, string> = {};
    for (const n of ast.statements.filter(ts.isImportDeclaration)) {
      const specifier = (n.moduleSpecifier as ts.StringLiteral).text;
      if (!specifier.startsWith("@/application/dynamic-commerce-routes")) continue;
      const bindings = n.importClause?.namedBindings;
      expect(bindings && ts.isNamedImports(bindings)).toBe(true);
      if (!bindings || !ts.isNamedImports(bindings)) throw new Error("Expected named imports");
      for (const imported of bindings.elements) found[imported.name.text] = specifier;
      expect(
        ts.resolveModuleName(specifier, path, options, ts.sys).resolvedModule?.resolvedFileName,
      ).toBe(
        resolve(
          root,
          specifier.replace("@/", "src/") +
            (specifier.endsWith("dynamic-commerce-routes") ? "/index.ts" : ".ts"),
        ),
      );
    }
    expect(found).toEqual(
      Object.fromEntries(
        Object.entries(expected).map(([name, leaf]) => [
          name,
          "@/application/dynamic-commerce-routes" + (leaf ? "/" + leaf : ""),
        ]),
      ),
    );
  });

  it("retains the source-only replay distinction and first validation failure", () => {
    const input = fixture();
    const chosen = design(input);
    input.catalogue.id = "wrong_catalogue";
    const before = structuredClone(input);
    expect(() =>
      selection.validateDynamicCommerceDesignSelection(input.snapshot, input.catalogue, chosen),
    ).toThrow("does not target the snapshot's current catalogue");
    expect(
      selection.materializeDynamicCommerceDesignSelectionFromAuthority(
        input.snapshot.dynamicCommercePresentation!,
        chosen,
      ),
    ).toEqual(
      facade.materializeDynamicCommerceDesignSelectionFromAuthority(
        input.snapshot.dynamicCommercePresentation!,
        chosen,
      ),
    );
    try {
      selection.validateDynamicCommerceDesignSelection(input.snapshot, input.catalogue, {
        ...chosen,
        collectionArchetypeId: "",
      });
      throw new Error("Expected invalid selection");
    } catch (error) {
      expect(error).toBeInstanceOf(contract.DynamicCommerceDesignSelectionError);
      expect((error as contract.DynamicCommerceDesignSelectionError).code).toBe(
        "invalid-selection",
      );
      expect((error as Error).cause).toBeDefined();
    }
    expect(input).toEqual(before);
  });

  it.each(["collection", "product"] as const)(
    "omits %s projections with no representative route",
    (kind) => {
      const input = fixture();
      repin(input, (a) => {
        a.routeInventory = a.routeInventory.filter((r) => r.kind !== kind);
        if (kind === "collection") a.collectionRouteMappings = [];
      });
      const before = structuredClone(input);
      const pages = editor.projectDynamicCommerceArchetypePages(
        input.snapshot,
        input.catalogue,
        {},
      );
      expect(pages).toHaveLength(3);
      expect(
        pages.every(
          (p) =>
            p.archetype.family === (kind === "collection" ? "product-detail" : "collection-search"),
        ),
      ).toBe(true);
      expect(input).toEqual(before);
    },
  );

  it("preserves collection filtering and the product-loop frame failure", () => {
    const input = fixture();
    input.snapshot.sharedFrame = { ...input.snapshot.sharedFrame!, profileId: "unknown" };
    const before = structuredClone(input);
    expect(() =>
      editor.projectDynamicCommerceArchetypePages(input.snapshot, input.catalogue),
    ).toThrow(DynamicCommerceRouteAuthorityError);
    try {
      editor.projectDynamicCommerceArchetypePages(input.snapshot, input.catalogue);
    } catch (error) {
      expect(normalizedError(error)).toEqual({
        name: "DynamicCommerceRouteAuthorityError",
        code: "incompatible-shared-frame",
        message: "The dynamic route archetype is incompatible with the current frame.",
      });
    }
    expect(input).toEqual(before);
  });

  it("preserves representative fallback, one composite and unknown-page behavior", () => {
    const input = fixture();
    const before = structuredClone(input);
    const pages = editor.projectDynamicCommerceArchetypePages(input.snapshot, input.catalogue);
    expect(
      editor.projectDynamicCommerceArchetypePages(
        input.snapshot,
        input.catalogue,
        Object.fromEntries(pages.map((p) => [p.archetype.id, "missing_route"])),
      ),
    ).toEqual(pages);
    const page = pages[0].page;
    for (const sections of [[], [...page.sections, structuredClone(page.sections[0])]])
      expect(() =>
        editor.applyDynamicCommerceArchetypePage(input.snapshot, { ...page, sections }),
      ).toThrow("An archetype must retain one composite section.");
    const unknown = editor.applyDynamicCommerceArchetypePage(input.snapshot, {
      ...page,
      id: "unknown_page",
      sections: [],
    });
    expect(unknown).toEqual(input.snapshot);
    expect(unknown).not.toBe(input.snapshot);
    expect(input).toEqual(before);
  });

  it("retains approved asset authority through a real editor change", () => {
    const input = fixture();
    const legacy = createLegacyDynamicCommerceRouteScenario().legacySnapshot;
    const page = legacy.pages.find(
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
    const archetype = createCollectionArchetype("collection-editorial-discovery", [
      {
        page,
        section: {
          ...structuredClone(section),
          approvedAssetPresentations: [presentation],
          approvedAssetPlacements: [
            {
              type: "PLACE_APPROVED_SOURCE_ASSET",
              pageId: page.id,
              componentId: section.id,
              componentType: section.component,
              assetSlotId: "collectionCommerceMedia",
              assetId: presentation.assetId,
              role: presentation.role,
              assetRevision: presentation.revision,
              materialFingerprint: presentation.materialFingerprint,
              sourceReferenceId: "source_approved",
              required: true,
            },
          ],
        },
      },
    ]);
    repin(input, (a) => {
      a.collectionSearchArchetypes = a.collectionSearchArchetypes.map((p) =>
        p.id === archetype.id ? archetype : p,
      );
    });
    const before = structuredClone(input);
    const projected = editor
      .projectDynamicCommerceArchetypePages(input.snapshot, input.catalogue)
      .find((p) => p.archetype.id === archetype.id)!.page;
    const changedPage = structuredClone(projected);
    changedPage.sections[0].visible = !changedPage.sections[0].visible;
    const changed = editor.applyDynamicCommerceArchetypePage(input.snapshot, changedPage);
    const original = input.snapshot.dynamicCommercePresentation!;
    const next = changed.dynamicCommercePresentation!;
    const assets = archetype.componentPresentations[0].approvedAssetSelections;
    expect(assets).toHaveLength(1);
    expect(
      next.collectionSearchArchetypes.find((p) => p.id === archetype.id)!.componentPresentations[0]
        .approvedAssetSelections,
    ).toEqual(assets);
    expect(next.collectionSearchArchetypes.filter((p) => p.id !== archetype.id)).toEqual(
      original.collectionSearchArchetypes.filter((p) => p.id !== archetype.id),
    );
    expect(next.productDetailArchetypes).toEqual(original.productDetailArchetypes);
    expect(next.routeInventory).toEqual(original.routeInventory);
    expect(next.authorityRevision).toBe(original.authorityRevision + 1);
    expect(changed.pages).toEqual(input.snapshot.pages);
    expect(changed.navigation).toEqual(input.snapshot.navigation);
    expect(input).toEqual(before);
  });

  it("keeps equivalent raw styles and increments only the changed authority revision", () => {
    const input = fixture();
    repin(input, (a) => {
      for (const p of a.productDetailArchetypes)
        p.componentPresentations[0].styleOverrides = { surfaceTreatment: "soft" };
    });
    const before = structuredClone(input);
    const page = editor
      .projectDynamicCommerceArchetypePages(input.snapshot, input.catalogue)
      .find((p) => p.archetype.family === "product-detail")!.page;
    expect(editor.applyDynamicCommerceArchetypePage(input.snapshot, page)).toEqual(input.snapshot);
    const edited = structuredClone(page);
    edited.sections[0].styleOverrides = { surface: "primary" };
    const changed = editor.applyDynamicCommerceArchetypePage(input.snapshot, edited);
    const original = input.snapshot.dynamicCommercePresentation!;
    expect(changed.dynamicCommercePresentation!.authorityRevision).toBe(
      original.authorityRevision + 1,
    );
    expect(changed.dynamicCommercePresentation!.routeInventory).toEqual(original.routeInventory);
    expect(changed.pages).toEqual(input.snapshot.pages);
    expect(changed.navigation).toEqual(input.snapshot.navigation);
    expect(changed.catalogueRef).toBe(input.snapshot.catalogueRef);
    expect(
      changed.dynamicCommercePresentation!.productDetailArchetypes.filter((p) => p.id !== page.id),
    ).toEqual(original.productDetailArchetypes.filter((p) => p.id !== page.id));
    expect(canonicalValueFingerprint(changed)).not.toBe(canonicalValueFingerprint(input.snapshot));
    expect(input).toEqual(before);
  });
});
