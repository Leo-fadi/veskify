import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { fail, requireCondition } from "./errors.js";
import { compareCodeUnits, fingerprintJson, sha256Hex } from "./json.js";
import {
  assessPathAuthority,
  assessScopeBudget,
  assertSensitivePathAuthorized,
  isSensitivePath,
  normalizeRepositoryPath,
  pathMatchesAny,
} from "./policy.js";

const decoder = new TextDecoder("utf-8", { fatal: true });

const gitBuffer = (repositoryRoot, args, { allowFailure = false } = {}) => {
  const result = spawnSync("git", ["-C", repositoryRoot, ...args], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || (!allowFailure && result.status !== 0)) {
    fail("git-inspection-failed", `Git inspection failed for ${args[0] ?? "command"}.`);
  }
  return result;
};

const decode = (buffer, label) => {
  try {
    return decoder.decode(buffer);
  } catch {
    fail("git-path-encoding", `${label} is not valid UTF-8 and cannot enter I-JSON evidence.`);
  }
};

const text = (repositoryRoot, args) =>
  decode(gitBuffer(repositoryRoot, args).stdout, "Git output").trim();

const nulItems = (repositoryRoot, args) =>
  decode(gitBuffer(repositoryRoot, args).stdout, "Git path output").split("\0").filter(Boolean);

const listTree = (repositoryRoot, baseCommit) => {
  const result = new Map();
  for (const record of nulItems(repositoryRoot, [
    "ls-tree",
    "-r",
    "-z",
    "--full-tree",
    baseCommit,
  ])) {
    const tab = record.indexOf("\t");
    requireCondition(tab > 0, "git-tree-record", "Git tree record is malformed.");
    const [mode, type, oid] = record.slice(0, tab).split(" ");
    const relativePath = normalizeRepositoryPath(record.slice(tab + 1));
    result.set(relativePath, { mode, type, oid });
  }
  return result;
};

const listIndex = (repositoryRoot) => {
  const result = new Map();
  for (const record of nulItems(repositoryRoot, ["ls-files", "--stage", "-z"])) {
    const tab = record.indexOf("\t");
    requireCondition(tab > 0, "git-index-record", "Git index record is malformed.");
    const [mode, oid, stage] = record.slice(0, tab).split(" ");
    requireCondition(stage === "0", "git-index-stage", "Git index contains an unmerged entry.");
    const relativePath = normalizeRepositoryPath(record.slice(tab + 1));
    result.set(relativePath, { mode, oid });
  }
  return result;
};

const assertNoHiddenTrackedPaths = (repositoryRoot) => {
  for (const record of nulItems(repositoryRoot, ["ls-files", "-v", "-z"])) {
    requireCondition(
      record.length >= 3 && record[1] === " ",
      "git-index-flag-record",
      "Git index flag record is malformed.",
    );
    const tag = record[0];
    const relativePath = normalizeRepositoryPath(record.slice(2));
    if (tag !== tag.toUpperCase() || tag.toUpperCase() === "S") {
      fail(
        "git-index-hidden-change-flag",
        `Tracked path uses an index flag that can hide worktree changes: ${relativePath}`,
      );
    }
  }
};

const parseNameStatus = (items) => {
  const entries = [];
  for (let index = 0; index < items.length; index += 1) {
    const statusToken = items[index];
    const status = statusToken[0];
    if (status === "R" || status === "C") {
      const previousPath = normalizeRepositoryPath(items[index + 1]);
      const currentPath = normalizeRepositoryPath(items[index + 2]);
      entries.push({
        status,
        similarity: Number(statusToken.slice(1)),
        previousPath,
        path: currentPath,
      });
      index += 2;
    } else {
      entries.push({ status, path: normalizeRepositoryPath(items[index + 1]) });
      index += 1;
    }
  }
  return entries;
};

const parseNumstat = (items) => {
  const result = new Map();
  for (let index = 0; index < items.length; index += 1) {
    const record = items[index];
    const fields = record.split("\t");
    requireCondition(fields.length >= 3, "git-numstat-record", "Git numstat record is malformed.");
    const addedToken = fields[0];
    const deletedToken = fields[1];
    let relativePath = fields.slice(2).join("\t");
    if (relativePath === "") {
      index += 1;
      index += 1;
      relativePath = items[index];
    }
    relativePath = normalizeRepositoryPath(relativePath);
    result.set(relativePath, {
      addedLines: addedToken === "-" ? 0 : Number(addedToken),
      deletedLines: deletedToken === "-" ? 0 : Number(deletedToken),
      binary: addedToken === "-" || deletedToken === "-",
    });
  }
  return result;
};

const isBinary = (buffer) => {
  if (buffer.includes(0)) return true;
  try {
    decoder.decode(buffer);
    return false;
  } catch {
    return true;
  }
};

const lineCount = (buffer) => {
  if (buffer.length === 0) return 0;
  const source = decoder.decode(buffer);
  return (source.match(/\n/gu) ?? []).length + (source.endsWith("\n") ? 0 : 1);
};

const currentMode = (stats) => {
  if (stats.isSymbolicLink()) return "120000";
  if (stats.isFile()) return stats.mode & 0o111 ? "100755" : "100644";
  return "unsupported";
};

const fileTypeFromMode = (mode) => {
  if (mode === "120000") return "symbolic-link";
  if (mode === "160000") return "gitlink";
  return "regular-file";
};

const assertNoSymlinkParents = (repositoryRoot, relativePath) => {
  const parts = relativePath.split("/");
  let current = repositoryRoot;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    const stats = lstatSync(current);
    if (stats.isSymbolicLink()) {
      fail("symlink-parent", `Changed path traverses a symbolic-link parent: ${relativePath}`);
    }
  }
};

const literalPathspec = (relativePath) => `:(top,literal)${relativePath}`;

const diffPathspec = (excludedPaths) => [
  "--",
  ".",
  ...excludedPaths.map((relativePath) => `:(exclude,top,literal)${relativePath}`),
];

const readIndexMetadata = (repositoryRoot, relativePath) => {
  const output = decode(
    gitBuffer(repositoryRoot, ["ls-files", "--debug", "-z", "--", literalPathspec(relativePath)])
      .stdout,
    "Git index metadata",
  );
  const separator = output.indexOf("\0");
  requireCondition(separator >= 0, "git-index-metadata", "Git index metadata is malformed.");
  requireCondition(
    normalizeRepositoryPath(output.slice(0, separator)) === relativePath,
    "git-index-metadata",
    "Git index metadata path does not match the requested path.",
  );
  const metadata = output.slice(separator + 1);
  const timestamp = (label) => {
    const match = metadata.match(new RegExp(`\\b${label}: (\\d+):(\\d+)`, "u"));
    requireCondition(match, "git-index-metadata", `Git index ${label} metadata is missing.`);
    return BigInt(match[1]) * 1_000_000_000n + BigInt(match[2]);
  };
  const sizeMatch = metadata.match(/\bsize: (\d+)/u);
  requireCondition(sizeMatch, "git-index-metadata", "Git index size metadata is missing.");
  return {
    ctimeNs: timestamp("ctime"),
    mtimeNs: timestamp("mtime"),
    size: BigInt(sizeMatch[1]),
  };
};

const sensitivePathFailure = (relativePath) =>
  fail(
    "sensitive-path-forbidden",
    `Sensitive changed path is not authorized for content access: ${relativePath}`,
  );

const sensitiveDiffPreflight = ({
  repositoryRoot,
  baseTree,
  indexTree,
  untrackedPaths,
  secretFilesAllowed,
}) => {
  const unauthorizedSensitivePaths = [
    ...new Set(
      [...baseTree.keys(), ...indexTree.keys(), ...untrackedPaths].filter(
        (relativePath) =>
          isSensitivePath(relativePath) && !pathMatchesAny(relativePath, secretFilesAllowed),
      ),
    ),
  ].sort(compareCodeUnits);
  const untrackedSet = new Set(untrackedPaths);
  for (const relativePath of unauthorizedSensitivePaths) {
    if (untrackedSet.has(relativePath)) sensitivePathFailure(relativePath);
    const baseEntry = baseTree.get(relativePath);
    const indexEntry = indexTree.get(relativePath);
    if (
      !baseEntry ||
      !indexEntry ||
      baseEntry.mode !== indexEntry.mode ||
      baseEntry.oid !== indexEntry.oid
    ) {
      sensitivePathFailure(relativePath);
    }
    const absolutePath = path.join(repositoryRoot, ...relativePath.split("/"));
    assertNoSymlinkParents(repositoryRoot, relativePath);
    let stats;
    try {
      stats = lstatSync(absolutePath, { bigint: true });
    } catch {
      sensitivePathFailure(relativePath);
    }
    if (!stats.isFile()) sensitivePathFailure(relativePath);
    const executable = (stats.mode & 0o111n) !== 0n;
    const mode = executable ? "100755" : "100644";
    const indexMetadata = readIndexMetadata(repositoryRoot, relativePath);
    if (
      mode !== indexEntry.mode ||
      stats.size !== indexMetadata.size ||
      stats.ctimeNs !== indexMetadata.ctimeNs ||
      stats.mtimeNs !== indexMetadata.mtimeNs
    ) {
      sensitivePathFailure(relativePath);
    }
  }
  return unauthorizedSensitivePaths;
};

const readCurrentState = (repositoryRoot, relativePath) => {
  const absolutePath = path.join(repositoryRoot, ...relativePath.split("/"));
  assertNoSymlinkParents(repositoryRoot, relativePath);
  let stats;
  try {
    stats = lstatSync(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (stats.isSymbolicLink()) {
    const target = readlinkSync(absolutePath, "utf8");
    return {
      mode: "120000",
      fileType: "symbolic-link",
      sha256: sha256Hex(Buffer.from(target, "utf8")),
      binary: false,
      lines: 1,
    };
  }
  requireCondition(
    stats.isFile(),
    "unsupported-file-type",
    `Changed path is not a regular file or symlink: ${relativePath}`,
  );
  const buffer = readFileSync(absolutePath);
  const binary = isBinary(buffer);
  return {
    mode: currentMode(stats),
    fileType: "regular-file",
    sha256: sha256Hex(buffer),
    binary,
    lines: binary ? 0 : lineCount(buffer),
  };
};

const readBaseState = (repositoryRoot, treeEntry) => {
  if (!treeEntry) return null;
  if (treeEntry.mode === "160000") {
    return {
      mode: treeEntry.mode,
      fileType: "gitlink",
      sha256: sha256Hex(treeEntry.oid),
      binary: true,
    };
  }
  const buffer = gitBuffer(repositoryRoot, ["cat-file", "blob", treeEntry.oid]).stdout;
  return {
    mode: treeEntry.mode,
    fileType: fileTypeFromMode(treeEntry.mode),
    sha256: sha256Hex(buffer),
    binary: isBinary(buffer),
  };
};

const statePaths = (repositoryRoot, args) =>
  nulItems(repositoryRoot, args).map(normalizeRepositoryPath).sort(compareCodeUnits);

export const inspectRepositoryAuthority = (contract) => {
  let resolvedRoot;
  try {
    resolvedRoot = realpathSync(contract.repository.root);
  } catch {
    fail("repository-root-missing", "Contract repository root cannot be resolved.");
  }
  const gitRoot = realpathSync(text(resolvedRoot, ["rev-parse", "--show-toplevel"]));
  requireCondition(
    gitRoot === resolvedRoot,
    "repository-root-mismatch",
    "Resolved Git root differs from the contract repository root.",
  );
  const branch = text(resolvedRoot, ["branch", "--show-current"]);
  requireCondition(
    branch === contract.branch,
    "branch-mismatch",
    `Current branch does not match contract branch ${contract.branch}.`,
  );
  const baseProbe = gitBuffer(resolvedRoot, ["cat-file", "-e", `${contract.baseCommit}^{commit}`], {
    allowFailure: true,
  });
  requireCondition(
    baseProbe.status === 0,
    "base-commit-missing",
    "Contract base commit is unavailable in local Git authority.",
  );
  const headCommit = text(resolvedRoot, ["rev-parse", "HEAD"]);
  const ancestry = gitBuffer(
    resolvedRoot,
    ["merge-base", "--is-ancestor", contract.baseCommit, headCommit],
    { allowFailure: true },
  );
  requireCondition(
    ancestry.status === 0,
    "base-not-ancestor",
    "Contract base commit is not an ancestor of current HEAD.",
  );
  const remote = gitBuffer(
    resolvedRoot,
    ["remote", "get-url", contract.repository.canonicalRemote],
    { allowFailure: true },
  );
  requireCondition(
    remote.status === 0,
    "canonical-remote-missing",
    `Canonical remote ${contract.repository.canonicalRemote} is unavailable.`,
  );
  return { repositoryRoot: resolvedRoot, branch, baseCommit: contract.baseCommit, headCommit };
};

export const buildImplementationIdentity = (contract) => {
  const authority = inspectRepositoryAuthority(contract);
  const repositoryRoot = authority.repositoryRoot;
  const baseTree = listTree(repositoryRoot, contract.baseCommit);
  const indexTree = listIndex(repositoryRoot);
  assertNoHiddenTrackedPaths(repositoryRoot);
  const untrackedPaths = statePaths(repositoryRoot, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  const excludedSensitivePaths = sensitiveDiffPreflight({
    repositoryRoot,
    baseTree,
    indexTree,
    untrackedPaths,
    secretFilesAllowed: contract.externalCallPolicy.secretFilesAllowed,
  });
  const safePathspec = diffPathspec(excludedSensitivePaths);
  const diffEntries = parseNameStatus(
    nulItems(repositoryRoot, [
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      "--no-ext-diff",
      contract.baseCommit,
      ...safePathspec,
    ]),
  );
  const trackedPaths = new Set(
    diffEntries.flatMap((entry) => [entry.previousPath, entry.path]).filter(Boolean),
  );
  for (const untrackedPath of untrackedPaths) {
    if (!trackedPaths.has(untrackedPath))
      diffEntries.push({ status: "A", path: untrackedPath, untracked: true });
  }
  const numstat = parseNumstat(
    nulItems(repositoryRoot, [
      "diff",
      "--numstat",
      "-z",
      "--find-renames",
      "--no-ext-diff",
      contract.baseCommit,
      ...safePathspec,
    ]),
  );
  const entries = diffEntries.map((entry) => {
    const candidatePaths = [entry.previousPath, entry.path].filter(Boolean);
    for (const relativePath of candidatePaths) {
      assertSensitivePathAuthorized(relativePath, contract.externalCallPolicy.secretFilesAllowed);
    }
    const basePath = entry.previousPath ?? entry.path;
    const baseState = readBaseState(repositoryRoot, baseTree.get(basePath));
    const currentState = entry.status === "D" ? null : readCurrentState(repositoryRoot, entry.path);
    const stats = numstat.get(entry.path) ?? { addedLines: 0, deletedLines: 0, binary: false };
    const untrackedBinary = entry.untracked ? (currentState?.binary ?? false) : false;
    const untrackedAdded =
      entry.untracked && currentState && !currentState.binary ? currentState.lines : 0;
    return {
      path: entry.path,
      ...(entry.previousPath ? { previousPath: entry.previousPath } : {}),
      status: entry.status,
      ...(entry.similarity !== undefined ? { similarity: entry.similarity } : {}),
      fileType: currentState?.fileType ?? baseState?.fileType ?? "unknown",
      baseMode: baseState?.mode ?? null,
      currentMode: currentState?.mode ?? null,
      baseContentSha256: baseState?.sha256 ?? null,
      currentContentSha256: currentState?.sha256 ?? null,
      addedLines: entry.untracked ? untrackedAdded : stats.addedLines,
      deletedLines: stats.deletedLines,
      binary:
        stats.binary ||
        untrackedBinary ||
        baseState?.binary === true ||
        currentState?.binary === true,
    };
  });
  entries.sort((left, right) =>
    compareCodeUnits(
      `${left.path}\0${left.previousPath ?? ""}`,
      `${right.path}\0${right.previousPath ?? ""}`,
    ),
  );
  const pathAuthority = assessPathAuthority(entries, contract);
  const scopeBudget = assessScopeBudget(entries, contract.scopeBudget);
  const safeImplementationManifest = {
    schemaVersion: "1.0.0",
    baseCommit: contract.baseCommit,
    entries,
  };
  const diffFingerprint = fingerprintJson(
    "veskify-implementation-diff-v1",
    safeImplementationManifest,
  );
  const changedPaths = [
    ...new Set(entries.flatMap((entry) => [entry.previousPath, entry.path]).filter(Boolean)),
  ].sort(compareCodeUnits);
  const gitState = {
    committedPaths: statePaths(repositoryRoot, [
      "diff",
      "--name-only",
      "-z",
      `${contract.baseCommit}..${authority.headCommit}`,
      ...safePathspec,
    ]),
    stagedPaths: statePaths(repositoryRoot, [
      "diff",
      "--cached",
      "--name-only",
      "-z",
      authority.headCommit,
      ...safePathspec,
    ]),
    unstagedPaths: statePaths(repositoryRoot, ["diff", "--name-only", "-z", ...safePathspec]),
    untrackedPaths,
  };
  return {
    schemaVersion: "1.0.0",
    repositoryRoot,
    branch: authority.branch,
    baseCommit: authority.baseCommit,
    headCommit: authority.headCommit,
    changedPaths,
    fileStateManifest: entries,
    diffFingerprint,
    gitState,
    productionFileCount: scopeBudget.productionFilesChanged,
    productionLineAdditions: scopeBudget.productionLineAdditions,
    productionLineDeletions: scopeBudget.productionLineDeletions,
    productionLineChurn: scopeBudget.productionLineChurn,
    pathAuthority,
    scopeBudget,
    result: pathAuthority.result === "PASS" && scopeBudget.result === "PASS" ? "PASS" : "FAIL",
  };
};

export const readBaseBlob = (repositoryRoot, baseCommit, relativePath) =>
  gitBuffer(repositoryRoot, ["show", `${baseCommit}:${relativePath}`]).stdout;
