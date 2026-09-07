# AR-02A implementation approach

AR-02A mechanically separates live renderer observation and live report composition from the
deterministic renderer-conformance evaluator. The existing component definitions, registry maps,
manifest authority, report values, public exports and persisted versions remain authoritative.

`renderer-observation.ts` owns live target collection and recursive freezing. Its current consumers
are the live diagnostic composition and compatible registry-barrel callers. `live-renderer-conformance.ts`
owns the live inputs and calls the retained deterministic evaluator directly. The evaluator retains
its public input/report types and existing PageBlueprint/definition closure. `RendererTarget` remains
available as an equivalent exported type.

Rejected shortcuts: copying a capability catalogue, routing new modules through the registry barrel,
altering finding semantics, or claiming that the evaluator is renderer-free. Invalid extraction,
changed frozen observations, cycles, or missing independent proof fail closed and block submission.

No unresolved architecture conflict is known. The remaining AR-02 work is definition and
PageBlueprint materializer isolation; this child does not perform it.
