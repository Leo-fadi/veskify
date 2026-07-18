# P3-08 — Deterministic Initial Storefront Materializer

## Ownership and outcome

The materializer is a pure application boundary between the approved P3-06 template-selection plan
and the later project-creation workflow. It consumes a validated design brief, selection plan,
canonical BrandSystem, explicit identifiers, catalogue reference, and explicit timestamp. It returns
an immutable generation plan containing a validated initial StorefrontSnapshot. It never saves a
project, snapshot, catalogue, or page.

P3-03 remains the source of truth for registered template composition. P3-06 remains the source of
truth for template selection and scoring. P3-08 validates those outputs and materializes their
resolved plans; it does not re-score or re-select a template. P3-05 will later provide a valid
BrandSystem through this same input boundary.

## Input and output contracts

`InitialStorefrontMaterializationInput` contains:

- validated `StorefrontDesignBrief`;
- successful `StorefrontTemplateSelectionPlan`;
- canonical `BrandSystem`;
- project ID, snapshot ID, catalogue reference, and explicit `createdAt`.

`InitialStorefrontGenerationPlan` contains a stable ID, source IDs, status, generated page IDs,
optional generated snapshot, assumptions, warnings, blockers, and structured provenance for page,
section, content, and BrandSystem sources. Blocked plans never contain a snapshot.

## Deterministic pages and sections

Exactly three pages are generated: `/`, `/collections/all`, and `/products/featured`. Page IDs are
derived from the project ID and page type. Section IDs are derived from the page ID and template slot
ID. Every section starts from a detached registered-component default, uses the selected slot variant,
is visible by default, and is validated against the target page type. No component or variant
vocabulary is duplicated in the materializer.

Required slots that cannot be represented by registered defaults become structured blockers. Optional
slots are omitted only when their declared condition applies: not requested, unavailable imagery or
logo, or an empty catalogue. Every omission is recorded in provenance and warnings.

## Controlled content and languages

The initial content policy changes only safe presentation fields. Business name and short description
may replace registered hero, story, header, and footer presentation copy. Merchant-authored values are
written only in the brief primary locale; no translation is invented. Controlled page titles, SEO
copy, and navigation labels provide EN/FI variants, with normal locale fallback available to renderers.
Protected commerce references, prices, stock, SKU, variants, delivery, tax, and payment data are never
created or changed.

## Catalogue boundary

The materializer stores only the supplied canonical `catalogueRef`. It does not load catalogue data,
create product or collection records, or call commerce services. Existing, controlled-demo, and empty
brief contexts remain distinct. P3-06 resolver warnings are retained, and empty/demo presentation
uses only registered safe defaults and placeholders. No fake product IDs, prices, stock, or operational
truth is introduced.

## Navigation and validation

Primary navigation contains localized Home and Shop items targeting the generated home and collection
page IDs. The featured product page is not added to primary navigation. Footer navigation remains
minimal and valid. The complete snapshot is checked by `storefrontSnapshotSchema` and the registered
component validation boundary before it is returned.

## Deferred handoff and exclusions

The later project-creation milestone may persist this validated snapshot as a draft and create the
Project aggregate. This PR deliberately excludes ProjectModel creation, ProjectRepository,
IndexedDB/storage, onboarding, Puck/editor integration, publishing, history, proposals, AI providers,
catalogue ingestion, product enrichment, cart, checkout, and PageModel generation beyond this
in-memory initial snapshot.
