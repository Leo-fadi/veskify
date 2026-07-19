# P4-01 — Canonical AI operation provider contract

`src/application/ai-provider` adds the provider-independent boundary for structured
storefront-edit proposals. Requests carry project/draft identity, explicit target
scope, merchant instruction, registered operation/component context, locale context,
the current page, imported content labelled as untrusted data, and canonical
target-bound permission grants. Each grant preserves the selected skill identity,
allowed operations, component type, and existing or introduced section target.

`AIProvider` returns only a validated operation envelope. `DeterministicMockAIProvider`
adapts the existing deterministic design-skill provider and never writes to a draft or
repository. `validateAiProviderResponse` parses operations, applies the existing
registry and protected-field guards, enforces target scope, and rejects executable or
arbitrary markup. Every returned operation must match one permission grant; global
operation and component allow-lists cannot authorize unrelated sections on their own.
Provider failures become merchant-safe retryable errors.

This implements SDD §§12.6, 12.10, 17.2, 17.5 and 17.6, including FR-028, FR-042,
NFR-007, NFR-008, AC-016 and AC-020, without changing editor, publishing, catalogue,
or draft persistence behaviour.
