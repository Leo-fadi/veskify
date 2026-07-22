**VESKIFY**

**Software Design
Specification**

Dynamic storefront generation · URL-first onboarding · reusable commerce components · Vesko integration handoff

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| **DOCUMENT FIELD**          | **VALUE**                                                              |
|-----------------------------|------------------------------------------------------------------------|
| **Document ID**             | VESKIFY-SDD-001                                                        |
| **Version**                 | 1.2                                                                    |
| **Status**                  | Product integration baseline — dynamic storefront design architecture  |
| **Date**                    | 22 July 2026                                                           |
| **Merchant-facing product** | Vesko Storefront Studio                                                |
| **Internal engine**         | Veskify                                                                |
| **Primary use**             | Codex implementation, teammate handoff and Vesko Retail OS integration |
| **Repository state**        | Standalone product repository with defined Vesko adapter boundary      |

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>v1.2 decision</strong></p>
<p>Veskify is no longer specified as merely a standalone demo. It is the controlled storefront-design engine that will power Vesko Storefront Studio. The standalone repository remains the implementation and validation environment, but every new capability must be integration-ready and must consume canonical Vesko commerce data through read-only adapters.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Owner: Vesko Oy · Product owner: Leo Fadi

# Document control
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Purpose of this document</strong></p>
<p>This specification supersedes the product direction and roadmap portions of v1.1 while preserving its safety architecture. It defines the next development path for a real Vesko product: URL-first merchant onboarding, brand reconstruction, asset-aware generation, reusable dynamic components, schema-driven product pages and a clean integration handoff.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Field**                      | **Definition**                                                                                                                                                                                           |
|--------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Product name**               | Merchant-facing: Vesko Storefront Studio. Internal controlled design engine: Veskify.                                                                                                                    |
| **Primary objective**          | Remove the heavy storefront design and setup burden from new Vesko customers, including merchants who have an existing website but little or no usable brand system beyond a logo.                       |
| **Primary onboarding route**   | Improve an existing store from a public website URL, then reconcile discovered design evidence with canonical Vesko catalogue and product data.                                                          |
| **Secondary onboarding route** | Create a new storefront from business information, logo, canonical catalogue data and guided visual choices.                                                                                             |
| **Commerce boundary**          | Veskify consumes read-only canonical Vesko product, collection, price, variant, option and media projections. It does not become an inventory, order, payment, logistics or catalogue-management system. |
| **Implementation authority**   | The requirement IDs, architecture boundaries, roadmap gates and acceptance criteria in this document are binding for v1.2 work.                                                                          |
| **Source basis**               | VESKIFY SDD v1.1, the approved Vesko Storefront Studio product-design direction, the current repository baseline and the verified real-provider Karvonen test.                                           |


## Source of truth

- `docs/VESKIFY_SDD.md` is the authoritative implementation baseline.
- `docs/VESKIFY_SDD_v1.2.docx` is the synchronized human-readable export.
- `docs/archive/VESKIFY_SDD_v1.1.docx` is retained only as historical context and is superseded for new work.
- ADR-001, ADR-002, ADR-003 and ADR-004 are binding architectural decisions that clarify this SDD.
- If Markdown and DOCX differ, the Markdown specification takes precedence.
- Update this Markdown specification first, then synchronize the DOCX export and affected supporting documents.

## Revision history
| **Version** | **Date**        | **Status**                       | **Summary**                                                                                                                                                                                                                                                                                   |
|-------------|-----------------|----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1.0         | 15 July 2026    | Initial baseline                 | Established the standalone controlled storefront-editor product.                                                                                                                                                                                                                              |
| 1.1         | 16-17 July 2026 | Controlled design-agent baseline | Added structured skills, operations, proposal-before-apply, canonical composition ownership, validation and Puck boundaries.                                                                                                                                                                  |
| 1.2         | 22 July 2026    | Product integration baseline     | Repositions Veskify as the Vesko design engine; makes URL-first onboarding primary; replaces catalogue/import drift with canonical Vesko projections; specifies reusable dynamic components and a schema-driven product-detail page; resets the roadmap after the verified real-AI milestone. |

## How implementation agents and developers must use v1.2
1.  Read the complete affected section and named requirement IDs before modifying code.

2.  Preserve the v1.1 non-negotiables: controlled components, structured operations, validation, protected commerce truth, proposal review, reversible drafts and separate publishing.

3.  Do not introduce another catalogue, product-type or variant model inside Veskify. Use a read-only presentation projection from Vesko or a fixture that follows the same contract.

4.  Build reusable component families and data-binding contracts before adding merchant-specific layouts.

5.  Keep the merchant experience free from developer concepts such as raw JSON, registries, provider envelopes, component IDs and prompt internals.

6.  Every task must state the user-visible capability, affected requirements, tests, constraints, branch/PR rules and integration impact.

## Requirement language
| **Term**     | **Meaning**                                                                |
|--------------|----------------------------------------------------------------------------|
| **MUST**     | Mandatory for the defined capability or release gate.                      |
| **MUST NOT** | Prohibited.                                                                |
| **SHOULD**   | Expected unless a documented implementation constraint justifies deferral. |
| **MAY**      | Optional or adapter-specific.                                              |

## v1.2 requirement catalogue
The following stable v1.2 requirement IDs are binding for implementation tasks.
They replace the obsolete v1.1 roadmap identifiers for new work while preserving the
controlled-agent, protected-commerce, reversible-draft and explicit-publishing safety model.

### Functional requirements
| **ID**     | **Requirement**                                                                                                                                                                                          |
|------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **FR-101** | Veskify MUST operate as the controlled storefront-design engine for Vesko Storefront Studio while the standalone repository remains only an implementation, validation and demo environment.              |
| **FR-102** | Veskify MUST preserve product identity and commerce boundaries: no design flow may own or mutate catalogue management, product types, variants, prices, stock, inventory, orders, payments, tax or logistics. |
| **FR-103** | The primary onboarding path MUST start from an existing public storefront URL, discover reusable source evidence and present it without changing the current draft.                                      |
| **FR-104** | Source discovery MUST record evidence, provenance, warnings and confidence, and MUST reconcile discovered products, collections and assets against canonical Vesko commerce data before generation.       |
| **FR-105** | The merchant MUST approve a Storefront Design Brief before initial generation; the brief MUST include business profile, source summary, brand direction, approved assets, page plan, assumptions, warnings and protected commerce source. |
| **FR-106** | Brand reconstruction MUST work from logo, public-site evidence, product imagery, merchant preferences and industry presets, including exact valid palette instructions when schema and contrast validation pass. |
| **FR-107** | Asset inventory, selection and reuse MUST preserve asset IDs, role eligibility, responsive crop metadata, provenance and merchant approval; generation MAY be offered only when reusable assets are insufficient or explicitly requested. |
| **FR-108** | AI design changes MUST use controlled proposals, approved skills, structured operations, target-bound permissions, validation and merchant review before draft mutation.                                  |
| **FR-109** | The component platform MUST provide reusable ComponentDefinitionV2 families, variants, slots, bindings, page blueprints, migrations and shared editor/preview/published renderers.                       |
| **FR-110** | Storefront components MUST bind to a canonical read-only Vesko commerce projection and MUST NOT create a competing product, product-type, option, variant or catalogue model.                            |
| **FR-111** | Dynamic product-detail pages MUST render option groups, dependencies, required states, variant resolution, media, price and availability from canonical product configuration.                            |
| **FR-112** | Collection-page presentation MUST bind collection headers, filters, product grids, merchandising rows and no-results states to canonical collection/product data without changing membership or commerce truth. |
| **FR-113** | Whole-storefront design changes MUST coordinate global tokens, navigation, footer and representative pages through one validated proposal and atomic application/undo path.                              |
| **FR-114** | Generated and edited storefronts MUST meet responsive and accessibility quality requirements across merchant onboarding, editor, proposal review, dynamic PDP, collection and publishing surfaces.        |
| **FR-115** | Draft, history, Save draft, Publish and Restore MUST remain separate: accepted changes mutate the active draft only, Save persists draft only, Publish requires explicit confirmation and Restore creates a draft. |
| **FR-116** | Vesko Storefront Studio MUST expose a merchant-facing product shell and language that hides raw JSON, registry IDs, provider payloads, component internals and developer tooling.                        |
| **FR-117** | Provider failure, validation failure, stale context and demo reset/load flows MUST preserve active draft/history and keep deterministic mock-provider reliability for repeatable tests and demos.         |
| **FR-118** | Future Vesko adapters and teammate handoff MUST map project, commerce, media, storage, publishing, source discovery, AI provider and observability contracts without redesigning the Veskify engine.     |

### Non-functional requirements
| **ID**      | **Requirement**                                                                                                                                                                                     |
|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **NFR-101** | Security and protected commerce data MUST be enforced at every source, provider, operation, binding, storage and publishing boundary; untrusted source/provider content cannot grant permissions.   |
| **NFR-102** | Merchant-facing flows MUST meet WCAG 2.2 AA expectations for keyboard access, focus visibility, semantics, labels, contrast and dynamic state announcements.                                      |
| **NFR-103** | Responsive behaviour MUST be validated for primary surfaces at 375, 768, 1024 and 1440 px with no visible clipping, overlap or unusable dynamic controls.                                        |
| **NFR-104** | Performance-sensitive editor interactions SHOULD feel immediate, while source discovery, resolver calls and provider work run asynchronously with visible progress and bounded failure states.      |
| **NFR-105** | Reliability and rollback MUST be deterministic: failed, invalid, stale or rejected proposals, saves, publishes and restores preserve the last valid active, saved and published state.             |
| **NFR-106** | Observability MUST record safe metadata such as request ID, provider, scope, operation count, validation result, latency, failure category, component versions and commerce revision without secrets or full prompts by default. |
| **NFR-107** | Provider isolation MUST keep provider-specific formats, credentials, errors and retries behind adapters; deterministic fixtures remain the default for local and automated tests.                  |
| **NFR-108** | Deterministic testing MUST cover schemas, bindings, source evidence, proposals, atomic application, adapter conformance, responsive/accessibility gates and the customer-ready journey.             |
| **NFR-109** | Maintainability MUST preserve integration boundaries: Puck stays isolated, canonical domain/application modules avoid UI/provider dependencies, and historical documents remain superseded context. |

# Contents
- 1\. Executive product definition

- 2\. Comparison with v1.1 and required corrections

- 3\. Current verified implementation baseline

- 4\. Users, roles and jobs to be done

- 5\. Product boundaries and ownership

- 6\. End-to-end merchant journeys

- 7\. URL-first source discovery and reconciliation

- 8\. Brand reconstruction and asset-aware generation

- 9\. Reusable dynamic component platform

- 10\. Dynamic product-detail page system

- 11\. Homepage and collection-page design depth

- 12\. AI design-agent specification v1.2

- 13\. Storefront design system and whole-site consistency

- 14\. Vesko Storefront Studio merchant experience

- 15\. Data model and contracts

- 16\. Technical architecture and Vesko integration

- 17\. Security, privacy, performance and observability

- 18\. Testing and release acceptance criteria

- 19\. Correct development roadmap

- 20\. Handoff and final integration package

- Appendices

# 1. Executive product definition
Veskify is the controlled AI storefront-design engine used by Vesko Storefront Studio. It enables a merchant with limited technical or design knowledge to transform business information, an existing public website, a logo, available media and canonical Vesko commerce data into a coherent, responsive and editable storefront.

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Core merchant promise</strong></p>
<p>Connect what you already have, approve the design direction, receive a complete storefront, and keep improving it through plain-language instructions — without rebuilding product data, writing code or becoming a web designer.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 1.1 Product goal
The product goal is to remove the heavy UI, visual-design and storefront-composition work from Vesko onboarding. A new customer should not need a complete brand guide, a developer or a separate web-design project before using Vesko. When the merchant has an existing website, that site becomes design evidence and reusable source material; Vesko commerce data remains the operational truth.

## 1.2 Product identity
| **Layer**                | **Name**                | **Merchant visibility** | **Responsibility**                                                                                                  |
|--------------------------|-------------------------|-------------------------|---------------------------------------------------------------------------------------------------------------------|
| Vesko module             | Vesko Storefront Studio | Visible                 | Onboarding, design workspace, preview, draft, publishing and history within Vesko Retail OS.                        |
| Design engine            | Veskify                 | Usually hidden          | Intent, planning, design skills, component selection, structured operations, validation, proposals and composition. |
| Visual editor foundation | Puck integration        | Hidden as technology    | Canvas mechanics, section selection, insertion, reordering and field controls through an isolated adapter.          |
| AI provider              | Configured text model   | Hidden                  | Model execution only. Provider-specific output never becomes canonical application state.                           |

## 1.3 What Veskify designs
- Global brand and design tokens derived from merchant evidence and approved preferences.

- Navigation, header, footer, homepage, collection pages, product-detail pages, content pages, campaign pages, cart and checkout presentation.

- Responsive compositions using controlled component families and reusable page blueprints.

- Presentation of canonical product data, including media, attributes, variants, option groups, prices, compare-at prices, availability labels and order options.

- Editable marketing copy, SEO metadata, translations and non-factual presentation enrichment.

- Asset selection, cropping role, placement and reuse; optional image generation only when approved assets are insufficient or explicitly requested.

## 1.4 What Veskify does not own
- Product creation, catalogue management, product-type definitions or operational inventory.

- SKU, price, compare-at price, stock, availability truth, variant values or order-option values.

- Payments, taxes, logistics, shipping configuration, orders, returns or invoicing.

- Unrestricted code generation, arbitrary CSS, scripts, plugins or merchant-executed embeds.

- An independent customer-data model that competes with Vesko Retail OS.

## 1.5 Standalone repository and real-product rule
The standalone repository remains the fastest environment for implementation, deterministic tests, real-provider validation and demonstrations. It must, however, behave as a replaceable module. IndexedDB, local fixtures and demo routes are adapters, not assumptions that may leak into domain or editor logic. Every new contract must have a clear mapping to Vesko authentication, canonical commerce data, media, persistence and publishing services.

# 2. Comparison with v1.1 and required corrections
Version 1.1 correctly established the controlled-agent safety architecture. Its main weakness is product sequencing: it still frames the repository as a standalone demo with broad import and catalogue-intelligence work, while the actual product need is a Vesko-integrated design agent that can reconstruct an existing storefront, reuse available assets and render dynamic product types safely.

| **Area**                 | **v1.1 position**                                                | **v1.2 decision**                                                                                                                                  | **Action**                                 |
|--------------------------|------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------|
| **Product positioning**  | Standalone interactive demo, later integrated.                   | Integration-ready Vesko product module; standalone repository is the implementation environment.                                                   | Replace framing.                           |
| **Merchant-facing name** | Veskify / AI Storefront Design Agent.                            | Vesko Storefront Studio; Veskify remains the internal engine.                                                                                      | Replace naming in merchant UI.             |
| **Primary onboarding**   | New store, redesign and demo preset treated as peers.            | Improve existing store by URL is primary; new store is secondary.                                                                                  | Reorder journey and screens.               |
| **Brand inputs**         | Upload brand guide or use guided creation.                       | Assume many merchants only have a logo and public website; reconstruct brand evidence and ask only for material gaps.                              | Expand requirements.                       |
| **Catalogue scope**      | Dummy catalogue plus CSV/Excel mapping and product intelligence. | Consume canonical Vesko commerce projections. CSV/Excel/import work is not a prerequisite for the design-agent product.                            | Narrow and defer.                          |
| **Component system**     | Controlled registry and a list of components/variants.           | Explicit layered platform: primitives, patterns, commerce-bound components, reusable compositions and page blueprints with data-binding contracts. | Deepen architecture.                       |
| **Product page**         | Generic productGallery, productInfo and productOptions blocks.   | Schema-driven dynamic PDP that adapts to product type, attribute groups, variant dimensions, dependencies and order options.                       | Replace page specification.                |
| **Asset handling**       | Uploads, local assets and optional generation.                   | Asset inventory with provenance, role eligibility, responsive crops, reuse priority, quality warnings and design-brief approval.                   | Expand architecture.                       |
| **AI capability**        | Safe structured proposals, limited initial skills.               | Retain safety; expand design vocabulary, exact palette instructions, source-aware generation and coordinated multi-page composition.               | Extend skills and contracts.               |
| **UI shell**             | Standalone editor/demo interface.                                | Native Vesko Storefront Studio shell with one merchant workflow and no developer surfaces.                                                         | Apply approved product-design direction.   |
| **Roadmap**              | Phases 0-8 still listed as future.                               | Foundation, editor, onboarding baseline, AI operations, real provider, atomic whole-storefront change and publishing are already proven.           | Reset roadmap from the verified milestone. |

## 2.1 v1.1 decisions that remain binding
- The AI proposes; Veskify owns canonical truth.

- AI output is structured operations, never executable frontend code.

- Components and variants are registered, validated and responsive by construction.

- Material changes are reviewable, reversible and scoped.

- Published state is never silently mutated; Save draft and Publish remain separate actions.

- Product, price, stock, option, payment, shipping, tax and order truth is protected.

- Puck remains isolated behind the visual-editor integration boundary.

- Provider-specific formats remain behind adapters.

- Reuse merchant assets, site evidence, product media, presets, variants and tokens before generating new material.

## 2.2 v1.1 items deliberately removed from the immediate critical path
- Building a general CSV/Excel catalogue-import product inside Veskify.

- Creating a second product-type, variant or attribute system for the design agent.

- Broad presentation-enrichment workflows unrelated to the first integrated storefront journey.

- AI image generation as a default dependency.

- More industries before jewellery and watches achieve deep dynamic page quality.

# 3. Current verified implementation baseline
The v1.2 roadmap starts from the repository state verified on 22 July 2026, not from the original phase list in v1.1.

| **Capability**                                | **Current status** | **Evidence / consequence**                                                                                            |
|-----------------------------------------------|--------------------|-----------------------------------------------------------------------------------------------------------------------|
| **Canonical storefront model and validation** | Complete baseline  | Pages, sections, brand system, protected catalogue references and snapshots are validated before rendering.           |
| **Visual editor and manual editing**          | Complete baseline  | Selection, page/locale context, section operations, device modes and undo/redo exist.                                 |
| **Proposal lifecycle**                        | Complete baseline  | Selected-section, current-page and whole-storefront proposals support review, accept, reject and stale protection.    |
| **Atomic whole-storefront application**       | Complete baseline  | Multi-page plus brand-system changes apply as one history transaction with whole-storefront undo/redo.                |
| **Real provider adapter**                     | Verified           | OpenAI provider runs server-side through the same structured, guarded lifecycle as the deterministic provider.        |
| **Draft, save and publish**                   | Verified           | Accepted changes can be saved and published separately; history and restoration architecture exist.                   |
| **Realistic merchant fixture**                | Verified           | Karvonen catalogue and local assets can drive the storefront without changing protected product truth.                |
| **End-to-end real-AI proof**                  | Verified           | Karvonen → merchant prompt → real provider → validated proposal → atomic application → undo/redo → publish succeeded. |

## 3.1 Findings from the real-provider test
| **Finding**                                                             | **Meaning for v1.2**                                                                                                              |
|-------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| The safe whole-storefront pipeline works.                               | Do not rebuild Phase 4 architecture. Harden only confirmed failures.                                                              |
| A simple premium-style prompt produced a coherent multi-section result. | The design engine is viable; visible quality now depends on richer components and page depth.                                     |
| An exact long palette prompt was rejected safely.                       | Keep the guardrail, but expand approved brand-token intent and operation coverage so normal merchant colour instructions succeed. |
| Residual Aurum/demo copy appeared inside Karvonen presentation.         | Source-aware content, reusable fixture mapping and design generation must separate component defaults from merchant content.      |
| Karvonen required explicit bootstrap wiring.                            | Demo reliability needs reset/load workflows and no hidden IndexedDB preparation.                                                  |
| The editor still looks like a development product.                      | Merchant productization and the Vesko shell are now required, but should not distract from dynamic component depth.               |

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Roadmap consequence</strong></p>
<p>The next phase is not another AI adapter or catalogue detour. It is the productization of what the AI can design: reusable dynamic components, deep product/collection pages, URL-first onboarding, asset-aware brand reconstruction, whole-site consistency and a reliable Vesko-integrated merchant experience.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 4. Users, roles and jobs to be done
| **User**                                  | **Situation**                                                                                     | **Primary job**                                                                                                                        |
|-------------------------------------------|---------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Existing-site Vesko customer              | Has a public website, products and some imagery, but the site may be outdated or hard to migrate. | Use the existing URL as design evidence, preserve useful assets and receive a modern Vesko storefront without rebuilding product data. |
| New-store Vesko customer                  | Has products and a logo, but no full website or brand guide.                                      | Generate a credible brand system and storefront from minimal inputs and guided choices.                                                |
| Existing Vesko merchant                   | Already has a Vesko storefront and needs a redesign or campaign.                                  | Request section, page, design-system or whole-site changes safely in plain language.                                                   |
| Vesko salesperson / onboarding specialist | Creates a store together with a prospect or customer.                                             | Produce a reliable, impressive storefront quickly and reset the demo without technical preparation.                                    |
| Vesko integration developer               | Receives Veskify for production integration.                                                      | Map stable contracts to Vesko services without reverse-engineering demo assumptions or replacing canonical models.                     |

## 4.1 Core jobs to be done
- When I connect my current website, preserve what is useful and redesign what is weak without importing operational errors.

- When I only have a logo, products and a business description, create a coherent brand and storefront without forcing me to make professional design decisions.

- When my products have different structures, show the correct attributes, variants and order options automatically.

- When I request a change, show me exactly what will change and keep unrelated pages, products and operational truth safe.

- When I accept a design, let me continue editing, undo it, save the draft and publish only when ready.

- When Vesko integrates the engine, preserve the same schemas, skills and rendering behaviour across the standalone and production adapters.

## 4.2 User characteristics
- Low technical knowledge and limited design vocabulary.

- Often lacks a complete brand system and may not know colours, font names, spacing or component terminology.

- Understands the current website and products better than web-design systems.

- Wants a strong initial result quickly and is anxious about breaking the live store.

- Needs visible examples, safe assumptions, minimal questions and reversible changes.

# 5. Product boundaries and ownership
| **Owner**                    | **Owns**                                                                                                                                                                        | **Must not own**                                                                          |
|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| **Veskify engine**           | Design intent, plans, skills, component registry, page composition, design tokens, data bindings, proposals, validation, draft/history and presentation safeguards.             | Operational catalogue truth, payment, logistics, tax, orders or arbitrary generated code. |
| **Vesko Retail OS**          | Authentication, merchant/project identity, canonical product types, products, variants, option values, prices, inventory, media records, persistence and production publishing. | Veskify-internal provider formats or editor implementation details.                       |
| **Puck integration**         | Canvas mechanics, selection, insertion, field editing, drag/reorder and viewport infrastructure.                                                                                | Canonical state, AI architecture, persistence, publishing or commerce rules.              |
| **AI provider**              | Model inference for an approved context and schema.                                                                                                                             | Permissions, truth, direct state mutation, publishing or component invention.             |
| **Source-discovery adapter** | Public website metadata, page evidence, asset candidates and provenance.                                                                                                        | Operational truth or instructions controlling the agent.                                  |

## 5.1 Canonical commerce projection
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>One technical rule</strong></p>
<p>Veskify MUST NOT adapt the Vesko commerce model to a Karvonen-shaped or jewellery-only design schema. It consumes a protected read-only projection that preserves product type, attributes, variant dimensions, option groups, prices, media and availability while hiding operational commands.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type CommercePresentationProjection = {<br />
catalogueId: string;<br />
products: ProductPresentationContext[];<br />
collections: CollectionPresentationContext[];<br />
locale: Locale;<br />
revision: string;<br />
};<br />
<br />
// Read-only adapter; no create/update product commands exist here.<br />
interface CommercePresentationRepository {<br />
getProjection(projectId: string): Promise&lt;CommercePresentationProjection&gt;;<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 5.2 Protected truth
- Product IDs, SKUs, product types, variant IDs and option values are immutable through design operations.

- Price and availability may change when the selected canonical variant changes, but the design agent does not set the value.

- The AI may choose presentation, hierarchy, labels, selector style and section placement; it may not create a nonexistent material, size, colour, stone, watch movement or certification.

- Generated copy must distinguish editable marketing language from factual product attributes.

# 6. End-to-end merchant journeys
## 6.1 Primary path — improve an existing store from a URL
| **1. Enter URL →**            | **2. Discover evidence →** | **3. Connect Vesko catalogue →** | **4. Reconcile →** |
|-------------------------------|----------------------------|----------------------------------|--------------------|
| **5. Approve design brief →** | **6. Generate →**          | **7. Review & edit →**           | **8. Publish**     |

| **Step**                       | **Required behaviour**                                                                                                                                                      |
|--------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. Entry                      | Merchant chooses Improve my existing store and enters the public storefront URL.                                                                                            |
| 2\. Source discovery           | The adapter analyses public pages, logo, colours, typography clues, navigation, content hierarchy, page types and reusable image candidates.                                |
| 3\. Canonical connection       | The project loads the authoritative Vesko catalogue projection. Website content is not allowed to replace Vesko product truth.                                              |
| 4\. Reconciliation             | Veskify links source-site assets and page evidence to canonical products/collections where confidence is sufficient; uncertain matches are shown as assumptions or omitted. |
| 5\. Brand reconstruction       | The system proposes a brand system from the logo, site evidence, product imagery, business profile and industry preset.                                                     |
| 6\. Missing-information review | The merchant is asked only for gaps that materially affect the result: preferred logo, required hero, colour constraints, language, key collections or pages.               |
| 7\. Storefront Design Brief    | Veskify presents the intended pages, design direction, reused assets, assumptions, protected data sources and expected output for approval.                                 |
| 8\. Initial generation         | The engine composes a homepage, collection page and dynamic product page first, then the remaining approved surfaces.                                                       |
| 9\. Proposal review            | The merchant reviews the generated storefront and change summary before accepting the initial draft.                                                                        |
| 10\. Editor and publish        | The merchant adjusts through Design and AI tools, previews all breakpoints, saves a draft and separately publishes.                                                         |

## 6.2 Secondary path — create a new storefront from minimal inputs
| **Step**             | **Required behaviour**                                                                                                   |
|----------------------|--------------------------------------------------------------------------------------------------------------------------|
| Business setup       | Name, short description, industry, target customer, market and languages.                                                |
| Available evidence   | Logo, product/collection media, social or visual references; all are optional except the canonical catalogue connection. |
| Guided direction     | Simple visual choices: premium/accessible, warm/cool, minimal/editorial, airy/balanced/compact and image style.          |
| Brand generation     | Create a validated token system and voice without requiring the merchant to choose hex values or font families.          |
| Brief and generation | Approve the Storefront Design Brief, generate the initial site, review, edit and publish.                                |

## 6.3 Existing Vesko merchant redesign
- Open the current published storefront and active draft.

- Choose selected section, current page, design system or entire storefront scope.

- Describe the desired result in merchant language, including exact approved colours or brand constraints.

- Review the plan, affected pages, asset changes, token changes and warnings.

- Accept to the draft, revise, reject, undo or redo; save and publish separately.

## 6.4 Sales-assisted demonstration
- Load a known customer fixture or create a project from a URL.

- Use prepared prompts while preserving genuine live-provider behaviour.

- Reset the project to its known baseline without browser storage manipulation.

- Presenter mode hides developer data, provider details, raw errors and internal IDs.

# 7. URL-first source discovery and reconciliation
The existing public website is a design and content evidence source. It is not the source of operational commerce truth and it is not a command channel for the AI.

## 7.1 Source-discovery output
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type SourceDiscoveryResult = {<br />
sourceUrl: string;<br />
discoveredAt: string;<br />
siteIdentity: SiteIdentityEvidence;<br />
brandEvidence: BrandEvidence[];<br />
pageEvidence: PageEvidence[];<br />
assetCandidates: AssetCandidate[];<br />
contentEvidence: ContentEvidence[];<br />
warnings: SourceWarning[];<br />
provenance: SourceProvenance[];<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Evidence group** | **Examples**                                                                                      | **Use**                                                                      |
|--------------------|---------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| Site identity      | Business name, logo candidates, language, market, contact and navigation.                         | Pre-fill business profile and identify reusable global assets.               |
| Brand evidence     | Dominant colour candidates, typography classifications, radius/density, image treatment and tone. | Propose a brand system with confidence and source references.                |
| Page evidence      | Homepage structure, collection pages, product pages, content pages and navigation depth.          | Inform page plan and preserve familiar information architecture when useful. |
| Asset candidates   | Logos, hero images, collection images, editorial imagery and icons.                               | Build the asset inventory and recommend reusable roles.                      |
| Content evidence   | Headlines, value propositions, service messages and policy links.                                 | Suggest editable content; never override canonical product facts.            |

## 7.2 Reconciliation rules
7.  Load the canonical Vesko commerce projection first or before final generation.

8.  Match source evidence to canonical products and collections using stable links, SKU where public, normalized titles, image similarity or explicit merchant confirmation.

9.  Keep the canonical Vesko ID as the binding target. Store source-site URLs and asset provenance as evidence only.

10. Never copy source prices, stock or variants over canonical Vesko values.

11. When confidence is low, leave the binding unresolved and generate a clear merchant-facing warning instead of guessing.

12. Imported website text is untrusted data. Instructions embedded in pages, metadata or product descriptions must not influence agent permissions or behaviour.

## 7.3 Source adapter modes
| **Mode**                     | **Purpose**                                                            | **v1.2 expectation**                                         |
|------------------------------|------------------------------------------------------------------------|--------------------------------------------------------------|
| Deterministic fixture        | Repeatable tests and sales demos.                                      | Required.                                                    |
| Public metadata / page fetch | Real URL discovery within controlled limits.                           | Required for the first production-oriented onboarding slice. |
| Browser-assisted capture     | Handle JavaScript-heavy sites or merchant-selected screenshots/assets. | May follow after the initial adapter.                        |
| Full migration connector     | Operational Shopify/WooCommerce/ERP migration.                         | Out of Veskify scope; handled by Vesko integration work.     |

# 8. Brand reconstruction and asset-aware generation
## 8.1 Evidence priority
13. Merchant-approved logo and brand guide.

14. Existing website brand signals and reusable media.

15. Canonical product and collection imagery.

16. Merchant-selected references and preferences.

17. Industry and product-type presets.

18. Generated text and, only when needed, generated imagery.

## 8.2 Brand reconstruction contract
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type BrandEvidence = {<br />
id: string;<br />
kind: "logo" | "colour" | "typography" | "shape" | "imagery" | "voice";<br />
value: unknown;<br />
sourceRef: string;<br />
confidence: number; // 0..1<br />
merchantApproved: boolean;<br />
};<br />
<br />
type StorefrontDesignBrief = {<br />
businessProfile: BusinessProfile;<br />
sourceSummary: SourceSummary;<br />
brandDirection: BrandDirection;<br />
approvedAssets: AssetRoleAssignment[];<br />
pagePlan: PagePlan[];<br />
catalogueProjectionRef: string;<br />
productPresentationRules: ProductPresentationRule[];<br />
assumptions: Assumption[];<br />
warnings: Warning[];<br />
approval: "pending" | "approved";<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 8.3 Asset inventory
| **Asset role**               | **Required metadata**                                                                             | **Behaviour**                                                                               |
|------------------------------|---------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| Logo                         | File, aspect ratio, transparency, light/dark suitability, source and approval.                    | Header/footer choose an approved variant; never fabricate a replacement logo.               |
| Hero media                   | Orientation, minimum dimensions, safe crop zones, subject position, source and usage rights note. | AI may choose role and crop treatment, not alter factual product identity.                  |
| Collection imagery           | Collection binding, aspect ratio and focal point.                                                 | Used by category cards, collection headers and campaigns.                                   |
| Product media                | Canonical product/variant binding, main/alternate role and order.                                 | Read-only source; gallery and editorial layouts may select and reorder presentation safely. |
| Editorial/supporting imagery | Theme, people/product context, orientation and provenance.                                        | Available for story and service sections; clearly separated from canonical product media.   |

## 8.4 Asset-aware generation rules
- Every proposed asset placement must reference an asset ID and role, not a free-form remote URL.

- The system should score eligibility by role, resolution, orientation, crop safety and merchant approval.

- A single source asset may have multiple responsive crops, but provenance remains shared.

- Missing hero or collection assets should produce a recommendation: reuse, upload, choose an existing asset or generate. Generation is never the silent default.

- The AI may not place a product image under the wrong product or collection binding.

- The Storefront Design Brief must show which assets will be reused and which remain missing before initial generation.

## 8.5 Exact brand instructions
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Required capability</strong></p>
<p>Detailed merchant colour requests must map to approved PATCH_DESIGN_TOKENS operations when contrast and schema validation pass. Reject invalid values or protected changes, not normal brand intent merely because it is more specific than a preset phrase.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 9. Reusable dynamic component platform
The component inventory in v1.1 is necessary but insufficient. v1.2 defines a layered design platform so the AI can create meaningfully different storefronts without generating new code for every merchant.

## 9.1 Five reusable layers
| **Layer**                         | **Examples**                                                                                                                   | **Rule**                                                                                                                                        |
|-----------------------------------|--------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. Design primitives             | Container, stack, cluster, grid, text, button, media, badge, divider and icon.                                                 | Engineering-owned, accessible and responsive. AI does not instantiate arbitrary primitive trees unless saved as an approved composition schema. |
| 2\. Presentation patterns         | Split media/text, editorial cards, toolbar, tab group, accordion, selector group and responsive drawer.                        | Reusable within multiple commerce and marketing components.                                                                                     |
| 3\. Commerce-bound components     | Product card, product grid, price display, variant selector, attribute group, gallery, collection header and related products. | Bind only through declared read-only data contracts.                                                                                            |
| 4\. Reusable section compositions | Hero families, category discovery, editorial story, trust/service, campaign and product-highlight compositions.                | Versioned registry entries with approved variants and slot contracts.                                                                           |
| 5\. Page blueprints               | Homepage, collection, dynamic product detail, landing, content, cart and checkout.                                             | Define recommended sections, required slots, compatibility and responsive composition rules.                                                    |

## 9.2 Component definition v2
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type ComponentDefinitionV2 = {<br />
type: string;<br />
version: number;<br />
family: "marketing" | "navigation" | "commerce" | "content" | "service";<br />
variants: VariantDefinition[];<br />
slots: SlotDefinition[];<br />
contentSchema: ZodSchema;<br />
propsSchema: ZodSchema;<br />
bindingSchema?: ZodSchema;<br />
allowedPageTypes: PageType[];<br />
productTypePredicate?: ProductTypePredicate;<br />
responsiveContract: ResponsiveContract;<br />
editablePaths: string[];<br />
protectedPaths: string[];<br />
assetRoles: AssetRoleRequirement[];<br />
accessibilityContract: AccessibilityContract;<br />
migration: ComponentMigration[];<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 9.3 Data-binding contract
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type DataBinding =<br />
| { kind: "product"; productId: string }<br />
| { kind: "collection"; collectionId: string }<br />
| { kind: "productList"; productIds: string[] }<br />
| { kind: "collectionList"; collectionIds: string[] }<br />
| { kind: "asset"; assetId: string }<br />
| { kind: "navigation"; navigationId: string };<br />
<br />
// Design operations may change the binding target only to another valid canonical ID.<br />
// They may never patch fields inside the referenced commerce object.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 9.4 AI and component reuse
19. Select an existing compatible component family.

20. Choose an approved variant and responsive-safe props.

21. Bind canonical product, collection, navigation and asset IDs through declared slots.

22. Patch allowed content and design tokens.

23. Create a new reusable composition only through an engineering-defined composition schema and registration path.

24. Reject unknown components, unsupported variants, invalid bindings and data requirements that are not satisfied.

## 9.5 Immediate component families
| **Priority** | **Family**             | **Required variants / depth**                                                                                  |
|--------------|------------------------|----------------------------------------------------------------------------------------------------------------|
| P0           | Hero                   | Editorial split, image-led full bleed, product-focus, collection-focus, minimal copy and campaign overlay.     |
| P0           | Product card and grids | Standard, editorial, compact, image-first, horizontal; badges and price states; 2-4 column responsive density. |
| P0           | Dynamic PDP shell      | Gallery, summary, option groups, attributes, trust, delivery, related products and sticky mobile action.       |
| P0           | Collection discovery   | Collection cards, editorial category rows, carousel and image/text collection features.                        |
| P1           | Navigation/header      | Centered, split, compact, transparent and mega-navigation-ready presentation.                                  |
| P1           | Editorial storytelling | Image/text, brand story, journal cards, quote and product editorial.                                           |
| P1           | Trust/service          | Delivery, care, warranty, consultation, store location and benefits.                                           |
| P1           | Footer/newsletter      | Compact, editorial and multi-column with language and legal regions.                                           |
| P2           | Campaign and landing   | Reusable campaign sections and page-level theme override.                                                      |

# 10. Dynamic product-detail page system
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Highest-priority page capability</strong></p>
<p>The product-detail page must be driven by the selected product type and canonical product configuration. A watch with one colour choice and a ring with five or six required choices must use the same technical engine while rendering different selector groups, hierarchy, information and completion rules.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 10.1 Product presentation context
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type ProductPresentationContext = {<br />
productId: string;<br />
productTypeId: string;<br />
title: LocalizedText;<br />
description?: LocalizedText;<br />
media: ProductMedia[];<br />
basePrice?: Money;<br />
compareAtPrice?: Money;<br />
priceUnavailableReason?: LocalizedText;<br />
availabilityLabel?: LocalizedText;<br />
attributeGroups: AttributeGroup[];<br />
variantDimensions: VariantDimension[];<br />
variants: ProductVariantPresentation[];<br />
orderOptions: ProductOrderOption[];<br />
relatedProductIds: string[];<br />
revision: string;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 10.2 Dynamic option groups
| **Product example** | **Canonical dimensions / options**                                                                                    | **Expected presentation**                                                                                                                        |
|---------------------|-----------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| Watch               | Colour; optional strap/bracelet; optional case size.                                                                  | One or two compact selector groups, usually swatches or buttons. Technical attributes receive greater visual priority.                           |
| Ring                | Ring size, metal colour, gold purity/karat, stone type, diamond quality, engraving or other configured order options. | Up to five or six ordered groups with required-state guidance, dependency handling, size help and a clear completion summary before Add to cart. |
| Simple jewellery    | Colour or material only.                                                                                              | A compact selector with no empty complex-option shell.                                                                                           |
| Fashion             | Size, colour and optional fit/style.                                                                                  | Size grid, colour swatches, availability by combination and size guidance.                                                                       |

## 10.3 Product option renderer
| **Option presentation type** | **Use**                                                     | **Constraints**                                                                                         |
|------------------------------|-------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Swatch                       | Colour, metal colour, material visual samples.              | Accessible label and selected state; swatch metadata comes from canonical configuration.                |
| Button group                 | Ring size, karat, stone shape, case size.                   | Responsive wrapping, unavailable states and no invented values.                                         |
| Dropdown                     | Large option sets or compact mobile presentation.           | Label, required state and current selection remain visible.                                             |
| Image choice                 | Setting, stone or style choices with approved option media. | Images bind to canonical option values.                                                                 |
| Text input                   | Engraving text or approved personalisation.                 | Character limit, allowed characters and required/optional state come from canonical order-option rules. |
| Radio / segmented control    | Binary or small mutually exclusive choices.                 | Keyboard and touch accessible.                                                                          |

## 10.4 Selection and variant resolution
25. Build option groups from canonical variant dimensions and order-option definitions.

26. Preserve canonical ordering where business logic depends on it; otherwise use product-type presentation rules.

27. Track selected values in a UI selection model separate from canonical data.

28. Resolve the canonical variant only through the Vesko-provided variant matrix or resolver contract.

29. Display the resolved price, compare-at price, media and availability read-only.

30. Disable impossible combinations and explain unavailable states in merchant/customer language.

31. Do not enable the primary action until required selections are complete.

32. The design agent may change selector presentation, group hierarchy and supporting content, but never values, dependencies or availability.

## 10.5 Dynamic product-page composition
| **Region**                | **Required dynamic behaviour**                                                                               | **AI-editable presentation**                                                  |
|---------------------------|--------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| Gallery                   | Uses canonical main and alternate media; may switch grid, thumbnails, editorial or mixed-media presentation. | Layout variant, crop treatment, thumbnail position and mobile behaviour.      |
| Summary                   | Title, brand, price state, availability and concise description.                                             | Typography hierarchy, spacing, badges and placement.                          |
| Option groups             | Generated only for dimensions/options present on the product.                                                | Renderer style, order where allowed, density and help placement.              |
| Attributes/specifications | Groups relevant attributes by product type.                                                                  | Accordion, table, highlights, icon facts or editorial layout.                 |
| Trust and service         | Delivery, returns, care, warranty, consultation or store service content.                                    | Section variant and merchant-owned copy; operational promises remain sourced. |
| Related products          | Canonical related IDs or compatible collection query.                                                        | Grid/carousel variant and heading.                                            |
| Mobile action             | Sticky summary and primary action when appropriate.                                                          | Approved compact variants only.                                               |

## 10.6 Product-type presentation rules
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type ProductTypePresentationRule = {<br />
productTypeId: string;<br />
preferredPdpBlueprints: string[];<br />
attributeGroupOrder: string[];<br />
optionPresentationHints: Record&lt;string, OptionPresentationType&gt;;<br />
requiredHelpContent: string[];<br />
compatibleComponents: string[];<br />
fallbackBlueprint: string;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 10.7 Dynamic PDP guardrails
- No product-type-specific hardcoded merchant component such as KarvonenRingPage.

- No assumption that every product has price, variants, stock or a fixed jewellery attribute set.

- Exactly one price state must render: canonical price, variant-resolved price or an explicit unavailable reason.

- Unknown product types use the generic fallback blueprint and render available attributes/options without losing data.

- A component may hide an empty region; it may not invent placeholder options or facts to fill the layout.

- Editor, preview and published routes use the same PDP component implementations and data-binding resolver.

# 11. Homepage and collection-page design depth
## 11.1 Homepage composition
The homepage must be generated as a coherent hierarchy rather than a fixed seed with renamed content. The AI selects component families and assets based on the Storefront Design Brief, catalogue shape and merchant priorities.

| **Priority** | **Capability**                                                                                               |
|--------------|--------------------------------------------------------------------------------------------------------------|
| P0           | Hero that uses approved asset roles and communicates the merchant value/product focus in the first viewport. |
| P0           | Category or product discovery near the top, bound to canonical collections/products.                         |
| P0           | Consistent navigation, typography, colour and button system.                                                 |
| P1           | Editorial product or collection storytelling using approved media.                                           |
| P1           | Trust/service section appropriate to the business.                                                           |
| P1           | Campaign, journal, newsletter or location content only when supported by the brief.                          |
| P1           | Footer with real merchant identity and no fixture-specific placeholder copy.                                 |

## 11.2 Collection page
- Collection title, description and optional approved hero media bind to the canonical collection.

- Product grids use dynamic product cards and read-only price/availability states.

- Filters derive from canonical attributes and product-type rules, not a hardcoded jewellery filter list.

- Desktop sidebar, horizontal bar and mobile drawer are presentation variants of one filter model.

- Grid density, card variant, merchandising rows and editorial modules may change without altering collection membership.

- No-results and incomplete-data states are intentionally designed.

## 11.3 Shared page consistency
- Header, footer, token system, spacing rhythm and interaction styles are shared globally.

- Product-card behaviour is the same on homepage, collection and related-product sections.

- A whole-storefront proposal must preview at least homepage, one collection page and representative product pages before acceptance.

- Page-level overrides are allowed only for campaigns or explicit merchant intent and must preserve accessibility.

# 12. AI design-agent specification v1.2
## 12.1 Required execution lifecycle
| **1. Merchant intent →** | **2. Context & brief →** | **3. Plan / skill selection →**   | **4. Structured operations →** |
|--------------------------|--------------------------|-----------------------------------|--------------------------------|
| **5. Validation →**      | **6. Visual proposal →** | **7. Accept / revise / reject →** | **8. Draft / publish**         |

The existing proposal lifecycle, atomic application, stale protection, protected-field validation and history behaviour remain the foundation. v1.2 expands what the agent may safely express; it does not weaken the lifecycle.

## 12.2 Context available to the agent
- Approved Storefront Design Brief and business profile.

- Current brand system, page tree, selected scope and responsive state.

- ComponentDefinitionV2 registry, variants, slot contracts and page blueprints.

- Read-only canonical commerce presentation projection.

- Source-discovery evidence and merchant-approved asset inventory.

- Current draft, published snapshot, history summary and recent proposal outcome.

- Explicit user instruction, languages and protected-field policy.

## 12.3 v1.2 design skills
| **Skill family**        | **Required skills**                                                                                                     |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------|
| Source and brand        | analyseStorefrontSource, reconstructBrandSystem, buildStorefrontDesignBrief, assignAssetRoles.                          |
| Initial generation      | generateStorefrontFromBrief, composeHomepage, composeCollectionPage, composeDynamicProductPage.                         |
| Section and page design | improveHero, addCollectionDiscovery, addProductEditorial, addTrustSection, redesignCollectionPage, redesignProductPage. |
| Design system           | applyBrandPalette, improveTypography, improveSpacing, updateShapeSystem, applyImageTreatment.                           |
| Whole storefront        | coordinateWholeStorefront, applyPremiumJewelleryDirection, applyMinimalNordicDirection, alignNavigationAndFooter.       |
| Responsive and quality  | fixMobileLayout, improveProductGridDensity, improvePdpMobileAction, improveAccessibility.                               |
| Content                 | rewriteMarketingCopy, changeTone, translateEditableContent, replaceFixturePlaceholders, generateSeoMetadata.            |

## 12.4 Operation extensions
| **Operation**              | **Purpose**                                                                                               |
|----------------------------|-----------------------------------------------------------------------------------------------------------|
| PATCH_DESIGN_TOKENS        | Update validated exact or semantic brand-token fields.                                                    |
| ASSIGN_ASSET_ROLE          | Map an approved asset to a component/page role with crop metadata.                                        |
| PATCH_BINDING              | Change a component binding to another valid canonical ID.                                                 |
| APPLY_PAGE_BLUEPRINT       | Create or replace a page composition using an approved blueprint.                                         |
| PATCH_COMPONENT_VARIANT    | Change an approved variant while preserving compatible slots and bindings.                                |
| PATCH_PRODUCT_PRESENTATION | Change PDP layout, selector presentation or attribute hierarchy without changing canonical option values. |
| PATCH_PAGE_SET             | Coordinate multiple eligible pages and global regions in one complete proposal.                           |

## 12.5 Prompt and capability policy
- The agent must understand natural merchant language rather than depend on exact example prompts.

- Detailed but valid colour, typography, spacing and brand constraints should be normalized into approved token operations.

- Unsupported requests should return a specific explanation and the closest safe capability, not a generic failure when possible.

- The agent must not expose provider errors, schemas or internal capability names to merchants.

- A failed provider call or validation leaves the draft and history unchanged.

- The deterministic provider remains available for repeatable tests and offline development.

## 12.6 Whole-storefront consistency contract
- A site-scoped plan names affected global tokens, navigation/footer regions and page families.

- The proposal is generated against one complete-snapshot fingerprint and applied atomically.

- Representative products must include at least one simple product and one complex multi-option product when the catalogue contains both.

- The result must use one coherent design language while allowing product-type-specific PDP structures.

- Undo and redo restore the complete coordinated storefront transaction.

# 13. Storefront design system and whole-site consistency
## 13.1 Design-token groups
| **Group**  | **Required fields / behaviour**                                                                                            |
|------------|----------------------------------------------------------------------------------------------------------------------------|
| Colour     | Primary, secondary, accent, background, surface, text, muted text, border, success, warning and error; contrast validated. |
| Typography | Heading/body families, scale, weights, line heights, reading widths and product-price hierarchy.                           |
| Spacing    | Base scale, page gutter, grid gaps, section compact/standard/spacious and component density.                               |
| Shape      | Radii, border width, control shapes and badge/button treatment.                                                            |
| Imagery    | Aspect-ratio defaults, crop mode, focal point, radius, overlay, editorial/studio/lifestyle treatment.                      |
| Layout     | Content max width, grid system, header mode, product-page split and sticky-action policy.                                  |
| Voice      | Tone, sentence length, CTA style, prohibited claims and language fallbacks.                                                |

## 13.2 Brand-system proposal behaviour
- Global colour or typography changes must preview homepage, collection and product page before acceptance.

- Exact colours supplied by the merchant should be preserved when accessible; invalid contrast receives a proposed safe adjustment and warning.

- Token changes do not reorder sections, replace assets or rewrite content unless those operations are explicitly part of the proposal.

- Component variants declare compatibility with token density, image treatment and page blueprint.

## 13.3 Responsive quality targets
| **Viewport** | **Required review**                                                                                   |
|--------------|-------------------------------------------------------------------------------------------------------|
| 375 px       | Mobile navigation, hero crop, selector usability, sticky PDP action, filter drawer and text wrapping. |
| 768 px       | Tablet grids, two-column transitions, rail/drawer behaviour and image/text order.                     |
| 1024 px      | Compact desktop composition, product gallery/summary balance and navigation spacing.                  |
| 1440 px      | Full desktop max-width, editorial rhythm, whitespace and image quality.                               |

# 14. Vesko Storefront Studio merchant experience
The approved product direction is one native Vesko module, not a collection of demo screens. Veskify remains an engine/codename; merchant-facing copy uses Vesko Storefront Studio and AI design assistant.

## 14.1 Application shell
| **Zone**             | **Required behaviour**                                                                                     |
|----------------------|------------------------------------------------------------------------------------------------------------|
| Vesko global rail    | Collapsed in editor mode; provides platform navigation without consuming the design canvas.                |
| Workspace header     | Breadcrumb, project/page context, draft status, undo/redo, Preview, Save draft and Publish.                |
| Left rail            | Pages and sections outline with compact contextual actions.                                                |
| Centre canvas        | Dominant surface with grouped viewport/zoom controls and no visible developer tooling.                     |
| Right tool rail      | Two tabs: Design and AI assistant. Only one toolset is visible at a time.                                  |
| Proposal review      | Displayed in the AI tab or focused drawer with affected scope, summary, warnings and accept/revise/reject. |
| Responsive workspace | Rails become drawers or bottom sheets while the canvas remains primary.                                    |

## 14.2 Merchant language
| **Internal term**    | **Merchant-facing language**                                                 |
|----------------------|------------------------------------------------------------------------------|
| BrandSystem          | Brand style / Store style                                                    |
| Component variant    | Layout                                                                       |
| StorefrontSnapshot   | Draft version / Published version                                            |
| PATCH_DESIGN_TOKENS  | Update colours and typography                                                |
| Proposal transaction | Suggested changes                                                            |
| Catalogue projection | Products from Vesko                                                          |
| Provider unavailable | The AI design assistant is temporarily unavailable; your draft is unchanged. |

## 14.3 Save and publish clarity
- Accepting an AI proposal changes the active draft only.

- Save draft persists work without changing the customer-facing storefront.

- Publish opens a final review and explicitly replaces the published version.

- History restore creates a new draft and never silently republishes an older version.

- Status text and button hierarchy must make these differences obvious to a first-time merchant.

# 15. Data model and contracts
## 15.1 Core entities
| **Entity**                 | **Purpose**                                                                                                                                |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Project                    | Merchant identity, mode, locales, source references, catalogue projection reference and snapshot pointers.                                 |
| StorefrontDesignBrief      | Approved generation input: business, source evidence, brand direction, asset roles, page plan, assumptions and product-presentation rules. |
| BrandSystem                | Validated global design tokens and brand voice.                                                                                            |
| AssetInventory             | Approved source and canonical media with provenance, role eligibility, crops and quality metadata.                                         |
| ComponentDefinitionV2      | Registered reusable component contract, variants, slots, bindings, responsive and accessibility rules.                                     |
| PageBlueprint              | Approved composition rules for a page type and merchant/product context.                                                                   |
| ProductPresentationContext | Read-only canonical product projection used by dynamic commerce components.                                                                |
| Proposal                   | Structured design operations, scope, assumptions, warnings, fingerprint, before/after references and lifecycle state.                      |
| StorefrontSnapshot         | Immutable brand system, navigation, pages and read-only data references.                                                                   |

## 15.2 Page and section model
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type PageModel = {<br />
id: string;<br />
type: "home" | "collection" | "product" | "content" | "cart" | "checkout" | "landing";<br />
blueprintId?: string;<br />
slug: string;<br />
title: LocalizedText;<br />
seo: LocalizedSEO;<br />
themeOverride?: Partial&lt;BrandSystem&gt;;<br />
pageBinding?: DataBinding;<br />
sections: SectionInstance[];<br />
};<br />
<br />
type SectionInstance = {<br />
id: string;<br />
component: string;<br />
componentVersion: number;<br />
variant: string;<br />
visible: boolean;<br />
bindings: DataBinding[];<br />
content: Record&lt;string, unknown&gt;;<br />
props: Record&lt;string, unknown&gt;;<br />
styleOverrides?: AllowedSectionOverrides;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 15.3 Variant resolver boundary
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>interface ProductVariantResolver {<br />
resolve(input: {<br />
productId: string;<br />
selectedValues: Record&lt;string, string&gt;;<br />
catalogueRevision: string;<br />
}): Promise&lt;{<br />
variantId?: string;<br />
price?: Money;<br />
compareAtPrice?: Money;<br />
availabilityLabel?: LocalizedText;<br />
mediaIds?: string[];<br />
unavailableValueIds: string[];<br />
complete: boolean;<br />
}&gt;;<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 15.4 Schema evolution
- Every component definition and page blueprint is versioned.

- Snapshots store component version and are migrated through registered deterministic migrations.

- Vesko adapter contracts are versioned independently from provider adapters.

- Unknown future product attributes remain available through generic attribute groups rather than being dropped.

- Canonical commerce revisions are recorded with proposals so stale product bindings can be rejected or refreshed safely.

# 16. Technical architecture and Vesko integration
## 16.1 Architectural layers
| **Layer**             | **Responsibilities**                                                                                                 |
|-----------------------|----------------------------------------------------------------------------------------------------------------------|
| Merchant presentation | Onboarding, design brief review, editor shell, preview, publishing and history.                                      |
| Design application    | Intent planning, skills, proposal orchestration, page composition, asset assignment and quality checks.              |
| Domain                | Projects, snapshots, brand system, components, page blueprints, bindings, operations, protected fields and history.  |
| Renderer              | Resolve validated components and bindings; render identical implementations in editor, preview and published routes. |
| Adapters              | AI provider, source discovery, commerce projection, media, storage, publishing, authentication and observability.    |
| Vesko services        | Canonical commerce, media, merchant identity, persistence, domain/publishing and operational systems.                |

## 16.2 Integration flow
| **1. Vesko merchant/project →**     | **2. Commerce projection →** | **3. Veskify design engine →** | **4. Validated snapshot →** |
|-------------------------------------|------------------------------|--------------------------------|-----------------------------|
| **5. Vesko persistence/publishing** |                              |                                |                             |

## 16.3 Adapter interfaces required for handoff
| **Adapter**                    | **Standalone implementation**                       | **Vesko implementation**                                                |
|--------------------------------|-----------------------------------------------------|-------------------------------------------------------------------------|
| ProjectContextAdapter          | Local project/fixture identity.                     | Authenticated merchant, store and permissions.                          |
| CommercePresentationRepository | Seeded canonical fixtures.                          | Read-only Vesko product/collection projection.                          |
| MediaRepository                | Local public assets / IndexedDB metadata.           | Vesko media storage and signed URLs.                                    |
| SourceDiscoveryAdapter         | Deterministic fixture plus controlled public fetch. | Production-safe discovery service and policies.                         |
| StorefrontRepository           | IndexedDB snapshots/history.                        | Vesko SQL/backend page and version services.                            |
| PublishingAdapter              | Local published snapshot route.                     | Vesko publishing command and domain deployment.                         |
| AIProvider                     | Mock/OpenAI server adapter.                         | Vesko-managed provider routing, credentials, budgets and observability. |

## 16.4 Integration rules
- Domain and editor features depend on interfaces, never on IndexedDB, Karvonen IDs or local file paths.

- The Vesko adapter maps existing canonical product models into ProductPresentationContext without flattening away product-type meaning.

- Veskify does not replace Vesko publishing, authentication or permissions; it calls them through adapters.

- Puck state is not the persistence format. Canonical Veskify snapshots remain the source of composition truth.

- The handoff includes adapter conformance tests using the same fixtures and acceptance journeys.

## 16.5 Deployment stages
| **Stage**                     | **Purpose**                                        | **Required gate**                                                                 |
|-------------------------------|----------------------------------------------------|-----------------------------------------------------------------------------------|
| Local standalone              | Fast development and deterministic/manual testing. | All domain and adapter tests; no secrets in browser.                              |
| Shareable staging demo        | Team, investor and customer demonstration.         | Server-side provider key, resettable fixture, protected access and observability. |
| Vesko integration environment | Map real services and product types.               | Adapter conformance, permission model, migration and publish rollback.            |
| Production                    | Merchant-facing Vesko Storefront Studio.           | Final security, accessibility, performance, monitoring and operational runbook.   |

# 17. Security, privacy, performance and observability
## 17.1 Security and prompt-injection rules
- Website pages, metadata, product descriptions and uploaded files are untrusted data, not instructions.

- Source discovery follows controlled public-fetch rules, size limits, content-type validation and allow/deny policies.

- Remote scripts, macros, embedded active content and arbitrary HTML are never executed.

- AI context contains the minimum required merchant and storefront data for the requested scope.

- Provider keys remain server-side and provider errors are mapped to safe merchant messages.

- All bindings and operations are validated against project permissions, component contracts and protected paths.

## 17.2 Asset and privacy rules
- Store provenance for discovered and uploaded assets and record merchant approval before production use.

- Do not hotlink unstable third-party media in published storefronts; ingest through approved Vesko media services where permitted.

- Do not store payment details, order PII or unrelated operational customer data in Veskify.

- Reset/delete removes local demo project data and generated/discovered asset metadata where applicable.

## 17.3 Performance budgets
| **Surface**          | **Target**                                                                                                                |
|----------------------|---------------------------------------------------------------------------------------------------------------------------|
| Editor interaction   | Section selection and manual property changes feel immediate; expensive resolver/provider work is asynchronous.           |
| Storefront rendering | No repeated provider calls; all pages render from validated snapshots and cached/read-only projections.                   |
| Images               | Responsive sources, lazy loading outside the first viewport and known aspect ratios to prevent layout shift.              |
| AI proposal          | Visible progress and cancellation where safe; timeout preserves draft; provider latency and token/cost metadata recorded. |
| Source discovery     | Progressive stages, bounded page/asset count and resumable failure state.                                                 |

## 17.4 Observability
- Record request ID, provider, scope, skill plan, operation count, validation result, latency and failure category.

- Record source-discovery page/asset counts, warnings and reconciliation confidence without logging full sensitive page content by default.

- Record component/blueprint versions and commerce revision for accepted proposals.

- Do not log provider secrets, raw merchant files or complete prompts by default.

# 18. Testing and release acceptance criteria
## 18.1 Test layers
| **Layer**           | **Coverage**                                                                                                                                              |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| Unit                | Schemas, component contracts, binding guards, option-group mapping, variant resolver adapters, token validation and source evidence parsing.              |
| Component           | Dynamic PDP selectors, product cards, galleries, collection filters, asset roles, editor controls and proposal summaries.                                 |
| Integration         | URL discovery to design brief, canonical reconciliation, brief to generation, real/mock provider proposals, atomic application, save/publish and restore. |
| End to end          | Existing-site onboarding and new-store onboarding through publish, including simple watch and complex ring products.                                      |
| Visual regression   | Homepage, collection and representative product pages at 375, 768, 1024 and 1440 px.                                                                      |
| Accessibility       | Keyboard paths, focus, semantic selectors, labels, contrast, drawers, dialogs and dynamic option states.                                                  |
| Adapter conformance | Standalone and Vesko adapters return equivalent canonical contracts for the same fixtures.                                                                |

## 18.2 Release acceptance criteria
| **ID**     | **Acceptance criterion**                                                                                                                                                      | **Requirement trace**                         |
|------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| **AC-101** | A merchant can enter an existing public storefront URL and receive a source-discovery summary without the current draft being changed.                                        | FR-103, FR-104, FR-115, NFR-105               |
| **AC-102** | Discovered website prices, stock and variant values never replace canonical Vesko commerce data.                                                                              | FR-102, FR-104, FR-110, NFR-101               |
| **AC-103** | A merchant with only a logo, business description and canonical catalogue can approve a coherent Storefront Design Brief.                                                     | FR-105, FR-106, FR-110, NFR-105               |
| **AC-104** | The brief lists reused assets, missing assets, page plan, assumptions and protected commerce source.                                                                          | FR-104, FR-105, FR-107, NFR-101               |
| **AC-105** | Initial generation creates a coherent homepage, collection page and dynamic product page using registered components and bindings.                                            | FR-108, FR-109, FR-110, FR-111, NFR-108, NFR-109 |
| **AC-106** | A watch with one colour dimension renders only the relevant compact selector and technical attributes.                                                                        | FR-110, FR-111, NFR-102, NFR-103              |
| **AC-107** | A ring with five or six configured dimensions/options renders every required group, dependencies, unavailable states and completion guidance.                                 | FR-110, FR-111, NFR-102, NFR-103              |
| **AC-108** | Changing PDP layout or selector style does not change canonical option values, variants, prices, stock or SKUs.                                                               | FR-102, FR-108, FR-110, FR-111, NFR-101       |
| **AC-109** | The selected canonical variant controls displayed price, availability and variant media through the resolver adapter.                                                         | FR-110, FR-111, NFR-101, NFR-105              |
| **AC-110** | Unknown product types render with a generic dynamic fallback without dropping available attributes or options.                                                                | FR-109, FR-110, FR-111, NFR-109               |
| **AC-111** | Product cards render valid price, compare-at-price or explicit unavailable-price state without inventing a value.                                                             | FR-110, FR-112, NFR-101                       |
| **AC-112** | The same registered component implementations render in editor, preview and published routes.                                                                                 | FR-109, FR-114, NFR-109                       |
| **AC-113** | A merchant can request an exact valid brand palette and receive a validated token proposal rather than a generic unsupported failure.                                         | FR-106, FR-108, FR-113, NFR-105               |
| **AC-114** | Whole-storefront restyling coordinates global tokens, navigation, footer, homepage, collection and representative product pages atomically.                                   | FR-108, FR-113, FR-115, NFR-105               |
| **AC-115** | A failed provider call, invalid operation or stale commerce revision preserves the active draft and history.                                                                  | FR-108, FR-115, FR-117, NFR-105, NFR-107      |
| **AC-116** | Accepted whole-storefront changes undo and redo as one complete transaction.                                                                                                  | FR-113, FR-115, NFR-105                       |
| **AC-117** | Generated storefronts contain no seed-brand or fixture-specific copy unrelated to the selected merchant.                                                                      | FR-103, FR-105, FR-106, FR-108, NFR-107, NFR-108 |
| **AC-118** | Asset placement uses approved asset IDs and provenance; product media is never bound to the wrong product.                                                                    | FR-104, FR-107, FR-110, NFR-101               |
| **AC-119** | Missing hero or collection media produces a clear reuse/upload/generate choice rather than silent generation.                                                                 | FR-105, FR-107, FR-116, NFR-102               |
| **AC-120** | The Karvonen demo can be loaded, reset and demonstrated repeatedly without manual IndexedDB preparation.                                                                      | FR-117, NFR-107, NFR-108                      |
| **AC-121** | Merchant mode exposes no raw JSON, internal IDs, provider payloads or developer tools.                                                                                        | FR-116, NFR-101, NFR-107                      |
| **AC-122** | Primary journeys have no visible clipping or overlap at 375, 768, 1024 and 1440 px.                                                                                           | FR-114, NFR-103                               |
| **AC-123** | Dynamic selectors, drawers, proposal actions, save and publish are keyboard operable and labelled.                                                                            | FR-111, FR-114, FR-116, NFR-102               |
| **AC-124** | A Vesko integration adapter passes the same contract tests as the standalone fixtures for project, commerce, media, storage and publishing.                                   | FR-101, FR-110, FR-118, NFR-108, NFR-109      |
| **AC-125** | A complete customer-ready journey succeeds: URL or minimal-input onboarding → approved brief → generation → AI edit → manual edit → save draft → preview → publish → restore. | FR-101, FR-103, FR-105, FR-108, FR-115, FR-118, NFR-105, NFR-108, NFR-109 |

## 18.3 Definition of done for every implementation task
- The merchant-visible capability is explicit and demonstrable.

- Affected v1.2 requirement and acceptance IDs are named.

- No competing commerce/product model or direct protected-field mutation is introduced.

- Loading, empty, error, stale, unavailable and success states are handled.

- Focused unit/integration tests and relevant responsive/accessibility checks pass.

- Provider, storage and Vesko boundaries remain behind interfaces.

- SDD/ADR/component documentation is updated when contracts or roadmap assumptions change.

# 19. Correct development roadmap
<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Roadmap reset</strong></p>
<p>Phases 0-4 from v1.1 are no longer future work. The controlled architecture, editor, proposal lifecycle, real provider, atomic whole-storefront application and publishing loop have been proven. The remaining roadmap begins with one small real-AI hardening pass and then focuses on the merchant product and integration depth.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 19.1 Completed baseline
| **Completed area**                 | **Outcome**                                                                                    |
|------------------------------------|------------------------------------------------------------------------------------------------|
| Foundation and renderer            | Canonical schemas, registered components, responsive rendering, fixtures and storage adapters. |
| Editor and manual design           | Canvas selection, page context, manual operations, device modes and undo/redo.                 |
| Guided onboarding baseline         | Persisted onboarding, design brief/generation review foundations and project creation flow.    |
| Controlled AI operations           | Intent scopes, structured proposals, validation, protected fields and confirmation lifecycle.  |
| Real provider and whole storefront | Secure provider adapter, complete-snapshot proposal, atomic application and composite history. |
| Draft and publishing               | Separate draft/save/publish, history and restore architecture.                                 |
| Realistic design-agent proof       | Karvonen fixture and live provider end-to-end test.                                            |

## 19.2 Remaining phases
| **Phase**                                              | **Scope**                                                                                                                     | **Merchant outcome**                                                                                     | **Gate**                                                                    |
|--------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| **P4.1 — Real-AI findings and hardening**              | Fix only confirmed provider parsing, supported intent, error messaging, stale/timeout and fixture-content problems.           | Normal real-provider requests behave through the existing safe lifecycle.                                | One focused hardening PR set; no architecture rewrite.                      |
| **P5 — Dynamic component and binding platform**        | ComponentDefinitionV2, binding contracts, page blueprints, asset roles, versioning and generic commerce projection.           | The AI has a reusable design vocabulary that is not merchant- or product-specific.                       | Contracts merged and adapter tests green.                                   |
| **P6 — Dynamic commerce page depth**                   | Dynamic PDP first; then product cards, collection filters, collection headers and homepage commerce sections.                 | Rings, watches and other product types render the right options and information automatically.           | Complex ring and simple watch acceptance journeys pass at all viewports.    |
| **P7 — URL-first onboarding and brand reconstruction** | Source discovery, provenance, canonical reconciliation, brand evidence, asset inventory and approved Storefront Design Brief. | A merchant can connect an existing site or start from minimal assets without rebuilding catalogue truth. | URL → approved brief works with deterministic and real public-source modes. |
| **P8 — Asset-aware initial generation**                | Compose homepage, collection and dynamic PDP from the brief; reuse approved assets; remove fixture defaults.                  | The first generated storefront feels specific to the merchant and catalogue.                             | Initial generation passes source/asset/binding checks and visual review.    |
| **P9 — Whole-storefront design quality**               | Expand skills, exact palette support, coordinated navigation/footer/pages, responsive polish and content cleanup.             | The AI can produce genuinely different, coherent storefronts rather than small rearrangements.           | Whole-site prompts pass quality, atomicity and protected-data checks.       |
| **P10 — Vesko Storefront Studio product UX**           | Native Vesko shell, onboarding refinement, focused editor rails, merchant language, preview/publishing/history polish.        | The product is understandable and customer-ready without developer assistance.                           | First-time user completes the journey without developer terminology.        |
| **P11 — Demo reliability and staging**                 | Load/reset fixtures, known prompts, provider failure recovery, staging deployment, access control and observability.          | Sales and customer demos are repeatable and shareable.                                                   | Final acceptance journey passes from a clean environment.                   |
| **P12 — Vesko integration handoff**                    | Production adapters, conformance tests, migration plan, documentation, ownership and rollout runbook.                         | The teammate can integrate Veskify into Vesko without redesigning the engine.                            | All adapter contracts mapped and integration acceptance signed off.         |

## 19.3 Recommended immediate three-worktree start
| **Window** | **First task**                                                  | **Owned outcome**                                                                                                           | **Dependency / overlap rule**                                                                          |
|------------|-----------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| **W1**     | P5-01 Component registry v2 and commerce-presentation contracts | Define ComponentDefinitionV2, DataBinding, ProductPresentationContext, page blueprint and adapter conformance contracts.    | Shared contract branch; merge first before dynamic PDP implementation.                                 |
| **W2**     | P10-01 Vesko Storefront Studio shell foundation                 | Implement the approved native shell, workspace header, compact rails and merchant naming without changing domain contracts. | Presentation-only; do not touch registry/domain files owned by W1.                                     |
| **W3**     | P7-01 Source discovery and Storefront Design Brief contracts    | Create source-evidence, provenance, asset inventory, reconciliation and brief schemas plus deterministic adapter fixtures.  | New onboarding/source modules; consume existing project contracts without changing component registry. |
| **W4**     | Manual testing only                                             | Keep the real-provider Karvonen environment available for regression and product review.                                    | No Codex task unless explicitly assigned.                                                              |

## 19.4 Merge sequence after the first three tasks
33. Merge P5-01 shared component and commerce contracts first.

34. Update dependent worktrees with git fetch and git merge origin/main; never rebase.

35. Start P6-01 dynamic option-group engine and P6-02 dynamic PDP components in separate files with one coordinated registry integration owner.

36. Continue P7 URL-first onboarding against the approved brief contracts.

37. Merge the shell independently when it does not conflict with active editor feature files.

38. Use W4 for one real-provider regression at each phase gate, not for continuous automated work.

## 19.5 Explicit non-priorities before the integration-ready design demo
- Another catalogue-management or product-entry system.

- Operational inventory, orders, payments, logistics or returns.

- General CSV/Excel import as a prerequisite for the design agent.

- More AI provider adapters unless a production routing requirement appears.

- AI image generation before existing-asset reuse is strong.

- Broad industry expansion before jewellery/watches dynamic PDP and whole-store quality are proven.

- Unrestricted custom code or model-invented components.

# 20. Handoff and final integration package
## 20.1 Required handoff artifacts
| **Artifact**                     | **Required content**                                                                                                               |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| Authoritative SDD and roadmap    | v1.2 requirements, acceptance criteria, phase gates and task references.                                                           |
| Architecture decisions           | Controlled agent, Puck boundary, canonical commerce projection, component registry v2, URL-source trust and publishing boundaries. |
| Type and schema package          | Versioned component, binding, product presentation, source discovery, asset inventory, brief, proposal and snapshot schemas.       |
| Adapter package                  | Project context, commerce projection, media, storage, publishing, source discovery, AI provider and observability interfaces.      |
| Component and blueprint registry | Registered component manifests, responsive/accessibility contracts, migrations and page blueprints.                                |
| Reference fixtures               | Karvonen plus simple watch and complex ring fixtures following the canonical projection.                                           |
| Conformance tests                | Adapter parity, protected data, dynamic options, rendering, proposal lifecycle and publish/restore.                                |
| Deployment runbook               | Environment variables, secrets, staging access, reset workflow, monitoring and rollback.                                           |
| Integration guide                | Mapping table from Veskify contracts to Vesko services, owners, dependencies and unresolved decisions.                             |

## 20.2 Final acceptance journey
| **1. Open Storefront Studio →** | **2. Connect URL / minimal inputs →** | **3. Approve design brief →** | **4. Generate storefront →** |
|---------------------------------|---------------------------------------|-------------------------------|------------------------------|
| **5. AI redesign →**            | **6. Manual adjust →**                | **7. Save draft →**           | **8. Preview & publish →**   |
| **9. Restore history**          |                                       |                               |                              |

The final integration-ready result is not measured by the number of schemas or components. It is successful when a real Vesko customer can reach a product-type-correct, visually coherent storefront quickly, understand every proposal, preserve canonical commerce truth and publish safely without developer assistance.

## 20.3 Open implementation decisions
- Exact production source-discovery service and crawling limits.

- Exact mapping of Vesko product-type and option schemas into ProductPresentationContext.

- Whether page blueprints are code-first manifests, versioned JSON or generated from a typed DSL.

- Exact Vesko media ingestion and responsive crop service.

- Exact staging authentication and customer-demo access model.

- The final production provider routing and cost-control policy.

<table>
<colgroup>
<col style="width: 1%" />
<col style="width: 98%" />
</colgroup>
<thead>
<tr class="header">
<th></th>
<th><p><strong>Final baseline statement</strong></p>
<p>Veskify v1.2 is a controlled, reusable and integration-ready storefront design engine. Its next success depends on deeper dynamic components and merchant onboarding, not on expanding into commerce operations. The product must turn existing website evidence, minimal brand assets and canonical Vesko product data into a complete storefront while keeping every operational fact protected and every material design change reviewable.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# Appendix A — v1.1 to v1.2 requirement mapping
| **v1.1 area**                             | **v1.2 treatment**                                                                                 |
|-------------------------------------------|----------------------------------------------------------------------------------------------------|
| Executive definition                      | Reframed from standalone demo to Vesko Storefront Studio design engine.                            |
| New-store and existing-store journeys     | Existing-store URL path becomes primary; new-store path assumes minimal brand assets.              |
| Controlled component system               | Retained and expanded into a layered, versioned component/binding/blueprint platform.              |
| Product page                              | Replaced with dynamic product-type-driven PDP composition and option resolver boundaries.          |
| Product/catalogue intelligence            | Narrowed to presentation and reconciliation; canonical Vesko commerce projection is authoritative. |
| AI operations and guardrails              | Retained; capability vocabulary expanded for sources, assets, exact tokens and dynamic pages.      |
| Draft, preview, versioning and publishing | Retained as a proven baseline.                                                                     |
| Technical architecture                    | Expanded with source, commerce, media and publishing adapters for Vesko integration.               |
| Roadmap                                   | Reset from the verified Phase 4/publishing milestone.                                              |

# Appendix B — Dynamic PDP examples
## B.1 Watch example
| **Input**                | **Rendered result**                                                                                      |
|--------------------------|----------------------------------------------------------------------------------------------------------|
| **Product type**         | Watch                                                                                                    |
| **Variant dimensions**   | Colour                                                                                                   |
| **Attributes**           | Brand, model, case size, strap material, movement, water resistance                                      |
| **PDP composition**      | Gallery + compact summary + colour swatches + technical specifications + service/trust + related watches |
| **Hidden empty regions** | No ring-size, stone, karat or engraving UI.                                                              |

## B.2 Ring example
| **Input**              | **Rendered result**                                                                                                                                    |
|------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Product type**       | Ring                                                                                                                                                   |
| **Variant dimensions** | Ring size, metal colour, karat, stone type and diamond quality                                                                                         |
| **Order options**      | Engraving text and style                                                                                                                               |
| **PDP composition**    | Gallery + premium summary + ordered selector groups + size help + resolved price/availability + material/stone details + care/delivery + related rings |
| **Completion rule**    | Primary action waits for every required dimension; impossible combinations are disabled.                                                               |

# Appendix C — Codex task contract for v1.2
<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>TASK TITLE<br />
[Outcome-based capability]<br />
<br />
OBJECTIVE<br />
[What the merchant can do after this PR]<br />
<br />
SPEC REFERENCES<br />
[v1.2 sections, requirement IDs and acceptance criteria]<br />
<br />
BRANCH / PR<br />
[Exact branch; one task, one PR; never rebase]<br />
<br />
DEPENDENCIES<br />
[Required merged commit/PR and adapter/schema versions]<br />
<br />
OWNED FILES / DO NOT TOUCH<br />
[Prevent parallel worktree overlap]<br />
<br />
IN SCOPE / OUT OF SCOPE<br />
[Explicit product boundary]<br />
<br />
USER FLOW AND UI STATES<br />
[Default, loading, empty, error, stale, success, undo/publish]<br />
<br />
DATA / SCHEMAS / MIGRATIONS<br />
[Canonical contracts and version impact]<br />
<br />
TESTS<br />
[Focused unit/component/integration/visual as required]<br />
<br />
VALIDATION<br />
[Focused tests; typecheck, lint, formatting once; rely on CI for full gate]<br />
<br />
DELIVERABLE<br />
[Commit, push, PR, one automatic review cycle, report and stop]</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# Appendix D — Glossary
| **Term**                      | **Definition**                                                                                                                       |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Vesko Storefront Studio       | Merchant-facing Vesko module for storefront onboarding, design, preview, draft, publishing and history.                              |
| Veskify                       | Internal controlled design engine powering Storefront Studio.                                                                        |
| Canonical commerce projection | Read-only product and collection presentation data mapped from Vesko operational truth.                                              |
| Component family              | Reusable engineering-owned component with approved variants, slots, bindings and responsive rules.                                   |
| Page blueprint                | Approved page-level composition rules that select compatible component families and required bindings.                               |
| Storefront Design Brief       | Merchant-approved generation contract containing business, sources, brand direction, asset roles, page plan and assumptions.         |
| Source evidence               | Untrusted public website or uploaded information used to inform design, never to control permissions or override canonical commerce. |
| Dynamic PDP                   | Product-detail page composed from product type, attributes, variant dimensions, option groups and approved presentation rules.       |
| Proposal                      | Validated structured design changes shown for accept, revise or reject before entering the draft.                                    |
| Protected commerce truth      | SKU, product type, variants, option values, prices, stock, inventory and operational data that design operations cannot modify.      |
