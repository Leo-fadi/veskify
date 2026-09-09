# AR-02F implementation report

The existing V2 definition/instance registry now adapts accepted shared metadata without importing
legacy rendering. Existing storefront rendering, component versions and validation behavior are
preserved. This is BATCH-03's final child, based on accepted AR-02E PR #243 merge
`d9647c84523c6b26d10cf025dcfccbed541c3c7d` on `codex/ar-02f-v2-metadata-adaptation`.

Only `src/components/registry/v2-registry.ts` changes in production: +14/-2 lines. Its local input
uses the original effective metadata order; native-homepage exclusions still query
`homepageCommerceDefinitions`. The unchanged adapter produces the same 18-definition prefix,
followed by the same native collection, PDP, homepage and content-support objects and validation
contracts. The existing public exports, legacy runtime registry and renderer bindings remain.

The complete V2 runtime closure contains 119 files, with Zod its sole external package; the
installed Zod ESM closure contains 79 files. The unchanged AR-02B resolver checks the entire graph.
The focused test rejects renderer registries, JSX/TSX, CSS, React/ReactDOM, Puck, application UI and
acceptance composition. Complete ordered adaptation, canonical fingerprints, native object
references and unique type membership match the old actual legacy-registry expression.

The complete pre-edit baseline and final observation are byte-identical: 3,064,032 bytes,
SHA-256 `1bd4a769de736691c1a8bd06e7d471926126f9cb9f3bba3db8b44434d66f4fe6`. They preserve
18 adapted definitions, all 29 V2 definitions, 29 manifest entries/53 profiles, 112 EN/FI
renders, 33 renderer registrations, 52 existing conformance findings, two valid instances and
nine meaningful rejection cases. Unknown types/versions/variants, malformed content/props,
copied protected values and missing/wrong-source bindings retain their failures. Three preliminary
scratch captures remain preserved; the complete fourth capture was taken before repository edits.

Implementer validation passed 921 tests across 21 files, plus one complete observation test.
The command includes accepted metadata boundaries, canonical registry/conformance/manifest,
native dynamic/homepage/content-support rendering, A09B historical render replay, A09C publication
render replay and the current status guard. Typecheck and focused lint passed on the final source.
The contract also requires complete whitespace/integrity, affected-file formatting, documentation
checks and deterministic exports. Actual commands, exits, logs and resolved graph are retained
with the external task evidence. Independent execution and native reconciliation precede exact
content submission; one automatic review and final-head/base CI remain separate merge gates.

Current projections and the existing status guard close F on its accepted merge and select no
successor child. The tracker cover and body carry the same state. AR-02/AR-03 remain Partial;
AR-23 remains independently eligible and unstarted. Utility-profile/template materializer and
remaining consumer isolation are deferred. The capability manifest still reaches rendering through
its template-profile path, and the live conformance wrapper intentionally composes renderers.
This change makes no measured bundle-size or new commercial-quality claim.

The owner's retained autonomous continuation supplies conditional merge authority. Each exact
verified head still requires an authority/gate record and expected-head-protected merge without an
override. After F's merge, preserve all originals, prior contracts/evidence and worktrees,
synchronize the original checkout and close this finite batch. No fourth task is selected.
