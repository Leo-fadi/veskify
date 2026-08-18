import { resolveApprovedAssetPlacement } from "@/application/ai-storefront-generation";
import {
  getCommercialCollectionSearchProfile as collectionProfile,
  getCommercialHomepageProfile as homepageProfile,
  getCommercialPdpProfile as pdpProfile,
  getExecutablePageBlueprintProfile as executableProfile,
  resolveCommercialHomepageEvidenceAvailability as homepageEvidence,
  resolveCommercialHomepageProfileSlots as resolveHomepageSlots,
} from "@/application/storefront-templates";
import {
  canonicalValueFingerprint as fingerprint,
  isDynamicCommerceArchetypeCompatibleWithSharedFrame as supportsSharedFrame,
} from "@/domain/storefront";
import {
  boundedStorefrontSynthesisExactSelectionSchema as exactSelectionSchema,
  boundedStorefrontSynthesisSelectionNarrowingSchema as narrowingSchema,
  type BoundedStorefrontSynthesisExactSelection,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "./contract";
import {
  CoordinatedStorefrontDirectionError as DirectionError,
  type CoordinatedStorefrontDirectionId,
  type CoordinatedStorefrontDirectionPackage,
} from "./direction-contract";
import {
  informationDensityPostureForDesignSystemSpacingDensity as densityPostureForSpacing,
  listCoordinatedStorefrontDirections as listDirections,
  validateDirectionSelectionNarrowing as validateNarrowing,
} from "./direction-registry";
import type { BoundedStorefrontSynthesisInput } from "./synthesizer";

export type CompatibleCoordinatedDirectionNarrowingInput = Omit<
  BoundedStorefrontSynthesisInput,
  "request"
>;

export type CompatibleCoordinatedDirectionCandidateMaterial = Omit<
  BoundedStorefrontSynthesisSelectionNarrowing,
  "authorityId" | "authorityVersion" | "authorityFingerprint" | "selectionId"
>;

const postureFactorKeys = [
  "narrativePosture",
  "merchandisingPosture",
  "informationDensityPosture",
  "artDirectionPosture",
  "responsiveMode",
] as const;
type PostureFactorKey = (typeof postureFactorKeys)[number];

export type CompatibleCoordinatedDirectionPostureFactors = Readonly<
  Pick<CompatibleCoordinatedDirectionCandidateMaterial, PostureFactorKey>
>;

export type CompatibleCoordinatedDirectionPostureFactorOptions = Readonly<{
  [
    Factor in keyof CompatibleCoordinatedDirectionPostureFactors as `${Factor}Options`
  ]: readonly CompatibleCoordinatedDirectionPostureFactors[Factor][];
}>;

export type CompatibleCoordinatedDirectionFactorizedCandidate = Readonly<
  CompatibleCoordinatedDirectionPostureFactorOptions & {
    backbone: BoundedStorefrontSynthesisSelectionNarrowing;
    factorAuthorityFingerprint: string;
  }
>;

export type CompatibleCoordinatedDirectionCandidateEnumerationOptions = Readonly<{
  maximumCandidateEvaluations?: number;
}>;

type Candidate = CompatibleCoordinatedDirectionCandidateMaterial;
type Direction = CoordinatedStorefrontDirectionPackage;
type FactorizedCandidate = CompatibleCoordinatedDirectionFactorizedCandidate;
type FactorOptions = CompatibleCoordinatedDirectionPostureFactorOptions;
type Factors = CompatibleCoordinatedDirectionPostureFactors;
type SynthesisInput = BoundedStorefrontSynthesisInput;
type NarrowingInput = CompatibleCoordinatedDirectionNarrowingInput;
type InventoryOptions = CompatibleCoordinatedDirectionCandidateEnumerationOptions;
type CandidateListOptions = Readonly<
  InventoryOptions & { directionId?: CoordinatedStorefrontDirectionId }
>;

export const MAX_COMPATIBLE_COORDINATED_DIRECTION_CANDIDATES = 8_192 as const;
const COMPATIBLE_COORDINATED_DIRECTION_INVENTORY_DIAGNOSTIC_VERSION = "1.1.0" as const;
export const COMPATIBLE_COORDINATED_DIRECTION_POSTURE_FACTOR_AUTHORITY_VERSION = "1.1.0" as const;

type InventoryStageId = "registered-direction-tuples" | (typeof inventoryFilters)[number][0];
type InventoryReasonCode = (typeof inventoryFilters)[number][1];
type InventoryStage = Readonly<{
  stage: InventoryStageId;
  enteringCandidateCount: number;
  remainingCandidateCount: number;
  eliminationReasons: readonly Readonly<{
    reasonCode: InventoryReasonCode;
    count: number;
  }>[];
}>;

export class CompatibleCoordinatedDirectionCandidateBudgetError extends Error {
  readonly code = "candidate-budget-exceeded" as const;

  constructor(
    readonly requiredCandidateEvaluations: bigint,
    readonly maximumCandidateEvaluations: number,
  ) {
    super(
      `Current compatibility authority requires ${requiredCandidateEvaluations.toString()} candidate evaluations above the ${maximumCandidateEvaluations} candidate budget.`,
    );
    this.name = "CompatibleCoordinatedDirectionCandidateBudgetError";
  }
}

function candidateDimensions(direction: Direction) {
  const c = direction.constraints;
  return [
    ["directionId", c.designSystemDirectionIds],
    ["designSystemSpacingDensity", c.designSystemSpacingDensities],
    ["designSystemSurfaceDepth", c.designSystemSurfaceDepths],
    ["sharedFrameProfileId", c.sharedFrameProfileIds],
    ["homepageProfileId", c.homepageProfileIds],
    ["collectionProfileId", c.collectionProfileIds],
    ["searchProfileId", c.searchProfileIds],
    ["pdpProfileId", c.pdpProfileIds],
    ["includedOptionalPageFamilyIds", c.optionalPageFamilyCompositions],
  ] as const;
}

function assertCandidateBudget(
  directions: readonly Direction[],
  maximum: number = MAX_COMPATIBLE_COORDINATED_DIRECTION_CANDIDATES,
): void {
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new TypeError(
      "The coordinated-direction candidate budget must be a positive safe integer.",
    );
  }
  const requiredCandidateEvaluations = directions.reduce(
    (total, direction) =>
      total +
      candidateDimensions(direction).reduce(
        (cardinality, [, values]) => cardinality * BigInt(values.length),
        1n,
      ),
    0n,
  );
  if (requiredCandidateEvaluations > BigInt(maximum)) {
    throw new CompatibleCoordinatedDirectionCandidateBudgetError(
      requiredCandidateEvaluations,
      maximum,
    );
  }
}

function postureFactorOptions(
  direction: Direction,
  candidate: Pick<Candidate, "designSystemSpacingDensity">,
): FactorOptions {
  const pairedDensity = densityPostureForSpacing(candidate.designSystemSpacingDensity);
  if (!direction.constraints.informationDensityPostures.includes(pairedDensity)) {
    throw new DirectionError(
      "invalid-direction-reference",
      `${direction.id} does not register the density paired with ${candidate.designSystemSpacingDensity} spacing.`,
    );
  }
  return Object.freeze(
    Object.fromEntries(
      postureFactorKeys.map((factor) => [
        `${factor}Options`,
        Object.freeze(
          factor === "informationDensityPosture"
            ? [pairedDensity]
            : [...direction.constraints[`${factor}s`]],
        ),
      ]),
    ),
  ) as FactorOptions;
}

function immutableCopy<T>(value: T): Readonly<T> {
  return Object.freeze(structuredClone(value));
}

function factorAuthorityFingerprint(direction: Direction, options: FactorOptions): string {
  return `coordinated-direction-posture-factors-${fingerprint({
    contractVersion: COMPATIBLE_COORDINATED_DIRECTION_POSTURE_FACTOR_AUTHORITY_VERSION,
    directionId: direction.id,
    directionAuthorityFingerprint: direction.authorityFingerprint,
    options,
  })}`;
}

function candidateMaterial(direction: Direction): Candidate[] {
  let candidates: Record<string, unknown>[] = [{}];
  for (const [key, values] of candidateDimensions(direction)) {
    candidates = candidates.flatMap((candidate) =>
      values.map((value) => ({
        ...candidate,
        [key]: Array.isArray(value) ? [...value] : value,
      })),
    );
  }
  return candidates.map((candidate) => {
    const designSystemSpacingDensity =
      candidate.designSystemSpacingDensity as Candidate["designSystemSpacingDensity"];
    return {
      ...candidate,
      ...immutableCopy(direction.constraints.postureDefaults),
      informationDensityPosture: densityPostureForSpacing(designSystemSpacingDensity),
    };
  }) as Candidate[];
}

export function coordinatedDirectionNarrowingForCandidate(
  direction: Direction,
  candidate: Candidate,
): BoundedStorefrontSynthesisSelectionNarrowing {
  const selectionId = `direction-selection-${fingerprint(candidate)}`;
  return narrowingSchema.parse({
    authorityId: `coordinated-direction:${direction.id}`,
    authorityVersion: direction.version,
    authorityFingerprint: direction.authorityFingerprint,
    selectionId,
    ...candidate,
  });
}

function factorizedCandidate(direction: Direction, candidate: Candidate): FactorizedCandidate {
  const options = postureFactorOptions(direction, candidate);
  return Object.freeze({
    backbone: immutableCopy(coordinatedDirectionNarrowingForCandidate(direction, candidate)),
    ...options,
    factorAuthorityFingerprint: factorAuthorityFingerprint(direction, options),
  });
}

function selectedPageProfiles(candidate: Candidate, input: SynthesisInput) {
  const selected = {
    home: candidate.homepageProfileId,
    collection: candidate.collectionProfileId,
    "search-results": candidate.searchProfileId,
    "product-detail": candidate.pdpProfileId,
  } as Readonly<Record<string, string>>;
  const includedOptional = new Set(candidate.includedOptionalPageFamilyIds);
  return input.siteMapDecision.pages
    .filter((page) => page.required || includedOptional.has(page.familyId))
    .map((page) => executableProfile(selected[page.familyId] ?? page.profile.id)?.profile);
}

function assetsCompatible(candidate: Candidate, input: SynthesisInput): boolean {
  const { approvedAssetContext, brief, catalogue, componentDefinitions } = input.planningInput;
  const availableRoles = new Set(approvedAssetContext?.assets.map(({ role }) => role));
  const homepage = homepageProfile(candidate.homepageProfileId);
  if (!homepage) return false;
  const supportsAsset = ({ sectionType }: (typeof homepage.slots)[number]) =>
    componentDefinitions
      .find(({ type }) => type === sectionType)
      ?.assetSlots.some(({ acceptedRoles }) =>
        acceptedRoles.some((role) => availableRoles.has(role)),
      );
  try {
    resolveHomepageSlots(candidate.homepageProfileId, {
      ...homepageEvidence({
        canonicalProductCount: catalogue.products.length,
        canonicalCollectionCount: catalogue.collections.length,
        merchantDescription: brief.businessIdentity.shortDescription,
        briefApprovalStatus: brief.approval.status,
        approvedEvidenceFingerprint: brief.approvedEvidenceFingerprint,
      }),
      approvedMediaSlotIds: homepage.slots.filter(supportsAsset).map(({ id }) => id),
    });
  } catch {
    return false;
  }
  return selectedPageProfiles(candidate, input).every((profile) => {
    if (
      profile === undefined ||
      !profile.requiredAssetRoles.every((requiredRole) => availableRoles.has(requiredRole))
    ) {
      return false;
    }
    if (
      profile.commercialCollectionSearch?.campaignEvidencePolicy ===
      "approved-editorial-media-required"
    ) {
      return (
        approvedAssetContext !== null &&
        resolveApprovedAssetPlacement({
          assets: approvedAssetContext.assets,
          request: {
            purpose: "collection-campaign",
            acceptedRoles: ["editorialImage"],
          },
          reuseLedger: new Map(),
        }) !== null
      );
    }
    return true;
  });
}

function designDnaCompatible(candidate: Candidate, input: SynthesisInput): boolean {
  const selection = input.planningInput.recipeContext.designSystem.directions.find(
    ({ id }) => id === candidate.directionId,
  );
  if (!selection) return false;
  const imagePosture = {
    premiumEditorial: "editorial",
    modernTechnical: "contained",
    warmApproachable: "editorial",
  }[selection.id] as "contained" | "editorial" | "immersive";
  const narrowings = [
    homepageProfile(candidate.homepageProfileId)?.profile?.commercialHomepage?.designDnaNarrowing,
    collectionProfile(candidate.collectionProfileId)?.profile?.commercialCollectionSearch
      ?.designDnaNarrowing,
    collectionProfile(candidate.searchProfileId)?.profile?.commercialCollectionSearch
      ?.designDnaNarrowing,
    pdpProfile(candidate.pdpProfileId)?.profile?.commercialProductDetail?.designDnaNarrowing,
  ];
  return narrowings.every(
    (narrowing) =>
      narrowing !== undefined &&
      narrowing.spacingDensity.includes(candidate.designSystemSpacingDensity) &&
      narrowing.surfaceDepth.includes(candidate.designSystemSurfaceDepth) &&
      narrowing.imagePosture.includes(imagePosture),
  );
}

// Validate dynamic profile/context metadata without resolving or materializing an archetype.
function dynamicCommerceCompatible(candidate: Candidate, input: SynthesisInput): boolean {
  const dynamic = input.planningInput.draft.dynamicCommercePresentation;
  // Initial generation has no dynamic authority; existing drafts must match their current one.
  if (!dynamic) return true;
  const supportsFrame = (archetype: { compatibleSharedFrameProfileIds: readonly string[] }) =>
    supportsSharedFrame(archetype, candidate.sharedFrameProfileId);
  const supportsCollection = (profileId: string, context: "collection" | "search") =>
    dynamic.collectionSearchArchetypes.some(
      (archetype) =>
        archetype.profile.profileId === profileId &&
        archetype.supportedContexts.includes(context) &&
        supportsFrame(archetype),
    );
  const genericFallback = dynamic.productDetailArchetypes.find(
    ({ id }) => id === dynamic.fallbacks.productDetailArchetypeId,
  );
  return (
    genericFallback !== undefined &&
    supportsFrame(genericFallback) &&
    supportsCollection(candidate.collectionProfileId, "collection") &&
    supportsCollection(candidate.searchProfileId, "search") &&
    dynamic.productDetailArchetypes.some(
      (archetype) =>
        archetype.profile.profileId === candidate.pdpProfileId && supportsFrame(archetype),
    )
  );
}

function pageSetFrameCompatible(candidate: Candidate, input: SynthesisInput): boolean {
  return selectedPageProfiles(candidate, input).every((profile) => {
    if (!profile) return false;
    const frames =
      profile.commercialHomepage?.compatibleSharedFrameProfileIds ??
      profile.commercialCollectionSearch?.compatibleSharedFrameProfileIds ??
      profile.commercialProductDetail?.compatibleSharedFrameProfileIds ??
      profile.commercialContentSupport?.compatibleSharedFrameProfileIds ??
      profile.commercialUtility?.compatibleSharedFrameProfileIds;
    return frames === undefined || frames.includes(candidate.sharedFrameProfileId);
  });
}

function inventoryStage(
  stage: InventoryStageId,
  enteringCandidateCount: number,
  remainingCandidateCount: number,
  reasonCode?: InventoryReasonCode,
): InventoryStage {
  return Object.freeze({
    stage,
    enteringCandidateCount,
    remainingCandidateCount,
    eliminationReasons:
      reasonCode === undefined || enteringCandidateCount === remainingCandidateCount
        ? []
        : [Object.freeze({ reasonCode, count: enteringCandidateCount - remainingCandidateCount })],
  });
}

const inventoryFilters = [
  ["approved-asset-posture", "unsupported-approved-asset-posture", assetsCompatible],
  ["profile-design-dna", "incompatible-profile-design-dna", designDnaCompatible],
  [
    "dynamic-commerce-profile-context",
    "incompatible-dynamic-commerce-profile-context",
    dynamicCommerceCompatible,
  ],
  ["page-set-shared-frame", "incompatible-page-set-shared-frame", pageSetFrameCompatible],
] as const;

function evaluateDirection(direction: Direction, input: SynthesisInput) {
  let candidates = candidateMaterial(direction);
  const stages: InventoryStage[] = [
    inventoryStage("registered-direction-tuples", candidates.length, candidates.length),
  ];
  for (const [stageId, reasonCode, accepts] of inventoryFilters) {
    const entering = candidates.length;
    candidates = candidates.filter((candidate) => accepts(candidate, input));
    stages.push(inventoryStage(stageId, entering, candidates.length, reasonCode));
  }
  return Object.freeze({ candidates, stages: Object.freeze(stages) });
}

function directionInput(input: NarrowingInput, direction: Direction): SynthesisInput {
  return {
    ...input,
    request: { intent: direction.intent, deterministicSeed: "compatible-direction-inventory" },
  };
}

function firstEmptyStage(stages: readonly InventoryStage[]) {
  return stages.find(({ remainingCandidateCount }) => remainingCandidateCount === 0)?.stage ?? null;
}

export function compatibleCoordinatedDirectionCandidateMaterial(
  direction: Direction,
  input: SynthesisInput,
  options: InventoryOptions = {},
): Candidate[] {
  // Enforce the raw metadata budget before allocating any combinations.
  assertCandidateBudget([direction], options.maximumCandidateEvaluations);
  return evaluateDirection(direction, input).candidates;
}

// Report bounded metadata-only elimination counts without exposing or materializing candidates.
export function inspectCompatibleCoordinatedDirectionCandidateInventory(
  input: NarrowingInput,
  options: InventoryOptions = {},
) {
  const directions = listDirections();
  assertCandidateBudget(directions, options.maximumCandidateEvaluations);
  const rows = directions.map((direction) => {
    const evaluation = evaluateDirection(direction, directionInput(input, direction));
    return Object.freeze({
      stages: evaluation.stages,
    });
  });
  const stages = rows[0].stages.map((entry, index) => {
    const sameStage = rows.map(({ stages }) => stages[index]);
    const total = (field: "enteringCandidateCount" | "remainingCandidateCount") =>
      sameStage.reduce((sum, stage) => sum + stage[field], 0);
    const reasonCode = inventoryFilters.find(([stage]) => stage === entry.stage)?.[1];
    return inventoryStage(
      entry.stage,
      total("enteringCandidateCount"),
      total("remainingCandidateCount"),
      reasonCode,
    );
  });
  const material = {
    contractVersion: COMPATIBLE_COORDINATED_DIRECTION_INVENTORY_DIAGNOSTIC_VERSION,
    initialCandidateCount: stages[0]?.enteringCandidateCount ?? 0,
    finalCandidateCount: stages.at(-1)?.remainingCandidateCount ?? 0,
    stages,
    firstEmptyStage: firstEmptyStage(stages),
  };
  return Object.freeze({
    ...material,
    diagnosticFingerprint: `compatible-direction-inventory-${fingerprint(material)}`,
  });
}

// Carry posture options beside each backbone instead of expanding their Cartesian product.
export function listCompatibleCoordinatedDirectionFactorizedCandidates(
  input: NarrowingInput,
  options: CandidateListOptions = {},
): readonly FactorizedCandidate[] {
  const directions = listDirections().filter(
    ({ id }) => options.directionId === undefined || id === options.directionId,
  );
  assertCandidateBudget(directions, options.maximumCandidateEvaluations);
  const seenBackboneSelectionIds = new Set<string>();
  const candidates = directions.flatMap((direction) =>
    evaluateDirection(direction, directionInput(input, direction))
      .candidates.map((candidate) => factorizedCandidate(direction, candidate))
      .sort((left, right) => left.backbone.selectionId.localeCompare(right.backbone.selectionId)),
  );
  return Object.freeze(
    candidates.filter((candidate) => {
      validateNarrowing(candidate.backbone);
      if (seenBackboneSelectionIds.has(candidate.backbone.selectionId)) return false;
      seenBackboneSelectionIds.add(candidate.backbone.selectionId);
      return true;
    }),
  );
}

function candidateFactorOptions(candidate: FactorizedCandidate): FactorOptions {
  return Object.fromEntries(
    postureFactorKeys.map((factor) => {
      const optionKey: keyof FactorOptions = `${factor}Options`;
      return [optionKey, candidate[optionKey]];
    }),
  ) as FactorOptions;
}

function staleFactorAuthority(message: string): never {
  throw new DirectionError("stale-direction-authority", message);
}

// Resolve explicit factors against current authority; never infer, hash, soften, or default them.
export function resolveCompatibleCoordinatedDirectionPostureFactors(input: {
  factorizedCandidate: FactorizedCandidate;
  factors: Factors;
}): BoundedStorefrontSynthesisSelectionNarrowing {
  const { factorizedCandidate: candidate } = input;
  const directionId = candidate.backbone.authorityId.replace(/^coordinated-direction:/, "");
  const direction = listDirections().find(({ id }) => id === directionId);
  if (!direction)
    staleFactorAuthority("The candidate does not reference current direction authority.");
  validateNarrowing(candidate.backbone);

  const suppliedOptions = candidateFactorOptions(candidate);
  const currentOptions = postureFactorOptions(direction, candidate.backbone);
  const factorFingerprint = (options: FactorOptions) =>
    factorAuthorityFingerprint(direction, options);
  const expectedFactorFingerprint = candidate.factorAuthorityFingerprint;
  if (
    [suppliedOptions, currentOptions].some(
      (options) => factorFingerprint(options) !== expectedFactorFingerprint,
    )
  )
    staleFactorAuthority("The coordinated-direction posture factor authority is stale.");

  const backboneExact = exactSelectionMaterial(candidate.backbone);
  const canonicalBackbone = coordinatedDirectionNarrowingForCandidate(direction, {
    ...backboneExact,
    ...immutableCopy(direction.constraints.postureDefaults),
    informationDensityPosture: densityPostureForSpacing(backboneExact.designSystemSpacingDensity),
  });
  if (fingerprint(canonicalBackbone) !== fingerprint(candidate.backbone))
    staleFactorAuthority("The coordinated-direction factorized backbone is not current.");

  for (const factorKey of postureFactorKeys) {
    const optionKey: keyof FactorOptions = `${factorKey}Options`;
    const selected = input.factors[factorKey];
    if (!(currentOptions[optionKey] as readonly string[]).includes(selected)) {
      const label = factorKey.replace(/([A-Z])/g, " $1").toLowerCase();
      throw new DirectionError(
        "unsupported-characteristic",
        `${selected} is outside the current ${label} factor authority.`,
      );
    }
  }

  const resolved = coordinatedDirectionNarrowingForCandidate(
    direction,
    exactSelectionSchema.parse({ ...backboneExact, ...input.factors }),
  );
  validateNarrowing(resolved);
  return immutableCopy(resolved);
}

// Preserve registry direction order and content-derived backbone ordering.
export function listCompatibleCoordinatedDirectionSelectionNarrowings(
  input: NarrowingInput,
  options: CandidateListOptions = {},
): readonly BoundedStorefrontSynthesisSelectionNarrowing[] {
  return Object.freeze(
    listCompatibleCoordinatedDirectionFactorizedCandidates(input, options).map(
      ({ backbone }) => backbone,
    ),
  );
}

function exactSelectionMaterial(
  narrowing: BoundedStorefrontSynthesisSelectionNarrowing,
): BoundedStorefrontSynthesisExactSelection {
  const { authorityId, authorityVersion, authorityFingerprint, selectionId, ...exact } = narrowing;
  void [authorityId, authorityVersion, authorityFingerprint, selectionId];
  return exactSelectionSchema.parse(exact);
}

// Exact execution remains authorized only while its complete tuple matches current inventory.
export function isCurrentCompatibleCoordinatedDirectionExactSelection(input: {
  authority: NarrowingInput;
  exactSelection: BoundedStorefrontSynthesisExactSelection;
}): boolean {
  const exact = exactSelectionSchema.parse(input.exactSelection);
  const exactFingerprint = fingerprint(exact);
  const directionId = listDirections().find(({ constraints }) =>
    constraints.designSystemDirectionIds.includes(exact.directionId),
  )?.id;
  if (!directionId) return false;
  const factors = Object.fromEntries(
    postureFactorKeys.map((factor) => [factor, exact[factor]]),
  ) as Factors;
  return listCompatibleCoordinatedDirectionFactorizedCandidates(input.authority, {
    directionId,
  }).some((factorizedCandidate) => {
    try {
      const resolved = resolveCompatibleCoordinatedDirectionPostureFactors({
        factorizedCandidate,
        factors,
      });
      return fingerprint(exactSelectionMaterial(resolved)) === exactFingerprint;
    } catch (error) {
      if (error instanceof DirectionError) return false;
      throw error;
    }
  });
}
