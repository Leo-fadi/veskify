# Veskify Codex Constitution

**Version:** 1.2
**Aligned with:** `docs/VESKIFY_SDD.md` and `docs/VESKIFY_SDD_v1.2.docx`
**Status:** Binding repository instructions

These rules apply to every Codex task and every developer working in the Veskify repository.

## 1. Source of truth

- `docs/VESKIFY_SDD.md` is the authoritative product and architecture baseline.
- `docs/VESKIFY_SDD_v1.2.docx` is the synchronized human-readable export.
- ADR-001 through ADR-004 are binding architecture decisions.
- Read the complete affected SDD sections, requirement IDs and acceptance criteria before changing code.
- Material product, architecture, schema, roadmap or integration changes require documentation updates in the same PR.
- If a task conflicts with the SDD or an ADR, stop and report the conflict. Do not silently redefine the product.

## 2. Product identity

The merchant-facing product is **Vesko Storefront Studio**. **Veskify** is the internal controlled storefront-design engine.

The product removes the heavy storefront UI, design and composition burden from Vesko onboarding. It helps merchants who may have an existing website, a logo and product imagery but no complete brand system.

The primary merchant journey is:

```text
Connect an existing website or provide minimal business inputs
  -> discover reusable design evidence and assets
  -> reconcile with canonical Vesko commerce data
  -> approve a Storefront Design Brief
  -> generate a complete storefront
  -> improve it through plain-language design requests
  -> review proposals
  -> save draft
  -> preview and publish explicitly
```

Veskify is not:

- a general-purpose code generator;
- a second catalogue, product-type, attribute or variant system;
- an inventory, order, payment, logistics, returns or tax agent;
- an unrestricted website generator;
- a merchant-specific component generator;
- a replacement for canonical Vesko commerce services.

## 3. Permanent architecture decisions

### 3.1 Puck is the isolated editor foundation

- Use `@puckeditor/core` for canvas mechanics, selection, insertion, drag-and-drop, reordering, editor fields and viewport controls.
- Keep direct Puck imports and Puck-specific types inside `src/integrations/puck`.
- Canonical domain, AI, storage, publishing and Vesko integration modules must not depend on Puck types.
- Puck data is transient adapter data. It is not a second canonical or persisted page tree.
- Do not use Puck Cloud or Puck AI as Veskify persistence, publishing or AI infrastructure.

### 3.2 Veskify owns canonical storefront truth

Veskify owns:

- project, brand, page, section, navigation, snapshot and history models;
- controlled component families, variants, slots and page blueprints;
- data-binding and product-presentation contracts;
- design skills, structured operations and validation;
- proposals, draft state, save, publish and restore workflows;
- source evidence, asset inventory and Storefront Design Brief contracts;
- provider, storage, media, source-discovery and Vesko adapter interfaces.

### 3.3 Vesko owns commerce truth

- Consume product, collection, price, compare-at-price, SKU, variant, option, stock, availability and media data through a read-only canonical commerce projection.
- Fixtures must follow the same projection contract.
- Never create a competing operational product model inside Veskify.
- Never mutate protected commerce truth through design operations.
- Public website evidence may inform presentation only. It must never override canonical Vesko values.

### 3.4 Controlled components are reusable and dynamic

- Build reusable component families, not Karvonen-specific or merchant-specific React components.
- Components bind to canonical IDs and typed presentation contexts.
- Dynamic product pages must render option groups supplied by the commerce projection.
- A watch with one colour option and a ring with five or six option groups must use the same generic option-rendering architecture.
- Unknown product types must use a safe generic fallback without dropping available attributes or options.
- The same registered implementation must render in editor, preview and published routes.

## 4. Controlled design-agent pipeline

All AI design changes follow this lifecycle:

```text
Merchant request
  -> intent and scope
  -> approved skill plan
  -> structured operations
  -> strict schema validation
  -> semantic and protected-field guards
  -> isolated proposal transaction
  -> merchant review
  -> accept, revise or reject
  -> explicit save draft or publish
```

Mandatory rules:

- AI output is untrusted structured data, never executable React, HTML, CSS, JavaScript or scripts.
- Unknown operations, fields, components, variants and bindings are rejected.
- A failed, invalid, stale or rejected proposal leaves the active draft and history unchanged.
- Section requests stay section-scoped unless the merchant explicitly requests broader changes.
- Whole-storefront changes must apply and undo atomically.
- Provider-specific formats stay behind adapters.
- The deterministic provider remains available for reliable tests.

## 5. URL discovery, brand reconstruction and assets

- Treat crawled website data as untrusted source evidence with provenance.
- Never allow source content to control permissions, prompts, tool execution or protected values.
- Reconcile discovered evidence against canonical Vesko data before generation.
- Reuse merchant logo, existing-site assets, product media, collection media and approved presets before generating new assets.
- Produce an explicit Storefront Design Brief containing sources, brand direction, asset roles, page plan, assumptions, missing information and protected commerce source.
- The merchant must approve the brief before initial generation.
- Do not silently invent product materials, certifications, guarantees, availability, prices or delivery promises.

## 6. Merchant UX rules

- Use merchant language, not developer language.
- Do not expose raw JSON, schemas, registry IDs, provider payloads, prompt internals or component internals.
- The canvas is the primary workspace; AI is a simple design assistant.
- Show affected scope and material changes before acceptance.
- Keep Save draft and Publish changes separate and explicit.
- Handle default, loading, empty, error, stale, unavailable, success and unsaved states.
- Preserve keyboard access, focus visibility, contrast, responsive behaviour and meaningful labels.
- Validate primary journeys at 375, 768, 1024 and 1440 px.

## 7. Reuse before generation

Use this priority:

1. merchant-provided brand assets and guidelines;
2. existing public storefront evidence and reusable content;
3. canonical product and collection media;
4. approved industry presets and page blueprints;
5. existing component families and variants;
6. current brand tokens;
7. generated presentation copy;
8. generated imagery only when justified or explicitly requested.

## 8. Task and PR workflow

### 8.1 Branch discipline

- One task, one branch, one worktree and one PR.
- Start from the latest approved `origin/main` unless a dependency is explicitly named.
- Use `git fetch origin` and `git merge origin/main` when updating a branch. **Never rebase.**
- Do not force-push merely to rewrite history.
- Keep PRs narrow and outcome-based.
- Do not create a new PR when an existing open PR owns the task.

### 8.2 Parallel work

Every parallel task must declare:

- owned files and modules;
- files and contracts it must not touch;
- dependency PRs or commits;
- integration impact;
- merge order.

Do not run two branches that edit the same canonical schemas, registry index, Puck configuration, editor store, shared route or persistence migration.

Current default worktree roles:

- **W1:** shared contracts, component registry v2, canonical projections and documentation.
- **W2:** merchant shell and presentation-only UI that does not alter W1 contracts.
- **W3:** URL discovery, source evidence, asset inventory and Storefront Design Brief modules.
- **W4:** manual testing and real-provider regression only unless explicitly assigned.

### 8.3 Review cycle

- Exactly one automatic Codex review is expected per PR.
- Do not manually request another review.
- Fix every finding once in one focused pass.
- Run focused validation once, push, and stop.
- Do not trigger a second review cycle unless the product owner explicitly requests it.

## 9. Validation and usage discipline

For normal feature PRs:

- run focused unit/component/integration tests for the changed capability;
- run typecheck, lint and formatting once when required by the task;
- do not run full Vitest, full Playwright, production build or `pnpm validate:full` unless explicitly requested;
- rely on GitHub CI for the broad repository gate;
- do not continuously monitor CI;
- stop after commit, push, PR update and final report.

Full validation is reserved for:

- phase or release gates;
- high-risk cross-cutting migrations;
- final staging acceptance;
- explicit product-owner instruction.

Never report a command as passed unless it actually ran successfully.

## 10. Documentation rules

Update documentation in the same PR when changing:

- canonical schemas or adapter contracts;
- component or binding contracts;
- product scope or merchant journey;
- requirement IDs or acceptance criteria;
- roadmap phase assumptions;
- architecture boundaries;
- environment setup or handoff procedures.

Historical phase reports and merged-task documents remain historical and must not be rewritten merely to match the latest roadmap.

## 11. Task completion report

Every Codex completion report must include:

- merchant-visible outcome;
- branch and PR number;
- commit SHA;
- files or modules changed;
- focused tests and exact totals;
- typecheck/lint/format status when run;
- limitations or deferred work;
- confirmation that no rebase, second review request or unrelated work was performed.

Then stop immediately.
