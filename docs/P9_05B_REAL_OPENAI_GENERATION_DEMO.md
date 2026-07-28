# P9-05B — real OpenAI merchant-generation demo

P9-05B is the controlled Phase 9 checkpoint for `project_lumo_fresh`. It proves a real provider
can select one registered direction from the approved brief and merchant request; the server then
materializes and validates the complete canonical storefront plan. The provider is never sent a
precomputed plan to repeat, and it cannot apply, save, publish, or alter commerce data.

## Clean baseline and runtime

Start from a clean database and branch that includes P9-05A and P9-04A/B/C. Load the fixture with
`pnpm demo:p9-05a:load`, then verify `project_lumo_fresh` has its approved EN/FI brief, minimal
home/collection/product draft, canonical catalogue and collection order, approved logo/hero/story/
collection assets, and no Aurum or Karvonen state.

Only the local controlled run may set:

```bash
VESKIFY_RUNTIME_MODE=integrated
VESKIFY_AI_PROVIDER=openai
OPENAI_API_KEY=<managed local secret>
```

`VESKIFY_OPENAI_MODEL` is optional when supported by the runtime. Never commit, print, screenshot,
or store the key or raw provider payload. Automated tests use mocked transport only and remain
network-free. Missing runtime configuration is a merchant-safe `providerUnavailable` result; it
must never select the deterministic provider.

## Three independent runs

Reload the authoritative fixture before each exactly-once live request:

1. Premium editorial: “Create a premium editorial storefront for Lumo Atelier. Emphasize
   craftsmanship, approved brand photography, product discovery and refined visual hierarchy.
   Avoid a generic all-black luxury appearance.”
2. Modern technical: “Create a modern technical storefront for Lumo Atelier. Prioritize precise
   product information, confident structure, clear collection navigation and efficient product
   comparison while preserving the approved brand identity.”
3. Warm approachable: “Create a warm and approachable storefront for Lumo Atelier. Make product
   discovery welcoming, use the approved brand story and imagery, and guide customers naturally
   from the homepage to collections and products.”

For each, record only the model ID, start/end timestamps, normalized provider outcome, selected
direction, affected page titles, validation outcome, component/recipe choices, approved asset IDs,
and commerce-preservation comparison. Never retain raw request/response bodies, internal IDs, or
credentials in merchant-facing evidence.

The machine-readable comparison must distinguish homepage recipe and opening composition, section
order, product-card family, collection presentation, PDP presentation, typography, density,
shape/surface, and approved-image treatment. A palette-only or token-only difference fails.

## Required acceptance journey

For the best valid result: review the normal EN and FI merchant-safe proposal, confirm and accept
the one atomic transaction, verify the accepted snapshot, Undo to the exact baseline, Redo to the
exact accepted state, Save draft, reload, Preview homepage/collection/PDP, then explicitly Publish
and confirm the published snapshot matches the saved accepted draft. At every stage compare the
canonical catalogue, product IDs/SKUs/options/variants/prices/availability/media, collection
membership/order, and operational commerce data with the baseline.

Review and visible storefront output must not contain registry IDs, proposal/request IDs,
fingerprints, operation names, raw JSON, provider terms, Aurum, Karvonen, or seed fallback copy.
The warm run must render the approved BrandStory image, not product media substituted as an
editorial image.

Check homepage, a canonical collection, and the complex-ring PDP at 375, 768, 1024, and 1440px
with the stronger clipping detector. Verify navigation, collection controls, PDP options, image
semantics, and long Finnish labels remain usable.

## Deterministic protection

`tests/integration/p9-05b-real-provider-direction-contract.test.ts` uses a mocked OpenAI transport
to prove that the real-provider boundary carries the merchant request and registered options, sends
no final expected plan, accepts only a registered direction, and materializes distinct complete
plans server-side. P9-05A remains the deterministic lifecycle, asset, rendering, and
commerce-preservation baseline.

## Current checkpoint status

No live result is recorded in this document until all three controlled calls, the full merchant
journey, responsive checkpoints, and complete validation are green. Do not mark Phase 9 complete
or update the roadmap on the basis of deterministic coverage alone.
