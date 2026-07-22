import { ZodError } from "zod";
import {
  assetCandidateSchema,
  brandReconstructionProposalSchema,
  canonicalCommerceProjectionSchema,
  createStorefrontSourceEvidenceFingerprint,
  reconciliationDecisionSchema,
  reconciliationResultSchema,
  sourceDiscoveryResultSchema,
  sourceEvidenceSchema,
  sourceReferenceSchema,
  storefrontDesignBriefContractSchema,
  type BrandReconstructionProposal,
  type CanonicalCommerceProjection,
  type EvidenceKind,
  type ReconciliationCommerceField,
  type ReconciliationResult,
  type SourceDiscoveryResult,
  type SourceEvidence,
  type SourceReference,
  type StorefrontDesignBriefContract,
  type StorefrontSourceEvidenceMaterial,
} from "@/domain/source-discovery";
import { productPriceSchema } from "@/domain/catalogue";
import {
  brandDirectionSchema,
  businessIdentitySchema,
  languagePlanSchema,
  storefrontStructureSchema,
} from "@/domain/design-brief";
import {
  canonicalValueFingerprint,
  canonicalValueString,
} from "@/domain/storefront/canonical-storefront";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";
import {
  type ApproveStorefrontDesignBriefInput,
  type CreateStorefrontDesignBriefInput,
  type ProposeBrandReconstructionInput,
  type ReconcileStorefrontSourcesInput,
  type SourceDiscoveryAdapter,
  SourceDiscoveryApplicationError,
  type StorefrontDesignBriefEvidenceFingerprintInput,
  type SupersedeStorefrontDesignBriefInput,
  type SupersedeStorefrontDesignBriefResult,
  type UpdateStorefrontDesignBriefReviewInput,
} from "./contract";

function isoNow(input?: Date | string): string {
  const value = input instanceof Date ? input.toISOString() : (input ?? new Date().toISOString());
  return isoDateTimeSchema.parse(value);
}

function parseContract<T>(parse: (value: unknown) => T, value: unknown, message: string): T {
  try {
    return parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new SourceDiscoveryApplicationError(
        "invalid-contract",
        `${message}: ${error.issues[0]?.message ?? "invalid value"}`,
      );
    }
    throw error;
  }
}

function sourceValidationFailure(input: unknown): SourceDiscoveryApplicationError {
  if (
    typeof input === "object" &&
    input !== null &&
    "url" in input &&
    typeof input.url === "string"
  ) {
    try {
      if (new URL(input.url).protocol !== "https:") {
        return new SourceDiscoveryApplicationError(
          "unsupported-protocol",
          "The storefront source must use HTTPS.",
        );
      }
    } catch {
      return new SourceDiscoveryApplicationError(
        "invalid-url",
        "The storefront source URL is invalid.",
      );
    }
  }
  return new SourceDiscoveryApplicationError(
    "invalid-url",
    "The storefront source reference is invalid.",
  );
}

function normalizedUrl(value: string): URL {
  const url = new URL(value);
  url.hash = "";
  return url;
}

function discoveryIntegrityFailure(): SourceDiscoveryApplicationError {
  return new SourceDiscoveryApplicationError(
    "unavailable-source",
    "The storefront source response could not be safely verified. Try discovery again.",
  );
}

function assertDiscoveryResultBelongsToSource(
  requested: SourceReference,
  result: SourceDiscoveryResult,
): void {
  const requestedUrl = normalizedUrl(requested.url);
  const resultUrl = normalizedUrl(result.source.url);
  if (
    result.source.id !== requested.id ||
    result.source.sourceType !== requested.sourceType ||
    result.source.normalizedOrigin !== requested.normalizedOrigin ||
    resultUrl.toString() !== requestedUrl.toString() ||
    result.source.requestedLocale !== requested.requestedLocale ||
    result.source.discoveredAt !== requested.discoveredAt ||
    canonicalValueString(result.source.allowedDiscoveryPolicy) !==
      canonicalValueString(requested.allowedDiscoveryPolicy)
  ) {
    throw discoveryIntegrityFailure();
  }

  for (const evidence of result.evidence) {
    const evidenceUrl = normalizedUrl(evidence.sourceUrl);
    const documentUrl = evidence.provenance.documentUrl
      ? normalizedUrl(evidence.provenance.documentUrl)
      : evidenceUrl;
    if (
      evidence.provenance.sourceReferenceId !== requested.id ||
      evidenceUrl.origin !== requested.normalizedOrigin ||
      documentUrl.origin !== requested.normalizedOrigin
    ) {
      throw discoveryIntegrityFailure();
    }
  }

  for (const asset of result.assetCandidates) {
    if (asset.source.kind === "merchant-upload") continue;
    const assetUrl = normalizedUrl(asset.source.url);
    const documentUrl = asset.provenance.documentUrl
      ? normalizedUrl(asset.provenance.documentUrl)
      : assetUrl;
    if (
      asset.provenance.sourceReferenceId !== requested.id ||
      assetUrl.origin !== requested.normalizedOrigin ||
      documentUrl.origin !== requested.normalizedOrigin
    ) {
      throw discoveryIntegrityFailure();
    }
  }
}

export async function discoverStorefrontSource(
  adapter: SourceDiscoveryAdapter,
  sourceInput: unknown,
  signal?: AbortSignal,
): Promise<SourceDiscoveryResult> {
  let source: SourceReference;
  try {
    source = sourceReferenceSchema.parse(sourceInput);
  } catch {
    throw sourceValidationFailure(sourceInput);
  }
  try {
    const result = await adapter.discover({ source, signal });
    const parsed = parseContract(
      (value) => sourceDiscoveryResultSchema.parse(value),
      result,
      "The source discovery result is invalid",
    );
    assertDiscoveryResultBelongsToSource(source, parsed);
    return parsed;
  } catch (error) {
    if (error instanceof SourceDiscoveryApplicationError) throw error;
    throw new SourceDiscoveryApplicationError(
      "unavailable-source",
      "The storefront source could not be discovered.",
    );
  }
}

function localizedValues(value: unknown): string[] {
  const values =
    typeof value === "string"
      ? [value]
      : value && typeof value === "object"
        ? Object.values(value).filter((entry): entry is string => typeof entry === "string")
        : [];
  return values.map((entry) => entry.trim().toLocaleLowerCase()).filter(Boolean);
}

function sameStringSet(left: unknown, right: readonly string[]): boolean {
  if (!Array.isArray(left) || !left.every((value) => typeof value === "string")) return false;
  return canonicalValueString([...left].sort()) === canonicalValueString([...right].sort());
}

type CanonicalMatch<Value> =
  | Readonly<{ kind: "resolved"; value: Value; matchedBy: "id" | "sku" | "slug" | "title" }>
  | Readonly<{ kind: "ambiguous"; candidateIds: string[] }>
  | Readonly<{ kind: "missing"; candidateIds: [] }>;

function matchCanonicalProduct(
  evidence: SourceEvidence,
  projection: CanonicalCommerceProjection,
): CanonicalMatch<CanonicalCommerceProjection["products"][number]> {
  if (
    evidence.kind !== "product-reference-observed" ||
    !evidence.observedValue ||
    typeof evidence.observedValue !== "object"
  ) {
    return { kind: "missing", candidateIds: [] };
  }
  const observed = evidence.observedValue as Record<string, unknown>;
  if (typeof observed.productId === "string") {
    const byId = projection.products.find((product) => product.id === observed.productId);
    if (byId) return { kind: "resolved", value: byId, matchedBy: "id" };
  }
  if (typeof observed.sku === "string") {
    const bySku = projection.products.find((product) => product.sku === observed.sku);
    if (bySku) return { kind: "resolved", value: bySku, matchedBy: "sku" };
  }
  const observedTitles = localizedValues(observed.title);
  const titleMatches = projection.products.filter(
    (product) =>
      observedTitles.length > 0 &&
      localizedValues(product.title).some((title) => observedTitles.includes(title)),
  );
  if (titleMatches.length === 1) {
    return { kind: "resolved", value: titleMatches[0], matchedBy: "title" };
  }
  if (titleMatches.length > 1) {
    return { kind: "ambiguous", candidateIds: titleMatches.map((product) => product.id).sort() };
  }
  return { kind: "missing", candidateIds: [] };
}

function matchCanonicalCollection(
  evidence: SourceEvidence,
  projection: CanonicalCommerceProjection,
): CanonicalMatch<CanonicalCommerceProjection["collections"][number]> {
  if (
    evidence.kind !== "collection-reference-observed" ||
    !evidence.observedValue ||
    typeof evidence.observedValue !== "object"
  ) {
    return { kind: "missing", candidateIds: [] };
  }
  const observed = evidence.observedValue as Record<string, unknown>;
  if (typeof observed.collectionId === "string") {
    const byId = projection.collections.find(
      (collection) => collection.id === observed.collectionId,
    );
    if (byId) return { kind: "resolved", value: byId, matchedBy: "id" };
  }
  if (typeof observed.slug === "string") {
    const slugMatches = projection.collections.filter(
      (collection) => collection.slug === observed.slug,
    );
    if (slugMatches.length === 1) {
      return { kind: "resolved", value: slugMatches[0], matchedBy: "slug" };
    }
    if (slugMatches.length > 1) {
      return {
        kind: "ambiguous",
        candidateIds: slugMatches.map((collection) => collection.id).sort(),
      };
    }
  }
  const observedTitles = localizedValues(observed.title);
  const titleMatches = projection.collections.filter(
    (collection) =>
      observedTitles.length > 0 &&
      localizedValues(collection.title).some((title) => observedTitles.includes(title)),
  );
  if (titleMatches.length === 1) {
    return { kind: "resolved", value: titleMatches[0], matchedBy: "title" };
  }
  if (titleMatches.length > 1) {
    return {
      kind: "ambiguous",
      candidateIds: titleMatches.map((collection) => collection.id).sort(),
    };
  }
  return { kind: "missing", candidateIds: [] };
}

function canonicalFieldValue(
  product: CanonicalCommerceProjection["products"][number],
  field: ReconciliationCommerceField,
  projection: CanonicalCommerceProjection,
): unknown {
  switch (field) {
    case "product-identity":
      return { id: product.id, title: product.title };
    case "sku":
      return product.sku ?? null;
    case "price":
      return product.price ?? product.priceUnavailableReason ?? null;
    case "compare-at-price":
      return product.compareAtPrice ?? null;
    case "availability":
      return product.availabilityLabel ?? product.stockStatus ?? null;
    case "inventory":
      return product.stockStatus ?? null;
    case "variants":
      return product.variants;
    case "order-options":
      return product.orderOptions ?? [];
    case "collection-membership":
      return projection.collections
        .filter((collection) => collection.productIds.includes(product.id))
        .map((collection) => collection.id);
  }
}

const observedFieldNames: ReadonlyArray<readonly [ReconciliationCommerceField, string[]]> = [
  ["product-identity", ["productId", "title"]],
  ["sku", ["sku"]],
  ["price", ["price"]],
  ["compare-at-price", ["compareAtPrice"]],
  ["availability", ["availability", "availabilityLabel"]],
  ["inventory", ["inventory", "stockStatus"]],
  ["variants", ["variants"]],
  ["order-options", ["orderOptions", "optionGroups"]],
  ["collection-membership", ["collectionMembership", "collectionIds"]],
];

export function reconcileStorefrontSources(
  input: ReconcileStorefrontSourcesInput,
): ReconciliationResult {
  const source = parseContract(
    (value) => sourceReferenceSchema.parse(value),
    input.source,
    "The source reference is invalid",
  );
  const discovery = parseContract(
    (value) => sourceDiscoveryResultSchema.parse(value),
    input.discovery,
    "The discovery result is invalid",
  );
  assertDiscoveryResultBelongsToSource(source, discovery);
  if (input.canonicalCommerceProjection === null) {
    throw new SourceDiscoveryApplicationError(
      "missing-canonical-vesko-projection",
      "A canonical Vesko catalogue is required to reconcile storefront evidence.",
    );
  }
  const projection = parseContract(
    (value) => canonicalCommerceProjectionSchema.parse(value),
    input.canonicalCommerceProjection,
    "The canonical commerce projection is invalid",
  );
  const decisions: Array<ReturnType<typeof reconciliationDecisionSchema.parse>> = [];
  const unresolvedConflictIds: string[] = [];
  const missingInformationIds: string[] = [];
  const addMissingInformation = (decisionId: string) => {
    if (!missingInformationIds.includes(decisionId)) missingInformationIds.push(decisionId);
  };

  for (const evidence of discovery.evidence) {
    if (
      evidence.kind !== "product-reference-observed" &&
      evidence.kind !== "collection-reference-observed"
    ) {
      const decisionId = `reconcile_${evidence.id}`;
      decisions.push(
        reconciliationDecisionSchema.parse({
          id: decisionId,
          kind: evidence.uncertainty.isUncertain
            ? "merchant-decision-required"
            : "accepted-evidence",
          evidenceId: evidence.id,
          canonicalProductId: null,
          canonicalCollectionId: null,
          candidateCanonicalIds: [],
          field: null,
          sourceValue: evidence.observedValue,
          canonicalValue: null,
          reason: evidence.uncertainty.isUncertain
            ? (evidence.uncertainty.reason ?? "Evidence needs merchant confirmation.")
            : "Design evidence retained with provenance.",
          merchantDecisionRequired: evidence.uncertainty.isUncertain,
        }),
      );
      if (evidence.uncertainty.isUncertain) addMissingInformation(decisionId);
      continue;
    }

    if (evidence.kind === "collection-reference-observed") {
      const match = matchCanonicalCollection(evidence, projection);
      if (match.kind !== "resolved") {
        const decisionId = `reconcile_${evidence.id}_collection`;
        const ambiguous = match.kind === "ambiguous";
        decisions.push(
          reconciliationDecisionSchema.parse({
            id: decisionId,
            kind: ambiguous ? "merchant-decision-required" : "unresolved-conflict",
            evidenceId: evidence.id,
            canonicalProductId: null,
            canonicalCollectionId: null,
            candidateCanonicalIds: match.candidateIds,
            field: "collection-identity",
            sourceValue: evidence.observedValue,
            canonicalValue: ambiguous
              ? projection.collections
                  .filter((collection) => match.candidateIds.includes(collection.id))
                  .map((collection) => ({
                    id: collection.id,
                    slug: collection.slug,
                    title: collection.title,
                  }))
              : null,
            reason: ambiguous
              ? "Multiple canonical Vesko collections match the observed title; merchant confirmation is required."
              : "The observed collection could not be matched to the canonical Vesko catalogue.",
            merchantDecisionRequired: ambiguous,
          }),
        );
        unresolvedConflictIds.push(decisionId);
        if (ambiguous) addMissingInformation(decisionId);
        continue;
      }

      const observed = evidence.observedValue as Record<string, unknown>;
      const collection = match.value;
      const sourceCollectionId =
        typeof observed.collectionId === "string" ? observed.collectionId : null;
      const sourceSlug = typeof observed.slug === "string" ? observed.slug : null;
      const identityConflicts =
        (sourceCollectionId !== null && sourceCollectionId !== collection.id) ||
        (sourceSlug !== null && sourceSlug !== collection.slug) ||
        (localizedValues(observed.title).length > 0 &&
          !localizedValues(collection.title).some((title) =>
            localizedValues(observed.title).includes(title),
          ));
      decisions.push(
        reconciliationDecisionSchema.parse({
          id: `reconcile_${evidence.id}_collection-identity`,
          kind: identityConflicts ? "canonical-override" : "accepted-evidence",
          evidenceId: evidence.id,
          canonicalProductId: null,
          canonicalCollectionId: collection.id,
          candidateCanonicalIds: [],
          field: "collection-identity",
          sourceValue: {
            collectionId: observed.collectionId ?? null,
            slug: observed.slug ?? null,
            title: observed.title ?? null,
          },
          canonicalValue: { id: collection.id, slug: collection.slug, title: collection.title },
          reason: identityConflicts
            ? "Canonical Vesko collection identity remains authoritative."
            : "The observed collection resolves to one canonical Vesko collection.",
          merchantDecisionRequired: false,
        }),
      );

      const membershipKey = ["productIds", "membership", "productSkus"].find((key) =>
        Object.prototype.hasOwnProperty.call(observed, key),
      );
      if (membershipKey) {
        const sourceMembership = observed[membershipKey] ?? null;
        const canonicalMembership = collection.productIds;
        const sameMembership = sameStringSet(sourceMembership, canonicalMembership);
        decisions.push(
          reconciliationDecisionSchema.parse({
            id: `reconcile_${evidence.id}_collection-membership`,
            kind: sameMembership ? "accepted-evidence" : "canonical-override",
            evidenceId: evidence.id,
            canonicalProductId: null,
            canonicalCollectionId: collection.id,
            candidateCanonicalIds: [],
            field: "collection-membership",
            sourceValue: sourceMembership,
            canonicalValue: canonicalMembership,
            reason: sameMembership
              ? "The public collection membership agrees with canonical Vesko data."
              : "Canonical Vesko collection product membership remains authoritative.",
            merchantDecisionRequired: false,
          }),
        );
      }
      continue;
    }

    const match = matchCanonicalProduct(evidence, projection);
    if (match.kind !== "resolved") {
      const decisionId = `reconcile_${evidence.id}_missing`;
      const ambiguous = match.kind === "ambiguous";
      decisions.push(
        reconciliationDecisionSchema.parse({
          id: decisionId,
          kind: ambiguous ? "merchant-decision-required" : "unresolved-conflict",
          evidenceId: evidence.id,
          canonicalProductId: null,
          canonicalCollectionId: null,
          candidateCanonicalIds: match.candidateIds,
          field: "product-identity",
          sourceValue: evidence.observedValue,
          canonicalValue: ambiguous
            ? projection.products
                .filter((product) => match.candidateIds.includes(product.id))
                .map((product) => ({ id: product.id, sku: product.sku, title: product.title }))
            : null,
          reason: ambiguous
            ? "Multiple canonical Vesko products match the observed title; merchant confirmation is required."
            : "The observed product could not be matched to the canonical Vesko catalogue.",
          merchantDecisionRequired: ambiguous,
        }),
      );
      unresolvedConflictIds.push(decisionId);
      if (ambiguous) addMissingInformation(decisionId);
      continue;
    }

    const product = match.value;
    const observed = evidence.observedValue as Record<string, unknown>;
    for (const [field, keys] of observedFieldNames) {
      const key = keys.find((candidate) =>
        Object.prototype.hasOwnProperty.call(observed, candidate),
      );
      if (!key) continue;
      const rawSourceValue = observed[key];
      const sourceValue =
        field === "product-identity"
          ? { productId: observed.productId ?? null, title: observed.title ?? null }
          : (rawSourceValue ?? null);
      const canonicalValue = canonicalFieldValue(product, field, projection);
      const protectedPriceIsValid =
        field !== "compare-at-price" ||
        sourceValue === null ||
        productPriceSchema.safeParse(sourceValue).success;
      const observedTitles = localizedValues(observed.title);
      const identityMatches =
        (typeof observed.productId !== "string" || observed.productId === product.id) &&
        (observedTitles.length === 0 ||
          localizedValues(product.title).some((title) => observedTitles.includes(title)));
      const same =
        field === "product-identity"
          ? identityMatches
          : canonicalValueString(sourceValue) === canonicalValueString(canonicalValue);
      const decisionId = `reconcile_${evidence.id}_${field}`;
      decisions.push(
        reconciliationDecisionSchema.parse({
          id: decisionId,
          kind: !protectedPriceIsValid
            ? "rejected-evidence"
            : same
              ? "accepted-evidence"
              : "canonical-override",
          evidenceId: evidence.id,
          canonicalProductId: product.id,
          canonicalCollectionId: null,
          candidateCanonicalIds: [],
          field,
          sourceValue,
          canonicalValue,
          reason: !protectedPriceIsValid
            ? "The observed compare-at price is invalid and was rejected."
            : same
              ? "The source evidence agrees with canonical Vesko data."
              : "Canonical Vesko commerce data remains authoritative.",
          merchantDecisionRequired: false,
        }),
      );
    }
  }

  for (const evidence of discovery.evidence.filter(
    (candidate) => candidate.uncertainty.isUncertain,
  )) {
    const existingDecision = decisions.find(
      (decision) => decision.evidenceId === evidence.id && decision.merchantDecisionRequired,
    );
    if (existingDecision) {
      addMissingInformation(existingDecision.id);
    } else {
      const decisionId = `reconcile_${evidence.id}_uncertain`;
      decisions.push(
        reconciliationDecisionSchema.parse({
          id: decisionId,
          kind: "merchant-decision-required",
          evidenceId: evidence.id,
          canonicalProductId: null,
          canonicalCollectionId: null,
          candidateCanonicalIds: [],
          field: null,
          sourceValue: evidence.observedValue,
          canonicalValue: null,
          reason: evidence.uncertainty.reason ?? "Evidence needs merchant confirmation.",
          merchantDecisionRequired: true,
        }),
      );
      addMissingInformation(decisionId);
    }
  }

  return reconciliationResultSchema.parse({
    sourceReferenceId: source.id,
    canonicalCommerceProjectionRef: projection.id,
    decisions,
    unresolvedConflictIds,
    missingInformationIds,
  });
}

const trustedBrandEvidenceConfidence = 0.7;

function evidenceString(evidence: readonly SourceEvidence[], kind: EvidenceKind): string | null {
  const candidate = evidence.find(
    (item) =>
      item.kind === kind &&
      !item.uncertainty.isUncertain &&
      item.confidence >= trustedBrandEvidenceConfidence,
  );
  if (typeof candidate?.observedValue === "string") return candidate.observedValue;
  return null;
}

export function proposeBrandReconstruction(
  input: ProposeBrandReconstructionInput,
): BrandReconstructionProposal {
  const source = sourceReferenceSchema.parse(input.source);
  const evidence = input.evidence.map((item) => sourceEvidenceSchema.parse(item));
  const assets = input.assetCandidates.map((item) => assetCandidateSchema.parse(item));
  const colourEvidence = evidence.find(
    (item) =>
      item.kind === "colour-signal" &&
      !item.uncertainty.isUncertain &&
      item.confidence >= trustedBrandEvidenceConfidence,
  );
  const colourValue =
    typeof colourEvidence?.observedValue === "string" ? colourEvidence.observedValue : null;
  const logoAssetIds = assets.filter((asset) => asset.role === "logo").map((asset) => asset.id);
  const needsReview = evidence.filter(
    (item) => item.uncertainty.isUncertain || item.confidence < trustedBrandEvidenceConfidence,
  );
  const proposal = {
    id: `brand_proposal_${source.id}`,
    status: "needsReview" as const,
    palette: { primary: colourValue, secondary: null, accent: null, background: null, text: null },
    typographyDirection: evidenceString(evidence, "typography-signal"),
    spacingDensity: null,
    shapeDirection: null,
    imageryDirection: evidenceString(evidence, "imagery-style"),
    toneOfVoice: evidence
      .filter(
        (item) =>
          item.kind === "marketing-copy-candidate" &&
          !item.uncertainty.isUncertain &&
          item.confidence >= trustedBrandEvidenceConfidence,
      )
      .flatMap((item) => (typeof item.observedValue === "string" ? [item.observedValue] : [])),
    reusedAssetIds: logoAssetIds,
    assumptions:
      logoAssetIds.length > 0
        ? ["A logo is available; other brand directions need merchant confirmation."]
        : [
            "Brand directions are inferred from limited source evidence and need merchant confirmation.",
          ],
    confidence:
      evidence.length === 0
        ? 0
        : evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length,
    warnings: needsReview.map((item) => ({
      code: "uncertain-evidence" as const,
      message:
        item.uncertainty.reason ??
        "This low-confidence signal needs merchant confirmation before reuse.",
    })),
    evidenceReferenceIds: evidence.map((item) => item.id),
    merchantApproved: false as const,
  };
  return brandReconstructionProposalSchema.parse(proposal);
}

function list(values: readonly string[] | undefined): string[] {
  return [...(values ?? [])];
}

function uniqueList(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function sameIdentifiers(left: readonly string[], right: readonly string[]): boolean {
  return canonicalValueString([...left].sort()) === canonicalValueString([...right].sort());
}

export function createStorefrontDesignBriefEvidenceFingerprint(
  input: StorefrontDesignBriefEvidenceFingerprintInput,
): string {
  const materialSourceIds = input.materialEvidence.sourceReferences.map((source) => source.id);
  const materialEvidenceIds = input.materialEvidence.evidence.map((evidence) => evidence.id);
  if (
    !sameIdentifiers(materialSourceIds, input.sourceReferenceIds) ||
    !sameIdentifiers(materialEvidenceIds, input.sourceEvidenceIds) ||
    (input.materialEvidence.reconciliation !== null &&
      input.materialEvidence.reconciliation.canonicalCommerceProjectionRef !==
        input.canonicalCommerceProjectionRef)
  ) {
    throw new SourceDiscoveryApplicationError(
      "invalid-contract",
      "The material source evidence does not match the Storefront Design Brief references.",
    );
  }
  const sourceEvidenceFingerprint = createStorefrontSourceEvidenceFingerprint(
    input.materialEvidence,
  );
  return input.assetReviewFingerprint
    ? canonicalValueFingerprint({
        sourceEvidenceFingerprint,
        assetReviewFingerprint: input.assetReviewFingerprint,
      })
    : sourceEvidenceFingerprint;
}

function reconciliationQuestions(
  materialEvidence: StorefrontSourceEvidenceMaterial | undefined,
): string[] {
  if (!materialEvidence?.reconciliation) return [];
  return uniqueList(
    materialEvidence.reconciliation.decisions
      .filter(
        (decision) =>
          decision.merchantDecisionRequired ||
          materialEvidence.reconciliation?.missingInformationIds.includes(decision.id) ||
          materialEvidence.reconciliation?.unresolvedConflictIds.includes(decision.id),
      )
      .map((decision) => decision.reason),
  );
}

function fingerprintBrief(
  brief: Omit<StorefrontDesignBriefContract, "fingerprint"> | StorefrontDesignBriefContract,
): string {
  const value = { ...brief } as Partial<StorefrontDesignBriefContract>;
  delete value.fingerprint;
  return canonicalValueFingerprint(value);
}

export function createStorefrontDesignBrief(
  input: CreateStorefrontDesignBriefInput,
): StorefrontDesignBriefContract {
  const timestamp = isoNow(input.now);
  const sourceReferenceIds = list(input.sourceReferenceIds);
  const sourceEvidenceIds = list(input.sourceEvidenceIds);
  const canonicalCommerceProjectionRef = input.canonicalCommerceProjectionRef ?? null;
  const evidenceFingerprint = createStorefrontDesignBriefEvidenceFingerprint({
    sourceReferenceIds,
    sourceEvidenceIds,
    canonicalCommerceProjectionRef,
    materialEvidence: input.materialEvidence,
    assetReviewFingerprint: input.assetReviewFingerprint,
  });
  const candidate = {
    id: idSchema.parse(input.id),
    revision: 1,
    status: "needsReview" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    businessIdentity: businessIdentitySchema.parse(input.businessIdentity ?? {}),
    languagePlan: languagePlanSchema.parse(input.languagePlan ?? { selectedLanguages: [] }),
    sourceReferenceIds,
    sourceEvidenceIds,
    canonicalCommerceProjectionRef,
    approvedBrandDirection:
      input.approvedBrandDirection === undefined
        ? null
        : brandDirectionSchema.parse(input.approvedBrandDirection),
    brandProposal: input.brandProposal
      ? brandReconstructionProposalSchema.parse(input.brandProposal)
      : null,
    approvedReusableAssetIds: list(input.approvedReusableAssetIds),
    approvedAssetAssignments: [...(input.approvedAssetAssignments ?? [])],
    assetReviewFingerprint: input.assetReviewFingerprint ?? null,
    pagePlan: storefrontStructureSchema.parse(
      input.pagePlan ?? { pageTypes: ["home", "collection", "product"] },
    ),
    navigationDirection: list(input.navigationDirection),
    homepageGoals: list(input.homepageGoals),
    collectionPageGoals: list(input.collectionPageGoals),
    productPageGoals: list(input.productPageGoals),
    visualPriorities: list(input.visualPriorities),
    contentAssumptions: list(input.contentAssumptions),
    unresolvedItems: uniqueList([
      ...list(input.unresolvedItems),
      ...reconciliationQuestions(input.materialEvidence),
    ]),
    materialUnresolvedBlockers: list(input.materialUnresolvedBlockers),
    excludedClaims: list(input.excludedClaims),
    generationPermissions: {
      allowMarketingCopy: input.generationPermissions?.allowMarketingCopy ?? true,
      allowAssetReuse: input.generationPermissions?.allowAssetReuse ?? false,
      allowGeneratedImagery: input.generationPermissions?.allowGeneratedImagery ?? false,
    },
    approval: { status: "pending" as const, actorId: null, approvedAt: null },
    evidenceFingerprint,
    approvedEvidenceFingerprint: null,
    supersedesRevision: null,
    supersededByRevision: null,
    supersessionReason: null,
  };
  return storefrontDesignBriefContractSchema.parse({
    ...candidate,
    fingerprint: fingerprintBrief(candidate),
  });
}

export function approveStorefrontDesignBrief(
  briefInput: StorefrontDesignBriefContract,
  input: ApproveStorefrontDesignBriefInput,
): StorefrontDesignBriefContract {
  const brief = storefrontDesignBriefContractSchema.parse(briefInput);
  if (brief.status !== "needsReview") {
    throw new SourceDiscoveryApplicationError(
      "invalid-lifecycle",
      "Only a current brief needing review can be approved.",
    );
  }
  if (brief.materialUnresolvedBlockers.length > 0 || brief.unresolvedItems.length > 0) {
    throw new SourceDiscoveryApplicationError(
      "conflicting-evidence",
      "Resolve material source questions before approving the brief.",
    );
  }
  if (brief.canonicalCommerceProjectionRef === null) {
    throw new SourceDiscoveryApplicationError(
      "missing-canonical-vesko-projection",
      "A canonical Vesko commerce projection is required before approval.",
    );
  }
  const approvedBrandDirection =
    input.approvedBrandDirection === undefined
      ? brief.approvedBrandDirection
      : brandDirectionSchema.parse(input.approvedBrandDirection);
  if (approvedBrandDirection === null) {
    throw new SourceDiscoveryApplicationError(
      "invalid-lifecycle",
      "Merchant brand confirmation is required before approval.",
    );
  }
  const approvalTime = isoNow(input.approvedAt);
  const candidate = {
    ...brief,
    status: "approved" as const,
    updatedAt: approvalTime,
    approvedBrandDirection,
    approvedEvidenceFingerprint: brief.evidenceFingerprint,
    approval: {
      status: "approved" as const,
      actorId: idSchema.parse(input.actorId),
      approvedAt: approvalTime,
    },
  };
  return storefrontDesignBriefContractSchema.parse({
    ...candidate,
    fingerprint: fingerprintBrief(candidate),
  });
}

/** Rebuilds the current unapproved revision after merchant reconciliation decisions. */
export function updateStorefrontDesignBriefReview(
  briefInput: StorefrontDesignBriefContract,
  input: UpdateStorefrontDesignBriefReviewInput,
): StorefrontDesignBriefContract {
  const brief = storefrontDesignBriefContractSchema.parse(briefInput);
  if (brief.status !== "needsReview") {
    throw new SourceDiscoveryApplicationError(
      "invalid-lifecycle",
      "Only a current brief needing review can be updated.",
    );
  }
  const sourceReferenceIds = input.materialEvidence.sourceReferences.map((source) => source.id);
  const sourceEvidenceIds = input.materialEvidence.evidence.map((evidence) => evidence.id);
  const canonicalCommerceProjectionRef =
    input.materialEvidence.reconciliation?.canonicalCommerceProjectionRef ?? null;
  const evidenceFingerprint = createStorefrontDesignBriefEvidenceFingerprint({
    sourceReferenceIds,
    sourceEvidenceIds,
    canonicalCommerceProjectionRef,
    materialEvidence: input.materialEvidence,
    assetReviewFingerprint: input.assetReviewFingerprint ?? brief.assetReviewFingerprint,
  });
  const timestamp = isoNow(input.now);
  const candidate = {
    ...brief,
    updatedAt: timestamp,
    businessIdentity:
      input.businessIdentity === undefined
        ? brief.businessIdentity
        : businessIdentitySchema.parse(input.businessIdentity),
    languagePlan:
      input.languagePlan === undefined
        ? brief.languagePlan
        : languagePlanSchema.parse(input.languagePlan),
    sourceReferenceIds,
    sourceEvidenceIds,
    canonicalCommerceProjectionRef,
    approvedBrandDirection:
      input.approvedBrandDirection === undefined
        ? brief.approvedBrandDirection
        : brandDirectionSchema.parse(input.approvedBrandDirection),
    brandProposal:
      input.brandProposal === undefined
        ? brief.brandProposal
        : input.brandProposal
          ? brandReconstructionProposalSchema.parse(input.brandProposal)
          : null,
    approvedReusableAssetIds:
      input.approvedReusableAssetIds === undefined
        ? brief.approvedReusableAssetIds
        : list(input.approvedReusableAssetIds),
    approvedAssetAssignments:
      input.approvedAssetAssignments === undefined
        ? brief.approvedAssetAssignments
        : [...input.approvedAssetAssignments],
    assetReviewFingerprint:
      input.assetReviewFingerprint === undefined
        ? brief.assetReviewFingerprint
        : input.assetReviewFingerprint,
    pagePlan:
      input.pagePlan === undefined
        ? brief.pagePlan
        : storefrontStructureSchema.parse(input.pagePlan),
    navigationDirection:
      input.navigationDirection === undefined
        ? brief.navigationDirection
        : list(input.navigationDirection),
    homepageGoals:
      input.homepageGoals === undefined ? brief.homepageGoals : list(input.homepageGoals),
    collectionPageGoals:
      input.collectionPageGoals === undefined
        ? brief.collectionPageGoals
        : list(input.collectionPageGoals),
    productPageGoals:
      input.productPageGoals === undefined ? brief.productPageGoals : list(input.productPageGoals),
    visualPriorities:
      input.visualPriorities === undefined ? brief.visualPriorities : list(input.visualPriorities),
    contentAssumptions:
      input.contentAssumptions === undefined
        ? brief.contentAssumptions
        : list(input.contentAssumptions),
    unresolvedItems: uniqueList([
      ...list(input.unresolvedItems),
      ...reconciliationQuestions(input.materialEvidence),
    ]),
    materialUnresolvedBlockers:
      input.materialUnresolvedBlockers === undefined
        ? brief.materialUnresolvedBlockers
        : list(input.materialUnresolvedBlockers),
    excludedClaims:
      input.excludedClaims === undefined ? brief.excludedClaims : list(input.excludedClaims),
    generationPermissions:
      input.generationPermissions === undefined
        ? brief.generationPermissions
        : {
            allowMarketingCopy: input.generationPermissions.allowMarketingCopy ?? true,
            allowAssetReuse: input.generationPermissions.allowAssetReuse ?? false,
            allowGeneratedImagery: input.generationPermissions.allowGeneratedImagery ?? false,
          },
    evidenceFingerprint,
    approvedEvidenceFingerprint: null,
  };
  return storefrontDesignBriefContractSchema.parse({
    ...candidate,
    fingerprint: fingerprintBrief(candidate),
  });
}

export function supersedeStorefrontDesignBrief(
  briefInput: StorefrontDesignBriefContract,
  input: SupersedeStorefrontDesignBriefInput,
): SupersedeStorefrontDesignBriefResult {
  const brief = storefrontDesignBriefContractSchema.parse(briefInput);
  if (brief.status !== "approved") {
    throw new SourceDiscoveryApplicationError(
      "invalid-lifecycle",
      "Only an approved brief can be superseded.",
    );
  }
  const timestamp = isoNow(input.now);
  const replacementRevision = brief.revision + 1;
  const reason = input.reason ?? "Material source evidence changed; merchant review is required.";
  const sourceReferenceIds = input.sourceReferenceIds
    ? list(input.sourceReferenceIds)
    : input.materialEvidence.sourceReferences.map((source) => source.id);
  const sourceEvidenceIds = input.sourceEvidenceIds
    ? list(input.sourceEvidenceIds)
    : input.materialEvidence.evidence.map((evidence) => evidence.id);
  const replacementCanonicalCommerceProjectionRef =
    input.materialEvidence.reconciliation?.canonicalCommerceProjectionRef ??
    brief.canonicalCommerceProjectionRef;
  const replacementEvidenceFingerprint = createStorefrontDesignBriefEvidenceFingerprint({
    sourceReferenceIds,
    sourceEvidenceIds,
    canonicalCommerceProjectionRef: replacementCanonicalCommerceProjectionRef,
    materialEvidence: input.materialEvidence,
    assetReviewFingerprint: input.assetReviewFingerprint ?? null,
  });
  const supersededCandidate = {
    ...brief,
    status: "superseded" as const,
    updatedAt: timestamp,
    supersededByRevision: replacementRevision,
    supersessionReason: brief.supersessionReason ?? reason,
  };
  const superseded = storefrontDesignBriefContractSchema.parse({
    ...supersededCandidate,
    fingerprint: fingerprintBrief(supersededCandidate),
  });
  const replacementCandidate = {
    ...brief,
    revision: replacementRevision,
    status: "needsReview" as const,
    updatedAt: timestamp,
    sourceReferenceIds,
    sourceEvidenceIds,
    canonicalCommerceProjectionRef: replacementCanonicalCommerceProjectionRef,
    approvedBrandDirection: null,
    brandProposal:
      input.brandProposal === undefined
        ? null
        : input.brandProposal
          ? brandReconstructionProposalSchema.parse(input.brandProposal)
          : null,
    approvedReusableAssetIds: input.approvedReusableAssetIds
      ? list(input.approvedReusableAssetIds)
      : [],
    approvedAssetAssignments: input.approvedAssetAssignments
      ? [...input.approvedAssetAssignments]
      : [],
    assetReviewFingerprint: input.assetReviewFingerprint ?? null,
    approval: { status: "pending" as const, actorId: null, approvedAt: null },
    unresolvedItems: uniqueList([
      ...list(input.unresolvedItems),
      ...reconciliationQuestions(input.materialEvidence),
    ]),
    materialUnresolvedBlockers: list(input.materialUnresolvedBlockers),
    evidenceFingerprint: replacementEvidenceFingerprint,
    approvedEvidenceFingerprint: null,
    supersedesRevision: brief.revision,
    supersededByRevision: null,
    supersessionReason: reason,
  };
  const replacement = storefrontDesignBriefContractSchema.parse({
    ...replacementCandidate,
    fingerprint: fingerprintBrief(replacementCandidate),
  });
  return { superseded, replacement };
}

export function requireApprovedCurrentStorefrontDesignBrief(
  briefInput: StorefrontDesignBriefContract,
  currentEvidenceFingerprint?: string,
): StorefrontDesignBriefContract {
  const brief = storefrontDesignBriefContractSchema.parse(briefInput);
  if (brief.status !== "approved" || brief.approval.status !== "approved") {
    throw new SourceDiscoveryApplicationError(
      "stale-brief-approval",
      "Generation requires an approved current Storefront Design Brief.",
    );
  }
  if (
    currentEvidenceFingerprint === undefined ||
    currentEvidenceFingerprint !== brief.approvedEvidenceFingerprint
  ) {
    throw new SourceDiscoveryApplicationError(
      "stale-brief-approval",
      "The approved brief is stale because its source evidence changed.",
    );
  }
  return brief;
}
