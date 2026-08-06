import "server-only";

import { z } from "zod";
import {
  AuthoritativeMerchantPublishError,
  merchantPublishConfirmRequestSchema,
  merchantPublishPrepareRequestSchema,
  type AuthoritativeMerchantPublishService,
} from "@/application/publishing/authoritative-merchant-publish.server";
import { VeskoIntegrationError } from "@/application/vesko-integration";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare"), request: merchantPublishPrepareRequestSchema }).strict(),
  z.object({ action: z.literal("confirm"), request: merchantPublishConfirmRequestSchema }).strict(),
]);

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

function failure(status: number, code: string) {
  return Response.json({ ok: false, failure: { code } }, { status });
}

function errorResponse(error: unknown): Response {
  if (error instanceof AuthoritativeMerchantPublishError) {
    if (error.code === "authentication-required") return failure(401, error.code);
    if (error.code === "permission-denied") return failure(403, error.code);
    if (
      error.code === "project-mismatch" ||
      error.code === "missing-preparation" ||
      error.code === "idempotency-conflict"
    ) {
      return failure(409, error.code);
    }
    return failure(400, error.code);
  }
  if (error instanceof VeskoIntegrationError) {
    const status = error.code === "permissionDenied" ? 403 : 409;
    return failure(status, error.code);
  }
  return failure(503, "publishing-unavailable");
}

export function createAuthoritativeMerchantPublishRouteHandler(options: {
  service: AuthoritativeMerchantPublishService | null;
}) {
  return async function POST(request: Request): Promise<Response> {
    if (request.method !== "POST" || !sameOrigin(request)) {
      return failure(403, "permission-denied");
    }
    if (options.service === null) return failure(503, "publishing-unavailable");
    let body: z.infer<typeof requestSchema>;
    try {
      body = requestSchema.parse(await request.json());
    } catch {
      return failure(400, "invalid-request");
    }
    try {
      if (body.action === "prepare") {
        const preparation = await options.service.prepare(body.request, request);
        return Response.json({ ok: true, preparation });
      }
      const publication = await options.service.confirm(body.request, request);
      return Response.json({ ok: true, publication });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
