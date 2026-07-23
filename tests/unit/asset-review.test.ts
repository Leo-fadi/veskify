import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  approveAssetCandidate,
  approvedAssetProjection,
  assignAssetCandidateRole,
  createEmptyAssetReviewState,
  listAssetCandidatesRequiringReview,
  markAssetCandidateUnavailable,
  registerDiscoveredAssetCandidates,
  rejectAssetCandidate,
} from "@/domain/asset-review";
import { assetReviewBriefData } from "@/application/asset-review";
import { storefrontAssetMetadataSchema } from "@/domain/component-platform";
import { aurumNordicSeed } from "@/data/seed";
import {
  assetCandidateSchema,
  sourceReferenceSchema,
  type AssetCandidate,
  type SourceReference,
} from "@/domain/source-discovery";

const now = "2026-07-22T16:00:00.000Z";

function source(id = "source_asset_review", origin = "https://merchant.example") {
  return sourceReferenceSchema.parse({
    id,
    sourceType: "merchant-provided-url",
    url: `${origin}/`,
    normalizedOrigin: origin,
    requestedLocale: "en",
    discoveredAt: now,
    allowedDiscoveryPolicy: {
      mode: "deterministic",
      maxPages: 5,
      maxAssets: 20,
      followSameOriginOnly: true,
    },
    status: "complete",
    warnings: [],
    failure: null,
  });
}

function candidate(
  input: Partial<AssetCandidate> & {
    id?: string;
    source?: AssetCandidate["source"];
    sourceReferenceId?: string;
  } = {},
): AssetCandidate {
  const id = input.id ?? "asset_review_logo";
  const sourceReferenceId = input.sourceReferenceId ?? "source_asset_review";
  const assetSource = input.source ?? {
    kind: "source-url" as const,
    url: "https://merchant.example/media/logo.svg",
  };
  const sourceUrl =
    assetSource.kind === "source-url" ? assetSource.url : "https://merchant.example/";
  return assetCandidateSchema.parse({
    id,
    role: input.role ?? "logo",
    source: assetSource,
    dimensions: input.dimensions ?? { width: 800, height: 400 },
    mediaType: input.mediaType ?? "image/svg+xml",
    provenance: input.provenance ?? {
      sourceReferenceId,
      sourceUrl,
      documentUrl: sourceReferenceId.includes("other")
        ? "https://other.example/"
        : "https://merchant.example/",
      observedAt: now,
      extractionLocation: "head logo metadata",
    },
    confidence: input.confidence ?? 0.99,
    proposedReusePurpose: input.proposedReusePurpose ?? "Use as the merchant logo after review.",
    licensingUsageConfirmation: input.licensingUsageConfirmation ?? "pending",
    warnings: input.warnings ?? [],
    uncertainty: input.uncertainty ?? {
      isUncertain: true,
      reason: "Merchant approval is required before reuse.",
    },
    fingerprint: input.fingerprint ?? { algorithm: "sha256", value: `${id}_material` },
    duplicateOfAssetId: input.duplicateOfAssetId ?? null,
  });
}

function discovered(
  asset = candidate(),
  sourceReference: SourceReference = source(),
  requiredCandidateIds: readonly string[] = [],
) {
  return registerDiscoveredAssetCandidates({
    state: createEmptyAssetReviewState(),
    source: sourceReference,
    candidates: [asset],
    requiredCandidateIds,
    now,
  });
}

function assigned(state = discovered(), candidateId = "asset_review_logo") {
  const current = state.candidates.find((item) => item.id === candidateId)!;
  return assignAssetCandidateRole({
    state,
    candidateId,
    sourceReferenceId: current.sourceReferenceId,
    expectedRevision: current.revision,
    role: "logo",
    alt: { en: "Merchant logo", fi: "Kauppiaan logo" },
    actorId: "merchant_asset_owner",
    actorReference: "merchant-session-1",
    now,
  });
}

function approved(state = assigned(), sourceReference: SourceReference = source()) {
  const current = state.candidates[0];
  return approveAssetCandidate({
    state,
    source: sourceReference,
    candidateId: current.id,
    expectedRevision: current.revision,
    actorId: "merchant_asset_owner",
    actorReference: "merchant-session-1",
    now,
  });
}

describe("P7-04 discovered asset review domain", () => {
  it("starts every discovered candidate unapproved regardless of confidence", () => {
    const state = discovered(candidate({ confidence: 1 }));

    expect(state.candidates[0]).toMatchObject({
      status: "discovered",
      selectedRole: null,
      approvalDecision: null,
    });
    expect(approvedAssetProjection(state)).toEqual([]);
    expect(listAssetCandidatesRequiringReview(state)).toHaveLength(1);
  });

  it("requires explicit role confirmation and merchant approval for the approved projection", () => {
    const state = approved();
    const projection = approvedAssetProjection(state);

    expect(projection).toHaveLength(1);
    expect(projection[0]).toMatchObject({
      assetId: "asset_review_logo",
      approvedRole: "logo",
      approvalState: "approved",
      sourceIdentity: {
        sourceReferenceId: "source_asset_review",
        sourceUrl: "https://merchant.example/media/logo.svg",
        finalFetchedUrl: "https://merchant.example/",
      },
      provenance: {
        extractionLocation: "head logo metadata",
        observedAt: now,
      },
    });
    expect(storefrontAssetMetadataSchema.parse(projection[0]?.componentMetadata)).toMatchObject({
      approvalStatus: "approved",
      provenance: { kind: "sourceDiscovered", sourceId: "source_asset_review" },
    });
  });

  it("preserves rejection and provenance as audit history while excluding binding targets", () => {
    const state = discovered();
    const current = state.candidates[0];
    const rejected = rejectAssetCandidate({
      state,
      candidateId: current.id,
      sourceReferenceId: current.sourceReferenceId,
      expectedRevision: current.revision,
      actorId: "merchant_asset_owner",
      note: "This is not our current logo.",
      now,
    });

    expect(rejected.candidates[0]).toMatchObject({
      status: "rejected",
      rejectionDecision: { actorId: "merchant_asset_owner" },
      provenance: { extractionLocation: "head logo metadata" },
    });
    expect(approvedAssetProjection(rejected)).toEqual([]);
    expect(() =>
      approveAssetCandidate({
        state: rejected,
        source: source(),
        candidateId: current.id,
        expectedRevision: rejected.candidates[0].revision,
        actorId: "merchant_asset_owner",
        now,
      }),
    ).toThrow(/rejected asset cannot be approved/i);
  });

  it("rejects unknown, cross-source and stale candidate decisions with typed errors", () => {
    const state = discovered();

    for (const [candidateId, sourceReferenceId, expectedRevision, code] of [
      ["asset_missing", "source_asset_review", 1, "unknown-candidate"],
      ["asset_review_logo", "source_other", 1, "cross-source-candidate"],
      ["asset_review_logo", "source_asset_review", 99, "stale-review-revision"],
    ] as const) {
      try {
        assignAssetCandidateRole({
          state,
          candidateId,
          sourceReferenceId,
          expectedRevision,
          role: "logo",
          alt: { en: "Logo" },
          actorId: "merchant_asset_owner",
          now,
        });
        throw new Error("Expected the decision to fail.");
      } catch (error) {
        expect(error).toMatchObject({ code });
      }
    }

    expect(() =>
      approveAssetCandidate({
        state,
        source: source(),
        candidateId: "asset_missing",
        expectedRevision: 1,
        actorId: "merchant_asset_owner",
        now,
      }),
    ).toThrow(/no longer available/i);
  });

  it("rejects private or cross-origin provenance before a candidate enters review", () => {
    const privateAsset = candidate({
      source: { kind: "source-url", url: "https://127.0.0.1/logo.svg" },
      provenance: {
        sourceReferenceId: "source_asset_review",
        sourceUrl: "https://127.0.0.1/logo.svg",
        documentUrl: "https://merchant.example/",
        observedAt: now,
        extractionLocation: "head logo metadata",
      },
    });
    const crossOriginAsset = candidate({
      source: { kind: "source-url", url: "https://cdn.example/logo.svg" },
      provenance: {
        sourceReferenceId: "source_asset_review",
        sourceUrl: "https://cdn.example/logo.svg",
        documentUrl: "https://merchant.example/",
        observedAt: now,
        extractionLocation: "head logo metadata",
      },
    });

    for (const asset of [privateAsset, crossOriginAsset]) {
      expect(() => discovered(asset)).toThrow(/safety boundary/i);
    }
  });

  it("fails unsupported role assignment and missing merchant actors safely", () => {
    const state = discovered();

    expect(() =>
      assignAssetCandidateRole({
        state,
        candidateId: "asset_review_logo",
        sourceReferenceId: "source_asset_review",
        expectedRevision: 1,
        role: "arbitraryRemoteImage" as never,
        alt: { en: "Logo" },
        actorId: "merchant_asset_owner",
        now,
      }),
    ).toThrow(/supported storefront asset role/i);
    expect(() =>
      assignAssetCandidateRole({
        state,
        candidateId: "asset_review_logo",
        sourceReferenceId: "source_asset_review",
        expectedRevision: 1,
        role: "logo",
        alt: { en: "Logo" },
        actorId: "",
        now,
      }),
    ).toThrow(/merchant actor/i);
    expect(state.candidates[0]).toMatchObject({ status: "discovered", selectedRole: null });
  });

  it("keeps canonical role suggestions separate until the merchant explicitly confirms one", () => {
    const product = candidate({
      id: "asset_product_candidate",
      role: "product",
      source: { kind: "source-url", url: "https://merchant.example/media/product.jpg" },
      mediaType: "image/jpeg",
    });
    const state = discovered(product);

    expect(state.candidates[0]).toMatchObject({
      discoveredRole: "product",
      suggestedRoles: ["productMainImage", "productAlternativeImage"],
      selectedRole: null,
    });
    const selected = assignAssetCandidateRole({
      state,
      candidateId: product.id,
      sourceReferenceId: source().id,
      expectedRevision: 1,
      role: "productAlternativeImage",
      alt: { en: "Product detail" },
      actorId: "merchant_asset_owner",
      now,
    });
    expect(selected.candidates[0]).toMatchObject({
      selectedRole: "productAlternativeImage",
      roleDecision: { role: "productAlternativeImage" },
    });
  });

  it("deduplicates same-source material deterministically without losing observations or role suggestions", () => {
    const first = candidate({
      id: "asset_duplicate_a",
      fingerprint: { algorithm: "sha256", value: "shared-material" },
    });
    const second = candidate({
      id: "asset_duplicate_b",
      role: "hero",
      fingerprint: { algorithm: "sha256", value: "shared-material" },
    });
    const state = registerDiscoveredAssetCandidates({
      state: createEmptyAssetReviewState(),
      source: source(),
      candidates: [second, first],
      now,
    });

    expect(state.candidates).toHaveLength(1);
    expect(state.candidates[0]).toMatchObject({
      id: "asset_duplicate_a",
      observations: [{ id: "asset_duplicate_a" }, { id: "asset_duplicate_b" }],
      suggestedRoles: ["logo", "heroDesktop", "heroMobile"],
    });

    const required = registerDiscoveredAssetCandidates({
      state,
      source: source(),
      candidates: [first],
      requiredCandidateIds: [first.id],
      now,
    });
    expect(required.candidates[0]?.requiredForBrief).toBe(true);
  });

  it("increments revisions for meaningful duplicate merges but not true no-ops", () => {
    const first = candidate({
      id: "asset_merge_a",
      fingerprint: { algorithm: "sha256", value: "same" },
    });
    const duplicate = candidate({
      id: "asset_merge_b",
      role: "hero",
      fingerprint: { algorithm: "sha256", value: "same" },
    });
    const initial = discovered(first);
    const merged = registerDiscoveredAssetCandidates({
      state: initial,
      source: source(),
      candidates: [duplicate],
      now,
    });

    expect(merged.candidates[0]).toMatchObject({
      revision: 2,
      observations: [{ id: first.id }, { id: duplicate.id }],
    });
    expect(() =>
      assignAssetCandidateRole({
        state: merged,
        candidateId: merged.candidates[0].id,
        sourceReferenceId: source().id,
        expectedRevision: initial.candidates[0].revision,
        role: "logo",
        alt: { en: "Logo" },
        actorId: "merchant_asset_owner",
        now,
      }),
    ).toThrow(/refresh/i);

    const required = registerDiscoveredAssetCandidates({
      state: merged,
      source: source(),
      candidates: [duplicate],
      requiredCandidateIds: [duplicate.id],
      now,
    });
    expect(required.candidates[0]).toMatchObject({ revision: 3, requiredForBrief: true });

    const noOp = registerDiscoveredAssetCandidates({
      state: required,
      source: source(),
      candidates: [duplicate],
      requiredCandidateIds: [duplicate.id],
      now,
    });
    expect(noOp.candidates[0]?.revision).toBe(required.candidates[0]?.revision);
  });

  it("supersedes same-id material changes without inheriting approval", () => {
    const approvedState = approved();
    const changed = candidate({
      id: "asset_review_logo",
      fingerprint: { algorithm: "sha256", value: "same-id-new-material" },
    });

    const state = registerDiscoveredAssetCandidates({
      state: approvedState,
      source: source(),
      candidates: [changed],
      now: "2026-07-23T09:00:00.000Z",
    });
    const old = state.candidates.find((item) => item.id === "asset_review_logo");
    const replacement = state.candidates.find((item) => item.id !== "asset_review_logo");

    expect(old).toMatchObject({
      status: "superseded",
      materialFingerprint: approvedState.candidates[0].materialFingerprint,
      supersededBy: { candidateId: replacement?.id },
    });
    expect(replacement).toMatchObject({
      sourceCandidateId: "asset_review_logo",
      status: "needsReview",
      approvalDecision: null,
      supersedes: { candidateId: "asset_review_logo" },
    });
    expect(typeof replacement?.materialFingerprint).toBe("string");
    expect(replacement?.materialFingerprint).not.toBe(old?.materialFingerprint);
    expect(approvedAssetProjection(state)).toEqual([]);
  });

  it("keeps same-id identical material rediscovery as a no-op and rejects cross-source reuse", () => {
    const initial = discovered();
    const unchanged = registerDiscoveredAssetCandidates({
      state: initial,
      source: source(),
      candidates: [candidate()],
      now,
    });
    expect(unchanged).toMatchObject({ revision: initial.revision, candidates: [{ revision: 1 }] });

    expect(() =>
      registerDiscoveredAssetCandidates({
        state: initial,
        source: source("source_other", "https://other.example"),
        candidates: [
          candidate({
            sourceReferenceId: "source_other",
            source: { kind: "source-url", url: "https://other.example/media/logo.svg" },
            provenance: {
              sourceReferenceId: "source_other",
              sourceUrl: "https://other.example/media/logo.svg",
              documentUrl: "https://other.example/",
              observedAt: now,
              extractionLocation: "head logo metadata",
            },
          }),
        ],
        now,
      }),
    ).toThrow(/different storefront source/i);
  });

  it("returns required unavailable blockers with explicit next actions and bounded summaries", () => {
    const purpose = "A".repeat(500);
    const pending = discovered(candidate({ proposedReusePurpose: purpose }), source(), [
      "asset_review_logo",
    ]);
    const current = pending.candidates[0];
    const unavailable = markAssetCandidateUnavailable({
      state: pending,
      candidateId: current.id,
      sourceReferenceId: current.sourceReferenceId,
      expectedRevision: current.revision,
      reason: "The source image is no longer available.",
      now,
    });
    const [review] = listAssetCandidatesRequiringReview(unavailable);
    const blocker = assetReviewBriefData(unavailable).blockers[0];

    expect(review).toMatchObject({
      id: current.id,
      status: "unavailable",
      unavailableDecision: { reason: "The source image is no longer available." },
      provenance: { sourceReferenceId: current.sourceReferenceId },
      allowedActions: ["reject", "mark-not-required", "select-replacement"],
    });
    expect(blocker).toMatch(/^Asset review: The required logo needs a merchant decision\.$/);
    expect(blocker.length).toBeLessThanOrEqual(500);
    expect(blocker).not.toContain(purpose);
    expect(() =>
      approveAssetCandidate({
        state: unavailable,
        source: source(),
        candidateId: current.id,
        expectedRevision: unavailable.candidates[0].revision,
        actorId: "merchant_asset_owner",
        now,
      }),
    ).toThrow(/unavailable asset/i);
  });

  it("never merges materially identical candidates from different source references", () => {
    const firstSource = source();
    const secondSource = source("source_other", "https://other.example");
    const sharedFingerprint = { algorithm: "sha256" as const, value: "same-binary" };
    const first = candidate({ fingerprint: sharedFingerprint });
    const second = candidate({
      id: "asset_other_source",
      sourceReferenceId: secondSource.id,
      source: { kind: "source-url", url: "https://other.example/media/logo.svg" },
      provenance: {
        sourceReferenceId: secondSource.id,
        sourceUrl: "https://other.example/media/logo.svg",
        documentUrl: "https://other.example/",
        observedAt: now,
        extractionLocation: "head logo metadata",
      },
      fingerprint: sharedFingerprint,
    });
    const firstState = registerDiscoveredAssetCandidates({
      state: createEmptyAssetReviewState(),
      source: firstSource,
      candidates: [first],
      now,
    });
    const state = registerDiscoveredAssetCandidates({
      state: firstState,
      source: secondSource,
      candidates: [second],
      now,
    });

    expect(state.candidates.map((item) => item.sourceReferenceId).sort()).toEqual([
      "source_asset_review",
      "source_other",
    ]);
  });

  it("supersedes an approved material replacement without inheriting approval", () => {
    const approvedState = approved();
    const replacement = candidate({
      id: "asset_review_logo_v2",
      fingerprint: { algorithm: "sha256", value: "changed-material" },
    });
    const state = registerDiscoveredAssetCandidates({
      state: approvedState,
      source: source(),
      candidates: [replacement],
      requiredCandidateIds: [replacement.id],
      now: "2026-07-22T17:00:00.000Z",
    });

    expect(state.candidates.find((item) => item.id === "asset_review_logo")).toMatchObject({
      status: "superseded",
      approvalDecision: { actorId: "merchant_asset_owner" },
      supersededBy: { candidateId: replacement.id },
    });
    expect(state.candidates.find((item) => item.id === replacement.id)).toMatchObject({
      status: "needsReview",
      approvalDecision: null,
      supersedes: { candidateId: "asset_review_logo" },
    });
    expect(approvedAssetProjection(state)).toEqual([]);
  });

  it("excludes later unavailable assets from current approved binding targets", () => {
    const state = approved();
    const current = state.candidates[0];
    const unavailable = markAssetCandidateUnavailable({
      state,
      candidateId: current.id,
      sourceReferenceId: current.sourceReferenceId,
      expectedRevision: current.revision,
      reason: "The remote source now returns 404.",
      now: "2026-07-22T18:00:00.000Z",
    });

    expect(unavailable.candidates[0]).toMatchObject({
      status: "unavailable",
      approvalDecision: { actorId: "merchant_asset_owner" },
      unavailableDecision: { reason: "The remote source now returns 404." },
    });
    expect(approvedAssetProjection(unavailable)).toEqual([]);
  });

  it("does not mutate canonical product media when reviewing a public product image", () => {
    const catalogueBefore = structuredClone(aurumNordicSeed.catalogue);
    const publicProduct = candidate({
      id: "asset_public_product",
      role: "product",
      source: { kind: "source-url", url: "https://merchant.example/media/product.jpg" },
      mediaType: "image/jpeg",
    });
    const state = discovered(publicProduct);
    const selected = assignAssetCandidateRole({
      state,
      candidateId: publicProduct.id,
      sourceReferenceId: source().id,
      expectedRevision: 1,
      role: "productMainImage",
      alt: { en: "Public product presentation" },
      actorId: "merchant_asset_owner",
      now,
    });
    const result = approveAssetCandidate({
      state: selected,
      source: source(),
      candidateId: publicProduct.id,
      expectedRevision: 2,
      actorId: "merchant_asset_owner",
      now,
    });

    expect(approvedAssetProjection(result)[0]?.approvedRole).toBe("productMainImage");
    expect(aurumNordicSeed.catalogue).toEqual(catalogueBefore);
  });

  it("keeps domain modules independent of React, Puck and provider response formats", () => {
    const sources = [
      "src/domain/asset-review/contracts.ts",
      "src/application/asset-review/asset-review-service.ts",
      "src/application/asset-review/workflow-integration.ts",
    ]
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(/from ["'](?:react|@puckeditor|openai)[/"']/i);
    expect(sources).not.toMatch(/responses\.create|chat\.completions|providerPayload/i);
  });
});
