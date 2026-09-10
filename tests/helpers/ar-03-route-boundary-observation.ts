import {
  createDynamicCommercePresentationAuthority,
  type DynamicCommercePresentationAuthority,
} from "@/domain/storefront";

export function historicalAuthority(authority: DynamicCommercePresentationAuthority) {
  const legacyProfiles = {
    "collection-catalogue-comparison": {
      fingerprint:
        "page-blueprint-v1_1822_47ab13e9edd6bdd344b0511153f7a96d81c99a9d74e4ce06872102f30c77b3f9",
      currentTransformation: "standardCondense",
    },
    "collection-dense-search": {
      fingerprint:
        "page-blueprint-v1_1876_ba5bddba871565c4c64444103318ba535c16149ff9fb38300e91687abc565a0e",
      currentTransformation: "denseReflow",
    },
  } as const;
  const { authorityFingerprint: _fingerprint, ...material } = authority;
  void _fingerprint;
  return createDynamicCommercePresentationAuthority({
    ...structuredClone(material),
    collectionSearchArchetypes: material.collectionSearchArchetypes.map((archetype) => {
      const legacy = legacyProfiles[archetype.profile.profileId as keyof typeof legacyProfiles];
      if (!legacy) return structuredClone(archetype);
      return {
        ...structuredClone(archetype),
        profile: { ...archetype.profile, fingerprint: legacy.fingerprint },
        responsivePosture: archetype.responsivePosture.map((entry) => ({
          ...structuredClone(entry),
          transformationIds: entry.transformationIds.map((id) =>
            id === legacy.currentTransformation ? "compactSimplify" : id,
          ),
        })),
        componentPresentations: archetype.componentPresentations.map((presentation) => {
          const props = structuredClone(presentation.props);
          delete props.conciseAttributeLimit;
          return {
            ...structuredClone(presentation),
            anatomyId: "compact",
            props: { ...props, cardVariant: "compact" },
          };
        }),
      };
    }) as unknown as typeof material.collectionSearchArchetypes,
  });
}

export function normalizedError(reason: unknown): unknown {
  if (!(reason instanceof Error)) return reason;
  return {
    name: reason.name,
    message: reason.message,
    ...Object.fromEntries(
      Object.entries(reason).filter(([key]) => !["stack", "cause"].includes(key)),
    ),
    ...(reason.cause !== undefined ? { cause: normalizedError(reason.cause) } : {}),
  };
}
