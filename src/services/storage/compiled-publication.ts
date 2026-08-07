import { z } from "zod";
import {
  compiledPublicationResultSchema,
  publishCompileReceiptSchema,
  trustedPublishCompilationSchema,
  type TrustedPublishCompilation,
} from "@/application/publishing/publish-compiler";
import { idSchema, isoDateTimeSchema } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  publicationOperationIdentitySchema,
  publicationOperationKey,
  type PublicationOperationIdentity,
} from "./publication-operation";

export const compiledPublicationArtifactContractVersion = "1.0.0" as const;
export const publishedStorefrontVersionContractVersion = "1.0.0" as const;

const fingerprintSchema = z.string().trim().min(1).max(300);

export const storedPublicationAuthoritySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }).strict(),
  z
    .object({
      kind: z.literal("accepted-ai"),
      receiptId: idSchema,
      receiptFingerprint: fingerprintSchema,
      proposalId: idSchema,
      proposalRevision: z.number().int().nonnegative(),
      reviewRevision: z.number().int().nonnegative(),
      acceptedSnapshotId: idSchema,
      acceptedSnapshotFingerprint: fingerprintSchema,
    })
    .strict(),
]);

const artifactPayloadSchema = z
  .object({
    contractVersion: z.literal(compiledPublicationArtifactContractVersion),
    id: idSchema,
    projectId: idSchema,
    sourceSnapshot: z
      .object({
        id: idSchema,
        revision: z.number().int().nonnegative(),
        fingerprint: fingerprintSchema,
      })
      .strict(),
    compiledResult: compiledPublicationResultSchema,
    compileReceipt: publishCompileReceiptSchema,
    authority: storedPublicationAuthoritySchema,
    operation: publicationOperationIdentitySchema,
    operationKey: z.string().min(1),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const compiledPublicationArtifactSchema = artifactPayloadSchema
  .extend({ integrityFingerprint: fingerprintSchema })
  .strict()
  .superRefine((value, context) => {
    const { integrityFingerprint, ...payload } = value;
    if (integrityFingerprint !== canonicalValueFingerprint(payload)) {
      context.addIssue({
        code: "custom",
        path: ["integrityFingerprint"],
        message: "Artifact integrity fingerprint mismatch.",
      });
    }
    if (
      value.projectId !== value.compiledResult.projectId ||
      value.projectId !== value.compileReceipt.projectId ||
      value.projectId !== value.operation.storefrontProjectId ||
      value.operationKey !== publicationOperationKey(value.operation) ||
      value.sourceSnapshot.id !== value.compiledResult.sourceSnapshot.id ||
      value.sourceSnapshot.revision !== value.compiledResult.sourceSnapshot.revision ||
      value.sourceSnapshot.fingerprint !== value.compiledResult.sourceSnapshot.fingerprint ||
      value.compileReceipt.compiledResultFingerprint !== value.compiledResult.runtimeFingerprint
    ) {
      context.addIssue({
        code: "custom",
        message: "Artifact authority identities do not correlate.",
      });
    }
    if (
      (value.authority.kind === "manual" &&
        value.compileReceipt.sourceAuthorityKind !== "manual") ||
      (value.authority.kind === "accepted-ai" &&
        (value.compileReceipt.sourceAuthorityKind !== "accepted-ai" ||
          value.compileReceipt.acceptedReceiptId !== value.authority.receiptId ||
          value.compileReceipt.acceptedReceiptFingerprint !== value.authority.receiptFingerprint))
    ) {
      context.addIssue({
        code: "custom",
        path: ["authority"],
        message: "Publication authority lineage mismatch.",
      });
    }
  });

const versionPayloadSchema = z
  .object({
    contractVersion: z.literal(publishedStorefrontVersionContractVersion),
    id: idSchema,
    projectId: idSchema,
    sequence: z.number().int().positive(),
    predecessorVersionId: idSchema.nullable(),
    publishedSnapshot: z
      .object({
        id: idSchema,
        revision: z.number().int().nonnegative(),
        fingerprint: fingerprintSchema,
      })
      .strict(),
    artifactId: idSchema,
    artifactFingerprint: fingerprintSchema,
    compileReceiptId: idSchema,
    compileReceiptFingerprint: fingerprintSchema,
    authority: storedPublicationAuthoritySchema,
    operationKey: z.string().min(1),
    createdAt: isoDateTimeSchema,
    publishedAt: isoDateTimeSchema,
  })
  .strict();

export const publishedStorefrontVersionSchema = versionPayloadSchema
  .extend({ integrityFingerprint: fingerprintSchema })
  .strict()
  .superRefine((value, context) => {
    const { integrityFingerprint, ...payload } = value;
    if (integrityFingerprint !== canonicalValueFingerprint(payload)) {
      context.addIssue({
        code: "custom",
        path: ["integrityFingerprint"],
        message: "Published version integrity fingerprint mismatch.",
      });
    }
  });

export const activePublishedStorefrontPointerSchema = z
  .object({
    projectId: idSchema,
    versionId: idSchema,
    versionFingerprint: fingerprintSchema,
    artifactId: idSchema,
    artifactFingerprint: fingerprintSchema,
    publishedSnapshotId: idSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type StoredPublicationAuthority = z.infer<typeof storedPublicationAuthoritySchema>;
export type CompiledPublicationArtifact = z.infer<typeof compiledPublicationArtifactSchema>;
export type PublishedStorefrontVersion = z.infer<typeof publishedStorefrontVersionSchema>;
export type ActivePublishedStorefrontPointer = z.infer<
  typeof activePublishedStorefrontPointerSchema
>;

export type AtomicCompiledPublicationWrite = Readonly<{
  compilation: TrustedPublishCompilation;
  authority: StoredPublicationAuthority;
  operation: PublicationOperationIdentity;
  expectedActiveVersionId: string | null;
}>;

export type ActiveCompiledPublication = Readonly<{
  pointer: ActivePublishedStorefrontPointer;
  version: PublishedStorefrontVersion;
  artifact: CompiledPublicationArtifact;
  publishedSnapshot: StorefrontSnapshot;
}>;

export type AtomicPublicationFailurePoint = "artifact" | "version" | "pointer";

export class CompiledPublicationIntegrityError extends Error {
  readonly code = "COMPILED_PUBLICATION_INTEGRITY_FAILED";
  constructor(options?: ErrorOptions) {
    super("Stored compiled publication state failed integrity validation.", options);
    this.name = "CompiledPublicationIntegrityError";
  }
}

export class ActivePublicationConflictError extends Error {
  readonly code = "ACTIVE_PUBLICATION_CONFLICT";
  constructor(
    readonly expectedVersionId: string | null,
    readonly actualVersionId: string | null,
  ) {
    super("The active published storefront version changed before publication committed.");
    this.name = "ActivePublicationConflictError";
  }
}

export function parseCompiledPublicationArtifact(value: unknown): CompiledPublicationArtifact {
  const parsed = compiledPublicationArtifactSchema.safeParse(value);
  if (!parsed.success) throw new CompiledPublicationIntegrityError({ cause: parsed.error });
  return parsed.data;
}

export function parsePublishedStorefrontVersion(value: unknown): PublishedStorefrontVersion {
  const parsed = publishedStorefrontVersionSchema.safeParse(value);
  if (!parsed.success) throw new CompiledPublicationIntegrityError({ cause: parsed.error });
  return parsed.data;
}

export function parseActivePublishedStorefrontPointer(
  value: unknown,
): ActivePublishedStorefrontPointer {
  const parsed = activePublishedStorefrontPointerSchema.safeParse(value);
  if (!parsed.success) throw new CompiledPublicationIntegrityError({ cause: parsed.error });
  return parsed.data;
}

export function assertPublishedStorefrontVersionIntegrity(
  versionValue: unknown,
  artifactValue: unknown,
  snapshot: StorefrontSnapshot,
): void {
  const version = parsePublishedStorefrontVersion(versionValue);
  const artifact = parseCompiledPublicationArtifact(artifactValue);
  if (
    version.projectId !== artifact.projectId ||
    version.projectId !== snapshot.projectId ||
    version.artifactId !== artifact.id ||
    version.artifactFingerprint !== artifact.integrityFingerprint ||
    version.compileReceiptId !== artifact.compileReceipt.id ||
    version.compileReceiptFingerprint !== artifact.compileReceipt.fingerprint ||
    version.operationKey !== artifact.operationKey ||
    version.publishedSnapshot.id !== snapshot.id ||
    version.publishedSnapshot.revision !== snapshot.revision ||
    version.publishedSnapshot.fingerprint !== canonicalStorefrontContentFingerprint(snapshot)
  ) {
    throw new CompiledPublicationIntegrityError();
  }
}

export function parseAtomicCompiledPublicationWrite(
  value: unknown,
): AtomicCompiledPublicationWrite {
  if (!value || typeof value !== "object") throw new CompiledPublicationIntegrityError();
  const candidate = value as AtomicCompiledPublicationWrite;
  const compilation = trustedPublishCompilationSchema.safeParse(candidate.compilation);
  const authority = storedPublicationAuthoritySchema.safeParse(candidate.authority);
  const operation = publicationOperationIdentitySchema.safeParse({
    tenantId: candidate.operation?.tenantId,
    merchantId: candidate.operation?.merchantId,
    organizationId: candidate.operation?.organizationId,
    storeId: candidate.operation?.storeId,
    storefrontProjectId: candidate.operation?.storefrontProjectId,
    operationType: candidate.operation?.operationType,
    requestId: candidate.operation?.requestId,
  });
  if (
    !compilation.success ||
    !authority.success ||
    !operation.success ||
    !(
      candidate.expectedActiveVersionId === null ||
      idSchema.safeParse(candidate.expectedActiveVersionId).success
    )
  ) {
    throw new CompiledPublicationIntegrityError();
  }
  return {
    compilation: compilation.data,
    authority: authority.data,
    operation: operation.data,
    expectedActiveVersionId: candidate.expectedActiveVersionId,
  };
}

function recordId(prefix: string, value: unknown): string {
  return `${prefix}_${canonicalValueFingerprint(value).slice(-24)}`;
}

export function createAtomicCompiledPublicationRecords(
  input: Readonly<{
    write: AtomicCompiledPublicationWrite;
    publishedSnapshot: StorefrontSnapshot;
    predecessorVersionId: string | null;
    sequence: number;
    createdAt: string;
  }>,
): Readonly<{
  artifact: CompiledPublicationArtifact;
  version: PublishedStorefrontVersion;
  pointer: ActivePublishedStorefrontPointer;
}> {
  const write = parseAtomicCompiledPublicationWrite(input.write);
  const snapshotFingerprint = canonicalValueFingerprint({
    brandSystem: input.publishedSnapshot.brandSystem,
    navigation: input.publishedSnapshot.navigation,
    pages: input.publishedSnapshot.pages,
    catalogueRef: input.publishedSnapshot.catalogueRef,
  });
  if (
    write.compilation.result.sourceSnapshot.fingerprint !== snapshotFingerprint ||
    write.compilation.receipt.sourceSnapshotFingerprint !== snapshotFingerprint
  )
    throw new CompiledPublicationIntegrityError();
  const operationKey = publicationOperationKey(write.operation);
  const artifactId = recordId("compiled_artifact", {
    operationKey,
    receipt: write.compilation.receipt.fingerprint,
    result: write.compilation.result.runtimeFingerprint,
  });
  const artifactPayload = artifactPayloadSchema.parse({
    contractVersion: compiledPublicationArtifactContractVersion,
    id: artifactId,
    projectId: input.publishedSnapshot.projectId,
    sourceSnapshot: write.compilation.result.sourceSnapshot,
    compiledResult: write.compilation.result,
    compileReceipt: write.compilation.receipt,
    authority: write.authority,
    operation: write.operation,
    operationKey,
    createdAt: input.createdAt,
  });
  const artifact = parseCompiledPublicationArtifact({
    ...artifactPayload,
    integrityFingerprint: canonicalValueFingerprint(artifactPayload),
  });
  const versionId = recordId("published_version", {
    projectId: input.publishedSnapshot.projectId,
    operationKey,
    sequence: input.sequence,
    artifactId,
  });
  const versionPayload = versionPayloadSchema.parse({
    contractVersion: publishedStorefrontVersionContractVersion,
    id: versionId,
    projectId: input.publishedSnapshot.projectId,
    sequence: input.sequence,
    predecessorVersionId: input.predecessorVersionId,
    publishedSnapshot: {
      id: input.publishedSnapshot.id,
      revision: input.publishedSnapshot.revision,
      fingerprint: snapshotFingerprint,
    },
    artifactId,
    artifactFingerprint: artifact.integrityFingerprint,
    compileReceiptId: artifact.compileReceipt.id,
    compileReceiptFingerprint: artifact.compileReceipt.fingerprint,
    authority: write.authority,
    operationKey,
    createdAt: input.createdAt,
    publishedAt: input.createdAt,
  });
  const version = parsePublishedStorefrontVersion({
    ...versionPayload,
    integrityFingerprint: canonicalValueFingerprint(versionPayload),
  });
  const pointer = parseActivePublishedStorefrontPointer({
    projectId: version.projectId,
    versionId: version.id,
    versionFingerprint: version.integrityFingerprint,
    artifactId: artifact.id,
    artifactFingerprint: artifact.integrityFingerprint,
    publishedSnapshotId: input.publishedSnapshot.id,
    updatedAt: input.createdAt,
  });
  return { artifact, version, pointer };
}
