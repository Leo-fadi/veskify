import { describe, expect, it } from "vitest";
import {
  createApprovedGenerationAssetContextFingerprint,
  planRegisteredTokenRefinement,
} from "@/application/ai-storefront-generation";
import {
  WholeStorefrontProposalAcceptanceCoordinator,
  WholeStorefrontProposalError,
  compileWholeStorefrontProposal,
  createWholeStorefrontRuntimeState,
  replayWholeStorefrontProposalOperations,
  validateWholeStorefrontProposal,
  type WholeStorefrontProposalCompilationInput,
} from "@/application/whole-storefront-proposal-lifecycle";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontRecipeContext,
  wholeStorefrontPlanningInputSchema,
} from "@/application/whole-storefront-generation-plan";
import { orderSectionsForRecipe } from "@/application/storefront-design-system";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicSeed } from "@/data/seed";
import { sourceEvidenceSchema, sourceReferenceSchema } from "@/domain/source-discovery";
import { p905dExactTokenRefinementRequest } from "../fixtures/p9-05d-exact-token-refinement";

const now = "2026-07-23T10:00:00.000Z";

function planningInput() {
  const source = sourceReferenceSchema.parse({
    id: "source_p8_02",
    sourceType: "deterministic-fixture",
    url: "https://merchant.example/store",
    normalizedOrigin: "https://merchant.example",
    requestedLocale: "en",
    discoveredAt: now,
    allowedDiscoveryPolicy: {
      mode: "deterministic",
      maxPages: 5,
      maxAssets: 10,
      followSameOriginOnly: true,
    },
    status: "complete",
    warnings: [],
    failure: null,
  });
  const evidence = sourceEvidenceSchema.parse({
    id: "evidence_p8_02",
    kind: "page-identity",
    provenance: { sourceReferenceId: source.id, sourceUrl: source.url, observedAt: now },
    sourceUrl: source.url,
    confidence: 1,
    observedValue: { title: "P8-02 merchant" },
    extractionMethod: "deterministic-test-fixture",
    locale: "en",
    warnings: [],
    uncertainty: { isUncertain: false, reason: null },
  });
  const brief = approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: "brief_p8_02",
      now,
      businessIdentity: { businessName: "P8-02 merchant" },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
      sourceReferenceIds: [source.id],
      sourceEvidenceIds: [evidence.id],
      materialEvidence: {
        sourceReferences: [source],
        evidence: [evidence],
        assetCandidates: [],
        reconciliation: null,
      },
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      pagePlan: { pageTypes: ["home", "collection", "product"] },
      approvedBrandDirection: {
        logoAssetRef: { id: "asset_logo", label: "Merchant logo" },
        supportingImageAssetRefs: [],
        preferredBrandColours: ["#123456"],
        typographyDirection: "serif-led",
        visualStyleDirection: "editorial",
        imageryDirection: "studio",
        toneKeywords: ["warm"],
      },
      assetReviewFingerprint: "asset-review-p8-02",
    }),
    { actorId: "merchant_owner", approvedAt: now },
  );
  return {
    brief,
    project: {
      id: aurumNordicSeed.project.id,
      revision: aurumNordicSeed.project.revision,
      enabledLocales: ["en", "fi"],
    },
    draft: structuredClone(aurumNordicSeed.draftSnapshot),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    componentDefinitions: structuredClone(veskifyComponentDefinitionsV2),
    recipeContext: createWholeStorefrontRecipeContext(),
    approvedAssetContext: null,
    requiredAssetPlacements: [],
  };
}

function input(overrides: Record<string, unknown> = {}): WholeStorefrontProposalCompilationInput {
  const current = planningInput();
  const planning = wholeStorefrontPlanningInputSchema.parse({ ...current, ...overrides });
  return {
    plan: createWholeStorefrontGenerationPlan(planning),
    planningInput: planning,
  };
}

function tokenRefinementInput(): WholeStorefrontProposalCompilationInput {
  const planning = wholeStorefrontPlanningInputSchema.parse(planningInput());
  const tokenRefinement = planRegisteredTokenRefinement(
    "Set primary #355C4A, secondary #7A6652, accent #C58A55, background #FBF7F0, surface #FFFFFF, text #25231F, muted text #686158, and border #D8CFC2. Use Georgia for headings and Inter for body text. Preserve all layouts, sections, products, and images.",
    planning.draft.brandSystem,
  );
  if (tokenRefinement === null) throw new Error("Missing token refinement");
  return {
    plan: createWholeStorefrontGenerationPlan(planning, {
      tokenRefinementPlan: tokenRefinement,
    }),
    planningInput: planning,
  };
}

function exactP905dTokenRefinementInput(): WholeStorefrontProposalCompilationInput {
  const planning = wholeStorefrontPlanningInputSchema.parse(planningInput());
  const tokenRefinement = planRegisteredTokenRefinement(
    p905dExactTokenRefinementRequest,
    planning.draft.brandSystem,
  );
  if (tokenRefinement === null) throw new Error("Missing exact P9-05D token refinement");
  return {
    plan: createWholeStorefrontGenerationPlan(planning, {
      tokenRefinementPlan: tokenRefinement,
    }),
    planningInput: planning,
  };
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof WholeStorefrontProposalError) return error.code;
    throw error;
  }
  throw new Error("Expected a whole-storefront proposal failure");
}

function withApprovedPlacement(): WholeStorefrontProposalCompilationInput {
  const base = input();
  const generated = base.plan.pagePlans
    .flatMap((page) => page.components.map((component) => ({ page, component })))
    .find(
      (
        entry,
      ): entry is {
        page: (typeof base.plan.pagePlans)[number];
        component: Extract<
          (typeof base.plan.pagePlans)[number]["components"][number],
          { instance: unknown }
        >;
      } =>
        "instance" in entry.component &&
        entry.component.instance.component === "dynamicCollectionCommerce",
    );
  if (!generated || !("instance" in generated.component))
    throw new Error("Missing collection component");
  const assetValue = {
    briefId: base.planningInput.brief.id,
    briefRevision: base.planningInput.brief.revision,
    approvedEvidenceFingerprint: base.planningInput.brief.approvedEvidenceFingerprint!,
    assetReviewFingerprint: "asset-review-p8-02",
    assets: [
      {
        assetId: "asset_collection_p8_02",
        role: "collectionImage" as const,
        sourceReferenceId: "source_p8_02",
        revision: "asset-revision-1",
        materialFingerprint: "asset-material-1",
        provenance: { location: "html-meta" as const, observedAt: now },
        alt: { en: "Collection image", fi: "Malliston kuva" },
        presentation: { decorative: false, mediaType: "image/jpeg", responsiveCrops: [] },
        approval: { actorId: "merchant_owner", actorReference: "merchant-session" },
      },
    ],
  };
  const approvedAssetContext = {
    ...assetValue,
    fingerprint: createApprovedGenerationAssetContextFingerprint(assetValue),
  };
  const placement = {
    type: "PLACE_APPROVED_SOURCE_ASSET" as const,
    pageId: generated.page.pageId,
    componentId: generated.component.instance.id,
    componentType: "dynamicCollectionCommerce",
    assetSlotId: "collectionCommerceMedia",
    assetId: assetValue.assets[0].assetId,
    role: assetValue.assets[0].role,
    assetRevision: assetValue.assets[0].revision,
    materialFingerprint: assetValue.assets[0].materialFingerprint,
    sourceReferenceId: assetValue.assets[0].sourceReferenceId,
    required: true,
  };
  return input({ approvedAssetContext, requiredAssetPlacements: [placement] });
}

describe("P8-02 whole-storefront proposal lifecycle", () => {
  it("compiles one reviewable token-only proposal while preserving every page and commerce input", () => {
    const source = tokenRefinementInput();
    const originalPlanningInput = structuredClone(source.planningInput);
    const proposal = compileWholeStorefrontProposal(source);

    expect(proposal.operations).toHaveLength(2 + source.plan.pagePlans.length);
    expect(proposal.operations[0]?.operation).toMatchObject({
      type: "APPLY_REGISTERED_BRAND_SYSTEM",
      refinementId: "validatedTokenRefinement",
      tokenRefinementPlan: source.plan.tokenRefinementPlan,
    });
    expect(proposal.proposedStorefront.pages).toEqual(proposal.originalStorefront.pages);
    expect(proposal.proposedStorefront.navigation).toEqual(proposal.originalStorefront.navigation);
    expect(proposal.proposedStorefront.approvedAssetPlacements).toEqual(
      proposal.originalStorefront.approvedAssetPlacements,
    );
    expect(proposal.proposedStorefront.brandSystem.colors.primary).toBe("#355C4A");
    expect(proposal.proposedStorefront.brandSystem.typography).toMatchObject({
      headingFont: "georgia",
      bodyFont: "inter",
    });
    expect(source.planningInput).toEqual(originalPlanningInput);
    expect(validateWholeStorefrontProposal(proposal, source)).toEqual(proposal);
  });

  it("compiles the exact P9-05D refinement with every explicit semantic token target", () => {
    const source = exactP905dTokenRefinementInput();
    const catalogueBefore = structuredClone(source.planningInput.catalogue);
    const proposal = compileWholeStorefrontProposal(source);

    expect(proposal.proposedStorefront.brandSystem).toMatchObject({
      colors: {
        primary: "#201A17",
        secondary: "#C9A27A",
        accent: "#6B2E3D",
        background: "#FFF8F0",
        surface: "#E7D8C8",
        text: "#201A17",
        border: "#E7D8C8",
      },
      typography: { headingFont: "system-serif", bodyFont: "system-sans" },
      spacing: { density: "balanced" },
    });
    expect(proposal.proposedStorefront.pages).toEqual(proposal.originalStorefront.pages);
    expect(proposal.proposedStorefront.navigation).toEqual(proposal.originalStorefront.navigation);
    expect(proposal.proposedStorefront.approvedAssetPlacements).toEqual(
      proposal.originalStorefront.approvedAssetPlacements,
    );
    expect(source.planningInput.catalogue).toEqual(catalogueBefore);

    const accepted = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    }).accept();
    expect(accepted.state).toBe("accepted");
    expect(accepted.activeStorefront).toEqual(proposal.proposedStorefront);
  });

  it("compiles one validated plan into a deterministic replayable proposal", () => {
    const first = compileWholeStorefrontProposal(input());
    const second = compileWholeStorefrontProposal(input());

    expect(first.id).toBe(second.id);
    expect(first.operations).toEqual(second.operations);
    expect(validateWholeStorefrontProposal(first, input())).toEqual(first);
  });

  it("rejects a plan that drops its canonical executable PageBlueprint identity", () => {
    const source = input();
    source.plan = {
      ...source.plan,
      pageBlueprintMaterializations: source.plan.pageBlueprintMaterializations.slice(1),
    } as typeof source.plan;
    expect(errorCode(() => compileWholeStorefrontProposal(source))).toBe("invalid-plan");
  });

  it("represents replacements, removals and every required approved asset placement", () => {
    const proposal = compileWholeStorefrontProposal(withApprovedPlacement());

    expect(
      proposal.operations.some((entry) => entry.operation.type === "APPLY_PAGE_COMPONENTS"),
    ).toBe(true);
    expect(
      proposal.operations.some((entry) => entry.operation.type === "PLACE_APPROVED_SOURCE_ASSET"),
    ).toBe(true);
    expect(
      proposal.reviewSummary.components.some((component) => component.status === "removed"),
    ).toBe(true);
    const unsupported = input();
    unsupported.planningInput.draft.pages[0].sections[0].styleOverrides = { spacing: "spacious" };
    unsupported.plan = createWholeStorefrontGenerationPlan(unsupported.planningInput);
    expect(errorCode(() => compileWholeStorefrontProposal(unsupported))).toBe(
      "incomplete-required-operation-compilation",
    );
  });

  it("keeps protected commerce as read-only bindings rather than editable proposal content", () => {
    const proposal = compileWholeStorefrontProposal(input());
    const serialized = JSON.stringify(proposal.proposedStorefront);

    expect(serialized).not.toContain('"price"');
    expect(proposal.reviewSummary.protectedFactsPreserved.join(" ")).toMatch(
      /SKU, price, availability/i,
    );
  });

  it("preserves existing page identities and retained component bindings", () => {
    const source = input();
    const proposal = compileWholeStorefrontProposal(source);

    expect(proposal.proposedStorefront.pages.map((page) => page.pageId)).toEqual(
      source.plan.target.pages.map((page) => page.id).sort(),
    );
    expect(proposal.reviewSummary.canonicalBindings).toEqual(source.plan.canonicalCommerceBindings);
  });

  it("discloses visible homepage reordering in the authoritative review summary", () => {
    const source = input();
    const proposal = compileWholeStorefrontProposal(source);
    const originalHome = proposal.originalStorefront.pages.find((page) => page.role === "homepage");
    const proposedHome = proposal.proposedStorefront.pages.find((page) => page.role === "homepage");
    if (!originalHome || !proposedHome) throw new Error("Missing homepage runtime state");

    expect(originalHome.components.map((component) => component.id)).not.toEqual(
      proposedHome.components.map((component) => component.id),
    );
    expect(proposal.reviewSummary.pages).toContainEqual({
      pageId: originalHome.pageId,
      status: "changed",
    });
    expect(
      proposal.reviewSummary.components.filter(
        (component) => component.pageId === originalHome.pageId,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "modified",
          description: "Moves this section within the updated homepage order.",
        }),
      ]),
    );

    const tokenOnly = compileWholeStorefrontProposal(tokenRefinementInput());
    const tokenOnlyHome = tokenOnly.originalStorefront.pages.find(
      (page) => page.role === "homepage",
    );
    if (!tokenOnlyHome) throw new Error("Missing token-only homepage runtime state");
    expect(tokenOnly.reviewSummary.pages).toContainEqual({
      pageId: tokenOnlyHome.pageId,
      status: "retained",
    });
    expect(
      tokenOnly.reviewSummary.components.some(
        (component) =>
          component.description === "Moves this section within the updated homepage order.",
      ),
    ).toBe(false);

    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    });
    expect(coordinator.reject().activeStorefront).toEqual(proposal.originalStorefront);
    expect(coordinator.inspect().proposal.status).toBe("rejected");

    const acceptedCoordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    });
    expect(acceptedCoordinator.accept().activeStorefront).toEqual(proposal.proposedStorefront);
    expect(acceptedCoordinator.undo()).toEqual(proposal.originalStorefront);
    expect(acceptedCoordinator.redo()).toEqual(proposal.proposedStorefront);
  });

  it("keeps reorder reporting complete alongside added, removed, and retained components", () => {
    const source = input();
    const home = source.planningInput.draft.pages.find((page) => page.type === "home");
    if (!home) throw new Error("Missing homepage fixture");
    source.planningInput.brief.businessIdentity.shortDescription =
      "A merchant-approved story for the storefront homepage.";
    home.sections = home.sections.filter((section) => section.component !== "brandStory");
    const assetInput = {
      briefId: source.planningInput.brief.id,
      briefRevision: source.planningInput.brief.revision,
      approvedEvidenceFingerprint: source.planningInput.brief.approvedEvidenceFingerprint!,
      assetReviewFingerprint: source.planningInput.brief.assetReviewFingerprint!,
      assets: [
        {
          assetId: "asset_story_p8_02",
          role: "editorialImage" as const,
          sourceReferenceId: "source_p8_02",
          revision: "asset-revision-1",
          materialFingerprint: "asset-material-story-1",
          provenance: { location: "html-meta" as const, observedAt: now },
          alt: { en: "Brand story image", fi: "Bränditarinan kuva" },
          presentation: { decorative: false, mediaType: "image/jpeg", responsiveCrops: [] },
          approval: { actorId: "merchant_owner", actorReference: "merchant-session" },
        },
      ],
    };
    source.planningInput.approvedAssetContext = {
      ...assetInput,
      fingerprint: createApprovedGenerationAssetContextFingerprint(assetInput),
    };
    source.plan = createWholeStorefrontGenerationPlan(source.planningInput, {
      directionId: "warmApproachable",
    });

    const proposal = compileWholeStorefrontProposal(source);
    const homeSummary = proposal.reviewSummary.pages.find((page) => page.pageId === home.id);

    expect(homeSummary?.status).toBe("changed");
    expect(proposal.reviewSummary.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: "brandStory", status: "added" }),
        expect.objectContaining({ status: "removed" }),
        expect.objectContaining({ component: "header", status: "retained" }),
        expect.objectContaining({
          status: "modified",
          description: "Moves this section within the updated homepage order.",
        }),
      ]),
    );
  });

  it("applies the registered homepage composition while preserving visibility through accept, undo and redo", () => {
    const source = input();
    const home = source.planningInput.draft.pages.find((page) => page.type === "home");
    const collection = source.planningInput.draft.pages.find((page) => page.type === "collection");
    if (!home || !collection) throw new Error("Missing storefront page fixtures");
    const movableIndexes = home.sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.component !== "header" && section.component !== "footer")
      .map(({ index }) => index);
    const first = movableIndexes[0];
    const second = movableIndexes[1];
    if (first === undefined || second === undefined)
      throw new Error("Missing movable storefront sections");
    [home.sections[first], home.sections[second]] = [home.sections[second], home.sections[first]];
    home.sections[first].visible = false;
    source.plan = createWholeStorefrontGenerationPlan(source.planningInput);

    const proposal = compileWholeStorefrontProposal(source);
    const homeRuntime = proposal.proposedStorefront.pages.find((page) => page.pageId === home.id);
    const collectionRuntime = proposal.proposedStorefront.pages.find(
      (page) => page.pageId === collection.id,
    );
    const collectionPlan = source.plan.pagePlans.find((page) => page.pageId === collection.id);
    const replacement = collectionPlan?.components.find(
      (
        component,
      ): component is Extract<(typeof collectionPlan.components)[number], { instance: unknown }> =>
        "instance" in component && component.disposition === "replacement",
    );
    if (!homeRuntime || !collectionRuntime || !replacement || !("instance" in replacement)) {
      throw new Error("Missing compiled storefront replacement");
    }

    const homepageRecipe = source.planningInput.recipeContext.designSystem.homepageRecipes.find(
      (recipe) => recipe.id === source.plan.designSystemSelection.homepageRecipeId,
    );
    if (!homepageRecipe) throw new Error("Missing selected homepage recipe");
    expect(homeRuntime.components.map((component) => component.id)).toEqual(
      orderSectionsForRecipe(home.sections, homepageRecipe).map((section) => section.id),
    );
    expect(
      homeRuntime.components.find((component) => component.id === home.sections[first].id)?.visible,
    ).toBe(false);
    const replacementIndex = collectionRuntime.components.findIndex(
      (component) => component.id === replacement.instance.id,
    );
    const firstReplacedIndex = Math.min(
      ...replacement.replacesComponentIds.map((componentId) =>
        collection.sections.findIndex((section) => section.id === componentId),
      ),
    );
    expect(replacementIndex).toBe(firstReplacedIndex);
    expect(proposal.reviewSummary.visibilityChanges).toEqual([]);

    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    });
    expect(coordinator.accept().activeStorefront).toEqual(proposal.proposedStorefront);
    expect(coordinator.undo()).toEqual(proposal.originalStorefront);
    expect(coordinator.redo()).toEqual(proposal.proposedStorefront);
  });

  it("uses the normalized plan component order for fully new pages", () => {
    const source = input();
    source.planningInput.draft.pages = source.planningInput.draft.pages.filter(
      (page) => page.type === "home",
    );
    source.planningInput.draft.navigation = { primary: [], footer: [] };
    source.plan = createWholeStorefrontGenerationPlan(source.planningInput);

    const proposal = compileWholeStorefrontProposal(source);
    for (const pagePlan of source.plan.pagePlans.filter((page) => page.disposition === "created")) {
      const runtime = proposal.proposedStorefront.pages.find(
        (page) => page.pageId === pagePlan.pageId,
      );
      if (!runtime) throw new Error("Missing created runtime page");
      expect(runtime.components.map((component) => component.id)).toEqual(
        pagePlan.components.flatMap((component) =>
          "instance" in component ? [component.instance.id] : [],
        ),
      );
    }
  });

  it("blocks stale project and draft inputs before review or acceptance", () => {
    const cases: Array<{
      mutate: (value: WholeStorefrontProposalCompilationInput) => void;
      expected: string;
    }> = [
      {
        mutate: (value) => {
          value.planningInput.project.revision += 1;
        },
        expected: "stale-project",
      },
      {
        mutate: (value) => {
          value.planningInput.draft.revision += 1;
        },
        expected: "stale-draft",
      },
    ];
    for (const { mutate, expected } of cases) {
      const source = input();
      const proposal = compileWholeStorefrontProposal(source);
      const current = structuredClone(source);
      mutate(current);
      expect(errorCode(() => validateWholeStorefrontProposal(proposal, current))).toBe(expected);
    }
  });

  it("blocks stale registry and commerce inputs before review or acceptance", () => {
    const cases: Array<{
      mutate: (value: WholeStorefrontProposalCompilationInput) => void;
      expected: string;
    }> = [
      {
        mutate: (value) => {
          value.planningInput.componentDefinitions[0].version.patch += 1;
        },
        expected: "stale-registry",
      },
      {
        mutate: (value) => {
          value.planningInput.catalogue.products[0].title.en = "Changed";
        },
        expected: "stale-commerce",
      },
    ];
    for (const { mutate, expected } of cases) {
      const source = input();
      const proposal = compileWholeStorefrontProposal(source);
      const current = structuredClone(source);
      mutate(current);
      expect(errorCode(() => validateWholeStorefrontProposal(proposal, current))).toBe(expected);
    }
  });

  it("blocks a stale approved asset context before review or acceptance", () => {
    const source = withApprovedPlacement();
    const proposal = compileWholeStorefrontProposal(source);
    const current = structuredClone(source);
    if (current.planningInput.approvedAssetContext === null)
      throw new Error("Missing asset context");
    const assetContext = current.planningInput.approvedAssetContext;
    const { fingerprint, ...assetInputWithoutFingerprint } = structuredClone(assetContext);
    expect(fingerprint).toBe(assetContext.fingerprint);
    assetContext.assets[0].materialFingerprint = "changed-asset-material";
    assetContext.fingerprint = createApprovedGenerationAssetContextFingerprint({
      ...assetInputWithoutFingerprint,
      assets: assetContext.assets,
    });

    expect(errorCode(() => validateWholeStorefrontProposal(proposal, current))).toBe(
      "stale-approved-asset-context",
    );
  });

  it("produces a normalized deterministic review summary", () => {
    const proposal = compileWholeStorefrontProposal(withApprovedPlacement());

    expect(proposal.reviewSummary.pages.map((page) => page.pageId)).toEqual(
      [...proposal.reviewSummary.pages.map((page) => page.pageId)].sort(),
    );
    expect(proposal.reviewSummary.components.map((component) => component.componentId)).toEqual(
      [...proposal.reviewSummary.components.map((component) => component.componentId)].sort(),
    );
  });

  it("accepts all component and approved-asset operations as one transaction", () => {
    const source = withApprovedPlacement();
    const proposal = compileWholeStorefrontProposal(source);
    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    });

    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    expect(accepted.transaction).not.toBeNull();
    expect(accepted.activeStorefront).toEqual(proposal.proposedStorefront);
  });

  it("leaves active state and history unchanged when acceptance becomes stale", () => {
    const source = input();
    const proposal = compileWholeStorefrontProposal(source);
    let current = source;
    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => current,
    });
    const before = coordinator.inspect().activeStorefront;
    current = structuredClone(source);
    current.planningInput.draft.revision += 1;

    const result = coordinator.accept();
    expect(result.state).toBe("stale");
    expect(result.failure?.code).toBe("stale-draft");
    expect(result.activeStorefront).toEqual(before);
    expect(coordinator.undo()).toBeUndefined();
  });

  it("reject and close leave the active storefront unchanged", () => {
    const source = input();
    const proposal = compileWholeStorefrontProposal(source);
    const rejected = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    });
    const closed = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    });

    expect(rejected.reject().activeStorefront).toEqual(proposal.originalStorefront);
    expect(closed.close().activeStorefront).toEqual(proposal.originalStorefront);
  });

  it("restores accepted proposals to their accepted graph without reapplying operations", () => {
    const source = withApprovedPlacement();
    const proposal = compileWholeStorefrontProposal(source);
    const accepted = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    }).accept();
    const restored = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal: accepted.proposal,
      currentInput: () => source,
    });

    expect(restored.inspect().state).toBe("accepted");
    expect(restored.inspect().activeStorefront).toEqual(accepted.proposal.proposedStorefront);
    expect(restored.inspect().transaction).toBeNull();
    expect(restored.accept().failure?.code).toBe("duplicate-acceptance");
    expect(restored.inspect().activeStorefront).toEqual(accepted.proposal.proposedStorefront);
  });

  it("restores pending, rejected and closed proposal persistence states to the original graph", () => {
    const source = input();
    const proposal = compileWholeStorefrontProposal(source);
    const pending = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    });
    const rejectedProposal = pending.reject().proposal;
    const closedProposal = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    }).close().proposal;

    expect(pending.inspect().activeStorefront).toEqual(proposal.originalStorefront);
    expect(
      new WholeStorefrontProposalAcceptanceCoordinator({
        proposal: rejectedProposal,
        currentInput: () => source,
      }).inspect().activeStorefront,
    ).toEqual(proposal.originalStorefront);
    expect(
      new WholeStorefrontProposalAcceptanceCoordinator({
        proposal: closedProposal,
        currentInput: () => source,
      }).inspect().activeStorefront,
    ).toEqual(proposal.originalStorefront);
  });

  it("undo and redo restore the exact coordinated storefront states", () => {
    const source = withApprovedPlacement();
    const proposal = compileWholeStorefrontProposal(source);
    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal,
      currentInput: () => source,
    });

    coordinator.accept();
    expect(coordinator.undo()).toEqual(proposal.originalStorefront);
    expect(coordinator.redo()).toEqual(proposal.proposedStorefront);
  });

  it("never accepts a proposal whose projection is not reproducible from its operations", () => {
    const source = input();
    const proposal = compileWholeStorefrontProposal(source);
    proposal.proposedStorefront.pages[0].components = [];

    expect(() => validateWholeStorefrontProposal(proposal, source)).toThrow(
      WholeStorefrontProposalError,
    );
    expect(() =>
      replayWholeStorefrontProposalOperations(proposal.originalStorefront, proposal.operations),
    ).not.toThrow();
    expect(createWholeStorefrontRuntimeState(source)).toEqual(proposal.originalStorefront);
  });
});
