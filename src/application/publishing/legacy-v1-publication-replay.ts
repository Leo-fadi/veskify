import { z } from "zod";

import {
  parseLegacyV1HistoricalSnapshotReadReceipt,
  type LegacyV1HistoricalSnapshotReadResultV1,
} from "@/application/bounded-storefront-synthesis/legacy-v1-historical-snapshot-replay";
import { idSchema } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  pageFactEvidenceReferenceSchema,
  type PageFactEvidenceReference,
} from "@/domain/storefront";
import type { ProjectAggregate } from "@/services/storage/project-repository";
import { validateProjectAggregate } from "@/services/storage/repository-validation";

import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
  PublishCompilerError,
  publishCompilerContractVersion,
  publishCompilerVersion,
  trustedPublishCompilationSchema,
  type TrustedPublishCompilation,
} from "./publish-compiler";

export const LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_RECEIPT_SCHEMA_VERSION = "1.0.0" as const;
export const LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_AUTHORITY_KIND =
  "legacy-v1-historical-publication-replay" as const;

export const legacyV1HistoricalPublicationReplayErrorCodes = [
  "invalid-legacy-v1-publication-replay-input",
  "legacy-v1-publication-source-mismatch",
  "legacy-v1-publication-compiler-failure",
  "legacy-v1-publication-migration-unresolved",
  "stale-legacy-v1-publication-replay-receipt",
] as const;

export type LegacyV1HistoricalPublicationReplayErrorCode =
  (typeof legacyV1HistoricalPublicationReplayErrorCodes)[number];

const errorMessages: Readonly<Record<LegacyV1HistoricalPublicationReplayErrorCode, string>> = {
  "invalid-legacy-v1-publication-replay-input":
    "The historical legacy-v1 publication replay input is invalid.",
  "legacy-v1-publication-source-mismatch":
    "The historical legacy-v1 publication source does not match canonical authority.",
  "legacy-v1-publication-compiler-failure":
    "The historical legacy-v1 publication source could not be compiled.",
  "legacy-v1-publication-migration-unresolved":
    "The historical legacy-v1 publication source requires an unresolved migration.",
  "stale-legacy-v1-publication-replay-receipt":
    "The historical legacy-v1 publication replay receipt is stale.",
};

export class LegacyV1HistoricalPublicationReplayError extends Error {
  readonly safeIdentifiers: readonly string[];

  constructor(
    readonly code: LegacyV1HistoricalPublicationReplayErrorCode,
    safeIdentifiers: readonly string[] = [],
  ) {
    super(errorMessages[code]);
    this.name = "LegacyV1HistoricalPublicationReplayError";
    this.safeIdentifiers = Object.freeze([...safeIdentifiers]);
  }
}

type DeepReadonly<Value> = Value extends (...arguments_: never[]) => unknown
  ? Value
  : Value extends readonly (infer Entry)[]
    ? readonly DeepReadonly<Entry>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): DeepReadonly<Value> {
  if (value === null || typeof value !== "object") return value as DeepReadonly<Value>;
  const object = value as object;
  if (seen.has(object)) return value as DeepReadonly<Value>;
  seen.add(object);
  Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry, seen));
  Object.freeze(object);
  return value as DeepReadonly<Value>;
}

const canonicalFingerprintSchema = z.string().regex(/^v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const historicalReadReceiptFingerprintSchema = z
  .string()
  .regex(/^legacy-v1-historical-snapshot-read-v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const replayReferenceFingerprintSchema = z
  .string()
  .regex(/^legacy-v1-storefront-replay-reference-v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const compiledRuntimeFingerprintSchema = z
  .string()
  .regex(/^compiled-publication-v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const validationReportFingerprintSchema = z
  .string()
  .regex(/^publish-validation-v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const compileReceiptFingerprintSchema = z
  .string()
  .regex(/^publish-compile-receipt-v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const migrationFingerprintSchema = z
  .string()
  .regex(/^publish-migrations-v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const replayReceiptFingerprintSchema = z
  .string()
  .regex(/^legacy-v1-historical-publication-replay-v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const canonicalIdentifierSchema = z.string().refine((value) => {
  const parsed = idSchema.safeParse(value);
  return parsed.success && parsed.data === value;
});
const validatedReplayAliasIdentifierSchema = z.string().regex(/^legacy-v1:[a-z][a-z0-9-]{0,79}$/);

const replayBindingSchema = z
  .object({
    // Alias membership is established only by the parsed A-09B receipt. This
    // bounded projection deliberately does not duplicate or import A-09A's
    // registry authority.
    aliasId: validatedReplayAliasIdentifierSchema,
    replayReferenceFingerprint: replayReferenceFingerprintSchema,
  })
  .strict();

const sourceSnapshotSchema = z
  .object({
    snapshotId: canonicalIdentifierSchema,
    projectId: canonicalIdentifierSchema,
    revision: z.number().int().nonnegative(),
    catalogueRef: canonicalIdentifierSchema,
    canonicalSnapshotFingerprint: canonicalFingerprintSchema,
  })
  .strict();

const compilerAuthoritySchema = z
  .object({
    publishCompilerContractVersion: z.literal(publishCompilerContractVersion),
    publishCompilerVersion: z.literal(publishCompilerVersion),
    sourceAuthorityKind: z.literal("manual"),
    rendererTarget: z.literal("published"),
    compiledRuntimeFingerprint: compiledRuntimeFingerprintSchema,
    validationReportFingerprint: validationReportFingerprintSchema,
    compileReceiptFingerprint: compileReceiptFingerprintSchema,
    migrationStatus: z.literal("current"),
    migrationFingerprint: migrationFingerprintSchema,
  })
  .strict();

const replayReceiptRecordSchema = z
  .object({
    receiptSchemaVersion: z.literal(LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_RECEIPT_SCHEMA_VERSION),
    authorityKind: z.literal(LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_AUTHORITY_KIND),
    historicalReadReceiptFingerprint: historicalReadReceiptFingerprintSchema,
    readDisposition: z.enum(["readable-unattributed", "readable-explicit-replay-binding"]),
    replayBinding: replayBindingSchema.nullable(),
    sourceSnapshot: sourceSnapshotSchema,
    compilerAuthority: compilerAuthoritySchema,
    receiptFingerprint: replayReceiptFingerprintSchema,
  })
  .strict()
  .superRefine((receipt, context) => {
    if (
      (receipt.replayBinding === null) !==
      (receipt.readDisposition === "readable-unattributed")
    ) {
      context.addIssue({ code: "custom", message: "Receipt disposition and binding disagree." });
    }
  });

type ReceiptRecord = z.infer<typeof replayReceiptRecordSchema>;

export type LegacyV1HistoricalPublicationReplayInput = DeepReadonly<{
  aggregate: ProjectAggregate;
  historicalReadResult: LegacyV1HistoricalSnapshotReadResultV1;
  currentEvidenceReferences: readonly PageFactEvidenceReference[];
}>;

export type LegacyV1HistoricalPublicationReplayReceiptV1 = DeepReadonly<ReceiptRecord>;
export type LegacyV1HistoricalPublicationReplayResultV1 = DeepReadonly<{
  compilation: TrustedPublishCompilation;
  receipt: ReceiptRecord;
}>;

const replayInputEnvelopeSchema = z
  .object({
    aggregate: z
      .object({
        project: z.unknown(),
        catalogue: z.unknown(),
        snapshots: z.array(z.unknown()),
        snapshotHistoryMetadata: z.array(z.unknown()).optional(),
      })
      .strict(),
    historicalReadResult: z.object({ snapshot: z.unknown(), receipt: z.unknown() }).strict(),
    currentEvidenceReferences: z.array(pageFactEvidenceReferenceSchema),
  })
  .strict();

const replayResultEnvelopeSchema = z
  .object({
    compilation: trustedPublishCompilationSchema,
    receipt: replayReceiptRecordSchema,
  })
  .strict();

function cloneUnknown(input: unknown): unknown {
  try {
    return structuredClone(input);
  } catch {
    throw new LegacyV1HistoricalPublicationReplayError(
      "invalid-legacy-v1-publication-replay-input",
    );
  }
}

function canonicalExactEqual(left: unknown, right: unknown): boolean {
  try {
    return canonicalValueString(left) === canonicalValueString(right);
  } catch {
    return false;
  }
}

function receiptFingerprint(material: Omit<ReceiptRecord, "receiptFingerprint">): string {
  return `legacy-v1-historical-publication-replay-${canonicalValueFingerprint(material)}`;
}

function staleReceipt(safeIdentifiers: readonly string[] = []): never {
  throw new LegacyV1HistoricalPublicationReplayError(
    "stale-legacy-v1-publication-replay-receipt",
    safeIdentifiers,
  );
}

export function parseLegacyV1HistoricalPublicationReplayReceipt(
  input: unknown,
): LegacyV1HistoricalPublicationReplayReceiptV1 {
  let cloned: unknown;
  try {
    cloned = structuredClone(input);
  } catch {
    staleReceipt();
  }
  const parsed = replayReceiptRecordSchema.safeParse(cloned);
  if (!parsed.success || !canonicalExactEqual(cloned, parsed.data)) staleReceipt();
  const { receiptFingerprint: suppliedFingerprint, ...material } = parsed.data;
  if (suppliedFingerprint !== receiptFingerprint(material)) {
    staleReceipt([
      parsed.data.sourceSnapshot.snapshotId,
      String(parsed.data.sourceSnapshot.revision),
      parsed.data.historicalReadReceiptFingerprint,
      parsed.data.compilerAuthority.compileReceiptFingerprint,
    ]);
  }
  return deepFreeze(structuredClone(parsed.data));
}

function validatedReplayInput(input: unknown): Readonly<{
  aggregate: ProjectAggregate;
  historicalReadResult: LegacyV1HistoricalSnapshotReadResultV1;
  currentEvidenceReferences: readonly PageFactEvidenceReference[];
}> {
  const cloned = cloneUnknown(input);
  const envelope = replayInputEnvelopeSchema.safeParse(cloned);
  if (!envelope.success) {
    throw new LegacyV1HistoricalPublicationReplayError(
      "invalid-legacy-v1-publication-replay-input",
    );
  }

  let aggregate: ProjectAggregate;
  let readReceipt: ReturnType<typeof parseLegacyV1HistoricalSnapshotReadReceipt>;
  try {
    aggregate = validateProjectAggregate(envelope.data.aggregate as ProjectAggregate);
    readReceipt = parseLegacyV1HistoricalSnapshotReadReceipt(
      envelope.data.historicalReadResult.receipt,
    );
  } catch {
    throw new LegacyV1HistoricalPublicationReplayError(
      "invalid-legacy-v1-publication-replay-input",
    );
  }
  if (
    !canonicalExactEqual(envelope.data.aggregate, aggregate) ||
    !canonicalExactEqual(
      (cloned as { currentEvidenceReferences: unknown }).currentEvidenceReferences,
      envelope.data.currentEvidenceReferences,
    )
  ) {
    throw new LegacyV1HistoricalPublicationReplayError(
      "invalid-legacy-v1-publication-replay-input",
    );
  }

  const snapshot = envelope.data.historicalReadResult.snapshot;
  const source = readReceipt.sourceSnapshot;
  const aggregateSnapshot = aggregate.snapshots.find(({ id }) => id === source.snapshotId);
  const sourceFingerprint =
    aggregateSnapshot && canonicalStorefrontContentFingerprint(aggregateSnapshot);
  if (
    !aggregateSnapshot ||
    aggregate.project.id !== source.projectId ||
    aggregate.catalogue.id !== source.catalogueRef ||
    aggregateSnapshot.id !== source.snapshotId ||
    aggregateSnapshot.projectId !== source.projectId ||
    aggregateSnapshot.revision !== source.revision ||
    aggregateSnapshot.catalogueRef !== source.catalogueRef ||
    sourceFingerprint !== source.canonicalSnapshotFingerprint ||
    !canonicalExactEqual(snapshot, aggregateSnapshot)
  ) {
    throw new LegacyV1HistoricalPublicationReplayError("legacy-v1-publication-source-mismatch", [
      ...(readReceipt.replayBinding ? [readReceipt.replayBinding.aliasId] : []),
      source.snapshotId,
      String(source.revision),
      readReceipt.receiptFingerprint,
    ]);
  }

  return {
    aggregate,
    historicalReadResult: deepFreeze({
      snapshot: structuredClone(aggregateSnapshot),
      receipt: structuredClone(readReceipt),
    }),
    currentEvidenceReferences: envelope.data.currentEvidenceReferences,
  };
}

function transientHistoricalDraftAggregate(
  aggregate: ProjectAggregate,
  sourceSnapshotId: string,
): ProjectAggregate {
  const transient = structuredClone(aggregate);
  transient.project.draftSnapshotId = sourceSnapshotId;
  try {
    return validateProjectAggregate(transient);
  } catch {
    throw new LegacyV1HistoricalPublicationReplayError(
      "invalid-legacy-v1-publication-replay-input",
      [sourceSnapshotId],
    );
  }
}

function compileCurrentAuthority(
  input: ReturnType<typeof validatedReplayInput>,
): TrustedPublishCompilation {
  const snapshot = input.historicalReadResult.snapshot;
  const transientAggregate = transientHistoricalDraftAggregate(input.aggregate, snapshot.id);
  try {
    const compilerInput = createCurrentPublishCompilerInput({
      aggregate: transientAggregate,
      snapshot: snapshot as never,
      sourceAuthority: { kind: "manual" },
      currentEvidenceReferences: input.currentEvidenceReferences,
    });
    return compileStorefrontPublication(compilerInput);
  } catch (error) {
    if (error instanceof PublishCompilerError && error.code === "unresolved-migration") {
      throw new LegacyV1HistoricalPublicationReplayError(
        "legacy-v1-publication-migration-unresolved",
        [snapshot.id, String(snapshot.revision)],
      );
    }
    throw new LegacyV1HistoricalPublicationReplayError("legacy-v1-publication-compiler-failure", [
      snapshot.id,
      String(snapshot.revision),
    ]);
  }
}

export function compileLegacyV1HistoricalPublicationReplay(
  input: unknown,
): LegacyV1HistoricalPublicationReplayResultV1 {
  const validated = validatedReplayInput(input);
  const compilation = compileCurrentAuthority(validated);
  const readReceipt = validated.historicalReadResult.receipt;
  if (
    compilation.receipt.sourceAuthorityKind !== "manual" ||
    compilation.result.rendererTarget !== "published" ||
    compilation.receipt.migrationStatus !== "current" ||
    compilation.result.sourceSnapshot.id !== readReceipt.sourceSnapshot.snapshotId ||
    compilation.result.sourceSnapshot.revision !== readReceipt.sourceSnapshot.revision ||
    compilation.result.sourceSnapshot.fingerprint !==
      readReceipt.sourceSnapshot.canonicalSnapshotFingerprint ||
    compilation.receipt.sourceSnapshotId !== readReceipt.sourceSnapshot.snapshotId ||
    compilation.receipt.sourceSnapshotRevision !== readReceipt.sourceSnapshot.revision ||
    compilation.receipt.sourceSnapshotFingerprint !==
      readReceipt.sourceSnapshot.canonicalSnapshotFingerprint
  ) {
    throw new LegacyV1HistoricalPublicationReplayError("legacy-v1-publication-compiler-failure", [
      ...(readReceipt.replayBinding ? [readReceipt.replayBinding.aliasId] : []),
      readReceipt.sourceSnapshot.snapshotId,
      String(readReceipt.sourceSnapshot.revision),
      readReceipt.receiptFingerprint,
      compilation.receipt.fingerprint,
    ]);
  }
  const material = {
    receiptSchemaVersion: LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_RECEIPT_SCHEMA_VERSION,
    authorityKind: LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_AUTHORITY_KIND,
    historicalReadReceiptFingerprint: readReceipt.receiptFingerprint,
    readDisposition: readReceipt.readDisposition,
    replayBinding: readReceipt.replayBinding
      ? {
          aliasId: readReceipt.replayBinding.aliasId,
          replayReferenceFingerprint: readReceipt.replayBinding.replayReferenceFingerprint,
        }
      : null,
    sourceSnapshot: {
      snapshotId: readReceipt.sourceSnapshot.snapshotId,
      projectId: readReceipt.sourceSnapshot.projectId,
      revision: readReceipt.sourceSnapshot.revision,
      catalogueRef: readReceipt.sourceSnapshot.catalogueRef,
      canonicalSnapshotFingerprint: readReceipt.sourceSnapshot.canonicalSnapshotFingerprint,
    },
    compilerAuthority: {
      publishCompilerContractVersion: compilation.result.contractVersion,
      publishCompilerVersion: compilation.result.compilerVersion,
      sourceAuthorityKind: "manual",
      rendererTarget: "published",
      compiledRuntimeFingerprint: compilation.result.runtimeFingerprint,
      validationReportFingerprint: compilation.result.validationReportFingerprint,
      compileReceiptFingerprint: compilation.receipt.fingerprint,
      migrationStatus: "current",
      migrationFingerprint: compilation.receipt.migrationFingerprint,
    },
  } satisfies Omit<ReceiptRecord, "receiptFingerprint">;
  const receipt = parseLegacyV1HistoricalPublicationReplayReceipt({
    ...material,
    receiptFingerprint: receiptFingerprint(material),
  });
  return deepFreeze({ compilation, receipt });
}

export function assertLegacyV1HistoricalPublicationReplayCurrent(
  input: unknown,
  suppliedResult: unknown,
): LegacyV1HistoricalPublicationReplayResultV1 {
  let clonedResult: unknown;
  try {
    clonedResult = structuredClone(suppliedResult);
  } catch {
    staleReceipt();
  }
  const parsedResult = replayResultEnvelopeSchema.safeParse(clonedResult);
  if (!parsedResult.success || !canonicalExactEqual(clonedResult, parsedResult.data))
    staleReceipt();
  const suppliedReceipt = parseLegacyV1HistoricalPublicationReplayReceipt(
    parsedResult.data.receipt,
  );
  const current = compileLegacyV1HistoricalPublicationReplay(input);
  if (
    suppliedReceipt.receiptFingerprint !== current.receipt.receiptFingerprint ||
    parsedResult.data.compilation.result.runtimeFingerprint !==
      current.compilation.result.runtimeFingerprint ||
    parsedResult.data.compilation.result.validationReportFingerprint !==
      current.compilation.result.validationReportFingerprint ||
    parsedResult.data.compilation.receipt.fingerprint !== current.compilation.receipt.fingerprint ||
    canonicalValueString(parsedResult.data.compilation) !==
      canonicalValueString(current.compilation) ||
    canonicalValueString(suppliedReceipt) !== canonicalValueString(current.receipt)
  ) {
    staleReceipt([
      current.receipt.sourceSnapshot.snapshotId,
      String(current.receipt.sourceSnapshot.revision),
      suppliedReceipt.historicalReadReceiptFingerprint,
      parsedResult.data.compilation.receipt.fingerprint,
    ]);
  }
  return current;
}
