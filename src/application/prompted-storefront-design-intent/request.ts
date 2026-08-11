import { z } from "zod";
import {
  approvedGenerationAssetContextSchema,
  type ApprovedGenerationAssetContext,
} from "@/application/ai-storefront-generation/approved-asset-context";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { brandSystemDesignDnaFingerprint } from "@/domain/design-system";
import { projectSchema, type Project } from "@/domain/project";
import {
  storefrontDesignBriefContractSchema,
  type StorefrontDesignBriefContract,
} from "@/domain/source-discovery";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  storefrontSnapshotSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
  PromptedStorefrontDesignIntentError,
  promptedStorefrontDesignRequestFingerprint,
  promptedStorefrontDesignRequestV2MaterialSchema,
  promptedStorefrontDesignRequestV2Schema,
  promptedStorefrontPromptFingerprint,
  promptedStorefrontCapabilityReferenceAuthorityFingerprint,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCurrentAuthorityIdentity,
  type PromptedStorefrontDesignRequestV2,
} from "./contract";
import {
  createPromptedStorefrontCapabilityAuthority,
  createPromptedStorefrontCatalogueCharacteristics,
  promptedStorefrontCatalogueProjectionFingerprint,
  promptedStorefrontPageBlueprintAuthorityFingerprint,
} from "./capability-projection";

const priorDiversityEvidenceInputSchema = z
  .object({
    recentAcceptedStructuralFingerprints: z.array(z.string().min(1).max(240)).max(20).default([]),
    recentRejectedStructuralFingerprints: z.array(z.string().min(1).max(240)).max(20).default([]),
    recentlyUsedPostureKeys: z.array(z.string().min(3).max(200)).max(40).default([]),
    merchantAvoidancePreferenceKeys: z.array(z.string().min(3).max(200)).max(40).default([]),
  })
  .strict();

export type PromptedStorefrontPriorDiversityEvidenceInput = z.input<
  typeof priorDiversityEvidenceInputSchema
>;

export type CreatePromptedStorefrontDesignRequestV2Input = Readonly<{
  merchantPrompt: string;
  project: Project;
  draft: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  approvedBrief: StorefrontDesignBriefContract;
  approvedAssetContext: ApprovedGenerationAssetContext | null;
  priorDiversityEvidence?: PromptedStorefrontPriorDiversityEvidenceInput;
}>;

export type PromptedStorefrontDesignRequestAuthority = Readonly<{
  request: PromptedStorefrontDesignRequestV2;
  capabilityAuthority: PromptedStorefrontCapabilityAuthority;
}>;

function compareCanonical(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareCanonical);
}

export function promptedStorefrontCanonicalCommerceAuthorityFingerprint(
  catalogue: CatalogueDisplayModel,
): string {
  return `canonical-commerce-${canonicalValueFingerprint({
    ...catalogue,
    products: [...catalogue.products].sort((left, right) => compareCanonical(left.id, right.id)),
    collections: [...catalogue.collections].sort((left, right) =>
      compareCanonical(left.id, right.id),
    ),
  })}`;
}

function requiredApprovedBrief(input: unknown): StorefrontDesignBriefContract {
  const brief = storefrontDesignBriefContractSchema.safeParse(input);
  if (
    !brief.success ||
    brief.data.status !== "approved" ||
    brief.data.approval.status !== "approved" ||
    brief.data.approvedEvidenceFingerprint === null ||
    brief.data.approvedEvidenceFingerprint !== brief.data.evidenceFingerprint
  ) {
    throw new PromptedStorefrontDesignIntentError("invalid-request");
  }
  return brief.data;
}

function parsedInput(input: CreatePromptedStorefrontDesignRequestV2Input) {
  const project = projectSchema.safeParse(input.project);
  const draft = storefrontSnapshotSchema.safeParse(input.draft);
  const catalogue = catalogueDisplayModelSchema.safeParse(input.catalogue);
  const brief = requiredApprovedBrief(input.approvedBrief);
  const assets =
    input.approvedAssetContext === null
      ? null
      : approvedGenerationAssetContextSchema.safeParse(input.approvedAssetContext);
  if (!project.success || !draft.success || !catalogue.success || assets?.success === false) {
    throw new PromptedStorefrontDesignIntentError("invalid-request");
  }
  const approvedAssetContext = assets?.success ? assets.data : null;
  const approvedAssignmentsById = new Map(
    brief.approvedAssetAssignments.map((assignment) => [assignment.assetId, assignment]),
  );
  const assetContextMatchesBrief =
    approvedAssetContext === null ||
    (approvedAssetContext.assetReviewFingerprint === brief.assetReviewFingerprint &&
      (brief.generationPermissions.allowAssetReuse
        ? approvedAssetContext.assets.length === brief.approvedAssetAssignments.length &&
          approvedAssetContext.assets.every((asset) => {
            const assignment = approvedAssignmentsById.get(asset.assetId);
            return (
              assignment?.role === asset.role &&
              assignment.revision === asset.revision &&
              assignment.fingerprint === asset.materialFingerprint
            );
          })
        : approvedAssetContext.assets.length === 0));
  if (
    draft.data.projectId !== project.data.id ||
    draft.data.id !== project.data.draftSnapshotId ||
    draft.data.catalogueRef !== catalogue.data.id ||
    brief.canonicalCommerceProjectionRef !== catalogue.data.id ||
    (brief.approvedAssetAssignments.length > 0 && approvedAssetContext === null) ||
    (approvedAssetContext !== null &&
      (approvedAssetContext.briefId !== brief.id ||
        approvedAssetContext.briefRevision !== brief.revision ||
        approvedAssetContext.approvedEvidenceFingerprint !== brief.approvedEvidenceFingerprint ||
        !assetContextMatchesBrief))
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  return {
    project: project.data,
    draft: draft.data,
    catalogue: catalogue.data,
    brief,
    approvedAssetContext,
  };
}

function safeMerchantContext(project: Project, brief: StorefrontDesignBriefContract) {
  const direction = brief.approvedBrandDirection;
  const priorities = [
    ...brief.visualPriorities,
    ...(direction?.typographyDirection ? [`Typography: ${direction.typographyDirection}`] : []),
    ...(direction?.visualStyleDirection ? [`Visual style: ${direction.visualStyleDirection}`] : []),
    ...(direction?.imageryDirection ? [`Imagery: ${direction.imageryDirection}`] : []),
    ...(direction?.toneKeywords.map((keyword) => `Tone: ${keyword}`) ?? []),
  ];
  return {
    businessName: brief.businessIdentity.businessName || project.businessProfile.name,
    industry: brief.businessIdentity.industry ?? project.industry,
    approvedBrandSummary:
      brief.businessIdentity.shortDescription || project.businessProfile.description,
    targetCustomer: brief.businessIdentity.targetCustomer || project.businessProfile.audience,
    primaryMarket: brief.businessIdentity.primaryMarket || project.businessProfile.market,
    approvedToneOrVisualPriorities: sortedUnique(priorities),
    supportedLocales: sortedUnique(
      brief.languagePlan.selectedLanguages.length > 0
        ? brief.languagePlan.selectedLanguages
        : project.enabledLocales,
    ),
    excludedClaimsOrUnsupportedRequirements: sortedUnique([
      ...brief.excludedClaims,
      ...brief.materialUnresolvedBlockers,
    ]),
  };
}

function safeEvidenceAndAssets(
  draft: StorefrontSnapshot,
  brief: StorefrontDesignBriefContract,
  approvedAssetContext: ApprovedGenerationAssetContext | null,
  capabilityAuthority: PromptedStorefrontCapabilityAuthority,
) {
  const approvedEvidenceFamilies = sortedUnique([
    ...(brief.sourceEvidenceIds.length > 0 ? ["approved.source-evidence"] : []),
    ...(brief.approvedBrandDirection ? ["approved.brand-direction"] : []),
    ...(brief.canonicalCommerceProjectionRef ? ["approved.canonical-commerce"] : []),
    ...(draft.contentSupportFactDocuments.length > 0 ? ["approved.content-support-facts"] : []),
  ]);
  const roles = sortedUnique(approvedAssetContext?.assets.map(({ role }) => role) ?? []);
  return {
    approvedEvidenceFamilies,
    approvedPresentationAssetRoles: roles,
    editorialOrBrandImageryAvailable: roles.some((role) =>
      ["logo", "heroDesktop", "heroMobile", "editorialImage", "supportingContentImage"].includes(
        role,
      ),
    ),
    responsiveAssetTreatmentAvailable:
      approvedAssetContext?.assets.some(
        ({ presentation }) => presentation.responsiveCrops.length > 0,
      ) ?? false,
    evidenceDependentCapabilityKeys: capabilityAuthority.projection.capabilities
      .filter(({ availability }) => availability === "evidence-dependent")
      .map(({ key }) => key),
    unresolvedSafeOmissions: sortedUnique(brief.unresolvedItems),
  };
}

function normalizedPriorDiversity(
  input: PromptedStorefrontPriorDiversityEvidenceInput | undefined,
  capabilityAuthority: PromptedStorefrontCapabilityAuthority,
) {
  const parsed = priorDiversityEvidenceInputSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new PromptedStorefrontDesignIntentError("invalid-request");
  }
  const recentAcceptedStructuralFingerprints = sortedUnique(
    parsed.data.recentAcceptedStructuralFingerprints,
  );
  const recentRejectedStructuralFingerprints = sortedUnique(
    parsed.data.recentRejectedStructuralFingerprints,
  );
  const recentlyUsedPostureKeys = sortedUnique(parsed.data.recentlyUsedPostureKeys);
  const merchantAvoidancePreferenceKeys = sortedUnique(parsed.data.merchantAvoidancePreferenceKeys);
  for (const key of [...recentlyUsedPostureKeys, ...merchantAvoidancePreferenceKeys]) {
    if (!capabilityAuthority.referencesByPreferenceKey.has(key)) {
      throw new PromptedStorefrontDesignIntentError("unknown-capability");
    }
  }
  return {
    recentAcceptedStructuralFingerprints,
    recentRejectedStructuralFingerprints,
    recentlyUsedPostureKeys,
    merchantAvoidancePreferenceKeys,
  };
}

export function createPromptedStorefrontCurrentAuthorityIdentity(input: {
  project: Project;
  draft: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  approvedBrief: StorefrontDesignBriefContract;
  approvedAssetContext: ApprovedGenerationAssetContext | null;
  capabilityAuthority?: PromptedStorefrontCapabilityAuthority;
}): PromptedStorefrontCurrentAuthorityIdentity {
  const parsed = parsedInput({
    merchantPrompt: "Current authority identity",
    ...input,
    priorDiversityEvidence: undefined,
  });
  const capabilityAuthority =
    input.capabilityAuthority ??
    createPromptedStorefrontCapabilityAuthority({
      draft: parsed.draft,
      catalogue: parsed.catalogue,
      approvedBrief: parsed.brief,
      approvedAssetContext: parsed.approvedAssetContext,
    });
  const dynamicFingerprint = parsed.draft.dynamicCommercePresentation?.authorityFingerprint;
  if (!dynamicFingerprint) throw new PromptedStorefrontDesignIntentError("stale-authority");
  return {
    projectId: parsed.project.id,
    projectRevision: parsed.project.revision,
    draftSnapshotId: parsed.draft.id,
    draftRevision: parsed.draft.revision,
    storefrontSnapshotFingerprint: canonicalStorefrontContentFingerprint(parsed.draft),
    dynamicCommercePresentationFingerprint: dynamicFingerprint,
    capabilityManifestFingerprint: veskifyComponentCapabilityManifest.manifest.fingerprint,
    pageBlueprintAuthorityFingerprint: promptedStorefrontPageBlueprintAuthorityFingerprint(),
    designDnaAuthorityFingerprint: brandSystemDesignDnaFingerprint(parsed.draft.brandSystem),
    approvedBriefFingerprint: parsed.brief.fingerprint,
    approvedBriefEvidenceFingerprint: parsed.brief.approvedEvidenceFingerprint!,
    approvedAssetAuthorityFingerprint: parsed.approvedAssetContext?.fingerprint ?? null,
    canonicalCommerceAuthorityFingerprint: promptedStorefrontCanonicalCommerceAuthorityFingerprint(
      parsed.catalogue,
    ),
    catalogueProjectionFingerprint: promptedStorefrontCatalogueProjectionFingerprint(
      parsed.catalogue,
    ),
    capabilityProjectionFingerprint: capabilityAuthority.projection.fingerprint,
    capabilityReferenceAuthorityFingerprint:
      promptedStorefrontCapabilityReferenceAuthorityFingerprint(
        capabilityAuthority.referencesByPreferenceKey.values(),
      ),
  };
}

export function createPromptedStorefrontDesignRequestV2(
  input: CreatePromptedStorefrontDesignRequestV2Input,
): PromptedStorefrontDesignRequestAuthority {
  const parsed = parsedInput(input);
  const merchantPromptResult = z
    .string()
    .min(1)
    .max(12_000)
    .refine((value) => value.trim().length > 0)
    .safeParse(input.merchantPrompt);
  if (!merchantPromptResult.success) {
    throw new PromptedStorefrontDesignIntentError("invalid-request");
  }
  const merchantPrompt = merchantPromptResult.data;
  const capabilityAuthority = createPromptedStorefrontCapabilityAuthority({
    draft: parsed.draft,
    catalogue: parsed.catalogue,
    approvedBrief: parsed.brief,
    approvedAssetContext: parsed.approvedAssetContext,
  });
  const currentAuthority = createPromptedStorefrontCurrentAuthorityIdentity({
    project: parsed.project,
    draft: parsed.draft,
    catalogue: parsed.catalogue,
    approvedBrief: parsed.brief,
    approvedAssetContext: parsed.approvedAssetContext,
    capabilityAuthority,
  });
  const promptFingerprint = promptedStorefrontPromptFingerprint(merchantPrompt);
  const approvedMerchantContext = safeMerchantContext(parsed.project, parsed.brief);
  const catalogueCharacteristics = createPromptedStorefrontCatalogueCharacteristics(
    parsed.catalogue,
  );
  const evidenceAndAssets = safeEvidenceAndAssets(
    parsed.draft,
    parsed.brief,
    parsed.approvedAssetContext,
    capabilityAuthority,
  );
  const priorDiversityEvidence = normalizedPriorDiversity(
    input.priorDiversityEvidence,
    capabilityAuthority,
  );
  const requestId = `prompted-design-request-${canonicalValueFingerprint({
    promptFingerprint,
    currentAuthority,
    approvedMerchantContext,
    catalogueCharacteristics,
    evidenceAndAssets,
    priorDiversityEvidence,
  }).slice(-48)}`;
  const material = {
    contractVersion: PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
    requestId,
    merchantPrompt,
    promptFingerprint,
    currentAuthority,
    approvedMerchantContext,
    catalogueCharacteristics,
    evidenceAndAssets,
    capabilityProjection: capabilityAuthority.projection,
    priorDiversityEvidence,
  };
  const parsedMaterial = promptedStorefrontDesignRequestV2MaterialSchema.safeParse(material);
  if (!parsedMaterial.success) {
    throw new PromptedStorefrontDesignIntentError("invalid-request");
  }
  const request = promptedStorefrontDesignRequestV2Schema.safeParse({
    ...parsedMaterial.data,
    requestFingerprint: promptedStorefrontDesignRequestFingerprint(parsedMaterial.data),
  });
  if (!request.success) {
    throw new PromptedStorefrontDesignIntentError("invalid-request");
  }
  return deepFreeze({ request: request.data, capabilityAuthority });
}
