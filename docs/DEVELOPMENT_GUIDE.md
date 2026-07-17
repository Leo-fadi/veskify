# Veskify Development Guide

**Version:** 1.1  
**Aligned with:** authoritative `docs/VESKIFY_SDD.md` and synchronized export `docs/VESKIFY_SDD_v1.1.docx`

## 1. Purpose

This guide defines how Veskify is implemented with Codex, GitHub, VS Code, worktrees, testing, and pull requests while preserving the controlled design-agent architecture.

The goal is fast delivery without parallel branches corrupting shared contracts or shifting the product back toward unrestricted website generation.

## 2. Repository ownership map

This ownership map describes the repository as it exists now. Future folders must not be documented as current architecture until they are introduced by an approved PR.

### Editor route and merchant-facing editor UI

Current location:

- `src/app/projects/[projectId]/editor/**`

Owns route composition, editor shell integration, page and locale switching, dirty-state presentation, proposal UI integration, and merchant-facing controls. Canonical logic must remain outside route components.

### Component registry and storefront

Current locations:

- `src/components/registry/**`
- `src/components/storefront/**`

Owns approved component types, variants, editable-field contracts, page permissions, renderer bindings, responsive rules, accessibility behaviour, and the controlled storefront design vocabulary.

### Structured design operations

Current location:

- `src/application/design-operations/**`

Owns operation schemas, validation, protected-field enforcement, deterministic execution, proposal application rules, and transaction behaviour. This layer must not depend on Puck-specific types or a specific AI provider.

### Puck integration

Current location:

- `src/integrations/puck/**`

Owns direct imports from `@puckeditor/core`, page-scoped Puck configuration, mapping between Veskify composition and transient Puck data, and validated handoff back into Veskify-owned draft state. Puck callbacks must never publish directly.

### Persistence

Current location:

- `src/services/storage/**`

Owns in-memory and IndexedDB persistence adapters, draft and published snapshot persistence, and repository interfaces. Product features depend on repository contracts rather than concrete adapters.

### Publishing application boundary

Current location:

- `src/application/publishing/**`

Owns React-independent publish preparation, canonical storefront comparison, deterministic change
summaries, explicit confirmation and stale-preparation handling. It coordinates the atomic repository
publish contract but does not own editor UI, published routes or history presentation.

### Controlled design skills and deterministic provider

Current location:

- `src/application/design-skills/**`

Owns the Veskify skill contract and registry, deterministic EN/FI intent classification, immutable
design plans, initial bounded skill implementations, transactional orchestration over the existing
design-operation executor, and the deterministic provider facade. This layer is React-independent,
does not persist or publish state, and converts successful execution through the existing proposal
lifecycle rather than defining a second proposal model or store. Provider-specific types must remain
inside future provider adapters.

### Deterministic design-agent orchestration

Current location:

- `src/application/design-agent/**`

Owns the React-independent request session state machine, clarification flow, bounded proposal
revision constraints, stale-base checks, and accept/reject/cancel/restart coordination. It composes
the existing design-skills provider and proposal lifecycle rather than duplicating their contracts.
It must not import editor, Puck, persistence, draft-save, publishing, or storefront-renderer modules.

## 3. Branch and pull-request strategy

### Rules

- One task equals one branch and one PR.
- Branch names use outcome-based identifiers, for example:
  - `codex/p2-01-editor-shell`
  - `codex/p2-02-storefront-components`
  - `codex/p3-01-design-operations`
- Start from the latest approved `main` unless the task explicitly depends on an unmerged integration branch.
- Keep PRs reviewable. Prefer one or two tightly related commits.
- Do not combine unrelated refactors, architecture documentation, and feature work.
- Open PRs as drafts while implementation or validation is incomplete.
- Merge only after CI, review feedback, and manual checks are complete.

## 4. Three-worktree parallel workflow

### Roles

- **W1 — Validation and merge control**
  - latest `main`;
  - full validation;
  - Playwright and manual QA;
  - reviewing diffs;
  - synchronizing feature branches with `origin/main`;
  - preparing prompts and resolving integration issues.

- **W2 — Merchant/editor feature**
  - Puck editor shell;
  - page and locale interaction;
  - manual editing experience;
  - proposal and chat UI integration.

- **W3 — Independent product capability**
  - storefront components;
  - design-operation engine;
  - skills;
  - data-enrichment adapters;
  - work that does not touch W2-owned files.

### Safe parallel task examples

Safe:

- W2 builds editor route and canvas shell.
- W3 builds new storefront components and registry entries in separate files with a coordinated registry integration plan.

Safe:

- W2 builds proposal/confirmation UI.
- W3 builds React-independent operation executor and skill contracts.

Unsafe:

- both branches modify the same operation schemas;
- both branches modify the same registry index or shared Puck config;
- both branches modify the same editor store;
- one branch changes canonical types while another builds against the old types.

### Merge sequence

1. Merge the branch that establishes shared contracts first.
2. In the second worktree:

```bash
git fetch origin
git merge origin/main
pnpm validate:full
git push
```

3. Fix conflicts and integration failures before pushing.
4. Reserve rebase and `--force-with-lease` for deliberate cases where nobody else depends on the branch.
5. Review and merge the second PR.

## 5. Task design

Every task prompt must contain:

- outcome-based title;
- user-visible objective;
- SDD references and requirement IDs;
- exact branch name;
- dependencies and latest required base commit/PR;
- in-scope files or modules;
- explicitly owned files that must not be modified;
- out-of-scope functionality;
- required UI states;
- required tests;
- validation commands;
- commit and PR instructions;
- requested final report.

### Product-value test

Before starting, answer:

> What can the merchant do after this PR that they could not do before?

An architecture-only task is acceptable only when it immediately unblocks a named merchant capability in the next PR.

## 6. Recommended implementation order

### Product slice A — Manual design

1. Real project editor route.
2. Page and locale switchers.
3. Puck add/select/edit/reorder/remove.
4. Unsaved state and discard.
5. High-quality component expansion.
6. Desktop/mobile preview.

### Product slice B — Controlled design agent

1. Operation schemas.
2. Deterministic executor.
3. Proposal store and status.
4. Initial skills.
5. Chat and intent planning.
6. Proposal preview and accept/reject/revise.

### Product slice C — New-store creation

1. Onboarding.
2. Brand-system generation.
3. Initial storefront workflow.
4. Guided editor introduction.

### Product slice D — Real merchant data

1. File import and mapping.
2. Media handling.
3. Presentation enrichment.
4. Review/export.
5. Vesko adapter contracts.

### Product slice E — Publish and demo readiness

1. Save draft.
2. Full draft preview.
3. Explicit publish.
4. Restore-to-draft.
5. Deployment and final QA.

## 7. Testing strategy

### Unit tests

Required for:

- Zod schemas;
- skills and operation validation;
- protected paths;
- operation execution and rollback;
- repository contracts;
- locale fallback;
- enrichment confidence and source preservation.

### Component/integration tests

Required for:

- editor states;
- Puck adapter mapping;
- proposal cards;
- accept/reject/revise;
- page and locale switching;
- component fields and variants;
- draft/published separation.

### Playwright

Required for visible user journeys:

- open project editor;
- edit a section;
- add and reorder a section;
- discard changes;
- request and preview an agent proposal;
- accept or reject proposal;
- full preview and publish;
- English/Finnish switching;
- desktop/mobile layouts;
- refresh persistence.

### Accessibility and visual checks

Use automated checks plus manual review for:

- keyboard selection and controls;
- visible focus;
- headings and landmarks;
- colour contrast;
- responsive clipping/overflow;
- editor and storefront consistency;
- component variants at supported breakpoints.

## 8. Full validation gate

Before pushing or merging:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Use `pnpm validate:full` when available. Do not report a command as passed unless it actually ran successfully.

## 9. Review checklist

### Architecture

- No Puck imports outside the integration boundary.
- No provider-specific types in canonical design-agent modules.
- No parallel page tree or duplicate model.
- No raw AI output applied directly.

### Product safety

- Draft/published separation preserved.
- Protected commerce fields unchanged.
- Rejected proposals leave draft unchanged.
- Missing business facts are not invented.

### UX

- Merchant-facing language is understandable.
- Loading, error, empty, dirty, success, and confirmation states exist.
- Responsive and keyboard interaction works.
- The feature provides visible merchant value.

### Code quality

- Full validation passes.
- Relevant Playwright coverage exists.
- No unrelated changes.
- Public APIs and limitations are documented.

## 10. Vesko integration readiness

The standalone demo must remain replaceable at integration boundaries.

Define interfaces for:

- authenticated user and project context;
- catalogue and product display data;
- media upload and retrieval;
- draft and published snapshot persistence;
- publishing command;
- brand assets and domain configuration;
- AI/provider credentials and execution;
- enrichment import/export.

Do not hard-code assumptions from IndexedDB or dummy seed data into domain and editor features. The same canonical Veskify models should map to Vesko services later.

## 11. Delivery discipline

- Build one complete jewellery journey before expanding industries.
- Keep the final week protected for reliability and demo polish.
- Prefer 10–12 excellent components over dozens of incomplete ones.
- Prefer 12–20 reliable skills over open-ended generation.
- Review generated assets before storing them.
- Stop and reassess when work no longer improves the real merchant journey.
