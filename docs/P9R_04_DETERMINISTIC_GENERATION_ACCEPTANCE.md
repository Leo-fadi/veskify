# P9R-04 deterministic multi-page generation acceptance

**Status:** Deterministic acceptance verified; Phase 9 remains open pending the controlled W1
live-provider run.

**Integrated main:** `afb22179bce18018d32f5a486d93307dff24d9c0`

**Merged dependency:** PR #127, P9R-02 shared-frame and homepage generation capabilities.

## Deterministic evidence

The gate uses the canonical Lumo fresh-project fixture and the deterministic whole-storefront
provider. It sends exactly this merchant request once at the browser local-demo boundary:

> Redesign the entire storefront in a modern technical direction. Create a substantially different
> coordinated composition across the homepage, collection page and product-detail page. Use compact
> spacing, crisp surfaces, commerce-focused collection cards, structured product discovery, a
> specification-led product-detail page, and a coordinated shared header and footer. Preserve all
> catalogue data, product identities, prices, stock, options, media bindings and approved assets.

The focused integration gate starts from the approved `brief_lumo_warm_approachable`, revision 1,
with its approved evidence fingerprint and the exact approved asset assignments. It rejects an
unapproved brief before planning. The deterministic request reaches the provider boundary once,
derives `modernTechnical` from that request, and compiles one coordinated proposal. No caller
supplies a direction ID as an output control.

| Surface       | Persisted baseline → generated result                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared frame  | Registered header and footer become `compact`; shared surface depth becomes flat.                                                                                                                                                           |
| Homepage      | Registered `homeModernCommerce` orders products before discovery and uses the asymmetric hero, compact product presentation, structured discovery, campaign/story, and trust treatments.                                                    |
| Collection    | Registered `collectionCommerce` stores `dynamicCollectionCommerce:compact` with sidebar filters, compact density and compact cards. Filters are derived from canonical collection-product attributes plus canonical price and availability. |
| PDP           | Registered `productVariantLed` stores `dynamicProductDetail:compact` with thumbnail gallery, contained media, compact options, specification table, sticky action, and canonical related-product bindings.                                  |
| Design system | Typography, tokens, compact spacing, square corners, flat surfaces, and image treatment differ in the accepted `StorefrontSnapshot`.                                                                                                        |

For every claimed selection, `tests/helpers/p9r-04-generation-acceptance.ts` checks the live path:

```text
ComponentDefinitionV2 registration
  → coordinated planner selection
  → compiled proposal component
  → accepted StorefrontSnapshot section
  → registered renderer output
```

The dynamic collection and PDP route adapter reconstructs its presentation only from the stored
registered bridge section plus the authoritative catalogue projection. It validates the canonical
collection membership/order and product identity before rendering; it does not recreate commerce
facts in a fixture or use legacy section configuration as dynamic filter evidence.

## Lifecycle, commerce, assets, and isolation

- Review leaves the active draft unchanged; one Accept creates one whole-storefront history change.
  Undo restores the exact baseline and Redo restores the exact accepted content.
- Save, reload, preview, explicit publish, and the published snapshot all use the same accepted
  `StorefrontSnapshot` content fingerprint. Published rendering has no editor proposal or provider
  dependency.
- The comparison covers product and variant IDs, SKUs, prices, compare-at prices, availability,
  stock, option groups/values, collection membership/order, canonical product media, and
  product/related-product bindings. The approved asset identities, roles, revisions, fingerprints,
  provenance, alt text, and decorative semantics remain authoritative.
- Fixture checks reject Aurum and Karvonen identity leakage. The Lumo fixture is reset before the
  browser run and remains isolated from other project aggregates.

## Responsive browser acceptance

`tests/e2e/p9r-04-generation-acceptance.spec.ts` performs one deterministic local-demo generation,
accepts it, verifies Undo/Redo, saves, publishes explicitly, then exercises the published homepage,
collection, and PDP at 375, 768, 1024, and 1440 px in both EN and FI: 24 surface/locale/viewport
checks. It uses the existing storefront geometry checker for document overflow and meaningful
clipping, and asserts reachable navigation, collection filters, and PDP primary action controls.

The test configuration is intentionally isolated in `playwright.p9r-04.config.ts`. It enables only
the protected P9-05B local-demo authority with `VESKIFY_AI_PROVIDER=deterministic`; it never invokes
OpenAI.

## Validation record

- Focused P9R-04 integration gate: 7 passed.
- Dependent generation, lifecycle, commerce-route, and fixture-isolation suites: 121 passed when
  the P9R-02 shared-frame/homepage suite is run in its normal isolated file context.
- Dedicated P9R-04 browser matrix: 1 passed, covering 24 published
  surface/locale/viewport checks.
- Documentation export and synchronization validation, TypeScript, ESLint, Prettier, production
  build, and `git diff --check`: passed.
- Complete Vitest gate: 132 files and 1,810 tests passed.
- `pnpm validate:full` reached the default four-worker Playwright suite with 149 of 151 tests
  passed. The two remaining onboarding hydration assertions passed individually and in the bounded
  complete serial Playwright gate (151 passed). They have no P9R-04 source overlap and are recorded
  as a resource cascade rather than masked with timeout changes or retries.

## W1 controlled live-provider handoff

W1 must start from merged main `afb22179bce18018d32f5a486d93307dff24d9c0` or a later main that
contains it, and must use a fresh reset of `project_lumo_fresh`. The required runtime sequence is:

1. Use the authoritative approved brief `brief_lumo_warm_approachable`, revision 1, with its
   approved evidence fingerprint and recorded merchant approval; reject any later unapproved
   mutation.
2. Use integrated runtime with the controlled real provider, not the deterministic provider used by
   this gate. Keep credentials server-only; do not print, inspect, place in browser state, or commit
   credential values.
3. Establish the protected P9-05B local-demo session through its same-origin reset mechanism. The
   reset and generation endpoints require the configured server-only demo token and the session is
   validated by the authority before planning or synchronization.
4. Send the exact request recorded above once. Record the provider request/proposal correlation,
   approved brief ID/revision/fingerprint, provider outcome, and safe redacted session identifier.
   Do not retry the provider call to improve the result.
5. Verify the expected modernTechnical structural result: compact shared frame; asymmetric ordered
   homepage; dynamic compact collection with canonical filters; compact dynamic PDP with canonical
   product/related bindings; and materially changed design system.
6. Review and accept atomically; record Undo/Redo; Save draft; reload Preview; explicitly Publish;
   retain the resulting snapshot, browser/screenshot evidence, and EN/FI 375/768/1024/1440 checks.
7. On any validation, provider, protected-commerce, or responsive failure, stop the live run,
   preserve redacted diagnostics and the failing artifact, and return to deterministic reproduction.
   Do not mutate protected commerce, broaden scope, silently substitute fixtures, or make an
   additional live-provider call.

This handoff is intentionally not live evidence. It defines the one controlled W1 execution needed
to close the remaining Phase 9 live-provider evidence gap.
