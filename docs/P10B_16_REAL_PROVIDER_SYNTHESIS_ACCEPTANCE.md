# P10B-16L — Real-Provider Complete-Storefront Synthesis Acceptance Bridge

## Status

**Deprecated — compatibility-only acceptance infrastructure.** P10B-16, P10B-16P-01,
P10B-16P-02A, P10B-16P-02B, P10B-16P-03, and P10B-16P-04 are **Baseline**. P10B-16P-02 is
**Baseline**; P10B-17 and P10B-18 remain **Planned**. P10B remains **Partial**.

Provider calls during the P10B-16P-02A and P10B-16P-02B Design Intent V2 implementation:
**zero**. One earlier, separately authorized call used the pre-correction v1 direction/posture
contract retained below.

The retained call proves only that the earlier strict v1 provider result completed. Coordinated
synthesis failed afterward, and the call did not generate a storefront design plan from the prompt.
P10B-16P-04 now owns accepted live V2 evidence and has disposed this bridge as compatibility-only.
The bridge's deterministic and mocked-transport evidence remains historical migration and safety
evidence only; it is not the normal prompted Studio path.

## Why this bridge exists

P9-05B remains valid historical evidence for its own Phase 9 outcome. It starts from the
already-designed `project_lumo_fresh` demonstration storefront and lets a provider choose one of
the historical registered whole-storefront directions. It does not start from raw merchant
presentation authority and does not exercise the current P10B-16 direction packages through the
P10B-15 complete-storefront synthesis engine. It therefore is not P10B-15/P10B-16 live synthesis
acceptance evidence and is not changed by P10B-16L.

P10B-16L adds a separate local-only path:

```text
raw approved Karvonen merchant and commerce truth
→ current P10B-16 coordinated direction candidate execution
→ current P10B-15 bounded synthesis and complete candidate materialization
→ one bounded real-provider selection among already completed executable options
→ retained completed-result resolution
→ transient complete canonical StorefrontSnapshot proposal projection
→ normal Storefront Studio proposal review
→ explicit accept or reject / Undo / Redo / Save / reload / Preview
→ normal explicit Publish path only if the merchant chooses it
```

The bridge never asks the provider to restyle an existing designed storefront and does not send
snapshot bytes to the provider. It does, however, execute and materialize complete compatible
candidate storefronts before the provider call. The provider chooses an advertised completed result
by `executableIntentId`; this is governed bounded preset selection, not prompted storefront-plan
generation.

## Retained strict v1 result and failed acceptance

The first separately authorized W1 attempt made exactly one real provider call. Safe retained
evidence records:

- provider `openai-p10b-complete-storefront-synthesis-intent`;
- model `gpt-5.6-sol`;
- provider call count `1`, with no retry;
- the strict v1 direction/posture provider result completed successfully;
- downstream acceptance failed at stage `coordinated-synthesis` with the then-reported safe code
  `malformed-state`;
- authoritative revision `0` and no generated proposal;
- the raw presentation remained one page with zero sections; and
- commerce, draft, save and publication authority remained unchanged.

The reset was consumed and was not retried. The exact provider response was intentionally not
retained, so this record does not invent its posture values. Deterministic reproduction instead
proved the broader v1.0.0 defect: Premium Editorial advertised 72 independently valid posture
tuples while only 2 were executable under the exact raw authority. This is neither a real-provider
acceptance pass nor prompt-driven design generation. No prompt, response, credential, token, header
or merchant-private payload is retained here.

## Raw Karvonen acceptance authority

The fixture reuses Karvonen only for approved merchant facts and canonical read-only commerce:

- product, option, variant, SKU, price, collection, availability and media truth;
- the existing simple and configurable product shapes;
- approved business identity and description; and
- one exact evidence-backed About fact document.

The fixture creates a new project and catalogue authority for the acceptance session. Apart from
that fixture catalogue identity, its products, collections and product media equal the canonical
Karvonen projection.

The reset presentation is deliberately raw:

- one home page with no sections;
- empty primary and footer navigation;
- no shared-frame selection;
- no PageBlueprint/page-family selection;
- no P10B-16 direction or P10B-15 synthesis decision;
- no parametric Design DNA or visual-system projection;
- no product-card anatomy, editorial narrative or precomposed hierarchy; and
- no approved asset context, asset placement or editorial media.

The execution input adds only the neutral registered legacy header and footer source sections
needed by the canonical shared-frame promoter. They make no frame, profile, direction, Design DNA
or narrative choice and are replaced by current P10B-16/P10B-15 authority. Canonical product media
is never repurposed as editorial media. Because no approved editorial asset exists, synthesis must
choose a compatible product-led or typographic composition.

## Local-only authority and security

The server authority uses the namespace
`p10b-16l-real-provider-complete-storefront-synthesis`. It is process-local, resettable and backed
by an in-memory project repository. It creates no production persistence and is unavailable when
`NODE_ENV` is `production`.

Activation requires all of:

- a non-production process;
- `VESKIFY_RUNTIME_MODE=integrated`;
- `VESKIFY_P10B_16L_LOCAL_ACCEPTANCE=1`; and
- a `VESKIFY_P10B_16L_LOCAL_ACCEPTANCE_TOKEN` whose encoded length is at least 32 bytes.

The reset and generation endpoints require the configured token, same-origin requests and an
exact request shape. The reset creates a new opaque session. Acceptance, rejection and
synchronization require that session, the exact project identity, the expected monotonically
increasing authority revision, same-origin JSON requests and valid canonical state. Secret
comparison is timing-safe. Production activation fails closed.

The local routes are intentionally separate from P9-05B:

- `POST /api/demo/p10b-live` resets raw authority and issues an opaque session;
- `POST /api/demo/p10b-live/generate` performs at most one provider call for that reset;
- `POST /api/demo/p10b-live/accept` accepts only the exact reviewed synthesized snapshot; and
- `POST /api/demo/p10b-live/reject` discards the transient proposal while retaining raw authority;
  and
- `POST /api/demo/p10b-live/synchronize` retains active or explicitly saved canonical state.

The test-only `VESKIFY_P10B_16L_MOCK_TRANSPORT=1` switch is accepted only outside production and
selects an explicit structured mock transport. It is not a fallback. A live run must leave this
switch unset. Missing OpenAI selection, credentials, valid model identity or bounded timeout
returns a safe unavailable result; it never selects the mock or historical deterministic planner.

Each reset has a one-call budget. A completed, failed or concurrent generation cannot call the
provider again without an explicit reset. OpenAI SDK retries and per-request retries are both zero.

## Executable bounded preset-selection compatibility contract

Contract version **2.0.0** replaces the incompatible v1.0.0 independent-posture contract. It is the
compatibility bridge contract, not the P10B-16P-02A Design Intent V2 contract. A v1.0.0 request or
result fingerprint is never reinterpreted as v2 and fails closed.

The provider request contains only:

- the merchant instruction as untrusted input data;
- a sanitized approved merchant/brand summary;
- aggregate catalogue characteristics, not products or commerce values;
- approved-evidence richness and evidence-backed page-family availability;
- approved-asset role posture;
- current executable intent options derived from the singular P10B-16 candidate authority; and
- an exact current-authority and request fingerprint.

Before the provider is called, the server applies current evidence, approved-asset, profile,
Design DNA, shared-frame, site-map and commerce compatibility, fixes one deterministic option seed,
and fully executes each retained tuple through P10B-16 and P10B-15. Duplicate structural results
are removed. Every advertised option therefore represents one exact currently executable tuple,
not the Cartesian product of independently allowed fields. The deterministic raw-fixture audit found
2 Premium Editorial, 3 Modern Technical and 14 Minimal Commerce executable tuples, all with distinct
structural fingerprints and complete 28-route results. Provider input is deliberately bounded to at
most three structurally distinct choices per direction: the current request exposes 2 Premium
Editorial, 3 Modern Technical and 3 Minimal Commerce choices, while the retained deterministic audit
records all 14 executable Minimal tuples.

For a named run, the request exposes only executable options inside that direction. A general run
exposes the executable options across all three directions. Each safe option contains a stable
intent ID, exact five-field posture tuple, direction/version authority, bounded description,
execution fingerprint and current-authority-bound option fingerprint. It does not expose profile,
frame, component, section, product, price or media identities.

The strict provider result contains only:

- the exact request fingerprint;
- one advertised executable intent ID; and
- that same option's exact executable-intent fingerprint.

The provider cannot return profiles, frames, components, product-card anatomies, section trees,
products, prices, media, assets, facts, presentation copy, JSX, CSS, HTML, JavaScript, URLs or
executable code. It also cannot construct or combine independent posture fields. Unknown or extra
fields fail strict validation. The server owns the deterministic seed and all structural selection.

After the asynchronous result returns, the server recomputes the exact current-authority fingerprint
from current aggregate, commerce, evidence, site-map and direction authority.
Any difference rejects the result as stale before synthesis. When authority is unchanged, the
server validates the selection against the immutable request and reuses that option's already
validated preflight result; it does not synchronously rebuild and rematerialize the whole bounded
inventory after the provider call. The selected option resolves its exact five-field tuple and fixed
seed; no field is discarded and no alternate candidate is substituted. The retained coordinated
result must match the preflight execution fingerprint before a proposal can exist. Different valid
options retain distinct seeds and structural fingerprints, so the provider still makes a material
bounded choice within a named direction. Provider refusal, malformed output, unsupported selection,
unavailable compatible intent, stale authority, candidate failure, materialization failure or
transport failure returns an accurate merchant-safe non-retryable category and creates no proposal
or partial storefront.

Safe diagnostics contain only provider/model identity, call count, authority revision, selected
direction/option fingerprint or bounded failure category/stage. Credentials,
authorization headers, merchant instructions, raw provider requests and raw responses are neither
logged nor returned.

## Pre-provider P10B-16 to P10B-15 execution

Before the provider call, each candidate becomes an existing `CoordinatedDirectionRequest`.
Current P10B-16 then:

1. resolves the exact registered direction version and authority fingerprint;
2. filters candidates through current evidence, approved-asset, Design DNA, profile and shared-frame
   compatibility;
3. selects a deterministic compatible narrowing; and
4. invokes P10B-15 through `executeCoordinatedDirection`.

P10B-15 materializes the current registered site map, Design DNA, shared frame, homepage, dynamic
collection/search and PDP archetype profiles, content/utility profiles, component variants,
product-card anatomies, narrative roles, bounded parameters and responsive/art-direction posture.
P10B-16P-01 converges concrete commerce route pages into compact route inventory plus maintained
root archetypes before canonical retention. The output continues through the existing authoritative
whole-storefront plan and proposal projection. Server replay must equal the expected synthesized
`StorefrontSnapshot` before the proposal can be retained.

The resulting 28-route storefront is retained only as transient review authority before acceptance.
Its snapshot contains genuinely static design pages plus one dynamic-commerce route/archetype
authority, not 28 independently editable page structures. Generation does not replace the process-
local repository draft or its saved aggregate: both remain the raw one-page baseline until
authoritative acceptance. Rejection discards the transient proposal and reloads the raw baseline.
Acceptance commits the exact complete snapshot through the canonical repository draft operation;
it never accepts a content fingerprint alone or replaces the project aggregate wholesale.

After the provider returns, its strict option identity resolves the already completed retained
result; it does not cause first-time synthesis. This creates no second page graph, component
registry, template engine, snapshot type, proposal contract or provider-owned layout.

## Complete storefront coverage

The current fixture supplies 28 required public routes, including one evidence-backed About page.
The required route set contains:

- home;
- one collection route per canonical collection, resolved through maintained collection
  archetypes, plus `/search` inventory and registered archetype selection; operational search
  materialization remains fail closed without exact transient query/result authority from the
  still-missing canonical search adapter;
- one PDP route per canonical product, resolved through maintained PDP archetypes while preserving
  both simple and configurable product behavior;
- cart and checkout-boundary presentation;
- no-results and generic empty presentation;
- recoverable error presentation; and
- 404/not-found presentation.

About is available only because the fixture supplies the exact approved business fact. Contact,
locations, FAQ, shipping, returns, policy, service and campaign pages are not fabricated when their
required approved evidence is absent. Route-local loading/pending behavior remains the existing
utility authority rather than another persisted page.

The returned developer-safe metadata includes provider/model identity, one-call count, selected
direction and authority fingerprint, direction/synthesis/diversity/site-map/snapshot fingerprints,
static design-page count, collection/search and PDP archetype counts, runtime route count,
page-family route counts, selected registered profile IDs, validation state and the editor route.
It contains no raw provider payload or credential.

Representative content and utility previews use the normal registered storefront renderer through
the local canonical project catch-all route. Evidence-backed content receives the exact current
fact references. Utility pages retain their registered read-only presentation and show the safe
unavailable posture when no operational cart or checkout runtime is present; the bridge does not
invent operational state.

## P10B-16L special Storefront Studio bridge

Generation returns the normal editor route with an opaque `p10b-16l-session` query value. The
server keeps the raw saved aggregate in the browser repository and projects the transient review
aggregate and pending proposal only into the current editor session. It does not persist the review
scaffold to IndexedDB or make it reachable from normal no-session editor/publish routes. The normal
proposal coordinator owns review and atomic acceptance. While that proposal is pending, canonical
mutation, every external Preview entry point, Save and Publish are blocked. Hiding the proposal UI
cannot remove this guard, and a direct session-preview URL fails closed.

The acceptance endpoint verifies the entire submitted `StorefrontSnapshot`, including its identity
and protected publication relationship, against the exact synthesized snapshot. A visually similar,
mutated or published-snapshot-substituted value is rejected. Reject returns the session to its raw
one-page presentation. Accept makes the complete snapshot the active unsaved draft; Undo restores
the raw snapshot, Redo restores the exact accepted snapshot, and neither action bypasses server
authority.

The imported live proposal is review-only because the reset's one-call provider budget has already
been consumed. Storefront target changes, new requests, revision, regeneration and non-authoritative
Close are unavailable; the merchant must explicitly accept or reject the retained proposal. A new
result requires a fresh controlled reset, so a failed replacement attempt cannot orphan the server
proposal or bypass the call budget.

Active-history changes and explicit Save synchronize only the validated current draft through the
canonical repository contract with optimistic authority revision checks. Client synchronization
cannot replace published snapshots, the published pointer, project authority, history metadata or
catalogue truth. A full-snapshot Save persists the exact visible active state—including the raw
one-page state while acceptance is undone—rather than reconstructing it from page deltas.
Save/reload retains the accepted snapshot and clears the consumed proposal. The
registered project renderer provides normal home, collection, PDP, evidence-backed content and
utility previews only from the explicitly saved aggregate; it is not a screenshot renderer.
Publish remains separate and explicit through the normal Studio publication journey and is
available only after acceptance and explicit Save. Generation, rejection and acceptance do not
publish automatically, and this bridge records no publication evidence.

## Commerce, media and asset protection

The bridge fingerprints the complete canonical catalogue at reset and requires exact equality
before generation, acceptance and synchronization. Product identities, variants, options, SKUs,
prices, availability, stock, collection membership/order and canonical product media remain
unchanged. The provider receives aggregate catalogue characteristics only.

The fixture has no approved presentation assets. P10B-15/P10B-16 therefore cannot invent an asset
or substitute product media into an editorial role. Safe generation metadata reports protected
commerce, canonical product media and approved assets as unchanged. Any catalogue drift or
accepted-snapshot mismatch fails closed without advancing retained state.

## Mock-first deterministic evidence

Implementation and automated validation use the actual strict OpenAI adapter with an injected
mock Responses transport. No network or provider call occurs. Focused evidence covers:

- the raw one-page, zero-section baseline and neutral execution prerequisites;
- exact preservation of every canonical Karvonen product, collection and media fact;
- general and exact named executable-intent exposure;
- request/current-authority/option/execution fingerprint and stale-result binding;
- deterministic reproduction of the v1.0.0 Cartesian compatibility gap;
- full preflight execution for every advertised option and material structural influence;
- strict rejection of arbitrary layout, component, code and commerce fields;
- one non-stored structured transport invocation with retries disabled;
- provider failure without fallback or a second call;
- all three named directions producing distinct structural diversity fingerprints;
- complete P10B-16 to P10B-15 materialization;
- transient review without authoritative precommit, plus raw rejection/reload restoration;
- pending-proposal Preview, mutation, Save and Publish blocking;
- normal proposal review, exact accept, raw/full Undo and Redo, Save and reload;
- registered collection, configurable PDP, evidence-backed About and utility preview rendering;
- exact full accepted-snapshot, published-authority, synchronization and protected-commerce
  rejection; and
- token, same-origin, opaque-session and production-disable boundaries.

The corrected executable-intent contract has contract, deterministic unit and integration evidence
only and has made zero live calls. The earlier v1 call is retained as a technically successful
strict direction/posture result plus failed coordinated synthesis, not executable-option selection,
a Design Intent V2 call, or a real-provider acceptance pass. No retained human visual, Vesko staging
or production evidence is claimed.

## P10B-16P-04 live V2 acceptance and bridge disposition

The new prompted contract and its transition are specified in
[`P10B_16P_02_PROMPTED_STOREFRONT_DESIGN_PLAN_V2.md`](P10B_16P_02_PROMPTED_STOREFRONT_DESIGN_PLAN_V2.md).
P10B-16P-02A makes the strict transient Design Intent V2 boundary structurally available without a
provider call. P10B-16P-02B now compiles that intent against refreshed authority through a bounded
metadata-only solver and consumes one exact result through canonical synthesis and isolated
proposal materialization, also without a provider call. P10B-16P-03 now wires the normal mocked
Storefront Studio prompt-to-review/accept/save/preview journey through this current V2 authority,
including one registered `APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION` operation with exact P02B
source-proposal fingerprint, compiler lineage, and retained snapshot evidence, without using the
P10B-16L `executableIntentId` selector and without a real provider call. See
[`P10B_16P_03_STUDIO_PROMPT_GENERATION_JOURNEY.md`](P10B_16P_03_STUDIO_PROMPT_GENERATION_JOURNEY.md).

P10B-16P-04 completed the separately authorized real-provider acceptance through a
production-disabled, trusted server-owned Aurum acceptance composition. Three final ordered cases
used the normal Storefront Studio request path, strict compact semantic intent, deterministic exact
compilation, and exactly one materialization each. Prompts A and B were rejected without draft or
history mutation; Prompt C completed atomic Accept, Undo/Redo, explicit Save, reload, and normal
Preview. The cumulative P10B-16P-04 ledger is 16 real calls with zero retries or fallbacks, zero
publication, and unchanged protected commerce and canonical product media. See
[`P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md`](P10B_16P_04_REAL_STUDIO_DESIGN_INTENT_ACCEPTANCE.md).

The accepted path does not use the P10B-16L `executableIntentId` selector. P10B-16L is retained
temporarily as Deprecated compatibility-only infrastructure for historical evidence, migration
regressions, safety comparison, and consumer analysis. Removal requires merged P10B-16P-04
evidence, equivalent V2 safety regressions, proof that no active production-path consumer depends
on it, and a separately authorized cleanup task. Executable search, P10B-17/P10B-18 closure, Vesko
staging, production authentication, and production readiness remain unclaimed. No provider call is
authorized by this documentation update.
