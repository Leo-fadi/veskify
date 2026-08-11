export type OpenAiFailureCategory =
  | "authenticationFailed"
  | "rateLimited"
  | "timeout"
  | "cancelled"
  | "networkFailure"
  | "unavailableModel"
  | "unexpectedProviderFailure";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorIdentity(error: unknown) {
  if (!isRecord(error)) return { name: "", status: undefined, code: undefined };
  return {
    name: typeof error.name === "string" ? error.name : "",
    status: typeof error.status === "number" ? error.status : undefined,
    code: typeof error.code === "string" ? error.code : undefined,
  };
}

export function mapOpenAiFailure(error: unknown, signal?: AbortSignal): OpenAiFailureCategory {
  if (signal?.aborted) return "cancelled";
  const { name, status, code } = errorIdentity(error);
  if (name === "APIUserAbortError" || name === "AbortError") return "cancelled";
  if (name === "APIConnectionTimeoutError") return "timeout";
  if (name === "AuthenticationError" || status === 401 || status === 403) {
    return "authenticationFailed";
  }
  if (name === "RateLimitError" || status === 429) return "rateLimited";
  if (
    name === "NotFoundError" ||
    status === 404 ||
    code === "model_not_found" ||
    code === "invalid_model"
  ) {
    return "unavailableModel";
  }
  if (name === "APIConnectionError" || name === "TypeError") return "networkFailure";
  return "unexpectedProviderFailure";
}
