import {
  commercialTypographyPostures,
  componentCommercialAnatomyContractVersion,
  componentCommercialAnatomySchema,
  type ComponentCommercialAnatomy,
  type ComponentCommercialParameter,
  type ComponentDefinitionV2,
  type ComponentFamily,
  type ComponentResponsiveTransformation,
  type ComponentSemanticRegion,
  type ComponentVariantStructuralSemantics,
} from "@/domain/component-platform";

type AnatomySource = Pick<
  ComponentDefinitionV2,
  | "type"
  | "family"
  | "supportedPageTypes"
  | "variants"
  | "defaultVariant"
  | "contentSlots"
  | "commerceBindingSlots"
  | "assetSlots"
  | "editablePresentationFields"
  | "designCompatibility"
>;

const familyRegions: Readonly<Record<ComponentFamily, readonly ComponentSemanticRegion[]>> = {
  primitive: ["frame", "content"],
  pattern: ["frame", "content", "actions"],
  marketing: ["frame", "media", "content", "heading", "body", "actions"],
  navigation: ["frame", "navigation", "content", "utility", "actions"],
  commerce: [
    "frame",
    "media",
    "content",
    "heading",
    "merchandising",
    "price",
    "metadata",
    "actions",
  ],
  content: ["frame", "media", "content", "heading", "body", "actions", "continuation"],
  service: ["frame", "content", "heading", "body", "proof", "service", "actions"],
  pageBlueprint: ["frame", "navigation", "content", "continuation"],
};

function relativeFieldPath(field: AnatomySource["editablePresentationFields"][number]): string {
  const prefix = `${field.source}.`;
  return field.path.startsWith(prefix) ? field.path.slice(prefix.length) : field.path;
}

function isStructuralProp(path: string): boolean {
  return /(?:layout|columns|position|order|display|gallery|filter|card|sticky|show|count|limit)/i.test(
    path,
  );
}

function parameterId(parameter: Omit<ComponentCommercialParameter, "id">): string {
  return `${parameter.kind}.${parameter.source}.${parameter.reference.replaceAll("*", "all")}`;
}

function commercialParameters(definition: AnatomySource): ComponentCommercialParameter[] {
  const byAuthority = new Map<string, ComponentCommercialParameter>();
  for (const field of definition.editablePresentationFields) {
    const reference = relativeFieldPath(field);
    const parameter: Omit<ComponentCommercialParameter, "id"> =
      field.source === "content"
        ? { kind: "contentInput", source: "content", reference }
        : field.source === "styleOverrides"
          ? { kind: "semanticFinishing", source: "styleOverrides", reference }
          : {
              kind: isStructuralProp(reference) ? "structural" : "semanticFinishing",
              source: "props",
              reference,
            };
    byAuthority.set(`${parameter.source}:${reference}`, {
      id: parameterId(parameter),
      ...parameter,
    });
  }
  for (const slot of definition.contentSlots) {
    const parameter = {
      kind: "contentInput" as const,
      source: "content" as const,
      reference: slot.id,
    };
    byAuthority.set(`${parameter.source}:${slot.id}`, { id: parameterId(parameter), ...parameter });
  }
  for (const slot of definition.commerceBindingSlots) {
    const parameter = {
      kind: "commerceBinding" as const,
      source: "commerceBindingSlot" as const,
      reference: slot.id,
    };
    byAuthority.set(`${parameter.source}:${slot.id}`, { id: parameterId(parameter), ...parameter });
  }
  for (const slot of definition.assetSlots) {
    const parameter = {
      kind: "assetRole" as const,
      source: "assetSlot" as const,
      reference: slot.id,
    };
    byAuthority.set(`${parameter.source}:${slot.id}`, { id: parameterId(parameter), ...parameter });
  }
  return [...byAuthority.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export type RegisteredCommercialAnatomyInput = Readonly<{
  version?: ComponentCommercialAnatomy["version"];
  regions: readonly Readonly<{ id: ComponentSemanticRegion; required: boolean }>[];
  responsiveTransformations: readonly ComponentResponsiveTransformation[];
  variants: readonly ComponentVariantStructuralSemantics[];
}>;

/**
 * Materializes governed family-specific anatomy from the same V2 definition authority used by the
 * conservative registry adapter. It derives parameters, asset requirements and compatibility from
 * the live definition so a commercial family cannot create parallel or stale authority.
 */
export function createRegisteredComponentCommercialAnatomy(
  definition: AnatomySource,
  input: RegisteredCommercialAnatomyInput,
): ComponentCommercialAnatomy {
  return componentCommercialAnatomySchema.parse({
    contractVersion: componentCommercialAnatomyContractVersion,
    identity: `${definition.type}.anatomy`,
    version: input.version ?? { major: 1, minor: 1, patch: 0 },
    regions: input.regions,
    parameters: commercialParameters(definition),
    responsiveTransformations: input.responsiveTransformations,
    compatibility: {
      allowedPageTypes: [...definition.supportedPageTypes],
      narrativeRoles: [...definition.designCompatibility.allowedNarrativeRoles],
      brandPostures: [...commercialTypographyPostures],
      assetRequirements: definition.assetSlots.map((slot) => ({
        slotId: slot.id,
        acceptedRoles: [...slot.acceptedRoles],
        required: slot.required,
        minItems: slot.minItems,
        ...(slot.maxItems === undefined ? {} : { maxItems: slot.maxItems }),
      })),
      responsiveModes: [
        ...new Set(input.responsiveTransformations.map((transformation) => transformation.mode)),
      ],
    },
    variants: input.variants,
    migration: {
      policy: "compatible",
      previousVersions: [{ major: 1, minor: 0, patch: 0 }],
      migrations: [],
    },
  });
}

function sharedFrameComponentAnatomy(definition: AnatomySource): ComponentCommercialAnatomy {
  const isHeader = definition.type === "header";
  const regions: ComponentSemanticRegion[] = isHeader
    ? ["frame", "navigation", "utility", "service", "actions"]
    : ["frame", "navigation", "content", "service", "utility"];
  const transformations = isHeader
    ? [
        {
          id: "drawerNavigation",
          mode: "disclosure" as const,
          fromPresentationMode: "desktopFrame",
          toPresentationMode: "drawer",
        },
        {
          id: "stackedDisclosure",
          mode: "stack" as const,
          fromPresentationMode: "desktopFrame",
          toPresentationMode: "stackedDisclosure",
        },
        {
          id: "compactOverlay",
          mode: "switch-layout" as const,
          fromPresentationMode: "desktopFrame",
          toPresentationMode: "compactOverlay",
        },
      ]
    : [
        {
          id: "footerStack",
          mode: "stack" as const,
          fromPresentationMode: "desktopFooter",
          toPresentationMode: "mobileFooter",
        },
      ];
  const headerStructures = {
    centered: {
      regionOrder: ["frame", "navigation", "utility", "actions"],
      omittedRegions: ["service"],
      responsiveTransformationIds: ["compactOverlay"],
      presentationMode: "centeredBrandStack",
    },
    split: {
      regionOrder: ["frame", "navigation", "actions", "utility", "service"],
      omittedRegions: [],
      responsiveTransformationIds: ["stackedDisclosure"],
      presentationMode: "utilityLedGrid",
    },
    compact: {
      regionOrder: ["frame", "utility", "navigation", "actions"],
      omittedRegions: ["service"],
      responsiveTransformationIds: ["drawerNavigation"],
      presentationMode: "compactNavigationRail",
    },
    transparent: {
      regionOrder: ["frame", "navigation", "utility", "actions"],
      omittedRegions: ["service"],
      responsiveTransformationIds: ["compactOverlay"],
      presentationMode: "centeredBrandStack",
    },
    editorial: {
      regionOrder: ["service", "frame", "navigation", "utility", "actions"],
      omittedRegions: [],
      responsiveTransformationIds: ["drawerNavigation"],
      presentationMode: "brandLedMasthead",
    },
  } as const;
  const footerStructures = {
    columns: {
      regionOrder: ["frame", "content", "navigation", "service", "utility"],
      omittedRegions: [],
      presentationMode: "navigationColumns",
    },
    expanded: {
      regionOrder: ["service", "frame", "navigation", "content", "utility"],
      omittedRegions: [],
      presentationMode: "serviceNavigation",
    },
    editorial: {
      regionOrder: ["content", "frame", "navigation", "utility"],
      omittedRegions: ["service"],
      presentationMode: "brandEditorial",
    },
    compact: {
      regionOrder: ["frame", "navigation", "utility"],
      omittedRegions: ["content", "service"],
      presentationMode: "compactCommerceLegal",
    },
    dark: {
      regionOrder: ["frame", "content", "navigation", "service", "utility"],
      omittedRegions: [],
      presentationMode: "navigationColumns",
    },
  } as const;
  const structures = isHeader ? headerStructures : footerStructures;
  const defaultStructure = structures[definition.defaultVariant as keyof typeof structures];
  if (!defaultStructure) throw new Error(`Missing shared-frame anatomy for ${definition.type}.`);
  return componentCommercialAnatomySchema.parse({
    contractVersion: componentCommercialAnatomyContractVersion,
    identity: `${definition.type}.commercialSharedFrameAnatomy`,
    version: { major: 1, minor: 0, patch: 0 },
    regions: regions.map((id) => ({ id, required: id === "frame" || id === "navigation" })),
    parameters: commercialParameters(definition),
    responsiveTransformations: transformations.map((transformation) => ({
      ...transformation,
      breakpoints: ["mobile"],
      affectedRegions: isHeader ? ["navigation", "utility", "actions"] : regions,
    })),
    compatibility: {
      allowedPageTypes: [...definition.supportedPageTypes],
      narrativeRoles: [...definition.designCompatibility.allowedNarrativeRoles],
      brandPostures: [...commercialTypographyPostures],
      assetRequirements: definition.assetSlots.map((slot) => ({
        slotId: slot.id,
        acceptedRoles: [...slot.acceptedRoles],
        required: slot.required,
        minItems: slot.minItems,
        ...(slot.maxItems === undefined ? {} : { maxItems: slot.maxItems }),
      })),
      responsiveModes: isHeader ? ["disclosure", "stack", "switch-layout"] : ["stack"],
    },
    variants: definition.variants.map((variant) => {
      const structure = structures[variant.id as keyof typeof structures];
      if (!structure) throw new Error(`Missing shared-frame structure for ${variant.id}.`);
      const finishingOnly =
        (isHeader && variant.id === "transparent") || (!isHeader && variant.id === "dark");
      const materialDifferences = isHeader
        ? variant.id === "centered"
          ? ["hierarchy", "regionArrangement", "navigationModel", "presentationMode"]
          : variant.id === "split" || variant.id === "editorial"
            ? [
                "hierarchy",
                "regionArrangement",
                "regionPresence",
                "responsiveTransformation",
                "presentationMode",
              ]
            : variant.id === "compact"
              ? ["hierarchy", "regionArrangement", "responsiveTransformation", "presentationMode"]
              : []
        : variant.id === "columns"
          ? ["hierarchy", "regionArrangement", "navigationModel", "presentationMode"]
          : variant.id === "expanded"
            ? ["hierarchy", "regionArrangement", "presentationMode"]
            : variant.id === "editorial" || variant.id === "compact"
              ? ["hierarchy", "regionArrangement", "regionPresence", "presentationMode"]
              : [];
      return {
        variantId: variant.id,
        classification: finishingOnly ? "finishingOnlyVariation" : "meaningfulStructuralVariant",
        materialDifferences: finishingOnly ? [] : materialDifferences,
        finishingTokenIds: finishingOnly ? [`surface.${variant.id}`] : [],
        structure: {
          ...structure,
          assetPlacements: definition.assetSlots.map((slot) => ({
            slotId: slot.id,
            region: "frame" as const,
          })),
          contentRelationship: variant.id === "editorial" ? "contentLed" : "balanced",
          ctaRelationship: isHeader ? "separated" : "none",
          merchandisingEmphasis: "none",
          navigationModel: isHeader ? "toolbar" : "inline",
          responsiveTransformationIds:
            "responsiveTransformationIds" in structure
              ? [...structure.responsiveTransformationIds]
              : ["footerStack"],
        },
      };
    }),
    migration: { policy: "stable", previousVersions: [], migrations: [] },
  });
}

/**
 * Adds explicit conservative P10B anatomy to a live definition. Existing variants are intentionally
 * not promoted: later family tasks must replace their classification and realized structural
 * signatures before commercial-ready queries can select them.
 */
export function createCurrentComponentCommercialAnatomy(
  definition: AnatomySource,
): ComponentCommercialAnatomy {
  if (definition.type === "header" || definition.type === "footer") {
    return sharedFrameComponentAnatomy(definition);
  }
  const supersededProductCardWrapper = ["productGrid", "relatedProducts"].includes(definition.type);
  const regionOrder = [...familyRegions[definition.family]];
  const assetRegion: ComponentSemanticRegion = regionOrder.includes("media") ? "media" : "frame";
  const presentationMode = `${definition.family}Baseline`;
  return componentCommercialAnatomySchema.parse({
    contractVersion: componentCommercialAnatomyContractVersion,
    identity: `${definition.type}.anatomy`,
    version: { major: 1, minor: 0, patch: 0 },
    regions: regionOrder.map((id, index) => ({ id, required: index === 0 })),
    parameters: commercialParameters(definition),
    responsiveTransformations: [
      {
        id: "preserveRegistered",
        mode: "preserve",
        breakpoints: ["mobile", "tablet", "desktop", "wide"],
        fromPresentationMode: presentationMode,
        toPresentationMode: presentationMode,
        affectedRegions: regionOrder,
      },
    ],
    compatibility: {
      allowedPageTypes: [...definition.supportedPageTypes],
      narrativeRoles: [...definition.designCompatibility.allowedNarrativeRoles],
      brandPostures: [...commercialTypographyPostures],
      assetRequirements: definition.assetSlots.map((slot) => ({
        slotId: slot.id,
        acceptedRoles: [...slot.acceptedRoles],
        required: slot.required,
        minItems: slot.minItems,
        ...(slot.maxItems === undefined ? {} : { maxItems: slot.maxItems }),
      })),
      responsiveModes: ["preserve"],
    },
    variants: definition.variants.map((variant) => ({
      variantId: variant.id,
      classification: supersededProductCardWrapper
        ? "legacySuperseded"
        : "notYetP10BCommercialReady",
      materialDifferences: [],
      finishingTokenIds: [],
      ...(supersededProductCardWrapper ? { supersededBy: "canonicalProductCardFamily" } : {}),
      structure: {
        regionOrder,
        omittedRegions: [],
        assetPlacements: definition.assetSlots.map((slot) => ({
          slotId: slot.id,
          region: assetRegion,
        })),
        contentRelationship: "balanced",
        ctaRelationship: regionOrder.includes("actions") ? "inline" : "none",
        merchandisingEmphasis: definition.family === "commerce" ? "balanced" : "none",
        navigationModel: definition.family === "navigation" ? "inline" : "none",
        responsiveTransformationIds: ["preserveRegistered"],
        presentationMode,
      },
    })),
    migration: {
      policy: "stable",
      previousVersions: [],
      migrations: [],
    },
  });
}

export function withCurrentComponentCommercialAnatomy<T extends Record<string, unknown>>(
  input: T,
): T & { commercialAnatomy: ComponentCommercialAnatomy } {
  const definition = input as T & AnatomySource;
  return {
    ...input,
    commercialAnatomy: createCurrentComponentCommercialAnatomy(definition),
  };
}
