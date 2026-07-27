import "server-only";

import { selectServerWholeStorefrontPlanningProvider } from "@/integrations/ai/openai/whole-storefront-planning-client.server";
import { createDeterministicWholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import {
  createStandaloneServerWholeStorefrontPlanningAuthority,
  createServerWholeStorefrontPlanningHandler,
  unavailableServerWholeStorefrontPlanningAuthority,
  type ServerWholeStorefrontPlanningAuthority,
} from "@/integrations/ai/whole-storefront-runtime-authority";
import type { WholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";

export const runtime = "nodejs";

export function createWholeStorefrontPlanningRouteHandler({
  authority,
  selectProvider,
}: {
  authority?: ServerWholeStorefrontPlanningAuthority;
  selectProvider?: () => WholeStorefrontPlanningProvider;
} = {}) {
  const runtimeMode = process.env.VESKIFY_RUNTIME_MODE;
  const standalone = runtimeMode === "standalone";
  const integrated = runtimeMode === "integrated" && process.env.VESKIFY_AI_PROVIDER === "openai";
  return createServerWholeStorefrontPlanningHandler({
    authority:
      authority ??
      (standalone
        ? createStandaloneServerWholeStorefrontPlanningAuthority()
        : unavailableServerWholeStorefrontPlanningAuthority),
    selectProvider:
      selectProvider ??
      (() => {
        if (standalone) return createDeterministicWholeStorefrontPlanningProvider();
        if (integrated) return selectServerWholeStorefrontPlanningProvider();
        throw new Error("A server whole-storefront planner is not configured.");
      }),
  });
}

export const POST = createWholeStorefrontPlanningRouteHandler();
