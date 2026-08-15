import "server-only";

import {
  REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION,
  WHOLE_STOREFRONT_PROPOSAL_OPERATION_HEADER,
} from "@/application/ai-storefront-generation";
import { createDeterministicWholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import { PROMPTED_STOREFRONT_STUDIO_OPERATION } from "@/application/prompted-storefront-studio";
import {
  createDefaultServerPromptedStorefrontDesignIntentProviderSelector,
  createServerPromptedStorefrontStudioHandler,
  type SelectServerPromptedStorefrontDesignIntentProvider,
  type ServerPromptedStorefrontStudioGenerationLifecycle,
} from "@/integrations/ai/prompted-storefront-studio-handler.server";
import {
  unavailableServerPromptedStorefrontStudioAuthority,
  type ServerPromptedStorefrontStudioAuthority,
} from "@/integrations/ai/prompted-storefront-studio-authority.server";
import { selectServerWholeStorefrontPlanningProvider } from "@/integrations/ai/openai/whole-storefront-planning-client.server";
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
  promptedLifecycle,
  environment = process.env,
}: {
  authority?: ServerWholeStorefrontPlanningAuthority;
  selectProvider?: () => WholeStorefrontPlanningProvider;
  promptedAuthority?: ServerPromptedStorefrontStudioAuthority;
  selectPromptedProvider?: SelectServerPromptedStorefrontDesignIntentProvider;
  promptedLifecycle?: ServerPromptedStorefrontStudioGenerationLifecycle;
  environment?: Readonly<Record<string, string | undefined>>;
} = {}) {
  const runtimeMode = environment.VESKIFY_RUNTIME_MODE;
  const standalone = runtimeMode === "standalone";
  const integrated = runtimeMode === "integrated" && environment.VESKIFY_AI_PROVIDER === "openai";
  const legacyHandler = createServerWholeStorefrontPlanningHandler({
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
  // The local P03 authority creates a standalone merchant identity and may never stand in for
  // integrated authentication. Integrated callers must inject an authority backed by their
  // authenticated tenant/project context; otherwise the V2 route fails closed before provider
  // selection.
  const promptedHandler = createServerPromptedStorefrontStudioHandler({
    authority: promptedAuthority ?? unavailableServerPromptedStorefrontStudioAuthority,
    selectProvider:
      selectPromptedProvider ??
      createDefaultServerPromptedStorefrontDesignIntentProviderSelector({ environment }),
    lifecycle: promptedLifecycle,
  });
  return async function POST(request: Request): Promise<Response> {
    const body: unknown = await request
      .clone()
      .json()
      .catch(() => null);
    const promptedOperation =
      body &&
      typeof body === "object" &&
      "operation" in body &&
      body.operation === PROMPTED_STOREFRONT_STUDIO_OPERATION;
    const followUpOperation =
      request.headers.get(WHOLE_STOREFRONT_PROPOSAL_OPERATION_HEADER) ===
      REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION;
    if (promptedOperation && !followUpOperation) {
      return promptedHandler(request);
    }
    if (followUpOperation && !promptedOperation) return legacyHandler(request);
    return Response.json(
      { ok: false, failure: { category: "validation", retryable: false } },
      { status: 400 },
    );
  };
}
