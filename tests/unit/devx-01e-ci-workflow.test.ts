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

describe("DEVX-01E retained Playwright inventory and timing authority", () => {
  it("keeps one canonical package entry point and the exact 12-suite inventory", () => {
    expect(packageJson.scripts["test:e2e"]).toBe("node scripts/playwright-ci.mjs run-all");
    expect(inventory.suites).toHaveLength(12);
    expect(inventory.suites.map((suite) => suite.order)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(new Set(inventory.suites.map((suite) => suite.id)).size).toBe(12);
    expect(new Set(inventory.suites.map((suite) => suite.configPath)).size).toBe(12);
  });

  it("retains the canonical runner and moves only browser execution to DEVX-01F groups", () => {
    expect(workflow).toContain("node scripts/playwright-ci.mjs run-group");
    expect(workflow).toContain("--id playwright-e2e");
    expect(workflow).toContain("--profile browser");
    expect(workflow).not.toContain("PLAYWRIGHT_CI_TIMING_OUTPUT_DIRECTORY");
    expect(occurrences(workflow, "pnpm test:e2e")).toBe(0);
  });

  it("retains per-suite inventory fingerprints as the source of the locked group plan", () => {
    expect(workflow).toContain("node scripts/playwright-ci.mjs audit-plan");
    expect(workflow).toContain("node scripts/playwright-ci.mjs emit-matrix");
    expect(workflow).toContain("node scripts/playwright-ci.mjs summarize-matrix");
    expect(workflow).toContain(
      "playwright-matrix-evidence-${{ github.run_id }}-${{ github.run_attempt }}",
    );
  });

  it("retains PR/ref-scoped cancellation while allowing only browser row parallelism", () => {
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("fail-fast: false");
    expect(workflow).not.toContain("max-parallel:");
    expect(workflow).not.toContain("continue-on-error");
  });
});
