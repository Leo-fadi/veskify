import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as registry from "@/components/registry";
import { collectLiveRendererRegistrations } from "@/components/registry/renderer-observation";
import { createLiveRendererConformanceReport } from "@/components/registry/live-renderer-conformance";
import { createRendererConformanceReport } from "@/components/registry/renderer-conformance";

const baselineObservationSha256 =
  "327e5c03f9464088f9d7bccaf56e5c6204ee4b0c0f5c2e8824ab2aa8686a60d9";

function assertRecursivelyFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach(assertRecursivelyFrozen);
}

// Resolve only this slice's direct imports using the same compiler/configuration as AR-01.
function directImports(file: string) {
  const root = process.cwd();
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), (path) => ts.sys.readFile(path));
  expect(config.error).toBeUndefined();
  const { options, errors } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  expect(errors).toEqual([]);
  const filename = resolve(root, "src/components/registry", file);
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  return source.statements.filter(ts.isImportDeclaration).map((statement) => {
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text;
    const resolved = ts.resolveModuleName(specifier, filename, options, ts.sys).resolvedModule;
    expect(resolved, specifier).toBeDefined();
    const bindings = statement.importClause?.namedBindings;
    const typeOnly = Boolean(
      statement.importClause?.isTypeOnly ||
      (!statement.importClause?.name &&
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((binding) => binding.isTypeOnly)),
    );
    return { path: relative(root, resolved!.resolvedFileName).replaceAll("\\", "/"), typeOnly };
  });
}

describe("AR-02A renderer observation boundary", () => {
  it("preserves the complete observed material and frozen live outputs", () => {
    const observed = {
      registrations: collectLiveRendererRegistrations(),
      report: createLiveRendererConformanceReport(),
    };

    assertRecursivelyFrozen(observed.registrations);
    assertRecursivelyFrozen(observed.report);
    expect(
      createHash("sha256")
        .update(`${JSON.stringify(observed, null, 2)}\n`)
        .digest("hex"),
    ).toBe(baselineObservationSha256);
  });

  it("keeps compatible public identities and uses leaf-only extracted boundaries", () => {
    expect(registry.collectLiveRendererRegistrations).toBe(collectLiveRendererRegistrations);
    expect(registry.createLiveRendererConformanceReport).toBe(createLiveRendererConformanceReport);
    expect(registry.createRendererConformanceReport).toBe(createRendererConformanceReport);

    const observation = directImports("renderer-observation.ts");
    const live = directImports("live-renderer-conformance.ts");
    const evaluator = directImports("renderer-conformance.ts");
    const registryPath = (name: string) => `src/components/registry/${name}.ts`;
    expect(observation.filter(({ path }) => path === registryPath("renderer-conformance"))).toEqual(
      [{ path: registryPath("renderer-conformance"), typeOnly: true }],
    );
    const runtimeMaps = [
      "src/components/storefront/dynamic-collection-commerce.tsx",
      "src/components/storefront/dynamic-product-detail.tsx",
      "src/components/storefront/homepage-commerce.tsx",
      "src/components/registry/content-support-bridge.tsx",
      registryPath("v2-registry"),
      registryPath("registry"),
    ];
    for (const path of runtimeMaps) expect(observation).toContainEqual({ path, typeOnly: false });
    for (const path of [
      registryPath("renderer-conformance"),
      registryPath("renderer-observation"),
      registryPath("capability-manifest"),
      registryPath("v2-registry"),
      "src/application/storefront-templates/registry.ts",
    ])
      expect(live).toContainEqual({ path, typeOnly: false });
    for (const entries of [observation, live])
      expect(entries.map(({ path }) => path)).not.toContain(registryPath("index"));
    for (const path of [
      ...runtimeMaps.filter((path) => path !== registryPath("registry")),
      registryPath("renderer-observation"),
      registryPath("live-renderer-conformance"),
      registryPath("capability-manifest"),
    ])
      expect(evaluator.map(({ path }) => path)).not.toContain(path);
  });
});
