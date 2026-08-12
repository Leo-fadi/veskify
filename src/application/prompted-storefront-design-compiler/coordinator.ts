import {
  createPromptedStorefrontDesignRequestV2,
  promptedStorefrontDesignIntentFingerprint,
  validatePromptedStorefrontDesignIntentV2,
  type CreatePromptedStorefrontDesignRequestV2Input,
  type PromptedStorefrontDesignIntentProvider,
} from "@/application/prompted-storefront-design-intent";
import type { ContentSupportFactAuthority } from "@/application/content-support-pages";
import type { PageFactEvidenceAuthority } from "@/application/storefront-site-map";
import type { ApprovedAssetPresentation } from "@/application/whole-storefront-generation-plan";
import { canonicalStorefrontContentFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  PromptedStorefrontDesignCompilerError,
  type CompiledPromptedStorefrontDesignDecisionV2,
} from "./contract";
import {
  compilePromptedStorefrontDesignIntentV2,
  type CompilePromptedStorefrontDesignIntentV2Input,
} from "./compiler";
import {
  executeCompiledPromptedStorefrontDesignDecisionV2,
  type ExecuteCompiledPromptedStorefrontDesignDecisionV2Input,
  type ExecutedPromptedStorefrontDesignDecisionV2,
} from "./executor";

/**
 * Exact current application authority required both before and after the
 * provider response. It deliberately contains the existing authorities rather
 * than a new persistent generation plan.
 */
export type PromptedStorefrontDesignCompilationAuthority = Readonly<{
  requestInput: CreatePromptedStorefrontDesignRequestV2Input;
  compatibilityInput: CompilePromptedStorefrontDesignIntentV2Input["compatibilityInput"];
  pageEvidenceAuthority: PageFactEvidenceAuthority;
  contentFactAuthority: ContentSupportFactAuthority;
  approvedAssetPresentations: readonly ApprovedAssetPresentation[];
}>;

type CompiledDecisionExecutor = (
  input: ExecuteCompiledPromptedStorefrontDesignDecisionV2Input,
) => ExecutedPromptedStorefrontDesignDecisionV2;

export type RunPromptedStorefrontDesignCompilationInput = Readonly<{
  provider: PromptedStorefrontDesignIntentProvider;
  /** Reloads the authoritative project, snapshot, capability, evidence, asset and commerce state. */
  loadCurrentAuthority: () => PromptedStorefrontDesignCompilationAuthority;
  maximumCandidateEvaluations?: number;
  /** Test-only seam that instruments the one permitted complete materialization. */
  executeCompiledDecision?: CompiledDecisionExecutor;
}>;

export type PromptedStorefrontDesignCompilationEvidence = Readonly<{
  providerId: string;
  modelId: string | null;
  requestFingerprint: string;
  promptFingerprint: string;
  providerIntentFingerprint: string;
  compiledDecisionFingerprint: string;
  synthesisFingerprint: string;
  structuralFingerprint: string;
  candidateSnapshotFingerprint: string;
  currentAuthorityFingerprints: readonly string[];
  protectedCommerceBeforeFingerprint: string;
  protectedCommerceAfterFingerprint: string;
  protectedMediaBeforeFingerprint: string;
  protectedMediaAfterFingerprint: string;
  materializationCount: 1;
}>;

export type PromptedStorefrontDesignCompilationResult = Readonly<{
  compiledDecision: CompiledPromptedStorefrontDesignDecisionV2;
  execution: ExecutedPromptedStorefrontDesignDecisionV2;
  evidence: PromptedStorefrontDesignCompilationEvidence;
}>;

function stale(message: string): never {
  throw new PromptedStorefrontDesignCompilerError("stale-authority", message);
}

function assertSameAuthority(
  before: ReturnType<typeof createPromptedStorefrontDesignRequestV2>,
  after: ReturnType<typeof createPromptedStorefrontDesignRequestV2>,
): void {
  if (
    before.request.requestFingerprint !== after.request.requestFingerprint ||
    canonicalValueString(before.request.currentAuthority) !==
      canonicalValueString(after.request.currentAuthority) ||
    before.capabilityAuthority.projection.fingerprint !==
      after.capabilityAuthority.projection.fingerprint
  ) {
    stale("Current storefront authority changed after the provider response.");
  }
}

function protectedAuthorityFingerprints(input: CreatePromptedStorefrontDesignRequestV2Input) {
  const commerce = canonicalValueString(input.catalogue);
  const media = canonicalValueString(
    input.catalogue.products
      .map(({ id, images }) => ({ id, images }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
  return { commerce, media };
}

/**
 * Provider-neutral, server-side post-response sequence. It has no Studio or
 * route wiring: P10B-16P-03 owns merchant-facing invocation. This function
 * never retries or falls back; it calls the injected provider once, refreshes
 * authority, and performs the one canonical synthesis materialization only
 * after a validated V2 intent and exact compiled decision exist.
 */
export async function runPromptedStorefrontDesignCompilation(
  input: RunPromptedStorefrontDesignCompilationInput,
): Promise<PromptedStorefrontDesignCompilationResult> {
  const before = input.loadCurrentAuthority();
  const initial = createPromptedStorefrontDesignRequestV2(before.requestInput);
  const protectedBefore = protectedAuthorityFingerprints(before.requestInput);

  const providerIntent = await input.provider.createDesignIntent(initial.request, {
    capabilityAuthority: initial.capabilityAuthority,
    currentAuthority: () => initial.request.currentAuthority,
  });

  const refreshed = input.loadCurrentAuthority();
  const current = createPromptedStorefrontDesignRequestV2(refreshed.requestInput);
  assertSameAuthority(initial, current);
  const protectedAfter = protectedAuthorityFingerprints(refreshed.requestInput);
  if (
    protectedBefore.commerce !== protectedAfter.commerce ||
    protectedBefore.media !== protectedAfter.media
  ) {
    stale(
      "Protected commerce or canonical product-media authority changed after the provider response.",
    );
  }

  const { intentFingerprint, ...providerIntentMaterial } = providerIntent;
  if (intentFingerprint !== promptedStorefrontDesignIntentFingerprint(providerIntentMaterial)) {
    throw new PromptedStorefrontDesignCompilerError(
      "invalid-input",
      "The provider intent fingerprint is stale.",
    );
  }
  const validatedIntent = validatePromptedStorefrontDesignIntentV2({
    request: current.request,
    capabilityAuthority: current.capabilityAuthority,
    currentAuthority: current.request.currentAuthority,
    intent: providerIntentMaterial,
  });
  const compileInput: CompilePromptedStorefrontDesignIntentV2Input = {
    originalRequest: initial.request,
    providerIntent: validatedIntent,
    currentRequestInput: refreshed.requestInput,
    compatibilityInput: refreshed.compatibilityInput,
    ...(input.maximumCandidateEvaluations === undefined
      ? {}
      : { maximumCandidateEvaluations: input.maximumCandidateEvaluations }),
  };
  const compiledDecision = compilePromptedStorefrontDesignIntentV2(compileInput);
  const execute =
    input.executeCompiledDecision ?? executeCompiledPromptedStorefrontDesignDecisionV2;
  const execution = execute({
    ...compileInput,
    compiledDecision,
    pageEvidenceAuthority: refreshed.pageEvidenceAuthority,
    contentFactAuthority: refreshed.contentFactAuthority,
    approvedAssetPresentations: refreshed.approvedAssetPresentations,
  });
  const candidate = execution.synthesis.materialization.snapshot;

  return Object.freeze({
    compiledDecision: structuredClone(compiledDecision),
    execution,
    evidence: Object.freeze({
      providerId: input.provider.id,
      modelId: input.provider.modelId,
      requestFingerprint: initial.request.requestFingerprint,
      promptFingerprint: initial.request.promptFingerprint,
      providerIntentFingerprint: validatedIntent.intentFingerprint,
      compiledDecisionFingerprint: compiledDecision.compiledDecisionFingerprint,
      synthesisFingerprint: execution.synthesis.decision.synthesisFingerprint,
      structuralFingerprint: compiledDecision.structuralFingerprint,
      candidateSnapshotFingerprint: canonicalStorefrontContentFingerprint(candidate),
      currentAuthorityFingerprints: [...compiledDecision.exactAuthorityFingerprints],
      protectedCommerceBeforeFingerprint: protectedBefore.commerce,
      protectedCommerceAfterFingerprint: protectedAfter.commerce,
      protectedMediaBeforeFingerprint: protectedBefore.media,
      protectedMediaAfterFingerprint: protectedAfter.media,
      materializationCount: 1,
    }),
  });
}
