# P7-05 — Approved source-asset handoff into storefront generation

## Purpose

P7-05 connects the P7-04 approved-asset projection to the controlled storefront-generation boundary. It is an application-layer handoff only: it does not add merchant UI, download remote binaries, create permanent media records, change publishing, or alter canonical catalogue media.

## Generation preconditions

Source assets can enter generation only when the persisted URL workflow has a current approved Storefront Design Brief. The handoff verifies the approved evidence fingerprint, the recorded asset-review fingerprint when present, current source scope, and the absence of unresolved required asset decisions. A changed material review set invalidates the old context. Legacy briefs without an asset-review fingerprint retain the P7-04 compatibility rule: they are usable only while the review has no material asset changes.

## Approved generation asset context

The provider-independent context contains only canonical references and safe review metadata:

- approved asset ID and canonical role;
- source-reference ID, revision, and material fingerprint;
- extraction provenance summary;
- merchant-reviewed localized alternative text and safe presentation metadata;
- merchant approval actor and reference.

It deliberately excludes source URLs, raw HTML, binary data, and provider-specific formats. Assets are ordered by ID and the context has a deterministic fingerprint.

Raw extraction locations remain in the P7-04 audit record. Before a provider receives an asset, the handoff deterministically reduces that detail to one controlled classification: `html-meta`, `open-graph`, `link-icon`, `image-element`, `css-style`, `merchant-upload`, or `other-safe-source-location`. URL-like, markup-like, script-like, control-character, and excessive free-form values never cross the boundary. Non-decorative assets require localized alternative text; decorative assets may use no alternative text.

## Roles and slots

Placement intents use `PLACE_APPROVED_SOURCE_ASSET` with page, component type, asset slot, asset ID, role, and requiredness. They are checked against `ComponentDefinitionV2.assetSlots` before a provider is invoked. Unknown assets, role mismatches, and incompatible slots fail safely. The intent is structured, reviewable, and reversible; it is not a new renderer, component, or UI surface.

Each placement also identifies the active component instance and exact approved asset revision, material fingerprint, and source reference. Validation proves that the affected page is in the active generation scope and that the named visible component instance and slot exist there. Required placements are carried into the provider proposal change set and cannot be omitted or altered by a provider.

## Provider capability

Providers declare either `structuredApprovedAssets` or `none`. Capable providers receive the structured context. An incapable provider receives no optional asset context. If an incapable provider is asked to use a required source-asset placement, generation stops with a merchant-safe limitation before invocation. The deterministic provider declares structured support and needs no credentials.

## Fingerprints and stale results

The request and pending-request identity include the normalized approved asset context fingerprint and placement intents. Equivalent ordering yields the same fingerprint. A changed role, revision, or material fingerprint changes it. The generation orchestrator also compares the active asset-context fingerprint before activating an asynchronous result, preventing a stale result from becoming ready.

The reviewed proposal retains structured source-asset placement changes. Rejecting or closing a proposal leaves the draft unchanged; existing atomic history, Undo, and Redo boundaries continue to preserve complete draft state. P7-05 does not add binary media persistence or canonical-product-media mutation.

## Protected product media

Public product observations remain reviewed source/design assets. P7-05 forbids source-asset placement operations that would replace `productMainImage` or `productAlternativeImage`; they cannot mutate Vesko product, variant, or canonical catalogue media. Catalogue-media ingestion remains a separate future workflow.

## Explicit non-goals

- asset-review screens or Storefront Studio UI;
- public-source crawling, remote fetches, binary ingestion, or permanent media storage;
- homepage, collection, or product renderer changes;
- product-media import, catalogue mutation, publishing, or editor changes;
- live OpenAI calls or provider-specific response contracts.
