# P8-04 — AI-ready premium storefront visual system

## Purpose

P8-04 adds a bounded, reusable visual system for high-value retail storefronts. It gives the
controlled design agent a small set of premium directions and component layouts without allowing
merchant-specific React, arbitrary CSS, remote media URLs or changes to canonical commerce data.

## Approved visual presets

The shared `BrandSystem` can optionally carry one strict visual-system record. Existing stored brand
systems remain valid when it is absent; renderers use the Premium editorial defaults in that case.

| Preset             | EN label          | FI label                 | Direction                         |
| ------------------ | ----------------- | ------------------------ | --------------------------------- |
| `premiumEditorial` | Premium editorial | Ensiluokkainen editorial | Wide, layered, editorial imagery  |
| `modernMinimal`    | Modern minimal    | Moderni minimalismi      | Quiet, contained, restrained      |
| `futureLuxury`     | Future luxury     | Tulevaisuuden luksus     | High-contrast, cropped, assertive |

The visual-system schema accepts only a preset, content width, surface, divider, button hierarchy,
image treatment and theme. It rejects arbitrary CSS and unknown fields.

## Reusable component directions

- Header: centered, split, compact, transparent and editorial navigation.
- Hero: editorial, full-bleed, asymmetrical and restrained V1 compositions; the V2 homepage hero
  additionally supports full-bleed overlay, asymmetrical and restrained layouts with bounded
  contrast and content-width controls.
- Collection commerce: standard, editorial, compact and gallery treatments.
- Dynamic PDP: balanced, editorial, compact, gallery-dominant and editorial-split layouts with
  contained, cropped or editorial canonical-media treatment.
- Footer: column, expanded, editorial, compact and dark treatments.

All controls remain registered component variants or strict enum fields. Canonical product identity,
SKU, price, compare-at price, availability, options, media provenance and collection membership stay
read-only.

## Karvonen demonstration composition

Karvonen uses the `premiumEditorial` shared visual direction and generic editorial/full-bleed/dark
registered variants. Its independently owned pages, navigation, assets and canonical catalogue stay
unchanged; the update does not share Aurum objects or add Karvonen-specific component code.

## Responsive and accessibility contract

The affected registered components retain their no-horizontal-overflow responsive contracts at 375,
768, 1024 and 1440 pixels. Existing semantic headings, native navigation, gallery controls, option
controls, visible focus treatment and localized accessible labels remain the rendering boundary.

## Requirement traceability

- SDD sections 9.1–9.8, 11.1–11.3 and 13.1–13.3.
- FR-102, FR-106, FR-107, FR-109, FR-110, FR-111, FR-112 and FR-114.
- NFR-101, NFR-102, NFR-103, NFR-108 and NFR-109.
- AC-105, AC-108, AC-110, AC-111, AC-112, AC-118, AC-122 and AC-123.
- ADR-002 and ADR-004.
