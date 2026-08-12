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
  resolveCommercialHomepageEvidenceAvailability,
  resolveCommercialHomepageProfileSlots,
  type StorefrontTemplatePagePlan,
} from "@/application/storefront-templates";
import {
  wholeStorefrontApprovedAssetRoleSelectionsSchema,
  wholeStorefrontPageBlueprintSelectionOverridesSchema,
  type WholeStorefrontApprovedAssetRoleSelection,
  type WholeStorefrontPageBlueprintSelectionOverride,
} from "@/application/whole-storefront-generation-plan";
import { veskifyComponentCapabilityManifest } from "@/components/registry";
import { resolveBrandSystemDesignDna, type DesignDna } from "@/domain/design-system";
import {
  canonicalProductCardAuthority,
  canonicalProductTypePresentationId,
} from "@/domain/product-card";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  getCommercialSharedFrameProfile,
  listPageFamilyDefinitions,
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
  homepageSlotIds: readonly string[];
  homepageRoleSequence: readonly string[];
}>;

function exactSynthesisSelection(narrowing: BoundedStorefrontSynthesisSelectionNarrowing) {
  const {
    authorityId: _authorityId,
    authorityVersion: _authorityVersion,
    authorityFingerprint: _authorityFingerprint,
    selectionId: _selectionId,
    ...exact
  } = narrowing;
  void _authorityId;
  void _authorityVersion;
  void _authorityFingerprint;
  void _selectionId;
  return exact;
}

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

function diversityAvoidancePreferences(
  request: PromptedStorefrontDesignRequestV2,
  authority: PromptedStorefrontCapabilityAuthority,
): LocatedPreference[] {
  return request.priorDiversityEvidence.merchantAvoidancePreferenceKeys.map((key, index) => {
    const reference = authority.referencesByPreferenceKey.get(key);
    if (!reference) fail("stale-authority", `Diversity avoidance ${key} is no longer current.`);
    return {
      path: `priorDiversityEvidence.merchantAvoidancePreferenceKeys[${index}]`,
      key,
      dimension: reference.dimension,
      semantics: "avoid",
      rank: null,
      value: null,
    };
  });
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

function approvedSiteMapEvidenceIds(
  input: CompilePromptedStorefrontDesignIntentV2Input,
): ReadonlySet<string> {
  return new Set(
    input.compatibilityInput.approvedEvidenceReferences
      .filter(({ status }) => status === "approved")
      .map(({ source, authorityId, revision }) => `${source}:${authorityId}:${revision}`),
  );
}

function pageHasCurrentApprovedEvidence(
  page: CompilePromptedStorefrontDesignIntentV2Input["compatibilityInput"]["siteMapDecision"]["pages"][number],
  approvedEvidenceIds: ReadonlySet<string>,
): boolean {
  return page.evidenceReferences.every(({ source, authorityId, revision }) =>
    approvedEvidenceIds.has(`${source}:${authorityId}:${revision}`),
  );
}

function selectedSiteMapPages(
  input: CompilePromptedStorefrontDesignIntentV2Input,
  candidate: Readonly<{ narrowing: BoundedStorefrontSynthesisSelectionNarrowing }>,
) {
  const approvedEvidenceIds = approvedSiteMapEvidenceIds(input);
  const includedOptionalPageFamilies = new Set(candidate.narrowing.includedOptionalPageFamilyIds);
  return input.compatibilityInput.siteMapDecision.pages.filter((page) => {
    const evidenceSatisfied = pageHasCurrentApprovedEvidence(page, approvedEvidenceIds);
    if (!evidenceSatisfied && page.required) {
      fail(
        "no-compatible-selection",
        `Required page ${page.key} does not have current approved evidence.`,
      );
    }
    return evidenceSatisfied && (page.required || includedOptionalPageFamilies.has(page.familyId));
  });
}

function missingEvidenceSiteMapAuthority(
  input: CompilePromptedStorefrontDesignIntentV2Input,
): ReadonlySet<string> {
  const approvedEvidenceIds = approvedSiteMapEvidenceIds(input);
  const pages = input.compatibilityInput.siteMapDecision.pages.filter(
    (page) => !pageHasCurrentApprovedEvidence(page, approvedEvidenceIds),
  );
  return new Set(
    pages.flatMap(({ familyId, profile }) => {
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
}

function selectedSiteMapAuthorityIds(
  input: CompilePromptedStorefrontDesignIntentV2Input,
  candidate: Readonly<{ narrowing: BoundedStorefrontSynthesisSelectionNarrowing }>,
): ReadonlySet<string> {
  return new Set(
    selectedSiteMapPages(input, candidate).flatMap(({ familyId, profile }) => {
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
}

function omittedEvidenceFamilyIds(
  input: CompilePromptedStorefrontDesignIntentV2Input,
): ReadonlySet<string> {
  const approvedEvidenceIds = approvedSiteMapEvidenceIds(input);
  const evidenceEligibleFamilies = new Set(
    input.compatibilityInput.siteMapDecision.pages
      .filter((page) => pageHasCurrentApprovedEvidence(page, approvedEvidenceIds))
      .map(({ familyId }) => familyId),
  );
  return new Set(
    listPageFamilyDefinitions()
      .filter(
        ({ id, evidenceRequirement, omissionBehavior }) =>
          evidenceRequirement === "approved-facts" &&
          omissionBehavior === "omit-optional-or-fail-required" &&
          !evidenceEligibleFamilies.has(id),
      )
      .map(({ id }) => id),
  );
}

function isSubsequence(requested: readonly string[], actual: readonly string[]): boolean {
  let cursor = 0;
  for (const value of actual) {
    if (requested[cursor] === value) cursor += 1;
  }
  return cursor === requested.length;
}

function resolveExactHomepageExecution(
  input: CompilePromptedStorefrontDesignIntentV2Input,
  narrowing: BoundedStorefrontSynthesisSelectionNarrowing,
): Readonly<{
  slotIds: readonly string[];
  roleSequence: readonly string[];
}> | null {
  const plan = getCommercialHomepageProfile(narrowing.homepageProfileId);
  if (!plan?.profile) fail("stale-authority", "The selected homepage profile is unavailable.");
  const evidence = resolveCommercialHomepageEvidenceAvailability({
    canonicalProductCount: input.currentRequestInput.catalogue.products.length,
    canonicalCollectionCount: input.currentRequestInput.catalogue.collections.length,
    merchantDescription: input.currentRequestInput.approvedBrief.businessIdentity.shortDescription,
    briefApprovalStatus: input.currentRequestInput.approvedBrief.approval.status,
    approvedEvidenceFingerprint:
      input.currentRequestInput.approvedBrief.approvedEvidenceFingerprint,
  });
  const approvedRoles = new Set(
    input.currentRequestInput.approvedAssetContext?.assets.map(({ role }) => role) ?? [],
  );
  const approvedMediaSlotIds = plan.slots.flatMap((slot) => {
    const definition = input.compatibilityInput.planningInput.componentDefinitions.find(
      ({ type }) => type === slot.sectionType,
    );
    if (!definition) {
      fail("stale-authority", `Component ${slot.sectionType} is unavailable.`);
    }
    const acceptedRoles = new Set(
      definition.assetSlots.flatMap(({ acceptedRoles: roles }) => roles),
    );
    return [...acceptedRoles].some((role) => approvedRoles.has(role)) ? [slot.id] : [];
  });
  let includedSlotIds: readonly string[];
  try {
    includedSlotIds = resolveCommercialHomepageProfileSlots(plan.profile.id, {
      ...evidence,
      approvedMediaSlotIds,
    }).includedSlotIds;
  } catch {
    return null;
  }
  const included = new Set(includedSlotIds);
  return {
    slotIds: [...includedSlotIds],
    roleSequence: plan.slots
      .filter(({ id }) => included.has(id))
      .map(({ narrativeRole }) => narrativeRole),
  };
}

function homepageNarrativeCompatible(
  intent: PromptedStorefrontDesignIntentV2,
  candidate: CandidateContext,
  authority: PromptedStorefrontCapabilityAuthority,
): boolean {
  const roles = candidate.homepageRoleSequence;
  const slotFor = (key: string): Readonly<{ slotId: string; role: string }> | null => {
    const reference = authority.referencesByPreferenceKey.get(key);
    const plan = getCommercialHomepageProfile(candidate.narrowing.homepageProfileId);
    const profile = plan?.profile;
    if (!reference || !profile) return null;
    const slot = plan.slots.find(
      ({ id }) => reference.authorityId === `${profile.id}@${profile.version}:${id}`,
    );
    return slot ? { slotId: slot.id, role: slot.narrativeRole } : null;
  };
  const requested = intent.homepage.narrativeRoleSequence.map(
    ({ key }) => slotFor(key)?.slotId ?? "",
  );
  const required = intent.homepage.requiredRoles.map(({ key }) => slotFor(key)?.slotId ?? "");
  const avoided = intent.homepage.avoidedRoles.map(({ key }) => slotFor(key)?.slotId ?? "");
  const desktopPriority = intent.responsiveArtDirection.desktopNarrativePriority.map(
    ({ key }) => slotFor(key)?.slotId ?? "",
  );
  const mobilePriority = intent.responsiveArtDirection.mobileNarrativePriority.map(
    ({ key }) => slotFor(key)?.slotId ?? "",
  );
  return (
    roles.length > 0 &&
    isSubsequence(requested, candidate.homepageSlotIds) &&
    required.every((slotId) => candidate.homepageSlotIds.includes(slotId)) &&
    avoided.every((slotId) => !candidate.homepageSlotIds.includes(slotId)) &&
    isSubsequence(desktopPriority, candidate.homepageSlotIds) &&
    isSubsequence(mobilePriority, candidate.homepageSlotIds)
  );
}

function candidateReferenceMatches(
  candidate: CandidateContext,
  preference: LocatedPreference,
  reference: PromptedStorefrontCapabilityAuthorityReference,
  dynamicCollections: readonly DynamicCommerceCollectionSearchArchetype[],
  dynamicProducts: readonly DynamicCommerceProductDetailArchetype[],
  siteMapAuthorityIds: ReadonlySet<string>,
  omittedEvidenceFamilies: ReadonlySet<string>,
  exactHomepageSectionCount: number,
  exactResponsiveAuthorityIds?: ReadonlySet<string>,
  exactApprovedAssetAuthorityIds?: ReadonlySet<string>,
): boolean | null {
  if (reference.authorityKind === "design-dna") {
    return dnaReferenceMatches(reference, candidate.designDna);
  }
  if (reference.authorityKind === "shared-frame") {
    return reference.authorityId === candidate.narrowing.sharedFrameProfileId;
  }
  if (
    reference.authorityKind === "approved-assets" &&
    reference.dimension === "homepage.asset-role"
  ) {
    return exactApprovedAssetAuthorityIds?.has(reference.authorityId) ?? null;
  }
  if (
    reference.authorityKind === "page-blueprint" &&
    ["content-support.profile", "content-support.narrative-purpose", "utility.profile"].includes(
      reference.dimension,
    )
  ) {
    return siteMapAuthorityIds.has(reference.authorityId);
  }
  if (
    reference.authorityKind === "approved-evidence" &&
    reference.dimension === "content-support.omission"
  ) {
    return omittedEvidenceFamilies.has(reference.authorityId);
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
      preference.minimum <= exactHomepageSectionCount &&
      exactHomepageSectionCount <= preference.maximum &&
      preference.value === exactHomepageSectionCount
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
      return exactResponsiveAuthorityIds?.has(reference.authorityId) ?? null;
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

function authorityPrefix(authorityId: string): string {
  const separator = authorityId.lastIndexOf(":");
  return separator < 0 ? authorityId : authorityId.slice(0, separator);
}

/**
 * A preference list may contain several independent material axes (for example
 * typography, spacing and density). Ranking is therefore resolved per exact
 * material boundary, not once for the whole provider array.
 */
function preferenceResolutionBoundary(
  preference: LocatedPreference,
  reference: PromptedStorefrontCapabilityAuthorityReference,
): string {
  if (reference.authorityKind === "design-dna") {
    return `${preference.dimension}:${authorityPrefix(reference.authorityId)}`;
  }
  if (
    reference.authorityKind === "approved-assets" &&
    preference.dimension === "homepage.asset-role"
  ) {
    return `${preference.dimension}:${reference.key.split(".").slice(0, -1).join(".")}`;
  }
  if (
    reference.authorityKind === "component-manifest" &&
    ["homepage.meaningful-variant", "component.meaningful-variant"].includes(preference.dimension)
  ) {
    return `${preference.dimension}:${reference.authorityId.split(":")[0]}`;
  }
  if (
    reference.authorityKind === "component-manifest" &&
    preference.dimension === "component.bounded-parameter"
  ) {
    return `${preference.dimension}:${reference.authorityId}`;
  }
  if (preference.dimension === "pdp.archetype") {
    const rolePaths = [
      "standardSimplePreferences",
      "configurablePreferences",
      "galleryLedPreferences",
      "highConsiderationPreferences",
      "genericFallbackPreferences",
    ];
    const rolePath = rolePaths.find((path) => preference.path.includes(path));
    const productTypePath = preference.path.match(/productTypeIntentions\[\d+\]/)?.[0];
    return `${preference.dimension}:${productTypePath ?? rolePath ?? "aggregate"}`;
  }
  if (
    reference.authorityKind === "page-blueprint" &&
    preference.dimension === "content-support.profile"
  ) {
    return `${preference.dimension}:${reference.authorityId.split(":").at(-1)}`;
  }
  if (
    reference.authorityKind === "page-blueprint" &&
    preference.dimension === "content-support.narrative-purpose"
  ) {
    return `${preference.dimension}:${reference.authorityId.split(":").slice(-2).join(":")}`;
  }
  if (preference.dimension === "utility.profile") {
    return `${preference.dimension}:${reference.authorityId}`;
  }
  if (
    reference.authorityKind === "approved-evidence" &&
    preference.dimension === "content-support.omission"
  ) {
    return `${preference.dimension}:${reference.authorityId}`;
  }
  return preference.dimension;
}

function groupPreferencesByResolutionBoundary(
  preferences: readonly LocatedPreference[],
  authority: Pick<PromptedStorefrontCapabilityAuthority, "referencesByPreferenceKey">,
): ReadonlyMap<string, readonly LocatedPreference[]> {
  const grouped = new Map<string, LocatedPreference[]>();
  for (const preference of preferences) {
    const boundary = preferenceResolutionBoundary(preference, referenceFor(authority, preference));
    grouped.set(boundary, [...(grouped.get(boundary) ?? []), preference]);
  }
  return grouped;
}

function materialBoundaryForReference(
  reference: PromptedStorefrontCapabilityAuthorityReference,
): string {
  if (reference.authorityKind === "design-dna") {
    return `${reference.dimension}:${authorityPrefix(reference.authorityId)}`;
  }
  if (
    reference.authorityKind === "approved-assets" &&
    reference.dimension === "homepage.asset-role"
  ) {
    return `${reference.dimension}:${reference.key.split(".").slice(0, -1).join(".")}`;
  }
  if (
    reference.authorityKind === "component-manifest" &&
    ["homepage.meaningful-variant", "component.meaningful-variant"].includes(reference.dimension)
  ) {
    return `${reference.dimension}:${reference.authorityId.split(":")[0]}`;
  }
  if (
    reference.authorityKind === "component-manifest" &&
    reference.dimension === "component.bounded-parameter"
  ) {
    return `${reference.dimension}:${reference.authorityId}`;
  }
  if (reference.dimension === "pdp.archetype" && reference.intentRoles?.length) {
    return `${reference.dimension}:${[...reference.intentRoles].sort(compareCanonical).join("+")}`;
  }
  if (
    reference.authorityKind === "page-blueprint" &&
    reference.dimension === "content-support.profile"
  ) {
    return `${reference.dimension}:${reference.authorityId.split(":").at(-1)}`;
  }
  if (
    reference.authorityKind === "page-blueprint" &&
    reference.dimension === "content-support.narrative-purpose"
  ) {
    return `${reference.dimension}:${reference.authorityId.split(":").slice(-2).join(":")}`;
  }
  if (reference.dimension === "utility.profile") {
    return `${reference.dimension}:${reference.authorityId}`;
  }
  if (
    reference.authorityKind === "approved-evidence" &&
    reference.dimension === "content-support.omission"
  ) {
    return `${reference.dimension}:${reference.authorityId}`;
  }
  if (
    reference.authorityKind === "page-blueprint" &&
    reference.dimension === "homepage.narrative-role"
  ) {
    return `${reference.dimension}:${reference.authorityId.split(":").at(-1)}`;
  }
  if (reference.productTypeKey) {
    return `${reference.dimension}:${authorityPrefix(reference.authorityId)}`;
  }
  return reference.dimension;
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

function promptedCandidateStructuralMaterial(input: {
  compilerInput: CompilePromptedStorefrontDesignIntentV2Input;
  candidate: CandidateContext;
  slotOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[];
  dynamicCommerceSelection: ReturnType<typeof buildDynamicSelection>["selection"];
}) {
  const {
    directionId: _directionId,
    includedOptionalPageFamilyIds: _includedOptionalPageFamilyIds,
    ...structuralSelection
  } = exactSynthesisSelection(input.candidate.narrowing);
  const { colour: _colour, ...structuralDesignDna } = input.candidate.designDna;
  void _directionId;
  void _includedOptionalPageFamilyIds;
  void _colour;
  const selectedSiteMapPagesForStructure = selectedSiteMapPages(
    input.compilerInput,
    input.candidate,
  );
  const contentSupportProfileIds = new Set(
    listCommercialContentSupportProfiles().flatMap(({ profile }) => (profile ? [profile.id] : [])),
  );
  const utilityProfileIds = new Set(
    listCommercialUtilityProfiles().flatMap(({ profile }) => (profile ? [profile.id] : [])),
  );
  const dynamic = input.compilerInput.currentRequestInput.draft.dynamicCommercePresentation;
  if (!dynamic) fail("stale-authority", "Dynamic-commerce authority is missing.");
  const selectedDynamicArchetypeIds = new Set([
    input.dynamicCommerceSelection.collectionArchetypeId,
    input.dynamicCommerceSelection.searchArchetypeId,
    input.dynamicCommerceSelection.standardSimpleArchetypeId,
    input.dynamicCommerceSelection.configurableArchetypeId,
    input.dynamicCommerceSelection.galleryLedArchetypeId,
    input.dynamicCommerceSelection.highConsiderationArchetypeId,
    input.dynamicCommerceSelection.genericFallbackArchetypeId,
    ...input.dynamicCommerceSelection.productTypeMappings.map(({ archetypeId }) => archetypeId),
  ]);
  const productCardAnatomyIds = stableUnique([
    ...selectedMaterializedPlanContexts(input.compilerInput, input.candidate).flatMap(
      ({ plan }) => {
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
      },
    ),
    ...dynamic.collectionSearchArchetypes
      .filter(({ id }) => selectedDynamicArchetypeIds.has(id))
      .flatMap(({ profile }) => {
        const authority = getCommercialCollectionSearchProfile(profile.profileId)?.profile
          ?.commercialCollectionSearch;
        return authority ? [authority.productCardAnatomyId] : [];
      }),
    ...dynamic.productDetailArchetypes
      .filter(({ id }) => selectedDynamicArchetypeIds.has(id))
      .flatMap(({ profile }) => {
        const authority = getCommercialPdpProfile(profile.profileId)?.profile
          ?.commercialProductDetail;
        return authority ? [authority.relatedProductCardAnatomyId] : [];
      }),
  ]);
  return {
    structuralSelection,
    structuralDesignDna,
    pageSet: selectedSiteMapPagesForStructure
      .map(({ familyId, profile }) => {
        const profileId =
          familyId === "home"
            ? input.candidate.narrowing.homepageProfileId
            : familyId === "collection"
              ? input.candidate.narrowing.collectionProfileId
              : familyId === "search-results"
                ? input.candidate.narrowing.searchProfileId
                : familyId === "product-detail"
                  ? input.candidate.narrowing.pdpProfileId
                  : profile.id;
        const selectedProfile = registeredCommercialPlans().find(
          (plan) => plan.profile?.id === profileId,
        )?.profile;
        if (!selectedProfile) {
          fail("stale-authority", `Selected PageBlueprint profile ${profileId} is unavailable.`);
        }
        return { familyId, profileId, profileVersion: selectedProfile.version };
      })
      .sort((left, right) =>
        compareCanonical(canonicalValueString(left), canonicalValueString(right)),
      ),
    slotOverrides: input.slotOverrides,
    homepageRoleSequence: [...input.candidate.homepageRoleSequence],
    staticContentSupportSelections: stableUnique(
      selectedSiteMapPagesForStructure
        .filter(({ profile }) => contentSupportProfileIds.has(profile.id))
        .map(({ profile }) => `${profile.id}@${profile.version}`),
    ),
    utilityPresentationSelections: stableUnique(
      selectedSiteMapPagesForStructure
        .filter(({ profile }) => utilityProfileIds.has(profile.id))
        .map(({ profile }) => `${profile.id}@${profile.version}`),
    ),
    dynamicCommercePresentation: {
      collectionArchetypeId: input.dynamicCommerceSelection.collectionArchetypeId,
      searchArchetypeId: input.dynamicCommerceSelection.searchArchetypeId,
      standardSimpleArchetypeId: input.dynamicCommerceSelection.standardSimpleArchetypeId,
      configurableArchetypeId: input.dynamicCommerceSelection.configurableArchetypeId,
      galleryLedArchetypeId: input.dynamicCommerceSelection.galleryLedArchetypeId,
      highConsiderationArchetypeId: input.dynamicCommerceSelection.highConsiderationArchetypeId,
      genericFallbackArchetypeId: input.dynamicCommerceSelection.genericFallbackArchetypeId,
      productTypeMappings: input.dynamicCommerceSelection.productTypeMappings,
    },
    productCardAnatomyIds,
  };
}

function promptedCandidateStructuralFingerprint(
  input: Parameters<typeof promptedCandidateStructuralMaterial>[0],
): string {
  return `compiled-prompted-structural-${canonicalValueFingerprint(
    promptedCandidateStructuralMaterial(input),
  )}`;
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
  const diversity = input.originalRequest.priorDiversityEvidence;
  const recentlyUsedKeys = new Set(diversity.recentlyUsedPostureKeys);
  const priorStructuralFingerprints = new Set([
    ...diversity.recentAcceptedStructuralFingerprints,
    ...diversity.recentRejectedStructuralFingerprints,
  ]);
  const slotOverridesBySelection = new Map<
    string,
    readonly WholeStorefrontPageBlueprintSelectionOverride[]
  >();
  const exactResponsiveAuthorityBySelection = new Map<string, ReadonlySet<string>>();
  const exactSelectionFailures: PromptedStorefrontDesignCompilerError[] = [];
  const candidates = narrowings
    .flatMap((narrowing) => {
      const brandSystem = registeredBrandSystemForDirection(
        input.currentRequestInput.draft.brandSystem,
        input.compatibilityInput.planningInput.recipeContext.designSystem,
        narrowing.directionId,
        {
          spacingDensity: narrowing.designSystemSpacingDensity,
          surfaceDepth: narrowing.designSystemSurfaceDepth,
        },
      );
      const homepage = resolveExactHomepageExecution(input, narrowing);
      if (!homepage) return [];
      return [
        {
          narrowing,
          designDna: resolveBrandSystemDesignDna(brandSystem),
          homepageSlotIds: homepage.slotIds,
          homepageRoleSequence: homepage.roleSequence,
        },
      ];
    })
    .filter((candidate) => homepageNarrativeCompatible(intent, candidate, authority))
    .flatMap((candidate) => {
      let score = 0;
      const matches = new Map<string, boolean | null>();
      const siteMapAuthority = selectedSiteMapAuthorityIds(input, candidate);
      const omittedEvidenceFamilies = omittedEvidenceFamilyIds(input);
      const responsiveSelectionKey = canonicalValueString({
        homepageProfileId: candidate.narrowing.homepageProfileId,
        collectionProfileId: candidate.narrowing.collectionProfileId,
        searchProfileId: candidate.narrowing.searchProfileId,
        pdpProfileId: candidate.narrowing.pdpProfileId,
        includedOptionalPageFamilyIds: candidate.narrowing.includedOptionalPageFamilyIds,
      });
      let slotOverrides = slotOverridesBySelection.get(responsiveSelectionKey);
      let exactResponsiveAuthorityIds =
        exactResponsiveAuthorityBySelection.get(responsiveSelectionKey);
      let exactApprovedAssetAuthorityIds: ReadonlySet<string>;
      let dynamicCommerceSelection: ReturnType<typeof buildDynamicSelection>["selection"];
      try {
        if (!slotOverrides) {
          slotOverrides = resolvePromptedStorefrontExactSlotOverrides({
            selectionNarrowing: candidate.narrowing,
            componentDefinitions: input.compatibilityInput.planningInput.componentDefinitions,
            authority,
            preferences,
            includedHomepageSlotIds: candidate.homepageSlotIds,
          }).slotOverrides;
          slotOverridesBySelection.set(responsiveSelectionKey, slotOverrides);
        }
        if (!exactResponsiveAuthorityIds) {
          exactResponsiveAuthorityIds = resolvePromptedStorefrontExactResponsiveAuthorityIds({
            compilerInput: input,
            candidate,
            slotOverrides,
          });
          exactResponsiveAuthorityBySelection.set(
            responsiveSelectionKey,
            exactResponsiveAuthorityIds,
          );
        }
        const approvedAssetResolution = resolveExactApprovedAssetSelections({
          currentRequestInput: input.currentRequestInput,
          candidate,
          slotOverrides,
          authority,
          preferences,
        });
        exactApprovedAssetAuthorityIds = new Set(
          approvedAssetResolution.selections.map(approvedAssetSelectionAuthorityId),
        );
        dynamicCommerceSelection = buildDynamicSelection(
          input,
          intent,
          candidate,
          authority,
          preferences,
        ).selection;
      } catch (error) {
        if (
          error instanceof PromptedStorefrontDesignCompilerError &&
          [
            "unsatisfied-hard-preference",
            "incompatible-component-selection",
            "no-compatible-selection",
          ].includes(error.code)
        ) {
          exactSelectionFailures.push(error);
          return [];
        }
        throw error;
      }
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
                siteMapAuthority,
                omittedEvidenceFamilies,
                candidate.homepageSlotIds.length,
                exactResponsiveAuthorityIds,
                exactApprovedAssetAuthorityIds,
              )
            : null;
        matches.set(preference.path, selected);
        if (selected === null) continue;
        if (preference.semantics === "hard" && !selected) return [];
        if (preference.semantics === "avoid" && selected) return [];
        if (selected && preference.semantics === "hard") score += 100_000;
      }
      for (const group of groupPreferencesByResolutionBoundary(preferences, authority).values()) {
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
      for (const key of recentlyUsedKeys) {
        const reference = authority.referencesByPreferenceKey.get(key);
        if (!reference) fail("stale-authority", `Diversity posture ${key} is no longer current.`);
        const syntheticPreference: LocatedPreference = {
          path: `priorDiversityEvidence.recentlyUsedPostureKeys.${key}`,
          key,
          dimension: reference.dimension,
          semantics: "optional",
          rank: null,
          value: null,
        };
        if (
          candidateReferenceMatches(
            candidate,
            syntheticPreference,
            reference,
            dynamic.collectionSearchArchetypes,
            dynamic.productDetailArchetypes,
            siteMapAuthority,
            omittedEvidenceFamilies,
            candidate.homepageSlotIds.length,
            exactResponsiveAuthorityIds,
            exactApprovedAssetAuthorityIds,
          ) === true
        ) {
          score -= 10;
        }
      }
      return [
        {
          candidate,
          score,
          structuralFingerprint: promptedCandidateStructuralFingerprint({
            compilerInput: input,
            candidate,
            slotOverrides,
            dynamicCommerceSelection,
          }),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareCanonical(
          left.candidate.narrowing.selectionId,
          right.candidate.narrowing.selectionId,
        ),
    );
  if (candidates.length === 0) {
    const hardFailure = exactSelectionFailures.find(
      ({ code }) => code === "unsatisfied-hard-preference",
    );
    if (hardFailure) {
      throw hardFailure;
    }
    fail(
      "no-compatible-selection",
      "No current metadata-only coordinated direction is compatible with the exact provider intent.",
    );
  }
  const selected = candidates.find(
    ({ structuralFingerprint }) => !priorStructuralFingerprints.has(structuralFingerprint),
  )?.candidate;
  if (!selected) {
    fail(
      "no-compatible-selection",
      "Every compatible metadata-only coordinated direction duplicates a recently accepted or rejected structure.",
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
  const grouped = groupPreferencesByResolutionBoundary(
    materiallyApplicable.map(({ preference }) => preference),
    input.authority,
  );
  const rankedCandidates = allowed
    .map((candidate) => {
      let score = 0;
      for (const group of grouped.values()) {
        const bestSoft = group
          .filter(
            (preference) =>
              preference.semantics === "soft" &&
              input.matches(candidate, referenceFor(input.authority, preference)) === true,
          )
          .sort(
            (left, right) =>
              (left.rank ?? 32) - (right.rank ?? 32) ||
              compareCanonical(left.key, right.key) ||
              compareCanonical(left.path, right.path),
          )[0];
        if (bestSoft) {
          score += 10_000 - (bestSoft.rank ?? 32);
        } else if (
          group.some(
            (preference) =>
              preference.semantics === "optional" &&
              input.matches(candidate, referenceFor(input.authority, preference)) === true,
          )
        ) {
          score += 100;
        }
      }
      return { candidate, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.candidate.id === input.defaultId) -
          Number(left.candidate.id === input.defaultId) ||
        compareCanonical(left.candidate.id, right.candidate.id),
    );
  const selected = rankedCandidates[0]?.candidate;
  if (!selected) {
    return fail("no-compatible-selection", `No ${input.label} selection remains.`);
  }
  const selectedPreferences = [
    ...hard
      .filter(({ reference }) => input.matches(selected, reference) === true)
      .map(({ preference }) => preference),
    ...[...grouped.values()].flatMap((group) => {
      const soft = group
        .filter(
          (preference) =>
            preference.semantics === "soft" &&
            input.matches(selected, referenceFor(input.authority, preference)) === true,
        )
        .sort(
          (left, right) =>
            (left.rank ?? 32) - (right.rank ?? 32) ||
            compareCanonical(left.key, right.key) ||
            compareCanonical(left.path, right.path),
        )[0];
      const optional = group
        .filter(
          (preference) =>
            preference.semantics === "optional" &&
            input.matches(selected, referenceFor(input.authority, preference)) === true,
        )
        .sort(
          (left, right) =>
            compareCanonical(left.key, right.key) || compareCanonical(left.path, right.path),
        );
      return [...(soft ? [soft] : []), ...optional];
    }),
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

type SelectedMaterializedPlanContext = Readonly<{
  plan: StorefrontTemplatePagePlan;
  overridePageType: WholeStorefrontPageBlueprintSelectionOverride["pageType"] | null;
  executionContext: "home" | "collection" | "search" | "product" | "static";
}>;

function selectedMaterializedPlanContexts(
  input: CompilePromptedStorefrontDesignIntentV2Input,
  candidate: Readonly<{ narrowing: BoundedStorefrontSynthesisSelectionNarrowing }>,
): readonly SelectedMaterializedPlanContext[] {
  const selectedContexts = [
    {
      profileId: candidate.narrowing.homepageProfileId,
      overridePageType: "home" as const,
      executionContext: "home" as const,
    },
    {
      profileId: candidate.narrowing.collectionProfileId,
      overridePageType: "collection" as const,
      executionContext: "collection" as const,
    },
    {
      profileId: candidate.narrowing.searchProfileId,
      overridePageType: null,
      executionContext: "search" as const,
    },
    {
      profileId: candidate.narrowing.pdpProfileId,
      overridePageType: "product" as const,
      executionContext: "product" as const,
    },
    ...selectedSiteMapPages(input, candidate)
      .filter(
        ({ familyId }) =>
          !["home", "collection", "search-results", "product-detail"].includes(familyId),
      )
      .map(({ profile }) => ({
        profileId: profile.id,
        overridePageType: null,
        executionContext: "static" as const,
      })),
  ];
  const uniqueContexts = new Map(
    selectedContexts.map((context) => [
      `${context.executionContext}:${context.profileId}`,
      context,
    ]),
  );
  return [...uniqueContexts.values()].map(({ profileId, overridePageType, executionContext }) => {
    const plan = registeredCommercialPlans().find(({ profile }) => profile?.id === profileId);
    if (!plan?.profile) {
      fail("stale-authority", `Selected PageBlueprint profile ${profileId} is unavailable.`);
    }
    return { plan, overridePageType, executionContext };
  });
}

function selectedProductCardAnatomyIds(
  input: CompilePromptedStorefrontDesignIntentV2Input,
  candidate: Readonly<{ narrowing: BoundedStorefrontSynthesisSelectionNarrowing }>,
): ReadonlySet<string> {
  return new Set(
    selectedMaterializedPlanContexts(input, candidate).flatMap(({ plan }) => {
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
  );
}

export function resolvePromptedStorefrontResponsiveVariantContexts(input: {
  compilerInput: CompilePromptedStorefrontDesignIntentV2Input;
  candidate: Readonly<{
    narrowing: BoundedStorefrontSynthesisSelectionNarrowing;
    homepageSlotIds: readonly string[];
  }>;
  slotOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[];
}) {
  const overrides = new Map(
    input.slotOverrides.flatMap(({ pageType, profileId, slotSelections }) =>
      slotSelections.map(
        (selection) => [`${pageType}:${profileId}:${selection.slotId}`, selection] as const,
      ),
    ),
  );
  const homepagePlan = getCommercialHomepageProfile(input.candidate.narrowing.homepageProfileId);
  if (!homepagePlan?.profile) fail("stale-authority", "The selected homepage is unavailable.");
  const includedHomepageSlotIds = new Set(input.candidate.homepageSlotIds);
  const contexts = [];
  for (const { plan, overridePageType, executionContext } of selectedMaterializedPlanContexts(
    input.compilerInput,
    input.candidate,
  )) {
    for (const slot of plan.slots) {
      if (overridePageType === "home" && !includedHomepageSlotIds.has(slot.id)) {
        continue;
      }
      const variantId =
        (overridePageType
          ? overrides.get(`${overridePageType}:${plan.profile!.id}:${slot.id}`)?.variant
          : undefined) ?? slot.defaultVariant;
      const component = veskifyComponentCapabilityManifest.getByComponentType(slot.sectionType);
      const anatomy = component?.commercialAnatomy;
      const variant = component?.variants.find(({ id }) => id === variantId);
      const anatomyVariant = anatomy?.variants.find(({ variantId: id }) => id === variantId);
      if (!component || !anatomy || !variant || !anatomyVariant) {
        fail(
          "stale-authority",
          `Responsive authority for ${slot.sectionType}/${variantId} is unavailable.`,
        );
      }
      const authorityIds = anatomyVariant.structure.responsiveTransformationIds.map(
        (transformationId) => {
          const transformation = anatomy.responsiveTransformations.find(
            ({ id }) => id === transformationId,
          );
          if (!transformation) {
            fail(
              "stale-authority",
              `Responsive transformation ${transformationId} is unavailable.`,
            );
          }
          return `responsive:${transformation.mode}`;
        },
      );
      contexts.push({
        executionContext,
        profileId: plan.profile!.id,
        slotId: slot.id,
        component: slot.sectionType,
        variant: variantId,
        authorityIds: stableUnique(authorityIds),
      });
    }
  }
  return contexts.sort((left, right) =>
    compareCanonical(
      `${left.executionContext}:${left.profileId}:${left.slotId}`,
      `${right.executionContext}:${right.profileId}:${right.slotId}`,
    ),
  );
}

export function resolvePromptedStorefrontExactResponsiveAuthorityIds(input: {
  compilerInput: CompilePromptedStorefrontDesignIntentV2Input;
  candidate: Readonly<{
    narrowing: BoundedStorefrontSynthesisSelectionNarrowing;
    homepageSlotIds: readonly string[];
  }>;
  slotOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[];
}): ReadonlySet<string> {
  const modes = new Set(
    resolvePromptedStorefrontResponsiveVariantContexts(input).flatMap(
      ({ authorityIds }) => authorityIds,
    ),
  );
  for (const anatomyId of selectedProductCardAnatomyIds(input.compilerInput, input.candidate)) {
    const anatomy = canonicalProductCardAuthority.anatomies.find(({ id }) => id === anatomyId);
    if (!anatomy) fail("stale-authority", `Product-card anatomy ${anatomyId} is unavailable.`);
    anatomy.responsiveTransformations.forEach(({ mode }) => modes.add(`responsive:${mode}`));
  }
  return modes;
}

function approvedAssetSelectionAuthorityId(selection: WholeStorefrontApprovedAssetRoleSelection) {
  return `approved-homepage-asset-${canonicalValueFingerprint({
    profileId: selection.profileId,
    slotId: selection.slotId,
    component: selection.component,
    assetSlotId: selection.assetSlotId,
    role: selection.role,
    assetId: selection.assetId,
    assetRevision: selection.assetRevision,
    materialFingerprint: selection.materialFingerprint,
  })}`;
}

function decodeExactApprovedAssetSelection(input: {
  reference: PromptedStorefrontCapabilityAuthorityReference;
  currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input;
  candidate: CandidateContext;
  slotOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[];
}): WholeStorefrontApprovedAssetRoleSelection | null {
  const { reference, currentRequestInput, candidate, slotOverrides } = input;
  if (
    reference.authorityKind !== "approved-assets" ||
    reference.dimension !== "homepage.asset-role" ||
    reference.availability !== "available"
  ) {
    return null;
  }
  const assetContext = currentRequestInput.approvedAssetContext;
  if (!assetContext || reference.authorityFingerprint !== assetContext.fingerprint) return null;
  const currentAssetContext = assetContext;
  const plan = getCommercialHomepageProfile(candidate.narrowing.homepageProfileId);
  if (!plan?.profile) return null;
  const includedHomepageSlotIds = new Set(candidate.homepageSlotIds);
  const overrides = new Map(
    slotOverrides.flatMap(({ profileId, slotSelections }) =>
      slotSelections.map((selection) => [`${profileId}:${selection.slotId}`, selection] as const),
    ),
  );
  const exact = plan.slots
    .filter(({ id }) => includedHomepageSlotIds.has(id))
    .flatMap((slot) => {
      const component = veskifyComponentCapabilityManifest.getByComponentType(slot.sectionType);
      const variantId =
        overrides.get(`${plan.profile!.id}:${slot.id}`)?.variant ?? slot.defaultVariant;
      const anatomyVariant = component?.commercialAnatomy?.variants.find(
        ({ variantId: id }) => id === variantId,
      );
      if (!component || !anatomyVariant) return [];
      const placedSlotIds = new Set(
        anatomyVariant.structure.assetPlacements.map(({ slotId }) => slotId),
      );
      return component.assetSlots
        .filter(({ id }) => placedSlotIds.has(id))
        .flatMap((assetSlot) =>
          assetSlot.acceptedRoles.flatMap((role) =>
            currentAssetContext.assets
              .filter((asset) => asset.role === role)
              .sort((left, right) => compareCanonical(left.assetId, right.assetId))
              .slice(0, 1)
              .map((asset) => {
                const selection: WholeStorefrontApprovedAssetRoleSelection = {
                  profileId: plan.profile!.id,
                  slotId: slot.id,
                  component: slot.sectionType,
                  assetSlotId: assetSlot.id,
                  role,
                  assetId: asset.assetId,
                  assetRevision: asset.revision,
                  materialFingerprint: asset.materialFingerprint,
                  authorityFingerprint: assetContext.fingerprint,
                };
                return { authorityId: approvedAssetSelectionAuthorityId(selection), selection };
              }),
          ),
        );
    })
    .find(({ authorityId }) => authorityId === reference.authorityId);
  return exact?.selection ?? null;
}

function resolveExactApprovedAssetSelections(input: {
  currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input;
  candidate: CandidateContext;
  slotOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[];
  authority: PromptedStorefrontCapabilityAuthority;
  preferences: readonly LocatedPreference[];
}): Readonly<{
  selections: readonly WholeStorefrontApprovedAssetRoleSelection[];
  selectedPreferencePaths: ReadonlySet<string>;
}> {
  const selectedPreferencePaths = new Set<string>();
  const selections: WholeStorefrontApprovedAssetRoleSelection[] = [];
  const relevant = input.preferences.filter(({ dimension }) => dimension === "homepage.asset-role");
  for (const group of groupPreferencesByResolutionBoundary(relevant, input.authority).values()) {
    const resolved = group
      .map((preference) => ({
        preference,
        reference: referenceFor(input.authority, preference),
      }))
      .map((row) => ({
        ...row,
        selection: decodeExactApprovedAssetSelection({
          reference: row.reference,
          currentRequestInput: input.currentRequestInput,
          candidate: input.candidate,
          slotOverrides: input.slotOverrides,
        }),
      }));
    const avoided = resolved.filter(({ preference }) => preference.semantics === "avoid");
    const positive = resolved.filter(({ preference }) => preference.semantics !== "avoid");
    const hard = positive.filter(({ preference }) => preference.semantics === "hard");
    if (hard.some(({ selection }) => !selection)) {
      fail("unsatisfied-hard-preference", "A required approved asset role is not executable.");
    }
    const hardAuthorityIds = new Set(
      hard.flatMap(({ selection }) =>
        selection ? [approvedAssetSelectionAuthorityId(selection)] : [],
      ),
    );
    if (hardAuthorityIds.size > 1) {
      fail(
        "contradictory-preferences",
        "One approved asset slot cannot require more than one exact asset-role authority.",
      );
    }
    const avoidedAuthorityIds = new Set(
      avoided.flatMap(({ selection }) =>
        selection ? [approvedAssetSelectionAuthorityId(selection)] : [],
      ),
    );
    const compatible = positive
      .flatMap((row) => {
        const selection = row.selection;
        if (!selection) return [];
        return avoidedAuthorityIds.has(approvedAssetSelectionAuthorityId(selection))
          ? []
          : [{ ...row, selection }];
      })
      .sort(
        (left, right) =>
          Number(right.preference.semantics === "hard") -
            Number(left.preference.semantics === "hard") ||
          (left.preference.rank ?? 32) - (right.preference.rank ?? 32) ||
          compareCanonical(left.preference.key, right.preference.key),
      );
    let selected:
      | Readonly<{
          preference: LocatedPreference | null;
          reference: PromptedStorefrontCapabilityAuthorityReference;
          selection: WholeStorefrontApprovedAssetRoleSelection;
        }>
      | undefined = compatible[0];
    if (!selected && hard.length > 0) {
      fail("contradictory-preferences", "Required and avoided asset authority conflicts.");
    }
    if (!selected && avoidedAuthorityIds.size > 0) {
      const boundary = materialBoundaryForReference(resolved[0].reference);
      selected = [...input.authority.referencesByPreferenceKey.values()]
        .filter(
          (reference) =>
            reference.dimension === "homepage.asset-role" &&
            reference.availability === "available" &&
            materialBoundaryForReference(reference) === boundary,
        )
        .sort((left, right) => compareCanonical(left.key, right.key))
        .flatMap((reference) => {
          const selection = decodeExactApprovedAssetSelection({
            reference,
            currentRequestInput: input.currentRequestInput,
            candidate: input.candidate,
            slotOverrides: input.slotOverrides,
          });
          return selection && !avoidedAuthorityIds.has(approvedAssetSelectionAuthorityId(selection))
            ? [{ preference: null, reference, selection }]
            : [];
        })[0];
      if (!selected) {
        fail(
          "no-compatible-selection",
          "An avoided homepage asset has no compatible approved alternative for its exact slot.",
        );
      }
    }
    if (!selected) continue;
    selections.push(selected.selection);
    if (selected.preference) selectedPreferencePaths.add(selected.preference.path);
  }
  return {
    selections: wholeStorefrontApprovedAssetRoleSelectionsSchema.parse(selections),
    selectedPreferencePaths,
  };
}

export function resolvePromptedStorefrontExactSlotOverrides(
  input: Readonly<{
    selectionNarrowing: BoundedStorefrontSynthesisSelectionNarrowing;
    componentDefinitions: Readonly<
      CompilePromptedStorefrontDesignIntentV2Input["compatibilityInput"]["planningInput"]["componentDefinitions"]
    >;
    authority: Pick<PromptedStorefrontCapabilityAuthority, "referencesByPreferenceKey">;
    preferences: readonly LocatedPreference[];
    includedHomepageSlotIds?: readonly string[];
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
  const searchPlan = getCommercialCollectionSearchProfile(input.selectionNarrowing.searchProfileId);
  if (!searchPlan?.profile) {
    fail("stale-authority", "The selected search PageBlueprint profile is unavailable.");
  }
  const targetPlans = [
    ...plans.map((plan) => ({
      plan,
      targetPageType: pageType(plan),
      overridePageType: pageType(plan),
    })),
    {
      plan: searchPlan,
      targetPageType: "search" as const,
      overridePageType: null,
    },
  ];
  const includedHomepageSlotIds = input.includedHomepageSlotIds
    ? new Set(input.includedHomepageSlotIds)
    : null;
  const targets = targetPlans.flatMap(({ plan, targetPageType, overridePageType }) =>
    plan.slots
      .filter(
        (slot) =>
          plan.pageType !== "home" ||
          includedHomepageSlotIds === null ||
          includedHomepageSlotIds.has(slot.id),
      )
      .map((slot) => {
        const selection = plan.profile!.componentSelections.find(
          ({ slotId }) => slotId === slot.id,
        );
        if (!selection) fail("stale-authority", `Slot ${slot.id} has no component selection.`);
        const definition = manifest.find(({ componentType }) => componentType === slot.sectionType);
        if (!definition) fail("stale-authority", `Component ${slot.sectionType} is unavailable.`);
        return {
          key: `${targetPageType}:${plan.profile!.id}:${slot.id}`,
          pageType: targetPageType,
          overridePageType,
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
    const target = requireUnambiguousTarget(preference, matchingTargets);
    if (target?.overridePageType === null) {
      if (
        preference.semantics === "avoid" &&
        target.slot.defaultVariant === variantAuthority.variant
      ) {
        fail(
          "no-compatible-selection",
          `The exact search PageBlueprint uses avoided variant ${variantAuthority.variant}.`,
        );
      }
      if (preference.semantics === "hard") {
        fail(
          "unsatisfied-hard-preference",
          `Hard preference ${preference.key} targets search presentation without a canonical exact override path.`,
        );
      }
      continue;
    }
    if (preference.semantics === "avoid") {
      if (target) {
        const values = avoidedVariants.get(target.key) ?? new Set<string>();
        values.add(variantAuthority.variant);
        avoidedVariants.set(target.key, values);
      }
      continue;
    }
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
    const target = requireUnambiguousTarget(preference, matchingTargets);
    if (target?.overridePageType === null) {
      const currentValue =
        target.plan.profile!.parameterDefaults[parameterAuthority.parameter.id] ??
        parameterAuthority.parameter.defaultValue;
      if (
        preference.semantics === "avoid" &&
        canonicalValueString(currentValue) === canonicalValueString(preference.value)
      ) {
        fail(
          "no-compatible-selection",
          `The exact search PageBlueprint uses an avoided ${parameterAuthority.parameter.id} value.`,
        );
      }
      if (preference.semantics === "hard") {
        fail(
          "unsatisfied-hard-preference",
          `Hard preference ${preference.key} targets search presentation without a canonical exact override path.`,
        );
      }
      continue;
    }
    if (preference.semantics === "avoid") {
      if (target) {
        const key = `${target.key}:${parameterAuthority.parameter.id}`;
        const values = avoidedParameterValues.get(key) ?? new Map<string, string | number>();
        values.set(canonicalValueString(preference.value), preference.value);
        avoidedParameterValues.set(key, values);
        parameterMetadata.set(key, { target, parameter: parameterAuthority.parameter });
        parameterReferences.set(key, reference);
      }
      continue;
    }
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
        .filter(
          (target) =>
            target.overridePageType === pageType(plan) &&
            target.plan.profile!.id === plan.profile!.id,
        )
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
  approvedAssetRoleSelections: readonly WholeStorefrontApprovedAssetRoleSelection[],
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
  const selectedSlotRows = selectedMaterializedPlanContexts(input, candidate).flatMap(
    ({ plan, overridePageType }) =>
      plan.slots
        .filter(({ id }) => overridePageType !== "home" || candidate.homepageSlotIds.includes(id))
        .map((slot) => {
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
  const homepageSectionCount = candidate.homepageSlotIds.length;
  const siteMapAuthority = selectedSiteMapAuthorityIds(input, candidate);
  const omittedEvidenceFamilies = omittedEvidenceFamilyIds(input);
  const componentIdentities = new Set(selectedSlotRows.map(({ component }) => component));
  const responsiveIdentities = resolvePromptedStorefrontExactResponsiveAuthorityIds({
    compilerInput: input,
    candidate,
    slotOverrides,
  });
  const approvedAssetIdentities = new Set(
    approvedAssetRoleSelections.map(approvedAssetSelectionAuthorityId),
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
    if (reference.availability !== "available") continue;
    if (preference.semantics === "avoid") {
      if (
        reference.authorityKind === "component-manifest" &&
        reference.authorityId.startsWith("responsive:") &&
        responsiveIdentities.has(reference.authorityId)
      ) {
        fail(
          "no-compatible-selection",
          `The exact selected component variant uses avoided responsive authority ${reference.authorityId}.`,
        );
      }
      continue;
    }
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
          siteMapAuthority,
          omittedEvidenceFamilies,
          homepageSectionCount,
          responsiveIdentities,
          approvedAssetIdentities,
        );
    const matchesCandidate =
      candidateMatch === true ||
      (profileIds.has(profileId ?? "") &&
        !preference.path.startsWith("productDetail.productTypeIntentions[") &&
        (preference.dimension === "homepage.section-count"
          ? homepageSectionCount !== undefined &&
            preference.value === homepageSectionCount &&
            (preference.minimum ?? homepageSectionCount) <= homepageSectionCount &&
            homepageSectionCount <= (preference.maximum ?? homepageSectionCount)
          : !["homepage.meaningful-variant", "component.meaningful-variant"].includes(
              preference.dimension,
            ))) ||
      (siteMapAuthority.has(reference.authorityId) &&
        (preference.dimension === "content-support.profile" ||
          preference.dimension === "content-support.narrative-purpose" ||
          preference.dimension === "utility.profile")) ||
      (reference.authorityKind === "approved-evidence" &&
        preference.dimension === "content-support.omission" &&
        omittedEvidenceFamilies.has(reference.authorityId)) ||
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
        }));
    if (matchesCandidate) compatibleByPath.set(preference.path, reference);
  }
  const selected = new Map<string, PromptedStorefrontCapabilityAuthorityReference>();
  for (const group of groupPreferencesByResolutionBoundary(preferences, authority).values()) {
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
  missingEvidenceAuthorityIds: ReadonlySet<string>,
): PromptedStorefrontResolutionDiagnostic[] {
  return preferences.map((preference) => {
    const requested = referenceFor(authority, preference);
    const accepted = selectedByPath.has(preference.path);
    const missingCurrentEvidence =
      requested.authorityKind === "page-blueprint" &&
      ["content-support.profile", "content-support.narrative-purpose"].includes(
        requested.dimension,
      ) &&
      missingEvidenceAuthorityIds.has(requested.authorityId);
    if (preference.semantics === "hard" && !accepted) {
      fail("unsatisfied-hard-preference", `Hard preference ${preference.key} was not selected.`);
    }
    const selectedAlternative = [...selectedByPath.entries()]
      .filter(
        ([path, reference]) =>
          preferenceResolutionBoundary(
            preferences.find((entry) => entry.path === path)!,
            reference,
          ) === preferenceResolutionBoundary(preference, requested),
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
        : missingCurrentEvidence
          ? "missing-approved-evidence"
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
  const preferences = [
    ...collectPreferences(intent),
    ...diversityAvoidancePreferences(current.request, current.capabilityAuthority),
  ].sort((left, right) => compareCanonical(left.path, right.path));
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
    includedHomepageSlotIds: candidate.homepageSlotIds,
  });
  const slotOverrides = slotOverrideResolution.slotOverrides;
  const approvedAssetResolution = resolveExactApprovedAssetSelections({
    currentRequestInput: input.currentRequestInput,
    candidate,
    slotOverrides,
    authority: current.capabilityAuthority,
    preferences,
  });
  const selectedByPath = selectedReferenceKeys(
    input,
    candidate,
    dynamic,
    slotOverrides,
    approvedAssetResolution.selections,
    current.capabilityAuthority,
    preferences,
    new Set([
      ...dynamicResolution.selectedPreferencePaths.keys(),
      ...slotOverrideResolution.selectedPreferencePaths,
      ...approvedAssetResolution.selectedPreferencePaths,
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
    plan.slots
      .filter(({ id }) => plan.pageType !== "home" || candidate.homepageSlotIds.includes(id))
      .map((slot) => {
        const override = overridesByProfileAndSlot.get(`${plan.profile!.id}:${slot.id}`);
        const definition = veskifyComponentCapabilityManifest.getByComponentType(slot.sectionType);
        if (!definition) {
          fail("stale-authority", `Component ${slot.sectionType} is no longer registered.`);
        }
        return {
          plan,
          slot,
          definition,
          variant: override?.variant ?? slot.defaultVariant,
          boundedParameters: override?.boundedParameters ?? {},
        };
      }),
  );
  const selectedComponentAuthorityIds = new Set(
    selectedSlots.flatMap(({ slot, variant, boundedParameters }) => [
      slot.sectionType,
      `${slot.sectionType}:${variant}`,
      ...Object.keys(boundedParameters).map((parameter) => `${slot.sectionType}:${parameter}`),
    ]),
  );
  const selectedResponsiveAuthorityIds = resolvePromptedStorefrontExactResponsiveAuthorityIds({
    compilerInput: input,
    candidate,
    slotOverrides,
  });
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
  const selectedSiteMapPagesForDefaults = selectedSiteMapPages(input, candidate);
  const siteMapAuthorityIds = selectedSiteMapAuthorityIds(input, candidate);
  const omittedEvidenceFamilies = omittedEvidenceFamilyIds(input);
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
  const materiallySuppliedBoundaries = new Set(
    preferences.map((preference) =>
      materialBoundaryForReference(referenceFor(current.capabilityAuthority, preference)),
    ),
  );
  const exactBoundedParameterDefaults = selectedSlots
    .flatMap(({ plan, slot, definition, variant, boundedParameters }) =>
      definition.boundedParameters.flatMap((parameter) => {
        const reference = [...current.capabilityAuthority.referencesByPreferenceKey.values()]
          .filter(
            (candidateReference) =>
              candidateReference.dimension === "component.bounded-parameter" &&
              candidateReference.authorityKind === "component-manifest" &&
              candidateReference.authorityId === `${slot.sectionType}:${parameter.id}` &&
              candidateReference.availability === "available",
          )
          .sort((left, right) => compareCanonical(left.key, right.key))[0];
        if (
          !reference ||
          Object.hasOwn(boundedParameters, parameter.id) ||
          materiallySuppliedBoundaries.has(materialBoundaryForReference(reference)) ||
          !parameter.compatiblePageTypes.includes(plan.pageType) ||
          (parameter.compatibleVariants.length > 0 &&
            !parameter.compatibleVariants.includes(variant))
        ) {
          return [];
        }
        const value = plan.profile!.parameterDefaults[parameter.id] ?? parameter.defaultValue;
        return [
          {
            preferencePath: `defaults.component.bounded-parameter.${plan.pageType}.${plan.profile!.id}.${slot.id}.${parameter.id}`,
            preferenceKey: reference.key,
            semantics: "optional" as const,
            requestedRank: null,
            requestedValue: value,
            outcome: "defaulted" as const,
            selectedAuthority: reference,
            reasonCode: "registered-safe-default" as const,
            authorityFingerprint: reference.authorityFingerprint,
          },
        ];
      }),
    )
    .sort((left, right) => compareCanonical(left.preferencePath, right.preferencePath));
  const defaultReferences = [...current.capabilityAuthority.referencesByPreferenceKey.values()]
    .filter((reference) => {
      if (
        reference.availability !== "available" ||
        reference.dimension === "component.bounded-parameter" ||
        materiallySuppliedBoundaries.has(materialBoundaryForReference(reference)) ||
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
      if (reference.authorityKind === "approved-evidence") {
        return (
          reference.dimension === "content-support.omission" &&
          omittedEvidenceFamilies.has(reference.authorityId)
        );
      }
      return (
        reference.authorityKind === "product-card" &&
        selectedProductCardIds.has(reference.authorityId)
      );
    })
    .sort((left, right) => compareCanonical(left.key, right.key));
  const baseDiagnostics = diagnosticsFor(
    preferences,
    current.capabilityAuthority,
    selectedByPath,
    missingEvidenceSiteMapAuthority(input),
  );
  const diagnostics = [
    ...baseDiagnostics,
    ...exactBoundedParameterDefaults,
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
  const homepageRoleSequence = [...candidate.homepageRoleSequence];
  const selectedSiteMapPagesForOutput = selectedSiteMapPagesForDefaults;
  const contentSupportProfileIds = new Set(
    listCommercialContentSupportProfiles().flatMap(({ profile }) => (profile ? [profile.id] : [])),
  );
  const utilityProfileIds = new Set(
    listCommercialUtilityProfiles().flatMap(({ profile }) => (profile ? [profile.id] : [])),
  );
  const staticContentSupportSelections = stableUnique(
    selectedSiteMapPagesForOutput
      .filter(({ profile }) => contentSupportProfileIds.has(profile.id))
      .map(({ profile }) => `${profile.id}@${profile.version}`),
  );
  const utilityPresentationSelections = stableUnique(
    selectedSiteMapPagesForOutput
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
  const structuralFingerprint = promptedCandidateStructuralFingerprint({
    compilerInput: input,
    candidate,
    slotOverrides,
    dynamicCommerceSelection: dynamic,
  });
  const priorStructuralFingerprints = new Set([
    ...current.request.priorDiversityEvidence.recentAcceptedStructuralFingerprints,
    ...current.request.priorDiversityEvidence.recentRejectedStructuralFingerprints,
  ]);
  if (priorStructuralFingerprints.has(structuralFingerprint)) {
    fail(
      "no-compatible-selection",
      "The exact compiled storefront duplicates a recently accepted or rejected structure.",
    );
  }
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
    exactSelection: exactSynthesisSelection(candidate.narrowing),
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
    approvedAssetRoleSelections: [...approvedAssetResolution.selections],
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
        .filter(
          ({ outcome, reasonCode, selectedAuthority }) =>
            outcome === "omitted" &&
            (reasonCode === "missing-approved-evidence" ||
              reasonCode === "missing-approved-asset" ||
              selectedAuthority?.authorityKind === "approved-evidence" ||
              selectedAuthority?.authorityKind === "approved-assets"),
        )
        .map(({ preferenceKey }) => preferenceKey),
    ),
    diagnostics,
    exactAuthorityFingerprints: authorityFingerprints,
    structuralFingerprint,
    dynamicRoutePresentationFingerprint: `compiled-prompted-dynamic-${canonicalValueFingerprint(
      dynamic,
    )}`,
  };
  return compiledPromptedStorefrontDesignDecisionV2Schema.parse({
    ...material,
    compiledDecisionFingerprint: compiledPromptedStorefrontDesignDecisionFingerprint(material),
  });
}
