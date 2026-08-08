import { render } from "@testing-library/react";
import type { CSSProperties } from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CanonicalProductCard } from "@/components/storefront/canonical-product-card";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { createResponsiveImageAuthority } from "@/domain/asset-presentation";
import type {
  ProductPresentationContext,
  StorefrontAssetMetadata,
} from "@/domain/component-platform";
import {
  canonicalProductCardAuthority,
  canonicalProductCardFactsFingerprint,
  canonicalProductCardRequestSchema,
  migrateCanonicalProductCardAnatomy,
  requireCanonicalProductCardAnatomy,
} from "@/domain/product-card";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { validateRegisteredSnapshot } from "@/components/registry";

const product: ProductPresentationContext = {
  productId: "product_card_watch",
  productTypeId: "watch",
  sku: "WATCH-CARD-1",
  title: { en: "Canonical watch", fi: "Kanoninen kello" },
  price: { amount: 249, currency: "EUR", formatted: { en: "€249", fi: "249 €" } },
  compareAtPrice: { amount: 299, currency: "EUR", formatted: { en: "€299", fi: "299 €" } },
  availability: { en: "In stock", fi: "Varastossa" },
  media: [{ assetId: "asset_card_watch", role: "main", alt: { en: "Watch", fi: "Kello" } }],
  attributeGroups: [
    {
      id: "card_facts",
      title: { en: "Details", fi: "Tiedot" },
      attributes: [
        {
          id: "card_material",
          label: { en: "Material", fi: "Materiaali" },
          value: { en: "Steel", fi: "Teräs" },
        },
      ],
    },
  ],
  optionGroups: [],
  selectedValues: [],
  unavailableCombinations: [],
  relatedProductIds: [],
  revision: "product-card-revision-1",
};

const source = {
  assetId: "asset_card_watch",
  role: "productMainImage" as const,
  revision: product.revision,
  materialFingerprint: `fixture-${canonicalValueFingerprint(product.media[0])}`,
  provenanceKind: "canonicalProductMedia" as const,
  sourceOwnerId: product.productId,
};
const artDirection = createResponsiveImageAuthority({
  contractVersion: "1.0.0",
  source,
  placement: {
    componentType: "homepageFeaturedProducts",
    componentVersion: "2.0.0",
    variant: "standard",
    anatomyContractVersion: "1.0.0",
    anatomyIdentity: "homepageFeaturedProducts.anatomy",
    anatomyVersion: "1.0.0",
    anatomyRegion: "media",
    assetSlotId: "productMedia",
    required: false,
  },
  safeArea: { x: 0, y: 0, width: 1, height: 1 },
  sourceTreatment: {
    ratio: "portrait",
    crop: { mode: "contain" },
    focalPoint: { x: 0.5, y: 0.45 },
    overlay: "none",
  },
  responsiveTreatments: [
    {
      breakpoint: "mobile",
      treatment: {
        ratio: "portrait",
        crop: { mode: "contain" },
        focalPoint: { x: 0.5, y: 0.45 },
        overlay: "none",
      },
    },
  ],
  derivatives: [],
});
const asset: StorefrontAssetMetadata = {
  assetId: source.assetId,
  role: source.role,
  alt: product.media[0].alt,
  decorative: false,
  provenance: { kind: "canonicalProductMedia", sourceId: product.productId },
  approvalStatus: "approved",
  usageRights: "merchantOwned",
  responsiveCrops: [],
  artDirection,
  revision: product.revision,
};

const request = (anatomyId = "standard", context = "homepageMerchandising") => ({
  anatomyId,
  context,
  product,
  media: product.media[0],
  asset,
  showCanonicalBadge: true,
  conciseAttributeLimit: 1,
});

describe("P10B-08 canonical product-card family", () => {
  it("owns exactly one fingerprinted authority with five meaningful anatomies", () => {
    expect(canonicalProductCardAuthority.identity).toBe("canonicalProductCardFamily");
    expect(canonicalProductCardAuthority.anatomies).toHaveLength(5);
    expect(
      canonicalProductCardAuthority.anatomies.every(
        ({ semantics }) => semantics.classification === "meaningfulStructuralVariant",
      ),
    ).toBe(true);
    expect(
      canonicalProductCardAuthority.fingerprint.endsWith(
        canonicalValueFingerprint({
          contractVersion: canonicalProductCardAuthority.contractVersion,
          identity: canonicalProductCardAuthority.identity,
          version: canonicalProductCardAuthority.version,
          requiredCommerceFields: canonicalProductCardAuthority.requiredCommerceFields,
          anatomies: canonicalProductCardAuthority.anatomies,
          migrationAliases: canonicalProductCardAuthority.migrationAliases,
        }),
      ),
    ).toBe(true);
  });

  it("realizes five different structural hierarchies and never counts finishing-only aliases", () => {
    const signatures = canonicalProductCardAuthority.anatomies.map(({ semantics }) =>
      canonicalValueFingerprint(semantics.structure),
    );
    expect(new Set(signatures).size).toBe(5);
    expect(
      canonicalProductCardAuthority.anatomies.filter(
        ({ semantics }) => semantics.classification === "finishingOnlyVariation",
      ),
    ).toHaveLength(0);
  });

  it("renders identical protected facts, identity and media lineage in every supported context", () => {
    const contexts = [
      "homepageMerchandising",
      "collectionResults",
      "searchResults",
      "relatedProducts",
    ] as const;
    const fingerprints = contexts.map((context) => {
      const rendered = render(
        <CanonicalProductCard
          locale={{ activeLocale: "en", primaryLocale: "en" }}
          mediaPlaceholder="Unavailable"
          request={request("standard", context)}
          resolvedAsset={{
            id: source.assetId,
            url: "/watch.jpg",
            alt: product.media[0].alt,
            decorative: false,
          }}
        />,
      );
      const card = rendered.container.querySelector("article")!;
      expect(card).toHaveAttribute("data-product-id", product.productId);
      expect(card).toHaveTextContent("€249");
      expect(card).toHaveTextContent("In stock");
      expect(card.querySelector("figure")).toHaveAttribute(
        "data-product-media-owner",
        product.productId,
      );
      const fingerprint = card.getAttribute("data-card-facts-fingerprint");
      rendered.unmount();
      return fingerprint;
    });
    expect(new Set(fingerprints).size).toBe(1);
    expect(fingerprints[0]).toBe(
      canonicalProductCardFactsFingerprint({ product, media: product.media[0], asset }),
    );
  });

  it("formats fallback prices with the active storefront locale", () => {
    const fallbackProduct = {
      ...product,
      price: { amount: 249, currency: "EUR" },
      compareAtPrice: undefined,
    };
    const fallbackRequest = {
      ...request(),
      product: fallbackProduct,
      media: fallbackProduct.media[0],
    };

    const english = render(
      <CanonicalProductCard
        locale={{ activeLocale: "en", primaryLocale: "en" }}
        mediaPlaceholder="Unavailable"
        request={fallbackRequest}
        resolvedAsset={{ id: source.assetId, url: "/watch.jpg", decorative: false }}
      />,
    );
    expect(english.container.querySelector("[data-card-region='price']")).toHaveTextContent("€249");
    english.unmount();

    const finnish = render(
      <CanonicalProductCard
        locale={{ activeLocale: "fi", primaryLocale: "fi" }}
        mediaPlaceholder="Unavailable"
        request={fallbackRequest}
        resolvedAsset={{ id: source.assetId, url: "/watch.jpg", decorative: false }}
      />,
    );
    expect(finnish.container.querySelector("[data-card-region='price']")).toHaveTextContent(
      "249 €",
    );
  });

  it("rejects wrong-product media, editorial substitution and invented fact or badge overrides", () => {
    expect(() =>
      canonicalProductCardRequestSchema.parse({
        ...request(),
        asset: {
          ...asset,
          provenance: { kind: "canonicalProductMedia", sourceId: "product_wrong" },
        },
      }),
    ).toThrow(/exact canonical media owned by the product/i);
    expect(() =>
      canonicalProductCardRequestSchema.parse({
        ...request(),
        media: { ...product.media[0], role: "editorial" },
      }),
    ).toThrow(/exact canonical media/i);
    for (const invented of [
      { badge: "Best seller" },
      { price: { amount: 1, currency: "EUR" } },
      { availability: { en: "Only one left" } },
    ]) {
      expect(() =>
        canonicalProductCardRequestSchema.parse({ ...request(), ...invented }),
      ).toThrow();
    }
  });

  it("allows compatible context selection and fails closed for an incompatible anatomy", () => {
    expect(requireCanonicalProductCardAnatomy("compact", "searchResults").semanticName).toBe(
      "compact",
    );
    expect(() => requireCanonicalProductCardAnatomy("editorial", "searchResults")).toThrow(
      /not supported/i,
    );
  });

  it("preserves registered responsive transformations at the four storefront widths", () => {
    for (const anatomy of canonicalProductCardAuthority.anatomies) {
      expect(anatomy.responsiveTransformations).not.toHaveLength(0);
      expect(anatomy.semantics.structure.responsiveTransformationIds).toEqual(
        anatomy.responsiveTransformations.map(({ id }) => id),
      );
    }
    const css = readFileSync("src/components/storefront/canonical-product-card.module.css", "utf8");
    expect(css).toContain("max-width: 767px");
    expect(css).toContain("max-width: 1023px");
    expect(artDirection.responsiveTreatments.map(({ breakpoint }) => breakpoint)).toContain(
      "mobile",
    );
  });

  it("lets Design DNA variables change presentation without changing protected facts", () => {
    const first = render(
      <div style={{ "--brand-radius": "0px" } as CSSProperties}>
        <CanonicalProductCard
          locale={{ activeLocale: "en", primaryLocale: "en" }}
          mediaPlaceholder="Unavailable"
          request={request()}
          resolvedAsset={{ id: source.assetId, url: "/watch.jpg", decorative: false }}
        />
      </div>,
    );
    const fingerprint = first.container
      .querySelector("article")
      ?.getAttribute("data-card-facts-fingerprint");
    first.unmount();
    const second = render(
      <div style={{ "--brand-radius": "24px" } as CSSProperties}>
        <CanonicalProductCard
          locale={{ activeLocale: "en", primaryLocale: "en" }}
          mediaPlaceholder="Unavailable"
          request={request()}
          resolvedAsset={{ id: source.assetId, url: "/watch.jpg", decorative: false }}
        />
      </div>,
    );
    expect(second.container.querySelector("article")).toHaveAttribute(
      "data-card-facts-fingerprint",
      fingerprint,
    );
  });

  it("keeps legacy wrappers renderable but explicitly non-selectable", () => {
    for (const type of ["productGrid", "relatedProducts"]) {
      const definition = veskifyComponentDefinitionsV2.find(
        (candidate) => candidate.type === type,
      )!;
      expect(
        definition.commercialAnatomy?.variants.every(
          ({ classification, supersededBy }) =>
            classification === "legacySuperseded" && supersededBy === "canonicalProductCardFamily",
        ),
      ).toBe(true);
    }
  });

  it("migrates old anatomy aliases deterministically and keeps old valid snapshots valid", () => {
    expect(migrateCanonicalProductCardAnatomy("grid")).toBe("horizontal");
    expect(migrateCanonicalProductCardAnatomy("premiumJewellery")).toBe("imageFirst");
    expect(migrateCanonicalProductCardAnatomy("denseComparison")).toBe("horizontal");
    expect(
      validateRegisteredSnapshot(
        structuredClone(aurumNordicSeed.draftSnapshot),
        aurumNordicSeed.catalogue,
        "en",
        "en",
      ),
    ).toEqual(aurumNordicSeed.draftSnapshot);
  });
});
