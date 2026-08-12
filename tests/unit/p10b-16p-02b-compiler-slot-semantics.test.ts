import { describe, expect, it } from "vitest";
import type { BoundedStorefrontSynthesisSelectionNarrowing } from "@/application/bounded-storefront-synthesis";
import {
  resolvePromptedStorefrontExactSlotOverrides,
  type LocatedPreference,
} from "@/application/prompted-storefront-design-compiler/compiler";
import type { PromptedStorefrontDesignCompilerError } from "@/application/prompted-storefront-design-compiler";
import type {
  PromptedStorefrontCapabilityAuthority,
  PromptedStorefrontCapabilityAuthorityReference,
  PromptedStorefrontCapabilityDimension,
  PromptedStorefrontPreferenceSemantics,
} from "@/application/prompted-storefront-design-intent";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";

const selectionNarrowing: BoundedStorefrontSynthesisSelectionNarrowing = {
  authorityId: "test-direction-authority",
  authorityVersion: "1.0.0",
  authorityFingerprint: "test-direction-fingerprint",
  selectionId: "test-direction-selection",
  directionId: "premiumEditorial",
  designSystemSpacingDensity: "standard",
  designSystemSurfaceDepth: "subtle",
  sharedFrameProfileId: "editorial-masthead",
  homepageProfileId: "homepage-editorial-storytelling",
  collectionProfileId: "collection-editorial-discovery",
  searchProfileId: "collection-dense-search",
  pdpProfileId: "pdp-high-consideration",
  includedOptionalPageFamilyIds: [],
  narrativePosture: "story-led",
  merchandisingPosture: "curated",
  informationDensityPosture: "balanced",
  artDirectionPosture: "editorial",
  responsiveMode: "content-first",
};

function preference(
  input: Readonly<{
    path: string;
    key: string;
    dimension: PromptedStorefrontCapabilityDimension;
    semantics: PromptedStorefrontPreferenceSemantics;
    rank?: number;
    value?: string | number;
  }>,
): LocatedPreference {
  return {
    path: input.path,
    key: input.key,
    dimension: input.dimension,
    semantics: input.semantics,
    rank: input.semantics === "soft" ? (input.rank ?? 1) : null,
    value: input.value ?? null,
  };
}

function reference(
  input: Readonly<{
    key: string;
    dimension: PromptedStorefrontCapabilityDimension;
    authorityId: string;
    selection?: PromptedStorefrontCapabilityAuthorityReference["selection"];
  }>,
): PromptedStorefrontCapabilityAuthorityReference {
  return {
    key: input.key,
    dimension: input.dimension,
    availability: "available",
    authorityKind: "component-manifest",
    authorityId: input.authorityId,
    authorityFingerprint: `test-${input.key}`,
    selection: input.selection ?? { kind: "capability" },
    productTypeKey: false,
  };
}

function resolve(
  preferences: readonly LocatedPreference[],
  references: readonly PromptedStorefrontCapabilityAuthorityReference[],
) {
  return resolvePromptedStorefrontExactSlotOverrides({
    selectionNarrowing,
    componentDefinitions: [...veskifyComponentDefinitionsV2],
    authority: {
      referencesByPreferenceKey: new Map(references.map((entry) => [entry.key, entry])),
    } satisfies Pick<PromptedStorefrontCapabilityAuthority, "referencesByPreferenceKey">,
    preferences,
  });
}

function exactSlot(result: ReturnType<typeof resolve>, profileId: string, slotId: string) {
  return result.slotOverrides
    .find((entry) => entry.profileId === profileId)
    ?.slotSelections.find((entry) => entry.slotId === slotId);
}

describe("P10B-16P-02B compiler exact slot semantics", () => {
  it("scopes homepage variants to home and applies hard over ranked soft and optional", () => {
    const references = [
      reference({
        key: "hero-image-led",
        dimension: "homepage.meaningful-variant",
        authorityId: "homepageHero:imageLed",
      }),
      reference({
        key: "hero-overlay",
        dimension: "homepage.meaningful-variant",
        authorityId: "homepageHero:fullBleedOverlay",
      }),
      reference({
        key: "hero-asymmetric",
        dimension: "homepage.meaningful-variant",
        authorityId: "homepageHero:asymmetric",
      }),
    ];
    const result = resolve(
      [
        preference({
          path: "homepage.meaningfulVariantPreferences[0]",
          key: "hero-overlay",
          dimension: "homepage.meaningful-variant",
          semantics: "soft",
          rank: 1,
        }),
        preference({
          path: "homepage.meaningfulVariantPreferences[1]",
          key: "hero-asymmetric",
          dimension: "homepage.meaningful-variant",
          semantics: "optional",
        }),
        preference({
          path: "homepage.meaningfulVariantPreferences[2]",
          key: "hero-image-led",
          dimension: "homepage.meaningful-variant",
          semantics: "hard",
        }),
      ],
      references,
    );

    expect(exactSlot(result, "homepage-editorial-storytelling", "hero")).toMatchObject({
      component: "homepageHero",
      variant: "imageLed",
    });
    expect(result.slotOverrides.every(({ pageType }) => pageType === "home")).toBe(true);
    expect([...result.selectedPreferencePaths]).toEqual([
      "homepage.meaningfulVariantPreferences[2]",
    ]);
  });

  it("never retains an explicitly avoided default variant", () => {
    const avoided = reference({
      key: "avoid-editorial-split",
      dimension: "homepage.meaningful-variant",
      authorityId: "homepageHero:editorialSplit",
    });
    const result = resolve(
      [
        preference({
          path: "homepage.meaningfulVariantPreferences[0]",
          key: avoided.key,
          dimension: avoided.dimension,
          semantics: "avoid",
        }),
      ],
      [avoided],
    );

    const hero = exactSlot(result, "homepage-editorial-storytelling", "hero");
    expect(hero?.variant).not.toBe("editorialSplit");
    expect(hero?.variant).toBe("asymmetric");
    expect(result.selectedPreferencePaths.size).toBe(0);
  });

  it("fails rather than broadcasting one generic parameter across ambiguous instances", () => {
    const parameter = reference({
      key: "editorial-alignment",
      dimension: "component.bounded-parameter",
      authorityId: "homepageEditorial:contentAlignment",
      selection: { kind: "enum", allowedValues: ["start", "center", "end"] },
    });

    expect(() =>
      resolve(
        [
          preference({
            path: "components.boundedParameterPreferences[0]",
            key: parameter.key,
            dimension: parameter.dimension,
            semantics: "soft",
            value: "center",
          }),
        ],
        [parameter],
      ),
    ).toThrow(
      expect.objectContaining<Partial<PromptedStorefrontDesignCompilerError>>({
        code: "incompatible-component-selection",
      }),
    );
  });

  it("binds one exact parameter slot and preserves hard parameter precedence", () => {
    const parameter = reference({
      key: "featured-product-columns",
      dimension: "component.bounded-parameter",
      authorityId: "homepageFeaturedProducts:columnCount",
      selection: { kind: "number", minimum: 2, maximum: 4 },
    });
    const result = resolve(
      [
        preference({
          path: "components.boundedParameterPreferences[0]",
          key: parameter.key,
          dimension: parameter.dimension,
          semantics: "soft",
          rank: 1,
          value: 2,
        }),
        preference({
          path: "components.boundedParameterPreferences[1]",
          key: parameter.key,
          dimension: parameter.dimension,
          semantics: "optional",
          value: 3,
        }),
        preference({
          path: "components.boundedParameterPreferences[2]",
          key: parameter.key,
          dimension: parameter.dimension,
          semantics: "hard",
          value: 4,
        }),
      ],
      [parameter],
    );

    expect(exactSlot(result, "homepage-editorial-storytelling", "curated-products")).toMatchObject({
      component: "homepageFeaturedProducts",
      boundedParameters: { columnCount: 4 },
    });
    expect([...result.selectedPreferencePaths]).toEqual([
      "components.boundedParameterPreferences[2]",
    ]);
  });
});
