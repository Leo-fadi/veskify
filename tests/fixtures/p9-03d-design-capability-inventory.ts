import { storefrontDesignSystemV1 } from "@/application/storefront-design-system";
import { storefrontTemplateDefinitions } from "@/application/storefront-templates";
import type { ComponentDefinitionV2, ResponsiveRule } from "@/domain/component-platform";
import { veskifyComponentRegistry } from "@/components/registry";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";

export type P903dCapabilityStatus =
  | "fully reachable"
  | "registered but unreachable"
  | "planner-visible but lost during compilation"
  | "render-only"
  | "incomplete"
  | "missing";

type RenderingReachability = "shared renderer" | "declared renderer without route bridge" | "none";

export type P903dCapabilityProvenance = Readonly<{
  source: string;
  evidence: string;
}>;

export type P903dComponentVariantRecord = Readonly<{
  canonicalId: string;
  version: string;
  registrationSource: string;
  requiredBindings: readonly string[];
  supportedPageTypes: readonly string[];
  responsiveContract: readonly ResponsiveRule[];
  accessibilityContract: readonly string[];
  plannerExposure: Readonly<{
    recipeIds: readonly string[];
    blueprintIds: readonly string[];
    directionIds: readonly string[];
    advertisedToRealProvider: true;
  }>;
  deterministicSelectionEvidence: readonly string[];
  realProviderSchemaExposure: "registry-advertised" | "registry-and-direction-option";
  proposalCompilerPreservation:
    | "preserved directly"
    | "preserved by coordinated proposal compiler"
    | "dropped by dynamic-page replacement"
    | "recipe variant is not compiled; source is retained"
    | "overridden by coordinated component selection"
    | "not selectable";
  canonicalSnapshotBoundary: string;
  editorRendering: RenderingReachability;
  previewRendering: RenderingReachability;
  publishedRendering: RenderingReachability;
  status: P903dCapabilityStatus;
}>;

export type P903dSystemCapabilityRecord = Readonly<{
  canonicalId: string;
  version: string;
  provenance: readonly P903dCapabilityProvenance[];
  requiredBindings: readonly string[];
  supportedPageTypes: readonly string[];
  responsiveContract: string;
  accessibilityContract: string;
  plannerExposure: string;
  deterministicSelectionEvidence: readonly string[];
  realProviderSchemaExposure: string;
  proposalCompilerPreservation: string;
  editorRendering: string;
  previewRendering: string;
  publishedRendering: string;
  responsiveEvidenceVariantCount: number | null;
  status: P903dCapabilityStatus;
}>;

const dynamicPageReplacementTypes = new Set([
  "collectionHeader",
  "filterBar",
  "productGallery",
  "productInfo",
  "productOptions",
]);

type P903dDirection = (typeof storefrontDesignSystemV1.directions)[number];

export type P903dReachabilityEvidence = Readonly<{
  directions?: readonly P903dDirection[];
  canonicalRouteComponentTypes?: readonly string[];
}>;

function auditDirections(evidence: P903dReachabilityEvidence): readonly P903dDirection[] {
  return evidence.directions ?? storefrontDesignSystemV1.directions;
}

function canonicalRouteComponentTypes(evidence: P903dReachabilityEvidence): ReadonlySet<string> {
  return new Set(evidence.canonicalRouteComponentTypes ?? Object.keys(veskifyComponentRegistry));
}

export function preserveResponsiveRules(
  rules: readonly ResponsiveRule[],
): readonly ResponsiveRule[] {
  return rules.map((rule) => structuredClone(rule));
}

function versionString(version: { major: number; minor: number; patch: number }): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function sourceFor(type: string): string {
  if (type === "dynamicCollectionCommerce") {
    return "src/components/registry/dynamic-collection-commerce.ts";
  }
  if (type === "dynamicProductDetail") {
    return "src/components/registry/dynamic-product-detail.ts";
  }
  if (!Object.hasOwn(veskifyComponentRegistry, type)) {
    return "src/components/registry/homepage-commerce.ts";
  }
  return "src/components/registry/registry.ts via v2-compatibility.ts";
}

function recipeIds(type: string, variant: string): string[] {
  return [
    ...storefrontDesignSystemV1.homepageRecipes,
    ...storefrontDesignSystemV1.collectionRecipes,
    ...storefrontDesignSystemV1.productRecipes,
  ]
    .filter((recipe) =>
      recipe.sections.some((section) => section.component === type && section.variant === variant),
    )
    .map((recipe) => recipe.id)
    .sort();
}

function blueprintIds(type: string, variant: string): string[] {
  return storefrontTemplateDefinitions
    .filter((template) =>
      template.pagePlans.some((page) =>
        page.slots.some(
          (slot) => slot.sectionType === type && slot.allowedVariants.includes(variant),
        ),
      ),
    )
    .map((template) => template.id)
    .sort();
}

function selectedDirectionVariant(direction: P903dDirection, type: string): string | undefined {
  return Object.values(direction.componentSelections).find(
    (selection) => selection.component === type,
  )?.variant;
}

function directionIds(
  type: string,
  variant: string,
  evidence: P903dReachabilityEvidence,
): string[] {
  return auditDirections(evidence)
    .filter((direction) => {
      return selectedDirectionVariant(direction, type) === variant;
    })
    .map((direction) => direction.id)
    .sort();
}

function selectedRecipeDirectionIds(
  type: string,
  variant: string,
  evidence: P903dReachabilityEvidence,
): string[] {
  const recipes = [
    ...storefrontDesignSystemV1.homepageRecipes,
    ...storefrontDesignSystemV1.collectionRecipes,
    ...storefrontDesignSystemV1.productRecipes,
  ];
  return auditDirections(evidence)
    .filter((direction) => {
      const selectedRecipeIds = [
        direction.homepageRecipeId,
        direction.collectionRecipeId,
        direction.productRecipeId,
      ];
      return recipes.some(
        (recipe) =>
          selectedRecipeIds.includes(recipe.id) &&
          recipe.sections.some(
            (section) => section.component === type && section.variant === variant,
          ),
      );
    })
    .map((direction) => direction.id)
    .sort();
}

function compilerPreservation(
  type: string,
  variant: string,
  directions: readonly string[],
  recipeDirections: readonly string[],
  evidence: P903dReachabilityEvidence,
): P903dComponentVariantRecord["proposalCompilerPreservation"] {
  if (directions.length > 0 && dynamicPageReplacementTypes.has(type)) {
    return "dropped by dynamic-page replacement";
  }
  if (
    directions.length > 0 &&
    (type === "dynamicCollectionCommerce" || type === "dynamicProductDetail")
  ) {
    return "preserved directly";
  }
  if (directions.length > 0) return "preserved by coordinated proposal compiler";
  if (recipeDirections.length === 0) return "not selectable";
  const recipeOverrides = recipeDirections.some((directionId) => {
    const direction = auditDirections(evidence).find((candidate) => candidate.id === directionId);
    return direction !== undefined && selectedDirectionVariant(direction, type) !== undefined;
  });
  return recipeOverrides
    ? "overridden by coordinated component selection"
    : "recipe variant is not compiled; source is retained";
}

function rendering(
  definition: ComponentDefinitionV2,
  target: "editor" | "preview" | "published",
  evidence: P903dReachabilityEvidence,
): RenderingReachability {
  if (!definition.renderer.supportedTargets.includes(target)) return "none";
  return canonicalRouteComponentTypes(evidence).has(definition.type)
    ? "shared renderer"
    : "declared renderer without route bridge";
}

function classification(
  rendererTargets: readonly RenderingReachability[],
  directions: readonly string[],
  preservation: P903dComponentVariantRecord["proposalCompilerPreservation"],
): P903dCapabilityStatus {
  if (rendererTargets.some((target) => target !== "shared renderer")) return "render-only";
  if (
    preservation === "dropped by dynamic-page replacement" ||
    preservation === "recipe variant is not compiled; source is retained" ||
    preservation === "overridden by coordinated component selection"
  ) {
    return "planner-visible but lost during compilation";
  }
  if (
    directions.length > 0 &&
    (preservation === "preserved directly" ||
      preservation === "preserved by coordinated proposal compiler")
  ) {
    return "fully reachable";
  }
  return "registered but unreachable";
}

function canonicalBoundary(
  type: string,
  status: P903dCapabilityStatus,
  preservation: P903dComponentVariantRecord["proposalCompilerPreservation"],
): string {
  if (status === "render-only") {
    return "No canonical SectionInstance, planner recipe, or Puck bridge reaches this V2 renderer.";
  }
  if (status === "registered but unreachable") {
    return "The real-provider request advertises the variant, but exact-plan validation exposes no direction that can select it.";
  }
  if (preservation === "dropped by dynamic-page replacement") {
    return "createWholeStorefrontGenerationPlan replaces the legacy collection/PDP section before proposal compilation.";
  }
  if (preservation === "recipe variant is not compiled; source is retained") {
    return "The selected recipe carries the announcement variant, but componentSelections has no announcement selection; the planner retains the source variant.";
  }
  if (preservation === "overridden by coordinated component selection") {
    return "A selected recipe variant conflicts with its coordinated component selection before the canonical proposal snapshot.";
  }
  if (preservation === "preserved by coordinated proposal compiler") {
    return "coordinatedRuntimeComponent applies the registered componentSelections entry before the canonical proposal snapshot.";
  }
  return "The planner creates the V2 instance and the proposal compiler preserves its variant and presentation props.";
}

export function createP903dComponentVariantInventory(
  evidence: P903dReachabilityEvidence = {},
): P903dComponentVariantRecord[] {
  return veskifyComponentDefinitionsV2
    .flatMap((definition) =>
      definition.variants.map((variant) => {
        const directions = directionIds(definition.type, variant.id, evidence);
        const recipeDirections = selectedRecipeDirectionIds(definition.type, variant.id, evidence);
        const preservation = compilerPreservation(
          definition.type,
          variant.id,
          directions,
          recipeDirections,
          evidence,
        );
        const editorRendering = rendering(definition, "editor", evidence);
        const previewRendering = rendering(definition, "preview", evidence);
        const publishedRendering = rendering(definition, "published", evidence);
        const status = classification(
          [editorRendering, previewRendering, publishedRendering],
          directions,
          preservation,
        );
        return {
          canonicalId: `component:${definition.type}@${versionString(definition.version)}#${variant.id}`,
          version: versionString(definition.version),
          registrationSource: sourceFor(definition.type),
          requiredBindings: definition.commerceBindingSlots
            .filter((slot) => slot.required)
            .map((slot) => slot.id)
            .sort(),
          supportedPageTypes: [...definition.supportedPageTypes].sort(),
          responsiveContract: preserveResponsiveRules(definition.responsiveRules),
          accessibilityContract: Object.entries(definition.accessibilityRequirements)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(([key, value]) => `${key}: ${value}`)
            .sort(),
          plannerExposure: {
            recipeIds: recipeIds(definition.type, variant.id),
            blueprintIds: blueprintIds(definition.type, variant.id),
            directionIds: directions,
            advertisedToRealProvider: true as const,
          },
          deterministicSelectionEvidence: directions.map(
            (directionId) => `direction:${directionId}`,
          ),
          realProviderSchemaExposure:
            directions.length > 0
              ? ("registry-and-direction-option" as const)
              : ("registry-advertised" as const),
          proposalCompilerPreservation: preservation,
          canonicalSnapshotBoundary: canonicalBoundary(definition.type, status, preservation),
          editorRendering,
          previewRendering,
          publishedRendering,
          status,
        } satisfies P903dComponentVariantRecord;
      }),
    )
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
}

const currentComponentVariantInventory = createP903dComponentVariantInventory();

export const p903dDerivedComponentVariantCount = currentComponentVariantInventory.length;

export function validateP903dComponentVariantInventory(
  records: readonly P903dComponentVariantRecord[],
  evidence: P903dReachabilityEvidence = {},
): void {
  const expected = createP903dComponentVariantInventory(evidence);
  if (records.length !== expected.length) {
    throw new Error("P9-03D inventory variant count no longer matches the live V2 registry.");
  }
  const expectedById = new Map(expected.map((record) => [record.canonicalId, record]));
  records.forEach((record) => {
    const live = expectedById.get(record.canonicalId);
    if (!live || JSON.stringify(record) !== JSON.stringify(live)) {
      throw new Error(`P9-03D reachability evidence is stale for ${record.canonicalId}.`);
    }
    if (record.status === "fully reachable") {
      const rendererTargets = [
        record.editorRendering,
        record.previewRendering,
        record.publishedRendering,
      ];
      if (
        record.plannerExposure.directionIds.length === 0 ||
        rendererTargets.some((target) => target !== "shared renderer") ||
        !["preserved directly", "preserved by coordinated proposal compiler"].includes(
          record.proposalCompilerPreservation,
        )
      ) {
        throw new Error(
          `P9-03D fully reachable status lacks live evidence for ${record.canonicalId}.`,
        );
      }
    }
  });
}

const designSystemRegistryProvenance = [
  {
    source: "src/application/storefront-design-system/registry.ts",
    evidence: "Registered directions, page recipes and design-system values.",
  },
] as const;
const designTokenProvenance = [
  ...designSystemRegistryProvenance,
  {
    source: "src/application/storefront-design-system/registered-brand-system.ts",
    evidence: "Materializes selected spacing, shape, imagery and surface tokens.",
  },
] as const;
const rendererSupportProvenance = [
  {
    source: "src/components/registry/v2-registry.ts",
    evidence: "Registers ComponentDefinitionV2 renderer targets.",
  },
  {
    source: "src/components/registry/registry.ts",
    evidence: "Provides canonical editor, preview and published route bridge types.",
  },
] as const;
const componentContractProvenance = [
  {
    source: "src/domain/component-platform/component-platform.ts",
    evidence: "Defines responsive and accessibility ComponentDefinitionV2 contracts.",
  },
  {
    source: "src/components/registry/v2-registry.ts",
    evidence: "Registers the component definitions that supply those contracts.",
  },
] as const;
const localizationProvenance = [
  {
    source: "src/domain/design-brief/storefront-design-brief.ts",
    evidence: "Defines the approved Storefront Design Brief languagePlan.",
  },
  {
    source: "src/application/whole-storefront-generation-plan/planner.ts",
    evidence: "Validates and carries the approved languagePlan into the generation plan.",
  },
] as const;

const requiredProvenanceSources: Readonly<Record<string, readonly string[]>> = {
  "localization:en-fi": [
    "src/domain/design-brief/storefront-design-brief.ts",
    "src/application/whole-storefront-generation-plan/planner.ts",
  ],
  "accessibility:registered-contracts": [
    "src/domain/component-platform/component-platform.ts",
    "src/components/registry/v2-registry.ts",
  ],
};

type P903dSystemCapabilityInput = Omit<
  P903dSystemCapabilityRecord,
  | "version"
  | "requiredBindings"
  | "supportedPageTypes"
  | "responsiveContract"
  | "accessibilityContract"
  | "editorRendering"
  | "previewRendering"
  | "publishedRendering"
  | "responsiveEvidenceVariantCount"
> &
  Partial<
    Pick<
      P903dSystemCapabilityRecord,
      | "requiredBindings"
      | "supportedPageTypes"
      | "responsiveContract"
      | "accessibilityContract"
      | "editorRendering"
      | "previewRendering"
      | "publishedRendering"
      | "responsiveEvidenceVariantCount"
    >
  >;

function systemCapability(input: P903dSystemCapabilityInput): P903dSystemCapabilityRecord {
  return {
    version: storefrontDesignSystemV1.version,
    requiredBindings: [],
    supportedPageTypes: ["home", "collection", "product"],
    responsiveContract: "mobile/tablet/desktop/wide; horizontal overflow forbidden",
    accessibilityContract: "inherits validated BrandSystem and registered component contracts",
    editorRendering: "canonical BrandSystem or section renderer",
    previewRendering: "same canonical BrandSystem or section renderer",
    publishedRendering: "same canonical BrandSystem or section renderer",
    responsiveEvidenceVariantCount: null,
    ...input,
  };
}

const selectedTypography = new Set(
  storefrontDesignSystemV1.directions.map((direction) => direction.typographyDirectionId),
);
const selectedImages = new Set(
  storefrontDesignSystemV1.directions.map((direction) => direction.imageTreatmentId),
);
const selectedCards = new Set(
  storefrontDesignSystemV1.directions.map((direction) => direction.productCardFamilyId),
);
const selectedRecipes = new Set(
  storefrontDesignSystemV1.directions.flatMap((direction) => [
    direction.homepageRecipeId,
    direction.collectionRecipeId,
    direction.productRecipeId,
  ]),
);

export const p903dSystemCapabilityInventory: readonly P903dSystemCapabilityRecord[] = [
  ...storefrontDesignSystemV1.typographyDirections.map((typography) =>
    systemCapability({
      canonicalId: `typography:${typography.id}`,
      provenance: [...designSystemRegistryProvenance, ...rendererSupportProvenance],
      plannerExposure: selectedTypography.has(typography.id)
        ? "selected by a registered direction"
        : "registered but absent from direction options",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.typographyDirectionId === typography.id)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "design-system registry; indirect through direction options",
      proposalCompilerPreservation: selectedTypography.has(typography.id)
        ? "materialized by registeredBrandSystemForDirection"
        : "not selectable",
      status: selectedTypography.has(typography.id)
        ? "fully reachable"
        : "registered but unreachable",
    }),
  ),
  ...storefrontDesignSystemV1.imageTreatments.map((treatment) =>
    systemCapability({
      canonicalId: `image-treatment:${treatment.id}`,
      provenance: [...designSystemRegistryProvenance, ...rendererSupportProvenance],
      plannerExposure: selectedImages.has(treatment.id)
        ? "selected by a registered direction"
        : "registered but absent from direction options",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.imageTreatmentId === treatment.id)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "design-system registry; indirect through direction options",
      proposalCompilerPreservation: selectedImages.has(treatment.id)
        ? "materialized into BrandSystem imagery and visualSystem"
        : "not selectable",
      status: selectedImages.has(treatment.id) ? "fully reachable" : "registered but unreachable",
    }),
  ),
  ...storefrontDesignSystemV1.productCardFamilies.map((family) =>
    systemCapability({
      canonicalId: `product-card-family:${family.id}`,
      provenance: [...designSystemRegistryProvenance, ...rendererSupportProvenance],
      plannerExposure: selectedCards.has(family.id)
        ? "selected by a registered direction"
        : "registered but absent from direction options",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.productCardFamilyId === family.id)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "direction options expose the family ID",
      proposalCompilerPreservation: selectedCards.has(family.id)
        ? "plan records ID; dynamic collection props carry the concrete card variant"
        : "not selectable",
      status: selectedCards.has(family.id) ? "fully reachable" : "registered but unreachable",
    }),
  ),
  ...[
    ...storefrontDesignSystemV1.homepageRecipes,
    ...storefrontDesignSystemV1.collectionRecipes,
    ...storefrontDesignSystemV1.productRecipes,
  ].map((recipe) =>
    systemCapability({
      canonicalId: `page-recipe:${recipe.id}`,
      provenance: [...designSystemRegistryProvenance, ...rendererSupportProvenance],
      supportedPageTypes: [recipe.pageType],
      plannerExposure: selectedRecipes.has(recipe.id)
        ? "selected by a registered direction"
        : "registered but absent from direction options",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) =>
          [
            direction.homepageRecipeId,
            direction.collectionRecipeId,
            direction.productRecipeId,
          ].includes(recipe.id),
        )
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "full recipe plus direction option IDs",
      proposalCompilerPreservation: selectedRecipes.has(recipe.id)
        ? "recipe ID survives; order is applied later, but not every recipe variant is compiled"
        : "not selectable",
      status: selectedRecipes.has(recipe.id) ? "incomplete" : "registered but unreachable",
    }),
  ),
  ...(["compact", "standard", "spacious"] as const).map((density) =>
    systemCapability({
      canonicalId: `spacing-density:${density}`,
      provenance: [...designTokenProvenance, ...rendererSupportProvenance],
      plannerExposure: "selected by a registered direction",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.spacingDensity === density)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "direction option",
      proposalCompilerPreservation: "materialized into BrandSystem spacing and compatible props",
      status: "fully reachable",
    }),
  ),
  ...(["square", "soft", "rounded"] as const).map((shape) =>
    systemCapability({
      canonicalId: `shape:${shape}`,
      provenance: [...designTokenProvenance, ...rendererSupportProvenance],
      plannerExposure: "selected by a registered direction",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.cornerTreatment === shape)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "direction option",
      proposalCompilerPreservation: "materialized into BrandSystem radius and compatible props",
      status: "fully reachable",
    }),
  ),
  ...(["flat", "subtle", "layered"] as const).map((surface) =>
    systemCapability({
      canonicalId: `surface-depth:${surface}`,
      provenance: [...designTokenProvenance, ...rendererSupportProvenance],
      plannerExposure: "selected by a registered direction",
      deterministicSelectionEvidence: storefrontDesignSystemV1.directions
        .filter((direction) => direction.surfaceDepth === surface)
        .map((direction) => `direction:${direction.id}`),
      realProviderSchemaExposure: "direction option",
      proposalCompilerPreservation: "materialized into BrandSystem visualSystem.surfaceDepth",
      status: "fully reachable",
    }),
  ),
  systemCapability({
    canonicalId: "border-treatment:direction-bundle",
    provenance: [...designTokenProvenance, ...rendererSupportProvenance],
    plannerExposure: "semantic role only; no registered direction value",
    deterministicSelectionEvidence: [],
    realProviderSchemaExposure: "not exposed in direction options",
    proposalCompilerPreservation: "baseline border treatment is retained",
    status: "missing",
  }),
  systemCapability({
    canonicalId: "localization:en-fi",
    provenance: [...localizationProvenance, ...rendererSupportProvenance],
    plannerExposure: "languagePlan carries both locales with explicit missing-translation policy",
    deterministicSelectionEvidence: ["fixture:Lumo EN/FI", "fixture:Aurum EN/FI"],
    realProviderSchemaExposure: "approved brief language plan",
    proposalCompilerPreservation: "localized content and selected locale plan are preserved",
    status: "fully reachable",
  }),
  systemCapability({
    canonicalId: "responsive:375-768-1024-1440",
    provenance: [...componentContractProvenance, ...rendererSupportProvenance],
    plannerExposure: "all recipes and component definitions forbid horizontal overflow",
    deterministicSelectionEvidence: ["P9 responsive acceptance suite"],
    realProviderSchemaExposure: "responsive-safe registered IDs only",
    proposalCompilerPreservation: `contracts survive; evidence is not exhaustive for all ${p903dDerivedComponentVariantCount} variants`,
    responsiveEvidenceVariantCount: p903dDerivedComponentVariantCount,
    status: "incomplete",
  }),
  systemCapability({
    canonicalId: "accessibility:registered-contracts",
    provenance: [...componentContractProvenance, ...rendererSupportProvenance],
    plannerExposure: "component definitions expose keyboard, semantics, labels and focus contracts",
    deterministicSelectionEvidence: ["component and route accessibility suites"],
    realProviderSchemaExposure:
      "provider receives bounded component IDs, not raw accessibility props",
    proposalCompilerPreservation:
      "registered implementation is preserved; per-variant evidence is incomplete",
    status: "incomplete",
  }),
].sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

export function validateP903dSystemCapabilityProvenance(
  records: readonly P903dSystemCapabilityRecord[],
): void {
  records.forEach((record) => {
    if (record.provenance.length === 0) {
      throw new Error(`P9-03D system capability provenance is missing for ${record.canonicalId}.`);
    }
    const sources = new Set(record.provenance.map((provenance) => provenance.source));
    if (record.provenance.some((provenance) => provenance.evidence.trim().length === 0)) {
      throw new Error(`P9-03D system capability provenance is generic for ${record.canonicalId}.`);
    }
    const requiredSources = requiredProvenanceSources[record.canonicalId] ?? [];
    if (requiredSources.some((source) => !sources.has(source))) {
      throw new Error(
        `P9-03D system capability provenance is inaccurate for ${record.canonicalId}.`,
      );
    }
    if (
      ["localization:en-fi", "accessibility:registered-contracts"].includes(record.canonicalId) &&
      sources.has("src/application/storefront-design-system/registry.ts")
    ) {
      throw new Error(
        `P9-03D system capability provenance is inaccurate for ${record.canonicalId}.`,
      );
    }
  });
}

export const p903dDesignCapabilityInventory = Object.freeze({
  schemaVersion: 1,
  generatedFrom: Object.freeze({
    componentRegistry: "veskifyComponentDefinitionsV2",
    designSystem: storefrontDesignSystemV1.fingerprint,
    blueprints: storefrontTemplateDefinitions.map(
      (template) => `${template.id}@${template.version}`,
    ),
  }),
  componentVariants: Object.freeze([...currentComponentVariantInventory]),
  systemCapabilities: Object.freeze([...p903dSystemCapabilityInventory]),
});
