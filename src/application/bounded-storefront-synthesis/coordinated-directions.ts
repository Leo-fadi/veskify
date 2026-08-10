import { registeredBrandSystemForDirection } from "@/application/storefront-design-system";
import {
  getCommercialCollectionSearchProfile,
  getCommercialHomepageProfile,
  getCommercialPdpProfile,
  getExecutablePageBlueprintProfile,
} from "@/application/storefront-templates";
import { resolveBrandSystemDesignDna, type DesignDna } from "@/domain/design-system";
import { canonicalValueFingerprint } from "@/domain/storefront";
import {
  boundedStorefrontSynthesisSelectionNarrowingSchema,
  type BoundedStorefrontSynthesisDecision,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "./contract";
import {
  coordinatedDirectionRequestSchema,
  CoordinatedStorefrontDirectionError,
  type CoordinatedDirectionRequest,
  type CoordinatedStorefrontDirectionPackage,
  type StorefrontDiversityFingerprint,
} from "./direction-contract";
import { getCoordinatedStorefrontDirection } from "./direction-registry";
import { compareStorefrontDiversity, createStorefrontDiversityFingerprint } from "./diversity";
import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
  type BoundedStorefrontSynthesisExecutionInput,
  type BoundedStorefrontSynthesisInput,
  type BoundedStorefrontSynthesisResult,
} from "./synthesizer";

type CandidateMaterial = Omit<
  BoundedStorefrontSynthesisSelectionNarrowing,
  "authorityId" | "authorityVersion" | "authorityFingerprint" | "selectionId"
>;

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

function product<T>(values: readonly (readonly T[])[]): T[][] {
  return values.reduce<T[][]>(
    (combinations, dimension) =>
      combinations.flatMap((combination) => dimension.map((value) => [...combination, value])),
    [[]],
  );
}

function candidateMaterial(direction: CoordinatedStorefrontDirectionPackage): CandidateMaterial[] {
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
          }) as CandidateMaterial,
      );
    },
  );
}

function characteristicsMatch(
  candidate: CandidateMaterial,
  request: CoordinatedDirectionRequest,
): boolean {
  const characteristics = request.characteristics;
  if (!characteristics) return true;
  return Object.entries(characteristics).every(([key, value]) => {
    const candidateValue = candidate[key as keyof CandidateMaterial];
    return Array.isArray(value)
      ? canonicalValueFingerprint(candidateValue) === canonicalValueFingerprint(value)
      : candidateValue === value;
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

function narrowingFor(
  direction: CoordinatedStorefrontDirectionPackage,
  candidate: CandidateMaterial,
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

function hasApprovedEditorialMedia(input: BoundedStorefrontSynthesisInput): boolean {
  return (
    input.planningInput.approvedAssetContext?.assets.some(
      ({ role }) => role === "editorialImage",
    ) ?? false
  );
}

function candidateHasSupportedAssetPosture(
  candidate: CandidateMaterial,
  input: BoundedStorefrontSynthesisInput,
): boolean {
  const requiresEditorialMedia =
    candidate.homepageProfileId === "homepage-campaign-led" ||
    candidate.collectionProfileId === "collection-campaign-led-discovery";
  return !requiresEditorialMedia || hasApprovedEditorialMedia(input);
}

function candidateMatchesProfileDesignDna(
  candidate: CandidateMaterial,
  input: BoundedStorefrontSynthesisInput,
): boolean {
  const selection = input.planningInput.recipeContext.designSystem.directions.find(
    ({ id }) => id === candidate.directionId,
  );
  if (!selection) return false;
  const imagePosture = {
    premiumEditorial: "immersive",
    modernTechnical: "contained",
    warmApproachable: "editorial",
  }[selection.id] as "contained" | "editorial" | "immersive";
  const narrowings = [
    getCommercialHomepageProfile(candidate.homepageProfileId)?.profile?.commercialHomepage
      ?.designDnaNarrowing,
    getCommercialCollectionSearchProfile(candidate.collectionProfileId)?.profile
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
  candidate: CandidateMaterial,
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
  const rankedCandidates = candidateMaterial(direction)
    .filter((candidate) => characteristicsMatch(candidate, request.data))
    .filter((candidate) => candidateHasSupportedAssetPosture(candidate, input))
    .filter((candidate) => candidateMatchesProfileDesignDna(candidate, input))
    .filter((candidate) => candidateMatchesPageSetFrame(candidate, input))
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
    const narrowing = narrowingFor(direction, candidate);
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
