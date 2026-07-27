import "server-only";

import { selectServerWholeStorefrontPlanningProvider } from "@/integrations/ai/openai/whole-storefront-planning-client.server";
import { createDeterministicWholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import {
  createStandaloneServerWholeStorefrontPlanningAuthority,
  createServerWholeStorefrontPlanningHandler,
  unavailableServerWholeStorefrontPlanningAuthority,
} from "@/integrations/ai/whole-storefront-runtime-authority";

export const runtime = "nodejs";

const runtimeMode = process.env.VESKIFY_RUNTIME_MODE;
const standalone = runtimeMode === "standalone";
const integrated = runtimeMode === "integrated" && process.env.VESKIFY_AI_PROVIDER === "openai";

export const POST = createServerWholeStorefrontPlanningHandler({
  authority: standalone
    ? createStandaloneServerWholeStorefrontPlanningAuthority()
    : unavailableServerWholeStorefrontPlanningAuthority,
  selectProvider: () => {
    if (standalone) return createDeterministicWholeStorefrontPlanningProvider();
    if (integrated) return selectServerWholeStorefrontPlanningProvider();
    throw new Error("A server whole-storefront planner is not configured.");
  },
});
