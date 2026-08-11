import { containsExecutableContent } from "@/application/design-safety/executable-content";
import { containsProtectedStorefrontClaimContent } from "@/application/design-safety/protected-storefront-content";
import { canonicalValueString } from "@/domain/storefront";
import {
  PROMPTED_STOREFRONT_DESIGN_REQUEST_V2,
  PromptedStorefrontDesignIntentError,
  normalizePromptedStorefrontDesignIntentV2,
  promptedStorefrontCapabilityAuthorityReferenceSchema,
  promptedStorefrontCapabilityReferenceAuthorityFingerprint,
  promptedStorefrontCurrentAuthorityIdentitySchema,
  promptedStorefrontDesignIntentFingerprint,
  promptedStorefrontDesignIntentV2MaterialSchema,
  promptedStorefrontDesignRequestV2MaterialSchema,
  promptedStorefrontDesignRequestV2Schema,
  promptedStorefrontPromptFingerprint,
  promptedStorefrontDesignRequestFingerprint,
  type PromptedStorefrontCapabilityAuthority,
  type PromptedStorefrontCapabilityAuthorityReference,
  type PromptedStorefrontCapabilityDimension,
  type PromptedStorefrontCapabilityIntentRole,
  type PromptedStorefrontCurrentAuthorityIdentity,
  type PromptedStorefrontDesignIntentV2,
  type PromptedStorefrontDesignRequestV2,
  type PromptedStorefrontPreferenceSemantics,
} from "./contract";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePromptedStorefrontDesignRequestV2(
  input: unknown,
): PromptedStorefrontDesignRequestV2 {
  if (!isRecord(input) || input.contractVersion !== PROMPTED_STOREFRONT_DESIGN_REQUEST_V2) {
    throw new PromptedStorefrontDesignIntentError("unsupported-contract-version");
  }
  if (
    typeof input.merchantPrompt === "string" &&
    input.promptFingerprint !== promptedStorefrontPromptFingerprint(input.merchantPrompt)
  ) {
    throw new PromptedStorefrontDesignIntentError("prompt-fingerprint-mismatch");
  }
  const material = { ...input };
  delete material.requestFingerprint;
  const parsedMaterial = promptedStorefrontDesignRequestV2MaterialSchema.safeParse(material);
  if (
    parsedMaterial.success &&
    typeof input.requestFingerprint === "string" &&
    input.requestFingerprint !== promptedStorefrontDesignRequestFingerprint(parsedMaterial.data)
  ) {
    throw new PromptedStorefrontDesignIntentError("request-fingerprint-mismatch");
  }
  const parsed = promptedStorefrontDesignRequestV2Schema.safeParse(input);
  if (!parsed.success) throw new PromptedStorefrontDesignIntentError("invalid-request");
  return parsed.data;
}

export function assertPromptedStorefrontCapabilityAuthority(
  request: PromptedStorefrontDesignRequestV2,
  authority: PromptedStorefrontCapabilityAuthority,
): void {
  let referenceFingerprint: string;
  try {
    const references = [...authority.referencesByPreferenceKey.values()].map((reference) =>
      promptedStorefrontCapabilityAuthorityReferenceSchema.parse(reference),
    );
    referenceFingerprint = promptedStorefrontCapabilityReferenceAuthorityFingerprint(references);
  } catch {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  if (
    authority.projection.fingerprint !== request.capabilityProjection.fingerprint ||
    referenceFingerprint !== request.currentAuthority.capabilityReferenceAuthorityFingerprint ||
    canonicalValueString(authority.projection) !==
      canonicalValueString(request.capabilityProjection)
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  const requestKeys = new Set(request.capabilityProjection.capabilities.map(({ key }) => key));
  if (
    requestKeys.size !== authority.referencesByPreferenceKey.size ||
    [...authority.referencesByPreferenceKey.keys()].some((key) => !requestKeys.has(key))
  ) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
  for (const capability of request.capabilityProjection.capabilities) {
    const reference = authority.referencesByPreferenceKey.get(capability.key);
    if (
      !reference ||
      reference.key !== capability.key ||
      reference.dimension !== capability.dimension ||
      reference.availability !== capability.availability ||
      canonicalValueString(reference.selection) !== canonicalValueString(capability.selection)
    ) {
      throw new PromptedStorefrontDesignIntentError("stale-authority");
    }
  }
}

export function assertPromptedStorefrontCurrentAuthority(
  expected: PromptedStorefrontCurrentAuthorityIdentity,
  currentInput: unknown,
): void {
  const current = promptedStorefrontCurrentAuthorityIdentitySchema.safeParse(currentInput);
  if (!current.success || canonicalValueString(expected) !== canonicalValueString(current.data)) {
    throw new PromptedStorefrontDesignIntentError("stale-authority");
  }
}

type LocatedReference = Readonly<{
  key: string;
  dimension: string;
  semantics?: PromptedStorefrontPreferenceSemantics;
  value?: string | number;
  path: readonly (string | number)[];
}>;

function collectReferences(
  value: unknown,
  path: readonly (string | number)[] = [],
  collected: LocatedReference[] = [],
): LocatedReference[] {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectReferences(entry, [...path, index], collected));
    return collected;
  }
  if (!isRecord(value)) return collected;
  if (typeof value.key === "string" && typeof value.dimension === "string") {
    collected.push({
      key: value.key,
      dimension: value.dimension,
      ...(typeof value.semantics === "string"
        ? { semantics: value.semantics as PromptedStorefrontPreferenceSemantics }
        : {}),
      ...(typeof value.value === "string" || typeof value.value === "number"
        ? { value: value.value }
        : {}),
      path,
    });
  }
  Object.entries(value).forEach(([key, entry]) =>
    collectReferences(entry, [...path, key], collected),
  );
  return collected;
}

function expectedDimensions(path: readonly (string | number)[]): readonly string[] | undefined {
  const field = [...path].reverse().find((entry): entry is string => typeof entry === "string");
  const parent = [...path]
    .reverse()
    .filter((entry): entry is string => typeof entry === "string")[1];
  const exact: Readonly<Record<string, readonly PromptedStorefrontCapabilityDimension[]>> = {
    profilePreferences: ["homepage.profile"],
    narrativeRoleSequence: ["homepage.narrative-role"],
    requiredRoles: ["homepage.narrative-role"],
    preferredRoles: ["homepage.narrative-role"],
    optionalRoles: ["homepage.narrative-role"],
    avoidedRoles: ["homepage.narrative-role"],
    componentFamilyPreferences: ["homepage.component-family"],
    sectionCount: ["homepage.section-count"],
    sectionRhythmPreferences: ["homepage.section-rhythm"],
    approvedAssetRolePreferences: ["homepage.asset-role"],
    archetypePreferences:
      parent === "collectionSearch" ? ["collection-search.archetype"] : ["pdp.archetype"],
    discoveryPreferences: ["collection-search.discovery"],
    densityPreferences: ["collection-search.density"],
    filterSortPreferences: ["collection-search.filter-sort"],
    childCollectionPreferences: ["collection-search.child-collection"],
    merchandisingPreferences: ["collection-search.merchandising"],
    searchRelationshipPreferences: ["collection-search.search-relationship"],
    standardSimplePreferences: ["pdp.archetype"],
    configurablePreferences: ["pdp.archetype"],
    galleryLedPreferences: ["pdp.archetype"],
    highConsiderationPreferences: ["pdp.archetype"],
    genericFallbackPreferences: ["pdp.archetype"],
    optionComplexityPreferences: ["pdp.option-complexity"],
    mediaPreferences: ["pdp.media"],
    purchaseDecisionHierarchyPreferences: ["pdp.purchase-hierarchy"],
    relatedMerchandisingPreferences: ["pdp.related-merchandising"],
    pageFamilyPreferences: ["content-support.profile"],
    narrativePurposePreferences: ["content-support.narrative-purpose"],
    evidenceRequirements: ["content-support.profile", "content-support.narrative-purpose"],
    familyPreferences: ["component.family"],
    boundedParameterPreferences: ["component.bounded-parameter"],
    responsivePosturePreferences: ["responsive.posture", "shared-frame.responsive"],
    mobileHierarchyPreferences: ["responsive.mobile-hierarchy"],
    densityTransformationPreferences: ["responsive.density"],
    desktopNarrativePriority: ["homepage.narrative-role"],
    mobileNarrativePriority: ["homepage.narrative-role"],
    imagePosturePreferences: ["responsive.image"],
    cropFocalPreferences: ["responsive.crop"],
    overlayPreferences: ["responsive.overlay"],
    approvedMediaRolePreferences: ["responsive.asset-role"],
  };
  if (field === "meaningfulVariantPreferences") {
    return parent === "homepage"
      ? ["homepage.meaningful-variant"]
      : ["component.meaningful-variant"];
  }
  if (field === "productCardPreferences") {
    return parent === "collectionSearch"
      ? ["collection-search.product-card"]
      : ["pdp.product-card"];
  }
  if (field === "preferences") {
    if (parent === "designDna") return promptedStorefrontDesignDnaDimensions;
    if (parent === "sharedFrame") return promptedStorefrontSharedFrameDimensions;
    if (parent === "productTypeIntentions") return promptedStorefrontProductTypeDimensions;
  }
  return field ? exact[field] : undefined;
}

function expectedPdpIntentRole(
  path: readonly (string | number)[],
): PromptedStorefrontCapabilityIntentRole | undefined {
  const fields: Readonly<Record<string, PromptedStorefrontCapabilityIntentRole>> = {
    standardSimplePreferences: "pdp-standard-simple",
    configurablePreferences: "pdp-configurable",
    galleryLedPreferences: "pdp-gallery-led",
    highConsiderationPreferences: "pdp-high-consideration",
    genericFallbackPreferences: "pdp-generic-fallback",
  };
  const field = [...path].reverse().find((entry): entry is string => typeof entry === "string");
  return field ? fields[field] : undefined;
}

const promptedStorefrontDesignDnaDimensions = [
  "design-dna.typography-pairing",
  "design-dna.typography-hierarchy",
  "design-dna.typography-scale",
  "design-dna.spacing",
  "design-dna.density",
  "design-dna.surface",
  "design-dna.depth",
  "design-dna.control",
  "design-dna.shape",
  "design-dna.media",
  "design-dna.colour",
] as const satisfies readonly PromptedStorefrontCapabilityDimension[];

const promptedStorefrontSharedFrameDimensions = [
  "shared-frame.profile",
  "shared-frame.header",
  "shared-frame.navigation",
  "shared-frame.announcement",
  "shared-frame.utility-navigation",
  "shared-frame.footer",
  "shared-frame.mobile-navigation",
  "shared-frame.responsive",
] as const satisfies readonly PromptedStorefrontCapabilityDimension[];

const promptedStorefrontProductTypeDimensions = [
  "pdp.archetype",
  "pdp.option-complexity",
  "pdp.media",
  "pdp.purchase-hierarchy",
  "pdp.related-merchandising",
  "pdp.product-card",
] as const satisfies readonly PromptedStorefrontCapabilityDimension[];

function impliedHardRequirement(reference: LocatedReference): boolean {
  if (reference.semantics !== undefined) return reference.semantics === "hard";
  return reference.path.some(
    (entry) =>
      entry === "requiredRoles" ||
      entry === "narrativeRoleSequence" ||
      entry === "sectionCount" ||
      entry === "desktopNarrativePriority" ||
      entry === "mobileNarrativePriority",
  );
}

function assertBoundedParameter(
  reference: LocatedReference,
  authority: PromptedStorefrontCapabilityAuthorityReference,
): void {
  if (reference.dimension !== "component.bounded-parameter") return;
  const value = reference.value;
  if (value === undefined) {
    throw new PromptedStorefrontDesignIntentError("invalid-bounded-parameter");
  }
  if (
    authority.selection.kind === "enum" &&
    (!authority.selection.allowedValues.some((candidate) => candidate === String(value)) ||
      typeof value !== "string")
  ) {
    throw new PromptedStorefrontDesignIntentError("invalid-bounded-parameter");
  }
  if (
    authority.selection.kind === "number" &&
    (typeof value !== "number" ||
      value < authority.selection.minimum ||
      value > authority.selection.maximum)
  ) {
    throw new PromptedStorefrontDesignIntentError("invalid-bounded-parameter");
  }
  if (authority.selection.kind === "capability") {
    throw new PromptedStorefrontDesignIntentError("invalid-bounded-parameter");
  }
}

function assertHomepageSectionCount(
  sectionCount: Readonly<{
    minimum: number;
    ideal: number;
    maximum: number;
  }>,
  authority: PromptedStorefrontCapabilityAuthorityReference,
): void {
  if (
    authority.selection.kind !== "number" ||
    sectionCount.minimum < authority.selection.minimum ||
    sectionCount.minimum > authority.selection.maximum ||
    sectionCount.ideal < authority.selection.minimum ||
    sectionCount.ideal > authority.selection.maximum ||
    sectionCount.maximum < authority.selection.minimum ||
    sectionCount.maximum > authority.selection.maximum
  ) {
    throw new PromptedStorefrontDesignIntentError("invalid-bounded-parameter");
  }
}

function containsConcreteRouteReference(value: unknown): boolean {
  if (typeof value === "string") {
    return /(?:https?:\/\/|(?:^|[\s"'(])\/(?!\/)[a-z0-9][a-z0-9/_-]*(?:[?#][^\s]*)?)/i.test(value);
  }
  if (Array.isArray(value)) return value.some(containsConcreteRouteReference);
  if (isRecord(value)) return Object.values(value).some(containsConcreteRouteReference);
  return false;
}

export function validatePromptedStorefrontDesignIntentV2(input: {
  request: PromptedStorefrontDesignRequestV2;
  capabilityAuthority: PromptedStorefrontCapabilityAuthority;
  currentAuthority: PromptedStorefrontCurrentAuthorityIdentity;
  intent: unknown;
}): PromptedStorefrontDesignIntentV2 {
  const request = validatePromptedStorefrontDesignRequestV2(input.request);
  assertPromptedStorefrontCapabilityAuthority(request, input.capabilityAuthority);
  assertPromptedStorefrontCurrentAuthority(request.currentAuthority, input.currentAuthority);
  if (containsExecutableContent(input.intent)) {
    throw new PromptedStorefrontDesignIntentError("executable-content");
  }
  if (isRecord(input.intent) && containsProtectedStorefrontClaimContent(input.intent.concept)) {
    throw new PromptedStorefrontDesignIntentError("protected-content");
  }
  if (containsConcreteRouteReference(input.intent)) {
    throw new PromptedStorefrontDesignIntentError("route-instance-reference");
  }
  if (
    !isRecord(input.intent) ||
    input.intent.contractVersion !== PROMPTED_STOREFRONT_DESIGN_REQUEST_V2
  ) {
    throw new PromptedStorefrontDesignIntentError("unsupported-contract-version");
  }
  if (input.intent.requestFingerprint !== request.requestFingerprint) {
    throw new PromptedStorefrontDesignIntentError("request-fingerprint-mismatch");
  }
  if (input.intent.promptFingerprint !== request.promptFingerprint) {
    throw new PromptedStorefrontDesignIntentError("prompt-fingerprint-mismatch");
  }
  const parsed = promptedStorefrontDesignIntentV2MaterialSchema.safeParse(input.intent);
  if (!parsed.success) throw new PromptedStorefrontDesignIntentError("strict-schema-invalid");
  const normalized = normalizePromptedStorefrontDesignIntentV2(parsed.data);
  for (const reference of collectReferences(normalized)) {
    const authority = input.capabilityAuthority.referencesByPreferenceKey.get(reference.key);
    if (!authority) throw new PromptedStorefrontDesignIntentError("unknown-capability");
    if (authority.dimension !== reference.dimension) {
      throw new PromptedStorefrontDesignIntentError("wrong-capability-dimension");
    }
    const expected = expectedDimensions(reference.path);
    if (expected && !expected.includes(reference.dimension)) {
      throw new PromptedStorefrontDesignIntentError("wrong-capability-dimension");
    }
    const expectedIntentRole = expectedPdpIntentRole(reference.path);
    if (expectedIntentRole && !authority.intentRoles?.includes(expectedIntentRole)) {
      throw new PromptedStorefrontDesignIntentError("wrong-capability-dimension");
    }
    if (impliedHardRequirement(reference) && authority.availability !== "available") {
      throw new PromptedStorefrontDesignIntentError("unavailable-capability");
    }
    assertBoundedParameter(reference, authority);
  }
  const sectionCountAuthority = input.capabilityAuthority.referencesByPreferenceKey.get(
    normalized.homepage.sectionCount.key,
  );
  if (!sectionCountAuthority) {
    throw new PromptedStorefrontDesignIntentError("unknown-capability");
  }
  assertHomepageSectionCount(normalized.homepage.sectionCount, sectionCountAuthority);
  for (const intention of normalized.productDetail.productTypeIntentions) {
    const authority = input.capabilityAuthority.referencesByPreferenceKey.get(
      intention.productTypeKey,
    );
    if (!authority?.productTypeKey || authority.dimension !== "pdp.product-type") {
      throw new PromptedStorefrontDesignIntentError("unknown-product-type");
    }
  }
  const intentFingerprint = promptedStorefrontDesignIntentFingerprint(normalized);
  return { ...normalized, intentFingerprint };
}
