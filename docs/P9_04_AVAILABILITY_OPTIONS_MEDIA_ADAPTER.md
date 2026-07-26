# P9-04 — Read-only availability, options, variants and canonical media adapter

## Ownership boundary

Vesko Retail OS owns product and variant availability, purchasability, storefront-safe stock
display, SKU references, attributes, option definitions and values, dependencies, text-entry
constraints, variant combinations, prices and canonical media. Storefront Studio consumes those
facts through a read-only projection. The port exposes no product, inventory, option, variant,
price, availability or media mutation command.

The adapter does not expose credentials, warehouse quantities, transport payloads or raw Vesko
errors. Public-source and approved design-layer assets remain separate from canonical product
media and cannot replace it.

## Projection input and output

An injected `CanonicalAvailabilityOptionMediaTransport` receives a frozen identity context
containing tenant, store, storefront project, product and optional expected projection revision.
No live endpoint is assumed.

The strict transport projection carries:

- tenant, store and storefront-project identity;
- catalogue ID and catalogue revision;
- product identity and projection revision;
- supported project locales;
- product- and variant-scoped availability records;
- ordered attributes, option groups and canonical media;
- canonical variants and their availability/media references.

The provider checks the returned identities against the requested context, validates every
cross-reference, normalizes only unordered availability and variant entity sets by canonical ID,
and returns an immutable projection. A SHA-256 fingerprint is calculated from the normalized
canonical data; equivalent input creates the same fingerprint.

## Availability semantics

Availability records preserve the canonical status (`inStock`, `lowStock`, `outOfStock` or
`unavailable`), purchasable state, storefront-safe stock-display state, optional canonical
availability message, scope and revision. A variant may reference either the product-scoped record
or a record scoped to that same variant. Storefront Studio does not calculate availability or
expose warehouse quantities.

## Attributes, options and variants

Attributes preserve source array order and explicit display order. Their canonical ID, localized
label, localized or typed value, optional unit and optional presentation role remain read-only.
The PDP bridge sorts a cloned attribute list by canonical `displayOrder`; transport order and the
source projection are not mutated.

Option groups reuse the dynamic PDP contract unchanged. Group order, value order, presentation,
required state, swatches, dependencies and text-entry constraints remain source-preserved. The
adapter validates globally unique value identity, dependency targets and values, swatch-media
references and acyclic dependency graphs. It never sorts merchant-defined option values or creates
missing values.

Each canonical variant retains its variant ID, optional SKU, selected option-value IDs, optional
authorized price state, availability reference, canonical media IDs, purchasability and revision.
Every variant selects exactly one value from each variant dimension. Unknown values, incomplete
dimension selections and duplicate combinations fail; no variant or SKU is synthesized.

Standalone variant-dimension keys are compared as sets while the first variant defines display
order. Standalone selection-option value identity is derived from the canonical option ID and
localized value fingerprint, so reordering values does not change IDs; duplicate fingerprints
fail as duplicate canonical identity. A variant-specific price can make that variant purchasable
even when the base product has only a price-unavailable state.

## Canonical and variant media

Canonical media preserves source gallery order for main, alternative, variant and editorial roles.
Each record retains its canonical media ID, owning product, localized alt text, decoration state,
variant associations and revision. Non-decorative media requires canonical alt data.

Variant-media associations are validated in both directions. A variant media reference must resolve
to media on the same product, and that media must name the same variant. Cross-product references,
unknown media, unknown variants, duplicates and inconsistent associations fail.
When a resolved variant has no explicit media list, fallback media is limited to product-wide media
and media associated with that variant; another variant's media is never included. Decorative state
continues through PDP presentation, approved asset mapping and rendering, where decorative images
use an empty accessible name instead of product-title fallback text.

## PDP and option-resolution compatibility

`projectAvailabilityOptionMediaToProductPresentation` joins this projection to the complete
P9-03/P9-01 canonical catalogue projection and produces the current
`ProductPresentationContext`. Tenant, store, storefront project, catalogue ID, catalogue revision
and product identity must all match before product truth is consumed. It preserves canonical
option/media shapes and revisions up to the shared 160-character integration limit. Typed
attributes are converted only to display text at this presentation boundary.

`createAvailabilityOptionMediaResolver` implements the existing
`CanonicalProductConfigurationResolver` boundary. Complete selections resolve only an existing
canonical variant; a sole variant with no variant dimensions resolves automatically. The selected
availability, price, SKU and variant media remain read-only. Partial selections return canonical
disabled values when no purchasable compatible variant remains. Missing or unavailable combinations
are non-purchasable. Text-entry groups use their canonical constraints and do not create variants.

This supports products without options, one- or multi-dimension watches, dependent ring options,
canonical text-entry options, unavailable combinations and variant-driven galleries without
product-type-specific React contracts.

## Typed failures

The adapter returns merchant-safe `VeskoIntegrationError` codes for unavailable or malformed
transport responses, stale revisions, missing products, duplicate canonical identity, tenant or
project mismatch, broken option/dependency/availability/media references, dependency cycles,
duplicate variant combinations and unsupported locales. Raw transport errors are replaced with a
safe availability-unavailable failure.

Unsupported-locale classification is restricted to declared locale lists and known localized
fields. Arbitrary metadata keys that resemble locale codes are preserved as metadata and are not
misclassified.

## Standalone behavior

The standalone adapter accepts an existing `CatalogueDisplayModel`, clones it before mapping and
never mutates the seed. Tenant, store and project IDs and all generated adapter IDs are bounded,
deterministic hashes. Existing variant attribute dimensions and order options are translated in
source order; canonical product and variant IDs are preserved.

Fixture stock state is mapped conservatively. Missing stock state becomes canonical `unavailable`
and non-purchasable; embedded display strings are not parsed into inventory facts. Existing product
media remains canonical and no upload, replacement, adjustment or inventory-management behavior is
provided. Both Aurum and Karvonen fixtures use the same credential-free port.

## Non-goals

- live Vesko HTTP endpoints, authentication or credential handling;
- inventory quantities, adjustments or stock calculation;
- product creation, enrichment, SKU generation or variant construction;
- option inference from SKU text or product-type-specific UI contracts;
- industry templates, media upload, media replacement or public-source media promotion;
- cart, checkout, order, price or availability mutation.

## Traceability

FR-101, FR-102, FR-107, FR-110, FR-111 and FR-118; NFR-101, NFR-105, NFR-107,
NFR-108 and NFR-109; AC-102, AC-106–AC-110, AC-118 and AC-124.
