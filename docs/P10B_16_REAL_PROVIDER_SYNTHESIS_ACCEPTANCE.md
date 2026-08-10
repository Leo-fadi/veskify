# P10B-16L — Real-Provider Complete-Storefront Synthesis Acceptance Bridge

## Status

**Partial — local bridge and mocked-provider acceptance implemented; real-provider acceptance is
pending.** P10B-16 remains **Baseline**, P10B remains **Partial**, and P10B-17 and P10B-18 remain
**Planned**.

Provider calls during implementation: **zero**.

This record must not claim real-provider evidence until a separately authorized W1 run succeeds.
Deterministic and mocked-transport evidence proves the boundary and lifecycle, not OpenAI behavior
or commercial visual quality from a live result.

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
→ one bounded real-provider synthesis intent
→ current P10B-16 coordinated direction narrowing
→ current P10B-15 bounded synthesis
→ transient complete canonical StorefrontSnapshot proposal
→ normal Storefront Studio proposal review
→ explicit accept or reject / Undo / Redo / Save / reload / Preview
→ normal explicit Publish path only if the merchant chooses it
```

The bridge never asks the provider to restyle an existing designed storefront and never sends a
precomputed complete storefront for the provider to repeat.

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

## Bounded real-provider intent contract

The provider request contains only:

- the merchant instruction as untrusted input data;
- a sanitized approved merchant/brand summary;
- aggregate catalogue characteristics, not products or commerce values;
- approved-evidence richness and evidence-backed page-family availability;
- approved-asset role posture;
- the current three P10B-16 direction options, versions, authority fingerprints and compatible
  high-level posture vocabularies; and
- an exact current-authority and request fingerprint.

For a named Premium Editorial, Modern Technical or Minimal Commerce run, the request exposes only
that exact P10B-16 direction and requires at least one compatible non-null bounded posture so the
provider result materially narrows synthesis. A general request exposes all three and allows the
provider to choose one.

The strict provider result contains only:

- the exact request fingerprint;
- one registered P10B-16 direction ID; and
- nullable registered narrative, merchandising, information-density, art-direction and responsive
  postures.

The provider cannot return profiles, frames, components, product-card anatomies, section trees,
products, prices, media, assets, facts, presentation copy, JSX, CSS, HTML, JavaScript, URLs or
executable code. Unknown or extra fields fail strict validation. The server owns the deterministic
seed and all structural selection.

After the asynchronous result returns, the server rebuilds the request from current aggregate,
commerce, evidence, site-map and direction authority. Any difference rejects the result as stale
before synthesis. The selected direction and each non-null posture must remain inside the exact
advertised package constraints. The server-owned deterministic seed includes the canonical
fingerprint of the validated provider result, so different valid bounded intent is part of the
synthesis decision rather than a server echo. Provider refusal, malformed output, unsupported
selection, credentials failure or transport failure returns a merchant-safe non-retryable category
and creates no proposal or partial storefront.

Safe diagnostics contain only a redacted session prefix, provider/model identity, single-call
count, authority revision, selected direction or bounded failure category/stage. Credentials,
authorization headers, merchant instructions, raw provider requests and raw responses are neither
logged nor returned.

## P10B-16 to P10B-15 execution

A validated intent becomes the existing `CoordinatedDirectionRequest`. Current P10B-16 then:

1. resolves the exact registered direction version and authority fingerprint;
2. filters candidates through current evidence, approved-asset, Design DNA, profile and shared-frame
   compatibility;
3. selects a deterministic compatible narrowing; and
4. invokes P10B-15 through `executeCoordinatedDirection`.

P10B-15 materializes the current registered site map, Design DNA, shared frame, homepage,
collection/search and PDP profiles, content/utility profiles, component variants, product-card
anatomies, narrative roles, bounded parameters and responsive/art-direction posture. The output
continues through the existing authoritative whole-storefront plan and proposal projection. Server
replay must equal the expected synthesized `StorefrontSnapshot` before the proposal can be retained.

The resulting 28-page materialization is retained only as transient review authority. Generation
does not replace the process-local repository draft or its saved aggregate: both remain the raw
one-page baseline until authoritative acceptance. Rejection discards the transient proposal and
reloads the raw baseline. Acceptance commits the exact complete snapshot through the canonical
repository draft operation; it never accepts a content fingerprint alone or replaces the project
aggregate wholesale.

This creates no second page graph, component registry, template engine, snapshot type, proposal
contract or provider-owned layout.

## Complete storefront coverage

The current fixture supplies 28 required pages, including one evidence-backed About page. The
required set contains:

- home;
- one collection page per canonical collection and the search-results page;
- one PDP per canonical product, preserving both simple and configurable product behavior;
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
page count, page-family counts, selected registered profile IDs, validation state and the editor
route. It contains no raw provider payload or credential.

Representative content and utility previews use the normal registered storefront renderer through
the local canonical project catch-all route. Evidence-backed content receives the exact current
fact references. Utility pages retain their registered read-only presentation and show the safe
unavailable posture when no operational cart or checkout runtime is present; the bridge does not
invent operational state.

## Normal Storefront Studio bridge

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
- general and exact named P10B-16 direction exposure;
- request/current-authority fingerprint and stale-result binding;
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

This is contract, deterministic unit and integration evidence only. No real-provider, retained
human visual, Vesko staging or production evidence is claimed.

## Manual W1 live acceptance after merge

The product owner will run live acceptance separately in W1 using the existing trusted server
OpenAI configuration. Do not inspect, print, copy or modify `.env.local`, credentials,
authorization headers, raw prompts or raw responses.

Before the first call:

1. use the merged bridge on a clean W1 worktree;
2. confirm the trusted selector reports eligible OpenAI provider/model metadata without exposing a
   credential;
3. start an integrated non-production server with the explicit local-acceptance flag and a fresh
   32-byte-or-longer acceptance token;
4. confirm the mock-transport switch is unset;
5. reset and verify `pageCount: 1`, `sectionCount: 0`, no shared frame, no Design DNA, no page-family
   selection and `providerCallCount: 0`; and
6. stop before calling if any baseline or authority field differs.

Run independent resets for:

1. `premium-editorial`;
2. `modern-technical`;
3. `minimal-commerce`; and
4. one general merchant instruction with `requestedDirectionId: null`.

Each reset may make exactly one provider call and must not retry. Stop that run on any refusal,
timeout, malformed/unsupported output, stale authority, validation failure, second-call attempt,
commerce/media difference or non-2xx response. A failed run is evidence of failure, not permission
to fall back or silently rerun.

For each successful result, inspect the normal Studio proposal, accept, Undo, Redo, Save, reload
and Preview representative home, collection, simple PDP, configurable PDP, About and utility
surfaces. Compare the three named results using the retained structural diversity fingerprints and
visible composition; palette-only difference does not pass. Publish only if separately and
explicitly chosen, and do not treat publication as part of provider acceptance.

Retain only safe provider/model identity, start/end timestamps, selected direction, call count,
authority/direction/synthesis/diversity/site-map/snapshot fingerprints, page/profile summary,
sanitized terminal outcome and commerce/media/asset preservation verdict. Never retain the token,
credential, raw request, raw response or headers.

After a successful authorized run, update this document with the safe retained outcome before
claiming real-provider evidence. Until then, the bridge remains Partial and does not change the
status of P10B-17 or P10B-18.
