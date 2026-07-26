# P10-01 — Vesko staging transport and authentication foundation

## Scope

P10-01 adds the shared server-only foundation that future Vesko staging adapters use. It does not
implement catalogue, availability/options/media, draft, history or publishing mappings; those stay
owned by P10-02 through P10-04. The existing P9 standalone assemblies remain credential-free and
do not read staging configuration.

## Server-only configuration

`src/integrations/vesko-staging/transport.server.ts` is marked with `server-only`. It is the only
P10-01 module that reads environment configuration. Client components, domain contracts and
standalone assemblies do not import it or read staging values.

The non-secret configuration values are:

- `VESKO_STAGING_BASE_URL` — required HTTPS base URL, without URL credentials or a query string.
- `VESKO_STAGING_AUTH_REQUIRED` — optional `true` or `false`; defaults to `true`.
- `VESKO_STAGING_TENANT_ID` — optional environment-owned tenant identity.
- `VESKO_STAGING_ENVIRONMENT_ID` — optional environment-owned staging identity.
- `VESKO_STAGING_TIMEOUT_MS` — optional integer request timeout from 1,000 to 120,000 ms; defaults
  to 15,000 ms.
- `VESKO_STAGING_CORRELATION_HEADER` — optional documented header name to receive a generated or
  caller-supplied correlation ID.
- `VESKO_STAGING_REVISION_HEADER` — optional documented response header name containing an opaque
  Vesko revision.

Missing or invalid required configuration fails with a safe `configurationUnavailable` error. No
credential variable, credential format or authentication protocol is configured here because none
is documented in this repository.

## Authentication abstraction

`VeskoStagingAuthenticationProvider` is an injected, protocol-neutral boundary. It returns
request headers and optional expiry metadata; it does not expose an assumed OAuth, API-key or
cookie model to calling adapters. `createVeskoStagingAuthorizationProvider(...)` can cache an
unexpired result and choose an injected refresh operation when expiry is reached. Header values,
tokens and cookies are never included in transport errors or log events.

P10-02 through P10-04 receive a constructed `VeskoStagingTransport`; they do not read environment
variables or implement authentication themselves.

## Transport behavior

`createVeskoStagingTransport(...)` receives configuration, optional authentication provider,
fetch implementation, logger and clock as dependencies. Its request boundary accepts only a
relative route from a documented downstream adapter, a method, optional body/headers, expected
success statuses and a response mode. Absolute URLs are rejected. It supports GET and explicit
mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`) but deliberately has no automatic retry loop,
including for mutations.

Every request has a correlation ID. It is attached only when the environment configures the
backend’s documented correlation-header name. Timeout and caller abort signals are propagated to
the injected fetch implementation. JSON parsing occurs only after successful status validation;
invalid JSON maps to a safe failure.

## Error taxonomy

The transport exposes only `VeskoStagingTransportError` categories:

| Situation                                      | Category                    |
| ---------------------------------------------- | --------------------------- |
| Missing/unavailable authentication or HTTP 401 | `authenticationUnavailable` |
| HTTP 403                                       | `permissionDenied`          |
| HTTP 404                                       | `resourceNotFound`          |
| HTTP 409 or 412                                | `staleRevision`             |
| HTTP 429                                       | `rateLimited`               |
| Invalid JSON or readiness validation           | `malformedResponse`         |
| Timeout                                        | `timeout`                   |
| Caller cancellation                            | `requestAborted`            |
| Other network or HTTP failures                 | `stagingUnavailable`        |
| Invalid staging setup                          | `configurationUnavailable`  |

Raw backend bodies, stack traces, headers and credential material are deliberately not returned.

## Opaque revisions and logging

The response exposes the HTTP `ETag` and only an explicitly configured revision header. Both are
returned exactly as supplied: P10-01 does not parse, number-convert, compare or apply standalone
revision encoding to them.

The optional logger receives only operation name, method, sanitized route identifier, status,
duration, correlation ID and typed failure category. It never receives configuration values,
authorization headers, cookies, request/response bodies, merchant payloads or customer data.

## Readiness

`checkVeskoStagingReadiness(...)` verifies that a constructed transport can obtain authentication
when required, then invokes an injected backend-owned readiness probe and parser. The parser is
the strict contract for that backend’s readiness response. P10-01 intentionally does not invent a
health endpoint, route, payload or merchant-facing UI.

## Known backend-contract gaps

The repository contains no real Vesko staging endpoint catalogue, OpenAPI document, authentication
protocol, credential acquisition flow, token expiry semantics, request/response schemas,
correlation header name, revision header name, or health/readiness contract. Before P10-02 through
P10-04 connect a real environment, Vesko must supply those contract details and a concrete
injected authentication provider and readiness probe.

## Traceability

SDD 15.3–15.4, 16.1–16.5, 17.1–17.4 and 18.1–18.3; FR-101, FR-102, FR-107, FR-108, FR-110,
FR-111, FR-112, FR-115 and FR-118; NFR-101, NFR-105–NFR-109; ADR-002, ADR-003 and ADR-004.
