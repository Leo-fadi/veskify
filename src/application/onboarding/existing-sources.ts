import { safeExternalUrlSchema } from "@/domain/shared";
import type { StorefrontDesignBrief } from "@/domain/design-brief";

const explicitProtocolPattern = /^[a-z][a-z\d+.-]*:/i;

export type ExistingStorefrontSourceValidationCode =
  | "EXISTING_STOREFRONT_URL_REQUIRED"
  | "EXISTING_STOREFRONT_URL_INVALID"
  | "EXISTING_STOREFRONT_URL_INSECURE"
  | "EXISTING_STOREFRONT_URL_UNSUPPORTED_PROTOCOL";

export type ExistingStorefrontSourceValidation = Readonly<
  | { valid: true; normalizedUrl: string }
  | {
      valid: false;
      normalizedUrl: string;
      code: ExistingStorefrontSourceValidationCode;
    }
>;

export type ExistingSourcesEvaluation = Readonly<{
  complete: boolean;
  required: boolean;
  missingFields: readonly ["existingStorefrontUrl"] | readonly [];
}>;

/** Trims a source and adds HTTPS only when the merchant entered a bare domain. */
export function normalizeExistingStorefrontUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || explicitProtocolPattern.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function validateExistingStorefrontSource(
  input: string,
): ExistingStorefrontSourceValidation {
  const normalizedUrl = normalizeExistingStorefrontUrl(input);
  if (!normalizedUrl) {
    return {
      valid: false,
      normalizedUrl,
      code: "EXISTING_STOREFRONT_URL_REQUIRED",
    };
  }

  const protocol = normalizedUrl.match(explicitProtocolPattern)?.[0].slice(0, -1).toLowerCase();
  if (protocol === "http") {
    return {
      valid: false,
      normalizedUrl,
      code: "EXISTING_STOREFRONT_URL_INSECURE",
    };
  }
  if (protocol && protocol !== "https") {
    return {
      valid: false,
      normalizedUrl,
      code: "EXISTING_STOREFRONT_URL_UNSUPPORTED_PROTOCOL",
    };
  }

  if (
    !/^https:\/\//i.test(normalizedUrl) ||
    !safeExternalUrlSchema.safeParse(normalizedUrl).success
  ) {
    return {
      valid: false,
      normalizedUrl,
      code: "EXISTING_STOREFRONT_URL_INVALID",
    };
  }

  return { valid: true, normalizedUrl };
}

export function evaluateExistingSourcesCompletion(
  brief: Pick<StorefrontDesignBrief, "creationContext">,
): ExistingSourcesEvaluation {
  const required = brief.creationContext.type === "redesign-existing-storefront";
  if (!required || brief.creationContext.existingStorefrontUrl !== null) {
    return { complete: true, required, missingFields: [] };
  }
  return {
    complete: false,
    required: true,
    missingFields: ["existingStorefrontUrl"],
  };
}
