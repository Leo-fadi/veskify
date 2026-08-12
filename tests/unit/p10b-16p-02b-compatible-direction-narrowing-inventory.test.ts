import { describe, expect, it } from "vitest";
import {
  compatibleCoordinatedDirectionCandidateMaterial,
  listCompatibleCoordinatedDirectionSelectionNarrowings,
  listCoordinatedStorefrontDirections,
  type CompatibleCoordinatedDirectionCandidateBudgetError,
  validateDirectionSelectionNarrowing,
} from "@/application/bounded-storefront-synthesis";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { canonicalValueString } from "@/domain/storefront";

function currentAuthority() {
  const source = createP10B14PremiumEditorialFixture();
  const siteMapDecision = structuredClone(source.siteMapDecision);
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
  siteMapDecision.pages = siteMapDecision.pages.map((page) => ({
    ...page,
    required: requiredFamilies.has(page.familyId),
  }));
  return {
    source,
    input: {
      planningInput: source.fixture.planningInput,
      siteMapDecision,
      approvedEvidenceReferences: source.approvedEvidenceReferences,
    },
  };
}

describe("P10B-16P-02B compatible coordinated-direction narrowing inventory", () => {
  it("lists every current compatible exact narrowing deterministically without materialization", () => {
    const { source, input } = currentAuthority();
    const draftBefore = canonicalValueString(source.fixture.planningInput.draft);
    const first = listCompatibleCoordinatedDirectionSelectionNarrowings(input);
    const second = listCompatibleCoordinatedDirectionSelectionNarrowings(input);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(new Set(first.map(({ selectionId }) => selectionId)).size).toBe(first.length);
    expect(new Set(first.map(({ authorityId }) => authorityId))).toEqual(
      new Set(listCoordinatedStorefrontDirections().map(({ id }) => `coordinated-direction:${id}`)),
    );
    for (const direction of listCoordinatedStorefrontDirections()) {
      const entries = first.filter(
        ({ authorityId }) => authorityId === `coordinated-direction:${direction.id}`,
      );
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.map(({ selectionId }) => selectionId)).toEqual(
        entries
          .map(({ selectionId }) => selectionId)
          .sort((left, right) => left.localeCompare(right)),
      );
      expect(
        entries.every(
          ({ authorityFingerprint }) => authorityFingerprint === direction.authorityFingerprint,
        ),
      ).toBe(true);
      entries.forEach(validateDirectionSelectionNarrowing);
    }
    expect(canonicalValueString(source.fixture.planningInput.draft)).toBe(draftBefore);
    expect(JSON.stringify(first)).not.toMatch(
      /synthesisFingerprint|proposalFingerprint|snapshotFingerprint|materialization/,
    );
  });

  it("supports an exact direction filter without changing that direction's canonical order", () => {
    const { input } = currentAuthority();
    const all = listCompatibleCoordinatedDirectionSelectionNarrowings(input);
    const filtered = listCompatibleCoordinatedDirectionSelectionNarrowings(input, {
      directionId: "modern-technical",
    });

    expect(filtered).toEqual(
      all.filter(({ authorityId }) => authorityId === "coordinated-direction:modern-technical"),
    );
    expect(filtered.every(({ authorityId }) => authorityId.endsWith("modern-technical"))).toBe(
      true,
    );
  });

  it("fails before expanding an oversized coordinated-direction candidate authority", () => {
    const { input } = currentAuthority();
    const direction = listCoordinatedStorefrontDirections()[0];
    const homepageProfileId = direction?.constraints.homepageProfileIds[0];
    if (!direction || !homepageProfileId)
      throw new Error("Expected registered direction authority.");
    const oversizedDirection = {
      ...direction,
      constraints: {
        ...direction.constraints,
        homepageProfileIds: Array.from({ length: 100 }, () => homepageProfileId),
      },
    };

    expect(() =>
      compatibleCoordinatedDirectionCandidateMaterial(
        oversizedDirection,
        {
          ...input,
          request: {
            intent: direction.intent,
            deterministicSeed: "oversized-candidate-authority",
          },
        },
        { maximumCandidateEvaluations: 8 },
      ),
    ).toThrow(
      expect.objectContaining<Partial<CompatibleCoordinatedDirectionCandidateBudgetError>>({
        code: "candidate-budget-exceeded",
        maximumCandidateEvaluations: 8,
      }),
    );
  });
});
