import { beforeEach, describe, expect, it } from "vitest";
import { AssetReviewPersistenceError, AssetReviewService } from "@/application/asset-review";
import {
  createDeterministicUrlBriefWorkflowService,
  OnboardingService,
  type CanonicalCommerceProjectionProvider,
} from "@/application/onboarding";
import { aurumNordicSeed } from "@/data/seed";
import {
  currentUrlBrief,
  onboardingSessionSchema,
  urlBriefWorkflowMaterialEvidence,
  type OnboardingSession,
} from "@/domain/onboarding";
import {
  assetCandidateSchema,
  createStorefrontSourceEvidenceFingerprint,
} from "@/domain/source-discovery";
import {
  BrowserOnboardingSessionRepository,
  type OnboardingSessionLoadResult,
  type OnboardingSessionRepository,
} from "@/services/onboarding";

const start = Date.parse("2026-07-22T19:00:00.000Z");

function clock() {
  let tick = 0;
  return () => new Date(start + tick++ * 1_000).toISOString();
}

class MemoryOnboardingRepository implements OnboardingSessionRepository {
  session?: OnboardingSession;
  failNextSave = false;

  load(): Promise<OnboardingSessionLoadResult> {
    return Promise.resolve(
      this.session
        ? { status: "found", session: structuredClone(this.session) }
        : { status: "missing" },
    );
  }

  save(session: OnboardingSession): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      return Promise.reject(new Error("simulated asset-review persistence failure"));
    }
    this.session = onboardingSessionSchema.parse(structuredClone(session));
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.session = undefined;
    return Promise.resolve();
  }
}

const commerce: CanonicalCommerceProjectionProvider = {
  load: () => aurumNordicSeed.catalogue,
};

const briefInput = {
  businessIdentity: {
    businessName: "Asset Review Merchant",
    shortDescription: "A merchant reviewing reusable storefront assets.",
    industry: "jewellery",
    targetCustomer: "Design-conscious customers",
    primaryMarket: "Finland",
  },
  languagePlan: { selectedLanguages: ["en"], primaryLanguage: "en" },
  approvedBrandDirection: {
    logoAssetRef: null,
    supportingImageAssetRefs: [],
    preferredBrandColours: ["#123456"],
    typographyDirection: "serif-led",
    visualStyleDirection: "editorial",
    imageryDirection: "studio",
    toneKeywords: ["warm"],
  },
  pagePlan: { pageTypes: ["home", "collection", "product"] },
};

async function setup(repository: OnboardingSessionRepository = new MemoryOnboardingRepository()) {
  const now = clock();
  await new OnboardingService(repository, {
    createId: () => "onboarding_asset_review",
    now,
  }).createSession();
  const urlWorkflow = createDeterministicUrlBriefWorkflowService(repository, commerce, {
    now,
    createSourceId: () => "source_asset_review_flow",
  });
  await urlWorkflow.submitSourceUrl("https://merchant.example/store");
  await urlWorkflow.discover();
  await urlWorkflow.reconcile();
  await urlWorkflow.proposeBrand();
  return {
    repository,
    now,
    urlWorkflow,
    assets: new AssetReviewService(repository, { now }),
  };
}

async function approveDiscoveredLogo(assets: AssetReviewService) {
  const [candidate] = await assets.listCandidatesRequiringReview();
  if (!candidate) throw new Error("Expected a discovered logo candidate.");
  const assigned = await assets.assignRole({
    candidateId: candidate.id,
    sourceReferenceId: candidate.sourceReferenceId,
    expectedRevision: candidate.revision,
    role: "logo",
    alt: { en: "Merchant logo", fi: "Kauppiaan logo" },
    actorId: "merchant_asset_owner",
    actorReference: "merchant-session-asset-review",
  });
  const selected = assigned.candidates.find((item) => item.id === candidate.id)!;
  return assets.approve({
    candidateId: selected.id,
    sourceReferenceId: selected.sourceReferenceId,
    expectedRevision: selected.revision,
    actorId: "merchant_asset_owner",
    actorReference: "merchant-session-asset-review",
  });
}

describe("P7-04 asset-review persistence and Storefront Design Brief integration", () => {
  beforeEach(() => localStorage.clear());

  it("blocks brief approval for a required pending asset and permits it after explicit approval", async () => {
    const { repository, urlWorkflow, assets } = await setup();
    const [candidate] = await assets.listCandidatesRequiringReview();
    if (!candidate) throw new Error("Expected a discovered asset candidate.");
    await assets.markRequired({
      candidateId: candidate.id,
      sourceReferenceId: candidate.sourceReferenceId,
      expectedRevision: candidate.revision,
      required: true,
    });

    const review = await urlWorkflow.prepareBrief(briefInput);
    expect(currentUrlBrief(review)?.materialUnresolvedBlockers).toEqual([
      expect.stringMatching(/^Asset review:/),
    ]);
    await expect(urlWorkflow.approveBrief("merchant_owner")).rejects.toMatchObject({
      code: "conflicting-evidence",
    });

    await approveDiscoveredLogo(assets);
    const approved = await urlWorkflow.approveBrief("merchant_owner");
    const brief = currentUrlBrief(approved);
    expect(brief).toMatchObject({
      status: "approved",
      approvedReusableAssetIds: [candidate.id],
      approvedAssetAssignments: [expect.objectContaining({ assetId: candidate.id, role: "logo" })],
      materialUnresolvedBlockers: [],
    });
    expect(await assets.approvedProjection()).toEqual([
      expect.objectContaining({ assetId: candidate.id, approvedRole: "logo" }),
    ]);

    const persisted = await repository.load();
    if (persisted.status !== "found") throw new Error("Expected a persisted session.");
    expect(persisted.session.urlBriefWorkflow.assetReview.candidates[0]).toMatchObject({
      id: candidate.id,
      status: "approved",
      provenance: {
        sourceReferenceId: candidate.sourceReferenceId,
      },
    });
  });

  it("excludes rejected assets from the reviewable brief while preserving their history", async () => {
    const { urlWorkflow, assets } = await setup();
    const [candidate] = await assets.listCandidatesRequiringReview();
    if (!candidate) throw new Error("Expected a discovered asset candidate.");
    await assets.reject({
      candidateId: candidate.id,
      sourceReferenceId: candidate.sourceReferenceId,
      expectedRevision: candidate.revision,
      actorId: "merchant_asset_owner",
      note: "Do not reuse this logo.",
    });

    const review = await urlWorkflow.prepareBrief(briefInput);
    expect(currentUrlBrief(review)).toMatchObject({
      approvedReusableAssetIds: [],
      approvedAssetAssignments: [],
    });
    expect(await assets.approvedProjection()).toEqual([]);
    expect(
      (await assets.listCandidatesRequiringReview()).find((item) => item.id === candidate.id),
    ).toBeUndefined();
  });

  it("keeps a legacy approved brief valid until a material asset-review change occurs", async () => {
    const { repository, urlWorkflow, assets } = await setup();
    await urlWorkflow.prepareBrief(briefInput);
    await urlWorkflow.approveBrief("merchant_owner");
    const persisted = await repository.load();
    if (persisted.status !== "found") throw new Error("Expected a persisted session.");
    const legacyFingerprint = createStorefrontSourceEvidenceFingerprint(
      urlBriefWorkflowMaterialEvidence(persisted.session.urlBriefWorkflow),
    );
    const legacySession = onboardingSessionSchema.parse({
      ...persisted.session,
      urlBriefWorkflow: {
        ...persisted.session.urlBriefWorkflow,
        approvedEvidenceFingerprint: legacyFingerprint,
        briefRevisions: persisted.session.urlBriefWorkflow.briefRevisions.map((brief) => ({
          ...brief,
          evidenceFingerprint: legacyFingerprint,
          approvedEvidenceFingerprint: legacyFingerprint,
          assetReviewFingerprint: null,
        })),
      },
    });
    await repository.save(legacySession);

    await expect(urlWorkflow.requireApprovedBriefForGeneration()).resolves.toMatchObject({
      status: "approved",
      assetReviewFingerprint: null,
    });

    const [candidate] = await assets.listCandidatesRequiringReview();
    if (!candidate) throw new Error("Expected a discovered asset candidate.");
    await assets.markRequired({
      candidateId: candidate.id,
      sourceReferenceId: candidate.sourceReferenceId,
      expectedRevision: candidate.revision,
      required: true,
    });

    expect((await urlWorkflow.restore()).status).toBe("stale");
    await expect(urlWorkflow.requireApprovedBriefForGeneration()).rejects.toMatchObject({
      code: "stale-brief-approval",
    });
  });

  it("keeps required unavailable candidates actionable after restoration", async () => {
    const repository = new BrowserOnboardingSessionRepository();
    const { urlWorkflow, assets } = await setup(repository);
    const [candidate] = await assets.listCandidatesRequiringReview();
    if (!candidate) throw new Error("Expected a discovered asset candidate.");
    const required = await assets.markRequired({
      candidateId: candidate.id,
      sourceReferenceId: candidate.sourceReferenceId,
      expectedRevision: candidate.revision,
      required: true,
    });
    const requiredCandidate = required.candidates.find((item) => item.id === candidate.id);
    if (!requiredCandidate) throw new Error("Expected a required asset candidate.");
    await assets.markUnavailable({
      candidateId: requiredCandidate.id,
      sourceReferenceId: requiredCandidate.sourceReferenceId,
      expectedRevision: requiredCandidate.revision,
      reason: "The source no longer serves this image.",
    });

    const restoredAssets = new AssetReviewService(new BrowserOnboardingSessionRepository(), {
      now: clock(),
    });
    const [unavailable] = await restoredAssets.listCandidatesRequiringReview();
    expect(unavailable).toMatchObject({
      id: candidate.id,
      status: "unavailable",
      allowedActions: ["reject", "mark-not-required", "select-replacement"],
      unavailableDecision: { reason: "The source no longer serves this image." },
    });
    if (!unavailable) throw new Error("Expected an unavailable review action.");

    await restoredAssets.reject({
      candidateId: unavailable.id,
      sourceReferenceId: unavailable.sourceReferenceId,
      expectedRevision: unavailable.revision,
      actorId: "merchant_asset_owner",
      note: "Do not reuse the unavailable asset.",
    });
    const review = await urlWorkflow.prepareBrief(briefInput);
    expect(currentUrlBrief(review)?.materialUnresolvedBlockers).toEqual([]);
  });

  it("marks an approved brief stale when its material approved-asset set changes", async () => {
    const { repository, urlWorkflow, assets } = await setup();
    await approveDiscoveredLogo(assets);
    await urlWorkflow.prepareBrief(briefInput);
    const approved = await urlWorkflow.approveBrief("merchant_owner");
    const approvedFingerprint = currentUrlBrief(approved)?.approvedEvidenceFingerprint;
    const [projection] = await assets.approvedProjection();
    if (!projection) throw new Error("Expected an approved asset projection.");
    const loaded = await repository.load();
    if (loaded.status !== "found") throw new Error("Expected a persisted session.");
    const candidate = loaded.session.urlBriefWorkflow.assetReview.candidates.find(
      (item) => item.id === projection.assetId,
    )!;

    await assets.markUnavailable({
      candidateId: candidate.id,
      sourceReferenceId: candidate.sourceReferenceId,
      expectedRevision: candidate.revision,
      reason: "The remote candidate is no longer publicly available.",
    });

    const stale = await urlWorkflow.restore();
    expect(stale).toMatchObject({ status: "stale", lastSafeState: "stale" });
    expect(currentUrlBrief(stale)?.approvedEvidenceFingerprint).toBe(approvedFingerprint);
    await expect(urlWorkflow.requireApprovedBriefForGeneration()).rejects.toMatchObject({
      code: "stale-brief-approval",
    });
    expect(await assets.approvedProjection()).toEqual([]);

    const superseded = await urlWorkflow.supersedeStaleBrief();
    expect(superseded.status).toBe("superseded");
    expect(superseded.briefRevisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "superseded", revision: 1 }),
        expect.objectContaining({
          status: "needsReview",
          revision: 2,
          assetReviewFingerprint: superseded.assetReview.materialFingerprint,
        }),
      ]),
    );
    expect(currentUrlBrief(superseded)?.evidenceFingerprint).not.toBe(approvedFingerprint);
    await expect(urlWorkflow.requireApprovedBriefForGeneration()).rejects.toMatchObject({
      code: "stale-brief-approval",
    });
  });

  it("restores decisions, provenance and supersession without inheriting approval", async () => {
    const repository = new BrowserOnboardingSessionRepository();
    const { urlWorkflow, assets, now } = await setup(repository);
    await approveDiscoveredLogo(assets);
    await urlWorkflow.prepareBrief(briefInput);
    await urlWorkflow.approveBrief("merchant_owner");
    const loaded = await repository.load();
    if (loaded.status !== "found") throw new Error("Expected a persisted session.");
    const current = loaded.session.urlBriefWorkflow.assetReview.candidates[0];
    const replacement = assetCandidateSchema.parse({
      ...current.originalCandidate,
      id: "asset_source_asset_review_flow_logo_v2",
      provenance: {
        ...current.originalCandidate.provenance,
        observedAt: now(),
      },
      fingerprint: { algorithm: "sha256", value: "materially-changed-logo" },
    });
    const source = loaded.session.urlBriefWorkflow.sourceReferences[0];
    await assets.synchronizeCandidates({
      source,
      candidates: [replacement],
      requiredCandidateIds: [replacement.id],
    });

    const refreshedAssets = new AssetReviewService(new BrowserOnboardingSessionRepository(), {
      now: clock(),
    });
    const restoredSession = await new BrowserOnboardingSessionRepository().load();
    if (restoredSession.status !== "found") throw new Error("Expected restored persistence.");
    expect(restoredSession.session.urlBriefWorkflow.status).toBe("stale");
    const restoredCandidates = restoredSession.session.urlBriefWorkflow.assetReview.candidates;
    expect(restoredCandidates.find((item) => item.id === current.id)).toMatchObject({
      status: "superseded",
      approvalDecision: { actorId: "merchant_asset_owner" },
      supersededBy: { candidateId: replacement.id },
      provenance: current.provenance,
    });
    expect(restoredCandidates.find((item) => item.id === replacement.id)).toMatchObject({
      status: "needsReview",
      approvalDecision: null,
      supersedes: { candidateId: current.id },
    });
    expect(await refreshedAssets.approvedProjection()).toEqual([]);
    expect(await refreshedAssets.listCandidatesRequiringReview()).toEqual([
      expect.objectContaining({ id: replacement.id, status: "needsReview" }),
    ]);
  });

  it("returns the previous safe state when persistence fails", async () => {
    const repository = new MemoryOnboardingRepository();
    const { assets } = await setup(repository);
    const [candidate] = await assets.listCandidatesRequiringReview();
    if (!candidate) throw new Error("Expected a discovered asset candidate.");
    repository.failNextSave = true;

    await expect(
      assets.assignRole({
        candidateId: candidate.id,
        sourceReferenceId: candidate.sourceReferenceId,
        expectedRevision: candidate.revision,
        role: "logo",
        alt: { en: "Merchant logo" },
        actorId: "merchant_asset_owner",
      }),
    ).rejects.toBeInstanceOf(AssetReviewPersistenceError);

    const restored = await assets.listCandidatesRequiringReview();
    expect(restored).toEqual([
      expect.objectContaining({
        id: candidate.id,
        status: "discovered",
        selectedRole: null,
        revision: candidate.revision,
      }),
    ]);
  });
});
