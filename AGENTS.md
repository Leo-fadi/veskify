# Veskify Codex Constitution

**Version:** 1.1
**Aligned with:** `docs/VESKIFY_SDD.md` and synchronized export `docs/VESKIFY_SDD_v1.1.docx`

These instructions apply to every Codex task in the Veskify repository.

## 1. Source of truth

- `docs/VESKIFY_SDD.md` is the authoritative implementation baseline.
- `docs/VESKIFY_SDD_v1.1.docx` is the synchronized human-readable export.
- If the Markdown and DOCX differ, the Markdown specification takes precedence.
- ADR-001 and ADR-002 are binding architectural decisions that clarify the SDD.
- The repository must update `docs/VESKIFY_SDD.md` first and then synchronize the DOCX export.
- Read the complete relevant sections before modifying code.
- Every task must cite the affected SDD sections, requirement IDs, and acceptance criteria.
- If a request conflicts with the SDD, stop and explain the conflict. Do not silently redefine the product.
- Material changes to product behaviour, architecture, or scope require an SDD update in the same pull request.
- Existing canonical domain models, component contracts, repository interfaces, and integration boundaries must be reused rather than duplicated.

## 2. Product identity

Veskify is an **AI storefront design agent for retailers with very low technical and design knowledge**.

Veskify is not:

- a general-purpose code generator;
- a replacement commerce backend;
- a payment, logistics, order, tax, or inventory configuration agent;
- a developer-oriented page-building framework;
- an unrestricted AI website generator.

The merchant experience must remain simple:

```text
Describe the desired result
  -> see a proposed design
  -> accept, revise, or reject
  -> apply accepted changes to the active draft
  -> adjust visually if needed
  -> save the draft
  -> explicitly publish when ready
```

## 3. Permanent architecture decisions

### 3.1 Puck is the embedded editor foundation

- Use the open-source `@puckeditor/core` package for canvas mechanics, selection, insertion, drag-and-drop, reordering, editor fields, and viewport controls.
- Keep all direct Puck imports and Puck-specific types inside `src/integrations/puck`.
- Do not build a competing canvas, selection system, drag-and-drop engine, property-field framework, or viewport editor.
- Do not use HugoBlox.
- Do not use Puck Cloud or Puck AI as Veskify persistence or AI infrastructure.
- Do not use unsupported Puck internals unless documented, justified, and isolated.

### 3.2 Veskify owns the truth

Veskify owns:

- projects, pages, sections, snapshots, history, and brand schemas;
- registered component contracts, variants, fields, and rendering implementations;
- design skills, operation schemas, proposal state, and validation;
- draft, preview, publish, and restore workflows;
- catalogue presentation models and protected commerce rules;
- storage and future Vesko integration interfaces.

Puck data is transient adapter data. It is not a second canonical or persisted page tree.

### 3.3 Dependency direction

- Puck adapters may depend on Veskify contracts.
- Canonical domain, application, storage, AI, and publishing modules must not depend on Puck types.
- Provider adapters may depend on Veskify skill and operation contracts.
- Veskify skill and operation contracts must not depend on a specific AI provider.

## 4. Controlled design-agent pipeline

All design-agent changes follow this pipeline:

```text
Merchant request
  -> intent
  -> design plan
  -> approved skills
  -> structured operations
  -> schema and semantic validation
  -> draft proposal and preview
  -> merchant accept, revise, or reject
  -> apply accepted operations to the active draft
  -> save draft
  -> explicit publish
```

Never implement:

```text
Prompt -> arbitrary code -> storefront
```

### Mandatory rules

- AI output must be structured data.
- AI output must pass Zod schema validation and semantic validation before reaching editor state.
- Unknown components, variants, fields, tokens, or operations must be rejected.
- Changes must be scoped to the requested page or section unless the merchant explicitly requests broader redesign.
- One section may be regenerated without modifying unrelated sections.
- Failed or rejected operations must leave the prior draft intact.
- The agent proposes; Veskify applies validated changes.

## 5. Design skills

A skill is a controlled capability, not a free-form prompt.

Every skill must define:

- stable skill ID and version;
- supported merchant intents;
- required and optional context;
- allowed page and component types;
- allowed structured operations;
- protected fields;
- preconditions;
- output schema;
- semantic validation;
- merchant-facing proposal summary;
- deterministic tests and failure states.

Skills may compose other approved skills, but they may not widen their permissions.

Prefer a small number of deeply tested skills over a large shallow catalogue.

## 6. Reuse before generation

Before generating new content or assets, use this priority:

1. merchant-provided brand guidelines and assets;
2. existing merchant website and storefront content;
3. existing product and catalogue media;
4. approved industry presets;
5. existing component variants and layout patterns;
6. existing brand tokens;
7. generated text;
8. generated imagery only when materially necessary.

Do not generate duplicate, unused, or speculative assets.

## 7. Product and commerce boundaries

The agent may design and edit:

- page composition;
- approved section content;
- component variants;
- colours, typography, spacing, shape, and imagery tokens;
- generated or translated presentation copy;
- presentation-only product descriptions, SEO, categories, collections, and filter suggestions;
- cart and checkout visual layout using dummy or protected display data.

The agent must not modify:

- product price;
- SKU or product identity;
- stock quantity or live availability truth;
- payment activation or configuration;
- shipping, delivery, logistics, or return configuration;
- tax configuration;
- order state;
- inventory operations;
- operational checkout behaviour.

Presentation enrichment must be separate, non-destructive, reviewable, reversible, and exportable.

## 8. Draft and publishing safety

- Normal editor changes and AI proposals modify draft state only.
- Puck `onPublish` or equivalent callbacks must be treated as validated draft handoff events, never direct publication.
- Publishing requires an explicit merchant command and confirmation.
- The complete draft must be validated before publication.
- Published state must never change from editor `onChange`, AI generation, draft save, import, or enrichment.
- Restore operations restore a historical version into draft first; they do not silently republish.

## 9. Merchant UX rules

- Use ordinary retail and design language, not engineering terminology.
- The canvas is the primary surface; chat is a simple control interface.
- Ask questions only when missing information materially changes the result.
- Show what will change before material multi-section changes are accepted.
- Provide clear loading, generation, empty, error, success, unsaved, and published states.
- Keep manual editing controls understandable: text, image, background, colour, typography preset, alignment, spacing preset, layout variant, visibility, and ordering.
- Do not expose arbitrary CSS, component internals, JSON, schemas, or code.
- Preserve keyboard access, focus visibility, semantic structure, and responsive behaviour.

## 10. Implementation workflow

For every task:

1. Fetch the latest approved base branch.
2. Read the relevant SDD sections and inspect existing code.
3. State the narrow implementation plan and files likely to change.
4. Build the smallest complete user-visible vertical slice.
5. Reuse existing contracts and adapters.
6. Add default, loading, empty, error, success, and draft-changed states where applicable.
7. Add unit, component/integration, Playwright, accessibility, or visual tests appropriate to the risk.
8. Run the full repository validation command before completion.
9. Audit the complete diff for unrelated changes.
10. Report commits, PR, changed files, test totals, limitations, and public APIs.

## 11. Parallel-development rules

- One task, one branch, one worktree, one pull request.
- Two feature tasks may run in parallel only when they do not edit the same canonical schemas, registry definitions, routes, state services, or shared UI files.
- A third worktree is reserved for validation, Playwright, manual QA, rebasing, and review fixes.
- After one parallel PR merges, fetch and merge latest `origin/main` into the other branch, then rerun full validation.
- Reserve rebase and `--force-with-lease` for deliberate cases where no other work depends on the branch.
- Never merge a stale branch only because GitHub reports it as conflict-free.
- Do not create a second PR when updating an existing PR.

## 12. Quality and scope discipline

- Prefer visible merchant value over architecture expansion.
- Do not add infrastructure unless it immediately enables a defined user flow.
- Do not refactor unrelated code.
- Do not create competing project, page, section, token, catalogue, proposal, or snapshot models.
- Do not add major dependencies without explaining why current architecture cannot satisfy the requirement.
- Do not claim tests passed when they were not run.
- Do not merge with unresolved review feedback or failing CI.

## 13. Required validation

Use the repository-standard full validation command. At minimum it must cover:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run Playwright and accessibility/visual checks when the task affects routes, canvas behaviour, responsive rendering, publishing, or merchant interaction.

## 14. Pull-request checklist

- [ ] SDD sections and requirement IDs cited
- [ ] User-visible outcome stated
- [ ] Product boundary preserved
- [ ] Puck boundary preserved
- [ ] Canonical composition remains singular
- [ ] Skills return structured operations only
- [ ] Validation occurs before draft mutation
- [ ] Reuse-before-generation followed
- [ ] Protected commerce fields untouched
- [ ] Draft and published snapshots remain separated
- [ ] Merchant approval behaviour is explicit
- [ ] Loading, error, empty, success, and dirty states handled
- [ ] Keyboard and responsive behaviour reviewed
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Tests pass
- [ ] Build passes
- [ ] Relevant Playwright/accessibility checks pass
- [ ] Documentation updated when behaviour or architecture changed
