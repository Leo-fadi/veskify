# P9-04C — AI review accessibility and EN/FI localization

## Merchant-safe review mapping

The editor review panel renders localized page, section, component-family, variant, operation,
asset and warning summaries through the existing presentation mappers. Canonical proposal,
request, page and component identifiers remain in controller state and data attributes only; they
are not serialized into visible review copy. Custom merchant page titles and catalogue content
are passed through unchanged. Missing operation/component localization uses a human-readable
merchant fallback and never exposes an internal ID.

## English and Finnish behavior

Review states, scope labels, operation summaries, confirmation actions, warnings, retry guidance,
stale/superseded states and provider failures have explicit English and Finnish strings. The
active interface locale selects those labels while merchant-provided titles and product content
remain source content.

## Keyboard and dialog semantics

Native buttons, radios, forms and disclosure summaries provide activation with Enter and Space.
The proposal heading receives focus when review opens. The whole-storefront confirmation uses a
named modal dialog with `aria-modal`, focuses its heading, traps Tab/Shift+Tab within its actions,
closes on Escape and restores focus to the initiating Accept control. Loading and failures use
status/alert semantics already exposed by the assistant panel.

## Structured errors and history

Validation, stale, superseded, permission and provider failures retain their controller state and
localized guidance; retry is offered only when the controller marks generation retry as safe.
Accept, reject, close, undo and redo continue to use the existing history transaction boundary.
Reopening the assistant therefore presents the current localized labels without changing proposal
history behavior.

## Remaining integration checkpoint

Final staging acceptance still depends on the complete editor integration suite and production
provider contract. This task does not alter the editor shell, planner/compiler, renderers,
registry IDs, commerce adapters or history implementation.
