import { describe, expect, it } from "vitest";
import { aurumNordicBrandSystem } from "@/domain/design-system";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  createDynamicCommercePresentationAuthority,
  dynamicCommercePresentationAuthoritySchema,
  dynamicCommerceRoutePathSchema,
  storefrontContent,
  storefrontSnapshotSchema,
  type DynamicCommerceDesignJsonValue,
  type DynamicCommercePresentationAuthorityMaterial,
} from "@/domain/storefront";

const responsivePosture: DynamicCommercePresentationAuthorityMaterial["productDetailArchetypes"][number]["responsivePosture"] =
  [
    { breakpoint: "mobile", viewport: 375, transformationIds: ["stackCommerce"] },
    { breakpoint: "tablet", viewport: 768, transformationIds: ["reflowCommerce"] },
    { breakpoint: "desktop", viewport: 1024, transformationIds: ["preserveCommerce"] },
    { breakpoint: "wide", viewport: 1440, transformationIds: ["preserveCommerce"] },
  ];

const designDnaNarrowing: DynamicCommercePresentationAuthorityMaterial["productDetailArchetypes"][number]["designDnaNarrowing"] =
  {
    spacingDensity: ["standard", "spacious"],
    surfaceDepth: ["flat", "subtle"],
    imagePosture: ["contained", "editorial"],
  };

const artDirectionPosture: DynamicCommercePresentationAuthorityMaterial["productDetailArchetypes"][number]["artDirectionPosture"] =
  {
    imagePosture: "product-led",
    ratio: "portrait",
    crop: "contain",
    overlay: "none",
  };

function material(): DynamicCommercePresentationAuthorityMaterial {
  return {
    contractVersion: "1.0.0",
    authorityId: "dynamic_commerce_authority",
    authorityRevision: 1,
    routeInventory: [
      {
        id: "route_product_aurora",
        kind: "product",
        route: "/products/aurora",
        productId: "product_aurora",
        relatedProductIds: ["product_luna"],
      },
      {
        id: "route_collection_rings",
        kind: "collection",
        route: "/collections/rings",
        collectionId: "collection_rings",
      },
      { id: "route_search", kind: "search", route: "/search" },
    ],
    collectionSearchArchetypes: [
      {
        id: "collection_editorial",
        archetypeVersion: "1.0.0",
        family: "collection-search",
        supportedContexts: ["collection", "search"],
        profile: {
          profileId: "collection-editorial-discovery",
          profileVersion: "1.0.0",
          fingerprint: "profile-collection-editorial",
        },
        compatibleSharedFrameProfileIds: ["frame-editorial", "frame-minimal"],
        defaultSharedFrameProfileId: "frame-editorial",
        designDnaNarrowing,
        componentPresentations: [
          {
            slotId: "collectionCommerce",
            component: "dynamicCollectionCommerce",
            variant: "editorialDiscovery",
            anatomyId: "editorialDiscovery",
            visible: true,
            content: {
              filtersHeading: { en: "Filters", fi: "Suodattimet" },
              productsHeading: { en: "Products", fi: "Tuotteet" },
            },
            props: { gridDensity: "spacious", showDescription: true },
            styleOverrides: { surfaceTreatment: "plain" },
            boundedParameters: { density: "spacious" },
          },
        ],
        responsivePosture,
        artDirectionPosture,
        fallbackBehavior: "use-family-fallback",
        commerceBindingPolicy: "runtime-collection-membership",
      },
    ],
    productDetailArchetypes: [
      {
        id: "pdp_standard",
        archetypeVersion: "1.0.0",
        family: "product-detail",
        profile: {
          profileId: "pdp-standard-commerce",
          profileVersion: "1.0.0",
          fingerprint: "profile-pdp-standard",
        },
        compatibleSharedFrameProfileIds: ["frame-editorial", "frame-minimal"],
        defaultSharedFrameProfileId: "frame-editorial",
        designDnaNarrowing,
        componentPresentations: [
          {
            slotId: "productCommerce",
            component: "dynamicProductDetail",
            variant: "balanced",
            anatomyId: "standardCommerce",
            visible: true,
            content: {
              relatedHeading: { en: "You may also like", fi: "Saatat myös pitää" },
              primaryActionLabel: { en: "Add to cart", fi: "Lisää ostoskoriin" },
            },
            props: { galleryLayout: "thumbnails", showSku: true },
            styleOverrides: { surfaceTreatment: "plain" },
            boundedParameters: { optionDensity: "comfortable" },
          },
        ],
        responsivePosture,
        artDirectionPosture,
        fallbackBehavior: "use-family-fallback",
        optionArchitecture: "generic-canonical-options",
        commerceBindingPolicy: "runtime-protected-product",
      },
    ],
    collectionRouteMappings: [
      { routeId: "route_collection_rings", archetypeId: "collection_editorial" },
    ],
    collectionContextRules: [
      {
        id: "editorial_collection_rule",
        priority: 10,
        match: {
          depth: { minimum: 0, maximum: 3 },
          productCount: { minimum: 0, maximum: 500 },
          childCollections: "any",
          campaignEvidence: "any",
          merchandisingDensity: "spacious",
        },
        archetypeId: "collection_editorial",
      },
    ],
    productTypeMappings: [
      { productTypeId: "ring", archetypeId: "pdp_standard" },
      { productTypeId: "watch", archetypeId: "pdp_standard" },
    ],
    productComplexityRules: [
      {
        id: "configurable_product_rule",
        priority: 10,
        match: {
          optionStructure: "configurable",
          optionGroupCount: { minimum: 1, maximum: 24 },
          mediaAvailability: "any",
          highConsideration: "any",
        },
        archetypeId: "pdp_standard",
      },
    ],
    searchArchetypeId: "collection_editorial",
    fallbacks: {
      collectionArchetypeId: "collection_editorial",
      searchArchetypeId: "collection_editorial",
      productDetailArchetypeId: "pdp_standard",
    },
  };
}

const legacySnapshotInput = {
  id: "snapshot_legacy",
  projectId: "project_aurum",
  revision: 1,
  brandSystem: aurumNordicBrandSystem,
  navigation: { primary: [], footer: [] },
  pages: [
    {
      id: "page_home",
      type: "home" as const,
      slug: "/",
      title: { en: "Home", fi: "Etusivu" },
      seo: {
        title: { en: "Home", fi: "Etusivu" },
        metaDescription: { en: "Storefront home", fi: "Kaupan etusivu" },
      },
      sections: [],
    },
  ],
  catalogueRef: "catalogue_aurum",
  createdAt: "2026-08-11T09:00:00+03:00",
  createdBy: "system" as const,
};

describe("P10B-16P-01 dynamic commerce route authority contract", () => {
  it("creates deterministic authority identity while preserving one design archetype for many routes", () => {
    const first = createDynamicCommercePresentationAuthority(material());
    const reordered = material();
    reordered.routeInventory.reverse();
    reordered.productTypeMappings.reverse();
    reordered.collectionSearchArchetypes[0].compatibleSharedFrameProfileIds.reverse();
    reordered.collectionSearchArchetypes[0].designDnaNarrowing.spacingDensity.reverse();
    const second = createDynamicCommercePresentationAuthority(reordered);

    expect(second.authorityFingerprint).toBe(first.authorityFingerprint);
    expect(first.productTypeMappings).toHaveLength(2);
    expect(new Set(first.productTypeMappings.map(({ archetypeId }) => archetypeId))).toEqual(
      new Set(["pdp_standard"]),
    );
    expect(first.productDetailArchetypes).toHaveLength(1);
  });

  it("rejects stale fingerprints and nested identity, price, option, and media commerce truth", () => {
    const authority = createDynamicCommercePresentationAuthority(material());
    expect(() =>
      dynamicCommercePresentationAuthoritySchema.parse({
        ...authority,
        authorityFingerprint: "stale",
      }),
    ).toThrow(/fingerprint is stale/i);

    const protectedCases: Array<[string, DynamicCommerceDesignJsonValue]> = [
      ["productId", "product_forbidden"],
      ["price", { amount: 100, currency: "EUR" }],
      ["optionGroups", [{ id: "size" }]],
      ["productMedia", [{ id: "asset_forbidden" }]],
    ];
    for (const [key, value] of protectedCases) {
      const protectedMaterial = material();
      protectedMaterial.productDetailArchetypes[0].componentPresentations[0].content = {
        presentation: { nested: { [key]: value } },
      };
      expect(() => createDynamicCommercePresentationAuthority(protectedMaterial)).toThrow(
        /cannot contain protected commerce bindings/i,
      );
    }
  });

  it("fails closed for duplicate or unresolved mappings and incomplete collection route coverage", () => {
    const duplicateType = material();
    duplicateType.productTypeMappings.push({
      productTypeId: "ring",
      archetypeId: "pdp_standard",
    });
    expect(() => createDynamicCommercePresentationAuthority(duplicateType)).toThrow(
      /product type may have only one/i,
    );

    const missingCollectionMapping = material();
    missingCollectionMapping.collectionRouteMappings = [];
    expect(() => createDynamicCommercePresentationAuthority(missingCollectionMapping)).toThrow(
      /every collection route requires one explicit archetype mapping/i,
    );

    const unknownPdp = material();
    unknownPdp.productTypeMappings[0].archetypeId = "pdp_unknown";
    expect(() => createDynamicCommercePresentationAuthority(unknownPdp)).toThrow(
      /must reference a PDP archetype/i,
    );

    const duplicateRelatedProduct = material();
    const duplicateRelatedRoute = duplicateRelatedProduct.routeInventory[0];
    if (duplicateRelatedRoute.kind !== "product") throw new Error("Expected a product route.");
    duplicateRelatedRoute.relatedProductIds = ["product_luna", "product_luna"];
    expect(() => createDynamicCommercePresentationAuthority(duplicateRelatedProduct)).toThrow(
      /related-product bindings must be unique/i,
    );

    const selfRelatedProduct = material();
    const selfRelatedRoute = selfRelatedProduct.routeInventory[0];
    if (selfRelatedRoute.kind !== "product") throw new Error("Expected a product route.");
    selfRelatedRoute.relatedProductIds = [selfRelatedRoute.productId];
    expect(() => createDynamicCommercePresentationAuthority(selfRelatedProduct)).toThrow(
      /cannot bind its primary product as a related product/i,
    );
  });

  it("enforces exact route namespaces for every dynamic commerce route kind", () => {
    expect(dynamicCommerceRoutePathSchema.parse("/products/aurora")).toBe("/products/aurora");
    expect(dynamicCommerceRoutePathSchema.parse("/collections/rings")).toBe("/collections/rings");
    expect(dynamicCommerceRoutePathSchema.parse("/search")).toBe("/search");
    expect(() => dynamicCommerceRoutePathSchema.parse("/campaign/summer")).toThrow();
    expect(() => dynamicCommerceRoutePathSchema.parse("/products/rings/aurora")).toThrow();

    const productInCollectionNamespace = material();
    productInCollectionNamespace.routeInventory[0].route = "/collections/aurora";
    expect(() => createDynamicCommercePresentationAuthority(productInCollectionNamespace)).toThrow(
      /product routes must use \/products\/<slug>/i,
    );

    const collectionInProductNamespace = material();
    collectionInProductNamespace.routeInventory[1].route = "/products/rings";
    expect(() => createDynamicCommercePresentationAuthority(collectionInProductNamespace)).toThrow(
      /collection routes must use \/collections\/<slug>/i,
    );

    const nestedProductRoute = material();
    nestedProductRoute.routeInventory[0].route = "/products/rings/aurora";
    expect(() => createDynamicCommercePresentationAuthority(nestedProductRoute)).toThrow(
      /product routes must use \/products\/<slug>/i,
    );

    const nonCanonicalSearchRoute = material();
    nonCanonicalSearchRoute.routeInventory[2].route = "/search/results";
    expect(() => createDynamicCommercePresentationAuthority(nonCanonicalSearchRoute)).toThrow();
  });

  it("accepts only dynamic navigation targets resolved by the current route inventory", () => {
    const authority = createDynamicCommercePresentationAuthority(material());
    const snapshot = storefrontSnapshotSchema.parse({
      ...legacySnapshotInput,
      dynamicCommercePresentation: authority,
      navigation: {
        primary: [
          {
            id: "nav_aurora",
            label: { en: "Aurora", fi: "Aurora" },
            target: { type: "dynamic-commerce-route", routeId: "route_product_aurora" },
          },
        ],
        footer: [],
      },
    });
    expect(snapshot.navigation.primary[0].target).toEqual({
      type: "dynamic-commerce-route",
      routeId: "route_product_aurora",
    });

    expect(() =>
      storefrontSnapshotSchema.parse({
        ...snapshot,
        navigation: {
          primary: [
            {
              ...snapshot.navigation.primary[0],
              target: { type: "dynamic-commerce-route", routeId: "route_missing" },
            },
          ],
          footer: [],
        },
      }),
    ).toThrow(/must resolve to current route inventory/i);
  });

  it("rejects identity collisions between static pages and dynamic route inventory", () => {
    const authority = createDynamicCommercePresentationAuthority(material());
    expect(() =>
      storefrontSnapshotSchema.parse({
        ...legacySnapshotInput,
        pages: [
          {
            ...legacySnapshotInput.pages[0],
            id: "route_product_aurora",
          },
        ],
        dynamicCommercePresentation: authority,
      }),
    ).toThrow(/static page IDs and dynamic commerce route IDs must be globally unique/i);
  });

  it("enforces global route, archetype, static-page, and derived-editor identity uniqueness", () => {
    const routeArchetypeCollision = material();
    routeArchetypeCollision.routeInventory[0].id =
      routeArchetypeCollision.collectionSearchArchetypes[0].id;
    expect(() => createDynamicCommercePresentationAuthority(routeArchetypeCollision)).toThrow(
      /route and archetype identities must be globally unique/i,
    );

    const archetypeCollision = material();
    archetypeCollision.productDetailArchetypes[0].id =
      archetypeCollision.collectionSearchArchetypes[0].id;
    expect(() => createDynamicCommercePresentationAuthority(archetypeCollision)).toThrow(
      /archetype identities must be globally unique/i,
    );

    const authority = createDynamicCommercePresentationAuthority(material());
    expect(() =>
      storefrontSnapshotSchema.parse({
        ...legacySnapshotInput,
        pages: [
          {
            ...legacySnapshotInput.pages[0],
            id: authority.collectionSearchArchetypes[0].id,
          },
        ],
        dynamicCommercePresentation: authority,
      }),
    ).toThrow(/static page IDs and dynamic commerce archetype IDs must be globally unique/i);

    expect(() =>
      storefrontSnapshotSchema.parse({
        ...legacySnapshotInput,
        pages: [
          {
            ...legacySnapshotInput.pages[0],
            sections: [
              {
                id: `section_${authority.collectionSearchArchetypes[0].id}`,
                component: "hero",
                variant: "default",
                visible: true,
                content: {},
                props: {},
              },
            ],
          },
        ],
        dynamicCommercePresentation: authority,
      }),
    ).toThrow(/canonical section IDs and derived dynamic commerce editor section IDs/i);
  });

  it("keeps pre-authority snapshot canonical fingerprints byte-for-byte compatible", () => {
    const legacy = storefrontSnapshotSchema.parse(legacySnapshotInput);
    const content = storefrontContent(legacy);
    expect(Object.hasOwn(content, "dynamicCommercePresentation")).toBe(false);
    expect(canonicalStorefrontContentFingerprint(legacy)).toBe(
      canonicalValueFingerprint({
        brandSystem: legacy.brandSystem,
        navigation: legacy.navigation,
        pages: legacy.pages,
        catalogueRef: legacy.catalogueRef,
      }),
    );
  });
});
