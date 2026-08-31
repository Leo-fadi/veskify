#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const planPath = path.join(repositoryRoot, "scripts/vitest-ci-plan.v1.json");
const expectedPlanSha256 = "3596d98d0c9f15ae69eb1551e9d1eda9c4c0ba5a42cf25864b0bb2273e0268dd";
const expectedPlanFingerprint =
  "veskify-vitest-shard-plan-v1_e35b0a4c53efdb21a6aed011fb807343b744fc7b1bc5b2fd5d8e73fcbeaab99a";
const expectedSourceFingerprint =
  "veskify-vitest-source-authority-v1_914eeaf617ecf6e67089ce75b627dfe8c4047bc5572726a52b0b6293ecaa136d";
const maxJsonBytes = 64 * 1024 * 1024;
const safeIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const testFilePattern = /^tests\/(?:unit|integration)\/.+\.(?:test|spec)\.(?:ts|tsx)$/u;

const fail = (message) => {
  throw new Error(message);
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sha1 = (value) => createHash("sha1").update(value).digest("hex");
const hashJson = (value) => sha256(JSON.stringify(value));
const compareCodeUnits = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const readJson = (filePath, label) => {
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxJsonBytes) {
    fail(`${label} must be a bounded regular JSON file.`);
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    fail(`${label} contains malformed JSON.`);
  }
};

const assertWithin = (root, candidate, label) => {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    fail(`${label} must remain below ${root}.`);
  }
};

const assertNoSymlinkAncestors = (root, candidate, createParents) => {
  assertWithin(root, candidate, "Path");
  const parent = path.dirname(candidate);
  const relative = path.relative(root, parent);
  let cursor = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) {
      if (!createParents) fail(`Missing path component: ${segment}.`);
      mkdirSync(cursor);
    }
    const stat = lstatSync(cursor);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail("Evidence paths may not traverse symbolic links or non-directories.");
    }
  }
};

const resolveCliPath = (raw, label, { output = false } = {}) => {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    raw.length > 240 ||
    path.isAbsolute(raw) ||
    raw.includes("\0") ||
    raw.split(/[\\/]/u).includes("..")
  ) {
    fail(`${label} must be a bounded relative path without traversal.`);
  }
  const resolved = path.resolve(process.cwd(), raw);
  assertNoSymlinkAncestors(process.cwd(), resolved, output);
  if (!output && (!existsSync(resolved) || lstatSync(resolved).isSymbolicLink())) {
    fail(`${label} must exist and may not be a symbolic link.`);
  }
  return resolved;
};

let atomicCounter = 0;
const writeJsonAtomic = (filePath, value) => {
  if (existsSync(filePath)) fail(`Refusing to replace existing evidence: ${filePath}.`);
  assertNoSymlinkAncestors(process.cwd(), filePath, true);
  const temporary = `${filePath}.${process.pid}.${atomicCounter++}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(temporary, filePath);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
};

const calculateShardRange = (totalFiles, index, total) => {
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || index < 1 || index > total) {
    fail("Shard index must be within its positive total.");
  }
  const base = Math.floor(totalFiles / total);
  const remainder = totalFiles % total;
  const start = base * (index - 1) + Math.min(index - 1, remainder);
  return { start, size: base + (index <= remainder ? 1 : 0) };
};

export const deriveOfficialShards = (files, total) => {
  if (!Array.isArray(files) || files.length === 0 || new Set(files).size !== files.length) {
    fail("Shard derivation requires a nonempty unique file inventory.");
  }
  const ordered = files
    .map((file) => ({ file, hash: sha1(`/${file}`) }))
    .sort(
      (left, right) =>
        compareCodeUnits(left.hash, right.hash) || compareCodeUnits(left.file, right.file),
    );
  return Array.from({ length: total }, (_, offset) => {
    const index = offset + 1;
    const { start, size } = calculateShardRange(ordered.length, index, total);
    return ordered.slice(start, start + size).map(({ file }) => file);
  });
};

const validateSelectedShard = (value, index, total) => {
  if (!isObject(value)) fail("Each selected shard must be an object.");
  const shardId = `shard-${String(index).padStart(2, "0")}-of-${String(total).padStart(2, "0")}`;
  if (
    value.shardId !== shardId ||
    value.index !== index ||
    value.total !== total ||
    !Array.isArray(value.files) ||
    value.files.length === 0 ||
    value.fileCount !== value.files.length ||
    value.fileInventorySha256 !== hashJson(value.files)
  ) {
    fail(`Selected shard ${shardId} is malformed or has drifted.`);
  }
  for (const file of value.files) {
    if (typeof file !== "string" || !testFilePattern.test(file)) {
      fail(`Selected shard ${shardId} contains an invalid test path.`);
    }
  }
  return { shardId, index, total, files: [...value.files] };
};

export const readLockedPlan = () => {
  const raw = readFileSync(planPath);
  if (sha256(raw) !== expectedPlanSha256)
    fail("The versioned Vitest plan source hash has drifted.");
  const value = JSON.parse(raw.toString("utf8"));
  if (
    !isObject(value) ||
    value.schemaVersion !== "1.0.0" ||
    value.recordType !== "devx-01f2-approved-vitest-shard-plan" ||
    value.planFingerprint !== expectedPlanFingerprint ||
    value.sourceAuthorityFingerprint !== expectedSourceFingerprint ||
    value.selectedShardCount !== 3 ||
    value.selectedMatrixRowCount !== 3 ||
    value.maxWorkersPerShard !== 1 ||
    value.fileParallelism !== false ||
    value.retries !== 0 ||
    !Array.isArray(value.selectedShards) ||
    value.selectedShards.length !== 3
  ) {
    fail("The versioned Vitest plan is malformed or has drifted.");
  }
  const shards = value.selectedShards.map((shard, offset) =>
    validateSelectedShard(shard, offset + 1, value.selectedShardCount),
  );
  const files = shards.flatMap(({ files: shardFiles }) => shardFiles);
  if (
    files.length !== 243 ||
    new Set(files).size !== files.length ||
    value.sourceFileInventorySha256 !== hashJson([...files].sort(compareCodeUnits))
  ) {
    fail("The locked source inventory must contain exactly 243 unique files.");
  }
  const official = deriveOfficialShards(files, value.selectedShardCount);
  for (const [offset, shard] of shards.entries()) {
    if (JSON.stringify(shard.files) !== JSON.stringify(official[offset])) {
      fail(`${shard.shardId} no longer matches official Vitest sequencer authority.`);
    }
  }
  if (
    !isObject(value.candidateResults) ||
    value.candidateResults["2"]?.projectedCriticalPathAtMost35Minutes !== false ||
    value.candidateResults["3"]?.projectedCriticalPathAtMost35Minutes !== true ||
    value.candidateResults["4"]?.projectedCriticalPathAtMost35Minutes !== true
  ) {
    fail("The bounded 2/3/4-shard candidate decision has drifted.");
  }
  return { value, shards, files };
};

const normalizeDiscoveredFile = (raw) => {
  if (!isObject(raw) || typeof raw.file !== "string")
    fail("Discovery entries require a file path.");
  const absolute = path.isAbsolute(raw.file)
    ? path.resolve(raw.file)
    : path.resolve(repositoryRoot, raw.file);
  assertWithin(repositoryRoot, absolute, "Discovered test file");
  if (
    !existsSync(absolute) ||
    lstatSync(absolute).isSymbolicLink() ||
    !lstatSync(absolute).isFile()
  ) {
    fail("Discovered test files must be regular repository files.");
  }
  if (realpathSync(absolute) !== absolute)
    fail("Discovered test files may not traverse symbolic links.");
  const relative = path.relative(repositoryRoot, absolute).split(path.sep).join("/");
  if (!testFilePattern.test(relative)) fail(`Unexpected discovered test path: ${relative}.`);
  return relative;
};

const auditFingerprint = (audit) => `veskify-vitest-discovery-audit-v1_${hashJson(audit)}`;

export const auditPlan = ({ discoveryPath, outputPath } = {}) => {
  const plan = readLockedPlan();
  for (const file of plan.files) {
    const absolute = path.join(repositoryRoot, file);
    if (
      !existsSync(absolute) ||
      !lstatSync(absolute).isFile() ||
      lstatSync(absolute).isSymbolicLink()
    ) {
      fail(`Locked source file is unavailable: ${file}.`);
    }
  }
  let discoveredFiles = [...plan.files];
  let discoveryAuthority = "locked-source-inventory";
  if (discoveryPath !== undefined) {
    const discovery = readJson(discoveryPath, "Vitest discovery");
    if (!Array.isArray(discovery) || discovery.length === 0)
      fail("Vitest discovery must be nonempty.");
    discoveredFiles = discovery.map(normalizeDiscoveredFile);
    discoveryAuthority = "vitest-list-files-only-json";
  }
  if (new Set(discoveredFiles).size !== discoveredFiles.length) {
    fail("Vitest discovery contains a duplicate test file.");
  }
  const discoveredSet = new Set(discoveredFiles);
  const missingSourceFiles = plan.files.filter((file) => !discoveredSet.has(file));
  if (missingSourceFiles.length > 0) {
    fail(`Vitest discovery omitted locked source file: ${missingSourceFiles[0]}.`);
  }
  const sortedFiles = [...discoveredFiles].sort(compareCodeUnits);
  const currentShards = deriveOfficialShards(sortedFiles, plan.value.selectedShardCount);
  const shardRecords = currentShards.map((files, offset) => ({
    shardId: plan.shards[offset].shardId,
    index: offset + 1,
    total: plan.value.selectedShardCount,
    fileCount: files.length,
    fileInventorySha256: hashJson(files),
    files,
  }));
  const union = shardRecords.flatMap(({ files }) => files);
  if (
    shardRecords.some(({ fileCount }) => fileCount === 0) ||
    union.length !== sortedFiles.length ||
    new Set(union).size !== sortedFiles.length ||
    hashJson([...union].sort(compareCodeUnits)) !== hashJson(sortedFiles)
  ) {
    fail("Official Vitest shard coverage is incomplete or overlapping.");
  }
  const body = {
    schemaVersion: "1.0.0",
    recordType: "devx-01f2-vitest-discovery-audit",
    status: "PASS",
    planId: plan.value.planId,
    planFingerprint: plan.value.planFingerprint,
    sourceAuthorityFingerprint: plan.value.sourceAuthorityFingerprint,
    discoveryAuthority,
    sourceFileCount: plan.files.length,
    discoveredFileCount: sortedFiles.length,
    implementationAddedFileCount: sortedFiles.length - plan.files.length,
    discoveredFileInventorySha256: hashJson(sortedFiles),
    discoveredFiles: sortedFiles,
    shards: shardRecords,
  };
  const audit = { ...body, discoveryAuditFingerprint: auditFingerprint(body) };
  if (outputPath !== undefined) writeJsonAtomic(outputPath, audit);
  return audit;
};

const validateDiscoveryAudit = (value) => {
  if (!isObject(value) || typeof value.discoveryAuditFingerprint !== "string") {
    fail("Discovery audit is malformed.");
  }
  const { discoveryAuditFingerprint, ...body } = value;
  if (
    body.schemaVersion !== "1.0.0" ||
    body.recordType !== "devx-01f2-vitest-discovery-audit" ||
    body.status !== "PASS" ||
    body.planFingerprint !== expectedPlanFingerprint ||
    discoveryAuditFingerprint !== auditFingerprint(body) ||
    !Array.isArray(body.discoveredFiles) ||
    !Array.isArray(body.shards)
  ) {
    fail("Discovery audit identity is invalid.");
  }
  if (
    body.discoveredFiles.length !== body.discoveredFileCount ||
    new Set(body.discoveredFiles).size !== body.discoveredFiles.length ||
    body.discoveredFileInventorySha256 !== hashJson(body.discoveredFiles)
  ) {
    fail("Discovery audit inventory is invalid.");
  }
  const union = [];
  for (const [offset, shard] of body.shards.entries()) {
    if (
      !isObject(shard) ||
      shard.shardId !== `shard-${String(offset + 1).padStart(2, "0")}-of-03` ||
      shard.index !== offset + 1 ||
      shard.total !== 3 ||
      !Array.isArray(shard.files) ||
      shard.fileCount !== shard.files.length ||
      shard.fileInventorySha256 !== hashJson(shard.files)
    ) {
      fail("Discovery audit shard is invalid.");
    }
    union.push(...shard.files);
  }
  if (
    union.length !== body.discoveredFiles.length ||
    new Set(union).size !== union.length ||
    hashJson([...union].sort(compareCodeUnits)) !== body.discoveredFileInventorySha256
  ) {
    fail("Discovery audit shard union is invalid.");
  }
  return value;
};

export const emitMatrix = () => {
  const { shards } = readLockedPlan();
  return {
    include: shards.map(({ shardId, index, total }) => ({
      shardId,
      shardIndex: index,
      shardTotal: total,
    })),
  };
};

const readTimingSummary = (filePath, expectedStatus) => {
  const value = readJson(filePath, "Vitest timing summary");
  if (
    !isObject(value) ||
    value.schemaVersion !== "1.0.0" ||
    value.recordType !== "ci-timing-summary" ||
    value.profile !== "vitest" ||
    value.jobStatus !== expectedStatus ||
    !Array.isArray(value.steps) ||
    !Number.isSafeInteger(value.measuredTotalDurationMs) ||
    value.measuredTotalDurationMs < 0 ||
    (expectedStatus === "success" && value.complete !== true)
  ) {
    fail("Vitest timing summary does not match the shard result.");
  }
  return value;
};

const fileEvidence = (filePath) => {
  if (!existsSync(filePath)) return null;
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > maxJsonBytes) {
    fail("Blob evidence must be a bounded regular file.");
  }
  return {
    fileName: path.basename(filePath),
    sizeBytes: stat.size,
    sha256: sha256(readFileSync(filePath)),
  };
};

const manifestFingerprint = (manifest) => `veskify-vitest-shard-manifest-v1_${hashJson(manifest)}`;

export const writeShardManifest = ({
  shardId,
  discoveryAuditPath,
  timingSummaryPath,
  blobPath,
  jobStatus,
  artifactRunId,
  artifactRunAttempt,
  outputPath,
}) => {
  if (!safeIdPattern.test(shardId) || !new Set(["success", "failure"]).has(jobStatus)) {
    fail("Shard identity or job status is invalid.");
  }
  if (!/^\d+$/u.test(artifactRunId) || !/^\d+$/u.test(artifactRunAttempt)) {
    fail("Artifact run identity must be numeric.");
  }
  const audit = validateDiscoveryAudit(readJson(discoveryAuditPath, "Discovery audit"));
  const shard = audit.shards.find((entry) => entry.shardId === shardId);
  if (shard === undefined) fail(`Unknown shard: ${shardId}.`);
  const timing = readTimingSummary(timingSummaryPath, jobStatus);
  const blob = fileEvidence(blobPath);
  if (jobStatus === "success" && blob === null)
    fail("A successful shard requires one blob report.");
  const body = {
    schemaVersion: "1.0.0",
    recordType: "devx-01f2-vitest-shard-manifest",
    shardId,
    shardIndex: shard.index,
    shardTotal: shard.total,
    planFingerprint: audit.planFingerprint,
    discoveryAuditFingerprint: audit.discoveryAuditFingerprint,
    expectedFileCount: shard.fileCount,
    expectedFileInventorySha256: shard.fileInventorySha256,
    jobStatus,
    artifactRunId,
    artifactRunAttempt,
    timingSummarySha256: sha256(readFileSync(timingSummaryPath)),
    measuredTotalDurationMs: timing.measuredTotalDurationMs,
    blob,
  };
  const manifest = { ...body, manifestFingerprint: manifestFingerprint(body) };
  writeJsonAtomic(outputPath, manifest);
  return manifest;
};

const collectNamedFiles = (root, basename, depth = 0) => {
  if (depth > 4) fail("Artifact directory nesting is too deep.");
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    fail("Artifact roots must be plain directories.");
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isSymbolicLink()) fail("Artifact directories may not contain symbolic links.");
    if (entry.isDirectory()) found.push(...collectNamedFiles(candidate, basename, depth + 1));
    else if (entry.isFile() && (basename === null || entry.name === basename))
      found.push(candidate);
  }
  return found.sort(compareCodeUnits);
};

const validateManifest = (value, audit, runId, runAttempt) => {
  if (!isObject(value) || typeof value.manifestFingerprint !== "string")
    fail("Shard manifest is malformed.");
  const { manifestFingerprint: fingerprint, ...body } = value;
  const shard = audit.shards.find((entry) => entry.shardId === body.shardId);
  if (
    body.schemaVersion !== "1.0.0" ||
    body.recordType !== "devx-01f2-vitest-shard-manifest" ||
    shard === undefined ||
    body.shardIndex !== shard.index ||
    body.shardTotal !== shard.total ||
    body.planFingerprint !== audit.planFingerprint ||
    body.discoveryAuditFingerprint !== audit.discoveryAuditFingerprint ||
    body.expectedFileCount !== shard.fileCount ||
    body.expectedFileInventorySha256 !== shard.fileInventorySha256 ||
    body.jobStatus !== "success" ||
    body.artifactRunId !== runId ||
    body.artifactRunAttempt !== runAttempt ||
    !isObject(body.blob) ||
    fingerprint !== manifestFingerprint(body)
  ) {
    fail("Shard manifest identity, result or coverage is invalid.");
  }
  return value;
};

const validationFingerprint = (value) => `veskify-vitest-matrix-validation-v1_${hashJson(value)}`;

export const validateShardArtifacts = ({
  evidenceDirectory,
  blobDirectory,
  discoveryAuditPath,
  blobOutputDirectory,
  artifactRunId,
  artifactRunAttempt,
  outputPath,
}) => {
  const audit = validateDiscoveryAudit(readJson(discoveryAuditPath, "Discovery audit"));
  const manifestPaths = collectNamedFiles(evidenceDirectory, "manifest.json");
  if (manifestPaths.length !== audit.shards.length)
    fail("Matrix evidence must contain one manifest per shard.");
  const manifests = manifestPaths.map((entry) =>
    validateManifest(readJson(entry, "Shard manifest"), audit, artifactRunId, artifactRunAttempt),
  );
  if (new Set(manifests.map(({ shardId }) => shardId)).size !== audit.shards.length) {
    fail("Matrix evidence contains duplicate or missing shard manifests.");
  }
  const blobPaths = collectNamedFiles(blobDirectory, null).filter((entry) =>
    entry.endsWith(".json"),
  );
  if (blobPaths.length !== audit.shards.length)
    fail("Matrix evidence must contain one blob per shard.");
  if (existsSync(blobOutputDirectory)) fail("Merged blob output directory must not already exist.");
  assertNoSymlinkAncestors(process.cwd(), blobOutputDirectory, true);
  mkdirSync(blobOutputDirectory);
  const shards = manifests
    .sort((left, right) => left.shardIndex - right.shardIndex)
    .map((manifest) => {
      const matching = blobPaths.filter((entry) => path.basename(entry) === manifest.blob.fileName);
      if (matching.length !== 1) fail(`Missing or duplicate blob for ${manifest.shardId}.`);
      const blob = fileEvidence(matching[0]);
      if (blob.sha256 !== manifest.blob.sha256 || blob.sizeBytes !== manifest.blob.sizeBytes) {
        fail(`Blob identity mismatch for ${manifest.shardId}.`);
      }
      copyFileSync(matching[0], path.join(blobOutputDirectory, `${manifest.shardId}.json`));
      return {
        shardId: manifest.shardId,
        expectedFileCount: manifest.expectedFileCount,
        measuredTotalDurationMs: manifest.measuredTotalDurationMs,
        manifestSha256: sha256(
          readFileSync(
            manifestPaths.find(
              (entry) => readJson(entry, "Shard manifest").shardId === manifest.shardId,
            ),
          ),
        ),
        blobSha256: blob.sha256,
      };
    });
  const body = {
    schemaVersion: "1.0.0",
    recordType: "devx-01f2-vitest-matrix-validation",
    status: "PASS",
    planFingerprint: audit.planFingerprint,
    discoveryAuditFingerprint: audit.discoveryAuditFingerprint,
    artifactRunId,
    artifactRunAttempt,
    shardCount: shards.length,
    discoveredFileCount: audit.discoveredFileCount,
    shards,
  };
  const result = { ...body, matrixValidationFingerprint: validationFingerprint(body) };
  writeJsonAtomic(outputPath, result);
  return result;
};

const normalizeMergedFile = (raw) => {
  if (typeof raw !== "string") fail("Merged Vitest test identities must be strings.");
  const absolute = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(repositoryRoot, raw);
  assertWithin(repositoryRoot, absolute, "Merged Vitest test file");
  const relative = path.relative(repositoryRoot, absolute).split(path.sep).join("/");
  if (!testFilePattern.test(relative)) fail(`Unexpected merged Vitest test path: ${relative}.`);
  return relative;
};

const mergedFingerprint = (value) => `veskify-vitest-merged-result-v1_${hashJson(value)}`;

export const validateMergedReport = ({
  mergedResultPath,
  discoveryAuditPath,
  artifactValidationPath,
  outputPath,
}) => {
  const audit = validateDiscoveryAudit(readJson(discoveryAuditPath, "Discovery audit"));
  const artifactValidation = readJson(artifactValidationPath, "Matrix artifact validation");
  if (
    !isObject(artifactValidation) ||
    typeof artifactValidation.matrixValidationFingerprint !== "string"
  ) {
    fail("Matrix artifact validation is malformed.");
  }
  const { matrixValidationFingerprint, ...validationBody } = artifactValidation;
  if (
    validationBody.status !== "PASS" ||
    validationBody.discoveryAuditFingerprint !== audit.discoveryAuditFingerprint ||
    matrixValidationFingerprint !== validationFingerprint(validationBody)
  ) {
    fail("Matrix artifact validation identity is invalid.");
  }
  const merged = readJson(mergedResultPath, "Merged Vitest result");
  if (!isObject(merged) || merged.success !== true || !Array.isArray(merged.testResults)) {
    fail("Merged Vitest result must be a successful machine-readable report.");
  }
  const files = merged.testResults.map((entry) => {
    if (!isObject(entry) || entry.status !== "passed")
      fail("Merged Vitest result contains a failed suite.");
    return normalizeMergedFile(entry.name);
  });
  const sortedFiles = [...files].sort(compareCodeUnits);
  if (
    new Set(files).size !== files.length ||
    JSON.stringify(sortedFiles) !== JSON.stringify(audit.discoveredFiles)
  ) {
    fail("Merged Vitest result does not exactly cover current discovery.");
  }
  const boundedCount = (key) => {
    const value = merged[key];
    if (!Number.isSafeInteger(value) || value < 0) fail(`Merged Vitest result has invalid ${key}.`);
    return value;
  };
  const body = {
    schemaVersion: "1.0.0",
    recordType: "devx-01f2-validated-vitest-merged-result",
    status: "PASS",
    planFingerprint: audit.planFingerprint,
    discoveryAuditFingerprint: audit.discoveryAuditFingerprint,
    matrixValidationFingerprint,
    testFileCount: files.length,
    testFileInventorySha256: hashJson(sortedFiles),
    numTotalTestSuites: boundedCount("numTotalTestSuites"),
    numPassedTestSuites: boundedCount("numPassedTestSuites"),
    numFailedTestSuites: boundedCount("numFailedTestSuites"),
    numTotalTests: boundedCount("numTotalTests"),
    numPassedTests: boundedCount("numPassedTests"),
    numFailedTests: boundedCount("numFailedTests"),
    numPendingTests: boundedCount("numPendingTests"),
  };
  const result = { ...body, mergedResultFingerprint: mergedFingerprint(body) };
  writeJsonAtomic(outputPath, result);
  return result;
};

const parseOptions = (args, required, optional = []) => {
  const allowed = new Set([...required, ...optional]);
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!allowed.has(key) || value === undefined || options.has(key))
      fail(`Invalid option: ${key ?? "<missing>"}.`);
    options.set(key, value);
  }
  for (const key of required) if (!options.has(key)) fail(`Missing required option: ${key}.`);
  return options;
};

const runCli = () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === "audit-plan") {
    const options = parseOptions(args, [], ["--discovery", "--output"]);
    const audit = auditPlan({
      discoveryPath: options.has("--discovery")
        ? resolveCliPath(options.get("--discovery"), "Discovery")
        : undefined,
      outputPath: options.has("--output")
        ? resolveCliPath(options.get("--output"), "Audit output", { output: true })
        : undefined,
    });
    if (!options.has("--output")) process.stdout.write(`${JSON.stringify(audit)}\n`);
    return;
  }
  if (command === "emit-matrix") {
    if (args.length > 0) fail("emit-matrix accepts no options.");
    process.stdout.write(`${JSON.stringify(emitMatrix())}\n`);
    return;
  }
  if (command === "write-shard-manifest") {
    const options = parseOptions(args, [
      "--shard-id",
      "--discovery-audit",
      "--timing-summary",
      "--blob",
      "--job-status",
      "--artifact-run-id",
      "--artifact-run-attempt",
      "--output",
    ]);
    writeShardManifest({
      shardId: options.get("--shard-id"),
      discoveryAuditPath: resolveCliPath(options.get("--discovery-audit"), "Discovery audit"),
      timingSummaryPath: resolveCliPath(options.get("--timing-summary"), "Timing summary"),
      blobPath: resolveCliPath(options.get("--blob"), "Blob", {
        output: options.get("--job-status") !== "success",
      }),
      jobStatus: options.get("--job-status"),
      artifactRunId: options.get("--artifact-run-id"),
      artifactRunAttempt: options.get("--artifact-run-attempt"),
      outputPath: resolveCliPath(options.get("--output"), "Manifest output", { output: true }),
    });
    return;
  }
  if (command === "validate-shard-artifacts") {
    const options = parseOptions(args, [
      "--evidence-directory",
      "--blob-directory",
      "--discovery-audit",
      "--blob-output-directory",
      "--artifact-run-id",
      "--artifact-run-attempt",
      "--output",
    ]);
    validateShardArtifacts({
      evidenceDirectory: resolveCliPath(options.get("--evidence-directory"), "Evidence directory"),
      blobDirectory: resolveCliPath(options.get("--blob-directory"), "Blob directory"),
      discoveryAuditPath: resolveCliPath(options.get("--discovery-audit"), "Discovery audit"),
      blobOutputDirectory: resolveCliPath(options.get("--blob-output-directory"), "Blob output", {
        output: true,
      }),
      artifactRunId: options.get("--artifact-run-id"),
      artifactRunAttempt: options.get("--artifact-run-attempt"),
      outputPath: resolveCliPath(options.get("--output"), "Validation output", { output: true }),
    });
    return;
  }
  if (command === "validate-merged-report") {
    const options = parseOptions(args, [
      "--merged-result",
      "--discovery-audit",
      "--artifact-validation",
      "--output",
    ]);
    validateMergedReport({
      mergedResultPath: resolveCliPath(options.get("--merged-result"), "Merged result"),
      discoveryAuditPath: resolveCliPath(options.get("--discovery-audit"), "Discovery audit"),
      artifactValidationPath: resolveCliPath(
        options.get("--artifact-validation"),
        "Artifact validation",
      ),
      outputPath: resolveCliPath(options.get("--output"), "Merged validation output", {
        output: true,
      }),
    });
    return;
  }
  fail(
    "Usage: vitest-ci.mjs <audit-plan|emit-matrix|write-shard-manifest|validate-shard-artifacts|validate-merged-report>.",
  );
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Vitest CI authority failed."}\n`,
    );
    process.exitCode = 1;
  }
}
