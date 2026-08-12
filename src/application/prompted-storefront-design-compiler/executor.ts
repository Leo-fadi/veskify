import {
  createBoundedStorefrontSynthesisDecision,
  executeBoundedStorefrontSynthesis,
  type BoundedStorefrontSynthesisDecision,
  type BoundedStorefrontSynthesisResult,
} from "@/application/bounded-storefront-synthesis";
import type { ContentSupportFactAuthority } from "@/application/content-support-pages";
import type { DynamicCommerceDesignSelection } from "@/application/dynamic-commerce-routes";
import {
  listCommercialContentSupportProfiles,
  listCommercialUtilityProfiles,
} from "@/application/storefront-templates";
import type { PageFactEvidenceAuthority } from "@/application/storefront-site-map";
import type { ApprovedAssetPresentation } from "@/application/whole-storefront-generation-plan";
import { canonicalValueString } from "@/domain/storefront";
import {
  compiledPromptedStorefrontDesignDecisionV2Schema,
  PromptedStorefrontDesignCompilerError,
  type CompiledPromptedStorefrontDesignDecisionV2,
} from "./contract";
import {
  compilePromptedStorefrontDesignIntentV2,
  type CompilePromptedStorefrontDesignIntentV2Input,
} from "./compiler";

export type ExecuteCompiledPromptedStorefrontDesignDecisionV2Input =
  CompilePromptedStorefrontDesignIntentV2Input &
    Readonly<{
      compiledDecision: unknown;
      pageEvidenceAuthority: PageFactEvidenceAuthority;
      contentFactAuthority: ContentSupportFactAuthority;
      approvedAssetPresentations: readonly ApprovedAssetPresentation[];
    }>;

export type ExecutedPromptedStorefrontDesignDecisionV2 = Readonly<{
  compiledDecision: CompiledPromptedStorefrontDesignDecisionV2;
  synthesisDecision: BoundedStorefrontSynthesisDecision;
  synthesis: BoundedStorefrontSynthesisResult;
}>;

function fail(message: string, cause?: unknown): never {
  throw new PromptedStorefrontDesignCompilerError(
    "materialization-failed",
    message,
    cause ? { cause } : undefined,
  );
}

function dynamicCommerceSelection(
  decision: CompiledPromptedStorefrontDesignDecisionV2,
): DynamicCommerceDesignSelection {
  return {
    authorityFingerprint: decision.dynamicCommerceSelection.authorityFingerprint,
    collectionArchetypeId: decision.dynamicCommerceSelection.collectionArchetypeId,
    searchArchetypeId: decision.dynamicCommerceSelection.searchArchetypeId,
    standardSimpleArchetypeId: decision.dynamicCommerceSelection.standardSimpleArchetypeId,
    configurableArchetypeId: decision.dynamicCommerceSelection.configurableArchetypeId,
    galleryLedArchetypeId: decision.dynamicCommerceSelection.galleryLedArchetypeId,
    highConsiderationArchetypeId: decision.dynamicCommerceSelection.highConsiderationArchetypeId,
    genericFallbackArchetypeId: decision.dynamicCommerceSelection.genericFallbackArchetypeId,
    productTypeMappings: Object.fromEntries(
      decision.dynamicCommerceSelection.productTypeMappings.map(
        ({ productTypeId, archetypeId }) => [productTypeId, archetypeId],
      ),
    ),
  };
}

function selectedProfileIdentities(
  decision: BoundedStorefrontSynthesisDecision,
  registeredProfileIds: ReadonlySet<string>,
): readonly string[] {
  return [
    ...new Set(
      decision.pageProfileSelections
        .filter(({ profileId }) => registeredProfileIds.has(profileId))
        .map(({ profileId, profileVersion }) => `${profileId}@${profileVersion}`),
    ),
  ].sort();
}

/**
 * Revalidates one transient compiler result against exact current authority and
 * executes it through the existing bounded-synthesis, planner and isolated
 * proposal lifecycle. Decision construction is metadata-only; the sole call
 * to executeBoundedStorefrontSynthesis performs the one canonical complete
 * StorefrontSnapshot materialization.
 */
export function executeCompiledPromptedStorefrontDesignDecisionV2(
  input: ExecuteCompiledPromptedStorefrontDesignDecisionV2Input,
): ExecutedPromptedStorefrontDesignDecisionV2 {
  const supplied = compiledPromptedStorefrontDesignDecisionV2Schema.safeParse(
    input.compiledDecision,
  );
  if (!supplied.success) {
    throw new PromptedStorefrontDesignCompilerError(
      "invalid-input",
      "The compiled prompted storefront decision is invalid.",
      { cause: supplied.error },
    );
  }

  const expected = compilePromptedStorefrontDesignIntentV2({
    originalRequest: input.originalRequest,
    providerIntent: input.providerIntent,
    currentRequestInput: input.currentRequestInput,
    compatibilityInput: input.compatibilityInput,
    ...(input.maximumCandidateEvaluations === undefined
      ? {}
      : { maximumCandidateEvaluations: input.maximumCandidateEvaluations }),
  });
  if (canonicalValueString(supplied.data) !== canonicalValueString(expected)) {
    throw new PromptedStorefrontDesignCompilerError(
      "stale-authority",
      "The compiled prompted storefront decision does not match exact current authority.",
    );
  }

  const synthesisInput = {
    ...input.compatibilityInput,
    request: {
      intent: "prompted-design-v2",
      deterministicSeed: `prompted-design-v2-${expected.compiledDecisionFingerprint.slice(-48)}`,
    },
    exactSelection: expected.exactSelection,
    pageBlueprintSelectionOverrides: expected.pageBlueprintSelectionOverrides,
    approvedAssetRoleSelections: expected.approvedAssetRoleSelections,
    dynamicCommerceSelection: dynamicCommerceSelection(expected),
    promptedExecutionAuthority: {
      responsiveCapabilityKeys: expected.responsiveArtDirection.responsiveCapabilityKeys,
      artDirectionCapabilityKeys: expected.responsiveArtDirection.artDirectionCapabilityKeys,
      approvedAssetRoleKeys: expected.responsiveArtDirection.approvedAssetRoleKeys,
      desktopNarrativePriority: expected.narrative.desktopPriority,
      mobileNarrativePriority: expected.narrative.mobilePriority,
    },
  } as const;

  let synthesisDecision: BoundedStorefrontSynthesisDecision;
  try {
    synthesisDecision = createBoundedStorefrontSynthesisDecision(synthesisInput);
  } catch (error) {
    return fail(
      "The compiled design selection is not executable by current synthesis authority.",
      error,
    );
  }

  const exactSelectionsMatch =
    expected.designDna.authorityFingerprint ===
      `compiled-${synthesisDecision.designDna.fingerprint}` &&
    synthesisDecision.designDna.directionId === expected.designDna.directionId &&
    synthesisDecision.sharedFrame.profileId === expected.sharedFrame.profileId &&
    synthesisDecision.sharedFrame.profileVersion === expected.sharedFrame.profileVersion &&
    synthesisDecision.commercialProfiles.homepageProfileId ===
      expected.profiles.homepage.profileId &&
    synthesisDecision.commercialProfiles.collectionProfileId ===
      expected.profiles.collection.profileId &&
    synthesisDecision.commercialProfiles.searchProfileId === expected.profiles.search.profileId &&
    synthesisDecision.commercialProfiles.pdpProfileId ===
      expected.profiles.productDetail.profileId &&
    canonicalValueString(synthesisDecision.pageBlueprintSelectionOverrides) ===
      canonicalValueString(expected.pageBlueprintSelectionOverrides) &&
    canonicalValueString(synthesisDecision.approvedAssetRoleSelections) ===
      canonicalValueString(expected.approvedAssetRoleSelections) &&
    canonicalValueString(synthesisDecision.dynamicCommerceSelection) ===
      canonicalValueString(dynamicCommerceSelection(expected)) &&
    canonicalValueString(
      selectedProfileIdentities(
        synthesisDecision,
        new Set(
          listCommercialContentSupportProfiles().flatMap(({ profile }) =>
            profile ? [profile.id] : [],
          ),
        ),
      ),
    ) === canonicalValueString(expected.staticContentSupportSelections) &&
    canonicalValueString(
      selectedProfileIdentities(
        synthesisDecision,
        new Set(
          listCommercialUtilityProfiles().flatMap(({ profile }) => (profile ? [profile.id] : [])),
        ),
      ),
    ) === canonicalValueString(expected.utilityPresentationSelections) &&
    synthesisDecision.responsivePosture.mode === expected.responsiveArtDirection.responsiveMode &&
    canonicalValueString(synthesisDecision.promptedExecutionAuthority) ===
      canonicalValueString(synthesisInput.promptedExecutionAuthority);
  if (!exactSelectionsMatch) {
    return fail("The bounded synthesis decision did not preserve the exact compiled selections.");
  }

  try {
    const synthesis = executeBoundedStorefrontSynthesis({
      ...synthesisInput,
      decision: synthesisDecision,
      pageEvidenceAuthority: input.pageEvidenceAuthority,
      contentFactAuthority: input.contentFactAuthority,
      approvedAssetPresentations: input.approvedAssetPresentations,
    });
    return Object.freeze({
      compiledDecision: structuredClone(expected),
      synthesisDecision: structuredClone(synthesisDecision),
      synthesis,
    });
  } catch (error) {
    return fail("The compiled prompted design could not be materialized atomically.", error);
  }
}
