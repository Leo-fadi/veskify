import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ContentSupportPageMaterializationError,
  materializeContentSupportPage,
} from "@/application/content-support-pages";
import {
  createDynamicCommerceProductMatchContext,
  validateCurrentDynamicCommercePresentationAuthority,
} from "@/application/dynamic-commerce-routes";
import { listCompatibleCoordinatedDirectionFactorizedCandidates } from "@/application/bounded-storefront-synthesis";
import { materializeStorefrontSiteMap } from "@/application/storefront-site-map";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import {
  P10B16P04_COMMERCIAL_CATALOGUE_ID,
  P10B16P04_COMMERCIAL_CONTEXTS,
  P10B16P04_COMMERCIAL_DRAFT_ID,
  P10B16P04_COMMERCIAL_LOCALE,
  P10B16P04_COMMERCIAL_PROJECT_ID,
  P10B16P04_COMMERCIAL_PUBLISHED_ID,
  P10B16P04_CATALOGUE_DISPLAY_EXCLUSION,
  createP10B16P04ApprovedCatalogue,
  createP10B16P04RawAurumCommercialFixture,
} from "@/data/demo/p10b-16p-04-commercial-acceptance";
import { aurumNordicSeed } from "@/data/seed/aurum-nordic";
import {
  applyCommercialSharedFrame,
  approvedAssetPresentationSchema,
  canonicalValueFingerprint,
  type ApprovedAssetPresentation,
} from "@/domain/storefront";

const forbiddenCustomerTerms =
  /\b(?:demo|dummy|fixture|placeholder|verify|verification|canonical|authority|runtime)\b/iu;

function framedLegacySiteMapBase(
  fixture: ReturnType<typeof createP10B16P04RawAurumCommercialFixture>,
) {
  const base = structuredClone(fixture.rawDraft);
  delete base.dynamicCommercePresentation;
  return applyCommercialSharedFrame(base, "editorial-masthead");
}

describe("P10B-16P-04J Aurum commercial acceptance fixture", () => {
  it("starts from one neutral raw page without reusing the designed Aurum snapshot", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const rawHome = fixture.rawDraft.pages[0];

    expect(fixture.fixtureId).toContain("fictional-commercial-visual-acceptance");
    expect(fixture.aggregate.project).toMatchObject({
      id: P10B16P04_COMMERCIAL_PROJECT_ID,
      mode: "salesDemo",
      primaryLocale: P10B16P04_COMMERCIAL_LOCALE,
      enabledLocales: ["en", "fi"],
      draftSnapshotId: P10B16P04_COMMERCIAL_DRAFT_ID,
      publishedSnapshotId: P10B16P04_COMMERCIAL_PUBLISHED_ID,
    });
    expect(fixture.rawDraft.pages).toHaveLength(1);
    expect(rawHome).toMatchObject({
      id: "page_p10b16p04_aurum_raw_home",
      type: "home",
      slug: "/",
    });
    expect(rawHome?.sections.map(({ component }) => component)).toEqual(["header", "footer"]);
    expect(
      rawHome?.sections.find(({ component }) => component === "footer")?.content,
    ).toMatchObject({
      contact: { en: "Helsinki, Finland", fi: "Helsinki, Suomi" },
      copyright: { en: "© 2026 Aurum Nordic", fi: "© 2026 Aurum Nordic" },
    });
    expect(rawHome?.pageFamily).toBeUndefined();
    expect(fixture.rawDraft.sharedFrame).toBeUndefined();
    expect(fixture.rawDraft.navigation).toEqual({ primary: [], footer: [] });
    expect(fixture.rawDraft.pages.map(({ id }) => id)).not.toContain("page_home");
    expect(fixture.executionPlanningInput).toEqual(fixture.planningInput);
  });

  it("omits only the explicitly approved internal seed note and preserves protected commerce", () => {
    const sourceBefore = canonicalValueFingerprint(aurumNordicSeed.catalogue);
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const expected = structuredClone(aurumNordicSeed.catalogue);
    expected.id = P10B16P04_COMMERCIAL_CATALOGUE_ID;
    const excludedProduct = expected.products.find(
      ({ id }) => id === P10B16P04_CATALOGUE_DISPLAY_EXCLUSION.productId,
    );
    if (!excludedProduct) throw new Error("Expected the exact approved display exclusion target.");
    delete excludedProduct.attributes.stoneClarity;

    expect(fixture.aggregate.catalogue).toEqual(expected);
    expect(fixture.aggregate.catalogue.collections).toEqual(aurumNordicSeed.catalogue.collections);
    for (const sourceProduct of aurumNordicSeed.catalogue.products) {
      const projected = fixture.aggregate.catalogue.products.find(
        ({ id }) => id === sourceProduct.id,
      );
      expect(projected).toBeDefined();
      expect(projected?.id).toBe(sourceProduct.id);
      expect(projected?.sku).toBe(sourceProduct.sku);
      expect(projected?.price).toEqual(sourceProduct.price);
      expect(projected?.compareAtPrice).toEqual(sourceProduct.compareAtPrice);
      expect(projected?.availabilityLabel).toEqual(sourceProduct.availabilityLabel);
      expect(projected?.stockStatus).toBe(sourceProduct.stockStatus);
      expect(projected?.images).toEqual(sourceProduct.images);
      expect(projected?.variants).toEqual(sourceProduct.variants);
      expect(projected?.orderOptions).toEqual(sourceProduct.orderOptions);
      const expectedAttributes = structuredClone(sourceProduct.attributes);
      if (sourceProduct.id === P10B16P04_CATALOGUE_DISPLAY_EXCLUSION.productId) {
        delete expectedAttributes.stoneClarity;
      }
      expect(projected?.attributes).toEqual(expectedAttributes);
    }
    expect(P10B16P04_CATALOGUE_DISPLAY_EXCLUSION).toMatchObject({
      fieldPath: "attributes.stoneClarity",
      disposition: "internal-evidence-only",
    });
    expect(canonicalValueFingerprint(aurumNordicSeed.catalogue)).toBe(sourceBefore);
  });

  it("fails closed when the exact approved display exclusion source drifts", () => {
    const stale = structuredClone(aurumNordicSeed.catalogue);
    const product = stale.products.find(
      ({ id }) => id === P10B16P04_CATALOGUE_DISPLAY_EXCLUSION.productId,
    );
    if (!product) throw new Error("Expected the exact approved display exclusion target.");
    product.attributes.stoneClarity = "Changed source value";

    expect(() => createP10B16P04ApprovedCatalogue(stale)).toThrow(
      /no longer matches its exact source/,
    );
  });

  it("uses the largest canonical collection and truthful simple/configurable contexts", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const collection = fixture.aggregate.catalogue.collections.find(
      ({ id }) => id === P10B16P04_COMMERCIAL_CONTEXTS.collection.collectionId,
    );
    const simple = fixture.aggregate.catalogue.products.find(
      ({ id }) => id === P10B16P04_COMMERCIAL_CONTEXTS.simpleProduct.productId,
    );
    const configurable = fixture.aggregate.catalogue.products.find(
      ({ id }) => id === P10B16P04_COMMERCIAL_CONTEXTS.configurableProduct.productId,
    );

    expect(collection?.productIds).toEqual([
      "product_aava_necklace_925",
      "product_sisu_automatic_watch",
      "product_kajo_earrings_585",
      "product_meri_bracelet_925",
    ]);
    expect(collection?.productIds).toHaveLength(
      P10B16P04_COMMERCIAL_CONTEXTS.collection.canonicalProductCount,
    );
    expect(simple && createDynamicCommerceProductMatchContext(simple)).toMatchObject({
      optionStructure: "simple",
      optionGroupCount: 0,
      highConsideration: false,
    });
    expect(configurable && createDynamicCommerceProductMatchContext(configurable)).toMatchObject({
      optionStructure: "configurable",
      optionGroupCount: 2,
      mediaAvailability: "multiple",
      highConsideration: false,
    });
    expect(P10B16P04_COMMERCIAL_CONTEXTS.highConsiderationProduct).toBeNull();
    expect(
      fixture.aggregate.catalogue.products.filter(
        (product) => createDynamicCommerceProductMatchContext(product).highConsideration,
      ),
    ).toEqual([]);
  });

  it("binds explicit fictional source, approval and asset-role authority", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const assetContext = fixture.planningInput.approvedAssetContext;
    const materialEvidence = fixture.sourceEvidenceMaterial;

    expect(fixture.brief).toMatchObject({
      status: "approved",
      canonicalCommerceProjectionRef: P10B16P04_COMMERCIAL_CATALOGUE_ID,
      generationPermissions: {
        allowMarketingCopy: false,
        allowAssetReuse: true,
        allowGeneratedImagery: false,
      },
    });
    expect(materialEvidence.sourceReferences).toEqual([
      expect.objectContaining({
        sourceType: "deterministic-fixture",
        status: "complete",
      }),
    ]);
    const identityEvidence = materialEvidence.evidence.find(
      ({ id }) => id === "evidence_p10b16p04_aurum_identity",
    );
    expect(identityEvidence?.observedValue).toHaveProperty(
      "classification",
      "fictional-production-disabled-visual-acceptance-fixture",
    );
    expect(assetContext?.assets.map(({ role }) => role)).toEqual([
      "heroDesktop",
      "collectionImage",
      "editorialImage",
    ]);
    expect(assetContext?.assets.map(({ materialFingerprint }) => materialFingerprint)).toEqual([
      "760c534fc97a4686f57c575534c0debed386701100b2dc9b4a4a088f275c5c77",
      "0412e6adc72567de1f1bbd0a206b31edff928a3a649387a91413758935503737",
      "ca09620254bd8821899d215447825818b32295763efc75bd042de1889aad83a9",
    ]);
    expect(fixture.approvedAssetPresentations.map(({ asset }) => asset.url)).toEqual([
      "/seed-assets/aurora-ring.svg",
      "/seed-assets/lumi-halo-ring.svg",
      "/seed-assets/aava-necklace.svg",
    ]);
    expect(fixture.brief.approvedBrandDirection?.logoAssetRef).toBeNull();
  });

  it("renders one approved About H1, substantive facts and exact editorial media", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const approvedAssetPresentations = fixture.approvedAssetPresentations.map((presentation) =>
      approvedAssetPresentationSchema.parse(presentation),
    );
    const approvedAssetContext = fixture.planningInput.approvedAssetContext;
    if (!approvedAssetContext) throw new Error("The P04J fixture requires approved assets.");
    const siteMap = materializeStorefrontSiteMap({
      decision: fixture.siteMapDecision,
      baseSnapshot: framedLegacySiteMapBase(fixture),
      catalogue: fixture.aggregate.catalogue,
      evidenceAuthority: fixture.pageEvidenceAuthority,
    });
    const about = siteMap.snapshot.pages.find((page) => page.pageFamily?.familyId === "about");
    if (!about) throw new Error("The P04J site map requires one About page.");
    const materialized = materializeContentSupportPage({
      page: about,
      factAuthority: fixture.contentFactAuthority,
      approvedAssetAuthority: {
        context: approvedAssetContext,
        presentations: approvedAssetPresentations,
        placements: fixture.planningInput.requiredAssetPlacements,
      },
    });
    const section = materialized.page.sections[0];
    if (!section) throw new Error("The materialized About page requires one content section.");
    expect(section.approvedAssetPlacements).toEqual([
      expect.objectContaining({
        componentId: section.id,
        componentType: "contentSupport",
        assetSlotId: "contentSupportMedia",
        assetId: "asset_p10b16p04_aurum_editorial",
        role: "editorialImage",
      }),
    ]);
    expect(section.approvedAssetPresentations).toEqual([
      expect.objectContaining({
        assetId: "asset_p10b16p04_aurum_editorial",
        role: "editorialImage",
      }),
    ]);
    const snapshot = {
      ...siteMap.snapshot,
      pages: siteMap.snapshot.pages.map((page) =>
        page.id === materialized.page.id ? materialized.page : page,
      ),
      contentSupportFactDocuments: [materialized.factDocument],
    };
    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      catalogue: fixture.aggregate.catalogue,
      snapshot,
      evidenceReferences: materialized.page.pageFamily?.evidenceReferences ?? [],
    });
    const html = renderToStaticMarkup(renderStorefrontPage(materialized.page, context));
    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html).toContain("About Aurum Nordic");
    expect(html).toContain(
      "Nordic jewellery and watches shaped by clarity, warm materials and lasting character.",
    );
    expect(html).toContain("Quiet forms, lasting meaning");
    expect(html).toContain("New pieces, material stories and quiet inspiration.");
    expect(html).toContain('data-content-contribution-count="3"');
    expect(html).toContain('data-content-region="continuation"');
    expect(html).toContain('data-asset-id="asset_p10b16p04_aurum_editorial"');
    expect(html).toContain('src="/seed-assets/aava-necklace.svg"');
    expect(html).not.toMatch(
      /placeholder|verify live|requires verification|not captured|protected authority/iu,
    );
  });

  it("fails closed for stale or wrong-role About media presentation authority", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const approvedAssetPresentations = fixture.approvedAssetPresentations.map((presentation) =>
      approvedAssetPresentationSchema.parse(presentation),
    );
    const approvedAssetContext = fixture.planningInput.approvedAssetContext;
    if (!approvedAssetContext) throw new Error("The P04J fixture requires approved assets.");
    const siteMap = materializeStorefrontSiteMap({
      decision: fixture.siteMapDecision,
      baseSnapshot: framedLegacySiteMapBase(fixture),
      catalogue: fixture.aggregate.catalogue,
      evidenceAuthority: fixture.pageEvidenceAuthority,
    });
    const about = siteMap.snapshot.pages.find((page) => page.pageFamily?.familyId === "about");
    if (!about) throw new Error("The P04J site map requires one About page.");
    const mutateEditorialPresentation = (
      mutation: Readonly<{ revision?: string; role?: "collectionImage" }>,
    ): readonly ApprovedAssetPresentation[] =>
      approvedAssetPresentations.map((presentation) =>
        presentation.assetId === "asset_p10b16p04_aurum_editorial"
          ? { ...presentation, ...mutation }
          : presentation,
      );
    for (const presentations of [
      mutateEditorialPresentation({ revision: "stale-revision" }),
      mutateEditorialPresentation({ role: "collectionImage" }),
    ]) {
      try {
        materializeContentSupportPage({
          page: about,
          factAuthority: fixture.contentFactAuthority,
          approvedAssetAuthority: {
            context: approvedAssetContext,
            presentations,
            placements: fixture.planningInput.requiredAssetPlacements,
          },
        });
        throw new Error("Expected stale content/support media authority to fail closed.");
      } catch (error) {
        expect(error).toBeInstanceOf(ContentSupportPageMaterializationError);
        expect((error as ContentSupportPageMaterializationError).code).toBe("stale-approved-asset");
      }
    }
  });

  it("provides bilingual approved About facts without customer-facing internal terminology", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const payload = fixture.aboutFactDocument.payload;

    expect(payload).toMatchObject({
      familyId: "about",
      title: { en: "About Aurum Nordic", fi: "Tietoa Aurum Nordicista" },
      story: {
        heading: {
          en: "Quiet forms, lasting meaning",
          fi: "Hiljaisia muotoja, kestävää merkitystä",
        },
        steps: [
          {
            id: "helsinki-origin",
            title: { en: "Helsinki", fi: "Helsinki" },
            description: { en: "Designed in Finland", fi: "Suunniteltu Suomessa" },
          },
        ],
      },
      campaign: {
        heading: { en: "Light, held close", fi: "Valo lähelläsi" },
        description: {
          en: "Discover white gold and silver pieces inspired by winter light.",
          fi: "Löydä talven valosta inspiroituneet valkokulta- ja hopeakorut.",
        },
        actionLabel: { en: "View the edit", fi: "Katso valikoima" },
      },
    });
    expect(JSON.stringify(payload)).not.toMatch(forbiddenCustomerTerms);
    expect(
      fixture.contentFactAuthority.resolve({
        familyId: "about",
        reference: {
          source: fixture.aboutFactDocument.evidence.source,
          authorityId: fixture.aboutFactDocument.evidence.authorityId,
          revision: fixture.aboutFactDocument.evidence.revision,
        },
      }),
    ).toEqual(fixture.aboutFactDocument);
  });

  it("retains all seventeen routes through one compact dynamic-commerce authority", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const routes = fixture.siteMapDecision.pages.map(({ route }) => route);
    const dynamic = fixture.rawDraft.dynamicCommercePresentation;

    expect(fixture.siteMapDecision.pages).toHaveLength(17);
    expect(routes).toEqual(
      expect.arrayContaining([
        "/",
        "/collections/everyday-icons",
        "/products/sisu-automatic-watch",
        "/products/aurora-ring-585",
        "/pages/about",
        "/cart",
        "/checkout",
        "/states/no-results",
        "/states/empty",
        "/states/error",
        "/404",
        "/search",
      ]),
    );
    expect(dynamic?.routeInventory).toHaveLength(9);
    expect(() =>
      validateCurrentDynamicCommercePresentationAuthority(fixture.rawDraft),
    ).not.toThrow();
    expect(fixture.rawDraft.pages).toHaveLength(1);
  });

  it("keeps the required generic PDP fallback compatible with every admitted global frame", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const candidates = listCompatibleCoordinatedDirectionFactorizedCandidates({
      planningInput: fixture.executionPlanningInput,
      siteMapDecision: fixture.siteMapDecision,
      approvedEvidenceReferences: fixture.approvedEvidenceReferences,
    });
    const fallback = fixture.rawDraft.dynamicCommercePresentation?.productDetailArchetypes.find(
      ({ id }) =>
        id === fixture.rawDraft.dynamicCommercePresentation?.fallbacks.productDetailArchetypeId,
    );

    expect(candidates.length).toBeGreaterThan(0);
    expect(
      candidates.filter(({ backbone }) => backbone.directionId === "premiumEditorial").length,
    ).toBeGreaterThan(0);
    expect(fallback).toBeDefined();
    for (const { backbone } of candidates) {
      expect(fallback?.compatibleSharedFrameProfileIds).toContain(backbone.sharedFrameProfileId);
    }
  });

  it("returns isolated clones rather than mutable shared acceptance state", () => {
    const first = createP10B16P04RawAurumCommercialFixture();
    const second = createP10B16P04RawAurumCommercialFixture();

    first.aggregate.project.name = "Changed by test";
    first.aggregate.catalogue.collections[0].productIds.length = 0;
    expect(second.aggregate.project.name).toBe("Aurum Nordic");
    expect(second.aggregate.catalogue.collections[0]?.productIds).toHaveLength(2);
  });
});
