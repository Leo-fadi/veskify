import {
  getExecutablePageBlueprintProfile,
  runtimeComponentForPageBlueprintComponent,
  type ExecutablePageBlueprintMaterialization,
} from "@/application/storefront-templates";
import { veskifyComponentCapabilityManifest } from "@/components/registry";
import type {
  commercialDesignGrammarVersion,
  CommercialGrammarLayer,
  ComponentCapabilityManifestAuthority,
} from "@/domain/component-platform";
import {
  brandSystemSchema,
  resolveBrandSystemDesignDna,
  type BrandSystem,
  type DesignDna,
} from "@/domain/design-system";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";

export const commercialDesignGrammarKnowledgeErrorCodes = {
  staleManifest: "staleManifest",
  staleGrammar: "staleGrammar",
  staleMaterialization: "staleMaterialization",
  unknownProfile: "unknownProfile",
  unknownSlot: "unknownSlot",
  unknownComponent: "unknownComponent",
  incompatibleVariant: "incompatibleVariant",
  invalidLegacyState: "invalidLegacyState",
  invalidGrammar: "invalidGrammar",
  incompatibleGrammar: "incompatibleGrammar",
} as const;

export type CommercialDesignGrammarKnowledgeErrorCode =
  (typeof commercialDesignGrammarKnowledgeErrorCodes)[keyof typeof commercialDesignGrammarKnowledgeErrorCodes];

export class CommercialDesignGrammarKnowledgeError extends Error {
  constructor(
    readonly code: CommercialDesignGrammarKnowledgeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommercialDesignGrammarKnowledgeError";
  }
}

export type CommercialDesignGrammarReference = Readonly<{
  version: typeof commercialDesignGrammarVersion;
  fingerprint: string;
  manifestFingerprint: string;
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

function typographyPosture(brand: BrandSystem, dna: DesignDna): string {
  if (dna.typography.pairing === "serif-led") {
    return "editorial";
  }
  if (brand.voice.energy === "direct") return "technical";
  if (brand.voice.warmth === "warm") return "humanist";
  return brand.voice.positioning === "premium" ? "restrained" : "modern";
}

const legacyNarrativeRole: Readonly<Record<string, string>> = {
  orientation: "introduction",
  "primary-discovery": "merchandising",
  "secondary-discovery": "discovery",
  "product-focus": "merchandising",
  "product-proof": "proof",
  "brand-story": "editorial",
  "brand-proof": "proof",
  education: "editorial",
  campaign: "campaign",
  trust: "proof",
  service: "service",
  conversion: "conversion",
  continuation: "continuation",
};

/**
 * Deterministically adapts readable v1.3 BrandSystem and materialized PageBlueprint
 * authority into transient grammar layers. It does not persist a second token or
 * page model and never expands a legacy value beyond the registered vocabulary.
 */
export function adaptLegacyCommercialDesignGrammar(
  input: Readonly<{
    brandSystem: BrandSystem;
    materialization: ExecutablePageBlueprintMaterialization;
    slotId: string;
    instanceSelections?: Readonly<Record<string, string>>;
  }>,
): readonly CommercialGrammarLayer[] {
  const parsedBrand = brandSystemSchema.safeParse(input.brandSystem);
  if (!parsedBrand.success) {
    throw new CommercialDesignGrammarKnowledgeError(
      commercialDesignGrammarKnowledgeErrorCodes.invalidLegacyState,
      "The legacy BrandSystem cannot be adapted into current commercial grammar authority.",
    );
  }
  const slot = input.materialization.slots.find((candidate) => candidate.slotId === input.slotId);
  if (!slot) {
    throw new CommercialDesignGrammarKnowledgeError(
      commercialDesignGrammarKnowledgeErrorCodes.unknownSlot,
      `The materialized PageBlueprint has no slot ${input.slotId}.`,
    );
  }
  const brand = parsedBrand.data;
  const dna = resolveBrandSystemDesignDna(brand);
  const brandSelections: Record<string, string> = {
    "typography.posture": typographyPosture(brand, dna),
    "typography.scale": dna.typography.scale.posture,
    "typography.weight": dna.typography.weightPosture,
    "typography.tracking": dna.typography.trackingPosture,
    "typography.lineHeight": dna.typography.lineHeightPosture,
    "layout.container": dna.spacing.containers.content === "wide" ? "wide" : "content",
    "layout.pageGutter": dna.spacing.pageGutter,
    "layout.density": dna.density.posture === "balanced" ? "standard" : dna.density.posture,
    "surface.role":
      dna.surfaces.posture === "quiet"
        ? "background"
        : dna.surfaces.posture === "contrast"
          ? "contrast"
          : "surface",
    "action.hierarchy":
      dna.controls.emphasis === "restrained"
        ? "quiet"
        : dna.controls.emphasis === "strong"
          ? "primary"
          : "secondary",
    "control.posture":
      dna.controls.height === "prominent"
        ? "prominent"
        : dna.controls.height === "compact"
          ? "compact"
          : "standard",
    "shape.border": dna.surfaces.border,
    "shape.radius": dna.surfaces.radius,
    "shape.elevation": dna.surfaces.elevation,
    "media.ratio": dna.media.ratio,
    "media.crop": dna.media.crop,
    "media.focalPoint": "source",
    "media.overlay": dna.media.overlay,
    "media.emphasis": dna.media.prominence,
  };
  const pageSelections: Record<string, string> = {
    "layout.visualWeight": slot.visualWeight,
    "narrative.role": legacyNarrativeRole[slot.narrativeRole] ?? slot.narrativeRole,
    "responsive.transformation": "reflow",
  };
  const parameterMappings: Readonly<
    Record<string, Readonly<{ categoryId: string; map?: Readonly<Record<string, string>> }>>
  > = {
    contentAlignment: { categoryId: "layout.alignment" },
    density: { categoryId: "layout.density" },
    sectionWidth: {
      categoryId: "layout.container",
      map: { narrow: "reading", standard: "content", wide: "wide", full: "full" },
    },
    surfaceTreatment: {
      categoryId: "surface.role",
      map: { plain: "background", soft: "subtle", layered: "surface", contrast: "contrast" },
    },
    imageTreatment: {
      categoryId: "media.crop",
      map: { contained: "contain", crop: "cover", editorial: "editorial" },
    },
    responsiveCollapse: {
      categoryId: "responsive.transformation",
      map: { none: "preserve", stack: "stack", disclosure: "disclosure", carousel: "carousel" },
    },
  };
  for (const [parameterId, parameterValue] of Object.entries(slot.boundedParameters)) {
    const mapping = parameterMappings[parameterId];
    if (!mapping || typeof parameterValue !== "string") continue;
    pageSelections[mapping.categoryId] = mapping.map?.[parameterValue] ?? parameterValue;
  }
  const layers: CommercialGrammarLayer[] = [
    { level: "brandSystem", selections: brandSelections },
    { level: "pageBlueprint", selections: pageSelections },
    { level: "componentVariant" },
  ];
  if (input.instanceSelections) {
    layers.push({ level: "instance", selections: input.instanceSelections });
  }
  return deepFreeze(layers);
}

function assertMaterialization(
  authority: ComponentCapabilityManifestAuthority,
  materialization: ExecutablePageBlueprintMaterialization,
  slotId: string,
) {
  const currentPagePlan = getExecutablePageBlueprintProfile(materialization.profileId);
  const currentProfile = authority.getByProfileId(materialization.profileId);
  if (!currentPagePlan || !currentProfile) {
    throw new CommercialDesignGrammarKnowledgeError(
      commercialDesignGrammarKnowledgeErrorCodes.unknownProfile,
      `Unknown executable PageBlueprint profile ${materialization.profileId}.`,
    );
  }
  const content = {
    profileId: materialization.profileId,
    profileVersion: materialization.profileVersion,
    pageType: materialization.pageType,
    roleOrder: materialization.roleOrder,
    slots: materialization.slots,
    requiredBindingCategories: materialization.requiredBindingCategories,
    requiredAssetRoles: materialization.requiredAssetRoles,
    ...(materialization.commercialHomepage
      ? { commercialHomepage: materialization.commercialHomepage }
      : {}),
  };
  const expectedFingerprint = `page-blueprint-${canonicalValueFingerprint(canonicalValueString(content))}`;
  if (
    materialization.fingerprint !== expectedFingerprint ||
    materialization.profileVersion !== currentProfile.profileVersion ||
    materialization.pageType !== currentProfile.pageType ||
    canonicalValueString(materialization.roleOrder) !==
      canonicalValueString(currentProfile.orderedNarrativeRoles) ||
    canonicalValueString([...materialization.requiredBindingCategories].sort()) !==
      canonicalValueString([...currentProfile.requiredBindingCategories].sort()) ||
    canonicalValueString([...materialization.requiredAssetRoles].sort()) !==
      canonicalValueString([...currentProfile.requiredAssetRoles].sort()) ||
    canonicalValueString(materialization.commercialHomepage ?? null) !==
      canonicalValueString(currentPagePlan.profile?.commercialHomepage ?? null) ||
    materialization.slots.length !== currentProfile.componentSelections.length ||
    materialization.slots.some((candidate, index) => {
      const current = currentProfile.componentSelections[index];
      return (
        !current ||
        candidate.slotId !== current.slotId ||
        candidate.component !== current.componentType ||
        candidate.variant !== current.defaultVariant ||
        candidate.narrativeRole !== currentProfile.orderedNarrativeRoles[index]
      );
    })
  ) {
    throw new CommercialDesignGrammarKnowledgeError(
      commercialDesignGrammarKnowledgeErrorCodes.staleMaterialization,
      "The PageBlueprint materialization is stale or does not match current executable authority.",
    );
  }
  const slot = materialization.slots.find((candidate) => candidate.slotId === slotId);
  const currentSelection = currentProfile.componentSelections.find(
    (candidate) => candidate.slotId === slotId,
  );
  if (!slot || !currentSelection) {
    throw new CommercialDesignGrammarKnowledgeError(
      commercialDesignGrammarKnowledgeErrorCodes.unknownSlot,
      `The current PageBlueprint profile has no slot ${slotId}.`,
    );
  }
  if (
    slot.component !== currentSelection.componentType ||
    slot.variant !== currentSelection.defaultVariant
  ) {
    throw new CommercialDesignGrammarKnowledgeError(
      commercialDesignGrammarKnowledgeErrorCodes.staleMaterialization,
      `Slot ${slotId} no longer matches the current PageBlueprint profile.`,
    );
  }
  return slot;
}

export function createCommercialDesignGrammarKnowledge(
  authority: ComponentCapabilityManifestAuthority = veskifyComponentCapabilityManifest,
) {
  const reference: CommercialDesignGrammarReference = deepFreeze({
    version: authority.manifest.commercialDesignGrammar.version,
    fingerprint: authority.manifest.commercialDesignGrammar.fingerprint,
    manifestFingerprint: authority.manifest.fingerprint,
  });

  function assertReference(requested: CommercialDesignGrammarReference) {
    if (requested.manifestFingerprint !== reference.manifestFingerprint) {
      throw new CommercialDesignGrammarKnowledgeError(
        commercialDesignGrammarKnowledgeErrorCodes.staleManifest,
        "The commercial grammar query uses a stale capability manifest.",
      );
    }
    if (
      requested.version !== reference.version ||
      requested.fingerprint !== reference.fingerprint
    ) {
      throw new CommercialDesignGrammarKnowledgeError(
        commercialDesignGrammarKnowledgeErrorCodes.staleGrammar,
        "The commercial grammar query uses stale vocabulary authority.",
      );
    }
  }

  return deepFreeze({
    getReference: () => reference,
    listCategories: (
      input: Readonly<{ reference: CommercialDesignGrammarReference; domain?: string }>,
    ) => {
      assertReference(input.reference);
      return deepFreeze(
        authority
          .listCommercialGrammarCategories()
          .filter((entry) => input.domain === undefined || entry.domain === input.domain),
      );
    },
    resolve: (
      input: Readonly<{
        reference: CommercialDesignGrammarReference;
        layers: readonly CommercialGrammarLayer[];
      }>,
    ) => {
      assertReference(input.reference);
      const resolution = authority.resolveCommercialGrammar(input.layers);
      if (resolution.issues.length > 0) {
        throw new CommercialDesignGrammarKnowledgeError(
          commercialDesignGrammarKnowledgeErrorCodes.invalidGrammar,
          `Commercial grammar resolution failed: ${resolution.issues.map((issue) => `${issue.code}:${issue.categoryId ?? issue.ruleId ?? "authority"}`).join(", ")}.`,
        );
      }
      return resolution;
    },
    resolveMaterializedSlot: (
      input: Readonly<{
        reference: CommercialDesignGrammarReference;
        brandSystem: BrandSystem;
        materialization: ExecutablePageBlueprintMaterialization;
        slotId: string;
        instanceSelections?: Readonly<Record<string, string>>;
        assetRoles?: readonly string[];
        mediaRequirements?: readonly string[];
      }>,
    ) => {
      assertReference(input.reference);
      const slot = assertMaterialization(authority, input.materialization, input.slotId);
      const runtimeComponentType = runtimeComponentForPageBlueprintComponent(
        slot.component,
        input.materialization.pageType,
      );
      const component = authority.getByComponentType(runtimeComponentType);
      if (!component) {
        throw new CommercialDesignGrammarKnowledgeError(
          commercialDesignGrammarKnowledgeErrorCodes.unknownComponent,
          `The materialized slot has no registered runtime component ${runtimeComponentType}.`,
        );
      }
      if (
        runtimeComponentType === slot.component &&
        !component.variants.some((variant) => variant.id === slot.variant)
      ) {
        throw new CommercialDesignGrammarKnowledgeError(
          commercialDesignGrammarKnowledgeErrorCodes.incompatibleVariant,
          `Variant ${slot.variant} is not registered for ${runtimeComponentType}.`,
        );
      }
      const layers = adaptLegacyCommercialDesignGrammar({
        brandSystem: input.brandSystem,
        materialization: input.materialization,
        slotId: input.slotId,
        ...(input.instanceSelections === undefined
          ? {}
          : { instanceSelections: input.instanceSelections }),
      });
      const resolution = authority.resolveCommercialGrammar(layers);
      if (resolution.issues.length > 0) {
        throw new CommercialDesignGrammarKnowledgeError(
          commercialDesignGrammarKnowledgeErrorCodes.invalidGrammar,
          `The materialized slot fails commercial grammar inheritance: ${resolution.issues.map((issue) => `${issue.code}:${issue.categoryId ?? issue.ruleId ?? "authority"}`).join(", ")}.`,
        );
      }
      const compatibilityIssues = authority.evaluateCommercialGrammarCompatibility({
        values: resolution.values,
        profileId: input.materialization.profileId,
        componentFamily: component.family,
        componentType: runtimeComponentType,
        ...(runtimeComponentType === slot.component ? { variant: slot.variant } : {}),
        responsiveMode: resolution.values["responsive.transformation"],
        narrativeRole: resolution.values["narrative.role"],
        assetRoles: input.assetRoles,
        mediaRequirements: input.mediaRequirements,
      });
      if (compatibilityIssues.length > 0) {
        throw new CommercialDesignGrammarKnowledgeError(
          commercialDesignGrammarKnowledgeErrorCodes.incompatibleGrammar,
          `The materialized slot fails commercial compatibility: ${compatibilityIssues.map((issue) => issue.code).join(", ")}.`,
        );
      }
      return deepFreeze({
        reference,
        profileId: input.materialization.profileId,
        materializationFingerprint: input.materialization.fingerprint,
        pageBlueprintSelection: {
          slotId: slot.slotId,
          componentType: slot.component,
          variant: slot.variant,
        },
        componentCapability: {
          componentType: runtimeComponentType,
          ...(runtimeComponentType === slot.component ? { variant: slot.variant } : {}),
        },
        grammar: resolution,
      });
    },
  });
}

export const commercialDesignGrammarKnowledge = createCommercialDesignGrammarKnowledge();
