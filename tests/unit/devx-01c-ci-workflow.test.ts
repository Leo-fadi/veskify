// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const workflow = readFileSync(`${repositoryRoot}/.github/workflows/ci.yml`, "utf8");

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const objectValue = (value: unknown): Record<string, unknown> => {
  if (!isObjectRecord(value)) throw new Error("Expected a JSON object.");
  return value;
};

const packageValue: unknown = JSON.parse(readFileSync(`${repositoryRoot}/package.json`, "utf8"));
const packageJson = objectValue(packageValue);
const packageScripts = objectValue(packageJson["scripts"]);

const expectedIds = [
  "install",
  "typecheck",
  "lint",
  "format-check",
  "vitest",
  "webpack-build",
  "storefront-budgets",
  "playwright-install",
  "playwright-e2e",
];

const expectedCommands = [
  "pnpm install --frozen-lockfile",
  "pnpm typecheck",
  "pnpm lint",
  "pnpm format:check",
  "pnpm exec vitest run --maxWorkers=1 --no-file-parallelism",
  "pnpm build:webpack",
  "pnpm build:check:storefront-budgets",
  "pnpm exec playwright install --with-deps chromium",
  "pnpm test:e2e",
];

const timedRunLines = [
  ...workflow.matchAll(/^\s+run: (node scripts\/ci-timing\.mjs run .+)$/gmu),
].map((match) => match[1]);

const count = (source: string, value: string) => source.split(value).length - 1;

describe("DEVX-01C canonical CI workflow", () => {
  it("retains the pull-request trigger and one serial validate job identity", () => {
    expect(workflow).toMatch(/on:\n {2}pull_request:\n/u);
    expect(workflow).toContain("jobs:\n  validate:\n    runs-on: ubuntu-latest");
    const jobs = workflow.slice(workflow.indexOf("jobs:"));
    expect([...jobs.matchAll(/^ {2}([a-zA-Z0-9_-]+):$/gmu)].map((match) => match[1])).toEqual([
      "validate",
    ]);
    expect(workflow).not.toContain("matrix:");
    expect(workflow).not.toContain("max-parallel:");
    expect(workflow).not.toContain("continue-on-error:");
  });

  it("uses native PR/ref-scoped cancellation without a global concurrency group", () => {
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).not.toMatch(/group:\s+ci\s*$/mu);
    expect(count(workflow, "cancel-in-progress:")).toBe(1);
  });

  it("wraps every existing validation command exactly once in unchanged order", () => {
    expect(timedRunLines).toHaveLength(expectedCommands.length);
    expect(
      timedRunLines.map((line) => {
        const match = line.match(
          /^node scripts\/ci-timing\.mjs run --id ([a-z0-9-]+) --output-directory \.ci-timings -- (.+)$/u,
        );
        if (!match) throw new Error(`Malformed timed workflow command: ${line}`);
        return { id: match[1], command: match[2] };
      }),
    ).toEqual(expectedIds.map((id, index) => ({ id, command: expectedCommands[index] })));
    for (const command of expectedCommands) {
      expect(count(timedRunLines.join("\n"), `-- ${command}`)).toBe(1);
    }
  });

  it("caches only compatible Next.js incremental cache authority before Webpack", () => {
    const cacheStart = workflow.indexOf("uses: actions/cache@v4");
    const cacheEnd = workflow.indexOf("\n      - name:", cacheStart);
    const cacheBlock = workflow.slice(cacheStart, cacheEnd);

    expect(cacheStart).toBeGreaterThan(0);
    expect(cacheBlock).toContain("path: .next/cache");
    expect(cacheBlock).toContain("${{ runner.os }}-node-24-pnpm-");
    expect(cacheBlock).toContain("hashFiles('pnpm-lock.yaml', 'package.json')");
    expect(cacheBlock).toContain(
      "hashFiles('next.config.ts', 'postcss.config.mjs', 'tsconfig.json', 'src/**', 'public/**')",
    );
    expect(cacheBlock).toContain("restore-keys: |");
    expect(cacheBlock).not.toMatch(/path:\s+\.next\s*$/mu);
    expect(cacheBlock).not.toContain(".next/server");
    expect(cacheBlock).not.toContain(".next/static");
    expect(cacheBlock).not.toContain("node_modules");
    expect(cacheBlock).not.toContain(".env");
    expect(cacheStart).toBeLessThan(workflow.indexOf("--id webpack-build"));
  });

  it("always executes Webpack once and budgets once immediately afterward", () => {
    const build = workflow.indexOf("--id webpack-build");
    const budgets = workflow.indexOf("--id storefront-budgets");
    const playwrightInstall = workflow.indexOf("--id playwright-install");

    expect(count(workflow, "-- pnpm build:webpack")).toBe(1);
    expect(count(workflow, "-- pnpm build:check:storefront-budgets")).toBe(1);
    expect(build).toBeGreaterThan(0);
    expect(budgets).toBeGreaterThan(build);
    expect(playwrightInstall).toBeGreaterThan(budgets);
    expect(workflow.slice(build, budgets)).not.toContain("if:");
  });

  it("retains the complete Playwright command and all twelve reached configurations", () => {
    const expectedE2e =
      "playwright test && playwright test -c playwright.p10a-08c-01.config.ts && playwright test -c playwright.p10a-04c.config.ts && playwright test -c playwright.p10a-08d-02.config.ts && playwright test -c playwright.p10b-08.config.ts && playwright test -c playwright.p10b-09.config.ts && playwright test -c playwright.p10b-11.config.ts && playwright test -c playwright.p10b-13.config.ts && playwright test -c playwright.p10b-16p-03.config.ts && playwright test -c playwright.p10b-16p-06.config.ts && playwright test -c playwright.p10b-17.config.ts && playwright test -c playwright.p10b-18a.config.ts";
    expect(packageScripts["test:e2e"]).toBe(expectedE2e);
    const configurations = expectedE2e.split(" && ");
    expect(configurations).toHaveLength(12);
    expect(configurations[0]).toBe("playwright test");
    expect(configurations.at(-1)).toBe("playwright test -c playwright.p10b-18a.config.ts");
    expect(workflow).toContain(
      "--id playwright-e2e --output-directory .ci-timings -- pnpm test:e2e",
    );
  });

  it("always summarizes and uploads only bounded timing evidence", () => {
    const summaryStart = workflow.indexOf("- name: Summarize CI timings");
    const artifactStart = workflow.indexOf("- name: Upload CI timing evidence");
    const artifactBlock = workflow.slice(artifactStart);

    expect(summaryStart).toBeGreaterThan(workflow.indexOf("--id playwright-e2e"));
    expect(workflow.slice(summaryStart, artifactStart)).toContain("if: always()");
    expect(workflow.slice(summaryStart, artifactStart)).toContain(
      "summarize --input-directory .ci-timings --output .ci-evidence/ci-timing-summary.json",
    );
    expect(artifactBlock).toContain("if: always()");
    expect(artifactBlock).toContain("uses: actions/upload-artifact@v4");
    expect(artifactBlock).toContain(
      "name: ci-timings-${{ github.run_id }}-${{ github.run_attempt }}",
    );
    expect(artifactBlock).toContain("if-no-files-found: warn");
    expect(artifactBlock).toContain("retention-days: 14");
    expect(artifactBlock).toContain(".ci-timings");
    expect(artifactBlock).toContain(".ci-evidence/ci-timing-summary.json");
    expect(artifactBlock).not.toContain(".next");
    expect(artifactBlock).not.toContain("test-results");
    expect(artifactBlock).not.toContain("playwright-report");
  });
});
