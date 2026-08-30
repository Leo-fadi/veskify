import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const workflow = readFileSync(resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const inventory = JSON.parse(
  readFileSync(resolve(repositoryRoot, "scripts/playwright-ci-suites.v1.json"), "utf8"),
) as { suites: Array<{ id: string; order: number; configPath: string; args: string[] }> };

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

describe("DEVX-01E CI browser timing authority", () => {
  it("keeps one canonical package entry point and the exact 12-suite inventory", () => {
    expect(packageJson.scripts["test:e2e"]).toBe("node scripts/playwright-ci.mjs run-all");
    expect(inventory.suites).toHaveLength(12);
    expect(inventory.suites.map((suite) => suite.order)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(new Set(inventory.suites.map((suite) => suite.id)).size).toBe(12);
    expect(new Set(inventory.suites.map((suite) => suite.configPath)).size).toBe(12);
  });

  it("preserves the four-job graph, validate gate, aggregate timing, and full command", () => {
    for (const job of [
      "static-checks",
      "vitest",
      "production-build",
      "browser-regression",
      "validate",
    ]) {
      expect(workflow).toMatch(new RegExp(`^  ${job}:`, "mu"));
    }
    expect(workflow).toContain("--id playwright-e2e");
    expect(occurrences(workflow, "-- pnpm test:e2e")).toBe(1);
    expect(workflow).toContain("PLAYWRIGHT_CI_TIMING_OUTPUT_DIRECTORY: .ci-playwright-timings");
    expect(workflow).not.toMatch(/^\s*matrix:/mu);
    expect(workflow).not.toContain("--shard");
  });

  it("summarizes per-suite evidence on every outcome and plans only after success", () => {
    expect(workflow).toContain("node scripts/playwright-ci.mjs summarize");
    expect(workflow).toContain("--input-directory .ci-playwright-timings");
    expect(workflow).toContain("--job-status ${{ job.status }}");
    expect(workflow).toContain("node scripts/playwright-ci.mjs plan");
    expect(workflow).toContain("playwright-suite-timing-summary.json");
    expect(workflow).toContain("playwright-balanced-group-plan.json");
    expect(workflow).toMatch(/name: Summarize Playwright suite timings[\s\S]*?if: always\(\)/u);
    expect(workflow).toMatch(
      /name: Plan future Playwright execution groups[\s\S]*?if: success\(\)/u,
    );
  });

  it("uploads only bounded timing and plan evidence without changing execution topology", () => {
    const artifactBlock = workflow.match(
      /- name: Upload Playwright suite timing evidence[\s\S]*?(?=\n {6}- name:)/u,
    )?.[0];
    expect(artifactBlock).toBeDefined();
    expect(workflow).toContain(
      "name: playwright-suite-timings-${{ github.run_id }}-${{ github.run_attempt }}",
    );
    expect(workflow).toContain(".ci-playwright-timings");
    expect(workflow).toContain(".ci-evidence/playwright-suite-timing-summary.json");
    expect(workflow).toContain(".ci-evidence/playwright-balanced-group-plan.json");
    expect(artifactBlock).toContain("include-hidden-files: true");
    expect(artifactBlock).toContain("if-no-files-found: error");
    expect(workflow).toContain("retention-days: 14");
    expect(artifactBlock).not.toContain(".next");
    expect(artifactBlock).not.toMatch(
      /playwright-(report|output)|test-results|trace|screenshots?/u,
    );
  });

  it("retains PR/ref-scoped cancellation and does not introduce parallel browser execution", () => {
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
    expect(occurrences(workflow, "pnpm test:e2e")).toBe(1);
    expect(workflow).not.toContain("strategy:");
    expect(workflow).not.toContain("max-parallel:");
  });
});
