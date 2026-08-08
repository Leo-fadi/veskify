import { z } from "zod";
import { assetRoleSchema } from "@/domain/shared";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";

const grammarTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(96)
  .regex(/^[a-z][A-Za-z0-9]*(?:[._-][a-z][A-Za-z0-9]*)*$/);

export const commercialDesignGrammarVersion = "1.0.0" as const;

export const commercialTypographyPostures = [
  "editorial",
  "modern",
  "technical",
  "humanist",
  "restrained",
] as const;
export const commercialTypographyPostureSchema = z.enum(commercialTypographyPostures);

export const commercialResponsiveTransformations = [
  "preserve",
  "reflow",
  "stack",
  "reorder",
  "collapse",
  "scroll",
  "condense",
  "hide-optional",
  "switch-layout",
  "simplify",
  "disclosure",
  "carousel",
] as const;
export const commercialResponsiveTransformationSchema = z.enum(commercialResponsiveTransformations);

export const commercialGrammarAuthorityLevels = [
  "brandSystem",
  "pageBlueprint",
  "componentVariant",
  "instance",
] as const;
export const commercialGrammarAuthorityLevelSchema = z.enum(commercialGrammarAuthorityLevels);

export const commercialGrammarCategoryIds = [
  "typography.posture",
  "typography.role",
  "typography.scale",
  "typography.weight",
  "typography.tracking",
  "typography.lineHeight",
  "layout.container",
  "layout.sectionRhythm",
  "layout.pageGutter",
  "layout.gridRhythm",
  "layout.alignment",
  "layout.density",
  "layout.visualWeight",
  "layout.balance",
  "surface.role",
  "action.hierarchy",
  "control.posture",
  "shape.border",
  "shape.radius",
  "shape.elevation",
  "media.ratio",
  "media.crop",
  "media.focalPoint",
  "media.overlay",
  "media.emphasis",
  "responsive.transformation",
  "narrative.role",
] as const;
export const commercialGrammarCategoryIdSchema = z.enum(commercialGrammarCategoryIds);

export const commercialGrammarCategorySchema = z
  .object({
    id: commercialGrammarCategoryIdSchema,
    domain: z.enum([
      "typography",
      "layout",
      "surface",
      "action",
      "control",
      "shape",
      "media",
      "responsive",
      "narrative",
    ]),
    values: z.array(grammarTokenSchema).min(1),
    defaultValue: grammarTokenSchema,
    primaryOwner: commercialGrammarAuthorityLevelSchema,
    narrowingLevels: z.array(commercialGrammarAuthorityLevelSchema).min(1),
    selectionLevels: z.array(commercialGrammarAuthorityLevelSchema).min(1),
    instanceOverrideAllowed: z.boolean(),
  })
  .strict()
  .superRefine((category, context) => {
    if (new Set(category.values).size !== category.values.length) {
      context.addIssue({
        code: "custom",
        path: ["values"],
        message: "Grammar values must be unique.",
      });
    }
    if (!category.values.includes(category.defaultValue)) {
      context.addIssue({
        code: "custom",
        path: ["defaultValue"],
        message: "The grammar default must be a registered value.",
      });
    }
    if (!category.selectionLevels.includes(category.primaryOwner)) {
      context.addIssue({
        code: "custom",
        path: ["selectionLevels"],
        message: "The primary owner must be allowed to select the grammar value.",
      });
    }
    if (category.instanceOverrideAllowed !== category.selectionLevels.includes("instance")) {
      context.addIssue({
        code: "custom",
        path: ["instanceOverrideAllowed"],
        message: "Instance override metadata must match the instance selection authority.",
      });
    }
  });

export type CommercialGrammarCategory = z.infer<typeof commercialGrammarCategorySchema>;

type CategoryInput = Omit<z.input<typeof commercialGrammarCategorySchema>, "domain">;

function category(domain: CommercialGrammarCategory["domain"], input: CategoryInput) {
  return commercialGrammarCategorySchema.parse({ domain, ...input });
}

const brandOwned = (
  id: CommercialGrammarCategory["id"],
  values: readonly string[],
  defaultValue: string,
  options: Partial<CategoryInput> = {},
) =>
  category(id.split(".")[0] as CommercialGrammarCategory["domain"], {
    id,
    values: [...values],
    defaultValue,
    primaryOwner: "brandSystem",
    narrowingLevels: ["brandSystem", "pageBlueprint", "componentVariant", "instance"],
    selectionLevels: ["brandSystem"],
    instanceOverrideAllowed: false,
    ...options,
  });

const pageOwned = (
  id: CommercialGrammarCategory["id"],
  values: readonly string[],
  defaultValue: string,
  options: Partial<CategoryInput> = {},
) =>
  category(id.split(".")[0] as CommercialGrammarCategory["domain"], {
    id,
    values: [...values],
    defaultValue,
    primaryOwner: "pageBlueprint",
    narrowingLevels: ["pageBlueprint", "componentVariant", "instance"],
    selectionLevels: ["pageBlueprint", "componentVariant"],
    instanceOverrideAllowed: false,
    ...options,
  });

export const commercialGrammarCategories = [
  brandOwned("typography.posture", commercialTypographyPostures, "modern"),
  brandOwned(
    "typography.role",
    ["display", "heading", "body", "utility", "price", "emphasis"],
    "body",
    {
      selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
    },
  ),
  brandOwned("typography.scale", ["compact", "balanced", "expressive"], "balanced"),
  brandOwned("typography.weight", ["light", "regular", "medium", "strong"], "regular"),
  brandOwned("typography.tracking", ["tight", "normal", "open"], "normal"),
  brandOwned("typography.lineHeight", ["tight", "balanced", "relaxed"], "balanced"),
  brandOwned("layout.container", ["reading", "content", "commerce", "wide", "full"], "content", {
    selectionLevels: ["brandSystem", "pageBlueprint"],
  }),
  pageOwned("layout.sectionRhythm", ["compact", "balanced", "expansive"], "balanced"),
  brandOwned("layout.pageGutter", ["compact", "standard", "generous"], "standard"),
  pageOwned("layout.gridRhythm", ["tight", "standard", "open"], "standard"),
  pageOwned("layout.alignment", ["start", "center", "end", "split"], "start", {
    selectionLevels: ["pageBlueprint", "componentVariant", "instance"],
    instanceOverrideAllowed: true,
  }),
  brandOwned("layout.density", ["compact", "standard", "spacious"], "standard", {
    selectionLevels: ["brandSystem", "pageBlueprint"],
  }),
  pageOwned("layout.visualWeight", ["light", "medium", "heavy", "dominant"], "medium", {
    selectionLevels: ["pageBlueprint", "componentVariant", "instance"],
    instanceOverrideAllowed: true,
  }),
  pageOwned("layout.balance", ["symmetric", "asymmetric", "editorial"], "symmetric"),
  brandOwned(
    "surface.role",
    [
      "background",
      "surface",
      "plain",
      "muted",
      "subtle",
      "elevated",
      "contrast",
      "accent",
      "bordered",
      "inset",
      "overlay",
    ],
    "surface",
    {
      selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
    },
  ),
  brandOwned(
    "action.hierarchy",
    ["primary", "secondary", "tertiary", "text-link", "quiet"],
    "primary",
    {
      selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
    },
  ),
  brandOwned("control.posture", ["compact", "standard", "prominent"], "standard", {
    selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
  }),
  brandOwned("shape.border", ["none", "subtle", "defined", "strong"], "subtle", {
    selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
  }),
  brandOwned("shape.radius", ["square", "subtle", "rounded", "pill"], "subtle", {
    selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
  }),
  brandOwned("shape.elevation", ["flat", "subtle", "raised", "floating"], "flat", {
    selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
  }),
  brandOwned("media.ratio", ["natural", "square", "portrait", "landscape", "wide"], "natural", {
    selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
  }),
  brandOwned("media.crop", ["contain", "cover", "editorial", "artDirected"], "contain", {
    selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
  }),
  brandOwned("media.focalPoint", ["source", "center", "subject", "artDirected"], "source", {
    selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
  }),
  brandOwned("media.overlay", ["none", "subtle", "contrast", "gradient"], "none", {
    selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
  }),
  brandOwned("media.emphasis", ["supporting", "balanced", "leading", "immersive"], "balanced", {
    selectionLevels: ["brandSystem", "pageBlueprint", "componentVariant"],
  }),
  pageOwned("responsive.transformation", commercialResponsiveTransformations, "reflow"),
  pageOwned(
    "narrative.role",
    [
      "introduction",
      "discovery",
      "merchandising",
      "campaign",
      "editorial",
      "proof",
      "service",
      "conversion",
      "continuation",
      "utility",
    ],
    "continuation",
    { selectionLevels: ["pageBlueprint"] },
  ),
] as const satisfies readonly CommercialGrammarCategory[];

export const commercialGrammarCompatibilityRelationSchema = z.enum([
  "allowed",
  "prohibited",
  "requires",
  "mutuallyExclusive",
  "narrowingIntersection",
]);

export const commercialGrammarMediaRequirements = [
  "none",
  "approvedAsset",
  "canonicalProductMedia",
  "responsiveDerivative",
] as const;
export const commercialGrammarMediaRequirementSchema = z.enum(commercialGrammarMediaRequirements);

export const commercialGrammarCompatibilityReferenceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("grammarValue"),
      categoryId: commercialGrammarCategoryIdSchema,
      value: grammarTokenSchema,
    })
    .strict(),
  z.object({ kind: z.literal("pageBlueprintProfile"), profileId: grammarTokenSchema }).strict(),
  z.object({ kind: z.literal("componentFamily"), family: grammarTokenSchema }).strict(),
  z
    .object({
      kind: z.literal("componentVariant"),
      componentType: grammarTokenSchema,
      variant: grammarTokenSchema,
    })
    .strict(),
  z.object({ kind: z.literal("responsiveMode"), value: grammarTokenSchema }).strict(),
  z.object({ kind: z.literal("narrativeRole"), value: grammarTokenSchema }).strict(),
  z.object({ kind: z.literal("assetRole"), value: grammarTokenSchema }).strict(),
  z
    .object({
      kind: z.literal("mediaRequirement"),
      value: commercialGrammarMediaRequirementSchema,
    })
    .strict(),
]);

export const commercialGrammarCompatibilityRuleSchema = z
  .object({
    id: grammarTokenSchema,
    relation: commercialGrammarCompatibilityRelationSchema,
    left: commercialGrammarCompatibilityReferenceSchema,
    right: commercialGrammarCompatibilityReferenceSchema,
  })
  .strict();

export type CommercialGrammarCompatibilityRule = z.infer<
  typeof commercialGrammarCompatibilityRuleSchema
>;
export type CommercialGrammarCompatibilityReference = z.infer<
  typeof commercialGrammarCompatibilityReferenceSchema
>;

export const commercialGrammarCompatibilityRules = [
  {
    id: "editorialTypographyAllowsWideContainer",
    relation: "allowed",
    left: { kind: "grammarValue", categoryId: "typography.posture", value: "editorial" },
    right: { kind: "grammarValue", categoryId: "layout.container", value: "wide" },
  },
  {
    id: "artDirectedCropProtectsCanonicalProductMedia",
    relation: "prohibited",
    left: { kind: "grammarValue", categoryId: "media.crop", value: "artDirected" },
    right: { kind: "mediaRequirement", value: "canonicalProductMedia" },
  },
  {
    id: "artDirectedCropRequiresApprovedAsset",
    relation: "requires",
    left: { kind: "grammarValue", categoryId: "media.crop", value: "artDirected" },
    right: { kind: "mediaRequirement", value: "approvedAsset" },
  },
  {
    id: "artDirectedFocalPointExcludesCanonicalProductMediaMutation",
    relation: "mutuallyExclusive",
    left: { kind: "grammarValue", categoryId: "media.focalPoint", value: "artDirected" },
    right: { kind: "mediaRequirement", value: "canonicalProductMedia" },
  },
  {
    id: "responsiveReflowUsesNarrowingIntersection",
    relation: "narrowingIntersection",
    left: { kind: "responsiveMode", value: "reflow" },
    right: { kind: "grammarValue", categoryId: "responsive.transformation", value: "reflow" },
  },
] as const satisfies readonly CommercialGrammarCompatibilityRule[];

export type CommercialGrammarLayer = Readonly<{
  level: z.infer<typeof commercialGrammarAuthorityLevelSchema>;
  constraints?: Readonly<Record<string, readonly string[]>>;
  selections?: Readonly<Record<string, string>>;
}>;

export type CommercialGrammarIssueCode =
  | "UNKNOWN_GRAMMAR_CATEGORY"
  | "UNKNOWN_GRAMMAR_VALUE"
  | "UNKNOWN_PAGE_BLUEPRINT_PROFILE"
  | "UNKNOWN_COMPONENT_FAMILY"
  | "UNKNOWN_COMPONENT_TYPE"
  | "UNKNOWN_COMPONENT_VARIANT"
  | "UNKNOWN_RESPONSIVE_MODE"
  | "UNKNOWN_NARRATIVE_ROLE"
  | "UNKNOWN_ASSET_ROLE"
  | "UNKNOWN_MEDIA_REQUIREMENT"
  | "INVALID_COMPATIBILITY_INPUT"
  | "DUPLICATE_GRAMMAR_AUTHORITY_LEVEL"
  | "UNBOUNDED_DESIGN_VALUE"
  | "PROHIBITED_GRAMMAR_AUTHORITY"
  | "ILLEGAL_GRAMMAR_BROADENING"
  | "CONFLICTING_GRAMMAR_CONSTRAINT"
  | "INCOMPATIBLE_GRAMMAR_SELECTION"
  | "MISSING_GRAMMAR_REQUIREMENT";

export type CommercialGrammarIssue = Readonly<{
  code: CommercialGrammarIssueCode;
  categoryId?: string;
  level?: z.infer<typeof commercialGrammarAuthorityLevelSchema>;
  ruleId?: string;
  authorityKind?: string;
  authorityId?: string;
  message: string;
}>;

export type CommercialGrammarResolution = Readonly<{
  values: Readonly<Record<string, string>>;
  allowedValues: Readonly<Record<string, readonly string[]>>;
  issues: readonly CommercialGrammarIssue[];
  fingerprint: string;
}>;

export type CommercialGrammarValueCompatibility = Readonly<{
  categoryId: CommercialGrammarCategory["id"];
  value: string;
  defaultRelation: "allowed";
  ruleIds: readonly string[];
}>;

export type CommercialGrammarCapability = Readonly<{
  version: typeof commercialDesignGrammarVersion;
  categories: readonly CommercialGrammarCategory[];
  compatibilityRules: readonly CommercialGrammarCompatibilityRule[];
  valueCompatibility: readonly CommercialGrammarValueCompatibility[];
  fingerprint: string;
}>;

export type CommercialGrammarCompatibilityInput = Readonly<{
  values: Readonly<Record<string, string>>;
  profileId?: string;
  componentFamily?: string;
  componentType?: string;
  variant?: string;
  responsiveMode?: string;
  narrativeRole?: string;
  assetRoles?: readonly string[];
  mediaRequirements?: readonly string[];
}>;

export type CommercialGrammarCompatibilityAuthority = Readonly<{
  hasPageBlueprintProfile: (profileId: string) => boolean;
  hasComponentFamily: (family: string) => boolean;
  getComponent: (
    componentType: string,
  ) => Readonly<{ family: string; variants: readonly string[] }> | undefined;
}>;

const commercialGrammarCompatibilityInputSchema = z
  .object({
    values: z.record(z.string(), z.string()),
    profileId: z.string().optional(),
    componentFamily: z.string().optional(),
    componentType: z.string().optional(),
    variant: z.string().optional(),
    responsiveMode: z.string().optional(),
    narrativeRole: z.string().optional(),
    assetRoles: z.array(z.string()).optional(),
    mediaRequirements: z.array(z.string()).optional(),
  })
  .strict();

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

function looksUnbounded(value: string): boolean {
  return /[{};]|(?:^|\s)(?:class|style|css|react|javascript)(?:\s|$)/i.test(value);
}

function compareCanonicalStrings(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function canonicalizeIssues(issues: readonly CommercialGrammarIssue[]): CommercialGrammarIssue[] {
  return [...issues].sort((left, right) =>
    compareCanonicalStrings(
      canonicalValueString({
        code: left.code,
        categoryId: left.categoryId ?? "",
        level: left.level ?? "",
        ruleId: left.ruleId ?? "",
        authorityKind: left.authorityKind ?? "",
        authorityId: left.authorityId ?? "",
        message: left.message,
      }),
      canonicalValueString({
        code: right.code,
        categoryId: right.categoryId ?? "",
        level: right.level ?? "",
        ruleId: right.ruleId ?? "",
        authorityKind: right.authorityKind ?? "",
        authorityId: right.authorityId ?? "",
        message: right.message,
      }),
    ),
  );
}

export function createCommercialGrammarCapability(): CommercialGrammarCapability {
  const categories = [...commercialGrammarCategories]
    .map((entry) => commercialGrammarCategorySchema.parse(entry))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => ({
      ...entry,
      values: [...entry.values].sort(),
      narrowingLevels: [...entry.narrowingLevels].sort(),
      selectionLevels: [...entry.selectionLevels].sort(),
    }));
  if (new Set(categories.map((entry) => entry.id)).size !== categories.length) {
    throw new Error("Commercial grammar category identities must be unique.");
  }
  const compatibilityRules = [...commercialGrammarCompatibilityRules]
    .map((entry) => commercialGrammarCompatibilityRuleSchema.parse(entry))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(compatibilityRules.map((entry) => entry.id)).size !== compatibilityRules.length) {
    throw new Error("Commercial grammar compatibility rule identities must be unique.");
  }
  const categoriesById = new Map(categories.map((entry) => [entry.id, entry]));
  for (const rule of compatibilityRules) {
    for (const reference of [rule.left, rule.right]) {
      if (reference.kind === "grammarValue") {
        const definition = categoriesById.get(reference.categoryId);
        if (!definition?.values.includes(reference.value)) {
          throw new Error(
            `Commercial grammar rule ${rule.id} references unknown ${reference.categoryId}/${reference.value}.`,
          );
        }
      }
      if (
        reference.kind === "responsiveMode" &&
        !categoriesById.get("responsive.transformation")?.values.includes(reference.value)
      ) {
        throw new Error(
          `Commercial grammar rule ${rule.id} references unknown responsive mode ${reference.value}.`,
        );
      }
      if (
        reference.kind === "narrativeRole" &&
        !categoriesById.get("narrative.role")?.values.includes(reference.value)
      ) {
        throw new Error(
          `Commercial grammar rule ${rule.id} references unknown narrative role ${reference.value}.`,
        );
      }
    }
  }
  const ruleReferencesValue = (
    reference: CommercialGrammarCompatibilityReference,
    categoryId: CommercialGrammarCategory["id"],
    value: string,
  ) =>
    (reference.kind === "grammarValue" &&
      reference.categoryId === categoryId &&
      reference.value === value) ||
    (categoryId === "responsive.transformation" &&
      reference.kind === "responsiveMode" &&
      reference.value === value) ||
    (categoryId === "narrative.role" &&
      reference.kind === "narrativeRole" &&
      reference.value === value);
  const valueCompatibility = categories.flatMap((category) =>
    category.values.map((value) => ({
      categoryId: category.id,
      value,
      defaultRelation: "allowed" as const,
      ruleIds: compatibilityRules
        .filter(
          (rule) =>
            ruleReferencesValue(rule.left, category.id, value) ||
            ruleReferencesValue(rule.right, category.id, value),
        )
        .map((rule) => rule.id)
        .sort(),
    })),
  );
  const content = {
    version: commercialDesignGrammarVersion,
    categories,
    compatibilityRules,
    valueCompatibility,
  };
  return deepFreeze({
    ...content,
    fingerprint: `commercial-design-grammar-${canonicalValueFingerprint(canonicalValueString(content))}`,
  });
}

function issueForUnknown(categoryId: string, value?: string): CommercialGrammarIssue {
  if (value !== undefined && looksUnbounded(value)) {
    return {
      code: "UNBOUNDED_DESIGN_VALUE",
      categoryId,
      message: `Unbounded CSS, class, code, or style values are not permitted for ${categoryId}.`,
    };
  }
  return value === undefined
    ? {
        code: "UNKNOWN_GRAMMAR_CATEGORY",
        categoryId,
        message: `Commercial grammar category ${categoryId} is not registered.`,
      }
    : {
        code: "UNKNOWN_GRAMMAR_VALUE",
        categoryId,
        message: `Commercial grammar value ${categoryId}/${value} is not registered.`,
      };
}

export function resolveCommercialGrammarInheritance(
  capability: CommercialGrammarCapability,
  layers: readonly CommercialGrammarLayer[],
): CommercialGrammarResolution {
  const definitions = new Map(capability.categories.map((entry) => [entry.id, entry]));
  const allowedById = new Map(capability.categories.map((entry) => [entry.id, [...entry.values]]));
  const selectedById = new Map(
    capability.categories.map((entry) => [entry.id, entry.defaultValue]),
  );
  const issues: CommercialGrammarIssue[] = [];
  const levelOrder = new Map(
    commercialGrammarAuthorityLevels.map((level, index) => [level, index]),
  );
  const duplicateLevels = commercialGrammarAuthorityLevels.filter(
    (level) => layers.filter((layer) => layer.level === level).length > 1,
  );
  if (duplicateLevels.length > 0) {
    const duplicateIssues = canonicalizeIssues(
      duplicateLevels.map((level) => ({
        code: "DUPLICATE_GRAMMAR_AUTHORITY_LEVEL" as const,
        level,
        authorityKind: "grammarAuthorityLevel",
        authorityId: level,
        message: `More than one ${level} commercial grammar authority layer is not permitted.`,
      })),
    );
    const values = Object.fromEntries(
      [...selectedById].sort(([left], [right]) => left.localeCompare(right)),
    );
    const allowedValues = Object.fromEntries(
      [...allowedById]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, valuesForId]) => [id, [...valuesForId].sort()]),
    );
    const content = { values, allowedValues, issues: duplicateIssues };
    return deepFreeze({
      ...content,
      fingerprint: `commercial-design-selection-${canonicalValueFingerprint(canonicalValueString(content))}`,
    });
  }
  const ordered = [...layers].sort(
    (left, right) => (levelOrder.get(left.level) ?? 99) - (levelOrder.get(right.level) ?? 99),
  );

  for (const layer of ordered) {
    for (const [categoryId, requestedValues] of Object.entries(layer.constraints ?? {})) {
      const definition = definitions.get(categoryId as CommercialGrammarCategory["id"]);
      if (!definition) {
        issues.push(issueForUnknown(categoryId));
        continue;
      }
      const unknown = requestedValues.find((value) => !definition.values.includes(value));
      if (unknown !== undefined) {
        issues.push({ ...issueForUnknown(categoryId, unknown), level: layer.level });
        continue;
      }
      if (!definition.narrowingLevels.includes(layer.level)) {
        issues.push({
          code: "PROHIBITED_GRAMMAR_AUTHORITY",
          categoryId,
          level: layer.level,
          message: `${layer.level} cannot constrain ${categoryId}.`,
        });
        continue;
      }
      const parentValues = allowedById.get(definition.id) ?? [];
      if (requestedValues.some((value) => !parentValues.includes(value))) {
        issues.push({
          code: "ILLEGAL_GRAMMAR_BROADENING",
          categoryId,
          level: layer.level,
          message: `${layer.level} broadens the inherited values for ${categoryId}.`,
        });
        continue;
      }
      const intersection = parentValues.filter((value) => requestedValues.includes(value));
      if (intersection.length === 0) {
        issues.push({
          code: "CONFLICTING_GRAMMAR_CONSTRAINT",
          categoryId,
          level: layer.level,
          message: `${layer.level} creates an empty compatibility intersection for ${categoryId}.`,
        });
        continue;
      }
      allowedById.set(definition.id, intersection);
    }

    for (const [categoryId, value] of Object.entries(layer.selections ?? {})) {
      const definition = definitions.get(categoryId as CommercialGrammarCategory["id"]);
      if (!definition) {
        issues.push(issueForUnknown(categoryId));
        continue;
      }
      if (!definition.values.includes(value)) {
        issues.push({ ...issueForUnknown(categoryId, value), level: layer.level });
        continue;
      }
      if (!definition.selectionLevels.includes(layer.level)) {
        issues.push({
          code: "PROHIBITED_GRAMMAR_AUTHORITY",
          categoryId,
          level: layer.level,
          message: `${layer.level} cannot select ${categoryId}.`,
        });
        continue;
      }
      if (!(allowedById.get(definition.id) ?? []).includes(value)) {
        issues.push({
          code: "CONFLICTING_GRAMMAR_CONSTRAINT",
          categoryId,
          level: layer.level,
          message: `${layer.level} selected ${categoryId}/${value} outside inherited authority.`,
        });
        continue;
      }
      selectedById.set(definition.id, value);
    }
  }

  for (const definition of capability.categories) {
    const selected = selectedById.get(definition.id);
    const allowed = allowedById.get(definition.id) ?? [];
    if (selected !== undefined && !allowed.includes(selected)) {
      issues.push({
        code: "CONFLICTING_GRAMMAR_CONSTRAINT",
        categoryId: definition.id,
        message: `Inherited constraints exclude the selected ${definition.id}/${selected} value.`,
      });
    }
  }

  const values = Object.fromEntries(
    [...selectedById].sort(([left], [right]) => left.localeCompare(right)),
  );
  const allowedValues = Object.fromEntries(
    [...allowedById]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, valuesForId]) => [id, [...valuesForId].sort()]),
  );
  const canonicalIssues = canonicalizeIssues(issues);
  const content = { values, allowedValues, issues: canonicalIssues };
  return deepFreeze({
    ...content,
    fingerprint: `commercial-design-selection-${canonicalValueFingerprint(canonicalValueString(content))}`,
  });
}

function referenceIsActive(
  reference: CommercialGrammarCompatibilityReference,
  input: CommercialGrammarCompatibilityInput,
): boolean {
  switch (reference.kind) {
    case "grammarValue":
      return input.values[reference.categoryId] === reference.value;
    case "pageBlueprintProfile":
      return input.profileId === reference.profileId;
    case "componentFamily":
      return input.componentFamily === reference.family;
    case "componentVariant":
      return input.componentType === reference.componentType && input.variant === reference.variant;
    case "responsiveMode":
      return input.responsiveMode === reference.value;
    case "narrativeRole":
      return input.narrativeRole === reference.value;
    case "assetRole":
      return input.assetRoles?.includes(reference.value) ?? false;
    case "mediaRequirement":
      return input.mediaRequirements?.includes(reference.value) ?? false;
  }
}

function compatibilityAuthorityIssue(
  code: CommercialGrammarIssueCode,
  authorityKind: string,
  authorityId: string,
  message: string,
): CommercialGrammarIssue {
  return { code, authorityKind, authorityId, message };
}

function validateCommercialGrammarCompatibilityInput(
  capability: CommercialGrammarCapability,
  authority: CommercialGrammarCompatibilityAuthority,
  input: unknown,
): Readonly<
  | { success: true; input: CommercialGrammarCompatibilityInput }
  | { success: false; issues: readonly CommercialGrammarIssue[] }
> {
  const parsed = commercialGrammarCompatibilityInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: [
        {
          code: "INVALID_COMPATIBILITY_INPUT",
          authorityKind: "compatibilityInput",
          authorityId: "input",
          message: "Commercial grammar compatibility input is structurally invalid.",
        },
      ],
    };
  }

  const normalized: CommercialGrammarCompatibilityInput = {
    ...parsed.data,
    values: Object.fromEntries(
      Object.entries(parsed.data.values).sort(([left], [right]) =>
        compareCanonicalStrings(left, right),
      ),
    ),
    ...(parsed.data.assetRoles === undefined
      ? {}
      : { assetRoles: [...parsed.data.assetRoles].sort(compareCanonicalStrings) }),
    ...(parsed.data.mediaRequirements === undefined
      ? {}
      : {
          mediaRequirements: [...parsed.data.mediaRequirements].sort(compareCanonicalStrings),
        }),
  };
  const categoriesById = new Map(capability.categories.map((category) => [category.id, category]));
  const issues: CommercialGrammarIssue[] = [];

  for (const [categoryId, value] of Object.entries(normalized.values)) {
    const category = categoriesById.get(categoryId as CommercialGrammarCategory["id"]);
    if (!category) {
      issues.push(issueForUnknown(categoryId));
    } else if (!category.values.includes(value)) {
      issues.push(issueForUnknown(categoryId, value));
    }
  }
  if (normalized.profileId && !authority.hasPageBlueprintProfile(normalized.profileId)) {
    issues.push(
      compatibilityAuthorityIssue(
        "UNKNOWN_PAGE_BLUEPRINT_PROFILE",
        "pageBlueprintProfile",
        normalized.profileId,
        `Executable PageBlueprint profile ${normalized.profileId} is not registered in current authority.`,
      ),
    );
  }
  if (normalized.componentFamily && !authority.hasComponentFamily(normalized.componentFamily)) {
    issues.push(
      compatibilityAuthorityIssue(
        "UNKNOWN_COMPONENT_FAMILY",
        "componentFamily",
        normalized.componentFamily,
        `Component family ${normalized.componentFamily} is not registered in current authority.`,
      ),
    );
  }
  const component = normalized.componentType
    ? authority.getComponent(normalized.componentType)
    : undefined;
  if (normalized.componentType && !component) {
    issues.push(
      compatibilityAuthorityIssue(
        "UNKNOWN_COMPONENT_TYPE",
        "componentType",
        normalized.componentType,
        `Component type ${normalized.componentType} is not registered in current authority.`,
      ),
    );
  }
  if (
    component &&
    normalized.componentFamily &&
    authority.hasComponentFamily(normalized.componentFamily) &&
    component.family !== normalized.componentFamily
  ) {
    issues.push(
      compatibilityAuthorityIssue(
        "INCOMPATIBLE_GRAMMAR_SELECTION",
        "componentFamily",
        `${normalized.componentType}:${normalized.componentFamily}`,
        `Component ${normalized.componentType} belongs to ${component.family}, not ${normalized.componentFamily}.`,
      ),
    );
  }
  if (normalized.variant) {
    if (!component || !component.variants.includes(normalized.variant)) {
      issues.push(
        compatibilityAuthorityIssue(
          "UNKNOWN_COMPONENT_VARIANT",
          "componentVariant",
          `${normalized.componentType ?? "missing-component"}:${normalized.variant}`,
          `Component variant ${normalized.componentType ?? "<missing>"}/${normalized.variant} is not registered in current authority.`,
        ),
      );
    }
  }
  const responsiveValues = categoriesById.get("responsive.transformation")?.values ?? [];
  if (normalized.responsiveMode && !responsiveValues.includes(normalized.responsiveMode)) {
    issues.push(
      compatibilityAuthorityIssue(
        "UNKNOWN_RESPONSIVE_MODE",
        "responsiveMode",
        normalized.responsiveMode,
        `Responsive mode ${normalized.responsiveMode} is not registered in commercial grammar authority.`,
      ),
    );
  }
  const narrativeValues = categoriesById.get("narrative.role")?.values ?? [];
  if (normalized.narrativeRole && !narrativeValues.includes(normalized.narrativeRole)) {
    issues.push(
      compatibilityAuthorityIssue(
        "UNKNOWN_NARRATIVE_ROLE",
        "narrativeRole",
        normalized.narrativeRole,
        `Narrative role ${normalized.narrativeRole} is not registered in commercial grammar authority.`,
      ),
    );
  }
  for (const assetRole of normalized.assetRoles ?? []) {
    if (!assetRoleSchema.safeParse(assetRole).success) {
      issues.push(
        compatibilityAuthorityIssue(
          "UNKNOWN_ASSET_ROLE",
          "assetRole",
          assetRole,
          `Asset role ${assetRole} is not registered in canonical asset-role authority.`,
        ),
      );
    }
  }
  for (const mediaRequirement of normalized.mediaRequirements ?? []) {
    if (!commercialGrammarMediaRequirementSchema.safeParse(mediaRequirement).success) {
      issues.push(
        compatibilityAuthorityIssue(
          "UNKNOWN_MEDIA_REQUIREMENT",
          "mediaRequirement",
          mediaRequirement,
          `Media requirement ${mediaRequirement} is not registered in commercial grammar authority.`,
        ),
      );
    }
  }

  const canonicalIssues = canonicalizeIssues(issues);
  return canonicalIssues.length > 0
    ? { success: false, issues: canonicalIssues }
    : { success: true, input: deepFreeze(normalized) };
}

export function evaluateCommercialGrammarCompatibility(
  capability: CommercialGrammarCapability,
  authority: CommercialGrammarCompatibilityAuthority,
  input: CommercialGrammarCompatibilityInput,
): readonly CommercialGrammarIssue[] {
  const validation = validateCommercialGrammarCompatibilityInput(capability, authority, input);
  if (!validation.success) return deepFreeze(validation.issues);
  const issues: CommercialGrammarIssue[] = [];
  for (const rule of capability.compatibilityRules) {
    const left = referenceIsActive(rule.left, validation.input);
    const right = referenceIsActive(rule.right, validation.input);
    if (
      (rule.relation === "prohibited" || rule.relation === "mutuallyExclusive") &&
      left &&
      right
    ) {
      issues.push({
        code: "INCOMPATIBLE_GRAMMAR_SELECTION",
        ruleId: rule.id,
        message: `Commercial grammar compatibility rule ${rule.id} rejected the selected combination.`,
      });
    }
    if (rule.relation === "requires" && left && !right) {
      issues.push({
        code: "MISSING_GRAMMAR_REQUIREMENT",
        ruleId: rule.id,
        message: `Commercial grammar compatibility rule ${rule.id} requires additional authority.`,
      });
    }
    if (rule.relation === "narrowingIntersection" && left !== right) {
      issues.push({
        code: "CONFLICTING_GRAMMAR_CONSTRAINT",
        ruleId: rule.id,
        message: `Commercial grammar narrowing rule ${rule.id} has no active intersection.`,
      });
    }
  }
  return deepFreeze(canonicalizeIssues(issues));
}
