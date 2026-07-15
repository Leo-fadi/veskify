**VESKIFY**

Software Design Specification

AI Storefront Design Agent · Standalone Demo Product

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| **DOCUMENT ID** | VESKIFY-SDD-001                            |
|-----------------|--------------------------------------------|
| **VERSION**     | 1.0                                        |
| **STATUS**      | Implementation baseline                    |
| **DATE**        | 15 July 2026                               |
| **PRIMARY USE** | Codex implementation and product alignment |
| **REPOSITORY**  | New standalone repository                  |

Owner: Vesko Oy · Product: Veskify

# Document control

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Purpose of this document</strong></p>
<p>This specification is the authoritative baseline for the Veskify standalone demo. It is written to be directly usable by Codex and by Vesko developers who later integrate the product into Vesko Retail OS.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Field**                | **Definition**                                                                                              |
|--------------------------|-------------------------------------------------------------------------------------------------------------|
| Product name             | Veskify — AI Storefront Design Agent / UI Agent                                                             |
| Product type             | Standalone interactive demo, later integrated into Vesko Retail OS                                          |
| Primary objective        | Enable low-technical-skill retailers to create or redesign a complete online storefront visually and safely |
| Data policy for demo     | Dummy commerce data; local demo projects and draft/published snapshots                                      |
| Implementation authority | This document takes priority over ad hoc implementation assumptions                                         |
| Change policy            | Material changes must update this document, its requirement IDs, and affected acceptance criteria           |

## How Codex must use this document

> **1.** Read the complete relevant section before modifying code. Do not implement from an isolated task sentence when this document defines the behaviour.
>
> **2.** Treat every MUST requirement and acceptance criterion as binding. SHOULD requirements may be deferred only when the task explicitly says so.
>
> **3.** Generate UI from controlled schemas and approved components. Never let the AI generate arbitrary executable frontend code.
>
> **4.** Keep draft changes separate from the published demo snapshot. No AI action may silently alter the published version.
>
> **5.** Use dummy commerce operations. Do not add real payment, shipping, order, pricing, inventory, or tax configuration.
>
> **6.** For each task, identify the affected requirement IDs and include tests for the relevant acceptance criteria.

## Requirement language

| **Term** | **Meaning**                                                  |
|----------|--------------------------------------------------------------|
| MUST     | Mandatory for the defined release or behaviour.              |
| MUST NOT | Prohibited.                                                  |
| SHOULD   | Expected unless there is a documented implementation reason. |
| MAY      | Optional or implementation-dependent.                        |

# Contents

[<u>1. Executive product definition</u>](#executive-product-definition)

[<u>2. Product principles and boundaries</u>](#product-principles-and-boundaries)

[<u>3. Users, roles and jobs to be done</u>](#users-roles-and-jobs-to-be-done)

[<u>4. End-to-end user journeys</u>](#end-to-end-user-journeys)

[<u>5. Information architecture and screens</u>](#information-architecture-and-screens)

[<u>6. Functional requirements</u>](#functional-requirements)

[<u>7. Editor and interaction specification</u>](#editor-and-interaction-specification)

[<u>8. Storefront design system</u>](#storefront-design-system)

[<u>9. Controlled component system</u>](#controlled-component-system)

[<u>10. Page specifications</u>](#page-specifications)

[<u>11. Product and catalogue intelligence</u>](#product-and-catalogue-intelligence)

[<u>12. AI agent specification</u>](#ai-agent-specification)

[<u>13. Draft, preview, versioning and publishing</u>](#draft-preview-versioning-and-publishing)

[<u>14. Localisation and content</u>](#localisation-and-content)

[<u>15. Data model and schemas</u>](#data-model-and-schemas)

[<u>16. Technical architecture</u>](#technical-architecture)

[<u>17. API and service contracts</u>](#api-and-service-contracts)

[<u>18. Non-functional requirements</u>](#non-functional-requirements)

[<u>19. Analytics, errors and observability</u>](#analytics-errors-and-observability)

[<u>20. Security and privacy</u>](#security-and-privacy)

[<u>21. Testing and acceptance criteria</u>](#testing-and-acceptance-criteria)

[<u>22. Implementation roadmap</u>](#implementation-roadmap)

[<u>23. Codex execution contract</u>](#codex-execution-contract)

[<u>Appendices</u>](#appendices)

# 1. Executive product definition

Veskify is a standalone AI storefront design agent for retailers. It allows a merchant with very limited technical or design knowledge to create, redesign and maintain the customer-facing experience of an online store through guided onboarding, conversational instructions, a visual canvas, structured controls and safe approval flows.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Core experience</strong></p>
<p>Describe what you want, see the proposed result in a draft, adjust it visually, and explicitly save it — without writing code or understanding professional design tools.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 1.1 Product goal

The goal is to demonstrate how Vesko can replace a traditional drag-and-drop website builder with an AI-guided design environment. The demo must feel like a real product rather than a static prototype, while using dummy commerce data and local/mock integrations.

## 1.2 What Veskify designs

- Complete storefront page structures and responsive layouts.

- Industry-specific visual systems, themes and page compositions.

- Homepages, collection pages, product pages, content pages, cart and checkout user interfaces.

- Navigation, footer, search and filter presentation.

- Marketing sections, campaign landing pages, hero banners and promotional content.

- Written content, SEO metadata, translations and generated visual assets.

## 1.3 What Veskify does not manage

- Product pricing or price changes.

- Payment provider activation, payment rules or payment processing.

- Shipping methods, shipping prices, logistics services or delivery configuration.

- Taxes, tax rules, invoicing rules or financial operations.

- Order operations, returns operations or inventory quantities.

- Real storefront deployment or production infrastructure in the standalone demo.

## 1.4 Demo definition

The first implementation is a standalone repository. It uses dummy product, collection, cart, checkout and operational data. It must provide realistic creation, editing, preview, draft and simulated publishing behaviour. Later, Vesko developers will integrate the design agent with Vesko Retail OS, its Node.js monorepo, SQL data, JSON-based industry product models, media storage, authentication and publishing services.

# 2. Product principles and boundaries

| **Principle**               | **Required interpretation**                                                                                                                      |
|-----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| Canvas first, chat assisted | The storefront canvas is the primary product surface. Chat is the simplest control interface, not the product by itself.                         |
| Safe by default             | AI changes are made to a draft and require explicit user approval before replacing the published demo snapshot.                                  |
| Controlled creativity       | The agent may compose and configure approved components and design primitives but must not generate unrestricted frontend code.                  |
| Simple language             | Controls, questions and confirmations must use retailer-friendly language rather than developer or designer terminology.                         |
| Progressive disclosure      | The default interface exposes only the minimum controls needed. More detailed options appear when the user asks or selects advanced editing.     |
| Local editing               | Regenerating one section must not change unrelated sections, page structures or the global brand system unless explicitly requested.             |
| Design consistency          | Every page must inherit the same design tokens, typography, spacing, navigation and footer unless the page has an intentional campaign override. |
| Responsive by construction  | All approved components must be responsive and tested. Users cannot freely resize sections in ways that break responsive behaviour.              |
| Reversible actions          | Users can review, undo, reject, discard or restore changes without losing the last published version.                                            |

## 2.1 Fixed product boundaries

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>No arbitrary code generation</strong></p>
<p>AI output is structured storefront JSON that references registered components and validated properties. It is never JavaScript, React, HTML or CSS executed directly.</p></th>
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
<th><p><strong>No silent publication</strong></p>
<p>A generated result may appear in the draft canvas immediately, but it may not alter the published demo snapshot until the user activates Save changes and confirms the action.</p></th>
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
<th><p><strong>No commerce configuration</strong></p>
<p>Cart and checkout are visual design surfaces only. All payment, shipping, tax and operational values shown in the demo are non-editable dummy content.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 2.2 Scope classification

| **Capability**                     | **V1 status** | **Notes**                                                   |
|------------------------------------|---------------|-------------------------------------------------------------|
| New-store guided creation          | In scope      | Complete onboarding to generated draft storefront.          |
| Existing-store redesign            | In scope      | Via demo URL analysis or a simulated import path.           |
| Section-level edits                | In scope      | Chat and manual canvas controls.                            |
| Whole-site restyling               | In scope      | Changes global tokens and compatible component variants.    |
| Marketing landing pages            | In scope      | Create new page from approved page template and components. |
| Real Shopify/WooCommerce migration | Out of scope  | Demo may simulate mapping and use uploaded data locally.    |
| Real Instagram integration         | Out of scope  | Present as a simulated source or uploaded-media workflow.   |
| Real backend publishing            | Out of scope  | Simulated published snapshot and preview URL.               |
| Arbitrary custom React sections    | Out of scope  | Only approved primitives and registered components.         |

# 3. Users, roles and jobs to be done

## 3.1 Primary target users

| **User**                                  | **Primary need**                                                                                                               |
|-------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| First-time retailer                       | Creates a first online store with no existing design or technical knowledge.                                                   |
| Migrating retailer                        | Brings an existing Shopify, WooCommerce, spreadsheet, ERP export, supplier catalogue or older site into a new design workflow. |
| Vesko salesperson                         | Builds or demonstrates a store together with a prospective customer.                                                           |
| Existing Vesko merchant — campaign editor | Updates a landing page, hero banner or marketing section without redesigning the full store.                                   |
| Existing Vesko merchant — site editor     | Updates the full storefront design, fonts, colours, layouts and page presentation.                                             |

## 3.2 User characteristics

- Very low technical knowledge and limited familiarity with professional design terminology.

- Needs visible examples and guided choices rather than blank-canvas configuration.

- Wants a usable result quickly and expects the system to recommend sensible defaults.

- May be anxious about breaking the live storefront; therefore draft and confirmation states must be obvious.

- May work in Finnish or English and may need the storefront in both languages.

## 3.3 Roles and permissions in the demo

| **Role**          | **Allowed actions**                                                                              |
|-------------------|--------------------------------------------------------------------------------------------------|
| Merchant owner    | Create project, edit all pages, manage draft, preview and simulate publishing.                   |
| Merchant editor   | Edit pages and content, preview changes; simulated publishing may be allowed by project setting. |
| Vesko salesperson | Create assisted demo projects and switch between merchant scenarios.                             |
| Viewer            | Open published preview only; no editing.                                                         |

## 3.4 Core jobs to be done

- When I have no website, help me turn basic business information into a complete storefront without making design decisions I do not understand.

- When my current website is outdated, help me preserve useful brand assets while producing a clearer modern design.

- When I need a campaign, let me create a new landing page or promotional section without changing the rest of the store.

- When I want a different visual style, let me preview a complete restyle before saving it.

- When I select a section, let me change it through simple prompts and direct controls without affecting unrelated content.

# 4. End-to-end user journeys

## 4.1 Path A — new customer or new store

| **Step**            | **Required behaviour**                                                                                |
|---------------------|-------------------------------------------------------------------------------------------------------|
| Entry               | User chooses Create a new storefront.                                                                 |
| Business setup      | Business name, description, industry and target customer.                                             |
| Starting material   | Select existing site, uploaded files/assets, or start from description only.                          |
| Brand setup         | Upload logo/brand guide or use guided brand creation.                                                 |
| Visual direction    | Choose visual references, tone, density and preferences using example cards.                          |
| Catalogue source    | Upload CSV/Excel or choose an industry dummy catalogue.                                               |
| Pages and languages | Confirm required pages and English/Finnish configuration.                                             |
| Generation plan     | Veskify summarises what it will build and asks for confirmation.                                      |
| Initial generation  | System creates global design tokens, navigation, pages and a populated homepage/product presentation. |
| Editor tutorial     | Short overlay teaches section selection, chat editing, draft status and Save changes.                 |
| Editor              | User reviews and edits through canvas, chat and structured controls.                                  |
| Full preview        | User opens the complete draft storefront in a dedicated preview route.                                |
| Save                | User confirms Save changes; draft becomes the published demo snapshot.                                |

## 4.2 Path B — existing Vesko customer

| **Step**         | **Required behaviour**                                                                                            |
|------------------|-------------------------------------------------------------------------------------------------------------------|
| Entry            | User opens an existing demo project and sees the current published storefront.                                    |
| Intent           | User requests a section edit, page creation, campaign, new visual direction or whole-site redesign.               |
| Selection        | User may select the target section/page before prompting; the selection is passed as context.                     |
| Clarification    | Agent asks only for information that materially affects the result, such as campaign objective or required media. |
| Proposal         | Agent presents a short plan and a structured confirmation card.                                                   |
| Draft generation | Changes are applied only to the draft and highlighted in the canvas.                                              |
| Review           | User compares, adjusts, accepts, rejects, regenerates or manually edits.                                          |
| Full preview     | User opens the full draft route in desktop or mobile preview.                                                     |
| Save             | User explicitly saves changes to replace the published demo snapshot.                                             |

## 4.3 Vesko salesperson assisted mode

Assisted mode uses the same creation and editing flows but provides quick scenario switching, sample business presets, reset-to-demo controls and an optional presenter mode. Presenter mode must not expose developer tools, raw JSON or internal prompt content.

## 4.4 Critical journey rules

- A user must always be able to skip optional onboarding inputs and continue with recommended defaults.

- The system must save onboarding progress locally so an accidental refresh does not restart the flow.

- The user must see whether they are editing Draft or Published at all times.

- The agent must never ask a question that can be answered safely from existing project context or a default recommendation.

- A failed AI generation must preserve the current draft and offer retry or manual editing.

# 5. Information architecture and screens

## 5.1 Application-level routes

| **Route**                       | **Purpose**                                                 |
|---------------------------------|-------------------------------------------------------------|
| /                               | Product landing or project chooser.                         |
| /projects                       | List demo projects, presets and recent edits.               |
| /projects/new                   | Guided onboarding wizard.                                   |
| /projects/{projectId}/editor    | Main editor: canvas, chat, page tree and property controls. |
| /projects/{projectId}/preview   | Full draft preview with device controls.                    |
| /projects/{projectId}/published | Published demo storefront.                                  |
| /projects/{projectId}/history   | Draft/published snapshots and restore actions.              |
| /demo/presets                   | Salesperson scenario presets.                               |

## 5.2 Editor layout

| **Region**    | **Purpose**                                                               | **Default behaviour**                                                               |
|---------------|---------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| Top bar       | Project, draft status, undo/redo, device mode, View in full, Save changes | Persistent; Save changes is visually primary only when unsaved draft changes exist. |
| Left rail     | Pages, section tree, add page, site structure                             | Collapsible. Shows current page and selected section.                               |
| Canvas        | Interactive storefront preview                                            | Primary workspace. Supports selection, hover labels and direct text editing.        |
| Right panel   | Contextual manual controls                                                | Shows section settings, content, design, visibility and variants.                   |
| Chat panel    | Agent instructions, plans and confirmations                               | Docked or overlay. Knows current page/selection.                                    |
| Bottom status | Generation progress, validation issues and responsive warnings            | Appears only when relevant.                                                         |

## 5.3 Onboarding screens

| **ID** | **Screen**                | **Core content**                                                          |
|--------|---------------------------|---------------------------------------------------------------------------|
| O-01   | Welcome and creation path | New store / redesign existing store / use demo preset.                    |
| O-02   | Business basics           | Name, description, industry, target customer and primary market.          |
| O-03   | Existing sources          | Website URL, social profile, uploads or start without sources.            |
| O-04   | Brand assets              | Logo, brand guide, colour/font data and images.                           |
| O-05   | Visual direction          | Guided style cards, tone, image style and layout density.                 |
| O-06   | Catalogue                 | CSV/Excel upload or industry sample catalogue.                            |
| O-07   | Pages                     | Required page set and optional pages.                                     |
| O-08   | Languages                 | English, Finnish or both; primary language selection.                     |
| O-09   | Review plan               | Summary of inputs, assumptions, missing optional data and planned output. |
| O-10   | Generating                | Progressive status with meaningful stages.                                |
| O-11   | Editor tutorial           | Three to five short, dismissible guided steps.                            |

# 6. Functional requirements

## 6.1 Project and onboarding requirements

| **ID** | **Requirement**                                                                                            |
|--------|------------------------------------------------------------------------------------------------------------|
| FR-001 | The system MUST create a standalone project from a guided onboarding flow.                                 |
| FR-002 | The system MUST support new-store, existing-store redesign and demo-preset entry paths.                    |
| FR-003 | The onboarding flow MUST allow optional inputs to be skipped and replaced with documented defaults.        |
| FR-004 | The onboarding flow MUST persist progress locally after every completed step.                              |
| FR-005 | The user MUST be able to provide a business name, description, industry and target customer.               |
| FR-006 | The user MUST be able to upload logo, brand materials, product images, CSV and Excel files through the UI. |
| FR-007 | The demo MUST support English and Finnish as storefront languages.                                         |
| FR-008 | Before generation, Veskify MUST show a plain-language build plan and request confirmation.                 |
| FR-009 | The system MUST create an initial design system and storefront draft after confirmation.                   |
| FR-010 | The system MUST provide sample industry data when no usable catalogue data is supplied.                    |

## 6.2 Storefront generation requirements

| **ID** | **Requirement**                                                                                                                   |
|--------|-----------------------------------------------------------------------------------------------------------------------------------|
| FR-011 | The system MUST generate a homepage, collection/category page, product page, navigation, footer, cart UI and checkout UI.         |
| FR-012 | The system SHOULD generate About, Contact, Delivery, Returns, Privacy and Terms pages using editable placeholder content.         |
| FR-013 | All generated pages MUST use the same project design tokens unless a page-level override is explicitly created.                   |
| FR-014 | Generated layouts MUST reference only registered components and valid component variants.                                         |
| FR-015 | The system MUST validate generated storefront JSON before rendering it.                                                           |
| FR-016 | Invalid generated properties MUST be rejected or replaced with safe defaults; they MUST NOT reach the renderer unchecked.         |
| FR-017 | The system MUST support desktop, tablet and mobile rendering modes.                                                               |
| FR-018 | The homepage and product page MUST receive the highest visual and content quality priority.                                       |
| FR-019 | Cart and checkout MUST visually inherit the site design but MUST expose no real payment or logistics configuration.               |
| FR-020 | The system MUST permit a complete theme restyle without changing dummy products, product prices or page content unless requested. |

## 6.3 Editing requirements

| **ID** | **Requirement**                                                                                                                                 |
|--------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| FR-021 | The user MUST be able to select a section directly from the canvas or section tree.                                                             |
| FR-022 | The current page and selected section MUST be included in the agent context.                                                                    |
| FR-023 | The user MUST be able to reorder, add, duplicate, hide and remove sections.                                                                     |
| FR-024 | The user MUST be able to edit text, media, colours, typography styles, alignment, spacing presets and layout variants.                          |
| FR-025 | The system MUST support inline text editing for eligible text fields.                                                                           |
| FR-026 | The system MUST support undo and redo for all draft mutations.                                                                                  |
| FR-027 | Regenerating one section MUST NOT alter unrelated sections or global design tokens unless the instruction explicitly requests a broader change. |
| FR-028 | The user MUST be able to accept, revise, reject or regenerate an AI proposal.                                                                   |
| FR-029 | The system SHOULD highlight changed sections until the user dismisses the change summary.                                                       |
| FR-030 | The system MUST prevent unrestricted section resizing; it MUST use approved sizing and spacing presets.                                         |

## 6.4 AI and content requirements

| **ID** | **Requirement**                                                                                                 |
|--------|-----------------------------------------------------------------------------------------------------------------|
| FR-031 | The agent MUST identify the retailer industry or ask for clarification when confidence is insufficient.         |
| FR-032 | The agent MUST generate section titles, supporting copy, calls to action and page metadata.                     |
| FR-033 | The agent MUST be able to create an industry-specific visual direction and landing page composition.            |
| FR-034 | The agent MAY generate images through an image-service adapter and MUST also support merchant-provided assets.  |
| FR-035 | The agent MUST infer or create a coherent design language from provided brand materials and guided preferences. |
| FR-036 | The agent MUST generate and translate editable storefront content in English and Finnish.                       |
| FR-037 | The product intelligence layer MUST detect obvious duplicate dummy/imported product records.                    |
| FR-038 | The product intelligence layer MUST recommend filters and identify missing display information.                 |
| FR-039 | The agent MUST ask questions only when missing information materially affects the requested design outcome.     |
| FR-040 | The agent MUST return structured output conforming to the schemas in this document.                             |

## 6.5 Draft and publishing requirements

| **ID** | **Requirement**                                                                                                  |
|--------|------------------------------------------------------------------------------------------------------------------|
| FR-041 | Every project MUST maintain separate published and draft snapshots.                                              |
| FR-042 | AI and manual edits MUST mutate only the draft snapshot.                                                         |
| FR-043 | View in full MUST open the complete draft storefront without publishing it.                                      |
| FR-044 | Save changes MUST require explicit confirmation and replace the published demo snapshot only after confirmation. |
| FR-045 | Discard changes MUST restore the draft to the latest published snapshot.                                         |
| FR-046 | The system MUST show a persistent unsaved-change indicator whenever draft and published snapshots differ.        |
| FR-047 | The system MUST keep a bounded local history of snapshots and allow restoration.                                 |
| FR-048 | Destructive section/page actions MUST require confirmation when they remove non-empty content.                   |
| FR-049 | A failed save or generation MUST preserve the previous published snapshot and current usable draft.              |
| FR-050 | The published demo route MUST be read-only.                                                                      |

# 7. Editor and interaction specification

## 7.1 Canvas selection model

Every rendered section must expose a stable section ID and editor metadata. Hovering a section displays a subtle outline and label. Clicking selects it, updates the section tree, opens contextual controls and passes the selection into chat context. Selection visuals must never appear in full preview or published routes.

## 7.2 Manual section actions

| **Action**     | **Behaviour**                                                 | **Guardrail**                                         |
|----------------|---------------------------------------------------------------|-------------------------------------------------------|
| Reorder        | Drag within the current page section list or use Move up/down | Header and footer remain in protected global regions. |
| Add            | Open component gallery filtered by page type and industry     | Only compatible registered components are shown.      |
| Duplicate      | Create a new section ID with copied content and props         | Duplicate is inserted directly after source.          |
| Hide           | Set visibility false without deleting content                 | Hidden section remains visible in tree with status.   |
| Delete         | Remove from draft after confirmation where needed             | Undo must restore it.                                 |
| Change variant | Select approved layout variant                                | Content mapping is preserved where compatible.        |
| Edit content   | Inline or property-panel editing                              | Validation applies before mutation.                   |
| Regenerate     | AI replaces only selected target                              | Before/after summary required.                        |

## 7.3 Chat interaction states

| **State**         | **Description**                                                                     |
|-------------------|-------------------------------------------------------------------------------------|
| Idle              | Prompt box is available; current page and section context are visible.              |
| Understanding     | Agent classifies scope: selected field, section, page, design system or whole site. |
| Needs information | Agent asks one focused question or presents simple options.                         |
| Plan ready        | Agent shows intended changes, affected scope and any assumptions.                   |
| Generating        | Progress indicates meaningful work stages and allows cancellation when safe.        |
| Proposal ready    | Draft canvas updates and a confirmation card summarises changes.                    |
| Revision          | User provides follow-up instruction against the proposal.                           |
| Accepted in draft | Change remains in draft; published snapshot is unchanged.                           |
| Rejected          | Draft target returns to its prior state.                                            |
| Error             | Current draft remains usable; retry and manual edit options appear.                 |

## 7.4 Structured confirmation card

Every non-trivial AI proposal must include: requested outcome, affected page/section, changed content, changed design properties, generated assets, unresolved assumptions, and actions for Accept in draft, Revise, Regenerate and Reject. The card must not imply that acceptance publishes the change.

## 7.5 Direct manipulation limits

- No freeform pixel positioning.

- No arbitrary width or height fields for ordinary users.

- No custom CSS editor in V1.

- No arbitrary font upload unless the font is already available through a safe configured source.

- No direct editing of raw storefront JSON in merchant mode.

- No editing of dummy price, stock, payment or shipping values through the design interface.

## 7.6 Editor onboarding tutorial

> **1.** Click any section to select and edit it.
>
> **2.** Ask Veskify to change the selected section or the whole page.
>
> **3.** Use desktop, tablet and mobile controls to review responsive layouts.
>
> **4.** Use View in full to inspect the complete draft.
>
> **5.** Use Save changes only when ready to replace the published demo version.

# 8. Storefront design system

## 8.1 Brand system generation

When the merchant supplies no complete brand guideline, Veskify must generate a coherent brand system from the business description, industry, customer profile and guided visual choices. The user selects visual examples and simple preferences; the system converts them into validated design tokens.

## 8.2 Required design tokens

| **Token group** | **Required fields**                                                                               |
|-----------------|---------------------------------------------------------------------------------------------------|
| Colour          | primary, secondary, accent, background, surface, text, mutedText, border, success, warning, error |
| Typography      | headingFont, bodyFont, baseSize, scaleRatio, headingWeight, bodyWeight, lineHeight                |
| Shape           | cornerRadiusSmall, cornerRadiusMedium, cornerRadiusLarge, borderWidth                             |
| Spacing         | xs, sm, md, lg, xl, sectionCompact, sectionStandard, sectionSpacious                              |
| Buttons         | primary, secondary, text, destructive; each with size and shape variants                          |
| Imagery         | aspect-ratio defaults, crop mode, image radius, overlay strength, treatment style                 |
| Layout          | contentMaxWidth, readingWidth, gridGap, pageGutter, headerMode                                    |
| Voice           | tone keywords, sentence length, formality, CTA style, prohibited language                         |

## 8.3 Guided brand creation controls

| **Merchant-facing question**            | **Structured result**                                                |
|-----------------------------------------|----------------------------------------------------------------------|
| Which feeling should the store create?  | tone: elegant / modern / warm / bold / minimal / playful / technical |
| Which colour direction fits your brand? | palette family and contrast preference                               |
| How should the store feel visually?     | density: airy / balanced / compact                                   |
| How should images appear?               | studio / lifestyle / editorial / product-focused / mixed             |
| Which typography feels right?           | serif-led / sans-led / mixed / strong / soft                         |
| How prominent should promotions be?     | subtle / balanced / campaign-led                                     |

## 8.4 Design system inheritance

- Global tokens apply to all pages and components by default.

- A component may expose a limited local override only for properties approved in its schema.

- A campaign page may define a page-level theme override while preserving accessibility and shared navigation rules.

- Changing a global token must preview the effect across at least the homepage, collection page and product page before acceptance.

- Changing fonts or colours must not modify content, products or section ordering.

## 8.5 Industry themes for V1

| **Industry**        | **Demo support**             | **Design emphasis**                                                                   |
|---------------------|------------------------------|---------------------------------------------------------------------------------------|
| Jewellery & watches | Complete                     | Premium imagery, editorial spacing, material/stone filters, high-trust product pages. |
| Fashion & clothing  | Recommended secondary preset | Collections, campaigns, size/colour options and visual merchandising.                 |
| Other retail        | Generic fallback             | Neutral retail template and dummy data.                                               |

# 9. Controlled component system

## 9.1 Component contract

Each component must be registered in a component registry with a stable type, supported variants, property schema, content schema, responsive rules, editable fields, allowed page types and industry tags. The renderer must reject unknown component types.

## 9.2 Core component inventory

| **Type**           | **Pages**         | **Variants**                              | **Editable content**                 |
|--------------------|-------------------|-------------------------------------------|--------------------------------------|
| announcementBar    | Global            | singleLine, rotating                      | Announcement text, link, visibility  |
| header             | Global            | centered, split, compact, transparent     | Logo, menu, search/cart controls     |
| hero               | Home/Landing      | editorial, split, fullBleed, productFocus | Eyebrow, heading, copy, CTA, media   |
| featuredCategories | Home              | grid, editorialCards, carousel            | Category references, labels, media   |
| productGrid        | Home/Collection   | standard, editorial, compact              | Product references, columns, heading |
| productCarousel    | Home/Product      | standard, spotlight                       | Product references, heading          |
| campaignBanner     | Home/Landing      | imageOverlay, split, minimal              | Heading, copy, CTA, media            |
| imageText          | Any content page  | imageLeft, imageRight, stacked            | Heading, copy, CTA, media            |
| brandStory         | Home/About        | editorial, timeline, founder              | Text blocks, media, facts            |
| benefitIcons       | Home/Product/Cart | threeColumn, fourColumn                   | Icon, title, text                    |
| testimonials       | Home/Product      | cards, quoteFocus                         | Quotes, people, ratings              |
| gallery            | Home/About        | masonry, grid, strip                      | Media items, captions                |
| newsletter         | Global/Home       | inline, card, fullWidth                   | Heading, copy, form labels           |
| faq                | Any               | accordion, grouped                        | Question/answer entries              |
| storeLocations     | Contact           | cards, mapPlaceholder                     | Locations, hours, contact            |
| footer             | Global            | columns, editorial, compact               | Menus, contact, social, legal        |
| collectionHeader   | Collection        | editorial, compact, image                 | Title, copy, media                   |
| filterBar          | Collection        | sidebar, horizontal, drawer               | Filter definitions, sort control     |
| productGallery     | Product           | grid, thumbnails, editorial               | Images, video placeholders           |
| productInfo        | Product           | standard, premium, compact                | Title, price display, options, CTAs  |
| productOptions     | Product           | buttons, swatches, dropdowns              | Variant and order options            |
| relatedProducts    | Product           | grid, carousel                            | Product references                   |
| cartDrawer         | Cart              | standard, compact                         | Items, totals, CTA; dummy content    |
| cartPage           | Cart              | split, stacked                            | Items, summary; dummy content        |
| checkoutShell      | Checkout          | singleColumn, splitSummary                | Steps, form placeholders, summary    |

## 9.3 Custom sections rule

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Permitted</strong></p>
<p>Veskify may create a new section composition by arranging approved primitives and mapping content into a registered schema. The result must be saved as a valid component instance or reusable composition.</p></th>
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
<th><p><strong>Not permitted</strong></p>
<p>Veskify may not emit arbitrary React, HTML, CSS, scripts, external embeds or executable code as a section.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 9.4 Component variant switching

A variant switch must preserve compatible content fields. When fields do not map, the editor must show what will be dropped or moved before applying the change. Variant switching must not silently delete media or copy.

## 9.5 Responsive contract

- Every component defines desktop, tablet and mobile layout rules in code, not in AI output.

- AI may select responsive-safe options such as column count, content order and compact/standard/spacious presets.

- The renderer must enforce minimum touch-target sizes, readable line lengths and non-overlapping content.

- Unsupported property combinations must be corrected during schema validation.

# 10. Page specifications

## 10.1 Homepage

The homepage is the principal design surface and must communicate the retailer identity, product focus and reasons to trust the store. It should normally contain 6–10 sections, with a clear hierarchy rather than a dense set of unrelated promotions.

| **Priority** | **Requirement**                                                                  |
|--------------|----------------------------------------------------------------------------------|
| P0           | Hero communicates brand/product value within the first viewport.                 |
| P0           | Navigation, colour, typography and imagery establish the global design language. |
| P0           | At least one product or category discovery section appears near the top.         |
| P1           | Trust, service or delivery information appears without dominating the page.      |
| P1           | Campaign and storytelling content supports conversion and brand identity.        |
| P1           | Footer provides contact, policies and navigation.                                |

## 10.2 Collection/category page

- Collection header with title, optional description and optional media.

- Responsive product grid using dummy products.

- Search, sorting and filter presentation appropriate to the selected industry.

- Empty and no-results states.

- Mobile filter drawer and desktop sidebar or horizontal filter variant.

## 10.3 Product page

The product page is the second highest-priority design surface. It must clearly present product media, title, dummy price, product options, descriptive content, trust information and related products while remaining consistent with the site design system.

| **Area**        | **Requirements**                                                                                       |
|-----------------|--------------------------------------------------------------------------------------------------------|
| Gallery         | Responsive images, thumbnails/grid variants, zoom placeholder and media labels.                        |
| Product summary | Title, dummy price, concise description, availability placeholder and rating placeholder when enabled. |
| Options         | Industry-specific variants and configurable order options.                                             |
| Primary action  | Add to cart visual control; no real transaction processing required.                                   |
| Details         | Description, material/specification data, delivery/returns placeholder and care instructions.          |
| Discovery       | Related products or recently viewed dummy products.                                                    |

## 10.4 Cart and checkout UI

The cart and checkout use dummy items and values. They exist to demonstrate that the design system continues through the transaction experience. No settings screen for payments, logistics, taxes or shipping prices is included.

- Cart drawer and cart page share the same tokens, button styles and spacing as the storefront.

- Checkout includes contact, delivery, payment and review visual steps using non-functional placeholder controls.

- Dummy payment and delivery labels are read-only presentation data.

- The editor may change visual layout, text style, background, spacing and trust content but not operational options.

## 10.5 Content and legal pages

About, Contact, Delivery, Returns, Privacy and Terms pages are generated as editable content-page structures. Legal and policy text must be clearly labelled as draft placeholder content requiring merchant review; the system must not present generated text as legal advice.

## 10.6 Campaign landing pages

- Created from a campaign objective, audience, offer, required media and call to action.

- May use a page-level theme override but must remain consistent with the merchant brand.

- Uses only registered components and may be linked from navigation or a campaign banner in the draft.

- Creation must not alter the homepage unless the user explicitly asks to add a link or campaign section.

# 11. Product and catalogue intelligence

## 11.1 V1 purpose

Catalogue intelligence exists to improve storefront presentation, not to operate the merchant catalogue. It may interpret uploaded or dummy data, recommend structure and populate design components. It must not change prices or operational inventory data.

## 11.2 Supported input modes

| **Input**            | **Demo behaviour**                                                                   |
|----------------------|--------------------------------------------------------------------------------------|
| No catalogue         | Use industry-specific dummy catalogue.                                               |
| CSV                  | Parse locally, map common columns and show mapping review.                           |
| Excel                | Parse first suitable worksheet locally and show mapping review.                      |
| ERP/supplier export  | Treat as CSV/Excel mapping in V1; no vendor-specific connector.                      |
| Existing website URL | Use simulated analysis by default; optional public metadata fetch behind an adapter. |
| Instagram/social     | Simulated source selection or uploaded media; no OAuth integration.                  |
| Product images       | Store locally/mock, allow manual assignment and optional AI description.             |

## 11.3 Permitted product intelligence actions

- Identify likely product type and industry display requirements.

- Suggest presentation titles and descriptions without altering source price fields.

- Detect obvious duplicate records using normalized titles, SKUs and image fingerprints where available.

- Recommend collection filters based on attributes present in data.

- Detect missing display information such as absent images, material or option labels.

- Translate display text and product descriptions between English and Finnish.

- Generate SEO titles and meta descriptions as editable content.

## 11.4 Jewellery and watches display model

| **Field group**   | **Display attributes**                                                                    |
|-------------------|-------------------------------------------------------------------------------------------|
| Material          | gold, silver, platinum, steel, titanium, other                                            |
| Gold purity/karat | 9K, 14K, 18K and local fineness values such as 375, 585, 750                              |
| Metal colour      | yellow, white, rose, mixed                                                                |
| Stone             | type, shape, colour, clarity/cut placeholders, setting                                    |
| Ring dimensions   | ring size, width in millimetres, profile and thickness where available                    |
| Engraving         | enabled, text, font style and character limit as an order-option presentation             |
| Watch fields      | brand, model, case size, strap material, movement and water resistance                    |
| Audience/style    | gender/unisex, collection, occasion and style tags                                        |
| Filters           | material, colour, brand, price, audience, stone shape, style and availability placeholder |

## 11.5 Product data safeguards

- Source price and stock values are read-only in the design agent.

- Duplicate suggestions require user confirmation before records are hidden from the demo catalogue.

- Missing information is shown as a recommendation, not invented as factual product data.

- Generated descriptive copy must not claim certifications, materials or properties absent from source data.

# 12. AI agent specification

## 12.1 Agent responsibilities

The Veskify agent converts natural-language design intent and project context into validated design operations. It plans the change, asks only necessary questions, returns structured operations, explains the result in plain language and never directly writes executable frontend code.

## 12.2 Context available to the agent

- Project business profile, industry, target customer and languages.

- Current global design tokens and brand voice.

- Page tree and current page schema.

- Selected section and its current properties/content.

- Registered component catalogue and compatibility rules.

- Dummy/imported product and collection summaries.

- User instruction and recent accepted/rejected proposals.

- Media asset metadata and usage references.

## 12.3 Intent classification

| **Scope**            | **Examples**                                            | **Expected operation**                                   |
|----------------------|---------------------------------------------------------|----------------------------------------------------------|
| Field                | “Make this heading shorter”                             | Patch one content field.                                 |
| Section              | “Make this hero more premium”                           | Patch selected section variant/content/style overrides.  |
| Page                 | “Build a summer campaign page”                          | Create or replace page sections.                         |
| Design system        | “Use warmer colours and a softer font”                  | Patch global tokens after cross-page preview.            |
| Whole site           | “Redesign the entire store as a luxury jewellery brand” | Generate coordinated page and token operations.          |
| Content/localisation | “Translate the product page to Finnish”                 | Patch locale content only.                               |
| Asset                | “Create a new banner image”                             | Request image generation and map result to target field. |

## 12.4 Clarification policy

The agent should proceed with safe assumptions when the result can be revised visually. It asks a question only when the missing answer changes business meaning, required assets, page scope, language, campaign objective or a destructive operation. It asks one focused question at a time and may offer two to four visual choices.

## 12.5 Plan-before-generate policy

For page-level, design-system or whole-site operations, the agent must present a short plan containing the target, intended components, design direction, content assumptions, affected pages and generated assets. Section-level cosmetic edits may use a compact one-line plan.

## 12.6 Structured operation types

| **Operation**          | **Purpose**                                               |
|------------------------|-----------------------------------------------------------|
| PATCH_DESIGN_TOKENS    | Update validated global token fields.                     |
| ADD_PAGE               | Create a page using a registered page type.               |
| PATCH_PAGE             | Change page metadata or page-level theme override.        |
| ADD_SECTION            | Insert a registered component instance.                   |
| PATCH_SECTION          | Patch content, variant or allowed local style properties. |
| MOVE_SECTION           | Change section order within one page.                     |
| DUPLICATE_SECTION      | Clone a section with a new ID.                            |
| SET_SECTION_VISIBILITY | Hide or reveal a section.                                 |
| REMOVE_SECTION         | Remove a draft section with undo support.                 |
| GENERATE_ASSET         | Request an image and map the resulting asset reference.   |
| PATCH_LOCALE_CONTENT   | Add or edit English/Finnish fields.                       |

## 12.7 AI output envelope

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>{<br />
"requestId": "req_...",<br />
"scope": "section | page | designSystem | site",<br />
"summary": "Plain-language description",<br />
"assumptions": ["..."],<br />
"requiresConfirmation": true,<br />
"operations": [<br />
{<br />
"type": "PATCH_SECTION",<br />
"targetId": "section_hero_01",<br />
"patch": { "variant": "editorial", "content": { "heading": { "en": "...", "fi": "..." } } }<br />
}<br />
],<br />
"generatedAssetRequests": [],<br />
"warnings": []<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 12.8 Validation and application pipeline

> **1.** Classify intent and scope.
>
> **2.** Build minimum required context bundle.
>
> **3.** Generate structured proposal.
>
> **4.** Parse JSON strictly; reject additional unknown fields.
>
> **5.** Validate operations against Zod/JSON schemas and component registry.
>
> **6.** Run semantic guards for protected fields and unrelated-target mutations.
>
> **7.** Apply operations to an isolated draft transaction.
>
> **8.** Render and run basic layout validation.
>
> **9.** Show proposal summary and draft result.
>
> **10.** Commit or roll back the draft transaction based on user action.

## 12.9 Agent guardrails

- Must not patch price, stock, payment, shipping, tax or order fields.

- Must not produce or execute code, scripts, HTML, CSS or external embeds.

- Must not delete pages or populated sections without explicit confirmation.

- Must not change global tokens when the request targets only a section unless the user approves broader scope.

- Must not claim generated legal text is legally compliant.

- Must not invent factual product materials, certifications or availability.

- Must not publish or save to the published snapshot directly.

## 12.10 Model/provider abstraction

The demo must use an AIProvider interface. A deterministic MockAIProvider is the default so the repository runs without secrets. A real provider may be enabled through environment configuration. The provider implementation must not leak provider-specific response formats into editor or domain code. The later Vesko integration can route AI workloads through AWS infrastructure.

# 13. Draft, preview, versioning and publishing

## 13.1 State model

| **State**          | **Meaning**                                                             |
|--------------------|-------------------------------------------------------------------------|
| Published snapshot | The current read-only demo storefront visible at the published route.   |
| Draft snapshot     | Editable working copy. All AI and manual edits occur here.              |
| Pending proposal   | Temporary operation set that can be accepted, revised or rejected.      |
| History snapshot   | Timestamped copy created on publish, restore or selected major changes. |

## 13.2 Save changes flow

> **1.** User selects Save changes from the editor top bar.
>
> **2.** System shows a summary of changed pages, sections, design tokens and generated assets.
>
> **3.** User confirms or cancels.
>
> **4.** On confirmation, the current published snapshot is added to history.
>
> **5.** The draft snapshot becomes the new published snapshot.
>
> **6.** A fresh draft is created from the new published snapshot and marked clean.

## 13.3 View in full

View in full opens the draft storefront in a dedicated route. It must support desktop, tablet and mobile widths, page navigation and interaction with visual controls. It must display a clear Draft preview badge and must not show editor outlines or property controls.

## 13.4 History and restore

- Keep at least 20 snapshots per project in the demo storage layer.

- Show timestamp, author role, reason and summary for each snapshot.

- Restore creates a new draft from the selected snapshot; it does not immediately publish.

- A restore action must be reversible before publishing.

## 13.5 Conflict model

The standalone demo assumes one active editor per local project. The domain model should nevertheless include revision numbers. Future backend integration should reject save operations based on stale revisions and offer a merge or reload flow.

# 14. Localisation and content

## 14.1 Supported languages

V1 supports English (en) and Finnish (fi). Every user-editable storefront content field uses a locale map. The project has one primary language and may enable the second language.

## 14.2 Translation rules

- Translations are generated as editable suggestions.

- The system must preserve brand names, SKUs and explicitly protected terms.

- Missing translation fields fall back to the primary language in the editor with a visible warning.

- The published demo should not show untranslated debug labels.

- SEO title and meta description are stored per locale.

## 14.3 Content tone

The generated brand voice should be represented by structured attributes such as formal/casual, concise/descriptive, premium/accessible, warm/neutral and direct/inspirational. Content generation uses these attributes and the retailer industry. The merchant may edit the text manually at any time.

## 14.4 Legal and policy content

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Required label</strong></p>
<p>Generated delivery, returns, privacy and terms text must be labelled “Draft placeholder — review before publishing”. The demo must not represent the content as legal advice or guaranteed compliance.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 15. Data model and schemas

## 15.1 Domain entities

| **Entity**         | **Purpose**                                                             |
|--------------------|-------------------------------------------------------------------------|
| Project            | Business profile, industry, locales, project status and revision.       |
| BusinessProfile    | Name, description, audience, market, source references.                 |
| BrandSystem        | Validated global design tokens and brand voice.                         |
| StorefrontSnapshot | Complete immutable page tree, theme and data references.                |
| Page               | Page metadata, type, slug, locale metadata and ordered sections.        |
| Section            | Registered component type, variant, content, props and local overrides. |
| Asset              | Media metadata, local/mock URL, generation provenance and usage.        |
| Product            | Read-only design data used by product components.                       |
| Collection         | Read-only grouping and filter metadata.                                 |
| Proposal           | AI operation envelope, status and before/after references.              |
| HistoryEntry       | Snapshot, revision, timestamp, actor and summary.                       |

## 15.2 Project schema

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type Project = {<br />
id: string;<br />
name: string;<br />
mode: "merchant" | "salesDemo";<br />
industry: "jewellery" | "fashion" | "generic";<br />
primaryLocale: "en" | "fi";<br />
enabledLocales: Array&lt;"en" | "fi"&gt;;<br />
businessProfile: BusinessProfile;<br />
publishedSnapshotId: string;<br />
draftSnapshotId: string;<br />
revision: number;<br />
createdAt: string;<br />
updatedAt: string;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 15.3 Storefront snapshot schema

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type StorefrontSnapshot = {<br />
id: string;<br />
projectId: string;<br />
revision: number;<br />
brandSystem: BrandSystem;<br />
navigation: NavigationModel;<br />
pages: PageModel[];<br />
catalogueRef: string;<br />
createdAt: string;<br />
createdBy: "user" | "agent" | "system";<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 15.4 Page and section schema

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type PageModel = {<br />
id: string;<br />
type: "home" | "collection" | "product" | "content" | "cart" | "checkout" | "landing";<br />
slug: string;<br />
title: LocalizedText;<br />
seo: LocalizedSEO;<br />
themeOverride?: Partial&lt;BrandSystem&gt;;<br />
sections: SectionInstance[];<br />
};<br />
<br />
type SectionInstance = {<br />
id: string;<br />
component: RegisteredComponentType;<br />
variant: string;<br />
visible: boolean;<br />
content: Record&lt;string, unknown&gt;;<br />
props: Record&lt;string, unknown&gt;;<br />
styleOverrides?: AllowedSectionOverrides;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 15.5 Brand system schema

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type BrandSystem = {<br />
colors: {<br />
primary: string; secondary: string; accent: string;<br />
background: string; surface: string; text: string;<br />
mutedText: string; border: string;<br />
};<br />
typography: {<br />
headingFont: FontToken; bodyFont: FontToken;<br />
baseSize: number; scaleRatio: number;<br />
headingWeight: number; bodyWeight: number;<br />
};<br />
shape: { radius: "square" | "subtle" | "rounded" | "pill" };<br />
spacing: { density: "airy" | "balanced" | "compact" };<br />
imagery: { style: "studio" | "lifestyle" | "editorial" | "mixed" };<br />
voice: BrandVoice;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 15.6 Protected product schema

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>type ProductDisplayModel = {<br />
id: string;<br />
sku?: string;<br />
title: LocalizedText;<br />
description?: LocalizedText;<br />
price: { amount: number; currency: "EUR" }; // read-only<br />
stockStatus?: "inStock" | "lowStock" | "outOfStock"; // read-only dummy display<br />
images: AssetRef[];<br />
productType: string;<br />
attributes: Record&lt;string, string | number | string[]&gt;;<br />
variants: ProductVariantDisplay[];<br />
orderOptions?: ProductOrderOptionDisplay[];<br />
seo?: LocalizedSEO;<br />
};</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 15.7 Persistence for the standalone demo

The implementation should use a storage adapter. The default adapter may use IndexedDB for projects, snapshots and assets plus seeded JSON files for dummy catalogues. If a server-backed implementation is selected, SQLite is acceptable for the demo. Domain code must depend on repository interfaces so persistence can later move to Vesko SQL services.

# 16. Technical architecture

## 16.1 Recommended standalone stack

| **Layer**            | **Recommendation**                                                                       |
|----------------------|------------------------------------------------------------------------------------------|
| Application          | Next.js App Router with TypeScript and React.                                            |
| Styling              | Tailwind CSS plus CSS variables generated from validated brand tokens.                   |
| UI primitives        | Accessible controlled primitives; shadcn/ui or equivalent may be used for editor chrome. |
| Forms and validation | React Hook Form with Zod schemas.                                                        |
| Editor state         | Zustand or equivalent predictable store with command-based undo/redo.                    |
| Server/state queries | TanStack Query only where asynchronous adapters require it.                              |
| Persistence          | Storage adapter; IndexedDB default, optional SQLite server adapter.                      |
| File parsing         | Browser-safe CSV parser and Excel workbook parser.                                       |
| AI                   | Provider abstraction with deterministic mock provider and optional real provider.        |
| Testing              | Vitest, React Testing Library and Playwright.                                            |

## 16.2 Architectural layers

- Presentation: onboarding, editor shell, canvas, preview and published storefront.

- Domain: projects, snapshots, pages, sections, design tokens, operations and guardrails.

- Application services: create project, generate storefront, apply proposal, publish, restore and import catalogue.

- Adapters: storage, AI, image generation, file import and future backend integration.

- Component registry: storefront component definitions, schemas, variants and renderer mapping.

## 16.3 Suggested repository structure

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>src/<br />
app/<br />
projects/<br />
api/<br />
features/<br />
onboarding/<br />
editor/<br />
preview/<br />
publishing/<br />
catalogue-import/<br />
domain/<br />
project/<br />
storefront/<br />
design-system/<br />
ai-operations/<br />
components/<br />
editor/<br />
storefront/<br />
primitives/<br />
registry/<br />
components/<br />
page-templates/<br />
industry-presets/<br />
services/<br />
ai/<br />
image/<br />
storage/<br />
import/<br />
data/<br />
seed/<br />
dummy-catalogues/<br />
tests/<br />
unit/<br />
integration/<br />
e2e/</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 16.4 State mutation pattern

All draft changes must be expressed as commands or structured operations. The editor store applies operations transactionally and records inverse operations for undo. UI components must not mutate nested snapshot objects directly.

## 16.5 Storefront renderer

- Reads a validated StorefrontSnapshot.

- Resolves each section through the component registry.

- Applies global CSS variables and approved local overrides.

- Receives editor mode metadata only in the editor route.

- Renders the same component implementation in editor, full preview and published routes to avoid visual divergence.

## 16.6 Future Vesko integration

After the demo, the design agent will operate inside Vesko Retail OS and replace the current Puck-based website builder. Integration adapters will connect to Vesko authentication, Node.js monorepo services, SQL persistence, JSON-based industry product models, media services, backend page storage and publishing. Stripe and nShift remain operational integrations outside the design agent; Veskify only styles their customer-facing UI surfaces.

# 17. API and service contracts

## 17.1 Internal application services

| **Service**                               | **Contract**                                                              |
|-------------------------------------------|---------------------------------------------------------------------------|
| createProject(input)                      | Creates project, seed profile and empty snapshots.                        |
| completeOnboarding(projectId, input)      | Validates onboarding and creates generation plan.                         |
| generateInitialStorefront(projectId)      | Builds initial brand system and page snapshot.                            |
| proposeDesignChange(context, prompt)      | Returns validated pending proposal.                                       |
| applyProposal(projectId, proposalId)      | Applies operations to draft transaction.                                  |
| rejectProposal(projectId, proposalId)     | Discards pending proposal and preserves draft.                            |
| publishDraft(projectId, expectedRevision) | Creates history and replaces published snapshot.                          |
| discardDraft(projectId)                   | Replaces draft with published snapshot.                                   |
| restoreSnapshot(projectId, snapshotId)    | Creates a new draft from history.                                         |
| importCatalogue(projectId, file)          | Parses and maps local data without changing protected operational fields. |

## 17.2 AI provider interface

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>interface AIProvider {<br />
createInitialStorefront(input: InitialGenerationContext): Promise&lt;AIProposalEnvelope&gt;;<br />
proposeChange(input: ChangeContext): Promise&lt;AIProposalEnvelope&gt;;<br />
translateContent(input: TranslationContext): Promise&lt;AIProposalEnvelope&gt;;<br />
generateMetadata(input: MetadataContext): Promise&lt;AIProposalEnvelope&gt;;<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 17.3 Image provider interface

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>interface ImageProvider {<br />
generate(input: {<br />
prompt: string;<br />
aspectRatio: "1:1" | "4:3" | "3:2" | "16:9" | "9:16";<br />
style: "studio" | "lifestyle" | "editorial" | "graphic";<br />
safetyContext: string;<br />
}): Promise&lt;Asset&gt;;<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 17.4 Storage interface

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>interface ProjectRepository {<br />
list(): Promise&lt;ProjectSummary[]&gt;;<br />
get(projectId: string): Promise&lt;ProjectAggregate&gt;;<br />
saveDraft(projectId: string, snapshot: StorefrontSnapshot): Promise&lt;void&gt;;<br />
publish(projectId: string, expectedRevision: number): Promise&lt;ProjectAggregate&gt;;<br />
restore(projectId: string, snapshotId: string): Promise&lt;StorefrontSnapshot&gt;;<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 17.5 Mock integration requirements

- Mock providers must return deterministic results for seeded demo scenarios.

- Mock latency may be added to demonstrate progress states but must be configurable and short.

- URL and Instagram imports must be clearly represented as demo/simulated behaviour in developer documentation, not necessarily in merchant-facing presentation mode.

- The application must run fully without external credentials.

# 18. Non-functional requirements

| **ID**  | **Requirement**                                                                                                        |
|---------|------------------------------------------------------------------------------------------------------------------------|
| NFR-001 | A seeded demo project MUST load its editor within 3 seconds on a typical modern laptop after initial application load. |
| NFR-002 | Section selection and ordinary manual edits SHOULD respond within 100 ms.                                              |
| NFR-003 | The editor MUST preserve user work across refreshes once a draft mutation is committed locally.                        |
| NFR-004 | All merchant-facing controls MUST meet WCAG 2.2 AA contrast and keyboard-operation expectations.                       |
| NFR-005 | The storefront renderer MUST support current desktop and mobile evergreen browsers.                                    |
| NFR-006 | The application MUST use strict TypeScript and schema validation at all AI and persistence boundaries.                 |
| NFR-007 | The editor MUST remain usable when the AI provider is unavailable.                                                     |
| NFR-008 | The demo MUST run without external API keys using seeded data and mock providers.                                      |
| NFR-009 | No AI response may be rendered as executable markup or code.                                                           |
| NFR-010 | The generated storefront MUST pass automated viewport checks at 375, 768, 1024 and 1440 pixel widths.                  |
| NFR-011 | The initial storefront creation journey SHOULD be completable in under 30 minutes by a first-time merchant.            |
| NFR-012 | The application SHOULD support at least 100 products in a dummy/imported catalogue without editor degradation.         |

## 18.1 Accessibility details

- All editor actions have accessible names and visible focus states.

- Canvas selection is possible from the section tree without using a pointer.

- Generated images require editable alt text; decorative images may be explicitly marked decorative.

- Heading levels are validated per page.

- Colour changes must be checked against minimum contrast before acceptance.

- Animations respect reduced-motion preferences.

## 18.2 Performance strategy

- Lazy-load non-visible page previews and large media assets.

- Memoize section rendering by section ID and revision.

- Keep AI generation outside the main UI thread.

- Use image size metadata and responsive image sources.

- Avoid storing duplicated large base64 assets inside snapshots.

# 19. Analytics, errors and observability

## 19.1 Demo analytics events

| **Event**                    | **Minimum properties**                                                    |
|------------------------------|---------------------------------------------------------------------------|
| project_created              | projectId, timestamp, route, relevant target ID, duration when applicable |
| onboarding_step_completed    | projectId, timestamp, route, relevant target ID, duration when applicable |
| initial_generation_started   | projectId, timestamp, route, relevant target ID, duration when applicable |
| initial_generation_completed | projectId, timestamp, route, relevant target ID, duration when applicable |
| section_selected             | projectId, timestamp, route, relevant target ID, duration when applicable |
| manual_edit_applied          | projectId, timestamp, route, relevant target ID, duration when applicable |
| ai_prompt_submitted          | projectId, timestamp, route, relevant target ID, duration when applicable |
| ai_proposal_generated        | projectId, timestamp, route, relevant target ID, duration when applicable |
| ai_proposal_accepted         | projectId, timestamp, route, relevant target ID, duration when applicable |
| ai_proposal_rejected         | projectId, timestamp, route, relevant target ID, duration when applicable |
| draft_preview_opened         | projectId, timestamp, route, relevant target ID, duration when applicable |
| draft_published              | projectId, timestamp, route, relevant target ID, duration when applicable |
| history_restored             | projectId, timestamp, route, relevant target ID, duration when applicable |
| import_completed             | projectId, timestamp, route, relevant target ID, duration when applicable |
| generation_failed            | projectId, timestamp, route, relevant target ID, duration when applicable |

## 19.2 Error principles

- Errors must explain what failed in merchant-friendly language and preserve the current draft.

- AI generation errors must offer Retry and Continue manually.

- Validation errors should identify the affected field or section and apply safe fallback values where possible.

- Import errors must show row/column context without exposing stack traces.

- Developer details may be logged to the console in development but not shown in merchant mode.

## 19.3 Observability for future integration

Provider calls should record request IDs, operation counts, validation outcomes, latency and token/cost metadata where available. Prompt content and merchant data must not be logged by default. The later AWS deployment can connect these events to Vesko observability services.

# 20. Security and privacy

- Treat uploaded files as untrusted input and validate type, size and parser output.

- Do not execute macros, scripts or embedded content from CSV/Excel uploads.

- Sanitise all rich text and disallow arbitrary HTML in content fields.

- Use local object URLs or controlled asset endpoints; do not render arbitrary remote scripts.

- Do not expose AI provider secrets to the browser.

- Do not send more project data to an AI provider than required for the requested operation.

- Provide a clear Reset/Delete demo project action that removes locally stored project data.

- Do not store payment details, personal order data or production customer information in the standalone demo.

## 20.1 Prompt injection and imported content

Website text, spreadsheet cells, product descriptions and uploaded files are data, not instructions. The AI context builder must label imported content as untrusted and must not follow instructions contained inside it. Only direct authenticated user instructions and system-defined policies may control operations.

# 21. Testing and acceptance criteria

## 21.1 Test layers

| **Layer**         | **Coverage**                                                                                |
|-------------------|---------------------------------------------------------------------------------------------|
| Unit              | Schemas, operation guards, token validation, reducers, undo/redo and import mapping.        |
| Component         | Editor controls, selection states, responsive storefront components and confirmation cards. |
| Integration       | Onboarding-to-generation, AI proposal validation, draft mutation, publish and restore.      |
| End-to-end        | Complete new-store and existing-customer journeys at desktop and mobile widths.             |
| Visual regression | Homepage, collection, product, cart and checkout at required viewports.                     |
| Accessibility     | Automated axe checks plus keyboard-path verification.                                       |

## 21.2 Release acceptance criteria

| **ID** | **Acceptance criterion**                                                                                                                                  |
|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| AC-001 | A user can create a jewellery demo store from business description only and reach the editor with a generated homepage, collection page and product page. |
| AC-002 | A user can complete onboarding without uploading any assets or catalogue files.                                                                           |
| AC-003 | A user can upload a logo and see it used in the generated header.                                                                                         |
| AC-004 | A user can select a hero section, ask for a more premium design and receive a changed draft hero without unrelated section changes.                       |
| AC-005 | A user can manually change hero text, background, typography style, spacing preset and layout variant.                                                    |
| AC-006 | Undo restores the immediately previous draft state and redo reapplies it.                                                                                 |
| AC-007 | View in full displays the complete draft with a Draft preview indicator and no editor outlines.                                                           |
| AC-008 | The published route remains unchanged until Save changes is confirmed.                                                                                    |
| AC-009 | Cancelling Save changes leaves the published route unchanged.                                                                                             |
| AC-010 | After confirmed Save changes, the published route matches the draft and a history entry exists.                                                           |
| AC-011 | Restoring history creates a draft and does not immediately alter the published route.                                                                     |
| AC-012 | A whole-site font/colour restyle changes global presentation without changing dummy product prices or content ordering.                                   |
| AC-013 | The user can switch between English and Finnish storefront content.                                                                                       |
| AC-014 | The jewellery product page displays material, karat, stone, ring-size or watch-specific attributes appropriate to the seeded product.                     |
| AC-015 | Cart and checkout visually inherit the design system and expose no editable payment or shipping configuration.                                            |
| AC-016 | Unknown AI component types or protected-field patches are rejected before draft application.                                                              |
| AC-017 | The application works without external AI or image API credentials.                                                                                       |
| AC-018 | All primary flows are keyboard operable and pass automated accessibility checks.                                                                          |
| AC-019 | Homepage and product page have no visible clipping or overlap at 375, 768, 1024 and 1440 pixel widths.                                                    |
| AC-020 | A first-time user can understand section selection, draft preview and Save changes through the built-in tutorial without developer terminology.           |

## 21.3 Definition of done for every Codex task

- Affected requirement IDs are named in the task or implementation notes.

- Code is typed, formatted and lint-clean.

- Relevant unit/integration tests are added or updated.

- No protected commerce fields or arbitrary-code paths are introduced.

- Loading, empty and error states are handled.

- Keyboard access and responsive behaviour are checked for changed UI.

- No regression is introduced to draft/published separation.

- Developer documentation is updated when schemas, adapters or commands change.

# 22. Implementation roadmap

| **Phase**                          | **Deliverables**                                                                                             |
|------------------------------------|--------------------------------------------------------------------------------------------------------------|
| Phase 0 — Foundation               | Repository, linting, testing, application shell, schemas, component registry, seed data and storage adapter. |
| Phase 1 — Storefront renderer      | Brand tokens, core components, homepage/collection/product/cart/checkout templates and responsive rendering. |
| Phase 2 — Editor shell             | Page tree, canvas selection, property panel, section actions, undo/redo and device modes.                    |
| Phase 3 — Onboarding               | Wizard, local persistence, brand inputs, dummy catalogue selection and initial generation plan.              |
| Phase 4 — AI operations            | Mock provider, intent scopes, structured proposals, validation pipeline and confirmation cards.              |
| Phase 5 — Draft publishing         | Draft/full preview/published routes, save confirmation, history and restore.                                 |
| Phase 6 — Localisation and imports | English/Finnish content, CSV/Excel mapping, asset upload and missing-data recommendations.                   |
| Phase 7 — Real provider adapters   | Optional text/image providers, secure server routes and AWS-ready provider interfaces.                       |
| Phase 8 — Demo polish              | Sales presets, presenter mode, visual regression, accessibility and performance.                             |

## 22.1 Recommended first vertical slice

The first demonstrable slice should be one seeded jewellery project with a responsive homepage and product page, editor selection, chat-driven mock hero redesign, manual controls, full draft preview and explicit Save changes. This validates the central product loop before building broad onboarding or import capability.

## 22.2 Deliberately deferred items

- Real Shopify, WooCommerce, Instagram, ERP and supplier integrations.

- Production authentication and multi-tenant authorisation.

- Real domain configuration and deployment pipelines.

- Operational checkout, payments, logistics, taxes and orders.

- Unrestricted custom code, plugins or third-party script embeds.

- Real-time multi-user collaboration.

- More than English and Finnish.

# 23. Codex execution contract

## 23.1 Task preparation

Every new Codex task should begin with the task template below. A task may narrow scope but may not silently contradict this specification. When a task reveals a missing product decision, Codex should use the safest existing principle, record the assumption and keep the implementation reversible.

## 23.2 Codex task template

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>TASK TITLE<br />
[Clear, outcome-based title]<br />
<br />
OBJECTIVE<br />
[What must work for the user after this task]<br />
<br />
SPEC REFERENCES<br />
[Requirement IDs and sections from VESKIFY-SDD-001]<br />
<br />
IN SCOPE<br />
- ...<br />
<br />
OUT OF SCOPE<br />
- ...<br />
<br />
USER FLOW<br />
1. ...<br />
<br />
DATA / SCHEMAS<br />
[Entities, operations and component schemas affected]<br />
<br />
UI STATES<br />
- Default<br />
- Loading/generating<br />
- Empty<br />
- Error<br />
- Success/draft changed<br />
<br />
ACCEPTANCE CRITERIA<br />
- Given / When / Then statements<br />
<br />
TESTS REQUIRED<br />
- Unit<br />
- Component/integration<br />
- E2E or visual where applicable<br />
<br />
CONSTRAINTS<br />
- Dummy commerce data only<br />
- No arbitrary generated code<br />
- Draft must remain separate from published snapshot<br />
- Protected price/payment/shipping/tax/order fields must not be modified<br />
<br />
DELIVERABLES<br />
- Code<br />
- Tests<br />
- Documentation/schema updates</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 23.3 Mandatory implementation rules

- Do not create a second competing domain model for pages, sections or tokens.

- Do not bypass the component registry in storefront rendering.

- Do not apply AI output before schema and semantic validation.

- Do not mutate published state from editor actions.

- Do not hide missing error/loading/empty states behind TODO comments.

- Do not introduce provider lock-in into domain or UI code.

- Do not add production commerce functionality to the standalone demo.

- Prefer small vertical slices that end in a usable user flow over disconnected infrastructure.

## 23.4 Pull-request checklist

- [ ] Requirement IDs linked

- [ ] Type checks pass

- [ ] Lint passes

- [ ] Tests pass

- [ ] Responsive review complete

- [ ] Keyboard review complete

- [ ] Draft/published separation preserved

- [ ] Protected fields untouched

- [ ] No arbitrary AI code path

- [ ] Documentation updated

## 23.5 Decision precedence

> **1.** Explicit user instruction for the current task, provided it does not violate a non-negotiable product boundary.
>
> **2.** This Software Design Specification and its requirement IDs.
>
> **3.** Existing tested architecture and component contracts in the repository.
>
> **4.** Documented safe defaults and reversible assumptions.
>
> **5.** Developer preference only when the above sources do not decide the matter.

# Appendices

## Appendix A — Seed demo scenarios

| **Preset**                | **Purpose**                | **Required content**                                                                                   |
|---------------------------|----------------------------|--------------------------------------------------------------------------------------------------------|
| Nordic Jewellery          | Primary complete scenario  | Premium jewellery brand, EN/FI, ring and watch products, editorial homepage and detailed product page. |
| Independent Fashion Store | Secondary visual scenario  | Clothing collections, size/colour options and campaign-led homepage.                                   |
| Legacy Store Redesign     | Existing-site scenario     | Outdated starting design transformed through a whole-site prompt.                                      |
| Campaign Builder          | Existing-customer scenario | Published base store plus a new seasonal landing page and homepage campaign section.                   |

## Appendix B — Sample jewellery catalogue

| **Product**          | **SKU**         | **Dummy price** | **Display attributes**                           |
|----------------------|-----------------|-----------------|--------------------------------------------------|
| Aurora Ring 585      | RING-AUR-585    | €1,290          | Yellow gold 585; diamond; sizes 15–21; engraving |
| Lumi Halo Ring       | RING-LUM-HALO   | €1,890          | White gold 585; round diamond; sizes 15–20       |
| Aava Silver Necklace | NECK-AAVA-925   | €149            | Sterling silver; 45/50 cm variants               |
| Sisu Automatic Watch | WATCH-SISU-AUTO | €690            | Steel; 40 mm; automatic; 10 ATM                  |
| Kajo Rose Earrings   | EAR-KAJO-585    | €490            | Rose gold 585; zirconia; pair                    |
| Meri Bracelet        | BRAC-MERI-925   | €179            | Sterling silver; 17/19/21 cm                     |

## Appendix C — Page template defaults

| **Page**   | **Default sections**                                                                                                         |
|------------|------------------------------------------------------------------------------------------------------------------------------|
| Home       | announcementBar, header, hero, featuredCategories, productGrid, campaignBanner, brandStory, benefitIcons, newsletter, footer |
| Collection | header, collectionHeader, filterBar, productGrid, footer                                                                     |
| Product    | header, productGallery, productInfo, benefitIcons, imageText/details, relatedProducts, footer                                |
| About      | header, hero or imageText, brandStory, gallery, testimonials, footer                                                         |
| Contact    | header, imageText/contact intro, storeLocations, faq, footer                                                                 |
| Cart       | header, cartPage, benefitIcons, footer                                                                                       |
| Checkout   | checkoutShell                                                                                                                |
| Landing    | header optional, hero, campaign sections, product grid or CTA, FAQ optional, footer optional                                 |

## Appendix D — Global validation rules

- Every page ID, section ID, asset ID and snapshot ID must be unique within its aggregate.

- Every section component type and variant must exist in the component registry.

- Every locale field must use only enabled locale keys.

- Colour tokens must be valid colour values and pass configured contrast checks for required pairings.

- Font tokens must resolve to approved fonts.

- Protected commerce paths must be immutable through design operations.

- Navigation targets must resolve to an existing page or safe external URL.

- A page must not contain more than one global header or footer instance.

- Checkout and cart components must use read-only dummy operational content.

- AI operations must target the current project and expected draft revision.

## Appendix E — Product vocabulary

| **Term**      | **Definition**                                                                             |
|---------------|--------------------------------------------------------------------------------------------|
| Agent         | The AI-guided design capability that proposes structured storefront operations.            |
| Canvas        | Interactive storefront rendering surface inside the editor.                                |
| Component     | Registered, tested storefront section implementation.                                      |
| Composition   | Approved arrangement of primitives represented as a registered schema, not arbitrary code. |
| Design tokens | Validated global values controlling colour, typography, shape, spacing and imagery.        |
| Draft         | Editable snapshot containing changes not yet saved to the published demo.                  |
| Published     | Read-only demo snapshot visible through the published route.                               |
| Proposal      | Validated set of AI operations awaiting user acceptance or rejection.                      |
| Section       | One component instance placed on a page.                                                   |
| Snapshot      | Immutable representation of the complete storefront at a revision.                         |

## Appendix F — Open implementation choices

The following choices may be made by the implementing team without changing the product definition, provided the interfaces and acceptance criteria remain intact:

- IndexedDB versus SQLite as the default demo persistence adapter.

- Exact accessible editor primitive library.

- Exact optional AI and image provider behind the defined adapters.

- Exact approach for visual regression snapshots.

- Whether presenter mode is a route, project flag or query parameter.

- Whether import mapping is implemented in a worker for larger files.

## Appendix G — Final baseline statement

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Implementation baseline</strong></p>
<p>The standalone Veskify demo is a design agent, not a commerce operations agent. Its defining loop is guided input → controlled storefront generation → draft editing → full preview → explicit save. Any implementation that bypasses controlled components, mutates operational commerce data, or publishes without confirmation is outside this specification.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>
