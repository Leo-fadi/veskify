import "server-only";

import { z } from "zod";
import { aiStorefrontProviderRequestSchema } from "@/application/ai-storefront-generation";
import { createDeterministicWholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import {
  buildP905bLocalDemoRequest,
  configuredP905bLocalDemoToken,
  createP905bLocalDemoAuthority,
  isP905bLocalDemoConfigured,
  sameP905bLocalDemoSecret,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";
import { selectServerWholeStorefrontPlanningProvider } from "@/integrations/ai/openai/whole-storefront-planning-client.server";
import { createServerWholeStorefrontPlanningHandler } from "@/integrations/ai/whole-storefront-runtime-authority";

const bodySchema = z
  .object({
    merchantInstruction: z.string().trim().min(1).max(2_000),
    projectId: z.literal("project_lumo_fresh"),
    sessionId: z.string().min(32).max(128),
  })
  .strict();

type CreateProposalHandler = (request: Request) => Promise<Response>;

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
  createProposalHandler,
}: {
  environment?: Readonly<Record<string, string | undefined>>;
  createProposalHandler?: CreateProposalHandler;
} = {}) {
  const proposalHandler =
    createProposalHandler ??
    createServerWholeStorefrontPlanningHandler({
      authority: createP905bLocalDemoAuthority(environment),
      selectProvider: () => {
        if (environment.VESKIFY_AI_PROVIDER === "deterministic") {
          return createDeterministicWholeStorefrontPlanningProvider();
        }
        if (environment.VESKIFY_AI_PROVIDER === "openai") {
          return selectServerWholeStorefrontPlanningProvider({ environment });
        }
        throw new Error("The production-disabled P9 planner is not configured.");
      },
    });
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
    } catch {
      return failure(400, "validation");
    }

    try {
      const providerRequest = aiStorefrontProviderRequestSchema.parse(
        await buildP905bLocalDemoRequest(body.merchantInstruction, environment),
      );
      const response = await proposalHandler(
        new Request(new URL("/api/ai/whole-storefront-proposals", request.url), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-veskify-p9-05b-session": body.sessionId,
          },
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
      const editorRoute = `/projects/${body.projectId}/editor?p9-05b-session=${encodeURIComponent(body.sessionId)}`;
      return Response.json({ ok: true, editorRoute, proposal: responseBody.proposal });
    } catch {
      return failure(400, "validation");
    }
  };
}
