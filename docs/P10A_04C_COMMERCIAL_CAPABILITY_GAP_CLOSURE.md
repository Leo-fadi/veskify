# P10A-04C — Verified commercial capability-gap closure

## Verified scope

P10A-04B identified exactly six `commercial-gap` findings: `homepageHero`,
`homepageFeaturedCollections`, `homepageFeaturedProducts`,
`homepageCollectionNavigation`, `homepagePromotion`, and `homepageTrust`.
They already had registered V2 definitions and one shared homepage renderer for
editor, preview and published targets, but were neither canonical snapshot/Puck
registrations nor executable PageBlueprint selections.

The unrelated P10A-04B binding, dynamic-product renderer-target and ownership
findings remain deferred to their named owners. This change does not suppress,
reclassify or otherwise alter those findings.

## Closure

`homepageCommerceBridgeDefinitions` is a deliberately narrow V1 snapshot/Puck
adapter. It derives a read-only V2 presentation projection from the existing
canonical storefront render context and invokes `renderHomepageCommerce`; the
bridge owns no renderer, capability definition, commerce data or asset model.
The V2 definitions and `veskifyHomepageRenderer` remain the renderer and
capability authorities.

Approved source imagery crosses this adapter as two separate, validated
section-level transports: the canonical `approvedAssetPlacements` record
(identity, role, revision, material fingerprint, provenance and required
semantics) and its safe render-only approved presentation reference. The
placement schema is owned by the neutral storefront domain and remains
available at its historical application import path as the same re-exported
schema authority. Legacy snapshots normalize both transports to explicit empty
lists. Puck preserves them as protected hidden state; the bridge derives the
compact V2 assignment only at render time. Preview and published contexts use
the same placement and presentation authority while reporting their real
renderer target.

The three executable home profiles select the capabilities as real commercial
composition choices:

- all profiles select `homepageHero`, `homepageFeaturedProducts`, and
  `homepageTrust`;
- brand-led and balanced profiles select `homepageFeaturedCollections`;
- catalogue-forward selects `homepageCollectionNavigation`;
- brand-led selects `homepagePromotion`.

These are not aliases: hero establishes an approved-media introduction;
featured collections and collection navigation provide distinct discovery
patterns; featured products provides canonical product merchandising;
promotion carries optional campaign storytelling; and trust provides bounded
service/support presentation. Their registered variants retain meaningful
hierarchy, density, discovery and responsive differences.

## Safety and deterministic evidence

The existing V2 contracts continue to provide binding/asset alternatives,
protected paths, bounded-parameter authority, all four responsive breakpoints
and accessibility requirements. The bridge derives product media only from the
read-only catalogue context as canonical product media, and does not expose
editable commerce, navigation, bindings or asset assignments.

The generated manifest continues to derive all six definitions without a
manual inventory. The P10A-04B report now has zero commercial gaps, while its
unrelated finding categories retain their deterministic evidence. Profile and
manifest fingerprints change because the canonical selected capability data
changes.

Focused deterministic coverage verifies schema re-export identity, legacy
normalization, page/component containment, canonical fingerprint sensitivity,
Puck round-trip preservation, planner/compiler preservation and browser
rendering of every profile at preview and published desktop/mobile surfaces.

## Review-correction guarantees

Homepage profile changes reconcile the existing page body against the selected
executable slots by canonical slot identity: selected bridge sections are
replaced or added, obsolete profile-managed bridge sections are removed, and
the final body order follows the materialization. Valid shared-frame header and
footer sections and unrelated merchant sections remain outside that page-body
reconciliation authority.

The bridge resolves homepage product, collection and approved navigation
intents through the canonical snapshot route authority. It does not accept
arbitrary destinations. A selected featured-product list is persisted as
canonical product references in the snapshot and is rendered in its planned
order; missing references fail closed rather than expanding to the catalogue.

Approved asset placement identity includes the target and the asset identity,
so a multi-item canonical slot such as collection media can carry distinct
assets up to its registered cardinality while a duplicate placement is
rejected. Product-media slots remain commerce-owned: editorial source assets
cannot replace the bound canonical product media.

Initial `homepageHero` materialization applies approved business name and
description using its registered content fields and preserves the profile
variant. Homepage commerce display falls back from an approved availability
label to canonical stock status, and leaves money formatting to the registered
locale-aware renderer instead of constructing raw currency strings. Generated
brand-story prose is stored only in the approved source locale; language-plan
fallback, rather than false translation, supplies other locales.

## Deliberately deferred

P10A-05 through P10A-08, dynamic-product ownership migration, renderer-version
metadata and the remaining binding findings are out of scope. The server route's
generic mapping of an unexpected deterministic planning validation error to HTTP
503 is deferred error-classification work; this task preserves the existing
mapping and corrects the invalid deterministic input instead. No SDD or DOCX
artifact is changed by this task.
