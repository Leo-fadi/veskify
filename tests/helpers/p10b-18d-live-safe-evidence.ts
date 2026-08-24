import { createHash } from "node:crypto";
import { z } from "zod";
import {
  P10B18D_ACCEPTANCE_PROJECT_ID,
  P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION,
} from "./p10b-18d-live-commercial-acceptance";

const consumedSuccessLineageSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  providerCallCount: z.number().int().positive(),
  retryCount: z.number().int().nonnegative(),
  materializationCount: z.number().int().positive(),
  requestFingerprint: z.string().min(1),
  promptFingerprint: z.string().min(1),
  providerIntentFingerprint: z.string().min(1),
  compiledDecisionFingerprint: z.string().min(1),
  synthesisFingerprint: z.string().min(1),
  structuralFingerprint: z.string().min(1),
  candidateSnapshotFingerprint: z.string().min(1),
  protectedCommerceBeforeFingerprint: z.string().min(1),
  protectedCommerceAfterFingerprint: z.string().min(1),
  protectedMediaBeforeFingerprint: z.string().min(1),
  protectedMediaAfterFingerprint: z.string().min(1),
});

const consumedGenerationResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    lineage: consumedSuccessLineageSchema,
  }),
  z.object({
    ok: z.literal(false),
    failure: z.object({ category: z.string().min(1) }),
  }),
]);

export type P10B18DConsumedGenerationResponse = z.infer<typeof consumedGenerationResponseSchema>;

/**
 * Parses only the allowlisted route-response fields consumed by the P10B-18D
 * evidence runner. This is not the complete production response contract.
 */
export function parseP10B18DConsumedGenerationResponse(
  value: unknown,
): P10B18DConsumedGenerationResponse {
  return consumedGenerationResponseSchema.parse(value);
}

const acceptanceCaseEvidenceSchema = z.object({
  caseNumber: z.number().int().min(1).max(P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION),
  providerId: z.literal("openai-prompted-storefront-design-intent-v2"),
  modelId: z.string().min(1),
  providerCallCount: z.number().int().min(1).max(P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION),
  retryCount: z.literal(0),
  requestFingerprint: z.string().min(1),
  promptFingerprint: z.string().min(1),
  intentFingerprint: z.string().min(1),
  compiledDecisionFingerprint: z.string().min(1),
  synthesisFingerprint: z.string().min(1),
  structuralFingerprint: z.string().min(1),
  candidateSnapshotFingerprint: z.string().min(1),
  currentAuthorityFingerprints: z.array(z.string().min(1)).min(1),
  materializationAuthorityFingerprint: z.string().min(1),
  protectedCommerceBeforeFingerprint: z.string().min(1),
  protectedCommerceAfterFingerprint: z.string().min(1),
  protectedMediaBeforeFingerprint: z.string().min(1),
  protectedMediaAfterFingerprint: z.string().min(1),
  protectedCommerce: z.literal("unchanged"),
  canonicalProductMedia: z.literal("unchanged"),
  materializationCount: z.literal(1),
  providerInputFingerprint: z.string().min(1),
  providerWireIntentFingerprint: z.string().min(1),
  providerSchemaFingerprint: z.string().min(1),
  providerRequestEnvelopeFingerprint: z.string().min(1),
  providerRequestFingerprint: z.string().min(1),
  sdkTransportEntryCount: z.literal(1),
  durationMs: z.number().nonnegative(),
  inputTokens: z.number().nonnegative().optional(),
  outputTokens: z.number().nonnegative().optional(),
  totalTokens: z.number().nonnegative().optional(),
  selection: z.record(z.string(), z.unknown()),
});

const acceptanceInspectionSchema = z.object({
  namespace: z.literal("p10b-16p-04-real-studio-design-intent-v2-acceptance"),
  projectId: z.literal(P10B18D_ACCEPTANCE_PROJECT_ID),
  callBudget: z.literal(P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION),
  providerCallCount: z.number().int().min(0).max(P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION),
  retryCount: z.literal(0),
  status: z.enum(["ready", "calling", "failed", "complete"]),
  failureClassification: z.string().nullable(),
  activeAttempt: z.unknown().nullable(),
  failedAttempt: z.unknown().nullable(),
  provider: z.object({
    providerId: z.literal("openai-prompted-storefront-design-intent-v2"),
    modelId: z.string().min(1).nullable(),
    category: z.string().min(1),
    credentialsAvailable: z.boolean(),
    timeoutMs: z.number().positive().nullable(),
    boundedTimeout: z.boolean(),
    retryCount: z.literal(0),
  }),
  selectedTransport: z.object({
    kind: z.enum(["mock", "openai"]),
    providerId: z.literal("openai-prompted-storefront-design-intent-v2"),
    modelId: z.string().min(1),
  }),
  cases: z.array(acceptanceCaseEvidenceSchema).max(P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION),
});

const acceptanceInspectionResponseSchema = z.object({
  ok: z.literal(true),
  acceptance: acceptanceInspectionSchema,
});

export type P10B18DAcceptanceInspection = z.infer<typeof acceptanceInspectionSchema>;

/** Parses the bounded P04 inspection wrapper and returns only consumed safe authority. */
export function parseP10B18DAcceptanceInspectionResponse(
  value: unknown,
): P10B18DAcceptanceInspection {
  return acceptanceInspectionResponseSchema.parse(value).acceptance;
}

type SafeEvidenceJsonPrimitive = null | boolean | number | string;

type SafeEvidenceJsonArray = readonly SafeEvidenceJson[];

interface SafeEvidenceJsonObject {
  readonly [key: string]: SafeEvidenceJson;
}

type SafeEvidenceJson = SafeEvidenceJsonPrimitive | SafeEvidenceJsonArray | SafeEvidenceJsonObject;

function canonicalSafeEvidenceValue(value: unknown, path = "$safeEvidence"): SafeEvidenceJson {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number.`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => canonicalSafeEvidenceValue(entry, `${path}[${index}]`));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalSafeEvidenceValue(entry, `${path}.${key}`)]),
    );
  }
  throw new Error(`${path} contains a non-JSON evidence value.`);
}

export function serializeP10B18DSafeEvidence(value: unknown): string {
  return JSON.stringify(canonicalSafeEvidenceValue(value));
}

export function p10b18dSafeEvidenceFingerprint(value: unknown): string {
  const serialized = serializeP10B18DSafeEvidence(value);
  const digest = createHash("sha256")
    .update("p10b18d-safe-evidence-v1\0", "utf8")
    .update(serialized, "utf8")
    .digest("hex");
  return `p10b18d-safe-evidence-v1_${Buffer.byteLength(serialized, "utf8")}_${digest}`;
}
