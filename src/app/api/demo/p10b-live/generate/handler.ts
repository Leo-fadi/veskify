import "server-only";

import { z } from "zod";
import { coordinatedStorefrontDirectionIdSchema } from "@/application/bounded-storefront-synthesis";
import { P10B16L_PROJECT_ID } from "@/data/demo/p10b-16l-live-provider-acceptance";
import {
  configuredP10bLiveSynthesisAcceptanceToken,
  generateP10bLiveSynthesisAcceptance,
  isP10bLiveSynthesisAcceptanceConfigured,
  P10bLiveSynthesisAcceptanceError,
  sameP10bLiveSynthesisAcceptanceSecret,
  selectP10bLiveSynthesisAcceptanceProviderConfiguration,
} from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";

const bodySchema = z
  .object({
    projectId: z.literal(P10B16L_PROJECT_ID),
    sessionId: z.string().min(32).max(128),
    merchantInstruction: z.string().trim().min(1).max(2_000),
    requestedDirectionId: coordinatedStorefrontDirectionIdSchema.nullable(),
  })
  .strict();

type Environment = Readonly<Record<string, string | undefined>>;
type ProviderConfiguration = ReturnType<
  typeof selectP10bLiveSynthesisAcceptanceProviderConfiguration
>;

function failure(
  status: number,
  category: "permissionDenied" | "stale" | "validation" | "providerUnavailable",
) {
  return Response.json({ ok: false, failure: { category, retryable: false } }, { status });
}

function mappedFailure(error: unknown): Response {
  if (!(error instanceof P10bLiveSynthesisAcceptanceError)) {
    return failure(500, "providerUnavailable");
  }
  if (error.code === "unauthorized") return failure(401, "permissionDenied");
  if (error.code === "stale") return failure(409, "stale");
  if (error.code === "provider-unavailable" || error.code === "unavailable") {
    return failure(error.code === "unavailable" ? 404 : 503, "providerUnavailable");
  }
  return failure(400, "validation");
}

export function createP10bLiveSynthesisGenerateHandler({
  environment = process.env,
  selectProviderConfiguration = () =>
    selectP10bLiveSynthesisAcceptanceProviderConfiguration(environment),
}: {
  environment?: Environment;
  selectProviderConfiguration?: () => ProviderConfiguration;
} = {}) {
  return async function POST(request: Request): Promise<Response> {
    if (request.method !== "POST" || !isP10bLiveSynthesisAcceptanceConfigured(environment)) {
      return failure(404, "providerUnavailable");
    }
    if (
      request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json"
    ) {
      return failure(403, "permissionDenied");
    }
    const token = configuredP10bLiveSynthesisAcceptanceToken(environment);
    const supplied = request.headers.get("x-veskify-p10b-16l-acceptance-token");
    if (!token || !supplied || !sameP10bLiveSynthesisAcceptanceSecret(token, supplied)) {
      return failure(403, "permissionDenied");
    }
    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
    } catch {
      return failure(400, "validation");
    }
    try {
      const generation = await generateP10bLiveSynthesisAcceptance({
        ...body,
        providerConfiguration: selectProviderConfiguration(),
        environment,
      });
      return Response.json({ ok: true, generation });
    } catch (error) {
      return mappedFailure(error);
    }
  };
}
