// @vitest-environment node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const applicationRoot = join(root, "src/application/prompted-storefront-design-intent");
const providerPath = join(
  root,
  "src/integrations/ai/openai/prompted-storefront-design-intent-v2-provider.server.ts",
);
const clientPath = join(
  root,
  "src/integrations/ai/openai/prompted-storefront-design-intent-v2-client.server.ts",
);
const capabilityManifestPath = join(root, "src/components/registry/capability-manifest.ts");
const storefrontTemplateRegistryPath = join(
  root,
  "src/application/storefront-templates/registry.ts",
);
const storefrontTemplateIndexPath = join(root, "src/application/storefront-templates/index.ts");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(entry.name)
        ? [path]
        : [];
  });
}

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function runtimeImportSpecifiers(path: string): string[] {
  const file = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true);
  return file.statements.flatMap((statement) => {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const namedBindings = clause?.namedBindings;
      const hasRuntimeBinding =
        !clause ||
        clause.name !== undefined ||
        (namedBindings !== undefined &&
          (ts.isNamespaceImport(namedBindings) ||
            namedBindings.elements.some((element) => !element.isTypeOnly)));
      return !clause?.isTypeOnly &&
        hasRuntimeBinding &&
        ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [];
    }
    return ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [];
  });
}

function resolveSourceImport(importer: string, specifier: string): string | undefined {
  const base = specifier.startsWith("@/")
    ? join(root, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? join(dirname(importer), specifier)
      : undefined;
  if (!base) return undefined;
  return [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx"), base].find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
}

function runtimeDependencyClosure(entryPaths: readonly string[]): string[] {
  const pending = [...entryPaths];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path)) continue;
    visited.add(path);
    runtimeImportSpecifiers(path).forEach((specifier) => {
      const resolved = resolveSourceImport(path, specifier);
      if (resolved && !visited.has(resolved)) pending.push(resolved);
    });
  }
  return [...visited].map((path) => relative(root, path).split("\\").join("/")).sort();
}

describe("P10B-16P-02A prompted design-intent architecture boundaries", () => {
  it("keeps request, projection and validation independent of executable storefront lifecycles", () => {
    const forbiddenDependencies = [
      'from "@/application/ai-storefront-generation"',
      'from "@/application/storefront-templates"',
      "whole-storefront-generation-plan",
      "complete-storefront-materializer",
      "bounded-storefront-synthesis",
      "whole-storefront-proposal-lifecycle",
      "ai-storefront/proposal",
      "integrations/puck",
      "/editor/",
      "/publishing/",
      "storefront-draft-persistence",
    ] as const;
    const files = sourceFiles(applicationRoot);

    expect(files.map((path) => relative(root, path).split("\\").join("/"))).toEqual(
      expect.arrayContaining([
        "src/application/prompted-storefront-design-intent/contract.ts",
        "src/application/prompted-storefront-design-intent/validation.ts",
      ]),
    );
    for (const path of files) {
      const text = source(path);
      for (const forbidden of forbiddenDependencies) {
        expect(text, `${relative(root, path)} imports ${forbidden}`).not.toContain(forbidden);
      }
      expect(text).not.toMatch(/\b(?:create|compile|materialize)(?:Storefront)?Proposal\b/u);
      expect(text).not.toMatch(/\b(?:saveDraft|publish|restore)\s*\(/u);
    }
  });

  it("isolates OpenAI SDK and environment access in the server configuration module", () => {
    const provider = source(providerPath);
    const client = source(clientPath);
    const application = sourceFiles(applicationRoot).map(source).join("\n");

    expect(provider).toMatch(/^import "server-only";/u);
    expect(client).toMatch(/^import "server-only";/u);
    expect(client).toContain('from "openai"');
    expect(client).toContain("process.env");
    expect(client).toContain("OPENAI_API_KEY");
    expect(client).toContain("maxRetries: 0");
    expect(client).toContain('logLevel: "off"');
    expect(provider).not.toContain("OPENAI_API_KEY");
    expect(provider).not.toContain("process.env");
    expect(application).not.toContain("OPENAI_API_KEY");
    expect(application).not.toContain("process.env");
    expect(`${provider}${client}${application}`).not.toContain("NEXT_PUBLIC_OPENAI");
  });

  it("keeps the Part-A OpenAI modules independent of executable planning and materialization", () => {
    for (const path of [providerPath, clientPath]) {
      const text = source(path);
      expect(text, relative(root, path)).not.toContain("whole-storefront-generation-plan");
      expect(text, relative(root, path)).not.toContain("complete-storefront-materializer");
      expect(text, relative(root, path)).not.toMatch(/from ["'][^"']*\/planner["']/u);
      expect(text, relative(root, path)).not.toContain(
        'from "@/application/prompted-storefront-design-intent"',
      );
      expect(text, relative(root, path)).not.toContain('from "./openai-provider"');
      expect(text, relative(root, path)).not.toContain('from "./contract"');
    }
  });

  it("keeps the complete runtime dependency closure outside execution lifecycles", () => {
    const closure = runtimeDependencyClosure([
      join(applicationRoot, "request.ts"),
      join(applicationRoot, "capability-projection.ts"),
      providerPath,
      clientPath,
    ]);
    const forbidden = [
      "src/application/bounded-storefront-synthesis/",
      "src/application/whole-storefront-generation-plan/",
      "src/application/whole-storefront-proposal-lifecycle/",
      "src/application/design-operations/proposals.ts",
      "src/application/storefront-templates/materializer.ts",
      "src/application/storefront-templates/profile-materializer.ts",
      "src/application/storefront-templates/commerce-utility-materializer.ts",
      "src/application/storefront-draft-persistence/",
      "src/integrations/puck/",
    ] as const;

    forbidden.forEach((dependency) => {
      expect(
        closure.some((path) => path === dependency || path.startsWith(dependency)),
        `Part-A dependency closure reaches ${dependency}`,
      ).toBe(false);
    });
  });

  it("projects capability authority without loading the storefront-template materializer barrel", () => {
    const capabilityManifest = source(capabilityManifestPath);
    const storefrontTemplateRegistry = source(storefrontTemplateRegistryPath);
    const storefrontTemplateIndex = source(storefrontTemplateIndexPath);

    expect(capabilityManifest).toContain('from "@/application/storefront-templates/contract"');
    expect(capabilityManifest).toContain('from "@/application/storefront-templates/registry"');
    expect(capabilityManifest).not.toMatch(/from ["']@\/application\/storefront-templates["']/u);
    expect(storefrontTemplateRegistry).not.toContain("commerce-utility-materializer");
    expect(storefrontTemplateIndex).toContain('export * from "./commerce-utility-materializer"');
  });

  it("keeps V2 out of the normal Studio route and proposal compiler during Part A", () => {
    const normalRoute = source(join(root, "src/app/api/ai/whole-storefront-proposals/handler.ts"));
    const runtimeAuthority = source(
      join(root, "src/integrations/ai/whole-storefront-runtime-authority.ts"),
    );

    expect(normalRoute).not.toContain("prompted-storefront-design-intent");
    expect(runtimeAuthority).not.toContain("prompted-storefront-design-intent");
  });
});
