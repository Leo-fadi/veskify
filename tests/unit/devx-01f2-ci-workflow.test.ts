// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
const plan = JSON.parse(readFileSync(resolve(root, "scripts/vitest-ci-plan.v1.json"), "utf8")) as {
  selectedShardCount: number;
  selectedShards: Array<{ shardId: string; files: string[] }>;
};

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

describe("DEVX-01F2 Vitest matrix workflow authority", () => {
  it("uses the locked plan to emit a deterministic three-row matrix", () => {
    const planJob = block("vitest-plan");
    const shardJob = block("vitest-shard");
    expect(plan.selectedShardCount).toBe(3);
    expect(plan.selectedShards).toHaveLength(3);
    expect(plan.selectedShards.flatMap(({ files }) => files)).toHaveLength(243);
    expect(planJob).toContain("pnpm exec vitest list --filesOnly --json");
    expect(planJob).toContain("node scripts/vitest-ci.mjs audit-plan");
    expect(planJob).toContain("node scripts/vitest-ci.mjs emit-matrix");
    expect(shardJob).toContain("matrix: ${{ fromJSON(needs.vitest-plan.outputs.matrix) }}");
    expect(shardJob).not.toContain("tests/unit/");
    expect(shardJob).not.toContain("matrix.files");
  });

  it("keeps each isolated shard one-worker, serial, retry-free, and failure-visible", () => {
    const shardJob = block("vitest-shard");
    expect(shardJob).toContain("fail-fast: false");
    expect(shardJob).toContain("-- pnpm exec vitest run --maxWorkers=1 --no-file-parallelism");
    expect(shardJob).toContain("--shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}");
    expect(shardJob).toContain("--reporter=blob");
    expect(shardJob).toContain("--outputFile=.ci-vitest-shards/${{ matrix.shardId }}");
    expect(shardJob).not.toContain("continue-on-error");
    expect(shardJob).not.toContain("max-parallel");
    expect(shardJob).not.toMatch(/retry|retries/iu);
    expect(occurrences(workflow, "pnpm exec vitest run")).toBe(1);
  });

  it("persists unique safe evidence and reconciles every blob before merge", () => {
    const shardJob = block("vitest-shard");
    const reportJob = block("vitest-report");
    expect(shardJob).toContain(
      "vitest-shard-evidence-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.shardId }}",
    );
    expect(shardJob).toContain(
      "vitest-shard-blob-${{ github.run_id }}-${{ github.run_attempt }}-${{ matrix.shardId }}",
    );
    expect(reportJob).toContain("node scripts/vitest-ci.mjs validate-shard-artifacts");
    expect(reportJob).toContain("pnpm exec vitest");
    expect(reportJob).toContain("--merge-reports=.ci-merged-vitest-blobs");
    expect(reportJob).toContain("--reporter=json");
    expect(reportJob).toContain("node scripts/vitest-ci.mjs validate-merged-report");
    expect(reportJob.indexOf("validate-shard-artifacts")).toBeLessThan(
      reportJob.indexOf("--merge-reports"),
    );
    expect(reportJob.indexOf("--merge-reports")).toBeLessThan(
      reportJob.indexOf("validate-merged-report"),
    );
    expect(reportJob).not.toContain("continue-on-error");
  });

  it("keeps stable validate and requires the entire Vitest and browser graphs", () => {
    const aggregate = block("validate");
    for (const job of [
      "static-checks",
      "vitest-plan",
      "vitest-shard",
      "vitest-report",
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
  });

  it("leaves static, build, browser, cancellation, and cache authority intact", () => {
    expect(block("static-checks")).toContain("-- pnpm typecheck");
    expect(block("static-checks")).toContain("-- pnpm lint");
    expect(block("static-checks")).toContain("-- pnpm format:check");
    const build = block("production-build");
    expect(build).toContain("path: .next/cache");
    expect(build.indexOf("actions/cache@v4")).toBeLessThan(build.indexOf("--id webpack-build"));
    expect(build.indexOf("--id webpack-build")).toBeLessThan(
      build.indexOf("--id storefront-budgets"),
    );
    expect(block("browser-regression")).toContain("node scripts/playwright-ci.mjs run-group");
    expect(block("browser-report")).toContain("pnpm exec playwright merge-reports");
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
    expect(occurrences(workflow, "uses: actions/cache@v4")).toBe(1);
  });
});
