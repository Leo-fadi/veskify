import { canonicalizeJson, compareCodeUnits } from "./json.js";

const exactArray = (left, right) => canonicalizeJson(left) === canonicalizeJson(right);

const duplicates = (values) => values.filter((value, index) => values.indexOf(value) !== index);

export const reconcileVerifierVerdict = (contractRecord, identity, verdict) => {
  const contract = contractRecord.contract;
  const findings = [];
  const expectEqual = (actual, expected, code) => {
    if (actual !== expected) findings.push({ code });
  };
  expectEqual(verdict.sprintId, contract.sprintId, "sprint-id-mismatch");
  expectEqual(verdict.taskId, contract.taskId, "task-id-mismatch");
  expectEqual(
    verdict.contractFingerprint,
    contractRecord.contractFingerprint,
    "contract-fingerprint-mismatch",
  );
  expectEqual(
    verdict.implementationIdentity.repositoryRoot,
    identity.repositoryRoot,
    "repository-root-mismatch",
  );
  expectEqual(verdict.implementationIdentity.branch, identity.branch, "branch-mismatch");
  expectEqual(
    verdict.implementationIdentity.baseCommit,
    identity.baseCommit,
    "base-commit-mismatch",
  );
  expectEqual(
    verdict.implementationIdentity.headCommit,
    identity.headCommit,
    "head-commit-mismatch",
  );
  expectEqual(
    verdict.implementationIdentity.diffFingerprint,
    identity.diffFingerprint,
    "implementation-fingerprint-mismatch",
  );
  if (!exactArray(verdict.implementationIdentity.changedPaths, identity.changedPaths)) {
    findings.push({ code: "changed-paths-mismatch" });
  }

  const contractCriterionIds = contract.acceptanceCriteria.map(({ id }) => id).sort();
  const criterionIds = verdict.criterionResults.map(
    ({ acceptanceCriterionId }) => acceptanceCriterionId,
  );
  if (duplicates(criterionIds).length > 0) findings.push({ code: "duplicate-criterion" });
  for (const id of contractCriterionIds) {
    if (criterionIds.filter((candidate) => candidate === id).length !== 1) {
      findings.push({ code: "missing-criterion", id });
    }
  }
  for (const id of criterionIds) {
    if (!contractCriterionIds.includes(id)) findings.push({ code: "undeclared-criterion", id });
  }

  const contractEvidenceIds = contract.requiredEvidence.map(({ id }) => id).sort();
  const contractEvidenceById = new Map(contract.requiredEvidence.map((item) => [item.id, item]));
  const evidenceIds = verdict.evidence.map(({ id }) => id);
  if (duplicates(evidenceIds).length > 0) findings.push({ code: "duplicate-evidence" });
  for (const id of contractEvidenceIds) {
    if (evidenceIds.filter((candidate) => candidate === id).length !== 1) {
      findings.push({ code: "missing-required-evidence", id });
    }
  }
  for (const evidence of verdict.evidence) {
    const declaration = contractEvidenceById.get(evidence.id);
    if (!declaration) {
      findings.push({ code: "undeclared-evidence", id: evidence.id });
    } else if (evidence.type !== declaration.type) {
      findings.push({ code: "evidence-type-mismatch", id: evidence.id });
    }
    if (evidence.containsSensitiveData)
      findings.push({ code: "sensitive-evidence", id: evidence.id });
  }

  for (const criterion of contract.acceptanceCriteria) {
    const result = verdict.criterionResults.find(
      ({ acceptanceCriterionId }) => acceptanceCriterionId === criterion.id,
    );
    if (!result) continue;
    for (const evidenceId of result.evidence) {
      if (!evidenceIds.includes(evidenceId) || !contractEvidenceIds.includes(evidenceId)) {
        findings.push({ code: "criterion-evidence-undeclared", id: criterion.id });
      }
    }
    for (const requiredEvidenceId of criterion.requiredEvidence) {
      if (!result.evidence.includes(requiredEvidenceId)) {
        findings.push({
          code: "criterion-evidence-missing",
          id: criterion.id,
          evidenceId: requiredEvidenceId,
        });
      }
    }
  }

  const commandTexts = verdict.commandsRun.map(({ command }) => command);
  for (const validation of contract.requiredValidation) {
    const matches = verdict.commandsRun.filter(({ command }) => command === validation.command);
    if (matches.length !== 1)
      findings.push({ code: "validation-command-mismatch", id: validation.id });
    const command = matches[0];
    if (!command) continue;
    if (command.result === "PASS" && command.exitCode !== 0) {
      findings.push({ code: "pass-command-nonzero", id: validation.id });
    }
    for (const evidenceId of validation.requiredEvidence) {
      if (!command.evidence.includes(evidenceId) || !evidenceIds.includes(evidenceId)) {
        findings.push({ code: "command-evidence-missing", id: validation.id, evidenceId });
      }
    }
  }
  if (
    duplicates(commandTexts).some((command) =>
      contract.requiredValidation.some((item) => item.command === command),
    )
  ) {
    findings.push({ code: "duplicate-required-command" });
  }

  if (verdict.verdict === "PASS") {
    if (identity.result !== "PASS") findings.push({ code: "implementation-identity-failed" });
    if (verdict.criterionResults.some(({ status }) => status !== "PASS"))
      findings.push({ code: "criterion-not-pass" });
    if (verdict.commandsRun.some(({ result, exitCode }) => result !== "PASS" || exitCode !== 0)) {
      findings.push({ code: "validation-not-pass" });
    }
    if (verdict.scopeDrift.detected || verdict.scopeDrift.findings.length > 0)
      findings.push({ code: "scope-drift" });
    if (verdict.architectureDrift.detected || verdict.architectureDrift.findings.length > 0)
      findings.push({ code: "architecture-drift" });
    if (verdict.forbiddenChanges.detected || verdict.forbiddenChanges.paths.length > 0)
      findings.push({ code: "forbidden-changes" });
    if (verdict.unverifiedClaims.length > 0) findings.push({ code: "unverified-claims" });
    if (verdict.blockingFindings.length > 0) findings.push({ code: "blocking-findings" });
    if (verdict.sensitiveDataRetained) findings.push({ code: "sensitive-data-retained" });
  }

  findings.sort((left, right) => compareCodeUnits(canonicalizeJson(left), canonicalizeJson(right)));
  const result = findings.length > 0 ? "FAIL" : verdict.verdict;
  return {
    result,
    exitCode: result === "PASS" ? 0 : result === "BLOCKED" ? 2 : 1,
    findings,
    criterionCoverage: {
      declared: contractCriterionIds.length,
      reported: criterionIds.length,
    },
    evidenceCoverage: {
      declared: contractEvidenceIds.length,
      reported: evidenceIds.length,
    },
    validationCoverage: {
      declared: contract.requiredValidation.length,
      reported: verdict.commandsRun.length,
    },
  };
};
