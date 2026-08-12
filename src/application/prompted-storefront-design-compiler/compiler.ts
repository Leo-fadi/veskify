import {
  listCompatibleCoordinatedDirectionSelectionNarrowings,
  type CompatibleCoordinatedDirectionNarrowingInput,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "@/application/bounded-storefront-synthesis";
import {
  createPromptedStorefrontDesignRequestV2,
  validatePromptedStorefrontDesignIntentV2,
  type CreatePromptedStorefrontDesignRequestV2Input,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCapabilityAuthorityReference,
  type PromptedStorefrontCapabilityDimension,
  type PromptedStorefrontDesignIntentV2,
  type PromptedStorefrontDesignRequestV2,
  type PromptedStorefrontPreferenceSemantics,
  promptedStorefrontDesignIntentFingerprint,
} from "@/application/prompted-storefront-design-intent";
import { createDynamicCommerceProductMatchContext } from "@/application/dynamic-commerce-routes";
import { registeredBrandSystemForDirection } from "@/application/storefront-design-system";
import {
  getCommercialCollectionSearchProfile,
  getCommercialHomepageProfile,
  getCommercialPdpProfile,
  listCommercialCollectionSearchProfiles,
  listCommercialContentSupportProfiles,
  listCommercialHomepageProfiles,
  listCommercialPdpProfiles,
  listCommercialUtilityProfiles,
  materializeExecutablePageBlueprint,
  type StorefrontTemplatePagePlan,
} from "@/application/storefront-templates";
import {
  wholeStorefrontPageBlueprintSelectionOverridesSchema,
  type WholeStorefrontPageBlueprintSelectionOverride,
} from "@/application/whole-storefront-generation-plan";
import { veskifyComponentCapabilityManifest } from "@/components/registry";
import { resolveBrandSystemDesignDna, type DesignDna } from "@/domain/design-system";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  getCommercialSharedFrameProfile,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommerceProductDetailArchetype,
} from "@/domain/storefront";
import {
  COMPILED_PROMPTED_STOREFRONT_DESIGN_DECISION_V2,
  MAX_PROMPTED_STOREFRONT_COMPILER_CANDIDATES,
  compiledPromptedStorefrontDesignDecisionFingerprint,
  compiledPromptedStorefrontDesignDecisionV2Schema,
  PromptedStorefrontDesignCompilerError,
  type CompiledPromptedStorefrontDesignDecisionV2,
  type PromptedStorefrontResolutionDiagnostic,
} from "./contract";

export type LocatedPreference = Readonly<{
  path: string;
  key: string;
  dimension: PromptedStorefrontCapabilityDimension;
  semantics: PromptedStorefrontPreferenceSemantics;
  rank: number | null;
  value: string | number | null;
  minimum?: number;
  maximum?: number;
}>;

type CandidateContext = Readonly<{
  narrowing: BoundedStorefrontSynthesisSelectionNarrowing;
  designDna: DesignDna;
}>;

export type CompilePromptedStorefrontDesignIntentV2Input = Readonly<{
  originalRequest: PromptedStorefrontDesignRequestV2;
  providerIntent: PromptedStorefrontDesignIntentV2;
  currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input;
  compatibilityInput: CompatibleCoordinatedDirectionNarrowingInput;
  maximumCandidateEvaluations?: number;
}>;

function fail(
  code: ConstructorParameters<typeof PromptedStorefrontDesignCompilerError>[0],
  message: string,
  cause?: unknown,
): never {
  throw new PromptedStorefrontDesignCompilerError(code, message, cause ? { cause } : undefined);
}

function compareCanonical(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCanonical);
}

function preferenceList(
  path: string,
  values: readonly Readonly<{
    key: string;
    dimension: PromptedStorefrontCapabilityDimension;
    semantics: PromptedStorefrontPreferenceSemantics;
    rank: number | null;
    value?: string | number;
  }>[],
): LocatedPreference[] {
  return values.map((value, index) => ({
    path: `${path}[${index}]`,
    key: value.key,
    dimension: value.dimension,
    semantics: value.semantics,
    rank: value.rank,
    value: value.value ?? null,
  }));
}

function referenceList(
  path: string,
  semantics: PromptedStorefrontPreferenceSemantics,
  values: readonly Readonly<{
    key: string;
    dimension: PromptedStorefrontCapabilityDimension;
  }>[],
): LocatedPreference[] {
  return values.map((value, index) => ({
    path: `${path}[${index}]`,
    key: value.key,
    dimension: value.dimension,
    semantics,
    rank: semantics === "soft" ? index + 1 : null,
    value: null,
  }));
}

function collectPreferences(intent: PromptedStorefrontDesignIntentV2): LocatedPreference[] {
  const groups: LocatedPreference[][] = [
    preferenceList("constraints.hard", intent.constraints.hard),
    preferenceList("constraints.soft", intent.constraints.soft),
    preferenceList("constraints.optional", intent.constraints.optional),
    preferenceList("constraints.avoid", intent.constraints.avoid),
    preferenceList("designDna.preferences", intent.designDna.preferences),
    preferenceList("sharedFrame.preferences", intent.sharedFrame.preferences),
    preferenceList("homepage.profilePreferences", intent.homepage.profilePreferences),
    [
      {
        path: "homepage.sectionCount",
        key: intent.homepage.sectionCount.key,
        dimension: intent.homepage.sectionCount.dimension,
        semantics: "hard",
        rank: null,
        value: intent.homepage.sectionCount.ideal,
        minimum: intent.homepage.sectionCount.minimum,
        maximum: intent.homepage.sectionCount.maximum,
      },
    ],
    referenceList("homepage.narrativeRoleSequence", "hard", intent.homepage.narrativeRoleSequence),
    referenceList("homepage.requiredRoles", "hard", intent.homepage.requiredRoles),
    referenceList("homepage.preferredRoles", "soft", intent.homepage.preferredRoles),
    referenceList("homepage.optionalRoles", "optional", intent.homepage.optionalRoles),
    referenceList("homepage.avoidedRoles", "avoid", intent.homepage.avoidedRoles),
    preferenceList(
      "homepage.componentFamilyPreferences",
      intent.homepage.componentFamilyPreferences,
    ),
    preferenceList(
      "homepage.meaningfulVariantPreferences",
      intent.homepage.meaningfulVariantPreferences,
    ),
    preferenceList("homepage.sectionRhythmPreferences", intent.homepage.sectionRhythmPreferences),
    preferenceList(
      "homepage.approvedAssetRolePreferences",
      intent.homepage.approvedAssetRolePreferences,
    ),
    preferenceList(
      "collectionSearch.archetypePreferences",
      intent.collectionSearch.archetypePreferences,
    ),
    preferenceList(
      "collectionSearch.discoveryPreferences",
      intent.collectionSearch.discoveryPreferences,
    ),
    preferenceList(
      "collectionSearch.densityPreferences",
      intent.collectionSearch.densityPreferences,
    ),
    preferenceList(
      "collectionSearch.filterSortPreferences",
      intent.collectionSearch.filterSortPreferences,
    ),
    preferenceList(
      "collectionSearch.childCollectionPreferences",
      intent.collectionSearch.childCollectionPreferences,
    ),
    preferenceList(
      "collectionSearch.merchandisingPreferences",
      intent.collectionSearch.merchandisingPreferences,
    ),
    preferenceList(
      "collectionSearch.productCardPreferences",
      intent.collectionSearch.productCardPreferences,
    ),
    preferenceList(
      "collectionSearch.searchRelationshipPreferences",
      intent.collectionSearch.searchRelationshipPreferences,
    ),
    preferenceList(
      "productDetail.standardSimplePreferences",
      intent.productDetail.standardSimplePreferences,
    ),
    preferenceList(
      "productDetail.configurablePreferences",
      intent.productDetail.configurablePreferences,
    ),
    preferenceList(
      "productDetail.galleryLedPreferences",
      intent.productDetail.galleryLedPreferences,
    ),
    preferenceList(
      "productDetail.highConsiderationPreferences",
      intent.productDetail.highConsiderationPreferences,
    ),
    preferenceList(
      "productDetail.genericFallbackPreferences",
      intent.productDetail.genericFallbackPreferences,
    ),
    preferenceList(
      "productDetail.optionComplexityPreferences",
      intent.productDetail.optionComplexityPreferences,
    ),
    preferenceList("productDetail.mediaPreferences", intent.productDetail.mediaPreferences),
    preferenceList(
      "productDetail.purchaseDecisionHierarchyPreferences",
      intent.productDetail.purchaseDecisionHierarchyPreferences,
    ),
    preferenceList(
      "productDetail.relatedMerchandisingPreferences",
      intent.productDetail.relatedMerchandisingPreferences,
    ),
    preferenceList(
      "productDetail.productCardPreferences",
      intent.productDetail.productCardPreferences,
    ),
    preferenceList(
      "contentSupport.pageFamilyPreferences",
      intent.contentSupport.pageFamilyPreferences,
    ),
    preferenceList(
      "contentSupport.narrativePurposePreferences",
      intent.contentSupport.narrativePurposePreferences,
    ),
    referenceList(
      "contentSupport.evidenceRequirements",
      intent.contentSupport.safeOmissionBehavior === "fail-closed" ? "hard" : "optional",
      intent.contentSupport.evidenceRequirements,
    ),
    preferenceList("components.familyPreferences", intent.components.familyPreferences),
    preferenceList(
      "components.meaningfulVariantPreferences",
      intent.components.meaningfulVariantPreferences,
    ),
    preferenceList(
      "components.boundedParameterPreferences",
      intent.components.boundedParameterPreferences,
    ),
    preferenceList(
      "responsiveArtDirection.responsivePosturePreferences",
      intent.responsiveArtDirection.responsivePosturePreferences,
    ),
    preferenceList(
      "responsiveArtDirection.mobileHierarchyPreferences",
      intent.responsiveArtDirection.mobileHierarchyPreferences,
    ),
    preferenceList(
      "responsiveArtDirection.densityTransformationPreferences",
      intent.responsiveArtDirection.densityTransformationPreferences,
    ),
    referenceList(
      "responsiveArtDirection.desktopNarrativePriority",
      "hard",
      intent.responsiveArtDirection.desktopNarrativePriority,
    ),
    referenceList(
      "responsiveArtDirection.mobileNarrativePriority",
      "hard",
      intent.responsiveArtDirection.mobileNarrativePriority,
    ),
    preferenceList(
      "responsiveArtDirection.imagePosturePreferences",
      intent.responsiveArtDirection.imagePosturePreferences,
    ),
    preferenceList(
      "responsiveArtDirection.cropFocalPreferences",
      intent.responsiveArtDirection.cropFocalPreferences,
    ),
    preferenceList(
      "responsiveArtDirection.overlayPreferences",
      intent.responsiveArtDirection.overlayPreferences,
    ),
    preferenceList(
      "responsiveArtDirection.approvedMediaRolePreferences",
      intent.responsiveArtDirection.approvedMediaRolePreferences,
    ),
  ];
  intent.productDetail.productTypeIntentions.forEach((entry, index) => {
    groups.push(
      preferenceList(
        `productDetail.productTypeIntentions[${index}].preferences`,
        entry.preferences,
      ),
    );
  });
  return groups.flat().sort((left, right) => compareCanonical(left.path, right.path));
}

function referenceFor(
  authority: Pick<PromptedStorefrontCapabilityAuthority, "referencesByPreferenceKey">,
  preference: LocatedPreference,
): PromptedStorefrontCapabilityAuthorityReference {
  const reference = authority.referencesByPreferenceKey.get(preference.key);
  if (!reference || reference.dimension !== preference.dimension) {
    return fail("stale-authority", `Capability ${preference.key} is no longer current.`);
  }
  return reference;
}

function registeredCommercialPlans(): readonly StorefrontTemplatePagePlan[] {
  return [
    ...listCommercialHomepageProfiles(),
    ...listCommercialCollectionSearchProfiles(),
    ...listCommercialPdpProfiles(),
    ...listCommercialContentSupportProfiles(),
    ...listCommercialUtilityProfiles(),
  ];
}

function planProfileId(reference: PromptedStorefrontCapabilityAuthorityReference): string | null {
  if (reference.authorityKind !== "page-blueprint") return null;
  for (const plan of registeredCommercialPlans()) {
    const profile = plan.profile;
    if (!profile) continue;
    const identity = `${profile.id}@${profile.version}`;
    if (reference.authorityId === identity || reference.authorityId.startsWith(`${identity}:`)) {
      return profile.id;
    }
  }
  return null;
}

function dnaReferenceMatches(
  reference: PromptedStorefrontCapabilityAuthorityReference,
  dna: DesignDna,
): boolean {
  const exactValues: Readonly<Record<string, string>> = {
    "typography.pairing": dna.typography.pairing,
    "typography.scale": dna.typography.scale.posture,
    "typography.weight": dna.typography.weightPosture,
    "typography.tracking": dna.typography.trackingPosture,
    "typography.lineHeight": dna.typography.lineHeightPosture,
    "layout.sectionRhythm": dna.spacing.sectionRhythm,
    "layout.pageGutter": dna.spacing.pageGutter,
    "layout.gridRhythm": dna.spacing.gridGap,
    "layout.density": dna.density.posture === "balanced" ? "standard" : dna.density.posture,
    "control.posture": dna.controls.height,
    "shape.border": dna.surfaces.border,
    "shape.radius": dna.surfaces.radius,
    "shape.elevation": dna.surfaces.elevation,
    "media.ratio": dna.media.ratio,
    "media.crop": dna.media.crop,
    "media.overlay": dna.media.overlay,
    "media.emphasis": dna.media.prominence,
    "media.posture": dna.media.posture,
    "colour.surfaceRelationship": dna.colour.surfaceRelationship,
    "colour.actionRelationship": dna.colour.actionRelationship,
  };
  return Object.entries(exactValues).some(
    ([category, value]) => reference.authorityId === `${category}:${value}`,
  );
}

function profileForDimension(
  dimension: PromptedStorefrontCapabilityDimension,
  narrowing: BoundedStorefrontSynthesisSelectionNarrowing,
): string | null {
  if (dimension.startsWith("homepage.")) return narrowing.homepageProfileId;
  if (dimension.startsWith("collection-search.")) return narrowing.collectionProfileId;
  if (dimension.startsWith("pdp.")) return narrowing.pdpProfileId;
  return null;
}

function isSubsequence(requested: readonly string[], actual: readonly string[]): boolean {
  let cursor = 0;
  for (const value of actual) {
    if (requested[cursor] === value) cursor += 1;
  }
  return cursor === requested.length;
}

function homepageNarrativeCompatible(
  intent: PromptedStorefrontDesignIntentV2,
  profileId: string,
  authority: PromptedStorefrontCapabilityAuthority,
): boolean {
  const plan = getCommercialHomepageProfile(profileId);
  const roles = plan?.profile?.orderedNarrativeRoles ?? [];
  const roleFor = (key: string): string => {
    const reference = authority.referencesByPreferenceKey.get(key);
    if (!reference) return "";
    for (const candidate of listCommercialHomepageProfiles()) {
      const candidateProfile = candidate.profile;
      if (!candidateProfile) continue;
      const slot = candidate.slots.find(
        ({ id }) =>
          reference.authorityId === `${candidateProfile.id}@${candidateProfile.version}:${id}`,
      );
      if (slot) return slot.narrativeRole;
    }
    return "";
  };
  const requested = intent.homepage.narrativeRoleSequence.map(({ key }) => roleFor(key));
  const required = intent.homepage.requiredRoles.map(({ key }) => roleFor(key));
  const avoided = intent.homepage.avoidedRoles.map(({ key }) => roleFor(key));
  return (
    roles.length > 0 &&
    isSubsequence(requested, roles) &&
    required.every((role) => (roles as readonly string[]).includes(role)) &&
    avoided.every((role) => !(roles as readonly string[]).includes(role))
  );
}

function candidateReferenceMatches(
  candidate: CandidateContext,
  preference: LocatedPreference,
  reference: PromptedStorefrontCapabilityAuthorityReference,
  dynamicCollections: readonly DynamicCommerceCollectionSearchArchetype[],
  dynamicProducts: readonly DynamicCommerceProductDetailArchetype[],
): boolean | null {
  if (reference.authorityKind === "design-dna") {
    return dnaReferenceMatches(reference, candidate.designDna);
  }
  if (reference.authorityKind === "shared-frame") {
    return reference.authorityId === candidate.narrowing.sharedFrameProfileId;
  }
  if (
    reference.authorityKind === "page-blueprint" &&
    reference.dimension === "homepage.section-count"
  ) {
    return (
      planProfileId(reference) === candidate.narrowing.homepageProfileId &&
      reference.selection.kind === "number" &&
      preference.minimum !== undefined &&
      preference.maximum !== undefined &&
      typeof preference.value === "number" &&
      preference.minimum >= reference.selection.minimum &&
      preference.value >= preference.minimum &&
      preference.value <= preference.maximum &&
      preference.maximum <= reference.selection.maximum
    );
  }
  if (reference.authorityKind === "page-blueprint") {
    const expected = profileForDimension(preference.dimension, candidate.narrowing);
    return expected === null ? null : planProfileId(reference) === expected;
  }
  if (reference.authorityKind === "dynamic-commerce") {
    if (preference.dimension.startsWith("collection-search.")) {
      if (preference.dimension === "collection-search.search-relationship") {
        // Search execution is unavailable. A provider may explicitly avoid that relationship
        // without invalidating the separately retained presentation-only safe default.
        return false;
      }
      const archetype = dynamicCollections.find(({ id }) => id === reference.authorityId);
      if (!archetype) return null;
      return archetype.profile.profileId === candidate.narrowing.collectionProfileId;
    }
    if (preference.dimension.startsWith("pdp.") && !reference.productTypeKey) {
      const archetype = dynamicProducts.find(({ id }) => id === reference.authorityId);
      return archetype ? archetype.profile.profileId === candidate.narrowing.pdpProfileId : null;
    }
  }
  if (reference.authorityKind === "product-card") {
    if (preference.dimension === "collection-search.product-card") {
      return (
        getCommercialCollectionSearchProfile(candidate.narrowing.collectionProfileId)?.profile
          ?.commercialCollectionSearch?.productCardAnatomyId === reference.authorityId
      );
    }
    if (
      preference.dimension === "pdp.product-card" ||
      preference.dimension === "pdp.related-merchandising"
    ) {
      return (
        getCommercialPdpProfile(candidate.narrowing.pdpProfileId)?.profile?.commercialProductDetail
          ?.relatedProductCardAnatomyId === reference.authorityId
      );
    }
  }
  if (reference.authorityKind === "component-manifest") {
    if (reference.authorityId.startsWith("responsive:")) {
      return selectedPlans(candidate).some((plan) =>
        plan.slots.some(({ sectionType }) =>
          veskifyComponentCapabilityManifest
            .getByComponentType(sectionType)
            ?.commercialAnatomy?.responsiveTransformations.some(
              ({ mode }) => reference.authorityId === `responsive:${mode}`,
            ),
        ),
      );
    }
    if (
      preference.dimension === "component.family" ||
      preference.dimension === "homepage.component-family"
    ) {
      return selectedPlans(candidate).some(
        (plan) =>
          (!preference.dimension.startsWith("homepage.") || plan.pageType === "home") &&
          plan.slots.some(({ sectionType }) => sectionType === reference.authorityId),
      );
    }
  }
  if (
    reference.authorityKind === "dynamic-commerce" &&
    reference.authorityId.startsWith("art-direction:")
  ) {
    const selectedProfileIds = new Set<string>([
      candidate.narrowing.collectionProfileId,
      candidate.narrowing.searchProfileId,
      candidate.narrowing.pdpProfileId,
    ]);
    return [...dynamicCollections, ...dynamicProducts].some(
      ({ profile, artDirectionPosture }) =>
        selectedProfileIds.has(profile.profileId) &&
        Object.entries(artDirectionPosture).some(
          ([trait, value]) => reference.authorityId === `art-direction:${trait}:${value}`,
        ),
    );
  }
  return null;
}

function preferenceCollectionPath(path: string): string {
  return path.replace(/\[\d+\]$/, "");
}

function materialCoverage(
  intent: PromptedStorefrontDesignIntentV2,
  authority: PromptedStorefrontCapabilityAuthority,
): void {
  const usable = (
    values: readonly Readonly<{
      key: string;
      semantics: PromptedStorefrontPreferenceSemantics;
    }>[],
  ) =>
    values.some(
      ({ key, semantics }) =>
        (semantics === "hard" || semantics === "soft") &&
        authority.referencesByPreferenceKey.get(key)?.availability === "available",
    );
  const usableRequiredReference = (values: readonly Readonly<{ key: string }>[]) =>
    values.some(
      ({ key }) => authority.referencesByPreferenceKey.get(key)?.availability === "available",
    );
  const coverage = [
    usable(intent.designDna.preferences),
    usable(intent.sharedFrame.preferences),
    usable(intent.homepage.profilePreferences) ||
      usableRequiredReference(intent.homepage.narrativeRoleSequence),
    usable(intent.collectionSearch.archetypePreferences),
    [
      ...intent.productDetail.standardSimplePreferences,
      ...intent.productDetail.configurablePreferences,
      ...intent.productDetail.galleryLedPreferences,
      ...intent.productDetail.highConsiderationPreferences,
      ...intent.productDetail.genericFallbackPreferences,
    ].some(
      ({ key, semantics }) =>
        (semantics === "hard" || semantics === "soft") &&
        authority.referencesByPreferenceKey.get(key)?.availability === "available",
    ),
    [
      ...intent.responsiveArtDirection.responsivePosturePreferences,
      ...intent.responsiveArtDirection.imagePosturePreferences,
      ...intent.responsiveArtDirection.cropFocalPreferences,
      ...intent.responsiveArtDirection.overlayPreferences,
    ].some(
      ({ key, semantics }) =>
        (semantics === "hard" || semantics === "soft") &&
        authority.referencesByPreferenceKey.get(key)?.availability === "available",
    ),
  ];
  if (coverage.some((covered) => !covered)) {
    fail(
      "insufficient-material-intent",
      "Complete-storefront compilation requires usable Design DNA, frame, homepage, collection, PDP and responsive/art-direction intent.",
    );
  }
  if (
    intent.homepage.narrativeRoleSequence.length === 0 &&
    intent.homepage.profilePreferences.length === 0
  ) {
    fail(
      "insufficient-material-intent",
      "Complete-storefront compilation requires bounded homepage narrative authority.",
    );
  }
}

function chooseCandidate(
  input: CompilePromptedStorefrontDesignIntentV2Input,
  intent: PromptedStorefrontDesignIntentV2,
  authority: PromptedStorefrontCapabilityAuthority,
  preferences: readonly LocatedPreference[],
): CandidateContext {
  const narrowings = listCompatibleCoordinatedDirectionSelectionNarrowings(
    input.compatibilityInput,
  );
  const maximum = input.maximumCandidateEvaluations ?? MAX_PROMPTED_STOREFRONT_COMPILER_CANDIDATES;
  if (
    !Number.isInteger(maximum) ||
    maximum < 1 ||
    maximum > MAX_PROMPTED_STOREFRONT_COMPILER_CANDIDATES
  ) {
    fail("invalid-input", "The compiler candidate budget is invalid.");
  }
  if (narrowings.length > maximum) {
    fail(
      "candidate-budget-exceeded",
      `Current compatibility authority exposes ${narrowings.length} selections above the ${maximum} candidate budget.`,
    );
  }
  const dynamic = input.currentRequestInput.draft.dynamicCommercePresentation;
  if (!dynamic) fail("stale-authority", "The current draft has no dynamic-commerce authority.");
  const candidates = narrowings
    .map((narrowing) => {
      const brandSystem = registeredBrandSystemForDirection(
        input.currentRequestInput.draft.brandSystem,
        input.compatibilityInput.planningInput.recipeContext.designSystem,
        narrowing.directionId,
        {
          spacingDensity: narrowing.designSystemSpacingDensity,
          surfaceDepth: narrowing.designSystemSurfaceDepth,
        },
      );
      return { narrowing, designDna: resolveBrandSystemDesignDna(brandSystem) };
    })
    .filter((candidate) =>
      homepageNarrativeCompatible(intent, candidate.narrowing.homepageProfileId, authority),
    )
    .flatMap((candidate) => {
      let score = 0;
      const matches = new Map<string, boolean | null>();
      for (const preference of preferences) {
        const reference = referenceFor(authority, preference);
        const selected =
          reference.availability === "available"
            ? candidateReferenceMatches(
                candidate,
                preference,
                reference,
                dynamic.collectionSearchArchetypes,
                dynamic.productDetailArchetypes,
              )
            : null;
        matches.set(preference.path, selected);
        if (selected === null) continue;
        if (preference.semantics === "hard" && !selected) return [];
        if (preference.semantics === "avoid" && selected) return [];
        if (selected && preference.semantics === "hard") score += 100_000;
      }
      const grouped = new Map<string, LocatedPreference[]>();
      for (const preference of preferences) {
        const key = preferenceCollectionPath(preference.path);
        grouped.set(key, [...(grouped.get(key) ?? []), preference]);
      }
      for (const group of grouped.values()) {
        const bestSoft = group
          .filter(({ path, semantics }) => semantics === "soft" && matches.get(path) === true)
          .sort(
            (left, right) =>
              (left.rank ?? 32) - (right.rank ?? 32) || compareCanonical(left.key, right.key),
          )[0];
        if (bestSoft) {
          score += 10_000 - (bestSoft.rank ?? 32);
          continue;
        }
        if (group.some(({ path, semantics }) => semantics === "optional" && matches.get(path))) {
          score += 100;
        }
      }
      return [{ candidate, score }];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareCanonical(
          left.candidate.narrowing.selectionId,
          right.candidate.narrowing.selectionId,
        ),
    );
  const selected = candidates[0]?.candidate;
  if (!selected) {
    fail(
      "no-compatible-selection",
      "No current metadata-only coordinated direction is compatible with the exact provider intent.",
    );
  }
  return selected;
}

function exactProfileReference(
  authority: PromptedStorefrontCapabilityAuthority,
  profileId: string,
): PromptedStorefrontCapabilityAuthorityReference {
  const plan = registeredCommercialPlans().find(({ profile }) => profile?.id === profileId);
  const profile = plan?.profile;
  if (!profile) {
    return fail("stale-authority", `Profile ${profileId} is no longer registered.`);
  }
  const identity = `${profile.id}@${profile.version}`;
  const match = [...authority.referencesByPreferenceKey.values()]
    .filter(
      (reference) =>
        reference.authorityKind === "page-blueprint" && reference.authorityId === identity,
    )
    .sort((left, right) => compareCanonical(left.key, right.key))[0];
  return (
    match ?? fail("stale-authority", `Profile ${profileId} has no current authority reference.`)
  );
}

type BoundarySelection<T extends Readonly<{ id: string }>> = Readonly<{
  value: T;
  selectedPreferences: readonly LocatedPreference[];
}>;

/**
 * Resolves one final exact authority value. Avoidance is enforced against the value which will
 * actually be emitted, rather than being discarded while ranking positive preferences.
 */
function resolvePreferenceBoundary<T extends Readonly<{ id: string }>>(input: {
  label: string;
  candidates: readonly T[];
  defaultId: string;
  preferences: readonly LocatedPreference[];
  authority: PromptedStorefrontCapabilityAuthority;
  matches: (
    candidate: T,
    reference: PromptedStorefrontCapabilityAuthorityReference,
  ) => boolean | null;
}): BoundarySelection<T> {
  const candidates = [...input.candidates].sort((left, right) =>
    compareCanonical(left.id, right.id),
  );
  if (candidates.length === 0) {
    return fail("no-compatible-selection", `No current ${input.label} authority is compatible.`);
  }
  const located = input.preferences.map((preference) => ({
    preference,
    reference: referenceFor(input.authority, preference),
  }));
  const materiallyApplicable = located.filter(({ reference }) =>
    candidates.some((candidate) => input.matches(candidate, reference) !== null),
  );
  const hard = materiallyApplicable.filter(({ preference }) => preference.semantics === "hard");
  let allowed = candidates.filter((candidate) =>
    hard.every(({ reference }) => input.matches(candidate, reference) === true),
  );
  if (allowed.length === 0 && hard.length > 0) {
    return fail(
      "unsatisfied-hard-preference",
      `Hard ${input.label} preferences cannot be satisfied by current authority.`,
    );
  }
  const avoided = materiallyApplicable.filter(({ preference }) => preference.semantics === "avoid");
  const allowedBeforeAvoid = allowed;
  allowed = allowed.filter((candidate) =>
    avoided.every(({ reference }) => input.matches(candidate, reference) !== true),
  );
  if (allowed.length === 0) {
    return fail(
      hard.length > 0 && allowedBeforeAvoid.length > 0
        ? "contradictory-preferences"
        : "no-compatible-selection",
      `Avoided ${input.label} authority cannot be selected.`,
    );
  }
  const rankedSoft = materiallyApplicable
    .filter(({ preference }) => preference.semantics === "soft")
    .sort(
      (left, right) =>
        (left.preference.rank ?? 32) - (right.preference.rank ?? 32) ||
        compareCanonical(left.preference.key, right.preference.key),
    );
  const compatibleSoft = rankedSoft.find(({ reference }) =>
    allowed.some((candidate) => input.matches(candidate, reference) === true),
  );
  const optional = materiallyApplicable
    .filter(({ preference }) => preference.semantics === "optional")
    .sort((left, right) => compareCanonical(left.preference.key, right.preference.key));
  const compatibleOptional = optional.find(({ reference }) =>
    allowed.some((candidate) => input.matches(candidate, reference) === true),
  );
  const deciding = compatibleSoft ?? compatibleOptional;
  const matching = deciding
    ? allowed.filter(({ id }) => {
        const candidate = allowed.find((entry) => entry.id === id)!;
        return input.matches(candidate, deciding.reference) === true;
      })
    : allowed;
  const selected = deciding
    ? (matching.find(({ id }) => id === input.defaultId) ?? matching[0])
    : (allowed.find(({ id }) => id === input.defaultId) ?? allowed[0]);
  if (!selected) {
    return fail("no-compatible-selection", `No ${input.label} selection remains.`);
  }
  const selectedPreferences = [
    ...hard
      .filter(({ reference }) => input.matches(selected, reference) === true)
      .map(({ preference }) => preference),
    ...(deciding && input.matches(selected, deciding.reference) === true
      ? [deciding.preference]
      : []),
  ];
  return { value: selected, selectedPreferences };
}

function productArchetypeMatchesReference(
  archetype: DynamicCommerceProductDetailArchetype,
  reference: PromptedStorefrontCapabilityAuthorityReference,
  current: NonNullable<
    CompilePromptedStorefrontDesignIntentV2Input["currentRequestInput"]["draft"]["dynamicCommercePresentation"]
  >,
): boolean | null {
  if (reference.authorityKind === "dynamic-commerce") {
    if (current.productDetailArchetypes.some(({ id }) => id === reference.authorityId)) {
      return archetype.id === reference.authorityId;
    }
    const rule = current.productComplexityRules.find(({ id }) => id === reference.authorityId);
    return rule ? archetype.id === rule.archetypeId : null;
  }
  if (reference.authorityKind === "page-blueprint") {
    const profileId = planProfileId(reference);
    return profileId === null ? null : archetype.profile.profileId === profileId;
  }
  if (reference.authorityKind === "product-card") {
    const anatomyId = getCommercialPdpProfile(archetype.profile.profileId)?.profile
      ?.commercialProductDetail?.relatedProductCardAnatomyId;
    return anatomyId ? anatomyId === reference.authorityId : null;
  }
  return null;
}

function productArchetypeIntentRoles(
  archetype: DynamicCommerceProductDetailArchetype,
  authority: PromptedStorefrontCapabilityAuthority,
) {
  return new Set(
    [...authority.referencesByPreferenceKey.values()]
      .filter(
        (reference) =>
          reference.authorityKind === "dynamic-commerce" && reference.authorityId === archetype.id,
      )
      .flatMap((reference) => reference.intentRoles ?? []),
  );
}

function buildDynamicSelection(
  input: CompilePromptedStorefrontDesignIntentV2Input,
  intent: PromptedStorefrontDesignIntentV2,
  candidate: CandidateContext,
  authority: PromptedStorefrontCapabilityAuthority,
  preferences: readonly LocatedPreference[],
) {
  const current = input.currentRequestInput.draft.dynamicCommercePresentation;
  if (!current) fail("stale-authority", "Dynamic-commerce authority is missing.");
  const selectedPreferencePaths = new Map<string, string>();
  const retain = (resolved: BoundarySelection<{ id: string }>) => {
    resolved.selectedPreferences.forEach((preference) =>
      selectedPreferencePaths.set(preference.path, preference.key),
    );
  };
  const chooseCollection = (profileId: string, context: "collection" | "search") => {
    const resolved = resolvePreferenceBoundary({
      label: `${context} archetype`,
      candidates: current.collectionSearchArchetypes.filter(
        (entry) =>
          entry.profile.profileId === profileId && entry.supportedContexts.includes(context),
      ),
      defaultId:
        context === "search" ? current.searchArchetypeId : current.fallbacks.collectionArchetypeId,
      preferences:
        context === "collection"
          ? preferences.filter(
              (preference) =>
                preference.path.startsWith("collectionSearch.") &&
                preference.dimension !== "collection-search.search-relationship",
            )
          : [],
      authority,
      matches: (archetype, reference) => {
        if (reference.authorityKind === "dynamic-commerce") {
          return current.collectionSearchArchetypes.some(({ id }) => id === reference.authorityId)
            ? archetype.id === reference.authorityId
            : null;
        }
        if (reference.authorityKind === "page-blueprint") {
          const referencedProfileId = planProfileId(reference);
          return referencedProfileId === null
            ? null
            : archetype.profile.profileId === referencedProfileId;
        }
        if (reference.authorityKind === "product-card") {
          const anatomyId = getCommercialCollectionSearchProfile(archetype.profile.profileId)
            ?.profile?.commercialCollectionSearch?.productCardAnatomyId;
          return anatomyId ? anatomyId === reference.authorityId : null;
        }
        return null;
      },
    });
    retain(resolved);
    return resolved.value;
  };
  const choosePdp = (
    path: string,
    role: NonNullable<PromptedStorefrontCapabilityAuthorityReference["intentRoles"]>[number],
    fallbackProfileId: string,
  ) => {
    const genericFallbackRole = role === "pdp-generic-fallback";
    const nonFallbackArchetypes = current.productDetailArchetypes.filter(
      ({ id }) => id !== current.fallbacks.productDetailArchetypeId,
    );
    const roleArchetypes = nonFallbackArchetypes.filter((archetype) =>
      productArchetypeIntentRoles(archetype, authority).has(role),
    );
    const rolePreferences = preferences.filter(
      (preference) =>
        preference.path.startsWith(path) ||
        (preference.path.startsWith("constraints.") &&
          referenceFor(authority, preference).intentRoles?.includes(role) === true),
    );
    const preferredCandidates = roleArchetypes.length > 0 ? roleArchetypes : nonFallbackArchetypes;
    const allPreferredCandidatesAreAvoided = rolePreferences.some(
      (preference) =>
        preference.semantics === "avoid" &&
        preferredCandidates.every(
          (archetype) =>
            productArchetypeMatchesReference(
              archetype,
              referenceFor(authority, preference),
              current,
            ) === true,
        ),
    );
    const resolved = resolvePreferenceBoundary({
      label: `${role} PDP archetype`,
      candidates: genericFallbackRole
        ? current.productDetailArchetypes.filter(
            ({ id }) => id === current.fallbacks.productDetailArchetypeId,
          )
        : allPreferredCandidatesAreAvoided
          ? nonFallbackArchetypes
          : preferredCandidates,
      defaultId:
        current.productDetailArchetypes.find(
          (archetype) =>
            archetype.profile.profileId === fallbackProfileId &&
            (genericFallbackRole || archetype.id !== current.fallbacks.productDetailArchetypeId),
        )?.id ?? "",
      preferences: rolePreferences,
      authority,
      matches: (archetype, reference) => {
        if (reference.intentRoles && !reference.intentRoles.includes(role)) return null;
        return productArchetypeMatchesReference(archetype, reference, current);
      },
    });
    retain(resolved);
    return resolved.value;
  };
  const collection = chooseCollection(candidate.narrowing.collectionProfileId, "collection");
  const search = chooseCollection(candidate.narrowing.searchProfileId, "search");
  const standard = choosePdp(
    "productDetail.standardSimplePreferences",
    "pdp-standard-simple",
    candidate.narrowing.pdpProfileId,
  );
  const configurable = choosePdp(
    "productDetail.configurablePreferences",
    "pdp-configurable",
    candidate.narrowing.pdpProfileId,
  );
  const gallery = choosePdp(
    "productDetail.galleryLedPreferences",
    "pdp-gallery-led",
    candidate.narrowing.pdpProfileId,
  );
  const high = choosePdp(
    "productDetail.highConsiderationPreferences",
    "pdp-high-consideration",
    candidate.narrowing.pdpProfileId,
  );
  const fallback = current.productDetailArchetypes.find(
    ({ id }) => id === current.fallbacks.productDetailArchetypeId,
  );
  if (!fallback) fail("stale-authority", "The generic PDP fallback is missing.");
  const generic = choosePdp(
    "productDetail.genericFallbackPreferences",
    "pdp-generic-fallback",
    fallback.profile.profileId,
  );
  if (generic.id !== current.fallbacks.productDetailArchetypeId) {
    fail("stale-authority", "The generic PDP fallback cannot be replaced for unknown types.");
  }

  const characteristicByKey = new Map(
    input.originalRequest.catalogueCharacteristics.productTypes.map((row) => [
      row.productTypeKey,
      row,
    ]),
  );
  const productsByType = new Map<
    string,
    (typeof input.currentRequestInput.catalogue.products)[number][]
  >();
  input.currentRequestInput.catalogue.products.forEach((product) => {
    const productTypeId = canonicalProductTypePresentationId(product.productType);
    const products = productsByType.get(productTypeId) ?? [];
    products.push(product);
    productsByType.set(productTypeId, products);
  });
  const intentionByProductTypeId = new Map<
    string,
    Readonly<{
      index: number;
      intention: PromptedStorefrontDesignIntentV2["productDetail"]["productTypeIntentions"][number];
    }>
  >();
  intent.productDetail.productTypeIntentions.forEach((intention, index) => {
    const productTypeReference = authority.referencesByPreferenceKey.get(intention.productTypeKey);
    if (!productTypeReference?.productTypeKey) {
      return fail("stale-authority", `Product type ${intention.productTypeKey} is stale.`);
    }
    const currentMapping = current.productTypeMappings.find(
      (mapping) =>
        productTypeReference.authorityId === `${mapping.productTypeId}:${mapping.archetypeId}`,
    );
    if (!currentMapping) {
      return fail("stale-authority", `Product type ${intention.productTypeKey} has no mapping.`);
    }
    intentionByProductTypeId.set(currentMapping.productTypeId, { intention, index });
  });
  const productTypeMappings = [...current.productTypeMappings]
    .sort((left, right) => compareCanonical(left.productTypeId, right.productTypeId))
    .map((mapping) => {
      const products = productsByType.get(mapping.productTypeId) ?? [];
      const characteristics = characteristicByKey.get(`pdp.product-type.${mapping.productTypeId}`);
      if (
        !characteristics ||
        products.length === 0 ||
        products.length !== characteristics.productCount
      ) {
        return fail("stale-authority", `Product type ${mapping.productTypeId} is stale.`);
      }
      const contexts = products.map((product) => createDynamicCommerceProductMatchContext(product));
      const optionCounts = contexts.map(({ optionGroupCount }) => optionGroupCount);
      const mediaCounts = products.map(({ images }) => images.length);
      if (
        characteristics.simpleProductCount !==
          contexts.filter(({ optionStructure }) => optionStructure === "simple").length ||
        characteristics.configurableProductCount !==
          contexts.filter(({ optionStructure }) => optionStructure === "configurable").length ||
        characteristics.optionGroupCountRange.minimum !== Math.min(...optionCounts) ||
        characteristics.optionGroupCountRange.maximum !== Math.max(...optionCounts) ||
        characteristics.mediaDepthRange.minimum !== Math.min(...mediaCounts) ||
        characteristics.mediaDepthRange.maximum !== Math.max(...mediaCounts) ||
        characteristics.highConsiderationPresentationCount !==
          contexts.filter(({ highConsideration }) => highConsideration).length
      ) {
        return fail(
          "stale-authority",
          `Product type ${mapping.productTypeId} characteristics changed.`,
        );
      }
      // A known product type must be materialized to one exact non-fallback
      // registered PDP archetype. Its protected complexity characteristics
      // narrow the preferred role; if the current registry has no dedicated
      // non-fallback role profile, use another current non-fallback archetype
      // rather than silently selecting the generic unknown-type fallback.
      const exactNonFallbackRoleId = (
        role: NonNullable<PromptedStorefrontCapabilityAuthorityReference["intentRoles"]>[number],
      ) =>
        current.productDetailArchetypes.find(
          (archetype) =>
            archetype.id !== current.fallbacks.productDetailArchetypeId &&
            productArchetypeIntentRoles(archetype, authority).has(role),
        )?.id;
      const characteristicRoleIds = new Set<string>();
      const standardRoleId = exactNonFallbackRoleId("pdp-standard-simple");
      const configurableRoleId = exactNonFallbackRoleId("pdp-configurable");
      const galleryRoleId = exactNonFallbackRoleId("pdp-gallery-led");
      const highRoleId = exactNonFallbackRoleId("pdp-high-consideration");
      if (characteristics.simpleProductCount > 0 && standardRoleId) {
        characteristicRoleIds.add(standardRoleId);
      }
      if (characteristics.configurableProductCount > 0 && configurableRoleId) {
        characteristicRoleIds.add(configurableRoleId);
      }
      if (
        characteristics.mediaDepthRange.maximum >= 2 &&
        characteristics.simpleProductCount > 0 &&
        galleryRoleId
      ) {
        characteristicRoleIds.add(galleryRoleId);
      }
      if (
        (characteristics.highConsiderationPresentationCount > 0 ||
          characteristics.optionGroupCountRange.maximum >= 4) &&
        highRoleId
      ) {
        characteristicRoleIds.add(highRoleId);
      }
      const nonFallbackArchetypes = current.productDetailArchetypes.filter(
        (archetype) => archetype.id !== current.fallbacks.productDetailArchetypeId,
      );
      const candidatesForCharacteristics = nonFallbackArchetypes.filter(({ id }) =>
        characteristicRoleIds.has(id),
      );
      const scoped = intentionByProductTypeId.get(mapping.productTypeId);
      const scopedPreferences = scoped
        ? preferences.filter((preference) =>
            preference.path.startsWith(
              `productDetail.productTypeIntentions[${scoped.index}].preferences`,
            ),
          )
        : [];
      const preferredCandidates =
        candidatesForCharacteristics.length > 0
          ? candidatesForCharacteristics
          : nonFallbackArchetypes;
      const candidates = preferredCandidates;
      if (candidates.length === 0) {
        return fail(
          "no-compatible-selection",
          `Product type ${mapping.productTypeId} has no compatible complexity archetype.`,
        );
      }
      const resolved = resolvePreferenceBoundary({
        label: `product type ${mapping.productTypeId}`,
        candidates,
        defaultId: mapping.archetypeId,
        preferences: scopedPreferences,
        authority,
        matches: (archetype, reference) =>
          productArchetypeMatchesReference(archetype, reference, current),
      });
      retain(resolved);
      return { productTypeId: mapping.productTypeId, archetypeId: resolved.value.id };
    });
  return {
    selection: {
      authorityFingerprint: current.authorityFingerprint,
      collectionArchetypeId: collection.id,
      searchArchetypeId: search.id,
      searchExecution: "registered-presentation-fail-closed-runtime" as const,
      standardSimpleArchetypeId: standard.id,
      configurableArchetypeId: configurable.id,
      galleryLedArchetypeId: gallery.id,
      highConsiderationArchetypeId: high.id,
      genericFallbackArchetypeId: generic.id,
      productTypeMappings,
    },
    selectedPreferencePaths,
  };
}

function selectedPlans(
  candidate: Readonly<{ narrowing: BoundedStorefrontSynthesisSelectionNarrowing }>,
): readonly StorefrontTemplatePagePlan[] {
  const plans = [
    getCommercialHomepageProfile(candidate.narrowing.homepageProfileId),
    getCommercialCollectionSearchProfile(candidate.narrowing.collectionProfileId),
    getCommercialPdpProfile(candidate.narrowing.pdpProfileId),
  ];
  if (plans.some((entry) => !entry?.profile)) {
    fail("stale-authority", "A selected PageBlueprint profile is unavailable.");
  }
  return plans as readonly StorefrontTemplatePagePlan[];
}

export function resolvePromptedStorefrontExactSlotOverrides(
  input: Readonly<{
    selectionNarrowing: BoundedStorefrontSynthesisSelectionNarrowing;
    componentDefinitions: Readonly<
      CompilePromptedStorefrontDesignIntentV2Input["compatibilityInput"]["planningInput"]["componentDefinitions"]
    >;
    authority: Pick<PromptedStorefrontCapabilityAuthority, "referencesByPreferenceKey">;
    preferences: readonly LocatedPreference[];
  }>,
): Readonly<{
  slotOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[];
  selectedPreferencePaths: ReadonlySet<string>;
}> {
  const { authority, preferences } = input;
  const variantPreferences = preferences.filter((entry) =>
    ["homepage.meaningful-variant", "component.meaningful-variant"].includes(entry.dimension),
  );
  const parameterPreferences = preferences.filter(
    ({ dimension }) => dimension === "component.bounded-parameter",
  );
  const manifest = veskifyComponentCapabilityManifest.manifest.entries;
  const variantIdentity = (component: string, variant: string) => `${component}:${variant}`;
  const parameterIdentity = (component: string, parameter: string) => `${component}:${parameter}`;
  const pageType = (plan: StorefrontTemplatePagePlan) => {
    if (plan.pageType === "home") return "home" as const;
    if (plan.pageType === "collection") return "collection" as const;
    return "product" as const;
  };
  const plans = selectedPlans({ narrowing: input.selectionNarrowing });
  const targets = plans.flatMap((plan) =>
    plan.slots.map((slot) => {
      const selection = plan.profile!.componentSelections.find(({ slotId }) => slotId === slot.id);
      if (!selection) fail("stale-authority", `Slot ${slot.id} has no component selection.`);
      const definition = manifest.find(({ componentType }) => componentType === slot.sectionType);
      if (!definition) fail("stale-authority", `Component ${slot.sectionType} is unavailable.`);
      return {
        key: `${pageType(plan)}:${plan.profile!.id}:${slot.id}`,
        pageType: pageType(plan),
        plan,
        slot,
        selection,
        definition,
      };
    }),
  );
  const selectedPreferencePaths = new Set<string>();
  const isInScope = (preference: LocatedPreference, target: (typeof targets)[number]) =>
    !(
      (preference.path.startsWith("homepage.") || preference.dimension.startsWith("homepage.")) &&
      target.pageType !== "home"
    );
  const add = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const values = map.get(key) ?? [];
    values.push(value);
    map.set(key, values);
  };
  const requireUnambiguousTarget = (
    preference: LocatedPreference,
    matchingTargets: readonly (typeof targets)[number][],
  ) => {
    if (matchingTargets.length > 1) {
      fail(
        "incompatible-component-selection",
        `Preference ${preference.key} matches more than one exact PageBlueprint slot.`,
      );
    }
    if (matchingTargets.length === 0 && preference.semantics === "hard") {
      fail(
        "unsatisfied-hard-preference",
        `Hard preference ${preference.key} has no exact compatible PageBlueprint slot.`,
      );
    }
    return matchingTargets[0] ?? null;
  };

  type VariantRow = Readonly<{
    preference: LocatedPreference;
    reference: PromptedStorefrontCapabilityAuthorityReference;
    variant: string;
  }>;
  const requestedVariants = new Map<string, VariantRow[]>();
  const avoidedVariants = new Map<string, Set<string>>();
  for (const preference of variantPreferences) {
    const reference = referenceFor(authority, preference);
    if (reference.availability !== "available") {
      if (preference.semantics === "hard") {
        fail("unsatisfied-hard-preference", `Hard preference ${preference.key} is unavailable.`);
      }
      continue;
    }
    const variantAuthority = manifest
      .flatMap((definition) =>
        definition.variants.map((variant) => ({
          component: definition.componentType,
          variant: variant.id,
        })),
      )
      .find(
        ({ component, variant }) => reference.authorityId === variantIdentity(component, variant),
      );
    if (!variantAuthority) {
      fail("stale-authority", `Variant preference ${preference.key} is no longer registered.`);
    }
    const matchingTargets = targets
      .filter(
        (target) =>
          isInScope(preference, target) &&
          target.slot.sectionType === variantAuthority.component &&
          target.selection.variants.includes(variantAuthority.variant),
      )
      .sort((left, right) => compareCanonical(left.key, right.key));
    const row = { preference, reference, variant: variantAuthority.variant };
    if (preference.semantics === "avoid") {
      for (const target of matchingTargets) {
        const values = avoidedVariants.get(target.key) ?? new Set<string>();
        values.add(variantAuthority.variant);
        avoidedVariants.set(target.key, values);
      }
      continue;
    }
    const target = requireUnambiguousTarget(preference, matchingTargets);
    if (target) add(requestedVariants, target.key, row);
  }

  const selectedVariants = new Map<string, string>();
  for (const target of targets) {
    const requested = requestedVariants.get(target.key) ?? [];
    const avoided = avoidedVariants.get(target.key) ?? new Set<string>();
    const hard = requested.filter(({ preference }) => preference.semantics === "hard");
    if (new Set(hard.map(({ variant }) => variant)).size > 1) {
      fail(
        "contradictory-preferences",
        `Slot ${target.slot.id} has contradictory hard variant preferences.`,
      );
    }
    if (hard.some(({ variant }) => avoided.has(variant))) {
      fail(
        "contradictory-preferences",
        `Slot ${target.slot.id} both requires and avoids the same variant.`,
      );
    }
    const soft = requested
      .filter(({ preference, variant }) => preference.semantics === "soft" && !avoided.has(variant))
      .sort(
        (left, right) =>
          (left.preference.rank ?? 32) - (right.preference.rank ?? 32) ||
          compareCanonical(left.preference.key, right.preference.key) ||
          compareCanonical(left.preference.path, right.preference.path),
      );
    const optional = requested
      .filter(
        ({ preference, variant }) => preference.semantics === "optional" && !avoided.has(variant),
      )
      .sort(
        (left, right) =>
          compareCanonical(left.preference.key, right.preference.key) ||
          compareCanonical(left.preference.path, right.preference.path),
      );
    const chosen = hard[0] ?? soft[0] ?? optional[0] ?? null;
    let selectedVariant = chosen?.variant ?? target.slot.defaultVariant;
    if (!chosen && avoided.has(selectedVariant)) {
      selectedVariant =
        [...target.selection.variants]
          .filter((variant) => {
            if (avoided.has(variant)) return false;
            if (variant === target.slot.defaultVariant) return true;
            return target.definition.variants.some(
              (candidate) =>
                candidate.id === variant &&
                candidate.structuralClassification === "meaningfulStructuralVariant",
            );
          })
          .sort(compareCanonical)[0] ??
        fail(
          "no-compatible-selection",
          `Slot ${target.slot.id} has no registered variant outside the avoided set.`,
        );
    }
    if (selectedVariant !== target.slot.defaultVariant) {
      const definition = target.definition.variants.find(({ id }) => id === selectedVariant);
      if (definition?.structuralClassification !== "meaningfulStructuralVariant") {
        fail(
          "incompatible-component-selection",
          `Slot ${target.slot.id} cannot select non-structural variant ${selectedVariant}.`,
        );
      }
    }
    selectedVariants.set(target.key, selectedVariant);
    requested
      .filter(({ variant }) => variant === selectedVariant)
      .forEach(({ preference }) => selectedPreferencePaths.add(preference.path));
  }

  type ParameterRow = Readonly<{
    preference: LocatedPreference;
    reference: PromptedStorefrontCapabilityAuthorityReference;
    parameterId: string;
    value: string | number;
  }>;
  const requestedParameters = new Map<string, ParameterRow[]>();
  const avoidedParameterValues = new Map<string, Map<string, string | number>>();
  const parameterReferences = new Map<string, PromptedStorefrontCapabilityAuthorityReference>();
  const parameterMetadata = new Map<
    string,
    Readonly<{
      target: (typeof targets)[number];
      parameter: (typeof targets)[number]["definition"]["boundedParameters"][number];
    }>
  >();
  for (const preference of parameterPreferences) {
    const reference = referenceFor(authority, preference);
    if (reference.availability !== "available") {
      if (preference.semantics === "hard") {
        fail("unsatisfied-hard-preference", `Hard preference ${preference.key} is unavailable.`);
      }
      continue;
    }
    const parameterAuthority = manifest
      .flatMap((definition) =>
        definition.boundedParameters.map((parameter) => ({
          component: definition.componentType,
          parameter,
        })),
      )
      .find(
        ({ component, parameter }) =>
          reference.authorityId === parameterIdentity(component, parameter.id),
      );
    if (!parameterAuthority) {
      fail("stale-authority", `Parameter preference ${preference.key} is no longer registered.`);
    }
    if (preference.value === null) {
      fail("invalid-bounded-parameter", `Parameter preference ${preference.key} has no value.`);
    }
    const matchingTargets = targets
      .filter((target) => {
        const variant = selectedVariants.get(target.key) ?? target.slot.defaultVariant;
        return (
          isInScope(preference, target) &&
          target.slot.sectionType === parameterAuthority.component &&
          parameterAuthority.parameter.compatiblePageTypes.includes(target.plan.pageType) &&
          (parameterAuthority.parameter.compatibleVariants.length === 0 ||
            parameterAuthority.parameter.compatibleVariants.includes(variant))
        );
      })
      .sort((left, right) => compareCanonical(left.key, right.key));
    const row = {
      preference,
      reference,
      parameterId: parameterAuthority.parameter.id,
      value: preference.value,
    };
    if (preference.semantics === "avoid") {
      for (const target of matchingTargets) {
        const key = `${target.key}:${parameterAuthority.parameter.id}`;
        const values = avoidedParameterValues.get(key) ?? new Map<string, string | number>();
        values.set(canonicalValueString(preference.value), preference.value);
        avoidedParameterValues.set(key, values);
        parameterMetadata.set(key, { target, parameter: parameterAuthority.parameter });
        parameterReferences.set(key, reference);
      }
      continue;
    }
    const target = requireUnambiguousTarget(preference, matchingTargets);
    if (target) {
      const key = `${target.key}:${parameterAuthority.parameter.id}`;
      add(requestedParameters, key, row);
      parameterMetadata.set(key, { target, parameter: parameterAuthority.parameter });
      parameterReferences.set(key, reference);
    }
  }

  const parameterSelectionsByTarget = new Map<string, Record<string, string | number>>();
  const parameterKeys = [
    ...new Set([...requestedParameters.keys(), ...avoidedParameterValues.keys()]),
  ].sort(compareCanonical);
  for (const key of parameterKeys) {
    const metadata = parameterMetadata.get(key);
    if (!metadata) fail("stale-authority", `Parameter selection ${key} has no current metadata.`);
    const requested = requestedParameters.get(key) ?? [];
    const avoided = avoidedParameterValues.get(key) ?? new Map<string, string | number>();
    const hard = requested.filter(({ preference }) => preference.semantics === "hard");
    if (new Set(hard.map(({ value }) => canonicalValueString(value))).size > 1) {
      fail(
        "contradictory-preferences",
        `Slot ${metadata.target.slot.id} has contradictory hard parameter values.`,
      );
    }
    if (hard.some(({ value }) => avoided.has(canonicalValueString(value)))) {
      fail(
        "contradictory-preferences",
        `Slot ${metadata.target.slot.id} both requires and avoids the same parameter value.`,
      );
    }
    const soft = requested
      .filter(
        ({ preference, value }) =>
          preference.semantics === "soft" && !avoided.has(canonicalValueString(value)),
      )
      .sort(
        (left, right) =>
          (left.preference.rank ?? 32) - (right.preference.rank ?? 32) ||
          compareCanonical(left.preference.key, right.preference.key) ||
          compareCanonical(left.preference.path, right.preference.path),
      );
    const optional = requested
      .filter(
        ({ preference, value }) =>
          preference.semantics === "optional" && !avoided.has(canonicalValueString(value)),
      )
      .sort(
        (left, right) =>
          compareCanonical(left.preference.key, right.preference.key) ||
          compareCanonical(left.preference.path, right.preference.path),
      );
    const chosen = hard[0] ?? soft[0] ?? optional[0] ?? null;
    const currentValue =
      metadata.target.plan.profile!.parameterDefaults[metadata.parameter.id] ??
      metadata.parameter.defaultValue;
    let selectedValue = chosen?.value ?? currentValue;
    if (!chosen && avoided.has(canonicalValueString(selectedValue))) {
      const reference = parameterReferences.get(key);
      const alternatives =
        reference?.selection.kind === "enum"
          ? [...reference.selection.allowedValues].sort(compareCanonical)
          : reference?.selection.kind === "number"
            ? [
                reference.selection.minimum,
                Math.round((reference.selection.minimum + reference.selection.maximum) / 2),
                reference.selection.maximum,
              ]
            : [];
      selectedValue =
        alternatives.find((value) => !avoided.has(canonicalValueString(value))) ??
        fail(
          "no-compatible-selection",
          `Slot ${metadata.target.slot.id} has no bounded value outside the avoided set.`,
        );
    }
    if (chosen || canonicalValueString(selectedValue) !== canonicalValueString(currentValue)) {
      const values = parameterSelectionsByTarget.get(metadata.target.key) ?? {};
      values[metadata.parameter.id] = selectedValue;
      parameterSelectionsByTarget.set(metadata.target.key, values);
    }
    requested
      .filter(({ value }) => canonicalValueString(value) === canonicalValueString(selectedValue))
      .forEach(({ preference }) => selectedPreferencePaths.add(preference.path));
  }

  const overrides = plans
    .map((plan) => {
      const slotSelections = targets
        .filter((target) => target.plan.profile!.id === plan.profile!.id)
        .map((target) => {
          const selectedVariant = selectedVariants.get(target.key) ?? target.slot.defaultVariant;
          const boundedParameters = parameterSelectionsByTarget.get(target.key) ?? {};
          return selectedVariant !== target.slot.defaultVariant ||
            Object.keys(boundedParameters).length > 0
            ? {
                slotId: target.slot.id,
                component: target.slot.sectionType,
                variant: selectedVariant,
                ...(Object.keys(boundedParameters).length > 0 ? { boundedParameters } : {}),
              }
            : null;
        })
        .filter((selection): selection is NonNullable<typeof selection> => selection !== null)
        .sort((left, right) => compareCanonical(left.slotId, right.slotId));
      if (slotSelections.length === 0) return null;
      try {
        materializeExecutablePageBlueprint({
          pagePlan: plan,
          componentDefinitions: input.componentDefinitions,
          availableBindingCategories: plan.profile!.requiredBindingCategories,
          slotSelectionOverrides: slotSelections,
        });
      } catch (error) {
        fail(
          "incompatible-component-selection",
          `Exact component selections for ${plan.profile!.id} are not executable.`,
          error,
        );
      }
      return { pageType: pageType(plan), profileId: plan.profile!.id, slotSelections };
    })
    .filter((override): override is NonNullable<typeof override> => override !== null)
    .sort((left, right) => compareCanonical(left.pageType, right.pageType));
  return {
    slotOverrides: wholeStorefrontPageBlueprintSelectionOverridesSchema.parse(overrides),
    selectedPreferencePaths: new Set([...selectedPreferencePaths].sort(compareCanonical)),
  };
}

function selectedReferenceKeys(
  input: CompilePromptedStorefrontDesignIntentV2Input,
  candidate: CandidateContext,
  dynamic: ReturnType<typeof buildDynamicSelection>["selection"],
  slotOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[],
  authority: PromptedStorefrontCapabilityAuthority,
  preferences: readonly LocatedPreference[],
  exactSelectedPreferencePaths: ReadonlySet<string>,
): ReadonlyMap<string, PromptedStorefrontCapabilityAuthorityReference> {
  const compatibleByPath = new Map<string, PromptedStorefrontCapabilityAuthorityReference>();
  const dynamicIds = new Set([
    dynamic.collectionArchetypeId,
    dynamic.searchArchetypeId,
    dynamic.standardSimpleArchetypeId,
    dynamic.configurableArchetypeId,
    dynamic.galleryLedArchetypeId,
    dynamic.highConsiderationArchetypeId,
    dynamic.genericFallbackArchetypeId,
    ...dynamic.productTypeMappings.map(({ archetypeId }) => archetypeId),
  ]);
  const overridesByProfileAndSlot = new Map(
    slotOverrides.flatMap(({ profileId, slotSelections }) =>
      slotSelections.map((selection) => [`${profileId}:${selection.slotId}`, selection] as const),
    ),
  );
  const selectedSlotRows = selectedPlans(candidate).flatMap((plan) =>
    plan.slots.map((slot) => {
      const profileId = plan.profile!.id;
      const override = overridesByProfileAndSlot.get(`${profileId}:${slot.id}`);
      return {
        component: slot.sectionType,
        variant: override?.variant ?? slot.defaultVariant,
        boundedParameters: override?.boundedParameters ?? {},
      };
    }),
  );
  const profileIds = new Set<string>([
    candidate.narrowing.homepageProfileId,
    candidate.narrowing.collectionProfileId,
    candidate.narrowing.searchProfileId,
    candidate.narrowing.pdpProfileId,
  ]);
  const includedOptionalFamilies = new Set(candidate.narrowing.includedOptionalPageFamilyIds);
  const includedSiteMapProfileIds = new Set(
    input.compatibilityInput.siteMapDecision.pages
      .filter(({ familyId, required }) => required || includedOptionalFamilies.has(familyId))
      .map(({ profile }) => profile.id),
  );
  const componentIdentities = new Set(selectedSlotRows.map(({ component }) => component));
  const responsiveIdentities = new Set(
    selectedSlotRows.flatMap(({ component }) => {
      const entry = veskifyComponentCapabilityManifest.getByComponentType(component);
      return (
        entry?.commercialAnatomy?.responsiveTransformations.map(
          ({ mode }) => `responsive:${mode}`,
        ) ?? []
      );
    }),
  );
  const dynamicArtDirectionIdentities = new Set([
    ...input.currentRequestInput.draft
      .dynamicCommercePresentation!.collectionSearchArchetypes.filter(({ id }) =>
        [dynamic.collectionArchetypeId, dynamic.searchArchetypeId].includes(id),
      )
      .flatMap(({ artDirectionPosture }) => [
        `art-direction:ratio:${artDirectionPosture.ratio}`,
        `art-direction:crop:${artDirectionPosture.crop}`,
        `art-direction:overlay:${artDirectionPosture.overlay}`,
      ]),
    ...input.currentRequestInput.draft
      .dynamicCommercePresentation!.productDetailArchetypes.filter(({ id }) => dynamicIds.has(id))
      .flatMap(({ artDirectionPosture }) => [
        `art-direction:ratio:${artDirectionPosture.ratio}`,
        `art-direction:crop:${artDirectionPosture.crop}`,
        `art-direction:overlay:${artDirectionPosture.overlay}`,
      ]),
  ]);
  for (const preference of preferences) {
    const reference = referenceFor(authority, preference);
    if (reference.availability !== "available" || preference.semantics === "avoid") continue;
    if (exactSelectedPreferencePaths.has(preference.path)) {
      compatibleByPath.set(preference.path, reference);
      continue;
    }
    const resolvedAtDynamicBoundary =
      (preference.path.startsWith("collectionSearch.") &&
        preference.dimension !== "collection-search.search-relationship") ||
      [
        "productDetail.standardSimplePreferences",
        "productDetail.configurablePreferences",
        "productDetail.galleryLedPreferences",
        "productDetail.highConsiderationPreferences",
        "productDetail.genericFallbackPreferences",
        "productDetail.productTypeIntentions[",
      ].some((path) => preference.path.startsWith(path));
    if (resolvedAtDynamicBoundary) continue;
    const profileId = planProfileId(reference);
    // Per-product-type intent is resolved only by the final product-type
    // mapping above. A whole-storefront PDP candidate must not make an
    // incompatible higher-ranked product-type preference appear accepted.
    const candidateMatch = preference.path.startsWith("productDetail.productTypeIntentions[")
      ? null
      : candidateReferenceMatches(
          candidate,
          preference,
          reference,
          input.currentRequestInput.draft.dynamicCommercePresentation!.collectionSearchArchetypes,
          input.currentRequestInput.draft.dynamicCommercePresentation!.productDetailArchetypes,
        );
    const matchesCandidate =
      candidateMatch === true ||
      (profileIds.has(profileId ?? "") &&
        !preference.path.startsWith("productDetail.productTypeIntentions[") &&
        !["homepage.meaningful-variant", "component.meaningful-variant"].includes(
          preference.dimension,
        )) ||
      (includedSiteMapProfileIds.has(profileId ?? "") &&
        (preference.dimension === "content-support.profile" ||
          preference.dimension === "content-support.narrative-purpose")) ||
      (componentIdentities.has(reference.authorityId) &&
        ["component.family", "homepage.component-family"].includes(preference.dimension)) ||
      (responsiveIdentities.has(reference.authorityId) &&
        preference.dimension.startsWith("responsive.")) ||
      (dynamicArtDirectionIdentities.has(reference.authorityId) &&
        ["responsive.image", "responsive.crop", "responsive.overlay"].includes(
          preference.dimension,
        )) ||
      (reference.authorityKind === "product-card" &&
        selectedPlans(candidate).some((plan) => {
          const commercial =
            plan.profile?.commercialHomepage ??
            plan.profile?.commercialCollectionSearch ??
            plan.profile?.commercialProductDetail;
          return (
            commercial && Object.values(commercial).some((value) => value === reference.authorityId)
          );
        })) ||
      (reference.authorityKind === "approved-assets" &&
        reference.availability === "available" &&
        (reference.authorityId.startsWith("approved-assets:") ||
          reference.authorityId.startsWith("responsive-image:")));
    if (matchesCandidate) compatibleByPath.set(preference.path, reference);
  }
  const selected = new Map<string, PromptedStorefrontCapabilityAuthorityReference>();
  const grouped = new Map<string, LocatedPreference[]>();
  for (const preference of preferences) {
    const collection = preferenceCollectionPath(preference.path);
    grouped.set(collection, [...(grouped.get(collection) ?? []), preference]);
  }
  for (const group of grouped.values()) {
    const hard = group.filter(
      ({ path, semantics }) => semantics === "hard" && compatibleByPath.has(path),
    );
    hard.forEach(({ path }) => selected.set(path, compatibleByPath.get(path)!));
    const soft = group
      .filter(({ path, semantics }) => semantics === "soft" && compatibleByPath.has(path))
      .sort(
        (left, right) =>
          (left.rank ?? 32) - (right.rank ?? 32) || compareCanonical(left.key, right.key),
      )[0];
    if (soft) {
      selected.set(soft.path, compatibleByPath.get(soft.path)!);
      continue;
    }
    group
      .filter(({ path, semantics }) => semantics === "optional" && compatibleByPath.has(path))
      .sort((left, right) => compareCanonical(left.key, right.key))
      .forEach(({ path }) => selected.set(path, compatibleByPath.get(path)!));
  }
  return selected;
}

function diagnosticsFor(
  preferences: readonly LocatedPreference[],
  authority: PromptedStorefrontCapabilityAuthority,
  selectedByPath: ReadonlyMap<string, PromptedStorefrontCapabilityAuthorityReference>,
): PromptedStorefrontResolutionDiagnostic[] {
  return preferences.map((preference) => {
    const requested = referenceFor(authority, preference);
    const accepted = selectedByPath.has(preference.path);
    if (preference.semantics === "hard" && !accepted) {
      fail("unsatisfied-hard-preference", `Hard preference ${preference.key} was not selected.`);
    }
    const selectedAlternative = [...selectedByPath.entries()]
      .filter(
        ([path, reference]) =>
          preferenceCollectionPath(path) === preferenceCollectionPath(preference.path) &&
          reference.dimension === preference.dimension,
      )
      .map(([path, reference]) => ({
        preference: preferences.find((entry) => entry.path === path),
        reference,
      }))
      .sort(
        (left, right) =>
          (left.preference?.rank ?? 32) - (right.preference?.rank ?? 32) ||
          compareCanonical(left.reference.key, right.reference.key),
      )[0];
    const substituted =
      preference.semantics === "soft" &&
      selectedAlternative?.preference?.semantics === "soft" &&
      (selectedAlternative.preference.rank ?? 32) > (preference.rank ?? 32);
    const outcome = accepted
      ? "accepted"
      : substituted
        ? "substituted"
        : preference.semantics === "optional"
          ? "omitted"
          : "rejected";
    const selectedAuthority = accepted
      ? requested
      : substituted
        ? (selectedAlternative?.reference ?? null)
        : null;
    const reasonCode = accepted
      ? preference.semantics === "soft"
        ? "highest-ranked-compatible"
        : preference.semantics === "optional"
          ? "optional-compatible"
          : "exact-current-authority"
      : substituted
        ? "higher-ranked-incompatible"
        : preference.semantics === "optional"
          ? requested.availability === "evidence-dependent"
            ? requested.authorityKind === "approved-assets"
              ? "missing-approved-asset"
              : "missing-approved-evidence"
            : "optional-unavailable"
          : preference.semantics === "avoid"
            ? "avoided-selection"
            : requested.availability !== "available"
              ? "unavailable-capability"
              : selectedAlternative
                ? "lower-ranked-compatible"
                : "incompatible-context";
    return {
      preferencePath: preference.path,
      preferenceKey: preference.key,
      semantics: preference.semantics,
      requestedRank: preference.rank,
      requestedValue: preference.value,
      outcome,
      selectedAuthority,
      reasonCode,
      authorityFingerprint:
        selectedAuthority?.authorityFingerprint ?? requested.authorityFingerprint,
    };
  });
}

/**
 * Refreshes exact request authority, validates one provider intent, evaluates only bounded
 * compatibility metadata, and returns one transient executable decision. It never creates a
 * StorefrontSnapshot, synthesis result, proposal, provider request, save, or publication.
 */
export function compilePromptedStorefrontDesignIntentV2(
  input: CompilePromptedStorefrontDesignIntentV2Input,
): CompiledPromptedStorefrontDesignDecisionV2 {
  let current: ReturnType<typeof createPromptedStorefrontDesignRequestV2>;
  try {
    current = createPromptedStorefrontDesignRequestV2(input.currentRequestInput);
  } catch (error) {
    return fail(
      "stale-authority",
      "Current prompted storefront authority cannot be rebuilt.",
      error,
    );
  }
  if (
    input.currentRequestInput.merchantPrompt !== input.originalRequest.merchantPrompt ||
    current.request.requestFingerprint !== input.originalRequest.requestFingerprint ||
    canonicalValueString(current.request.currentAuthority) !==
      canonicalValueString(input.originalRequest.currentAuthority) ||
    canonicalValueString(input.compatibilityInput.planningInput.draft) !==
      canonicalValueString(input.currentRequestInput.draft) ||
    canonicalValueString(input.compatibilityInput.planningInput.catalogue) !==
      canonicalValueString(input.currentRequestInput.catalogue)
  ) {
    fail("stale-authority", "The prompted request or synthesis compatibility authority changed.");
  }
  let intent: PromptedStorefrontDesignIntentV2;
  try {
    const { intentFingerprint, ...providerIntentMaterial } = input.providerIntent;
    if (intentFingerprint !== promptedStorefrontDesignIntentFingerprint(providerIntentMaterial)) {
      fail("invalid-input", "The provider intent fingerprint is stale.");
    }
    intent = validatePromptedStorefrontDesignIntentV2({
      request: current.request,
      capabilityAuthority: current.capabilityAuthority,
      currentAuthority: current.request.currentAuthority,
      intent: providerIntentMaterial,
    });
  } catch (error) {
    return fail(
      "invalid-input",
      "The provider intent is not valid against current authority.",
      error,
    );
  }
  materialCoverage(intent, current.capabilityAuthority);
  const preferences = collectPreferences(intent);
  const candidate = chooseCandidate(input, intent, current.capabilityAuthority, preferences);
  const dynamicResolution = buildDynamicSelection(
    input,
    intent,
    candidate,
    current.capabilityAuthority,
    preferences,
  );
  const dynamic = dynamicResolution.selection;
  const slotOverrideResolution = resolvePromptedStorefrontExactSlotOverrides({
    selectionNarrowing: candidate.narrowing,
    componentDefinitions: input.compatibilityInput.planningInput.componentDefinitions,
    authority: current.capabilityAuthority,
    preferences,
  });
  const slotOverrides = slotOverrideResolution.slotOverrides;
  const selectedByPath = selectedReferenceKeys(
    input,
    candidate,
    dynamic,
    slotOverrides,
    current.capabilityAuthority,
    preferences,
    new Set([
      ...dynamicResolution.selectedPreferencePaths.keys(),
      ...slotOverrideResolution.selectedPreferencePaths,
    ]),
  );
  const selectedReferences = [
    ...new Map(
      [...selectedByPath.values()].map((reference) => [reference.key, reference] as const),
    ).values(),
  ].sort((left, right) => compareCanonical(left.key, right.key));
  const frame = getCommercialSharedFrameProfile(candidate.narrowing.sharedFrameProfileId);
  const profileReferences = {
    homepage: exactProfileReference(
      current.capabilityAuthority,
      candidate.narrowing.homepageProfileId,
    ),
    collection: exactProfileReference(
      current.capabilityAuthority,
      candidate.narrowing.collectionProfileId,
    ),
    search: exactProfileReference(current.capabilityAuthority, candidate.narrowing.searchProfileId),
    productDetail: exactProfileReference(
      current.capabilityAuthority,
      candidate.narrowing.pdpProfileId,
    ),
  };
  const plans = selectedPlans(candidate);
  const overridesByProfileAndSlot = new Map(
    slotOverrides.flatMap(({ profileId, slotSelections }) =>
      slotSelections.map((selection) => [`${profileId}:${selection.slotId}`, selection] as const),
    ),
  );
  const selectedSlots = plans.flatMap((plan) =>
    plan.slots.map((slot) => {
      const override = overridesByProfileAndSlot.get(`${plan.profile!.id}:${slot.id}`);
      return {
        plan,
        slot,
        variant: override?.variant ?? slot.defaultVariant,
        boundedParameters: override?.boundedParameters ?? {},
      };
    }),
  );
  const selectedComponentIds = new Set(selectedSlots.map(({ slot }) => slot.sectionType));
  const selectedComponentAuthorityIds = new Set(
    selectedSlots.flatMap(({ slot, variant, boundedParameters }) => [
      slot.sectionType,
      `${slot.sectionType}:${variant}`,
      ...Object.keys(boundedParameters).map((parameter) => `${slot.sectionType}:${parameter}`),
    ]),
  );
  const selectedResponsiveAuthorityIds = new Set(
    [...selectedComponentIds].flatMap(
      (component) =>
        veskifyComponentCapabilityManifest
          .getByComponentType(component)
          ?.commercialAnatomy?.responsiveTransformations.map(({ mode }) => `responsive:${mode}`) ??
        [],
    ),
  );
  const dynamicIds = new Set([
    dynamic.collectionArchetypeId,
    dynamic.searchArchetypeId,
    dynamic.standardSimpleArchetypeId,
    dynamic.configurableArchetypeId,
    dynamic.galleryLedArchetypeId,
    dynamic.highConsiderationArchetypeId,
    dynamic.genericFallbackArchetypeId,
    ...dynamic.productTypeMappings.map(({ archetypeId }) => archetypeId),
  ]);
  const dynamicArtDirectionIds = new Set(
    [
      ...input.currentRequestInput.draft.dynamicCommercePresentation!.collectionSearchArchetypes,
      ...input.currentRequestInput.draft.dynamicCommercePresentation!.productDetailArchetypes,
    ]
      .filter(({ id }) => dynamicIds.has(id))
      .flatMap(({ artDirectionPosture }) => [
        `art-direction:ratio:${artDirectionPosture.ratio}`,
        `art-direction:crop:${artDirectionPosture.crop}`,
        `art-direction:overlay:${artDirectionPosture.overlay}`,
      ]),
  );
  const selectedProductCardIds = new Set<string>(
    plans.flatMap((plan) => {
      const profile = plan.profile!;
      return [
        ...(profile.commercialHomepage ? [profile.commercialHomepage.productCardAnatomyId] : []),
        ...(profile.commercialCollectionSearch
          ? [profile.commercialCollectionSearch.productCardAnatomyId]
          : []),
        ...(profile.commercialProductDetail
          ? [profile.commercialProductDetail.relatedProductCardAnatomyId]
          : []),
      ];
    }),
  );
  const profileIdentities = new Set(
    plans.map(({ profile }) => `${profile!.id}@${profile!.version}`),
  );
  const includedOptionalPageFamilies = new Set(candidate.narrowing.includedOptionalPageFamilyIds);
  const selectedSiteMapPagesForDefaults = input.compatibilityInput.siteMapDecision.pages.filter(
    ({ familyId, required }) => required || includedOptionalPageFamilies.has(familyId),
  );
  const siteMapAuthorityIds = new Set(
    selectedSiteMapPagesForDefaults.flatMap(({ familyId, profile }) => {
      const identity = `${profile.id}@${profile.version}`;
      const plan = registeredCommercialPlans().find(
        (candidatePlan) => candidatePlan.profile?.id === profile.id,
      );
      return [
        identity,
        `${identity}:${familyId}`,
        ...(plan?.profile?.orderedNarrativeRoles.map((role) => `${identity}:${familyId}:${role}`) ??
          []),
      ];
    }),
  );
  const narrativeIdentities = new Set(
    selectedSlots.map(
      ({ plan, slot }) => `${plan.profile!.id}@${plan.profile!.version}:${slot.id}`,
    ),
  );
  const productTypeIdentities = new Set(
    dynamic.productTypeMappings.map(
      ({ productTypeId, archetypeId }) => `${productTypeId}:${archetypeId}`,
    ),
  );
  const selectedIdentityByDimension = new Set(
    [...selectedByPath.values()].map(({ dimension, authorityId }) => `${dimension}:${authorityId}`),
  );
  const defaultReferences = [...current.capabilityAuthority.referencesByPreferenceKey.values()]
    .filter((reference) => {
      if (
        reference.availability !== "available" ||
        selectedIdentityByDimension.has(`${reference.dimension}:${reference.authorityId}`)
      ) {
        return false;
      }
      if (dnaReferenceMatches(reference, candidate.designDna)) return true;
      if (reference.authorityKind === "shared-frame") {
        return reference.authorityId === candidate.narrowing.sharedFrameProfileId;
      }
      if (reference.authorityKind === "page-blueprint") {
        return (
          profileIdentities.has(reference.authorityId) ||
          narrativeIdentities.has(reference.authorityId) ||
          siteMapAuthorityIds.has(reference.authorityId)
        );
      }
      if (reference.authorityKind === "component-manifest") {
        return (
          selectedComponentAuthorityIds.has(reference.authorityId) ||
          selectedResponsiveAuthorityIds.has(reference.authorityId)
        );
      }
      if (reference.authorityKind === "dynamic-commerce") {
        return (
          dynamicIds.has(reference.authorityId) ||
          dynamicArtDirectionIds.has(reference.authorityId) ||
          productTypeIdentities.has(reference.authorityId)
        );
      }
      return (
        reference.authorityKind === "product-card" &&
        selectedProductCardIds.has(reference.authorityId)
      );
    })
    .sort((left, right) => compareCanonical(left.key, right.key));
  const baseDiagnostics = diagnosticsFor(preferences, current.capabilityAuthority, selectedByPath);
  const diagnostics = [
    ...baseDiagnostics,
    ...defaultReferences.map((reference): PromptedStorefrontResolutionDiagnostic => ({
      preferencePath: `defaults.${reference.dimension}.${reference.key}`,
      preferenceKey: reference.key,
      semantics: "optional",
      requestedRank: null,
      requestedValue: null,
      outcome: "defaulted",
      selectedAuthority: reference,
      reasonCode: "registered-safe-default",
      authorityFingerprint: reference.authorityFingerprint,
    })),
  ];
  const productCardAnatomyIds = stableUnique([
    ...selectedPlans(candidate).flatMap((plan) => {
      const profile = plan.profile;
      if (!profile) return [];
      return [
        ...(profile.commercialHomepage ? [profile.commercialHomepage.productCardAnatomyId] : []),
        ...(profile.commercialCollectionSearch
          ? [profile.commercialCollectionSearch.productCardAnatomyId]
          : []),
        ...(profile.commercialProductDetail
          ? [profile.commercialProductDetail.relatedProductCardAnatomyId]
          : []),
      ];
    }),
    ...selectedReferences
      .filter(({ authorityKind }) => authorityKind === "product-card")
      .map(({ authorityId }) => authorityId),
    ...input.currentRequestInput.draft
      .dynamicCommercePresentation!.collectionSearchArchetypes.filter(({ id }) =>
        [dynamic.collectionArchetypeId, dynamic.searchArchetypeId].includes(id),
      )
      .flatMap(({ profile }) => {
        const exact = getCommercialCollectionSearchProfile(profile.profileId)?.profile
          ?.commercialCollectionSearch;
        return exact ? [exact.productCardAnatomyId] : [];
      }),
    ...input.currentRequestInput.draft
      .dynamicCommercePresentation!.productDetailArchetypes.filter(({ id }) =>
        [
          dynamic.standardSimpleArchetypeId,
          dynamic.configurableArchetypeId,
          dynamic.galleryLedArchetypeId,
          dynamic.highConsiderationArchetypeId,
          dynamic.genericFallbackArchetypeId,
        ].includes(id),
      )
      .flatMap(({ profile }) => {
        const exact = getCommercialPdpProfile(profile.profileId)?.profile?.commercialProductDetail;
        return exact ? [exact.relatedProductCardAnatomyId] : [];
      }),
  ]);
  const homepagePlan = getCommercialHomepageProfile(candidate.narrowing.homepageProfileId)!;
  const homepageRoleSequence = homepagePlan.profile!.orderedNarrativeRoles;
  const includedOptionalPageFamilyIds = new Set(candidate.narrowing.includedOptionalPageFamilyIds);
  const selectedSiteMapPages = input.compatibilityInput.siteMapDecision.pages.filter(
    ({ familyId, required }) => required || includedOptionalPageFamilyIds.has(familyId),
  );
  const contentSupportProfileIds = new Set(
    listCommercialContentSupportProfiles().flatMap(({ profile }) => (profile ? [profile.id] : [])),
  );
  const utilityProfileIds = new Set(
    listCommercialUtilityProfiles().flatMap(({ profile }) => (profile ? [profile.id] : [])),
  );
  const staticContentSupportSelections = stableUnique(
    selectedSiteMapPages
      .filter(({ profile }) => contentSupportProfileIds.has(profile.id))
      .map(({ profile }) => `${profile.id}@${profile.version}`),
  );
  const utilityPresentationSelections = stableUnique(
    selectedSiteMapPages
      .filter(({ profile }) => utilityProfileIds.has(profile.id))
      .map(({ profile }) => `${profile.id}@${profile.version}`),
  );
  const responsiveCapabilityKeys = stableUnique(
    selectedReferences
      .filter(({ dimension }) => dimension.startsWith("responsive."))
      .map(({ key }) => key),
  );
  const artDirectionCapabilityKeys = stableUnique(
    selectedReferences
      .filter(({ dimension }) =>
        ["responsive.image", "responsive.crop", "responsive.overlay"].includes(dimension),
      )
      .map(({ key }) => key),
  );
  const approvedAssetRoleKeys = stableUnique(
    selectedReferences
      .filter(({ authorityKind }) => authorityKind === "approved-assets")
      .map(({ key }) => key),
  );
  const authorityFingerprints = stableUnique([
    current.request.currentAuthority.capabilityReferenceAuthorityFingerprint,
    current.request.currentAuthority.capabilityManifestFingerprint,
    current.request.currentAuthority.pageBlueprintAuthorityFingerprint,
    current.request.currentAuthority.designDnaAuthorityFingerprint,
    dynamic.authorityFingerprint,
    frame.authorityFingerprint,
    ...selectedReferences.map(({ authorityFingerprint }) => authorityFingerprint),
  ]);
  const structuralMaterial = {
    selectionNarrowing: candidate.narrowing,
    slotOverrides,
    homepageRoleSequence,
  };
  const currentAuthorityFingerprint = `prompted-current-authority-${canonicalValueFingerprint(
    current.request.currentAuthority,
  )}`;
  const material = {
    contractVersion: COMPILED_PROMPTED_STOREFRONT_DESIGN_DECISION_V2,
    identity: {
      requestFingerprint: current.request.requestFingerprint,
      promptFingerprint: current.request.promptFingerprint,
      providerIntentFingerprint: intent.intentFingerprint,
      currentAuthorityFingerprint,
      capabilityReferenceAuthorityFingerprint:
        current.request.currentAuthority.capabilityReferenceAuthorityFingerprint,
      baseSnapshotId: current.request.currentAuthority.draftSnapshotId,
      baseSnapshotRevision: current.request.currentAuthority.draftRevision,
    },
    selectionNarrowing: candidate.narrowing,
    designDna: {
      directionId: candidate.narrowing.directionId,
      authorityFingerprint: `compiled-design-dna-${canonicalValueFingerprint(candidate.designDna)}`,
      value: candidate.designDna,
    },
    sharedFrame: {
      profileId: frame.id,
      profileVersion: frame.version,
      authorityFingerprint: frame.authorityFingerprint,
    },
    profiles: {
      homepage: {
        profileId: candidate.narrowing.homepageProfileId,
        authorityFingerprint: profileReferences.homepage.authorityFingerprint,
      },
      collection: {
        profileId: candidate.narrowing.collectionProfileId,
        authorityFingerprint: profileReferences.collection.authorityFingerprint,
      },
      search: {
        profileId: candidate.narrowing.searchProfileId,
        authorityFingerprint: profileReferences.search.authorityFingerprint,
      },
      productDetail: {
        profileId: candidate.narrowing.pdpProfileId,
        authorityFingerprint: profileReferences.productDetail.authorityFingerprint,
      },
    },
    dynamicCommerceSelection: dynamic,
    pageBlueprintSelectionOverrides:
      wholeStorefrontPageBlueprintSelectionOverridesSchema.parse(slotOverrides),
    productCardAnatomyIds,
    selectedCapabilityReferences: selectedReferences,
    staticContentSupportSelections,
    utilityPresentationSelections,
    narrative: {
      homepageRoleSequence,
      desktopPriority: intent.responsiveArtDirection.desktopNarrativePriority.map(({ key }) => key),
      mobilePriority: intent.responsiveArtDirection.mobileNarrativePriority.map(({ key }) => key),
    },
    responsiveArtDirection: {
      responsiveMode: candidate.narrowing.responsiveMode,
      responsiveCapabilityKeys,
      artDirectionCapabilityKeys,
      approvedAssetRoleKeys,
    },
    evidenceBackedOmissions: stableUnique(
      diagnostics
        .filter(({ outcome }) => outcome === "omitted")
        .map(({ preferenceKey }) => preferenceKey),
    ),
    diagnostics,
    exactAuthorityFingerprints: authorityFingerprints,
    structuralFingerprint: `compiled-prompted-structural-${canonicalValueFingerprint(
      structuralMaterial,
    )}`,
    dynamicRoutePresentationFingerprint: `compiled-prompted-dynamic-${canonicalValueFingerprint(
      dynamic,
    )}`,
  };
  return compiledPromptedStorefrontDesignDecisionV2Schema.parse({
    ...material,
    compiledDecisionFingerprint: compiledPromptedStorefrontDesignDecisionFingerprint(material),
  });
}
