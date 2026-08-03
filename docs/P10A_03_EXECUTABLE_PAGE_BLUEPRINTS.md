# P10A-03 — Executable PageBlueprint profiles

## Outcome

P10A-03 makes the existing `StorefrontTemplateDefinition` page plans executable registered
`PageBlueprint` profiles. It does not add a recipe engine, a page tree, a proposal type, a
component registry, a renderer, or persisted profile-owned state.

The canonical path remains:

```text
approved brief / whole-store direction
  -> registered PageBlueprint profile
  -> deterministic materialization
  -> existing validated proposal compiler
  -> StorefrontSnapshot
```

`StorefrontSnapshot` remains the only stored editable storefront aggregate. Editor, preview, save,
history and publishing continue to consume their existing canonical snapshot and renderer paths.

## Ownership and execution authority

- `src/application/storefront-templates/contract.ts` owns the profile contract as metadata on the
  existing canonical page plan.
- `src/application/storefront-templates/registry.ts` owns the initial registered home, collection
  and product profiles, plus the constrained shared header/footer frame profile. Registry checks
  prove profile role order, cardinality, component/variant selections and page scope match the
  canonical slots.
- `src/application/storefront-templates/profile-materializer.ts` resolves one renderer-independent
  execution projection. It validates P10A narrative-flow rules, registered V2 component
  compatibility, PageBlueprint-owned bounded-parameter inheritance, explicit canonical binding
  evidence, approved asset-role compatibility, responsive breakpoints and registered accessibility
  contracts. Its output is deterministic and fingerprinted.
- The initial materializer validates the actual post-omission section composition before recording
  profile identity/fingerprint evidence while producing the same canonical `StorefrontSnapshot`; it
  does not persist a profile projection. Missing canonical commerce bindings or required final roles
  fail closed. The supported empty-catalogue journey records its explicit canonical slot omissions
  and no successful commerce-profile materialization.
- The whole-store planner resolves live registered plans, rejects altered recipe-context copies and
  retains the three full materializations in its canonical plan. The existing proposal compiler
  consumes that materialization for component selection, variants and ordering; it does not consult
  a legacy recipe or independently reconstruct a profile.

## Initial registered coverage

Every existing controlled template exposes one versioned profile for each page family. Those
profiles declare the ordered narrative roles, required/optional role cardinality, flow rules,
registered component/variant selections, bounded-parameter defaults, binding/asset categories and
mobile/tablet/desktop/wide responsive contract. The shared storefront frame constrains the
registered header, navigation and footer capabilities without owning routes or navigation truth.

The initial profile set covers:

- shared storefront frame;
- homepage orientation, discovery, proof/story, trust and conversion-supporting flow;
- collection orientation, filtering/merchandising and canonical product discovery; and
- PDP product focus, protected conversion, options, support content and service flow.

## Fail-closed and protected state

Unknown or future profile versions, absent profiles, invalid narrative structure, incompatible
components/variants, unknown bounded parameters, invalid inherited values, missing explicit binding
evidence, unsupported asset roles and component/asset incompatibility fail before any snapshot
mutation. Existing proposal lifecycle checks continue
to protect canonical product/variant identities, prices, stock, options, collection membership and
order, routes/navigation, media/asset references, BrandSystem authority, revisions and proposal
fingerprints.

No provider call, OpenAI credential, production route, renderer implementation, commerce value or
asset provenance was changed by this task. P10A-04 remains responsible for a queryable generated
component-knowledge registry; P10A-05 through P10A-08 remain deliberately out of scope.
