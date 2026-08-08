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
- P10B-03 through P10B-18 remain Planned.
