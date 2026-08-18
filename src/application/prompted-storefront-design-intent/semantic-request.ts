import { coordinatedStorefrontDirectionIdSchema } from "@/application/bounded-storefront-synthesis";
import {
  canonicalValueFingerprint,
  commercialSharedFrameProfileIdSchema,
} from "@/domain/storefront";
import { PromptedStorefrontDesignIntentError } from "./contract";
import type { PromptedStorefrontDesignRequestAuthority } from "./request";
import {
  SEMANTIC_STOREFRONT_DESIGN_REQUEST_V1,
  semanticStorefrontDesignRequestV1Schema,
  type SemanticInfluenceAuthority,
  type SemanticStorefrontDesignRequestV1,
} from "./semantic-contract";
import { validatePromptedStorefrontDesignRequestV2 } from "./validation";

type SemanticPageFamily = SemanticStorefrontDesignRequestV1["supportedPageFamilies"][number];
export type CreateSemanticStorefrontDesignRequestV1Options = Readonly<{
  explicitConstraintAuthority?: SemanticStorefrontDesignRequestV1["explicitConstraintAuthority"];
  trustedExactHints?: SemanticStorefrontDesignRequestV1["trustedExactHints"];
  semanticAuthorityFingerprint: string;
  semanticInfluenceAuthority: SemanticInfluenceAuthority;
}>;

const contentFamilySemantics: Readonly<Record<string, SemanticPageFamily>> = Object.freeze({
  about: "about",
  contact: "contact-locations",
  "store-locations": "contact-locations",
  faq: "faq",
  "shipping-information": "service-policy",
  "returns-information": "service-policy",
  "policy-legal": "service-policy",
  "campaign-editorial": "campaign-landing",
  "generic-content": "generic-content",
});

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

export function semanticStorefrontCurrentAuthorityFingerprint(
  authority: PromptedStorefrontDesignRequestAuthority["request"]["currentAuthority"],
): string {
  return `semantic-current-authority-${canonicalValueFingerprint(authority)}`;
}

function semanticRequestFingerprint(
  request: Omit<SemanticStorefrontDesignRequestV1, "requestFingerprint">,
): string {
  return `semantic-storefront-request-${canonicalValueFingerprint(request)}`;
}

function semanticPageFamilies(
  authority: PromptedStorefrontDesignRequestAuthority,
  allowedAvailability: ReadonlySet<string>,
): SemanticPageFamily[] {
  const families = authority.request.capabilityProjection.capabilities.flatMap((capability) => {
    if (
      capability.dimension !== "content-support.profile" ||
      !allowedAvailability.has(capability.availability)
    ) {
      return [];
    }
    return capability.contexts.flatMap((context) => {
      const semantic = contentFamilySemantics[context];
      return semantic === undefined ? [] : [semantic];
    });
  });
  return sortedUnique(families);
}

function aggregateRange(
  ranges: readonly Readonly<{ minimum: number; maximum: number }>[],
): Readonly<{ minimum: number; maximum: number }> {
  if (ranges.length === 0) return { minimum: 0, maximum: 0 };
  return {
    minimum: Math.min(...ranges.map(({ minimum }) => minimum)),
    maximum: Math.max(...ranges.map(({ maximum }) => maximum)),
  };
}

function boundedBrandDirection(authority: PromptedStorefrontDesignRequestAuthority): string {
  const context = authority.request.approvedMerchantContext;
  const firstPriority = context.approvedToneOrVisualPriorities[0]?.trim();
  const value = firstPriority || context.approvedBrandSummary.trim();
  return value.slice(0, 240);
}

function validateTrustedHints(
  hints: SemanticStorefrontDesignRequestV1["trustedExactHints"],
): SemanticStorefrontDesignRequestV1["trustedExactHints"] {
  if (
    hints.directionPackageId !== null &&
    !coordinatedStorefrontDirectionIdSchema.safeParse(hints.directionPackageId).success
  ) {
    throw new PromptedStorefrontDesignIntentError("invalid-request");
  }
  if (
    hints.frameFamilyId !== null &&
    !commercialSharedFrameProfileIdSchema.safeParse(hints.frameFamilyId).success
  ) {
    throw new PromptedStorefrontDesignIntentError("invalid-request");
  }
  return hints;
}

export function createSemanticStorefrontDesignRequestV1(
  authorityInput: PromptedStorefrontDesignRequestAuthority,
  options: CreateSemanticStorefrontDesignRequestV1Options,
): SemanticStorefrontDesignRequestV1 {
  const request = validatePromptedStorefrontDesignRequestV2(authorityInput.request);
  if (
    request.capabilityProjection.fingerprint !==
    authorityInput.capabilityAuthority.projection.fingerprint
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }

  const productTypes = request.catalogueCharacteristics.productTypes;
  const currentAuthorityFingerprint = semanticStorefrontCurrentAuthorityFingerprint(
    request.currentAuthority,
  );
  const semanticAuthorityFingerprint = options.semanticAuthorityFingerprint;
  const trustedExactHints = validateTrustedHints(
    options.trustedExactHints ?? { directionPackageId: null, frameFamilyId: null },
  );
  const material = {
    contractVersion: SEMANTIC_STOREFRONT_DESIGN_REQUEST_V1,
    promptFingerprint: request.promptFingerprint,
    currentAuthorityFingerprint,
    semanticAuthorityFingerprint,
    merchantPrompt: request.merchantPrompt,
    merchantContext: {
      locale: request.approvedMerchantContext.supportedLocales[0] ?? "en",
      industry: request.approvedMerchantContext.industry?.trim() || "unspecified",
      approvedBrandDirection: boundedBrandDirection({
        request,
        capabilityAuthority: authorityInput.capabilityAuthority,
      }),
    },
    catalogueCharacteristics: {
      productCount: request.catalogueCharacteristics.productCount,
      collectionCount: request.catalogueCharacteristics.collectionCount,
      productTypeCount: productTypes.length,
      simpleProductCount: request.catalogueCharacteristics.simpleProductCount,
      configurableProductCount: request.catalogueCharacteristics.configurableProductCount,
      highConsiderationProductCount:
        request.catalogueCharacteristics.highConsiderationPresentationCount,
      optionGroupCountRange: aggregateRange(
        productTypes.map(({ optionGroupCountRange }) => optionGroupCountRange),
      ),
      mediaDepthRange: aggregateRange(productTypes.map(({ mediaDepthRange }) => mediaDepthRange)),
    },
    evidenceAvailability: {
      approvedFamilies: semanticPageFamilies(authorityInput, new Set(["available"])),
    },
    assetAvailability: {
      approvedRoleCount: request.evidenceAndAssets.approvedPresentationAssetRoles.length,
      editorialOrBrandImageryAvailable: request.evidenceAndAssets.editorialOrBrandImageryAvailable,
      responsiveTreatmentAvailable: request.evidenceAndAssets.responsiveAssetTreatmentAvailable,
    },
    supportedPageFamilies: semanticPageFamilies(
      authorityInput,
      new Set(["available", "evidence-dependent", "registered-fail-closed"]),
    ),
    explicitConstraintAuthority: [...(options.explicitConstraintAuthority ?? [])],
    trustedExactHints: { ...trustedExactHints },
    fixedRuntimeTruth: {
      commerce: "read-only" as const,
      canonicalMedia: "protected" as const,
      searchExecution: "canonical-transient-query-results" as const,
    },
    semanticInfluenceAuthority: options.semanticInfluenceAuthority,
  } satisfies Omit<SemanticStorefrontDesignRequestV1, "requestFingerprint">;
  const parsed = semanticStorefrontDesignRequestV1Schema.safeParse({
    ...material,
    requestFingerprint: semanticRequestFingerprint(material),
  });
  if (!parsed.success) throw new PromptedStorefrontDesignIntentError("invalid-request");
  return deepFreeze(parsed.data);
}

export function expectedSemanticStorefrontDesignRequestFingerprint(
  request: SemanticStorefrontDesignRequestV1,
): string {
  const { requestFingerprint: _requestFingerprint, ...material } = request;
  void _requestFingerprint;
  return semanticRequestFingerprint(material);
}
