# P1-02 Aurum Nordic Collection Renderer

## Completion status

Complete. The canonical Aurum Nordic rings collection renders from the repository-loaded current draft through the controlled Veskify registry at `/projects/project_aurum_nordic/collections/rings`.

Specification baseline: SDD §2–§2.1, §5.1, §6.2 (FR-011 and FR-013–FR-019), §8.2–§8.5, §9.1–§9.5, §10.2, §11.4–§11.5, §14, §15.3–§15.7, §16.2 and §16.5–§16.7, §18–§22, Appendix C, AC-013, AC-016–AC-019, and NFR-001, NFR-003, NFR-004, NFR-006, NFR-008 and NFR-009.

## Components and canonical references

The collection page contains exactly `header`, `collectionHeader`, `filterBar`, `productGrid`, and `footer`, in that order. `collectionHeader` uses the `editorial` variant and stores only the canonical `collection_rings` reference. It resolves the bilingual title, description, and representative product image from `StorefrontRenderContext`. Unknown collection IDs fail contextual registry validation.

`filterBar` uses the `horizontal` variant and accepts only `material`, `metalColour`, `price`, `availability`, and `stoneShape`. Its bilingual controls are a visual demo presentation: they do not filter, sort, mutate catalogue data, or persist URL state. Mobile uses wrapped controls; a drawer state machine is deliberately deferred.

The existing `productGrid` `editorial` variant resolves the collection's two product IDs from the validated catalogue. Prices and stock statuses remain read-only dummy commerce data and are not duplicated into section content. Header and footer retain their existing variants and navigation resolution while supporting collection pages.

## Seed and rendering boundary

Both draft and published Aurum Nordic snapshots use deterministic collection section IDs and separate snapshot IDs. Homepage data is preserved and the product-page placeholder remains empty. The route loads only through `createBrowserProjectRepository()`, resolves the draft, catalogue collection slug, and canonical page slug, applies validated BrandSystem variables, and renders through the shared registry renderer without Puck/editor chrome.

Internal storefront navigation is scoped to the active project preview. Home resolves to `/projects/[projectId]`, while collection and product targets resolve below that project route instead of nonexistent root-level storefront paths.

IndexedDB recognizes the exact untouched P1-01 seed, whose collection pages had no sections, and atomically upgrades both seeded snapshots to P1-02. The migration uses a complete project, catalogue, and snapshot fingerprint; any edited draft, published snapshot, project, catalogue, history, or reference prevents replacement.

Hidden sections remain validated and persisted but are omitted by the shared renderer. Invalid hidden sections still fail before rendering or repository persistence.

## Protected commerce and limitations

No product price, stock, payment, shipping, tax, inventory, order, or checkout data is editable or mutated. Search, cart, filtering, and sorting remain presentation-only. Pagination, a filter drawer, cart/checkout work, editor mutations, publishing UI, AI operations, and production integrations are deferred.

## Tests and viewports

Unit coverage verifies strict schemas/defaults, variants, page boundaries, references, filter tokens, protected metadata, and registry-derived Puck Config. Integration coverage verifies the five-section composition, EN/FI and fallback content, catalogue/media/navigation resolution, both products, protected display data, hidden validation, repository preservation, and homepage/product-placeholder regressions. Route coverage includes loading, project missing, draft missing, collection missing, page missing, storage failure, validation failure, success, and absence of editor chrome.

Dedicated Playwright coverage verifies the seeded URL, Draft preview, keyboard locale/filter controls, unchanged products after filter interaction, read-only price presentation, and no horizontal overflow at 375, 768, 1024, and 1440 pixels.

## Parallel-work ownership

This change owns collection-page files and the minimum shared registry, renderer compatibility, seed, and styling changes required by P1-02. It does not implement or modify product routes/components/tests, cart, checkout, editor, onboarding, AI, publishing, P1-03, or later work.
