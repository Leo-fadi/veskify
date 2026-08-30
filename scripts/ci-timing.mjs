#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { constants as osConstants } from "node:os";
import path from "node:path";

const SCHEMA_VERSION = "1.0.0";
const RECORD_TYPE = "ci-command-timing";
const SUMMARY_TYPE = "ci-timing-summary";
const MAX_RECORD_BYTES = 16 * 1024;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const SIGNAL_GRACE_MS = 5_000;
const STEP_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const SIGNAL_PATTERN = /^SIG[A-Z0-9]+$/u;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const EXPECTED_STEP_IDS = [
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

class CiTimingError extends Error {
  constructor(code, message, exitCode = 64) {
    super(message);
    this.name = "CiTimingError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

const fail = (code, message, exitCode) => {
  throw new CiTimingError(code, message, exitCode);
};

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
};

const stableJson = (value) => `${JSON.stringify(stableValue(value), null, 2)}\n`;

const assertSafeRelativePath = (value, label) => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 256 ||
    value.includes("\0") ||
    value.includes("\\") ||
    path.posix.isAbsolute(value)
  ) {
    fail("path-invalid", `${label} must be a bounded repository-relative POSIX path.`);
  }
  const normalized = path.posix.normalize(value);
  if (
    normalized !== value ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    fail("path-traversal", `${label} must not traverse outside the working directory.`);
  }
  return path.resolve(process.cwd(), ...value.split("/"));
};

const assertStepId = (value, exitCode = 64) => {
  if (typeof value !== "string" || !STEP_ID_PATTERN.test(value)) {
    fail("step-id-invalid", "Step IDs must be stable lowercase kebab-case identifiers.", exitCode);
  }
  return value;
};

const assertPlainDirectory = (absolutePath, label) => {
  mkdirSync(absolutePath, { recursive: true });
  const stats = lstatSync(absolutePath);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    fail("directory-invalid", `${label} must be a real directory.`, 65);
  }
};

const assertReplaceableFile = (absolutePath) => {
  if (!existsSync(absolutePath)) return;
  const stats = lstatSync(absolutePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    fail("output-invalid", "Refusing to replace a non-regular or symbolic-link output.", 65);
  }
};

const writeJsonAtomically = (absolutePath, value) => {
  const directory = path.dirname(absolutePath);
  assertPlainDirectory(directory, "Output parent");
  assertReplaceableFile(absolutePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(absolutePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(temporaryPath, stableJson(value), { flag: "wx", mode: 0o600 });
    renameSync(temporaryPath, absolutePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
};

const parseNamedOptions = (values, allowedNames) => {
  const options = new Map();
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!allowedNames.has(name)) fail("usage", `Unknown option ${name ?? "<missing>"}.`);
    if (value === undefined || value.startsWith("--")) {
      fail("usage", `Missing value for ${name}.`);
    }
    if (options.has(name)) fail("usage", `Duplicate option ${name}.`);
    options.set(name, value);
  }
  return options;
};

const requireOptions = (options, names) => {
  for (const name of names) {
    if (!options.has(name)) fail("usage", `Missing required option ${name}.`);
  }
};

const parseRunArguments = (values) => {
  const separatorIndex = values.indexOf("--");
  if (separatorIndex < 0) fail("usage", "Timed execution requires a -- command separator.");
  const options = parseNamedOptions(
    values.slice(0, separatorIndex),
    new Set(["--id", "--output-directory"]),
  );
  requireOptions(options, ["--id", "--output-directory"]);
  const command = values.slice(separatorIndex + 1);
  if (command.length === 0 || command.length > 256) {
    fail("usage", "Timed execution requires one bounded child command.");
  }
  for (const argument of command) {
    if (argument.length === 0 || argument.length > 32_768 || argument.includes("\0")) {
      fail("usage", "Child command arguments must be non-empty bounded strings.");
    }
  }
  return {
    stepId: assertStepId(options.get("--id")),
    outputDirectory: options.get("--output-directory"),
    command,
  };
};

const parseSummaryArguments = (values) => {
  const options = parseNamedOptions(
    values,
    new Set(["--input-directory", "--output", "--job-status"]),
  );
  requireOptions(options, ["--input-directory", "--output", "--job-status"]);
  const jobStatus = options.get("--job-status");
  if (!["success", "failure", "cancelled"].includes(jobStatus)) {
    fail("usage", "Job status must be success, failure or cancelled.");
  }
  return {
    inputDirectory: options.get("--input-directory"),
    output: options.get("--output"),
    jobStatus,
  };
};

const signalExitCode = (signal) => 128 + (osConstants.signals[signal] ?? 1);

const killChildGroup = (child, signal, detached) => {
  try {
    if (detached && child.pid !== undefined) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
};

const runTimedCommand = async ({ stepId, outputDirectory, command }) => {
  const directory = assertSafeRelativePath(outputDirectory, "Output directory");
  assertPlainDirectory(directory, "Output directory");
  const recordPath = path.join(directory, `${stepId}.json`);
  if (existsSync(recordPath)) {
    fail("record-exists", `Timing record already exists for ${stepId}.`, 65);
  }

  const startedAtUtc = new Date().toISOString();
  const monotonicStart = process.hrtime.bigint();
  const detached = process.platform !== "win32";
  const child = spawn(command[0], command.slice(1), {
    detached,
    shell: false,
    stdio: "inherit",
  });
  let spawnFailed = false;
  let forwardedSignal = null;
  let forceKillTimer;

  child.once("error", () => {
    spawnFailed = true;
  });

  const signalHandlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"]) {
    const handler = () => {
      if (forwardedSignal !== null) return;
      forwardedSignal = signal;
      killChildGroup(child, signal, detached);
      forceKillTimer = setTimeout(
        () => killChildGroup(child, "SIGKILL", detached),
        SIGNAL_GRACE_MS,
      );
      forceKillTimer.unref();
    };
    signalHandlers.set(signal, handler);
    process.once(signal, handler);
  }

  const completion = await new Promise((resolveCompletion) => {
    child.once("close", (code, signal) => resolveCompletion({ code, signal }));
  });

  if (forceKillTimer !== undefined) clearTimeout(forceKillTimer);
  for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);

  const durationMs = Number((process.hrtime.bigint() - monotonicStart) / 1_000_000n);
  const completedAtUtc = new Date().toISOString();
  const effectiveSignal = completion.signal ?? forwardedSignal;
  const exitCode =
    effectiveSignal === null
      ? spawnFailed || !Number.isInteger(completion.code) || completion.code < 0
        ? 127
        : completion.code
      : null;
  const status = effectiveSignal !== null ? "signaled" : exitCode === 0 ? "success" : "failure";
  const record = {
    schemaVersion: SCHEMA_VERSION,
    recordType: RECORD_TYPE,
    stepId,
    status,
    startedAtUtc,
    completedAtUtc,
    durationMs,
    exitCode,
    signal: effectiveSignal,
  };

  let evidenceWriteFailed = false;
  try {
    writeJsonAtomically(recordPath, record);
  } catch {
    evidenceWriteFailed = true;
    process.stderr.write("ci-timing: evidence-write: Unable to write timing evidence.\n");
  }

  const commandExitCode =
    effectiveSignal !== null ? signalExitCode(effectiveSignal) : (exitCode ?? 1);
  return commandExitCode !== 0 ? commandExitCode : evidenceWriteFailed ? 74 : 0;
};

const assertExactKeys = (value, expectedKeys, label) => {
  const actualKeys = Object.keys(value).sort();
  const canonicalExpected = [...expectedKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(canonicalExpected)) {
    fail("record-shape", `${label} has unsupported or missing fields.`, 65);
  }
};

const assertUtcTimestamp = (value, label) => {
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) {
    fail("record-timestamp", `${label} must be a bounded UTC timestamp.`, 65);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    fail("record-timestamp", `${label} is not a canonical UTC timestamp.`, 65);
  }
};

const validateRecord = (value, filename) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("record-shape", "Timing record must be an object.", 65);
  }
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "recordType",
      "stepId",
      "status",
      "startedAtUtc",
      "completedAtUtc",
      "durationMs",
      "exitCode",
      "signal",
    ],
    "Timing record",
  );
  if (value.schemaVersion !== SCHEMA_VERSION || value.recordType !== RECORD_TYPE) {
    fail("record-version", "Timing record uses an unsupported identity.", 65);
  }
  const stepId = assertStepId(value.stepId, 65);
  if (filename !== `${stepId}.json` || !EXPECTED_STEP_IDS.includes(stepId)) {
    fail("record-identity", "Timing record filename or step identity is not declared.", 65);
  }
  if (!["success", "failure", "signaled"].includes(value.status)) {
    fail("record-status", "Timing record status is invalid.", 65);
  }
  assertUtcTimestamp(value.startedAtUtc, "Start time");
  assertUtcTimestamp(value.completedAtUtc, "Completion time");
  if (Date.parse(value.completedAtUtc) < Date.parse(value.startedAtUtc)) {
    fail("record-timestamp", "Timing record completion precedes its start.", 65);
  }
  if (
    !Number.isInteger(value.durationMs) ||
    value.durationMs < 0 ||
    value.durationMs > MAX_DURATION_MS
  ) {
    fail("record-duration", "Timing record duration is outside the bounded range.", 65);
  }
  const exitCodeValid =
    value.exitCode === null ||
    (Number.isInteger(value.exitCode) && value.exitCode >= 0 && value.exitCode <= 255);
  const signalValid =
    value.signal === null ||
    (typeof value.signal === "string" &&
      value.signal.length <= 32 &&
      SIGNAL_PATTERN.test(value.signal));
  if (!exitCodeValid || !signalValid) {
    fail("record-termination", "Timing record termination metadata is invalid.", 65);
  }
  if (
    (value.status === "success" && (value.exitCode !== 0 || value.signal !== null)) ||
    (value.status === "failure" &&
      (value.exitCode === null || value.exitCode === 0 || value.signal !== null)) ||
    (value.status === "signaled" && (value.exitCode !== null || value.signal === null))
  ) {
    fail("record-consistency", "Timing status and termination metadata disagree.", 65);
  }
  return value;
};

const readTimingRecords = (absoluteDirectory, allowMissing) => {
  if (!existsSync(absoluteDirectory)) {
    if (allowMissing) return [];
    fail("records-missing", "Successful jobs require the timing record directory.", 65);
  }
  const directoryStats = lstatSync(absoluteDirectory);
  if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
    fail("records-directory", "Timing input must be a real directory.", 65);
  }
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const records = [];
  const ids = new Set();
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) {
      fail("record-file", "Timing input contains an unsupported entry.", 65);
    }
    const recordPath = path.join(absoluteDirectory, entry.name);
    if (statSync(recordPath).size > MAX_RECORD_BYTES) {
      fail("record-size", "Timing record exceeds the bounded size.", 65);
    }
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(recordPath, "utf8"));
    } catch {
      fail("record-json", "Timing record is not valid JSON.", 65);
    }
    const record = validateRecord(parsed, entry.name);
    if (ids.has(record.stepId)) fail("record-duplicate", "Duplicate timing step ID.", 65);
    ids.add(record.stepId);
    records.push(record);
  }
  records.sort(
    (left, right) =>
      EXPECTED_STEP_IDS.indexOf(left.stepId) - EXPECTED_STEP_IDS.indexOf(right.stepId),
  );
  return records;
};

const validateRecordSequence = (records, jobStatus) => {
  const actualIds = records.map(({ stepId }) => stepId);
  const expectedPrefix = EXPECTED_STEP_IDS.slice(0, records.length);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedPrefix)) {
    fail("record-order", "Timing records must form the declared ordered prefix.", 65);
  }
  if (records.slice(0, -1).some(({ status }) => status !== "success")) {
    fail("record-order", "A failed or signaled command must terminate the recorded prefix.", 65);
  }
  if (jobStatus === "success") {
    if (records.length !== EXPECTED_STEP_IDS.length) {
      fail("records-incomplete", "Successful jobs require every expected timing record.", 65);
    }
    if (records.some(({ status }) => status !== "success")) {
      fail("records-failed", "Successful jobs cannot contain failed timing records.", 65);
    }
  }
};

const formatDuration = (durationMs) => `${(durationMs / 1000).toFixed(3)} s`;

const markdownSummary = (summary) => {
  const lines = [
    "## CI command timings",
    "",
    `Job status: **${summary.jobStatus}**`,
    "",
    "| Step | Status | Duration |",
    "| --- | --- | ---: |",
    ...summary.steps.map(
      ({ stepId, status, durationMs }) =>
        `| \`${stepId}\` | ${status} | ${formatDuration(durationMs)} |`,
    ),
    "",
    `Measured command total: **${formatDuration(summary.measuredTotalDurationMs)}**`,
    "",
  ];
  return `${lines.join("\n")}\n`;
};

const appendStepSummary = (markdown) => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  if (existsSync(summaryPath)) {
    const stats = lstatSync(summaryPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      fail("step-summary-invalid", "GitHub Step Summary target must be a regular file.", 65);
    }
  }
  appendFileSync(summaryPath, markdown, { encoding: "utf8", mode: 0o600 });
};

const summarizeTimings = ({ inputDirectory, output, jobStatus }) => {
  const absoluteInput = assertSafeRelativePath(inputDirectory, "Input directory");
  const absoluteOutput = assertSafeRelativePath(output, "Summary output");
  const outputWithinInput = path.relative(absoluteInput, absoluteOutput);
  if (
    outputWithinInput === "" ||
    (!outputWithinInput.startsWith("..") && !path.isAbsolute(outputWithinInput))
  ) {
    fail("summary-output-scope", "Summary output must be outside the timing input directory.");
  }
  const records = readTimingRecords(absoluteInput, jobStatus !== "success");
  validateRecordSequence(records, jobStatus);
  const measuredTotalDurationMs = records.reduce((total, { durationMs }) => total + durationMs, 0);
  const slowestCompletedSteps = [...records]
    .sort(
      (left, right) =>
        right.durationMs - left.durationMs ||
        EXPECTED_STEP_IDS.indexOf(left.stepId) - EXPECTED_STEP_IDS.indexOf(right.stepId),
    )
    .slice(0, 3)
    .map(({ stepId, durationMs }) => ({ stepId, durationMs }));
  const summary = {
    schemaVersion: SCHEMA_VERSION,
    recordType: SUMMARY_TYPE,
    jobStatus,
    complete: records.length === EXPECTED_STEP_IDS.length,
    expectedStepCount: EXPECTED_STEP_IDS.length,
    completedStepCount: records.length,
    measuredTotalDurationMs,
    steps: records,
    slowestCompletedSteps,
  };
  writeJsonAtomically(absoluteOutput, summary);
  appendStepSummary(markdownSummary(summary));
};

const main = async () => {
  const [subcommand, ...values] = process.argv.slice(2);
  if (subcommand === "run") {
    process.exitCode = await runTimedCommand(parseRunArguments(values));
    return;
  }
  if (subcommand === "summarize") {
    summarizeTimings(parseSummaryArguments(values));
    return;
  }
  fail("usage", "Expected run or summarize.");
};

try {
  await main();
} catch (error) {
  const safeError =
    error instanceof CiTimingError
      ? error
      : new CiTimingError("internal-error", "Unexpected CI timing failure.", 70);
  process.stderr.write(`ci-timing: ${safeError.code}: ${safeError.message}\n`);
  process.exitCode = safeError.exitCode;
}
