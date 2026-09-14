import "server-only";

import { createWholeStorefrontPlanningRouteHandler } from "./handler";

export const runtime = "nodejs";

const normalHandler = createWholeStorefrontPlanningRouteHandler();

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "production") {
    const { dispatchLocalAcceptance } = await import("./local-acceptance-dispatch.server");
    const selected = await dispatchLocalAcceptance(request);
    if (selected !== undefined) return selected;
  }
  return normalHandler(request);
}
