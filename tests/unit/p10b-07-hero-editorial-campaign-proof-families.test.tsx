import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  materializeWholeStorefrontRuntimeSnapshot,
  WholeStorefrontProposalAcceptanceCoordinator,
} from "@/application/whole-storefront-proposal-lifecycle";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import { getTemplatePagePlan } from "@/application/storefront-templates";
import {
  homepageEditorialDefinition,
  homepageHeroDefinition,
  homepageProofContentSchema,
  homepagePromotionDefinition,
  resolveHomepageProofContent,
  veskifyComponentCapabilityManifest,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import {
  homepageCommerceComponentByTarget,
  renderHomepageCommerce,
  type HomepageCommerceRendererInput,
} from "@/components/storefront/homepage-commerce";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { aurumNordicSeed, karvonenBrandSystem } from "@/data/seed";
import { createResponsiveImageAuthority } from "@/domain/asset-presentation";
import {
  CommercialCapabilityError,
  type ComponentInstanceV2,
  type ComponentProjectionContext,
  type StorefrontAssetMetadata,
} from "@/domain/component-platform";
import { projectDesignDna, resolveBrandSystemDesignDna } from "@/domain/design-system";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";

const localized = (en: string, fi = en) => ({ en, fi });
const heroVariants = [
  "editorialSplit",
  "imageLed",
  "fullBleedOverlay",
  "asymmetric",
  "restrained",
  "campaignMerchandising",
] as const;

const presentationBinding = {
  slotId: "presentationContext",
  source: "projectBrandContext" as const,
  projectId: "project_p10b07",
  revision: "brand-r1",
};

function artDirection() {
  const anatomy = homepageHeroDefinition.commercialAnatomy!;
  const material = {
    contractVersion: "1.0.0" as const,
    source: {
      assetId: "asset_hero",
      role: "heroDesktop" as const,
      revision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      provenanceKind: "merchantProvided" as const,
      sourceOwnerId: "source_hero",
    },
    placement: {
      componentType: "homepageHero",
      componentVersion: "2.0.0",
      variant: "editorialSplit",
      anatomyContractVersion: anatomy.contractVersion,
      anatomyIdentity: anatomy.identity,
      anatomyVersion: "1.1.0",
      anatomyRegion: "media" as const,
      assetSlotId: "heroMedia",
      required: false,
    },
    safeArea: { x: 0.15, y: 0.1, width: 0.7, height: 0.8 },
    sourceTreatment: {
      ratio: "wide" as const,
      crop: { mode: "editorial" as const, rect: { x: 0.1, y: 0, width: 0.8, height: 1 } },
      focalPoint: { x: 0.42, y: 0.48 },
      overlay: "gradient" as const,
    },
    responsiveTreatments: [
      {
        breakpoint: "mobile" as const,
        treatment: {
          ratio: "portrait" as const,
          crop: { mode: "cover" as const },
          focalPoint: { x: 0.35, y: 0.45 },
          overlay: "contrast" as const,
        },
      },
      {
        breakpoint: "tablet" as const,
        treatment: {
          ratio: "landscape" as const,
          crop: { mode: "editorial" as const, rect: { x: 0.05, y: 0, width: 0.9, height: 1 } },
          focalPoint: { x: 0.4, y: 0.48 },
          overlay: "subtle" as const,
        },
      },
      {
        breakpoint: "desktop" as const,
        treatment: {
          ratio: "wide" as const,
          crop: { mode: "cover" as const },
          focalPoint: { x: 0.5, y: 0.5 },
          overlay: "gradient" as const,
        },
      },
      {
        breakpoint: "wide" as const,
        treatment: {
          ratio: "wide" as const,
          crop: { mode: "contain" as const },
          focalPoint: { x: 0.5, y: 0.5 },
          overlay: "none" as const,
        },
      },
    ],
    derivatives: [],
  };
  return createResponsiveImageAuthority(material);
}

function metadata(assetId: string, role: StorefrontAssetMetadata["role"]): StorefrontAssetMetadata {
  return {
    assetId,
    role,
    alt: localized(`${assetId} approved media`),
    decorative: false,
    provenance: { kind: "merchantProvided", sourceId: `source_${assetId}` },
    approvalStatus: "approved",
    usageRights: "merchantOwned",
    responsiveCrops: [],
    ...(assetId === "asset_hero" ? { artDirection: artDirection() } : {}),
    revision: `${assetId}-r1`,
  };
}

const projection: ComponentProjectionContext = {
  products: [],
  collections: [],
  assets: [
    metadata("asset_hero", "heroDesktop"),
    metadata("asset_story", "editorialImage"),
    metadata("asset_wrong", "logo"),
  ],
  navigation: [{ navigationId: "navigation_shop", revision: "navigation-r1" }],
  projectBrandContexts: [
    { projectId: "project_p10b07", brandSystemRefs: [], revision: "brand-r1" },
  ],
  localizedContents: [],
  evidenceReferences: [
    {
      source: "merchant-approved",
      authorityId: "brief_p10b07",
      revision: "1",
      status: "approved",
      approvalAuthorityId: "merchant_p10b07",
      approvalFingerprint: "approved-fingerprint",
    },
  ],
  productListRevision: "products-r1",
  collectionListRevision: "collections-r1",
};

function hero(
  variant: (typeof homepageHeroDefinition.variants)[number]["id"],
): ComponentInstanceV2 {
  const withMedia = variant !== "restrained";
  return {
    id: `section_hero_${variant.toLowerCase()}`,
    component: "homepageHero",
    componentVersion: { major: 2, minor: 0, patch: 0 },
    variant,
    content: {
      ...(variant === "campaignMerchandising" ? { eyebrow: localized("Summer edit") } : {}),
      heading: localized("Designed with intention"),
      supportingCopy: localized("A deliberate first impression."),
    },
    props: {
      mediaPosition: variant === "fullBleedOverlay" ? "background" : "right",
      imagePresentation: "cover",
      textAlignment: "left",
      contentWidth: "standard",
      overlayContrast: "strong",
    },
    styleOverrides: { surface: "plain" },
    bindings: [
      presentationBinding,
      ...(withMedia
        ? [
            {
              slotId: "heroAsset",
              source: "asset" as const,
              assetId: "asset_hero",
              revision: "asset_hero-r1",
            },
          ]
        : []),
    ],
    assetAssignments: withMedia
      ? [{ slotId: "heroMedia", assetId: "asset_hero", role: "heroDesktop" }]
      : [],
  };
}

function proof(items: ComponentInstanceV2["content"][string]): ComponentInstanceV2 {
  return {
    id: "section_proof",
    component: "homepageProof",
    componentVersion: { major: 2, minor: 0, patch: 0 },
    variant: "proofGrid",
    content: { heading: localized("What is approved"), items },
    props: { columns: 2, textAlignment: "left" },
    styleOverrides: { surface: "soft" },
    bindings: [presentationBinding],
    assetAssignments: [],
  };
}

function editorial(
  variant: (typeof homepageEditorialDefinition.variants)[number]["id"],
): ComponentInstanceV2 {
  const assetIds =
    variant === "continuationCta"
      ? []
      : variant === "lookbookGallery"
        ? ["asset_story", "asset_hero"]
        : ["asset_story"];
  return {
    id: `section_editorial_${variant.toLowerCase()}`,
    component: "homepageEditorial",
    componentVersion: { major: 2, minor: 0, patch: 0 },
    variant,
    content: {
      heading: localized("A considered story"),
      body: localized("Approved merchant context."),
      steps:
        variant === "craftProcess"
          ? [
              {
                id: "approved_step",
                title: localized("Designed"),
                description: localized("Approved process context."),
              },
            ]
          : [],
    },
    props: { mediaPosition: "right", textAlignment: "left", galleryColumns: 2 },
    styleOverrides: { surface: "plain" },
    bindings: [
      presentationBinding,
      ...assetIds.map((assetId, index) => ({
        slotId: index === 0 ? "storyPrimaryAsset" : "storySecondaryAsset",
        source: "asset" as const,
        assetId,
        revision: `${assetId}-r1`,
      })),
    ],
    assetAssignments: assetIds.map((assetId) => ({
      slotId: "storyMedia",
      assetId,
      role: assetId === "asset_story" ? ("editorialImage" as const) : ("heroDesktop" as const),
    })),
  };
}

function rendererInput(instance: ComponentInstanceV2): HomepageCommerceRendererInput {
  return {
    target: "preview",
    instance,
    projection,
    activeLocale: "en",
    primaryLocale: "en",
    resolveAssetUrl: (assetId) => `https://merchant.example/${assetId}.jpg`,
    onNavigate: () => undefined,
  };
}

function capabilityError(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return error instanceof CommercialCapabilityError ? error.code : "unexpected";
  }
  return undefined;
}

describe("P10B-07 hero, editorial, campaign and proof families", () => {
  it("01 exposes six commercial-ready meaningful hero compositions", () => {
    expect(heroVariants).toHaveLength(6);
    heroVariants.forEach((variant) => {
      expect(
        veskifyComponentCapabilityManifest.requireCommercialReadyVariant({
          componentType: "homepageHero",
          variant,
          expectedAnatomyVersion: { major: 1, minor: 1, patch: 0 },
          pageType: "home",
          requireMeaningful: true,
        }).variant.structuralClassification,
      ).toBe("meaningfulStructuralVariant");
    });
  });

  it("02 gives all six heroes materially distinct structural fingerprints", () => {
    const variants = homepageHeroDefinition.commercialAnatomy!.variants.filter((candidate) =>
      heroVariants.includes(candidate.variantId as (typeof heroVariants)[number]),
    );
    expect(
      new Set(variants.map((variant) => canonicalValueFingerprint(variant.structure))).size,
    ).toBe(6);
  });

  it("03 keeps legacy/finishing aliases out of the meaningful count", () => {
    const anatomy = homepageHeroDefinition.commercialAnatomy!;
    expect(
      anatomy.variants.filter(
        (variant) => variant.classification === "meaningfulStructuralVariant",
      ),
    ).toHaveLength(6);
    expect(
      anatomy.variants
        .filter((variant) => variant.classification === "compatibilityAlias")
        .map((variant) => variant.variantId),
    ).toEqual(["editorial", "fullBleed", "minimal"]);
    expect(
      capabilityError(() =>
        veskifyComponentCapabilityManifest.requireCommercialReadyVariant({
          componentType: "homepageHero",
          variant: "editorial",
          requireMeaningful: true,
        }),
      ),
    ).toBe("notMeaningfulStructuralVariant");
  });

  it("04 exposes commercial-ready image/text, brand-story, process, lookbook and continuation anatomy", () => {
    expect(
      homepageEditorialDefinition.commercialAnatomy!.variants.map((variant) => [
        variant.variantId,
        variant.classification,
      ]),
    ).toEqual([
      ["imageText", "meaningfulStructuralVariant"],
      ["brandStory", "meaningfulStructuralVariant"],
      ["craftProcess", "meaningfulStructuralVariant"],
      ["lookbookGallery", "meaningfulStructuralVariant"],
      ["continuationCta", "meaningfulStructuralVariant"],
    ]);
  });

  it("05 exposes five commercial-ready campaign/promotion compositions", () => {
    homepagePromotionDefinition.variants.forEach(({ id: variant }) => {
      expect(
        veskifyComponentCapabilityManifest.requireCommercialReadyVariant({
          componentType: "homepagePromotion",
          variant,
          pageType: "landing",
          narrativeRole: "campaign",
          requireMeaningful: true,
        }).variant.structuralClassification,
      ).toBe("meaningfulStructuralVariant");
    });
  });

  it("06 accepts proof only with canonical approved evidence references", () => {
    const content = homepageProofContentSchema.parse({
      items: [
        {
          id: "approved_fact",
          kind: "brandFact",
          statement: localized("Designed in Helsinki"),
          evidence: {
            source: "merchant-approved",
            authorityId: "brief_p10b07",
            revision: "1",
            status: "approved",
            approvalAuthorityId: "merchant_p10b07",
            approvalFingerprint: "approved-fingerprint",
          },
        },
      ],
    });
    expect(
      resolveHomepageProofContent(content, {
        required: true,
        currentEvidenceReferences: projection.evidenceReferences,
      }),
    ).toEqual(content);
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(proof(content.items), projection),
    ).not.toThrow();

    const staleProjection = structuredClone(projection);
    staleProjection.evidenceReferences[0].approvalFingerprint = "replacement-fingerprint";
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(proof(content.items), staleProjection),
    ).toThrow(/requires current approved evidence/i);
  });

  it("07 omits optional proof and fails closed when proof is required without evidence", () => {
    expect(resolveHomepageProofContent({ items: [] }, { required: false })).toBeUndefined();
    expect(() => resolveHomepageProofContent({ items: [] }, { required: true })).toThrow(
      /requires current approved evidence/i,
    );
    expect(() => veskifyComponentRegistryV2.validateInstance(proof([]))).toThrow(
      /requires current approved evidence/i,
    );
  });

  it("08 preserves canonical responsive art direction through the shared hero renderer", () => {
    const rendered = render(renderHomepageCommerce(rendererInput(hero("editorialSplit"))));
    const frame = rendered.container.querySelector("[data-art-direction-fingerprint]");
    expect(frame).toHaveAttribute("data-art-direction-fingerprint", artDirection().fingerprint);
    expect(rendered.container.querySelectorAll("source[data-art-breakpoint]")).toHaveLength(4);
    expect(
      readFileSync("src/components/storefront/homepage-commerce.module.css", "utf8"),
    ).not.toMatch(/\.heroMedia img[\s\S]*object-fit:\s*cover/);
  });

  it("09 rejects an approved asset whose role is incompatible with editorial media", () => {
    const value: ComponentInstanceV2 = {
      id: "section_story_wrong_role",
      component: "homepageEditorial",
      componentVersion: { major: 2, minor: 0, patch: 0 },
      variant: "imageText",
      content: { heading: localized("Story"), body: localized("Approved copy") },
      props: { mediaPosition: "left", textAlignment: "left", galleryColumns: 1 },
      styleOverrides: { surface: "plain" },
      bindings: [
        presentationBinding,
        { slotId: "storyPrimaryAsset", source: "asset", assetId: "asset_wrong", revision: "r1" },
      ],
      assetAssignments: [{ slotId: "storyMedia", assetId: "asset_wrong", role: "logo" }],
    };
    expect(() => veskifyComponentRegistryV2.validateInstance(value)).toThrow(
      /does not accept logo/i,
    );
  });

  it("10 rejects narrative-role incompatibility through generated capability authority", () => {
    expect(
      capabilityError(() =>
        veskifyComponentCapabilityManifest.requireCommercialReadyVariant({
          componentType: "homepageEditorial",
          variant: "brandStory",
          narrativeRole: "conversion",
        }),
      ),
    ).toBe("incompatibleNarrativeRole");
  });

  it("11 rejects page-family incompatibility without over-broad registration", () => {
    expect(
      capabilityError(() =>
        veskifyComponentCapabilityManifest.requireCommercialReadyVariant({
          componentType: "homepageProof",
          variant: "proofGrid",
          pageType: "product",
        }),
      ),
    ).toBe("incompatiblePageFamily");
  });

  it("12 declares deliberate responsive transformation identity across the six heroes", () => {
    const anatomy = homepageHeroDefinition.commercialAnatomy!;
    expect(
      heroVariants.map(
        (variant) =>
          anatomy.variants.find((candidate) => candidate.variantId === variant)!.structure
            .responsiveTransformationIds[0],
      ),
    ).toEqual([
      "splitToStack",
      "mediaFirstStack",
      "overlayToContained",
      "asymmetricReflow",
      "restrainedCondense",
      "campaignReflow",
    ]);

    const campaign = render(
      renderHomepageCommerce(rendererInput(hero("campaignMerchandising"))),
    ).container.querySelector('[data-variant="campaignMerchandising"]')!;
    expect(
      [...campaign.children].map(
        (child) => child.getAttribute("data-region") ?? child.getAttribute("data-asset-role"),
      ),
    ).toEqual(["media", "merchandising", "content", "actions"]);
    expect(campaign.children[0]).toHaveAttribute("data-asset-role", "heroDesktop");
    const css = readFileSync("src/components/storefront/homepage-commerce.module.css", "utf8");
    expect(css).toMatch(
      /data-responsive-transformations~="overlayToContained"\] \.media_background[\s\S]*position:\s*relative/,
    );
    expect(css).toMatch(
      /data-responsive-transformations~="lookbookCarousel"\] \.storyGallery[\s\S]*scroll-snap-type:\s*x mandatory/,
    );
  });

  it("13 inherits merchant-wide Design DNA without changing component anatomy", () => {
    const aurum = projectDesignDna(
      resolveBrandSystemDesignDna(aurumNordicSeed.draftSnapshot.brandSystem),
    );
    const karvonen = projectDesignDna(resolveBrandSystemDesignDna(karvonenBrandSystem));
    expect(aurum.cssVariables).not.toEqual(karvonen.cssVariables);
    const anatomyFingerprint =
      veskifyComponentCapabilityManifest.getCommercialAnatomy("homepageHero")!.fingerprint;
    expect(anatomyFingerprint).toBe(
      veskifyComponentCapabilityManifest.getCommercialAnatomy("homepageHero")!.fingerprint,
    );
    const css = readFileSync("src/components/storefront/homepage-commerce.module.css", "utf8");
    expect(css).toContain("var(--brand-font-display)");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("14 plans, proposes and stores the new families through canonical generation", () => {
    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    const plan = createWholeStorefrontGenerationPlan(fixture.planningInput, {
      directionId: "premiumEditorial",
    });
    const proposal = compileWholeStorefrontProposal({ plan, planningInput: fixture.planningInput });
    const accepted = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => ({ plan, planningInput: fixture.planningInput }),
    }).accept();
    if (accepted.state !== "accepted") throw new Error("Expected accepted storefront proposal.");
    const homepage = accepted.activeStorefront.pages.find((page) => page.type === "home")!;
    expect(homepage.components.map((component) => component.component)).toEqual(
      expect.arrayContaining(["homepageHero", "homepageEditorial", "homepageProof"]),
    );
  });

  it("preserves an existing editorial media subset and order during regeneration", () => {
    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    const home = fixture.planningInput.draft.pages.find((page) => page.type === "home")!;
    const initialPlan = createWholeStorefrontGenerationPlan(fixture.planningInput, {
      directionId: "premiumEditorial",
    });
    const initialEditorial = initialPlan.pagePlans
      .flatMap((page) => page.components)
      .find(
        (component) =>
          "instance" in component && component.instance.component === "homepageEditorial",
      );
    if (!initialEditorial || !("instance" in initialEditorial)) {
      throw new Error("Expected the registered homepage editorial family.");
    }
    const approvedStory = fixture.assetContext.assets.find(
      (asset) => asset.assetId === "asset_lumo_story",
    )!;
    const placement = {
      type: "PLACE_APPROVED_SOURCE_ASSET" as const,
      pageId: home.id,
      componentId: initialEditorial.instance.id,
      componentType: "homepageEditorial",
      assetSlotId: "storyMedia",
      assetId: approvedStory.assetId,
      role: approvedStory.role,
      assetRevision: approvedStory.revision,
      materialFingerprint: approvedStory.materialFingerprint,
      sourceReferenceId: approvedStory.sourceReferenceId,
      required: false,
    };
    home.sections = [
      ...home.sections.filter((section) => section.component !== "brandStory"),
      {
        id: initialEditorial.instance.id,
        component: initialEditorial.instance.component,
        variant: initialEditorial.instance.variant,
        visible: true,
        content: structuredClone(initialEditorial.instance.content),
        props: structuredClone(initialEditorial.instance.props),
        styleOverrides: {},
        approvedAssetPlacements: [placement],
        approvedAssetPresentations: [
          fixture.assetPresentations.find(
            (presentation) => presentation.assetId === approvedStory.assetId,
          )!,
        ],
      },
    ];

    const regenerated = createWholeStorefrontGenerationPlan(fixture.planningInput, {
      directionId: "premiumEditorial",
    });
    const editorial = regenerated.pagePlans
      .flatMap((page) => page.components)
      .find(
        (component) =>
          "instance" in component && component.instance.component === "homepageEditorial",
      );
    if (!editorial || !("instance" in editorial)) {
      throw new Error("Expected regenerated homepage editorial family.");
    }
    expect(editorial.instance.assetAssignments).toEqual([
      { slotId: "storyMedia", assetId: approvedStory.assetId, role: approvedStory.role },
    ]);
    expect(editorial.instance.bindings.filter((binding) => binding.source === "asset")).toEqual([
      {
        slotId: "storyPrimaryAsset",
        source: "asset",
        assetId: approvedStory.assetId,
        revision: approvedStory.revision,
      },
    ]);
  });

  it("15 preserves generated families through save/reload and publish compilation", async () => {
    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    const plan = createWholeStorefrontGenerationPlan(fixture.planningInput, {
      directionId: "premiumEditorial",
    });
    const proposal = compileWholeStorefrontProposal({ plan, planningInput: fixture.planningInput });
    const accepted = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => ({ plan, planningInput: fixture.planningInput }),
    }).accept();
    if (accepted.state !== "accepted") throw new Error("Expected accepted storefront proposal.");
    const snapshot = materializeWholeStorefrontRuntimeSnapshot({
      runtime: accepted.activeStorefront,
      planningInput: fixture.planningInput,
      approvedAssetPresentations: fixture.assetPresentations,
    });
    const repository = new InMemoryProjectRepository([fixture.aggregate]);
    await repository.saveDraft(fixture.aggregate.project.id, snapshot, {
      id: fixture.draft.id,
      revision: fixture.draft.revision,
    });
    const reloaded = await repository.get(fixture.aggregate.project.id);
    const draft = reloaded.snapshots.find(
      (snapshot) => snapshot.id === reloaded.project.draftSnapshotId,
    )!;
    const currentEvidenceReferences = [
      {
        source: "merchant-approved" as const,
        authorityId: fixture.planningInput.brief.id,
        revision: String(fixture.planningInput.brief.revision),
        status: "approved" as const,
        approvalAuthorityId: fixture.planningInput.brief.approval.actorId!,
        approvalFingerprint: fixture.planningInput.brief.approvedEvidenceFingerprint!,
      },
    ];
    const publication = compileStorefrontPublication(
      createCurrentPublishCompilerInput({
        aggregate: reloaded,
        snapshot: draft,
        sourceAuthority: { kind: "manual" },
        currentEvidenceReferences,
      }),
    );
    expect(() =>
      compileStorefrontPublication(
        createCurrentPublishCompilerInput({
          aggregate: reloaded,
          snapshot: draft,
          sourceAuthority: { kind: "manual" },
          currentEvidenceReferences: currentEvidenceReferences.map((reference) => ({
            ...reference,
            revision: "superseded-brief-revision",
          })),
        }),
      ),
    ).toThrow();
    const storedTypes = draft.pages.flatMap((page) =>
      page.sections.map((section) => section.component),
    );
    const publishedTypes = publication.result.pages.flatMap(({ page }) =>
      page.sections.map((section) => section.component),
    );
    expect(storedTypes).toEqual(expect.arrayContaining(["homepageEditorial", "homepageProof"]));
    expect(publishedTypes).toEqual(expect.arrayContaining(["homepageEditorial", "homepageProof"]));
  });

  it("16 uses the same registered renderer identity for editor, preview and published targets", () => {
    for (const component of ["homepageHero", "homepageEditorial", "homepageProof"] as const) {
      const targets = homepageCommerceComponentByTarget[component];
      expect(targets.editor).toBe(targets.preview);
      expect(targets.preview).toBe(targets.published);
    }
  });

  it("17 keeps legacy compatible hero aliases loadable", () => {
    const legacy = hero("editorialSplit");
    legacy.variant = "minimal";
    expect(() =>
      veskifyComponentRegistryV2.validateInstanceConformance(legacy, projection),
    ).not.toThrow();
    expect(() => render(renderHomepageCommerce(rendererInput(legacy)))).not.toThrow();
  });

  it("18 renders the six hero and three proof anatomies through observable region order", () => {
    const heroRegions = Object.fromEntries(
      heroVariants.map((variant) => {
        const root = render(renderHomepageCommerce(rendererInput(hero(variant)))).container
          .firstElementChild!;
        return [
          variant,
          [...root.querySelectorAll<HTMLElement>("[data-region]")].map(
            ({ dataset }) => dataset.region,
          ),
        ];
      }),
    );
    expect(heroRegions).toEqual({
      editorialSplit: ["content", "actions", "media"],
      imageLed: ["media", "content", "actions"],
      fullBleedOverlay: ["media", "overlay-panel", "content", "actions"],
      asymmetric: ["asymmetric-rail", "content", "actions", "media"],
      restrained: ["content", "actions"],
      campaignMerchandising: ["media", "merchandising", "content", "actions"],
    });

    const approved = homepageProofContentSchema.parse({
      heading: localized("Approved evidence"),
      items: [
        {
          id: "approved_fact",
          kind: "brandFact",
          statement: localized("Designed in Helsinki"),
          evidence: projection.evidenceReferences[0],
        },
      ],
    });
    const proofRegions = Object.fromEntries(
      (["quoteSpotlight", "proofGrid", "serviceAssurance"] as const).map((variant) => {
        const value = proof(approved.items);
        value.variant = variant;
        value.content = approved;
        const root = render(renderHomepageCommerce(rendererInput(value))).container
          .firstElementChild!;
        return [
          variant,
          [...root.querySelectorAll<HTMLElement>("[data-region]")].map(
            ({ dataset }) => dataset.region,
          ),
        ];
      }),
    );
    expect(proofRegions).toEqual({
      quoteSpotlight: ["section-heading", "proof", "quote"],
      proofGrid: ["section-heading", "proof", "proof-grid"],
      serviceAssurance: ["section-heading", "service", "proof", "proof-grid"],
    });
  });

  it("19 renders editorial story, process, gallery and continuation anatomy truthfully", () => {
    const material = Object.fromEntries(
      homepageEditorialDefinition.variants.map(({ id: variant }) => {
        const root = render(renderHomepageCommerce(rendererInput(editorial(variant)))).container
          .firstElementChild!;
        return [
          variant,
          {
            regions: [...root.querySelectorAll<HTMLElement>("[data-region]")].map(
              ({ dataset }) => dataset.region,
            ),
            mediaCount: root.querySelectorAll("[data-region='editorial-media'] figure").length,
            galleryReadiness: (root as HTMLElement).dataset.galleryReadiness,
          },
        ];
      }),
    );
    expect(material).toEqual({
      imageText: {
        regions: ["content", "editorial-media"],
        mediaCount: 1,
        galleryReadiness: "not-applicable",
      },
      brandStory: {
        regions: ["editorial-media", "content"],
        mediaCount: 1,
        galleryReadiness: "not-applicable",
      },
      craftProcess: {
        regions: ["content", "process", "editorial-media"],
        mediaCount: 1,
        galleryReadiness: "not-applicable",
      },
      lookbookGallery: {
        regions: ["editorial-media", "content"],
        mediaCount: 2,
        galleryReadiness: "ready",
      },
      continuationCta: {
        regions: ["content"],
        mediaCount: 0,
        galleryReadiness: "not-applicable",
      },
    });
  });

  it("keeps the new families reachable from canonical PageBlueprint selections", () => {
    const pagePlan = getTemplatePagePlan("template_brand_led_editorial", "home")!;
    expect(pagePlan.profile?.componentSelections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: "homepageHero" }),
        expect.objectContaining({ component: "homepageEditorial" }),
        expect.objectContaining({ component: "homepageProof" }),
      ]),
    );
  });
});
