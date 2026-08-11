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

export class AiStorefrontProviderStaleError extends Error {
  constructor() {
    super("The storefront changed while the proposal was being prepared.");
    this.name = "AiStorefrontProviderStaleError";
  }
}

export type AiStorefrontProviderServerFailureCategory =
  | "validation"
  | "stale"
  | "permissionDenied"
  | "authenticationUnavailable"
  | "projectMismatch"
  | "tenantMismatch"
  | "providerUnavailable"
  | "malformedResponse"
  | "internalFailure";

const serverFailureCategories = new Set<string>([
  "validation",
  "stale",
  "permissionDenied",
  "authenticationUnavailable",
  "projectMismatch",
  "tenantMismatch",
  "providerUnavailable",
  "malformedResponse",
  "internalFailure",
]);

export function isAiStorefrontProviderServerFailureCategory(
  value: unknown,
): value is AiStorefrontProviderServerFailureCategory {
  return typeof value === "string" && serverFailureCategories.has(value);
}

const serverFailureMessages: Record<AiStorefrontProviderServerFailureCategory, string> = {
  validation: "The storefront request is invalid.",
  stale: "The storefront changed while the proposal was being prepared.",
  permissionDenied: "You do not have permission to complete this storefront action.",
  authenticationUnavailable: "Your Storefront Studio access is temporarily unavailable.",
  projectMismatch: "This storefront request does not match the active project.",
  tenantMismatch: "This storefront request belongs to a different merchant account.",
  providerUnavailable:
    "The storefront design assistant is temporarily unavailable. Please try again.",
  malformedResponse: "The storefront request returned an invalid response.",
  internalFailure: "The storefront request could not be completed. The draft remains unchanged.",
};

/** Preserves the safe server failure contract across the browser provider boundary. */
export class AiStorefrontProviderServerError extends Error {
  constructor(
    readonly category: AiStorefrontProviderServerFailureCategory,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(serverFailureMessages[category]);
    this.name = "AiStorefrontProviderServerError";
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

function assertRegisteredTokenRefinementResponse(
  request: AiStorefrontProviderRequest,
  response: AiStorefrontProviderResponse,
) {
  if (request.tokenRefinementPlan === null) return;
  if (request.capability === "approvedColorTypographyDirection") {
    const expectedOperationCount =
      Number(request.tokenRefinementPlan.palette !== null) +
      Number(request.tokenRefinementPlan.typography !== null);
    const paletteOperations = response.proposal.operations.filter(
      ({ operation }) => operation.type === "APPLY_APPROVED_BRAND_COLOURS",
    );
    const typographyOperations = response.proposal.operations.filter(
      ({ operation }) => operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY",
    );
    const paletteMatches =
      request.tokenRefinementPlan.palette === null
        ? paletteOperations.length === 0
        : paletteOperations.length === 1 &&
          paletteOperations[0].operation.type === "APPLY_APPROVED_BRAND_COLOURS" &&
          canonicalValueString(paletteOperations[0].operation.colors) ===
            canonicalValueString(request.tokenRefinementPlan.palette.colors);
    const typographyMatches =
      request.tokenRefinementPlan.typography === null
        ? typographyOperations.length === 0
        : typographyOperations.length === 1 &&
          typographyOperations[0].operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY" &&
          canonicalValueString(typographyOperations[0].operation.typography) ===
            canonicalValueString(request.tokenRefinementPlan.typography);
    if (
      response.proposal.operations.length !== expectedOperationCount ||
      !paletteMatches ||
      !typographyMatches
    ) {
      invalid(
        "token-refinement-mismatch",
        "The provider proposal does not match the validated storefront colour and typography refinement.",
      );
    }
    return;
  }
  const operations = response.proposal.operations.filter(
    ({ operation }) => operation.type === "APPLY_REGISTERED_BRAND_SYSTEM",
  );
  if (
    response.proposal.operations.length !== 1 ||
    operations.length !== 1 ||
    operations[0].operation.type !== "APPLY_REGISTERED_BRAND_SYSTEM" ||
    operations[0].operation.refinementId !== "validatedTokenRefinement" ||
    canonicalValueString(operations[0].operation.tokenRefinementPlan) !==
      canonicalValueString(request.tokenRefinementPlan)
  ) {
    invalid(
      "token-refinement-mismatch",
      "The provider proposal does not match the validated whole-storefront token refinement.",
    );
  }
}

function appendPaletteWarnings(
  request: AiStorefrontProviderRequest,
  response: AiStorefrontProviderResponse,
): AiStorefrontProviderResponse {
  const palettePlan = request.brandPalettePlan ?? request.tokenRefinementPlan?.palette ?? null;
  if (palettePlan === null || palettePlan.warnings.length === 0) {
    return response;
  }
  const summary = structuredClone(response.proposal.summary);
  for (const warning of palettePlan.warnings) {
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
  assertRegisteredTokenRefinementResponse(request, response);
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
  if (response.proposal.dynamicCommerceMigration) {
    invalid(
      "unsupported-provider-transition",
      "Provider responses cannot originate canonical dynamic-commerce migration authority.",
    );
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
    response.proposal.dynamicCommerceMigration,
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
    if (error instanceof AiStorefrontProviderServerError) {
      const { category } = error;
      if (category === "stale") throw new AiStorefrontProviderStaleError();
      if (category === "validation" || category === "malformedResponse") {
        throw new AiStorefrontProviderValidationError(
          "server-validation",
          "The storefront request is invalid.",
        );
      }
      if (category === "providerUnavailable") throw new AiStorefrontProviderUnavailableError();
      throw error;
    }
    throw new AiStorefrontProviderUnavailableError();
  }
}
