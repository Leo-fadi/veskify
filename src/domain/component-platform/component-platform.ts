import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  localeSchema,
  localizedTextSchema,
  safeExternalUrlSchema,
} from "@/domain/shared";
import { pageTypeSchema } from "@/domain/storefront";
import {
  componentDesignCompatibilitySchema,
  createLegacyComponentDesignCompatibility,
} from "./design-vocabulary";

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
  .regex(/^(?:\*|[a-z][A-Za-z0-9]*)(?:\.(?:\*|[a-z][A-Za-z0-9]*))*$/);

const unique = (values: readonly string[]) => new Set(values).size === values.length;
export const presentationRevisionSchema = z.string().trim().min(1).max(160);

export const componentDataSchemaContractSchema = z
  .object({
    type: z.literal("object"),
    properties: z.record(z.string(), z.json()),
    required: z.array(z.string()).default([]),
    additionalProperties: z.literal(false),
  })
  .catchall(z.json())
  .superRefine((contract, context) => {
    if (!unique(contract.required)) {
      context.addIssue({
        code: "custom",
        message: "Required schema fields must be unique.",
        path: ["required"],
      });
    }
    contract.required.forEach((field, index) => {
      if (!(field in contract.properties)) {
        context.addIssue({
          code: "custom",
          message: "Required schema fields must be declared in properties.",
          path: ["required", index],
        });
      }
    });
    try {
      z.fromJSONSchema(contract as Parameters<typeof z.fromJSONSchema>[0]);
    } catch {
      context.addIssue({
        code: "custom",
        message: "Component data contracts must contain a supported JSON Schema.",
      });
    }
  });

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
  "productList",
  "collection",
  "collectionList",
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
  "supportingContentImage",
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
    supportedTargets: z.array(z.enum(["editor", "preview", "published"])).length(3),
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
    for (const target of ["editor", "preview", "published"] as const) {
      if (!identity.supportedTargets.includes(target)) {
        context.addIssue({
          code: "custom",
          message: `Renderer target ${target} is required.`,
          path: ["supportedTargets"],
        });
      }
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
  "productIds",
  "collectionIds",
  "products",
  "collections",
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
    contentSchema: componentDataSchemaContractSchema,
    propsSchema: componentDataSchemaContractSchema,
    styleOverridesSchema: componentDataSchemaContractSchema,
    contentSlots: z.array(contentSlotDefinitionSchema),
    commerceBindingSlots: z.array(commerceBindingSlotDefinitionSchema),
    assetSlots: z.array(assetSlotDefinitionSchema),
    editablePresentationFields: z.array(editablePresentationFieldSchema),
    protectedFields: protectedFieldContractSchema,
    responsiveRules: z.array(responsiveRuleSchema).min(1),
    accessibilityRequirements: accessibilityRequirementSchema,
    designCompatibility: componentDesignCompatibilitySchema.default(
      createLegacyComponentDesignCompatibility(),
    ),
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

    validateMigrationConsistency(definition, context);

    const allProtectedPaths = [
      ...definition.protectedFields.readOnlyPaths,
      ...protectedCommerceFieldPaths,
    ];
    definition.editablePresentationFields.forEach((field, index) => {
      const relativePath = field.path.startsWith(`${field.source}.`)
        ? field.path.slice(field.source.length + 1)
        : field.path;
      if (
        allProtectedPaths.some(
          (protectedPath) =>
            pathsOverlap(field.path, protectedPath) || pathsOverlap(relativePath, protectedPath),
        )
      ) {
        context.addIssue({
          code: "custom",
          message: "Protected commerce fields cannot be declared editable.",
          path: ["editablePresentationFields", index, "path"],
        });
      }

      const contract =
        field.source === "content"
          ? definition.contentSchema
          : field.source === "props"
            ? definition.propsSchema
            : definition.styleOverridesSchema;
      if (!jsonSchemaDeclaresPath(contract, relativePath)) {
        context.addIssue({
          code: "custom",
          message: `Editable ${field.source} fields must resolve within their declared schema.`,
          path: ["editablePresentationFields", index, "path"],
        });
      }
    });
  });

const bindingBaseSchema = z.object({
  slotId: tokenSchema,
  revision: presentationRevisionSchema.optional(),
  locale: localeSchema.optional(),
});

export const productBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("product"),
    productId: idSchema,
  })
  .strict();

export const productListBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("productList"),
    productIds: z.array(idSchema),
  })
  .strict()
  .superRefine((binding, context) => {
    if (!unique(binding.productIds)) {
      context.addIssue({
        code: "custom",
        message: "Product list bindings must contain unique canonical IDs.",
        path: ["productIds"],
      });
    }
  });

export const collectionBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("collection"),
    collectionId: idSchema,
  })
  .strict();

export const collectionListBindingSchema = bindingBaseSchema
  .extend({
    source: z.literal("collectionList"),
    collectionIds: z.array(idSchema).min(1),
  })
  .strict()
  .superRefine((binding, context) => {
    if (!unique(binding.collectionIds)) {
      context.addIssue({
        code: "custom",
        message: "Collection list bindings must contain unique canonical IDs.",
        path: ["collectionIds"],
      });
    }
  });

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
  productListBindingSchema,
  collectionBindingSchema,
  collectionListBindingSchema,
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
    decorative: z.boolean().optional(),
    variantIds: z.array(idSchema).optional(),
  })
  .strict();

export const productAttributeValueSchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    value: localizedTextSchema,
    unit: localizedTextSchema.optional(),
    displayOrder: z.number().int().nonnegative().optional(),
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

export const optionGroupDependencySchema = z
  .object({
    groupId: idSchema,
    valueIds: z.array(idSchema).min(1).optional(),
  })
  .strict()
  .superRefine((dependency, context) => {
    if (dependency.valueIds !== undefined && !unique(dependency.valueIds)) {
      context.addIssue({
        code: "custom",
        message: "Dependency value references must be unique.",
        path: ["valueIds"],
      });
    }
  });

export const textEntryConstraintsSchema = z
  .object({
    maxLength: z.number().int().positive().max(500),
    minLength: z.number().int().nonnegative().default(0),
    characterPolicy: z.enum([
      "unicodeText",
      "lettersAndSpaces",
      "lettersNumbersAndSpaces",
      "asciiPrintable",
    ]),
    placeholder: localizedTextSchema.optional(),
  })
  .strict()
  .superRefine((constraints, context) => {
    if (constraints.minLength > constraints.maxLength) {
      context.addIssue({
        code: "custom",
        message: "Text option minLength cannot exceed maxLength.",
        path: ["minLength"],
      });
    }
  });

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
    dependsOn: z.array(optionGroupDependencySchema).default([]),
    textEntryConstraints: textEntryConstraintsSchema.optional(),
    helpText: localizedTextSchema.optional(),
  })
  .strict()
  .superRefine((group, context) => {
    if (group.presentation === "textInput") {
      if (group.values.length !== 0) {
        context.addIssue({
          code: "custom",
          message: "Text-entry option groups cannot declare placeholder option values.",
          path: ["values"],
        });
      }
      if (group.selectedValueId !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Text-entry option state must not use selectedValueId.",
          path: ["selectedValueId"],
        });
      }
      if (group.textEntryConstraints === undefined) {
        context.addIssue({
          code: "custom",
          message: "Text-entry option groups require canonical text constraints.",
          path: ["textEntryConstraints"],
        });
      }
    } else if (group.values.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Selectable option groups require at least one value.",
        path: ["values"],
      });
    }
    if (group.presentation !== "textInput" && group.textEntryConstraints !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Enumerated option groups cannot declare text-entry constraints.",
        path: ["textEntryConstraints"],
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
    if (!unique(group.dependsOn.map((dependency) => dependency.groupId))) {
      context.addIssue({
        code: "custom",
        message: "Option group dependencies must reference each group at most once.",
        path: ["dependsOn"],
      });
    }
  });

export const selectedEnumeratedOptionStateSchema = z
  .object({
    groupId: idSchema,
    valueId: idSchema,
    complete: z.boolean(),
  })
  .strict();

export const selectedTextOptionStateSchema = z
  .object({
    groupId: idSchema,
    enteredText: z.string().max(500),
    complete: z.boolean(),
  })
  .strict();

export const selectedOptionStateSchema = z.union([
  selectedEnumeratedOptionStateSchema,
  selectedTextOptionStateSchema,
]);

export const optionCombinationSelectionSchema = z
  .object({
    groupId: idSchema,
    valueId: idSchema,
  })
  .strict();

export const unavailableCombinationSchema = z
  .object({
    selections: z.array(optionCombinationSelectionSchema).min(1),
    reason: localizedTextSchema,
  })
  .strict()
  .superRefine((combination, context) => {
    if (!unique(combination.selections.map((selection) => selection.groupId))) {
      context.addIssue({
        code: "custom",
        message: "Unavailable combinations cannot reference the same group more than once.",
        path: ["selections"],
      });
    }
  });

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
    revision: presentationRevisionSchema,
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
    const knownOptionGroups = new Map(product.optionGroups.map((group) => [group.id, group]));
    if (!unique(product.selectedValues.map((selection) => selection.groupId))) {
      context.addIssue({
        code: "custom",
        message: "Selected option state must contain at most one entry per group.",
        path: ["selectedValues"],
      });
    }
    product.selectedValues.forEach((selection, index) => {
      const group = knownOptionGroups.get(selection.groupId);
      if (!group) {
        context.addIssue({
          code: "custom",
          message: "Selected values must reference an existing option group.",
          path: ["selectedValues", index, "groupId"],
        });
        return;
      }
      if ("valueId" in selection) {
        if (group.presentation === "textInput") {
          context.addIssue({
            code: "custom",
            message: "Text-entry selections must use enteredText state.",
            path: ["selectedValues", index],
          });
        } else if (!group.values.some((value) => value.id === selection.valueId)) {
          context.addIssue({
            code: "custom",
            message: "Selected value must resolve within its canonical option group.",
            path: ["selectedValues", index, "valueId"],
          });
        }
        return;
      }
      if (group.presentation !== "textInput" || group.textEntryConstraints === undefined) {
        context.addIssue({
          code: "custom",
          message: "Entered text state must reference a text-entry option group.",
          path: ["selectedValues", index],
        });
        return;
      }
      validateEnteredText(selection, group, index, context);
    });

    product.optionGroups.forEach((group, groupIndex) => {
      group.dependsOn.forEach((dependency, dependencyIndex) => {
        const target = knownOptionGroups.get(dependency.groupId);
        const path = ["optionGroups", groupIndex, "dependsOn", dependencyIndex] as const;
        if (!target) {
          context.addIssue({
            code: "custom",
            message: "Option dependencies must reference an existing group.",
            path: [...path, "groupId"],
          });
          return;
        }
        if (dependency.groupId === group.id) {
          context.addIssue({
            code: "custom",
            message: "Option groups cannot depend on themselves.",
            path: [...path, "groupId"],
          });
        }
        dependency.valueIds?.forEach((valueId, valueIndex) => {
          if (
            target.presentation === "textInput" ||
            !target.values.some((value) => value.id === valueId)
          ) {
            context.addIssue({
              code: "custom",
              message: "Dependency values must resolve within the referenced enumerated group.",
              path: [...path, "valueIds", valueIndex],
            });
          }
        });
      });
    });

    if (hasDependencyCycle(product.optionGroups)) {
      context.addIssue({
        code: "custom",
        message: "Option group dependency cycles are not supported.",
        path: ["optionGroups"],
      });
    }

    product.unavailableCombinations.forEach((combination, combinationIndex) => {
      combination.selections.forEach((selection, selectionIndex) => {
        const group = knownOptionGroups.get(selection.groupId);
        if (
          !group ||
          group.presentation === "textInput" ||
          !group.values.some((value) => value.id === selection.valueId)
        ) {
          context.addIssue({
            code: "custom",
            message: "Unavailable combinations must reference canonical enumerated values.",
            path: ["unavailableCombinations", combinationIndex, "selections", selectionIndex],
          });
        }
      });
    });
  });

function validateEnteredText(
  selection: z.infer<typeof selectedTextOptionStateSchema>,
  group: z.infer<typeof productOptionGroupSchema>,
  selectionIndex: number,
  context: z.RefinementCtx,
) {
  const constraints = group.textEntryConstraints;
  if (constraints === undefined) return;
  const length = Array.from(selection.enteredText).length;
  if (length > constraints.maxLength) {
    context.addIssue({
      code: "custom",
      message: "Entered text exceeds the canonical maximum length.",
      path: ["selectedValues", selectionIndex, "enteredText"],
    });
  }
  if ((selection.complete || length > 0) && length < constraints.minLength) {
    context.addIssue({
      code: "custom",
      message: "Entered text is shorter than the canonical minimum length.",
      path: ["selectedValues", selectionIndex, "enteredText"],
    });
  }
  if (selection.complete && group.required && length === 0) {
    context.addIssue({
      code: "custom",
      message: "Required text-entry options cannot be completed without text.",
      path: ["selectedValues", selectionIndex, "enteredText"],
    });
  }
  const accepted =
    constraints.characterPolicy === "unicodeText"
      ? !/[\p{Cc}\p{Cf}]/u.test(selection.enteredText)
      : constraints.characterPolicy === "lettersAndSpaces"
        ? /^[\p{L}\p{M} '\u2019-]*$/u.test(selection.enteredText)
        : constraints.characterPolicy === "lettersNumbersAndSpaces"
          ? /^[\p{L}\p{M}\p{N} .,\u2019'&-]*$/u.test(selection.enteredText)
          : /^[\x20-\x7E]*$/.test(selection.enteredText);
  if (!accepted) {
    context.addIssue({
      code: "custom",
      message: `Entered text violates the ${constraints.characterPolicy} character policy.`,
      path: ["selectedValues", selectionIndex, "enteredText"],
    });
  }
}

function hasDependencyCycle(groups: readonly z.infer<typeof productOptionGroupSchema>[]): boolean {
  const graph = new Map(
    groups.map((group) => [group.id, group.dependsOn.map((dependency) => dependency.groupId)]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (groupId: string): boolean => {
    if (visiting.has(groupId)) return true;
    if (visited.has(groupId)) return false;
    visiting.add(groupId);
    for (const dependencyId of graph.get(groupId) ?? []) {
      if (graph.has(dependencyId) && visit(dependencyId)) return true;
    }
    visiting.delete(groupId);
    visited.add(groupId);
    return false;
  };
  return groups.some((group) => visit(group.id));
}

export const collectionFilterPresentationSchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    presentation: z.enum(["enumerated", "range"]).optional(),
    values: z.array(
      z
        .object({
          id: idSchema,
          label: localizedTextSchema,
          count: z.number().int().nonnegative().optional(),
          selected: z.boolean().optional(),
          disabled: z.boolean().optional(),
        })
        .strict(),
    ),
    range: z
      .object({
        min: z.number().finite(),
        max: z.number().finite(),
        selectedMin: z.number().finite().optional(),
        selectedMax: z.number().finite().optional(),
        step: z.number().finite().positive().optional(),
        unit: localizedTextSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((filter, context) => {
    if (!unique(filter.values.map((value) => value.id))) {
      context.addIssue({
        code: "custom",
        message: "Collection filter value IDs must be unique within a group.",
        path: ["values"],
      });
    }
    const presentation = filter.presentation ?? "enumerated";
    if (presentation === "range") {
      if (filter.range === undefined) {
        context.addIssue({
          code: "custom",
          message: "Range collection filters require canonical range presentation state.",
          path: ["range"],
        });
        return;
      }
      if (filter.values.length > 0) {
        context.addIssue({
          code: "custom",
          message: "Range collection filters cannot also declare enumerated values.",
          path: ["values"],
        });
      }
      const { min, max, selectedMin = min, selectedMax = max } = filter.range;
      if (min > max || selectedMin < min || selectedMax > max || selectedMin > selectedMax) {
        context.addIssue({
          code: "custom",
          message: "Collection filter range state must remain within canonical bounds.",
          path: ["range"],
        });
      }
      if (filter.range.step !== undefined) {
        for (const [field, value] of [
          ["selectedMin", filter.range.selectedMin],
          ["selectedMax", filter.range.selectedMax],
        ] as const) {
          if (value === undefined) continue;
          const steps = (value - min) / filter.range.step;
          if (Math.abs(steps - Math.round(steps)) > 1e-9) {
            context.addIssue({
              code: "custom",
              message: "Selected collection range values must align with the canonical step.",
              path: ["range", field],
            });
          }
        }
      }
    } else if (filter.range !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Enumerated collection filters cannot declare range state.",
        path: ["range"],
      });
    }
  });

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
    breadcrumbs: z
      .array(
        z
          .object({
            collectionId: idSchema,
            label: localizedTextSchema,
          })
          .strict(),
      )
      .optional(),
    childCollectionIds: z.array(idSchema).optional(),
    emptyState: z
      .object({
        title: localizedTextSchema,
        description: localizedTextSchema.optional(),
      })
      .strict(),
    revision: presentationRevisionSchema,
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
    for (const [field, ids] of [
      ["assets", collection.assets.map((asset) => asset.assetId)],
      ["filters", collection.filters.map((filter) => filter.id)],
      ["sorting", collection.sorting.map((sort) => sort.id)],
      ["breadcrumbs", (collection.breadcrumbs ?? []).map((item) => item.collectionId)],
      ["childCollectionIds", collection.childCollectionIds ?? []],
    ] as const) {
      if (!unique(ids)) {
        context.addIssue({
          code: "custom",
          message: `Collection ${field} references must be unique.`,
          path: [field],
        });
      }
    }
    if (collection.sorting.filter((sort) => sort.default).length > 1) {
      context.addIssue({
        code: "custom",
        message: "Collection sorting may declare at most one default option.",
        path: ["sorting"],
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
    approvalStatus: z.enum(["pending", "approved", "rejected"]),
    usageRights: z.enum(["merchantOwned", "licensed", "publicSource", "generated", "unknown"]),
    responsiveCrops: z.array(assetCropSchema).default([]),
    revision: presentationRevisionSchema.optional(),
  })
  .strict()
  .refine((asset) => asset.decorative || asset.alt !== undefined, {
    message: "Non-decorative assets require localized alt text.",
    path: ["alt"],
  });

const navigationProjectionReferenceSchema = z
  .object({
    navigationId: idSchema,
    revision: presentationRevisionSchema.optional(),
  })
  .strict();

const projectBrandProjectionReferenceSchema = z
  .object({
    projectId: idSchema,
    brandSystemRefs: z.array(idSchema).default([]),
    revision: presentationRevisionSchema.optional(),
  })
  .strict();

const localizedContentProjectionReferenceSchema = z
  .object({
    contentId: idSchema,
    locales: z.array(localeSchema).min(1),
    revision: presentationRevisionSchema.optional(),
  })
  .strict();

export const componentProjectionContextSchema = z
  .object({
    products: z.array(productPresentationContextSchema).default([]),
    collections: z.array(collectionPresentationContextSchema).default([]),
    assets: z.array(storefrontAssetMetadataSchema).default([]),
    navigation: z.array(navigationProjectionReferenceSchema).default([]),
    projectBrandContexts: z.array(projectBrandProjectionReferenceSchema).default([]),
    localizedContents: z.array(localizedContentProjectionReferenceSchema).default([]),
    productListRevision: presentationRevisionSchema.optional(),
    collectionListRevision: presentationRevisionSchema.optional(),
  })
  .strict()
  .superRefine((projection, context) => {
    for (const [field, ids] of [
      ["products", projection.products.map((product) => product.productId)],
      ["collections", projection.collections.map((collection) => collection.collectionId)],
      ["assets", projection.assets.map((asset) => asset.assetId)],
      ["navigation", projection.navigation.map((item) => item.navigationId)],
      ["projectBrandContexts", projection.projectBrandContexts.map((item) => item.projectId)],
      ["localizedContents", projection.localizedContents.map((item) => item.contentId)],
    ] as const) {
      if (!unique(ids)) {
        context.addIssue({
          code: "custom",
          message: `${field} projection references must be unique.`,
          path: [field],
        });
      }
    }
  });

export const componentInstanceV2Schema = z
  .object({
    id: idSchema,
    component: tokenSchema,
    componentVersion: componentVersionSchema,
    variant: tokenSchema,
    content: z.record(z.string(), z.json()).default({}),
    props: z.record(z.string(), z.json()).default({}),
    styleOverrides: z.record(z.string(), z.json()).default({}),
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
  const leftSegments = left.split(".");
  const rightSegments = right.split(".");
  const sharedLength = Math.min(leftSegments.length, rightSegments.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const leftSegment = leftSegments[index];
    const rightSegment = rightSegments[index];
    if (leftSegment !== "*" && rightSegment !== "*" && leftSegment !== rightSegment) {
      return false;
    }
  }
  return true;
}

function jsonSchemaDeclaresPath(
  contract: z.infer<typeof componentDataSchemaContractSchema>,
  path: string,
): boolean {
  let current: unknown = contract;
  for (const segment of path.split(".")) {
    if (
      typeof current !== "object" ||
      current === null ||
      !("properties" in current) ||
      typeof current.properties !== "object" ||
      current.properties === null ||
      !(segment in current.properties)
    ) {
      return false;
    }
    current = (current.properties as Record<string, unknown>)[segment];
  }
  return true;
}

function validateMigrationConsistency(
  definition: {
    version: ComponentVersion;
    migration: ComponentMigrationMetadata;
  },
  context: z.RefinementCtx,
) {
  const { migration, version } = definition;
  const previousKeys = migration.previousVersions.map(formatComponentVersion);
  if (!unique(previousKeys)) {
    context.addIssue({
      code: "custom",
      message: "Previous component versions must be unique.",
      path: ["migration", "previousVersions"],
    });
  }
  migration.previousVersions.forEach((previousVersion, index) => {
    if (compareComponentVersions(previousVersion, version) >= 0) {
      context.addIssue({
        code: "custom",
        message: "Previous component versions must be older than the current version.",
        path: ["migration", "previousVersions", index],
      });
    }
  });

  const declaredPrevious = new Set(previousKeys);
  const migrationFromKeys = migration.migrations.map((item) =>
    formatComponentVersion(item.fromVersion),
  );
  if (!unique(migrationFromKeys)) {
    context.addIssue({
      code: "custom",
      message: "Migration paths must be unambiguous for every previous version.",
      path: ["migration", "migrations"],
    });
  }
  const migrationIds = migration.migrations.flatMap((item) =>
    item.migrationId === undefined ? [] : [item.migrationId],
  );
  if (!unique(migrationIds)) {
    context.addIssue({
      code: "custom",
      message: "Registered migration IDs must be unique.",
      path: ["migration", "migrations"],
    });
  }
  migration.migrations.forEach((item, index) => {
    if (!declaredPrevious.has(formatComponentVersion(item.fromVersion))) {
      context.addIssue({
        code: "custom",
        message: "Migrations must start from a declared previous version.",
        path: ["migration", "migrations", index, "fromVersion"],
      });
    }
    if (compareComponentVersions(item.toVersion, version) !== 0) {
      context.addIssue({
        code: "custom",
        message: "Migrations must target the current component version.",
        path: ["migration", "migrations", index, "toVersion"],
      });
    }
  });

  if (migration.policy === "stable") {
    if (migration.previousVersions.length !== 0 || migration.migrations.length !== 0) {
      context.addIssue({
        code: "custom",
        message: "Stable components cannot declare previous versions or migrations.",
        path: ["migration"],
      });
    }
    return;
  }
  if (migration.policy === "compatible") {
    if (migration.migrations.length !== 0) {
      context.addIssue({
        code: "custom",
        message: "Compatible versions must not require migration steps.",
        path: ["migration", "migrations"],
      });
    }
    return;
  }
  if (migration.previousVersions.length === 0) {
    context.addIssue({
      code: "custom",
      message: `${migration.policy} policy requires at least one previous version.`,
      path: ["migration", "previousVersions"],
    });
  }
  previousKeys.forEach((previousKey, index) => {
    const migrationIndex = migrationFromKeys.indexOf(previousKey);
    if (migrationIndex === -1) {
      context.addIssue({
        code: "custom",
        message:
          "Every previous version requires one deterministic migration to the current version.",
        path: ["migration", "previousVersions", index],
      });
      return;
    }
    const strategy = migration.migrations[migrationIndex]?.strategy;
    if (migration.policy === "migrationRequired" && strategy === "manualReplacement") {
      context.addIssue({
        code: "custom",
        message: "migrationRequired policy cannot use manual replacement steps.",
        path: ["migration", "migrations", migrationIndex, "strategy"],
      });
    }
    if (migration.policy === "manualReplacement" && strategy !== "manualReplacement") {
      context.addIssue({
        code: "custom",
        message: "manualReplacement policy requires manual replacement steps.",
        path: ["migration", "migrations", migrationIndex, "strategy"],
      });
    }
  });
}

export function validateComponentDefinitionV2(input: unknown): ComponentDefinitionV2 {
  return componentDefinitionV2Schema.parse(input);
}

export function validatePresentationBinding(input: unknown): PresentationBinding {
  return presentationBindingSchema.parse(input);
}

export type ComponentInstanceValidationContract = {
  validateInstance?: (instance: ComponentInstanceV2) => void;
  validateConformance?: (
    instance: ComponentInstanceV2,
    projection: ComponentProjectionContext,
  ) => void;
};

export type ComponentInstanceValidationContracts = Readonly<
  Record<string, ComponentInstanceValidationContract>
>;

export function createComponentRegistryV2(
  definitions: readonly ComponentDefinitionV2[],
  validationContracts: ComponentInstanceValidationContracts = {},
) {
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
  for (const component of Object.keys(validationContracts)) {
    if (!byType.has(component)) {
      throw new Error(
        `Component instance validation contract references unknown component: ${component}.`,
      );
    }
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

    validateInstanceData(instance, definition);
    validateInstanceBindings(instance, definition);
    validateInstanceAssetAssignments(instance, definition);
    validationContracts[instance.component]?.validateInstance?.(instance);
    return instance;
  }

  function validateInstanceConformance(
    input: unknown,
    projectionInput: unknown,
  ): ComponentInstanceV2 {
    const instance = validateInstance(input);
    const projection = componentProjectionContextSchema.parse(projectionInput);
    const definition = get(instance.component);
    validateBindingTargets(instance, definition, projection);
    validateAssignedAssetInventory(instance, projection.assets);
    validationContracts[instance.component]?.validateConformance?.(instance, projection);
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
    validateInstanceConformance,
    migrationFor,
  };
}

function validateInstanceData(instance: ComponentInstanceV2, definition: ComponentDefinitionV2) {
  for (const [label, value, contract] of [
    ["content", instance.content, definition.contentSchema],
    ["props", instance.props, definition.propsSchema],
    ["styleOverrides", instance.styleOverrides, definition.styleOverridesSchema],
  ] as const) {
    const schema = z.fromJSONSchema(contract as Parameters<typeof z.fromJSONSchema>[0]);
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid component ${label}: ${z.prettifyError(result.error)}`);
    }
  }
}

function validateInstanceBindings(
  instance: ComponentInstanceV2,
  definition: ComponentDefinitionV2,
) {
  const slots = new Map(definition.commerceBindingSlots.map((slot) => [slot.id, slot]));
  const seenRequired = new Set<string>();
  const seenSlots = new Set<string>();
  instance.bindings.forEach((binding) => {
    const slot = slots.get(binding.slotId);
    if (!slot) throw new Error(`Invalid commerce binding slot: ${binding.slotId}.`);
    if (seenSlots.has(binding.slotId)) {
      throw new Error(`Commerce binding slot ${binding.slotId} can only be assigned once.`);
    }
    seenSlots.add(binding.slotId);
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
  const seenAssignments = new Set<string>();
  instance.assetAssignments.forEach((assignment) => {
    const slot = slots.get(assignment.slotId);
    if (!slot) throw new Error(`Invalid asset slot: ${assignment.slotId}.`);
    if (!slot.acceptedRoles.includes(assignment.role)) {
      throw new Error(`Asset slot ${assignment.slotId} does not accept ${assignment.role}.`);
    }
    const assignmentKey = assignment.assetId;
    if (seenAssignments.has(assignmentKey)) {
      throw new Error(`Asset ${assignmentKey} cannot be assigned more than once.`);
    }
    seenAssignments.add(assignmentKey);
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

function validateBindingTargets(
  instance: ComponentInstanceV2,
  definition: ComponentDefinitionV2,
  projection: ComponentProjectionContext,
) {
  const slots = new Map(definition.commerceBindingSlots.map((slot) => [slot.id, slot]));
  const products = new Map(projection.products.map((product) => [product.productId, product]));
  const collections = new Map(
    projection.collections.map((collection) => [collection.collectionId, collection]),
  );
  const assets = new Map(projection.assets.map((asset) => [asset.assetId, asset]));
  const navigation = new Map(
    projection.navigation.map((reference) => [reference.navigationId, reference]),
  );
  const projects = new Map(
    projection.projectBrandContexts.map((reference) => [reference.projectId, reference]),
  );
  const localizedContents = new Map(
    projection.localizedContents.map((reference) => [reference.contentId, reference]),
  );

  for (const binding of instance.bindings) {
    const slot = slots.get(binding.slotId);
    if (!slot) continue;
    switch (binding.source) {
      case "product": {
        const target = products.get(binding.productId);
        if (!target) throw new Error(`Unknown product binding target: ${binding.productId}.`);
        assertBindingRevision(binding.revision, target.revision, slot);
        break;
      }
      case "productList":
        binding.productIds.forEach((productId) => {
          if (!products.has(productId)) {
            throw new Error(`Unknown product list binding target: ${productId}.`);
          }
        });
        assertBindingRevision(binding.revision, projection.productListRevision, slot);
        break;
      case "collection": {
        const target = collections.get(binding.collectionId);
        if (!target) {
          throw new Error(`Unknown collection binding target: ${binding.collectionId}.`);
        }
        assertBindingRevision(binding.revision, target.revision, slot);
        break;
      }
      case "collectionList":
        binding.collectionIds.forEach((collectionId) => {
          if (!collections.has(collectionId)) {
            throw new Error(`Unknown collection list binding target: ${collectionId}.`);
          }
        });
        assertBindingRevision(binding.revision, projection.collectionListRevision, slot);
        break;
      case "asset": {
        const target = assets.get(binding.assetId);
        if (!target) throw new Error(`Unknown asset binding target: ${binding.assetId}.`);
        if (target.approvalStatus !== "approved") {
          throw new Error(`Asset binding target is not approved: ${binding.assetId}.`);
        }
        if (binding.role !== undefined && binding.role !== target.role) {
          throw new Error(
            `Asset binding role does not match approved metadata: ${binding.assetId}.`,
          );
        }
        assertBindingRevision(binding.revision, target.revision, slot);
        break;
      }
      case "navigation": {
        const target = navigation.get(binding.navigationId);
        if (!target) {
          throw new Error(`Unknown navigation binding target: ${binding.navigationId}.`);
        }
        assertBindingRevision(binding.revision, target.revision, slot);
        break;
      }
      case "projectBrandContext": {
        const target = projects.get(binding.projectId);
        if (!target) {
          throw new Error(`Unknown project brand binding target: ${binding.projectId}.`);
        }
        if (
          binding.brandSystemRef !== undefined &&
          !target.brandSystemRefs.includes(binding.brandSystemRef)
        ) {
          throw new Error(`Unknown brand-system reference: ${binding.brandSystemRef}.`);
        }
        assertBindingRevision(binding.revision, target.revision, slot);
        break;
      }
      case "localizedContent": {
        const target = localizedContents.get(binding.contentId);
        if (!target) {
          throw new Error(`Unknown localized-content binding target: ${binding.contentId}.`);
        }
        for (const locale of [binding.locale, binding.fallbackLocale]) {
          if (locale !== undefined && !target.locales.includes(locale)) {
            throw new Error(
              `Localized-content target ${binding.contentId} does not provide ${locale}.`,
            );
          }
        }
        assertBindingRevision(binding.revision, target.revision, slot);
        break;
      }
    }
  }
}

function assertBindingRevision(
  bindingRevision: string | undefined,
  targetRevision: string | undefined,
  slot: CommerceBindingSlotDefinition,
) {
  if (slot.revisionRequired && bindingRevision !== targetRevision) {
    throw new Error(`Binding slot ${slot.id} revision must match its canonical projection target.`);
  }
}

function validateAssignedAssetInventory(
  instance: ComponentInstanceV2,
  inventory: readonly StorefrontAssetMetadata[],
) {
  const assets = new Map(inventory.map((asset) => [asset.assetId, asset]));
  for (const assignment of instance.assetAssignments) {
    const metadata = assets.get(assignment.assetId);
    if (!metadata)
      throw new Error(`Assigned asset is missing from inventory: ${assignment.assetId}.`);
    if (metadata.approvalStatus !== "approved") {
      throw new Error(`Assigned asset is not approved: ${assignment.assetId}.`);
    }
    if (metadata.role !== assignment.role) {
      throw new Error(`Assigned asset role does not match metadata: ${assignment.assetId}.`);
    }
  }
}

export function formatComponentVersion(version: ComponentVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export type MoneyDisplay = z.infer<typeof moneyDisplaySchema>;
export type ComponentDataSchemaContract = z.infer<typeof componentDataSchemaContractSchema>;
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
export type ProductListBinding = z.infer<typeof productListBindingSchema>;
export type CollectionBinding = z.infer<typeof collectionBindingSchema>;
export type CollectionListBinding = z.infer<typeof collectionListBindingSchema>;
export type AssetBinding = z.infer<typeof assetBindingSchema>;
export type NavigationBinding = z.infer<typeof navigationBindingSchema>;
export type ProjectBrandContextBinding = z.infer<typeof projectBrandContextBindingSchema>;
export type LocalizedContentBinding = z.infer<typeof localizedContentBindingSchema>;
export type PresentationBinding = z.infer<typeof presentationBindingSchema>;
export type ProductPresentationContext = z.infer<typeof productPresentationContextSchema>;
export type CollectionPresentationContext = z.infer<typeof collectionPresentationContextSchema>;
export type AssetProvenance = z.infer<typeof assetProvenanceSchema>;
export type StorefrontAssetMetadata = z.infer<typeof storefrontAssetMetadataSchema>;
export type ComponentProjectionContext = z.infer<typeof componentProjectionContextSchema>;
export type ComponentInstanceV2 = z.infer<typeof componentInstanceV2Schema>;
