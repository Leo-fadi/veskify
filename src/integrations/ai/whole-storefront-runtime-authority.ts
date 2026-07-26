import { z } from "zod";
import {
  type AiStorefrontProviderRequest,
  type AiStorefrontProviderResponse,
  aiStorefrontProviderRequestSchema,
  validateAiStorefrontProviderResponse,
} from "@/application/ai-storefront-generation";
import {
  requestWholeStorefrontGenerationPlan,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
  type WholeStorefrontPlanningProvider,
} from "@/application/whole-storefront-generation-plan";
import {
  createMerchantProjectAuthorization,
  requireMerchantProjectAction,
  type MerchantProjectAuthorization,
} from "@/application/merchant-project-context";
import { VeskoIntegrationError } from "@/application/vesko-integration";

export class ServerWholeStorefrontAuthorityError extends Error {
  constructor(readonly code: "unauthorized" | "stale" | "unavailable" | "invalid") {
    super("The storefront planning request is unavailable.");
    this.name = "ServerWholeStorefrontAuthorityError";
  }
}

export type ServerWholeStorefrontPlanningContext = Readonly<{
  authorization: MerchantProjectAuthorization;
  planningInput: WholeStorefrontPlanningInput;
  currentPlanningInput: () => WholeStorefrontPlanningInput;
  proposalEnvelope: (
    request: AiStorefrontProviderRequest,
    plan: WholeStorefrontGenerationPlan,
  ) => Promise<unknown>;
}>;

export interface ServerWholeStorefrontPlanningAuthority {
  resolve(
    request: AiStorefrontProviderRequest,
    httpRequest: Request,
  ): Promise<ServerWholeStorefrontPlanningContext>;
}

const responseSchema = z.object({ ok: z.literal(true), proposal: z.unknown() }).strict();

function response(status: number, body: unknown) {
  return Response.json(body, { status });
}

function failure(error: unknown): Response {
  if (error instanceof VeskoIntegrationError && error.code === "permissionDenied") {
    return response(401, { ok: false, failure: { category: "unauthorized", retryable: false } });
  }
  if (error instanceof ServerWholeStorefrontAuthorityError) {
    if (error.code === "unauthorized") {
      return response(401, { ok: false, failure: { category: "unauthorized", retryable: false } });
    }
    if (error.code === "stale") {
      return response(409, { ok: false, failure: { category: "stale", retryable: false } });
    }
    if (error.code === "invalid") {
      return response(400, {
        ok: false,
        failure: { category: "validationRejected", retryable: false },
      });
    }
  }
  return response(503, {
    ok: false,
    failure: { category: "providerUnavailable", retryable: true },
  });
}

/**
 * Executes the P8 canonical plan on the server, then returns the existing
 * editor proposal envelope. The envelope factory is deliberately server-side:
 * clients cannot choose authorities, planning input, or provider credentials.
 */
export function createServerWholeStorefrontPlanningHandler({
  authority,
  selectProvider,
}: {
  authority: ServerWholeStorefrontPlanningAuthority;
  selectProvider: () => WholeStorefrontPlanningProvider;
}) {
  return async function POST(httpRequest: Request): Promise<Response> {
    let request: AiStorefrontProviderRequest;
    try {
      request = aiStorefrontProviderRequestSchema.parse(await httpRequest.json());
    } catch {
      return response(400, {
        ok: false,
        failure: { category: "validationRejected", retryable: false },
      });
    }

    try {
      const context = await authority.resolve(request, httpRequest);
      requireMerchantProjectAction(
        createMerchantProjectAuthorization(context.authorization.context),
        "request-ai-design",
      );
      if (
        context.planningInput.project.id !== request.target.projectId ||
        context.planningInput.draft.id !== request.target.draftSnapshotId ||
        context.planningInput.draft.revision !== request.target.draftRevision ||
        !context.planningInput.project.enabledLocales.includes(request.activeLocale)
      ) {
        throw new ServerWholeStorefrontAuthorityError("stale");
      }
      const plan = await requestWholeStorefrontGenerationPlan({
        provider: selectProvider(),
        input: context.planningInput,
        currentInput: context.currentPlanningInput,
      });
      const envelope = validateAiStorefrontProviderResponse(
        request,
        await context.proposalEnvelope(request, plan),
      );
      return response(200, responseSchema.parse({ ok: true, proposal: envelope }));
    } catch (error) {
      return failure(error);
    }
  };
}

export const unavailableServerWholeStorefrontPlanningAuthority: ServerWholeStorefrontPlanningAuthority =
  {
    resolve: () => Promise.reject(new ServerWholeStorefrontAuthorityError("unavailable")),
  };
