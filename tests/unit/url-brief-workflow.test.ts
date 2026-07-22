import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDeterministicUrlBriefWorkflowService,
  OnboardingService,
  UrlBriefWorkflowOperationError,
  UrlBriefWorkflowService,
  type CanonicalCommerceProjectionProvider,
} from "@/application/onboarding";
import {
  createDeterministicMockDiscoveryAdapter,
  SourceDiscoveryApplicationError,
  type SourceDiscoveryAdapter,
} from "@/application/source-discovery";
import { aurumNordicSeed } from "@/data/seed";
import {
  currentUrlBrief,
  onboardingSessionSchema,
  urlBriefWorkflowMaterialEvidence,
  type OnboardingSession,
} from "@/domain/onboarding";
import {
  createStorefrontSourceEvidenceFingerprint,
  reconciliationDecisionSchema,
  sourceDiscoveryResultSchema,
  sourceEvidenceSchema,
  sourceReferenceSchema,
} from "@/domain/source-discovery";
import type {
  OnboardingSessionLoadResult,
  OnboardingSessionRepository,
} from "@/services/onboarding";

const start = Date.parse("2026-07-22T10:00:00.000Z");

class MemoryOnboardingRepository implements OnboardingSessionRepository {
  session?: OnboardingSession;
  saveCount = 0;
  failOnSaveCount: number | null = null;

  load(): Promise<OnboardingSessionLoadResult> {
    return Promise.resolve(
      this.session
        ? { status: "found", session: structuredClone(this.session) }
        : { status: "missing" },
    );
  }

  save(session: OnboardingSession): Promise<void> {
    this.saveCount += 1;
    if (this.saveCount === this.failOnSaveCount) {
      return Promise.reject(new Error("simulated persistence failure"));
    }
    this.session = onboardingSessionSchema.parse(structuredClone(session));
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.session = undefined;
    return Promise.resolve();
  }
}

function clock() {
  let tick = 0;
  return () => new Date(start + tick++ * 1_000).toISOString();
}

const commerce: CanonicalCommerceProjectionProvider = {
  load: () => aurumNordicSeed.catalogue,
};

const approvedBrandDirection = {
  logoAssetRef: { id: "asset_merchant_logo", label: "Merchant logo" },
  supportingImageAssetRefs: [],
  preferredBrandColours: ["#123456"],
  typographyDirection: "serif-led",
  visualStyleDirection: "editorial",
  imageryDirection: "studio",
  toneKeywords: ["warm"],
};

const briefInput = {
  businessIdentity: {
    businessName: "Merchant Demo",
    shortDescription: "A small independent jewellery shop.",
    industry: "jewellery",
    targetCustomer: "Design-conscious customers",
    primaryMarket: "Finland",
  },
  languagePlan: { selectedLanguages: ["en"], primaryLanguage: "en" },
  approvedBrandDirection,
  pagePlan: { pageTypes: ["home", "collection", "product"] },
};

async function setup(
  adapter: SourceDiscoveryAdapter = createDeterministicMockDiscoveryAdapter(),
  canonicalCommerce: CanonicalCommerceProjectionProvider = commerce,
) {
  const repository = new MemoryOnboardingRepository();
  const now = clock();
  await new OnboardingService(repository, {
    createId: () => "onboarding_url_brief",
    now,
  }).createSession();
  const service = new UrlBriefWorkflowService(repository, adapter, canonicalCommerce, {
    now,
    createSourceId: () => "source_merchant_demo",
  });
  return { repository, service, now };
}

async function reachApproved(service: UrlBriefWorkflowService) {
  await service.submitSourceUrl("https://merchant.example/store#ignored");
  await service.discover();
  await service.reconcile();
  await service.proposeBrand();
  await service.prepareBrief(briefInput);
  return service.approveBrief("merchant_owner");
}

async function reachReview(service: UrlBriefWorkflowService, input = briefInput) {
  await service.submitSourceUrl("https://merchant.example/store#ignored");
  await service.discover();
  await service.reconcile();
  await service.proposeBrand();
  return service.prepareBrief(input);
}

function unresolvedCommerceAdapter(
  kind: "product-reference-observed" | "collection-reference-observed",
): SourceDiscoveryAdapter {
  const base = createDeterministicMockDiscoveryAdapter();
  return {
    id: `unresolved-${kind}`,
    async discover(input) {
      const result = await base.discover(input);
      const commerceEvidence = sourceEvidenceSchema.parse({
        id: `evidence_${input.source.id}_${kind}`,
        kind,
        provenance: {
          sourceReferenceId: input.source.id,
          sourceUrl: input.source.url,
          observedAt: input.source.discoveredAt,
        },
        sourceUrl: input.source.url,
        confidence: 0.9,
        observedValue:
          kind === "product-reference-observed"
            ? { title: { en: "Unknown public product" }, price: { amount: 1, currency: "EUR" } }
            : { title: { en: "Unknown public collection" } },
        extractionMethod: "deterministic-unresolved-commerce",
        locale: "en",
        warnings: [],
        uncertainty: { isUncertain: false, reason: null },
      });
      return sourceDiscoveryResultSchema.parse({
        ...result,
        evidence: [...result.evidence, commerceEvidence],
      });
    },
  };
}

function uncertainAdapter(): SourceDiscoveryAdapter {
  const base = createDeterministicMockDiscoveryAdapter();
  return {
    id: "uncertain-deterministic-fixture",
    async discover(input) {
      const result = await base.discover(input);
      const uncertain = sourceEvidenceSchema.parse({
        id: `evidence_${input.source.id}_uncertain_colour`,
        kind: "colour-signal",
        provenance: {
          sourceReferenceId: input.source.id,
          sourceUrl: input.source.url,
          observedAt: input.source.discoveredAt,
        },
        sourceUrl: input.source.url,
        confidence: 0.45,
        observedValue: "#74513b",
        extractionMethod: "deterministic-uncertain-fixture",
        locale: null,
        warnings: [],
        uncertainty: { isUncertain: true, reason: "Confirm the inferred brand colour." },
      });
      return sourceDiscoveryResultSchema.parse({
        ...result,
        evidence: [...result.evidence, uncertain],
      });
    },
  };
}

describe("P7-02 URL-to-approved-Storefront-Design-Brief workflow", () => {
  it("normalizes a realistic URL and reaches an approved brief in deterministic mode", async () => {
    const { repository } = await setup();
    const service = createDeterministicUrlBriefWorkflowService(repository, commerce, {
      now: clock(),
      createSourceId: () => "source_realistic_fixture",
    });

    const submitted = await service.submitSourceUrl("https://shop.example/products?locale=fi#top");
    expect(submitted.status).toBe("source-submitted");
    expect(submitted.sourceReferences[0]?.url).toBe("https://shop.example/products?locale=fi");
    expect((await service.discover()).status).toBe("evidence-ready");
    expect((await service.reconcile()).status).toBe("evidence-ready");
    expect((await service.proposeBrand()).status).toBe("brand-proposal-ready");
    expect((await service.prepareBrief(briefInput)).status).toBe("brief-needs-review");
    await expect(service.requireApprovedBriefForGeneration()).rejects.toMatchObject({
      code: "stale-brief-approval",
    });
    const approved = await service.approveBrief("merchant_owner");

    expect(approved.status).toBe("approved");
    expect(currentUrlBrief(approved)).toMatchObject({ status: "approved", revision: 1 });
    await expect(service.requireApprovedBriefForGeneration()).resolves.toMatchObject({
      status: "approved",
    });
  });

  it("keeps invalid and unsupported URLs recoverable without discarding the safe state", async () => {
    const { service } = await setup();

    await expect(service.submitSourceUrl("not a URL")).rejects.toMatchObject({
      code: "invalid-url",
      workflow: { status: "discovery-failed", lastSafeState: "idle" },
    });
    expect((await service.restore()).status).toBe("discovery-failed");
    await expect(service.submitSourceUrl("http://merchant.example")).rejects.toMatchObject({
      code: "unsupported-protocol",
    });

    await expect(service.submitSourceUrl("https://merchant.example/store")).resolves.toMatchObject({
      status: "source-submitted",
      failure: null,
    });
  });

  it("rejects a cross-source adapter result and persists a safe failure", async () => {
    const base = createDeterministicMockDiscoveryAdapter();
    const adapter: SourceDiscoveryAdapter = {
      id: "cross-source-fixture",
      async discover(input) {
        const result = await base.discover(input);
        return { ...result, source: { ...result.source, id: "source_unrelated" } };
      },
    };
    const { service } = await setup(adapter);
    await service.submitSourceUrl("https://merchant.example/store");

    await expect(service.discover()).rejects.toMatchObject({
      code: "unavailable-source",
      workflow: { status: "discovery-failed", lastSafeState: "source-submitted" },
    });
    expect((await service.restore()).discoveryResult).toBeNull();
  });

  it("keeps Vesko product identity, prices, availability, variants and options authoritative", async () => {
    const base = createDeterministicMockDiscoveryAdapter();
    const product = aurumNordicSeed.catalogue.products[0];
    if (!product) throw new Error("Expected an Aurum product fixture.");
    const adapter: SourceDiscoveryAdapter = {
      id: "commerce-conflict-fixture",
      async discover(input) {
        const result = await base.discover(input);
        const productEvidence = sourceEvidenceSchema.parse({
          id: `evidence_${input.source.id}_product_conflict`,
          kind: "product-reference-observed",
          provenance: {
            sourceReferenceId: input.source.id,
            sourceUrl: input.source.url,
            observedAt: input.source.discoveredAt,
          },
          sourceUrl: input.source.url,
          confidence: 0.9,
          observedValue: {
            productId: product.id,
            title: { en: "Incorrect public title" },
            sku: "PUBLIC-SKU",
            price: { amount: 1, currency: "EUR" },
            compareAtPrice: { amount: 2, currency: "EUR" },
            availability: "Unavailable publicly",
            variants: [{ id: "public_variant" }],
            orderOptions: [{ id: "public_option" }],
          },
          extractionMethod: "deterministic-commerce-conflict",
          locale: "en",
          warnings: [],
          uncertainty: { isUncertain: false, reason: null },
        });
        return sourceDiscoveryResultSchema.parse({
          ...result,
          evidence: [...result.evidence, productEvidence],
        });
      },
    };
    const { service } = await setup(adapter);
    await service.submitSourceUrl("https://merchant.example/store");
    await service.discover();
    const workflow = await service.reconcile();
    const byField = new Map(
      workflow.reconciliation?.decisions
        .filter((decision) => decision.evidenceId?.endsWith("product_conflict"))
        .map((decision) => [decision.field, decision]) ?? [],
    );

    expect(byField.get("product-identity")).toMatchObject({
      kind: "canonical-override",
      canonicalValue: { id: product.id, title: product.title },
    });
    expect(byField.get("price")).toMatchObject({
      kind: "canonical-override",
      canonicalValue: product.price,
    });
    expect(byField.get("sku")).toMatchObject({
      kind: "canonical-override",
      canonicalValue: product.sku,
    });
    expect(byField.get("compare-at-price")).toMatchObject({
      kind: "canonical-override",
      canonicalValue: product.compareAtPrice ?? null,
    });
    expect(byField.get("availability")?.canonicalValue).toEqual(
      product.availabilityLabel ?? product.stockStatus ?? null,
    );
    expect(byField.get("variants")?.canonicalValue).toEqual(product.variants);
    expect(byField.get("order-options")?.canonicalValue).toEqual(product.orderOptions ?? []);
  });

  it("prevents approval until every merchant-required reconciliation decision is resolved", async () => {
    const { service } = await setup(uncertainAdapter());
    await service.submitSourceUrl("https://merchant.example/store");
    await service.discover();
    const reconciled = await service.reconcile();
    expect(reconciled.status).toBe("reconciliation-needed");
    expect(reconciled.unresolvedInformationIds).toHaveLength(1);
    await service.proposeBrand();
    const review = await service.prepareBrief(briefInput);
    expect(currentUrlBrief(review)?.unresolvedItems).toContain(
      "Confirm the inferred brand colour.",
    );
    await expect(service.approveBrief("merchant_owner")).rejects.toBeInstanceOf(
      UrlBriefWorkflowOperationError,
    );

    const decisionId = review.unresolvedInformationIds[0];
    if (!decisionId) throw new Error("Expected a merchant decision.");
    const resolved = await service.recordMerchantResolution(
      decisionId,
      "reject-source-evidence",
      "Do not use this colour.",
    );
    expect(resolved.unresolvedInformationIds).toEqual([]);
    expect(currentUrlBrief(resolved)?.unresolvedItems).toEqual([]);
    await expect(service.approveBrief("merchant_owner")).resolves.toMatchObject({
      status: "approved",
    });
  });

  it("stores the dedicated evidence fingerprint and keeps unchanged evidence approved", async () => {
    const { service } = await setup();
    const approved = await reachApproved(service);
    const approvedBrief = currentUrlBrief(approved);
    expect(approved.approvedEvidenceFingerprint).toBe(approvedBrief?.evidenceFingerprint);
    expect(approvedBrief?.approvedEvidenceFingerprint).toBe(approvedBrief?.evidenceFingerprint);

    await service.discover();
    const unchanged = await service.reconcile();
    expect(unchanged.status).toBe("approved");
    expect(currentUrlBrief(unchanged)?.revision).toBe(1);
  });

  it("marks changed evidence stale, supersedes the approval and creates a reviewable revision", async () => {
    const base = createDeterministicMockDiscoveryAdapter();
    let version = 1;
    const adapter: SourceDiscoveryAdapter = {
      id: "changing-evidence-fixture",
      async discover(input) {
        const result = await base.discover(input);
        return sourceDiscoveryResultSchema.parse({
          ...result,
          evidence: result.evidence.map((evidence) =>
            evidence.kind === "page-identity"
              ? { ...evidence, observedValue: { pageTitle: `Demo storefront ${version}` } }
              : evidence,
          ),
        });
      },
    };
    const { service } = await setup(adapter);
    await reachApproved(service);
    version = 2;
    await service.discover();
    const stale = await service.reconcile();

    expect(stale.status).toBe("stale");
    await expect(service.requireApprovedBriefForGeneration()).rejects.toMatchObject({
      code: "stale-brief-approval",
    });
    await service.proposeBrand();
    const superseded = await service.supersedeStaleBrief();
    expect(superseded.status).toBe("superseded");
    expect(superseded.briefRevisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ revision: 1, status: "superseded", supersededByRevision: 2 }),
        expect.objectContaining({ revision: 2, status: "needsReview", supersedesRevision: 1 }),
      ]),
    );
    await expect(service.requireApprovedBriefForGeneration()).rejects.toMatchObject({
      code: "stale-brief-approval",
    });
  });

  it("preserves the latest reviewed state across adapter and persistence failures", async () => {
    const { repository, service } = await setup();
    const approved = await reachApproved(service);
    const reviewedEvidence = structuredClone(approved.discoveryResult);
    repository.failOnSaveCount = repository.saveCount + 2;

    await expect(service.discover()).rejects.toMatchObject({
      code: "ONBOARDING_WORKFLOW_PERSISTENCE_FAILED",
      safeWorkflow: { status: "approved" },
    });
    repository.failOnSaveCount = null;
    const restored = await service.restore();
    expect(restored.status).toBe("approved");
    expect(restored.discoveryResult).toEqual(reviewedEvidence);

    const timeoutService = new UrlBriefWorkflowService(
      repository,
      {
        id: "timeout-fixture",
        discover: () => {
          throw new SourceDiscoveryApplicationError("timeout", "The source timed out.");
        },
      },
      commerce,
      { now: clock(), createSourceId: () => "source_merchant_demo" },
    );
    await expect(timeoutService.discover()).rejects.toMatchObject({ code: "timeout" });
    const afterTimeout = await timeoutService.restore();
    expect(afterTimeout.discoveryResult).toEqual(reviewedEvidence);
    await expect(timeoutService.requireApprovedBriefForGeneration()).resolves.toMatchObject({
      status: "approved",
    });
  });

  it("handles missing canonical commerce and empty evidence without losing submitted progress", async () => {
    const emptyAdapter: SourceDiscoveryAdapter = {
      id: "empty-fixture",
      discover: ({ source }) => ({ source, evidence: [], assetCandidates: [], warnings: [] }),
    };
    const empty = await setup(emptyAdapter);
    await empty.service.submitSourceUrl("https://merchant.example/store");
    await expect(empty.service.discover()).rejects.toMatchObject({
      code: "no-reusable-evidence",
    });
    expect((await empty.service.restore()).lastSafeState).toBe("source-submitted");

    const missingCommerce = await setup(createDeterministicMockDiscoveryAdapter(), {
      load: () => null,
    });
    await missingCommerce.service.submitSourceUrl("https://merchant.example/store");
    const evidenceReady = await missingCommerce.service.discover();
    await expect(missingCommerce.service.reconcile()).rejects.toMatchObject({
      code: "missing-canonical-vesko-projection",
    });
    expect((await missingCommerce.service.restore()).discoveryResult).toEqual(
      evidenceReady.discoveryResult,
    );
  });

  it("keeps the domain and application workflow free of UI, Puck and provider formats", () => {
    const sources = [
      "src/domain/onboarding/url-brief-workflow.ts",
      "src/application/onboarding/url-brief-workflow-service.ts",
    ]
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(sources).not.toMatch(/from ["']react["']|@puckeditor|integrations\/puck/);
    expect(sources).not.toMatch(/from ["']openai["']|responses\.create|chat\.completions/);
    expect(sources).not.toMatch(/process\.env|OPENAI_API_KEY/);
  });
});

describe("P7-02 automated review hardening", () => {
  it("rejects source-evidence acceptance for product identity and commerce conflicts", async () => {
    const { service } = await setup(unresolvedCommerceAdapter("product-reference-observed"));
    await service.submitSourceUrl("https://merchant.example/store");
    await service.discover();
    const reconciled = await service.reconcile();
    const decisionId = reconciled.unresolvedInformationIds[0];
    if (!decisionId) throw new Error("Expected an unresolved product decision.");

    await expect(
      service.recordMerchantResolution(decisionId, "accept-source-evidence"),
    ).rejects.toMatchObject({ code: "conflicting-evidence" });
  });

  it("rejects source-evidence acceptance for collection identity and membership conflicts", async () => {
    const identity = await setup(unresolvedCommerceAdapter("collection-reference-observed"));
    await identity.service.submitSourceUrl("https://merchant.example/store");
    await identity.service.discover();
    const identityWorkflow = await identity.service.reconcile();
    const identityDecisionId = identityWorkflow.unresolvedInformationIds[0];
    if (!identityDecisionId) throw new Error("Expected an unresolved collection decision.");
    await expect(
      identity.service.recordMerchantResolution(identityDecisionId, "accept-source-evidence"),
    ).rejects.toMatchObject({ code: "conflicting-evidence" });

    const membership = await setup();
    await membership.service.submitSourceUrl("https://merchant.example/store");
    await membership.service.discover();
    const reconciled = await membership.service.reconcile();
    const collection = aurumNordicSeed.catalogue.collections[0];
    if (!collection || !membership.repository.session || !reconciled.reconciliation) {
      throw new Error("Expected collection and reconciliation fixtures.");
    }
    const decision = reconciliationDecisionSchema.parse({
      id: "reconcile_collection_membership_review",
      kind: "unresolved-conflict",
      evidenceId: null,
      canonicalProductId: null,
      canonicalCollectionId: null,
      candidateCanonicalIds: [collection.id],
      field: "collection-membership",
      sourceValue: ["public_product"],
      canonicalValue: collection.productIds,
      reason: "Confirm the canonical collection membership.",
      merchantDecisionRequired: true,
    });
    membership.repository.session = onboardingSessionSchema.parse({
      ...membership.repository.session,
      urlBriefWorkflow: {
        ...reconciled,
        status: "reconciliation-needed",
        lastSafeState: "reconciliation-needed",
        reconciliation: {
          ...reconciled.reconciliation,
          decisions: [...reconciled.reconciliation.decisions, decision],
          unresolvedConflictIds: [...reconciled.reconciliation.unresolvedConflictIds, decision.id],
        },
        unresolvedInformationIds: [decision.id],
      },
    });

    await expect(
      membership.service.recordMerchantResolution(decision.id, "accept-source-evidence"),
    ).rejects.toMatchObject({ code: "conflicting-evidence" });
  });

  it("clears commerce conflicts only after an exact canonical Vesko match is supplied", async () => {
    const { service } = await setup(unresolvedCommerceAdapter("product-reference-observed"));
    await service.submitSourceUrl("https://merchant.example/store");
    await service.discover();
    const reconciled = await service.reconcile();
    const decisionId = reconciled.unresolvedInformationIds[0];
    const product = aurumNordicSeed.catalogue.products[0];
    if (!decisionId || !product) throw new Error("Expected product fixtures.");

    await expect(
      service.recordMerchantResolution(decisionId, "use-vesko-truth"),
    ).rejects.toMatchObject({ code: "conflicting-evidence" });
    const resolved = await service.recordMerchantResolution(
      decisionId,
      "use-vesko-truth",
      "Use the verified catalogue product.",
      { canonicalProductId: product.id },
    );

    expect(resolved.unresolvedInformationIds).toEqual([]);
    expect(resolved.merchantResolutions).toContainEqual(
      expect.objectContaining({
        decisionId,
        outcome: "use-vesko-truth",
        canonicalProductId: product.id,
      }),
    );
  });

  it("still allows merchant acceptance or rejection for uncertain design evidence", async () => {
    const { service } = await setup(uncertainAdapter());
    await service.submitSourceUrl("https://merchant.example/store");
    await service.discover();
    const reconciled = await service.reconcile();
    const decisionId = reconciled.unresolvedInformationIds[0];
    if (!decisionId) throw new Error("Expected an uncertain design decision.");

    const accepted = await service.recordMerchantResolution(
      decisionId,
      "accept-source-evidence",
      "Use the observed colour direction.",
    );
    expect(accepted.unresolvedInformationIds).toEqual([]);
    expect(
      urlBriefWorkflowMaterialEvidence(accepted)?.reconciliation?.decisions.find(
        (decision) => decision.id === decisionId,
      ),
    ).toMatchObject({ kind: "accepted-evidence", merchantDecisionRequired: false });
  });

  it("keeps protected product values under canonical Vesko authority after resolution", async () => {
    const { service } = await setup(unresolvedCommerceAdapter("product-reference-observed"));
    await service.submitSourceUrl("https://merchant.example/store");
    await service.discover();
    const reconciled = await service.reconcile();
    const decisionId = reconciled.unresolvedInformationIds[0];
    const product = aurumNordicSeed.catalogue.products[0];
    if (!decisionId || !product) throw new Error("Expected product fixtures.");
    const resolved = await service.recordMerchantResolution(decisionId, "use-vesko-truth", null, {
      canonicalProductId: product.id,
    });
    const decision = urlBriefWorkflowMaterialEvidence(resolved)?.reconciliation?.decisions.find(
      (candidate) => candidate.id === decisionId,
    );

    expect(decision).toMatchObject({
      kind: "canonical-override",
      canonicalProductId: product.id,
    });
    expect(decision?.sourceValue).toMatchObject({ price: { amount: 1, currency: "EUR" } });
    expect(aurumNordicSeed.catalogue.products[0]).toEqual(product);
  });

  it("preserves the persisted workflow after an invalid commerce resolution attempt", async () => {
    const { repository, service } = await setup(
      unresolvedCommerceAdapter("product-reference-observed"),
    );
    await service.submitSourceUrl("https://merchant.example/store");
    await service.discover();
    const reconciled = await service.reconcile();
    const decisionId = reconciled.unresolvedInformationIds[0];
    if (!decisionId) throw new Error("Expected an unresolved product decision.");
    const persistedBefore = structuredClone(repository.session);
    const saveCountBefore = repository.saveCount;

    await expect(
      service.recordMerchantResolution(decisionId, "use-vesko-truth", null, {
        canonicalProductId: "product_not_in_vesko",
      }),
    ).rejects.toMatchObject({ code: "conflicting-evidence" });
    expect(repository.session).toEqual(persistedBefore);
    expect(repository.saveCount).toBe(saveCountBefore);
  });

  it("rejects approval when material evidence changes before approval", async () => {
    const base = createDeterministicMockDiscoveryAdapter();
    let version = 1;
    const adapter: SourceDiscoveryAdapter = {
      id: "preapproval-changing-evidence",
      async discover(input) {
        const result = await base.discover(input);
        return sourceDiscoveryResultSchema.parse({
          ...result,
          evidence: result.evidence.map((evidence) =>
            evidence.kind === "page-identity"
              ? { ...evidence, observedValue: { pageTitle: `Review version ${version}` } }
              : evidence,
          ),
        });
      },
    };
    const { service } = await setup(adapter);
    await reachReview(service);
    version = 2;
    await service.discover();
    await service.reconcile();

    await expect(service.approveBrief("merchant_owner")).rejects.toMatchObject({
      code: "stale-brief-approval",
      workflow: { status: "brief-needs-review", failure: { retryable: true } },
    });
  });

  it("rejects approval when the current canonical commerce projection changes", async () => {
    let projection = aurumNordicSeed.catalogue;
    const { service } = await setup(createDeterministicMockDiscoveryAdapter(), {
      load: () => projection,
    });
    await reachReview(service);
    projection = { ...aurumNordicSeed.catalogue, id: "catalogue_aurum_review_2" };

    await expect(service.approveBrief("merchant_owner")).rejects.toMatchObject({
      code: "stale-brief-approval",
      workflow: { status: "brief-needs-review" },
    });
  });

  it("approves when the current review evidence and projection are unchanged", async () => {
    const { service } = await setup();
    await reachReview(service);
    await expect(service.approveBrief("merchant_owner")).resolves.toMatchObject({
      status: "approved",
      failure: null,
    });
  });

  it("ignores approval metadata and observation timestamps in material freshness", async () => {
    const { service } = await setup();
    const review = await reachReview(service);
    const material = urlBriefWorkflowMaterialEvidence(review);
    if (!material) throw new Error("Expected material evidence.");
    const laterMaterial = {
      ...material,
      sourceReferences: material.sourceReferences.map((source) => ({
        ...source,
        discoveredAt: "2026-07-22T18:00:00.000Z",
      })),
      evidence: material.evidence.map((evidence) => ({
        ...evidence,
        provenance: { ...evidence.provenance, observedAt: "2026-07-22T18:00:00.000Z" },
      })),
    };

    expect(createStorefrontSourceEvidenceFingerprint(laterMaterial)).toBe(
      createStorefrontSourceEvidenceFingerprint(material),
    );
    await expect(service.approveBrief("merchant_owner")).resolves.toMatchObject({
      status: "approved",
    });
  });

  it("refreshes every merchant-reviewable brief input", async () => {
    const { service } = await setup();
    await reachReview(service);
    const refreshedInput = {
      businessIdentity: {
        businessName: "Updated Merchant",
        shortDescription: "Updated positioning.",
        industry: "home",
        targetCustomer: "Nordic design customers",
        primaryMarket: "Sweden",
      },
      languagePlan: { selectedLanguages: ["fi", "en"], primaryLanguage: "fi" },
      approvedBrandDirection: {
        ...approvedBrandDirection,
        typographyDirection: "sans-led",
        toneKeywords: ["modern", "warm"],
      },
      approvedReusableAssetIds: ["asset_reused_logo"],
      pagePlan: { pageTypes: ["home", "product"] },
      navigationDirection: ["Products first"],
      homepageGoals: ["Explain the offer"],
      collectionPageGoals: ["Support browsing"],
      productPageGoals: ["Build confidence"],
      visualPriorities: ["Products", "Trust"],
      contentAssumptions: ["Merchant supplies final legal copy"],
      materialUnresolvedBlockers: [],
      excludedClaims: ["Delivery promises"],
      generationPermissions: {
        allowMarketingCopy: false,
        allowAssetReuse: true,
        allowGeneratedImagery: true,
      },
    } as const;
    const refreshed = await service.prepareBrief(refreshedInput);

    expect(currentUrlBrief(refreshed)).toMatchObject({
      businessIdentity: refreshedInput.businessIdentity,
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "fi" },
      approvedBrandDirection: refreshedInput.approvedBrandDirection,
      approvedReusableAssetIds: refreshedInput.approvedReusableAssetIds,
      pagePlan: refreshedInput.pagePlan,
      navigationDirection: refreshedInput.navigationDirection,
      homepageGoals: refreshedInput.homepageGoals,
      collectionPageGoals: refreshedInput.collectionPageGoals,
      productPageGoals: refreshedInput.productPageGoals,
      visualPriorities: refreshedInput.visualPriorities,
      contentAssumptions: refreshedInput.contentAssumptions,
      excludedClaims: refreshedInput.excludedClaims,
      generationPermissions: refreshedInput.generationPermissions,
    });
  });

  it("keeps repeated identical brief refreshes deterministic", async () => {
    const { service } = await setup();
    await reachReview(service);
    const first = currentUrlBrief(await service.prepareBrief(briefInput));
    const second = currentUrlBrief(await service.prepareBrief(briefInput));
    if (!first || !second) throw new Error("Expected reviewable briefs.");

    expect(second.evidenceFingerprint).toBe(first.evidenceFingerprint);
    expect({ ...second, updatedAt: first.updatedAt, fingerprint: first.fingerprint }).toEqual(
      first,
    );
  });

  it("refreshes a review to the current canonical projection without inheriting approval", async () => {
    let projection = aurumNordicSeed.catalogue;
    const { service } = await setup(createDeterministicMockDiscoveryAdapter(), {
      load: () => projection,
    });
    const initial = await reachReview(service);
    const initialBrief = currentUrlBrief(initial);
    projection = { ...aurumNordicSeed.catalogue, id: "catalogue_aurum_review_3" };
    await service.reconcile();
    const refreshed = await service.prepareBrief(briefInput);
    const refreshedBrief = currentUrlBrief(refreshed);

    expect(refreshedBrief).toMatchObject({
      status: "needsReview",
      revision: 1,
      canonicalCommerceProjectionRef: "catalogue_aurum_review_3",
      approvedEvidenceFingerprint: null,
      approval: { status: "pending", actorId: null, approvedAt: null },
    });
    expect(refreshedBrief?.evidenceFingerprint).not.toBe(initialBrief?.evidenceFingerprint);
  });

  it("blocks approval when the current canonical projection is missing", async () => {
    let projection: typeof aurumNordicSeed.catalogue | null = aurumNordicSeed.catalogue;
    const { service } = await setup(createDeterministicMockDiscoveryAdapter(), {
      load: () => projection,
    });
    await reachReview(service);
    projection = null;

    await expect(service.approveBrief("merchant_owner")).rejects.toMatchObject({
      code: "missing-canonical-vesko-projection",
      workflow: { status: "brief-needs-review" },
    });
  });

  it("clears all prior-source state when a different normalized source is submitted", async () => {
    const { service } = await setup();
    await reachApproved(service);
    const switched = await service.submitSourceUrl("https://other.example/store");

    expect(switched).toMatchObject({
      status: "source-submitted",
      discoveryResult: null,
      reconciliation: null,
      merchantResolutions: [],
      unresolvedInformationIds: [],
      brandProposal: null,
      briefRevisions: [],
      currentBriefRevision: null,
      approvedEvidenceFingerprint: null,
    });
    expect(switched.sourceReferences).toHaveLength(1);
    expect(switched.sourceReferences[0]?.normalizedOrigin).toBe("https://other.example");
  });

  it("preserves reviewed state only for the exact same normalized source", async () => {
    const { repository, service } = await setup();
    const approved = await reachApproved(service);
    const saveCount = repository.saveCount;
    const resubmitted = await service.submitSourceUrl(
      "https://merchant.example/store#another-fragment",
    );

    expect(resubmitted).toEqual(approved);
    expect(repository.saveCount).toBe(saveCount);
  });

  it("refuses to reconcile discovery evidence that does not match the current source", async () => {
    const { repository, service, now } = await setup();
    await service.submitSourceUrl("https://merchant.example/store");
    const evidenceReady = await service.discover();
    const oldSource = evidenceReady.sourceReferences[0];
    if (!oldSource || !repository.session) throw new Error("Expected source fixtures.");
    const otherSource = sourceReferenceSchema.parse({
      ...oldSource,
      id: "source_other_current",
      url: "https://other.example/store",
      normalizedOrigin: "https://other.example",
      discoveredAt: now(),
      status: "pending",
    });
    repository.session = onboardingSessionSchema.parse({
      ...repository.session,
      urlBriefWorkflow: {
        ...evidenceReady,
        sourceReferences: [oldSource, otherSource],
        currentSourceReferenceId: otherSource.id,
      },
    });
    const before = structuredClone(repository.session);

    await expect(service.reconcile()).rejects.toMatchObject({ code: "invalid-lifecycle" });
    expect(repository.session).toEqual(before);
  });

  it("restores a switched source without reviving prior-source review data", async () => {
    const { repository, service } = await setup();
    await reachApproved(service);
    await service.submitSourceUrl("https://other.example/store");
    const refreshedService = new UrlBriefWorkflowService(
      repository,
      createDeterministicMockDiscoveryAdapter(),
      commerce,
      { now: clock() },
    );
    const restored = await refreshedService.restore();

    expect(restored.status).toBe("source-submitted");
    expect(restored.discoveryResult).toBeNull();
    expect(restored.reconciliation).toBeNull();
    expect(restored.briefRevisions).toEqual([]);
  });

  it("requires fresh discovery before the new source can reconcile or approve", async () => {
    const { service } = await setup();
    await reachApproved(service);
    await service.submitSourceUrl("https://other.example/store");

    await expect(service.reconcile()).rejects.toMatchObject({ code: "invalid-lifecycle" });
    await expect(service.approveBrief("merchant_owner")).rejects.toMatchObject({
      code: "conflicting-evidence",
    });
  });

  it("retains source provenance and revision history across safe review refreshes", async () => {
    const { service } = await setup();
    const firstWorkflow = await reachReview(service);
    const first = currentUrlBrief(firstWorkflow);
    const refreshedWorkflow = await service.prepareBrief({
      ...briefInput,
      homepageGoals: ["Feature new arrivals"],
    });
    const refreshed = currentUrlBrief(refreshedWorkflow);

    expect(refreshed).toMatchObject({
      revision: 1,
      createdAt: first?.createdAt,
      sourceReferenceIds: first?.sourceReferenceIds,
      sourceEvidenceIds: first?.sourceEvidenceIds,
      canonicalCommerceProjectionRef: first?.canonicalCommerceProjectionRef,
    });
    expect(refreshedWorkflow.briefRevisions).toHaveLength(1);
    expect(refreshed?.homepageGoals).toEqual(["Feature new arrivals"]);
  });
});
