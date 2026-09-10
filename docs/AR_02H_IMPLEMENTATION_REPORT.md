# AR-02H implementation report

Semantic request preparation now reads the original direction/profile schema owners without
loading whole-store synthesis or template rendering through broad barrels. Merchant requests,
validation and storefront output remain the same. This final BATCH-04 child starts from G's
accepted PR #245 merge `49d7f666d825b236eb042d21c1f7b5146979eebb` on
`codex/ar-02h-semantic-request-boundary`.

Production changes are imports only in `direction-contract.ts` and `semantic-request.ts`. The
existing schema objects, three directions, authority version 1.1.0, hint validation and fingerprints
remain canonical. No compiler selection, provider flow, policy, persisted data or materializer
algorithm changes. Complete dependency tests cover direction-contract, semantic-request and the
unchanged capability-projection/request leaves: 123, 127, 162 and 165 runtime files respectively,
with Zod the only external package. Separate existing ordering evidence checks
provider completion before compile, execute and final materialization.

The exact pre-edit request baseline contains 1,605,229 bytes, SHA-256
`37c020ef2bed07f27b74108e13a4326f469645618b207369220a679824b539b4`: complete capability
authority including reference-map entries, typed request, five semantic request variants with
canonical serialization, fingerprints, freezing and nine rejection outcomes. Default/null hints
and each allowed direction/frame pair are included. Typed and semantic requests remain deeply
frozen; capability authority retains its existing shallow freezing. The existing deterministic
fixture and authority builder require no provider call.

The non-executable original direction archive retains raw SHA-256
`f62ab54f221d084a0f593d2a090feca7ba9ddce4f9d23dcf8688960f4d8d1b28`; current raw successor is
`f38de9d89c4b5793ba8ad77e4c9e490bb4dc309699da559f23c02a926ece0509`.
The strict transition reader verifies both before supplying historical bytes. A-09A's source reader and assertion label change; its six historical hashes and alias/behavior
assertions remain. The authorized A-07 correction supplies the immutable direction pin at its
existing reader call, preserving its aggregate expectation; A-10 readers remain unchanged. G's utility and A-10A helper transitions,
archives, the A-10C reader and closure manifest remain unchanged. Historical hashes are not
reported as current-file identities. Temporary negative cases challenge source/archive/pin/record
corruption, path/symlink substitution, unrelated source edits and reintroduced broad imports.

Declared validation covers the H proof, G/F boundaries, AR-02A complete conformance, existing
utility/registry/template behavior, semantic validation, A-09A/B/C replay and A-07/A-10 checks.
The full retained A-10A matrix runs separately with its existing timeout. The pinned harness also
compares every byte of G's accepted profiles, definitions, manifest, materializations, renders and
conformance observation. Implementer execution passed 1,115 tests across 21 files and all six
retained matrix tests separately: 1,121 tests across 22 files. Typecheck, focused lint, status,
requirements, tooling, documentation and deterministic export checks passed. The two complete
observation tests retain their actual executions under the original H contract; unchanged
harnesses, production inputs and byte-identical outputs establish their continued applicability.
They are not relabeled as replacement-contract executions. Final integrity/formatting and fresh
independent execution/native reconciliation remain separate recorded gates.

The output-path and exact A-07 caller corrections are two authorized semantic contract reissues,
with every earlier contract, lock and FAIL/BLOCKED record preserved externally. The complete caller
audit found no other missing direction-source pin. The A-07 aggregate remains
`sha256:21ef43c86f36bd9967fb4b8caf59039bc6b0dc0909d45d51dd81a666c6dddd03`.
Of 76 retained production sources, 74 current raw hashes remain original; only the approved G
utility and H direction sources use verified historical transitions. No post-change baseline was
recaptured as pre-change evidence.

Current projections close H upon accepted merge and select no successor. BATCH-04 then completes;
AR-02/03 remain Partial and AR-23 independently eligible/unstarted. The full semantic compiler,
full template materializer and other consumers retain separate isolation work; live renderer
composition remains intentional. This is no full AR-02 closure, visual redesign, live-AI quality
result or measured bundle-size claim. Standing owner authority still requires independent/native
PASS, one automatic review and exact-head/base required CI including validate before a protected
merge without override, followed by safe original-main synchronization and batch closeout.
