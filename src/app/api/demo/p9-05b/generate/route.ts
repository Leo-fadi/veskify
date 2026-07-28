import "server-only";

import { z } from "zod";
import { aiStorefrontProviderRequestSchema } from "@/application/ai-storefront-generation";
import { POST as createProposal } from "@/app/api/ai/whole-storefront-proposals/route";
import {
  buildP905bLocalDemoRequest,
  claimP905bLocalDemoGeneration,
  configuredP905bLocalDemoToken,
  isP905bLocalDemoConfigured,
  recordP905bLocalDemoProposal,
  sameP905bLocalDemoSecret,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";

const bodySchema = z
  .object({
    merchantInstruction: z.string().trim().min(1).max(2_000),
    projectId: z.literal("project_lumo_fresh"),
    sessionId: z.string().min(32).max(128),
  })
  .strict();

function failure(
  status: number,
  category: "validation" | "permissionDenied" | "providerUnavailable",
) {
  return Response.json({ ok: false, failure: { category, retryable: false } }, { status });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

function isJsonRequest(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim() === "application/json";
}

export function createP905bLocalDemoGenerateHandler({
  environment = process.env,
  createProposalHandler = createProposal,
}: {
  environment?: Readonly<Record<string, string | undefined>>;
  createProposalHandler?: typeof createProposal;
} = {}) {
  return async function POST(request: Request) {
    if (request.method !== "POST" || !isP905bLocalDemoConfigured(environment)) {
      return failure(404, "providerUnavailable");
    }
    if (!isSameOrigin(request) || !isJsonRequest(request)) {
      return failure(403, "permissionDenied");
    }
    const configuredToken = configuredP905bLocalDemoToken(environment);
    const suppliedToken = request.headers.get("x-veskify-p9-05b-demo-token");
    if (
      !configuredToken ||
      !suppliedToken ||
      !sameP905bLocalDemoSecret(suppliedToken, configuredToken)
    ) {
      return failure(403, "permissionDenied");
    }

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
      claimP905bLocalDemoGeneration({
        projectId: body.projectId,
        sessionId: body.sessionId,
        environment,
      });
    } catch {
      return failure(400, "validation");
    }

    try {
      const providerRequest = aiStorefrontProviderRequestSchema.parse(
        await buildP905bLocalDemoRequest(body.merchantInstruction, environment),
      );
      const response = await createProposalHandler(
        new Request(new URL("/api/ai/whole-storefront-proposals", request.url), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(providerRequest),
        }),
      );
      const responseBody: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !responseBody ||
        typeof responseBody !== "object" ||
        !("proposal" in responseBody)
      ) {
        return failure(response.status >= 500 ? response.status : 400, "providerUnavailable");
      }
      const { editorRoute } = recordP905bLocalDemoProposal({
        projectId: body.projectId,
        sessionId: body.sessionId,
        proposal: responseBody.proposal,
        environment,
      });
      return Response.json({ ok: true, editorRoute, proposal: responseBody.proposal });
    } catch {
      return failure(400, "validation");
    }
  };
}

export const POST = createP905bLocalDemoGenerateHandler();
