# QA-DATA-01 — Karvonen project isolation

## Root cause

The original Karvonen seed constructed its storefront snapshots by recursively
rewriting the Aurum Nordic snapshot. That transformation changed identifiers
and a small number of references, but it left Aurum-specific content, assets,
brand values, navigation targets, and footer copy in the Karvonen project.
The repository lookup itself remains exact by project identifier; it did not
fall back from Karvonen to Aurum.

## Corrected bootstrap contract

Karvonen now defines its own typed brand system, navigation, static home,
collection, and product pages. Its canonical product and collection bindings
continue to point only to the existing Karvonen catalogue. The seed does not
import or derive its merchant-facing storefront content from the Aurum seed.

Each Karvonen draft and published snapshot is constructed independently, so
the two demo projects have no mutable storefront object references in common.
The shared component registry uses the merchant-neutral `Hero` / `Hero-osio`
label rather than an Aurum-branded generic hero label.

Storefront home navigation resolves the snapshot page with `type: "home"`, not
a merchant-specific page ID. The shared render context retains all page-ID
paths for navigation targets and supplies the resolved home path for header and
footer brand links. A snapshot with no home page retains the existing `/` safe
fallback.

## Existing browser data

Fresh bootstrap creates the corrected Karvonen project normally. For browser
storage created by the prior implementation, the IndexedDB bootstrap recognizes
only the exact, unedited legacy Karvonen seed shape and replaces that complete
seed aggregate with the corrected canonical aggregate. Any difference in the
stored project, catalogue, draft, published snapshot, or provenance prevents
this migration, preserving merchant edits and unrelated records.

This compatibility matcher exists only to identify the historic defective seed;
it is not used to construct current Karvonen storefront data.

## Coverage

Focused seed, repository, restoration, editor, storefront route, registry, and
architecture tests verify independent Aurum and Karvonen aggregates, EN/FI
rendering, canonical product and collection routes, exact repository lookup,
legacy-seed correction, and preservation of an edited legacy draft.

Relevant authoritative requirements: FR-102, FR-109, FR-110, FR-114, FR-115,
FR-117, FR-118; NFR-101, NFR-105, NFR-107, NFR-108, NFR-109; AC-112, AC-117,
AC-118, AC-120, AC-124.
