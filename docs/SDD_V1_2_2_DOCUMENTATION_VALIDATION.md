# SDD v1.2.2 documentation validation

**Amendment date:** 31 July 2026

**Branch:** `codex/sdd-v1-2-2-commercial-design-vocabulary-recovery`

**Repository baseline:** `4a96a5a5567b83e62306f73f7069e0e09f0c8683`

**PR:** #132, existing non-draft delivery record

**Initial delivery commit:** `bba2827e63f2027c946138f6c91362f3f989b088`, the commit reviewed by
the single automatic Codex review.

**Review-fix delivery commit:** Recorded by PR #132 after this commit is created; no future or
self-referential SHA is embedded in the source document.

The earlier v1.2.1 baseline `8174b1a6d31301b4072622e2e3ef675957479121` and branch
`codex/sdd-v1.2.1-grounded-storefront-generator` remain historical v1.2.1 provenance only. They are
not the source of v1.2.2.

## Scope

This documentation and roadmap amendment changes no production application code. It makes the
controlled commercial design-generation model explicit and regenerates the DOCX only through the
repository export script.

## Contract reconciliation

| Contract          | v1.2.2 binding clarification                                                                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component family  | One maintained renderer implementation with materially meaningful variants, typed slots/bindings/assets and shared editor/preview/published rendering.                                                                                                                              |
| Page recipe       | Registered constrained `PageBlueprint` profile supplying permitted/default slots, compatibility, order, responsive constraints, bindings, approved assets, coordination and omission/fallback rules; never a second executable representation.                                      |
| Parametric design | AI selects only typed validated parameters; renderer owns CSS and responsive conversion.                                                                                                                                                                                            |
| Inheritance       | `BrandSystem → registered PageBlueprint recipe profile → family/variant → constrained validated instance override`; invalid unrelated local overrides fail validation.                                                                                                              |
| Reachability      | A capability is complete only after registered → planner-selectable → proposal-expressible → compiler-preserved → `StorefrontSnapshot`-stored → renderer-visible → editor-editable → manually live-proven.                                                                          |
| Visual quality    | Homepage, collection and PDP require coordinated screenshot-level browser review at 375, 768, 1024 and 1440 px with representative approved assets.                                                                                                                                 |
| Safety            | Proposals/PageBlueprints reject raw CSS, arbitrary classes, executable JavaScript/React or generated code, unrestricted font imports and out-of-bounds values; optional evidence/trust is omitted without approval, unsupported defaults fail and evidence provenance is preserved. |

## Current-status reconciliation

- Phase 9 remains active until the complete whole-storefront live generation and evidence gate passes.
- P9R-06 proved the real editor homepage-only generation route only.
- P9R-07 whole-store global colour and typography routing is active work at this amendment baseline;
  this document does not claim it is complete.
- Phase 10A remains blocked until the Phase 9 product gate passes. This amendment does not unblock it.
- AC-136 through AC-138 belong to P10A Tasks 6–9 after Phase 9; they are not required to close
  Phase 9 and are not satisfied by this documentation amendment.

## Validation evidence

Record the final command results after the final documentation edit:

| Check                                                  | Required result                                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation/internal links                           | `pnpm docs:validate` passes with synchronized deterministic DOCX hash.                                                                    |
| Generated SDD                                          | `pnpm docs:export`, `pnpm docs:validate` and deterministic OOXML structural checks pass; visual-render availability is reported honestly. |
| Formatting/diff                                        | `pnpm format:check` and `git diff --check` pass.                                                                                          |
| Focused repository gates requested for this review fix | `pnpm typecheck` and `pnpm lint` pass.                                                                                                    |

No validation result is inferred by this evidence document; the final PR report records actual
command results. The known `origin/main` Next route-export failure is outside this documentation
review fix and is not rerun or repaired here.
