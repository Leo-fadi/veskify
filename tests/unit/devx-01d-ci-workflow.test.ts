// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const workflow = readFileSync(`${root}/.github/workflows/ci.yml`, "utf8");
const count = (source: string, value: string) => source.split(value).length - 1;
const jobNames = (source: string) =>
  [...source.slice(source.indexOf("jobs:")).matchAll(/^ {2}([a-z0-9-]+):$/gmu)].map(
    (match) => match[1],
  );
const jobBlock = (source: string, job: string) => {
  const header = `\n  ${job}:\n`;
  const start = source.indexOf(header);
  if (start < 0) throw new Error(`Missing job ${job}.`);
  const bodyStart = start + header.length;
  const next = source.slice(bodyStart).search(/^ {2}[a-z0-9-]+:$/gmu);
  return next < 0 ? source.slice(start) : source.slice(start, bodyStart + next);
};
const validateGraph = (source: string) => {
  expect(jobNames(source)).toEqual([
    "static-checks",
    "vitest",
    "production-build",
    "browser-regression",
    "validate",
  ]);
  const aggregate = jobBlock(source, "validate");
  expect(aggregate).toContain("if: always()");
  for (const job of ["static-checks", "vitest", "production-build", "browser-regression"]) {
    expect(aggregate).toContain(`- ${job}`);
    expect(aggregate).toContain(`needs.${job}.result`);
  }
  expect(aggregate).toContain('test "$decision" = "PASS"');
  expect(aggregate).not.toContain("ci-timing.mjs run");
};

describe("DEVX-01D parallel CI graph", () => {
  it("runs four independent execution jobs behind stable validate authority", () => {
    validateGraph(workflow);
    expect(workflow).not.toContain("matrix:");
    expect(workflow).not.toContain("max-parallel:");
  });

  it("assigns each unchanged validation command to exactly one intended job", () => {
    const expected = {
      "static-checks": ["pnpm typecheck", "pnpm lint", "pnpm format:check"],
      vitest: ["pnpm exec vitest run --maxWorkers=1 --no-file-parallelism"],
      "production-build": ["pnpm build:webpack", "pnpm build:check:storefront-budgets"],
      "browser-regression": ["pnpm exec playwright install --with-deps chromium", "pnpm test:e2e"],
    } as const;
    for (const [job, commands] of Object.entries(expected)) {
      const block = jobBlock(workflow, job);
      expect(count(block, "-- pnpm install --frozen-lockfile")).toBe(1);
      for (const command of commands) {
        expect(count(block, `-- ${command}`)).toBe(1);
        expect(count(workflow, `-- ${command}`)).toBe(1);
      }
    }
  });

  it("keeps build cache and budgets inside production-build in strict order", () => {
    const block = jobBlock(workflow, "production-build");
    const cache = block.indexOf("uses: actions/cache@v4");
    const build = block.indexOf("--id webpack-build");
    const budgets = block.indexOf("--id storefront-budgets");
    expect(cache).toBeGreaterThan(0);
    expect(cache).toBeLessThan(build);
    expect(build).toBeLessThan(budgets);
    expect(block).toContain("path: .next/cache");
    expect(workflow.replace(block, "")).not.toContain("actions/cache@v4");
  });

  it("keeps the complete browser command in one unsharded job", () => {
    const block = jobBlock(workflow, "browser-regression");
    expect(block).toContain("-- pnpm test:e2e");
    expect(block).not.toContain("--shard");
    expect(block).not.toContain("matrix:");
    expect(count(workflow, "-- pnpm test:e2e")).toBe(1);
  });

  it.each([
    [
      "missing required job",
      (source: string) => source.replace("  static-checks:\n", "  omitted-static:\n"),
    ],
    ["missing dependency", (source: string) => source.replace("      - production-build\n", "")],
    ["weak aggregate", (source: string) => source.replace('test "$decision" = "PASS"', "true")],
  ])("fails closed for %s drift", (_label, mutate) => {
    expect(() => validateGraph(mutate(workflow))).toThrow();
  });

  it("retains native same-PR/ref cancellation", () => {
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
  });
});
