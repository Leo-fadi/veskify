# P3-20 — Project creation from validated generation review

The approved storefront project application boundary consumes the validated P3-13
generation review and the P3-15 initial aggregate factory. A review must be valid,
non-blocked, fully materialized, contain the required `home`, `collection`, and
`product` pages, and carry complete language and identity data before persistence.

The factory produces the complete project, catalogue, generated draft, and immutable
published baseline. The application service submits that aggregate once to
`ProjectRepository.create`, which is the atomic persistence boundary. Validation,
identity conflicts, and repository failures therefore leave the repository unchanged.

Successful creation returns the project identity, snapshot identities, and the editor
route (`/projects/{projectId}/editor`). This implements SDD §13.5 and §15.7,
requirements FR-001, FR-009, FR-041, FR-044, FR-045, and FR-050, and acceptance
criteria AC-025, AC-026, and AC-027.
