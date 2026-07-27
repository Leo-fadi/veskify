# P9-03 Storefront Design System v1

## Outcome and requirements

Storefront Design System v1 gives the authoritative whole-storefront planner a bounded vocabulary
for materially different premium-editorial, modern-technical and warm-approachable storefronts. It
extends the P9-02 brief, Component Registry v2, recipe and approved-asset handoff; it does not add a
browser-owned capability path or a parallel commerce model.

The implementation traces to FR-102, FR-107 through FR-114 and FR-116; NFR-101 through NFR-103,
NFR-105, NFR-108 and NFR-109; and AC-105 through AC-112, AC-114, AC-118, AC-122 and AC-123.

## Foundations

The existing `BrandSystem` remains canonical. Its semantic CSS projection now includes emphasis,
success, warning and unavailable roles plus bounded border, depth, image-aspect and crop roles.
Commerce status meaning remains protected: design operations cannot rewrite price, availability,
stock or variant truth. Existing brand records remain valid and receive deterministic safe
presentation fallbacks.

The design-system registry defines five approved typography pairings using existing font tokens:
refined serif, modern sans, editorial contrast, technical/functional and warm approachable. Heading
scale and reading width remain bounded. No font files or external font requests are introduced.

Six registered image treatments cover full-bleed, contained, editorial crop, product-neutral,
split-layout and soft-frame presentation. Each treatment lists compatible asset roles. It changes
only crop/layout presentation; canonical product media and P9-02 asset approval/provenance remain
unchanged.

## Component and product-card families

The system reuses the existing registered renderer families:

- homepage hero, collection discovery, featured products, collection navigation, promotion and
  trust;
- editorial story, campaign, supporting imagery, benefits, newsletter and shared chrome;
- `dynamicCollectionCommerce` for collection introduction, filters, canonical-order grids and
  cards;
- `dynamicProductDetail` for simple, multi-option, jewellery/ring and variant-led products.

Product-card capability metadata exposes minimal product-first, editorial image-led, compact
commerce and premium-jewellery choices. Each maps to an existing registered card variant and
requires canonical product identity, title, price state, availability, media and route. No pricing,
availability, ordering or media-selection logic is duplicated in the design system.

## Recipes and design directions

Homepage recipes preserve declared semantic order and never alphabetically normalize sections:

1. premium editorial — full-bleed hero, image-led discovery, story, editorial products and trust;
2. modern commerce-led — asymmetric hero, compact product discovery, category grid and campaign;
3. warm brand-story-led — editorial hero, story, category cards, balanced products and service.

Collection recipes provide editorial and commerce-first compositions. Their selected
`dynamicCollectionCommerce` variants define grid density, product-card family and filter layout
while preserving canonical collection membership and merchandising order.

Product recipes cover simple, jewellery configuration, variant-led/watch and gallery-led
presentations. They select only `dynamicProductDetail` layout, gallery, option-density, attribute and
media presentation. The shared canonical option engine continues to own required groups,
dependencies, disabled combinations, selected variant, SKU, price, availability and variant media.

Every recipe keeps the protected header as the first structural section and the protected footer
last; an optional announcement bar is the only section allowed before the header. Campaign,
brand-story, trust and newsletter positions are explicit in all homepage recipes, so existing
optional sections retain stable semantic anchors instead of being bunched near the footer.
Accepted asset roles are listed, and responsive contracts cover mobile, tablet, desktop and wide
breakpoints with horizontal overflow prohibited.

## Registry, planner and proposal integration

`WholeStorefrontRecipeContext` now fingerprints the immutable template registry together with
Storefront Design System v1. The server-owned planning request carries this context; the browser
cannot submit, broaden or replace it.

The canonical planner deterministically selects a registered direction from the approved brief's
visual style, typography, imagery and tone signals. That plan direction is the single authority for
tokens, variants, spacing and recipes. A compatible merchant refinement may proceed, while a
conflicting direction request fails with a merchant-safe validation response instead of producing a
hybrid. The plan records stable recipe, typography, image-treatment, product-card, collection and
PDP capability IDs. Generated collection and PDP instances use the selected registered variants and
props while retaining canonical bindings.

The plan-to-`ProposalEnvelope` path projects each validated page composition through one registered
page operation. Collection and product legacy groups are replaced by
`dynamicCollectionCommerce` and `dynamicProductDetail` in the actual reviewable editor snapshot,
with only canonical IDs and projection revisions stored; Vesko remains the runtime source for
price, SKU, availability, variants, options and media. Header/footer identity is preserved, and
accept, undo and redo apply the complete multi-page composition atomically. Therefore an editorial
brief and a technical brief produce different registered structures and families rather than only
different colours.

Required recipe sections reuse an existing compatible section first. When absent, the planner may
materialize a stable registered section only from approved merchant content and a role-compatible
approved asset. Missing content or media produces an actionable planning requirement; optional
sections are never forced. Exact-palette requests remain a separate colour-only path with exactly
one global colour grant and no page, section, typography, asset, order or structural authority.

## Merchant controls, EN/FI and responsive behaviour

Existing V2 editable presentation fields remain the Design-panel contract. The new system introduces
no raw Puck fields, JSON, arbitrary CSS or unvalidated property path. Dynamic collection and PDP
controls remain bounded to registered enums and booleans; undo/redo continues through canonical
design operations.

All V2 component titles, descriptions, variant names, recipe names, typography/image labels and
editable field labels carry natural English and Finnish values; implementation tokens such as
`fullBleed` are not exposed as merchant copy. Canonical merchant product names, descriptions and
editorial content are never automatically translated.

Responsive metadata requires reflow at 375, 768, 1024 and 1440 px, legible cards, bounded columns,
usable PDP media/purchase regions and no horizontal overflow. P9-04 remains responsible for the full
visual, interaction and cross-viewport acceptance suite.

## Fixture strategy and commerce protection

Aurum, Karvonen and focused minimal planning inputs use independent project, draft and commerce
fingerprints. Production seed data is not changed into a prebuilt acceptance answer. Tests alter
brief direction at the planning boundary to prove that the registered system—not fixture
composition—drives the selected result.

The design-system contract contains no product, SKU, price, stock, variant, option, collection
membership or operational media value. Approved design assets remain role-bound P9-02 references,
while product and variant media stay canonical Vesko projection data.

## Deferred

P9-04 retains full visual regression, keyboard/accessibility and responsive acceptance across all
target widths. P9-05 retains the internal merchant-generation demonstration and manual quality
checkpoint. This task does not redesign the editor shell, add staging transport, call live providers
or publish automatically.
