import { describe, expect, it } from "vitest";
import {
  migrateLegacyDynamicCommerceRoutes,
  resolveDynamicCommerceRoutePage,
} from "@/application/dynamic-commerce-routes";
import {
  materializeCommerceUtilityPage,
  type CommercialUtilityProfileId,
} from "@/application/storefront-templates";
import { selectBoundedRelatedProductIds } from "@/application/whole-storefront-generation-plan";
import { aurumNordicSeed } from "@/data/seed";
import {
  canonicalValueString,
  PAGE_FAMILY_AUTHORITY_VERSION,
  type PageFamilyId,
  type PageModel,
} from "@/domain/storefront";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";
import type { ProjectAggregate } from "@/services/storage";
import { createLegacyDynamicCommerceRouteScenario } from "../fixtures/p10b-16p-01-dynamic-commerce-route-scenarios";

function productPresentationWithCanonicalDisplayCopy() {
  const scenario = createLegacyDynamicCommerceRouteScenario();
  const catalogue = structuredClone(scenario.catalogue);
  const product = catalogue.products[0];
  if (!product) throw new Error("Expected a canonical product fixture.");
  product.description = {
    en: "Demo Edition is the approved customer-facing product name.",
    fi: "Demo Edition on hyväksytty asiakkaalle näkyvä tuotenimi.",
  };
  product.availabilityLabel = {
    en: "Made to order",
    fi: "Valmistetaan tilauksesta",
  };
  product.stockStatus = "inStock";
  product.attributes = {
    ...product.attributes,
    approvedMaterial: "gold",
    edition: "Demo Edition",
  };

  const migration = migrateLegacyDynamicCommerceRoutes(scenario.legacySnapshot, catalogue);
  if (migration.status !== "migrated") throw new Error("Expected deterministic route migration.");
  const route = migration.authority.routeInventory.find(
    (candidate) => candidate.kind === "product" && candidate.productId === product.id,
  );
  if (!route) throw new Error("Expected the exact product route.");
  const resolved = resolveDynamicCommerceRoutePage({
    snapshot: migration.snapshot,
    catalogue,
    routeId: route.id,
  });
  const aggregate: ProjectAggregate = {
    project: structuredClone(scenario.project),
    catalogue,
    snapshots: [structuredClone(migration.snapshot)],
  };
  const baseline = canonicalValueString(aggregate.catalogue);
  const presentation = createCatalogueStorefrontCommerceRouteAdapter().product({
    aggregate,
    snapshot: migration.snapshot,
    page: resolved.page,
    product,
  });
  if (!presentation) throw new Error("Expected a canonical product presentation.");
  return { aggregate, baseline, presentation, product };
}

function utilityPage(profileId: CommercialUtilityProfileId, familyId: PageFamilyId): PageModel {
  return {
    id: `page_${profileId.replaceAll("-", "_")}`,
    type: familyId === "cart" || familyId === "checkout" ? familyId : "content",
    slug: familyId === "cart" || familyId === "checkout" ? `/${familyId}` : `/states/${familyId}`,
    title: { en: "Utility", fi: "Aputila" },
    seo: {
      title: { en: "Utility", fi: "Aputila" },
      metaDescription: { en: "Utility", fi: "Aputila" },
    },
    sections: [],
    pageFamily: {
      familyId,
      familyVersion: PAGE_FAMILY_AUTHORITY_VERSION,
      profileId,
      profileVersion: "1.0.0",
      localeCoverage: ["en", "fi"],
      sharedFrameId: "blueprint-shared-storefront-frame",
      sharedFrameVersion: "1.0.0",
      commerceContext: { kind: "none" },
      commerceOperationAuthority: "presentation-only",
      navigationAreas: [],
      evidenceReferences: [],
    },
  };
}

describe("P10B-16P-04J commerce presentation safety", () => {
  it("projects canonical display copy without heuristic text suppression", () => {
    const { aggregate, baseline, presentation } = productPresentationWithCanonicalDisplayCopy();
    const rendered = canonicalValueString(presentation.productContext);

    expect(presentation.productContext.description).toEqual({
      en: "Demo Edition is the approved customer-facing product name.",
      fi: "Demo Edition on hyväksytty asiakkaalle näkyvä tuotenimi.",
    });
    expect(presentation.productContext.availability).toEqual({
      en: "Made to order",
      fi: "Valmistetaan tilauksesta",
    });
    expect(rendered).toContain("Demo Edition");
    expect(rendered).toContain("Approved Material");
    expect(canonicalValueString(aggregate.catalogue)).toBe(baseline);
  });

  it("formats the same canonical EUR amount for the active English and Finnish locales", () => {
    const { presentation, product } = productPresentationWithCanonicalDisplayCopy();
    const price = product.price;
    if (!price || !presentation.productContext.price) throw new Error("Expected current price.");

    expect(presentation.productContext.price.formatted).toEqual({
      en: new Intl.NumberFormat("en-FI", {
        style: "currency",
        currency: price.currency,
        minimumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(price.amount),
      fi: new Intl.NumberFormat("fi-FI", {
        style: "currency",
        currency: price.currency,
        minimumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(price.amount),
    });
  });

  it("uses bounded canonical ordering for related merchandising without mutating the catalogue", () => {
    const catalogue = structuredClone(aurumNordicSeed.catalogue);
    const baseline = canonicalValueString(catalogue);

    expect(selectBoundedRelatedProductIds(catalogue, "product_aava_necklace_925")).toEqual([
      "product_sisu_automatic_watch",
      "product_kajo_earrings_585",
      "product_meri_bracelet_925",
      "product_aurora_ring_585",
    ]);
    expect(selectBoundedRelatedProductIds(catalogue, "product_aurora_ring_585")).toEqual([
      "product_lumi_halo_ring",
      "product_aava_necklace_925",
      "product_sisu_automatic_watch",
      "product_kajo_earrings_585",
    ]);
    expect(canonicalValueString(catalogue)).toBe(baseline);
  });

  it("excludes unavailable products from bounded related merchandising", () => {
    const catalogue = structuredClone(aurumNordicSeed.catalogue);
    const unavailable = catalogue.products.find(({ id }) => id === "product_sisu_automatic_watch");
    if (!unavailable) throw new Error("Expected Aurum watch fixture.");
    unavailable.stockStatus = "outOfStock";

    const selected = selectBoundedRelatedProductIds(catalogue, "product_aava_necklace_925");
    expect(selected).not.toContain(unavailable.id);
    expect(selected).toHaveLength(4);
  });

  it("uses customer language for cart, checkout and no-results presentation", () => {
    const pages = [
      materializeCommerceUtilityPage(
        utilityPage("commerce-utility-cart", "cart"),
        "commerce-utility-cart",
      ),
      materializeCommerceUtilityPage(
        utilityPage("commerce-utility-checkout", "checkout"),
        "commerce-utility-checkout",
      ),
      materializeCommerceUtilityPage(
        utilityPage("commerce-utility-no-results", "no-results"),
        "commerce-utility-no-results",
      ),
    ];
    const rendered = canonicalValueString(
      pages.flatMap(({ sections }) => sections.map(({ content }) => content)),
    );

    expect(rendered).toContain("Review your items before continuing to checkout.");
    expect(rendered).toContain("Review your order details before continuing.");
    expect(rendered).toContain("No products matched");
    expect(rendered).not.toMatch(/authority|canonical products|secure checkout|valtuus|kanonista/i);
  });
});
