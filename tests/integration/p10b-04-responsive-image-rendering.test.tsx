import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResponsiveStorefrontImage } from "@/components/storefront/responsive-storefront-image";
import { dynamicCollectionCommerceDefinition } from "@/components/registry/dynamic-collection-commerce";
import { dynamicProductDetailDefinition } from "@/components/registry/dynamic-product-detail";
import {
  migrateApprovedPresentationArtDirection,
  validateResponsiveImageAuthority,
} from "@/application/responsive-image-authority";
import { resolveBrandSystemDesignDna } from "@/domain/design-system";
import {
  createResponsiveImageAuthority,
  responsiveImageAuthoritySchema,
} from "@/domain/asset-presentation";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";
import { aurumNordicSeed } from "@/data/seed";
import type { ProjectAggregate } from "@/services/storage";
import {
  createP905aAcceptanceCoordinator,
  generateP905aScenario,
  saveAndResolveP905aPreview,
} from "../helpers/p9-05a-generation-harness";
import { homepageHeroDefinition } from "@/components/registry/homepage-commerce";

function aggregate(): ProjectAggregate {
  return {
    project: structuredClone(aurumNordicSeed.project),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    snapshots: [
      structuredClone(aurumNordicSeed.publishedSnapshot),
      structuredClone(aurumNordicSeed.draftSnapshot),
    ],
  };
}

function productPresentation() {
  const value = aggregate();
  const snapshot = value.snapshots.find(({ id }) => id === value.project.draftSnapshotId)!;
  const page = snapshot.pages.find(({ type }) => type === "product")!;
  const productId = String(
    page.sections.find(({ component }) => component === "productGallery")!.content.productId,
  );
  const product = value.catalogue.products.find(({ id }) => id === productId)!;
  return {
    value,
    snapshot,
    product,
    presentation: createCatalogueStorefrontCommerceRouteAdapter().product({
      aggregate: value,
      snapshot,
      page,
      product,
    })!,
  };
}

describe("P10B-04 responsive image renderer integration", () => {
  it("projects same-product authority into the PDP without replacing canonical media", () => {
    const { snapshot, product, presentation } = productPresentation();
    const media = presentation.projection.assets.find(({ role }) => role === "productMainImage")!;
    expect(media.provenance).toEqual(
      expect.objectContaining({ kind: "canonicalProductMedia", sourceId: product.id }),
    );
    expect(
      validateResponsiveImageAuthority({
        authority: media.artDirection,
        component: dynamicProductDetailDefinition,
        dna: resolveBrandSystemDesignDna(snapshot.brandSystem),
        expectedProductId: product.id,
      }).source.assetId,
    ).toBe(media.assetId);
  });

  it("projects same-product authority into collection product cards", () => {
    const value = aggregate();
    const snapshot = value.snapshots.find(({ id }) => id === value.project.draftSnapshotId)!;
    const page = snapshot.pages.find(({ type }) => type === "collection")!;
    const collection = value.catalogue.collections[0];
    if (!collection) throw new Error("Missing collection fixture.");
    const presentation = createCatalogueStorefrontCommerceRouteAdapter().collection({
      aggregate: value,
      snapshot,
      page,
      collection,
    })!;
    const media = presentation.projection.assets.find(({ role }) => role === "productMainImage")!;
    const ownerId = media.provenance.sourceId;
    expect(
      validateResponsiveImageAuthority({
        authority: media.artDirection,
        component: dynamicCollectionCommerceDefinition,
        dna: resolveBrandSystemDesignDna(snapshot.brandSystem),
        expectedProductId: ownerId,
      }).source.sourceOwnerId,
    ).toBe(ownerId);
  });

  it("renders semantic picture sources for all four controlled breakpoints", () => {
    const { presentation } = productPresentation();
    const metadata = presentation.projection.assets.find(
      ({ role }) => role === "productMainImage",
    )!;
    const authority = responsiveImageAuthoritySchema.parse(metadata.artDirection);
    const rendered = render(
      <ResponsiveStorefrontImage
        alt="Canonical product"
        asset={{
          id: metadata.assetId,
          url: presentation.resolveAssetUrl(metadata.assetId),
          decorative: false,
          alt: { en: "Canonical product" },
        }}
        authority={authority}
      />,
    );
    expect(rendered.getByRole("img", { name: "Canonical product" })).toBeVisible();
    const image = rendered.getByRole("img", { name: "Canonical product" });
    const sources = [...rendered.container.querySelectorAll("picture source")];
    expect(sources).toHaveLength(4);
    expect(new Set(sources.map((source) => source.getAttribute("srcset")))).toEqual(
      new Set([image.getAttribute("src")]),
    );
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveAttribute("fetchpriority", "auto");
    expect(image).toHaveAttribute(
      "sizes",
      "(max-width: 767px) 100vw, (max-width: 1439px) 75vw, 64rem",
    );
    expect(rendered.container.querySelector("[data-art-direction-fingerprint]")).toHaveAttribute(
      "data-art-direction-fingerprint",
      authority.fingerprint,
    );
  });

  it("applies bounded loading and intrinsic-size authority by presentation role", () => {
    const asset = {
      id: "asset_role_test",
      url: "https://assets.example.test/image.jpg",
      decorative: false,
      alt: { en: "Role-aware image" },
    };
    const cases = [
      { role: "primary" as const, loading: "eager", priority: "high", sizes: "100vw" },
      {
        role: "merchandising" as const,
        loading: "lazy",
        priority: "auto",
        sizes: "(max-width: 767px) 100vw, (max-width: 1023px) 50vw, (max-width: 1439px) 33vw, 25vw",
      },
      { role: "thumbnail" as const, loading: "lazy", priority: "low", sizes: "6rem" },
    ];

    for (const expected of cases) {
      const rendered = render(
        <ResponsiveStorefrontImage
          alt="Role-aware image"
          asset={asset}
          loadingRole={expected.role}
        />,
      );
      const image = rendered.getByRole("img", { name: "Role-aware image" });
      expect(image).toHaveAttribute("data-image-loading-role", expected.role);
      expect(image).toHaveAttribute("loading", expected.loading);
      expect(image).toHaveAttribute("fetchpriority", expected.priority);
      expect(image).toHaveAttribute("decoding", "async");
      expect(image).toHaveAttribute("sizes", expected.sizes);
      expect(image).toHaveAttribute("src", asset.url);
      rendered.unmount();
    }
  });

  it("preserves exact art direction across JSON save-and-reload projection", () => {
    const { presentation } = productPresentation();
    const authority = presentation.projection.assets.find(
      ({ role }) => role === "productMainImage",
    )!.artDirection!;
    expect(responsiveImageAuthoritySchema.parse(JSON.parse(JSON.stringify(authority)))).toEqual(
      authority,
    );
  });

  it("applies the exact normalized editorial crop rectangle at every breakpoint", () => {
    const { presentation } = productPresentation();
    const metadata = presentation.projection.assets.find(
      ({ role }) => role === "productMainImage",
    )!;
    const current = responsiveImageAuthoritySchema.parse(metadata.artDirection);
    const { fingerprint, ...material } = current;
    void fingerprint;
    const crop = {
      mode: "editorial" as const,
      rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.5 },
    };
    material.sourceTreatment = { ...material.sourceTreatment, crop };
    material.responsiveTreatments = material.responsiveTreatments.map((entry) => ({
      ...entry,
      treatment: { ...entry.treatment, crop },
    }));
    const authority = createResponsiveImageAuthority(material);
    const rendered = render(
      <ResponsiveStorefrontImage
        alt="Editorial crop"
        asset={{
          id: metadata.assetId,
          url: presentation.resolveAssetUrl(metadata.assetId),
          decorative: false,
          alt: { en: "Editorial crop" },
        }}
        authority={authority}
      />,
    );
    const frame = rendered.container.querySelector<HTMLElement>("[data-art-direction-contract]");
    expect(frame?.style.getPropertyValue("--art-mobile-crop-left")).toBe("-25%");
    expect(frame?.style.getPropertyValue("--art-mobile-crop-top")).toBe("-40%");
    expect(frame?.style.getPropertyValue("--art-mobile-crop-width")).toBe("250%");
    expect(frame?.style.getPropertyValue("--art-mobile-crop-height")).toBe("200%");
    expect(
      rendered.container.querySelectorAll('[data-art-crop-rect="0.1,0.2,0.4,0.5"]'),
    ).toHaveLength(4);
  });

  it("preserves authored approved presentation authority through repository save and reload", async () => {
    const generated = await generateP905aScenario("premiumEditorial");
    const accepted = createP905aAcceptanceCoordinator(generated).accept();
    if (accepted.state !== "accepted") throw new Error("Expected accepted storefront fixture.");
    const snapshot = structuredClone(accepted.activeDraft);
    const hero = snapshot.pages
      .find(({ type }) => type === "home")
      ?.sections.find(({ component }) => component === "homepageHero");
    const placement = hero?.approvedAssetPlacements?.[0];
    const presentation = hero?.approvedAssetPresentations?.[0];
    if (!hero || !placement || !presentation) throw new Error("Missing approved hero fixture.");
    const authored = migrateApprovedPresentationArtDirection({
      presentation,
      placement,
      component: homepageHeroDefinition,
      variant: hero.variant,
      dna: resolveBrandSystemDesignDna(snapshot.brandSystem),
      provenanceKind: "merchantProvided",
    });
    hero.approvedAssetPresentations = [authored];

    const saved = await saveAndResolveP905aPreview({ generated, accepted: snapshot });
    const reloaded = saved.preview.pages
      .find(({ type }) => type === "home")
      ?.sections.find(({ id }) => id === hero.id)?.approvedAssetPresentations?.[0];
    expect(reloaded?.artDirection).toEqual(authored.artDirection);
  });
});
