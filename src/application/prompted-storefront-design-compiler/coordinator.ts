import {
  createPromptedStorefrontDesignRequestV2,
  createSemanticStorefrontDesignRequestV1,
  semanticStorefrontCurrentAuthorityFingerprint,
  validateSemanticStorefrontDesignIntentV1,
  type CreatePromptedStorefrontDesignRequestV2Input,
  type SemanticStorefrontDesignIntentProvider,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent";
import { createWholeStorefrontGenerationTarget } from "@/application/whole-storefront-generation-plan";
import type { ContentSupportFactAuthority } from "@/application/content-support-pages";
import type { PageFactEvidenceAuthority } from "@/application/storefront-site-map";
import type { ApprovedAssetPresentation } from "@/application/whole-storefront-generation-plan";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  contentSupportPageFamilyIdSchema,
  type PageFactEvidenceReference,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  PromptedStorefrontDesignCompilerError,
  type CompiledPromptedStorefrontDesignDecisionV2,
} from "./contract";
import {
  assertPromptedStorefrontPlanningAuthorityBound,
  type PromptedStorefrontCompilerAuthorityInput,
} from "./compiler";
import { type ExecutedPromptedStorefrontDesignDecisionV2 } from "./executor";
import {
  compileSemanticStorefrontDesignIntentV1,
  type CompileSemanticStorefrontDesignIntentV1Input,
} from "./semantic-compiler";
import {
  executeCompiledSemanticStorefrontDesignIntentV1,
  type ExecuteCompiledSemanticStorefrontDesignIntentV1Input,
} from "./semantic-executor";
import { deriveSemanticCapabilityIndex } from "./semantic-compatibility-resolution";

export type PromptedStorefrontDesignCompilationAuthority = Readonly<{
  requestInput: CreatePromptedStorefrontDesignRequestV2Input;
  compatibilityInput: PromptedStorefrontCompilerAuthorityInput["compatibilityInput"];
  pageEvidenceAuthority: PageFactEvidenceAuthority;
  contentFactAuthority: ContentSupportFactAuthority;
  approvedAssetPresentations: readonly ApprovedAssetPresentation[];
  semanticRequestAuthority?: Readonly<{
    explicitConstraintAuthority: SemanticStorefrontDesignRequestV1["explicitConstraintAuthority"];
    trustedExactHints: SemanticStorefrontDesignRequestV1["trustedExactHints"];
  }>;
}>;

type CompiledDecisionExecutor = (
  input: ExecuteCompiledSemanticStorefrontDesignIntentV1Input,
) => ExecutedPromptedStorefrontDesignDecisionV2;

export type RunPromptedStorefrontDesignCompilationInput = Readonly<{
  provider: SemanticStorefrontDesignIntentProvider;
  loadCurrentAuthority: () =>
    | PromptedStorefrontDesignCompilationAuthority
    | Promise<PromptedStorefrontDesignCompilationAuthority>;
  maximumCandidateEvaluations?: number;
  executeCompiledDecision?: CompiledDecisionExecutor;
}>;

export type PromptedStorefrontDesignCompilationEvidence = Readonly<{
  providerId: string;
  modelId: string | null;
  requestFingerprint: string;
  promptFingerprint: string;
  providerIntentFingerprint: string;
  semanticAuthorityFingerprint: string;
  semanticResolutionFingerprint: string;
  explicitConstraintFingerprint: string;
  trustedHintFingerprint: string;
  materialDimensionFingerprints: Readonly<{
    designDna: string;
    sharedFrame: string;
    homepage: string;
    collection: string;
    productDetail: string;
    pageSet: string;
    componentVariants: string;
    productCard: string;
    narrative: string;
    merchandising: string;
    density: string;
    responsive: string;
    artDirection: string;
  }>;
  compiledDecisionFingerprint: string;
  synthesisFingerprint: string;
  structuralFingerprint: string;
  candidateSnapshotFingerprint: string;
  sourceProposalFingerprint: string;
  currentAuthorityFingerprints: readonly string[];
  materializationAuthorityFingerprint: string;
  protectedCommerceBeforeFingerprint: string;
  protectedCommerceAfterFingerprint: string;
  protectedMediaBeforeFingerprint: string;
  protectedMediaAfterFingerprint: string;
  materializationCount: 1;
}>;

export type PromptedStorefrontDesignCompilationResult = Readonly<{
  sourceDraft: StorefrontSnapshot;
  currentEvidenceReferences: readonly PageFactEvidenceReference[];
  compiledDecision: CompiledPromptedStorefrontDesignDecisionV2;
  execution: ExecutedPromptedStorefrontDesignDecisionV2;
  evidence: PromptedStorefrontDesignCompilationEvidence;
}>;

function stale(message: string): never {
  throw new PromptedStorefrontDesignCompilerError("stale-authority", message);
}

function assertBoundPlanningAuthority(
  authority: PromptedStorefrontDesignCompilationAuthority,
): void {
  assertPromptedStorefrontPlanningAuthorityBound({
    currentRequestInput: authority.requestInput,
    compatibilityInput: authority.compatibilityInput,
  });
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

function createCurrentSemanticAuthority(authority: PromptedStorefrontDesignCompilationAuthority) {
  const exact = createPromptedStorefrontDesignRequestV2(authority.requestInput);
  const currentAuthorityFingerprint = semanticStorefrontCurrentAuthorityFingerprint(
    exact.request.currentAuthority,
  );
  const semanticIndex = deriveSemanticCapabilityIndex({
    authority: authority.compatibilityInput,
    currentAuthorityFingerprint,
  });
  const requestAuthority = authority.semanticRequestAuthority ?? {
    explicitConstraintAuthority: [],
    trustedExactHints: { directionPackageId: null, frameFamilyId: null },
  };
  const semanticRequest = createSemanticStorefrontDesignRequestV1(exact, {
    ...requestAuthority,
    semanticAuthorityFingerprint: semanticIndex.semanticAuthorityFingerprint,
    semanticInfluenceAuthority: semanticIndex.semanticInfluenceAuthority,
  });
  return { exact, semanticIndex, semanticRequest, currentAuthorityFingerprint };
}

function protectedMediaAuthorityFingerprint(
  input: CreatePromptedStorefrontDesignRequestV2Input,
  catalogueRef: string,
): string {
  return `protected-product-media-${canonicalValueFingerprint({
    catalogueRef,
    products: input.catalogue.products
      .map(({ id, images }) => ({ id, images }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  })}`;
}

function protectedRouteInventory(snapshot: StorefrontSnapshot) {
  return [...(snapshot.dynamicCommercePresentation?.routeInventory ?? [])]
    .map((route) => structuredClone(route))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function materializationAuthorityFingerprint(
  authority: PromptedStorefrontDesignCompilationAuthority,
): string {
  try {
    const approvedEvidence = new Set(
      authority.compatibilityInput.approvedEvidenceReferences
        .filter(({ status }) => status === "approved")
        .map(({ source, authorityId, revision }) => `${source}:${authorityId}:${revision}`),
    );
    const materializedPages = authority.compatibilityInput.siteMapDecision.pages.filter((page) =>
      page.evidenceReferences.every(({ source, authorityId, revision }) =>
        approvedEvidence.has(`${source}:${authorityId}:${revision}`),
      ),
    );
    const pageEvidenceResolutions = materializedPages.map((page) => ({
      pageKey: page.key,
      familyId: page.familyId,
      evidence: page.evidenceReferences.map((reference) =>
        authority.pageEvidenceAuthority.resolve({
          familyId: page.familyId,
          reference,
        }),
      ),
    }));
    const pageEvidenceByKey = new Map(
      pageEvidenceResolutions.map(({ pageKey, evidence }) => [pageKey, evidence] as const),
    );
    const contentFactResolutions = materializedPages.flatMap((page) => {
      const familyId = contentSupportPageFamilyIdSchema.safeParse(page.familyId);
      const evidence = pageEvidenceByKey.get(page.key)?.[0];
      if (!familyId.success || !evidence) return [];
      return [
        {
          pageKey: page.key,
          familyId: familyId.data,
          fact: authority.contentFactAuthority.resolve({
            familyId: familyId.data,
            reference: {
              source: evidence.source,
              authorityId: evidence.authorityId,
              revision: evidence.revision,
            },
          }),
        },
      ];
    });
    return `materialization-authority-${canonicalValueFingerprint({
      planningInput: authority.compatibilityInput.planningInput,
      siteMapDecision: authority.compatibilityInput.siteMapDecision,
      approvedEvidenceReferences: authority.compatibilityInput.approvedEvidenceReferences,
      pageEvidenceResolutions,
      contentFactResolutions,
      approvedAssetPresentations: authority.approvedAssetPresentations,
    })}`;
  } catch (cause) {
    throw new PromptedStorefrontDesignCompilerError(
      "stale-authority",
      "Current materialization authority could not be resolved exactly.",
      { cause },
    );
  }
}

function protectedAuthorityFingerprints(
  input: PromptedStorefrontDesignCompilationAuthority,
  catalogueRef = input.requestInput.draft.catalogueRef,
) {
  const canonicalCommerceAuthorityFingerprint = createWholeStorefrontGenerationTarget(
    input.compatibilityInput.planningInput,
  ).canonicalCommerceFingerprint;
  return {
    commerce: `protected-commerce-${canonicalValueFingerprint(
      canonicalCommerceAuthorityFingerprint,
    )}`,
    media: protectedMediaAuthorityFingerprint(input.requestInput, catalogueRef),
    canonicalCommerceAuthorityFingerprint,
  };
}

type MaterializedRuntimePage =
  ExecutedPromptedStorefrontDesignDecisionV2["synthesis"]["materialization"]["proposal"]["proposedStorefront"]["pages"][number];

function bindingsForSlot(page: MaterializedRuntimePage, slotId: string) {
  return page.components.flatMap((component) =>
    component.bindings
      .filter((binding) => binding.slotId === slotId)
      .map((binding) => ({ component: component.component, binding })),
  );
}

function assertRouteExactCommerceBindings(
  authority: PromptedStorefrontDesignCompilationAuthority,
  pages: readonly MaterializedRuntimePage[],
): void {
  const routeInventory =
    authority.requestInput.draft.dynamicCommercePresentation?.routeInventory ?? [];
  const expectedRouteIds = routeInventory
    .filter(({ kind }) => kind !== "search")
    .map(({ id }) => id)
    .sort((left, right) => left.localeCompare(right));
  const emittedRouteIds = pages
    .filter(({ role }) => role === "collection-template" || role === "product-template")
    .map(({ pageId }) => pageId)
    .sort((left, right) => left.localeCompare(right));
  if (canonicalValueString(emittedRouteIds) !== canonicalValueString(expectedRouteIds)) {
    stale(
      "Materialized collection and product runtime pages must match the exact current route inventory one-to-one.",
    );
  }
  const collections = new Map(
    authority.requestInput.catalogue.collections.map((collection) => [collection.id, collection]),
  );

  for (const route of routeInventory) {
    if (route.kind === "search") continue;
    const matchingPages = pages.filter(({ pageId }) => pageId === route.id);
    if (matchingPages.length !== 1) {
      stale("Every retained collection and product route requires exactly one runtime page.");
    }
    const page = matchingPages[0];

    if (route.kind === "collection") {
      const primary = bindingsForSlot(page, "primaryCollection");
      const membership = bindingsForSlot(page, "collectionProducts");
      const collection = collections.get(route.collectionId);
      if (
        page.role !== "collection-template" ||
        primary.length !== 1 ||
        primary[0]?.component !== "dynamicCollectionCommerce" ||
        primary[0].binding.source !== "collection" ||
        primary[0].binding.collectionId !== route.collectionId ||
        membership.length !== 1 ||
        membership[0]?.component !== "dynamicCollectionCommerce" ||
        membership[0].binding.source !== "productList" ||
        canonicalValueString(membership[0].binding.productIds) !==
          canonicalValueString(collection?.productIds ?? null)
      ) {
        stale(
          "A materialized collection route does not retain its exact canonical collection and ordered membership bindings.",
        );
      }
      continue;
    }

    const primary = bindingsForSlot(page, "primaryProduct");
    const related = bindingsForSlot(page, "relatedProducts");
    const expectedRelatedProductIds = route.relatedProductIds ?? [];
    if (
      page.role !== "product-template" ||
      primary.length !== 1 ||
      primary[0]?.component !== "dynamicProductDetail" ||
      primary[0].binding.source !== "product" ||
      primary[0].binding.productId !== route.productId ||
      (expectedRelatedProductIds.length === 0
        ? related.length !== 0
        : related.length !== 1 ||
          related[0]?.component !== "dynamicProductDetail" ||
          related[0].binding.source !== "productList" ||
          canonicalValueString(related[0].binding.productIds) !==
            canonicalValueString(expectedRelatedProductIds))
    ) {
      stale(
        "A materialized product route does not retain its exact canonical product and ordered related-product bindings.",
      );
    }
  }
}

function assertMaterializedProtectedAuthority(
  authority: PromptedStorefrontDesignCompilationAuthority,
  execution: ExecutedPromptedStorefrontDesignDecisionV2,
) {
  const expected = protectedAuthorityFingerprints(authority);
  const materialization = execution.synthesis.materialization;
  const proposal = materialization.proposal;
  const runtime = proposal.proposedStorefront;
  const snapshot = materialization.snapshot;
  if (
    materialization.plan.target.canonicalCommerceFingerprint !==
      expected.canonicalCommerceAuthorityFingerprint ||
    proposal.preconditions.canonicalCommerceFingerprint !==
      expected.canonicalCommerceAuthorityFingerprint ||
    runtime.canonicalCommerceFingerprint !== expected.canonicalCommerceAuthorityFingerprint ||
    snapshot.catalogueRef !== authority.requestInput.draft.catalogueRef ||
    canonicalValueString(protectedRouteInventory(snapshot)) !==
      canonicalValueString(protectedRouteInventory(authority.requestInput.draft))
  ) {
    stale("The materialized storefront changed protected commerce authority.");
  }

  const products = new Set(authority.requestInput.catalogue.products.map(({ id }) => id));
  const collections = new Map(
    authority.requestInput.catalogue.collections.map((collection) => [
      collection.id,
      collection.productIds,
    ]),
  );
  assertRouteExactCommerceBindings(authority, runtime.pages);
  for (const page of runtime.pages) {
    for (const component of page.components) {
      const primaryCollection = component.bindings.find(
        (binding) => binding.source === "collection" && binding.slotId === "primaryCollection",
      );
      for (const binding of component.bindings) {
        if (
          ["product", "productList", "collection", "collectionList"].includes(binding.source) &&
          binding.revision !== expected.canonicalCommerceAuthorityFingerprint
        ) {
          stale("A materialized commerce binding uses stale canonical authority.");
        }
        if (binding.source === "product" && !products.has(binding.productId)) {
          stale("A materialized product binding escaped canonical commerce authority.");
        }
        if (
          binding.source === "productList" &&
          binding.productIds.some((productId) => !products.has(productId))
        ) {
          stale("A materialized product-list binding escaped canonical commerce authority.");
        }
        if (binding.source === "collection" && !collections.has(binding.collectionId)) {
          stale("A materialized collection binding escaped canonical commerce authority.");
        }
        if (
          binding.source === "collectionList" &&
          binding.collectionIds.some((collectionId) => !collections.has(collectionId))
        ) {
          stale("A materialized collection-list binding escaped canonical commerce authority.");
        }
        if (
          binding.source === "productList" &&
          binding.slotId === "collectionProducts" &&
          primaryCollection?.source === "collection" &&
          canonicalValueString(binding.productIds) !==
            canonicalValueString(collections.get(primaryCollection.collectionId) ?? null)
        ) {
          stale("A materialized collection changed canonical ordered product membership.");
        }
      }
      if (
        component.assetAssignments.some(({ role }) =>
          ["productMainImage", "productAlternativeImage"].includes(role),
        )
      ) {
        stale("A materialized component replaced protected canonical product media.");
      }
    }
  }
  const snapshotSections = [
    ...(snapshot.sharedFrame
      ? [
          snapshot.sharedFrame.header,
          snapshot.sharedFrame.footer,
          ...(snapshot.sharedFrame.announcement ? [snapshot.sharedFrame.announcement] : []),
        ]
      : []),
    ...snapshot.pages.flatMap(({ sections }) => sections),
  ];
  if (
    snapshotSections.some(
      ({ approvedAssetPlacements }) =>
        approvedAssetPlacements?.some(({ role }) =>
          ["productMainImage", "productAlternativeImage"].includes(role),
        ) ?? false,
    )
  ) {
    stale("The materialized snapshot replaced protected canonical product media.");
  }
  return {
    commerce: `protected-commerce-${canonicalValueFingerprint(
      runtime.canonicalCommerceFingerprint,
    )}`,
    media: protectedMediaAuthorityFingerprint(authority.requestInput, snapshot.catalogueRef),
  };
}

function requireExactlyOneMaterialization(materializationCount: number): 1 {
  if (materializationCount !== 1) {
    stale("Prompted storefront compilation must execute exactly one complete materialization.");
  }
  return materializationCount;
}

export async function runPromptedStorefrontDesignCompilation(
  input: RunPromptedStorefrontDesignCompilationInput,
): Promise<PromptedStorefrontDesignCompilationResult> {
  const before = await input.loadCurrentAuthority();
  assertBoundPlanningAuthority(before);
  const initial = createCurrentSemanticAuthority(before);
  const protectedBefore = protectedAuthorityFingerprints(before);
  const materializationAuthorityBefore = materializationAuthorityFingerprint(before);

  const providerIntent = await input.provider.createDesignIntent(initial.semanticRequest, {
    currentAuthorityFingerprint: () => initial.currentAuthorityFingerprint,
    semanticAuthorityFingerprint: () => initial.semanticIndex.semanticAuthorityFingerprint,
  });

  const refreshed = await input.loadCurrentAuthority();
  assertBoundPlanningAuthority(refreshed);
  const current = createCurrentSemanticAuthority(refreshed);
  assertSameAuthority(initial.exact, current.exact);
  if (
    canonicalValueString(initial.semanticRequest) !==
      canonicalValueString(current.semanticRequest) ||
    initial.semanticIndex.semanticAuthorityFingerprint !==
      current.semanticIndex.semanticAuthorityFingerprint
  ) {
    stale("Current semantic compatibility authority changed after the provider response.");
  }
  const refreshedMaterializationAuthority = materializationAuthorityFingerprint(refreshed);
  if (materializationAuthorityBefore !== refreshedMaterializationAuthority) {
    stale("Materialization authority changed after the provider response.");
  }
  const refreshedProtectedAuthority = protectedAuthorityFingerprints(refreshed);
  if (
    protectedBefore.commerce !== refreshedProtectedAuthority.commerce ||
    protectedBefore.media !== refreshedProtectedAuthority.media
  ) {
    stale(
      "Protected commerce or canonical product-media authority changed after the provider response.",
    );
  }

  const { semanticIntentFingerprint: _semanticIntentFingerprint, ...providerIntentMaterial } =
    providerIntent;
  void _semanticIntentFingerprint;
  const validatedIntent = validateSemanticStorefrontDesignIntentV1({
    request: current.semanticRequest,
    validation: {
      currentAuthorityFingerprint: () => current.currentAuthorityFingerprint,
      semanticAuthorityFingerprint: () => current.semanticIndex.semanticAuthorityFingerprint,
    },
    intent: providerIntentMaterial,
  });
  const compileInput: CompileSemanticStorefrontDesignIntentV1Input = {
    originalRequest: initial.semanticRequest,
    providerIntent: validatedIntent,
    currentRequestInput: refreshed.requestInput,
    compatibilityInput: refreshed.compatibilityInput,
    semanticCapabilityIndex: current.semanticIndex,
    ...(input.maximumCandidateEvaluations === undefined
      ? {}
      : { maximumCandidateEvaluations: input.maximumCandidateEvaluations }),
  };
  const compiled = compileSemanticStorefrontDesignIntentV1(compileInput);
  const compiledDecision = compiled.compiledDecision;
  const executeCompiledDecision =
    input.executeCompiledDecision ?? executeCompiledSemanticStorefrontDesignIntentV1;
  let materializationCount = 0;
  const executeMaterialization: CompiledDecisionExecutor = (executionInput) => {
    materializationCount += 1;
    if (materializationCount > 1) {
      stale("Prompted storefront compilation attempted more than one complete materialization.");
    }
    return executeCompiledDecision(executionInput);
  };
  const execution = executeMaterialization({
    ...compileInput,
    compiledDecision,
    pageEvidenceAuthority: refreshed.pageEvidenceAuthority,
    contentFactAuthority: refreshed.contentFactAuthority,
    approvedAssetPresentations: refreshed.approvedAssetPresentations,
  });
  const completedMaterializationCount = requireExactlyOneMaterialization(materializationCount);
  const candidate = execution.synthesis.materialization.snapshot;
  const protectedAfter = assertMaterializedProtectedAuthority(refreshed, execution);

  return Object.freeze({
    sourceDraft: structuredClone(refreshed.requestInput.draft),
    currentEvidenceReferences: structuredClone(
      refreshed.compatibilityInput.approvedEvidenceReferences,
    ),
    compiledDecision: structuredClone(compiledDecision),
    execution,
    evidence: Object.freeze({
      providerId: input.provider.id,
      modelId: input.provider.modelId,
      requestFingerprint: initial.semanticRequest.requestFingerprint,
      promptFingerprint: initial.semanticRequest.promptFingerprint,
      providerIntentFingerprint: validatedIntent.semanticIntentFingerprint,
      semanticAuthorityFingerprint: current.semanticIndex.semanticAuthorityFingerprint,
      semanticResolutionFingerprint: compiled.resolution.diagnostic.diagnosticFingerprint,
      explicitConstraintFingerprint: `semantic-explicit-constraints-${canonicalValueFingerprint(
        current.semanticRequest.explicitConstraintAuthority,
      )}`,
      trustedHintFingerprint: `semantic-trusted-hints-${canonicalValueFingerprint(
        current.semanticRequest.trustedExactHints,
      )}`,
      materialDimensionFingerprints: Object.freeze({
        designDna: compiledDecision.designDna.authorityFingerprint,
        sharedFrame: compiledDecision.sharedFrame.authorityFingerprint,
        homepage: compiledDecision.profiles.homepage.authorityFingerprint,
        collection: compiledDecision.profiles.collection.authorityFingerprint,
        productDetail: compiledDecision.profiles.productDetail.authorityFingerprint,
        pageSet: `semantic-page-set-${canonicalValueFingerprint({
          static: compiledDecision.staticContentSupportSelections,
          utility: compiledDecision.utilityPresentationSelections,
        })}`,
        componentVariants: `semantic-components-${canonicalValueFingerprint(
          execution.synthesis.decision.componentChoices,
        )}`,
        productCard: `semantic-product-card-${canonicalValueFingerprint(
          compiledDecision.productCardAnatomyIds,
        )}`,
        narrative: `semantic-narrative-${canonicalValueFingerprint(
          compiledDecision.exactSelection.narrativePosture,
        )}`,
        merchandising: `semantic-merchandising-${canonicalValueFingerprint(
          compiledDecision.exactSelection.merchandisingPosture,
        )}`,
        density: `semantic-density-${canonicalValueFingerprint(
          compiledDecision.exactSelection.informationDensityPosture,
        )}`,
        responsive: `semantic-responsive-${canonicalValueFingerprint(
          compiledDecision.responsiveArtDirection.responsiveMode,
        )}`,
        artDirection: `semantic-art-direction-${canonicalValueFingerprint(
          compiledDecision.exactSelection.artDirectionPosture,
        )}`,
      }),
      compiledDecisionFingerprint: compiledDecision.compiledDecisionFingerprint,
      synthesisFingerprint: execution.synthesis.decision.synthesisFingerprint,
      structuralFingerprint: compiledDecision.structuralFingerprint,
      candidateSnapshotFingerprint: canonicalStorefrontContentFingerprint(candidate),
      sourceProposalFingerprint: canonicalValueFingerprint(
        execution.synthesis.materialization.proposal,
      ),
      currentAuthorityFingerprints: [...compiledDecision.exactAuthorityFingerprints],
      materializationAuthorityFingerprint: refreshedMaterializationAuthority,
      protectedCommerceBeforeFingerprint: protectedBefore.commerce,
      protectedCommerceAfterFingerprint: protectedAfter.commerce,
      protectedMediaBeforeFingerprint: protectedBefore.media,
      protectedMediaAfterFingerprint: protectedAfter.media,
      materializationCount: completedMaterializationCount,
    }),
  });
}
