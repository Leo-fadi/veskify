# Veskify

Veskify is a standalone AI storefront design agent demo for retailers with very low technical and design knowledge. It guides a merchant through creating or redesigning an online storefront using onboarding, chat, a visual canvas, structured controls, controlled storefront components, live draft preview, and explicit publishing approval.

This repository is a demo foundation for later integration into Vesko Retail OS. It uses dummy commerce data and does not configure real prices, payments, shipping, taxes, inventory, or orders.

## Authoritative specification

- Product and software specification: [`docs/VESKIFY_SDD.md`](docs/VESKIFY_SDD.md)
- Human-readable Word version: [`docs/Veskify_SDD_v1.0.docx`](docs/Veskify_SDD_v1.0.docx)
- Codex repository instructions: [`AGENTS.md`](AGENTS.md)
- Reusable task format: [`docs/CODEX_TASK_TEMPLATE.md`](docs/CODEX_TASK_TEMPLATE.md)

Codex must read `AGENTS.md` automatically and use the SDD sections and requirement IDs referenced in each task.

## Initial delivery sequence

1. Phase 0 — repository foundation, quality tooling, schemas, registry, seed data, and storage adapter.
2. Phase 1 — responsive storefront renderer and page templates.
3. Phase 2 — editor shell, canvas selection, property editing, device modes, and undo/redo.
4. Phase 3 — guided onboarding and initial storefront generation.
5. Phase 4 — structured mock AI operations and confirmation cards.
6. Phase 5 — draft, full preview, published snapshots, history, and restore.
7. Phase 6 — English/Finnish localisation and catalogue/asset imports.
8. Phase 7 — optional real AI provider adapters.
9. Phase 8 — demo polish, accessibility, performance, and visual regression.

## Working method

Implement one bounded task at a time. Every task should cite the relevant SDD sections, define what is in and out of scope, specify acceptance criteria, and end in a reviewable pull request.
