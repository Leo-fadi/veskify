"use client";

import { z } from "zod";
import { storefrontSnapshotSchema } from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage";

const synchronizationResultSchema = z
  .object({
    authoritativeRevision: z.number().int().nonnegative(),
    aggregateFingerprint: z.string().trim().min(1),
  })
  .strict();

const successSchema = z
  .object({
    ok: z.literal(true),
    synchronization: synchronizationResultSchema,
  })
  .strict();

const failureSchema = z
  .object({
    ok: z.literal(false),
    failure: z
      .object({
        category: z.enum([
          "permissionDenied",
          "stale",
          "validation",
          "protectedCommerce",
          "providerUnavailable",
        ]),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type P10bLiveSynthesisAcceptanceClientFailure = z.infer<
  typeof failureSchema
>["failure"]["category"];

export class P10bLiveSynthesisAcceptanceClientError extends Error {
  constructor(
    readonly category: P10bLiveSynthesisAcceptanceClientFailure,
    readonly status: number,
  ) {
    super("The local P10B synthesis acceptance session changed or became unavailable.");
    this.name = "P10bLiveSynthesisAcceptanceClientError";
  }
}

async function post(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const decoded: unknown = await response.json().catch(() => null);
  const success = successSchema.safeParse(decoded);
  if (response.ok && success.success) return success.data.synchronization;
  const failure = failureSchema.safeParse(decoded);
  throw new P10bLiveSynthesisAcceptanceClientError(
    failure.success ? failure.data.failure.category : "providerUnavailable",
    response.status,
  );
}

export function acceptP10bLiveSynthesisProposal(input: {
  projectId: string;
  sessionId: string;
  proposalId: string;
  expectedRevision: number;
  acceptedSnapshot: unknown;
}) {
  return post("/api/demo/p10b-live/accept", {
    ...input,
    acceptedSnapshot: storefrontSnapshotSchema.parse(structuredClone(input.acceptedSnapshot)),
  });
}

export function rejectP10bLiveSynthesisProposal(input: {
  projectId: string;
  sessionId: string;
  proposalId: string;
  expectedRevision: number;
}) {
  return post("/api/demo/p10b-live/reject", input);
}

export function synchronizeP10bLiveSynthesisAggregate(input: {
  projectId: string;
  sessionId: string;
  expectedRevision: number;
  mode: "active" | "saved";
  aggregate: ProjectAggregate;
}) {
  return post("/api/demo/p10b-live/synchronize", {
    ...input,
    aggregate: structuredClone(input.aggregate),
  });
}
