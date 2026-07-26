import {
  confirmPublish,
  InvalidPublishPreparationError,
  NoPublishableChangesError,
  PublishConfirmationError,
  publishPreparationSchema,
  PublishPreparationValidationError,
  StalePublishPreparationError,
  type PublishPreparation,
} from "@/application/publishing";
import { toStandaloneProjectRevision } from "@/application/merchant-project-context";
import {
  assertAuthoritativePublishPreconditions,
  publicationResultSchema,
  publishStorefrontRequestSchema,
  VeskoIntegrationError,
  type MerchantProjectContextPort,
  type PublicationResult,
  type StorefrontPublishingGateway,
} from "@/application/vesko-integration";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront";
import {
  DraftConflictError,
  NoStorefrontChangesError,
  ProjectNotFoundError,
  PublishedConflictError,
  PublishContentConflictError,
  RepositoryValidationError,
  RevisionConflictError,
  SnapshotNotFoundError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";

export interface AuthoritativePublishPreparationReader {
  load(preparationId: string): Promise<PublishPreparation | null>;
}

export type AuthoritativePublishingAdapterInput = Readonly<{
  projectRepository: ProjectRepository;
  contextPort: MerchantProjectContextPort;
  publishPreparations: AuthoritativePublishPreparationReader;
}>;

type ParsedPublishRequest = Parameters<StorefrontPublishingGateway["publish"]>[0];
type ReplayEntry = Readonly<{
  requestFingerprint: string;
  pending?: Promise<PublicationResult>;
  result?: PublicationResult;
}>;

export const standaloneSnapshotRevisionPrefix = "standalone-snapshot-revision-";

export function toStandaloneSnapshotRevision(revision: number): string {
  return `${standaloneSnapshotRevisionPrefix}${revision}`;
}

function requestFingerprint(request: ParsedPublishRequest): string {
  return JSON.stringify(request);
}

function cloneResult(result: PublicationResult): PublicationResult {
  return structuredClone(result);
}

function snapshotById(aggregate: ProjectAggregate, snapshotId: string) {
  return aggregate.snapshots.find(({ id }) => id === snapshotId) ?? null;
}

function authoritativeSnapshot(aggregate: ProjectAggregate, snapshotId: string, tenantId: string) {
  const snapshot = snapshotById(aggregate, snapshotId);
  if (snapshot === null) return null;
  return {
    id: snapshot.id,
    revision: toStandaloneSnapshotRevision(snapshot.revision),
    contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
    tenantId,
    storefrontProjectId: aggregate.project.id,
  };
}

function assertAuthenticatedContext(
  request: ParsedPublishRequest,
  authenticated: Awaited<ReturnType<MerchantProjectContextPort["load"]>>,
): void {
  if (authenticated.tenantId !== request.context.tenantId) {
    throw new VeskoIntegrationError("tenantMismatch");
  }
  if (authenticated.storefrontProjectId !== request.context.storefrontProjectId) {
    throw new VeskoIntegrationError("projectNotFound");
  }
  if (
    authenticated.merchantId !== request.context.merchantId ||
    authenticated.organizationId !== request.context.organizationId ||
    authenticated.storeId !== request.context.storeId
  ) {
    throw new VeskoIntegrationError("merchantNotFound");
  }
  if (authenticated.userId !== request.context.userId) {
    throw new VeskoIntegrationError("permissionDenied");
  }
  if (
    !authenticated.permissions.includes("publishStorefront") ||
    !request.context.permissions.includes("publishStorefront")
  ) {
    throw new VeskoIntegrationError("permissionDenied");
  }
  if (
    authenticated.projectRevision !== request.context.projectRevision ||
    authenticated.projectRevision !== request.expectedProjectRevision
  ) {
    throw new VeskoIntegrationError("staleProjectRevision");
  }
}

function assertPreparationMatchesRequest(
  preparation: PublishPreparation,
  request: ParsedPublishRequest,
): void {
  if (preparation.projectId !== request.context.storefrontProjectId) {
    throw new VeskoIntegrationError("projectNotFound");
  }
  if (
    preparation.preparationId !== request.publishPreparationId ||
    toStandaloneProjectRevision(preparation.expectedProjectRevision) !==
      request.expectedProjectRevision ||
    preparation.expectedDraft.id !== request.expectedSavedDraft.id ||
    toStandaloneSnapshotRevision(preparation.expectedDraft.revision) !==
      request.expectedSavedDraft.revision ||
    preparation.expectedDraft.contentFingerprint !==
      request.expectedSavedDraft.contentFingerprint ||
    preparation.expectedPublished.id !== request.expectedPublished.id ||
    toStandaloneSnapshotRevision(preparation.expectedPublished.revision) !==
      request.expectedPublished.revision ||
    preparation.expectedPublished.contentFingerprint !==
      request.expectedPublished.contentFingerprint
  ) {
    throw new VeskoIntegrationError("stalePublishConfirmation");
  }
  if (!preparation.publishPermitted) {
    throw new VeskoIntegrationError("savedDraftMismatch");
  }
}

function mapPublishingFailure(error: unknown): VeskoIntegrationError {
  if (error instanceof VeskoIntegrationError) return error;
  if (error instanceof ProjectNotFoundError) return new VeskoIntegrationError("projectNotFound");
  if (error instanceof RevisionConflictError) {
    return new VeskoIntegrationError("staleProjectRevision");
  }
  if (error instanceof DraftConflictError || error instanceof NoStorefrontChangesError) {
    return new VeskoIntegrationError("savedDraftMismatch");
  }
  if (error instanceof PublishedConflictError) {
    return new VeskoIntegrationError("publishedStateConflict");
  }
  if (error instanceof PublishContentConflictError) {
    return new VeskoIntegrationError(
      error.target === "draft" ? "savedDraftMismatch" : "publishedStateConflict",
    );
  }
  if (error instanceof SnapshotNotFoundError) {
    return new VeskoIntegrationError("savedDraftMismatch");
  }
  if (error instanceof StalePublishPreparationError) {
    return new VeskoIntegrationError("stalePublishConfirmation");
  }
  if (error instanceof NoPublishableChangesError) {
    return new VeskoIntegrationError("savedDraftMismatch");
  }
  if (
    error instanceof InvalidPublishPreparationError ||
    error instanceof PublishPreparationValidationError ||
    error instanceof RepositoryValidationError
  ) {
    return new VeskoIntegrationError("malformedIntegrationResponse");
  }
  if (error instanceof PublishConfirmationError) {
    return error.cause === undefined
      ? new VeskoIntegrationError("malformedIntegrationResponse")
      : mapPublishingFailure(error.cause);
  }
  return new VeskoIntegrationError("publishingUnavailable");
}

async function executePublish(
  request: ParsedPublishRequest,
  input: AuthoritativePublishingAdapterInput,
): Promise<PublicationResult> {
  let authenticated;
  try {
    authenticated = await input.contextPort.load({
      tenantId: request.context.tenantId,
      storefrontProjectId: request.context.storefrontProjectId,
    });
  } catch (error) {
    throw mapPublishingFailure(error);
  }
  assertAuthenticatedContext(request, authenticated);

  let preparation: PublishPreparation;
  try {
    const loaded = await input.publishPreparations.load(request.publishPreparationId);
    if (loaded === null) throw new VeskoIntegrationError("stalePublishConfirmation");
    const parsed = publishPreparationSchema.safeParse(loaded);
    if (!parsed.success) throw new VeskoIntegrationError("malformedIntegrationResponse");
    preparation = parsed.data;
  } catch (error) {
    throw mapPublishingFailure(error);
  }
  assertPreparationMatchesRequest(preparation, request);

  let aggregate: ProjectAggregate;
  try {
    aggregate = validateProjectAggregate(
      await input.projectRepository.get(request.context.storefrontProjectId),
    );
  } catch (error) {
    throw mapPublishingFailure(error);
  }

  const savedDraft = authoritativeSnapshot(
    aggregate,
    aggregate.project.draftSnapshotId,
    request.context.tenantId,
  );
  const published = authoritativeSnapshot(
    aggregate,
    aggregate.project.publishedSnapshotId,
    request.context.tenantId,
  );
  assertAuthoritativePublishPreconditions(
    request,
    savedDraft,
    published,
    toStandaloneProjectRevision(aggregate.project.revision),
    preparation.preparationId,
  );

  try {
    const confirmed = await confirmPublish(preparation, input.projectRepository);
    return publicationResultSchema.parse({
      requestId: request.requestId,
      storefrontProjectId: request.context.storefrontProjectId,
      publishedRevision: toStandaloneSnapshotRevision(confirmed.publishedSnapshot.revision),
      status: "published",
    });
  } catch (error) {
    throw mapPublishingFailure(error);
  }
}

export function createAuthoritativeStorefrontPublishingAdapter(
  input: AuthoritativePublishingAdapterInput,
): StorefrontPublishingGateway {
  const replays = new Map<string, ReplayEntry>();

  return {
    publish(requestInput) {
      const parsed = publishStorefrontRequestSchema.safeParse(requestInput);
      if (!parsed.success) {
        return Promise.reject(new VeskoIntegrationError("malformedIntegrationResponse"));
      }
      const request = parsed.data;
      const fingerprint = requestFingerprint(request);
      const replay = replays.get(request.requestId);
      if (replay !== undefined) {
        if (replay.requestFingerprint !== fingerprint) {
          return Promise.reject(new VeskoIntegrationError("stalePublishConfirmation"));
        }
        if (replay.result !== undefined) return Promise.resolve(cloneResult(replay.result));
        if (replay.pending !== undefined) return replay.pending.then(cloneResult);
      }

      const pending = executePublish(request, input)
        .then((result) => {
          replays.set(request.requestId, { requestFingerprint: fingerprint, result });
          return cloneResult(result);
        })
        .catch((error: unknown) => {
          const current = replays.get(request.requestId);
          if (
            current?.requestFingerprint === fingerprint &&
            current.result === undefined &&
            current.pending !== undefined
          ) {
            replays.delete(request.requestId);
          }
          throw mapPublishingFailure(error);
        });
      replays.set(request.requestId, { requestFingerprint: fingerprint, pending });
      return pending;
    },
  };
}

export function createStandaloneAuthoritativePublishingAdapter(
  input: AuthoritativePublishingAdapterInput,
): StorefrontPublishingGateway {
  return createAuthoritativeStorefrontPublishingAdapter(input);
}
