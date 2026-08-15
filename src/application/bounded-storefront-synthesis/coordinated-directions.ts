import { registeredBrandSystemForDirection } from "@/application/storefront-design-system";
import { resolveBrandSystemDesignDna, type DesignDna } from "@/domain/design-system";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  BoundedStorefrontSynthesisError,
  type BoundedStorefrontSynthesisDecision,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "./contract";
import {
  coordinatedDirectionRequestSchema,
  CoordinatedStorefrontDirectionError,
  type CoordinatedDirectionRequest,
  type CoordinatedStorefrontDirectionId,
  type CoordinatedStorefrontDirectionPackage,
  type StorefrontDiversityFingerprint,
} from "./direction-contract";
import { getCoordinatedStorefrontDirection } from "./direction-registry";
import { compareStorefrontDiversity, createStorefrontDiversityFingerprint } from "./diversity";
import {
  COMPATIBLE_COORDINATED_DIRECTION_POSTURE_FACTOR_AUTHORITY_VERSION,
  CompatibleCoordinatedDirectionCandidateBudgetError,
  compatibleCoordinatedDirectionCandidateMaterial,
  coordinatedDirectionNarrowingForCandidate,
  inspectCompatibleCoordinatedDirectionCandidateInventory,
  isCurrentCompatibleCoordinatedDirectionExactSelection,
  listCompatibleCoordinatedDirectionFactorizedCandidates,
  listCompatibleCoordinatedDirectionSelectionNarrowings,
  resolveCompatibleCoordinatedDirectionPostureFactors,
  type CompatibleCoordinatedDirectionCandidateEnumerationOptions,
  type CompatibleCoordinatedDirectionFactorizedCandidate,
  type CompatibleCoordinatedDirectionCandidateMaterial,
  type CompatibleCoordinatedDirectionNarrowingInput,
  type CompatibleCoordinatedDirectionPostureFactorOptions,
  type CompatibleCoordinatedDirectionPostureFactors,
} from "./compatible-direction-selections";
import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
  type BoundedStorefrontSynthesisExecutionInput,
  type BoundedStorefrontSynthesisInput,
  type BoundedStorefrontSynthesisResult,
} from "./synthesizer";

export type CoordinatedDirectionSelection = Readonly<{
  direction: CoordinatedStorefrontDirectionPackage;
  narrowing: BoundedStorefrontSynthesisSelectionNarrowing;
  decision: BoundedStorefrontSynthesisDecision;
  designDna: DesignDna;
  directionFingerprint: string;
  diversity: StorefrontDiversityFingerprint;
}>;

export type CoordinatedDirectionExecutionInput = Omit<
  BoundedStorefrontSynthesisExecutionInput,
  "request" | "decision" | "selectionNarrowing"
> &
  Readonly<{
    directionRequest: CoordinatedDirectionRequest;
    usedDiversityFingerprints?: readonly StorefrontDiversityFingerprint[];
  }>;

export type CoordinatedDirectionResult = CoordinatedDirectionSelection &
  Readonly<{ synthesis: BoundedStorefrontSynthesisResult }>;

export type ExecutableCoordinatedDirectionCharacteristics = Readonly<
  Required<
    Pick<
      NonNullable<CoordinatedDirectionRequest["characteristics"]>,
      | "narrativePosture"
      | "merchandisingPosture"
      | "informationDensityPosture"
      | "artDirectionPosture"
      | "responsiveMode"
    >
  >
>;

export type ExecutableCoordinatedDirectionIntent = Readonly<{
  intentId: string;
  deterministicSeed: string;
  characteristics: ExecutableCoordinatedDirectionCharacteristics;
  result: CoordinatedDirectionResult;
}>;

export const MAX_EXECUTABLE_COORDINATED_DIRECTION_INTENTS = 3 as const;

export {
  COMPATIBLE_COORDINATED_DIRECTION_POSTURE_FACTOR_AUTHORITY_VERSION,
  CompatibleCoordinatedDirectionCandidateBudgetError,
  compatibleCoordinatedDirectionCandidateMaterial,
  inspectCompatibleCoordinatedDirectionCandidateInventory,
  isCurrentCompatibleCoordinatedDirectionExactSelection,
  listCompatibleCoordinatedDirectionFactorizedCandidates,
  listCompatibleCoordinatedDirectionSelectionNarrowings,
  resolveCompatibleCoordinatedDirectionPostureFactors,
  type CompatibleCoordinatedDirectionCandidateEnumerationOptions,
  type CompatibleCoordinatedDirectionCandidateMaterial,
  type CompatibleCoordinatedDirectionFactorizedCandidate,
  type CompatibleCoordinatedDirectionNarrowingInput,
  type CompatibleCoordinatedDirectionPostureFactorOptions,
  type CompatibleCoordinatedDirectionPostureFactors,
};

export function executableCoordinatedDirectionDeterministicSeed(input: {
  currentAuthorityFingerprint: string;
  directionAuthorityFingerprint: string;
  intentId: string;
}): string {
  return `coordinated-executable-${canonicalValueFingerprint(input)}`;
}

function characteristicsMatch(
  candidate: CompatibleCoordinatedDirectionCandidateMaterial,
  request: CoordinatedDirectionRequest,
): boolean {
  const characteristics = request.characteristics;
  if (!characteristics) return true;
  return Object.entries(characteristics).every(([key, value]) => {
    const candidateValue = candidate[key as keyof CompatibleCoordinatedDirectionCandidateMaterial];
    return Array.isArray(value)
      ? canonicalValueFingerprint(candidateValue) === canonicalValueFingerprint(value)
      : candidateValue === value;
  });
}

function postureCharacteristics(
  candidate: CompatibleCoordinatedDirectionCandidateMaterial,
): ExecutableCoordinatedDirectionCharacteristics {
  return Object.freeze({
    narrativePosture: candidate.narrativePosture,
    merchandisingPosture: candidate.merchandisingPosture,
    informationDensityPosture: candidate.informationDensityPosture,
    artDirectionPosture: candidate.artDirectionPosture,
    responsiveMode: candidate.responsiveMode,
  });
}

function validateDesignDna(
  direction: CoordinatedStorefrontDirectionPackage,
  designDna: DesignDna,
): void {
  const c = direction.constraints.designDna;
  const checks: readonly [string, string, readonly string[]][] = [
    ["typography pairing", designDna.typography.pairing, c.typographyPairings],
    ["spacing scale", designDna.spacing.scale, c.spacingScales],
    ["surface posture", designDna.surfaces.posture, c.surfacePostures],
    ["control density", designDna.controls.density, c.controlDensities],
    ["media posture", designDna.media.posture, c.mediaPostures],
  ];
  for (const [label, value, allowed] of checks) {
    if (!allowed.includes(value)) {
      throw new CoordinatedStorefrontDirectionError(
        "incompatible-direction",
        `${direction.id} cannot use unsupported Design DNA ${label} ${value}.`,
      );
    }
  }
}

function mayTryAnotherCandidate(error: unknown): boolean {
  if (error instanceof CoordinatedStorefrontDirectionError) {
    return ["unsupported-characteristic", "incompatible-direction", "no-valid-diversity"].includes(
      error.code,
    );
  }
  if (error instanceof BoundedStorefrontSynthesisError) {
    return !["stale-authority", "non-deterministic-selection"].includes(error.code);
  }
  return false;
}

export function createCoordinatedDirectionSelection(
  input: BoundedStorefrontSynthesisInput &
    Readonly<{
      directionRequest: CoordinatedDirectionRequest;
      usedDiversityFingerprints?: readonly StorefrontDiversityFingerprint[];
    }>,
): CoordinatedDirectionSelection {
  const request = coordinatedDirectionRequestSchema.safeParse(input.directionRequest);
  if (!request.success) {
    throw new CoordinatedStorefrontDirectionError(
      "unsupported-characteristic",
      "The coordinated direction request is invalid.",
      { cause: request.error },
    );
  }
  const direction = getCoordinatedStorefrontDirection(request.data.directionId);
  const synthesisRequest = {
    intent: direction.intent,
    deterministicSeed: request.data.deterministicSeed,
  } as const;
  const rankedCandidates = compatibleCoordinatedDirectionCandidateMaterial(direction, input)
    .filter((candidate) => characteristicsMatch(candidate, request.data))
    .map((candidate) => ({
      candidate,
      rank: canonicalValueFingerprint({
        seed: request.data.deterministicSeed,
        direction: direction.authorityFingerprint,
        candidate,
      }),
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank));
  if (rankedCandidates.length === 0) {
    throw new CoordinatedStorefrontDirectionError(
      "unsupported-characteristic",
      `${direction.id} has no registered selection matching the requested characteristics.`,
    );
  }

  let lastFailure: unknown;
  for (const { candidate } of rankedCandidates) {
    const narrowing = coordinatedDirectionNarrowingForCandidate(direction, candidate);
    try {
      const decision = createBoundedStorefrontSynthesisDecision({
        ...input,
        request: synthesisRequest,
        selectionNarrowing: narrowing,
      });
      const brandSystem = registeredBrandSystemForDirection(
        input.planningInput.draft.brandSystem,
        input.planningInput.recipeContext.designSystem,
        candidate.directionId,
        {
          spacingDensity: candidate.designSystemSpacingDensity,
          surfaceDepth: candidate.designSystemSurfaceDepth,
        },
      );
      const designDna = resolveBrandSystemDesignDna(brandSystem);
      validateDesignDna(direction, designDna);
      const diversity = createStorefrontDiversityFingerprint({ decision, designDna, direction });
      const directionFingerprint = `coordinated-direction-selection-${canonicalValueFingerprint({
        authority: direction.authorityFingerprint,
        designDna: diversity.dimensions.designDna,
        frame: diversity.dimensions.sharedFrame,
        profiles: diversity.dimensions.pageProfiles,
        components: diversity.dimensions.componentAnatomies,
        art: diversity.dimensions.artDirection,
        density: diversity.dimensions.density,
        merchandising: decision.merchandisingPosture,
        narrative: diversity.dimensions.narrative,
        responsive: diversity.dimensions.responsive,
      })}`;
      const isMeaningfullyUnused = (input.usedDiversityFingerprints ?? []).every(
        (used) =>
          compareStorefrontDiversity(used, diversity).classification === "materially-different",
      );
      if (!isMeaningfullyUnused) continue;
      return Object.freeze({
        direction: structuredClone(direction),
        narrowing: structuredClone(narrowing),
        decision: structuredClone(decision),
        designDna: structuredClone(designDna),
        directionFingerprint,
        diversity: structuredClone(diversity),
      });
    } catch (error) {
      if (!mayTryAnotherCandidate(error)) throw error;
      lastFailure = error;
    }
  }
  throw new CoordinatedStorefrontDirectionError(
    "no-valid-diversity",
    `${direction.id} has no unused, materially distinct selection compatible with current authority.`,
    lastFailure ? { cause: lastFailure } : undefined,
  );
}

export function executeCoordinatedDirection(
  input: CoordinatedDirectionExecutionInput,
): CoordinatedDirectionResult {
  const selection = createCoordinatedDirectionSelection({
    planningInput: input.planningInput,
    siteMapDecision: input.siteMapDecision,
    approvedEvidenceReferences: input.approvedEvidenceReferences,
    request: {
      intent: "editorial-led",
      deterministicSeed: input.directionRequest.deterministicSeed,
    },
    directionRequest: input.directionRequest,
    usedDiversityFingerprints: input.usedDiversityFingerprints,
  });
  const request = {
    intent: selection.direction.intent,
    deterministicSeed: input.directionRequest.deterministicSeed,
  } as const;
  const synthesis = executeBoundedStorefrontSynthesis({
    ...input,
    request,
    selectionNarrowing: selection.narrowing,
    decision: selection.decision,
  });
  return Object.freeze({ ...selection, synthesis });
}

/**
 * Enumerates only posture tuples that the current coordinated-direction and bounded-synthesis
 * authorities can fully execute. The candidate inventory and compatibility checks remain singular
 * in this module; provider adapters receive only the safe projection built from these results.
 */
export function listExecutableCoordinatedDirectionIntents(
  input: Omit<
    CoordinatedDirectionExecutionInput,
    "directionRequest" | "usedDiversityFingerprints"
  > &
    Readonly<{
      directionId: CoordinatedStorefrontDirectionId;
      currentAuthorityFingerprint: string;
    }>,
  options: Readonly<{ maximumIntents?: number }> = {},
): readonly ExecutableCoordinatedDirectionIntent[] {
  const maximumIntents = options.maximumIntents ?? Number.POSITIVE_INFINITY;
  if (
    maximumIntents !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maximumIntents) || maximumIntents < 1)
  ) {
    throw new CoordinatedStorefrontDirectionError(
      "unsupported-characteristic",
      "Executable coordinated-direction intent enumeration requires a positive limit.",
    );
  }
  const direction = getCoordinatedStorefrontDirection(input.directionId);
  const authorityInput: BoundedStorefrontSynthesisInput = {
    planningInput: input.planningInput,
    siteMapDecision: input.siteMapDecision,
    approvedEvidenceReferences: input.approvedEvidenceReferences,
    request: { intent: direction.intent, deterministicSeed: "executable-intent-enumeration" },
  };
  const uniqueCharacteristics = new Map<string, ExecutableCoordinatedDirectionCharacteristics>();
  for (const candidate of compatibleCoordinatedDirectionCandidateMaterial(
    direction,
    authorityInput,
  )) {
    const characteristics = postureCharacteristics(candidate);
    uniqueCharacteristics.set(canonicalValueFingerprint(characteristics), characteristics);
  }

  const executable: ExecutableCoordinatedDirectionIntent[] = [];
  const structuralFingerprints = new Set<string>();
  for (const [characteristicsFingerprint, characteristics] of [...uniqueCharacteristics].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const intentId = `coordinated-executable-intent-${direction.id}-${characteristicsFingerprint}`;
    const deterministicSeed = executableCoordinatedDirectionDeterministicSeed({
      currentAuthorityFingerprint: input.currentAuthorityFingerprint,
      directionAuthorityFingerprint: direction.authorityFingerprint,
      intentId,
    });
    let result: CoordinatedDirectionResult;
    try {
      result = executeCoordinatedDirection({
        planningInput: input.planningInput,
        siteMapDecision: input.siteMapDecision,
        approvedEvidenceReferences: input.approvedEvidenceReferences,
        pageEvidenceAuthority: input.pageEvidenceAuthority,
        contentFactAuthority: input.contentFactAuthority,
        approvedAssetPresentations: input.approvedAssetPresentations,
        directionRequest: {
          directionId: direction.id,
          deterministicSeed,
          characteristics,
        },
      });
    } catch (error) {
      if (!mayTryAnotherCandidate(error)) throw error;
      continue;
    }
    if (structuralFingerprints.has(result.diversity.structuralFingerprint)) continue;
    structuralFingerprints.add(result.diversity.structuralFingerprint);
    executable.push(Object.freeze({ intentId, deterministicSeed, characteristics, result }));
    if (executable.length === maximumIntents) break;
  }
  return Object.freeze(executable);
}

export function executeCoordinatedDirectionAlternatives(
  input: CoordinatedDirectionExecutionInput & Readonly<{ count: number }>,
): readonly CoordinatedDirectionResult[] {
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 12) {
    throw new CoordinatedStorefrontDirectionError(
      "unsupported-characteristic",
      "A coordinated direction batch must request between one and twelve alternatives.",
    );
  }
  const results: CoordinatedDirectionResult[] = [];
  const used = [...(input.usedDiversityFingerprints ?? [])];
  for (let index = 0; index < input.count; index += 1) {
    const result = executeCoordinatedDirection({ ...input, usedDiversityFingerprints: used });
    results.push(result);
    used.push(result.diversity);
  }
  return Object.freeze(results);
}
