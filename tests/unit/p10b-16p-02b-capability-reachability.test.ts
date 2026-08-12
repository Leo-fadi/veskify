import { describe, expect, it } from "vitest";
import { createApprovedGenerationAssetContextFingerprint } from "@/application/ai-storefront-generation/approved-asset-context";
import { createPromptedStorefrontCapabilityAuthority } from "@/application/prompted-storefront-design-intent";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { listExecutablePageBlueprintProfiles } from "@/application/storefront-templates";
import {
  registeredBrandSystemForDirection,
  storefrontDesignSystemV1,
} from "@/application/storefront-design-system";
import {
  createResponsiveImageAuthority,
  responsiveImageCropSchema,
  responsiveImageOverlaySchema,
  responsiveImageRatioSchema,
} from "@/domain/asset-presentation";
import { veskifyComponentCapabilityManifest } from "@/components/registry";
import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import { resolveBrandSystemDesignDna } from "@/domain/design-system";
import { canonicalProductCardAuthority } from "@/domain/product-card";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

const now = "2026-08-12T08:00:00.000Z";

function capabilityAuthority() {
  const aggregate = p10b16p01DynamicCommerceAggregate();
  const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId);
  if (!draft) throw new Error("Missing current draft fixture.");
  const approvedBrief = approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: "brief_p10b_16p_02b_reachability",
      now,
      businessIdentity: {
        businessName: "Aurum Nordic",
        shortDescription: "A considered Nordic jewellery storefront.",
        industry: "jewellery",
        targetCustomer: "Design-conscious adults",
        primaryMarket: "Finland",
      },
      languagePlan: { selectedLanguages: ["fi", "en"], primaryLanguage: "en" },
      sourceReferenceIds: [],
      sourceEvidenceIds: [],
      materialEvidence: {
        sourceReferences: [],
        evidence: [],
        assetCandidates: [],
        reconciliation: null,
      },
      canonicalCommerceProjectionRef: aggregate.catalogue.id,
      pagePlan: { pageTypes: ["home", "collection", "product"] },
      approvedBrandDirection: {
        logoAssetRef: null,
        supportingImageAssetRefs: [],
        preferredBrandColours: ["#223344"],
        typographyDirection: "serif-led",
        visualStyleDirection: "editorial",
        imageryDirection: "studio",
        toneKeywords: ["warm"],
      },
      visualPriorities: ["Editorial hierarchy"],
      excludedClaims: ["No invented delivery promise"],
    }),
    { actorId: "merchant_p10b_16p_02b", approvedAt: now },
  );
  return {
    draft,
    authority: createPromptedStorefrontCapabilityAuthority({
      draft,
      catalogue: aggregate.catalogue,
      approvedBrief,
      approvedAssetContext: null,
    }),
  };
}

function commercialProfileResponsiveModes(): ReadonlySet<string> {
  const modes = new Set<string>();
  const profiles = listExecutablePageBlueprintProfiles().flatMap(({ profile }) =>
    profile &&
    (profile.commercialHomepage ||
      profile.commercialCollectionSearch ||
      profile.commercialProductDetail ||
      profile.commercialContentSupport ||
      profile.commercialUtility)
      ? [profile]
      : [],
  );
  profiles.forEach((profile) => {
    profile.componentSelections.forEach((selection) => {
      const component = veskifyComponentCapabilityManifest.getByComponentType(selection.component);
      const anatomy = component?.commercialAnatomy;
      if (!component || !anatomy) return;
      const registeredComponent = component;
      selection.variants.forEach((variantId) => {
        const variant = registeredComponent.variants.find(({ id }) => id === variantId);
        const anatomyVariant = anatomy.variants.find(
          (candidate) => candidate.variantId === variantId,
        );
        if (
          !variant ||
          !anatomyVariant ||
          (variantId !== selection.defaultVariant &&
            variant.structuralClassification !== "meaningfulStructuralVariant")
        ) {
          return;
        }
        anatomyVariant.structure.responsiveTransformationIds.forEach((transformationId) => {
          const transformation = anatomy.responsiveTransformations.find(
            ({ id }) => id === transformationId,
          );
          if (!transformation) throw new Error(`Missing ${transformationId}.`);
          modes.add(transformation.mode);
        });
      });
    });
    [
      profile.commercialHomepage?.productCardAnatomyId,
      profile.commercialCollectionSearch?.productCardAnatomyId,
      profile.commercialProductDetail?.relatedProductCardAnatomyId,
    ].forEach((anatomyId) => {
      if (!anatomyId) return;
      const anatomy = canonicalProductCardAuthority.anatomies.find(({ id }) => id === anatomyId);
      if (!anatomy) throw new Error(`Missing ${anatomyId}.`);
      anatomy.responsiveTransformations.forEach(({ mode }) => modes.add(mode));
    });
  });
  return modes;
}

function p10b14ProjectionInput() {
  const source = createP10B14PremiumEditorialFixture();
  return {
    source,
    draft: structuredClone(source.slice.snapshot),
    catalogue: source.fixture.planningInput.catalogue,
    approvedBrief: source.fixture.brief,
    approvedAssetContext: structuredClone(source.fixture.assetContext),
  };
}

describe("P10B-16P-02B capability reachability truth", () => {
  it("advertises only values with an exact current canonical consumer as materially available", () => {
    const { draft, authority } = capabilityAuthority();
    const entries = new Map(
      authority.projection.capabilities.map((entry) => [entry.key, entry] as const),
    );

    expect(entries.get("design-dna.typography-scale.typography.scale.balanced")).toMatchObject({
      availability: "available",
    });
    expect(
      authority.referencesByPreferenceKey.get(
        "design-dna.typography-scale.typography.scale.balanced",
      ),
    ).toMatchObject({ authorityKind: "design-dna" });
    expect(entries.get("design-dna.typography-scale.typography.scale.expressive")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(entries.get("design-dna.typography-hierarchy.typography.role.display")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(entries.get("responsive.posture.responsive.transformation.carousel")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(entries.get("homepage.narrative-role.narrative.role.introduction")).toMatchObject({
      availability: "registered-fail-closed",
    });

    const nonInstanceParameters = veskifyComponentCapabilityManifest.manifest.entries
      .flatMap(({ componentType, boundedParameters }) =>
        boundedParameters
          .filter(
            ({ authority: parameterAuthority }) => !parameterAuthority.instanceOverrideAllowed,
          )
          .map(({ id }) => `component.bounded-parameter.${componentType}.${id}`),
      )
      .filter((key) => entries.has(key));
    expect(nonInstanceParameters.length).toBeGreaterThan(0);
    expect(
      nonInstanceParameters.every(
        (key) => entries.get(key)?.availability === "registered-fail-closed",
      ),
    ).toBe(true);

    const dna = resolveBrandSystemDesignDna(draft.brandSystem);
    expect(entries.get(`responsive.image.ratio.${dna.media.ratio}`)).toMatchObject({
      availability: "available",
    });
    expect(entries.get(`responsive.crop.crop.${dna.media.crop}`)).toMatchObject({
      availability: "available",
    });
    expect(entries.get(`responsive.overlay.overlay.${dna.media.overlay}`)).toMatchObject({
      availability: "available",
    });
    expect(
      authority.projection.capabilities.some(
        ({ key, availability }) =>
          key.startsWith("responsive.image.ratio.") && availability === "evidence-dependent",
      ),
    ).toBe(true);
    expect(
      authority.projection.capabilities.find(
        ({ dimension }) => dimension === "collection-search.search-relationship",
      ),
    ).toMatchObject({ availability: "available" });
    expect(authority.projection.search).toEqual({
      registration: "registered-presentation-authority",
      execution: "unavailable",
      behavior: "fail-closed",
      reason: "missing-canonical-search-results-adapter",
    });

    expect(entries.get("component.family.homepageHero")).toMatchObject({
      availability: "available",
    });
    expect(entries.get("homepage.component-family.homepageHero")).toMatchObject({
      availability: "available",
    });
    expect(entries.get("component.family.contentSupport")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(entries.get("component.family.commerceUtility")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(
      authority.projection.capabilities
        .filter(
          ({ key, contexts }) =>
            key.startsWith("component.bounded-parameter.") &&
            contexts.some((context) => ["content", "landing"].includes(context)),
        )
        .every(({ availability }) => availability === "registered-fail-closed"),
    ).toBe(true);
    expect(
      authority.projection.capabilities
        .filter(
          ({ key }) =>
            key.startsWith("component.meaningful-variant.dynamicCollectionCommerce.") ||
            key.startsWith("component.bounded-parameter.dynamicCollectionCommerce."),
        )
        .every(({ availability }) => availability === "registered-fail-closed"),
    ).toBe(true);
  });

  it("advertises only the exact current content/support profile with its exact approved facts", () => {
    const input = p10b14ProjectionInput();
    const authority = createPromptedStorefrontCapabilityAuthority(input);
    const aboutPage = input.draft.pages.find(({ pageFamily }) => pageFamily?.familyId === "about");
    if (!aboutPage?.pageFamily) throw new Error("Missing exact about page authority.");
    const exactKey = `content-support.profile.${aboutPage.pageFamily.profileId}.about`;
    const alternate = authority.projection.capabilities.find(
      ({ key, dimension }) =>
        dimension === "content-support.profile" && key.endsWith(".about") && key !== exactKey,
    );

    expect(authority.projection.capabilities.find(({ key }) => key === exactKey)).toMatchObject({
      availability: "available",
      contexts: ["about"],
    });
    expect(alternate).toMatchObject({ availability: "registered-fail-closed" });
  });

  it("fails closed for component families with no current evidence-compatible core slot", () => {
    const input = p10b14ProjectionInput();
    const authority = createPromptedStorefrontCapabilityAuthority({
      ...input,
      catalogue: { ...input.catalogue, collections: [] },
    });
    const entries = new Map(
      authority.projection.capabilities.map((entry) => [entry.key, entry] as const),
    );

    expect(entries.get("component.family.homepageFeaturedCollections")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(entries.get("homepage.component-family.homepageFeaturedCollections")).toMatchObject({
      availability: "registered-fail-closed",
    });
  });

  it("keeps single-slot override authority reachable when other profiles repeat the component", () => {
    const input = p10b14ProjectionInput();
    const homepageEditorialCounts = listExecutablePageBlueprintProfiles()
      .flatMap(({ profile }) => (profile?.commercialHomepage ? [profile] : []))
      .map(
        (profile) =>
          profile.componentSelections.filter(({ component }) => component === "homepageEditorial")
            .length,
      );
    expect(homepageEditorialCounts.some((count) => count === 1)).toBe(true);
    expect(homepageEditorialCounts.some((count) => count > 1)).toBe(true);

    const authority = createPromptedStorefrontCapabilityAuthority(input);
    const editorialVariants = authority.projection.capabilities.filter(({ key }) =>
      key.startsWith("homepage.meaningful-variant.homepageEditorial."),
    );

    expect(editorialVariants.length).toBeGreaterThan(0);
    expect(editorialVariants.some(({ availability }) => availability === "available")).toBe(true);
  });

  it("requires exact approved evidence for every repeatable current content page", () => {
    const input = p10b14ProjectionInput();
    const aboutPage = input.draft.pages.find(({ pageFamily }) => pageFamily?.familyId === "about");
    if (!aboutPage?.pageFamily || aboutPage.pageFamily.evidenceReferences.length === 0) {
      throw new Error("Missing exact about page evidence authority.");
    }
    const repeatedPage = {
      ...structuredClone(aboutPage),
      id: `${aboutPage.id}_repeated`,
      slug: "/pages/about-repeated",
      pageFamily: {
        ...structuredClone(aboutPage.pageFamily),
        evidenceReferences: aboutPage.pageFamily.evidenceReferences.map((reference) => ({
          ...structuredClone(reference),
          authorityId: `${reference.authorityId}_unapproved_repeat`,
        })),
      },
      sections: aboutPage.sections.map((section) => ({
        ...structuredClone(section),
        id: `${section.id}_repeated`,
      })),
    };
    const authority = createPromptedStorefrontCapabilityAuthority({
      ...input,
      draft: {
        ...input.draft,
        pages: [...input.draft.pages, repeatedPage],
      },
    });
    const exactKey = `content-support.profile.${aboutPage.pageFamily.profileId}.about`;

    expect(authority.projection.capabilities.find(({ key }) => key === exactKey)).toMatchObject({
      availability: "evidence-dependent",
    });
  });

  it("makes responsive modes available only through exact executable profile variants or product cards", () => {
    const { authority } = capabilityAuthority();
    const exactModes = commercialProfileResponsiveModes();
    const responsiveEntries = authority.projection.capabilities.filter(({ key }) =>
      authority.referencesByPreferenceKey.get(key)?.authorityId.startsWith("responsive:"),
    );

    expect(responsiveEntries.length).toBeGreaterThan(0);
    responsiveEntries.forEach((entry) => {
      const mode = authority.referencesByPreferenceKey
        .get(entry.key)!
        .authorityId.replace("responsive:", "");
      expect(entry.availability).toBe(
        exactModes.has(mode) ? "available" : "registered-fail-closed",
      );
    });
  });

  it("projects media traits from every reachable registered Design DNA", () => {
    const { draft, authority } = capabilityAuthority();
    const entries = new Map(
      authority.projection.capabilities.map((entry) => [entry.key, entry] as const),
    );

    storefrontDesignSystemV1.directions.forEach((direction) => {
      const dna = resolveBrandSystemDesignDna(
        registeredBrandSystemForDirection(
          draft.brandSystem,
          storefrontDesignSystemV1,
          direction.id,
          {
            spacingDensity: direction.spacingDensity,
            surfaceDepth: direction.surfaceDepth,
          },
        ),
      );
      expect(entries.get(`responsive.image.ratio.${dna.media.ratio}`)).toMatchObject({
        availability: "available",
      });
      expect(entries.get(`responsive.crop.crop.${dna.media.crop}`)).toMatchObject({
        availability: "available",
      });
      expect(entries.get(`responsive.overlay.overlay.${dna.media.overlay}`)).toMatchObject({
        availability: "available",
      });
    });
  });

  it("fails closed for protected source-media roles and unbound approved art direction", () => {
    const input = p10b14ProjectionInput();
    const initial = createPromptedStorefrontCapabilityAuthority(input);
    const evidenceDependentValue = (prefix: string) => {
      const entry = initial.projection.capabilities.find(
        ({ key, availability }) => key.startsWith(prefix) && availability === "evidence-dependent",
      );
      if (!entry) throw new Error(`Missing evidence-dependent ${prefix}.`);
      return entry.key.slice(prefix.length);
    };
    const ratio = responsiveImageRatioSchema.parse(
      evidenceDependentValue("responsive.image.ratio."),
    );
    const crop = responsiveImageCropSchema.shape.mode.parse(
      evidenceDependentValue("responsive.crop.crop."),
    );
    const overlay = responsiveImageOverlaySchema.parse(
      evidenceDependentValue("responsive.overlay.overlay."),
    );
    const target = input.draft.pages
      .flatMap((page) => page.sections)
      .map((section) => {
        const presentation = section.approvedAssetPresentations?.[0];
        const placement = presentation
          ? section.approvedAssetPlacements?.find(
              (candidate) =>
                candidate.assetId === presentation.assetId && candidate.role === presentation.role,
            )
          : undefined;
        return presentation && placement ? { section, presentation, placement } : null;
      })
      .find((candidate) => candidate !== null);
    if (!target) throw new Error("Missing approved presentation fixture.");
    const component = veskifyComponentCapabilityManifest.getByComponentType(
      target.section.component,
    );
    const anatomy = component?.commercialAnatomy;
    const variant = anatomy?.variants.find(({ variantId }) => variantId === target.section.variant);
    const anatomyPlacement = variant?.structure.assetPlacements.find(
      ({ slotId }) => slotId === target.placement.assetSlotId,
    );
    const assetSlot = component?.assetSlots.find(({ id }) => id === target.placement.assetSlotId);
    if (!component || !anatomy || !variant || !anatomyPlacement || !assetSlot) {
      throw new Error("Missing exact approved-presentation component authority.");
    }
    const version = component.componentDefinitionVersion;
    const anatomyVersion = anatomy.version;
    const artDirection = createResponsiveImageAuthority({
      contractVersion: "1.0.0",
      source: {
        assetId: target.presentation.assetId,
        role: target.presentation.role,
        revision: target.presentation.revision,
        materialFingerprint: target.presentation.materialFingerprint,
        provenanceKind: target.placement.sourceProvenanceKind ?? "merchantProvided",
        sourceOwnerId: target.placement.sourceReferenceId,
      },
      placement: {
        componentType: target.section.component,
        componentVersion: `${version.major}.${version.minor}.${version.patch}`,
        variant: target.section.variant,
        anatomyContractVersion: anatomy.contractVersion,
        anatomyIdentity: anatomy.identity,
        anatomyVersion: `${anatomyVersion.major}.${anatomyVersion.minor}.${anatomyVersion.patch}`,
        anatomyRegion: anatomyPlacement.region,
        assetSlotId: assetSlot.id,
        required: assetSlot.required,
      },
      sourceTreatment: {
        ratio,
        crop: { mode: crop },
        focalPoint: { x: 0.5, y: 0.5 },
        overlay,
      },
      responsiveTreatments: [],
      derivatives: [],
    });
    target.section.approvedAssetPresentations = target.section.approvedAssetPresentations?.map(
      (presentation) =>
        presentation.assetId === target.presentation.assetId
          ? { ...presentation, artDirection }
          : presentation,
    );

    const firstAsset = input.approvedAssetContext.assets[0];
    const secondAsset = input.approvedAssetContext.assets[1];
    if (!firstAsset || !secondAsset) throw new Error("Missing approved asset fixtures.");
    firstAsset.role = "productMainImage";
    firstAsset.presentation.responsiveCrops = [
      {
        cropId: "crop_reachability_mobile",
        breakpoint: "mobile",
        aspectRatio: "4:5",
        focalPoint: { x: 0.5, y: 0.5 },
      },
    ];
    secondAsset.role = "productAlternativeImage";
    const { fingerprint: _fingerprint, ...assetMaterial } = input.approvedAssetContext;
    void _fingerprint;
    input.approvedAssetContext = {
      ...assetMaterial,
      fingerprint: createApprovedGenerationAssetContextFingerprint(assetMaterial),
    };
    const projected = createPromptedStorefrontCapabilityAuthority(input);
    const entries = new Map(
      projected.projection.capabilities.map((entry) => [entry.key, entry] as const),
    );

    expect(entries.get(`responsive.image.ratio.${ratio}`)).toMatchObject({
      availability: "evidence-dependent",
    });
    expect(entries.get(`responsive.crop.crop.${crop}`)).toMatchObject({
      availability: "evidence-dependent",
    });
    expect(entries.get(`responsive.overlay.overlay.${overlay}`)).toMatchObject({
      availability: "evidence-dependent",
    });
    expect(entries.get("responsive.crop.approved-responsive-focal-treatment")).toMatchObject({
      availability: "evidence-dependent",
    });
    expect(entries.get("responsive.asset-role.productMainImage")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(entries.get("responsive.asset-role.productAlternativeImage")).toMatchObject({
      availability: "registered-fail-closed",
    });
  });
});
