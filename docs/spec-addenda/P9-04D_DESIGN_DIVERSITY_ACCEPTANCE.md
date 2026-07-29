# P9-04D — Objective design-diversity acceptance

## Specification status

This is a corrective Phase 9 addendum discovered during visual review of the 29 July 2026
real-AI Lumo storefront. It is not yet named in the authoritative SDD or roadmap. It clarifies
the existing P9 requirement, including AC-112 through AC-123 and especially AC-114, AC-117,
AC-118 and AC-122. The authoritative SDD and roadmap are intentionally unchanged by this task.

## Merchant objective

Using the same minimal project, catalogue, collections and approved assets, Vesko Storefront
Studio must produce three complete, coherent and recognizably different storefront directions:

1. Premium editorial.
2. Modern technical.
3. Warm approachable.

The acceptance gate must demonstrate different design systems and compositions, not one template
with palette or font substitutions.

## Objective pass standard

The evaluator compares each pair of directions. Every pair passes only when all of these are true:

- homepage structure and section order differ materially;
- collection discovery and collection-page presentation differ;
- PDP gallery, information and option presentation differ;
- at least two non-colour design-system groups differ;
- the homepage, collection page and PDP identify the same direction and remain internally coherent;
- the same protected catalogue identities, SKUs, prices and other commerce truth remain unchanged;
- only approved assets are used;
- EN and FI presentations are present without fixture or internal-ID leakage;
- all required content-count and responsive cases have no unexplained empty layout area.

The non-colour groups are typography, spacing/density, shape/radius,
border/surface/elevation and image treatment. Typography may contribute one group, but a font-only
change cannot pass. A palette-only change, a font-only change, or a single rearranged section fails
because collection and PDP presentation must also differ.

## Structural fingerprint

The test harness creates an exact canonical fingerprint from normalized:

- homepage section structure, order, hero family and navigation treatment;
- collection composition, discovery treatment and product-card family;
- PDP composition, gallery, information and option treatment;
- design-system groups;
- responsive compositions at 375, 768, 1024 and 1440 px;
- EN and FI presentation identities.

Colour remains fingerprinted for exact auditability but cannot satisfy the non-colour threshold.
Protected commerce is fingerprinted separately and must be equal across all directions.

## Screenshot and content matrix

The visual runner receives a deterministic 72-case matrix:

```text
3 directions × 3 pages × 2 locales × 4 viewports = 72 screenshots
```

Pages are homepage, collection and PDP. Viewports are 375, 768, 1024 and 1440 px. Each direction
also runs with one collection, multiple collections, a small product count, a larger product
count, and missing optional hero or collection media. Optional missing content must collapse
cleanly; reserved blank bands, unexplained gaps and horizontal overflow fail.

## Merchant-facing real-AI rubric

The later real OpenAI evaluation records **Pass**, **Fail**, or **Not observable**, plus a concise
merchant-facing note, for each row:

| Area                | Merchant question                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Overall recognition | Could a merchant distinguish each direction without seeing its name?                          |
| Homepage            | Do structure, order, hero, navigation, story, trust and campaign treatment fit the direction? |
| Collection          | Are discovery, filters, density and product cards materially composed for the direction?      |
| PDP                 | Are gallery, product information and options materially composed for the direction?           |
| Design system       | Do type, spacing, shape, surfaces and imagery form one coherent system beyond colour?         |
| Responsive          | Does the direction remain recognizable and free of dead space at all four widths?             |
| Content counts      | Do one/many collections, small/large catalogues and missing optional media reflow naturally?  |
| Localization        | Do EN and FI retain the same design intent without internal terminology or IDs?               |
| Assets              | Are approved assets used purposefully, without fixture leakage?                               |
| Commerce            | Are canonical IDs, SKU, price, availability and other protected facts identical?              |
| Completeness        | Is the storefront usable without manual work to complete most pages?                          |

Any required row marked **Fail** or **Not observable** fails final acceptance. Screenshot evidence
must be linked to the corresponding matrix identity.

## Initial and final integration phases

The initial parallel phase owns only test infrastructure: the deterministic evaluator, synthetic
known-distinct and known-too-similar fixtures, exact fingerprint logic, screenshot matrix and this
rubric. It does not change production components, CSS, registry, planner, compiler, session,
editor, localization or accessibility code.

After W1–W3 merge, the branch must merge the latest `origin/main` without rebasing, connect these
facts to the real deterministic generation paths, add final integrated assertions, capture the
matrix and run the complete Phase 9 gate. A discovered product gap is reported rather than fixed
silently in this acceptance PR.
