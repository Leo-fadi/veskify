# P2-04 deterministic design operations

This slice implements SDD §§12.6–12.9, 15.4–15.6 and 16.4 as pure canonical page operations and an
in-memory proposal lifecycle. It deliberately contains no React UI, Puck UI, persistence, publishing
workflow or AI provider.

## Public API

`@/application/design-operations` exports:

- `designOperationSchema` and each individual operation schema;
- `applyDesignOperation(page, operation, context)`;
- `applyDesignOperations(page, operations, context)`;
- `homepageRedesignIntentSchema` and `generateHomepageRedesign(page, intent, context)`;
- `designProposalSchema` and `proposalValidationResultSchema`;
- `InMemoryDesignProposalStore` with `create`, `inspect`, `accept` and `reject`;
- `createLuxuryCampaignHomepageProposal(page, context, store?)` as the deterministic command example.

The context supplies catalogue and navigation references for semantic registry validation; it is not
part of the returned page or proposal model.

## Operation contract

Every operation parses strict structured input, clones the canonical page, applies one approved
change and validates the result through `PageModel` plus the component registry. The supported types
are:

- `CHANGE_LOCALIZED_SECTION_TEXT`
- `CHANGE_SECTION_VARIANT`
- `CHANGE_BACKGROUND`
- `CHANGE_TYPOGRAPHY`
- `CHANGE_DENSITY`
- `CHANGE_SHAPE`
- `CHANGE_ALIGNMENT`
- `CHANGE_CTA_STYLE`
- `APPLY_APPROVED_BRAND_COLOURS`
- `ADD_APPROVED_SECTION`
- `REMOVE_OPTIONAL_SECTION`
- `REORDER_SECTIONS`

Section addition starts from registered defaults and therefore cannot inject product identity,
price, SKU, stock or catalogue media. Localized text changes are limited to registry-declared
localized content fields. Header and footer removal or invalid reordering is rejected.

## Proposal contract

Proposal IDs are stable hashes of canonical input plus the ordered operation list. The store is
process-local and returns clones so callers cannot mutate stored proposal state. Accept revalidates
and returns the proposed page; reject returns a clone of the original page. Neither action persists or
publishes anything.
