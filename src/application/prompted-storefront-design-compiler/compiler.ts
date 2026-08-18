import {
  type CompatibleCoordinatedDirectionNarrowingInput,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "@/application/bounded-storefront-synthesis";
import {
  createPromptedStorefrontDesignRequestV2,
  type CreatePromptedStorefrontDesignRequestV2Input,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCapabilityAuthorityReference,
  type PromptedStorefrontCapabilityDimension,
  type PromptedStorefrontDesignRequestV2,
  type PromptedStorefrontPreferenceSemantics,
} from "@/application/prompted-storefront-design-intent";
import { createDynamicCommerceProductMatchContext } from "@/application/dynamic-commerce-routes";
import {
  approvedAssetPlacementPurposeForTarget,
  resolveApprovedAssetPlacement,
} from "@/application/ai-storefront-generation";
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
import { homepageCommerceBridgeComponentNames } from "@/components/registry/homepage-commerce-bridge";
import { resolveBrandSystemDesignDna, type DesignDna } from "@/domain/design-system";
import { canonicalProductTypePresentationId } from "@/domain/product-card";
import {
  canonicalValueString,
  isDynamicCommerceArchetypeCompatibleWithSharedFrame,
  type DynamicCommerceProductDetailArchetype,
} from "@/domain/storefront";
import { PromptedStorefrontDesignCompilerError } from "./contract";

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

export type PromptedStorefrontCompilerAuthorityInput = Readonly<{
  originalRequest: PromptedStorefrontDesignRequestV2;
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

/**
 * The prompted request and bounded-synthesis input duplicate a small set of canonical authority.
 * Bind those values at the public compiler boundary so direct compiler/executor callers cannot
 * validate an intent against one project and materialize it from another.
 */
export function assertPromptedStorefrontPlanningAuthorityBound(
  input: Pick<
    PromptedStorefrontCompilerAuthorityInput,
    "currentRequestInput" | "compatibilityInput"
  >,
): void {
  const request = input.currentRequestInput;
  const planning = input.compatibilityInput.planningInput;
  const duplicatedAuthority = [
    [
      "project",
      {
        id: request.project.id,
        revision: request.project.revision,
        enabledLocales: request.project.enabledLocales,
      },
      planning.project,
    ],
    ["draft", request.draft, planning.draft],
    ["catalogue", request.catalogue, planning.catalogue],
    ["approved brief", request.approvedBrief, planning.brief],
    ["approved asset context", request.approvedAssetContext ?? null, planning.approvedAssetContext],
  ] as const;
  const mismatch = duplicatedAuthority.find(
    ([, requestValue, planningValue]) =>
      canonicalValueString(requestValue) !== canonicalValueString(planningValue),
  );
  if (mismatch) {
    fail(
      "stale-authority",
      `Prompted request and materialization ${mismatch[0]} authority do not match exactly.`,
    );
  }
}

function compareCanonical(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
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

function resolveExactHomepageExecution(
  input: PromptedStorefrontCompilerAuthorityInput,
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

function isPresentationOnlySearchRelationshipPreference(
  preference: LocatedPreference,
  reference: PromptedStorefrontCapabilityAuthorityReference,
): boolean {
  return (
    reference.dimension === "collection-search.search-relationship" &&
    reference.authorityKind === "dynamic-commerce" &&
    reference.availability === "available"
  );
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

export function resolvePromptedStorefrontExactProfileReference(
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
    PromptedStorefrontCompilerAuthorityInput["currentRequestInput"]["draft"]["dynamicCommercePresentation"]
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
  input: PromptedStorefrontCompilerAuthorityInput,
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
          entry.profile.profileId === profileId &&
          entry.supportedContexts.includes(context) &&
          isDynamicCommerceArchetypeCompatibleWithSharedFrame(
            entry,
            candidate.narrowing.sharedFrameProfileId,
          ),
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
          : preferences.filter((preference) =>
              isPresentationOnlySearchRelationshipPreference(
                preference,
                referenceFor(authority, preference),
              ),
            ),
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
      (archetype) =>
        archetype.id !== current.fallbacks.productDetailArchetypeId &&
        isDynamicCommerceArchetypeCompatibleWithSharedFrame(
          archetype,
          candidate.narrowing.sharedFrameProfileId,
        ),
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
            (archetype) =>
              archetype.id === current.fallbacks.productDetailArchetypeId &&
              isDynamicCommerceArchetypeCompatibleWithSharedFrame(
                archetype,
                candidate.narrowing.sharedFrameProfileId,
              ),
          )
        : allPreferredCandidatesAreAvoided
          ? nonFallbackArchetypes
          : preferredCandidates,
      defaultId:
        current.productDetailArchetypes.find(
          (archetype) =>
            archetype.profile.profileId === fallbackProfileId &&
            isDynamicCommerceArchetypeCompatibleWithSharedFrame(
              archetype,
              candidate.narrowing.sharedFrameProfileId,
            ) &&
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
  if (
    !isDynamicCommerceArchetypeCompatibleWithSharedFrame(
      fallback,
      candidate.narrowing.sharedFrameProfileId,
    )
  ) {
    fail(
      "no-compatible-selection",
      "The generic PDP fallback is incompatible with the selected shared frame.",
    );
  }
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
      // Resolve each known product type through the exact role archetypes already selected above.
      // This preserves any frame-compatible substitution (for example, configurable intent using
      // the high-consideration archetype inside an editorial frame) instead of falling back to a
      // stale previous product-type mapping.
      const selectedArchetype =
        characteristics.highConsiderationPresentationCount > 0 ||
        characteristics.optionGroupCountRange.maximum >= 3
          ? high
          : characteristics.configurableProductCount > 0
            ? configurable
            : characteristics.mediaDepthRange.maximum >= 2
              ? gallery
              : standard;
      return { productTypeId: mapping.productTypeId, archetypeId: selectedArchetype.id };
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

/**
 * Semantic intent deliberately does not expose registered asset IDs. Resolve
 * the exact current approved placement authority here, after the homepage
 * profile and variants are fixed, so the compiled decision records every
 * renderer-visible asset choice instead of letting materialization fall back
 * to whichever approved asset happens to appear first.
 */
function resolveSemanticApprovedAssetSelections(input: {
  currentRequestInput: CreatePromptedStorefrontDesignRequestV2Input;
  candidate: CandidateContext;
  slotOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[];
  authority: PromptedStorefrontCapabilityAuthority;
  componentDefinitions: PromptedStorefrontCompilerAuthorityInput["compatibilityInput"]["planningInput"]["componentDefinitions"];
}): readonly WholeStorefrontApprovedAssetRoleSelection[] {
  const assetContext = input.currentRequestInput.approvedAssetContext;
  if (!assetContext) return [];
  const hasCurrentApprovedAssetAuthority = [
    ...input.authority.referencesByPreferenceKey.values(),
  ].some(
    (reference) =>
      reference.authorityKind === "approved-assets" &&
      reference.authorityFingerprint === assetContext.fingerprint,
  );
  if (!hasCurrentApprovedAssetAuthority) return [];
  const plan = getCommercialHomepageProfile(input.candidate.narrowing.homepageProfileId);
  if (!plan?.profile) return [];
  const includedHomepageSlotIds = new Set(input.candidate.homepageSlotIds);
  const overrides = new Map(
    input.slotOverrides.flatMap(({ profileId, slotSelections }) =>
      slotSelections.map((selection) => [`${profileId}:${selection.slotId}`, selection] as const),
    ),
  );
  const reuseLedger = new Map<string, number>();
  const currentSections = [
    ...input.currentRequestInput.draft.pages.flatMap((page) =>
      page.type === "home"
        ? page.sections.filter(
            ({ component }) =>
              !homepageCommerceBridgeComponentNames.some(
                (managedComponent) => managedComponent === component,
              ),
          )
        : page.sections,
    ),
    ...(input.currentRequestInput.draft.sharedFrame
      ? [
          input.currentRequestInput.draft.sharedFrame.footer,
          ...(input.currentRequestInput.draft.sharedFrame.announcement
            ? [input.currentRequestInput.draft.sharedFrame.announcement]
            : []),
        ]
      : []),
  ];
  currentSections.forEach((section) => {
    (section.approvedAssetPlacements ?? []).forEach(({ assetId }) => {
      reuseLedger.set(assetId, (reuseLedger.get(assetId) ?? 0) + 1);
    });
  });
  const targets: Array<{
    profileId: string;
    slotId: string;
    component: string;
    assetSlot: PromptedStorefrontCompilerAuthorityInput["compatibilityInput"]["planningInput"]["componentDefinitions"][number]["assetSlots"][number];
    placementContext: "page" | "sharedFrame";
  }> = plan.slots
    .filter(({ id }) => includedHomepageSlotIds.has(id))
    .flatMap((slot) => {
      if (slot.sectionType === "homepageCollectionNavigation") return [];
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
        .map((assetSlot) => ({
          profileId: plan.profile!.id,
          slotId: slot.id,
          component: slot.sectionType,
          assetSlot,
          placementContext: "page" as const,
        }));
    });
  const header = input.componentDefinitions.find(({ type }) => type === "header");
  const brandLogo = header?.assetSlots.find(({ id }) => id === "brandLogo");
  if (brandLogo) {
    targets.unshift({
      profileId: `shared-frame:${input.candidate.narrowing.sharedFrameProfileId}`,
      slotId: "header",
      component: "header",
      assetSlot: brandLogo,
      placementContext: "sharedFrame" as const,
    });
  }
  const selections = targets.flatMap((target) => {
    const purpose = approvedAssetPlacementPurposeForTarget({
      component: target.component,
      assetSlotId: target.assetSlot.id,
    });
    const resolved = resolveApprovedAssetPlacement({
      assets: assetContext.assets,
      request: {
        purpose,
        acceptedRoles: target.assetSlot.acceptedRoles.filter(
          (role) => role !== "productMainImage" && role !== "productAlternativeImage",
        ),
      },
      reuseLedger,
    });
    if (!resolved) return [];
    return [
      {
        profileId: target.profileId,
        slotId: target.slotId,
        component: target.component,
        assetSlotId: target.assetSlot.id,
        role: resolved.asset.role,
        assetId: resolved.asset.assetId,
        assetRevision: resolved.asset.revision,
        materialFingerprint: resolved.asset.materialFingerprint,
        authorityFingerprint: assetContext.fingerprint,
        placementContext: target.placementContext,
        placementPurpose: purpose,
        reusePolicy: resolved.reusePolicy,
        affinity: resolved.affinity,
        ...(resolved.responsivePair
          ? { responsiveSourceAssetIds: [resolved.responsivePair.assetId] }
          : {}),
      } satisfies WholeStorefrontApprovedAssetRoleSelection,
    ];
  });
  return wholeStorefrontApprovedAssetRoleSelectionsSchema.parse(
    selections.sort(
      (left, right) =>
        left.profileId.localeCompare(right.profileId) ||
        left.slotId.localeCompare(right.slotId) ||
        left.component.localeCompare(right.component) ||
        left.assetSlotId.localeCompare(right.assetSlotId),
    ),
  );
}

export function resolvePromptedStorefrontExactSlotOverrides(
  input: Readonly<{
    selectionNarrowing: BoundedStorefrontSynthesisSelectionNarrowing;
    componentDefinitions: Readonly<
      PromptedStorefrontCompilerAuthorityInput["compatibilityInput"]["planningInput"]["componentDefinitions"]
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

/** Resolves registered execution metadata for one semantic selection without materialization. */
export function resolvePromptedStorefrontSemanticExecutionAuthority(input: {
  compilerInput: PromptedStorefrontCompilerAuthorityInput;
  selection: BoundedStorefrontSynthesisSelectionNarrowing;
  currentExactAuthority?: ReturnType<typeof createPromptedStorefrontDesignRequestV2>;
}): Readonly<{
  designDna: DesignDna;
  homepageRoleSequence: readonly string[];
  dynamicCommerceSelection: ReturnType<typeof buildDynamicSelection>["selection"];
  pageBlueprintSelectionOverrides: readonly WholeStorefrontPageBlueprintSelectionOverride[];
  approvedAssetRoleSelections: readonly WholeStorefrontApprovedAssetRoleSelection[];
}> {
  const current =
    input.currentExactAuthority ??
    createPromptedStorefrontDesignRequestV2(input.compilerInput.currentRequestInput);
  const homepage = resolveExactHomepageExecution(input.compilerInput, input.selection);
  if (!homepage)
    fail("no-compatible-selection", "The semantic selection has no executable homepage.");
  const brandSystem = registeredBrandSystemForDirection(
    input.compilerInput.currentRequestInput.draft.brandSystem,
    input.compilerInput.compatibilityInput.planningInput.recipeContext.designSystem,
    input.selection.directionId,
    {
      spacingDensity: input.selection.designSystemSpacingDensity,
      surfaceDepth: input.selection.designSystemSurfaceDepth,
    },
  );
  const candidate: CandidateContext = {
    narrowing: input.selection,
    designDna: resolveBrandSystemDesignDna(brandSystem),
    homepageSlotIds: homepage.slotIds,
    homepageRoleSequence: homepage.roleSequence,
  };
  const dynamicCommerceSelection = buildDynamicSelection(
    input.compilerInput,
    candidate,
    current.capabilityAuthority,
    [],
  ).selection;
  const pageBlueprintSelectionOverrides = resolvePromptedStorefrontExactSlotOverrides({
    selectionNarrowing: input.selection,
    componentDefinitions: input.compilerInput.compatibilityInput.planningInput.componentDefinitions,
    authority: current.capabilityAuthority,
    preferences: [],
    includedHomepageSlotIds: homepage.slotIds,
  }).slotOverrides;
  const approvedAssetRoleSelections = resolveSemanticApprovedAssetSelections({
    currentRequestInput: input.compilerInput.currentRequestInput,
    candidate,
    slotOverrides: pageBlueprintSelectionOverrides,
    authority: current.capabilityAuthority,
    componentDefinitions: input.compilerInput.compatibilityInput.planningInput.componentDefinitions,
  });
  return Object.freeze({
    designDna: candidate.designDna,
    homepageRoleSequence: Object.freeze([...candidate.homepageRoleSequence]),
    dynamicCommerceSelection: structuredClone(dynamicCommerceSelection),
    pageBlueprintSelectionOverrides: structuredClone(pageBlueprintSelectionOverrides),
    approvedAssetRoleSelections: structuredClone(approvedAssetRoleSelections),
  });
}
