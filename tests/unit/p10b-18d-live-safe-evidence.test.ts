import { describe, expect, it } from "vitest";
import {
  parseP10B18DConsumedGenerationResponse,
  p10b18dSafeEvidenceFingerprint,
  serializeP10B18DSafeEvidence,
} from "../helpers/p10b-18d-live-safe-evidence";

const success = {
  ok: true,
  lineage: {
    providerId: "openai-prompted-storefront-design-intent-v2",
    modelId: "gpt-5.6-sol",
    providerCallCount: 1,
    retryCount: 0,
    materializationCount: 1,
    requestFingerprint: "request-fingerprint",
    promptFingerprint: "prompt-fingerprint",
    providerIntentFingerprint: "intent-fingerprint",
    compiledDecisionFingerprint: "compiled-fingerprint",
    synthesisFingerprint: "synthesis-fingerprint",
    structuralFingerprint: "structural-fingerprint",
    candidateSnapshotFingerprint: "candidate-fingerprint",
    protectedCommerceBeforeFingerprint: "commerce-before",
    protectedCommerceAfterFingerprint: "commerce-after",
    protectedMediaBeforeFingerprint: "media-before",
    protectedMediaAfterFingerprint: "media-after",
    rawProviderResponse: "must-not-survive",
  },
  proposal: { token: "must-not-survive" },
  reasoning: "must-not-survive",
};

describe("P10B-18D test-only safe response and evidence authority", () => {
  it("retains only consumed success fields and strips unrelated response material", () => {
    const parsed = parseP10B18DConsumedGenerationResponse(success);

    expect(parsed).not.toHaveProperty("proposal");
    expect(parsed).not.toHaveProperty("reasoning");
    expect(parsed).toMatchObject({
      ok: true,
      lineage: {
        providerId: "openai-prompted-storefront-design-intent-v2",
        modelId: "gpt-5.6-sol",
        retryCount: 0,
        materializationCount: 1,
      },
    });
    if (!parsed.ok) throw new Error("Expected the safe success projection.");
    expect(parsed.lineage).not.toHaveProperty("rawProviderResponse");
    expect(JSON.stringify(parsed)).not.toContain("must-not-survive");
  });

  it("retains only the consumed fail-closed category", () => {
    expect(
      parseP10B18DConsumedGenerationResponse({
        ok: false,
        failure: { category: "providerUnavailable", retryable: false, raw: "discard" },
        transport: { token: "discard" },
      }),
    ).toEqual({ ok: false, failure: { category: "providerUnavailable" } });
  });

  it("rejects missing or malformed consumed fields", () => {
    expect(() =>
      parseP10B18DConsumedGenerationResponse({
        ...success,
        lineage: { ...success.lineage, materializationCount: "1" },
      }),
    ).toThrow();
    expect(() =>
      parseP10B18DConsumedGenerationResponse({
        ...success,
        lineage: { ...success.lineage, structuralFingerprint: undefined },
      }),
    ).toThrow();
  });

  it("uses stable canonical serialization independent of object-key order", () => {
    expect(serializeP10B18DSafeEvidence({ b: 2, a: { d: 4, c: 3 } })).toBe(
      serializeP10B18DSafeEvidence({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it("creates a domain-separated deterministic test-only fingerprint", () => {
    const left = p10b18dSafeEvidenceFingerprint({ frame: "editorial", order: ["hero", "grid"] });
    const replay = p10b18dSafeEvidenceFingerprint({ order: ["hero", "grid"], frame: "editorial" });
    const changed = p10b18dSafeEvidenceFingerprint({ frame: "minimal", order: ["hero", "grid"] });

    expect(left).toBe(replay);
    expect(left).not.toBe(changed);
    expect(left).toMatch(/^p10b18d-safe-evidence-v1_\d+_[a-f0-9]{64}$/);
    expect(left).not.toMatch(/^(?:v1_|semantic-structure|compiled|synthesis|storefront)/);
  });

  it("rejects non-JSON evidence values instead of silently normalizing them", () => {
    expect(() => p10b18dSafeEvidenceFingerprint({ unsafe: undefined })).toThrow(
      /non-JSON evidence value/,
    );
  });
});
