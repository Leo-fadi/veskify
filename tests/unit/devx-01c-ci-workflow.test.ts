// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const workflow = readFileSync(`${repositoryRoot}/.github/workflows/ci.yml`, "utf8");
const packageJson: unknown = JSON.parse(readFileSync(`${repositoryRoot}/package.json`, "utf8"));

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const objectValue = (value: unknown) => {
  if (!isObject(value)) throw new Error("Expected an object.");
  return value;
};
const scripts = objectValue(objectValue(packageJson)["scripts"]);
const count = (source: string, value: string) => source.split(value).length - 1;

const validationCommands = [
  "pnpm typecheck",
  "pnpm lint",
  "pnpm format:check",
  "pnpm exec vitest run --maxWorkers=1 --no-file-parallelism",
  "pnpm build:webpack",
  "pnpm build:check:storefront-budgets",
  "pnpm exec playwright install --with-deps chromium",
  "pnpm test:e2e",
];

describe("DEVX-01C retained CI authority", () => {
  it("retains pull-request cancellation scoped by PR or ref", () => {
    expect(workflow).toMatch(/on:\n {2}pull_request:\n/u);
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
    expect(count(workflow, "cancel-in-progress:")).toBe(1);
  });

  it("retains every validation command exactly once and isolated installs four times", () => {
    for (const command of validationCommands) expect(count(workflow, `-- ${command}`)).toBe(1);
    expect(count(workflow, "-- pnpm install --frozen-lockfile")).toBe(4);
    expect(workflow).not.toContain("continue-on-error:");
  });

  it("retains only the compatible Next incremental cache in production-build", () => {
    expect(count(workflow, "uses: actions/cache@v4")).toBe(1);
    const cacheStart = workflow.indexOf("uses: actions/cache@v4");
    const cacheEnd = workflow.indexOf("\n      - name:", cacheStart);
    const cache = workflow.slice(cacheStart, cacheEnd);
    expect(cache).toContain("path: .next/cache");
    expect(cache).toContain("${{ runner.os }}-node-24-pnpm-");
    expect(cache).toContain("hashFiles('pnpm-lock.yaml', 'package.json')");
    expect(cache).toContain(
      "hashFiles('next.config.ts', 'postcss.config.mjs', 'tsconfig.json', 'src/**', 'public/**')",
    );
    expect(cache).not.toMatch(/path:\s+\.next\s*$/mu);
    expect(cache).not.toContain(".next/server");
    expect(cache).not.toContain(".next/static");
    expect(cache).not.toContain("node_modules");
    expect(cache).not.toContain(".env");
    expect(cacheStart).toBeLessThan(workflow.indexOf("--id webpack-build"));
  });

  it("retains Webpack, budgets and the complete twelve-configuration browser command", () => {
    expect(workflow.indexOf("--id storefront-budgets")).toBeGreaterThan(
      workflow.indexOf("--id webpack-build"),
    );
    const expectedE2e =
      "playwright test && playwright test -c playwright.p10a-08c-01.config.ts && playwright test -c playwright.p10a-04c.config.ts && playwright test -c playwright.p10a-08d-02.config.ts && playwright test -c playwright.p10b-08.config.ts && playwright test -c playwright.p10b-09.config.ts && playwright test -c playwright.p10b-11.config.ts && playwright test -c playwright.p10b-13.config.ts && playwright test -c playwright.p10b-16p-03.config.ts && playwright test -c playwright.p10b-16p-06.config.ts && playwright test -c playwright.p10b-17.config.ts && playwright test -c playwright.p10b-18a.config.ts";
    expect(scripts["test:e2e"]).toBe(expectedE2e);
    expect(expectedE2e.split(" && ")).toHaveLength(12);
    expect(workflow).toContain(
      "--id playwright-e2e --output-directory .ci-timings/browser -- pnpm test:e2e",
    );
  });

  it("retains bounded always-run summaries and artifacts for every execution profile", () => {
    for (const profile of ["static", "vitest", "build", "browser"]) {
      expect(workflow).toContain(`summarize --profile ${profile}`);
      expect(workflow).toContain(
        `name: ci-timings-${profile}-\${{ github.run_id }}-\${{ github.run_attempt }}`,
      );
      expect(workflow).toContain(`.ci-timings/${profile}`);
      expect(workflow).toContain(`.ci-evidence/${profile}-summary.json`);
    }
    expect(count(workflow, "uses: actions/upload-artifact@v4")).toBe(4);
    expect(count(workflow, "include-hidden-files: true")).toBe(4);
    expect(count(workflow, "if-no-files-found: warn")).toBe(4);
    expect(count(workflow, "retention-days: 14")).toBe(4);
  });
});
