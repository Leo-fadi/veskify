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
  requireApprovedCurrentStorefrontDesignBrief,
  SourceDiscoveryApplicationError,
  supersedeStorefrontDesignBrief,
} from "@/application/source-discovery";
import {
  assetCandidateSchema,
  sourceDiscoveryResultSchema,
  sourceEvidenceSchema,
  sourceReferenceSchema,
  type SourceEvidence,
} from "@/domain/source-discovery";

const now = "2026-07-22T10:00:00.000Z";

function sourceReference() {
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
    sourceEvidenceIds: ["evidence_page_identity"],
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
    expect(
      reconcileStorefrontSources({
        source: sourceReference(),
        discovery: discovery(item),
        canonicalCommerceProjection: aurumNordicSeed.catalogue,
      }).decisions[0]?.merchantDecisionRequired,
    ).toBe(true);
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

  it("supersedes an approved brief when material evidence changes", () => {
    const brief = createStorefrontDesignBrief(briefInput());
    const approved = approveStorefrontDesignBrief(brief, {
      actorId: "merchant_1",
      approvedAt: now,
    });
    const superseded = supersedeStorefrontDesignBrief(approved, {
      sourceEvidenceIds: ["evidence_typography_signal"],
      now: "2026-07-22T10:01:00.000Z",
    });
    expect(superseded.status).toBe("superseded");
    expect(superseded.revision).toBe(2);
    expect(superseded.sourceEvidenceIds).toEqual(["evidence_typography_signal"]);
  });

  it("requires an approved current brief for generation", () => {
    const brief = createStorefrontDesignBrief(briefInput());
    expect(() => requireApprovedCurrentStorefrontDesignBrief(brief)).toThrow(/approved current/);
    const approved = approveStorefrontDesignBrief(brief, {
      actorId: "merchant_1",
      approvedAt: now,
    });
    expect(requireApprovedCurrentStorefrontDesignBrief(approved, approved.fingerprint).status).toBe(
      "approved",
    );
    expect(() => requireApprovedCurrentStorefrontDesignBrief(approved, "stale-evidence")).toThrow(
      /stale/,
    );
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
