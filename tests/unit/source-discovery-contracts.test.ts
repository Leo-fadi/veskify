import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { aurumNordicSeed } from "@/data/seed/aurum-nordic";
import {
  createDeterministicMockDiscoveryAdapter,
  discoverStorefrontSource,
  proposeBrandReconstruction,
  reconcileStorefrontSources,
  createStorefrontDesignBrief,
  approveStorefrontDesignBrief,
  createStorefrontDesignBriefEvidenceFingerprint,
  requireApprovedCurrentStorefrontDesignBrief,
  SourceDiscoveryApplicationError,
  supersedeStorefrontDesignBrief,
} from "@/application/source-discovery";
import {
  assetCandidateSchema,
  sourceDiscoveryResultSchema,
  sourceEvidenceSchema,
  sourceReferenceSchema,
  type AssetCandidate,
  type SourceEvidence,
  type SourceReference,
  type StorefrontSourceEvidenceMaterial,
} from "@/domain/source-discovery";

const now = "2026-07-22T10:00:00.000Z";

function sourceReference(overrides: Partial<SourceReference> = {}) {
  return sourceReferenceSchema.parse({
    id: "source_demo",
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
    ...overrides,
  });
}

function evidence(
  kind: SourceEvidence["kind"],
  observedValue: unknown,
  overrides: Partial<SourceEvidence> = {},
): SourceEvidence {
  return sourceEvidenceSchema.parse({
    id: `evidence_${kind.replaceAll("-", "_")}`,
    kind,
    provenance: {
      sourceReferenceId: "source_demo",
      sourceUrl: sourceReference().url,
      observedAt: now,
    },
    sourceUrl: sourceReference().url,
    confidence: 0.8,
    observedValue,
    extractionMethod: "deterministic-test-fixture",
    locale: "en",
    warnings: [],
    uncertainty: { isUncertain: false, reason: null },
    ...overrides,
  });
}

function discovery(...items: SourceEvidence[]) {
  return sourceDiscoveryResultSchema.parse({
    source: sourceReference(),
    evidence: items,
    assetCandidates: [],
    warnings: [],
  });
}

function materialEvidence(
  items: readonly SourceEvidence[],
  reconciliation: StorefrontSourceEvidenceMaterial["reconciliation"] = null,
  assets: readonly AssetCandidate[] = [],
): StorefrontSourceEvidenceMaterial {
  return {
    sourceReferences: [sourceReference()],
    evidence: [...items],
    assetCandidates: [...assets],
    reconciliation,
  };
}

function logoAsset() {
  return assetCandidateSchema.parse({
    id: "asset_logo",
    role: "logo",
    source: { kind: "source-url", url: sourceReference().url },
    dimensions: { width: 320, height: 80 },
    mediaType: "image/png",
    provenance: {
      sourceReferenceId: "source_demo",
      sourceUrl: sourceReference().url,
      observedAt: now,
    },
    confidence: 0.95,
    proposedReusePurpose: "Use as the storefront logo after confirmation.",
    licensingUsageConfirmation: "pending",
    fingerprint: { algorithm: "sha256", value: "logo-fingerprint" },
    duplicateOfAssetId: null,
  });
}

function briefInput(overrides: Record<string, unknown> = {}) {
  const defaultEvidence = evidence("page-identity", { title: "Demo Merchant" });
  return {
    id: "brief_source_demo",
    now,
    businessIdentity: {
      businessName: "Demo Merchant",
      shortDescription: "A small independent shop.",
      industry: "jewellery",
      targetCustomer: "Design-conscious customers",
      primaryMarket: "Finland",
    },
    languagePlan: { selectedLanguages: ["en"], primaryLanguage: "en" },
    sourceReferenceIds: ["source_demo"],
    sourceEvidenceIds: [defaultEvidence.id],
    materialEvidence: materialEvidence([defaultEvidence]),
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
    ...overrides,
  };
}

describe("P7-01 source discovery and Storefront Design Brief contracts", () => {
  it("accepts a valid HTTPS source reference", () => {
    expect(sourceReference().normalizedOrigin).toBe("https://merchant.example");
  });

  it("fails invalid and unsupported URLs with merchant-safe errors", async () => {
    const adapter = createDeterministicMockDiscoveryAdapter();
    await expect(discoverStorefrontSource(adapter, { url: "not-a-url" })).rejects.toMatchObject({
      code: "invalid-url",
    });
    await expect(
      discoverStorefrontSource(adapter, { url: "http://merchant.example" }),
    ).rejects.toMatchObject({ code: "unsupported-protocol" });
  });

  it("rejects a discovery result for another source ID", async () => {
    const result = discovery(evidence("page-type", "home"));
    const adapter = {
      id: "cross-source-result",
      discover: () => ({ ...result, source: sourceReference({ id: "source_other" }) }),
    };

    await expect(discoverStorefrontSource(adapter, sourceReference())).rejects.toMatchObject({
      code: "unavailable-source",
    });
  });

  it("rejects evidence with cross-source provenance", async () => {
    const crossSourceEvidence = evidence("page-type", "home", {
      provenance: {
        sourceReferenceId: "source_other",
        sourceUrl: sourceReference().url,
        documentUrl: sourceReference().url,
        observedAt: now,
        extractionLocation: "cross-source fixture",
      },
    });
    const result = discovery(crossSourceEvidence);
    const adapter = { id: "cross-source-evidence", discover: () => result };

    await expect(discoverStorefrontSource(adapter, sourceReference())).rejects.toMatchObject({
      code: "unavailable-source",
    });
  });

  it("rejects a remotely discovered asset attributed to an unrelated origin", async () => {
    const asset = assetCandidateSchema.parse({
      ...logoAsset(),
      id: "asset_unrelated",
      source: { kind: "source-url", url: "https://unrelated.example/logo.png" },
      provenance: {
        sourceReferenceId: "source_demo",
        sourceUrl: "https://unrelated.example/logo.png",
        observedAt: now,
      },
    });
    const result = sourceDiscoveryResultSchema.parse({
      source: sourceReference(),
      evidence: [],
      assetCandidates: [asset],
      warnings: [],
    });
    const adapter = { id: "unrelated-asset", discover: () => result };

    await expect(discoverStorefrontSource(adapter, sourceReference())).rejects.toMatchObject({
      code: "unavailable-source",
    });
  });

  it("preserves explicitly distinguished merchant-upload provenance", async () => {
    const upload = assetCandidateSchema.parse({
      ...logoAsset(),
      id: "asset_uploaded_logo",
      source: { kind: "merchant-upload", assetId: "upload_logo" },
      provenance: {
        sourceReferenceId: "source_upload",
        sourceUrl: "https://uploads.example/logo.png",
        observedAt: now,
      },
    });
    const result = sourceDiscoveryResultSchema.parse({
      source: sourceReference(),
      evidence: [],
      assetCandidates: [upload],
      warnings: [],
    });

    await expect(
      discoverStorefrontSource(
        { id: "merchant-upload", discover: () => result },
        sourceReference(),
      ),
    ).resolves.toEqual(result);
  });

  it("retains provenance and confidence on every evidence item", () => {
    const result = discovery(
      evidence("page-type", "home"),
      evidence("logo-candidate", { assetId: "asset_logo" }),
    );
    expect(
      result.evidence.every(
        (item) =>
          item.provenance.sourceReferenceId === "source_demo" &&
          item.sourceUrl &&
          item.confidence >= 0,
      ),
    ).toBe(true);
  });

  it("creates a reviewable brand proposal when only a logo is available", () => {
    const proposal = proposeBrandReconstruction({
      source: sourceReference(),
      evidence: [evidence("logo-candidate", { assetId: "asset_logo" })],
      assetCandidates: [logoAsset()],
    });
    expect(proposal.status).toBe("needsReview");
    expect(proposal.merchantApproved).toBe(false);
    expect(proposal.reusedAssetIds).toEqual(["asset_logo"]);
  });

  it("keeps Vesko price authoritative when public price conflicts", () => {
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(
        evidence("product-reference-observed", {
          sku: "RING-AUR-585",
          price: { amount: 1, currency: "EUR" },
        }),
      ),
      canonicalCommerceProjection: aurumNordicSeed.catalogue,
    });
    const decision = result.decisions.find((item) => item.field === "price");
    expect(decision?.kind).toBe("canonical-override");
    expect(decision?.canonicalValue).toEqual({ amount: 1290, currency: "EUR" });
  });

  it("keeps Vesko availability authoritative when public availability conflicts", () => {
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(
        evidence("product-reference-observed", {
          sku: "RING-AUR-585",
          availabilityLabel: { en: "Sold out" },
        }),
      ),
      canonicalCommerceProjection: aurumNordicSeed.catalogue,
    });
    const decision = result.decisions.find((item) => item.field === "availability");
    expect(decision?.kind).toBe("canonical-override");
    expect(decision?.canonicalValue).toBe("inStock");
  });

  it("resolves a unique title-only product match", () => {
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(
        evidence("product-reference-observed", {
          title: { en: "Aurora Ring 585" },
          price: { amount: 1, currency: "EUR" },
        }),
      ),
      canonicalCommerceProjection: aurumNordicSeed.catalogue,
    });
    expect(result.decisions.find((item) => item.field === "product-identity")).toMatchObject({
      kind: "accepted-evidence",
      canonicalProductId: aurumNordicSeed.catalogue.products[0].id,
    });
    expect(result.decisions.find((item) => item.field === "price")?.kind).toBe(
      "canonical-override",
    );
  });

  it("keeps duplicate title-only product matches unresolved", () => {
    const projection = structuredClone(aurumNordicSeed.catalogue);
    const duplicate = structuredClone(projection.products[0]);
    duplicate.id = "product_aurora_duplicate";
    duplicate.sku = "RING-AUR-DUPLICATE";
    duplicate.images = duplicate.images.map((image) => ({
      ...image,
      id: `${image.id}_duplicate`,
    }));
    projection.products.push(duplicate);
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(
        evidence("product-reference-observed", {
          title: { en: "Aurora Ring 585" },
          price: { amount: 1, currency: "EUR" },
        }),
      ),
      canonicalCommerceProjection: projection,
    });
    const identity = result.decisions.find((item) => item.field === "product-identity");
    expect(identity?.kind).toBe("merchant-decision-required");
    expect(identity?.candidateCanonicalIds).toHaveLength(2);
    expect(result.decisions.some((item) => item.field === "price")).toBe(false);
  });

  it("keeps canonical compare-at price authoritative", () => {
    const projection = structuredClone(aurumNordicSeed.catalogue);
    projection.products[0].compareAtPrice = { amount: 1490, currency: "EUR" };
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(
        evidence("product-reference-observed", {
          sku: "RING-AUR-585",
          compareAtPrice: { amount: 5, currency: "EUR" },
        }),
      ),
      canonicalCommerceProjection: projection,
    });
    const decision = result.decisions.find((item) => item.field === "compare-at-price");
    expect(decision).toMatchObject({
      kind: "canonical-override",
      canonicalValue: { amount: 1490, currency: "EUR" },
    });
  });

  it("represents an absent canonical compare-at price without promoting a public value", () => {
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(
        evidence("product-reference-observed", {
          sku: "RING-AUR-585",
          compareAtPrice: { amount: 9999, currency: "EUR" },
        }),
      ),
      canonicalCommerceProjection: aurumNordicSeed.catalogue,
    });
    expect(result.decisions.find((item) => item.field === "compare-at-price")).toMatchObject({
      kind: "canonical-override",
      canonicalValue: null,
    });
  });

  it("does not allow public variant descriptions to override canonical option groups", () => {
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(
        evidence("product-reference-observed", {
          sku: "RING-AUR-585",
          variants: [{ id: "public", label: { en: "Public option" } }],
          optionGroups: [{ id: "public-group" }],
        }),
      ),
      canonicalCommerceProjection: aurumNordicSeed.catalogue,
    });
    expect(
      result.decisions
        .filter((item) => item.kind === "canonical-override")
        .map((item) => item.field),
    ).toEqual(["variants", "order-options"]);
  });

  it("reconciles observed collections against canonical Vesko collections", () => {
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(
        evidence("collection-reference-observed", {
          collectionId: "collection_rings",
          title: { en: "Rings" },
        }),
      ),
      canonicalCommerceProjection: aurumNordicSeed.catalogue,
    });
    const identity = result.decisions.find((item) => item.field === "collection-identity");
    expect(identity).toMatchObject({
      kind: "accepted-evidence",
      canonicalCollectionId: "collection_rings",
    });
  });

  it("does not allow public collection membership to override Vesko membership", () => {
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(
        evidence("collection-reference-observed", {
          collectionId: "collection_rings",
          productIds: ["product_sisu_automatic_watch"],
        }),
      ),
      canonicalCommerceProjection: aurumNordicSeed.catalogue,
    });
    const membership = result.decisions.find((item) => item.field === "collection-membership");
    expect(membership?.kind).toBe("canonical-override");
    expect(membership?.canonicalValue).toEqual(
      aurumNordicSeed.catalogue.collections.find(
        (collection) => collection.id === "collection_rings",
      )?.productIds,
    );
  });

  it("requires merchant review for ambiguous collection-title matches", () => {
    const projection = structuredClone(aurumNordicSeed.catalogue);
    projection.collections.push({
      ...structuredClone(projection.collections[0]),
      id: "collection_rings_alternative",
      slug: "rings-alternative",
    });
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(evidence("collection-reference-observed", { title: { en: "Rings" } })),
      canonicalCommerceProjection: projection,
    });
    const identity = result.decisions.find((item) => item.field === "collection-identity");
    expect(identity?.kind).toBe("merchant-decision-required");
    expect(identity?.candidateCanonicalIds).toEqual([
      "collection_rings",
      "collection_rings_alternative",
    ]);
    expect(result.missingInformationIds).toEqual([identity?.id]);
  });

  it("preserves reusable asset source, licensing status, and duplicate metadata", () => {
    const asset = logoAsset();
    expect(asset.source).toEqual({ kind: "source-url", url: sourceReference().url });
    expect(asset.licensingUsageConfirmation).toBe("pending");
    expect(asset.fingerprint?.value).toBe("logo-fingerprint");
  });

  it("keeps uncertain design evidence explicitly uncertain", () => {
    const item = evidence("typography-signal", "serif", {
      uncertainty: { isUncertain: true, reason: "Only one page was observed." },
    });
    expect(item.uncertainty.isUncertain).toBe(true);
    const result = reconcileStorefrontSources({
      source: sourceReference(),
      discovery: discovery(item),
      canonicalCommerceProjection: aurumNordicSeed.catalogue,
    });
    expect(result.decisions[0]?.merchantDecisionRequired).toBe(true);
    expect(result.missingInformationIds).toEqual([result.decisions[0]?.id]);
    const brief = createStorefrontDesignBrief(
      briefInput({
        sourceEvidenceIds: [item.id],
        materialEvidence: materialEvidence([item], result),
      }),
    );
    expect(brief.unresolvedItems).toContain("Only one page was observed.");
  });

  it("does not populate brand voice from uncertain marketing copy", () => {
    const uncertainCopy = evidence("marketing-copy-candidate", "Unverified luxury claim", {
      confidence: 0.95,
      uncertainty: { isUncertain: true, reason: "The copy source is ambiguous." },
    });
    const trustedCopy = evidence("marketing-copy-candidate", "Warm and considered", {
      id: "evidence_trusted_marketing_copy",
      confidence: 0.85,
    });
    const proposal = proposeBrandReconstruction({
      source: sourceReference(),
      evidence: [uncertainCopy, trustedCopy],
      assetCandidates: [],
    });

    expect(proposal.toneOfVoice).toEqual(["Warm and considered"]);
    expect(proposal.evidenceReferenceIds).toContain(uncertainCopy.id);
    expect(proposal.warnings).toContainEqual({
      code: "uncertain-evidence",
      message: "The copy source is ambiguous.",
    });
  });

  it("does not approve a brief with material unresolved blockers", () => {
    const brief = createStorefrontDesignBrief(
      briefInput({
        materialUnresolvedBlockers: ["Confirm the source business identity."],
        unresolvedItems: ["The source logo licence is unknown."],
      }),
    );
    expect(() =>
      approveStorefrontDesignBrief(brief, { actorId: "merchant_1", approvedAt: now }),
    ).toThrow(SourceDiscoveryApplicationError);
  });

  it("matches unchanged evidence against its approved evidence fingerprint", () => {
    const pageEvidence = evidence("page-identity", { title: "Demo Merchant" });
    const material = materialEvidence([pageEvidence]);
    const brief = createStorefrontDesignBrief(
      briefInput({
        sourceEvidenceIds: [pageEvidence.id],
        materialEvidence: material,
      }),
    );
    const approved = approveStorefrontDesignBrief(brief, {
      actorId: "merchant_1",
      approvedAt: now,
    });
    const currentFingerprint = createStorefrontDesignBriefEvidenceFingerprint({
      sourceReferenceIds: ["source_demo"],
      sourceEvidenceIds: [pageEvidence.id],
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      materialEvidence: material,
    });

    expect(approved.approvedEvidenceFingerprint).toBe(currentFingerprint);
    expect(requireApprovedCurrentStorefrontDesignBrief(approved, currentFingerprint)).toEqual(
      approved,
    );
  });

  it("invalidates approval when material evidence changes", () => {
    const original = evidence("page-identity", { title: "Demo Merchant" });
    const originalMaterial = materialEvidence([original]);
    const brief = createStorefrontDesignBrief(
      briefInput({ sourceEvidenceIds: [original.id], materialEvidence: originalMaterial }),
    );
    const approved = approveStorefrontDesignBrief(brief, {
      actorId: "merchant_1",
      approvedAt: now,
    });
    const changed = evidence("page-identity", { title: "Changed Merchant" });
    const changedFingerprint = createStorefrontDesignBriefEvidenceFingerprint({
      sourceReferenceIds: ["source_demo"],
      sourceEvidenceIds: [changed.id],
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      materialEvidence: materialEvidence([changed]),
    });

    expect(changedFingerprint).not.toBe(approved.approvedEvidenceFingerprint);
    expect(() => requireApprovedCurrentStorefrontDesignBrief(approved, changedFingerprint)).toThrow(
      /stale/,
    );
    expect(() =>
      requireApprovedCurrentStorefrontDesignBrief(approved, approved.fingerprint),
    ).toThrow(/stale/);
  });

  it("excludes approval timestamps and actors from the evidence fingerprint", () => {
    const pageEvidence = evidence("page-identity", { title: "Demo Merchant" });
    const brief = createStorefrontDesignBrief(
      briefInput({
        sourceEvidenceIds: [pageEvidence.id],
        materialEvidence: materialEvidence([pageEvidence]),
      }),
    );
    const first = approveStorefrontDesignBrief(brief, {
      actorId: "merchant_1",
      approvedAt: now,
    });
    const second = approveStorefrontDesignBrief(brief, {
      actorId: "merchant_2",
      approvedAt: "2026-07-22T11:00:00.000Z",
    });

    expect(first.approvedEvidenceFingerprint).toBe(second.approvedEvidenceFingerprint);
    expect(first.fingerprint).not.toBe(second.fingerprint);
  });

  it("fingerprints semantically identical evidence independently of item ordering", () => {
    const firstEvidence = evidence("page-type", "home");
    const secondEvidence = evidence("logo-candidate", { assetId: "asset_logo" });
    const left = createStorefrontDesignBriefEvidenceFingerprint({
      sourceReferenceIds: ["source_demo"],
      sourceEvidenceIds: [firstEvidence.id, secondEvidence.id],
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      materialEvidence: materialEvidence([firstEvidence, secondEvidence]),
    });
    const right = createStorefrontDesignBriefEvidenceFingerprint({
      sourceReferenceIds: ["source_demo"],
      sourceEvidenceIds: [secondEvidence.id, firstEvidence.id],
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      materialEvidence: materialEvidence([secondEvidence, firstEvidence]),
    });

    expect(right).toBe(left);
  });

  it("excludes discovery and observation timestamps from material evidence fingerprints", () => {
    const firstEvidence = evidence("page-type", "home");
    const laterEvidence = evidence("page-type", "home", {
      provenance: {
        sourceReferenceId: "source_demo",
        sourceUrl: sourceReference().url,
        documentUrl: sourceReference().url,
        observedAt: "2026-07-22T12:00:00.000Z",
        extractionLocation: "timestamp fixture",
      },
    });
    const first = createStorefrontDesignBriefEvidenceFingerprint({
      sourceReferenceIds: ["source_demo"],
      sourceEvidenceIds: [firstEvidence.id],
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      materialEvidence: materialEvidence([firstEvidence]),
    });
    const later = createStorefrontDesignBriefEvidenceFingerprint({
      sourceReferenceIds: ["source_demo"],
      sourceEvidenceIds: [laterEvidence.id],
      canonicalCommerceProjectionRef: aurumNordicSeed.catalogue.id,
      materialEvidence: {
        ...materialEvidence([laterEvidence]),
        sourceReferences: [sourceReference({ discoveredAt: "2026-07-22T12:00:00.000Z" })],
      },
    });

    expect(later).toBe(first);
  });

  it("returns the superseded revision and a reviewable replacement", () => {
    const brief = createStorefrontDesignBrief(briefInput());
    const approved = approveStorefrontDesignBrief(brief, {
      actorId: "merchant_1",
      approvedAt: now,
    });
    const replacementEvidence = evidence("typography-signal", "serif");
    const result = supersedeStorefrontDesignBrief(approved, {
      sourceEvidenceIds: [replacementEvidence.id],
      materialEvidence: materialEvidence([replacementEvidence]),
      now: "2026-07-22T10:01:00.000Z",
    });

    expect(result.superseded).toMatchObject({
      status: "superseded",
      revision: 1,
      supersededByRevision: 2,
    });
    expect(result.replacement).toMatchObject({
      status: "needsReview",
      revision: 2,
      supersedesRevision: 1,
      sourceEvidenceIds: ["evidence_typography_signal"],
      approvedEvidenceFingerprint: null,
    });
  });

  it("allows the reviewable replacement to be approved", () => {
    const brief = createStorefrontDesignBrief(briefInput());
    const approved = approveStorefrontDesignBrief(brief, {
      actorId: "merchant_1",
      approvedAt: now,
    });
    const replacementEvidence = evidence("typography-signal", "serif");
    const { replacement } = supersedeStorefrontDesignBrief(approved, {
      sourceEvidenceIds: [replacementEvidence.id],
      materialEvidence: materialEvidence([replacementEvidence]),
      now: "2026-07-22T10:01:00.000Z",
    });
    const replacementApproved = approveStorefrontDesignBrief(replacement, {
      actorId: "merchant_1",
      approvedAt: "2026-07-22T10:02:00.000Z",
      approvedBrandDirection: approved.approvedBrandDirection!,
    });

    expect(replacementApproved.status).toBe("approved");
    expect(
      requireApprovedCurrentStorefrontDesignBrief(
        replacementApproved,
        replacementApproved.approvedEvidenceFingerprint ?? undefined,
      ),
    ).toEqual(replacementApproved);
  });

  it("rejects superseded and unapproved replacement revisions for generation", () => {
    const brief = createStorefrontDesignBrief(briefInput());
    const approved = approveStorefrontDesignBrief(brief, {
      actorId: "merchant_1",
      approvedAt: now,
    });
    const replacementEvidence = evidence("typography-signal", "serif");
    const { superseded, replacement } = supersedeStorefrontDesignBrief(approved, {
      sourceEvidenceIds: [replacementEvidence.id],
      materialEvidence: materialEvidence([replacementEvidence]),
      now: "2026-07-22T10:01:00.000Z",
    });

    expect(() =>
      requireApprovedCurrentStorefrontDesignBrief(
        superseded,
        superseded.approvedEvidenceFingerprint ?? undefined,
      ),
    ).toThrow(/approved current/);
    expect(() =>
      requireApprovedCurrentStorefrontDesignBrief(replacement, replacement.evidenceFingerprint),
    ).toThrow(/approved current/);
  });

  it("keeps deterministic mock discovery stable", async () => {
    const adapter = createDeterministicMockDiscoveryAdapter();
    const first = await discoverStorefrontSource(adapter, sourceReference());
    const second = await discoverStorefrontSource(adapter, sourceReference());
    expect(second).toEqual(first);
  });

  it("keeps contracts free of network, UI, Puck, and provider dependencies", () => {
    const sourceFiles = [
      "src/domain/source-discovery/contracts.ts",
      "src/application/source-discovery/contract.ts",
      "src/application/source-discovery/orchestrator.ts",
      "src/application/source-discovery/mock-adapter.ts",
    ];
    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, "utf8");
      expect(source).not.toMatch(/from ["'](?:react|next|@puckeditor|openai|server-only)/);
      expect(source).not.toMatch(/(?:fetch|XMLHttpRequest|axios|cheerio|playwright)/i);
    }
    expect(SourceDiscoveryApplicationError).toBeDefined();
    expect(
      sourceDiscoveryResultSchema.parse(discovery(evidence("page-type", "home"))),
    ).toBeTruthy();
  });
});
