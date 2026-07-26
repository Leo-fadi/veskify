# P9-01 Runtime Whole-Storefront Planning Provider

## Former gap

The editor previously created its whole-storefront provider in the browser. That made the deterministic legacy provider the implicit runtime path and left the server-only planner without a merchant-editor call site.

## Runtime boundary

The editor now uses the browser-safe `ServerWholeStorefrontPlanningClient` for its default whole-storefront provider. It posts the validated proposal envelope to `/api/ai/whole-storefront-proposals`. The route resolves the server-owned project, draft, canonical merchant context, approved brief, registry and approved-asset context before selecting the planner. It reconstructs the target, grants and fingerprints from that state, verifies `request-ai-design`, and returns the existing proposal envelope for review. No provider selection, credential or server function crosses into the client bundle.

## Selection and deterministic operation

`VESKIFY_RUNTIME_MODE=standalone` explicitly selects the credential-free canonical Aurum Nordic and Karvonen seed authority plus the deterministic planner. `VESKIFY_RUNTIME_MODE=integrated` requires `VESKIFY_AI_PROVIDER=openai` before the server OpenAI planner is selected. Missing or incompatible runtime configuration returns `providerUnavailable`; it never defaults to deterministic planning. A configured provider failure also returns the merchant-safe unavailable result without fallback. Deterministic providers remain explicit injections for standalone/demo operation and focused tests.

## Request, result and authorization

The browser submits its request identity, instruction and concurrency claims. The server treats target, affected pages/sections, permission grants, draft baseline and fingerprints as untrusted claims: it rebuilds and checks them from the authoritative draft and supported locale before validating the returned envelope. Read, restore and publish authority alone cannot request AI design.

## Errors and non-goals

Malformed responses and requests map to non-retryable validation failures; authorization failures remain permission failures; stale planning results map to non-retryable stale responses; and provider outages remain retryable unavailable failures. The boundary does not expose credentials, raw provider failures or unrestricted repository state. It does not alter section/page proposals, commerce data, publishing, or the editor’s existing review, confirmation, undo/redo and save-draft lifecycle.
