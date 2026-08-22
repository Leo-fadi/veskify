import { performance } from "node:perf_hooks";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import {
  compileSemanticStorefrontDesignIntentV1,
  executeCompiledSemanticStorefrontDesignIntentV1,
} from "@/application/prompted-storefront-design-compiler";
import { getCommercialCollectionSearchProfile } from "@/application/storefront-templates/commercial-collection-search-profiles";
import { getCommercialContentSupportProfile } from "@/application/storefront-templates/commercial-content-support-profiles";
import { getCommercialHomepageProfile } from "@/application/storefront-templates/commercial-homepage-profiles";
import { getCommercialPdpProfile } from "@/application/storefront-templates/commercial-pdp-profiles";
import { getCommercialUtilityProfile } from "@/application/storefront-templates/commercial-utility-profiles";
import type { ProductDisplayModel } from "@/domain/catalogue";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  getCommercialSharedFrameProfile,
  pageFamilyDefinitions,
  storefrontSnapshotSchema,
  validateCanonicalStorefrontSiteMap,
  validateCommercialSharedFrameSnapshot,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import { semanticIntentFixture } from "../fixtures/p10b-16p-04-semantic-intent";
import {
  p10b18aDirectionLabelFreeNormalizedDesignTopology,
  p10b18aMaterializerConsumedDesignAuthority,
  p10b18aMaterializerDesignAuthorityFingerprint,
  p10b18aNormalizedDesignTopology,
  type P10b18aCompiledAuditResult,
  type P10b18aShapeAuthority,
} from "./p10b-18a-commercial-authority";
import { createP10b18cShapeAuthorities } from "./p10b-18c-synthetic-fixture-truth";

export const P10B18C_MATRIX_CONTRACT_VERSION = "p10b-18c-126-commercial-quality-matrix-v1" as const;
export const P10B18C_STAGE_B_BROWSER_TIMEOUT_MS = 18_000_000 as const;

export type P10b18cDirection = "premiumEditorial" | "modernTechnical" | "warmApproachable";

export type P10b18cSemanticDrivers = Readonly<{
  commercialPosture:
    | "premium-editorial"
    | "modern-technical"
    | "minimal-commerce"
    | "warm-approachable"
    | "bold-campaign"
    | "catalogue-comparison"
    | "high-consideration"
    | "fast-conversion";
  density: "low" | "balanced" | "high";
  navigationPosture: "editorial" | "catalogue" | "compact" | "minimal";
  storyCatalogueBalance: "story-first" | "balanced" | "catalogue-first";
  discoveryPosture: "editorial" | "catalogue-comparison" | "campaign" | "dense-search";
  configurableProductPosture: "standard" | "guided" | "technical";
  mobileHierarchy: "story-led" | "product-led" | "conversion-led" | "balanced";
  imageProminence: "restrained" | "balanced" | "image-led";
}>;

export type P10b18cSemanticStratum = Readonly<{
  id: string;
  group: "premium-editorial" | "modern-technical" | "minimal-warm";
  expectedDirection: P10b18cDirection;
  intentSummary: string;
  mappingNote: string;
  drivers: P10b18cSemanticDrivers;
}>;

export const p10b18cSemanticStrata = [
  {
    id: "premium-story-editorial",
    group: "premium-editorial",
    expectedDirection: "premiumEditorial",
    intentSummary: "Story-first editorial discovery with guided product decision support.",
    mappingNote: "Exact current low-density editorial/story/guided semantic values.",
    drivers: {
      commercialPosture: "premium-editorial",
      density: "low",
      navigationPosture: "editorial",
      storyCatalogueBalance: "story-first",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "story-led",
      imageProminence: "balanced",
    },
  },
  {
    id: "premium-campaign-image-led",
    group: "premium-editorial",
    expectedDirection: "premiumEditorial",
    intentSummary: "Campaign-led discovery and high image prominence where authority permits.",
    mappingNote:
      "Uses bold-campaign/campaign/image-led; asset-poor compatibility remains an explicit substitution.",
    drivers: {
      commercialPosture: "bold-campaign",
      density: "balanced",
      navigationPosture: "editorial",
      storyCatalogueBalance: "story-first",
      discoveryPosture: "campaign",
      configurableProductPosture: "guided",
      mobileHierarchy: "story-led",
      imageProminence: "image-led",
    },
  },
  {
    id: "premium-high-consideration",
    group: "premium-editorial",
    expectedDirection: "premiumEditorial",
    intentSummary: "Balanced premium story and catalogue with a guided high-consideration journey.",
    mappingNote: "Exact current high-consideration and guided semantic values.",
    drivers: {
      commercialPosture: "high-consideration",
      density: "balanced",
      navigationPosture: "editorial",
      storyCatalogueBalance: "balanced",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "balanced",
      imageProminence: "balanced",
    },
  },
  {
    id: "premium-product-restrained",
    group: "premium-editorial",
    expectedDirection: "premiumEditorial",
    intentSummary: "Product-led restrained premium hierarchy without a campaign requirement.",
    mappingNote: "Exact current restrained media and catalogue-first semantics.",
    drivers: {
      commercialPosture: "premium-editorial",
      density: "balanced",
      navigationPosture: "editorial",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "catalogue-comparison",
      configurableProductPosture: "standard",
      mobileHierarchy: "product-led",
      imageProminence: "restrained",
    },
  },
  {
    id: "premium-editorial-alternative",
    group: "premium-editorial",
    expectedDirection: "premiumEditorial",
    intentSummary:
      "A compact-navigation same-direction alternative to the story editorial request.",
    mappingNote:
      "Changes only the existing navigation posture from P1 so any difference is attributable to current frame compatibility.",
    drivers: {
      commercialPosture: "premium-editorial",
      density: "low",
      navigationPosture: "compact",
      storyCatalogueBalance: "story-first",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "story-led",
      imageProminence: "balanced",
    },
  },
  {
    id: "modern-catalogue-dense",
    group: "modern-technical",
    expectedDirection: "modernTechnical",
    intentSummary: "Dense catalogue-first technical discovery and configurable-product evaluation.",
    mappingNote: "Exact current high-density compact comparison/technical semantics.",
    drivers: {
      commercialPosture: "modern-technical",
      density: "high",
      navigationPosture: "compact",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "dense-search",
      configurableProductPosture: "technical",
      mobileHierarchy: "conversion-led",
      imageProminence: "balanced",
    },
  },
  {
    id: "modern-comparison",
    group: "modern-technical",
    expectedDirection: "modernTechnical",
    intentSummary: "Fact-forward catalogue comparison and technical product evaluation.",
    mappingNote: "Uses the current catalogue-comparison commercial and discovery values.",
    drivers: {
      commercialPosture: "catalogue-comparison",
      density: "high",
      navigationPosture: "catalogue",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "catalogue-comparison",
      configurableProductPosture: "technical",
      mobileHierarchy: "product-led",
      imageProminence: "balanced",
    },
  },
  {
    id: "modern-fast-conversion",
    group: "modern-technical",
    expectedDirection: "modernTechnical",
    intentSummary: "Direct restrained commerce with conversion-led configurable-product hierarchy.",
    mappingNote: "Exact current fast-conversion, technical and restrained values.",
    drivers: {
      commercialPosture: "fast-conversion",
      density: "balanced",
      navigationPosture: "compact",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "catalogue-comparison",
      configurableProductPosture: "technical",
      mobileHierarchy: "conversion-led",
      imageProminence: "restrained",
    },
  },
  {
    id: "modern-balanced-utility",
    group: "modern-technical",
    expectedDirection: "modernTechnical",
    intentSummary:
      "Balanced medium-density commerce with a utility-oriented frame and standard PDP.",
    mappingNote: "Exact current balanced, compact-navigation and standard-PDP values.",
    drivers: {
      commercialPosture: "modern-technical",
      density: "balanced",
      navigationPosture: "compact",
      storyCatalogueBalance: "balanced",
      discoveryPosture: "dense-search",
      configurableProductPosture: "standard",
      mobileHierarchy: "balanced",
      imageProminence: "balanced",
    },
  },
  {
    id: "modern-simple-heavy",
    group: "modern-technical",
    expectedDirection: "modernTechnical",
    intentSummary:
      "Simple-product-efficient technical commerce without gallery or campaign expansion.",
    mappingNote: "Uses fast-conversion with standard PDP and restrained image authority.",
    drivers: {
      commercialPosture: "fast-conversion",
      density: "balanced",
      navigationPosture: "catalogue",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "dense-search",
      configurableProductPosture: "standard",
      mobileHierarchy: "product-led",
      imageProminence: "restrained",
    },
  },
  {
    id: "minimal-product-first",
    group: "minimal-warm",
    expectedDirection: "warmApproachable",
    intentSummary: "Restrained product-first minimal direct commerce.",
    mappingNote: "Exact current minimal-commerce/product-led/restrained values.",
    drivers: {
      commercialPosture: "minimal-commerce",
      density: "balanced",
      navigationPosture: "minimal",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "dense-search",
      configurableProductPosture: "standard",
      mobileHierarchy: "product-led",
      imageProminence: "restrained",
    },
  },
  {
    id: "minimal-story-airy",
    group: "minimal-warm",
    expectedDirection: "warmApproachable",
    intentSummary: "Airy warm story-led composition with truthful editorial support.",
    mappingNote: "Uses current warm-approachable, low-density and story-led values.",
    drivers: {
      commercialPosture: "warm-approachable",
      density: "low",
      navigationPosture: "minimal",
      storyCatalogueBalance: "story-first",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "story-led",
      imageProminence: "balanced",
    },
  },
  {
    id: "minimal-balanced-guided",
    group: "minimal-warm",
    expectedDirection: "warmApproachable",
    intentSummary: "Balanced restrained composition with guided high-consideration support.",
    mappingNote: "Uses current warm-approachable, balanced and guided values.",
    drivers: {
      commercialPosture: "warm-approachable",
      density: "balanced",
      navigationPosture: "minimal",
      storyCatalogueBalance: "balanced",
      discoveryPosture: "editorial",
      configurableProductPosture: "guided",
      mobileHierarchy: "balanced",
      imageProminence: "restrained",
    },
  },
  {
    id: "minimal-catalogue-efficient",
    group: "minimal-warm",
    expectedDirection: "warmApproachable",
    intentSummary: "Restrained catalogue-focused collection and search efficiency.",
    mappingNote: "Uses current minimal-commerce, catalogue and dense-search values.",
    drivers: {
      commercialPosture: "minimal-commerce",
      density: "balanced",
      navigationPosture: "catalogue",
      storyCatalogueBalance: "catalogue-first",
      discoveryPosture: "dense-search",
      configurableProductPosture: "standard",
      mobileHierarchy: "product-led",
      imageProminence: "restrained",
    },
  },
] as const satisfies readonly P10b18cSemanticStratum[];

export const p10b18cSemanticDriverNames = [
  "commercialPosture",
  "density",
  "navigationPosture",
  "storyCatalogueBalance",
  "discoveryPosture",
  "configurableProductPosture",
  "mobileHierarchy",
  "imageProminence",
] as const satisfies readonly (keyof P10b18cSemanticDrivers)[];

export type P10b18cSemanticDriverName = (typeof p10b18cSemanticDriverNames)[number];

type RuntimeAuthority = "p03-standalone" | "p04-integrated-mock";

export type P10b18cCompleteness = Readonly<{
  routeCount: number;
  pageFamilyCount: number;
  requiredPageSet: readonly string[];
  optionalPageSet: readonly string[];
  presentPageFamilies: readonly string[];
  promisedButUnrenderedCount: number;
  promisedButUnrenderedPageKeys: readonly string[];
  placeholderCount: number;
  missingAssetCount: number;
  missingFactEvidenceCount: number;
  localeComplete: boolean;
  navigationTargetCount: number;
}>;

export type P10b18cCompiledCase = Readonly<{
  caseId: string;
  authority: P10b18aShapeAuthority;
  stratum: P10b18cSemanticStratum;
  providerIntent: ReturnType<typeof semanticIntentFixture>;
  result: P10b18aCompiledAuditResult;
  compileMilliseconds: number;
}>;

export type P10b18cMaterializedCase = Readonly<{
  compiled: P10b18cCompiledCase;
  snapshot: StorefrontSnapshot;
  aggregate: ReturnType<typeof validateProjectAggregate>;
  runtimeAuthority: RuntimeAuthority;
  locale: "en" | "fi";
  directionId: P10b18cDirection;
  profiles: Readonly<{
    homepage: string;
    collection: string;
    search: string;
    productDetail: string;
  }>;
  archetypes: Readonly<Record<string, string>>;
  representativeRoutes: Readonly<{
    home: "/";
    collection: string;
    search: "/search";
    productDetail: string;
  }>;
  representativeContext: Readonly<{
    collectionId: string;
    collectionProductCount: number;
    product: ProductDisplayModel;
    collectionArchetype: string;
    productArchetype: string;
  }>;
  normalizedTopology: Readonly<Record<string, unknown>>;
  directionLabelFreeTopology: Readonly<Record<string, unknown>>;
  fingerprints: Readonly<{
    semanticIntent: string;
    compiledDecision: string;
    compilerStructural: string;
    consumedAuthority: string;
    normalizedTopology: string;
    directionLabelFreeTopology: string;
    snapshot: string;
    catalogue: string;
    commerceBefore: string;
    commerceAfter: string;
    mediaBefore: string;
    mediaAfter: string;
    protectedCommerceDetail: string;
    protectedMediaDetail: string;
    approvedAssetPresentation: string;
  }>;
  completeness: P10b18cCompleteness;
  materializationMilliseconds: number;
  complexity: Readonly<{
    staticPageCount: number;
    dynamicRouteCount: number;
    sectionCount: number;
    productCount: number;
    collectionCount: number;
    approvedAssetSelectionCount: number;
    boundedProductWindowMaximum: number | null;
  }>;
}>;

export type P10b18cMatrixFailure = Readonly<{
  caseId: string;
  shapeId: string;
  stratumId: string;
  stage: "compile" | "materialize";
  error: string;
}>;

export type P10b18cMatrixRun = Readonly<{
  contractVersion: typeof P10B18C_MATRIX_CONTRACT_VERSION;
  expectedCaseCount: 126;
  shapeIds: readonly string[];
  stratumIds: readonly string[];
  cases: readonly P10b18cMaterializedCase[];
  failures: readonly P10b18cMatrixFailure[];
  elapsedMilliseconds: number;
}>;

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function countBy(values: readonly string[]): Readonly<Record<string, number>> {
  return Object.fromEntries(
    uniqueSorted(values).map((value) => [
      value,
      values.filter((candidate) => candidate === value).length,
    ]),
  );
}

function runtimeAuthority(authority: P10b18aShapeAuthority): RuntimeAuthority {
  return authority.fixtureAuthority === "p10b16p04j-aurum-approved"
    ? "p04-integrated-mock"
    : "p03-standalone";
}

function requireDirection(value: string): P10b18cDirection {
  if (value !== "premiumEditorial" && value !== "modernTechnical" && value !== "warmApproachable") {
    throw new Error(`P10B-18C selected unsupported direction ${value}.`);
  }
  return value;
}

function providerIntentFor(authority: P10b18aShapeAuthority, stratum: P10b18cSemanticStratum) {
  return semanticIntentFixture(authority.request, {
    designConceptSummary: `${authority.id}:${stratum.id}:p10b-18c`,
    ...stratum.drivers,
  });
}

export function compileP10b18cCase(
  authority: P10b18aShapeAuthority,
  stratum: P10b18cSemanticStratum,
): P10b18cCompiledCase {
  const providerIntent = providerIntentFor(authority, stratum);
  const started = performance.now();
  const result = compileSemanticStorefrontDesignIntentV1({
    originalRequest: authority.request,
    providerIntent,
    currentRequestInput: authority.currentRequestInput,
    compatibilityInput: authority.compatibilityInput,
    semanticCapabilityIndex: authority.semanticCapabilityIndex,
    preparedAuthority: authority.preparedAuthority,
  });
  return {
    caseId: `${authority.id}--${stratum.id}`,
    authority,
    stratum,
    providerIntent,
    result,
    compileMilliseconds: performance.now() - started,
  };
}

function auditAggregate(authority: P10b18aShapeAuthority, candidate: StorefrontSnapshot) {
  const project = structuredClone(authority.aggregate.project);
  const draft = storefrontSnapshotSchema.parse({
    ...structuredClone(candidate),
    id: project.draftSnapshotId,
    projectId: project.id,
    catalogueRef: authority.catalogue.id,
    createdBy: "user",
  });
  const published = storefrontSnapshotSchema.parse({
    ...structuredClone(authority.currentRequestInput.draft),
    id: project.publishedSnapshotId,
    projectId: project.id,
    catalogueRef: authority.catalogue.id,
    createdBy: "system",
  });
  return validateProjectAggregate({
    project,
    catalogue: structuredClone(authority.catalogue),
    snapshots: [published, draft],
  });
}

function responsiveTokens(value: unknown, path: readonly string[] = []): readonly string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => responsiveTokens(entry, [...path, String(index)]));
  }
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    const nextPath = [...path, key];
    const normalized = key.toLowerCase();
    if (
      normalized.includes("responsive") ||
      normalized.includes("transformation") ||
      normalized === "breakpoint" ||
      normalized === "viewport"
    ) {
      return [`${nextPath.join(".")}:${canonicalValueString(entry)}`];
    }
    return responsiveTokens(entry, nextPath);
  });
}

function registeredProfile(profileId: string): unknown {
  if (profileId.startsWith("homepage-")) return getCommercialHomepageProfile(profileId);
  if (profileId.startsWith("collection-")) return getCommercialCollectionSearchProfile(profileId);
  if (profileId.startsWith("pdp-")) return getCommercialPdpProfile(profileId);
  if (profileId.startsWith("content-") || profileId.startsWith("landing-campaign-")) {
    return getCommercialContentSupportProfile(profileId);
  }
  if (profileId.startsWith("commerce-utility-")) return getCommercialUtilityProfile(profileId);
  return undefined;
}

function componentSequence(
  result: P10b18aCompiledAuditResult,
  predicate: (
    choice: P10b18aCompiledAuditResult["synthesisDecision"]["componentChoices"][number],
  ) => boolean,
) {
  return result.synthesisDecision.componentChoices.filter(predicate).map((choice) => ({
    pageKey: choice.pageKey,
    slotId: choice.slotId,
    component: choice.component,
    variant: choice.variant,
    anatomyId: choice.anatomyId ?? null,
    transitionIntent: choice.transitionIntent ?? null,
  }));
}

function effectiveContentSupportAnatomy(result: P10b18aCompiledAuditResult) {
  const hasImageLedMedia = result.synthesisDecision.approvedAssetRoleSelections.some(
    ({ profileId, placementPurpose }) =>
      profileId === "landing-campaign-image-led" && placementPurpose === "campaign-primary",
  );
  return result.synthesisDecision.pageProfileSelections
    .filter(
      ({ profileId }) =>
        profileId.startsWith("content-") || profileId.startsWith("landing-campaign-"),
    )
    .map(({ pageKey, familyId, profileId }) => {
      const selectedVariants = componentSequence(
        result,
        (choice) => choice.pageKey === pageKey && choice.component === "contentSupport",
      ).map(({ variant }) => variant);
      const requestedVariant = selectedVariants[0] ?? "unrendered";
      const effectiveVariant =
        profileId === "content-location-appointments"
          ? "locationDirectory"
          : profileId === "content-faq-topic-guide"
            ? "faqDisclosure"
            : profileId === "landing-campaign-image-led" && !hasImageLedMedia
              ? "campaignEditorial"
              : requestedVariant;
      return {
        pageKey,
        familyId,
        profileId,
        requestedVariant,
        effectiveVariant,
        reclassified: effectiveVariant !== requestedVariant,
      };
    });
}

function utilityAnatomy(result: P10b18aCompiledAuditResult) {
  return result.synthesisDecision.pageProfileSelections
    .filter(({ profileId }) => profileId.startsWith("commerce-utility-"))
    .map(({ pageKey, familyId, profileId }) => ({
      pageKey,
      familyId,
      profileId,
      sequence: componentSequence(result, (choice) => choice.pageKey === pageKey),
    }));
}

export function p10b18cNormalizedTopology(
  result: P10b18aCompiledAuditResult,
): Readonly<Record<string, unknown>> {
  const base = p10b18aNormalizedDesignTopology(result);
  const homepagePageKeys = new Set(
    result.synthesisDecision.pageProfileSelections
      .filter(({ familyId }) => familyId === "home")
      .map(({ pageKey }) => pageKey),
  );
  const profileIds = result.synthesisDecision.pageProfileSelections.map(
    ({ profileId }) => profileId,
  );
  const profileResponsiveAuthority = profileIds.flatMap((profileId) =>
    responsiveTokens(registeredProfile(profileId), [profileId]),
  );
  const frameResponsiveAuthority = responsiveTokens(
    getCommercialSharedFrameProfile(result.synthesisDecision.sharedFrame.profileId),
    [result.synthesisDecision.sharedFrame.profileId],
  );
  return {
    ...base,
    orderedPageProfiles: result.synthesisDecision.pageProfileSelections.map(
      ({ pageKey, familyId, profileId, profileVersion }) => ({
        pageKey,
        familyId,
        profileId,
        profileVersion,
      }),
    ),
    orderedHomepageComposition: componentSequence(result, (choice) =>
      homepagePageKeys.has(choice.pageKey),
    ),
    effectiveContentSupportAnatomy: effectiveContentSupportAnatomy(result),
    utilityAnatomy: utilityAnatomy(result),
    canonicalCardAnatomies: uniqueSorted(
      result.synthesisDecision.componentChoices.flatMap(({ anatomyId }) =>
        anatomyId ? [anatomyId] : [],
      ),
    ),
    responsiveAuthority: uniqueSorted([
      ...profileResponsiveAuthority,
      ...frameResponsiveAuthority,
      ...responsiveTokens(result.synthesisDecision.pageBlueprintSelectionOverrides, [
        "selection-overrides",
      ]),
    ]),
  };
}

export function p10b18cDirectionLabelFreeTopology(
  result: P10b18aCompiledAuditResult,
): Readonly<Record<string, unknown>> {
  const topology = p10b18cNormalizedTopology(result);
  const withoutDirection: Record<string, unknown> = { ...topology };
  delete withoutDirection.directionId;
  return {
    ...p10b18aDirectionLabelFreeNormalizedDesignTopology(result),
    ...withoutDirection,
  };
}

function protectedCommerceDetail(authority: P10b18aShapeAuthority): string {
  return canonicalValueFingerprint({
    products: authority.catalogue.products.map((product) => ({
      id: product.id,
      productType: product.productType,
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stockStatus: product.stockStatus,
      options: product.orderOptions,
      variants: product.variants,
    })),
    collections: authority.catalogue.collections.map((collection) => ({
      id: collection.id,
      productIds: collection.productIds,
    })),
  });
}

function protectedMediaDetail(authority: P10b18aShapeAuthority): string {
  return canonicalValueFingerprint(
    authority.catalogue.products.map(({ id, images, variants }) => ({
      id,
      images,
      variants: variants.map(({ id: variantId, attributes }) => ({ variantId, attributes })),
    })),
  );
}

function collectFactDocumentReferences(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(collectFactDocumentReferences);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
    key.toLowerCase().includes("factdocumentid") && typeof entry === "string"
      ? [entry]
      : collectFactDocumentReferences(entry),
  );
}

function completeness(
  compiled: P10b18cCompiledCase,
  snapshot: StorefrontSnapshot,
): P10b18cCompleteness {
  validateCanonicalStorefrontSiteMap(snapshot, {
    catalogue: compiled.authority.catalogue,
    enabledLocales: compiled.authority.aggregate.project.enabledLocales,
  });
  validateCommercialSharedFrameSnapshot(snapshot);
  const dynamicRoutes = snapshot.dynamicCommercePresentation?.routeInventory ?? [];
  const presentPageFamilies = uniqueSorted([
    ...snapshot.pages.flatMap((page) => (page.pageFamily ? [page.pageFamily.familyId] : [])),
    ...dynamicRoutes.map(({ kind }) =>
      kind === "product" ? "product-detail" : kind === "collection" ? "collection" : "search",
    ),
  ]);
  const requiredPageSet = pageFamilyDefinitions
    .filter(({ presenceAuthority }) => presenceAuthority.kind === "required-singleton")
    .map(({ id }) => id)
    .sort();
  const optionalPageSet = snapshot.pages
    .flatMap((page) => (page.pageFamily ? [page.pageFamily.familyId] : []))
    .filter((familyId) => {
      const definition = pageFamilyDefinitions.find(({ id }) => id === familyId);
      return definition?.presenceAuthority.kind === "optional";
    })
    .sort();
  const renderedPageKeys = new Set(
    compiled.result.synthesisDecision.componentChoices.map(({ pageKey }) => pageKey),
  );
  const promisedButUnrenderedPageKeys = compiled.result.synthesisDecision.pageProfileSelections
    .filter(({ pageKey }) => !renderedPageKeys.has(pageKey))
    .map(({ pageKey }) => pageKey)
    .sort();
  const visibleBytes = canonicalValueString({
    pages: snapshot.pages.map(({ title, seo, sections }) => ({ title, seo, sections })),
    facts: snapshot.contentSupportFactDocuments,
  });
  const placeholderMatches = visibleBytes.match(
    /(?:lorem ipsum|\[placeholder\]|\bTODO\b|\bTBD\b|replace me)/giu,
  );
  const approvedAssetAuthority = canonicalValueString(
    compiled.authority.approvedAssetPresentations,
  );
  const missingAssetCount = compiled.result.synthesisDecision.approvedAssetRoleSelections.filter(
    ({ assetId, assetRevision, materialFingerprint }) =>
      !approvedAssetAuthority.includes(assetId) ||
      !approvedAssetAuthority.includes(assetRevision) ||
      !approvedAssetAuthority.includes(materialFingerprint),
  ).length;
  const factDocumentIds = new Set(snapshot.contentSupportFactDocuments.map(({ id }) => id));
  const referencedFactDocumentIds = uniqueSorted(
    snapshot.pages.flatMap(({ sections }) => sections.flatMap(collectFactDocumentReferences)),
  );
  const navigationTargetCount = Object.values(snapshot.navigation).reduce(
    (count, items) => count + items.length,
    0,
  );
  return {
    routeCount: snapshot.pages.length + dynamicRoutes.length,
    pageFamilyCount: presentPageFamilies.length,
    requiredPageSet,
    optionalPageSet,
    presentPageFamilies,
    promisedButUnrenderedCount: promisedButUnrenderedPageKeys.length,
    promisedButUnrenderedPageKeys,
    placeholderCount: placeholderMatches?.length ?? 0,
    missingAssetCount,
    missingFactEvidenceCount: referencedFactDocumentIds.filter((id) => !factDocumentIds.has(id))
      .length,
    localeComplete: compiled.authority.aggregate.project.enabledLocales.every((locale) =>
      snapshot.pages.every(
        ({ title, seo }) =>
          Boolean(title[locale]) &&
          Boolean(seo.title[locale]) &&
          Boolean(seo.metaDescription[locale]),
      ),
    ),
    navigationTargetCount,
  };
}

function maximumBoundedProductWindow(value: unknown): number | null {
  const values: number[] = [];
  const visit = (candidate: unknown, key = "") => {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry) => visit(entry, key));
      return;
    }
    if (candidate === null || typeof candidate !== "object") {
      if (
        typeof candidate === "number" &&
        Number.isFinite(candidate) &&
        /(limit|count|cardinality|window|gallery|related)/iu.test(key)
      ) {
        values.push(candidate);
      }
      return;
    }
    Object.entries(candidate as Record<string, unknown>).forEach(([entryKey, entry]) =>
      visit(entry, entryKey),
    );
  };
  visit(value);
  return values.length > 0 ? Math.max(...values) : null;
}

export function materializeP10b18cCase(compiled: P10b18cCompiledCase): P10b18cMaterializedCase {
  const { authority, stratum, result, providerIntent } = compiled;
  const catalogueBefore = canonicalValueString(authority.catalogue);
  const commerceBefore = authority.commerceFingerprint;
  const mediaBefore = authority.mediaFingerprint;
  const protectedCommerceBefore = protectedCommerceDetail(authority);
  const protectedMediaBefore = protectedMediaDetail(authority);
  const started = performance.now();
  const execution = executeCompiledSemanticStorefrontDesignIntentV1({
    originalRequest: authority.request,
    providerIntent,
    currentRequestInput: authority.currentRequestInput,
    compatibilityInput: authority.compatibilityInput,
    semanticCapabilityIndex: authority.semanticCapabilityIndex,
    preparedAuthority: authority.preparedAuthority,
    compiledDecision: result.compiledDecision,
    synthesisDecision: result.synthesisDecision,
    pageEvidenceAuthority: authority.pageEvidenceAuthority,
    contentFactAuthority: authority.contentFactAuthority,
    approvedAssetPresentations: authority.approvedAssetPresentations,
  });
  if (
    canonicalValueString(authority.catalogue) !== catalogueBefore ||
    authority.commerceFingerprint !== commerceBefore ||
    authority.mediaFingerprint !== mediaBefore ||
    protectedCommerceDetail(authority) !== protectedCommerceBefore ||
    protectedMediaDetail(authority) !== protectedMediaBefore
  ) {
    throw new Error(`${compiled.caseId} mutated protected catalogue or media authority.`);
  }
  const candidate = storefrontSnapshotSchema.parse(execution.synthesis.materialization.snapshot);
  const aggregate = auditAggregate(authority, candidate);
  const snapshot = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId);
  if (!snapshot) throw new Error(`${compiled.caseId} did not materialize the canonical draft.`);
  const directionId = requireDirection(result.compiledDecision.designDna.directionId);
  if (directionId !== stratum.expectedDirection) {
    throw new Error(
      `${compiled.caseId} resolved ${directionId}, expected ${stratum.expectedDirection}.`,
    );
  }
  const collectionRoute = authority.representativeRoutes.collection;
  const productRoute =
    authority.representativeRoutes.highConsiderationProduct ??
    authority.representativeRoutes.configurableProduct ??
    authority.representativeRoutes.simpleProduct;
  if (!collectionRoute || !productRoute) {
    throw new Error(`${compiled.caseId} lacks representative commerce routes.`);
  }
  const collectionResolution = resolveDynamicCommerceRoutePage({
    snapshot,
    catalogue: authority.catalogue,
    route: collectionRoute,
  });
  const productResolution = resolveDynamicCommerceRoutePage({
    snapshot,
    catalogue: authority.catalogue,
    route: productRoute,
  });
  if (
    collectionResolution.route.kind !== "collection" ||
    productResolution.route.kind !== "product"
  ) {
    throw new Error(`${compiled.caseId} representative dynamic routes are stale.`);
  }
  const { collectionId } = collectionResolution.route;
  const { productId } = productResolution.route;
  const collection = authority.catalogue.collections.find(({ id }) => id === collectionId);
  const product = authority.catalogue.products.find(({ id }) => id === productId);
  if (!collection || !product) {
    throw new Error(`${compiled.caseId} representative commerce truth is missing.`);
  }
  const normalizedTopology = p10b18cNormalizedTopology(result);
  const directionLabelFreeTopology = p10b18cDirectionLabelFreeTopology(result);
  const dynamic = result.compiledDecision.dynamicCommerceSelection;
  const selectedRuntimeAuthority = runtimeAuthority(authority);
  const locale = aggregate.project.primaryLocale;
  if (locale !== "en" && locale !== "fi") {
    throw new Error(`${compiled.caseId} selected an unsupported locale.`);
  }
  return {
    compiled,
    snapshot,
    aggregate,
    runtimeAuthority: selectedRuntimeAuthority,
    locale,
    directionId,
    profiles: {
      homepage: result.compiledDecision.profiles.homepage.profileId,
      collection: result.compiledDecision.profiles.collection.profileId,
      search: result.compiledDecision.profiles.search.profileId,
      productDetail: result.compiledDecision.profiles.productDetail.profileId,
    },
    archetypes: {
      collection: dynamic.collectionArchetypeId,
      search: dynamic.searchArchetypeId,
      standardSimple: dynamic.standardSimpleArchetypeId,
      configurable: dynamic.configurableArchetypeId,
      galleryLed: dynamic.galleryLedArchetypeId,
      highConsideration: dynamic.highConsiderationArchetypeId,
      representativeCollection: collectionResolution.archetype.id,
      representativeProduct: productResolution.archetype.id,
    },
    representativeRoutes: {
      home: "/",
      collection: collectionRoute,
      search: "/search",
      productDetail: productRoute,
    },
    representativeContext: {
      collectionId: collection.id,
      collectionProductCount: collection.productIds.length,
      product,
      collectionArchetype: collectionResolution.archetype.id,
      productArchetype: productResolution.archetype.id,
    },
    normalizedTopology,
    directionLabelFreeTopology,
    fingerprints: {
      semanticIntent: providerIntent.semanticIntentFingerprint,
      compiledDecision: result.compiledDecision.compiledDecisionFingerprint,
      compilerStructural: result.compiledDecision.structuralFingerprint,
      consumedAuthority: p10b18aMaterializerDesignAuthorityFingerprint(result),
      normalizedTopology: `p10b18c-topology-${canonicalValueFingerprint(normalizedTopology)}`,
      directionLabelFreeTopology: `p10b18c-direction-free-${canonicalValueFingerprint(
        directionLabelFreeTopology,
      )}`,
      snapshot: canonicalStorefrontContentFingerprint(snapshot),
      catalogue: authority.catalogueFingerprint,
      commerceBefore,
      commerceAfter: authority.commerceFingerprint,
      mediaBefore,
      mediaAfter: authority.mediaFingerprint,
      protectedCommerceDetail: protectedCommerceBefore,
      protectedMediaDetail: protectedMediaBefore,
      approvedAssetPresentation: authority.approvedAssetPresentationFingerprint,
    },
    completeness: completeness(compiled, snapshot),
    materializationMilliseconds: performance.now() - started,
    complexity: {
      staticPageCount: snapshot.pages.length,
      dynamicRouteCount: snapshot.dynamicCommercePresentation?.routeInventory.length ?? 0,
      sectionCount: snapshot.pages.reduce((count, page) => count + page.sections.length, 0),
      productCount: authority.catalogue.products.length,
      collectionCount: authority.catalogue.collections.length,
      approvedAssetSelectionCount: result.synthesisDecision.approvedAssetRoleSelections.length,
      boundedProductWindowMaximum: maximumBoundedProductWindow(
        result.synthesisDecision.boundedParameters,
      ),
    },
  };
}

export function buildP10b18cMatrix(): P10b18cMatrixRun {
  const started = performance.now();
  const authorities = createP10b18cShapeAuthorities();
  const cases: P10b18cMaterializedCase[] = [];
  const failures: P10b18cMatrixFailure[] = [];
  for (const authority of authorities) {
    for (const stratum of p10b18cSemanticStrata) {
      const caseId = `${authority.id}--${stratum.id}`;
      let compiled: P10b18cCompiledCase;
      try {
        compiled = compileP10b18cCase(authority, stratum);
      } catch (error) {
        failures.push({
          caseId,
          shapeId: authority.id,
          stratumId: stratum.id,
          stage: "compile",
          error: errorText(error),
        });
        continue;
      }
      try {
        cases.push(materializeP10b18cCase(compiled));
      } catch (error) {
        failures.push({
          caseId,
          shapeId: authority.id,
          stratumId: stratum.id,
          stage: "materialize",
          error: errorText(error),
        });
      }
    }
  }
  return {
    contractVersion: P10B18C_MATRIX_CONTRACT_VERSION,
    expectedCaseCount: 126,
    shapeIds: authorities.map(({ id }) => id),
    stratumIds: p10b18cSemanticStrata.map(({ id }) => id),
    cases,
    failures,
    elapsedMilliseconds: performance.now() - started,
  };
}

export function replayP10b18cCase(store: P10b18cMaterializedCase) {
  const replay = materializeP10b18cCase(
    compileP10b18cCase(store.compiled.authority, store.compiled.stratum),
  );
  return {
    caseId: store.compiled.caseId,
    selectedAuthorityStable:
      replay.fingerprints.compiledDecision === store.fingerprints.compiledDecision &&
      replay.fingerprints.consumedAuthority === store.fingerprints.consumedAuthority,
    topologyStable:
      replay.fingerprints.normalizedTopology === store.fingerprints.normalizedTopology,
    snapshotStable: replay.fingerprints.snapshot === store.fingerprints.snapshot,
    commerceStable:
      replay.fingerprints.protectedCommerceDetail === store.fingerprints.protectedCommerceDetail &&
      replay.fingerprints.commerceAfter === store.fingerprints.commerceAfter,
    mediaStable:
      replay.fingerprints.protectedMediaDetail === store.fingerprints.protectedMediaDetail &&
      replay.fingerprints.mediaAfter === store.fingerprints.mediaAfter,
    replay,
  };
}

export function p10b18cClusterMetrics(cases: readonly P10b18cMaterializedCase[]) {
  const topologyCounts = countBy(cases.map(({ fingerprints }) => fingerprints.normalizedTopology));
  const clusterSizes = Object.values(topologyCounts).sort((left, right) => right - left);
  return {
    caseCount: cases.length,
    distinctNormalizedTopologies: Object.keys(topologyCounts).length,
    repeatedClusterMembership: clusterSizes
      .filter((size) => size > 1)
      .reduce((sum, size) => sum + size, 0),
    largestCluster: clusterSizes[0] ?? 0,
    singletons: clusterSizes.filter((size) => size === 1).length,
    topologyCounts,
    directionCounts: countBy(cases.map(({ directionId }) => directionId)),
    frameCounts: countBy(
      cases.map(({ compiled }) => compiled.result.synthesisDecision.sharedFrame.profileId),
    ),
    designDnaCounts: countBy(
      cases.map(({ compiled }) =>
        canonicalValueFingerprint(
          p10b18aMaterializerConsumedDesignAuthority(compiled.result).designDnaCategories,
        ),
      ),
    ),
    homepageProfileCounts: countBy(cases.map(({ profiles }) => profiles.homepage)),
    collectionProfileCounts: countBy(cases.map(({ profiles }) => profiles.collection)),
    searchProfileCounts: countBy(cases.map(({ profiles }) => profiles.search)),
    pdpProfileCounts: countBy(cases.map(({ profiles }) => profiles.productDetail)),
  };
}

function flattenTopology(value: unknown, path = "root"): readonly string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenTopology(entry, `${path}[${index}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
      flattenTopology(entry, `${path}.${key}`),
    );
  }
  return [`${path}=${String(value)}`];
}

function topologyDistance(left: P10b18cMaterializedCase, right: P10b18cMaterializedCase): number {
  const leftTokens = new Set(flattenTopology(left.directionLabelFreeTopology));
  const rightTokens = new Set(flattenTopology(right.directionLabelFreeTopology));
  return (
    [...leftTokens].filter((token) => !rightTokens.has(token)).length +
    [...rightTokens].filter((token) => !leftTokens.has(token)).length
  );
}

export function p10b18cDuplicateAnalysis(cases: readonly P10b18cMaterializedCase[]) {
  const clusters = Object.entries(
    cases.reduce<Record<string, string[]>>((result, store) => {
      (result[store.fingerprints.normalizedTopology] ??= []).push(store.compiled.caseId);
      return result;
    }, {}),
  )
    .map(([fingerprint, caseIds]) => ({ fingerprint, caseIds: caseIds.sort() }))
    .sort(
      (left, right) =>
        right.caseIds.length - left.caseIds.length ||
        left.fingerprint.localeCompare(right.fingerprint),
    );
  const nearDuplicates: Array<{
    leftCaseId: string;
    rightCaseId: string;
    directionId: P10b18cDirection;
    distance: number;
    sameMainProfiles: boolean;
  }> = [];
  for (let leftIndex = 0; leftIndex < cases.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < cases.length; rightIndex += 1) {
      const left = cases[leftIndex];
      const right = cases[rightIndex];
      if (left.directionId !== right.directionId) continue;
      if (left.fingerprints.normalizedTopology === right.fingerprints.normalizedTopology) continue;
      const sameMainProfiles =
        canonicalValueString(left.profiles) === canonicalValueString(right.profiles);
      const distance = topologyDistance(left, right);
      if (sameMainProfiles || distance <= 6) {
        nearDuplicates.push({
          leftCaseId: left.compiled.caseId,
          rightCaseId: right.compiled.caseId,
          directionId: left.directionId,
          distance,
          sameMainProfiles,
        });
      }
    }
  }
  nearDuplicates.sort(
    (left, right) =>
      left.distance - right.distance ||
      `${left.leftCaseId}:${left.rightCaseId}`.localeCompare(
        `${right.leftCaseId}:${right.rightCaseId}`,
      ),
  );
  return {
    exactMaterialDuplicateClusters: clusters.filter(({ caseIds }) => caseIds.length > 1),
    strongNearDuplicateWitnesses: nearDuplicates.slice(0, 36),
    clustersOverTenPercent: clusters
      .filter(({ caseIds }) => caseIds.length > cases.length * 0.1)
      .map((cluster) => {
        const members = cases.filter(({ compiled }) => cluster.caseIds.includes(compiled.caseId));
        return {
          ...cluster,
          shapeIds: uniqueSorted(members.map(({ compiled }) => compiled.authority.id)),
          stratumIds: uniqueSorted(members.map(({ compiled }) => compiled.stratum.id)),
          explanation:
            uniqueSorted(members.map(({ compiled }) => compiled.stratum.id)).length > 1
              ? "Multiple requested semantic strata resolved to this same bounded registered compatibility outcome; semantic causality witnesses determine whether that is truthful compound substitution or an advertised collapse."
              : "One semantic stratum remains design-invariant across multiple catalogue/evidence shapes because those shapes do not alter the registered material authority consumed by this outcome.",
        };
      }),
  };
}

const semanticOwnership: Readonly<
  Record<
    P10b18cSemanticDriverName,
    Readonly<{
      authority: string;
      scope: (store: P10b18cMaterializedCase) => unknown;
    }>
  >
> = {
  commercialPosture: {
    authority: "direction package plus exact non-colour Design DNA",
    scope: (store) => ({
      directionId: store.directionId,
      designDna: p10b18aMaterializerConsumedDesignAuthority(store.compiled.result)
        .designDnaCategories,
    }),
  },
  density: {
    authority: "exact Design DNA spacing/density plus bounded layout parameters",
    scope: (store) => ({
      designDna: p10b18aMaterializerConsumedDesignAuthority(store.compiled.result)
        .designDnaCategories,
      bounded: store.compiled.result.synthesisDecision.boundedParameters,
    }),
  },
  navigationPosture: {
    authority: "registered shared-frame profile",
    scope: (store) => store.compiled.result.synthesisDecision.sharedFrame.profileId,
  },
  storyCatalogueBalance: {
    authority: "homepage profile and ordered homepage composition",
    scope: (store) => ({
      profile: store.profiles.homepage,
      ordered: store.normalizedTopology.orderedHomepageComposition,
    }),
  },
  discoveryPosture: {
    authority: "collection/search profile, archetype and card anatomy",
    scope: (store) => ({
      collection: store.profiles.collection,
      search: store.profiles.search,
      collectionArchetype: store.archetypes.collection,
      searchArchetype: store.archetypes.search,
      cards: store.normalizedTopology.canonicalCardAnatomies,
    }),
  },
  configurableProductPosture: {
    authority: "PDP profile and dynamic product archetype mappings",
    scope: (store) => ({
      profile: store.profiles.productDetail,
      archetypes: store.archetypes,
    }),
  },
  mobileHierarchy: {
    authority: "registered frame/profile responsive authority and bounded parameters",
    scope: (store) => ({
      responsive: store.normalizedTopology.responsiveAuthority,
      bounded: store.compiled.result.synthesisDecision.boundedParameters,
    }),
  },
  imageProminence: {
    authority: "Design DNA media posture plus approved asset placement/art-direction authority",
    scope: (store) => ({
      media: p10b18aMaterializerConsumedDesignAuthority(store.compiled.result).designDnaCategories
        .media,
      placements: store.normalizedTopology.approvedAssetPlacementModes,
      homepage: store.normalizedTopology.orderedHomepageComposition,
    }),
  },
};

function driverDistance(left: P10b18cSemanticDrivers, right: P10b18cSemanticDrivers): number {
  return p10b18cSemanticDriverNames.filter((name) => left[name] !== right[name]).length;
}

export function p10b18cSemanticCausality(cases: readonly P10b18cMaterializedCase[]) {
  return p10b18cSemanticDriverNames.map((control) => {
    const candidates: Array<{
      left: P10b18cMaterializedCase;
      right: P10b18cMaterializedCase;
      driverDistance: number;
      materialDelta: boolean;
    }> = [];
    for (let leftIndex = 0; leftIndex < cases.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < cases.length; rightIndex += 1) {
        const left = cases[leftIndex];
        const right = cases[rightIndex];
        if (left.compiled.authority.id !== right.compiled.authority.id) continue;
        if (left.compiled.stratum.drivers[control] === right.compiled.stratum.drivers[control]) {
          continue;
        }
        const distance = driverDistance(
          left.compiled.stratum.drivers,
          right.compiled.stratum.drivers,
        );
        const materialDelta =
          canonicalValueFingerprint(semanticOwnership[control].scope(left)) !==
          canonicalValueFingerprint(semanticOwnership[control].scope(right));
        candidates.push({ left, right, driverDistance: distance, materialDelta });
      }
    }
    candidates.sort(
      (left, right) =>
        Number(right.materialDelta) - Number(left.materialDelta) ||
        left.driverDistance - right.driverDistance ||
        `${left.left.compiled.caseId}:${left.right.compiled.caseId}`.localeCompare(
          `${right.left.compiled.caseId}:${right.right.compiled.caseId}`,
        ),
    );
    const witness = candidates[0];
    const direct = witness?.materialDelta && witness.driverDistance === 1;
    const acceptedPaths = witness
      ? uniqueSorted([
          ...(witness.left.compiled.result.compiledDecision.semanticResolution
            ?.acceptedSemanticPaths ?? []),
          ...(witness.right.compiled.result.compiledDecision.semanticResolution
            ?.acceptedSemanticPaths ?? []),
        ])
      : [];
    const substitutedPaths = witness
      ? uniqueSorted([
          ...(witness.left.compiled.result.compiledDecision.semanticResolution
            ?.substitutedSemanticPaths ?? []),
          ...(witness.right.compiled.result.compiledDecision.semanticResolution
            ?.substitutedSemanticPaths ?? []),
        ])
      : [];
    return {
      semanticControl: control,
      classification: witness?.materialDelta
        ? direct
          ? "material-direct"
          : "material-compound"
        : substitutedPaths.some((path) => path.includes(control))
          ? "substitution-only"
          : "unavailable",
      exactOwningAuthority: semanticOwnership[control].authority,
      aCase: witness?.left.compiled.caseId ?? null,
      bCase: witness?.right.compiled.caseId ?? null,
      changedDriverCount: witness?.driverDistance ?? null,
      requestedA: witness?.left.compiled.stratum.drivers[control] ?? null,
      requestedB: witness?.right.compiled.stratum.drivers[control] ?? null,
      materialDelta: witness?.materialDelta ?? false,
      topologyDelta:
        witness !== undefined &&
        witness.left.fingerprints.normalizedTopology !==
          witness.right.fingerprints.normalizedTopology,
      renderDelta: "browser-manifest-pending",
      acceptedSemanticPaths: acceptedPaths,
      substitutedSemanticPaths: substitutedPaths,
      verdict: witness?.materialDelta
        ? direct
          ? "The smallest matrix witness changes only this semantic field and changes its consumed authority."
          : "The current schema exposes this as compound material authority; the smallest matrix witness changes the recorded fields together."
        : "No independent consumed material delta is claimed; current resolution is substitution-only or unavailable.",
    };
  });
}

function shapeTraits(store: P10b18cMaterializedCase): readonly string[] {
  const shapeId = store.compiled.authority.id;
  const traits = [
    store.compiled.authority.approvedAssetPresentations.length > 0 ? "asset-rich" : "asset-poor",
    store.compiled.authority.approvedEvidenceFingerprint ? "evidence-rich" : "evidence-poor",
    store.complexity.productCount <= 3
      ? "catalogue-micro"
      : store.complexity.productCount <= 8
        ? "catalogue-small"
        : store.complexity.productCount <= 20
          ? "catalogue-medium"
          : "catalogue-dense",
  ];
  if (shapeId.includes("simple-product-heavy")) traits.push("simple-product-heavy");
  if (shapeId.includes("configurable-product-heavy")) traits.push("configurable-product-heavy");
  if (shapeId.includes("high-consideration")) traits.push("high-consideration");
  if (shapeId.includes("image-evidence-poor")) traits.push("image-evidence-poor");
  if (shapeId.includes("low-res")) traits.push("low-resolution-canonical-media");
  return traits;
}

export function p10b18cCoverageFeatures(store: P10b18cMaterializedCase): readonly string[] {
  const content =
    (store.normalizedTopology.effectiveContentSupportAnatomy as readonly {
      effectiveVariant: string;
    }[]) ?? [];
  const utility =
    (store.normalizedTopology.utilityAnatomy as readonly { profileId: string }[]) ?? [];
  const cards = (store.normalizedTopology.canonicalCardAnatomies as readonly string[]) ?? [];
  return uniqueSorted([
    `direction:${store.directionId}`,
    `dna:${canonicalValueFingerprint(
      p10b18aMaterializerConsumedDesignAuthority(store.compiled.result).designDnaCategories,
    )}`,
    `frame:${store.compiled.result.synthesisDecision.sharedFrame.profileId}`,
    `home:${store.profiles.homepage}`,
    `collection:${store.profiles.collection}`,
    `search:${store.profiles.search}`,
    `pdp:${store.profiles.productDetail}`,
    ...cards.map((value) => `card:${value}`),
    ...content.map(({ effectiveVariant }) => `content:${effectiveVariant}`),
    ...utility.map(({ profileId }) => `utility:${profileId}`),
    ...shapeTraits(store).map((value) => `trait:${value}`),
    `locale:${store.locale}`,
    ...(store.directionId === "premiumEditorial" && shapeTraits(store).includes("asset-rich")
      ? ["review-witness:premium-rich"]
      : []),
    ...(store.directionId === "premiumEditorial" &&
    shapeTraits(store).includes("image-evidence-poor")
      ? ["review-witness:premium-sparse"]
      : []),
    ...(store.compiled.stratum.id === "modern-comparison"
      ? ["review-witness:modern-comparison"]
      : []),
    ...(store.directionId === "modernTechnical" &&
    shapeTraits(store).includes("configurable-product-heavy")
      ? ["review-witness:modern-configurable"]
      : []),
    ...(store.compiled.stratum.id === "minimal-product-first"
      ? ["review-witness:minimal-product-first"]
      : []),
    ...(store.compiled.stratum.id === "minimal-story-airy"
      ? ["review-witness:minimal-story-airy"]
      : []),
  ]);
}

export type P10b18cSelectedStore = Readonly<{
  store: P10b18cMaterializedCase;
  reasons: readonly string[];
}>;

export type P10b18cTabletWitnessSlot =
  | "premium-rich"
  | "premium-sparse"
  | "modern-comparison"
  | "modern-configurable"
  | "minimal-product-first"
  | "minimal-story-airy";

export type P10b18cSelectorFailureCode =
  | "uncovered-material-authority"
  | "missing-distinct-tablet-witness"
  | "incorrect-human-store-count"
  | "incorrect-search-store-count";

export type P10b18cSelectorFailureEvidence = Readonly<{
  code: P10b18cSelectorFailureCode;
  stage: "human-store-selection" | "search-selection" | "tablet-selection";
  message: string;
  slot: P10b18cTabletWitnessSlot | null;
  candidateCaseIds: readonly string[];
}>;

export class P10b18cSelectorError extends Error {
  constructor(readonly evidence: P10b18cSelectorFailureEvidence) {
    super(evidence.message);
    this.name = "P10b18cSelectorError";
  }
}

export const p10b18cOriginalSelectorFailureEvidence = {
  runId: "first-run-20260820",
  observedAt: "2026-08-20",
  code: "missing-distinct-tablet-witness",
  stage: "tablet-selection",
  message: "P10B-18C selected no modern-configurable tablet witness.",
  cause:
    "The first test-only selector allowed one overlapping Modern comparison/configurable store to satisfy general coverage, then had no distinct retained case for the explicitly separate configurable tablet slot.",
  disposition:
    "Preserved first-run selector-infrastructure failure; no production or 126-case authority change.",
} as const;

function sortedCases(cases: readonly P10b18cMaterializedCase[]) {
  return [...cases].sort((left, right) =>
    left.compiled.caseId.localeCompare(right.compiled.caseId),
  );
}

function preferredCase(
  cases: readonly P10b18cMaterializedCase[],
  predicate: (store: P10b18cMaterializedCase) => boolean,
) {
  return sortedCases(cases.filter(predicate))[0];
}

const tabletWitnessDefinitions: readonly Readonly<{
  slot: P10b18cTabletWitnessSlot;
  predicate: (store: P10b18cMaterializedCase) => boolean;
}>[] = [
  {
    slot: "premium-rich",
    predicate: (store) =>
      store.directionId === "premiumEditorial" && shapeTraits(store).includes("asset-rich"),
  },
  {
    slot: "premium-sparse",
    predicate: (store) =>
      store.directionId === "premiumEditorial" &&
      shapeTraits(store).includes("image-evidence-poor"),
  },
  {
    slot: "modern-comparison",
    predicate: (store) => store.compiled.stratum.id === "modern-comparison",
  },
  {
    slot: "modern-configurable",
    predicate: (store) =>
      store.directionId === "modernTechnical" &&
      shapeTraits(store).includes("configurable-product-heavy"),
  },
  {
    slot: "minimal-product-first",
    predicate: (store) => store.compiled.stratum.id === "minimal-product-first",
  },
  {
    slot: "minimal-story-airy",
    predicate: (store) => store.compiled.stratum.id === "minimal-story-airy",
  },
] as const;

function assignDistinctTabletWitnesses(cases: readonly P10b18cMaterializedCase[]) {
  const candidatesBySlot = tabletWitnessDefinitions.map(({ slot, predicate }) => ({
    slot,
    candidates: sortedCases(cases.filter(predicate)),
  }));
  const assign = (
    index: number,
    usedCaseIds: ReadonlySet<string>,
    assignments: readonly Readonly<{
      slot: P10b18cTabletWitnessSlot;
      store: P10b18cMaterializedCase;
    }>[],
  ):
    | readonly Readonly<{
        slot: P10b18cTabletWitnessSlot;
        store: P10b18cMaterializedCase;
      }>[]
    | null => {
    const definition = candidatesBySlot[index];
    if (!definition) return assignments;
    for (const store of definition.candidates) {
      if (usedCaseIds.has(store.compiled.caseId)) continue;
      const next = assign(index + 1, new Set([...usedCaseIds, store.compiled.caseId]), [
        ...assignments,
        { slot: definition.slot, store },
      ]);
      if (next) return next;
    }
    return null;
  };
  const assignments = assign(0, new Set(), []);
  if (assignments) return assignments;
  const failed =
    candidatesBySlot.find(({ candidates }) => candidates.length === 0) ??
    candidatesBySlot.find(({ candidates }) => candidates.length === 1) ??
    candidatesBySlot[0];
  throw new P10b18cSelectorError({
    code: "missing-distinct-tablet-witness",
    stage: "tablet-selection",
    message: `P10B-18C cannot assign six distinct tablet witnesses; ${failed.slot} has no candidate compatible with the remaining distinct slots.`,
    slot: failed.slot,
    candidateCaseIds: failed.candidates.map(({ compiled }) => compiled.caseId),
  });
}

export function selectP10b18cHumanStores(
  cases: readonly P10b18cMaterializedCase[],
): readonly P10b18cSelectedStore[] {
  if (cases.length !== 126) throw new Error("P10B-18C selector requires all 126 cases.");
  const reasons = new Map<string, Set<string>>();
  const selected = new Map<string, P10b18cMaterializedCase>();
  const add = (store: P10b18cMaterializedCase | undefined, reason: string) => {
    if (!store || selected.size >= 28) return;
    selected.set(store.compiled.caseId, store);
    const entries = reasons.get(store.compiled.caseId) ?? new Set<string>();
    entries.add(reason);
    reasons.set(store.compiled.caseId, entries);
  };
  const allFeatures = new Set(cases.flatMap(p10b18cCoverageFeatures));
  const uncovered = new Set(allFeatures);
  while (uncovered.size > 0 && selected.size < 28) {
    const candidate = sortedCases(cases.filter(({ compiled }) => !selected.has(compiled.caseId)))
      .map((store) => ({
        store,
        uncovered: p10b18cCoverageFeatures(store).filter((feature) => uncovered.has(feature)),
      }))
      .sort(
        (left, right) =>
          right.uncovered.length - left.uncovered.length ||
          left.store.compiled.caseId.localeCompare(right.store.compiled.caseId),
      )[0];
    if (!candidate || candidate.uncovered.length === 0) break;
    add(candidate.store, `set-cover:${candidate.uncovered.join(",")}`);
    candidate.uncovered.forEach((feature) => uncovered.delete(feature));
  }
  if (uncovered.size > 0) {
    throw new P10b18cSelectorError({
      code: "uncovered-material-authority",
      stage: "human-store-selection",
      message: `P10B-18C 28-store selector left uncovered authority: ${[...uncovered].join(", ")}`,
      slot: null,
      candidateCaseIds: [],
    });
  }

  for (const { slot, store } of assignDistinctTabletWitnesses(cases)) {
    add(store, `tablet-distinct-witness:${slot}`);
  }

  const causality = p10b18cSemanticCausality(cases);
  for (const witness of causality) {
    add(
      cases.find(({ compiled }) => compiled.caseId === witness.aCase),
      `semantic-causality:${witness.semanticControl}:a`,
    );
    add(
      cases.find(({ compiled }) => compiled.caseId === witness.bCase),
      `semantic-causality:${witness.semanticControl}:b`,
    );
  }
  const missingCausalityCases = uniqueSorted(
    causality.flatMap(({ aCase, bCase }) =>
      [aCase, bCase].filter((value): value is string => Boolean(value)),
    ),
  ).filter((caseId) => !selected.has(caseId));
  if (missingCausalityCases.length > 0) {
    throw new Error(
      `P10B-18C selector could not retain semantic witnesses: ${missingCausalityCases.join(", ")}`,
    );
  }

  const clusters = Object.values(
    cases.reduce<Record<string, P10b18cMaterializedCase[]>>((result, store) => {
      (result[store.fingerprints.normalizedTopology] ??= []).push(store);
      return result;
    }, {}),
  ).sort(
    (left, right) =>
      right.length - left.length ||
      left[0].fingerprints.normalizedTopology.localeCompare(
        right[0].fingerprints.normalizedTopology,
      ),
  );
  clusters
    .slice(0, 6)
    .forEach((cluster) =>
      add(
        sortedCases(cluster)[Math.floor((cluster.length - 1) / 2)],
        `cluster-medoid:${cluster.length}`,
      ),
    );

  for (const direction of ["premiumEditorial", "modernTechnical", "warmApproachable"] as const) {
    const directionCases = sortedCases(
      cases.filter(({ directionId }) => directionId === direction),
    );
    const first = directionCases[0];
    const alternative = directionCases.find(
      ({ fingerprints }) =>
        fingerprints.normalizedTopology !== first?.fingerprints.normalizedTopology,
    );
    add(first, `same-direction-alternative:${direction}:a`);
    add(alternative, `same-direction-alternative:${direction}:b`);
  }

  const nearDuplicates = p10b18cDuplicateAnalysis(cases).strongNearDuplicateWitnesses;
  for (const direction of ["premiumEditorial", "modernTechnical", "warmApproachable"] as const) {
    const witness = nearDuplicates.find((candidate) => candidate.directionId === direction);
    add(
      cases.find(({ compiled }) => compiled.caseId === witness?.leftCaseId),
      `near-duplicate:${direction}:a`,
    );
    add(
      cases.find(({ compiled }) => compiled.caseId === witness?.rightCaseId),
      `near-duplicate:${direction}:b`,
    );
  }

  const byComplexity = [...cases].sort(
    (left, right) =>
      left.complexity.sectionCount - right.complexity.sectionCount ||
      left.compiled.caseId.localeCompare(right.compiled.caseId),
  );
  add(byComplexity[0], "geometry-performance-outlier:sparsest");
  add(byComplexity.at(-1), "geometry-performance-outlier:richest");
  add(
    preferredCase(cases, (store) => shapeTraits(store).includes("asset-rich")),
    "richest-evidence-condition",
  );
  add(
    preferredCase(
      cases,
      (store) =>
        shapeTraits(store).includes("asset-poor") && shapeTraits(store).includes("evidence-poor"),
    ),
    "sparsest-evidence-condition",
  );

  for (const store of sortedCases(cases)) {
    if (selected.size >= 28) break;
    add(store, "stable-case-id-fill");
  }
  if (selected.size !== 28) {
    throw new P10b18cSelectorError({
      code: "incorrect-human-store-count",
      stage: "human-store-selection",
      message: `P10B-18C selected ${selected.size}, expected 28.`,
      slot: null,
      candidateCaseIds: [...selected.keys()].sort(),
    });
  }
  return sortedCases([...selected.values()]).map((store) => ({
    store,
    reasons: [...(reasons.get(store.compiled.caseId) ?? [])].sort(),
  }));
}

export function selectP10b18cSearchStores(
  selected: readonly P10b18cSelectedStore[],
): readonly P10b18cSelectedStore[] {
  const candidates = selected.filter(({ store }) => store.complexity.productCount > 1);
  const chosen = new Map<string, P10b18cSelectedStore>();
  const featureSet = new Set<string>();
  for (const candidate of sortedCases(candidates.map(({ store }) => store))) {
    const entry = selected.find(
      ({ store }) => store.compiled.caseId === candidate.compiled.caseId,
    )!;
    const features = [
      `direction:${candidate.directionId}`,
      `search:${candidate.profiles.search}`,
      `shape:${candidate.compiled.authority.id}`,
    ];
    if (features.some((feature) => !featureSet.has(feature))) {
      chosen.set(candidate.compiled.caseId, entry);
      features.forEach((feature) => featureSet.add(feature));
    }
    if (chosen.size === 14) break;
  }
  for (const entry of selected) {
    if (chosen.size === 14) break;
    if (entry.store.complexity.productCount > 1) chosen.set(entry.store.compiled.caseId, entry);
  }
  if (chosen.size !== 14) {
    throw new P10b18cSelectorError({
      code: "incorrect-search-store-count",
      stage: "search-selection",
      message: `P10B-18C selected ${chosen.size} search stores, expected 14.`,
      slot: null,
      candidateCaseIds: [...chosen.keys()].sort(),
    });
  }
  return [...chosen.values()].sort((left, right) =>
    left.store.compiled.caseId.localeCompare(right.store.compiled.caseId),
  );
}

export function selectP10b18cContentUtilityStores(
  selected: readonly P10b18cSelectedStore[],
): readonly P10b18cSelectedStore[] {
  const chosen = new Map<string, P10b18cSelectedStore>();
  for (const direction of ["premiumEditorial", "modernTechnical", "warmApproachable"] as const) {
    selected
      .filter(({ store }) => store.directionId === direction)
      .slice(0, 2)
      .forEach((entry) => chosen.set(entry.store.compiled.caseId, entry));
  }
  for (const entry of selected) {
    if (chosen.size === 12) break;
    chosen.set(entry.store.compiled.caseId, entry);
  }
  return [...chosen.values()]
    .sort((left, right) => left.store.compiled.caseId.localeCompare(right.store.compiled.caseId))
    .slice(0, 12);
}

export function selectP10b18cTabletStores(
  selected: readonly P10b18cSelectedStore[],
): readonly P10b18cSelectedStore[] {
  return assignDistinctTabletWitnesses(selected.map(({ store }) => store)).map(({ store }) =>
    selected.find(({ store: candidate }) => candidate.compiled.caseId === store.compiled.caseId)!,
  );
}

export function evaluateP10b18cSelectors(cases: readonly P10b18cMaterializedCase[]) {
  try {
    const selected = selectP10b18cHumanStores(cases);
    return {
      ok: true as const,
      selected,
      search: selectP10b18cSearchStores(selected),
      contentUtility: selectP10b18cContentUtilityStores(selected),
      tablet: selectP10b18cTabletStores(selected),
      failures: [] as readonly P10b18cSelectorFailureEvidence[],
    };
  } catch (error) {
    const failure =
      error instanceof P10b18cSelectorError
        ? error.evidence
        : {
            code: "incorrect-human-store-count" as const,
            stage: "human-store-selection" as const,
            message: errorText(error),
            slot: null,
            candidateCaseIds: [],
          };
    return {
      ok: false as const,
      selected: [] as readonly P10b18cSelectedStore[],
      search: [] as readonly P10b18cSelectedStore[],
      contentUtility: [] as readonly P10b18cSelectedStore[],
      tablet: [] as readonly P10b18cSelectedStore[],
      failures: [failure],
    };
  }
}

export function p10b18cSerializableCase(store: P10b18cMaterializedCase) {
  return {
    caseId: store.compiled.caseId,
    shapeId: store.compiled.authority.id,
    fixtureAuthority: store.compiled.authority.fixtureAuthority,
    fixtureKind: store.compiled.authority.fixtureKind,
    stratumId: store.compiled.stratum.id,
    group: store.compiled.stratum.group,
    semanticInput: store.compiled.stratum.drivers,
    semanticMappingNote: store.compiled.stratum.mappingNote,
    directionId: store.directionId,
    designDna: p10b18aMaterializerConsumedDesignAuthority(store.compiled.result)
      .designDnaCategories,
    frame: store.compiled.result.synthesisDecision.sharedFrame.profileId,
    profiles: store.profiles,
    archetypes: store.archetypes,
    componentVariants: store.compiled.result.synthesisDecision.componentChoices.map(
      ({ pageKey, slotId, component, variant, anatomyId }) => ({
        pageKey,
        slotId,
        component,
        variant,
        anatomyId: anatomyId ?? null,
      }),
    ),
    responsiveAuthority: store.normalizedTopology.responsiveAuthority,
    approvedAssetRoleSelections:
      store.compiled.result.synthesisDecision.approvedAssetRoleSelections,
    fingerprints: store.fingerprints,
    completeness: store.completeness,
    complexity: store.complexity,
    compileMilliseconds: store.compiled.compileMilliseconds,
    materializationMilliseconds: store.materializationMilliseconds,
  };
}
