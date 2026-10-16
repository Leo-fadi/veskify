// @vitest-environment node
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  createAr06dLiveReviewTransport,
  AR06D_MODEL,
  AR06D_TIMEOUT_MS,
} from "@/integrations/ai/ar-06d-live-review-support.server";

import type {
  OpenAiResponsesRequest,
  OpenAiResponseRequestOptions,
  OpenAiResponsesTransport,
} from "@/integrations/ai/openai/strict-output-contract";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const request = () => ({
  model: AR06D_MODEL,
  instructions: "fixed",
  input: "fixed",
  store: false as const,
  max_output_tokens: 4000,
  text: {
    verbosity: "low" as const,
    format: {
      type: "json_schema" as const,
      name: "veskify_semantic_storefront_design_intent_v1",
      description: "controlled schema",
      strict: true as const,
      schema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
        additionalProperties: false,
      },
    },
  },
});
const options = { maxRetries: 0 as const, timeout: AR06D_TIMEOUT_MS };

function setup(overrides: Record<string, unknown> = {}, envelope = request()) {
  const taskRoot = mkdtempSync(join(realpathSync(tmpdir()), "ar06d-guard-"));
  mkdirSync(join(taskRoot, "spend-policy-01"));
  const policyPath = join(taskRoot, "spend-policy-01/policy.json");
  // Synthetic billing fixture only. These values do not establish actual account pricing.
  const policy = {
    schemaVersion: "ar-06d-spend-policy-v2",
    model: AR06D_MODEL,
    expectedRequestSha256: hash(JSON.stringify({ ...envelope, service_tier: "default" })),
    applicableServiceTier: "default",
    inputUsdPerMillion: 4,
    outputUsdPerMillion: 20,
    inputChargeMultiplier: 1.25,
    accountChargeMultiplier: 1,
    maximumFixedChargeUsd: 0,
    countingCharges: "undocumented-authorized-separately",
    generationUsdCeiling: 1,
    pricingEvidenceSha256: "1".repeat(64),
    ownerClarificationSha256: "2".repeat(64),
    ...overrides,
  };
  const bytes = JSON.stringify(policy);
  writeFileSync(policyPath, bytes, { flag: "wx" });
  const binding = { policyPath, taskRoot, expectedPolicySha256: hash(bytes) };
  const count = vi
    .fn<
      (
        body: Pick<OpenAiResponsesRequest, "model" | "input" | "instructions" | "text">,
        options: OpenAiResponseRequestOptions,
      ) => Promise<{ input_tokens: number }>
    >()
    .mockResolvedValue({ input_tokens: 7 });
  const create = vi.fn<OpenAiResponsesTransport["create"]>().mockResolvedValue({
    usage: { input_tokens: 7, output_tokens: 5, total_tokens: 12 },
    service_tier: "default",
  });
  const transport = () =>
    createAr06dLiveReviewTransport({ ...binding, count: { count }, create: { create } });
  return {
    binding,
    count,
    create,
    transport,
    envelope,
    record: (name: string) =>
      JSON.parse(readFileSync(join(taskRoot, `live-01/${name}.json`), "utf8")) as unknown,
  };
}

describe("AR-06D persistent one-attempt guard (synthetic billing)", () => {
  it("reserves before exact counting and generation; retains only safe usage and identities", async () => {
    const f = setup();
    f.count.mockImplementation((body) => {
      expect(f.record("count-reservation")).toMatchObject({
        countAttempt: 1,
        retryCount: 0,
        countingCharges: "undocumented-authorized-separately",
        chargedUsd: null,
      });
      expect(body).toEqual({
        model: f.envelope.model,
        instructions: f.envelope.instructions,
        input: f.envelope.input,
        text: f.envelope.text,
      });
      expect(Object.isFrozen(body.text.format.schema)).toBe(true);
      return Promise.resolve({ input_tokens: 7 });
    });
    f.create.mockImplementation((body) => {
      expect(f.record("generation-reservation")).toMatchObject({
        generationAttempt: 1,
        inputTokens: 7,
      });
      expect(body).toEqual({ ...f.envelope, service_tier: "default" });
      expect(Object.isFrozen(body.text.format.schema)).toBe(true);
      return Promise.resolve({
        output_text: "private reasoning must never be retained",
        usage: { input_tokens: 7, output_tokens: 5, total_tokens: 12 },
        service_tier: "default",
      });
    });
    await f.transport().create(f.envelope, options);
    const result = f.record("generation-outcome");
    expect(result).toMatchObject({
      outcome: "response-received-not-yet-compiled",
      inputTokens: 7,
      outputTokens: 5,
      chargedUsd: null,
    });
    expect(JSON.stringify(result)).not.toContain("private reasoning");
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "reservation-unavailable",
    });
    expect(f.count).toHaveBeenCalledTimes(1);
    expect(f.create).toHaveBeenCalledTimes(1);
  });

  it("allows only one concurrent call and keeps an uncertain count consumed", async () => {
    const f = setup();
    let rejectCount: (reason: Error) => void = () => {};
    f.count.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCount = reject;
        }),
    );
    const first = f.transport().create(f.envelope, options);
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "reservation-unavailable",
    });
    rejectCount(new Error("private transport detail"));
    await expect(first).rejects.toMatchObject({ code: "count-failed" });
    expect(f.record("count-outcome")).toMatchObject({
      outcome: "failed-or-uncertain",
      allowanceConsumed: true,
    });
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "reservation-unavailable",
    });
    expect(f.count).toHaveBeenCalledTimes(1);
    expect(f.create).not.toHaveBeenCalled();
  });

  it.each([0, -1, 100001, 1.5, NaN])(
    "rejects invalid/over-limit official counts %s",
    async (input_tokens) => {
      const f = setup();
      f.count.mockResolvedValue({ input_tokens });
      await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
        code: "count-limit",
      });
      expect(f.create).not.toHaveBeenCalled();
    },
  );

  it("rejects an altered caller envelope after counting without dispatch", async () => {
    const f = setup();
    f.count.mockImplementation(() => {
      f.envelope.text.format.schema.properties.value.type = "number";
      return Promise.resolve({ input_tokens: 7 });
    });
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "request-mismatch",
    });
    expect(f.create).not.toHaveBeenCalled();
  });

  it("rejects policy changes while counting", async () => {
    const f = setup();
    f.count.mockImplementation(() => {
      writeFileSync(f.binding.policyPath, "{}");
      return Promise.resolve({ input_tokens: 7 });
    });
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "policy-unavailable",
    });
    expect(f.create).not.toHaveBeenCalled();
  });

  it("records uncertain generation, never retries and never claims zero usage", async () => {
    const f = setup();
    f.create.mockRejectedValue(new Error("private upstream detail"));
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "generation-failed",
    });
    expect(f.record("generation-outcome")).toMatchObject({
      outcome: "failed-or-uncertain",
      chargedUsd: null,
      allowanceConsumed: true,
    });
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "reservation-unavailable",
    });
    expect(f.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    { generationUsdCeiling: 2 },
    { inputUsdPerMillion: 0 },
    { outputUsdPerMillion: 0 },
    { countingCharges: "free" },
    { maximumFixedChargeUsd: 0.5 },
    { accountChargeMultiplier: 0.5 },
    { applicableServiceTier: "unknown" },
    { ownerClarificationSha256: "" },
    { expectedRequestSha256: "bad" },
    { unexpectedReservationPath: "/elsewhere" },
  ])("rejects unsupported billing policy before any call: %j", async (override) => {
    const f = setup(override);
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "policy-unavailable",
    });
    expect(f.count).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });

  it.each(["", "/missing", "relative"])(
    "fails closed for unbound policy %s",
    async (policyPath) => {
      const f = setup();
      f.binding.policyPath = policyPath;
      await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
        code: "policy-unavailable",
      });
      expect(f.count).not.toHaveBeenCalled();
    },
  );

  it.each([
    { model: "other-model" },
    { store: true },
    { max_output_tokens: 4001 },
    { tools: [{ type: "web_search" }] },
    { service_tier: "default" },
    { input: "changed" },
    { text: { format: { strict: false } } },
  ])("rejects changed, expanded or unpinned request %j", async (override) => {
    const f = setup();
    await expect(
      f.transport().create({ ...f.envelope, ...override } as never, options),
    ).rejects.toMatchObject({ code: "request-mismatch" });
    expect(f.count).not.toHaveBeenCalled();
  });

  it("enforces request bytes and retries/timeout before counting", async () => {
    const f = setup();
    await expect(
      f.transport().create({ ...f.envelope, input: "a".repeat(524288) }, options),
    ).rejects.toMatchObject({ code: "input-limit" });
    for (const changed of [
      { maxRetries: 1, timeout: 120000 },
      { maxRetries: 0, timeout: 120001 },
    ]) {
      await expect(f.transport().create(f.envelope, changed as never)).rejects.toMatchObject({
        code: "request-mismatch",
      });
    }
    expect(f.count).not.toHaveBeenCalled();
  });

  it("rejects root and output symlinks without writing to their targets", async () => {
    const f = setup();
    const other = mkdtempSync(join(realpathSync(tmpdir()), "ar06d-outside-"));
    symlinkSync(other, join(f.binding.taskRoot, "live-01"));
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "reservation-unavailable",
    });
    const alias = join(other, "alias");
    symlinkSync(f.binding.taskRoot, alias);
    f.binding.taskRoot = alias;
    f.binding.policyPath = join(alias, "spend-policy-01/policy.json");
    await expect(f.transport().create(f.envelope, options)).rejects.toMatchObject({
      code: "policy-unavailable",
    });
    expect(f.count).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });
});
