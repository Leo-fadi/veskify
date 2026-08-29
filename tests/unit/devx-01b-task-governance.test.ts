// @vitest-environment node

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  GovernanceError,
  assessPathAuthority,
  assessScopeBudget,
  assertSensitivePathAuthorized,
  canonicalizeJson,
  fingerprintJson,
  loadAndValidateContract,
  emitReport,
  normalizeRepositoryPath,
  parseStrictJson,
  reconcileVerifierVerdict,
  sha256Hex,
  validateTaskContract,
  validateVerifierVerdict,
} from "../../scripts/lib/task-governance/index.js";
import { describe, expect, it } from "vitest";

const baseCommit = "1".repeat(40);
const fingerprint = `veskify-task-contract-v1_${"2".repeat(64)}`;
const diffFingerprint = `veskify-implementation-diff-v1_${"3".repeat(64)}`;
const evidenceSha = "4".repeat(64);

const emptyStrings = (): string[] => [];
const emptyClaims = (): Array<{ claim: string; reason: string }> => [];
const emptyBlockingFindings = (): Array<{
  id: string;
  severity: "HIGH" | "MEDIUM";
  finding: string;
  requiredAction: string;
}> => [];

interface HardLimitException {
  approvedBy: string;
  approvalReference: string;
  reason: string;
}

const contract = () => ({
  $schema: "schema",
  schemaVersion: "1.0.0",
  contractState: "immutable",
  sprintId: "DEVX-TEST",
  taskId: "DEVX-TEST-01",
  title: "Governance test",
  repository: { root: "/tmp/repository", canonicalRemote: "origin", baseBranch: "main" },
  branch: "codex/governance-test",
  baseCommit,
  objective: "Test governance.",
  expectedOutcome: "Governance works.",
  dependencies: [],
  mergeOrder: 1,
  canonicalAuthorities: ["Canonical governance"],
  ownedPaths: ["src/**"],
  allowedPaths: ["src/**", "tests/**", "generated/**"],
  forbiddenPaths: ["src/forbidden/**"],
  noTouchAreas: ["Commerce"],
  scopeBudget: {
    targetMaxNetProductionLines: 1000,
    targetMaxProductionFiles: 8,
    hardMaxNetProductionLines: 1500,
    hardMaxProductionFiles: 12,
    canonicalConcern: "Governance",
    generatedFileExclusions: [{ path: "src/generated/**", reason: "Generated authority." }],
    hardLimitException: null as HardLimitException | null,
  },
  externalCallPolicy: {
    openAiCallLimit: 0,
    veskoCallLimit: 0,
    realPublicationAllowed: false,
    externalImageActivityAllowed: false,
    networkPolicy: "forbidden",
    allowlistedActivities: [],
    secretFilesAllowed: [],
  },
  implementationApproach: {
    selectedApproach: "One CLI.",
    canonicalAuthorityExtended: "Governance.",
    namedCurrentConsumers: ["Tests"],
    rejectedShortcuts: ["Raw hashes"],
    expectedFailureBehavior: "Fail closed.",
    unresolvedArchitectureConflicts: [],
  },
  acceptanceCriteria: [
    {
      id: "AC-01",
      requirement: "Governance passes.",
      verificationClass: "positive-behavior",
      requiredEvidence: ["EVIDENCE-01"],
      failureBehavior: "FAIL",
    },
  ],
  requiredValidation: [
    {
      id: "VALIDATION-01",
      command: "pnpm test:focused",
      purpose: "Focused proof.",
      requiredEvidence: ["EVIDENCE-01"],
    },
  ],
  requiredEvidence: [
    {
      id: "EVIDENCE-01",
      type: "test",
      description: "Focused evidence.",
      retention: "temporary",
      sensitiveDataAllowed: false,
    },
  ],
  productOwnerCheckpoint: { required: false, timing: "not-required", criteria: [] },
  stopConditions: [
    {
      id: "STOP-01",
      condition: "Authority conflict.",
      action: "STOP",
      owner: "architecture-owner",
    },
  ],
  commitPolicy: {
    commitAfterVerifierPassOnly: true,
    pushBeforeVerifierPassAllowed: false,
    failedWorkPrAllowed: false,
  },
  reviewPolicy: {
    independentVerifierRequired: true,
    automaticCodexReviewCount: 1,
    consolidatedCorrectionPasses: 1,
    secondAutomaticReviewAllowed: false,
  },
  mergePolicy: {
    dependenciesMergedFirst: true,
    sequential: true,
    greenCiRequired: true,
    explicitMergeAuthorityRequired: true,
    rebaseAllowed: false,
    forcePushAllowed: false,
  },
  nextTask: { taskId: "DEVX-TEST-02", title: "Next", eligibility: "After merge." },
  fingerprintPolicy: {
    canonicalization: "RFC8785-JCS",
    hashAlgorithm: "SHA-256",
    domain: "veskify-task-contract-v1",
  },
});

const identity = () => ({
  result: "PASS",
  repositoryRoot: "/tmp/repository",
  branch: "codex/governance-test",
  baseCommit,
  headCommit: "5".repeat(40),
  diffFingerprint,
  changedPaths: ["src/file.ts"],
});

const verdict = () => ({
  $schema: "schema",
  schemaVersion: "1.0.0",
  sprintId: "DEVX-TEST",
  taskId: "DEVX-TEST-01",
  contractFingerprint: fingerprint,
  implementationIdentity: {
    repositoryRoot: "/tmp/repository",
    branch: "codex/governance-test",
    baseCommit,
    headCommit: "5".repeat(40),
    diffFingerprint,
    changedPaths: ["src/file.ts"],
  },
  verifierIdentity: {
    agentId: "independent-agent",
    independentFromImplementer: true,
    implementationWriteAccessUsed: false,
  },
  verifierMode: "independent-semantic",
  verdict: "PASS",
  criterionResults: [
    {
      acceptanceCriterionId: "AC-01",
      status: "PASS",
      evidence: ["EVIDENCE-01"],
      finding: "Passed.",
      verificationMethod: "Independent test.",
    },
  ],
  commandsRun: [
    { command: "pnpm test:focused", exitCode: 0, result: "PASS", evidence: ["EVIDENCE-01"] },
  ],
  evidence: [
    {
      id: "EVIDENCE-01",
      type: "test",
      location: "/private/tmp/evidence.json",
      sha256: evidenceSha,
      summary: "Focused tests passed.",
      containsSensitiveData: false,
    },
  ],
  scopeDrift: { detected: false, findings: emptyStrings() },
  architectureDrift: { detected: false, findings: emptyStrings() },
  forbiddenChanges: { detected: false, paths: emptyStrings(), finding: "None." },
  unverifiedClaims: emptyClaims(),
  blockingFindings: emptyBlockingFindings(),
  sensitiveDataRetained: false,
  summary: "PASS",
});

type TestVerdict = ReturnType<typeof verdict>;

const entry = (overrides = {}) => ({
  path: "src/file.ts",
  status: "M",
  fileType: "regular-file",
  baseMode: "100644",
  currentMode: "100644",
  baseContentSha256: "a".repeat(64),
  currentContentSha256: "b".repeat(64),
  addedLines: 10,
  deletedLines: 3,
  binary: false,
  ...overrides,
});

describe("DEVX-01B strict contract JSON and RFC 8785 authority", () => {
  it("validates a complete v1 task contract", () => {
    expect(validateTaskContract(contract())).toEqual(contract());
  });

  it("produces a deterministic domain-separated fingerprint", () => {
    expect(fingerprintJson("veskify-task-contract-v1", contract())).toBe(
      fingerprintJson("veskify-task-contract-v1", contract()),
    );
    expect(fingerprintJson("veskify-task-contract-v1", contract())).toMatch(
      /^veskify-task-contract-v1_[0-9a-f]{64}$/,
    );
  });

  it("is independent of object insertion order", () => {
    expect(canonicalizeJson({ z: 1, a: 2 })).toBe(canonicalizeJson({ a: 2, z: 1 }));
  });

  it("preserves array order", () => {
    expect(canonicalizeJson([1, 2])).not.toBe(canonicalizeJson([2, 1]));
  });

  it("matches the RFC 8785 number, literal and string sample", () => {
    const value = parseStrictJson(
      String.raw`{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"€$\u000f\nA'B\"\\\"/","literals":[null,true,false]}`,
    );
    expect(canonicalizeJson(value)).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\"/"}',
    );
  });

  it("uses ECMAScript UTF-16 property ordering", () => {
    const canonical = canonicalizeJson({
      "€": 1,
      "\r": 2,
      דּ: 3,
      "1": 4,
      "😀": 5,
      "\u0080": 6,
      ö: 7,
    });
    expect([...canonical.matchAll(/"([^"]*)":/g)].map((match) => match[1])).toEqual([
      "\\r",
      "1",
      "\u0080",
      "ö",
      "€",
      "😀",
      "דּ",
    ]);
  });

  it.each([
    ['{"a":1,"a":2}', "json-duplicate-key"],
    ['{"a":"\\uD800"}', "json-unpaired-surrogate"],
    ['{"a":"\\uDC00"}', "json-unpaired-surrogate"],
    ['{"a":', "json-invalid-token"],
    ['{"a":01}', "json-object-separator"],
  ])("rejects non-I-JSON or malformed input %#", (source, code) => {
    expect(() => parseStrictJson(source)).toThrowError(expect.objectContaining({ code }));
  });

  it("rejects schema-invalid contracts", () => {
    const invalid = contract();
    invalid.branch = "bad branch";
    expect(() => validateTaskContract(invalid)).toThrowError(
      expect.objectContaining({ code: "schema-invalid" }),
    );
  });

  it("checks source-file SHA before contract parsing", () => {
    const directory = mkdtempSync(join(tmpdir(), "devx-01b-contract-"));
    const path = join(directory, "contract.json");
    writeFileSync(path, "not json");
    expect(() =>
      loadAndValidateContract({ contractPath: path, expectedFileSha256: "0".repeat(64) }),
    ).toThrowError(expect.objectContaining({ code: "contract-file-sha-mismatch" }));
  });
});

describe("DEVX-01B path, sensitive-data and scope policy", () => {
  it.each(["../escape", "/absolute", "a/../escape", "C:/absolute"])(
    "rejects non-normalized path %s",
    (value) => expect(() => normalizeRepositoryPath(value)).toThrow(GovernanceError),
  );

  it("preserves a literal backslash in a POSIX repository path", () => {
    expect(normalizeRepositoryPath(String.raw`docs/literal\name.txt`)).toBe(
      String.raw`docs/literal\name.txt`,
    );
  });

  it("accepts an allowed owned production path", () => {
    expect(assessPathAuthority([entry()], contract()).result).toBe("PASS");
  });

  it("accepts an allowed support path", () => {
    expect(assessPathAuthority([entry({ path: "tests/file.test.ts" })], contract()).result).toBe(
      "PASS",
    );
  });

  it("rejects production outside owned authority", () => {
    const value = contract();
    value.ownedPaths = ["src/owned/**"];
    expect(assessPathAuthority([entry()], value).findings).toContainEqual(
      expect.objectContaining({ code: "production-path-not-owned" }),
    );
  });

  it("lets forbidden authority override allowed and owned", () => {
    expect(
      assessPathAuthority([entry({ path: "src/forbidden/file.ts" })], contract()).findings,
    ).toContainEqual(expect.objectContaining({ code: "forbidden-path" }));
  });

  it.each([
    entry({ path: "outside/file.ts" }),
    entry({ path: "src/file.ts", previousPath: "outside/old.ts", status: "R" }),
    entry({ path: "outside/new.ts", previousPath: "src/file.ts", status: "R" }),
  ])("rejects unauthorized current or rename paths %#", (value) => {
    expect(assessPathAuthority([value], contract()).result).toBe("FAIL");
  });

  it("does not let generated exclusions bypass path authority", () => {
    expect(assessPathAuthority([entry({ path: "generated/file.bin" })], contract()).result).toBe(
      "PASS",
    );
    const value = contract();
    value.allowedPaths = ["src/**", "tests/**"];
    expect(assessPathAuthority([entry({ path: "generated/file.bin" })], value).result).toBe("FAIL");
  });

  it.each([
    ".env",
    ".env.local",
    "config/credentials.json",
    "keys/private.pem",
    "raw-provider-response/data.json",
  ])("rejects sensitive path %s before content access", (value) =>
    expect(() => assertSensitivePathAuthorized(value, [])).toThrow(GovernanceError),
  );

  it("allows an explicitly authorized sensitive path", () => {
    expect(() =>
      assertSensitivePathAuthorized("fixtures/.env.test", ["fixtures/.env.test"]),
    ).not.toThrow();
  });

  it("passes below target and reports additions/deletions/churn separately", () => {
    expect(assessScopeBudget([entry()], contract().scopeBudget)).toMatchObject({
      result: "PASS",
      productionLineAdditions: 10,
      productionLineDeletions: 3,
      productionLineChurn: 13,
      target: { result: "PASS" },
    });
  });

  it("warns above target but below hard stop", () => {
    expect(assessScopeBudget([entry({ addedLines: 1200 })], contract().scopeBudget)).toMatchObject({
      result: "PASS",
      target: { result: "WARNING" },
      hardLimit: { result: "PASS" },
    });
  });

  it("fails the hard production-line stop", () => {
    expect(assessScopeBudget([entry({ addedLines: 1501 })], contract().scopeBudget).result).toBe(
      "FAIL",
    );
  });

  it("fails the hard production-file stop", () => {
    const entries = Array.from({ length: 13 }, (_, index) =>
      entry({ path: `src/file-${index}.ts` }),
    );
    expect(assessScopeBudget(entries, contract().scopeBudget).result).toBe("FAIL");
  });

  it("applies a schema-valid product-owner hard-limit exception", () => {
    const budget = contract().scopeBudget;
    budget.hardLimitException = {
      approvedBy: "product-owner",
      approvalReference: "APPROVAL-01",
      reason: "Atomic invariant.",
    };
    expect(assessScopeBudget([entry({ addedLines: 1501 })], budget)).toMatchObject({
      result: "PASS",
      hardLimit: { exceptionApplied: true },
    });
  });

  it("rejects an invalid hard-limit exception through canonical schema", () => {
    const value = contract();
    value.scopeBudget.hardLimitException = {
      approvedBy: "implementer",
      approvalReference: "SELF",
      reason: "Convenient.",
    };
    expect(() => validateTaskContract(value)).toThrow(GovernanceError);
  });

  it("does not let deletions offset additions", () => {
    expect(
      assessScopeBudget([entry({ addedLines: 1501, deletedLines: 5000 })], contract().scopeBudget)
        .result,
    ).toBe("FAIL");
  });

  it("excludes generated production paths only from budget accounting", () => {
    expect(
      assessScopeBudget(
        [entry({ path: "src/generated/file.ts", addedLines: 9000 })],
        contract().scopeBudget,
      ),
    ).toMatchObject({ result: "PASS", productionFilesChanged: 0, productionLineAdditions: 0 });
  });

  it("does not let a generated old rename path exclude a non-generated destination", () => {
    expect(
      assessScopeBudget(
        [
          entry({
            status: "R",
            previousPath: "src/generated/old.ts",
            path: "src/current/new.ts",
            addedLines: 2000,
          }),
        ],
        contract().scopeBudget,
      ),
    ).toMatchObject({ result: "FAIL", productionFilesChanged: 1, productionLineAdditions: 2000 });
  });

  it("counts binary production files without text additions", () => {
    expect(
      assessScopeBudget([entry({ binary: true, addedLines: 0 })], contract().scopeBudget),
    ).toMatchObject({
      productionFilesChanged: 1,
      productionLineAdditions: 0,
    });
  });
});

describe("DEVX-01B verifier-verdict reconciliation", () => {
  const reconcile = (value = verdict(), currentIdentity = identity()) =>
    reconcileVerifierVerdict(
      { contract: contract(), contractFingerprint: fingerprint },
      currentIdentity,
      value,
    );

  it("accepts a complete exact PASS verdict", () => {
    expect(validateVerifierVerdict(verdict())).toEqual(verdict());
    expect(reconcile()).toMatchObject({ result: "PASS", exitCode: 0, findings: [] });
  });

  it.each([
    [
      "missing criterion",
      (value: TestVerdict) => value.criterionResults.splice(0, 1),
      "missing-criterion",
    ],
    [
      "duplicate criterion",
      (value: TestVerdict) =>
        value.criterionResults.push({ ...value.criterionResults[0], finding: "Again." }),
      "duplicate-criterion",
    ],
    [
      "extra criterion",
      (value: TestVerdict) =>
        value.criterionResults.push({
          ...value.criterionResults[0],
          acceptanceCriterionId: "AC-99",
        }),
      "undeclared-criterion",
    ],
    [
      "missing evidence",
      (value: TestVerdict) => value.evidence.splice(0, 1),
      "missing-required-evidence",
    ],
    [
      "wrong criterion evidence",
      (value: TestVerdict) => (value.criterionResults[0].evidence = ["WRONG"]),
      "criterion-evidence-undeclared",
    ],
    [
      "missing validation command",
      (value: TestVerdict) => value.commandsRun.splice(0, 1),
      "validation-command-mismatch",
    ],
    [
      "command text mismatch",
      (value: TestVerdict) => (value.commandsRun[0].command = "pnpm wrong"),
      "validation-command-mismatch",
    ],
    [
      "nonzero PASS command",
      (value: TestVerdict) => (value.commandsRun[0].exitCode = 1),
      "pass-command-nonzero",
    ],
    [
      "contract fingerprint mismatch",
      (value: TestVerdict) =>
        (value.contractFingerprint = `veskify-task-contract-v1_${"9".repeat(64)}`),
      "contract-fingerprint-mismatch",
    ],
    [
      "implementation fingerprint mismatch",
      (value: TestVerdict) =>
        (value.implementationIdentity.diffFingerprint = `veskify-implementation-diff-v1_${"9".repeat(64)}`),
      "implementation-fingerprint-mismatch",
    ],
    [
      "changed paths mismatch",
      (value: TestVerdict) => (value.implementationIdentity.changedPaths = ["src/other.ts"]),
      "changed-paths-mismatch",
    ],
    [
      "branch mismatch",
      (value: TestVerdict) => (value.implementationIdentity.branch = "codex/other"),
      "branch-mismatch",
    ],
    [
      "HEAD mismatch",
      (value: TestVerdict) => (value.implementationIdentity.headCommit = "9".repeat(40)),
      "head-commit-mismatch",
    ],
    [
      "scope drift",
      (value: TestVerdict) => (value.scopeDrift = { detected: true, findings: ["Drift"] }),
      "scope-drift",
    ],
    [
      "architecture drift",
      (value: TestVerdict) => (value.architectureDrift = { detected: true, findings: ["Drift"] }),
      "architecture-drift",
    ],
    [
      "forbidden changes",
      (value: TestVerdict) =>
        (value.forbiddenChanges = { detected: true, paths: ["src/x.ts"], finding: "Changed." }),
      "forbidden-changes",
    ],
    [
      "unverified claims",
      (value: TestVerdict) => value.unverifiedClaims.push({ claim: "Claim", reason: "Missing." }),
      "unverified-claims",
    ],
    [
      "blocking finding",
      (value: TestVerdict) =>
        value.blockingFindings.push({
          id: "FINDING-01",
          severity: "HIGH",
          finding: "Blocked.",
          requiredAction: "Fix.",
        }),
      "blocking-findings",
    ],
  ])("fails closed for %s", (_label, mutate, expectedCode) => {
    const value = verdict();
    mutate(value);
    expect(reconcile(value).findings).toContainEqual(
      expect.objectContaining({ code: expectedCode }),
    );
  });

  it("rejects sensitive-data evidence through canonical verdict schema", () => {
    const value = verdict();
    value.evidence[0].containsSensitiveData = true;
    expect(() => validateVerifierVerdict(value)).toThrow(GovernanceError);
  });

  it("preserves a valid terminal FAIL", () => {
    const value = verdict();
    value.verdict = "FAIL";
    value.criterionResults[0].status = "FAIL";
    value.criterionResults[0].finding = "Failed independently.";
    expect(reconcile(value)).toMatchObject({ result: "FAIL", exitCode: 1 });
  });

  it("preserves a valid terminal BLOCKED", () => {
    const value = verdict();
    value.verdict = "BLOCKED";
    value.criterionResults[0].status = "BLOCKED";
    value.criterionResults[0].finding = "Blocked independently.";
    expect(reconcile(value)).toMatchObject({ result: "BLOCKED", exitCode: 2 });
  });

  it("fails a PASS when the current mechanical identity failed", () => {
    expect(reconcile(verdict(), { ...identity(), result: "FAIL" }).findings).toContainEqual({
      code: "implementation-identity-failed",
    });
  });
});

describe("DEVX-01B deterministic safe output", () => {
  it("atomically replaces output with deterministic sorted JSON", () => {
    const directory = mkdtempSync(join(tmpdir(), "devx-01b-report-"));
    const output = join(directory, "report.json");
    emitReport({ z: 1, a: { y: 2, x: 3 } }, output);
    const first = readFileSync(output, "utf8");
    emitReport({ a: { x: 3, y: 2 }, z: 1 }, output);
    expect(readFileSync(output, "utf8")).toBe(first);
    expect(first).toBe('{\n  "a": {\n    "x": 3,\n    "y": 2\n  },\n  "z": 1\n}\n');
  });

  it("keeps contract raw-file SHA separate from canonical identity", () => {
    const source = JSON.stringify(contract(), null, 2);
    expect(sha256Hex(source)).not.toBe(fingerprintJson("veskify-task-contract-v1", contract()));
  });
});
