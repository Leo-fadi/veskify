import { canonicalValueString } from "@/domain/storefront";
import {
  PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
  PromptedStorefrontDesignIntentError,
  promptedStorefrontCapabilityAuthorityReferenceSchema,
  promptedStorefrontCapabilityReferenceAuthorityFingerprint,
  promptedStorefrontCurrentAuthorityIdentitySchema,
  promptedStorefrontDesignRequestV2MaterialSchema,
  promptedStorefrontDesignRequestV2Schema,
  promptedStorefrontPromptFingerprint,
  promptedStorefrontDesignRequestFingerprint,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCurrentAuthorityIdentity,
  type PromptedStorefrontDesignRequestV2,
} from "./contract";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePromptedStorefrontDesignRequestV2(
  input: unknown,
): PromptedStorefrontDesignRequestV2 {
  if (!isRecord(input) || input.contractVersion !== PROMPTED_STOREFRONT_DESIGN_REQUEST_V2) {
    throw new PromptedStorefrontDesignIntentError("unsupported-contract-version");
  }
  if (
    typeof input.merchantPrompt === "string" &&
    input.promptFingerprint !== promptedStorefrontPromptFingerprint(input.merchantPrompt)
  ) {
    throw new PromptedStorefrontDesignIntentError("prompt-fingerprint-mismatch");
  }
  const material = { ...input };
  delete material.requestFingerprint;
  const parsedMaterial = promptedStorefrontDesignRequestV2MaterialSchema.safeParse(material);
  if (
    parsedMaterial.success &&
    typeof input.requestFingerprint === "string" &&
    input.requestFingerprint !== promptedStorefrontDesignRequestFingerprint(parsedMaterial.data)
  ) {
    throw new PromptedStorefrontDesignIntentError("request-fingerprint-mismatch");
  }
  const parsed = promptedStorefrontDesignRequestV2Schema.safeParse(input);
  if (!parsed.success) throw new PromptedStorefrontDesignIntentError("invalid-request");
  return parsed.data;
}

export function assertPromptedStorefrontCapabilityAuthority(
  request: PromptedStorefrontDesignRequestV2,
  authority: PromptedStorefrontCapabilityAuthority,
): void {
  let referenceFingerprint: string;
  try {
    const references = [...authority.referencesByPreferenceKey.values()].map((reference) =>
      promptedStorefrontCapabilityAuthorityReferenceSchema.parse(reference),
    );
    referenceFingerprint = promptedStorefrontCapabilityReferenceAuthorityFingerprint(references);
  } catch {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  if (
    authority.projection.fingerprint !== request.capabilityProjection.fingerprint ||
    referenceFingerprint !== request.currentAuthority.capabilityReferenceAuthorityFingerprint ||
    canonicalValueString(authority.projection) !==
      canonicalValueString(request.capabilityProjection)
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  const requestKeys = new Set(request.capabilityProjection.capabilities.map(({ key }) => key));
  if (
    requestKeys.size !== authority.referencesByPreferenceKey.size ||
    [...authority.referencesByPreferenceKey.keys()].some((key) => !requestKeys.has(key))
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  for (const capability of request.capabilityProjection.capabilities) {
    const reference = authority.referencesByPreferenceKey.get(capability.key);
    if (
      !reference ||
      reference.key !== capability.key ||
      reference.dimension !== capability.dimension ||
      reference.availability !== capability.availability ||
      canonicalValueString(reference.selection) !== canonicalValueString(capability.selection)
    ) {
      throw new PromptedStorefrontDesignIntentError("stale-authority");
    }
  }
}

export function assertPromptedStorefrontCurrentAuthority(
  expected: PromptedStorefrontCurrentAuthorityIdentity,
  currentInput: unknown,
): void {
  const current = promptedStorefrontCurrentAuthorityIdentitySchema.safeParse(currentInput);
  if (!current.success || canonicalValueString(expected) !== canonicalValueString(current.data)) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
}
