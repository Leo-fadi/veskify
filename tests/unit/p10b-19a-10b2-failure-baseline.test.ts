// @vitest-environment node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { format } from "prettier";
import { describe, expect, it } from "vitest";

// prettier-ignore
import { failureBaselineFingerprint, failureBaselinePath, failureCaseCatalogue, parseFailureBaseline, readFailureBaseline, type FailureBaseline } from "../helpers/p10b-19a-10b2-fail-closed-cross-authority-matrix";

// prettier-ignore
const expectedFingerprint = "p10b-19a-fail-closed-cross-authority-matrix-v1_30308_ffae8e9700b84c08fcf1fe7315846077b01170f0be0d82743dce4e8a0ac8d307", expectedFixtureSha256 = "8708a2282749796c9d27d2dcd382384989c7738a5eb0b2f72f87c1ad73cb6a64";
const checked = readFailureBaseline();
// prettier-ignore
const fingerprint = (value: unknown) => failureBaselineFingerprint(value as FailureBaseline), refingerprint = (value: unknown): FailureBaseline => ({ ...(value as FailureBaseline), baselineFingerprint: fingerprint(value) });

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach((child) => expectDeepFrozen(child, seen));
}

describe("P10B-19A-10B2 failure baseline", () => {
  it("is byte-exact, deterministic and fresh-clone sufficient", async () => {
    const bytes = readFileSync(failureBaselinePath);
    // prettier-ignore
    expect(bytes.toString("utf8")).toBe(await format(JSON.stringify(checked, null, 2), { parser: "json" }));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expectedFixtureSha256);
    expect(checked.baselineFingerprint).toBe(expectedFingerprint);
  });

  it("locks all cases, predecessors, zero activity and authorized corrections", () => {
    // prettier-ignore
    expect(checked.failureCases.map(({ caseId, ownerTaskId, expectedTerminalPhaseId }) => ({ caseId, ownerTaskId, expectedTerminalPhaseId }))).toEqual(failureCaseCatalogue.map(({ caseId, ownerTaskId, expectedTerminalPhaseId }) => ({ caseId, ownerTaskId, expectedTerminalPhaseId })));
    // prettier-ignore
    expect(checked.predecessorAuthority).toMatchObject({ a10aMatrixEntryCount: 24, a10aProtectedProductionHashCount: 76, a10aProductionInactivityAssertionCount: 9, a10aCompleteCaseCount: 126, a10aFrozenCaseCount: 72 });
    // prettier-ignore
    expect(Object.values(checked.aggregateEvidence).filter((value) => typeof value === "number")).toEqual([36, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    // prettier-ignore
    expect(checked.failureCases.filter(({ errorName, errorCode }) => errorName === "Error" && errorCode === null).map(({ caseId }) => caseId)).toEqual(["a08b-missing-candidate-capacity-evidence", "a08b-stale-candidate-evidence-fingerprint", "a08b-profile-candidate-mismatch"]);
    expect(checked.failureCases[24].errorCode).toBe("stale-selection-authority");
    expect(checked.failureCases[27].errorCode).toBe("no-eligible-family-candidates");
    expectDeepFrozen(checked);
  });

  it("fingerprints every governed identity and ignores JSON key order", () => {
    const first = checked.failureCases[0];
    // prettier-ignore
    const mutate = (change: object) => ({ ...checked, failureCases: [{ ...first, ...change }, ...checked.failureCases.slice(1)] });
    // prettier-ignore
    [mutate({ caseId: `${first.caseId}-changed` }), mutate({ ownerTaskId: "P10B-19A-09C" }), mutate({ expectedTerminalPhaseId: "legacy-v1-alias" }), mutate({ errorName: "ChangedError" }), { ...checked, aggregateEvidence: { ...checked.aggregateEvidence, sourceMutationCount: 1 } }].forEach((value) => expect(fingerprint(value)).not.toBe(expectedFingerprint));
    const reversed = Object.fromEntries(Object.entries(checked).reverse());
    expect(fingerprint(reversed)).toBe(expectedFingerprint);
    expect(parseFailureBaseline(reversed, false)).toEqual(checked);
  });

  it("rejects unknown, stale, malformed, missing and reordered authority", () => {
    expect(() => parseFailureBaseline({ ...checked, unexpected: true }, false)).toThrow();
    // prettier-ignore
    expect(() => parseFailureBaseline({ ...checked, baselineFingerprint: expectedFingerprint.replace(/.$/u, "0") }, false)).toThrow(/stale/u);
    // prettier-ignore
    expect(() => parseFailureBaseline({ ...checked, failureCases: checked.failureCases.slice(1) }, false)).toThrow();
    // prettier-ignore
    const reordered = { ...checked, failureCases: [...checked.failureCases].reverse() };
    // prettier-ignore
    expect(() => parseFailureBaseline(refingerprint(reordered))).toThrow(/incomplete or noncanonical/u);
  }, 120_000);
});
