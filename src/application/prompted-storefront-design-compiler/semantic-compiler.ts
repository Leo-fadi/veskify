import {
  createBoundedStorefrontSynthesisDecision,
  isCurrentCompatibleCoordinatedDirectionExactSelection,
  type BoundedStorefrontSynthesisDecision,
} from "@/application/bounded-storefront-synthesis";
import {
  createPromptedStorefrontDesignRequestV2,
  createSemanticStorefrontDesignRequestV1,
  semanticStorefrontCurrentAuthorityFingerprint,
  validateSemanticStorefrontDesignIntentV1,
  type CreatePromptedStorefrontDesignRequestV2Input,
  type SemanticStorefrontDesignIntentV1,
  type SemanticStorefrontDesignRequestV1,
} from "@/application/prompted-storefront-design-intent";
import {
  listCommercialContentSupportProfiles,
  listCommercialUtilityProfiles,
} from "@/application/storefront-templates";
import * as plan from "@/application/whole-storefront-generation-plan/contract";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  getCommercialSharedFrameProfile,
} from "@/domain/storefront";
import {
  COMPILED_PROMPTED_STOREFRONT_DESIGN_DECISION_V2,
  compiledPromptedStorefrontDesignDecisionFingerprint,
  compiledPromptedStorefrontDesignDecisionV2Schema,
  PromptedStorefrontDesignCompilerError,
} from "./contract";
import {
  assertPromptedStorefrontPlanningAuthorityBound,
  resolvePromptedStorefrontExactProfileReference,
  resolvePromptedStorefrontSemanticExecutionAuthority,
  type PromptedStorefrontCompilerAuthorityInput,
} from "./compiler";
import {
  deriveSemanticCapabilityIndex,
  resolveSemanticStorefrontCompatibility,
  type DerivedSemanticCapabilityIndex,
  type SemanticCompatibilityResolutionResult,
} from "./semantic-compatibility-resolution";

type SemanticStorefrontDesignCompilationAuthorityInput = Readonly<{
  originalRequest: SemanticStorefrontDesignRequestV1;
  currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input;
  compatibilityInput: PromptedStorefrontCompilerAuthorityInput["compatibilityInput"];
  semanticCapabilityIndex?: DerivedSemanticCapabilityIndex;
  maximumCandidateEvaluations?: number;
}>;

export type SemanticStorefrontDesignRequestAuthority = Readonly<{
  explicitConstraintAuthority: SemanticStorefrontDesignRequestV1["explicitConstraintAuthority"];
  trustedExactHints: SemanticStorefrontDesignRequestV1["trustedExactHints"];
}>;

export type CompileSemanticStorefrontDesignIntentV1Input =
  SemanticStorefrontDesignCompilationAuthorityInput &
    Readonly<{
      providerIntent: SemanticStorefrontDesignIntentV1;
      preparedAuthority?: ReturnType<typeof prepareSemanticStorefrontDesignCompilationAuthority>;
    }>;

function fail(message: string): never {
  throw new PromptedStorefrontDesignCompilerError("stale-authority", message);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function selectedProfileIdentities(
  decision: BoundedStorefrontSynthesisDecision,
  profiles: readonly Readonly<{ profile?: Readonly<{ id: string }> | null }>[],
): string[] {
  const registeredIds = new Set(profiles.flatMap(({ profile }) => (profile ? [profile.id] : [])));
  return unique(
    decision.pageProfileSelections
      .filter(({ profileId }) => registeredIds.has(profileId))
      .map(({ profileId, profileVersion }) => `${profileId}@${profileVersion}`),
  );
}

function cached<K, V extends object>(cache: Map<K, V>, key: K, create: () => V): V {
  const value = cache.get(key) ?? create();
  cache.set(key, value);
  return value;
}

export function prepareCurrentSemanticStorefrontDesignCompilationAuthority(
  input: Omit<SemanticStorefrontDesignCompilationAuthorityInput, "originalRequest"> &
    Readonly<{ semanticRequestAuthority: SemanticStorefrontDesignRequestAuthority }>,
) {
  const currentExact = createPromptedStorefrontDesignRequestV2(input.currentRequestInput);
  const candidateBudget =
    input.maximumCandidateEvaluations === undefined
      ? {}
      : { maximumCandidateEvaluations: input.maximumCandidateEvaluations };
  const compilerAuthority: PromptedStorefrontCompilerAuthorityInput = {
    originalRequest: currentExact.request,
    currentRequestInput: input.currentRequestInput,
    compatibilityInput: input.compatibilityInput,
    ...candidateBudget,
  };
  assertPromptedStorefrontPlanningAuthorityBound(compilerAuthority);
  const currentAuthorityFingerprint = semanticStorefrontCurrentAuthorityFingerprint(
    currentExact.request.currentAuthority,
  );
  const semanticCapabilityIndex =
    input.semanticCapabilityIndex ??
    deriveSemanticCapabilityIndex({
      authority: input.compatibilityInput,
      currentAuthorityFingerprint,
      ...candidateBudget,
    });
  const semanticRequest = createSemanticStorefrontDesignRequestV1(currentExact, {
    explicitConstraintAuthority: input.semanticRequestAuthority.explicitConstraintAuthority,
    trustedExactHints: input.semanticRequestAuthority.trustedExactHints,
    semanticAuthorityFingerprint: semanticCapabilityIndex.semanticAuthorityFingerprint,
    semanticInfluenceAuthority: semanticCapabilityIndex.semanticInfluenceAuthority,
  });
  const executionAuthorities = new Map<
    string,
    ReturnType<typeof resolvePromptedStorefrontSemanticExecutionAuthority>
  >();
  const synthesisDecisions = new Map<string, BoundedStorefrontSynthesisDecision>();
  const resolveExecutionAuthority = (
    selection: SemanticCompatibilityResolutionResult["selection"],
  ) =>
    cached(
      executionAuthorities,
      `prepared-semantic-selection-${canonicalValueFingerprint(selection)}`,
      () => {
        const { authorityId, authorityVersion, authorityFingerprint, selectionId, ...exact } =
          selection;
        void [authorityId, authorityVersion, authorityFingerprint, selectionId];
        if (
          !isCurrentCompatibleCoordinatedDirectionExactSelection({
            authority: input.compatibilityInput,
            exactSelection: exact,
          })
        )
          fail("The semantic selection is not part of the prepared current authority.");
        return resolvePromptedStorefrontSemanticExecutionAuthority({
          compilerInput: compilerAuthority,
          selection,
          currentExactAuthority: currentExact,
        });
      },
    );
  const resolveSynthesisDecision = (
    candidateFingerprint: string,
    create: () => BoundedStorefrontSynthesisDecision,
  ) => cached(synthesisDecisions, candidateFingerprint, create);
  return Object.freeze({
    candidateBudget,
    compilerAuthority,
    currentExact,
    currentAuthorityFingerprint,
    semanticCapabilityIndex,
    semanticRequest,
    resolveExecutionAuthority,
    resolveSynthesisDecision,
  });
}

export function prepareSemanticStorefrontDesignCompilationAuthority(
  input: SemanticStorefrontDesignCompilationAuthorityInput,
) {
  const prepared = prepareCurrentSemanticStorefrontDesignCompilationAuthority({
    currentRequestInput: input.currentRequestInput,
    compatibilityInput: input.compatibilityInput,
    semanticRequestAuthority: {
      explicitConstraintAuthority: input.originalRequest.explicitConstraintAuthority,
      trustedExactHints: input.originalRequest.trustedExactHints,
    },
    ...(input.semanticCapabilityIndex === undefined
      ? {}
      : { semanticCapabilityIndex: input.semanticCapabilityIndex }),
    ...(input.maximumCandidateEvaluations === undefined
      ? {}
      : { maximumCandidateEvaluations: input.maximumCandidateEvaluations }),
  });
  if (
    canonicalValueString(prepared.semanticRequest) !== canonicalValueString(input.originalRequest)
  )
    fail("The semantic request or current compatibility authority changed.");
  return prepared;
}

export function compileSemanticStorefrontDesignIntentV1(
  input: CompileSemanticStorefrontDesignIntentV1Input,
) {
  const { providerIntent, preparedAuthority, ...authorityInput } = input;
  const prepared =
    preparedAuthority ?? prepareSemanticStorefrontDesignCompilationAuthority(authorityInput);
  if (
    prepared.compilerAuthority.currentRequestInput !== authorityInput.currentRequestInput ||
    prepared.compilerAuthority.compatibilityInput !== authorityInput.compatibilityInput ||
    canonicalValueString(prepared.semanticRequest) !==
      canonicalValueString(authorityInput.originalRequest) ||
    (authorityInput.semanticCapabilityIndex !== undefined &&
      authorityInput.semanticCapabilityIndex.semanticAuthorityFingerprint !==
        prepared.semanticCapabilityIndex.semanticAuthorityFingerprint)
  )
    fail("Prepared semantic compilation authority does not match the supplied current authority.");
  const exactRequest = prepared.currentExact;
  const currentFingerprint = prepared.currentAuthorityFingerprint;
  const semanticIndex = prepared.semanticCapabilityIndex;
  const { semanticIntentFingerprint: previousIntentFingerprint, ...intentMaterial } =
    providerIntent;
  const validatedIntent = validateSemanticStorefrontDesignIntentV1({
    request: prepared.semanticRequest,
    validation: {
      currentAuthorityFingerprint: () => currentFingerprint,
      semanticAuthorityFingerprint: () => semanticIndex.semanticAuthorityFingerprint,
    },
    intent: intentMaterial,
  });
  const resolution = resolveSemanticStorefrontCompatibility({
    request: prepared.semanticRequest,
    intent: validatedIntent,
    compatibilityInput: authorityInput.compatibilityInput,
    semanticCapabilityIndex: semanticIndex,
    trustedCurrentAuthorityFingerprint: currentFingerprint,
    ...prepared.candidateBudget,
    usedDiversityFingerprints: [
      ...exactRequest.request.priorDiversityEvidence.recentAcceptedStructuralFingerprints,
      ...exactRequest.request.priorDiversityEvidence.recentRejectedStructuralFingerprints,
    ],
  });
  const execution = prepared.resolveExecutionAuthority(resolution.selection);
  const selection = resolution.selection;
  const { authorityId, authorityVersion, authorityFingerprint, selectionId, ...exact } = selection;
  void [authorityId, authorityVersion, authorityFingerprint, selectionId];
  const profileOverrides = plan.wholeStorefrontPageBlueprintSelectionOverridesSchema.parse(
    execution.pageBlueprintSelectionOverrides,
  );
  const assetSelections = plan.wholeStorefrontApprovedAssetRoleSelectionsSchema.parse(
    execution.approvedAssetRoleSelections,
  );
  const assetRoleKeys = unique(assetSelections.map(({ assetId, role }) => `${assetId}:${role}`));
  const homepageRoles = [...execution.homepageRoleSequence];
  const dynamicSelection = execution.dynamicCommerceSelection;
  const { searchExecution, productTypeMappings, ...dynamicSynthesisSelection } = dynamicSelection;
  const { authorityFingerprint: dynamicFingerprint, ...dynamicAuthorityIds } =
    dynamicSynthesisSelection;
  void [previousIntentFingerprint, searchExecution];
  const synthesisInput = {
    ...authorityInput.compatibilityInput,
    request: {
      intent: "prompted-design-v2" as const,
      deterministicSeed: `semantic-design-${resolution.selectedCandidateFingerprint.slice(-48)}`,
    },
    exactSelection: exact,
    pageBlueprintSelectionOverrides: profileOverrides,
    approvedAssetRoleSelections: assetSelections,
    dynamicCommerceSelection: {
      ...dynamicSynthesisSelection,
      productTypeMappings: Object.fromEntries(
        productTypeMappings.map(({ productTypeId, archetypeId }) => [productTypeId, archetypeId]),
      ),
    },
    promptedExecutionAuthority: {
      responsiveCapabilityKeys: [selection.responsiveMode],
      artDirectionCapabilityKeys: [selection.artDirectionPosture],
      approvedAssetRoleKeys: assetRoleKeys,
      desktopNarrativePriority: homepageRoles,
      mobileNarrativePriority: homepageRoles,
    },
  };
  const synthesis = prepared.resolveSynthesisDecision(resolution.selectedCandidateFingerprint, () =>
    createBoundedStorefrontSynthesisDecision(synthesisInput),
  );
  const frame = getCommercialSharedFrameProfile(selection.sharedFrameProfileId);
  const profileAuthorityIds: string[] = [];
  const compiledProfile = (profileId: string) => {
    const reference = resolvePromptedStorefrontExactProfileReference(
      exactRequest.capabilityAuthority,
      profileId,
    );
    profileAuthorityIds.push(reference.authorityId);
    return { profileId, authorityFingerprint: reference.authorityFingerprint };
  };
  const profiles = {
    homepage: compiledProfile(selection.homepageProfileId),
    collection: compiledProfile(selection.collectionProfileId),
    search: compiledProfile(selection.searchProfileId),
    productDetail: compiledProfile(selection.pdpProfileId),
  };
  const selectedAuthorityIds = new Set([
    frame.id,
    ...profileAuthorityIds,
    ...synthesis.componentChoices.flatMap(({ component, variant, anatomyId }) => [
      component,
      `${component}:${variant}`,
      ...(anatomyId ? [anatomyId] : []),
    ]),
    ...Object.values(dynamicAuthorityIds),
  ]);
  const capabilityReferences = [
    ...exactRequest.capabilityAuthority.referencesByPreferenceKey.values(),
  ]
    .filter(({ authorityId }) => selectedAuthorityIds.has(authorityId))
    .sort((left, right) => left.key.localeCompare(right.key));
  const diagnostic = resolution.diagnostic;
  const contentProfiles = listCommercialContentSupportProfiles();
  const utilityProfiles = listCommercialUtilityProfiles();
  const currentAuthority = exactRequest.request.currentAuthority;
  const authorityFingerprints = unique([
    currentAuthority.capabilityReferenceAuthorityFingerprint,
    currentAuthority.capabilityManifestFingerprint,
    currentAuthority.pageBlueprintAuthorityFingerprint,
    currentAuthority.designDnaAuthorityFingerprint,
    dynamicFingerprint,
    frame.authorityFingerprint,
    semanticIndex.semanticAuthorityFingerprint,
    resolution.selectedCandidateFingerprint,
    synthesis.synthesisFingerprint,
    ...capabilityReferences.map(({ authorityFingerprint }) => authorityFingerprint),
  ]);
  const material = {
    contractVersion: COMPILED_PROMPTED_STOREFRONT_DESIGN_DECISION_V2,
    identity: {
      requestFingerprint: prepared.semanticRequest.requestFingerprint,
      promptFingerprint: prepared.semanticRequest.promptFingerprint,
      providerIntentFingerprint: validatedIntent.semanticIntentFingerprint,
      currentAuthorityFingerprint: currentFingerprint,
      capabilityReferenceAuthorityFingerprint:
        currentAuthority.capabilityReferenceAuthorityFingerprint,
      baseSnapshotId: currentAuthority.draftSnapshotId,
      baseSnapshotRevision: currentAuthority.draftRevision,
    },
    exactSelection: exact,
    designDna: {
      directionId: selection.directionId,
      authorityFingerprint: `compiled-design-dna-${canonicalValueFingerprint(execution.designDna)}`,
      value: execution.designDna,
    },
    sharedFrame: {
      profileId: frame.id,
      profileVersion: frame.version,
      authorityFingerprint: frame.authorityFingerprint,
    },
    profiles,
    dynamicCommerceSelection: dynamicSelection,
    pageBlueprintSelectionOverrides: profileOverrides,
    approvedAssetRoleSelections: assetSelections,
    productCardAnatomyIds: unique(
      synthesis.componentChoices.flatMap(({ anatomyId }) => (anatomyId ? [anatomyId] : [])),
    ),
    selectedCapabilityReferences: capabilityReferences,
    staticContentSupportSelections: selectedProfileIdentities(synthesis, contentProfiles),
    utilityPresentationSelections: selectedProfileIdentities(synthesis, utilityProfiles),
    narrative: {
      homepageRoleSequence: homepageRoles,
      desktopPriority: homepageRoles,
      mobilePriority: homepageRoles,
    },
    responsiveArtDirection: {
      responsiveMode: selection.responsiveMode,
      responsiveCapabilityKeys: [selection.responsiveMode],
      artDirectionCapabilityKeys: [selection.artDirectionPosture],
      approvedAssetRoleKeys: assetRoleKeys,
    },
    evidenceBackedOmissions: unique(synthesis.evidenceComposition.omittedPageKeys),
    diagnostics: [],
    exactAuthorityFingerprints: authorityFingerprints,
    structuralFingerprint: resolution.selectedStructuralFingerprint,
    dynamicRoutePresentationFingerprint: `compiled-prompted-dynamic-${canonicalValueFingerprint(
      dynamicSelection,
    )}`,
    semanticResolution: {
      semanticAuthorityFingerprint: semanticIndex.semanticAuthorityFingerprint,
      semanticIntentFingerprint: validatedIntent.semanticIntentFingerprint,
      semanticResolutionFingerprint: diagnostic.diagnosticFingerprint,
      diagnosticFingerprint: diagnostic.diagnosticFingerprint,
      initialCandidateCount: diagnostic.initialCandidateCount,
      finalCandidateCount: diagnostic.finalCandidateCount,
      acceptedSemanticPaths: unique(
        diagnostic.influences
          .filter(({ outcome }) => outcome === "accepted")
          .map(({ path }) => path),
      ),
      substitutedSemanticPaths: unique(diagnostic.substitutedPreferencePaths),
    },
  };
  const compiledDecision = compiledPromptedStorefrontDesignDecisionV2Schema.parse({
    ...material,
    compiledDecisionFingerprint: compiledPromptedStorefrontDesignDecisionFingerprint(material),
  });
  return Object.freeze({ compiledDecision, synthesisDecision: synthesis, resolution });
}
