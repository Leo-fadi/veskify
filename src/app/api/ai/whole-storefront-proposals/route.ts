import "server-only";

import {
  REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION,
  WHOLE_STOREFRONT_PROPOSAL_OPERATION_HEADER,
} from "@/application/ai-storefront-generation";
import { PROMPTED_STOREFRONT_STUDIO_OPERATION } from "@/application/prompted-storefront-studio";
import { createWholeStorefrontPlanningRouteHandler } from "./handler";

export const runtime = "nodejs";

const normalHandler = createWholeStorefrontPlanningRouteHandler();
let localAcceptanceHandler:
  ReturnType<typeof createWholeStorefrontPlanningRouteHandler> | undefined;
let standalonePromptedHandler:
  ReturnType<typeof createWholeStorefrontPlanningRouteHandler> | undefined;
let localP905bFollowUpHandler:
  ReturnType<typeof createWholeStorefrontPlanningRouteHandler> | undefined;

function isLocalP10B16P04CompositionEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VESKIFY_RUNTIME_MODE === "integrated" &&
    process.env.VESKIFY_AI_PROVIDER === "openai" &&
    process.env.VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE === "1"
  );
}

async function loadLocalAcceptanceHandler() {
  if (!localAcceptanceHandler) {
    const { createP10B16P04WholeStorefrontProposalRouteHandler } =
      await import("./p10b-16p-04-composition.server");
    localAcceptanceHandler = createP10B16P04WholeStorefrontProposalRouteHandler();
  }
  return localAcceptanceHandler;
}

async function loadStandalonePromptedHandler() {
  if (!standalonePromptedHandler) {
    const { createP10B16P03WholeStorefrontProposalRouteHandler } =
      await import("./p10b-16p-03-composition.server");
    standalonePromptedHandler = createP10B16P03WholeStorefrontProposalRouteHandler();
  }
  return standalonePromptedHandler;
}

function isLocalP905bFollowUpRequest(request: Request): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VESKIFY_RUNTIME_MODE === "integrated" &&
    process.env.VESKIFY_P9_05B_LOCAL_DEMO === "1" &&
    request.headers.get(WHOLE_STOREFRONT_PROPOSAL_OPERATION_HEADER) ===
      REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION &&
    request.headers.has("x-veskify-p9-05b-session")
  );
}

async function loadLocalP905bFollowUpHandler() {
  if (!localP905bFollowUpHandler) {
    const { createP905bWholeStorefrontProposalRouteHandler } =
      await import("./p9-05b-composition.server");
    localP905bFollowUpHandler = createP905bWholeStorefrontProposalRouteHandler();
  }
  return localP905bFollowUpHandler;
}

export async function POST(request: Request): Promise<Response> {
  if (isLocalP10B16P04CompositionEnabled()) {
    return (await loadLocalAcceptanceHandler())(request);
  }
  if (process.env.NODE_ENV !== "production" && process.env.VESKIFY_RUNTIME_MODE === "standalone") {
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
      return (await loadStandalonePromptedHandler())(request);
    }
  }
  if (isLocalP905bFollowUpRequest(request)) {
    return (await loadLocalP905bFollowUpHandler())(request);
  }
  return normalHandler(request);
}
