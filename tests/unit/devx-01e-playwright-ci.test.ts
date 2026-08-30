import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const runnerPath = join(repositoryRoot, "scripts/playwright-ci.mjs");
const inventoryPath = join(repositoryRoot, "scripts/playwright-ci-suites.v1.json");

type SuiteAuthority = {
  readonly id: string;
  readonly order: number;
  readonly label: string;
  readonly configPath: string;
  readonly args: readonly string[];
};

type SuiteInventory = {
  readonly fingerprint: string;
  readonly suites: readonly SuiteAuthority[];
};

type TimingSuite = {
  readonly id: string;
  readonly order: number;
  readonly status: string;
  readonly durationMs: number;
  readonly durationShareBasisPoints: number;
  readonly exitCode: number | null;
};

type TimingSummary = {
  readonly completeness: string;
  readonly measuredSuiteCount: number;
  readonly measuredTotalDurationMs: number;
  readonly medianSuiteDurationMs: number;
  readonly suites: readonly TimingSuite[];
  readonly slowestSuites: ReadonlyArray<{ readonly id: string }>;
  readonly unmeasuredSuiteIds: readonly string[];
};

type GroupPlan = {
  readonly algorithm: string;
  readonly dominantSuite: { readonly id: string; readonly exceedsTargetMakespan: boolean };
  readonly recommendation: {
    readonly groupCount: number;
    readonly runnerCount: number;
    readonly estimatedRunnerMinutes: number;
    readonly basis: string;
  };
  readonly plans: ReadonlyArray<{
    readonly groupCount: number;
    readonly runnerCount: number;
    readonly groups: ReadonlyArray<{
      readonly suites: ReadonlyArray<{ readonly id: string }>;
    }>;
  }>;
};

type RunnerModule = {
  loadSuiteInventory(inventory?: string, root?: string): SuiteInventory;
  validateSuiteInventory(value: unknown, root?: string): SuiteInventory;
  exitCodeForResult(value: { exitCode: number | null; signal: string | null }): number;
  summarizeTimingDirectory(options: {
    inventory: SuiteInventory;
    inputDirectory: string;
    output: string;
    jobStatus: string;
  }): { summary: TimingSummary; markdown: string };
  buildBalancedGroupPlan(summary: unknown): GroupPlan;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRunnerModule(value: unknown): value is RunnerModule {
  return (
    isRecord(value) &&
    typeof value.loadSuiteInventory === "function" &&
    typeof value.validateSuiteInventory === "function" &&
    typeof value.exitCodeForResult === "function" &&
    typeof value.summarizeTimingDirectory === "function" &&
    typeof value.buildBalancedGroupPlan === "function"
  );
}

const runnerCandidate: unknown = await import(pathToFileURL(runnerPath).href);
if (!isRunnerModule(runnerCandidate)) {
  throw new Error("Expected the bounded Playwright CI runner test interface.");
}
const runner = runnerCandidate;

type FixtureSuite = {
  id: string;
  configPath: string;
};

const exactSuites = [
  ["default", "playwright.config.ts", ["test"]],
  [
    "p10a-08c-01",
    "playwright.p10a-08c-01.config.ts",
    ["test", "-c", "playwright.p10a-08c-01.config.ts"],
  ],
  ["p10a-04c", "playwright.p10a-04c.config.ts", ["test", "-c", "playwright.p10a-04c.config.ts"]],
  [
    "p10a-08d-02",
    "playwright.p10a-08d-02.config.ts",
    ["test", "-c", "playwright.p10a-08d-02.config.ts"],
  ],
  ["p10b-08", "playwright.p10b-08.config.ts", ["test", "-c", "playwright.p10b-08.config.ts"]],
  ["p10b-09", "playwright.p10b-09.config.ts", ["test", "-c", "playwright.p10b-09.config.ts"]],
  ["p10b-11", "playwright.p10b-11.config.ts", ["test", "-c", "playwright.p10b-11.config.ts"]],
  ["p10b-13", "playwright.p10b-13.config.ts", ["test", "-c", "playwright.p10b-13.config.ts"]],
  [
    "p10b-16p-03",
    "playwright.p10b-16p-03.config.ts",
    ["test", "-c", "playwright.p10b-16p-03.config.ts"],
  ],
  [
    "p10b-16p-06",
    "playwright.p10b-16p-06.config.ts",
    ["test", "-c", "playwright.p10b-16p-06.config.ts"],
  ],
  ["p10b-17", "playwright.p10b-17.config.ts", ["test", "-c", "playwright.p10b-17.config.ts"]],
  ["p10b-18a", "playwright.p10b-18a.config.ts", ["test", "-c", "playwright.p10b-18a.config.ts"]],
] as const;

function makeRoot(prefix = "veskify-devx-01e-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

function makeInventory(root: string, fixtureSuites: FixtureSuite[]) {
  const suites = fixtureSuites.map((suite, index) => {
    writeFileSync(join(root, suite.configPath), "export default {};\n", "utf8");
    return {
      id: suite.id,
      order: index + 1,
      label: `Fixture ${suite.id}`,
      configPath: suite.configPath,
      args:
        suite.configPath === "playwright.config.ts" ? ["test"] : ["test", "-c", suite.configPath],
      required: true,
      enabled: true,
    };
  });
  const path = join(root, "inventory.json");
  writeFileSync(
    path,
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        recordType: "playwright-ci-suite-inventory",
        suites,
      },
      null,
      2,
    ),
    "utf8",
  );
  return path;
}

function makeFakePnpm(root: string, body?: string) {
  const bin = join(root, "bin");
  mkdirSync(bin);
  const executable = join(bin, "pnpm");
  writeFileSync(
    executable,
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "$FAKE_PNPM_LOG"\n${body ?? "exit 0"}\n`,
    "utf8",
  );
  chmodSync(executable, 0o755);
  return bin;
}

function runCli(root: string, inventory: string, output: string, bin: string) {
  return spawnSync(
    process.execPath,
    [
      runnerPath,
      "run-all",
      "--inventory",
      inventory,
      "--repository-root",
      root,
      "--timing-output-directory",
      output,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        FAKE_PNPM_LOG: join(root, "pnpm.log"),
      },
    },
  );
}

function makeRecord(
  inventory: ReturnType<typeof runner.loadSuiteInventory>,
  index: number,
  durationMs: number,
  overrides: Record<string, unknown> = {},
) {
  const suite = inventory.suites[index];
  return {
    schemaVersion: "1.0.0",
    recordType: "playwright-ci-suite-timing",
    inventoryFingerprint: inventory.fingerprint,
    suiteId: suite.id,
    suiteOrder: suite.order,
    suiteLabel: suite.label,
    configPath: suite.configPath,
    startedAt: "2026-08-30T10:00:00.000Z",
    completedAt: "2026-08-30T10:00:01.000Z",
    durationMs,
    status: "success",
    exitCode: 0,
    signal: null,
    ...overrides,
  };
}

function writeRecords(
  directory: string,
  inventory: ReturnType<typeof runner.loadSuiteInventory>,
  durations: number[],
  finalOverrides: Record<string, unknown> = {},
) {
  mkdirSync(directory);
  durations.forEach((duration, index) => {
    const record = makeRecord(
      inventory,
      index,
      duration,
      index === durations.length - 1 ? finalOverrides : {},
    );
    writeFileSync(
      join(directory, `${String(index + 1).padStart(2, "0")}-${record.suiteId}.json`),
      `${JSON.stringify(record)}\n`,
      "utf8",
    );
  });
}

describe("DEVX-01E canonical Playwright suite inventory", () => {
  it("retains the exact 12-suite order, config identity, and command arguments", () => {
    const inventory = runner.loadSuiteInventory(inventoryPath, repositoryRoot);
    expect(inventory.suites).toHaveLength(12);
    expect(inventory.suites.map((suite) => [suite.id, suite.configPath, suite.args])).toEqual(
      exactSuites,
    );
    expect(inventory.fingerprint).toMatch(/^veskify-playwright-suite-inventory-v1_[a-f0-9]{64}$/u);
  });

  it.each([
    [
      "duplicate ID",
      (value: Record<string, unknown>) => {
        const suites = value.suites as Array<Record<string, unknown>>;
        suites[1].id = suites[0].id;
      },
    ],
    [
      "duplicate config",
      (value: Record<string, unknown>) => {
        const suites = value.suites as Array<Record<string, unknown>>;
        suites[1].configPath = suites[0].configPath;
        suites[1].args = ["test"];
      },
    ],
    [
      "unsafe ID",
      (value: Record<string, unknown>) => {
        const suites = value.suites as Array<Record<string, unknown>>;
        suites[0].id = "../escape";
      },
    ],
    [
      "path traversal",
      (value: Record<string, unknown>) => {
        const suites = value.suites as Array<Record<string, unknown>>;
        suites[0].configPath = "../playwright.config.ts";
      },
    ],
    [
      "disabled required suite",
      (value: Record<string, unknown>) => {
        const suites = value.suites as Array<Record<string, unknown>>;
        suites[0].enabled = false;
      },
    ],
    [
      "extra field",
      (value: Record<string, unknown>) => {
        const suites = value.suites as Array<Record<string, unknown>>;
        suites[0].command = "hidden";
      },
    ],
  ])("fails closed for %s", (_label, mutate) => {
    const value = JSON.parse(readFileSync(inventoryPath, "utf8")) as Record<string, unknown>;
    mutate(value);
    expect(() => runner.validateSuiteInventory(value, repositoryRoot)).toThrow();
  });

  it("fails when a config is missing or a required suite disappears", () => {
    const root = makeRoot();
    const inventory = makeInventory(root, [
      { id: "default", configPath: "playwright.config.ts" },
      { id: "second", configPath: "playwright.second.config.ts" },
    ]);
    const value = JSON.parse(readFileSync(inventory, "utf8")) as {
      suites: Array<Record<string, unknown>>;
    };
    value.suites[1].configPath = "playwright.missing.config.ts";
    value.suites[1].args = ["test", "-c", "playwright.missing.config.ts"];
    expect(() => runner.validateSuiteInventory(value, root)).toThrow(/does not exist/u);
    value.suites.pop();
    value.suites[0].order = 2;
    expect(() => runner.validateSuiteInventory(value, root)).toThrow(/order/u);
  });
});

describe("DEVX-01E serial suite execution", () => {
  it("runs suites serially in canonical order and writes bounded atomic records", () => {
    const root = makeRoot();
    const inventory = makeInventory(root, [
      { id: "default", configPath: "playwright.config.ts" },
      { id: "second", configPath: "playwright.second.config.ts" },
      { id: "third", configPath: "playwright.third.config.ts" },
    ]);
    const output = join(root, "timings");
    const bin = makeFakePnpm(
      root,
      'printf "child stdout\\n"; printf "child stderr\\n" >&2; exit 0',
    );
    const result = runCli(root, inventory, output, bin);

    expect(result.status).toBe(0);
    expect(readFileSync(join(root, "pnpm.log"), "utf8").trim().split("\n")).toEqual([
      "exec playwright test",
      "exec playwright test -c playwright.second.config.ts",
      "exec playwright test -c playwright.third.config.ts",
    ]);
    expect(result.stdout).toContain("child stdout");
    expect(result.stderr).toContain("child stderr");
    const evidence = readFileSync(join(output, "01-default.json"), "utf8");
    expect(evidence).not.toContain("child stdout");
    expect(evidence).not.toContain("child stderr");
    expect(evidence).not.toContain("FAKE_PNPM_LOG");
    expect(JSON.parse(evidence)).toMatchObject({
      suiteId: "default",
      status: "success",
      exitCode: 0,
      signal: null,
    });
  });

  it("stops on the first failure and propagates the exact exit code", () => {
    const root = makeRoot();
    const inventory = makeInventory(root, [
      { id: "default", configPath: "playwright.config.ts" },
      { id: "second", configPath: "playwright.second.config.ts" },
      { id: "third", configPath: "playwright.third.config.ts" },
    ]);
    const output = join(root, "timings");
    const bin = makeFakePnpm(root, 'case "$*" in *second*) exit 23;; *) exit 0;; esac');
    const result = runCli(root, inventory, output, bin);

    expect(result.status).toBe(23);
    expect(readFileSync(join(root, "pnpm.log"), "utf8").trim().split("\n")).toEqual([
      "exec playwright test",
      "exec playwright test -c playwright.second.config.ts",
    ]);
    expect(JSON.parse(readFileSync(join(output, "02-second.json"), "utf8"))).toMatchObject({
      status: "failure",
      exitCode: 23,
      signal: null,
    });
  });

  it("rejects malformed existing evidence instead of overwriting it", () => {
    const root = makeRoot();
    const inventory = makeInventory(root, [{ id: "default", configPath: "playwright.config.ts" }]);
    const output = join(root, "timings");
    mkdirSync(output);
    writeFileSync(join(output, "01-default.json"), "malformed\n", "utf8");
    const result = runCli(root, inventory, output, makeFakePnpm(root));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("already exists");
    expect(readFileSync(join(output, "01-default.json"), "utf8")).toBe("malformed\n");
  });

  it("maps terminating signals to conventional failure status", () => {
    expect(runner.exitCodeForResult({ exitCode: null, signal: "SIGTERM" })).toBe(143);
    expect(runner.exitCodeForResult({ exitCode: null, signal: "SIGINT" })).toBe(130);
  });

  it("forwards cancellation to the child process group and retains signal metadata", async () => {
    const root = makeRoot();
    const inventory = makeInventory(root, [{ id: "default", configPath: "playwright.config.ts" }]);
    const output = join(root, "timings");
    const bin = makeFakePnpm(
      root,
      'sleep 60 & grandchild=$!; printf "%s" "$grandchild" > "$FAKE_GRANDCHILD_PID"; wait',
    );
    const child = spawn(
      process.execPath,
      [
        runnerPath,
        "run-all",
        "--inventory",
        inventory,
        "--repository-root",
        root,
        "--timing-output-directory",
        output,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          FAKE_PNPM_LOG: join(root, "pnpm.log"),
          FAKE_GRANDCHILD_PID: join(root, "grandchild.pid"),
        },
      },
    );
    const deadline = Date.now() + 5000;
    while (!existsFile(join(root, "grandchild.pid")) && Date.now() < deadline) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
    }
    expect(existsFile(join(root, "grandchild.pid"))).toBe(true);
    child.kill("SIGTERM");
    const exitCode = await new Promise<number | null>((resolvePromise) => {
      child.once("close", resolvePromise);
    });
    expect(exitCode).toBe(143);
    expect(JSON.parse(readFileSync(join(output, "01-default.json"), "utf8"))).toMatchObject({
      status: "cancelled",
      signal: "SIGTERM",
    });
    const grandchildPid = Number(readFileSync(join(root, "grandchild.pid"), "utf8"));
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    expect(() => process.kill(grandchildPid, 0)).toThrow();
  });
});

function existsFile(path: string) {
  try {
    return readFileSync(path).length >= 0;
  } catch {
    return false;
  }
}

describe("DEVX-01E timing summary", () => {
  function summaryFixture(durations = [100, 200, 300]) {
    const root = makeRoot();
    const inventoryPath = makeInventory(root, [
      { id: "default", configPath: "playwright.config.ts" },
      { id: "second", configPath: "playwright.second.config.ts" },
      { id: "third", configPath: "playwright.third.config.ts" },
    ]);
    const inventory = runner.loadSuiteInventory(inventoryPath, root);
    const input = join(root, "input");
    writeRecords(input, inventory, durations);
    return { root, inventoryPath, inventory, input };
  }

  it("calculates complete totals, median, relative shares, ordering, and slowest suites", () => {
    const fixture = summaryFixture();
    const output = join(fixture.root, "summary.json");
    const { summary, markdown } = runner.summarizeTimingDirectory({
      inventory: fixture.inventory,
      inputDirectory: fixture.input,
      output,
      jobStatus: "success",
    });
    expect(summary).toMatchObject({
      completeness: "complete",
      measuredSuiteCount: 3,
      measuredTotalDurationMs: 600,
      medianSuiteDurationMs: 200,
      unmeasuredSuiteIds: [],
    });
    expect(summary.suites.map((suite: { id: string }) => suite.id)).toEqual([
      "default",
      "second",
      "third",
    ]);
    expect(
      summary.suites.map(
        (suite: { durationShareBasisPoints: number }) => suite.durationShareBasisPoints,
      ),
    ).toEqual([1667, 3333, 5000]);
    expect(summary.slowestSuites.map((suite: { id: string }) => suite.id)).toEqual([
      "third",
      "second",
      "default",
    ]);
    expect(markdown).toContain("Measured 3/3 suites");
    expect(readFileSync(output, "utf8")).not.toContain(process.env.PATH ?? "unavailable");
  });

  it("retains a truthful partial prefix after failure", () => {
    const fixture = summaryFixture([100, 200]);
    const secondPath = join(fixture.input, "02-second.json");
    const second = JSON.parse(readFileSync(secondPath, "utf8")) as Record<string, unknown>;
    second.status = "failure";
    second.exitCode = 19;
    writeFileSync(secondPath, `${JSON.stringify(second)}\n`, "utf8");
    const { summary } = runner.summarizeTimingDirectory({
      inventory: fixture.inventory,
      inputDirectory: fixture.input,
      output: join(fixture.root, "partial.json"),
      jobStatus: "failure",
    });
    expect(summary.completeness).toBe("partial");
    expect(summary.unmeasuredSuiteIds).toEqual(["third"]);
    expect(summary.suites.at(-1)).toMatchObject({ status: "failure", exitCode: 19 });
  });

  it("fails closed for missing successful records, malformed records, and non-prefix evidence", () => {
    const missing = summaryFixture([100, 200]);
    expect(() =>
      runner.summarizeTimingDirectory({
        inventory: missing.inventory,
        inputDirectory: missing.input,
        output: join(missing.root, "missing.json"),
        jobStatus: "success",
      }),
    ).toThrow(/requires every/u);

    const malformed = summaryFixture();
    writeFileSync(join(malformed.input, "02-second.json"), "{broken\n", "utf8");
    expect(() =>
      runner.summarizeTimingDirectory({
        inventory: malformed.inventory,
        inputDirectory: malformed.input,
        output: join(malformed.root, "malformed.json"),
        jobStatus: "failure",
      }),
    ).toThrow(/Malformed/u);

    const suffix = summaryFixture([100]);
    const third = makeRecord(suffix.inventory, 2, 300);
    writeFileSync(join(suffix.input, "03-third.json"), JSON.stringify(third), "utf8");
    expect(() =>
      runner.summarizeTimingDirectory({
        inventory: suffix.inventory,
        inputDirectory: suffix.input,
        output: join(suffix.root, "suffix.json"),
        jobStatus: "failure",
      }),
    ).toThrow(/prefix/u);
  });

  it("rejects duplicate IDs, unknown fields, and symlink evidence", () => {
    const duplicate = summaryFixture();
    copyFileSync(join(duplicate.input, "01-default.json"), join(duplicate.input, "99-copy.json"));
    expect(() =>
      runner.summarizeTimingDirectory({
        inventory: duplicate.inventory,
        inputDirectory: duplicate.input,
        output: join(duplicate.root, "duplicate.json"),
        jobStatus: "failure",
      }),
    ).toThrow(/Duplicate/u);

    const unknown = summaryFixture();
    const path = join(unknown.input, "01-default.json");
    const record = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    record.rawOutput = "secret command output";
    writeFileSync(path, JSON.stringify(record), "utf8");
    expect(() =>
      runner.summarizeTimingDirectory({
        inventory: unknown.inventory,
        inputDirectory: unknown.input,
        output: join(unknown.root, "unknown.json"),
        jobStatus: "failure",
      }),
    ).toThrow(/exactly/u);

    const linked = summaryFixture();
    symlinkSync(join(linked.input, "01-default.json"), join(linked.input, "linked.json"));
    expect(() =>
      runner.summarizeTimingDirectory({
        inventory: linked.inventory,
        inputDirectory: linked.input,
        output: join(linked.root, "linked-summary.json"),
        jobStatus: "failure",
      }),
    ).toThrow(/regular JSON/u);
  });

  it("produces deterministic JSON and safe Markdown without command output or environment values", () => {
    const first = summaryFixture([333, 111, 222]);
    const second = summaryFixture([333, 111, 222]);
    const firstOutput = join(first.root, "summary.json");
    const secondOutput = join(second.root, "summary.json");
    const firstResult = runner.summarizeTimingDirectory({
      inventory: first.inventory,
      inputDirectory: first.input,
      output: firstOutput,
      jobStatus: "success",
    });
    const secondResult = runner.summarizeTimingDirectory({
      inventory: second.inventory,
      inputDirectory: second.input,
      output: secondOutput,
      jobStatus: "success",
    });
    expect(readFileSync(firstOutput, "utf8")).toBe(readFileSync(secondOutput, "utf8"));
    expect(firstResult.markdown).toBe(secondResult.markdown);
    expect(firstResult.markdown).not.toContain("SECRET_VALUE");
    expect(JSON.stringify(firstResult.summary)).not.toContain("command");
    expect(JSON.stringify(firstResult.summary)).not.toContain("environment");
  });
});

describe("DEVX-01E deterministic balanced-group planner", () => {
  function syntheticSummary(durations: number[]) {
    return {
      schemaVersion: "1.0.0",
      recordType: "playwright-ci-suite-timing-summary",
      inventoryFingerprint: "veskify-playwright-suite-inventory-v1_" + "a".repeat(64),
      jobStatus: "success",
      completeness: "complete",
      suites: durations.map((durationMs, index) => ({
        id: `suite-${index + 1}`,
        order: index + 1,
        status: "success",
        durationMs,
      })),
    };
  }

  it("emits deterministic LPT plans for two through six groups", () => {
    const summary = syntheticSummary([900, 800, 700, 600, 500, 400]);
    const first = runner.buildBalancedGroupPlan(summary);
    const second = runner.buildBalancedGroupPlan(summary);
    expect(first).toEqual(second);
    expect(first.algorithm).toBe("deterministic-lpt-v1");
    expect(first.plans.map((plan: { groupCount: number }) => plan.groupCount)).toEqual([
      2, 3, 4, 5, 6,
    ]);
    expect(first.plans[0].groups.map((group) => group.suites.map((suite) => suite.id))).toEqual([
      ["suite-1", "suite-4", "suite-5"],
      ["suite-2", "suite-3", "suite-6"],
    ]);
  });

  it("uses canonical order and stable IDs to break timing ties", () => {
    const plan = runner.buildBalancedGroupPlan(syntheticSummary([100, 100, 100, 100, 100, 100]));
    expect(plan.plans[0].groups[0].suites.map((suite: { id: string }) => suite.id)).toEqual([
      "suite-1",
      "suite-3",
      "suite-5",
    ]);
    expect(plan.plans[0].groups[1].suites.map((suite: { id: string }) => suite.id)).toEqual([
      "suite-2",
      "suite-4",
      "suite-6",
    ]);
  });

  it("selects the smallest target-satisfying plan and records runner-cost implications", () => {
    const plan = runner.buildBalancedGroupPlan(
      syntheticSummary([600_000, 550_000, 500_000, 450_000, 400_000, 350_000]),
    );
    expect(plan.recommendation.groupCount).toBeGreaterThanOrEqual(2);
    expect(plan.recommendation.groupCount).toBeLessThanOrEqual(6);
    expect(plan.recommendation.runnerCount).toBe(plan.recommendation.groupCount);
    expect(plan.recommendation.estimatedRunnerMinutes).toBeGreaterThan(0);
    expect(plan.plans.every((candidate) => candidate.groups.length === candidate.runnerCount)).toBe(
      true,
    );
  });

  it("reports a dominant suite and fails closed for partial or failed evidence", () => {
    const plan = runner.buildBalancedGroupPlan(syntheticSummary([2_000_000, 10, 10, 10, 10, 10]));
    expect(plan.dominantSuite).toMatchObject({ id: "suite-1", exceedsTargetMakespan: true });
    expect(plan.recommendation.basis).toBe("lowest-estimated-makespan-with-deterministic-ties");
    expect(() =>
      runner.buildBalancedGroupPlan({
        ...syntheticSummary([100, 200]),
        completeness: "partial",
      }),
    ).toThrow(/complete successful/u);
  });
});
