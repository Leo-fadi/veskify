# P10A-05A — Skill consumer audit and capability-knowledge boundary

**Audit date:** 3 August 2026

**Baseline:** `origin/main` at `a70f88d`
**Scope:** P10A-05 preparation only; no provider, prompt, renderer, scope-router, canonical-commerce or publishing behaviour changes.

## Outcome

P10A-05A records the current skill ownership and introduces one typed, read-only
capability-knowledge consumer boundary for the skill layer. It consumes the in-memory
P10A-04A `ComponentCapabilityManifestAuthority`; it is not another manifest service,
component registry, PageBlueprint registry, renderer registry, capability cache or persisted
storefront model.

```text
registered ComponentDefinitionV2 + executable PageBlueprint profiles
  -> P10A-04A generated ComponentCapabilityManifestAuthority
  -> P10A-05A SkillCapabilityKnowledgeConsumer
  -> future versioned initial-generation and follow-up-editing packages
  -> existing planner / provider adapter / proposal validation boundaries
```

The boundary exposes only declared capability projections. It does not expose component schemas,
renderer adapter data, executable component trees, `StorefrontSnapshot`, page/section content,
canonical catalogue records, product IDs, SKU/price/stock/options, media bindings, approved asset
instances, session data or provider credentials.

## Source reading and current authority map

This audit inspected the binding controlled-agent pipeline and P10A sequence in
[`VESKIFY_SDD.md`](./VESKIFY_SDD.md), the current skill catalogue in
[`DESIGN_AGENT_SKILLS.md`](./DESIGN_AGENT_SKILLS.md), P10A-02’s capability matrix, the P10A-03
executable PageBlueprint contract, and the P10A-04A generated-manifest contract.

| Boundary                     | Current owner                                                                                                                    | Audit finding                                                                                                                | P10A-05A treatment                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Current skills               | `src/application/design-skills/{contract,default-registry,registry,planner,executor}.ts`                                         | Eight live, versioned legacy definitions execute page/section operations through an in-memory proposal path.                 | Inventory is read-only and deterministic; no existing package semantics are changed.                                       |
| Executable composition       | `src/application/storefront-templates/{contract,registry,profile-materializer}.ts`                                               | P10A-03 owns registered executable profiles and materialization to canonical state.                                          | Selected profile/component/variant references are validated against the P10A-04A projection that P10A-03 registered.       |
| Capability authority         | `src/domain/component-platform/capability-manifest.ts` and `src/components/registry/capability-manifest.ts`                      | P10A-04A already owns deterministic projection, fingerprinting and immutability.                                             | Reused directly. No raw manifest-shaped input is accepted as authority.                                                    |
| Editor proposal builder      | `src/application/ai-proposal-generation/request-builder.ts`                                                                      | Reconstructs permissions from current skills and exposes legacy allowed component/operation arrays to its provider contract. | Not migrated in this preparation task.                                                                                     |
| Whole-store provider builder | `src/application/ai-storefront-generation/request-builder.ts`                                                                    | Uses whole-store planner output, the legacy component registry and raw V2 definitions to create component contracts.         | Not migrated in this preparation task.                                                                                     |
| Provider adapters            | `src/application/ai-provider/*`, `src/application/ai-storefront-generation/provider-boundary.ts`, `src/integrations/ai/openai/*` | Provider formats remain isolated and proposal responses are revalidated against canonical targets and permissions.           | The boundary can generate a reduced provider capability projection but is not wired into prompts or provider requests yet. |
| Proposal/compiler lifecycle  | `src/application/ai-proposal-generation/*`, `src/application/whole-storefront-proposal-lifecycle/*`                              | Existing proposal validation, protected-field guards, stale protection and canonical compilation remain authoritative.       | Unchanged; a capability description never authorizes an operation by itself.                                               |

## Current live skill inventory

The inventory below is generated from `designSkillRegistry` by
`listCurrentDesignSkillInventory()`. All live IDs are version `1.0.0` and are deterministically
sorted by ID.

| Skill ID                                  | Scope        | Accepted page types                                                       | Operations produced or authorized                                                                                                    | Capability knowledge consumed                                                                                                              | Classification                     |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `addCampaignSection`                      | `page`       | `home`, `landing`                                                         | `ADD_APPROVED_SECTION`, `CHANGE_LOCALIZED_SECTION_TEXT`                                                                              | Manually names `campaignBanner` and its `minimal` variant; reads collection context to derive safe copy.                                   | Requires migration                 |
| `applyExactBrandPalette`                  | `storefront` | `home`, `collection`, `product`, `content`, `cart`, `checkout`, `landing` | `APPLY_APPROVED_BRAND_COLOURS`                                                                                                       | Reuses the 17-item `storefrontStyleComponents` list although the operation is only global token refinement.                                | Legacy but temporarily supported   |
| `applyLuxuryStyle`                        | `page`       | `home`, `landing`                                                         | `CHANGE_SECTION_VARIANT`, `CHANGE_BACKGROUND`, `CHANGE_TYPOGRAPHY`, `CHANGE_DENSITY`, `CHANGE_SHAPE`                                 | Hard-coded `luxuryVariants`, manual component list, legacy `getComponentDefinition()` editor-field checks and fixed token values.          | Requires migration                 |
| `applyMinimalNordicStyle`                 | `page`       | `home`, `landing`                                                         | `CHANGE_SECTION_VARIANT`, `CHANGE_BACKGROUND`, `CHANGE_TYPOGRAPHY`, `CHANGE_DENSITY`, `CHANGE_SHAPE`                                 | Hard-coded `minimalVariants`, manual component list, legacy editor-field checks and fixed token values.                                    | Requires migration                 |
| `applyMinimalNordicStorefrontStyle`       | `storefront` | all seven current page types                                              | The shared whole-store operation boundary, including variants, presentation fields, reorder/page-section and BrandSystem operations. | Shares manual `storefrontStyleComponents` and `storefrontStyleDesignSystems`; overlaps registered direction / design-system recipe policy. | Duplicate or conflicting authority |
| `applyRegisteredWholeStorefrontDirection` | `storefront` | all seven current page types                                              | Authorizes the shared whole-store operation boundary; its executor intentionally emits no local operations.                          | Uses the same 17-component manual list; whole-store planning independently selects direction, profile context and proposal operations.     | Legacy but temporarily supported   |
| `applyWarmPremiumStorefrontStyle`         | `storefront` | all seven current page types                                              | The shared whole-store operation boundary, including variants, presentation fields, reorder/page-section and BrandSystem operations. | Shares manual `storefrontStyleComponents` and `storefrontStyleDesignSystems`; overlaps registered direction / design-system recipe policy. | Duplicate or conflicting authority |
| `improveHero`                             | `section`    | `home`, `landing`                                                         | `CHANGE_LOCALIZED_SECTION_TEXT`, `CHANGE_SECTION_VARIANT`                                                                            | Manually fixes `hero` and its `editorial` variant, then reads current section content.                                                     | Requires migration                 |

No current registered skill is yet a P10A-05 versioned initial-generation or follow-up-editing
package. The entries described in the catalogue but absent from `designSkillRegistry` are **planned
capabilities not yet implemented**: source/brief (`discoverExistingStorefront`,
`reconcileSourceWithCommerce`, `reconstructBrandSystem`, `buildStorefrontDesignBrief`), asset-aware
selection/resolution, initial storefront/homepage/collection/PDP composition, product-grid/PDP
improvement, typography/rhythm/responsive/accessibility packages, and controlled content/locale
packages. `improveSelectedSection`, `improveCurrentPage` and `restyleWholeStorefront` remain
merchant-intent labels, not skill IDs.

## Duplicated and legacy capability knowledge

| Location                                                                  | Duplicated or manual knowledge                                                                       | Risk                                                                                                  | P10A-05 migration direction                                                                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `skills/apply-luxury-style.ts` and `skills/apply-minimal-nordic-style.ts` | Component lists and component-to-variant maps                                                        | A variant can remain in a skill after profile or component compatibility changes.                     | Replace static selection declarations with package requirements resolved through profile/component queries.                 |
| `skills/apply-storefront-style.ts`                                        | `storefrontStyleComponents`, three token recipes, permitted operations and page types                | Duplicates part of design-system/direction/profile policy.                                            | Keep existing Phase 9 behavior until P10A-05/06 replaces its contract; do not make these arrays a new capability authority. |
| `skills/add-campaign-section.ts` and `skills/improve-hero.ts`             | Fixed component and variant names                                                                    | A package can invent a now-unsupported component/variant selection.                                   | Use validated profile/component/variant selections with explicit scope authority.                                           |
| `registry.ts` and `skills/shared.ts`                                      | Direct legacy `getComponentDefinition()` lookups and editor-field availability                       | Skill eligibility is tied to the legacy renderer registry rather than generated capability knowledge. | P10A-05 package validation consumes the consumer boundary; P10A-04B separately verifies renderer conformance.               |
| `planner.ts`                                                              | Exact phrase map, keyword map and target-section inference                                           | Overlaps the current whole-store scope router and is not a complete scope authority.                  | P10A-06 owns strict classification and no-silent-widening rules.                                                            |
| `ai-proposal-generation/request-builder.ts`                               | Rebuilds `allowedComponentTypes` and grants from legacy skill definitions                            | Provider capability context can drift from future package contract.                                   | P10A-05 consumes a validated package declaration; proposal request construction stays the permission authority.             |
| `ai-storefront-generation/request-builder.ts`                             | Reads legacy component definitions and raw V2 definitions to construct provider `componentContracts` | Whole-store provider context can describe registry data that is not a validated skill requirement.    | P10A-05 may supply reduced capability context; P10A-06 remains responsible for scope and authority reconstruction.          |

## The typed read-only consumer boundary

`src/application/design-skills/capability-knowledge.ts` exports one
`SkillCapabilityKnowledgeConsumer`. Its constructor accepts only the generated
`ComponentCapabilityManifestAuthority`, never a raw JSON manifest or registry definition. The live
singleton uses the sole P10A-04A authority,
`veskifyComponentCapabilityManifest`.

Every query requires the current `SkillCapabilityManifestReference`:

```ts
type SkillCapabilityManifestReference = {
  version: string;
  fingerprint: string;
};
```

An unknown version or fingerprint mismatch fails before a query returns data. The consumer then
supports only these safe read paths:

- list executable profile projections by canonical page type;
- list compatible component projections by page type, narrative role or executable profile;
- resolve one profile/**slot**/component/variant selection; and
- produce a provider-safe capability projection for already validated selections.

When a query names both a page type and an executable profile, they must be the same canonical
page family; a conflicting `home` profile and `product` query is rejected rather than widened.
Shared header/footer capabilities remain available only through the matching executable page
profile that selects their slot. The generated manifest deliberately does not turn the separate
shared-frame registry profile into a second skill capability authority.

Profile and component references fail closed for an unknown profile, unknown slot, unknown
component, a component not selected at that slot, a component prohibited by the canonical
`pageBlueprintCompatibility` policy, or an unregistered/profile-incompatible variant. Slot ID is
required because an executable profile may select the same component type more than once with
different allowed variants. Returned values are deeply frozen. They contain declared page
applicability, narrative compatibility, variant IDs, bounded parameter IDs, required binding
categories, and the complete declared asset-slot contract: slot ID, accepted approved-asset roles,
requiredness, and minimum/maximum cardinality. Asset slots remain capability requirements, never
approved-asset instances or mutable asset authority.

The consumer faithfully projects the P10A-03/P10A-04A `pageBlueprintCompatibility` distinction:
`anyRegistered` permits a registered component wherever an executable profile selects it;
`listed` permits it only for its declared executable profile IDs. A stale listed-profile reference
is rejected while the manifest authority is generated. This gives the skill layer the same
profile-compatibility boundary as canonical narrative validation without recreating it.

The consumer never provides a registration, mutation, persistence, renderer-load, generic
component-schema, component-tree, route, commerce-record or asset-instance operation. A manifest
capability is descriptive: it does not replace P10A-03 materialization, scope authority, proposal
permissions, compiler validation or protected-field guards.

### Provider-safe projection

`createProviderCapabilityContext()` returns only manifest identity plus the selected profile and
component capability projections. It omits:

- `StorefrontSnapshot`, page trees and executable component trees;
- component content/props/style schemas and renderer adapter identities;
- product, variant, SKU, price, stock, availability, option, collection, route or media records;
- approved asset IDs, assignments, revisions, fingerprints, provenance and placement state; and
- provider credentials, session IDs, authorisation values, prompts and raw provider payloads.

Required binding categories and approved asset roles are retained as immutable capability
requirements, not mutable commerce or asset authority. Existing canonical context and permission
construction remain the only owners of actual protected records.

## Narrow integration evidence

`tests/unit/p10a-05a-skill-capability-knowledge.test.ts` proves:

1. generated profile/component queries are read-only and omit renderer internals;
2. unknown manifest versions and stale fingerprints fail closed;
3. conflicting page/profile requests, invented profiles, slots, components and variants fail
   closed while matching profiles retain valid shared header/footer capabilities;
4. repeated component types are resolved by their registered slot ID and slot-specific variant;
5. `listed` and `anyRegistered` PageBlueprint compatibility agrees with P10A-03 canonical
   narrative validation, including stale profile-reference rejection;
6. required and optional asset slots retain roles, requiredness and cardinality without exposing
   asset instances or allowing mutation;
7. selected profile/component/variant references remain materializable through P10A-03;
8. consumers cannot mutate returned capability knowledge, the generated manifest fingerprint or
   the registry-derived capability authority;
9. provider capability context contains only approved capability projections; and
10. the complete eight-skill legacy inventory is deterministic and immutable.

This is intentionally a narrow integration. Current skills continue to execute through their
existing registry, planner, executor, proposal and provider boundaries. P10A-05 will migrate
versioned package requirements to this consumer after its separate package-contract decision.

## Migration map and dependencies

| Next task                     | Required use of this result                                                                                                                                                                                                                                   | Not granted by P10A-05A                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| P10A-04B renderer conformance | Establish which declared renderer identities actually satisfy editor/preview/published conformance. Until then, consumer output must not be interpreted as renderer reachability.                                                                             | No renderer inspection or renderer behavior change.               |
| P10A-05 full Skill packages   | Define separate initial-generation and follow-up-editing package IDs, versions, authorities, schemas, operations, capability requirements, negative cases and evidence. Package requirements query this consumer and retain the existing proposal boundaries. | No complete packages, prompt changes or provider behavior change. |
| P10A-06 strict scope router   | Consume P10A-05 authority declarations to classify section/component, current page, shared frame, design system and storefront without silent widening.                                                                                                       | No scope-router implementation or routing behavior change.        |
| P10A-07 / P10A-08             | Consume validated capability/profile evidence in quality and publish validation.                                                                                                                                                                              | No commercial evaluation, publishing compiler or publication.     |

P10A-05A is independent of P10A-04B’s findings because it exposes only declared capability
metadata and explicitly withholds renderer internals and reachability claims. If P10A-04B finds
renderer drift, P10A-05 must use that result before any package asserts renderer-visible
availability.

## Deferred work

This task deliberately does not implement complete Skill packages, new provider prompts, strict
scope routing, component/renderer changes, P10A-04B/04C, commercial evaluation, publishing,
real-provider testing, SDD changes or a DOCX update. No provider call, protected-project mutation,
save, publish, rebase or automatic review request occurred.
