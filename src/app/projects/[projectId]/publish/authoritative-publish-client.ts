"use client";

import { publishPreparationSchema, type PublishPreparation } from "@/application/publishing";

export type MerchantPublishRequestAuthority =
  Readonly<{ kind: "manual" }> | Readonly<{ kind: "accepted-ai"; receiptId: string }>;

export type MerchantPublishGatewayClient = Readonly<{
  prepare(input: {
    projectId: string;
    requestId: string;
    authority: MerchantPublishRequestAuthority;
  }): Promise<PublishPreparation>;
  confirm(input: {
    projectId: string;
    requestId: string;
    preparationId: string;
  }): Promise<{ projectRevision: number }>;
}>;

export class AuthoritativeMerchantPublishClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super("The storefront publication request was not accepted by the server.");
    this.name = "AuthoritativeMerchantPublishClientError";
  }
}

function failureCode(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "failure" in body &&
    body.failure &&
    typeof body.failure === "object" &&
    "code" in body.failure &&
    typeof body.failure.code === "string"
  ) {
    return body.failure.code;
  }
  return "publishing-unavailable";
}

async function request(input: { body: unknown; sessionId?: string }): Promise<unknown> {
  const response = await fetch("/api/storefront-publish", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(input.sessionId ? { "x-veskify-p9-05b-session": input.sessionId } : {}),
    },
    body: JSON.stringify(input.body),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AuthoritativeMerchantPublishClientError(failureCode(body), response.status);
  }
  return body;
}

export function createAuthoritativeMerchantPublishClient(
  options: {
    sessionId?: string;
  } = {},
): MerchantPublishGatewayClient {
  return {
    async prepare(input) {
      const body = await request({
        sessionId: options.sessionId,
        body: { action: "prepare", request: input },
      });
      if (!body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        throw new AuthoritativeMerchantPublishClientError("invalid-response", 502);
      }
      const preparation =
        "preparation" in body ? publishPreparationSchema.safeParse(body.preparation) : null;
      if (!preparation?.success) {
        throw new AuthoritativeMerchantPublishClientError("invalid-response", 502);
      }
      return preparation.data;
    },
    async confirm(input) {
      const body = await request({
        sessionId: options.sessionId,
        body: { action: "confirm", request: input },
      });
      if (
        !body ||
        typeof body !== "object" ||
        !("ok" in body) ||
        body.ok !== true ||
        !("publication" in body) ||
        !body.publication ||
        typeof body.publication !== "object" ||
        !("projectRevision" in body.publication) ||
        typeof body.publication.projectRevision !== "number"
      ) {
        throw new AuthoritativeMerchantPublishClientError("invalid-response", 502);
      }
      return { projectRevision: body.publication.projectRevision };
    },
  };
}
