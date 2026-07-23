import { describe, expect, it } from "vitest";
import { createApprovedGenerationAssetContextFingerprint } from "@/application/ai-storefront-generation";
import {
  WholeStorefrontProposalAcceptanceCoordinator,
  WholeStorefrontProposalError,
  compileWholeStorefrontProposal,
  createWholeStorefrontRuntimeState,
  replayWholeStorefrontProposalOperations,
  validateWholeStorefrontProposal,
  type WholeStorefrontProposalCompilationInput,
} from "@/application/whole-storefront-proposal-lifecycle";
import { createWholeStorefrontGenerationPlan, wholeStorefrontPlanningInputSchema } from "@/application/whole-storefront-generation-plan";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicSeed } from "@/data/seed";
import { sourceEvidenceSchema, sourceReferenceSchema } from "@/domain/source-discovery";

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
      (entry): entry is { page: (typeof base.plan.pagePlans)[number]; component: Extract<(typeof base.plan.pagePlans)[number]["components"][number], { instance: unknown }> } =>
        "instance" in entry.component && entry.component.instance.component === "dynamicCollectionCommerce",
    );
  if (!generated || !("instance" in generated.component)) throw new Error("Missing collection component");
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
  it("compiles one validated plan into a deterministic replayable proposal", () => {
    const first = compileWholeStorefrontProposal(input());
    const second = compileWholeStorefrontProposal(input());

    expect(first.id).toBe(second.id);
    expect(first.operations).toEqual(second.operations);
    expect(validateWholeStorefrontProposal(first, input())).toEqual(first);
  });

  it("represents replacements, removals and every required approved asset placement", () => {
    const proposal = compileWholeStorefrontProposal(withApprovedPlacement());

    expect(proposal.operations.some((entry) => entry.operation.type === "APPLY_PAGE_COMPONENTS")).toBe(true);
    expect(proposal.operations.some((entry) => entry.operation.type === "PLACE_APPROVED_SOURCE_ASSET")).toBe(true);
    expect(proposal.reviewSummary.components.some((component) => component.status === "removed")).toBe(true);
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
    expect(proposal.reviewSummary.protectedFactsPreserved.join(" ")).toMatch(/SKU, price, availability/i);
  });

  it("preserves existing page identities and retained component bindings", () => {
    const source = input();
    const proposal = compileWholeStorefrontProposal(source);

    expect(proposal.proposedStorefront.pages.map((page) => page.pageId)).toEqual(
      source.plan.target.pages.map((page) => page.id).sort(),
    );
    expect(proposal.reviewSummary.canonicalBindings).toEqual(source.plan.canonicalCommerceBindings);
  });

  it("blocks stale project, draft, registry, commerce and asset inputs before review or acceptance", () => {
    const cases: Array<{
      mutate: (value: WholeStorefrontProposalCompilationInput) => void;
      expected: string;
    }> = [
      { mutate: (value) => { value.planningInput.project.revision += 1; }, expected: "stale-project" },
      { mutate: (value) => { value.planningInput.draft.revision += 1; }, expected: "stale-draft" },
      { mutate: (value) => { value.planningInput.componentDefinitions[0].version.patch += 1; }, expected: "stale-registry" },
      { mutate: (value) => { value.planningInput.catalogue.products[0].title.en = "Changed"; }, expected: "stale-commerce" },
      {
        mutate: (value) => {
          if (value.planningInput.approvedAssetContext === null) throw new Error("Missing asset context");
          const assetContext = value.planningInput.approvedAssetContext;
          const assetInput = structuredClone(assetContext);
          delete assetInput.fingerprint;
          assetContext.assets[0].materialFingerprint = "changed-asset-material";
          assetContext.fingerprint = createApprovedGenerationAssetContextFingerprint({
            ...assetInput,
            assets: assetContext.assets,
          });
        },
        expected: "stale-approved-asset-context",
      },
    ];
    for (const { mutate, expected } of cases) {
      const source = withApprovedPlacement();
      const proposal = compileWholeStorefrontProposal(source);
      const current = structuredClone(source);
      mutate(current);
      expect(errorCode(() => validateWholeStorefrontProposal(proposal, current))).toBe(expected);
    }
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
    const rejected = new WholeStorefrontProposalAcceptanceCoordinator({ proposal, currentInput: () => source });
    const closed = new WholeStorefrontProposalAcceptanceCoordinator({ proposal, currentInput: () => source });

    expect(rejected.reject().activeStorefront).toEqual(proposal.originalStorefront);
    expect(closed.close().activeStorefront).toEqual(proposal.originalStorefront);
  });

  it("undo and redo restore the exact coordinated storefront states", () => {
    const source = withApprovedPlacement();
    const proposal = compileWholeStorefrontProposal(source);
    const coordinator = new WholeStorefrontProposalAcceptanceCoordinator({ proposal, currentInput: () => source });

    coordinator.accept();
    expect(coordinator.undo()).toEqual(proposal.originalStorefront);
    expect(coordinator.redo()).toEqual(proposal.proposedStorefront);
  });

  it("never accepts a proposal whose projection is not reproducible from its operations", () => {
    const source = input();
    const proposal = compileWholeStorefrontProposal(source);
    proposal.proposedStorefront.pages[0].components = [];

    expect(() => validateWholeStorefrontProposal(proposal, source)).toThrow(WholeStorefrontProposalError);
    expect(() => replayWholeStorefrontProposalOperations(proposal.originalStorefront, proposal.operations)).not.toThrow();
    expect(createWholeStorefrontRuntimeState(source)).toEqual(proposal.originalStorefront);
  });
});
