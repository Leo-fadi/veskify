import { z } from "zod";

import {
  resolveDynamicCommerceRoutePage,
  validateCurrentDynamicCommercePresentationAuthority,
} from "@/application/dynamic-commerce-routes/authority";
import {
  createStorefrontRenderContext,
  validateRegisteredSection,
} from "@/components/registry/registry";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import {
  brandSystemDesignDnaFingerprint,
  resolveBrandSystemDesignDna,
} from "@/domain/design-system";
import { canonicalLocaleOrder, idSchema, type Locale } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  canonicalStorefrontSiteMapFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { validateRepositorySnapshot } from "@/services/storage/repository-validation";

import { getCoordinatedStorefrontDirection } from "./direction-registry";
import {
  legacyV1CoordinatedDirectionReplayAliasIdSchema,
  parseLegacyV1StorefrontReplayReference,
  resolveLegacyV1ReplayAlias,
  type LegacyV1StorefrontReplayReferenceV1,
} from "./legacy-v1-replay-authority";

export const LEGACY_V1_HISTORICAL_SNAPSHOT_READ_RECEIPT_SCHEMA_VERSION = "1.0.0" as const;
export const LEGACY_V1_HISTORICAL_SNAPSHOT_READ_AUTHORITY_KIND =
  "legacy-v1-historical-snapshot-read" as const;

export const legacyV1HistoricalSnapshotReadDispositions = [
  "readable-unattributed",
  "readable-explicit-replay-binding",
] as const;
export const legacyV1HistoricalSnapshotReadNormalizationDispositions = [
  "none",
  "canonical-read-defaults",
] as const;
export const legacyV1HistoricalSnapshotSelectionFieldIds = [
  "directionId",
  "designSystemSpacingDensity",
  "designSystemSurfaceDepth",
  "sharedFrameProfileId",
  "homepageProfileId",
  "collectionProfileId",
  "searchProfileId",
  "pdpProfileId",
  "includedOptionalPageFamilyIds",
  "narrativePosture",
  "merchandisingPosture",
  "informationDensityPosture",
  "artDirectionPosture",
  "responsiveMode",
] as const;
export const legacyV1HistoricalSnapshotReadErrorCodes = [
  "invalid-legacy-v1-historical-snapshot",
  "legacy-v1-historical-snapshot-catalogue-mismatch",
  "invalid-legacy-v1-historical-replay-binding",
  "legacy-v1-historical-replay-authority-mismatch",
  "stale-legacy-v1-historical-snapshot-receipt",
] as const;

export type LegacyV1HistoricalSnapshotReadErrorCode =
  (typeof legacyV1HistoricalSnapshotReadErrorCodes)[number];

const errorMessages: Readonly<Record<LegacyV1HistoricalSnapshotReadErrorCode, string>> = {
  "invalid-legacy-v1-historical-snapshot":
    "The historical legacy-v1 snapshot is invalid under current canonical authority.",
  "legacy-v1-historical-snapshot-catalogue-mismatch":
    "The historical legacy-v1 snapshot does not reference the supplied catalogue.",
  "invalid-legacy-v1-historical-replay-binding":
    "The explicit historical legacy-v1 replay binding is invalid.",
  "legacy-v1-historical-replay-authority-mismatch":
    "The explicit legacy-v1 replay authority conflicts with persisted snapshot authority.",
  "stale-legacy-v1-historical-snapshot-receipt":
    "The historical legacy-v1 snapshot read receipt is stale.",
};

export class LegacyV1HistoricalSnapshotReadError extends Error {
  readonly safeIdentifiers: readonly string[];

  constructor(
    readonly code: LegacyV1HistoricalSnapshotReadErrorCode,
    safeIdentifiers: readonly string[] = [],
  ) {
    super(errorMessages[code]);
    this.name = "LegacyV1HistoricalSnapshotReadError";
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

const selectionFieldIdSchema = z.enum(legacyV1HistoricalSnapshotSelectionFieldIds);
type SelectionFieldId = z.infer<typeof selectionFieldIdSchema>;

const readDispositionSchema = z.enum(legacyV1HistoricalSnapshotReadDispositions);
const readNormalizationDispositionSchema = z.enum(
  legacyV1HistoricalSnapshotReadNormalizationDispositions,
);
const canonicalFingerprintSchema = z.string().regex(/^v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const replayReferenceFingerprintSchema = z
  .string()
  .regex(/^legacy-v1-storefront-replay-reference-v1_[1-9][0-9]*_[a-f0-9]{64}$/);
const receiptFingerprintSchema = z
  .string()
  .regex(/^legacy-v1-historical-snapshot-read-v1_[1-9][0-9]*_[a-f0-9]{64}$/);

const canonicalReceiptIdentifierSchema = z.string().refine((value) => {
  const canonical = idSchema.safeParse(value);
  return canonical.success && canonical.data === value;
});

const sourceSnapshotIdentitySchema = z.strictObject({
  snapshotId: canonicalReceiptIdentifierSchema,
  projectId: canonicalReceiptIdentifierSchema,
  revision: z.number().int().nonnegative(),
  catalogueRef: canonicalReceiptIdentifierSchema,
  canonicalSnapshotFingerprint: canonicalFingerprintSchema,
});

function isCanonicalFieldOrder(fields: readonly SelectionFieldId[]): boolean {
  const order = new Map(
    legacyV1HistoricalSnapshotSelectionFieldIds.map((field, index) => [field, index]),
  );
  return fields.every(
    (field, index) => index === 0 || order.get(fields[index - 1])! < order.get(field)!,
  );
}

const explicitReplayBindingSchema = z
  .strictObject({
    aliasId: legacyV1CoordinatedDirectionReplayAliasIdSchema,
    replayReferenceFingerprint: replayReferenceFingerprintSchema,
    verifiedPersistedSelectionFields: z.array(selectionFieldIdSchema),
    unverifiedSelectionFields: z.array(selectionFieldIdSchema),
    persistedAuthorityProjectionFingerprint: canonicalFingerprintSchema,
  })
  .superRefine((binding, context) => {
    const verified = new Set(binding.verifiedPersistedSelectionFields);
    const unverified = new Set(binding.unverifiedSelectionFields);
    const complete = new Set([...verified, ...unverified]);
    if (
      verified.size !== binding.verifiedPersistedSelectionFields.length ||
      unverified.size !== binding.unverifiedSelectionFields.length ||
      [...verified].some((field) => unverified.has(field)) ||
      complete.size !== legacyV1HistoricalSnapshotSelectionFieldIds.length ||
      !legacyV1HistoricalSnapshotSelectionFieldIds.every((field) => complete.has(field)) ||
      !isCanonicalFieldOrder(binding.verifiedPersistedSelectionFields) ||
      !isCanonicalFieldOrder(binding.unverifiedSelectionFields)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Verified and unverified fields must exactly partition canonical selection authority.",
      });
    }
  });

const receiptRecordSchema = z
  .strictObject({
    receiptSchemaVersion: z.literal(LEGACY_V1_HISTORICAL_SNAPSHOT_READ_RECEIPT_SCHEMA_VERSION),
    authorityKind: z.literal(LEGACY_V1_HISTORICAL_SNAPSHOT_READ_AUTHORITY_KIND),
    sourceSnapshot: sourceSnapshotIdentitySchema,
    readDisposition: readDispositionSchema,
    replayBinding: explicitReplayBindingSchema.nullable(),
    persistedAuthorityProjectionFingerprint: canonicalFingerprintSchema,
    readNormalizationDisposition: readNormalizationDispositionSchema,
    receiptFingerprint: receiptFingerprintSchema,
  })
  .superRefine((receipt, context) => {
    const bindingIsPresent = receipt.replayBinding !== null;
    if (
      bindingIsPresent !== (receipt.readDisposition === "readable-explicit-replay-binding") ||
      (receipt.replayBinding !== null &&
        receipt.replayBinding.persistedAuthorityProjectionFingerprint !==
          receipt.persistedAuthorityProjectionFingerprint)
    ) {
      context.addIssue({ code: "custom", message: "Receipt disposition and binding disagree." });
    }
  });

type ReceiptRecord = z.infer<typeof receiptRecordSchema>;
export type LegacyV1HistoricalSnapshotReadReceiptV1 = DeepReadonly<ReceiptRecord>;
export type LegacyV1HistoricalSnapshotExplicitReplayBindingV1 = DeepReadonly<
  z.infer<typeof explicitReplayBindingSchema>
>;
export type LegacyV1HistoricalSnapshotReadResultV1 = DeepReadonly<{
  snapshot: StorefrontSnapshot;
  receipt: ReceiptRecord;
}>;

const readInputSchema = z.strictObject({
  snapshot: z.unknown(),
  catalogue: z.unknown(),
  replayReference: z.unknown().optional(),
});

type PersistedSelectionValues = Partial<Readonly<Record<SelectionFieldId, string>>>;

function uniqueProfile(profiles: readonly Readonly<{ profileId: string }>[]): string | undefined {
  const ids = [...new Set(profiles.map(({ profileId }) => profileId))];
  return ids.length === 1 ? ids[0] : undefined;
}

function derivePersistedAuthority(snapshot: StorefrontSnapshot): Readonly<{
  fingerprint: string;
  selectionValues: PersistedSelectionValues;
}> {
  const authority = snapshot.dynamicCommercePresentation;
  const homeProfiles = snapshot.pages.flatMap(({ pageFamily }) =>
    pageFamily?.familyId === "home"
      ? [{ profileId: pageFamily.profileId, profileVersion: pageFamily.profileVersion }]
      : [],
  );
  const collectionProfiles =
    authority?.collectionRouteMappings.flatMap(({ archetypeId }) => {
      const profile = authority.collectionSearchArchetypes.find(
        ({ id }) => id === archetypeId,
      )?.profile;
      return profile
        ? [{ profileId: profile.profileId, profileVersion: profile.profileVersion }]
        : [];
    }) ?? [];
  const searchProfile = authority?.collectionSearchArchetypes.find(
    ({ id }) => id === authority.searchArchetypeId,
  )?.profile;
  const pdpProfiles =
    authority?.productTypeMappings.flatMap(({ archetypeId }) => {
      const profile = authority.productDetailArchetypes.find(
        ({ id }) => id === archetypeId,
      )?.profile;
      return profile
        ? [{ profileId: profile.profileId, profileVersion: profile.profileVersion }]
        : [];
    }) ?? [];
  const spacingDensity = {
    compact: "compact",
    balanced: "standard",
    airy: "spacious",
  } as const;
  const selectionValues: PersistedSelectionValues = {
    designSystemSpacingDensity: spacingDensity[snapshot.brandSystem.spacing.density],
    ...(snapshot.brandSystem.visualSystem?.surfaceDepth
      ? { designSystemSurfaceDepth: snapshot.brandSystem.visualSystem.surfaceDepth }
      : {}),
    ...(snapshot.sharedFrame ? { sharedFrameProfileId: snapshot.sharedFrame.profileId } : {}),
    ...(uniqueProfile(homeProfiles) ? { homepageProfileId: uniqueProfile(homeProfiles) } : {}),
    ...(uniqueProfile(collectionProfiles)
      ? { collectionProfileId: uniqueProfile(collectionProfiles) }
      : {}),
    ...(searchProfile ? { searchProfileId: searchProfile.profileId } : {}),
    ...(uniqueProfile(pdpProfiles) ? { pdpProfileId: uniqueProfile(pdpProfiles) } : {}),
  };
  const designDna = resolveBrandSystemDesignDna(snapshot.brandSystem);
  const projection = {
    projectionSchemaVersion: "1.0.0",
    brandAuthority: {
      spacingDensity: snapshot.brandSystem.spacing.density,
      surfaceDepth: snapshot.brandSystem.visualSystem?.surfaceDepth ?? null,
      designDnaFingerprint: brandSystemDesignDnaFingerprint(snapshot.brandSystem),
      designDnaDomains: {
        typographyPairing: designDna.typography.pairing,
        spacingScale: designDna.spacing.scale,
        surfacePosture: designDna.surfaces.posture,
        controlDensity: designDna.controls.density,
        mediaPosture: designDna.media.posture,
      },
    },
    sharedFrame: snapshot.sharedFrame
      ? {
          profileId: snapshot.sharedFrame.profileId,
          profileVersion: snapshot.sharedFrame.profileVersion,
          authorityFingerprint: snapshot.sharedFrame.authorityFingerprint,
        }
      : null,
    homepageProfiles: homeProfiles,
    collectionProfiles,
    searchProfile: searchProfile
      ? { profileId: searchProfile.profileId, profileVersion: searchProfile.profileVersion }
      : null,
    pdpProfiles,
    navigationFingerprint: canonicalValueFingerprint(snapshot.navigation),
    siteMapFingerprint: canonicalStorefrontSiteMapFingerprint(snapshot),
    dynamicAuthority: authority
      ? {
          authorityFingerprint: authority.authorityFingerprint,
          inventoryFingerprint: canonicalValueFingerprint({
            routeInventory: authority.routeInventory,
            collectionRouteMappings: authority.collectionRouteMappings,
            searchArchetypeId: authority.searchArchetypeId,
            productTypeMappings: authority.productTypeMappings,
          }),
        }
      : null,
  };
  return { fingerprint: canonicalValueFingerprint(projection), selectionValues };
}

function safeSnapshotIdentifiers(snapshot: unknown): string[] {
  if (snapshot === null || typeof snapshot !== "object") return [];
  const candidate = snapshot as Record<string, unknown>;
  const id = idSchema.safeParse(candidate.id);
  const revision = z.number().int().nonnegative().safeParse(candidate.revision);
  return [...(id.success ? [id.data] : []), ...(revision.success ? [String(revision.data)] : [])];
}

function validateExecutionAuthority(
  snapshot: StorefrontSnapshot,
  catalogue: CatalogueDisplayModel,
): void {
  validateCurrentDynamicCommercePresentationAuthority(snapshot);
  const enabledLocales = canonicalLocaleOrder(
    snapshot.pages.flatMap(({ pageFamily }) => pageFamily?.localeCoverage ?? []),
  );
  const primaryLocale: Locale = enabledLocales[0] ?? "en";
  const evidenceReferences = snapshot.pages.flatMap(
    ({ pageFamily }) => pageFamily?.evidenceReferences ?? [],
  );
  const context = createStorefrontRenderContext({
    activeLocale: primaryLocale,
    primaryLocale,
    enabledLocales: enabledLocales.length > 0 ? enabledLocales : [primaryLocale],
    catalogue,
    snapshot,
    evidenceReferences,
  });
  if (snapshot.sharedFrame) {
    validateRegisteredSection(snapshot.sharedFrame.header, undefined, context);
    validateRegisteredSection(snapshot.sharedFrame.footer, undefined, context);
    if (snapshot.sharedFrame.announcement) {
      validateRegisteredSection(snapshot.sharedFrame.announcement, undefined, context);
    }
  }
  snapshot.pages.forEach((page) =>
    page.sections
      .filter(({ component }) => component !== "contentSupport")
      .forEach((section) => validateRegisteredSection(section, page.type, context)),
  );
  snapshot.dynamicCommercePresentation?.routeInventory.forEach((route) =>
    resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue,
      routeId: route.id,
      ...(route.kind === "search"
        ? {
            searchBinding: {
              canonicalRevision: `canonical-commerce-${canonicalValueFingerprint(catalogue)}`,
              resultProductIds: [],
            },
          }
        : {}),
    }),
  );
}

function assertDesignDnaCompatibility(
  snapshot: StorefrontSnapshot,
  replayReference: LegacyV1StorefrontReplayReferenceV1,
): void {
  const alias = resolveLegacyV1ReplayAlias(replayReference.aliasId);
  const direction = getCoordinatedStorefrontDirection(alias.coordinatedDirectionId);
  const designDna = resolveBrandSystemDesignDna(snapshot.brandSystem);
  const checks = [
    direction.constraints.designDna.typographyPairings.includes(designDna.typography.pairing),
    direction.constraints.designDna.spacingScales.includes(designDna.spacing.scale),
    direction.constraints.designDna.surfacePostures.includes(designDna.surfaces.posture),
    direction.constraints.designDna.controlDensities.includes(designDna.controls.density),
    direction.constraints.designDna.mediaPostures.includes(designDna.media.posture),
  ];
  if (checks.some((matches) => !matches)) {
    throw new LegacyV1HistoricalSnapshotReadError(
      "legacy-v1-historical-replay-authority-mismatch",
      [replayReference.aliasId, snapshot.id, "directionId"],
    );
  }
}

function bindReplayReference(
  snapshot: StorefrontSnapshot,
  replayReference: LegacyV1StorefrontReplayReferenceV1,
  projection: ReturnType<typeof derivePersistedAuthority>,
): z.infer<typeof explicitReplayBindingSchema> {
  assertDesignDnaCompatibility(snapshot, replayReference);
  const source = replayReference.sourceSelection;
  const verified = legacyV1HistoricalSnapshotSelectionFieldIds.filter(
    (field): field is keyof PersistedSelectionValues => field in projection.selectionValues,
  );
  const mismatch = verified.find((field) => projection.selectionValues[field] !== source[field]);
  if (mismatch) {
    throw new LegacyV1HistoricalSnapshotReadError(
      "legacy-v1-historical-replay-authority-mismatch",
      [replayReference.aliasId, snapshot.id, mismatch],
    );
  }
  const verifiedSet = new Set<SelectionFieldId>(verified);
  return {
    aliasId: replayReference.aliasId,
    replayReferenceFingerprint: replayReference.replayFingerprint,
    verifiedPersistedSelectionFields: verified,
    unverifiedSelectionFields: legacyV1HistoricalSnapshotSelectionFieldIds.filter(
      (field) => !verifiedSet.has(field),
    ),
    persistedAuthorityProjectionFingerprint: projection.fingerprint,
  };
}

function fingerprintReceipt(material: Omit<ReceiptRecord, "receiptFingerprint">): string {
  return `legacy-v1-historical-snapshot-read-${canonicalValueFingerprint(material)}`;
}

function parseReceipt(input: unknown): LegacyV1HistoricalSnapshotReadReceiptV1 {
  const parsed = receiptRecordSchema.safeParse(input);
  if (!parsed.success) {
    throw new LegacyV1HistoricalSnapshotReadError("stale-legacy-v1-historical-snapshot-receipt");
  }
  const { receiptFingerprint, ...material } = parsed.data;
  if (receiptFingerprint !== fingerprintReceipt(material)) {
    throw new LegacyV1HistoricalSnapshotReadError("stale-legacy-v1-historical-snapshot-receipt", [
      parsed.data.sourceSnapshot.snapshotId,
      String(parsed.data.sourceSnapshot.revision),
    ]);
  }
  return deepFreeze(structuredClone(parsed.data));
}

export function parseLegacyV1HistoricalSnapshotReadReceipt(
  input: unknown,
): LegacyV1HistoricalSnapshotReadReceiptV1 {
  return parseReceipt(input);
}

export function readLegacyV1HistoricalSnapshot(
  input: unknown,
): LegacyV1HistoricalSnapshotReadResultV1 {
  const envelope = readInputSchema.safeParse(input);
  if (!envelope.success) {
    throw new LegacyV1HistoricalSnapshotReadError("invalid-legacy-v1-historical-snapshot");
  }
  let rawSnapshot: unknown;
  let catalogue: CatalogueDisplayModel;
  try {
    rawSnapshot = structuredClone(envelope.data.snapshot);
    catalogue = catalogueDisplayModelSchema.parse(structuredClone(envelope.data.catalogue));
  } catch {
    throw new LegacyV1HistoricalSnapshotReadError(
      "invalid-legacy-v1-historical-snapshot",
      safeSnapshotIdentifiers(envelope.data.snapshot),
    );
  }
  if (
    rawSnapshot !== null &&
    typeof rawSnapshot === "object" &&
    "catalogueRef" in rawSnapshot &&
    (rawSnapshot as Record<string, unknown>).catalogueRef !== catalogue.id
  ) {
    throw new LegacyV1HistoricalSnapshotReadError(
      "legacy-v1-historical-snapshot-catalogue-mismatch",
      safeSnapshotIdentifiers(rawSnapshot),
    );
  }
  let snapshot: StorefrontSnapshot;
  let projection: ReturnType<typeof derivePersistedAuthority>;
  try {
    snapshot = validateRepositorySnapshot(rawSnapshot, catalogue);
    if (snapshot.catalogueRef !== catalogue.id) {
      throw new LegacyV1HistoricalSnapshotReadError(
        "legacy-v1-historical-snapshot-catalogue-mismatch",
        [snapshot.id, String(snapshot.revision)],
      );
    }
    projection = derivePersistedAuthority(snapshot);
  } catch (error) {
    if (error instanceof LegacyV1HistoricalSnapshotReadError) throw error;
    throw new LegacyV1HistoricalSnapshotReadError(
      "invalid-legacy-v1-historical-snapshot",
      safeSnapshotIdentifiers(rawSnapshot),
    );
  }
  let replayBinding: z.infer<typeof explicitReplayBindingSchema> | null = null;
  if (envelope.data.replayReference !== undefined) {
    let reference: LegacyV1StorefrontReplayReferenceV1;
    try {
      reference = parseLegacyV1StorefrontReplayReference(envelope.data.replayReference);
    } catch {
      throw new LegacyV1HistoricalSnapshotReadError(
        "invalid-legacy-v1-historical-replay-binding",
        safeSnapshotIdentifiers(rawSnapshot),
      );
    }
    replayBinding = bindReplayReference(snapshot, reference, projection);
  }
  try {
    validateExecutionAuthority(snapshot, catalogue);
  } catch (error) {
    if (error instanceof LegacyV1HistoricalSnapshotReadError) throw error;
    throw new LegacyV1HistoricalSnapshotReadError("invalid-legacy-v1-historical-snapshot", [
      snapshot.id,
      String(snapshot.revision),
    ]);
  }
  const material = {
    receiptSchemaVersion: LEGACY_V1_HISTORICAL_SNAPSHOT_READ_RECEIPT_SCHEMA_VERSION,
    authorityKind: LEGACY_V1_HISTORICAL_SNAPSHOT_READ_AUTHORITY_KIND,
    sourceSnapshot: {
      snapshotId: snapshot.id,
      projectId: snapshot.projectId,
      revision: snapshot.revision,
      catalogueRef: snapshot.catalogueRef,
      canonicalSnapshotFingerprint: canonicalStorefrontContentFingerprint(snapshot),
    },
    readDisposition: replayBinding
      ? ("readable-explicit-replay-binding" as const)
      : ("readable-unattributed" as const),
    replayBinding,
    persistedAuthorityProjectionFingerprint: projection.fingerprint,
    readNormalizationDisposition:
      canonicalValueString(rawSnapshot) === canonicalValueString(snapshot)
        ? ("none" as const)
        : ("canonical-read-defaults" as const),
  } satisfies Omit<ReceiptRecord, "receiptFingerprint">;
  const receipt = parseReceipt({ ...material, receiptFingerprint: fingerprintReceipt(material) });
  return deepFreeze({ snapshot: structuredClone(snapshot), receipt });
}
