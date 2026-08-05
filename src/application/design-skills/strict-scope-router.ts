import { storefrontDesignDirectionIdSchema } from "@/application/storefront-design-system";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { idSchema, localeSchema } from "@/domain/shared";
import { z } from "zod";
import {
  executeGovernedFollowUpEditing,
  governedFollowUpEditingRequestSchema,
  type GovernedFollowUpEditingIntegrationResult,
} from "./follow-up-editing-integration";
import {
  governedInitialGenerationRequestSchema,
  executeGovernedInitialGeneration,
  type GovernedInitialGenerationResult,
} from "./initial-generation-integration";
import {
  governedSkillPackageRegistry,
  type GovernedFollowUpEditingAuthority,
  type GovernedInitialGenerationAuthority,
  type GovernedSkillAuthorityEnvelope,
  type GovernedSkillPackageId,
  type GovernedSkillPackageRegistry,
} from "./governed-skill-packages";

export const STRICT_SCOPE_ROUTER_CONTRACT_VERSION = "1.0.0";

export const strictScopeRouterScopeSchema = z.enum([
  "designSystem",
  "exactSlot",
  "pageInsertion",
  "completeStorefront",
]);
export const strictScopeRouterOutcomeSchema = z.enum([
  "initialGeneration",
  "followUpEditing",
  "clarificationRequired",
  "unsupported",
]);
export const strictScopeRouterReasonCodeSchema = z.enum([
  "malformedRequest",
  "nonCloneableInput",
  "unsupportedContractVersion",
  "contradictoryExecutionKind",
  "unknownPackage",
  "deprecatedAliasMisuse",
  "missingProjectOrDraftAuthority",
  "missingPageAuthority",
  "missingExactSlotAuthority",
  "ambiguousSlotAuthority",
  "missingRegisteredDirection",
  "conflictingScopes",
  "ambiguousPackage",
  "unsupportedCommerceMutation",
  "unsupportedPublishingIntent",
  "unsupportedRequest",
  "staleRegistryAuthority",
  "staleCapabilityAuthority",
  "authorityRejected",
  "downstreamGovernedExecutionRejection",
]);

const executionKindSchema = z.enum(["initialGeneration", "followUpEditing"]);
const supportedIntentSchema = z.enum([
  "createNewStorefront",
  "exactBrandPalette",
  "heroImprovement",
  "campaignSection",
  "registeredWholeStorefrontDirection",
]);

export const strictScopeRouterRequestSchema = z
  .object({
    contractVersion: z.string().trim().min(1).max(32),
    merchantInstruction: z.string().trim().min(1).max(2_000),
    declaredExecutionKind: executionKindSchema.optional(),
    declaredIntent: supportedIntentSchema.optional(),
    requestedPackageId: z.string().trim().min(1).max(80).optional(),
    declaredScope: strictScopeRouterScopeSchema,
    declaredPageIds: z.array(idSchema).max(32).default([]),
    declaredSlots: z
      .array(z.object({ pageId: idSchema, slotId: z.string().trim().min(1).max(160) }).strict())
      .max(128)
      .default([]),
    initialGeneration: governedInitialGenerationRequestSchema.optional(),
    followUpEditing: governedFollowUpEditingRequestSchema.optional(),
  })
  .strict();

export type StrictScopeRouterScope = z.infer<typeof strictScopeRouterScopeSchema>;
export type StrictScopeRouterOutcome = z.infer<typeof strictScopeRouterOutcomeSchema>;
export type StrictScopeRouterReasonCode = z.infer<typeof strictScopeRouterReasonCodeSchema>;
export type StrictScopeRouterRequest = z.infer<typeof strictScopeRouterRequestSchema>;

type AuthorityReference = Readonly<{
  projectId: string;
  projectRevision: number;
  draftSnapshotId: string;
  draftRevision: number;
  snapshotFingerprint: string;
  locale: z.infer<typeof localeSchema>;
  requestIdentity: string;
  packageRegistry: Readonly<{ version: string; fingerprint: string }>;
  capabilityManifest: Readonly<{ version: string; fingerprint: string }>;
}>;

export type StrictScopeRoutingDecision = Readonly<{
  fingerprint: string;
  requestIdentity: string;
  executionKind: "initialGeneration" | "followUpEditing";
  packageId: GovernedSkillPackageId;
  scope: StrictScopeRouterScope;
  declaredPageIds: readonly string[];
  declaredSlots: readonly Readonly<{ pageId: string; slotId: string }>[];
  profiles: readonly Readonly<{ pageId: string; profileId: string; fingerprint: string }>[];
  registeredDirectionId?: z.infer<typeof storefrontDesignDirectionIdSchema>;
  authority: AuthorityReference;
}>;

export type StrictScopeRouterClarification = Readonly<{
  outcome: "clarificationRequired";
  reasonCode: StrictScopeRouterReasonCode;
  clarificationFields: readonly (
    | "executionKind"
    | "package"
    | "scope"
    | "pageAuthority"
    | "slotAuthority"
    | "registeredDirection"
  )[];
}>;

export type StrictScopeRouterUnsupported = Readonly<{
  outcome: "unsupported";
  reasonCode: StrictScopeRouterReasonCode;
  downstreamFailureCode?: string;
  decision?: StrictScopeRoutingDecision;
}>;

export type StrictScopeRouterResult =
  | Readonly<{
      outcome: "initialGeneration";
      decision: StrictScopeRoutingDecision;
      execution?: GovernedInitialGenerationResult;
    }>
  | Readonly<{
      outcome: "followUpEditing";
      decision: StrictScopeRoutingDecision;
      execution?: GovernedFollowUpEditingIntegrationResult;
    }>
  | StrictScopeRouterClarification
  | StrictScopeRouterUnsupported;

export type StrictScopeRouterOptions = Readonly<{
  dispatch?: boolean;
  registry?: GovernedSkillPackageRegistry;
}>;

const packageByIntent = {
  createNewStorefront: "applyRegisteredWholeStorefrontDirection",
  exactBrandPalette: "applyExactBrandPalette",
  heroImprovement: "improveHero",
  campaignSection: "addCampaignSection",
  registeredWholeStorefrontDirection: "applyRegisteredWholeStorefrontDirection",
} as const satisfies Readonly<
  Record<z.infer<typeof supportedIntentSchema>, GovernedSkillPackageId>
>;

const scopeByPackage = {
  applyExactBrandPalette: "designSystem",
  improveHero: "exactSlot",
  addCampaignSection: "pageInsertion",
  applyRegisteredWholeStorefrontDirection: "completeStorefront",
} as const satisfies Readonly<Record<GovernedSkillPackageId, StrictScopeRouterScope>>;

function frozen<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) frozen(Reflect.get(value, key));
  }
  return value;
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function hasAny(normalized: string, phrases: readonly string[]) {
  return phrases.some((phrase) => normalized.includes(phrase));
}

function inferredIntents(normalized: string): readonly z.infer<typeof supportedIntentSchema>[] {
  const matches: z.infer<typeof supportedIntentSchema>[] = [];
  if (
    hasAny(normalized, [
      "create a new storefront",
      "create new storefront",
      "new governed storefront proposal",
    ])
  ) {
    matches.push("createNewStorefront");
  }
  if (hasAny(normalized, ["apply exact brand palette", "apply approved brand palette"])) {
    matches.push("exactBrandPalette");
  }
  if (hasAny(normalized, ["improve this hero", "improve the hero", "improve hero"])) {
    matches.push("heroImprovement");
  }
  if (
    hasAny(normalized, [
      "add a campaign section",
      "add campaign section",
      "insert campaign section",
    ])
  ) {
    matches.push("campaignSection");
  }
  if (
    hasAny(normalized, [
      "apply registered storefront direction",
      "apply registered direction across storefront",
      "apply registered whole storefront direction",
    ])
  ) {
    matches.push("registeredWholeStorefrontDirection");
  }
  return matches;
}

function unsupportedIntent(normalized: string): StrictScopeRouterReasonCode | undefined {
  if (
    hasAny(normalized, [
      "change product price",
      "change price",
      "update stock",
      "change stock",
      "availability",
      "sku",
      "variant mutation",
      "collection membership",
      "collection order",
      "product media",
      "checkout",
      "payment",
      "order processing",
      "authentication",
      "permission",
      "generate code",
      "custom component",
    ])
  ) {
    return "unsupportedCommerceMutation";
  }
  return hasAny(normalized, ["publish storefront", "publish this", "publish changes"])
    ? "unsupportedPublishingIntent"
    : undefined;
}

function hasStructuralMix(normalized: string) {
  return hasAny(normalized, [
    "layout",
    "add section",
    "remove section",
    "insert component",
    "replace asset",
    "navigation",
    "product",
    "collection",
    "whole storefront",
  ]);
}

function stableUnique<T>(
  values: readonly T[],
  key: (value: T) => string,
): readonly T[] | undefined {
  const ordered = [...values].sort((left, right) => key(left).localeCompare(key(right)));
  return new Set(ordered.map(key)).size === ordered.length ? ordered : undefined;
}

function clarification(
  reasonCode: StrictScopeRouterReasonCode,
  clarificationFields: StrictScopeRouterClarification["clarificationFields"],
): StrictScopeRouterClarification {
  return frozen({ outcome: "clarificationRequired", reasonCode, clarificationFields });
}

function unsupported(
  reasonCode: StrictScopeRouterReasonCode,
  options: Omit<StrictScopeRouterUnsupported, "outcome" | "reasonCode"> = {},
): StrictScopeRouterUnsupported {
  return frozen({ outcome: "unsupported", reasonCode, ...options });
}

function authorityReference(authority: GovernedSkillAuthorityEnvelope): AuthorityReference {
  return frozen({
    projectId: authority.projectId,
    projectRevision: authority.projectRevision,
    draftSnapshotId: authority.draftSnapshotId,
    draftRevision: authority.draftRevision,
    snapshotFingerprint: authority.snapshotFingerprint,
    locale: authority.locale,
    requestIdentity: authority.requestIdentity,
    packageRegistry: { ...authority.packageRegistry },
    capabilityManifest: { ...authority.manifest },
  });
}

function expectedAuthority(
  request: StrictScopeRouterRequest,
):
  | Readonly<{ kind: "initialGeneration"; authority: GovernedInitialGenerationAuthority }>
  | Readonly<{ kind: "followUpEditing"; authority: GovernedFollowUpEditingAuthority }>
  | undefined {
  if (request.initialGeneration && !request.followUpEditing) {
    return { kind: "initialGeneration", authority: request.initialGeneration.authority };
  }
  if (request.followUpEditing && !request.initialGeneration) {
    return { kind: "followUpEditing", authority: request.followUpEditing.authority };
  }
  return undefined;
}

function validateDeclaredAuthority(
  request: StrictScopeRouterRequest,
  authority: Exclude<ReturnType<typeof expectedAuthority>, undefined>,
  packageId: GovernedSkillPackageId,
): StrictScopeRouterClarification | undefined {
  const expectedScope = scopeByPackage[packageId];
  if (request.declaredScope !== expectedScope) {
    return clarification("conflictingScopes", ["scope"]);
  }
  const declaredPages = stableUnique(request.declaredPageIds, (pageId) => pageId);
  const declaredSlots = stableUnique(
    request.declaredSlots,
    (slot) => `${slot.pageId}:${slot.slotId}`,
  );
  if (!declaredPages || !declaredSlots) return clarification("conflictingScopes", ["scope"]);
  if (authority.kind === "initialGeneration") {
    const authorityPages = authority.authority.profiles.map((profile) => profile.pageId);
    const samePages =
      canonicalValueFingerprint(declaredPages) ===
      canonicalValueFingerprint(stableUnique(authorityPages, (id) => id));
    if (!samePages) return clarification("missingPageAuthority", ["pageAuthority"]);
    if (declaredSlots.length > 0)
      return clarification("missingExactSlotAuthority", ["slotAuthority"]);
    return undefined;
  }
  const authorityPages = authority.authority.pages.map((page) => page.pageId);
  const authoritySlots = authority.authority.pages.flatMap((page) =>
    page.selections.map((selection) => ({ pageId: page.pageId, slotId: selection.slotId })),
  );
  const samePages =
    canonicalValueFingerprint(declaredPages) ===
    canonicalValueFingerprint(stableUnique(authorityPages, (id) => id));
  const sameSlots =
    canonicalValueFingerprint(declaredSlots) ===
    canonicalValueFingerprint(
      stableUnique(authoritySlots, (slot) => `${slot.pageId}:${slot.slotId}`),
    );
  if (!samePages) return clarification("missingPageAuthority", ["pageAuthority"]);
  if (!sameSlots) return clarification("missingExactSlotAuthority", ["slotAuthority"]);
  if (
    packageId === "applyExactBrandPalette" &&
    (declaredPages.length > 0 || declaredSlots.length > 0)
  ) {
    return clarification("conflictingScopes", ["scope"]);
  }
  if (packageId === "improveHero") {
    const page = authority.authority.pages[0];
    if (
      !page ||
      authority.authority.pages.length !== 1 ||
      page.profile === undefined ||
      page.selections.length !== 1 ||
      page.selections[0]?.slotId !== "hero" ||
      page.selections[0]?.componentType !== "homepageHero"
    ) {
      return clarification("ambiguousSlotAuthority", ["pageAuthority", "slotAuthority"]);
    }
  }
  if (packageId === "addCampaignSection") {
    const page = authority.authority.pages[0];
    if (!page || authority.authority.pages.length !== 1 || page.selections.length !== 1) {
      return clarification("missingExactSlotAuthority", ["pageAuthority", "slotAuthority"]);
    }
  }
  return undefined;
}

function profileReferences(
  authority: GovernedInitialGenerationAuthority | GovernedFollowUpEditingAuthority,
): readonly Readonly<{ pageId: string; profileId: string; fingerprint: string }>[] {
  if (authority.executionKind === "initialGeneration") {
    return authority.profiles
      .map((profile) => ({
        pageId: profile.pageId,
        profileId: profile.profileId,
        fingerprint: profile.fingerprint,
      }))
      .sort((left, right) => left.pageId.localeCompare(right.pageId));
  }
  return authority.pages
    .flatMap((page) =>
      page.profile
        ? [
            {
              pageId: page.pageId,
              profileId: page.profile.profileId,
              fingerprint: page.profile.fingerprint,
            },
          ]
        : [],
    )
    .sort((left, right) => left.pageId.localeCompare(right.pageId));
}

/**
 * Strict deterministic P10A-06 boundary. It classifies only normalized,
 * explicitly-authorized requests and delegates any execution to the two
 * existing governed integration adapters. It never persists, accepts,
 * publishes, plans independently, or calls a provider.
 */
export function routeGovernedDesignRequest(
  inputValue: unknown,
  currentAuthority: GovernedSkillAuthorityEnvelope,
  options: StrictScopeRouterOptions = {},
): StrictScopeRouterResult {
  let parsed: ReturnType<typeof strictScopeRouterRequestSchema.safeParse>;
  try {
    parsed = strictScopeRouterRequestSchema.safeParse(structuredClone(inputValue));
  } catch {
    return unsupported("nonCloneableInput");
  }
  if (!parsed.success) return unsupported("malformedRequest");
  const request = parsed.data;
  if (request.contractVersion !== STRICT_SCOPE_ROUTER_CONTRACT_VERSION) {
    return unsupported("unsupportedContractVersion");
  }
  const authority = expectedAuthority(request);
  if (!authority) return clarification("contradictoryExecutionKind", ["executionKind"]);
  if (
    request.declaredExecutionKind !== undefined &&
    request.declaredExecutionKind !== authority.kind
  ) {
    return clarification("contradictoryExecutionKind", ["executionKind"]);
  }
  const normalized = normalizeText(request.merchantInstruction);
  const primaryUnsupported = unsupportedIntent(normalized);
  if (primaryUnsupported) return unsupported(primaryUnsupported);
  const intents = inferredIntents(normalized);
  if (intents.length !== 1) {
    return clarification(intents.length > 1 ? "ambiguousPackage" : "unsupportedRequest", [
      "package",
    ]);
  }
  const intent = intents[0];
  if (request.declaredIntent !== undefined && request.declaredIntent !== intent) {
    return clarification("conflictingScopes", ["scope"]);
  }
  if (
    (intent === "exactBrandPalette" && hasStructuralMix(normalized)) ||
    (intent === "heroImprovement" && hasStructuralMix(normalized))
  ) {
    return clarification("conflictingScopes", ["scope"]);
  }
  if (
    (intent === "createNewStorefront" && authority.kind !== "initialGeneration") ||
    (intent !== "createNewStorefront" && authority.kind !== "followUpEditing")
  ) {
    return clarification("contradictoryExecutionKind", ["executionKind"]);
  }
  const registry = options.registry ?? governedSkillPackageRegistry;
  let resolution: ReturnType<GovernedSkillPackageRegistry["resolve"]>;
  try {
    resolution = registry.resolve(
      request.requestedPackageId ?? packageByIntent[intent],
      authority.kind,
    );
  } catch (error) {
    return unsupported(
      error instanceof Error && error.name === "GovernedSkillPackageError"
        ? "unknownPackage"
        : "authorityRejected",
    );
  }
  const packageId = resolution.descriptor.id;
  if (packageId !== packageByIntent[intent]) return clarification("ambiguousPackage", ["package"]);
  if (resolution.alias && packageId === "applyRegisteredWholeStorefrontDirection") {
    return clarification("deprecatedAliasMisuse", ["package", "registeredDirection"]);
  }
  if (intent === "registeredWholeStorefrontDirection") {
    const direction = request.followUpEditing?.registeredDirectionId;
    if (!direction) return clarification("missingRegisteredDirection", ["registeredDirection"]);
  }
  const declared = validateDeclaredAuthority(request, authority, packageId);
  if (declared) return declared;
  const validation =
    authority.kind === "initialGeneration"
      ? registry.validateInitialGeneration(authority.authority, currentAuthority)
      : registry.validateFollowUpEditing(authority.authority, currentAuthority);
  if (!validation.valid) {
    const reasonCode =
      validation.failure.code === "staleRegistryAuthority"
        ? "staleRegistryAuthority"
        : validation.failure.code === "staleManifestAuthority"
          ? "staleCapabilityAuthority"
          : validation.failure.code === "staleProjectAuthority" ||
              validation.failure.code === "staleDraftAuthority"
            ? "missingProjectOrDraftAuthority"
            : "authorityRejected";
    return unsupported(reasonCode);
  }
  const pageIds = stableUnique(request.declaredPageIds, (pageId) => pageId);
  const slots = stableUnique(request.declaredSlots, (slot) => `${slot.pageId}:${slot.slotId}`);
  if (!pageIds || !slots) return clarification("conflictingScopes", ["scope"]);
  const direction =
    authority.kind === "initialGeneration"
      ? authority.authority.registeredDirectionId
      : request.followUpEditing?.registeredDirectionId;
  const decisionBase = {
    requestIdentity: authority.authority.authority.requestIdentity,
    executionKind: authority.kind,
    packageId,
    scope: scopeByPackage[packageId],
    declaredPageIds: pageIds,
    declaredSlots: slots,
    profiles: profileReferences(authority.authority),
    ...(direction === undefined ? {} : { registeredDirectionId: direction }),
    authority: authorityReference(authority.authority.authority),
  } as const;
  const decision = frozen({
    ...decisionBase,
    fingerprint: `strict-scope-routing-${canonicalValueFingerprint(decisionBase)}`,
  });
  if (!options.dispatch) {
    return authority.kind === "initialGeneration"
      ? frozen({ outcome: "initialGeneration" as const, decision })
      : frozen({ outcome: "followUpEditing" as const, decision });
  }
  if (authority.kind === "initialGeneration") {
    const execution = executeGovernedInitialGeneration(
      request.initialGeneration,
      currentAuthority,
      registry,
    );
    if (!execution.valid) {
      return unsupported("downstreamGovernedExecutionRejection", {
        decision,
        downstreamFailureCode: execution.failure.code,
      });
    }
    return frozen({ outcome: "initialGeneration" as const, decision, execution });
  }
  const execution = executeGovernedFollowUpEditing(
    request.followUpEditing,
    currentAuthority,
    registry,
  );
  if (!execution.valid) {
    return unsupported("downstreamGovernedExecutionRejection", {
      decision,
      downstreamFailureCode: execution.failure.code,
    });
  }
  return frozen({ outcome: "followUpEditing" as const, decision, execution });
}
