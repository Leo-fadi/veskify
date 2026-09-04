// @vitest-environment node

import { describe, expect, it } from "vitest";

import { canonicalValueString } from "@/domain/storefront";
// prettier-ignore
import { createFailureMatrixObservations, failureCaseCatalogue } from "../helpers/p10b-19a-10b2-fail-closed-cross-authority-matrix";

const observations = createFailureMatrixObservations();

describe("P10B-19A-10B2 fail-closed cross-authority matrix", () => {
  it("executes the exact 36 cases at their owning terminal boundaries", () => {
    // prettier-ignore
    expect(observations.map(({ caseId, ownerTaskId, expectedTerminalPhaseId }) => ({ caseId, ownerTaskId, expectedTerminalPhaseId }))).toEqual(failureCaseCatalogue.map(({ caseId, ownerTaskId, expectedTerminalPhaseId }) => ({ caseId, ownerTaskId, expectedTerminalPhaseId })));
    observations.forEach((entry) => {
      expect(entry.observedTerminalPhaseId).toBe(entry.expectedTerminalPhaseId);
      // prettier-ignore
      expect([entry.completedPhaseIds, entry.downstreamCompletedPhaseCount, entry.partialOutputCount]).toEqual([[], 0, 0]);
    });
  });

  it("retains exact bounded failures including the three authorized native errors", () => {
    // prettier-ignore
    expect(observations.filter(({ failureAuthorityKind, errorCode }) => failureAuthorityKind === "typed-error" && errorCode === null).map(({ caseId }) => caseId)).toEqual(["a08b-missing-candidate-capacity-evidence", "a08b-stale-candidate-evidence-fingerprint", "a08b-profile-candidate-mismatch"]);
    observations.forEach((entry) => {
      // prettier-ignore
      expect(entry.issuePathFingerprint === null).toBe(entry.failureAuthorityKind === "typed-error");
      if (entry.failureAuthorityKind === "zod-issues") expect(entry.errorName).toBe("ZodError");
    });
    // prettier-ignore
    expect(observations.find(({ caseId }) => caseId.includes("invalid-substitution"))).toMatchObject({ errorCode: "stale-selection-authority" });
    // prettier-ignore
    expect(observations.find(({ caseId }) => caseId.includes("production-empty"))).toMatchObject({ corruptedAuthorityKind: "complete-selection-root-authority", errorCode: "no-eligible-family-candidates" });
  });

  it("preserves source authority with zero repair, fallback or external activity", () => {
    observations.forEach((entry) => {
      expect(entry.preStateFingerprint).toBe(entry.postStateFingerprint);
      // prettier-ignore
      expect([entry.sourceAuthorityFingerprint, entry.corruptionProjectionFingerprint]).toEqual([expect.stringMatching(/v1_[1-9][0-9]*_[a-f0-9]{64}$/u), expect.stringMatching(/v1_[1-9][0-9]*_[a-f0-9]{64}$/u)]);
      expect(Object.values(entry.externalActivity).every((count) => count === 0)).toBe(true);
    });
    // prettier-ignore
    expect(canonicalValueString(observations)).not.toMatch(/"(?:message|merchant|product|price|assetUrl|rawHtml|providerPayload|credential)"/u);
  });

  it("rejects the four legacy-v2 authority substitutions without coercion", () => {
    // prettier-ignore
    const confusion = observations.filter(({ corruptionClass }) => corruptionClass === "authority-confusion");
    // prettier-ignore
    expect(confusion.map(({ caseId }) => caseId)).toEqual(["legacy-alias-as-v2-family-id", "v2-family-id-as-legacy-alias", "legacy-replay-reference-as-v2-selection-request", "v2-selection-receipt-as-legacy-publication-replay-receipt"]);
  });
});
