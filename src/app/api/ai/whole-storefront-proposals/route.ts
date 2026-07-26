import "server-only";

import { selectServerWholeStorefrontPlanningProvider } from "@/integrations/ai/openai/whole-storefront-planning-client.server";
import {
  createServerWholeStorefrontPlanningHandler,
  unavailableServerWholeStorefrontPlanningAuthority,
} from "@/integrations/ai/whole-storefront-runtime-authority";

export const runtime = "nodejs";

export const POST = createServerWholeStorefrontPlanningHandler({
  authority: unavailableServerWholeStorefrontPlanningAuthority,
  selectProvider: selectServerWholeStorefrontPlanningProvider,
});
