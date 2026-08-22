import "server-only";

import { timingSafeEqual } from "node:crypto";
import {
  SemanticCompatibilityResolutionError,
  type SemanticCompatibilityDiagnostic,
  type PromptedStorefrontDesignCompilationResult,
} from "@/application/prompted-storefront-design-compiler";
import {
  PromptedStorefrontDesignIntentError,
  type SemanticStorefrontDesignIntentProvider,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent";
import type { PromptedStorefrontStudioGenerationRequest } from "@/application/prompted-storefront-studio";
import {
  P10B16P04_COMMERCIAL_PROJECT_ID,
  createP10B16P04RawAurumCommercialFixture,
} from "@/data/demo/p10b-16p-04-commercial-acceptance";
import {
  canonicalStorefrontContentFingerprint,
  type PageFactEvidenceReference,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  createP10B16P03MockPromptedStorefrontDesignIntentProvider,
  selectP10B16P03MockPromptScenario,
} from "./mock-prompted-storefront-design-intent-v2-provider.server";
import {
  OPENAI_PROMPTED_STOREFRONT_DESIGN_INTENT_V2_PROVIDER_ID,
  OpenAiPromptedStorefrontDesignIntentV2Provider,
  type PromptedStorefrontDesignIntentProviderTelemetryEvent,
} from "./openai/prompted-storefront-design-intent-v2-provider.server";
import { selectServerPromptedStorefrontDesignIntentProviderConfiguration } from "./openai/prompted-storefront-design-intent-v2-client.server";
import {
  createP10B16P03ServerPromptedStorefrontStudioAuthority,
  type ServerPromptedStorefrontStudioAuthority,
} from "./prompted-storefront-studio-authority.server";
import type { SelectServerPromptedStorefrontDesignIntentProvider } from "./prompted-storefront-studio-handler.server";
import { ServerWholeStorefrontAuthorityError } from "./whole-storefront-runtime-authority";
import type { ProjectAggregate } from "@/services/storage";

export const P10B_16P_04_LOCAL_ACCEPTANCE_FLAG = "VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE" as const;
export const P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN =
  "VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN" as const;
export const P10B_16P_04_MOCK_TRANSPORT_FLAG = "VESKIFY_P10B_16P_04_MOCK_TRANSPORT" as const;
export const P10B_16P_04_ACCEPTANCE_TOKEN_HEADER =
  "x-veskify-p10b-16p-04-acceptance-token" as const;
export const P10B_16P_04_LOCAL_ACCEPTANCE_NAMESPACE =
  "p10b-16p-04-real-studio-design-intent-v2-acceptance" as const;
export const P10B_16P_04_PROVIDER_CALL_BUDGET = 3 as const;
export const P10B_16P_04_MOCK_MODEL_ID = "mocked-p10b-16p-04-design-intent-v2" as const;
export const P10B_16P_04_MOCK_FAILURE_HEADER = "x-veskify-p10b-16p-04-mock-failure" as const;
export const P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT =
  "VESKIFY_P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT" as const;
export const P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT_2 =
  "VESKIFY_P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT_2" as const;

type AcceptanceEnvironment = Readonly<Record<string, string | undefined>>;
type HeaderAuthority = Pick<Headers, "get">;
export type P10B16P04SafeCaseEvidence = ReturnType<typeof createSafeCaseEvidence>;

const SAFE_TELEMETRY_EVIDENCE_KEYS = [
  "providerInputFingerprint",
  "providerWireIntentFingerprint",
  "providerSchemaFingerprint",
  "providerRequestEnvelopeFingerprint",
  "providerRequestFingerprint",
  "sdkTransportEntryCount",
  "durationMs",
  "inputTokens",
  "outputTokens",
  "totalTokens",
  "schemaDiagnostic",
  "transportDiagnostic",
] as const satisfies readonly (keyof PromptedStorefrontDesignIntentProviderTelemetryEvent)[];

type SafeTelemetryEvidence = Partial<
  Pick<
    PromptedStorefrontDesignIntentProviderTelemetryEvent,
    (typeof SAFE_TELEMETRY_EVIDENCE_KEYS)[number]
  >
>;

function safeTelemetryEvidence(
  telemetry: PromptedStorefrontDesignIntentProviderTelemetryEvent | undefined,
): SafeTelemetryEvidence {
  if (!telemetry) return {};
  return Object.fromEntries(
    SAFE_TELEMETRY_EVIDENCE_KEYS.flatMap((key) => {
      const value = telemetry[key];
      return value === undefined
        ? []
        : [[key, typeof value === "object" ? structuredClone(value) : value]];
    }),
  );
}

type ActiveAttempt = {
  caseNumber: 1 | 2 | 3;
  providerId: string;
  modelId: string | null;
  requestFingerprint: string;
  promptFingerprint: string;
  intentFingerprint?: string;
  telemetry?: PromptedStorefrontDesignIntentProviderTelemetryEvent;
  startedAt: string;
};

type AcceptanceState = {
  providerCallCount: number;
  retryCount: 0;
  status: "ready" | "calling" | "failed" | "complete";
  activeAttempt: ActiveAttempt | null;
  failedAttempt: Readonly<
    Omit<ActiveAttempt, "telemetry"> &
      SafeTelemetryEvidence & {
        failedAt: string;
        failureClassification: string;
        semanticCompatibilityDiagnostic?: SemanticCompatibilityDiagnostic;
      }
  > | null;
  failureClassification: string | null;
  cases: P10B16P04SafeCaseEvidence[];
  retainedProposalSnapshots: Map<string, StorefrontSnapshot>;
};

declare global {
  var __veskifyP10B16P04RealStudioAcceptanceState: AcceptanceState | undefined;
}

function createState(): AcceptanceState {
  return {
    providerCallCount: 0,
    retryCount: 0,
    status: "ready",
    activeAttempt: null,
    failedAttempt: null,
    failureClassification: null,
    cases: [],
    retainedProposalSnapshots: new Map(),
  };
}

function acceptanceState(): AcceptanceState {
  globalThis.__veskifyP10B16P04RealStudioAcceptanceState ??= createState();
  return globalThis.__veskifyP10B16P04RealStudioAcceptanceState;
}

export function resetP10B16P04RealStudioAcceptanceStateForTests(): void {
  if (process.env.NODE_ENV === "production") return;
  globalThis.__veskifyP10B16P04RealStudioAcceptanceState = createState();
}

export function isP10B16P04RealStudioAcceptanceConfigured(
  environment: AcceptanceEnvironment = process.env,
): boolean {
  return (
    (environment.NODE_ENV !== "production" ||
      (environment.P10B18C_PRODUCTION_CAPTURE === "1" &&
        environment.VESKIFY_P10B_16P_04_MOCK_TRANSPORT === "1")) &&
    environment.VESKIFY_RUNTIME_MODE === "integrated" &&
    environment.VESKIFY_AI_PROVIDER === "openai" &&
    environment[P10B_16P_04_LOCAL_ACCEPTANCE_FLAG] === "1"
  );
}

export function configuredP10B16P04AcceptanceToken(
  environment: AcceptanceEnvironment = process.env,
): string | null {
  const token = environment[P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN];
  return token && Buffer.byteLength(token) >= 32 ? token : null;
}

function sameSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function isAuthorizedHeader(headers: HeaderAuthority, environment: AcceptanceEnvironment): boolean {
  const configured = configuredP10B16P04AcceptanceToken(environment);
  const supplied = headers.get(P10B_16P_04_ACCEPTANCE_TOKEN_HEADER);
  return configured !== null && supplied !== null && sameSecret(configured, supplied);
}

function assertAcceptanceRequest(request: Request, environment: AcceptanceEnvironment): void {
  if (!isP10B16P04RealStudioAcceptanceConfigured(environment)) {
    throw new ServerWholeStorefrontAuthorityError("authentication-unavailable");
  }
  const requestUrl = new URL(request.url);
  if (
    request.method !== "POST" ||
    !request.headers.get("content-type")?.toLowerCase().includes("application/json") ||
    request.headers.get("origin") !== requestUrl.origin ||
    !isAuthorizedHeader(request.headers, environment)
  ) {
    throw new ServerWholeStorefrontAuthorityError("authentication-unavailable");
  }
}

function configuredPriorRejectedStructuralFingerprints(
  environment: AcceptanceEnvironment,
): readonly string[] {
  const first = environment[P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT];
  const second = environment[P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT_2];
  if (second !== undefined && first === undefined) {
    throw new ServerWholeStorefrontAuthorityError("invalid");
  }
  const fingerprints = [first, second].flatMap((fingerprint) =>
    fingerprint === undefined ? [] : [fingerprint],
  );
  for (const fingerprint of fingerprints) {
    if (
      fingerprint.length > 240 ||
      fingerprint.trim() !== fingerprint ||
      !/^semantic-structure-v1_[1-9]\d*_[0-9a-f]{64}$/u.test(fingerprint)
    ) {
      throw new ServerWholeStorefrontAuthorityError("invalid");
    }
  }
  if (new Set(fingerprints).size !== fingerprints.length) {
    throw new ServerWholeStorefrontAuthorityError("invalid");
  }
  return fingerprints;
}

export function createP10B16P04ServerPromptedStorefrontStudioAuthority({
  environment = process.env,
}: {
  environment?: AcceptanceEnvironment;
} = {}): ServerPromptedStorefrontStudioAuthority {
  const fixtureAuthority = createP10B16P03ServerPromptedStorefrontStudioAuthority({
    projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
    loadFixture: createP10B16P04RawAurumCommercialFixture,
    identity: {
      tenantId: "tenant_p10b16p04_acceptance",
      userId: "user_p10b16p04_acceptance",
      merchantId: "merchant_p10b16p04_acceptance",
      organizationId: "organization_p10b16p04_acceptance",
      storeId: "store_p10b16p04_acceptance",
    },
  });
  return Object.freeze({
    async resolve(
      request: PromptedStorefrontStudioGenerationRequest,
      httpRequest: Request,
    ): Promise<Awaited<ReturnType<ServerPromptedStorefrontStudioAuthority["resolve"]>>> {
      assertAcceptanceRequest(httpRequest, environment);
      if (request.projectId !== P10B16P04_COMMERCIAL_PROJECT_ID) {
        throw new ServerWholeStorefrontAuthorityError("invalid");
      }
      const context = await fixtureAuthority.resolve(request, httpRequest);
      const loadExactCurrentAuthority = context.loadCurrentAuthority;
      return {
        authorization: context.authorization,
        loadCurrentAuthority: async () => {
          const authority = await loadExactCurrentAuthority();
          const retainedRejectedFingerprints =
            configuredPriorRejectedStructuralFingerprints(environment);
          const recentRejectedStructuralFingerprints = [
            ...retainedRejectedFingerprints,
            ...acceptanceState().cases.map(({ structuralFingerprint }) => structuralFingerprint),
          ].filter((value, index, values) => values.indexOf(value) === index);
          return {
            ...authority,
            requestInput: {
              ...authority.requestInput,
              priorDiversityEvidence: {
                recentAcceptedStructuralFingerprints: [],
                recentRejectedStructuralFingerprints,
                recentlyUsedPostureKeys: [],
                merchantAvoidancePreferenceKeys: [],
              },
            },
          };
        },
      };
    },
  });
}

function beginProviderAttempt(
  provider: SemanticStorefrontDesignIntentProvider,
  request: SemanticStorefrontDesignRequestV1,
): ActiveAttempt {
  const current = acceptanceState();
  if (
    current.status === "failed" ||
    current.status === "complete" ||
    current.activeAttempt !== null ||
    current.providerCallCount >= P10B_16P_04_PROVIDER_CALL_BUDGET
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  const caseNumber = (current.providerCallCount + 1) as 1 | 2 | 3;
  const attempt: ActiveAttempt = {
    caseNumber,
    providerId: provider.id,
    modelId: provider.modelId,
    requestFingerprint: request.requestFingerprint,
    promptFingerprint: request.promptFingerprint,
    startedAt: new Date().toISOString(),
  };
  current.providerCallCount += 1;
  current.status = "calling";
  current.activeAttempt = attempt;
  return attempt;
}

function safeFailureClassification(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[a-z][a-z-]{1,80}$/.test(error.code)
  ) {
    return error.code;
  }
  return "internal-failure";
}

function failActiveAttempt(error: unknown): void {
  const current = acceptanceState();
  const active = current.activeAttempt;
  if (!active) return;
  const failureClassification = safeFailureClassification(error);
  const { telemetry, ...safeActive } = active;
  const compilerDiagnostic =
    error instanceof SemanticCompatibilityResolutionError ? error.diagnostic : undefined;
  current.status = "failed";
  current.failureClassification = failureClassification;
  current.failedAttempt = Object.freeze({
    ...safeActive,
    failedAt: new Date().toISOString(),
    failureClassification,
    ...safeTelemetryEvidence(telemetry),
    ...(compilerDiagnostic === undefined
      ? {}
      : { semanticCompatibilityDiagnostic: structuredClone(compilerDiagnostic) }),
  });
  current.activeAttempt = null;
}

function failStaleAttempt(): never {
  const error = new PromptedStorefrontDesignIntentError("stale-authority");
  failActiveAttempt(error);
  throw error;
}

function recordTelemetry(event: PromptedStorefrontDesignIntentProviderTelemetryEvent): void {
  const current = acceptanceState();
  if (!current.activeAttempt) return;
  if (
    current.activeAttempt.requestFingerprint === event.requestFingerprint &&
    current.activeAttempt.promptFingerprint === event.promptFingerprint
  ) {
    current.activeAttempt.telemetry = structuredClone(event);
  }
}

function guardedProvider(provider: SemanticStorefrontDesignIntentProvider) {
  return Object.freeze({
    id: provider.id,
    modelId: provider.modelId,
    async createDesignIntent(
      request: SemanticStorefrontDesignRequestV1,
      validation: Parameters<SemanticStorefrontDesignIntentProvider["createDesignIntent"]>[1],
    ) {
      const attempt = beginProviderAttempt(provider, request);
      try {
        const intent = await provider.createDesignIntent(request, validation);
        attempt.intentFingerprint = intent.semanticIntentFingerprint;
        return intent;
      } catch (error) {
        failActiveAttempt(error);
        throw error;
      }
    },
  }) satisfies SemanticStorefrontDesignIntentProvider;
}

function mockedOpenAiTransportProvider(input: {
  request: PromptedStorefrontStudioGenerationRequest;
  failure?: "provider-transport";
}): SemanticStorefrontDesignIntentProvider {
  const deterministicIntent = createP10B16P03MockPromptedStorefrontDesignIntentProvider({
    scenario: selectP10B16P03MockPromptScenario(input.request.merchantPrompt),
    ...(input.failure ? { failure: input.failure } : {}),
  });
  const provider: SemanticStorefrontDesignIntentProvider = Object.freeze({
    id: OPENAI_PROMPTED_STOREFRONT_DESIGN_INTENT_V2_PROVIDER_ID,
    modelId: P10B_16P_04_MOCK_MODEL_ID,
    async createDesignIntent(
      semanticRequest: Parameters<SemanticStorefrontDesignIntentProvider["createDesignIntent"]>[0],
      validation: Parameters<SemanticStorefrontDesignIntentProvider["createDesignIntent"]>[1],
    ) {
      const provider = new OpenAiPromptedStorefrontDesignIntentV2Provider({
        model: P10B_16P_04_MOCK_MODEL_ID,
        timeoutMs: 4_000,
        telemetry: { record: recordTelemetry },
        responses: {
          async create() {
            const intent = await deterministicIntent.createDesignIntent(
              semanticRequest,
              validation,
            );
            const { semanticIntentFingerprint: _semanticIntentFingerprint, ...material } = intent;
            void _semanticIntentFingerprint;
            return {
              id: `mocked_p10b16p04_${semanticRequest.requestFingerprint.slice(-24)}`,
              status: "completed",
              output: [],
              output_text: JSON.stringify(material),
              usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
            };
          },
        },
      });
      return provider.createDesignIntent(semanticRequest, validation);
    },
  });
  return provider;
}

export function createP10B16P04PromptedStorefrontProviderSelector({
  environment = process.env,
}: {
  environment?: AcceptanceEnvironment;
} = {}): SelectServerPromptedStorefrontDesignIntentProvider {
  return ({ request, httpRequest }) => {
    if (!isP10B16P04RealStudioAcceptanceConfigured(environment)) {
      throw new ServerWholeStorefrontAuthorityError("unavailable");
    }
    if (environment[P10B_16P_04_MOCK_TRANSPORT_FLAG] === "1") {
      const requestedFailure = httpRequest.headers.get(P10B_16P_04_MOCK_FAILURE_HEADER);
      const failure = requestedFailure === "provider-transport" ? requestedFailure : undefined;
      return guardedProvider(
        mockedOpenAiTransportProvider({
          request,
          ...(failure ? { failure } : {}),
        }),
      );
    }
    const configuration = selectServerPromptedStorefrontDesignIntentProviderConfiguration({
      environment,
      telemetry: { record: recordTelemetry },
    });
    if (configuration.category !== "eligible") {
      throw new PromptedStorefrontDesignIntentError("credentials-unavailable");
    }
    return guardedProvider(configuration.provider);
  };
}

function safeSelection(result: PromptedStorefrontDesignCompilationResult) {
  const decision = result.compiledDecision;
  const synthesis = result.execution.synthesisDecision;
  if (!decision.semanticResolution) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  const { typography, spacing, surfaces, controls, density, media } = decision.designDna.value;
  const dynamicAuthority =
    result.execution.synthesis.materialization.snapshot.dynamicCommercePresentation;
  if (!dynamicAuthority) throw new PromptedStorefrontDesignIntentError("stale-authority");
  const homepageFeaturedProducts = result.execution.synthesis.materialization.snapshot.pages
    .find(({ type }) => type === "home")
    ?.sections.find(({ component }) => component === "homepageFeaturedProducts")
    ?.content.productIds;
  if (
    !Array.isArray(homepageFeaturedProducts) ||
    !homepageFeaturedProducts.every((productId) => typeof productId === "string")
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  const safeArchetype = (archetypeId: string) => {
    const archetype = [
      ...dynamicAuthority.collectionSearchArchetypes,
      ...dynamicAuthority.productDetailArchetypes,
    ].find(({ id }) => id === archetypeId);
    const presentation = archetype?.componentPresentations.find(
      ({ component, visible }) =>
        visible &&
        (component === "dynamicCollectionCommerce" || component === "dynamicProductDetail"),
    );
    if (!archetype || !presentation) {
      throw new PromptedStorefrontDesignIntentError("stale-authority");
    }
    return {
      archetypeId: archetype.id,
      profileId: archetype.profile.profileId,
      component: presentation.component,
      variant: presentation.variant,
      anatomyId: presentation.anatomyId ?? null,
    };
  };
  return {
    directionId: decision.designDna.directionId,
    designDnaNonColour: structuredClone({
      typography,
      spacing,
      surfaces,
      controls,
      density,
      media,
    }),
    sharedFrame: {
      profileId: decision.sharedFrame.profileId,
      profileVersion: decision.sharedFrame.profileVersion,
    },
    profiles: {
      homepage: decision.profiles.homepage.profileId,
      collection: decision.profiles.collection.profileId,
      search: decision.profiles.search.profileId,
      productDetail: decision.profiles.productDetail.profileId,
    },
    homepageProductCount: homepageFeaturedProducts.length,
    narrative: structuredClone(decision.narrative),
    componentChoices: structuredClone(synthesis.componentChoices),
    pageProfileSelections: structuredClone(synthesis.pageProfileSelections),
    dynamicCommerce: {
      ...structuredClone(decision.dynamicCommerceSelection),
      selectedArchetypes: {
        collection: safeArchetype(decision.dynamicCommerceSelection.collectionArchetypeId),
        standardSimple: safeArchetype(decision.dynamicCommerceSelection.standardSimpleArchetypeId),
        configurable: safeArchetype(decision.dynamicCommerceSelection.configurableArchetypeId),
        highConsideration: safeArchetype(
          decision.dynamicCommerceSelection.highConsiderationArchetypeId,
        ),
      },
    },
    productCardAnatomyIds: [...decision.productCardAnatomyIds],
    postures: {
      narrative: decision.exactSelection.narrativePosture,
      merchandising: decision.exactSelection.merchandisingPosture,
      informationDensity: decision.exactSelection.informationDensityPosture,
      artDirection: decision.exactSelection.artDirectionPosture,
      responsive: decision.exactSelection.responsiveMode,
      spacingDensity: decision.exactSelection.designSystemSpacingDensity,
      surfaceDepth: decision.exactSelection.designSystemSurfaceDepth,
    },
    responsiveArtDirection: structuredClone(decision.responsiveArtDirection),
    staticContentSupportSelections: [...decision.staticContentSupportSelections],
    utilityPresentationSelections: [...decision.utilityPresentationSelections],
    evidenceBackedOmissions: [...decision.evidenceBackedOmissions],
    semanticResolution: structuredClone(decision.semanticResolution),
  };
}

function createSafeCaseEvidence(input: {
  active: ActiveAttempt;
  providerCallCount: number;
  result: PromptedStorefrontDesignCompilationResult;
  telemetry?: PromptedStorefrontDesignIntentProviderTelemetryEvent;
}) {
  const { active, result, telemetry } = input;
  return Object.freeze({
    caseNumber: active.caseNumber,
    providerId: result.evidence.providerId,
    modelId: result.evidence.modelId,
    providerCallCount: input.providerCallCount,
    retryCount: 0 as const,
    requestFingerprint: result.evidence.requestFingerprint,
    promptFingerprint: result.evidence.promptFingerprint,
    intentFingerprint: result.evidence.providerIntentFingerprint,
    compiledDecisionFingerprint: result.evidence.compiledDecisionFingerprint,
    synthesisFingerprint: result.evidence.synthesisFingerprint,
    structuralFingerprint: result.evidence.structuralFingerprint,
    candidateSnapshotFingerprint: result.evidence.candidateSnapshotFingerprint,
    currentAuthorityFingerprints: [...result.evidence.currentAuthorityFingerprints],
    materializationAuthorityFingerprint: result.evidence.materializationAuthorityFingerprint,
    protectedCommerceBeforeFingerprint: result.evidence.protectedCommerceBeforeFingerprint,
    protectedCommerceAfterFingerprint: result.evidence.protectedCommerceAfterFingerprint,
    protectedMediaBeforeFingerprint: result.evidence.protectedMediaBeforeFingerprint,
    protectedMediaAfterFingerprint: result.evidence.protectedMediaAfterFingerprint,
    protectedCommerce: "unchanged" as const,
    canonicalProductMedia: "unchanged" as const,
    materializationCount: 1 as const,
    ...safeTelemetryEvidence(telemetry),
    capturedAt: new Date().toISOString(),
    selection: safeSelection(result),
  });
}

export function recordP10B16P04CompilationSuccess(input: {
  request: PromptedStorefrontStudioGenerationRequest;
  result: PromptedStorefrontDesignCompilationResult;
}): void {
  const current = acceptanceState();
  const active = current.activeAttempt;
  if (
    !active ||
    active.requestFingerprint !== input.result.evidence.requestFingerprint ||
    active.promptFingerprint !== input.result.evidence.promptFingerprint ||
    active.intentFingerprint !== input.result.evidence.providerIntentFingerprint
  ) {
    failStaleAttempt();
  }
  const telemetry = active.telemetry;
  if (
    active.providerId === OPENAI_PROMPTED_STOREFRONT_DESIGN_INTENT_V2_PROVIDER_ID &&
    (!telemetry ||
      telemetry.outcome !== "success" ||
      telemetry.callCount !== 1 ||
      telemetry.retryCount !== 0 ||
      telemetry.providerId !== active.providerId ||
      telemetry.modelId !== active.modelId ||
      telemetry.requestFingerprint !== active.requestFingerprint ||
      telemetry.promptFingerprint !== active.promptFingerprint ||
      telemetry.intentFingerprint !== active.intentFingerprint ||
      telemetry.sdkTransportEntryCount !== 1 ||
      !telemetry.providerInputFingerprint ||
      !telemetry.providerWireIntentFingerprint ||
      !telemetry.providerSchemaFingerprint ||
      !telemetry.providerRequestEnvelopeFingerprint ||
      !telemetry.providerRequestFingerprint)
  ) {
    failStaleAttempt();
  }
  const evidence = createSafeCaseEvidence({
    active,
    providerCallCount: current.providerCallCount,
    result: input.result,
    ...(telemetry ? { telemetry } : {}),
  });
  if (
    evidence.protectedCommerceBeforeFingerprint !== evidence.protectedCommerceAfterFingerprint ||
    evidence.protectedMediaBeforeFingerprint !== evidence.protectedMediaAfterFingerprint
  ) {
    failStaleAttempt();
  }
  const candidateSnapshot = input.result.execution.synthesis.materialization.snapshot;
  if (
    canonicalStorefrontContentFingerprint(candidateSnapshot) !==
    evidence.candidateSnapshotFingerprint
  ) {
    failStaleAttempt();
  }
  current.retainedProposalSnapshots.set(
    evidence.candidateSnapshotFingerprint,
    structuredClone(candidateSnapshot),
  );
  current.cases.push(evidence);
  current.activeAttempt = null;
  current.failedAttempt = null;
  current.status =
    current.providerCallCount === P10B_16P_04_PROVIDER_CALL_BUDGET ? "complete" : "ready";
}

export function recordP10B16P04CompilationFailure(input: {
  request: PromptedStorefrontStudioGenerationRequest;
  error: unknown;
}): void {
  void input.request;
  failActiveAttempt(input.error);
}

type PageAuthorityInput = {
  projectId: string;
  httpHeaders: HeaderAuthority;
  environment?: AcceptanceEnvironment;
};

function hasAuthorizedPageAuthority(input: PageAuthorityInput): boolean {
  const environment = input.environment ?? process.env;
  return (
    isP10B16P04RealStudioAcceptanceConfigured(environment) &&
    input.projectId === P10B16P04_COMMERCIAL_PROJECT_ID &&
    isAuthorizedHeader(input.httpHeaders, environment)
  );
}

export function loadP10B16P04CurrentEvidenceReferences(
  input: PageAuthorityInput,
): readonly PageFactEvidenceReference[] | undefined {
  if (!hasAuthorizedPageAuthority(input)) return undefined;
  return structuredClone(createP10B16P04RawAurumCommercialFixture().approvedEvidenceReferences);
}

export function loadP10B16P04InitialDraftAuthority(
  input: PageAuthorityInput,
):
  | Readonly<{ draftSnapshotId: string; draftRevision: number; contentFingerprint: string }>
  | undefined {
  if (!hasAuthorizedPageAuthority(input)) return undefined;
  const fixture = createP10B16P04RawAurumCommercialFixture();
  return {
    draftSnapshotId: fixture.rawDraft.id,
    draftRevision: fixture.rawDraft.revision,
    contentFingerprint: canonicalStorefrontContentFingerprint(fixture.rawDraft),
  };
}

/**
 * Supplies the production-disabled browser repository with the exact raw Aurum
 * acceptance aggregate. This is merchant/catalogue input only: it contains no
 * designed Aurum snapshot and no generated proposal.
 */
export function loadP10B16P04InitialAggregateAuthority(
  input: PageAuthorityInput,
): ProjectAggregate | undefined {
  if (!hasAuthorizedPageAuthority(input)) return undefined;
  return structuredClone(createP10B16P04RawAurumCommercialFixture().aggregate);
}

export function loadP10B16P04ProposalPreviewAuthority(
  input: PageAuthorityInput & { candidateFingerprint: string },
): ProjectAggregate | undefined {
  if (!hasAuthorizedPageAuthority(input)) return undefined;
  const retained = acceptanceState().retainedProposalSnapshots.get(input.candidateFingerprint);
  if (!retained) return undefined;
  if (canonicalStorefrontContentFingerprint(retained) !== input.candidateFingerprint) {
    return undefined;
  }

  const fixture = createP10B16P04RawAurumCommercialFixture();
  const draftSnapshotId = fixture.aggregate.project.draftSnapshotId;
  if (retained.id !== draftSnapshotId) return undefined;
  const draftIndex = fixture.aggregate.snapshots.findIndex(({ id }) => id === draftSnapshotId);
  if (draftIndex < 0) return undefined;

  return {
    project: structuredClone(fixture.aggregate.project),
    catalogue: structuredClone(fixture.aggregate.catalogue),
    snapshots: fixture.aggregate.snapshots.map((snapshot, index) =>
      index === draftIndex ? structuredClone(retained) : structuredClone(snapshot),
    ),
  };
}

export function inspectP10B16P04RealStudioAcceptance(
  environment: AcceptanceEnvironment = process.env,
) {
  if (!isP10B16P04RealStudioAcceptanceConfigured(environment)) {
    throw new ServerWholeStorefrontAuthorityError("authentication-unavailable");
  }
  const configuration = selectServerPromptedStorefrontDesignIntentProviderConfiguration({
    environment,
  });
  const current = acceptanceState();
  return {
    namespace: P10B_16P_04_LOCAL_ACCEPTANCE_NAMESPACE,
    projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
    provider: {
      providerId: OPENAI_PROMPTED_STOREFRONT_DESIGN_INTENT_V2_PROVIDER_ID,
      modelId: configuration.modelId,
      category: configuration.category,
      credentialsAvailable: configuration.category === "eligible",
      timeoutMs: configuration.timeoutMs,
      boundedTimeout:
        configuration.timeoutMs !== null &&
        configuration.timeoutMs >= 1_000 &&
        configuration.timeoutMs <= 120_000,
      retryCount: configuration.retryCount,
      transport: configuration.transport,
    },
    selectedTransport: {
      kind: environment[P10B_16P_04_MOCK_TRANSPORT_FLAG] === "1" ? "mock" : "openai",
      providerId: OPENAI_PROMPTED_STOREFRONT_DESIGN_INTENT_V2_PROVIDER_ID,
      modelId:
        environment[P10B_16P_04_MOCK_TRANSPORT_FLAG] === "1"
          ? P10B_16P_04_MOCK_MODEL_ID
          : configuration.modelId,
    },
    callBudget: P10B_16P_04_PROVIDER_CALL_BUDGET,
    providerCallCount: current.providerCallCount,
    retryCount: current.retryCount,
    status: current.status,
    failureClassification: current.failureClassification,
    failedAttempt: structuredClone(current.failedAttempt),
    activeAttempt:
      current.activeAttempt === null
        ? null
        : {
            caseNumber: current.activeAttempt.caseNumber,
            providerId: current.activeAttempt.providerId,
            modelId: current.activeAttempt.modelId,
            requestFingerprint: current.activeAttempt.requestFingerprint,
            promptFingerprint: current.activeAttempt.promptFingerprint,
            startedAt: current.activeAttempt.startedAt,
          },
    cases: structuredClone(current.cases),
  };
}

export function createP10B16P04AcceptanceInspectionHandler({
  environment = process.env,
}: {
  environment?: AcceptanceEnvironment;
} = {}) {
  return function GET(request: Request): Response {
    if (
      !isP10B16P04RealStudioAcceptanceConfigured(environment) ||
      !isAuthorizedHeader(request.headers, environment)
    ) {
      return Response.json({ ok: false }, { status: 404 });
    }
    return Response.json({
      ok: true,
      acceptance: inspectP10B16P04RealStudioAcceptance(environment),
    });
  };
}
