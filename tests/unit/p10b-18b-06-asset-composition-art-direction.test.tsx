// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  approvedGenerationAssetSchema,
  resolveApprovedAssetPlacement,
} from "@/application/ai-storefront-generation";
import { materializeCompleteStorefrontSelection } from "@/application/whole-storefront-generation-plan";
import type { WholeStorefrontGenerationPlanError } from "@/application/whole-storefront-generation-plan";
import { resolveApprovedAssetPresentationForPlacement } from "@/application/whole-storefront-proposal-lifecycle";
import {
  compileSemanticStorefrontDesignIntentV1,
  deriveSemanticCapabilityIndex,
  executeCompiledSemanticStorefrontDesignIntentV1,
  prepareSemanticStorefrontDesignCompilationAuthority,
} from "@/application/prompted-storefront-design-compiler";
import {
  createPromptedStorefrontDesignRequestV2,
  createSemanticStorefrontDesignRequestV1,
  semanticStorefrontCurrentAuthorityFingerprint,
} from "@/application/prompted-storefront-design-intent";
import { resolveResponsiveImage } from "@/application/responsive-image-authority";
import { ResponsiveStorefrontImage } from "@/components/storefront/responsive-storefront-image";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { createP10B16P04RawAurumCommercialFixture } from "@/data/demo/p10b-16p-04-commercial-acceptance";
import { canonicalValueString, storefrontSnapshotSchema } from "@/domain/storefront";
import { createP10b18aShapeAuthorities } from "../helpers/p10b-18a-commercial-authority";
import { semanticIntentFixture } from "../fixtures/p10b-16p-04-semantic-intent";

function aurumAuthority() {
  const authority = createP10b18aShapeAuthorities(["aurum-approved-presentation-image-rich"])[0];
  if (!authority) throw new Error("Missing enriched Aurum audit authority.");
  return authority;
}

const executionByImageProminence = new Map<
  "balanced" | "image-led",
  ReturnType<typeof executeImageProminenceUncached>
>();

function executeImageProminence(imageProminence: "balanced" | "image-led") {
  const cached = executionByImageProminence.get(imageProminence);
  if (cached) return cached;
  const execution = executeImageProminenceUncached(imageProminence);
  executionByImageProminence.set(imageProminence, execution);
  return execution;
}

function executeImageProminenceUncached(imageProminence: "balanced" | "image-led") {
  const authority = aurumAuthority();
  const providerIntent = semanticIntentFixture(authority.request, {
    designConceptSummary: `P10B-18B-06 ${imageProminence} fixed authority`,
    commercialPosture: "premium-editorial",
    density: "low",
    navigationPosture: "editorial",
    storyCatalogueBalance: "story-first",
    discoveryPosture: "editorial",
    configurableProductPosture: "guided",
    mobileHierarchy: "story-led",
    imageProminence,
  });
  const compiled = compileSemanticStorefrontDesignIntentV1({
    originalRequest: authority.request,
    providerIntent,
    currentRequestInput: authority.currentRequestInput,
    compatibilityInput: authority.compatibilityInput,
    semanticCapabilityIndex: authority.semanticCapabilityIndex,
    preparedAuthority: authority.preparedAuthority,
  });
  const execution = executeCompiledSemanticStorefrontDesignIntentV1({
    originalRequest: authority.request,
    providerIntent,
    currentRequestInput: authority.currentRequestInput,
    compatibilityInput: authority.compatibilityInput,
    semanticCapabilityIndex: authority.semanticCapabilityIndex,
    preparedAuthority: authority.preparedAuthority,
    compiledDecision: compiled.compiledDecision,
    synthesisDecision: compiled.synthesisDecision,
    pageEvidenceAuthority: authority.pageEvidenceAuthority,
    contentFactAuthority: authority.contentFactAuthority,
    approvedAssetPresentations: authority.approvedAssetPresentations,
  });
  return { authority, compiled, execution };
}

describe("P10B-18B-06 asset composition and art direction", () => {
  it("selects exact purpose affinity, pairs hero sources and prefers unused editorial authority", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const assets = fixture.planningInput.approvedAssetContext?.assets ?? [];
    const reuseLedger = new Map<string, number>();
    const hero = resolveApprovedAssetPlacement({
      assets,
      request: {
        purpose: "hero-primary",
        acceptedRoles: ["heroDesktop", "heroMobile", "editorialImage"],
      },
      reuseLedger,
    });
    expect(hero).toMatchObject({
      asset: { assetId: "asset_p10b16p04_aurum_hero", role: "heroDesktop" },
      responsivePair: {
        assetId: "asset_p10b18b06_aurum_hero_mobile",
        role: "heroMobile",
      },
      affinity: "exact-role-exact-purpose",
      reusePolicy: "unique-high-salience",
    });
    const firstEditorial = resolveApprovedAssetPlacement({
      assets,
      request: { purpose: "editorial-story", acceptedRoles: ["editorialImage"] },
      reuseLedger,
    });
    const secondEditorial = resolveApprovedAssetPlacement({
      assets,
      request: { purpose: "editorial-story", acceptedRoles: ["editorialImage"] },
      reuseLedger,
    });
    expect(firstEditorial?.asset.assetId).toBe("asset_p10b16p04_aurum_editorial");
    expect(secondEditorial?.asset.assetId).toBe("asset_p10b18b06_aurum_studio_detail");
    expect(new Set([firstEditorial?.asset.assetId, secondEditorial?.asset.assetId])).toHaveLength(
      2,
    );
    const saturatedPairLedger = new Map<string, number>([["asset_p10b18b06_aurum_hero_mobile", 1]]);
    expect(
      resolveApprovedAssetPlacement({
        assets: assets.filter(({ role }) => role === "heroDesktop" || role === "heroMobile"),
        request: {
          purpose: "hero-primary",
          acceptedRoles: ["heroDesktop", "heroMobile"],
        },
        reuseLedger: saturatedPairLedger,
      }),
    ).toBeNull();
    expect(
      resolveApprovedAssetPlacement({
        assets: assets.filter(({ role }) => role === "heroMobile"),
        request: {
          purpose: "hero-primary",
          acceptedRoles: ["heroMobile"],
          viewport: "mobile",
        },
        reuseLedger: new Map(),
      })?.asset.role,
    ).toBe("heroMobile");
  });

  it("filters collection-specific authority and never promotes product media", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const source = fixture.planningInput.approvedAssetContext!.assets.find(
      ({ role }) => role === "collectionImage",
    )!;
    const collectionAsset = approvedGenerationAssetSchema.parse({
      ...source,
      presentation: {
        ...source.presentation,
        placementAuthority: {
          ...source.presentation.placementAuthority!,
          collectionIds: ["collection_allowed"],
        },
      },
    });
    expect(
      resolveApprovedAssetPlacement({
        assets: [collectionAsset],
        request: {
          purpose: "collection-card",
          acceptedRoles: ["collectionImage", "productMainImage"],
          collectionId: "collection_other",
        },
        reuseLedger: new Map(),
      }),
    ).toBeNull();
    expect(
      resolveApprovedAssetPlacement({
        assets: [collectionAsset],
        request: {
          purpose: "collection-card",
          acceptedRoles: ["collectionImage", "productMainImage"],
          collectionId: "collection_allowed",
        },
        reuseLedger: new Map(),
      })?.asset.role,
    ).toBe("collectionImage");
    const editorialSource = fixture.planningInput.approvedAssetContext!.assets.find(
      ({ assetId }) => assetId === "asset_p10b16p04_aurum_editorial",
    )!;
    const editorialAsset = approvedGenerationAssetSchema.parse({
      ...editorialSource,
      presentation: {
        ...editorialSource.presentation,
        placementAuthority: {
          ...editorialSource.presentation.placementAuthority!,
          collectionIds: ["collection_allowed"],
        },
      },
    });
    expect(
      resolveApprovedAssetPlacement({
        assets: [editorialAsset],
        request: {
          purpose: "collection-campaign",
          acceptedRoles: ["editorialImage"],
          collectionId: "collection_other",
        },
        reuseLedger: new Map(),
      }),
    ).toBeNull();
    expect(
      resolveApprovedAssetPlacement({
        assets: [editorialAsset],
        request: {
          purpose: "collection-campaign",
          acceptedRoles: ["editorialImage"],
        },
        reuseLedger: new Map(),
      }),
    ).toBeNull();
  });

  it("materializes one paired responsive placement and renders truthful source diagnostics", () => {
    const result = executeImageProminence("image-led");
    const snapshot = result.execution.synthesis.materialization.snapshot;
    const home = snapshot.pages.find(({ type }) => type === "home")!;
    const hero = home.sections.find(({ component }) => component === "homepageHero")!;
    const placement = hero.approvedAssetPlacements?.find(
      ({ placementPurpose }) => placementPurpose === "hero-primary",
    );
    const presentation = hero.approvedAssetPresentations?.find(
      ({ assetId }) => assetId === placement?.assetId,
    );
    expect(placement).toMatchObject({
      role: "heroDesktop",
      reusePolicy: "unique-high-salience",
      affinity: "exact-role-exact-purpose",
      responsiveSourceAssetIds: ["asset_p10b18b06_aurum_hero_mobile"],
    });
    expect(presentation?.responsiveSources).toEqual([
      expect.objectContaining({
        assetId: "asset_p10b18b06_aurum_hero_mobile",
        breakpoints: ["mobile"],
      }),
    ]);
    expect(presentation?.artDirection?.contractVersion).toBe("1.1.0");
    expect(resolveResponsiveImage(presentation!.artDirection!, "mobile").source.assetId).toBe(
      "asset_p10b18b06_aurum_hero_mobile",
    );
    expect(resolveResponsiveImage(presentation!.artDirection!, "wide").source.assetId).toBe(
      "asset_p10b16p04_aurum_hero",
    );
    const wrongPlacementPresentation = structuredClone(presentation!);
    wrongPlacementPresentation.artDirection!.placement.variant = "fullBleedOverlay";
    expect(
      resolveApprovedAssetPresentationForPlacement(
        [wrongPlacementPresentation, presentation!],
        placement!,
        hero.variant,
      )?.artDirection?.fingerprint,
    ).toBe(presentation!.artDirection!.fingerprint);
    const markup = renderToStaticMarkup(
      <ResponsiveStorefrontImage
        alt="Aurum hero"
        asset={presentation!.asset}
        authority={presentation!.artDirection}
        responsiveAssets={presentation!.responsiveSources!.map(({ asset }) => asset)}
      />,
    );
    expect(markup).toContain('data-art-responsive-result="source-and-treatment"');
    expect(markup).toContain('data-art-source-id="asset_p10b18b06_aurum_hero_mobile"');
    expect(markup).toContain("/seed-assets/aurum-mobile-hero.svg");
  }, 120_000);

  it("consumes image prominence materially on a fixed selection and preserves the product catalogue", () => {
    const restrained = executeImageProminence("balanced");
    const immersive = executeImageProminence("image-led");
    const { artDirectionPosture: _restrainedPosture, ...restrainedBackbone } =
      restrained.compiled.compiledDecision.exactSelection;
    const { artDirectionPosture: _immersivePosture, ...immersiveBackbone } =
      immersive.compiled.compiledDecision.exactSelection;
    expect(canonicalValueString(restrainedBackbone)).toBe(canonicalValueString(immersiveBackbone));
    expect(_restrainedPosture).toBe("editorial");
    expect(_immersivePosture).toBe("immersive");
    const heroPresentation = (result: typeof restrained) => {
      const home = result.execution.synthesis.materialization.snapshot.pages.find(
        ({ type }) => type === "home",
      );
      const hero = home?.sections.find(({ component }) => component === "homepageHero");
      const presentation = hero?.approvedAssetPresentations?.find(
        ({ role }) => role === "heroDesktop",
      );
      if (!presentation) throw new Error("Missing exact hero presentation.");
      return presentation;
    };
    const restrainedHero = heroPresentation(restrained);
    const immersiveHero = heroPresentation(immersive);
    expect(restrainedHero.artDirection?.fingerprint).not.toBe(
      immersiveHero.artDirection?.fingerprint,
    );
    expect(restrainedHero.artDirection?.sourceTreatment).toMatchObject({
      crop: { mode: "cover" },
      overlay: "subtle",
    });
    expect(immersiveHero.artDirection?.sourceTreatment).not.toEqual(
      restrainedHero.artDirection?.sourceTreatment,
    );
    expect(canonicalValueString(restrained.authority.catalogue)).toBe(
      canonicalValueString(immersive.authority.catalogue),
    );
  }, 600_000);

  it("materializes the approved logo in the shared frame and keeps text fallback valid", () => {
    const richResult = executeImageProminence("image-led");
    const rich = richResult.execution.synthesis.materialization.snapshot;
    expect(rich.sharedFrame?.header.approvedAssetPlacements).toEqual([
      expect.objectContaining({
        placementContext: "sharedFrame",
        placementPurpose: "brand-identity",
        assetSlotId: "brandLogo",
        role: "logo",
      }),
    ]);
    const headerPresentation = rich.sharedFrame?.header.approvedAssetPresentations?.[0];
    expect(headerPresentation?.assetId).toBe("asset_p10b18b06_aurum_logo");
    expect(headerPresentation?.asset.url).toBe("/seed-assets/aurum-nordic-logo.svg");
    const sparse = createP10b18aShapeAuthorities(["medium-mixed-jewellery"])[0];
    if (!sparse) throw new Error("Missing sparse audit authority.");
    expect(sparse.currentRequestInput.approvedAssetContext).toBeNull();
    const fallback = storefrontSnapshotSchema.parse({
      ...rich,
      sharedFrame: {
        ...rich.sharedFrame!,
        header: {
          ...rich.sharedFrame!.header,
          approvedAssetPlacements: [],
          approvedAssetPresentations: [],
        },
      },
    });
    const home = fallback.pages.find(({ type }) => type === "home")!;
    const markup = renderToStaticMarkup(
      renderStorefrontPage(
        home,
        createStorefrontRenderContext({
          activeLocale: "en",
          primaryLocale: "en",
          catalogue: createP10B16P04RawAurumCommercialFixture().aggregate.catalogue,
          snapshot: fallback,
          evidenceReferences: richResult.authority.compatibilityInput.approvedEvidenceReferences,
        }),
      ),
    );
    expect(markup).toContain("Aurum Nordic");
    expect(markup).not.toContain("aurum-nordic-logo.svg");
  }, 120_000);

  it("rejects stale responsive source authority before complete materialization", () => {
    const result = executeImageProminence("image-led");
    const materialization = result.execution.synthesis.materialization;
    const planningInput = structuredClone(materialization.planningInput);
    const mobile = planningInput.approvedAssetContext?.assets.find(
      ({ assetId }) => assetId === "asset_p10b18b06_aurum_hero_mobile",
    );
    if (!mobile) throw new Error("Missing mobile source fixture.");
    mobile.revision = "stale-mobile-revision";
    expect(() =>
      materializeCompleteStorefrontSelection({
        planningInput,
        siteMapDecision: result.authority.siteMapDecision,
        pageEvidenceAuthority: result.authority.pageEvidenceAuthority,
        contentFactAuthority: result.authority.contentFactAuthority,
        approvedAssetPresentations: result.authority.approvedAssetPresentations,
        directionId: materialization.plan.designSystemSelection.directionId,
        designSystemNarrowing: {
          spacingDensity: materialization.plan.designSystemSelection.spacingDensity,
          surfaceDepth: materialization.plan.designSystemSelection.surfaceDepth,
        },
        pageBlueprintSelectionOverrides: materialization.plan.pageBlueprintSelectionOverrides,
        approvedAssetRoleSelections: materialization.plan.approvedAssetRoleSelections,
        dynamicCommerceSelection: materialization.plan.dynamicCommerceSelection ?? undefined,
        artDirectionPosture: result.compiled.compiledDecision.exactSelection.artDirectionPosture,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WholeStorefrontGenerationPlanError>>({
        code: "stale-approved-asset",
      }),
    );
  }, 300_000);

  it("reselects exact paired hero authority after an accepted generated snapshot", () => {
    const first = executeImageProminence("image-led");
    const acceptedDraft = first.execution.synthesis.materialization.snapshot;
    const currentRequestInput = {
      ...first.authority.currentRequestInput,
      draft: acceptedDraft,
    };
    const compatibilityInput = {
      ...first.authority.compatibilityInput,
      planningInput: {
        ...first.authority.compatibilityInput.planningInput,
        draft: acceptedDraft,
      },
    };
    const exact = createPromptedStorefrontDesignRequestV2(currentRequestInput);
    const semanticCapabilityIndex = deriveSemanticCapabilityIndex({
      authority: compatibilityInput,
      currentAuthorityFingerprint: semanticStorefrontCurrentAuthorityFingerprint(
        exact.request.currentAuthority,
      ),
    });
    const request = createSemanticStorefrontDesignRequestV1(exact, {
      semanticAuthorityFingerprint: semanticCapabilityIndex.semanticAuthorityFingerprint,
      semanticInfluenceAuthority: semanticCapabilityIndex.semanticInfluenceAuthority,
    });
    const preparedAuthority = prepareSemanticStorefrontDesignCompilationAuthority({
      originalRequest: request,
      currentRequestInput,
      compatibilityInput,
      semanticCapabilityIndex,
    });
    const providerIntent = semanticIntentFixture(request, {
      designConceptSummary: "P10B-18B-06 generated follow-up authority",
      commercialPosture: "premium-editorial",
      density: "low",
      navigationPosture: "editorial",
      storyCatalogueBalance: "story-first",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "story-led",
      imageProminence: "image-led",
    });
    const compiled = compileSemanticStorefrontDesignIntentV1({
      originalRequest: request,
      providerIntent,
      currentRequestInput,
      compatibilityInput,
      semanticCapabilityIndex,
      preparedAuthority,
    });
    expect(compiled.compiledDecision.approvedAssetRoleSelections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: "asset_p10b16p04_aurum_hero",
          responsiveSourceAssetIds: ["asset_p10b18b06_aurum_hero_mobile"],
        }),
      ]),
    );
    const execution = executeCompiledSemanticStorefrontDesignIntentV1({
      originalRequest: request,
      providerIntent,
      currentRequestInput,
      compatibilityInput,
      semanticCapabilityIndex,
      preparedAuthority,
      compiledDecision: compiled.compiledDecision,
      synthesisDecision: compiled.synthesisDecision,
      pageEvidenceAuthority: first.authority.pageEvidenceAuthority,
      contentFactAuthority: first.authority.contentFactAuthority,
      approvedAssetPresentations: first.authority.approvedAssetPresentations,
    });
    const hero = execution.synthesis.materialization.snapshot.pages
      .find(({ type }) => type === "home")
      ?.sections.find(({ component }) => component === "homepageHero");
    const presentation = hero?.approvedAssetPresentations?.find(
      ({ assetId }) => assetId === "asset_p10b16p04_aurum_hero",
    );
    expect(resolveResponsiveImage(presentation!.artDirection!, "mobile").source.assetId).toBe(
      "asset_p10b18b06_aurum_hero_mobile",
    );
  }, 300_000);
});
