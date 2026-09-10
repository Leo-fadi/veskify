import { migrateP10B18B03PresentationAuthority } from "./presentation-compatibility";
import { projectSectionStyleOverrides } from "./presentation-style";
import { failDynamicCommerceRouteAuthority as fail } from "./route-errors";
import { getCommercialCollectionSearchProfile } from "@/application/storefront-templates/commercial-collection-search-profiles";
import { getCommercialPdpProfile } from "@/application/storefront-templates/commercial-pdp-profiles";
import { materializeExecutablePageBlueprint } from "@/application/storefront-templates/profile-materializer";
import {
  dynamicCollectionCommerceContentSchema,
  dynamicCollectionCommercePropsSchema,
  dynamicCollectionCommerceStyleOverridesSchema,
} from "@/components/registry/dynamic-collection-commerce";
import {
  dynamicProductDetailContentSchema,
  dynamicProductDetailPropsSchema,
  dynamicProductDetailStyleOverridesSchema,
} from "@/components/registry/dynamic-product-detail";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import {
  canonicalValueString,
  dynamicCommercePresentationAuthoritySchema,
  isDynamicCommerceArchetypeCompatibleWithSharedFrame,
  type DynamicCommerceCollectionSearchArchetype,
  type DynamicCommercePresentationAuthority,
  type DynamicCommerceProductDetailArchetype,
  type StorefrontSnapshot,
} from "@/domain/storefront";

export function assertCurrentArchetype(
  snapshot: StorefrontSnapshot,
  archetype: DynamicCommerceCollectionSearchArchetype | DynamicCommerceProductDetailArchetype,
  enforceSelectedFrame = true,
) {
  const plan =
    archetype.family === "collection-search"
      ? getCommercialCollectionSearchProfile(archetype.profile.profileId)
      : getCommercialPdpProfile(archetype.profile.profileId);
  if (!plan?.profile || plan.profile.version !== archetype.profile.profileVersion) {
    fail("stale-profile", "The dynamic route references a stale PageBlueprint profile.");
  }
  const materialized = materializeExecutablePageBlueprint({
    pagePlan: plan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories:
      archetype.family === "collection-search" ? ["collection", "productList"] : ["product"],
  });
  const profileAuthority =
    archetype.family === "collection-search"
      ? plan.profile.commercialCollectionSearch
      : plan.profile.commercialProductDetail;
  const semanticFrameIds = (values: readonly string[]) => [...values].sort();
  const semanticDesignDnaNarrowing = (value: {
    spacingDensity: readonly string[];
    surfaceDepth: readonly string[];
    imagePosture: readonly string[];
  }) => ({
    spacingDensity: [...value.spacingDensity].sort(),
    surfaceDepth: [...value.surfaceDepth].sort(),
    imagePosture: [...value.imagePosture].sort(),
  });
  const registeredImagePosture = profileAuthority?.designDnaNarrowing.imagePosture[0];
  const expectedArtDirectionPosture = registeredImagePosture
    ? archetype.family === "collection-search"
      ? {
          imagePosture: registeredImagePosture,
          ratio: "natural",
          crop: registeredImagePosture === "contained" ? "contain" : "editorial",
          overlay: "none",
        }
      : {
          imagePosture: registeredImagePosture,
          ratio: registeredImagePosture === "contained" ? "portrait" : "natural",
          crop: registeredImagePosture === "contained" ? "contain" : "editorial",
          overlay: "none",
        }
    : undefined;
  if (
    materialized.fingerprint !== archetype.profile.fingerprint ||
    !profileAuthority ||
    canonicalValueString(semanticFrameIds(profileAuthority.compatibleSharedFrameProfileIds)) !==
      canonicalValueString(semanticFrameIds(archetype.compatibleSharedFrameProfileIds)) ||
    profileAuthority.defaultSharedFrameProfileId !== archetype.defaultSharedFrameProfileId ||
    canonicalValueString(semanticDesignDnaNarrowing(profileAuthority.designDnaNarrowing)) !==
      canonicalValueString(semanticDesignDnaNarrowing(archetype.designDnaNarrowing)) ||
    canonicalValueString(profileAuthority.responsiveArchitecture) !==
      canonicalValueString(archetype.responsivePosture) ||
    canonicalValueString(expectedArtDirectionPosture) !==
      canonicalValueString(archetype.artDirectionPosture) ||
    archetype.fallbackBehavior !== "use-family-fallback"
  ) {
    fail("stale-profile", "The dynamic route archetype no longer matches registered authority.");
  }
  if (
    archetype.componentPresentations.length !== materialized.slots.length ||
    archetype.componentPresentations.some((presentation, index) => {
      const selection = plan.profile!.componentSelections[index];
      const slot = materialized.slots[index];
      const expectedAnatomyId =
        archetype.family === "collection-search" &&
        profileAuthority &&
        "productCardAnatomyId" in profileAuthority
          ? profileAuthority.productCardAnatomyId
          : archetype.family === "product-detail" &&
              profileAuthority &&
              "relatedProductCardAnatomyId" in profileAuthority
            ? profileAuthority.relatedProductCardAnatomyId
            : undefined;
      return (
        slot?.slotId !== presentation.slotId ||
        slot.component !== presentation.component ||
        selection?.slotId !== presentation.slotId ||
        !selection.variants.includes(presentation.variant) ||
        (plan.slots[index]?.required === true && !presentation.visible) ||
        presentation.anatomyId !== expectedAnatomyId ||
        canonicalValueString(presentation.boundedParameters) !==
          canonicalValueString(slot.boundedParameters)
      );
    })
  ) {
    fail(
      "invalid-presentation",
      "The dynamic route archetype does not match its registered PageBlueprint presentation.",
    );
  }
  try {
    for (const presentation of archetype.componentPresentations) {
      const definition = veskifyComponentDefinitionsV2.find(
        ({ type }) => type === presentation.component,
      );
      if (!definition) {
        fail("invalid-presentation", "The dynamic route component definition is unavailable.");
      }
      for (const selection of presentation.approvedAssetSelections ?? []) {
        const slot = definition.assetSlots.find(({ id }) => id === selection.assetSlotId);
        if (!slot || !slot.acceptedRoles.includes(selection.role)) {
          fail(
            "invalid-presentation",
            "The dynamic route approved asset selection is outside current registered authority.",
          );
        }
      }
      if (archetype.family === "collection-search") {
        dynamicCollectionCommerceContentSchema.parse(presentation.content);
        const props = dynamicCollectionCommercePropsSchema.parse(presentation.props);
        if (props.cardVariant !== presentation.anatomyId) {
          fail(
            "invalid-presentation",
            `The collection product-card anatomy ${props.cardVariant} does not match its executable presentation ${presentation.anatomyId} for ${archetype.profile.profileId}.`,
          );
        }
        if (presentation.styleOverrides) {
          dynamicCollectionCommerceStyleOverridesSchema.parse(presentation.styleOverrides);
        }
      } else {
        dynamicProductDetailContentSchema.parse(presentation.content);
        const props = dynamicProductDetailPropsSchema.parse(presentation.props);
        if (props.relatedCardVariant !== presentation.anatomyId) {
          fail(
            "invalid-presentation",
            `The related-product-card anatomy ${props.relatedCardVariant} does not match its executable presentation ${presentation.anatomyId} for ${archetype.profile.profileId}.`,
          );
        }
        if (presentation.styleOverrides) {
          dynamicProductDetailStyleOverridesSchema.parse(presentation.styleOverrides);
        }
      }
      projectSectionStyleOverrides(presentation.styleOverrides);
    }
  } catch (cause) {
    fail(
      "invalid-presentation",
      "The dynamic route archetype fails its registered component schema.",
      cause,
    );
  }
  if (
    enforceSelectedFrame &&
    snapshot.sharedFrame &&
    !isDynamicCommerceArchetypeCompatibleWithSharedFrame(archetype, snapshot.sharedFrame.profileId)
  ) {
    fail(
      "incompatible-shared-frame",
      "The dynamic route archetype is incompatible with the current frame.",
    );
  }
}

/**
 * Validates the complete compact authority against the current executable
 * PageBlueprint and component registry contracts without materializing route
 * commerce bindings.
 */
export function validateCurrentDynamicCommercePresentationAuthority(
  snapshot: StorefrontSnapshot,
): void {
  if (!snapshot.dynamicCommercePresentation) return;
  const authority = exactAuthority(snapshot);
  for (const archetype of authority.collectionSearchArchetypes) {
    assertCurrentArchetype(snapshot, archetype, false);
  }
  for (const archetype of authority.productDetailArchetypes) {
    assertCurrentArchetype(snapshot, archetype, false);
  }
  const selectedArchetypeIds = new Set([
    ...authority.collectionRouteMappings.map(({ archetypeId }) => archetypeId),
    ...authority.collectionContextRules.map(({ archetypeId }) => archetypeId),
    authority.searchArchetypeId,
    authority.fallbacks.collectionArchetypeId,
    authority.fallbacks.searchArchetypeId,
    authority.fallbacks.productDetailArchetypeId,
    ...authority.productTypeMappings.map(({ archetypeId }) => archetypeId),
    ...authority.productComplexityRules.map(({ archetypeId }) => archetypeId),
  ]);
  for (const archetypeId of selectedArchetypeIds) {
    const archetype = [
      ...authority.collectionSearchArchetypes,
      ...authority.productDetailArchetypes,
    ].find(({ id }) => id === archetypeId);
    if (!archetype) {
      fail("unknown-archetype", "The dynamic route selection references an unavailable archetype.");
    }
    assertCurrentArchetype(snapshot, archetype);
  }
}

export function exactAuthority(snapshot: StorefrontSnapshot): DynamicCommercePresentationAuthority {
  if (!snapshot.dynamicCommercePresentation) {
    return fail(
      "missing-authority",
      "This snapshot has no dynamic-commerce presentation authority.",
    );
  }
  const parsed = dynamicCommercePresentationAuthoritySchema.safeParse(
    snapshot.dynamicCommercePresentation,
  );
  if (!parsed.success)
    return fail("stale-authority", "Dynamic-commerce authority is invalid.", parsed.error);
  return migrateP10B18B03PresentationAuthority(parsed.data).authority;
}
