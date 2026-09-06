// @vitest-environment node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// prettier-ignore
import { acceptedClosureCandidateFingerprint, acceptedDecisionFingerprint, acceptedLimitations, closureManifestFingerprint, closureManifestFixtureSha256, closureManifestPath, exactNextTask, exactProductOwnerDecisionText, exactStatusTransition, expectedClosureFingerprint, parseClosureManifest, readClosureManifest, type ClosureManifest } from "../helpers/p10b-19a-10c-architecture-closure";

const bytes = readFileSync(closureManifestPath);
const manifest = readClosureManifest();
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach((child) => expectDeepFrozen(child, seen));
}

describe("P10B-19A-10C checked closure manifest", () => {
  it("is strict, byte-exact, fresh-clone sufficient and deeply readonly", () => {
    expect(sha256(bytes)).toBe(closureManifestFixtureSha256);
    expect(bytes.toString("utf8")).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
    expect(manifest).toMatchObject({
      schemaVersion: "1.0.0",
      authorityKind: "p10b-19a-structural-architecture-closure",
      acceptedLimitations,
      productOwnerDecision: {
        decisionText: exactProductOwnerDecisionText,
        decisionFingerprint: acceptedDecisionFingerprint,
        acceptedClosureCandidateFingerprint,
        acceptedLimitations,
      },
      statusTransition: exactStatusTransition,
      exactNextTask,
      closureFingerprint: expectedClosureFingerprint,
    });
    expect(parseClosureManifest(Object.fromEntries(Object.entries(manifest).reverse()))).toEqual(
      manifest,
    );
    expectDeepFrozen(manifest);
  });

  it("rejects unknown or stale authority and binds every identity-bearing field", () => {
    expect(() => parseClosureManifest({ ...manifest, unknown: true })).toThrow();
    const staleSuffix = expectedClosureFingerprint.endsWith("0") ? "1" : "0";
    expect(() =>
      parseClosureManifest({
        ...manifest,
        closureFingerprint: expectedClosureFingerprint.replace(/.$/u, staleSuffix),
      }),
    ).toThrow(/stale/u);
    expect(() => parseClosureManifest({ ...manifest, productOwnerDecision: undefined })).toThrow();
    const mutations: object[] = [
      {
        ...manifest,
        predecessorAuthority: {
          ...manifest.predecessorAuthority,
          frozenByteManifestFingerprint: `${manifest.predecessorAuthority.frozenByteManifestFingerprint}0`,
        },
      },
      {
        ...manifest,
        integrationEvidence: {
          ...manifest.integrationEvidence,
          retained: { ...manifest.integrationEvidence.retained, protectedProductionHashCount: 75 },
        },
      },
      { ...manifest, acceptedLimitations: manifest.acceptedLimitations.slice(1) },
      {
        ...manifest,
        productOwnerDecision: { ...manifest.productOwnerDecision, decisionText: "rejected" },
      },
      { ...manifest, exactNextTask: "P10B-19B-02" },
    ];
    mutations.forEach((changed) =>
      expect(closureManifestFingerprint(changed)).not.toBe(manifest.closureFingerprint),
    );
    expect(closureManifestFingerprint(Object.fromEntries(Object.entries(manifest).reverse()))).toBe(
      manifest.closureFingerprint,
    );
    expect(() => parseClosureManifest(mutations[0] as ClosureManifest)).toThrow();
  });
});
