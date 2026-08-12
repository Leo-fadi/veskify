# P10B-16P-03 — Storefront Studio Prompt Generation Journey

**Status:** Baseline

**Date:** 12 August 2026

**Phase:** P10B — Commercial Storefront Generation System v1 (**Partial**)

**Depends on:** P10B-16P-01, P10B-16P-02A, and P10B-16P-02B

## 1. Outcome

P10B-16P-03 connects the normal Storefront Studio entire-storefront Generate action to the
existing prompted Design Intent V2 and deterministic compilation authorities. A merchant can open
the raw Karvonen project, enter an arbitrary non-blank natural-language prompt, explicitly generate
one isolated proposal, review it across static pages and maintained dynamic-commerce archetypes,
reject it or accept it, undo and redo the accepted change, save the draft, reload it, and open the
normal preview routes.

The generated result remains one proposal over one canonical `StorefrontSnapshot`. The task adds no
page graph, component registry, PageBlueprint system, compiler, persistence model, or public
proposal route.

## 2. Current-path audit and disposition

Before P10B-16P-03, the normal entire-storefront path was:

```text
DesignAgentPanel
  → useDesignAgentSession
  → ServerWholeStorefrontPlanningClient
  → /api/ai/whole-storefront-proposals
  → legacy whole-storefront planning provider
  → coarse registered-direction selection
  → canonical proposal review
```

That path remains available for its existing bounded compatibility and follow-up behavior, but it
is no longer the normal initial entire-storefront generation path. Its browser request transported
the complete current storefront, target, permission, and planning preconditions; Design Intent V2
instead requires the server to reconstruct those authorities from compact merchant intent and
current draft identity.

P10B-16L remains a separate controlled-acceptance bridge:

```text
terminal/demo generation
  → completed proposal retained by a controlled session
  → proposal injected into Storefront Studio
  → prompt controls disabled
```

P10B-16P-03 does not use the P10B-16L session token, query parameter, executable-intent selector,
proposal injection, or controlled composer state. P10B-16L remains compatibility evidence pending
the explicit P10B-16P-04 disposition.

Reusable authorities retained by the normal journey are:

- the existing `AiStorefrontProposal` transport and merchant review;
- `runPromptedStorefrontDesignCompilation` and the P10B-16P-02B solver/executor;
- the existing canonical proposal schema/validation/execution boundary, extended by exactly one
  server-minted registered `APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION` structured operation with
  the target-bound `compilePromptedStorefrontDesignIntentV2@2.0.0` permission;
- `StorefrontProposalAcceptanceCoordinator`;
- canonical whole-storefront history and atomic Undo/Redo;
- draft assembly, validation, save, and reload;
- the existing editor/preview/published renderers;
- P10B-16P-01 static-page and maintained-archetype editor projection;
- the exact dynamic collection and PDP route resolvers.

Selected-section, current-page, homepage-only, frame/design-system, clarification, and unsupported
follow-up outcomes remain on their existing bounded authorities. They are not widened into initial
entire-storefront Design Intent V2 generation.

## 3. Canonical normal Studio path

```text
raw merchant project in normal Storefront Studio
  → exact merchant prompt + project/draft/revision/storefront scope
  → strict promptedStorefrontDesignV2 route operation
  → server authorization and current-authority load
  → one injected Design Intent V2 provider call
  → post-provider current-authority reload
  → deterministic P10B-16P-02B compilation
  → exactly one bounded storefront materialization
  → one registered APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION operation
  → one isolated AiStorefrontProposal
  → read-only proposal review
  → reject or atomic accept
  → canonical Undo/Redo
  → explicit Save draft
  → reload
  → normal Preview
```

The browser request contains only the versioned operation, contract version, project ID, draft
snapshot ID, draft revision, active locale, storefront scope, and exact merchant prompt. Strict
validation rejects extra provider intent, compiled decision, component/profile/frame selections,
authority fingerprints, candidate snapshots, proposal operations, and other browser-claimed
authority.

In standalone and explicitly configured mock evidence compositions, the server loads and
revalidates the project, draft, canonical catalogue, approved brief/evidence, approved presentation
assets, capability projection, PageBlueprint/profile authority, site-map decision, dynamic route
authority, and compatibility authority. That local authority is not integrated authentication. An
integrated request without injected authenticated tenant/project-backed current authority fails
closed before provider selection; P10B-16P-04 owns that injection. The provider receives the safe
Design Intent V2 request and cannot select a completed storefront.

## 4. Provider boundary

P10B-16P-03 uses injected mocked Design Intent V2 providers for deterministic and browser evidence.
The provider is called only after one explicit Generate storefront action. One action permits one
provider call; there is no SDK/application retry, repair request, or fallback.

The provider selector and handler seam are structurally available, but the integrated route remains
fail closed until P10B-16P-04 injects authenticated tenant/project-backed current authority and
separately authorizes the OpenAI exercise. When OpenAI is explicitly selected after that authority
is supplied, unavailable credentials, invalid configuration, refusal, timeout, transport failure,
malformed output, or strict-schema rejection fail closed without selecting the local mock. No
prompt, raw response, credential, or authorization header is logged or retained.

Successful responses expose only the existing proposal, current approved evidence references, and
safe lineage. The response schema cross-binds proposal metadata, the registered structural
operation, and lineage across provider identity, request, prompt, provider intent, the exact P02B
source-proposal fingerprint, compiled decision, synthesis, structural result, candidate snapshot, and
materialization authority fingerprints. It also retains exact current authority fingerprints,
protected-commerce/media verdicts, one operation, and one materialization.

## 5. Raw merchant project

The normal local acceptance project reuses the approved Karvonen merchant identity, catalogue,
product media, brief, evidence, and content-fact authority. Its browser and server projections are
derived from the same canonical fixture.

The project starts with neutral/raw presentation, compact current dynamic-commerce route authority,
and only the minimum registered structure required for safe compilation. It has no complete
commercial Design DNA, selected shared-frame profile, generated proposal, imported controlled
session, or preaccepted storefront. IndexedDB bootstraps it idempotently and does not overwrite an
existing merchant-edited project.

Opening the normal editor route loads the raw project without a provider call. The entire-
storefront target and prompt are enabled, and no proposal is open.

## 6. Prompt and lifecycle behavior

The merchant prompt is checked for non-blank input but is otherwise transmitted unchanged. The
normal initial entire-storefront composer uses Generate storefront language and does not present
obsolete preset-style initial-generation examples. AI-determined direction is the default.

The merchant-safe lifecycle distinguishes:

1. idle;
2. preparing current authority;
3. requesting the design intent;
4. validating the intent;
5. compiling the design;
6. materializing the proposal;
7. proposal ready;
8. failed;
9. stale; and
10. superseded.

Blank requests do not submit. A pending call disables the applicable generation controls and a
duplicate click does not create another call. A safe failure preserves the prompt and returns the
composer to a usable state. P10B-16P-03 does not offer a hidden retry button: another attempt
requires another explicit Generate action.

A pending proposal cannot be silently replaced. The merchant rejects it first, then edits or enters
a new prompt and explicitly generates again. The rejected proposal is closed without draft or
history mutation, and the next generation receives a new request and intent.

Late results are tied to the exact request, page/locale/draft context, and mounted session. Page,
locale, draft, target, or lifecycle changes supersede the old request; unmount/abort discards any
late response. No failure path accepts or saves a partial candidate.

## 7. Proposal review and archetype outline

The existing proposal renderer shows the candidate read-only and clearly labels it as a proposal.
The stored draft and all normal public/preview routes continue to show the accepted or saved
storefront until the proposal is accepted and then explicitly saved.

Current approved evidence references accompany the isolated proposal for read-only review, while
the candidate snapshot's content/support fact documents retain their exact evidence references.
They are not browser-authored content authority.

Proposal review supports at least:

- homepage;
- a maintained collection archetype with a transient representative collection;
- standard/simple PDP with a transient representative product;
- configurable/high-consideration PDP with a transient representative product;
- other registered PDP archetypes supported by the catalogue;
- one content/support page; and
- one commerce-utility presentation.

The Studio outline represents design authority rather than catalogue cardinality. It contains
static design pages, maintained collection/search archetypes, maintained PDP archetypes,
product-type-to-PDP mappings, and utility presentation authority. It does not create an editable
page for every product or collection URL.

Representative route selection stays in transient client state. It never enters
`StorefrontSnapshot`, history, a fingerprint, save, publication, or product-specific design
authority.

Search presentation authority remains listed truthfully, but runtime search execution remains
unavailable without a canonical query/results adapter. The Studio communicates that boundary and
does not bind collection membership as fabricated search results or expose a dead Search route.

## 8. Acceptance, rejection, history, and persistence

Review alone does not mutate the draft. Reject closes the proposal and preserves the exact raw or
current baseline and history. Accept revalidates the exact pending proposal through the existing
acceptance coordinator and commits one atomic unsaved whole-storefront transaction. It does not
save or publish.

Undo restores the exact prior storefront fingerprint. Redo restores the exact accepted storefront
fingerprint. Static pages, Design DNA, shared frame, dynamic-commerce route/archetype authority,
collection mappings, PDP product-type mappings, and fallbacks participate in the same transaction.

Save persists the exact accepted visible draft. Reload preserves its canonical fingerprint,
dynamic-commerce authority, content/support fact documents, and their evidence provenance. For the
standalone P03 project, normal editor and Preview entry independently resolve current approved
evidence from trusted server fixture authority and compare it with those retained references; the
saved snapshot never authorizes itself. Missing, stale, unknown, or integrated-without-injected
evidence fails closed. Preview then resolves the homepage and static pages plus concrete collection
and product URLs through the maintained archetypes, including simple, configurable, and
generic-fallback product behavior. Save, reload, Preview, and Publish make no provider call; Publish
remains separate and explicit.

## 9. Failure and concurrency contract

The following outcomes fail closed: provider refusal, timeout, transport failure, malformed output,
strict-schema invalid intent, stale post-provider authority, unsupported hard constraints,
insufficient material intent, invalid candidate materialization, duplicate submit, context change,
draft change, supersession, abort, and unmount.

Every failure:

- leaves the accepted/stored draft unchanged;
- adds no history entry;
- preserves canonical commerce and product media;
- creates no partial proposal or snapshot;
- releases the generation controls;
- performs no automatic retry, repair, or provider fallback.

Typed merchant-safe responses distinguish stale authority from invalid input and unavailable
provider transport without exposing raw provider output or internal authority payloads.

## 10. Deterministic evidence

The mocked evidence covers premium-editorial/story-led, modern-technical/catalogue-led, and
minimal-commerce/conversion-led prompts over the same merchant, catalogue, evidence, and asset
authority. Each explicit prompt reaches its provider request unchanged and produces one provider
call. The scenarios retain distinct intent, compiled-decision, structural, and candidate snapshot
fingerprints and differ materially across at least four registered structural/narrative/
merchandising/responsive dimensions. Protected commerce and canonical product media remain equal.

Focused unit and integration evidence covers:

- strict compact route input and server-owned authority construction;
- provider selection, prompt fidelity, one-call/no-retry/no-fallback behavior;
- exact post-provider refresh and one materialization;
- one registered structural operation with exact target permission and P02B source-proposal/lineage
  cross-binding;
- existing proposal transport, isolated review, rejection, and acceptance;
- exact whole-storefront Undo/Redo;
- current evidence transport plus independently resolved server authority checked against
  snapshot-preserved fact provenance through draft save/reload and normal static/dynamic Preview;
- transient representative context and archetype/cardinality boundaries;
- safe failures and concurrent/superseded requests;
- existing page/section/homepage follow-up routing;
- P10B-16P-01, P10B-16P-02, protected commerce/media, and P10A lifecycle/publication
  regressions.

The dedicated mocked browser journey exercises the normal raw project path and retains responsive
evidence at 375, 768, 1024, and 1440 px. It retains no real-provider, Vesko staging, production, or
commercial visual-quality claim.

## 11. Status and next acceptance

P10B-16P-01, P10B-16P-02A, P10B-16P-02B, P10B-16P-02, and P10B-16P-03 are **Baseline**. P10B
remains **Partial**. P10B-16P-04, P10B-17, and P10B-18 remain **Planned**.

No real Design Intent V2 provider call occurred in P10B-16P-03. Search execution remains
unavailable, and commercial visual quality remains unaccepted.

The exact next manual acceptance is:

> Open the raw merchant project in Storefront Studio, type three prompts, and generate materially
> different storefronts through the real OpenAI Design Intent V2 provider.

That work belongs only to P10B-16P-04 and requires separate explicit provider authorization.

## 12. Explicit non-goals

P10B-16P-03 does not implement live OpenAI acceptance, P10B-16L removal, legacy-path cleanup, a
canonical search query/results adapter, arbitrary component/PageBlueprint/code/copy generation,
commerce writes, product/collection writes, P10C general editing, P10B-17, P10B-18, repository
cleanup, or automatic publication.
