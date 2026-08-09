# Veskify Development Guide

**Version:** 1.3.0
**Aligned with:** `docs/VESKIFY_SDD.md` and `AGENTS.md`

## 1. Purpose

This guide defines how Veskify is developed, tested, reviewed and handed off while preserving the controlled design-agent architecture and the Vesko integration boundary.

The goal is fast, parallel delivery without duplicate commerce models, conflicting canonical contracts, unnecessary Codex usage or stale branches.

## 2. Repository ownership map

### Canonical domain and contracts

Typical locations:

- `src/domain/**`
- `src/application/**/contract.ts`
- versioned schema modules

Owns projects, pages, sections, snapshots, brand systems, proposals, operations, product-presentation contexts, bindings, source evidence, asset inventory and Storefront Design Brief contracts.

Canonical modules must not import Puck or provider-specific types.

### Component platform

Typical locations:

- `src/domain/component-platform/**`
- `src/application/storefront-design-system/**`
- `src/application/storefront-templates/**`
- `src/components/storefront/**`

Owns component families, variants, slots, editable fields, data-binding requirements, page permissions, responsive/accessibility rules, renderer mapping and migrations.

Commercial family work uses one maintained renderer implementation with materially meaningful
variants, not colour/padding renames. Commercial recipes are registered constrained
`PageBlueprint` profiles that supply permitted/default slots, compatibility, order,
bindings/assets, responsive constraints and omission/fallback rules; they are not a second template
or executable page representation. AI can select only typed bounded parameters; it never provides
arbitrary trees, CSS, classes, code or font imports. Design inherits
`BrandSystem → registered PageBlueprint profile → compatible component family and meaningful variant → bounded validated instance override`.

### Puck integration

Location:

- `src/integrations/puck/**`

Owns direct Puck imports, canonical-to-Puck mapping, transient editor configuration and validated Puck-to-canonical handoff. Puck is not persistence or canonical state.

### Design agent

Typical locations:

- `src/domain/design-agent/**`
- `src/application/design-skills/**`
- `src/application/design-operations/**`
- `src/application/ai-storefront-generation/**`
- `src/application/whole-storefront-generation-plan/**`

Owns skills, planning contracts, structured operations, provider adapters, proposal lifecycle, merchant summaries and guarded application.

### Source discovery and onboarding

Typical locations:

- `src/domain/source-discovery/**`
- `src/services/source-discovery/**`
- `src/domain/storefront-design-brief/**`
- `src/features/onboarding/**`

Owns source evidence, provenance, crawl adapter contracts, reconciliation, asset inventory and approved Storefront Design Briefs.

### Vesko and persistence adapters

Typical locations:

- `src/integrations/vesko/**`
- `src/services/storage/**`
- `src/services/media/**`
- `src/services/publishing/**`

Owns adapter interfaces and standalone implementations. Features depend on interfaces rather than IndexedDB, seed or future Vesko implementation details.

## 3. Current implementation baseline

The verified v1.3.0 source baseline includes merged P10B-06 plus P10B-07 on 9 August 2026. Phase 9 is
closed by product-owner handoff, and P10A is **Baseline / closed**. The overall product remains
**Partial**. P10B is the active development phase. P10B-01 commercial grammar, P10B-02 parametric
BrandSystem / Design DNA, P10B-03 component anatomy, P10B-04 responsive image/art-direction
authority, P10B-05 site-map/page-family authority, P10B-06 commercial shared-frame families, and
P10B-07 hero/editorial/campaign/proof families are **Baseline**; P10B-08 through P10B-18 remain
**Planned**.

The current baseline includes canonical storefront/brand contracts, ComponentDefinitionV2 and its
generated manifest, executable PageBlueprint profiles, registered complete page-set/site-map
authority, dynamic commerce-bound collection/PDP
rendering, governed internal initial/follow-up execution, strict internal scope routing, proposal
acceptance/history, draft persistence, an authoritative publishing gateway, deterministic publish
compilation, and published homepage/collection/PDP routes.

Do not rebuild those systems. Completed P10A capability includes governed initial and follow-up
execution, strict internal routing, controlled real-provider acceptance, accepted-AI receipt
wiring, the authoritative publish gateway, deterministic publish compilation, atomic compiled
artifact/version persistence, restore-to-draft with explicit republish, and final correlated
publication evidence.

All generation and editing paths compile into the same `StorefrontSnapshot`. `PageModel` is an
implementation type inside that aggregate, not a second canonical page graph. Governed packages
and routing are internal P10A authorities; merchant-facing routing, clarification, scope controls,
and normal-editor execution belong to P10C. P10D remains advanced media, P11 remains Vesko
integration readiness, and P12 remains production hardening.

## 4. Branch and PR strategy

- One task equals one branch, one worktree and one PR.
- Start from the latest approved `origin/main` unless the task names an unmerged dependency.
- Use outcome-based branch names, for example:
  - `codex/p5-01-component-registry-v2`
  - `codex/p7-01-source-discovery-contracts`
  - `codex/p10a-03-component-knowledge-registry`
- Use `git fetch origin` and `git merge origin/main`. Never rebase.
- Do not force-push to rewrite history.
- Update an existing open PR rather than creating a duplicate.
- Keep documentation-only updates in one documentation PR.
- Merge only after CI is green, the PR is mergeable and the single automatic review cycle is resolved.

## 5. Worktree workflow

Current worktrees:

| Window | Path                       | Default role                                                                   |
| ------ | -------------------------- | ------------------------------------------------------------------------------ |
| W1     | `/Users/leo/veskify`       | Shared contracts, component registry v2, documentation and merge-leading work. |
| W2     | `/Users/leo/veskify-p1-02` | Merchant shell and presentation-only UI.                                       |
| W3     | `/Users/leo/veskify-p1-03` | Source discovery, onboarding contracts and independent capabilities.           |
| W4     | `/Users/leo/veskify-qa`    | Manual QA and real-provider regression.                                        |

Roles may change per phase, but every task must declare ownership and no-touch areas.

### Safe parallel example

- W1 defines new component/binding contracts.
- W2 builds the Storefront Studio shell without touching domain/registry contracts.
- W3 builds source-evidence and Storefront Design Brief contracts in new modules.

### Unsafe parallel example

- two branches modify the same registry index;
- two branches alter `BrandSystem` or `StorefrontSnapshot` simultaneously;
- one branch changes option-group schemas while another builds against the old shape;
- two branches modify the same editor route/store;
- one branch changes a persistence migration while another changes bootstrap logic.

## 6. Future task design policy

Every future task must state these 11 items:

1. **Outcome** — the observable merchant, system, or evidence result.
2. **Canonical authority** — the existing model, contract, registry, adapter, or lifecycle that
   owns the result.
3. **Deficiency** — the verified current gap, without treating planned prose as implementation.
4. **Exact scope** — the bounded files, capabilities, and behavior the task may change.
5. **Dependencies** — required tasks, commits, contracts, decisions, environments, and ownership.
6. **Positive evidence** — focused proof that the authorized outcome works.
7. **Negative and fail-closed evidence** — rejected, stale, invalid, ambiguous, and no-partial-write
   behavior where relevant.
8. **Browser and visual evidence** — explicit viewport, fixture, screenshot, and human-review needs;
   tests alone cannot close P10B commercial quality.
9. **Non-goals** — adjacent systems and authorities the task must not create or change.
10. **Exit condition** — the exact implementation and evidence gate required to mark the task done.
11. **Unlocks** — the named downstream task, merchant capability, or phase gate enabled by closure.

Branch/worktree, owned/no-touch files, validation commands, commit/PR workflow, and completion
report requirements must also be explicit execution controls, but they do not replace the 11
product-delivery fields above.

Ask before starting:

> What can the merchant do after this PR that they could not do before?

Architecture-only tasks are allowed only when they directly unlock a named merchant capability and have a clear consumer task.

## 7. Development sequence

### Phase 9 — Closed by product-owner handoff

Phase 9 records remain historical evidence with their stated limits. Do not reopen Phase 9 or
reinterpret its closure as current commercial, real-provider, Vesko staging, or production proof.

### P10A — Grounded orchestration and publishing closure

Freeze vocabulary, audit capabilities, define executable PageBlueprint contracts, generate the
Component Knowledge Registry from those contracts, define separate initial/follow-up Skill package
contracts, define scoped router/authority/validation contracts, and compile publication
deterministically. P10A owns governed generation and follow-up execution, scope routing, proposal
lifecycle, controlled-provider acceptance, publishing/compiler authority, publish/render/rollback
evidence and protected-commerce correctness. It closes before commercial visual expansion and does
not deliver merchant-operable granular editing or close on commercial visual polish.

### P10B — Commercial Storefront Generation System v1

P10B-01 through P10B-18 deliver executable grammar, bounded Design DNA, meaningful component
anatomy, art direction, complete site-map/page-family authority, commercial families/profiles, an
early Premium Editorial complete-storefront slice, bounded synthesis, diversity control,
responsive/accessibility/performance closure, and a commercial quality/scale gate. P10B owns
complete-storefront generation and presentation; Vesko retains operational commerce.

The binding architecture is
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md).
It uses only `BrandSystem → PageBlueprint profile → component family/meaningful variant → bounded
validated instance override`; manual Puck editing is not a dependency. P10B closes only when 100+
complete configurations pass deterministic diversity/protected-state gates and a representative
fingerprint-stratified subset passes retained human review at 375, 768, 1024, and 1440 px.

P10B-01 through P10B-07 are Baseline; P10B-08 through P10B-18 remain Planned. Their ownership
remains disjoint: P10B-05 owns site-map/PageBlueprint page-set authority,
while P10B-03 consumes P10B-02 Design DNA compatibility where relevant without copying or replacing
its `BrandSystem` authority.
Shared registry indexes, schema exports, migrations, manifests, synthesis/direction authority, and
renderer boundaries require one integration owner. Use A/B/C slices only for necessary
contract/anatomy, renderer/variant, or PageBlueprint/generation/evidence separation; a parent is not
complete until all required slices and evidence pass.

### P10C — Storefront Studio Editing Experience v1

P10C delivers the brand asset library, canonical Puck boundary, stable frame identity, bounded
manual operations, merchant-facing scoped AI editing, unified AI/manual history and the required
Storefront Studio shell. It closes when a merchant can select, manually edit, make an AI edit
elsewhere, add/remove/reorder, undo/redo, save, preview and publish through the same
`StorefrontSnapshot`.

### P10D, P11 and P12

P10D defers registered generated media, video and GLTF/GLB/Three.js presentation with required
fallbacks. Registered, governed Three.js implementations are permitted only through registered
interactive-presentation capabilities; AI may select or configure them but may not generate their
implementation. Registered component, asset, performance, accessibility and fallback authority
continues to apply. No arbitrary generated application code or arbitrary/generated Three.js
implementation is permitted. P10D is not a dependency for the first commercial storefront,
minimum pilot editor, or Vesko pilot.

P11 closes the incomplete obtained Vesko OpenAPI contract, supplies canonical reference adapters,
and proves the lifecycle in Vesko staging. Raw `/puck` persistence is incompatible with
`StorefrontSnapshot`; Veskify commerce writes remain forbidden. P12 then supplies production
hardening, tenancy, security, observability, recovery, deployment, and pilot operations.

## 8. Testing strategy

### Focused tests per PR

Use the smallest relevant set:

- schema and contract unit tests;
- executor/rollback tests;
- component/binding tests;
- repository or adapter contract tests;
- focused React integration tests;
- one relevant Playwright journey only when the visible risk requires it;
- responsive/accessibility checks for changed components.

P10A focused acceptance records functional and publishing evidence: governed generation/follow-up
execution, routing, proposal lifecycle, controlled-provider acceptance, compiler/publish/render/
rollback behavior and protected-commerce correctness. P10B acceptance records the commercial
reachability chain for new design-system capabilities (registered → planner-selectable →
proposal-expressible → compiler-preserved → `StorefrontSnapshot`-stored → renderer-visible →
editor-editable → manually live-proven), direction differentiation and manual screenshot/browser
review of homepage, collection and PDP at 375, 768, 1024 and 1440 px using representative approved
assets. Schema-valid or placeholder-only evidence does not close P10B.

### Dynamic PDP minimum fixtures

- simple watch with one colour dimension;
- complex ring with five or six groups;
- incomplete selection;
- unavailable combination;
- selected-variant price, availability and media resolution;
- unknown product-type fallback.

### Source discovery minimum fixtures

- valid public source summary;
- blocked or unavailable source;
- conflicting public and canonical prices;
- missing logo/hero media;
- prompt-injection-like page text treated as data only;
- deterministic evidence and provenance.

## 9. Validation policy

Normal feature PR:

```text
focused tests
+ typecheck once
+ lint once
+ formatting once
+ GitHub CI broad gate
```

Do not run, unless explicitly requested:

- `pnpm validate:full`;
- full Vitest;
- full Playwright;
- repeated production builds;
- repeated validation after no relevant changes.

Run full validation only at phase/release gates, high-risk migrations, staging acceptance or explicit product-owner instruction.

### Production-build policy

Webpack is temporarily the required production-validation bundler for local validation and GitHub CI.
Use the following commands directly so their child-process exit status remains the reported result:

```bash
pnpm build
pnpm build:webpack
```

`pnpm build` is the required production gate and delegates to `build:webpack`; the explicit command
is available when the selected bundler needs to be visible in a validation record. Next.js prints
`webpack` at the start of either build.

Turbopack remains the default Next.js development technology through `pnpm dev` and is retained as
an explicit diagnostic production build:

```bash
pnpm build:turbopack
```

Do not substitute a failed or interrupted Turbopack diagnostic for the required Webpack gate. Do
not hide either command behind `|| true`, a pipeline, a generic timeout increase, or a wrapper that
changes its exit status.

Before comparing build modes or clearing generated output, first inspect the lock owner:

```bash
if [ -e .next/lock ]; then
  lsof .next/lock
else
  echo "No .next lock is present."
fi
```

On systems without `lsof`, use the platform-equivalent open-file inspection such as
`fuser -v .next/lock`. Never delete `.next` while that check identifies an active build owner. Only
after the build has exited or no lock/owner is present may the cache be cleared:

```bash
rm -rf .next
```

Silence by itself does not establish a stalled build. Preserve the last build output and collect at
least two observations of the same lock-owning PID: its elapsed time, CPU activity, child processes,
and whether `.next` receives new writes between observations. A build is conclusively stalled only
when those observations show no progress as well as no active child work. After that evidence is
recorded, a developer may recover the identified process manually; automation must not kill it.

Restore Turbopack as the mandatory production gate only after repeated clean builds across the
affected worktrees and CI complete without stalls. That restoration must change `build`, CI, and this
policy together, while retaining `build:webpack` as a diagnostic fallback until the stability change
is accepted.

## 10. Review workflow

1. Open or update the single PR for the task.
2. Allow one automatic Codex review.
3. Collect all findings.
4. Fix every valid finding once in one focused pass.
5. Run focused validation once.
6. Push and stop.
7. Do not request a second review.
8. Merge when CI is green and the PR is mergeable.

Do not continuously watch CI or create follow-up tasks after completion.

## 11. Integration readiness checklist

- One canonical `StorefrontSnapshot` remains the generation, editor, preview, save and publish IR.
- Capability knowledge is generated from live contracts; no parallel hand-maintained registry.
- Initial-generation and follow-up-editing Skill packages have distinct permissions and evidence.
- No Puck imports outside its adapter.
- No provider-specific types in canonical modules.
- No duplicate product, variant or option model.
- Canonical commerce values are read-only.
- Public source data has provenance and lower trust than Vesko data.
- Components use typed bindings and canonical IDs.
- Same components render in editor, preview and published routes.
- Dynamic PDP preserves every option group and resolver rule.
- Failed/rejected/stale proposals preserve draft and history.
- Save draft and publish remain separate.
- Merchant UI exposes no developer internals.
- Adapter interfaces have standalone fixtures and conformance tests.

## 12. Teammate handoff package

Before Vesko integration, deliver:

- authoritative SDD and ADRs;
- schema/type package with versions;
- component and page-blueprint manifests;
- project, commerce, media, source, storage, provider and publishing adapters;
- Karvonen, watch and complex-ring reference fixtures;
- conformance tests;
- environment and deployment runbook;
- mapping from Veskify contracts to Vesko services;
- unresolved decisions and ownership table.

## 13. Completion report

Report:

- merchant outcome;
- commit SHA and PR;
- changed modules;
- focused tests and totals;
- typecheck/lint/format status;
- known limitations;
- confirmation that no rebase, duplicate PR, second review request or unrelated validation was performed.

Then stop.
