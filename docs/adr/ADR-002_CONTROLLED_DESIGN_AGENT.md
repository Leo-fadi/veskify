# ADR-002: Controlled Skills and Structured Design Operations

- **Status:** Accepted
- **Version:** 1.2
- **Decision date:** 2026-07-16
- **Decision owners:** Veskify product and engineering
- **Related document:** `docs/VESKIFY_SDD.md` and `docs/VESKIFY_SDD_v1.2.docx`
- **Related decisions:** ADR-001 — Puck as the embedded editor foundation; ADR-003 — URL-first discovery and reconciliation; ADR-004 — dynamic commerce-bound components

## 1. Context

Veskify serves everyday retailers with little technical or design knowledge. The merchant should be able to describe an outcome such as “make this homepage feel more luxurious” and receive a coherent, reviewable design proposal.

A naive AI website-builder architecture would repeatedly generate complete pages, frontend code, new component implementations, and visual assets. This creates several problems:

- high token and generation cost;
- inconsistent visual quality;
- unwanted components and assets;
- difficult validation and regression testing;
- unpredictable mobile and accessibility behaviour;
- risk of modifying unrelated content;
- risk of bypassing draft, publishing, and commerce protections;
- poor merchant trust when results vary widely between attempts;
- difficult future integration into Vesko’s canonical data and publishing services.

Veskify already uses Puck for editor mechanics and a Veskify-owned controlled component registry. The remaining decision is how AI should plan and apply design changes.

## 2. Decision

Veskify will use a **controlled design-skills architecture**.

The AI does not generate or execute arbitrary frontend code. It interprets merchant intent, selects approved skills, and returns structured design operations that Veskify validates before presenting a draft proposal.

The canonical pipeline is:

```text
Merchant request
  -> intent interpretation
  -> design plan
  -> approved skills
  -> structured operations
  -> schema and semantic validation
  -> proposal and preview
  -> merchant accept, revise, or reject
  -> explicit draft save or publish
```

## 3. Core principles

### 3.1 The AI proposes; Veskify owns the truth

AI output is untrusted until validated. Canonical Veskify models, validators, the component registry, protected-field rules, and repository services determine whether a proposed change may enter draft state.

### 3.2 Skills are bounded capabilities

Each skill defines:

- supported intent;
- scope;
- required context;
- allowed components;
- allowed operations;
- protected fields;
- output schema;
- semantic validation;
- proposal summary;
- tests and failure behaviour.

Skills cannot expand their own permissions.

### 3.3 Operations, not code

AI and skills may emit approved operations such as:

- update section content;
- change component variant;
- add or remove an approved section;
- reorder sections;
- update validated brand tokens;
- create a separate presentation-enrichment proposal.

They may not emit executable React, HTML, CSS, JavaScript, scripts, or arbitrary embeds.

### 3.4 Reuse before generation

Veskify prefers:

1. merchant-provided brand assets;
2. existing website and storefront assets;
3. product and catalogue imagery;
4. industry presets;
5. existing component variants;
6. existing brand tokens;
7. generated text;
8. generated imagery only when necessary.

This reduces cost, inconsistency, duplication, and unwanted assets.

### 3.5 Proposal before material change

The merchant sees a concise explanation and visual proposal before accepting material changes. Rejected proposals do not alter the prior draft. Publishing remains explicit and separate.

### 3.6 Presentation enrichment is non-destructive

Veskify may create reviewable suggestions for product titles, descriptions, attributes, collections, filters, translations, and SEO. Source commerce data remains protected and unchanged unless exported and accepted through a future Vesko workflow.

## 4. Ownership boundary

### Veskify owns

- intent, planning, and skill contracts;
- component registry and variants;
- structured operation schemas;
- schema and semantic validation;
- proposal state and merchant summaries;
- canonical page composition;
- draft, published, history, and restore workflows;
- provider abstraction;
- protected commerce rules;
- presentation enrichment;
- future Vesko adapters.

### Puck owns

- canvas interaction;
- section selection;
- insertion and reordering mechanics;
- editor fields and viewport controls;
- editor infrastructure through documented APIs.

Puck does not become the AI architecture, source of truth, persistence layer, or publishing service.

### AI providers own

Only model execution. Provider-specific formats are mapped behind adapters into Veskify-owned intent, plan, skill, and operation contracts.

## 5. Alternatives rejected

### 5.1 Unrestricted prompt-to-code generation

Rejected because it is expensive, difficult to validate, visually inconsistent, insecure, hard to test, and incompatible with controlled components and future Vesko integration.

### 5.2 Generate an entirely new page for every request

Rejected because small merchant requests should not replace unrelated sections or destroy prior manual work. Section- and page-scoped operations are safer and more understandable.

### 5.3 Let the model invent new components dynamically

Rejected because new component code cannot guarantee responsive behaviour, accessibility, visual consistency, performance, or compatibility with Puck and published rendering.

New components may be created by engineering and added to the controlled registry through normal development and review.

### 5.4 Generate new imagery by default

Rejected because merchant, product, and approved industry assets are often more accurate and on-brand. Automatic imagery also adds cost, duplicates, licensing/provenance concerns, and unwanted media.

### 5.5 Use Puck AI or Puck Cloud as the agent/persistence layer

Rejected because Veskify must own AI behaviour, validation, proposals, persistence, publishing, commerce protection, and Vesko integration.

### 5.6 One giant universal design skill

Rejected because permissions, outputs, failures, testing, and token use would be difficult to control. Small composable skills give clearer boundaries and more reliable results.

## 6. Consequences

### Positive

- lower token and image-generation use;
- more repeatable design quality;
- less unwanted content and assets;
- safer section-scoped changes;
- clear tests and acceptance criteria;
- stronger retailer trust;
- easier EN/FI localization;
- clean provider replacement;
- clean Vesko integration path;
- consistent editor, preview, and published rendering.

### Costs

- skills and operation schemas require deliberate engineering;
- the component and skill catalogues must be curated;
- the agent cannot satisfy requests beyond approved capabilities without clarification or future engineering work;
- mappings and validators add boundary code;
- generated variety is constrained by the available components, variants, presets, and tokens.

These costs are accepted because reliability and merchant satisfaction are more important than unrestricted generation.

## 7. Compliance requirements

The architecture complies with this decision when:

- every AI-originated storefront change is represented as an approved structured operation;
- all operations pass schema and semantic validation before draft mutation;
- skills declare allowed operations and protected fields;
- unknown components, variants, fields, and operations are rejected;
- product price, SKU, stock truth, payment, shipping, tax, order, inventory, and operational checkout data remain protected;
- rejected or failed proposals leave prior draft state intact;
- generated media is optional, justified, and has provenance;
- Puck-specific types remain isolated in the Puck integration layer;
- provider-specific types remain isolated in provider adapters;
- the published snapshot changes only after explicit confirmation;
- the same Veskify component implementations render in editor, preview, and published storefronts.

## 8. Current status and implementation consequence

The controlled proposal architecture, real provider adapter, section/page/storefront scopes, atomic application, undo/redo, save and publish lifecycle have been implemented and verified through the Karvonen real-provider test.

This ADR therefore remains binding, but its original implementation sequence is complete. New work follows the v1.2 roadmap:

1. harden only confirmed real-provider failures;
2. establish reusable component and data-binding contracts;
3. build dynamic product and collection page depth from canonical commerce projections;
4. add URL-first source discovery, brand reconstruction and an approved Storefront Design Brief;
5. generate asset-aware merchant-specific storefronts;
6. expand exact palette and whole-storefront design quality;
7. productize the engine as Vesko Storefront Studio;
8. complete staging reliability and Vesko integration handoff.

This decision does not authorize a second catalogue model, merchant-specific component code or weaker validation in order to increase generation freedom.
