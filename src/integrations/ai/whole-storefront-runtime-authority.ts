import { z } from "zod";
import {
  type AiStorefrontProviderResponse,
  type AiStorefrontProviderRequest,
  AiStorefrontProviderValidationError,
  aiStorefrontProviderRequestSchema,
  buildAiStorefrontProviderRequest,
  createApprovedGenerationAssetContextFingerprint,
  approvedGenerationAssetContextSchema,
  validateAiStorefrontProviderResponse,
} from "@/application/ai-storefront-generation";
import {
  createAiStorefrontProposalId,
  type AiStorefrontOperation,
} from "@/application/ai-storefront";
import { compileWholeStorefrontProposal } from "@/application/whole-storefront-proposal-lifecycle";
import { validateDesignOperationAgainstPage } from "@/application/design-operations";
import {
  createStorefrontDesignSystemOperations,
  createStorefrontStyleOperations,
  type StorefrontStyleDirection,
} from "@/application/design-skills";
import {
  createAiStorefrontBaselineFingerprint,
  projectAiStorefrontSnapshot,
} from "@/application/ai-storefront";
import {
  createWholeStorefrontRecipeContext,
  requestWholeStorefrontGenerationPlan,
  WholeStorefrontPlanningProviderError,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
  type WholeStorefrontPlanningProvider,
  wholeStorefrontPlanningInputSchema,
} from "@/application/whole-storefront-generation-plan";
import {
  createMerchantProjectAuthorization,
  requireMerchantProjectAction,
  type MerchantProjectAuthorization,
} from "@/application/merchant-project-context";
import { VeskoIntegrationError } from "@/application/vesko-integration";
import { createStandaloneMerchantProjectContextPort } from "@/application/merchant-project-context";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import {
  componentDefinitionV2Schema,
  createComponentRegistryV2,
  type ComponentDefinitionV2,
} from "@/domain/component-platform";
import {
  storefrontDesignBriefContractSchema,
  type StorefrontDesignBriefContract,
} from "@/domain/source-discovery";
import type { Locale } from "@/domain/shared";
import { storefrontSnapshotSchema, type StorefrontSnapshot } from "@/domain/storefront";
import { canonicalValueFingerprint } from "@/domain/storefront";
import type { ApprovedGenerationAssetContext } from "@/application/ai-storefront-generation";
import {
  InMemoryProjectRepository,
  ProjectNotFoundError,
  type ProjectRepository,
} from "@/services/storage";

export type ServerWholeStorefrontAuthorityErrorCode =
  | "unauthorized"
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

export type ServerWholeStorefrontPlanningContext = Readonly<{
  authorization: MerchantProjectAuthorization;
  planningInput: WholeStorefrontPlanningInput;
  currentPlanningInput: () => WholeStorefrontPlanningInput | Promise<WholeStorefrontPlanningInput>;
  proposalEnvelope: (
    request: AiStorefrontProviderRequest,
    plan: WholeStorefrontGenerationPlan,
  ) => Promise<unknown>;
  recordValidatedProposal?: (response: AiStorefrontProviderResponse) => void;
  requiresAuthoritativePlanningFingerprint?: boolean;
}>;

export interface ServerWholeStorefrontPlanningAuthority {
  resolve(
    request: AiStorefrontProviderRequest,
    httpRequest: Request,
  ): Promise<ServerWholeStorefrontPlanningContext>;
}

export type AuthoritativeWholeStorefrontPlanningContext = Readonly<{
  brief: StorefrontDesignBriefContract;
  componentDefinitions: readonly ComponentDefinitionV2[];
  approvedAssetContext: ApprovedGenerationAssetContext | null;
}>;

/**
 * Server-only ownership boundary for the project-approved planning context.
 * It intentionally accepts no browser brief, registry, recipe, or asset data.
 */
export interface AuthoritativeWholeStorefrontPlanningContextSource {
  load(input: {
    projectId: string;
    catalogueId: string;
    enabledLocales: readonly Locale[];
    requestedLocale: Locale;
  }):
    | Promise<AuthoritativeWholeStorefrontPlanningContext>
    | AuthoritativeWholeStorefrontPlanningContext;
}

function validatedAuthoritativePlanningContext(
  context: AuthoritativeWholeStorefrontPlanningContext,
  input: Parameters<AuthoritativeWholeStorefrontPlanningContextSource["load"]>[0],
): AuthoritativeWholeStorefrontPlanningContext {
  const brief = storefrontDesignBriefContractSchema.safeParse(context.brief);
  if (!brief.success || brief.data.status !== "approved") {
    throw new ServerWholeStorefrontAuthorityError("invalid-brief");
  }
  if (brief.data.canonicalCommerceProjectionRef !== input.catalogueId) {
    throw new ServerWholeStorefrontAuthorityError("project-draft-mismatch");
  }
  if (
    !input.enabledLocales.includes(input.requestedLocale) ||
    !brief.data.languagePlan.selectedLanguages.includes(input.requestedLocale)
  ) {
    throw new ServerWholeStorefrontAuthorityError("unsupported-locale");
  }
  let componentDefinitions: ComponentDefinitionV2[];
  try {
    componentDefinitions = context.componentDefinitions.map((definition) =>
      componentDefinitionV2Schema.parse(definition),
    );
    createComponentRegistryV2(componentDefinitions);
  } catch {
    throw new ServerWholeStorefrontAuthorityError("registry-mismatch");
  }
  let approvedAssetContext: ApprovedGenerationAssetContext | null;
  try {
    approvedAssetContext =
      context.approvedAssetContext === null
        ? null
        : approvedGenerationAssetContextSchema.parse(context.approvedAssetContext);
  } catch {
    throw new ServerWholeStorefrontAuthorityError("invalid-asset-reference");
  }
  if (
    approvedAssetContext !== null &&
    (approvedAssetContext.briefId !== brief.data.id ||
      approvedAssetContext.briefRevision !== brief.data.revision ||
      approvedAssetContext.approvedEvidenceFingerprint !== brief.data.approvedEvidenceFingerprint)
  ) {
    throw new ServerWholeStorefrontAuthorityError("invalid-asset-reference");
  }
  const assignments = new Map(
    brief.data.approvedAssetAssignments.map((assignment) => [assignment.assetId, assignment]),
  );
  const assets = approvedAssetContext?.assets ?? [];
  if (
    (!brief.data.generationPermissions.allowAssetReuse && assets.length > 0) ||
    (brief.data.generationPermissions.allowAssetReuse && assets.length !== assignments.size)
  ) {
    throw new ServerWholeStorefrontAuthorityError("invalid-asset-reference");
  }
  const seenAssetIds = new Set<string>();
  assets.forEach((asset) => {
    const assignment = assignments.get(asset.assetId);
    if (
      seenAssetIds.has(asset.assetId) ||
      !assignment ||
      assignment.role !== asset.role ||
      assignment.revision !== asset.revision ||
      assignment.fingerprint !== asset.materialFingerprint ||
      !brief.data.sourceReferenceIds.includes(asset.sourceReferenceId) ||
      asset.role === "productMainImage" ||
      asset.role === "productAlternativeImage"
    ) {
      throw new ServerWholeStorefrontAuthorityError("invalid-asset-reference");
    }
    seenAssetIds.add(asset.assetId);
  });
  return {
    brief: structuredClone(brief.data),
    componentDefinitions: structuredClone(componentDefinitions),
    approvedAssetContext:
      approvedAssetContext === null ? null : structuredClone(approvedAssetContext),
  };
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
      correlationRequestId: intent.requestId,
      importedContent: [],
      approvedAssetContext: planningInput.approvedAssetContext,
      assetPlacementOperations: planningInput.requiredAssetPlacements,
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

function directionForPlan(plan: WholeStorefrontGenerationPlan): StorefrontStyleDirection {
  return plan.sharedDesignDirection.visualStyleDirection === "minimal"
    ? "minimalNordic"
    : "warmPremium";
}

function projectPlanOperations(
  request: AiStorefrontProviderRequest,
  plan: WholeStorefrontGenerationPlan,
  wholeStorefrontProposal: ReturnType<typeof compileWholeStorefrontProposal>,
): {
  operations: AiStorefrontOperation[];
  proposedStorefront: AiStorefrontProviderRequest["storefront"];
  affectedDesignState: {
    colors?: typeof request.storefront.brandSystem.colors;
    typography?: typeof request.storefront.brandSystem.typography;
  } | null;
} {
  const direction = directionForPlan(plan);
  const operations: AiStorefrontOperation[] = [];
  const add = (
    target: AiStorefrontOperation["target"],
    operation: AiStorefrontOperation["operation"],
  ) => operations.push({ order: operations.length, target, operation });
  if (request.target.designSystemTarget !== null) {
    createStorefrontDesignSystemOperations(direction).forEach((operation) =>
      add(request.target.designSystemTarget!, operation),
    );
  }
  wholeStorefrontProposal.proposedStorefront.pages.forEach((plannedPage) => {
    if (!request.target.affectedPageIds.includes(plannedPage.pageId)) return;
    const currentPage = request.affectedPages.find((page) => page.id === plannedPage.pageId);
    const plannedSectionIds = plannedPage.components.map((component) => component.id);
    const currentSectionIds = currentPage?.sections.map((section) => section.id) ?? [];
    if (
      currentPage &&
      plannedSectionIds.length === currentSectionIds.length &&
      plannedSectionIds.every((sectionId) => currentSectionIds.includes(sectionId)) &&
      plannedSectionIds.some((sectionId, index) => sectionId !== currentSectionIds[index])
    ) {
      add(
        { kind: "page", pageId: plannedPage.pageId },
        { type: "REORDER_SECTIONS", sectionIds: plannedSectionIds },
      );
    }
  });
  const planPages = new Set(plan.pagePlans.map((page) => page.pageId));
  const sectionTargets = new Set(
    request.target.affectedSectionTargets.map((target) => `${target.pageId}:${target.sectionId}`),
  );
  request.target.affectedPageIds.forEach((pageId) => {
    if (!planPages.has(pageId)) return;
    const page = request.affectedPages.find((candidate) => candidate.id === pageId);
    if (!page) return;
    createStorefrontStyleOperations(page, direction).forEach((operation) => {
      if (!("sectionId" in operation) || !sectionTargets.has(`${pageId}:${operation.sectionId}`))
        return;
      add({ kind: "section", pageId, sectionId: operation.sectionId }, operation);
    });
  });
  const proposedStorefront = structuredClone(request.storefront);
  let affectedDesignState: {
    colors?: typeof request.storefront.brandSystem.colors;
    typography?: typeof request.storefront.brandSystem.typography;
  } | null = null;
  operations.forEach((envelope) => {
    if (envelope.operation.type === "APPLY_APPROVED_BRAND_COLOURS") {
      proposedStorefront.brandSystem.colors = structuredClone(envelope.operation.colors);
      affectedDesignState = {
        ...(affectedDesignState ?? {}),
        colors: structuredClone(envelope.operation.colors),
      };
      return;
    }
    if (envelope.operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY") {
      proposedStorefront.brandSystem.typography = structuredClone(envelope.operation.typography);
      affectedDesignState = {
        ...(affectedDesignState ?? {}),
        typography: structuredClone(envelope.operation.typography),
      };
      return;
    }
    const target = envelope.target;
    if (!("pageId" in target)) return;
    const index = proposedStorefront.pages.findIndex((page) => page.id === target.pageId);
    if (index < 0) throw new ServerWholeStorefrontAuthorityError("malformed-state");
    proposedStorefront.pages[index] = validateDesignOperationAgainstPage(
      proposedStorefront.pages[index],
      envelope.operation,
    );
  });
  return { operations, proposedStorefront, affectedDesignState };
}

function planDerivedProposalEnvelope(input: {
  request: AiStorefrontProviderRequest;
  plan: WholeStorefrontGenerationPlan;
  planningInput: WholeStorefrontPlanningInput;
}): AiStorefrontProviderResponse {
  const wholeStorefrontProposal = compileWholeStorefrontProposal({
    plan: input.plan,
    planningInput: input.planningInput,
  });
  const { operations, proposedStorefront, affectedDesignState } = projectPlanOperations(
    input.request,
    input.plan,
    wholeStorefrontProposal,
  );
  const proposalId = createAiStorefrontProposalId(
    input.request.requestId,
    input.request.targetFingerprint,
    input.request.permissionFingerprint,
    operations,
    input.plan.approvedAssetPlacements,
  );
  return {
    providerRequestId: input.request.requestId,
    providerId: input.request.providerId,
    proposal: {
      id: proposalId,
      requestId: input.request.requestId,
      projectId: input.request.target.projectId,
      draftSnapshotId: input.request.target.draftSnapshotId,
      draftRevision: input.request.target.draftRevision,
      target: structuredClone(input.request.target),
      originalStorefront: structuredClone(input.request.storefront),
      proposedStorefront,
      affectedPages: structuredClone(input.request.affectedPages),
      affectedDesignState,
      permissionGrants: structuredClone(input.request.permissionGrants),
      targetFingerprint: input.request.targetFingerprint,
      permissionFingerprint: input.request.permissionFingerprint,
      operations,
      assetPlacementOperations: structuredClone(input.plan.approvedAssetPlacements),
      summary: {
        en: `Prepared from approved whole-storefront plan ${wholeStorefrontProposal.id}. ${input.plan.reviewSummary.sharedDesignSystemChanges.join(" ")}`,
        fi: `Valmisteltu hyväksytystä koko kaupan suunnitelmasta ${wholeStorefrontProposal.id}. ${input.plan.reviewSummary.sharedDesignSystemChanges.join(" ")}`,
      },
      validation: { valid: true, errors: [] },
      status: "pending",
    },
    metadata: {
      operationCount: operations.length,
      durationMs: 0,
      validation: "valid",
      authoritativePlanningFingerprint: input.plan.fingerprint,
      wholeStorefrontProposalFingerprint: canonicalValueFingerprint(wholeStorefrontProposal),
    },
  };
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
    if (
      [
        "invalid",
        "invalid-brief",
        "registry-mismatch",
        "invalid-asset-reference",
        "unsupported-locale",
        "project-draft-mismatch",
        "malformed-state",
      ].includes(error.code)
    ) {
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
      if (
        context.requiresAuthoritativePlanningFingerprint &&
        envelope.metadata.authoritativePlanningFingerprint !== plan.fingerprint
      ) {
        throw new ServerWholeStorefrontAuthorityError("malformed-state");
      }
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

type StandaloneBriefDefinition = Readonly<{
  business: Readonly<{
    industry: "jewellery";
    targetCustomer: string;
    primaryMarket: string;
  }>;
  typographyDirection: "serif-led" | "sans-led" | "mixed" | "strong" | "soft";
  visualStyleDirection: "minimal" | "editorial" | "luxury" | "playful" | "bold" | "natural";
  imageryDirection: "studio" | "lifestyle" | "editorial" | "product-focused" | "mixed";
  toneKeywords: readonly (
    "elegant" | "modern" | "warm" | "bold" | "minimal" | "playful" | "technical"
  )[];
}>;

const standaloneBriefDefinitions: Readonly<Record<string, StandaloneBriefDefinition>> = {
  [aurumNordicSeed.project.id]: {
    business: {
      industry: "jewellery",
      targetCustomer: "Design-conscious Nordic jewellery customers.",
      primaryMarket: "Finland",
    },
    typographyDirection: "serif-led",
    visualStyleDirection: "editorial",
    imageryDirection: "studio",
    toneKeywords: ["elegant", "warm"],
  },
  [karvonenSeed.project.id]: {
    business: {
      industry: "jewellery",
      targetCustomer: "Customers choosing meaningful, lasting Finnish jewellery.",
      primaryMarket: "Finland",
    },
    typographyDirection: "serif-led",
    visualStyleDirection: "luxury",
    imageryDirection: "product-focused",
    toneKeywords: ["elegant", "warm"],
  },
};

function standaloneContextRecord(input: {
  project: typeof aurumNordicSeed.project;
  catalogue: typeof aurumNordicSeed.catalogue;
  draft: typeof aurumNordicSeed.draftSnapshot;
  definition: StandaloneBriefDefinition;
}): AuthoritativeWholeStorefrontPlanningContext {
  const { project, catalogue, draft, definition } = input;
  const now = new Date(project.updatedAt).toISOString();
  const sourceId = `source_${project.id}_approved`;
  const evidenceId = `evidence_${project.id}_identity`;
  const assetId = `asset_${project.id}_logo`;
  const assetRevision = "1:standalone-approved";
  const assetFingerprint = `asset-material-${project.id}`;
  const assetReviewFingerprint = `asset-review-${project.id}`;
  const sourceUrl = `https://${project.id}.example/logo.png`;
  const brief = approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: `brief_${project.id}_approved`,
      now,
      businessIdentity: {
        businessName: project.name,
        shortDescription: `${project.name} storefront presentation brief.`,
        ...definition.business,
      },
      languagePlan: {
        selectedLanguages: project.enabledLocales,
        primaryLanguage: project.primaryLocale,
      },
      sourceReferenceIds: [sourceId],
      sourceEvidenceIds: [evidenceId],
      materialEvidence: {
        sourceReferences: [
          {
            id: sourceId,
            sourceType: "deterministic-fixture",
            url: sourceUrl,
            normalizedOrigin: new URL(sourceUrl).origin,
            requestedLocale: project.primaryLocale,
            discoveredAt: now,
            allowedDiscoveryPolicy: {
              mode: "deterministic",
              maxPages: 1,
              maxAssets: 1,
              followSameOriginOnly: true,
            },
            status: "complete",
            warnings: [],
            failure: null,
          },
        ],
        evidence: [
          {
            id: evidenceId,
            kind: "page-identity",
            provenance: {
              sourceReferenceId: sourceId,
              sourceUrl,
              documentUrl: null,
              observedAt: now,
              extractionLocation: "standalone-fixture",
            },
            sourceUrl,
            confidence: 1,
            observedValue: { businessName: project.name },
            extractionMethod: "standalone-approved-fixture",
            locale: project.primaryLocale,
            warnings: [],
            uncertainty: { isUncertain: false, reason: null },
          },
        ],
        assetCandidates: [
          {
            id: assetId,
            role: "logo",
            source: { kind: "source-url", url: sourceUrl },
            dimensions: null,
            mediaType: "image/png",
            provenance: {
              sourceReferenceId: sourceId,
              sourceUrl,
              documentUrl: null,
              observedAt: now,
              extractionLocation: "merchant-upload",
            },
            confidence: 1,
            proposedReusePurpose: "Approved brand logo for storefront presentation.",
            licensingUsageConfirmation: "confirmed",
            warnings: [],
            uncertainty: { isUncertain: false, reason: null },
            fingerprint: { algorithm: "sha256", value: assetFingerprint },
            duplicateOfAssetId: null,
          },
        ],
        reconciliation: null,
      },
      canonicalCommerceProjectionRef: catalogue.id,
      approvedReusableAssetIds: [assetId],
      approvedAssetAssignments: [
        { assetId, role: "logo", revision: assetRevision, fingerprint: assetFingerprint },
      ],
      assetReviewFingerprint,
      pagePlan: { pageTypes: draft.pages.map((page) => page.type) },
      navigationDirection: ["Keep the existing primary and footer navigation identities."],
      homepageGoals: ["Present the approved brand direction before product discovery."],
      collectionPageGoals: ["Preserve canonical collection membership and discovery."],
      productPageGoals: ["Preserve canonical product options and product media."],
      visualPriorities: ["Use the approved brand palette and typography consistently."],
      excludedClaims: ["Do not invent commerce, delivery, guarantee, or material claims."],
      generationPermissions: { allowAssetReuse: true },
      approvedBrandDirection: {
        logoAssetRef: { id: assetId, label: `${project.name} logo` },
        supportingImageAssetRefs: [],
        preferredBrandColours: [draft.brandSystem.colors.primary],
        typographyDirection: definition.typographyDirection,
        visualStyleDirection: definition.visualStyleDirection,
        imageryDirection: definition.imageryDirection,
        toneKeywords: [...definition.toneKeywords],
      },
    }),
    { actorId: "user_standalone", approvedAt: now },
  );
  const assetContextInput = {
    briefId: brief.id,
    briefRevision: brief.revision,
    approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint!,
    assetReviewFingerprint,
    assets: [
      {
        assetId,
        role: "logo" as const,
        sourceReferenceId: sourceId,
        revision: assetRevision,
        materialFingerprint: assetFingerprint,
        provenance: { location: "merchant-upload" as const, observedAt: now },
        alt: null,
        presentation: { decorative: true, mediaType: "image/png", responsiveCrops: [] },
        approval: { actorId: "user_standalone", actorReference: "standalone-approved-brief" },
      },
    ],
  };
  return {
    brief: storefrontDesignBriefContractSchema.parse(brief),
    componentDefinitions: veskifyComponentDefinitionsV2.map((definition) =>
      componentDefinitionV2Schema.parse(definition),
    ),
    approvedAssetContext: approvedGenerationAssetContextSchema.parse({
      ...assetContextInput,
      fingerprint: createApprovedGenerationAssetContextFingerprint(assetContextInput),
    }),
  };
}

export function createStandaloneAuthoritativeWholeStorefrontPlanningContextSource(): AuthoritativeWholeStorefrontPlanningContextSource {
  const records = new Map<string, AuthoritativeWholeStorefrontPlanningContext>([
    [
      aurumNordicSeed.project.id,
      standaloneContextRecord({
        project: aurumNordicSeed.project,
        catalogue: aurumNordicSeed.catalogue,
        draft: aurumNordicSeed.draftSnapshot,
        definition: standaloneBriefDefinitions[aurumNordicSeed.project.id],
      }),
    ],
    [
      karvonenSeed.project.id,
      standaloneContextRecord({
        project: karvonenSeed.project,
        catalogue: karvonenSeed.catalogue,
        draft: karvonenSeed.draftSnapshot,
        definition: standaloneBriefDefinitions[karvonenSeed.project.id],
      }),
    ],
  ]);
  return {
    load(input) {
      const context = records.get(input.projectId);
      if (!context) throw new ServerWholeStorefrontAuthorityError("brief-unavailable");
      const brief = storefrontDesignBriefContractSchema.safeParse(context.brief);
      if (!brief.success || brief.data.status !== "approved") {
        throw new ServerWholeStorefrontAuthorityError("invalid-brief");
      }
      if (
        brief.data.canonicalCommerceProjectionRef !== input.catalogueId ||
        !input.enabledLocales.includes(input.requestedLocale) ||
        !brief.data.languagePlan.selectedLanguages.includes(input.requestedLocale)
      ) {
        throw new ServerWholeStorefrontAuthorityError(
          !input.enabledLocales.includes(input.requestedLocale) ||
            !brief.data.languagePlan.selectedLanguages.includes(input.requestedLocale)
            ? "unsupported-locale"
            : "project-draft-mismatch",
        );
      }
      try {
        const definitions = context.componentDefinitions.map((definition) =>
          componentDefinitionV2Schema.parse(definition),
        );
        createComponentRegistryV2(definitions);
        const assets =
          context.approvedAssetContext === null
            ? null
            : approvedGenerationAssetContextSchema.parse(context.approvedAssetContext);
        if (
          assets !== null &&
          (assets.briefId !== brief.data.id ||
            assets.briefRevision !== brief.data.revision ||
            assets.approvedEvidenceFingerprint !== brief.data.approvedEvidenceFingerprint)
        ) {
          throw new ServerWholeStorefrontAuthorityError("invalid-asset-reference");
        }
        return {
          brief: structuredClone(brief.data),
          componentDefinitions: structuredClone(definitions),
          approvedAssetContext: assets === null ? null : structuredClone(assets),
        };
      } catch (error) {
        if (error instanceof ServerWholeStorefrontAuthorityError) throw error;
        throw new ServerWholeStorefrontAuthorityError("registry-mismatch");
      }
    },
  };
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
  contextSource = createStandaloneAuthoritativeWholeStorefrontPlanningContextSource(),
}: {
  repository?: ProjectRepository;
  identity?: {
    tenantId: string;
    userId: string;
    merchantId: string;
    organizationId: string;
    storeId: string;
  };
  contextSource?: AuthoritativeWholeStorefrontPlanningContextSource;
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
      const context = await createStandaloneMerchantProjectContextPort({
        projectRepository: repository,
        ...identity,
      }).load({ tenantId: identity.tenantId, storefrontProjectId: aggregate.project.id });
      const authorization = createMerchantProjectAuthorization(context);
      const planningInputFor = async (): Promise<WholeStorefrontPlanningInput> => {
        let currentAggregate: Awaited<ReturnType<ProjectRepository["get"]>>;
        try {
          currentAggregate = await repository.get(request.target.projectId);
        } catch (error) {
          if (error instanceof ProjectNotFoundError)
            throw new ServerWholeStorefrontAuthorityError("project-draft-mismatch");
          throw new ServerWholeStorefrontAuthorityError("unavailable");
        }
        const seededDraft = currentAggregate.snapshots.find(
          (snapshot) => snapshot.id === currentAggregate.project.draftSnapshotId,
        );
        if (!seededDraft) throw new ServerWholeStorefrontAuthorityError("project-draft-mismatch");
        const draft =
          validatedDraftCandidates.get(
            candidateKey(request.target.projectId, request.storefrontBaselineFingerprint),
          ) ?? seededDraft;
        const contextRequest = {
          projectId: currentAggregate.project.id,
          catalogueId: currentAggregate.catalogue.id,
          enabledLocales: currentAggregate.project.enabledLocales,
          requestedLocale: request.activeLocale,
        };
        const authoritative = validatedAuthoritativePlanningContext(
          await contextSource.load(contextRequest),
          contextRequest,
        );
        try {
          return wholeStorefrontPlanningInputSchema.parse({
            brief: authoritative.brief,
            project: {
              id: currentAggregate.project.id,
              revision: currentAggregate.project.revision,
              enabledLocales: currentAggregate.project.enabledLocales,
            },
            draft,
            catalogue: currentAggregate.catalogue,
            componentDefinitions: authoritative.componentDefinitions,
            recipeContext: createWholeStorefrontRecipeContext(),
            approvedAssetContext: authoritative.approvedAssetContext,
            requiredAssetPlacements: [],
          });
        } catch (error) {
          if (error instanceof ServerWholeStorefrontAuthorityError) throw error;
          throw new ServerWholeStorefrontAuthorityError("malformed-state");
        }
      };
      const planningInput = await planningInputFor();
      return {
        authorization,
        planningInput,
        currentPlanningInput: async () => {
          try {
            return await planningInputFor();
          } catch (error) {
            if (error instanceof ServerWholeStorefrontAuthorityError) {
              throw new WholeStorefrontPlanningProviderError(
                "stale-result",
                "The authoritative storefront context changed while planning was in progress.",
              );
            }
            throw error;
          }
        },
        proposalEnvelope: (request, plan) =>
          Promise.resolve(planDerivedProposalEnvelope({ request, plan, planningInput })),
        requiresAuthoritativePlanningFingerprint: true,
        recordValidatedProposal: (response) => {
          const proposed = response.proposal.proposedStorefront;
          const proposedPages = new Map(proposed.pages.map((page) => [page.id, page]));
          const candidate = storefrontSnapshotSchema.parse({
            ...planningInput.draft,
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
