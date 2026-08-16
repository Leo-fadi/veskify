# P10B-07 — Hero, Editorial, Campaign and Proof Families

**Status:** Baseline

**Date:** 8 August 2026

**Dependencies:** P10B-01 commercial grammar, P10B-02 Design DNA, P10B-03 commercial anatomy,
P10B-04 responsive image/art direction, and P10B-05 PageBlueprint/page-family authority.

**Provider calls:** Zero

## Outcome

P10B-07 establishes reusable commercial first-impression and storytelling families through the
existing canonical chain:

```text
P10B-01 grammar
  → P10B-02 BrandSystem / Design DNA
  → P10B-03 component anatomy and meaningful variants
  → P10B-04 responsive image/art direction
  → ComponentDefinitionV2 registry and generated capability manifest
  → existing PageBlueprint profiles
  → deterministic whole-storefront plan and proposal
  → StorefrontSnapshot
  → shared editor / preview / published renderer
```

No second component registry, template-specific hero renderer, media authority, page graph, proof
store or provider path was added.

## Audited and retained authority

The implementation reuses the existing `homepageHero`, `homepagePromotion` and
`homepageTrust` families, their V1 renderer bridge, the V2 registry, homepage PageBlueprint slots,
the whole-storefront planner, approved source-asset placement, and the shared semantic homepage
renderer. Shallow legacy hero identifiers remain compatibility aliases; they are loadable but do
not count as new commercial anatomy.

Two new reusable V2 families close the missing storytelling coverage:

- `homepageEditorial` owns image/text, brand story, craft/process, lookbook/gallery and
  continuation compositions;
- `homepageProof` owns quote spotlight, proof grid and service assurance, with protected
  evidence-bearing proof items.

The generated component capability manifest is version `1.3.0`. It contains 27 current V2
definitions and 100 classified variants. Only variants with validated realized structural
differences are queryable as meaningful commercial-ready P10B-07 capability.

## Six meaningful hero anatomies

| Variant                 | Maintained structural difference                                         | Responsive transformation |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------- |
| `editorialSplit`        | Copy-led split with separate media and inline actions                    | `splitToStack`            |
| `imageLed`              | Media-first hierarchy and media-led content relationship                 | `mediaFirstStack`         |
| `fullBleedOverlay`      | Media owns the frame; copy and action overlay it                         | `overlayToContained`      |
| `asymmetric`            | Unequal media/content frame and asymmetric hierarchy                     | `asymmetricReflow`        |
| `restrained`            | Copy-first anatomy with media omitted                                    | `restrainedCondense`      |
| `campaignMerchandising` | Campaign eyebrow/merchandising region with separated action relationship | `campaignReflow`          |

The `editorial`, `fullBleed`, and `minimal` identifiers are explicit compatibility aliases for
legacy stored state. They contribute zero to the six-variant minimum. A colour, padding, border,
radius or other finishing-only change cannot satisfy the meaningful query.

## Editorial, campaign, service and proof coverage

`homepageEditorial` registers five meaningful presentation modes:

- `imageText` for balanced approved imagery and copy;
- `brandStory` for media-first brand narrative;
- `craftProcess` for approved process steps with compact mobile rhythm;
- `lookbookGallery` for up to three approved assets and mobile/tablet carousel transformation;
- `continuationCta` for copy-led continuation with the media region intentionally absent.

`homepagePromotion` now has explicit meaningful anatomy for split, overlay, minimal, editorial and
image-led campaign presentations. `homepageTrust` remains the reusable non-proof service/value
family. `homepageProof` adds quote spotlight, proof grid and service assurance without duplicating
trust or commerce authority.

Page compatibility is deliberately bounded. Heroes support home and landing pages; promotions
support home, landing and legitimate collection campaigns; editorial stories support home,
collection, content and landing pages; proof supports home, content and landing pages. Generated
capability queries reject incompatible page families and narrative roles.

## Evidence and proof safety

Each proof item contains a canonical `PageFactEvidenceReference` with source, authority, revision,
approval authority and approval fingerprint. `content.items` is protected read-only component
content, but its embedded approval fields never establish current authority. Generation derives
the current brand fact from the approved Storefront Design Brief, while render and publication
conformance require the exact reference to resolve in a separately supplied current-evidence
projection. The server runtime transports that projection beside the validated proposal envelope,
and the editor consumes it by proposal identity; provider output and embedded proof content cannot
populate this authority. A changed revision, revoked approval or changed fingerprint therefore
fails closed.

`resolveHomepageProofContent` expresses the registered omission/failure contract:

- optional proof returns omission when the current approved evidence set is empty;
- required proof fails closed;
- malformed, unapproved, stale, superseded or absent evidence cannot validate as proof content;
- reviews, awards, certifications, guarantees, service promises or other unsupported facts are
  never supplied by registry defaults.

## Art direction and Design DNA

Hero and editorial assignments accept only approved `heroDesktop`, `heroMobile` or
`editorialImage` roles. The renderer passes the canonical P10B-04 authority to
`ResponsiveStorefrontImage`, retaining source lineage, safe area, breakpoint focal/crop treatment,
ratio, overlay and approved derivative identity. Legacy direct-image CSS fallback is scoped so it
cannot override explicit art-direction `object-fit` and focal-point rules.

All layout finishing uses the existing P10B-02 CSS-variable projection. The families maintain no
local palette, font stack, spacing scale or media defaults. Changing merchant Design DNA changes
the coherent expression while leaving anatomy fingerprints stable.

## Generation and lifecycle reachability

Existing homepage PageBlueprints now select the registered hero, editorial, campaign and proof
families. The deterministic planner:

- replaces compatible legacy hero/story/campaign sections without discarding approved content;
- selects up to three compatible approved story assets;
- materializes exact asset bindings and placement operations;
- omits optional imagery/evidence sections under registered conditions;
- reconstructs proof from the current approved brief rather than carrying stale claims;
- validates narrative role, page family, anatomy, bindings, asset roles and cardinality before a
  proposal can be accepted.

Focused evidence proves the families are planned, proposed, accepted, projected into the canonical
`StorefrontSnapshot`, saved/reloaded, and preserved by deterministic publication compilation. The
editor, preview and published targets use the same registered renderer functions.

The snapshot projector was narrowed to correlate multiple assignments by both slot and asset ID;
this preserves multi-image lookbooks without weakening single-slot or placement validation.

## Validation evidence

The focused P10B-07 suite contains 18 passing tests covering the 17 locked cases plus explicit
PageBlueprint selection. It proves:

1. six meaningful hero compositions;
2. six distinct structural fingerprints;
3. compatibility aliases do not inflate the meaningful count;
4. story/editorial readiness;
5. campaign readiness;
6. approved proof grounding;
7. optional omission and required fail-closed behavior;
8. responsive art-direction preservation;
9. wrong asset-role rejection;
10. narrative incompatibility rejection;
11. page-family incompatibility rejection;
12. deliberate responsive transformation identity;
13. Design DNA inheritance with stable anatomy;
14. deterministic planning/proposal/acceptance/storage;
15. save/reload and publish preservation;
16. editor/preview/published renderer identity;
17. legacy compatible state remains loadable;
18. canonical PageBlueprint reachability.

The dedicated Chromium scenario generates the credible approved Lumo storefront fixture and
retains screenshots at 375, 768, 1024 and 1440 px. At every width it verifies the full-bleed hero,
campaign, two-image lookbook, approved proof authority, responsive transformation identity,
art-direction fingerprint and absence of horizontal overflow. Browser/page errors and external
provider requests are both asserted empty.

This is deterministic browser evidence, not retained human commercial acceptance. P10B remains
Partial; P10B-06 and P10B-08 through P10B-18 remain Planned.

## Non-goals retained

- No P10B-06 shared-frame implementation.
- No P10B-08 canonical product-card work.
- No P10B-09 six-profile homepage library.
- No P10B-12 complete content/support profile library.
- No P10B-15 synthesis engine.
- No generated claims, generated media, provider call or production CDN transform.

## Current P10B-17 continuation

P10B-17 makes the existing homepage hero, campaign, editorial, lookbook, proof, and continuation
anatomies execute their registered mobile/tablet transformation IDs instead of inheriting generic
layout changes. The current families now bound media and copy, stack or reorder only where the
selected anatomy permits it, keep campaign and proof controls usable, and disable carousel motion
and snap behavior under reduced-motion preference. Exact narrative roles, approved evidence,
assets, surfaces, and art direction remain unchanged.

This adds no family, variant, PageBlueprint, registry, or copy authority and does not mutate the
snapshot, commerce, or media. P10B-18 retains the cross-store commercial storytelling and visual
quality gate.
