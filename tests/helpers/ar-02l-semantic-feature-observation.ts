import {
  semanticExactInfluenceAxesFor,
  semanticExactInfluenceAxisIds,
  semanticFeaturesFor,
  semanticOptionalFamilies,
  uniqueSemanticValues,
} from "@/application/prompted-storefront-design-compiler/semantic-capability-features";
import {
  listCompatibleCoordinatedDirectionFactorizedCandidates,
  type BoundedStorefrontSynthesisSelectionNarrowing,
} from "@/application/bounded-storefront-synthesis";
import { listCommercialHomepageProfiles } from "@/application/storefront-templates/commercial-homepage-profiles";
import { listCommercialCollectionSearchProfiles } from "@/application/storefront-templates/commercial-collection-search-profiles";
import { listCommercialPdpProfiles } from "@/application/storefront-templates/commercial-pdp-profiles";
import { storefrontDesignDirectionIdSchema } from "@/application/storefront-design-system/contract";
import { registeredBrandSystemForDirection } from "@/application/storefront-design-system/registered-brand-system";
import { resolveBrandSystemDesignDna } from "@/domain/design-system";
import { createP10B16P03RawKarvonenStudioFixture } from "@/data/demo/p10b-16p-03-studio-prompt-generation";

type Selection = BoundedStorefrontSynthesisSelectionNarrowing;
function outcome(run: () => unknown) {
  try {
    const value = run();
    const frozen =
      value && typeof value === "object"
        ? {
            root: Object.isFrozen(value),
            arrays: Object.values(value).filter(Array.isArray).map(Object.isFrozen),
          }
        : null;
    return { value, frozen };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { error: { name: error.name, message: error.message } };
  }
}

/** Full observations of actual base-supported feature operations, including terminal failures. */
export function observeSemanticFeatures() {
  const fixture = createP10B16P03RawKarvonenStudioFixture();
  const candidates = listCompatibleCoordinatedDirectionFactorizedCandidates({
    planningInput: fixture.planningInput,
    siteMapDecision: fixture.siteMapDecision,
    approvedEvidenceReferences: fixture.approvedEvidenceReferences,
  });
  const cases: { id: string; selection: Selection }[] = candidates.map(({ backbone }) => ({
    id: `registered:${backbone.selectionId}`,
    selection: backbone,
  }));
  const seed = candidates[0]?.backbone;
  if (!seed) throw new Error("Missing registered selection fixture.");
  function add(id: string, patch: Readonly<Record<string, unknown>>) {
    cases.push({ id, selection: { ...seed, ...patch } });
  }
  for (const directionId of storefrontDesignDirectionIdSchema.options)
    for (const sharedFrameProfileId of [
      "editorial-masthead",
      "commerce-utility",
      "centered-minimal",
      "compact-technical",
    ])
      for (const designSystemSpacingDensity of ["compact", "standard", "spacious"])
        for (const artDirectionPosture of ["contained", "editorial", "immersive"])
          add(
            `posture:${directionId}:${sharedFrameProfileId}:${designSystemSpacingDensity}:${artDirectionPosture}`,
            {
              directionId,
              sharedFrameProfileId,
              designSystemSpacingDensity,
              artDirectionPosture,
            },
          );
  const profileCases = {
    homepageProfileId: listCommercialHomepageProfiles(),
    collectionProfileId: listCommercialCollectionSearchProfiles(),
    searchProfileId: listCommercialCollectionSearchProfiles(),
    pdpProfileId: listCommercialPdpProfiles(),
  };
  for (const [field, profiles] of Object.entries(profileCases)) {
    for (const profile of profiles)
      add(`${field}:${profile.profile!.id}`, { [field]: profile.profile!.id });
    add(`${field}:unknown`, { [field]: "unknown-profile" });
  }
  for (const narrativePosture of [
    "story-led",
    "discovery-led",
    "restrained",
    "catalogue-dense",
    "considered-purchase",
    "campaign-led",
  ])
    add(`narrative:${narrativePosture}`, { narrativePosture });
  for (const merchandisingPosture of [
    "curated",
    "discovery",
    "restrained",
    "dense",
    "considered",
    "campaign",
  ])
    add(`merchandising:${merchandisingPosture}`, { merchandisingPosture });
  const optionalCases = [
    [],
    ["faq", "about", "faq"],
    ["about", "faq"],
    ["faq", "about"],
    [
      "brand-story",
      "contact",
      "location",
      "shipping",
      "returns",
      "policy",
      "service",
      "campaign",
      "editorial",
      "generic",
      "content",
    ],
    ["unregistered-family"],
    ["about-faq-contact-policy-editorial-content"],
  ];
  for (const [i, includedOptionalPageFamilyIds] of optionalCases.entries())
    add(`optional:${i}`, { includedOptionalPageFamilyIds });
  add("frame:unknown", { sharedFrameProfileId: "unknown-frame" });
  add("first-failure:frame-and-home", {
    sharedFrameProfileId: "unknown-frame",
    homepageProfileId: "unknown-profile",
  });
  add(
    "first-failure:all-profiles",
    Object.fromEntries(Object.keys(profileCases).map((key) => [key, "unknown-profile"])),
  );
  const observations = cases.map(({ id, selection }) => {
    const before = JSON.stringify(selection);
    const designDna = resolveBrandSystemDesignDna(
      registeredBrandSystemForDirection(
        fixture.planningInput.draft.brandSystem,
        fixture.planningInput.recipeContext.designSystem,
        selection.directionId,
        {
          spacingDensity: selection.designSystemSpacingDensity,
          surfaceDepth: selection.designSystemSurfaceDepth,
        },
      ),
    );
    const dnaBefore = JSON.stringify(designDna);
    const result = {
      id,
      selection,
      designDna,
      features: outcome(() => semanticFeaturesFor(selection)),
      axes: outcome(() => semanticExactInfluenceAxesFor(selection, designDna)),
      optional: outcome(() => semanticOptionalFamilies(selection)),
    };
    if (before !== JSON.stringify(selection) || dnaBefore !== JSON.stringify(designDna))
      throw new Error(`Input mutation: ${id}`);
    return result;
  });
  return {
    candidateCount: candidates.length,
    axisIds: semanticExactInfluenceAxisIds,
    profileIds: Object.fromEntries(
      Object.entries(profileCases).map(([key, rows]) => [
        key,
        rows.map(({ profile }) => profile!.id),
      ]),
    ),
    uniqueValues: outcome(() => uniqueSemanticValues(["z", "a", "z", "A", "ä", "a"])),
    observations,
  };
}
