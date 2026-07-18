# P3-06 — Deterministic Storefront Template Selection Planner

## Boundary and merchant outcome

The design brief owns the merchant's canonical direction. This planner evaluates that brief and
selects one of the controlled P3-03 storefront foundations. The template registry and resolver own
section composition, supported vocabulary, and compatibility; the planner does not copy or mutate
those definitions. The result is an immutable, serializable selection plan for the later
initial-storefront generation milestone. It does not create PageModel records or sections.

## Readiness

Selection requires a creation context, business industry, homepage, collection page, product page,
and a catalogue context. The brief lifecycle status does not need to be `ready` when these specific
selection inputs are present. Optional visual, content, merchandising, richness, and accessibility
preferences use the design-brief controlled defaults. Missing selection-critical values produce
structured blockers instead of a partial selection.

## Catalogue context

`mapBriefCatalogueContext` is the single mapping boundary:

| Design brief                | Template resolver |
| --------------------------- | ----------------- |
| `existing-vesko-catalogue`  | `existing`        |
| `controlled-demo-catalogue` | `demo`            |
| `empty-catalogue`           | `empty`           |

The resolver's warnings are retained. In particular, an empty catalogue remains selectable while
warning that later generation must provide a controlled empty-state or sample merchandising
presentation.

Each selection plan also stores `briefFingerprint`, owned by the P3-06 selection boundary. It is a
stable hash of the validated selection projection: creation context type, industry, visual,
typography and imagery directions, normalized tone keywords, logo/supporting-imagery availability,
requested page types, catalogue context, and all generation preferences. Presentation-only copy such
as business name, short description, target customer and market is deliberately excluded. Page types,
keywords and capability-style inputs are normalized before hashing, so equivalent array ordering
produces the same fingerprint. P3-08 compares this value with the current brief and blocks stale
selection plans instead of silently reselecting a template.

## Deterministic policy

Each built-in candidate starts with a small baseline: balanced commerce `10`, brand-led editorial
`8`, and catalogue-forward commerce `8`. The policy then adds fixed points:

- Brand-led: editorial/luxury direction `+6`, storytelling content `+5`, airy density `+3`, low
  merchandising `+3`, and story/craft/heritage/artisan/identity tone `+3`.
- Catalogue-forward: high merchandising `+6`, rich sections `+4`, compact density `+3`, an
  existing or demo catalogue `+2`, and discovery/comparison/browse/catalogue tone `+3`.
- Balanced: minimal direction `+3`, and balanced density, content, merchandising, and section
  richness `+2` each.

Industry is read for readiness but does not encode stereotypes or alter the industry-neutral
policy. Candidates are ranked by score. Equal scores use the fixed order balanced, brand-led,
catalogue-forward, so an ordinary or mixed brief selects the balanced foundation consistently.

## Compatibility and overrides

Every candidate is evaluated through `resolveTemplate` with the required home, collection, and
product plans. Resolver errors and warnings remain available in candidate diagnostics. An
incompatible candidate is never selected. An explicit `preferredTemplateId` is validated through
the same resolver and is reported as a merchant override. Unknown or incompatible overrides block
selection rather than silently falling back to a recommendation.

## Public API

The application export provides:

- `mapBriefCatalogueContext`
- `evaluateStorefrontTemplateCandidates`
- `planStorefrontTemplateSelection`
- `validateStorefrontTemplateSelectionPlan`
- `cloneStorefrontTemplateSelectionPlan`

Selection IDs are derived from a stable hash of the brief ID, override, candidate diagnostics,
selected template, brief fingerprint, candidate diagnostics, and status. Identical inputs therefore
produce identical plans without timestamps or randomness. The selection contract schema version is
now `2`; plans created with the previous version are rejected by validation rather than silently
interpreted as current. Returned plans, candidate arrays, and resolved page plans are detached and
frozen.

## Later handoff and exclusions

The later initial-storefront generation milestone may consume `resolvedPagePlans` to create validated
canonical pages. This PR deliberately excludes PageModel creation, section content, catalogue
ingestion, assets, BrandSystem generation, onboarding, editor/Puck integration, proposals, AI
providers, publishing, history, and persistence.
