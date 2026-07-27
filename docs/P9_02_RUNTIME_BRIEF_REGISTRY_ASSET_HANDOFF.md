# P9-02 runtime brief, registry and approved-asset handoff

## Authoritative runtime context

The whole-storefront API route remains the only editor path for a storefront-wide design request. Its server authority resolves an `AuthoritativeWholeStorefrontPlanningContext` before the canonical planner is called. The browser supplies merchant intent and its existing draft baseline only; it cannot submit a design brief, component registry, recipe set, approved asset set, or commerce permissions.

The authority validates and clones the following project-owned inputs before building `WholeStorefrontPlanningInput`:

- the approved source-discovery `StorefrontDesignBriefContract`, including business identity, industry, target customer, market, brand direction, goals, constraints, and locale plan;
- the existing Component Registry v2 definitions and capability metadata;
- the existing implemented storefront-template definitions as the page/section recipe context;
- the approved-generation asset projection, including approval, source identity, revision, material fingerprint, localized alternative text, decorative semantics, and responsive crops where present;
- the current project aggregate, canonical catalogue projection, and current draft snapshot.

The context source is server-only and is injectable at the authority boundary for a future persisted project/onboarding composition. A missing, malformed, unapproved, cross-project, locale-incompatible, registry-invalid, or asset-invalid input is rejected before planning with a typed `ServerWholeStorefrontAuthorityError`. The API returns only the existing merchant-safe failure categories.

## Brief, registry, and recipe ownership

The approved source-discovery brief remains the design-brief authority. The runtime does not create a generic fallback brief when a project brief is unavailable. The provider-facing planning request now contains the approved business context together with the existing brief direction and evidence identifiers.

Component definitions remain owned by the Component Registry v2; P9-02 does not create a registry schema or expose Puck types. Template definitions remain owned by `application/storefront-templates`. Their immutable implemented definitions are handed to the planner as recipe context, including existing homepage, collection, product, header/footer, slot, compatibility, and omission rules. No P9-03 component family or richer recipe is added here.

## Approved assets and canonical media

Only `ApprovedGenerationAssetContext` crosses into planning. It contains references and metadata only, never source URLs, source HTML, files, or provider credentials. Rejected, unresolved, or unapproved discovery candidates are excluded by the existing asset-review projection boundary.

Canonical product and variant media remain commerce-owned and read-only. The provider request repeats that protection, and placement validation rejects `productMainImage` and `productAlternativeImage` mutations. Design-layer assets may be used only in approved component asset slots.

## Fingerprints, stale handling, and locale

The canonical planner binds proposals to the approved brief and evidence fingerprints, component-registry fingerprint, recipe-context fingerprint, approved-asset fingerprint, draft fingerprint/revision, catalogue fingerprint, and project revision. The authority reloads its context after provider work; any changed authoritative input produces the existing stale-result rejection and no proposal is returned or applied.

The requested locale must be enabled on the project and included in the approved brief language plan. EN and FI are retained; planning does not silently translate merchant content.

## Standalone behavior and failure taxonomy

Standalone Aurum Nordic and Karvonen each resolve their own explicit approved seeded brief, registry/recipes, and approved logo asset through the same context-source boundary. They remain deterministic, credential-free, and project-isolated. The integrated runtime remains unavailable until its persistent project/onboarding context source is composed; it does not fall back to standalone or browser-owned values.

Typed authority failures cover unavailable or invalid briefs, unavailable/mismatched registries, unavailable/invalid assets, unsupported locale, project/draft mismatch, malformed state, stale context, authorization, and provider unavailability. Raw repository errors, provider errors, and asset URLs are not exposed.

## Non-goals

P9-02 does not add component families, hero/product-card designs, richer P9-03 recipes, editor redesign, staging transport, product enrichment, live provider calls, publishing, or automatic translation.
