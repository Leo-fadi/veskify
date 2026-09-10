# AR-03C — Route resolution and preview cutover

## Authority and ownership

This second and final BATCH-05 child starts from PR #247's accepted merge
`bb22a69fd126f45d97c485f1358408a9ca807177` in the original checkout. Its immutable
[contract](governance/task-contracts/AR/AR-03C.json) owns eight production files.
The tracker remains status authority; the roadmap owns delivery order.

## Selected approach

Move existing current-authority validation into `current-authority.ts`, page/section
projection into `route-projection.ts`, and resolution/policy/lookups into
`route-resolution.ts`. Use direct existing component/profile metadata and accepted B
support leaves. Shared canonical types remain in their current domain owners.
Keep the same public facade exports and constructor/function identity. Only the dynamic-route
import source changes in the project, collection, product and search preview clients.

The old facade retains full migration, design selection/application, editor projection/apply
and expansion. Those callers import the same moved implementations. The profile materializer
and exact historical presentation compatibility are legitimate dependencies of the new roots.

## Rejected shortcuts and failure behavior

A facade back-edge, registry barrel, copied helper/schema/error constructor or lazy callback
would defeat ownership. Removing compatibility or introducing a new route/type policy would
change accepted behavior. No new persisted representation or incidental deep-clone fix is needed.

Preserve route-ID precedence, exact paths, collection mappings, known product type followed by
existing complexity selection, unknown-type fallback, registered editor overrides and ignored
runtime override injection. Preserve transient search membership/revision checks, related IDs,
asset placement, SEO alias behavior and original first-error ordering without input mutation.

## Proof and limits

Pinned actual-base observations cover current/compatibility authority, routes/pages, EN/FI
production route rendering, editor variants, existing asset rejection and successful campaign
media. New tests prove recursive runtime closure, import/function identity and meaningful
negative behavior. Existing route/editor/search, retained replay and metadata checks remain.
Pause the writer for fresh independent execution and native reconciliation before submission.

No architecture conflict was found. This isolates runtime validation/projection/resolution;
AR-02/03 remain Partial. It does not establish new visual quality, a bundle-size reduction,
live commerce freshness, or completion of migration/editor/expand isolation. After the authorized
gated C merge, synchronize safely, close BATCH-05 and stop without selecting a third child.

## Authorized support amendment

The owner separately authorized one semantic support amendment on this same branch/base.
After proving the exact branch-metadata insertion and byte-identical earlier configuration,
the integrity checker pins the full observed successor hash. All other assertions remain
unchanged. Original support, contract and BLOCKED identities are retained; earlier test and
observation evidence keeps its original provenance. Synthetic in-memory mutations challenge
the actual fixed-config, support-pin and protected-input assertions without editing config.
This changes no product scope or functional acceptance. The original 17 validations remain,
with one additional declared support regression. Final source/support verification freezes
remain distinct from subsequent authorized Git index/ref delivery transitions.

## Owner-approved search budget amendment

The owner accepts the measured small bundle regression. Change only search's raw ceiling
from 1,650,000 to 1,655,000 bytes in the existing build-budget checker. Search gzip remains
475,000 bytes; every other route limit and the complete measurement algorithm remain unchanged.
Application source remains byte-identical to submitted head
`c2eba5ee29fdd1f827707b250a979386651d9820`; the rejected import candidate stays rejected.

The controlled local comparison measured search at 1,649,964 bytes on B's accepted base and
1,651,496 on C; original CI measured 1,651,498. Emitted module repartitioning is consistent
with the shared increase, but no exact compiler bailout explanation was established.
The amendment adds 5,000 bytes of policy allowance; it does not reduce delivered JavaScript.
Prior contracts, diagnostic builds and failed old-budget CI remain historical evidence.

The semantic contract successor requires real-checker synthetic boundary/failure cases,
all original functional checks, and one fresh independent Webpack build with exact six-route
raw/gzip proof. The export-local generated `next-env.d.ts` change is checked against fixed
production bytes; all other source remains frozen. Fresh independent/native proof and new-head
CI precede the same-PR correction commit's protected merge. The single automatic review belongs
to the original submission; no second review is requested. No further budget increase is approved.
