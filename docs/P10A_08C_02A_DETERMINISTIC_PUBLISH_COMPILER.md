# P10A-08C-02A — Deterministic Publish Compiler Authority

- **Status:** Implemented compiler and enforcement contract
- **Canonical source:** `StorefrontSnapshot`
- **Write boundary:** existing authoritative publication command
- **Deferred persistence owner:** P10A-08C-02B

## 1. Outcome

P10A-08C-02A adds one deterministic, write-free publish compiler at
`src/application/publishing/publish-compiler.ts`. It transforms the exact authorized canonical
draft snapshot into one immutable renderer-ready result and one deterministic compile receipt.
It does not create another editable page graph, component registry, recipe engine, commerce model
or publisher.

The enforced path is:

```text
trusted manual or accepted-AI authority
  -> current canonical project aggregate and draft StorefrontSnapshot
  -> live publish authority resolution
  -> deterministic validation and compilation
  -> immutable compiled result plus compile receipt
  -> trusted preparation retains receipt and result identity
  -> fresh authority resolution and recompilation at confirmation
  -> exact identity/receipt comparison
  -> existing authoritative publication command
```

## 2. Compiler boundary

`compileStorefrontPublication(input: unknown)` clones and parses its input inside a typed boundary.
It has no provider, Puck, React renderer execution, browser, credential, persistence or publication
dependency. Known failures are `PublishCompilerError` values with deterministic category codes;
the compiler never writes project, preparation, receipt, operation or browser state.

The configured application boundary creates compiler input from current trusted sources. Browser
requests cannot submit a snapshot, compiled result, compile receipt, manifest authority or
component/profile authority.

## 3. Canonical input and authority

The compiler input binds:

- compiler and canonical snapshot contract versions;
- project, draft and source snapshot IDs and revisions;
- canonical source snapshot content fingerprint;
- explicit `manual` or `accepted-ai` authority;
- accepted receipt identity and fingerprint for accepted-AI publication;
- the generated live component capability manifest version and fingerprint;
- per-component version, capability and renderer identities derived from that manifest;
- registered published-renderer authority derived from the generated capability manifest;
- exact accepted PageBlueprint/profile authorities where the accepted receipt represents them;
- shared storefront-frame profile fingerprint;
- canonical catalogue, navigation/routes and product-media fingerprints;
- canonical validated approved assignment/presentation fingerprint;
- project-derived locale authority and component-migration authority.

The current input resolver derives these values from the validated project aggregate, canonical
draft, accepted receipt lineage and the existing generated registry/profile/renderer authorities.
The compiler regenerates the live facts and rejects supplied authority drift; input fields do not
become an alternate inventory.

Locale authority comes from `Project.primaryLocale` and `Project.enabledLocales`. Complete-storefront
publication uses the project primary locale as its active compile locale, validates that it is enabled,
and applies the shared canonical locale ordering before fingerprinting. Empty, duplicate, unsupported
or internally inconsistent locale authority fails closed; disabled locales are never advertised.

## 4. Compiled publication result

The immutable derived result contains only renderer-required publication information:

- compiler/result contract versions;
- project and exact source snapshot identity/fingerprint;
- normalized `BrandSystem`;
- normalized shared navigation frame;
- normalized canonical pages;
- per-section current component version, variant, capability and published-renderer identity;
- published renderer target;
- locale authority;
- deterministic validation-report and runtime fingerprints.

It carries no catalogue copy, provider payload, proposal DTO, Puck data, editor state, arbitrary
React/CSS/code or credentials. Canonical product, price, stock, option, availability and media truth
remain in the read-only catalogue projection and are referenced only through registered bindings.
`StorefrontSnapshot` remains the sole editable storefront aggregate.

P10A-08C-02A does not persist this result as an active compiled artifact. The trusted preparation
retains only its exact runtime/validation/source identity and the compile receipt.

## 5. Compile receipt

The deterministic receipt binds compiler/version authority; source authority kind; project, draft
and source snapshot identities; accepted receipt lineage where applicable; source and compiled
fingerprints; manifest, registry and profile authority; commerce, routes, product media and approved
assets; migration status; and validation-report fingerprint.

The receipt also carries the exact normalized locale authority. Navigation authority fingerprints the
canonical public path for each page, and approved-asset authority fingerprints assignments only after
registered V2 slot validation. Changing locale, route or validated asset assignment authority changes
the validation/result and receipt fingerprints.

Receipt ID and fingerprint are derived from canonical content. Identical canonical input and current
authority produce byte-stable result and receipt fingerprints. The receipt contains no mutable
snapshot or browser credential.

## 6. Publish-time validation

The compiler fails closed for the current represented authority categories:

- malformed/unsupported input, snapshot structure and stale source identity;
- unknown component, version or variant and incompatible page ownership;
- stale manifest/registry authority and missing published renderer reachability;
- unknown/stale PageBlueprint profile, incompatible selection and invalid order/omission;
- invalid registered content/commerce binding and protected-commerce-shaped mutation;
- navigation/route, catalogue and product-media divergence, including duplicate canonical public
  paths and duplicate homepage/root authority;
- unknown, stale, role-incompatible, missing or product-media-masquerading approved assets, including
  registered V2 `minItems`/`maxItems`, duplicate-assignment and presentation-correspondence failures;
- current registered accessibility/locale blockers;
- unresolved or stale migration authority;
- nondeterministic result or prepare/confirmation mismatch.

Validation reuses `storefrontSnapshotSchema`, catalogue schemas, registered component validation,
the generated component capability manifest, executable PageBlueprint profiles, the manifest's
registered renderer identities/targets, canonical fingerprinting and registered
asset/accessibility/migration contracts. Existing renderer-conformance tests continue to prove that
those generated identities reach the actual editor/preview/published runtime maps. The compiler does
not import client renderer modules or introduce a second accessibility or migration rules engine.

Published route keys use the same canonical `pagePaths` projection as registry render/navigation
contexts. Because the key is the normalized complete page path, product and collection routes may
share a terminal slug under their distinct `/products/` and `/collections/` namespaces, while any
duplicate actual public path or second homepage authority is rejected before compilation.

Approved placements are projected into the registered Component Platform V2 asset assignments and
passed through its canonical slot validator. The compiler then checks one-to-one presentation,
revision and material-fingerprint correspondence. It does not copy asset-slot cardinality policy or
silently select one asset from an overfull slot.

## 7. Preparation and confirmation

Both manual and accepted-AI preparation compile the exact current draft after repository validation.
Accepted-AI preparation first validates the exact trusted accepted-snapshot receipt and preserves its
identity in the compile receipt. Manual publication remains explicitly distinct and never claims AI
lineage. A successful trusted preparation stores only the compile receipt and compiled result identity;
the client receives the existing bounded merchant-safe preparation without compiler internals.

Confirmation reloads and validates the current aggregate, re-resolves accepted receipt authority
where applicable, recreates live compiler input and recompiles. It compares the fresh compiled result
identity and receipt with the trusted preparation before invoking the existing publication command.
Any source or authority race therefore fails before publication. A browser-supplied compile receipt or
compiled body is rejected by strict request schemas and is never used.

## 8. Failure and atomicity behavior

A compiler failure during preparation creates no completed preparation. A compiler or comparison
failure during confirmation occurs before the existing atomic repository publish call. Therefore the
saved draft, published pointer/history, publication operation/idempotency records, accepted receipt
storage and browser publication state remain unchanged. The existing repository transaction continues
to own snapshot and publication-operation atomicity; this task adds no second write path.

## 9. Deferred work

P10A-08C-02B owns atomic persistence of the immutable compiled artifact with published/synchronized
snapshots, publication operations, active artifact/version pointers, history and rollback/republish
authority. P10A-08D-02 owns final published homepage/collection/PDP render-target propagation and
browser/manual evidence. This task does not implement artifact persistence, pointer switching,
rollback, republish, final browser evidence, P10B vocabulary or provider changes.
