import path from "node:path";

import { fail } from "./errors.js";
import { compareCodeUnits } from "./json.js";

export const normalizeRepositoryPath = (value) => {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("path-invalid", "Changed path is empty or contains a NUL byte.");
  }
  const candidate = value;
  if (path.posix.isAbsolute(candidate) || /^[A-Za-z]:[\\/]/u.test(candidate)) {
    fail("path-absolute", `Changed path is absolute: ${candidate}`);
  }
  const normalized = path.posix.normalize(candidate);
  if (normalized === ".." || normalized.startsWith("../") || normalized !== candidate) {
    fail(
      "path-traversal",
      `Changed path is not normalized repository-relative POSIX form: ${candidate}`,
    );
  }
  return normalized;
};

export const pathMatchesAny = (relativePath, patterns) =>
  patterns.some((pattern) => path.matchesGlob(relativePath, pattern));

export const isProductionPath = (relativePath) => relativePath.startsWith("src/");

export const isSensitivePath = (relativePath) => {
  const basename = path.posix.basename(relativePath).toLowerCase();
  return (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    /(?:credential|credentials|secret|secrets)(?:[._-].*)?\.(?:json|ya?ml|txt)$/u.test(basename) ||
    /(?:token|tokens)(?:[._-].*)?(?:dump|ledger)?\.(?:json|log|txt)$/u.test(basename) ||
    /\.(?:pem|key|p12|pfx)$/u.test(basename) ||
    relativePath.toLowerCase().includes("raw-provider-response")
  );
};

export const assertSensitivePathAuthorized = (relativePath, secretFilesAllowed) => {
  const normalized = normalizeRepositoryPath(relativePath);
  if (isSensitivePath(normalized) && !pathMatchesAny(normalized, secretFilesAllowed)) {
    fail(
      "sensitive-path-forbidden",
      `Sensitive changed path is not authorized for content access: ${normalized}`,
    );
  }
};

const entryPaths = (entry) =>
  [entry.previousPath, entry.path]
    .filter((value) => value !== undefined)
    .map(normalizeRepositoryPath);

export const assessPathAuthority = (entries, contract) => {
  const findings = [];
  for (const entry of entries) {
    for (const relativePath of entryPaths(entry)) {
      if (pathMatchesAny(relativePath, contract.forbiddenPaths)) {
        findings.push({ code: "forbidden-path", path: relativePath });
        continue;
      }
      if (!pathMatchesAny(relativePath, contract.allowedPaths)) {
        findings.push({ code: "path-not-allowed", path: relativePath });
      }
      if (isProductionPath(relativePath) && !pathMatchesAny(relativePath, contract.ownedPaths)) {
        findings.push({ code: "production-path-not-owned", path: relativePath });
      }
    }
  }
  findings.sort((left, right) =>
    compareCodeUnits(`${left.path}:${left.code}`, `${right.path}:${right.code}`),
  );
  return { result: findings.length === 0 ? "PASS" : "FAIL", findings };
};

export const assessScopeBudget = (entries, scopeBudget) => {
  const productionEntries = entries.filter((entry) => entryPaths(entry).some(isProductionPath));
  const matchesGeneratedExclusion = (relativePath) =>
    scopeBudget.generatedFileExclusions.some(({ path: pattern }) =>
      path.matchesGlob(relativePath, pattern),
    );
  const excluded = productionEntries.filter((entry) => {
    const productionPaths = entryPaths(entry).filter(isProductionPath);
    return productionPaths.length > 0 && productionPaths.every(matchesGeneratedExclusion);
  });
  const excludedSet = new Set(excluded);
  const counted = productionEntries.filter((entry) => !excludedSet.has(entry));
  const additions = counted.reduce((total, entry) => total + entry.addedLines, 0);
  const deletions = counted.reduce((total, entry) => total + entry.deletedLines, 0);
  const productionFilesChanged = counted.length;
  const targetExceeded =
    additions > scopeBudget.targetMaxNetProductionLines ||
    productionFilesChanged > scopeBudget.targetMaxProductionFiles;
  const hardExceeded =
    additions > scopeBudget.hardMaxNetProductionLines ||
    productionFilesChanged > scopeBudget.hardMaxProductionFiles;
  const exceptionApplied = hardExceeded && scopeBudget.hardLimitException !== null;
  return {
    result: hardExceeded && !exceptionApplied ? "FAIL" : "PASS",
    productionFilesChanged,
    productionLineAdditions: additions,
    productionLineDeletions: deletions,
    productionLineChurn: additions + deletions,
    excludedGeneratedPaths: excluded
      .flatMap(entryPaths)
      .filter(isProductionPath)
      .filter(matchesGeneratedExclusion)
      .sort(compareCodeUnits),
    target: {
      result: targetExceeded ? "WARNING" : "PASS",
      maxProductionAdditions: scopeBudget.targetMaxNetProductionLines,
      maxProductionFiles: scopeBudget.targetMaxProductionFiles,
    },
    hardLimit: {
      result: hardExceeded && !exceptionApplied ? "FAIL" : "PASS",
      exceeded: hardExceeded,
      exceptionApplied,
      maxProductionAdditions: scopeBudget.hardMaxNetProductionLines,
      maxProductionFiles: scopeBudget.hardMaxProductionFiles,
    },
  };
};
