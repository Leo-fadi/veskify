# P9-05B — real OpenAI merchant-generation demo

P9-05B is the controlled Phase 9 checkpoint for `project_lumo_fresh`. It proves a real provider
can select one registered direction from the approved brief and merchant request; the server then
materializes and validates the complete canonical storefront plan. The provider is never sent a
precomputed plan to repeat, and it cannot apply, save, publish, or alter commerce data.

## Clean baseline and runtime

The executable demo authority is a server-only, process-local repository named
`p9-05b-lumo-local-server`. It is seeded from the canonical P9-05A fixture factory, loads only
`project_lumo_fresh`, survives HTTP requests for the life of the local server process, and is
unavailable unless every explicit local-demo setting is present. It is not browser IndexedDB and
cannot activate in production.

In terminal A, configure the controlled runtime without writing a `.env` file, confirm the
managed secret is present without printing it, and start the application:

```bash
export VESKIFY_RUNTIME_MODE=integrated
export VESKIFY_AI_PROVIDER=openai
export VESKIFY_P9_05B_LOCAL_DEMO=1
export VESKIFY_P9_05B_LOCAL_DEMO_TOKEN="$(openssl rand -hex 32)"
test -n "$OPENAI_API_KEY"
test "${#VESKIFY_P9_05B_LOCAL_DEMO_TOKEN}" -ge 32
pnpm dev
```

`VESKIFY_OPENAI_MODEL` is optional when supported by the runtime. Never commit, print, screenshot,
or store the key or raw provider payload. Automated tests use mocked transport only and remain
network-free. Missing runtime configuration is a merchant-safe `providerUnavailable` result; it
must never select the deterministic provider.

In terminal B, verify the server authority, then reset it to the deterministic fixture. The reset
creates one opaque, reset-scoped demo session. Keep the returned `sessionId` in this terminal only;
it is neither persisted nor a merchant-facing value.

```bash
curl --fail --silent --show-error http://localhost:3000/api/demo/p9-05b
reset="$(curl --fail --silent --show-error --request POST \
  --header 'Origin: http://localhost:3000' \
  --header "x-veskify-p9-05b-demo-token: $VESKIFY_P9_05B_LOCAL_DEMO_TOKEN" \
  http://localhost:3000/api/demo/p9-05b)"
session_id="$(printf '%s' "$reset" | jq -r '.session.sessionId')"
test -n "$session_id" && test "$session_id" != null
curl --fail --silent --show-error http://localhost:3000/api/demo/p9-05b
```

Each successful response reports `project_lumo_fresh`, its baseline and active aggregate
fingerprints, empty history, and `/projects/project_lumo_fresh/editor`. Stop before a provider call
if the project ID differs, the aggregate fingerprint does not equal the baseline fingerprint, the
history count is not zero, or the endpoint is unavailable.

## Three independent runs

Use the actual server proposal route through its demo-only request builder. The builder sends the
merchant request to the selected OpenAI model; the response may choose only a registered direction,
and the server materializes and validates the complete plan. Run premium editorial exactly once:

```bash
generated="$(curl --fail --silent --show-error \
  --request POST \
  --header 'Origin: http://localhost:3000' \
  --header 'content-type: application/json' \
  --header "x-veskify-p9-05b-demo-token: $VESKIFY_P9_05B_LOCAL_DEMO_TOKEN" \
  --data "{\"projectId\":\"project_lumo_fresh\",\"sessionId\":\"$session_id\",\"merchantInstruction\":\"Create a premium editorial storefront for Lumo Atelier. Emphasize craftsmanship, approved brand photography, product discovery and refined visual hierarchy. Avoid a generic all-black luxury appearance.\"}" \
  http://localhost:3000/api/demo/p9-05b/generate)"
editor_route="$(printf '%s' "$generated" | jq -r '.editorRoute')"
test -n "$editor_route" && test "$editor_route" != null
printf 'Open http://localhost:3000%s\n' "$editor_route"
```

Open the printed URL exactly. It is the normal Storefront Studio editor route, with a one-reset
server session boundary. On its first load, the route validates and imports the authoritative
`project_lumo_fresh` aggregate through the canonical browser repository, then validates the
pending proposal against the active draft before showing the normal merchant review. It uses the
existing proposal acceptance coordinator, atomic history, Save draft, Preview and Publish paths;
it does not expose proposal JSON or require IndexedDB edits. Reloading after Save keeps the saved
browser draft. A reset creates a new session and replaces the prior local-demo aggregate on the
next documented editor load, clearing its generated proposal and history.

Reset and verify the identical baseline, then run modern technical exactly once:

```bash
reset="$(curl --fail --silent --show-error --request POST --header 'Origin: http://localhost:3000' --header "x-veskify-p9-05b-demo-token: $VESKIFY_P9_05B_LOCAL_DEMO_TOKEN" http://localhost:3000/api/demo/p9-05b)"
session_id="$(printf '%s' "$reset" | jq -r '.session.sessionId')"
curl --fail --silent --show-error http://localhost:3000/api/demo/p9-05b
generated="$(curl --fail --silent --show-error \
  --request POST \
  --header 'Origin: http://localhost:3000' \
  --header 'content-type: application/json' \
  --header "x-veskify-p9-05b-demo-token: $VESKIFY_P9_05B_LOCAL_DEMO_TOKEN" \
  --data "{\"projectId\":\"project_lumo_fresh\",\"sessionId\":\"$session_id\",\"merchantInstruction\":\"Create a modern technical storefront for Lumo Atelier. Prioritize precise product information, confident structure, clear collection navigation and efficient product comparison while preserving the approved brand identity.\"}" \
  http://localhost:3000/api/demo/p9-05b/generate)"
printf 'Open http://localhost:3000%s\n' "$(printf '%s' "$generated" | jq -r '.editorRoute')"
```

Reset and verify once more, then run warm approachable exactly once:

```bash
reset="$(curl --fail --silent --show-error --request POST --header 'Origin: http://localhost:3000' --header "x-veskify-p9-05b-demo-token: $VESKIFY_P9_05B_LOCAL_DEMO_TOKEN" http://localhost:3000/api/demo/p9-05b)"
session_id="$(printf '%s' "$reset" | jq -r '.session.sessionId')"
curl --fail --silent --show-error http://localhost:3000/api/demo/p9-05b
generated="$(curl --fail --silent --show-error \
  --request POST \
  --header 'Origin: http://localhost:3000' \
  --header 'content-type: application/json' \
  --header "x-veskify-p9-05b-demo-token: $VESKIFY_P9_05B_LOCAL_DEMO_TOKEN" \
  --data "{\"projectId\":\"project_lumo_fresh\",\"sessionId\":\"$session_id\",\"merchantInstruction\":\"Create a warm and approachable storefront for Lumo Atelier. Make product discovery welcoming, use the approved brand story and imagery, and guide customers naturally from the homepage to collections and products.\"}" \
  http://localhost:3000/api/demo/p9-05b/generate)"
printf 'Open http://localhost:3000%s\n' "$(printf '%s' "$generated" | jq -r '.editorRoute')"
```

Stop a run immediately on a non-2xx response, `providerUnavailable`, stale or validation failure,
an unregistered direction, a baseline mismatch, an unsupported component, an unapproved asset, or
any protected-commerce difference. Do not retry a live request merely to obtain a preferred
direction.

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

After the controlled work, stop the server and remove the secret from the shell:

```bash
unset OPENAI_API_KEY
unset VESKIFY_P9_05B_LOCAL_DEMO_TOKEN
```

Confirm `git status --short` contains no credential or local environment file before retaining any
evidence. The process-local repository disappears when the server stops; resetting it never reads,
deletes, or replaces another project.

## Deterministic protection

`tests/integration/p9-05b-real-provider-direction-contract.test.ts` uses a mocked OpenAI transport
to prove that the real-provider boundary carries the merchant request and registered options, sends
no final expected plan, accepts only a registered direction, and materializes distinct complete
plans server-side. `tests/integration/p9-05b-local-demo-authority.test.ts` proves that the explicit
server authority loads the project, the actual proposal route reaches a mocked provider without
fallback, and three resets reproduce the same baseline after saved and published changes. P9-05A
remains the deterministic lifecycle, asset, rendering, and commerce-preservation baseline.

## Current checkpoint status

No live result is recorded in this document until all three controlled calls, the full merchant
journey, responsive checkpoints, and complete validation are green. Do not mark Phase 9 complete
or update the roadmap on the basis of deterministic coverage alone.
