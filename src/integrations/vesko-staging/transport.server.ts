import "server-only";

import { randomUUID } from "node:crypto";

const defaultTimeoutMs = 15_000;
const minimumTimeoutMs = 1_000;
const maximumTimeoutMs = 120_000;
const authorizationRefreshSkewMs = 15_000;

const headerNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const operationPattern = /^[a-z][a-z0-9-]{0,79}$/;

export type VeskoStagingFailureCode =
  | "authenticationUnavailable"
  | "permissionDenied"
  | "resourceNotFound"
  | "staleRevision"
  | "rateLimited"
  | "malformedResponse"
  | "timeout"
  | "requestAborted"
  | "stagingUnavailable"
  | "configurationUnavailable";

const failureMessages: Readonly<Record<VeskoStagingFailureCode, string>> = {
  authenticationUnavailable: "Vesko staging authentication is temporarily unavailable.",
  permissionDenied: "The staging identity is not permitted to perform this operation.",
  resourceNotFound: "The requested Vesko staging resource was not found.",
  staleRevision: "The Vesko staging resource changed before this operation completed.",
  rateLimited: "Vesko staging is temporarily rate limited.",
  malformedResponse: "Vesko staging returned an invalid response.",
  timeout: "The Vesko staging request timed out.",
  requestAborted: "The Vesko staging request was cancelled.",
  stagingUnavailable: "Vesko staging is temporarily unavailable.",
  configurationUnavailable: "Vesko staging configuration is unavailable or invalid.",
};

/** A safe, transport-facing failure that intentionally excludes backend bodies and credentials. */
export class VeskoStagingTransportError extends Error {
  constructor(
    readonly code: VeskoStagingFailureCode,
    readonly status?: number,
  ) {
    super(failureMessages[code]);
    this.name = "VeskoStagingTransportError";
  }
}

export type VeskoStagingAuthenticationErrorCode = "authenticationUnavailable" | "permissionDenied";

export class VeskoStagingAuthenticationError extends Error {
  constructor(readonly code: VeskoStagingAuthenticationErrorCode) {
    super(failureMessages[code]);
    this.name = "VeskoStagingAuthenticationError";
  }
}

export type VeskoStagingEnvironment = Readonly<Record<string, string | undefined>>;

export type VeskoStagingConfiguration = Readonly<{
  baseUrl: URL;
  authentication: Readonly<{ required: boolean; kind: "injected" }>;
  tenantId?: string;
  environmentId?: string;
  timeoutMs: number;
  correlationHeaderName?: string;
  revisionHeaderName?: string;
}>;

function configurationError(): VeskoStagingTransportError {
  return new VeskoStagingTransportError("configurationUnavailable");
}

function optionalIdentifier(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const identifier = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(identifier)) throw configurationError();
  return identifier;
}

function optionalHeaderName(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const headerName = value.trim();
  if (!headerNamePattern.test(headerName)) throw configurationError();
  return headerName;
}

function booleanConfiguration(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw configurationError();
}

function timeoutConfiguration(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return defaultTimeoutMs;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < minimumTimeoutMs || timeout > maximumTimeoutMs) {
    throw configurationError();
  }
  return timeout;
}

/**
 * Reads only non-secret staging settings. Credentials remain behind the injected
 * authentication provider because the repository does not define a Vesko auth protocol yet.
 */
export function readVeskoStagingConfiguration(
  environment: VeskoStagingEnvironment = process.env,
): VeskoStagingConfiguration {
  const baseUrlValue = environment.VESKO_STAGING_BASE_URL?.trim();
  if (!baseUrlValue) throw configurationError();

  let baseUrl: URL;
  try {
    baseUrl = new URL(baseUrlValue);
  } catch {
    throw configurationError();
  }
  if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password || baseUrl.search) {
    throw configurationError();
  }
  if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname = `${baseUrl.pathname}/`;

  return Object.freeze({
    baseUrl,
    authentication: Object.freeze({
      required: booleanConfiguration(environment.VESKO_STAGING_AUTH_REQUIRED, true),
      kind: "injected",
    }),
    tenantId: optionalIdentifier(environment.VESKO_STAGING_TENANT_ID),
    environmentId: optionalIdentifier(environment.VESKO_STAGING_ENVIRONMENT_ID),
    timeoutMs: timeoutConfiguration(environment.VESKO_STAGING_TIMEOUT_MS),
    correlationHeaderName: optionalHeaderName(environment.VESKO_STAGING_CORRELATION_HEADER),
    revisionHeaderName: optionalHeaderName(environment.VESKO_STAGING_REVISION_HEADER),
  });
}

export type VeskoStagingAuthorization = Readonly<{
  headers: Readonly<Record<string, string>>;
  /** Epoch milliseconds. Omit when the backend does not expose token expiry. */
  expiresAt?: number;
}>;

export type VeskoStagingAuthorizationRequest = Readonly<{ signal?: AbortSignal }>;

/**
 * Protocol-neutral boundary for the environment-owned Vesko authentication implementation.
 * The provider returns request headers rather than exposing an access token format to consumers.
 */
export interface VeskoStagingAuthenticationProvider {
  authorize(input: VeskoStagingAuthorizationRequest): Promise<VeskoStagingAuthorization>;
}

export type VeskoStagingAuthorizationSource = Readonly<{
  obtain(input: VeskoStagingAuthorizationRequest): Promise<VeskoStagingAuthorization>;
  refresh?(input: VeskoStagingAuthorizationRequest): Promise<VeskoStagingAuthorization>;
  now?: () => number;
  refreshSkewMs?: number;
}>;

function validatedAuthorization(value: VeskoStagingAuthorization): VeskoStagingAuthorization {
  const headers = Object.entries(value.headers);
  if (headers.length === 0) throw new VeskoStagingAuthenticationError("authenticationUnavailable");
  if (
    headers.some(
      ([name, headerValue]) =>
        !headerNamePattern.test(name) || headerValue.trim() === "" || /[\r\n]/.test(headerValue),
    )
  ) {
    throw new VeskoStagingAuthenticationError("authenticationUnavailable");
  }
  if (
    value.expiresAt !== undefined &&
    (!Number.isFinite(value.expiresAt) || value.expiresAt <= 0)
  ) {
    throw new VeskoStagingAuthenticationError("authenticationUnavailable");
  }
  return Object.freeze({
    headers: Object.freeze(Object.fromEntries(headers)),
    expiresAt: value.expiresAt,
  });
}

/**
 * Adds safe caching and refresh selection to an injected protocol implementation.
 * It never logs, parses, or otherwise exposes credential values.
 */
export function createVeskoStagingAuthorizationProvider(
  source: VeskoStagingAuthorizationSource,
): VeskoStagingAuthenticationProvider {
  const now = source.now ?? Date.now;
  const refreshSkewMs = source.refreshSkewMs ?? authorizationRefreshSkewMs;
  let cached: VeskoStagingAuthorization | undefined;

  return {
    async authorize(input) {
      if (cached?.expiresAt === undefined || cached.expiresAt > now() + refreshSkewMs) {
        if (cached !== undefined) return cached;
      }
      try {
        const authorization = await (cached !== undefined && source.refresh !== undefined
          ? source.refresh(input)
          : source.obtain(input));
        cached = validatedAuthorization(authorization);
        return cached;
      } catch (error) {
        if (error instanceof VeskoStagingAuthenticationError) throw error;
        throw new VeskoStagingAuthenticationError("authenticationUnavailable");
      }
    },
  };
}

export type VeskoStagingHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type VeskoStagingTransportRequest = Readonly<{
  operation: string;
  method: VeskoStagingHttpMethod;
  /** Relative route supplied by a documented P10 adapter; absolute URLs are rejected. */
  route: string;
  headers?: Readonly<Record<string, string>>;
  body?: string;
  expectedStatuses?: readonly number[];
  signal?: AbortSignal;
  correlationId?: string;
  response: "json" | "empty";
}>;

export type VeskoStagingTransportResponse = Readonly<{
  status: number;
  data?: unknown;
  etag?: string;
  revision?: string;
  correlationId: string;
}>;

export type VeskoStagingLogEvent = Readonly<{
  operation: string;
  method: VeskoStagingHttpMethod;
  route: string;
  status?: number;
  durationMs: number;
  correlationId: string;
  errorCategory?: VeskoStagingFailureCode;
}>;

export interface VeskoStagingTransportLogger {
  log(event: VeskoStagingLogEvent): void;
}

export type VeskoStagingFetch = (
  input: URL,
  init: Readonly<{
    method: VeskoStagingHttpMethod;
    headers: Headers;
    body?: string;
    signal: AbortSignal;
  }>,
) => Promise<Response>;

export interface VeskoStagingTransport {
  authenticate(input?: VeskoStagingAuthorizationRequest): Promise<void>;
  request(input: VeskoStagingTransportRequest): Promise<VeskoStagingTransportResponse>;
}

export type VeskoStagingTransportDependencies = Readonly<{
  configuration: VeskoStagingConfiguration;
  authentication?: VeskoStagingAuthenticationProvider;
  fetch?: VeskoStagingFetch;
  logger?: VeskoStagingTransportLogger;
  now?: () => number;
  createCorrelationId?: () => string;
}>;

function relativeUrl(baseUrl: URL, route: string): URL {
  if (!route.startsWith("/") || route.startsWith("//") || /[\r\n]/.test(route)) {
    throw new VeskoStagingTransportError("configurationUnavailable");
  }
  try {
    const url = new URL(route.slice(1), baseUrl);
    if (url.origin !== baseUrl.origin) throw configurationError();
    return url;
  } catch (error) {
    if (error instanceof VeskoStagingTransportError) throw error;
    throw configurationError();
  }
}

function sanitizedRoute(route: string): string {
  const pathname = route.split("?", 1)[0] ?? "/";
  return pathname
    .split("/")
    .map((segment) => (/^[a-z][a-z0-9-]{0,39}$/.test(segment) ? segment : segment ? ":id" : ""))
    .join("/");
}

function statusFailure(status: number): VeskoStagingTransportError {
  if (status === 401) return new VeskoStagingTransportError("authenticationUnavailable", status);
  if (status === 403) return new VeskoStagingTransportError("permissionDenied", status);
  if (status === 404) return new VeskoStagingTransportError("resourceNotFound", status);
  if (status === 409 || status === 412)
    return new VeskoStagingTransportError("staleRevision", status);
  if (status === 429) return new VeskoStagingTransportError("rateLimited", status);
  return new VeskoStagingTransportError("stagingUnavailable", status);
}

function normalizedFailure(error: unknown, timedOut: boolean, externallyAborted: boolean) {
  if (error instanceof VeskoStagingTransportError) return error;
  if (error instanceof VeskoStagingAuthenticationError) {
    return new VeskoStagingTransportError(error.code);
  }
  if (timedOut) return new VeskoStagingTransportError("timeout");
  if (externallyAborted) return new VeskoStagingTransportError("requestAborted");
  return new VeskoStagingTransportError("stagingUnavailable");
}

function expectedStatus(status: number, expectedStatuses: readonly number[] | undefined): boolean {
  return expectedStatuses?.includes(status) ?? (status >= 200 && status < 300);
}

function requestHeaders(
  authorization: VeskoStagingAuthorization | undefined,
  input: VeskoStagingTransportRequest,
  correlationHeaderName: string | undefined,
  correlationId: string,
): Headers {
  const headers = new Headers(input.headers);
  if (authorization !== undefined) {
    Object.entries(authorization.headers).forEach(([name, value]) => headers.set(name, value));
  }
  if (correlationHeaderName !== undefined) headers.set(correlationHeaderName, correlationId);
  return headers;
}

function validateRequest(input: VeskoStagingTransportRequest): void {
  if (!operationPattern.test(input.operation))
    throw new VeskoStagingTransportError("configurationUnavailable");
  if (
    input.expectedStatuses !== undefined &&
    (input.expectedStatuses.length === 0 ||
      input.expectedStatuses.some(
        (status) => !Number.isInteger(status) || status < 100 || status > 599,
      ))
  ) {
    throw new VeskoStagingTransportError("configurationUnavailable");
  }
}

/**
 * Shared server-only transport for future documented Vesko staging adapters. It deliberately has
 * no endpoint-specific routes or payload schemas and never retries a request.
 */
export function createVeskoStagingTransport(
  dependencies: VeskoStagingTransportDependencies,
): VeskoStagingTransport {
  const fetchImplementation = dependencies.fetch ?? ((input, init) => fetch(input, init));
  const now = dependencies.now ?? Date.now;
  const createCorrelationId = dependencies.createCorrelationId ?? randomUUID;

  async function authorization(input: VeskoStagingAuthorizationRequest) {
    if (!dependencies.configuration.authentication.required) return undefined;
    if (dependencies.authentication === undefined) {
      throw new VeskoStagingTransportError("authenticationUnavailable");
    }
    try {
      return validatedAuthorization(await dependencies.authentication.authorize(input));
    } catch (error) {
      throw normalizedFailure(error, false, input.signal?.aborted === true);
    }
  }

  return {
    async authenticate(input = {}) {
      await authorization(input);
    },

    async request(input) {
      validateRequest(input);
      const correlationId = input.correlationId?.trim() || createCorrelationId();
      const start = now();
      let status: number | undefined;
      let timedOut = false;
      const controller = new AbortController();
      const abortFromCaller = () => controller.abort();
      input.signal?.addEventListener("abort", abortFromCaller, { once: true });
      if (input.signal?.aborted) controller.abort();
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, dependencies.configuration.timeoutMs);

      try {
        const authenticated = await authorization({ signal: controller.signal });
        if (controller.signal.aborted) {
          throw normalizedFailure(undefined, timedOut, input.signal?.aborted === true);
        }
        const response = await fetchImplementation(
          relativeUrl(dependencies.configuration.baseUrl, input.route),
          {
            method: input.method,
            headers: requestHeaders(
              authenticated,
              input,
              dependencies.configuration.correlationHeaderName,
              correlationId,
            ),
            body: input.body,
            signal: controller.signal,
          },
        );
        status = response.status;
        if (!expectedStatus(response.status, input.expectedStatuses))
          throw statusFailure(response.status);

        let data: unknown;
        if (input.response === "json") {
          try {
            data = await response.json();
          } catch {
            throw new VeskoStagingTransportError("malformedResponse", response.status);
          }
        }
        const result: VeskoStagingTransportResponse = {
          status: response.status,
          ...(input.response === "json" ? { data } : {}),
          ...(response.headers.get("etag") === null ? {} : { etag: response.headers.get("etag")! }),
          ...(dependencies.configuration.revisionHeaderName === undefined ||
          response.headers.get(dependencies.configuration.revisionHeaderName) === null
            ? {}
            : { revision: response.headers.get(dependencies.configuration.revisionHeaderName)! }),
          correlationId,
        };
        dependencies.logger?.log({
          operation: input.operation,
          method: input.method,
          route: sanitizedRoute(input.route),
          status,
          durationMs: now() - start,
          correlationId,
        });
        return Object.freeze(result);
      } catch (error) {
        const failure = normalizedFailure(error, timedOut, input.signal?.aborted === true);
        dependencies.logger?.log({
          operation: input.operation,
          method: input.method,
          route: sanitizedRoute(input.route),
          ...(status === undefined ? {} : { status }),
          durationMs: now() - start,
          correlationId,
          errorCategory: failure.code,
        });
        throw failure;
      } finally {
        clearTimeout(timer);
        input.signal?.removeEventListener("abort", abortFromCaller);
      }
    },
  };
}

export type VeskoStagingReadinessProbe<TReadiness> = Readonly<{
  operation: string;
  check(
    input: Readonly<{ transport: VeskoStagingTransport; signal?: AbortSignal }>,
  ): Promise<unknown>;
  parse(payload: unknown): TReadiness;
}>;

/**
 * Runs a backend-owned, injected readiness probe after configuration and authentication are known
 * to be usable. P10-01 does not invent a health route or response payload.
 */
export async function checkVeskoStagingReadiness<TReadiness>({
  transport,
  probe,
  signal,
}: Readonly<{
  transport: VeskoStagingTransport;
  probe: VeskoStagingReadinessProbe<TReadiness>;
  signal?: AbortSignal;
}>): Promise<TReadiness> {
  if (!operationPattern.test(probe.operation))
    throw new VeskoStagingTransportError("configurationUnavailable");
  await transport.authenticate({ signal });
  try {
    return probe.parse(await probe.check({ transport, signal }));
  } catch (error) {
    if (error instanceof VeskoStagingTransportError) throw error;
    throw new VeskoStagingTransportError("malformedResponse");
  }
}
