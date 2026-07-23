# P6-06 storefront commerce route integration

This implementation note describes how the existing storefront route clients connect canonical
project/catalogue reads to the registered `dynamicProductDetail` and
`dynamicCollectionCommerce` component families. `docs/VESKIFY_SDD.md` remains the governing
contract.

## Route boundaries

The integration reuses the existing route architecture:

- draft product preview: `/projects/[projectId]/products/[productSlug]`;
- published product: `/projects/[projectId]/published/products/[productSlug]`;
- historical product preview: `/projects/[projectId]/history/[snapshotId]/products/[productSlug]`;
- draft collection preview: `/projects/[projectId]/collections/[collectionSlug]`;
- published collection: `/projects/[projectId]/published/collections/[collectionSlug]`;
- historical collection preview:
  `/projects/[projectId]/history/[snapshotId]/collections/[collectionSlug]`.

All six boundaries continue to load the selected canonical snapshot and catalogue through the
existing read-only `ProjectRepository`. The route adapter maps eligible V1 catalogue projections
into `ProductPresentationContext`, `CollectionPresentationContext`, approved asset metadata and
strict V2 bindings at render time. It does not persist a second catalogue or copy commerce facts
into editable component content.

## V2 selection and V1 fallback

A product or collection page uses its V2 component only when its visible legacy composition is a
known compatible, one-to-one family, required canonical references resolve, and the generated V2
instance passes registry and route-used-asset conformance. Every supported visible section is a
singleton. Product pages require exactly one gallery, product-information and product-options
section in canonical order; collection pages require exactly one collection header and product
grid in canonical order. Optional header, footer, benefits, supporting image/text, related
products and filter sections may occur only once in their corresponding canonical positions.
Duplicates, reordered sections and extra visible content retain the V1 renderer rather than being
silently omitted. Product references must identify one product. Collection product-list bindings
must preserve canonical membership and ordering.

Pages with unsupported legacy sections, incomplete legacy component families or an adapter that
does not support V2 continue through `renderStorefrontPage`. No stored snapshot is rewritten and no
destructive migration is performed. Variant-backed PDPs use V2 only when every canonical variant
declares the same ordered, scalar dimension set and each combination and generated presentation ID
is unambiguous. The adapter creates one localized option group per dimension, keeps canonical
dimension/value order, and resolves the selected combination back to its canonical variant ID.
Unsafe or incomplete variant dimensions retain V1; variant IDs and SKUs are never visible option
labels.

Invalid V2 instances and missing bindings enter the route's existing customer-safe validation
state before storefront rendering. The same preflight used by the V2 renderers validates every
asset the route will consume: PDP gallery and option media, related-product card media, collection
hero and product-card media, supporting editorial media and explicit assignments. Each asset must
exist in the projection inventory, be approved and retain the role and provenance required by its
rendering slot. Missing optional media remains a documented no-media placeholder; pending,
rejected, unknown or role-mismatched route-used media cannot commit a successful V2 load.

## Product resolver boundary

`IntegratedDynamicProductDetail` owns the route's client-side connection to the asynchronous
product-option controller. The adapter supplies canonical product/revision identity and a resolver
implementation; option and text callbacks emit canonical presentation IDs into that controller.
Request sequencing prevents older async results from replacing newer selections, and resolver
failure retains the latest safe presentation result. Displayed price, compare-at price,
availability and selected media come from the validated resolution result.

The primary action emits `activatePrimaryProductAction` with canonical product, revision,
configuration and selection references. It is an intent boundary only; P6-06 does not implement
cart, checkout, inventory or order mutation.

## Collection intent boundary

The collection adapter preserves canonical collection identity, membership/order, localized
content and product-card facts. Current V1 filter tokens are projected only from canonical product
attributes, price and availability. Availability keeps canonical stock-state IDs internally while
visible and accessible labels use the centralized EN/FI availability terminology. Effective
filters are computed after canonical mapping; when there is no visible filter section or all
configured filters have no canonical values, the filter trigger and region are omitted while the
grid and sorting remain available. The route renders validated range/filter/sort controls, but
their callbacks remain typed presentation intents. P6-06 does not add a catalogue query, filtering
or sorting engine.

## Traceability

This route-integration slice implements or verifies FR-101, FR-102, FR-107, FR-109, FR-110,
FR-111, FR-112, FR-114, FR-117 and FR-118; NFR-101, NFR-102, NFR-103, NFR-104, NFR-105, NFR-108 and
NFR-109; and AC-106 through AC-112, AC-115, AC-118, AC-122 and AC-123 as applicable to the
standalone route adapter boundary. AC-124 remains a future Vesko-adapter conformance gate.
