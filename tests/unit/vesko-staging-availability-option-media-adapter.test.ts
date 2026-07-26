import { describe, expect, it } from "vitest";
import { VeskoIntegrationError } from "@/application/vesko-integration";
import { createVeskoStagingAvailabilityOptionMediaAdapter } from "@/integrations/vesko-availability-options-media/staging-availability-option-media-adapter";
import { canonicalProjection } from "./vesko-staging-fixtures";

const context = {
  tenantId: "tenant_demo",
  storeId: "store_demo",
  storefrontProjectId: "project_demo",
  productId: "product_ring",
  expectedRevision: "projection-revision-7",
};

describe("P10-03 staging availability/options/media boundary", () => {
  it("maps the strict read-only envelope and preserves canonical commerce facts", async () => {
    const projection = canonicalProjection();
    const adapter = createVeskoStagingAvailabilityOptionMediaAdapter({
      client: {
        fetchProductProjection: () =>
          Promise.resolve({
            authorization: {
              tenantId: context.tenantId,
              storeId: context.storeId,
              storefrontProjectId: context.storefrontProjectId,
              permission: "view-storefront",
              authorityRevision: "auth-1",
            },
            projection,
          }),
      },
    });
    const result = await adapter.load(context);
    expect(result.variants[0]).toMatchObject({
      variantId: "variant_white_16",
      sku: "RING-WHITE-16",
      price: { amount: 1390 },
    });
    expect(result.optionGroups).toHaveLength(0);
    expect(result.media).toHaveLength(0);
  });

  it("rejects identity, authority and malformed staging responses", async () => {
    const projection = canonicalProjection();
    const make = (authorization: Record<string, unknown>, payload: unknown = projection) =>
      createVeskoStagingAvailabilityOptionMediaAdapter({
        client: {
          fetchProductProjection: () => Promise.resolve({ authorization, projection: payload }),
        },
      }).load(context);
    const authority = {
      tenantId: context.tenantId,
      storeId: context.storeId,
      storefrontProjectId: context.storefrontProjectId,
      permission: "view-storefront",
      authorityRevision: "a",
    };
    await expect(make(authority, { nope: true })).rejects.toMatchObject({
      code: "malformedIntegrationResponse",
    });
    await expect(
      make({ ...authority, storefrontProjectId: "project_other" }),
    ).rejects.toBeInstanceOf(VeskoIntegrationError);
    await expect(make({ ...authority, permission: "edit-storefront" })).rejects.toMatchObject({
      code: "malformedIntegrationResponse",
    });
  });
});
