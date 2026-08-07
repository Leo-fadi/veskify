# Architecture decision index

The decisions below remain binding under Veskify SDD v1.3.0. The consolidated specification
clarifies their current application; it does not supersede their decisions.

| ADR                                                          | Decision                                                                    | Current relevance                                                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [ADR-001](../ADR-001-PUCK_EDITOR_FOUNDATION.md)              | Puck is the isolated editor foundation.                                     | Puck data remains transient; it is not a second storefront graph or persistence model.                                         |
| [ADR-002](ADR-002_CONTROLLED_DESIGN_AGENT.md)                | AI uses controlled Skills and structured operations.                        | Recipe/family selection, bounded parameters, reachability and visual evidence retain proposal validation and scope boundaries. |
| [ADR-003](ADR-003_URL_FIRST_DISCOVERY_AND_RECONCILIATION.md) | Public source evidence is untrusted and reconciled with canonical commerce. | Initial generation remains grounded in an approved brief and protected Vesko truth.                                            |
| [ADR-004](ADR-004_DYNAMIC_COMMERCE_BOUND_COMPONENTS.md)      | Reusable components bind to canonical commerce presentation.                | The Component Knowledge Registry and PageBlueprints are generated from existing contracts, not parallel systems.               |

The authoritative specification is
[`docs/VESKIFY_SDD.md`](../VESKIFY_SDD.md); its synchronized export is
[`docs/VESKIFY_SDD_v1.3.0.docx`](../VESKIFY_SDD_v1.3.0.docx).
