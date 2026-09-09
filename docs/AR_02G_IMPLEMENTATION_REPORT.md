# AR-02G implementation report

The existing utility profiles now validate variants through accepted utility metadata without
importing the utility renderer. Existing merchant storefront rendering and validation are
preserved. This is BATCH-04 child G on `codex/ar-02g-template-capability-boundary`, based on
accepted AR-02F PR #244 merge `9bdc045042ec8b1be27b971f5651a02edaf98468`.

Production scope is one file, `commercial-utility-profiles.ts`, with three additions and two
removals: the metadata import and a sound readonly string-array view of its existing variants.
Profile definitions, algorithms, signatures, getters, errors and runtime renderers are unchanged.
No array is copied and no second registry or profile authority is introduced.

Complete runtime closure now resolves for utility profiles (113 files), template registry (125),
capability manifest (133), utility materializer (114), capability projection (162) and request (165).
Each has Zod as its only external package. The unchanged AR-02B resolver distinguishes erased type
imports and inspects runtime imports/re-exports. The focused guard excludes renderer/UI/CSS,
legacy wrappers, acceptance and full-template/synthesis/publication execution.

The complete pre-edit/final observation is byte-identical: 2,463,080 bytes, SHA-256
`717daec93a8db692989e468efd6208f1f55fd2861f3415f563c9182ce1e87020`. It covers six utility profiles,
all 53 registered profiles, 29 V2 definitions/manifest entries, six materializations/pages,
12 EN/FI page renders plus 14 utility-variant renders, 33 registrations and 52 existing findings.
Seven error outcomes include direct unregistered variants, stale signatures, invalid frames and
transforms, malformed/duplicate libraries and unavailable page authority. Source inputs remain
unchanged. Preliminary preflight-01 is preserved; the complete second capture preceded source
changes and keeps changing graph observations separate from stable behavior.

The owner explicitly authorized the utility historical-source transition in G. Original utility source
is retained verbatim in the non-executable `tests/fixtures/ar-02g/` archive, raw SHA-256
`cacb58d5debc5b00367b68df6b503335082d7a37549742d967116388b525d3f0`. The reviewed current successor
has separate raw SHA-256 `f363ed045cb0c974efa0eb8aa497037ff143a36cc125bf63c200a49d95af462c`.
The strict test-only reader validates fixed identity tuples, caller historical pins, current
successors and regular original archives before supplying historical aggregate bytes. Only G's
transitions are active; H's named direction source remains unchanged and unstarted.

The four approved A-03/A-04/A-07/A-10 readers retain their original aggregate constants and live
behavior/inactivity guards. Of 76 historical source identities, 75 current raw hashes remain
unchanged and one uses this verified transition. The semantic profile fingerprint remains
`bb645147d5be601a9d1f46a4c6bfdd18111183aee0c151ddeff22d020b6e5871`; the distinct historical source
aggregate remains `068da1456be8921ec1014bc10701f629be5afb770910efb0fe91a86c75b9167b`. Archives and
historical aggregate hashes are not described as current-file raw identity. Negative controls
reject altered/missing/symlink archives, changed successors, wrong pins, malformed/duplicate/
escaping records, and unrelated protected edits without mutating the real checkout.

The original contract's run passed 1,021 tests but failed A-10C suite collection on its nested
A-10A helper raw pin. BLOCKED-01 and that contract remain preserved. The explicitly semantic
amendment keeps the same branch/base and original six criteria, adds the narrow closure proof,
and records replacement raw SHA-256 `bd79c5b9ba53542b0f983b72fe9e70928ebbff6e02b573af19136a0e64ab2f8d`
and canonical fingerprint `veskify-task-contract-v1_21829b07b685149e59e2a4557d1ed6d810ac598e43c5dd3dc7b315695b495dff`.
Its 195-line non-executable A-10A helper archive retains original raw
`b100d6e3bff1c7cb3e25c83d886b991a7e95e9a231b1d6c0a98d0dc59c940073`; the current helper remains
`01d8f531a70f622938ea67a0863b33c48b158e99fbdc8f26277ffa8bfd2ac182`.
Only that A-10C predecessor read uses the verified archive; the other ten keep direct raw checks.
All eleven original hashes, the closure manifest and fingerprints remain unchanged. Current A-10A
validation still executes; virtual read faults exercise the actual readers without checkout edits.
Final amended implementer checks passed 1,041 tests across 18 files, plus one complete observation
test. Typecheck, focused lint, documentation and deterministic export checks passed. Handwritten
scope is +1668/-45 overall and +434/-32 for the amendment; production remains +3/-2 in one file.
Final formatting, whitespace and preservation checks are required before the review freeze.
Independent execution and native reconciliation must pass before submission. One automatic review and exact-head/base CI including
validate remain separate gates. The retained standing owner authorization binds each final head
before an expected-head-protected merge without override.

Current projections close only G on its accepted merge and select H. BATCH-01/02/03 remain
completed history; AR-02/03 remain Partial and AR-23 eligible/unstarted. Semantic-request,
compiler/full-template-materializer and other consumer isolation remain separate work. Live
renderer composition stays legitimate. No new visual quality, measured bundle-size improvement,
deployment, provider call or third task is claimed.
