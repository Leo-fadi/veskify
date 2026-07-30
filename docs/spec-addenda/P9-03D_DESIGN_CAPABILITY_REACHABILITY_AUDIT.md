# P9-03D — Design-capability reachability audit

## Specification status

This is a corrective Phase 9 addendum discovered during the 29 July 2026 real-AI Lumo Atelier
demo. It is not yet named in the authoritative SDD or roadmap. It refines the existing P9 outcome
and AC-112, AC-114, AC-117, AC-118, AC-122 and AC-123 without changing their authority.

The audit is read-only with respect to production behavior. It records the current path from the
controlled component registry to the canonical storefront and identifies targeted follow-up work.
It does not claim that the confirmed design-quality gaps have been fixed.

Requirement trace: FR-108, FR-109, FR-113, FR-114 and FR-117; NFR-102, NFR-103, NFR-108 and
NFR-109; AC-112, AC-114, AC-117, AC-118, AC-122 and AC-123.

## Audit question and method

The audit follows this controlled path:

```text
ComponentDefinitionV2 registry
  -> variant
  -> template blueprint or Storefront Design System page recipe
  -> registered direction capability map
  -> deterministic/real-provider planning request
  -> validated whole-storefront generation plan
  -> whole-storefront proposal compiler
  -> coordinated component selection
  -> canonical storefront proposal snapshot
  -> editor / preview / published renderer
```

The machine-readable source is
`tests/fixtures/p9-03d-design-capability-inventory.ts`. It derives registration, bindings, page
support, responsive and accessibility contracts, recipes, blueprints, directions and renderer
declarations from current production exports. A deliberately explicit classification table makes a
new or removed registry variant fail the audit until its reachability has been reviewed.

Responsive contracts retain the complete structured `ComponentDefinitionV2` rule: breakpoints,
horizontal-overflow prohibition, optional minimum width, optional maximum columns and localized
notes. The audit therefore keeps distinct collection and PDP layout constraints instead of reducing
them to one display string.

The conformance suite is
`tests/unit/p9-03d-design-capability-reachability.test.ts`. It proves inventory completeness,
recipe resolution, real-provider exposure, proposal-compiler behavior, canonical runtime projection,
renderer-bridge gaps and deterministic reruns.

## Status vocabulary

| Status                                        | Audit meaning                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `fully reachable`                             | A registered direction selects the capability and the resulting value reaches the canonical storefront used by the shared renderers.     |
| `registered but unreachable`                  | The capability exists and can render, but no current whole-storefront direction can select it.                                           |
| `planner-visible but lost during compilation` | A recipe, blueprint or direction names the capability, but the selected variant does not reach the canonical proposal through that path. |
| `render-only`                                 | A renderer and V2 contract exist, but no canonical planner, SectionInstance or editor bridge reaches them.                               |
| `incomplete`                                  | Part of the path is implemented, but its declared semantics or proof are not carried end to end.                                         |
| `missing`                                     | The design-system model names the capability category but has no selectable registered implementation.                                   |

## Executive result

The generated current V2 inventory contains **25 component types and 76 component variants**. The
component-variant total is derived from the machine inventory and every variant is present exactly
once.

| Component-variant status                    | Count | Result                                                                                                     |
| ------------------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------- |
| Fully reachable                             |    29 | Direction-selected and present in the canonical proposal snapshot.                                         |
| Registered but unreachable                  |    20 | Renderable, but absent from every current direction selection path.                                        |
| Planner-visible but lost during compilation |     9 | Named by recipes, blueprints or planner replacement contracts but not preserved as that component variant. |
| Render-only                                 |    18 | Six V2 homepage families and their variants have renderers but no planner/canonical/Puck route bridge.     |
| Incomplete                                  |     0 | Component variants themselves are classified at a more exact boundary.                                     |
| Missing                                     |     0 | Missing categories are recorded in the system-capability inventory instead.                                |

The additional design-system inventory contains **37 records**: 19 fully reachable, 7 registered but
unreachable, 10 incomplete and 1 missing.

The principal reason the real Lumo storefront can be valid but visually generic is therefore not a
lack of renderer code. The planner exposes only three direction choices; those choices actively use
29 of 76 registered variants, while the richer V2 homepage family is disconnected from the
generation and editor path.

## Boundary findings

### 1. Provider exposure is broader than provider authority

`buildWholeStorefrontPlanningProviderRequest` advertises all 25 component definitions and all 76
variants to a real provider. The provider may nevertheless choose only one of three registered
direction IDs. Returned output must equal `planForDirection(directionId)` exactly. This is a strong
safety boundary, but registry presence in the provider schema is not evidence of reachability.

### 2. Dynamic collection and PDP presentation compiles directly

The planner creates `dynamicCollectionCommerce` and `dynamicProductDetail` V2 instances with the
selected direction's variant and presentation props. The proposal compiler preserves those values.
The canonical runtime projection then converts their typed bindings into the existing protected V1
bridge content without copying commerce facts into editable content.

Reachable collection variants are `editorial` and `compact`. Reachable PDP variants are `balanced`,
`compact` and `editorialSplit`.

### 3. Coordinated direction selections are applied by the proposal compiler

For a registered coordinated selection, `coordinatedRuntimeComponent` applies
`designSystemSelection.componentSelections` before the canonical AI proposal snapshot is created.
The selected component variant is therefore proven by the planner/compiler boundary itself for the
29 fully reachable variants.

Planner/compiler conformance must remain in the compatibility gate as the canonical selection
boundary evolves.

### 4. Recipe variants are not uniformly authoritative

Recipe IDs survive planning and determine relative section ordering, but recipe section variants are
not generally compiled. Current homepage planning retains existing sections and can create only a
missing required `brandStory` when approved content and a compatible approved asset exist.

- `announcementBar:singleLine` and `announcementBar:minimal` occur in homepage recipes, but there is
  no announcement component selection; the source variant survives.
- `homeModernCommerce` and `modernTechnical.componentSelections.trust` both select
  `benefitIcons:threeColumn`. `coordinatedRuntimeComponent` preserves that selection before the
  canonical snapshot; this is distinct from announcement source retention.
- Optional recipe sections are not composed merely because the recipe contains them.

This is the exact recipe-to-plan boundary at which some intended visual differentiation disappears.

### 5. Legacy collection and PDP components are replaced before compilation

The capability map still names `collectionHeader:editorial`, `filterBar:horizontal`,
`productGallery:thumbnails`, `productInfo:premium` and `productOptions:buttons`. The planner replaces
those legacy sections with the two dynamic commerce components before proposal compilation. The
dynamic shell preserves the protected behavior through typed props and bindings, but those five
legacy component variants do not survive as registered section identities.

### 6. Renderer parity is complete only for canonical-route components

The 19 types in `veskifyComponentRegistry`, including the dynamic commerce bridge types, use the
same registered implementation in the Puck editor, preview and published paths. Published routes
reuse the preview clients with the published snapshot, and dynamic collection/PDP routes use the
same commerce components with a target flag.

The following V2-only homepage components declare editor, preview and published renderer targets and
have tested renderer implementations, but are absent from `veskifyComponentRegistry`, Puck config,
page recipes and whole-storefront planner composition:

- `homepageHero` — 6 variants;
- `homepageFeaturedCollections` — 2 variants;
- `homepageFeaturedProducts` — 2 variants;
- `homepageCollectionNavigation` — 2 variants;
- `homepagePromotion` — 3 variants;
- `homepageTrust` — 3 variants.

They are `render-only`, not shared-route reachable. Their metadata must not be reported as renderer
parity until a canonical bridge exists.

## Component capability matrix

Every item below expands to a full record in the machine inventory, including version, registration
source, required bindings, supported page types, responsive/accessibility contracts, recipe and
blueprint references, deterministic direction evidence, provider exposure, compiler boundary and
the three renderer targets.

| Family / component            | Fully reachable                                                                     | Registered but unreachable     | Planner-visible but lost                                       | Render-only                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Announcement                  | —                                                                                   | `rotating`, `bold`             | `singleLine`, `minimal`                                        | —                                                                                                             |
| Header/navigation             | `centered`, `compact`, `transparent`                                                | `split`, `editorial`           | —                                                              | —                                                                                                             |
| Hero                          | `editorial`, `fullBleed`, `asymmetric`                                              | `restrained`                   | —                                                              | `homepageHero`: `editorialSplit`, `imageLed`, `minimal`, `fullBleedOverlay`, `asymmetric`, `restrained`       |
| Featured collection discovery | `grid`, `editorialCards`, `imageLed`                                                | `carousel`                     | —                                                              | `homepageFeaturedCollections`: `standard`, `editorial`; `homepageCollectionNavigation`: `standard`, `compact` |
| Product grids/cards           | `standard`, `editorial`, `compact`                                                  | —                              | —                                                              | `homepageFeaturedProducts`: `standard`, `editorial`                                                           |
| Story/editorial               | `editorial`, `minimal`, `imageLed`; image/text `imageLeft`, `imageRight`, `stacked` | `timeline`, `founder`          | —                                                              | —                                                                                                             |
| Trust/service                 | `minimal`, `cards`, `threeColumn`                                                   | `fourColumn`                   | —                                                              | `homepageTrust`: `row`, `cards`, `compact`                                                                    |
| Campaign                      | `imageOverlay`, `split`, `minimal`                                                  | —                              | —                                                              | `homepagePromotion`: `split`, `overlay`, `minimal`                                                            |
| Newsletter                    | `inline`, `card`                                                                    | `fullWidth`                    | —                                                              | —                                                                                                             |
| Footer                        | `columns`, `editorial`, `compact`                                                   | `expanded`, `dark`             | —                                                              | —                                                                                                             |
| Legacy collection sections    | —                                                                                   | —                              | collection header `editorial`; filter bar `horizontal`         | —                                                                                                             |
| Dynamic collection shell      | `editorial`, `compact`                                                              | `standard`, `gallery`          | —                                                              | —                                                                                                             |
| Legacy PDP sections           | related products `grid`                                                             | —                              | gallery `thumbnails`; information `premium`; options `buttons` | —                                                                                                             |
| Dynamic PDP shell             | `balanced`, `compact`, `editorialSplit`                                             | `editorial`, `galleryDominant` | —                                                              | —                                                                                                             |

## Design-system and page-recipe matrix

| Capability               | Fully reachable                                                                            | Registered but unreachable                                     | Incomplete / missing                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Typography bundles       | `refinedSerif`, `technicalFunctional`, `warmApproachable`                                  | `modernSans`, `editorialContrast`                              | —                                                                                                                         |
| Spacing/density          | `compact`, `standard`, `spacious`                                                          | —                                                              | —                                                                                                                         |
| Shape/radius             | `square`, `soft`, `rounded`                                                                | —                                                              | —                                                                                                                         |
| Surface/elevation        | `flat`, `subtle`, `layered`                                                                | —                                                              | —                                                                                                                         |
| Border treatment         | —                                                                                          | —                                                              | **Missing:** semantic role exists, but directions carry no border value and compilation retains the baseline.             |
| Image treatments         | `editorialCrop`, `productNeutral`, `softFrame`                                             | `fullBleed`, `contained`, `split`                              | —                                                                                                                         |
| Product-card families    | `minimalProduct`, `compactCommerce`, `premiumJewellery`                                    | `editorialImage`                                               | —                                                                                                                         |
| Homepage recipes         | all 3 IDs are direction-selectable                                                         | —                                                              | **Incomplete:** order survives, but existing sections are mostly retained and recipe variants are not uniformly compiled. |
| Collection recipes       | both IDs are direction-selectable                                                          | —                                                              | **Incomplete:** dynamic presentation survives, while recipe header/footer semantics remain coordinated selections.        |
| PDP recipes              | `productSimple`, `productJewellery`, `productVariantLed` are direction-selectable          | `productGallery`                                               | Selected recipes are **incomplete** for the same recipe-variant reason.                                                   |
| PDP gallery/info/options | Three dynamic presentation bundles reach the shell                                         | Gallery-dominant recipe and standalone `editorial` PDP variant | Legacy gallery/info/options identities are dropped by dynamic replacement.                                                |
| EN/FI                    | Language plan and localized component contracts survive to shared renderers.               | —                                                              | —                                                                                                                         |
| Responsive               | Four breakpoints and no-overflow contracts are registered.                                 | —                                                              | **Incomplete proof:** not every one of 76 variants has direct visual evidence at 375/768/1024/1440.                       |
| Accessibility            | Keyboard, semantics, labels and focus contracts exist; V2 commerce contracts are specific. | —                                                              | **Incomplete proof:** adapted V1 contracts are generic and per-variant route evidence is not exhaustive.                  |

## Prioritized gaps

### Blockers

1. **Connect the V2 homepage families to one canonical generation and rendering path.** Renderer
   code already exists, but the planner, canonical page model and Puck adapter cannot reach it.
2. **Make recipe semantics executable or narrow the contract.** Current recipe variants can be
   silently superseded or retained from the seed. A selected recipe must not imply composition that
   the plan cannot produce.
3. **Align capability advertisement with validated authority.** The real-provider schema advertises
   all variants while exact-plan validation permits only three direction outputs. Keep the safety
   boundary, but expose an honest selectable capability map.

### High-value design-quality gaps

1. Connect the already-built editorial homepage hero, featured collections/products, collection
   navigation, promotion and trust families before adding merchant-specific components.
2. Add approved directions for the existing `editorial` header, `expanded`/`dark` footers,
   `galleryDominant` PDP, `gallery` collection and `editorialImage` product-card family where their
   responsive and accessibility evidence is sufficient.
3. Decide whether `modernSans`, `editorialContrast`, `fullBleed`, `contained`, `split` and
   `productGallery` are supported design options or dead registrations.
4. Add a bounded border-treatment bundle so border/surface/elevation direction changes are coherent
   instead of partly inherited from the seed.

### Polish gaps

1. Add per-variant visual evidence at 375, 768, 1024 and 1440 for the variants made selectable.
2. Replace generic adapted V1 accessibility metadata with capability-specific evidence where the
   variant changes interaction or landmark structure.
3. Keep EN/FI assertions on every new direction, recipe and renderer bridge.

### Already available — do not rebuild

- The 76 approved variant renderers and V2 definitions.
- Typed dynamic collection and PDP bindings, protected commerce semantics and generic option logic.
- Three deterministic whole-storefront directions with atomic proposal behavior.
- Brand-system materialization for typography, spacing, radius, imagery and surface depth.
- Shared canonical renderer implementations for the 19 route-reachable component types.
- Deterministic Lumo generation fixtures and editor/preview/published compatibility harnesses.

## Recommended follow-up tasks and exact ownership

| Priority | Follow-up                                                                                                                                                                                                                 | Owned modules                                                                                                                                                                                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | **P9-03E — canonical V2 homepage composition bridge.** Map the six homepage V2 families into page recipes, planning instances, canonical snapshots and the editor/route renderer without a second page model.             | `src/application/storefront-design-system/{contract,registry}.ts`; `src/application/whole-storefront-generation-plan/{contract,planner}.ts`; `src/integrations/ai/whole-storefront-runtime-authority.ts`; `src/components/registry/{registry,v2-registry,homepage-commerce}.ts`; `src/integrations/puck/config.tsx`; focused generation and renderer-parity tests. |
| 2        | **P9-03F — executable recipe conformance.** Define which recipe fields compose, replace, retain or only order sections, and prove each selected recipe reaches the canonical snapshot.                                    | `src/application/storefront-design-system/contract.ts`; `src/application/whole-storefront-generation-plan/{planner,contract}.ts`; `src/application/whole-storefront-proposal-lifecycle/compiler.ts`; `src/integrations/ai/whole-storefront-runtime-authority.ts`; recipe/compiler conformance tests.                                                               |
| 3        | **P9-03G — honest provider capability schema.** Preserve exact-plan validation while distinguishing advertised registry vocabulary from provider-selectable directions and fields.                                        | `src/application/whole-storefront-generation-plan/provider.ts`; provider adapters under `src/integrations/ai`; real-provider contract tests.                                                                                                                                                                                                                       |
| 4        | **P9-03H — direction expansion from existing assets.** Add bounded direction mappings for approved unreachable variants and remove stale legacy collection/PDP component entries in favor of dynamic presentation fields. | `src/application/storefront-design-system/{contract,registry,registered-brand-system}.ts`; direction fixtures; dynamic collection/PDP and full-route visual tests.                                                                                                                                                                                                 |
| 5        | **P9-04 compatibility evidence.** Add per-selectable-variant EN/FI, responsive and accessibility evidence before enabling each new direction.                                                                             | `tests/e2e/storefront-responsive.spec.ts`; component accessibility tests; editor/preview/published parity tests; no production contract changes unless a reproduced defect requires one.                                                                                                                                                                           |

These tasks should be assigned serially where they touch the planner, design-system registry or
runtime authority. They must not run in parallel with another branch editing the same canonical
contracts.

## Deterministic acceptance and rerun

The audit is acceptable when:

1. all registered component variants match the explicit inventory exactly once;
2. every recipe component and variant resolves against the active V2 registry and page type;
3. the provider request exposes the same registry and only registered direction options;
4. all three deterministic directions prove the direct dynamic path and deferred legacy path;
5. renderer-only homepage families remain explicitly reported until a canonical bridge is merged;
6. missing, incomplete and inaccessible capabilities remain distinct; and
7. rerunning the inventory produces the same canonical value.

Run:

```bash
pnpm exec vitest run tests/unit/p9-03d-design-capability-reachability.test.ts
```

The Phase 9 compatibility gate additionally runs the existing registry, recipe, planner, compiler,
renderer parity, dynamic collection, dynamic PDP and Phase 9 suites, followed by
`pnpm validate:full` and `git diff --check`.

The responsive-evidence record derives its covered-variant count from the same generated inventory.
The conformance suite compares that value with the count documented above, so a registry change cannot
silently leave the audit documentation or responsive evidence stale.
