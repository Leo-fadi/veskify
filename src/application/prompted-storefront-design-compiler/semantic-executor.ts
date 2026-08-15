import type { ContentSupportFactAuthority } from "@/application/content-support-pages";
import type { PageFactEvidenceAuthority } from "@/application/storefront-site-map";
import type { ApprovedAssetPresentation } from "@/application/whole-storefront-generation-plan";
import {
  compiledPromptedStorefrontDesignDecisionV2Schema,
  PromptedStorefrontDesignCompilerError,
} from "./contract";
import {
  executeExactCompiledPromptedStorefrontDecision,
  type ExecutedPromptedStorefrontDesignDecisionV2,
} from "./executor";
import type { CompileSemanticStorefrontDesignIntentV1Input } from "./semantic-compiler";

export type ExecuteCompiledSemanticStorefrontDesignIntentV1Input =
  CompileSemanticStorefrontDesignIntentV1Input &
    Readonly<{
      compiledDecision: unknown;
      pageEvidenceAuthority: PageFactEvidenceAuthority;
      contentFactAuthority: ContentSupportFactAuthority;
      approvedAssetPresentations: readonly ApprovedAssetPresentation[];
    }>;

export function executeCompiledSemanticStorefrontDesignIntentV1(
  input: ExecuteCompiledSemanticStorefrontDesignIntentV1Input,
): ExecutedPromptedStorefrontDesignDecisionV2 {
  const supplied = compiledPromptedStorefrontDesignDecisionV2Schema.safeParse(
    input.compiledDecision,
  );
  if (!supplied.success) {
    throw new PromptedStorefrontDesignCompilerError(
      "invalid-input",
      "The compiled semantic storefront decision is invalid.",
      { cause: supplied.error },
    );
  }
  const compiled = supplied.data;
  if (
    compiled.identity.requestFingerprint !== input.originalRequest.requestFingerprint ||
    compiled.identity.promptFingerprint !== input.originalRequest.promptFingerprint ||
    compiled.identity.providerIntentFingerprint !== input.providerIntent.semanticIntentFingerprint
  ) {
    throw new PromptedStorefrontDesignCompilerError(
      "stale-authority",
      "The compiled semantic storefront decision does not match current authority.",
    );
  }
  return executeExactCompiledPromptedStorefrontDecision({
    compiledDecision: compiled,
    compatibilityInput: input.compatibilityInput,
    deterministicSeed: `semantic-design-${input.providerIntent.semanticIntentFingerprint.slice(-48)}`,
    pageEvidenceAuthority: input.pageEvidenceAuthority,
    contentFactAuthority: input.contentFactAuthority,
    approvedAssetPresentations: input.approvedAssetPresentations,
  });
}
