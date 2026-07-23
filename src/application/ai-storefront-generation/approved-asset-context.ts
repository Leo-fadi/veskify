import { z } from "zod";
import {
  approvedAssetProjection,
  assetReviewHasMaterialChanges,
  unresolvedRequiredAssetCandidates,
} from "@/domain/asset-review";
import { componentDefinitionV2Schema, assetRoleSchema } from "@/domain/component-platform";
import { currentUrlBrief, urlBriefWorkflowMaterialEvidence } from "@/domain/onboarding";
import { createStorefrontDesignBriefEvidenceFingerprint } from "@/application/source-discovery";
import type { StorefrontDesignBriefContract } from "@/domain/source-discovery";
import { idSchema, localizedTextSchema } from "@/domain/shared";
import { canonicalValueFingerprint } from "@/domain/storefront";

export const approvedGenerationAssetSchema = z
  .object({
    assetId: idSchema,
    role: assetRoleSchema,
    sourceReferenceId: idSchema,
    revision: z.string().trim().min(1).max(120),
    materialFingerprint: z.string().trim().min(1),
    provenance: z
      .object({
        location: z.enum([
          "html-meta",
          "open-graph",
          "link-icon",
          "image-element",
          "css-style",
          "merchant-upload",
          "other-safe-source-location",
        ]),
        observedAt: z.string().datetime(),
      })
      .strict(),
    alt: localizedTextSchema.nullable(),
    presentation: z
      .object({
        decorative: z.boolean(),
        mediaType: z.string().trim().min(1).max(100).nullable(),
        responsiveCrops: z.array(
          z
            .object({
              cropId: idSchema,
              breakpoint: z.enum(["mobile", "tablet", "desktop", "wide"]),
              aspectRatio: z
                .string()
                .trim()
                .regex(/^\d+:\d+$/),
              focalPoint: z
                .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
                .strict(),
            })
            .strict(),
        ),
      })
      .strict(),
    approval: z
      .object({
        actorId: idSchema,
        actorReference: z.string().trim().min(1).max(160).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((asset, refinement) => {
    if (!asset.presentation.decorative && asset.alt === null) {
      refinement.addIssue({
        code: "custom",
        path: ["alt"],
        message: "Non-decorative approved assets require localized alternative text.",
      });
    }
  });

export const approvedGenerationAssetContextSchema = z
  .object({
    briefId: idSchema,
    briefRevision: z.number().int().positive(),
    approvedEvidenceFingerprint: z.string().trim().min(1),
    assetReviewFingerprint: z.string().trim().min(1).nullable(),
    assets: z.array(approvedGenerationAssetSchema),
    fingerprint: z.string().trim().min(1),
  })
  .strict()
  .superRefine((context, refinement) => {
    const ids = context.assets.map((asset) => asset.assetId);
    if (new Set(ids).size !== ids.length) {
      refinement.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Approved generation assets must have unique IDs.",
      });
    }
    if (
      context.fingerprint !==
      createApprovedGenerationAssetContextFingerprint({
        briefId: context.briefId,
        briefRevision: context.briefRevision,
        approvedEvidenceFingerprint: context.approvedEvidenceFingerprint,
        assetReviewFingerprint: context.assetReviewFingerprint,
        assets: context.assets,
      })
    ) {
      refinement.addIssue({
        code: "custom",
        path: ["fingerprint"],
        message: "The approved generation asset context fingerprint is stale.",
      });
    }
  });

export const approvedAssetPlacementOperationSchema = z
  .object({
    type: z.literal("PLACE_APPROVED_SOURCE_ASSET"),
    pageId: idSchema,
    componentId: idSchema,
    componentType: z.string().trim().min(1).max(80),
    assetSlotId: z.string().trim().min(1).max(80),
    assetId: idSchema,
    role: assetRoleSchema,
    assetRevision: z.string().trim().min(1).max(120),
    materialFingerprint: z.string().trim().min(1),
    sourceReferenceId: idSchema,
    required: z.boolean().default(false),
  })
  .strict();

export type ApprovedGenerationAsset = z.infer<typeof approvedGenerationAssetSchema>;
export type ApprovedGenerationAssetContext = z.infer<typeof approvedGenerationAssetContextSchema>;
export type ApprovedAssetPlacementOperation = z.infer<typeof approvedAssetPlacementOperationSchema>;

export type ApprovedGenerationAssetErrorCode =
  | "no-approved-brief"
  | "missing-approved-asset-projection"
  | "unresolved-required-asset"
  | "unknown-asset-id"
  | "stale-asset-revision"
  | "asset-review-fingerprint-mismatch"
  | "incompatible-asset-role-slot"
  | "cross-source-asset"
  | "attempted-product-media-mutation";

export class ApprovedGenerationAssetError extends Error {
  constructor(
    readonly code: ApprovedGenerationAssetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApprovedGenerationAssetError";
  }
}

type ContextFingerprintInput = Omit<ApprovedGenerationAssetContext, "fingerprint">;

export function createApprovedGenerationAssetContextFingerprint(
  input: ContextFingerprintInput,
): string {
  const identity = { ...input } as ContextFingerprintInput & {
    fingerprint?: string;
  };
  delete identity.fingerprint;
  return `approved-generation-assets-${canonicalValueFingerprint({
    ...identity,
    assets: [...identity.assets].sort((left, right) => left.assetId.localeCompare(right.assetId)),
  })}`;
}

function invalid(code: ApprovedGenerationAssetErrorCode, message: string): never {
  throw new ApprovedGenerationAssetError(code, message);
}

function currentApprovedBrief(workflow: Parameters<typeof currentUrlBrief>[0]) {
  const brief = currentUrlBrief(workflow);
  if (workflow.status !== "approved" || brief?.status !== "approved") {
    return invalid(
      "no-approved-brief",
      "Approve the current Storefront Design Brief before using source assets in generation.",
    );
  }
  return brief;
}

function assertBriefEvidenceIsCurrent(
  workflow: Parameters<typeof currentUrlBrief>[0],
  brief: StorefrontDesignBriefContract,
) {
  const material = urlBriefWorkflowMaterialEvidence(workflow);
  if (
    !material ||
    workflow.approvedEvidenceFingerprint === null ||
    brief.approvedEvidenceFingerprint === null
  ) {
    invalid("no-approved-brief", "The approved Storefront Design Brief is no longer complete.");
  }
  const expected = createStorefrontDesignBriefEvidenceFingerprint({
    sourceReferenceIds: brief.sourceReferenceIds,
    sourceEvidenceIds: brief.sourceEvidenceIds,
    canonicalCommerceProjectionRef: brief.canonicalCommerceProjectionRef,
    materialEvidence: material,
    assetReviewFingerprint:
      brief.assetReviewFingerprint === null ? undefined : workflow.assetReview.materialFingerprint,
  });
  if (
    expected !== brief.evidenceFingerprint ||
    brief.approvedEvidenceFingerprint !== expected ||
    workflow.approvedEvidenceFingerprint !== expected
  ) {
    invalid(
      "asset-review-fingerprint-mismatch",
      "The approved source evidence changed. Review a new Storefront Design Brief before generation.",
    );
  }
}

function assetFromProjection(
  asset: ReturnType<typeof approvedAssetProjection>[number],
  workflow: Parameters<typeof currentUrlBrief>[0],
  brief: StorefrontDesignBriefContract,
): ApprovedGenerationAsset {
  const candidate = workflow.assetReview.candidates.find((item) => item.id === asset.assetId);
  const assignment = brief.approvedAssetAssignments.find((item) => item.assetId === asset.assetId);
  if (!candidate || !assignment) {
    return invalid(
      "missing-approved-asset-projection",
      "An approved source asset is missing its current review record.",
    );
  }
  if (!brief.sourceReferenceIds.includes(asset.sourceIdentity.sourceReferenceId)) {
    return invalid(
      "cross-source-asset",
      "An approved source asset belongs to a different storefront source.",
    );
  }
  if (
    assignment.role !== asset.approvedRole ||
    assignment.revision !== asset.revision ||
    assignment.fingerprint !== asset.fingerprint ||
    candidate.status !== "approved" ||
    candidate.revision.toString() !== asset.revision.split(":", 1)[0]
  ) {
    return invalid(
      "stale-asset-revision",
      "An approved source asset changed. Refresh the brief before generation.",
    );
  }
  if (!candidate.approvalDecision || !candidate.roleDecision) {
    return invalid(
      "missing-approved-asset-projection",
      "An approved source asset is missing its merchant approval record.",
    );
  }
  return approvedGenerationAssetSchema.parse({
    assetId: asset.assetId,
    role: asset.approvedRole,
    sourceReferenceId: asset.sourceIdentity.sourceReferenceId,
    revision: asset.revision,
    materialFingerprint: asset.fingerprint,
    provenance: {
      location: sanitizeExtractionLocation(asset.provenance.extractionLocation),
      observedAt: asset.provenance.observedAt,
    },
    alt: asset.componentMetadata.alt ?? null,
    presentation: {
      decorative: asset.componentMetadata.decorative,
      mediaType: candidate.mediaType,
      responsiveCrops: asset.componentMetadata.responsiveCrops.map((crop) => ({
        cropId: crop.cropId,
        breakpoint: crop.breakpoint,
        aspectRatio: crop.aspectRatio,
        focalPoint: crop.focalPoint,
      })),
    },
    approval: {
      actorId: candidate.approvalDecision.actorId,
      actorReference: candidate.approvalDecision.actorReference,
    },
  });
}

function sanitizeExtractionLocation(
  value: string,
): z.infer<typeof approvedGenerationAssetSchema>["provenance"]["location"] {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (/https?:|<[^>]+>|javascript:|\p{Cc}|.{201}/u.test(normalized))
    return "other-safe-source-location";
  if (/open[ -]?graph|\bog:/.test(normalized)) return "open-graph";
  if (/\bmeta\b/.test(normalized)) return "html-meta";
  if (/\b(icon|favicon)\b/.test(normalized)) return "link-icon";
  if (/\b(css|style)\b/.test(normalized)) return "css-style";
  if (/\b(img|image|picture)\b/.test(normalized)) return "image-element";
  if (/merchant[ -]?upload/.test(normalized)) return "merchant-upload";
  return "other-safe-source-location";
}

/**
 * Creates the only asset payload that may cross from P7-04 review into storefront generation.
 * Source URLs, raw HTML, and binary data intentionally never cross this boundary.
 */
export function createApprovedGenerationAssetContext(input: {
  workflow: Parameters<typeof currentUrlBrief>[0];
}): ApprovedGenerationAssetContext {
  const workflow = structuredClone(input.workflow);
  const brief = currentApprovedBrief(workflow);
  if (unresolvedRequiredAssetCandidates(workflow.assetReview).length > 0) {
    return invalid(
      "unresolved-required-asset",
      "Resolve every required source asset before using source assets in generation.",
    );
  }
  assertBriefEvidenceIsCurrent(workflow, brief);
  if (
    brief.assetReviewFingerprint === null
      ? assetReviewHasMaterialChanges(workflow.assetReview)
      : brief.assetReviewFingerprint !== workflow.assetReview.materialFingerprint
  ) {
    return invalid(
      "asset-review-fingerprint-mismatch",
      "Approved source assets changed. Review a new Storefront Design Brief before generation.",
    );
  }
  const approvedProjection = approvedAssetProjection(workflow.assetReview);
  if (brief.approvedAssetAssignments.length !== approvedProjection.length) {
    return invalid(
      "missing-approved-asset-projection",
      "The approved source asset projection no longer matches the approved brief.",
    );
  }
  const assets = (brief.generationPermissions.allowAssetReuse ? approvedProjection : [])
    .map((asset) => assetFromProjection(asset, workflow, brief))
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
  const fingerprintInput = {
    briefId: brief.id,
    briefRevision: brief.revision,
    approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint!,
    assetReviewFingerprint: brief.assetReviewFingerprint,
    assets,
  };
  return approvedGenerationAssetContextSchema.parse({
    ...fingerprintInput,
    fingerprint: createApprovedGenerationAssetContextFingerprint(fingerprintInput),
  });
}

/** Validates a reviewable source-asset placement intent without mutating any catalogue media. */
export function validateApprovedAssetPlacementOperations(input: {
  context: ApprovedGenerationAssetContext;
  operations: readonly ApprovedAssetPlacementOperation[];
  componentDefinitions: readonly z.infer<typeof componentDefinitionV2Schema>[];
  target: {
    affectedPageIds: readonly string[];
    pages: readonly {
      id: string;
      sections: readonly { id: string; component: string; visible: boolean }[];
    }[];
  };
}): ApprovedAssetPlacementOperation[] {
  const context = approvedGenerationAssetContextSchema.parse(input.context);
  const assets = new Map(context.assets.map((asset) => [asset.assetId, asset]));
  const definitions = new Map(
    input.componentDefinitions.map((definition) => {
      const parsed = componentDefinitionV2Schema.parse(definition);
      return [parsed.type, parsed] as const;
    }),
  );
  return input.operations
    .map((operation) => approvedAssetPlacementOperationSchema.parse(operation))
    .sort(
      (left, right) =>
        left.pageId.localeCompare(right.pageId) ||
        left.componentType.localeCompare(right.componentType) ||
        left.assetSlotId.localeCompare(right.assetSlotId) ||
        left.assetId.localeCompare(right.assetId),
    )
    .map((operation) => {
      if (!input.target.affectedPageIds.includes(operation.pageId)) {
        return invalid(
          "incompatible-asset-role-slot",
          "The approved source asset placement targets a page outside the approved generation scope.",
        );
      }
      const page = input.target.pages.find((candidate) => candidate.id === operation.pageId);
      const component = page?.sections.find((candidate) => candidate.id === operation.componentId);
      if (!component || !component.visible || component.component !== operation.componentType) {
        return invalid(
          "incompatible-asset-role-slot",
          "The approved source asset placement does not match an active storefront component.",
        );
      }
      const asset = assets.get(operation.assetId);
      if (!asset) {
        return invalid(
          "unknown-asset-id",
          "This source asset is no longer approved for storefront generation.",
        );
      }
      if (
        asset.role !== operation.role ||
        asset.revision !== operation.assetRevision ||
        asset.materialFingerprint !== operation.materialFingerprint ||
        asset.sourceReferenceId !== operation.sourceReferenceId
      ) {
        return invalid(
          "stale-asset-revision",
          "The proposed source asset role no longer matches its approved revision.",
        );
      }
      if (operation.role === "productMainImage" || operation.role === "productAlternativeImage") {
        return invalid(
          "attempted-product-media-mutation",
          "Source-asset generation cannot replace canonical product or variant media.",
        );
      }
      const definition = definitions.get(operation.componentType);
      const slot = definition?.assetSlots.find(
        (candidate) => candidate.id === operation.assetSlotId,
      );
      if (!slot || !slot.acceptedRoles.includes(operation.role)) {
        return invalid(
          "incompatible-asset-role-slot",
          "The approved source asset is not compatible with this storefront component slot.",
        );
      }
      return operation;
    });
}
