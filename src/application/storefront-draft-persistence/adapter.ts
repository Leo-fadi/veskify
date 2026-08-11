import { z } from "zod";
import {
  assembleValidatedEditorDraft,
  EditorDraftValidationError,
  saveValidatedEditorDraft,
  StaleEditorDraftError,
} from "@/application/draft-save";
import {
  createMerchantProjectAuthorization,
  merchantProjectContextLookupSchema,
  requireMerchantProjectAction,
  type MerchantProjectContextPort,
} from "@/application/merchant-project-context";
import {
  assertAuthoritativeDraftSavePreconditions,
  assertAuthoritativeRestorePreconditions,
  restoreStorefrontHistoryRequestSchema,
  saveStorefrontDraftRequestSchema,
  storefrontDraftSchema,
  storefrontSnapshotExpectationSchema,
  tenantIdSchema,
  VeskoIntegrationError,
  type MerchantProjectContext,
  type StorefrontDraft,
  type StorefrontDraftPersistencePort,
} from "@/application/vesko-integration/contract";
import { idSchema } from "@/domain/shared";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  DraftConflictError,
  InvalidRestoreTargetError,
  ProjectNotFoundError,
  RepositoryValidationError,
  RestoreContentConflictError,
  RevisionConflictError,
  SnapshotAlreadyExistsError,
  SnapshotNotFoundError,
  SnapshotProjectMismatchError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";

export const standaloneSnapshotRevisionPrefix = "standalone-snapshot-revision-";

export function toStandaloneSnapshotRevision(revision: number): string {
  return `${standaloneSnapshotRevisionPrefix}${revision}`;
}

const draftSaveProvenanceBaseSchema = z.object({
  requestId: idSchema,
  tenantId: tenantIdSchema,
  merchantId: z.string().trim().min(1).max(80),
  storeId: z.string().trim().min(1).max(80),
  storefrontProjectId: idSchema,
  expectedBase: storefrontSnapshotExpectationSchema,
});

export const manualEditorDraftSaveProvenanceSchema = draftSaveProvenanceBaseSchema
  .extend({ origin: z.literal("manualEditor") })
  .strict();

export const aiProposalDraftSaveProvenanceSchema = draftSaveProvenanceBaseSchema
  .extend({
    origin: z.literal("aiProposal"),
    proposalId: idSchema,
    proposalState: z.enum(["ready", "accepted", "rejected", "failed", "stale", "closed"]),
    acceptedSnapshot: storefrontSnapshotSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.acceptedSnapshot.projectId !== value.storefrontProjectId) {
      context.addIssue({
        code: "custom",
        path: ["acceptedSnapshot", "projectId"],
        message: "The accepted draft must belong to its storefront project.",
      });
    }
  });

export const draftSaveProvenanceSchema = z.discriminatedUnion("origin", [
  manualEditorDraftSaveProvenanceSchema,
  aiProposalDraftSaveProvenanceSchema,
]);

export type DraftSaveProvenance = z.infer<typeof draftSaveProvenanceSchema>;

/**
 * Resolves the authoritative origin recorded by the editor/proposal lifecycle.
 * The client cannot select the manual or AI path through the save request.
 */
export interface DraftSaveProvenanceSource {
  resolveSaveProvenance(input: {
    requestId: string;
    context: MerchantProjectContext;
  }): Promise<unknown>;
}

export type PersistedDraftSaveLineage = {
  tenantId: string;
  merchantId: string;
  storeId: string;
  storefrontProjectId: string;
  operation: "save";
  requestId: string;
  origin: DraftSaveProvenance["origin"];
  sourceDraft: z.infer<typeof storefrontSnapshotExpectationSchema>;
  proposalId?: string;
};

export function createPersistedDraftSnapshotId({
  savedAt,
  lineage,
}: {
  savedAt: Date;
  lineage: PersistedDraftSaveLineage;
}): string {
  const lineageDigest = canonicalValueFingerprint(lineage).slice(-16);
  return idSchema.parse(`snapshot_saved_${savedAt.getTime().toString(36)}_${lineageDigest}`);
}

type AdapterInput = {
  projectRepository: ProjectRepository;
  contextPort: MerchantProjectContextPort;
  saveProvenanceSource: DraftSaveProvenanceSource;
  now?: () => Date;
  createSnapshotId?: (input: { savedAt: Date; lineage: PersistedDraftSaveLineage }) => string;
};

type CompletedOperation = {
  signature: string;
  result: StorefrontDraft;
};

function snapshotById(aggregate: ProjectAggregate, snapshotId: string): StorefrontSnapshot | null {
  return aggregate.snapshots.find((snapshot) => snapshot.id === snapshotId) ?? null;
}

function currentDraft(aggregate: ProjectAggregate): StorefrontSnapshot {
  const draft = snapshotById(aggregate, aggregate.project.draftSnapshotId);
  if (!draft) throw new VeskoIntegrationError("draftRevisionConflict");
  return draft;
}

function authoritativeSnapshot(
  tenantId: string,
  storefrontProjectId: string,
  snapshot: StorefrontSnapshot,
) {
  return {
    tenantId,
    storefrontProjectId,
    id: snapshot.id,
    revision: toStandaloneSnapshotRevision(snapshot.revision),
    contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
  };
}

function asDraft(
  tenantId: string,
  storefrontProjectId: string,
  snapshot: StorefrontSnapshot,
): StorefrontDraft {
  return storefrontDraftSchema.parse({
    tenantId,
    storefrontProjectId,
    revision: toStandaloneSnapshotRevision(snapshot.revision),
    contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
    snapshot: structuredClone(snapshot),
  });
}

function sameExpectation(
  left: z.infer<typeof storefrontSnapshotExpectationSchema>,
  right: z.infer<typeof storefrontSnapshotExpectationSchema>,
): boolean {
  return (
    left.id === right.id &&
    left.revision === right.revision &&
    left.contentFingerprint === right.contentFingerprint
  );
}

function sameContextIdentity(
  requested: MerchantProjectContext,
  authoritative: MerchantProjectContext,
): boolean {
  return (
    requested.userId === authoritative.userId &&
    requested.merchantId === authoritative.merchantId &&
    requested.organizationId === authoritative.organizationId &&
    requested.storeId === authoritative.storeId
  );
}

function sameActiveIdentity(left: StorefrontSnapshot, right: StorefrontSnapshot): boolean {
  return (
    left.id === right.id &&
    left.projectId === right.projectId &&
    left.revision === right.revision &&
    left.catalogueRef === right.catalogueRef &&
    left.createdAt === right.createdAt &&
    left.createdBy === right.createdBy &&
    canonicalValueString(left.navigation) === canonicalValueString(right.navigation) &&
    canonicalValueString(left.pages.map(({ id }) => id)) ===
      canonicalValueString(right.pages.map(({ id }) => id))
  );
}

function changedPages(
  current: StorefrontSnapshot,
  candidate: StorefrontSnapshot,
): StorefrontSnapshot["pages"] {
  return candidate.pages.filter((page) => {
    const currentPage = current.pages.find(({ id }) => id === page.id);
    return (
      currentPage === undefined || canonicalValueString(page) !== canonicalValueString(currentPage)
    );
  });
}

function dynamicCommercePresentationChanged(
  current: StorefrontSnapshot,
  candidate: StorefrontSnapshot,
): boolean {
  return (
    canonicalValueString(current.dynamicCommercePresentation) !==
    canonicalValueString(candidate.dynamicCommercePresentation)
  );
}

function mapPersistenceFailure(error: unknown): VeskoIntegrationError {
  if (error instanceof VeskoIntegrationError) return error;
  if (error instanceof ProjectNotFoundError) return new VeskoIntegrationError("projectNotFound");
  if (error instanceof RevisionConflictError) {
    return new VeskoIntegrationError("staleProjectRevision");
  }
  if (error instanceof DraftConflictError || error instanceof StaleEditorDraftError) {
    return new VeskoIntegrationError("draftRevisionConflict");
  }
  if (error instanceof SnapshotNotFoundError || error instanceof InvalidRestoreTargetError) {
    return new VeskoIntegrationError("historyTargetUnavailable");
  }
  if (error instanceof RestoreContentConflictError) {
    return new VeskoIntegrationError(
      error.target === "target" ? "historyTargetFingerprintMismatch" : "draftRevisionConflict",
    );
  }
  if (error instanceof SnapshotProjectMismatchError) {
    return new VeskoIntegrationError("projectNotFound");
  }
  if (
    error instanceof RepositoryValidationError ||
    error instanceof EditorDraftValidationError ||
    error instanceof z.ZodError
  ) {
    return new VeskoIntegrationError("malformedIntegrationResponse");
  }
  if (error instanceof SnapshotAlreadyExistsError) {
    return new VeskoIntegrationError("draftRevisionConflict");
  }
  return new VeskoIntegrationError("unsupportedCapability");
}

function parseRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new VeskoIntegrationError("malformedIntegrationResponse");
  return parsed.data;
}

function operationKey(
  context: MerchantProjectContext,
  operation: "save" | "restore",
  requestId: string,
): string {
  return canonicalValueString({
    tenantId: context.tenantId,
    merchantId: context.merchantId,
    storeId: context.storeId,
    storefrontProjectId: context.storefrontProjectId,
    operation,
    requestId,
  });
}

function completedResult(
  completed: Map<string, CompletedOperation>,
  key: string,
  signature: string,
  conflict: "draftRevisionConflict" | "staleHistoryTarget",
): StorefrontDraft | null {
  const prior = completed.get(key);
  if (!prior) return null;
  if (prior.signature !== signature) throw new VeskoIntegrationError(conflict);
  return structuredClone(prior.result);
}

function saveSignature(request: z.infer<typeof saveStorefrontDraftRequestSchema>): string {
  return canonicalValueString({
    expectedProjectRevision: request.expectedProjectRevision,
    expectedCurrentDraft: request.expectedCurrentDraft,
    draft: request.draft,
  });
}

function restoreSignature(request: z.infer<typeof restoreStorefrontHistoryRequestSchema>): string {
  return canonicalValueString({
    expectedProjectRevision: request.expectedProjectRevision,
    expectedCurrentDraft: request.expectedCurrentDraft,
    target: request.target,
  });
}

export function createStorefrontDraftPersistenceAdapter({
  projectRepository,
  contextPort,
  saveProvenanceSource,
  now = () => new Date(),
  createSnapshotId = createPersistedDraftSnapshotId,
}: AdapterInput): StorefrontDraftPersistencePort {
  // P9-05A standalone idempotency is process-local; durable transports may
  // implement the same scoped key at their repository boundary.
  const completedOperations = new Map<string, CompletedOperation>();

  async function loadContext(
    requested: MerchantProjectContext,
    action: "edit-storefront-draft" | "restore-storefront-draft",
  ): Promise<MerchantProjectContext> {
    const authoritative = await contextPort.load({
      tenantId: requested.tenantId,
      storefrontProjectId: requested.storefrontProjectId,
    });
    if (authoritative.tenantId !== requested.tenantId) {
      throw new VeskoIntegrationError("tenantMismatch");
    }
    if (authoritative.storefrontProjectId !== requested.storefrontProjectId) {
      throw new VeskoIntegrationError("projectNotFound");
    }
    if (!sameContextIdentity(requested, authoritative)) {
      throw new VeskoIntegrationError("permissionDenied");
    }
    requireMerchantProjectAction(createMerchantProjectAuthorization(authoritative), action);
    return authoritative;
  }

  async function loadAggregate(projectId: string): Promise<ProjectAggregate> {
    try {
      return validateProjectAggregate(await projectRepository.get(projectId));
    } catch (error) {
      throw mapPersistenceFailure(error);
    }
  }

  return {
    async load(input) {
      try {
        const lookup = merchantProjectContextLookupSchema.parse(input);
        const context = await contextPort.load(lookup);
        requireMerchantProjectAction(
          createMerchantProjectAuthorization(context),
          "edit-storefront-draft",
        );
        const aggregate = await loadAggregate(lookup.storefrontProjectId);
        return asDraft(context.tenantId, context.storefrontProjectId, currentDraft(aggregate));
      } catch (error) {
        throw mapPersistenceFailure(error);
      }
    },

    async save(input) {
      const request = parseRequest(saveStorefrontDraftRequestSchema, input);
      try {
        const context = await loadContext(request.context, "edit-storefront-draft");
        const key = operationKey(context, "save", request.requestId);
        const signature = saveSignature(request);
        const replay = completedResult(
          completedOperations,
          key,
          signature,
          "draftRevisionConflict",
        );
        if (replay) return replay;

        const aggregate = await loadAggregate(context.storefrontProjectId);
        const draft = currentDraft(aggregate);
        const authoritativeCurrent = authoritativeSnapshot(
          context.tenantId,
          context.storefrontProjectId,
          draft,
        );
        assertAuthoritativeDraftSavePreconditions(
          request,
          authoritativeCurrent,
          context.projectRevision,
        );
        if (request.expectedCurrentDraft === null) {
          throw new VeskoIntegrationError("draftRevisionConflict");
        }

        const provenance = draftSaveProvenanceSchema.parse(
          await saveProvenanceSource.resolveSaveProvenance({
            requestId: request.requestId,
            context,
          }),
        );
        if (
          provenance.requestId !== request.requestId ||
          provenance.tenantId !== context.tenantId ||
          provenance.merchantId !== context.merchantId ||
          provenance.storeId !== context.storeId ||
          provenance.storefrontProjectId !== context.storefrontProjectId
        ) {
          throw new VeskoIntegrationError(
            provenance.tenantId !== context.tenantId ? "tenantMismatch" : "permissionDenied",
          );
        }
        if (
          !sameExpectation(provenance.expectedBase, request.expectedCurrentDraft) ||
          !sameExpectation(provenance.expectedBase, authoritativeCurrent)
        ) {
          throw new VeskoIntegrationError("draftRevisionConflict");
        }

        const candidate =
          provenance.origin === "aiProposal"
            ? structuredClone(provenance.acceptedSnapshot)
            : structuredClone(request.draft.snapshot);
        if (provenance.origin === "aiProposal" && provenance.proposalState !== "accepted") {
          throw new VeskoIntegrationError("draftRevisionConflict");
        }
        if (
          !sameActiveIdentity(candidate, draft) ||
          request.draft.revision !== toStandaloneSnapshotRevision(candidate.revision) ||
          request.draft.contentFingerprint !== canonicalStorefrontContentFingerprint(candidate) ||
          request.draft.tenantId !== context.tenantId ||
          request.draft.storefrontProjectId !== context.storefrontProjectId ||
          canonicalValueString(request.draft.snapshot) !== canonicalValueString(candidate)
        ) {
          throw new VeskoIntegrationError("draftRevisionConflict");
        }

        const candidateChangedPages = changedPages(draft, candidate);
        const replaceCompleteSnapshot = dynamicCommercePresentationChanged(draft, candidate);
        const validatedCandidate = assembleValidatedEditorDraft({
          baseDraft: draft,
          aggregate,
          primaryLocale: aggregate.project.primaryLocale,
          ...(replaceCompleteSnapshot
            ? { replacementSnapshot: candidate }
            : { changedPages: candidateChangedPages, brandSystem: candidate.brandSystem }),
        });
        if (canonicalValueString(validatedCandidate) !== canonicalValueString(candidate)) {
          throw new VeskoIntegrationError("draftRevisionConflict");
        }

        const lineage: PersistedDraftSaveLineage = {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          storeId: context.storeId,
          storefrontProjectId: context.storefrontProjectId,
          operation: "save",
          requestId: request.requestId,
          origin: provenance.origin,
          sourceDraft: {
            id: draft.id,
            revision: toStandaloneSnapshotRevision(draft.revision),
            contentFingerprint: canonicalStorefrontContentFingerprint(draft),
          },
          ...(provenance.origin === "aiProposal" ? { proposalId: provenance.proposalId } : {}),
        };
        const savedAt = now();
        const result = await saveValidatedEditorDraft({
          repository: projectRepository,
          projectId: context.storefrontProjectId,
          loadedDraft: draft,
          ...(replaceCompleteSnapshot
            ? { replacementSnapshot: candidate }
            : { changedPages: candidateChangedPages, brandSystem: candidate.brandSystem }),
          primaryLocale: aggregate.project.primaryLocale,
          now: () => savedAt,
          createSnapshotId: () => createSnapshotId({ savedAt, lineage }),
        });
        const saved = asDraft(context.tenantId, context.storefrontProjectId, result.draft);
        completedOperations.set(key, { signature, result: structuredClone(saved) });
        return saved;
      } catch (error) {
        throw mapPersistenceFailure(error);
      }
    },

    async restore(input) {
      const request = parseRequest(restoreStorefrontHistoryRequestSchema, input);
      try {
        const context = await loadContext(request.context, "restore-storefront-draft");
        const key = operationKey(context, "restore", request.requestId);
        const signature = restoreSignature(request);
        const replay = completedResult(completedOperations, key, signature, "staleHistoryTarget");
        if (replay) return replay;

        const aggregate = await loadAggregate(context.storefrontProjectId);
        const draft = currentDraft(aggregate);
        const target =
          request.target.id === aggregate.project.draftSnapshotId
            ? null
            : snapshotById(aggregate, request.target.id);
        const authoritativeCurrent = authoritativeSnapshot(
          context.tenantId,
          context.storefrontProjectId,
          draft,
        );
        const authoritativeTarget = target
          ? {
              ...authoritativeSnapshot(context.tenantId, context.storefrontProjectId, target),
              immutable: true as const,
            }
          : null;

        assertAuthoritativeRestorePreconditions(
          request,
          authoritativeCurrent,
          authoritativeTarget,
          context.projectRevision,
        );

        const restored = await projectRepository.restore(
          context.storefrontProjectId,
          request.target.id,
          {
            projectRevision: aggregate.project.revision,
            draft: {
              id: draft.id,
              revision: draft.revision,
              contentFingerprint: canonicalStorefrontContentFingerprint(draft),
            },
            target: {
              id: target!.id,
              revision: target!.revision,
              contentFingerprint: canonicalStorefrontContentFingerprint(target!),
            },
          },
        );
        if (
          restored.id === target!.id ||
          restored.projectId !== context.storefrontProjectId ||
          !canonicalStorefrontContentEqual(restored, target!)
        ) {
          throw new VeskoIntegrationError("malformedIntegrationResponse");
        }
        const result = asDraft(context.tenantId, context.storefrontProjectId, restored);
        completedOperations.set(key, { signature, result: structuredClone(result) });
        return result;
      } catch (error) {
        throw mapPersistenceFailure(error);
      }
    },
  };
}
