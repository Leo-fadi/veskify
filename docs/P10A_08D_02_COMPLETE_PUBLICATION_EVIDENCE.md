# P10A-08D-02 — Complete Publication Evidence

**Status:** Baseline

**Evidence date:** 2026-08-07

**Evidence boundary:** deterministic contract/unit, integration, browser/E2E, and narrow retained
human publication review

**External AI-provider calls during publication:** zero

## Outcome

The P10A publishing chain is now evidenced end to end for manual and accepted-AI authority:

```text
trusted draft or durable accepted-snapshot receipt
  → authoritative preparation
  → deterministic compilation
  → independent confirmation recompilation
  → atomic snapshot/artifact/version/operation/pointer commit
  → active published homepage
  → active published collection
  → active published PDP
```

This record correlates existing canonical authorities and their executable tests. It introduces no
publisher, snapshot model, commerce copy, provider behavior, or commercial-quality claim.

## Correlated evidence record

The retained record is `p10a-08d-02-publication-evidence-2026-08-07`. Runtime-generated identities
remain in their authoritative repository records; the evidence tests assert exact equality rather
than copying mutable samples into prose.

| Correlated field   | Authoritative value and proof                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project            | Exact `Project.id` in preparation, operation, artifact, version, pointer, and route projection.                                                                                  |
| Source snapshot    | Exact draft/source ID, revision, and canonical content fingerprint in preparation and artifact.                                                                                  |
| Publication source | Discriminated `manual` or `accepted-ai`; cross-kind fallback is rejected.                                                                                                        |
| Accepted receipt   | Opaque receipt ID at the browser boundary; exact receipt fingerprint, proposal lineage, and accepted snapshot identity are independently reloaded into the accepted-AI artifact. |
| Preparation        | Server-created preparation ID with exact project/draft/published and active-version preconditions.                                                                               |
| Operation          | Immutable publication-operation identity/key correlated by the artifact and version.                                                                                             |
| Compilation        | Exact compile-receipt ID/fingerprint and result runtime/validation fingerprints, recompiled at confirmation.                                                                     |
| Artifact/version   | Integrity-checked immutable artifact and append-only version; the version references that exact artifact.                                                                        |
| Active pointer     | Exact version, artifact, and published-snapshot identities plus integrity fingerprints.                                                                                          |
| Published snapshot | Exact canonical ID and content fingerprint shared by active pointer, version, repository projection, and route source.                                                           |
| Routes             | Root homepage, `/collections/jewellery`, and `/products/custom-halo-ring` retain the exact session authority and resolve the same active version, artifact, and snapshot.        |
| Restore lineage    | A → B → restored A as a new draft → fresh C; C references B as predecessor while A/B remain immutable.                                                                           |
| Failure result     | Stale and injected transaction failures preserve aggregate, active pointer/artifact, published snapshot, operation state, and version history with no orphan records.            |
| Provider count     | Browser network observation and provider-free compiler/repository tests retain zero external AI-provider calls during prepare, confirm, render, restore, and republish.          |

## Evidence matrix

| Gate                                         | Result | Retained executable evidence                                                                                                 |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Manual prepare/compile/confirm               | Passed | `tests/e2e/p10a-08d-02-complete-publication-evidence.spec.ts`; `tests/unit/p10a-08c-02b-atomic-compiled-publication.test.ts` |
| Accepted-AI receipt/compile/confirm          | Passed | Dedicated P10A-08D browser case; `tests/unit/p10a-08b-02-accepted-ai-receipt-wiring.test.ts`                                 |
| Exact artifact/version/pointer correlation   | Passed | P10A-08C-02B unit and IndexedDB integration suites                                                                           |
| Published home/collection/PDP                | Passed | Dedicated P10A-08D route chain and `tests/integration/p10a-08d-published-render-target-closure.test.tsx`                     |
| Draft/published isolation                    | Passed | Dedicated manual browser case and existing publication-confirmation isolation journey                                        |
| Stale preparation/authority drift            | Passed | Publication gateway, compiler, accepted-receipt, and browser stale-review regressions                                        |
| Injected atomic failure/no orphan            | Passed | In-memory and IndexedDB artifact/version/pointer failure regressions                                                         |
| Immutable history/active version             | Passed | P10A-08C-02B append-only and stale-active-version regressions                                                                |
| Restore-to-draft/explicit republish          | Passed | A/B/A-restored/C regression plus browser history restore journey                                                             |
| Browser-supplied compiler authority rejected | Passed | Strict gateway request schemas and dedicated browser request-body assertions                                                 |
| Zero external provider calls                 | Passed | Dedicated browser counters and provider-free compiler/storage tests                                                          |

## Manual publication result

The dedicated browser case starts from the canonical Lumo draft, saves a bounded heading change,
prepares manual authority through the real same-origin server gateway, confirms publication, and
observes a changed safe published fingerprint. The browser request contains no compiled result,
compile receipt, artifact, version, or pointer. Published home, collection, and PDP routes all
render successfully. A later browser-local saved draft changes the draft/preview while the live
published fingerprint and route content remain version A.

Repository evidence completes the correlation: preparation and confirmation compile the same
source fingerprint, the transaction creates the exact artifact/version/operation, and the active
pointer references their published snapshot.

## Accepted-AI publication result

A deterministic governed whole-storefront proposal is accepted through the authoritative server
boundary. Before acceptance, the browser records the prior active published snapshot identity and
safe fingerprint. After acceptance, it records the authoritative accepted draft identity and
fingerprint while proving the active publication has not yet advanced. The client receives no
snapshot, runtime, receipt body, or compiler authority; its Publish request carries only the opaque
accepted-receipt ID. Preparation and confirmation each reload the durable receipt and current
proposal/snapshot authority independently.

Confirmation creates a different active version and artifact from the baseline. The artifact's
source snapshot and accepted-AI authority match the accepted draft fingerprint, accepted snapshot,
opaque receipt, and proposal lineage; the version and pointer match that exact artifact and newly
published snapshot. The published snapshot's canonical content fingerprint equals the accepted
snapshot fingerprint. The homepage, collection, and PDP preserve the exact `p9-05b-session` query
authority and independently resolve the same active version, artifact, and snapshot. Missing or
incorrect session authority cannot read the correlated evidence.

Manual publication stores no receipt lineage. Accepted-AI publication cannot fall back to manual,
and manual confirmation cannot claim accepted-AI authority.

## Failure, isolation, and active-version result

Negative evidence covers stale project/draft preparation, stale active-version preconditions,
stale accepted receipts, post-preparation draft mutation, compiler/registry/profile/asset/commerce
drift, strict rejection of browser compiler fields, and authority-kind confusion. Each failure
occurs before the active pointer advances.

Deterministic transaction injection at artifact, version, and pointer stages proves the previous
active version, artifact, published snapshot, operation state, and history remain byte-equivalent.
No cleanup path is needed because no partial state commits. Browser stale-review and isolation
journeys confirm customer-facing routes continue rendering the previous published content.

## Restore and explicit republish result

The retained repository lifecycle publishes A, publishes B, restores A's published snapshot as a
new canonical draft, and verifies B remains active. Explicit Publish recompiles that restored draft
into a new artifact and version C. C becomes active and names B as its predecessor; A and B remain
unchanged history. C does not reuse or repoint A's artifact. The browser history journey separately
confirms restore is presented as a new draft and does not directly change the published storefront.

## Human publication review

The narrow functional publication review passed:

- the expected published homepage rendered from the selected publication;
- the representative Jewellery collection and Custom Halo Ring PDP were populated and navigable;
- collection commerce and PDP media/options were not blank or visibly broken;
- a later draft edit did not change customer-facing content;
- failure observations left the prior published route visible;
- restore remained draft-only until explicit republish in the correlated lifecycle.

This verdict checks publication-state integrity only. It does not claim premium composition,
commercial differentiation, final responsive art direction, or P10B visual acceptance.

## Zero-provider proof

The dedicated browser journey records zero requests to an external OpenAI endpoint or AI operation
route during publication. Accepted-AI setup uses the repository's deterministic governed proposal
authority before publication. The compiler, repository transaction, route rendering, restore, and
republish paths have no provider dependency. No OpenAI or Vesko call was made for this evidence.

## Remaining P10A work

P10A-09 remains Planned and owns the phase closure record, synchronized final limitations, and
formal P10A disposition. This task does not close P10A and does not change P10B or P10C ownership.
