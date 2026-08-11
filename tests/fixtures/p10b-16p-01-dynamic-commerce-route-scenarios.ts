import { createP10B14PremiumEditorialFixture } from "@/data/demo/p10b-14-premium-editorial";
import {
  catalogueDisplayModelSchema,
  type CatalogueDisplayModel,
  type ProductDisplayModel,
} from "@/domain/catalogue";
import {
  createDynamicCommercePresentationAuthority,
  storefrontSnapshotSchema,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";

export type DynamicCommerceRouteScenario = Readonly<{
  catalogue: CatalogueDisplayModel;
  legacySnapshot: StorefrontSnapshot;
  project: ReturnType<
    typeof createP10B14PremiumEditorialFixture
  >["fixture"]["aggregate"]["project"];
}>;

function localized(en: string, fi: string) {
  return { en, fi };
}

function cloneProduct(
  template: ProductDisplayModel,
  index: number,
  productType = `scale-type-${(index % 4) + 1}`,
): ProductDisplayModel {
  const sequence = index + 1;
  return {
    ...structuredClone(template),
    id: `product_route_scale_${sequence}`,
    sku: `ROUTE-SCALE-${sequence}`,
    title: localized(`Route scale product ${sequence}`, `Reittituote ${sequence}`),
    productType,
    images: template.images.map((image, imageIndex) => ({
      ...structuredClone(image),
      id: `asset_route_scale_${sequence}_${imageIndex + 1}`,
    })),
    variants: template.variants.map((variant, variantIndex) => ({
      ...structuredClone(variant),
      id: `variant_route_scale_${sequence}_${variantIndex + 1}`,
    })),
    orderOptions: template.orderOptions?.map((option, optionIndex) => ({
      ...structuredClone(option),
      id: `option_route_scale_${sequence}_${optionIndex + 1}`,
    })),
  };
}

function dynamicFamily(page: PageModel): boolean {
  return ["collection", "search-results", "product-detail"].includes(
    page.pageFamily?.familyId ?? "",
  );
}

function collectionPage(
  template: PageModel,
  collection: CatalogueDisplayModel["collections"][number],
  id: string,
  index: number,
): PageModel {
  const section = structuredClone(template.sections[0]);
  section.id = `section_route_collection_${index + 1}`;
  section.content = {
    ...section.content,
    collectionId: collection.id,
    productIds: [...collection.productIds],
  };
  return {
    ...structuredClone(template),
    id,
    slug: `/collections/${collection.slug}`,
    title: structuredClone(collection.title),
    seo: {
      title: structuredClone(collection.title),
      metaDescription: structuredClone(collection.description),
    },
    pageFamily: {
      ...structuredClone(template.pageFamily!),
      commerceContext: { kind: "collection", collectionId: collection.id },
    },
    sections: [section],
  };
}

function productPage(
  template: PageModel,
  product: ProductDisplayModel,
  id: string,
  index: number,
  relatedProductIds: readonly string[],
): PageModel {
  const section = structuredClone(template.sections[0]);
  section.id = `section_route_product_${index + 1}`;
  section.content = {
    ...section.content,
    productId: product.id,
    relatedProductIds: [...relatedProductIds],
  };
  return {
    ...structuredClone(template),
    id,
    slug: `/products/route-scale-${index + 1}`,
    title: structuredClone(product.title),
    seo: structuredClone(
      product.seo ?? {
        title: product.title,
        metaDescription: product.description ?? product.title,
      },
    ),
    pageFamily: {
      ...structuredClone(template.pageFamily!),
      commerceContext: { kind: "product", productId: product.id },
    },
    sections: [section],
  };
}

export function createLegacyDynamicCommerceRouteScenario({
  productCount = 10,
  collectionCount = 9,
}: Readonly<{
  productCount?: number;
  collectionCount?: number;
}> = {}): DynamicCommerceRouteScenario {
  const source = createP10B14PremiumEditorialFixture();
  const sourceCatalogue = structuredClone(source.fixture.planningInput.catalogue);
  const expanded = structuredClone(source.slice.planningInput.draft);
  const catalogue = structuredClone(sourceCatalogue);

  for (let index = catalogue.products.length; index < productCount; index += 1) {
    const template = sourceCatalogue.products[index % sourceCatalogue.products.length];
    catalogue.products.push(cloneProduct(template, index));
  }
  catalogue.products = catalogue.products.slice(0, productCount);

  for (let index = catalogue.collections.length; index < collectionCount; index += 1) {
    const sequence = index + 1;
    catalogue.collections.push({
      ...structuredClone(sourceCatalogue.collections[index % sourceCatalogue.collections.length]),
      id: `collection_route_scale_${sequence}`,
      slug: `route-scale-${sequence}`,
      title: localized(`Route collection ${sequence}`, `Reittimallisto ${sequence}`),
      description: localized(
        `Canonical collection ${sequence}.`,
        `Kanoninen mallisto ${sequence}.`,
      ),
      productIds: [
        catalogue.products[index % catalogue.products.length].id,
        catalogue.products[(index + 1) % catalogue.products.length].id,
      ],
    });
  }
  catalogue.collections = catalogue.collections.slice(0, collectionCount);
  const parsedCatalogue = catalogueDisplayModelSchema.parse(catalogue);

  const collectionPages = expanded.pages.filter(
    ({ pageFamily }) => pageFamily?.familyId === "collection",
  );
  const productPages = expanded.pages.filter(
    ({ pageFamily }) => pageFamily?.familyId === "product-detail",
  );
  const searchPage = expanded.pages.find(
    ({ pageFamily }) => pageFamily?.familyId === "search-results",
  );
  const collectionTemplate = collectionPages[0];
  const productTemplate = productPages[0];
  if (!collectionTemplate || !productTemplate || !searchPage) {
    throw new Error("The complete-storefront fixture has no dynamic route templates.");
  }
  const collectionPageById = new Map(
    collectionPages.flatMap((page) =>
      page.pageFamily?.commerceContext.kind === "collection"
        ? [[page.pageFamily.commerceContext.collectionId, page] as const]
        : [],
    ),
  );
  const productPageById = new Map(
    productPages.flatMap((page) =>
      page.pageFamily?.commerceContext.kind === "product"
        ? [[page.pageFamily.commerceContext.productId, page] as const]
        : [],
    ),
  );
  const routeCollectionPages = parsedCatalogue.collections.map((collection, index) => {
    const current = collectionPageById.get(collection.id);
    return collectionPage(
      current ?? collectionTemplate,
      collection,
      current?.id ?? `route_collection_scale_${index + 1}`,
      index,
    );
  });
  const routeProductPages = parsedCatalogue.products.map((product, index) => {
    const current = productPageById.get(product.id);
    return productPage(
      current ?? productTemplate,
      product,
      current?.id ?? `route_product_scale_${index + 1}`,
      index,
      parsedCatalogue.products
        .map(({ id }) => id)
        .filter((id) => id !== product.id)
        .slice(0, 8),
    );
  });
  const legacySnapshot = storefrontSnapshotSchema.parse({
    ...structuredClone(expanded),
    pages: [
      ...expanded.pages.filter((page) => !dynamicFamily(page)),
      ...routeCollectionPages,
      structuredClone(searchPage),
      ...routeProductPages,
    ],
  });
  return {
    catalogue: parsedCatalogue,
    legacySnapshot,
    project: structuredClone(source.fixture.aggregate.project),
  };
}

export function scaleCurrentDynamicCommerceProducts(
  snapshotInput: StorefrontSnapshot,
  catalogueInput: CatalogueDisplayModel,
  productCount: number,
): Readonly<{ snapshot: StorefrontSnapshot; catalogue: CatalogueDisplayModel }> {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const authority = snapshot.dynamicCommercePresentation;
  if (!authority) throw new Error("The scale fixture requires current dynamic-commerce authority.");
  const catalogue = structuredClone(catalogueInput);
  const template = catalogue.products[0];
  if (!template) throw new Error("The scale fixture requires one product.");
  for (let index = catalogue.products.length; index < productCount; index += 1) {
    catalogue.products.push(cloneProduct(template, index, template.productType));
  }
  catalogue.products = catalogue.products.slice(0, productCount);
  const parsedCatalogue = catalogueDisplayModelSchema.parse(catalogue);
  const existingRoutesByProductId = new Map(
    authority.routeInventory.flatMap((route) =>
      route.kind === "product" ? [[route.productId, route] as const] : [],
    ),
  );
  const productRoutes = parsedCatalogue.products.map((product, index) =>
    existingRoutesByProductId.get(product.id)
      ? structuredClone(existingRoutesByProductId.get(product.id)!)
      : {
          id: `route_product_scale_${index + 1}`,
          kind: "product" as const,
          route: `/products/route-scale-${index + 1}`,
          productId: product.id,
        },
  );
  const { authorityFingerprint: _fingerprint, ...material } = authority;
  void _fingerprint;
  const dynamicCommercePresentation = createDynamicCommercePresentationAuthority({
    ...structuredClone(material),
    routeInventory: [
      ...authority.routeInventory.filter(({ kind }) => kind !== "product"),
      ...productRoutes,
    ],
  });
  return {
    catalogue: parsedCatalogue,
    snapshot: storefrontSnapshotSchema.parse({
      ...snapshot,
      dynamicCommercePresentation,
    }),
  };
}
