# P10A-04B — Registry, Manifest and Renderer Conformance

## Purpose

P10A-04B adds deterministic evidence that capability data made available to
PageBlueprints, future design skills, and evaluation is backed by a real
registered renderer. It is a pure report over existing authority; it does not
create a second registry, manifest, renderer catalogue, or PageBlueprint
representation.

## Sources of authority

The report follows this ownership path:

```text
ComponentDefinitionV2 / ComponentRegistryV2
  -> generated ComponentCapabilityManifest authority
  -> live renderer lookup maps
  -> executable PageBlueprint profiles and canonical materialization
```

- `veskifyComponentDefinitionsV2` is the canonical live component definition
  list. `veskifyComponentRegistryV2` continues to validate component instances.
- `veskifyComponentCapabilityManifest` is regenerated from those definitions
  and `listExecutablePageBlueprintProfiles`; it is a read-only projection, not
  independent authority.
- `collectLiveRendererRegistrations` reads the actual V1 registry render
  functions and the homepage, dynamic collection, and dynamic product renderer
  target maps. Each registration supplies target-specific renderer variant
  evidence. Dynamic V1 registrations remain visible rather than being filtered.
- `materializeExecutablePageBlueprint` remains the canonical deterministic
  realization of a selected profile. The conformance service does not create or
  persist another plan or page graph.

## Conformance algorithm

`createRendererConformanceReport` regenerates a manifest from the supplied live
definitions and profiles, then verifies renderer identity, targets, ownership,
version evidence, and renderer-level variant support for every target. A
variant is conformant only when the declared renderer directly supports it on
that target; an undeclared fallback is reported as a blocking defect.

For each selected PageBlueprint component, every required commerce-binding slot
must be satisfied by the profile's canonical binding evidence. A slot's
alternative source types retain OR semantics; optional slots do not create a
requirement. Profile binding categories that no selected component accepts are
reported as stale declarations.

External manifest-shaped input is compared only as drift evidence. It never
changes the regenerated manifest used for resolution or materialization.

The report sorts findings by stable identifier and fingerprints both the live
manifest and normalized renderer registrations. Registration canonicalization
includes identity, targets, ownership, renderer version, and per-target variant
evidence, so duplicate registrations with differing metadata remain stable
under permutation. It is deeply frozen before it is returned.

## Finding categories and classifications

The report has these closed finding categories:

- `missing-renderer`, `orphan-renderer`, `incompatible-variant`, and
  `page-blueprint-compatibility-gap`;
- `binding-gap`, `asset-role-gap`, and `bounded-parameter-gap`;
- `responsive-contract-gap`, `accessibility-contract-gap`, and
  `metadata-or-version-drift`;
- `commercial-capability-missing`.

Each finding is classified as a `blocking-defect`, `metadata-gap`,
`commercial-gap`, or `deliberate-future-capability`. The result is evidence for
review and follow-up work; it is not a mechanism that changes renderer,
commerce, asset, or PageBlueprint behaviour.

## Verified baseline gaps

The initial deterministic report records the following live gaps rather than
concealing them:

- 19 blocking findings:
  - 12 `binding-gap` findings: each of the three home profiles requires
    `navigation`, each collection profile requires `collection` and `productList`,
    and each product profile requires `product`, but their selected V1-backed
    component slots do not declare the matching canonical source type.
  - one `missing-renderer` target finding and five `incompatible-variant`
    findings for `dynamicProductDetail`: its generated manifest declares the V2
    renderer for editor, preview, and published targets, but the V2 route path
    is used only for preview and published.
  - one `metadata-or-version-drift` ownership finding: Puck editor uses the V1
    dynamic product bridge while preview and published use V2. This is a real
    blocking ownership drift, not an omitted registration.
- 25 `metadata-gap` findings: renderer target maps do not currently own a
  separate renderer version. Component definition versions remain canonical;
  the report deliberately does not invent renderer-version metadata.
- One `deliberate-future-capability` ownership finding: dynamic collection has a
  V1 editor fallback alongside the V2 editor/preview/published route renderer.
  It remains visible as deliberate migration work.
- Six `commercial-gap` findings: `homepageHero`,
  `homepageFeaturedCollections`, `homepageFeaturedProducts`,
  `homepageCollectionNavigation`, `homepagePromotion`, and `homepageTrust`
  have registered renderer paths but are neither represented by the V1 bridge
  nor selected by an executable PageBlueprint profile.

No orphan renderer, stale renderer variant, asset-role, bounded-parameter,
responsive-contract, accessibility-contract, or profile materialization gap is
reported for the live baseline.

## Deferred P10A-04C work

P10A-04C can use only the six verified commercial gaps to make a scoped
commercial decision for homepage renderer-backed capabilities. The binding and
dynamic ownership defects must be addressed by their owning conformance or
renderer-migration work; they are not commercial-family work. This task reports
the evidence without altering components, profiles, protected commerce fields,
renderer behaviour, or asset semantics.
