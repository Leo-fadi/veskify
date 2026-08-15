# P10B-16P-04 — Real Storefront Studio Design Intent Acceptance

**Status:** Baseline

**Date:** 15 August 2026

**Phase:** P10B — Commercial Storefront Generation System v1 (**Partial**)

**Depends on:** P10B-16P-01, P10B-16P-02A, P10B-16P-02B, and P10B-16P-03

## 1. Accepted outcome

P10B-16P-04 proves the real OpenAI Design Intent path through the normal, production-disabled
Storefront Studio acceptance composition. A merchant prompt entered in Studio reaches server-owned
current authority, one strict non-executable semantic intent, deterministic exact compatibility
resolution, exactly one canonical storefront materialization, isolated proposal review, and the
existing proposal/history/save/preview lifecycle.

The accepted evidence used the repository-owned fictional Aurum Nordic acceptance merchant. Aurum
is test-only evidence, not a real merchant, Vesko staging, production, or a reusable designed
snapshot. Its approved fixture facts, assets, catalogue, and canonical product media are loaded
server-side. The browser sends compact merchant intent and current project/draft identity only; it
does not send provider output, compiler decisions, candidate snapshots, or executable authority.

The accepted flow is:

```text
normal Storefront Studio prompt
  → server-owned current authority
  → one real OpenAI semantic Design Intent
  → refreshed authority validation
  → deterministic semantic-to-exact compilation
  → exactly one StorefrontSnapshot materialization
  → isolated proposal review
  → Reject or atomic Accept
  → Undo / Redo
  → explicit Save
  → reload
  → normal Preview
```

`StorefrontSnapshot` remains the sole editable aggregate. The task adds no second design model,
page graph, registry, renderer, persistence model, or publication path.

## 2. Provider and call authority

The accepted provider was `openai-prompted-storefront-design-intent-v2` using the safe model
identity `gpt-5.6-sol` through the official Responses API. Each authorized attempt used a bounded
120-second timeout, `store: false`, zero SDK retries, zero application retries, no repair call, and
no fallback.

The complete P10B-16P-04 investigation and acceptance ledger contains **16 real OpenAI calls**.
Calls 1 through 13 exposed independent transport, strict-schema, semantic-contract, compatibility,
and rendered-fidelity defects. They produced no accepted proposal and were never automatically
retried. The local corrections retained strict fail-closed validation and reduced the provider
surface to bounded merchant/design semantics; exact registered authority remains server-owned.

Calls 14, 15, and 16 were the accepted ordered cases:

| Case | Commercial intent | Call | Provider attempts | Result                                                                                                                                       |
| ---- | ----------------- | ---: | ----------------: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | Premium Editorial |   14 |                 1 | Valid semantic intent, exact compilation, one proposal, product-owner-approved commercial evidence, then Reject with the raw draft restored. |
| B    | Modern Technical  |   15 |                 1 | Valid semantic intent, exact compilation, one structurally different proposal, then Reject with the raw draft restored.                      |
| C    | Minimal Commerce  |   16 |                 1 | Valid semantic intent, exact compilation, one structurally different proposal, atomic Accept, Undo/Redo, Save, reload, and normal Preview.   |

The three separately authorized cases used the same current merchant/catalogue/evidence authority
and cross-bound the retained prior structural fingerprints. They were controlled sessions rather
than one uninterrupted browser process. Page load, proposal review, Reject, Accept, Undo, Redo,
Save, reload, Preview, and Publish made no provider call. Cumulative retries and fallbacks were
zero. No Vesko call or publication occurred.

## 3. Safe accepted evidence

Only allowlisted fingerprints, bounded usage, exact registered selections, lifecycle outcomes, and
protected-state verdicts are retained. Raw prompts, raw provider requests or responses, credentials,
headers, and private model reasoning are not retained.

| Evidence                        | Prompt A                                                                                                           | Prompt B                                                                                                           | Prompt C                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Request fingerprint             | `semantic-storefront-request-v1_6858_8fa633dbe83e2177233271bb36ed41cbe3e630fea86a617881b0b1124ea3ff25`             | `semantic-storefront-request-v1_6868_69797907d19e88ed1faa4dfadfd90031984d3cba7bee75b52238060544e06303`             | `semantic-storefront-request-v1_6840_5ab5816ab783efbf8f0b4edb35810f73b474d6d9f2cbe7afdcf282fc4cbc2e44`             |
| Prompt fingerprint              | `prompted-storefront-prompt-v1_216_a3c703583284bdc3a15493c2ab4512829b7ac9f440bb89803561a9a491800966`               | `prompted-storefront-prompt-v1_226_a4b457ee236e380922338b2ea70f5ebb182c49ff56588b95a7b4a3e33fc6d37c`               | `prompted-storefront-prompt-v1_198_c9ba8d766c7cb17a1479c33795cb214494b3dd61fffa55dcfc13fbaa20dae9f4`               |
| Semantic-intent fingerprint     | `semantic-storefront-intent-v1_1132_f95c98f3824d6eaff8fcda6a6b56ab335afebf2326a79787c779653d882e1bcc`              | `semantic-storefront-intent-v1_1211_cb295e429b7b8b9e4bbb11bac88fd2545d7bec4614999a43be88a591d3f36729`              | `semantic-storefront-intent-v1_1142_9a7891272e8d002637dee60d3bbb125e1b71f1019f524df6b8747fb5b3c31fe1`              |
| Compiled-decision fingerprint   | `compiled-prompted-storefront-design-v2-v1_50749_5497fe97b6207ec8edf8eb76433ea98ac55504774074cf952c87825c25b7d65b` | `compiled-prompted-storefront-design-v2-v1_42474_da42499f37c12fe80680778e76897ebebf2a91ee401fe4d55ac34ea22ae10475` | `compiled-prompted-storefront-design-v2-v1_44645_5adc14e8443e2c548a055c25825d254c6a1b5d5c062fa436a912fc905ffd6f0d` |
| Structural fingerprint          | `semantic-structure-v1_501_57087ca71a72bf77f44fb2e4cd6375e08ab328ba08059bac4e3ae48974485050`                       | `semantic-structure-v1_513_1448f2125e97be6cfa7f5d5d0a4d9fdc7511751f77932458491900f0ca7e3246`                       | `semantic-structure-v1_517_76b430532a51a2aa91ce05ee24fb296a1310f3f568ccd202485c76af4930608f`                       |
| Candidate snapshot fingerprint  | `v1_41196_2070c4bb4439a9116b34855f336d8b379aa861b11bb4fc8e4ffaf33d9f1893f5`                                        | `v1_39446_2dfaa31ba80f84636550357c7fe6755805198ea6c5fe775cec1d78aa71ccb5ea`                                        | `v1_39284_fa68042fbee2ce61434c732c3bb8a9d2a1b1c8759b8dc3eaabe7f3ad93a8b247`                                        |
| Duration                        | 5,255 ms                                                                                                           | 6,645 ms                                                                                                           | 6,756 ms                                                                                                           |
| Tokens (input / output / total) | 2,001 / 342 / 2,343                                                                                                | 2,007 / 357 / 2,364                                                                                                | 2,012 / 354 / 2,366                                                                                                |

Each case resolved 114 metadata candidates to one exact compatible decision and materialized once.
A and C accepted eight semantic paths without substitution. B accepted seven paths and recorded one
bounded substitution for configurable-product posture; it did not silently claim that preference
as exact causal influence.

## 4. Material prompt influence

The real provider authored bounded semantic intent. Veskify, not the provider, selected exact
registered Design DNA, frame, PageBlueprint profiles, components, variants, archetypes, product-card
anatomies, responsive posture, art direction, and parameters.

| Case | Direction/coherence                                 | Shared frame         | Homepage                      | Collection                          | PDP                      |
| ---- | --------------------------------------------------- | -------------------- | ----------------------------- | ----------------------------------- | ------------------------ |
| A    | Premium Editorial                                   | `editorial-masthead` | `homepage-campaign-led`       | `collection-campaign-led-discovery` | `pdp-high-consideration` |
| B    | Modern Technical                                    | `commerce-utility`   | `homepage-collection-gateway` | `collection-dense-search`           | `pdp-standard-commerce`  |
| C    | Minimal Commerce request, bounded compatible result | `centered-minimal`   | `homepage-high-consideration` | `collection-dense-search`           | `pdp-standard-commerce`  |

Prompt C differed from A across frame, homepage, collection archetype, configurable-PDP archetype,
product-card, and art-direction authority. It differed from B across typography, frame, homepage,
product-card, information-density, and responsive authority. These are six independent material
dimensions in each comparison; colour, labels, route counts, and catalogue identity were not
counted.

The compiler truthfully recorded C's exact compatible coherence selection rather than forcing a
named direction label from the merchant phrase. No coarse preset, executable intent, complete
candidate storefront, or provider-authored registry ID crossed the provider boundary.

## 5. Proposal and lifecycle evidence

Prompts A and B each produced one isolated proposal and were rejected without draft or history
mutation. Prompt C then proved:

1. one isolated complete proposal was inspected;
2. Accept created one atomic unsaved whole-storefront change;
3. Undo restored the exact raw draft fingerprint;
4. Redo restored the exact accepted Prompt C snapshot fingerprint;
5. Save was explicit and made no provider or publication call;
6. reload restored the exact saved storefront;
7. normal Preview rendered the homepage, two concrete collection URLs, one simple-product URL, one
   configurable-product URL, the approved About page, and cart presentation; and
8. Publish remained separate and was not invoked.

The raw draft fingerprint was
`v1_18773_2f22fa20173f51ba136f21cdd5b65236c8a2b1b2de66e0bd4bd14a77ee3a36d8`.
The saved Prompt C fingerprint was
`v1_39284_fa68042fbee2ce61434c732c3bb8a9d2a1b1c8759b8dc3eaabe7f3ad93a8b247`.
The canonical catalogue fingerprint remained
`v1_8176_3fed8c5f58e1fda958bd46886e603c82ed9cbc9dfc177305018cb412f58c0916`
before and after Save/reload.

The accepted browser evidence covers complete Studio, isolated-proposal, and saved-preview surfaces
at 375, 768, 1024, and 1440 px. It also records direct-frame and fail-closed search evidence.
Product-owner checkpoints accepted the refined mocked Premium Editorial fixture, the final real
Prompt A result, and the full Prompt C lifecycle.

## 6. Protected authority

Across every successful proposal, Reject, Accept, Undo, Redo, Save, reload, and Preview:

- product, product-type, SKU, option, variant, price, availability, stock, collection-membership,
  and collection-order authority remained unchanged;
- canonical product and variant media remained unchanged;
- presentation used only approved fictional acceptance assets and evidence;
- no commerce write, cart mutation, Vesko call, publication, or provider retry occurred; and
- search presentation remained registered while runtime execution stayed explicitly fail closed.

## 7. Legacy bridge disposition

P10B-16L is **Deprecated — compatibility-only acceptance infrastructure**. It remains temporarily
for historical evidence, migration regressions, safety comparison, and consumer analysis. It is not
the normal prompted Studio path and must not guide new provider work.

The older whole-storefront `selectionId` initial-generation path is likewise compatibility-only for
prompted complete-store generation. Valid page, section, and follow-up editing consumers are not
deprecated by this decision.

Removal requires all of the following:

1. this P10B-16P-04 acceptance remains merged and green;
2. V2 regressions preserve the bridge's valid safety controls;
3. a consumer search proves no active production-path dependency; and
4. a dedicated cleanup task is authorized.

No legacy bridge is removed in P10B-16P-04.

## 8. Evidence level and non-claims

P10B-16P-04 has contract/schema, deterministic unit, integration, browser/E2E, real-provider, and
retained human visual-review evidence for its stated local normal-Studio acceptance outcome.
P10B-16P-04 is therefore **Baseline**.

This evidence does not claim:

- executable search;
- automatic or successful publication;
- broad P10C editing controls;
- P10B-17 phase-wide responsive, accessibility, or performance closure;
- P10B-18 repeated 100+ storefront commercial quality/scale closure;
- Vesko staging or production integration; or
- production readiness.

P10B remains **Partial**. P10B-17 and P10B-18 remain **Planned**.
