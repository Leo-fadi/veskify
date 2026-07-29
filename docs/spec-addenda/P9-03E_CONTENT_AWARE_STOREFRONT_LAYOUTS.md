# P9-03E — Content-aware storefront layouts

## Specification status

P9-03E is a corrective Phase 9 addendum discovered during visual review of the real-AI Lumo
Atelier storefront on 29 July 2026. It refines the existing responsive and whole-storefront quality
requirements in P9, AC-112 and AC-122 for variable content counts. It does not replace or modify the
authoritative SDD or roadmap.

The observed storefront supplied one canonical collection to a discovery section whose default
composition reserved space for multiple cards. The content was correct, but the unused layout track
created an accidental half-page gap. This addendum makes the expected 0/1/2/3/many-item behaviour
explicit.

## Merchant outcome

Collection discovery and product presentation remain visually deliberate when a merchant has one
item, two items, three items or a larger catalogue. A smaller canonical result set must not look
unfinished merely because a registered component supports more columns.

## Content-count rules

Layout is derived only from the ordered canonical collection or product references already supplied
to the registered section. Item count is presentation state; it does not change IDs, membership,
ordering, prices, stock, variants, media or other commerce truth.

### Collection and category discovery

| Canonical item count | Required composition                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0                    | Render the approved localized empty state or omit the optional section. Do not render a broken or empty card container.                                                                              |
| 1                    | Use the available content width intentionally. A card with rendered canonical media may use a single editorial split; a text-only or media-omitted card remains a full-width one-column composition. |
| 2                    | Use a balanced split composition.                                                                                                                                                                    |
| 3                    | Use a balanced three-item composition at tablet and larger widths, while retaining a readable single-column mobile flow.                                                                             |
| 4 or more            | Preserve the registered grid or carousel behaviour and its responsive rules.                                                                                                                         |

Grid and carousel variants remain controlled registered variants. Count-aware behaviour is
automatic and must not introduce a new merchant-editable or AI-generated layout value.

### Product grids

The effective desktop column count is the lower of:

1. the registered section's controlled column setting; and
2. the number of canonical products currently rendered.

Responsive caps still apply at smaller widths. Empty collections render their localized empty state.
Dynamic collection grids may use `auto-fit` tracks when that preserves the same controlled card
family and avoids reserving tracks for absent products. A partial final row in a larger result set is
normal responsive flow; a fixed empty track beside a result set smaller than the configured column
count is an accidental layout hole.

## Media and text safety

- Use only the canonical media selected for the corresponding product or collection.
- Missing optional media uses the component family's existing approved placeholder or omission
  behaviour.
- Do not invent an image, substitute another product's image or change asset provenance.
- Long Finnish and English headings, labels and descriptions wrap within their card or section.
- Count-aware composition must not clip text, controls or media at 375, 768, 1024 or 1440 px.

## Rendering parity

Editor canvas, saved preview and published storefront routes must resolve the same registered
implementation and the same count-derived composition. Rendering target may change route chrome,
but it must not change card count, canonical order, media ownership or effective layout.

## Accessibility

- Existing section heading relationships and card semantics remain intact.
- Empty states remain understandable localized text.
- Interactive card controls retain visible focus and keyboard operation.
- Content reflow must not create horizontal page scrolling or reduce required touch targets.
- Long localized text remains available to assistive technology without truncation.

## Acceptance criteria

1. One collection fills its available content region intentionally.
2. Two and three collection cases use balanced compositions.
3. Four-plus collection grids and carousels retain their registered responsive behaviour.
4. Product grids do not reserve empty columns when the result count is below the configured column
   count.
5. The 0/1/2/3/many cases remain usable at 375, 768, 1024 and 1440 px.
6. Editor, preview and published routes use the same implementation.
7. Long EN and FI text wraps without clipping or horizontal overflow.
8. Missing optional media retains its approved fallback and provenance rules.
9. Product identity, collection membership, ordering and commerce values remain unchanged.
10. No schema, free-form AI layout value or arbitrary generated CSS is introduced.

## Visual evidence

- [One-item editorial composition at 1440 px](screenshots/p9-03e/content-aware-1-item-1440px.png)
- [Two-item split composition at 1024 px](screenshots/p9-03e/content-aware-2-item-1024px.png)
- [Many-item responsive composition at 768 px](screenshots/p9-03e/content-aware-many-768px.png)

## Scope boundaries

P9-03E changes presentation only. It does not change the editor shell, AI request bridge, session
authority, planner, proposal compiler, component registry contracts, dynamic commerce schemas,
product identity, collection membership, catalogue projection or authoritative SDD and roadmap.
