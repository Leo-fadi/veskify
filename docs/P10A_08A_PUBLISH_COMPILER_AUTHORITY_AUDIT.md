# P10A-08A — Publish and Compiler Authority Audit

**Scope:** repository audit and implementation plan only.
**Audited branch:** `codex/p10a-08a-publish-compiler-authority-audit`
**Excluded:** provider calls, storefront publication, runtime/schema changes, golden-baseline changes, and SDD/DOCX changes.

## 1. Executive conclusion

The repository has a real guarded **saved-draft publication transaction**. It validates the canonical snapshot and current legacy registry, checks project/snapshot revisions plus canonical-content fingerprints, atomically advances published and synchronized-draft pointers in IndexedDB, retains earlier published snapshots, and has an optional server-authoritative gateway with permission and durable idempotency controls.

It does **not** implement the P10A-08 authority required by `docs/VESKIFY_SDD.md:309-314` and AC-135. Current publish does not consume an accepted-snapshot authority record; the P10A whole-storefront compiler emits a transient `WholeStorefrontRuntimeState`, not an immutable publish runtime snapshot; and the active browser route calls the local repository directly rather than the authoritative gateway. Publishing also does not deterministically validate/compile the accepted snapshot through generated capability-manifest, executable PageBlueprint, V2-version, migration, required-asset, and critical-accessibility authority.

The smallest truthful closure is three dependent tasks: accepted-snapshot publish authority; deterministic compile plus atomic immutable-runtime publication/rollback closure; and exact rendered-storefront evidence. They must extend the existing `StorefrontSnapshot`, `ProjectRepository.publish`, and `StorefrontPublishingGateway` boundaries, not add another snapshot, page graph, persistence model, or publisher.

## 2. Required product contract

The SDD makes `StorefrontSnapshot` the canonical editable aggregate for generation, editing, preview, save, history, and publication (`AGENTS.md` §3.2; `docs/VESKIFY_SDD.md:131-153`). P10A-08 requires:

```text
validated draft StorefrontSnapshot
  -> publish-time validation
  -> immutable runtime snapshot
  -> published renderer
```

It must reject invalid bindings, unknown component versions, missing required fields or critical assets, protected-field violations, critical accessibility failures, and unresolved migrations; it must have no LLM, Puck runtime, provider proposal, or browser-accessible credentials at publication (`docs/VESKIFY_SDD.md:309-314`, AC-135 at `:1884`). FR-115 keeps acceptance, save, publish and restore distinct (`:601`; merchant clarity at `:1626-1635`).

## 3. Current canonical path

### 3.1 Actual implemented path

```text
AI/provider proposal or manual editor change
  -> client/runtime acceptance and undo/redo (where applicable)
  -> active in-memory StorefrontSnapshot
  -> explicit validated Save draft
  -> persisted draft StorefrontSnapshot
  -> preparePublish (comparison/fingerprints/change summary; no write)
  -> confirmPublish
  -> ProjectRepository.publish transaction
  -> immutable published StorefrontSnapshot + distinct synchronized draft
  -> published route resolves project.publishedSnapshotId
  -> shared registered renderer with renderTarget="published"

History target -> prepareRestore / confirmRestore -> ProjectRepository.restore
  -> new draft StorefrontSnapshot only
  -> later explicit normal publish is required for public activation
```

### 3.2 Authority breaks before P10A-08

The whole-storefront proposal compiler is not the publish compiler. `src/application/whole-storefront-proposal-lifecycle/compiler.ts` emits and validates `WholeStorefrontProposal` / `WholeStorefrontRuntimeState`; `src/integrations/ai/whole-storefront-runtime-authority.ts` later projects it into legacy `SectionInstance` data. Publish neither invokes `compileWholeStorefrontProposal` nor records its proposal ID, acceptance state, profile/version authority, or compiler output.

The normal route has a separate material gap: `PublishClient` constructs `createBrowserProjectRepository()` and directly invokes `preparePublish` / `confirmPublish` (`src/app/projects/[projectId]/publish/publish-client.tsx:47,180,214`). The stricter `StorefrontPublishingGateway` exists, but this route does not use it.

## 4. File-by-file authority map

| Layer | Existing authority and contract | Existing guarantee | P10A-08 status |
| --- | --- | --- | --- |
| Canonical aggregate | `src/domain/storefront/storefront.ts` — `storefrontSnapshotSchema`; `canonical-storefront.ts` — `canonicalStorefrontContentFingerprint` | Schema, navigation references, deterministic content identity. | Authoritative editable aggregate; no accepted/compiled publication lineage. |
| Registry validation | `src/components/registry/registry.ts` — `validateRegisteredSnapshot`; `src/services/storage/repository-validation.ts` — `validateRepositorySnapshot` | Validates current registered legacy sections against catalogue/render context. | Precondition only; not generated capability/profile/migration/a11y compiler. |
| Proposal compiler | `whole-storefront-proposal-lifecycle/compiler.ts` — `compileWholeStorefrontProposal`, `validateWholeStorefrontProposal`, `replayWholeStorefrontProposalOperations` | Deterministic plan replay and stale plan/project/draft/registry/commerce/asset guards for transient runtime state. | Not invoked by publish or persisted as publication authority. |
| Proposal lifecycle | `whole-storefront-proposal-lifecycle/lifecycle.ts` — `WholeStorefrontProposalAcceptanceCoordinator`; editor `use-design-agent-session.ts` | Review, accept/reject, atomic in-memory replay and undo/redo. | Acceptance not durably bound to a publishable snapshot. |
| Draft save | `src/application/draft-save/save-editor-draft.ts` — `assembleValidatedEditorDraft`, `saveValidatedEditorDraft`; `ProjectRepository.saveDraft` | Revalidates complete canonical candidates and loaded-draft base. | Publish sees only saved content, not accepted lineage. |
| Publish preparation | `src/application/publishing/prepare-publish.ts:51`; `contract.ts` — `PublishPreparation` | Read-only aggregate validation plus identities, fingerprints and change summary. | Does not compile or assert accepted lineage. |
| Confirmation | `src/application/publishing/confirm-publish.ts:50,80` | Rechecks state then calls one publish command. | Does not call P10A compiler. |
| Persistence/pointers | `src/services/storage/project-repository.ts:78-96`; `indexed-db-project-repository.ts:685-886` | Distinct published/synchronized snapshots, pointer advance, history and optional operation record. | Strong transaction seam; no immutable runtime artifact. |
| Authoritative gateway | `src/application/vesko-integration/contract.ts` — `publishStorefrontRequestSchema`, `StorefrontPublishingGateway`; `authoritative-publishing-adapter.ts:400-452` | Authenticated identity, `publishStorefront` permission, authoritative saved draft, durable idempotency. | Reuses preparation, not accepted compile authority; not wired into browser route. |
| Active rendering | `preview-mode.ts`; `project-preview-client.tsx`; published homepage/collection/product routes | Published routes resolve `publishedSnapshotId` and render its context using `renderTarget: "published"`. | Exact current snapshot renders; no independently immutable compiled runtime. |
| Restore | `src/application/history/{contract,history}.ts`; `ProjectRepository.restore`; `indexed-db-project-repository.ts:888-1016` | Fingerprinted restore creates a fresh draft and preserves published pointer. | Correct baseline; no one-command public rollback. |

## 5. Audit answers

| Question | Evidence-backed answer |
| --- | --- |
| What canonical object is publishable? | The saved `StorefrontSnapshot` selected by `Project.draftSnapshotId`, after aggregate/registry validation. It is not proposal, Puck data, planner payload, or runtime projection. |
| Can a proposal bypass acceptance and publish directly? | A proposal body cannot be passed to publish. But no durable accepted-proposal/accepted-snapshot lineage is required: any valid saved canonical snapshot, including manual work, can publish. Thus pending proposal cannot direct-publish, yet current publish cannot prove it is the specific reviewed accepted result. |
| Is publishing atomic? | Yes for local repository persistence. IndexedDB uses one read-write transaction across projects, catalogues, snapshots, provenance, history metadata and publication operations; in-memory stages a complete validated aggregate. This is not a deployed-domain transaction. |
| Which revision/fingerprint is checked? | Project revision plus both draft/published IDs, revisions and `canonicalStorefrontContentFingerprint`; confirmation checks before dispatch and repository checks inside write. Gateway maps to opaque revisions and authenticates current context. |
| Can stale accepted state overwrite newer draft? | Prepared publish cannot: changed project/draft/published ID, revision or fingerprint fails stale/conflict. Acceptance has its own stale guard. Missing is an accepted-snapshot receipt at publish. |
| What happens when compilation fails? | Proposal compiler/acceptance fails before active in-memory mutation. There is no publish compiler. Existing preparation validation fails before write; repository validation/transaction failure aborts publication. |
| Can partial output become active? | Not through `ProjectRepository.publish`: snapshots, pointers, metadata and optional operation record commit or abort together. No P10A runtime output exists to prove runtime partial-output isolation. |
| How is prior active version retained? | Each publish creates a new published snapshot; older published snapshots remain immutable and are excluded from managed-draft compaction. |
| Is rollback new publication or in-place mutation? | Current rollback is restore-to-draft: clone historical snapshot to a new draft while preserving public pointer. It is neither in-place nor a new publication; later explicit publish is required. |
| Is rollback atomic? | Restore-to-draft is atomic with project/current-draft/target revision and fingerprint expectations. A public rollback publication command does not exist. |
| Can AI/provider code invoke publish? | Proposal runtime does not own publish and preflight asserts acceptance does not publish. Gateway requires separate authenticated `publishStorefront` authority. Browser local route has no provider call, but also bypasses gateway authority. |
| Are commerce truth, price, stock, routes and product media protected? | Snapshot/registered component and dynamic renderer contracts protect current bindings; compiler has protected-state fingerprints; render context uses canonical catalogue. P10A still lacks one publish-time V2/profile/migration/protected-state report. |
| Are components, variants, profiles and assets revalidated? | Legacy registered sections/variants and approved placement shapes are revalidated. Executable profiles, generated-manifest entries, V2 versions, slot/order compatibility, migration resolution, required roles and critical a11y are not all publish-revalidated. |
| Is output exact published snapshot? | Current routes resolve exact `publishedSnapshotId`, build context from it and use shared renderer. No persisted compiled-runtime fingerprint/parity assertion binds every route to compiler output. |
| Are preview and published separate? | Yes: distinct snapshot selector/path prefix and `renderTarget`; shared renderer is intentional. |
| Is publish idempotent? | Direct `confirmPublish` becomes stale after success. The optional gateway is durable-idempotent by scoped request ID plus full request fingerprint, including ambiguous-response reconciliation. |

## 6. Stale-state and atomicity analysis

`preparePublish` is read-only; `confirmPublish` rereads and `ProjectRepository.publish` rechecks inside its write boundary. The current protected tuple is:

```text
(project id, project revision,
 draft id/revision/content fingerprint,
 published id/revision/content fingerprint)
```

This blocks ordinary stale confirmation and same-ID/same-revision content rewrites racing between read and write. The gateway adds tenant/merchant/organization/store/project/user identity, explicit permission, preparation ID, opaque revision mapping, and durable request-id idempotency.

The gap is exact: that tuple contains no accepted proposal/transaction ID, accepted snapshot fingerprint, PageBlueprint/profile version, manifest fingerprint, migration proof, or compile-result fingerprint. It protects saved-snapshot freshness, not accepted-proposal lineage.

## 7. Compile-failure behavior

Existing safe behavior:

- Proposal compiler/lifecycle failures reject or retain original active in-memory draft.
- Save validation failures prevent persistence.
- `preparePublish` aggregate/legacy registry failure returns `PublishPreparationValidationError` before write.
- Confirmation conflict/no-change/transaction failures retain prior published and saved states.

Missing P10A behavior: a deterministic publish compiler must return merchant-safe typed rejection for every specified category before any runtime artifact, active pointer, operation record or publish history is committed. Tests must inject each failure after acceptance and immediately before commit.

## 8. Active-version and rollback analysis

Public active state is `Project.publishedSnapshotId`. Publish mints a new immutable published snapshot and distinct canonically-equal synchronized draft, then advances both pointers once. The former public snapshot remains retained and previewable.

`confirmRestore` intentionally mints a new draft and leaves the public pointer unchanged. P10A must retain that semantic: either restore-as-draft followed by explicit normal publish (smallest path), or a separately named explicit idempotent publication from immutable history. Never mutate a historical published record/pointer in place.

## 9. Protected-state analysis

Current defenses:

- Snapshot has no writable price, stock, inventory or product model; it has composition and `catalogueRef`.
- Repository validation parses canonical snapshot and validates each section against registered component/catalogue context before save/publish.
- Whole-storefront compiler protects project/draft, canonical commerce, bindings, navigation and approved assets with preconditions/fingerprints.
- Approved asset placement carries ID/role/revision/material fingerprint; dynamic renderers check canonical product-media relations.

Missing is one P10A publish-time conformance report proving generated-registry/profile compatibility, protected commerce bindings/routes/media, approved asset provenance, migration completion and renderer-visible values. Add that gate; do not weaken the current registered validation.

## 10. Security and bypass analysis

The current application publish layer has no AI/provider dependency; controlled acceptance explicitly checks it did not publish. The gateway rejects client snapshot bodies and reloads authenticated permission/identity. The remaining risk is authority wiring:

- The gateway is authoritative when used, but current `PublishClient` uses browser IndexedDB directly.
- A `PublishPreparation` is an integrity/concurrency receipt, not an accepted-snapshot authorization record.
- Repository adapters are intentionally local seams, not Vesko deployment authority.

P10A must keep provider code unable to acquire publish authority, require a server-owned accepted compile receipt for production publishing, and preserve direct repository use only as explicit standalone/test behavior.

## 11. Required implementation tasks

### P10A-08B — accepted-snapshot publish authority

| Item | Plan |
| --- | --- |
| Objective | Bind reviewed accepted canonical `StorefrontSnapshot` to immutable server-owned acceptance receipt. Require exact receipt/snapshot/project/fingerprint lineage for P10A publishing, while keeping separately authorized manual-save semantics. |
| Owning layer | Application/domain acceptance and publishing contracts; authoritative integration boundary. |
| Likely files | `src/application/controlled-acceptance-preflight/**`, `whole-storefront-proposal-lifecycle/**`, `application/publishing/{contract,prepare-publish,confirm-publish}.ts`, `application/vesko-integration/contract.ts`, publishing adapter, focused helpers/tests. |
| Contracts to reuse | `StorefrontSnapshot`, canonical fingerprints, proposal preconditions/replay, `PublishPreparation`, `ProjectRepository.publish`, `publishStorefrontRequestSchema`, merchant authorization. |
| Tests required | accept → receipt → save/reload → publish; pending/rejected/stale/foreign/mismatched receipt rejection; newer save stales receipt; declared manual-edit policy; provider cannot forge receipt. |
| Dependencies | Merged P10A-03/04 and P10A-07C acceptance work, including W1-owned changes. |
| Risks | Accidentally forbidding manual edits or storing a second snapshot/tree; unclear receipt lifetime/ownership. |
| Out of scope | UI redesign, provider call, PageBlueprint redesign, commerce mutation, one-click public rollback. |

### P10A-08C — deterministic compile, atomic active version and rollback closure

| Item | Plan |
| --- | --- |
| Objective | Compile accepted canonical snapshot deterministically to immutable renderer runtime receipt; reject every P10A category; atomically retain its identity/fingerprint with existing snapshots/pointers/history/idempotency. Prove restore-to-draft then explicit republish. |
| Owning layer | Application publishing compiler, registry/capability adapter, storage/publishing integration. |
| Likely files | Narrow compiler under `src/application/publishing/`; publishing contract/prepare/confirm; storage repository/validation/adapters; authoritative gateway; renderer-conformance helpers. |
| Contracts to reuse | Generated manifest/renderer conformance from P10A-04; executable PageBlueprint/profile from P10A-03; `validateRegisteredSnapshot`; commerce/assets; existing atomic command and publication-operation record. |
| Tests required | Stable identical compile; unknown/stale component/variant/profile, incompatible binding/order, missing asset/field, protected mutation, a11y and unresolved migration rejection; failure leaves all state/history/idempotency unchanged; atomic fingerprint retention; races/idempotent retry; restore then republish. |
| Dependencies | 08B and merged P10A-03/04 authority. |
| Risks | Competing persisted page graph/runtime source, transient state leaked into snapshot, history-retention regression. |
| Out of scope | Live deployment, cart/checkout, browser polish, provider changes, generated assets, in-place rollback. |

### P10A-08D — rendered-storefront end-to-end evidence

| Item | Plan |
| --- | --- |
| Objective | Prove accept → compile → publish → exact homepage/collection/PDP render → restore-to-draft → explicit republish, without provider call at publish. |
| Owning layer | Integration/e2e evidence and renderer route adapters; no new authority. |
| Likely files | Focused specs near `tests/integration/publish-route.test.tsx`, `tests/e2e/publish-confirmation.spec.ts`, `tests/e2e/history-restore.spec.ts`, collection/product route specs and P10A evidence helpers. |
| Contracts to reuse | Published selector/path prefix, shared render context, 08C receipt/fingerprint, canonical commerce, restore route/gateway. |
| Tests required | Exact compiled/published fingerprint; all route families; draft/published isolation; stale receipt; no provider invocation; asset/media/price/stock preservation; 375/768/1024/1440 browser evidence. |
| Dependencies | 08B, 08C and P10A-07 golden-store fixtures/evidence. |
| Risks | Shared renderer mistaken for exact compiler parity; fixture-only proof; tests bypassing active gateway. |
| Out of scope | Component/profile work, provider test at publish, deployment automation, unrelated editor workflows. |

## 12. Exact acceptance evidence needed

1. Accepted receipt identifies exact snapshot, project revision, canonical fingerprint, capability/profile authority and acceptance transaction.
2. Publish accepts no proposal body, Puck state, provider payload, browser runtime tree or arbitrary saved snapshot; it consumes authoritative accepted lineage.
3. Compiler output/fingerprint is deterministic and publish makes no provider/LLM/Puck/browser-credential call.
4. Every P10A failure leaves draft, published pointer, history, artifact and idempotency record unchanged; no partial runtime becomes active.
5. Compile/runtime identity is atomically retained with published/synchronized snapshots; stale and ambiguous retries preserve current guarantees.
6. Homepage, collection and PDP routes render exact committed authority, not current draft/recomputed changed capability data.
7. Canonical IDs, price, compare-at, SKU, options, availability, routes and product media remain canonical; assets preserve provenance.
8. Restore is a new draft; explicit republish creates a new immutable publication; keyboard/focus and 375/768/1024/1440 proof pass.

## 13. Recommended PR decomposition

1. **08B:** receipt/lineage contract and tests; merge after W1 P10A-07C work is stable and without overlap in W1 canonical ownership.
2. **08C:** compiler receipt plus existing repository/gateway transaction integration; depends on 08B and P10A-03/04; no route redesign.
3. **08D:** renderer/e2e/manual evidence only; consumes 08B/08C and does not alter persistence/publish authority.

This preserves the existing repository/gateway as the only write boundary and keeps `StorefrontSnapshot` canonical.

## 14. Current test evidence and remaining manual QA

Existing focused evidence:

- `tests/unit/publishing.test.ts`: fingerprints, stale races, atomic published/synchronized snapshots, retention and protected-commerce preservation.
- `tests/unit/authoritative-storefront-publishing-adapter.test.ts`: authoritative source, arbitrary client snapshot rejection, stale/tenant/permission controls, durable idempotency and ambiguous commit reconciliation.
- `tests/unit/whole-storefront-proposal-lifecycle.test.ts`: deterministic replay, acceptance/rejection and atomic runtime undo/redo.
- `tests/integration/publish-route.test.tsx`: exact reviewed saved draft plus stale/failure UI behavior.
- `tests/e2e/publish-confirmation.spec.ts` and `tests/e2e/history-restore.spec.ts`: local IndexedDB publish, immutable published navigation, restore-to-draft and confirmation viewport checks.

Manual/browser QA after implementation: homepage, collection and PDP for complex product and non-jewellery catalogue at 375/768/1024/1440; visible published-vs-draft isolation after later edit; stale acceptance/publish and compiler-failure messages; keyboard-only accept/review/publish/restore; and canonical price, availability, options, routes and media correctness.

## 15. Explicit non-goals

- No provider call, publication, deployment/domain rollout, or runtime behavior change in this audit.
- No second publisher, snapshot, runtime page graph, recipe engine, component registry, or commerce model.
- No commerce/inventory/order/cart/checkout/payment/tax/logistics mutation.
- No silent republish on restore, historical published mutation, or rollback-in-place.
- No P10A-03/04/07 contract, golden-baseline, SDD/DOCX or W1-owned change as part of P10A-08 closure.
