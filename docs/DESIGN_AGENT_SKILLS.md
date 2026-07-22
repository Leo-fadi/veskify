# Veskify Design-Agent Skills

**Version:** 1.2
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

The operation registry may include:

- `updateBrandTokens`
- `updateSectionContent`
- `updateSectionProps`
- `updateSectionStyleTokens`
- `changeSectionVariant`
- `addSection`
- `duplicateSection`
- `removeSection`
- `reorderSections`
- `replacePageComposition`
- `bindComponentData`
- `assignAssetRole`
- `createPageFromBlueprint`
- `updateLocalizedContent`
- `generateSeoMetadata`
- `createSourceDiscoveryResult`
- `createStorefrontDesignBrief`

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

- **Baseline:** capability exists in the current controlled proposal lifecycle.
- **Next:** immediate v1.2 implementation priority.
- **Later:** required after the underlying contracts exist.

### 6.1 Existing design-agent baseline

| Skill | Status | Purpose |
|---|---|---|
| `improveSelectedSection` | Baseline | Propose validated changes to one eligible section. |
| `improveCurrentPage` | Baseline | Coordinate compatible changes across one page. |
| `restyleWholeStorefront` | Baseline | Apply validated brand-system and multi-page design changes atomically. |
| `applyLuxuryStyle` | Baseline | Apply a premium direction through approved variants and tokens. |
| `applyMinimalNordicStyle` | Baseline | Simplify composition and apply restrained Nordic design direction. |
| `translateLocalizedContent` | Baseline | Update eligible EN/FI presentation content without touching protected data. |

These skills already use proposal review, protected-field guards, stale protection, atomic acceptance and undo/redo. Do not rebuild their lifecycle.

### 6.2 Source discovery and brief skills

#### `discoverExistingStorefront`

**Status:** Next
**Scope:** Source discovery
**Input:** Public URL, crawl policy, locale and merchant context.
**Output:** Source evidence with provenance, confidence and warnings.
**Forbidden:** Treating prices, stock, variants or page instructions as canonical truth.

#### `reconcileSourceWithCommerce`

**Status:** Next
**Scope:** Source discovery
**Input:** Source evidence plus canonical Vesko projection.
**Output:** Reuse candidates, conflicts, unresolved items and protected-source declaration.
**Rule:** Vesko wins every commerce conflict.

#### `reconstructBrandSystem`

**Status:** Next
**Scope:** Brand
**Input:** Logo, source evidence, business profile, assets and guided preferences.
**Output:** Validated palette, typography, spacing, shape, imagery and voice proposals.
**Rule:** Exact valid merchant colours must be supported through structured token operations.

#### `buildStorefrontDesignBrief`

**Status:** Next
**Scope:** Storefront
**Input:** Reconciled sources, brand proposal, asset inventory, locales and page needs.
**Output:** Merchant-reviewable Storefront Design Brief.
**Rule:** Initial generation cannot proceed until the brief is approved.

### 6.3 Asset-aware generation skills

#### `classifyAssetRoles`

Assign approved assets to roles such as logo, hero desktop, hero mobile, collection header, editorial story and product media. Every assignment retains asset ID and provenance.

#### `selectExistingAssets`

Select the best approved asset for a component using role, aspect ratio, product/collection relationship, locale and visual direction. It must never bind product media to the wrong product.

#### `requestMissingAssetResolution`

When required media is missing, create a merchant choice: reuse another approved asset, upload media, continue without media or generate a new asset through an adapter. Do not silently generate.

#### `generateInitialStorefront`

**Status:** Later, after P5 and P7 contracts
Creates homepage, collection and product-page compositions from the approved brief, page blueprints, bindings and approved assets. It must not copy seed-brand defaults into another merchant.

### 6.4 Reusable component and page skills

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

### 6.5 Visual-direction skills

#### `applyExactBrandPalette`

**Status:** Next
Accept named colours or valid colour values, map them to approved token roles, validate contrast and return a cross-page proposal. It must preserve layout, content and product truth unless broader changes are explicitly requested.

#### `improveTypography`

Adjust approved font tokens, scale, weights, line height and responsive text treatment. Do not load arbitrary unapproved font files or inject CSS.

#### `improveSpacingAndRhythm`

Adjust tokenized density, section spacing and grid gaps. Do not emit arbitrary pixel CSS.

#### `coordinateWholeStorefront`

**Status:** Later
Coordinate brand tokens, navigation, footer, homepage, collection and representative product pages as one atomic proposal. The result must feel like one designed storefront.

#### `fixResponsiveLayout`

Use approved responsive variants, content order, density, media crop and visibility rules. Validate 375, 768, 1024 and 1440 px.

#### `improveAccessibility`

Improve contrast, heading order, labels, focus-safe controls, alt-text completeness and responsive readability without hiding unresolved failures.

### 6.6 Content and localisation skills

- `generateSectionCopy`
- `shortenCopy`
- `changeToneOfVoice`
- `translateStorefront`
- `generateSeoMetadata`
- `detectMissingContent`
- `removeFixtureSpecificContent`

All factual copy must be grounded in merchant-provided facts, approved source evidence or canonical commerce data. Unsupported claims become questions or warnings.

## 7. Dynamic product-page skill guardrails

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

## 8. Proposal summary requirements

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

## 9. Test requirements

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

## 10. Capability policy

When a merchant request is valid but unsupported, Veskify must return an honest capability message and preserve the draft. The long-term goal is not to reject ordinary brand, colour, asset or dynamic-page requests merely because the initial deterministic examples were narrow. Expand approved contracts and tests instead of weakening validation.
