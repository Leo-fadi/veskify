export type StorefrontDiagnosticStage =
  | "submission_received"
  | "command_build_started"
  | "command_build_completed"
  | "request_started"
  | "response_received"
  | "response_decoding_started"
  | "response_decoding_completed"
  | "acceptance_coordinator_started"
  | "proposal_state_completed"
  | "request_received"
  | "request_validation_completed"
  | "provider_invocation_started"
  | "provider_invocation_completed"
  | "provider_response_parsed"
  | "normalization_completed"
  | "proposal_schema_validated"
  | "proposal_compiled"
  | "protected_state_validated"
  | "response_completed";

export type StorefrontDiagnosticCategory =
  | "success"
  | "client_command_build"
  | "client_request"
  | "client_response"
  | "client_response_decode"
  | "client_acceptance_coordinator"
  | "unknown_client_failure"
  | "validation"
  | "stale"
  | "staleDraft"
  | "staleTarget"
  | "unsupportedRequest"
  | "providerFailure"
  | "superseded"
  | "permissionDenied"
  | "projectMismatch"
  | "tenantMismatch"
  | "providerUnavailable"
  | "malformedResponse"
  | "internalFailure";

export type StorefrontDiagnosticRecord = Readonly<{
  attemptId: string;
  projectId: string;
  scope: "storefront";
  stage: StorefrontDiagnosticStage;
  category: StorefrontDiagnosticCategory;
  status?: number;
  timestamp: string;
}>;

export function createStorefrontDiagnosticAttemptId() {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `attempt_${suffix}`;
}

/** Records only a safe, metadata-only diagnostic. Prompts, provider payloads and credentials are excluded. */
export function recordStorefrontDiagnostic(
  input: Omit<StorefrontDiagnosticRecord, "timestamp">,
): StorefrontDiagnosticRecord {
  const record = {
    ...input,
    timestamp: new Date().toISOString(),
  } satisfies StorefrontDiagnosticRecord;
  console.info("veskify-storefront-diagnostic", JSON.stringify(record));
  return record;
}
