// @vitest-environment node

import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const script = join(root, "scripts", "ci-timing.mjs");
const profiles = {
  static: ["install", "typecheck", "lint", "format-check"],
  vitest: ["install", "vitest"],
  build: ["install", "webpack-build", "storefront-budgets"],
  browser: ["install", "playwright-install", "playwright-e2e"],
} as const;
const workspace = () => mkdtempSync(join(tmpdir(), "veskify-devx-01d-timing-"));
const objectValue = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object.");
  }
  return value as Record<string, unknown>;
};
const parseObject = (source: string) => objectValue(JSON.parse(source) as unknown);
const arrayProperty = (value: Record<string, unknown>, key: string) => {
  const property = value[key];
  if (!Array.isArray(property)) throw new Error(`Expected array property ${key}.`);
  return property as unknown[];
};
const stringProperty = (value: Record<string, unknown>, key: string) => {
  const property = value[key];
  if (typeof property !== "string") throw new Error(`Expected string property ${key}.`);
  return property;
};
const execute = (
  directory: string,
  args: string[],
  environment: Record<string, string | undefined> = {},
) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
const record = (stepId: string, durationMs: number, status = "success") => ({
  schemaVersion: "1.0.0",
  recordType: "ci-command-timing",
  stepId,
  status,
  startedAtUtc: "2026-08-30T10:00:00.000Z",
  completedAtUtc: "2026-08-30T10:00:01.000Z",
  durationMs,
  exitCode: status === "success" ? 0 : 2,
  signal: null,
});
const writeProfile = (directory: string, profile: keyof typeof profiles, limit?: number) => {
  const ids = profiles[profile].slice(0, limit);
  for (const [index, stepId] of ids.entries()) {
    const output = join(directory, ".ci-timings", profile, `${stepId}.json`);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(record(stepId, index + 1), null, 2)}\n`);
  }
};
const summarize = (directory: string, profile: string, jobStatus = "success") =>
  execute(directory, [
    "summarize",
    "--profile",
    profile,
    "--input-directory",
    `.ci-timings/${profile}`,
    "--output",
    `.ci-evidence/${profile}-summary.json`,
    "--job-status",
    jobStatus,
  ]);

describe("DEVX-01D timing profiles", () => {
  it.each(Object.entries(profiles))("summarizes a complete %s profile", (profile, ids) => {
    const directory = workspace();
    writeProfile(directory, profile as keyof typeof profiles);
    expect(summarize(directory, profile).status).toBe(0);
    const summary = parseObject(
      readFileSync(join(directory, ".ci-evidence", `${profile}-summary.json`), "utf8"),
    );
    expect(summary).toMatchObject({
      profile,
      jobStatus: "success",
      complete: true,
      expectedStepCount: ids.length,
      completedStepCount: ids.length,
    });
    expect(
      arrayProperty(summary, "steps").map((step) => stringProperty(objectValue(step), "stepId")),
    ).toEqual(ids);
  });

  it("isolates repeated install records across all four profile directories", () => {
    const directory = workspace();
    for (const profile of Object.keys(profiles) as (keyof typeof profiles)[]) {
      writeProfile(directory, profile, 1);
      expect(summarize(directory, profile, "failure").status).toBe(0);
      const summary = parseObject(
        readFileSync(join(directory, ".ci-evidence", `${profile}-summary.json`), "utf8"),
      );
      const steps = arrayProperty(summary, "steps").map(objectValue);
      expect(stringProperty(summary, "profile")).toBe(profile);
      expect(steps).toHaveLength(1);
      expect(stringProperty(steps[0], "stepId")).toBe("install");
    }
  });

  it("accepts a truthful profile prefix only for an unsuccessful job", () => {
    const directory = workspace();
    writeProfile(directory, "static", 2);
    expect(summarize(directory, "static", "failure").status).toBe(0);
    expect(summarize(directory, "static", "success").status).toBe(65);
  });

  it("rejects a step from another profile", () => {
    const directory = workspace();
    const output = join(directory, ".ci-timings", "build", "playwright-e2e.json");
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(record("playwright-e2e", 1), null, 2)}\n`);
    expect(summarize(directory, "build", "failure").status).toBe(65);
  });

  it("rejects an unknown profile without writing evidence", () => {
    const directory = workspace();
    expect(summarize(directory, "unknown", "failure").status).toBe(64);
  });

  it("rejects symlinked record, summary and GitHub Step Summary targets", () => {
    const directory = workspace();
    const outside = join(directory, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(directory, "linked-records"), "dir");
    const runResult = execute(directory, [
      "run",
      "--id",
      "install",
      "--output-directory",
      "linked-records",
      "--",
      process.execPath,
      "-e",
      "process.exit(0)",
    ]);
    expect(runResult.status).toBe(65);
    expect(existsSync(join(outside, "install.json"))).toBe(false);

    writeProfile(directory, "static");
    symlinkSync(outside, join(directory, "linked-evidence"), "dir");
    const summaryResult = execute(directory, [
      "summarize",
      "--profile",
      "static",
      "--input-directory",
      ".ci-timings/static",
      "--output",
      "linked-evidence/static-summary.json",
      "--job-status",
      "success",
    ]);
    expect(summaryResult.status).toBe(65);
    expect(existsSync(join(outside, "static-summary.json"))).toBe(false);

    const stepSummaryTarget = join(outside, "step-summary.md");
    writeFileSync(stepSummaryTarget, "unchanged");
    const stepSummaryLink = join(directory, "step-summary-link.md");
    symlinkSync(stepSummaryTarget, stepSummaryLink);
    expect(
      execute(
        directory,
        [
          "summarize",
          "--profile",
          "static",
          "--input-directory",
          ".ci-timings/static",
          "--output",
          ".ci-evidence/static-summary.json",
          "--job-status",
          "success",
        ],
        { GITHUB_STEP_SUMMARY: stepSummaryLink },
      ).status,
    ).toBe(65);
    expect(readFileSync(stepSummaryTarget, "utf8")).toBe("unchanged");
  });

  it.skipIf(process.platform === "win32")(
    "terminates descendants when the timing wrapper is cancelled",
    async () => {
      const directory = workspace();
      const ready = join(directory, "child-ready");
      const survived = join(directory, "grandchild-survived");
      const grandchildSource = `setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(survived)}, "survived"), 1000)`;
      const childSource = `const { spawn } = require("node:child_process"); const { writeFileSync } = require("node:fs"); spawn(process.execPath, ["-e", ${JSON.stringify(grandchildSource)}], { stdio: "ignore" }); writeFileSync(${JSON.stringify(ready)}, "ready"); setInterval(() => {}, 1000);`;
      const wrapper = spawn(
        process.execPath,
        [
          script,
          "run",
          "--id",
          "install",
          "--output-directory",
          ".ci-timings/cancellation",
          "--",
          process.execPath,
          "-e",
          childSource,
        ],
        { cwd: directory, stdio: "ignore" },
      );
      const deadline = Date.now() + 3_000;
      while (!existsSync(ready) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(existsSync(ready)).toBe(true);
      wrapper.kill("SIGTERM");
      const exitCode = await new Promise<number | null>((resolve) => {
        wrapper.once("close", (code) => resolve(code));
      });
      expect(exitCode).toBe(143);
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      expect(existsSync(survived)).toBe(false);
    },
  );
});
