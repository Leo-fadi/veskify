import { describe, expect, it } from "vitest";
import {
  createApprovedGenerationAssetContext,
  createApprovedGenerationAssetContextFingerprint,
  validateApprovedAssetPlacementOperations,
} from "@/application/ai-storefront-generation";
import { assetReviewBriefData } from "@/application/asset-review";
import {
  assignAssetCandidateRole,
  approveAssetCandidate,
  registerDiscoveredAssetCandidates,
} from "@/domain/asset-review";
import { dynamicCollectionCommerceDefinition } from "@/components/registry/dynamic-collection-commerce";
import {
  approveStorefrontDesignBrief,
  createDeterministicMockDiscoveryAdapter,
  updateStorefrontDesignBriefReview,
} from "@/application/source-discovery";
import {
  OnboardingService,
  UrlBriefWorkflowService,
  type CanonicalCommerceProjectionProvider,
} from "@/application/onboarding";
import { aurumNordicSeed } from "@/data/seed";
import {
  currentUrlBrief,
  onboardingSessionSchema,
  urlBriefWorkflowMaterialEvidence,
  urlBriefWorkflowSchema,
  type OnboardingSession,
  type UrlBriefWorkflow,
} from "@/domain/onboarding";
import type {
  OnboardingSessionLoadResult,
  OnboardingSessionRepository,
} from "@/services/onboarding";

const now = "2026-07-23T10:00:00.000Z";

class MemoryOnboardingRepository implements OnboardingSessionRepository {
  session: OnboardingSession | undefined;

  load(): Promise<OnboardingSessionLoadResult> {
    return Promise.resolve(
      this.session ? { status: "found", session: this.session } : { status: "missing" },
    );
  }

  save(session: OnboardingSession): Promise<void> {
    this.session = onboardingSessionSchema.parse(structuredClone(session));
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.session = undefined;
    return Promise.resolve();
  }
}

const commerce: CanonicalCommerceProjectionProvider = { load: () => aurumNordicSeed.catalogue };

async function approvedWorkflow(): Promise<UrlBriefWorkflow> {
  const repository = new MemoryOnboardingRepository();
  await new OnboardingService(repository, {
    createId: () => "onboarding_assets",
    now: () => now,
  }).createSession();
  const service = new UrlBriefWorkflowService(
    repository,
    createDeterministicMockDiscoveryAdapter(),
    commerce,
    { now: () => now, createSourceId: () => "source_merchant_assets" },
  );
  await service.submitSourceUrl("https://merchant.example/store");
  await service.discover();
  await service.reconcile();
  await service.proposeBrand();
  await service.prepareBrief({
    businessIdentity: { businessName: "Merchant assets" },
    languagePlan: { selectedLanguages: ["en"], primaryLanguage: "en" },
    approvedBrandDirection: {
      logoAssetRef: { id: "asset_merchant_logo", label: "Merchant logo" },
      supportingImageAssetRefs: [],
      preferredBrandColours: ["#123456"],
      typographyDirection: "serif-led",
      visualStyleDirection: "editorial",
      imageryDirection: "studio",
      toneKeywords: ["warm"],
    },
    pagePlan: { pageTypes: ["home", "collection", "product"] },
    generationPermissions: { allowAssetReuse: true },
  });
  return structuredClone(repository.session!.urlBriefWorkflow);
}

function withApprovedLogo(workflowInput: UrlBriefWorkflow): UrlBriefWorkflow {
  const workflow = structuredClone(workflowInput);
  const source = workflow.sourceReferences[0];
  const candidate = workflow.assetReview.candidates.find((item) =>
    item.suggestedRoles.includes("logo"),
  )!;
  const assigned = assignAssetCandidateRole({
    state: workflow.assetReview,
    candidateId: candidate.id,
    sourceReferenceId: source.id,
    expectedRevision: candidate.revision,
    role: "logo",
    alt: { en: "Merchant logo", fi: "Kauppiaan logo" },
    actorId: "merchant_owner",
    actorReference: "merchant-session",
    now,
  });
  const approved = approveAssetCandidate({
    state: assigned,
    source,
    candidateId: candidate.id,
    expectedRevision: assigned.candidates.find((item) => item.id === candidate.id)!.revision,
    actorId: "merchant_owner",
    actorReference: "merchant-session",
    now,
  });
  const current = currentUrlBrief(workflow)!;
  const material = urlBriefWorkflowMaterialEvidence(workflow)!;
  const reviewed = assetReviewBriefData(approved);
  const review = updateStorefrontDesignBriefReview(current, {
    now,
    materialEvidence: material,
    approvedReusableAssetIds: reviewed.approvedReusableAssetIds,
    approvedAssetAssignments: reviewed.approvedAssetAssignments,
    assetReviewFingerprint: reviewed.assetReviewFingerprint,
    materialUnresolvedBlockers: [],
  });
  const brief = approveStorefrontDesignBrief(review, {
    actorId: "merchant_owner",
    approvedAt: now,
  });
  return urlBriefWorkflowSchema.parse({
    ...workflow,
    status: "approved",
    lastSafeState: "approved",
    assetReview: approved,
    briefRevisions: [brief],
    currentBriefRevision: brief.revision,
    approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint,
    updatedAt: now,
  });
}

describe("P7-05 approved source-asset generation context", () => {
  it("admits only the current approved projection and strips remote URLs", async () => {
    const context = createApprovedGenerationAssetContext({
      workflow: withApprovedLogo(await approvedWorkflow()),
    });

    expect(context.assets).toHaveLength(1);
    expect(context.assets[0]).toMatchObject({
      role: "logo",
      approval: { actorId: "merchant_owner" },
    });
    expect(JSON.stringify(context)).not.toContain("https://");
    expect(context.fingerprint).toBe(
      createApprovedGenerationAssetContextFingerprint({ ...context, assets: [...context.assets] }),
    );
  });

  it("rejects changed review fingerprints, required unresolved assets, and cross-source records", async () => {
    const workflow = withApprovedLogo(await approvedWorkflow());
    const changedFingerprint = structuredClone(workflow);
    changedFingerprint.assetReview.materialFingerprint = "changed";
    expect(() => createApprovedGenerationAssetContext({ workflow: changedFingerprint })).toThrow(
      /material asset fingerprint is stale/i,
    );

    const original = workflow.assetReview.candidates[0].originalCandidate;
    const unresolvedAsset = {
      ...original,
      id: "asset_required_for_generation",
      source: { kind: "source-url" as const, url: "https://merchant.example/media/required.jpg" },
      provenance: {
        ...original.provenance,
        sourceUrl: "https://merchant.example/media/required.jpg",
      },
      fingerprint: { algorithm: "sha256" as const, value: "required-generation-material" },
    };
    const unresolved = {
      ...workflow,
      assetReview: registerDiscoveredAssetCandidates({
        state: workflow.assetReview,
        source: workflow.sourceReferences[0],
        candidates: [unresolvedAsset],
        requiredCandidateIds: [unresolvedAsset.id],
        now,
      }),
    };
    expect(() => createApprovedGenerationAssetContext({ workflow: unresolved })).toThrow(
      /resolve every required/i,
    );
  });

  it("validates only compatible presentation slots and prevents public product-media mutation", async () => {
    const context = createApprovedGenerationAssetContext({
      workflow: withApprovedLogo(await approvedWorkflow()),
    });
    const brandHeader = structuredClone(dynamicCollectionCommerceDefinition);
    brandHeader.type = "brandHeader";
    brandHeader.assetSlots = [
      {
        id: "brandLogo",
        title: { en: "Logo", fi: "Logo" },
        acceptedRoles: ["logo"],
        required: false,
        minItems: 0,
        maxItems: 1,
      },
    ];
    const definitions = [brandHeader];
    const operation = {
      type: "PLACE_APPROVED_SOURCE_ASSET" as const,
      pageId: "page_home",
      componentType: "brandHeader",
      assetSlotId: "brandLogo",
      assetId: context.assets[0].assetId,
      role: "logo" as const,
      required: true,
    };

    expect(
      validateApprovedAssetPlacementOperations({
        context,
        operations: [operation],
        componentDefinitions: definitions,
      }),
    ).toEqual([operation]);
    expect(() =>
      validateApprovedAssetPlacementOperations({
        context,
        operations: [{ ...operation, assetSlotId: "unknown" }],
        componentDefinitions: definitions,
      }),
    ).toThrow(/not compatible/i);
    expect(() =>
      validateApprovedAssetPlacementOperations({
        context: (() => {
          const productContext = {
            ...context,
            assets: [{ ...context.assets[0], role: "productMainImage" as const }],
          };
          return {
            ...productContext,
            fingerprint: createApprovedGenerationAssetContextFingerprint(productContext),
          };
        })(),
        operations: [
          {
            ...operation,
            componentType: "dynamicCollectionCommerce",
            assetSlotId: "collectionCommerceMedia",
            role: "productMainImage",
          },
        ],
        componentDefinitions: [dynamicCollectionCommerceDefinition],
      }),
    ).toThrow(/cannot replace canonical product/i);
  });
});
