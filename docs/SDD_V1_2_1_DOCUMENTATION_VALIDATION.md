# SDD v1.2.1 documentation validation

**Amendment date:** 30 July 2026

**Source commit:** `8174b1a6d31301b4072622e2e3ef675957479121`

**Branch:** `codex/sdd-v1.2.1-grounded-storefront-generator`

**PR:** Pending when the documentation was prepared

## Scope

This is a documentation/specification correction. It changes no runtime, product, schema, fixture
or test implementation. The authoritative Markdown is updated first and the DOCX is generated from
that final source.

## Source reconciliation

| Source                                                 | Verified fact used by v1.2.1                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `src/domain/storefront/storefront.ts`                  | `StorefrontSnapshot` owns brand, navigation and pages; `PageModel` is a member type rather than another canonical root. |
| `src/domain/component-platform/component-platform.ts`  | `ComponentDefinitionV2`, presentation bindings, responsive/accessibility contracts and asset provenance already exist.  |
| `src/application/storefront-templates/contract.ts`     | `StorefrontTemplateDefinition` is the current machine-readable precursor to executable `PageBlueprint`s.                |
| `src/application/design-skills/default-registry.ts`    | The live Skill registry is narrower than prior conceptual documentation.                                                |
| `src/application/design-operations/operations.ts`      | Serialized operation codes use the registered uppercase vocabulary documented in v1.2.1.                                |
| `src/application/storefront-design-system/registry.ts` | Registered design directions and component selections are live capability evidence, not provider-owned designs.         |
| PR #123                                                | Merged exact token-refinement and preservation evidence; not complete multi-page generation evidence.                   |
| `docs/P9_05B_REAL_OPENAI_GENERATION_DEMO.md`           | Automated transport is mocked/network-free and no complete live result is recorded.                                     |

## Corrected inconsistencies

- Replaced claims that retained evidence proves a complete live-provider journey.
- Kept `StorefrontSnapshot` as the sole canonical storefront intermediate representation.
- Distinguished implementation member type `PageModel` from a competing canonical page graph.
- Reconciled actual Skill IDs/statuses with conceptual merchant scopes.
- Reconciled actual serialized operation codes with planned capability names.
- Corrected Phase 9 closure, PR #123 scope and AC-119 through AC-123 ownership.
- Added AC-129 through AC-135 because AC-126 through AC-128 are already assigned.
- Reordered the roadmap to Phase 9 → P10A → P10B → Phase 11 → Phase 12 → later deployment.
- Added an ADR index and explicit v1.2.1 references.

## Unverifiable or incomplete claims

- No retained live OpenAI invocation proves the complete meaningful storefront journey.
- No retained 360-screenshot P9-04D matrix proves all directions, cases, pages, locales and widths.
- No retained complete manual keyboard/screen-reader pass covers generated output and Studio
  workflows.
- Exact PR/merge identifiers are omitted where they were not verified; the evidence matrix does not
  infer them.
- Full Vesko staging authentication, tenancy, deployment and operations are not repository facts
  and are later work.
- Current asset contracts do not yet provide the complete upload/library and generated-image
  lifecycle specified for P10B.
- Current storefront template contracts are a PageBlueprint precursor, not the completed executable
  P10A-03 contract.

## Remaining documentation inconsistencies

- Canonical architecture uses `PageBlueprint`, while the current implementation precursor remains
  named `StorefrontTemplateDefinition`; P10A-01/P10A-03 must resolve the implementation vocabulary
  without adding a second system.
- Several merchant/conceptual Skill names do not exist as registry IDs. The Skills catalogue now
  records their canonical replacement or layer, but implementation migration aliases remain future
  work.
- Historical phase reports retain the task/phase names that were correct when written. They are not
  rewritten; the v1.2.1 SDD and roadmap own current phase status.
- The repository has no retained complete live-provider evidence package. The Phase 9 matrix
  therefore cannot cite a closing commit, full browser matrix or provider artifact.

## Documentation validation

The final branch must record actual results for:

| Check                                         | Result                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Markdown formatting                           | Passed with Prettier after final documentation edits.                                                                                     |
| Relative Markdown links                       | Passed with `pnpm docs:validate`.                                                                                                         |
| SDD/DOCX source synchronization               | Passed; deterministic regeneration matches the committed DOCX byte-for-byte, and its embedded SHA-256 matches the authoritative Markdown. |
| Roadmap phase/status consistency              | Passed with `pnpm docs:validate`; Phase 9 remains active and the required phase order is present.                                         |
| Stale canonical-model/status terminology scan | Passed; deprecated names appear only in explicit prohibition/clarification text.                                                          |
| DOCX render and visual inspection             | Passed; Quick Look parsed the DOCX and all 27 paginated preview images were inspected without clipping, overlap or missing content.       |
| `git diff --check`                            | Passed after final documentation and tooling edits.                                                                                       |

Product typecheck, unit tests, Playwright and `pnpm validate:full` are intentionally outside this
documentation-only amendment unless a documentation tool changes product code or the task owner
explicitly expands validation. The task owner requested the exact failed CI test in the final review
pass; `tests/integration/editor-route.test.tsx` passed locally with 111 tests.
