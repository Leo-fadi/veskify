# P10A-07B — Human Commercial Review Protocol Foundation

## Status and boundary

P10A-07B adds a runtime-validated, immutable protocol record for retaining human commercial review evidence grounded in P10A-07A.
It does not issue final commercial acceptance, accept a proposal, mutate a `StorefrontSnapshot`, save, publish, add a UI or route, render a screenshot, contact a provider, or create persistence.
A protocol `passed` disposition is only a complete retained human-review record; it cannot close P10A or replace the product-owner gate.

The implementation is `src/application/human-commercial-review`.
It derives current authority from the read-only `GoldenStoreEvaluationRun`; it does not recreate a snapshot, PageBlueprint, registry, renderer, asset inventory, proposal, or commerce model.

## Requirement basis

The protocol records the human part of AC-134, AC-137 and AC-138 and supports FR-109, FR-110, FR-114, NFR-102, NFR-103, NFR-108 and NFR-110.
The SDD requires coordinated screenshot-level review of homepage, collection and PDP with the shared storefront frame at 375, 768, 1024 and 1440 px, using representative approved assets.
It explicitly says fingerprints, schemas and deterministic evidence alone do not establish commercial visual quality.

There is deliberately no invented numerical quality threshold, pixel score, or subjective automatic pass.
Each retained human decision includes a closed decision state, explanation and typed evidence references.

## Authority and stale behaviour

`createHumanCommercialReviewAuthority()` projects only the P10A-07A facts needed to bind a review:

- evaluation and fixture/project identity;
- canonical snapshot identity, revision and fingerprint, including proposal-preview fingerprint;
- capability-manifest version/fingerprint;
- canonical home, collection and PDP profile ID/version/materialization fingerprints;
- all lifecycle snapshot, navigation, protected-commerce and approved-asset fingerprints;
- scenario renderer-output and BrandSystem fingerprints.

The authority has its own stable fingerprint. Record creation recomputes that fingerprint from every
supplied authority field before comparing it with the current P10A-07A authority, so a retained
snapshot, manifest, profile, lifecycle, commerce, asset, renderer or BrandSystem change cannot be
masked by leaving an old outer fingerprint in place. Equivalent lifecycle and profile arrays are
normalized before hashing. Record creation rejects both self-inconsistent and stale authority.
`assessHumanCommercialReviewStaleness()` retains a read-only stale result for a record after any of those inputs changes.
Screenshot pixels are never a sole current-authority source: screenshots are evidence references and canonical P10A-07A fingerprints remain the freshness authority.

## Criterion inventory and decisions

The closed P10A-07B criterion IDs are:

- visual hierarchy;
- commercial clarity;
- product and collection discoverability;
- merchandising coherence;
- brand consistency;
- responsive composition;
- content and media appropriateness;
- navigation clarity;
- conversion-path clarity;
- accessibility observations; and
- cross-page coherence.

Each required criterion is exactly once with `passed`, `failed`, `blocked`, or `not-applicable`, an explanation, and one or more evidence references.
A required omitted or not-applicable decision keeps the protocol disposition `incomplete`.
A required failure yields `failed`; a required block yields `blocked`; only a complete all-passed
record with qualifying human visual or browser evidence for every required scenario yields the
protocol-only `passed` disposition. Deterministic renderer, DOM, manifest and lifecycle evidence
can support a review, but cannot by itself satisfy the human-review pass requirement. A missing
qualifying mobile, desktop, locale, lifecycle or surface observation keeps the disposition blocked;
the protocol does not infer visual quality merely from the existence of a screenshot.

## Coverage and evidence model

The protocol requires every P10A-07A scenario exactly once: shared frame, home, collection and product; proposal preview, accepted editor, preview route, saved/reloaded and published; EN/FI; and 375/768/1024/1440 px (160 retained coverage rows).
Each row binds the current profile ID, renderer-output fingerprint and at least one typed evidence reference.

Typed references can retain screenshot metadata, browser routes, DOM observations, renderer output, console observations, runtime errors, snapshots, proposal references, fixture references and lifecycle references.
They can include surface, lifecycle, locale, viewport, fingerprint and capture time.
No binary image or browser observation is treated as canonical storefront state.

For a `passed` disposition, every retained coverage row must reference a `screenshot` or
`browser-route` observation whose lifecycle, surface, locale, viewport and renderer fingerprint
match that current scenario. The reviewer record is runtime-validated with a recognized human role,
reviewer identity and retained review method. Unrelated screenshot or browser references are
rejected. Reviewer-level and per-reference capture timestamps may be null or equal to the review
time, but cannot be later than the retained review time.

## Findings and protected state

Findings are immutable typed records: stable ID, criterion, affected coverage, existing closed `info`/`warning`/`blocker` severity, concise description, retained evidence, optional correction, and closed disposition/status.
Failed and blocked decisions require a finding; unknown evidence or coverage references fail closed.
An open `needs-correction` finding or any unresolved blocker cannot coexist with a passed criterion.
Resolved historical findings and explicitly acknowledged accepted risks remain auditable without
blocking a subsequent valid passed decision; deferred and unresolved findings continue to affect the
derived protocol disposition according to their decision state.

This protocol observes rather than changes canonical commerce, navigation, media bindings, approved asset IDs/provenance, PageBlueprint materializations, registry authority, renderer output, proposal lifecycle or `StorefrontSnapshot`.
It makes zero OpenAI or other provider calls.

## Relationship to P10A-07A and deferred work

P10A-07A provides deterministic structural evidence and exposes only a `not-reviewed` human visual placeholder.
P10A-07B supplies the bounded retained human-review contract without claiming that tests automate commercial judgement.
Existing deterministic browser screenshots may be referenced where available; this task makes no renderer, screenshot styling, image-loading, or Playwright path change.

Final human commercial-review execution remains deferred until P10A-04C, P10A-05 and P10A-06 capability work is complete.
P10A-07C remains responsible for controlled real-provider acceptance.
No SDD or synchronized DOCX change is made by this bounded protocol foundation.
