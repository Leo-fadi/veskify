import "server-only";

import { createConfiguredAuthoritativeMerchantPublishService } from "./configured-service.server";
import { createAuthoritativeMerchantPublishRouteHandler } from "./handler";

export const runtime = "nodejs";

export const POST = createAuthoritativeMerchantPublishRouteHandler({
  service: createConfiguredAuthoritativeMerchantPublishService(),
});
