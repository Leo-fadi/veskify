// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  WholeStorefrontProposalAcceptanceCoordinator,
} from "@/application/whole-storefront-proposal-lifecycle";
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

function compiled(directionId: (typeof directionIds)[number]) {
  const planningInput = structuredClone(createP905aFreshMerchantFixture(directionId).planningInput);
  const plan = createWholeStorefrontGenerationPlan(planningInput, { directionId });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const accepted = new WholeStorefrontProposalAcceptanceCoordinator({
    proposal,
    currentInput: () => ({ plan, planningInput }),
  }).accept();
  return {
    planningInput,
    plan,
    proposal,
    accepted,
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

function requiredPlannedComponent(
  plan: ReturnType<typeof compiled>["plan"],
  role: "collection-template" | "product-template",
  componentType: "dynamicCollectionCommerce" | "dynamicProductDetail",
) {
  const page = plan.pagePlans.find((candidate) => candidate.role === role);
  const component = page?.components.find(
    (candidate): candidate is Extract<(typeof page.components)[number], { instance: unknown }> =>
      "instance" in candidate && candidate.instance.component === componentType,
  );
  if (!component) throw new Error(`Missing planned ${componentType}.`);
  return component.instance;
}

function requiredStoredComponent(
  accepted: ReturnType<typeof compiled>["accepted"],
  pageType: "collection" | "product",
  componentType: "dynamicCollectionCommerce" | "dynamicProductDetail",
) {
  const page = accepted.activeStorefront.pages.find((candidate) => candidate.type === pageType);
  const component = page?.components.find((candidate) => candidate.component === componentType);
  if (!component) throw new Error(`Missing stored ${componentType}.`);
  return component;
}

function generatedCommerceState(
  planningInput: ReturnType<typeof compiled>["planningInput"],
  accepted: ReturnType<typeof compiled>["accepted"],
) {
  const collection = requiredStoredComponent(accepted, "collection", "dynamicCollectionCommerce");
  const product = requiredStoredComponent(accepted, "product", "dynamicProductDetail");
  const collectionBinding = collection.bindings.find(
    (binding) => binding.slotId === "primaryCollection" && binding.source === "collection",
  );
  const productListBinding = collection.bindings.find(
    (binding) => binding.slotId === "collectionProducts" && binding.source === "productList",
  );
  const primaryProductBinding = product.bindings.find(
    (binding) => binding.slotId === "primaryProduct" && binding.source === "product",
  );
  const relatedProductsBinding = product.bindings.find(
    (binding) => binding.slotId === "relatedProducts" && binding.source === "productList",
  );
  if (
    collectionBinding?.source !== "collection" ||
    productListBinding?.source !== "productList" ||
    primaryProductBinding?.source !== "product"
  ) {
    throw new Error("Generated commerce components lost their canonical bindings.");
  }
  const generatedProductIds = [
    ...productListBinding.productIds,
    primaryProductBinding.productId,
    ...(relatedProductsBinding?.source === "productList" ? relatedProductsBinding.productIds : []),
  ];
  const products = [...new Set(generatedProductIds)].sort().map((productId) => {
    const canonical = planningInput.catalogue.products.find(
      (candidate) => candidate.id === productId,
    );
    if (!canonical) throw new Error(`Generated state references unknown product ${productId}.`);
    return {
      id: canonical.id,
      sku: canonical.sku,
      price: canonical.price,
      compareAtPrice: canonical.compareAtPrice,
      stockStatus: canonical.stockStatus,
      variants: canonical.variants,
      attributes: canonical.attributes,
      orderOptions: canonical.orderOptions,
      images: canonical.images,
    };
  });
  const canonicalCollection = planningInput.catalogue.collections.find(
    (candidate) => candidate.id === collectionBinding.collectionId,
  );
  if (!canonicalCollection) {
    throw new Error(
      `Generated state references unknown collection ${collectionBinding.collectionId}.`,
    );
  }
  return {
    products,
    collections: [
      {
        id: canonicalCollection.id,
        productIds: canonicalCollection.productIds,
        generatedProductIds: productListBinding.productIds,
      },
    ],
    approvedAssetContextFingerprint: accepted.activeStorefront.approvedAssetContextFingerprint,
    approvedAssetIds: planningInput.approvedAssetContext?.assets.map((asset) => ({
      id: asset.assetId,
      provenance: asset.provenance,
    })),
  };
}

describe("P9R-03 collection and PDP generation depth", () => {
  it("carries every claimed collection and PDP capability through registered, planned, compiled and stored renderer targets", () => {
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
    expect(
      dynamicCollectionCommerceDefinition.editablePresentationFields.map((field) => field.path),
    ).toEqual(
      expect.arrayContaining([
        "props.showDescription",
        "props.filterLayout",
        "props.showChildCollections",
        "props.cardVariant",
        "props.gridDensity",
      ]),
    );
    expect(
      dynamicProductDetailDefinition.editablePresentationFields.map((field) => field.path),
    ).toEqual(
      expect.arrayContaining([
        "props.galleryLayout",
        "props.mediaTreatment",
        "props.optionDensity",
        "props.attributeLayout",
        "content.primaryActionLabel",
        "props.stickyMobileAction",
        "content.relatedHeading",
      ]),
    );
    directionIds.forEach((directionId) => {
      const { plan, proposal, accepted } = compiled(directionId);
      const expected = p905aDirectionScenarios[directionId].expected;
      const plannedCollection = requiredPlannedComponent(
        plan,
        "collection-template",
        "dynamicCollectionCommerce",
      );
      const plannedProduct = requiredPlannedComponent(
        plan,
        "product-template",
        "dynamicProductDetail",
      );
      const proposalCollection = requiredComponent(
        proposal,
        "collection",
        "dynamicCollectionCommerce",
      );
      const proposalProduct = requiredComponent(proposal, "product", "dynamicProductDetail");
      const storedCollection = requiredStoredComponent(
        accepted,
        "collection",
        "dynamicCollectionCommerce",
      );
      const storedProduct = requiredStoredComponent(accepted, "product", "dynamicProductDetail");

      expect(plan.designSystemSelection.componentSelections.collectionCommerce.variant).toBe(
        expected.collectionPresentation.variant,
      );
      [plannedCollection, proposalCollection, storedCollection].forEach((component) => {
        expect(component).toMatchObject({
          variant: expected.collectionPresentation.variant,
          props: {
            showDescription: true,
            filterLayout: expected.collectionPresentation.filterLayout,
            showChildCollections: true,
            cardVariant: expected.collectionPresentation.cardVariant,
            gridDensity: expected.collectionPresentation.gridDensity,
          },
        });
      });
      expect(plan.designSystemSelection.componentSelections.productDetail.variant).toBe(
        expected.productPresentation.variant,
      );
      [plannedProduct, proposalProduct, storedProduct].forEach((component) => {
        expect(component).toMatchObject({
          variant: expected.productPresentation.variant,
          props: {
            galleryLayout: expected.productPresentation.galleryLayout,
            mediaTreatment: expected.productPresentation.mediaTreatment,
            optionDensity: expected.productPresentation.optionDensity,
            attributeLayout: expected.productPresentation.attributeLayout,
            stickyMobileAction: true,
          },
          content: { primaryActionLabel: expect.any(Object) },
        });
      });
      expect(proposalProduct.bindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slotId: "primaryProduct", source: "product" }),
        ]),
      );
      expect(dynamicProductDetailDefinition.commerceBindingSlots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "relatedProducts", acceptedSourceTypes: ["productList"] }),
        ]),
      );
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

  it("preserves generated canonical commerce, media bindings and approved-asset provenance", () => {
    const protectedFingerprints = directionIds.map((directionId) => {
      const { planningInput, proposal, accepted } = compiled(directionId);
      const baseline = {
        products: planningInput.catalogue.products
          .slice()
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((product) => ({
            id: product.id,
            sku: product.sku,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            stockStatus: product.stockStatus,
            variants: product.variants,
            attributes: product.attributes,
            orderOptions: product.orderOptions,
            images: product.images,
          })),
        collections: planningInput.catalogue.collections.map((collection) => ({
          id: collection.id,
          productIds: collection.productIds,
          generatedProductIds: collection.productIds,
        })),
        approvedAssetContextFingerprint: planningInput.approvedAssetContext?.fingerprint ?? null,
        approvedAssetIds: planningInput.approvedAssetContext?.assets.map((asset) => ({
          id: asset.assetId,
          provenance: asset.provenance,
        })),
      };
      expect(proposal.preconditions.canonicalCommerceFingerprint).toBe(
        `canonical-commerce-${canonicalValueFingerprint(planningInput.catalogue)}`,
      );
      expect(generatedCommerceState(planningInput, accepted)).toEqual(baseline);
      expect(accepted.activeStorefront).toEqual(proposal.proposedStorefront);
      return canonicalValueFingerprint({
        products: generatedCommerceState(planningInput, accepted).products,
        collections: generatedCommerceState(planningInput, accepted).collections,
      });
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
