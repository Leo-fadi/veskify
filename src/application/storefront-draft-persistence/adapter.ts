import { z } from "zod";
import {
  createMerchantProjectAuthorization,
  merchantProjectContextLookupSchema,
  requireMerchantProjectAction,
  type MerchantProjectContextPort,
} from "@/application/merchant-project-context";
import {
  assertAuthoritativeDraftSavePreconditions,
  assertAuthoritativeRestorePreconditions,
  saveStorefrontDraftRequestSchema,
  storefrontDraftSchema,
  storefrontSnapshotExpectationSchema,
  restoreStorefrontHistoryRequestSchema,
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

export const acceptedStorefrontDraftCandidateSchema = z
  .object({
    state: z.literal("accepted"),
    requestId: idSchema,
    tenantId: tenantIdSchema,
    storefrontProjectId: idSchema,
    expectedBase: storefrontSnapshotExpectationSchema,
    snapshot: storefrontSnapshotSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.snapshot.projectId !== value.storefrontProjectId) {
      context.addIssue({
        code: "custom",
        path: ["snapshot", "projectId"],
        message: "The accepted draft must belong to its storefront project.",
      });
    }
  });

export type AcceptedStorefrontDraftCandidate = z.infer<
  typeof acceptedStorefrontDraftCandidateSchema
>;

/**
 * Reads the result of the existing accepted-proposal lifecycle. This is an
 * authority resolver, not a second draft persistence boundary.
 */
export interface AcceptedStorefrontDraftSource {
  resolveAcceptedDraft(input: {
    requestId: string;
    context: MerchantProjectContext;
  }): Promise<unknown>;
}

type AdapterInput = {
  projectRepository: ProjectRepository;
  contextPort: MerchantProjectContextPort;
  acceptedDraftSource: AcceptedStorefrontDraftSource;
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

function mapRepositoryFailure(error: unknown): VeskoIntegrationError {
  if (error instanceof VeskoIntegrationError) return error;
  if (error instanceof ProjectNotFoundError) return new VeskoIntegrationError("projectNotFound");
  if (error instanceof RevisionConflictError) {
    return new VeskoIntegrationError("staleProjectRevision");
  }
  if (error instanceof DraftConflictError) {
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
  if (error instanceof RepositoryValidationError || error instanceof z.ZodError) {
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

export function createStorefrontDraftPersistenceAdapter({
  projectRepository,
  contextPort,
  acceptedDraftSource,
}: AdapterInput): StorefrontDraftPersistencePort {
  const completedRequestIds = new Set<string>();

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
      throw mapRepositoryFailure(error);
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
        throw mapRepositoryFailure(error);
      }
    },

    async save(input) {
      const request = parseRequest(saveStorefrontDraftRequestSchema, input);
      if (completedRequestIds.has(request.requestId)) {
        throw new VeskoIntegrationError("draftRevisionConflict");
      }

      try {
        const context = await loadContext(request.context, "edit-storefront-draft");
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

        const accepted = acceptedStorefrontDraftCandidateSchema.parse(
          await acceptedDraftSource.resolveAcceptedDraft({
            requestId: request.requestId,
            context,
          }),
        );
        if (
          accepted.requestId !== request.requestId ||
          accepted.tenantId !== context.tenantId ||
          accepted.storefrontProjectId !== context.storefrontProjectId
        ) {
          throw new VeskoIntegrationError(
            accepted.tenantId !== context.tenantId ? "tenantMismatch" : "projectNotFound",
          );
        }
        if (
          request.expectedCurrentDraft === null ||
          !sameExpectation(accepted.expectedBase, request.expectedCurrentDraft) ||
          !sameExpectation(accepted.expectedBase, authoritativeCurrent)
        ) {
          throw new VeskoIntegrationError("draftRevisionConflict");
        }

        const candidate = accepted.snapshot;
        const candidateFingerprint = canonicalStorefrontContentFingerprint(candidate);
        if (
          candidate.id === draft.id ||
          aggregate.snapshots.some((snapshot) => snapshot.id === candidate.id) ||
          candidate.projectId !== context.storefrontProjectId ||
          candidate.catalogueRef !== aggregate.catalogue.id ||
          request.draft.revision !== toStandaloneSnapshotRevision(candidate.revision) ||
          request.draft.contentFingerprint !== candidateFingerprint ||
          request.draft.tenantId !== context.tenantId ||
          request.draft.storefrontProjectId !== context.storefrontProjectId ||
          canonicalValueString(request.draft.snapshot) !== canonicalValueString(candidate)
        ) {
          throw new VeskoIntegrationError("draftRevisionConflict");
        }

        await projectRepository.saveDraft(context.storefrontProjectId, candidate, {
          id: draft.id,
          revision: draft.revision,
        });
        completedRequestIds.add(request.requestId);
        return asDraft(context.tenantId, context.storefrontProjectId, candidate);
      } catch (error) {
        throw mapRepositoryFailure(error);
      }
    },

    async restore(input) {
      const request = parseRequest(restoreStorefrontHistoryRequestSchema, input);
      if (completedRequestIds.has(request.requestId)) {
        throw new VeskoIntegrationError("draftRevisionConflict");
      }

      try {
        const context = await loadContext(request.context, "restore-storefront-draft");
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
        completedRequestIds.add(request.requestId);
        return asDraft(context.tenantId, context.storefrontProjectId, restored);
      } catch (error) {
        throw mapRepositoryFailure(error);
      }
    },
  };
}
