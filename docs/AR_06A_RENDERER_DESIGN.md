# AR-06A renderer design — initial preflight

AR-05 remains accepted. This child executes static composition through existing registered components; only its guarded acceptance surface is enabled. Normal Studio, editing, save/history/publication, composed commerce and commercial family acceptance remain outside this child.

## Reusable authority and API

The renderer retains one private authority snapshot per exact owner and compiled
composition fingerprint for the current render. Candidate and capacity data are
cloned and frozen before whole-snapshot validation; registered support and component
definitions retain their exact identities. Layout consumes that same retained
authority. A stateful resolver or later caller mutation cannot substitute unchecked
geometry, and no cache survives into another render.

`composedPageRealizationSupport` is the immutable real implementation adapter. `deriveComposedPageLayout` is its bounded grouping mapper, shared by support approval and rendering. `renderComposedStorefrontPage({ snapshot, pageId, catalogue, activeLocale, primaryLocale, enabledLocales, resolveAuthority, evidenceReferences?, contentSupportFactDocuments? })` returns React nodes without writes or external calls.

The renderer calls `validateComposedStorefrontSnapshot` on the complete original input with a trusted resolver wrapper that requires the actual real support implementation and exact current registered definitions. Every stored owner is revalidated, including unselected owners. A's validator checks actual containing sections, candidate/binding/support fingerprints, capability/variant/role/weight/cardinality, references and responsive choices. The requested page must be a composed static owner in that accepted snapshot. No brand/cast/fingerprint alone bypasses validation.

Require a valid canonical sharedFrame. Reject page-local frame collisions, missing frame, anatomy and composed dynamic authority before any registered rendering. Unchanged dynamic v1 may remain read-only context. After complete composition validation, a private cloned projection removes only root marker/static composition to invoke existing registered snapshot/content/media/navigation/context validation; it preserves actual sections, assets, evidence, commerce, locales and canonical paths. This projection is neither exposed nor persisted. Existing legacy parser/context guards stay unchanged.

Render registered announcement/header, one main landmark, the selected composition's whole sections and registered footer. Section storage order is never layout authority. Prevalidate complete grouping and content before constructing output. BrandSystem CSS variables are applied to the shared root. No fixture CSS, renderer copy, duplicate component tree or breakpoint-specific interactive subtree is permitted.

## Executable subset

| Selection                            | Real implementation                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `section-flow` region                | Visible whole registered sections once, in compiled unit order               |
| `precedes-preserve`                  | Canonical DOM reading order                                                  |
| `pair-columns` / `pair-stack`        | One disjoint adjacent pair wrapper; two equal minmax columns / one column    |
| `offset-block-start` / `offset-none` | Later member of the pair has token-derived block-start padding / zero offset |
| Registered order alternative         | Exactly one consistent accessible region order across all four rules         |

The mapper consumes already canonical A structure. It only checks executable subset constraints: static owner; nonempty whole-section units matching actual registered definitions; disjoint adjacent pairs; at most one offset per pair, directed from the earlier to later region; no crossing/overlapping groups. It rejects contains/spans/anchors, unsupported IDs, impossible orders, unresolved anatomy/dynamic owners, and unsupported proportion changes. Initial region proportion is preserve; optional omissions are unsupported by this first renderer. It adds no graph canonicalizer or persisted layout model.

One code-owned table supplies realization IDs and DOM/CSS mapping for both resolver and renderer. Its ID/version/material fingerprint covers this policy, breakpoints, equal columns, BrandSystem grid-gap and offset formula. Source/CSS hashes are separately retained in browser/build evidence. CSS uses existing BrandSystem `--brand-grid-gap`, `--brand-page-gutter`, `--brand-container-content` and a fixed `3rem * --brand-spacing-scale` offset. Breakpoints use existing 768/1024/1440 conventions with mobile default. No arbitrary CSS/class/coordinate input is accepted. The fixture stacks/removes offset at375/768 and preserves actual columns/nonzero offset at1024/1440; tab/DOM order remains identical.

## Neutral fixture and guarded surface

`createAr06aComposedTemplate(layout)` builds stack/offset candidates through `createComposedStorefrontCandidate`, current real support and existing definitions. Start from unchanged Aurum seed content after canonical centered-minimal shared-frame materialization. The home regions contain hero; categories+products; campaign; story; benefits; newsletter, in that order. Pair the first two adjacent regions for offset, directing offset toward the second. Retain every body section exactly once, with honest existing capability roles/weights. Both cases share content/variants/catalogue/media/frame/BrandSystem; only real candidate/composition choices differ. Candidates stay fixture-local, with no active family registration.

The server page requires non-production + standalone + explicit flag before lazy import. It accepts only case=stack|offset and locale=en|fi (bounded defaults), calls noStore() and sets noindex, and has no mutation APIs. The owner-authorized development-only exception permits parsed no-cache/must-revalidate for this standalone flagged deterministic fixture; it establishes neither storage prevention nor shared-cache exclusion. Acceptable private/no-store responses remain valid. Production remains unavailable. The fixture module is client-only: `Ar06aComposedTemplatePreview({layout,locale})` uses React.createElement in the allowed .ts file and invokes the same compositor. Only selector strings cross RSC; no resolver closures or authority JSON cross that boundary. Fixture construction exports are for local same-module/tests, never normal roots. Production404 does not prove zero acceptance bytes in build output.

## Proof and limits

The authorized clipping correction extends only two named existing CSS paths.
The current implementation changes globals: hero tracks use an intrinsic 24rem
floor and at most two columns, retaining full-bleed empty-track behavior; copy
can wrap without shrinking typography. Product tracks retain at most their selected
count while using a proposed 12rem fit floor in constrained desktop regions.
The card stylesheet remains unchanged unless direct proof requires its bounded
repair. These are shared component sizing rules, without fixture selectors or
changes to canonical content, media, BrandSystem or the compositor's outer geometry.
Direct text-range, clipping-ancestor and hit-target observations supplement the
existing viewport checks; full-width legacy column counts remain required.

Use fresh exact-source non-Git browser exports, default config, one worker/zero retries, checked unused port. Prewarm bounded routes; assert locale and wait for actual fonts/images/readiness without arbitrary sleeps. Capture stack/offset xEN/FI xfour widths:16 primary PNGs and matching JSON observations named case-locale-width. Record boxes, identities, DOM/tab order, overflow, assets and page/console/network errors. Geometry tolerance is2 CSS pixels; desktop offset must exceed16px and match declared token geometry. Preserve failed evidence; thresholds cannot be silently widened. Build actual-screenshot boards and independently inspect clipping/media/structure. This is structural proof, not normal Studio or commercial acceptance. AR-06 remains Partial.
