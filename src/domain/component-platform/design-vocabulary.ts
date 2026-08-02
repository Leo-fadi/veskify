import { z } from "zod";
import { pageTypeSchema } from "@/domain/storefront";

const designTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][A-Za-z0-9]*(?:[._-][a-z][A-Za-z0-9]*)*$/);

export const narrativeRoleIds = [
  "orientation",
  "primary-discovery",
  "secondary-discovery",
  "product-focus",
  "product-proof",
  "brand-story",
  "brand-proof",
  "education",
  "campaign",
  "trust",
  "service",
  "conversion",
  "continuation",
] as const;

export const narrativeRoleSchema = z.enum(narrativeRoleIds);
export const visualWeightSchema = z.enum(["light", "medium", "heavy", "dominant"]);
export const transitionIntentSchema = z.enum([
  "continuation",
  "contrast",
  "escalation",
  "proof",
  "clarification",
  "conversion",
  "reset",
]);
export const parameterCategorySchema = z.enum(["structural", "visual"]);
export const parameterAuthorityLevelSchema = z.enum([
  "brandSystem",
  "pageBlueprint",
  "componentVariant",
  "instance",
]);

export const narrativeFlowRuleTypeSchema = z.enum([
  "preferredAdjacency",
  "requiredAdjacency",
  "prohibitedAdjacency",
  "roleOrder",
  "openingRole",
  "closingRole",
  "visualWeightTransition",
  "commercePlacement",
]);

export const narrativeFlowRuleSchema = z
  .object({
    id: designTokenSchema,
    type: narrativeFlowRuleTypeSchema,
    pageTypes: z.array(pageTypeSchema).min(1),
    fromRole: narrativeRoleSchema.optional(),
    toRole: narrativeRoleSchema.optional(),
    allowedVisualWeightTransitions: z
      .array(z.tuple([visualWeightSchema, visualWeightSchema]))
      .default([]),
    transitionIntents: z.array(transitionIntentSchema).default([]),
    message: z.string().trim().min(1).max(240),
  })
  .strict()
  .superRefine((rule, context) => {
    if (
      [
        "preferredAdjacency",
        "requiredAdjacency",
        "prohibitedAdjacency",
        "roleOrder",
        "commercePlacement",
      ].includes(rule.type) &&
      (rule.fromRole === undefined || rule.toRole === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: `${rule.type} rules require fromRole and toRole.`,
      });
    }
    if (["openingRole", "closingRole"].includes(rule.type) && rule.fromRole === undefined) {
      context.addIssue({
        code: "custom",
        message: `${rule.type} rules require fromRole.`,
      });
    }
    if (
      rule.type === "visualWeightTransition" &&
      rule.allowedVisualWeightTransitions.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "visualWeightTransition rules require allowed visual-weight transitions.",
      });
    }
  });

export type NarrativeFlowRule = z.infer<typeof narrativeFlowRuleSchema>;

export const narrativeFlowRules: readonly NarrativeFlowRule[] = [
  {
    id: "orientation-opens-page",
    type: "openingRole",
    pageTypes: ["home", "collection", "product"],
    fromRole: "orientation",
    message: "A page must open with orientation when this flow rule is selected.",
  },
  {
    id: "service-closes-page",
    type: "closingRole",
    pageTypes: ["home", "collection", "product"],
    fromRole: "service",
    message: "A page must close with service when this flow rule is selected.",
  },
  {
    id: "discovery-follows-orientation",
    type: "preferredAdjacency",
    pageTypes: ["home", "collection"],
    fromRole: "orientation",
    toRole: "primary-discovery",
    message: "Primary product discovery normally follows orientation.",
  },
  {
    id: "collection-discovery-before-results",
    type: "roleOrder",
    pageTypes: ["collection"],
    fromRole: "secondary-discovery",
    toRole: "primary-discovery",
    message: "Collection discovery must precede primary collection results.",
  },
  {
    id: "trust-cannot-directly-precede-discovery",
    type: "prohibitedAdjacency",
    pageTypes: ["home", "collection"],
    fromRole: "trust",
    toRole: "primary-discovery",
    message: "Trust content cannot directly precede primary product discovery.",
  },
  {
    id: "orientation-to-discovery-transition",
    type: "requiredAdjacency",
    pageTypes: ["home"],
    fromRole: "orientation",
    toRole: "primary-discovery",
    transitionIntents: ["continuation", "escalation", "contrast"],
    message: "Orientation must lead into product discovery with a registered transition intent.",
  },
  {
    id: "pdp-product-focus-before-conversion",
    type: "commercePlacement",
    pageTypes: ["product"],
    fromRole: "product-focus",
    toRole: "conversion",
    message: "Protected product context must precede conversion controls.",
  },
  {
    id: "no-adjacent-dominant-sections",
    type: "visualWeightTransition",
    pageTypes: ["home", "collection", "product"],
    allowedVisualWeightTransitions: [
      ["light", "light"],
      ["light", "medium"],
      ["light", "heavy"],
      ["light", "dominant"],
      ["medium", "light"],
      ["medium", "medium"],
      ["medium", "heavy"],
      ["medium", "dominant"],
      ["heavy", "light"],
      ["heavy", "medium"],
      ["heavy", "heavy"],
      ["heavy", "dominant"],
      ["dominant", "light"],
      ["dominant", "medium"],
      ["dominant", "heavy"],
    ],
    message: "Two dominant sections cannot be adjacent.",
  },
].map((rule) => narrativeFlowRuleSchema.parse(rule));

export const narrativeFlowRulesById = new Map(narrativeFlowRules.map((rule) => [rule.id, rule]));

export const narrativeRoleDefinitionSchema = z
  .object({
    id: narrativeRoleSchema,
    allowedPageTypes: z.array(pageTypeSchema).min(1),
    visualWeights: z.array(visualWeightSchema).min(1),
    commercialPriority: z.enum(["supporting", "standard", "primary"]),
    requiredCapabilities: z.array(designTokenSchema).default([]),
    preferredPredecessors: z.array(narrativeRoleSchema).default([]),
    preferredSuccessors: z.array(narrativeRoleSchema).default([]),
    prohibitedPredecessors: z.array(narrativeRoleSchema).default([]),
    prohibitedSuccessors: z.array(narrativeRoleSchema).default([]),
    minOccurrences: z.number().int().nonnegative().default(0),
    maxOccurrences: z.number().int().positive().default(1),
    repetitionAllowed: z.boolean().default(false),
    mayOpenPage: z.boolean().default(false),
    mayClosePage: z.boolean().default(false),
    compatibleComponentFamilies: z.array(designTokenSchema).min(1),
    commerceRequirement: z.enum(["none", "canonical-binding", "protected-product-context"]),
    accessibilityRequirement: z.enum(["standard", "landmark", "interactive", "purchase-control"]),
  })
  .strict()
  .superRefine((role, context) => {
    if (role.maxOccurrences < role.minOccurrences) {
      context.addIssue({
        code: "custom",
        path: ["maxOccurrences"],
        message: "Narrative-role maxOccurrences cannot be lower than minOccurrences.",
      });
    }
  });

export type NarrativeRoleDefinition = z.infer<typeof narrativeRoleDefinitionSchema>;

const roles = (
  id: z.infer<typeof narrativeRoleSchema>,
  input: Omit<z.input<typeof narrativeRoleDefinitionSchema>, "id">,
): NarrativeRoleDefinition => narrativeRoleDefinitionSchema.parse({ id, ...input });

const allPages: Array<z.infer<typeof pageTypeSchema>> = ["home", "collection", "product"];
const allWeights: Array<z.infer<typeof visualWeightSchema>> = [
  "light",
  "medium",
  "heavy",
  "dominant",
];
const commonFamilies: string[] = ["marketing", "content", "commerce", "navigation", "service"];

export const narrativeRoleDefinitions = [
  roles("orientation", {
    allowedPageTypes: allPages,
    visualWeights: ["light", "medium", "heavy", "dominant"],
    commercialPriority: "primary",
    preferredSuccessors: ["primary-discovery", "secondary-discovery", "product-focus"],
    maxOccurrences: 2,
    repetitionAllowed: true,
    mayOpenPage: true,
    compatibleComponentFamilies: commonFamilies,
    commerceRequirement: "none",
    accessibilityRequirement: "landmark",
  }),
  roles("primary-discovery", {
    allowedPageTypes: ["home", "collection"],
    visualWeights: ["medium", "heavy", "dominant"],
    commercialPriority: "primary",
    preferredPredecessors: ["orientation", "secondary-discovery"],
    maxOccurrences: 2,
    repetitionAllowed: true,
    compatibleComponentFamilies: ["commerce", "marketing", "content"],
    commerceRequirement: "canonical-binding",
    accessibilityRequirement: "interactive",
  }),
  roles("secondary-discovery", {
    allowedPageTypes: ["home", "collection"],
    visualWeights: ["light", "medium", "heavy"],
    commercialPriority: "standard",
    preferredSuccessors: ["primary-discovery"],
    maxOccurrences: 2,
    repetitionAllowed: true,
    compatibleComponentFamilies: ["commerce", "marketing", "content"],
    commerceRequirement: "canonical-binding",
    accessibilityRequirement: "interactive",
  }),
  roles("product-focus", {
    allowedPageTypes: ["home", "product"],
    visualWeights: ["heavy", "dominant"],
    commercialPriority: "primary",
    preferredSuccessors: ["product-proof", "conversion"],
    maxOccurrences: 2,
    repetitionAllowed: true,
    compatibleComponentFamilies: ["commerce", "marketing", "content"],
    commerceRequirement: "protected-product-context",
    accessibilityRequirement: "landmark",
  }),
  roles("product-proof", {
    allowedPageTypes: ["home", "product"],
    visualWeights: ["light", "medium", "heavy"],
    commercialPriority: "standard",
    preferredPredecessors: ["product-focus"],
    maxOccurrences: 2,
    repetitionAllowed: true,
    compatibleComponentFamilies: ["commerce", "content", "service"],
    commerceRequirement: "protected-product-context",
    accessibilityRequirement: "standard",
  }),
  roles("brand-story", {
    allowedPageTypes: ["home", "collection", "product"],
    visualWeights: ["medium", "heavy"],
    commercialPriority: "supporting",
    maxOccurrences: 1,
    compatibleComponentFamilies: ["marketing", "content"],
    commerceRequirement: "none",
    accessibilityRequirement: "standard",
  }),
  roles("brand-proof", {
    allowedPageTypes: allPages,
    visualWeights: ["light", "medium"],
    commercialPriority: "supporting",
    preferredSuccessors: ["product-proof", "conversion"],
    maxOccurrences: 2,
    repetitionAllowed: true,
    compatibleComponentFamilies: ["content", "service", "marketing"],
    commerceRequirement: "none",
    accessibilityRequirement: "standard",
  }),
  roles("education", {
    allowedPageTypes: allPages,
    visualWeights: ["light", "medium", "heavy"],
    commercialPriority: "supporting",
    maxOccurrences: 2,
    repetitionAllowed: true,
    compatibleComponentFamilies: ["content", "marketing", "commerce"],
    commerceRequirement: "none",
    accessibilityRequirement: "standard",
  }),
  roles("campaign", {
    allowedPageTypes: ["home", "collection"],
    visualWeights: ["medium", "heavy", "dominant"],
    commercialPriority: "standard",
    maxOccurrences: 1,
    compatibleComponentFamilies: ["marketing", "content"],
    commerceRequirement: "none",
    accessibilityRequirement: "standard",
  }),
  roles("trust", {
    allowedPageTypes: allPages,
    visualWeights: ["light", "medium"],
    commercialPriority: "supporting",
    maxOccurrences: 2,
    repetitionAllowed: true,
    compatibleComponentFamilies: ["service", "content", "marketing"],
    commerceRequirement: "none",
    accessibilityRequirement: "standard",
  }),
  roles("service", {
    allowedPageTypes: allPages,
    visualWeights: ["light", "medium"],
    commercialPriority: "supporting",
    maxOccurrences: 2,
    repetitionAllowed: true,
    mayClosePage: true,
    compatibleComponentFamilies: ["service", "navigation", "content"],
    commerceRequirement: "none",
    accessibilityRequirement: "landmark",
  }),
  roles("conversion", {
    allowedPageTypes: ["home", "product"],
    visualWeights: ["medium", "heavy"],
    commercialPriority: "primary",
    preferredPredecessors: ["product-focus", "product-proof", "brand-proof"],
    maxOccurrences: 2,
    repetitionAllowed: true,
    compatibleComponentFamilies: ["commerce", "marketing", "content"],
    commerceRequirement: "protected-product-context",
    accessibilityRequirement: "purchase-control",
  }),
  roles("continuation", {
    allowedPageTypes: allPages,
    visualWeights: ["light", "medium"],
    commercialPriority: "supporting",
    maxOccurrences: 2,
    repetitionAllowed: true,
    mayClosePage: true,
    compatibleComponentFamilies: ["navigation", "content", "service", "commerce"],
    commerceRequirement: "none",
    accessibilityRequirement: "landmark",
  }),
] as const satisfies readonly NarrativeRoleDefinition[];

export const narrativeRolesById = new Map(
  narrativeRoleDefinitions.map((definition) => [definition.id, definition]),
);

export const parameterValueSchema = z.union([z.string().trim().min(1), z.number().finite()]);
export const parameterConstraintSchema = z
  .object({
    parameterId: designTokenSchema,
    allowedValues: z.array(parameterValueSchema).min(1).optional(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
  })
  .strict()
  .superRefine((constraint, context) => {
    if (
      constraint.allowedValues === undefined &&
      constraint.minimum === undefined &&
      constraint.maximum === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "A bounded parameter constraint must narrow values or a numeric range.",
      });
    }
    if (
      constraint.minimum !== undefined &&
      constraint.maximum !== undefined &&
      constraint.minimum > constraint.maximum
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "A bounded parameter maximum cannot be below its minimum.",
      });
    }
  });

export const boundedParameterDefinitionSchema = z
  .object({
    id: designTokenSchema,
    category: parameterCategorySchema,
    allowedValues: z.array(parameterValueSchema).min(1).optional(),
    numericRange: z
      .object({ minimum: z.number().finite(), maximum: z.number().finite() })
      .strict()
      .optional(),
    defaultValue: parameterValueSchema,
    compatibleComponentFamilies: z.array(designTokenSchema).min(1),
    compatibleVariants: z.array(designTokenSchema).default([]),
    compatiblePageTypes: z.array(pageTypeSchema).min(1),
    affectsResponsiveBehavior: z.boolean().default(false),
    incompatibleWith: z.array(designTokenSchema).default([]),
    authority: z
      .object({
        defaultLevels: z.array(parameterAuthorityLevelSchema).min(1),
        narrowingLevels: z.array(parameterAuthorityLevelSchema).min(1),
        overrideLevels: z.array(parameterAuthorityLevelSchema).min(1),
        instanceOverrideAllowed: z.boolean(),
      })
      .strict(),
    validationCode: designTokenSchema,
  })
  .strict()
  .superRefine((definition, context) => {
    if ((definition.allowedValues === undefined) === (definition.numericRange === undefined)) {
      context.addIssue({
        code: "custom",
        message: "A parameter must declare either enum values or one numeric range.",
      });
      return;
    }
    if (
      definition.numericRange &&
      definition.numericRange.minimum > definition.numericRange.maximum
    ) {
      context.addIssue({
        code: "custom",
        path: ["numericRange", "maximum"],
        message: "A parameter numeric maximum cannot be below its minimum.",
      });
    }
  });

export type BoundedParameterDefinition = z.infer<typeof boundedParameterDefinitionSchema>;

const enumParameter = (
  id: string,
  category: z.infer<typeof parameterCategorySchema>,
  allowedValues: readonly string[],
  defaultValue: string,
  compatibleComponentFamilies: readonly string[],
  options: Partial<BoundedParameterDefinition> = {},
): BoundedParameterDefinition =>
  boundedParameterDefinitionSchema.parse({
    id,
    category,
    allowedValues: [...allowedValues],
    defaultValue,
    compatibleComponentFamilies: [...compatibleComponentFamilies],
    compatiblePageTypes: [...allPages],
    affectsResponsiveBehavior: false,
    incompatibleWith: [],
    authority: {
      defaultLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
      narrowingLevels: ["pageBlueprint", "componentVariant", "instance"],
      overrideLevels: ["pageBlueprint", "componentVariant", "instance"],
      instanceOverrideAllowed: true,
    },
    validationCode: `invalid-${id}`,
    ...options,
  });

export const boundedParameterDefinitions = [
  enumParameter(
    "layoutModel",
    "structural",
    ["singleColumn", "split", "asymmetric", "grid", "sidebar", "horizontal", "stacked"],
    "singleColumn",
    commonFamilies,
    {
      authority: {
        defaultLevels: ["pageBlueprint", "componentVariant"],
        narrowingLevels: ["pageBlueprint", "componentVariant", "instance"],
        overrideLevels: ["pageBlueprint", "componentVariant"],
        instanceOverrideAllowed: false,
      },
      affectsResponsiveBehavior: true,
    },
  ),
  enumParameter(
    "sectionOrder",
    "structural",
    ["registered", "permittedReorder"],
    "registered",
    commonFamilies,
    {
      authority: {
        defaultLevels: ["pageBlueprint"],
        narrowingLevels: ["pageBlueprint"],
        overrideLevels: ["pageBlueprint"],
        instanceOverrideAllowed: false,
      },
    },
  ),
  boundedParameterDefinitionSchema.parse({
    id: "columnCount",
    category: "structural",
    numericRange: { minimum: 1, maximum: 4 },
    defaultValue: 1,
    compatibleComponentFamilies: ["commerce", "marketing", "content"],
    compatiblePageTypes: ["home", "collection", "product"],
    affectsResponsiveBehavior: true,
    incompatibleWith: [],
    authority: {
      defaultLevels: ["pageBlueprint", "componentVariant"],
      narrowingLevels: ["pageBlueprint", "componentVariant", "instance"],
      overrideLevels: ["pageBlueprint", "componentVariant", "instance"],
      instanceOverrideAllowed: true,
    },
    validationCode: "invalid-column-count",
  }),
  enumParameter(
    "mediaPlacement",
    "structural",
    ["start", "end", "above", "below", "background"],
    "start",
    ["marketing", "commerce", "content"],
    { affectsResponsiveBehavior: true },
  ),
  enumParameter(
    "contentAlignment",
    "structural",
    ["start", "center", "end"],
    "start",
    commonFamilies,
  ),
  enumParameter(
    "productInformationPlacement",
    "structural",
    ["besideMedia", "belowMedia", "stacked"],
    "besideMedia",
    ["commerce"],
    {
      affectsResponsiveBehavior: true,
      incompatibleWith: ["filterPlacement"],
    },
  ),
  enumParameter(
    "filterPlacement",
    "structural",
    ["sidebar", "horizontal", "disclosure"],
    "sidebar",
    ["commerce"],
    { affectsResponsiveBehavior: true },
  ),
  enumParameter(
    "galleryMode",
    "structural",
    ["single", "thumbnails", "gallery"],
    "single",
    ["commerce"],
    { affectsResponsiveBehavior: true },
  ),
  enumParameter(
    "sectionWidth",
    "structural",
    ["narrow", "standard", "wide", "full"],
    "standard",
    commonFamilies,
    { affectsResponsiveBehavior: true },
  ),
  enumParameter(
    "cardinality",
    "structural",
    ["single", "pair", "three", "four"],
    "single",
    commonFamilies,
    { affectsResponsiveBehavior: true },
  ),
  enumParameter(
    "responsiveCollapse",
    "structural",
    ["none", "stack", "disclosure", "carousel"],
    "stack",
    commonFamilies,
    { affectsResponsiveBehavior: true },
  ),
  enumParameter(
    "density",
    "visual",
    ["compact", "standard", "spacious"],
    "standard",
    commonFamilies,
  ),
  enumParameter(
    "surfaceTreatment",
    "visual",
    ["plain", "soft", "layered", "contrast"],
    "plain",
    commonFamilies,
  ),
  enumParameter("visualWeight", "visual", allWeights, "medium", commonFamilies),
  enumParameter(
    "typographyRole",
    "visual",
    ["inherit", "serif", "sans", "strong"],
    "inherit",
    commonFamilies,
  ),
  enumParameter("imageTreatment", "visual", ["contained", "crop", "editorial"], "contained", [
    "marketing",
    "commerce",
    "content",
  ]),
  enumParameter(
    "borderTreatment",
    "visual",
    ["none", "subtle", "defined"],
    "subtle",
    commonFamilies,
  ),
  enumParameter(
    "shape",
    "visual",
    ["inherit", "square", "soft", "rounded"],
    "inherit",
    commonFamilies,
  ),
  enumParameter(
    "spacingScale",
    "visual",
    ["compact", "balanced", "airy"],
    "balanced",
    commonFamilies,
  ),
  enumParameter("emphasis", "visual", ["quiet", "balanced", "strong"], "balanced", commonFamilies),
  enumParameter(
    "backgroundRole",
    "visual",
    ["inherit", "background", "surface", "primary", "secondary", "accent"],
    "inherit",
    commonFamilies,
  ),
  enumParameter(
    "tone",
    "visual",
    ["neutral", "warm", "cool", "technical"],
    "neutral",
    commonFamilies,
  ),
] as const satisfies readonly BoundedParameterDefinition[];

export const boundedParametersById = new Map(
  boundedParameterDefinitions.map((definition) => [definition.id, definition]),
);

export const componentDesignCompatibilitySchema = z
  .object({
    allowedNarrativeRoles: z.array(narrativeRoleSchema).min(1),
    allowedVisualWeights: z.array(visualWeightSchema).min(1),
    allowedTransitionIntents: z.array(transitionIntentSchema).min(1),
    boundedParameterIds: z.array(designTokenSchema).default([]),
    blueprintProfilePolicy: z.enum(["anyRegistered", "listed"]).default("anyRegistered"),
    compatibleBlueprintProfileIds: z.array(designTokenSchema).default([]),
    commerceRequirements: z
      .array(z.enum(["none", "canonical-binding", "protected-product-context"]))
      .min(1)
      .default(["none"]),
  })
  .strict()
  .superRefine((compatibility, context) => {
    if (
      compatibility.blueprintProfilePolicy === "listed" &&
      compatibility.compatibleBlueprintProfileIds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["compatibleBlueprintProfileIds"],
        message: "Listed PageBlueprint compatibility requires at least one registered profile ID.",
      });
    }
  });

export type ComponentDesignCompatibility = z.infer<typeof componentDesignCompatibilitySchema>;

export function createLegacyComponentDesignCompatibility(): ComponentDesignCompatibility {
  return componentDesignCompatibilitySchema.parse({
    allowedNarrativeRoles: [...narrativeRoleIds],
    allowedVisualWeights: [...allWeights],
    allowedTransitionIntents: [...transitionIntentSchema.options],
    boundedParameterIds: boundedParameterDefinitions.map((definition) => definition.id),
    blueprintProfilePolicy: "anyRegistered",
    compatibleBlueprintProfileIds: [],
    commerceRequirements: ["none", "canonical-binding", "protected-product-context"],
  });
}

export type ParameterInheritanceLayer = Readonly<{
  level: z.infer<typeof parameterAuthorityLevelSchema>;
  value?: z.infer<typeof parameterValueSchema>;
  constraint?: z.infer<typeof parameterConstraintSchema>;
}>;

export type ParameterInheritanceIssueCode =
  | "UNKNOWN_BOUNDED_PARAMETER"
  | "INVALID_BOUNDED_PARAMETER_VALUE"
  | "ILLEGAL_INHERITANCE_BROADENING"
  | "PROHIBITED_INSTANCE_OVERRIDE"
  | "PROHIBITED_PARAMETER_OVERRIDE";

export type ParameterInheritanceIssue = Readonly<{
  code: ParameterInheritanceIssueCode;
  parameterId: string;
  level: z.infer<typeof parameterAuthorityLevelSchema>;
  message: string;
}>;

export type ParameterInheritanceResult = Readonly<{
  parameterId: string;
  value: z.infer<typeof parameterValueSchema> | undefined;
  allowedValues: readonly z.infer<typeof parameterValueSchema>[] | undefined;
  issues: readonly ParameterInheritanceIssue[];
}>;

function valuesEqual(
  left: z.infer<typeof parameterValueSchema>,
  right: z.infer<typeof parameterValueSchema>,
) {
  return left === right;
}

function valueIsAllowed(
  value: z.infer<typeof parameterValueSchema>,
  definition: BoundedParameterDefinition,
  allowedValues: readonly z.infer<typeof parameterValueSchema>[] | undefined,
): boolean {
  if (definition.allowedValues) {
    return (allowedValues ?? definition.allowedValues).some((candidate) =>
      valuesEqual(candidate, value),
    );
  }
  if (typeof value !== "number" || !definition.numericRange) return false;
  return value >= definition.numericRange.minimum && value <= definition.numericRange.maximum;
}

export function resolveBoundedParameterInheritance(
  parameterId: string,
  layers: readonly ParameterInheritanceLayer[],
): ParameterInheritanceResult {
  const definition = boundedParametersById.get(parameterId);
  if (!definition) {
    return {
      parameterId,
      value: undefined,
      allowedValues: undefined,
      issues: [
        {
          code: "UNKNOWN_BOUNDED_PARAMETER",
          parameterId,
          level: "brandSystem",
          message: `Bounded parameter ${parameterId} is not registered.`,
        },
      ],
    };
  }
  const orderedLevels = ["brandSystem", "pageBlueprint", "componentVariant", "instance"] as const;
  const orderedLayers = [...layers].sort(
    (left, right) => orderedLevels.indexOf(left.level) - orderedLevels.indexOf(right.level),
  );
  const issues: ParameterInheritanceIssue[] = [];
  let allowedValues = definition.allowedValues ? [...definition.allowedValues] : undefined;
  let value: z.infer<typeof parameterValueSchema> | undefined = definition.defaultValue;

  orderedLayers.forEach((layer) => {
    if (layer.constraint) {
      const constraint = layer.constraint;
      if (constraint.parameterId !== parameterId) {
        issues.push({
          code: "UNKNOWN_BOUNDED_PARAMETER",
          parameterId,
          level: layer.level,
          message: `Constraint ${constraint.parameterId} does not match ${parameterId}.`,
        });
      } else if (!definition.authority.narrowingLevels.includes(layer.level)) {
        issues.push({
          code: "ILLEGAL_INHERITANCE_BROADENING",
          parameterId,
          level: layer.level,
          message: `${layer.level} cannot narrow ${parameterId}.`,
        });
      } else if (constraint.allowedValues) {
        const parentValues = allowedValues ?? definition.allowedValues ?? [];
        const broadens = constraint.allowedValues.some(
          (candidate) => !parentValues.some((parent) => valuesEqual(parent, candidate)),
        );
        if (broadens) {
          issues.push({
            code: "ILLEGAL_INHERITANCE_BROADENING",
            parameterId,
            level: layer.level,
            message: `${layer.level} broadens the allowed values for ${parameterId}.`,
          });
        } else {
          allowedValues = [...constraint.allowedValues];
        }
      } else if (
        definition.numericRange &&
        ((constraint.minimum !== undefined &&
          constraint.minimum < definition.numericRange.minimum) ||
          (constraint.maximum !== undefined &&
            constraint.maximum > definition.numericRange.maximum))
      ) {
        issues.push({
          code: "ILLEGAL_INHERITANCE_BROADENING",
          parameterId,
          level: layer.level,
          message: `${layer.level} broadens the allowed range for ${parameterId}.`,
        });
      }
    }

    if (layer.value === undefined) return;
    if (layer.level === "instance" && !definition.authority.instanceOverrideAllowed) {
      issues.push({
        code: "PROHIBITED_INSTANCE_OVERRIDE",
        parameterId,
        level: layer.level,
        message: `Instances cannot override ${parameterId}.`,
      });
      return;
    }
    if (!definition.authority.overrideLevels.includes(layer.level)) {
      issues.push({
        code: "PROHIBITED_PARAMETER_OVERRIDE",
        parameterId,
        level: layer.level,
        message: `${layer.level} cannot override ${parameterId}.`,
      });
      return;
    }
    if (!valueIsAllowed(layer.value, definition, allowedValues)) {
      issues.push({
        code: "INVALID_BOUNDED_PARAMETER_VALUE",
        parameterId,
        level: layer.level,
        message: `${layer.level} supplied an unsupported value for ${parameterId}.`,
      });
      return;
    }
    value = layer.value;
  });

  return { parameterId, value, allowedValues, issues };
}
