import { z } from "zod";
import {
  assetRoleSchema as componentAssetRoleSchema,
  storefrontAssetMetadataSchema,
  type AssetRole as ComponentAssetRole,
  type StorefrontAssetMetadata,
} from "@/domain/component-platform";
import {
  assetCandidateSchema,
  evidenceProvenanceSchema,
  evidenceUncertaintySchema,
  sourceReferenceSchema,
  sourceWarningSchema,
  type AssetCandidate,
  type SourceReference,
} from "@/domain/source-discovery";
import {
  idSchema,
  isoDateTimeSchema,
  localizedTextSchema,
  safeExternalUrlSchema,
} from "@/domain/shared";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";

export const ASSET_REVIEW_SCHEMA_VERSION = 1 as const;

export const assetReviewCandidateStatusSchema = z.enum([
  "discovered",
  "needsReview",
  "approved",
  "rejected",
  "superseded",
  "unavailable",
]);

const merchantAssetDecisionSchema = z
  .object({
    actorId: idSchema,
    actorReference: z.string().trim().min(1).max(160).nullable().default(null),
    decidedAt: isoDateTimeSchema,
    note: z.string().trim().min(1).max(500).nullable().default(null),
  })
  .strict();

const assetRoleDecisionSchema = merchantAssetDecisionSchema
  .extend({
    role: componentAssetRoleSchema,
    alt: localizedTextSchema.nullable(),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.role !== "iconDecorative" && decision.alt === null) {
      context.addIssue({
        code: "custom",
        path: ["alt"],
        message: "Non-decorative approved roles require merchant-reviewed alternative text.",
      });
    }
  });

const assetSupersessionSchema = z
  .object({
    candidateId: idSchema,
    recordedAt: isoDateTimeSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

const assetUnavailableDecisionSchema = z
  .object({
    recordedAt: isoDateTimeSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const assetReviewCandidateSchema = z
  .object({
    id: idSchema,
    sourceCandidateId: idSchema.optional(),
    sourceReferenceId: idSchema,
    normalizedSourceUrl: safeExternalUrlSchema,
    finalFetchedUrl: safeExternalUrlSchema.nullable(),
    extractionLocation: z.string().trim().min(1).max(200),
    retrievedAt: isoDateTimeSchema,
    mediaType: z.string().trim().min(1).max(100).nullable(),
    discoveredRole: assetCandidateSchema.shape.role,
    suggestedRoles: z.array(componentAssetRoleSchema).min(1),
    confidence: z.number().min(0).max(1),
    uncertainty: evidenceUncertaintySchema,
    warnings: z.array(sourceWarningSchema),
    provenance: evidenceProvenanceSchema,
    originalCandidate: assetCandidateSchema,
    observations: z.array(assetCandidateSchema).min(1),
    status: assetReviewCandidateStatusSchema,
    selectedRole: componentAssetRoleSchema.nullable(),
    roleDecision: assetRoleDecisionSchema.nullable(),
    approvalDecision: merchantAssetDecisionSchema.nullable(),
    rejectionDecision: merchantAssetDecisionSchema.nullable(),
    unavailableDecision: assetUnavailableDecisionSchema.nullable(),
    supersedes: assetSupersessionSchema.nullable(),
    supersededBy: assetSupersessionSchema.nullable(),
    requiredForBrief: z.boolean(),
    materialFingerprint: z.string().trim().min(1),
    revision: z.number().int().positive(),
  })
  .strict()
  .superRefine((candidate, context) => {
    if (new Set(candidate.suggestedRoles).size !== candidate.suggestedRoles.length) {
      context.addIssue({
        code: "custom",
        path: ["suggestedRoles"],
        message: "Suggested asset roles must be unique.",
      });
    }
    const observationIds = candidate.observations.map((item) => item.id);
    if (new Set(observationIds).size !== observationIds.length) {
      context.addIssue({
        code: "custom",
        path: ["observations"],
        message: "Asset observations must preserve unique candidate identifiers.",
      });
    }
    candidate.observations.forEach((observation, index) => {
      if (observation.provenance.sourceReferenceId !== candidate.sourceReferenceId) {
        context.addIssue({
          code: "custom",
          path: ["observations", index, "provenance", "sourceReferenceId"],
          message: "Every observation must remain scoped to the reviewed source.",
        });
      }
    });
    if (
      (candidate.roleDecision === null) !== (candidate.selectedRole === null) ||
      (candidate.roleDecision !== null && candidate.roleDecision.role !== candidate.selectedRole)
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectedRole"],
        message: "A selected role must come from the recorded merchant role decision.",
      });
    }
    if (candidate.status === "approved") {
      if (candidate.roleDecision === null || candidate.approvalDecision === null) {
        context.addIssue({
          code: "custom",
          path: ["approvalDecision"],
          message: "Approved assets require explicit role and approval decisions.",
        });
      }
      if (candidate.rejectionDecision !== null || candidate.supersededBy !== null) {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message: "Rejected or superseded assets cannot remain approved.",
        });
      }
    }
    if (candidate.status === "rejected" && candidate.rejectionDecision === null) {
      context.addIssue({
        code: "custom",
        path: ["rejectionDecision"],
        message: "Rejected assets require a merchant decision.",
      });
    }
    if (candidate.status === "superseded" && candidate.supersededBy === null) {
      context.addIssue({
        code: "custom",
        path: ["supersededBy"],
        message: "Superseded assets must identify their replacement.",
      });
    }
    if (candidate.status === "unavailable" && candidate.unavailableDecision === null) {
      context.addIssue({
        code: "custom",
        path: ["unavailableDecision"],
        message: "Unavailable assets require a retained reason and timestamp.",
      });
    }
  });

export const assetReviewStateSchema = z
  .object({
    schemaVersion: z.literal(ASSET_REVIEW_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    candidates: z.array(assetReviewCandidateSchema),
    reviewFingerprint: z.string().trim().min(1),
    materialFingerprint: z.string().trim().min(1),
  })
  .strict()
  .superRefine((state, context) => {
    const candidateIds = state.candidates.map((candidate) => candidate.id);
    if (new Set(candidateIds).size !== candidateIds.length) {
      context.addIssue({
        code: "custom",
        path: ["candidates"],
        message: "Asset review candidates must have unique identifiers.",
      });
    }
    const candidates = new Map(state.candidates.map((candidate) => [candidate.id, candidate]));
    state.candidates.forEach((candidate, index) => {
      if (candidate.supersedes && !candidates.has(candidate.supersedes.candidateId)) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "supersedes", "candidateId"],
          message: "A replacement must reference retained asset-review history.",
        });
      }
      if (candidate.supersededBy && !candidates.has(candidate.supersededBy.candidateId)) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "supersededBy", "candidateId"],
          message: "A superseded asset must reference its retained replacement.",
        });
      }
    });
    if (state.reviewFingerprint !== reviewFingerprint(state.candidates)) {
      context.addIssue({
        code: "custom",
        path: ["reviewFingerprint"],
        message: "The persisted asset-review fingerprint is stale.",
      });
    }
    if (state.materialFingerprint !== materialFingerprint(state.candidates)) {
      context.addIssue({
        code: "custom",
        path: ["materialFingerprint"],
        message: "The persisted material asset fingerprint is stale.",
      });
    }
  });

export const approvedAssetProjectionItemSchema = z
  .object({
    assetId: idSchema,
    approvedRole: componentAssetRoleSchema,
    approvalState: z.literal("approved"),
    provenance: evidenceProvenanceSchema,
    sourceIdentity: z
      .object({
        sourceReferenceId: idSchema,
        sourceUrl: safeExternalUrlSchema,
        finalFetchedUrl: safeExternalUrlSchema.nullable(),
      })
      .strict(),
    revision: z.string().trim().min(1),
    fingerprint: z.string().trim().min(1),
    componentMetadata: storefrontAssetMetadataSchema,
  })
  .strict();

export type AssetReviewCandidateStatus = z.infer<typeof assetReviewCandidateStatusSchema>;
export type AssetReviewCandidate = z.infer<typeof assetReviewCandidateSchema>;
export type AssetReviewState = z.infer<typeof assetReviewStateSchema>;
export type ApprovedAssetProjectionItem = z.infer<typeof approvedAssetProjectionItemSchema>;

export const assetReviewActionSchema = z.enum([
  "confirm-role",
  "approve",
  "reject",
  "mark-not-required",
  "select-replacement",
]);
export type AssetReviewAction = z.infer<typeof assetReviewActionSchema>;
export type AssetReviewActionCandidate = AssetReviewCandidate & {
  allowedActions: readonly AssetReviewAction[];
};

export type AssetReviewErrorCode =
  | "unknown-candidate"
  | "cross-source-candidate"
  | "invalid-role"
  | "rejected-candidate"
  | "superseded-candidate"
  | "unavailable-candidate"
  | "unsafe-provenance"
  | "missing-actor"
  | "conflicting-decision"
  | "stale-review-revision";

export class AssetReviewError extends Error {
  constructor(
    readonly code: AssetReviewErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AssetReviewError";
  }
}

const roleSuggestions: Record<AssetCandidate["role"], readonly ComponentAssetRole[]> = {
  logo: ["logo"],
  hero: ["heroDesktop", "heroMobile"],
  collection: ["collectionImage"],
  product: ["productMainImage", "productAlternativeImage"],
  editorial: ["editorialImage"],
  supporting: ["supportingContentImage"],
};

function sortedCandidates(candidates: readonly AssetReviewCandidate[]): AssetReviewCandidate[] {
  return [...candidates].sort((left, right) => left.id.localeCompare(right.id));
}

function logicalCandidateId(candidate: AssetReviewCandidate): string {
  return candidate.sourceCandidateId ?? candidate.originalCandidate.id;
}

function normalizedSuggestedRoles(roles: readonly ComponentAssetRole[]): ComponentAssetRole[] {
  return [...new Set(roles)].sort(
    (left, right) =>
      componentAssetRoleSchema.options.indexOf(left) -
      componentAssetRoleSchema.options.indexOf(right),
  );
}

function replacementRecordId(
  sourceCandidateId: string,
  material: string,
  candidates: readonly AssetReviewCandidate[],
): string {
  const base = `${sourceCandidateId.slice(0, 64)}-r-${material.slice(-10)}`;
  if (!candidates.some((candidate) => candidate.id === base)) return base;
  throw new AssetReviewError(
    "conflicting-decision",
    "The source returned conflicting asset material for the same review revision.",
  );
}

function reviewFingerprint(candidates: readonly AssetReviewCandidate[]): string {
  return canonicalValueFingerprint(sortedCandidates(candidates));
}

function materialFingerprint(candidates: readonly AssetReviewCandidate[]): string {
  return canonicalValueFingerprint(
    sortedCandidates(candidates)
      .filter(
        (candidate) =>
          candidate.requiredForBrief ||
          candidate.status === "approved" ||
          candidate.approvalDecision !== null,
      )
      .map((candidate) => ({
        id: candidate.id,
        status: candidate.status,
        selectedRole: candidate.selectedRole,
        requiredForBrief: candidate.requiredForBrief,
        materialFingerprint: candidate.materialFingerprint,
        revision: candidate.revision,
        supersedes: candidate.supersedes,
        supersededBy: candidate.supersededBy,
      })),
  );
}

function finalizeState(
  candidates: readonly AssetReviewCandidate[],
  revision: number,
): AssetReviewState {
  const sorted = sortedCandidates(candidates);
  return assetReviewStateSchema.parse({
    schemaVersion: ASSET_REVIEW_SCHEMA_VERSION,
    revision,
    candidates: sorted,
    reviewFingerprint: reviewFingerprint(sorted),
    materialFingerprint: materialFingerprint(sorted),
  });
}

export function createEmptyAssetReviewState(): AssetReviewState {
  return finalizeState([], 0);
}

export function assetReviewHasMaterialChanges(stateInput: AssetReviewState): boolean {
  const state = cloneAssetReviewState(stateInput);
  return state.candidates.some(
    (candidate) =>
      candidate.requiredForBrief ||
      candidate.status === "approved" ||
      candidate.approvalDecision !== null,
  );
}

export function cloneAssetReviewState(state: AssetReviewState): AssetReviewState {
  return assetReviewStateSchema.parse(structuredClone(state));
}

function normalizedAssetUrl(candidate: AssetCandidate): string {
  if (candidate.source.kind !== "source-url") {
    throw new AssetReviewError(
      "unsafe-provenance",
      "Only source-scoped public asset candidates can enter this review workflow.",
    );
  }
  const url = new URL(candidate.source.url);
  url.hash = "";
  return url.toString();
}

function hostnameIsUnsafe(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local")) {
    return true;
  }
  if (/^(?:127\.|10\.|169\.254\.|192\.168\.)/.test(value)) return true;
  const private172 = value.match(/^172\.(\d{1,3})\./)?.[1];
  if (private172 && Number(private172) >= 16 && Number(private172) <= 31) return true;
  return (
    value === "::1" ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("fc") ||
    value.startsWith("fd")
  );
}

function assertSafeProvenance(sourceInput: SourceReference, candidateInput: AssetCandidate): void {
  const source = sourceReferenceSchema.parse(sourceInput);
  const candidate = assetCandidateSchema.parse(candidateInput);
  if (candidate.provenance.sourceReferenceId !== source.id) {
    throw new AssetReviewError(
      "cross-source-candidate",
      "This asset belongs to a different storefront source and cannot be reviewed here.",
    );
  }
  const sourceUrl = new URL(normalizedAssetUrl(candidate));
  const documentUrl = candidate.provenance.documentUrl
    ? new URL(candidate.provenance.documentUrl)
    : null;
  if (
    sourceUrl.origin !== source.normalizedOrigin ||
    documentUrl?.origin !== source.normalizedOrigin ||
    hostnameIsUnsafe(sourceUrl.hostname) ||
    (documentUrl !== null && hostnameIsUnsafe(documentUrl.hostname))
  ) {
    throw new AssetReviewError(
      "unsafe-provenance",
      "The asset provenance does not satisfy the approved public-source safety boundary.",
    );
  }
}

function candidateMaterialFingerprint(sourceId: string, candidate: AssetCandidate): string {
  return canonicalValueFingerprint({
    sourceReferenceId: sourceId,
    normalizedSourceUrl: normalizedAssetUrl(candidate),
    identity: candidate.fingerprint ?? {
      dimensions: candidate.dimensions,
      mediaType: candidate.mediaType,
    },
  });
}

function newCandidate(
  source: SourceReference,
  candidate: AssetCandidate,
  requiredForBrief: boolean,
  recordId = candidate.id,
): AssetReviewCandidate {
  const material = candidateMaterialFingerprint(source.id, candidate);
  return assetReviewCandidateSchema.parse({
    id: recordId,
    sourceCandidateId: candidate.id,
    sourceReferenceId: source.id,
    normalizedSourceUrl: normalizedAssetUrl(candidate),
    finalFetchedUrl: candidate.provenance.documentUrl,
    extractionLocation: candidate.provenance.extractionLocation,
    retrievedAt: candidate.provenance.observedAt,
    mediaType: candidate.mediaType,
    discoveredRole: candidate.role,
    suggestedRoles: roleSuggestions[candidate.role],
    confidence: candidate.confidence,
    uncertainty: candidate.uncertainty,
    warnings: candidate.warnings,
    provenance: candidate.provenance,
    originalCandidate: candidate,
    observations: [candidate],
    status: "discovered",
    selectedRole: null,
    roleDecision: null,
    approvalDecision: null,
    rejectionDecision: null,
    unavailableDecision: null,
    supersedes: null,
    supersededBy: null,
    requiredForBrief,
    materialFingerprint: material,
    revision: 1,
  });
}

export function registerDiscoveredAssetCandidates(input: {
  state: AssetReviewState;
  source: SourceReference;
  candidates: readonly AssetCandidate[];
  requiredCandidateIds?: readonly string[];
  now: string;
}): AssetReviewState {
  const state = cloneAssetReviewState(input.state);
  const source = sourceReferenceSchema.parse(input.source);
  const requiredIds = new Set(input.requiredCandidateIds ?? []);
  let candidates = [...state.candidates];
  let changed = false;

  for (const raw of [...input.candidates].sort((left, right) => left.id.localeCompare(right.id))) {
    const candidate = assetCandidateSchema.parse(raw);
    assertSafeProvenance(source, candidate);
    const material = candidateMaterialFingerprint(source.id, candidate);
    const crossSourceCandidate = candidates.find(
      (existing) =>
        logicalCandidateId(existing) === candidate.id && existing.sourceReferenceId !== source.id,
    );
    if (crossSourceCandidate) {
      throw new AssetReviewError(
        "cross-source-candidate",
        "The discovered asset identifier is already owned by a different storefront source.",
      );
    }
    const duplicate = candidates.find(
      (existing) =>
        existing.sourceReferenceId === source.id && existing.materialFingerprint === material,
    );
    if (duplicate) {
      const hasObservation = duplicate.observations.some(
        (observation) => observation.id === candidate.id,
      );
      const suggestedRoles = normalizedSuggestedRoles([
        ...duplicate.suggestedRoles,
        ...roleSuggestions[candidate.role],
      ]);
      const requiredForBrief = duplicate.requiredForBrief || requiredIds.has(candidate.id);
      if (
        !hasObservation ||
        suggestedRoles.some((role, index) => role !== duplicate.suggestedRoles[index]) ||
        requiredForBrief !== duplicate.requiredForBrief
      ) {
        const merged = assetReviewCandidateSchema.parse({
          ...duplicate,
          observations: hasObservation
            ? duplicate.observations
            : [...duplicate.observations, candidate].sort((left, right) =>
                left.id.localeCompare(right.id),
              ),
          suggestedRoles,
          requiredForBrief,
          revision: duplicate.revision + 1,
        });
        candidates = candidates.map((item) => (item.id === duplicate.id ? merged : item));
        changed = true;
      }
      continue;
    }

    const normalizedUrl = normalizedAssetUrl(candidate);
    const sameLogicalCandidate = candidates.find(
      (existing) =>
        existing.sourceReferenceId === source.id &&
        logicalCandidateId(existing) === candidate.id &&
        existing.status !== "superseded",
    );
    const approvedAtSameUrl = candidates.find(
      (existing) =>
        existing.sourceReferenceId === source.id &&
        existing.normalizedSourceUrl === normalizedUrl &&
        existing.status === "approved",
    );
    const replaced = sameLogicalCandidate ?? approvedAtSameUrl;
    let created = newCandidate(
      source,
      candidate,
      requiredIds.has(candidate.id),
      replaced && logicalCandidateId(replaced) === candidate.id
        ? replacementRecordId(candidate.id, material, candidates)
        : candidate.id,
    );
    if (replaced) {
      const reason = "The public source produced materially changed asset metadata.";
      const superseded = assetReviewCandidateSchema.parse({
        ...replaced,
        status: "superseded",
        supersededBy: { candidateId: created.id, recordedAt: input.now, reason },
        revision: replaced.revision + 1,
      });
      created = assetReviewCandidateSchema.parse({
        ...created,
        status: "needsReview",
        requiredForBrief: created.requiredForBrief || replaced.requiredForBrief,
        supersedes: { candidateId: replaced.id, recordedAt: input.now, reason },
        revision: 1,
      });
      candidates = candidates.map((item) => (item.id === replaced.id ? superseded : item));
    }
    candidates.push(created);
    changed = true;
  }

  return changed ? finalizeState(candidates, state.revision + 1) : state;
}

function decisionActor(input: {
  actorId: string;
  actorReference?: string | null;
  now: string;
  note?: string | null;
}) {
  const parsed = merchantAssetDecisionSchema.safeParse({
    actorId: input.actorId,
    actorReference: input.actorReference ?? null,
    decidedAt: input.now,
    note: input.note ?? null,
  });
  if (!parsed.success) {
    throw new AssetReviewError("missing-actor", "A merchant actor is required for this decision.");
  }
  return parsed.data;
}

function currentCandidate(
  state: AssetReviewState,
  candidateId: string,
  sourceReferenceId: string,
  expectedRevision: number,
): AssetReviewCandidate {
  const candidate = state.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    throw new AssetReviewError("unknown-candidate", "This asset candidate is no longer available.");
  }
  if (candidate.sourceReferenceId !== sourceReferenceId) {
    throw new AssetReviewError(
      "cross-source-candidate",
      "This asset belongs to a different storefront source.",
    );
  }
  if (candidate.revision !== expectedRevision) {
    throw new AssetReviewError(
      "stale-review-revision",
      "The asset review changed. Refresh it before recording another decision.",
    );
  }
  return candidate;
}

function replaceCandidate(
  state: AssetReviewState,
  candidate: AssetReviewCandidate,
): AssetReviewState {
  return finalizeState(
    state.candidates.map((item) => (item.id === candidate.id ? candidate : item)),
    state.revision + 1,
  );
}

export function assignAssetCandidateRole(input: {
  state: AssetReviewState;
  candidateId: string;
  sourceReferenceId: string;
  expectedRevision: number;
  role: ComponentAssetRole;
  alt?: z.input<typeof localizedTextSchema> | null;
  actorId: string;
  actorReference?: string | null;
  note?: string | null;
  now: string;
}): AssetReviewState {
  const state = cloneAssetReviewState(input.state);
  const candidate = currentCandidate(
    state,
    input.candidateId,
    input.sourceReferenceId,
    input.expectedRevision,
  );
  if (candidate.status === "rejected") {
    throw new AssetReviewError("rejected-candidate", "A rejected asset cannot be relabelled.");
  }
  if (candidate.status === "superseded") {
    throw new AssetReviewError(
      "superseded-candidate",
      "A superseded asset cannot receive a current role.",
    );
  }
  if (candidate.status === "unavailable") {
    throw new AssetReviewError(
      "unavailable-candidate",
      "An unavailable asset cannot receive a current role.",
    );
  }
  if (candidate.status === "approved") {
    throw new AssetReviewError(
      "conflicting-decision",
      "An approved asset must be superseded before its semantic role changes.",
    );
  }
  const role = componentAssetRoleSchema.safeParse(input.role);
  if (!role.success) {
    throw new AssetReviewError("invalid-role", "Choose a supported storefront asset role.", {
      cause: role.error,
    });
  }
  const actor = decisionActor(input);
  const roleDecision = assetRoleDecisionSchema.safeParse({
    ...actor,
    role: role.data,
    alt: input.alt ?? null,
  });
  if (!roleDecision.success) {
    throw new AssetReviewError(
      "invalid-role",
      "The selected role requires valid merchant-reviewed presentation metadata.",
      { cause: roleDecision.error },
    );
  }
  return replaceCandidate(
    state,
    assetReviewCandidateSchema.parse({
      ...candidate,
      status: "needsReview",
      selectedRole: role.data,
      roleDecision: roleDecision.data,
      revision: candidate.revision + 1,
    }),
  );
}

export function approveAssetCandidate(input: {
  state: AssetReviewState;
  source: SourceReference;
  candidateId: string;
  expectedRevision: number;
  actorId: string;
  actorReference?: string | null;
  note?: string | null;
  now: string;
}): AssetReviewState {
  const state = cloneAssetReviewState(input.state);
  const source = sourceReferenceSchema.parse(input.source);
  const candidate = currentCandidate(state, input.candidateId, source.id, input.expectedRevision);
  if (candidate.status === "rejected") {
    throw new AssetReviewError("rejected-candidate", "A rejected asset cannot be approved.");
  }
  if (candidate.status === "superseded") {
    throw new AssetReviewError("superseded-candidate", "A superseded asset cannot be approved.");
  }
  if (candidate.status === "unavailable") {
    throw new AssetReviewError("unavailable-candidate", "An unavailable asset cannot be approved.");
  }
  if (candidate.status === "approved") {
    throw new AssetReviewError("conflicting-decision", "This asset is already approved.");
  }
  if (candidate.status !== "needsReview" || !candidate.roleDecision || !candidate.selectedRole) {
    throw new AssetReviewError(
      "invalid-role",
      "Confirm a supported semantic role before approving this asset.",
    );
  }
  assertSafeProvenance(source, candidate.originalCandidate);
  const approvalDecision = decisionActor(input);
  return replaceCandidate(
    state,
    assetReviewCandidateSchema.parse({
      ...candidate,
      status: "approved",
      approvalDecision,
      revision: candidate.revision + 1,
    }),
  );
}

export function rejectAssetCandidate(input: {
  state: AssetReviewState;
  candidateId: string;
  sourceReferenceId: string;
  expectedRevision: number;
  actorId: string;
  actorReference?: string | null;
  note?: string | null;
  now: string;
}): AssetReviewState {
  const state = cloneAssetReviewState(input.state);
  const candidate = currentCandidate(
    state,
    input.candidateId,
    input.sourceReferenceId,
    input.expectedRevision,
  );
  if (candidate.status === "approved" || candidate.status === "rejected") {
    throw new AssetReviewError(
      "conflicting-decision",
      "This asset already has a conflicting final decision.",
    );
  }
  if (candidate.status === "superseded") {
    throw new AssetReviewError("superseded-candidate", "A superseded asset cannot be rejected.");
  }
  const rejectionDecision = decisionActor(input);
  return replaceCandidate(
    state,
    assetReviewCandidateSchema.parse({
      ...candidate,
      status: "rejected",
      rejectionDecision,
      revision: candidate.revision + 1,
    }),
  );
}

export function markAssetCandidateUnavailable(input: {
  state: AssetReviewState;
  candidateId: string;
  sourceReferenceId: string;
  expectedRevision: number;
  reason: string;
  now: string;
}): AssetReviewState {
  const state = cloneAssetReviewState(input.state);
  const candidate = currentCandidate(
    state,
    input.candidateId,
    input.sourceReferenceId,
    input.expectedRevision,
  );
  if (candidate.status === "superseded") {
    throw new AssetReviewError(
      "superseded-candidate",
      "A superseded asset is already historical and cannot become current.",
    );
  }
  return replaceCandidate(
    state,
    assetReviewCandidateSchema.parse({
      ...candidate,
      status: "unavailable",
      unavailableDecision: { recordedAt: input.now, reason: input.reason },
      revision: candidate.revision + 1,
    }),
  );
}

export function markAssetCandidateRequired(input: {
  state: AssetReviewState;
  candidateId: string;
  sourceReferenceId: string;
  expectedRevision: number;
  required: boolean;
}): AssetReviewState {
  const state = cloneAssetReviewState(input.state);
  const candidate = currentCandidate(
    state,
    input.candidateId,
    input.sourceReferenceId,
    input.expectedRevision,
  );
  if (candidate.requiredForBrief === input.required) return state;
  return replaceCandidate(
    state,
    assetReviewCandidateSchema.parse({
      ...candidate,
      requiredForBrief: input.required,
      revision: candidate.revision + 1,
    }),
  );
}

export function listAssetCandidatesRequiringReview(
  stateInput: AssetReviewState,
): AssetReviewActionCandidate[] {
  const state = cloneAssetReviewState(stateInput);
  return state.candidates
    .filter(
      (candidate) =>
        candidate.status === "discovered" ||
        candidate.status === "needsReview" ||
        (candidate.status === "unavailable" && candidate.requiredForBrief),
    )
    .map((candidate) => {
      const reviewCandidate = assetReviewCandidateSchema.parse(structuredClone(candidate));
      const allowedActions: AssetReviewAction[] =
        reviewCandidate.status === "unavailable"
          ? ["reject", "mark-not-required", "select-replacement"]
          : ["confirm-role", "approve", "reject", "mark-not-required"];
      return { ...reviewCandidate, allowedActions };
    });
}

export function unresolvedRequiredAssetCandidates(
  stateInput: AssetReviewState,
): AssetReviewCandidate[] {
  const state = cloneAssetReviewState(stateInput);
  return state.candidates.filter(
    (candidate) =>
      candidate.requiredForBrief &&
      (candidate.status === "discovered" ||
        candidate.status === "needsReview" ||
        candidate.status === "unavailable"),
  );
}

export function approvedAssetProjection(
  stateInput: AssetReviewState,
): ApprovedAssetProjectionItem[] {
  const state = cloneAssetReviewState(stateInput);
  return state.candidates
    .filter(
      (candidate) =>
        candidate.status === "approved" &&
        candidate.selectedRole !== null &&
        candidate.roleDecision !== null &&
        candidate.approvalDecision !== null,
    )
    .map((candidate) => {
      const role = candidate.selectedRole as ComponentAssetRole;
      const metadata: StorefrontAssetMetadata = storefrontAssetMetadataSchema.parse({
        assetId: candidate.id,
        role,
        alt: candidate.roleDecision?.alt ?? undefined,
        decorative: role === "iconDecorative",
        provenance: {
          kind: "sourceDiscovered",
          sourceId: candidate.sourceReferenceId,
          sourceUrl: candidate.normalizedSourceUrl,
          capturedAt: candidate.retrievedAt,
        },
        approvalStatus: "approved",
        usageRights: "publicSource",
        responsiveCrops: [],
        revision: `${candidate.revision}:${candidate.materialFingerprint}`.slice(0, 120),
      });
      return approvedAssetProjectionItemSchema.parse({
        assetId: candidate.id,
        approvedRole: role,
        approvalState: "approved",
        provenance: candidate.provenance,
        sourceIdentity: {
          sourceReferenceId: candidate.sourceReferenceId,
          sourceUrl: candidate.normalizedSourceUrl,
          finalFetchedUrl: candidate.finalFetchedUrl,
        },
        revision: metadata.revision,
        fingerprint: candidate.materialFingerprint,
        componentMetadata: metadata,
      });
    })
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
}
