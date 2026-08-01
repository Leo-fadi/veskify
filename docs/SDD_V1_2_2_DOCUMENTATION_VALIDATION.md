# SDD v1.2.2 documentation validation

**Amendment date:** 31 July 2026

**Branch:** `codex/sdd-v1-2-2-commercial-design-vocabulary-recovery`

**PR:** Pending validation and non-draft PR creation

## Scope

This documentation and roadmap amendment changes no production application code. It makes the
controlled commercial design-generation model explicit and regenerates the DOCX only through the
repository export script.

## Contract reconciliation

| Contract          | v1.2.2 binding clarification                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component family  | One maintained renderer implementation with materially meaningful variants, typed slots/bindings/assets and shared editor/preview/published rendering.                                                     |
| Page recipe       | Approved structure with required/optional slots, compatibility, controlled order, responsive behavior, commerce bindings, approved assets and omission rules.                                              |
| Parametric design | AI selects only typed validated parameters; renderer owns CSS and responsive conversion.                                                                                                                   |
| Inheritance       | `BrandSystem → recipe → family/variant → constrained validated instance override`.                                                                                                                         |
| Reachability      | A capability is complete only after registered → planner-selectable → proposal-expressible → compiler-preserved → `StorefrontSnapshot`-stored → renderer-visible → editor-editable → manually live-proven. |
| Visual quality    | Homepage, collection and PDP require coordinated screenshot-level browser review at 375, 768, 1024 and 1440 px with representative approved assets.                                                        |
| Safety            | Optional evidence/trust is omitted without approval; no defaults invent unsupported commercial claims; protected commerce remains unchanged.                                                               |

## Current-status reconciliation

- Phase 9 remains active until the complete whole-storefront live generation and evidence gate passes.
- P9R-06 proved the real editor homepage-only generation route only.
- P9R-07 whole-store global colour and typography routing is active work at this amendment baseline;
  this document does not claim it is complete.
- Phase 10A remains blocked until the Phase 9 product gate passes. This amendment does not unblock it.

## Validation evidence

Record the final command results after the final documentation edit:

| Check                                         | Required result                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Documentation/internal links                  | `pnpm docs:validate` passes with synchronized deterministic DOCX hash.     |
| Generated SDD                                 | `pnpm docs:export`, `pnpm docs:validate` and DOCX render/inspection pass.  |
| Formatting/diff                               | `pnpm format:check` and `git diff --check` pass.                           |
| Repository gates requested for this amendment | `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm validate:full` pass. |

No validation result is inferred by this evidence document; the final PR report records actual
command results.
