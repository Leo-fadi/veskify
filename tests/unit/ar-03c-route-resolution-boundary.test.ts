import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as facade from "@/application/dynamic-commerce-routes";
import * as current from "@/application/dynamic-commerce-routes/current-authority";
import * as projection from "@/application/dynamic-commerce-routes/route-projection";
import * as resolution from "@/application/dynamic-commerce-routes/route-resolution";
import { DynamicCommerceRouteAuthorityError } from "@/application/dynamic-commerce-routes/route-errors";
import { resolveProductComplexityArchetype } from "@/application/dynamic-commerce-routes/route-selection";
import {
  canonicalValueFingerprint,
  createDynamicCommercePresentationAuthority,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { createLegacyDynamicCommerceRouteScenario } from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";
import { historicalAuthority, normalizedError } from "../helpers/ar-03-route-boundary-observation";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";

const source = createLegacyDynamicCommerceRouteScenario();
const migrated = facade.migrateLegacyDynamicCommerceRoutes(source.legacySnapshot, source.catalogue);
if (migrated.status !== "migrated") throw new Error("Expected supported route fixture.");
const fixture = () => ({
  snapshot: structuredClone(migrated.snapshot),
  catalogue: structuredClone(source.catalogue),
});
const forbidden =
  /(?:\.(?:tsx|jsx|css)$|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$)|^src\/(?:app|features|services|integrations\/puck)\/|^src\/components\/registry\/(?:index|registry|legacy-registry|dynamic-commerce-bridge)\.|^src\/application\/dynamic-commerce-routes\/(?:authority|index)\.ts$|^src\/application\/(?:bounded-storefront-synthesis|publishing|accepted-snapshot-publishing|prompted-storefront-design-compiler)\/|^src\/application\/storefront-templates\/materializer\.ts$)/i;
function repin(snapshot: StorefrontSnapshot) {
  const { authorityFingerprint: _fingerprint, ...material } = snapshot.dynamicCommercePresentation!;
  void _fingerprint;
  snapshot.dynamicCommercePresentation = createDynamicCommercePresentationAuthority(material);
}
function errorFrom(run: () => unknown) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DynamicCommerceRouteAuthorityError);
    return error as DynamicCommerceRouteAuthorityError;
  }
  throw new Error("Expected the route authority to reject this input.");
}
function searchFixture() {
  const input = fixture();
  const authority = input.snapshot.dynamicCommercePresentation!;
  const route = authority.routeInventory.find((r) => r.kind === "search")!;
  const products = authority.routeInventory.flatMap((r) =>
    r.kind === "product" ? [r.productId] : [],
  );
  return {
    ...input,
    routeId: route.id,
    products,
    searchBinding: {
      canonicalRevision: `canonical-commerce-${canonicalValueFingerprint(input.catalogue)}`,
      resultProductIds: products.slice(0, 2),
    },
  };
}

describe("AR-03C route resolution boundary", () => {
  it.each(["current-authority", "route-projection", "route-resolution"])(
    "keeps the complete %s runtime graph renderer-free",
    (name) => {
      const graph = resolveRuntimeImportClosure(
        `src/application/dynamic-commerce-routes/${name}.ts`,
      );
      expect(graph.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
      expect(graph.externalRuntimeImports.map((x) => x.specifier)).toEqual(["zod"]);
      if (name !== "route-resolution")
        expect(graph.runtimePaths).not.toContain(
          "src/application/dynamic-commerce-routes/route-resolution.ts",
        );
      if (name === "route-projection")
        expect(graph.runtimePaths).not.toContain(
          "src/application/dynamic-commerce-routes/current-authority.ts",
        );
    },
  );

  it.each([
    "project-preview-client.tsx",
    "collections/[collectionSlug]/collection-preview-client.tsx",
    "products/[productSlug]/product-preview-client.tsx",
    "search/search-preview-client.tsx",
  ])("resolves %s imports to the narrow owner", (file) => {
    const root = process.cwd();
    const path = resolve(root, "src/app/projects/[projectId]", file);
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const imports = ast.statements
      .filter(ts.isImportDeclaration)
      .filter((n) =>
        (n.moduleSpecifier as ts.StringLiteral).text.includes(
          "application/dynamic-commerce-routes",
        ),
      );
    expect(imports).toHaveLength(1);
    const specifier = (imports[0].moduleSpecifier as ts.StringLiteral).text;
    expect(specifier).toBe("@/application/dynamic-commerce-routes/route-resolution");
    const config = ts.readConfigFile(resolve(root, "tsconfig.json"), (path) =>
      ts.sys.readFile(path),
    );
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
    expect(
      ts.resolveModuleName(specifier, path, options, ts.sys).resolvedModule?.resolvedFileName,
    ).toBe(resolve(root, "src/application/dynamic-commerce-routes/route-resolution.ts"));
  });

  it("shares public functions and errors without exposing private helpers", () => {
    for (const name of [
      "resolveDynamicCommerceRoutePage",
      "resolveDynamicCommerceRuntimeBindingPolicy",
      "dynamicCommerceRouteForProduct",
      "dynamicCommerceRouteForCollection",
    ] as const)
      expect(facade[name]).toBe(resolution[name]);
    expect(facade.validateCurrentDynamicCommercePresentationAuthority).toBe(
      current.validateCurrentDynamicCommercePresentationAuthority,
    );
    expect(facade.dynamicCommerceRouteSectionId).toBe(projection.dynamicCommerceRouteSectionId);
    expect(facade.DynamicCommerceRouteAuthorityError).toBe(DynamicCommerceRouteAuthorityError);
    for (const name of [
      "exactAuthority",
      "assertCurrentArchetype",
      "pageAuthority",
      "routeSection",
    ])
      expect(name in facade).toBe(false);
  });

  it("retains no-authority validation and the exact compatibility upgrade without mutation", () => {
    const { snapshot } = fixture();
    const missing = structuredClone(snapshot);
    delete missing.dynamicCommercePresentation;
    expect(current.validateCurrentDynamicCommercePresentationAuthority(missing)).toBeUndefined();
    snapshot.dynamicCommercePresentation = historicalAuthority(
      snapshot.dynamicCommercePresentation!,
    );
    const before = structuredClone(snapshot);
    const upgraded = current.exactAuthority(snapshot);
    expect(upgraded.authorityRevision).toBe(
      snapshot.dynamicCommercePresentation.authorityRevision + 1,
    );
    expect(upgraded).toEqual(
      facade.materializeCurrentDynamicCommercePresentationAuthority(snapshot, source.catalogue),
    );
    current.validateCurrentDynamicCommercePresentationAuthority(snapshot);
    expect(snapshot).toEqual(before);
  });

  it.each(["missing", "stale", "unknown"])(
    "keeps %s authority/route failure precedence",
    (kind) => {
      const input = fixture();
      const snapshot = input.snapshot;
      if (kind === "missing") delete snapshot.dynamicCommercePresentation;
      if (kind === "stale") snapshot.dynamicCommercePresentation!.authorityFingerprint = "stale";
      const before = structuredClone(input);
      const error = errorFrom(() =>
        resolution.resolveDynamicCommerceRoutePage({ ...input, routeId: "unknown" }),
      );
      expect(error.code).toBe(
        kind === "missing"
          ? "missing-authority"
          : kind === "stale"
            ? "stale-authority"
            : "unknown-route",
      );
      if (kind === "stale") expect(error.cause).toBeInstanceOf(Error);
      expect(input).toEqual(before);
    },
  );

  it("preserves exact route-ID precedence and ignores injected runtime overrides", () => {
    const input = fixture();
    const route = input.snapshot.dynamicCommercePresentation!.routeInventory.find(
      (r) => r.kind === "collection",
    )!;
    expect(
      errorFrom(() =>
        resolution.resolveDynamicCommerceRoutePage({
          ...input,
          routeId: "unknown",
          route: route.route,
        }),
      ).code,
    ).toBe("unknown-route");
    expect(
      errorFrom(() =>
        resolution.resolveDynamicCommerceRoutePage({ ...input, route: route.route + "/" }),
      ).code,
    ).toBe("unknown-route");
    const normal = resolution.resolveDynamicCommerceRoutePage({ ...input, routeId: route.id });
    // @ts-expect-error Runtime callers cannot supply an archetype override.
    const injected = resolution.resolveDynamicCommerceRoutePage({
      ...input,
      routeId: route.id,
      projection: "runtime",
      archetypeId: "unknown",
    });
    expect(injected).toEqual(normal);
    expect(
      errorFrom(() =>
        resolution.resolveDynamicCommerceRoutePage({
          ...input,
          routeId: route.id,
          projection: "editor",
          archetypeId: "unknown",
        }),
      ).code,
    ).toBe("unknown-archetype");
  });

  it.each(["profile", "variant", "content", "style", "asset"])(
    "rejects invalid current %s authority after a valid aggregate pin",
    (kind) => {
      const input = fixture();
      const authority = input.snapshot.dynamicCommercePresentation!;
      const route = authority.routeInventory.find((r) => r.kind === "collection")!;
      const id = authority.collectionRouteMappings.find((m) => m.routeId === route.id)!.archetypeId;
      const archetype = authority.collectionSearchArchetypes.find((a) => a.id === id)!;
      const presentation = archetype.componentPresentations[0];
      if (kind === "profile") archetype.profile.fingerprint = "stale-profile-fingerprint";
      if (kind === "variant") presentation.variant = "unregistered";
      if (kind === "content") presentation.content = { ...presentation.content, title: 123 };
      if (kind === "style")
        presentation.styleOverrides = { surfaceTreatment: "soft", surface: "primary" };
      if (kind === "asset")
        presentation.approvedAssetSelections = [
          {
            assetSlotId: "unknown-slot",
            assetId: "asset_approved",
            role: "editorialImage",
            assetRevision: "asset-r1",
            materialFingerprint: "approved-material",
            sourceReferenceId: "source_approved",
            required: false,
            presentation: {
              assetId: "asset_approved",
              role: "editorialImage",
              revision: "asset-r1",
              materialFingerprint: "approved-material",
              asset: {
                id: "asset_approved",
                url: "/assets/approved.jpg",
                decorative: false,
                alt: { en: "Approved image", fi: "Hyväksytty kuva" },
              },
            },
          },
        ];
      repin(input.snapshot);
      const before = structuredClone(input);
      const error = errorFrom(() =>
        resolution.resolveDynamicCommerceRoutePage({ ...input, routeId: route.id }),
      );
      expect(error.code).toBe(kind === "profile" ? "stale-profile" : "invalid-presentation");
      if (kind === "asset")
        expect(normalizedError(error.cause)).toMatchObject({
          code: "invalid-presentation",
          message:
            "The dynamic route approved asset selection is outside current registered authority.",
        });
      expect(input).toEqual(before);
    },
  );

  it("checks every registered archetype but enforces the shared frame only for selected ones", () => {
    const { snapshot } = fixture();
    const authority = snapshot.dynamicCommercePresentation!;
    const selected = new Set([
      ...authority.collectionRouteMappings.map((m) => m.archetypeId),
      ...authority.collectionContextRules.map((r) => r.archetypeId),
      authority.searchArchetypeId,
      authority.fallbacks.collectionArchetypeId,
      authority.fallbacks.searchArchetypeId,
    ]);
    const unused = authority.collectionSearchArchetypes.find(
      (a) =>
        !selected.has(a.id) &&
        snapshot.sharedFrame &&
        !a.compatibleSharedFrameProfileIds.includes(snapshot.sharedFrame.profileId),
    )!;
    expect(unused).toBeDefined();
    current.assertCurrentArchetype(snapshot, unused, false);
    expect(errorFrom(() => current.assertCurrentArchetype(snapshot, unused)).code).toBe(
      "incompatible-shared-frame",
    );
    current.validateCurrentDynamicCommercePresentationAuthority(snapshot);
    unused.profile.fingerprint = "stale-unused-profile";
    repin(snapshot);
    expect(
      errorFrom(() => current.validateCurrentDynamicCommercePresentationAuthority(snapshot)).code,
    ).toBe("stale-profile");
  });

  it.each(["absent", "stale", "duplicate", "unknown", "unrouted"])(
    "rejects %s transient search membership without storing query state",
    (kind) => {
      const input = searchFixture();
      if (kind === "unrouted") {
        input.snapshot.dynamicCommercePresentation!.routeInventory =
          input.snapshot.dynamicCommercePresentation!.routeInventory.filter(
            (r) => r.kind !== "product" || r.productId !== input.products[0],
          );
        repin(input.snapshot);
      }
      const binding =
        kind === "absent"
          ? undefined
          : kind === "stale"
            ? { canonicalRevision: "stale", resultProductIds: ["unknown", "unknown"] }
            : kind === "duplicate"
              ? { ...input.searchBinding, resultProductIds: ["unknown", "unknown"] }
              : kind === "unknown"
                ? { ...input.searchBinding, resultProductIds: ["unknown"] }
                : input.searchBinding;
      const before = structuredClone(input);
      const error = errorFrom(() =>
        resolution.resolveDynamicCommerceRoutePage({ ...input, searchBinding: binding }),
      );
      expect(error.code).toBe(
        kind === "stale"
          ? "stale-authority"
          : kind === "duplicate"
            ? "invalid-presentation"
            : "unknown-commerce-identity",
      );
      expect(error.message).toBe(
        {
          absent:
            "Search presentation requires an exact transient canonical search-result projection.",
          stale: "The transient search result revision no longer matches the canonical catalogue.",
          duplicate: "Transient search result identities must be unique.",
          unknown: "A transient search result is unavailable in the current catalogue.",
          unrouted: "A transient search result has no current public product route authority.",
        }[kind],
      );
      expect(input).toEqual(before);
    },
  );

  it("uses known-type complexity selection and unknown-type fallback, preserving native SEO aliasing", () => {
    const input = fixture();
    const authority = input.snapshot.dynamicCommercePresentation!;
    const route = authority.routeInventory.find((r) => r.kind === "product")!;
    if (route.kind !== "product") throw new Error("Expected product route");
    const product = input.catalogue.products.find((p) => p.id === route.productId)!;
    const result = resolution.resolveDynamicCommerceRoutePage({ ...input, routeId: route.id });
    expect(result.archetype.id).toBe(
      resolveProductComplexityArchetype({ product, rules: authority.productComplexityRules }),
    );
    expect(result.page.seo).toBe(product.seo);
    product.productType = "unregistered-product-type";
    expect(
      resolution.resolveDynamicCommerceRoutePage({ ...input, routeId: route.id }).archetype.id,
    ).toBe(authority.fallbacks.productDetailArchetypeId);
    input.catalogue.products = input.catalogue.products.filter((p) => p.id !== route.productId);
    expect(
      errorFrom(() => resolution.resolveDynamicCommerceRoutePage({ ...input, routeId: route.id }))
        .message,
    ).toBe("The route product is unavailable.");
  });

  it("preserves empty related bindings, locale fallback, editor IDs and expansion search omission", () => {
    const input = fixture();
    delete input.snapshot.sharedFrame;
    for (const page of input.snapshot.pages)
      if (page.pageFamily) page.pageFamily.localeCoverage = [];
    const authority = input.snapshot.dynamicCommercePresentation!;
    const route = authority.routeInventory.find((r) => r.kind === "product")!;
    if (route.kind !== "product") throw new Error("Expected product route");
    delete route.relatedProductIds;
    repin(input.snapshot);
    const resolved = resolution.resolveDynamicCommerceRoutePage({ ...input, routeId: route.id });
    expect(resolved.page.sections[0].content.relatedProductIds).toEqual([]);
    expect(resolved.page.pageFamily?.localeCoverage).toEqual(["en"]);
    const editor = resolution.resolveDynamicCommerceRoutePage({
      ...input,
      routeId: route.id,
      projection: "editor",
      archetypeId: resolved.archetype.id,
    });
    expect(editor.page.id).toBe(resolved.archetype.id);
    expect(editor.page.sections[0].id).toBe(`section_${resolved.archetype.id}`);
    const expansionInput = fixture();
    const expanded = facade.expandDynamicCommerceRoutePages(
      expansionInput.snapshot,
      expansionInput.catalogue,
    );
    expect(expanded.dynamicCommercePresentation).toBeUndefined();
    expect(expanded.pages.some((p) => p.slug === "/search")).toBe(false);
  });
});
