import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
  wholeStorefrontPlanningInputSchema,
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
} from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  validateWholeStorefrontProposal,
  type WholeStorefrontProposal,
} from "@/application/whole-storefront-proposal-lifecycle";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { z } from "zod";
import {
  governedInitialGenerationAuthoritySchema,
  governedSkillPackageRegistry,
  GovernedSkillPackageError,
  type GovernedInitialGenerationAuthority,
  type GovernedSkillAuthorityEnvelope,
  type GovernedSkillPackageFailure,
  type GovernedSkillPackageFailureCode,
  type GovernedSkillPackageRegistry,
} from "./governed-skill-packages";

const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

/**
 * The sole initial-generation adapter. It joins a signed governed capability
 * request to server-derived planning input; it never creates planning, recipe,
 * component, asset, or proposal authority of its own.
 */
export const governedInitialGenerationRequestSchema = z
  .object({
    executionKind: z.literal("initialGeneration"),
    packageId: z.string().regex(/^[a-z][A-Za-z0-9]{2,79}$/),
    packageVersion: versionSchema,
    authority: governedInitialGenerationAuthoritySchema,
    planningInput: z.unknown(),
  })
  .strict();

export type GovernedInitialGenerationRequest = Readonly<{
  executionKind: "initialGeneration";
  packageId: string;
  packageVersion: string;
  authority: GovernedInitialGenerationAuthority;
  planningInput: unknown;
}>;

export type GovernedInitialGenerationFailureCode =
  | GovernedSkillPackageFailureCode
  | "unsupportedInitialGenerationPackage"
  | "staleInitialGenerationAuthority"
  | "stalePlanningAuthority"
  | "invalidPlanningInput"
  | "planningFailed"
  | "proposalCompilationFailed";

export type GovernedInitialGenerationFailure = Readonly<{
  code: GovernedInitialGenerationFailureCode;
  message: string;
}>;

export type GovernedInitialGenerationResult =
  | Readonly<{
      valid: true;
      proposal: WholeStorefrontProposal;
      plan: WholeStorefrontGenerationPlan;
      planningInput: WholeStorefrontPlanningInput;
      authority: GovernedInitialGenerationAuthority;
      outputFingerprint: string;
    }>
  | Readonly<{ valid: false; failure: GovernedInitialGenerationFailure }>;

function frozen<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) frozen(Reflect.get(value, key));
  }
  return value;
}

function failure(
  code: GovernedInitialGenerationFailureCode,
  message: string,
): GovernedInitialGenerationResult {
  return frozen({ valid: false as const, failure: frozen({ code, message }) });
}

function mappedFailure(failureValue: GovernedSkillPackageFailure): GovernedInitialGenerationResult {
  return failure(failureValue.code, failureValue.message);
}

function currentPlanningAuthorityMismatch(
  authority: GovernedInitialGenerationAuthority,
  planningInput: WholeStorefrontPlanningInput,
  currentAuthority: GovernedSkillAuthorityEnvelope,
): string | undefined {
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
    return "The server-derived planning input targets a stale draft.";
  }
  if (target.registryFingerprint !== currentAuthority.componentRegistryFingerprint) {
    return "The server-derived planning input has a stale component registry.";
  }
  if (target.canonicalCommerceFingerprint !== currentAuthority.commerceFingerprint) {
    return "The server-derived planning input has a stale commerce projection.";
  }
  if (target.approvedAssetContextFingerprint !== currentAuthority.approvedAssetFingerprint) {
    return "The server-derived planning input has stale approved-asset authority.";
  }
  if (!planningInput.project.enabledLocales.includes(currentAuthority.locale)) {
    return "The server-derived planning input does not support the governed request locale.";
  }
  if (
    planningInput.brief.id !== authority.brief.briefId ||
    planningInput.brief.revision !== authority.brief.revision ||
    planningInput.brief.fingerprint !== authority.brief.fingerprint
  ) {
    return "The server-derived approved brief does not match the governed request.";
  }
  if (target.canonicalCommerceFingerprint !== authority.catalogueFingerprint) {
    return "The server-derived catalogue does not match the governed request.";
  }
  return undefined;
}

type InitialGenerationProfilePlan = Pick<
  WholeStorefrontGenerationPlan,
  "target" | "pageBlueprintMaterializations"
>;

/**
 * Prevents the canonical planner from compiling a proposal with any
 * PageBlueprint materialization that was not explicitly authorized by the
 * governed request. This is intentionally a guard, not a second planner.
 */
export function validateAuthorizedInitialGenerationProfileSet(
  authority: GovernedInitialGenerationAuthority,
  plan: InitialGenerationProfilePlan,
): Readonly<{ valid: true }> | Readonly<{ valid: false; message: string }> {
  const requested = authority.profiles
    .map((profile) => ({
      pageId: profile.pageId,
      pageType: profile.pageType,
      profileId: profile.profileId,
      materializationFingerprint: profile.materializationFingerprint,
    }))
    .sort((left, right) =>
      `${left.pageType}:${left.pageId}:${left.profileId}`.localeCompare(
        `${right.pageType}:${right.pageId}:${right.profileId}`,
      ),
    );
  const materialized = plan.pageBlueprintMaterializations.map((profile) => {
    const pages = plan.target.pages.filter((page) => page.type === profile.pageType);
    if (pages.length !== 1) {
      return null;
    }
    return {
      pageId: pages[0].id,
      pageType: profile.pageType,
      profileId: profile.profileId,
      materializationFingerprint: profile.fingerprint,
    };
  });
  if (materialized.some((profile) => profile === null)) {
    return { valid: false, message: "The planned PageBlueprint page identity is ambiguous." };
  }
  const planned = materialized
    .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
    .sort((left, right) =>
      `${left.pageType}:${left.pageId}:${left.profileId}`.localeCompare(
        `${right.pageType}:${right.pageId}:${right.profileId}`,
      ),
    );
  const requestedKeys = requested.map(
    (profile) => `${profile.pageId}:${profile.pageType}:${profile.profileId}`,
  );
  const plannedKeys = planned.map(
    (profile) => `${profile.pageId}:${profile.pageType}:${profile.profileId}`,
  );
  if (
    new Set(requestedKeys).size !== requestedKeys.length ||
    new Set(plannedKeys).size !== plannedKeys.length ||
    canonicalValueFingerprint(requested) !== canonicalValueFingerprint(planned)
  ) {
    return {
      valid: false,
      message:
        "The governed PageBlueprint profile set does not exactly match canonical materialization.",
    };
  }
  return frozen({ valid: true as const });
}

/**
 * Validates governed initial-generation authority before invoking the existing
 * whole-storefront planner and proposal compiler. The result is an existing
 * typed proposal, with no provider, persistence, or editor side effect.
 */
export function executeGovernedInitialGeneration(
  inputValue: unknown,
  currentAuthority: GovernedSkillAuthorityEnvelope,
  registry: GovernedSkillPackageRegistry = governedSkillPackageRegistry,
): GovernedInitialGenerationResult {
  let requestResult: ReturnType<typeof governedInitialGenerationRequestSchema.safeParse>;
  try {
    requestResult = governedInitialGenerationRequestSchema.safeParse(structuredClone(inputValue));
  } catch {
    return failure("invalidRequest", "The governed initial-generation request is invalid.");
  }
  if (!requestResult.success)
    return failure("invalidRequest", "The governed initial-generation request is invalid.");
  try {
    const request = requestResult.data;
    const packageResolution = registry.resolve(request.packageId, request.executionKind);
    if (packageResolution.descriptor.id !== "applyRegisteredWholeStorefrontDirection") {
      return failure(
        "unsupportedInitialGenerationPackage",
        "Only the canonical registered whole-storefront direction package supports initial generation.",
      );
    }
    if (request.packageVersion !== packageResolution.descriptor.version) {
      return failure(
        "stalePackageAuthority",
        "The governed initial-generation package version is stale.",
      );
    }
    if (
      packageResolution.descriptor.outputContracts.initialGeneration !==
      request.authority.outputContractId
    ) {
      return failure(
        "invalidRequest",
        "The governed package does not authorize this initial-generation output contract.",
      );
    }
    const validatedAuthority = registry.validateInitialGeneration(
      request.authority,
      currentAuthority,
    );
    if (!validatedAuthority.valid) return mappedFailure(validatedAuthority.failure);

    const planningInput = wholeStorefrontPlanningInputSchema.safeParse(request.planningInput);
    if (!planningInput.success) {
      return failure("invalidPlanningInput", "The server-derived planning input is invalid.");
    }
    const mismatch = currentPlanningAuthorityMismatch(
      validatedAuthority.value.authority,
      planningInput.data,
      currentAuthority,
    );
    if (mismatch) return failure("stalePlanningAuthority", mismatch);

    let plan: WholeStorefrontGenerationPlan;
    try {
      plan = createWholeStorefrontGenerationPlan(planningInput.data, {
        directionId: validatedAuthority.value.authority.registeredDirectionId,
      });
    } catch (error) {
      return failure(
        "planningFailed",
        error instanceof Error ? error.message : "Initial generation could not be planned.",
      );
    }
    const profileSet = validateAuthorizedInitialGenerationProfileSet(
      validatedAuthority.value.authority,
      plan,
    );
    if (!profileSet.valid) return failure("staleInitialGenerationAuthority", profileSet.message);
    let proposal: WholeStorefrontProposal;
    try {
      proposal = compileWholeStorefrontProposal({ plan, planningInput: planningInput.data });
      validateWholeStorefrontProposal(proposal, { plan, planningInput: planningInput.data });
    } catch (error) {
      return failure(
        "proposalCompilationFailed",
        error instanceof Error ? error.message : "Initial generation could not be compiled safely.",
      );
    }
    return frozen({
      valid: true as const,
      plan: frozen(structuredClone(plan)),
      proposal: frozen(structuredClone(proposal)),
      planningInput: frozen(structuredClone(planningInput.data)),
      authority: validatedAuthority.value.authority,
      outputFingerprint: `governed-initial-generation-${canonicalValueFingerprint({
        authority: validatedAuthority.value.outputFingerprint,
        plan: plan.fingerprint,
        proposal: proposal.id,
      })}`,
    });
  } catch (error) {
    if (error instanceof GovernedSkillPackageError) {
      return failure(error.code, error.message);
    }
    return failure(
      "planningFailed",
      error instanceof Error ? error.message : "Initial generation could not be planned.",
    );
  }
}
