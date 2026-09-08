import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

type RuntimeImport = Readonly<{ specifier: string; resolvedPath: string }>;

function literalSpecifier(expression: ts.Expression, context: string): string {
  if (ts.isStringLiteral(expression)) return expression.text;
  throw new Error(`Computed runtime import is unsupported: ${context}.`);
}

function hasRuntimeBinding(clause: ts.ImportClause): boolean {
  if (clause.isTypeOnly) return false;
  if (clause.name || !clause.namedBindings || ts.isNamespaceImport(clause.namedBindings))
    return true;
  return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function hasRuntimeExport(statement: ts.ExportDeclaration): boolean {
  if (statement.isTypeOnly) return false;
  if (!statement.exportClause || ts.isNamespaceExport(statement.exportClause)) return true;
  return statement.exportClause.elements.some((element) => !element.isTypeOnly);
}

function runtimeImports(source: ts.SourceFile): readonly string[] {
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      (!statement.importClause || hasRuntimeBinding(statement.importClause))
    ) {
      specifiers.push((statement.moduleSpecifier as ts.StringLiteral).text);
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      hasRuntimeExport(statement)
    ) {
      specifiers.push((statement.moduleSpecifier as ts.StringLiteral).text);
    }
  }
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        specifiers.push(literalSpecifier(node.arguments[0], "import()"));
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        specifiers.push(literalSpecifier(node.arguments[0], "require()"));
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return specifiers;
}

/** Resolves runtime imports/re-exports with the workspace TypeScript configuration. */
export function resolveRuntimeImportClosure(entryPath: string) {
  const root = process.cwd();
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), (path) => ts.sys.readFile(path));
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length > 0)
    throw new Error(ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, "\n"));
  const pending = [resolve(root, entryPath)];
  const visited = new Set<string>();
  const external = new Map<string, string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const specifier of runtimeImports(source)) {
      const resolved = ts.resolveModuleName(specifier, file, parsed.options, ts.sys).resolvedModule;
      if (!resolved) throw new Error(`Unresolved runtime import ${specifier} from ${file}.`);
      if (resolved.isExternalLibraryImport) {
        const esmRelativeRuntimeEntry = resolve(dirname(file), specifier);
        const runtimeEntry =
          specifier.startsWith(".") && existsSync(esmRelativeRuntimeEntry)
            ? esmRelativeRuntimeEntry
            : createRequire(file).resolve(specifier);
        if (!specifier.startsWith("."))
          external.set(specifier, relative(root, runtimeEntry).replaceAll("\\", "/"));
        pending.push(runtimeEntry);
      } else {
        pending.push(resolved.resolvedFileName);
      }
    }
  }
  return {
    runtimePaths: [...visited].map((path) => relative(root, path).replaceAll("\\", "/")).sort(),
    externalRuntimeImports: [...external]
      .map(([specifier, resolvedPath]) => ({ specifier, resolvedPath }))
      .sort((left, right) => left.specifier.localeCompare(right.specifier)),
  } as Readonly<{
    runtimePaths: readonly string[];
    externalRuntimeImports: readonly RuntimeImport[];
  }>;
}

/** Inspects Zod's installed ESM export path as well as any CJS resolution used by callers. */
export function resolveInstalledZodEsmClosure() {
  const root = process.cwd();
  const packageJson: unknown = JSON.parse(
    readFileSync(resolve(root, "node_modules/zod/package.json"), "utf8"),
  );
  if (!packageJson || typeof packageJson !== "object") throw new Error("Invalid Zod package JSON.");
  const exportsField = (packageJson as Readonly<Record<string, unknown>>).exports;
  if (!exportsField || typeof exportsField !== "object") throw new Error("Zod has no exports map.");
  const rootExport = (exportsField as Readonly<Record<string, unknown>>)["."];
  if (!rootExport || typeof rootExport !== "object") throw new Error("Zod has no root export.");
  const entry = (rootExport as Readonly<Record<string, unknown>>).import;
  if (typeof entry !== "string") throw new Error("Zod does not expose a string ESM import entry.");
  return resolveRuntimeImportClosure(`node_modules/zod/${entry.replace(/^\.\//u, "")}`);
}
