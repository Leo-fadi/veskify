// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/ar-01-inventory.mjs");
type InventoryFacts = {
  exactEdges: { to?: string }[];
  unresolvedComputedReferences: unknown[];
  files: { path: string; exports: { name: string }[] }[];
  entrypoints: unknown[];
  publicMedia: { localReferences: unknown[] }[];
};
type FixtureInput = {
  fixture: string;
  fixtureBase: string;
  output: string;
  manifest: string;
  facts: InventoryFacts;
  summary: { base: string; codeFiles: number; exportedSymbols: number };
};
// Pinned repository regeneration is the separate required VALIDATION-01 command.
// Unit checks use a temporary tracked tree so shallow CI needs no historical fetch.
function withFixture(run: (input: FixtureInput) => void) {
  const fixture = mkdtempSync(join(tmpdir(), "ar-01-inventory-"));
  const write = (path: string, value: string) => {
    mkdirSync(dirname(join(fixture, path)), { recursive: true });
    writeFileSync(join(fixture, path), value);
  };
  try {
    write(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@/*": ["src/*"] },
          moduleResolution: "bundler",
          module: "esnext",
          allowJs: false,
        },
      }),
    );
    write(
      "src/value.ts",
      'throw new Error("Application source must never execute"); export const value = 1; export type Item = { id: string }; export class Model {}; export default function factory() {}\n',
    );
    write(
      "src/barrel.ts",
      "export * from './value'; export { value as renamed } from './value'; export type { Item } from './value';\n",
    );
    write(
      "src/consumer.ts",
      "import { type Item } from '@/value'; import type { Model } from './value'; import('./value'); import(name); require(moduleName); import './missing'; import 'missing-package'; type Lazy = import('./value').Item;\n",
    );
    write("scripts/tool.mjs", "import { value } from '../src/value'; import fs from 'node:fs';\n");
    write("src/app/page.tsx", '"use client"; export default function Page() { return null; }\n');
    write(
      "src/app/api/example/route.ts",
      'export function GET() { if (process.env.NODE_ENV !== "production") return import("../../../value"); }\n',
    );
    write("src/legacy.ts", 'export const componentId = "retired-widget";\n');
    write(
      "tests/saved-publication.json",
      '{"component":"retired-widget","image":"/seed-assets/logo.svg"}\n',
    );
    write("public/seed-assets/logo.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
    execFileSync("git", ["init", "-q"], { cwd: fixture });
    execFileSync("git", ["add", "."], { cwd: fixture });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=AR01",
        "-c",
        "user.email=ar01@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-qm",
        "synthetic audit input",
      ],
      { cwd: fixture },
    );
    const fixtureBase = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: fixture,
      encoding: "utf8",
    }).trim();
    // An untracked source file must not silently resolve an unresolved base import.
    write("src/missing.ts", "export const late = true;\n");
    const output = join(fixture, "inventory.json");
    const summaryOutput = execFileSync(
      process.execPath,
      [script, "--root", fixture, "--base", fixtureBase, "--output", output],
      { encoding: "utf8" },
    );
    const facts = JSON.parse(readFileSync(output, "utf8")) as InventoryFacts;
    const summary = JSON.parse(summaryOutput) as FixtureInput["summary"];
    const manifest = join(fixture, "manifest.json");
    execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      'const scan=await import(process.argv[1]); const fs=await import("node:fs"); const graph=JSON.parse(fs.readFileSync(process.argv[2],"utf8")); const areas=Array.from({length:36},(_,i)=>({id:`I${String(i+1).padStart(2,"0")}`,sourceSelectors:["src/legacy.ts"],targets:scan.targetsFor(graph,["src/legacy.ts"]),currentResponsibility:"Synthetic stored identity",invariant:"Preserve replay",retirementPrerequisite:"External evidence unavailable",roles:["compatibility/read-replay"],successor:["AR-02"],disposition:"keep",callerEntrypoints:[{path:"tests/saved-publication.json"}],persistedOrStringReferences:[{path:"tests/saved-publication.json"}],regressionProof:[{path:"scripts/tool.mjs"}]})); fs.writeFileSync(process.argv[3],JSON.stringify({scanner:scan.summaryOf(graph),areas}));',
      pathToFileURL(script).href,
      output,
      manifest,
    ]);
    run({ fixture, fixtureBase, output, manifest, facts, summary });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe("AR-01 compiler-resolved inventory", () => {
  it("regenerates exact target/export facts and rejects invented exports", () => {
    withFixture(({ fixture, fixtureBase, manifest, summary }) => {
      expect(summary.base).toBe(fixtureBase);
      expect(summary.codeFiles).toBeGreaterThan(0);
      expect(summary.exportedSymbols).toBeGreaterThan(0);
      const check = () =>
        execFileSync(
          process.execPath,
          [script, "--root", fixture, "--base", fixtureBase, "--check", manifest],
          { encoding: "utf8", stdio: "pipe" },
        );
      expect(JSON.parse(check()) as unknown).toEqual(summary);
      const changed = JSON.parse(readFileSync(manifest, "utf8")) as {
        areas: { targets: { exportedSymbols: string[] }[] }[];
      };
      changed.areas[0].targets[0].exportedSymbols.push("inventedExport");
      writeFileSync(manifest, JSON.stringify(changed));
      expect(check).toThrow(/exact targets\/exports do not match/);
    });
  });

  it("retains alias, type/value, JS, dynamic, route and non-import persisted consumers without executing source", () => {
    withFixture(({ facts, output }) => {
      expect(facts.exactEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            from: "src/consumer.ts",
            specifier: "@/value",
            typeOnly: true,
            to: "src/value.ts",
          }),
          expect.objectContaining({ kind: "re-export", typeOnly: false, to: "src/value.ts" }),
          expect.objectContaining({ kind: "re-export", typeOnly: true, to: "src/value.ts" }),
          expect.objectContaining({ kind: "dynamic-import", to: "src/value.ts" }),
          expect.objectContaining({ kind: "import-type", typeOnly: true, to: "src/value.ts" }),
          expect.objectContaining({ from: "scripts/tool.mjs", to: "src/value.ts" }),
          expect.objectContaining({ specifier: "node:fs", resolution: "node-builtin" }),
          expect.objectContaining({ specifier: "./missing", resolution: "unresolved-local" }),
          expect.objectContaining({
            specifier: "missing-package",
            resolution: "unresolved-external",
          }),
        ]),
      );
      expect(facts.unresolvedComputedReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "computed-dynamic-import" }),
          expect.objectContaining({ kind: "computed-require" }),
        ]),
      );
      expect(
        facts.files
          .find((file) => file.path === "src/barrel.ts")
          ?.exports.map((entry) => entry.name),
      ).toEqual(expect.arrayContaining(["value", "Item", "Model", "renamed"]));
      expect(facts.entrypoints).toContainEqual(
        expect.objectContaining({ path: "src/app/page.tsx", boundary: "client" }),
      );
      expect(facts.publicMedia[0].localReferences).toContainEqual(
        expect.objectContaining({ path: "tests/saved-publication.json" }),
      );
      const consumers = execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          'const scan=await import(process.argv[1]); const fs=await import("node:fs"); const graph=JSON.parse(fs.readFileSync(process.argv[2],"utf8")); console.log(JSON.stringify(scan.stringConsumers(graph,"retired-widget","src/legacy.ts")));',
          pathToFileURL(script).href,
          output,
        ],
        { encoding: "utf8" },
      );
      expect(JSON.parse(consumers)).toContainEqual(
        expect.objectContaining({ path: "tests/saved-publication.json", value: "retired-widget" }),
      );
      expect(facts.exactEdges.some((edge) => edge.to === "src/legacy.ts")).toBe(false);
      // This identity has no import consumer, but does have a stored/string consumer.
      expect((JSON.parse(consumers) as unknown[]).length).toBeGreaterThan(0);
    });
  });

  it("rejects removal claims without external persisted-consumer proof", () => {
    withFixture(({ fixture, fixtureBase, manifest }) => {
      const changed = JSON.parse(readFileSync(manifest, "utf8")) as {
        areas: { disposition: string }[];
      };
      changed.areas[0].disposition = "safe-remove";
      writeFileSync(manifest, JSON.stringify(changed));
      expect(() =>
        execFileSync(
          process.execPath,
          [script, "--root", fixture, "--base", fixtureBase, "--check", manifest],
          { encoding: "utf8", stdio: "pipe" },
        ),
      ).toThrow(/safe-remove is unsupported/);
    });
  });
});
