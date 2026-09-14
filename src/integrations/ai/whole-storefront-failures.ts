import { StorefrontGenerationScopeError } from "@/application/ai-storefront-generation/scope-router";
import {
  AiStorefrontProviderValidationError,
  AiStorefrontProviderStaleError,
  AiStorefrontProviderUnavailableError,
} from "@/application/ai-storefront-generation/provider-boundary";
import { WholeStorefrontGenerationPlanError } from "@/application/whole-storefront-generation-plan/contract";
import { WholeStorefrontPlanningProviderError } from "@/application/whole-storefront-generation-plan/provider";
import { WholeStorefrontProposalError } from "@/application/whole-storefront-proposal-lifecycle/contract";
import { VeskoIntegrationError } from "@/application/vesko-integration/contract";

export type ServerWholeStorefrontAuthorityErrorCode =
  | "unauthorized"
  | "authentication-unavailable"
  | "stale"
  | "unavailable"
  | "invalid"
  | "brief-unavailable"
  | "invalid-brief"
  | "registry-unavailable"
  | "registry-mismatch"
  | "assets-unavailable"
  | "invalid-asset-reference"
  | "unsupported-locale"
  | "project-draft-mismatch"
  | "malformed-state";

export class ServerWholeStorefrontAuthorityError extends Error {
  constructor(readonly code: ServerWholeStorefrontAuthorityErrorCode) {
    super("The storefront planning request is unavailable.");
    this.name = "ServerWholeStorefrontAuthorityError";
  }
}

export type ServerWholeStorefrontFailure = Readonly<{
  status: number;
  category:
    | "validation"
    | "stale"
    | "permissionDenied"
    | "authenticationUnavailable"
    | "projectMismatch"
    | "tenantMismatch"
    | "providerUnavailable"
    | "internalFailure";
  retryable: boolean;
}>;

/**
 * Converts only known, sanitized generation-boundary failures to the existing
 * server response contract. Untyped application errors are not provider
 * outages; untyped provider errors are classified before they leave the
 * provider invocation boundary in requestWholeStorefrontGenerationPlan().
 */
export function mapServerWholeStorefrontFailure(error: unknown): ServerWholeStorefrontFailure {
  if (error instanceof StorefrontGenerationScopeError) {
    return { status: 400, category: "validation", retryable: false };
  }
  if (error instanceof AiStorefrontProviderValidationError) {
    return { status: 400, category: "validation", retryable: false };
  }
  if (error instanceof AiStorefrontProviderStaleError) {
    return { status: 409, category: "stale", retryable: false };
  }
  if (error instanceof AiStorefrontProviderUnavailableError) {
    return { status: 503, category: "providerUnavailable", retryable: true };
  }
  if (error instanceof WholeStorefrontGenerationPlanError) {
    const stale = ["stale-result", "stale-brief", "stale-approved-asset"].includes(error.code);
    return {
      status: stale ? 409 : 400,
      category: stale ? "stale" : "validation",
      retryable: false,
    };
  }
  if (error instanceof WholeStorefrontPlanningProviderError) {
    if (error.code === "stale-result") {
      return { status: 409, category: "stale", retryable: false };
    }
    if (error.code === "credentials-unavailable" || error.code === "provider-unavailable") {
      return { status: 503, category: "providerUnavailable", retryable: true };
    }
    return { status: 400, category: "validation", retryable: false };
  }
  if (error instanceof WholeStorefrontProposalError) {
    if (
      [
        "stale-plan",
        "stale-project",
        "stale-draft",
        "stale-registry",
        "stale-commerce",
        "stale-approved-asset-context",
      ].includes(error.code)
    ) {
      return { status: 409, category: "stale", retryable: false };
    }
    return { status: 400, category: "validation", retryable: false };
  }
  if (error instanceof VeskoIntegrationError) {
    if (error.code === "permissionDenied") {
      return { status: 401, category: "permissionDenied", retryable: false };
    }
    if (error.code === "authenticationUnavailable") {
      return { status: 503, category: "authenticationUnavailable", retryable: true };
    }
    if (error.code === "tenantMismatch") {
      return { status: 403, category: "tenantMismatch", retryable: false };
    }
    if (error.code === "projectMismatch") {
      return { status: 409, category: "projectMismatch", retryable: false };
    }
    if (
      [
        "staleProjectRevision",
        "staleCatalogueProjection",
        "draftRevisionConflict",
        "staleHistoryTarget",
        "historyTargetFingerprintMismatch",
        "savedDraftMismatch",
        "stalePublishConfirmation",
        "publishedStateConflict",
      ].includes(error.code)
    ) {
      return { status: 409, category: "stale", retryable: false };
    }
    return { status: 500, category: "internalFailure", retryable: false };
  }
  if (error instanceof ServerWholeStorefrontAuthorityError) {
    if (error.code === "unauthorized") {
      return { status: 401, category: "permissionDenied", retryable: false };
    }
    if (error.code === "authentication-unavailable") {
      return { status: 503, category: "authenticationUnavailable", retryable: false };
    }
    if (["stale", "project-draft-mismatch"].includes(error.code)) {
      return { status: 409, category: "stale", retryable: false };
    }
    if (
      [
        "invalid",
        "brief-unavailable",
        "invalid-brief",
        "registry-mismatch",
        "invalid-asset-reference",
        "unsupported-locale",
        "malformed-state",
      ].includes(error.code)
    ) {
      return { status: 400, category: "validation", retryable: false };
    }
    if (error.code === "unavailable") {
      return { status: 503, category: "providerUnavailable", retryable: true };
    }
    return { status: 500, category: "internalFailure", retryable: false };
  }
  return { status: 500, category: "internalFailure", retryable: false };
}
