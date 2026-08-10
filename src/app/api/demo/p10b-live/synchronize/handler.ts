import "server-only";

import { z } from "zod";
import { P10B16L_PROJECT_ID } from "@/data/demo/p10b-16l-live-provider-acceptance";
import {
  isP10bLiveSynthesisAcceptanceConfigured,
  P10bLiveSynthesisAcceptanceError,
  synchronizeP10bLiveSynthesisAggregate,
} from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";

const bodySchema = z
  .object({
    projectId: z.literal(P10B16L_PROJECT_ID),
    sessionId: z.string().min(32).max(128),
    expectedRevision: z.number().int().nonnegative(),
    mode: z.enum(["active", "saved"]),
    aggregate: z.unknown(),
  })
  .strict();

type Environment = Readonly<Record<string, string | undefined>>;

function failure(
  status: number,
  category: "permissionDenied" | "stale" | "validation" | "protectedCommerce",
) {
  return Response.json({ ok: false, failure: { category, retryable: false } }, { status });
}

function mappedFailure(error: unknown): Response {
  if (!(error instanceof P10bLiveSynthesisAcceptanceError)) return failure(400, "validation");
  if (error.code === "unauthorized") return failure(401, "permissionDenied");
  if (error.code === "stale") return failure(409, "stale");
  if (error.code === "protected-commerce") return failure(400, "protectedCommerce");
  return failure(400, "validation");
}

export function createP10bLiveSynthesisSynchronizationHandler({
  environment = process.env,
}: { environment?: Environment } = {}) {
  return async function POST(request: Request): Promise<Response> {
    if (request.method !== "POST" || !isP10bLiveSynthesisAcceptanceConfigured(environment)) {
      return failure(404, "validation");
    }
    if (
      request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json"
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
      const synchronization = await synchronizeP10bLiveSynthesisAggregate({
        ...body,
        environment,
      });
      return Response.json({ ok: true, synchronization });
    } catch (error) {
      return mappedFailure(error);
    }
  };
}
