# P2-02 storefront design vocabulary

This slice implements the controlled storefront vocabulary described by Veskify SDD §§8.1–8.5,
9.1–9.5, 10.1–10.3, 11.5, 14, 15.5–15.6, 16.5 and 16.7. It extends the canonical component
registry and renderers; it does not introduce an agent-operation layer, editor-shell ownership, or
another page representation.

## Variant contract

| Section             | Controlled variants                  |
| ------------------- | ------------------------------------ |
| Announcement bar    | `singleLine`, `minimal`, `bold`      |
| Store header        | `centered`, `split`, `compact`       |
| Featured categories | `editorialCards`, `grid`, `imageLed` |
| Product grid        | `editorial`, `standard`, `compact`   |
| Campaign banner     | `split`, `imageOverlay`, `minimal`   |
| Image and text      | `imageRight`, `imageLeft`, `stacked` |
| Brand story         | `editorial`, `minimal`, `imageLed`   |
| Benefits            | `threeColumn`, `minimal`, `cards`    |
| Newsletter          | `inline`, `card`, `fullWidth`        |
| Footer              | `columns`, `editorial`, `compact`    |

Each variant changes layout, emphasis, or content balance. Variant names are registry values and must
be validated against the section definition before rendering or entering canonical page state.

## Token and control contract

The later deterministic operation layer may select only these schema-owned values:

- `background`: `inherit`, `background`, `surface`, `primary`, `secondary`, `accent`
- `density`: `compact`, `standard`, `spacious`
- `typography`: `inherit`, `serif`, `sans`, `strong`
- `shape`: `inherit`, `square`, `soft`, `rounded`
- `alignment` where applicable: `left`, `center`
- `ctaPresentation` where applicable: `primary`, `secondary`, `text`

These are local, controlled presentations of the global brand CSS variables. They never accept raw
CSS, arbitrary colour values, font names, markup, or executable content. Responsive behavior remains
renderer-owned.

## Content and commerce boundary

Localized copy remains `LocalizedText` and follows the EN/FI fallback contract. Approved media stays
inside `AssetRef` schemas and the shared safe storefront-image boundary. Catalogue-backed section
references remain protected: product identity, SKU, price, stock and product media are not editor
fields and cannot be supplied through section props. Delivery, returns and commerce interactions stay
clearly labelled demo presentation only.

The future deterministic operation layer should call the registered definition's `validate` method
with the target `PageType`, then persist the resulting canonical `SectionInstance`. It must not call
renderers directly or write Puck data as a second page tree.
