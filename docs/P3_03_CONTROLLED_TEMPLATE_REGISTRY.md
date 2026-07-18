# P3-03 — Controlled Storefront Template Registry

## Purpose and merchant outcome

The design agent now has three deterministic, industry-neutral storefront foundations that a later
planner can select and instantiate:

- Brand-led editorial — identity, imagery, and story lead the experience.
- Clean balanced commerce — brand presence, discovery, and shopping remain evenly weighted.
- Catalogue-forward commerce — browsing, filtering, and related-product discovery take priority.

Each foundation defines homepage, collection, and product-page plans using only existing Veskify
section types and variants. This PR provides composition metadata and compatibility resolution; it does
not build template-selection UI or generate a storefront.

## Specification alignment

- SDD §2.1 — controlled components and no arbitrary code generation
- SDD §8 — shared design-system inheritance and approved visual vocabulary
- SDD §9.1–§9.5 — registered components, variants, page permissions, and responsive contracts
- SDD §10.1–§10.3 — homepage, collection, and product composition requirements
- SDD §16.2–§16.4 — layer boundaries, canonical composition, and validated state mutation
- ADR-002 §§2–4 — bounded skills, structured operations, reuse, and Veskify ownership
- `DESIGN_AGENT_SKILLS.md` §§3–5 — bounded contracts, page templates, and reuse before generation

The registry is a foundation for later generation and planner work. It does not recreate or depend on
the parallel StorefrontDesignBrief contract.

## Architecture and export surface

`src/application/storefront-templates/contract.ts` defines the strict Zod contracts for:

- versioned template definitions and localized preview metadata;
- page plans and ordered slots;
- required/optional slots and deterministic omission conditions;
- approved capabilities and existing/demo/empty catalogue contexts.

`registry.ts` validates all definitions at module initialization and exports:

- `listTemplates()`;
- `getTemplateById()`;
- `getTemplatePagePlan()`;
- `validateTemplateRegistry()`;
- `cloneTemplateDefinition()` through the public index.

`resolver.ts` exports `resolveTemplate()`, returning an immutable resolved plan with structured
compatibility errors and non-blocking warnings. Required capabilities include requested collection and
product page coverage. Optional logo, imagery, and catalogue capabilities produce warnings when absent.

The template layer imports only a pure supported-vocabulary manifest. The executable renderer registry
remains the runtime owner of rendering; a regression test compares every referenced section type,
allowed page type, and variant against that registry.

## Page-plan and safety rules

Registry validation rejects:

- duplicate template IDs or page-plan IDs;
- duplicate slot IDs;
- unsupported page types, section types, or variants;
- defaults that are not in the allowed variant list;
- required slots with omission conditions;
- duplicate protected header/footer sections;
- headers outside the protected leading position;
- footers that are not last;
- homepages without a required hero or with a hero after merchandising;
- collections without collection introduction or product grid;
- products without product media, product information, the controlled trust/service block, or
  descriptive/specification details, or with product options before information.

Every controlled product foundation includes product media, a product summary, trust/service
presentation, descriptive/specification details, and related-product discovery where the plan
supports it. The details block remains present even when merchant imagery is unavailable; later
planning fills it with supported descriptive, specification, delivery, or returns presentation.

No slot carries product price, SKU, stock, inventory, payment, shipping, tax, order, or catalogue
persistence data. The plans describe composition only.

## Catalogue-context limitation

Resolution accepts one of three explicit contexts:

- `existing` — merchant catalogue presentation is available;
- `demo` — merchandising remains available through approved demo content and returns an informational warning;
- `empty` — the plan remains structurally intact and returns a warning that merchandising must use a safe empty-state presentation.

This layer does not import, map, enrich, persist, or mutate catalogue data. It does not infer business
identity, brand direction, or onboarding values.

## Deferred work

- Template-selection UI in onboarding or the planner
- StorefrontDesignBrief integration by the later planner
- Instantiating section content and generating a validated storefront snapshot
- Industry-specific extensions after the generic foundation is proven
- AI-provider integration and provider prompts
- Catalogue ingestion, product mapping, enrichment, inventory, prices, and stock

## Test coverage

The focused unit suite covers all registry templates, IDs, slots, page plans, localized metadata,
supported renderer vocabulary, ordering and protected-structure failures, required-slot failures,
catalogue contexts, missing capability errors, non-blocking warnings, deterministic page selection,
and clone/registry immutability.
