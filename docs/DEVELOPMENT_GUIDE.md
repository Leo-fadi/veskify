# Veskify Development Guide

**Version:** 1.2.2
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
`BrandSystem → registered PageBlueprint recipe profile → family/variant → constrained instance override`.

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

The v1.2.2 baseline is `4a96a5a5567b83e62306f73f7069e0e09f0c8683` on 31 July 2026 and
includes P9R-06 homepage routing. The earlier v1.2.1 baseline
`8174b1a6d31301b4072622e2e3ef675957479121` remains historical PR #123 evidence. At the v1.2.2
baseline, the following are verified:

- controlled storefront schemas and registered components;
- visual editor and manual section operations;
- selected-section, current-page and whole-storefront proposals;
- secure real OpenAI provider adapter;
- atomic whole-storefront acceptance and composite undo/redo;
- separate save draft and publish flows;
- history and restore architecture;
- Karvonen/Lumo fixtures and deterministic or mocked-provider lifecycle coverage.

Do not rebuild these systems. Phase 9 remains active because the repository does not retain the
complete live-provider, browser and visual evidence required for meaningful coordinated
shared-frame/home/collection/PDP generation.

All generation and editing paths compile into the same `StorefrontSnapshot`. `PageModel` is an
implementation type inside that aggregate, not a second canonical page graph.

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

## 6. Task design

Every task prompt must include:

1. outcome-based title;
2. merchant-visible objective;
3. SDD sections, requirement IDs and acceptance criteria;
4. exact branch and existing PR if applicable;
5. dependencies and required base commit/PR;
6. owned files/modules and files not to touch;
7. in-scope and out-of-scope functionality;
8. user flow and UI states;
9. data/schema/migration impact;
10. focused tests;
11. validation limits;
12. commit, push, PR and review instructions;
13. final report format.

Ask before starting:

> What can the merchant do after this PR that they could not do before?

Architecture-only tasks are allowed only when they directly unlock a named merchant capability and have a clear consumer task.

## 7. Development sequence

### Phase 9 — Meaningful grounded generation

Complete compatible shared-frame/home/collection/PDP composition, live registered-capability
reachability, commerce/asset preservation, atomicity, persistence/publish, responsive/accessibility
and retained real-provider evidence. Token-only or API-response-only success does not pass.

### P10A — Grounded orchestration

Freeze vocabulary, audit capabilities, define executable PageBlueprint contracts, generate the
Component Knowledge Registry from those contracts, define separate initial/follow-up Skill package
contracts, define scoped router/authority/validation contracts, run golden-store gates and compile
publication deterministically. P10A defines and validates scopes; it does not deliver
merchant-operable granular editing.

P10A Tasks 6–9 are the commercial-composition delivery sequence after the existing Phase 9 gate:
Task 6 approves the vocabulary, PageBlueprint-profile, bounded-parameter, inheritance, reachability
and visual-evidence contracts; Task 7 implements commercial families; Task 8 implements coordinated
registered PageBlueprint recipe profiles; Task 9 proves AI composition and commercial visual
quality. These tasks are not Phase 9 closing requirements, and Tasks 7–9 must not begin before Task 6
is approved.

### P10B — Assets and Storefront Studio UX

Add asset upload/library and generated-image lifecycle, then merchant-facing Studio workflows that
consume the P10A contracts.

### Phase 11 — Granular editing

Implement and expose the P10A-defined selected-section, current-page, shared-frame, design-system
and complete-storefront scopes as working merchant features, including selection,
add/remove/reorder/replace, preview, acceptance, mixed-scope history, Undo/Redo and merchant scope
controls/warnings without permission widening.

### Phase 12 — Stable domains and reference adapters

Consolidate stable canonical ports and a Vesko reference adapter. Authentication, tenancy, staging,
deployment and production operations follow later.

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

For commercial-family/PageBlueprint-profile work, P10A acceptance additionally records the full
reachability chain (registered → planner-selectable → proposal-expressible → compiler-preserved →
`StorefrontSnapshot`-stored → renderer-visible → editor-editable → manually live-proven) and
screenshot-level browser review of homepage, collection and PDP at 375, 768, 1024 and 1440 px using
representative approved assets. Schema-valid or placeholder-only evidence does not close a phase.

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
