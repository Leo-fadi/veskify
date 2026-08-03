import "server-only";

import { z } from "zod";
import {
  P905bLocalDemoSynchronizationError,
  isP905bLocalDemoConfigured,
  synchronizeP905bLocalDemoAggregate,
} from "@/integrations/ai/p9-05b-local-demo-authority.server";

const bodySchema = z
  .object({
    projectId: z.literal("project_lumo_fresh"),
    sessionId: z.string().min(32).max(128),
    expectedRevision: z.number().int().nonnegative(),
    mode: z.enum(["active", "saved"]).default("saved"),
    aggregate: z.unknown(),
  })
  .strict();

function failure(
  status: number,
  category: "permissionDenied" | "stale" | "validation" | "protectedCommerce",
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

export function createP905bLocalDemoSynchronizationHandler({
  environment = process.env,
}: {
  environment?: Readonly<Record<string, string | undefined>>;
} = {}) {
  return async function POST(request: Request) {
    if (request.method !== "POST" || !isP905bLocalDemoConfigured(environment)) {
      return Response.json(
        { ok: false, failure: { category: "validation", retryable: false } },
        { status: 404 },
      );
    }
    if (!isSameOrigin(request) || !isJsonRequest(request)) return failure(403, "permissionDenied");

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
    } catch {
      return failure(400, "validation");
    }

    try {
      const result = await synchronizeP905bLocalDemoAggregate({ ...body, environment });
      return Response.json({ ok: true, synchronization: result });
    } catch (error) {
      if (error instanceof P905bLocalDemoSynchronizationError) {
        if (error.code === "unauthorized") return failure(401, "permissionDenied");
        if (error.code === "stale") return failure(409, "stale");
        if (error.code === "protectedCommerce") return failure(400, "protectedCommerce");
      }
      return failure(400, "validation");
    }
  };
}
