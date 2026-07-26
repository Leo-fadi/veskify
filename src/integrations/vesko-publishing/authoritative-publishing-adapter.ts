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

export interface AuthoritativePublishingRevisionMapper {
  projectRevision(revision: number): string;
  snapshotRevision(revision: number): string;
}

export type AuthoritativePublishingAdapterInput = Readonly<{
  projectRepository: ProjectRepository;
  contextPort: MerchantProjectContextPort;
  publishPreparations: AuthoritativePublishPreparationReader;
  revisionMapper: AuthoritativePublishingRevisionMapper;
  maxCompletedReplayEntries?: number;
}>;

export type StandaloneAuthoritativePublishingAdapterInput = Omit<
  AuthoritativePublishingAdapterInput,
  "revisionMapper"
>;

type ParsedPublishRequest = Parameters<StorefrontPublishingGateway["publish"]>[0];
type ReplayEntry = Readonly<{
  requestFingerprint: string;
  pending?: Promise<PublicationResult>;
  result?: PublicationResult;
}>;

export const defaultCompletedReplayEntryLimit = 256;
export const standaloneSnapshotRevisionPrefix = "standalone-snapshot-revision-";

export function toStandaloneSnapshotRevision(revision: number): string {
  return `${standaloneSnapshotRevisionPrefix}${revision}`;
}

export const standalonePublishingRevisionMapper: AuthoritativePublishingRevisionMapper = {
  projectRevision: toStandaloneProjectRevision,
  snapshotRevision: toStandaloneSnapshotRevision,
};

function requestFingerprint(request: ParsedPublishRequest): string {
  return JSON.stringify(request);
}

function cloneResult(result: PublicationResult): PublicationResult {
  return structuredClone(result);
}

function snapshotById(aggregate: ProjectAggregate, snapshotId: string) {
  return aggregate.snapshots.find(({ id }) => id === snapshotId) ?? null;
}

function authoritativeSnapshot(
  aggregate: ProjectAggregate,
  snapshotId: string,
  tenantId: string,
  revisionMapper: AuthoritativePublishingRevisionMapper,
) {
  const snapshot = snapshotById(aggregate, snapshotId);
  if (snapshot === null) return null;
  return {
    id: snapshot.id,
    revision: revisionMapper.snapshotRevision(snapshot.revision),
    contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
    tenantId,
    storefrontProjectId: aggregate.project.id,
  };
}

function assertAuthenticatedIdentityAndPermission(
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
}

function assertCurrentProjectRevision(
  request: ParsedPublishRequest,
  authenticated: Awaited<ReturnType<MerchantProjectContextPort["load"]>>,
): void {
  if (
    authenticated.projectRevision !== request.context.projectRevision ||
    authenticated.projectRevision !== request.expectedProjectRevision
  ) {
    throw new VeskoIntegrationError("staleProjectRevision");
  }
}

async function authenticatePublishingRequest(
  request: ParsedPublishRequest,
  input: AuthoritativePublishingAdapterInput,
  requireCurrentRevision: boolean,
): Promise<void> {
  try {
    const authenticated = await input.contextPort.load({
      tenantId: request.context.tenantId,
      storefrontProjectId: request.context.storefrontProjectId,
    });
    assertAuthenticatedIdentityAndPermission(request, authenticated);
    if (requireCurrentRevision) assertCurrentProjectRevision(request, authenticated);
  } catch (error) {
    throw mapPublishingFailure(error);
  }
}

function assertPreparationMatchesRequest(
  preparation: PublishPreparation,
  request: ParsedPublishRequest,
  revisionMapper: AuthoritativePublishingRevisionMapper,
): void {
  if (preparation.projectId !== request.context.storefrontProjectId) {
    throw new VeskoIntegrationError("projectNotFound");
  }
  if (
    preparation.preparationId !== request.publishPreparationId ||
    revisionMapper.projectRevision(preparation.expectedProjectRevision) !==
      request.expectedProjectRevision ||
    preparation.expectedDraft.id !== request.expectedSavedDraft.id ||
    revisionMapper.snapshotRevision(preparation.expectedDraft.revision) !==
      request.expectedSavedDraft.revision ||
    preparation.expectedDraft.contentFingerprint !==
      request.expectedSavedDraft.contentFingerprint ||
    preparation.expectedPublished.id !== request.expectedPublished.id ||
    revisionMapper.snapshotRevision(preparation.expectedPublished.revision) !==
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

async function reconcileCommittedPublication(
  request: ParsedPublishRequest,
  preparation: PublishPreparation,
  input: AuthoritativePublishingAdapterInput,
): Promise<PublicationResult | null> {
  try {
    const aggregate = validateProjectAggregate(
      await input.projectRepository.get(request.context.storefrontProjectId),
    );
    const sourceDraft = snapshotById(aggregate, preparation.expectedDraft.id);
    const priorPublished = snapshotById(aggregate, preparation.expectedPublished.id);
    const currentPublished = snapshotById(aggregate, aggregate.project.publishedSnapshotId);
    const currentDraft = snapshotById(aggregate, aggregate.project.draftSnapshotId);
    const publishedHistory = aggregate.snapshotHistoryMetadata?.some(
      ({ snapshotId, reason }) => snapshotId === currentPublished?.id && reason === "published",
    );
    const synchronizedHistory = aggregate.snapshotHistoryMetadata?.some(
      ({ snapshotId, reason }) =>
        snapshotId === currentDraft?.id && reason === "publishedDraftSynchronized",
    );

    if (
      aggregate.project.revision !== preparation.expectedProjectRevision + 1 ||
      sourceDraft === null ||
      sourceDraft.revision !== preparation.expectedDraft.revision ||
      canonicalStorefrontContentFingerprint(sourceDraft) !==
        preparation.expectedDraft.contentFingerprint ||
      priorPublished === null ||
      priorPublished.revision !== preparation.expectedPublished.revision ||
      canonicalStorefrontContentFingerprint(priorPublished) !==
        preparation.expectedPublished.contentFingerprint ||
      currentPublished === null ||
      currentDraft === null ||
      currentPublished.id === currentDraft.id ||
      currentPublished.revision !== aggregate.project.revision ||
      currentDraft.revision !== aggregate.project.revision ||
      canonicalStorefrontContentFingerprint(currentPublished) !==
        preparation.expectedDraft.contentFingerprint ||
      canonicalStorefrontContentFingerprint(currentDraft) !==
        preparation.expectedDraft.contentFingerprint ||
      publishedHistory !== true ||
      synchronizedHistory !== true
    ) {
      return null;
    }

    return publicationResultSchema.parse({
      requestId: request.requestId,
      storefrontProjectId: request.context.storefrontProjectId,
      publishedRevision: input.revisionMapper.snapshotRevision(currentPublished.revision),
      status: "published",
    });
  } catch {
    return null;
  }
}

async function executePublish(
  request: ParsedPublishRequest,
  input: AuthoritativePublishingAdapterInput,
): Promise<PublicationResult> {
  await authenticatePublishingRequest(request, input, true);

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
  assertPreparationMatchesRequest(preparation, request, input.revisionMapper);

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
    input.revisionMapper,
  );
  const published = authoritativeSnapshot(
    aggregate,
    aggregate.project.publishedSnapshotId,
    request.context.tenantId,
    input.revisionMapper,
  );
  assertAuthoritativePublishPreconditions(
    request,
    savedDraft,
    published,
    input.revisionMapper.projectRevision(aggregate.project.revision),
    preparation.preparationId,
  );

  try {
    const confirmed = await confirmPublish(preparation, input.projectRepository);
    return publicationResultSchema.parse({
      requestId: request.requestId,
      storefrontProjectId: request.context.storefrontProjectId,
      publishedRevision: input.revisionMapper.snapshotRevision(
        confirmed.publishedSnapshot.revision,
      ),
      status: "published",
    });
  } catch (error) {
    const reconciled = await reconcileCommittedPublication(request, preparation, input);
    if (reconciled !== null) return reconciled;
    throw mapPublishingFailure(error);
  }
}

function rememberSuccessfulReplay(
  replays: Map<string, ReplayEntry>,
  requestId: string,
  entry: ReplayEntry,
  completedEntryLimit: number,
): void {
  replays.delete(requestId);
  replays.set(requestId, entry);
  const completedEntries = [...replays].filter(([, replay]) => replay.result !== undefined);
  while (completedEntries.length > completedEntryLimit) {
    const oldest = completedEntries.shift();
    if (oldest !== undefined) replays.delete(oldest[0]);
  }
}

export function createAuthoritativeStorefrontPublishingAdapter(
  input: AuthoritativePublishingAdapterInput,
): StorefrontPublishingGateway {
  const replays = new Map<string, ReplayEntry>();
  const completedEntryLimit = input.maxCompletedReplayEntries ?? defaultCompletedReplayEntryLimit;
  if (!Number.isInteger(completedEntryLimit) || completedEntryLimit < 1) {
    throw new Error("Completed publication replay retention must be a positive integer.");
  }

  return {
    async publish(requestInput) {
      const parsed = publishStorefrontRequestSchema.safeParse(requestInput);
      if (!parsed.success) {
        throw new VeskoIntegrationError("malformedIntegrationResponse");
      }
      const request = parsed.data;
      const fingerprint = requestFingerprint(request);
      const replay = replays.get(request.requestId);
      if (replay !== undefined) {
        if (replay.requestFingerprint !== fingerprint) {
          throw new VeskoIntegrationError("stalePublishConfirmation");
        }
        if (replay.result !== undefined) {
          await authenticatePublishingRequest(request, input, false);
          return cloneResult(replay.result);
        }
        if (replay.pending !== undefined) return replay.pending.then(cloneResult);
      }

      const pending = executePublish(request, input)
        .then((result) => {
          rememberSuccessfulReplay(
            replays,
            request.requestId,
            { requestFingerprint: fingerprint, result },
            completedEntryLimit,
          );
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
  input: StandaloneAuthoritativePublishingAdapterInput,
): StorefrontPublishingGateway {
  return createAuthoritativeStorefrontPublishingAdapter({
    ...input,
    revisionMapper: standalonePublishingRevisionMapper,
  });
}
