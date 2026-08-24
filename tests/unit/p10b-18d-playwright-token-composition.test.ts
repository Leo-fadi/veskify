import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY } from "../helpers/p10b-18d-live-commercial-acceptance";
import { parseP10B18DConsumedGenerationResponse } from "../helpers/p10b-18d-live-safe-evidence";
import {
  P10B18D_ACCEPTANCE_TOKEN_MINIMUM_BYTES,
  P10B18D_MOCK_TRANSPORT_ENVIRONMENT_KEY,
  P10B18D_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY,
  installP10B18DPlaywrightSessionToken,
  type P10B18DPlaywrightTransport,
} from "../helpers/p10b-18d-playwright-token-composition";

function ephemeralToken(): string {
  return randomBytes(P10B18D_ACCEPTANCE_TOKEN_MINIMUM_BYTES).toString("hex");
}

function environments(input?: {
  sourceToken?: string;
  serverToken?: string;
  workerToken?: string;
  transport?: P10B18DPlaywrightTransport;
}) {
  const sourceToken = input?.sourceToken ?? ephemeralToken();
  const serverToken = input?.serverToken ?? sourceToken;
  const transport = input?.transport ?? "mock";
  const serverEnvironment: Record<string, string | undefined> = {
    [P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY]: serverToken,
    [P10B18D_MOCK_TRANSPORT_ENVIRONMENT_KEY]: transport === "mock" ? "1" : "0",
  };
  const workerEnvironment: Record<string, string | undefined> = {
    [P10B18D_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY]: sourceToken,
  };
  if (input?.workerToken !== undefined) {
    workerEnvironment[P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY] = input.workerToken;
  }
  return { serverEnvironment, workerEnvironment };
}

const safeSuccess = {
  ok: true,
  lineage: {
    providerId: "openai-prompted-storefront-design-intent-v2",
    modelId: "mocked-p10b-16p-04-design-intent-v2",
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
  },
};

describe("P10B-18D test-only Playwright token composition", () => {
  it("installs the exact bounded server session token into the worker", () => {
    const { serverEnvironment, workerEnvironment } = environments();

    installP10B18DPlaywrightSessionToken({
      serverEnvironment,
      workerEnvironment,
      expectedTransport: "mock",
    });

    expect(
      workerEnvironment[P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY] ===
        serverEnvironment[P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY],
    ).toBe(true);
    expect(
      Buffer.byteLength(workerEnvironment[P10B18D_ACCEPTANCE_TOKEN_ENVIRONMENT_KEY] ?? "", "utf8"),
    ).toBeGreaterThanOrEqual(P10B18D_ACCEPTANCE_TOKEN_MINIMUM_BYTES);
  });

  it("fails closed when either token authority is missing or mismatched", () => {
    const missingSource = environments({ sourceToken: "" });
    expect(() =>
      installP10B18DPlaywrightSessionToken({
        ...missingSource,
        expectedTransport: "mock",
      }),
    ).toThrow(/one configured Playwright acceptance token authority/);

    const missingServer = environments({ serverToken: "" });
    expect(() =>
      installP10B18DPlaywrightSessionToken({
        ...missingServer,
        expectedTransport: "mock",
      }),
    ).toThrow(/one configured Playwright acceptance token authority/);

    const mismatch = environments({ serverToken: ephemeralToken() });
    expect(() =>
      installP10B18DPlaywrightSessionToken({ ...mismatch, expectedTransport: "mock" }),
    ).toThrow(/server and session token authorities do not match/);
  });

  it("rejects a short token and an independently generated worker token", () => {
    const short = "x".repeat(P10B18D_ACCEPTANCE_TOKEN_MINIMUM_BYTES - 1);
    const shortAuthority = environments({ sourceToken: short, serverToken: short });
    expect(() =>
      installP10B18DPlaywrightSessionToken({
        ...shortAuthority,
        expectedTransport: "mock",
      }),
    ).toThrow(/does not satisfy its contract/);

    const independentWorker = environments({ workerToken: ephemeralToken() });
    expect(() =>
      installP10B18DPlaywrightSessionToken({
        ...independentWorker,
        expectedTransport: "mock",
      }),
    ).toThrow(/worker has an independent acceptance token/);
  });

  it("keeps mock and live transport authority explicit and distinct", () => {
    for (const expectedTransport of ["mock", "live"] as const) {
      const matching = environments({ transport: expectedTransport });
      expect(() =>
        installP10B18DPlaywrightSessionToken({ ...matching, expectedTransport }),
      ).not.toThrow();

      const wrongTransport = expectedTransport === "mock" ? "live" : "mock";
      const mismatch = environments({ transport: wrongTransport });
      expect(() =>
        installP10B18DPlaywrightSessionToken({ ...mismatch, expectedTransport }),
      ).toThrow(/transport authority does not match/);
    }
  });

  it("strips token-shaped response material from the safe evidence projection", () => {
    const parsed = parseP10B18DConsumedGenerationResponse({
      ...safeSuccess,
      acceptanceToken: ephemeralToken(),
      lineage: { ...safeSuccess.lineage, acceptanceToken: ephemeralToken() },
    });

    expect(parsed).not.toHaveProperty("acceptanceToken");
    if (!parsed.ok) throw new Error("Expected the safe success projection.");
    expect(parsed.lineage).not.toHaveProperty("acceptanceToken");
  });
});
