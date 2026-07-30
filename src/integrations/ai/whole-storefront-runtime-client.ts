"use client";

import {
  aiStorefrontProviderResponseSchema,
  recordStorefrontDiagnostic,
  type AiStorefrontProviderRequest,
  type StorefrontAIProvider,
} from "@/application/ai-storefront-generation";

const failureSchema = {
  safeParse(value: unknown) {
    if (
      value &&
      typeof value === "object" &&
      "ok" in value &&
      value.ok === false &&
      "failure" in value &&
      value.failure &&
      typeof value.failure === "object" &&
      "category" in value.failure &&
      typeof value.failure.category === "string" &&
      "retryable" in value.failure &&
      typeof value.failure.retryable === "boolean"
    ) {
      return { success: true as const, data: value.failure };
    }
    return { success: false as const };
  },
};

export type ServerWholeStorefrontFailureCategory =
  | "validation"
  | "stale"
  | "permissionDenied"
  | "projectMismatch"
  | "tenantMismatch"
  | "providerUnavailable"
  | "malformedResponse"
  | "internalFailure";

export class ServerWholeStorefrontPlanningClientError extends Error {
  constructor(
    readonly category: ServerWholeStorefrontFailureCategory,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super("The storefront planning request could not be completed.");
    this.name = "ServerWholeStorefrontPlanningClientError";
  }
}

export class ServerWholeStorefrontPlanningClient implements StorefrontAIProvider {
  readonly id = "server-whole-storefront-planning";
  readonly assetReferenceCapability = "structuredApprovedAssets" as const;
  readonly generationCapabilities = [
    "approvedColorTypographyDirection",
    "registeredWholeStorefrontDirection",
  ] as const;
  readonly #p905bSessionId?: string;

  constructor({ p905bSessionId }: { p905bSessionId?: string } = {}) {
    this.#p905bSessionId = p905bSessionId;
  }

  async proposeStorefront(request: AiStorefrontProviderRequest): Promise<unknown> {
    const diagnostic = (
      stage: Parameters<typeof recordStorefrontDiagnostic>[0]["stage"],
      category: Parameters<typeof recordStorefrontDiagnostic>[0]["category"],
      status?: number,
    ) =>
      recordStorefrontDiagnostic({
        attemptId: request.requestId,
        projectId: request.target.projectId,
        scope: "storefront",
        stage,
        category,
        ...(status === undefined ? {} : { status }),
      });
    diagnostic("request_started", "success");
    let response: Response;
    try {
      response = await fetch("/api/ai/whole-storefront-proposals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.#p905bSessionId === undefined
            ? {}
            : { "x-veskify-p9-05b-session": this.#p905bSessionId }),
        },
        body: JSON.stringify(request),
      });
    } catch {
      diagnostic("request_started", "client_request");
      throw new ServerWholeStorefrontPlanningClientError("internalFailure", true, 0);
    }
    diagnostic("response_received", "success", response.status);
    diagnostic("response_decoding_started", "success", response.status);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      diagnostic("response_decoding_started", "client_response_decode", response.status);
      throw new ServerWholeStorefrontPlanningClientError(
        "malformedResponse",
        false,
        response.status,
      );
    }
    diagnostic("response_decoding_completed", "success", response.status);
    const parsed = aiStorefrontProviderResponseSchema.safeParse(
      body && typeof body === "object" && "ok" in body && body.ok === true
        ? (body as unknown as { proposal: unknown }).proposal
        : null,
    );
    if (!response.ok) {
      const failure = failureSchema.safeParse(body);
      if (failure.success) {
        const category = failure.data.category as ServerWholeStorefrontFailureCategory;
        diagnostic("response_decoding_completed", category, response.status);
        throw new ServerWholeStorefrontPlanningClientError(
          category,
          failure.data.retryable === true,
          response.status,
        );
      }
      diagnostic("response_decoding_completed", "malformedResponse", response.status);
      throw new ServerWholeStorefrontPlanningClientError(
        "malformedResponse",
        false,
        response.status,
      );
    }
    if (!parsed.success) {
      diagnostic("response_decoding_completed", "malformedResponse", response.status);
      throw new ServerWholeStorefrontPlanningClientError(
        "malformedResponse",
        false,
        response.status,
      );
    }
    return parsed.data;
  }
}

export function createServerWholeStorefrontPlanningClient(options?: { p905bSessionId?: string }) {
  return new ServerWholeStorefrontPlanningClient(options);
}
