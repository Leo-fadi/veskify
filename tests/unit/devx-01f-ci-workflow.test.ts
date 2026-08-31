// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
const plan = JSON.parse(
  readFileSync(resolve(root, "scripts/playwright-ci-execution-plan.v1.json"), "utf8"),
) as {
  planType: string;
  sourceInventoryFingerprint: string;
  groups: Array<{ groupId: string; entries: Array<{ suiteId: string }> }>;
};
const inventory = JSON.parse(
  readFileSync(resolve(root, "scripts/playwright-ci-suites.v1.json"), "utf8"),
) as { suites: Array<{ id: string }> };

function block(job: string) {
  const marker = `\n  ${job}:\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) throw new Error(`Missing job ${job}.`);
  const body = start + marker.length;
  const next = workflow.slice(body).search(/^ {2}[a-z0-9-]+:$/gmu);
  return next < 0 ? workflow.slice(start) : workflow.slice(start, body + next);
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

describe("DEVX-01F browser matrix workflow authority", () => {
  it("keeps static, one-worker Vitest and production-build jobs unchanged in ownership", () => {
    expect(block("static-checks")).toContain("-- pnpm typecheck");
    expect(block("static-checks")).toContain("-- pnpm lint");
    expect(block("static-checks")).toContain("-- pnpm format:check");
    expect(block("vitest")).toContain(
      "-- pnpm exec vitest run --maxWorkers=1 --no-file-parallelism",
    );
    expect(block("vitest")).not.toContain("matrix:");
    expect(block("production-build")).toContain("path: .next/cache");
    expect(block("production-build")).toContain("-- pnpm build:webpack");
    expect(block("production-build")).toContain("-- pnpm build:check:storefront-budgets");
    expect(occurrences(workflow, "uses: actions/cache@v4")).toBe(1);
  });

  it("uses the locked plan to emit only bounded group IDs into a fail-fast-false matrix", () => {
    const planJob = block("browser-plan");
    const matrixJob = block("browser-regression");
    expect(planJob).toContain("node scripts/playwright-ci.mjs audit-plan");
    expect(planJob).toContain("node scripts/playwright-ci.mjs emit-matrix");
    expect(planJob).not.toContain("playwright install");
    expect(planJob).not.toContain("cache: pnpm");
    expect(planJob).not.toContain("pnpm install");
    expect(matrixJob).toContain("needs: browser-plan");
    expect(matrixJob).toContain("fail-fast: false");
    expect(matrixJob).toContain("matrix: ${{ fromJSON(needs.browser-plan.outputs.matrix) }}");
    expect(matrixJob).toContain("--group-id ${{ matrix.groupId }}");
    expect(matrixJob).not.toContain("matrix.suite");
    expect(matrixJob).not.toContain("matrix.args");
    expect(matrixJob).not.toContain("continue-on-error");
    expect(occurrences(workflow, "node-version: 24")).toBe(6);
    expect(workflow).not.toContain("node-version: 22");
  });

  it("runs each row through the canonical runner with isolated timing and blob evidence", () => {
    const matrixJob = block("browser-regression");
    expect(matrixJob).toContain("--output-directory .ci-timings/browser-${{ matrix.groupId }}");
    expect(matrixJob).toContain("node scripts/playwright-ci.mjs run-group");
    expect(matrixJob).toContain(
      "playwright-group-evidence-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.groupId }}",
    );
    expect(matrixJob).toContain(
      "playwright-group-blobs-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.groupId }}",
    );
    expect(matrixJob).toContain("retention-days: 3");
    expect(workflow).not.toContain("pnpm test:e2e");
    expect(workflow).not.toContain("PLAYWRIGHT_CI_TIMING_OUTPUT_DIRECTORY");
  });

  it("requires exact artifact reconciliation before one merged HTML report", () => {
    const report = block("browser-report");
    expect(report).toContain("if: ${{ always() && !cancelled() }}");
    expect(report).toContain("node scripts/playwright-ci.mjs validate-group-artifacts");
    expect(report).toContain('export default { testDir: "./tests" };');
    expect(report).toContain("pnpm exec playwright merge-reports");
    expect(report).toContain("-c .ci-playwright-merge.config.mjs");
    expect(report).toContain("--reporter=html");
    expect(report).toContain(".ci-merged-blobs");
    expect(report).toContain("PLAYWRIGHT_HTML_OPEN: never");
    expect(report).toContain("PLAYWRIGHT_HTML_OUTPUT_DIR: ci-playwright-report");
    expect(report).toContain("path: ci-playwright-report");
    expect(report).toContain("if-no-files-found: error");
    expect(report).not.toContain("path: .ci-playwright-report");
    expect(report).toContain("node scripts/playwright-ci.mjs summarize-matrix");
    expect(report.indexOf("validate-group-artifacts")).toBeLessThan(
      report.indexOf("merge-reports"),
    );
    expect(report.indexOf("merge-reports")).toBeLessThan(report.indexOf("summarize-matrix"));
    expect(report).not.toContain("continue-on-error");
  });

  it("keeps stable validate authority and requires plan, every matrix row, and report", () => {
    const aggregate = block("validate");
    for (const job of [
      "static-checks",
      "vitest",
      "production-build",
      "browser-plan",
      "browser-regression",
      "browser-report",
    ]) {
      expect(aggregate).toContain(`- ${job}`);
      expect(aggregate).toContain(`needs.${job}.result`);
    }
    expect(aggregate).toContain("if: ${{ always() }}");
    expect(aggregate).not.toContain("name: Validate");
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
  });

  it("covers every canonical suite exactly once without unsupported sharding", () => {
    expect(plan.planType).toBe("whole-suite-groups");
    expect(plan.groups.map(({ groupId }) => groupId)).toEqual(["group-01", "group-02"]);
    const planned = plan.groups.flatMap(({ entries }) => entries.map(({ suiteId }) => suiteId));
    expect(planned).toHaveLength(12);
    expect(new Set(planned).size).toBe(12);
    expect(new Set(planned)).toEqual(new Set(inventory.suites.map(({ id }) => id)));
    expect(plan.sourceInventoryFingerprint).toBe(
      "veskify-playwright-suite-inventory-v1_31bfeab118c9fb0943d8b488cefa657f3c10bde56ba8d96f68aa7aa3857a2e44",
    );
  });
});
