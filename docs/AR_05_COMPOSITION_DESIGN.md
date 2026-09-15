# AR-05 compiled composition design

AR-05A defines a strict reference value and an authority binder. StorefrontSnapshot
remains the single editable aggregate. This task does not attach the value to a
page/archetype or change any existing reader, writer, registry or renderer.

## Value and identity

`CompiledPageBlueprintCompositionV1` has `compositionVersion: "1.0.0"`. Its selected
blueprint has contract version `2.0.0`, a separately versioned record reference
(`blueprintId`, `blueprintVersion`) and the exact existing candidate fingerprint.
These versions are independent of dynamic-commerce's current `1.0.0` contract.

The exact material is:

```ts
{
  compositionVersion: "1.0.0";
  owner: { kind: "static-page" | "collection-search-archetype" |
    "product-detail-archetype"; id: string };
  blueprint: { contractVersion: "2.0.0"; blueprintId: string;
    blueprintVersion: string; candidateFingerprint: string };
  support: { id: string; version: string; implementationFingerprint: string };
  bindingFingerprint: string;
  orderAlternativeId: string;
  regionAssignments: { regionId: string; realizationId: string; units: (
    { kind: "section"; sectionId: string } |
    { kind: "presentation"; slotId: string } |
    { kind: "anatomy"; parent: { kind: "section"; sectionId: string } |
      { kind: "presentation"; slotId: string }; anatomySlotId: string }
  )[] }[];
  relationshipRealizations: { relationshipKey: string; realizationId: string }[];
  breakpoints: { breakpoint: "mobile" | "tablet" | "desktop" | "wide";
    viewport: 375 | 768 | 1024 | 1440; orderAlternativeId: string;
    ruleFingerprint: string; relationshipRealizations:
      { relationshipKey: string; realizationId: string }[] }[];
  omissions: { regionId: string; evidenceFingerprint: string }[];
  compositionFingerprint: string;
}
```

All objects are strict. IDs, versions, fingerprints and arrays are bounded; there
are at most 32 regions, 32 units per region, 192 relationships and exactly four
breakpoints. Blueprint IDs use its existing kebab-case/major-1 reference semantics;
content IDs use existing canonical ID/slot semantics. Relationship keys refer to
existing canonical relationships, not new edges. No text, media, commerce, route,
style, coordinates, component inventory or arbitrary recursive payload is stored.

The domain schema establishes structural validity, canonical ordering and exact
fingerprint validity only. The application validator returns a distinct branded,
deeply immutable accepted type. Compilation accepts explicit material selections
without the two derived fingerprints, calculates the current binding identity and
calls that same validator. There is no alternate semantic acceptance function.

Composition identity is `compiled-page-blueprint-composition-` followed by the
existing `canonicalValueFingerprint` of canonical material excluding its own field.
Lookup-like region/relationship/omission arrays use code-unit key ordering;
breakpoints use the existing four-width order. Unit order within a region is
meaningful and is preserved. The binding fingerprint covers owner identity/type,
stable content IDs, visibility, component/variant selections and exact validated
definition fingerprints. It excludes content values and containing snapshot
revision/fingerprint, preventing recursion. Future snapshot identity must cover
both content and composition. Storage-inventory permutation cannot change binding.

## Trusted authorities and realization

Both APIs receive exactly one canonical page or archetype, existing component
definitions, the exact candidate and an application-supplied realization adapter.
The binder parses the actual candidate and invokes the existing structural and
responsive canonicalizers on its concrete retained-region projection. Asset and
fallback companions remain validated through the candidate. The capacity schema
has an existing transitive registry dependency; no graph algorithm, registry,
breakpoint vocabulary or selection engine is replaced.

Static owners use their supplied canonical page type and actual page-family
authority, including historical collection/product pages. Foreign resource-route
instances cannot stand in for a canonical template owner. Existing page type and
explicit page-family authority must agree with the selected candidate's family.
Collection/search archetypes require the candidate's collection/search context in
`supportedContexts`; both use the existing collection component page type
(`page-family.ts` search-results and current route projection agree). PDP uses
product-detail/product. Only references within the supplied owner can resolve.

Every visible whole unit must be assigned exactly once, match its definition's
variant, page type and narrative role, and satisfy region cardinality. Invisible
units cannot fill required regions. Whole/part duplication rejects. Current
commercial anatomy has descriptive regions but no executable internal-unit hook:
all anatomy references currently reject, including invented test-only hooks.
Dynamic composite components are never split into duplicate product-option state.
Current collection/search and PDP inventories each have one indivisible unit;
their required two-region binding rejects with the specific unsatisfied rule.
Dynamic references still undergo owner, identity and capability validation; there
is no unconditional dynamic rejection. Static positives cover their full inventory.

The mandatory adapter has an exact ID/version/implementation fingerprint and
resolves selected realization IDs for bounded region, relationship and breakpoint
requests against the parsed candidate and definitions. Missing adapter, unresolved
ID, wrong support identity, unsupported relation or transformation fails closed.
Region support must also affirm the complete assigned unit sequence. No production
adapter is registered in A. Tests may supply clearly test-only whole-unit and
relationship adapters; they establish binding, not visual fidelity.

The global order equals the wide breakpoint's selected structural alternative;
each breakpoint selects its
exact registered responsive rule, order and rule fingerprint. Relationship choices
cover exactly the retained relationships globally and at each width. Required
regions cannot disappear. Optional omissions require an existing `omit-region`
fallback and exact-candidate, application-trusted required-role capacity evidence
parsed through the existing capacity-evidence schema. Evidence must cover every
required asset-role entry exactly; selected omissions equal its shortfall regions.
Its canonical fingerprint binds each decision; current trusted evidence is required
again during revalidation. Unresolved substitution chains reject when fallback is
needed, but do not prevent direct compatibility. Tests derive capacities from
fixture assets and cross-check existing evaluation. Concrete structure and
responsive coverage are revalidated.
Nothing is silently flattened to a stack or removed from reading order.

Errors are bounded deterministic categories without raw content or exception
payloads. Inputs and source arrays remain unchanged, including rejected calls.

## AR-05B binding and deferred activation

AR-05B attaches the same optional composition to actual canonical owners through explicit
`compositionExtensionVersion: "1.0.0"` snapshot dispatch and explicit dynamic-commerce v1/v2
dispatch. Legacy readers remain strict. Static and unchanged dynamic v1 authority can coexist in a
composed snapshot; dynamic v2 is structural until it has executable realization support. Canonical
identity includes the marker and nested composition without changing the legacy hash primitive.

AR-05A+B map original T01/T02 representation and version acceptance only upon AR-05B's accepted
merge. AR-06 remains the named consumer: it must provide the shared registered renderer, lossless
Puck/save/history/publication integration, four-width evidence, and positive collection/search and
PDP executable-commerce proof before dynamic templates are enabled. A single-family candidate cannot
semantically bind a current collection/search archetype across both supported contexts, even if later
anatomy support exists. No composed layout, family, UI, or live integration is active here.

## AR-05B canonical binding and explicit dispatch

`storefront-composition-version.ts` owns the additive `compositionExtensionVersion: "1.0.0"`
root codec. An absent marker delegates to the existing legacy snapshot parser. Present unknown
markers reject; composed pages require the exact AR-05A value on their actual owner. Uncomposed
pages and unchanged v1 dynamic authority may coexist. Structural parsing is not semantic acceptance.

`dynamic-commerce-composition-version.ts` owns explicit dynamic `2.0.0` material and fingerprint
handling. V2 requires a composed archetype, preserves all existing structural/reference refinements,
and hashes normalized complete material without its own fingerprint. Composed sections and slots
use increasing code-unit ID order. Only explicit construction sorts cloned inventories; serialized
reads reject noncanonical storage. AR-05A composition remains the sole meaningful layout order.

`createComposedStorefrontCandidate` checks expected base ID, revision and content fingerprint;
requires a distinct successor ID, next revision and unchanged project/catalogue; and returns a
pure, deeply frozen candidate. `validateComposedStorefrontSnapshot` revalidates every stored
composition, including owners not selected by an update. Both resolve actual containing owners
and delegate to A's compiler/validator. The trusted resolver receives frozen owner identity and
composition context and supplies candidate, component definitions, realization support and capacity
evidence. It cannot replace canonical owner content. The accepted TypeScript brand denotes semantic
validation; neither API performs a repository write or revision allocation.

Canonical content identity includes the optional root marker and nested composition/dynamic
identities. Legacy hash algorithms, defaults and array order are unchanged. Retained commercial
profiles prove provenance, not a second layout. Original G/H/M history is unchanged; the two B
source archives retain their original hashes and strict caller pins.

The initial path-guard mechanism was corrected within the runbook's compatibility allowance:
known version/owner fields reject unsupported composition, while unrelated legacy errors reach
their existing strict consumer/error-mapping boundaries. The immutable initial approach and failed
legacy check are retained. Both Puck entrypoints still validate their actual page before projection.

A shared collection/search archetype poses an additional explicit limitation: A's authority has one
exact candidate family, so a single-family composition cannot satisfy both actual supported contexts.
Additional realization support alone does not resolve this mismatch. AR-06 must scope that decision
alongside executable commerce anatomy, preserve protected controls and prove positive collection,
search and PDP composition before enablement. B's borrowed-topology dynamic syntax tests are not
semantic acceptance or rendered-fidelity evidence.
