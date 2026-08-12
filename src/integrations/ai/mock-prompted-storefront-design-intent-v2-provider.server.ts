import "server-only";

import {
  listCompatibleCoordinatedDirectionSelectionNarrowings,
  type CompatibleCoordinatedDirectionNarrowingInput,
} from "@/application/bounded-storefront-synthesis";
import {
  PromptedStorefrontDesignIntentError,
  promptedStorefrontDesignIntentFingerprint,
  promptedStorefrontDesignIntentV2Schema,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCapabilityAuthorityReference,
  type PromptedStorefrontCapabilityEntry,
  type PromptedStorefrontDesignIntentProvider,
  type PromptedStorefrontDesignIntentV2,
} from "@/application/prompted-storefront-design-intent";

export const P10B16P03_MOCK_PROMPTED_STOREFRONT_PROVIDER_ID =
  "p10b-16p-03-mock-prompted-storefront-design-v2" as const;
export const P10B16P03_MOCK_PROMPTED_STOREFRONT_MODEL_ID = "deterministic-p10b-16p-03-v1" as const;

export const p10b16p03MockPromptScenarios = [
  "premium-editorial",
  "modern-technical",
  "minimal-commerce",
] as const;
export type P10B16P03MockPromptScenario = (typeof p10b16p03MockPromptScenarios)[number];

export type P10B16P03MockPromptFailure =
  | "provider-refusal"
  | "provider-timeout"
  | "provider-transport"
  | "malformed-output"
  | "strict-schema-invalid"
  | "unknown-capability"
  | "insufficient-material-intent"
  | "unsupported-hard-constraint";

type Preference = PromptedStorefrontDesignIntentV2["designDna"]["preferences"][number];

const scenarioSelectionTargets = {
  "premium-editorial": {
    sharedFrameProfileId: "editorial-masthead",
    homepageProfileId: "homepage-editorial-storytelling",
    collectionProfileId: "collection-editorial-discovery",
    pdpProfileId: "pdp-high-consideration",
    typographyPairing: "serif-led",
    mediaPosture: "editorial",
  },
  "modern-technical": {
    sharedFrameProfileId: "compact-technical",
    homepageProfileId: "homepage-commerce-led-discovery",
    collectionProfileId: "collection-catalogue-comparison",
    pdpProfileId: "pdp-variant-led",
    typographyPairing: "sans-led",
    mediaPosture: "product-led",
  },
  "minimal-commerce": {
    sharedFrameProfileId: "centered-minimal",
    homepageProfileId: "homepage-minimal-brand-commerce",
    collectionProfileId: "collection-editorial-discovery",
    pdpProfileId: "pdp-standard-commerce",
    typographyPairing: "serif-led",
    mediaPosture: "restrained",
  },
} as const satisfies Record<
  P10B16P03MockPromptScenario,
  Readonly<{
    sharedFrameProfileId: string;
    homepageProfileId: string;
    collectionProfileId: string;
    pdpProfileId: string;
    typographyPairing: string;
    mediaPosture: string;
  }>
>;

function preference(
  entry: PromptedStorefrontCapabilityEntry,
  semantics: Preference["semantics"] = "soft",
  rank = 1,
): Preference {
  return {
    key: entry.key,
    dimension: entry.dimension,
    semantics,
    rank: semantics === "soft" ? rank : null,
  };
}

function entries(
  authority: PromptedStorefrontCapabilityAuthority,
  dimension: PromptedStorefrontCapabilityEntry["dimension"],
  predicate: (
    reference: PromptedStorefrontCapabilityAuthorityReference | undefined,
  ) => boolean = () => true,
): PromptedStorefrontCapabilityEntry[] {
  return authority.projection.capabilities.filter(
    (candidate) =>
      candidate.dimension === dimension &&
      candidate.availability === "available" &&
      predicate(authority.referencesByPreferenceKey.get(candidate.key)),
  );
}

function requiredEntry(
  authority: PromptedStorefrontCapabilityAuthority,
  dimension: PromptedStorefrontCapabilityEntry["dimension"],
  predicate?: (reference: PromptedStorefrontCapabilityAuthorityReference | undefined) => boolean,
): PromptedStorefrontCapabilityEntry {
  const entry = entries(authority, dimension, predicate)[0];
  if (!entry) throw new PromptedStorefrontDesignIntentError("unknown-capability");
  return entry;
}

function mockIntent(input: {
  scenario: P10B16P03MockPromptScenario;
  request: Parameters<PromptedStorefrontDesignIntentProvider["createDesignIntent"]>[0];
  authority: PromptedStorefrontCapabilityAuthority;
  compatibilityInput: CompatibleCoordinatedDirectionNarrowingInput;
}): PromptedStorefrontDesignIntentV2 {
  const narrowings = listCompatibleCoordinatedDirectionSelectionNarrowings(
    input.compatibilityInput,
    { directionId: input.scenario },
  );
  const scenarioIndex = p10b16p03MockPromptScenarios.indexOf(input.scenario);
  const target = scenarioSelectionTargets[input.scenario];
  const narrowing = [...narrowings].sort((left, right) => {
    const score = (candidate: (typeof narrowings)[number]) =>
      Number(candidate.homepageProfileId === target.homepageProfileId) * 4 +
      Number(candidate.collectionProfileId === target.collectionProfileId) * 2 +
      Number(candidate.pdpProfileId === target.pdpProfileId) +
      Number(candidate.sharedFrameProfileId === target.sharedFrameProfileId) +
      (input.scenario === "minimal-commerce"
        ? Number(candidate.includedOptionalPageFamilyIds.includes("checkout")) * 8
        : 0);
    return score(right) - score(left) || left.selectionId.localeCompare(right.selectionId);
  })[0];
  if (!narrowing) throw new PromptedStorefrontDesignIntentError("unknown-capability");

  const exactAuthority = (
    dimension: PromptedStorefrontCapabilityEntry["dimension"],
    authorityId: string,
  ) =>
    requiredEntry(
      input.authority,
      dimension,
      (reference) =>
        reference?.authorityId === authorityId ||
        reference?.authorityId.startsWith(`${authorityId}@`) === true,
    );
  const available = (dimension: PromptedStorefrontCapabilityEntry["dimension"]) => {
    const availableEntries = entries(input.authority, dimension);
    const selected = availableEntries[scenarioIndex % availableEntries.length];
    if (!selected) throw new PromptedStorefrontDesignIntentError("unknown-capability");
    return selected;
  };
  const pdpRole = (
    role: NonNullable<PromptedStorefrontCapabilityAuthorityReference["intentRoles"]>[number],
  ) =>
    requiredEntry(
      input.authority,
      "pdp.archetype",
      (reference) => reference?.intentRoles?.includes(role) === true,
    );

  const frame = exactAuthority("shared-frame.profile", narrowing.sharedFrameProfileId);
  const homepage = exactAuthority("homepage.profile", narrowing.homepageProfileId);
  const collection = exactAuthority("collection-search.archetype", narrowing.collectionProfileId);
  const homepageRoles = entries(
    input.authority,
    "homepage.narrative-role",
    (reference) => reference?.authorityId.startsWith(`${narrowing.homepageProfileId}@`) === true,
  );
  const role = homepageRoles[scenarioIndex % homepageRoles.length] ?? homepageRoles[0];
  if (!role) throw new PromptedStorefrontDesignIntentError("unknown-capability");
  const sectionCount = input.authority.projection.capabilities.find(
    ({ key }) => key === `homepage.section-count.${narrowing.homepageProfileId}`,
  );
  if (!sectionCount || sectionCount.selection.kind !== "number") {
    throw new PromptedStorefrontDesignIntentError("unknown-capability");
  }
  const exactDesignDna = (
    dimension: PromptedStorefrontCapabilityEntry["dimension"],
    value: string,
  ) =>
    requiredEntry(
      input.authority,
      dimension,
      (reference) => reference?.authorityKind === "design-dna" && reference.authorityId === value,
    );
  const designDna = [
    exactDesignDna(
      "design-dna.typography-pairing",
      `typography.pairing:${target.typographyPairing}`,
    ),
    exactDesignDna("design-dna.media", `media.posture:${target.mediaPosture}`),
  ];
  const exactPdpProfile = exactAuthority("pdp.archetype", narrowing.pdpProfileId);
  const exactHeroVariant = (variant: string) =>
    requiredEntry(
      input.authority,
      "homepage.meaningful-variant",
      (reference) => reference?.authorityId === `homepageHero:${variant}`,
    );
  const heroVariant = exactHeroVariant(
    input.scenario === "premium-editorial"
      ? "fullBleedOverlay"
      : input.scenario === "modern-technical"
        ? "imageLed"
        : "restrained",
  );
  const componentVariant =
    input.scenario === "modern-technical"
      ? requiredEntry(
          input.authority,
          "component.meaningful-variant",
          (reference) => reference?.authorityId === "homepageHero:imageLed",
        )
      : input.scenario === "minimal-commerce"
        ? requiredEntry(
            input.authority,
            "component.meaningful-variant",
            (reference) => reference?.authorityId === "homepageHero:restrained",
          )
        : null;
  const standard = pdpRole("pdp-standard-simple");
  const configurable = pdpRole("pdp-configurable");
  const gallery = pdpRole("pdp-gallery-led");
  const highConsideration = pdpRole("pdp-high-consideration");
  const fallback = pdpRole("pdp-generic-fallback");
  const productType = available("pdp.product-type");

  const material = {
    contractVersion: "2.0.0" as const,
    requestFingerprint: input.request.requestFingerprint,
    promptFingerprint: input.request.promptFingerprint,
    concept: {
      summary: `A ${input.scenario} complete storefront grounded in approved merchant authority.`,
      commercialPosture: input.scenario,
      intendedCustomerExperience:
        "Move from a coherent first impression through truthful discovery into confident purchase.",
    },
    constraints: {
      hard: [preference(frame, "hard")],
      soft: [],
      optional: [],
      avoid: [],
    },
    designDna: { preferences: designDna.map((entry) => preference(entry, "hard")) },
    sharedFrame: { preferences: [preference(frame, "hard")] },
    homepage: {
      profilePreferences: [preference(homepage, "hard")],
      narrativeRoleSequence: [{ key: role.key, dimension: role.dimension }],
      requiredRoles: [{ key: role.key, dimension: role.dimension }],
      preferredRoles: [{ key: role.key, dimension: role.dimension }],
      optionalRoles: [],
      avoidedRoles: [],
      componentFamilyPreferences: [preference(available("homepage.component-family"))],
      meaningfulVariantPreferences: [preference(heroVariant, "hard")],
      sectionCount: {
        key: sectionCount.key,
        dimension: "homepage.section-count" as const,
        minimum: sectionCount.selection.minimum,
        ideal: Math.min(
          sectionCount.selection.maximum,
          sectionCount.selection.minimum + scenarioIndex,
        ),
        maximum: sectionCount.selection.maximum,
      },
      sectionRhythmPreferences: [preference(available("homepage.section-rhythm"))],
      evidenceDependentOmission: "omit" as const,
      approvedAssetRolePreferences: [],
    },
    collectionSearch: {
      archetypePreferences: [preference(collection, "hard")],
      discoveryPreferences: [preference(available("collection-search.discovery"))],
      densityPreferences: [preference(available("collection-search.density"))],
      filterSortPreferences: [preference(available("collection-search.filter-sort"))],
      childCollectionPreferences: [preference(available("collection-search.child-collection"))],
      merchandisingPreferences: [preference(available("collection-search.merchandising"))],
      productCardPreferences: [preference(available("collection-search.product-card"))],
      searchRelationshipPreferences: [
        preference(requiredEntry(input.authority, "collection-search.search-relationship")),
      ],
      searchExecutionExpectation: "registered-presentation-fail-closed-runtime" as const,
    },
    productDetail: {
      standardSimplePreferences: [
        preference(
          input.authority.referencesByPreferenceKey
            .get(exactPdpProfile.key)
            ?.intentRoles?.includes("pdp-standard-simple")
            ? exactPdpProfile
            : standard,
          input.authority.referencesByPreferenceKey
            .get(exactPdpProfile.key)
            ?.intentRoles?.includes("pdp-standard-simple")
            ? "hard"
            : "soft",
        ),
      ],
      configurablePreferences: [
        preference(
          input.authority.referencesByPreferenceKey
            .get(exactPdpProfile.key)
            ?.intentRoles?.includes("pdp-configurable")
            ? exactPdpProfile
            : configurable,
          input.authority.referencesByPreferenceKey
            .get(exactPdpProfile.key)
            ?.intentRoles?.includes("pdp-configurable")
            ? "hard"
            : "soft",
        ),
      ],
      galleryLedPreferences: [
        preference(
          input.authority.referencesByPreferenceKey
            .get(exactPdpProfile.key)
            ?.intentRoles?.includes("pdp-gallery-led")
            ? exactPdpProfile
            : gallery,
          input.authority.referencesByPreferenceKey
            .get(exactPdpProfile.key)
            ?.intentRoles?.includes("pdp-gallery-led")
            ? "hard"
            : "soft",
        ),
      ],
      highConsiderationPreferences: [
        preference(
          input.authority.referencesByPreferenceKey
            .get(exactPdpProfile.key)
            ?.intentRoles?.includes("pdp-high-consideration")
            ? exactPdpProfile
            : highConsideration,
          input.authority.referencesByPreferenceKey
            .get(exactPdpProfile.key)
            ?.intentRoles?.includes("pdp-high-consideration")
            ? "hard"
            : "soft",
        ),
      ],
      genericFallbackPreferences: [preference(fallback)],
      productTypeIntentions: [
        { productTypeKey: productType.key, preferences: [preference(standard)] },
      ],
      optionComplexityPreferences: [preference(available("pdp.option-complexity"))],
      mediaPreferences: [preference(available("pdp.media"))],
      purchaseDecisionHierarchyPreferences: [preference(available("pdp.purchase-hierarchy"))],
      relatedMerchandisingPreferences: [preference(available("pdp.related-merchandising"))],
      productCardPreferences: [preference(available("pdp.product-card"))],
    },
    contentSupport: {
      pageFamilyPreferences: [],
      narrativePurposePreferences: [],
      evidenceRequirements: [],
      safeOmissionBehavior: "omit" as const,
    },
    components: {
      familyPreferences: [preference(available("component.family"))],
      meaningfulVariantPreferences: componentVariant ? [preference(componentVariant, "hard")] : [],
      boundedParameterPreferences: [],
    },
    responsiveArtDirection: {
      responsivePosturePreferences: [preference(available("responsive.posture"))],
      mobileHierarchyPreferences: [preference(available("responsive.mobile-hierarchy"))],
      densityTransformationPreferences: [preference(available("responsive.density"))],
      desktopNarrativePriority: [{ key: role.key, dimension: role.dimension }],
      mobileNarrativePriority: [{ key: role.key, dimension: role.dimension }],
      imagePosturePreferences: [preference(available("responsive.image"))],
      cropFocalPreferences: [preference(available("responsive.crop"))],
      overlayPreferences: [preference(available("responsive.overlay"))],
      approvedMediaRolePreferences: [],
    },
  };
  return promptedStorefrontDesignIntentV2Schema.parse({
    ...material,
    intentFingerprint: promptedStorefrontDesignIntentFingerprint(material),
  });
}

export function createP10B16P03MockPromptedStorefrontDesignIntentProvider(input: {
  scenario: P10B16P03MockPromptScenario;
  compatibilityInput: CompatibleCoordinatedDirectionNarrowingInput;
  failure?: P10B16P03MockPromptFailure;
  onRequest?: (
    request: Parameters<PromptedStorefrontDesignIntentProvider["createDesignIntent"]>[0],
  ) => void;
}): PromptedStorefrontDesignIntentProvider {
  return Object.freeze({
    id: P10B16P03_MOCK_PROMPTED_STOREFRONT_PROVIDER_ID,
    modelId: P10B16P03_MOCK_PROMPTED_STOREFRONT_MODEL_ID,
    createDesignIntent(
      request: Parameters<PromptedStorefrontDesignIntentProvider["createDesignIntent"]>[0],
      validation: Parameters<PromptedStorefrontDesignIntentProvider["createDesignIntent"]>[1],
    ) {
      input.onRequest?.(request);
      if (
        input.failure &&
        input.failure !== "insufficient-material-intent" &&
        input.failure !== "unsupported-hard-constraint"
      ) {
        return Promise.reject(new PromptedStorefrontDesignIntentError(input.failure));
      }
      if (
        validation.currentAuthority().projectId !== request.currentAuthority.projectId ||
        validation.currentAuthority().storefrontSnapshotFingerprint !==
          request.currentAuthority.storefrontSnapshotFingerprint
      ) {
        return Promise.reject(new PromptedStorefrontDesignIntentError("stale-authority"));
      }
      const intent = mockIntent({
        scenario: input.scenario,
        request,
        authority: validation.capabilityAuthority,
        compatibilityInput: input.compatibilityInput,
      });
      const { intentFingerprint: _intentFingerprint, ...material } = intent;
      void _intentFingerprint;
      if (input.failure === "insufficient-material-intent") {
        const avoidedDesignDna = intent.designDna.preferences[0];
        if (!avoidedDesignDna) {
          return Promise.reject(new PromptedStorefrontDesignIntentError("unknown-capability"));
        }
        const insufficient = {
          ...material,
          constraints: { ...material.constraints, soft: [] },
          designDna: {
            preferences: [
              {
                ...avoidedDesignDna,
                semantics: "avoid" as const,
                rank: null,
              },
            ],
          },
        };
        return Promise.resolve(
          promptedStorefrontDesignIntentV2Schema.parse({
            ...insufficient,
            intentFingerprint: promptedStorefrontDesignIntentFingerprint(insufficient),
          }),
        );
      }
      if (input.failure === "unsupported-hard-constraint") {
        const incompatibleFrames = entries(
          validation.capabilityAuthority,
          "shared-frame.profile",
        ).slice(0, 2);
        if (incompatibleFrames.length !== 2) {
          return Promise.reject(new PromptedStorefrontDesignIntentError("unknown-capability"));
        }
        const unsupported = {
          ...material,
          sharedFrame: {
            preferences: incompatibleFrames.map((entry) => preference(entry, "hard")),
          },
        };
        return Promise.resolve(
          promptedStorefrontDesignIntentV2Schema.parse({
            ...unsupported,
            intentFingerprint: promptedStorefrontDesignIntentFingerprint(unsupported),
          }),
        );
      }
      return Promise.resolve(intent);
    },
  });
}
