import { canonicalValueFingerprint } from "@/domain/storefront";

export type OpenAiFailureCategory =
  | "authenticationFailed"
  | "rateLimited"
  | "timeout"
  | "cancelled"
  | "networkFailure"
  | "unavailableModel"
  | "unexpectedProviderFailure";

export type OpenAiSdkErrorClass =
  | "api-user-abort"
  | "api-connection-timeout"
  | "api-connection"
  | "authentication"
  | "permission-denied"
  | "rate-limit"
  | "not-found"
  | "bad-request"
  | "conflict"
  | "unprocessable-entity"
  | "internal-server"
  | "api-error"
  | "type-error"
  | "abort-error"
  | "unknown";

export type OpenAiTransportCause =
  | "http-response"
  | "cancelled"
  | "timeout"
  | "dns"
  | "tls"
  | "connection-reset"
  | "connection-refused"
  | "socket"
  | "network"
  | "unknown";

export type SafeOpenAiTransportDiagnostic = Readonly<{
  kind: "openai-transport";
  category: OpenAiFailureCategory;
  sdkErrorClass: OpenAiSdkErrorClass;
  cause: OpenAiTransportCause;
  httpStatus?: number;
  providerCode?: string;
  providerType?: string;
  providerParam?: string;
  requestId?: string;
  retryAfterPresent: boolean;
  retryAfterSeconds?: number;
  fingerprint: string;
}>;

const providerTokenAllowlist = new Set([
  "authentication_error",
  "insufficient_quota",
  "invalid_api_key",
  "invalid_model",
  "invalid_request_error",
  "model_not_found",
  "permission_denied",
  "rate_limit_error",
  "rate_limit_exceeded",
  "request_timeout",
  "server_error",
  "service_unavailable",
]);

const sdkErrorClassByIdentity = new Map<string, OpenAiSdkErrorClass>([
  ["APIUserAbortError", "api-user-abort"],
  ["APIConnectionTimeoutError", "api-connection-timeout"],
  ["APIConnectionError", "api-connection"],
  ["AuthenticationError", "authentication"],
  ["PermissionDeniedError", "permission-denied"],
  ["RateLimitError", "rate-limit"],
  ["NotFoundError", "not-found"],
  ["BadRequestError", "bad-request"],
  ["ConflictError", "conflict"],
  ["UnprocessableEntityError", "unprocessable-entity"],
  ["InternalServerError", "internal-server"],
  ["APIError", "api-error"],
  ["TypeError", "type-error"],
  ["AbortError", "abort-error"],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function safeProviderToken(value: unknown): string | undefined {
  return typeof value === "string" && providerTokenAllowlist.has(value) ? value : undefined;
}

const safeProviderParamPattern =
  /^[A-Za-z_$][A-Za-z0-9_$-]*(?:\.(?:[A-Za-z_$][A-Za-z0-9_$-]*|[0-9]{1,5})|\[(?:0|[1-9][0-9]{0,4})\])*$/;

function safeProviderParam(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 200 && safeProviderParamPattern.test(value)
    ? value
    : undefined;
}

function safeRequestId(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{7,199}$/.test(value)
    ? value
    : undefined;
}

function safeStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

function isHeaderReader(value: unknown): value is Readonly<{ get(name: string): unknown }> {
  return isRecord(value) && typeof value.get === "function";
}

function headerValue(headers: unknown, name: "retry-after" | "x-request-id"): string | null {
  if (!isHeaderReader(headers)) return null;
  try {
    const value = headers.get(name);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (value === null || !/^\d{1,4}(?:\.\d{1,3})?$/.test(value)) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 3_600 ? seconds : undefined;
}

function errorIdentity(error: unknown) {
  if (!isRecord(error)) {
    return {
      name: "",
      constructorName: "",
      status: undefined,
      code: undefined,
      type: undefined,
      param: undefined,
      requestId: undefined,
      headers: undefined,
      causeCode: undefined,
    };
  }
  const cause = isRecord(error.cause) ? error.cause : undefined;
  return {
    name: stringField(error, "name") ?? "",
    // OpenAI SDK 6.x subclasses preserve constructor identity but inherit Error.name.
    constructorName:
      typeof error.constructor === "function" && typeof error.constructor.name === "string"
        ? error.constructor.name
        : "",
    status: safeStatus(error.status),
    code: stringField(error, "code"),
    type: stringField(error, "type"),
    param: stringField(error, "param"),
    requestId: stringField(error, "requestID"),
    headers: error.headers,
    causeCode: cause ? stringField(cause, "code") : undefined,
  };
}

function sdkErrorClass(name: string, constructorName: string): OpenAiSdkErrorClass {
  return (
    sdkErrorClassByIdentity.get(constructorName) ?? sdkErrorClassByIdentity.get(name) ?? "unknown"
  );
}

function connectionCause(code: string | undefined): OpenAiTransportCause | undefined {
  if (!code) return undefined;
  if (
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT"
  ) {
    return "timeout";
  }
  if (code === "ECONNRESET") return "connection-reset";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns";
  if (code === "ECONNREFUSED") return "connection-refused";
  if (code === "UND_ERR_SOCKET") return "socket";
  if (
    code.startsWith("ERR_TLS_") ||
    code.startsWith("CERT_") ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  ) {
    return "tls";
  }
  return undefined;
}

function categoryFor(
  identity: ReturnType<typeof errorIdentity>,
  signal?: AbortSignal,
): OpenAiFailureCategory {
  if (signal?.aborted) return "cancelled";
  const { name, constructorName, status, code } = identity;
  const hasIdentity = (candidate: string) => name === candidate || constructorName === candidate;
  if (hasIdentity("APIUserAbortError") || hasIdentity("AbortError")) return "cancelled";
  if (hasIdentity("APIConnectionTimeoutError")) return "timeout";
  if (hasIdentity("AuthenticationError") || status === 401 || status === 403) {
    return "authenticationFailed";
  }
  if (hasIdentity("RateLimitError") || status === 429) return "rateLimited";
  if (
    hasIdentity("NotFoundError") ||
    status === 404 ||
    code === "model_not_found" ||
    code === "invalid_model"
  ) {
    return "unavailableModel";
  }
  if (hasIdentity("APIConnectionError") || hasIdentity("TypeError")) return "networkFailure";
  return "unexpectedProviderFailure";
}

function causeFor(input: {
  category: OpenAiFailureCategory;
  status?: number;
  causeCode?: string;
}): OpenAiTransportCause {
  if (input.status !== undefined) return "http-response";
  if (input.category === "cancelled") return "cancelled";
  if (input.category === "timeout") return "timeout";
  const concreteConnectionCause = connectionCause(input.causeCode);
  if (concreteConnectionCause) return concreteConnectionCause;
  if (input.category === "networkFailure") return "network";
  return "unknown";
}

export function inspectOpenAiFailure(
  error: unknown,
  signal?: AbortSignal,
): Readonly<{
  category: OpenAiFailureCategory;
  diagnostic: SafeOpenAiTransportDiagnostic;
}> {
  const identity = errorIdentity(error);
  const category = categoryFor(identity, signal);
  const retryAfter = headerValue(identity.headers, "retry-after");
  const providerCode = safeProviderToken(identity.code);
  const providerType = safeProviderToken(identity.type);
  const providerParam = safeProviderParam(identity.param);
  const requestId =
    safeRequestId(identity.requestId) ??
    safeRequestId(headerValue(identity.headers, "x-request-id"));
  const boundedRetryAfterSeconds = retryAfterSeconds(retryAfter);
  const material = {
    kind: "openai-transport" as const,
    category,
    sdkErrorClass: sdkErrorClass(identity.name, identity.constructorName),
    cause: causeFor({ category, status: identity.status, causeCode: identity.causeCode }),
    ...(identity.status === undefined ? {} : { httpStatus: identity.status }),
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(providerType === undefined ? {} : { providerType }),
    ...(providerParam === undefined ? {} : { providerParam }),
    ...(requestId === undefined ? {} : { requestId }),
    retryAfterPresent: retryAfter !== null,
    ...(boundedRetryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: boundedRetryAfterSeconds }),
  };
  return {
    category,
    diagnostic: Object.freeze({
      ...material,
      fingerprint: `openai-transport-${canonicalValueFingerprint(material)}`,
    }),
  };
}

export function mapOpenAiFailure(error: unknown, signal?: AbortSignal): OpenAiFailureCategory {
  return inspectOpenAiFailure(error, signal).category;
}
