import "server-only";

import { createDeterministicWholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import { PROMPTED_STOREFRONT_STUDIO_OPERATION } from "@/application/prompted-storefront-studio";
import {
  createDefaultServerPromptedStorefrontDesignIntentProviderSelector,
  createServerPromptedStorefrontStudioHandler,
  type SelectServerPromptedStorefrontDesignIntentProvider,
} from "@/integrations/ai/prompted-storefront-studio-handler.server";
import {
  createP10B16P03ServerPromptedStorefrontStudioAuthority,
  unavailableServerPromptedStorefrontStudioAuthority,
  type ServerPromptedStorefrontStudioAuthority,
} from "@/integrations/ai/prompted-storefront-studio-authority.server";
import { selectServerWholeStorefrontPlanningProvider } from "@/integrations/ai/openai/whole-storefront-planning-client.server";
import {
  createP905bLocalDemoAuthority,
  isP905bLocalDemoConfigured,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import {
  createServerWholeStorefrontPlanningHandler,
  createStandaloneServerWholeStorefrontPlanningAuthority,
  unavailableServerWholeStorefrontPlanningAuthority,
  type ServerWholeStorefrontPlanningAuthority,
} from "@/integrations/ai/whole-storefront-runtime-authority";
import type { WholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";

export function createWholeStorefrontPlanningRouteHandler({
  authority,
  selectProvider,
  promptedAuthority,
  selectPromptedProvider,
  environment = process.env,
}: {
  authority?: ServerWholeStorefrontPlanningAuthority;
  selectProvider?: () => WholeStorefrontPlanningProvider;
  promptedAuthority?: ServerPromptedStorefrontStudioAuthority;
  selectPromptedProvider?: SelectServerPromptedStorefrontDesignIntentProvider;
  environment?: Readonly<Record<string, string | undefined>>;
} = {}) {
  const runtimeMode = environment.VESKIFY_RUNTIME_MODE;
  const standalone = runtimeMode === "standalone";
  const integrated = runtimeMode === "integrated" && environment.VESKIFY_AI_PROVIDER === "openai";
  const localDemo = isP905bLocalDemoConfigured(environment);
  const localDemoDeterministic = localDemo && environment.VESKIFY_AI_PROVIDER === "deterministic";
  const legacyHandler = createServerWholeStorefrontPlanningHandler({
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
  // The local P03 authority creates a standalone merchant identity and may never stand in for
  // integrated authentication. Integrated callers must inject an authority backed by their
  // authenticated tenant/project context; otherwise the V2 route fails closed before provider
  // selection.
  const promptedConfigured = standalone;
  const promptedHandler = createServerPromptedStorefrontStudioHandler({
    authority:
      promptedAuthority ??
      (promptedConfigured
        ? createP10B16P03ServerPromptedStorefrontStudioAuthority()
        : unavailableServerPromptedStorefrontStudioAuthority),
    selectProvider:
      selectPromptedProvider ??
      createDefaultServerPromptedStorefrontDesignIntentProviderSelector({ environment }),
  });
  return async function POST(request: Request): Promise<Response> {
    const body: unknown = await request
      .clone()
      .json()
      .catch(() => null);
    if (
      body &&
      typeof body === "object" &&
      "operation" in body &&
      body.operation === PROMPTED_STOREFRONT_STUDIO_OPERATION
    ) {
      return promptedHandler(request);
    }
    return legacyHandler(request);
  };
}
