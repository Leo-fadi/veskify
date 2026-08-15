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
  homepageFeaturedProductsDefinition,
  homepageFeaturedProductsPropsSchema,
  homepageEditorialContentSchema,
  homepageEditorialDefinition,
  homepageEditorialPropsSchema,
  homepageHeroContentSchema,
  homepageHeroDefinition,
  homepageHeroPropsSchema,
  homepageProofContentSchema,
  homepageProofDefinition,
  homepageProofPropsSchema,
  homepageCollectionNavigationDefinition,
  homepageFeaturedCollectionsDefinition,
  homepagePromotionDefinition,
  homepagePromotionContentSchema,
  homepagePromotionPropsSchema,
  homepageTrustDefinition,
  homepageTrustContentSchema,
  homepageTrustPropsSchema,
} from "./homepage-commerce";

export const homepageCommerceBridgeComponentNames = [
  "homepageHero",
  "homepageFeaturedCollections",
  "homepageFeaturedProducts",
  "homepageCollectionNavigation",
  "homepagePromotion",
  "homepageTrust",
  "homepageEditorial",
  "homepageProof",
] as const;

export type HomepageCommerceBridgeComponent = (typeof homepageCommerceBridgeComponentNames)[number];

function variantIds(
  definition: Readonly<{ type: string; variants: readonly { id: string }[] }>,
): readonly [string, ...string[]] {
  const variants = definition.variants.map(({ id }) => id);
  const first = variants[0];
  if (!first) throw new Error(`Homepage component ${definition.type} has no variants.`);
  return [first, ...variants.slice(1)];
}

export const homepageCommerceBridgeVariants: Readonly<
  Record<HomepageCommerceBridgeComponent, readonly [string, ...string[]]>
> = {
  homepageHero: variantIds(homepageHeroDefinition),
  homepageFeaturedCollections: variantIds(homepageFeaturedCollectionsDefinition),
  homepageFeaturedProducts: variantIds(homepageFeaturedProductsDefinition),
  homepageCollectionNavigation: variantIds(homepageCollectionNavigationDefinition),
  homepagePromotion: variantIds(homepagePromotionDefinition),
  homepageTrust: variantIds(homepageTrustDefinition),
  homepageEditorial: variantIds(homepageEditorialDefinition),
  homepageProof: variantIds(homepageProofDefinition),
};

export const homepageCommerceBridgeDefaults = {
  homepageHero: {
    content: homepageHeroContentSchema.parse({
      heading: { en: "Discover the collection", fi: "Tutustu mallistoon" },
    }),
    props: homepageHeroPropsSchema.parse({
      mediaPosition: "right",
      imagePresentation: "cover",
      textAlignment: "left",
    }),
  },
  homepageFeaturedCollections: {
    content: homepageFeaturedCollectionsContentSchema.parse({
      heading: { en: "Shop by collection", fi: "Osta mallistoittain" },
      mediaPlaceholderLabel: {
        en: "Collection image unavailable",
        fi: "Mallistokuva ei ole saatavilla",
      },
    }),
    props: homepageFeaturedCollectionsPropsSchema.parse({
      layout: "grid",
      cardPresentation: "image",
      columns: 3,
      showDescriptions: true,
    }),
  },
  homepageFeaturedProducts: {
    content: homepageFeaturedProductsContentSchema.parse({
      heading: { en: "Featured products", fi: "Nostetut tuotteet" },
      mediaPlaceholderLabel: { en: "Product image unavailable", fi: "Tuotekuva ei ole saatavilla" },
      emptyStateMessage: { en: "Products will appear here.", fi: "Tuotteet näkyvät täällä." },
    }),
    props: homepageFeaturedProductsPropsSchema.parse({
      layout: "grid",
      cardVariant: "standard",
      columns: 3,
    }),
  },
  homepageCollectionNavigation: {
    content: homepageCollectionNavigationContentSchema.parse({
      heading: { en: "Browse collections", fi: "Selaa mallistoja" },
      mediaPlaceholderLabel: {
        en: "Collection image unavailable",
        fi: "Mallistokuva ei ole saatavilla",
      },
    }),
    props: homepageCollectionNavigationPropsSchema.parse({ presentation: "compact", columns: 3 }),
  },
  homepagePromotion: {
    content: homepagePromotionContentSchema.parse({
      heading: { en: "Made for considered shopping", fi: "Harkittuun ostamiseen" },
      description: { en: "Explore the latest collection.", fi: "Tutustu uusimpaan mallistoon." },
    }),
    props: homepagePromotionPropsSchema.parse({
      mediaPosition: "right",
      actionPresentation: "primary",
      textAlignment: "left",
    }),
  },
  homepageTrust: {
    content: homepageTrustContentSchema.parse({
      items: [
        {
          id: "support",
          kind: "service",
          title: { en: "Here to help", fi: "Autamme mielellämme" },
          description: {
            en: "Review store support before ordering.",
            fi: "Tarkista kaupan tuki ennen tilausta.",
          },
        },
      ],
    }),
    props: homepageTrustPropsSchema.parse({ columns: 3, textAlignment: "left" }),
  },
  homepageEditorial: {
    content: homepageEditorialContentSchema.parse({
      eyebrow: { en: "Our perspective", fi: "Näkökulmamme" },
      heading: { en: "A considered point of view", fi: "Harkittu näkökulma" },
      body: {
        en: "Discover the approved story and imagery behind the collection.",
        fi: "Tutustu malliston hyväksyttyyn tarinaan ja kuvamaailmaan.",
      },
    }),
    props: homepageEditorialPropsSchema.parse({
      mediaPosition: "right",
      textAlignment: "left",
      galleryColumns: 2,
    }),
  },
  homepageProof: {
    content: homepageProofContentSchema.parse({ items: [] }),
    props: homepageProofPropsSchema.parse({ columns: 3, textAlignment: "left" }),
  },
} satisfies Readonly<
  Record<
    HomepageCommerceBridgeComponent,
    { content: ComponentInstanceV2["content"]; props: ComponentInstanceV2["props"] }
  >
>;

function projectionFor(
  context: StorefrontRenderContext,
  placements: readonly ApprovedAssetPlacementOperation[] = [],
  presentations: readonly ApprovedAssetPresentation[] = [],
  productCardArtContext?: Readonly<{ component: ComponentDefinitionV2; variant: string }>,
): ComponentProjectionContext {
  const revision = `catalogue-${context.catalogue.id}`;
  const products: ProductPresentationContext[] = context.catalogue.products.map((product) => ({
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
      : {
          price: product.price,
        }),
    ...(product.compareAtPrice === undefined
      ? {}
      : {
          compareAtPrice: product.compareAtPrice,
        }),
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
    media: product.images.map((image, index) => ({
      assetId: image.id,
      role: index === 0 ? ("main" as const) : ("alternative" as const),
      ...(image.alt === undefined ? {} : { alt: image.alt }),
    })),
    attributeGroups: [],
    optionGroups: [],
    selectedValues: [],
    unavailableCombinations: [],
    relatedProductIds: [],
    revision,
  }));
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
  const assets: StorefrontAssetMetadata[] = context.catalogue.products.flatMap((product) => {
    const productContext = products.find((candidate) => candidate.productId === product.id)!;
    return product.images.map((image, index) => {
      const media = productContext.media[index];
      return {
        assetId: image.id,
        role: index === 0 ? ("productMainImage" as const) : ("productAlternativeImage" as const),
        ...(image.alt === undefined ? { decorative: true } : { alt: image.alt, decorative: false }),
        provenance: { kind: "canonicalProductMedia" as const, sourceId: product.id },
        approvalStatus: "approved" as const,
        usageRights: "merchantOwned" as const,
        responsiveCrops: [],
        revision,
        ...(productCardArtContext && media
          ? {
              artDirection: createCanonicalProductMediaResponsiveAuthority({
                component: productCardArtContext.component,
                variant: productCardArtContext.variant,
                brandSystem: context.brandSystem,
                productId: product.id,
                media,
                revision,
                assetSlotId: "productMedia",
              }),
            }
          : {}),
      };
    });
  });
  placements.forEach((placement) => {
    if (assets.some((asset) => asset.assetId === placement.assetId)) return;
    const presentation = presentations.find((candidate) => candidate.assetId === placement.assetId);
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
      revision: placement.assetRevision,
    });
  });
  return {
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
  };
}

function instanceFor(
  component: HomepageCommerceBridgeComponent,
  sectionId: string,
  variant: string,
  content: unknown,
  props: unknown,
  placements: readonly ApprovedAssetPlacementOperation[],
  context: StorefrontRenderContext,
): ComponentInstanceV2 {
  const componentPlacements = placements.filter(
    (placement) => placement.componentId === sectionId && placement.componentType === component,
  );
  const projection = projectionFor(context, componentPlacements);
  const revision = `catalogue-${context.catalogue.id}`;
  const contentRecord = z.record(z.string(), z.unknown()).parse(content);
  const persistedProductIds =
    component === "homepageFeaturedProducts" && Array.isArray(contentRecord.productIds)
      ? contentRecord.productIds.map((id) => z.string().parse(id))
      : undefined;
  if (
    persistedProductIds?.some(
      (id) => !projection.products.some((product) => product.productId === id),
    )
  ) {
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
              const product = context.catalogue.products.find((item) => item.id === productId);
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
    editorFields: {},
    protectedFields: { readOnlyPaths: ["catalogue", "navigation", "bindings", "assetAssignments"] },
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
      const migratedPresentations = approvedAssetPresentations.map((presentation) => {
        const placement = approvedAssetPlacements.find(
          (candidate) => candidate.assetId === presentation.assetId,
        );
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
      const projection = projectionFor(
        context,
        approvedAssetPlacements,
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
          approvedAssetPlacements,
          context,
        ),
        projection,
        activeLocale: context.activeLocale,
        primaryLocale: context.primaryLocale,
        resolveAssetUrl: (assetId) =>
          migratedPresentations.find((presentation) => presentation.assetId === assetId)?.asset
            .url ??
          context.catalogue.products
            .flatMap((product) => product.images)
            .find((asset) => asset.id === assetId)?.url ??
          "/seed-assets/placeholder.svg",
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
    label: "Homepage hero",
    contentSchema: homepageHeroContentSchema,
    propsSchema: homepageHeroPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageHero.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageHero.props,
  }),
  homepageFeaturedCollections: bridge({
    component: "homepageFeaturedCollections",
    label: "Featured collections",
    contentSchema: homepageFeaturedCollectionsContentSchema,
    propsSchema: homepageFeaturedCollectionsPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageFeaturedCollections.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageFeaturedCollections.props,
  }),
  homepageFeaturedProducts: bridge({
    component: "homepageFeaturedProducts",
    label: "Featured products",
    contentSchema: homepageFeaturedProductsContentSchema,
    propsSchema: homepageFeaturedProductsPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageFeaturedProducts.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageFeaturedProducts.props,
  }),
  homepageCollectionNavigation: bridge({
    component: "homepageCollectionNavigation",
    label: "Collection navigation",
    contentSchema: homepageCollectionNavigationContentSchema,
    propsSchema: homepageCollectionNavigationPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageCollectionNavigation.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageCollectionNavigation.props,
  }),
  homepagePromotion: bridge({
    component: "homepagePromotion",
    label: "Promotional content",
    contentSchema: homepagePromotionContentSchema,
    propsSchema: homepagePromotionPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepagePromotion.content,
    defaultProps: homepageCommerceBridgeDefaults.homepagePromotion.props,
  }),
  homepageTrust: bridge({
    component: "homepageTrust",
    label: "Trust and support",
    contentSchema: homepageTrustContentSchema,
    propsSchema: homepageTrustPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageTrust.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageTrust.props,
  }),
  homepageEditorial: bridge({
    component: "homepageEditorial",
    label: "Editorial storytelling",
    contentSchema: homepageEditorialContentSchema,
    propsSchema: homepageEditorialPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageEditorial.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageEditorial.props,
  }),
  homepageProof: bridge({
    component: "homepageProof",
    label: "Evidence-grounded proof",
    contentSchema: homepageProofContentSchema,
    propsSchema: homepageProofPropsSchema,
    defaultContent: homepageCommerceBridgeDefaults.homepageProof.content,
    defaultProps: homepageCommerceBridgeDefaults.homepageProof.props,
  }),
} as const;
