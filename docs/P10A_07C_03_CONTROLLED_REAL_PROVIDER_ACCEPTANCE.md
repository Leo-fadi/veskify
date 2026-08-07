# P10A-07C-03R — Controlled Real-Provider Acceptance

## Status

Completed on 7 August 2026 through the explicitly authorized W1 gate. The trusted server
configuration selected `openai-whole-storefront-planning` with the valid safe model identity
`gpt-5.6-sol` and configuration category `eligible`.

Case A completed before Case B was started. Each case consumed its independently fingerprinted
single-call authorization exactly once. The live gate completed with three passing tests in one
test file in 20.40 seconds; it was not rerun.

| Case                        | Provider attempts | Provider completions | Provider outcome | Lifecycle          | Terminal status |
| --------------------------- | ----------------: | -------------------: | ---------------- | ------------------ | --------------- |
| A — initial generation      |                 1 |                    1 | `completed`      | `preview-only`     | `succeeded`     |
| B — governed hero follow-up |                 1 |                    1 | `completed`      | `accept-undo-redo` | `succeeded`     |

Total real-provider calls were two. OpenAI client retries and per-request retries were both zero.
No save, publication, Vesko request, credential exposure, raw prompt retention, or raw response
retention occurred.

## Safe retained Case A evidence

- Case ID: `p10a-07c-03-case-a`
- Router decision: `strict-scope-routing-v1_1517_d35347a9d4631999bbfc6b12e8f8364e3a3835f36cf831e10c5d36adc773a22e`
- Authority: `controlled-acceptance-authority-v1_957_d4dc6144ac810bb5aeb5f082bdc4586fa10782191e72ff3d8caa156a02ab997d`
- Plan: `whole-storefront-plan-v1_33596_de2236a801829638654440687cc397703d4cbcefc01a3229a57867204904dc01`
- Proposal: `whole_storefront_proposal_4ad8ae03`
- Preview: `v1_12691_ecd6de178bac61b7d913aff962a89b5fcad691b9f766bd9e5560a2fe0fa6acfb`
- Protected state before and after: `controlled-protected-state-v1_674_cc36020ff96f91d081d5490ec2ce060d4fdaaffcb5c29b96b0193aa9d34c58c1`
- Result: one attempt, one completion, `completed`, `succeeded`, `not-published`

Case A used the current `applyRegisteredWholeStorefrontDirection` initial-generation package and
the exact registered `modernTechnical` direction. Current PageBlueprint materializations represented
shared frame, home, collection, and product-detail authority. The provider result matched the
canonical plan and produced a valid pending proposal at the expected preview lifecycle.

## Safe retained Case B evidence

- Case ID: `p10a-07c-03-case-b`
- Router decision: `strict-scope-routing-v1_1044_46a746718719e1fedb40265142bd5b893858c780ac6e8030d7973f140bd065f4`
- Authority: `controlled-acceptance-authority-v1_957_5acbbf1e803783d52ec32c80cf8f09f120165dc97721fa01eadd31fb39cf5b36`
- Plan: `whole-storefront-plan-v1_32788_93b1798f734285e4242f010b78162a4aba20dbb0853da956154b138d01c3ac66`
- Proposal: `whole_storefront_proposal_04f9c883`
- Preview and acceptance: `v1_7451_bd25e9c62d5aa8240e8ff6c6e2a307b8de61acc195181002cfa208df9f4e66bc`
- Undo: `v1_7450_52b79e882fa65bb7eaad570b8ca9c5f6ba77d36178d39bdd692dc2ae845b62b0`
- Redo: `v1_7451_bd25e9c62d5aa8240e8ff6c6e2a307b8de61acc195181002cfa208df9f4e66bc`
- Protected state before and after: `controlled-protected-state-v1_674_cc36020ff96f91d081d5490ec2ce060d4fdaaffcb5c29b96b0193aa9d34c58c1`
- Result: one attempt, one completion, `completed`, `succeeded`, `not-published`

Case B started only after Case A succeeded. It used the current `improveHero` follow-up package,
`selectedSection` scope, and the exact materialized homepage hero slot. The proposal changed only
authorized hero presentation; proposal review, acceptance, undo, and redo all succeeded without
scope widening.

The successful live gate retained these fields in memory. The safe canonical fingerprints above
were transcribed after the live run through one gate-disabled deterministic reproduction using the
same current cases and non-secret provider/model identities. That reproduction made no OpenAI call.

## Trusted authority and protection verdict

Before each call, the preflight independently refreshed the current planning input and ran
`routeGovernedDesignRequest` against current authority. It verified the execution kind, governed
package, canonical scope, declared pages, exact slots, PageBlueprint profiles, registry and
manifest references, commerce fingerprint, and approved-asset fingerprint.

The identical protected-state fingerprints before and after both cases prove that navigation,
canonical commerce, and approved-asset authority were unchanged. The provider boundary accepted
only the exact canonical plan. The runner retained `publishState: not-published` and did not expose
save or publication operations.

## Evidence boundary

The retained record contains only safe provider/model identities, case identities, authority and
router fingerprints, canonical plan/proposal/lifecycle fingerprints, bounded attempt/completion
counts, sanitized outcomes, and terminal status. Credentials, authorization headers, environment
values, raw prompts, and raw provider responses are excluded.

The earlier 5 August 2026 zero-attempt W2 block remains historical evidence of correct fail-closed
configuration handling; it is superseded as the current acceptance status by this authorized W1
completion.
