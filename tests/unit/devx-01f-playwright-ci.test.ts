// @vitest-environment node

import {
  chmodSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const runner = resolve(repositoryRoot, "scripts/playwright-ci.mjs");
const planPath = resolve(repositoryRoot, "scripts/playwright-ci-execution-plan.v1.json");
const lockedInventoryFingerprint =
  "veskify-playwright-suite-inventory-v1_31bfeab118c9fb0943d8b488cefa657f3c10bde56ba8d96f68aa7aa3857a2e44";
const expectedGroups = ["group-01", "group-02"];
const runId = "33335864920";
const runAttempt = "1";

function runRunner(args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
}

function writePlan(root: string, mutate: (value: Record<string, unknown>) => void) {
  const value = JSON.parse(readFileSync(planPath, "utf8")) as Record<string, unknown>;
  mutate(value);
  const output = join(root, "plan.json");
  writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`);
  return output;
}

function makeFakePnpm(root: string) {
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  const executable = join(bin, "pnpm");
  writeFileSync(
    executable,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$DEVX01F_FAKE_LOG"
case "$*" in
  *"$DEVX01F_FAIL_MATCH"*)
    if [ -n "$DEVX01F_FAIL_MATCH" ]; then exit "$DEVX01F_FAIL_CODE"; fi
    ;;
esac
printf 'bounded blob for %s\\n' "$*" > "$PLAYWRIGHT_BLOB_OUTPUT_FILE"
`,
    { mode: 0o700 },
  );
  chmodSync(executable, 0o700);
  return bin;
}

function browserTimingSummary(groupDuration: number) {
  const startedAtUtc = "2026-08-31T00:00:00.000Z";
  const completedAtUtc = "2026-08-31T00:00:01.000Z";
  const steps = [
    ["install", 100],
    ["playwright-install", 200],
    ["playwright-e2e", groupDuration],
  ].map(([stepId, durationMs]) => ({
    schemaVersion: "1.0.0",
    recordType: "ci-command-timing",
    stepId,
    status: "success",
    startedAtUtc,
    completedAtUtc,
    durationMs,
    exitCode: 0,
    signal: null,
  }));
  return {
    schemaVersion: "1.0.0",
    recordType: "ci-timing-summary",
    profile: "browser",
    jobStatus: "success",
    complete: true,
    expectedStepCount: 3,
    completedStepCount: 3,
    measuredTotalDurationMs: 300 + groupDuration,
    steps,
    slowestCompletedSteps: [...steps]
      .sort((left, right) => Number(right.durationMs) - Number(left.durationMs))
      .map(({ stepId, durationMs }) => ({ durationMs, stepId })),
  };
}

function executeBothGroups(root: string) {
  const fakeLog = join(root, "fake-pnpm.log");
  const bin = makeFakePnpm(root);
  const output = join(root, "groups");
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    DEVX01F_FAKE_LOG: fakeLog,
    DEVX01F_FAIL_MATCH: "",
    DEVX_SECRET_CANARY: "must-never-enter-evidence",
  };
  for (const groupId of expectedGroups) {
    const result = runRunner(
      ["run-group", "--group-id", groupId, "--output-directory", output],
      env,
    );
    expect(result.status, result.stderr).toBe(0);
  }
  return { output, fakeLog };
}

function stageDownloadedArtifacts(root: string, groupOutput: string) {
  const evidence = join(root, "downloaded", "evidence");
  const blobs = join(root, "downloaded", "blobs");
  mkdirSync(evidence, { recursive: true });
  mkdirSync(blobs, { recursive: true });
  for (const groupId of expectedGroups) {
    const source = join(groupOutput, groupId);
    const evidenceArtifact = join(
      evidence,
      `playwright-group-evidence-${runId}-${runAttempt}-${groupId}`,
    );
    const blobArtifact = join(blobs, `playwright-group-blobs-${runId}-${runAttempt}-${groupId}`);
    mkdirSync(evidenceArtifact, { recursive: true });
    cpSync(join(source, "manifest.json"), join(evidenceArtifact, "manifest.json"));
    cpSync(join(source, "timings"), join(evidenceArtifact, "timings"), { recursive: true });
    cpSync(join(source, "blobs"), blobArtifact, { recursive: true });
    const manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8")) as {
      durationMs: number;
    };
    writeFileSync(
      join(evidenceArtifact, "ci-browser-summary.json"),
      `${JSON.stringify(browserTimingSummary(manifest.durationMs + 10), null, 2)}\n`,
    );
  }
  return { evidence, blobs };
}

function validateFixture(root: string, evidence: string, blobs: string) {
  const output = join(root, "validation.json");
  const result = runRunner([
    "validate-group-artifacts",
    "--evidence-directory",
    evidence,
    "--blob-directory",
    blobs,
    "--blob-output-directory",
    join(root, "merged-blobs"),
    "--artifact-run-id",
    runId,
    "--artifact-run-attempt",
    runAttempt,
    "--output",
    output,
  ]);
  return { result, output };
}

let retainedFixture = "";

beforeAll(() => {
  retainedFixture = mkdtempSync(join(tmpdir(), "devx-01f-artifacts-"));
  const executed = executeBothGroups(retainedFixture);
  stageDownloadedArtifacts(retainedFixture, executed.output);
});

afterAll(() => {
  if (retainedFixture) rmSync(retainedFixture, { recursive: true, force: true });
});

describe.sequential("DEVX-01F locked execution-plan authority", () => {
  it("audits the immutable two-group plan and emits only safe group IDs", () => {
    const audit = runRunner(["audit-plan"]);
    expect(audit.status, audit.stderr).toBe(0);
    const authority = JSON.parse(audit.stdout) as {
      result: string;
      inventoryFingerprint: string;
      planType: string;
      groupCount: number;
      entryCount: number;
      groups: Array<{ groupId: string; entryIds: string[] }>;
    };
    expect(authority).toMatchObject({
      result: "PASS",
      inventoryFingerprint: lockedInventoryFingerprint,
      planType: "whole-suite-groups",
      groupCount: 2,
      entryCount: 12,
    });
    expect(authority.groups.map(({ groupId }) => groupId)).toEqual(expectedGroups);
    expect(authority.groups.flatMap(({ entryIds }) => entryIds)).toHaveLength(12);

    const first = runRunner(["emit-matrix"]);
    const second = runRunner(["emit-matrix"]);
    expect(first.status, first.stderr).toBe(0);
    expect(second.stdout).toBe(first.stdout);
    expect(JSON.parse(first.stdout)).toEqual({
      include: [{ groupId: "group-01" }, { groupId: "group-02" }],
    });
    expect(first.stdout).not.toContain("configPath");
    expect(first.stdout).not.toContain("suiteId");
  });

  it.each([
    [
      "duplicate and missing suite coverage",
      (value: Record<string, unknown>) => {
        const groups = value.groups as Array<{ entries: Array<{ suiteId: string }> }>;
        groups[1].entries[0].suiteId = "default";
      },
    ],
    [
      "incomplete shard coverage",
      (value: Record<string, unknown>) => {
        value.planType = "bounded-suite-shards";
        const groups = value.groups as Array<{ entries: Array<Record<string, unknown>> }>;
        groups[0].entries[0] = { suiteId: "default", shardIndex: 1, shardTotal: 2 };
      },
    ],
    [
      "undeclared plan metadata",
      (value: Record<string, unknown>) => {
        value.command = "arbitrary shell";
      },
    ],
    [
      "unrelated source provenance",
      (value: Record<string, unknown>) => {
        const provenance = value.sourceProvenance as Record<string, unknown>;
        provenance.runId = 33335864921;
      },
    ],
    [
      "one global browser group",
      (value: Record<string, unknown>) => {
        const groups = value.groups as Array<{ entries: Array<Record<string, unknown>> }>;
        groups[0].entries.push(...groups[1].entries);
        value.groups = [groups[0]];
      },
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const root = mkdtempSync(join(tmpdir(), "devx-01f-plan-"));
    try {
      const candidate = writePlan(root, mutate);
      const result = runRunner(["audit-plan", "--execution-plan", candidate]);
      expect(result.status).not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts complete bounded shards but never mixes them with whole-suite authority", () => {
    const root = mkdtempSync(join(tmpdir(), "devx-01f-shards-"));
    try {
      const candidate = writePlan(root, (value) => {
        value.planType = "bounded-suite-shards";
        const groups = value.groups as Array<{ entries: Array<Record<string, unknown>> }>;
        groups[0].entries[0] = { suiteId: "default", shardIndex: 1, shardTotal: 2 };
        groups[1].entries.push({ suiteId: "default", shardIndex: 2, shardTotal: 2 });
      });
      const result = runRunner(["audit-plan", "--execution-plan", candidate]);
      expect(result.status, result.stderr).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe.sequential("DEVX-01F group execution and cancellation authority", () => {
  it("runs each declared entry serially with blob reporter and atomic bounded evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "devx-01f-group-"));
    try {
      const fakeLog = join(root, "fake.log");
      const bin = makeFakePnpm(root);
      const result = runRunner(
        ["run-group", "--group-id", "group-01", "--output-directory", join(root, "output")],
        {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          DEVX01F_FAKE_LOG: fakeLog,
          DEVX01F_FAIL_MATCH: "",
          DEVX_SECRET_CANARY: "never-record-this-value",
        },
      );
      expect(result.status, result.stderr).toBe(0);
      const invocations = readFileSync(fakeLog, "utf8").trim().split("\n");
      expect(invocations).toHaveLength(6);
      expect(invocations.every((line) => line.includes("--reporter=blob"))).toBe(true);
      expect(invocations.every((line) => !line.includes("--shard"))).toBe(true);
      const groupRoot = join(root, "output", "group-01");
      const manifestText = readFileSync(join(groupRoot, "manifest.json"), "utf8");
      const manifest = JSON.parse(manifestText) as {
        expectedEntries: unknown[];
        completedEntries: unknown[];
        terminalResult: { status: string; exitCode: number };
      };
      expect(manifest.expectedEntries).toHaveLength(6);
      expect(manifest.completedEntries).toHaveLength(6);
      expect(manifest.terminalResult).toEqual({ status: "success", exitCode: 0, signal: null });
      expect(manifestText).not.toContain("never-record-this-value");
      expect(manifestText).not.toContain("PLAYWRIGHT_BLOB_OUTPUT_FILE");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stops a failed group immediately, preserves the truthful prefix, and propagates exit 23", () => {
    const root = mkdtempSync(join(tmpdir(), "devx-01f-failure-"));
    try {
      const fakeLog = join(root, "fake.log");
      const bin = makeFakePnpm(root);
      const result = runRunner(
        ["run-group", "--group-id", "group-01", "--output-directory", join(root, "output")],
        {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          DEVX01F_FAKE_LOG: fakeLog,
          DEVX01F_FAIL_MATCH: "p10a-04c",
          DEVX01F_FAIL_CODE: "23",
        },
      );
      expect(result.status).toBe(23);
      expect(readFileSync(fakeLog, "utf8").trim().split("\n")).toHaveLength(3);
      const manifest = JSON.parse(
        readFileSync(join(root, "output", "group-01", "manifest.json"), "utf8"),
      ) as { completedEntries: unknown[]; terminalResult: unknown };
      expect(manifest.completedEntries).toHaveLength(3);
      expect(manifest.terminalResult).toEqual({ status: "failure", exitCode: 23, signal: null });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("retains detached process-group termination and bounded SIGKILL escalation", () => {
    const source = readFileSync(runner, "utf8");
    expect(source).toContain("process.kill(-child.pid, signal)");
    expect(source).toContain('devx01fKillChild(child, "SIGKILL", detached)');
    expect(source).toContain("shell: false");
  });
});

describe.sequential("DEVX-01F artifact reconciliation and merged timing authority", () => {
  function cloneFixture() {
    const root = mkdtempSync(join(tmpdir(), "devx-01f-validation-"));
    cpSync(join(retainedFixture, "downloaded"), join(root, "downloaded"), { recursive: true });
    return {
      root,
      evidence: join(root, "downloaded", "evidence"),
      blobs: join(root, "downloaded", "blobs"),
    };
  }

  it("validates every group, entry, timing hash and blob before producing one matrix summary", () => {
    const fixture = cloneFixture();
    try {
      const validated = validateFixture(fixture.root, fixture.evidence, fixture.blobs);
      expect(validated.result.status, validated.result.stderr).toBe(0);
      const recordText = readFileSync(validated.output, "utf8");
      const record = JSON.parse(recordText) as {
        validatedGroupCount: number;
        validatedEntryCount: number;
        validatedBlobCount: number;
      };
      expect(record).toMatchObject({
        validatedGroupCount: 2,
        validatedEntryCount: 12,
        validatedBlobCount: 12,
      });
      expect(recordText).not.toContain("must-never-enter-evidence");
      const summaryPath = join(fixture.root, "summary.json");
      const summary = runRunner([
        "summarize-matrix",
        "--validation",
        validated.output,
        "--output",
        summaryPath,
        "--merge-result",
        "success",
      ]);
      expect(summary.status, summary.stderr).toBe(0);
      const matrix = JSON.parse(readFileSync(summaryPath, "utf8")) as {
        groupCount: number;
        entryCount: number;
        blobCount: number;
        matrixResult: string;
        mergedReportResult: string;
      };
      expect(matrix).toMatchObject({
        groupCount: 2,
        entryCount: 12,
        blobCount: 12,
        matrixResult: "success",
        mergedReportResult: "success",
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it.each([
    [
      "missing group evidence",
      (fixture: ReturnType<typeof cloneFixture>) =>
        rmSync(
          join(fixture.evidence, `playwright-group-evidence-${runId}-${runAttempt}-group-02`),
          { recursive: true },
        ),
    ],
    [
      "unexpected artifact",
      (fixture: ReturnType<typeof cloneFixture>) =>
        writeFileSync(join(fixture.evidence, "undeclared-output.txt"), "unsafe"),
    ],
    [
      "tampered blob",
      (fixture: ReturnType<typeof cloneFixture>) =>
        writeFileSync(
          join(
            fixture.blobs,
            `playwright-group-blobs-${runId}-${runAttempt}-group-01`,
            "default-blob.zip",
          ),
          "tampered",
        ),
    ],
  ])("fails before merge for %s", (_label, mutate) => {
    const fixture = cloneFixture();
    try {
      mutate(fixture);
      const validated = validateFixture(fixture.root, fixture.evidence, fixture.blobs);
      expect(validated.result.status).not.toBe(0);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")("rejects symbolic links in downloaded evidence", () => {
    const fixture = cloneFixture();
    try {
      symlinkSync(
        join(fixture.evidence, `playwright-group-evidence-${runId}-${runAttempt}-group-01`),
        join(fixture.evidence, "linked-evidence"),
      );
      const validated = validateFixture(fixture.root, fixture.evidence, fixture.blobs);
      expect(validated.result.status).not.toBe(0);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("refuses a matrix summary when report merging did not succeed", () => {
    const fixture = cloneFixture();
    try {
      const validated = validateFixture(fixture.root, fixture.evidence, fixture.blobs);
      expect(validated.result.status, validated.result.stderr).toBe(0);
      const result = runRunner([
        "summarize-matrix",
        "--validation",
        validated.output,
        "--output",
        join(fixture.root, "summary.json"),
        "--merge-result",
        "failure",
      ]);
      expect(result.status).not.toBe(0);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
