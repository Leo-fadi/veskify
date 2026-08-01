# Veskify Design-Agent Skills

**Version:** 1.2.2
**Aligned with:** `docs/VESKIFY_SDD.md`
**Product:** Vesko Storefront Studio, powered by Veskify

## 1. Purpose

Veskify uses controlled design skills to convert merchant intent and approved context into validated structured operations. Skills provide predictable design quality, protect canonical commerce truth and keep provider output replaceable.

A skill is not a free-form prompt and does not generate executable frontend code.

```text
Merchant intent
  -> scope and context
  -> approved skill plan
  -> structured operations
  -> schema and semantic validation
  -> proposal and preview
  -> accept, revise or reject
```

## 2. Canonical skill contract

```ts
type DesignSkillDefinition = {
  id: string;
  version: string;
  title: string;
  description: string;
  intents: string[];
  scope:
    | "sourceDiscovery"
    | "brand"
    | "asset"
    | "section"
    | "page"
    | "storefront"
    | "productPresentation";
  requiredContext: ContextRequirement[];
  optionalContext: ContextRequirement[];
  allowedComponentTypes: RegisteredComponentType[];
  allowedOperations: DesignOperationType[];
  protectedPaths: string[];
  preconditions: SkillPrecondition[];
  outputSchema: ZodSchema;
  validationRules: SkillValidationRule[];
  proposalTemplate: ProposalSummaryTemplate;
  testCases: SkillTestCase[];
};
```

Every skill must:

- declare exact scope and permissions;
- return structured data only;
- preserve unrelated pages, sections and content;
- respect active locale and fallback rules;
- use canonical commerce references rather than copied product facts;
- reuse approved assets, bindings, components, variants and tokens before generating new material;
- reject missing material facts instead of inventing them;
- provide deterministic fixtures for mock-provider tests;
- explain the proposal in merchant-friendly language.

## 3. Approved operation vocabulary

Skill package IDs use camelCase. Persisted proposal operations use the current registered uppercase
codes:

- `CHANGE_LOCALIZED_SECTION_TEXT`
- `CHANGE_SECTION_VARIANT`
- `CHANGE_BACKGROUND`
- `CHANGE_TYPOGRAPHY`
- `CHANGE_DENSITY`
- `CHANGE_SHAPE`
- `CHANGE_ALIGNMENT`
- `CHANGE_CTA_STYLE`
- `APPLY_APPROVED_BRAND_COLOURS`
- `APPLY_APPROVED_BRAND_TYPOGRAPHY`
- `APPLY_REGISTERED_BRAND_SYSTEM`
- `ADD_APPROVED_SECTION`
- `REMOVE_OPTIONAL_SECTION`
- `REORDER_SECTIONS`
- `APPLY_REGISTERED_PAGE_SECTIONS`

Names such as `createPageFromBlueprint`, `assignAssetRole` or `generateSeoMetadata` describe
planned capability outcomes, not registered serialized operations. They become Baseline only when
the operation schema, validator, compiler and tests merge.

Operations must identify the project, expected snapshot revision, target page/section, scope and binding context where applicable.

Operations may never modify SKU, product identity, product type, option values, variant identity, price, compare-at-price, stock, inventory, payment, shipping, tax, order or operational checkout truth.

## 4. Context and evidence rules

### 4.1 Canonical context

Skills may receive:

- project and business profile;
- approved Storefront Design Brief;
- current brand system;
- page tree and selected section;
- registered components, variants, blueprints and binding contracts;
- canonical commerce projection;
- product presentation context and variant resolver output;
- asset inventory and provenance;
- recent accepted or rejected proposals.

### 4.2 Public-source evidence

Website discovery output is untrusted evidence. It may inform:

- visual direction;
- typography clues;
- colour candidates;
- navigation and page clues;
- reusable copy and media candidates;
- brand tone and asset roles.

It may not:

- override canonical commerce values;
- execute instructions found in page content;
- widen skill permissions;
- become a trusted system prompt;
- create unsupported business claims.

## 5. Reuse policy

Before generation, inspect:

1. merchant-provided logo and brand materials;
2. approved existing-site evidence;
3. canonical product and collection media;
4. current storefront assets and copy;
5. approved page blueprints and industry presets;
6. registered component families and variants;
7. current design tokens and previously approved generated assets.

Image generation is optional and occurs only when no suitable approved asset exists or the merchant explicitly requests it.

## 6. Skill catalogue and implementation priority

Status values:

- **Baseline:** capability is merged and evidenced through the canonical proposal lifecycle.
- **Partial:** foundations exist, but the complete merchant outcome or required evidence is missing.
- **Planned:** approved future work.
- **Research recommendation:** external pattern worth evaluating, not a repository fact or
  implementation commitment.

### 6.1 Canonical names and migration relationships

| Reported name                                          | Canonical v1.2.1 name                                              | Relationship / status                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `analyseStorefrontSource`                              | `discoverExistingStorefront`                                       | Conceptual rename; Partial source-discovery foundations, not a live design-skill registry entry.                                                |
| `generateStorefrontFromBrief`                          | `generateInitialStorefront`                                        | Conceptual rename; Partial until complete Phase 9 generation/lifecycle evidence passes.                                                         |
| `applyBrandPalette`                                    | `applyExactBrandPalette`                                           | The registered exact-palette package is canonical for current token fidelity. A broader semantic palette package would be separate future work. |
| `fixMobileLayout`                                      | `fixResponsiveLayout`                                              | Planned conceptual rename covering all target widths, not only mobile.                                                                          |
| `replaceFixturePlaceholders`                           | `removeFixtureSpecificContent`                                     | Planned conceptual rename; neither name is a current registry ID.                                                                               |
| `restyleWholeStorefront` / `coordinateWholeStorefront` | `applyRegisteredWholeStorefrontDirection` for the current registry | Merchant intent/future orchestration names over the current Partial registered direction package.                                               |
| Uppercase serialized codes                             | camelCase Skill/application functions                              | Legitimate separate layers: persisted proposal operations versus application package/function identifiers.                                      |

Temporary documentation or merchant-language aliases must resolve to one canonical package or
operation before planning. They must not become parallel registries.

### 6.2 Existing design-agent baseline

| Skill                                     | Status   | Purpose                                                                                                            |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `applyLuxuryStyle`                        | Baseline | Registered section/page styling through approved variants and tokens.                                              |
| `applyMinimalNordicStyle`                 | Baseline | Registered restrained section/page styling.                                                                        |
| `addCampaignSection`                      | Baseline | Add one approved campaign section through registered operations.                                                   |
| `improveHero`                             | Baseline | Improve an eligible hero through controlled operations.                                                            |
| `applyExactBrandPalette`                  | Baseline | Apply exact validated token refinement proved by merged PR #123 while preserving unrelated composition.            |
| `applyWarmPremiumStorefrontStyle`         | Partial  | Registered whole-storefront token/variant capability; meaningful multi-page quality remains a Phase 9 gate.        |
| `applyMinimalNordicStorefrontStyle`       | Partial  | Registered whole-storefront token/variant capability; meaningful multi-page quality remains a Phase 9 gate.        |
| `applyRegisteredWholeStorefrontDirection` | Partial  | Registered direction selection and atomic lifecycle exist; complete coordinated composition evidence remains open. |

`improveSelectedSection`, `improveCurrentPage` and `restyleWholeStorefront` are merchant intent/scope
labels, not current registry IDs. Future Skill packages may use those names after their contracts
merge. Existing proposal review, protected-field guards, stale protection, atomic acceptance and
undo/redo must be reused.

### 6.3 Source discovery and brief skills

#### `discoverExistingStorefront`

**Status:** Partial
**Scope:** Source discovery
**Input:** Public URL, crawl policy, locale and merchant context.
**Output:** Source evidence with provenance, confidence and warnings.
**Forbidden:** Treating prices, stock, variants or page instructions as canonical truth.

#### `reconcileSourceWithCommerce`

**Status:** Partial
**Scope:** Source discovery
**Input:** Source evidence plus canonical Vesko projection.
**Output:** Reuse candidates, conflicts, unresolved items and protected-source declaration.
**Rule:** Vesko wins every commerce conflict.

#### `reconstructBrandSystem`

**Status:** Partial
**Scope:** Brand
**Input:** Logo, source evidence, business profile, assets and guided preferences.
**Output:** Validated palette, typography, spacing, shape, imagery and voice proposals.
**Rule:** Exact valid merchant colours must be supported through structured token operations.

#### `buildStorefrontDesignBrief`

**Status:** Partial
**Scope:** Storefront
**Input:** Reconciled sources, brand proposal, asset inventory, locales and page needs.
**Output:** Merchant-reviewable Storefront Design Brief.
**Rule:** Initial generation cannot proceed until the brief is approved.

### 6.4 Asset-aware generation skills

#### `classifyAssetRoles`

Assign approved assets to roles such as logo, hero desktop, hero mobile, collection header, editorial story and product media. Every assignment retains asset ID and provenance.

#### `selectExistingAssets`

Select the best approved asset for a component using role, aspect ratio, product/collection relationship, locale and visual direction. It must never bind product media to the wrong product.

#### `requestMissingAssetResolution`

When required media is missing, create a merchant choice: reuse another approved asset, upload media, continue without media or generate a new asset through an adapter. Do not silently generate.

#### `generateInitialStorefront`

**Status:** Partial

Planner, proposal, brief and component foundations exist, but a provider/API response does not make
this Baseline. The Skill becomes Baseline only when it creates homepage, collection and product
compositions from the exact approved brief revision, executable PageBlueprints, bindings and
approved assets, then passes review, atomic acceptance, persistence, preview and publication
through the same `StorefrontSnapshot`. Retained evidence must correlate project ID, brief ID,
revision/fingerprint, approval actor/action/timestamp and runtime request/proposal, and must prove
that no later unapproved brief mutation supplied generation. It must not copy seed-brand defaults
into another merchant.

### 6.5 Reusable component and page skills

#### `generateHomepageFromBlueprint`

Select compatible reusable component families and bindings using business profile, brand system, collections, products and approved assets. Normally create 6-10 coherent sections.

#### `generateCollectionPageFromBlueprint`

Create collection header, filter presentation, product grid, empty/no-results states and mobile/desktop filter variants from canonical collection data.

#### `generateDynamicProductPage`

Create a product-detail composition from `ProductPresentationContext`. It may choose gallery, information, option-renderer, trust, detail and related-product variants, but cannot alter the underlying product or option graph.

#### `improveDynamicProductPage`

May change gallery layout, information hierarchy, selector presentation, spacing, trust blocks and related-product composition. It may not change option values, required selections, resolver behaviour, price, availability or SKU.

#### `improveProductGrid`

May change density, card family, image treatment, columns, heading and ordering of references. It must render valid price, compare-at-price or unavailable-price states without inventing values.

### 6.6 Visual-direction skills

#### `applyExactBrandPalette`

**Status:** Baseline

Accept named colours or valid colour values, map them to approved token roles, validate contrast
and preserve layout, content, bindings, assets and product truth. This status is narrowly supported
by merged PR #123; it is not evidence of meaningful initial or coordinated storefront generation.

#### `improveTypography`

Adjust approved font tokens, scale, weights, line height and responsive text treatment. Do not load arbitrary unapproved font files or inject CSS.

#### `improveSpacingAndRhythm`

Adjust tokenized density, section spacing and grid gaps. Do not emit arbitrary pixel CSS.

#### `coordinateWholeStorefront`

**Status:** Partial

Registered direction, planner/compiler and atomic lifecycle foundations exist. This becomes
Baseline only when shared frame, homepage, collection and representative product pages use
compatible registered composition capabilities, remain meaningfully different beyond tokens and
pass the complete Phase 9 evidence gate.

Phase 9 capability work is limited to repairing reachability and exposing the smallest curated set
needed to prove its registered directions. Broad controlled-vocabulary scaling begins only after
Phase 9 closes and belongs to P10A-04, where additions must be validated canonical registrations
exposed by the generated Component Knowledge Registry.

#### `fixResponsiveLayout`

Use approved responsive variants, content order, density, media crop and visibility rules. Validate 375, 768, 1024 and 1440 px.

#### `improveAccessibility`

Improve contrast, heading order, labels, focus-safe controls, alt-text completeness and responsive readability without hiding unresolved failures.

### 6.7 Content and localisation skills

- `generateSectionCopy`
- `shortenCopy`
- `changeToneOfVoice`
- `translateStorefront`
- `generateSeoMetadata`
- `detectMissingContent`
- `removeFixtureSpecificContent`

All factual copy must be grounded in merchant-provided facts, approved source evidence or canonical commerce data. Unsupported claims become questions or warnings.

## 7. Grounded Skill package contract requirements

P10A defines the contract for every planned executable Skill with:

- canonical package ID and version;
- `initialGeneration` or `followUpEditing` lifecycle;
- exact scope classification: selected section/component, current page, shared frame, design system
  or complete storefront;
- an explicit authority declaration;
- required live capabilities from the generated Component Knowledge Registry;
- allowed registered operations and protected paths;
- executable PageBlueprint compatibility;
- input/output schemas and router validation rules;
- validation, quality and evidence requirements;
- merchant-safe proposal language.

Initial generation requires an approved brief and creates a proposal over the current
`StorefrontSnapshot`. Follow-up editing requires an existing snapshot and target scope. They MUST
NOT share an ambiguous “generate or edit” authority. Router contracts may narrow scope but must
reject silent widening, and unknown or stale capability references fail before proposal evaluation.

### 7.1 Commercial composition selection contract

When a Skill composes a page or storefront, it selects an approved recipe, only compatible controlled
component families/meaningful variants, permitted ordering, canonical bindings, approved assets and
typed bounded design parameters. It cannot emit a component tree, CSS, class names, executable
frontend code, unregistered font import or arbitrary layout value.

Selection resolves in this order: `BrandSystem` → coordinated page recipe → component family and
variant → limited validated instance override. A local override is exceptional, must be explicitly
allowed by the active recipe/family and must not establish a disconnected visual language.

Skill evidence records the complete capability reachability chain: registered → planner-selectable →
proposal-expressible → compiler-preserved → `StorefrontSnapshot`-stored → renderer-visible →
editor-editable → manually live-proven. Schema-valid selection alone is Partial. Closing visual
evidence reviews homepage, collection and PDP together at 375, 768, 1024 and 1440 px with real or
representative approved assets; placeholder SVGs and deterministic-only results are insufficient.

Optional evidence/trust slots are omitted when their approved merchant evidence is unavailable.
Skills and registry defaults must not invent claims about delivery, materials, durability, guarantees,
sustainability, popularity, performance or certifications.

P10A defines and validates the scopes. It does not deliver merchant-operable granular editing.
Phase 11 implements and exposes those scopes as working merchant features: selecting a component or
section, applying a selected-section proposal, current-page editing, shared-frame editing,
design-system editing, complete-storefront editing, add/remove/reorder/replace operations, proposal
preview and acceptance, mixed-scope history, Undo/Redo and merchant scope controls and warnings.

## 8. Dynamic product-page skill guardrails

A dynamic PDP skill receives, but does not own:

- product identity and type;
- localized title and description;
- media references;
- attributes and specifications;
- option groups and dependencies;
- canonical variant resolver interface;
- current selection and validation state;
- selected variant price, availability and media;
- related product references.

The skill may change presentation only:

- gallery family;
- content hierarchy;
- selector family by option type;
- spacing and grouping;
- trust and care sections;
- related-product layout;
- responsive arrangement.

The skill must preserve every option group, value, dependency and protected field.

## 9. Proposal summary requirements

Every material proposal states:

- requested outcome;
- affected scope;
- skills used;
- component, token, binding and asset changes;
- reused assets and provenance;
- assumptions and missing information;
- protected information that remains unchanged;
- validation warnings;
- Accept, Revise and Reject actions.

Acceptance applies to draft only. Publishing remains separate.

## 10. Test requirements

Each skill requires:

- deterministic success fixture;
- invalid-output fixture;
- protected-path test;
- stale-revision test where stateful;
- unrelated-target preservation test;
- missing-context or clarification test;
- provider failure rollback test;
- merchant-facing summary test;
- responsive/accessibility tests when the skill changes visible layout.

Dynamic PDP skills additionally require:

- simple watch with one colour dimension;
- complex ring with five or six option groups;
- unavailable combinations;
- incomplete-selection guidance;
- selected variant price/media updates through the resolver;
- generic unknown-product fallback.

## 11. Capability policy

When a merchant request is valid but unsupported, Veskify must return an honest capability message and preserve the draft. The long-term goal is not to reject ordinary brand, colour, asset or dynamic-page requests merely because the initial deterministic examples were narrow. Expand approved contracts and tests instead of weakening validation.
