import { homepageCommerceBridgeDescriptions } from "./component-description-sources";
import { z } from "zod";
import type {
  CollectionPresentationContext,
  ComponentProjectionContext,
  ProductPresentationContext,
  StorefrontAssetMetadata,
} from "@/domain/component-platform";
import { componentInstanceV2Schema, type ComponentInstanceV2 } from "@/domain/component-platform";
import type {
  ApprovedAssetPlacementOperation,
  ApprovedAssetPresentation,
} from "@/domain/storefront";
import {
  defineComponent,
  resolveStorefrontNavigationPath,
  type ComponentDefinition,
  type StorefrontRenderContext,
} from "./contract";
import { renderHomepageCommerce } from "@/components/storefront/homepage-commerce";
import {
  createCanonicalProductMediaResponsiveAuthority,
  migrateApprovedPresentationArtDirection,
} from "@/application/responsive-image-authority";
import type { ComponentDefinitionV2 } from "@/domain/component-platform";
import { resolveBrandSystemDesignDna } from "@/domain/design-system";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import { veskifyComponentRegistryV2 } from "./v2-registry";
import {
  homepageCollectionNavigationContentSchema,
  homepageCollectionNavigationPropsSchema,
  homepageFeaturedCollectionsContentSchema,
  homepageFeaturedCollectionsPropsSchema,
  homepageFeaturedProductsContentSchema,
  homepageFeaturedProductsPropsSchema,
  homepageEditorialContentSchema,
  homepageEditorialPropsSchema,
  homepageHeroContentSchema,
  homepageHeroPropsSchema,
  homepageProofContentSchema,
  homepageProofPropsSchema,
  homepagePromotionContentSchema,
  homepagePromotionPropsSchema,
  homepageTrustContentSchema,
  homepageTrustPropsSchema,
} from "./homepage-commerce";

import {
  homepageCommerceBridgeDefaults,
  homepageCommerceBridgeVariants,
  type HomepageCommerceBridgeComponent,
} from "./homepage-commerce-bridge-metadata";
export {
  homepageCommerceBridgeComponentNames,
  homepageCommerceBridgeDefaults,
  homepageCommerceBridgeVariants,
  type HomepageCommerceBridgeComponent,
} from "./homepage-commerce-bridge-metadata";

function projectionFor(
  context: StorefrontRenderContext,
  placements: readonly ApprovedAssetPlacementOperation[] = [],
  presentations: readonly ApprovedAssetPresentation[] = [],
  productCardArtContext?: Readonly<{ component: ComponentDefinitionV2; variant: string }>,
): Readonly<{
  projection: ComponentProjectionContext;
  productById: ReadonlyMap<string, StorefrontRenderContext["catalogue"]["products"][number]>;
  assetUrlById: ReadonlyMap<string, string>;
}> {
  const revision = `catalogue-${context.catalogue.id}`;
  const products: ProductPresentationContext[] = [];
  const assets: StorefrontAssetMetadata[] = [];
  const productById = new Map<string, StorefrontRenderContext["catalogue"]["products"][number]>();
  const assetUrlById = new Map<string, string>();
  const assetIds = new Set<string>();
  for (const product of context.catalogue.products) {
    productById.set(product.id, product);
    const media: ProductPresentationContext["media"] = product.images.map((image, index) => ({
      assetId: image.id,
      role: index === 0 ? ("main" as const) : ("alternative" as const),
      ...(image.alt === undefined ? {} : { alt: image.alt }),
    }));
    products.push({
      productId: product.id,
      productTypeId: canonicalProductTypePresentationId(product.productType),
      sku: product.sku ?? product.id,
      title: product.title,
      ...(product.description === undefined ? {} : { description: product.description }),
      ...(product.price === undefined
        ? {
            priceUnavailableReason: product.priceUnavailableReason ?? {
              en: "Price unavailable",
              fi: "Hinta ei saatavilla",
            },
          }
        : { price: product.price }),
      ...(product.compareAtPrice === undefined ? {} : { compareAtPrice: product.compareAtPrice }),
      availability:
        product.availabilityLabel ??
        (product.stockStatus === "inStock"
          ? { en: "In stock", fi: "Varastossa" }
          : product.stockStatus === "lowStock"
            ? { en: "Limited availability", fi: "Rajoitetusti saatavilla" }
            : product.stockStatus === "outOfStock"
              ? { en: "Currently unavailable", fi: "Ei tällä hetkellä saatavilla" }
              : {
                  en: "Availability unavailable",
                  fi: "Saatavuus ei saatavilla",
                }),
      media,
      attributeGroups: [],
      optionGroups: [],
      selectedValues: [],
      unavailableCombinations: [],
      relatedProductIds: [],
      revision,
    });
    product.images.forEach((image, index) => {
      const mediaItem = media[index];
      assetUrlById.set(image.id, image.url);
      assetIds.add(image.id);
      assets.push({
        assetId: image.id,
        role: index === 0 ? "productMainImage" : "productAlternativeImage",
        ...(image.alt === undefined ? { decorative: true } : { alt: image.alt, decorative: false }),
        provenance: { kind: "canonicalProductMedia", sourceId: product.id },
        approvalStatus: "approved",
        usageRights: "merchantOwned",
        responsiveCrops: [],
        revision,
        ...(productCardArtContext && mediaItem
          ? {
              artDirection: createCanonicalProductMediaResponsiveAuthority({
                component: productCardArtContext.component,
                variant: productCardArtContext.variant,
                brandSystem: context.brandSystem,
                productId: product.id,
                media: mediaItem,
                revision,
                assetSlotId: "productMedia",
              }),
            }
          : {}),
      });
    });
  }
  const collectionPlacements = placements.filter(
    (placement) => placement.assetSlotId === "collectionMedia",
  );
  const collections: CollectionPresentationContext[] = context.catalogue.collections.map(
    (collection, index) => ({
      collectionId: collection.id,
      title: collection.title,
      description: collection.description,
      assets:
        index < collectionPlacements.length
          ? [
              {
                assetId: collectionPlacements[index].assetId,
                role:
                  collectionPlacements[index].role === "editorialImage"
                    ? ("editorial" as const)
                    : ("card" as const),
              },
            ]
          : [],
      productIds: collection.productIds,
      filters: [],
      sorting: [],
      emptyState: { title: { en: "No products", fi: "Ei tuotteita" } },
      revision,
    }),
  );
  const presentationByAssetId = new Map(
    presentations.map((presentation) => [presentation.assetId, presentation]),
  );
  for (const presentation of presentations) {
    assetUrlById.set(presentation.assetId, presentation.asset.url);
    presentation.responsiveSources?.forEach((source) =>
      assetUrlById.set(source.assetId, source.asset.url),
    );
  }
  placements.forEach((placement) => {
    if (assetIds.has(placement.assetId)) return;
    const presentation = presentationByAssetId.get(placement.assetId);
    assetIds.add(placement.assetId);
    assets.push({
      assetId: placement.assetId,
      role: placement.role,
      ...(presentation?.asset.alt === undefined
        ? { decorative: presentation?.asset.decorative ?? true }
        : {
            alt: presentation.asset.alt,
            decorative: presentation.asset.decorative,
          }),
      provenance: {
        kind:
          placement.sourceProvenanceKind === "merchantProvided"
            ? "merchantProvided"
            : "sourceDiscovered",
        sourceId: placement.sourceReferenceId,
      },
      approvalStatus: "approved",
      usageRights:
        placement.sourceProvenanceKind === "merchantProvided" ? "merchantOwned" : "unknown",
      responsiveCrops: [],
      ...(presentation?.artDirection === undefined
        ? {}
        : { artDirection: presentation.artDirection }),
      ...(presentation?.responsiveSources?.length
        ? {
            responsiveSourceAssetIds: presentation.responsiveSources.map(({ assetId }) => assetId),
          }
        : {}),
      revision: placement.assetRevision,
    });
  });
  return {
    projection: {
      products,
      collections,
      assets,
      navigation: [...context.navigation.primary, ...context.navigation.footer].map((item) => ({
        navigationId: item.id,
        revision,
      })),
      projectBrandContexts: [
        { projectId: `project_${context.catalogue.id}`, brandSystemRefs: [], revision },
      ],
      localizedContents: [],
      evidenceReferences: [...(context.evidenceReferences ?? [])],
      productListRevision: revision,
      collectionListRevision: revision,
    },
    productById,
    assetUrlById,
  };
}

function instanceFor(
  component: HomepageCommerceBridgeComponent,
  sectionId: string,
  variant: string,
  content: unknown,
  props: unknown,
  componentPlacements: readonly ApprovedAssetPlacementOperation[],
  context: StorefrontRenderContext,
  projection: ComponentProjectionContext,
  productById: ReadonlyMap<string, StorefrontRenderContext["catalogue"]["products"][number]>,
): ComponentInstanceV2 {
  const revision = `catalogue-${context.catalogue.id}`;
  const contentRecord = z.record(z.string(), z.unknown()).parse(content);
  const persistedProductIds =
    component === "homepageFeaturedProducts" && Array.isArray(contentRecord.productIds)
      ? contentRecord.productIds.map((id) => z.string().parse(id))
      : undefined;
  if (persistedProductIds?.some((id) => !productById.has(id))) {
    throw new Error(
      "A persisted homepage product-list binding no longer resolves in canonical commerce.",
    );
  }
  if (
    component === "homepageFeaturedProducts" &&
    componentPlacements.some((placement) => placement.assetSlotId === "productMedia")
  ) {
    throw new Error(
      "Approved source asset placements cannot target commerce-owned homepage product media.",
    );
  }
  const productIds = persistedProductIds ?? projection.products.map((product) => product.productId);
  const actionLabel =
    component === "homepageHero"
      ? contentRecord.primaryActionLabel
      : ["homepagePromotion", "homepageTrust", "homepageEditorial"].includes(component)
        ? contentRecord.actionLabel
        : undefined;
  const actionNavigationItem = actionLabel
    ? [...context.navigation.primary, ...context.navigation.footer].find(
        (item) =>
          context.pagePaths[item.target.type === "page" ? item.target.pageId : ""] !==
          context.homePath,
      )
    : undefined;
  const bindings: ComponentInstanceV2["bindings"] = [
    {
      slotId: "presentationContext",
      source: "projectBrandContext",
      projectId: `project_${context.catalogue.id}`,
      revision,
    },
  ];
  if (component === "homepageFeaturedCollections" || component === "homepageCollectionNavigation")
    bindings.push({
      slotId: "collections",
      source: "collectionList",
      collectionIds: projection.collections.map((item) => item.collectionId),
      revision,
    });
  if (component === "homepageFeaturedProducts")
    bindings.push({
      slotId: "products",
      source: "productList",
      productIds,
      revision,
    });
  if (
    actionNavigationItem &&
    ["homepageHero", "homepagePromotion", "homepageTrust", "homepageEditorial"].includes(component)
  ) {
    bindings.push({
      slotId:
        component === "homepageHero"
          ? "primaryAction"
          : component === "homepagePromotion"
            ? "promotionAction"
            : component === "homepageTrust"
              ? "supportAction"
              : "editorialAction",
      source: "navigation",
      navigationId: actionNavigationItem.id,
      revision,
    });
  }
  const assetAssignments = componentPlacements.map((placement) => ({
    slotId: placement.assetSlotId,
    assetId: placement.assetId,
    role: placement.role,
  }));
  if (component === "homepageHero" || component === "homepagePromotion") {
    const placement = componentPlacements[0];
    if (placement) {
      bindings.push({
        slotId: component === "homepageHero" ? "heroAsset" : "promotionAsset",
        source: "asset",
        assetId: placement.assetId,
        revision: placement.assetRevision,
      });
    }
  }
  if (component === "homepageEditorial") {
    const bindingSlots = ["storyPrimaryAsset", "storySecondaryAsset", "storyTertiaryAsset"];
    componentPlacements.slice(0, bindingSlots.length).forEach((placement, index) => {
      bindings.push({
        slotId: bindingSlots[index],
        source: "asset",
        assetId: placement.assetId,
        revision: placement.assetRevision,
      });
    });
  }
  return componentInstanceV2Schema.parse({
    id: sectionId,
    component,
    componentVersion: { major: 2, minor: 0, patch: 0 },
    variant,
    content,
    props,
    styleOverrides: { surface: "plain" },
    bindings,
    assetAssignments:
      assetAssignments.length > 0
        ? assetAssignments
        : component === "homepageFeaturedProducts"
          ? productIds.flatMap((productId) => {
              const product = productById.get(productId);
              if (!product) {
                throw new Error(
                  "A persisted homepage product-list binding no longer resolves in canonical commerce.",
                );
              }
              const firstImage = product.images[0];
              return firstImage
                ? [
                    {
                      slotId: "productMedia",
                      assetId: firstImage.id,
                      role: "productMainImage" as const,
                    },
                  ]
                : [];
            })
          : [],
  });
}

function bridge<ContentSchema extends z.ZodType, PropsSchema extends z.ZodType>(input: {
  component: HomepageCommerceBridgeComponent;
  label: string;
  contentSchema: ContentSchema;
  propsSchema: PropsSchema;
  defaultContent: z.input<ContentSchema> & Record<string, unknown>;
  defaultProps: z.input<PropsSchema> & Record<string, unknown>;
}): ComponentDefinition {
  const componentVariants = homepageCommerceBridgeVariants[input.component];
  return defineComponent({
    type: input.component,
    label: input.label,
    allowedPageTypes: [...veskifyComponentRegistryV2.get(input.component).supportedPageTypes],
    variants: componentVariants,
    defaultVariant: componentVariants[0],
    contentSchema: input.contentSchema,
    propsSchema: input.propsSchema,
    defaultContent: input.defaultContent,
    defaultProps: input.defaultProps,
    editorFields: homepageCommerceBridgeDescriptions[input.component].editorFields,
    protectedFields: homepageCommerceBridgeDescriptions[input.component].protectedFields,
    renderer: ({
      sectionId,
      variant,
      content,
      props,
      approvedAssetPlacements,
      approvedAssetPresentations,
      context,
    }) => {
      const componentDefinition = veskifyComponentRegistryV2.get(input.component);
      const componentPlacements = approvedAssetPlacements.filter(
        (placement) =>
          placement.componentId === sectionId && placement.componentType === input.component,
      );
      const placementByAssetId = new Map(
        approvedAssetPlacements.map((placement) => [placement.assetId, placement]),
      );
      const migratedPresentations = approvedAssetPresentations.map((presentation) => {
        const placement = placementByAssetId.get(presentation.assetId);
        const currentArtDirection =
          placement &&
          presentation.artDirection?.placement.componentType === placement.componentType &&
          presentation.artDirection.placement.assetSlotId === placement.assetSlotId &&
          presentation.artDirection.placement.variant === variant;
        if (currentArtDirection) return presentation;
        return placement?.sourceProvenanceKind
          ? migrateApprovedPresentationArtDirection({
              presentation,
              placement,
              component: componentDefinition,
              variant,
              dna: resolveBrandSystemDesignDna(context.brandSystem),
              provenanceKind: placement.sourceProvenanceKind,
            })
          : presentation;
      });
      const derived = projectionFor(
        context,
        componentPlacements,
        migratedPresentations,
        input.component === "homepageFeaturedProducts"
          ? { component: componentDefinition, variant }
          : undefined,
      );
      return renderHomepageCommerce({
        target: context.renderTarget ?? "preview",
        instance: instanceFor(
          input.component,
          sectionId,
          variant,
          content,
          props,
          componentPlacements,
          context,
          derived.projection,
          derived.productById,
        ),
        projection: derived.projection,
        activeLocale: context.activeLocale,
        primaryLocale: context.primaryLocale,
        resolveAssetUrl: (assetId) =>
          derived.assetUrlById.get(assetId) ?? "/seed-assets/placeholder.svg",
        onNavigate: (intent) => {
          const path = resolveStorefrontNavigationPath(context, intent);
          if (path && typeof window !== "undefined") window.location.assign(path);
        },
      });
    },
  });
}

export const homepageCommerceBridgeDefinitions = {
  homepageHero: bridge({
    component: "homepageHero",
    label: homepageCommerceBridgeDescriptions.homepageHero.label,
    contentSchema: homepageHeroContentSchema,
    propsSchema: homepageHeroPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageHero.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageHero.props,
  }),
  homepageFeaturedCollections: bridge({
    component: "homepageFeaturedCollections",
    label: homepageCommerceBridgeDescriptions.homepageFeaturedCollections.label,
    contentSchema: homepageFeaturedCollectionsContentSchema,
    propsSchema: homepageFeaturedCollectionsPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageFeaturedCollections.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageFeaturedCollections.props,
  }),
  homepageFeaturedProducts: bridge({
    component: "homepageFeaturedProducts",
    label: homepageCommerceBridgeDescriptions.homepageFeaturedProducts.label,
    contentSchema: homepageFeaturedProductsContentSchema,
    propsSchema: homepageFeaturedProductsPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageFeaturedProducts.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageFeaturedProducts.props,
  }),
  homepageCollectionNavigation: bridge({
    component: "homepageCollectionNavigation",
    label: homepageCommerceBridgeDescriptions.homepageCollectionNavigation.label,
    contentSchema: homepageCollectionNavigationContentSchema,
    propsSchema: homepageCollectionNavigationPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageCollectionNavigation.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageCollectionNavigation.props,
  }),
  homepagePromotion: bridge({
    component: "homepagePromotion",
    label: homepageCommerceBridgeDescriptions.homepagePromotion.label,
    contentSchema: homepagePromotionContentSchema,
    propsSchema: homepagePromotionPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepagePromotion.content,
    defaultProps: homepageCommerceBridgeDefaults.homepagePromotion.props,
  }),
  homepageTrust: bridge({
    component: "homepageTrust",
    label: homepageCommerceBridgeDescriptions.homepageTrust.label,
    contentSchema: homepageTrustContentSchema,
    propsSchema: homepageTrustPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageTrust.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageTrust.props,
  }),
  homepageEditorial: bridge({
    component: "homepageEditorial",
    label: homepageCommerceBridgeDescriptions.homepageEditorial.label,
    contentSchema: homepageEditorialContentSchema,
    propsSchema: homepageEditorialPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageEditorial.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageEditorial.props,
  }),
  homepageProof: bridge({
    component: "homepageProof",
    label: homepageCommerceBridgeDescriptions.homepageProof.label,
    contentSchema: homepageProofContentSchema,
    propsSchema: homepageProofPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageProof.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageProof.props,
  }),
} as const;
