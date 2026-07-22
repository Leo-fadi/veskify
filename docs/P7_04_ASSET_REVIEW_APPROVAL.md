# P7-04 discovered asset review and approval

## Scope and requirements

This implementation covers the provider-independent review of public-source asset candidate metadata before Storefront Design Brief generation. It implements SDD sections 7, 8.3-8.4, 15, 16 and 17.2 and traces to FR-102, FR-104, FR-105, FR-107 and FR-110; NFR-101, NFR-105, NFR-107, NFR-108 and NFR-109; and AC-104 and AC-118.

The persisted asset review is part of the existing URL onboarding workflow. It does not create another onboarding store, media library or commerce model.

## Lifecycle

- `discovered`: validated metadata was returned by the configured discovery adapter. Confidence never changes this state automatically.
- `needsReview`: a merchant has confirmed or changed the semantic role, or materially changed source metadata replaced an approved candidate.
- `approved`: a current source-scoped candidate has both an explicit canonical role decision and an explicit merchant approval decision.
- `rejected`: the merchant declined reuse. The record and provenance remain available as audit history.
- `superseded`: an approved record was replaced by materially changed source metadata. The prior approval remains historical and points to the replacement.
- `unavailable`: the remote candidate later became inaccessible. Prior decisions and provenance remain retained, but the candidate is not currently bindable.

Every mutating decision checks the candidate revision. Stale, duplicate or conflicting decisions fail without replacing the persisted safe state.

## Approval, rejection and roles

Discovery roles are suggestions only. Approval requires a separately recorded merchant role decision using the canonical component-platform roles. P7-04 uses the merged roles and adds only `supportingContentImage`, which is explicitly required by SDD section 8.3 for supporting imagery.

Approval requires:

- a known candidate in the current source;
- HTTPS, same-origin, source-scoped provenance produced through the discovery boundary;
- a supported canonical role and merchant-reviewed alternative text for non-decorative media;
- an explicit merchant actor and decision timestamp;
- a current candidate revision with no rejected, superseded or unavailable conflict.

Rejection and unavailability do not delete the record. An approved role cannot be changed silently; changed material must return through review and approval.

## Provenance and deduplication

The review record retains the original candidate plus all same-material observations, source-reference ID, normalized asset URL, final fetched document URL where available, extraction location, retrieval time, media type, confidence, uncertainty, warnings and source fingerprint.

Deduplication uses source-reference identity, normalized URL and material identity. A filename is never sufficient. Same-source duplicates share one review row while preserving their observations and role suggestions. Different source references are never merged.

## Storefront Design Brief relationship

The URL workflow stores the asset-review aggregate and material fingerprint with the existing source evidence and brief revisions.

- Required candidates in `discovered`, `needsReview` or `unavailable` block brief approval.
- Explicitly rejected candidates are resolved but excluded.
- The reviewable brief receives only approved asset IDs, canonical roles, revisions and fingerprints.
- A material approved-asset change makes an approved brief stale.
- Superseding that stale brief preserves the old approved revision and creates a new `needsReview` revision.
- Superseded or otherwise unapproved briefs remain ineligible for generation.

Public product-image approval is presentation metadata only. It does not add or replace canonical Vesko product or collection media.

## Approved projection boundary

The read-only approved projection contains only current `approved` records. Each item includes its asset ID, canonical role, approval state, complete source provenance, source identity, revision/fingerprint and validated component-conformance metadata.

`discovered`, `needsReview`, `rejected`, `superseded` and `unavailable` records are excluded from current binding targets. The component-platform conformance guard remains responsible for rejecting unknown, unapproved or wrong-role assignments.

## Security assumptions and non-goals

The workflow accepts metadata only from the existing validated source-discovery boundary. It rechecks HTTPS, source-reference identity, same-origin provenance and obvious local/private literal hosts before approval. DNS resolution, redirects, response limits and SSRF protections remain owned by the bounded public-source adapter.

P7-04 does not:

- download or inspect remote binaries;
- upload or permanently store media;
- hotlink assets into published storefronts;
- crawl `robots.txt`, additional pages or sites;
- trust remote MIME claims as verified binary content;
- forward cookies or credentials;
- mutate canonical product, collection or catalogue media;
- add merchant-facing React screens, editor changes, publishing changes or AI proposal operations.

Permanent ingestion, responsive image processing, signed delivery URLs and production media storage remain Vesko media-service responsibilities.
