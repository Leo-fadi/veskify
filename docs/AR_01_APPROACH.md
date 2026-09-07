# AR-01 implementation approach

**Locked contract:** external `AR-01.contract.json`, SHA-256
`401bcb25a15e8fa90e956be479f1a1e7d068e6cbcec826fdb1582e66396631d3`.
The repository documentary copy has formatting-only differences from the external
raw file; parsed contract content and native contract fingerprint are identical.
The external authority and its pinned raw hash remain unchanged.

**Audit base:** `82e8c3922ccc5a737fec2e18311ff7ab1a69e8ae`.

AR-01 adds evidence only. `StorefrontSnapshot`, registered capabilities, routes,
Puck isolation, canonical commerce projections, persistence and publication remain
their existing authorities.

The inventory uses the installed TypeScript compiler API and the repository
`tsconfig.json`. It reads tracked files at the audit base through `git show`; it
does not import or execute application modules. It records resolved import edges,
type-only edges, re-exports, literal dynamic imports, unresolved computed imports,
route roots, and explicit persisted/string references. Unknown external consumers
block retirement.

The current consumers are AR-02 (capability metadata/rendering), AR-03 (dynamic
route authority), and AR-23 (host contract). A grep-only scan, executing source to
discover imports, deleting a zero-import legacy target, and a second registry are
rejected shortcuts. A missing or unexplained audit proof blocks submission; product
diagnostic failures remain findings instead of being coerced into a pass.

No unresolved architecture conflict was found before implementation. The proposed
status text is explicitly conditional on owner acceptance/merge.

The final scope is 18 files and zero product-source lines. Gross handwritten
change exceeds the 3,000-line target because all manual per-area decisions,
reference evidence, source selectors and handoffs count toward it; it remains below
the locked 4,500-addition/700-deletion hard limits. Only the manifest scanner and
per-area target/export properties are measured as generated; DOCX bytes are
reported separately. Exact gross counts and before/after hashes are retained in
PR evidence. Raw graph reconstruction is documented in the report/manifest.
