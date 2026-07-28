import "server-only";

import { aiStorefrontProviderRequestSchema } from "@/application/ai-storefront-generation";
import { POST as createProposal } from "@/app/api/ai/whole-storefront-proposals/route";
import { buildP905bLocalDemoRequest } from "@/integrations/ai/p9-05b-local-demo-authority.server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
    const merchantInstruction = (body as { merchantInstruction?: unknown }).merchantInstruction;
    if (typeof merchantInstruction !== "string") {
      throw new Error("A merchant instruction is required.");
    }
    const providerRequest = aiStorefrontProviderRequestSchema.parse(
      await buildP905bLocalDemoRequest(merchantInstruction),
    );
    return createProposal(
      new Request(new URL("/api/ai/whole-storefront-proposals", request.url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(providerRequest),
      }),
    );
  } catch {
    return Response.json(
      { ok: false, failure: { category: "validation", retryable: false } },
      { status: 400 },
    );
  }
}
