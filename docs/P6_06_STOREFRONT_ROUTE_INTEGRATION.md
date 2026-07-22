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
known compatible family, required canonical references resolve, and the generated V2 instance
passes registry conformance. Product references must identify one product. Collection product-list
bindings must preserve canonical membership and ordering.

Pages with unsupported legacy sections, incomplete legacy component families or an adapter that
does not support V2 continue through `renderStorefrontPage`. No stored snapshot is rewritten and no
destructive migration is performed. Invalid V2 instances, missing bindings and rejected explicit
assets enter the route's existing customer-safe validation state before storefront rendering.

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
attributes, price and availability. The route renders validated range/filter/sort controls, but
their callbacks remain typed presentation intents. P6-06 does not add a catalogue query, filtering
or sorting engine.

## Traceability

This route-integration slice implements or verifies FR-101, FR-102, FR-107, FR-109, FR-110,
FR-111, FR-112, FR-114, FR-117 and FR-118; NFR-101, NFR-102, NFR-103, NFR-104, NFR-105, NFR-108 and
NFR-109; and AC-106 through AC-112, AC-115, AC-118, AC-122 and AC-123 as applicable to the
standalone route adapter boundary. AC-124 remains a future Vesko-adapter conformance gate.
