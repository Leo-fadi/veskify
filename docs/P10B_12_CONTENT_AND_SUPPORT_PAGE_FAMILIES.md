# P10B-12 — Content and Support Page Families

**Status:** Baseline

**Phase:** P10B — Commercial Storefront Generation System v1 (**Partial / active**)

**Provider calls:** Zero

## Outcome

P10B-12 makes the P10B-05 registered content/support page families executable through fifteen
bounded, structurally distinct `PageBlueprint` profiles. The library covers two About profiles,
two Contact profiles, two locations profiles, two FAQ profiles, service and policy reading,
two generic-content profiles, and three campaign/editorial profiles. Shipping, returns, and policy
families use distinct approved fact documents even when their registered reading structure is shared.

The task extends the canonical path; it does not create a page graph, recipe engine, CMS, fact
registry, or snapshot type:

```text
approved current Storefront Design Brief evidence
  → P10B-05 PageFamily evidence identity
  → strict localized content-support fact document
  → registered P10B-12 PageBlueprint profile / contentSupport component
  → bounded PageBlueprint section
  → StorefrontSnapshot → save/reload → publish compiler → renderer
```

P10B-05 remains the sole owner of routes, locale coverage, page-set completeness, page-family
selection, and transitive navigation reachability. P10B-12 only selects a profile permitted by that
authority and replaces the canonical page's bounded section composition.

## Fact authority and fail-closed behavior

`createStorefrontDesignBriefContentSupportFactAuthority` accepts only the existing P10B-05 approved
evidence identity. It resolves the current approved brief/workflow evidence and parses its observed
value into the exact page-family document shape. Callers cannot supply a factual body or use a
declaration to authorize facts.

Each document retains its source, authority ID, revision, current approval fingerprint, family,
localized payload, and deterministic fingerprint. The content bridge rechecks the document's exact
evidence identity against the current render context and the page's canonical P10B-05 evidence
reference. Missing, stale, revoked, superseded, unapproved, mismatched, malformed, or
wrong-family evidence fails before materialization or rendering.

Facts are family-specific: contacts require actual supported channels; locations require supported
location records; FAQ requires question/answer records; service and policy families require approved
sections; About and generic pages require approved narrative blocks; campaign pages require an
approved campaign record. Unsupported optional pages omit through P10B-05's registered optional
policy. Required pages without fact authority fail; no location, policy, delivery, guarantee,
certification, compliance, or service claim is invented.

## Reused commercial authority

The registered `contentSupport` V2 family declares P10B-03 anatomy, meaningful variants, localized
content binding, responsive transformations, and compatibility rather than copying a component
registry. Content and landing page vocabulary is added only where the canonical P10B-03 grammar
permits it. P10B-02 Design DNA still reaches the renderer through the normal storefront context.

Every profile uses a compatible P10B-06 shared frame. About and generic editorial content reuse the
P10B-07 editorial renderer; campaign variants reuse its campaign/promotion renderer. P10B-12 does
not manufacture imagery, action labels, or media. When approved media is available, its placement,
art direction, asset role, performance, alternative text, responsive treatment, and fallback remain
the existing P10B-04/P10B-07/P10B-08 registered authority; unsupported optional media is omitted.

The renderer presents semantic story, contact, location, FAQ, policy, and campaign structures. It
does not dump raw source documents, create commerce state, alter product or collection bindings, or
introduce a provider path.

## Lifecycle and evidence

The exact validated content-support fact document is retained in the canonical
`StorefrontSnapshot` beside its bound section, then carried into the compiled publication artifact.
Compilation rejects a missing document, a stale evidence reference, or a document whose family does
not match the canonical page family. Save/reload, navigation, protected-commerce, and publishing
authorities remain unchanged.

Focused deterministic coverage proves the fifteen-profile inventory and structural fingerprints;
source fact resolution; caller-body rejection; stale/revoked/mismatched evidence rejection;
locale, navigation, and P10B-05 page-family preservation; P10B-03/P10B-06/P10B-07 reuse; exact
snapshot materialization; protected commerce stability; and deterministic publish-compiler
preservation. Chromium coverage runs all fifteen profiles at 375, 768, 1024, and 1440 px (61
checks), checks the shared frame and semantic presentation without clipping or a raw-document dump,
and makes no provider request.

P10B remains Partial. P10B-10 and P10B-11 commerce profiles, P10B-13 utility pages, P10B-14's
complete-storefront slice, synthesis/direction work, and P10B-18 commercial quality/scale closure
remain separate work. This task does not claim final commercial visual-quality acceptance.

## Current P10B-17 continuation

P10B-17 makes each existing content/support variant consume responsive execution derived from its
registered anatomy. Reading width, campaign opening hierarchy, contact/location directory layout,
and responsive media now follow the shared breakpoints; labelled regions, controls, and focus
behavior use the shared semantic-accessibility treatment. The fifteen profile identities and their
approved-fact requirements do not change. Optional evidence and assets still omit or fail closed
under the original family policy.

No content registry, PageBlueprint, renderer, snapshot, evidence, commerce, or media authority was
added or mutated. P10B-18 retains final multi-page editorial/support quality and scale review.

## P10B-18B-05 accepted quality Baseline

The accepted package preserves the one P10B-12 fact-document and `contentSupport` authority while
making About story/process, contact channels/directory, service/policy, generic reading/editorial and
campaign editorial/image/story compositions consume visibly different truthful regions. Appointment
and FAQ topic-guide registrations are exact compatibility aliases until executable appointment or
approved topic-group authority exists. Image-led campaigns require exact approved purpose-affine
presentation placement and P10B-18B-06 art direction; no media reclassifies to editorial and
canonical product imagery is never promoted. A campaign CTA renders only for an exact approved
label/navigation pair. The final focused matrix is green and the product owner accepted this
bounded visual-quality Baseline on 20 August 2026.
