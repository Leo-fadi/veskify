# P3-07 — Onboarding Existing Storefront Source

## Merchant outcome

At O-03, a redesign merchant can enter the current storefront address, continue to O-04 Brand assets,
go back, refresh and resume with the same saved URL. New-storefront and demo merchants see a clear
no-source explanation and can continue without entering an address.

## Path-aware behavior

O-03 uses the canonical `designBrief.creationContext.type` synchronized by O-01. A redesign requires
`creationContext.existingStorefrontUrl` for completion. New-storefront and demo-storefront paths keep
that field `null` and complete O-03 without a URL. O-03 remains optional, so Skip advances to O-04
without inventing source data.

## URL safety and canonical ownership

The service trims input, adds `https://` to a bare domain, accepts only a complete HTTPS URL, and
rejects insecure, unsupported or malformed protocols without persisting them. The canonical
`safeExternalUrlSchema` remains the final validator. Only
`StorefrontDesignBrief.creationContext.existingStorefrontUrl` is persisted; no onboarding-specific
URL schema, source record, browser value or localStorage write was added.

The URL is never fetched, crawled, inspected, screenshot, analysed or sent to a provider. Switching
away from redesign clears it through the existing immutable creation-context update. Switching back
does not invent or restore the previous value.

## Persistence, queue and recovery

URL blur saves, O-03 completion, Back, Continue, Skip, path changes and reset all use the existing
wizard-level `OnboardingMutationQueue`. Each mutation reads the latest session at execution time, so
a focused URL edit followed immediately by Back persists the edit before navigation. Storage failures
pause stale queued work and use the existing retry state; retry reopens the queue. Programming errors
remain visible to the application rather than being converted into storage failures.

## Explicitly deferred

This slice does not add social-profile fields, uploads, website fetching, metadata or screenshot
analysis, AI analysis, catalogue ingestion, templates, projects, pages, Puck, proposals, publishing or
history. O-04–O-09 remain controlled deferred steps.
