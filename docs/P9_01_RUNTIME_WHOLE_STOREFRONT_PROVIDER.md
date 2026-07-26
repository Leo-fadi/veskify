# P9-01 Runtime Whole-Storefront Planning Provider

## Former gap

The editor previously created its whole-storefront provider in the browser. That made the deterministic legacy provider the implicit runtime path and left the server-only planner without a merchant-editor call site.

## Runtime boundary

The editor now uses the browser-safe `ServerWholeStorefrontPlanningClient` for its default whole-storefront provider. It posts the existing validated proposal envelope to `/api/ai/whole-storefront-proposals`. The route selects the server-only planner, resolves authoritative planning input, verifies the canonical project action and returns the existing proposal envelope for review. No provider selection, credential or server function crosses into the client bundle.

## Selection and deterministic operation

The server route uses `selectServerWholeStorefrontPlanningProvider`. A configured provider failure returns the existing merchant-safe unavailable result; it never falls back to a deterministic planner. Deterministic providers remain explicit injections for standalone/demo operation and focused tests.

## Request, result and authorization

The browser submits only the validated proposal request, including project/draft identity, target, locale, fingerprinted draft context and approved asset references. The authority supplies the approved brief, registry and canonical commerce projection, validates revision/current input, and requires `request-ai-design`. Read, restore and publish authority alone cannot request AI design.

## Errors and non-goals

Malformed, stale, unauthorized and unavailable requests are normalized to merchant-safe route responses. The boundary does not expose credentials, raw provider failures or unrestricted repository state. It does not alter section/page proposals, commerce data, publishing, or the editor’s existing review, confirmation, undo/redo and save-draft lifecycle.
