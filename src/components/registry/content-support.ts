import { z } from "zod";
import {
  createComponentRegistryV2,
  validateComponentDefinitionV2,
  type ComponentDefinitionV2,
  type ComponentInstanceV2,
  type ComponentInstanceValidationContracts,
  type ComponentProjectionContext,
  type ComponentVariantStructuralSemantics,
} from "@/domain/component-platform";
import { idSchema } from "@/domain/shared";
import {
  createRegisteredComponentCommercialAnatomy,
  type RegisteredCommercialAnatomyInput,
} from "./commercial-anatomy";

export const contentSupportVariantSchema = z.enum([
  "aboutStory",
  "aboutProcess",
  "contactChannels",
  "contactDirectory",
  "locationDirectory",
  "locationAppointments",
  "faqDisclosure",
  "faqTopicGuide",
  "serviceDetails",
  "policyReading",
  "genericReading",
  "genericEditorial",
  "campaignEditorial",
  "campaignImageLed",
  "campaignStory",
]);

export const contentSupportContentSchema = z.object({ factDocumentId: idSchema }).strict();

export const contentSupportPropsSchema = z
  .object({
    readingWidth: z.enum(["narrow", "standard", "wide"]),
    textAlignment: z.enum(["left", "center"]),
  })
  .strict();

export const contentSupportStyleOverridesSchema = z
  .object({ surface: z.enum(["default", "surface", "primary", "secondary", "accent"]) })
  .strict();

export const contentSupportDefaultContent = contentSupportContentSchema.parse({
  factDocumentId: "evidence_content_support",
});
export const contentSupportDefaultProps = contentSupportPropsSchema.parse({
  readingWidth: "standard",
  textAlignment: "left",
});
export const contentSupportDefaultStyleOverrides = contentSupportStyleOverridesSchema.parse({
  surface: "default",
});

const responsiveRules = [
  {
    breakpoints: ["mobile", "tablet", "desktop", "wide"],
    allowHorizontalOverflow: false,
    maxColumns: 3,
    notes: {
      en: "Content and support structures reflow at 375, 768, 1024 and 1440 pixels while retaining semantic reading order.",
      fi: "Sisältö- ja tukirakenteet mukautuvat 375, 768, 1024 ja 1440 pikselissä säilyttäen semanttisen lukujärjestyksen.",
    },
  },
] as const;

const commonStructure: ComponentVariantStructuralSemantics["structure"] = {
  regionOrder: ["frame", "content", "heading", "body", "actions"],
  omittedRegions: ["media", "continuation"],
  assetPlacements: [],
  contentRelationship: "contentLed",
  ctaRelationship: "none",
  merchandisingEmphasis: "none",
  navigationModel: "none",
  responsiveTransformationIds: ["contentStack"],
  presentationMode: "contentReading",
};

const contentSupportDefinitionInput = {
  type: "contentSupport",
  version: { major: 2, minor: 0, patch: 0 },
  title: { en: "Content and support", fi: "Sisältö ja tuki" },
  merchantDescription: {
    en: "Renders only fact documents resolved from the current approved design brief.",
    fi: "Renderöi vain nykyisestä hyväksytystä suunnittelubriefistä ratkaistuja faktadokumentteja.",
  },
  family: "content",
  supportedPageTypes: ["content", "landing"],
  variants: [
    ["aboutStory", "About story"],
    ["aboutProcess", "About process"],
    ["contactChannels", "Contact channels"],
    ["contactDirectory", "Contact directory"],
    ["locationDirectory", "Location directory"],
    ["locationAppointments", "Location appointments"],
    ["faqDisclosure", "FAQ disclosure"],
    ["faqTopicGuide", "FAQ topic guide"],
    ["serviceDetails", "Service details"],
    ["policyReading", "Policy reading"],
    ["genericReading", "Generic reading"],
    ["genericEditorial", "Generic editorial"],
    ["campaignEditorial", "Campaign editorial"],
    ["campaignImageLed", "Campaign image led"],
    ["campaignStory", "Campaign story"],
  ].map(([id, title]) => ({ id, title: { en: title, fi: title } })),
  defaultVariant: "genericReading",
  industryTags: [],
  contentSchema: z.toJSONSchema(contentSupportContentSchema),
  propsSchema: z.toJSONSchema(contentSupportPropsSchema),
  styleOverridesSchema: z.toJSONSchema(contentSupportStyleOverridesSchema),
  contentSlots: [
    {
      id: "factDocumentId",
      title: { en: "Approved fact document", fi: "Hyväksytty faktadokumentti" },
      localized: false,
      required: true,
    },
  ],
  commerceBindingSlots: [
    {
      id: "supportFacts",
      title: { en: "Approved support facts", fi: "Hyväksytyt tukifaktat" },
      acceptedSourceTypes: ["localizedContent"],
      required: true,
      revisionRequired: true,
      emptyState: "message",
    },
  ],
  assetSlots: [
    {
      id: "contentSupportMedia",
      title: { en: "Approved editorial media", fi: "Hyväksytty toimituksellinen media" },
      acceptedRoles: ["editorialImage"],
      required: false,
      minItems: 0,
      maxItems: 1,
    },
  ],
  editablePresentationFields: [
    {
      path: "props.readingWidth",
      label: { en: "Reading width", fi: "Lukuleveys" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "props.textAlignment",
      label: { en: "Text alignment", fi: "Tekstin tasaus" },
      source: "props",
      control: "select",
      localized: false,
    },
    {
      path: "styleOverrides.surface",
      label: { en: "Surface", fi: "Pinta" },
      source: "styleOverrides",
      control: "select",
      localized: false,
    },
  ],
  protectedFields: {
    readOnlyPaths: ["bindings.supportFacts", "assets.*.provenance"],
  },
  responsiveRules,
  accessibilityRequirements: {
    keyboard:
      "FAQ disclosures use native summary controls and all visible actions remain keyboard operable.",
    semantics:
      "Content uses labelled sections, headings, articles, lists and native details where appropriate.",
    labels:
      "Contact, location, FAQ and policy structures retain localized labels from approved evidence.",
    focus: "Interactive disclosure controls retain visible focus and usable touch targets.",
    contrast:
      "The renderer consumes validated storefront design tokens for text and surface contrast.",
  },
  designCompatibility: {
    allowedNarrativeRoles: ["brand-story", "education", "campaign", "service", "continuation"],
    allowedVisualWeights: ["light", "medium", "heavy"],
    allowedTransitionIntents: ["continuation", "contrast", "clarification", "reset"],
    boundedParameterIds: [
      "layoutModel",
      "sectionWidth",
      "responsiveCollapse",
      "surfaceTreatment",
      "visualWeight",
      "typographyRole",
      "spacingScale",
    ],
    blueprintProfilePolicy: "anyRegistered",
    compatibleBlueprintProfileIds: [],
    commerceRequirements: ["none"],
  },
  migration: { policy: "stable", previousVersions: [], migrations: [] },
  renderer: {
    adapterId: "veskifyContentSupportRenderer",
    exportName: "ContentSupportSection",
    supportedTargets: ["editor", "preview", "published"],
  },
} as const;

const contentSupportCommercialAnatomy: RegisteredCommercialAnatomyInput = {
  regions: [
    { id: "frame", required: true },
    { id: "content", required: true },
    { id: "heading", required: true },
    { id: "body", required: true },
    { id: "service", required: false },
    { id: "proof", required: false },
    { id: "actions", required: false },
    { id: "media", required: false },
    { id: "continuation", required: false },
  ],
  responsiveTransformations: [
    {
      id: "contentStack",
      mode: "stack",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "contentColumns",
      toPresentationMode: "contentStacked",
      affectedRegions: ["content", "service", "proof", "actions"],
    },
    {
      id: "contactCondense",
      mode: "condense",
      breakpoints: ["mobile"],
      fromPresentationMode: "contactDirectory",
      toPresentationMode: "contactDisclosure",
      affectedRegions: ["service", "content", "actions"],
    },
    {
      id: "faqDisclosureStack",
      mode: "disclosure",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "faqTopicGuide",
      toPresentationMode: "faqDisclosure",
      affectedRegions: ["proof", "content"],
    },
    {
      id: "campaignReadingReflow",
      mode: "reflow",
      breakpoints: ["mobile", "tablet"],
      fromPresentationMode: "campaignImageLed",
      toPresentationMode: "campaignReading",
      affectedRegions: ["media", "content", "actions"],
    },
  ],
  variants: [
    {
      variantId: "aboutStory",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionPresence", "assetPlacement", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "content", "heading", "body", "media", "actions"],
        omittedRegions: ["continuation"],
        assetPlacements: [{ slotId: "contentSupportMedia", region: "media" }],
        contentRelationship: "balanced",
        presentationMode: "aboutStory",
      },
    },
    {
      variantId: "aboutProcess",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionArrangement", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "content", "heading", "body", "service"],
        omittedRegions: ["media", "proof", "actions", "continuation"],
        presentationMode: "aboutProcess",
      },
    },
    {
      variantId: "contactChannels",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionPresence", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "content", "heading", "service", "body"],
        omittedRegions: ["media", "proof", "actions", "continuation"],
        presentationMode: "contactChannels",
      },
    },
    {
      variantId: "contactDirectory",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionArrangement", "responsiveTransformation", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "heading", "content", "service", "body"],
        omittedRegions: ["media", "proof", "actions", "continuation"],
        responsiveTransformationIds: ["contactCondense"],
        presentationMode: "contactDirectory",
      },
    },
    {
      variantId: "locationDirectory",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionPresence", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "heading", "service", "content", "body"],
        omittedRegions: ["media", "proof", "actions", "continuation"],
        presentationMode: "locationDirectory",
      },
    },
    {
      variantId: "locationAppointments",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionArrangement", "ctaRelationship", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "content", "heading", "body", "service", "actions"],
        omittedRegions: ["media", "proof", "continuation"],
        ctaRelationship: "separated",
        presentationMode: "locationAppointments",
      },
    },
    {
      variantId: "faqDisclosure",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionPresence", "navigationModel", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "heading", "content", "proof", "body"],
        omittedRegions: ["media", "service", "actions", "continuation"],
        navigationModel: "disclosure",
        presentationMode: "faqDisclosure",
      },
    },
    {
      variantId: "faqTopicGuide",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionArrangement", "responsiveTransformation", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "content", "heading", "proof", "body"],
        omittedRegions: ["media", "service", "actions", "continuation"],
        responsiveTransformationIds: ["faqDisclosureStack"],
        presentationMode: "faqTopicGuide",
      },
    },
    {
      variantId: "serviceDetails",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionPresence", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "heading", "content", "body", "service"],
        omittedRegions: ["media", "proof", "actions", "continuation"],
        presentationMode: "serviceDetails",
      },
    },
    {
      variantId: "policyReading",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionArrangement", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "heading", "content", "body", "service"],
        omittedRegions: ["media", "proof", "actions", "continuation"],
        presentationMode: "policyReading",
      },
    },
    {
      variantId: "genericReading",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["presentationMode"],
      finishingTokenIds: [],
      structure: { ...commonStructure, presentationMode: "genericReading" },
    },
    {
      variantId: "genericEditorial",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionArrangement", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "content", "heading", "body", "continuation"],
        omittedRegions: ["media", "proof", "service", "actions"],
        presentationMode: "genericEditorial",
      },
    },
    {
      variantId: "campaignEditorial",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["ctaRelationship", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "content", "heading", "body", "actions"],
        omittedRegions: ["media", "proof", "service", "continuation"],
        ctaRelationship: "inline",
        presentationMode: "campaignEditorial",
      },
    },
    {
      variantId: "campaignImageLed",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionPresence", "responsiveTransformation", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "media", "content", "heading", "body", "actions"],
        omittedRegions: ["proof", "service", "continuation"],
        contentRelationship: "mediaLed",
        ctaRelationship: "separated",
        responsiveTransformationIds: ["campaignReadingReflow"],
        presentationMode: "campaignImageLed",
      },
    },
    {
      variantId: "campaignStory",
      classification: "meaningfulStructuralVariant",
      materialDifferences: ["regionArrangement", "presentationMode"],
      finishingTokenIds: [],
      structure: {
        ...commonStructure,
        regionOrder: ["frame", "heading", "content", "body", "continuation"],
        omittedRegions: ["media", "proof", "service", "actions"],
        contentRelationship: "supporting",
        presentationMode: "campaignStory",
      },
    },
  ],
};

export const contentSupportDefinition: ComponentDefinitionV2 = validateComponentDefinitionV2({
  ...contentSupportDefinitionInput,
  commercialAnatomy: createRegisteredComponentCommercialAnatomy(
    contentSupportDefinitionInput as unknown as Parameters<
      typeof createRegisteredComponentCommercialAnatomy
    >[0],
    contentSupportCommercialAnatomy,
  ),
});

function validateContentSupportInstance(instance: ComponentInstanceV2) {
  if (instance.component !== "contentSupport") return;
  const content = contentSupportContentSchema.parse(instance.content);
  const factBinding = instance.bindings.find((binding) => binding.slotId === "supportFacts");
  if (
    factBinding?.source !== "localizedContent" ||
    factBinding.contentId !== content.factDocumentId
  ) {
    throw new Error("Content/support components must bind their exact approved fact document.");
  }
}

function validateContentSupportConformance(
  instance: ComponentInstanceV2,
  projection: ComponentProjectionContext,
) {
  if (instance.component !== "contentSupport") return;
  const content = contentSupportContentSchema.parse(instance.content);
  const reference = projection.localizedContents.find(
    (candidate) => candidate.contentId === content.factDocumentId,
  );
  if (!reference) throw new Error("Content/support facts are missing from the current projection.");
}

export const contentSupportInstanceValidationContracts: ComponentInstanceValidationContracts = {
  contentSupport: {
    validateInstance: validateContentSupportInstance,
    validateConformance: validateContentSupportConformance,
  },
};

export const contentSupportRegistryV2 = createComponentRegistryV2(
  [contentSupportDefinition],
  contentSupportInstanceValidationContracts,
);

export type ContentSupportContent = z.infer<typeof contentSupportContentSchema>;
export type ContentSupportProps = z.infer<typeof contentSupportPropsSchema>;
export type ContentSupportStyleOverrides = z.infer<typeof contentSupportStyleOverridesSchema>;
export type ContentSupportVariant = z.infer<typeof contentSupportVariantSchema>;
