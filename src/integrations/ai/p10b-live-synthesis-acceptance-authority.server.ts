import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  BoundedStorefrontSynthesisError,
  CoordinatedStorefrontDirectionError,
  createP10bLiveSynthesisIntentProviderRequest,
  executeCoordinatedDirection,
  listCoordinatedStorefrontDirections,
  p10bLiveSynthesisExecutableResultFingerprint,
  P10bLiveSynthesisIntentError,
  p10bLiveSynthesisIntentProviderRequestSchema,
  validateP10bLiveSynthesisIntentProviderResult,
  type CoordinatedStorefrontDirectionId,
  type P10bLiveSynthesisIntentProvider,
} from "@/application/bounded-storefront-synthesis";
import {
  executeAiStorefrontProposal,
  type AiStorefrontProposal,
} from "@/application/ai-storefront";
import { createWholeStorefrontGenerationTarget } from "@/application/whole-storefront-generation-plan";
import {
  P10B16L_PROJECT_ID,
  createP10B16LRawKarvonenAcceptanceFixture,
} from "@/data/demo/p10b-16l-live-provider-acceptance";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
  type PageFactEvidenceReference,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  OpenAiP10bLiveSynthesisIntentProvider,
  OPENAI_P10B_LIVE_SYNTHESIS_INTENT_PROVIDER_ID,
} from "./openai/p10b-live-synthesis-intent-provider";
import {
  selectServerP10bLiveSynthesisIntentProviderConfiguration,
  type ServerP10bLiveSynthesisIntentProviderConfiguration,
} from "./openai/p10b-live-synthesis-intent-client.server";
import {
  createServerAuthoritativeTrustedPlanProposalResponse,
  createServerAuthoritativeTrustedPlanProposalTransport,
} from "./whole-storefront-runtime-authority";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import { validateRegisteredSnapshot } from "@/components/registry";

export const P10B_16L_LOCAL_ACCEPTANCE_FLAG = "VESKIFY_P10B_16L_LOCAL_ACCEPTANCE";
export const P10B_16L_LOCAL_ACCEPTANCE_TOKEN = "VESKIFY_P10B_16L_LOCAL_ACCEPTANCE_TOKEN";
export const P10B_16L_MOCK_TRANSPORT_FLAG = "VESKIFY_P10B_16L_MOCK_TRANSPORT";
export const P10B_16L_LOCAL_ACCEPTANCE_NAMESPACE =
  "p10b-16l-real-provider-complete-storefront-synthesis";

type AcceptanceEnvironment = Readonly<Record<string, string | undefined>>;

export type P10bLiveSynthesisAcceptanceFailure =
  | "unavailable"
  | "unauthorized"
  | "stale"
  | "invalid"
  | "provider-unavailable"
  | "provider-response-invalid"
  | "unsupported-provider-selection"
  | "no-executable-compatible-intent"
  | "stale-authority"
  | "no-valid-coordinated-candidate"
  | "synthesis-materialization-failure"
  | "protected-commerce"
  | "malformed-state";

export class P10bLiveSynthesisAcceptanceError extends Error {
  constructor(readonly code: P10bLiveSynthesisAcceptanceFailure) {
    super("The local complete-storefront synthesis acceptance session is unavailable.");
    this.name = "P10bLiveSynthesisAcceptanceError";
  }
}

export type P10bLiveSynthesisAcceptanceMetadata = Readonly<{
  providerId: string;
  modelId: string;
  providerCallCount: 1;
  directionId: CoordinatedStorefrontDirectionId;
  executableIntentId: string;
  executableIntentFingerprint: string;
  directionAuthorityFingerprint: string;
  directionFingerprint: string;
  synthesisFingerprint: string;
  exactDiversityFingerprint: string;
  structuralDiversityFingerprint: string;
  siteMapFingerprint: string;
  snapshotFingerprint: string;
  pageCount: number;
  pageFamilyCounts: Readonly<Record<string, number>>;
  selectedProfileIds: readonly string[];
  protectedCommerce: "unchanged";
  canonicalProductMedia: "unchanged";
  approvedAssets: "unchanged";
  validation: "valid";
}>;

type GeneratedAcceptance = Readonly<{
  proposal: AiStorefrontProposal;
  expectedSnapshot: StorefrontSnapshot;
  reviewAggregate: ProjectAggregate;
  reviewBaselineFingerprint: string;
  metadata: P10bLiveSynthesisAcceptanceMetadata;
}>;

type AcceptanceState = {
  rawAggregate: ProjectAggregate;
  repository: InMemoryProjectRepository;
  savedAggregate: ProjectAggregate;
  baselineFingerprint: string;
  commerceFingerprint: string;
  serialization: Promise<void>;
  session: {
    id: string;
    authoritativeRevision: number;
    generationStatus: "idle" | "calling" | "generated" | "accepted" | "rejected" | "failed";
    providerCallCount: number;
    hasExplicitSave: boolean;
    generated: GeneratedAcceptance | null;
  };
};

declare global {
  var __veskifyP10b16lLiveSynthesisAcceptanceState: AcceptanceState | undefined;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createState(): AcceptanceState {
  const fixture = createP10B16LRawKarvonenAcceptanceFixture();
  return {
    rawAggregate: clone(fixture.aggregate),
    repository: new InMemoryProjectRepository([clone(fixture.aggregate)]),
    savedAggregate: clone(fixture.aggregate),
    baselineFingerprint: canonicalValueFingerprint(fixture.aggregate),
    commerceFingerprint: canonicalValueFingerprint(fixture.aggregate.catalogue),
    serialization: Promise.resolve(),
    session: {
      id: randomBytes(32).toString("base64url"),
      authoritativeRevision: fixture.aggregate.project.revision,
      generationStatus: "idle",
      providerCallCount: 0,
      hasExplicitSave: false,
      generated: null,
    },
  };
}

export function isP10bLiveSynthesisAcceptanceConfigured(
  environment: AcceptanceEnvironment = process.env,
): boolean {
  return (
    environment.NODE_ENV !== "production" &&
    environment.VESKIFY_RUNTIME_MODE === "integrated" &&
    environment[P10B_16L_LOCAL_ACCEPTANCE_FLAG] === "1"
  );
}

export function configuredP10bLiveSynthesisAcceptanceToken(
  environment: AcceptanceEnvironment = process.env,
): string | null {
  const token = environment[P10B_16L_LOCAL_ACCEPTANCE_TOKEN];
  return token && Buffer.byteLength(token) >= 32 ? token : null;
}

export function sameP10bLiveSynthesisAcceptanceSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function state(environment: AcceptanceEnvironment): AcceptanceState {
  if (!isP10bLiveSynthesisAcceptanceConfigured(environment)) {
    throw new P10bLiveSynthesisAcceptanceError("unavailable");
  }
  globalThis.__veskifyP10b16lLiveSynthesisAcceptanceState ??= createState();
  return globalThis.__veskifyP10b16lLiveSynthesisAcceptanceState;
}

async function serialized<T>(current: AcceptanceState, action: () => T | Promise<T>): Promise<T> {
  const previous = current.serialization;
  let release: () => void;
  current.serialization = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await action();
  } finally {
    release!();
  }
}

function assertSession(current: AcceptanceState, projectId: string, sessionId: string): void {
  if (
    projectId !== P10B16L_PROJECT_ID ||
    !sameP10bLiveSynthesisAcceptanceSecret(sessionId, current.session.id)
  ) {
    throw new P10bLiveSynthesisAcceptanceError("unauthorized");
  }
}

function explicitMockProvider(): P10bLiveSynthesisIntentProvider {
  return new OpenAiP10bLiveSynthesisIntentProvider({
    model: "mocked-p10b16l-structured-intent",
    timeoutMs: 4_000,
    responses: {
      create(request) {
        const input = p10bLiveSynthesisIntentProviderRequestSchema.parse(
          JSON.parse(request.input) as unknown,
        );
        const selected =
          input.requestedDirectionId ??
          input.executableIntents.find(({ directionId }) => directionId === "modern-technical")
            ?.directionId ??
          input.executableIntents[0]?.directionId;
        if (!selected) throw new Error("The explicit mock transport has no direction authority.");
        const selectedOption = input.executableIntents.find(
          ({ directionId }) => directionId === selected,
        );
        if (!selectedOption) throw new Error("The explicit mock direction is not executable.");
        return Promise.resolve({
          id: `mocked_p10b16l_${input.requestFingerprint.slice(-16)}`,
          status: "completed",
          output: [],
          output_text: JSON.stringify({
            requestFingerprint: input.requestFingerprint,
            executableIntentId: selectedOption.intentId,
            executableIntentFingerprint: selectedOption.executableIntentFingerprint,
          }),
        });
      },
    },
  });
}

export function selectP10bLiveSynthesisAcceptanceProviderConfiguration(
  environment: AcceptanceEnvironment = process.env,
): ServerP10bLiveSynthesisIntentProviderConfiguration {
  if (environment.NODE_ENV !== "production" && environment[P10B_16L_MOCK_TRANSPORT_FLAG] === "1") {
    const provider = explicitMockProvider();
    return { provider, modelId: provider.modelId, category: "eligible" };
  }
  return selectServerP10bLiveSynthesisIntentProviderConfiguration({ environment });
}

function authorityFingerprint(
  fixture: ReturnType<typeof createP10B16LRawKarvonenAcceptanceFixture>,
  aggregate: ProjectAggregate,
): string {
  const target = createWholeStorefrontGenerationTarget(fixture.executionPlanningInput);
  return `p10b16l-authority-${canonicalValueFingerprint({
    aggregate: canonicalValueFingerprint(aggregate),
    target: target.fingerprint,
    siteMap: fixture.siteMapDecision,
    evidence: fixture.approvedEvidenceReferences,
    directions: listCoordinatedStorefrontDirections().map(({ id, authorityFingerprint }) => ({
      id,
      authorityFingerprint,
    })),
  })}`;
}

function intentRequest(input: {
  fixture: ReturnType<typeof createP10B16LRawKarvonenAcceptanceFixture>;
  aggregate: ProjectAggregate;
  merchantInstruction: string;
  requestedDirectionId: CoordinatedStorefrontDirectionId | null;
}) {
  const { catalogue, brief } = input.fixture.planningInput;
  return createP10bLiveSynthesisIntentProviderRequest({
    merchantInstruction: input.merchantInstruction,
    requestedDirectionId: input.requestedDirectionId,
    merchantContext: {
      businessName: brief.businessIdentity.businessName,
      shortDescription: brief.businessIdentity.shortDescription,
      industry: brief.businessIdentity.industry,
      targetCustomer: brief.businessIdentity.targetCustomer,
      primaryMarket: brief.businessIdentity.primaryMarket,
      enabledLocales: input.fixture.planningInput.project.enabledLocales,
    },
    catalogueCharacteristics: {
      productCount: catalogue.products.length,
      collectionCount: catalogue.collections.length,
      configurableProductCount: catalogue.products.filter(
        ({ orderOptions }) => (orderOptions?.length ?? 0) > 0,
      ).length,
      optionGroupCount: catalogue.products.reduce(
        (count, { orderOptions }) => count + (orderOptions?.length ?? 0),
        0,
      ),
      productsWithMultipleMedia: catalogue.products.filter(({ images }) => images.length > 1)
        .length,
      productsWithoutPrice: catalogue.products.filter(({ price }) => price === undefined).length,
      canonicalCommerceFingerprint: createWholeStorefrontGenerationTarget(
        input.fixture.executionPlanningInput,
      ).canonicalCommerceFingerprint,
    },
    evidenceRichness: {
      approvedBriefRevision: brief.revision,
      approvedFactFamilies: [
        ...new Set(
          input.fixture.siteMapDecision.pages
            .filter(({ evidenceReferences }) => evidenceReferences.length > 0)
            .map(({ familyId }) => familyId),
        ),
      ].sort((left, right) => left.localeCompare(right)),
      approvedFactCount: input.fixture.approvedEvidenceReferences.length,
    },
    approvedAssetPosture: {
      approvedAssetCount: 0,
      approvedRoles: [],
      editorialMediaAvailable: false,
    },
    currentAuthorityFingerprint: authorityFingerprint(input.fixture, input.aggregate),
    executionAuthority: {
      planningInput: input.fixture.executionPlanningInput,
      siteMapDecision: input.fixture.siteMapDecision,
      approvedEvidenceReferences: input.fixture.approvedEvidenceReferences,
      pageEvidenceAuthority: input.fixture.pageEvidenceAuthority,
      contentFactAuthority: input.fixture.contentFactAuthority,
      approvedAssetPresentations: input.fixture.approvedAssetPresentations,
    },
  });
}

function aggregateWithDraft(
  aggregate: ProjectAggregate,
  draft: StorefrontSnapshot,
): ProjectAggregate {
  const exists = aggregate.snapshots.some(({ id }) => id === draft.id);
  return validateProjectAggregate({
    ...clone(aggregate),
    snapshots: exists
      ? aggregate.snapshots.map((snapshot) =>
          snapshot.id === draft.id ? clone(draft) : clone(snapshot),
        )
      : [...aggregate.snapshots.map(clone), clone(draft)],
  });
}

function snapshotIdentity(snapshot: StorefrontSnapshot) {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    revision: snapshot.revision,
    catalogueRef: snapshot.catalogueRef,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
  };
}

function assertSynchronizedAggregateAuthority(input: {
  current: ProjectAggregate;
  next: ProjectAggregate;
  mode: "active" | "saved";
  evidenceReferences: readonly PageFactEvidenceReference[];
}): { currentDraft: StorefrontSnapshot; nextDraft: StorefrontSnapshot } {
  const normalizedNextProject = {
    ...input.next.project,
    draftSnapshotId: input.current.project.draftSnapshotId,
    updatedAt: input.current.project.updatedAt,
  };
  if (
    canonicalValueString(normalizedNextProject) !== canonicalValueString(input.current.project) ||
    canonicalValueString(input.next.snapshotHistoryMetadata ?? []) !==
      canonicalValueString(input.current.snapshotHistoryMetadata ?? [])
  ) {
    throw new P10bLiveSynthesisAcceptanceError("invalid");
  }

  const currentById = new Map(input.current.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const nextById = new Map(input.next.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const currentDraft = currentById.get(input.current.project.draftSnapshotId);
  const nextDraft = nextById.get(input.next.project.draftSnapshotId);
  if (
    !currentDraft ||
    !nextDraft ||
    input.next.project.updatedAt !== nextDraft.createdAt ||
    input.next.project.publishedSnapshotId !== input.current.project.publishedSnapshotId
  ) {
    throw new P10bLiveSynthesisAcceptanceError("invalid");
  }

  try {
    validateRegisteredSnapshot(
      nextDraft,
      input.next.catalogue,
      input.next.project.primaryLocale,
      input.next.project.primaryLocale,
      input.next.project.enabledLocales,
      input.evidenceReferences,
      nextDraft.contentSupportFactDocuments,
    );
  } catch {
    throw new P10bLiveSynthesisAcceptanceError("invalid");
  }

  for (const currentSnapshot of input.current.snapshots) {
    const submitted = nextById.get(currentSnapshot.id);
    if (
      !submitted ||
      (currentSnapshot.id !== input.current.project.draftSnapshotId &&
        canonicalValueString(submitted) !== canonicalValueString(currentSnapshot))
    ) {
      throw new P10bLiveSynthesisAcceptanceError("invalid");
    }
  }
  const submittedCurrentDraft = nextById.get(input.current.project.draftSnapshotId);
  if (
    !submittedCurrentDraft ||
    canonicalValueString(snapshotIdentity(submittedCurrentDraft)) !==
      canonicalValueString(snapshotIdentity(currentDraft))
  ) {
    throw new P10bLiveSynthesisAcceptanceError("invalid");
  }

  if (input.mode === "active") {
    if (
      input.next.project.draftSnapshotId !== input.current.project.draftSnapshotId ||
      input.next.snapshots.length !== input.current.snapshots.length
    ) {
      throw new P10bLiveSynthesisAcceptanceError("invalid");
    }
    return { currentDraft, nextDraft };
  }

  if (
    input.next.project.draftSnapshotId === input.current.project.draftSnapshotId ||
    currentById.has(input.next.project.draftSnapshotId) ||
    input.next.project.draftSnapshotId === input.current.project.publishedSnapshotId ||
    input.next.snapshots.length !== input.current.snapshots.length + 1 ||
    nextDraft.createdBy !== "user"
  ) {
    throw new P10bLiveSynthesisAcceptanceError("invalid");
  }
  return { currentDraft, nextDraft };
}

function pageFamilyCounts(snapshot: StorefrontSnapshot): Record<string, number> {
  return Object.fromEntries(
    [...new Set(snapshot.pages.map((page) => page.pageFamily?.familyId ?? page.type))]
      .sort((left, right) => left.localeCompare(right))
      .map((familyId) => [
        familyId,
        snapshot.pages.filter((page) => (page.pageFamily?.familyId ?? page.type) === familyId)
          .length,
      ]),
  );
}

export function mapP10bLiveSynthesisGenerationError(
  error: unknown,
): P10bLiveSynthesisAcceptanceError {
  if (error instanceof P10bLiveSynthesisAcceptanceError) return error;
  if (error instanceof P10bLiveSynthesisIntentError) {
    switch (error.code) {
      case "stale-authority":
        return new P10bLiveSynthesisAcceptanceError("stale-authority");
      case "credentials-unavailable":
      case "provider-unavailable":
        return new P10bLiveSynthesisAcceptanceError("provider-unavailable");
      case "provider-refusal":
      case "malformed-response":
        return new P10bLiveSynthesisAcceptanceError("provider-response-invalid");
      case "unsupported-selection":
        return new P10bLiveSynthesisAcceptanceError("unsupported-provider-selection");
      case "no-executable-compatible-intent":
        return new P10bLiveSynthesisAcceptanceError("no-executable-compatible-intent");
      case "invalid-request":
        return new P10bLiveSynthesisAcceptanceError("malformed-state");
    }
  }
  if (error instanceof CoordinatedStorefrontDirectionError) {
    if (error.code === "stale-direction-authority") {
      return new P10bLiveSynthesisAcceptanceError("stale-authority");
    }
    if (
      ["unsupported-characteristic", "incompatible-direction", "no-valid-diversity"].includes(
        error.code,
      )
    ) {
      return new P10bLiveSynthesisAcceptanceError("no-valid-coordinated-candidate");
    }
    return new P10bLiveSynthesisAcceptanceError("malformed-state");
  }
  if (error instanceof BoundedStorefrontSynthesisError) {
    if (error.code === "stale-authority") {
      return new P10bLiveSynthesisAcceptanceError("stale-authority");
    }
    if (error.code === "non-deterministic-selection") {
      return new P10bLiveSynthesisAcceptanceError("malformed-state");
    }
    return new P10bLiveSynthesisAcceptanceError("synthesis-materialization-failure");
  }
  return new P10bLiveSynthesisAcceptanceError("malformed-state");
}

type GenerationStage =
  | "intent-authority"
  | "provider-intent"
  | "authority-refresh"
  | "provider-selection"
  | "coordinated-synthesis"
  | "studio-transport"
  | "studio-proposal"
  | "studio-replay";

function safeDiagnostic(input: {
  current: AcceptanceState;
  outcome: "success" | "failed";
  providerId: string;
  modelId: string | null;
  directionId?: CoordinatedStorefrontDirectionId;
  executableIntentFingerprint?: string;
  failureCode?: P10bLiveSynthesisAcceptanceFailure;
  failureStage?: GenerationStage;
}) {
  console.info("p10b-16l-live-synthesis-acceptance", {
    outcome: input.outcome,
    providerId: input.providerId,
    modelId: input.modelId,
    providerCallCount: input.current.session.providerCallCount,
    authoritativeRevision: input.current.session.authoritativeRevision,
    ...(input.directionId ? { directionId: input.directionId } : {}),
    ...(input.executableIntentFingerprint
      ? { executableIntentFingerprint: input.executableIntentFingerprint }
      : {}),
    ...(input.failureCode ? { failureCode: input.failureCode } : {}),
    ...(input.failureStage ? { failureStage: input.failureStage } : {}),
  });
}

export async function generateP10bLiveSynthesisAcceptance(input: {
  projectId: string;
  sessionId: string;
  merchantInstruction: string;
  requestedDirectionId: CoordinatedStorefrontDirectionId | null;
  providerConfiguration: ServerP10bLiveSynthesisIntentProviderConfiguration;
  environment?: AcceptanceEnvironment;
}): Promise<P10bLiveSynthesisAcceptanceMetadata & { editorRoute: string }> {
  const current = state(input.environment ?? process.env);
  return serialized(current, async () => {
    assertSession(current, input.projectId, input.sessionId);
    if (current.session.generationStatus !== "idle") {
      throw new P10bLiveSynthesisAcceptanceError("stale");
    }
    let generationStage: GenerationStage = "intent-authority";
    let selectedDirectionId: CoordinatedStorefrontDirectionId | undefined;
    let selectedExecutableIntentFingerprint: string | undefined;
    try {
      if (
        input.providerConfiguration.category !== "eligible" ||
        input.providerConfiguration.modelId === null
      ) {
        throw new P10bLiveSynthesisAcceptanceError("provider-unavailable");
      }

      const fixture = createP10B16LRawKarvonenAcceptanceFixture();
      const aggregate = await current.repository.get(input.projectId);
      if (
        canonicalValueFingerprint(aggregate) !== current.baselineFingerprint ||
        canonicalValueFingerprint(aggregate.catalogue) !== current.commerceFingerprint
      ) {
        throw new P10bLiveSynthesisAcceptanceError("stale");
      }
      const request = intentRequest({ ...input, fixture, aggregate });
      if (current.session.providerCallCount !== 0) {
        throw new P10bLiveSynthesisAcceptanceError("stale");
      }
      current.session.generationStatus = "calling";
      current.session.providerCallCount = 1;
      generationStage = "provider-intent";
      const providerResult = await input.providerConfiguration.provider.selectIntent(request);
      generationStage = "authority-refresh";
      const currentAggregate = await current.repository.get(input.projectId);
      const currentRequest = intentRequest({ ...input, fixture, aggregate: currentAggregate });
      if (canonicalValueString(currentRequest) !== canonicalValueString(request)) {
        throw new P10bLiveSynthesisIntentError("stale-authority");
      }
      generationStage = "provider-selection";
      const validatedIntent = validateP10bLiveSynthesisIntentProviderResult(
        currentRequest,
        providerResult,
      );
      selectedDirectionId = validatedIntent.directionRequest.directionId;
      selectedExecutableIntentFingerprint = validatedIntent.executableIntentFingerprint;
      generationStage = "coordinated-synthesis";
      const result = executeCoordinatedDirection({
        planningInput: fixture.executionPlanningInput,
        siteMapDecision: fixture.siteMapDecision,
        approvedEvidenceReferences: fixture.approvedEvidenceReferences,
        pageEvidenceAuthority: fixture.pageEvidenceAuthority,
        contentFactAuthority: fixture.contentFactAuthority,
        approvedAssetPresentations: fixture.approvedAssetPresentations,
        directionRequest: validatedIntent.directionRequest,
      });
      if (
        p10bLiveSynthesisExecutableResultFingerprint(result) !==
        validatedIntent.expectedExecutionFingerprint
      ) {
        throw new P10bLiveSynthesisAcceptanceError("malformed-state");
      }
      const materialization = result.synthesis.materialization;
      generationStage = "studio-transport";
      const proposalTransport = createServerAuthoritativeTrustedPlanProposalTransport({
        planningInput: materialization.planningInput,
        plan: materialization.plan,
        merchantInstruction: input.merchantInstruction,
        activeLocale: fixture.aggregate.project.primaryLocale,
        requestSequence: 1,
        correlationRequestId: `p10b16l_request_${request.requestFingerprint.slice(-24)}`,
        providerId: OPENAI_P10B_LIVE_SYNTHESIS_INTENT_PROVIDER_ID,
      });
      generationStage = "studio-proposal";
      const response = createServerAuthoritativeTrustedPlanProposalResponse({
        request: proposalTransport,
        plan: materialization.plan,
        planningInput: materialization.planningInput,
        approvedAssetPresentations: fixture.approvedAssetPresentations,
        expectedSnapshot: materialization.snapshot,
      });
      generationStage = "studio-replay";
      const applied = executeAiStorefrontProposal({
        proposal: response.proposal,
        activeDraft: materialization.planningInput.draft,
        catalogue: fixture.planningInput.catalogue,
        enabledLocales: fixture.aggregate.project.enabledLocales,
        activeLocale: fixture.aggregate.project.primaryLocale,
        primaryLocale: fixture.aggregate.project.primaryLocale,
      });
      if (
        canonicalStorefrontContentFingerprint(applied) !==
        canonicalStorefrontContentFingerprint(materialization.snapshot)
      ) {
        throw new P10bLiveSynthesisAcceptanceError("malformed-state");
      }
      const stagingAggregate = aggregateWithDraft(
        fixture.aggregate,
        materialization.planningInput.draft,
      );
      if (canonicalValueFingerprint(stagingAggregate.catalogue) !== current.commerceFingerprint) {
        throw new P10bLiveSynthesisAcceptanceError("protected-commerce");
      }
      current.session.authoritativeRevision += 1;
      const metadata: P10bLiveSynthesisAcceptanceMetadata = {
        providerId: input.providerConfiguration.provider.id,
        modelId: input.providerConfiguration.modelId,
        providerCallCount: 1,
        directionId: result.direction.id,
        executableIntentId: validatedIntent.executableIntentId,
        executableIntentFingerprint: validatedIntent.executableIntentFingerprint,
        directionAuthorityFingerprint: result.direction.authorityFingerprint,
        directionFingerprint: result.directionFingerprint,
        synthesisFingerprint: result.decision.synthesisFingerprint,
        exactDiversityFingerprint: result.diversity.exactFingerprint,
        structuralDiversityFingerprint: result.diversity.structuralFingerprint,
        siteMapFingerprint: materialization.siteMapFingerprint,
        snapshotFingerprint: materialization.snapshotFingerprint,
        pageCount: materialization.snapshot.pages.length,
        pageFamilyCounts: pageFamilyCounts(materialization.snapshot),
        selectedProfileIds: [
          ...new Set(
            materialization.snapshot.pages.flatMap((page) =>
              page.pageFamily?.profileId ? [page.pageFamily.profileId] : [],
            ),
          ),
        ].sort((left, right) => left.localeCompare(right)),
        protectedCommerce: "unchanged",
        canonicalProductMedia: "unchanged",
        approvedAssets: "unchanged",
        validation: "valid",
      };
      current.session.generated = {
        proposal: clone(response.proposal),
        expectedSnapshot: clone(materialization.snapshot),
        reviewAggregate: clone(stagingAggregate),
        reviewBaselineFingerprint: canonicalStorefrontContentFingerprint(
          materialization.planningInput.draft,
        ),
        metadata,
      };
      current.session.generationStatus = "generated";
      safeDiagnostic({
        current,
        outcome: "success",
        providerId: input.providerConfiguration.provider.id,
        modelId: input.providerConfiguration.modelId,
        directionId: result.direction.id,
        executableIntentFingerprint: validatedIntent.executableIntentFingerprint,
      });
      return {
        ...clone(metadata),
        editorRoute: `/projects/${P10B16L_PROJECT_ID}/editor?p10b-16l-session=${encodeURIComponent(current.session.id)}`,
      };
    } catch (error) {
      current.session.generationStatus = "failed";
      current.session.generated = null;
      const mapped = mapP10bLiveSynthesisGenerationError(error);
      safeDiagnostic({
        current,
        outcome: "failed",
        providerId: input.providerConfiguration.provider.id,
        modelId: input.providerConfiguration.modelId,
        directionId: selectedDirectionId,
        executableIntentFingerprint: selectedExecutableIntentFingerprint,
        failureCode: mapped.code,
        failureStage: generationStage,
      });
      throw mapped;
    }
  });
}

export async function inspectP10bLiveSynthesisAcceptance(
  environment: AcceptanceEnvironment = process.env,
) {
  const current = state(environment);
  const aggregate = await current.repository.get(P10B16L_PROJECT_ID);
  const rawDraft = current.rawAggregate.snapshots.find(
    ({ id }) => id === current.rawAggregate.project.draftSnapshotId,
  );
  if (!rawDraft) throw new P10bLiveSynthesisAcceptanceError("malformed-state");
  return {
    namespace: P10B_16L_LOCAL_ACCEPTANCE_NAMESPACE,
    projectId: P10B16L_PROJECT_ID,
    baselineFingerprint: current.baselineFingerprint,
    aggregateFingerprint: canonicalValueFingerprint(aggregate),
    authoritativeRevision: current.session.authoritativeRevision,
    generationStatus: current.session.generationStatus,
    providerCallCount: current.session.providerCallCount,
    rawPresentation: {
      pageCount: rawDraft.pages.length,
      sectionCount: rawDraft.pages.reduce((count, page) => count + page.sections.length, 0),
      hasSharedFrame: rawDraft.sharedFrame !== undefined,
      hasDesignDna: rawDraft.brandSystem.designDna !== undefined,
      hasPageFamilySelection: rawDraft.pages.some((page) => page.pageFamily !== undefined),
    },
    ...(current.session.generated ? { generation: clone(current.session.generated.metadata) } : {}),
  };
}

export async function resetP10bLiveSynthesisAcceptance(
  environment: AcceptanceEnvironment = process.env,
) {
  if (!isP10bLiveSynthesisAcceptanceConfigured(environment)) {
    throw new P10bLiveSynthesisAcceptanceError("unavailable");
  }
  globalThis.__veskifyP10b16lLiveSynthesisAcceptanceState = createState();
  return inspectP10bLiveSynthesisAcceptance(environment);
}

export function p10bLiveSynthesisAcceptanceSession(
  environment: AcceptanceEnvironment = process.env,
): { projectId: typeof P10B16L_PROJECT_ID; sessionId: string } {
  const current = state(environment);
  return { projectId: P10B16L_PROJECT_ID, sessionId: current.session.id };
}

export function loadP10bLiveSynthesisEditorSession(input: {
  projectId: string;
  sessionId: string;
  environment?: AcceptanceEnvironment;
}): Promise<{
  kind: "p10b-16l";
  aggregate: ProjectAggregate;
  proposal: AiStorefrontProposal | null;
  sessionId: string;
  authoritativeRevision: number;
  baselineFingerprint: string;
  evidenceReferences: readonly PageFactEvidenceReference[];
  rawDraft: StorefrontSnapshot;
  reviewBaselineFingerprint: string | null;
  persistedAggregate: ProjectAggregate;
} | null> {
  const current = state(input.environment ?? process.env);
  try {
    assertSession(current, input.projectId, input.sessionId);
  } catch {
    return Promise.resolve(null);
  }
  const fixture = createP10B16LRawKarvonenAcceptanceFixture();
  const generated = current.session.generated;
  return Promise.resolve({
    kind: "p10b-16l",
    aggregate: clone(generated?.reviewAggregate ?? current.savedAggregate),
    proposal: clone(generated?.proposal ?? null),
    sessionId: current.session.id,
    authoritativeRevision: current.session.authoritativeRevision,
    baselineFingerprint: current.baselineFingerprint,
    evidenceReferences: clone(fixture.approvedEvidenceReferences),
    rawDraft: clone(fixture.rawDraft),
    reviewBaselineFingerprint: generated?.reviewBaselineFingerprint ?? null,
    persistedAggregate: clone(current.savedAggregate),
  });
}

export function loadP10bLiveSynthesisPreviewSession(input: {
  projectId: string;
  sessionId: string;
  environment?: AcceptanceEnvironment;
}): Promise<{
  aggregate: ProjectAggregate;
  sessionId: string;
  evidenceReferences: readonly PageFactEvidenceReference[];
} | null> {
  const current = state(input.environment ?? process.env);
  try {
    assertSession(current, input.projectId, input.sessionId);
  } catch {
    return Promise.resolve(null);
  }
  if (
    current.session.generationStatus !== "accepted" ||
    current.session.generated !== null ||
    !current.session.hasExplicitSave
  ) {
    return Promise.resolve(null);
  }
  const fixture = createP10B16LRawKarvonenAcceptanceFixture();
  return Promise.resolve({
    aggregate: clone(current.savedAggregate),
    sessionId: current.session.id,
    evidenceReferences: clone(fixture.approvedEvidenceReferences),
  });
}

export async function acceptP10bLiveSynthesisProposal(input: {
  projectId: string;
  sessionId: string;
  proposalId: string;
  expectedRevision: number;
  acceptedSnapshot: unknown;
  environment?: AcceptanceEnvironment;
}): Promise<{ authoritativeRevision: number; aggregateFingerprint: string }> {
  const current = state(input.environment ?? process.env);
  return serialized(current, async () => {
    assertSession(current, input.projectId, input.sessionId);
    const generated = current.session.generated;
    if (
      current.session.generationStatus !== "generated" ||
      !generated ||
      input.proposalId !== generated.proposal.id ||
      input.expectedRevision !== current.session.authoritativeRevision
    ) {
      throw new P10bLiveSynthesisAcceptanceError("stale");
    }
    let accepted: StorefrontSnapshot;
    const aggregate = await current.repository.get(input.projectId);
    const aggregateDraft = aggregate.snapshots.find(
      ({ id }) => id === aggregate.project.draftSnapshotId,
    );
    if (!aggregateDraft) throw new P10bLiveSynthesisAcceptanceError("malformed-state");
    try {
      accepted = storefrontSnapshotSchema.parse(clone(input.acceptedSnapshot));
      if (
        accepted.id !== aggregate.project.draftSnapshotId ||
        generated.expectedSnapshot.id !== aggregate.project.draftSnapshotId ||
        canonicalValueString(accepted) !== canonicalValueString(generated.expectedSnapshot)
      ) {
        throw new Error("Accepted snapshot mismatch.");
      }
    } catch {
      throw new P10bLiveSynthesisAcceptanceError("invalid");
    }
    try {
      await current.repository.saveDraft(input.projectId, accepted, {
        id: aggregate.project.draftSnapshotId,
        revision: aggregateDraft.revision,
      });
    } catch {
      throw new P10bLiveSynthesisAcceptanceError("invalid");
    }
    const committed = await current.repository.get(input.projectId);
    current.session.authoritativeRevision += 1;
    current.session.generated = null;
    current.session.generationStatus = "accepted";
    const aggregateFingerprint = canonicalValueFingerprint(committed);
    return { authoritativeRevision: current.session.authoritativeRevision, aggregateFingerprint };
  });
}

export async function synchronizeP10bLiveSynthesisAggregate(input: {
  projectId: string;
  sessionId: string;
  expectedRevision: number;
  mode: "active" | "saved";
  aggregate: unknown;
  environment?: AcceptanceEnvironment;
}): Promise<{ authoritativeRevision: number; aggregateFingerprint: string }> {
  const current = state(input.environment ?? process.env);
  return serialized(current, async () => {
    assertSession(current, input.projectId, input.sessionId);
    if (input.expectedRevision !== current.session.authoritativeRevision) {
      throw new P10bLiveSynthesisAcceptanceError("stale");
    }
    if (current.session.generationStatus !== "accepted" || current.session.generated !== null) {
      throw new P10bLiveSynthesisAcceptanceError("stale");
    }
    let aggregate: ProjectAggregate;
    try {
      aggregate = validateProjectAggregate(clone(input.aggregate) as ProjectAggregate);
    } catch {
      throw new P10bLiveSynthesisAcceptanceError("invalid");
    }
    if (aggregate.project.id !== P10B16L_PROJECT_ID) {
      throw new P10bLiveSynthesisAcceptanceError("unauthorized");
    }
    if (canonicalValueFingerprint(aggregate.catalogue) !== current.commerceFingerprint) {
      throw new P10bLiveSynthesisAcceptanceError("protected-commerce");
    }
    const currentAggregate = await current.repository.get(input.projectId);
    const fixture = createP10B16LRawKarvonenAcceptanceFixture();
    const { currentDraft, nextDraft } = assertSynchronizedAggregateAuthority({
      current: currentAggregate,
      next: aggregate,
      mode: input.mode,
      evidenceReferences: fixture.approvedEvidenceReferences,
    });
    const stagingRepository = new InMemoryProjectRepository([currentAggregate]);
    try {
      await stagingRepository.saveDraft(input.projectId, nextDraft, {
        id: currentDraft.id,
        revision: currentDraft.revision,
      });
    } catch {
      throw new P10bLiveSynthesisAcceptanceError("invalid");
    }
    const committed = await stagingRepository.get(input.projectId);
    current.repository = stagingRepository;
    if (input.mode === "saved") {
      current.savedAggregate = clone(committed);
      current.session.hasExplicitSave = true;
    }
    current.session.authoritativeRevision += 1;
    current.session.generated = null;
    const aggregateFingerprint = canonicalValueFingerprint(committed);
    return { authoritativeRevision: current.session.authoritativeRevision, aggregateFingerprint };
  });
}

export async function rejectP10bLiveSynthesisProposal(input: {
  projectId: string;
  sessionId: string;
  proposalId: string;
  expectedRevision: number;
  environment?: AcceptanceEnvironment;
}): Promise<{ authoritativeRevision: number; aggregateFingerprint: string }> {
  const current = state(input.environment ?? process.env);
  return serialized(current, async () => {
    assertSession(current, input.projectId, input.sessionId);
    const generated = current.session.generated;
    if (
      current.session.generationStatus !== "generated" ||
      !generated ||
      input.proposalId !== generated.proposal.id ||
      input.expectedRevision !== current.session.authoritativeRevision
    ) {
      throw new P10bLiveSynthesisAcceptanceError("stale");
    }
    const aggregate = await current.repository.get(input.projectId);
    if (
      canonicalValueFingerprint(aggregate) !== current.baselineFingerprint ||
      canonicalValueString(aggregate) !== canonicalValueString(current.rawAggregate)
    ) {
      throw new P10bLiveSynthesisAcceptanceError("stale");
    }
    current.session.generated = null;
    current.session.generationStatus = "rejected";
    current.session.authoritativeRevision += 1;
    return {
      authoritativeRevision: current.session.authoritativeRevision,
      aggregateFingerprint: canonicalValueFingerprint(aggregate),
    };
  });
}
