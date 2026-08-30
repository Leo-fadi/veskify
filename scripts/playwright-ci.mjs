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
  fail("Usage: playwright-ci.mjs <audit|run-all|summarize|plan> [options]");
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
  repositoryRoot: REPOSITORY_ROOT,
  groupRange: Object.freeze([GROUP_MIN, GROUP_MAX]),
  targetMakespanMs: TARGET_MAKESPAN_MS,
  targetImbalanceMillis: TARGET_IMBALANCE_MILLIS,
});
