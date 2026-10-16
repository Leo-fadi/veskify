# AR-10A — feedback-led visual realization

AR-10A is In progress under BATCH-19 launch on the accepted AR-06D merge.
Base: `970b6cd00a7df90cd7b2ff1008916e8c602127d0` (PR #263).
AR-06 remains Partial. This task has its own owner visual checkpoint before merge;
technical verification does not confer commercial-quality or production acceptance.

## Original result and comparison

Leo's original English-desktop observation was: “Much better structurally but still the same or close to i”.
He subsequently accepted D as an honest technical baseline with visual quality below target.
The more detailed diagnoses below are implementation observations, not additional owner feedback.

The exact serialized Aurum Nordic aggregate is preserved as the fictional test input in
`tests/fixtures/ar-10a/original-aggregate.json`. Its SHA-256 is
`355a1ab4188ea6e30e711ab84d3ba8ecbd853cab26fe6e8dbda4d6cf27b6bc5d`;
the generated candidate fingerprint is
`v1_50184_0784a748aa03ccbb5e081601548c20c63070658d24a5e3fa5344ef6093da9061`.
Independent preservation verified the complete aggregate, catalogue, nine assets,
locale/routes and original review-set lineage before D's server was stopped.
No data was reconstructed from screenshots. Original intent bodies were unavailable;
their retained fingerprints and actual selections are reported without invented attribution.

- **A0:** D's real generation and original renderer/captures.
- **A1:** the identical canonical input rendered with these reusable corrections.
- **A2:** not used; no canonical presentation successor or content change is needed.

The local review is a **re-render of BATCH-18's generated candidate**, not a new generation
or continuation of the old server. A fixed-input server-only branch in the existing P04
authority checks production mode, explicit local/mock/replay flags, loopback host,
project, authorization, exact raw bytes and canonical fingerprints before cloning it.
Missing or changed input fails closed. It does not populate the generation map, save,
publish or accept arbitrary paths. Normal P04 behavior remains available with replay off.

## Three decisions

| Decision           | Measured cause on A0                                                                                                                                                                                                                                                  | Reusable correction                                                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening and header | At 1440 px, the hero was 900.94 px tall; its wide portrait-media column and section padding put the headline at 624.70 px and the primary action bottom at 852.45 px. Review chrome was measured separately at 103.95 px. No duplicate-padding cause was established. | Bound the selected editorial-split hero's media stage and intentional padding through existing density/media roles. Preserve other profiles and review chrome. Restore the brand display role over a more-specific generic header-link rule. |
| Typography         | Canonical roles were projected correctly. CDP confirmed Georgia and Arial fallback, not a loaded Inter face. Generic link/title/body sizing overrode or obscured selected roles.                                                                                      | Preserve existing fonts/weights; restore the brand role, bound body copy by its role and use card-container sizing with the existing heading scale.                                                                                          |
| Shopping cards     | At 375 px a horizontal home card's image was 208 px high inside a 388.75 px picture, leaving 180.75 px of unintended space. Search had the same nested-media conflict.                                                                                                | Preserve the responsive image's canonical aspect/fitting/crop authority; restrict legacy image bounds to legacy markup and bound the media column by container/density. No product information or controls removed.                          |

Concrete criteria were recorded before the correction: desktop headline/action visibility,
bounded hero height, no mobile opening regression, complete horizontal media bounds,
bounded mobile/home and desktop/search cards, readable text and unchanged touch targets.
The canonical source, product facts, copy, imagery, locale and selected profiles/anatomies
remain fixed. Existing frame/card semantic versions and historical pins remain unchanged;
rendered pixels and build identities intentionally change.

## Verification and delivery

Focused implementation checks include exact-input/invalid replay guards, shared registered
rendering and a non-Aurum existing fixture with contrasting supported density. The initial
focused consumer selection passed 170 tests across nine files; the existing card family
passed twelve tests and replay guards passed twenty. A new transfer test's initial invalid
assumption about fixture density was corrected without changing fixture or product data.

The coordinator's complete campaign passed all 56 surface/locale/width cases, retained
36 originals and completed navigation, media, accessibility and final input-integrity
checks. Its production build, all six unchanged raw/gzip budgets and flag-enabled
production-404 check passed. Focused static and documentation checks passed; the strict
policy tests' two remaining current-heading failures were corrected and their 82-case
focused selection passed. The first independent attempt subsequently completed the
full 637-case policy selection under its original source identity, as recorded below.

Next retained the exact non-sensitive comparison fixture in seven server packaging
traces. Each retained entry was resolved and hashed against the reviewed input. Client
registration checks passed. Production 404 does not establish that the fixture is absent
from server output or incapable of execution.

Independent execution, per-original image inspection, applicable final-source build and
native reconciliation are separate mandatory gates. Their historical and current outcomes
are distinguished below and retained with exact identities in persistent task evidence.
The single automatic review, final-head CI and actual owner visual disposition remain
separate from precommit technical verification.

The first independent attempt passed 854 tests, static/documentation checks and its
production build, budgets and production-404 check. Its browser run stopped after
15 cases and 10 originals when EN/1024 collection remained in its loading panel after
HTTP 200. A diagnostic then timed out earlier during collection navigation while Next
was compiling. A second, instrumented 16-case prefix passed without changing production
code, deadlines, fixtures or assertions. The original stall was not reproduced and its
root cause remains unproven. These partial and diagnostic results do not replace the
required complete independent 56-case/36-original campaign or owner visual disposition.

The second independent campaign then stopped after five cases at EN/375 About: its
document request received no response within the existing 60-second navigation limit
while Next reported catch-all route compilation. A separately authorized, diagnostic-only
180-second observation completed its first About navigation in 8.63 seconds and its one
explicit subsequent navigation in 1.65 seconds, verifying the exact serialized aggregate
both times. The first server request included 3.7 seconds of Next work and 3.6 seconds of
application rendering. This does not establish that compilation alone caused the previous
failure. No route warming, production change or visual deadline increase was adopted.
The prior failures remain failures; the full independent campaign and every original-image
inspection remain mandatory. Browser allowance is now twelve, with nine invocations used
after that diagnostic; production builds remain two of four and paid calls remain zero.

Before consuming the final browser slot, independent source inspection found that the
retained Chromium context needed its own request authorization after the test worker exits.
The task runner now owns the origin-scoped, read-only route and validates an actual owner
navigation after worker exit. External requests remain blocked; no global token header,
application authority or production behavior changes. This separate support correction
does not explain the earlier development-route stalls.

## Limits

There are zero new paid generation, token-counting, image or critic calls. D used
`gpt-5.6-sol` with default processing, one generation and one official input-count request.
Its 2,265 input and 356 output tokens remain the original attribution; counting charges
and final invoice reconciliation remain unresolved. No all-inclusive cost claim is made.

The approved illustrations, sparse catalogue and mixed-language/brief-like copy remain
visible limitations. This does not establish broader model diversity, a new family,
normal Studio rollout, executable composed commerce, publication, commercial quality or
production readiness. AR-02/03/04/05 and accepted AR-06A/B/C/D stay closed; AR-06 stays Partial.
No automatic successor is authorized.

## PR correction and current evidence

Submitted head `59bb44c08b18a4cc51ceaa137372f04e38584651` received independent/native
technical PASS with 56 cases and 36 directly inspected originals. That evidence retains
its original attribution. It does not establish expanded AI design capability or owner
visual acceptance.

CI run `38896495215` subsequently found a genuine compatibility defect in the existing
P10B-17 normal-P04 collection: at 1440px, a horizontal card was 247px wide, but its
fixed 128px image track crowded the facts. “Limited availability” extended 2.75px
beyond the card. This was a different deterministic candidate from the pinned A0,
whose collection uses image-first cards. The existing narrow-card and tablet reflows
now allocate two parts to media and three to facts within the available width.
Content, typography, controls, anatomy, protected media and clipping assertions remain
unchanged. The original CI failure is retained; corrected browser/build proof and
final-head CI remain required. The review's stale AR-06D delivery sentence is also
corrected without changing D's accepted status.

The comparison remains A0 versus the same input under A1's reusable rendering changes.
There is no A2 presentation successor, new generation or visual acceptance. Previous
captures remain earlier-candidate evidence where the CSS correction affects pixels.

## Current API-readiness continuation

Independent invocation 11 stopped on the unchanged P10B17 inspection request's
120-second deadline before card geometry. Its FAIL and unproven server cause remain
retained. The bounded card correction is unchanged. A separately counted API-only
phase now records request return, status, body/schema completion and sanitized errors
in a finally path. It requires the existing protected endpoint and zero-call mock
state before Chromium. The same identified server then supplies the final 56-case,
36-image campaign; this is prepared-development-server proof, not cold-start or
production-latency acceptance. Candidate, protected-state and geometry checks remain
separate and unchanged. At most two API-only attempts are allowed; no automatic retry.
The CSS correction still requires a fresh independent production build and all six
budgets. Browser/build counters remain 11/12 and 2/4 before this continuation.
Pre-execution independent review also found that the existing serialized-aggregate
identity check ran only in the About diagnostic. The full campaign now applies
that same check to each visible surface and retains its actual result before capture;
earlier captures are not relabelled as having performed that check.

## Proposed successor brief — unstarted

**Question:** can the AI express independent design choices, and can the compiler
preserve them into a visibly different, coherent storefront? This is a proposed bounded
AR-09 design-control experiment, not another AR-10A polishing campaign. It requires a
separate launch after accepted AR-10A delivery. AR-10 and AR-12 are consumers; the
[current roadmap](VESKIFY_DEVELOPMENT_ROADMAP.md) retains their parent acceptance and
AR-18 integration obligations. AR-00B permits a separately approved early visual slice
without declaring those parents complete. No historical sequence is reinstated.

### Source-backed boundary

| Boundary                               | Actual source and finding                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merchant request → provider fields     | `semanticProviderDriverPaths` and `semanticStorefrontDesignIntentV1MaterialSchema` in `src/application/prompted-storefront-design-intent/semantic-contract.ts` expose global density and navigation posture, but no independent navigation density. The strict wire schema is built in `src/integrations/ai/openai/prompted-storefront-design-intent-v2-provider.server.ts`. |
| Semantic decision → compiler selection | `semantic-capability-features.ts` maps global density to `spacing-density`; `semantic-influence-authority.ts` declares its compound influence. `compiler.ts` forwards spacing density and surface depth to `registeredBrandSystemForDirection`; the bounded synthesizer has the same narrowing.                                                                              |
| Selection → canonical value            | `applyRegisteredDensityDomain` in `src/application/storefront-design-system/registered-brand-system.ts` derives navigation and content density from the same spacing choice. Commerce is also derived, with spacious commerce capped at balanced. This is the current registered coupling, not evidence that an independent provider instruction was discarded.              |
| Canonical value → rendering            | `DesignDna.density.navigation/content/commerce` already exist. `projectDesignDna` emits separate variables; the shared frame, homepage and card CSS consume the corresponding variables. `premiumEditorialDesignDna` already demonstrates nonuniform regional density. No second design system is needed.                                                                    |

The demonstrated gap is **unexpressible independent navigation density in the registered
provider/compiler path**, despite existing canonical and renderer support. Whether the
coupling is unnecessary is what the experiment tests. There is no recovered historical
provider response proving substitution/discard; D's missing intent bodies stay unavailable.
AR-10A's header/hero and card findings concern realization of valid values, a different
category. No missing component/layout capability is established for this experiment.

### One small end-to-end experiment

Propose one bounded optional navigation-density intent, admitted only by a registered
direction capability, and carry its resolved decision through the existing compiler and
synthesis selection to `designDna.density.navigation`. Reuse the current strict semantic
schema, decision fingerprints, registered BrandSystem materializer, CSS projection and
shared frame. Preserve old payload/default/version behavior and historical identities;
choose explicit compatible version dispatch where the existing authority requires it.
Do not add arbitrary styles, a new preset engine or an unconsumed schema.

Compile a deterministic matched pair with the same registered direction, generous
content spacing, catalogue, images, copy, locales, routes and card anatomy. Change only
the supported navigation-density decision. Expected evidence is visibly tighter header
spacing at 375/768/1024/1440 in EN/FI, while hero/content rhythm, commerce/card spacing,
surface elevation, media, controls, prices and protected facts remain unchanged. “Quiet
cards” is a separate surface/anatomy question; balanced commerce density does not prove it.
Use the actual registered renderer and provide a usable storefront and matched boards.

Negative/compatibility checks must reject unknown/unavailable values and stale authority,
preserve exact legacy behavior when the new decision is absent, bind the resolved choice
to its selection identity, and prove no collateral content/commerce or persistence change.
Existing anchors include `p10b-16p-04f-semantic-scale-and-influence.test.ts`,
`p10b-18b-01-design-dna-shared-frames.test.tsx` and AR-10A's shared-renderer checks.

This deterministic experiment proves capability and compiler preservation. A later live
prompt comparison would test whether the model chooses the requested combination; it
needs its own exact model, call count and spending approval. None is authorized here.

### Puck comparison, not adoption

Official [Puck AI overview](https://puckeditor.com/docs/ai/overview) distinguishes Assembly,
which uses configured components, from Design mode, which generates new component types.
[Assembly configuration](https://puckeditor.com/docs/ai/ai-configuration) documents
component/field instructions, exclusions and schemas for custom fields. Those are useful
comparisons for exposing bounded choices, not evidence of measured design quality.
[Design mode](https://puckeditor.com/docs/ai/design-mode) instead produces dynamic
HTML/CSS and optionally JavaScript, stored through its dynamic configuration. It is not
the proposed Veskify boundary. No Puck AI/Cloud installation, persisted Puck tree,
arbitrary generated code or canonical-ownership change is proposed.
