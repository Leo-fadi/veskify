import { z } from "zod";

import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";

import {
  boundedStorefrontSynthesisExactSelectionSchema,
  boundedStorefrontSynthesisSelectionNarrowingSchema,
  type BoundedStorefrontSynthesisExactSelection,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "./contract";
import {
  COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
  CoordinatedStorefrontDirectionError,
  coordinatedStorefrontDirectionIdSchema,
  type CoordinatedStorefrontDirectionId,
} from "./direction-contract";
import {
  getCoordinatedStorefrontDirection,
  validateDirectionSelectionNarrowing,
} from "./direction-registry";

export const LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_SCHEMA_VERSION = "1.0.0" as const;
export const LEGACY_V1_COORDINATED_DIRECTION_REPLAY_AUTHORITY_KIND =
  "legacy-v1-coordinated-direction" as const;
export const LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_REGISTRY_SCHEMA_VERSION =
  "1.0.0" as const;
export const LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_SCHEMA_VERSION = "1.0.0" as const;
export const LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_AUTHORITY_KIND =
  "legacy-v1-coordinated-direction-selection" as const;

const aliasMappings = [
  { aliasId: "legacy-v1:premium-editorial", coordinatedDirectionId: "premium-editorial" },
  { aliasId: "legacy-v1:modern-technical", coordinatedDirectionId: "modern-technical" },
  { aliasId: "legacy-v1:minimal-commerce", coordinatedDirectionId: "minimal-commerce" },
] as const satisfies readonly Readonly<{
  aliasId: string;
  coordinatedDirectionId: CoordinatedStorefrontDirectionId;
}>[];

export const legacyV1CoordinatedDirectionReplayAliasIds = [
  aliasMappings[0].aliasId,
  aliasMappings[1].aliasId,
  aliasMappings[2].aliasId,
] as const;

export const legacyV1CoordinatedDirectionReplayAliasIdSchema = z.enum(
  legacyV1CoordinatedDirectionReplayAliasIds,
);

export type LegacyV1CoordinatedDirectionReplayAliasId = z.infer<
  typeof legacyV1CoordinatedDirectionReplayAliasIdSchema
>;

export const legacyV1ReplayAuthorityErrorCodes = [
  "unknown-legacy-v1-alias",
  "invalid-legacy-v1-alias-registry",
  "stale-legacy-v1-direction-authority",
  "legacy-v1-alias-direction-mismatch",
  "invalid-legacy-v1-selection",
  "stale-legacy-v1-replay-reference",
] as const;

export type LegacyV1ReplayAuthorityErrorCode = (typeof legacyV1ReplayAuthorityErrorCodes)[number];

const errorMessages: Readonly<Record<LegacyV1ReplayAuthorityErrorCode, string>> = {
  "unknown-legacy-v1-alias": "The legacy-v1 replay alias is not registered.",
  "invalid-legacy-v1-alias-registry": "The legacy-v1 replay alias registry is invalid.",
  "stale-legacy-v1-direction-authority":
    "The legacy-v1 replay authority does not match the current coordinated direction.",
  "legacy-v1-alias-direction-mismatch":
    "The legacy-v1 replay alias and coordinated direction do not match.",
  "invalid-legacy-v1-selection": "The legacy-v1 source selection is invalid.",
  "stale-legacy-v1-replay-reference": "The legacy-v1 replay reference is stale.",
};

export class LegacyV1ReplayAuthorityError extends Error {
  readonly safeIdentifiers: readonly string[];

  constructor(
    readonly code: LegacyV1ReplayAuthorityErrorCode,
    safeIdentifiers: readonly string[] = [],
    options?: ErrorOptions,
  ) {
    super(errorMessages[code], options);
    this.name = "LegacyV1ReplayAuthorityError";
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

const aliasFingerprintSchema = z
  .string()
  .regex(/^legacy-v1-direction-alias-v1_[1-9][0-9]*_[a-f0-9]{64}$/);

const aliasRecordSchema = z
  .object({
    aliasSchemaVersion: z.literal(LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_SCHEMA_VERSION),
    authorityKind: z.literal(LEGACY_V1_COORDINATED_DIRECTION_REPLAY_AUTHORITY_KIND),
    aliasId: legacyV1CoordinatedDirectionReplayAliasIdSchema,
    coordinatedDirectionId: coordinatedStorefrontDirectionIdSchema,
    coordinatedDirectionAuthorityVersion: z.literal(
      COORDINATED_STOREFRONT_DIRECTION_AUTHORITY_VERSION,
    ),
    coordinatedDirectionAuthorityFingerprint: z.string().trim().min(1).max(240),
    aliasFingerprint: aliasFingerprintSchema,
  })
  .strict();

type AliasRecord = z.infer<typeof aliasRecordSchema>;

export type LegacyV1CoordinatedDirectionReplayAliasV1 = DeepReadonly<AliasRecord>;

function mappingForAlias(aliasId: unknown): (typeof aliasMappings)[number] {
  const parsed = legacyV1CoordinatedDirectionReplayAliasIdSchema.safeParse(aliasId);
  if (!parsed.success) throw new LegacyV1ReplayAuthorityError("unknown-legacy-v1-alias");
  const mapping = aliasMappings.find((candidate) => candidate.aliasId === parsed.data);
  if (!mapping) throw new LegacyV1ReplayAuthorityError("unknown-legacy-v1-alias");
  return mapping;
}

function fingerprintAlias(alias: Omit<AliasRecord, "aliasFingerprint">): string {
  return `legacy-v1-direction-alias-${canonicalValueFingerprint(alias)}`;
}

export function createLegacyV1CoordinatedDirectionReplayAlias(
  aliasId: unknown,
): LegacyV1CoordinatedDirectionReplayAliasV1 {
  const mapping = mappingForAlias(aliasId);
  const direction = getCoordinatedStorefrontDirection(mapping.coordinatedDirectionId);
  const material = {
    aliasSchemaVersion: LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_SCHEMA_VERSION,
    authorityKind: LEGACY_V1_COORDINATED_DIRECTION_REPLAY_AUTHORITY_KIND,
    aliasId: mapping.aliasId,
    coordinatedDirectionId: direction.id,
    coordinatedDirectionAuthorityVersion: direction.version,
    coordinatedDirectionAuthorityFingerprint: direction.authorityFingerprint,
  } satisfies Omit<AliasRecord, "aliasFingerprint">;
  return deepFreeze({ ...material, aliasFingerprint: fingerprintAlias(material) });
}

function parseAliasRecord(input: unknown): LegacyV1CoordinatedDirectionReplayAliasV1 {
  if (input !== null && typeof input === "object") {
    const candidate = input as Record<string, unknown>;
    const aliasId = legacyV1CoordinatedDirectionReplayAliasIdSchema.safeParse(candidate.aliasId);
    if (aliasId.success) {
      const mapping = mappingForAlias(aliasId.data);
      if (
        coordinatedStorefrontDirectionIdSchema.safeParse(candidate.coordinatedDirectionId)
          .success &&
        candidate.coordinatedDirectionId !== mapping.coordinatedDirectionId
      ) {
        throw new LegacyV1ReplayAuthorityError("legacy-v1-alias-direction-mismatch", [
          mapping.aliasId,
          mapping.coordinatedDirectionId,
        ]);
      }
      const current = getCoordinatedStorefrontDirection(mapping.coordinatedDirectionId);
      if (
        candidate.coordinatedDirectionAuthorityVersion !== current.version ||
        candidate.coordinatedDirectionAuthorityFingerprint !== current.authorityFingerprint
      ) {
        throw new LegacyV1ReplayAuthorityError("stale-legacy-v1-direction-authority", [
          mapping.aliasId,
          mapping.coordinatedDirectionId,
        ]);
      }
    }
  }
  const parsed = aliasRecordSchema.safeParse(input);
  if (!parsed.success) {
    throw new LegacyV1ReplayAuthorityError("invalid-legacy-v1-alias-registry");
  }
  const mapping = mappingForAlias(parsed.data.aliasId);
  const current = createLegacyV1CoordinatedDirectionReplayAlias(mapping.aliasId);
  if (parsed.data.aliasFingerprint !== current.aliasFingerprint) {
    throw new LegacyV1ReplayAuthorityError("invalid-legacy-v1-alias-registry", [mapping.aliasId]);
  }
  return deepFreeze(parsed.data);
}

function addSchemaIssue(context: z.RefinementCtx, error: unknown): void {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message:
      error instanceof LegacyV1ReplayAuthorityError
        ? error.message
        : "The legacy-v1 replay authority is invalid.",
  });
}

function withCurrentAuthorityValidation<Schema extends z.ZodTypeAny>(
  schema: Schema,
  parse: (input: unknown) => unknown,
) {
  return schema.superRefine((input, context) => {
    try {
      parse(input);
    } catch (error) {
      addSchemaIssue(context, error);
    }
  });
}

export const legacyV1CoordinatedDirectionReplayAliasV1Schema = withCurrentAuthorityValidation(
  aliasRecordSchema,
  parseAliasRecord,
).transform(parseAliasRecord);

export function parseLegacyV1CoordinatedDirectionReplayAlias(
  input: unknown,
): LegacyV1CoordinatedDirectionReplayAliasV1 {
  return parseAliasRecord(input);
}

const registryFingerprintSchema = z
  .string()
  .regex(/^legacy-v1-direction-alias-registry-v1_[1-9][0-9]*_[a-f0-9]{64}$/);

const aliasRegistryRecordSchema = z
  .object({
    registrySchemaVersion: z.literal(
      LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_REGISTRY_SCHEMA_VERSION,
    ),
    aliases: z.array(z.unknown()).length(aliasMappings.length),
    registryFingerprint: registryFingerprintSchema,
  })
  .strict();

type AliasRegistryRecord = Readonly<{
  registrySchemaVersion: typeof LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_REGISTRY_SCHEMA_VERSION;
  aliases: readonly AliasRecord[];
  registryFingerprint: string;
}>;

export type LegacyV1CoordinatedDirectionReplayAliasRegistryV1 = DeepReadonly<AliasRegistryRecord>;

function fingerprintRegistry(registry: Omit<AliasRegistryRecord, "registryFingerprint">): string {
  return `legacy-v1-direction-alias-registry-${canonicalValueFingerprint(registry)}`;
}

function parseAliasRegistry(input: unknown): LegacyV1CoordinatedDirectionReplayAliasRegistryV1 {
  const parsed = aliasRegistryRecordSchema.safeParse(input);
  if (!parsed.success) {
    throw new LegacyV1ReplayAuthorityError("invalid-legacy-v1-alias-registry");
  }
  const aliases = parsed.data.aliases.map(parseAliasRecord);
  const aliasIds = aliases.map(({ aliasId }) => aliasId);
  const directionIds = aliases.map(({ coordinatedDirectionId }) => coordinatedDirectionId);
  if (new Set(aliasIds).size !== aliasMappings.length || new Set(directionIds).size !== 3) {
    throw new LegacyV1ReplayAuthorityError("invalid-legacy-v1-alias-registry");
  }
  aliasMappings.forEach((mapping, index) => {
    if (aliases[index]?.aliasId !== mapping.aliasId) {
      throw new LegacyV1ReplayAuthorityError("invalid-legacy-v1-alias-registry");
    }
    if (aliases[index]?.coordinatedDirectionId !== mapping.coordinatedDirectionId) {
      throw new LegacyV1ReplayAuthorityError("legacy-v1-alias-direction-mismatch", [
        mapping.aliasId,
        mapping.coordinatedDirectionId,
      ]);
    }
  });
  const material = {
    registrySchemaVersion: parsed.data.registrySchemaVersion,
    aliases,
  } satisfies Omit<AliasRegistryRecord, "registryFingerprint">;
  if (parsed.data.registryFingerprint !== fingerprintRegistry(material)) {
    throw new LegacyV1ReplayAuthorityError("invalid-legacy-v1-alias-registry");
  }
  return deepFreeze({ ...material, registryFingerprint: parsed.data.registryFingerprint });
}

export const legacyV1CoordinatedDirectionReplayAliasRegistryV1Schema =
  withCurrentAuthorityValidation(aliasRegistryRecordSchema, parseAliasRegistry).transform(
    parseAliasRegistry,
  );

export function createLegacyV1CoordinatedDirectionReplayAliasRegistry(): LegacyV1CoordinatedDirectionReplayAliasRegistryV1 {
  const material = {
    registrySchemaVersion: LEGACY_V1_COORDINATED_DIRECTION_REPLAY_ALIAS_REGISTRY_SCHEMA_VERSION,
    aliases: aliasMappings.map(({ aliasId }) =>
      createLegacyV1CoordinatedDirectionReplayAlias(aliasId),
    ),
  } satisfies Omit<AliasRegistryRecord, "registryFingerprint">;
  return deepFreeze({ ...material, registryFingerprint: fingerprintRegistry(material) });
}

export function parseLegacyV1CoordinatedDirectionReplayAliasRegistry(
  input: unknown,
): LegacyV1CoordinatedDirectionReplayAliasRegistryV1 {
  return parseAliasRegistry(input);
}

export const legacyV1CoordinatedDirectionReplayAliasRegistry =
  createLegacyV1CoordinatedDirectionReplayAliasRegistry();

export function resolveLegacyV1ReplayAlias(
  aliasId: unknown,
  registry: unknown = legacyV1CoordinatedDirectionReplayAliasRegistry,
): LegacyV1CoordinatedDirectionReplayAliasV1 {
  const mapping = mappingForAlias(aliasId);
  const currentRegistry = parseAliasRegistry(registry);
  const resolved = currentRegistry.aliases.find((alias) => alias.aliasId === mapping.aliasId);
  if (!resolved) throw new LegacyV1ReplayAuthorityError("unknown-legacy-v1-alias");
  return deepFreeze(structuredClone(resolved));
}

const replayFingerprintSchema = z
  .string()
  .regex(/^legacy-v1-storefront-replay-reference-v1_[1-9][0-9]*_[a-f0-9]{64}$/);

const replayReferenceRecordSchema = z
  .object({
    replaySchemaVersion: z.literal(LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_SCHEMA_VERSION),
    authorityKind: z.literal(LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_AUTHORITY_KIND),
    aliasId: legacyV1CoordinatedDirectionReplayAliasIdSchema,
    sourceSelection: boundedStorefrontSynthesisSelectionNarrowingSchema,
    replayFingerprint: replayFingerprintSchema,
  })
  .strict();

const replayReferenceEnvelopeSchema = replayReferenceRecordSchema
  .extend({ aliasId: z.unknown(), sourceSelection: z.unknown() })
  .strict();

type ReplayReferenceRecord = z.infer<typeof replayReferenceRecordSchema>;

export type LegacyV1StorefrontReplayReferenceV1 = DeepReadonly<ReplayReferenceRecord>;

const replayCreationInputSchema = z
  .object({
    aliasId: z.unknown(),
    sourceSelection: z.unknown(),
  })
  .strict();

function parseSourceSelection(input: unknown): BoundedStorefrontSynthesisSelectionNarrowing {
  const parsed = boundedStorefrontSynthesisSelectionNarrowingSchema.safeParse(input);
  if (!parsed.success) throw new LegacyV1ReplayAuthorityError("invalid-legacy-v1-selection");
  const source = input as Record<string, unknown>;
  const optionalPageIds = source.includedOptionalPageFamilyIds;
  if (
    source.authorityId !== parsed.data.authorityId ||
    source.authorityFingerprint !== parsed.data.authorityFingerprint ||
    source.selectionId !== parsed.data.selectionId ||
    !Array.isArray(optionalPageIds) ||
    optionalPageIds.length !== parsed.data.includedOptionalPageFamilyIds.length ||
    optionalPageIds.some(
      (optionalPageId, index) =>
        optionalPageId !== parsed.data.includedOptionalPageFamilyIds[index],
    )
  ) {
    throw new LegacyV1ReplayAuthorityError("invalid-legacy-v1-selection");
  }
  return parsed.data;
}

function validateSourceSelection(
  alias: LegacyV1CoordinatedDirectionReplayAliasV1,
  sourceSelection: BoundedStorefrontSynthesisSelectionNarrowing,
): void {
  const expectedAuthorityId = `coordinated-direction:${alias.coordinatedDirectionId}`;
  if (sourceSelection.authorityId !== expectedAuthorityId) {
    const suppliedDirection = sourceSelection.authorityId.replace(/^coordinated-direction:/, "");
    if (coordinatedStorefrontDirectionIdSchema.safeParse(suppliedDirection).success) {
      throw new LegacyV1ReplayAuthorityError("legacy-v1-alias-direction-mismatch", [
        alias.aliasId,
        alias.coordinatedDirectionId,
      ]);
    }
    throw new LegacyV1ReplayAuthorityError("stale-legacy-v1-direction-authority", [alias.aliasId]);
  }
  if (
    sourceSelection.authorityVersion !== alias.coordinatedDirectionAuthorityVersion ||
    sourceSelection.authorityFingerprint !== alias.coordinatedDirectionAuthorityFingerprint
  ) {
    throw new LegacyV1ReplayAuthorityError("stale-legacy-v1-direction-authority", [
      alias.aliasId,
      alias.coordinatedDirectionId,
    ]);
  }
  try {
    validateDirectionSelectionNarrowing(sourceSelection);
  } catch (error) {
    if (
      error instanceof CoordinatedStorefrontDirectionError &&
      error.code === "stale-direction-authority"
    ) {
      throw new LegacyV1ReplayAuthorityError(
        "stale-legacy-v1-direction-authority",
        [alias.aliasId, alias.coordinatedDirectionId],
        { cause: error },
      );
    }
    throw new LegacyV1ReplayAuthorityError(
      "invalid-legacy-v1-selection",
      [alias.aliasId, alias.coordinatedDirectionId],
      error instanceof Error ? { cause: error } : undefined,
    );
  }
}

function executableSelectionFromNarrowing(
  sourceSelection: BoundedStorefrontSynthesisSelectionNarrowing,
): BoundedStorefrontSynthesisExactSelection {
  const {
    authorityId: _authorityId,
    authorityVersion: _authorityVersion,
    authorityFingerprint: _authorityFingerprint,
    selectionId: _selectionId,
    ...executableSelection
  } = sourceSelection;
  void [_authorityId, _authorityVersion, _authorityFingerprint, _selectionId];
  return boundedStorefrontSynthesisExactSelectionSchema.parse(executableSelection);
}

function fingerprintReplayReference(
  alias: LegacyV1CoordinatedDirectionReplayAliasV1,
  sourceSelection: BoundedStorefrontSynthesisSelectionNarrowing,
): string {
  return `legacy-v1-storefront-replay-reference-${canonicalValueFingerprint({
    replaySchemaVersion: LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_SCHEMA_VERSION,
    authorityKind: LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_AUTHORITY_KIND,
    resolvedAliasAuthority: alias,
    executableSelection: executableSelectionFromNarrowing(sourceSelection),
  })}`;
}

export function createLegacyV1StorefrontReplayReference(
  input: unknown,
  registry: unknown = legacyV1CoordinatedDirectionReplayAliasRegistry,
): LegacyV1StorefrontReplayReferenceV1 {
  const creation = replayCreationInputSchema.safeParse(input);
  if (!creation.success) throw new LegacyV1ReplayAuthorityError("invalid-legacy-v1-selection");
  const alias = resolveLegacyV1ReplayAlias(creation.data.aliasId, registry);
  const sourceSelection = parseSourceSelection(creation.data.sourceSelection);
  validateSourceSelection(alias, sourceSelection);
  return deepFreeze({
    replaySchemaVersion: LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_SCHEMA_VERSION,
    authorityKind: LEGACY_V1_STOREFRONT_REPLAY_REFERENCE_AUTHORITY_KIND,
    aliasId: alias.aliasId,
    sourceSelection,
    replayFingerprint: fingerprintReplayReference(alias, sourceSelection),
  });
}

function parseReplayReference(
  input: unknown,
  registry: unknown,
): LegacyV1StorefrontReplayReferenceV1 {
  if (input !== null && typeof input === "object" && "aliasId" in input) {
    mappingForAlias((input as Record<string, unknown>).aliasId);
  }
  const parsed = replayReferenceEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    throw new LegacyV1ReplayAuthorityError("stale-legacy-v1-replay-reference");
  }
  const current = createLegacyV1StorefrontReplayReference(
    { aliasId: parsed.data.aliasId, sourceSelection: parsed.data.sourceSelection },
    registry,
  );
  if (parsed.data.replayFingerprint !== current.replayFingerprint) {
    throw new LegacyV1ReplayAuthorityError("stale-legacy-v1-replay-reference", [current.aliasId]);
  }
  return current;
}

export const legacyV1StorefrontReplayReferenceV1Schema = withCurrentAuthorityValidation(
  replayReferenceEnvelopeSchema,
  (input) => parseReplayReference(input, legacyV1CoordinatedDirectionReplayAliasRegistry),
).transform((input) =>
  parseReplayReference(input, legacyV1CoordinatedDirectionReplayAliasRegistry),
);

export function parseLegacyV1StorefrontReplayReference(
  input: unknown,
  registry: unknown = legacyV1CoordinatedDirectionReplayAliasRegistry,
): LegacyV1StorefrontReplayReferenceV1 {
  return parseReplayReference(input, registry);
}
