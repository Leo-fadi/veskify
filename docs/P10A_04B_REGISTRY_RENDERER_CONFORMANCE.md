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
  target maps. It omits the two superseded V1 dynamic registrations so each V2
  component has one runtime owner.
- `materializeExecutablePageBlueprint` remains the canonical deterministic
  realization of a selected profile. The conformance service does not create or
  persist another plan or page graph.

## Conformance algorithm

`createRendererConformanceReport` regenerates a manifest from the supplied live
definitions and profiles, then verifies renderer identity, targets, ownership,
version evidence, variants, responsive/accessibility declarations, and every
executable profile's page, role, slot, binding, asset, bounded-parameter, and
materialization compatibility.

External manifest-shaped input is compared only as drift evidence. It never
changes the regenerated manifest used for resolution or materialization.

The report sorts findings by stable identifier and fingerprints both the live
manifest and normalized renderer registrations. It is deeply frozen before it
is returned.

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

- 12 blocking `binding-gap` findings: each of the three home profiles requires
  `navigation`, each collection profile requires `collection` and `productList`,
  and each product profile requires `product`, but their selected V1-backed
  component slots do not declare the matching canonical source type.
- 25 `metadata-gap` findings: renderer target maps do not currently own a
  separate renderer version. Component definition versions remain canonical;
  the report deliberately does not invent renderer-version metadata.
- Six `commercial-gap` findings: `homepageHero`,
  `homepageFeaturedCollections`, `homepageFeaturedProducts`,
  `homepageCollectionNavigation`, `homepagePromotion`, and `homepageTrust`
  have registered renderer paths but are neither represented by the V1 bridge
  nor selected by an executable PageBlueprint profile.

No missing renderer, orphan renderer, incompatible variant, asset-role,
bounded-parameter, responsive-contract, accessibility-contract, or profile
materialization gap is reported for the live baseline.

## Deferred P10A-04C work

P10A-04C can use this report to make a scoped commercial decision for the six
homepage renderer-backed capabilities. Closing the binding declarations or
adding commercial components/variants is intentionally out of scope here: this
task reports the evidence without altering components, profiles, protected
commerce fields, renderer behaviour, or asset semantics.
