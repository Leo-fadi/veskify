# Veskify Development Roadmap

**Version:** 1.1  
**Aligned with:** authoritative `docs/VESKIFY_SDD.md` and synchronized export `docs/VESKIFY_SDD_v1.1.docx`  
**Product:** Veskify — AI storefront design agent for retailers

## 1. Product outcome

Veskify enables a retailer with little or no design or technical knowledge to create and redesign an online storefront through guided onboarding, natural-language requests, a controlled visual editor, and explicit approval.

Veskify is a **design agent**, not a commerce operations platform. It may consume and enrich product presentation data, but it must not own or alter live prices, stock, payments, logistics, taxes, orders, or operational checkout settings.

The core design pipeline is:

```text
Merchant request
  -> intent interpretation
  -> design plan
  -> approved design skills
  -> structured design operations
  -> schema and semantic validation
  -> draft proposal
  -> visual preview
  -> merchant accept, revise, or reject
  -> apply accepted operations to the active draft
  -> save draft
  -> explicit publish
```

Puck is the permanent embedded visual-editor foundation. Veskify owns the canonical composition, design system, component contracts, agent skills, operations, validation, draft state, publishing rules, and Vesko integration boundary.

## 2. Current baseline

### Completed

- Next.js App Router, React, strict TypeScript, Tailwind CSS, Zod, Vitest, Playwright, and pnpm foundation;
- Puck isolated behind `src/integrations/puck`;
- canonical project, page, section, snapshot, brand, catalogue, and history models;
- deterministic jewellery seed data in English and Finnish;
- in-memory and IndexedDB repository adapters;
- separate draft and published snapshots;
- protected commerce fields and dummy operational data;
- real `/projects/[projectId]/editor` route;
- homepage, collection, and product switching;
- EN/FI switching inside the editor and iframe;
- page-scoped Puck configuration;
- add, select, edit, reorder, and remove approved sections;
- validated in-memory editing;
- unsaved state and discard;
- bounded canonical per-page undo/redo for manual edits and accepted proposals;
- safe selected-section duplicate and hide/show actions;
- protected commerce-field enforcement;
- controlled storefront design vocabulary;
- multiple variants and brand-token controls;
- deterministic structured design operations;
- in-memory proposal create, inspect, accept, and reject lifecycle;
- canonical controlled-skill contract and typed skill registry;
- deterministic EN/FI intent classification and immutable design planning;
- transactional orchestration for luxury, minimal Nordic, campaign-section, and hero skills;
- deterministic provider facade and existing-proposal lifecycle conversion.

### Still pending from Week 1

- cart and checkout editor surfaces;
- persisting edits after refresh;

### Still pending from Week 2

- proposal UI inside the editor;
- proposal revision workflow;
- broader skills implementation and merchant-facing orchestration;
- applying accepted proposals to the active editor draft;
- broader page-composition operations.

Weeks 1 and 2 are therefore **partially completed**. Week 3 is the clear next milestone, while the remaining Week 1 and Week 2 items should be completed only where they directly support the Week 3 merchant flow.

## 3. Six-week delivery plan

### Week 1 — Real editor and storefront design vocabulary

**Status: Partially completed**

#### Completed

- real project editor route;
- homepage, collection, and product switching;
- EN/FI switching;
- page-scoped Puck configuration;
- add, select, edit, reorder, and remove approved sections;
- validated in-memory editing;
- unsaved state and discard;
- bounded canonical per-page undo/redo;
- selected-section duplicate and hide/show actions;
- protected commerce-field enforcement;
- controlled storefront design vocabulary with multiple variants and brand-token controls.

#### Remaining

- cart and checkout editor surfaces;
- persistence after refresh;
- final responsive preview and remaining component polish.

#### Exit criteria

- A non-technical user can edit supported pages without seeing code or implementation concepts.
- The same controlled components render in editor, preview, and storefront routes.
- Invalid components and protected product fields cannot enter draft state.

### Week 2 — Structured design operations and proposals

**Status: Partially completed**

#### Completed

- deterministic structured design-operation schemas and executor foundation;
- protected-field validation;
- section add, remove, reorder, content, prop, style-token, variant, and brand-token operations;
- deterministic homepage proposal generation;
- in-memory proposal create, inspect, accept, and reject lifecycle.

#### Remaining

- proposal UI inside the editor;
- proposal revision workflow;
- applying accepted proposals to the active editor draft;
- duplicate and visibility operations;
- broader page-composition operations;
- broader skills implementation and merchant-facing orchestration.

#### Exit criteria

- A request creates a valid proposal without mutating the active draft before acceptance.
- Accepted operations can be applied to the active draft through the editor flow.
- Rejected proposals leave the active draft and published snapshot unchanged.

### Week 3 — Merchant chat, intent planning, and skills orchestration

**Status: Partially completed**

#### Completed

- deterministic EN/FI classification for the initial supported request families;
- scope-aware design plans with ordered approved skills and merchant-facing explanations;
- initial `applyLuxuryStyle`, `applyMinimalNordicStyle`, `addCampaignSection`, and `improveHero`
  implementations;
- transactional execution, rollback, protected-commerce enforcement, and canonical page validation;
- conversion into the existing proposal lifecycle without UI, persistence, or publishing coupling;
- deterministic provider facade that runs without external credentials.

#### Remaining

- merchant-friendly chat beside the canvas;
- proposal and confirmation UI integration;
- proposal revision and applying accepted proposals to the active editor draft;
- optional real provider adapter;
- remaining initial workflows and broader skill catalogue.

#### Goal

A retailer can request design changes in everyday language.

#### Deliverables

- merchant-friendly chat beside the canvas;
- intent classification and scope resolution;
- design planner that chooses approved skills;
- skill execution plan visible as a short human explanation;
- confirmation cards for material changes;
- deterministic mock provider for repeatable testing;
- optional real provider interface isolated behind an adapter;
- clarification only when missing information materially affects the design;
- initial complete workflows:
  - “Make the homepage feel more luxurious.”
  - “Create a summer campaign section.”
  - “Improve this hero for mobile.”
  - “Use our brand colours and make the typography more premium.”

#### Exit criteria

- Chat requests produce structured proposals, not raw code.
- The retailer can accept, revise, or reject before changes become part of the draft.

### Week 4 — Guided storefront creation

#### Goal

A new retailer can move from business information to an editable storefront.

#### Deliverables

- guided onboarding for:
  - business identity and description;
  - industry and target customer;
  - existing website reference;
  - logo, colours, typography, and media;
  - visual preferences;
  - language selection;
  - catalogue source;
- generated brand system when complete guidelines are unavailable;
- initial store generation using approved industry presets and skills;
- editor introduction showing how to select and edit sections;
- jewellery-first template set for homepage, collection, and product presentation.

#### Exit criteria

- A retailer can reach a usable first storefront within 30 minutes.
- Generation reuses existing merchant assets and presets before creating new content or imagery.

### Week 5 — Real merchant data and presentation enrichment

#### Goal

Veskify can design from real-life merchant catalogue and media data without becoming the source of commerce truth.

#### Deliverables

- CSV and Excel catalogue import;
- configurable field mapping into Veskify display models;
- product media upload and mapping;
- jewellery and watch attribute detection;
- suggestions for collections and storefront filters;
- EN/FI translation and SEO metadata generation;
- missing-content and duplicate-presentation detection;
- separate, reviewable enrichment layer;
- export/import contracts for future Vesko integration;
- one real merchant catalogue tested end to end.

#### Exit criteria

- Source product data remains unchanged.
- Enriched presentation data is reviewable, reversible, and exportable.
- Product price, SKU, stock, and operational attributes remain protected.

### Week 6 — Save/publish integration, reliability, and full demo

#### Goal

Deliver a stable, customer-ready Veskify demo and a clean Vesko integration boundary.

#### Deliverables

- save draft;
- full-page draft preview;
- explicit publish confirmation;
- previous published version and restore-to-draft;
- public or shareable demo preview route;
- accessibility and keyboard QA;
- desktop/mobile visual regression;
- error recovery and empty/loading states;
- performance and bundle review;
- deployment environment;
- Vesko integration adapter documentation and sample payloads;
- prepared demo journeys and merchant scenarios;
- final bug and polish buffer.

#### Exit criteria

- No change reaches the published storefront without explicit approval.
- The jewellery demo works with real merchant data and survives refresh/reload.
- The codebase exposes clear interfaces for Vesko authentication, catalogue, media, persistence, and publishing services.

## 4. Initial design-skill priority

Build a small, deep catalogue before expanding breadth.

### Store creation

1. `generateBrandSystem`
2. `generateHomepage`
3. `generateCollectionPage`
4. `generateProductPage`

### Section and campaign design

5. `generateHero`
6. `improveHero`
7. `addCampaignSection`
8. `addFeaturedCategories`
9. `addProductGrid`
10. `improveHeader`
11. `improveFooter`

### Visual direction

12. `applyLuxuryStyle`
13. `applyMinimalNordicStyle`
14. `improveTypography`
15. `improveSpacing`
16. `fixMobileLayout`

### Presentation enrichment

17. `detectJewelleryAttributes`
18. `suggestCollections`
19. `suggestFilters`
20. `translateStorefront`

## 5. Scope controls

The six-week demo must remain focused:

- jewellery and watches are the complete first industry;
- 10–12 excellent components are preferred over a large shallow registry;
- 12–20 reliable skills are preferred over unrestricted generation;
- image generation is optional and used only after merchant assets, product imagery, presets, and existing variants are considered;
- no live payments, shipping, logistics, orders, taxes, or inventory operations;
- no arbitrary generated React, HTML, CSS, JavaScript, scripts, or embeds;
- no second persisted Puck page tree;
- no silent publishing;
- no infrastructure-only work unless it directly unblocks the next visible merchant journey.

## 6. Product completion test

The full demo is ready when a retailer can:

1. provide business, brand, media, and catalogue information;
2. receive a generated jewellery storefront using approved components;
3. edit the storefront manually in Puck;
4. request design changes through chat;
5. review structured proposals;
6. accept, revise, or reject changes;
7. preview the complete draft;
8. explicitly publish it;
9. return later and restore or redesign without losing commerce truth.
