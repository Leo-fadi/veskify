import "server-only";

import {
  REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION,
  WHOLE_STOREFRONT_PROPOSAL_OPERATION_HEADER,
} from "@/application/ai-storefront-generation";
import { PROMPTED_STOREFRONT_STUDIO_OPERATION } from "@/application/prompted-storefront-studio";
import type {
  SelectServerPromptedStorefrontDesignIntentProvider,
  ServerPromptedStorefrontStudioGenerationLifecycle,
} from "@/integrations/ai/prompted-storefront-studio-handler.server";
import type { ServerPromptedStorefrontStudioAuthority } from "@/integrations/ai/prompted-storefront-studio-authority-contract.server";
import type { ServerWholeStorefrontPlanningAuthority } from "@/integrations/ai/whole-storefront-runtime-authority";
import type { WholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import { createPromptedStorefrontComposition } from "./prompted-composition.server";
import { createLegacyFollowUpComposition } from "./legacy-follow-up-composition.server";

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
  const legacyHandler = createLegacyFollowUpComposition({ authority, selectProvider, environment });
  const promptedHandler = createPromptedStorefrontComposition({
    promptedAuthority,
    selectPromptedProvider,
    promptedLifecycle,
    environment,
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
