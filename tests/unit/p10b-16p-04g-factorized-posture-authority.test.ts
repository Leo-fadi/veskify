import { describe, expect, it } from "vitest";
import {
  getCoordinatedStorefrontDirection,
  inspectCompatibleCoordinatedDirectionCandidateInventory,
  listCompatibleCoordinatedDirectionFactorizedCandidates,
  listCompatibleCoordinatedDirectionSelectionNarrowings,
  resolveCompatibleCoordinatedDirectionPostureFactors,
  type CompatibleCoordinatedDirectionPostureFactors,
} from "@/application/bounded-storefront-synthesis";
import { isCurrentCompatibleCoordinatedDirectionExactSelection } from "@/application/bounded-storefront-synthesis/compatible-direction-selections";
import { createP10B16P03RawKarvonenStudioFixture } from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";

function currentAuthority() {
  const fixture = createP10B16P03RawKarvonenStudioFixture();
  return {
    fixture,
    authority: {
      planningInput: fixture.planningInput,
      siteMapDecision: fixture.siteMapDecision,
      approvedEvidenceReferences: fixture.approvedEvidenceReferences,
    },
  };
}

function exactMaterial(
  narrowing: ReturnType<typeof resolveCompatibleCoordinatedDirectionPostureFactors>,
) {
  const {
    authorityId: _authorityId,
    authorityVersion: _authorityVersion,
    authorityFingerprint: _authorityFingerprint,
    selectionId: _selectionId,
    ...exact
  } = narrowing;
  void _authorityId;
  void _authorityVersion;
  void _authorityFingerprint;
  void _selectionId;
  return exact;
}

describe("P10B-16P-04G factorized posture authority", () => {
  it("exposes registered posture options over bounded canonical backbones without Cartesian expansion", () => {
    const { fixture, authority } = currentAuthority();
    const draftBefore = canonicalValueString(fixture.planningInput.draft);
    const factorized = listCompatibleCoordinatedDirectionFactorizedCandidates(authority);
    const legacyBackbones = listCompatibleCoordinatedDirectionSelectionNarrowings(authority);
    const diagnostic = inspectCompatibleCoordinatedDirectionCandidateInventory(authority);

    expect(factorized).toHaveLength(diagnostic.finalCandidateCount);
    expect(diagnostic).toMatchObject({
      contractVersion: "1.1.0",
      initialCandidateCount: 1728,
      finalCandidateCount: 159,
      firstEmptyStage: null,
      stages: [
        {
          stage: "registered-direction-tuples",
          enteringCandidateCount: 1728,
          remainingCandidateCount: 1728,
          eliminationReasons: [],
        },
        {
          stage: "approved-asset-posture",
          enteringCandidateCount: 1728,
          remainingCandidateCount: 1152,
          eliminationReasons: [{ reasonCode: "unsupported-approved-asset-posture", count: 576 }],
        },
        {
          stage: "profile-design-dna",
          enteringCandidateCount: 1152,
          remainingCandidateCount: 540,
          eliminationReasons: [{ reasonCode: "incompatible-profile-design-dna", count: 612 }],
        },
        {
          stage: "dynamic-commerce-profile-context",
          enteringCandidateCount: 540,
          remainingCandidateCount: 195,
          eliminationReasons: [
            { reasonCode: "incompatible-dynamic-commerce-profile-context", count: 345 },
          ],
        },
        {
          stage: "page-set-shared-frame",
          enteringCandidateCount: 195,
          remainingCandidateCount: 159,
          eliminationReasons: [{ reasonCode: "incompatible-page-set-shared-frame", count: 36 }],
        },
      ],
    });
    expect(legacyBackbones).toEqual(factorized.map(({ backbone }) => backbone));
    expect(
      Object.fromEntries(
        factorized.reduce((counts, { backbone }) => {
          counts.set(
            backbone.sharedFrameProfileId,
            (counts.get(backbone.sharedFrameProfileId) ?? 0) + 1,
          );
          return counts;
        }, new Map<string, number>()),
      ),
    ).toEqual({
      "editorial-masthead": 54,
      "centered-minimal": 57,
      "commerce-utility": 24,
      "compact-technical": 24,
    });
    const expandedPostureCardinality = factorized.reduce(
      (total, candidate) =>
        total +
        candidate.narrativePostureOptions.length *
          candidate.merchandisingPostureOptions.length *
          candidate.informationDensityPostureOptions.length *
          candidate.artDirectionPostureOptions.length *
          candidate.responsiveModeOptions.length,
      0,
    );
    expect(factorized.length).toBeLessThan(expandedPostureCardinality);

    for (const candidate of factorized) {
      const directionId = candidate.backbone.authorityId.replace(/^coordinated-direction:/, "") as
        "premium-editorial" | "modern-technical" | "minimal-commerce";
      const direction = getCoordinatedStorefrontDirection(directionId);
      expect(candidate.narrativePostureOptions).toEqual(direction.constraints.narrativePostures);
      expect(candidate.merchandisingPostureOptions).toEqual(
        direction.constraints.merchandisingPostures,
      );
      const expectedDensity = {
        compact: "compact",
        standard: "balanced",
        spacious: "airy",
      }[candidate.backbone.designSystemSpacingDensity] as "compact" | "balanced" | "airy";
      expect(candidate.informationDensityPostureOptions).toEqual([expectedDensity]);
      expect(candidate.artDirectionPostureOptions).toEqual(
        direction.constraints.artDirectionPostures,
      );
      expect(candidate.responsiveModeOptions).toEqual(direction.constraints.responsiveModes);
      expect(candidate.backbone).toMatchObject({
        narrativePosture: direction.constraints.postureDefaults.narrativePosture,
        merchandisingPosture: direction.constraints.postureDefaults.merchandisingPosture,
        informationDensityPosture: expectedDensity,
        artDirectionPosture: direction.constraints.postureDefaults.artDirectionPosture,
        responsiveMode: direction.constraints.postureDefaults.responsiveMode,
      });
      expect(candidate.factorAuthorityFingerprint).toMatch(
        /^coordinated-direction-posture-factors-v1_/,
      );
      const dynamic = fixture.planningInput.draft.dynamicCommercePresentation;
      if (!dynamic) throw new Error("Expected current dynamic-commerce authority.");
      expect(
        dynamic.collectionSearchArchetypes.some(
          ({ profile, supportedContexts, compatibleSharedFrameProfileIds }) =>
            profile.profileId === candidate.backbone.collectionProfileId &&
            supportedContexts.includes("collection") &&
            compatibleSharedFrameProfileIds.includes(candidate.backbone.sharedFrameProfileId),
        ),
      ).toBe(true);
      expect(
        dynamic.collectionSearchArchetypes.some(
          ({ profile, supportedContexts, compatibleSharedFrameProfileIds }) =>
            profile.profileId === candidate.backbone.searchProfileId &&
            supportedContexts.includes("search") &&
            compatibleSharedFrameProfileIds.includes(candidate.backbone.sharedFrameProfileId),
        ),
      ).toBe(true);
      expect(
        dynamic.productDetailArchetypes.some(
          ({ profile, compatibleSharedFrameProfileIds }) =>
            profile.profileId === candidate.backbone.pdpProfileId &&
            compatibleSharedFrameProfileIds.includes(candidate.backbone.sharedFrameProfileId),
        ),
      ).toBe(true);
    }
    const minimalStructures = factorized
      .filter(({ backbone }) => backbone.authorityId === "coordinated-direction:minimal-commerce")
      .map(({ backbone }) =>
        canonicalValueString({
          sharedFrameProfileId: backbone.sharedFrameProfileId,
          homepageProfileId: backbone.homepageProfileId,
          collectionProfileId: backbone.collectionProfileId,
          pdpProfileId: backbone.pdpProfileId,
        }),
      );
    expect(minimalStructures).toHaveLength(96);
    expect(new Set(minimalStructures).size).toBeGreaterThan(1);
    expect(canonicalValueString(fixture.planningInput.draft)).toBe(draftBefore);
  });

  it("fails the bounded inventory at the dynamic-commerce profile/context boundary", () => {
    const { authority } = currentAuthority();
    const dynamic = authority.planningInput.draft.dynamicCommercePresentation;
    if (!dynamic) throw new Error("Expected current dynamic-commerce authority.");
    const diagnostic = inspectCompatibleCoordinatedDirectionCandidateInventory({
      ...authority,
      planningInput: {
        ...authority.planningInput,
        draft: {
          ...authority.planningInput.draft,
          dynamicCommercePresentation: { ...dynamic, collectionSearchArchetypes: [] },
        },
      },
    });
    expect(diagnostic.finalCandidateCount).toBe(0);
    expect(diagnostic.firstEmptyStage).toBe("dynamic-commerce-profile-context");
    expect(
      diagnostic.stages.find(({ stage }) => stage === "dynamic-commerce-profile-context"),
    ).toMatchObject({
      enteringCandidateCount: 540,
      remainingCandidateCount: 0,
      eliminationReasons: [
        { reasonCode: "incompatible-dynamic-commerce-profile-context", count: 540 },
      ],
    });
  });

  it("retains explicit canonical defaults when no requested factor option matches", () => {
    for (const directionId of [
      "premium-editorial",
      "modern-technical",
      "minimal-commerce",
    ] as const) {
      const direction = getCoordinatedStorefrontDirection(directionId);
      expect(direction.constraints.narrativePostures).toContain(
        direction.constraints.postureDefaults.narrativePosture,
      );
      expect(direction.constraints.merchandisingPostures).toContain(
        direction.constraints.postureDefaults.merchandisingPosture,
      );
      expect(direction.constraints.informationDensityPostures).toContain(
        direction.constraints.postureDefaults.informationDensityPosture,
      );
      expect(direction.constraints.artDirectionPostures).toContain(
        direction.constraints.postureDefaults.artDirectionPosture,
      );
      expect(direction.constraints.responsiveModes).toContain(
        direction.constraints.postureDefaults.responsiveMode,
      );
    }
  });

  it("resolves an explicit registered factor tuple with a fresh exact selection identity", () => {
    const { authority } = currentAuthority();
    const factorizedCandidate = listCompatibleCoordinatedDirectionFactorizedCandidates(authority, {
      directionId: "premium-editorial",
    })[0];
    if (!factorizedCandidate) throw new Error("Expected a Premium Editorial factorized candidate.");
    const factors: CompatibleCoordinatedDirectionPostureFactors = {
      narrativePosture: factorizedCandidate.narrativePostureOptions.at(-1)!,
      merchandisingPosture: factorizedCandidate.merchandisingPostureOptions.at(-1)!,
      informationDensityPosture: factorizedCandidate.informationDensityPostureOptions.at(-1)!,
      artDirectionPosture: factorizedCandidate.artDirectionPostureOptions.at(-1)!,
      responsiveMode: factorizedCandidate.responsiveModeOptions.at(-1)!,
    };
    const resolved = resolveCompatibleCoordinatedDirectionPostureFactors({
      factorizedCandidate,
      factors,
    });
    const backboneExact = exactMaterial(factorizedCandidate.backbone);
    const resolvedExact = exactMaterial(resolved);

    expect(resolved).toMatchObject(factors);
    expect(resolvedExact).toEqual({ ...backboneExact, ...factors });
    expect(resolved.selectionId).not.toBe(factorizedCandidate.backbone.selectionId);
    expect(resolved.selectionId).toBe(
      `direction-selection-${canonicalValueFingerprint(resolvedExact)}`,
    );
    expect(
      isCurrentCompatibleCoordinatedDirectionExactSelection({
        authority,
        exactSelection: resolvedExact,
      }),
    ).toBe(true);
  });

  it("fails closed for unregistered factors and stale factor option authority", () => {
    const { authority } = currentAuthority();
    const factorizedCandidate = listCompatibleCoordinatedDirectionFactorizedCandidates(authority, {
      directionId: "premium-editorial",
    })[0];
    if (!factorizedCandidate) throw new Error("Expected a Premium Editorial factorized candidate.");
    const factors: CompatibleCoordinatedDirectionPostureFactors = {
      narrativePosture: factorizedCandidate.backbone.narrativePosture,
      merchandisingPosture: factorizedCandidate.backbone.merchandisingPosture,
      informationDensityPosture: factorizedCandidate.backbone.informationDensityPosture,
      artDirectionPosture: factorizedCandidate.backbone.artDirectionPosture,
      responsiveMode: factorizedCandidate.backbone.responsiveMode,
    };

    expect(() =>
      resolveCompatibleCoordinatedDirectionPostureFactors({
        factorizedCandidate,
        factors: { ...factors, narrativePosture: "catalogue-dense" },
      }),
    ).toThrow(expect.objectContaining({ code: "unsupported-characteristic" }));

    expect(() =>
      resolveCompatibleCoordinatedDirectionPostureFactors({
        factorizedCandidate: {
          ...factorizedCandidate,
          narrativePostureOptions: [factorizedCandidate.backbone.narrativePosture],
        },
        factors,
      }),
    ).toThrow(expect.objectContaining({ code: "stale-direction-authority" }));
  });
});
