import {
  dynamicCollectionCommerceContentSchema,
  dynamicCollectionCommercePropsSchema,
  dynamicCollectionCommerceStyleOverridesSchema,
} from "@/components/registry/dynamic-collection-commerce";
import {
  canonicalValueString,
  createDynamicCommercePresentationAuthority,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommercePresentationAuthority,
} from "@/domain/storefront";
import { createCollectionArchetype } from "./archetype-presentation";

const P10B18B03_LEGACY_COLLECTION_PROFILES = {
  "collection-catalogue-comparison": {
    profileFingerprint:
      "page-blueprint-v1_1822_47ab13e9edd6bdd344b0511153f7a96d81c99a9d74e4ce06872102f30c77b3f9",
    responsivePosture: [
      {
        breakpoint: "mobile",
        viewport: 375,
        transformationIds: [
          "comparisonFilterDisclosure",
          "comparisonGridReflow",
          "compactSimplify",
        ],
      },
      {
        breakpoint: "tablet",
        viewport: 768,
        transformationIds: ["comparisonFilterDisclosure", "comparisonGridReflow"],
      },
      {
        breakpoint: "desktop",
        viewport: 1024,
        transformationIds: ["comparisonGridReflow"],
      },
      {
        breakpoint: "wide",
        viewport: 1440,
        transformationIds: ["comparisonGridReflow"],
      },
    ],
  },
  "collection-dense-search": {
    profileFingerprint:
      "page-blueprint-v1_1876_ba5bddba871565c4c64444103318ba535c16149ff9fb38300e91687abc565a0e",
    responsivePosture: [
      {
        breakpoint: "mobile",
        viewport: 375,
        transformationIds: ["denseFilterDisclosure", "denseGridReflow", "compactSimplify"],
      },
      {
        breakpoint: "tablet",
        viewport: 768,
        transformationIds: ["denseFilterDisclosure", "denseGridReflow", "compactSimplify"],
      },
      {
        breakpoint: "desktop",
        viewport: 1024,
        transformationIds: ["denseGridReflow"],
      },
      {
        breakpoint: "wide",
        viewport: 1440,
        transformationIds: ["denseGridReflow"],
      },
    ],
  },
} as const;

const p10b18b03LegacyCollectionPropsSchema = dynamicCollectionCommercePropsSchema.omit({
  conciseAttributeLimit: true,
});

function migrateP10B18B03CollectionArchetype(
  archetype: DynamicCommerceCollectionSearchArchetype,
): DynamicCommerceCollectionSearchArchetype {
  const sorted = (values: readonly string[]) => [...values].sort();
  const normalizedDesignDnaNarrowing = (value: {
    spacingDensity: readonly string[];
    surfaceDepth: readonly string[];
    imagePosture: readonly string[];
  }) => ({
    spacingDensity: sorted(value.spacingDensity),
    surfaceDepth: sorted(value.surfaceDepth),
    imagePosture: sorted(value.imagePosture),
  });
  const profileId = archetype.profile.profileId;
  const legacy =
    P10B18B03_LEGACY_COLLECTION_PROFILES[
      profileId as keyof typeof P10B18B03_LEGACY_COLLECTION_PROFILES
    ];
  if (!legacy || archetype.profile.fingerprint !== legacy.profileFingerprint) return archetype;

  const current = createCollectionArchetype(profileId);
  const presentation = archetype.componentPresentations[0];
  const currentPresentation = current.componentPresentations[0];
  if (
    archetype.id !== current.id ||
    archetype.archetypeVersion !== current.archetypeVersion ||
    archetype.family !== "collection-search" ||
    archetype.profile.profileVersion !== current.profile.profileVersion ||
    canonicalValueString(sorted(archetype.supportedContexts)) !==
      canonicalValueString(sorted(current.supportedContexts)) ||
    canonicalValueString(sorted(archetype.compatibleSharedFrameProfileIds)) !==
      canonicalValueString(sorted(current.compatibleSharedFrameProfileIds)) ||
    archetype.defaultSharedFrameProfileId !== current.defaultSharedFrameProfileId ||
    canonicalValueString(normalizedDesignDnaNarrowing(archetype.designDnaNarrowing)) !==
      canonicalValueString(normalizedDesignDnaNarrowing(current.designDnaNarrowing)) ||
    canonicalValueString(archetype.responsivePosture) !==
      canonicalValueString(legacy.responsivePosture) ||
    canonicalValueString(archetype.artDirectionPosture) !==
      canonicalValueString(current.artDirectionPosture) ||
    archetype.fallbackBehavior !== current.fallbackBehavior ||
    archetype.componentPresentations.length !== 1 ||
    !presentation ||
    !currentPresentation ||
    presentation.slotId !== currentPresentation.slotId ||
    presentation.component !== "dynamicCollectionCommerce" ||
    presentation.variant !== currentPresentation.variant ||
    presentation.anatomyId !== "compact" ||
    canonicalValueString(presentation.boundedParameters) !==
      canonicalValueString(currentPresentation.boundedParameters)
  ) {
    return archetype;
  }

  const content = dynamicCollectionCommerceContentSchema.safeParse(presentation.content);
  const props = p10b18b03LegacyCollectionPropsSchema.safeParse(presentation.props);
  const styleOverrides = dynamicCollectionCommerceStyleOverridesSchema.safeParse(
    presentation.styleOverrides,
  );
  const currentProps = dynamicCollectionCommercePropsSchema.parse(currentPresentation.props);
  const conciseAttributeLimit = currentProps.conciseAttributeLimit;
  const currentAnatomyId = currentPresentation.anatomyId;
  if (
    !content.success ||
    !props.success ||
    !styleOverrides.success ||
    props.data.cardVariant !== "compact" ||
    conciseAttributeLimit === undefined ||
    currentAnatomyId === undefined
  ) {
    return archetype;
  }

  return {
    ...structuredClone(current),
    componentPresentations: [
      {
        ...structuredClone(currentPresentation),
        visible: presentation.visible,
        content: structuredClone(content.data),
        props: {
          ...structuredClone(props.data),
          cardVariant: currentAnatomyId,
          conciseAttributeLimit,
        },
        styleOverrides: structuredClone(styleOverrides.data),
        approvedAssetSelections: (presentation.approvedAssetSelections ?? []).map((selection) =>
          structuredClone(selection),
        ),
      },
    ],
  };
}

export function migrateP10B18B03PresentationAuthority(
  authority: DynamicCommercePresentationAuthority,
): Readonly<{ authority: DynamicCommercePresentationAuthority; migrated: boolean }> {
  const collectionSearchArchetypes = authority.collectionSearchArchetypes.map((archetype) =>
    migrateP10B18B03CollectionArchetype(archetype),
  );
  const migrated = collectionSearchArchetypes.some(
    (archetype, index) =>
      canonicalValueString(archetype) !==
      canonicalValueString(authority.collectionSearchArchetypes[index]),
  );
  if (!migrated) return { authority, migrated: false };
  const { authorityFingerprint: _authorityFingerprint, ...material } = authority;
  void _authorityFingerprint;
  return {
    authority: createDynamicCommercePresentationAuthority({
      ...structuredClone(material),
      authorityRevision: authority.authorityRevision + 1,
      collectionSearchArchetypes,
    }),
    migrated: true,
  };
}
