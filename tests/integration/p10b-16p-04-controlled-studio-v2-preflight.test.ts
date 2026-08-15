// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createP10B16P04WholeStorefrontProposalRouteHandler } from "@/app/api/ai/whole-storefront-proposals/p10b-16p-04-composition.server";
import { StorefrontProposalAcceptanceCoordinator } from "@/application/ai-storefront";
import {
  dynamicCommerceRouteSectionId,
  resolveDynamicCommerceRoutePage,
} from "@/application/dynamic-commerce-routes";
import {
  PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
  PROMPTED_STOREFRONT_STUDIO_OPERATION,
  promptedStorefrontStudioGenerationRequestSchema,
  promptedStorefrontStudioGenerationResponseSchema,
} from "@/application/prompted-storefront-studio";
import { promptedStorefrontPromptFingerprint } from "@/application/prompted-storefront-design-intent";
import { homepageProofContentSchema } from "@/components/registry/homepage-commerce";
import {
  P10B16P04_COMMERCIAL_DRAFT_ID,
  P10B16P04_COMMERCIAL_CONTEXTS,
  P10B16P04_COMMERCIAL_LOCALE,
  P10B16P04_COMMERCIAL_PROJECT_ID,
  createP10B16P04RawAurumCommercialFixture,
} from "@/data/demo/p10b-16p-04-commercial-acceptance";
import { canonicalStorefrontContentFingerprint, canonicalValueString } from "@/domain/storefront";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  configuredP10B16P04AcceptanceToken,
  createP10B16P04AcceptanceInspectionHandler,
  createP10B16P04ServerPromptedStorefrontStudioAuthority,
  inspectP10B16P04RealStudioAcceptance,
  isP10B16P04RealStudioAcceptanceConfigured,
  loadP10B16P04CurrentEvidenceReferences,
  loadP10B16P04InitialDraftAuthority,
  loadP10B16P04ProposalPreviewAuthority,
  P10B_16P_04_ACCEPTANCE_TOKEN_HEADER,
  P10B_16P_04_LOCAL_ACCEPTANCE_FLAG,
  P10B_16P_04_LOCAL_ACCEPTANCE_NAMESPACE,
  P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN,
  P10B_16P_04_MOCK_TRANSPORT_FLAG,
  P10B_16P_04_MOCK_FAILURE_HEADER,
  P10B_16P_04_PROVIDER_CALL_BUDGET,
  P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT,
  P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT_2,
  resetP10B16P04RealStudioAcceptanceStateForTests,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";

const origin = "http://localhost:3118";
const acceptanceToken = "p10b16p04-mocked-preflight-token-0001";
const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  [P10B_16P_04_LOCAL_ACCEPTANCE_FLAG]: "1",
  [P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN]: acceptanceToken,
  [P10B_16P_04_MOCK_TRANSPORT_FLAG]: "1",
} as const;
const exactPrompt =
  "Create a refined premium jewellery storefront with strong editorial storytelling, elegant product discovery, sophisticated configurable-product pages and restrained commercial hierarchy.";
const technicalPrompt =
  "Create an information-rich modern technical jewellery storefront with catalogue-led discovery, precise configurable-product guidance and confident commercial hierarchy.";
const minimalPrompt =
  "Create a restrained minimal commerce jewellery storefront with focused product discovery, quiet typography and direct conversion-led hierarchy.";

function acceptanceHeaders(token: string | null = acceptanceToken): Headers {
  return new Headers(token === null ? {} : { [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: token });
}

function request({
  token = acceptanceToken,
  requestOrigin = origin,
  requestId = "p10b16p04-mocked-preflight-request",
  merchantPrompt = exactPrompt,
  mockFailure,
}: {
  token?: string | null;
  requestOrigin?: string | null;
  requestId?: string;
  merchantPrompt?: string;
  mockFailure?: "provider-transport";
} = {}) {
  return new Request(`${origin}/api/ai/whole-storefront-proposals`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(requestOrigin === null ? {} : { origin: requestOrigin }),
      ...(token === null ? {} : { [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: token }),
      ...(mockFailure ? { [P10B_16P_04_MOCK_FAILURE_HEADER]: mockFailure } : {}),
    },
    body: JSON.stringify({
      operation: PROMPTED_STOREFRONT_STUDIO_OPERATION,
      contractVersion: PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
      requestId,
      projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
      draftSnapshotId: P10B16P04_COMMERCIAL_DRAFT_ID,
      draftRevision: 0,
      activeLocale: P10B16P04_COMMERCIAL_LOCALE,
      targetScope: "storefront",
      merchantPrompt,
    }),
  });
}

describe("P10B-16P-04 controlled Studio V2 mocked preflight", () => {
  beforeEach(() => resetP10B16P04RealStudioAcceptanceStateForTests());

  it("injects retained rejected structures into server-owned diversity authority", async () => {
    const promptAStructuralFingerprint =
      "semantic-structure-v1_501_57087ca71a72bf77f44fb2e4cd6375e08ab328ba08059bac4e3ae48974485050";
    const promptBStructuralFingerprint =
      "semantic-structure-v1_513_1448f2125e97be6cfa7f5d5d0a4d9fdc7511751f77932458491900f0ca7e3246";
    const injectedEnvironment = {
      ...environment,
      [P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT]: promptAStructuralFingerprint,
      [P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT_2]: promptBStructuralFingerprint,
    };
    const submitted = request({ merchantPrompt: technicalPrompt });
    const parsed = promptedStorefrontStudioGenerationRequestSchema.parse(
      await submitted.clone().json(),
    );
    const authority = createP10B16P04ServerPromptedStorefrontStudioAuthority({
      environment: injectedEnvironment,
    });
    const context = await authority.resolve(parsed, submitted);
    const current = await context.loadCurrentAuthority();

    expect(current.requestInput.priorDiversityEvidence).toEqual({
      recentAcceptedStructuralFingerprints: [],
      recentRejectedStructuralFingerprints: [
        promptAStructuralFingerprint,
        promptBStructuralFingerprint,
      ],
      recentlyUsedPostureKeys: [],
      merchantAvoidancePreferenceKeys: [],
    });
    expect(inspectP10B16P04RealStudioAcceptance(injectedEnvironment)).toMatchObject({
      providerCallCount: 0,
      retryCount: 0,
      status: "ready",
      cases: [],
    });
  });

  it.each([
    "semantic-structure-v1_0_57087ca71a72bf77f44fb2e4cd6375e08ab328ba08059bac4e3ae48974485050",
    "semantic-structure-v1_501_NOT-A-CANONICAL-HASH",
    `semantic-structure-v1_501_${"a".repeat(220)}`,
  ])("fails closed for invalid retained diversity authority: %s", async (fingerprint) => {
    const invalidEnvironment = {
      ...environment,
      [P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT]: fingerprint,
    };
    const submitted = request({ merchantPrompt: technicalPrompt });
    const parsed = promptedStorefrontStudioGenerationRequestSchema.parse(
      await submitted.clone().json(),
    );
    const authority = createP10B16P04ServerPromptedStorefrontStudioAuthority({
      environment: invalidEnvironment,
    });
    const context = await authority.resolve(parsed, submitted);

    await expect(context.loadCurrentAuthority()).rejects.toMatchObject({ code: "invalid" });
    expect(inspectP10B16P04RealStudioAcceptance(invalidEnvironment)).toMatchObject({
      providerCallCount: 0,
      retryCount: 0,
      status: "ready",
      cases: [],
    });
  });

  it.each([
    {
      label: "second fingerprint without the first",
      first: undefined,
      second:
        "semantic-structure-v1_513_1448f2125e97be6cfa7f5d5d0a4d9fdc7511751f77932458491900f0ca7e3246",
    },
    {
      label: "invalid second fingerprint",
      first:
        "semantic-structure-v1_501_57087ca71a72bf77f44fb2e4cd6375e08ab328ba08059bac4e3ae48974485050",
      second: "not-a-structural-fingerprint",
    },
    {
      label: "duplicate retained fingerprints",
      first:
        "semantic-structure-v1_501_57087ca71a72bf77f44fb2e4cd6375e08ab328ba08059bac4e3ae48974485050",
      second:
        "semantic-structure-v1_501_57087ca71a72bf77f44fb2e4cd6375e08ab328ba08059bac4e3ae48974485050",
    },
  ])("fails closed for $label", async ({ first, second }) => {
    const invalidEnvironment = {
      ...environment,
      ...(first ? { [P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT]: first } : {}),
      [P10B_16P_04_PRIOR_REJECTED_STRUCTURAL_FINGERPRINT_2]: second,
    };
    const submitted = request({ merchantPrompt: minimalPrompt });
    const parsed = promptedStorefrontStudioGenerationRequestSchema.parse(
      await submitted.clone().json(),
    );
    const authority = createP10B16P04ServerPromptedStorefrontStudioAuthority({
      environment: invalidEnvironment,
    });
    const context = await authority.resolve(parsed, submitted);

    await expect(context.loadCurrentAuthority()).rejects.toMatchObject({ code: "invalid" });
    expect(inspectP10B16P04RealStudioAcceptance(invalidEnvironment)).toMatchObject({
      providerCallCount: 0,
      retryCount: 0,
      status: "ready",
      cases: [],
    });
  });

  it("uses the compact normal route once, compiles one protected proposal, and rejects atomically", async () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const aggregateBefore = canonicalValueString(fixture.aggregate);
    const rawFingerprint = canonicalStorefrontContentFingerprint(fixture.rawDraft);
    const route = createP10B16P04WholeStorefrontProposalRouteHandler({
      environment,
    });

    const submitted = request();
    const compactBody = (await submitted.clone().json()) as Record<string, unknown>;
    const response = await route(submitted);
    const result = promptedStorefrontStudioGenerationResponseSchema.parse(await response.json());

    expect(response.status, JSON.stringify(inspectP10B16P04RealStudioAcceptance(environment))).toBe(
      200,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(compactBody).sort()).toEqual(
      [
        "activeLocale",
        "contractVersion",
        "draftRevision",
        "draftSnapshotId",
        "merchantPrompt",
        "operation",
        "projectId",
        "requestId",
        "targetScope",
      ].sort(),
    );
    expect(compactBody).not.toHaveProperty("selectionId");
    expect(compactBody).not.toHaveProperty("executableIntentId");
    expect(compactBody).not.toHaveProperty("providerIntent");
    expect(compactBody).not.toHaveProperty("compiledDecision");
    expect(compactBody).not.toHaveProperty("candidateSnapshot");
    expect(compactBody.merchantPrompt).toBe(exactPrompt);
    expect(result.lineage).toMatchObject({
      providerId: "openai-prompted-storefront-design-intent-v2",
      modelId: "mocked-p10b-16p-04-design-intent-v2",
      providerCallCount: 1,
      retryCount: 0,
      materializationCount: 1,
    });
    expect(result.lineage.promptFingerprint).toBe(promptedStorefrontPromptFingerprint(exactPrompt));
    expect(result.lineage.protectedCommerceAfterFingerprint).toBe(
      result.lineage.protectedCommerceBeforeFingerprint,
    );
    expect(result.lineage.protectedMediaAfterFingerprint).toBe(
      result.lineage.protectedMediaBeforeFingerprint,
    );
    expect(result.proposal.metadata.operationCount).toBe(1);
    expect(result.proposal.proposal.status).toBe("pending");
    expect(result.proposal.proposal.wholeStorefrontGeneration).toMatchObject({
      operationType: "APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION",
      permission: {
        skillId: "compilePromptedStorefrontDesignIntentV2",
        skillVersion: "2.0.0",
        operationTypes: ["APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION"],
      },
      sourceProposalFingerprint: result.lineage.sourceProposalFingerprint,
      compiledDecisionFingerprint: result.lineage.compiledDecisionFingerprint,
      synthesisFingerprint: result.lineage.synthesisFingerprint,
      candidateSnapshotFingerprint: result.lineage.candidateSnapshotFingerprint,
      resultingSnapshotFingerprint: result.lineage.candidateSnapshotFingerprint,
    });

    const published = fixture.aggregate.snapshots.find(
      ({ id }) => id === fixture.aggregate.project.publishedSnapshotId,
    );
    if (!published) throw new Error("The mocked preflight fixture requires a published snapshot.");
    const coordinator = new StorefrontProposalAcceptanceCoordinator({
      proposal: result.proposal.proposal,
      activeDraft: fixture.rawDraft,
      storedDraft: fixture.rawDraft,
      publishedSnapshot: published,
      catalogue: fixture.aggregate.catalogue,
      enabledLocales: fixture.aggregate.project.enabledLocales,
      activeLocale: P10B16P04_COMMERCIAL_LOCALE,
      primaryLocale: fixture.aggregate.project.primaryLocale,
    });
    const rejected = coordinator.reject();

    expect(rejected.state).toBe("rejected");
    expect(rejected.transaction).toBeNull();
    expect(coordinator.inspectHistory()).toEqual({ past: [], future: [] });
    expect(canonicalStorefrontContentFingerprint(rejected.activeDraft)).toBe(rawFingerprint);
    expect(canonicalStorefrontContentFingerprint(rejected.storedDraft)).toBe(rawFingerprint);
    expect(canonicalValueString(fixture.aggregate)).toBe(aggregateBefore);

    const inspection = inspectP10B16P04RealStudioAcceptance(environment);
    expect(inspection).toMatchObject({
      namespace: P10B_16P_04_LOCAL_ACCEPTANCE_NAMESPACE,
      projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
      callBudget: P10B_16P_04_PROVIDER_CALL_BUDGET,
      providerCallCount: 1,
      retryCount: 0,
      status: "ready",
      failureClassification: null,
      activeAttempt: null,
      provider: {
        transport: {
          endpoint: "official-openai-responses-v1",
          canonicalBaseUrl: true,
          organizationConfigured: false,
          projectConfigured: false,
          customHeadersConfigured: false,
          proxyConfigured: false,
        },
      },
      selectedTransport: {
        kind: "mock",
        providerId: "openai-prompted-storefront-design-intent-v2",
        modelId: "mocked-p10b-16p-04-design-intent-v2",
      },
    });
    expect(inspection.cases).toHaveLength(1);
    const caseEvidence = inspection.cases[0];
    if (!caseEvidence) throw new Error("The mocked acceptance case evidence is missing.");
    expect(caseEvidence).toMatchObject({
      caseNumber: 1,
      providerCallCount: 1,
      retryCount: 0,
      requestFingerprint: result.lineage.requestFingerprint,
      promptFingerprint: result.lineage.promptFingerprint,
      intentFingerprint: result.lineage.providerIntentFingerprint,
      compiledDecisionFingerprint: result.lineage.compiledDecisionFingerprint,
      synthesisFingerprint: result.lineage.synthesisFingerprint,
      structuralFingerprint: result.lineage.structuralFingerprint,
      candidateSnapshotFingerprint: result.lineage.candidateSnapshotFingerprint,
      protectedCommerce: "unchanged",
      canonicalProductMedia: "unchanged",
      materializationCount: 1,
      sdkTransportEntryCount: 1,
      selection: {
        directionId: "premiumEditorial",
        dynamicCommerce: {
          searchExecution: "registered-presentation-fail-closed-runtime",
          selectedArchetypes: {
            collection: {
              component: "dynamicCollectionCommerce",
            },
            standardSimple: {
              component: "dynamicProductDetail",
            },
            configurable: {
              component: "dynamicProductDetail",
            },
          },
        },
      },
    });
    expect(caseEvidence.selection.dynamicCommerce.selectedArchetypes.collection.anatomyId).toEqual(
      expect.any(String),
    );
    expect(
      caseEvidence.selection.dynamicCommerce.selectedArchetypes.standardSimple.anatomyId,
    ).toEqual(expect.any(String));
    expect(
      caseEvidence.selection.dynamicCommerce.selectedArchetypes.configurable.anatomyId,
    ).toEqual(expect.any(String));
    expect(caseEvidence.providerInputFingerprint).toMatch(/^openai-input-v1_/);
    expect(caseEvidence.providerWireIntentFingerprint).toEqual(expect.any(String));
    expect(caseEvidence.providerSchemaFingerprint).toMatch(/^openai-semantic-schema-v1_/);
    expect(caseEvidence.providerRequestEnvelopeFingerprint).toMatch(/^openai-envelope-v1_/);
    expect(caseEvidence.selection.componentChoices.length).toBeGreaterThan(0);
    expect(caseEvidence.selection.pageProfileSelections.length).toBeGreaterThan(0);

    const proposalAggregate = loadP10B16P04ProposalPreviewAuthority({
      projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
      candidateFingerprint: result.lineage.candidateSnapshotFingerprint,
      httpHeaders: acceptanceHeaders(),
      environment,
    });
    const proposalDraft = proposalAggregate?.snapshots.find(
      ({ id }) => id === proposalAggregate.project.draftSnapshotId,
    );
    expect(proposalDraft).toBeDefined();
    expect(canonicalStorefrontContentFingerprint(proposalDraft!)).toBe(
      result.lineage.candidateSnapshotFingerprint,
    );
    const homepage = proposalDraft!.pages.find(({ type }) => type === "home");
    expect(homepage).toBeDefined();
    const homepageContent = canonicalValueString(
      homepage?.sections.map(({ component, content }) => ({ component, content })) ?? [],
    );
    expect(homepageContent).toContain("Quiet forms, lasting meaning");
    expect(homepageContent.match(/Quiet forms, lasting meaning/g)).toHaveLength(1);
    expect(homepageContent).toContain("Light, held close");
    expect(homepageContent).toContain(
      "Discover white gold and silver pieces inspired by winter light.",
    );
    expect(homepageContent).toContain("Designed in Finland");
    expect(homepageContent).toContain("Quietly distinctive pieces for every day.");
    expect(homepageContent).toContain("Explore Everyday icons");
    expect(homepageContent).toContain(
      "Jewellery and watches shaped by Nordic clarity and warm materials.",
    );
    expect(homepageContent).not.toContain("Made for considered shopping");
    expect(
      homepageContent.match(
        /A Nordic jewellery and watch presentation with restrained warmth and clear product discovery\./g,
      )?.length ?? 0,
    ).toBeLessThanOrEqual(2);
    expect(
      homepage?.sections
        .filter(({ component }) => component === "homepageHero")
        .flatMap(({ approvedAssetPlacements }) => approvedAssetPlacements ?? []),
    ).toEqual([
      expect.objectContaining({
        assetId: "asset_p10b16p04_aurum_hero",
        role: "heroDesktop",
      }),
    ]);
    const proof = homepage?.sections.find(({ component }) => component === "homepageProof");
    const proofContent = homepageProofContentSchema.parse(proof?.content);
    expect(proofContent.items).toHaveLength(1);
    expect(proofContent.items[0]).toMatchObject({
      id: "approved_story_helsinki-origin",
      kind: "brandFact",
      statement: { en: "Designed in Finland", fi: "Suunniteltu Suomessa" },
      attribution: { en: "Helsinki", fi: "Helsinki" },
      evidence: { authorityId: fixture.aboutFactDocument.id },
    });
    const everydayRoute = proposalDraft!.dynamicCommercePresentation?.routeInventory.find(
      (route) =>
        route.kind === "collection" &&
        route.collectionId === P10B16P04_COMMERCIAL_CONTEXTS.collection.collectionId,
    );
    if (!everydayRoute) throw new Error("The largest canonical collection route is unavailable.");
    const continuationNavigation = [
      ...proposalDraft!.navigation.primary,
      ...proposalDraft!.navigation.footer,
    ].find(
      ({ target }) =>
        target.type === "dynamic-commerce-route" && target.routeId === everydayRoute.id,
    );
    expect(continuationNavigation).toBeDefined();
    expect(
      proposalDraft!.dynamicCommercePresentation?.routeInventory.find(
        ({ id }) =>
          continuationNavigation?.target.type === "dynamic-commerce-route" &&
          id === continuationNavigation.target.routeId,
      ),
    ).toMatchObject({
      kind: "collection",
      collectionId: P10B16P04_COMMERCIAL_CONTEXTS.collection.collectionId,
    });
    const editorialAssignments = homepage?.sections
      .filter(({ component }) => component === "homepageEditorial")
      .flatMap(({ approvedAssetPlacements }) => approvedAssetPlacements ?? []);
    expect(editorialAssignments?.length).toBeGreaterThan(0);
    expect(editorialAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: "asset_p10b16p04_aurum_editorial",
          role: "editorialImage",
        }),
      ]),
    );
    expect(editorialAssignments).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ role: "heroDesktop" })]),
    );
    expect(
      homepage?.sections
        .filter(({ component }) => component === "homepagePromotion")
        .flatMap(({ approvedAssetPlacements }) => approvedAssetPlacements ?? []),
    ).toEqual([
      expect.objectContaining({
        assetId: "asset_p10b16p04_aurum_collection",
        role: "collectionImage",
      }),
    ]);
    const featuredProducts = homepage?.sections.find(
      ({ component }) => component === "homepageFeaturedProducts",
    );
    const featuredProductIds = featuredProducts?.content.productIds;
    if (!Array.isArray(featuredProductIds)) {
      throw new Error("The commercial homepage requires its persisted product-list projection.");
    }
    expect(featuredProductIds).toHaveLength(4);
    const dynamicAuthority = proposalDraft!.dynamicCommercePresentation;
    expect(dynamicAuthority).toBeDefined();
    const selectedDynamicCommerce = caseEvidence.selection.dynamicCommerce;
    const configurableProduct = fixture.aggregate.catalogue.products.find(
      ({ id }) => id === P10B16P04_COMMERCIAL_CONTEXTS.configurableProduct.productId,
    );
    expect(configurableProduct).toBeDefined();
    if (!configurableProduct) throw new Error("The configurable fixture product is missing.");
    const ringMapping = dynamicAuthority!.productTypeMappings.find(
      ({ productTypeId }) =>
        productTypeId === canonicalProductTypePresentationId(configurableProduct.productType),
    );
    expect(ringMapping?.archetypeId).toBe(
      selectedDynamicCommerce.selectedArchetypes.configurable.archetypeId,
    );
    const configurableRoute = dynamicAuthority!.routeInventory.find(
      (route) =>
        route.kind === "product" &&
        route.productId === P10B16P04_COMMERCIAL_CONTEXTS.configurableProduct.productId,
    );
    expect(configurableRoute).toBeDefined();
    if (!configurableRoute || configurableRoute.kind !== "product") {
      throw new Error("The commercial fixture requires its configurable product route.");
    }
    const configurablePage = resolveDynamicCommerceRoutePage({
      snapshot: proposalDraft!,
      catalogue: fixture.aggregate.catalogue,
      routeId: configurableRoute.id,
      projection: "runtime",
    });
    expect(configurablePage.archetype.id).toBe(
      selectedDynamicCommerce.selectedArchetypes.configurable.archetypeId,
    );
    expect(configurablePage.page.sections[0]).toMatchObject({
      component: "dynamicProductDetail",
      variant: selectedDynamicCommerce.selectedArchetypes.configurable.variant,
      content: {
        productId: P10B16P04_COMMERCIAL_CONTEXTS.configurableProduct.productId,
      },
      props: {
        relatedCardVariant: selectedDynamicCommerce.selectedArchetypes.configurable.anatomyId,
      },
    });
    const collectionRoutes = dynamicAuthority!.routeInventory.filter(
      (route) => route.kind === "collection",
    );
    expect(collectionRoutes).toHaveLength(2);
    const commerceAdapter = createCatalogueStorefrontCommerceRouteAdapter();
    const resolvedCollectionSections = collectionRoutes.map((route) => {
      const mapping = dynamicAuthority!.collectionRouteMappings.find(
        ({ routeId }) => routeId === route.id,
      );
      expect(mapping).toBeDefined();
      if (!mapping) throw new Error("A collection route requires one exact archetype mapping.");
      const resolved = resolveDynamicCommerceRoutePage({
        snapshot: proposalDraft!,
        catalogue: fixture.aggregate.catalogue,
        routeId: route.id,
        projection: "runtime",
      });
      const section = resolved.page.sections[0];
      expect(section).toBeDefined();
      expect(section.id).toBe(dynamicCommerceRouteSectionId(route.id, mapping.archetypeId));
      expect(section.approvedAssetPlacements).toHaveLength(1);
      expect(section.approvedAssetPresentations).toHaveLength(1);
      const placementsByRole = new Map(
        section.approvedAssetPlacements?.map((placement) => [placement.role, placement]),
      );
      expect([...placementsByRole.keys()]).toEqual(["editorialImage"]);
      for (const role of ["editorialImage"] as const) {
        expect(placementsByRole.get(role)).toMatchObject({
          pageId: route.id,
          componentId: section.id,
          componentType: "dynamicCollectionCommerce",
          assetSlotId: "collectionCommerceMedia",
          role,
        });
        expect(section.approvedAssetPresentations).toContainEqual(
          expect.objectContaining({ assetId: placementsByRole.get(role)?.assetId, role }),
        );
      }
      const collection = fixture.aggregate.catalogue.collections.find(
        ({ id }) => id === route.collectionId,
      );
      expect(collection).toBeDefined();
      const firstCollectionProduct = fixture.aggregate.catalogue.products.find(
        ({ id }) => id === collection?.productIds[0],
      );
      expect(firstCollectionProduct?.images[0]).toBeDefined();
      const presentation = commerceAdapter.collection({
        aggregate: proposalAggregate!,
        snapshot: proposalDraft!,
        page: resolved.page,
        collection: collection!,
      });
      expect(presentation).not.toBeNull();
      expect(presentation?.projection.collections[0]).toMatchObject({
        collectionId: collection?.id,
        productIds: collection?.productIds,
      });
      expect(
        presentation?.projection.collections[0]?.assets.find(({ role }) => role === "hero")
          ?.assetId,
      ).toBe(firstCollectionProduct?.images[0]?.id);
      expect(
        presentation?.projection.collections[0]?.assets.find(({ role }) => role === "editorial")
          ?.assetId,
      ).toBe(placementsByRole.get("editorialImage")?.assetId);
      return { section, placementsByRole };
    });
    expect(resolvedCollectionSections[0]?.placementsByRole.get("editorialImage")?.assetId).toBe(
      resolvedCollectionSections[1]?.placementsByRole.get("editorialImage")?.assetId,
    );
    expect(proposalAggregate?.catalogue).toEqual(fixture.aggregate.catalogue);
    expect(
      proposalAggregate?.snapshots.find(
        ({ id }) => id === proposalAggregate.project.publishedSnapshotId,
      ),
    ).toEqual(published);
    expect(
      loadP10B16P04ProposalPreviewAuthority({
        projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
        candidateFingerprint: result.lineage.candidateSnapshotFingerprint,
        httpHeaders: acceptanceHeaders(null),
        environment,
      }),
    ).toBeUndefined();
    expect(
      loadP10B16P04ProposalPreviewAuthority({
        projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
        candidateFingerprint: "unknown-candidate-fingerprint",
        httpHeaders: acceptanceHeaders(),
        environment,
      }),
    ).toBeUndefined();
    expect(inspection).not.toHaveProperty("retainedProposalSnapshots");
  }, 120_000);

  it("enforces the three-call budget without retry or legacy fallback", async () => {
    const route = createP10B16P04WholeStorefrontProposalRouteHandler({
      environment,
    });

    const casePrompts = [exactPrompt, technicalPrompt, minimalPrompt] as const;
    for (const [index, merchantPrompt] of casePrompts.entries()) {
      const response = await route(
        request({
          requestId: `p10b16p04-mocked-budget-case-${index + 1}`,
          merchantPrompt,
        }),
      );
      const responseText = await response.clone().text();
      expect(response.status, `case ${index + 1}: ${responseText}`).toBe(200);
    }
    const complete = inspectP10B16P04RealStudioAcceptance(environment);
    expect(complete).toMatchObject({
      providerCallCount: P10B_16P_04_PROVIDER_CALL_BUDGET,
      retryCount: 0,
      status: "complete",
      failureClassification: null,
      activeAttempt: null,
    });
    expect(complete.cases.map(({ caseNumber }) => caseNumber)).toEqual([1, 2, 3]);
    expect(new Set(complete.cases.map(({ selection }) => selection.directionId))).toHaveLength(3);
    expect(new Set(complete.cases.map(({ intentFingerprint }) => intentFingerprint))).toHaveLength(
      3,
    );
    expect(
      new Set(
        complete.cases.map(({ candidateSnapshotFingerprint }) => candidateSnapshotFingerprint),
      ),
    ).toHaveLength(3);

    const exhausted = await route(
      request({ requestId: "p10b16p04-mocked-budget-exhausted", merchantPrompt: technicalPrompt }),
    );
    expect(exhausted.status).toBe(409);
    expect(await exhausted.json()).toEqual({
      ok: false,
      failure: { category: "stale", retryable: false },
    });
    expect(inspectP10B16P04RealStudioAcceptance(environment)).toMatchObject({
      providerCallCount: P10B_16P_04_PROVIDER_CALL_BUDGET,
      retryCount: 0,
      status: "complete",
      failureClassification: null,
      activeAttempt: null,
    });
  }, 120_000);

  it("retains a consumed failure safely and blocks every later provider attempt", async () => {
    const route = createP10B16P04WholeStorefrontProposalRouteHandler({
      environment,
    });

    const first = await route(request({ mockFailure: "provider-transport" }));

    expect(first.status).toBe(503);
    expect(await first.json()).toEqual({
      ok: false,
      failure: { category: "providerUnavailable", retryable: true },
    });
    const failed = inspectP10B16P04RealStudioAcceptance(environment);
    expect(failed).toMatchObject({
      providerCallCount: 1,
      retryCount: 0,
      status: "failed",
      failureClassification: "provider-transport",
      activeAttempt: null,
      cases: [],
      failedAttempt: {
        caseNumber: 1,
        providerId: "openai-prompted-storefront-design-intent-v2",
        modelId: "mocked-p10b-16p-04-design-intent-v2",
        promptFingerprint: promptedStorefrontPromptFingerprint(exactPrompt),
        failureClassification: "provider-transport",
      },
    });
    expect(failed.failedAttempt?.requestFingerprint.length).toBeGreaterThan(20);
    expect(failed.failedAttempt?.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(failed.failedAttempt?.failedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(failed)).not.toContain(exactPrompt);

    const blocked = await route(
      request({
        requestId: "p10b16p04-after-terminal-failure",
        merchantPrompt: technicalPrompt,
      }),
    );
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({
      ok: false,
      failure: { category: "stale", retryable: false },
    });
    expect(inspectP10B16P04RealStudioAcceptance(environment)).toMatchObject({
      providerCallCount: 1,
      retryCount: 0,
      status: "failed",
      cases: [],
      failedAttempt: failed.failedAttempt,
    });
  });

  it.each([
    [null, origin],
    ["p10b16p04_wrong_acceptance_token_0001", origin],
    [acceptanceToken, null],
    [acceptanceToken, "http://localhost:4999"],
  ] as const)(
    "rejects invalid acceptance authority token=%s origin=%s before provider selection",
    async (token, requestOrigin) => {
      const route = createP10B16P04WholeStorefrontProposalRouteHandler({
        environment,
      });

      const response = await route(request({ token, requestOrigin }));

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        ok: false,
        failure: { category: "authenticationUnavailable", retryable: false },
      });
      expect(inspectP10B16P04RealStudioAcceptance(environment)).toMatchObject({
        providerCallCount: 0,
        retryCount: 0,
        status: "ready",
        cases: [],
      });
    },
  );

  it("fails closed on untrusted OpenAI transport configuration before consuming call budget", async () => {
    const untrustedEnvironment = {
      ...environment,
      OPENAI_API_KEY: "test-only-placeholder",
      OPENAI_CUSTOM_HEADERS: "x-untrusted: must-not-be-used",
      [P10B_16P_04_MOCK_TRANSPORT_FLAG]: "0",
    } as const;
    const route = createP10B16P04WholeStorefrontProposalRouteHandler({
      environment: untrustedEnvironment,
    });

    const response = await route(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      failure: { category: "providerUnavailable", retryable: true },
    });
    expect(inspectP10B16P04RealStudioAcceptance(untrustedEnvironment)).toMatchObject({
      provider: {
        category: "transport-configuration-unavailable",
        credentialsAvailable: false,
        transport: {
          canonicalBaseUrl: true,
          customHeadersConfigured: true,
          proxyConfigured: false,
        },
      },
      providerCallCount: 0,
      retryCount: 0,
      status: "ready",
      activeAttempt: null,
      failedAttempt: null,
      cases: [],
    });
  });

  it("keeps configuration, page-loader authority and inspection behind the exact local gate", () => {
    const fixture = createP10B16P04RawAurumCommercialFixture();
    const authorizedHeaders = acceptanceHeaders();
    const wrongHeaders = acceptanceHeaders("p10b16p04_wrong_acceptance_token_0001");

    expect(isP10B16P04RealStudioAcceptanceConfigured(environment)).toBe(true);
    expect(configuredP10B16P04AcceptanceToken(environment)).toBe(acceptanceToken);
    expect(
      isP10B16P04RealStudioAcceptanceConfigured({
        ...environment,
        NODE_ENV: "production",
      }),
    ).toBe(false);
    expect(
      isP10B16P04RealStudioAcceptanceConfigured({
        ...environment,
        VESKIFY_RUNTIME_MODE: "standalone",
      }),
    ).toBe(false);
    expect(
      configuredP10B16P04AcceptanceToken({
        ...environment,
        [P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN]: "too-short",
      }),
    ).toBeNull();

    expect(
      loadP10B16P04CurrentEvidenceReferences({
        projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
        httpHeaders: authorizedHeaders,
        environment,
      }),
    ).toEqual(fixture.approvedEvidenceReferences);
    expect(
      loadP10B16P04InitialDraftAuthority({
        projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
        httpHeaders: authorizedHeaders,
        environment,
      }),
    ).toEqual({
      draftSnapshotId: fixture.rawDraft.id,
      draftRevision: fixture.rawDraft.revision,
      contentFingerprint: canonicalStorefrontContentFingerprint(fixture.rawDraft),
    });
    expect(
      loadP10B16P04CurrentEvidenceReferences({
        projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
        httpHeaders: wrongHeaders,
        environment,
      }),
    ).toBeUndefined();
    expect(
      loadP10B16P04InitialDraftAuthority({
        projectId: "project_unknown",
        httpHeaders: authorizedHeaders,
        environment,
      }),
    ).toBeUndefined();

    const inspect = createP10B16P04AcceptanceInspectionHandler({ environment });
    expect(inspect(new Request(`${origin}/api/demo/p10b-16p-04`)).status).toBe(404);
    const response = inspect(
      new Request(`${origin}/api/demo/p10b-16p-04`, { headers: authorizedHeaders }),
    );
    expect(response.status).toBe(200);
  });
});
