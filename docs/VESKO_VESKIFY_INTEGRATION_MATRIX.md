# Vesko–Veskify Integration Matrix

- **Companion audit:** [`VESKO_OPENAPI_CONTRACT_AUDIT.md`](./VESKO_OPENAPI_CONTRACT_AUDIT.md)
- **OpenAPI input digest:** `df90840a96fd5482529bef5b5f260d46accd80182025479d49b96a265ac94184`
- **Repository baseline:** `78d89bf4e4a33c0f49df5a42241934393fd244b5`

## Disposition vocabulary

| Disposition               | Meaning                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Candidate                 | The operation appears relevant, but needs a reviewed endpoint adapter and additional contract authority.     |
| Insufficient              | The operation lacks essential response, identity, revision or semantic information for the Veskify contract. |
| Incompatible              | The documented representation conflicts with a binding Veskify architecture decision.                        |
| Missing                   | No corresponding Vesko operation was found in the supplied document.                                         |
| Out of scope / prohibited | Vesko owns the operation and Veskify design workflows must not call it.                                      |

No row marked Candidate authorizes implementation or a Vesko API call.

## Canonical port matrix

| Veskify authority or port                  | Vesko operation evidence                                               | Disposition  | What maps now                                                                                                          | Required closure                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Merchant/store discovery                   | `GET /stores/verify-context`; `GET /users/profile`; `GET /stores/{id}` | Candidate    | Store ID, business name/description, logo/banner, subdomain/domain and user ID/coarse role are documented in two DTOs. | Define discovery input, typed store-by-ID result and distinction between browser host discovery and authenticated authorization.                                   |
| `MerchantProjectContextPort`               | Same operations                                                        | Insufficient | Store and user identities are partial inputs only.                                                                     | Supply tenant, merchant, organization, storefront-project, exact roles/permissions, locale/market and opaque project revision.                                     |
| Authentication provider                    | `POST /auth/login`; `POST /auth/refreshToken`; `DELETE /auth/logout`   | Insufficient | Bearer JWT is named as a security scheme.                                                                              | Correct the security graph; type token/session responses; define service/delegated flow, expiry, refresh, revocation, cookies/CSRF and store-scope binding.        |
| Catalogue product list                     | `GET /products`; `GET /products/search`                                | Candidate    | Filtering and pagination inputs; one detailed list-response example.                                                   | Add a typed response, complete pagination, stable ordering, currency, slugs, product type, revision and complete published/out-of-stock inclusion rules.           |
| Catalogue product detail                   | `GET /products/{id}`; `GET /storefront/products/{id}`                  | Insufficient | Numeric product path identity only.                                                                                    | Type both success bodies, define intended audience and select one canonical storefront-safe operation.                                                             |
| Canonical collection projection            | `GET /product-groups`; products' example `ProductGroups`               | Insufficient | Product-group names/descriptions and apparent product relation.                                                        | Vesko must state whether groups are curated collections and provide ID, slug, description, ordered membership, visibility and revision.                            |
| Canonical category hierarchy               | `GET /categories`; `GET /categories/{id}`                              | Candidate    | Category ID/name/parent evidence; list summary claims a nested tree.                                                   | Add typed hierarchy response, slug, stable order, visibility, localization, revision and cycle/parent rules.                                                       |
| Navigation and route references            | No navigation/menu/route operation found                               | Missing      | Store subdomain/custom domain identify hosts only.                                                                     | Provide canonical home/product/collection/category routes, navigation nodes, hierarchy, order and locale ownership.                                                |
| Catalogue revision and revalidation        | No revision, ETag or response-header declaration                       | Missing      | None.                                                                                                                  | Provide opaque catalogue revision or ETag and exact revalidation/stale semantics.                                                                                  |
| Availability/options/media projection      | Variant reads; `GET /products` example; product-variant request DTOs   | Candidate    | Quantity, threshold, option values, SKU, prices and media vocabulary.                                                  | Type read responses and define arbitrary option dimensions, stable IDs, dependencies, purchasability, availability states, price policy, media joins and revision. |
| Canonical product media                    | Product example; product/variant media DTOs                            | Insufficient | Media ID, URL, thumbnail, IMAGE/VIDEO and primary flag appear in evidence.                                             | Add localized alt/decorative state, role, stable public URL, variant associations, derivatives, dimensions and revision.                                           |
| Approved asset ingestion                   | `POST /media/upload`; `POST /stores/profile/assets/upload`             | Candidate    | Multipart upload inputs and broad media-purpose labels.                                                                | Type success/failure, checksum, MIME/size limits, stable ID, provenance, approval, rights, derivatives, crop/focal, retention and deletion effects.                |
| `StorefrontDraftPersistencePort.load/save` | `/puck` configuration operations                                       | Incompatible | A key, raw Puck data, store ID and update timestamp.                                                                   | Add a separate canonical `StorefrontSnapshot` contract with project/snapshot identity, revisions, fingerprint, lineage and compare-and-swap.                       |
| Immutable history and restore              | No storefront history/restore operation found                          | Missing      | None.                                                                                                                  | Provide immutable snapshot listing/lookup and atomic restore-to-new-draft semantics with expected revisions/fingerprints.                                          |
| `StorefrontPublishingGateway`              | No publication operation found                                         | Missing      | None.                                                                                                                  | Provide request/preparation IDs, expected authorities, durable idempotency, compile receipt/artifact, atomic publish result and ambiguous-commit reconciliation.   |
| Published artifact selection/rendering     | `GET /storefront/products`; custom-domain operations                   | Insufficient | Commerce reads and host provisioning only.                                                                             | Provide published snapshot/artifact identity and authoritative homepage/collection/PDP selection independent of later draft changes.                               |
| Health/readiness                           | `GET /health`                                                          | Insufficient | An untyped 200 response.                                                                                               | Define public/auth status, typed dependency readiness, environment/version, failure codes and non-secret diagnostics.                                              |
| Shared errors/observability                | Per-operation status descriptions                                      | Insufficient | Some 4xx/5xx descriptions.                                                                                             | Add shared error code/schema, correlation ID, rate-limit/retry headers and redaction-safe diagnostic policy.                                                       |

## Field-level commerce mapping

This table distinguishes plausible transformations from authoritative mappings. Every
transformation remains blocked until the selected Vesko read response is typed.

| Vesko evidence                      | Veskify target                      | Mapping assessment                                                                                                            |
| ----------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Product `id` number                 | `productId` string                  | Mechanically transformable, but must use a stable entity namespace rather than an unqualified decimal string.                 |
| Product `name`                      | localized `title`                   | Text exists, but locale and fallback authority are absent.                                                                    |
| Product `description`               | localized `description`             | Text exists, but locale and sanitization authority are absent.                                                                |
| No product slug                     | product `slug`                      | Missing; Veskify must not invent a route slug if Vesko owns public routing.                                                   |
| No product-type field               | `productTypeId`                     | Missing; brand or category must not be substituted for product type.                                                          |
| `Brand.id/name`                     | display brand / possible identity   | Name is usable only after typed response validation; brand is not product type.                                               |
| `Category.id/name/parent_id`        | category node                       | Candidate for hierarchy; slug, localization, ordering and typed response are missing.                                         |
| `ProductGroups`                     | collection membership               | Semantic equivalence and ordering are unconfirmed.                                                                            |
| Variant `sku`                       | variant SKU                         | Direct vocabulary match if the read schema guarantees it; SKU is not automatically a stable variant ID.                       |
| Variant `option_values`             | option-value selections             | Values exist, but group/value IDs, types, dependencies and arbitrary-dimension rules are absent.                              |
| Variant `price`                     | current variant price               | Amount candidate; currency and authoritative price-selection rules are absent.                                                |
| Variant `original_price`            | compare-at price                    | Plausible only when Vesko confirms display and discount semantics.                                                            |
| Variant `quantity` and `threshold`  | availability status / stock display | Requires a Vesko-approved policy; Veskify must not derive purchasability or expose quantity by assumption.                    |
| Variant `discount_type/value`       | presentation metadata               | Operational pricing inputs; Veskify should consume resolved authorized prices rather than recalculate discounts.              |
| Media `id`                          | canonical asset ID                  | Needs entity namespace, stability and revision guarantees.                                                                    |
| Media `url` / `thumb_url`           | source/derivative URL               | Candidate after public-access, expiry, normalization and retention rules are documented.                                      |
| Media `type`                        | media type                          | IMAGE/VIDEO vocabulary is compatible at a high level.                                                                         |
| Media `is_primary`                  | ordering/role input                 | Primary does not fully define Veskify media role or deterministic complete ordering.                                          |
| Media `option_key` / `option_value` | variant-media association           | Ambiguous; the canonical projection requires stable bidirectional variant IDs.                                                |
| No media alt/decorative field       | localized `alt` / `decorative`      | Missing; a product-title fallback cannot be assumed for all media.                                                            |
| Custom input `fields`               | shopper order options               | Candidate for selection/text inputs after stable-key, localization, number, limit and requiredness decisions.                 |
| Custom popup HTML example           | safe presentation content           | Must not be passed through as trusted HTML; contract conflicts with the plain-text creation description and needs resolution. |
| Product `status` / `sales_channel`  | storefront eligibility              | Candidate filter authority; define whether only `PUBLISHED` plus ONLINE-capable products are storefront-safe.                 |
| Product `store_id`                  | request store-scope cross-check     | Useful consistency check, never authentication by itself.                                                                     |
| Pagination example                  | complete catalogue assembly         | Example-only; type it and define snapshot consistency across pages before assembling a canonical projection.                  |

## Store-context field mapping

| Vesko field                                          | Possible Veskify use                      | Missing authority                                                                              |
| ---------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Store `id`                                           | `storeId`                                 | Tenant/merchant/organization relationships and authenticated scope.                            |
| User `id`                                            | `userId`                                  | Exact Storefront Studio roles and permissions.                                                 |
| `business_name`, `store_description`                 | brief/source evidence                     | Locale, provenance and merchant approval.                                                      |
| `store_logo`, `store_banner`, profile `extra_assets` | source asset candidates                   | Stable asset IDs, approval, rights, checksums, derivatives, alt, retention and revision.       |
| `subdomain`, `custom_domain`                         | public host discovery                     | Canonical route base, environment, activation authority and separation from publishing.        |
| User `role`                                          | policy input at most                      | A documented mapping to owner/admin/designer/viewer and read/save/restore/publish permissions. |
| No corresponding field                               | `tenantId`                                | Required.                                                                                      |
| No corresponding field                               | `merchantId` / `organizationId`           | Required; must not be copied from store ID without an explicit Vesko identity model.           |
| No corresponding field                               | `storefrontProjectId` / `projectRevision` | Required; a Veskify project is not established by a Vesko store DTO.                           |
| No corresponding field                               | locales / market                          | Required; inferred browser locale is not canonical project authority.                          |

## Persistence representation comparison

| Required Veskify property                           | `/puck` evidence                 | Result       |
| --------------------------------------------------- | -------------------------------- | ------------ |
| Canonical `StorefrontSnapshot`                      | Arbitrary raw Puck `data` object | Incompatible |
| Storefront project identity                         | Key plus numeric `store_id`      | Missing      |
| Snapshot ID and contract version                    | None                             | Missing      |
| Expected project/current-draft revision             | None                             | Missing      |
| Canonical content fingerprint                       | None                             | Missing      |
| Manual/accepted-AI save lineage                     | None                             | Missing      |
| Immutable history                                   | None                             | Missing      |
| Restore-to-new-draft                                | None                             | Missing      |
| Publish preparation and confirmation                | None                             | Missing      |
| Compiled immutable renderer artifact                | None                             | Missing      |
| Durable idempotency and ambiguous-commit resolution | None                             | Missing      |

The Puck endpoints must not be wrapped to appear conformant. A new Vesko contract must preserve
canonical Veskify data; Puck projection can be reconstructed at the editor boundary.

## OpenAPI corrections required before adapter work

| Priority | Contract correction                                                                                                                     | Why it blocks Veskify                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P0       | Add staging/production `servers` or provide an environment-owned base-path contract.                                                    | No endpoint can be selected safely.                                              |
| P0       | Define `bearer` or replace its 67 explicit references; correct AND/OR semantics for bearer and `x-store-id`.                            | Authorization cannot be implemented or reviewed.                                 |
| P0       | Mark truly public/bootstrap operations explicitly and define server-side Storefront Studio authentication.                              | Login, health and public/read scope currently inherit ambiguous security.        |
| P0       | Add typed success schemas for selected products, product detail, variants, categories, product groups, storefront products and uploads. | Example-only or empty response contracts cannot cross strict Veskify validation. |
| P0       | Add a canonical identity and revision model.                                                                                            | Tenant isolation and stale-state rejection cannot be proven.                     |
| P0       | Define canonical snapshot/draft/history and publication operations.                                                                     | Save, restore and publish ports have no Vesko counterpart.                       |
| P1       | Add navigation/routes, collection semantics, localization and stable merchandising order.                                               | Complete storefront routes and collection pages cannot be assembled canonically. |
| P1       | Define option, availability, price and media read semantics, including arbitrary option dimensions.                                     | PDP correctness and protected commerce cannot be guaranteed.                     |
| P1       | Add shared error, correlation, rate-limit, retry and cache contracts.                                                                   | Safe typed failure mapping and operations are incomplete.                        |
| P2       | Add explicit ownership/tag descriptions and deprecation/version policy.                                                                 | Future change impact and API lifecycle cannot be governed reliably.              |

## Explicitly prohibited operation groups

The following Vesko operations remain Vesko-owned and outside design-agent authority:

- create/update/delete products, variants, categories, product groups, brands, colours or sizes;
- inventory adjustments and low-stock operational actions;
- cart, checkout, order, payment, point-of-sale and receipt mutations;
- shipping, fulfilment and returns;
- subscription and billing operations;
- bookings and service operations;
- user/session administration;
- social/community mutations; and
- subdomain/custom-domain mutation.

Approved future adapters should expose only the smallest read or explicit persistence/publication
surface required by the existing Veskify ports. They must not expose the full generated Vesko
client to planners, providers, components or the browser.

## Contract closure gates

A Vesko-backed capability can move from blocked discovery to implementation only when:

1. the selected endpoint, environment, security and store-scope rules are explicit;
2. every accepted response is covered by a typed schema and shared typed errors;
3. identity, revision and pagination behaviour is deterministic and testable;
4. the mapping preserves Vesko commerce authority and Veskify snapshot authority;
5. malformed, stale, duplicate, ambiguous and cross-store inputs fail closed;
6. deterministic contract and integration fixtures cover the exact endpoint schema;
7. authorized staging validation succeeds without expanding the adapter's scope; and
8. retained evidence is classified accurately—contract or deterministic evidence is not Vesko
   staging or production evidence.

Until those gates are met, the endpoint-neutral transports and standalone implementations remain
the authoritative executable Veskify boundaries.
