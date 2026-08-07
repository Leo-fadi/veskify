import "server-only";

import { createConfiguredP905bAcceptedAiReceiptService } from "./configured-service.server";
import { createP905bAcceptedAiReceiptRouteHandler } from "./handler";

export const runtime = "nodejs";

export const POST = createP905bAcceptedAiReceiptRouteHandler({
  service: createConfiguredP905bAcceptedAiReceiptService(),
});
