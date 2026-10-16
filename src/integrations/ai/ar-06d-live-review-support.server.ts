import "server-only";

import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, parse, resolve, sep } from "node:path";
import { z } from "zod";
import {
  assertOpenAiStrictSchemaCompatibility,
  type OpenAiResponseRequestOptions,
  type OpenAiResponsesRequest,
  type OpenAiResponsesTransport,
} from "./openai/strict-output-contract";

export const AR06D_MODEL = "gpt-5.6-sol" as const;
export const AR06D_MAX_INPUT_TOKENS = 100_000 as const;
export const AR06D_MAX_REQUEST_BYTES = 524_288 as const;
export const AR06D_MAX_OUTPUT_TOKENS = 4_000 as const;
export const AR06D_TIMEOUT_MS = 120_000 as const;

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const policySchema = z
  .object({
    schemaVersion: z.literal("ar-06d-spend-policy-v2"),
    model: z.literal(AR06D_MODEL),
    expectedRequestSha256: hashSchema,
    applicableServiceTier: z.literal("default"),
    inputUsdPerMillion: z.number().finite().positive(),
    outputUsdPerMillion: z.number().finite().positive(),
    inputChargeMultiplier: z.number().finite().min(1),
    accountChargeMultiplier: z.number().finite().min(1),
    maximumFixedChargeUsd: z.number().finite().nonnegative(),
    countingCharges: z.literal("undocumented-authorized-separately"),
    generationUsdCeiling: z.literal(1),
    // These identify reviewed billing evidence, never credentials or account identifiers.
    pricingEvidenceSha256: hashSchema,
    ownerClarificationSha256: hashSchema,
  })
  .strict();

type CountInput = Pick<OpenAiResponsesRequest, "model" | "input" | "instructions" | "text">;
type CountTransport = Readonly<{
  count(
    input: CountInput,
    options: OpenAiResponseRequestOptions,
  ): Promise<{ input_tokens: number }>;
}>;
type Binding = Readonly<{ policyPath: string; taskRoot: string; expectedPolicySha256: string }>;
type GuardCode =
  | "policy-unavailable"
  | "request-mismatch"
  | "input-limit"
  | "count-limit"
  | "reservation-unavailable"
  | "count-failed"
  | "generation-failed";

export class Ar06dLiveReviewGuardError extends Error {
  constructor(readonly code: GuardCode) {
    super(code);
    this.name = "Ar06dLiveReviewGuardError";
  }
}

function sha256(bytes: string | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Resolve every component: the trusted root itself must not hide a symlink. */
function assertPlainPath(path: string, file: boolean) {
  if (!isAbsolute(path) || resolve(path) !== path) throw new Error("Invalid path");
  let current = parse(path).root;
  const parts = path.slice(current.length).split(sep).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (
      stat.isSymbolicLink() ||
      !(file && index === parts.length - 1 ? stat.isFile() : stat.isDirectory())
    )
      throw new Error("Invalid path component");
  }
}

function readPolicy(binding: Binding) {
  try {
    assertPlainPath(binding.taskRoot, false);
    if (binding.policyPath !== join(binding.taskRoot, "spend-policy-01", "policy.json"))
      throw new Error();
    assertPlainPath(binding.policyPath, true);
    const bytes = readFileSync(binding.policyPath);
    if (
      !hashSchema.safeParse(binding.expectedPolicySha256).success ||
      sha256(bytes) !== binding.expectedPolicySha256
    )
      throw new Error();
    const policy = policySchema.parse(JSON.parse(bytes.toString("utf8")));
    const generationUsd =
      ((AR06D_MAX_INPUT_TOKENS * policy.inputUsdPerMillion * policy.inputChargeMultiplier +
        AR06D_MAX_OUTPUT_TOKENS * policy.outputUsdPerMillion) /
        1_000_000) *
        policy.accountChargeMultiplier +
      policy.maximumFixedChargeUsd;
    if (!Number.isFinite(generationUsd) || generationUsd > policy.generationUsdCeiling)
      throw new Error();
    return { policy, generationUsd };
  } catch {
    throw new Ar06dLiveReviewGuardError("policy-unavailable");
  }
}

function appendRecord(root: string, name: string, value: unknown) {
  let fd: number | undefined;
  try {
    assertPlainPath(root, false);
    const directory = join(root, "live-01");
    try {
      mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    assertPlainPath(directory, false);
    fd = openSync(
      join(directory, name),
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    writeFileSync(
      fd,
      `${JSON.stringify({ recordedAt: new Date().toISOString(), ...(value as object) }, null, 2)}\n`,
    );
    fsyncSync(fd);
  } catch {
    throw new Ar06dLiveReviewGuardError("reservation-unavailable");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function freezeJson<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(freezeJson);
    Object.freeze(value);
  }
  return value;
}

function exactKeys(value: object, allowed: readonly string[], required = allowed) {
  const keys = Object.keys(value);
  return keys.every((key) => allowed.includes(key)) && required.every((key) => keys.includes(key));
}

export function inspectAr06dGenerationEnvelope(
  request: OpenAiResponsesRequest,
  options: OpenAiResponseRequestOptions,
) {
  try {
    if (
      !exactKeys(request, [
        "model",
        "input",
        "instructions",
        "store",
        "max_output_tokens",
        "text",
      ]) ||
      !exactKeys(options, ["maxRetries", "timeout", "signal"], ["maxRetries", "timeout"]) ||
      request.model !== AR06D_MODEL ||
      request.store !== false ||
      request.max_output_tokens !== AR06D_MAX_OUTPUT_TOKENS ||
      options.maxRetries !== 0 ||
      options.timeout !== AR06D_TIMEOUT_MS ||
      options.signal?.aborted ||
      typeof request.input !== "string" ||
      !request.input ||
      typeof request.instructions !== "string" ||
      !request.instructions ||
      !request.text ||
      !exactKeys(request.text, ["verbosity", "format"]) ||
      request.text.verbosity !== "low" ||
      !request.text.format ||
      !exactKeys(request.text.format, ["type", "name", "description", "strict", "schema"]) ||
      request.text.format.type !== "json_schema" ||
      request.text.format.strict !== true ||
      request.text.format.name !== "veskify_semantic_storefront_design_intent_v1" ||
      typeof request.text.format.description !== "string"
    )
      throw new Error();
    const originalSerialized = JSON.stringify(request);
    const serialized = JSON.stringify({ ...request, service_tier: "default" });
    const requestBytes = Buffer.byteLength(serialized);
    if (requestBytes > AR06D_MAX_REQUEST_BYTES) throw new Ar06dLiveReviewGuardError("input-limit");
    const frozen = freezeJson(
      JSON.parse(serialized) as OpenAiResponsesRequest & Readonly<{ service_tier: "default" }>,
    );
    assertOpenAiStrictSchemaCompatibility(frozen.text.format.schema);
    return {
      frozen,
      requestBytes,
      requestSha256: sha256(serialized),
      serialized,
      originalSerialized,
    };
  } catch (error) {
    if (error instanceof Ar06dLiveReviewGuardError) throw error;
    throw new Ar06dLiveReviewGuardError("request-mismatch");
  }
}

function safeResponseMetadata(response: unknown) {
  const record =
    response && typeof response === "object" ? (response as Record<string, unknown>) : {};
  const usage =
    record.usage && typeof record.usage === "object"
      ? (record.usage as Record<string, unknown>)
      : {};
  const count = (key: string) =>
    Number.isSafeInteger(usage[key]) && (usage[key] as number) >= 0 ? usage[key] : null;
  const serviceTier =
    typeof record.service_tier === "string" &&
    ["default", "priority", "flex", "scale"].includes(record.service_tier)
      ? record.service_tier
      : null;
  return {
    serviceTier,
    inputTokens: count("input_tokens"),
    outputTokens: count("output_tokens"),
    totalTokens: count("total_tokens"),
  };
}

/** One persistent attempt, including failures: no in-memory reset can replenish it. */
export function createAr06dLiveReviewTransport(
  input: Binding & {
    count: CountTransport;
    create: OpenAiResponsesTransport;
  },
): OpenAiResponsesTransport {
  return Object.freeze({
    async create(request: OpenAiResponsesRequest, options: OpenAiResponseRequestOptions) {
      const { policy, generationUsd } = readPolicy(input);
      const envelope = inspectAr06dGenerationEnvelope(request, options);
      if (envelope.requestSha256 !== policy.expectedRequestSha256)
        throw new Ar06dLiveReviewGuardError("request-mismatch");
      const requestOptions = Object.freeze({ ...options });
      const countInput = freezeJson({
        model: envelope.frozen.model,
        instructions: envelope.frozen.instructions,
        input: envelope.frozen.input,
        text: envelope.frozen.text,
      });
      const identity = {
        requestSha256: envelope.requestSha256,
        requestBytes: envelope.requestBytes,
        countInputSha256: sha256(JSON.stringify(countInput)),
        policySha256: input.expectedPolicySha256,
      };
      appendRecord(input.taskRoot, "count-reservation.json", {
        ...identity,
        countingCharges: policy.countingCharges,
        chargedUsd: null,
        countAttempt: 1,
        maximumCountAttempts: 2,
        retryCount: 0,
      });
      let counted: { input_tokens: number };
      try {
        counted = await input.count.count(countInput, requestOptions);
      } catch {
        appendRecord(input.taskRoot, "count-outcome.json", {
          ...identity,
          outcome: "failed-or-uncertain",
          allowanceConsumed: true,
        });
        throw new Ar06dLiveReviewGuardError("count-failed");
      }
      const valid =
        Number.isSafeInteger(counted.input_tokens) &&
        counted.input_tokens > 0 &&
        counted.input_tokens <= AR06D_MAX_INPUT_TOKENS;
      appendRecord(input.taskRoot, "count-outcome.json", {
        ...identity,
        outcome: valid ? "counted" : "rejected",
        inputTokens: Number.isSafeInteger(counted.input_tokens) ? counted.input_tokens : null,
      });
      if (!valid) throw new Ar06dLiveReviewGuardError("count-limit");
      // The original caller and policy may change across await; never send an unchecked replacement.
      readPolicy(input);
      if (
        JSON.stringify(request) !== envelope.originalSerialized ||
        options.signal?.aborted ||
        options.maxRetries !== 0 ||
        options.timeout !== AR06D_TIMEOUT_MS
      )
        throw new Ar06dLiveReviewGuardError("request-mismatch");
      appendRecord(input.taskRoot, "generation-reservation.json", {
        ...identity,
        inputTokens: counted.input_tokens,
        reservedUsd: generationUsd,
        generationUsdCeiling: policy.generationUsdCeiling,
        generationAttempt: 1,
        retryCount: 0,
        dispatchState: "reserved-before-dispatch; uncertainty-consumes-allowance",
      });
      let response: unknown;
      try {
        response = await input.create.create(envelope.frozen, requestOptions);
      } catch {
        appendRecord(input.taskRoot, "generation-outcome.json", {
          ...identity,
          outcome: "failed-or-uncertain",
          chargedUsd: null,
          conservativeReservedUsd: generationUsd,
          allowanceConsumed: true,
        });
        throw new Ar06dLiveReviewGuardError("generation-failed");
      }
      appendRecord(input.taskRoot, "generation-outcome.json", {
        ...identity,
        outcome: "response-received-not-yet-compiled",
        ...safeResponseMetadata(response),
        chargedUsd: null,
        conservativeReservedUsd: generationUsd,
        expectedServiceTier: policy.applicableServiceTier,
        allowanceConsumed: true,
      });
      return response;
    },
  });
}
