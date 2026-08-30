#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as osConstants } from "node:os";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const SCHEMA_VERSION = "1.0.0";
const RECORD_TYPE = "ci-command-timing";
const SUMMARY_TYPE = "ci-timing-summary";
const EXIT_USAGE = 64;
const EXIT_DATA = 65;
const EXIT_IO = 74;
const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const SIGNAL_GRACE_MS = 5_000;
const PROFILE_STEP_IDS = Object.freeze({
  serial: Object.freeze([
    "install",
    "typecheck",
    "lint",
    "format-check",
    "vitest",
    "webpack-build",
    "storefront-budgets",
    "playwright-install",
    "playwright-e2e",
  ]),
  static: Object.freeze(["install", "typecheck", "lint", "format-check"]),
  vitest: Object.freeze(["install", "vitest"]),
  build: Object.freeze(["install", "webpack-build", "storefront-budgets"]),
  browser: Object.freeze(["install", "playwright-install", "playwright-e2e"]),
});
const ALL_STEP_IDS = new Set(Object.values(PROFILE_STEP_IDS).flat());
const RECORD_KEYS = [
  "completedAtUtc",
  "durationMs",
  "exitCode",
  "recordType",
  "schemaVersion",
  "signal",
  "startedAtUtc",
  "status",
  "stepId",
];

class TimingError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}

const fail = (message, exitCode = EXIT_DATA) => {
  throw new TimingError(message, exitCode);
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const compareCodeUnits = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;

const resolveRelativePath = (value, label) => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    value.includes("\\") ||
    path.posix.isAbsolute(value)
  ) {
    fail(`${label} must be a safe repository-relative path.`, EXIT_USAGE);
  }
  const normalized = path.posix.normalize(value);
  if (
    normalized !== value ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    fail(`${label} must not traverse outside the working directory.`, EXIT_USAGE);
  }
  const absolute = path.resolve(process.cwd(), value);
  const relative = path.relative(process.cwd(), absolute);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`${label} must remain inside the working directory.`, EXIT_USAGE);
  }
  return absolute;
};

const pathExists = (absolutePath) => {
  try {
    lstatSync(absolutePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

const assertPlainDirectory = (absolutePath, label, create) => {
  const relative = path.relative(process.cwd(), absolutePath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`${label} must remain inside the working directory.`, EXIT_USAGE);
  }
  let current = process.cwd();
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!pathExists(current)) {
      if (!create) fail(`${label} does not exist.`);
      mkdirSync(current, { mode: 0o700 });
    }
    const stats = lstatSync(current);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      fail(`${label} must use only real directories.`);
    }
  }
};

const parsePairs = (arguments_, allowed) => {
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (!allowed.has(key) || value === undefined || values.has(key)) {
      fail("Invalid or duplicate command option.", EXIT_USAGE);
    }
    values.set(key, value);
  }
  return values;
};

const parseRunArguments = (arguments_) => {
  const separator = arguments_.indexOf("--");
  if (separator < 0 || separator === arguments_.length - 1) {
    fail("Timed execution requires a child command after --.", EXIT_USAGE);
  }
  const options = parsePairs(
    arguments_.slice(0, separator),
    new Set(["--id", "--output-directory"]),
  );
  const stepId = options.get("--id");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(stepId ?? "") || !ALL_STEP_IDS.has(stepId)) {
    fail("Unknown or invalid stable step ID.", EXIT_USAGE);
  }
  const outputDirectory = resolveRelativePath(
    options.get("--output-directory"),
    "Output directory",
  );
  return {
    stepId,
    outputDirectory,
    command: arguments_[separator + 1],
    args: arguments_.slice(separator + 2),
  };
};

const parseSummaryArguments = (arguments_) => {
  const options = parsePairs(
    arguments_,
    new Set(["--profile", "--input-directory", "--output", "--job-status"]),
  );
  const profile = options.get("--profile") ?? "serial";
  if (!Object.hasOwn(PROFILE_STEP_IDS, profile)) {
    fail("Unknown timing profile.", EXIT_USAGE);
  }
  const jobStatus = options.get("--job-status");
  if (!new Set(["success", "failure", "cancelled"]).has(jobStatus)) {
    fail("Job status must be success, failure or cancelled.", EXIT_USAGE);
  }
  const inputDirectory = resolveRelativePath(options.get("--input-directory"), "Input directory");
  const output = resolveRelativePath(options.get("--output"), "Summary output");
  const outputRelativeToInput = path.relative(inputDirectory, output);
  if (
    outputRelativeToInput === "" ||
    (!outputRelativeToInput.startsWith(`..${path.sep}`) && outputRelativeToInput !== "..")
  ) {
    fail("Summary output must remain outside the timing-record directory.", EXIT_USAGE);
  }
  return { profile, expectedStepIds: PROFILE_STEP_IDS[profile], inputDirectory, output, jobStatus };
};

const writeAtomic = (output, value) => {
  if (pathExists(output)) fail("Refusing to replace existing timing evidence.");
  assertPlainDirectory(path.dirname(output), "Output parent", true);
  const temporary = path.join(path.dirname(output), `.${path.basename(output)}.${process.pid}.tmp`);
  try {
    writeFileSync(temporary, jsonText(value), { flag: "wx", mode: 0o600 });
    renameSync(temporary, output);
  } finally {
    rmSync(temporary, { force: true });
  }
};

const signalExitCode = (signal) => 128 + (osConstants.signals[signal] ?? 0);

const killChildGroup = (child, signal, detached) => {
  try {
    if (detached && child.pid !== undefined) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
};

const executeTimedCommand = async ({ stepId, outputDirectory, command, args }) => {
  const output = path.join(outputDirectory, `${stepId}.json`);
  if (pathExists(output)) fail("A timing record already exists for this step.");
  assertPlainDirectory(outputDirectory, "Output directory", true);

  const startedAtUtc = new Date().toISOString();
  const started = process.hrtime.bigint();
  const detached = process.platform !== "win32";
  let spawnFailed = false;
  let forwardedSignal = null;
  const child = spawn(command, args, {
    detached,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  let forceTimer;
  child.once("error", () => {
    spawnFailed = true;
  });
  const signalHandlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"]) {
    const handler = () => {
      if (forwardedSignal !== null) return;
      forwardedSignal = signal;
      killChildGroup(child, signal, detached);
      forceTimer = setTimeout(() => killChildGroup(child, "SIGKILL", detached), SIGNAL_GRACE_MS);
      forceTimer.unref();
    };
    signalHandlers.set(signal, handler);
    process.once(signal, handler);
  }
  const { code, signal } = await new Promise((resolve) => {
    child.once("close", (closeCode, closeSignal) =>
      resolve({ code: closeCode, signal: closeSignal }),
    );
  });
  if (forceTimer !== undefined) clearTimeout(forceTimer);
  for (const [registeredSignal, handler] of signalHandlers) {
    process.removeListener(registeredSignal, handler);
  }

  const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
  const completedAtUtc = new Date().toISOString();
  const effectiveSignal = signal ?? forwardedSignal;
  const effectiveCode =
    effectiveSignal === null
      ? spawnFailed || !Number.isInteger(code) || code < 0
        ? 127
        : code
      : null;
  const status =
    effectiveSignal !== null ? "signaled" : effectiveCode === 0 ? "success" : "failure";
  const record = {
    schemaVersion: SCHEMA_VERSION,
    recordType: RECORD_TYPE,
    stepId,
    status,
    startedAtUtc,
    completedAtUtc,
    durationMs,
    exitCode: effectiveCode,
    signal: effectiveSignal,
  };
  const childStatus =
    effectiveSignal !== null ? signalExitCode(effectiveSignal) : (effectiveCode ?? 1);
  try {
    writeAtomic(output, record);
  } catch (error) {
    process.stderr.write(`ci-timing: unable to write timing evidence: ${error.message}\n`);
    return childStatus === 0 ? EXIT_IO : childStatus;
  }
  return childStatus;
};

const validUtc = (value) =>
  typeof value === "string" && value.endsWith("Z") && Number.isFinite(Date.parse(value));

const validateRecord = (value, filename) => {
  if (
    !isObject(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(RECORD_KEYS)
  ) {
    fail("Timing record contains malformed or unbounded fields.");
  }
  if (
    value.schemaVersion !== SCHEMA_VERSION ||
    value.recordType !== RECORD_TYPE ||
    !ALL_STEP_IDS.has(value.stepId) ||
    filename !== `${value.stepId}.json` ||
    !validUtc(value.startedAtUtc) ||
    !validUtc(value.completedAtUtc) ||
    !Number.isSafeInteger(value.durationMs) ||
    value.durationMs < 0 ||
    value.durationMs > MAX_DURATION_MS
  ) {
    fail("Timing record does not satisfy the bounded contract.");
  }
  const successful = value.status === "success" && value.exitCode === 0 && value.signal === null;
  const failed =
    value.status === "failure" &&
    Number.isInteger(value.exitCode) &&
    value.exitCode > 0 &&
    value.signal === null;
  const signaled =
    value.status === "signaled" &&
    value.exitCode === null &&
    /^[A-Z][A-Z0-9]+$/u.test(value.signal);
  if (!successful && !failed && !signaled) fail("Timing record status metadata is inconsistent.");
  return value;
};

const readRecords = (inputDirectory) => {
  if (!existsSync(inputDirectory)) return [];
  assertPlainDirectory(inputDirectory, "Timing input", false);
  return readdirSync(inputDirectory, { withFileTypes: true }).map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) {
      fail("Timing directory contains an undeclared entry.");
    }
    const source = readFileSync(path.join(inputDirectory, entry.name), "utf8");
    let parsed;
    try {
      parsed = JSON.parse(source);
    } catch {
      fail("Timing directory contains malformed JSON.");
    }
    return validateRecord(parsed, entry.name);
  });
};

const orderedRecords = (records, expectedStepIds) => {
  const position = new Map(expectedStepIds.map((stepId, index) => [stepId, index]));
  const seen = new Set();
  for (const record of records) {
    if (!position.has(record.stepId) || seen.has(record.stepId)) {
      fail("Timing profile contains an undeclared or duplicate step.");
    }
    seen.add(record.stepId);
  }
  const sorted = [...records].sort(
    (left, right) => position.get(left.stepId) - position.get(right.stepId),
  );
  if (sorted.some((record, index) => record.stepId !== expectedStepIds[index])) {
    fail("Timing records do not form the expected profile prefix.");
  }
  return sorted;
};

const markdownSummary = (summary) => {
  const heading =
    summary.profile === "serial"
      ? "## CI command timings"
      : `## CI command timings: \`${summary.profile}\``;
  const rows = summary.steps
    .map(
      (step) =>
        `| \`${step.stepId}\` | ${step.status} | ${(step.durationMs / 1000).toFixed(3)} s |`,
    )
    .join("\n");
  return `${heading}\n\n| Step | Status | Duration |\n| --- | --- | ---: |\n${rows}${rows ? "\n" : ""}\nMeasured command total: **${(summary.measuredTotalDurationMs / 1000).toFixed(3)} s**\n\n`;
};

const summarize = ({ profile, expectedStepIds, inputDirectory, output, jobStatus }) => {
  const steps = orderedRecords(readRecords(inputDirectory), expectedStepIds);
  const allExpected = steps.length === expectedStepIds.length;
  const complete = allExpected && steps.every(({ status }) => status === "success");
  if (jobStatus === "success" && !complete) {
    fail("Successful timing profile is missing complete successful evidence.");
  }
  const measuredTotalDurationMs = steps.reduce((total, step) => total + step.durationMs, 0);
  const slowestCompletedSteps = [...steps]
    .sort(
      (left, right) =>
        right.durationMs - left.durationMs || compareCodeUnits(left.stepId, right.stepId),
    )
    .slice(0, 3)
    .map(({ stepId, durationMs }) => ({ durationMs, stepId }));
  const summary = {
    schemaVersion: SCHEMA_VERSION,
    recordType: SUMMARY_TYPE,
    profile,
    jobStatus,
    complete,
    expectedStepCount: expectedStepIds.length,
    completedStepCount: steps.length,
    measuredTotalDurationMs,
    steps,
    slowestCompletedSteps,
  };
  writeAtomic(output, summary);
  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) {
    if (pathExists(stepSummary)) {
      const stats = lstatSync(stepSummary);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        fail("GitHub Step Summary target must be a regular file.");
      }
    }
    writeFileSync(stepSummary, markdownSummary(summary), { flag: "a", mode: 0o600 });
  }
};

const main = async () => {
  const [operation, ...arguments_] = process.argv.slice(2);
  if (operation === "run") return executeTimedCommand(parseRunArguments(arguments_));
  if (operation === "summarize") {
    summarize(parseSummaryArguments(arguments_));
    return 0;
  }
  fail("Usage: ci-timing.mjs <run|summarize> ...", EXIT_USAGE);
};

try {
  process.exitCode = await main();
} catch (error) {
  const exitCode = error instanceof TimingError ? error.exitCode : EXIT_IO;
  process.stderr.write(
    `ci-timing: ${error instanceof Error ? error.message : "unexpected failure"}\n`,
  );
  process.exitCode = exitCode;
}
