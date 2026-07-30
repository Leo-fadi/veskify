// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import { compileWholeStorefrontProposal } from "@/application/whole-storefront-proposal-lifecycle";
import {
  dynamicCollectionCommerceDefinition,
  dynamicProductDetailDefinition,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import {
  P9_05A_COMPLEX_PRODUCT_ID,
  P9_05A_SIMPLE_PRODUCT_ID,
  createP905aFreshMerchantFixture,
  p905aDirectionScenarios,
} from "@/data/demo/p9-05a-fresh-store-generation";
import { canonicalValueFingerprint } from "@/domain/storefront";

const directionIds = ["premiumEditorial", "modernTechnical"] as const;

const collectionCapabilityMatrix = {
  collectionHeader: "dynamicCollectionCommerce variant and showDescription",
  filteringDiscovery: "filterLayout and canonical filters",
  collectionNavigation: "showChildCollections and collection bindings",
  productCards: "cardVariant",
  productGrid: "gridDensity",
} as const;

const productCapabilityMatrix = {
  gallery: "galleryLayout and mediaTreatment",
  information: "variant, showDescription and showSku",
  options: "optionDensity and canonical option groups",
  specifications: "attributeLayout",
  purchasingArea: "primary action and stickyMobileAction",
  recommendations: "relatedProducts binding and related heading",
} as const;

function compiled(directionId: (typeof directionIds)[number]) {
  const planningInput = structuredClone(createP905aFreshMerchantFixture(directionId).planningInput);
  const plan = createWholeStorefrontGenerationPlan(planningInput, { directionId });
  return {
    planningInput,
    plan,
    proposal: compileWholeStorefrontProposal({ plan, planningInput }),
  };
}

function requiredComponent(
  proposal: ReturnType<typeof compiled>["proposal"],
  pageType: "collection" | "product",
  componentType: "dynamicCollectionCommerce" | "dynamicProductDetail",
) {
  const page = proposal.proposedStorefront.pages.find((candidate) => candidate.type === pageType);
  const component = page?.components.find((candidate) => candidate.component === componentType);
  if (!component) throw new Error(`Missing ${componentType} on ${pageType}.`);
  return component;
}

describe("P9R-03 collection and PDP generation depth", () => {
  it("registers every curated collection and PDP capability for all renderer targets", () => {
    expect(Object.keys(collectionCapabilityMatrix)).toHaveLength(5);
    expect(Object.keys(productCapabilityMatrix)).toHaveLength(6);
    expect(dynamicCollectionCommerceDefinition.variants.map((variant) => variant.id)).toEqual(
      expect.arrayContaining(["editorial", "compact"]),
    );
    expect(dynamicProductDetailDefinition.variants.map((variant) => variant.id)).toEqual(
      expect.arrayContaining(["editorialSplit", "compact"]),
    );
    [dynamicCollectionCommerceDefinition, dynamicProductDetailDefinition].forEach((definition) => {
      expect(definition.renderer.supportedTargets).toEqual(["editor", "preview", "published"]);
      expect(veskifyComponentRegistryV2.get(definition.type)).toBeDefined();
    });
  });

  it("keeps editorial and modern technical collection/PDP compositions planner-visible and compiler-preserved", () => {
    const compositions = directionIds.map((directionId) => {
      const { plan, proposal } = compiled(directionId);
      return {
        directionId,
        collection: requiredComponent(proposal, "collection", "dynamicCollectionCommerce"),
        product: requiredComponent(proposal, "product", "dynamicProductDetail"),
        presentation: plan.designSystemSelection,
      };
    });
    const editorial = compositions[0];
    const technical = compositions[1];

    expect(editorial.collection).toMatchObject({
      variant: "editorial",
      props: { gridDensity: "spacious", cardVariant: "imageFirst", filterLayout: "horizontal" },
    });
    expect(editorial.product).toMatchObject({
      variant: "editorialSplit",
      props: { galleryLayout: "grid", optionDensity: "comfortable", attributeLayout: "groups" },
    });
    expect(technical.collection).toMatchObject({
      variant: "compact",
      props: { gridDensity: "compact", cardVariant: "compact", filterLayout: "sidebar" },
    });
    expect(technical.product).toMatchObject({
      variant: "compact",
      props: { galleryLayout: "thumbnails", optionDensity: "compact", attributeLayout: "table" },
    });
    expect(editorial.collection).not.toEqual(technical.collection);
    expect(editorial.product).not.toEqual(technical.product);
  });

  it("stores only registered collection/PDP instances with simple and complex canonical commerce intact", () => {
    directionIds.forEach((directionId) => {
      const { planningInput, proposal } = compiled(directionId);
      const collection = requiredComponent(proposal, "collection", "dynamicCollectionCommerce");
      const product = requiredComponent(proposal, "product", "dynamicProductDetail");
      const catalogue = planningInput.catalogue;
      const simple = catalogue.products.find(
        (candidate) => candidate.id === P9_05A_SIMPLE_PRODUCT_ID,
      );
      const complex = catalogue.products.find(
        (candidate) => candidate.id === P9_05A_COMPLEX_PRODUCT_ID,
      );
      expect(simple).toBeDefined();
      expect(complex?.variants.length).toBeGreaterThan(1);
      expect(collection.bindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "productList",
            productIds: catalogue.collections[0]?.productIds,
          }),
        ]),
      );
      expect(product.bindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: "product", productId: P9_05A_COMPLEX_PRODUCT_ID }),
        ]),
      );
      expect(proposal.proposedStorefront.pages.flatMap((page) => page.components)).toEqual(
        expect.arrayContaining([collection, product]),
      );
    });
  });

  it("preserves protected commerce and approved canonical media across both compositions", () => {
    const protectedFingerprints = directionIds.map((directionId) => {
      const { planningInput, proposal } = compiled(directionId);
      const protectedCommerce = {
        products: planningInput.catalogue.products.map((product) => ({
          id: product.id,
          sku: product.sku,
          variants: product.variants,
          images: product.images,
        })),
        collections: planningInput.catalogue.collections.map((collection) => ({
          id: collection.id,
          productIds: collection.productIds,
        })),
      };
      expect(proposal.preconditions.canonicalCommerceFingerprint).toBe(
        `canonical-commerce-${canonicalValueFingerprint(planningInput.catalogue)}`,
      );
      return canonicalValueFingerprint(protectedCommerce);
    });
    expect(new Set(protectedFingerprints)).toHaveLength(1);
    expect(p905aDirectionScenarios.modernTechnical.expected.collectionPresentation).toMatchObject({
      variant: "compact",
      gridDensity: "compact",
      cardVariant: "compact",
      filterLayout: "sidebar",
    });
    expect(p905aDirectionScenarios.modernTechnical.expected.productPresentation).toMatchObject({
      variant: "compact",
      galleryLayout: "thumbnails",
      optionDensity: "compact",
      attributeLayout: "table",
    });
  });
});
