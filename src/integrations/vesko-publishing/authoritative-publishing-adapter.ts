import {
  type AcceptedSnapshotCurrentAuthoritySource,
  type AcceptedSnapshotPublishReceiptRepository,
} from "@/application/accepted-snapshot-publishing";
import {
  confirmPublish,
  InvalidPublishPreparationError,
  NoPublishableChangesError,
  PublishConfirmationError,
  PublishCompilerError,
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
  type MerchantProjectContext,
  type MerchantProjectContextPort,
  type PublicationResult,
  type StorefrontPublishingGateway,
} from "@/application/vesko-integration";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
} from "@/domain/storefront";
import {
  DraftConflictError,
  NoStorefrontChangesError,
  ProjectNotFoundError,
  PublicationOperationConflictError,
  PublicationOperationValidationError,
  PublishedConflictError,
  PublishContentConflictError,
  RepositoryValidationError,
  RevisionConflictError,
  SnapshotNotFoundError,
  publicationOperationKey,
  publicationOperationRecordSchema,
  type AuthoritativePublishingProjectRepository,
  type ProjectAggregate,
  type PublicationOperationIdentity,
  type PublicationOperationWrite,
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
  projectRepository: AuthoritativePublishingProjectRepository;
  contextPort: MerchantProjectContextPort;
  publishPreparations: AuthoritativePublishPreparationReader;
  revisionMapper: AuthoritativePublishingRevisionMapper;
  acceptedSnapshotAuthority?: Readonly<{
    receiptRepository: AcceptedSnapshotPublishReceiptRepository;
    currentAuthoritySource: AcceptedSnapshotCurrentAuthoritySource;
  }>;
}>;

export type StandaloneAuthoritativePublishingAdapterInput = Omit<
  AuthoritativePublishingAdapterInput,
  "revisionMapper"
>;

type ParsedPublishRequest = Parameters<StorefrontPublishingGateway["publish"]>[0];
type InFlightPublication = Readonly<{
  requestFingerprint: string;
  pending: Promise<PublicationResult>;
  token: symbol;
}>;

export const standaloneSnapshotRevisionPrefix = "standalone-snapshot-revision-";

export function toStandaloneSnapshotRevision(revision: number): string {
  return `${standaloneSnapshotRevisionPrefix}${revision}`;
}

export const standalonePublishingRevisionMapper: AuthoritativePublishingRevisionMapper = {
  projectRevision: toStandaloneProjectRevision,
  snapshotRevision: toStandaloneSnapshotRevision,
};

function requestFingerprint(request: ParsedPublishRequest): string {
  return canonicalValueFingerprint(request);
}

function cloneResult(result: PublicationResult): PublicationResult {
  return structuredClone(result);
}

function publicationOperationIdentity(request: ParsedPublishRequest): PublicationOperationIdentity {
  return {
    tenantId: request.context.tenantId,
    merchantId: request.context.merchantId,
    organizationId: request.context.organizationId,
    storeId: request.context.storeId,
    storefrontProjectId: request.context.storefrontProjectId,
    operationType: "publish",
    requestId: request.requestId,
  };
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
  authenticated: MerchantProjectContext,
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
  authenticated: MerchantProjectContext,
): void {
  if (
    authenticated.projectRevision !== request.context.projectRevision ||
    authenticated.projectRevision !== request.expectedProjectRevision
  ) {
    throw new VeskoIntegrationError("staleProjectRevision");
  }
}

async function loadAuthorizedPublishingContext(
  request: ParsedPublishRequest,
  input: AuthoritativePublishingAdapterInput,
): Promise<MerchantProjectContext> {
  try {
    const authenticated = await input.contextPort.load({
      tenantId: request.context.tenantId,
      storefrontProjectId: request.context.storefrontProjectId,
    });
    assertAuthenticatedIdentityAndPermission(request, authenticated);
    return authenticated;
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
  if (
    error instanceof StalePublishPreparationError ||
    error instanceof PublicationOperationConflictError
  ) {
    return new VeskoIntegrationError("stalePublishConfirmation");
  }
  if (error instanceof NoPublishableChangesError) {
    return new VeskoIntegrationError("savedDraftMismatch");
  }
  if (
    error instanceof InvalidPublishPreparationError ||
    error instanceof PublishPreparationValidationError ||
    error instanceof PublicationOperationValidationError ||
    error instanceof RepositoryValidationError
  ) {
    return new VeskoIntegrationError("malformedIntegrationResponse");
  }
  if (error instanceof PublishCompilerError) {
    return error.code === "prepare-confirmation-compile-mismatch"
      ? new VeskoIntegrationError("stalePublishConfirmation", { cause: error })
      : new VeskoIntegrationError("publishCompilationRejected", { cause: error });
  }
  if (error instanceof PublishConfirmationError) {
    return error.cause === undefined
      ? new VeskoIntegrationError("malformedIntegrationResponse")
      : mapPublishingFailure(error.cause);
  }
  return new VeskoIntegrationError("publishingUnavailable");
}

async function loadCompletedPublication(
  identity: PublicationOperationIdentity,
  fingerprint: string,
  input: AuthoritativePublishingAdapterInput,
): Promise<PublicationResult | null> {
  let loaded: unknown;
  try {
    loaded = await input.projectRepository.getPublicationOperation(identity);
  } catch (error) {
    throw mapPublishingFailure(error);
  }
  if (loaded === null) return null;

  const parsed = publicationOperationRecordSchema.safeParse(loaded);
  if (
    !parsed.success ||
    parsed.data.operationKey !== publicationOperationKey(identity) ||
    parsed.data.tenantId !== identity.tenantId ||
    parsed.data.merchantId !== identity.merchantId ||
    parsed.data.organizationId !== identity.organizationId ||
    parsed.data.storeId !== identity.storeId ||
    parsed.data.storefrontProjectId !== identity.storefrontProjectId ||
    parsed.data.operationType !== identity.operationType ||
    parsed.data.requestId !== identity.requestId ||
    parsed.data.result.publishedRevision !==
      input.revisionMapper.snapshotRevision(parsed.data.committedProjectRevision)
  ) {
    throw new VeskoIntegrationError("malformedIntegrationResponse");
  }
  if (parsed.data.requestFingerprint !== fingerprint) {
    throw new VeskoIntegrationError("stalePublishConfirmation");
  }

  const result = publicationResultSchema.safeParse(parsed.data.result);
  if (
    !result.success ||
    result.data.requestId !== identity.requestId ||
    result.data.storefrontProjectId !== identity.storefrontProjectId ||
    result.data.publishedRevision !==
      input.revisionMapper.snapshotRevision(parsed.data.committedProjectRevision)
  ) {
    throw new VeskoIntegrationError("malformedIntegrationResponse");
  }
  return cloneResult(result.data);
}

async function loadPublishPreparation(
  request: ParsedPublishRequest,
  input: AuthoritativePublishingAdapterInput,
): Promise<PublishPreparation> {
  try {
    const loaded = await input.publishPreparations.load(request.publishPreparationId);
    if (loaded === null) throw new VeskoIntegrationError("stalePublishConfirmation");
    const parsed = publishPreparationSchema.safeParse(loaded);
    if (!parsed.success) throw new VeskoIntegrationError("malformedIntegrationResponse");
    return parsed.data;
  } catch (error) {
    throw mapPublishingFailure(error);
  }
}

function operationWrite(
  request: ParsedPublishRequest,
  preparation: PublishPreparation,
  fingerprint: string,
  input: AuthoritativePublishingAdapterInput,
): PublicationOperationWrite {
  return {
    ...publicationOperationIdentity(request),
    requestFingerprint: fingerprint,
    result: {
      requestId: request.requestId,
      storefrontProjectId: request.context.storefrontProjectId,
      publishedRevision: input.revisionMapper.snapshotRevision(
        preparation.expectedProjectRevision + 1,
      ),
      status: "published",
    },
  };
}

async function executePublish(
  request: ParsedPublishRequest,
  fingerprint: string,
  input: AuthoritativePublishingAdapterInput,
): Promise<PublicationResult> {
  const preparation = await loadPublishPreparation(request, input);
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

  const operation = operationWrite(request, preparation, fingerprint, input);
  try {
    await confirmPublish(preparation, input.projectRepository, {
      publicationOperation: operation,
      authority:
        preparation.authority.kind === "accepted-ai"
          ? input.acceptedSnapshotAuthority
            ? {
                kind: "accepted-ai",
                receiptRepository: input.acceptedSnapshotAuthority.receiptRepository,
                currentAuthoritySource: input.acceptedSnapshotAuthority.currentAuthoritySource,
              }
            : (() => {
                throw new VeskoIntegrationError("publishingUnavailable");
              })()
          : { kind: "manual" },
    });
    const completed = await loadCompletedPublication(
      publicationOperationIdentity(request),
      fingerprint,
      input,
    );
    if (completed === null) {
      throw new VeskoIntegrationError("malformedIntegrationResponse");
    }
    return completed;
  } catch (error) {
    const reconciled = await loadCompletedPublication(
      publicationOperationIdentity(request),
      fingerprint,
      input,
    );
    if (reconciled !== null) return reconciled;
    throw mapPublishingFailure(error);
  }
}

export function createAuthoritativeStorefrontPublishingAdapter(
  input: AuthoritativePublishingAdapterInput,
): StorefrontPublishingGateway {
  const inFlight = new Map<string, InFlightPublication>();

  return {
    async publish(requestInput) {
      const parsed = publishStorefrontRequestSchema.safeParse(requestInput);
      if (!parsed.success) {
        throw new VeskoIntegrationError("malformedIntegrationResponse");
      }
      const request = parsed.data;
      const fingerprint = requestFingerprint(request);
      const identity = publicationOperationIdentity(request);
      const operationKey = publicationOperationKey(identity);

      const authenticated = await loadAuthorizedPublishingContext(request, input);
      const completed = await loadCompletedPublication(identity, fingerprint, input);
      if (completed !== null) return completed;

      const existing = inFlight.get(operationKey);
      if (existing !== undefined) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new VeskoIntegrationError("stalePublishConfirmation");
        }
        return existing.pending.then(cloneResult);
      }
      assertCurrentProjectRevision(request, authenticated);

      const token = Symbol(operationKey);
      const pending = executePublish(request, fingerprint, input)
        .then(cloneResult)
        .catch((error: unknown) => {
          throw mapPublishingFailure(error);
        })
        .finally(() => {
          const current = inFlight.get(operationKey);
          if (current?.token === token) inFlight.delete(operationKey);
        });
      inFlight.set(operationKey, { requestFingerprint: fingerprint, pending, token });
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
