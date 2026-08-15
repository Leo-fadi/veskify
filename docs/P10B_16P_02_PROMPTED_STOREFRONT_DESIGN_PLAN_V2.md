# P10B-16P-02 — Prompted Storefront Design Plan V2

## Status and ownership

**Parent status: Baseline.** P10B-16P-02A, P10B-16P-02B, P10B-16P-03, and P10B-16P-04 are
**Baseline**. P10B remains **Partial**; P10B-17 and P10B-18 remain **Planned**.

Part A establishes the provider-safe capability projection, strict versioned request, transient
Design Intent V2 result, exact reference validation, deterministic normalization/fingerprints,
server-only OpenAI adapter, safe failure classification, and mocked-transport evidence. It makes
zero provider and Vesko calls. It does not compile the intent, materialize a storefront, create a
proposal or snapshot, or wire the normal Storefront Studio journey. No live V2 provider acceptance
occurred in P10B-16P-02A itself.

Part B implements the deterministic post-provider preference compiler against refreshed current
authority and consumes its exact decision once through canonical synthesis and isolated proposal
materialization. It made zero provider and Vesko calls. P10B-16P-03 owns normal Studio prompt
routing and proposal review. P10B-16P-04 subsequently completed separately authorized live Design
Intent acceptance, narrowed the provider wire to bounded semantics, and classified P10B-16L as
Deprecated compatibility-only. Current implementation and retained evidence take precedence over
this historical delivery plan.

## 1. Provider-boundary audit

### 1.1 Existing P10B-16L compatibility path

The P10B-16L path is a governed bounded preset selector, not prompted storefront-plan generation:

1. `src/app/api/demo/p10b-live/generate/handler.ts` invokes
   `createP10bLiveSynthesisGenerateHandler`.
2. `src/integrations/ai/p10b-live-synthesis-acceptance-authority.server.ts` uses its
   `intentPreflightAuthority`.
3. `createP10bLiveSynthesisIntentPreflightAuthority` in
   `src/application/bounded-storefront-synthesis/live-provider-acceptance.ts` enumerates
   executable intent authority.
4. `listExecutableCoordinatedDirectionIntents` in
   `src/application/bounded-storefront-synthesis/coordinated-directions.ts` executes each candidate
   through `executeCoordinatedDirection`.
5. `executeBoundedStorefrontSynthesis` in
   `src/application/bounded-storefront-synthesis/synthesizer.ts` and
   `materializeCompleteStorefrontSelection` in
   `src/application/whole-storefront-generation-plan/complete-storefront-materializer.ts` create
   complete compatible results before the provider request. A retained map binds each executable
   intent fingerprint to its already completed `CoordinatedDirectionResult`.
6. `OpenAiP10bLiveSynthesisIntentProvider.selectIntent` in
   `src/integrations/ai/openai/p10b-live-synthesis-intent-provider.ts` asks OpenAI only to return the
   request fingerprint, one advertised `executableIntentId`, and its executable fingerprint.
7. The acceptance authority refreshes authority, validates that selection, and resolves the
   retained completed result for proposal projection.

The one previously authorized OpenAI call predated this corrected executable-option boundary. It
completed the strict v1 direction/posture result and then failed during coordinated synthesis with
the safe `malformed-state` classification. The current v2 compatibility bridge now executes and
materializes every advertised candidate before provider selection, but it has made zero live calls.
Neither the retained v1 call nor the corrected bridge proves prompt-driven storefront generation.

`p10bLiveSynthesisIntentProviderRequestSchema`,
`p10bLiveSynthesisIntentProviderResultSchema`,
`createP10bLiveSynthesisIntentPreflightAuthority`,
`validateP10bLiveSynthesisIntentProviderResult`, the retained-result map, and
`OpenAiP10bLiveSynthesisIntentProvider` selection semantics are now Deprecated compatibility-only
after P10B-16P-04 accepted the V2 path. They were not removed or rerouted in Part A.

### 1.2 Existing normal Studio provider path

The current Studio session creates `ServerWholeStorefrontPlanningClient` in
`src/integrations/ai/whole-storefront-runtime-client.ts`; generation calls
`/api/ai/whole-storefront-proposals`. `createWholeStorefrontPlanningRouteHandler` in
`src/app/api/ai/whole-storefront-proposals/handler.ts` delegates to the authority in
`src/integrations/ai/whole-storefront-runtime-authority.ts`. The request is preclassified through
`buildAiStorefrontProviderRequestForSupportedCapability` in
`src/application/ai-storefront-generation/request-builder.ts` and
`classifyRegisteredWholeStorefrontDirectionRequest` in
`src/application/ai-storefront-generation/planner.ts`, then the authority invokes
`requestWholeStorefrontGenerationPlan`.

`buildWholeStorefrontPlanningProviderRequest` in
`src/application/whole-storefront-generation-plan/provider.ts` currently creates the expected
registered plan and direction options before OpenAI. `OpenAiWholeStorefrontPlanningProvider` in
`src/integrations/ai/openai/whole-storefront-planning-provider.ts` returns a coarse `selectionId`;
`openAiDirectionDtoToWholeStorefrontPlan` resolves that selection through a server-owned plan
callback. This is controlled registered-direction selection, not Design Intent V2 generation.

Reusable infrastructure includes server-only trusted provider configuration, injected Responses
transport, strict closed JSON schemas, `store: false`, zero-retry configuration, bounded timeout,
provider failure mapping, safe usage telemetry, and deterministic authority fingerprints. The
coarse `selectionId` semantics are Deprecated compatibility-only for V2 initial generation.
Removal still requires a consumer-proven, separately authorized cleanup task.

## 2. Singular authority boundary

The canonical inheritance remains:

```text
BrandSystem
→ PageBlueprint profile
→ component family / meaningful variant
→ bounded validated instance override
```

`PromptedStorefrontCapabilityProjection` is a deterministic read-only view over those existing
authorities. `PromptedStorefrontDesignRequestV2` is a transient provider request.
`PromptedStorefrontDesignIntentV2` is a transient, untrusted, non-canonical, non-executable result
bound to exactly one request and authority state. None is another registry, plan, page graph,
PageBlueprint, proposal, `StorefrontSnapshot`, publication artifact, or model-reasoning record.

Before a V2 provider response, Veskify may read and validate capability knowledge only. It must not
execute P10B-15 synthesis or complete P10B-16 candidates, select a complete plan, materialize
PageBlueprints, create proposal operations, construct a candidate `StorefrontSnapshot`, or
advertise an ID for an already completed storefront. Part A has no dependency on those execution
paths.

## 3. Provider-safe capability projection

The projection exposes stable merchant/design-language preference keys in deterministic order. Each
entry carries its design dimension, context/family metadata for the later compiler, availability,
and opaque server-side references to exact current authority. It does not copy raw registries,
source-code details, private evidence, products, routes, or executable layouts.

The bounded dimensions cover:

- Design DNA typography pairing/hierarchy/scale, colour posture, spacing, density, surfaces,
  elevation, controls, shape/radius, media and responsive posture;
- compatible shared frames, header/navigation/announcement/utility/footer/mobile anatomy and
  responsive behavior;
- homepage profiles, narrative and commercial roles, compatible component families/meaningful
  variants, bounded section counts, evidence needs and asset roles;
- collection archetypes, discovery/density, filter/sort and child-collection presentation,
  merchandising and canonical product-card anatomies;
- PDP standard, configurable, gallery-led, high-consideration and generic fallback capabilities,
  option complexity, media depth, purchase hierarchy and related merchandising;
- static content/support families, approved-fact requirements, safe omission, and governed utility
  presentation; and
- responsive hierarchy/density transformations and approved crop, focal/safe-area, ratio, overlay
  and media-treatment postures.

Search is exposed as **registered presentation authority / executable runtime unavailable**. The
projection records the missing first-class canonical query/results adapter and fail-closed runtime
state. It never advertises operational search execution.

## 4. Strict provider request

The versioned request binds:

- contract, request, exact merchant prompt, prompt fingerprint and request fingerprint;
- project/draft identity, draft revision, current `StorefrontSnapshot`, dynamic-commerce,
  capability-manifest, PageBlueprint, Design DNA, brief/evidence, approved-asset and aggregate
  catalogue/commerce fingerprints;
- approved safe business name, industry, brand summary, customer, market, tone/visual priorities,
  locales, exclusions and unsupported requirements;
- bounded aggregate product/collection/product-type, simple/configurable, option-complexity,
  media-depth, high-consideration and collection-density characteristics;
- approved evidence families, presentation-asset roles, editorial imagery availability,
  evidence-dependent capabilities and safe omissions;
- the compact capability projection; and
- bounded recent accepted/rejected structural fingerprints, recent posture keys and explicit
  merchant avoidance preferences where available.

The exact merchant prompt reaches the provider unchanged. Deterministic normalization used for
fingerprinting does not rewrite that transmitted prompt. The request excludes full product records,
prices, stock, customer/order/private operational data, raw media, unnecessary raw evidence,
credentials and authorization values.

## 5. Strict Design Intent V2 result

The closed, bounded schema rejects additional properties, arbitrary dictionaries, code, CSS,
classes, executable section trees, invented components and per-product/per-collection design
entries. It returns only preference-rich design intent:

- exact contract, request and prompt fingerprint identity;
- a short safe concept summary, commercial posture and intended customer experience;
- hard merchant constraints, ranked soft preferences, optional suggestions and explicit avoidance
  preferences;
- ranked Design DNA preferences;
- shared-frame, header, navigation, announcement, utility, footer, mobile and responsive intent;
- homepage profile, bounded narrative-role sequence, required/preferred/optional/avoided roles,
  family/meaningful-variant, section-count/rhythm, evidence-omission and asset-role preferences;
- collection/search archetype, discovery, density, filter/sort, child-collection, merchandising,
  product-card and no-results relationship intent while preserving search unavailability;
- PDP archetype and canonical product-type intentions, option/media/purchase hierarchy,
  related-merchandising and product-card preferences;
- optional supported content/support page families, narrative purpose, evidence requirements and
  safe omission;
- registered family, meaningful-variant and bounded-parameter preferences; and
- responsive hierarchy, density transformation, desktop/mobile priority, art-direction, crop,
  focal, overlay and approved media-role preferences.

This metadata is an explicit product output, not private chain-of-thought. The provider cannot emit
an `executableIntentId`, exact profile/frame/component resolution, arbitrary route, commerce value,
page graph, proposal or snapshot.

## 6. Exact reference validation

Schema parsing is followed by current-request validation. Every preference key must have been
advertised by the exact request, belong to the design dimension required by its result field, and
have availability appropriate to its hard/soft/optional semantics. Context metadata is retained for
P10B-16P-02B, which owns cross-preference compatibility resolution. Product-type intentions may
reference only advertised canonical aggregate product-type keys. Dynamic archetype preferences may
not reference concrete product IDs, collection IDs or route URLs. Search cannot be promoted to an
executable requirement while its runtime adapter is unavailable.

Unknown, stale, invented, wrong-dimension or unavailable required keys fail closed. There is no
fuzzy repair, preset substitution, hidden fallback, or partial intent. Request and prompt
fingerprints must match exactly.

## 7. Deterministic normalization and evidence

Capability projection, request and parsed intent have deterministic fingerprints independent of
source iteration order. The intent fingerprint covers every material constraint and preference.
Fingerprints exclude secrets, headers, raw transport objects, non-authoritative timestamps,
latency and token usage.

Safe evidence is limited to provider/model identity, call/retry count, request/prompt/intent
fingerprints, contract version, bounded token usage and sanitized outcome/failure class. Raw prompts,
provider request/response bodies, credentials and authorization headers are not retained or logged.

## 8. Strict OpenAI adapter and failures

The server-only adapter uses strict structured output, `store: false`, zero OpenAI SDK retries,
zero application retries, a bounded timeout, one transport attempt, exact fingerprint verification,
and injected transport for deterministic tests. It makes no repair request and has no deterministic,
selection-provider or executable-intent fallback.

Typed safe failures distinguish refusal, timeout, transport failure, malformed output,
strict-schema invalidity, unsupported version, fingerprint mismatch, unknown/wrong-dimension/
unavailable capability, unknown product-type key and stale current authority. Every failure creates
no proposal, storefront, snapshot or history entry; mutates no draft or commerce; and triggers no
retry or fallback.

## 9. Deterministic compilation and canonical materialization

Part B introduces one strict versioned `CompiledPromptedStorefrontDesignDecisionV2`. It binds the
exact request, prompt, provider-intent, refreshed current authority, capability-reference authority,
base snapshot identity and revision. The result is transient execution authority, not a second
storefront plan, page graph, snapshot, component registry or provider reasoning record.

Compilation reconstructs the exact current request and rejects any stale prompt/request/snapshot,
manifest, PageBlueprint, Design DNA, dynamic-commerce, approved evidence/asset or aggregate
catalogue authority. A bounded metadata-only compatibility solver then applies exact hard,
ranked-soft, optional and avoidance semantics with canonical stable tie-breaking and an explicit
candidate budget. It requires material usable intent across Design DNA, shared frame, homepage
composition/narrative, collection, PDP and responsive/art direction. Contradictory hard choices,
insufficient intent, unavailable evidence/assets, unsupported runtime projection or a budget
overflow fails before synthesis.

The compiler resolves exact registered Design DNA, shared frame, homepage/collection/search/PDP
profiles, collection/search and PDP archetypes, complete product-type mappings with a generic
fallback, product-card anatomies, component families, meaningful variants, bounded values,
static/support and utility selections, narrative priorities, responsive posture, art direction and
approved asset-role use. Material component selections are expressed only as canonical
PageBlueprint slot overrides and must validate against the selected profile and renderer-consumed
runtime authority. Search retains one exact registered presentation choice while operational
execution remains unavailable and fail closed.

Every material preference retains an `accepted`, `substituted`, `rejected`, `omitted`, or
`defaulted` diagnostic with path, key, semantics, requested rank/value, selected exact authority,
stable reason and authority fingerprint. Equivalent input and authority produce identical
compiled, structural and dynamic-route fingerprints; a material preference or selection change
changes the appropriate fingerprint.

One validated compiled decision extends the existing P10B bounded synthesis decision. The
canonical generation-plan materializer consumes exact PageBlueprint/dynamic authority once and the
existing whole-storefront lifecycle creates one isolated proposal. `StorefrontSnapshot` remains
the sole canonical editable aggregate. No failed compilation or materialization creates a partial
decision, proposal, snapshot or history mutation, and protected commerce remains unchanged. The
executable decision carries the selected exact authority values, not a coordinated-direction
`selectionId`, compatibility-package wrapper or precomputed-candidate identity. Those identifiers
may support bounded internal solving and diagnostics only; the synthesis/materialization boundary
revalidates and consumes the exact values themselves.

## 10. Transitional delivery

P10B-16L and the legacy whole-storefront selector remain operational for compatibility. P10B-16P-03
now wires the V2 adapter/compiler to the normal Studio whole-storefront generation operation and
`use-design-agent-session` while leaving follow-up scopes on their existing bounded paths. It does
not wire the P10B live demo or authorize a live provider. Its server authority reaches the existing
isolated proposal materializer only after deterministic compilation succeeds. The P03 standalone/
mock composition mints exactly one registered `APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION`
structured operation with the target-bound `compilePromptedStorefrontDesignIntentV2@2.0.0`
permission. It binds the exact P02B source-proposal fingerprint and compiler lineage to proposal
metadata and the response. The candidate and saved snapshot preserve exact evidence references as
provenance, while review and normal Preview resolve current approved evidence independently from
trusted server/session authority; persisted snapshot references never authorize themselves.

P10B-16P-02B refreshes exact authority, deterministically compiles V2 preferences into registered
compatible selections, and only then invokes existing P10B-15/P10B-16 materialization and the
canonical proposal path. P10B-16P-03 connects the normal mocked Storefront Studio
prompt-to-review/accept/save/preview journey. The local P03 authority is not integrated
authentication. P10B-16P-04 subsequently supplied a production-disabled trusted server-owned
acceptance composition, completed separately authorized live V2 acceptance, and classified the
legacy P10B-16L bridge as Deprecated compatibility-only. Running the legacy selector again cannot
prove Design Intent V2 acceptance.

## 11. Evidence and explicit non-claims

Part A has contract/schema, deterministic unit and mocked-transport integration evidence. Part B
has contract/schema, deterministic unit and integration evidence for capability reachability,
metadata-only bounded resolution, exact PageBlueprint/dynamic selections, canonical synthesis and
isolated proposal creation, materialized-plan/proposal/snapshot protected-commerce verification,
fingerprints, diagnostics and no-partial failures.
Existing P10B-15/P10B-16 synthesis, P10B-16P-01 archetype, legacy provider and publication
regressions remain compatible. Provider and Vesko call count for both parts is zero.

Part A alone does not claim deterministic intent compilation or materialization. Part B alone does
not claim normal Studio reachability. P10B-16P-03 does not claim live V2 provider evidence,
executable search, retained V2 human visual review, P10B-17 responsive/performance closure,
P10B-18 commercial quality/scale closure, Vesko staging, or production readiness.
