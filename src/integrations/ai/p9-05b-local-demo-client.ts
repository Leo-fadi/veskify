"use client";

import {
  acceptedAiProposalAcceptanceResultSchema,
  type AcceptedAiProposalAcceptanceRequest,
} from "@/application/accepted-ai-receipt-wiring";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { projectSchema } from "@/domain/project";
import { storefrontSnapshotSchema } from "@/domain/storefront";
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

export async function acceptP905bLocalDemoProposal(
  input: AcceptedAiProposalAcceptanceRequest & { sessionId: string },
): Promise<{ receiptId: string; authoritativeRevision: number }> {
  const { sessionId, ...request } = input;
  const response = await fetch("/api/demo/p9-05b/accept", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-veskify-p9-05b-session": sessionId,
    },
    body: JSON.stringify(request),
  });
  const body: unknown = await response.json().catch(() => null);
  const acceptance =
    body && typeof body === "object" && "ok" in body && body.ok === true && "acceptance" in body
      ? acceptedAiProposalAcceptanceResultSchema.safeParse(body.acceptance)
      : null;
  if (response.ok && acceptance?.success) return acceptance.data;
  const code =
    body &&
    typeof body === "object" &&
    "failure" in body &&
    body.failure &&
    typeof body.failure === "object" &&
    "code" in body.failure &&
    typeof body.failure.code === "string"
      ? body.failure.code
      : "validation";
  throw new P905bLocalDemoSynchronizationClientError(
    code === "stale-authority" ? "stale" : "validation",
    response.status,
  );
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

export class P905bLocalDemoSavedAggregateClientError extends Error {
  constructor() {
    super("The local demo saved storefront could not be loaded.");
    this.name = "P905bLocalDemoSavedAggregateClientError";
  }
}

function parseSavedAggregate(value: unknown): ProjectAggregate | null {
  if (!value || typeof value !== "object") return null;
  const project = "project" in value ? projectSchema.safeParse(value.project) : null;
  const catalogue =
    "catalogue" in value ? catalogueDisplayModelSchema.safeParse(value.catalogue) : null;
  const snapshots =
    "snapshots" in value && Array.isArray(value.snapshots)
      ? value.snapshots.map((snapshot) => storefrontSnapshotSchema.safeParse(snapshot))
      : null;
  if (
    !project?.success ||
    !catalogue?.success ||
    !snapshots?.every((snapshot) => snapshot.success)
  ) {
    return null;
  }
  return {
    project: project.data,
    catalogue: catalogue.data,
    snapshots: snapshots.map((snapshot) => snapshot.data),
  };
}

export async function loadP905bLocalDemoSavedAggregate(input: {
  projectId: string;
  sessionId: string;
}): Promise<{ aggregate: ProjectAggregate; authoritativeRevision: number }> {
  const response = await fetch(
    `/api/demo/p9-05b/session?projectId=${encodeURIComponent(input.projectId)}`,
    { headers: { "x-veskify-p9-05b-session": input.sessionId } },
  );
  const body: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !body ||
    typeof body !== "object" ||
    !("ok" in body) ||
    body.ok !== true ||
    !("session" in body) ||
    !body.session ||
    typeof body.session !== "object" ||
    !("authoritativeRevision" in body.session) ||
    typeof body.session.authoritativeRevision !== "number" ||
    !("aggregate" in body.session)
  ) {
    throw new P905bLocalDemoSavedAggregateClientError();
  }
  const aggregate = parseSavedAggregate(body.session.aggregate);
  if (!aggregate) throw new P905bLocalDemoSavedAggregateClientError();
  return { aggregate, authoritativeRevision: body.session.authoritativeRevision };
}

export async function loadP905bLocalDemoPublishedProjection(input: {
  projectId: string;
  sessionId: string;
}): Promise<ProjectAggregate> {
  const response = await fetch(
    `/api/demo/p9-05b/published?projectId=${encodeURIComponent(input.projectId)}`,
    { headers: { "x-veskify-p9-05b-session": input.sessionId } },
  );
  const body: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !body ||
    typeof body !== "object" ||
    !("ok" in body) ||
    body.ok !== true ||
    !("projection" in body) ||
    !body.projection ||
    typeof body.projection !== "object"
  ) {
    throw new P905bLocalDemoSavedAggregateClientError();
  }
  const projection = body.projection;
  const project = "project" in projection ? projectSchema.safeParse(projection.project) : null;
  const catalogue =
    "catalogue" in projection ? catalogueDisplayModelSchema.safeParse(projection.catalogue) : null;
  const publishedSnapshot =
    "publishedSnapshot" in projection
      ? storefrontSnapshotSchema.safeParse(projection.publishedSnapshot)
      : null;
  if (!project?.success || !catalogue?.success || !publishedSnapshot?.success) {
    throw new P905bLocalDemoSavedAggregateClientError();
  }
  return { project: project.data, catalogue: catalogue.data, snapshots: [publishedSnapshot.data] };
}
