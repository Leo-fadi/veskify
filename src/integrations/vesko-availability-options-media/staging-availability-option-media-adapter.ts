import { z } from "zod";

import { VeskoIntegrationError } from "@/application/vesko-integration";
import {
  createAvailabilityOptionMediaProjectionProvider,
  type AvailabilityOptionMediaLoadContext,
  type CanonicalAvailabilityOptionMediaTransport,
} from "./availability-option-media-projection-adapter";

/**
 * Endpoint-specific staging envelope. The real client is injected; this module
 * deliberately contains no URL, token acquisition or generic HTTP code.
 */
export const veskoStagingAvailabilityOptionMediaResponseSchema = z
  .object({
    authorization: z
      .object({
        tenantId: z.string(),
        storeId: z.string(),
        storefrontProjectId: z.string(),
        permission: z.literal("view-storefront"),
        authorityRevision: z.string(),
      })
      .strict(),
    // Canonical commerce validation belongs exclusively to the P9-04 provider.
    projection: z.unknown(),
  })
  .strict();

export type VeskoStagingAvailabilityOptionMediaResponse = z.infer<
  typeof veskoStagingAvailabilityOptionMediaResponseSchema
>;

export interface VeskoStagingAvailabilityOptionMediaClient {
  fetchProductProjection(context: Readonly<AvailabilityOptionMediaLoadContext>): Promise<unknown>;
}

function assertAuthorized(
  context: AvailabilityOptionMediaLoadContext,
  response: VeskoStagingAvailabilityOptionMediaResponse,
): void {
  const authority = response.authorization;
  if (authority.tenantId !== context.tenantId || authority.storeId !== context.storeId)
    throw new VeskoIntegrationError("tenantMismatch");
  if (authority.storefrontProjectId !== context.storefrontProjectId)
    throw new VeskoIntegrationError("projectMismatch");
}

/** Maps the strict staging response into the merged P9-04 read-only port. */
export function createVeskoStagingAvailabilityOptionMediaAdapter(input: {
  client: VeskoStagingAvailabilityOptionMediaClient;
}) {
  const transport: CanonicalAvailabilityOptionMediaTransport = {
    async load(context) {
      let raw: unknown;
      try {
        raw = await input.client.fetchProductProjection(structuredClone(context));
      } catch (error) {
        if (error instanceof VeskoIntegrationError) throw error;
        throw new VeskoIntegrationError("availabilityUnavailable");
      }
      const parsed = veskoStagingAvailabilityOptionMediaResponseSchema.safeParse(raw);
      if (!parsed.success) throw new VeskoIntegrationError("malformedIntegrationResponse");
      assertAuthorized(context, parsed.data);
      return parsed.data.projection;
    },
  };
  return createAvailabilityOptionMediaProjectionProvider({ transport });
}
