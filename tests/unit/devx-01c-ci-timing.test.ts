// @vitest-environment node

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const timingScript = join(repositoryRoot, "scripts", "ci-timing.mjs");
const expectedStepIds = [
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

type EnvironmentOverrides = Record<string, string | undefined>;

const workspace = () => mkdtempSync(join(tmpdir(), "veskify-devx-01c-"));

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const objectValue = (value: unknown): Record<string, unknown> => {
  if (!isObjectRecord(value)) throw new Error("Expected a JSON object.");
  return value;
};

const parseJsonObject = (source: string) => {
  const value: unknown = JSON.parse(source);
  return objectValue(value);
};

const numberProperty = (value: Record<string, unknown>, key: string) => {
  const property = value[key];
  if (typeof property !== "number") throw new Error(`Expected numeric property ${key}.`);
  return property;
};

const stringProperty = (value: Record<string, unknown>, key: string) => {
  const property = value[key];
  if (typeof property !== "string") throw new Error(`Expected string property ${key}.`);
  return property;
};

const arrayProperty = (value: Record<string, unknown>, key: string) => {
  const property = value[key];
  const isUnknownArray = (candidate: unknown): candidate is unknown[] => Array.isArray(candidate);
  if (!isUnknownArray(property)) throw new Error(`Expected array property ${key}.`);
  return property;
};

const execute = (
  workingDirectory: string,
  arguments_: string[],
  environment: EnvironmentOverrides = {},
) =>
  spawnSync(process.execPath, [timingScript, ...arguments_], {
    cwd: workingDirectory,
    encoding: "utf8",
    env: { ...process.env, ...environment },
    maxBuffer: 1024 * 1024,
  });

const run = (workingDirectory: string, id: string, childArguments: string[]) =>
  execute(workingDirectory, [
    "run",
    "--id",
    id,
    "--output-directory",
    ".ci-timings",
    "--",
    process.execPath,
    ...childArguments,
  ]);

const record = (stepId: string, durationMs: number, overrides: Record<string, unknown> = {}) => ({
  schemaVersion: "1.0.0",
  recordType: "ci-command-timing",
  stepId,
  status: "success",
  startedAtUtc: "2026-08-30T10:00:00.000Z",
  completedAtUtc: "2026-08-30T10:00:01.000Z",
  durationMs,
  exitCode: 0,
  signal: null,
  ...overrides,
});

const writeRecord = (
  workingDirectory: string,
  stepId: string,
  durationMs: number,
  overrides: Record<string, unknown> = {},
  filename = `${stepId}.json`,
) => {
  const output = join(workingDirectory, ".ci-timings", filename);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(record(stepId, durationMs, overrides), null, 2)}\n`);
};

const summarize = (
  workingDirectory: string,
  jobStatus: "success" | "failure" | "cancelled",
  output = ".ci-evidence/summary.json",
  environment: EnvironmentOverrides = {},
) =>
  execute(
    workingDirectory,
    [
      "summarize",
      "--input-directory",
      ".ci-timings",
      "--output",
      output,
      "--job-status",
      jobStatus,
    ],
    environment,
  );

describe("DEVX-01C timed command execution", () => {
  it("streams a successful child and writes one bounded atomic record", () => {
    const directory = workspace();
    const result = run(directory, "install", ["-e", 'process.stdout.write("child-output")']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("child-output");
    const outputDirectory = join(directory, ".ci-timings");
    expect(readdirSync(outputDirectory)).toEqual(["install.json"]);
    const evidence = parseJsonObject(readFileSync(join(outputDirectory, "install.json"), "utf8"));
    expect(evidence).toMatchObject({
      schemaVersion: "1.0.0",
      recordType: "ci-command-timing",
      stepId: "install",
      status: "success",
      exitCode: 0,
      signal: null,
    });
    expect(numberProperty(evidence, "durationMs")).toBeGreaterThanOrEqual(0);
    expect(numberProperty(evidence, "durationMs")).toBeLessThan(60_000);
    expect(stringProperty(evidence, "startedAtUtc")).toMatch(/Z$/);
    expect(stringProperty(evidence, "completedAtUtc")).toMatch(/Z$/);
  });

  it("propagates an exact failing exit code and streams stderr", () => {
    const directory = workspace();
    const result = run(directory, "install", [
      "-e",
      'process.stderr.write("child-failure"); process.exit(7)',
    ]);

    expect(result.status).toBe(7);
    expect(result.stderr).toContain("child-failure");
    expect(
      JSON.parse(readFileSync(join(directory, ".ci-timings/install.json"), "utf8")),
    ).toMatchObject({
      status: "failure",
      exitCode: 7,
      signal: null,
    });
  });

  it("records a terminating signal and returns its conventional exact status", () => {
    const directory = workspace();
    const result = run(directory, "install", ["-e", 'process.kill(process.pid, "SIGTERM")']);

    expect(result.status).toBe(143);
    expect(
      JSON.parse(readFileSync(join(directory, ".ci-timings/install.json"), "utf8")),
    ).toMatchObject({
      status: "signaled",
      exitCode: null,
      signal: "SIGTERM",
    });
  });

  it("never retains child output, command arguments or environment values", () => {
    const directory = workspace();
    const marker = "DEVX01C_UNSAFE_MARKER";
    const result = execute(
      directory,
      [
        "run",
        "--id",
        "install",
        "--output-directory",
        ".ci-timings",
        "--",
        process.execPath,
        "-e",
        `process.stdout.write(process.env.${marker})`,
      ],
      { [marker]: marker },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(marker);
    const rawEvidence = readFileSync(join(directory, ".ci-timings/install.json"), "utf8");
    expect(rawEvidence).not.toContain(marker);
    expect(rawEvidence).not.toContain("process.stdout");
    expect(rawEvidence).not.toContain(process.execPath);
    expect(Object.keys(parseJsonObject(rawEvidence)).sort()).toEqual([
      "completedAtUtc",
      "durationMs",
      "exitCode",
      "recordType",
      "schemaVersion",
      "signal",
      "startedAtUtc",
      "status",
      "stepId",
    ]);
  });

  it.each(["INVALID", "../escape", "a/b"])("rejects invalid stable step ID %s", (id) => {
    const directory = workspace();
    expect(run(directory, id, ["-e", "process.exit(0)"]).status).toBe(64);
  });

  it.each(["../outside", "/absolute", "nested/../escape"])(
    "rejects output path traversal %s",
    (outputDirectory) => {
      const directory = workspace();
      const result = execute(directory, [
        "run",
        "--id",
        "install",
        "--output-directory",
        outputDirectory,
        "--",
        process.execPath,
        "-e",
        "process.exit(0)",
      ]);
      expect(result.status).toBe(64);
    },
  );

  it("refuses a duplicate record without executing the second child", () => {
    const directory = workspace();
    const markerPath = join(directory, "second-child-ran");
    expect(run(directory, "install", ["-e", "process.exit(0)"]).status).toBe(0);
    const first = readFileSync(join(directory, ".ci-timings/install.json"), "utf8");
    const second = run(directory, "install", [
      "-e",
      `require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "ran")`,
    ]);

    expect(second.status).toBe(65);
    expect(readFileSync(join(directory, ".ci-timings/install.json"), "utf8")).toBe(first);
    expect(() => readFileSync(markerPath)).toThrow();
  });

  it("fails closed for malformed existing output and leaves it unchanged", () => {
    const directory = workspace();
    const recordPath = join(directory, ".ci-timings/install.json");
    mkdirSync(dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, "malformed");

    expect(run(directory, "install", ["-e", "process.exit(0)"]).status).toBe(65);
    expect(readFileSync(recordPath, "utf8")).toBe("malformed");
  });
});

describe("DEVX-01C timing summary", () => {
  it("writes a deterministic complete summary in expected order with totals and slowest steps", () => {
    const directory = workspace();
    expectedStepIds.forEach((stepId, index) => writeRecord(directory, stepId, (index + 1) * 10));

    const first = summarize(directory, "success", ".ci-evidence/first.json");
    const second = summarize(directory, "success", ".ci-evidence/second.json");

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    const firstText = readFileSync(join(directory, ".ci-evidence/first.json"), "utf8");
    expect(readFileSync(join(directory, ".ci-evidence/second.json"), "utf8")).toBe(firstText);
    const evidence = parseJsonObject(firstText);
    expect(evidence).toMatchObject({
      schemaVersion: "1.0.0",
      recordType: "ci-timing-summary",
      jobStatus: "success",
      complete: true,
      expectedStepCount: 9,
      completedStepCount: 9,
      measuredTotalDurationMs: 450,
    });
    const steps = arrayProperty(evidence, "steps").map(objectValue);
    expect(steps.map((step) => stringProperty(step, "stepId"))).toEqual(expectedStepIds);
    expect(arrayProperty(evidence, "slowestCompletedSteps")).toEqual([
      { durationMs: 90, stepId: "playwright-e2e" },
      { durationMs: 80, stepId: "playwright-install" },
      { durationMs: 70, stepId: "storefront-budgets" },
    ]);
  });

  it("appends a bounded safe Markdown table to GitHub Step Summary", () => {
    const directory = workspace();
    expectedStepIds.forEach((stepId) => writeRecord(directory, stepId, 1));
    const stepSummary = join(directory, "github-step-summary.md");
    writeFileSync(stepSummary, "");

    expect(
      summarize(directory, "success", ".ci-evidence/summary.json", {
        GITHUB_STEP_SUMMARY: stepSummary,
      }).status,
    ).toBe(0);
    const markdown = readFileSync(stepSummary, "utf8");
    expect(markdown).toContain("## CI command timings");
    expect(markdown).toContain("| `playwright-e2e` | success | 0.001 s |");
    expect(markdown).toContain("Measured command total: **0.009 s**");
    expect(markdown).not.toContain("process.env");
  });

  it("accepts a truthful partial failed-job prefix", () => {
    const directory = workspace();
    writeRecord(directory, "install", 100);
    writeRecord(directory, "typecheck", 200, {
      status: "failure",
      exitCode: 2,
    });

    expect(summarize(directory, "failure").status).toBe(0);
    expect(
      JSON.parse(readFileSync(join(directory, ".ci-evidence/summary.json"), "utf8")),
    ).toMatchObject({
      jobStatus: "failure",
      complete: false,
      completedStepCount: 2,
      measuredTotalDurationMs: 300,
    });
  });

  it("accepts empty partial evidence only for an unsuccessful job", () => {
    const directory = workspace();
    expect(summarize(directory, "failure").status).toBe(0);
    expect(
      JSON.parse(readFileSync(join(directory, ".ci-evidence/summary.json"), "utf8")),
    ).toMatchObject({
      complete: false,
      completedStepCount: 0,
    });
  });

  it("fails closed when a successful job is missing a record", () => {
    const directory = workspace();
    expectedStepIds.slice(0, -1).forEach((stepId) => writeRecord(directory, stepId, 1));

    expect(summarize(directory, "success").status).toBe(65);
    expect(() => readFileSync(join(directory, ".ci-evidence/summary.json"))).toThrow();
  });

  it("rejects malformed timing JSON", () => {
    const directory = workspace();
    const malformed = join(directory, ".ci-timings/install.json");
    mkdirSync(dirname(malformed), { recursive: true });
    writeFileSync(malformed, "{");

    expect(summarize(directory, "failure").status).toBe(65);
  });

  it("rejects an undeclared filename and duplicate embedded step identity", () => {
    const directory = workspace();
    writeRecord(directory, "install", 1);
    writeRecord(directory, "install", 2, {}, "typecheck.json");

    expect(summarize(directory, "failure").status).toBe(65);
  });

  it("rejects timing records that do not form the expected prefix", () => {
    const directory = workspace();
    writeRecord(directory, "typecheck", 1);

    expect(summarize(directory, "failure").status).toBe(65);
  });

  it("rejects unsafe summary output placement inside the timing directory", () => {
    const directory = workspace();
    writeRecord(directory, "install", 1);

    expect(summarize(directory, "failure", ".ci-timings/summary.json").status).toBe(64);
  });

  it("does not retain arbitrary environment or command-output fields in summaries", () => {
    const directory = workspace();
    writeRecord(directory, "install", 1);
    expect(
      summarize(directory, "failure", ".ci-evidence/summary.json", {
        DEVX01C_SECRET_MARKER: "DO_NOT_RETAIN",
      }).status,
    ).toBe(0);

    const evidence = readFileSync(join(directory, ".ci-evidence/summary.json"), "utf8");
    expect(evidence).not.toContain("DO_NOT_RETAIN");
    const parsed = parseJsonObject(evidence);
    const steps = arrayProperty(parsed, "steps").map(objectValue);
    expect(parsed).not.toHaveProperty("command");
    expect(parsed).not.toHaveProperty("commandOutput");
    expect(parsed).not.toHaveProperty("environment");
    expect(steps[0]).not.toHaveProperty("command");
    expect(steps[0]).not.toHaveProperty("commandOutput");
    expect(steps[0]).not.toHaveProperty("environment");
  });
});
