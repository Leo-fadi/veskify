import { z } from "zod";
import {
  type AiStorefrontProviderResponse,
  type AiStorefrontProviderRequest,
  AiStorefrontProviderValidationError,
  aiStorefrontProviderRequestSchema,
  buildAiStorefrontProviderRequest,
  validateAiStorefrontProviderResponse,
} from "@/application/ai-storefront-generation";
import {
  createAiStorefrontBaselineFingerprint,
  projectAiStorefrontSnapshot,
} from "@/application/ai-storefront";
import {
  requestWholeStorefrontGenerationPlan,
  WholeStorefrontPlanningProviderError,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
  type WholeStorefrontPlanningProvider,
} from "@/application/whole-storefront-generation-plan";
import {
  createMerchantProjectAuthorization,
  requireMerchantProjectAction,
  type MerchantProjectAuthorization,
} from "@/application/merchant-project-context";
import { VeskoIntegrationError } from "@/application/vesko-integration";
import { createStandaloneMerchantProjectContextPort } from "@/application/merchant-project-context";
import { createDeterministicMockStorefrontAIProvider } from "@/application/ai-storefront-generation";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import { storefrontSnapshotSchema, type StorefrontSnapshot } from "@/domain/storefront";
import {
  InMemoryProjectRepository,
  ProjectNotFoundError,
  type ProjectRepository,
} from "@/services/storage";

export class ServerWholeStorefrontAuthorityError extends Error {
  constructor(readonly code: "unauthorized" | "stale" | "unavailable" | "invalid") {
    super("The storefront planning request is unavailable.");
    this.name = "ServerWholeStorefrontAuthorityError";
  }
}

export type ServerWholeStorefrontPlanningContext = Readonly<{
  authorization: MerchantProjectAuthorization;
  planningInput: WholeStorefrontPlanningInput;
  currentPlanningInput: () => WholeStorefrontPlanningInput;
  proposalEnvelope: (
    request: AiStorefrontProviderRequest,
    plan: WholeStorefrontGenerationPlan,
  ) => Promise<unknown>;
  recordValidatedProposal?: (response: AiStorefrontProviderResponse) => void;
}>;

export interface ServerWholeStorefrontPlanningAuthority {
  resolve(
    request: AiStorefrontProviderRequest,
    httpRequest: Request,
  ): Promise<ServerWholeStorefrontPlanningContext>;
}

const responseSchema = z.object({ ok: z.literal(true), proposal: z.unknown() }).strict();

function response(status: number, body: unknown) {
  return Response.json(body, { status });
}

const runtimeProviderId = "server-whole-storefront-planning";

function authoritativeRequest(
  planningInput: WholeStorefrontPlanningInput,
  intent: AiStorefrontProviderRequest,
): AiStorefrontProviderRequest {
  const draft = planningInput.draft;
  return buildAiStorefrontProviderRequest(
    {
      projectId: planningInput.project.id,
      draftSnapshotId: draft.id,
      draftRevision: draft.revision,
      storefront: projectAiStorefrontSnapshot(draft),
      affectedPageIds: draft.pages.map((page) => page.id),
      affectedSectionTargets: [],
      designSystemTarget: { kind: "storefrontDesignSystem", projectId: planningInput.project.id },
      merchantInstruction: intent.instruction,
      activeLocale: intent.activeLocale,
      enabledLocales: planningInput.project.enabledLocales,
      requestedScope: "storefront",
      capability: "approvedColorTypographyDirection",
      providerId: runtimeProviderId,
      provider: {
        id: runtimeProviderId,
        assetReferenceCapability: "structuredApprovedAssets",
        proposeStorefront: () => Promise.reject(new Error("Server provider only")),
      },
      importedContent: [],
    },
    intent.requestSequence,
  );
}

function sameRequestPreconditions(
  intent: AiStorefrontProviderRequest,
  authoritative: AiStorefrontProviderRequest,
) {
  return (
    intent.target.projectId === authoritative.target.projectId &&
    intent.target.draftSnapshotId === authoritative.target.draftSnapshotId &&
    intent.target.draftRevision === authoritative.target.draftRevision &&
    intent.activeLocale === authoritative.activeLocale &&
    intent.storefrontBaselineFingerprint === authoritative.storefrontBaselineFingerprint &&
    intent.targetFingerprint === authoritative.targetFingerprint &&
    intent.permissionFingerprint === authoritative.permissionFingerprint &&
    JSON.stringify(intent.target) === JSON.stringify(authoritative.target) &&
    JSON.stringify(intent.permissionGrants) === JSON.stringify(authoritative.permissionGrants)
  );
}

function failure(error: unknown): Response {
  if (error instanceof AiStorefrontProviderValidationError) {
    return response(400, { ok: false, failure: { category: "validation", retryable: false } });
  }
  if (error instanceof VeskoIntegrationError && error.code === "permissionDenied") {
    return response(401, {
      ok: false,
      failure: { category: "permissionDenied", retryable: false },
    });
  }
  if (error instanceof WholeStorefrontPlanningProviderError) {
    if (error.code === "stale-result") {
      return response(409, { ok: false, failure: { category: "stale", retryable: false } });
    }
    if (error.code === "invalid-request" || error.code === "invalid-plan") {
      return response(400, { ok: false, failure: { category: "validation", retryable: false } });
    }
  }
  if (error instanceof ServerWholeStorefrontAuthorityError) {
    if (error.code === "unauthorized") {
      return response(401, {
        ok: false,
        failure: { category: "permissionDenied", retryable: false },
      });
    }
    if (error.code === "stale") {
      return response(409, { ok: false, failure: { category: "stale", retryable: false } });
    }
    if (error.code === "invalid") {
      return response(400, { ok: false, failure: { category: "validation", retryable: false } });
    }
  }
  return response(503, {
    ok: false,
    failure: { category: "providerUnavailable", retryable: true },
  });
}

/**
 * Executes the P8 canonical plan on the server, then returns the existing
 * editor proposal envelope. The envelope factory is deliberately server-side:
 * clients cannot choose authorities, planning input, or provider credentials.
 */
export function createServerWholeStorefrontPlanningHandler({
  authority,
  selectProvider,
}: {
  authority: ServerWholeStorefrontPlanningAuthority;
  selectProvider: () => WholeStorefrontPlanningProvider;
}) {
  return async function POST(httpRequest: Request): Promise<Response> {
    let request: AiStorefrontProviderRequest;
    try {
      request = aiStorefrontProviderRequestSchema.parse(await httpRequest.json());
    } catch {
      return response(400, {
        ok: false,
        failure: { category: "validation", retryable: false },
      });
    }

    try {
      const context = await authority.resolve(request, httpRequest);
      requireMerchantProjectAction(
        createMerchantProjectAuthorization(context.authorization.context),
        "request-ai-design",
      );
      const canonicalRequest = authoritativeRequest(context.planningInput, request);
      if (!sameRequestPreconditions(request, canonicalRequest)) {
        throw new ServerWholeStorefrontAuthorityError("stale");
      }
      const plan = await requestWholeStorefrontGenerationPlan({
        provider: selectProvider(),
        input: context.planningInput,
        currentInput: context.currentPlanningInput,
      });
      const envelope = validateAiStorefrontProviderResponse(
        canonicalRequest,
        await context.proposalEnvelope(canonicalRequest, plan),
      );
      context.recordValidatedProposal?.(envelope);
      return response(200, responseSchema.parse({ ok: true, proposal: envelope }));
    } catch (error) {
      return failure(error);
    }
  };
}

export const unavailableServerWholeStorefrontPlanningAuthority: ServerWholeStorefrontPlanningAuthority =
  {
    resolve: () => Promise.reject(new ServerWholeStorefrontAuthorityError("unavailable")),
  };

function standalonePlanningBrief(
  aggregate: Awaited<ReturnType<ProjectRepository["get"]>>,
  actorId: string,
) {
  const now = aggregate.project.updatedAt;
  return approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: `brief_${aggregate.project.id}_standalone`,
      now,
      businessIdentity: { businessName: aggregate.project.name },
      languagePlan: {
        selectedLanguages: aggregate.project.enabledLocales,
        primaryLanguage: aggregate.project.primaryLocale,
      },
      sourceReferenceIds: [],
      sourceEvidenceIds: [],
      materialEvidence: {
        sourceReferences: [],
        evidence: [],
        assetCandidates: [],
        reconciliation: null,
      },
      canonicalCommerceProjectionRef: aggregate.catalogue.id,
      pagePlan: { pageTypes: aggregate.snapshots[0]?.pages.map((page) => page.type) ?? [] },
      approvedBrandDirection: {
        logoAssetRef: { id: `asset_${aggregate.project.id}_logo`, label: aggregate.project.name },
        supportingImageAssetRefs: [],
        preferredBrandColours: [aggregate.snapshots[0]?.brandSystem.colors.primary ?? "#111111"],
        typographyDirection: "serif-led",
        visualStyleDirection: "editorial",
        imageryDirection: "studio",
        toneKeywords: ["warm"],
      },
    }),
    { actorId, approvedAt: now },
  );
}

export function createStandaloneServerWholeStorefrontPlanningAuthority({
  repository = new InMemoryProjectRepository([
    {
      project: aurumNordicSeed.project,
      catalogue: aurumNordicSeed.catalogue,
      snapshots: [aurumNordicSeed.publishedSnapshot, aurumNordicSeed.draftSnapshot],
    },
    {
      project: karvonenSeed.project,
      catalogue: karvonenSeed.catalogue,
      snapshots: [karvonenSeed.publishedSnapshot, karvonenSeed.draftSnapshot],
    },
  ]),
  identity = {
    tenantId: "tenant_standalone",
    userId: "user_standalone",
    merchantId: "merchant_standalone",
    organizationId: "organization_standalone",
    storeId: "store_standalone",
  },
}: {
  repository?: ProjectRepository;
  identity?: {
    tenantId: string;
    userId: string;
    merchantId: string;
    organizationId: string;
    storeId: string;
  };
} = {}): ServerWholeStorefrontPlanningAuthority {
  const validatedDraftCandidates = new Map<string, StorefrontSnapshot>();
  const candidateKey = (projectId: string, baselineFingerprint: string) =>
    `${projectId}:${baselineFingerprint}`;

  return {
    async resolve(request) {
      let aggregate: Awaited<ReturnType<ProjectRepository["get"]>>;
      try {
        aggregate = await repository.get(request.target.projectId);
      } catch (error) {
        if (error instanceof ProjectNotFoundError)
          throw new ServerWholeStorefrontAuthorityError("invalid");
        throw new ServerWholeStorefrontAuthorityError("unavailable");
      }
      const seededDraft = aggregate.snapshots.find(
        (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
      );
      if (!seededDraft) throw new ServerWholeStorefrontAuthorityError("invalid");
      const draft =
        validatedDraftCandidates.get(
          candidateKey(request.target.projectId, request.storefrontBaselineFingerprint),
        ) ?? seededDraft;
      const context = await createStandaloneMerchantProjectContextPort({
        projectRepository: repository,
        ...identity,
      }).load({ tenantId: identity.tenantId, storefrontProjectId: aggregate.project.id });
      const authorization = createMerchantProjectAuthorization(context);
      const planningInput = {
        brief: standalonePlanningBrief(aggregate, context.userId),
        project: {
          id: aggregate.project.id,
          revision: aggregate.project.revision,
          enabledLocales: aggregate.project.enabledLocales,
        },
        draft,
        catalogue: aggregate.catalogue,
        componentDefinitions: veskifyComponentDefinitionsV2.map((definition) =>
          structuredClone(definition),
        ),
        approvedAssetContext: null,
        requiredAssetPlacements: [],
      } satisfies WholeStorefrontPlanningInput;
      return {
        authorization,
        planningInput,
        currentPlanningInput: () => structuredClone(planningInput),
        proposalEnvelope: async (proposalRequest) => {
          const response =
            await createDeterministicMockStorefrontAIProvider().proposeStorefront(proposalRequest);
          return {
            ...response,
            providerId: proposalRequest.providerId,
          };
        },
        recordValidatedProposal: (response) => {
          const proposed = response.proposal.proposedStorefront;
          const proposedPages = new Map(proposed.pages.map((page) => [page.id, page]));
          const candidate = storefrontSnapshotSchema.parse({
            ...draft,
            brandSystem: proposed.brandSystem,
            navigation: proposed.navigation,
            pages: proposed.pageOrder.map((pageId) => proposedPages.get(pageId)),
          });
          const baselineFingerprint = createAiStorefrontBaselineFingerprint({
            projectId: candidate.projectId,
            draftSnapshotId: candidate.id,
            draftRevision: candidate.revision,
            enabledLocales: aggregate.project.enabledLocales,
            activeLocale: request.activeLocale,
            storefront: proposed,
          });
          validatedDraftCandidates.set(
            candidateKey(candidate.projectId, baselineFingerprint),
            candidate,
          );
        },
      };
    },
  };
}
