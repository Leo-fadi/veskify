import { z } from "zod";
import {
  brandDirectionSchema,
  businessIdentitySchema,
  languagePlanSchema,
  storefrontStructureSchema,
} from "@/domain/design-brief";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import { idSchema, isoDateTimeSchema, localeSchema, safeExternalUrlSchema } from "@/domain/shared";

export const sourceTypeSchema = z.enum([
  "public-storefront",
  "merchant-provided-url",
  "deterministic-fixture",
  "merchant-upload",
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const sourceStatusSchema = z.enum([
  "pending",
  "discovering",
  "complete",
  "partial",
  "blocked",
  "failed",
]);
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

export const sourceWarningCodeSchema = z.enum([
  "limited-pages",
  "limited-assets",
  "missing-locale",
  "uncertain-evidence",
  "unavailable-page",
  "unreusable-asset",
  "commerce-evidence-non-authoritative",
]);

export const sourceWarningSchema = z
  .object({
    code: sourceWarningCodeSchema,
    message: z.string().trim().min(1).max(500),
  })
  .strict();
export type SourceWarning = z.infer<typeof sourceWarningSchema>;

export const discoveryPolicySchema = z
  .object({
    mode: z.enum(["deterministic", "bounded-public"]),
    maxPages: z.number().int().positive().max(100),
    maxAssets: z.number().int().nonnegative().max(500),
    followSameOriginOnly: z.boolean(),
  })
  .strict();
export type DiscoveryPolicy = z.infer<typeof discoveryPolicySchema>;

export const sourceFailureCodeSchema = z.enum([
  "invalid-url",
  "unsupported-protocol",
  "blocked-source",
  "unavailable-source",
  "timeout",
  "no-reusable-evidence",
  "conflicting-evidence",
  "missing-canonical-vesko-projection",
  "stale-brief-approval",
]);
export type SourceFailureCode = z.infer<typeof sourceFailureCodeSchema>;

export const sourceFailureSchema = z
  .object({
    code: sourceFailureCodeSchema,
    message: z.string().trim().min(1).max(500),
    retryable: z.boolean(),
  })
  .strict();
export type SourceFailure = z.infer<typeof sourceFailureSchema>;

export const sourceReferenceSchema = z
  .object({
    id: idSchema,
    sourceType: sourceTypeSchema,
    url: safeExternalUrlSchema,
    normalizedOrigin: z.string().url(),
    requestedLocale: localeSchema,
    discoveredAt: isoDateTimeSchema,
    allowedDiscoveryPolicy: discoveryPolicySchema,
    status: sourceStatusSchema,
    warnings: z.array(sourceWarningSchema),
    failure: sourceFailureSchema.nullable(),
  })
  .strict()
  .superRefine((source, context) => {
    let expectedOrigin: string;
    try {
      expectedOrigin = new URL(source.url).origin;
    } catch {
      context.addIssue({ code: "custom", path: ["url"], message: "The source URL is invalid." });
      return;
    }
    if (source.normalizedOrigin !== expectedOrigin) {
      context.addIssue({
        code: "custom",
        path: ["normalizedOrigin"],
        message: "The normalized origin must match the source URL.",
      });
    }
    if ((source.status === "blocked" || source.status === "failed") && source.failure === null) {
      context.addIssue({
        code: "custom",
        path: ["failure"],
        message: "Blocked and failed sources require failure information.",
      });
    }
    if (source.status !== "blocked" && source.status !== "failed" && source.failure !== null) {
      context.addIssue({
        code: "custom",
        path: ["failure"],
        message: "Failure information is only valid for blocked or failed sources.",
      });
    }
  });
export type SourceReference = z.infer<typeof sourceReferenceSchema>;

export const evidenceKindSchema = z.enum([
  "page-identity",
  "page-type",
  "logo-candidate",
  "colour-signal",
  "typography-signal",
  "spacing-layout-signal",
  "imagery-style",
  "navigation-label",
  "footer-contact",
  "merchant-brand-fact",
  "reusable-asset",
  "page-structure",
  "marketing-copy-candidate",
  "product-reference-observed",
  "collection-reference-observed",
]);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const evidenceProvenanceSchema = z
  .object({
    sourceReferenceId: idSchema,
    sourceUrl: safeExternalUrlSchema,
    observedAt: isoDateTimeSchema,
  })
  .strict();
export type EvidenceProvenance = z.infer<typeof evidenceProvenanceSchema>;

export const evidenceUncertaintySchema = z
  .object({
    isUncertain: z.boolean(),
    reason: z.string().trim().min(1).max(500).nullable(),
  })
  .strict()
  .superRefine((uncertainty, context) => {
    if (uncertainty.isUncertain && uncertainty.reason === null) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Uncertain evidence requires a reason.",
      });
    }
    if (!uncertainty.isUncertain && uncertainty.reason !== null) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Certain evidence cannot carry an uncertainty reason.",
      });
    }
  });
export type EvidenceUncertainty = z.infer<typeof evidenceUncertaintySchema>;

export const sourceEvidenceSchema = z
  .object({
    id: idSchema,
    kind: evidenceKindSchema,
    provenance: evidenceProvenanceSchema,
    sourceUrl: safeExternalUrlSchema,
    confidence: z.number().min(0).max(1),
    observedValue: z.unknown(),
    extractionMethod: z.string().trim().min(1).max(120),
    locale: localeSchema.nullable(),
    warnings: z.array(sourceWarningSchema),
    uncertainty: evidenceUncertaintySchema,
  })
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.sourceUrl !== evidence.provenance.sourceUrl) {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Evidence source URL must match its provenance.",
      });
    }
  });
export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;

export const evidenceSchemasByKind = Object.fromEntries(
  evidenceKindSchema.options.map((kind) => [
    kind,
    sourceEvidenceSchema.refine((evidence) => evidence.kind === kind, {
      message: `Evidence kind must be ${kind}.`,
      path: ["kind"],
    }),
  ]),
) as Record<EvidenceKind, typeof sourceEvidenceSchema>;

export const assetRoleSchema = z.enum([
  "logo",
  "hero",
  "collection",
  "product",
  "editorial",
  "supporting",
]);
export type AssetRole = z.infer<typeof assetRoleSchema>;

export const assetSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("source-url"), url: safeExternalUrlSchema }).strict(),
  z.object({ kind: z.literal("merchant-upload"), assetId: idSchema }).strict(),
]);
export type AssetSource = z.infer<typeof assetSourceSchema>;

export const assetFingerprintSchema = z
  .object({ algorithm: z.enum(["sha256", "perceptual-hash"]), value: z.string().trim().min(1) })
  .strict();

export const assetCandidateSchema = z
  .object({
    id: idSchema,
    role: assetRoleSchema,
    source: assetSourceSchema,
    dimensions: z
      .object({ width: z.number().int().positive(), height: z.number().int().positive() })
      .strict()
      .nullable(),
    mediaType: z.string().trim().min(1).max(100).nullable(),
    provenance: evidenceProvenanceSchema,
    confidence: z.number().min(0).max(1),
    proposedReusePurpose: z.string().trim().min(1).max(500),
    licensingUsageConfirmation: z.enum(["unknown", "pending", "confirmed", "rejected"]),
    fingerprint: assetFingerprintSchema.nullable(),
    duplicateOfAssetId: idSchema.nullable(),
  })
  .strict()
  .superRefine((asset, context) => {
    if (asset.duplicateOfAssetId === asset.id) {
      context.addIssue({
        code: "custom",
        path: ["duplicateOfAssetId"],
        message: "An asset cannot be a duplicate of itself.",
      });
    }
    if (
      asset.provenance.sourceUrl !==
      (asset.source.kind === "source-url" ? asset.source.url : asset.provenance.sourceUrl)
    ) {
      context.addIssue({
        code: "custom",
        path: ["provenance", "sourceUrl"],
        message: "Source asset provenance must match its source URL.",
      });
    }
  });
export type AssetCandidate = z.infer<typeof assetCandidateSchema>;

export const sourceDiscoveryResultSchema = z
  .object({
    source: sourceReferenceSchema,
    evidence: z.array(sourceEvidenceSchema),
    assetCandidates: z.array(assetCandidateSchema),
    warnings: z.array(sourceWarningSchema),
  })
  .strict();
export type SourceDiscoveryResult = z.infer<typeof sourceDiscoveryResultSchema>;

export const reconciliationDecisionKindSchema = z.enum([
  "accepted-evidence",
  "rejected-evidence",
  "canonical-override",
  "unresolved-conflict",
  "missing-information",
  "merchant-decision-required",
]);
export type ReconciliationDecisionKind = z.infer<typeof reconciliationDecisionKindSchema>;

export const reconciliationCommerceFieldSchema = z.enum([
  "product-identity",
  "sku",
  "price",
  "compare-at-price",
  "availability",
  "inventory",
  "variants",
  "order-options",
  "collection-identity",
  "collection-membership",
]);
export type ReconciliationCommerceField = z.infer<typeof reconciliationCommerceFieldSchema>;

export const reconciliationDecisionSchema = z
  .object({
    id: idSchema,
    kind: reconciliationDecisionKindSchema,
    evidenceId: idSchema.nullable(),
    canonicalProductId: idSchema.nullable(),
    canonicalCollectionId: idSchema.nullable(),
    candidateCanonicalIds: z.array(idSchema),
    field: reconciliationCommerceFieldSchema.nullable(),
    sourceValue: z.unknown(),
    canonicalValue: z.unknown(),
    reason: z.string().trim().min(1).max(500),
    merchantDecisionRequired: z.boolean(),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.canonicalProductId !== null && decision.canonicalCollectionId !== null) {
      context.addIssue({
        code: "custom",
        path: ["canonicalCollectionId"],
        message: "A reconciliation decision cannot target both a product and a collection.",
      });
    }
  });
export type ReconciliationDecision = z.infer<typeof reconciliationDecisionSchema>;

export const reconciliationResultSchema = z
  .object({
    sourceReferenceId: idSchema,
    canonicalCommerceProjectionRef: idSchema,
    decisions: z.array(reconciliationDecisionSchema),
    unresolvedConflictIds: z.array(idSchema),
    missingInformationIds: z.array(idSchema),
  })
  .strict()
  .superRefine((result, context) => {
    const decisionIds = new Set(result.decisions.map((decision) => decision.id));
    for (const [field, identifiers] of [
      ["unresolvedConflictIds", result.unresolvedConflictIds],
      ["missingInformationIds", result.missingInformationIds],
    ] as const) {
      if (new Set(identifiers).size !== identifiers.length) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Reconciliation summary identifiers must be unique.",
        });
      }
      identifiers.forEach((identifier, index) => {
        if (!decisionIds.has(identifier)) {
          context.addIssue({
            code: "custom",
            path: [field, index],
            message: "Reconciliation summary identifiers must reference a decision.",
          });
        }
      });
    }
  });
export type ReconciliationResult = z.infer<typeof reconciliationResultSchema>;

export const storefrontSourceEvidenceMaterialSchema = z
  .object({
    sourceReferences: z.array(sourceReferenceSchema),
    evidence: z.array(sourceEvidenceSchema),
    assetCandidates: z.array(assetCandidateSchema),
    reconciliation: reconciliationResultSchema.nullable(),
  })
  .strict()
  .superRefine((material, context) => {
    for (const [field, identifiers] of [
      ["sourceReferences", material.sourceReferences.map((source) => source.id)],
      ["evidence", material.evidence.map((evidence) => evidence.id)],
      ["assetCandidates", material.assetCandidates.map((asset) => asset.id)],
    ] as const) {
      if (new Set(identifiers).size !== identifiers.length) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Material evidence identifiers must be unique.",
        });
      }
    }
    const sourceIds = new Set(material.sourceReferences.map((source) => source.id));
    material.evidence.forEach((evidence, index) => {
      if (!sourceIds.has(evidence.provenance.sourceReferenceId)) {
        context.addIssue({
          code: "custom",
          path: ["evidence", index, "provenance", "sourceReferenceId"],
          message: "Material evidence provenance must reference a supplied source.",
        });
      }
    });
    if (
      material.reconciliation !== null &&
      !sourceIds.has(material.reconciliation.sourceReferenceId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reconciliation", "sourceReferenceId"],
        message: "Reconciliation must reference a supplied source.",
      });
    }
  });
export type StorefrontSourceEvidenceMaterial = z.infer<
  typeof storefrontSourceEvidenceMaterialSchema
>;

function sortedById<Value extends { id: string }>(values: readonly Value[]): Value[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function sortedWarnings(warnings: readonly SourceWarning[]): SourceWarning[] {
  return [...warnings].sort((left, right) =>
    `${left.code}:${left.message}`.localeCompare(`${right.code}:${right.message}`),
  );
}

/** Fingerprints only material discovery, asset and reconciliation state. */
export function createStorefrontSourceEvidenceFingerprint(input: unknown): string {
  const material = storefrontSourceEvidenceMaterialSchema.parse(input);
  return canonicalValueFingerprint({
    sourceReferences: sortedById(material.sourceReferences).map((source) => ({
      id: source.id,
      sourceType: source.sourceType,
      url: source.url,
      normalizedOrigin: source.normalizedOrigin,
      requestedLocale: source.requestedLocale,
      allowedDiscoveryPolicy: source.allowedDiscoveryPolicy,
      status: source.status,
      warnings: sortedWarnings(source.warnings),
      failure: source.failure,
    })),
    evidence: sortedById(material.evidence).map((evidence) => ({
      id: evidence.id,
      kind: evidence.kind,
      provenance: {
        sourceReferenceId: evidence.provenance.sourceReferenceId,
        sourceUrl: evidence.provenance.sourceUrl,
      },
      sourceUrl: evidence.sourceUrl,
      confidence: evidence.confidence,
      observedValue: evidence.observedValue,
      extractionMethod: evidence.extractionMethod,
      locale: evidence.locale,
      warnings: sortedWarnings(evidence.warnings),
      uncertainty: evidence.uncertainty,
    })),
    assetCandidates: sortedById(material.assetCandidates).map((asset) => ({
      id: asset.id,
      role: asset.role,
      source: asset.source,
      dimensions: asset.dimensions,
      mediaType: asset.mediaType,
      provenance: {
        sourceReferenceId: asset.provenance.sourceReferenceId,
        sourceUrl: asset.provenance.sourceUrl,
      },
      confidence: asset.confidence,
      proposedReusePurpose: asset.proposedReusePurpose,
      licensingUsageConfirmation: asset.licensingUsageConfirmation,
      fingerprint: asset.fingerprint,
      duplicateOfAssetId: asset.duplicateOfAssetId,
    })),
    reconciliation: material.reconciliation
      ? {
          sourceReferenceId: material.reconciliation.sourceReferenceId,
          canonicalCommerceProjectionRef: material.reconciliation.canonicalCommerceProjectionRef,
          decisions: sortedById(material.reconciliation.decisions),
          unresolvedConflictIds: [...material.reconciliation.unresolvedConflictIds].sort(),
          missingInformationIds: [...material.reconciliation.missingInformationIds].sort(),
        }
      : null,
  });
}

export const brandReconstructionProposalSchema = z
  .object({
    id: idSchema,
    status: z.literal("needsReview"),
    palette: z
      .object({
        primary: z.string().trim().min(1).nullable(),
        secondary: z.string().trim().min(1).nullable(),
        accent: z.string().trim().min(1).nullable(),
        background: z.string().trim().min(1).nullable(),
        text: z.string().trim().min(1).nullable(),
      })
      .strict(),
    typographyDirection: z.string().trim().min(1).nullable(),
    spacingDensity: z.enum(["airy", "balanced", "compact"]).nullable(),
    shapeDirection: z.string().trim().min(1).nullable(),
    imageryDirection: z.string().trim().min(1).nullable(),
    toneOfVoice: z.array(z.string().trim().min(1).max(120)),
    reusedAssetIds: z.array(idSchema),
    assumptions: z.array(z.string().trim().min(1).max(500)),
    confidence: z.number().min(0).max(1),
    warnings: z.array(sourceWarningSchema),
    evidenceReferenceIds: z.array(idSchema),
    merchantApproved: z.literal(false),
  })
  .strict();
export type BrandReconstructionProposal = z.infer<typeof brandReconstructionProposalSchema>;

export const briefApprovalSchema = z
  .object({
    status: z.enum(["pending", "approved"]),
    actorId: idSchema.nullable(),
    approvedAt: isoDateTimeSchema.nullable(),
  })
  .strict()
  .superRefine((approval, context) => {
    if (
      approval.status === "approved" &&
      (approval.actorId === null || approval.approvedAt === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "An approved brief requires an approval actor and timestamp.",
      });
    }
    if (
      approval.status === "pending" &&
      (approval.actorId !== null || approval.approvedAt !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "A pending brief cannot contain approval metadata.",
      });
    }
  });

export const storefrontDesignBriefContractStatusSchema = z.enum([
  "collecting",
  "needsReview",
  "approved",
  "superseded",
  "rejected",
]);
export type StorefrontDesignBriefContractStatus = z.infer<
  typeof storefrontDesignBriefContractStatusSchema
>;

export const storefrontDesignBriefContractSchema = z
  .object({
    id: idSchema,
    revision: z.number().int().positive(),
    status: storefrontDesignBriefContractStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    businessIdentity: businessIdentitySchema,
    languagePlan: languagePlanSchema,
    sourceReferenceIds: z.array(idSchema),
    sourceEvidenceIds: z.array(idSchema),
    canonicalCommerceProjectionRef: idSchema.nullable(),
    approvedBrandDirection: brandDirectionSchema.nullable(),
    brandProposal: brandReconstructionProposalSchema.nullable(),
    approvedReusableAssetIds: z.array(idSchema),
    pagePlan: storefrontStructureSchema,
    navigationDirection: z.array(z.string().trim().min(1).max(200)),
    homepageGoals: z.array(z.string().trim().min(1).max(500)),
    collectionPageGoals: z.array(z.string().trim().min(1).max(500)),
    productPageGoals: z.array(z.string().trim().min(1).max(500)),
    visualPriorities: z.array(z.string().trim().min(1).max(500)),
    contentAssumptions: z.array(z.string().trim().min(1).max(500)),
    unresolvedItems: z.array(z.string().trim().min(1).max(500)),
    materialUnresolvedBlockers: z.array(z.string().trim().min(1).max(500)),
    excludedClaims: z.array(z.string().trim().min(1).max(500)),
    generationPermissions: z
      .object({
        allowMarketingCopy: z.boolean(),
        allowAssetReuse: z.boolean(),
        allowGeneratedImagery: z.boolean(),
      })
      .strict(),
    approval: briefApprovalSchema,
    evidenceFingerprint: z.string().trim().min(1),
    approvedEvidenceFingerprint: z.string().trim().min(1).nullable(),
    supersedesRevision: z.number().int().positive().nullable(),
    supersededByRevision: z.number().int().positive().nullable(),
    supersessionReason: z.string().trim().min(1).max(500).nullable(),
    fingerprint: z.string().trim().min(1),
  })
  .strict()
  .superRefine((brief, context) => {
    if (Date.parse(brief.updatedAt) < Date.parse(brief.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "Updated time precedes creation time.",
      });
    }
    if (brief.status === "approved" && brief.approval.status !== "approved") {
      context.addIssue({
        code: "custom",
        path: ["approval"],
        message: "Approved briefs require approved metadata.",
      });
    }
    if (brief.status === "superseded" && brief.approval.status !== "approved") {
      context.addIssue({
        code: "custom",
        path: ["approval"],
        message: "A superseded revision must retain its approval history.",
      });
    }
    if (
      brief.status !== "approved" &&
      brief.status !== "superseded" &&
      brief.approval.status === "approved"
    ) {
      context.addIssue({
        code: "custom",
        path: ["approval"],
        message: "Only approved briefs may contain approval metadata.",
      });
    }
    if (brief.status === "approved" && brief.canonicalCommerceProjectionRef === null) {
      context.addIssue({
        code: "custom",
        path: ["canonicalCommerceProjectionRef"],
        message: "An approved brief requires canonical Vesko commerce.",
      });
    }
    if (
      (brief.status === "approved" || brief.status === "superseded") &&
      brief.approvedEvidenceFingerprint === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["approvedEvidenceFingerprint"],
        message: "Approved and superseded revisions require their approved evidence fingerprint.",
      });
    }
    if (
      (brief.status === "approved" || brief.status === "superseded") &&
      brief.approvedEvidenceFingerprint !== null &&
      brief.approvedEvidenceFingerprint !== brief.evidenceFingerprint
    ) {
      context.addIssue({
        code: "custom",
        path: ["approvedEvidenceFingerprint"],
        message: "The approved evidence fingerprint must match the approved material evidence.",
      });
    }
    if (
      brief.status !== "approved" &&
      brief.status !== "superseded" &&
      brief.approvedEvidenceFingerprint !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["approvedEvidenceFingerprint"],
        message: "Unapproved revisions cannot retain an approved evidence fingerprint.",
      });
    }
    if (brief.status === "superseded" && brief.supersededByRevision === null) {
      context.addIssue({
        code: "custom",
        path: ["supersededByRevision"],
        message: "A superseded revision must identify its replacement revision.",
      });
    }
    if (
      (brief.supersedesRevision !== null || brief.supersededByRevision !== null) &&
      brief.supersessionReason === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["supersessionReason"],
        message: "Related brief revisions require a supersession reason.",
      });
    }
    if (brief.status !== "superseded" && brief.supersededByRevision !== null) {
      context.addIssue({
        code: "custom",
        path: ["supersededByRevision"],
        message: "Only a superseded revision may identify a replacement revision.",
      });
    }
    if (brief.supersedesRevision !== null && brief.supersedesRevision >= brief.revision) {
      context.addIssue({
        code: "custom",
        path: ["supersedesRevision"],
        message: "A replacement must supersede an earlier revision.",
      });
    }
  });

export type StorefrontDesignBriefContract = z.infer<typeof storefrontDesignBriefContractSchema>;
export type CanonicalCommerceProjection = CatalogueDisplayModel;
export const canonicalCommerceProjectionSchema = catalogueDisplayModelSchema;

export const sourceEvidenceBundleSchema = z
  .object({
    source: sourceReferenceSchema,
    evidence: z.array(sourceEvidenceSchema),
    assetCandidates: z.array(assetCandidateSchema),
  })
  .strict();

export function normalizeSourceUrl(url: string): { url: string; normalizedOrigin: string } {
  const parsed = safeExternalUrlSchema.parse(url);
  const normalized = new URL(parsed);
  normalized.hash = "";
  return { url: normalized.toString(), normalizedOrigin: normalized.origin };
}

export function sourceContractFingerprint(value: unknown): string {
  return canonicalValueFingerprint(value);
}
