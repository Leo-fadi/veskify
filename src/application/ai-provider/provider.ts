import { applyDesignOperations } from "@/application/design-operations";
import { InMemoryDesignProposalStore } from "@/application/design-operations";
import {
  assertNoExecutableContent,
  createDeterministicDesignProvider,
  type DesignPlannerInput,
} from "@/application/design-skills";
import { getComponentDefinition } from "@/components/registry";
import {
  aiOperationRequestSchema,
  aiProviderResponseSchema,
  type AIProvider,
  type AiOperationRequest,
  type AiProviderResponse,
  type AiProviderRequestOptions,
} from "./contract";

export const aiProviderFailureCategories = [
  "missingApiKey",
  "authenticationFailed",
  "rateLimited",
  "timeout",
  "cancelled",
  "networkFailure",
  "malformedResponse",
  "validationRejected",
  "providerRefusal",
  "unavailableModel",
  "unexpectedProviderFailure",
] as const;

export type AiProviderFailureCategory = (typeof aiProviderFailureCategories)[number];

export class AiProviderValidationError extends Error {
  readonly category = "validationRejected" as const;

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
    readonly category: AiProviderFailureCategory = "unexpectedProviderFailure",
  ) {
    super(message);
    this.name = "AiProviderUnavailableError";
  }
}

export async function requestAiProposal(
  provider: AIProvider,
  request: AiOperationRequest,
  options?: AiProviderRequestOptions,
) {
  try {
    const response = await provider.proposeChange(request, options);
    return { ok: true as const, proposal: validateAiProviderResponse(request, response) };
  } catch (error) {
    if (error instanceof AiProviderValidationError || error instanceof AiProviderUnavailableError) {
      throw error;
    }
    throw new AiProviderUnavailableError();
  }
}

function assertScope(request: AiOperationRequest, response: AiProviderResponse) {
  const pageSectionIds = new Set(request.page.sections.map((section) => section.id));
  const introducedSectionIds = new Set(
    response.operations
      .filter((operation) => operation.type === "ADD_APPROVED_SECTION")
      .map((operation) => operation.sectionId),
  );
  for (const operation of response.operations) {
    if (request.scope === "section") {
      if (!("sectionId" in operation) || operation.sectionId !== request.target.sectionId) {
        throw new AiProviderValidationError(
          "out-of-scope",
          "The proposal changes content outside the selected section.",
        );
      }
    } else if (
      request.scope === "page" &&
      "sectionId" in operation &&
      operation.type !== "ADD_APPROVED_SECTION" &&
      !pageSectionIds.has(operation.sectionId) &&
      !introducedSectionIds.has(operation.sectionId)
    ) {
      throw new AiProviderValidationError(
        "out-of-scope",
        "The proposal references a section outside the selected page.",
      );
    }
    if (
      (operation.type === "APPLY_APPROVED_BRAND_COLOURS" ||
        operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY" ||
        operation.type === "APPLY_REGISTERED_BRAND_SYSTEM") &&
      request.scope !== "brand"
    ) {
      throw new AiProviderValidationError(
        "out-of-scope",
        "Brand changes are outside the selected target.",
      );
    }
  }
}

function assertOperationPermissions(request: AiOperationRequest, response: AiProviderResponse) {
  const existingComponents = new Map(
    request.page.sections.map((section) => [section.id, section.component]),
  );
  const introducedComponents = new Map(
    response.operations
      .filter((operation) => operation.type === "ADD_APPROVED_SECTION")
      .map((operation) => [operation.sectionId, operation.component]),
  );
  for (const operation of response.operations) {
    if (!request.allowedOperationTypes.includes(operation.type)) {
      throw new AiProviderValidationError(
        "operation-not-allowed",
        "The proposal contains a change that is not permitted for this request.",
      );
    }
    if (operation.type === "ADD_APPROVED_SECTION") {
      if (!request.allowedComponentTypes.includes(operation.component)) {
        throw new AiProviderValidationError(
          "component-not-allowed",
          "The proposal introduces a component that is not permitted for this request.",
        );
      }
      try {
        getComponentDefinition(operation.component);
      } catch {
        throw new AiProviderValidationError(
          "unknown-component",
          "The proposal introduces an unknown storefront component.",
        );
      }
    }
    const target =
      operation.type === "ADD_APPROVED_SECTION"
        ? {
            kind: "introducedSection" as const,
            pageId: request.page.id,
            sectionId: operation.sectionId,
            componentType: operation.component,
          }
        : "sectionId" in operation
          ? existingComponents.has(operation.sectionId)
            ? {
                kind: "existingSection" as const,
                pageId: request.page.id,
                sectionId: operation.sectionId,
                componentType: existingComponents.get(operation.sectionId)!,
              }
            : introducedComponents.has(operation.sectionId)
              ? {
                  kind: "introducedSection" as const,
                  pageId: request.page.id,
                  sectionId: operation.sectionId,
                  componentType: introducedComponents.get(operation.sectionId)!,
                }
              : null
          : { kind: "page" as const, pageId: request.page.id };
    const granted =
      target !== null &&
      request.permissionGrants.some(
        (grant) =>
          grant.target.kind !== "storefrontDesignSystem" &&
          grant.operationTypes.includes(operation.type) &&
          grant.target.kind === target.kind &&
          grant.target.pageId === target.pageId &&
          (grant.target.kind === "page" ||
            (target.kind !== "page" &&
              grant.target.sectionId === target.sectionId &&
              grant.target.componentType === target.componentType)),
      );
    if (!granted) {
      throw new AiProviderValidationError(
        "permission-grant-mismatch",
        "The proposal contains a change outside the approved skill target.",
      );
    }
  }
}

function assertLocalePermissions(request: AiOperationRequest, response: AiProviderResponse) {
  for (const operation of response.operations) {
    if (
      operation.type === "CHANGE_LOCALIZED_SECTION_TEXT" &&
      !request.locales.includes(operation.locale)
    ) {
      throw new AiProviderValidationError(
        "locale-not-enabled",
        "The proposal changes content in a language that is not enabled for this storefront.",
      );
    }
  }
}

function assertSafeContent(response: AiProviderResponse) {
  try {
    assertNoExecutableContent(response.operations);
  } catch {
    throw new AiProviderValidationError(
      "unsafe-content",
      "The proposal contains executable or code-shaped content.",
    );
  }
}

export function validateAiProviderResponse(requestInput: unknown, responseInput: unknown) {
  let request: AiOperationRequest;
  try {
    request = aiOperationRequestSchema.parse(requestInput);
  } catch {
    throw new AiProviderValidationError(
      "invalid-request",
      "The storefront change request is incomplete or no longer current.",
    );
  }
  if (request.page.id !== request.target.pageId) {
    throw new AiProviderValidationError(
      "target-page-mismatch",
      "The selected page no longer matches the current storefront page.",
    );
  }
  let response: AiProviderResponse;
  try {
    response = aiProviderResponseSchema.parse(responseInput);
  } catch {
    throw new AiProviderValidationError(
      "invalid-provider-response",
      "The design assistant returned an invalid proposal. Please try again.",
    );
  }
  if (
    response.metadata.validation !== "valid" ||
    response.metadata.operationCount !== response.operations.length
  ) {
    throw new AiProviderValidationError(
      "invalid-provider-response",
      "The design assistant could not produce a valid proposal. Please try again.",
    );
  }
  assertOperationPermissions(request, response);
  assertLocalePermissions(request, response);
  assertSafeContent(response);
  assertScope(request, response);
  let proposedPage;
  try {
    proposedPage = applyDesignOperations(request.page, response.operations, request.displayContext);
  } catch {
    throw new AiProviderValidationError(
      "invalid-operations",
      "The proposed storefront changes could not be safely validated.",
    );
  }
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
