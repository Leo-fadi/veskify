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

## Mandatory embedded editor foundation

- Veskify MUST use Next.js as the application framework, Veskify-owned domain/application architecture, and the open-source `@puckeditor/core` package as the embedded visual-editor foundation.
- Do not use HugoBlox anywhere.
- Do not build a competing visual editor, drag-and-drop canvas, component selection system, viewport system, or basic property-editing foundation from scratch when Puck provides those capabilities.
- Veskify owns project/page/storefront domain models, brand tokens, industry templates, controlled storefront components, AI operations and validation, onboarding/chat, product/catalogue data, localisation, draft/preview/history/publishing workflows, storage adapters, and future Vesko backend integration.
- Puck provides embedded editing canvas, drag-and-drop section placement/reordering, section selection, component fields/property controls, viewport editing, editor UI foundation, and rendering through Puck Config and Render.
- Puck owns canvas mechanics, selection, insertion, drag-and-drop and editor fields. Do not recreate or compete with those foundations in Veskify code.
- Veskify’s registered component system is the single source of truth for Puck Config. Puck may expose only approved Veskify storefront components, variants, and fields.
- Veskify owns canonical schemas and component contracts, validation and protected-field rules, snapshots, storage, draft/history/publishing workflows, AI operations and storefront rendering boundaries.
- Keep every `@puckeditor/core` import and Puck-specific type under `src/integrations/puck`. Canonical domain, application, storage and AI-operation modules must not import or expose Puck types.
- Puck output MUST be validated through Veskify Zod schemas before entering draft state or persistence.
- Maintain one canonical stored page composition representation with an isolated Puck adapter. Do not persist two independent page trees.
- The same Veskify storefront components MUST render in editor, full preview, and published storefront.
- Puck publish actions MUST NOT publish directly; they must feed Veskify’s draft and explicit publish-confirmation workflow.
- Product prices, payment, shipping, tax, inventory, orders, and operational checkout data remain protected and read-only.
- Do not use Puck Cloud or Puck AI as the Veskify AI provider.
- Do not use Puck as the source of truth for persistence, publishing, commerce data or AI operations.
- Do not use unsupported Puck internal APIs unless documented and justified.
