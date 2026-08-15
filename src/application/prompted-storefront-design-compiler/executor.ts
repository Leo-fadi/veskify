import {
  boundedStorefrontSynthesisDecisionSchema,
  executeBoundedStorefrontSynthesis,
  type BoundedStorefrontSynthesisDecision,
  type BoundedStorefrontSynthesisResult,
  type CompatibleCoordinatedDirectionNarrowingInput,
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
import type { CompileSemanticStorefrontDesignIntentV1Input } from "./semantic-compiler";

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

function executeExactCompiledPromptedStorefrontDecision(
  input: Readonly<{
    compiledDecision: CompiledPromptedStorefrontDesignDecisionV2;
    synthesisDecision: BoundedStorefrontSynthesisDecision;
    compatibilityInput: CompatibleCoordinatedDirectionNarrowingInput;
    pageEvidenceAuthority: PageFactEvidenceAuthority;
    contentFactAuthority: ContentSupportFactAuthority;
    approvedAssetPresentations: readonly ApprovedAssetPresentation[];
  }>,
): ExecutedPromptedStorefrontDesignDecisionV2 {
  const expected = input.compiledDecision;
  const dynamic = dynamicCommerceSelection(expected);
  const synthesisInput = {
    ...input.compatibilityInput,
    request: input.synthesisDecision.request,
    exactSelection: expected.exactSelection,
    pageBlueprintSelectionOverrides: expected.pageBlueprintSelectionOverrides,
    approvedAssetRoleSelections: expected.approvedAssetRoleSelections,
    dynamicCommerceSelection: dynamic,
    promptedExecutionAuthority: {
      responsiveCapabilityKeys: expected.responsiveArtDirection.responsiveCapabilityKeys,
      artDirectionCapabilityKeys: expected.responsiveArtDirection.artDirectionCapabilityKeys,
      approvedAssetRoleKeys: expected.responsiveArtDirection.approvedAssetRoleKeys,
      desktopNarrativePriority: expected.narrative.desktopPriority,
      mobileNarrativePriority: expected.narrative.mobilePriority,
    },
  };
  const synthesisDecision = input.synthesisDecision;
  const contentProfileIds = new Set(
    listCommercialContentSupportProfiles().flatMap(({ profile }) => (profile ? [profile.id] : [])),
  );
  const utilityProfileIds = new Set(
    listCommercialUtilityProfiles().flatMap(({ profile }) => (profile ? [profile.id] : [])),
  );
  if (
    synthesisDecision.request.intent !== "prompted-design-v2" ||
    expected.designDna.authorityFingerprint !==
      `compiled-${synthesisDecision.designDna.fingerprint}` ||
    synthesisDecision.designDna.directionId !== expected.designDna.directionId ||
    synthesisDecision.sharedFrame.profileId !== expected.sharedFrame.profileId ||
    synthesisDecision.sharedFrame.profileVersion !== expected.sharedFrame.profileVersion ||
    synthesisDecision.commercialProfiles.homepageProfileId !==
      expected.profiles.homepage.profileId ||
    synthesisDecision.commercialProfiles.collectionProfileId !==
      expected.profiles.collection.profileId ||
    synthesisDecision.commercialProfiles.searchProfileId !== expected.profiles.search.profileId ||
    synthesisDecision.commercialProfiles.pdpProfileId !==
      expected.profiles.productDetail.profileId ||
    canonicalValueString(synthesisDecision.pageBlueprintSelectionOverrides) !==
      canonicalValueString(expected.pageBlueprintSelectionOverrides) ||
    canonicalValueString(synthesisDecision.approvedAssetRoleSelections) !==
      canonicalValueString(expected.approvedAssetRoleSelections) ||
    canonicalValueString(synthesisDecision.dynamicCommerceSelection) !==
      canonicalValueString(dynamic) ||
    canonicalValueString(selectedProfileIdentities(synthesisDecision, contentProfileIds)) !==
      canonicalValueString(expected.staticContentSupportSelections) ||
    canonicalValueString(selectedProfileIdentities(synthesisDecision, utilityProfileIds)) !==
      canonicalValueString(expected.utilityPresentationSelections) ||
    synthesisDecision.responsivePosture.mode !== expected.responsiveArtDirection.responsiveMode ||
    canonicalValueString(synthesisDecision.promptedExecutionAuthority) !==
      canonicalValueString(synthesisInput.promptedExecutionAuthority)
  ) {
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

export type ExecuteCompiledSemanticStorefrontDesignIntentV1Input =
  CompileSemanticStorefrontDesignIntentV1Input &
    Readonly<{
      compiledDecision: unknown;
      synthesisDecision: unknown;
      pageEvidenceAuthority: PageFactEvidenceAuthority;
      contentFactAuthority: ContentSupportFactAuthority;
      approvedAssetPresentations: readonly ApprovedAssetPresentation[];
    }>;

/** The sole prompted-generation executor and complete materialization boundary. */
export function executeCompiledSemanticStorefrontDesignIntentV1(
  input: ExecuteCompiledSemanticStorefrontDesignIntentV1Input,
): ExecutedPromptedStorefrontDesignDecisionV2 {
  const supplied = compiledPromptedStorefrontDesignDecisionV2Schema.safeParse(
    input.compiledDecision,
  );
  const suppliedSynthesis = boundedStorefrontSynthesisDecisionSchema.safeParse(
    input.synthesisDecision,
  );
  if (!supplied.success || !suppliedSynthesis.success) {
    throw new PromptedStorefrontDesignCompilerError(
      "invalid-input",
      "The compiled semantic storefront decision is invalid.",
      { cause: supplied.success ? suppliedSynthesis.error : supplied.error },
    );
  }
  const compiled = supplied.data;
  if (
    compiled.identity.requestFingerprint !== input.originalRequest.requestFingerprint ||
    compiled.identity.promptFingerprint !== input.originalRequest.promptFingerprint ||
    compiled.identity.providerIntentFingerprint !==
      input.providerIntent.semanticIntentFingerprint ||
    !compiled.exactAuthorityFingerprints.includes(suppliedSynthesis.data.synthesisFingerprint)
  ) {
    throw new PromptedStorefrontDesignCompilerError(
      "stale-authority",
      "The compiled semantic storefront decision does not match current authority.",
    );
  }
  return executeExactCompiledPromptedStorefrontDecision({
    compiledDecision: compiled,
    synthesisDecision: suppliedSynthesis.data,
    compatibilityInput: input.compatibilityInput,
    pageEvidenceAuthority: input.pageEvidenceAuthority,
    contentFactAuthority: input.contentFactAuthority,
    approvedAssetPresentations: input.approvedAssetPresentations,
  });
}
