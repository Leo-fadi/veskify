# P10A-04A — Generated Component Capability Manifest

## Outcome

P10A-04A provides one deterministic, in-memory, read-only capability projection for the live
`ComponentDefinitionV2` registry. It is capability metadata for approved consumers; it is not a
second component registry, renderer registry, PageBlueprint registry or persisted storefront model.

The authority path is deliberately one-way:

```text
registered ComponentDefinitionV2 definitions
  -> generated ComponentCapabilityManifestAuthority
  -> approved capability consumers
```

`veskifyComponentDefinitionsV2` remains the only source. The manifest has no registration,
mutation, renderer-loading or persistence operation.

## Generation and ownership

- `src/components/registry/v2-registry.ts` assembles the canonical registered V2 definitions and
  validates them with `createComponentRegistryV2`.
- `src/domain/component-platform/capability-manifest.ts` owns the pure projection contract,
  canonical generation, fingerprinting, immutability and narrow query surface.
- `src/components/registry/capability-manifest.ts` creates the one live projection from
  `veskifyComponentDefinitionsV2`.

Generation parses every supplied definition through the existing `componentDefinitionV2Schema`.
It rejects duplicate component identities, relies on the existing schema to reject invalid versions,
duplicate variants and unknown closed-vocabulary values, and fails if a declared bounded parameter
does not exist in the canonical vocabulary. Capability data must be cloneable and serializable.

There is no checked-in generated artifact and therefore no regeneration command or artifact drift
path. The projection is rebuilt in memory from the live registry whenever its module is loaded.

## Manifest contract

Each versioned entry exposes only registered contract data:

- stable registry identity, component type, version, family, default variant and registered variants;
- allowed page types; narrative roles; visual weights; transition intents; commerce requirements;
  and declared PageBlueprint profile compatibility;
- content, canonical commerce-binding and asset slots, including required/supported binding and
  asset categories;
- canonical bounded parameter definitions, editable fields and the full protected-commerce plus
  component-specific protected-path boundary;
- responsive rules, accessibility requirements, renderer adapter identity and migration metadata;
- deterministic component and manifest fingerprints.

The manifest intentionally does not claim that a renderer implementation exists or is conformant.
It describes declared renderer identity only.

## Determinism and consumer boundary

Entries are ordered by component type. Variants, page types, roles, compatibility identifiers,
categories, renderer targets and all ordered metadata are canonicalized before fingerprints are
calculated with the canonical storefront serializer. Component and manifest fingerprints therefore
change only when projected registered capability data changes, not because of registry insertion
order, timestamps or filesystem ordering.

The exported authority and every projected nested value are deeply frozen. Consumers can only:

- look up an entry by component type or family;
- list compatibility for a canonical page type or narrative role; and
- read registered variants or bounded parameters for a component.

Manifest-like data supplied externally cannot modify this live authority or the underlying V2
registry. `StorefrontSnapshot`, PageBlueprint materialization, proposal compilation and renderer
selection continue to use their existing ownership paths.

## P10A-03 relationship

The P10A-03 integration test reads each executable profile's declared component and variants from
this generated projection, then materializes the profile with the live V2 definitions. This proves
the manifest is a compatible descriptive read path without adding an execution route or replacing
P10A-03 profile registration/materialization authority.

## Deferred work

- P10A-04B will independently audit whether each declared renderer identity is backed by a
  conformant renderer implementation.
- P10A-04C will close commercial component capability gaps; P10A-04A adds no component family,
  variant or renderer.
