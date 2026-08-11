import {
  getCommercialCollectionSearchProfile,
  getCommercialPdpProfile,
  materializeExecutablePageBlueprint,
} from "@/application/storefront-templates";
import {
  dynamicCollectionCommerceDefaultContent,
  dynamicCollectionCommerceDefaultProps,
  dynamicCollectionCommerceDefaultStyleOverrides,
  dynamicProductDetailDefaultContent,
  dynamicProductDetailDefaultProps,
  dynamicProductDetailDefaultStyleOverrides,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  createDynamicCommercePresentationAuthority,
  storefrontSnapshotSchema,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommerceProductDetailArchetype,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";

function collectionArchetype(): DynamicCommerceCollectionSearchArchetype {
  const plan = getCommercialCollectionSearchProfile("collection-dense-search");
  const profile = plan?.profile;
  const authority = profile?.commercialCollectionSearch;
  if (!plan || !profile || !authority) {
    throw new Error("The collection/search publication profile is unavailable.");
  }
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: profile.requiredBindingCategories,
  });
  const slot = materialized.slots[0];
  if (!slot) throw new Error("The collection/search publication slot is unavailable.");
  return {
    id: "archetype_collection_search_fixture",
    archetypeVersion: "1.0.0",
    family: "collection-search",
    supportedContexts: ["collection", "search"],
    profile: {
      profileId: profile.id,
      profileVersion: profile.version,
      fingerprint: materialized.fingerprint,
    },
    compatibleSharedFrameProfileIds: [...authority.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: authority.defaultSharedFrameProfileId,
    designDnaNarrowing: structuredClone(authority.designDnaNarrowing),
    componentPresentations: [
      {
        slotId: slot.slotId,
        component: "dynamicCollectionCommerce",
        variant: slot.variant,
        anatomyId: authority.productCardAnatomyId,
        visible: true,
        content: structuredClone(dynamicCollectionCommerceDefaultContent),
        props: {
          ...structuredClone(dynamicCollectionCommerceDefaultProps),
          gridDensity: authority.gridDensity,
          cardVariant: authority.productCardAnatomyId,
          filterLayout: authority.filterLayout,
        },
        styleOverrides: structuredClone(dynamicCollectionCommerceDefaultStyleOverrides),
        boundedParameters: structuredClone(slot.boundedParameters),
      },
    ],
    responsivePosture: structuredClone(authority.responsiveArchitecture),
    artDirectionPosture: {
      imagePosture: authority.designDnaNarrowing.imagePosture[0],
      ratio: "natural",
      crop: authority.designDnaNarrowing.imagePosture[0] === "contained" ? "contain" : "editorial",
      overlay: "none",
    },
    fallbackBehavior: "use-family-fallback",
    commerceBindingPolicy: "runtime-collection-membership",
  };
}

function productArchetype(): DynamicCommerceProductDetailArchetype {
  const plan = getCommercialPdpProfile("pdp-standard-commerce");
  const profile = plan?.profile;
  const authority = profile?.commercialProductDetail;
  if (!plan || !profile || !authority) {
    throw new Error("The PDP publication profile is unavailable.");
  }
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: profile.requiredBindingCategories,
  });
  const slot = materialized.slots[0];
  if (!slot) throw new Error("The PDP publication slot is unavailable.");
  return {
    id: "archetype_product_fixture",
    archetypeVersion: "1.0.0",
    family: "product-detail",
    profile: {
      profileId: profile.id,
      profileVersion: profile.version,
      fingerprint: materialized.fingerprint,
    },
    compatibleSharedFrameProfileIds: [...authority.compatibleSharedFrameProfileIds],
    defaultSharedFrameProfileId: authority.defaultSharedFrameProfileId,
    designDnaNarrowing: structuredClone(authority.designDnaNarrowing),
    componentPresentations: [
      {
        slotId: slot.slotId,
        component: "dynamicProductDetail",
        variant: slot.variant,
        anatomyId: authority.relatedProductCardAnatomyId,
        visible: true,
        content: structuredClone(dynamicProductDetailDefaultContent),
        props: structuredClone(dynamicProductDetailDefaultProps),
        styleOverrides: structuredClone(dynamicProductDetailDefaultStyleOverrides),
        boundedParameters: structuredClone(slot.boundedParameters),
      },
    ],
    responsivePosture: structuredClone(authority.responsiveArchitecture),
    artDirectionPosture: {
      imagePosture: authority.designDnaNarrowing.imagePosture[0],
      ratio: authority.designDnaNarrowing.imagePosture[0] === "contained" ? "portrait" : "natural",
      crop: authority.designDnaNarrowing.imagePosture[0] === "contained" ? "contain" : "editorial",
      overlay: "none",
    },
    fallbackBehavior: "use-family-fallback",
    optionArchitecture: "generic-canonical-options",
    commerceBindingPolicy: "runtime-protected-product",
  };
}

export function p10b16p01DynamicCommerceAggregate(): ProjectAggregate {
  const aggregate: ProjectAggregate = {
    project: structuredClone(aurumNordicSeed.project),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    snapshots: [
      structuredClone(aurumNordicSeed.publishedSnapshot),
      structuredClone(aurumNordicSeed.draftSnapshot),
    ],
  };
  const draft = aggregate.snapshots[1];
  const home = draft.pages.find(({ type }) => type === "home");
  if (!home) throw new Error("The dynamic-commerce publication fixture has no homepage.");
  const collectionRoutes = aggregate.catalogue.collections.map((collection, index) => ({
    id: `route_collection_fixture_${index + 1}`,
    kind: "collection" as const,
    route: `/collections/${collection.slug}`,
    collectionId: collection.id,
  }));
  const productRoutes = aggregate.catalogue.products.map((product, index) => ({
    id: `route_product_fixture_${index + 1}`,
    kind: "product" as const,
    route: `/products/${product.id.replaceAll("_", "-")}`,
    productId: product.id,
  }));
  const collection = collectionArchetype();
  const product = productArchetype();
  const dynamicCommercePresentation = createDynamicCommercePresentationAuthority({
    contractVersion: "1.0.0",
    authorityId: "dynamic_commerce_publication_fixture",
    authorityRevision: 1,
    routeInventory: [
      ...collectionRoutes,
      ...productRoutes,
      { id: "route_search_fixture", kind: "search", route: "/search" },
    ],
    collectionSearchArchetypes: [collection],
    productDetailArchetypes: [product],
    collectionRouteMappings: collectionRoutes.map(({ id }) => ({
      routeId: id,
      archetypeId: collection.id,
    })),
    collectionContextRules: [
      {
        id: "fixture_collection_default",
        priority: 0,
        match: {
          childCollections: "any",
          campaignEvidence: "any",
          merchandisingDensity: "any",
        },
        archetypeId: collection.id,
      },
    ],
    productTypeMappings: [
      ...new Set(
        aggregate.catalogue.products.map(({ productType }) =>
          canonicalProductTypePresentationId(productType),
        ),
      ),
    ].map((productTypeId) => ({ productTypeId, archetypeId: product.id })),
    productComplexityRules: [
      {
        id: "fixture_product_default",
        priority: 0,
        match: {
          optionStructure: "any",
          mediaAvailability: "any",
          highConsideration: "any",
        },
        archetypeId: product.id,
      },
    ],
    searchArchetypeId: collection.id,
    fallbacks: {
      collectionArchetypeId: collection.id,
      searchArchetypeId: collection.id,
      productDetailArchetypeId: product.id,
    },
  });
  const legacyCollectionPageId = draft.pages.find(({ type }) => type === "collection")?.id;
  const legacyProductPageId = draft.pages.find(({ type }) => type === "product")?.id;
  const collectionRouteId = collectionRoutes[0]?.id;
  const productRouteId = productRoutes[0]?.id;
  const navigation = Object.fromEntries(
    Object.entries(draft.navigation).map(([area, items]) => [
      area,
      items.map((item) => {
        if (item.target.type !== "page") return structuredClone(item);
        if (item.target.pageId === legacyCollectionPageId && collectionRouteId) {
          return {
            ...structuredClone(item),
            target: { type: "dynamic-commerce-route" as const, routeId: collectionRouteId },
          };
        }
        if (item.target.pageId === legacyProductPageId && productRouteId) {
          return {
            ...structuredClone(item),
            target: { type: "dynamic-commerce-route" as const, routeId: productRouteId },
          };
        }
        return structuredClone(item);
      }),
    ]),
  ) as StorefrontSnapshot["navigation"];
  const snapshot = storefrontSnapshotSchema.parse({
    ...structuredClone(draft),
    navigation,
    pages: [structuredClone(home)],
    dynamicCommercePresentation,
  });
  aggregate.snapshots[1] = snapshot;
  return aggregate;
}
