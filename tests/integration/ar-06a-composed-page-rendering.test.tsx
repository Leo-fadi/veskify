import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderRegisteredSection } from "@/components/registry";
import type * as RegistryModule from "@/components/registry";
import { renderComposedStorefrontPage } from "@/components/storefront/composed-storefront-page";
import { createAr06aComposedTemplate } from "@/data/demo/ar-06a-composed-template";
import { createCompiledPageBlueprintCompositionV1 } from "@/domain/storefront/compiled-page-blueprint-composition";
import type { ComposedStorefrontSnapshotV1 } from "@/domain/storefront/storefront-composition-version";
import { ar05bStructuralDynamic } from "../helpers/ar-05b-composition-fixtures";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";

vi.mock("@/components/registry", async (original) => {
  const actual = await original<typeof RegistryModule>();
  return { ...actual, renderRegisteredSection: vi.fn(actual.renderRegisteredSection) };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.doUnmock("@/data/demo/ar-06a-composed-template");
  vi.doUnmock("next/cache");
});

type Fixture = ReturnType<typeof createAr06aComposedTemplate>;
// Browser roots contain real CSS imports, which the existing renderer-free
// helper deliberately rejects. This conservative local-source graph includes
// type edges too; CSS is retained as a verified leaf, packages as boundaries.
function browserSourceClosure(entry: string) {
  const root = process.cwd();
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), (path) => ts.sys.readFile(path));
  if (config.error) throw new Error("Unreadable TypeScript configuration");
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length) throw new Error("Invalid TypeScript configuration");
  const visited = new Set<string>();
  const pending = [resolve(root, entry)];
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    expect(existsSync(file)).toBe(true);
    visited.add(file);
    if (/\.(?:css|json)$/u.test(file)) continue;
    const source = readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const inspect = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        if (!node.arguments[0] || !ts.isStringLiteral(node.arguments[0]))
          throw new Error("Computed import cannot establish isolation: " + file);
      }
      ts.forEachChild(node, inspect);
    };
    inspect(ast);
    for (const { fileName: specifier } of ts.preProcessFile(source, true, true).importedFiles) {
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
      const literal = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2))
        : resolve(dirname(file), specifier);
      const resolved = /\.(?:css|json)$/u.test(specifier)
        ? literal
        : ts.resolveModuleName(specifier, file, parsed.options, ts.sys).resolvedModule
            ?.resolvedFileName;
      if (!resolved || !existsSync(resolved))
        throw new Error("Unresolved local source: " + specifier);
      pending.push(resolved);
    }
  }
  return [...visited].map((file) => relative(root, file));
}
function args(fixture: Fixture) {
  return {
    snapshot: fixture.snapshot,
    pageId: fixture.homeId,
    catalogue: fixture.catalogue,
    activeLocale: "en" as const,
    primaryLocale: "en" as const,
    enabledLocales: ["en", "fi"] as const,
    resolveAuthority: fixture.resolver,
  };
}
function home(snapshot: ComposedStorefrontSnapshotV1) {
  const page = snapshot.pages.find((entry) => entry.type === "home")!;
  if (!("composition" in page)) throw new Error("Expected actual composed fixture");
  return page;
}
function changeComposition(
  snapshot: ComposedStorefrontSnapshotV1,
  change: (value: ReturnType<typeof home>["composition"]) => void,
) {
  const page = home(snapshot);
  change(page.composition);
  const { compositionFingerprint: _previous, ...material } = page.composition;
  void _previous;
  page.composition = structuredClone(
    createCompiledPageBlueprintCompositionV1(material),
  ) as typeof page.composition;
}
const mutations: [string, (snapshot: ComposedStorefrontSnapshotV1) => void][] = [
  [
    "wrong owner",
    (s) =>
      changeComposition(s, (c) => {
        c.owner.id = "foreign_page";
      }),
  ],
  [
    "stale blueprint",
    (s) =>
      changeComposition(s, (c) => {
        c.blueprint.candidateFingerprint = "stale-candidate";
      }),
  ],
  [
    "stale support",
    (s) =>
      changeComposition(s, (c) => {
        c.support.implementationFingerprint = "stale-support";
      }),
  ],
  [
    "stale binding",
    (s) =>
      changeComposition(s, (c) => {
        c.bindingFingerprint = "stale-binding";
      }),
  ],
  [
    "foreign unit",
    (s) =>
      changeComposition(s, (c) => {
        c.regionAssignments[0].units[0] = { kind: "section", sectionId: "foreign_section" };
      }),
  ],
  [
    "duplicate unit",
    (s) =>
      changeComposition(s, (c) => {
        c.regionAssignments[0].units.push(c.regionAssignments[0].units[0]);
      }),
  ],
  [
    "unknown realization",
    (s) =>
      changeComposition(s, (c) => {
        c.regionAssignments[0].realizationId = "unknown-geometry";
      }),
  ],
  [
    "foreign anatomy",
    (s) =>
      changeComposition(s, (c) => {
        c.regionAssignments[0].units[0] = {
          kind: "anatomy",
          parent: { kind: "section", sectionId: home(s).sections[0].id },
          anatomySlotId: "invented",
        };
      }),
  ],
  [
    "component mismatch",
    (s) => {
      home(s).sections[0].component = "unknownComponent";
    },
  ],
  [
    "variant mismatch",
    (s) => {
      home(s).sections[0].variant = "unknownVariant";
    },
  ],
  [
    "invalid content",
    (s) => {
      home(s).sections.find((section) => section.component === "hero")!.content = {};
    },
  ],
  [
    "missing frame",
    (s) => {
      delete s.sharedFrame;
    },
  ],
  [
    "colliding frame",
    (s) => {
      s.pages
        .find((page) => page.type !== "home")!
        .sections.push(structuredClone(s.sharedFrame!.header));
    },
  ],
  [
    "invalid unselected composed owner",
    (s) => {
      const target = s.pages.find((page) => page.type !== "home")!;
      const { compositionFingerprint: _previous, ...material } = home(s).composition;
      void _previous;
      Object.assign(target, {
        composition: createCompiledPageBlueprintCompositionV1({
          ...material,
          owner: { kind: "static-page", id: target.id },
        }),
      });
    },
  ],
  [
    "invalid unselected legacy content",
    (s) => {
      s.pages.find((page) => page.type !== "home")!.sections[0].content = {};
    },
  ],
];

describe("AR-06A actual registered renderer", () => {
  it.each(["stack", "offset"] as const)(
    "renders %s once, without mutating canonical content",
    (layout) => {
      const fixture = createAr06aComposedTemplate(layout);
      const before = JSON.stringify(fixture.snapshot);
      const { container } = render(<>{renderComposedStorefrontPage(args(fixture))}</>);
      expect(container.querySelectorAll("main")).toHaveLength(1);
      expect(container.querySelectorAll("header")).toHaveLength(1);
      expect(container.querySelectorAll("footer")).toHaveLength(1);
      const ids = [...container.querySelectorAll<HTMLElement>("[data-composed-section]")].map(
        (element) => element.dataset.composedSection,
      );
      expect(ids).toEqual([
        "section_home_hero",
        "section_home_categories",
        "section_home_products",
        "section_home_campaign",
        "section_home_story",
        "section_home_benefits",
        "section_home_newsletter",
      ]);
      expect(container.querySelectorAll("[data-composed-region]")).toHaveLength(6);
      expect(container.querySelectorAll("[data-composed-pair]")).toHaveLength(
        layout === "offset" ? 1 : 0,
      );
      expect(container.textContent).toContain("Made for northern light");
      expect(container.firstElementChild?.getAttribute("style")).toContain("--brand-spacing-scale");
      expect(JSON.stringify(fixture.snapshot)).toBe(before);
      expect(Object.isFrozen(fixture.snapshot)).toBe(true);
      expect(renderRegisteredSection).toHaveBeenCalledTimes(ids.length + 3);
    },
  );
  it.each(mutations)(
    "rejects %s before any registered render and leaves inputs unchanged",
    (_label, mutate) => {
      const fixture = createAr06aComposedTemplate("offset");
      const snapshot = structuredClone(fixture.snapshot);
      mutate(snapshot);
      const before = JSON.stringify(snapshot);
      expect(() => renderComposedStorefrontPage({ ...args(fixture), snapshot })).toThrow();
      expect(renderRegisteredSection).not.toHaveBeenCalled();
      expect(JSON.stringify(snapshot)).toBe(before);
    },
  );
  it.each(["missing", "uncomposed"] as const)("rejects a %s requested page", (kind) => {
    const fixture = createAr06aComposedTemplate("stack");
    const pageId =
      kind === "missing"
        ? "foreign_page"
        : fixture.snapshot.pages.find((page) => page.type !== "home")!.id;
    expect(() => renderComposedStorefrontPage({ ...args(fixture), pageId })).toThrow();
    expect(renderRegisteredSection).not.toHaveBeenCalled();
  });
  it.each(["support", "definitions"] as const)(
    "rejects substituted %s even with copied identity fields",
    (kind) => {
      const fixture = createAr06aComposedTemplate("stack");
      expect(() =>
        renderComposedStorefrontPage({
          ...args(fixture),
          resolveAuthority: (input) => {
            const original = fixture.resolver(input);
            return kind === "support"
              ? { ...original, support: { ...original.support, resolve: () => true } }
              : {
                  ...original,
                  componentDefinitions: structuredClone(original.componentDefinitions),
                };
          },
        }),
      ).toThrow(/untrusted/u);
      expect(renderRegisteredSection).not.toHaveBeenCalled();
    },
  );
  it("specifically rejects schema-valid composed commerce before resolver or render invocation", () => {
    const fixture = createAr06aComposedTemplate("stack");
    const dynamic = ar05bStructuralDynamic();
    const resolveAuthority = vi.fn(fixture.resolver);
    expect(() =>
      renderComposedStorefrontPage({
        ...args(fixture),
        snapshot: dynamic.snapshot,
        resolveAuthority,
      }),
    ).toThrow(/composed dynamic commerce is unsupported/u);
    expect(resolveAuthority).not.toHaveBeenCalled();
    expect(renderRegisteredSection).not.toHaveBeenCalled();
  });
  it("keeps canonical validation renderer-free and normal roots isolated", () => {
    const roots = [
      "src/app/page.tsx",
      "src/app/projects/[projectId]/search/page.tsx",
      "src/components/storefront/storefront-page.tsx",
    ];
    for (const entry of roots) {
      const closure = browserSourceClosure(entry);
      expect(
        closure.some((path) =>
          /ar-06a|composed-storefront-page|composed-page-realization/u.test(path),
        ),
      ).toBe(false);
    }
    const authority = resolveRuntimeImportClosure(
      "src/application/storefront-templates/bind-storefront-composition.ts",
    );
    expect(
      authority.runtimePaths.filter((path) =>
        /src\/components\/storefront\/|\.tsx$|\.css$/u.test(path),
      ),
    ).toEqual([]);
    const route = browserSourceClosure("src/app/acceptance/ar-06a/page.tsx");
    expect(route).toContain("src/data/demo/ar-06a-composed-template.ts");
    expect(route).toContain("src/components/storefront/composed-storefront-page.tsx");
    const paths = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "src"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n");
    const callers = paths.filter(
      (path) =>
        /\.[jt]sx?$/u.test(path) &&
        /(?:from\s*|import\s*\()["'][^"']*ar-06a-composed-template["']/u.test(
          readFileSync(path, "utf8"),
        ),
    );
    expect([...new Set(callers)]).toEqual(["src/app/acceptance/ar-06a/page.tsx"]);
  });
});

describe("AR-06A acceptance route guards", () => {
  it("retains noStore before fixture loading, noindex and bounded selector forwarding", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VESKIFY_RUNTIME_MODE", "standalone");
    vi.stubEnv("VESKIFY_AR06A_ACCEPTANCE", "1");
    const events: string[] = [];
    vi.doMock("next/cache", async (importOriginal) => {
      const actual = await importOriginal<{ unstable_noStore: () => void }>();
      return {
        ...actual,
        unstable_noStore: () => {
          events.push("noStore");
          actual.unstable_noStore();
        },
      };
    });
    vi.doMock("@/data/demo/ar-06a-composed-template", () => {
      events.push("fixture-loaded");
      return { Ar06aComposedTemplatePreview: () => null };
    });
    const route = await import("@/app/acceptance/ar-06a/page");
    const result = await route.default({
      searchParams: Promise.resolve({ case: "offset", locale: "fi" }),
    });
    expect(events).toEqual(["noStore", "fixture-loaded"]);
    expect(route.metadata.robots).toEqual({ index: false, follow: false });
    expect(result.props).toEqual({ layout: "offset", locale: "fi" });
    // This proves invocation/order, not an HTTP storage or shared-cache guarantee.
  });
  it.each([
    ["production", "standalone", "1"],
    ["test", "integrated", "1"],
    ["test", "standalone", "0"],
  ])("rejects %s/%s/%s before loading fixture", async (environment, mode, flag) => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("VESKIFY_RUNTIME_MODE", mode);
    vi.stubEnv("VESKIFY_AR06A_ACCEPTANCE", flag);
    const loaded = vi.fn(() => {
      throw new Error("Fixture must not load");
    });
    vi.doMock("@/data/demo/ar-06a-composed-template", loaded);
    const route = await import("@/app/acceptance/ar-06a/page");
    await expect(route.default({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/u,
    );
    expect(loaded).not.toHaveBeenCalled();
  });
  it.each([{ case: "arbitrary" }, { locale: "de" }, { snapshot: "untrusted" }])(
    "rejects unbounded selectors before fixture load",
    async (query) => {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("VESKIFY_RUNTIME_MODE", "standalone");
      vi.stubEnv("VESKIFY_AR06A_ACCEPTANCE", "1");
      const loaded = vi.fn(() => {
        throw new Error("Fixture must not load");
      });
      vi.doMock("@/data/demo/ar-06a-composed-template", loaded);
      const route = await import("@/app/acceptance/ar-06a/page");
      await expect(route.default({ searchParams: Promise.resolve(query) })).rejects.toThrow(
        /NEXT_HTTP_ERROR_FALLBACK;404/u,
      );
      expect(loaded).not.toHaveBeenCalled();
    },
  );
});
