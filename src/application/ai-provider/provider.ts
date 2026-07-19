import { applyDesignOperations } from "@/application/design-operations";
import { InMemoryDesignProposalStore } from "@/application/design-operations";
import {
  createDeterministicDesignProvider,
  type DesignPlannerInput,
} from "@/application/design-skills";
import {
  aiOperationRequestSchema,
  aiProviderResponseSchema,
  type AIProvider,
  type AiOperationRequest,
  type AiProviderResponse,
} from "./contract";

const markupPattern = /<\/?[a-z][^>]*>|javascript:|<script\b/i;

export class AiProviderValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AiProviderValidationError";
  }
}

export class AiProviderUnavailableError extends Error {
  constructor(
    message = "The design assistant is temporarily unavailable. Please try again or continue editing manually.",
  ) {
    super(message);
    this.name = "AiProviderUnavailableError";
  }
}

export async function requestAiProposal(provider: AIProvider, request: AiOperationRequest) {
  try {
    const response = await provider.proposeChange(request);
    return { ok: true as const, proposal: validateAiProviderResponse(request, response) };
  } catch (error) {
    if (error instanceof AiProviderValidationError) throw error;
    throw new AiProviderUnavailableError();
  }
}

function assertScope(request: AiOperationRequest, response: AiProviderResponse) {
  for (const operation of response.operations) {
    if ("sectionId" in operation && operation.sectionId !== request.target.sectionId) {
      throw new AiProviderValidationError(
        "out-of-scope",
        "The proposal changes a section outside the selected target.",
      );
    }
    if (operation.type === "APPLY_APPROVED_BRAND_COLOURS" && request.scope !== "brand") {
      throw new AiProviderValidationError(
        "out-of-scope",
        "Brand changes are outside the selected target.",
      );
    }
    if (
      "value" in operation &&
      typeof operation.value === "string" &&
      markupPattern.test(operation.value)
    ) {
      throw new AiProviderValidationError(
        "unsafe-content",
        "The proposal contains executable or arbitrary markup.",
      );
    }
  }
}

export function validateAiProviderResponse(requestInput: unknown, responseInput: unknown) {
  const request = aiOperationRequestSchema.parse(requestInput);
  const response = aiProviderResponseSchema.parse(responseInput);
  assertScope(request, response);
  const proposedPage = applyDesignOperations(
    request.page,
    response.operations,
    request.displayContext,
  );
  return { ...response, proposedPage };
}

export class DeterministicMockAIProvider implements AIProvider {
  readonly #provider = createDeterministicDesignProvider();

  proposeChange(requestInput: AiOperationRequest): Promise<AiProviderResponse> {
    const request = aiOperationRequestSchema.parse(requestInput);
    const started = Date.now();
    const result = this.#provider.propose(
      {
        merchantRequest: request.instruction,
        activeLocale: request.locale,
        page: request.page,
        pageType: request.page.type,
        brandSystem: request.brandSystem,
        displayContext: request.displayContext,
        selectedSectionId: request.target.sectionId,
      } satisfies DesignPlannerInput,
      new InMemoryDesignProposalStore(),
    );
    const operations = result.execution.validation.valid ? result.execution.operations : [];
    return Promise.resolve(
      aiProviderResponseSchema.parse({
        providerRequestId: `mock_${stableRequestId(request)}`,
        providerId: "deterministic-mock",
        operations,
        diagnostics: result.execution.validation.errors.map((message) => ({
          code: "validation",
          severity: "error",
          message,
        })),
        explanation: result.execution.summary,
        metadata: {
          operationCount: operations.length,
          durationMs: Date.now() - started,
          validation: result.execution.validation.valid ? "valid" : "invalid",
        },
      }),
    );
  }
}

function stableRequestId(request: AiOperationRequest) {
  const value = JSON.stringify({
    projectId: request.projectId,
    draftSnapshotId: request.draftSnapshotId,
    draftRevision: request.draftRevision,
    target: request.target,
    instruction: request.instruction
      .normalize("NFC")
      .trim()
      .toLocaleLowerCase()
      .replace(/[.!?]+$/g, "")
      .replace(/\s+/g, " "),
    locale: request.locale,
  });
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createDeterministicMockAIProvider() {
  return new DeterministicMockAIProvider();
}
