import "server-only";

import { createWholeStorefrontPlanningRouteHandler } from "./handler";

export const runtime = "nodejs";

export const POST = createWholeStorefrontPlanningRouteHandler();
