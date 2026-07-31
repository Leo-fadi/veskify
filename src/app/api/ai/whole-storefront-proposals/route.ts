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
import {
  createP905bLocalDemoAuthority,
  isP905bLocalDemoConfigured,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";

export const runtime = "nodejs";

export function createWholeStorefrontPlanningRouteHandler({
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
  const localDemo = isP905bLocalDemoConfigured(environment);
  const localDemoDeterministic = localDemo && environment.VESKIFY_AI_PROVIDER === "deterministic";
  return createServerWholeStorefrontPlanningHandler({
    authority:
      authority ??
      (standalone
        ? createStandaloneServerWholeStorefrontPlanningAuthority()
        : localDemo
          ? createP905bLocalDemoAuthority(environment)
          : unavailableServerWholeStorefrontPlanningAuthority),
    selectProvider:
      selectProvider ??
      (() => {
        if (standalone || localDemoDeterministic)
          return createDeterministicWholeStorefrontPlanningProvider();
        if (integrated) return selectServerWholeStorefrontPlanningProvider();
        throw new Error("A server whole-storefront planner is not configured.");
      }),
  });
}

export const POST = createWholeStorefrontPlanningRouteHandler();
