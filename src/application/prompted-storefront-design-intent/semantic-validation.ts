import {
  PromptedStorefrontDesignIntentError,
  promptedStorefrontPromptFingerprint,
} from "./contract";
import {
  semanticStorefrontDesignIntentFingerprint,
  semanticInfluenceAuthorityFingerprint,
  semanticStorefrontDesignIntentV1MaterialSchema,
  semanticStorefrontDesignIntentV1Schema,
  semanticStorefrontDesignRequestV1Schema,
  type SemanticStorefrontDesignIntentV1,
  type SemanticStorefrontDesignIntentValidationContext,
  type SemanticStorefrontDesignRequestV1,
} from "./semantic-contract";
import { expectedSemanticStorefrontDesignRequestFingerprint } from "./semantic-request";

export function validateSemanticStorefrontDesignRequestV1(
  input: unknown,
): SemanticStorefrontDesignRequestV1 {
  const parsed = semanticStorefrontDesignRequestV1Schema.safeParse(input);
  if (!parsed.success) throw new PromptedStorefrontDesignIntentError("invalid-request");
  const request = parsed.data;
  if (request.promptFingerprint !== promptedStorefrontPromptFingerprint(request.merchantPrompt)) {
    throw new PromptedStorefrontDesignIntentError("prompt-fingerprint-mismatch");
  }
  if (request.requestFingerprint !== expectedSemanticStorefrontDesignRequestFingerprint(request)) {
    throw new PromptedStorefrontDesignIntentError("request-fingerprint-mismatch");
  }
  const { authorityFingerprint, ...influenceMaterial } = request.semanticInfluenceAuthority;
  if (authorityFingerprint !== semanticInfluenceAuthorityFingerprint(influenceMaterial)) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  return request;
}

export function validateSemanticStorefrontDesignIntentV1(input: {
  request: SemanticStorefrontDesignRequestV1;
  validation: SemanticStorefrontDesignIntentValidationContext;
  intent: unknown;
}): SemanticStorefrontDesignIntentV1 {
  const request = validateSemanticStorefrontDesignRequestV1(input.request);
  let currentAuthorityFingerprint: string;
  let semanticAuthorityFingerprint: string;
  try {
    currentAuthorityFingerprint = input.validation.currentAuthorityFingerprint();
    semanticAuthorityFingerprint = input.validation.semanticAuthorityFingerprint();
  } catch {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  if (
    currentAuthorityFingerprint !== request.currentAuthorityFingerprint ||
    semanticAuthorityFingerprint !== request.semanticAuthorityFingerprint
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }

  const material = semanticStorefrontDesignIntentV1MaterialSchema.safeParse(input.intent);
  if (!material.success) {
    throw new PromptedStorefrontDesignIntentError("strict-schema-invalid");
  }
  if (material.data.requestFingerprint !== request.requestFingerprint) {
    throw new PromptedStorefrontDesignIntentError("request-fingerprint-mismatch");
  }
  if (material.data.promptFingerprint !== request.promptFingerprint) {
    throw new PromptedStorefrontDesignIntentError("prompt-fingerprint-mismatch");
  }
  if (
    material.data.currentAuthorityFingerprint !== request.currentAuthorityFingerprint ||
    material.data.semanticAuthorityFingerprint !== request.semanticAuthorityFingerprint
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }

  const parsed = semanticStorefrontDesignIntentV1Schema.safeParse({
    ...material.data,
    semanticIntentFingerprint: semanticStorefrontDesignIntentFingerprint(material.data),
  });
  if (!parsed.success) throw new PromptedStorefrontDesignIntentError("strict-schema-invalid");
  return parsed.data;
}
