# Commercial Storefront Design System Vocabulary — Implementation Specification

**Status:** implementation-ready technical specification; authoritative placement synchronized.

**Scope:** This document specifies extensions to existing canonical contracts. The P10B
architecture lock changes documentation only; it does not implement runtime code, schemas,
registries, PageBlueprints, components, styles, fixtures, synthesis, or provider behavior.

This specification defines the commercial design-grammar subsystem of **P10B — Commercial
Storefront Generation System v1**, after P10A publishing closure and before P10C Storefront Studio
Editing Experience v1. The binding complete-generation architecture and P10B-01 through P10B-18
sequence are in
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md).
This vocabulary does not create a second task register or imply that P10B-01 is implemented.

## 1. Executive contract

The commercial design system extends the existing controlled design path so bounded synthesis can
orchestrate commercially meaningful, renderer-visible choices by selecting compatible registered
contracts across the complete Veskify-owned page set without emitting CSS, class names, React, or
a new page model.

The one inheritance path is:

```text
BrandSystem
  -> registered PageBlueprint recipe/profile
    -> registered component family and variant
      -> constrained bounded instance override
        -> existing editor / preview / published renderer
```

Each lower layer may only select, narrow, or override values explicitly permitted by the layer above. `StorefrontSnapshot` remains the sole editable aggregate; `ComponentDefinitionV2`, executable PageBlueprint profiles, approved asset placement and canonical commerce projection remain their current authorities. `StorefrontDesignSystemV1` remains a direction orchestration/compatibility-selection projection and must converge onto those authorities rather than becoming a second token, recipe, or component registry.

Registered storefront direction is outside the inheritance chain. It selects and coordinates compatible members of that canonical chain: compatible BrandSystem choices, shared frame, homepage/collection/PDP profiles, component families/variants, typography, imagery, density and merchandising intent. It cannot mint tokens, bypass PageBlueprint/profile authority, directly override lower-level defaults, become an instance-value source, or create unsupported defaults/failures.

The current runtime path is an important baseline: `createWholeStorefrontGenerationPlan` already materializes `dynamicCollectionCommerce` and `dynamicProductDetail` as canonical collection/PDP component replacements, which are proposed and stored. Commercial design-system work extends the quality and governed diversity of that path; it does not create a collection/PDP bridge or replace those dynamic families.

## 2. Existing authorities to extend

| Existing authority                                          | Current responsibility                                                                                                                      | Provisional commercial design-system extension                                                                 | Boundary retained                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `BrandSystem` in `src/domain/design-system/brand-system.ts` | Validated palette, font tokens, scale ratio, radius, density, imagery style, optional visual system and contrast-derived CSS variables.     | Semantic type, spacing, container, surface, action, border/radius/elevation and image-treatment defaults.      | No unrestricted fonts, colour strings outside schema, CSS values or per-page raw styles.                             |
| `ComponentDefinitionV2` and `ComponentDesignCompatibility`  | Family/variant, schema, bindings, assets, responsive/a11y rules, narrative roles, bounded-parameter IDs and renderer identity.              | Family-specific composition semantics, complete variant compatibility and declared responsive transformations. | No merchant-specific components or renderer-owned planner data.                                                      |
| `boundedParameterDefinitions`                               | Structural/visual parameter definitions, compatible families/pages, authority levels and inheritance validation.                            | Add only approved parameter IDs/value domains needed by commercial foundations and art direction.              | No arbitrary property bag, free-form CSS or unregistered values.                                                     |
| Executable `PageBlueprint` profile and page-plan contract   | Slots, variants, narrative role/cardinality, flow rules, responsive parameter IDs, binding/asset categories.                                | Profile-level composition defaults/constraints, optional-region and direction compatibility rules.             | No second executable recipe/page graph or persisted profile state.                                                   |
| `StorefrontDesignSystemV1` direction registry               | Three coordinated direction packages that reference compatible recipe/profile, component-variant and collection/PDP presentation contracts. | Versioned compatibility-selection references to canonical foundation, profile and family/variant choices.      | It stays an orchestration projection; no duplicated canonical token, default, instance value or page representation. |
| Approved asset role/placement contracts                     | Asset role, provenance, approval/revision/fingerprint and safe render projection.                                                           | Typed treatment metadata and approved responsive crop references.                                              | Product media truth and asset inventory remain protected/owned elsewhere.                                            |
| Existing renderer contracts/CSS variable projection         | Converts validated state into shared editor/preview/published rendering.                                                                    | Resolves semantic tokens and registered transformations to renderer values.                                    | AI never supplies executable CSS, class names, DOM/React or arbitrary breakpoints.                                   |

## 3. Canonical inheritance authority and direction orchestration

| Layer                                   | Owns                                                    | May set                                                                                                                                         | May not set                                                                                             |
| --------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `BrandSystem`                           | Merchant-wide semantic foundations and voice.           | Registered palette assignments, type roles, rhythm, default containers, surface/action/border/radius/elevation families, default media posture. | Component tree, page order, bindings, raw CSS, product facts.                                           |
| Registered PageBlueprint recipe/profile | Page composition and cross-page constraints.            | Required/optional roles, slot/order/cardinality, composition defaults, responsive profile modes and allowed compatible variants.                | Brand palette/type definitions, protected commerce values, renderer implementation.                     |
| Registered component family and variant | Reusable semantic presentation pattern.                 | Variant default parameters, compatible assets/narrative roles, local responsive transformation and editable presentation paths.                 | New page order, unsupported global tokens, other component internals.                                   |
| Constrained bounded component instance  | Merchant-approved local presentation/content selection. | Only registered instance-overridable parameter values, allowed copy and approved asset placement/binding targets.                               | CSS/class names/React, broadening constraints, protected commerce facts, unregistered responsive modes. |

Inheritance resolves deterministically in this order: global semantic default → PageBlueprint profile restriction/default → component family/variant restriction/default → constrained instance value. For enums, a lower layer can only select from the currently effective allowed set. For numeric ranges, every lower constraint may narrow the inclusive range but never widen it. A missing value inherits; it does not mean “unbounded.”

Direction orchestration is evaluated before this resolution: it can select only compatible registered BrandSystem choices, profiles, frame/family variants and merchandising intent. It is a compatibility-selection authority, not an additional inheritance or override layer.

## 4. Vocabulary taxonomy

| Category                     | Canonical value classes                                                                                       | Primary owner                                         | Current basis                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Brand foundation             | type, colour, spacing, containers, density, surfaces, actions, border/radius/elevation                        | `BrandSystem`                                         | `colors`, `typography`, `shape`, `spacing`, `visualSystem`, `semanticPresentation` |
| Image treatment              | asset role, ratio, focal/safe area, crop, position, containment, overlay, text-on-image, fallback             | asset metadata/placement plus component compatibility | `AssetRole`, approved placement, `imageTreatment`, `imageAspect`, `cropTreatment`  |
| Component composition        | family, variant, pattern, visual weight, alignment, density, surface transition, slots, responsive mode       | `ComponentDefinitionV2` / bounded parameters          | component compatibility and narrative vocabulary                                   |
| Page composition             | shared frame, narrative roles/flow, required/optional slots, insertion/repetition/adjacency, responsive order | executable PageBlueprint profile                      | template page plan and profile materialization                                     |
| Direction orchestration      | compatible foundation, page-profile and component-family selection; coordinated merchandising intent          | registered direction                                  | `StorefrontDesignSystemV1.directions`                                              |
| Protected presentation input | asset placement and read-only commerce binding                                                                | existing domain/canonical commerce contracts          | approved placements and V2 binding slots                                           |

## 5. Structural versus visual authority matrix

| Field category            | Examples                                                                                              | Brand                     | Direction selection                               | Profile                           | Variant                            | Instance                                                  | Protected / rejected                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------- | --------------------------------- | ---------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| Structural                | layout model, media/info/filter placement, columns, section width, cardinality, gallery mode          | default only              | selects compatible profile posture                | primary authority                 | compatible default/narrowing       | only if `instanceOverrideAllowed`                         | arbitrary DOM/order/grid/CSS                                   |
| Visual                    | density, surface, visual weight, typography role, image/border/shape/spacing/emphasis/background/tone | semantic default          | selects compatible foundation/profile/variant set | allowed/narrowed page range       | family/variant default             | bounded local choice                                      | arbitrary style strings/classes                                |
| Content                   | localised headings, body, CTA labels, approved story copy                                             | voice constraints         | selects compatible tone/intensity profiles        | required/optional content slots   | schema/default                     | editable schema paths                                     | executable/instructional content or unsupported claims         |
| Asset                     | approved asset ID, role, presentation/crop selection                                                  | default treatment posture | selects compatible treatment contracts            | required/optional asset-role rule | accepted asset role/treatment      | approved placement only                                   | unapproved/wrong-role media or copied commerce media           |
| Commerce binding          | product, collection, list, navigation IDs and revisions                                               | none                      | selects compatible presentation contracts only    | required binding categories       | accepted binding slot types        | another valid canonical target when allowed               | fields inside product/variant/price/inventory objects          |
| Protected commerce truth  | product ID/type, SKU, price, compare-at, availability, stock, options, media provenance               | none                      | none                                              | placement/adjacency only          | presentation only                  | none                                                      | all mutations fail closed                                      |
| Responsive transformation | stack, reorder, density reduction, crop switch, nav/filter/gallery mode, grid columns                 | semantic scale/default    | selects compatible profile/variant modes          | page constraints                  | declared transformation            | only selected supported mode                              | pixel CSS, arbitrary breakpoints or unsupported transformation |
| Narrative metadata        | role, visual weight, transition intent, flow-rule reference                                           | none                      | selects compatible page-intent profiles           | primary role/order/cardinality    | compatible roles/weight/transition | no widening; only registered permitted instance selection | free-text role/animation/ordering                              |

The direction-selection column records orchestration and compatibility only. It grants no token, default, narrowing or instance-override authority; effective values still resolve through BrandSystem → PageBlueprint profile → component family/variant → bounded instance override.

## 6. Brand foundation vocabulary

### 6.1 Proposed semantic vocabulary

Vocabulary contract implementation should extend `BrandSystem`; it must not create a standalone token registry. The proposed values below are closed enums/validated scales whose renderer values are derived in `brandSystemToCssVariables` or an equivalent canonical projection.

| Domain                  | Proposed semantic values                                                                                                                                                                                                                      | Owner and override rule                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Font-family roles       | `display`, `heading`, `body`, `utility`, `price` resolve only to existing approved font tokens initially.                                                                                                                                     | Brand owns assignments; direction may select a compatible registered BrandSystem/profile typography combination; instances cannot select fonts.                                                  |
| Type roles              | `display`, `h1`, `h2`, `h3`, `body`, `bodySmall`, `label`, `eyebrow`, `button`, `price`, `caption`.                                                                                                                                           | Brand owns scale/weights; direction may select compatible registered profiles, which select compatible emphasis/reading-width; instance may not change numeric type.                             |
| Type scale              | Base size remains 14–20 and scale ratio 1.125–1.5; add named derived roles rather than component-local unrelated clamps.                                                                                                                      | Brand only; renderer calculates values.                                                                                                                                                          |
| Semantic colour         | Existing `primary`, `secondary`, `accent`, `background`, `surface`, `text`, `mutedText`, `border`, plus derived `page`, `section`, `raised`, `inset`, `inverse`, `focus`, `link`, `actionPrimary`, `actionSecondary`, disabled/status roles.  | Brand supplies base values; renderer derives compatible foregrounds and validates contrast. Direction may select a compatible registered BrandSystem/profile combination, never literal colours. |
| Surface                 | `quiet`, `soft`, `layered`, `contrast`, `inverse` presentation roles; map to existing visual-system surface/depth values first.                                                                                                               | Brand default; profile/variant selects only compatible role.                                                                                                                                     |
| Actions                 | `primary`, `secondary`, `quiet`, `text`, `destructive` only where an existing product surface permits it; action hierarchy maps from current `buttonHierarchy`.                                                                               | Brand owns the default; direction may select a compatible profile/variant action posture, and the profile/variant supplies the effective presentation.                                           |
| Spacing rhythm          | Semantic `pageGutter`, `sectionCompact`, `sectionStandard`, `sectionSpacious`, `gridGap`, `cardInset`, `controlInset`; density remains `compact`, `standard`, `spacious`/BrandSystem `airy`, `balanced`, `compact` through a defined mapping. | Brand defaults; profile/variant may narrow density.                                                                                                                                              |
| Containers              | `reading`, `content`, `commerce`, `wide`, `full`; map initially to current narrow/standard/wide content widths, with a controlled full-bleed exception.                                                                                       | Brand default; profile/variant selects compatible width; instance only where bounded `sectionWidth` permits.                                                                                     |
| Border/radius/elevation | Border `none`, `subtle`, `defined`; radius `square`, `subtle`, `rounded`, `pill`; elevation `flat`, `subtle`, `layered`.                                                                                                                      | Brand defaults; profile/variant narrows; instance may choose an allowed presentation value, not pixels/shadows.                                                                                  |

### 6.2 Contrast and status contract

Existing contrast-derived foregrounds remain required. Every text/action/surface pair must resolve to the existing contrast minimum before renderer output; no direction, profile or instance can override the calculated foreground with a raw colour. Status and commerce availability presentation remains protected: design may choose compatible surface/emphasis treatment but never change canonical availability, price, compare-at price, stock, SKU, option or inventory truth.

## 7. Image-treatment vocabulary

### 7.1 Canonical media treatment contract

Asset roles remain the existing closed set: `logo`, `heroDesktop`, `heroMobile`, `collectionImage`, `productMainImage`, `productAlternativeImage`, `editorialImage`, `supportingContentImage`, and `iconDecorative`. Image-treatment authority implementation should add a typed, approved presentation subrecord associated with an asset placement or approved renderer projection; it must not embed mutable media data in component content.

| Field                           | Closed vocabulary / shape                                                                                                                       | Owner                                                     | Rule                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `aspectRatio`                   | `natural`, `portrait`, `landscape`, `square`, plus family-approved named ratios where renderer supports them.                                   | Asset treatment default + variant compatibility.          | Renderer resolves CSS; instance selects only allowed registered ratio.                                      |
| `focalPoint` / `objectPosition` | Normalised named positions (`center`, `top`, `bottom`, `start`, `end`) or bounded normalised coordinates when a delivery adapter supports them. | Approved asset presentation.                              | No raw style string; absent metadata uses deterministic center/family fallback.                             |
| `fit`                           | `contain`, `cover`, `editorial`.                                                                                                                | BrandSystem media default → profile/variant constraint.   | Direction may select only compatible contracts; the resolved fit must match the asset role and variant.     |
| `bleed`                         | `contained`, `fullBleed`, `framed`, `split`.                                                                                                    | Profile/variant.                                          | Only registered components with compatible `sectionWidth`/media placement can select it.                    |
| `overlay`                       | `none`, `soft`, `strong`, `contrast`; only when text-on-image is supported.                                                                     | Variant/profile.                                          | Renderer supplies contrast-safe overlay; instance cannot select arbitrary opacity/colour.                   |
| `textOnImage`                   | `unsupported`, `supported`, `required` with safe-area requirement.                                                                              | Component variant.                                        | A profile requiring text-on-image fails if approved media/safe area is unavailable.                         |
| Responsive crop                 | desktop/mobile asset reference or deterministic crop treatment/focal override.                                                                  | Approved asset presentation, selected by responsive rule. | `heroMobile` is used only in a compatible hero slot; otherwise the declared fallback applies.               |
| Fallback                        | `hide`, `containedPlaceholder`, `textOnly`, `canonicalMediaOnly`.                                                                               | Component asset slot/profile omission rule.               | Required approved media with no allowed fallback rejects materialization; commerce media remains canonical. |

### 7.2 Treatment compatibility

`productMainImage` and `productAlternativeImage` stay commerce-owned and may use only canonical media/approved compatible presentation. Editorial source imagery must not replace a product-card/PDP product media binding. Text-on-image requires contrast-safe renderer output, non-decorative alt requirements and an approved crop/safe-area record. A missing mobile crop must fall back deterministically to the desktop approved asset with the registered crop treatment; it must never trigger generated imagery.

## 8. Component-composition vocabulary

Commercial design-system work extends the current `ComponentDefinitionV2` metadata rather than declaring a new component catalogue.

| Composition dimension     | Contract value                                                                                                                                                | Authority and validation                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Family and variant        | Existing stable `type`, version, family and registered variant ID.                                                                                            | Registry is the only source; unknown/incompatible variants fail before proposal compilation.              |
| Structural pattern        | Registered pattern ID such as split, full bleed, grid, carousel, editorial card, compact commerce, gallery/purchase split.                                    | Variant declares one or more patterns; PageBlueprint selects a compatible variant, never primitive trees. |
| Content density           | `compact`, `standard`, `spacious`; with family-specific bound controls (for example PDP option density).                                                      | Brand default → PageBlueprint profile → family/variant → allowed bounded instance override.               |
| Visual weight             | Existing `light`, `medium`, `heavy`, `dominant`.                                                                                                              | Must satisfy narrative role, component compatibility and no-adjacent-dominant flow rule.                  |
| Alignment and width       | Existing `contentAlignment`, `sectionWidth`, `mediaPlacement`, `productInformationPlacement`, `filterPlacement`, `galleryMode`, `columnCount`, `cardinality`. | Structural bounded parameters only; each family explicitly opts in.                                       |
| Surface transition        | Existing `surfaceTreatment`, `backgroundRole`, `borderTreatment`, `shape`, `emphasis`, `tone`.                                                                | Values resolve to BrandSystem semantic roles, not arbitrary CSS.                                          |
| Assets                    | Existing accepted asset roles/cardinality plus proposed treatment compatibility.                                                                              | Slot and variant validate role, approval, provenance, crop and fallback.                                  |
| Narrative                 | Existing allowed narrative roles, visual weights, transition intents and commerce requirement.                                                                | Profile and variant compatibility must both pass.                                                         |
| Responsive transformation | Registered transformations and each supported breakpoint state.                                                                                               | Variant owns its transformation vocabulary; instance may choose a supported declared mode only.           |

The initial commercial families to deepen are shared frame, hero, collection discovery, product card/grid, editorial/story, campaign, trust/service, dynamic collection commerce and dynamic product detail. Existing `dynamicCollectionCommerce` and `dynamicProductDetail` are the runtime authorities for collection/PDP: commercial design-system work enriches their compatible profiles and presentation parameter ranges.

## 9. Page-recipe vocabulary

`PageBlueprint` remains the executable composition contract. A commercial recipe is a registered constrained profile on that contract and remains transient metadata/materialization input—not a persisted page graph.

| Page scope        | Required controlled regions                                                                             | Optional controlled regions                                                                   | Provisional profile additions                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared frame      | exactly one header and footer; announcement may precede header.                                         | announcement, service/navigation extensions allowed by profile.                               | At least four frame systems, three mobile navigation modes, four footer compositions, and coordinated announcement/search/cart/locale treatment. |
| Homepage          | orientation hero, primary discovery, service/footer.                                                    | collection discovery, story, campaign, trust, newsletter under existing omission rules.       | At least six materially different narrative/profile choices spanning commercial emphasis, rhythm and media posture.                              |
| Collection/search | canonical dynamic collection commerce runtime component, shared frame, and results/no-results state.    | approved child collections, campaign/proof when evidence compatible.                          | At least four editorial discovery, catalogue comparison, campaign-led, and dense/search profiles with coordinated filters/cards.                 |
| PDP               | canonical dynamic PDP runtime component and shared frame; conversion remains adjacent to product focus. | supporting proof/service/story/related products only where registered and canonically bound.  | At least four standard, high-consideration, gallery-led, and variant-led profiles through the same generic option/commerce architecture.         |
| Content/support   | approved-fact content role, shared frame, route, navigation, and localization.                          | evidence-backed story, location, service, campaign, and related content under omission rules. | About/story, Contact/locations, FAQ, shipping/returns, policy, campaign/editorial, and reusable generic content profiles.                        |
| Commerce utility  | canonical operational context where available, shared frame, accessible action/state presentation.      | registered empty/error recovery and approved service guidance.                                | Search/no-results, cart, checkout, empty, error, and 404 presentation while Vesko retains operations.                                            |

Insertion must use a declared optional slot whose family, variant, narrative role, visual weight, asset/binding requirements and maximum cardinality all pass. Repetition uses existing per-role and per-family limits. Flow rules continue to prohibit invalid adjacency and direct product-context/conversion separation. Responsive reordering is a registered profile/variant transformation; it cannot alter canonical commerce adjacency or move a required shared-frame region outside its protected position.

## 10. Storefront-direction vocabulary

Each registered direction must select a complete compatible set, not a palette label:

| Direction field         | Required coordinated compatibility selection                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundation              | Compatible BrandSystem semantic foundation identity/version or validated registered projection.                                                  |
| Typography              | Compatible registered BrandSystem and PageBlueprint profile choices for font-role/scale/reading-width posture.                                   |
| Density and surfaces    | Compatible foundation/profile references for spacing density, containers and surface/border/radius/elevation posture.                            |
| Image treatment         | Compatible profile/family/variant treatment, overlay and responsive-crop references.                                                             |
| Shared frame            | Compatible header/navigation/announcement/footer profile and family/variant references, including mobile transformation.                         |
| Page profiles           | Compatible registered profiles for the selected complete page set, including home, commerce, content/support, and utility families.              |
| Component compatibility | Product-card, hero/editorial/campaign/trust and dynamic-commerce families/variants allowed by those profiles.                                    |
| Merchandising intent    | Registered compatibility trait selecting profiles/variants for `restrained`, `balanced` or `campaignLed` optional-region prominence and density. |

A direction coordinates and selects these registered choices; it does not supply their inherited values. It must not directly override defaults, mint arbitrary tokens, bypass PageBlueprint/profile authority, source instance values, or introduce unsupported defaults or failure rules.

A direction is valid only if it differs from every other active direction across at least two non-colour foundation dimensions and has a material composition difference on home, collection and PDP. Existing directions (`premiumEditorial`, `modernTechnical`, `warmApproachable`) already coordinate typography, density, image treatment, shared-frame choices and collection/PDP presentation. Cross-page design-direction implementation makes that coordination deeper and renderer-visible; it does not add a second direction authority.

## 11. Narrative metadata

Use the existing registered narrative roles: `orientation`, `primary-discovery`, `secondary-discovery`, `product-focus`, `product-proof`, `brand-story`, `brand-proof`, `education`, `campaign`, `trust`, `service`, `conversion`, and `continuation`; visual weights remain `light`, `medium`, `heavy`, `dominant`; transition intents remain `continuation`, `contrast`, `escalation`, `proof`, `clarification`, `conversion`, `reset`.

Narrative composition implementation should add only profile/family compatibility and commercial presentation metadata needed to use these values, for example: permitted section-count range, required adjacent commerce context, optional asset/evidence condition, and direction-compatible weight progression. It must not add free-text narrative names, animation instructions or an independent narrative planner.

## 12. Responsive authority

Responsive authority is semantic and registered, with evidence at 375, 768, 1024 and 1440 px. Components continue to declare mobile/tablet/desktop/wide rules and `allowHorizontalOverflow: false`; renderer CSS maps those rules to its controlled breakpoints.

| Responsive concern               | Registered behaviour                                                                                                                            | Authority                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Breakpoint-independent semantics | Required landmarks, canonical bindings, asset roles, heading/order meaning, protected commerce and accessibility contract do not change.        | Component + PageBlueprint.                             |
| Layout transformation            | `none`, `stack`, `split`, `grid`, `carousel`, `disclosure`, `stickyPurchase` only when declared by variant.                                     | Variant defines; profile selects; renderer implements. |
| Stacking/order                   | Registered named placement/order transition, such as media above information or filter disclosure.                                              | Profile/variant; no arbitrary CSS `order`.             |
| Density/typography               | Direction selects compatible profiles; profile/variant resolves constrained density/type role; renderer applies scale at the named breakpoints. | Brand/profile/variant; no instance pixel values.       |
| Media                            | Registered desktop/mobile crop/treatment/focal fallback.                                                                                        | Approved asset presentation + component variant.       |
| Navigation                       | Declared full navigation → compact/disclosure/drawer pattern with keyboard/focus requirements.                                                  | Shared-frame variant/profile.                          |
| Product grid                     | Declared 1–4-column bounds and grid/carousel collapse mode.                                                                                     | Product-card/grid variant/profile.                     |
| Collection                       | Filter sidebar/horizontal/disclosure and child-collection presentation are declared combinations.                                               | `dynamicCollectionCommerce` variant/profile.           |
| PDP                              | Gallery/info stacking, thumbnail/grid mode and sticky mobile purchase action are declared combinations.                                         | `dynamicProductDetail` variant/profile.                |

Every selected responsive mode must be renderer-visible at the target widths. The review matrix retains existing EN/FI locale coverage, no-overflow geometry/a11y checks and screenshot/human-review references; a contract declaration alone is not visual-quality proof.

## 13. Compatibility rules

Compatibility is evaluated before a plan/proposal is accepted, in the following deterministic order:

1. direction ID/version, compatible BrandSystem projection and all referenced profiles/families/variants exist;
2. profile page scope and required bindings/assets match its page and canonical context;
3. component family supports page type, profile policy and selected narrative role/weight/transition;
4. variant is registered, permitted by the profile and compatible with the selected direction;
5. every bounded parameter exists, is allowed by the family and effective inherited constraint, and has no incompatible companion;
6. asset role/approval/provenance/cardinality and proposed treatment suit the component/variant;
7. responsive mode is declared by the selected variant, permitted by the profile and compatible with the selected direction;
8. narrative order, adjacency, cardinality, shared-frame positions and commerce-conversion placement pass;
9. canonical commerce binding and protected fields remain valid.

| Dimension                               | Required compatibility                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Family ↔ PageBlueprint slot             | Component type/family, page type, slot cardinality and profile policy pass.                                        |
| Variant ↔ profile + direction selection | Registered, explicitly allowed by the profile, semantically meaningful and compatible with the selected direction. |
| Narrative ↔ family                      | Role, visual weight and transition are in `ComponentDesignCompatibility` and registered role definitions.          |
| Asset ↔ component/variant               | Approved role, owner/provenance, cardinality, treatment and responsive fallback are valid.                         |
| Typography/image ↔ direction selection  | Direction references registered foundation/treatment contracts compatible with the selected profile/family.        |
| Responsive mode ↔ variant               | Mode is declared for the variant at all required target widths; no arbitrary breakpoint values.                    |
| Adjacency/shared frame                  | Flow rules, role/family repetition and header/footer protected position pass across affected pages.                |

Direction compatibility is a selection gate before canonical inheritance resolution. An incompatibility uses the existing typed compatibility rejection; the direction does not inject a default, alter resolution precedence, or define a new fallback/failure rule.

## 14. Bounded override rules

| Override state                | Meaning                                                                     | Example                                                                                                | Validation result                                                                          |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Inherited                     | No local value; renderer receives the resolved canonical upper-layer value. | PDP receives density resolved from BrandSystem through the selected PageBlueprint profile and variant. | Valid.                                                                                     |
| Registered variant default    | Variant supplies its declared default within upper constraints.             | `editorialSplit` supplies a compatible gallery/info posture.                                           | Valid when BrandSystem/profile constraints allow it and direction selection is compatible. |
| Page/profile override         | Profile narrows/selects a value for its compatible slots.                   | Collection profile requires horizontal filter treatment.                                               | Valid only within BrandSystem bounds; the selected direction must be compatible.           |
| Bounded instance override     | Instance selects a registered permitted value within effective constraints. | An approved component instance selects `surfaceTreatment: soft`.                                       | Valid only when `instanceOverrideAllowed` and family/profile allow it.                     |
| Prohibited arbitrary override | Any value outside the vocabulary or authority chain.                        | CSS string, class name, React, pixel breakpoint, unknown token/variant, direct product price patch.    | Rejected before proposal classification/application.                                       |

The existing `resolveBoundedParameterInheritance` model is the implementation precedent: unknown parameters, invalid values, contradictory ranges, broadening, prohibited instance override and prohibited parameter override report typed failures. Commercial vocabulary implementation adds the same failure treatment to all new vocabulary fields. Direction never appears in the resolver precedence; it selects a compatible registered chain before BrandSystem/profile/variant/instance resolution begins.

## 15. Deterministic failure model

Failures are validation results, never best-effort renderer fallbacks that alter canonical state:

| Failure                                                                                                                | Required disposition                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Unknown foundation token, direction, profile, family, variant, parameter, narrative role, flow rule or responsive mode | Reject plan/proposal with stable typed code; leave active draft/history unchanged.                           |
| Incompatible direction selection, profile/family/variant combination or unsupported page scope                         | Reject before materialization/compiler output.                                                               |
| Narrowing violation, unsupported instance override, unknown raw value or conflicting parameter pair                    | Reject the proposal/operation; do not silently clamp or last-write-win.                                      |
| Missing/invalid asset, crop, role, provenance or required safe area                                                    | Use the profile’s registered omission/fallback only when allowed; otherwise reject affected materialization. |
| Missing canonical binding or protected-commerce drift                                                                  | Reject; never substitute merchant content or a different product/collection.                                 |
| Unsupported responsive mode or geometry/a11y failure                                                                   | Reject the selected mode/proposal or fail evidence gate; no raw CSS escape hatch.                            |
| Stale authority fingerprint/version                                                                                    | Mark stale and require replanning; do not apply.                                                             |

Errors should reuse the existing typed vocabulary/compatibility codes where applicable and add narrow stable codes only for newly introduced contract categories. Error messages may name merchant-safe presentation concepts but must not expose raw provider payloads or internal registry details in merchant UI.

A direction may cause an existing compatibility rejection when its references do not form a supported set, but it cannot declare novel defaults, fallbacks or failure behavior. Those semantics remain with the canonical contracts and validators selected by the direction.

## 16. Migration from current contracts

1. Preserve all current `BrandSystem` fields and `brandSystemToCssVariables`; add optional, versioned semantic foundation fields with deterministic defaults mapped from current palette, typography, shape, spacing and `visualSystem` values.
2. Preserve `boundedParameterDefinitions`, authority levels and inheritance resolver. Add vocabulary IDs through that list, then opt components in explicitly; legacy broad compatibility remains an explicit adapter only.
3. Preserve templates/profiles and their legacy composite-slot metadata. Add constrained profile metadata/parameters in the current executable PageBlueprint contract; do not persist an independent recipe.
4. Preserve `StorefrontDesignSystemV1` IDs and direction fingerprinting. Migrate its duplicated presentation values to compatibility-selection references/projections of the newly extended canonical contracts without changing current directions until compatible renderer work exists; do not insert direction into the inheritance resolver or retain it as a default/instance-value source.
5. Preserve `dynamicCollectionCommerce` and `dynamicProductDetail` generation replacement, bindings, component versions and protected paths. Extend their family/profile compatibility and presentation affordances, not their commerce authority.
6. Preserve approved asset placement identity, revision, provenance and render-only projection. Add compatible presentation metadata through that path, never through mutable product content.
7. Version/migrate canonical snapshots with existing component migration conventions; unknown/future values fail closed and migration never changes commerce or approved assets.

## 17. Proposed schema/type changes

These are implementation targets, not code to add in this PR.

| Contract                       | Proposed additive change                                                                                                                                                                               | Validation constraints                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BrandSystem`                  | `typeSystem`, `layoutSystem`, `surfaceSystem`, `actionSystem`, `mediaSystem` semantic subcontracts or a strictly equivalent nested extension of `visualSystem`.                                        | Closed enums/numeric ranges; defaults from current values; renderer-only CSS derivation; contrast validation.                                                      |
| Bounded parameter definition   | New parameter IDs for named type role, container role, elevation, overlay, media ratio/focal/crop, action presentation, merchandising intensity and declared responsive transformation where required. | Category structural/visual, compatible family/page types, authority/narrowing levels, incompatibilities and instance permission.                                   |
| Component design compatibility | Variant-level semantic pattern, supported direction IDs/traits, asset-treatment and responsive-mode compatibility.                                                                                     | Every value references registered vocabulary; all-target renderer identity remains required.                                                                       |
| Asset placement/presentation   | Optional approved `presentationTreatment` with ratio, focal/object position, crop/overlay/text-safe-area and responsive derivative references.                                                         | Role/owner/provenance/revision preservation, bounded positions, no direct media URL/content mutation.                                                              |
| PageBlueprint profile          | Direction-compatible profile traits; resolved foundation/parameter constraints; optional-region, responsive-order and cross-page-frame rules.                                                          | Keep existing slots/order/bindings/assets/cardinality/flow rules and no second executable representation.                                                          |
| Direction contract             | Compatibility-selection references to semantic foundation choices, complete page profiles, shared-frame choices, compatible families/variants and merchandising intent.                                | References only: no token/default/instance values or inheritance precedence; validate against live registries and for pairwise non-colour/cross-page distinctness. |
| Renderer projection            | Typed resolved vocabulary projection supplied to current renderers.                                                                                                                                    | Deterministic, fingerprinted and no model-supplied CSS/classes/React.                                                                                              |

## 18. Proposed test matrix

| Test class                 | Assertions                                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation schema/unit     | Defaults/migrations, closed values, font/colour/contrast, type/space/container/surface/action resolution and rejection of arbitrary values.                                                   |
| Parameter inheritance/unit | BrandSystem/profile/variant/instance narrowing after direction selects compatible contracts; enum/range conflicts, unknown IDs, incompatible pairs and prohibited local responsive overrides. |
| Component registry/unit    | Variant semantic compatibility, accepted assets, narrative roles/weights/transitions, responsive modes and renderer targets.                                                                  |
| PageBlueprint/integration  | Slot/profile/direction compatibility, optional omission/fallback, insertion/repetition/adjacency, shared-frame coordination and no parallel page shape.                                       |
| Commerce integration       | Collection/PDP dynamic runtime instances remain planned, proposed and stored with canonical commerce/asset protection.                                                                        |
| Asset/media integration    | Role/provenance/crop/safe-area validation; desktop/mobile fallback; product media cannot be replaced by editorial media.                                                                      |
| Direction/diversity        | Pairwise direction differences across non-colour foundations and all three page types; no colour-only direction passes.                                                                       |
| Responsive/a11y            | 375/768/1024/1440 and EN/FI: no clipping/overlap, declared transformations visible, keyboard/focus/contrast and commerce controls reachable.                                                  |
| Golden-store/human review  | Current fingerprints/profiles/lifecycle/evidence remain current; screenshots/human rubric assess hierarchy, imagery, merchandising, repetition and cross-page coherence.                      |

## 19. Locked implementation relationship

This vocabulary is consumed first by P10B-01, then by the remaining locked tasks in the generation
architecture. It is not a parallel roadmap.

| Vocabulary concern                                            | Primary implementing task | Downstream consumers             |
| ------------------------------------------------------------- | ------------------------- | -------------------------------- |
| Grammar, ownership, inheritance, compatibility, typed failure | P10B-01                   | Every P10B task                  |
| Parametric merchant-wide Design DNA                           | P10B-02                   | P10B-04, P10B-06 through P10B-18 |
| Anatomy and meaningful structural variants                    | P10B-03                   | P10B-04, P10B-06 through P10B-18 |
| Responsive approved-asset art direction                       | P10B-04                   | P10B-06 through P10B-18          |
| Page-family/profile vocabulary                                | P10B-05                   | P10B-06, P10B-09 through P10B-18 |
| Frame/content/product-card family vocabulary                  | P10B-06 through P10B-08   | P10B-09 through P10B-18          |
| Home/collection/PDP/content/utility profile vocabulary        | P10B-09 through P10B-13   | P10B-14 through P10B-18          |
| Synthesis, direction, and fingerprint vocabulary              | P10B-15, P10B-16          | P10B-17, P10B-18                 |

After P10B-01, P10B-02, P10B-03, and P10B-05 may run in parallel only with the disjoint authority
ownership and integration rules defined by the architecture lock.

## 20. Explicit non-goals

- No arbitrary CSS, class names, HTML, JavaScript, React, primitive trees, font imports, breakpoint pixels or model-generated renderer code.
- No parallel token registry, component registry, direction system, recipe engine, page graph, snapshot shape, asset inventory, commerce model or publish pipeline.
- No mutation of product, variant, option, SKU, price, compare-at price, availability, stock, inventory, canonical product media or provenance.
- No merchant-specific components, unrestricted image generation, unsupported commercial claims or automatic “premium” quality assertion.
- No replacement of the existing `dynamicCollectionCommerce`/`dynamicProductDetail` runtime path; commercial design-system work only deepens its governed visual/compositional profile range.
- No claim that this architecture/documentation lock implements P10B-01 or any runtime capability.

## Evidence reviewed

This specification is grounded in the preceding [commercial design-system audit](./P10B_01_STOREFRONT_DESIGN_SYSTEM_CAPABILITY_AUDIT.md); SDD controlled-family, PageBlueprint, bounded-parameter, inheritance, responsive and quality requirements; `BrandSystem`; component capability manifest/registry; executable PageBlueprint profiles; registered directions; narrative/bounded-parameter validation; collection/PDP runtime generation; asset-role/placement contracts; storefront renderers; P9 diversity fixtures; and golden-store/human-review contracts. Focused tests named in the task validate those factual baselines before delivery.
