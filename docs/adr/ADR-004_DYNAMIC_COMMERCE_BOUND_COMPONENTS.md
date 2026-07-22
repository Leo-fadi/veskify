# ADR-004: Dynamic Commerce-Bound Component Architecture

- **Status:** Accepted
- **Version:** 1.0
- **Decision date:** 2026-07-22
- **Decision owners:** Veskify product and engineering
- **Related document:** `docs/VESKIFY_SDD.md`, sections 5, 9-11, 15-16
- **Related decisions:** ADR-001 — Puck editor foundation; ADR-002 — Controlled design operations; ADR-003 — URL-first discovery and reconciliation

## 1. Context

Vesko supports different industries and product types with different attributes, variants and order options. A watch may require only a colour selection. A ring may require metal, karat, size, diamond quality, engraving and additional dependent options before a valid variant or order configuration can be resolved.

Hardcoding one product-detail page per merchant or one fixed selector schema per industry would create duplicated UI, block new product types and make handoff to Vesko fragile. Building a second catalogue model inside Veskify would also conflict with Vesko's canonical product architecture.

## 2. Decision

Veskify will use a reusable, versioned, commerce-bound component architecture.

Components are engineering-owned families with approved variants, slots, responsive rules and typed data bindings. They consume read-only canonical presentation contexts and never own operational product truth.

```text
Canonical Vesko commerce data
  -> read-only presentation adapter
  -> ProductPresentationContext
  -> page blueprint and registered component families
  -> dynamic option renderer and variant resolver adapter
  -> editor / preview / published rendering
```

## 3. Component layers

The platform contains five reusable layers:

1. **Primitives** — typography, buttons, media, icons, containers and spacing.
2. **Patterns** — cards, galleries, accordions, drawers, selectors and trust rows.
3. **Commerce-bound components** — product cards, product gallery, product information, option renderer, collection grid and filter presentation.
4. **Reusable compositions** — hero, editorial split, campaign, brand story and product-detail compositions.
5. **Page blueprints** — approved page-level rules for homepage, collection, product, content, cart and checkout presentation.

The AI selects and configures these layers. It does not generate new component code.

## 4. ComponentDefinitionV2

Each registered component definition must include:

- stable type and semantic version;
- supported variants;
- slots and content schema;
- property schema;
- allowed page types and industry tags;
- required and optional data bindings;
- editable fields and protected fields;
- responsive and accessibility contract;
- asset-role compatibility;
- migration function or compatibility policy;
- renderer binding;
- deterministic fixtures and tests.

Unknown types, variants, fields and bindings are rejected before rendering.

## 5. Data-binding contract

Components bind to canonical references and typed contexts rather than copied product facts.

A binding identifies:

- source type and canonical ID;
- expected projection revision where required;
- locale and fallback policy;
- selected fields or presentation context;
- empty/unavailable behaviour;
- loading/error state;
- asset role and provenance when media is used.

A design operation may change the binding target only when permitted. It may not patch the protected source record.

## 6. ProductPresentationContext

The product page consumes a normalized read-only context containing:

- product ID, type and localized content;
- product and variant media references;
- attributes and specifications;
- option groups, values, dependencies and required state;
- current selection;
- resolver interface and validation result;
- selected canonical variant identity;
- price, compare-at-price, currency and unavailable-price state;
- availability and stock display state;
- related product references;
- source revision and protected paths.

This context is an adapter projection, not a new operational catalogue model.

## 7. Dynamic option renderer

The option renderer is generic and chooses an approved presentation by option metadata, for example:

- colour -> swatches or buttons;
- size -> buttons, select or guided size control;
- material/karat -> segmented buttons or select;
- quality -> buttons or select with supporting information;
- engraving -> text and font controls with limits;
- boolean/service option -> checkbox or toggle presentation;
- unknown option type -> accessible generic select fallback.

Dependencies, required selections and unavailable combinations come from the canonical context and resolver. The renderer does not infer operational rules.

## 8. Variant resolution boundary

Veskify passes the current selection to a resolver adapter. The adapter returns canonical validity, selected variant, price, availability and media.

Veskify may design:

- selector layout and style;
- grouping and hierarchy;
- gallery and product-information layout;
- guidance and error presentation;
- responsive composition.

Veskify may not design away or alter:

- required option groups;
- option values and dependencies;
- variant identity;
- price and availability;
- SKU or inventory logic;
- add-to-cart operational requirements.

## 9. Rendering parity and migrations

- The same registered implementation renders in editor, preview and published routes.
- Components are versioned.
- Schema changes require migrations or explicit compatibility handling.
- Existing snapshots must not silently reinterpret incompatible fields.
- Vesko and standalone adapters must pass the same conformance tests.

## 10. Consequences

### Positive

- supports simple and complex product types without merchant-specific code;
- keeps Vesko as commerce source of truth;
- lets the AI create variety through approved components and variants;
- enables predictable responsive and accessible behaviour;
- provides a clean handoff contract;
- supports future industries through metadata and adapters rather than page rewrites.

### Costs

- component and binding contracts require deliberate versioning;
- option metadata and resolver adapters must be mapped from Vesko;
- generic fallbacks need strong UX;
- registry integration and migrations require clear ownership;
- visual variety is bounded by engineered component families.

## 11. Compliance

The decision is satisfied when:

- no duplicate operational catalogue model is introduced;
- a watch and complex ring render through the same generic architecture;
- every available option group is preserved;
- selected variant data comes through the resolver adapter;
- changing design never changes protected truth;
- unknown product types use a safe fallback;
- editor, preview and published output use the same component implementation;
- AC-105 through AC-112 and AC-124 pass.
