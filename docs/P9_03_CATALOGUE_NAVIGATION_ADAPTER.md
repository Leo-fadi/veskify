# P9-03 Read-only catalogue/navigation projection adapter

## Scope and P9-01 alignment

This adapter maps a canonical Vesko catalogue projection input into the existing
Storefront Studio projection contracts for projects that consume
`catalogue` and `navigation` data. It is read-only and does not perform
catalogue import, enrichment, creation, option detection, availability logic,
variant assembly, stock editing, or media replacement.

The adapter only exposes:

- canonical product identity, title and description
- canonical collection and category identities, slugs and references
- canonical route references and navigation structure
- merchant/project identities and revision context
- locale metadata used by both catalog and presentation contracts

## Contracts and boundary

- **Transport input**: an injected transport returns an unknown projection payload.
  The payload is parsed and validated before use.
- **Read-only boundary**: `StorefrontCatalogueProjection` is a projection-only
  structure; `projectToCanonicalCommerceProjection` converts back to
  `CatalogueDisplayModel` and strips adapter-only fields.
- **Canonical IDs**: product IDs, collection IDs, category IDs and slugs are
  passed through unchanged for the canonical projection.
- **Canonical slugs**: collection slugs use the canonical no-slash slug schema.

## Order and normalization

- `collection.productIds` is preserved exactly as provided (Vesko merchandising
  order).
- Navigation and category route/path children keep source order.
- `routeReferences` and `navigation` paths are route-normalized for stable
  comparison, while preserving top-level order.
- Locale lists are normalized with canonical locale ordering and deduplicated.

## Routing validation

Primary route ownership is validated in both directions:

- route target ID must exist
- target kind must match the owning entity type
- route target ID must match the owning entity ID
- primary route locales must be compatible with catalog locale scope

Category route compatibility additionally checks catalogue/category locale overlap.

## Ambiguous route ownership

After route-path normalization (`/collections/watches/` and `/collections/watches`
collapse to the same path), route ownership is rejected when the same
normalized `path + locale` is claimed by more than one route.

## Standalone compatibility

The standalone adapter keeps canonical product/collection IDs and collection slugs.
Merchant and project IDs are derived with bounded deterministic IDs using stable
hashing when input IDs would exceed schema limits.

## Failure and validation model

Adapter failures are validation failures:

- duplicate IDs
- malformed locale references
- broken membership and route/category/collection references
- route ownership, path/locale, and cycle violations
- duplicate or unsupported identities

These failures prevent invalid commerce data from being accepted by the editor.

## Non-goals

- catalogue mutation
- import or persistence of commerce changes
- availability, option, stock, media, variant, price or SKU mutation
- product or navigation mutation beyond read-only projection
