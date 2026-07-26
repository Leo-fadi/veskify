# P9-05C — Vesko integration assembly and Phase 9 readiness checkpoint

## Complete port assembly

`createVeskoIntegrationPorts(...)` is the single Phase 9 composition boundary for the complete
canonical `VeskoIntegrationPorts` set. It accepts exactly the existing P9-01 ports for merchant
context, catalogue/navigation, availability/options/media, draft persistence and publishing; it
does not introduce another port interface, commerce model or revision representation.

Integrated environments construct their adapters with their own sources and opaque revision
authority, then pass those completed ports to this factory. The composition itself never converts,
guesses or applies standalone revision encodings.

`integrationReadiness(...)` supplies a typed, non-merchant-facing conformance result. It confirms
that all canonical ports and required capabilities are present, identifies the standalone mode as
credential-free, and records that real staging transports remain a Phase 10 responsibility.

## Standalone composition

`createStandaloneVeskoIntegrationAssembly(...)` is the credential-free local/demo composition.
It reuses only existing project aggregates, canonical Aurum Nordic and Karvonen catalogues, and
the P9-02 through P9-05B adapters:

- P9-02 repository-backed merchant/project context;
- P9-03 standalone catalogue/navigation projection, mapped into the P9-01 catalogue port without
  enriching commerce data;
- P9-04 availability/options/media projection with an explicitly supplied standalone identity and
  shared standalone catalogue revision;
- P9-05A repository-backed draft save and immutable history restore;
- P9-05B authoritative repository-backed publishing.

The standalone assembly scopes every exposed port to one configured tenant, merchant, store,
authenticated user and storefront project. Aurum and Karvonen can therefore be assembled against
the same in-memory repository as isolated project contexts. Cross-tenant and cross-project calls
fail before catalogue, persistence or publishing state is used.

## Explicit environment dependencies

The assembly makes the environment-owned dependencies visible at its boundary:

- merchant/project context source and authenticated identity;
- project-revision authority (opaque for integrated environments; named standalone mapping only in
  the standalone factories);
- catalogue and availability/options/media transports;
- project, history/snapshot and publishing-transaction repositories;
- accepted-proposal/manual-save provenance source;
- authoritative publish-preparation source;
- durable publishing idempotency storage supplied by the publishing repository;
- canonical fingerprint utilities already used inside the P9-05A and P9-05B adapters.

The generic composition does not substitute local IDs or revisions for integrated sources. The
standalone catalogue revision is explicitly shared with P9-04 so catalogue and product projections
can be joined only when their catalogue ID and revision agree.

## Identity and authorization consistency

The assembly checks tenant and storefront-project identity on every context, catalogue and product
projection request. It also preserves merchant, organization, store and authenticated-user identity
through the existing P9-02/P9-05A/P9-05B authorization checks. Draft save, restore and publish
reload the scoped context before state-changing work.

Catalogue and product-projection reads also reload the P9-02 context and require its
`view-storefront` authority on every request. The request store must match that freshly authorized
context; neither a client-supplied permission list nor a prior successful read grants later access.
This preserves tenant and project mismatch failures before either projection source is consulted.

Least privilege remains owned by the canonical authorization adapter:

- read authority does not grant draft save, restore, AI request/acceptance or publishing;
- draft-save authority supports manual edits and proposal acceptance, but never publishing;
- restore authority is isolated from AI authority;
- publish authority is checked again for every publish request and replay.

## Read-only catalogue and product compatibility

The P9-03 catalogue port and P9-04 product projection share tenant, store, storefront project,
catalogue ID and opaque catalogue revision. The P9-04 PDP bridge and resolver reject mismatched
catalogue identity or revision before presentation truth is consumed.

Standalone assembly validates, deep-clones and freezes the supplied catalogue once at composition
time. That immutable snapshot is the only input used for catalogue revision calculation and both
P9-03 and P9-04 adapters, so a caller mutating its original fixture afterwards cannot change a
live projection or break their revision join. Generated product-type IDs normalize Unicode to NFC,
retain a readable slug and append an identity hash whenever normalization would be lossy; a supplied
canonical source product-type ID is preferred, and a duplicate final ID for different normalized
source identities is rejected.

The existing P9-04 contract tests remain the product-behaviour conformance layer for simple
products, sole zero-dimension variants, selectable variants, dependent and text-entry options,
unavailable combinations, variant SKU/price/media and product-wide media. P9-05C verifies their
assembly-level identity/revision join rather than duplicating those adapter cases.

## Draft and restore journeys

Manual draft save is independent of AI provenance: a validated editor change retains the active
draft identity until persistence, then P9-05A mints a distinct immutable saved snapshot/history
identity under authoritative concurrency checks.

Accepted-AI draft save uses the injected authoritative proposal provenance source. Only an
accepted proposal whose snapshot preserves active-draft identity is persisted; the save adapter,
not proposal acceptance, mints the immutable saved identity. Rejected, stale, closed or otherwise
unaccepted proposals cannot be saved as accepted changes.

Restore accepts an immutable target identity, revision and fingerprint from repository history. It
does not accept a client snapshot, mutate immutable history or change the published snapshot.

## Authoritative publishing and atomic failures

Publishing begins from an authoritative saved-draft identity and publish preparation, never a
client snapshot. P9-05B reauthorizes the current caller, checks opaque revisions and authoritative
draft/published identities, then delegates the atomic pointer/history/idempotency transaction to
the repository. Successful publication preserves the saved source snapshot in history and creates
the distinct published and synchronized active-draft snapshots required by the existing model.

Save, restore and publish failures occur before a write where possible; repository transaction
failures preserve active draft, saved-draft identity, immutable history, published pointer and
durable publication operation state. Publishing reconciles an ambiguous completion from its
repository-scoped idempotency record without duplicate history.

## Phase 10 staging gaps and non-goals

The checkpoint is ready for environment-specific Phase 10 staging adapters, but does not provide:

- real Vesko staging endpoints or transport implementations;
- authentication token acquisition, production secrets or credential storage;
- real durable save/restore idempotency beyond the existing standalone process-local P9-05A store;
- inventory, catalogue, product, media or price mutation;
- automatic publishing after AI acceptance;
- merchant UI, onboarding or storefront redesign.

No new draft, history, publishing or commerce model is introduced by this checkpoint.

## Traceability

SDD 15.3–15.4, 16.1–16.5, 17.1–17.4 and 18.1–18.3; FR-101, FR-102, FR-107, FR-108, FR-110,
FR-111, FR-112, FR-115 and FR-118; NFR-101, NFR-105–NFR-109; AC-102, AC-105–AC-112,
AC-115 and AC-124; ADR-002, ADR-003 and ADR-004.
