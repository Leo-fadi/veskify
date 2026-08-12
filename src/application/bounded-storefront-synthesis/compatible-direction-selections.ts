import {
  getCommercialCollectionSearchProfile,
  getCommercialHomepageProfile,
  getCommercialPdpProfile,
  getExecutablePageBlueprintProfile,
  resolveCommercialHomepageEvidenceAvailability,
  resolveCommercialHomepageProfileSlots,
} from "@/application/storefront-templates";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  boundedStorefrontSynthesisExactSelectionSchema,
  boundedStorefrontSynthesisSelectionNarrowingSchema,
  type BoundedStorefrontSynthesisExactSelection,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "./contract";
import type {
  CoordinatedStorefrontDirectionId,
  CoordinatedStorefrontDirectionPackage,
} from "./direction-contract";
import {
  listCoordinatedStorefrontDirections,
  validateDirectionSelectionNarrowing,
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

export type CompatibleCoordinatedDirectionCandidateEnumerationOptions = Readonly<{
  maximumCandidateEvaluations?: number;
}>;

export const MAX_COMPATIBLE_COORDINATED_DIRECTION_CANDIDATES = 8_192 as const;

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

function candidateEnumerationCardinality(direction: CoordinatedStorefrontDirectionPackage): bigint {
  const constraints = direction.constraints;
  return [
    constraints.designSystemDirectionIds.length,
    constraints.designSystemSpacingDensities.length,
    constraints.designSystemSurfaceDepths.length,
    constraints.sharedFrameProfileIds.length,
    constraints.homepageProfileIds.length,
    constraints.collectionProfileIds.length,
    constraints.searchProfileIds.length,
    constraints.pdpProfileIds.length,
    constraints.optionalPageFamilyCompositions.length,
  ].reduce((cardinality, dimension) => cardinality * BigInt(dimension), 1n);
}

function assertCandidateEnumerationBudget(
  directions: readonly CoordinatedStorefrontDirectionPackage[],
  requestedMaximumCandidateEvaluations: number | undefined,
): void {
  const maximumCandidateEvaluations =
    requestedMaximumCandidateEvaluations ?? MAX_COMPATIBLE_COORDINATED_DIRECTION_CANDIDATES;
  if (!Number.isSafeInteger(maximumCandidateEvaluations) || maximumCandidateEvaluations < 1) {
    throw new TypeError(
      "The coordinated-direction candidate budget must be a positive safe integer.",
    );
  }
  const requiredCandidateEvaluations = directions.reduce(
    (total, direction) => total + candidateEnumerationCardinality(direction),
    0n,
  );
  if (requiredCandidateEvaluations > BigInt(maximumCandidateEvaluations)) {
    throw new CompatibleCoordinatedDirectionCandidateBudgetError(
      requiredCandidateEvaluations,
      maximumCandidateEvaluations,
    );
  }
}

function product<T>(values: readonly (readonly T[])[]): T[][] {
  return values.reduce<T[][]>(
    (combinations, dimension) =>
      combinations.flatMap((combination) => dimension.map((value) => [...combination, value])),
    [[]],
  );
}

function candidateMaterial(
  direction: CoordinatedStorefrontDirectionPackage,
): CompatibleCoordinatedDirectionCandidateMaterial[] {
  const c = direction.constraints;
  const pick = <T>(values: readonly T[], label: string, material: unknown): T => {
    const fingerprint = canonicalValueFingerprint({ label, material });
    const digest = fingerprint.split("_").at(-1)!;
    return values[Number.parseInt(digest.slice(0, 8), 16) % values.length];
  };
  return product<string>([
    c.designSystemDirectionIds,
    c.designSystemSpacingDensities,
    c.designSystemSurfaceDepths,
    c.sharedFrameProfileIds,
    c.homepageProfileIds,
    c.collectionProfileIds,
    c.searchProfileIds,
    c.pdpProfileIds,
  ]).flatMap(
    ([
      directionId,
      designSystemSpacingDensity,
      designSystemSurfaceDepth,
      sharedFrameProfileId,
      homepageProfileId,
      collectionProfileId,
      searchProfileId,
      pdpProfileId,
    ]) => {
      const architecture = {
        directionId,
        designSystemSpacingDensity,
        designSystemSurfaceDepth,
        sharedFrameProfileId,
        homepageProfileId,
        collectionProfileId,
        searchProfileId,
        pdpProfileId,
      };
      return c.optionalPageFamilyCompositions.map(
        (includedOptionalPageFamilyIds) =>
          ({
            ...architecture,
            includedOptionalPageFamilyIds: [...includedOptionalPageFamilyIds],
            narrativePosture: pick(c.narrativePostures, "narrative", {
              ...architecture,
              includedOptionalPageFamilyIds,
            }),
            merchandisingPosture: pick(c.merchandisingPostures, "merchandising", architecture),
            informationDensityPosture: pick(c.informationDensityPostures, "density", architecture),
            artDirectionPosture: pick(c.artDirectionPostures, "art", architecture),
            responsiveMode: pick(c.responsiveModes, "responsive", architecture),
          }) as CompatibleCoordinatedDirectionCandidateMaterial,
      );
    },
  );
}

export function coordinatedDirectionNarrowingForCandidate(
  direction: CoordinatedStorefrontDirectionPackage,
  candidate: CompatibleCoordinatedDirectionCandidateMaterial,
): BoundedStorefrontSynthesisSelectionNarrowing {
  const selectionId = `direction-selection-${canonicalValueFingerprint(candidate)}`;
  return boundedStorefrontSynthesisSelectionNarrowingSchema.parse({
    authorityId: `coordinated-direction:${direction.id}`,
    authorityVersion: direction.version,
    authorityFingerprint: direction.authorityFingerprint,
    selectionId,
    ...candidate,
  });
}

function candidateHasSupportedAssetPosture(
  candidate: CompatibleCoordinatedDirectionCandidateMaterial,
  input: BoundedStorefrontSynthesisInput,
): boolean {
  const availableRoles = new Set(
    input.planningInput.approvedAssetContext?.assets.map(({ role }) => role) ?? [],
  );
  const includedOptional = new Set(candidate.includedOptionalPageFamilyIds);
  const homepage = getCommercialHomepageProfile(candidate.homepageProfileId);
  if (!homepage) return false;
  try {
    const homepageEvidence = resolveCommercialHomepageEvidenceAvailability({
      canonicalProductCount: input.planningInput.catalogue.products.length,
      canonicalCollectionCount: input.planningInput.catalogue.collections.length,
      merchantDescription: input.planningInput.brief.businessIdentity.shortDescription,
      briefApprovalStatus: input.planningInput.brief.approval.status,
      approvedEvidenceFingerprint: input.planningInput.brief.approvedEvidenceFingerprint,
    });
    resolveCommercialHomepageProfileSlots(candidate.homepageProfileId, {
      ...homepageEvidence,
      approvedMediaSlotIds: homepage.slots.flatMap((slot) => {
        const definition = input.planningInput.componentDefinitions.find(
          ({ type }) => type === slot.sectionType,
        );
        const acceptedRoles = new Set(
          definition?.assetSlots.flatMap(({ acceptedRoles }) => acceptedRoles) ?? [],
        );
        return input.planningInput.approvedAssetContext?.assets.some(({ role }) =>
          acceptedRoles.has(role),
        )
          ? [slot.id]
          : [];
      }),
    });
  } catch {
    return false;
  }
  return input.siteMapDecision.pages
    .filter((page) => page.required || includedOptional.has(page.familyId))
    .every((page) => {
      const profileId =
        page.familyId === "home"
          ? candidate.homepageProfileId
          : page.familyId === "collection"
            ? candidate.collectionProfileId
            : page.familyId === "search-results"
              ? candidate.searchProfileId
              : page.familyId === "product-detail"
                ? candidate.pdpProfileId
                : page.profile.id;
      const profile = getExecutablePageBlueprintProfile(profileId)?.profile;
      return (
        profile !== undefined &&
        profile.requiredAssetRoles.every((requiredRole) => availableRoles.has(requiredRole))
      );
    });
}

function candidateMatchesProfileDesignDna(
  candidate: CompatibleCoordinatedDirectionCandidateMaterial,
  input: BoundedStorefrontSynthesisInput,
): boolean {
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
    getCommercialHomepageProfile(candidate.homepageProfileId)?.profile?.commercialHomepage
      ?.designDnaNarrowing,
    getCommercialCollectionSearchProfile(candidate.collectionProfileId)?.profile
      ?.commercialCollectionSearch?.designDnaNarrowing,
    getCommercialCollectionSearchProfile(candidate.searchProfileId)?.profile
      ?.commercialCollectionSearch?.designDnaNarrowing,
    getCommercialPdpProfile(candidate.pdpProfileId)?.profile?.commercialProductDetail
      ?.designDnaNarrowing,
  ];
  return narrowings.every(
    (narrowing) =>
      narrowing !== undefined &&
      narrowing.spacingDensity.includes(candidate.designSystemSpacingDensity) &&
      narrowing.surfaceDepth.includes(candidate.designSystemSurfaceDepth) &&
      narrowing.imagePosture.includes(imagePosture),
  );
}

function candidateMatchesPageSetFrame(
  candidate: CompatibleCoordinatedDirectionCandidateMaterial,
  input: BoundedStorefrontSynthesisInput,
): boolean {
  const includedOptional = new Set(candidate.includedOptionalPageFamilyIds);
  return input.siteMapDecision.pages
    .filter((page) => page.required || includedOptional.has(page.familyId))
    .every((page) => {
      const profileId =
        page.familyId === "home"
          ? candidate.homepageProfileId
          : page.familyId === "collection"
            ? candidate.collectionProfileId
            : page.familyId === "search-results"
              ? candidate.searchProfileId
              : page.familyId === "product-detail"
                ? candidate.pdpProfileId
                : page.profile.id;
      const profile = getExecutablePageBlueprintProfile(profileId)?.profile;
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

export function compatibleCoordinatedDirectionCandidateMaterial(
  direction: CoordinatedStorefrontDirectionPackage,
  input: BoundedStorefrontSynthesisInput,
  options: CompatibleCoordinatedDirectionCandidateEnumerationOptions = {},
): CompatibleCoordinatedDirectionCandidateMaterial[] {
  // Check the exact raw metadata cardinality before `product()` allocates any combinations. The
  // post-filters are deliberately not allowed to turn an oversized authority into unbounded work.
  assertCandidateEnumerationBudget([direction], options.maximumCandidateEvaluations);
  return candidateMaterial(direction)
    .filter((candidate) => candidateHasSupportedAssetPosture(candidate, input))
    .filter((candidate) => candidateMatchesProfileDesignDna(candidate, input))
    .filter((candidate) => candidateMatchesPageSetFrame(candidate, input));
}

/**
 * Lists the exact coordinated-direction selections that are compatible with current registered,
 * evidence, asset, page-set and Design DNA authority. This is deliberately the read-only boundary
 * before synthesis decisions, proposal compilation and storefront materialization.
 *
 * Direction packages retain their canonical registry order. Selections within each package are
 * ordered by their content-derived selection IDs, so neither object insertion order nor runtime
 * timing can influence the inventory.
 */
export function listCompatibleCoordinatedDirectionSelectionNarrowings(
  input: CompatibleCoordinatedDirectionNarrowingInput,
  options: Readonly<
    CompatibleCoordinatedDirectionCandidateEnumerationOptions & {
      directionId?: CoordinatedStorefrontDirectionId;
    }
  > = {},
): readonly BoundedStorefrontSynthesisSelectionNarrowing[] {
  const seenSelectionIds = new Set<string>();
  const narrowings: BoundedStorefrontSynthesisSelectionNarrowing[] = [];
  const directions = listCoordinatedStorefrontDirections().filter(
    ({ id }) => options.directionId === undefined || id === options.directionId,
  );
  assertCandidateEnumerationBudget(directions, options.maximumCandidateEvaluations);

  for (const direction of directions) {
    const authorityInput: BoundedStorefrontSynthesisInput = {
      ...input,
      request: {
        intent: direction.intent,
        deterministicSeed: "compatible-direction-narrowing-inventory",
      },
    };
    const directionNarrowings = compatibleCoordinatedDirectionCandidateMaterial(
      direction,
      authorityInput,
    )
      .map((candidate) => coordinatedDirectionNarrowingForCandidate(direction, candidate))
      .sort((left, right) => left.selectionId.localeCompare(right.selectionId));

    for (const narrowing of directionNarrowings) {
      if (seenSelectionIds.has(narrowing.selectionId)) continue;
      validateDirectionSelectionNarrowing(narrowing);
      seenSelectionIds.add(narrowing.selectionId);
      narrowings.push(Object.freeze(structuredClone(narrowing)));
    }
  }

  return Object.freeze(narrowings);
}

function exactSelectionMaterial(
  narrowing: BoundedStorefrontSynthesisSelectionNarrowing,
): BoundedStorefrontSynthesisExactSelection {
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
  return boundedStorefrontSynthesisExactSelectionSchema.parse(exact);
}

/**
 * Exact prompted execution values carry no historical selection identity. They are nevertheless
 * authorized only when the complete value tuple matches one current compatible inventory entry.
 */
export function isCurrentCompatibleCoordinatedDirectionExactSelection(input: {
  authority: CompatibleCoordinatedDirectionNarrowingInput;
  exactSelection: BoundedStorefrontSynthesisExactSelection;
}): boolean {
  const exact = boundedStorefrontSynthesisExactSelectionSchema.parse(input.exactSelection);
  const exactFingerprint = canonicalValueFingerprint(exact);
  const directionId: CoordinatedStorefrontDirectionId =
    exact.directionId === "premiumEditorial"
      ? "premium-editorial"
      : exact.directionId === "modernTechnical"
        ? "modern-technical"
        : "minimal-commerce";
  return listCompatibleCoordinatedDirectionSelectionNarrowings(input.authority, {
    directionId,
  }).some(
    (narrowing) =>
      canonicalValueFingerprint(exactSelectionMaterial(narrowing)) === exactFingerprint,
  );
}
