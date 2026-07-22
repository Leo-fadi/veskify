import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  localeSchema,
  localizedTextSchema,
  safeExternalUrlSchema,
} from "@/domain/shared";
import { pageTypeSchema } from "@/domain/storefront";

const tokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][A-Za-z0-9]*(?:[._-][a-z][A-Za-z0-9]*)*$/);

const rendererExportNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z][A-Za-z0-9]*)*$/);

const pathSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z][A-Za-z0-9]*(?:\.\*|(?:\.[a-z][A-Za-z0-9]*))*$/);

const unique = (values: readonly string[]) => new Set(values).size === values.length;

export const moneyDisplaySchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    formatted: localizedTextSchema.optional(),
  })
  .strict();

export const componentVersionSchema = z
  .object({
    major: z.number().int().positive(),
    minor: z.number().int().nonnegative(),
    patch: z.number().int().nonnegative(),
  })
  .strict();

export const componentFamilySchema = z.enum([
  "primitive",
  "pattern",
  "marketing",
  "navigation",
  "commerce",
  "content",
  "service",
  "pageBlueprint",
]);

export const componentVariantDefinitionSchema = z
  .object({
    id: tokenSchema,
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),
    compatibleDensity: z
      .array(z.enum(["compact", "standard", "spacious"]))
      .min(1)
      .optional(),
  })
  .strict();

export const contentSlotDefinitionSchema = z
  .object({
    id: tokenSchema,
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),
    localized: z.boolean(),
    required: z.boolean(),
    maxItems: z.number().int().positive().optional(),
  })
  .strict();

export const commerceBindingSourceTypeSchema = z.enum([
  "product",
  "collection",
  "asset",
  "navigation",
  "projectBrandContext",
  "localizedContent",
]);

export const assetRoleSchema = z.enum([
  "logo",
  "heroDesktop",
  "heroMobile",
  "collectionImage",
  "productMainImage",
  "productAlternativeImage",
  "editorialImage",
  "iconDecorative",
]);

export const commerceBindingSlotDefinitionSchema = z
  .object({
    id: tokenSchema,
    title: localizedTextSchema,
    acceptedSourceTypes: z.array(commerceBindingSourceTypeSchema).min(1),
    required: z.boolean(),
    revisionRequired: z.boolean().default(false),
    emptyState: z.enum(["hide", "placeholder", "message"]).default("message"),
  })
  .strict()
  .superRefine((slot, context) => {
    if (!unique(slot.acceptedSourceTypes)) {
      context.addIssue({
        code: "custom",
        message: "Binding source types must be unique within a slot.",
        path: ["acceptedSourceTypes"],
      });
    }
  });

export const assetSlotDefinitionSchema = z
  .object({
    id: tokenSchema,
    title: localizedTextSchema,
    acceptedRoles: z.array(assetRoleSchema).min(1),
    required: z.boolean(),
    minItems: z.number().int().nonnegative().default(0),
    maxItems: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((slot, context) => {
    if (!unique(slot.acceptedRoles)) {
      context.addIssue({
        code: "custom",
        message: "Asset roles must be unique within a slot.",
        path: ["acceptedRoles"],
      });
    }
    if (slot.required && slot.minItems === 0) {
      context.addIssue({
        code: "custom",
        message: "Required asset slots must require at least one item.",
        path: ["minItems"],
      });
    }
    if (slot.maxItems !== undefined && slot.maxItems < slot.minItems) {
      context.addIssue({
        code: "custom",
        message: "Asset slot maxItems cannot be lower than minItems.",
        path: ["maxItems"],
      });
    }
  });

export const editablePresentationFieldSchema = z
  .object({
    path: pathSchema,
    label: localizedTextSchema,
    source: z.enum(["content", "props", "styleOverrides"]),
    control: z.enum(["text", "textarea", "select", "toggle", "assetPicker", "bindingPicker"]),
    localized: z.boolean().default(false),
  })
  .strict();

export const protectedFieldContractSchema = z
  .object({
    readOnlyPaths: z.array(pathSchema),
  })
  .strict()
  .superRefine((contract, context) => {
    if (!unique(contract.readOnlyPaths)) {
      context.addIssue({
        code: "custom",
        message: "Protected paths must be unique.",
        path: ["readOnlyPaths"],
      });
    }
  });

export const responsiveRuleSchema = z
  .object({
    breakpoints: z.array(z.enum(["mobile", "tablet", "desktop", "wide"])).min(1),
    minWidthPx: z.number().int().positive().optional(),
    maxColumns: z.number().int().positive().optional(),
    allowHorizontalOverflow: z.literal(false),
    notes: localizedTextSchema.optional(),
  })
  .strict()
  .superRefine((rule, context) => {
    if (!unique(rule.breakpoints)) {
      context.addIssue({
        code: "custom",
        message: "Responsive breakpoints must be unique.",
        path: ["breakpoints"],
      });
    }
  });

export const accessibilityRequirementSchema = z
  .object({
    keyboard: z.string().trim().min(1),
    semantics: z.string().trim().min(1),
    labels: z.string().trim().min(1),
    focus: z.string().trim().min(1),
    contrast: z.string().trim().min(1).optional(),
    liveRegions: z.string().trim().min(1).optional(),
  })
  .strict();

export const rendererAdapterIdentitySchema = z
  .object({
    adapterId: tokenSchema,
    exportName: rendererExportNameSchema,
    supportedTargets: z.array(z.enum(["editor", "preview", "published"])).min(1),
  })
  .strict()
  .superRefine((identity, context) => {
    if (!unique(identity.supportedTargets)) {
      context.addIssue({
        code: "custom",
        message: "Renderer targets must be unique.",
        path: ["supportedTargets"],
      });
    }
  });

export const componentMigrationContractSchema = z
  .object({
    fromVersion: componentVersionSchema,
    toVersion: componentVersionSchema,
    strategy: z.enum(["identity", "registeredFunction", "manualReplacement"]),
    migrationId: tokenSchema.optional(),
    notes: localizedTextSchema.optional(),
  })
  .strict()
  .superRefine((migration, context) => {
    if (
      compareComponentVersions(migration.fromVersion, migration.toVersion) >= 0 &&
      migration.strategy !== "manualReplacement"
    ) {
      context.addIssue({
        code: "custom",
        message: "Automatic migrations must move to a newer component version.",
        path: ["toVersion"],
      });
    }
    if (migration.strategy === "registeredFunction" && migration.migrationId === undefined) {
      context.addIssue({
        code: "custom",
        message: "Registered migrations require a migrationId.",
        path: ["migrationId"],
      });
    }
  });

export const componentMigrationMetadataSchema = z
  .object({
    policy: z.enum(["stable", "compatible", "migrationRequired", "manualReplacement"]),
    previousVersions: z.array(componentVersionSchema),
    migrations: z.array(componentMigrationContractSchema),
  })
  .strict();

export const protectedCommerceFieldPaths = [
  "bindings.product.id",
  "bindings.product.productId",
  "bindings.product.productTypeId",
  "bindings.product.sku",
  "bindings.product.price",
  "bindings.product.compareAtPrice",
  "bindings.product.availability",
  "bindings.product.variantId",
  "bindings.product.variantDimensions",
  "bindings.product.optionGroups",
  "bindings.product.optionValues",
  "bindings.collection.id",
  "bindings.collection.collectionId",
  "bindings.collection.productIds",
  "bindings.collection.filters",
  "commerce.product.id",
  "commerce.product.sku",
  "commerce.product.price",
  "commerce.product.compareAtPrice",
  "commerce.product.availability",
  "commerce.product.stock",
] as const;

export const componentDefinitionV2Schema = z
  .object({
    type: tokenSchema,
    version: componentVersionSchema,
    title: localizedTextSchema,
    merchantDescription: localizedTextSchema,
    family: componentFamilySchema,
    supportedPageTypes: z.array(pageTypeSchema).min(1),
    variants: z.array(componentVariantDefinitionSchema).min(1),
    defaultVariant: tokenSchema,
    industryTags: z.array(tokenSchema),
    contentSlots: z.array(contentSlotDefinitionSchema),
    commerceBindingSlots: z.array(commerceBindingSlotDefinitionSchema),
    assetSlots: z.array(assetSlotDefinitionSchema),
    editablePresentationFields: z.array(editablePresentationFieldSchema),
    protectedFields: protectedFieldContractSchema,
    responsiveRules: z.array(responsiveRuleSchema).min(1),
    accessibilityRequirements: accessibilityRequirementSchema,
    migration: componentMigrationMetadataSchema,
    renderer: rendererAdapterIdentitySchema,
  })
  .strict()
  .superRefine((definition, context) => {
    for (const [field, values] of [
      ["supportedPageTypes", definition.supportedPageTypes],
      ["variants", definition.variants.map((variant) => variant.id)],
      ["contentSlots", definition.contentSlots.map((slot) => slot.id)],
      ["commerceBindingSlots", definition.commerceBindingSlots.map((slot) => slot.id)],
      ["assetSlots", definition.assetSlots.map((slot) => slot.id)],
      [
        "editablePresentationFields",
        definition.editablePresentationFields.map((field) => field.path),
      ],
    ] as const) {
      if (!unique(values)) {
        context.addIssue({
          code: "custom",
          message: `${field} must not contain duplicates.`,
          path: [field],
        });
      }
    }

    if (!definition.variants.some((variant) => variant.id === definition.defaultVariant)) {
      context.addIssue({
        code: "custom",
        message: "Default variant must be listed as a supported variant.",
        path: ["defaultVariant"],
      });
    }

    const allProtectedPaths = [
      ...definition.protectedFields.readOnlyPaths,
      ...protectedCommerceFieldPaths,
    ];
    definition.editablePresentationFields.forEach((field, index) => {
      if (allProtectedPaths.some((protectedPath) => pathsOverlap(field.path, protectedPath))) {
        context.addIssue({
          code: "custom",
          message: "Protected commerce fields cannot be declared editable.",
          path: ["editablePresentationFields", index, "path"],
        });
      }
    });
  });

const bindingBaseSchema = z.object({
  slotId: tokenSchema,
  revision: z.string().trim().min(1).max(120).optional(),
  locale: localeSchema.optional(),
});

export const productBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("product"),
    productId: idSchema,
  })
  .strict();

export const collectionBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("collection"),
    collectionId: idSchema,
  })
  .strict();

export const assetBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("asset"),
    assetId: idSchema,
    role: assetRoleSchema.optional(),
  })
  .strict();

export const navigationBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("navigation"),
    navigationId: idSchema,
  })
  .strict();

export const projectBrandContextBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("projectBrandContext"),
    projectId: idSchema,
    brandSystemRef: idSchema.optional(),
  })
  .strict();

export const localizedContentBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("localizedContent"),
    contentId: idSchema,
    fallbackLocale: localeSchema.optional(),
  })
  .strict();

export const presentationBindingSchema = z.discriminatedUnion("source", [
  productBindingSchema,
  collectionBindingSchema,
  assetBindingSchema,
  navigationBindingSchema,
  projectBrandContextBindingSchema,
  localizedContentBindingSchema,
]);

export const productMediaPresentationSchema = z
  .object({
    assetId: idSchema,
    role: z.enum(["main", "alternative", "variant", "editorial"]),
    alt: localizedTextSchema.optional(),
    variantIds: z.array(idSchema).optional(),
  })
  .strict();

export const productAttributeValueSchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    value: localizedTextSchema,
    unit: localizedTextSchema.optional(),
  })
  .strict();

export const productAttributeGroupSchema = z
  .object({
    id: idSchema,
    title: localizedTextSchema,
    attributes: z.array(productAttributeValueSchema),
  })
  .strict();

export const optionValuePresentationSchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    value: z.string().trim().min(1).max(120),
    swatch: z
      .object({
        color: z
          .string()
          .trim()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        assetId: idSchema.optional(),
      })
      .strict()
      .optional(),
    disabled: z.boolean().default(false),
    unavailableReason: localizedTextSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const productOptionGroupSchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    source: z.enum(["variantDimension", "orderOption"]),
    required: z.boolean(),
    presentation: z.enum([
      "swatch",
      "buttonGroup",
      "dropdown",
      "imageChoice",
      "textInput",
      "radio",
    ]),
    values: z.array(optionValuePresentationSchema),
    selectedValueId: idSchema.optional(),
    dependsOn: z.array(idSchema).default([]),
    helpText: localizedTextSchema.optional(),
  })
  .strict()
  .superRefine((group, context) => {
    if (group.presentation !== "textInput" && group.values.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Selectable option groups require at least one value.",
        path: ["values"],
      });
    }
    if (
      group.selectedValueId !== undefined &&
      !group.values.some((value) => value.id === group.selectedValueId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Selected option value must resolve within the option group.",
        path: ["selectedValueId"],
      });
    }
    if (!unique(group.values.map((value) => value.id))) {
      context.addIssue({
        code: "custom",
        message: "Option value IDs must be unique within a group.",
        path: ["values"],
      });
    }
  });

export const selectedOptionStateSchema = z
  .object({
    groupId: idSchema,
    valueId: idSchema,
    complete: z.boolean(),
  })
  .strict();

export const unavailableCombinationSchema = z
  .object({
    valueIds: z.array(idSchema).min(1),
    reason: localizedTextSchema,
  })
  .strict();

export const productPresentationContextSchema = z
  .object({
    productId: idSchema,
    productTypeId: idSchema,
    sku: z.string().trim().min(1).max(120).optional(),
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),
    price: moneyDisplaySchema.optional(),
    compareAtPrice: moneyDisplaySchema.optional(),
    priceUnavailableReason: localizedTextSchema.optional(),
    availability: localizedTextSchema.optional(),
    media: z.array(productMediaPresentationSchema),
    attributeGroups: z.array(productAttributeGroupSchema),
    optionGroups: z.array(productOptionGroupSchema),
    selectedValues: z.array(selectedOptionStateSchema).default([]),
    unavailableCombinations: z.array(unavailableCombinationSchema).default([]),
    relatedProductIds: z.array(idSchema).default([]),
    revision: z.string().trim().min(1).max(120),
  })
  .strict()
  .superRefine((product, context) => {
    if ((product.price === undefined) === (product.priceUnavailableReason === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Product presentation requires exactly one of price or priceUnavailableReason.",
        path: product.price === undefined ? ["price"] : ["priceUnavailableReason"],
      });
    }

    const optionGroupIds = product.optionGroups.map((group) => group.id);
    if (!unique(optionGroupIds)) {
      context.addIssue({
        code: "custom",
        message: "Option group IDs must be unique.",
        path: ["optionGroups"],
      });
    }
    const knownOptionGroups = new Set(optionGroupIds);
    product.selectedValues.forEach((selection, index) => {
      if (!knownOptionGroups.has(selection.groupId)) {
        context.addIssue({
          code: "custom",
          message: "Selected values must reference an existing option group.",
          path: ["selectedValues", index, "groupId"],
        });
      }
    });
  });

export const collectionFilterPresentationSchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    values: z.array(
      z
        .object({
          id: idSchema,
          label: localizedTextSchema,
          count: z.number().int().nonnegative().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const collectionSortPresentationSchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    default: z.boolean().default(false),
  })
  .strict();

export const collectionPresentationContextSchema = z
  .object({
    collectionId: idSchema,
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),
    assets: z.array(
      z
        .object({
          assetId: idSchema,
          role: z.enum(["hero", "card", "editorial"]),
        })
        .strict(),
    ),
    productIds: z.array(idSchema),
    filters: z.array(collectionFilterPresentationSchema),
    sorting: z.array(collectionSortPresentationSchema),
    emptyState: z
      .object({
        title: localizedTextSchema,
        description: localizedTextSchema.optional(),
      })
      .strict(),
    revision: z.string().trim().min(1).max(120),
  })
  .strict()
  .superRefine((collection, context) => {
    if (!unique(collection.productIds)) {
      context.addIssue({
        code: "custom",
        message: "Collection product references must be unique.",
        path: ["productIds"],
      });
    }
  });

export const assetProvenanceSchema = z
  .object({
    kind: z.enum([
      "merchantProvided",
      "sourceDiscovered",
      "canonicalProductMedia",
      "generated",
      "preset",
    ]),
    sourceId: idSchema,
    sourceUrl: safeExternalUrlSchema.optional(),
    capturedAt: isoDateTimeSchema.optional(),
    provider: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const assetCropSchema = z
  .object({
    cropId: idSchema,
    breakpoint: z.enum(["mobile", "tablet", "desktop", "wide"]),
    aspectRatio: z
      .string()
      .trim()
      .regex(/^\d+:\d+$/),
    focalPoint: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
      })
      .strict(),
  })
  .strict();

export const storefrontAssetMetadataSchema = z
  .object({
    assetId: idSchema,
    role: assetRoleSchema,
    alt: localizedTextSchema.optional(),
    decorative: z.boolean().default(false),
    provenance: assetProvenanceSchema,
    approved: z.boolean(),
    usageRights: z.enum(["merchantOwned", "licensed", "publicSource", "generated", "unknown"]),
    responsiveCrops: z.array(assetCropSchema).default([]),
  })
  .strict()
  .refine((asset) => asset.decorative || asset.alt !== undefined, {
    message: "Non-decorative assets require localized alt text.",
    path: ["alt"],
  });

export const componentInstanceV2Schema = z
  .object({
    id: idSchema,
    component: tokenSchema,
    componentVersion: componentVersionSchema,
    variant: tokenSchema,
    content: z.record(z.string(), z.unknown()).default({}),
    props: z.record(z.string(), z.unknown()).default({}),
    bindings: z.array(presentationBindingSchema).default([]),
    assetAssignments: z
      .array(
        z
          .object({
            slotId: tokenSchema,
            assetId: idSchema,
            role: assetRoleSchema,
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export function compareComponentVersions(left: ComponentVersion, right: ComponentVersion): number {
  for (const part of ["major", "minor", "patch"] as const) {
    if (left[part] !== right[part]) return left[part] - right[part];
  }
  return 0;
}

function pathsOverlap(left: string, right: string): boolean {
  if (left === right) return true;
  const leftPrefix = left.endsWith(".*") ? left.slice(0, -2) : left;
  const rightPrefix = right.endsWith(".*") ? right.slice(0, -2) : right;
  return leftPrefix.startsWith(`${rightPrefix}.`) || rightPrefix.startsWith(`${leftPrefix}.`);
}

export function validateComponentDefinitionV2(input: unknown): ComponentDefinitionV2 {
  return componentDefinitionV2Schema.parse(input);
}

export function validatePresentationBinding(input: unknown): PresentationBinding {
  return presentationBindingSchema.parse(input);
}

export function createComponentRegistryV2(definitions: readonly ComponentDefinitionV2[]) {
  const parsedDefinitions = definitions.map((definition) =>
    componentDefinitionV2Schema.parse(definition),
  );
  const byType = new Map<string, ComponentDefinitionV2>();
  for (const definition of parsedDefinitions) {
    if (byType.has(definition.type)) {
      throw new Error(`Duplicate ComponentDefinitionV2 type: ${definition.type}.`);
    }
    byType.set(definition.type, definition);
  }

  function get(type: string): ComponentDefinitionV2 {
    const definition = byType.get(type);
    if (!definition) throw new Error(`Unknown ComponentDefinitionV2 type: ${type}.`);
    return definition;
  }

  function validateInstance(input: unknown): ComponentInstanceV2 {
    const instance = componentInstanceV2Schema.parse(input);
    const definition = get(instance.component);

    if (compareComponentVersions(instance.componentVersion, definition.version) !== 0) {
      throw new Error(
        `Component ${instance.component} version ${formatComponentVersion(
          instance.componentVersion,
        )} is not the registered version ${formatComponentVersion(definition.version)}.`,
      );
    }
    if (!definition.variants.some((variant) => variant.id === instance.variant)) {
      throw new Error(`Unsupported ${instance.component} variant: ${instance.variant}.`);
    }

    validateInstanceBindings(instance, definition);
    validateInstanceAssetAssignments(instance, definition);
    return instance;
  }

  function migrationFor(
    component: string,
    fromVersion: ComponentVersion,
  ): ComponentMigrationContract | undefined {
    const definition = get(component);
    if (compareComponentVersions(fromVersion, definition.version) === 0) return undefined;
    return definition.migration.migrations.find(
      (migration) =>
        compareComponentVersions(migration.fromVersion, fromVersion) === 0 &&
        compareComponentVersions(migration.toVersion, definition.version) === 0,
    );
  }

  return {
    definitions: () => parsedDefinitions.map((definition) => structuredClone(definition)),
    get,
    has: (type: string) => byType.has(type),
    validateInstance,
    migrationFor,
  };
}

function validateInstanceBindings(
  instance: ComponentInstanceV2,
  definition: ComponentDefinitionV2,
) {
  const slots = new Map(definition.commerceBindingSlots.map((slot) => [slot.id, slot]));
  const seenRequired = new Set<string>();
  instance.bindings.forEach((binding) => {
    const slot = slots.get(binding.slotId);
    if (!slot) throw new Error(`Invalid commerce binding slot: ${binding.slotId}.`);
    if (!slot.acceptedSourceTypes.includes(binding.source)) {
      throw new Error(`Binding slot ${binding.slotId} does not accept ${binding.source}.`);
    }
    if (slot.revisionRequired && binding.revision === undefined) {
      throw new Error(`Binding slot ${binding.slotId} requires a projection revision.`);
    }
    if (slot.required) seenRequired.add(slot.id);
  });
  for (const slot of definition.commerceBindingSlots) {
    if (slot.required && !seenRequired.has(slot.id)) {
      throw new Error(`Missing required commerce binding slot: ${slot.id}.`);
    }
  }
}

function validateInstanceAssetAssignments(
  instance: ComponentInstanceV2,
  definition: ComponentDefinitionV2,
) {
  const slots = new Map(definition.assetSlots.map((slot) => [slot.id, slot]));
  instance.assetAssignments.forEach((assignment) => {
    const slot = slots.get(assignment.slotId);
    if (!slot) throw new Error(`Invalid asset slot: ${assignment.slotId}.`);
    if (!slot.acceptedRoles.includes(assignment.role)) {
      throw new Error(`Asset slot ${assignment.slotId} does not accept ${assignment.role}.`);
    }
  });
  for (const slot of definition.assetSlots) {
    const count = instance.assetAssignments.filter(
      (assignment) => assignment.slotId === slot.id,
    ).length;
    if (slot.required && count < slot.minItems) {
      throw new Error(`Missing required asset slot: ${slot.id}.`);
    }
    if (slot.maxItems !== undefined && count > slot.maxItems) {
      throw new Error(`Too many assets assigned to slot: ${slot.id}.`);
    }
  }
}

export function formatComponentVersion(version: ComponentVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export type MoneyDisplay = z.infer<typeof moneyDisplaySchema>;
export type ComponentVersion = z.infer<typeof componentVersionSchema>;
export type ComponentFamily = z.infer<typeof componentFamilySchema>;
export type ComponentVariantDefinition = z.infer<typeof componentVariantDefinitionSchema>;
export type ContentSlotDefinition = z.infer<typeof contentSlotDefinitionSchema>;
export type CommerceBindingSourceType = z.infer<typeof commerceBindingSourceTypeSchema>;
export type AssetRole = z.infer<typeof assetRoleSchema>;
export type CommerceBindingSlotDefinition = z.infer<typeof commerceBindingSlotDefinitionSchema>;
export type AssetSlotDefinition = z.infer<typeof assetSlotDefinitionSchema>;
export type EditablePresentationField = z.infer<typeof editablePresentationFieldSchema>;
export type ProtectedFieldContract = z.infer<typeof protectedFieldContractSchema>;
export type ResponsiveRule = z.infer<typeof responsiveRuleSchema>;
export type AccessibilityRequirement = z.infer<typeof accessibilityRequirementSchema>;
export type RendererAdapterIdentity = z.infer<typeof rendererAdapterIdentitySchema>;
export type ComponentMigrationContract = z.infer<typeof componentMigrationContractSchema>;
export type ComponentMigrationMetadata = z.infer<typeof componentMigrationMetadataSchema>;
export type ComponentDefinitionV2 = z.infer<typeof componentDefinitionV2Schema>;
export type ProductBinding = z.infer<typeof productBindingSchema>;
export type CollectionBinding = z.infer<typeof collectionBindingSchema>;
export type AssetBinding = z.infer<typeof assetBindingSchema>;
export type NavigationBinding = z.infer<typeof navigationBindingSchema>;
export type ProjectBrandContextBinding = z.infer<typeof projectBrandContextBindingSchema>;
export type LocalizedContentBinding = z.infer<typeof localizedContentBindingSchema>;
export type PresentationBinding = z.infer<typeof presentationBindingSchema>;
export type ProductPresentationContext = z.infer<typeof productPresentationContextSchema>;
export type CollectionPresentationContext = z.infer<typeof collectionPresentationContextSchema>;
export type AssetProvenance = z.infer<typeof assetProvenanceSchema>;
export type StorefrontAssetMetadata = z.infer<typeof storefrontAssetMetadataSchema>;
export type ComponentInstanceV2 = z.infer<typeof componentInstanceV2Schema>;
