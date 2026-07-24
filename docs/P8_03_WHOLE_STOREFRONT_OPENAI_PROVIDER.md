# P8-03 — Real OpenAI whole-storefront planning provider

## Purpose

P8-03 adds an OpenAI adapter for the provider-independent P8-01 planning
boundary. It prepares and returns a validated `WholeStorefrontGenerationPlan`.
It does not compile a proposal, apply changes, write draft/history/published
state, change catalogue data, or provide merchant UI.

## Sanitized request shape

The application request builder first validates the approved brief, canonical
project target, draft, commerce projection, registry, supported locales and
approved asset context through P8-01. It then sends only:

- approved brief identity, revision, evidence fingerprint, language plan, page
  families and approved design direction;
- normalized canonical target, including page roles/types, visible component
  identities, registry, draft and commerce fingerprints;
- registered component types, versions, variants, permitted field names,
  binding slots and asset slots;
- canonical product and collection IDs plus collection membership;
- approved asset IDs, roles, revisions, material fingerprints, decorative/alt
  metadata and required approved placements; and
- the exact expected structured plan required by the current P8-01 request.

It excludes source URLs, raw evidence payloads, binary files, arbitrary markup,
raw CSS, executable code, catalogue facts and secrets. Unsafe code- or
markup-shaped plan data is rejected before a provider request is made.

## Structured output and validation

The OpenAI adapter uses an injected Responses transport with `store: false` and
a dedicated closed provider DTO schema. Generated component `content`, `props`
and `styleOverrides` use ordered `{ field, valueJson }` entries, so the OpenAI
schema contains no dynamic object records or schema-valued
`additionalProperties`. The adapter reconstructs only the expected generated
component records and rejects missing or unknown fields before P8-01 parses the
result. P8-01 then recreates the expected canonical plan and requires canonical
equality. Unknown fields, invented pages/components/versions, unsupported
locales, changed bindings, protected-commerce changes, unknown assets and
incompatible asset placements therefore fail; no provider reference is repaired
or filtered.

Planning uses the same best-effort safe telemetry boundary as the proposal
provider. It records provider/model identity, operation type, duration, safe
outcome category, request ID and token usage where available. Prompts, raw
responses, source content, URLs, credentials and canonical commerce payloads
are never recorded, and telemetry failures cannot affect planning.

Required homepage, collection-template and product-template families plus shared
header/navigation/footer are part of that exact plan contract.

## Capabilities and failures

`WholeStorefrontPlanningProvider` explicitly declares whole-storefront planning,
strict structured output and approved-asset-reference capability. The server-only
selector defaults to the deterministic provider. The OpenAI selection reads the
existing provider model and timeout configuration; unavailable credentials,
transport failures, refusals, malformed output, incapable providers, invalid
plans and stale results surface as typed merchant-safe failures without raw
provider payloads or secrets.

## Stale-result protection

The request binds brief revision/evidence, draft and project revisions, target
and registry fingerprints, commerce fingerprint, approved asset-context
fingerprint and locale plan. After the asynchronous provider response resolves,
P8-01 rebuilds the current request fingerprint before accepting it. Any mismatch
is stale and cannot become reviewable.

## Protected commerce and assets

The adapter permits only canonical binding IDs. It never sends or accepts an
editable copy of SKU, price, compare-at price, availability, stock, variants,
collection membership or canonical product media. Only P7-05 approved assets
may appear, with their exact revision/material fingerprint, compatible slot and
role; non-decorative assets must retain their approved localized alternative
text through the existing asset context.

## Non-goals

P8-03 does not create proposals, accept or apply plans, mutate snapshots,
publish, modify the editor/onboarding UI, ingest media, call the live API in
tests, or replace the credential-free deterministic provider used by tests and
offline development.
