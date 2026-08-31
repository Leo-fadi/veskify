#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { constants as osConstants, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const DEFAULT_INVENTORY_PATH = join(REPOSITORY_ROOT, "scripts", "playwright-ci-suites.v1.json");
const DEFAULT_EXECUTION_PLAN_PATH = join(
  REPOSITORY_ROOT,
  "scripts",
  "playwright-ci-execution-plan.v1.json",
);
const INVENTORY_KEYS = ["recordType", "schemaVersion", "suites"];
const SUITE_KEYS = ["args", "configPath", "enabled", "id", "label", "order", "required"];
const TIMING_RECORD_KEYS = [
  "completedAt",
  "configPath",
  "durationMs",
  "exitCode",
  "inventoryFingerprint",
  "recordType",
  "schemaVersion",
  "signal",
  "startedAt",
  "status",
  "suiteId",
  "suiteLabel",
  "suiteOrder",
];
const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const TERMINATION_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"];
const SIGNAL_EXIT_CODES = new Map(
  Object.entries(osConstants.signals).map(([signal, number]) => [signal, 128 + number]),
);
const GROUP_MIN = 2;
const GROUP_MAX = 6;
const TARGET_MAKESPAN_MS = 25 * 60 * 1000;
const TARGET_IMBALANCE_MILLIS = 1250;
const EXECUTION_PLAN_KEYS = [
  "enabled",
  "groups",
  "planId",
  "planType",
  "recordType",
  "required",
  "schemaVersion",
  "sourceInventoryFingerprint",
  "sourceProvenance",
  "sourceTimingSummarySha256",
];
const EXECUTION_GROUP_KEYS = [
  "enabled",
  "entries",
  "groupId",
  "order",
  "required",
  "sourcePredictedDurationMs",
];
const EXECUTION_PROVENANCE_KEYS = ["commitSha", "groupPlanSha256", "runId"];
const WHOLE_ENTRY_KEYS = ["suiteId"];
const SHARD_ENTRY_KEYS = ["shardIndex", "shardTotal", "suiteId"];
const GROUP_MANIFEST_KEYS = [
  "completedAt",
  "completedEntries",
  "durationMs",
  "expectedEntries",
  "groupId",
  "inventoryFingerprint",
  "planFingerprint",
  "planId",
  "recordType",
  "schemaVersion",
  "startedAt",
  "terminalResult",
];
const GROUP_EXPECTED_ENTRY_KEYS = [
  "blobFilename",
  "configPath",
  "entryId",
  "entryOrder",
  "shardIndex",
  "shardTotal",
  "suiteId",
  "suiteOrder",
];
const GROUP_COMPLETED_ENTRY_KEYS = [
  ...GROUP_EXPECTED_ENTRY_KEYS,
  "blobSha256",
  "durationMs",
  "status",
  "timingFilename",
  "timingSha256",
];
const GROUP_TIMING_KEYS = [
  "blobFilename",
  "completedAt",
  "configPath",
  "durationMs",
  "entryId",
  "entryOrder",
  "exitCode",
  "groupId",
  "inventoryFingerprint",
  "planFingerprint",
  "planId",
  "recordType",
  "schemaVersion",
  "shardIndex",
  "shardTotal",
  "signal",
  "startedAt",
  "status",
  "suiteId",
  "suiteOrder",
];
const CI_SUMMARY_KEYS = [
  "complete",
  "completedStepCount",
  "expectedStepCount",
  "jobStatus",
  "measuredTotalDurationMs",
  "profile",
  "recordType",
  "schemaVersion",
  "slowestCompletedSteps",
  "steps",
];
const CI_TIMING_KEYS = [
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
const GROUP_TERMINAL_KEYS = ["exitCode", "signal", "status"];
const MATRIX_GROUP_MAX = 6;
const SUITE_SHARD_MAX = 4;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_RUN_ID_PATTERN = /^[1-9][0-9]{0,19}$/u;
const LOCKED_SOURCE_RUN_ID = 33335864920;
const LOCKED_SOURCE_COMMIT = "50f13ea3abbed190fe522f777b6acdaf4f5e4428";
const LOCKED_SOURCE_TIMING_SHA256 =
  "e04286caa055694d51a09b64933689b96a234d6de9023d6d6cbf8f46a69e191c";
const LOCKED_SOURCE_GROUP_PLAN_SHA256 =
  "ea351caeea8f4c7483a6c5444a359484f4249b502846c4f28304d0717b5e04c8";

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, expected, label) {
  if (!isPlainObject(value)) fail(`${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} must contain exactly: ${wanted.join(", ")}.`);
  }
}

function assertSafeRelativePath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 180) {
    fail(`${label} must be a bounded relative path.`);
  }
  if (
    isAbsolute(value) ||
    value.includes("\\") ||
    value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    fail(`${label} must not contain absolute or traversal authority.`);
  }
}

function assertRegularFile(path, label) {
  if (!existsSync(path)) fail(`${label} does not exist: ${path}`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) fail(`${label} must be a regular file: ${path}`);
}

function assertDirectory(path, label, create = false) {
  if (create) mkdirSync(path, { recursive: true });
  if (!existsSync(path)) fail(`${label} does not exist: ${path}`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail(`${label} must be a real directory: ${path}`);
  }
}

export function canonicalSerialize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`)
      .join(",")}}`;
  }
  fail("Only finite JSON values can be serialized canonically.");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprint(domain, value) {
  return `${domain}_${sha256(`${domain}\0${canonicalSerialize(value)}`)}`;
}

function readJsonFile(path, label) {
  assertRegularFile(path, label);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parsed;
}

export function validateSuiteInventory(value, repositoryRoot = REPOSITORY_ROOT) {
  assertExactKeys(value, INVENTORY_KEYS, "Playwright suite inventory");
  if (value.schemaVersion !== "1.0.0") fail("Unsupported suite inventory schemaVersion.");
  if (value.recordType !== "playwright-ci-suite-inventory") {
    fail("Unsupported suite inventory recordType.");
  }
  if (!Array.isArray(value.suites) || value.suites.length === 0) {
    fail("Suite inventory must contain at least one suite.");
  }

  const ids = new Set();
  const configPaths = new Set();
  let defaultCount = 0;
  const suites = value.suites.map((suite, index) => {
    assertExactKeys(suite, SUITE_KEYS, `Suite ${index + 1}`);
    if (typeof suite.id !== "string" || !ID_PATTERN.test(suite.id)) {
      fail(`Suite ${index + 1} has an invalid stable ID.`);
    }
    if (ids.has(suite.id)) fail(`Duplicate suite ID: ${suite.id}.`);
    ids.add(suite.id);
    if (suite.order !== index + 1) fail(`Suite ${suite.id} has a non-canonical order.`);
    if (typeof suite.label !== "string" || suite.label.trim() !== suite.label || !suite.label) {
      fail(`Suite ${suite.id} has an invalid label.`);
    }
    assertSafeRelativePath(suite.configPath, `Suite ${suite.id} configPath`);
    if (!suite.configPath.endsWith(".config.ts")) {
      fail(`Suite ${suite.id} must reference a TypeScript Playwright config.`);
    }
    if (configPaths.has(suite.configPath)) fail(`Duplicate configPath: ${suite.configPath}.`);
    configPaths.add(suite.configPath);
    assertRegularFile(resolve(repositoryRoot, suite.configPath), `Suite ${suite.id} config`);
    if (!Array.isArray(suite.args) || suite.args.some((arg) => typeof arg !== "string")) {
      fail(`Suite ${suite.id} args must be strings.`);
    }
    const expectedArgs =
      suite.configPath === "playwright.config.ts" ? ["test"] : ["test", "-c", suite.configPath];
    if (JSON.stringify(suite.args) !== JSON.stringify(expectedArgs)) {
      fail(`Suite ${suite.id} command args do not match its exact config authority.`);
    }
    if (suite.configPath === "playwright.config.ts") defaultCount += 1;
    if (suite.required !== true || suite.enabled !== true) {
      fail(`Required suite ${suite.id} must remain enabled.`);
    }
    return Object.freeze({ ...suite, args: Object.freeze([...suite.args]) });
  });
  if (defaultCount !== 1) fail("The inventory must contain exactly one default config suite.");

  const projection = suites.map(({ id, order, configPath, args, required, enabled }) => ({
    id,
    order,
    configPath,
    args,
    required,
    enabled,
  }));
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    recordType: value.recordType,
    suites: Object.freeze(suites),
    fingerprint: fingerprint("veskify-playwright-suite-inventory-v1", projection),
  });
}

export function loadSuiteInventory(
  inventoryPath = DEFAULT_INVENTORY_PATH,
  repositoryRoot = REPOSITORY_ROOT,
) {
  return validateSuiteInventory(
    readJsonFile(inventoryPath, "Playwright suite inventory"),
    repositoryRoot,
  );
}

function timingRecordFilename(suite) {
  return `${String(suite.order).padStart(2, "0")}-${suite.id}.json`;
}

function writeJsonAtomic(path, value) {
  const parent = dirname(path);
  assertDirectory(parent, "Output directory", true);
  if (existsSync(path)) fail(`Refusing to overwrite existing evidence: ${path}`);
  const temporaryPath = join(parent, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporaryPath, `${canonicalSerialize(value)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporaryPath, path);
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath);
  }
}

function conventionalExitCode(code, signal) {
  if (Number.isInteger(code)) return code;
  if (typeof signal === "string" && SIGNAL_EXIT_CODES.has(signal)) {
    return SIGNAL_EXIT_CODES.get(signal);
  }
  return 1;
}

export function exitCodeForResult(result) {
  return conventionalExitCode(result.exitCode, result.signal);
}

function forwardSignal(child, signal) {
  if (child.pid === undefined) return;
  try {
    if (process.platform !== "win32") process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // The child already exited.
    }
  }
}

async function executeSuite(suite, options) {
  const startedAtDate = new Date();
  const startedNs = process.hrtime.bigint();
  const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawn(pnpmExecutable, ["exec", "playwright", ...suite.args], {
    cwd: options.repositoryRoot,
    env: process.env,
    shell: false,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  let requestedSignal = null;
  let escalationTimer = null;
  const handlers = new Map();
  for (const signal of TERMINATION_SIGNALS) {
    const handler = () => {
      if (requestedSignal !== null) return;
      requestedSignal = signal;
      forwardSignal(child, signal);
      escalationTimer = setTimeout(() => forwardSignal(child, "SIGKILL"), 5000);
      escalationTimer.unref();
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }

  const result = await new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("close", (exitCode, childSignal) => {
      resolvePromise({ exitCode, signal: childSignal ?? requestedSignal });
    });
  }).finally(() => {
    for (const [signal, handler] of handlers) process.off(signal, handler);
    if (escalationTimer !== null) clearTimeout(escalationTimer);
  });

  const completedAtDate = new Date();
  const durationMs = Number((process.hrtime.bigint() - startedNs) / 1_000_000n);
  const status =
    requestedSignal !== null || result.signal !== null
      ? "cancelled"
      : result.exitCode === 0
        ? "success"
        : "failure";
  const record = {
    schemaVersion: "1.0.0",
    recordType: "playwright-ci-suite-timing",
    inventoryFingerprint: options.inventory.fingerprint,
    suiteId: suite.id,
    suiteOrder: suite.order,
    suiteLabel: suite.label,
    configPath: suite.configPath,
    startedAt: startedAtDate.toISOString(),
    completedAt: completedAtDate.toISOString(),
    durationMs,
    status,
    exitCode: result.exitCode,
    signal: result.signal,
  };
  writeJsonAtomic(join(options.outputDirectory, timingRecordFilename(suite)), record);
  return record;
}

export async function runAllSuites(options = {}) {
  const repositoryRoot = resolve(options.repositoryRoot ?? REPOSITORY_ROOT);
  const inventory =
    options.inventory ??
    loadSuiteInventory(options.inventoryPath ?? DEFAULT_INVENTORY_PATH, repositoryRoot);
  const outputDirectory = resolve(
    options.outputDirectory ??
      process.env.PLAYWRIGHT_CI_TIMING_OUTPUT_DIRECTORY ??
      join(tmpdir(), `veskify-playwright-ci-${process.pid}-${randomUUID()}`),
  );
  assertDirectory(outputDirectory, "Playwright timing output directory", true);
  for (const suite of inventory.suites) {
    const evidencePath = join(outputDirectory, timingRecordFilename(suite));
    if (existsSync(evidencePath)) fail(`Timing evidence already exists for ${suite.id}.`);
    const record = await executeSuite(suite, { repositoryRoot, outputDirectory, inventory });
    if (record.status !== "success") {
      return {
        exitCode: conventionalExitCode(record.exitCode, record.signal),
        outputDirectory,
        completedSuiteIds: inventory.suites.slice(0, suite.order).map((candidate) => candidate.id),
      };
    }
  }
  return {
    exitCode: 0,
    outputDirectory,
    completedSuiteIds: inventory.suites.map((suite) => suite.id),
  };
}

function assertIsoTimestamp(value, label) {
  if (
    typeof value !== "string" ||
    value.length > 32 ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    fail(`${label} must be a bounded UTC ISO timestamp.`);
  }
}

export function validateTimingRecord(value, inventory) {
  assertExactKeys(value, TIMING_RECORD_KEYS, "Playwright timing record");
  if (value.schemaVersion !== "1.0.0" || value.recordType !== "playwright-ci-suite-timing") {
    fail("Unsupported Playwright timing record identity.");
  }
  const suite = inventory.suites.find((candidate) => candidate.id === value.suiteId);
  if (!suite) fail(`Unknown timing suite ID: ${String(value.suiteId)}.`);
  if (
    value.inventoryFingerprint !== inventory.fingerprint ||
    value.suiteOrder !== suite.order ||
    value.suiteLabel !== suite.label ||
    value.configPath !== suite.configPath
  ) {
    fail(`Timing authority mismatch for ${suite.id}.`);
  }
  assertIsoTimestamp(value.startedAt, `${suite.id} startedAt`);
  assertIsoTimestamp(value.completedAt, `${suite.id} completedAt`);
  if (Date.parse(value.completedAt) < Date.parse(value.startedAt)) {
    fail(`${suite.id} completed before it started.`);
  }
  if (
    !Number.isInteger(value.durationMs) ||
    value.durationMs < 0 ||
    value.durationMs > MAX_DURATION_MS
  ) {
    fail(`${suite.id} has an invalid duration.`);
  }
  if (!["success", "failure", "cancelled"].includes(value.status)) {
    fail(`${suite.id} has an invalid status.`);
  }
  if (
    value.exitCode !== null &&
    (!Number.isInteger(value.exitCode) || value.exitCode < 0 || value.exitCode > 255)
  ) {
    fail(`${suite.id} has an invalid exit code.`);
  }
  if (
    value.signal !== null &&
    (typeof value.signal !== "string" || !/^SIG[A-Z0-9]+$/u.test(value.signal))
  ) {
    fail(`${suite.id} has invalid signal metadata.`);
  }
  if (value.status === "success" && (value.exitCode !== 0 || value.signal !== null)) {
    fail(`${suite.id} success metadata is inconsistent.`);
  }
  if (value.status === "failure" && (value.exitCode === 0 || value.signal !== null)) {
    fail(`${suite.id} failure metadata is inconsistent.`);
  }
  if (value.status === "cancelled" && value.signal === null) {
    fail(`${suite.id} cancellation must retain a signal.`);
  }
  return { ...value };
}

function readTimingDirectory(inputDirectory, inventory) {
  assertDirectory(inputDirectory, "Playwright timing input directory");
  const records = [];
  const seenIds = new Set();
  for (const entry of readdirSync(inputDirectory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) fail(`Unexpected timing evidence entry: ${entry.name}.`);
    const path = join(inputDirectory, entry.name);
    if (entry.isSymbolicLink() || !entry.isFile() || !entry.name.endsWith(".json")) {
      fail(`Timing evidence must contain regular JSON files only: ${entry.name}.`);
    }
    const raw = readFileSync(path, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      fail(
        `Malformed timing record ${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const record = validateTimingRecord(parsed, inventory);
    if (seenIds.has(record.suiteId)) fail(`Duplicate timing suite ID: ${record.suiteId}.`);
    seenIds.add(record.suiteId);
    records.push({ ...record, recordSha256: sha256(raw) });
  }
  records.sort((left, right) => left.suiteOrder - right.suiteOrder);
  for (let index = 0; index < records.length; index += 1) {
    if (records[index].suiteId !== inventory.suites[index].id) {
      fail("Partial timing evidence must be an exact canonical suite prefix.");
    }
  }
  return records;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function durationShareBasisPoints(durationMs, totalDurationMs) {
  return totalDurationMs === 0 ? 0 : Math.round((durationMs * 10_000) / totalDurationMs);
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export function renderTimingMarkdown(summary) {
  const lines = [
    "## Playwright suite timings",
    "",
    `Measured ${summary.measuredSuiteCount}/${summary.expectedSuiteCount} suites (${summary.completeness}).`,
    "",
    "| # | Suite | Status | Duration | Share |",
    "|---:|---|---|---:|---:|",
  ];
  for (const suite of summary.suites) {
    lines.push(
      `| ${suite.order} | ${suite.id} | ${suite.status} | ${formatDuration(suite.durationMs)} | ${(suite.durationShareBasisPoints / 100).toFixed(2)}% |`,
    );
  }
  if (summary.unmeasuredSuiteIds.length > 0) {
    lines.push("", `Unmeasured canonical suffix: ${summary.unmeasuredSuiteIds.join(", ")}.`);
  }
  return `${lines.join("\n")}\n`;
}

export function summarizeTimingDirectory(options) {
  const repositoryRoot = resolve(options.repositoryRoot ?? REPOSITORY_ROOT);
  const inventory =
    options.inventory ??
    loadSuiteInventory(options.inventoryPath ?? DEFAULT_INVENTORY_PATH, repositoryRoot);
  if (!["success", "failure", "cancelled"].includes(options.jobStatus)) {
    fail("Summary jobStatus must be success, failure, or cancelled.");
  }
  const records = readTimingDirectory(resolve(options.inputDirectory), inventory);
  if (options.jobStatus === "success" && records.length !== inventory.suites.length) {
    fail("A successful browser job requires every canonical suite timing record.");
  }
  if (options.jobStatus === "success" && records.some((record) => record.status !== "success")) {
    fail("A successful browser job cannot contain a failed or cancelled suite.");
  }
  if (
    options.jobStatus !== "success" &&
    records.slice(0, -1).some((record) => record.status !== "success")
  ) {
    fail("Partial evidence may contain a terminal failure only in its final record.");
  }
  const measuredTotalDurationMs = records.reduce((total, record) => total + record.durationMs, 0);
  const suites = records.map((record) => ({
    order: record.suiteOrder,
    id: record.suiteId,
    label: record.suiteLabel,
    configPath: record.configPath,
    status: record.status,
    durationMs: record.durationMs,
    durationShareBasisPoints: durationShareBasisPoints(record.durationMs, measuredTotalDurationMs),
    exitCode: record.exitCode,
    signal: record.signal,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    recordSha256: record.recordSha256,
  }));
  const slowestSuites = [...suites]
    .sort(
      (left, right) =>
        right.durationMs - left.durationMs ||
        left.order - right.order ||
        left.id.localeCompare(right.id),
    )
    .map(({ id, order, durationMs, durationShareBasisPoints: share }) => ({
      id,
      order,
      durationMs,
      durationShareBasisPoints: share,
    }));
  const summary = {
    schemaVersion: "1.0.0",
    recordType: "playwright-ci-suite-timing-summary",
    inventoryFingerprint: inventory.fingerprint,
    jobStatus: options.jobStatus,
    completeness: records.length === inventory.suites.length ? "complete" : "partial",
    expectedSuiteCount: inventory.suites.length,
    measuredSuiteCount: records.length,
    measuredTotalDurationMs,
    medianSuiteDurationMs: median(records.map((record) => record.durationMs)),
    suites,
    slowestSuites,
    unmeasuredSuiteIds: inventory.suites.slice(records.length).map((suite) => suite.id),
  };
  writeJsonAtomic(resolve(options.output), summary);
  const markdown = renderTimingMarkdown(summary);
  if (options.githubStepSummaryPath) {
    appendFileSync(options.githubStepSummaryPath, markdown, { encoding: "utf8" });
  }
  return { summary, markdown };
}

function buildPlanForGroupCount(suites, groupCount) {
  const assignmentOrder = [...suites].sort(
    (left, right) =>
      right.durationMs - left.durationMs ||
      left.order - right.order ||
      left.id.localeCompare(right.id),
  );
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    group: index + 1,
    durationMs: 0,
    suites: [],
  }));
  for (const suite of assignmentOrder) {
    const group = groups.reduce((selected, candidate) =>
      candidate.durationMs < selected.durationMs ||
      (candidate.durationMs === selected.durationMs && candidate.group < selected.group)
        ? candidate
        : selected,
    );
    group.durationMs += suite.durationMs;
    group.suites.push({ id: suite.id, order: suite.order, durationMs: suite.durationMs });
  }
  for (const group of groups) group.suites.sort((left, right) => left.order - right.order);
  const totalDurationMs = groups.reduce((total, group) => total + group.durationMs, 0);
  const makespanMs = Math.max(...groups.map((group) => group.durationMs));
  const averageDurationMs = Math.round(totalDurationMs / groupCount);
  const imbalanceMillis =
    averageDurationMs === 0 ? 1000 : Math.round((makespanMs * 1000) / averageDurationMs);
  return {
    groupCount,
    runnerCount: groupCount,
    estimatedMakespanMs: makespanMs,
    averageGroupDurationMs: averageDurationMs,
    imbalanceMillis,
    targetMakespanMet: makespanMs <= TARGET_MAKESPAN_MS,
    targetImbalanceMet: imbalanceMillis <= TARGET_IMBALANCE_MILLIS,
    estimatedRunnerMinutes: groups.reduce(
      (total, group) => total + Math.ceil(group.durationMs / 60_000),
      0,
    ),
    groups,
  };
}

export function buildBalancedGroupPlan(summary) {
  if (
    !isPlainObject(summary) ||
    summary.recordType !== "playwright-ci-suite-timing-summary" ||
    summary.completeness !== "complete" ||
    summary.jobStatus !== "success" ||
    !Array.isArray(summary.suites) ||
    summary.suites.length === 0 ||
    summary.suites.some(
      (suite) =>
        !isPlainObject(suite) ||
        typeof suite.id !== "string" ||
        !Number.isInteger(suite.order) ||
        !Number.isInteger(suite.durationMs) ||
        suite.durationMs < 0 ||
        suite.status !== "success",
    )
  ) {
    fail("Group planning requires a complete successful suite timing summary.");
  }
  const canonicalSuites = [...summary.suites].sort((left, right) => left.order - right.order);
  if (canonicalSuites.some((suite, index) => suite.order !== index + 1)) {
    fail("Group planning requires canonical suite order.");
  }
  const plans = [];
  for (let count = GROUP_MIN; count <= Math.min(GROUP_MAX, canonicalSuites.length); count += 1) {
    plans.push(buildPlanForGroupCount(canonicalSuites, count));
  }
  const meetingTarget = plans.find((plan) => plan.targetMakespanMet && plan.targetImbalanceMet);
  const recommended =
    meetingTarget ??
    [...plans].sort(
      (left, right) =>
        left.estimatedMakespanMs - right.estimatedMakespanMs ||
        left.imbalanceMillis - right.imbalanceMillis ||
        left.groupCount - right.groupCount,
    )[0];
  const slowestSuite = [...canonicalSuites].sort(
    (left, right) => right.durationMs - left.durationMs || left.order - right.order,
  )[0];
  return {
    schemaVersion: "1.0.0",
    recordType: "playwright-ci-balanced-group-plan",
    algorithm: "deterministic-lpt-v1",
    sourceInventoryFingerprint: summary.inventoryFingerprint,
    sourceSummaryFingerprint: fingerprint("veskify-playwright-suite-summary-v1", summary),
    targetMakespanMs: TARGET_MAKESPAN_MS,
    targetImbalanceMillis: TARGET_IMBALANCE_MILLIS,
    dominantSuite: {
      id: slowestSuite.id,
      durationMs: slowestSuite.durationMs,
      exceedsTargetMakespan: slowestSuite.durationMs > TARGET_MAKESPAN_MS,
    },
    plans,
    recommendation: {
      groupCount: recommended.groupCount,
      basis: meetingTarget
        ? "smallest-plan-meeting-makespan-and-imbalance-targets"
        : "lowest-estimated-makespan-with-deterministic-ties",
      estimatedMakespanMs: recommended.estimatedMakespanMs,
      imbalanceMillis: recommended.imbalanceMillis,
      runnerCount: recommended.runnerCount,
      estimatedRunnerMinutes: recommended.estimatedRunnerMinutes,
    },
  };
}

function takeOption(argumentsList, name, fallback) {
  const indices = argumentsList
    .map((value, index) => (value === name ? index : -1))
    .filter((index) => index >= 0);
  if (indices.length > 1) fail(`Duplicate option: ${name}.`);
  if (indices.length === 0) return fallback;
  const index = indices[0];
  const value = argumentsList[index + 1];
  if (!value || value.startsWith("--")) fail(`Expected a value after ${name}.`);
  argumentsList.splice(index, 2);
  return value;
}

function assertNoArguments(argumentsList) {
  if (argumentsList.length > 0) fail(`Unexpected arguments: ${argumentsList.join(" ")}.`);
}

async function main(argv) {
  const [operation, ...rawArguments] = argv;
  const argumentsList = [...rawArguments];
  const inventoryPath = resolve(takeOption(argumentsList, "--inventory", DEFAULT_INVENTORY_PATH));
  const repositoryRoot = resolve(takeOption(argumentsList, "--repository-root", REPOSITORY_ROOT));
  if (operation === "audit-plan" || operation === "emit-matrix") {
    const planPath = resolve(
      takeOption(argumentsList, "--execution-plan", DEFAULT_EXECUTION_PLAN_PATH),
    );
    assertNoArguments(argumentsList);
    const inventory = loadSuiteInventory(inventoryPath, repositoryRoot);
    const plan = loadExecutionPlan(planPath, inventory);
    if (operation === "emit-matrix") {
      process.stdout.write(`${canonicalSerialize(emitExecutionMatrix(plan))}\n`);
      return 0;
    }
    process.stdout.write(
      `${canonicalSerialize({
        schemaVersion: "1.0.0",
        result: "PASS",
        planId: plan.planId,
        planFingerprint: plan.fingerprint,
        inventoryFingerprint: inventory.fingerprint,
        planType: plan.planType,
        groupCount: plan.groups.length,
        entryCount: plan.groups.reduce((total, group) => total + group.entries.length, 0),
        groups: plan.groups.map(({ groupId, order, sourcePredictedDurationMs, entries }) => ({
          groupId,
          order,
          sourcePredictedDurationMs,
          entryIds: entries.map(devx01fEntryId),
        })),
      })}\n`,
    );
    return 0;
  }
  if (operation === "run-group") {
    const planPath = resolve(
      takeOption(argumentsList, "--execution-plan", DEFAULT_EXECUTION_PLAN_PATH),
    );
    const groupId = takeOption(argumentsList, "--group-id");
    const outputDirectory = takeOption(argumentsList, "--output-directory");
    if (!groupId || !outputDirectory) fail("Run-group requires group ID and output directory.");
    assertNoArguments(argumentsList);
    const result = await runExecutionGroup({
      planPath,
      inventoryPath,
      repositoryRoot,
      groupId,
      outputDirectory: resolve(outputDirectory),
    });
    process.stdout.write(`Playwright group manifest: ${result.manifestPath}\n`);
    return result.exitCode;
  }
  if (operation === "validate-group-artifacts") {
    const planPath = resolve(
      takeOption(argumentsList, "--execution-plan", DEFAULT_EXECUTION_PLAN_PATH),
    );
    const evidenceDirectory = takeOption(argumentsList, "--evidence-directory");
    const blobDirectory = takeOption(argumentsList, "--blob-directory");
    const blobOutputDirectory = takeOption(argumentsList, "--blob-output-directory");
    const artifactRunId = takeOption(argumentsList, "--artifact-run-id");
    const artifactRunAttempt = takeOption(argumentsList, "--artifact-run-attempt");
    const output = takeOption(argumentsList, "--output");
    if (
      !evidenceDirectory ||
      !blobDirectory ||
      !blobOutputDirectory ||
      !artifactRunId ||
      !artifactRunAttempt ||
      !output
    ) {
      fail("Artifact validation requires evidence, blob, run identity, and output paths.");
    }
    assertNoArguments(argumentsList);
    const validation = validateMatrixArtifacts({
      planPath,
      inventoryPath,
      repositoryRoot,
      evidenceDirectory: resolve(evidenceDirectory),
      blobDirectory: resolve(blobDirectory),
      blobOutputDirectory: resolve(blobOutputDirectory),
      artifactRunId,
      artifactRunAttempt,
      output: resolve(output),
    });
    process.stdout.write(
      `${canonicalSerialize({
        result: "PASS",
        validatedGroupCount: validation.validatedGroupCount,
        validatedEntryCount: validation.validatedEntryCount,
        validatedBlobCount: validation.validatedBlobCount,
      })}\n`,
    );
    return 0;
  }
  if (operation === "summarize-matrix") {
    const validationPath = takeOption(argumentsList, "--validation");
    const output = takeOption(argumentsList, "--output");
    const mergeResult = takeOption(argumentsList, "--merge-result");
    if (!validationPath || !output || !mergeResult) {
      fail("Matrix summary requires validation, output, and merge result.");
    }
    assertNoArguments(argumentsList);
    const summary = summarizeExecutionMatrix({
      validationPath: resolve(validationPath),
      output: resolve(output),
      mergeResult,
      githubStepSummaryPath: process.env.GITHUB_STEP_SUMMARY,
    });
    process.stdout.write(
      `${canonicalSerialize({
        result: "PASS",
        groupCount: summary.groupCount,
        entryCount: summary.entryCount,
        blobCount: summary.blobCount,
      })}\n`,
    );
    return 0;
  }
  if (operation === "audit") {
    assertNoArguments(argumentsList);
    const inventory = loadSuiteInventory(inventoryPath, repositoryRoot);
    process.stdout.write(
      `${canonicalSerialize({
        schemaVersion: "1.0.0",
        result: "PASS",
        inventoryFingerprint: inventory.fingerprint,
        suiteCount: inventory.suites.length,
        suites: inventory.suites.map(({ id, order, configPath, args }) => ({
          id,
          order,
          configPath,
          args,
        })),
      })}\n`,
    );
    return 0;
  }
  if (operation === "run-all") {
    const outputDirectory = takeOption(
      argumentsList,
      "--timing-output-directory",
      process.env.PLAYWRIGHT_CI_TIMING_OUTPUT_DIRECTORY,
    );
    assertNoArguments(argumentsList);
    const result = await runAllSuites({
      inventoryPath,
      repositoryRoot,
      ...(outputDirectory ? { outputDirectory } : {}),
    });
    process.stdout.write(`Playwright suite timing evidence: ${result.outputDirectory}\n`);
    return result.exitCode;
  }
  if (operation === "summarize") {
    const inputDirectory = takeOption(argumentsList, "--input-directory");
    const output = takeOption(argumentsList, "--output");
    const jobStatus = takeOption(argumentsList, "--job-status");
    if (!inputDirectory || !output || !jobStatus)
      fail("Summarize requires input, output, and job status.");
    assertNoArguments(argumentsList);
    const { summary, markdown } = summarizeTimingDirectory({
      inventoryPath,
      repositoryRoot,
      inputDirectory,
      output,
      jobStatus,
      githubStepSummaryPath: process.env.GITHUB_STEP_SUMMARY,
    });
    if (!process.env.GITHUB_STEP_SUMMARY) process.stdout.write(markdown);
    process.stdout.write(
      `${canonicalSerialize({ result: "PASS", measuredSuiteCount: summary.measuredSuiteCount, completeness: summary.completeness })}\n`,
    );
    return 0;
  }
  if (operation === "plan") {
    const summaryPath = takeOption(argumentsList, "--summary");
    const output = takeOption(argumentsList, "--output");
    if (!summaryPath || !output) fail("Plan requires summary and output paths.");
    assertNoArguments(argumentsList);
    const summary = readJsonFile(resolve(summaryPath), "Playwright timing summary");
    const plan = buildBalancedGroupPlan(summary);
    writeJsonAtomic(resolve(output), plan);
    process.stdout.write(`${canonicalSerialize(plan.recommendation)}\n`);
    return 0;
  }
  fail(
    "Usage: playwright-ci.mjs <audit|run-all|summarize|plan|audit-plan|emit-matrix|run-group|validate-group-artifacts|summarize-matrix> [options]",
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}

export const PLAYWRIGHT_CI_AUTHORITY = Object.freeze({
  defaultInventoryPath: DEFAULT_INVENTORY_PATH,
  defaultExecutionPlanPath: DEFAULT_EXECUTION_PLAN_PATH,
  repositoryRoot: REPOSITORY_ROOT,
  groupRange: Object.freeze([GROUP_MIN, GROUP_MAX]),
  targetMakespanMs: TARGET_MAKESPAN_MS,
  targetImbalanceMillis: TARGET_IMBALANCE_MILLIS,
});

function devx01fSha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function devx01fFingerprint(prefix, value) {
  return `${prefix}_${devx01fSha256(canonicalSerialize(value))}`;
}

function devx01fPathExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function devx01fAssertRealDirectory(path, label, create = false) {
  const absolute = resolve(path);
  if (create) mkdirSync(absolute, { recursive: true, mode: 0o700 });
  if (!devx01fPathExists(absolute)) fail(`${label} does not exist.`);
  const stats = lstatSync(absolute);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    fail(`${label} must be a real directory.`);
  }
  return absolute;
}

function devx01fAssertRegularFile(path, label) {
  if (!devx01fPathExists(path)) fail(`${label} is missing.`);
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink()) fail(`${label} must be a regular file.`);
  return stats;
}

function devx01fReadJson(path, label) {
  devx01fAssertRegularFile(path, label);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`${label} must contain valid JSON.`);
  }
}

function devx01fWriteJsonAtomic(path, value, replace = false) {
  const absolute = resolve(path);
  devx01fAssertRealDirectory(dirname(absolute), "JSON output parent", true);
  if (!replace && devx01fPathExists(absolute)) fail(`Refusing to replace ${basename(absolute)}.`);
  if (devx01fPathExists(absolute)) {
    const existing = lstatSync(absolute);
    if (!existing.isFile() || existing.isSymbolicLink())
      fail("JSON output must be a regular file.");
  }
  const temporary = join(dirname(absolute), `.${basename(absolute)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${canonicalSerialize(value)}\n`, { flag: "wx", mode: 0o600 });
    renameSync(temporary, absolute);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function devx01fAssertUtc(value, label) {
  if (typeof value !== "string" || !value.endsWith("Z") || !Number.isFinite(Date.parse(value))) {
    fail(`${label} must be a bounded UTC timestamp.`);
  }
}

function devx01fAssertDuration(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DURATION_MS) {
    fail(`${label} must be a bounded duration.`);
  }
}

function devx01fAssertDirectoryEntries(path, expectedNames, label) {
  devx01fAssertRealDirectory(path, label, false);
  const actual = readdirSync(path, { withFileTypes: true })
    .map((entry) => {
      if (entry.isSymbolicLink()) fail(`${label} must not contain symbolic links.`);
      return entry.name;
    })
    .sort();
  const expected = [...expectedNames].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} does not match the declared artifact set.`);
  }
}

function loadExecutionPlan(planPath, inventory) {
  const value = devx01fReadJson(resolve(planPath), "Playwright execution plan");
  assertExactKeys(value, EXECUTION_PLAN_KEYS, "Playwright execution plan");
  if (
    value.schemaVersion !== "1.0.0" ||
    value.recordType !== "playwright-ci-execution-plan" ||
    !ID_PATTERN.test(value.planId) ||
    !new Set(["whole-suite-groups", "bounded-suite-shards"]).has(value.planType) ||
    value.enabled !== true ||
    value.required !== true ||
    value.sourceInventoryFingerprint !== inventory.fingerprint ||
    value.sourceTimingSummarySha256 !== LOCKED_SOURCE_TIMING_SHA256
  ) {
    fail("Playwright execution plan identity or source authority is invalid.");
  }
  assertExactKeys(value.sourceProvenance, EXECUTION_PROVENANCE_KEYS, "Plan provenance");
  if (
    value.sourceProvenance.runId !== LOCKED_SOURCE_RUN_ID ||
    value.sourceProvenance.commitSha !== LOCKED_SOURCE_COMMIT ||
    value.sourceProvenance.groupPlanSha256 !== LOCKED_SOURCE_GROUP_PLAN_SHA256
  ) {
    fail("Playwright execution plan provenance is invalid.");
  }
  if (
    !Array.isArray(value.groups) ||
    value.groups.length < GROUP_MIN ||
    value.groups.length > MATRIX_GROUP_MAX
  ) {
    fail("Playwright execution plan must declare one to six groups.");
  }
  const suites = new Map(inventory.suites.map((suite) => [suite.id, suite]));
  const coverage = new Map();
  const groupIds = new Set();
  let usesShards = false;
  for (const [groupIndex, group] of value.groups.entries()) {
    assertExactKeys(group, EXECUTION_GROUP_KEYS, `Execution group ${groupIndex + 1}`);
    if (
      !ID_PATTERN.test(group.groupId) ||
      groupIds.has(group.groupId) ||
      group.order !== groupIndex + 1 ||
      group.enabled !== true ||
      group.required !== true ||
      !Number.isSafeInteger(group.sourcePredictedDurationMs) ||
      group.sourcePredictedDurationMs <= 0 ||
      group.sourcePredictedDurationMs > MAX_DURATION_MS ||
      !Array.isArray(group.entries) ||
      group.entries.length === 0
    ) {
      fail("Playwright execution group authority is invalid.");
    }
    groupIds.add(group.groupId);
    const groupEntries = new Set();
    for (const entry of group.entries) {
      if (!isPlainObject(entry)) fail("Playwright execution entry must be an object.");
      const keys = Object.keys(entry).sort();
      const whole = JSON.stringify(keys) === JSON.stringify([...WHOLE_ENTRY_KEYS].sort());
      const sharded = JSON.stringify(keys) === JSON.stringify([...SHARD_ENTRY_KEYS].sort());
      if (!whole && !sharded) fail("Playwright execution entry contains undeclared fields.");
      if (!suites.has(entry.suiteId))
        fail("Playwright execution entry references an unknown suite.");
      if (groupEntries.has(`${entry.suiteId}:${entry.shardIndex ?? "whole"}`)) {
        fail("Playwright execution group contains a duplicate entry.");
      }
      groupEntries.add(`${entry.suiteId}:${entry.shardIndex ?? "whole"}`);
      const current = coverage.get(entry.suiteId);
      if (whole) {
        if (current !== undefined) fail("A suite may be represented only once in the plan.");
        coverage.set(entry.suiteId, { kind: "whole" });
        continue;
      }
      usesShards = true;
      if (
        !Number.isSafeInteger(entry.shardIndex) ||
        !Number.isSafeInteger(entry.shardTotal) ||
        entry.shardTotal < 2 ||
        entry.shardTotal > SUITE_SHARD_MAX ||
        entry.shardIndex < 1 ||
        entry.shardIndex > entry.shardTotal ||
        current?.kind === "whole" ||
        (current?.kind === "shards" && current.total !== entry.shardTotal)
      ) {
        fail("Playwright shard authority is invalid or mixed with whole-suite authority.");
      }
      const shardCoverage = current ?? {
        kind: "shards",
        total: entry.shardTotal,
        indices: new Set(),
      };
      if (shardCoverage.indices.has(entry.shardIndex)) fail("Playwright shard is duplicated.");
      shardCoverage.indices.add(entry.shardIndex);
      coverage.set(entry.suiteId, shardCoverage);
    }
  }
  if (coverage.size !== suites.size)
    fail("Execution plan does not cover the canonical inventory exactly.");
  for (const suite of inventory.suites) {
    const suiteCoverage = coverage.get(suite.id);
    if (suiteCoverage?.kind === "whole") continue;
    if (
      suiteCoverage?.kind !== "shards" ||
      suiteCoverage.indices.size !== suiteCoverage.total ||
      [...suiteCoverage.indices].some((index) => index < 1 || index > suiteCoverage.total)
    ) {
      fail("Execution plan has incomplete shard coverage.");
    }
  }
  if (
    (usesShards && value.planType !== "bounded-suite-shards") ||
    (!usesShards && value.planType !== "whole-suite-groups")
  ) {
    fail("Execution plan type does not match its entry authority.");
  }
  return Object.freeze({
    ...value,
    fingerprint: devx01fFingerprint("veskify-playwright-execution-plan-v1", value),
  });
}

function emitExecutionMatrix(plan) {
  return { include: plan.groups.map(({ groupId }) => ({ groupId })) };
}

function devx01fEntryId(entry) {
  return entry.shardIndex === undefined
    ? entry.suiteId
    : `${entry.suiteId}-shard-${entry.shardIndex}-of-${entry.shardTotal}`;
}

function devx01fExpectedEntry(entry, suite, entryOrder) {
  const entryId = devx01fEntryId(entry);
  return {
    entryId,
    entryOrder,
    suiteId: suite.id,
    suiteOrder: suite.order,
    configPath: suite.configPath,
    shardIndex: entry.shardIndex ?? null,
    shardTotal: entry.shardTotal ?? null,
    blobFilename: `${entryId}-blob.zip`,
  };
}

function devx01fKillChild(child, signal, detached) {
  try {
    if (detached && child.pid !== undefined) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function devx01fExecuteEntry({ suite, entry, blobPath, repositoryRoot }) {
  const startedAt = new Date().toISOString();
  const started = process.hrtime.bigint();
  const detached = process.platform !== "win32";
  let spawnFailed = false;
  let forwardedSignal = null;
  let forceTimer;
  const args = ["exec", "playwright", ...suite.args];
  if (entry.shardIndex !== undefined) args.push(`--shard=${entry.shardIndex}/${entry.shardTotal}`);
  args.push("--reporter=blob");
  const child = spawn("pnpm", args, {
    cwd: repositoryRoot,
    detached,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, PLAYWRIGHT_BLOB_OUTPUT_FILE: blobPath },
  });
  child.once("error", () => {
    spawnFailed = true;
  });
  const handlers = new Map();
  for (const signal of TERMINATION_SIGNALS) {
    const handler = () => {
      if (forwardedSignal !== null) return;
      forwardedSignal = signal;
      devx01fKillChild(child, signal, detached);
      forceTimer = setTimeout(() => devx01fKillChild(child, "SIGKILL", detached), 5_000);
      forceTimer.unref();
    };
    handlers.set(signal, handler);
    process.once(signal, handler);
  }
  const { code, signal } = await new Promise((complete) => {
    child.once("close", (closeCode, closeSignal) =>
      complete({ code: closeCode, signal: closeSignal }),
    );
  });
  if (forceTimer !== undefined) clearTimeout(forceTimer);
  for (const [registeredSignal, handler] of handlers)
    process.removeListener(registeredSignal, handler);
  const completedAt = new Date().toISOString();
  const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
  const effectiveSignal = signal ?? forwardedSignal;
  const exitCode =
    effectiveSignal === null
      ? spawnFailed || !Number.isInteger(code) || code < 0
        ? 127
        : code
      : null;
  const status = effectiveSignal !== null ? "signaled" : exitCode === 0 ? "success" : "failure";
  return {
    startedAt,
    completedAt,
    durationMs,
    status,
    exitCode,
    signal: effectiveSignal,
    processExitCode:
      effectiveSignal === null ? (exitCode ?? 1) : (SIGNAL_EXIT_CODES.get(effectiveSignal) ?? 1),
  };
}

function devx01fManifest({
  plan,
  inventory,
  group,
  expectedEntries,
  completedEntries,
  startedAt,
  terminalResult,
}) {
  const completedAt = new Date().toISOString();
  return {
    schemaVersion: "1.0.0",
    recordType: "playwright-ci-group-manifest",
    planId: plan.planId,
    planFingerprint: plan.fingerprint,
    inventoryFingerprint: inventory.fingerprint,
    groupId: group.groupId,
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
    expectedEntries,
    completedEntries,
    terminalResult,
  };
}

async function runExecutionGroup({
  planPath,
  inventoryPath,
  repositoryRoot,
  groupId,
  outputDirectory,
}) {
  if (!ID_PATTERN.test(groupId)) fail("Group ID is invalid.");
  const inventory = loadSuiteInventory(inventoryPath, repositoryRoot);
  const plan = loadExecutionPlan(planPath, inventory);
  const group = plan.groups.find((candidate) => candidate.groupId === groupId);
  if (!group) fail("Requested group is not declared by the execution plan.");
  const suiteById = new Map(inventory.suites.map((suite) => [suite.id, suite]));
  const root = devx01fAssertRealDirectory(resolve(outputDirectory), "Group output root", true);
  const groupDirectory = join(root, group.groupId);
  if (devx01fPathExists(groupDirectory)) fail("Group output already exists.");
  const timingDirectory = join(groupDirectory, "timings");
  const blobDirectory = join(groupDirectory, "blobs");
  devx01fAssertRealDirectory(timingDirectory, "Group timing directory", true);
  devx01fAssertRealDirectory(blobDirectory, "Group blob directory", true);
  const expectedEntries = group.entries.map((entry, index) =>
    devx01fExpectedEntry(entry, suiteById.get(entry.suiteId), index + 1),
  );
  const completedEntries = [];
  const startedAt = new Date().toISOString();
  const manifestPath = join(groupDirectory, "manifest.json");
  devx01fWriteJsonAtomic(
    manifestPath,
    devx01fManifest({
      plan,
      inventory,
      group,
      expectedEntries,
      completedEntries,
      startedAt,
      terminalResult: { status: "running", exitCode: null, signal: null },
    }),
  );
  let terminalResult = { status: "success", exitCode: 0, signal: null };
  for (const [index, entry] of group.entries.entries()) {
    const expected = expectedEntries[index];
    const suite = suiteById.get(entry.suiteId);
    const blobPath = join(blobDirectory, expected.blobFilename);
    const result = await devx01fExecuteEntry({ suite, entry, blobPath, repositoryRoot });
    const blobExists = devx01fPathExists(blobPath);
    if (result.status === "success") {
      const blobStats = devx01fAssertRegularFile(blobPath, "Playwright blob report");
      if (blobStats.size <= 0) fail("Playwright blob report must not be empty.");
    } else if (blobExists) {
      devx01fAssertRegularFile(blobPath, "Partial Playwright blob report");
    }
    const timingFilename = `${expected.entryId}.json`;
    const timingPath = join(timingDirectory, timingFilename);
    const timing = {
      schemaVersion: "1.0.0",
      recordType: "playwright-ci-group-entry-timing",
      planId: plan.planId,
      planFingerprint: plan.fingerprint,
      inventoryFingerprint: inventory.fingerprint,
      groupId: group.groupId,
      ...expected,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      status: result.status,
      exitCode: result.exitCode,
      signal: result.signal,
    };
    devx01fWriteJsonAtomic(timingPath, timing);
    completedEntries.push({
      ...expected,
      durationMs: result.durationMs,
      status: result.status,
      timingFilename,
      timingSha256: devx01fSha256(readFileSync(timingPath)),
      blobSha256: blobExists ? devx01fSha256(readFileSync(blobPath)) : null,
    });
    if (result.status !== "success") {
      terminalResult = { status: result.status, exitCode: result.exitCode, signal: result.signal };
    }
    devx01fWriteJsonAtomic(
      manifestPath,
      devx01fManifest({
        plan,
        inventory,
        group,
        expectedEntries,
        completedEntries,
        startedAt,
        terminalResult:
          result.status === "success" && completedEntries.length < expectedEntries.length
            ? { status: "running", exitCode: null, signal: null }
            : terminalResult,
      }),
      true,
    );
    if (result.status !== "success") return { exitCode: result.processExitCode, manifestPath };
  }
  return { exitCode: 0, manifestPath };
}

function devx01fValidateExpectedEntry(value, expected, label) {
  assertExactKeys(value, GROUP_EXPECTED_ENTRY_KEYS, label);
  if (canonicalSerialize(value) !== canonicalSerialize(expected))
    fail(`${label} identity drifted.`);
}

function devx01fValidateTiming(value, expected, plan, inventory, groupId) {
  assertExactKeys(value, GROUP_TIMING_KEYS, "Group entry timing");
  if (
    value.schemaVersion !== "1.0.0" ||
    value.recordType !== "playwright-ci-group-entry-timing" ||
    value.planId !== plan.planId ||
    value.planFingerprint !== plan.fingerprint ||
    value.inventoryFingerprint !== inventory.fingerprint ||
    value.groupId !== groupId ||
    value.status !== "success" ||
    value.exitCode !== 0 ||
    value.signal !== null
  ) {
    fail("Group timing terminal authority is invalid.");
  }
  for (const key of GROUP_EXPECTED_ENTRY_KEYS) {
    if (value[key] !== expected[key]) fail("Group timing entry identity drifted.");
  }
  devx01fAssertUtc(value.startedAt, "Group timing start");
  devx01fAssertUtc(value.completedAt, "Group timing completion");
  devx01fAssertDuration(value.durationMs, "Group timing duration");
}

function devx01fValidateCiSummary(value) {
  assertExactKeys(value, CI_SUMMARY_KEYS, "Browser CI timing summary");
  const expectedIds = ["install", "playwright-install", "playwright-e2e"];
  if (
    value.schemaVersion !== "1.0.0" ||
    value.recordType !== "ci-timing-summary" ||
    value.profile !== "browser" ||
    value.jobStatus !== "success" ||
    value.complete !== true ||
    value.expectedStepCount !== 3 ||
    value.completedStepCount !== 3 ||
    !Array.isArray(value.steps) ||
    value.steps.length !== 3
  ) {
    fail("Browser CI timing summary is incomplete or malformed.");
  }
  let measured = 0;
  for (const [index, step] of value.steps.entries()) {
    assertExactKeys(step, CI_TIMING_KEYS, "Browser CI timing record");
    if (
      step.schemaVersion !== "1.0.0" ||
      step.recordType !== "ci-command-timing" ||
      step.stepId !== expectedIds[index] ||
      step.status !== "success" ||
      step.exitCode !== 0 ||
      step.signal !== null
    ) {
      fail("Browser CI timing record is incomplete or out of order.");
    }
    devx01fAssertUtc(step.startedAtUtc, "Browser timing start");
    devx01fAssertUtc(step.completedAtUtc, "Browser timing completion");
    devx01fAssertDuration(step.durationMs, "Browser timing duration");
    measured += step.durationMs;
  }
  if (value.measuredTotalDurationMs !== measured) fail("Browser CI timing total is inconsistent.");
  if (!Array.isArray(value.slowestCompletedSteps) || value.slowestCompletedSteps.length > 3) {
    fail("Browser CI timing slowest-step evidence is malformed.");
  }
  for (const step of value.slowestCompletedSteps) {
    assertExactKeys(step, ["durationMs", "stepId"], "Slowest browser timing step");
    if (!expectedIds.includes(step.stepId)) fail("Slowest browser timing step is undeclared.");
    devx01fAssertDuration(step.durationMs, "Slowest browser timing duration");
  }
  return new Map(value.steps.map((step) => [step.stepId, step.durationMs]));
}

function validateMatrixArtifacts({
  planPath,
  inventoryPath,
  repositoryRoot,
  evidenceDirectory,
  blobDirectory,
  blobOutputDirectory,
  artifactRunId,
  artifactRunAttempt,
  output,
}) {
  if (!SAFE_RUN_ID_PATTERN.test(artifactRunId) || !SAFE_RUN_ID_PATTERN.test(artifactRunAttempt)) {
    fail("Artifact run identity must be bounded positive integers.");
  }
  const inventory = loadSuiteInventory(inventoryPath, repositoryRoot);
  const plan = loadExecutionPlan(planPath, inventory);
  const evidenceRoot = devx01fAssertRealDirectory(evidenceDirectory, "Group evidence root", false);
  const blobRoot = devx01fAssertRealDirectory(blobDirectory, "Group blob root", false);
  const mergedBlobRoot = resolve(blobOutputDirectory);
  if (devx01fPathExists(mergedBlobRoot)) fail("Merged blob output must be fresh.");
  devx01fAssertRealDirectory(mergedBlobRoot, "Merged blob output", true);
  const evidenceNames = plan.groups.map(
    ({ groupId }) => `playwright-group-evidence-${artifactRunId}-${artifactRunAttempt}-${groupId}`,
  );
  const blobNames = plan.groups.map(
    ({ groupId }) => `playwright-group-blobs-${artifactRunId}-${artifactRunAttempt}-${groupId}`,
  );
  devx01fAssertDirectoryEntries(evidenceRoot, evidenceNames, "Group evidence root");
  devx01fAssertDirectoryEntries(blobRoot, blobNames, "Group blob root");
  const suites = new Map(inventory.suites.map((suite) => [suite.id, suite]));
  const groups = [];
  let validatedEntryCount = 0;
  let validatedBlobCount = 0;
  for (const group of plan.groups) {
    const evidenceArtifact = join(
      evidenceRoot,
      `playwright-group-evidence-${artifactRunId}-${artifactRunAttempt}-${group.groupId}`,
    );
    const blobArtifact = join(
      blobRoot,
      `playwright-group-blobs-${artifactRunId}-${artifactRunAttempt}-${group.groupId}`,
    );
    devx01fAssertDirectoryEntries(
      evidenceArtifact,
      ["ci-browser-summary.json", "manifest.json", "timings"],
      `${group.groupId} evidence artifact`,
    );
    const expectedEntries = group.entries.map((entry, index) =>
      devx01fExpectedEntry(entry, suites.get(entry.suiteId), index + 1),
    );
    const manifest = devx01fReadJson(join(evidenceArtifact, "manifest.json"), "Group manifest");
    assertExactKeys(manifest, GROUP_MANIFEST_KEYS, "Group manifest");
    assertExactKeys(manifest.terminalResult, GROUP_TERMINAL_KEYS, "Group terminal result");
    if (
      manifest.schemaVersion !== "1.0.0" ||
      manifest.recordType !== "playwright-ci-group-manifest" ||
      manifest.planId !== plan.planId ||
      manifest.planFingerprint !== plan.fingerprint ||
      manifest.inventoryFingerprint !== inventory.fingerprint ||
      manifest.groupId !== group.groupId ||
      manifest.terminalResult.status !== "success" ||
      manifest.terminalResult.exitCode !== 0 ||
      manifest.terminalResult.signal !== null ||
      !Array.isArray(manifest.expectedEntries) ||
      !Array.isArray(manifest.completedEntries) ||
      manifest.expectedEntries.length !== expectedEntries.length ||
      manifest.completedEntries.length !== expectedEntries.length
    ) {
      fail("Group manifest is incomplete, failed, or bound to the wrong authority.");
    }
    devx01fAssertUtc(manifest.startedAt, "Group manifest start");
    devx01fAssertUtc(manifest.completedAt, "Group manifest completion");
    devx01fAssertDuration(manifest.durationMs, "Group manifest duration");
    const timingNames = expectedEntries.map((entry) => `${entry.entryId}.json`);
    const expectedBlobNames = expectedEntries.map((entry) => entry.blobFilename);
    devx01fAssertDirectoryEntries(join(evidenceArtifact, "timings"), timingNames, "Group timings");
    devx01fAssertDirectoryEntries(blobArtifact, expectedBlobNames, "Group blobs");
    let playwrightDurationMs = 0;
    for (const [index, expected] of expectedEntries.entries()) {
      devx01fValidateExpectedEntry(
        manifest.expectedEntries[index],
        expected,
        "Manifest expected entry",
      );
      const completed = manifest.completedEntries[index];
      assertExactKeys(completed, GROUP_COMPLETED_ENTRY_KEYS, "Manifest completed entry");
      for (const key of GROUP_EXPECTED_ENTRY_KEYS) {
        if (completed[key] !== expected[key]) fail("Manifest completed entry identity drifted.");
      }
      if (
        completed.status !== "success" ||
        completed.timingFilename !== `${expected.entryId}.json` ||
        !SHA256_PATTERN.test(completed.timingSha256) ||
        !SHA256_PATTERN.test(completed.blobSha256)
      ) {
        fail("Manifest completed entry is not successful and hash-bound.");
      }
      devx01fAssertDuration(completed.durationMs, "Completed entry duration");
      const timingPath = join(evidenceArtifact, "timings", completed.timingFilename);
      if (devx01fSha256(readFileSync(timingPath)) !== completed.timingSha256) {
        fail("Group timing hash does not match the manifest.");
      }
      const timing = devx01fReadJson(timingPath, "Group timing");
      devx01fValidateTiming(timing, expected, plan, inventory, group.groupId);
      if (timing.durationMs !== completed.durationMs) fail("Group timing duration drifted.");
      const sourceBlob = join(blobArtifact, expected.blobFilename);
      const blobStats = devx01fAssertRegularFile(sourceBlob, "Downloaded Playwright blob");
      if (blobStats.size <= 0 || devx01fSha256(readFileSync(sourceBlob)) !== completed.blobSha256) {
        fail("Downloaded Playwright blob is empty or hash-mismatched.");
      }
      const targetBlob = join(mergedBlobRoot, expected.blobFilename);
      writeFileSync(targetBlob, readFileSync(sourceBlob), { flag: "wx", mode: 0o600 });
      playwrightDurationMs += completed.durationMs;
      validatedEntryCount += 1;
      validatedBlobCount += 1;
    }
    const ciSummary = devx01fReadJson(
      join(evidenceArtifact, "ci-browser-summary.json"),
      "Browser CI timing summary",
    );
    const ciDurations = devx01fValidateCiSummary(ciSummary);
    groups.push({
      groupId: group.groupId,
      order: group.order,
      sourcePredictedDurationMs: group.sourcePredictedDurationMs,
      entryCount: expectedEntries.length,
      blobCount: expectedEntries.length,
      playwrightDurationMs,
      installDurationMs: ciDurations.get("install"),
      chromiumInstallDurationMs: ciDurations.get("playwright-install"),
      groupCommandDurationMs: ciDurations.get("playwright-e2e"),
      browserRunnerDurationMs: ciSummary.measuredTotalDurationMs,
    });
  }
  const validation = {
    schemaVersion: "1.0.0",
    recordType: "playwright-ci-matrix-artifact-validation",
    planId: plan.planId,
    planFingerprint: plan.fingerprint,
    inventoryFingerprint: inventory.fingerprint,
    artifactRunId,
    artifactRunAttempt,
    expectedGroupCount: plan.groups.length,
    validatedGroupCount: groups.length,
    expectedEntryCount: plan.groups.reduce((total, group) => total + group.entries.length, 0),
    validatedEntryCount,
    expectedBlobCount: plan.groups.reduce((total, group) => total + group.entries.length, 0),
    validatedBlobCount,
    groups,
  };
  devx01fWriteJsonAtomic(output, validation);
  return validation;
}

function summarizeExecutionMatrix({ validationPath, output, mergeResult, githubStepSummaryPath }) {
  if (mergeResult !== "success") fail("Merged Playwright report did not complete successfully.");
  const validation = devx01fReadJson(resolve(validationPath), "Matrix artifact validation");
  if (
    !isPlainObject(validation) ||
    validation.schemaVersion !== "1.0.0" ||
    validation.recordType !== "playwright-ci-matrix-artifact-validation" ||
    !Array.isArray(validation.groups) ||
    validation.groups.length !== validation.validatedGroupCount ||
    validation.validatedGroupCount !== validation.expectedGroupCount ||
    validation.validatedEntryCount !== validation.expectedEntryCount ||
    validation.validatedBlobCount !== validation.expectedBlobCount
  ) {
    fail("Matrix artifact validation is incomplete.");
  }
  const orderedGroups = [...validation.groups].sort((left, right) => left.order - right.order);
  const slowest = [...orderedGroups].sort(
    (left, right) =>
      right.browserRunnerDurationMs - left.browserRunnerDurationMs ||
      (left.groupId < right.groupId ? -1 : 1),
  )[0];
  const fastest = [...orderedGroups].sort(
    (left, right) =>
      left.browserRunnerDurationMs - right.browserRunnerDurationMs ||
      (left.groupId < right.groupId ? -1 : 1),
  )[0];
  const sum = (field) => orderedGroups.reduce((total, group) => total + group[field], 0);
  const summary = {
    schemaVersion: "1.0.0",
    recordType: "playwright-ci-matrix-timing-summary",
    planId: validation.planId,
    planFingerprint: validation.planFingerprint,
    inventoryFingerprint: validation.inventoryFingerprint,
    matrixResult: "success",
    mergedReportResult: mergeResult,
    groupCount: orderedGroups.length,
    entryCount: validation.validatedEntryCount,
    blobCount: validation.validatedBlobCount,
    approximateWallDurationMs: Math.max(
      ...orderedGroups.map((group) => group.browserRunnerDurationMs),
    ),
    summedPlaywrightDurationMs: sum("playwrightDurationMs"),
    summedBrowserRunnerDurationMs: sum("browserRunnerDurationMs"),
    repeatedInstallDurationMs: sum("installDurationMs"),
    repeatedChromiumInstallDurationMs: sum("chromiumInstallDurationMs"),
    slowestGroup: { groupId: slowest.groupId, durationMs: slowest.browserRunnerDurationMs },
    fastestGroup: { groupId: fastest.groupId, durationMs: fastest.browserRunnerDurationMs },
    groups: orderedGroups,
  };
  devx01fWriteJsonAtomic(output, summary);
  const markdownRows = orderedGroups
    .map(
      (group) =>
        `| \`${group.groupId}\` | ${group.entryCount} | ${(group.playwrightDurationMs / 1000).toFixed(3)} s | ${(group.browserRunnerDurationMs / 1000).toFixed(3)} s |`,
    )
    .join("\n");
  const markdown = `## Playwright matrix timings\n\n| Group | Entries | Playwright | Runner total |\n| --- | ---: | ---: | ---: |\n${markdownRows}\n\nApproximate matrix wall time: **${(summary.approximateWallDurationMs / 1000).toFixed(3)} s**\n\n`;
  if (githubStepSummaryPath) {
    if (devx01fPathExists(githubStepSummaryPath)) {
      const stats = lstatSync(githubStepSummaryPath);
      if (!stats.isFile() || stats.isSymbolicLink())
        fail("GitHub Step Summary must be a regular file.");
    }
    appendFileSync(githubStepSummaryPath, markdown, { mode: 0o600 });
  } else {
    process.stdout.write(markdown);
  }
  return summary;
}

export {
  emitExecutionMatrix,
  loadExecutionPlan,
  runExecutionGroup,
  summarizeExecutionMatrix,
  validateMatrixArtifacts,
};
