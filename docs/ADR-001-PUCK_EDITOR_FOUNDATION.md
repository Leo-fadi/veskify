# ADR-001: Puck as the embedded editor foundation

- Status: Accepted
- Date: 2026-07-15
- Decision owners: Veskify product and engineering
- Related specification: SDD §2.1, §9, §15, §16 and §22–§23

## Context

Veskify needs a visual storefront editor with accessible canvas mechanics, section selection, insertion, drag-and-drop reordering, viewport controls and property fields. These mechanics are necessary infrastructure, but they are not the Veskify product model. Veskify must continue to enforce controlled components, structured AI output, protected commerce fields, draft/published separation and explicit publishing confirmation.

The Phase 0 Batch 1 proof demonstrated that `@puckeditor/core` can be embedded behind a Veskify-owned adapter while rendering an approved storefront component and validating editor output before draft handoff.

## Decision

Veskify will use the open-source `@puckeditor/core` package as its embedded visual-editor foundation.

Puck owns:

- canvas and viewport mechanics;
- component insertion and section selection;
- drag-and-drop placement and reordering;
- editor fields and their interaction foundation;
- editor-only rendering infrastructure exposed through documented Puck APIs.

Veskify owns:

- canonical project, page, section, snapshot and brand schemas;
- registered component contracts, variants, fields and storefront implementations;
- schema and semantic validation, including protected-field guardrails;
- draft commands, undo/redo, history and published-snapshot separation;
- storage adapters and persistence formats;
- explicit publish confirmation and published storefront boundaries;
- AI operation schemas, validation and provider abstraction;
- dummy catalogue and protected commerce data;
- storefront rendering consistency across editor, preview and published modes.

All `@puckeditor/core` imports and Puck-specific types remain under `src/integrations/puck`. The adapter may depend on Veskify contracts; canonical domain, application, storage and AI modules may not depend on Puck types. Puck Data is transient adapter data and is never a second persisted page tree.

Puck output is untrusted until validated and mapped to canonical Veskify draft operations. A Puck publish callback is a draft-handoff event only and cannot publish directly. Puck Cloud and Puck AI are excluded, and AI output may never contain arbitrary React, HTML, CSS, JavaScript, scripts or embeds.

## Consequences

- Veskify gains maintained editor mechanics without building a generic site-builder engine.
- The registered Veskify component system remains the source of truth for derived Puck Config and all storefront rendering.
- Future Puck upgrades are contained within the integration adapter.
- Replacing Puck remains possible because persistence and domain contracts are editor-agnostic.
- Adapter mapping and validation add deliberate boundary code, but prevent Puck state from bypassing product guardrails.

## Alternatives rejected

### Custom drag-and-drop editor

Rejected because it duplicates mature canvas, selection, insertion, reordering, field and viewport foundations. It would consume Phase 0–2 effort, increase accessibility and interaction risk, and create a competing editor model contrary to the single canonical Veskify composition.

### HugoBlox

Rejected because its content/site-building architecture does not match the required Next.js, React and Puck-based embedded-editor boundary. Adopting it would introduce a competing page/component model and weaken Veskify's control over schemas, rendering and future Vesko integration.

### Puck Cloud or Puck AI

Rejected because Veskify must own persistence, publishing, AI operations, provider isolation and protected commerce guardrails. Hosted persistence or AI paths would move those responsibilities outside the approved architecture.

## Compliance checks

- `rg '@puckeditor/core' src` returns imports only under `src/integrations/puck`.
- Puck Config exposes only registered Veskify components and approved fields.
- Puck output is schema-validated before draft state or persistence.
- The same Veskify storefront component implementations are used in editor, preview and published rendering.
- No Puck callback writes the published snapshot directly.
