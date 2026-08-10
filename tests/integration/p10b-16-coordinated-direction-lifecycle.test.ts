import { describe, expect, it } from "vitest";
import {
  executeCoordinatedDirectionAlternatives,
  type CoordinatedDirectionResult,
} from "@/application/bounded-storefront-synthesis";
import { confirmPublish, preparePublish } from "@/application/publishing";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueString,
  validateCanonicalStorefrontSiteMap,
} from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";

const source = createP10B14PremiumEditorialFixture();
const requiredFamilies = new Set([
  "home",
  "collection",
  "search-results",
  "product-detail",
  "cart",
  "checkout",
  "no-results",
  "empty-state",
  "error-state",
  "not-found",
]);
const siteMapDecision = structuredClone(source.siteMapDecision);
siteMapDecision.pages = siteMapDecision.pages.map((page) => ({
  ...page,
  required: requiredFamilies.has(page.familyId),
}));
let cached: CoordinatedDirectionResult | undefined;

function result() {
  cached ??= executeCoordinatedDirectionAlternatives({
    planningInput: source.fixture.planningInput,
    siteMapDecision,
    approvedEvidenceReferences: source.approvedEvidenceReferences,
    pageEvidenceAuthority: source.pageEvidenceAuthority,
    contentFactAuthority: source.contentFactAuthority,
    approvedAssetPresentations: source.fixture.assetPresentations,
    directionRequest: {
      directionId: "minimal-commerce",
      deterministicSeed: "p10b16-lifecycle",
    },
    count: 1,
  })[0];
  return cached;
}

describe("P10B-16 canonical proposal, persistence and publication lifecycle", () => {
  it("20. binds the direction fingerprint to whole-storefront coordinated authority", () => {
    const value = result();
    expect(value.directionFingerprint).toMatch(/^coordinated-direction-selection-/);
    expect(value.decision.pageProfileSelections.map(({ familyId }) => familyId)).toEqual(
      expect.arrayContaining(["home", "collection", "search-results", "product-detail"]),
    );
  });

  it("21. compiles one current coordinated proposal rather than a direction-specific renderer", () => {
    const value = result();
    expect(value.synthesis.materialization.proposal.proposedStorefront.pages.length).toBe(
      value.synthesis.materialization.snapshot.pages.length,
    );
    expect(value.synthesis.materialization.plan.designSystemSelection.directionId).toBe(
      value.narrowing.directionId,
    );
  });

  it("22. preserves direction-selected optional page composition in StorefrontSnapshot", () => {
    const value = result();
    const families = value.synthesis.materialization.snapshot.pages.map(
      ({ pageFamily }) => pageFamily?.familyId,
    );
    expect(
      value.narrowing.includedOptionalPageFamilyIds.every((id) =>
        families.some((familyId) => familyId === id),
      ),
    ).toBe(true);
    expect(value.decision.evidenceComposition.omittedPageKeys.length).toBeGreaterThan(0);
  });

  it("23. saves and reloads the exact direction-derived canonical snapshot", async () => {
    const value = result();
    const repository = new InMemoryProjectRepository([source.fixture.aggregate]);
    await repository.saveDraft(
      value.synthesis.materialization.snapshot.projectId,
      value.synthesis.materialization.snapshot,
      { id: source.fixture.draft.id, revision: source.fixture.draft.revision },
    );
    const aggregate = await repository.get(value.synthesis.materialization.snapshot.projectId);
    const saved = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId)!;
    expect(canonicalStorefrontContentFingerprint(saved)).toBe(
      value.synthesis.materialization.snapshotFingerprint,
    );
  });

  it("24. publishes the exact direction-derived compiled storefront", async () => {
    const value = result();
    const repository = new InMemoryProjectRepository([source.fixture.aggregate]);
    await repository.saveDraft(
      value.synthesis.materialization.snapshot.projectId,
      value.synthesis.materialization.snapshot,
      { id: source.fixture.draft.id, revision: source.fixture.draft.revision },
    );
    const preparation = await preparePublish(
      value.synthesis.materialization.snapshot.projectId,
      repository,
      {
        authority: { kind: "manual", currentEvidenceReferences: source.approvedEvidenceReferences },
        now: () => new Date("2026-08-10T15:00:00.000Z"),
      },
    );
    const published = await confirmPublish(preparation, repository, {
      authority: { kind: "manual", currentEvidenceReferences: source.approvedEvidenceReferences },
    });
    expect(canonicalStorefrontContentFingerprint(published.publishedSnapshot)).toBe(
      value.synthesis.materialization.snapshotFingerprint,
    );
  });

  it("25. preserves protected commerce and canonical media through the proposal", () => {
    const value = result();
    expect(canonicalValueString(value.synthesis.materialization.planningInput.catalogue)).toBe(
      canonicalValueString(source.fixture.planningInput.catalogue),
    );
    expect(
      value.synthesis.materialization.snapshot.pages
        .filter(({ pageFamily }) => pageFamily?.familyId === "product-detail")
        .every(({ sections }) => (sections[0]?.approvedAssetPlacements?.length ?? 0) === 0),
    ).toBe(true);
  });

  it("26. preserves approved evidence without introducing technical or policy claims", () => {
    const before = canonicalValueString(source.approvedEvidenceReferences);
    result();
    expect(canonicalValueString(source.approvedEvidenceReferences)).toBe(before);
  });

  it("27. retains the P10B-14 complete Premium Editorial vertical slice", () => {
    expect(() =>
      validateCanonicalStorefrontSiteMap(source.slice.snapshot, {
        catalogue: source.fixture.aggregate.catalogue,
        enabledLocales: source.fixture.aggregate.project.enabledLocales,
      }),
    ).not.toThrow();
    expect(source.slice.snapshotFingerprint).toBe(
      canonicalStorefrontContentFingerprint(source.slice.snapshot),
    );
  });

  it("28. requires no provider or Vesko operation in coordinated direction execution", () => {
    const serialized = canonicalValueString(result());
    expect(serialized).not.toMatch(/rawPrompt|rawResponse|authorizationHeader|providerCall/i);
  });
});
