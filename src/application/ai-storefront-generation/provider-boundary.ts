import {
  createAiStorefrontProposalId,
  validateAiStorefrontProposal,
  type AiStorefrontContext,
} from "@/application/ai-storefront";
import { assertNoExecutableContent } from "@/application/design-skills";
import { canonicalValueString } from "@/domain/storefront";
import {
  aiStorefrontProviderRequestSchema,
  aiStorefrontProviderResponseSchema,
  type AiStorefrontProviderRequest,
  type AiStorefrontProviderResponse,
  type StorefrontAIProvider,
} from "./contract";

export class AiStorefrontProviderValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AiStorefrontProviderValidationError";
  }
}

export class AiStorefrontProviderUnavailableError extends Error {
  constructor(
    message = "The storefront design assistant is temporarily unavailable. Please try again.",
  ) {
    super(message);
    this.name = "AiStorefrontProviderUnavailableError";
  }
}

function invalid(code: string, message: string): never {
  throw new AiStorefrontProviderValidationError(code, message);
}

function contextFromRequest(request: AiStorefrontProviderRequest): AiStorefrontContext {
  return {
    projectId: request.target.projectId,
    draftSnapshotId: request.target.draftSnapshotId,
    draftRevision: request.target.draftRevision,
    enabledLocales: request.enabledLocales,
    activeLocale: request.activeLocale,
    storefront: structuredClone(request.storefront),
  };
}

function assertExactPaletteResponse(
  request: AiStorefrontProviderRequest,
  response: AiStorefrontProviderResponse,
) {
  if (request.brandPalettePlan === null) return;
  const paletteOperations = response.proposal.operations.filter(
    ({ operation }) => operation.type === "APPLY_APPROVED_BRAND_COLOURS",
  );
  if (
    response.proposal.operations.length !== 1 ||
    paletteOperations.length !== 1 ||
    paletteOperations[0].operation.type !== "APPLY_APPROVED_BRAND_COLOURS" ||
    canonicalValueString(paletteOperations[0].operation.colors) !==
      canonicalValueString(request.brandPalettePlan.colors)
  ) {
    invalid(
      "brand-palette-mismatch",
      "The provider proposal does not match the validated merchant brand palette.",
    );
  }
}

function appendPaletteWarnings(
  request: AiStorefrontProviderRequest,
  response: AiStorefrontProviderResponse,
): AiStorefrontProviderResponse {
  if (request.brandPalettePlan === null || request.brandPalettePlan.warnings.length === 0) {
    return response;
  }
  const summary = structuredClone(response.proposal.summary);
  for (const warning of request.brandPalettePlan.warnings) {
    for (const locale of ["en", "fi"] as const) {
      const message = warning[locale];
      if (!message || summary[locale]?.includes(message)) continue;
      summary[locale] = [summary[locale], message].filter(Boolean).join(" ");
    }
  }
  return { ...response, proposal: { ...response.proposal, summary } };
}

export function validateAiStorefrontProviderResponse(
  requestInput: unknown,
  responseInput: unknown,
) {
  const requestResult = aiStorefrontProviderRequestSchema.safeParse(requestInput);
  if (!requestResult.success) {
    invalid("invalid-request", "The storefront provider request is incomplete or invalid.");
  }
  const request = requestResult.data;
  const responseResult = aiStorefrontProviderResponseSchema.safeParse(responseInput);
  if (!responseResult.success) {
    invalid(
      "invalid-provider-response",
      "The storefront design assistant returned an invalid proposal.",
    );
  }
  const response: AiStorefrontProviderResponse = responseResult.data;
  if (
    response.providerId !== request.providerId ||
    response.providerRequestId !== request.requestId ||
    response.proposal.requestId !== request.requestId
  ) {
    invalid(
      "provider-identity-mismatch",
      "The provider response does not match the active storefront request.",
    );
  }
  assertExactPaletteResponse(request, response);
  if (
    response.metadata.validation !== "valid" ||
    response.metadata.operationCount !== response.proposal.operations.length
  ) {
    invalid(
      "failed-provider-validation",
      "The provider did not return a successfully validated storefront proposal.",
    );
  }
  if (response.proposal.status !== "pending") {
    invalid("invalid-proposal-status", "Generated storefront proposals must begin as pending.");
  }
  if (
    canonicalValueString(response.proposal.target) !== canonicalValueString(request.target) ||
    canonicalValueString(response.proposal.permissionGrants) !==
      canonicalValueString(request.permissionGrants) ||
    response.proposal.targetFingerprint !== request.targetFingerprint ||
    response.proposal.permissionFingerprint !== request.permissionFingerprint
  ) {
    invalid(
      "request-integrity-mismatch",
      "The provider proposal target or permissions do not match the canonical request.",
    );
  }
  const expectedProposalId = createAiStorefrontProposalId(
    request.requestId,
    request.targetFingerprint,
    request.permissionFingerprint,
    response.proposal.operations,
    response.proposal.assetPlacementOperations ?? [],
  );
  if (response.proposal.id !== expectedProposalId) {
    invalid("proposal-identity-mismatch", "The storefront proposal identity is invalid.");
  }
  const requestPlacements = new Map(
    request.assetPlacementOperations.map((operation) => [
      canonicalValueString(operation),
      operation,
    ]),
  );
  const proposalPlacements = response.proposal.assetPlacementOperations ?? [];
  if (
    proposalPlacements.some(
      (operation) => !requestPlacements.has(canonicalValueString(operation)),
    ) ||
    request.assetPlacementOperations
      .filter((operation) => operation.required)
      .some(
        (operation) =>
          !proposalPlacements.some(
            (candidate) => canonicalValueString(candidate) === canonicalValueString(operation),
          ),
      )
  ) {
    invalid(
      "asset-placement-mismatch",
      "The provider proposal did not preserve the required approved source-asset placements.",
    );
  }
  for (const envelope of response.proposal.operations) {
    if (
      envelope.operation.type === "CHANGE_LOCALIZED_SECTION_TEXT" &&
      !request.enabledLocales.includes(envelope.operation.locale)
    ) {
      invalid(
        "locale-not-enabled",
        "The proposal generated text for a locale that is not enabled.",
      );
    }
  }
  try {
    assertNoExecutableContent({
      operations: response.proposal.operations,
      summary: response.proposal.summary,
    });
  } catch {
    invalid(
      "unsafe-content",
      "The storefront proposal contains executable, markup, or style-injection content.",
    );
  }
  try {
    return appendPaletteWarnings(request, {
      ...response,
      proposal: validateAiStorefrontProposal(response.proposal, contextFromRequest(request)),
    });
  } catch {
    return invalid(
      "invalid-storefront-proposal",
      "The storefront proposal could not be validated against the canonical target.",
    );
  }
}

export async function requestAiStorefrontProposal(
  provider: StorefrontAIProvider,
  request: AiStorefrontProviderRequest,
) {
  try {
    const response = await provider.proposeStorefront(request);
    return validateAiStorefrontProviderResponse(request, response);
  } catch (error) {
    if (error instanceof AiStorefrontProviderValidationError) throw error;
    throw new AiStorefrontProviderUnavailableError();
  }
}
