import type { AvailabilityOptionMediaTransportProjection } from "@/integrations/vesko-availability-options-media/availability-option-media-projection-adapter";

export function canonicalProjection(): AvailabilityOptionMediaTransportProjection {
  return {
    tenantId: "tenant_demo",
    storeId: "store_demo",
    storefrontProjectId: "project_demo",
    catalogueId: "catalogue_demo",
    catalogueRevision: "catalogue-revision-4",
    productId: "product_ring",
    revision: "projection-revision-7",
    supportedLocales: ["en", "fi"],
    productAvailabilityId: "availability_product_ring",
    availability: [
      {
        availabilityId: "availability_product_ring",
        scope: "product",
        status: "inStock",
        purchasable: true,
        stockDisplay: "show",
        revision: "availability-revision-2",
      },
    ],
    attributes: [],
    optionGroups: [],
    variants: [
      {
        variantId: "variant_white_16",
        sku: "RING-WHITE-16",
        optionValueIds: [],
        availabilityId: "availability_product_ring",
        price: { amount: 1390, currency: "EUR" },
        mediaIds: [],
        purchasable: true,
        revision: "variant-revision-3",
      },
    ],
    media: [],
  };
}
