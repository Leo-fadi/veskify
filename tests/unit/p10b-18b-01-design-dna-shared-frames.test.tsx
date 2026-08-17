// @vitest-environment node

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  COMPATIBLE_COORDINATED_DIRECTION_POSTURE_FACTOR_AUTHORITY_VERSION,
  listCompatibleCoordinatedDirectionFactorizedCandidates,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "@/application/bounded-storefront-synthesis";
import {
  compileCommercialSharedFrameSelection,
  currentCommercialSharedFrameSelection,
} from "@/application/commercial-shared-frame";
import {
  compileSemanticStorefrontDesignIntentV1,
  executeCompiledSemanticStorefrontDesignIntentV1,
} from "@/application/prompted-storefront-design-compiler";
import { registeredBrandSystemForDirection } from "@/application/storefront-design-system";
import {
  getCommercialContentSupportProfile,
  getCommercialUtilityProfile,
  getExecutablePageBlueprintProfile,
} from "@/application/storefront-templates";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";
import type { CommerceUtilityRuntimeState } from "@/domain/commerce-utility";
import {
  designDnaFingerprint,
  designDnaSchema,
  designDnaVersion,
  projectDesignDna,
  resolveBrandSystemDesignDna,
  type DesignDna,
} from "@/domain/design-system";
import {
  COMMERCIAL_SHARED_FRAME_AUTHORITY_VERSION,
  canonicalValueFingerprint,
  canonicalValueString,
  commercialSharedFrameProfiles,
  getCommercialSharedFrameProfile,
} from "@/domain/storefront";
import {
  compileP10b18aAuditCase,
  createP10b18aShapeAuthorities,
  p10b18aSemanticVariations,
  type P10b18aShapeAuthority,
} from "../helpers/p10b-18a-commercial-authority";
import {
  semanticIntentFixture,
  type SemanticDriverOverrides,
} from "../fixtures/p10b-16p-04-semantic-intent";

type SemanticCapabilityCandidate =
  P10b18aShapeAuthority["semanticCapabilityIndex"]["candidates"][number];

const densityCases = [
  {
    directionId: "premiumEditorial",
    frameId: "editorial-masthead",
    pairs: [
      { semanticDensity: "balanced", spacingDensity: "standard", posture: "balanced" },
      { semanticDensity: "low", spacingDensity: "spacious", posture: "airy" },
    ],
  },
  {
    directionId: "modernTechnical",
    frameId: "compact-technical",
    pairs: [
      { semanticDensity: "high", spacingDensity: "compact", posture: "compact" },
      { semanticDensity: "balanced", spacingDensity: "standard", posture: "balanced" },
    ],
  },
  {
    directionId: "warmApproachable",
    frameId: "centered-minimal",
    pairs: [
      { semanticDensity: "balanced", spacingDensity: "standard", posture: "balanced" },
      { semanticDensity: "low", spacingDensity: "spacious", posture: "airy" },
    ],
  },
] as const;

const projectedGeometryBySpacingDensity = {
  compact: {
    "--brand-spacing-scale": "0.875",
    "--brand-section-rhythm": "clamp(2.5rem, 5vw, 4rem)",
    "--brand-page-gutter": "clamp(1rem, 3vw, 2rem)",
    "--brand-grid-gap": "0.75rem",
    "--brand-card-inset": "0.75rem",
    "--brand-control-height": "2.5rem",
    "--brand-control-padding-inline": "0.75rem",
    "--brand-density-global": "0.86",
    "--brand-density-navigation": "0.86",
    "--brand-density-content": "0.86",
    "--brand-density-commerce": "0.86",
  },
  standard: {
    "--brand-spacing-scale": "1",
    "--brand-section-rhythm": "clamp(4rem, 8vw, 7rem)",
    "--brand-page-gutter": "clamp(1rem, 5vw, 5rem)",
    "--brand-grid-gap": "1.5rem",
    "--brand-card-inset": "1.25rem",
    "--brand-control-height": "2.75rem",
    "--brand-control-padding-inline": "1rem",
    "--brand-density-global": "1",
    "--brand-density-navigation": "1",
    "--brand-density-content": "1",
    "--brand-density-commerce": "1",
  },
  spacious: {
    "--brand-spacing-scale": "1.2",
    "--brand-section-rhythm": "clamp(5.5rem, 10vw, 9rem)",
    "--brand-page-gutter": "clamp(1.25rem, 7vw, 7rem)",
    "--brand-grid-gap": "2.25rem",
    "--brand-card-inset": "2rem",
    "--brand-control-height": "3.25rem",
    "--brand-control-padding-inline": "1.5rem",
    "--brand-density-global": "1.16",
    "--brand-density-navigation": "1.16",
    "--brand-density-content": "1.16",
    "--brand-density-commerce": "1",
  },
} as const;

let cachedAuditAuthority: P10b18aShapeAuthority | undefined;

function auditAuthority(): P10b18aShapeAuthority {
  cachedAuditAuthority ??= createP10b18aShapeAuthorities(["medium-mixed-jewellery"]).find(
    ({ id }) => id === "medium-mixed-jewellery",
  );
  if (!cachedAuditAuthority) throw new Error("Expected the retained mixed-catalogue audit shape.");
  return cachedAuditAuthority;
}

function fixedPageProfileFrameBackbone(selection: BoundedStorefrontSynthesisSelectionNarrowing) {
  const {
    selectionId: _selectionId,
    designSystemSpacingDensity: _designSystemSpacingDensity,
    informationDensityPosture: _informationDensityPosture,
    ...fixed
  } = selection;
  void _selectionId;
  void _designSystemSpacingDensity;
  void _informationDensityPosture;
  return fixed;
}

function exactDensityPair(
  candidates: readonly SemanticCapabilityCandidate[],
  input: (typeof densityCases)[number],
) {
  const byBackbone = new Map<string, SemanticCapabilityCandidate[]>();
  for (const candidate of candidates.filter(
    ({ selection }) =>
      selection.directionId === input.directionId &&
      selection.sharedFrameProfileId === input.frameId,
  )) {
    const key = canonicalValueString(fixedPageProfileFrameBackbone(candidate.selection));
    byBackbone.set(key, [...(byBackbone.get(key) ?? []), candidate]);
  }
  const group = [...byBackbone.values()].find(
    (entries) =>
      entries.length === input.pairs.length &&
      input.pairs.every(({ semanticDensity, spacingDensity, posture }) =>
        entries.some(
          ({ selection, semanticFeatures }) =>
            selection.designSystemSpacingDensity === spacingDensity &&
            selection.informationDensityPosture === posture &&
            canonicalValueString(semanticFeatures["globalVisualIntent.density"]) ===
              canonicalValueString([semanticDensity]),
        ),
      ),
  );
  if (!group) {
    throw new Error(
      `${input.directionId}/${input.frameId} lacks an exact fixed-backbone density pair.`,
    );
  }
  return input.pairs.map(({ semanticDensity, spacingDensity, posture }) => {
    const candidate = group.find(
      ({ selection, semanticFeatures }) =>
        selection.designSystemSpacingDensity === spacingDensity &&
        selection.informationDensityPosture === posture &&
        canonicalValueString(semanticFeatures["globalVisualIntent.density"]) ===
          canonicalValueString([semanticDensity]),
    );
    if (!candidate) throw new Error(`Missing exact ${semanticDensity} density authority.`);
    return candidate;
  });
}

function nonColourDesignDna(dna: DesignDna) {
  const { colour: _colour, version: _version, ...nonColour } = dna;
  void _colour;
  void _version;
  return nonColour;
}

function compileSemanticIntent(
  authority: P10b18aShapeAuthority,
  overrides: SemanticDriverOverrides,
) {
  const providerIntent = semanticIntentFixture(authority.request, {
    designConceptSummary: `P10B-18B-01 ${overrides.commercialPosture ?? "bounded"} proof`,
    ...overrides,
  });
  const result = compileSemanticStorefrontDesignIntentV1({
    originalRequest: authority.request,
    providerIntent,
    currentRequestInput: authority.currentRequestInput,
    compatibilityInput: authority.compatibilityInput,
    semanticCapabilityIndex: authority.semanticCapabilityIndex,
    preparedAuthority: authority.preparedAuthority,
  });
  return { providerIntent, result };
}

function protectedMediaFingerprint(catalogue: P10b18aShapeAuthority["catalogue"]) {
  return canonicalValueFingerprint(
    catalogue.products.map(({ id, images, variants }) => ({
      id,
      images,
      variants: variants.map(({ id: variantId, attributes }) => ({
        id: variantId,
        attributes,
      })),
    })),
  );
}

function compileFrame(profileId: (typeof commercialSharedFrameProfiles)[number]["id"]) {
  return compileCommercialSharedFrameSelection({
    snapshot: aurumNordicSeed.draftSnapshot,
    catalogue: aurumNordicSeed.catalogue,
    selection: currentCommercialSharedFrameSelection(profileId),
  }).snapshot;
}

function compactUtilityRuntime(profileId: string): CommerceUtilityRuntimeState | undefined {
  const common = { revision: `${profileId}-compact-frame-r1`, actions: [] };
  if (profileId === "commerce-utility-checkout") {
    return { ...common, kind: "checkout", boundaryLabel: { en: "Checkout", fi: "Kassa" } };
  }
  if (profileId === "commerce-utility-empty") {
    return { ...common, kind: "empty", message: { en: "Empty", fi: "Tyhjä" } };
  }
  if (profileId === "commerce-utility-not-found") return { ...common, kind: "not-found" };
  return undefined;
}

describe("P10B-18B-01 Design DNA and shared-frame authority", () => {
  it("retains Design DNA v1 and the exact four shared-frame identities", () => {
    expect(designDnaVersion).toBe("1.0.0");
    expect(Object.keys(designDnaSchema.shape)).toEqual([
      "version",
      "colour",
      "typography",
      "spacing",
      "surfaces",
      "controls",
      "density",
      "media",
    ]);
    expect(COMMERCIAL_SHARED_FRAME_AUTHORITY_VERSION).toBe("1.0.0");
    expect(
      commercialSharedFrameProfiles.map(({ authorityFingerprint: _fingerprint, ...profile }) => {
        void _fingerprint;
        return profile;
      }),
    ).toEqual([
      {
        id: "editorial-masthead",
        version: "1.0.0",
        title: "Editorial masthead",
        desktopComposition: "brand-led-masthead",
        headerVariant: "editorial",
        footerVariant: "editorial",
        mobileNavigationMode: "drawer",
        footerComposition: "brand-editorial",
        serviceStrip: "canonical-footer-navigation",
        searchPlacement: "overlay",
        semanticRegions: [
          "service",
          "brand",
          "primaryNavigation",
          "search",
          "cart",
          "locale",
          "mobileNavigation",
          "footerNavigation",
        ],
        responsiveTransformationIds: ["editorial-to-drawer", "editorial-footer-stack"],
      },
      {
        id: "commerce-utility",
        version: "1.0.0",
        title: "Commerce utility-led",
        desktopComposition: "utility-led-grid",
        headerVariant: "split",
        footerVariant: "expanded",
        mobileNavigationMode: "stacked-disclosure",
        footerComposition: "service-navigation",
        serviceStrip: "canonical-footer-navigation",
        searchPlacement: "primary",
        semanticRegions: [
          "service",
          "brand",
          "primaryNavigation",
          "utilityNavigation",
          "search",
          "cart",
          "locale",
          "mobileNavigation",
          "footerNavigation",
        ],
        responsiveTransformationIds: ["utility-to-disclosure", "service-footer-stack"],
      },
      {
        id: "centered-minimal",
        version: "1.0.0",
        title: "Centered minimal brand",
        desktopComposition: "centered-brand-stack",
        headerVariant: "centered",
        footerVariant: "columns",
        mobileNavigationMode: "compact-overlay",
        footerComposition: "navigation-columns",
        serviceStrip: "none",
        searchPlacement: "utility",
        semanticRegions: [
          "brand",
          "primaryNavigation",
          "search",
          "cart",
          "locale",
          "mobileNavigation",
          "footerNavigation",
        ],
        responsiveTransformationIds: ["centered-to-overlay", "column-footer-stack"],
      },
      {
        id: "compact-technical",
        version: "1.0.0",
        title: "Compact technical navigation",
        desktopComposition: "compact-navigation-rail",
        headerVariant: "compact",
        footerVariant: "compact",
        mobileNavigationMode: "drawer",
        footerComposition: "compact-commerce-legal",
        serviceStrip: "none",
        searchPlacement: "compact",
        semanticRegions: [
          "brand",
          "primaryNavigation",
          "utilityNavigation",
          "search",
          "cart",
          "locale",
          "mobileNavigation",
          "footerNavigation",
        ],
        responsiveTransformationIds: ["technical-to-drawer", "compact-footer-wrap"],
      },
    ]);
    for (const profile of commercialSharedFrameProfiles) {
      const { authorityFingerprint, ...material } = profile;
      expect(authorityFingerprint).toBe(`shared-frame-${canonicalValueFingerprint(material)}`);
    }
  });

  it("binds two exact density requests per direction to different non-colour DNA and CSS geometry on one page/profile/frame backbone", () => {
    const authority = auditAuthority();
    expect(authority.semanticCapabilityIndex.mappingAuthorityVersion).toBe("1.3.0");
    expect(COMPATIBLE_COORDINATED_DIRECTION_POSTURE_FACTOR_AUTHORITY_VERSION).toBe("1.1.0");

    for (const densityCase of densityCases) {
      const pair = exactDensityPair(authority.semanticCapabilityIndex.candidates, densityCase);
      expect(pair.map(({ selection }) => fixedPageProfileFrameBackbone(selection))).toEqual([
        fixedPageProfileFrameBackbone(pair[0].selection),
        fixedPageProfileFrameBackbone(pair[0].selection),
      ]);
      const materialized = pair.map((candidate) => {
        const selection = candidate.selection;
        const brandSystem = registeredBrandSystemForDirection(
          authority.currentRequestInput.draft.brandSystem,
          authority.compatibilityInput.planningInput.recipeContext.designSystem,
          selection.directionId,
          {
            spacingDensity: selection.designSystemSpacingDensity,
            surfaceDepth: selection.designSystemSurfaceDepth,
          },
        );
        const dna = resolveBrandSystemDesignDna(brandSystem);
        const projection = projectDesignDna(dna, brandSystem.typography.baseSize);
        expect(candidate.exactAxes["design-dna"]).toBe(canonicalValueFingerprint(dna));
        expect(candidate.exactAxes["spacing-density"]).toBe(
          canonicalValueFingerprint({
            designSystemSpacingDensity: selection.designSystemSpacingDensity,
            spacing: dna.spacing,
            controls: { height: dna.controls.height, density: dna.controls.density },
            density: dna.density,
          }),
        );
        expect(projection.designDnaFingerprint).toBe(designDnaFingerprint(dna));
        expect(projection.cssVariables).toMatchObject(
          projectedGeometryBySpacingDensity[selection.designSystemSpacingDensity],
        );
        return { dna, projection };
      });

      expect(materialized[0].dna.colour).toEqual(materialized[1].dna.colour);
      expect(nonColourDesignDna(materialized[0].dna)).not.toEqual(
        nonColourDesignDna(materialized[1].dna),
      );
      expect(materialized[0].projection.fingerprint).not.toBe(
        materialized[1].projection.fingerprint,
      );
    }
  });

  it("selects all four exact frames from navigation intent and substitutes unsupported Minimal high density", () => {
    const authority = auditAuthority();
    const catalogueBefore = canonicalValueString(authority.catalogue);
    const mediaBefore = protectedMediaFingerprint(authority.catalogue);
    const baselinePalette = resolveBrandSystemDesignDna(
      authority.currentRequestInput.draft.brandSystem,
    ).colour;
    const scenarios = [
      ["premium-story-image", "editorial-masthead"],
      ["technical-catalogue-dense", "compact-technical"],
      ["technical-conversion-contained", "commerce-utility"],
      ["minimal-product-first", "centered-minimal"],
    ] as const;
    const results = scenarios.map(([variationId, expectedFrame]) => {
      const variation = p10b18aSemanticVariations.find(({ id }) => id === variationId);
      if (!variation) throw new Error(`Missing retained semantic variation ${variationId}.`);
      const result = compileP10b18aAuditCase(authority, variation);
      expect(result.compiledDecision.sharedFrame.profileId).toBe(expectedFrame);
      expect(result.synthesisDecision.sharedFrame.profileId).toBe(expectedFrame);
      expect(result.compiledDecision.semanticResolution?.acceptedSemanticPaths).toContain(
        "sharedFrameIntent.navigationPosture",
      );
      expect(result.compiledDecision.designDna.value.colour).toEqual(baselinePalette);
      return result;
    });
    expect(results.map(({ compiledDecision }) => compiledDecision.sharedFrame.profileId)).toEqual([
      "editorial-masthead",
      "compact-technical",
      "commerce-utility",
      "centered-minimal",
    ]);

    const minimal = p10b18aSemanticVariations.find(({ id }) => id === "minimal-product-first");
    if (!minimal) throw new Error("Missing retained Minimal semantic variation.");
    const unsupportedHigh = compileSemanticIntent(authority, {
      ...minimal.drivers,
      density: "high",
    });
    expect(unsupportedHigh.result.compiledDecision.exactSelection).toMatchObject({
      directionId: "warmApproachable",
      designSystemSpacingDensity: "standard",
      informationDensityPosture: "balanced",
      sharedFrameProfileId: "centered-minimal",
    });
    expect(
      unsupportedHigh.result.compiledDecision.semanticResolution?.substitutedSemanticPaths,
    ).toContain("globalVisualIntent.density");
    expect(
      projectDesignDna(unsupportedHigh.result.compiledDecision.designDna.value).cssVariables,
    ).toMatchObject(projectedGeometryBySpacingDensity.standard);

    expect(canonicalValueString(authority.catalogue)).toBe(catalogueBefore);
    expect(protectedMediaFingerprint(authority.catalogue)).toBe(mediaBefore);

    const compactVariation = p10b18aSemanticVariations.find(
      ({ id }) => id === "technical-catalogue-dense",
    );
    if (!compactVariation) throw new Error("Missing retained compact semantic variation.");
    const compact = compileSemanticIntent(authority, compactVariation.drivers);
    const executed = executeCompiledSemanticStorefrontDesignIntentV1({
      originalRequest: authority.request,
      providerIntent: compact.providerIntent,
      currentRequestInput: authority.currentRequestInput,
      compatibilityInput: authority.compatibilityInput,
      semanticCapabilityIndex: authority.semanticCapabilityIndex,
      preparedAuthority: authority.preparedAuthority,
      compiledDecision: compact.result.compiledDecision,
      synthesisDecision: compact.result.synthesisDecision,
      pageEvidenceAuthority: authority.pageEvidenceAuthority,
      contentFactAuthority: authority.contentFactAuthority,
      approvedAssetPresentations: authority.approvedAssetPresentations,
    });
    const snapshot = executed.synthesis.materialization.snapshot;
    expect(resolveBrandSystemDesignDna(snapshot.brandSystem)).toEqual(
      compact.result.compiledDecision.designDna.value,
    );
    expect(snapshot.sharedFrame).toMatchObject(compact.result.compiledDecision.sharedFrame);
    for (const profileId of [
      "content-about-story",
      "commerce-utility-checkout",
      "commerce-utility-empty",
      "commerce-utility-not-found",
    ] as const) {
      const page = snapshot.pages.find(({ pageFamily }) => pageFamily?.profileId === profileId);
      if (!page) throw new Error(`The compact complete store is missing ${profileId}.`);
      const markup = renderToStaticMarkup(
        renderStorefrontPage(
          page,
          createStorefrontRenderContext({
            activeLocale: "en",
            primaryLocale: "en",
            catalogue: authority.catalogue,
            snapshot,
            evidenceReferences: page.pageFamily?.evidenceReferences ?? [],
            commerceUtilityRuntime: compactUtilityRuntime(profileId),
          }),
        ),
      );
      expect(markup).toContain('data-frame-profile="compact-technical"');
      expect(markup).toMatch(/<main[^>]*>.+<\/main>/su);
    }
    expect(canonicalValueString(executed.synthesis.materialization.planningInput.catalogue)).toBe(
      catalogueBefore,
    );
    expect(
      protectedMediaFingerprint(executed.synthesis.materialization.planningInput.catalogue),
    ).toBe(mediaBefore);
  }, 120_000);

  it("reports commercial dependencies and derives mobile hierarchy from registered frame authority", () => {
    const index = auditAuthority().semanticCapabilityIndex;
    const expectedHierarchy = {
      "editorial-masthead": "story-led",
      "commerce-utility": "conversion-led",
      "centered-minimal": "balanced",
      "compact-technical": "product-led",
    } as const;
    for (const candidate of index.candidates) {
      const frame = getCommercialSharedFrameProfile(candidate.selection.sharedFrameProfileId);
      expect(candidate.semanticFeatures["responsiveAndArtDirectionIntent.mobileHierarchy"]).toEqual(
        [expectedHierarchy[frame.id]],
      );
      expect(candidate.exactAxes["frame-responsive-authority"]).toBe(
        canonicalValueFingerprint({
          profileId: frame.id,
          mobileNavigationMode: frame.mobileNavigationMode,
          responsiveTransformationIds: frame.responsiveTransformationIds,
        }),
      );
    }

    const mobile = index.semanticInfluenceAuthority.fields.find(
      ({ path }) => path === "responsiveAndArtDirectionIntent.mobileHierarchy",
    );
    const commercial = index.semanticInfluenceAuthority.fields.find(
      ({ path }) => path === "commercialPosture",
    );
    expect(commercial?.supportedValues).toEqual([
      "bold-campaign",
      "catalogue-comparison",
      "fast-conversion",
      "high-consideration",
      "minimal-commerce",
      "modern-technical",
      "premium-editorial",
      "warm-approachable",
    ]);
    expect(commercial?.relationships).toEqual([
      {
        exactAxisId: "direction-package",
        mode: "compound-driver",
        reasonCode: "coupled-axis-provider-driver",
        providerDriverPath: "commercialPosture",
        coupledExactAxisIds: ["merchandising-posture", "optional-page-set"],
        semanticValueCount: 8,
        exactValueCount: 3,
      },
      ...(["design-dna", "typography", "spacing-density", "shared-frame"] as const).map(
        (exactAxisId, index) => ({
          exactAxisId,
          mode: "substitution-only" as const,
          reasonCode: "correlated-candidate-substitution" as const,
          providerDriverPath: null,
          coupledExactAxisIds: [],
          semanticValueCount: 8,
          exactValueCount: [6, 3, 4, 4][index],
        }),
      ),
    ]);
    const navigation = index.semanticInfluenceAuthority.fields.find(
      ({ path }) => path === "sharedFrameIntent.navigationPosture",
    );
    expect(mobile?.relationships).toEqual([
      expect.objectContaining({
        exactAxisId: "frame-responsive-authority",
        mode: "compound-driver",
        reasonCode: "coupled-axis-provider-driver",
        providerDriverPath: "responsiveAndArtDirectionIntent.mobileHierarchy",
        coupledExactAxisIds: ["shared-frame"],
        semanticValueCount: 4,
        exactValueCount: 4,
      }),
    ]);
    expect(mobile?.relationships.some(({ exactAxisId }) => exactAxisId === "responsive-mode")).toBe(
      false,
    );
    expect(navigation?.relationships).toEqual([
      expect.objectContaining({
        exactAxisId: "shared-frame",
        mode: "direct",
        reasonCode: "independent-exact-axis",
        providerDriverPath: "sharedFrameIntent.navigationPosture",
        coupledExactAxisIds: [],
        semanticValueCount: 4,
        exactValueCount: 4,
      }),
    ]);

    for (const profile of commercialSharedFrameProfiles) {
      const snapshot = compileFrame(profile.id);
      const homepage = snapshot.pages.find(({ type }) => type === "home");
      if (!homepage) throw new Error("The frame fixture requires a homepage.");
      const markup = renderToStaticMarkup(
        renderStorefrontPage(
          homepage,
          createStorefrontRenderContext({
            activeLocale: "en",
            primaryLocale: "en",
            catalogue: aurumNordicSeed.catalogue,
            snapshot,
          }),
        ),
      );
      expect(markup).toContain(`data-frame-profile="${profile.id}"`);
      expect(markup).toContain(`data-mobile-navigation-mode="${profile.mobileNavigationMode}"`);
      expect(markup).toContain(
        `data-responsive-transformations="${profile.responsiveTransformationIds.join(" ")}"`,
      );
    }
  });

  it("admits compact through the four fixed blockers and the full required audit site map", () => {
    const about =
      getCommercialContentSupportProfile("content-about-story")?.profile?.commercialContentSupport;
    const checkout = getCommercialUtilityProfile("commerce-utility-checkout")?.profile
      ?.commercialUtility;
    const empty = getCommercialUtilityProfile("commerce-utility-empty")?.profile?.commercialUtility;
    const notFound = getCommercialUtilityProfile("commerce-utility-not-found")?.profile
      ?.commercialUtility;
    expect({
      "content-about-story": about?.compatibleSharedFrameProfileIds,
      "commerce-utility-checkout": checkout?.compatibleSharedFrameProfileIds,
      "commerce-utility-empty": empty?.compatibleSharedFrameProfileIds,
      "commerce-utility-not-found": notFound?.compatibleSharedFrameProfileIds,
    }).toEqual({
      "content-about-story": [
        "editorial-masthead",
        "centered-minimal",
        "commerce-utility",
        "compact-technical",
      ],
      "commerce-utility-checkout": [
        "commerce-utility",
        "centered-minimal",
        "editorial-masthead",
        "compact-technical",
      ],
      "commerce-utility-empty": [
        "centered-minimal",
        "editorial-masthead",
        "commerce-utility",
        "compact-technical",
      ],
      "commerce-utility-not-found": [
        "centered-minimal",
        "editorial-masthead",
        "commerce-utility",
        "compact-technical",
      ],
    });

    const authority = auditAuthority();
    expect(authority.siteMapDecision.pages.every(({ required }) => required)).toBe(true);
    expect(new Set(authority.siteMapDecision.pages.map(({ familyId }) => familyId))).toEqual(
      new Set([
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
        "about",
      ]),
    );
    const candidates = listCompatibleCoordinatedDirectionFactorizedCandidates(
      authority.compatibilityInput,
    );
    expect(new Set(candidates.map(({ backbone }) => backbone.sharedFrameProfileId))).toEqual(
      new Set(["editorial-masthead", "commerce-utility", "centered-minimal", "compact-technical"]),
    );
    const compact = candidates.filter(
      ({ backbone }) => backbone.sharedFrameProfileId === "compact-technical",
    );
    expect(compact.length).toBeGreaterThan(0);
    expect(
      compact.every(
        ({ backbone }) =>
          backbone.authorityId === "coordinated-direction:modern-technical" &&
          backbone.directionId === "modernTechnical" &&
          backbone.designSystemSurfaceDepth === "flat" &&
          backbone.informationDensityPosture ===
            (backbone.designSystemSpacingDensity === "compact" ? "compact" : "balanced"),
      ),
    ).toBe(true);
    for (const { backbone } of compact) {
      for (const page of authority.siteMapDecision.pages.filter(({ required }) => required)) {
        const selectedCoreProfiles: Readonly<Record<string, string>> = {
          home: backbone.homepageProfileId,
          collection: backbone.collectionProfileId,
          "search-results": backbone.searchProfileId,
          "product-detail": backbone.pdpProfileId,
        };
        const selectedProfileId = selectedCoreProfiles[page.familyId] ?? page.profile.id;
        const profile = getExecutablePageBlueprintProfile(selectedProfileId)?.profile;
        if (!profile) throw new Error(`Missing required executable profile ${selectedProfileId}.`);
        const compatibleFrames =
          profile.commercialHomepage?.compatibleSharedFrameProfileIds ??
          profile.commercialCollectionSearch?.compatibleSharedFrameProfileIds ??
          profile.commercialProductDetail?.compatibleSharedFrameProfileIds ??
          profile.commercialContentSupport?.compatibleSharedFrameProfileIds ??
          profile.commercialUtility?.compatibleSharedFrameProfileIds;
        expect(
          compatibleFrames === undefined || compatibleFrames.includes("compact-technical"),
        ).toBe(true);
      }
    }
  });

  it("retains every long navigation item and source-guards the repaired nav and footer geometry", () => {
    const snapshot = structuredClone(compileFrame("editorial-masthead"));
    const longLabels = [
      "New season jewellery",
      "Wedding and commitment rings",
      "Mechanical watches and accessories",
      "Materials and responsible sourcing",
    ];
    snapshot.navigation.primary.forEach((item, index) => {
      item.label = { en: longLabels[index] ?? `Collection navigation ${index + 1}` };
    });
    const homepage = snapshot.pages.find(({ type }) => type === "home");
    if (!homepage) throw new Error("The frame fixture requires a homepage.");
    const markup = renderToStaticMarkup(
      renderStorefrontPage(
        homepage,
        createStorefrontRenderContext({
          activeLocale: "en",
          primaryLocale: "en",
          catalogue: aurumNordicSeed.catalogue,
          snapshot,
        }),
      ),
    );
    const header = markup.slice(markup.indexOf("<header"), markup.indexOf("</header>"));
    for (const item of snapshot.navigation.primary) {
      const label = item.label.en;
      if (!label) throw new Error("The long-navigation fixture requires an English label.");
      expect(header.split(`>${label}<`)).toHaveLength(2);
    }

    const utilitySnapshot = compileFrame("commerce-utility");
    const utilityHomepage = utilitySnapshot.pages.find(({ type }) => type === "home");
    if (!utilityHomepage) throw new Error("The frame fixture requires a homepage.");
    const utilityMarkup = renderToStaticMarkup(
      renderStorefrontPage(
        utilityHomepage,
        createStorefrontRenderContext({
          activeLocale: "en",
          primaryLocale: "en",
          catalogue: aurumNordicSeed.catalogue,
          snapshot: utilitySnapshot,
        }),
      ),
    );
    const footer = utilityMarkup.slice(utilityMarkup.indexOf("<footer"));
    const footerRegionOrder = [
      footer.indexOf('data-frame-region="footer-information"'),
      footer.indexOf('data-frame-region="footer-brand"'),
      footer.indexOf('data-frame-region="footer-store-pages"'),
    ];
    expect(footerRegionOrder.every((index) => index >= 0)).toBe(true);
    expect(footerRegionOrder).toEqual([...footerRegionOrder].sort((left, right) => left - right));
    expect(footer).toContain("Helsinki · hello@aurumnordic.example");
    expect(footer).toContain("Delivery · Returns · Privacy");

    const sourceCss = readFileSync(
      new URL(
        "../../src/components/storefront/commercial-storefront-frame.module.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sourceCss).toMatch(
      /\.desktopFrame\[data-desktop-composition="brand-led-masthead"\] nav a\s*\{[^}]*max-width: 100%;[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;/s,
    );
    expect(sourceCss).toMatch(
      /\.desktopFrame\[data-desktop-composition="brand-led-masthead"\] nav ul\s*\{[^}]*flex-wrap: wrap;/s,
    );
    expect(sourceCss).toMatch(
      /\.footer\[data-footer-composition="service-navigation"\]\s*\{[^}]*grid-template-columns: minmax\(12rem, 0\.7fr\) minmax\(12rem, 0\.8fr\) minmax\(0, 2fr\);[^}]*padding-block: calc\(var\(--brand-section-rhythm, 4rem\) \* 0\.36\);/s,
    );
    expect(sourceCss).toMatch(
      /\.footer\[data-footer-composition="brand-editorial"\][^{]*\.footerBrand\s*:global\(\.store-brand\)\s*\{[^}]*max-width: 100%;[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;[^}]*word-break: normal;/s,
    );
    expect(sourceCss).toMatch(
      /\.footer\[data-footer-composition="compact-commerce-legal"\] a,[^{]*\.footer\[data-footer-composition="compact-commerce-legal"\] \.footerBrand p,[^{]*\.footer\[data-footer-composition="compact-commerce-legal"\] \.footerPolicy\s*\{[^}]*color: var\(--brand-surface-muted-text, var\(--brand-color-text\)\);/s,
    );
  });
});
