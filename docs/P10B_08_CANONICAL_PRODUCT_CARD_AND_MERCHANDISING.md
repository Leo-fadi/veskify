# P10B-08 Canonical Product-Card and Merchandising Family

**Status:** Baseline
**Date:** 8 August 2026
**Authority:** `canonicalProductCardAuthority` v1.0.0
**Dependencies:** P10B-02, P10B-03, P10B-04

## Outcome

P10B-08 establishes one reusable product-card authority and one React renderer. Homepage
merchandising, dynamic collection/results, PDP recommendations, and compatibility rendering for
stored legacy `productGrid` and `relatedProducts` sections now delegate to that renderer. Product
cards remain a presentation of the existing `ProductPresentationContext`; they do not own products,
membership, price, availability, media, or cart operations.

The authority defines five structurally meaningful anatomies: comparison/information-led
`standard`, `editorial`, `compact`, image-led `imageFirst`, and dense `horizontal`. Each has a
different registered semantic hierarchy and responsive transformation. The implementation is not
five CSS aliases around one DOM tree: the renderer materializes a distinct hierarchy for each
anatomy.

## Consolidation map

| Previous path                       | Previous authority                                                                     | Baseline result                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Homepage `homepageFeaturedProducts` | Selected media and delegated to the collection card, but assembled its own card inputs | Delegates exact product/media authority to `CanonicalProductCard` with `homepageMerchandising` context                                           |
| Dynamic collection                  | Owned card DOM, price, badge, attributes, action, media selection, and card CSS        | Retains collection membership/filter/sort ownership; delegates every card to the canonical renderer                                              |
| Dynamic PDP related products        | Owned separate card DOM, media, price, availability, and CSS                           | Retains related-product binding; delegates cards with a registered `relatedCardVariant`                                                          |
| Legacy `productGrid`                | Owned legacy card DOM and global `.product-card` CSS                                   | Compatibility wrapper projects the existing catalogue object into `ProductPresentationContext` and delegates; V2 variants are `legacySuperseded` |
| Legacy `relatedProducts`            | Owned separate recommendation-card DOM and module CSS                                  | Compatibility wrapper delegates through the dense migration; V2 variant is `legacySuperseded`                                                    |
| Design-system card records          | Repeated registry variant and protected-field lists                                    | Store only a family label and canonical `anatomyId`; protected fields live once in the canonical authority                                       |
| Collection/home prop schemas        | Repeated closed card-variant enums                                                     | Reuse `canonicalProductCardAnatomyIdSchema`                                                                                                      |
| Product media art direction         | Collection/PDP construction was local and homepage cards omitted it                    | Reuse `createCanonicalProductMediaResponsiveAuthority` from P10B-04 for homepage, collection, and PDP projections                                |
| Publish compiler                    | Fingerprinted product media but not product-card family authority                      | Fingerprints and revalidates exact product-card authority and selected anatomies                                                                 |

No duplicate card DOM implementation remains selectable. Legacy component definitions are retained
only so old valid snapshots continue to render; their anatomy classifications explicitly identify
the canonical family as the replacement.

## Canonical authority

`src/domain/product-card/canonical-product-card.ts` owns:

- contract identity, semantic version, and deterministic fingerprint;
- the five anatomy identities and supported contexts;
- P10B-03 semantic structure, meaningful classification, material differences, and responsive
  transformations;
- the single list of protected commerce fields;
- strict renderer-request validation;
- exact fact and media-lineage fingerprinting;
- deterministic aliases for old family/anatomy names.

The authority is referenced by design-system selections and the whole-storefront plan. The selected
anatomy reaches both `homepageFeaturedProducts.props.cardVariant` and
`dynamicCollectionCommerce.props.cardVariant`. PDP plans store `relatedCardVariant`. The proposal
compiler preserves those props in `StorefrontSnapshot`; the publish compiler revalidates them and
places the canonical authority fingerprint in its validation report and compile receipt.

## Five anatomies

| ID           | Commercial purpose            | Material structure                                                           | Mobile transformation                                      |
| ------------ | ----------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `standard`   | Comparison / information led  | Balanced media, content, price, metadata, then separated action              | Comparison grid condenses to a stacked facts/action layout |
| `editorial`  | Editorial merchandising       | Media stage with overlaid merchandising/action and separate title/price copy | Overlay becomes bounded stacked controls                   |
| `compact`    | Compact commerce              | Title and price lead; small supporting media; optional metadata omitted      | Simplifies to essential content and media                  |
| `imageFirst` | Image-led merchandising       | Dominant image stage and action followed by product facts                    | Reorders overlay action into the document flow             |
| `horizontal` | Dense results/recommendations | Horizontal media/facts/action relationship with content region omitted       | Reflows into a single-column dense stack                   |

`editorial` and `imageFirst` are deliberately incompatible with `searchResults`; search-compatible
selection fails closed to `standard`, `compact`, or `horizontal`. The current search page/profile is
still P10B-10/P10B-13 work; P10B-08 supplies the reusable card context without adding a search route.

## Protected facts and merchandising states

Every request consumes a strict `ProductPresentationContext`. The renderer displays canonical
product ID, title, price or explicit unavailable-price reason, compare-at price, availability,
selected canonical media, and concise canonical attributes. The facts fingerprint is independent of
context and anatomy, proving the same inputs survive homepage, collection, search/results contract,
and related-product presentation.

The only derived badge is `Sale` when canonical compare-at price is greater than canonical current
price, or `Price unavailable` when the canonical context supplies an unavailable-price reason.
Unknown request fields are rejected, so callers cannot inject a badge, alternate price, availability,
discount percentage, bestseller/new/scarcity claim, reviews, or delivery promise.

Product cards expose navigation/detail intent only. No quick-add, cart, reserve, or local commerce
operation was added.

## Media lineage

Card selection skips editorial media and selects the first compatible canonical main, variant, or
alternative media item. Metadata must have `canonicalProductMedia` provenance, the exact product as
source owner, the exact media asset ID, and the corresponding product media role. Active contexts
require the P10B-04 art-direction record; its source asset, source owner, provenance, and role must
match exactly.

Responsive crop, ratio, focal point, safe containment, and approved same-source derivatives remain
owned by P10B-04. The product-card family consumes that authority through
`ResponsiveStorefrontImage`; it does not copy or replace image authority.

## Design DNA and responsive behavior

The renderer consumes the existing semantic CSS variables for heading/body typography, background
and surface colours, border, radius, action treatment, spacing, and muted commerce text. Product
facts and their fingerprint do not include visual tokens, so changing Design DNA changes
presentation only.

Registered anatomy transformations and CSS evidence cover 375, 768, 1024, and 1440 px. Cards avoid
fixed product-type layouts and horizontal overflow. P10B-08 browser evidence exercises the five
anatomies across deterministic generated homepage/collection contexts and compatible legacy/current
recommendation contexts, plus collection media lineage and geometry at all four widths.

## Migration and compatibility

Current IDs remain stable. Historical family labels migrate deterministically:

- `minimalProduct` to `standard`;
- `editorialImage` to `editorial`;
- `compactCommerce` to `compact`;
- `premiumJewellery` to `imageFirst`;
- `denseComparison` and legacy related `grid` to `horizontal`.

Stored legacy `productGrid` and `relatedProducts` sections require no merchant rebuild. Their
wrappers project the existing canonical catalogue object into the existing presentation contract and
render the canonical family. They are retained for compatibility but cannot be returned by a
commercial-ready capability query.

## Evidence

The focused P10B-08 suite proves the 20 locked requirements: singleton authority, five meaningful
and structurally distinct anatomies, finishing-only exclusion, cross-context fact identity, product
ID/price/availability/media preservation, wrong-media and invented-field rejection, Design DNA
separation, context compatibility, responsive transformation, save/reload, publish fingerprinting,
legacy non-selection, and old-snapshot migration.

The deterministic generation integration proves:

```text
registered schemas and family authority
  -> compatible homepage PageBlueprint and collection/PDP components
  -> deterministic whole-storefront plan
  -> compiled proposal
  -> accepted StorefrontSnapshot
  -> repository save/reload
  -> deterministic publish compile receipt and published projection
```

Browser evidence proves all five anatomy markers, exact product-media owner lineage, zero external
provider traffic, and no horizontal clipping at 375, 768, 1024, and 1440 px.

## Explicit non-goals

P10B-08 does not implement P10B-06 shared-frame families, P10B-07 hero/editorial families,
P10B-10 collection/search profiles, P10B-11 PDP profiles, P10B-13 utility pages, P10B-15 synthesis,
commerce writes, local cart ownership, generated product media, a second product model, or a second
component/image/publishing authority. It does not claim P10B-18 retained human commercial closure.
