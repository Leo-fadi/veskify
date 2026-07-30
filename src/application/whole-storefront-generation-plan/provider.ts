import {
  registeredTokenRefinementPlanSchema,
  type RegisteredTokenRefinementPlan,
} from "@/application/storefront-design-system";
import {
  acceptWholeStorefrontPlanningResult,
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
} from "./planner";
import {
  type WholeStorefrontGenerationPlan,
  type WholeStorefrontPlanningInput,
  WholeStorefrontGenerationPlanError,
} from "./contract";

export type WholeStorefrontPlanningProviderCapability = Readonly<{
  wholeStorefrontPlanning: boolean;
  structuredPlanOutput: boolean;
  approvedAssetReferences: boolean;
}>;

export type WholeStorefrontPlanningProviderRequest = Readonly<{
  merchantInstruction: string;
  requestFingerprint: string;
  approvedBrief: Readonly<{
    id: string;
    revision: number;
    evidenceFingerprint: string;
    languagePlan: WholeStorefrontGenerationPlan["languagePlan"];
    pageTypes: readonly string[];
    brandDirection: Readonly<{
      preferredBrandColours: readonly string[];
      typographyDirection: string;
      visualStyleDirection: string;
      imageryDirection: string;
      toneKeywords: readonly string[];
    }>;
    evidenceSummary: Readonly<{
      sourceReferenceIds: readonly string[];
      sourceEvidenceIds: readonly string[];
    }>;
    businessContext: Readonly<{
      businessName: string;
      shortDescription: string;
      industry: string | null;
      targetCustomer: string;
      primaryMarket: string;
      secondaryMarkets: readonly string[];
      homepageGoals: readonly string[];
      collectionPageGoals: readonly string[];
      productPageGoals: readonly string[];
      visualPriorities: readonly string[];
      excludedClaims: readonly string[];
    }>;
  }>;
  target: WholeStorefrontGenerationPlan["target"];
  registry: readonly Readonly<{
    type: string;
    version: { major: number; minor: number; patch: number };
    supportedPageTypes: readonly string[];
    variants: readonly string[];
    contentFields: readonly string[];
    propsFields: readonly string[];
    styleOverrideFields: readonly string[];
    bindingSlots: readonly Readonly<{
      id: string;
      acceptedSourceTypes: readonly string[];
      required: boolean;
      revisionRequired: boolean;
    }>[];
    assetSlots: readonly Readonly<{
      id: string;
      acceptedRoles: readonly string[];
      required: boolean;
      minItems: number;
      maxItems?: number;
    }>[];
  }>[];
  recipes: Readonly<{
    fingerprint: string;
    designSystem: WholeStorefrontPlanningInput["recipeContext"]["designSystem"];
    templates: readonly Readonly<{
      id: string;
      version: string;
      supportedPageTypes: readonly string[];
      pagePlans: readonly Readonly<{
        pageType: string;
        slots: readonly Readonly<{
          id: string;
          sectionType: string;
          allowedVariants: readonly string[];
          required: boolean;
          omitWhen: string;
        }>[];
      }>[];
    }>[];
  }>;
  canonicalCommerce: Readonly<{
    productIds: readonly string[];
    collections: readonly Readonly<{ id: string; productIds: readonly string[] }>[];
    fingerprint: string;
    protectedFacts: readonly string[];
  }>;
  approvedAssets: Readonly<{
    contextFingerprint: string | null;
    assets: readonly Readonly<{
      assetId: string;
      role: string;
      revision: string;
      materialFingerprint: string;
      decorative: boolean;
      hasLocalizedAlt: boolean;
    }>[];
    requiredPlacements: WholeStorefrontGenerationPlan["approvedAssetPlacements"];
  }>;
  requiredPageFamilies: readonly Readonly<{
    pageId: string;
    role: string;
    pageType: string;
    requirements: readonly string[];
  }>[];
  protectedInstructions: readonly string[];
  directionOptions: readonly Readonly<{
    directionVersion: "1.0.0";
    id: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"];
    homepageRecipeId: string;
    collectionRecipeId: string;
    productRecipeId: string;
    productCardFamilyId: string;
    typographyDirectionId: string;
    imageTreatmentId: string;
    spacingDensity: "compact" | "standard" | "spacious";
    cornerTreatment: "square" | "soft" | "rounded";
    surfaceDepth: "flat" | "subtle" | "layered";
    componentSelections: WholeStorefrontGenerationPlan["designSystemSelection"]["componentSelections"];
  }>[];
  planForDirection: (
    directionId: WholeStorefrontGenerationPlan["designSystemSelection"]["directionId"],
  ) => WholeStorefrontGenerationPlan;
  requestClass: WholeStorefrontGenerationPlan["requestClass"];
  tokenRefinementPlan: RegisteredTokenRefinementPlan | null;
  planForTokenRefinement: () => WholeStorefrontGenerationPlan;
  expectedPlan: WholeStorefrontGenerationPlan;
}>;

export interface WholeStorefrontPlanningProvider {
  readonly id: string;
  readonly capabilities: WholeStorefrontPlanningProviderCapability;
  createPlan(request: WholeStorefrontPlanningProviderRequest): Promise<unknown>;
}

export type WholeStorefrontPlanningProviderFailureCode =
  | "invalid-request"
  | "credentials-unavailable"
  | "provider-unavailable"
  | "malformed-structured-response"
  | "provider-refusal"
  | "provider-incapable"
  | "invalid-plan"
  | "stale-result";

export class WholeStorefrontPlanningProviderError extends Error {
  constructor(
    readonly code: WholeStorefrontPlanningProviderFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "WholeStorefrontPlanningProviderError";
  }
}

const merchantSafeMessages: Record<WholeStorefrontPlanningProviderFailureCode, string> = {
  "invalid-request": "The approved storefront planning request is incomplete or no longer current.",
  "credentials-unavailable": "The storefront planning assistant is temporarily unavailable.",
  "provider-unavailable": "The storefront planning assistant is temporarily unavailable.",
  "malformed-structured-response":
    "The storefront planning assistant returned an invalid plan. The draft remains unchanged.",
  "provider-refusal": "The storefront planning assistant could not prepare this storefront plan.",
  "provider-incapable": "This storefront planning assistant cannot prepare the required plan.",
  "invalid-plan": "The storefront plan could not be safely validated. The draft remains unchanged.",
  "stale-result": "The storefront changed while the plan was being prepared. Create a new plan.",
};

function fail(code: WholeStorefrontPlanningProviderFailureCode): never {
  throw new WholeStorefrontPlanningProviderError(code, merchantSafeMessages[code]);
}

function noUnsafeProviderContent(value: unknown): boolean {
  if (typeof value === "string") {
    return !/(?:<\/?[a-z][^>]*>|https?:|javascript:|data:|\b(?:function|import|export)\s*\(|=>)/iu.test(
      value,
    );
  }
  if (Array.isArray(value)) return value.every(noUnsafeProviderContent);
  return (
    typeof value !== "object" ||
    value === null ||
    Object.values(value as Record<string, unknown>).every(noUnsafeProviderContent)
  );
}

function sortedStrings(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function validatedMerchantInstruction(value: unknown): string {
  if (typeof value !== "string") return fail("invalid-request");
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 2_000 ||
    [...normalized].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127;
    })
  ) {
    return fail("invalid-request");
  }
  return normalized;
}

export function buildWholeStorefrontPlanningProviderRequest(
  inputValue: unknown,
  merchantInstruction = "Prepare a coherent storefront using the approved merchant brief.",
  tokenRefinementValue: unknown = null,
): WholeStorefrontPlanningProviderRequest {
  const instruction = validatedMerchantInstruction(merchantInstruction);
  const tokenRefinement =
    tokenRefinementValue === null
      ? null
      : registeredTokenRefinementPlanSchema.parse(tokenRefinementValue);
  let input: WholeStorefrontPlanningInput;
  let expectedPlan: WholeStorefrontGenerationPlan;
  try {
    expectedPlan = createWholeStorefrontGenerationPlan(inputValue, {
      tokenRefinementPlan: tokenRefinement,
    });
    input = structuredClone(inputValue as WholeStorefrontPlanningInput);
  } catch {
    return fail("invalid-request");
  }
  const target = createWholeStorefrontGenerationTarget(input);
  const brandDirection = expectedPlan.sharedDesignDirection;
  if (!noUnsafeProviderContent(brandDirection)) {
    return fail("invalid-request");
  }
  if (!noUnsafeProviderContent(expectedPlan)) return fail("invalid-request");

  const request: WholeStorefrontPlanningProviderRequest = {
    merchantInstruction: instruction,
    requestFingerprint: expectedPlan.requestFingerprint,
    approvedBrief: {
      id: input.brief.id,
      revision: input.brief.revision,
      evidenceFingerprint: expectedPlan.evidenceFingerprint,
      languagePlan: structuredClone(expectedPlan.languagePlan),
      pageTypes: sortedStrings(input.brief.pagePlan.pageTypes),
      brandDirection: {
        preferredBrandColours: sortedStrings(brandDirection.preferredBrandColours),
        typographyDirection: brandDirection.typographyDirection,
        visualStyleDirection: brandDirection.visualStyleDirection,
        imageryDirection: brandDirection.imageryDirection,
        toneKeywords: sortedStrings(brandDirection.toneKeywords),
      },
      evidenceSummary: {
        sourceReferenceIds: sortedStrings(input.brief.sourceReferenceIds),
        sourceEvidenceIds: sortedStrings(input.brief.sourceEvidenceIds),
      },
      businessContext: {
        businessName: input.brief.businessIdentity.businessName,
        shortDescription: input.brief.businessIdentity.shortDescription,
        industry: input.brief.businessIdentity.industry,
        targetCustomer: input.brief.businessIdentity.targetCustomer,
        primaryMarket: input.brief.businessIdentity.primaryMarket,
        secondaryMarkets: sortedStrings(input.brief.businessIdentity.secondaryMarkets),
        homepageGoals: sortedStrings(input.brief.homepageGoals),
        collectionPageGoals: sortedStrings(input.brief.collectionPageGoals),
        productPageGoals: sortedStrings(input.brief.productPageGoals),
        visualPriorities: sortedStrings(input.brief.visualPriorities),
        excludedClaims: sortedStrings(input.brief.excludedClaims),
      },
    },
    target: structuredClone(target),
    registry: [...input.componentDefinitions]
      .sort((left, right) => left.type.localeCompare(right.type))
      .map((definition) => ({
        type: definition.type,
        version: structuredClone(definition.version),
        supportedPageTypes: sortedStrings(definition.supportedPageTypes),
        variants: sortedStrings(definition.variants.map((variant) => variant.id)),
        contentFields: sortedStrings(Object.keys(definition.contentSchema.properties)),
        propsFields: sortedStrings(Object.keys(definition.propsSchema.properties)),
        styleOverrideFields: sortedStrings(Object.keys(definition.styleOverridesSchema.properties)),
        bindingSlots: definition.commerceBindingSlots
          .map((slot) => ({
            id: slot.id,
            acceptedSourceTypes: sortedStrings(slot.acceptedSourceTypes),
            required: slot.required,
            revisionRequired: slot.revisionRequired,
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
        assetSlots: definition.assetSlots
          .map((slot) => ({
            id: slot.id,
            acceptedRoles: sortedStrings(slot.acceptedRoles),
            required: slot.required,
            minItems: slot.minItems,
            ...(slot.maxItems === undefined ? {} : { maxItems: slot.maxItems }),
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      })),
    recipes: {
      fingerprint: input.recipeContext.fingerprint,
      designSystem: structuredClone(input.recipeContext.designSystem),
      templates: [...input.recipeContext.templates]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((template) => ({
          id: template.id,
          version: template.version,
          supportedPageTypes: sortedStrings(template.supportedPageTypes),
          pagePlans: [...template.pagePlans]
            .sort((left, right) => left.pageType.localeCompare(right.pageType))
            .map((pagePlan) => ({
              pageType: pagePlan.pageType,
              slots: pagePlan.slots.map((slot) => ({
                id: slot.id,
                sectionType: slot.sectionType,
                allowedVariants: sortedStrings(slot.allowedVariants),
                required: slot.required,
                omitWhen: slot.omitWhen,
              })),
            })),
        })),
    },
    canonicalCommerce: {
      productIds: [...target.productIds],
      collections: target.collections.map((collection) => ({
        id: collection.id,
        productIds: [...collection.productIds],
      })),
      fingerprint: target.canonicalCommerceFingerprint,
      protectedFacts: [
        "Never modify canonical product identity, SKU, price, compare-at price, availability, stock, variants, collection membership, or product media.",
        "Use canonical IDs only; do not copy commerce facts into editable content.",
      ],
    },
    approvedAssets: {
      contextFingerprint: input.approvedAssetContext?.fingerprint ?? null,
      assets: (input.approvedAssetContext?.assets ?? [])
        .map((asset) => ({
          assetId: asset.assetId,
          role: asset.role,
          revision: asset.revision,
          materialFingerprint: asset.materialFingerprint,
          decorative: asset.presentation.decorative,
          hasLocalizedAlt: asset.alt !== null,
        }))
        .sort((left, right) => left.assetId.localeCompare(right.assetId)),
      requiredPlacements: structuredClone(expectedPlan.approvedAssetPlacements),
    },
    requiredPageFamilies: target.pages.map((page) => ({
      pageId: page.id,
      role: page.role,
      pageType: page.type,
      requirements:
        expectedPlan.pagePlans.find((plan) => plan.pageId === page.id)?.familyRequirements ?? [],
    })),
    protectedInstructions: [
      "Return only the requested structured plan; do not emit HTML, CSS, executable code, markup, URLs, or provider instructions.",
      "Use only registered component types, versions, variants, fields, binding slots, asset slots, canonical IDs, and supported locales supplied in this request.",
      "Required shared chrome and homepage, collection-template, and product-template families must remain present.",
      "Do not apply, compile, publish, or otherwise mutate a storefront draft, history, or catalogue.",
    ],
    directionOptions: input.recipeContext.designSystem.directions
      .map((direction) => ({
        directionVersion: direction.version,
        id: direction.id,
        homepageRecipeId: direction.homepageRecipeId,
        collectionRecipeId: direction.collectionRecipeId,
        productRecipeId: direction.productRecipeId,
        productCardFamilyId: direction.productCardFamilyId,
        typographyDirectionId: direction.typographyDirectionId,
        imageTreatmentId: direction.imageTreatmentId,
        spacingDensity: direction.spacingDensity,
        cornerTreatment: direction.cornerTreatment,
        surfaceDepth: direction.surfaceDepth,
        componentSelections: structuredClone(direction.componentSelections),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    planForDirection: (directionId) => createWholeStorefrontGenerationPlan(input, { directionId }),
    requestClass: expectedPlan.requestClass,
    tokenRefinementPlan: tokenRefinement === null ? null : structuredClone(tokenRefinement),
    planForTokenRefinement: () =>
      createWholeStorefrontGenerationPlan(input, {
        tokenRefinementPlan: tokenRefinement,
      }),
    expectedPlan: structuredClone(expectedPlan),
  };
  const structuralRequest = Object.fromEntries(
    Object.entries(request).filter(([key]) => key !== "merchantInstruction"),
  );
  if (!noUnsafeProviderContent(structuralRequest)) return fail("invalid-request");
  return request;
}

export async function requestWholeStorefrontGenerationPlan({
  provider,
  input,
  currentInput,
  merchantInstruction,
  tokenRefinementPlan,
}: {
  provider: WholeStorefrontPlanningProvider;
  input: unknown;
  currentInput: () => unknown;
  merchantInstruction?: string;
  tokenRefinementPlan?: RegisteredTokenRefinementPlan | null;
}): Promise<WholeStorefrontGenerationPlan> {
  const request = buildWholeStorefrontPlanningProviderRequest(
    input,
    merchantInstruction,
    tokenRefinementPlan,
  );
  if (
    !provider.capabilities.wholeStorefrontPlanning ||
    !provider.capabilities.structuredPlanOutput ||
    (request.approvedAssets.requiredPlacements.length > 0 &&
      !provider.capabilities.approvedAssetReferences)
  ) {
    return fail("provider-incapable");
  }
  try {
    return await acceptWholeStorefrontPlanningResult(
      input,
      provider.createPlan(request),
      currentInput,
      tokenRefinementPlan,
    );
  } catch (error) {
    if (error instanceof WholeStorefrontPlanningProviderError) throw error;
    if (error instanceof WholeStorefrontGenerationPlanError) {
      return fail(error.code === "stale-result" ? "stale-result" : "invalid-plan");
    }
    return fail("provider-unavailable");
  }
}

export class DeterministicWholeStorefrontPlanningProvider implements WholeStorefrontPlanningProvider {
  readonly id = "deterministic-whole-storefront-planning";
  readonly capabilities = {
    wholeStorefrontPlanning: true,
    structuredPlanOutput: true,
    approvedAssetReferences: true,
  } as const;

  createPlan(
    request: WholeStorefrontPlanningProviderRequest,
  ): Promise<WholeStorefrontGenerationPlan> {
    return Promise.resolve(structuredClone(request.expectedPlan));
  }
}

export function createDeterministicWholeStorefrontPlanningProvider() {
  return new DeterministicWholeStorefrontPlanningProvider();
}
