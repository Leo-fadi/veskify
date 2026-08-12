"use client";

import {
  AiStorefrontProviderServerError,
  aiStorefrontProviderResponseSchema,
  isAiStorefrontProviderServerFailureCategory,
  recordStorefrontDiagnostic,
  type AiStorefrontProviderServerFailureCategory,
  type AiStorefrontProviderRequest,
  type StorefrontAIProvider,
} from "@/application/ai-storefront-generation";
import {
  pageFactEvidenceReferenceSchema,
  type PageFactEvidenceReference,
} from "@/domain/storefront";
import {
  promptedStorefrontStudioGenerationResponseSchema,
  type PromptedStorefrontStudioGenerationFailureCategory,
  type PromptedStorefrontStudioGenerationRequest,
  type PromptedStorefrontStudioGenerationSuccess,
} from "@/application/prompted-storefront-studio";
import { promptedStorefrontPromptFingerprint } from "@/application/prompted-storefront-design-intent";
import { z } from "zod";

const successSchema = z
  .object({
    ok: z.literal(true),
    proposal: z.unknown(),
    currentEvidenceReferences: z.array(pageFactEvidenceReferenceSchema).default([]),
  })
  .strict();

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

export type ServerWholeStorefrontFailureCategory = AiStorefrontProviderServerFailureCategory;

export class ServerWholeStorefrontPlanningClientError extends AiStorefrontProviderServerError {
  constructor(
    readonly category: ServerWholeStorefrontFailureCategory,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(category, retryable, status);
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
  readonly #evidenceReferencesByProposalId = new Map<string, PageFactEvidenceReference[]>();

  constructor({ p905bSessionId }: { p905bSessionId?: string } = {}) {
    this.#p905bSessionId = p905bSessionId;
  }

  currentEvidenceReferencesForProposal(proposalId: string): PageFactEvidenceReference[] {
    const references = structuredClone(this.#evidenceReferencesByProposalId.get(proposalId) ?? []);
    this.#evidenceReferencesByProposalId.delete(proposalId);
    return references;
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
        scope: request.target.scope,
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
      throw new ServerWholeStorefrontPlanningClientError("providerUnavailable", true, 0);
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
    const success = successSchema.safeParse(body);
    const parsed = aiStorefrontProviderResponseSchema.safeParse(
      success.success ? success.data.proposal : null,
    );
    if (!response.ok) {
      const failure = failureSchema.safeParse(body);
      if (failure.success) {
        if (!isAiStorefrontProviderServerFailureCategory(failure.data.category)) {
          diagnostic("response_decoding_completed", "malformedResponse", response.status);
          throw new ServerWholeStorefrontPlanningClientError(
            "malformedResponse",
            false,
            response.status,
          );
        }
        const category = failure.data.category;
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
    this.#evidenceReferencesByProposalId.set(
      parsed.data.proposal.id,
      structuredClone(success.success ? success.data.currentEvidenceReferences : []),
    );
    return parsed.data;
  }
}

export function createServerWholeStorefrontPlanningClient(options?: { p905bSessionId?: string }) {
  return new ServerWholeStorefrontPlanningClient(options);
}

export type PromptedStorefrontRuntimeStage =
  "requesting-design-intent" | "validating-intent" | "compiling-design" | "materializing-proposal";

export type PromptedStorefrontRuntimeClientOptions = Readonly<{
  signal?: AbortSignal;
  onStage?: (stage: PromptedStorefrontRuntimeStage) => void;
}>;

export interface PromptedStorefrontStudioClient {
  generateStorefront(
    request: PromptedStorefrontStudioGenerationRequest,
    options?: PromptedStorefrontRuntimeClientOptions,
  ): Promise<PromptedStorefrontStudioGenerationSuccess>;
}

export class PromptedStorefrontStudioClientError extends Error {
  constructor(
    readonly category: PromptedStorefrontStudioGenerationFailureCategory,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(category);
    this.name = "PromptedStorefrontStudioClientError";
  }
}

export class PromptedStorefrontStudioClientAbortedError extends Error {
  constructor() {
    super("The prompted storefront request was aborted.");
    this.name = "PromptedStorefrontStudioClientAbortedError";
  }
}

export class ServerPromptedStorefrontStudioClient implements PromptedStorefrontStudioClient {
  async generateStorefront(
    request: PromptedStorefrontStudioGenerationRequest,
    options: PromptedStorefrontRuntimeClientOptions = {},
  ): Promise<PromptedStorefrontStudioGenerationSuccess> {
    options.onStage?.("requesting-design-intent");
    let response: Response;
    try {
      response = await fetch("/api/ai/whole-storefront-proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (error) {
      if (
        options.signal?.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        throw new PromptedStorefrontStudioClientAbortedError();
      }
      throw new PromptedStorefrontStudioClientError("providerUnavailable", false, 0);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new PromptedStorefrontStudioClientError("malformedResponse", false, response.status);
    }
    const parsed = promptedStorefrontStudioGenerationResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new PromptedStorefrontStudioClientError("malformedResponse", false, response.status);
    }
    if (!response.ok || !parsed.data.ok) {
      const failure = parsed.data.ok
        ? { category: "internalFailure" as const, retryable: false }
        : parsed.data.failure;
      throw new PromptedStorefrontStudioClientError(
        failure.category,
        failure.retryable,
        response.status,
      );
    }
    if (
      parsed.data.lineage.promptFingerprint !==
      promptedStorefrontPromptFingerprint(request.merchantPrompt)
    ) {
      throw new PromptedStorefrontStudioClientError("malformedResponse", false, response.status);
    }

    // These stages are reported only after the complete strict response and its safe lineage
    // have passed schema validation. No raw provider internals cross the browser boundary.
    options.onStage?.("validating-intent");
    options.onStage?.("compiling-design");
    options.onStage?.("materializing-proposal");
    return parsed.data;
  }
}

export function createServerPromptedStorefrontStudioClient() {
  return new ServerPromptedStorefrontStudioClient();
}
