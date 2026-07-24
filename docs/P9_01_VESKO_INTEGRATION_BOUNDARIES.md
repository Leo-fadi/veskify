# P9-01 — Vesko ROS integration boundaries and capability map

## Ownership boundary

Vesko Retail OS remains the source of truth for merchant identity, product and collection data,
SKU, price, inventory, availability, variants, option groups, canonical media, navigation source
data and publishing authority. Storefront Studio owns only storefront presentation snapshots,
BrandSystem, composition, presentation content, proposal review and draft history.

## Provider-neutral ports

`src/application/vesko-integration` defines strict contracts for merchant/project context, catalogue
projection, availability/options/media projection, draft persistence and publishing. Every request
binds tenant and storefront-project identity and carries deterministic revisions or fingerprints.
The contracts are serializable, strict, free of UI/provider dependencies and reject unknown fields.
The option and media projection reuses the canonical PDP semantics: ordered option values,
presentation, dependencies, text-entry constraints and canonical variant-media associations remain
available without Studio-side enrichment.

## Protected commerce

The ports expose storefront-safe read-only projections. They contain no product, price, inventory,
availability, variant, membership or media mutation commands. Publishing accepts only a validated
saved-draft identity, immutable publish-preparation identity and expected published-state identity;
the adapter loads the authoritative saved storefront presentation rather than accepting client
snapshot content.

## Draft and history integrity

Draft saves carry the expected current draft ID, revision and content fingerprint in addition to
project revision; the first-save case is explicit. History restoration accepts only an immutable
history target ID, revision and fingerprint, never a client-supplied target snapshot. Adapters must
load and verify those authoritative records before producing a new active draft revision.

## Capabilities and failures

Each environment explicitly reports availability for merchant context, catalogue, availability,
option resolution, canonical media, draft persistence, publishing and history restoration. Typed,
merchant-safe failures cover unavailable authentication, permissions, tenant/project mismatch,
staleness, unavailable projections/publishing, revision conflicts, unsupported capability and
malformed responses. They also distinguish draft conflicts, stale or missing history targets,
target fingerprint mismatches, duplicate canonical identities, broken catalogue references, saved
draft mismatches, stale publish confirmations and published-state conflicts. Raw backend payloads
and secrets are outside the contract.

## Standalone compatibility

Standalone/fixture and IndexedDB-backed implementations can provide the same injected port bundle.
They remain adapters for deterministic development and testing; they do not claim to be a Vesko
production backend and P9-01 does not modify existing seeds or IndexedDB behaviour.

## Non-goals

This task adds no live backend connection, HTTP endpoint, inventory feature, bulk enrichment,
industry template, merchant UI or production adapter implementation.

## Traceability

SDD sections 15.3–15.4, 16.1–16.5, 17.1–17.4 and 18.1–18.2; FR-101, FR-102, FR-107, FR-110,
FR-111, FR-112, FR-115 and FR-118; NFR-101, NFR-105–NFR-109; AC-102, AC-105–AC-112 and AC-124;
ADR-002, ADR-003 and ADR-004.
