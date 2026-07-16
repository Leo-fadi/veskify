# Phase 1 Storefront Renderer

## P1-01 status and scope

P1-01 is complete. It starts Phase 1 with one complete Aurum Nordic homepage rendered from canonical snapshot data through the controlled Veskify registry. The read-only project proof remains the delivery route; this task does not add an editor shell, publishing UI, collection/product rendering expansion, cart, or checkout.

Specification baseline: SDD §1.2, §2–§2.1, §6.2 (FR-011, FR-013–FR-020), §8.2–§8.5, §9.1–§9.5, §10.1, §11.4–§11.5, §14, §15.3–§15.7, §16.2 and §16.5–§16.7, §18, §20, §21.1–§21.3, §22–§22.1, Appendices A–D, AC-013, AC-016–AC-019, and NFR-001, NFR-003, NFR-004, NFR-006, NFR-008 and NFR-009.

## Components and initial variants

The homepage contains exactly these visible canonical sections in Appendix C order:

1. `announcementBar` — `singleLine`
2. `header` — `centered`
3. `hero` — `editorial`
4. `featuredCategories` — `editorialCards`
5. `productGrid` — `editorial`
6. `campaignBanner` — `split`
7. `brandStory` — `editorial`
8. `benefitIcons` — `threeColumn`
9. `newsletter` — `inline`
10. `footer` — `columns`

Each definition supplies strict Zod content/props schemas, validated defaults, allowed page types, one approved variant, editor-field metadata, protected-field metadata, and the shared renderer mapping. Puck Config remains derived from these definitions.

## Renderer context decision

Runtime-only data is not copied into section content. `StorefrontRenderContext` is Veskify-owned, editor-agnostic and Puck-independent. It contains the active locale, project primary locale, validated catalogue, validated snapshot navigation, and canonical page paths. The project route creates it from the loaded `ProjectAggregate` and current draft snapshot. The isolated Puck proof uses a deterministic validated preview context from the seed.

## Catalogue-reference validation

`featuredCategories.collectionIds` and `productGrid.productIds` are canonical references. Their strict schemas reject duplicates, and contextual registry validation rejects unknown IDs before repository writes or rendering. Components resolve titles, media, dummy prices and stock labels from the validated catalogue. Price and stock are protected, read-only presentation data and are never duplicated into section content.

Empty reference lists are valid and produce merchant-readable empty states. Hidden sections remain validated and persisted, then are filtered only by the shared storefront rendering boundary.

## Seed migration

Both Aurum Nordic draft and published snapshots contain the complete ten-section bilingual homepage with deterministic IDs and controlled local assets. Draft and published references remain separate and protected catalogue values are unchanged.

IndexedDB performs one narrowly scoped atomic upgrade for the built-in demo. It replaces data only when the stored project, catalogue and both snapshots exactly match the known untouched Phase 0 seed. Any changed project name, revision, snapshot reference, snapshot content, history, or catalogue prevents migration. No general migration framework was introduced.

## Verification

Unit and integration coverage verifies strict schemas/defaults, variant and page boundaries, protected metadata, catalogue references and duplicates, locale fallback, all ten sections and order, navigation/catalogue resolution, empty states, hidden sections, Puck derivation, repository round-trips, and IndexedDB migration safety.

Playwright covers the complete IndexedDB-loaded homepage, English/Finnish keyboard switching, read-only commerce presentation, non-functional newsletter behavior, absence of editor chrome, and overflow checks at 375, 768, 1024 and 1440 pixels.

## Remaining Phase 1 work

Collection and product page component sets, cart and checkout presentation, additional approved variants, and later responsive storefront templates remain deferred. Editor canvas integration, manual editing, onboarding, AI operations, publishing confirmation, and new routes belong to later phases.
