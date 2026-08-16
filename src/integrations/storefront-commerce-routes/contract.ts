import type {
  ComponentInstanceV2,
  ComponentProjectionContext,
  ProductPresentationContext,
} from "@/domain/component-platform";
import type { CollectionDisplayModel, ProductDisplayModel } from "@/domain/catalogue";
import type { CanonicalProductConfigurationResolver } from "@/domain/product-presentation";
import type { PageFactEvidenceReference, PageModel, StorefrontSnapshot } from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";
import type { StorefrontSearchResultPageV1 } from "@/application/storefront-search";

export type StorefrontCommerceRouteInput = Readonly<{
  aggregate: ProjectAggregate;
  snapshot: StorefrontSnapshot;
  page: PageModel;
  /** Current approval authority required by evidence-grounded dynamic components. */
  evidenceReferences?: readonly PageFactEvidenceReference[];
}>;

export type ProductCommerceRouteInput = StorefrontCommerceRouteInput &
  Readonly<{ product: ProductDisplayModel }>;

export type CollectionCommerceRouteInput = StorefrontCommerceRouteInput &
  Readonly<{ collection: CollectionDisplayModel }>;

/**
 * Search results are transient server-owned authority. They deliberately do
 * not masquerade as a collection or become part of the persisted snapshot.
 */
export type StorefrontSearchCommerceRouteInput = StorefrontCommerceRouteInput &
  Readonly<{ results: StorefrontSearchResultPageV1 }>;

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

export type StorefrontSearchCommerceRoutePresentation = CollectionCommerceRoutePresentation &
  Readonly<{
    search: StorefrontSearchResultPageV1;
  }>;

export type StorefrontCommerceRouteAdapter = Readonly<{
  product(input: ProductCommerceRouteInput): ProductCommerceRoutePresentation | null;
  collection(input: CollectionCommerceRouteInput): CollectionCommerceRoutePresentation | null;
}>;

/** Authoritative route adapter required by executable storefront search. */
export type StorefrontSearchCommerceRouteAdapter = StorefrontCommerceRouteAdapter &
  Readonly<{
    search(
      input: StorefrontSearchCommerceRouteInput,
    ): StorefrontSearchCommerceRoutePresentation | null;
  }>;

export type SearchCommerceRouteInput = StorefrontSearchCommerceRouteInput;
export type SearchCommerceRoutePresentation = StorefrontSearchCommerceRoutePresentation;
