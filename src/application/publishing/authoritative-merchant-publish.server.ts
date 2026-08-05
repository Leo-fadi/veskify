import "server-only";

import { mkdir, open, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  type AcceptedSnapshotCurrentAuthoritySource,
  type AcceptedSnapshotPublishReceiptRepository,
} from "@/application/accepted-snapshot-publishing";
import {
  publishStorefrontRequestSchema,
  type MerchantProjectContext,
  type StorefrontPublishingGateway,
} from "@/application/vesko-integration";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { idSchema } from "@/domain/shared";
import type { AuthoritativePublishingProjectRepository } from "@/services/storage";
import type { AuthoritativePublishingRevisionMapper } from "@/integrations/vesko-publishing";
import { preparePublish } from "./prepare-publish";
import { publishPreparationSchema, type PublishPreparation } from "./contract";

const merchantPublishAuthorityRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }).strict(),
  z.object({ kind: z.literal("accepted-ai"), receiptId: idSchema }).strict(),
]);

export const merchantPublishPrepareRequestSchema = z
  .object({
    projectId: idSchema,
    requestId: idSchema,
    authority: merchantPublishAuthorityRequestSchema,
  })
  .strict();

export const merchantPublishConfirmRequestSchema = z
  .object({ projectId: idSchema, requestId: idSchema, preparationId: idSchema })
  .strict();

const merchantPublishPreparationRecordSchema = z
  .object({
    version: z.literal(1),
    projectId: idSchema,
    requestId: idSchema,
    requestFingerprint: z.string().trim().min(1).max(240),
    preparation: z.unknown(),
    gatewayRequest: z.unknown(),
  })
  .strict();

type MerchantPublishPreparationRecord = Readonly<{
  version: 1;
  projectId: string;
  requestId: string;
  requestFingerprint: string;
  preparation: PublishPreparation;
  gatewayRequest: Parameters<StorefrontPublishingGateway["publish"]>[0];
}>;

export class AuthoritativeMerchantPublishError extends Error {
  constructor(
    readonly code:
      | "authentication-required"
      | "permission-denied"
      | "project-mismatch"
      | "missing-preparation"
      | "idempotency-conflict"
      | "accepted-ai-unavailable"
      | "invalid-request",
    options?: ErrorOptions,
  ) {
    super("The authoritative storefront publication request is unavailable.", options);
    this.name = "AuthoritativeMerchantPublishError";
  }
}

export interface MerchantPublishPreparationStore {
  createOrResolve(
    record: MerchantPublishPreparationRecord,
  ): Promise<MerchantPublishPreparationRecord>;
  load(preparationId: string): Promise<MerchantPublishPreparationRecord | null>;
}

function parseRecord(input: unknown): MerchantPublishPreparationRecord {
  const parsed = merchantPublishPreparationRecordSchema.safeParse(input);
  if (!parsed.success) throw new AuthoritativeMerchantPublishError("invalid-request");
  const preparation = publishPreparationSchema.safeParse(parsed.data.preparation);
  const gatewayRequest = publishStorefrontRequestSchema.safeParse(parsed.data.gatewayRequest);
  if (!preparation.success || !gatewayRequest.success) {
    throw new AuthoritativeMerchantPublishError("invalid-request");
  }
  return {
    ...parsed.data,
    preparation: preparation.data,
    gatewayRequest: gatewayRequest.data,
  };
}

function preparationFile(directory: string, preparationId: string): string {
  return join(directory, `${preparationId}.json`);
}

/** Durable, narrow server store for prepared merchant publication requests. */
export class FileSystemMerchantPublishPreparationStore implements MerchantPublishPreparationStore {
  readonly #directory: string;

  constructor(directory: string) {
    this.#directory = directory;
  }

  async createOrResolve(
    recordInput: MerchantPublishPreparationRecord,
  ): Promise<MerchantPublishPreparationRecord> {
    const record = parseRecord(recordInput);
    const file = preparationFile(this.#directory, record.preparation.preparationId);
    await mkdir(this.#directory, { recursive: true });
    try {
      const handle = await open(file, "wx");
      try {
        await handle.writeFile(JSON.stringify(record), "utf8");
      } finally {
        await handle.close();
      }
      return structuredClone(record);
    } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
      const existing = await this.load(record.preparation.preparationId);
      if (existing?.requestFingerprint === record.requestFingerprint) return existing;
      throw new AuthoritativeMerchantPublishError("idempotency-conflict");
    }
  }

  async load(preparationId: string): Promise<MerchantPublishPreparationRecord | null> {
    try {
      return parseRecord(
        JSON.parse(await readFile(preparationFile(this.#directory, preparationId), "utf8")),
      );
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return null;
      }
      if (error instanceof AuthoritativeMerchantPublishError) throw error;
      throw new AuthoritativeMerchantPublishError("invalid-request", { cause: error });
    }
  }
}

export class InMemoryMerchantPublishPreparationStore implements MerchantPublishPreparationStore {
  readonly #records = new Map<string, MerchantPublishPreparationRecord>();

  createOrResolve(
    recordInput: MerchantPublishPreparationRecord,
  ): Promise<MerchantPublishPreparationRecord> {
    const record = parseRecord(recordInput);
    const existing = this.#records.get(record.preparation.preparationId);
    if (existing) {
      if (existing.requestFingerprint === record.requestFingerprint)
        return Promise.resolve(structuredClone(existing));
      return Promise.reject(new AuthoritativeMerchantPublishError("idempotency-conflict"));
    }
    this.#records.set(record.preparation.preparationId, structuredClone(record));
    return Promise.resolve(structuredClone(record));
  }

  load(preparationId: string): Promise<MerchantPublishPreparationRecord | null> {
    const record = this.#records.get(preparationId);
    return Promise.resolve(record ? structuredClone(record) : null);
  }
}

export interface AuthenticatedMerchantPublishContextSource {
  resolve(input: { projectId: string; request: Request }): Promise<MerchantProjectContext>;
}

export type TrustedAcceptedAiPublishingAuthority = Readonly<{
  receiptRepository: AcceptedSnapshotPublishReceiptRepository;
  currentAuthoritySource: AcceptedSnapshotCurrentAuthoritySource;
}>;

export type AuthoritativeMerchantPublishServiceInput = Readonly<{
  projectRepository: AuthoritativePublishingProjectRepository;
  publishingGateway: StorefrontPublishingGateway;
  authenticatedContext: AuthenticatedMerchantPublishContextSource;
  preparationStore: MerchantPublishPreparationStore;
  revisionMapper: AuthoritativePublishingRevisionMapper;
  acceptedAiAuthority?: TrustedAcceptedAiPublishingAuthority;
}>;

function assertAuthenticatedPublisher(context: MerchantProjectContext, projectId: string): void {
  if (context.storefrontProjectId !== projectId) {
    throw new AuthoritativeMerchantPublishError("project-mismatch");
  }
  if (!context.userId) throw new AuthoritativeMerchantPublishError("authentication-required");
  if (!context.permissions.includes("publishStorefront")) {
    throw new AuthoritativeMerchantPublishError("permission-denied");
  }
}

function preparationId(projectId: string, requestId: string): string {
  return `publish_preparation_${canonicalValueFingerprint({ projectId, requestId }).slice(-16)}`;
}

function requestFingerprint(input: z.infer<typeof merchantPublishPrepareRequestSchema>): string {
  return `merchant-publish-${canonicalValueFingerprint(input)}`;
}

function currentAuthorityForReceipt(receipt: {
  proposalId: string;
  proposalRevision: number;
  proposalFingerprint: string;
  reviewRevision: number;
  reviewFingerprint: string;
  acceptedRuntimeFingerprint: string;
  componentRegistryFingerprint: string;
  manifest: { version: string; fingerprint: string } | null;
  packageRegistry: { version: string; fingerprint: string } | null;
  profileAuthorities: readonly { profileId: string; fingerprint: string }[];
  commerceFingerprint: string;
  approvedAssetFingerprint: string | null;
}) {
  return {
    proposalId: receipt.proposalId,
    proposalRevision: receipt.proposalRevision,
    proposalFingerprint: receipt.proposalFingerprint,
    reviewRevision: receipt.reviewRevision,
    reviewFingerprint: receipt.reviewFingerprint,
    acceptedRuntimeFingerprint: receipt.acceptedRuntimeFingerprint,
    componentRegistryFingerprint: receipt.componentRegistryFingerprint,
    manifest: receipt.manifest,
    packageRegistry: receipt.packageRegistry,
    profileAuthorities: receipt.profileAuthorities,
    commerceFingerprint: receipt.commerceFingerprint,
    approvedAssetFingerprint: receipt.approvedAssetFingerprint,
  };
}

/**
 * Server-only orchestration around the existing StorefrontPublishingGateway.
 * It accepts only receipt identity from the browser and retains all gateway
 * expectations in trusted storage between review and confirmation.
 */
export class AuthoritativeMerchantPublishService {
  readonly #input: AuthoritativeMerchantPublishServiceInput;

  constructor(input: AuthoritativeMerchantPublishServiceInput) {
    this.#input = input;
  }

  async prepare(inputValue: unknown, request: Request): Promise<PublishPreparation> {
    const input = merchantPublishPrepareRequestSchema.safeParse(inputValue);
    if (!input.success) throw new AuthoritativeMerchantPublishError("invalid-request");
    const context = await this.#input.authenticatedContext.resolve({
      projectId: input.data.projectId,
      request,
    });
    assertAuthenticatedPublisher(context, input.data.projectId);

    const authority =
      input.data.authority.kind === "manual"
        ? { kind: "manual" as const }
        : this.#input.acceptedAiAuthority
          ? {
              kind: "accepted-ai" as const,
              receiptId: input.data.authority.receiptId,
              receiptRepository: this.#input.acceptedAiAuthority.receiptRepository,
              currentAuthoritySource: this.#input.acceptedAiAuthority.currentAuthoritySource,
            }
          : (() => {
              throw new AuthoritativeMerchantPublishError("accepted-ai-unavailable");
            })();
    const preparation = await preparePublish(input.data.projectId, this.#input.projectRepository, {
      authority,
      createPreparationId: ({ projectId }) => preparationId(projectId, input.data.requestId),
    });
    const gatewayRequest = publishStorefrontRequestSchema.parse({
      context,
      requestId: input.data.requestId,
      publishPreparationId: preparation.preparationId,
      expectedProjectRevision: context.projectRevision,
      expectedSavedDraft: {
        id: preparation.expectedDraft.id,
        revision: this.#input.revisionMapper.snapshotRevision(preparation.expectedDraft.revision),
        contentFingerprint: preparation.expectedDraft.contentFingerprint,
      },
      expectedPublished: {
        id: preparation.expectedPublished.id,
        revision: this.#input.revisionMapper.snapshotRevision(
          preparation.expectedPublished.revision,
        ),
        contentFingerprint: preparation.expectedPublished.contentFingerprint,
      },
    });
    const stored = await this.#input.preparationStore.createOrResolve({
      version: 1,
      projectId: input.data.projectId,
      requestId: input.data.requestId,
      requestFingerprint: requestFingerprint(input.data),
      preparation,
      gatewayRequest,
    });
    return structuredClone(stored.preparation);
  }

  async confirm(inputValue: unknown, request: Request): Promise<{ projectRevision: number }> {
    const input = merchantPublishConfirmRequestSchema.safeParse(inputValue);
    if (!input.success) throw new AuthoritativeMerchantPublishError("invalid-request");
    const context = await this.#input.authenticatedContext.resolve({
      projectId: input.data.projectId,
      request,
    });
    assertAuthenticatedPublisher(context, input.data.projectId);
    const record = await this.#input.preparationStore.load(input.data.preparationId);
    if (!record) throw new AuthoritativeMerchantPublishError("missing-preparation");
    if (record.projectId !== input.data.projectId || record.requestId !== input.data.requestId) {
      throw new AuthoritativeMerchantPublishError("project-mismatch");
    }
    await this.#input.publishingGateway.publish(record.gatewayRequest);
    const aggregate = await this.#input.projectRepository.get(input.data.projectId);
    return { projectRevision: aggregate.project.revision };
  }
}

export function acceptedSnapshotCurrentAuthorityFromReceipt(
  receipt: Parameters<
    AcceptedSnapshotCurrentAuthoritySource["resolveCurrentAuthority"]
  >[0]["receipt"],
) {
  return currentAuthorityForReceipt(receipt);
}
