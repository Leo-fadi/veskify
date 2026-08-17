import { describe, expect, it } from "vitest";
import {
  createResponsiveImageAuthority,
  normalizedPointSchema,
  normalizedRectSchema,
  responsiveImageAuthoritySchema,
  responsiveImageCropSchema,
  responsiveImageBreakpoints,
  type ResponsiveImageAuthority,
  type ResponsiveImageAuthorityMaterial,
} from "@/domain/asset-presentation";
import {
  migrateApprovedPresentationArtDirection,
  resolveResponsiveImage,
  resolveResponsiveImageOrOmit,
  ResponsiveImageAuthorityError,
  validateResponsiveImageAuthority,
} from "@/application/responsive-image-authority";
import { resolveBrandSystemDesignDna } from "@/domain/design-system";
import {
  approvedAssetPresentationSchema,
  type ApprovedAssetPlacementOperation,
  type ApprovedAssetPresentation,
} from "@/domain/storefront";
import { homepageHeroDefinition } from "@/components/registry/homepage-commerce";
import { dynamicProductDetailDefinition } from "@/components/registry/dynamic-product-detail";
import { aurumNordicSeed } from "@/data/seed/aurum-nordic";

const dna = resolveBrandSystemDesignDna(aurumNordicSeed.draftSnapshot.brandSystem);

function material(
  component = homepageHeroDefinition,
  variant = component.defaultVariant,
  slotId = component.assetSlots[0]?.id ?? "missingSlot",
): ResponsiveImageAuthorityMaterial {
  const anatomy = component.commercialAnatomy;
  const slot = component.assetSlots[0];
  const anatomyVariant = anatomy?.variants.find(({ variantId }) => variantId === variant);
  const anatomyPlacement = anatomyVariant?.structure?.assetPlacements.find(
    ({ slotId: candidate }) => candidate === slotId,
  );
  if (!anatomy || !slot || !anatomyPlacement) throw new Error("Missing test anatomy authority.");
  const treatment = {
    ratio: dna.media.ratio,
    crop: { mode: "contain" as const },
    focalPoint: { x: 0.5, y: 0.5 },
    overlay: "none" as const,
  };
  return {
    contractVersion: "1.0.0" as const,
    source: {
      assetId: "asset_hero",
      role:
        component.type === "dynamicProductDetail"
          ? ("productMainImage" as const)
          : ("heroDesktop" as const),
      revision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      provenanceKind:
        component.type === "dynamicProductDetail"
          ? ("canonicalProductMedia" as const)
          : ("merchantProvided" as const),
      sourceOwnerId: component.type === "dynamicProductDetail" ? "product_ring" : "source_hero",
    },
    placement: {
      componentType: component.type,
      componentVersion: `${component.version.major}.${component.version.minor}.${component.version.patch}`,
      variant,
      anatomyContractVersion: anatomy.contractVersion,
      anatomyIdentity: anatomy.identity,
      anatomyVersion: `${anatomy.version.major}.${anatomy.version.minor}.${anatomy.version.patch}`,
      anatomyRegion: anatomyPlacement.region,
      assetSlotId: slotId,
      required: slot.required,
    },
    safeArea: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    sourceTreatment: treatment,
    responsiveTreatments: responsiveImageBreakpoints.map((breakpoint) => ({
      breakpoint,
      treatment,
    })),
    derivatives: [],
  };
}

function authority(
  mutate?: (value: ReturnType<typeof material>) => void,
  component = homepageHeroDefinition,
): ResponsiveImageAuthority {
  const value = material(component);
  mutate?.(value);
  return createResponsiveImageAuthority(value);
}

function expectCode(run: () => unknown, code: string) {
  try {
    run();
    throw new Error("Expected authority validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ResponsiveImageAuthorityError);
    expect((error as ResponsiveImageAuthorityError).code).toBe(code);
  }
}

describe("P10B-04 responsive image and art-direction authority", () => {
  it("01 creates the versioned canonical authority", () => {
    const value = authority();
    expect(value.contractVersion).toBe("1.0.0");
    expect(typeof value.fingerprint).toBe("string");
  });
  it("02 bounds focal points to the normalized source frame", () => {
    expect(normalizedPointSchema.safeParse({ x: 1.01, y: 0.5 }).success).toBe(false);
  });
  it("03 bounds safe areas to the normalized source frame", () => {
    expect(normalizedRectSchema.safeParse({ x: 0.8, y: 0, width: 0.3, height: 1 }).success).toBe(
      false,
    );
  });
  it("04 permits explicit rectangles only for editorial crop mode", () => {
    expect(
      responsiveImageCropSchema.safeParse({
        mode: "cover",
        rect: { x: 0, y: 0, width: 1, height: 1 },
      }).success,
    ).toBe(false);
  });
  it("05 rejects duplicate breakpoint overrides", () => {
    const input = material();
    const first = input.responsiveTreatments[0];
    if (!first) throw new Error("Missing responsive treatment fixture.");
    input.responsiveTreatments = [first, first];
    const created = { ...input, fingerprint: "invalid" };
    expect(responsiveImageAuthoritySchema.safeParse(created).success).toBe(false);
  });
  it("06 rejects derivative lineage that differs from the immutable source", () => {
    const input = material();
    input.derivatives.push({
      derivativeId: "derivative_hero",
      revision: "d1",
      materialFingerprint: "dfp1",
      source: { ...input.source, assetId: "asset_other" },
      transform: input.sourceTreatment,
      approvalStatus: "approved",
      breakpoint: "desktop",
    });
    expect(() => createResponsiveImageAuthority(input)).toThrow(/lineage/i);
  });
  it("07 fingerprints equivalent responsive ordering deterministically", () => {
    const first = material();
    const second = structuredClone(first);
    second.responsiveTreatments.reverse();
    expect(createResponsiveImageAuthority(first).fingerprint).toBe(
      createResponsiveImageAuthority(second).fingerprint,
    );
  });
  it("08 changes the fingerprint for material focal-point changes", () => {
    expect(authority().fingerprint).not.toBe(
      authority((value) => {
        value.sourceTreatment.focalPoint.x = 0.4;
      }).fingerprint,
    );
  });
  it("09 ignores derivative order when fingerprinting", () => {
    const input = material();
    input.derivatives = ["a", "b"].map((id) => ({
      derivativeId: `derivative_${id}`,
      revision: "d1",
      materialFingerprint: id,
      source: input.source,
      transform: input.sourceTreatment,
      approvalStatus: "approved" as const,
    }));
    const reverse = structuredClone(input);
    reverse.derivatives.reverse();
    expect(createResponsiveImageAuthority(input).fingerprint).toBe(
      createResponsiveImageAuthority(reverse).fingerprint,
    );
  });
  it("10 resolves the exact requested breakpoint first", () => {
    expect(resolveResponsiveImage(authority(), "desktop").selectedBreakpoint).toBe("desktop");
  });
  it("11 uses deterministic compatible breakpoint fallback", () => {
    const value = authority((input) => {
      input.responsiveTreatments = input.responsiveTreatments.filter(
        ({ breakpoint }) => breakpoint === "tablet",
      );
    });
    expect(resolveResponsiveImage(value, "desktop").selectedBreakpoint).toBe("tablet");
  });
  it("12 falls back to the valid source treatment", () => {
    const value = authority((input) => {
      input.responsiveTreatments = [];
    });
    expect(resolveResponsiveImage(value, "wide").selectedBreakpoint).toBe("source");
  });
  it("13 rejects unknown component authority", () => {
    const value = authority((input) => {
      input.placement.componentType = "unknownHero";
    });
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "unknown-authority",
    );
  });
  it("14 rejects stale component version authority", () => {
    const value = authority((input) => {
      input.placement.componentVersion = "1.0.0";
    });
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "stale-authority",
    );
  });
  it("15 rejects unregistered variants", () => {
    const value = authority((input) => {
      input.placement.variant = "unknown";
    });
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "unknown-authority",
    );
  });
  it("16 rejects stale anatomy identity", () => {
    const value = authority((input) => {
      input.placement.anatomyIdentity = "stale.anatomy";
    });
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "wrong-anatomy",
    );
  });
  it("17 rejects unknown asset slots", () => {
    const value = authority((input) => {
      input.placement.assetSlotId = "unknownMedia";
    });
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "wrong-slot",
    );
  });
  it("18 rejects roles outside the exact registered slot", () => {
    const value = authority((input) => {
      input.source.role = "logo";
    });
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "wrong-role",
    );
  });
  it("19 rejects stale required cardinality", () => {
    const value = authority((input) => {
      input.placement.required = true;
    });
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "wrong-role",
    );
  });
  it("20 rejects crop broadening beyond Design DNA", () => {
    const value = authority((input) => {
      input.sourceTreatment.crop = { mode: "editorial" };
    });
    const restrained = { ...dna, media: { ...dna.media, crop: "contain" as const } };
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna: restrained,
        }),
      "dna-broadening",
    );
  });
  it("21 rejects overlay broadening beyond Design DNA", () => {
    const value = authority((input) => {
      input.sourceTreatment.overlay = "contrast";
    });
    const restrained = { ...dna, media: { ...dna.media, overlay: "none" as const } };
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna: restrained,
        }),
      "invalid-overlay",
    );
  });
  it("22 rejects fixed ratios outside Design DNA", () => {
    const value = authority((input) => {
      input.sourceTreatment.ratio = dna.media.ratio === "square" ? "wide" : "square";
    });
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "invalid-ratio",
    );
  });
  it("23 rejects editorial crops that exclude the safe area", () => {
    const value = authority((input) => {
      input.sourceTreatment.crop = {
        mode: "editorial",
        rect: { x: 0, y: 0, width: 0.3, height: 0.3 },
      };
    });
    const editorial = { ...dna, media: { ...dna.media, crop: "editorial" as const } };
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna: editorial,
        }),
      "invalid-geometry",
    );
  });
  it("24 rejects pending derivatives", () => {
    const input = material();
    input.derivatives.push({
      derivativeId: "derivative_pending",
      revision: "d1",
      materialFingerprint: "dfp",
      source: input.source,
      transform: input.sourceTreatment,
      approvalStatus: "pending",
    });
    const value = createResponsiveImageAuthority(input);
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "unapproved-derivative",
    );
  });
  it("25 rejects canonical product media owned by another product", () => {
    const value = authority(undefined, dynamicProductDetailDefinition);
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: dynamicProductDetailDefinition,
          dna,
          expectedProductId: "product_other",
        }),
      "wrong-product",
    );
  });
  it("26 rejects editorial replacement of canonical product media", () => {
    const value = authority((input) => {
      input.source.role = "editorialImage";
    }, dynamicProductDetailDefinition);
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: dynamicProductDetailDefinition,
          dna,
          expectedProductId: "product_ring",
        }),
      "editorial-product-replacement",
    );
  });
  it("27 rejects editorial crop geometry for product media", () => {
    const value = authority((input) => {
      input.sourceTreatment.crop = { mode: "editorial", rect: { x: 0, y: 0, width: 1, height: 1 } };
    }, dynamicProductDetailDefinition);
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: dynamicProductDetailDefinition,
          dna: { ...dna, media: { ...dna.media, crop: "editorial" } },
          expectedProductId: "product_ring",
        }),
      "editorial-product-replacement",
    );
  });
  it("28 accepts same-product canonical presentation-only treatment", () => {
    expect(
      validateResponsiveImageAuthority({
        authority: authority(undefined, dynamicProductDetailDefinition),
        component: dynamicProductDetailDefinition,
        dna,
        expectedProductId: "product_ring",
      }).source.sourceOwnerId,
    ).toBe("product_ring");
  });
  it("29 deterministically migrates a legacy approved presentation without rewriting the source", () => {
    const placement: ApprovedAssetPlacementOperation = {
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: "page_home",
      componentId: "section_hero",
      componentType: "homepageHero",
      assetSlotId: "heroMedia",
      assetId: "asset_hero",
      role: "heroDesktop",
      assetRevision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      sourceReferenceId: "source_hero",
      required: false,
    };
    const presentation: ApprovedAssetPresentation = {
      assetId: "asset_hero",
      role: "heroDesktop",
      revision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      asset: {
        id: "asset_hero",
        url: "/assets/hero.jpg",
        decorative: false,
        alt: { en: "Hero" },
      },
    };
    const first = migrateApprovedPresentationArtDirection({
      presentation,
      placement,
      component: homepageHeroDefinition,
      dna,
      provenanceKind: "sourceDiscovered",
    });
    const second = migrateApprovedPresentationArtDirection({
      presentation,
      placement,
      component: homepageHeroDefinition,
      dna,
      provenanceKind: "sourceDiscovered",
    });
    expect(first.artDirection?.fingerprint).toBe(second.artDirection?.fingerprint);
    expect(first.artDirection?.source.provenanceKind).toBe("sourceDiscovered");
    expect(first.asset).toEqual(presentation.asset);
  });
  it("30 rejects art-direction lineage that disagrees with the approved presentation", () => {
    const value = authority();
    expect(
      approvedAssetPresentationSchema.safeParse({
        assetId: "asset_other",
        role: value.source.role,
        revision: value.source.revision,
        materialFingerprint: value.source.materialFingerprint,
        asset: { id: "asset_other", url: "/hero.jpg", decorative: true },
        artDirection: value,
      }).success,
    ).toBe(false);
  });
  it("31 rejects unknown breakpoint vocabulary", () => {
    expectCode(() => resolveResponsiveImage(authority(), "phablet"), "invalid-breakpoint");
  });
  it("32 omits unresolved optional image authority", () => {
    expect(resolveResponsiveImageOrOmit(undefined, "mobile", false)).toBeUndefined();
  });
  it("33 fails when required image authority cannot resolve", () => {
    expectCode(
      () => resolveResponsiveImageOrOmit(undefined, "mobile", true),
      "required-image-unresolved",
    );
  });
  it("34 rejects product derivatives with editorial replacement geometry", () => {
    const input = material(dynamicProductDetailDefinition);
    input.derivatives.push({
      derivativeId: "derivative_editorial_product",
      revision: "d1",
      materialFingerprint: "dfp-editorial",
      source: input.source,
      transform: {
        ...input.sourceTreatment,
        crop: { mode: "editorial", rect: { x: 0, y: 0, width: 1, height: 1 } },
      },
      approvalStatus: "approved",
    });
    const value = createResponsiveImageAuthority(input);
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: dynamicProductDetailDefinition,
          dna: { ...dna, media: { ...dna.media, crop: "editorial" } },
          expectedProductId: "product_ring",
        }),
      "editorial-product-replacement",
    );
  });
  it("35 rejects implicit cover crops when a safe area must be preserved", () => {
    const value = authority((input) => {
      input.sourceTreatment.crop = { mode: "cover" };
    });
    expectCode(
      () =>
        validateResponsiveImageAuthority({
          authority: value,
          component: homepageHeroDefinition,
          dna,
        }),
      "invalid-geometry",
    );
  });
  it("36 requires migration callers to preserve supplied source provenance", () => {
    const placement: ApprovedAssetPlacementOperation = {
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: "page_home",
      componentId: "section_hero",
      componentType: "homepageHero",
      assetSlotId: "heroMedia",
      assetId: "asset_hero",
      role: "heroDesktop",
      assetRevision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      sourceReferenceId: "source_hero",
      sourceProvenanceKind: "sourceDiscovered",
      required: false,
    };
    const presentation: ApprovedAssetPresentation = {
      assetId: "asset_hero",
      role: "heroDesktop",
      revision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      asset: { id: "asset_hero", url: "/hero.jpg", decorative: false, alt: { en: "Hero" } },
    };
    if (!placement.sourceProvenanceKind) throw new Error("Missing source provenance fixture.");
    expect(
      migrateApprovedPresentationArtDirection({
        presentation,
        placement,
        component: homepageHeroDefinition,
        dna,
        provenanceKind: placement.sourceProvenanceKind,
      }).artDirection?.source,
    ).toMatchObject({
      provenanceKind: "sourceDiscovered",
      sourceOwnerId: "source_hero",
    });
  });
  it("37 resolves responsive source and treatment fallbacks independently", () => {
    const input = material();
    const tabletTreatment = input.responsiveTreatments.find(
      ({ breakpoint }) => breakpoint === "tablet",
    );
    if (!tabletTreatment) throw new Error("Missing tablet treatment fixture.");
    const value = createResponsiveImageAuthority({
      ...input,
      contractVersion: "1.1.0",
      responsiveTreatments: [tabletTreatment],
      responsiveSources: [
        {
          breakpoint: "mobile",
          source: {
            assetId: "asset_hero_mobile",
            role: "heroMobile",
            revision: "asset-mobile-r1",
            materialFingerprint: "asset-mobile-fp-1",
            provenanceKind: "sourceDiscovered",
            sourceOwnerId: "source_mobile",
          },
        },
      ],
    });
    expect(resolveResponsiveImage(value, "mobile")).toMatchObject({
      selectedBreakpoint: "tablet",
      source: { assetId: "asset_hero_mobile", sourceOwnerId: "source_mobile" },
    });
    expect(resolveResponsiveImage(value, "wide").source.assetId).toBe("asset_hero");
  });
  it("38 upgrades existing authority with an exact responsive source lineage", () => {
    const placement: ApprovedAssetPlacementOperation = {
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: "page_home",
      componentId: "section_hero",
      componentType: "homepageHero",
      assetSlotId: "heroMedia",
      assetId: "asset_hero",
      role: "heroDesktop",
      assetRevision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      sourceReferenceId: "source_hero",
      required: false,
    };
    const presentation = approvedAssetPresentationSchema.parse({
      assetId: "asset_hero",
      role: "heroDesktop",
      revision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      asset: {
        id: "asset_hero",
        url: "/assets/hero.jpg",
        decorative: false,
        alt: { en: "Hero" },
      },
      artDirection: authority(),
      responsiveSources: [
        {
          breakpoints: ["mobile"],
          assetId: "asset_hero_mobile",
          role: "heroMobile",
          revision: "asset-mobile-r1",
          materialFingerprint: "asset-mobile-fp-1",
          asset: {
            id: "asset_hero_mobile",
            url: "/assets/hero-mobile.jpg",
            decorative: false,
            alt: { en: "Mobile hero" },
          },
        },
      ],
    });
    const migrated = migrateApprovedPresentationArtDirection({
      presentation,
      placement,
      component: homepageHeroDefinition,
      dna,
      provenanceKind: "sourceDiscovered",
      approvedResponsiveSourceLineages: [
        {
          assetId: "asset_hero_mobile",
          provenanceKind: "merchantProvided",
          sourceOwnerId: "source_mobile",
        },
      ],
    });
    expect(migrated.artDirection).toMatchObject({
      contractVersion: "1.1.0",
      responsiveSources: [
        {
          breakpoint: "mobile",
          source: {
            assetId: "asset_hero_mobile",
            provenanceKind: "merchantProvided",
            sourceOwnerId: "source_mobile",
          },
        },
      ],
    });
  });
  it("39 generates safe-area-compatible treatments", () => {
    const placement: ApprovedAssetPlacementOperation = {
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: "page_home",
      componentId: "section_hero",
      componentType: "homepageHero",
      assetSlotId: "heroMedia",
      assetId: "asset_hero",
      role: "heroDesktop",
      assetRevision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      sourceReferenceId: "source_hero",
      required: false,
    };
    const presentation: ApprovedAssetPresentation = {
      assetId: "asset_hero",
      role: "heroDesktop",
      revision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      asset: { id: "asset_hero", url: "/hero.jpg", decorative: false, alt: { en: "Hero" } },
    };
    const migrated = migrateApprovedPresentationArtDirection({
      presentation,
      placement,
      component: homepageHeroDefinition,
      dna,
      provenanceKind: "sourceDiscovered",
      artDirectionPosture: "immersive",
      approvedSafeArea: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    });
    expect(migrated.artDirection?.sourceTreatment.crop.mode).toBe("contain");
    expect(() =>
      validateResponsiveImageAuthority({
        authority: migrated.artDirection,
        component: homepageHeroDefinition,
        dna,
      }),
    ).not.toThrow();
  });
  it("40 retains approved crop identity and exact aspect-ratio lineage", () => {
    const placement: ApprovedAssetPlacementOperation = {
      type: "PLACE_APPROVED_SOURCE_ASSET",
      pageId: "page_home",
      componentId: "section_hero",
      componentType: "homepageHero",
      assetSlotId: "heroMedia",
      assetId: "asset_hero",
      role: "heroDesktop",
      assetRevision: "asset-r1",
      materialFingerprint: "asset-fp-1",
      sourceReferenceId: "source_hero",
      required: false,
    };
    const migrated = migrateApprovedPresentationArtDirection({
      presentation: {
        assetId: "asset_hero",
        role: "heroDesktop",
        revision: "asset-r1",
        materialFingerprint: "asset-fp-1",
        asset: { id: "asset_hero", url: "/hero.jpg", decorative: false, alt: { en: "Hero" } },
      },
      placement,
      component: homepageHeroDefinition,
      dna,
      provenanceKind: "sourceDiscovered",
      approvedResponsiveCrops: [
        {
          cropId: "crop_mobile",
          breakpoint: "mobile",
          aspectRatio: "4:5",
          focalPoint: { x: 0.4, y: 0.3 },
        },
      ],
    });
    expect(
      migrated.artDirection?.responsiveTreatments.find(({ breakpoint }) => breakpoint === "mobile")
        ?.treatment,
    ).toMatchObject({
      ratio: "portrait",
      approvedCropId: "crop_mobile",
      approvedAspectRatio: "4:5",
      focalPoint: { x: 0.4, y: 0.3 },
    });
  });
});
