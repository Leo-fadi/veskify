# AR-02B implementation approach

AR-02B moves the deterministic renderer-conformance evaluator into a directly importable core.
The core reads the existing PageBlueprint contract and materializer leaves and requires an explicit,
readonly list of bridge component names. The existing public evaluator stays at its original path as
a compatibility wrapper; it reads the live V1 bridge-map keys and delegates to that core.

The canonical authority remains the generated capability manifest and the executable PageBlueprint
contract/materializer. The explicit bridge list is transient evaluation context, not a registry,
persisted model, or source of live observation. Current consumers are the live report composition,
registry public barrel callers, and the focused AR-02B core test.

Rejected shortcuts were importing the storefront-template barrel or registry from the core, retaining
a cached/default bridge lookup, duplicating materialization, or replacing the generated manifest with
a hand-curated inventory. Invalid materialization retains its existing catch-to-finding behavior;
missing bridge coverage retains its existing commercial finding. No architecture conflicts are known.
