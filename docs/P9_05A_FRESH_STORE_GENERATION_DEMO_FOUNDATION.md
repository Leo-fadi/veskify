# P9-05A — Fresh-store generation demo foundation

## Purpose

P9-05A provides a deterministic, non-visual proof that a genuinely minimal merchant project can
produce one coordinated core storefront proposal. It uses the canonical approved brief, approved
asset context, catalogue projection, V2-compatible component registry, page recipes,
whole-storefront planner, proposal compiler, atomic acceptance/history, draft save, and preview
selection services. It does not add a second generation pipeline and it does not run or claim the
future real OpenAI demonstration.

The proof lives in
`tests/integration/p9-05a-fresh-store-generation-demo.test.ts`. Its fixture and harness are isolated
under `tests/fixtures` and `tests/helpers`.

## Fresh minimal merchant fixture

The fixture represents **Lumo Atelier**, a Finnish jewellery merchant that is unrelated to
Karvonen and Aurum. It contains:

- an EN/FI project whose primary locale is FI;
- an approved Storefront Design Brief with business identity, brand direction, sources,
  assumptions, page plan, and canonical-commerce reference;
- four approved brand assets: logo, desktop hero, editorial image, and collection image;
- one jewellery collection containing two products in canonical order;
- a simple earring product with no variants or order options;
- a complex made-to-order ring with five option groups and three variants;
- canonical prices, compare-at price, SKU, availability, product media, variant media, and
  collection membership;
- a minimal home, collection, and product composition without dynamic collection/PDP components
  or a brand-story section.

The fixture does not copy merchant presentation content or identity from an existing seed. All
three deterministic directions receive byte-identical catalogue and approved-asset inputs.

## Deterministic design directions

The scenarios use only currently registered recipes, components, variants, and design-system
selection values.

| Direction         | Homepage recipe and order                                                                  | Collection presentation                                           | PDP presentation                                                                         | Design groups beyond colour                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Premium editorial | `homePremiumEditorial`: header, hero, categories, products, footer; `fullBleed` hero       | `editorial`, spacious grid, image-first cards, horizontal filters | `editorialSplit`, grid gallery, comfortable options, grouped attributes, editorial media | refined-serif typography, spacious density, soft corners, layered surfaces, editorial crop               |
| Modern technical  | `homeModernCommerce`: header, hero, products, categories, footer; `asymmetric` hero        | `compact`, compact grid and cards, sidebar filters                | `compact`, thumbnails, compact options, attribute table, contained media                 | technical-functional typography, compact density, square corners, flat surfaces, product-neutral imagery |
| Warm approachable | `homeWarmStory`: header, hero, brand story, categories, products, footer; `editorial` hero | `editorial`, standard grid and cards, horizontal filters          | `balanced`, thumbnails, comfortable options, grouped attributes, contained media         | warm-approachable typography, standard density, rounded corners, subtle surfaces, soft-frame imagery     |

For every pair, the test requires exact differences in homepage composition, collection
presentation, PDP presentation, and at least two non-colour design-system groups. A changed
fingerprint, palette, or type choice alone cannot satisfy the proof.

## Core storefront and protected-commerce standard

Each scenario must compile to one validated and reviewable proposal that coordinates the
homepage, dynamic collection presentation, dynamic PDP presentation, catalogue-derived
navigation/bindings, coherent brand tokens, approved presentation assets, and one complete
storefront fingerprint.

The protected-commerce baseline records and compares:

- catalogue, collection, product, variant, and option identities;
- SKU and product type;
- option definitions, values, and variant selections;
- price and compare-at price;
- stock and availability truth;
- canonical product and variant media;
- collection membership and product order.

Planning, generation, review, acceptance, Undo, Redo, Save, and Preview operate on presentation
state only. Payments, taxes, shipping, orders, and inventory are not represented in the proposal
payload.

## Lifecycle path

The deterministic harness proves these exact states:

```text
fresh active draft
  -> generate validated plan and proposal (draft/history unchanged)
  -> review and confirm (draft/history unchanged)
  -> accept complete proposal atomically
  -> undo to the exact baseline
  -> redo to the exact accepted snapshot
  -> save a new canonical draft snapshot
  -> resolve draft preview to that saved snapshot
```

Stored and published snapshots remain unchanged until the explicit Save step, and Save does not
change the published snapshot. Rejected, stale, or invalid proposals preserve the active draft,
stored draft, published state, and empty history.

## P9-05B real OpenAI demonstration runbook

This is the reproducible script for a later, explicitly authorized P9-05B run. P9-05A must not
execute it.

### Clean starting state and prerequisites

1. Start from an approved integration branch that includes P9-05A and final integrated P9-04
   acceptance. Require a clean worktree and record the commit SHA.
2. From a clean local demo database, run `pnpm demo:p9-05a:load`. It loads the stable
   `project_lumo_fresh` aggregate through the browser `IndexedDbProjectRepository`, verifies the
   approved brief and asset context, and exposes the editor route
   `/projects/project_lumo_fresh/editor`. The loader refuses an existing project ID rather than
   replacing a draft; reset the dedicated demo database explicitly before a new run.
3. Start the local application, open that editor route, and confirm its active draft has only the
   minimal home, collection, and product compositions described above and that history is empty.
4. Record canonical fingerprints for the active draft, stored draft, published snapshot, approved
   brief, approved assets, and protected-commerce baseline.
5. Configure these **server-side** environment variables before starting the integrated runtime:

   ```bash
   VESKIFY_RUNTIME_MODE=integrated
   VESKIFY_AI_PROVIDER=openai
   OPENAI_API_KEY=<managed secret>
   ```

   `VESKIFY_OPENAI_MODEL` is an optional supported model override. Credentials must remain in the
   managed environment and must never be committed, logged, copied into fixtures, or captured in
   evidence. Deterministic automated acceptance does not use the live provider; OpenAI is called
   only in this controlled P9-05B demonstration.

6. Confirm authenticated server project authority and the canonical repository are available.
   Missing authority or credentials is a stop condition, never a reason to fall back silently to
   the deterministic provider. `providerUnavailable` is expected when integrated runtime mode or
   credentials are missing or incompatible.

### Merchant request

Submit this merchant instruction once:

> Create a premium but approachable Finnish jewellery storefront. Emphasize craftsmanship,
> product imagery and ring discovery. Avoid a generic luxury-black appearance.

Do not edit the provider response, bypass proposal validation, or manually complete missing
storefront structure.

### Expected run and evidence

1. Generate one structured whole-storefront proposal through the real provider adapter.
2. Capture safe evidence only: starting commit, fixture/project ID, provider/model ID, normalized
   outcome, request duration, operation count, proposal fingerprint, affected page titles,
   localized merchant review, and screenshots of the review state. Do not capture prompts,
   credentials, raw provider bodies, catalogue payloads, or internal provider errors.
3. Verify the proposal contains a coordinated homepage, dynamic collection experience, and
   complex-ring PDP using registered recipes and variants, approved assets, canonical collection
   and product bindings, and a complete-snapshot fingerprint.
4. Before acceptance, verify the active/stored/published fingerprints and history are unchanged.
5. Confirm and Accept once. Record the accepted snapshot fingerprint and one atomic history
   transaction.
6. Undo and verify the exact starting fingerprint; Redo and verify the exact accepted
   fingerprint.
7. Save draft, open Preview, and verify Preview resolves to the saved coordinated snapshot while
   the published fingerprint remains unchanged.
8. Recompute the protected-commerce baseline after every stage and require exact equality.

### Stopping conditions

Stop without acceptance if authorization, credentials, provider execution, schema validation,
registered capability validation, approved-asset validation, canonical binding validation, or
protected-field validation fails. Also stop if the proposal is stale, rejected, empty, requires
invented facts/components, exposes internal identifiers/provider terminology, or needs manual
completion of most of the core storefront. Preserve all baseline state and record the normalized
failure category.

Stop successfully after evidence for Review, Accept, Undo, Redo, Save, and Preview is captured and
protected commerce and published state remain unchanged. Do not publish to a real Vesko service as
part of this demonstration.

### Meaningful generation check

A meaningful result changes coordinated structure and presentation across home, collection, and
PDP. A legacy restyle changes only palette/type, rearranges one existing section, retains the same
minimal homepage, or leaves collection/PDP presentation untouched. The latter is a failed
demonstration even if schema validation passes.

## Reusable P9-05B evaluation rubric

The future real-provider run fails if any of these statements is true:

- it changes only colours or fonts;
- it rearranges only one existing section;
- it preserves the same homepage structure for every direction;
- it leaves legacy collection or PDP presentation untouched;
- it uses unapproved assets;
- it exposes internal IDs or provider terminology to the merchant;
- it invents unsupported components or merchant/product facts;
- it changes protected commerce data;
- it requires manual completion of most of the core storefront.

It passes only when all of these statements are true:

- the result is recognizably specific to the merchant;
- homepage, collection, and PDP express one coherent design direction;
- the result differs structurally from the minimal baseline;
- registered recipes and variants are selected coherently;
- approved assets are used appropriately;
- protected commerce truth remains unchanged;
- the proposal is understandable and reviewable;
- the complete proposal can be accepted and reversed atomically.

## Known capability boundaries

- The canonical planner currently supports one representative product-template plan per
  whole-storefront proposal. The complex ring is selected for the generated PDP; the simple
  earrings remain canonically bound through the collection. Proving separate generated PDP
  snapshots for both products requires a future registered planner/page capability and is not
  invented here.
- Final responsive acceptance at 375, 768, 1024, and 1440 px and final integrated editor/review
  accessibility belong to P9-04 acceptance. P9-05A is deliberately non-visual.
- The real-provider execution, evidence capture, and qualitative merchant-specific evaluation
  belong to P9-05B.

No authoritative SDD or ADR contradiction was found, so this foundation does not revise those
contracts.
