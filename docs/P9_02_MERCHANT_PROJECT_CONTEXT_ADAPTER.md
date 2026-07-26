# P9-02 — Merchant/project context adapter

## Relationship to P9-01

P9-01 owns the strict, provider-neutral Vesko integration boundary in
`src/application/vesko-integration`. P9-02 supplies an injected adapter for its canonical
`VeskoIntegrationPorts["context"]` port. The adapter returns the unmodified P9-01 merchant
context schema through `load({ tenantId, storefrontProjectId })`; it neither defines a second
context result nor exposes a live Vesko HTTP endpoint.

## Integrated and standalone adapters

`createMerchantProjectContextPort` accepts an injected transport client. It validates the
transport result with P9-01's canonical context schema, verifies the requested tenant and
storefront project, and preserves the opaque revision supplied by the integrated source.

`createStandaloneMerchantProjectContextPort` is a deterministic, repository-backed development
adapter. It has no credential or token input and reads only the local project aggregate. It maps
the local numeric revision to `standalone-project-revision-<number>` both when creating a context
and when validating that context at a standalone repository boundary.

## Authorization

Context loading is deliberately separate from Storefront Studio action authorization.
`createMerchantProjectAuthorization` creates a strict wrapper containing the canonical context and
derived actions; `requireMerchantProjectAction` enforces one named action.

| Studio action            | Required P9-01 authority |
| ------------------------ | ------------------------ |
| View storefront          | `readStorefront`         |
| Edit/save draft          | `saveDraft`              |
| Request AI design        | `saveDraft`              |
| Accept design proposal   | `saveDraft`              |
| Publish storefront       | `publishStorefront`      |
| Restore storefront draft | `restoreDraft`           |

The `saveDraft` mapping is intentionally narrow: requesting or accepting a design proposal only
prepares a draft change and never publishes it. `restoreDraft` grants only restoration. It never
grants draft editing, AI requests or proposal acceptance.

## Revision and failure semantics

Integrated revision values are opaque and are validated by the transport/integration source that
issued them; P9-02 does not compare them to a local numeric counter. Standalone uses the explicit
mapping above so canonical P9-01 stale-revision checks retain opaque values.

Transport, validation and repository lookup failures are exposed as P9-01
`VeskoIntegrationError` values. Missing projects map to `projectNotFound`, tenant mismatches to
`tenantMismatch`, stale standalone revisions to `staleProjectRevision`, missing authority to
`permissionDenied`, and malformed or unavailable sources to the corresponding merchant-safe
P9-01 failure.

## Non-goals

P9-02 adds no authentication UI, live Vesko endpoint, credentials, catalogue or inventory access,
storefront/commerce mutation, merchant-specific route condition, or P9-01 schema change.
