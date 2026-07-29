"use client";

import type { ProjectAggregate } from "@/services/storage";

export type P905bLocalDemoSynchronizationCategory =
  "permissionDenied" | "stale" | "validation" | "protectedCommerce";

export class P905bLocalDemoSynchronizationClientError extends Error {
  constructor(
    readonly category: P905bLocalDemoSynchronizationCategory,
    readonly status: number,
  ) {
    super("The local demo storefront state could not be synchronized.");
    this.name = "P905bLocalDemoSynchronizationClientError";
  }
}

export async function synchronizeP905bLocalDemoAggregate(input: {
  projectId: string;
  sessionId: string;
  expectedRevision: number;
  mode?: "active" | "saved";
  aggregate: ProjectAggregate;
}): Promise<{ authoritativeRevision: number }> {
  const response = await fetch("/api/demo/p9-05b/synchronize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);
  if (
    response.ok &&
    body &&
    typeof body === "object" &&
    "ok" in body &&
    body.ok === true &&
    "synchronization" in body &&
    body.synchronization &&
    typeof body.synchronization === "object" &&
    "authoritativeRevision" in body.synchronization &&
    typeof body.synchronization.authoritativeRevision === "number"
  ) {
    return { authoritativeRevision: body.synchronization.authoritativeRevision };
  }
  const category =
    body &&
    typeof body === "object" &&
    "failure" in body &&
    body.failure &&
    typeof body.failure === "object" &&
    "category" in body.failure &&
    typeof body.failure.category === "string"
      ? body.failure.category
      : "validation";
  throw new P905bLocalDemoSynchronizationClientError(
    category as P905bLocalDemoSynchronizationCategory,
    response.status,
  );
}
