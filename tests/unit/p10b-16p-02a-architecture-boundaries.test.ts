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
const compilerRoot = join(root, "src/application/prompted-storefront-design-compiler");
const semanticCapabilityFeaturesPath = join(compilerRoot, "semantic-capability-features.ts");
const semanticInfluenceAuthorityPath = join(compilerRoot, "semantic-influence-authority.ts");
const semanticCompatibilityResolutionPath = join(
  compilerRoot,
  "semantic-compatibility-resolution.ts",
);
const semanticCompilerPath = join(compilerRoot, "semantic-compiler.ts");
const semanticExecutorPath = join(compilerRoot, "semantic-executor.ts");
const exactExecutorPath = join(compilerRoot, "executor.ts");
const factorizedSelectionPath = join(
  root,
  "src/application/bounded-storefront-synthesis/compatible-direction-selections.ts",
);
const studioHandlerPath = join(
  root,
  "src/integrations/ai/prompted-storefront-studio-handler.server.ts",
);
const proposalRoutePath = join(root, "src/app/api/ai/whole-storefront-proposals/handler.ts");

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

  it("keeps the core request and projection dependency closure outside execution lifecycles", () => {
    const closure = runtimeDependencyClosure([
      join(applicationRoot, "request.ts"),
      join(applicationRoot, "capability-projection.ts"),
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

  it("derives semantic influence from current registered compatibility authority", () => {
    const features = source(semanticCapabilityFeaturesPath);
    const influence = source(semanticInfluenceAuthorityPath);
    const resolution = source(semanticCompatibilityResolutionPath);
    const semanticRegistryFiles = sourceFiles(compilerRoot).filter((path) =>
      /(?:semantic.*registry|registry.*semantic)/u.test(path),
    );

    expect(features).toContain("getCommercialHomepageProfile");
    expect(features).toContain("getCommercialCollectionSearchProfile");
    expect(features).toContain("getCommercialPdpProfile");
    expect(features).toContain("getCommercialSharedFrameProfile");
    expect(influence).toContain("deriveSemanticInfluenceAuthority");
    expect(resolution).toContain("listCompatibleCoordinatedDirectionFactorizedCandidates");
    expect(resolution).toContain("projectionFor(selection, input.authority)");
    expect(resolution).toContain("deriveSemanticInfluenceAuthority(influenceSamples)");
    expect(semanticRegistryFiles).toEqual([]);
  });

  it("keeps semantic resolution and factorized selection outside Studio and execution lifecycles", () => {
    const metadataOnlyPaths = [
      semanticCapabilityFeaturesPath,
      semanticInfluenceAuthorityPath,
      semanticCompatibilityResolutionPath,
      factorizedSelectionPath,
    ];
    const forbiddenImports = [
      "prompted-storefront-studio",
      "storefront-draft-persistence",
      "whole-storefront-proposal-lifecycle",
      "/publishing",
      "complete-storefront-materializer",
      "storefront-templates/materializer",
      "storefront-templates/profile-materializer",
      "storefront-templates/commerce-utility-materializer",
    ] as const;

    for (const path of metadataOnlyPaths) {
      const imports = runtimeImportSpecifiers(path);
      for (const forbidden of forbiddenImports) {
        expect(
          imports.some((specifier) => specifier.includes(forbidden)),
          `${relative(root, path)} imports ${forbidden}`,
        ).toBe(false);
      }
      expect(source(path), relative(root, path)).not.toMatch(
        /\b(?:executeBoundedStorefrontSynthesis|materializeExecutablePageBlueprint)\b/u,
      );
    }
  });

  it("keeps complete storefront materialization behind the semantic and exact executors", () => {
    const semanticExecutor = source(semanticExecutorPath);
    const exactExecutor = source(exactExecutorPath);

    expect(semanticExecutor).toContain('from "./executor"');
    expect(semanticExecutor).toContain("executeExactCompiledPromptedStorefrontDecision");
    expect(exactExecutor).toContain("executeBoundedStorefrontSynthesis");
    for (const path of [
      semanticCapabilityFeaturesPath,
      semanticInfluenceAuthorityPath,
      semanticCompatibilityResolutionPath,
      semanticCompilerPath,
      factorizedSelectionPath,
    ]) {
      expect(source(path), relative(root, path)).not.toMatch(
        /\bexecuteBoundedStorefrontSynthesis\b/u,
      );
    }
  });

  it("keeps the OpenAI semantic provider independent of exact registry and compiler internals", () => {
    const providerModules = [
      providerPath,
      clientPath,
      join(root, "src/integrations/ai/openai/semantic-storefront-design-intent-v1-wire.ts"),
    ];
    const forbiddenImports = [
      "prompted-storefront-design-compiler",
      "bounded-storefront-synthesis",
      "storefront-templates",
      "whole-storefront-generation-plan",
      "components/registry",
      "dynamic-commerce-routes",
    ] as const;

    for (const path of providerModules) {
      const imports = runtimeImportSpecifiers(path);
      for (const forbidden of forbiddenImports) {
        expect(
          imports.some((specifier) => specifier.includes(forbidden)),
          `${relative(root, path)} imports ${forbidden}`,
        ).toBe(false);
      }
    }
  });

  it("routes the normal prompted Studio operation through semantic V2 without an exact-key fallback", () => {
    const normalRoute = source(proposalRoutePath);
    const studioHandler = source(studioHandlerPath);
    const provider = source(providerPath);

    expect(normalRoute).toContain("PROMPTED_STOREFRONT_STUDIO_OPERATION");
    expect(normalRoute).toContain("return promptedHandler(request)");
    expect(normalRoute.indexOf("return promptedHandler(request)")).toBeLessThan(
      normalRoute.indexOf("return legacyHandler(request)"),
    );
    expect(studioHandler).toContain("runPromptedStorefrontDesignCompilation");
    expect(studioHandler).toContain("SemanticStorefrontDesignIntentProvider");
    expect(studioHandler).not.toMatch(/\b(?:selectionId|executableIntentId)\b/u);
    expect(provider).not.toMatch(/\b(?:selectionId|executableIntentId)\b/u);
    expect(provider).not.toContain("createDeterministicWholeStorefrontPlanningProvider");
  });
});
