import "server-only";

import {
  createDeterministicWholeStorefrontPlanningProvider,
  type WholeStorefrontPlanningProvider,
} from "@/application/whole-storefront-generation-plan";
import { selectServerWholeStorefrontPlanningProvider } from "@/integrations/ai/openai/whole-storefront-planning-client.server";
import {
  createServerWholeStorefrontPlanningHandler,
  createStandaloneServerWholeStorefrontPlanningAuthority,
  unavailableServerWholeStorefrontPlanningAuthority,
  type ServerWholeStorefrontPlanningAuthority,
} from "@/integrations/ai/whole-storefront-runtime-authority";

/** Retained registered follow-up composition; replacement is owned by AR-20. */
export function createLegacyFollowUpComposition({
  authority,
  selectProvider,
  environment = process.env,
}: {
  authority?: ServerWholeStorefrontPlanningAuthority;
  selectProvider?: () => WholeStorefrontPlanningProvider;
  environment?: Readonly<Record<string, string | undefined>>;
} = {}) {
  const runtimeMode = environment.VESKIFY_RUNTIME_MODE;
  const standalone = runtimeMode === "standalone";
  const integrated = runtimeMode === "integrated" && environment.VESKIFY_AI_PROVIDER === "openai";
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
