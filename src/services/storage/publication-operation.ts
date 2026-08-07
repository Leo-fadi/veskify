import { z } from "zod";
import { idSchema } from "@/domain/shared";

export const publicationOperationIdentitySchema = z
  .object({
    tenantId: idSchema,
    merchantId: idSchema,
    organizationId: idSchema,
    storeId: idSchema,
    storefrontProjectId: idSchema,
    operationType: z.literal("publish"),
    requestId: idSchema,
  })
  .strict();

export const storedPublicationResultSchema = z
  .object({
    requestId: idSchema,
    storefrontProjectId: idSchema,
    publishedRevision: z.string().trim().min(1).max(160),
    status: z.literal("published"),
  })
  .strict();

const publicationOperationWriteObjectSchema = publicationOperationIdentitySchema
  .extend({
    requestFingerprint: z.string().min(1),
    result: storedPublicationResultSchema,
  })
  .strict();

function refinePublicationResultIdentity(
  value: z.infer<typeof publicationOperationWriteObjectSchema>,
  context: z.RefinementCtx,
): void {
  if (value.result.requestId !== value.requestId) {
    context.addIssue({
      code: "custom",
      path: ["result", "requestId"],
      message: "Publication result request identity must match its operation.",
    });
  }
  if (value.result.storefrontProjectId !== value.storefrontProjectId) {
    context.addIssue({
      code: "custom",
      path: ["result", "storefrontProjectId"],
      message: "Publication result project identity must match its operation.",
    });
  }
}

export const publicationOperationWriteSchema = publicationOperationWriteObjectSchema.superRefine(
  refinePublicationResultIdentity,
);

export const publicationOperationRecordSchema = publicationOperationWriteObjectSchema
  .extend({
    operationKey: z.string().min(1),
    committedProjectRevision: z.number().int().nonnegative(),
    publishedSnapshotId: idSchema,
    publishedVersionId: idSchema.optional(),
    compiledArtifactId: idSchema.optional(),
  })
  .strict()
  .superRefine(refinePublicationResultIdentity);

export type PublicationOperationIdentity = z.infer<typeof publicationOperationIdentitySchema>;
export type PublicationOperationWrite = z.infer<typeof publicationOperationWriteSchema>;
export type PublicationOperationRecord = z.infer<typeof publicationOperationRecordSchema>;

export class PublicationOperationValidationError extends Error {
  readonly code = "PUBLICATION_OPERATION_VALIDATION_FAILED";

  constructor(options?: ErrorOptions) {
    super("Stored publication operation state is invalid.", options);
    this.name = "PublicationOperationValidationError";
  }
}

export function parsePublicationOperationWrite(input: unknown): PublicationOperationWrite {
  const parsed = publicationOperationWriteSchema.safeParse(input);
  if (!parsed.success) {
    throw new PublicationOperationValidationError({ cause: parsed.error });
  }
  return parsed.data;
}

export function parsePublicationOperationRecord(input: unknown): PublicationOperationRecord {
  const parsed = publicationOperationRecordSchema.safeParse(input);
  if (!parsed.success) {
    throw new PublicationOperationValidationError({ cause: parsed.error });
  }
  return parsed.data;
}

export function publicationOperationKey(input: PublicationOperationIdentity): string {
  const identity = publicationOperationIdentitySchema.parse({
    tenantId: input.tenantId,
    merchantId: input.merchantId,
    organizationId: input.organizationId,
    storeId: input.storeId,
    storefrontProjectId: input.storefrontProjectId,
    operationType: input.operationType,
    requestId: input.requestId,
  });
  return JSON.stringify([
    identity.tenantId,
    identity.merchantId,
    identity.organizationId,
    identity.storeId,
    identity.storefrontProjectId,
    identity.operationType,
    identity.requestId,
  ]);
}

export function completePublicationOperation(
  input: PublicationOperationWrite,
  committedProjectRevision: number,
  publishedSnapshotId: string,
  compiledPublication?: Readonly<{
    publishedVersionId: string;
    compiledArtifactId: string;
  }>,
): PublicationOperationRecord {
  const operation = parsePublicationOperationWrite(input);
  return parsePublicationOperationRecord({
    ...operation,
    operationKey: publicationOperationKey(operation),
    committedProjectRevision,
    publishedSnapshotId,
    ...compiledPublication,
  });
}

export class PublicationOperationAlreadyCompletedError extends Error {
  readonly code = "PUBLICATION_OPERATION_ALREADY_COMPLETED";

  constructor(readonly operationKey: string) {
    super("The scoped publication operation has already completed.");
    this.name = "PublicationOperationAlreadyCompletedError";
  }
}

export class PublicationOperationConflictError extends Error {
  readonly code = "PUBLICATION_OPERATION_CONFLICT";

  constructor(readonly operationKey: string) {
    super("The scoped publication operation was reused with different preconditions.");
    this.name = "PublicationOperationConflictError";
  }
}
