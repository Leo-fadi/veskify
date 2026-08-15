import "server-only";

import type { WholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import { createDeterministicWholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import {
  createP905bLocalDemoAuthority,
  isP905bLocalDemoConfigured,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import { selectServerWholeStorefrontPlanningProvider } from "@/integrations/ai/openai/whole-storefront-planning-client.server";
import { createWholeStorefrontPlanningRouteHandler } from "./handler";

export function createP905bWholeStorefrontProposalRouteHandler({
  environment = process.env,
  selectProvider,
}: {
  environment?: Readonly<Record<string, string | undefined>>;
  selectProvider?: () => WholeStorefrontPlanningProvider;
} = {}) {
  if (!isP905bLocalDemoConfigured(environment)) {
    return createWholeStorefrontPlanningRouteHandler({ environment });
  }

  return createWholeStorefrontPlanningRouteHandler({
    authority: createP905bLocalDemoAuthority(environment),
    selectProvider:
      selectProvider ??
      (() => {
        if (environment.VESKIFY_AI_PROVIDER === "deterministic") {
          return createDeterministicWholeStorefrontPlanningProvider();
        }
        if (environment.VESKIFY_AI_PROVIDER === "openai") {
          return selectServerWholeStorefrontPlanningProvider({ environment });
        }
        throw new Error("The production-disabled P9 planner is not configured.");
      }),
    environment,
  });
}
