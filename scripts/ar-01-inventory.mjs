import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { builtinModules } from "node:module";

const codePattern = /\.(?:[cm]?[jt]sx?)$/u;
const textPattern = /\.(?:[cm]?[jt]sx?|json|ya?ml|css|md|svg)$/u;
const excluded = (path) =>
  /(?:^|\/)(?:node_modules|\.git|\.next|coverage|test-results|playwright-report|\.env[^/]*|Veskify_Architecture_Reset)(?:\/|$)/u.test(
    path,
  ) || /^docs\/AR_01_/u.test(path);
const sort = (items) =>
  [...items].sort((a, b) =>
    JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0,
  );
const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
const relativePath = (root, path) => relative(root, path).replaceAll("\\", "/");
const declarationNames = (name) =>
  ts.isIdentifier(name) || ts.isStringLiteral(name)
    ? [name.text]
    : (name.elements?.flatMap((entry) => (entry.name ? declarationNames(entry.name) : [])) ?? []);

export function inventory(root, base) {
  if (!/^[0-9a-f]{40}$/u.test(base)) throw new Error("--base must be a full commit SHA");
  const git = (...parts) =>
    execFileSync("git", parts, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const tree = git("ls-tree", "-r", "-z", base)
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [metadata, path] = entry.split("\t");
      const [mode, kind, object] = metadata.split(" ");
      return { path, mode, kind, object };
    });
  const entries = tree.filter(
    ({ path, mode, kind }) => !excluded(path) && mode !== "120000" && kind === "blob",
  );
  const paths = new Set(entries.map(({ path }) => path));
  const contents = new Map(
    entries
      .filter(({ path }) => textPattern.test(path))
      .map(({ path }) => [path, git("show", `${base}:${path}`)]),
  );
  if (!contents.has("tsconfig.json")) throw new Error("Audited tree has no tsconfig.json");
  // Source lookups inside the repository are pinned to Git. Installed dependency declarations
  // may be read by TypeScript resolution, but untracked/current source cannot enter the graph.
  const dependencyPath = (path) => /(?:^|\/)node_modules(?:\/|$)/u.test(path);
  const directories = new Set([
    root,
    ...[...paths].flatMap((path) => {
      const result = [];
      let directory = dirname(resolve(root, path));
      while (directory.startsWith(root) && directory !== root) {
        result.push(directory);
        directory = dirname(directory);
      }
      return result;
    }),
  ]);
  const host = {
    fileExists: (path) =>
      paths.has(relativePath(root, path)) || (dependencyPath(path) && ts.sys.fileExists(path)),
    readFile: (path) =>
      contents.get(relativePath(root, path)) ??
      (dependencyPath(path) ? ts.sys.readFile(path) : undefined),
    directoryExists: (path) =>
      directories.has(path) || (dependencyPath(path) && Boolean(ts.sys.directoryExists?.(path))),
    getCurrentDirectory: () => root,
    getDirectories: (path) =>
      dependencyPath(path)
        ? ts.sys.getDirectories(path)
        : [...directories].filter((entry) => dirname(entry) === path),
    readDirectory: () =>
      [...paths].filter((path) => codePattern.test(path)).map((path) => resolve(root, path)),
    useCaseSensitiveFileNames: true,
  };
  const parsed = ts.parseConfigFileTextToJson("tsconfig.json", contents.get("tsconfig.json"));
  if (parsed.error)
    throw new Error(ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n"));
  const config = ts.parseJsonConfigFileContent(parsed.config, host, root);
  if (config.errors.length)
    throw new Error(
      config.errors
        .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
        .join("\n"),
    );
  const cache = ts.createModuleResolutionCache(root, (path) => path, config.options);
  const aliases = Object.keys(config.options.paths ?? {});
  const localSyntax = (specifier) =>
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    aliases.some((alias) =>
      alias.includes("*")
        ? specifier.startsWith(alias.split("*")[0]) && specifier.endsWith(alias.split("*")[1])
        : alias === specifier,
    );
  const edges = [],
    unresolved = [],
    strings = [],
    files = [];
  for (const [path, text] of contents) {
    if (!codePattern.test(path) && !path.endsWith(".json")) continue;
    const source = ts.createSourceFile(
      path,
      text,
      config.options.target ?? ts.ScriptTarget.ES2022,
      true,
    );
    const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const symbols = new Map();
    const stringValues = new Set();
    const add = (node, specifier, kind, typeOnly, importedNames = []) => {
      const resolved = ts.resolveModuleName(
        specifier,
        resolve(root, path),
        config.options,
        host,
        cache,
      ).resolvedModule;
      const target = resolved ? relativePath(root, resolved.resolvedFileName) : null;
      const local = target && paths.has(target);
      const resolution = local
        ? "local"
        : builtinModules.includes(specifier) ||
            builtinModules.includes(specifier.replace(/^node:/u, ""))
          ? "node-builtin"
          : resolved
            ? "external-package"
            : localSyntax(specifier)
              ? "unresolved-local"
              : "unresolved-external";
      const guards = [];
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isIfStatement(parent)) guards.push(parent.expression.getText(source));
      }
      edges.push({
        from: path,
        line: line(node),
        specifier,
        to: local ? target : null,
        resolution,
        kind,
        typeOnly,
        importedNames,
        runtime: typeOnly ? "erased-type-syntax" : "value-syntax; emit/tree-shaking not measured",
        ...(guards.length ? { enclosingConditions: guards } : {}),
      });
    };
    const addSymbol = (name, node, kind) => symbols.set(name, { name, line: line(node), kind });
    const visit = (node) => {
      if (ts.isStringLiteralLike(node) && !stringValues.has(node.text)) {
        stringValues.add(node.text);
        strings.push({ path, line: line(node), value: node.text });
      }
      if (
        ts.isImportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        const clause = node.importClause;
        const named =
          clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
            ? clause.namedBindings.elements
            : [];
        const names = [
          ...(clause?.name
            ? [{ name: "default", local: clause.name.text, typeOnly: Boolean(clause.isTypeOnly) }]
            : []),
          ...named.map((entry) => ({
            name: entry.propertyName?.text ?? entry.name.text,
            local: entry.name.text,
            typeOnly: Boolean(clause?.isTypeOnly || entry.isTypeOnly),
          })),
        ];
        add(
          node,
          node.moduleSpecifier.text,
          clause ? "import" : "side-effect-import",
          Boolean(
            clause?.isTypeOnly ||
            (named.length && !clause?.name && named.every((entry) => entry.isTypeOnly)),
          ),
          names,
        );
      }
      if (ts.isExportDeclaration(node)) {
        const elements =
          node.exportClause && ts.isNamedExports(node.exportClause)
            ? node.exportClause.elements
            : [];
        for (const entry of elements)
          addSymbol(
            entry.name.text,
            entry,
            node.isTypeOnly || entry.isTypeOnly ? "type-re-export" : "named-export; emit-uncertain",
          );
        if (node.exportClause && ts.isNamespaceExport(node.exportClause))
          addSymbol(
            node.exportClause.name.text,
            node,
            node.isTypeOnly ? "type-namespace" : "namespace",
          );
        if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier))
          add(
            node,
            node.moduleSpecifier.text,
            node.exportClause ? "re-export" : "star-re-export",
            Boolean(
              node.isTypeOnly || (elements.length && elements.every((entry) => entry.isTypeOnly)),
            ),
            elements.map((entry) => ({
              name: entry.propertyName?.text ?? entry.name.text,
              exported: entry.name.text,
              typeOnly: Boolean(node.isTypeOnly || entry.isTypeOnly),
            })),
          );
      }
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteralLike(node.moduleReference.expression)
      )
        add(node, node.moduleReference.expression.text, "import-equals", Boolean(node.isTypeOnly));
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteralLike(node.argument.literal)
      )
        add(node, node.argument.literal.text, "import-type", true);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        const kind =
          node.expression.kind === ts.SyntaxKind.ImportKeyword ? "dynamic-import" : "require";
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument)) add(node, argument.text, kind, false);
        else
          unresolved.push({
            from: path,
            line: line(node),
            kind: `computed-${kind}`,
            expression: argument?.getText(source) ?? "missing",
          });
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ["glob", "globEager"].includes(node.expression.name.text)
      )
        unresolved.push({
          from: path,
          line: line(node),
          kind: "glob-loader",
          expression: node.getText(source),
        });
      if (ts.isExportAssignment(node)) addSymbol("default", node, "value");
      if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isVariableStatement(node))
          for (const declaration of node.declarationList.declarations)
            for (const name of declarationNames(declaration.name))
              addSymbol(name, declaration, "value");
        else if (node.name)
          for (const name of declarationNames(node.name))
            addSymbol(
              name,
              node,
              ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) ? "type" : "value",
            );
        if (node.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword))
          addSymbol("default", node, "value");
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (codePattern.test(path)) {
      const directives = source.statements
        .filter((node) => ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression))
        .map((node) => node.expression.text);
      files.push({
        path,
        sha256: hash(text),
        boundary: directives.includes("use client")
          ? "client"
          : directives.includes("use server") || /\.server\./u.test(path)
            ? "server"
            : "unspecified",
        exports: sort([...symbols.values()]),
      });
    }
  }
  // Materialize star-export names from this same source graph; retain a declaration origin.
  const fileMap = new Map(files.map((file) => [file.path, file]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges.filter((entry) => entry.kind === "star-re-export" && entry.to)) {
      const file = fileMap.get(edge.from),
        target = fileMap.get(edge.to);
      if (!file || !target) continue;
      for (const symbol of target.exports)
        if (
          symbol.name !== "default" &&
          !file.exports.some((entry) => entry.name === symbol.name)
        ) {
          file.exports.push({
            name: symbol.name,
            line: edge.line,
            kind: edge.typeOnly ? "type-re-export" : symbol.kind,
            origin: symbol.origin ?? target.path,
          });
          changed = true;
        }
    }
  }
  const entrypoints = files
    .filter(
      ({ path }) =>
        /^src\/app\//u.test(path) &&
        /\/(?:page|layout|route|default|loading|error|global-error|not-found|sitemap|robots|manifest)\.[cm]?[jt]sx?$/u.test(
          path,
        ),
    )
    .map(({ path, boundary }) => ({
      path,
      boundary,
      kind: /\/route\./u.test(path) ? "route-handler" : "Next-file-convention",
    }));
  const roleRoots = {
    "active generation": [
      "src/app/api/ai/whole-storefront-proposals/route.ts",
      "src/app/projects/new/page.tsx",
    ],
    "active scoped editing": [
      "src/app/api/ai/proposals/route.ts",
      "src/app/projects/[projectId]/editor/page.tsx",
    ],
    "compatibility/read-replay": [
      "src/app/api/storefront-publish/route.ts",
      ...entrypoints
        .filter(({ path }) => /\/(?:published|history)(?:\/|\.)/u.test(path))
        .map(({ path }) => path),
    ],
    "test/demo-only": files
      .filter(({ path }) => /^(?:tests\/|src\/data\/demo\/|src\/app\/p10b-)/u.test(path))
      .map(({ path }) => path),
  };
  const adjacency = new Map();
  for (const edge of edges)
    if (edge.to && !edge.typeOnly)
      adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  const reached = new Map();
  for (const [role, roots] of Object.entries(roleRoots)) {
    const seen = new Set(roots.filter((path) => fileMap.has(path))),
      queue = [...seen];
    for (let index = 0; index < queue.length; index++)
      for (const target of adjacency.get(queue[index]) ?? [])
        if (!seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
    reached.set(role, seen);
  }
  for (const file of files) {
    file.exports = sort(file.exports);
    file.staticReachability = [...reached]
      .filter(([, seen]) => seen.has(file.path))
      .map(([role]) => role);
    if (!file.staticReachability.length) file.staticReachability.push("unresolved");
  }
  const publicMedia = entries
    .filter(({ path }) => path.startsWith("public/"))
    .map(({ path, object }) => {
      const url = `/${path.slice(7)}`;
      const references = strings
        .filter(({ value }) => value.includes(url))
        .map(({ path, line }) => ({ path, line }));
      for (const [sourcePath, text] of contents)
        if (!codePattern.test(sourcePath) && !sourcePath.endsWith(".json") && text.includes(url))
          references.push({
            path: sourcePath,
            line: text.slice(0, text.indexOf(url)).split("\n").length,
          });
      return {
        path,
        gitBlob: object,
        localReferences: sort(references),
        externalPersistedConsumers: "unavailable; retirement blocked",
      };
    });
  const result = {
    base,
    toolVersions: { node: process.version, typescript: ts.version },
    scope: {
      source: "pinned Git blobs; installed dependency declarations for compiler resolution",
      tsconfig: "tsconfig.json",
      tsconfigSha256: hash(contents.get("tsconfig.json")),
      compilerOptions: parsed.config.compilerOptions,
      trackedFiles: entries.length,
      codeFiles: files.length,
      excludedPaths: tree.filter((entry) => !entries.includes(entry)).map(({ path }) => path),
    },
    trackedRoots: entries.map(({ path }) => path),
    entrypoints,
    scriptAndBuildRoots: entries
      .filter(
        ({ path }) =>
          /^(?:scripts\/|\.github\/|[^/]+\.(?:json|[cm]?[jt]s))$/u.test(path) ||
          path.startsWith("scripts/") ||
          path.startsWith(".github/"),
      )
      .map(({ path }) => path),
    roleRoots,
    files: sort(files),
    exactEdges: sort(edges),
    unresolvedComputedReferences: sort(unresolved),
    exactStringReferences: sort(strings),
    publicMedia,
    limitations: [
      "File-level conservative value-syntax closure includes conditional imports, broad barrels and possibly erased value imports. It is not call-level execution or a bundle measurement.",
      "test/demo-only denotes reachability from those roots; a file with another role is not exclusively test code.",
      "No merchant IndexedDB, production database, host services or external publication state was accessed. Zero local references never establishes safe removal.",
      "Nonliteral loaders remain unresolved. CommonJS exports, runtime registration and filesystem-derived dependencies may require manual tracing; source strings are evidence, not a persisted-data census.",
    ],
  };
  result.fingerprint = hash(result);
  return result;
}

export function summaryOf(result) {
  const countBy = (entries, key) =>
    Object.fromEntries(
      [...new Set(entries.map((entry) => entry[key]))]
        .sort()
        .map((value) => [value, entries.filter((entry) => entry[key] === value).length]),
    );
  return {
    base: result.base,
    toolVersions: result.toolVersions,
    scope: result.scope,
    entrypoints: result.entrypoints,
    codeFiles: result.files.length,
    edgeKinds: countBy(result.exactEdges, "kind"),
    resolutions: countBy(result.exactEdges, "resolution"),
    typeOnlyEdges: result.exactEdges.filter((edge) => edge.typeOnly).length,
    exportedSymbols: result.files.reduce((sum, file) => sum + file.exports.length, 0),
    stringReferences: result.exactStringReferences.length,
    publicMedia: result.publicMedia.length,
    unresolvedComputedReferences: result.unresolvedComputedReferences,
    fingerprint: result.fingerprint,
  };
}

export function targetsFor(result, selectors) {
  const select = (path) =>
    selectors.some((selector) =>
      selector.endsWith("/") ? path.startsWith(selector) : path === selector,
    );
  const files = new Map(result.files.map((file) => [file.path, file]));
  return result.trackedRoots.filter(select).map((path) => ({
    path,
    exportedSymbols: files.get(path)?.exports.map(({ name }) => name) ?? [],
    staticReachability: files.get(path)?.staticReachability ?? ["unresolved"],
  }));
}

export function stringConsumers(result, identity, ownPath) {
  return result.exactStringReferences.filter(
    ({ path, value }) => path !== ownPath && value === identity,
  );
}

export function checkManifest(result, manifest) {
  if (JSON.stringify(manifest.scanner) !== JSON.stringify(summaryOf(result)))
    throw new Error("Scanner facts differ; regenerate this audit record against its declared base");
  const ids = Array.from({ length: 36 }, (_, index) => `I${String(index + 1).padStart(2, "0")}`);
  if (JSON.stringify(manifest.areas.map(({ id }) => id)) !== JSON.stringify(ids))
    throw new Error("Exactly one ordered primary I01-I36 row is required");
  for (const area of manifest.areas) {
    if (
      !area.sourceSelectors?.length ||
      JSON.stringify(area.targets) !== JSON.stringify(targetsFor(result, area.sourceSelectors))
    )
      throw new Error(`${area.id}: exact targets/exports do not match audited source selectors`);
    if (!area.targets.length && !area.unavailableAuthority)
      throw new Error(`${area.id}: missing local targets or concrete unavailable authority`);
    for (const field of ["currentResponsibility", "invariant", "retirementPrerequisite"])
      if (!area[field]?.trim()) throw new Error(`${area.id}: missing ${field}`);
    for (const field of [
      "roles",
      "successor",
      "callerEntrypoints",
      "persistedOrStringReferences",
      "regressionProof",
    ])
      if (!area[field]?.length) throw new Error(`${area.id}: missing ${field}`);
    if (
      !["keep", "refactor", "isolate", "conditional-retire", "safe-remove"].includes(
        area.disposition,
      )
    )
      throw new Error(`${area.id}: unsupported disposition`);
    // This bounded local audit has no external persisted-consumer authority.
    if (area.disposition === "safe-remove")
      throw new Error(
        `${area.id}: safe-remove is unsupported by this local-only audit, including string and unavailable persisted consumers`,
      );
    for (const reference of [
      ...area.callerEntrypoints,
      ...area.persistedOrStringReferences,
      ...area.regressionProof,
    ])
      if (!result.trackedRoots.includes(reference.path))
        throw new Error(
          `${area.id}: evidence path does not exist at audit base: ${reference.path}`,
        );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    option = (name) => {
      const index = args.indexOf(name);
      return index < 0 ? undefined : args[index + 1];
    };
  const result = inventory(resolve(option("--root") ?? "."), option("--base") ?? "");
  if (option("--output")) writeFileSync(option("--output"), `${JSON.stringify(result, null, 2)}\n`);
  if (option("--check")) checkManifest(result, JSON.parse(readFileSync(option("--check"), "utf8")));
  process.stdout.write(`${JSON.stringify(summaryOf(result))}\n`);
}
