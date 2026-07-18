# P3-02 — Canonical Storefront Design Brief

## Purpose

`StorefrontDesignBrief` is the versioned, validated domain contract that carries the merchant
information needed to plan and generate an initial storefront. It is deliberately React-,
Next.js-, browser-storage-, Puck-, persistence-, catalogue-record-, and AI-provider-independent.

The brief is a planning input, not a project, page tree, catalogue, proposal, snapshot, or publish
record.

## Specification alignment

This implementation supports SDD §§4.1, 4.4, 6.1–6.2, 8.1, 11.1–11.2, 12.1–12.5, 12.8–12.9,
14.1, 15.1, 16.2, 17.1 and 21. It directly prepares FR-002, FR-003, FR-005, FR-007, FR-008,
FR-009, FR-010, FR-031, FR-035 and FR-040, with unit coverage for the validation and readiness
parts of AC-001, AC-002 and AC-017. It does not claim those end-to-end acceptance criteria complete;
onboarding, generation and project creation remain later milestones.

## Ownership boundary

The brief owns creation context, business identity, controlled brand direction, storefront structure,
storefront-content language planning, catalogue context selection, bounded generation preferences,
and its own collecting/ready/consumed lifecycle metadata.

It does not own uploaded files, binary media, URL fetching, product records, variants, prices, stock,
inventory, page composition, Puck data, provider prompts, project persistence, or publishing state.
Asset references are metadata-only IDs and optional labels. The later asset-intake milestone decides
how those references resolve.

## Relationship to onboarding

P3-01 onboarding remains the merchant-facing session and persistence boundary. This contract is a
separate domain output that later onboarding steps can assemble and validate. It does not import the
onboarding session, step registry, route, storage adapter, or UI. Interface locale remains separate
from the brief's selected storefront-content languages.

## Relationship to deterministic generation

The deterministic storefront planner will consume a validated brief and choose approved page
templates, components, skills, assets, and catalogue presentation context. `evaluateGenerationReadiness`
returns blocking issues, non-blocking warnings, completed areas, and missing areas before planning
starts. A missing logo or other optional brand direction produces a warning; it does not block a
generation plan. An empty catalogue is a valid design context and does not add commerce records.

## Relationship to later AI providers

Providers may receive a provider-adapter projection of a validated brief in a later milestone. The
brief itself contains no prompt text, provider response types, executable code, or provider-specific
metadata. The provider boundary must continue to return validated Veskify plans and operations.

## Implemented scope

- Versioned Zod contract with collecting, ready, and consumed statuses.
- New, redesign, and demo storefront creation contexts.
- HTTPS-only redesign URL validation without fetching or crawling.
- Business identity, controlled brand direction, canonical page types, EN/FI language plans,
  catalogue-context selection, and bounded generation preferences.
- Typed validation and lifecycle errors.
- Empty creation, validation, normalization, immutable cloning, area updates, and readiness
  evaluation helpers.

## Deferred scope

- P3-01 onboarding UI/session integration.
- Uploads, binary storage, image processing, URL downloads, or AI image analysis.
- CSV/Excel import, field mapping, product enrichment, variants, prices, stock, and catalogue
  persistence.
- Deterministic storefront planning, project creation, generation progress, editor handoff, and
  AI-provider adapters.
