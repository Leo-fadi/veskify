import type {
  ComponentInstanceV2,
  ComponentProjectionContext,
  ProductPresentationContext,
} from "@/domain/component-platform";
import type { CollectionDisplayModel, ProductDisplayModel } from "@/domain/catalogue";
import type { CanonicalProductConfigurationResolver } from "@/domain/product-presentation";
import type { PageModel, StorefrontSnapshot } from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";

export type StorefrontCommerceRouteInput = Readonly<{
  aggregate: ProjectAggregate;
  snapshot: StorefrontSnapshot;
  page: PageModel;
}>;

export type ProductCommerceRouteInput = StorefrontCommerceRouteInput &
  Readonly<{ product: ProductDisplayModel }>;

export type CollectionCommerceRouteInput = StorefrontCommerceRouteInput &
  Readonly<{ collection: CollectionDisplayModel }>;

export type ProductCommerceRoutePresentation = Readonly<{
  instance: ComponentInstanceV2;
  projection: ComponentProjectionContext;
  productContext: ProductPresentationContext;
  resolver?: CanonicalProductConfigurationResolver;
  resolveAssetUrl(assetId: string): string;
}>;

export type CollectionCommerceRoutePresentation = Readonly<{
  instance: ComponentInstanceV2;
  projection: ComponentProjectionContext;
  resolveAssetUrl(assetId: string): string;
}>;

export type StorefrontCommerceRouteAdapter = Readonly<{
  product(input: ProductCommerceRouteInput): ProductCommerceRoutePresentation | null;
  collection(input: CollectionCommerceRouteInput): CollectionCommerceRoutePresentation | null;
}>;
