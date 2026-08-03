# P10A-02 — Repository capability audit and implementation map

**Audit date:** 3 August 2026

**Baseline:** `origin/main` at `761e01f`

**Scope:** P10A-03 through P10A-08 readiness; code and test evidence only.
**Excluded:** OpenAI calls, live generation, protected-project mutation, publishing, component additions, an executable recipe engine, router behaviour changes, and the Task 6 contracts owned by PR #136.

**Delivery state:** Prepared P10A-02 audit deliverable; activation and downstream dependency use remain gated on merged P10A-01.

**Sequencing record:** Phase 9 execution work was closed by the product-owner decision after PR #134, as recorded in [P9 closeout](./P9_CLOSEOUT_RECORD.md). PR #135 merged the Phase 10A evidence foundation in [P10A W2](./P10A_W2_EVIDENCE_FOUNDATION.md). This audit was prepared in parallel, while P10A-01 / PR #136 remains the contract dependency. P10A-02 must not be treated as activated or used to start P10A-03 until PR #136 merges. Required merge order: PR #136, then PR #137.

## 1. Executive conclusion

The repository has the canonical storefront aggregate, validated component contracts, a deterministic whole-store proposal compiler, persistence/publish safeguards, and a broad but uneven rendering vocabulary. It does **not** yet have one executable `PageBlueprint` contract, one queryable component-knowledge output, separate lifecycle Skill packages, a complete scope router, a commercial quality gate, or a deterministic publish compiler as specified for P10A.

The required implementation path is extension and convergence, not replacement:

`StorefrontTemplateDefinition` is the PageBlueprint precursor; `ComponentDefinitionV2` is the capability precursor; `StorefrontSnapshot` remains the only stored storefront aggregate; existing proposal compilation, save, preview and publishing remain the transactional path.

The material risks are already visible in code:

- `StorefrontTemplateDefinition` and `StorefrontDesignSystemV1` both describe recipes, slots and variants; the latter can supersede or retain template intent during whole-store compilation.
- The legacy `veskifyComponentRegistry` has 19 route/Puck-visible types, while `veskifyComponentDefinitionsV2` contains 25 types and 76 variants. The six V2 homepage-commerce families render but cannot enter the canonical page model or Puck configuration.
- Current scope routing is intentionally narrow: it recognizes only whole storefront or explicit homepage generation, while the older skill planner recognizes only section/page/storefront. Neither is a complete P10A scope authority model.
- Current publication is safe, revisioned and fingerprinted, but is a confirmation workflow rather than the P10A-08 compiler that rejects all publish-time capability, binding, migration, asset and accessibility failures before an immutable runtime projection is emitted.

## 2. Current architecture map

```text
Approved Design Brief
  -> template selection (`StorefrontTemplateDefinition`)
  -> deterministic initial materializer
  -> StorefrontSnapshot (canonical stored state)
  -> whole-store plan / validated proposal operations
  -> accepted draft -> save/reload -> preview/published routes

Component capability sources
  legacy ComponentDefinition renderer registry --adapted--> ComponentDefinitionV2
  native V2 commerce definitions ---------------------------> ComponentDefinitionV2
  V2 homepage-commerce definitions -------------------------> ComponentDefinitionV2

Rendering surfaces
  Puck / generic page renderer: legacy registry (19 types)
  collection/PDP commerce routes: native dynamic V2 renderers
  homepage-commerce renderer map: six native renderers, no canonical page/Puck bridge
```

`src/domain/storefront/storefront.ts` owns `StorefrontSnapshot`, `PageModel` and `SectionInstance`; no audit recommendation introduces a parallel page tree. `src/domain/storefront/canonical-storefront.ts` owns canonical content equality and SHA-256 fingerprints.

## 3. Capability matrix

| Capability               | Existing source                                                                                   | Runtime-queryable                            | Planner-visible                                  | Compiler-preserved                                           | Validated                                                                           | Rendered                                       | Status                     | Missing work                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Template precursor       | `src/application/storefront-templates/{contract,registry}.ts`                                     | Static API only                              | Initial selection and whole-store recipe context | Initial materializer only                                    | Schema, slot/order and registry validation                                          | Through produced snapshot                      | existing-but-not-queryable | Add PageBlueprint ID/version/page rules, cardinality, bindings/assets and profile semantics in P10A-03.             |
| Initial materialization  | `materializer.ts`                                                                                 | No                                           | Yes                                              | Produces `StorefrontSnapshot`                                | Brief, selection and registered-section validation                                  | Generic renderers                              | existing-and-sufficient    | Consume the converged PageBlueprint profile rather than a second recipe representation.                             |
| Design-system recipes    | `src/application/storefront-design-system/{contract,registry}.ts`                                 | Static API only                              | Yes                                              | Coordinated selections can override/retain recipe variants   | Fingerprint and cross-reference validation                                          | Indirectly                                     | duplicated                 | Converge recipe vocabulary with PageBlueprint profile constraints; do not make both executable.                     |
| Whole-store plan         | `src/application/whole-storefront-generation-plan/{contract,planner}.ts`                          | Provider request serializes full V2 registry | Yes                                              | Yes, through proposal compiler                               | Registry, recipes, brief/evidence/assets and canonical commerce fingerprints        | Snapshot after proposal                        | existing-but-not-queryable | Consume generated capability output after P10A-04 while retaining direction validation.                             |
| Proposal compiler        | `src/application/whole-storefront-proposal-lifecycle/compiler.ts`                                 | No                                           | Yes                                              | Yes, replay checked                                          | Preconditions, replay and stale checks                                              | Snapshot projections                           | existing-and-sufficient    | Preserve this proposal compiler; P10A-08 adds a distinct publish compiler.                                          |
| Legacy renderer registry | `src/components/registry/{registry,contract}.ts`                                                  | Yes                                          | Indirectly                                       | Yes for legacy sections                                      | Zod schemas and page/context checks                                                 | Editor, generic preview and published homepage | duplicated                 | Remove duplicated capability metadata only after generated-registry migration.                                      |
| Native V2 metadata       | `src/domain/component-platform/component-platform.ts`, `src/components/registry/v2-registry.ts`   | Yes in planner/provider inputs               | Yes                                              | Dynamic types direct; many legacy variants direction-bounded | JSON-schema, binding, asset, protected-path, responsive and accessibility contracts | Metadata claims all three targets              | existing-but-not-queryable | Generate one query view and make registry/surface drift fail in P10A-04.                                            |
| Homepage-commerce V2     | `src/components/registry/homepage-commerce.ts`, `src/components/storefront/homepage-commerce.tsx` | Yes in V2                                    | Advertised to provider                           | No canonical section/page bridge                             | V2 instance and binding conformance                                                 | Dedicated renderer map only                    | render-only                | Six types / 18 variants need canonical snapshot, Puck and planner composition reachability.                         |
| Scope classification     | `application/design-skills/planner.ts`, `application/ai-storefront-generation/scope-router.ts`    | No stable shared contract                    | Yes, narrowly                                    | Proposal-specific                                            | Skill/schema and request tests                                                      | Merchant flow depends on caller                | duplicated                 | P10A-06 provides one authoritative classification/authority contract.                                               |
| Save/reload              | `application/storefront-draft-persistence/adapter.ts`                                             | Adapter port                                 | N/A                                              | Stores canonical snapshots                                   | Context, revision, lineage and content fingerprints                                 | Preview loads saved snapshot                   | existing-and-sufficient    | P10A-08 consumes this write boundary rather than replacing it.                                                      |
| P10A-08 publish compiler | `application/publishing/*`, `integrations/vesko-publishing/*` are precursors                      | Preparation only                             | N/A                                              | Repository publish duplicates synchronized snapshots         | Aggregate/revision/fingerprint validation                                           | Published routes reuse preview clients         | missing                    | Add deterministic immutable runtime projection and publish-time capability/binding/asset/migration/a11y validation. |
| Commercial evidence      | `tests/helpers/phase-10a-evidence.ts`, Phase 9 audits/tests                                       | Test-only                                    | N/A                                              | N/A                                                          | Deterministic evidence assertions                                                   | Screenshot/manual evidence where invoked       | missing                    | Add golden-store matrix, retained real-provider gate and explicit structural-commercial gate.                       |

## 4. PageBlueprint and recipe path

| Stage                        | Canonical source                                                        | Input -> output                                                             | Current authority                  | Deterministic validation                                                                                  | Duplication / missing executable behaviour                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Definition                   | `storefront-templates/contract.ts`                                      | template JSON -> `StorefrontTemplateDefinition`                             | Template registry                  | Zod, unique IDs/slots, required/default variant checks                                                    | No `PageBlueprint` type, profile/version reachability or family cardinality.                                                   |
| Registration                 | `storefront-templates/registry.ts`                                      | definitions -> immutable templates                                          | Template registry                  | Page plan validates manifest, page type, variants, header/footer positions and required commerce sections | Three templates are static policy; definitions carry section types rather than V2 family/binding contracts.                    |
| Selection                    | `selection-planner.ts`                                                  | brief -> `StorefrontTemplateSelectionPlan`                                  | Selection planner                  | Brief fingerprint, capabilities, deterministic scoring/tie break                                          | Selection resolves template plans but not an independently versioned executable blueprint/profile.                             |
| Materialization              | `materializer.ts`                                                       | approved brief + selection + brand -> initial generation plan with snapshot | Materializer                       | Selection freshness, section defaults, snapshot and registered-renderer validation                        | Correctly writes only `StorefrontSnapshot`; must be retained as the P10A-03 materialization target.                            |
| Whole-store planning         | `whole-storefront-generation-plan/*`                                    | planning input + V2 registry + design system -> plan                        | Whole-store planner                | Fingerprints, V2 compatibility, asset/evidence/commerce checks                                            | Uses `StorefrontDesignSystemV1` recipes alongside template context. Selected direction can override or retain recipe variants. |
| Proposal compilation         | `whole-storefront-proposal-lifecycle/compiler.ts`                       | plan -> operations -> proposal projection                                   | Proposal compiler                  | Full replay/equality/precondition checks                                                                  | Operations target a transient whole-store representation before canonical snapshot projection. No profile conformance report.  |
| Application                  | `application/ai-storefront/*` and accepted-proposal paths               | validated proposal -> active draft                                          | Proposal lifecycle                 | Atomicity, stale/protected-field guards                                                                   | Correct canonical state boundary; do not add a recipe-owned persistence path.                                                  |
| Editor / preview / published | `integrations/puck/*`, `components/storefront/*`, project route clients | `PageModel` + context -> React                                              | Legacy registry and route adapters | Registered page/section and commerce-route presentation validation                                        | Generic surfaces do not all use the V2 renderer map; homepage V2 has no `SectionInstance` bridge.                              |

### P10A-03 conversion requirements

Extend the current template contract into the canonical executable `PageBlueprint` contract and make a commercial recipe a registered constrained profile of it. The extension must add: stable ID/version/page family; required/optional family and slot cardinality; permitted/default order; compatible family/variant IDs; typed binding and asset-role requirements; responsive composition constraints; omission/fallback rules; cross-page coordination; and a deterministic compiler/materializer conformance check.

It must not add a recipe-owned page graph, a second snapshot shape, a second persistence path, or a second renderer. `StorefrontTemplateDefinition` should converge into that contract; `StorefrontDesignSystemV1` should retain only bounded direction/presentation selections that refer to registered PageBlueprint profile values.

## 5. Component capability inventory

The live V2 registry has **25 component types and 76 variants**. Its family counts are content 17, commerce 4, marketing 2, navigation 1 and service 1. The 17 content definitions are the eligible legacy definitions after the two dynamic bridge types are excluded; all totals are derived from the canonical V2 registry in the audit artifact. Its companion test also verifies 16 home-compatible, 6 collection-compatible and 9 product-compatible V2 types.

| Product family                  | Canonical component IDs and variants                                                                                                                                                                           | Implementation / registration                                                                                                                   | Bindings, responsive and accessibility                                                                                                                                                                                                                          | Surface status                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared frame and navigation     | `announcementBar` (4), `header` (5), `footer` (5), `homepageCollectionNavigation` (2)                                                                                                                          | Legacy definitions in `registry/homepage.tsx`, adapted through `v2-compatibility.ts`; homepage navigation is native V2                          | Legacy types have typed Zod content/props and generic adapted responsive/a11y metadata. Homepage navigation has required canonical collection-list bindings and specific V2 contracts.                                                                          | First three are editor/preview/published through legacy bridge. Homepage navigation has an all-target renderer map but no canonical page/Puck bridge.                              |
| Homepage / editorial / campaign | `hero` (4), `featuredCategories` (4), `productGrid` (3), `campaignBanner` (3), `brandStory` (5), `benefitIcons` (4), `newsletter` (3); native `homepageHero` (6), `homepagePromotion` (3), `homepageTrust` (3) | Legacy React sections in `components/storefront/homepage-sections.tsx`; native V2 renderer map in `components/storefront/homepage-commerce.tsx` | Legacy variants are materially styled by `design-vocabulary.css`, with a few generic adapted contracts. Native V2 types have slots, protected paths, approved-asset/binding contracts, all four responsive breakpoints and explicit accessibility requirements. | Legacy types are route/Puck-visible. Native V2 types render but are not snapshot/Puck/planner-composed.                                                                            |
| Collection / discovery          | `collectionHeader` (1), `filterBar` (1), `dynamicCollectionCommerce` (4), `homepageFeaturedCollections` (2), `homepageFeaturedProducts` (2)                                                                    | Legacy collection sections plus V1 bridge; native dynamic V2 definition and renderer; native homepage V2 renderer map                           | Collection/PDP dynamic types require revisioned canonical commerce bindings and have explicit responsive/a11y contracts. Legacy collection header/filter use typed props but fixture-like `demoOnly` filtering.                                                 | Dynamic collection is special-cased in collection editor/preview/published route. Header/filter can be replaced by dynamic planning. Homepage featured V2 types are renderer-only. |
| PDP / presentation              | `productGallery` (1), `productInfo` (1), `productOptions` (1), `imageText` (3), `relatedProducts` (1), `dynamicProductDetail` (5)                                                                              | Legacy product sections and V1 bridge; native V2 dynamic definition and interactive renderer                                                    | Dynamic PDP has generic options, canonical product/product-list bindings, protected commerce fields, responsive/a11y and renderer-target contract. Legacy product sections are typed but several are seed/demo-shaped.                                          | Dynamic PDP is used by product preview/published routes; legacy identities are dropped during dynamic replacement in whole-store compilation.                                      |

### Renderer and registry facts

- No live V2 type is missing a renderer: the 19 legacy types use `veskifyComponentRegistry`; the six homepage V2 types and two dynamic V2 types have all-surface renderer maps.
- No legacy renderer type is missing from V2 metadata, and there are no duplicate V2 type or per-type variant IDs.
- The six homepage V2 types (`homepageHero`, featured collections/products, collection navigation, promotion and trust) are the exact set without a legacy `SectionInstance`/Puck bridge. Their 18 variants are consequently render-only in the existing Phase 9 reachability inventory.
- CSS confirms that the legacy visual vocabulary is generally material rather than label-only: header, hero, category, product-grid, campaign, story, benefit, newsletter, footer and image-text variants alter layout, media, typography, spacing or surface treatment. The remaining commercial question is reachability and visual proof, not simply whether names differ.
- `dynamicCollectionCommerce` and `dynamicProductDetail` exist twice by type: a legacy bridge definition supplies canonical page/Puck compatibility while a native V2 definition supplies binding-rich capability metadata and direct renderers. This is intentional transitional duplication, but P10A-03/04 must make the bridge relationship explicit and drift-checked.

## 6. Component Knowledge Registry implementation map

The authoritative inputs already exist and should be the only inputs to a generated registry:

1. `ComponentDefinitionV2` definitions from `src/components/registry/v2-registry.ts`.
2. Executable PageBlueprint contracts/profiles delivered by P10A-03.
3. `PresentationBinding`, asset-slot, protected-path and migration contracts in `src/domain/component-platform/component-platform.ts`.
4. Renderer availability maps in `src/components/registry/registry.ts` and the dynamic/homepage renderer modules.
5. Puck adapter availability from `src/integrations/puck/config.tsx`.
6. Commerce-route adapter capability from `src/integrations/storefront-commerce-routes/*`.

P10A-04 should generate a read-only query artifact exposing type/version/family/variant IDs, page compatibility, slot/cardinality/binding/asset contracts, responsive/a11y behaviour, bounded-parameter compatibility, PR #136 narrative compatibility, renderer availability, editor availability, and preview/published availability. It must be generated from the sources above, not hand-maintained alongside them.

The generation/check command should be a repository script such as `pnpm component-knowledge:check`, run in CI and in focused P10A tests. It must fail for an unknown profile component/variant, duplicate identity, renderer without a definition, definition without a target renderer, a page family with no compatible registered component, missing surface availability, or a stale generated fingerprint. Migration should first make the generated output the planner/provider query source, then remove duplicated manual capability enumerations only after equivalent tests pass.

## 7. Skill and router capability

| Area                        | Existing capability                                                                                                                                                 | Scope quality                                                                                                     | P10A addition needed                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic design skills | Eight registered skills in `application/design-skills`: luxury/minimal styling, campaign insertion, hero improvement, exact palette and three storefront directions | Explicit `section`, `page` or `storefront`; planner uses phrase maps/keyword inference and checks target sections | P10A-05 versioned packages separated by initial generation and follow-up lifecycle, with authority, required capability query, schema, negative cases and evidence. |
| AI storefront generation    | `application/ai-storefront-generation` has approved command/plan/provider boundaries                                                                                | Command supports `storefront` or restricted homepage page scope; planner is direction/phrase based                | Packages must not replace this proposal boundary; they provide inputs and declared authority to it.                                                                 |
| Scope router                | `scope-router.ts` conservatively routes explicit homepage-only request or whole storefront and rejects ambiguous limited scope                                      | Explicit regex inference; silently broadens an unqualified request to storefront by Phase 9 design                | P10A-06 authoritative typed union for selected section/component, current page, shared frame, design system and storefront; rejects every unapproved widening.      |
| Unsupported handling        | Design planner returns localized unsupported/clarification messages; scope router throws on ambiguity                                                               | Duplicated across planners and route callers                                                                      | Router schema and error projection must be one authoritative classification result, with no provider execution for unsupported scope.                               |
| Provider selection          | Deterministic providers and whole-store runtime/OpenAI adapters exist behind boundaries                                                                             | Provider-specific payloads are isolated                                                                           | P10A-05/06 record requirements and authority only; they do not add a provider or live execution.                                                                    |

## 8. Publish compiler capability

| Lifecycle point               | Current owner and evidence                                                                                                                                                                  | Gap to P10A-08                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proposal -> accepted snapshot | Whole-store proposal compiler replays operations, checks plan/draft/registry/commerce/asset fingerprints; proposal application is guarded and atomic                                        | Reuse this; ensure PageBlueprint/profile/version evidence reaches the accepted snapshot/proposal metadata.                                              |
| Save -> reload                | Draft persistence adapter validates authorization, lineage, revisions and canonical fingerprints before repository save; route clients load selected draft/history snapshots                | No immutable publish-runtime projection contract.                                                                                                       |
| Preview                       | Project clients build render context from the selected canonical snapshot. Generic preview renders homepage; collection/PDP routes use commerce adapters and native dynamic renderers.      | Surface behaviour is not uniformly compiled from one renderer projection.                                                                               |
| Publish                       | `preparePublish` makes revision/fingerprint preparation; `confirmPublish` performs repository publication and synchronized draft; authoritative adapter adds Vesko permissions/idempotency. | It does not centrally compile and reject unknown component versions, required binding/asset absence, migration work or critical accessibility failures. |
| Published rendering           | Published routes intentionally reuse preview clients with `snapshotKind="published"`.                                                                                                       | P10A-08 must emit/validate an immutable runtime snapshot/projection that needs no LLM, Puck runtime or provider object.                                 |

The deterministic P10A-08 compiler belongs between accepted/saved draft and publication. It must preserve the existing repository/authoritative adapter as the write boundary and must use canonical content fingerprints; it must not create a replacement publishing model.

## 9. Commercial-quality capability

| Evaluation area                                                    | Deterministic correctness already available                                                                          | Structural-quality checks available                                      | Human / screenshot-level review still required                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Narrative hierarchy, repeated sections and structural distinctness | Component/page/recipe assertions and P9-03D reachability inventory                                                   | Whole-store plan/operation structure and Phase 10A evidence fingerprints | Commercial rhythm, visual hierarchy and meaningful design diversity.                             |
| Responsive / overflow                                              | V2 breakpoint/no-overflow declarations; Phase 10A evidence matrix has EN/FI and 375/768/1024/1440 lifecycle coverage | Geometry and responsive acceptance helpers                               | Browser screenshots and interaction review for every newly selectable family/variant.            |
| Accessibility                                                      | V2 keyboard/semantics/labels/focus contracts; focused renderer tests                                                 | Puck/route and interactive commerce tests                                | Assistive-technology and visual contrast review; adapted V1 metadata is generic.                 |
| Product discovery and PDP purchase clarity                         | Canonical commerce bindings, dynamic option resolution and protected fields                                          | Collection/PDP renderer and route integration tests                      | Whether information hierarchy, CTA prominence and comparison affordances are commercially clear. |
| Approved media / protected commerce                                | Approved asset context, placement checks, canonical fingerprints and product display fingerprints                    | Evidence helper confirms lifecycle parity                                | Human review of crop, storytelling appropriateness and merchant truthfulness.                    |
| Editor/preview/published parity                                    | Shared renderer metadata and Phase 10A lifecycle evidence                                                            | Existing integration/parity tests                                        | Visual comparison where surface adapters differ, especially homepage V2 and dynamic routes.      |

There is deliberately no opaque aggregate quality score. P10A-07 should retain these separate deterministic, structural and visual gates.

## 10. Duplication and drift risks

1. Template page plans and design-system page recipes overlap in slot/component/variant/order policy. P10A-03 must converge their authority before any new commercial profile is added.
2. Legacy `ComponentDefinition` and V2 definitions duplicate IDs, variants, props/schema metadata and renderer declarations via `v2-compatibility.ts`. P10A-04 must derive capability output from V2 while preserving the legacy adapter only until surface bridge migration is complete.
3. Dynamic collection/PDP type IDs are represented as both legacy bridges and native V2 contracts. Drift can make V2 planning claims disagree with editor/route behaviour.
4. Homepage V2 renderer registration and actual canonical route/Puck availability are separate. Renderer metadata alone is not reachability evidence.
5. The provider request advertises the broad V2 registry while exact planning is direction-bounded; current P9-03D evidence records 29 fully reachable, 20 registered-but-unreachable, 9 planner-visible-but-lost and 18 render-only variants.
6. Scope phrase maps exist in both skill and storefront-generation planners. A new router must be authoritative rather than another classifier.
7. Proposal compilation and publish confirmation both transform/validate storefront state. P10A-08 must compose them around `StorefrontSnapshot`, not reimplement proposal or repository semantics.

## 11. Dependency order, PR boundaries and likely files

| Order | Task boundary                                  | Depends on                                                                | Likely owned files                                                                                                                                                                                               | Explicit non-goal                                                            |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1     | P10A-03 executable PageBlueprint profiles      | Merged P10A-01 / PR #136; this prepared P10A-02 audit then becomes active | `application/storefront-templates/{contract,registry,selection-contract,selection-planner,materializer}.ts`, `application/storefront-design-system/{contract,registry}.ts`, focused template/plan/compiler tests | No parallel recipe engine, component family or renderer redesign.            |
| 2     | P10A-04 generated Component Knowledge Registry | P10A-03                                                                   | `domain/component-platform/component-platform.ts`, `components/registry/{v2-registry,registry,v2-compatibility}.ts`, renderer/Puck capability seams, generation/check script and tests                           | No manually maintained second broad registry.                                |
| 3     | P10A-05 Skill package contracts                | P10A-04 query output                                                      | `application/design-skills/{contract,registry,planner}.ts`, `application/ai-storefront-generation/{contract,request-builder}.ts`, package fixtures/tests                                                         | No live-provider execution or Phase 11 controls.                             |
| 4     | P10A-06 strict scope router                    | P10A-05 authority declarations                                            | `application/ai-storefront-generation/scope-router.ts`, design-skill classification contracts/tests, proposal-request boundary                                                                                   | No merchant-operable granular editing or silent default widening.            |
| 5     | P10A-07 golden-store evaluation                | P10A-03 through P10A-06                                                   | Phase 10A evidence helpers, golden fixtures, focused unit/integration/e2e visual evidence tests and documentation                                                                                                | No opaque score or jewellery-only evidence.                                  |
| 6     | P10A-08 deterministic publish compiler         | P10A-03/04; consumes P10A-07 publish evidence                             | `application/publishing/{contract,prepare-publish,confirm-publish}.ts`, publishing adapter, renderer-projection tests                                                                                            | No AI call, Puck runtime dependency or replacement repository/publish model. |

PR #136 owns the P10A-01 / Task 6 narrative-role, visual-weight, transition, bounded-parameter and inheritance contracts. None of those files or schemas are changed by this audit. This P10A-02 deliverable is reviewable but remains inactive: merge PR #136 first, then PR #137; only then may P10A-03 use this audit as a dependency.

## 12. Acceptance criteria for remaining P10A tasks

### P10A-03

- One validated PageBlueprint/profile contract replaces template-recipe ambiguity while compiling only to `StorefrontSnapshot`.
- Profile compatibility, order/cardinality, bindings, assets, responsive/omission/fallback and cross-page rules are deterministic.
- Every selected profile is planner-selectable and proposal/compiler preserved; no second page graph is stored.

### P10A-04

- Generated capability output derives from V2 components, PageBlueprints, bindings/assets/protected paths/migrations and surface adapters.
- Query/check fails on all registry/renderer/page-family/variant/surface drift.
- Planner and provider read the generated output rather than a manual duplicate.

### P10A-05

- Initial generation and follow-up editing each have versioned, distinct packages with authority, schemas, operations, evidence and negative tests.
- Packages consume canonical capability queries and preserve the existing proposal boundary.

### P10A-06

- Router classifies only selected section/component, current page, shared frame, design system or storefront.
- Every ambiguous or widened request fails before planning; no unqualified local request becomes broader authority.

### P10A-07

- Golden stores cover premium/minimal and editorial jewellery, watch, dense non-jewellery/hardware, simple/complex PDPs, EN/FI and all four target widths.
- Separate deterministic, structural and screenshot/human evidence gates cover protected commerce, provenance, parity, discovery, purchase clarity, responsive and accessibility quality.
- A distinct mandatory retained real-provider gate records one real provider request, exact registered recipe/profile selection, retained request-and-response authority evidence, proposal and `StorefrontSnapshot` fingerprints, editor/preview/published parity, protected-commerce and approved-asset preservation, responsive evidence, and commercial screenshot/human evaluation.
- The real-provider gate is separate from deterministic fixtures, structural checks, screenshots and human review. P10A-07 cannot close from fixtures and screenshots alone, and deterministic publish makes no provider call.

### P10A-08

- Accepted `StorefrontSnapshot` compiles deterministically through publish-time validation to an immutable renderer projection.
- Compiler rejects unknown versions/bindings, missing required/critical assets, protected-field violations, critical accessibility failures and unresolved migrations.
- Published rendering requires no LLM, Puck runtime, provider proposal object or browser-accessible provider credentials.

## 13. Explicit non-goals and risk register

This audit adds no PageBlueprint engine, component family, router behaviour, publishing behaviour, provider call, live generation, protected-project mutation or publication. It does not alter PR #136 contracts or synchronized SDD text.

| Risk                                               | Consequence                                                                                                                                                                | Mitigation / owning task                                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Two recipe authorities survive P10A-03             | Planner output differs from a selected profile                                                                                                                             | Converge template and design-system recipe semantics in P10A-03; test compiler conformance.                                                 |
| Advertised capability is mistaken for reachability | The broad registry advertises types that the strict direction/planner path cannot select, so downstream tooling may mistake registry presence for executable reachability. | P10A-04 generates explicit registered, renderer, editor, preview/published, direction and planner reachability fields from actual adapters. |
| P10A-06 widens ordinary requests                   | Merchant local change unexpectedly changes storefront                                                                                                                      | Typed scope/authority union and negative router cases.                                                                                      |
| P10A-07 validates fixtures only                    | Commercial weakness or sparse/jewellery bias reaches publication                                                                                                           | Mandatory non-jewellery and visual evidence across EN/FI/four widths.                                                                       |
| P10A-08 duplicates persistence/publish             | Competing publishing state or unsafe migration                                                                                                                             | Keep existing adapters as write boundary; compiler consumes canonical snapshot only.                                                        |

## 14. Audit artifact and static consistency checks

`tests/fixtures/p10a-02-repository-capability-audit.ts` follows the repository’s existing typed audit-fixture pattern. It is derived directly from live registries and renderer maps, not persisted or used as a runtime architecture model. `tests/unit/p10a-02-repository-capability-audit.test.ts` detects:

- a legacy renderer with no V2 registered definition;
- a V2 component type with no registered renderer;
- duplicate V2 type or family/variant identity;
- a V2 definition missing editor/preview/published target declarations;
- a missing compatible component for home, collection or product page family; and
- an absent, unknown or multiple capability-matrix status; and
- the exact six V2 homepage component types currently missing the legacy canonical/Puck bridge.

The existing `tests/fixtures/p9-03d-design-capability-inventory.ts` remains the detailed per-variant reachability artifact; it is not duplicated here.
