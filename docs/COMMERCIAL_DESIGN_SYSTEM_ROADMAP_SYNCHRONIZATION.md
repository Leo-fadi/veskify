# Commercial Storefront Design-System Roadmap Synchronization

**Date:** 5 August 2026

## Authoritative decision

This 5 August 2026 migration record originally assigned the commercial design-system specification
to **P10B — Commercial Storefront Design System v1**. The current phase name and delivery plan are
superseded by
[`P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md`](P10B_COMMERCIAL_STOREFRONT_GENERATION_ARCHITECTURE.md):
**P10B — Commercial Storefront Generation System v1**, with the design system retained as a
subsystem. The historical ownership migration below remains valid.

## Migration record

| Former work                             | Authoritative destination                        | Preserved boundary                                                                    |
| --------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| P10B-01 Brand asset upload/library      | P10C-01 Brand asset library                      | `AssetInventory` and approved placement remain canonical.                             |
| P10B-02 Roles/provenance/metadata       | P10C-02 Asset roles and provenance               | Product and variant media truth remain protected.                                     |
| P10B-03 Generated-image lifecycle       | P10D-01 Generated-image lifecycle                | Generation stays reviewable, policy-bound and never replaces canonical product media. |
| P10B-04 Studio shell                    | P10C-08 Brand and asset editor with Studio shell | Puck remains transient; `StorefrontSnapshot` remains canonical.                       |
| Former Phase 11 granular editing        | P10C-03 through P10C-09                          | Manual and AI edits share bounded operations and history.                             |
| Former Phase 12 stable domains/adapters | P11                                              | Vesko adapter conformance remains required.                                           |
| Former later deployment work            | P12                                              | Production hardening remains after design-system and Studio work.                     |

P10D advanced media and interactive presentation is deferred and does not block P10B or P10C.
Registered, governed Three.js implementations are permitted only as registered
interactive-presentation capabilities. AI may select or configure them but may not generate their
implementation; registered component, asset, performance, accessibility and non-interactive-fallback
authority continues to apply. No arbitrary generated application code or arbitrary/generated Three.js
implementation is permitted.
