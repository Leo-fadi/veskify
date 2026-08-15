import {
  CompatibleCoordinatedDirectionCandidateBudgetError,
  listCompatibleCoordinatedDirectionFactorizedCandidates,
  resolveCompatibleCoordinatedDirectionPostureFactors,
  type BoundedStorefrontSynthesisSelectionNarrowing,
  type CompatibleCoordinatedDirectionFactorizedCandidate,
  type CompatibleCoordinatedDirectionNarrowingInput,
  type CompatibleCoordinatedDirectionPostureFactors,
} from "@/application/bounded-storefront-synthesis";
import { registeredBrandSystemForDirection } from "@/application/storefront-design-system";
import {
  DERIVED_SEMANTIC_CAPABILITY_INDEX_V1,
  semanticStorefrontDesignIntentFingerprint,
  semanticStorefrontDesignIntentV1Schema,
  semanticStorefrontDesignRequestV1Schema,
  type SemanticProviderDriverPath,
  type SemanticStorefrontDesignIntentV1,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent/semantic-contract";
import { resolveBrandSystemDesignDna } from "@/domain/design-system";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  semanticExactInfluenceAxesFor,
  semanticFeaturesFor,
  semanticOptionalFamilies,
  uniqueSemanticValues,
  type SemanticExactInfluenceAxisMap,
  type SemanticFeatureMap,
} from "./semantic-capability-features";
import {
  deriveSemanticInfluenceAuthority,
  semanticFieldCanDriveSelection,
  semanticInfluenceFieldAuthority,
  type SemanticInfluenceAuthority,
  type SemanticInfluenceMode,
  type SemanticInfluenceReasonCode,
} from "./semantic-influence-authority";
const SEMANTIC_COMPATIBILITY_WEIGHT_AUTHORITY_VERSION = "1.1.0" as const;

type RequestedSemanticPreference = Readonly<{
  path: SemanticProviderDriverPath;
  value: string;
  weight: number;
}>;

type ExplicitConstraint = SemanticStorefrontDesignRequestV1["explicitConstraintAuthority"][number];

function semanticStorefrontScoringPreferences(
  intent: SemanticStorefrontDesignIntentV1,
): readonly RequestedSemanticPreference[] {
  return (
    [
      ["commercialPosture", intent.commercialPosture, 320],
      ["globalVisualIntent.density", intent.globalVisualIntent.density, 42],
      ["sharedFrameIntent.navigationPosture", intent.sharedFrameIntent.navigationPosture, 72],
      ["homepageIntent.storyCatalogueBalance", intent.homepageIntent.storyCatalogueBalance, 76],
      ["collectionIntent.discoveryPosture", intent.collectionIntent.discoveryPosture, 68],
      ["pdpIntent.configurableProductPosture", intent.pdpIntent.configurableProductPosture, 68],
      [
        "responsiveAndArtDirectionIntent.mobileHierarchy",
        intent.responsiveAndArtDirectionIntent.mobileHierarchy,
        58,
      ],
      [
        "responsiveAndArtDirectionIntent.imageProminence",
        intent.responsiveAndArtDirectionIntent.imageProminence,
        58,
      ],
    ] as const
  ).map(([path, value, weight]) => ({ path, value, weight }));
}

export const SEMANTIC_COMPATIBILITY_DIAGNOSTIC_VERSION = "1.1.0" as const;
export const SEMANTIC_CAPABILITY_MAPPING_AUTHORITY_VERSION = "1.2.0" as const;
export const MAX_SEMANTIC_INFLUENCE_FACTOR_EVALUATIONS = 4_096 as const;

export type DerivedSemanticCapabilityCandidate = Readonly<{
  candidateFingerprint: string;
  selection: BoundedStorefrontSynthesisSelectionNarrowing;
  factorizedCandidate: CompatibleCoordinatedDirectionFactorizedCandidate;
  structuralFingerprint: string;
  semanticFeatures: SemanticFeatureMap;
  exactAxes: SemanticExactInfluenceAxisMap;
}>;

export type DerivedSemanticCapabilityIndex = Readonly<{
  contractVersion: typeof DERIVED_SEMANTIC_CAPABILITY_INDEX_V1;
  currentAuthorityFingerprint: string;
  weightAuthorityVersion: typeof SEMANTIC_COMPATIBILITY_WEIGHT_AUTHORITY_VERSION;
  mappingAuthorityVersion: typeof SEMANTIC_CAPABILITY_MAPPING_AUTHORITY_VERSION;
  candidateCount: number;
  factorEvaluationCount: number;
  influenceSampleCount: number;
  candidates: readonly DerivedSemanticCapabilityCandidate[];
  semanticInfluenceAuthority: SemanticInfluenceAuthority;
  semanticAuthorityFingerprint: string;
}>;

export type SemanticResolutionInfluence = Readonly<{
  path: SemanticProviderDriverPath;
  requestedValue: string;
  selectedValues: readonly string[];
  outcome: "accepted" | "substituted";
  mode: SemanticInfluenceMode;
  reasonCode: SemanticInfluenceReasonCode;
  exactAxisIds: readonly string[];
  scoreContribution: number;
}>;

export type SemanticCompatibilityStageDiagnostic = Readonly<{
  stage:
    | "current-compatible-authority"
    | "trusted-exact-hints"
    | "explicit-hard-constraints"
    | "explicit-avoidances"
    | "required-evidence-and-assets"
    | "semantic-ranking";
  enteringCandidateCount: number;
  remainingCandidateCount: number;
  reasonCodes: readonly string[];
}>;

export type SemanticCompatibilityDiagnostic = Readonly<{
  contractVersion: typeof SEMANTIC_COMPATIBILITY_DIAGNOSTIC_VERSION;
  requestFingerprint: string;
  semanticIntentFingerprint: string;
  semanticAuthorityFingerprint: string;
  influenceAuthorityFingerprint: string;
  initialCandidateCount: number;
  factorEvaluationCount: number;
  finalCandidateCount: number;
  selectedCandidateFingerprint: string | null;
  hardConstraintCount: number;
  avoidConstraintCount: number;
  firstEmptyStage: SemanticCompatibilityStageDiagnostic["stage"] | null;
  stages: readonly SemanticCompatibilityStageDiagnostic[];
  influences: readonly SemanticResolutionInfluence[];
  substitutedPreferencePaths: readonly string[];
  influenceDimensions: readonly string[];
  diversityRepeatAvoided: boolean;
  diagnosticFingerprint: string;
}>;

export type SemanticCompatibilityResolutionResult = Readonly<{
  selection: BoundedStorefrontSynthesisSelectionNarrowing;
  semanticCapabilityIndex: DerivedSemanticCapabilityIndex;
  semanticResolutionFingerprint: string;
  selectedCandidateFingerprint: string;
  selectedStructuralFingerprint: string;
  score: number;
  diagnostic: SemanticCompatibilityDiagnostic;
}>;

const resolutionErrorMessages = {
  "stale-request-authority": "The semantic request or intent does not match current authority.",
  "stale-semantic-authority": "The request or intent does not match semantic authority.",
  "stale-semantic-intent": "The semantic intent fingerprint is stale.",
  "contradictory-explicit-constraints": "Explicit merchant hard requirements are contradictory.",
  "hard-avoid-conflict": "Explicit merchant authority requires and avoids the same constraint.",
  "invalid-trusted-hint": "Trusted exact hints do not resolve through compatible authority.",
  "missing-required-evidence": "Explicitly required approved evidence is unavailable.",
  "missing-required-asset": "An explicitly required approved asset role is unavailable.",
  "unsupported-explicit-constraint": "A merchant constraint is unsupported by semantic authority.",
  "candidate-budget-exhausted": "Semantic authority exceeds the bounded evaluation budget.",
  "no-compatible-selection": "Semantic authority contains no compatible selection.",
} as const;
export type SemanticCompatibilityResolutionErrorCode = keyof typeof resolutionErrorMessages;

export class SemanticCompatibilityResolutionError extends Error {
  constructor(
    readonly code: SemanticCompatibilityResolutionErrorCode,
    message: string,
    readonly diagnostic?: SemanticCompatibilityDiagnostic,
  ) {
    super(message);
    this.name = "SemanticCompatibilityResolutionError";
  }
}

function failResolution(
  code: SemanticCompatibilityResolutionErrorCode,
  diagnostic?: SemanticCompatibilityDiagnostic,
): never {
  throw new SemanticCompatibilityResolutionError(code, resolutionErrorMessages[code], diagnostic);
}

function candidateFingerprint(selection: BoundedStorefrontSynthesisSelectionNarrowing): string {
  const {
    authorityId,
    authorityVersion,
    authorityFingerprint,
    selectionId: _selectionId,
    ...exactSelection
  } = selection;
  void _selectionId;
  return `semantic-candidate-${canonicalValueFingerprint({
    authorityId,
    authorityVersion,
    authorityFingerprint,
    exactSelection,
  })}`;
}

function structuralFingerprint(selection: BoundedStorefrontSynthesisSelectionNarrowing): string {
  return `semantic-structure-${canonicalValueFingerprint({
    directionId: selection.directionId,
    sharedFrameProfileId: selection.sharedFrameProfileId,
    homepageProfileId: selection.homepageProfileId,
    collectionProfileId: selection.collectionProfileId,
    searchProfileId: selection.searchProfileId,
    pdpProfileId: selection.pdpProfileId,
    includedOptionalPageFamilyIds: selection.includedOptionalPageFamilyIds,
    narrativePosture: selection.narrativePosture,
    merchandisingPosture: selection.merchandisingPosture,
    informationDensityPosture: selection.informationDensityPosture,
    artDirectionPosture: selection.artDirectionPosture,
    responsiveMode: selection.responsiveMode,
  })}`;
}

function projectionFor(
  selection: BoundedStorefrontSynthesisSelectionNarrowing,
  authority: CompatibleCoordinatedDirectionNarrowingInput,
) {
  const designDna = resolveBrandSystemDesignDna(
    registeredBrandSystemForDirection(
      authority.planningInput.draft.brandSystem,
      authority.planningInput.recipeContext.designSystem,
      selection.directionId,
      {
        spacingDensity: selection.designSystemSpacingDensity,
        surfaceDepth: selection.designSystemSurfaceDepth,
      },
    ),
  );
  return Object.freeze({
    semanticFeatures: semanticFeaturesFor(selection),
    exactAxes: semanticExactInfluenceAxesFor(selection, designDna),
  });
}

function postureFactors(
  selection: BoundedStorefrontSynthesisSelectionNarrowing,
): CompatibleCoordinatedDirectionPostureFactors {
  return {
    narrativePosture: selection.narrativePosture,
    merchandisingPosture: selection.merchandisingPosture,
    informationDensityPosture: selection.informationDensityPosture,
    artDirectionPosture: selection.artDirectionPosture,
    responsiveMode: selection.responsiveMode,
  };
}

const factorDrivers = [
  ["narrativePosture", "narrativePostureOptions", "homepageIntent.storyCatalogueBalance"],
  ["merchandisingPosture", "merchandisingPostureOptions", "collectionIntent.discoveryPosture"],
  ["informationDensityPosture", "informationDensityPostureOptions", "globalVisualIntent.density"],
  [
    "artDirectionPosture",
    "artDirectionPostureOptions",
    "responsiveAndArtDirectionIntent.imageProminence",
  ],
  ["responsiveMode", "responsiveModeOptions", "responsiveAndArtDirectionIntent.mobileHierarchy"],
] as const;

function uniqueByFingerprint<Value>(
  values: readonly Value[],
  fingerprint: (value: Value) => string,
): readonly Value[] {
  return [...new Map(values.map((value) => [fingerprint(value), value] as const)).values()];
}

function influenceSelections(
  candidate: CompatibleCoordinatedDirectionFactorizedCandidate,
): readonly BoundedStorefrontSynthesisSelectionNarrowing[] {
  const base = postureFactors(candidate.backbone);
  const factors: CompatibleCoordinatedDirectionPostureFactors[] = [
    base,
    ...factorDrivers.flatMap(([factor, options]) =>
      candidate[options].map((value) => ({ ...base, [factor]: value })),
    ),
  ];
  return uniqueByFingerprint(factors, (selected) =>
    canonicalValueFingerprint({
      backboneSelectionId: candidate.backbone.selectionId,
      factors: selected,
    }),
  ).map((selected) => ({ ...candidate.backbone, ...selected }));
}

export function deriveSemanticCapabilityIndex(input: {
  authority: CompatibleCoordinatedDirectionNarrowingInput;
  currentAuthorityFingerprint: string;
  maximumCandidateEvaluations?: number;
  maximumFactorEvaluations?: number;
}): DerivedSemanticCapabilityIndex {
  let factorized: readonly CompatibleCoordinatedDirectionFactorizedCandidate[];
  try {
    factorized = listCompatibleCoordinatedDirectionFactorizedCandidates(input.authority, {
      ...(input.maximumCandidateEvaluations === undefined
        ? {}
        : { maximumCandidateEvaluations: input.maximumCandidateEvaluations }),
    });
  } catch (error) {
    if (error instanceof CompatibleCoordinatedDirectionCandidateBudgetError) {
      failResolution("candidate-budget-exhausted");
    }
    throw error;
  }
  const candidates = factorized.map((factorizedCandidate) => {
    const selection = factorizedCandidate.backbone;
    const projection = projectionFor(selection, input.authority);
    return Object.freeze({
      candidateFingerprint: candidateFingerprint(selection),
      selection,
      factorizedCandidate,
      structuralFingerprint: structuralFingerprint(selection),
      ...projection,
    });
  });
  const maximumFactorEvaluations =
    input.maximumFactorEvaluations ?? MAX_SEMANTIC_INFLUENCE_FACTOR_EVALUATIONS;
  const factorEvaluationCount = factorized.reduce(
    (total, candidate) =>
      total +
      1 +
      factorDrivers.reduce((count, [, options]) => count + candidate[options].length, 0),
    0,
  );
  if (
    !Number.isSafeInteger(maximumFactorEvaluations) ||
    maximumFactorEvaluations <= 0 ||
    factorEvaluationCount > maximumFactorEvaluations
  )
    failResolution("candidate-budget-exhausted");
  const influenceSamples = uniqueByFingerprint(
    factorized
      .flatMap((candidate) => influenceSelections(candidate))
      .map((selection) =>
        Object.freeze({ selection, ...projectionFor(selection, input.authority) }),
      ),
    ({ selection }) => candidateFingerprint(selection),
  );
  const semanticInfluenceAuthority = deriveSemanticInfluenceAuthority(influenceSamples);
  const material = {
    contractVersion: DERIVED_SEMANTIC_CAPABILITY_INDEX_V1,
    currentAuthorityFingerprint: input.currentAuthorityFingerprint,
    weightAuthorityVersion: SEMANTIC_COMPATIBILITY_WEIGHT_AUTHORITY_VERSION,
    mappingAuthorityVersion: SEMANTIC_CAPABILITY_MAPPING_AUTHORITY_VERSION,
    candidateCount: candidates.length,
    factorEvaluationCount,
    influenceSampleCount: influenceSamples.length,
    candidates,
    semanticInfluenceAuthority,
  };
  return Object.freeze({
    ...material,
    candidates: Object.freeze(candidates),
    semanticAuthorityFingerprint: `semantic-capability-index-${canonicalValueFingerprint(material)}`,
  });
}

function assertRequestAndIntent(
  requestInput: SemanticStorefrontDesignRequestV1,
  intentInput: SemanticStorefrontDesignIntentV1,
) {
  const request = semanticStorefrontDesignRequestV1Schema.parse(requestInput);
  const intent = semanticStorefrontDesignIntentV1Schema.parse(intentInput);
  if (
    intent.requestFingerprint !== request.requestFingerprint ||
    intent.promptFingerprint !== request.promptFingerprint ||
    intent.currentAuthorityFingerprint !== request.currentAuthorityFingerprint
  )
    failResolution("stale-request-authority");
  const { semanticIntentFingerprint, ...material } = intent;
  if (semanticIntentFingerprint !== semanticStorefrontDesignIntentFingerprint(material))
    failResolution("stale-semantic-intent");
  return { request, intent };
}

function candidateSatisfiesConstraint(
  candidate: DerivedSemanticCapabilityCandidate,
  constraint: ExplicitConstraint,
): boolean {
  if (constraint.field === "commercial-posture") {
    return (candidate.semanticFeatures.commercialPosture ?? []).includes(constraint.value);
  }
  if (constraint.field === "shared-frame-family") {
    return candidate.selection.sharedFrameProfileId === constraint.value;
  }
  return (
    constraint.field !== "required-evidence" ||
    semanticOptionalFamilies(candidate.selection).includes(constraint.value)
  );
}

function validatedConstraints(
  request: SemanticStorefrontDesignRequestV1,
  index: DerivedSemanticCapabilityIndex,
): Readonly<{ hard: readonly ExplicitConstraint[]; avoided: readonly ExplicitConstraint[] }> {
  const hard = request.explicitConstraintAuthority.filter(({ semantics }) => semantics === "hard");
  const avoided = request.explicitConstraintAuthority.filter(
    ({ semantics }) => semantics === "avoid",
  );
  if (
    request.explicitConstraintAuthority.some(
      (constraint) =>
        constraint.field !== "required-asset-role" &&
        (constraint.field === "required-evidence"
          ? !request.supportedPageFamilies.includes(
              constraint.value as (typeof request.supportedPageFamilies)[number],
            )
          : !index.candidates.some((candidate) =>
              candidateSatisfiesConstraint(candidate, constraint),
            )),
    )
  )
    failResolution("unsupported-explicit-constraint");
  const constraintKey = ({ field, value }: ExplicitConstraint) => `${field}:${value}`;
  const hardKeys = new Set(hard.map(constraintKey));
  const hardAvoidConflict = avoided.some((constraint) => hardKeys.has(constraintKey(constraint)));
  const contradictoryHard = (["commercial-posture", "shared-frame-family"] as const).some(
    (field) =>
      new Set(hard.filter((constraint) => constraint.field === field).map(constraintKey)).size > 1,
  );
  const conflictCode = hardAvoidConflict
    ? "hard-avoid-conflict"
    : contradictoryHard
      ? "contradictory-explicit-constraints"
      : null;
  if (conflictCode) failResolution(conflictCode);
  return { hard, avoided };
}

function assertRequiredResources(
  hard: readonly ExplicitConstraint[],
  request: SemanticStorefrontDesignRequestV1,
  authority: CompatibleCoordinatedDirectionNarrowingInput,
): void {
  const approvedAssets = authority.planningInput.approvedAssetContext?.assets ?? [];
  const missing = hard.find(
    ({ field, value }) =>
      (field === "required-evidence" &&
        !request.evidenceAvailability.approvedFamilies.includes(
          value as (typeof request.evidenceAvailability.approvedFamilies)[number],
        )) ||
      (field === "required-asset-role" && !approvedAssets.some(({ role }) => role === value)),
  );
  if (!missing) return;
  failResolution(
    missing.field === "required-evidence" ? "missing-required-evidence" : "missing-required-asset",
  );
}

function stage(
  stageId: SemanticCompatibilityStageDiagnostic["stage"],
  entering: number,
  remaining: number,
  reasonCodes: readonly string[] = [],
): SemanticCompatibilityStageDiagnostic {
  return Object.freeze({
    stage: stageId,
    enteringCandidateCount: entering,
    remainingCandidateCount: remaining,
    reasonCodes: uniqueSemanticValues(reasonCodes).slice(0, 12),
  });
}

function safeDiagnostic(
  material: Omit<SemanticCompatibilityDiagnostic, "diagnosticFingerprint">,
): SemanticCompatibilityDiagnostic {
  return Object.freeze({
    ...material,
    stages: Object.freeze([...material.stages]),
    influences: Object.freeze([...material.influences].slice(0, 16)),
    substitutedPreferencePaths: uniqueSemanticValues(material.substitutedPreferencePaths).slice(
      0,
      16,
    ),
    influenceDimensions: uniqueSemanticValues(material.influenceDimensions).slice(0, 16),
    diagnosticFingerprint: `semantic-compatibility-diagnostic-${canonicalValueFingerprint(material)}`,
  });
}

function selectPostureFactors(input: {
  candidate: DerivedSemanticCapabilityCandidate;
  preferences: readonly RequestedSemanticPreference[];
  influenceAuthority: SemanticInfluenceAuthority;
}): CompatibleCoordinatedDirectionPostureFactors {
  let selectedFactors = postureFactors(input.candidate.selection);
  for (const [factor, optionField, path] of factorDrivers) {
    const requested = input.preferences.find((preference) => preference.path === path)!;
    const fieldAuthority = semanticInfluenceFieldAuthority(input.influenceAuthority, path);
    const mayDrive =
      semanticFieldCanDriveSelection(fieldAuthority) &&
      fieldAuthority.supportedValues.includes(requested.value);
    if (!mayDrive) continue;
    const matchedOptions = input.candidate.factorizedCandidate[optionField]
      .map((option) => {
        const factors = { ...selectedFactors, [factor]: option };
        const selection = { ...input.candidate.selection, ...factors };
        const values = semanticFeaturesFor(selection)[path] ?? [];
        return { option, matched: values.includes(requested.value) };
      })
      .filter(({ matched }) => matched)
      .sort((left, right) => left.option.localeCompare(right.option));
    const selected = matchedOptions[0];
    if (selected) selectedFactors = { ...selectedFactors, [factor]: selected.option };
  }
  return selectedFactors;
}

function semanticInfluence(input: {
  requested: RequestedSemanticPreference;
  selectedValues: readonly string[];
  authority: SemanticInfluenceAuthority;
}): SemanticResolutionInfluence {
  const field = semanticInfluenceFieldAuthority(input.authority, input.requested.path);
  const driver = field.relationships.find(
    ({ mode }) => mode === "direct" || mode === "compound-driver",
  );
  const supported = field.supportedValues.includes(input.requested.value);
  const matched = input.selectedValues.includes(input.requested.value);
  const mode: SemanticInfluenceMode = supported
    ? (driver?.mode ?? field.relationships[0]?.mode ?? "unavailable")
    : "substitution-only";
  const reasonCode: SemanticInfluenceReasonCode = supported
    ? (driver?.reasonCode ?? field.relationships[0]?.reasonCode ?? "single-compatible-exact-value")
    : "correlated-candidate-substitution";
  const canDrive = supported && (mode === "direct" || mode === "compound-driver");
  return Object.freeze({
    path: input.requested.path,
    requestedValue: input.requested.value,
    selectedValues: input.selectedValues,
    outcome: canDrive && matched ? "accepted" : "substituted",
    mode,
    reasonCode,
    exactAxisIds: field.relationships.map(({ exactAxisId }) => exactAxisId),
    scoreContribution: canDrive && matched ? input.requested.weight : 0,
  });
}

export function resolveSemanticStorefrontCompatibility(input: {
  request: SemanticStorefrontDesignRequestV1;
  intent: SemanticStorefrontDesignIntentV1;
  compatibilityInput: CompatibleCoordinatedDirectionNarrowingInput;
  semanticCapabilityIndex?: DerivedSemanticCapabilityIndex;
  trustedCurrentAuthorityFingerprint?: string;
  maximumCandidateEvaluations?: number;
  maximumFactorEvaluations?: number;
  usedDiversityFingerprints?: readonly string[];
}): SemanticCompatibilityResolutionResult {
  const { request, intent } = assertRequestAndIntent(input.request, input.intent);
  const trustedCurrentAuthorityFingerprint =
    input.trustedCurrentAuthorityFingerprint ?? request.currentAuthorityFingerprint;
  if (request.currentAuthorityFingerprint !== trustedCurrentAuthorityFingerprint)
    failResolution("stale-request-authority");
  const index =
    input.semanticCapabilityIndex ??
    deriveSemanticCapabilityIndex({
      authority: input.compatibilityInput,
      currentAuthorityFingerprint: trustedCurrentAuthorityFingerprint,
      ...(input.maximumCandidateEvaluations === undefined
        ? {}
        : { maximumCandidateEvaluations: input.maximumCandidateEvaluations }),
      ...(input.maximumFactorEvaluations === undefined
        ? {}
        : { maximumFactorEvaluations: input.maximumFactorEvaluations }),
    });
  const semanticAuthorityIsCurrent =
    index.currentAuthorityFingerprint === trustedCurrentAuthorityFingerprint &&
    [request.semanticAuthorityFingerprint, intent.semanticAuthorityFingerprint].every(
      (fingerprint) => fingerprint === index.semanticAuthorityFingerprint,
    ) &&
    request.semanticInfluenceAuthority.authorityFingerprint ===
      index.semanticInfluenceAuthority.authorityFingerprint &&
    canonicalValueFingerprint(request.semanticInfluenceAuthority) ===
      canonicalValueFingerprint(index.semanticInfluenceAuthority);
  if (!semanticAuthorityIsCurrent) failResolution("stale-semantic-authority");
  const { hard, avoided } = validatedConstraints(request, index);

  let candidates = [...index.candidates];
  const stages: SemanticCompatibilityStageDiagnostic[] = [
    stage("current-compatible-authority", candidates.length, candidates.length),
  ];
  const filterAt = (
    stageId: SemanticCompatibilityStageDiagnostic["stage"],
    reasonCode: string,
    predicate: (candidate: DerivedSemanticCapabilityCandidate) => boolean,
  ) => {
    const entering = candidates.length;
    candidates = candidates.filter(predicate);
    stages.push(
      stage(
        stageId,
        entering,
        candidates.length,
        entering === candidates.length ? [] : [reasonCode],
      ),
    );
  };
  const { directionPackageId, frameFamilyId } = request.trustedExactHints;
  filterAt(
    "trusted-exact-hints",
    "trusted-exact-hint-filtered",
    ({ selection }) =>
      (directionPackageId === null ||
        selection.authorityId === `coordinated-direction:${directionPackageId}`) &&
      (frameFamilyId === null || selection.sharedFrameProfileId === frameFamilyId),
  );
  if (candidates.length === 0) failResolution("invalid-trusted-hint");

  assertRequiredResources(hard, request, input.compatibilityInput);
  filterAt("explicit-hard-constraints", "explicit-hard-filtered", (candidate) =>
    hard.every((constraint) => candidateSatisfiesConstraint(candidate, constraint)),
  );
  filterAt("explicit-avoidances", "explicit-avoidance-filtered", (candidate) =>
    avoided.every(
      (constraint) =>
        constraint.field === "required-asset-role" ||
        !candidateSatisfiesConstraint(candidate, constraint),
    ),
  );
  const diagnosticBase = {
    contractVersion: SEMANTIC_COMPATIBILITY_DIAGNOSTIC_VERSION,
    requestFingerprint: request.requestFingerprint,
    semanticIntentFingerprint: intent.semanticIntentFingerprint,
    semanticAuthorityFingerprint: index.semanticAuthorityFingerprint,
    influenceAuthorityFingerprint: index.semanticInfluenceAuthority.authorityFingerprint,
    initialCandidateCount: index.candidateCount,
    factorEvaluationCount: index.factorEvaluationCount,
    hardConstraintCount: hard.length,
    avoidConstraintCount: avoided.length,
    stages,
  } as const;
  if (candidates.length === 0) {
    const firstEmptyStage = stages.find(
      ({ remainingCandidateCount }) => remainingCandidateCount === 0,
    )?.stage;
    const diagnostic = safeDiagnostic({
      ...diagnosticBase,
      finalCandidateCount: 0,
      selectedCandidateFingerprint: null,
      firstEmptyStage: firstEmptyStage ?? "explicit-avoidances",
      influences: [],
      substitutedPreferencePaths: [],
      influenceDimensions: [],
      diversityRepeatAvoided: false,
    });
    failResolution("no-compatible-selection", diagnostic);
  }
  stages.push(stage("required-evidence-and-assets", candidates.length, candidates.length));

  const preferences = semanticStorefrontScoringPreferences(intent);
  const usedDiversity = new Set(input.usedDiversityFingerprints ?? []);
  const ranked = candidates
    .map((candidate) => {
      const selectedFactors = selectPostureFactors({
        candidate,
        preferences,
        influenceAuthority: index.semanticInfluenceAuthority,
      });
      const selection = { ...candidate.selection, ...selectedFactors };
      const projection = projectionFor(selection, input.compatibilityInput);
      const influences = preferences.map((requested) =>
        semanticInfluence({
          requested,
          selectedValues: projection.semanticFeatures[requested.path] ?? [],
          authority: index.semanticInfluenceAuthority,
        }),
      );
      const resolvedCandidateFingerprint = candidateFingerprint(selection);
      const resolvedStructuralFingerprint = structuralFingerprint(selection);
      const diversityRepeat =
        usedDiversity.has(resolvedCandidateFingerprint) ||
        usedDiversity.has(resolvedStructuralFingerprint);
      return {
        entry: candidate,
        selectedFactors,
        candidateFingerprint: resolvedCandidateFingerprint,
        structuralFingerprint: resolvedStructuralFingerprint,
        score:
          influences.reduce((total, influence) => total + influence.scoreContribution, 0) -
          (diversityRepeat ? 10_000 : 0),
        influences,
        diversityRepeat,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidateFingerprint.localeCompare(right.candidateFingerprint),
    );
  const selected = ranked[0];
  if (!selected) failResolution("no-compatible-selection");
  const finalSelection = resolveCompatibleCoordinatedDirectionPostureFactors({
    factorizedCandidate: selected.entry.factorizedCandidate,
    factors: selected.selectedFactors,
  });
  stages.push(stage("semantic-ranking", candidates.length, 1, ["highest-weighted-compatible"]));
  const substitutions = selected.influences
    .filter(({ outcome }) => outcome === "substituted")
    .map(({ path }) => path);
  const accepted = selected.influences
    .filter(({ outcome }) => outcome === "accepted")
    .map(({ path }) => path);
  const diagnostic = safeDiagnostic({
    ...diagnosticBase,
    finalCandidateCount: 1,
    selectedCandidateFingerprint: selected.candidateFingerprint,
    firstEmptyStage: null,
    influences: selected.influences,
    substitutedPreferencePaths: substitutions,
    influenceDimensions: accepted.map((path) => path.split(".")[0] ?? path),
    diversityRepeatAvoided:
      usedDiversity.size > 0 &&
      ranked.some(({ diversityRepeat }) => diversityRepeat) &&
      !selected.diversityRepeat,
  });
  return Object.freeze({
    selection: Object.freeze(structuredClone(finalSelection)),
    semanticCapabilityIndex: index,
    semanticResolutionFingerprint: diagnostic.diagnosticFingerprint,
    selectedCandidateFingerprint: selected.candidateFingerprint,
    selectedStructuralFingerprint: selected.structuralFingerprint,
    score: selected.score,
    diagnostic,
  });
}
