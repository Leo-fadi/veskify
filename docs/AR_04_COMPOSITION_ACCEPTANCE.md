# AR-04 composition acceptance

This maps the complete original AR-04 outcome and T01/T16/T21 against the unchanged
canonical generation and legacy readers. The candidate status is **Baseline / closed
effective upon accepted merge**, conditional on final independent verification,
native reconciliation, one automatic review and all required CI. It does not assert
that those delivery events have already occurred. AR-02 and AR-03 remain closed.

## Entrypoints and ownership

`prompted-composition.server.ts` is the actual normal prompted-generation entry used
by the existing API dispatcher. It constructs the unchanged canonical prompted
handler with injected trusted authority or the existing unavailable singleton.
Shared authority contracts and failure declarations have separate owners; old
exports reference the same constructors, function and singleton. Merchant context
imports the defining storage repository module, preserving error identity while
removing the P03 fixture edge through the storage barrel.

The HTTP endpoint and `handler.ts` remain the intentionally mixed operation
dispatcher. Both factories retain eager initialization and environment capture.
Only a prompted body without the registered follow-up header selects normal
generation; only that header without the prompted body selects retained follow-up.
Both or neither retain the original validation response. The explicit legacy
factory remains available until AR-20; failed prompted generation never falls back.

The route dynamically loads local dispatch only outside production. That dispatcher
also rejects production before local loading. P04, standalone P03 and tagged P9
retain their priority, exact flags, request cloning, three caches and terminal
exceptions. Actual local authorities retain token, origin, identity and call limits.

## Complete acceptance map

| Original requirement                                                                                                     | Evidence and boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01: supported v1 parse/read/render/publication without write-back                                                       | Unchanged A-09A/B/C unit and render/publication replay tests use retained historical fixtures and fixed identities. Current AR-03 route, presentation, authoring and migration tests preserve registered implementations, profile/schema identities and supported readers. No historical source or aggregate is rebaselined.                                                                                                                                                              |
| T16: zero calls on open; generate/inspect/reject/regenerate/accept/undo/redo/save/reload/preview through the same facade | Existing P03 server generation and canonical transition tests, P04F semantic lifecycle, and P9 editor bridge/follow-up tests exercise actual canonical operations with trusted in-memory authority. Complete baseline/final observations include provider requests/counts, responses, lifecycle inputs and failure ordering. Missing normal authority fails before provider selection. New tests cover action denial, tenant/project/draft/locale failures and terminal lifecycle errors. |
| T21: preserve live importers, dynamic routes and supported persisted references                                          | No production file or operation is deleted. Declaration comparison preserves all moved/public identities and untouched execution bodies. Production-path assertions retain removed-route, single-materialization and follow-up guarantees; A-10 closure/inventory and AR-03 tests preserve version/profile/registry/publication references. Literal local loaders and compatibility exports remain.                                                                                       |
| Normal root excludes dedicated local fixtures and legacy error backedges                                                 | Resolved repository traversal covers normal factory, authority contract and canonical prompted handler with zero forbidden edges. CSS, server-only markers, Node builtins and installed runtime package entrypoints are explicit boundaries. The graph does not claim to inspect installed package internals or make real generation renderer-free.                                                                                                                                       |
| Production-disabled seams and unchanged behavior                                                                         | Fresh-module route tests cover enabled flags in production, live local precedence, caches, body readability and terminal loader/factory/handler failures. The retained harness compares all 373 deterministic observations, including 111 error cases, with the original Git-base capture. Existing real authority tests separately enforce local security.                                                                                                                               |
| Built behavior and delivery                                                                                              | Candidate and independent final builds must pass all six unchanged raw/gzip ceilings. Server route traces and client chunk measurements distinguish shipped code from runtime evaluation. Final independent/native PASS, automatic review and required CI including budgets and validate are separate merge gates.                                                                                                                                                                        |

## Limits and exit decision

The corrected trace checker retains every entry and verifies the three exact
dependency-directory links against recorded installations, with strict synthetic
controls. Retained candidate artifacts are revalidated without rebuilding; the
independent final export is bound to its frozen assignment and fresh build.

This is composition isolation, not new integrated authentication, live Vesko/provider
acceptance or deployment. The production route still ships the explicitly retained
mixed follow-up machinery; dynamic source reachability is not claimed absent.
Compiler, materializer, renderer and genuine permission/component validation remain
legitimate execution dependencies. No all-local-code-eliminated bundle claim is made.

AR-04 closure requires the complete map above to pass independently. AR-05 remains
eligible and unstarted; AR-06 depends on AR-05, AR-07 on AR-04 and AR-06. AR-08,
visual-family activation and production integration remain incomplete. AR-23 remains
independently eligible and unstarted. No successor implementation is authorized here.
