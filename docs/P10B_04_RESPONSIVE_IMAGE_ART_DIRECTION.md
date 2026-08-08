# P10B-04 — Responsive Image and Art-Direction Authority

**Status:** Baseline

**Date:** 8 August 2026

**Contract:** `responsiveImageAuthorityContractVersion = 1.0.0`

**Phase status:** P10B remains Partial

## 1. Outcome

P10B-04 adds one strict responsive-image sub-contract to the existing approved asset presentation
and component media projection. It does not add an asset registry, a responsive-state store, a
second breakpoint vocabulary, or product-media ownership.

The authority now carries normalized focal point and optional safe area, typed ratio, bounded crop,
closed overlay, exact source lineage, exact registered component/variant/anatomy/slot identity,
approved derivative lineage, breakpoint treatments, and a deterministic material fingerprint.
Homepage editorial media, collection product cards, and PDP product media render through one
semantic `picture` implementation at the existing `mobile`, `tablet`, `desktop`, and `wide`
breakpoints.

Production CDN derivative generation and URL materialization remain deferred. The persisted
derivative contract intentionally has no URL field; current rendering uses the immutable approved
source URL and exposes selected derivative identity only when an approved derivative exists.

## 2. Canonical authority and ownership

| Concern                                  | Canonical owner                        | P10B-04 use                                                                                                   |
| ---------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Source asset and approved URL            | `ApprovedAssetPresentation`            | Optional `artDirection` is embedded in the existing presentation.                                             |
| Source role/revision/material identity   | Existing placement/presentation pair   | `artDirection.source` must match it exactly.                                                                  |
| Component, variant, slot and cardinality | `ComponentDefinitionV2`                | Resolver revalidates current definition and exact asset-slot contract.                                        |
| Anatomy region and version               | P10B-03 `commercialAnatomy`            | Placement authority records and revalidates contract, identity, version, variant structure and region.        |
| Merchant-wide defaults                   | P10B-02 Design DNA                     | Ratio/crop/overlay selections may narrow but cannot broaden the current DNA media posture.                    |
| Product ownership and ordering           | Canonical commerce projection          | Art direction changes presentation only; source product ID, membership, order and media IDs remain unchanged. |
| Breakpoints                              | Existing component-platform vocabulary | Exactly `mobile`, `tablet`, `desktop`, `wide`; no parallel viewport registry.                                 |
| Persistence/publication                  | `StorefrontSnapshot` and P10A compiler | The embedded authority crosses draft, proposal, compiler and compiled page boundaries unchanged.              |

The schema is implemented in
`src/domain/asset-presentation/responsive-image.ts`. Its application validation, fallback and
legacy defaulting live in
`src/application/responsive-image-authority/responsive-image-authority.ts`.

## 3. Contract

`ResponsiveImageAuthority` is strict and versioned. Its material fields are:

- immutable source lineage: asset ID, approved role, revision, material fingerprint, provenance
  kind, and source owner ID;
- registered placement authority: component type/version, exact variant, anatomy contract/identity/
  version/region, asset slot, and required cardinality;
- normalized safe area inside the source frame;
- source treatment plus at most one treatment for each registered breakpoint;
- approved derivative records containing derivative ID/revision/fingerprint, exact source lineage,
  approved transform, approval status, and optional breakpoint;
- deterministic material fingerprint.

Focal points are closed to `[0, 1] × [0, 1]`. Normalized rectangles must have positive dimensions
and remain inside the source frame. Crop is `natural`, `contain`, `cover`, or `editorial`; an
explicit crop rectangle is legal only for `editorial`. Ratio is `natural`, `square`, `portrait`,
`landscape`, or `wide`. Overlay is `none`, `subtle`, `contrast`, or `gradient`.

The persisted contract contains no arbitrary CSS, class name, generated markup, transformed URL,
or executable value.

## 4. Inheritance and compatibility

Resolution retains the binding hierarchy:

```text
BrandSystem Design DNA
  → PageBlueprint authority already selected by the snapshot
  → current ComponentDefinitionV2 variant and commercial anatomy
  → exact anatomy media region and asset slot
  → approved bounded image treatment
```

The validator checks the current component version, variant, anatomy identity/version, region,
slot, role and required cardinality. It uses the P10B-03 asset requirement projection only as an
exact consistency check against the owning component asset slot; it does not create a second
compatibility engine.

DNA compatibility is narrowing-only. `contain` never permits a broader crop; `cover` permits
natural/contain/cover; `editorial` permits all registered crop modes. Overlay authority follows the
same bounded rule. A non-natural fixed ratio must match the inherited DNA ratio.

## 5. Source, derivative and fallback behavior

Derivative records preserve exact immutable lineage to the source authority. Unknown, pending,
rejected, stale, or wrong-lineage derivatives fail before use. Since CDN transformation is not yet
implemented, renderers do not invent derivative URLs or accept client-supplied transformed URLs.

Breakpoint selection is deterministic:

1. exact requested breakpoint;
2. the fixed compatible fallback order for that breakpoint;
3. the valid source treatment;
4. omission by the owning optional slot;
5. fail with `required-image-unresolved` when the owning slot is required.

The current authority always contains a valid source treatment, so step 3 is the normal final
fallback. Optional omission remains owned by the registered component slot and renderer; P10B-04
does not add another omission flag.

## 6. Product-media protection

Product-media authority is presentation-only. The catalogue route adapter derives lineage from the
canonical product presentation context and retains the same asset ID, product owner ID, role,
revision, media membership, and order. Product main/alternative treatments default to `contain`,
center focal point, and no overlay while retaining the inherited DNA ratio. This is a narrowing of
Design DNA and avoids identity loss.

Validation with an expected product rejects:

- a different `sourceOwnerId`;
- provenance other than `canonicalProductMedia`;
- editorial media replacing main/alternative product media;
- editorial crop geometry on protected product media.

Editorial supporting media may still render in its registered role, but it is not projected as a
canonical product-main or product-alternative authority.

## 7. Safe area and accessibility

An explicit editorial crop rectangle must contain the complete normalized safe area. Invalid or
out-of-frame geometry fails closed. Protected product defaults use the complete source frame as the
safe area and `contain`, preserving the complete canonical image.

The shared renderer preserves existing alt/decorative behavior: non-decorative metadata still
requires localized alt text, while decorative media renders with empty alt. Overlay values are a
closed presentation enum; text contrast remains owned by the validated Design DNA colour
relationships and component overlay-copy rules.

## 8. Rendering boundary

`ResponsiveStorefrontImage` emits a semantic `picture` with four controlled `source` elements and
one fallback `img`. Renderer values come only from parsed authority. Controlled CSS variables carry
ratio, object fit and normalized focal position. Data attributes correlate contract version,
authority fingerprint, source ID, requested breakpoint, selected fallback, crop, focal point,
ratio, overlay and optional derivative ID for browser evidence.

The same component is consumed by:

- approved homepage bridge media;
- dynamic collection media and canonical product cards;
- dynamic PDP gallery, option, supporting and related-product media.

Editor, preview and published routes already share these registered renderers. P10B-04 does not
fork a published implementation.

## 9. Fingerprint, migration and lifecycle

The authority fingerprint covers all material source, placement, geometry, treatment and derivative
state. Responsive-treatment and derivative arrays are canonicalized before hashing, so order-only
changes do not alter the fingerprint. A material focal/crop/ratio/overlay/lineage change does.

Existing valid snapshots remain parseable because `artDirection` and the placement's compatible
`sourceProvenanceKind` addition are optional. Current planners derive that kind from approved source
evidence (`merchant-upload` or source-discovered evidence). The homepage bridge derives one
deterministic current-version authority from a legacy presentation only when that exact provenance
kind is present; it retains ordinary source rendering when old state cannot prove provenance rather
than inventing lineage. This is a compatibility projection, not a fixture rewrite or competing
persisted model. New authored authority is preserved exactly by strict snapshot parsing, proposal
materialization, JSON save/reload, compiler approved-asset fingerprinting, compiled page output and
published rendering.

## 10. Fail-closed behavior

Stable application codes cover unknown/stale authority, unapproved derivative, wrong source, role,
slot or anatomy, invalid geometry/ratio/overlay/breakpoint, Design DNA broadening, wrong product,
editorial product replacement and unresolved required media. Schema validation additionally rejects
unknown fields, duplicate breakpoint/derivative identities, invalid normalized values, stale
fingerprints and mismatched presentation lineage.

Publish compilation revalidates authored art direction against the exact persisted section variant,
placement slot/cardinality, current component/anatomy and current snapshot Design DNA. Failure is an
`invalid-approved-asset` compiler failure, so partial output cannot become active under the existing
atomic publishing gateway.

## 11. Evidence

Deterministic contract coverage is in
`tests/unit/p10b-04-responsive-image-authority.test.ts` with the required 30 cases plus five
explicit breakpoint/omission/required-fallback/product-derivative/safe-area cases. It covers schema,
geometry, lineage, deterministic fingerprints, fallback, component/anatomy/slot compatibility, DNA
narrowing, product ownership, migration and presentation matching.

Integration coverage is in
`tests/integration/p10b-04-responsive-image-rendering.test.tsx`. It proves same-product PDP and
collection projection, four-source semantic rendering, correlated fingerprint evidence, and exact
JSON save/reload preservation. Existing publishing, storefront-commerce, PDP, collection and fresh-
store rendering suites remain part of the affected regression gate.

Browser coverage is in
`tests/e2e/p10b-04-responsive-image-art-direction.spec.ts`. It inspects editorial source/fingerprint/
breakpoint/focal/crop/ratio/overlay evidence at 375, 768, 1024 and 1440 px, plus canonical PDP media
at mobile and wide widths, and asserts zero external OpenAI provider requests.

This is deterministic automated evidence. Retained product-owner commercial visual review remains a
P10B-14/P10B-17/P10B-18 gate and is not manufactured by this baseline.

## 12. Explicit non-goals

- P10B-06 through P10B-18 commercial families, profiles, synthesis, diversity, performance or phase
  closure;
- P10C asset-library/editor controls, manual crop UI, uploads or history UX;
- P10D generated media, video or interactive presentation;
- production CDN transformation, storage, signing, cache invalidation or deployment;
- provider or Vesko staging calls;
- canonical product-media mutation, reordered membership, or a second product/media model;
- a second asset registry, responsive-state store, component compatibility engine, breakpoint
  vocabulary, compiler or publisher.
