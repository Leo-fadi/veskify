import { ZodError } from "zod";
import {
  assetCandidateSchema,
  brandReconstructionProposalSchema,
  canonicalCommerceProjectionSchema,
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
} from "@/domain/source-discovery";
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
  type SupersedeStorefrontDesignBriefInput,
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

export async function discoverStorefrontSource(
  adapter: SourceDiscoveryAdapter,
  sourceInput: unknown,
): Promise<SourceDiscoveryResult> {
  let source: SourceReference;
  try {
    source = sourceReferenceSchema.parse(sourceInput);
  } catch {
    throw sourceValidationFailure(sourceInput);
  }
  try {
    const result = await adapter.discover({ source });
    return parseContract(
      (value) => sourceDiscoveryResultSchema.parse(value),
      result,
      "The source discovery result is invalid",
    );
  } catch (error) {
    if (error instanceof SourceDiscoveryApplicationError) throw error;
    throw new SourceDiscoveryApplicationError(
      "unavailable-source",
      "The storefront source could not be discovered.",
    );
  }
}

function localizedValue(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.values(value).filter((entry): entry is string => typeof entry === "string");
}

function canonicalProductForEvidence(
  evidence: SourceEvidence,
  projection: CanonicalCommerceProjection,
) {
  if (
    evidence.kind !== "product-reference-observed" ||
    !evidence.observedValue ||
    typeof evidence.observedValue !== "object"
  ) {
    return null;
  }
  const observed = evidence.observedValue as Record<string, unknown>;
  const productId = typeof observed.productId === "string" ? observed.productId : null;
  const sku = typeof observed.sku === "string" ? observed.sku : null;
  const titles = localizedValue(observed.title);
  return (
    projection.products.find(
      (product) =>
        (productId !== null && product.id === productId) ||
        (sku !== null && product.sku === sku) ||
        (titles.length > 0 &&
          localizedValue(product.title).some((title) => titles.includes(title))),
    ) ?? null
  );
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

  for (const evidence of discovery.evidence) {
    if (evidence.kind !== "product-reference-observed") {
      const decisionId = `reconcile_${evidence.id}`;
      decisions.push(
        reconciliationDecisionSchema.parse({
          id: decisionId,
          kind: evidence.uncertainty.isUncertain
            ? "merchant-decision-required"
            : "accepted-evidence",
          evidenceId: evidence.id,
          canonicalProductId: null,
          field: null,
          sourceValue: evidence.observedValue,
          canonicalValue: null,
          reason: evidence.uncertainty.isUncertain
            ? (evidence.uncertainty.reason ?? "Evidence needs merchant confirmation.")
            : "Design evidence retained with provenance.",
          merchantDecisionRequired: evidence.uncertainty.isUncertain,
        }),
      );
      continue;
    }

    const product = canonicalProductForEvidence(evidence, projection);
    if (!product) {
      const decisionId = `reconcile_${evidence.id}_missing`;
      decisions.push(
        reconciliationDecisionSchema.parse({
          id: decisionId,
          kind: "unresolved-conflict",
          evidenceId: evidence.id,
          canonicalProductId: null,
          field: "product-identity",
          sourceValue: evidence.observedValue,
          canonicalValue: null,
          reason: "The observed product could not be matched to the canonical Vesko catalogue.",
          merchantDecisionRequired: true,
        }),
      );
      unresolvedConflictIds.push(decisionId);
      continue;
    }

    const observed = evidence.observedValue as Record<string, unknown>;
    for (const [field, keys] of observedFieldNames) {
      const key = keys.find((candidate) =>
        Object.prototype.hasOwnProperty.call(observed, candidate),
      );
      if (!key) continue;
      const sourceValue = observed[key];
      const canonicalValue = canonicalFieldValue(product, field, projection);
      const same = canonicalValueString(sourceValue) === canonicalValueString(canonicalValue);
      const decisionId = `reconcile_${evidence.id}_${field}`;
      decisions.push(
        reconciliationDecisionSchema.parse({
          id: decisionId,
          kind: same ? "accepted-evidence" : "canonical-override",
          evidenceId: evidence.id,
          canonicalProductId: product.id,
          field,
          sourceValue,
          canonicalValue,
          reason: same
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
    if (
      !decisions.some(
        (decision) => decision.evidenceId === evidence.id && decision.merchantDecisionRequired,
      )
    ) {
      const decisionId = `reconcile_${evidence.id}_uncertain`;
      decisions.push(
        reconciliationDecisionSchema.parse({
          id: decisionId,
          kind: "merchant-decision-required",
          evidenceId: evidence.id,
          canonicalProductId: null,
          field: null,
          sourceValue: evidence.observedValue,
          canonicalValue: null,
          reason: evidence.uncertainty.reason ?? "Evidence needs merchant confirmation.",
          merchantDecisionRequired: true,
        }),
      );
      missingInformationIds.push(decisionId);
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

function evidenceString(evidence: readonly SourceEvidence[], kind: EvidenceKind): string | null {
  const candidate = evidence.find((item) => item.kind === kind && !item.uncertainty.isUncertain);
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
    (item) => item.kind === "colour-signal" && !item.uncertainty.isUncertain,
  );
  const colourValue =
    typeof colourEvidence?.observedValue === "string" ? colourEvidence.observedValue : null;
  const logoAssetIds = assets.filter((asset) => asset.role === "logo").map((asset) => asset.id);
  const uncertain = evidence.filter((item) => item.uncertainty.isUncertain);
  const proposal = {
    id: `brand_proposal_${source.id}`,
    status: "needsReview" as const,
    palette: { primary: colourValue, secondary: null, accent: null, background: null, text: null },
    typographyDirection: evidenceString(evidence, "typography-signal"),
    spacingDensity: null,
    shapeDirection: null,
    imageryDirection: evidenceString(evidence, "imagery-style"),
    toneOfVoice: evidence
      .filter((item) => item.kind === "marketing-copy-candidate")
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
    warnings: uncertain.map((item) => ({
      code: "uncertain-evidence" as const,
      message: item.uncertainty.reason ?? "This signal needs merchant confirmation.",
    })),
    evidenceReferenceIds: evidence.map((item) => item.id),
    merchantApproved: false as const,
  };
  return brandReconstructionProposalSchema.parse(proposal);
}

function list(values: readonly string[] | undefined): string[] {
  return [...(values ?? [])];
}

function fingerprintBrief(brief: Omit<StorefrontDesignBriefContract, "fingerprint">): string {
  return canonicalValueFingerprint(brief);
}

export function createStorefrontDesignBrief(
  input: CreateStorefrontDesignBriefInput,
): StorefrontDesignBriefContract {
  const timestamp = isoNow(input.now);
  const candidate = {
    id: idSchema.parse(input.id),
    revision: 1,
    status: "needsReview" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    businessIdentity: businessIdentitySchema.parse(input.businessIdentity ?? {}),
    languagePlan: languagePlanSchema.parse(input.languagePlan ?? { selectedLanguages: [] }),
    sourceReferenceIds: list(input.sourceReferenceIds),
    sourceEvidenceIds: list(input.sourceEvidenceIds),
    canonicalCommerceProjectionRef: input.canonicalCommerceProjectionRef ?? null,
    approvedBrandDirection:
      input.approvedBrandDirection === undefined
        ? null
        : brandDirectionSchema.parse(input.approvedBrandDirection),
    brandProposal: input.brandProposal
      ? brandReconstructionProposalSchema.parse(input.brandProposal)
      : null,
    approvedReusableAssetIds: list(input.approvedReusableAssetIds),
    pagePlan: storefrontStructureSchema.parse(
      input.pagePlan ?? { pageTypes: ["home", "collection", "product"] },
    ),
    navigationDirection: list(input.navigationDirection),
    homepageGoals: list(input.homepageGoals),
    collectionPageGoals: list(input.collectionPageGoals),
    productPageGoals: list(input.productPageGoals),
    visualPriorities: list(input.visualPriorities),
    contentAssumptions: list(input.contentAssumptions),
    unresolvedItems: list(input.unresolvedItems),
    materialUnresolvedBlockers: list(input.materialUnresolvedBlockers),
    excludedClaims: list(input.excludedClaims),
    generationPermissions: {
      allowMarketingCopy: input.generationPermissions?.allowMarketingCopy ?? true,
      allowAssetReuse: input.generationPermissions?.allowAssetReuse ?? false,
      allowGeneratedImagery: input.generationPermissions?.allowGeneratedImagery ?? false,
    },
    approval: { status: "pending" as const, actorId: null, approvedAt: null },
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
  const candidate = {
    ...brief,
    status: "approved" as const,
    updatedAt: isoNow(input.approvedAt),
    approvedBrandDirection,
    approval: {
      status: "approved" as const,
      actorId: idSchema.parse(input.actorId),
      approvedAt: isoNow(input.approvedAt),
    },
  };
  return storefrontDesignBriefContractSchema.parse({
    ...candidate,
    fingerprint: fingerprintBrief(candidate),
  });
}

export function supersedeStorefrontDesignBrief(
  briefInput: StorefrontDesignBriefContract,
  input: SupersedeStorefrontDesignBriefInput = {},
): StorefrontDesignBriefContract {
  const brief = storefrontDesignBriefContractSchema.parse(briefInput);
  if (brief.status !== "approved") {
    throw new SourceDiscoveryApplicationError(
      "invalid-lifecycle",
      "Only an approved brief can be superseded.",
    );
  }
  const timestamp = isoNow(input.now);
  const candidate = {
    ...brief,
    revision: brief.revision + 1,
    status: "superseded" as const,
    updatedAt: timestamp,
    sourceReferenceIds: input.sourceReferenceIds
      ? list(input.sourceReferenceIds)
      : brief.sourceReferenceIds,
    sourceEvidenceIds: input.sourceEvidenceIds
      ? list(input.sourceEvidenceIds)
      : brief.sourceEvidenceIds,
    approvedBrandDirection: null,
    approval: { status: "pending" as const, actorId: null, approvedAt: null },
    unresolvedItems: [
      ...brief.unresolvedItems,
      input.reason ?? "Material source evidence changed; merchant review is required.",
    ],
  };
  return storefrontDesignBriefContractSchema.parse({
    ...candidate,
    fingerprint: fingerprintBrief(candidate),
  });
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
    currentEvidenceFingerprint !== undefined &&
    currentEvidenceFingerprint !== brief.fingerprint
  ) {
    throw new SourceDiscoveryApplicationError(
      "stale-brief-approval",
      "The approved brief is stale because its source evidence changed.",
    );
  }
  return brief;
}
