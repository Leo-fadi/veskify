# P10B-02 — Parametric BrandSystem / Design DNA

**Status:** Baseline

**Authority:** canonical `BrandSystem`

**Evidence date:** 2026-08-08

## Outcome

P10B-02 extends the existing `BrandSystem` with versioned, bounded merchant-wide Design DNA. It
does not create another root model or token store. The canonical inheritance remains:

```text
BrandSystem
  → PageBlueprint profile
  → component family / meaningful variant
  → bounded validated instance override
```

Design DNA establishes one cross-page identity for shared frame, home, collection, and product
detail rendering. P10B-03 still owns component anatomy, P10B-04 owns focal/safe-area/derivative art
direction, and P10B-05 owns site-map and page-family authority.

## Canonical contract

`BrandSystem.designDna` is a strict versioned extension of `BrandSystem`. Its bounded domains are:

- semantic colour for page, surface, muted and contrast surfaces, readable text roles, borders,
  accent, primary/secondary actions, and legitimate status roles;
- approved font tokens and pairings plus display, heading, body, utility, and price roles, bounded
  type scale, weights, line heights, and tracking;
- spacing scale, section rhythm, page gutter, grid gap, card inset, and reading/content/commerce/
  wide/full container posture;
- surface, border, radius, and elevation grammar;
- primary/secondary control posture, height, density, shape, and emphasis;
- global, navigation, content, and commerce density;
- restrained, editorial, or product-led media posture with bounded ratio, crop, overlay, and
  prominence defaults.

The approved-font allowlist is one exported authority. Remote font URLs, arbitrary CSS values,
arbitrary spacing, unknown enum values, stale versions, invalid ranges, invalid font-pairing
relationships, and required contrast failures are rejected by strict schema validation.

## Migration and persistence

Existing valid BrandSystem state remains loadable. When `designDna` is absent,
`resolveBrandSystemDesignDna` deterministically derives the bounded authority from the existing
palette, typography, shape, spacing, imagery, visual-system, and semantic-presentation intent.
`migrateBrandSystemDesignDna` materializes that same result for persistence. Malformed legacy
input fails closed.

Legacy foreground migration is multi-background aware. It preserves the merchant's declared text
or muted-text colour when that colour is readable on both page and ordinary surface, then considers
existing semantic candidates in declared order. If none is valid, a fixed bounded neutral ramp
selects the nearest deterministic foreground that passes every required pair. For the rare legacy
surface combination with no possible shared foreground, migration minimally normalizes only the
new semantic surface toward the page until the Design DNA contract is satisfiable; the original
legacy palette and its compatibility variables remain unchanged and loadable.

Registered direction and token-refinement paths synchronize affected Design DNA authority rather
than leaving stale explicit DNA behind. `StorefrontSnapshot`, draft save/reload, history, and the
deterministic publication compiler preserve the exact nested contract through their existing
BrandSystem fields.

## Effective renderer projection

`projectBrandSystemDesignDna` is the one deterministic projection into the existing CSS-variable
styling boundary. It returns:

- the Design DNA version and canonical identity fingerprint;
- an immutable effective projection fingerprint;
- the exact shared-frame/home/collection/product reach declaration;
- semantic colour, typography, spacing/container, surface/elevation, control, density, and media
  variables.

Editor, preview, and published render paths already call `brandSystemToCssVariables`; that function
now delegates to the effective Design DNA projection. Existing `--brand-color-*` variables and
`--brand-spacing-density` remain backward-compatible aliases of the exact accepted BrandSystem
fields, including compact density `0.85`. New surface/context, typography, spacing, container,
control, density, and media variables carry Design DNA semantics independently; compact Design DNA
density remains `0.86` through `--brand-density-global` and does not overload the compatibility
alias.

Registered ordinary homepage surfaces consume the semantic page/ordinary surface and context-safe
foreground projections. Registered contrast surfaces consume `contrastSurface`, `contrastText`,
and a contrast-safe secondary-text projection, while actions use their canonical validated action
surface/text pairs. A materially different contrast identity is therefore renderer-visible without
hard-coded component colours. No component keeps a second token copy. The P10B-01 adapter consumes
resolved Design DNA and its lower authority layers continue to reject widening.

## Material differentiation

Two registered examples prove non-colour differentiation while intentionally using the exact same
semantic colour system:

- `premiumEditorialDesignDna` uses serif-led expressive typography, expansive rhythm, generous
  containers and insets, raised surfaces, prominent spacious controls, and editorial portrait
  media;
- `modernTechnicalDesignDna` uses sans-led compact typography, tight rhythm and grids, standard
  containers, square flat surfaces, compact controls, dense commerce, and contained square media.

Their identity and effective-projection fingerprints differ. Colour alone therefore cannot satisfy
the material-difference proof.

## Evidence

- **Contract/schema and deterministic unit:** full schema, normalization, identity/projection
  fingerprints, migration, material examples, same-input equality, changed-input divergence,
  multi-background legacy contrast, exact compatibility aliases, ordinary/contrast renderer
  projection, version, font, range, arbitrary-CSS/spacing, semantic relationship, malformed input,
  and lower-layer broadening rejection.
- **Integration/lifecycle:** in-memory repository save/reload retains exact Design DNA; the
  deterministic publication compiler retains exact Design DNA in compiled output; existing
  BrandSystem, visual-system, grammar, repository, and compiler regressions pass.
- **Browser/E2E:** one merchant-wide fingerprint and non-colour typography/rhythm/gutter/control/
  media projection are visible on shared frame, home, collection, and PDP at 375px, 768px, 1024px,
  and 1440px without horizontal clipping.

This evidence establishes the P10B-02 foundation. It does not claim new component anatomies,
commercial page profiles, focal-point art direction, complete-store synthesis, direction-scale
diversity, retained human commercial review, Vesko staging, or production readiness.

## Non-goals and deferred work

- No component-family or variant work from P10B-03.
- No focal points, safe areas, derivatives, or canonical product-media mutation from P10B-04.
- No page-set, route, navigation, or PageBlueprint family work from P10B-05.
- No raw CSS, remote font URL, per-section theme store, duplicate registry, or generated executable
  frontend code.
- P10B-03 is separately Baseline; P10B-04 through P10B-18 remain Planned.

## Current P10B-17 continuation

P10B-17 keeps this BrandSystem as the only visual-token authority. Its projection now derives a
paired inner/outer focus ring from existing validated semantic text roles so focus remains visible
across page, surface, and contrast regions without introducing another palette or component token
store. Responsive components continue to consume the registered typography, spacing, density,
surface, border, control, and media variables; P10B-17 does not restyle sections independently or
mutate the merchant Design DNA.

This closes execution and semantic-accessibility gaps for the current registered surfaces. It does
not establish P10B-18 multi-store commercial quality or scale acceptance.

## Current P10B-18B-01 continuation

**Acceptance state:** **Baseline**. The product owner accepted P10B-18B-01 on 17 August 2026. This
continuation does not change the accepted P10B-02 Baseline; parent P10B-18B is **Partial**, while
P10B-18 and P10B remain **Partial**.

The accepted implementation keeps `BrandSystem.designDna` and its canonical schema at `1.0.0`. It adds no token
store, persisted selection model, schema migration, or publication representation. Existing
snapshots retain their exact materialized Design DNA. New current-authority compilation applies the
selected registered spacing density and surface depth before materialization; refreshed transient
authority fingerprints make stale proposals fail closed through the existing boundary.

The exact supported density chains are:

| Coordinated direction                  | Provider density → exact spacing → synthesis posture → Design DNA density         | Surface depth |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------- |
| Premium Editorial (`premiumEditorial`) | `balanced → standard → balanced → balanced`; `low → spacious → airy → spacious`   | `layered`     |
| Modern Technical (`modernTechnical`)   | `high → compact → compact → compact`; `balanced → standard → balanced → balanced` | `flat`        |
| Minimal Commerce (`warmApproachable`)  | `balanced → standard → balanced → balanced`; `low → spacious → airy → spacious`   | `subtle`      |

The registered materializer preserves the merchant's semantic colour roles and the direction's
typography, media, shape, action hierarchy, and container identity while applying the exact spacing
scale, section rhythm, gutter, grid gap, card inset, control height/density, regional density, and
surface elevation. Spacious composition keeps commerce density balanced instead of inflating
purchase controls. These values continue through the single Design DNA CSS-variable projection.

Deterministic accepted evidence proves both supported density outcomes for each direction on one
fixed page/profile/frame backbone, with equal merchant colour and different non-colour Design DNA,
identity fingerprints, projection fingerprints, and emitted geometry. The focused browser record
contains seven materialized stores and 17 captures: 12 primary direction/home-or-collection/
375-or-1440 captures, three alternate-DNA home captures at 1440, and two editorial long-navigation
captures at 1024 and 1440. Every alternate uses the same fixture and direction as its primary while
changing exact density and rendered Design DNA. Premium and Modern retain the homepage profile and
homepage component sequence; Minimal's only audited airy semantic witness also changes those home
authorities. Only the Premium browser pair fixes the exact frame and complete profile tuple. The
Modern and Minimal browser pairs change frame, so their fixed-frame causality remains deterministic
evidence rather than a visual claim.

All seven accepted drafts preserve their exact snapshot and Design DNA fingerprints through
standalone persistence and reload while commerce and media fingerprints remain unchanged. The
browser checkpoint makes zero external, provider, Vesko, browser generation-endpoint, or
publication request and does not itself broaden the earlier publication evidence. The 17 captures
remain focused successor evidence, not P10B-18C designer-grade or 100+ scale acceptance.
