# P10B-06 — Commercial Shared-Frame Families

**Status:** **Baseline**

**Date:** 8 August 2026

**Phase:** P10B — Commercial Storefront Generation System v1 (**Partial / active**)

## 1. Outcome

P10B-06 establishes one canonical commercial shared-frame authority for the complete storefront.
The selected frame is stored once on `StorefrontSnapshot.sharedFrame` and is rendered around every
page rather than rebuilt inside individual pages. Legacy P9/P10A snapshots without that optional
root authority remain valid and migrate only through an explicit deterministic frame selection.

The delivery contains four complete structural frame profiles, three mobile navigation modes, and
four footer compositions. They consume the existing P10B-02 Design DNA, P10B-03 anatomy,
P10B-04 approved asset/art-direction validation where frame media exists, and P10B-05 canonical
page/navigation authority. They do not create another site map, navigation model, component
registry, frame token system, or template engine.

## 2. Canonical authority

```text
BrandSystem / Design DNA
  → registered shared-frame profile
  → ComponentDefinitionV2 header/footer commercial anatomy
  → meaningful header/footer variants and registered responsive transformation
  → bounded canonical frame sections
  → StorefrontSnapshot.sharedFrame
  → Puck editor root / preview / published renderer
```

The bounded planning/proposal authority binds the exact source snapshot ID, revision, content
fingerprint, profile ID, semantic version, and executable-authority fingerprint. Compilation
rejects a stale source before any projection, resolves current commercial-ready header and footer
anatomy through the generated capability manifest, applies one root frame, removes legacy
page-local frame sections, and validates the complete registered snapshot before returning a
result.

The snapshot continues to own the existing P10B-05 navigation and pages. Search and cart controls
appear only when the canonical page set contains those page families. Service/footer links come
only from canonical navigation. Frame code cannot invent routes, policies, locations, guarantees,
certifications, delivery statements, or service promises.

## 3. Complete frame systems

| Profile              | Desktop composition     | Header      | Mobile mode          | Footer composition       | Material structure                                                                                                                                |
| -------------------- | ----------------------- | ----------- | -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editorial-masthead` | Brand-led masthead      | `editorial` | `drawer`             | `brand-editorial`        | Centred high-emphasis brand, service strip when canonical service links exist, editorial primary navigation, and brand-dominant footer hierarchy. |
| `commerce-utility`   | Utility-led grid        | `split`     | `stacked-disclosure` | `service-navigation`     | Brand/navigation/utility grid, prominent commerce utilities, in-flow mobile disclosure, and service/navigation-led footer.                        |
| `centered-minimal`   | Centred brand stack     | `centered`  | `compact-overlay`    | `navigation-columns`     | Centred brand and navigation hierarchy, restrained utilities, modal overlay navigation, and balanced navigation columns.                          |
| `compact-technical`  | Compact navigation rail | `compact`   | `drawer`             | `compact-commerce-legal` | Dense single-rail desktop navigation, compact utilities, off-canvas mobile navigation, and compressed brand/navigation/legal footer flow.         |

Every profile has a distinct realized structural signature, semantic-region set, responsive
transformation set, mobile mode, and footer composition. Colour, class, padding, radius, and
alignment changes alone cannot qualify as another meaningful profile.

## 4. Mobile and footer authority

The three registered mobile modes are:

- `drawer`: an off-canvas dialog that contains navigation and available utilities, locks body
  scrolling, traps focus, closes with Escape, and restores focus to the trigger;
- `stacked-disclosure`: an in-flow disclosure region that leaves body scrolling available, closes
  with Escape, and restores trigger focus without an inappropriate modal focus trap;
- `compact-overlay`: a full-viewport compact navigation dialog with body containment, focus trap,
  Escape close, and trigger-focus restoration.

All modes use a labelled, keyboard-operable trigger and expose canonical primary navigation,
available search/cart destinations, and locale controls in logical DOM order. Desktop and mobile
layouts transform at registered breakpoints; they are not separate persisted navigation trees.

The four registered footer compositions are `brand-editorial`, `service-navigation`,
`navigation-columns`, and `compact-commerce-legal`. Each changes maintained hierarchy and region
arrangement. All links and labels are projected from canonical navigation and approved storefront
content.

## 5. Design DNA, media, and protected authority

Frames use the canonical Design DNA CSS-variable projection for semantic colour, typography,
page gutter, grid gap, section rhythm, container posture, surfaces, borders, controls, radius,
elevation, and navigation density. Applying a different Design DNA to the same profile preserves
its frame identity and anatomy while changing its coherent visual foundations.

The frame introduces no local token store. Approved frame media, if later assigned to a declared
header/footer asset slot, is validated by the existing P10B-04 placement, lineage, role, revision,
material-fingerprint, and responsive art-direction authority during publication compilation.
Canonical product media and protected commerce fields remain inaccessible to frame mutation.

## 6. Cross-page and lifecycle reachability

The deterministic capability chain is:

```text
registered profile and component anatomy
  → commercial-ready manifest query
  → source-bound shared-frame proposal and exact selection
  → deterministic compiler
  → StorefrontSnapshot.sharedFrame
  → save/reload
  → Puck root / preview / published rendering
  → deterministic publication artifact
```

One root frame identity is projected across home, collection/search, PDP, content/support, and
commerce utility page types. Page-local header, footer, or announcement authority is rejected after
migration. PageBlueprint profiles may reference or narrow the compatible shared-frame authority;
they cannot create another frame.

The publisher includes root-frame sections in renderer/component authority, approved-asset and
art-direction validation, protected-commerce validation, compilation, source fingerprinting, and
the compiled result. Save/reload and manual publication preserve the exact frame profile,
fingerprint, sections, and component executions.

## 7. Fail-closed behavior

Typed deterministic validation rejects:

- unknown or stale profile identity/version/fingerprint;
- a header/footer pairing that differs from the registered profile;
- a page-local frame section after root-frame materialization;
- missing canonical header/footer source sections during legacy migration;
- conflicting legacy page-local frame material that cannot be promoted without data loss;
- non-commercial-ready or non-meaningful anatomy selected as commercial authority;
- cosmetic-only structure presented as a meaningful variant;
- unknown or unapproved routes and links;
- invalid approved asset assignment, stale lineage, or incompatible responsive art direction;
- protected commerce or canonical product-media mutation.

Failure occurs before a compiled shared-frame result is returned. **Provider call count: zero.**

## 8. Evidence

### 8.1 Deterministic and lifecycle evidence

The focused P10B-06 suite proves four unique profiles, three mobile modes, four footer
compositions, commercial-ready manifest queries, realized structural distinction, cosmetic-only
rejection, exact authority and pairing validation, canonical navigation, absent-route omission,
cross-page identity, Design DNA independence, save/reload, deterministic publication, shared
editor/preview/published rendering, and legacy snapshot compatibility.

Existing P10B-03, P10B-05, PageBlueprint, registry, snapshot, publishing, and renderer regressions
remain part of the validation surface. The complete one-worker Vitest suite, production Webpack
build, and full repository Playwright suite are required before delivery.

### 8.2 Responsive, accessibility, and retained visual evidence

Browser evidence exercises every frame at 375, 768, 1024, and 1440 px, including EN/FI context,
landmarks, geometry, keyboard open/close, Escape, appropriate modal containment, and focus
restoration. Seven retained screenshots cover all four desktop systems and all three mobile modes:

- [`editorial-masthead-wide`](../tests/e2e/p10b-06-commercial-shared-frame-families.spec.ts-snapshots/editorial-masthead-wide-chromium-darwin.png)
- [`commerce-utility-wide`](../tests/e2e/p10b-06-commercial-shared-frame-families.spec.ts-snapshots/commerce-utility-wide-chromium-darwin.png)
- [`centered-minimal-wide`](../tests/e2e/p10b-06-commercial-shared-frame-families.spec.ts-snapshots/centered-minimal-wide-chromium-darwin.png)
- [`compact-technical-wide`](../tests/e2e/p10b-06-commercial-shared-frame-families.spec.ts-snapshots/compact-technical-wide-chromium-darwin.png)
- [`drawer-mobile`](../tests/e2e/p10b-06-commercial-shared-frame-families.spec.ts-snapshots/drawer-mobile-chromium-darwin.png)
- [`stacked-disclosure-mobile`](../tests/e2e/p10b-06-commercial-shared-frame-families.spec.ts-snapshots/stacked-disclosure-mobile-chromium-darwin.png)
- [`compact-overlay-mobile`](../tests/e2e/p10b-06-commercial-shared-frame-families.spec.ts-snapshots/compact-overlay-mobile-chromium-darwin.png)

The retained images were inspected as P10B-06 structural commercial evidence. They establish
material frame differences and absence of developer/placeholder frame chrome; they do not claim
P10B-18 final multi-store commercial approval.

## 9. Status and non-goals

P10B-06 is **Baseline**. P10B remains **Partial / active**, and P10B-07 through P10B-18 remain
**Planned**.

This task does not implement P10B-07 content families, P10B-08 product-card consolidation,
P10B-09+ profile libraries, P10B-15 synthesis, P10C merchant frame controls, or Vesko integration.
It does not add provider behavior or call an AI provider.

## Current P10B-17 continuation

P10B-17 strengthens the same four frame systems rather than registering another frame. The shared
renderer now supplies a visible-on-focus skip link, server-derived current-page indication,
semantic language controls, bounded navigation targets, and the paired Design DNA focus treatment.
Focus-trapping mobile modes use the registered drawer/overlay authority, make background content
inert, expose dialog semantics, close with Escape or navigation, and restore focus; non-trapping
modes retain their registered behavior. Mobile search and navigation placement remains frame-owned
and changes at the existing responsive boundaries.

Current-page identity is transient renderer context derived from the canonical page/path
projection, not browser or snapshot state. No navigation graph, registry, snapshot, commerce, or
media authority changed. P10B-18 still owns repeated end-to-end commercial frame quality at scale.

## Current P10B-18B-01 continuation

**Acceptance state:** **Baseline**. The product owner accepted P10B-18B-01 on 17 August 2026. This
continuation does not change the accepted P10B-06 Baseline; parent P10B-18B is **Partial**, while
P10B-18 and P10B remain **Partial**.

The accepted implementation retains shared-frame authority `1.0.0` and the same four exact identities:
`editorial-masthead`, `commerce-utility`, `centered-minimal`, and `compact-technical`. It adds no
fifth frame, navigation model, breakpoint registry, persisted responsive state, frame-local token
store, header/footer variant, or migration.

The frozen P10B-18A complete-store exclusion for `compact-technical` came from four exact profile
admissions. Accepted compatibility adds that frame only to:

- `content-about-story`;
- `commerce-utility-checkout`;
- `commerce-utility-empty`; and
- `commerce-utility-not-found`.

The full required audit site map then admits bounded `compact-technical` candidates for Modern
Technical. Direct deterministic evidence materializes the complete store and server-renders each of
the four former blockers inside the compact root frame with non-empty main content. The focused browser
matrix visually exercises the compact frame on home and collection at 375 and 1440 only; it does
not claim focused browser or human review of those four content/utility surfaces. Existing
PageBlueprint, renderer, navigation, commerce-utility runtime, and root-frame contracts remain the
consumer authority rather than broadened metadata alone.

The same frame renderer receives bounded CSS refinements rather than new anatomy. Accepted evidence
checks:

- the editorial wide-navigation stress store retains at least ten canonical links, at least 70
  label characters, and a label of at least 18 characters; its inspected links stay on one measured
  line at both 1024 and 1440 with zero detected destructive link labels across the full capture set;
- the utility-led wide footer retains every canonical store-page and information link while its
  measured height remains at most 420 pixels;
- the centered-minimal wide composition has a renderer-visible content transition; and
- the Premium editorial mobile footer wordmark remains one line without measured overflow.

The focused accepted record contains seven materialized stores and 17 captures: 12 primary
direction/home-or-collection/375-or-1440 captures, three alternate-DNA 1440 home captures, and the
two long-navigation captures. It includes all four exact frame identities and confirms registered
mobile-mode/footer composition on the captured surfaces, but it does not replace the original
P10B-06 four-width structural evidence or the frozen P10B-18A denominators. All seven drafts retain
their exact root frame, snapshot, Design DNA, commerce, and media authority through persistence and
reload. The checkpoint records zero external, provider, Vesko, browser generation-endpoint, or
publication requests and zero browser runtime errors.
