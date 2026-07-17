# Veskify Design-Agent Skills

**Version:** 1.1  
**Aligned with:** authoritative `docs/VESKIFY_SDD.md` and synchronized export `docs/VESKIFY_SDD_v1.1.docx`

## 1. Purpose

Veskify uses a controlled skills system instead of repeatedly inventing complete pages, components, code, and assets.

A skill converts a recognized merchant intent into a bounded design plan and validated structured operations. Skills make output more predictable, less token-intensive, easier to test, and more likely to satisfy a non-technical retailer.

The AI does not directly edit the storefront. It selects and executes approved skills, and Veskify validates their operations before presenting a proposal.

## 2. Skill execution model

```text
Merchant request
  -> intent and scope
  -> context gathering
  -> skill selection
  -> skill plan
  -> structured operations
  -> validation
  -> proposal summary
  -> preview without mutating the active draft
  -> accept, revise, or reject
  -> apply accepted operations to the active draft
  -> save draft
  -> explicit publish when ready
```

A skill must never produce arbitrary React, HTML, CSS, JavaScript, scripts, embeds, or executable markup.

## 2.1 Status labels

Every operation, skill, and workflow carries one implementation status:

- **Implemented** — available in the repository and covered by current tests.
- **Next milestone** — required for the active Week 3 product slice.
- **Planned** — approved direction for a later roadmap milestone.
- **Deferred** — intentionally outside the current delivery focus.

A status describes repository maturity, not architectural importance.

## 3. Canonical skill contract

Each skill definition must include the following fields.

```ts
type DesignSkillDefinition = {
  id: string;
  version: string;
  title: string;
  description: string;
  intents: string[];
  scope: "section" | "page" | "storefront" | "brand" | "cataloguePresentation";
  supportedPageTypes: PageType[];
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

### Required behaviour

- Return structured operations only.
- Declare the exact scope before execution.
- Preserve unrelated pages and sections.
- Reject missing material context instead of inventing critical facts.
- Respect active locale and primary-locale fallback.
- Reuse existing assets, presets, variants, and tokens before generating new ones.
- Explain proposed changes in merchant-friendly language.
- Produce deterministic results when used with the mock provider.

## 4. Structured operation vocabulary

### Implemented

- `updateSectionContent`
- `updateSectionProps`
- `updateSectionStyleTokens`
- `changeSectionVariant`
- `addSection`
- `removeSection`
- `reorderSections`
- `updateBrandTokens`

### Next milestone

- `duplicateSection`
- `setSectionVisibility`
- `replacePageComposition`
- proposal revision and proposal-to-active-draft application contracts

### Planned

- `createPresentationEnrichment`
- `translateLocalizedContent`
- `generateSeoMetadata`

### Deferred

- unrestricted custom-component generation;
- arbitrary code, HTML, CSS, JavaScript, script, or embed operations.

Operations must identify the target project, snapshot revision, page, section, and expected scope where applicable. Operation status must be updated in this document when implementation lands.

## 5. Reuse policy for every skill

Before generation, each skill must inspect:

1. merchant-provided assets and guidelines;
2. existing storefront assets and copy;
3. product and catalogue media;
4. industry preset and page template;
5. existing component variants;
6. brand tokens and design patterns;
7. already generated assets approved by the merchant.

Generated imagery is permitted only when no suitable reusable asset exists and the visual outcome materially benefits from it.

## 6. Priority skill catalogue

### 6.1 Storefront assembly skills

#### `generateBrandSystem`

**Status:** Planned

**Intent:** Create a coherent visual system when the merchant lacks complete guidelines.  
**Scope:** Brand/storefront.  
**Context:** Industry, audience, brand adjectives, logo/assets, colour preferences, existing site reference.  
**Allowed operations:** `updateBrandTokens`.  
**Output:** Colours, typography, spacing, radius, button style, imagery direction, and tone of voice.  
**Forbidden:** Creating unrestricted CSS or replacing product data.

#### `generateHomepage`

**Status:** Next milestone

**Intent:** Assemble an initial homepage from approved components.  
**Scope:** Homepage.  
**Context:** Business profile, brand system, collections, product display data, available assets, campaign context.  
**Allowed operations:** Add, reorder, configure, or remove approved homepage sections.  
**Rule:** Use an industry preset first, then adapt rather than inventing a completely new structure.

#### `generateCollectionPage`

**Status:** Planned

**Intent:** Create a collection presentation.  
**Scope:** Collection page.  
**Context:** Collection title, description, products, approved filters, brand system.  
**Protected:** Price, SKU, stock truth, product identity.  
**Rule:** Filters are presentation suggestions unless supplied by the commerce source.

#### `generateProductPage`

**Status:** Planned

**Intent:** Create a product presentation from protected catalogue data.  
**Scope:** Product page.  
**Context:** Product display model, media, attributes, variants, order-option labels, related products.  
**Protected:** Price, stock, SKU, identifiers, operational variants, checkout behaviour.

### 6.2 Section design skills

#### `generateHero`

**Status:** Planned

Creates a hero using existing assets and an approved variant. It may generate copy and image-treatment instructions but may not invent an unregistered hero implementation.

#### `improveHero`

**Status:** Next milestone

Improves hierarchy, text length, CTA clarity, alignment, image treatment, variant, and responsive settings for one existing hero only.

#### `addCampaignSection`

**Status:** Next milestone

Adds a bounded campaign section using approved components. Requires campaign objective, products or collection, timing context, and available media. It may not create discounts, prices, or commercial terms that were not provided.

#### `addFeaturedCategories`

**Status:** Planned

Selects and presents existing categories or collections. It may suggest ordering and copy but may not alter source catalogue taxonomy without a separate approved enrichment proposal.

#### `addProductGrid`

**Status:** Planned

Adds a grid or carousel using protected product display references. It may control presentation density, card variant, heading, and ordering, but not product truth.

#### `addBrandStory`

**Status:** Planned

Creates or improves an editorial brand-story section from merchant-provided facts. Missing factual claims must trigger clarification rather than invention.

#### `addBenefits`

**Status:** Planned

Presents supplied merchant benefits such as warranty, repair, store pickup, or customer service. It must not invent legal, delivery, or return promises.

#### `addNewsletter`

**Status:** Planned

Adds or improves an approved newsletter section using existing brand tokens and supplied consent/legal copy. It may configure heading, supporting copy, field labels, CTA treatment, layout variant, and placement. It must not invent consent language, marketing permissions, incentives, or privacy claims.

#### `improveHeader`

**Status:** Planned

Optimizes hierarchy, navigation presentation, logo sizing, announcement placement, and mobile behaviour using existing navigation data.

#### `improveFooter`

**Status:** Planned

Improves structure and presentation of existing links, contact details, newsletter, social links, and legal navigation. It may not generate legal policy claims without supplied source content.

### 6.3 Visual-direction skills

#### `applyLuxuryStyle`

**Status:** Next milestone

May adjust approved typography, spacing, colour usage, image treatment, section variants, border/radius tokens, and hierarchy. It must not equate luxury with arbitrary dark backgrounds or gold accents; decisions must use brand and industry context.

#### `applyMinimalNordicStyle`

**Status:** Planned

May simplify composition, increase whitespace, reduce decorative elements, standardize imagery, and use approved Nordic typography and colour presets.

#### `applyEditorialStyle`

**Status:** Planned

May introduce asymmetry through approved variants, larger imagery, editorial typography, campaign storytelling, and controlled pacing.

#### `improveTypography`

**Status:** Next milestone

May update approved font tokens, type scale, weights, line length, hierarchy, and localized copy length. It cannot load unapproved fonts or inject custom CSS.

#### `improveColourPalette`

**Status:** Next milestone

May adjust validated brand tokens and component token usage. It must preserve contrast and merchant-specified brand colours unless the proposal explicitly explains a recommended change.

#### `improveSpacing`

**Status:** Next milestone

May update spacing density and section spacing presets. It cannot write arbitrary numeric CSS outside approved tokens.

#### `increaseVisualHierarchy`

**Status:** Planned

May adjust variants, heading scale, section order, emphasis, image prominence, and CTA treatment within approved contracts.

#### `fixMobileLayout`

**Status:** Next milestone

May change responsive variants, content order, text length, media crop, density, and visibility rules. Desktop content must remain semantically consistent unless the merchant approves a broader rewrite.

#### `improveAccessibility`

**Status:** Planned

May improve contrast, heading order, alt-text completeness, focus-safe controls, CTA wording, content length, and responsive readability. It must not hide accessibility failures behind cosmetic changes.

### 6.4 Content and localization skills

#### `generateSectionCopy`

**Status:** Planned

Generates presentation copy from verified business/product context. Must avoid unsupported claims, pricing, delivery promises, certifications, and legal assertions.

#### `shortenCopy`

**Status:** Planned

Shortens copy while preserving meaning, required facts, active locale, and tone.

#### `changeToneOfVoice`

**Status:** Planned

Applies approved voice attributes such as understated, expert, warm, playful, premium, or direct.

#### `translateStorefront`

**Status:** Planned

Creates localized presentation content with active-locale and primary-locale fallback. Product identifiers and protected commerce values remain unchanged.

#### `generateSeoMetadata`

**Status:** Planned

Generates title and description metadata from approved page/product content. It must not invent availability, offers, ratings, or guarantees.

#### `detectMissingContent`

**Status:** Planned

Produces a review list, not silent fabricated replacements, for missing images, descriptions, translations, metadata, or brand details.

### 6.5 Catalogue-presentation enrichment skills

These skills produce a separate enrichment proposal. They never overwrite source commerce data.

#### `normalizeProductTitles`

**Status:** Planned

Creates presentation-title suggestions while preserving source title and product identity.

#### `generateProductDescriptions`

**Status:** Planned

Generates presentation descriptions from verified product attributes and supplied facts.

#### `detectJewelleryAttributes`

**Status:** Planned

Suggests material, karat, stone, dimensions, ring size, engraving, collection, gender/style, watch movement, water resistance, and related presentation attributes. Confidence and source evidence should be recorded.

#### `suggestCollections`

**Status:** Planned

Suggests presentation groupings using product attributes and merchant context. The suggestion remains separate from source catalogue taxonomy until accepted/exported.

#### `suggestFilters`

**Status:** Planned

Suggests storefront filters supported by available product attributes.

#### `detectMissingImages`

**Status:** Planned

Identifies missing or insufficient media and recommends required image types. It does not create imagery automatically without approval.

#### `removePresentationDuplicates`

**Status:** Deferred

Detects duplicate presentation records or media while preserving source references and providing a reversible merge suggestion.

## 7. Composite workflows

### `generateStorefront`

**Status:** Planned composite workflow — not a primitive skill

`generateStorefront` orchestrates multiple bounded skills to create an initial multi-page storefront. It cannot widen the permissions of its constituent skills and must produce one reviewable proposal containing validated operations. A typical plan may use `generateBrandSystem`, `generateHomepage`, `generateCollectionPage`, `generateProductPage`, and enabled localization skills. The workflow must reuse merchant assets and industry presets before requesting generated content or imagery.

### “Make the homepage more luxurious”

Possible plan:

1. `applyLuxuryStyle`
2. `improveTypography`
3. `improveSpacing`
4. `improveHero`
5. optional `addBrandStory`

The planner must not automatically add every possible section. It should choose the smallest set of changes that addresses the intent.

### “Create a summer campaign”

Possible plan:

1. verify campaign products, timing, objective, and supplied offer;
2. `addCampaignSection`;
3. `generateSectionCopy`;
4. reuse supplied imagery or request approval for generated imagery;
5. optionally `addProductGrid` scoped to supplied products.

### “Build my jewellery storefront”

Possible plan:

1. `generateBrandSystem` if required;
2. `generateHomepage`;
3. `generateCollectionPage`;
4. `generateProductPage`;
5. `translateStorefront` for enabled locales;
6. validate complete draft and present a multi-page proposal.

## 7.1 Current implementation status

### Implemented foundation

- update localized section text;
- change section variant;
- change approved background, typography, density, shape, alignment, and CTA tokens;
- update approved brand colours;
- add approved section;
- remove optional section;
- reorder sections;
- generate deterministic homepage proposal;
- accept or reject an in-memory proposal.

These capabilities are operation and proposal foundations. They are not yet a complete skill planner.

### Next milestone

- duplicate section;
- hide/show section;
- proposal revision;
- proposal UI integration;
- applying accepted proposals to the active editor draft;
- deterministic skill planner and initial skill orchestration.

### Planned later

- presentation enrichment;
- translation skill;
- SEO generation;
- catalogue analysis;
- real AI provider adapter.

## 8. Skill testing requirements

Every skill requires:

- schema success and failure tests;
- protected-field tests;
- page/component permission tests;
- active-locale and fallback tests where localized;
- deterministic mock-provider fixtures;
- unrelated-section preservation tests;
- missing-context behaviour;
- proposal-summary tests;
- rejection/rollback tests;
- accessibility or responsive tests when visual behaviour changes.

## 9. Skill quality standard

A skill is ready only when:

- its output is predictable enough to demo repeatedly;
- the merchant can understand the proposal summary;
- it uses existing components and assets before generating new ones;
- it cannot bypass canonical validation;
- it cannot modify protected commerce truth;
- it can fail safely without damaging the draft;
- it improves a real merchant journey rather than merely expanding architecture.
