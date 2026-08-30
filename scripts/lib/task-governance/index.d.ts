export type TerminalResult = "PASS" | "FAIL" | "BLOCKED";

export class GovernanceError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly details: string[];
}

export interface PathFinding {
  code: string;
  path?: string;
  id?: string;
  evidenceId?: string;
}

export interface PathAuthorityResult {
  result: "PASS" | "FAIL";
  findings: PathFinding[];
}

export interface ScopeBudgetResult {
  result: "PASS" | "FAIL";
  productionFilesChanged: number;
  productionLineAdditions: number;
  productionLineDeletions: number;
  productionLineChurn: number;
  excludedGeneratedPaths: string[];
  target: {
    result: "PASS" | "WARNING";
    maxProductionAdditions: number;
    maxProductionFiles: number;
  };
  hardLimit: {
    result: "PASS" | "FAIL";
    exceeded: boolean;
    exceptionApplied: boolean;
    maxProductionAdditions: number;
    maxProductionFiles: number;
  };
}

export interface FileStateManifestEntry {
  path: string;
  previousPath?: string;
  status: string;
  similarity?: number;
  fileType: string;
  baseMode: string | null;
  currentMode: string | null;
  baseContentSha256: string | null;
  currentContentSha256: string | null;
  addedLines: number;
  deletedLines: number;
  binary: boolean;
}

export interface ImplementationIdentity {
  schemaVersion: string;
  result: "PASS" | "FAIL";
  repositoryRoot: string;
  branch: string;
  baseCommit: string;
  headCommit: string;
  changedPaths: string[];
  fileStateManifest: FileStateManifestEntry[];
  diffFingerprint: string;
  gitState: {
    committedPaths: string[];
    stagedPaths: string[];
    unstagedPaths: string[];
    untrackedPaths: string[];
  };
  productionFileCount: number;
  productionLineAdditions: number;
  productionLineDeletions: number;
  productionLineChurn: number;
  pathAuthority: PathAuthorityResult;
  scopeBudget: ScopeBudgetResult;
}

export interface ContractRecord {
  contract: unknown;
  contractPath: string;
  contractFileSha256: string;
  contractFingerprint: string;
  canonicalization: string;
  schemaPath: string;
  immutability: {
    authority: "external" | "repository-retained";
    repositoryRelativePath: string | null;
  };
}

export interface ReconciliationResult {
  result: TerminalResult;
  exitCode: 0 | 1 | 2;
  findings: PathFinding[];
  criterionCoverage: { declared: number; reported: number };
  evidenceCoverage: { declared: number; reported: number };
  validationCoverage: { declared: number; reported: number };
}

export function canonicalizeJson(value: unknown): string;
export function compareCodeUnits(left: string, right: string): -1 | 0 | 1;
export function fingerprintJson(domain: string, value: unknown): string;
export function parseStrictJson(source: string): unknown;
export function sha256Hex(value: string | Uint8Array): string;
export function normalizeRepositoryPath(value: string): string;
export function isSensitivePath(relativePath: string): boolean;
export function assertSensitivePathAuthorized(
  relativePath: string,
  secretFilesAllowed: string[],
): void;
export function assessPathAuthority(entries: unknown[], contract: unknown): PathAuthorityResult;
export function assessScopeBudget(entries: unknown[], scopeBudget: unknown): ScopeBudgetResult;
export function emitReport(report: unknown, outputPath?: string): void;
export function validateTaskContract<T>(value: T): T;
export function validateVerifierVerdict<T>(value: T): T;
export function buildImplementationIdentity(contract: unknown): ImplementationIdentity;
export function reconcileVerifierVerdict(
  contractRecord: unknown,
  identity: unknown,
  verdict: unknown,
): ReconciliationResult;
export function loadAndValidateContract(options: {
  contractPath: string;
  expectedFileSha256: string;
}): ContractRecord;
export function createContractReport(contractRecord: ContractRecord): unknown;
export function createIdentityReport(contractRecord: ContractRecord): unknown;
export function loadVerifierVerdict(verdictPath: string): unknown;
export function createVerificationReport(
  contractRecord: ContractRecord,
  verdictRecord: unknown,
): unknown;
