import {
  commercialTypographyPostures,
  componentCommercialAnatomyContractVersion,
  componentCommercialAnatomySchema,
  type ComponentCommercialAnatomy,
  type ComponentCommercialParameter,
  type ComponentDefinitionV2,
  type ComponentFamily,
  type ComponentSemanticRegion,
} from "@/domain/component-platform";

type AnatomySource = Pick<
  ComponentDefinitionV2,
  | "type"
  | "family"
  | "supportedPageTypes"
  | "variants"
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

/**
 * Adds explicit conservative P10B anatomy to a live definition. Existing variants are intentionally
 * not promoted: later family tasks must replace their classification and realized structural
 * signatures before commercial-ready queries can select them.
 */
export function createCurrentComponentCommercialAnatomy(
  definition: AnatomySource,
): ComponentCommercialAnatomy {
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
      classification: "notYetP10BCommercialReady",
      materialDifferences: [],
      finishingTokenIds: [],
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
