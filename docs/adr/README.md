# Architecture decision index

The decisions below remain binding under VESKIFY SDD v1.2.1. The corrective amendment clarifies
their application; it does not supersede their decisions.

| ADR                                                          | Decision                                                                    | v1.2.1 relevance                                                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [ADR-001](../ADR-001-PUCK_EDITOR_FOUNDATION.md)              | Puck is the isolated editor foundation.                                     | Puck data remains transient; it is not a second storefront graph or persistence model.                           |
| [ADR-002](ADR-002_CONTROLLED_DESIGN_AGENT.md)                | AI uses controlled Skills and structured operations.                        | Grounded capability retrieval and Skill packages retain proposal validation and scope boundaries.                |
| [ADR-003](ADR-003_URL_FIRST_DISCOVERY_AND_RECONCILIATION.md) | Public source evidence is untrusted and reconciled with canonical commerce. | Initial generation remains grounded in an approved brief and protected Vesko truth.                              |
| [ADR-004](ADR-004_DYNAMIC_COMMERCE_BOUND_COMPONENTS.md)      | Reusable components bind to canonical commerce presentation.                | The Component Knowledge Registry and PageBlueprints are generated from existing contracts, not parallel systems. |

The authoritative specification is
[`docs/VESKIFY_SDD.md`](../VESKIFY_SDD.md); its synchronized export is
[`docs/VESKIFY_SDD_v1.2.1.docx`](../VESKIFY_SDD_v1.2.1.docx).
