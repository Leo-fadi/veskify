import "server-only";

import { aiStorefrontProviderResponseSchema } from "@/application/ai-storefront-generation";
import {
  canonicalizeAiStorefrontTarget,
  createAiStorefrontGenerationPermissionFingerprint,
  createAiStorefrontProposalId,
  createAiStorefrontTargetFingerprint,
  projectAiStorefrontSnapshot,
  validateAiStorefrontProposal,
  type AiStorefrontWholeStorefrontGeneration,
} from "@/application/ai-storefront";
import { requireMerchantProjectAction } from "@/application/merchant-project-context";
import {
  PromptedStorefrontDesignCompilerError,
  runPromptedStorefrontDesignCompilation,
  type PromptedStorefrontDesignCompilationAuthority,
  type PromptedStorefrontDesignCompilationResult,
} from "@/application/prompted-storefront-design-compiler";
import {
  PromptedStorefrontDesignIntentError,
  type PromptedStorefrontDesignIntentProvider,
} from "@/application/prompted-storefront-design-intent";
import {
  promptedStorefrontStudioGenerationRequestSchema,
  promptedStorefrontStudioGenerationSuccessSchema,
  type PromptedStorefrontStudioGenerationFailureCategory,
  type PromptedStorefrontStudioGenerationRequest,
} from "@/application/prompted-storefront-studio";
import { P10B16P03_PROJECT_ID } from "@/data/demo/p10b-16p-03-studio-identity";
import {
  createP10B16P03MockPromptedStorefrontDesignIntentProvider,
  selectP10B16P03MockPromptScenario,
  type P10B16P03MockPromptFailure,
} from "@/integrations/ai/mock-prompted-storefront-design-intent-v2-provider.server";
import { selectServerPromptedStorefrontDesignIntentProviderConfiguration } from "@/integrations/ai/openai/prompted-storefront-design-intent-v2-client.server";
import {
  mapServerWholeStorefrontFailure,
  ServerWholeStorefrontAuthorityError,
} from "@/integrations/ai/whole-storefront-runtime-authority";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
} from "@/domain/storefront";
import type { ServerPromptedStorefrontStudioAuthority } from "./prompted-storefront-studio-authority.server";

export const P10B16P03_MOCK_FAILURE_HEADER = "x-veskify-p10b-16p-03-mock-failure" as const;

type Environment = Readonly<Record<string, string | undefined>>;

export type SelectServerPromptedStorefrontDesignIntentProvider = (input: {
  request: PromptedStorefrontStudioGenerationRequest;
  httpRequest: Request;
  currentAuthority: PromptedStorefrontDesignCompilationAuthority;
}) => PromptedStorefrontDesignIntentProvider;

const mockFailures: readonly P10B16P03MockPromptFailure[] = [
  "provider-refusal",
  "provider-timeout",
  "provider-transport",
  "malformed-output",
  "strict-schema-invalid",
  "unknown-capability",
  "insufficient-material-intent",
  "unsupported-hard-constraint",
];

function mockFailure(httpRequest: Request): P10B16P03MockPromptFailure | undefined {
  const requested = httpRequest.headers.get(P10B16P03_MOCK_FAILURE_HEADER);
  return mockFailures.find((failure) => failure === requested);
}

/**
 * Selects one server-only provider path. Standalone access to the dedicated
 * P03 raw project intentionally uses the deterministic mock. Integrated
 * OpenAI mode uses only the V2 OpenAI selector and fails closed; it never
 * falls back to the mock when credentials or model authority are unavailable.
 */
export function createDefaultServerPromptedStorefrontDesignIntentProviderSelector({
  environment = process.env,
}: {
  environment?: Environment;
} = {}): SelectServerPromptedStorefrontDesignIntentProvider {
  return ({ request, httpRequest, currentAuthority }) => {
    const standaloneP03 =
      environment.VESKIFY_RUNTIME_MODE === "standalone" &&
      request.projectId === P10B16P03_PROJECT_ID;
    const explicitlyMocked = environment.VESKIFY_P10B_16P_03_MOCK_PROVIDER === "1";
    if (
      environment.VESKIFY_RUNTIME_MODE === "integrated" &&
      environment.VESKIFY_AI_PROVIDER === "openai"
    ) {
      const configuration = selectServerPromptedStorefrontDesignIntentProviderConfiguration({
        environment,
      });
      if (configuration.category !== "eligible") {
        throw new PromptedStorefrontDesignIntentError("credentials-unavailable");
      }
      return configuration.provider;
    }
    if (standaloneP03 || explicitlyMocked) {
      const failure = mockFailure(httpRequest);
      return createP10B16P03MockPromptedStorefrontDesignIntentProvider({
        scenario: selectP10B16P03MockPromptScenario(request.merchantPrompt),
        compatibilityInput: currentAuthority.compatibilityInput,
        ...(failure === undefined ? {} : { failure }),
      });
    }
    throw new ServerWholeStorefrontAuthorityError("unavailable");
  };
}

function failureMapping(error: unknown): {
  status: number;
  category: PromptedStorefrontStudioGenerationFailureCategory;
  retryable: boolean;
} {
  if (error instanceof PromptedStorefrontDesignIntentError) {
    if (error.code === "stale-authority") {
      return { status: 409, category: "stale", retryable: false };
    }
    if (
      ["provider-timeout", "provider-transport", "credentials-unavailable"].includes(error.code)
    ) {
      return { status: 503, category: "providerUnavailable", retryable: true };
    }
    return { status: 400, category: "validation", retryable: false };
  }
  if (error instanceof PromptedStorefrontDesignCompilerError) {
    return error.code === "stale-authority"
      ? { status: 409, category: "stale", retryable: false }
      : { status: 400, category: "validation", retryable: false };
  }
  const mapped = mapServerWholeStorefrontFailure(error);
  return {
    status: mapped.status,
    category: mapped.category,
    retryable: mapped.retryable,
  };
}

function failure(error: unknown): Response {
  const mapped = failureMapping(error);
  return Response.json(
    { ok: false, failure: { category: mapped.category, retryable: mapped.retryable } },
    { status: mapped.status },
  );
}

/**
 * Bridges the P02B compilation into the existing isolated Studio proposal.
 * The transition from the exact raw draft to the exact compiled candidate is
 * validated by the canonical proposal lifecycle, never by this route.
 */
export function projectPromptedStorefrontCompilationToStudioProposal(input: {
  request: PromptedStorefrontStudioGenerationRequest;
  result: PromptedStorefrontDesignCompilationResult;
}) {
  const materialization = input.result.execution.synthesis.materialization;
  const sourceSnapshot = input.result.sourceDraft;
  const candidateSnapshot = materialization.snapshot;
  const originalStorefront = projectAiStorefrontSnapshot(sourceSnapshot);
  const proposedStorefront = projectAiStorefrontSnapshot(candidateSnapshot);
  const proposalContext = {
    projectId: input.request.projectId,
    draftSnapshotId: input.request.draftSnapshotId,
    draftRevision: input.request.draftRevision,
    enabledLocales: materialization.planningInput.project.enabledLocales,
    activeLocale: input.request.activeLocale,
    storefront: originalStorefront,
  };
  const target = canonicalizeAiStorefrontTarget({
    scope: "storefront",
    projectId: input.request.projectId,
    draftSnapshotId: input.request.draftSnapshotId,
    draftRevision: input.request.draftRevision,
    affectedPageIds: sourceSnapshot.pages.map(({ id }) => id),
    affectedSectionTargets: [],
    designSystemTarget: {
      kind: "storefrontDesignSystem",
      projectId: input.request.projectId,
    },
    enabledLocales: materialization.planningInput.project.enabledLocales,
    activeLocale: input.request.activeLocale,
  });
  const targetFingerprint = createAiStorefrontTargetFingerprint(proposalContext, target);
  const generationTarget = {
    kind: "storefront" as const,
    projectId: input.request.projectId,
    draftSnapshotId: input.request.draftSnapshotId,
    draftRevision: input.request.draftRevision,
  };
  const wholeStorefrontGeneration: AiStorefrontWholeStorefrontGeneration = {
    kind: "canonicalWholeStorefrontGeneration" as const,
    contractVersion: "1.0.0" as const,
    order: 0 as const,
    operationType: "APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION" as const,
    target: generationTarget,
    permission: {
      skillId: "compilePromptedStorefrontDesignIntentV2" as const,
      skillVersion: "2.0.0" as const,
      skillScope: "storefront" as const,
      operationTypes: ["APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION"],
      target: generationTarget,
    },
    requestFingerprint: input.result.evidence.requestFingerprint,
    promptFingerprint: input.result.evidence.promptFingerprint,
    providerIntentFingerprint: input.result.evidence.providerIntentFingerprint,
    sourceProposalFingerprint: input.result.evidence.sourceProposalFingerprint,
    synthesisFingerprint: input.result.evidence.synthesisFingerprint,
    structuralFingerprint: input.result.evidence.structuralFingerprint,
    candidateSnapshotFingerprint: input.result.evidence.candidateSnapshotFingerprint,
    sourceProjectionFingerprint: canonicalValueFingerprint(originalStorefront),
    operationProjectionFingerprint: canonicalValueFingerprint(originalStorefront),
    resultingProjectionFingerprint: canonicalValueFingerprint(proposedStorefront),
    resultingSnapshotFingerprint: canonicalStorefrontContentFingerprint(candidateSnapshot),
    compiledDecisionFingerprint: input.result.evidence.compiledDecisionFingerprint,
    materializationAuthorityFingerprint: input.result.evidence.materializationAuthorityFingerprint,
  };
  const permissionFingerprint =
    createAiStorefrontGenerationPermissionFingerprint(wholeStorefrontGeneration);
  const proposal = validateAiStorefrontProposal(
    {
      id: createAiStorefrontProposalId(
        input.request.requestId,
        targetFingerprint,
        permissionFingerprint,
        [],
        [],
        undefined,
        wholeStorefrontGeneration,
      ),
      requestId: input.request.requestId,
      projectId: input.request.projectId,
      draftSnapshotId: input.request.draftSnapshotId,
      draftRevision: input.request.draftRevision,
      target,
      originalStorefront,
      proposedStorefront,
      affectedPages: sourceSnapshot.pages,
      affectedDesignState: null,
      permissionGrants: [],
      targetFingerprint,
      permissionFingerprint,
      operations: [],
      wholeStorefrontGeneration,
      assetPlacementOperations: [],
      summary: {
        en: "Prepared one complete storefront proposal for review.",
        fi: "Valmisteltiin yksi kokonainen verkkokauppaehdotus tarkistettavaksi.",
      },
      validation: { valid: true, errors: [] },
      status: "pending",
    },
    proposalContext,
  );
  return aiStorefrontProviderResponseSchema.parse({
    providerRequestId: input.request.requestId,
    providerId: input.result.evidence.providerId,
    proposal,
    metadata: {
      operationCount: 1,
      durationMs: 0,
      validation: "valid",
      authoritativePlanningFingerprint: materialization.plan.fingerprint,
      wholeStorefrontProposalFingerprint: input.result.evidence.sourceProposalFingerprint,
    },
  });
}

export function createServerPromptedStorefrontStudioHandler({
  authority,
  selectProvider = createDefaultServerPromptedStorefrontDesignIntentProviderSelector(),
}: {
  authority: ServerPromptedStorefrontStudioAuthority;
  selectProvider?: SelectServerPromptedStorefrontDesignIntentProvider;
}) {
  const activeGenerations = new Set<string>();
  return async function POST(httpRequest: Request): Promise<Response> {
    const body: unknown = await httpRequest.json().catch(() => null);
    const parsed = promptedStorefrontStudioGenerationRequestSchema.safeParse(body);
    if (!parsed.success) return failure(new PromptedStorefrontDesignIntentError("invalid-request"));
    const request = parsed.data;
    const generationKey = `${request.projectId}:${request.draftSnapshotId}`;
    if (activeGenerations.has(generationKey)) {
      return failure(new ServerWholeStorefrontAuthorityError("stale"));
    }
    activeGenerations.add(generationKey);
    try {
      const context = await authority.resolve(request, httpRequest);
      requireMerchantProjectAction(context.authorization, "request-ai-design");
      const providerSelectionAuthority = await context.loadCurrentAuthority();
      const provider = selectProvider({
        request,
        httpRequest,
        currentAuthority: providerSelectionAuthority,
      });
      const result = await runPromptedStorefrontDesignCompilation({
        provider,
        loadCurrentAuthority: context.loadCurrentAuthority,
      });
      const proposal = projectPromptedStorefrontCompilationToStudioProposal({
        request,
        result,
      });
      return Response.json(
        promptedStorefrontStudioGenerationSuccessSchema.parse({
          ok: true,
          proposal,
          currentEvidenceReferences: result.currentEvidenceReferences,
          lineage: {
            ...result.evidence,
            providerCallCount: 1,
            retryCount: 0,
          },
        }),
        { status: 200 },
      );
    } catch (error) {
      return failure(error);
    } finally {
      activeGenerations.delete(generationKey);
    }
  };
}
