import { z } from "zod";
import { idSchema, isoDateTimeSchema, localizedTextSchema } from "@/domain/shared";
import { snapshotHistoryReasonSchema } from "@/services/storage/snapshot-history-metadata";

const snapshotExpectationSchema = z
  .object({
    id: idSchema,
    revision: z.number().int().nonnegative(),
    contentFingerprint: z.string().regex(/^v1_\d+_[0-9a-f]{64}$/),
  })
  .strict();

export const historyEntrySchema = z
  .object({
    snapshotId: idSchema,
    createdAt: isoDateTimeSchema,
    authorRole: z.enum(["user", "agent", "system"]).optional(),
    kind: z.enum(["currentPublished", "currentDraft", "previousVersion"]),
    pageCount: z.number().int().nonnegative(),
    reason: snapshotHistoryReasonSchema.optional(),
    summary: localizedTextSchema.optional(),
  })
  .strict();

export const restorePreparationSchema = z
  .object({
    preparationId: idSchema,
    projectId: idSchema,
    preparedAt: isoDateTimeSchema,
    target: snapshotExpectationSchema,
    expectedProjectRevision: z.number().int().nonnegative(),
    expectedDraft: snapshotExpectationSchema,
    expectedPublished: snapshotExpectationSchema,
  })
  .strict();

export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type RestorePreparation = z.infer<typeof restorePreparationSchema>;

export class HistoryReadError extends Error {
  readonly code = "HISTORY_READ_FAILED";
  constructor(options?: ErrorOptions) {
    super("The storefront history could not be read.", options);
    this.name = "HistoryReadError";
  }
}
export class InvalidRestorePreparationError extends Error {
  readonly code = "INVALID_RESTORE_PREPARATION";
  constructor(options?: ErrorOptions) {
    super("The restore preparation is invalid.", options);
    this.name = "InvalidRestorePreparationError";
  }
}
export class RestorePreparationError extends Error {
  readonly code = "RESTORE_PREPARATION_FAILED";
  constructor(options?: ErrorOptions) {
    super("The selected version could not be prepared for restore.", options);
    this.name = "RestorePreparationError";
  }
}
export class StaleRestorePreparationError extends Error {
  readonly code = "STALE_RESTORE_PREPARATION";
  constructor() {
    super("The saved draft changed after restore was prepared.");
    this.name = "StaleRestorePreparationError";
  }
}
export class RestoreConfirmationError extends Error {
  readonly code = "RESTORE_CONFIRMATION_FAILED";
  constructor(options?: ErrorOptions) {
    super("The previous version could not be restored.", options);
    this.name = "RestoreConfirmationError";
  }
}
