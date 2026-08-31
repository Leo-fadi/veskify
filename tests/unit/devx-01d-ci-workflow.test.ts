// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const workflow = readFileSync(`${root}/.github/workflows/ci.yml`, "utf8");
const count = (source: string, value: string) => source.split(value).length - 1;
const jobBlock = (source: string, job: string) => {
  const header = `\n  ${job}:\n`;
  const start = source.indexOf(header);
  if (start < 0) throw new Error(`Missing job ${job}.`);
  const bodyStart = start + header.length;
  const next = source.slice(bodyStart).search(/^ {2}[a-z0-9-]+:$/gmu);
  return next < 0 ? source.slice(start) : source.slice(start, bodyStart + next);
};

describe("DEVX-01D retained parallel CI authority", () => {
  it("keeps static, sharded Vitest and production-build as independent jobs behind validate", () => {
    const aggregate = jobBlock(workflow, "validate");
    for (const job of [
      "static-checks",
      "vitest-plan",
      "vitest-shard",
      "vitest-report",
      "production-build",
    ]) {
      expect(workflow).toMatch(new RegExp(`^  ${job}:`, "mu"));
      expect(aggregate).toContain(`- ${job}`);
      expect(aggregate).toContain(`needs.${job}.result`);
    }
    expect(aggregate).toContain("if: ${{ always() }}");
  });

  it("retains every DEVX-01D command exactly once with one-worker Vitest", () => {
    for (const command of [
      "-- pnpm typecheck",
      "-- pnpm lint",
      "-- pnpm format:check",
      "-- pnpm exec vitest run --maxWorkers=1 --no-file-parallelism",
      "-- pnpm build:webpack",
      "-- pnpm build:check:storefront-budgets",
    ]) {
      expect(count(workflow, command)).toBe(1);
    }
    expect(jobBlock(workflow, "vitest-shard")).toContain("fail-fast: false");
    expect(jobBlock(workflow, "vitest-shard")).not.toContain("max-parallel:");
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

  it("permits only the dependent browser and Vitest matrix extensions", () => {
    expect(workflow).toMatch(/^ {2}vitest-plan:$/mu);
    expect(workflow).toMatch(/^ {2}vitest-shard:$/mu);
    expect(workflow).toMatch(/^ {2}vitest-report:$/mu);
    expect(workflow).toMatch(/^ {2}browser-plan:$/mu);
    expect(workflow).toMatch(/^ {2}browser-regression:$/mu);
    expect(workflow).toMatch(/^ {2}browser-report:$/mu);
    expect(jobBlock(workflow, "browser-regression")).toContain("fail-fast: false");
    expect(workflow).not.toContain("max-parallel:");
  });

  it("retains native same-PR/ref cancellation", () => {
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
  });
});
