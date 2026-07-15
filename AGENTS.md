# Veskify Codex Instructions

## Source of truth

- `docs/VESKIFY_SDD.md` is the authoritative implementation baseline for this repository.
- Read the complete relevant SDD sections before changing code. Do not implement from an isolated task sentence when the SDD defines the behaviour.
- Every task must identify the affected SDD section(s), requirement IDs, and acceptance criteria.
- If a task conflicts with the SDD, stop and explain the conflict instead of silently changing the product boundary.
- Material product changes require an SDD update in the same pull request.

## Product boundary

Veskify is a standalone AI storefront **design** agent demo for retailers with very low technical and design knowledge.

The demo MUST:

- use dummy catalogue, cart, checkout, inventory, order, shipping, payment, tax, and customer data;
- generate and edit storefront layouts, content, brand tokens, imagery, pages, and controlled sections;
- keep draft changes separate from the published demo snapshot;
- require explicit confirmation before publishing or destructive actions;
- support responsive desktop and mobile experiences;
- support English and Finnish where the active feature requires localisation;
- allow one section to be regenerated without changing unrelated sections.

The demo MUST NOT:

- change product prices;
- activate or configure payments;
- configure logistics, delivery methods, shipping prices, taxes, orders, or live inventory;
- generate or execute arbitrary React, HTML, CSS, JavaScript, scripts, or embeds from AI output;
- mutate the published snapshot from normal editor or AI operations;
- introduce real production commerce integrations unless a task explicitly changes the approved scope and updates the SDD.

## Controlled generation

- AI output must be structured data validated with schemas before it reaches application state.
- Storefront rendering must go through the registered component system.
- Components and their allowed variants/props are controlled, responsive, accessible, and testable.
- Use a deterministic mock AI provider by default. Real provider adapters must remain optional and isolated behind interfaces.
- Never bypass validation, the component registry, draft state, or publish confirmation for convenience.

## Recommended stack

Follow SDD section 16 unless a task explicitly updates it:

- Next.js App Router, React, strict TypeScript
- Tailwind CSS and validated CSS-variable brand tokens
- React Hook Form and Zod
- Zustand or an equivalent predictable store with command-based undo/redo
- IndexedDB through a storage adapter for the standalone demo
- Vitest, React Testing Library, and Playwright
- `pnpm` as the package manager

Do not add a major production dependency without explaining why the existing stack cannot satisfy the requirement.

## Implementation workflow

For every task:

1. Read the relevant SDD sections and inspect the existing implementation.
2. State the spec references and the narrow implementation plan.
3. Build the smallest complete vertical slice that satisfies the requested user flow.
4. Include default, loading/generating, empty, error, success, and draft-changed states where applicable.
5. Add or update unit, component/integration, end-to-end, accessibility, or visual tests as required.
6. Run the available typecheck, lint, test, and build commands before reporting completion.
7. Summarize changed files, tests run, remaining limitations, and any SDD updates.

## Quality rules

- Prefer simple, legible UX over technical flexibility.
- Do not expose advanced CSS or implementation terminology to the merchant.
- Preserve keyboard usability, focus visibility, semantic HTML, and responsive behaviour.
- Do not create a competing page, section, token, project, or snapshot domain model.
- Do not hide missing states or failures behind TODO comments.
- Do not refactor unrelated code unless necessary for the task.
- Do not claim completion when required tests fail or were not run.

## Pull-request checklist

- [ ] SDD sections and requirement IDs referenced
- [ ] Product boundary preserved
- [ ] Dummy commerce data only
- [ ] Controlled component registry used
- [ ] AI output validated before application
- [ ] Draft/published separation preserved
- [ ] Protected commerce fields untouched
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Tests pass
- [ ] Responsive and keyboard review completed
- [ ] Documentation updated where behaviour changed
