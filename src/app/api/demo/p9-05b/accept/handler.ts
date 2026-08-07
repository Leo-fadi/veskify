import "server-only";

import {
  AcceptedAiReceiptWiringError,
  type AuthoritativeAcceptedAiReceiptService,
} from "@/application/accepted-ai-receipt-wiring/index.server";
import { AcceptedSnapshotReceiptError } from "@/application/accepted-snapshot-publishing";
import { VeskoIntegrationError } from "@/application/vesko-integration";
import { ServerWholeStorefrontAuthorityError } from "@/integrations/ai/whole-storefront-runtime-authority";

function failure(status: number, code: string) {
  return Response.json({ ok: false, failure: { code } }, { status });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

function isJson(request: Request): boolean {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim() === "application/json";
}

function errorResponse(error: unknown): Response {
  if (error instanceof AcceptedAiReceiptWiringError) {
    if (error.code === "authentication-required") return failure(401, error.code);
    if (error.code === "permission-denied") return failure(403, error.code);
    if (["project-mismatch", "proposal-mismatch", "stale-authority"].includes(error.code)) {
      return failure(409, error.code);
    }
    return failure(400, error.code);
  }
  if (error instanceof AcceptedSnapshotReceiptError) {
    const conflict = [
      "receipt-replay",
      "receipt-collision",
      "proposal-mismatch",
      "stale-project",
      "stale-draft",
      "stale-current-snapshot",
    ].includes(error.code);
    return failure(conflict ? 409 : 400, error.code);
  }
  if (error instanceof ServerWholeStorefrontAuthorityError) {
    return failure(error.code === "unauthorized" ? 401 : 409, error.code);
  }
  if (error instanceof VeskoIntegrationError) {
    return failure(error.code === "permissionDenied" ? 403 : 409, error.code);
  }
  return failure(503, "unavailable");
}

export function createP905bAcceptedAiReceiptRouteHandler(options: {
  service: AuthoritativeAcceptedAiReceiptService | null;
}) {
  return async function POST(request: Request): Promise<Response> {
    if (request.method !== "POST" || !sameOrigin(request) || !isJson(request)) {
      return failure(403, "permission-denied");
    }
    if (options.service === null) return failure(503, "unavailable");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(400, "invalid-request");
    }
    try {
      const acceptance = await options.service.accept(body, request);
      return Response.json({ ok: true, acceptance });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
