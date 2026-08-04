# P10A-05B — Governed skill contract and canonical registry

**Status:** Implemented contract boundary; initial-generation integration delivered by P10A-05C

**Scope:** P10A-05B creates one immutable package authority on top of the P10A-05A
read-only capability-knowledge consumer. It does not alter the existing planner, provider,
proposal, compiler, editor, persistence or publish paths.

## Why P10A-05 is split

P10A-05 needs two different kinds of work: defining governed package authority, then connecting
that authority to the already-canonical initial-generation and follow-up proposal paths. Combining
them would risk a second planner or a parallel proposal contract. This task therefore establishes
the contract and registry only.

```text
P10A-03 executable PageBlueprints + P10A-04A generated manifest
  -> P10A-05A read-only capability knowledge
  -> P10A-05B immutable governed package registry
  -> P10A-05C initial-generation integration (implemented)
  -> P10A-05D follow-up proposal integration (deferred)
```

## Separate execution contracts

`initialGeneration` and `followUpEditing` are distinct schemas and validation entry points.

`initialGeneration` represents the authority required to invoke the existing whole-storefront
planning path: project and draft authority, approved brief revision/fingerprint, selected
executable profile set and fingerprints, catalogue/commerce authority, approved assets, locale,
registered direction and deterministic output-contract identity. P10A-05C validates this authority
against server-derived planning input before it invokes the existing `WholeStorefrontPlanningInput`,
`WholeStorefrontGenerationPlan` and proposal compiler. It remains a single canonical package
execution, not a second planner or proposal contract.

`followUpEditing` represents already-resolved editing authority: an approved package/version,
current snapshot and page/profile authority, registered slot/component/variant selections,
bounded parameter intent, canonical binding references and approved asset references. It performs
no natural-language classification and creates no proposal operations. A supplied optional profile
is resolved against the generated manifest even when the page has no selections.

Both share the immutable authority envelope: project, draft snapshot/revision/fingerprint,
generated-manifest version/fingerprint, governed-registry version/fingerprint, component registry,
commerce and approved-asset fingerprints, locale and request identity. A stale identity fails
closed with a typed failure. Locale and request identity are compared exactly after schema
normalization, so one merchant instruction cannot be replayed under another localized context.

## Canonical package inventory

The only P10A-05B canonical executable package IDs are:

| Canonical package                         | Execution kind                         | Governed scope      | Profile constraint                                           |
| ----------------------------------------- | -------------------------------------- | ------------------- | ------------------------------------------------------------ |
| `applyRegisteredWholeStorefrontDirection` | `initialGeneration`, `followUpEditing` | complete storefront | optional executable profile/slot authority                   |
| `applyExactBrandPalette`                  | `followUpEditing`                      | design system       | no page profile authority                                    |
| `improveHero`                             | `followUpEditing`                      | selected section    | explicit home/landing executable profile and registered slot |
| `addCampaignSection`                      | `followUpEditing`                      | current page        | optional home/landing executable profile                     |

`coordinateWholeStorefront`, `restyleWholeStorefront`, `improveSelectedSection` and
`improveCurrentPage` remain intent or scope labels. They are deliberately not package IDs and
cannot acquire independent capability authority.

There is no additional initial-generation package ID. Only the canonical
`applyRegisteredWholeStorefrontDirection` package (v1.1.0) authorizes initial generation; deprecated
aliases and every other package remain follow-up-only. P10A-05C connects that authority to the
existing canonical whole-store planner rather than inventing another one.

## Compatibility adapters

The registry owns one canonical descriptor for every package and resolves supported legacy names
only as deprecated adapters:

| Deprecated adapter                  | Canonical package                         | Fixed direction    |
| ----------------------------------- | ----------------------------------------- | ------------------ |
| `applyLuxuryStyle`                  | `applyRegisteredWholeStorefrontDirection` | `premiumEditorial` |
| `applyMinimalNordicStyle`           | `applyRegisteredWholeStorefrontDirection` | `modernTechnical`  |
| `applyMinimalNordicStorefrontStyle` | `applyRegisteredWholeStorefrontDirection` | `modernTechnical`  |
| `applyWarmPremiumStorefrontStyle`   | `applyRegisteredWholeStorefrontDirection` | `premiumEditorial` |
| `applyBrandPalette`                 | `applyExactBrandPalette`                  | none               |

An adapter is marked deprecated and returns its canonical descriptor plus migration metadata. It
cannot declare components, variants, operations, profiles or permissions of its own. Unknown
names and deprecated IDs without a canonical migration fail closed.

The existing eight-skill runtime registry remains historical execution support until P10A-05C/D
migrate its callers. It is not a second authority for new governed contracts.

## Capability and protected-state boundary

`src/application/design-skills/governed-skill-packages.ts` depends only on the P10A-05A
`SkillCapabilityKnowledgeConsumer` for manifest, executable profile and slot/component/variant
queries. It does not import component definitions, renderer adapters, executable component trees
or the component registry. The generated manifest remains authoritative; copied component or
variant counts do not affect the governed registry fingerprint.

Registered bounded-parameter rules, canonical binding slot/source-type requirements and approved
asset slot/role/requiredness are validated only after the capability consumer resolves the selected
slot. Packages that do not declare an authority reject those references. Asset references require
the current approved-asset fingerprint; the contract never accepts an asset instance as mutable
skill authority.

`improveHero` carries a `canonicalHero` selection constraint: its exact profile slot must resolve
to the registered hero component. Header, footer, product-grid and unknown-slot selections fail
closed rather than widening hero editing into generic section editing.

Follow-up authority is page-scoped. Section, page and design-system packages carry exactly one
page authority; `applyRegisteredWholeStorefrontDirection` carries a non-empty, canonical-ID-unique
set of page authorities. Each page validates its own profile and owns its selections, bindings and
asset references, allowing coordinated home, collection and product authority without selections
floating across undeclared pages.

Approved asset references are grouped by page, component selection and asset slot. Role,
requiredness, duplicate identity and canonical minimum/maximum cardinality are validated before
authority is returned. Governed errors preserve typed failure codes; only malformed or
unclassified input becomes `invalidRequest`.

The registry outputs only immutable package metadata and validated authority references. It has no
commerce records, prices, stock, product/variant IDs, media bindings, navigation tree, page content,
operations, proposal, provider, persistence, acceptance or publish side effects. Commerce,
navigation, canonical media and approved-asset identity are declared read-only protected state.

## Migration map and deferred work

| Follow-on task | Required work                                                                                                                       | Not provided by P10A-05B                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| P10A-05C       | Feed the governed initial-generation authority into the existing whole-store planning and proposal path.                            | Initial-generation integration is complete; provider and persistence behavior remain unchanged. |
| P10A-05D       | Feed governed follow-up authority into the existing proposal validation/compiler path and retire executable legacy bypasses safely. | No follow-up proposal operations or acceptance integration.                                     |
| P10A-06        | Classify merchant language into explicit section/page/shared-frame/storefront scope with fail-closed ambiguity handling.            | No natural-language or strict scope routing.                                                    |

Brief/source context, approved assets and locale are execution inputs rather than standalone
packages. Image generation, translation, provider behavior, persistence, publishing, P10A-04C,
component/renderer work, SDD and DOCX updates remain outside this task.

## Deterministic evidence

`tests/unit/p10a-05b-governed-skill-packages.test.ts` covers separate schemas, the exact canonical
package inventory, immutable and deterministic registry authority, compatibility mapping, unknown
and stale failure modes, package-version validation, PageBlueprint profile/slot/component/variant
validation through P10A-05A, and the absence of mutable commerce/navigation/proposal authority.
