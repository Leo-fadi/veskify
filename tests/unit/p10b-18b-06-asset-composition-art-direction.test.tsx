// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  approvedGenerationAssetSchema,
  resolveApprovedAssetPlacement,
} from "@/application/ai-storefront-generation";
import {
  compileSemanticStorefrontDesignIntentV1,
  executeCompiledSemanticStorefrontDesignIntentV1,
} from "@/application/prompted-storefront-design-compiler";
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

function executeImageProminence(imageProminence: "balanced" | "image-led") {
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
  }, 180_000);

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
});
