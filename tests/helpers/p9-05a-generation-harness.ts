import {
  aiStorefrontProviderResponseSchema,
  buildAiStorefrontProviderRequest,
  classifyRegisteredWholeStorefrontDirectionRequest,
} from "@/application/ai-storefront-generation";
import {
  StorefrontProposalAcceptanceCoordinator,
  createAiStorefrontApplicationContext,
  projectAiStorefrontSnapshot,
  validateAiStorefrontProposal,
} from "@/application/ai-storefront";
import { saveValidatedEditorDraft } from "@/application/draft-save";
import {
  wholeStorefrontPlanningInputSchema,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningProvider,
  type WholeStorefrontPlanningProviderRequest,
} from "@/application/whole-storefront-generation-plan";
import { compileWholeStorefrontProposal } from "@/application/whole-storefront-proposal-lifecycle";
import { validateRegisteredSnapshot } from "@/components/registry";
import {
  canonicalStorefrontContentFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  createServerWholeStorefrontPlanningHandler,
  createStandaloneServerWholeStorefrontPlanningAuthority,
  type AuthoritativeWholeStorefrontPlanningContextSource,
} from "@/integrations/ai/whole-storefront-runtime-authority";
import { InMemoryProjectRepository } from "@/services/storage";
import { previewPathPrefix, selectedSnapshotId } from "@/app/projects/[projectId]/preview-mode";
import {
  P9_05A_FIXED_TIME,
  type P905aDirectionId,
  createP905aFreshMerchantFixture,
  p905aDirectionScenarios,
} from "@/data/demo/p9-05a-fresh-store-generation";

const SERVER_PROVIDER_ID = "server-whole-storefront-planning";

const registeredDirectionMerchantNames: Record<P905aDirectionId, string> = {
  premiumEditorial: "premium editorial",
  modernTechnical: "modern technical",
  warmApproachable: "warm approachable",
};

function contextSource(
  fixture: ReturnType<typeof createP905aFreshMerchantFixture>,
): AuthoritativeWholeStorefrontPlanningContextSource {
  return {
    load: () => ({
      brief: structuredClone(fixture.brief),
      componentDefinitions: structuredClone(fixture.planningInput.componentDefinitions),
      approvedAssetContext: structuredClone(fixture.assetContext),
      approvedAssetPresentations: structuredClone(fixture.assetPresentations),
    }),
  };
}

export async function generateP905aScenario(directionId: P905aDirectionId) {
  return generateP905aScenarioWithProvider({
    baselineDirectionId: directionId,
    merchantInstruction: p905aDirectionScenarios[directionId].merchantInstruction,
    capability: "approvedColorTypographyDirection",
    selectPlan: (providerRequest) => providerRequest.planForDirection(directionId),
  });
}

export async function generateP905aScenarioFromSelectedDirection(
  directionId: P905aDirectionId,
  baselineDirectionId: P905aDirectionId,
) {
  return generateP905aScenarioWithProvider({
    baselineDirectionId,
    merchantInstruction: `Apply the ${registeredDirectionMerchantNames[directionId]} direction across the storefront.`,
    capability: "registeredWholeStorefrontDirection",
    selectPlan: (providerRequest) => providerRequest.planForDirection(directionId),
  });
}

/** Uses the received merchant instruction as the sole registered-direction selector. */
export async function generateP905aInstructionScenarioFromBaseline(
  baselineDirectionId: P905aDirectionId,
  merchantInstruction: string,
) {
  return generateP905aScenarioWithProvider({
    baselineDirectionId,
    merchantInstruction,
    capability: "registeredWholeStorefrontDirection",
    deferCompiledProposal: true,
    selectPlan: (providerRequest) => {
      const classification = classifyRegisteredWholeStorefrontDirectionRequest(
        providerRequest.merchantInstruction,
      );
      if (classification.kind === "selected") {
        return providerRequest.planForDirection(classification.direction);
      }
      if (classification.kind === "token-refinement") {
        return providerRequest.planForTokenRefinement();
      }
      throw new Error("The received merchant instruction is not a supported registered direction.");
    },
  });
}

type P905aProviderCapture = Readonly<{
  merchantInstruction: string;
  requestFingerprint: string;
}>;

async function generateP905aScenarioWithProvider({
  baselineDirectionId,
  merchantInstruction,
  capability,
  deferCompiledProposal = false,
  selectPlan,
}: {
  baselineDirectionId: P905aDirectionId;
  merchantInstruction: string;
  capability: "approvedColorTypographyDirection" | "registeredWholeStorefrontDirection";
  deferCompiledProposal?: boolean;
  selectPlan: (
    providerRequest: WholeStorefrontPlanningProviderRequest,
  ) => WholeStorefrontGenerationPlan;
}) {
  const fixture = createP905aFreshMerchantFixture(baselineDirectionId);
  const planningInput = wholeStorefrontPlanningInputSchema.parse(
    structuredClone(fixture.planningInput),
  );
  const providerRequests: P905aProviderCapture[] = [];
  const providerPlans: WholeStorefrontGenerationPlan[] = [];
  const provider: WholeStorefrontPlanningProvider = {
    id: "p9-05a-captured-deterministic-provider",
    capabilities: {
      wholeStorefrontPlanning: true,
      structuredPlanOutput: true,
      approvedAssetReferences: true,
    },
    createPlan(providerRequest) {
      providerRequests.push({
        merchantInstruction: providerRequest.merchantInstruction,
        requestFingerprint: providerRequest.requestFingerprint,
      });
      const plan = selectPlan(providerRequest);
      providerPlans.push(structuredClone(plan));
      return Promise.resolve(plan);
    },
  };
  const repository = new InMemoryProjectRepository([structuredClone(fixture.aggregate)]);
  const authority = createStandaloneServerWholeStorefrontPlanningAuthority({
    repository,
    identity: {
      tenantId: "tenant_lumo_p9_05a",
      userId: "merchant_lumo_owner",
      merchantId: "merchant_lumo",
      organizationId: "organization_lumo",
      storeId: "store_lumo",
    },
    contextSource: contextSource(fixture),
  });
  const handler = createServerWholeStorefrontPlanningHandler({
    authority,
    selectProvider: () => provider,
  });
  const request = buildAiStorefrontProviderRequest(
    {
      projectId: fixture.aggregate.project.id,
      draftSnapshotId: fixture.draft.id,
      draftRevision: fixture.draft.revision,
      storefront: projectAiStorefrontSnapshot(fixture.draft),
      affectedPageIds: fixture.draft.pages.map((page) => page.id),
      affectedSectionTargets: [],
      designSystemTarget: {
        kind: "storefrontDesignSystem",
        projectId: fixture.aggregate.project.id,
      },
      merchantInstruction,
      activeLocale: fixture.aggregate.project.primaryLocale,
      enabledLocales: fixture.aggregate.project.enabledLocales,
      requestedScope: "storefront",
      capability,
      providerId: SERVER_PROVIDER_ID,
      provider: {
        id: SERVER_PROVIDER_ID,
        assetReferenceCapability: "structuredApprovedAssets",
        proposeStorefront: () => Promise.reject(new Error("Server-only deterministic harness")),
      },
      importedContent: [],
      approvedAssetContext: fixture.assetContext,
      assetPlacementOperations: [],
    },
    1,
  );
  const response = await handler(
    new Request("http://p9-05a.test/api/ai/whole-storefront-proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }),
  );
  const body: unknown = await response.json();
  if (!response.ok || !body || typeof body !== "object" || !("proposal" in body)) {
    throw new Error(`P9-05A generation failed with status ${response.status}.`);
  }
  const envelope = aiStorefrontProviderResponseSchema.parse(body.proposal);
  const plan = providerPlans[0];
  if (!plan || providerPlans.length !== 1) {
    throw new Error("Expected exactly one deterministic provider plan.");
  }
  let compiledProposal: ReturnType<typeof compileWholeStorefrontProposal> | undefined =
    deferCompiledProposal ? undefined : compileWholeStorefrontProposal({ plan, planningInput });
  const applicationContext = createAiStorefrontApplicationContext({
    activeDraft: fixture.draft,
    catalogue: fixture.aggregate.catalogue,
    enabledLocales: fixture.aggregate.project.enabledLocales,
    activeLocale: fixture.aggregate.project.primaryLocale,
    primaryLocale: fixture.aggregate.project.primaryLocale,
  });
  const confirmedProposal = validateAiStorefrontProposal(
    envelope.proposal,
    applicationContext.proposalContext,
  );

  return {
    fixture,
    planningInput,
    plan,
    get compiledProposal() {
      return (compiledProposal ??= compileWholeStorefrontProposal({ plan, planningInput }));
    },
    request,
    providerRequests,
    providerPlans,
    envelope,
    proposal: confirmedProposal,
    repository,
  };
}

export function createP905aAcceptanceCoordinator(
  generated: Awaited<ReturnType<typeof generateP905aScenario>>,
) {
  return new StorefrontProposalAcceptanceCoordinator({
    proposal: generated.proposal,
    activeDraft: generated.fixture.draft,
    storedDraft: generated.fixture.draft,
    publishedSnapshot: generated.fixture.published,
    catalogue: generated.fixture.aggregate.catalogue,
    enabledLocales: generated.fixture.aggregate.project.enabledLocales,
    activeLocale: generated.fixture.aggregate.project.primaryLocale,
    primaryLocale: generated.fixture.aggregate.project.primaryLocale,
    now: () => new Date(P9_05A_FIXED_TIME),
  });
}

export async function saveAndResolveP905aPreview({
  generated,
  accepted,
}: {
  generated: Awaited<ReturnType<typeof generateP905aScenario>>;
  accepted: StorefrontSnapshot;
}) {
  const directionSlug = generated.fixture.direction.id.replace(
    /[A-Z]/g,
    (letter) => `_${letter.toLowerCase()}`,
  );
  const saved = await saveValidatedEditorDraft({
    repository: generated.repository,
    projectId: generated.fixture.aggregate.project.id,
    loadedDraft: generated.fixture.draft,
    changedPages: accepted.pages,
    brandSystem: accepted.brandSystem,
    primaryLocale: generated.fixture.aggregate.project.primaryLocale,
    now: () => new Date(P9_05A_FIXED_TIME),
    createSnapshotId: () => `snapshot_lumo_saved_${directionSlug}`,
  });
  const previewSnapshotId = selectedSnapshotId(saved.aggregate.project, "draft");
  const preview = saved.aggregate.snapshots.find((snapshot) => snapshot.id === previewSnapshotId);
  if (!preview) throw new Error("The saved P9-05A draft preview is unavailable.");
  return {
    saved,
    preview: validateRegisteredSnapshot(
      preview,
      saved.aggregate.catalogue,
      saved.aggregate.project.primaryLocale,
      saved.aggregate.project.primaryLocale,
    ),
    previewPath: previewPathPrefix(saved.aggregate.project.id, "draft"),
  };
}

export function p905aScenarioSignature({
  plan,
  accepted,
}: {
  plan: Awaited<ReturnType<typeof generateP905aScenario>>["plan"];
  accepted: StorefrontSnapshot;
}) {
  const homepage = accepted.pages.find((page) => page.type === "home");
  const collection = accepted.pages.find((page) => page.type === "collection");
  const product = accepted.pages.find((page) => page.type === "product");
  const hero = homepage?.sections.find((section) => section.component === "hero");
  const collectionCommerce = collection?.sections.find(
    (section) => section.component === "dynamicCollectionCommerce",
  );
  const productDetail = product?.sections.find(
    (section) => section.component === "dynamicProductDetail",
  );
  if (!homepage || !collectionCommerce || !productDetail || !hero) {
    throw new Error("The generated P9-05A core storefront is incomplete.");
  }
  return {
    directionId: plan.designSystemSelection.directionId,
    homepageRecipeId: plan.designSystemSelection.homepageRecipeId,
    homepageOrder: homepage.sections.map((section) => section.component),
    heroVariant: hero.variant,
    productCardFamilyId: plan.designSystemSelection.productCardFamilyId,
    collectionPresentation: {
      variant: collectionCommerce.variant,
      gridDensity: collectionCommerce.props.gridDensity,
      cardVariant: collectionCommerce.props.cardVariant,
      filterLayout: collectionCommerce.props.filterLayout,
    },
    productPresentation: {
      variant: productDetail.variant,
      galleryLayout: productDetail.props.galleryLayout,
      optionDensity: productDetail.props.optionDensity,
      attributeLayout: productDetail.props.attributeLayout,
      mediaTreatment: productDetail.props.mediaTreatment,
    },
    typographyDirectionId: plan.designSystemSelection.typographyDirectionId,
    typography: accepted.brandSystem.typography,
    spacingDensity: plan.designSystemSelection.spacingDensity,
    cornerTreatment: plan.designSystemSelection.cornerTreatment,
    surfaceDepth: plan.designSystemSelection.surfaceDepth,
    imageTreatmentId: plan.designSystemSelection.imageTreatmentId,
    acceptedFingerprint: canonicalStorefrontContentFingerprint(accepted),
  };
}
