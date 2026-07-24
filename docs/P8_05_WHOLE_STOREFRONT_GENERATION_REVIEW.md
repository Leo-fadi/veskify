# P8-05 — Whole-storefront generation and review

## Merchant flow

In the existing Storefront Studio assistant panel, a merchant chooses one of three clear targets: a selected section, the current page, or the entire storefront. A whole-storefront request keeps the active draft unchanged while the assistant prepares a reviewable proposal.

The review stays in the same contextual panel and canvas. It summarizes shared storefront direction, page-level changes, the planned scope and protected commerce boundary. A merchant may open any referenced existing page from the review; the canvas remains explicitly labelled as a proposal preview and no proposal operation is applied by navigation.

## Request preconditions and orchestration

The request boundary uses canonical project/draft identity, the active storefront projection, supported locales, registered components, canonical catalogue presentation data and approved source-asset context where available. It does not send editable HTML, CSS, scripts or protected commerce facts as generated instructions.

Generation remains provider-independent. The deterministic provider supports the editor without credentials. Provider failure, invalid output, stale context and unsupported requests are converted to merchant-safe states; the active draft, history and published snapshot are unchanged. A request in progress is deduplicated and keeps the original merchant instruction for a safe retry.

The P8-03 planning-provider adapter is intentionally not duplicated here. When its branch is merged, configured providers use that provider boundary for approved-brief whole-storefront plans.

## States and review

The panel communicates ready, generating, review-ready, failed, stale and provider-unavailable paths with localized EN/FI language. It never reveals provider payloads, implementation identifiers or stack traces.

The review uses progressive disclosure for page changes and also communicates product/collection connections, approved source assets, warnings and the canonical commerce facts preserved by the proposal: products, collections, SKUs, prices, stock and availability, variants and option truth, and canonical product media.

## Confirmation and atomic application

Selecting **Accept and apply** opens a keyboard-accessible confirmation dialog. It states that multiple pages and shared storefront design will change as one unsaved draft transaction. Focus enters the dialog and returns to the trigger when the merchant keeps reviewing.

Only the dialog’s explicit confirmation applies the validated proposal. Rejection and Close leave the active draft unchanged. Stale, duplicate and failed application attempts are blocked by the proposal lifecycle. A successful application refreshes the editor while retaining the selected project and records one composite storefront-history entry.

Undo and Redo therefore restore the complete whole-storefront change in one step. Saving remains separate from applying and publishing remains separate from saving.

## Layout and accessibility

Desktop uses the existing contextual assistant panel; compact layouts use the same existing drawer. No additional permanent sidebar, inspector or canvas is created. Review sections use native disclosure controls and page-preview actions are keyboard operable. Status, progress, confirmation and focus behaviour have semantic labels rather than relying on colour alone.

## Non-goals

This slice does not add a planning provider, provider-specific OpenAI adapter, arbitrary generated code, media ingestion/storage, crawling, onboarding redesign, publishing changes, catalogue mutation, checkout, payment or logistics functionality.
