// @vitest-environment node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

interface PlanShard {
  shardId: string;
  index: number;
  total: number;
  fileCount: number;
  fileInventorySha256: string;
  files: string[];
}

interface LockedPlan {
  planFingerprint: string;
  sourceFileInventorySha256: string;
  selectedShardCount: number;
  maxWorkersPerShard: number;
  fileParallelism: boolean;
  retries: number;
  selectedShards: PlanShard[];
}

interface DiscoveryAudit {
  status: "PASS";
  sourceFileCount: number;
  discoveredFileCount: number;
  implementationAddedFileCount: number;
  discoveryAuditFingerprint: string;
  discoveredFiles: string[];
  shards: PlanShard[];
}

interface MatrixValidation {
  status: "PASS";
  shardCount: number;
  discoveredFileCount: number;
  shards: Array<{ shardId: string }>;
}

interface ShardManifest {
  jobStatus: "success" | "failure";
  blob: null | { fileName: string; sha256: string; sizeBytes: number };
}

interface ValidatedMergedResult {
  status: "PASS";
  testFileCount: number;
}

const root = fileURLToPath(new URL("../../", import.meta.url));
const script = path.join(root, "scripts/vitest-ci.mjs");
const planPath = path.join(root, "scripts/vitest-ci-plan.v1.json");
const temporaryRoots: string[] = [];

const parseJson = <Value>(filePath: string): Value =>
  JSON.parse(readFileSync(filePath, "utf8")) as Value;

const temporaryRoot = () => {
  const value = mkdtempSync(path.join(tmpdir(), "veskify-devx-01f2-"));
  temporaryRoots.push(value);
  return value;
};

const writeJson = (filePath: string, value: unknown) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const run = (cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });

const expectPass = (result: ReturnType<typeof run>) => {
  expect(result.status, result.stderr).toBe(0);
  expect(result.signal).toBeNull();
};

const lockedPlan = () => parseJson<LockedPlan>(planPath);

const currentDiscovery = () =>
  [
    ...lockedPlan().selectedShards.flatMap(({ files }) => files),
    "tests/unit/devx-01f2-ci-workflow.test.ts",
    "tests/unit/devx-01f2-vitest-ci.test.ts",
  ].map((file) => ({ file: path.join(root, file) }));

const timingSummary = (status: "success" | "failure") => ({
  schemaVersion: "1.0.0",
  recordType: "ci-timing-summary",
  profile: "vitest",
  jobStatus: status,
  complete: status === "success",
  expectedStepCount: 2,
  completedStepCount: 2,
  measuredTotalDurationMs: 1234,
  steps: [],
  slowestCompletedSteps: [],
});

const prepareAudit = (workspace: string) => {
  writeJson(path.join(workspace, "discovery.json"), currentDiscovery());
  const result = run(
    workspace,
    "audit-plan",
    "--discovery",
    "discovery.json",
    "--output",
    "audit.json",
  );
  expectPass(result);
  return parseJson<DiscoveryAudit>(path.join(workspace, "audit.json"));
};

const prepareCompleteArtifacts = () => {
  const workspace = temporaryRoot();
  const audit = prepareAudit(workspace);
  for (const shard of audit.shards) {
    const source = path.join(workspace, "source", shard.shardId);
    writeJson(path.join(source, "timing.json"), timingSummary("success"));
    writeJson(path.join(source, `${shard.shardId}.json`), { shardId: shard.shardId });
    const manifestResult = run(
      workspace,
      "write-shard-manifest",
      "--shard-id",
      shard.shardId,
      "--discovery-audit",
      "audit.json",
      "--timing-summary",
      path.relative(workspace, path.join(source, "timing.json")),
      "--blob",
      path.relative(workspace, path.join(source, `${shard.shardId}.json`)),
      "--job-status",
      "success",
      "--artifact-run-id",
      "123",
      "--artifact-run-attempt",
      "1",
      "--output",
      path.relative(workspace, path.join(source, "manifest.json")),
    );
    expectPass(manifestResult);
    const evidenceTarget = path.join(workspace, "evidence", `artifact-${shard.shardId}`);
    const blobTarget = path.join(workspace, "blobs", `artifact-${shard.shardId}`);
    mkdirSync(evidenceTarget, { recursive: true });
    mkdirSync(blobTarget, { recursive: true });
    cpSync(path.join(source, "manifest.json"), path.join(evidenceTarget, "manifest.json"));
    cpSync(
      path.join(source, `${shard.shardId}.json`),
      path.join(blobTarget, `${shard.shardId}.json`),
    );
  }
  const validationResult = run(
    workspace,
    "validate-shard-artifacts",
    "--evidence-directory",
    "evidence",
    "--blob-directory",
    "blobs",
    "--discovery-audit",
    "audit.json",
    "--blob-output-directory",
    "merged-blobs",
    "--artifact-run-id",
    "123",
    "--artifact-run-attempt",
    "1",
    "--output",
    "matrix-validation.json",
  );
  expectPass(validationResult);
  return { workspace, audit };
};

afterEach(() => {
  for (const temporary of temporaryRoots.splice(0)) {
    rmSync(temporary, { force: true, recursive: true });
  }
});

describe("DEVX-01F2 Vitest CI authority", () => {
  it("binds the accepted 243-file source plan to official nonoverlapping shards", () => {
    const plan = lockedPlan();
    expect(plan.planFingerprint).toBe(
      "veskify-vitest-shard-plan-v1_e35b0a4c53efdb21a6aed011fb807343b744fc7b1bc5b2fd5d8e73fcbeaab99a",
    );
    const files = plan.selectedShards.flatMap((shard) => shard.files);
    expect(files).toHaveLength(243);
    expect(new Set(files).size).toBe(243);
    const ordered = files
      .map((file) => ({
        file,
        hash: createHash("sha1").update(`/${file}`).digest("hex"),
      }))
      .sort(
        (left, right) => left.hash.localeCompare(right.hash) || left.file.localeCompare(right.file),
      );
    const official = [ordered.slice(0, 81), ordered.slice(81, 162), ordered.slice(162)].map(
      (shard) => shard.map(({ file }) => file),
    );
    expect(official).toEqual(plan.selectedShards.map(({ files: shardFiles }) => shardFiles));
    expect(plan.selectedShards.map(({ fileCount }) => fileCount)).toEqual([81, 81, 81]);
  });

  it("audits current discovery including new validation files exactly once", () => {
    const first = prepareAudit(temporaryRoot());
    const second = prepareAudit(temporaryRoot());
    expect(first).toEqual(second);
    expect(first.sourceFileCount).toBe(243);
    expect(first.discoveredFileCount).toBe(245);
    expect(first.implementationAddedFileCount).toBe(2);
    const union = first.shards.flatMap(({ files }) => files);
    expect(union).toHaveLength(245);
    expect(new Set(union).size).toBe(245);
    expect(first.shards.every(({ fileCount }) => fileCount > 0)).toBe(true);
  });

  it("fails closed for duplicate or missing source discovery", () => {
    const workspace = temporaryRoot();
    const duplicate = currentDiscovery();
    duplicate.push(duplicate[0]);
    writeJson(path.join(workspace, "duplicate.json"), duplicate);
    const duplicateResult = run(workspace, "audit-plan", "--discovery", "duplicate.json");
    expect(duplicateResult.status).toBe(1);
    expect(duplicateResult.stderr).toMatch(/duplicate/u);
    writeJson(path.join(workspace, "missing.json"), currentDiscovery().slice(1));
    const missingResult = run(workspace, "audit-plan", "--discovery", "missing.json");
    expect(missingResult.status).toBe(1);
    expect(missingResult.stderr).toMatch(/omitted locked source/u);
  });

  it("emits only deterministic bounded shard identity", () => {
    const first = run(root, "emit-matrix");
    const second = run(root, "emit-matrix");
    expectPass(first);
    expectPass(second);
    expect(first.stdout).toBe(second.stdout);
    expect(JSON.parse(first.stdout)).toEqual({
      include: [
        { shardId: "shard-01-of-03", shardIndex: 1, shardTotal: 3 },
        { shardId: "shard-02-of-03", shardIndex: 2, shardTotal: 3 },
        { shardId: "shard-03-of-03", shardIndex: 3, shardTotal: 3 },
      ],
    });
    expect(first.stdout).not.toContain("tests/");
  });

  it("rejects CLI path traversal", () => {
    const workspace = temporaryRoot();
    const result = run(workspace, "audit-plan", "--output", "../escape.json");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/without traversal/u);
  });

  it("writes one atomic safe success manifest and refuses replacement", () => {
    const workspace = temporaryRoot();
    prepareAudit(workspace);
    writeJson(path.join(workspace, "timing.json"), timingSummary("success"));
    writeJson(path.join(workspace, "shard-01-of-03.json"), { safe: true });
    const args = [
      "write-shard-manifest",
      "--shard-id",
      "shard-01-of-03",
      "--discovery-audit",
      "audit.json",
      "--timing-summary",
      "timing.json",
      "--blob",
      "shard-01-of-03.json",
      "--job-status",
      "success",
      "--artifact-run-id",
      "123",
      "--artifact-run-attempt",
      "1",
      "--output",
      "manifest.json",
    ];
    const first = run(workspace, ...args);
    expectPass(first);
    const manifest = parseJson<ShardManifest>(path.join(workspace, "manifest.json"));
    expect(manifest.jobStatus).toBe("success");
    expect(JSON.stringify(manifest)).not.toMatch(/stdout|stderr|environment|command/iu);
    const second = run(workspace, ...args);
    expect(second.status).toBe(1);
    expect(second.stderr).toMatch(/Refusing to replace/u);
  });

  it("retains truthful failure metadata without claiming a missing blob", () => {
    const workspace = temporaryRoot();
    prepareAudit(workspace);
    writeJson(path.join(workspace, "timing.json"), timingSummary("failure"));
    const result = run(
      workspace,
      "write-shard-manifest",
      "--shard-id",
      "shard-02-of-03",
      "--discovery-audit",
      "audit.json",
      "--timing-summary",
      "timing.json",
      "--blob",
      "absent.json",
      "--job-status",
      "failure",
      "--artifact-run-id",
      "123",
      "--artifact-run-attempt",
      "1",
      "--output",
      "manifest.json",
    );
    expectPass(result);
    const manifest = parseJson<ShardManifest>(path.join(workspace, "manifest.json"));
    expect(manifest.blob).toBeNull();
    expect(manifest.jobStatus).toBe("failure");
  });

  it("reconciles exactly one successful manifest and blob for every shard", () => {
    const { workspace, audit } = prepareCompleteArtifacts();
    const result = parseJson<MatrixValidation>(path.join(workspace, "matrix-validation.json"));
    expect(result.status).toBe("PASS");
    expect(result.shardCount).toBe(3);
    expect(result.discoveredFileCount).toBe(audit.discoveredFileCount);
    expect(result.shards.map(({ shardId }) => shardId)).toEqual([
      "shard-01-of-03",
      "shard-02-of-03",
      "shard-03-of-03",
    ]);
  });

  it("rejects incomplete matrix evidence", () => {
    const workspace = temporaryRoot();
    prepareAudit(workspace);
    mkdirSync(path.join(workspace, "evidence"));
    mkdirSync(path.join(workspace, "blobs"));
    const result = run(
      workspace,
      "validate-shard-artifacts",
      "--evidence-directory",
      "evidence",
      "--blob-directory",
      "blobs",
      "--discovery-audit",
      "audit.json",
      "--blob-output-directory",
      "merged-blobs",
      "--artifact-run-id",
      "123",
      "--artifact-run-attempt",
      "1",
      "--output",
      "validation.json",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/one manifest per shard/u);
  });

  it("rejects symbolic links inside downloaded artifact authority", () => {
    const workspace = temporaryRoot();
    prepareAudit(workspace);
    mkdirSync(path.join(workspace, "evidence"));
    mkdirSync(path.join(workspace, "blobs"));
    symlinkSync(path.join(workspace, "audit.json"), path.join(workspace, "evidence/manifest.json"));
    const result = run(
      workspace,
      "validate-shard-artifacts",
      "--evidence-directory",
      "evidence",
      "--blob-directory",
      "blobs",
      "--discovery-audit",
      "audit.json",
      "--blob-output-directory",
      "merged-blobs",
      "--artifact-run-id",
      "123",
      "--artifact-run-attempt",
      "1",
      "--output",
      "validation.json",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/symbolic links/u);
  });

  it("validates one complete merged result without retaining assertion output", () => {
    const { workspace, audit } = prepareCompleteArtifacts();
    writeJson(path.join(workspace, "merged.json"), {
      success: true,
      numTotalTestSuites: audit.discoveredFileCount,
      numPassedTestSuites: audit.discoveredFileCount,
      numFailedTestSuites: 0,
      numTotalTests: 3200,
      numPassedTests: 3199,
      numFailedTests: 0,
      numPendingTests: 1,
      testResults: audit.discoveredFiles.map((name) => ({ name, status: "passed" })),
    });
    const result = run(
      workspace,
      "validate-merged-report",
      "--merged-result",
      "merged.json",
      "--discovery-audit",
      "audit.json",
      "--artifact-validation",
      "matrix-validation.json",
      "--output",
      "validated.json",
    );
    expectPass(result);
    const validated = parseJson<ValidatedMergedResult>(path.join(workspace, "validated.json"));
    expect(validated.status).toBe("PASS");
    expect(validated.testFileCount).toBe(245);
    expect(JSON.stringify(validated)).not.toMatch(/assertion|stdout|stderr|environment/iu);
  });

  it("fails merged validation for failed, missing, or duplicate test files", () => {
    const { workspace, audit } = prepareCompleteArtifacts();
    const base = {
      success: true,
      numTotalTestSuites: audit.discoveredFileCount,
      numPassedTestSuites: audit.discoveredFileCount,
      numFailedTestSuites: 0,
      numTotalTests: 1,
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 0,
    };
    const cases: Array<{ name: string; testResults: Array<{ name: string; status: string }> }> = [
      {
        name: "missing",
        testResults: audit.discoveredFiles.slice(1).map((name) => ({ name, status: "passed" })),
      },
      {
        name: "duplicate",
        testResults: [...audit.discoveredFiles, audit.discoveredFiles[0]].map((name) => ({
          name,
          status: "passed",
        })),
      },
      {
        name: "failed",
        testResults: audit.discoveredFiles.map((name, index) => ({
          name,
          status: index === 0 ? "failed" : "passed",
        })),
      },
    ];
    for (const fixture of cases) {
      writeJson(path.join(workspace, `${fixture.name}.json`), {
        ...base,
        testResults: fixture.testResults,
      });
      const result = run(
        workspace,
        "validate-merged-report",
        "--merged-result",
        `${fixture.name}.json`,
        "--discovery-audit",
        "audit.json",
        "--artifact-validation",
        "matrix-validation.json",
        "--output",
        `${fixture.name}-output.json`,
      );
      expect(result.status).toBe(1);
    }
  });

  it("keeps the plan artifact free of unsafe evidence fields", () => {
    const plan = lockedPlan() as unknown as Record<string, unknown>;
    expect(Object.keys(plan)).not.toEqual(
      expect.arrayContaining(["stdout", "stderr", "environment", "token", "credential"]),
    );
    expect(plan.maxWorkersPerShard).toBe(1);
    expect(plan.fileParallelism).toBe(false);
    expect(plan.retries).toBe(0);
  });
});
