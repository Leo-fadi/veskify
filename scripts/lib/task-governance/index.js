import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import { fail, requireCondition } from "./errors.js";
import { buildImplementationIdentity, readBaseBlob } from "./git.js";
import { fingerprintJson, parseStrictJsonBuffer, sha256Hex } from "./json.js";
import {
  taskContractSchemaPath,
  validateTaskContract,
  validateVerifierVerdict,
  verifierVerdictSchemaPath,
} from "./schema.js";
import { reconcileVerifierVerdict } from "./verdict.js";

const shaPattern = /^[0-9a-f]{64}$/u;

const assertContractImmutability = (contractPath, rawBuffer, contract) => {
  const repositoryRoot = realpathSync(contract.repository.root);
  const relativePath = path.relative(repositoryRoot, contractPath).replaceAll("\\", "/");
  if (relativePath === "" || relativePath === ".." || relativePath.startsWith("../")) {
    return { authority: "external", repositoryRelativePath: null };
  }
  let baseBuffer;
  try {
    baseBuffer = readBaseBlob(repositoryRoot, contract.baseCommit, relativePath);
  } catch {
    fail(
      "retained-contract-missing-at-base",
      "Repository-retained contract did not exist at the approved base commit.",
    );
  }
  requireCondition(
    sha256Hex(baseBuffer) === sha256Hex(rawBuffer),
    "retained-contract-modified",
    "Implementation branch modified its repository-retained contract.",
  );
  return { authority: "repository-retained", repositoryRelativePath: relativePath };
};

export const loadAndValidateContract = ({ contractPath, expectedFileSha256 }) => {
  requireCondition(
    shaPattern.test(expectedFileSha256 ?? ""),
    "expected-sha-required",
    "--expected-file-sha256 must be 64 lowercase hexadecimal characters.",
    { exitCode: 64 },
  );
  const resolvedPath = path.resolve(contractPath);
  const stats = lstatSync(resolvedPath);
  requireCondition(
    stats.isFile() && !stats.isSymbolicLink(),
    "contract-file-type",
    "Contract must be a regular non-symlink file.",
  );
  const rawBuffer = readFileSync(resolvedPath);
  const fileSha256 = sha256Hex(rawBuffer);
  requireCondition(
    fileSha256 === expectedFileSha256,
    "contract-file-sha-mismatch",
    "Contract source-file SHA-256 differs from immutable external authority.",
  );
  const contract = validateTaskContract(parseStrictJsonBuffer(rawBuffer));
  const immutability = assertContractImmutability(resolvedPath, rawBuffer, contract);
  return {
    contract,
    contractPath: resolvedPath,
    contractFileSha256: fileSha256,
    contractFingerprint: fingerprintJson("veskify-task-contract-v1", contract),
    canonicalization: "RFC8785-JCS",
    schemaPath: taskContractSchemaPath,
    immutability,
  };
};

export const createContractReport = (contractRecord) => ({
  schemaVersion: "1.0.0",
  command: "contract",
  result: "PASS",
  contractPath: contractRecord.contractPath,
  contractFileSha256: contractRecord.contractFileSha256,
  contractFingerprint: contractRecord.contractFingerprint,
  canonicalization: contractRecord.canonicalization,
  schemaPath: contractRecord.schemaPath,
  immutability: contractRecord.immutability,
});

export const createIdentityReport = (contractRecord) => {
  const implementationIdentity = buildImplementationIdentity(contractRecord.contract);
  return {
    schemaVersion: "1.0.0",
    command: "identity",
    result: implementationIdentity.result,
    contractFingerprint: contractRecord.contractFingerprint,
    contractFileSha256: contractRecord.contractFileSha256,
    implementationIdentity,
  };
};

export const loadVerifierVerdict = (verdictPath) => {
  const resolvedPath = path.resolve(verdictPath);
  const stats = lstatSync(resolvedPath);
  requireCondition(
    stats.isFile() && !stats.isSymbolicLink(),
    "verdict-file-type",
    "Verifier verdict must be a regular non-symlink file.",
  );
  return {
    verdictPath: resolvedPath,
    verdictFileSha256: sha256Hex(readFileSync(resolvedPath)),
    verdict: validateVerifierVerdict(parseStrictJsonBuffer(readFileSync(resolvedPath))),
  };
};

export const createVerificationReport = (contractRecord, verdictRecord) => {
  const implementationIdentity = buildImplementationIdentity(contractRecord.contract);
  const reconciliation = reconcileVerifierVerdict(
    contractRecord,
    implementationIdentity,
    verdictRecord.verdict,
  );
  return {
    schemaVersion: "1.0.0",
    command: "verify",
    result: reconciliation.result,
    contractFingerprint: contractRecord.contractFingerprint,
    contractFileSha256: contractRecord.contractFileSha256,
    verdictFileSha256: verdictRecord.verdictFileSha256,
    verdictSchemaPath: verifierVerdictSchemaPath,
    implementationIdentity,
    reconciliation,
  };
};

export { GovernanceError } from "./errors.js";
export { buildImplementationIdentity } from "./git.js";
export {
  canonicalizeJson,
  compareCodeUnits,
  fingerprintJson,
  parseStrictJson,
  sha256Hex,
} from "./json.js";
export {
  assessPathAuthority,
  assessScopeBudget,
  assertSensitivePathAuthorized,
  isSensitivePath,
  normalizeRepositoryPath,
} from "./policy.js";
export { emitReport } from "./report.js";
export { validateTaskContract, validateVerifierVerdict } from "./schema.js";
export { reconcileVerifierVerdict } from "./verdict.js";
