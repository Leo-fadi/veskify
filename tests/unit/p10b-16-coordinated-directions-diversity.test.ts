import { describe, expect, it } from "vitest";
import {
  COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
  CoordinatedStorefrontDirectionError,
  compareStorefrontDiversity,
  createCoordinatedDirectionSelection,
  createStorefrontDiversityFingerprintFromMaterial,
  executeCoordinatedDirectionAlternatives,
  listCoordinatedStorefrontDirections,
  storefrontDiversityMaterialFromDecision,
  validateCoordinatedStorefrontDirectionRegistry,
  type CoordinatedDirectionResult,
  type CoordinatedStorefrontDirectionId,
} from "@/application/bounded-storefront-synthesis";
import { getCommercialCollectionSearchProfile } from "@/application/storefront-templates";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { canonicalValueString } from "@/domain/storefront";

const source = createP10B14PremiumEditorialFixture();
const common = {
  planningInput: source.fixture.planningInput,
  siteMapDecision: source.siteMapDecision,
  approvedEvidenceReferences: source.approvedEvidenceReferences,
};
const execution = {
  ...common,
  pageEvidenceAuthority: source.pageEvidenceAuthority,
  contentFactAuthority: source.contentFactAuthority,
  approvedAssetPresentations: source.fixture.assetPresentations,
};
const batchCache = new Map<
  CoordinatedStorefrontDirectionId,
  readonly CoordinatedDirectionResult[]
>();

function authorityFor(directionId: CoordinatedStorefrontDirectionId) {
  const siteMapDecision = structuredClone(common.siteMapDecision);
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
  void directionId;
  return { ...common, siteMapDecision };
}

function alternatives(directionId: CoordinatedStorefrontDirectionId) {
  const cached = batchCache.get(directionId);
  if (cached) return cached;
  const created = executeCoordinatedDirectionAlternatives({
    ...execution,
    ...authorityFor(directionId),
    directionRequest: { directionId, deterministicSeed: "p10b16-representative" },
    count: 3,
  });
  batchCache.set(directionId, created);
  return created;
}

function baseMaterial() {
  const value = alternatives("premium-editorial")[0];
  return storefrontDiversityMaterialFromDecision({
    decision: value.decision,
    designDna: value.designDna,
    direction: value.direction,
  });
}

describe("P10B-16 governed coordinated direction authority", () => {
  it("1. registers exactly Premium Editorial, Modern Technical and Minimal Commerce", () => {
    expect(listCoordinatedStorefrontDirections().map(({ id }) => id)).toEqual([
      "premium-editorial",
      "modern-technical",
      "minimal-commerce",
    ]);
  });

  it("2. versions and fingerprints every direction package", () => {
    expect(
      listCoordinatedStorefrontDirections().every(
        ({ version, authorityFingerprint }) =>
          version === COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION &&
          authorityFingerprint.startsWith("coordinated-direction-"),
      ),
    ).toBe(true);
  });

  it("3. validates all current profile, frame and anatomy references", () => {
    expect(validateCoordinatedStorefrontDirectionRegistry()).toHaveLength(3);
  });

  it("4. rejects stale direction capability references and fingerprints", () => {
    const stale = structuredClone(listCoordinatedStorefrontDirections());
    stale[0].constraints.homepageProfileIds[0] = "homepage-does-not-exist" as never;
    expect(() => validateCoordinatedStorefrontDirectionRegistry(stale)).toThrow();
    const staleFingerprint = structuredClone(listCoordinatedStorefrontDirections());
    staleFingerprint[0].authorityFingerprint = "coordinated-direction-stale";
    expect(() => validateCoordinatedStorefrontDirectionRegistry(staleFingerprint)).toThrow();
  });

  it("5. narrows only registered P10B-15 authority", () => {
    for (const entry of listCoordinatedStorefrontDirections()) {
      const selection = createCoordinatedDirectionSelection({
        ...authorityFor(entry.id),
        request: { intent: entry.intent, deterministicSeed: "narrowing" },
        directionRequest: { directionId: entry.id, deterministicSeed: "narrowing" },
      });
      expect(entry.constraints.homepageProfileIds).toContain(
        selection.decision.commercialProfiles.homepageProfileId,
      );
      expect(entry.constraints.sharedFrameProfileIds).toContain(
        selection.decision.sharedFrame.profileId,
      );
      const searchNarrowing = getCommercialCollectionSearchProfile(
        selection.narrowing.searchProfileId,
      )?.profile?.commercialCollectionSearch?.designDnaNarrowing;
      expect(searchNarrowing?.spacingDensity).toContain(
        selection.narrowing.designSystemSpacingDensity,
      );
      expect(searchNarrowing?.surfaceDepth).toContain(selection.narrowing.designSystemSurfaceDepth);
      expect(selection.decision.decisions[0]?.code).toBe("governed-selection-narrowing");
    }
  });

  it("6. fails closed for a characteristic outside the selected direction", () => {
    expect(() =>
      createCoordinatedDirectionSelection({
        ...common,
        request: { intent: "editorial-led", deterministicSeed: "invalid" },
        directionRequest: {
          directionId: "premium-editorial",
          deterministicSeed: "invalid",
          characteristics: { homepageProfileId: "homepage-commerce-led-discovery" },
        },
      }),
    ).toThrow(CoordinatedStorefrontDirectionError);
  });

  it("7. produces several complete valid storefronts inside each direction", () => {
    for (const id of ["premium-editorial", "modern-technical", "minimal-commerce"] as const) {
      const values = alternatives(id);
      expect(values).toHaveLength(3);
      expect(
        values.every(({ synthesis }) => synthesis.materialization.snapshot.pages.length >= 5),
      ).toBe(true);
      expect(
        values.every(({ synthesis }) =>
          ["home", "collection", "search-results", "product-detail"].every((familyId) =>
            synthesis.materialization.snapshot.pages.some(
              ({ pageFamily }) => pageFamily?.familyId === familyId,
            ),
          ),
        ),
      ).toBe(true);
    }
  });

  it("8. prevents every direction from collapsing to one fixed template", () => {
    for (const id of ["premium-editorial", "modern-technical", "minimal-commerce"] as const) {
      const values = alternatives(id);
      expect(new Set(values.map(({ diversity }) => diversity.structuralFingerprint)).size).toBe(3);
      expect(
        new Set(values.map(({ synthesis }) => synthesis.materialization.snapshotFingerprint)).size,
      ).toBe(3);
    }
  });

  it("9. is deterministic for identical authority, direction and seed", () => {
    const request = {
      directionId: "modern-technical" as const,
      deterministicSeed: "same-authority",
    };
    const first = createCoordinatedDirectionSelection({
      ...common,
      request: { intent: "commerce-led", deterministicSeed: request.deterministicSeed },
      directionRequest: request,
    });
    const second = createCoordinatedDirectionSelection({
      ...common,
      request: { intent: "commerce-led", deterministicSeed: request.deterministicSeed },
      directionRequest: request,
    });
    expect(second.narrowing).toEqual(first.narrowing);
    expect(second.diversity).toEqual(first.diversity);
  });

  it("10. never mutates protected commerce, approved evidence or canonical product media", () => {
    const commerce = canonicalValueString(common.planningInput.catalogue);
    const evidence = canonicalValueString(common.approvedEvidenceReferences);
    const media = canonicalValueString(
      common.planningInput.catalogue.products.map(({ images }) => images),
    );
    alternatives("modern-technical");
    expect(canonicalValueString(common.planningInput.catalogue)).toBe(commerce);
    expect(canonicalValueString(common.approvedEvidenceReferences)).toBe(evidence);
    expect(
      canonicalValueString(common.planningInput.catalogue.products.map(({ images }) => images)),
    ).toBe(media);
  });
});

describe("P10B-16 deterministic diversity analysis", () => {
  it("11. detects exact duplicate configurations", () => {
    const value = alternatives("premium-editorial")[0].diversity;
    expect(compareStorefrontDiversity(value, structuredClone(value)).classification).toBe(
      "exact-duplicate",
    );
  });

  it("12. treats a colour-only difference as palette-only, not architectural diversity", () => {
    const material = baseMaterial();
    const recoloured = {
      ...structuredClone(material),
      designDna: {
        ...structuredClone(material.designDna),
        colour: { ...structuredClone(material.designDna.colour), accent: "#123456" },
      },
    };
    const first = createStorefrontDiversityFingerprintFromMaterial(material);
    const second = createStorefrontDiversityFingerprintFromMaterial(recoloured);
    expect(compareStorefrontDiversity(first, second)).toMatchObject({
      classification: "palette-only",
      changedDimensions: [],
    });
  });

  it("13. detects a shallow component-only swap", () => {
    const material = baseMaterial();
    const changed = {
      ...structuredClone(material),
      componentAnatomies: material.componentAnatomies.map((component, index) =>
        index === 0 ? { ...component, variant: `${component.variant}-shallow` } : component,
      ),
    };
    expect(
      compareStorefrontDiversity(
        createStorefrontDiversityFingerprintFromMaterial(material),
        createStorefrontDiversityFingerprintFromMaterial(changed),
      ).classification,
    ).toBe("shallow-component-swap");
  });

  it("14. detects near-duplicate architecture", () => {
    const material = baseMaterial();
    const changed = {
      ...structuredClone(material),
      artDirection: `${material.artDirection}-alternate`,
      density: `${material.density}-alternate`,
    };
    expect(
      compareStorefrontDiversity(
        createStorefrontDiversityFingerprintFromMaterial(material),
        createStorefrontDiversityFingerprintFromMaterial(changed),
      ).classification,
    ).toBe("near-duplicate");
  });

  it("15. registers meaningful profile/frame architecture as material diversity", () => {
    const material = baseMaterial();
    const changed = {
      ...structuredClone(material),
      sharedFrame: { ...material.sharedFrame, profileId: "different-frame" },
      pageProfiles: material.pageProfiles.map((profile, index) =>
        index === 0 ? { ...profile, profileId: "different-profile" } : profile,
      ),
      componentAnatomies: material.componentAnatomies.map((component, index) =>
        index === 0 ? { ...component, anatomyId: "different-anatomy" } : component,
      ),
    };
    expect(
      compareStorefrontDiversity(
        createStorefrontDiversityFingerprintFromMaterial(material),
        createStorefrontDiversityFingerprintFromMaterial(changed),
      ).classification,
    ).toBe("materially-different");
  });

  it("16. fingerprints Design DNA, page set/profile, anatomy, parameters, art, density and narrative independently", () => {
    const dimensions = alternatives("minimal-commerce")[0].diversity.dimensions;
    expect(Object.keys(dimensions)).toEqual([
      "designDna",
      "pageSet",
      "pageProfiles",
      "sharedFrame",
      "componentAnatomies",
      "boundedParameters",
      "artDirection",
      "density",
      "narrative",
      "responsive",
    ]);
    expect(new Set(Object.values(dimensions)).size).toBe(10);
  });

  it("17. distinguishes every pair of canonical directions structurally without using palette", () => {
    const premium = alternatives("premium-editorial")[0].diversity;
    const technical = alternatives("modern-technical")[0].diversity;
    const minimal = alternatives("minimal-commerce")[0].diversity;
    expect(compareStorefrontDiversity(premium, technical).classification).toBe(
      "materially-different",
    );
    expect(compareStorefrontDiversity(technical, minimal).classification).toBe(
      "materially-different",
    );
    expect(compareStorefrontDiversity(minimal, premium).classification).toBe(
      "materially-different",
    );
  });

  it("18. repetition avoidance selects unused material configurations", () => {
    const values = alternatives("premium-editorial");
    for (let index = 1; index < values.length; index += 1) {
      expect(
        compareStorefrontDiversity(values[index - 1].diversity, values[index].diversity)
          .classification,
      ).toBe("materially-different");
    }
  });

  it("19. impossible novelty fails closed instead of bypassing validation", () => {
    const first = alternatives("minimal-commerce")[0];
    const used = [first.diversity];
    expect(() =>
      createCoordinatedDirectionSelection({
        ...authorityFor("minimal-commerce"),
        request: { intent: "restrained-minimal", deterministicSeed: "p10b16-representative" },
        directionRequest: {
          directionId: "minimal-commerce",
          deterministicSeed: "p10b16-representative",
          characteristics: {
            homepageProfileId: first.narrowing.homepageProfileId,
            collectionProfileId: first.narrowing.collectionProfileId,
            pdpProfileId: first.narrowing.pdpProfileId,
            includedOptionalPageFamilyIds: first.narrowing.includedOptionalPageFamilyIds,
            narrativePosture: first.narrowing.narrativePosture,
            merchandisingPosture: first.narrowing.merchandisingPosture,
            informationDensityPosture: first.narrowing.informationDensityPosture,
            artDirectionPosture: first.narrowing.artDirectionPosture,
            responsiveMode: first.narrowing.responsiveMode,
          },
        },
        usedDiversityFingerprints: used,
      }),
    ).toThrow(CoordinatedStorefrontDirectionError);
  });
});
