# Vesko OpenAPI Contract Audit

- **Audit date:** 2026-08-06
- **Audited input:** local `vesko-openapi.json` supplied outside the repository
- **Input SHA-256:** `df90840a96fd5482529bef5b5f260d46accd80182025479d49b96a265ac94184`
- **OpenAPI declaration:** 3.0.0
- **API title/version:** Vesko API / 1.0
- **Repository baseline:** `78d89bf4e4a33c0f49df5a42241934393fd244b5`

## Executive verdict

The supplied document is useful discovery evidence, but it is **not sufficient authority to wire
Veskify to Vesko staging or production**.

It confirms candidate reads for store context, products, variants, categories, product groups,
brands, colours, sizes and limited storefront product access. It also confirms media-upload and
raw Puck-configuration surfaces. None of those operations currently satisfies a complete Veskify
port without an endpoint-specific adapter and additional Vesko-owned contract decisions.

The principal blockers are:

1. no server/base URL or environment declaration;
2. contradictory and structurally incomplete authentication declarations;
3. no Vesko representation of Veskify tenant, merchant, organization, storefront-project,
   permission and project-revision authority;
4. missing typed success schemas for most relevant catalogue operations;
5. no canonical navigation, route, collection-membership-order or localization contract;
6. no revision, ETag, conditional-read/write, correlation or general idempotency contract;
7. insufficient product option, availability and media semantics for the canonical commerce
   projection; and
8. no `StorefrontSnapshot` draft, immutable history, compiled publication or authoritative publish
   transaction API.

The `/puck` operations are specifically **not** a substitute for Veskify persistence or publishing.
Their documented payload is raw Puck editor state, while Veskify requires Puck to remain a
transient adapter over the canonical `StorefrontSnapshot`.

No Vesko API was called during this audit. The raw OpenAPI input remains outside the repository and
is identified only by its digest above.

## Audit method and authority boundary

The audit compared the local document with the current repository contracts and their binding
architecture, including:

- [`src/application/vesko-integration/contract.ts`](../src/application/vesko-integration/contract.ts);
- [`src/application/vesko-integration/assembly.ts`](../src/application/vesko-integration/assembly.ts);
- [`src/application/merchant-project-context`](../src/application/merchant-project-context);
- [`src/integrations/vesko-catalogue`](../src/integrations/vesko-catalogue);
- [`src/integrations/vesko-availability-options-media`](../src/integrations/vesko-availability-options-media);
- [`src/integrations/vesko-staging`](../src/integrations/vesko-staging);
- [`src/integrations/vesko-staging-catalogue-navigation`](../src/integrations/vesko-staging-catalogue-navigation);
- [`src/application/storefront-draft-persistence`](../src/application/storefront-draft-persistence);
- [`src/application/publishing`](../src/application/publishing);
- [`src/integrations/vesko-publishing`](../src/integrations/vesko-publishing); and
- ADR-001 through ADR-004, especially the canonical-snapshot and protected-commerce boundaries.

The OpenAPI document is treated as contract evidence, not proof of deployed behaviour. Examples
are evidence of intended shape only. An operation with a description but no response schema is not
classified as a typed integration contract. Similar names are not assumed to mean equivalent
domain authority.

## Document inventory and quality

| Property                       | Observed value | Audit implication                                                                          |
| ------------------------------ | -------------- | ------------------------------------------------------------------------------------------ |
| Paths                          | 250            | Broad Vesko backend surface; most operations are outside Storefront Studio scope.          |
| Operations                     | 321            | 136 GET, 90 POST, 47 PATCH, 45 DELETE and 3 PUT.                                           |
| Component schemas              | 175            | Concentrated mainly on request DTOs and selected response DTOs.                            |
| Operations without operationId | 0              | Operation identity is consistently present.                                                |
| Response objects               | 576            | Only 100 response objects declare content.                                                 |
| Response schemas               | 95             | 38 are component references; 35 are example-only schemas.                                  |
| Response headers               | 0              | No documented ETag, revision, correlation, location, retry or cache header.                |
| Servers                        | 0              | The document does not identify staging, production or a relative base path.                |
| Top-level tags                 | 0              | Operations have local tags, but no shared tag descriptions or ownership taxonomy.          |
| Documented revisions/ETags     | 0              | No occurrence of `revision`, `ETag` or `If-Match`; stale-state protection cannot be bound. |
| Explicit operation security    | 83 operations  | The remaining 238 operations inherit the problematic top-level declaration.                |

### Security is not executable as documented

The document declares two component schemes:

- `access-token`: HTTP bearer JWT; and
- `store-id`: API-key header `x-store-id`.

Its top-level security array is:

```yaml
- store-id: []
- access-token: []
```

In OpenAPI this means **store ID OR access token**, not both. If tenant-safe requests require both,
the schemes must be in the same security-requirement object. The document does not explain which
operations may trust `x-store-id` without authenticated identity.

There are 83 operations with explicit security. Sixty-seven reference a scheme named `bearer`, but
no `bearer` security scheme exists in `components.securitySchemes`. Twenty-four reference
`access-token`; eight operations occur in both counts because their alternatives mention both.
This makes the explicit authorization model structurally unresolved.

Operations that appear public or bootstrap-oriented do not override inherited security with an
empty array. Examples include `/auth/login`, `/health`, `/categories/{id}` (whose summary calls it
public), `/storefront/products`, and `/storefront/products/{id}`. The audit therefore cannot infer
whether they are public, bearer-authorized, store-scoped, or protected by undocumented middleware.

The login and refresh success responses also have no typed token/session schema. Token location,
expiry, refresh rotation, revocation, CSRF/cookie behaviour and service-to-service authorization
remain unspecified. `UserSessionResponseDto` includes a `refresh_token` field; Vesko must confirm
that no general session-read response exposes reusable credentials to Storefront Studio.

**Decision:** do not implement authentication from this OpenAPI document. Vesko must publish a
correct security declaration and an integration-specific identity flow. Veskify should retain its
injected, server-only authentication provider and must never accept browser-selected store scope as
authorization.

### Additional schema inconsistencies

The following concrete inconsistencies must be corrected or resolved before generated types are
treated as authority:

| Location                                      | Inconsistency                                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `CreateProductDto.productGroups`              | Description and example say an array of positive integer IDs, but `items` is declared as `type: array`.                             |
| `UserSessionResponseDto.id`                   | Declared as a string while its example is numeric.                                                                                  |
| `StoreDto.id` versus `GET /stores/{id}`       | Store DTO identity is numeric while the path parameter is declared as a string.                                                     |
| Store-list versus product-list pagination     | Store page/limit are required strings; product page/limit are optional numbers; no shared pagination request contract is defined.   |
| `PaginationMetaDto` versus product example    | The component uses `totalOrders`; the product example uses `totalProducts` and does not reference the component.                    |
| `custom_input_schema.info_popup`              | Creation documentation describes plain title/description; the product example returns HTML `content` plus `content_type`.           |
| `GET /storefront/products` and product detail | Both 200 responses have empty descriptions and no response schema, despite appearing to be the most storefront-specific operations. |

These defects do not prove the backend is defective; they prove the supplied document cannot yet
be used to generate a strict Veskify adapter without hand-authored assumptions.

## Compatibility with canonical Veskify ports

### Merchant and storefront-project context

Candidate operations:

- `GET /stores/verify-context` → typed `StoreContextResponseDto`;
- `GET /users/profile` → typed `UserResponseDto`;
- `GET /stores/{id}` and `GET /stores` → success bodies are not typed.

`StoreContextResponseDto` confirms a numeric store ID, subdomain/custom-domain state, business
name/contact/description, logo/banner, address, phone, social profile, business hours and selected
account-readiness facts. `UserResponseDto` confirms a numeric user ID, one coarse role string and an
optional store object.

The Veskify `MerchantProjectContextPort` additionally requires:

- tenant, merchant and organization identity;
- a Veskify storefront-project ID;
- exact Studio roles and action permissions;
- primary and enabled locales;
- market; and
- an opaque current project revision.

None of those authorities can be derived safely from the supplied store and user DTOs. A store ID
must not be copied into all missing identity fields, a general user role must not be translated into
Studio permissions without policy, and subdomain discovery must not establish authorization.

**Classification:** partial discovery input only; blocked as a `MerchantProjectContextPort`
implementation.

### Catalogue, collections, categories and navigation

Candidate operations:

- `GET /products` with page/limit, query, brand/category, price, status and sales-channel filters;
- `GET /products/search` with skip/take pagination;
- `GET /products/{id}`;
- `GET /storefront/products` and `GET /storefront/products/{id}`;
- `GET /categories`, `GET /categories/{id}` and store-specific category lookup;
- `GET /product-groups` and `GET /product-groups/{id}`;
- `GET /brands`, `GET /colors` and `GET /sizes`.

`GET /products` has the richest relevant success evidence, but its body is an inline example rather
than a typed response schema. The example includes product ID, name, description, brand, category,
store ID, product groups, status, tax, sales channel, custom inputs, media, grouped variants and a
pagination object. The document does not give typed success bodies for product detail, categories,
product groups, variant lists or either `/storefront/products` operation.

The following required mappings are absent or ambiguous:

- no product slug or canonical product-type identity;
- no collection slug;
- no statement that product groups are curated storefront collections;
- no typed product-group membership response or membership ordering guarantee;
- no navigation nodes, route references, homepage destination or localized route ownership;
- no localized EN/FI text contract;
- no catalogue ID or opaque catalogue revision;
- no stable default merchandising order;
- no currency on the product-list price evidence;
- no documented rule selecting a product-level price from variant prices; and
- no complete page/limit or skip/take response contract across these endpoints.

Categories may supply hierarchy because creation accepts `parent_id` and the list summary says it
returns a nested tree, but the response is untyped. Product groups may be a collection candidate
because products expose `ProductGroups`, but equivalence to Veskify collections is not established.
The repository must not guess either semantic.

Numeric Vesko IDs can be represented as Veskify string IDs only through a documented, stable,
entity-namespaced conversion. A plain decimal conversion could collide across products,
categories, product groups and other canonical entity kinds.

**Classification:** transformable candidate for a future endpoint adapter after Vesko supplies
typed schemas and semantic decisions; not currently bindable to `CatalogueProjectionPort`.

### Availability, options, variants and product media

Candidate evidence:

- `GET /product-variants/product/{productId}/variants`;
- SKU, barcode, colour and low-stock variant reads;
- the `GET /products` example;
- `ProductVariantColorGroupDto` and `ProductVariantSizeEntryDto` request schemas;
- product media request schemas; and
- colour/size lookup operations.

The request DTOs establish useful vocabulary: `option_values`, price/original price, discount,
quantity, threshold, SKU/barcode, weight, package-size ID, colour-group media and size entries. The
product example also shows grouped colour/size variants and product media with ID, URL, thumbnail,
type and primary flag.

They do not establish the canonical read projection Veskify needs:

- variant-list and SKU-read success bodies are untyped;
- the example's size record has a SKU but no independent variant ID;
- option groups and option values have no canonical IDs or dependency graph;
- colour and size are required by the creation DTO even though Veskify must support arbitrary
  product option dimensions;
- quantity/threshold do not define `purchasable`, `inStock`, `lowStock`, `outOfStock`, hidden-stock
  or unavailable semantics;
- list defaults may omit empty products and out-of-stock variants, which would make an editing or
  PDP projection incomplete;
- currency, price selection and compare-at-price rules are not explicit;
- media has no localized alt text, decorative flag, role, revision or typed variant association;
- `option_key`/`option_value` and colour-group placement are not an authoritative variant-media
  join contract;
- arbitrary display/specification attributes are absent; and
- no projection fingerprint or revision exists.

`custom_input_schema` could eventually inform canonical shopper order options. Its documented field
types (`number`, `text`, `select`) do not map directly to the current Veskify selection/text
contract without decisions for numeric constraints, stable keys, maximum lengths, localization and
sanitization. The product example also shows HTML popup content while the creation description
uses plain title/description fields. Veskify must not render that HTML as trusted content.

**Classification:** useful vocabulary and adapter-discovery evidence; blocked as an
`AvailabilityOptionMediaProjectionPort` response.

### Store and approved assets

Candidate operations:

- `POST /media/upload` for image/video uploads;
- `POST /stores/profile/assets/upload` for a dynamic profile asset key;
- store logo/banner fields and `StoreProfileDto.extra_assets`;
- product and brand media reads or mutations.

The general upload request documents multipart input and media purposes including product,
variant, store logo, store banner and `puck`. Its success response is untyped. The profile-asset
operation likewise lacks a success schema. Neither contract supplies all of the approved-asset
authority Veskify needs: stable asset identity, checksum, MIME/size constraints, dimensions,
derivatives, crop/focal data, provenance, approval state, usage rights, retention, deletion effects,
or revision.

The existing store logo/banner URLs can be source evidence, subject to validation and provenance.
They are not automatically approved Veskify assets. The `puck` media purpose must remain isolated
from canonical asset persistence.

**Classification:** candidate future media adapter only; no write is authorized by this audit.

### Draft save and immutable history

No operation models:

- canonical `StorefrontSnapshot` load/save;
- expected project and current-draft revisions;
- canonical content fingerprint;
- immutable history targets;
- manual-versus-accepted-proposal save lineage;
- conflict-safe compare-and-swap; or
- restore as a new draft.

`POST /puck/azure` accepts a key and unconstrained object described as raw Puck JSON. `GET /puck`,
`GET /puck/{key}` and `DELETE /puck/{key}` return or remove that configuration. The response adds
only key, numeric store ID, raw data and update time.

This is incompatible with the Veskify architecture because Puck data is transient adapter state,
not a persisted canonical page tree. The operations also lack project identity, snapshot identity,
contract version, revision preconditions, fingerprints, history, lineage and atomic restoration.

**Classification:** `/puck` is explicitly rejected as a Veskify draft/history adapter. Vesko needs
a separate canonical snapshot repository contract or an approved opaque-artifact persistence
contract that preserves all Veskify authorities.

### Authoritative publishing and published rendering

The document contains no operation whose contract performs Veskify publication. Searches across
paths, summaries and operation IDs found only Puck configuration persistence and storefront
product reads; neither is a publication transaction.

Missing publication authority includes:

- request ID and durable idempotency identity;
- publish-preparation ID;
- expected project, saved-draft and current-published revisions/fingerprints;
- accepted-proposal receipt linkage where applicable;
- deterministic compile receipt and immutable renderer artifact;
- atomic published-pointer/history update;
- typed published/rejected result;
- ambiguous-commit reconciliation;
- rollback or restore-to-draft followed by explicit republish; and
- authoritative published homepage, collection and PDP artifact selection.

The custom-domain operations manage domain provisioning and explicitly preserve the Vesko
subdomain. They are operational domain controls, not storefront publication. The
`/storefront/products` reads expose no snapshot or published-artifact identity.

**Classification:** `StorefrontPublishingGateway` and durable publication storage remain blocked.

### Health, errors, revisions and operations

`GET /health` documents only an empty-description 200 response, inherits unresolved top-level
security and has no readiness dependencies or version information. It cannot support a staging
readiness gate as written.

Across the document:

- error bodies have no shared schema;
- status coverage varies by operation;
- no response headers are documented;
- only one operation documents 429;
- no retry policy or `Retry-After` contract is supplied;
- no correlation header exists;
- no cache semantics exist; and
- no revision or conditional-write protocol exists.

Veskify's generic staging transport can map status classes safely, but an endpoint adapter cannot
map stale revision, duplicate identity, broken reference or ambiguous commit reliably without
structured Vesko errors and revision authority.

## Scope exclusions

The OpenAPI document exposes orders, inventory mutations, carts, checkout, payments, shipping,
returns, bookings, subscriptions, social features, point-of-sale and administrative operations.
Those do not expand Veskify's product boundary.

Veskify may consume approved storefront-safe commerce projections, but it must not create, update
or delete Vesko products, variants, categories, brands, colours, sizes, inventory, orders, payments,
shipping, returns, subscriptions or domain configuration through design operations. The presence
of an endpoint is not permission to use it.

## Decisions required from Vesko

Before a real adapter is implemented, Vesko owners must provide or approve:

1. environment server URLs and base paths for staging and production;
2. corrected per-operation security, including whether bearer and `x-store-id` are AND or OR, how
   store scope is derived, and which operations are genuinely public;
3. a server-to-server or delegated-user token acquisition/refresh contract with expiry and
   revocation semantics;
4. the authoritative mapping for tenant, merchant, organization, user, store and storefront
   project, plus Studio roles/permissions;
5. typed response schemas for every selected read operation and one shared typed error envelope;
6. the canonical catalogue aggregate or a consistent pagination/reassembly protocol;
7. whether product groups are storefront collections, how category hierarchy differs, and how
   membership and merchandising order are preserved;
8. canonical product and collection slugs, navigation/routes and EN/FI localization ownership;
9. stable product-type, variant, option-group, option-value, availability and media identities;
10. price currency/selection/compare-at rules and complete out-of-stock projection behaviour;
11. product/variant media joins, alt/decorative metadata, derivatives and revision semantics;
12. opaque catalogue/product revisions or ETags and conditional request rules;
13. a canonical snapshot/draft/history persistence contract distinct from raw Puck data;
14. an authoritative, idempotent publication transaction and compiled-artifact storage/read
    contract; and
15. correlation, readiness, caching, rate-limit, timeout, audit, backup and recovery expectations.

## Safe implementation sequence after contract closure

No implementation is authorized by this audit. If the missing authority is supplied, the safe
order is:

1. validate a corrected OpenAPI document and freeze the selected operation/schema versions;
2. implement server-only authentication and store-scope verification behind the existing injected
   provider;
3. implement merchant/project context without weakening Veskify permission and revision checks;
4. implement read-only catalogue/navigation projection with complete pagination and identity
   preservation;
5. implement per-product availability/options/variants/media projection;
6. validate approved media ingestion separately from commerce media reads;
7. define and implement canonical snapshot/draft/history persistence; and
8. define and implement authoritative compiled-artifact publication.

Each slice must fail closed on malformed, stale, ambiguous or cross-store data and must retain
deterministic contract/integration evidence before any controlled Vesko staging evidence is claimed.

## Audit conclusion

The local OpenAPI file resolves the former question of whether Vesko exposes broadly relevant
store and commerce surfaces: it does. It does **not** resolve the contract details required to bind
those surfaces to Veskify's canonical ports. Current endpoint-neutral staging adapters remain the
correct boundary. Real Vesko staging and production claims remain blocked until the decisions above
are reflected in a corrected, typed contract and proven against an explicitly authorized
environment.
