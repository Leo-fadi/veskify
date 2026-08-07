import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
  wholeStorefrontPlanningInputSchema,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import { runtimeComponentForPageBlueprintComponent } from "@/application/storefront-templates";
import {
  compileWholeStorefrontProposal,
  createWholeStorefrontRuntimeState,
  validateWholeStorefrontProposal,
} from "@/application/whole-storefront-proposal-lifecycle/compiler";
import {
  coordinatedFollowUpPlanFingerprint,
  coordinatedPageAuthorityFingerprint,
  coordinatedProtectedStateFingerprint,
  type CoordinatedFollowUpPlan,
  type WholeStorefrontProposal,
  type WholeStorefrontRuntimeComponent,
  type WholeStorefrontRuntimePage,
  type WholeStorefrontRuntimeState,
} from "@/application/whole-storefront-proposal-lifecycle/contract";
import {
  applyRegisteredTokenRefinement,
  registeredBrandSystemForDirection,
  registeredTokenRefinementPlanSchema,
  storefrontDesignDirectionIdSchema,
} from "@/application/storefront-design-system";
import { homepageCommerceBridgeDefaults } from "@/components/registry";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { z } from "zod";
import {
  governedFollowUpEditingAuthoritySchema,
  governedSkillPackageRegistry,
  GovernedSkillPackageError,
  type GovernedFollowUpEditingAuthority,
  type GovernedSkillAuthorityEnvelope,
  type GovernedSkillPackageFailure,
  type GovernedSkillPackageFailureCode,
  type GovernedSkillPackageRegistry,
} from "./governed-skill-packages";

const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

/**
 * Server-side execution input. The governed authority remains the only skill
 * authority; planning input and token/direction inputs are independently
 * validated server-derived context, never provider or editor state.
 */
export const governedFollowUpEditingRequestSchema = z
  .object({
    authority: governedFollowUpEditingAuthoritySchema,
    planningInput: z.unknown(),
    registeredDirectionId: storefrontDesignDirectionIdSchema.optional(),
    tokenRefinementPlan: registeredTokenRefinementPlanSchema.optional(),
  })
  .strict();

export type GovernedFollowUpEditingRequest = Readonly<{
  authority: GovernedFollowUpEditingAuthority;
  planningInput: unknown;
  registeredDirectionId?: z.infer<typeof storefrontDesignDirectionIdSchema>;
  tokenRefinementPlan?: z.infer<typeof registeredTokenRefinementPlanSchema>;
}>;

export type GovernedFollowUpEditingIntegrationFailureCode =
  | GovernedSkillPackageFailureCode
  | "unsupportedFollowUpPackage"
  | "deprecatedAliasDirection"
  | "invalidFollowUpExecution"
  | "invalidPlanningInput"
  | "stalePlanningAuthority"
  | "staleSnapshotAuthority"
  | "staleProfileAuthority"
  | "unknownPageAuthority"
  | "ambiguousRuntimeSlot"
  | "incompatibleRuntimeComponent"
  | "invalidRegisteredDirection"
  | "illegalPackageScope"
  | "invalidApprovedAssetReference"
  | "protectedStateViolation"
  | "coordinatedPlanRejected"
  | "proposalCompilationFailed";

export type GovernedFollowUpEditingIntegrationFailure = Readonly<{
  code: GovernedFollowUpEditingIntegrationFailureCode;
  message: string;
}>;

export type GovernedFollowUpEditingIntegrationResult =
  | Readonly<{
      valid: true;
      authority: GovernedFollowUpEditingAuthority;
      planningInput: WholeStorefrontPlanningInput;
      coordinatedPlan: CoordinatedFollowUpPlan;
      proposal: WholeStorefrontProposal;
      outputFingerprint: string;
    }>
  | Readonly<{ valid: false; failure: GovernedFollowUpEditingIntegrationFailure }>;

export type GovernedFollowUpRouteAuthorityValidationResult =
  | Readonly<{
      valid: true;
      authority: GovernedFollowUpEditingAuthority;
      planningInput: WholeStorefrontPlanningInput;
    }>
  | Readonly<{ valid: false; failure: GovernedFollowUpEditingIntegrationFailure }>;

function frozen<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) frozen(Reflect.get(value, key));
  }
  return value;
}

function failure(
  code: GovernedFollowUpEditingIntegrationFailureCode,
  message: string,
): GovernedFollowUpEditingIntegrationResult {
  return frozen<GovernedFollowUpEditingIntegrationResult>({
    valid: false,
    failure: frozen({ code, message }),
  });
}

function mappedFailure(
  failureValue: GovernedSkillPackageFailure,
): GovernedFollowUpEditingIntegrationResult {
  return failure(failureValue.code, failureValue.message);
}

function routeAuthorityFailure(
  code: GovernedFollowUpEditingIntegrationFailureCode,
  message: string,
): GovernedFollowUpRouteAuthorityValidationResult {
  return frozen({ valid: false as const, failure: frozen({ code, message }) });
}

function authorityMismatch(
  planningInput: WholeStorefrontPlanningInput,
  currentAuthority: GovernedSkillAuthorityEnvelope,
) {
  const target = createWholeStorefrontGenerationTarget(planningInput);
  if (
    planningInput.project.id !== currentAuthority.projectId ||
    planningInput.project.revision !== currentAuthority.projectRevision
  ) {
    return "The server-derived planning input targets a different project.";
  }
  if (
    planningInput.draft.id !== currentAuthority.draftSnapshotId ||
    planningInput.draft.revision !== currentAuthority.draftRevision ||
    target.activeDraftFingerprint !== currentAuthority.snapshotFingerprint
  ) {
    return "The server-derived planning input targets a stale snapshot.";
  }
  if (target.registryFingerprint !== currentAuthority.componentRegistryFingerprint) {
    return "The server-derived planning input has a stale component registry.";
  }
  if (target.canonicalCommerceFingerprint !== currentAuthority.commerceFingerprint) {
    return "The server-derived planning input has stale canonical commerce.";
  }
  if (target.approvedAssetContextFingerprint !== currentAuthority.approvedAssetFingerprint) {
    return "The server-derived planning input has stale approved-asset authority.";
  }
  if (!planningInput.project.enabledLocales.includes(currentAuthority.locale)) {
    return "The server-derived planning input does not support the governed locale.";
  }
  return undefined;
}

function baselinePlan(
  planningInput: WholeStorefrontPlanningInput,
  packageId: GovernedFollowUpEditingAuthority["packageId"],
  request: GovernedFollowUpEditingRequest,
): WholeStorefrontGenerationPlan {
  if (packageId === "applyExactBrandPalette") {
    if (request.tokenRefinementPlan === undefined) {
      throw new GovernedSkillPackageError(
        "invalidRequest",
        "An exact palette package requires one validated token-refinement plan.",
      );
    }
    return createWholeStorefrontGenerationPlan(planningInput, {
      tokenRefinementPlan: request.tokenRefinementPlan,
    });
  }
  if (packageId === "applyRegisteredWholeStorefrontDirection") {
    if (request.registeredDirectionId === undefined) {
      throw new GovernedSkillPackageError(
        "invalidRequest",
        "A whole-storefront direction package requires one current registered direction.",
      );
    }
    return createWholeStorefrontGenerationPlan(planningInput, {
      directionId: request.registeredDirectionId,
    });
  }
  if (request.registeredDirectionId !== undefined || request.tokenRefinementPlan !== undefined) {
    throw new GovernedSkillPackageError(
      "invalidRequest",
      "This governed follow-up package does not authorize a direction or token-refinement input.",
    );
  }
  return createWholeStorefrontGenerationPlan(planningInput);
}

function runtimePage(
  state: WholeStorefrontRuntimeState,
  pageId: string,
  pageType: string,
): WholeStorefrontRuntimePage {
  const page = state.pages.find((candidate) => candidate.pageId === pageId);
  if (!page || page.type !== pageType) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      "The governed page authority does not resolve to the current snapshot page.",
    );
  }
  return page;
}

function runtimeComponent(
  page: WholeStorefrontRuntimePage,
  componentType: string,
  components: readonly WholeStorefrontRuntimeComponent[] = page.components,
): WholeStorefrontRuntimeComponent {
  const matches = components.filter((component) => component.component === componentType);
  if (matches.length !== 1) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      matches.length === 0
        ? `The selected component ${componentType} is not present on the current page.`
        : `The selected component ${componentType} is ambiguous on the current page.`,
    );
  }
  return matches[0];
}

type Materialization = WholeStorefrontGenerationPlan["pageBlueprintMaterializations"][number];
type PageAuthority = GovernedFollowUpEditingAuthority["pages"][number];
type PageSelection = PageAuthority["selections"][number];
type CoordinatedPageChange = CoordinatedFollowUpPlan["pageChanges"][number];

function materializedSlotAuthority(materialization: Materialization, selection: PageSelection) {
  if (selection.profileId !== materialization.profileId) {
    throw new GovernedSkillPackageError(
      "staleProfileAuthority",
      `Selected slot ${selection.slotId} does not belong to the current PageBlueprint materialization.`,
    );
  }
  const slot = materialization.slots.find((candidate) => candidate.slotId === selection.slotId);
  if (!slot || slot.component !== selection.componentType) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      `Selected slot ${selection.slotId} does not match the current PageBlueprint materialization.`,
    );
  }
  return slot;
}

function assertWholeStorefrontDirectionVariant(
  materialization: Materialization,
  selection: PageSelection,
) {
  const slot = materializedSlotAuthority(materialization, selection);
  if (selection.variant !== slot.variant) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      `Selected variant ${selection.variant} does not match the current materialized ${selection.slotId} slot variant.`,
    );
  }
}

function runtimeComponentForMaterializedSelection(
  page: WholeStorefrontRuntimePage,
  materialization: Materialization,
  selection: PageSelection,
  components?: readonly WholeStorefrontRuntimeComponent[],
) {
  const slot = materializedSlotAuthority(materialization, selection);
  const runtimeComponentType = runtimeComponentForPageBlueprintComponent(
    slot.component,
    materialization.pageType,
  );
  return { slot, component: runtimeComponent(page, runtimeComponentType, components) };
}

function assertCurrentComponentVersion(
  component: WholeStorefrontRuntimeComponent,
  planningInput: WholeStorefrontPlanningInput,
) {
  const definition = planningInput.componentDefinitions.find(
    (candidate) => candidate.type === component.component,
  );
  if (
    !definition ||
    canonicalValueFingerprint(definition.version) !==
      canonicalValueFingerprint(component.componentVersion)
  ) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      `The selected component ${component.component} is not at its registered version.`,
    );
  }
}

function assertApprovedAssets(
  authority: GovernedFollowUpEditingAuthority,
  planningInput: WholeStorefrontPlanningInput,
) {
  const approved = new Map(
    (planningInput.approvedAssetContext?.assets ?? []).map((asset) => [asset.assetId, asset]),
  );
  for (const page of authority.pages) {
    for (const asset of page.approvedAssets) {
      const current = approved.get(asset.assetId);
      if (
        !current ||
        current.role !== asset.role ||
        current.revision !== asset.revision ||
        current.materialFingerprint !== asset.materialFingerprint
      ) {
        throw new GovernedSkillPackageError(
          "invalidApprovedAssetReference",
          `Approved asset ${asset.assetId} no longer matches current approved authority.`,
        );
      }
    }
  }
}

function assertBindingAuthority(
  pageAuthority: PageAuthority,
  page: WholeStorefrontRuntimePage,
  materialization: Materialization,
  components: readonly WholeStorefrontRuntimeComponent[],
) {
  for (const binding of pageAuthority.bindings) {
    const selection = pageAuthority.selections.find(
      (candidate) => candidate.slotId === binding.targetSlotId,
    );
    if (!selection) {
      throw new GovernedSkillPackageError(
        "invalidCanonicalBinding",
        `Binding ${binding.bindingSlotId} has no selected PageBlueprint slot.`,
      );
    }
    const { component } = runtimeComponentForMaterializedSelection(
      page,
      materialization,
      selection,
      components,
    );
    const current = component.bindings.find(
      (candidate) =>
        candidate.slotId === binding.bindingSlotId && candidate.source === binding.sourceType,
    );
    if (!current || canonicalValueFingerprint(current) !== binding.fingerprint) {
      throw new GovernedSkillPackageError(
        "invalidCanonicalBinding",
        `Binding ${binding.bindingSlotId} does not match the current canonical component binding.`,
      );
    }
  }
}

function materializeCompositeRuntimeComponent(
  page: WholeStorefrontRuntimePage,
  baseline: WholeStorefrontGenerationPlan,
  materialization: Materialization,
  selection: PageSelection,
  components: WholeStorefrontRuntimeComponent[],
): Readonly<{
  components: WholeStorefrontRuntimeComponent[];
  removedComponentIds: readonly string[];
}> {
  const slot = materializedSlotAuthority(materialization, selection);
  const runtimeComponentType = runtimeComponentForPageBlueprintComponent(
    slot.component,
    materialization.pageType,
  );
  if (runtimeComponentType === slot.component) return { components, removedComponentIds: [] };
  const existing = components.filter((component) => component.component === runtimeComponentType);
  if (existing.length === 1) return { components, removedComponentIds: [] };
  if (existing.length > 1) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      `The selected canonical runtime component ${runtimeComponentType} is ambiguous on the current page.`,
    );
  }
  const pagePlan = baseline.pagePlans.find((candidate) => candidate.pageId === page.pageId);
  const replacements = pagePlan?.components.filter(
    (candidate) => "instance" in candidate && candidate.instance.component === runtimeComponentType,
  );
  if (!replacements || replacements.length !== 1 || !("instance" in replacements[0])) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      `The current PageBlueprint does not materialize ${slot.component} as its canonical runtime component.`,
    );
  }
  const replacement = replacements[0];
  const replacedIds = new Set(replacement.replacesComponentIds);
  const removedComponentIds = components
    .filter((component) => replacedIds.has(component.id))
    .map((component) => component.id);
  return {
    components: [
      ...components.filter((component) => !replacedIds.has(component.id)),
      { ...structuredClone(replacement.instance), visible: true },
    ],
    removedComponentIds,
  };
}

function promotionComponent(
  page: WholeStorefrontRuntimePage,
  planningInput: WholeStorefrontPlanningInput,
  selection: GovernedFollowUpEditingAuthority["pages"][number]["selections"][number],
  requestIdentity: string,
): WholeStorefrontRuntimeComponent {
  if (selection.slotId !== "promotion" || selection.componentType !== "homepagePromotion") {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      "Campaign insertion requires the registered promotion PageBlueprint slot.",
    );
  }
  if (page.components.some((component) => component.component === "homepagePromotion")) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      "The current page already contains its registered promotion component.",
    );
  }
  const definition = planningInput.componentDefinitions.find(
    (candidate) => candidate.type === selection.componentType,
  );
  if (!definition) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      "The selected campaign component is not present in the current component registry.",
    );
  }
  return {
    id: `component_campaign_${canonicalValueFingerprint({ pageId: page.pageId, requestIdentity }).slice(-16)}`,
    component: "homepagePromotion",
    componentVersion: structuredClone(definition.version),
    variant: selection.variant,
    content: structuredClone(homepageCommerceBridgeDefaults.homepagePromotion.content),
    props: structuredClone(homepageCommerceBridgeDefaults.homepagePromotion.props),
    styleOverrides: { surface: "plain" },
    bindings: [
      {
        slotId: "presentationContext",
        source: "projectBrandContext",
        projectId: planningInput.project.id,
        revision: `canonical-commerce-${canonicalValueFingerprint(planningInput.catalogue)}`,
      },
    ],
    assetAssignments: [],
    visible: true,
  };
}

function registeredInsertionIndex(
  components: WholeStorefrontRuntimeComponent[],
  materialization: Materialization,
  selection: PageSelection,
) {
  const selectedIndex = materialization.slots.findIndex((slot) => slot.slotId === selection.slotId);
  if (selectedIndex < 0) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      "The selected campaign slot is not available in the current PageBlueprint materialization.",
    );
  }
  for (const following of materialization.slots.slice(selectedIndex + 1)) {
    const existingIndex = components.findIndex(
      (component) => component.component === following.component,
    );
    if (existingIndex >= 0) return existingIndex;
  }
  return components.length;
}

/**
 * Validates follow-up page, profile, and slot authority against the current
 * server-derived planning input without compiling a proposal. The strict scope
 * router consumes this existing governed boundary for route-only validation.
 */
export function validateGovernedFollowUpRouteAuthority(
  inputValue: unknown,
  currentAuthority: GovernedSkillAuthorityEnvelope,
  registry: GovernedSkillPackageRegistry = governedSkillPackageRegistry,
): GovernedFollowUpRouteAuthorityValidationResult {
  let requestResult: ReturnType<typeof governedFollowUpEditingRequestSchema.safeParse>;
  try {
    requestResult = governedFollowUpEditingRequestSchema.safeParse(structuredClone(inputValue));
  } catch {
    return routeAuthorityFailure("invalidRequest", "The governed follow-up request is invalid.");
  }
  if (!requestResult.success) {
    return routeAuthorityFailure("invalidRequest", "The governed follow-up request is invalid.");
  }
  try {
    const request = requestResult.data;
    const governed = registry.validateFollowUpEditing(request.authority, currentAuthority);
    if (!governed.valid) {
      return routeAuthorityFailure(governed.failure.code, governed.failure.message);
    }
    const planning = wholeStorefrontPlanningInputSchema.safeParse(request.planningInput);
    if (!planning.success) {
      return routeAuthorityFailure(
        "invalidPlanningInput",
        "The server-derived planning input is invalid.",
      );
    }
    const mismatch = authorityMismatch(planning.data, currentAuthority);
    if (mismatch) return routeAuthorityFailure("stalePlanningAuthority", mismatch);
    let baseline: WholeStorefrontGenerationPlan;
    try {
      baseline = baselinePlan(planning.data, governed.value.package.descriptor.id, request);
    } catch (error) {
      return routeAuthorityFailure(
        "invalidFollowUpExecution",
        error instanceof Error
          ? error.message
          : "The governed follow-up baseline could not be prepared.",
      );
    }
    const current = createWholeStorefrontRuntimeState({
      plan: baseline,
      planningInput: planning.data,
    });
    for (const pageAuthority of governed.value.authority.pages) {
      if (
        !current.pages.some(
          (candidate) =>
            candidate.pageId === pageAuthority.pageId && candidate.type === pageAuthority.pageType,
        )
      ) {
        return routeAuthorityFailure(
          "unknownPageAuthority",
          "The governed page authority does not resolve to the current snapshot page.",
        );
      }
      const page = runtimePage(current, pageAuthority.pageId, pageAuthority.pageType);
      const materialization = baseline.pageBlueprintMaterializations.find(
        (candidate) => candidate.pageType === pageAuthority.pageType,
      );
      if (
        !materialization ||
        (pageAuthority.profile !== undefined &&
          (materialization.profileId !== pageAuthority.profile.profileId ||
            materialization.pageType !== pageAuthority.profile.pageType))
      ) {
        return routeAuthorityFailure(
          "staleProfileAuthority",
          "The selected PageBlueprint profile does not match the current canonical materialization.",
        );
      }
      for (const selection of pageAuthority.selections) {
        materializedSlotAuthority(materialization, selection);
        if (governed.value.package.descriptor.id === "applyRegisteredWholeStorefrontDirection") {
          assertWholeStorefrontDirectionVariant(materialization, selection);
        }
        if (governed.value.package.descriptor.id !== "addCampaignSection") {
          runtimeComponentForMaterializedSelection(page, materialization, selection);
        }
      }
    }
    return frozen({
      valid: true as const,
      authority: frozen(structuredClone(governed.value.authority)),
      planningInput: frozen(structuredClone(planning.data)),
    });
  } catch (error) {
    if (error instanceof GovernedSkillPackageError) {
      return routeAuthorityFailure(error.code, error.message);
    }
    return routeAuthorityFailure(
      "coordinatedPlanRejected",
      error instanceof Error ? error.message : "Current route authority could not be validated.",
    );
  }
}

function pageChange(
  pageAuthority: PageAuthority,
  original: WholeStorefrontRuntimeState,
  baseline: WholeStorefrontGenerationPlan,
  planningInput: WholeStorefrontPlanningInput,
  packageId: GovernedFollowUpEditingAuthority["packageId"],
  requestIdentity: string,
): CoordinatedPageChange {
  const page = runtimePage(original, pageAuthority.pageId, pageAuthority.pageType);
  const materialization = baseline.pageBlueprintMaterializations.find(
    (candidate) => candidate.pageType === pageAuthority.pageType,
  );
  if (
    !materialization ||
    (pageAuthority.profile !== undefined &&
      (materialization.profileId !== pageAuthority.profile.profileId ||
        materialization.pageType !== pageAuthority.profile.pageType))
  ) {
    throw new GovernedSkillPackageError(
      "staleProfileAuthority",
      "The selected PageBlueprint profile does not match the current canonical materialization.",
    );
  }
  const selected = pageAuthority.selections;
  if (selected.length === 0) {
    throw new GovernedSkillPackageError(
      "invalidSlotSelection",
      "This governed follow-up package requires one or more exact selected slots.",
    );
  }
  if (pageAuthority.boundedParameters.length > 0) {
    throw new GovernedSkillPackageError(
      "unsupportedBoundedParameter",
      "This follow-up integration cannot yet express bounded parameter intents through a canonical runtime projection.",
    );
  }
  let added: WholeStorefrontRuntimeComponent | null = null;
  const componentIdsBySlot = new Map<string, string[]>();
  let components = page.components.map((component) => structuredClone(component));
  const removedComponentIds = new Set<string>();
  const removedComponentIdsBySlot = new Map<string, readonly string[]>();
  for (const selection of selected) {
    if (packageId === "applyRegisteredWholeStorefrontDirection") {
      assertWholeStorefrontDirectionVariant(materialization, selection);
    }
    if (packageId === "addCampaignSection") continue;
    const materialized = materializeCompositeRuntimeComponent(
      page,
      baseline,
      materialization,
      selection,
      components,
    );
    components = materialized.components;
    materialized.removedComponentIds.forEach((componentId) => removedComponentIds.add(componentId));
    if (materialized.removedComponentIds.length > 0) {
      removedComponentIdsBySlot.set(selection.slotId, materialized.removedComponentIds);
    }
  }
  assertBindingAuthority(pageAuthority, page, materialization, components);
  for (const selection of selected) {
    materializedSlotAuthority(materialization, selection);
    if (packageId === "addCampaignSection") {
      if (selected.length !== 1) {
        throw new GovernedSkillPackageError(
          "invalidSlotSelection",
          "Campaign insertion requires exactly one promotion slot selection.",
        );
      }
      added = promotionComponent(page, planningInput, selection, requestIdentity);
      componentIdsBySlot.set(selection.slotId, [added.id]);
      continue;
    }
    const { component: current } = runtimeComponentForMaterializedSelection(
      page,
      materialization,
      selection,
      components,
    );
    if (
      [...componentIdsBySlot.values()].some((componentIds) => componentIds.includes(current.id))
    ) {
      throw new GovernedSkillPackageError(
        "invalidSlotSelection",
        "Multiple selected PageBlueprint slots resolve to the same canonical runtime component.",
      );
    }
    assertCurrentComponentVersion(current, planningInput);
    const index = components.findIndex((component) => component.id === current.id);
    if (index < 0) {
      throw new GovernedSkillPackageError(
        "invalidSlotSelection",
        "The selected runtime component is no longer available.",
      );
    }
    components[index] = {
      ...components[index],
      variant:
        packageId === "applyRegisteredWholeStorefrontDirection"
          ? current.variant
          : selection.variant,
    };
    componentIdsBySlot.set(selection.slotId, [
      current.id,
      ...(removedComponentIdsBySlot.get(selection.slotId) ?? []),
    ]);
  }
  if (added) {
    components.splice(registeredInsertionIndex(components, materialization, selected[0]), 0, added);
  }
  const proposedPage = { ...page, components };
  const assetPlacements: CoordinatedPageChange["operations"] = pageAuthority.approvedAssets.map(
    (asset) => {
      const componentId = componentIdsBySlot.get(asset.targetSlotId)?.[0];
      const component = proposedPage.components.find((candidate) => candidate.id === componentId);
      if (!component) {
        throw new GovernedSkillPackageError(
          "invalidApprovedAssetReference",
          `Approved asset ${asset.assetId} has no current component placement target.`,
        );
      }
      const approvedAsset = planningInput.approvedAssetContext?.assets.find(
        (candidate) => candidate.assetId === asset.assetId,
      );
      if (!approvedAsset) {
        throw new GovernedSkillPackageError(
          "invalidApprovedAssetReference",
          `Approved asset ${asset.assetId} is no longer available for placement.`,
        );
      }
      return {
        type: "PLACE_APPROVED_SOURCE_ASSET",
        pageId: page.pageId,
        componentId: component.id,
        componentType: component.component,
        assetSlotId: asset.assetSlotId,
        assetId: asset.assetId,
        role: asset.role,
        assetRevision: asset.revision,
        materialFingerprint: asset.materialFingerprint,
        sourceReferenceId: approvedAsset.sourceReferenceId,
        required: asset.required,
      };
    },
  );
  return {
    pageId: page.pageId,
    pageType: page.type,
    profileId: materialization.profileId,
    profileFingerprint: materialization.fingerprint,
    pageAuthorityFingerprint: coordinatedPageAuthorityFingerprint(page),
    slotAuthorities: [...componentIdsBySlot.entries()]
      .map(([slotId, componentIds]) => ({ slotId, componentIds: [...componentIds].sort() }))
      .sort((left, right) => left.slotId.localeCompare(right.slotId)),
    operations: [
      {
        type: "APPLY_PAGE_COMPONENTS",
        page: proposedPage,
        removedComponentIds: [...removedComponentIds].sort(),
      },
      ...assetPlacements,
    ],
  };
}

function explanation(packageId: GovernedFollowUpEditingAuthority["packageId"]): string {
  switch (packageId) {
    case "applyExactBrandPalette":
      return "Applies the validated approved palette without changing page structure.";
    case "improveHero":
      return "Updates only the selected registered hero slot.";
    case "addCampaignSection":
      return "Adds one registered campaign section at its legal PageBlueprint position.";
    case "applyRegisteredWholeStorefrontDirection":
      return "Coordinates the selected registered direction across the declared storefront pages.";
    default:
      throw new GovernedSkillPackageError(
        "unknownPackage",
        `Unknown governed follow-up package: ${packageId}.`,
      );
  }
}

/**
 * Sole governed follow-up execution adapter. It validates package and current
 * server authority, maps it into the P10A-05D-01 common plan, and compiles the
 * existing aggregate proposal. It has no provider, persistence, accept, save,
 * publish, router, or editor side effect.
 */
export function executeGovernedFollowUpEditing(
  inputValue: unknown,
  currentAuthority: GovernedSkillAuthorityEnvelope,
  registry: GovernedSkillPackageRegistry = governedSkillPackageRegistry,
): GovernedFollowUpEditingIntegrationResult {
  let requestResult: ReturnType<typeof governedFollowUpEditingRequestSchema.safeParse>;
  try {
    requestResult = governedFollowUpEditingRequestSchema.safeParse(structuredClone(inputValue));
  } catch {
    return failure("invalidRequest", "The governed follow-up request is invalid.");
  }
  if (!requestResult.success)
    return failure("invalidRequest", "The governed follow-up request is invalid.");
  try {
    const request = requestResult.data;
    const governed = registry.validateFollowUpEditing(request.authority, currentAuthority);
    if (!governed.valid) return mappedFailure(governed.failure);
    const { authority, package: packageResolution } = governed.value;
    if (
      packageResolution.descriptor.outputContracts.followUpEditing !==
      "governedFollowUpEditingAuthority.v1"
    ) {
      return failure(
        "unsupportedFollowUpPackage",
        "The governed package does not declare the canonical follow-up output contract.",
      );
    }
    if (
      packageResolution.descriptor.id === "applyRegisteredWholeStorefrontDirection" &&
      packageResolution.alias !== null
    ) {
      return failure(
        "deprecatedAliasDirection",
        "Whole-storefront direction execution requires its canonical package identifier.",
      );
    }
    const planning = wholeStorefrontPlanningInputSchema.safeParse(request.planningInput);
    if (!planning.success) {
      return failure("invalidPlanningInput", "The server-derived planning input is invalid.");
    }
    const mismatch = authorityMismatch(planning.data, currentAuthority);
    if (mismatch) return failure("stalePlanningAuthority", mismatch);
    assertApprovedAssets(authority, planning.data);
    if (
      request.registeredDirectionId !== undefined &&
      !planning.data.recipeContext.designSystem.directions.some(
        (direction) => direction.id === request.registeredDirectionId,
      )
    ) {
      return failure(
        "invalidRegisteredDirection",
        "The registered direction is not current authority.",
      );
    }
    let baseline: WholeStorefrontGenerationPlan;
    try {
      baseline = baselinePlan(planning.data, packageResolution.descriptor.id, request);
    } catch (error) {
      if (error instanceof GovernedSkillPackageError) {
        return failure("invalidFollowUpExecution", error.message);
      }
      return failure(
        "coordinatedPlanRejected",
        "The governed follow-up baseline could not be prepared.",
      );
    }
    const original = createWholeStorefrontRuntimeState({
      plan: baseline,
      planningInput: planning.data,
    });
    const sharedOperations: CoordinatedFollowUpPlan["sharedOperations"] = [];
    if (packageResolution.descriptor.id === "applyExactBrandPalette") {
      const tokenRefinementPlan = request.tokenRefinementPlan!;
      sharedOperations.push({
        type: "APPLY_REGISTERED_BRAND_SYSTEM",
        refinementId: "validatedTokenRefinement",
        tokenRefinementPlan: structuredClone(tokenRefinementPlan),
        brandSystem: applyRegisteredTokenRefinement(original.brandSystem, tokenRefinementPlan),
      });
    }
    if (packageResolution.descriptor.id === "applyRegisteredWholeStorefrontDirection") {
      const directionId = request.registeredDirectionId!;
      sharedOperations.push({
        type: "APPLY_REGISTERED_BRAND_SYSTEM",
        directionId,
        brandSystem: registeredBrandSystemForDirection(
          original.brandSystem,
          planning.data.recipeContext.designSystem,
          directionId,
        ),
      });
    }
    if (
      packageResolution.descriptor.id === "applyExactBrandPalette" &&
      authority.pages.length !== 0
    ) {
      return failure(
        "illegalPackageScope",
        "An exact brand palette package may not acquire page authority.",
      );
    }
    const pageChanges = authority.pages.map((page) =>
      pageChange(
        page,
        original,
        baseline,
        planning.data,
        packageResolution.descriptor.id,
        authority.authority.requestIdentity,
      ),
    );
    const withoutFingerprint: Omit<CoordinatedFollowUpPlan, "fingerprint"> = {
      kind: "governedFollowUp",
      version: 1,
      id: `plan_follow_up_${canonicalValueFingerprint({
        request: governed.value.outputFingerprint,
        baseline: baseline.fingerprint,
      }).slice(-16)}`,
      target: baseline.target,
      requestIdentity: authority.authority.requestIdentity,
      locale: authority.authority.locale,
      manifest: authority.authority.manifest,
      packageRegistry: authority.authority.packageRegistry,
      componentRegistryFingerprint: authority.authority.componentRegistryFingerprint,
      commerceFingerprint: authority.authority.commerceFingerprint,
      approvedAssetFingerprint: authority.authority.approvedAssetFingerprint,
      protectedStateFingerprint: coordinatedProtectedStateFingerprint(original),
      ...(request.registeredDirectionId === undefined
        ? {}
        : { registeredDirectionId: request.registeredDirectionId }),
      baselineGenerationPlan: baseline,
      sharedOperations,
      pageChanges,
      explanation: explanation(packageResolution.descriptor.id),
    };
    const coordinatedPlan: CoordinatedFollowUpPlan = {
      ...withoutFingerprint,
      fingerprint: coordinatedFollowUpPlanFingerprint(withoutFingerprint),
    };
    const proposal = compileWholeStorefrontProposal({
      plan: coordinatedPlan,
      planningInput: planning.data,
    });
    validateWholeStorefrontProposal(proposal, {
      plan: coordinatedPlan,
      planningInput: planning.data,
    });
    return frozen<GovernedFollowUpEditingIntegrationResult>({
      valid: true,
      authority: frozen(structuredClone(authority)),
      planningInput: frozen(structuredClone(planning.data)),
      coordinatedPlan: frozen(structuredClone(coordinatedPlan)),
      proposal: frozen(structuredClone(proposal)),
      outputFingerprint: `governed-follow-up-proposal-${canonicalValueFingerprint({
        authority: governed.value.outputFingerprint,
        plan: coordinatedPlan.fingerprint,
        proposal: proposal.id,
      })}`,
    });
  } catch (error) {
    if (error instanceof GovernedSkillPackageError) {
      return failure(error.code, error.message);
    }
    return failure(
      "proposalCompilationFailed",
      error instanceof Error
        ? error.message
        : "The governed follow-up proposal could not be compiled.",
    );
  }
}

export const GOVERNED_FOLLOW_UP_EDITING_OUTPUT_CONTRACT_VERSION = versionSchema.parse("1.0.0");
