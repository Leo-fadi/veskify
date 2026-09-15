import { validateComponentDefinitionV2 } from "@/domain/component-platform/component-platform";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import {
  dynamicCommerceCollectionSearchArchetypeSchema,
  dynamicCommerceProductDetailArchetypeSchema,
} from "@/domain/storefront/dynamic-commerce-route";
import { getPageFamilyDefinition } from "@/domain/storefront/page-family";
import { pageModelSchema, type PageModel, type PageType } from "@/domain/storefront/storefront";
import {
  createCompiledPageBlueprintCompositionV1,
  parseCompiledPageBlueprintCompositionV1,
  type CompiledPageBlueprintCompositionV1,
  type CompiledPageBlueprintCompositionMaterialV1,
} from "@/domain/storefront/compiled-page-blueprint-composition";
import { parsePageBlueprintV2CandidateAuthority } from "./page-blueprint-v2-candidate-authority";
import { canonicalizePageBlueprintV2ResponsiveRuleContract } from "./page-blueprint-v2-responsive-rule-contract";
import {
  canonicalizePageBlueprintV2StructuralContract,
  createPageBlueprintV2RegionRelationshipKey,
} from "./page-blueprint-v2-contract";
import { pageBlueprintV2RequiredAssetRoleCapacityEvidenceV1Schema } from "./structural-storefront-compatibility-contract";

type Candidate = ReturnType<typeof parsePageBlueprintV2CandidateAuthority>;
type Definition = ReturnType<typeof validateComponentDefinitionV2>;
type Structural = Candidate["structural"];
type ResponsiveRule = Candidate["responsiveRules"]["breakpointRules"][number];
type Unit = CompiledPageBlueprintCompositionV1["regionAssignments"][number]["units"][number];
declare const accepted: unique symbol;
export type AcceptedCompiledPageBlueprintCompositionV1 = CompiledPageBlueprintCompositionV1 & {
  readonly [accepted]: true;
};
export type PageBlueprintCompositionOwner =
  | Readonly<{ kind: "static-page"; page: PageModel }>
  | Readonly<{
      kind: "collection-search-archetype";
      archetype: unknown;
      context: "collection" | "search";
    }>
  | Readonly<{ kind: "product-detail-archetype"; archetype: unknown }>;
type BoundUnit = Readonly<{
  key: string;
  visible: boolean;
  component: string;
  variant: string;
  definition: Definition;
}>;
type SupportContext = {
  candidate: Candidate;
  structural: Structural;
  owner: CompiledPageBlueprintCompositionV1["owner"];
  bindingFingerprint: string;
};
export type PageBlueprintCompositionRealizationRequest = Readonly<
  SupportContext &
    (
      | {
          kind: "region";
          realizationId: string;
          region: Structural["regions"][number];
          units: readonly BoundUnit[];
        }
      | {
          kind: "relationship";
          realizationId: string;
          relationship: Structural["relationships"][number];
          breakpoint?: ResponsiveRule["breakpoint"];
          transformation: string;
        }
      | {
          kind: "breakpoint";
          realizationId: string;
          rule: ResponsiveRule;
          order: Structural["orderAlternatives"][number];
        }
    )
>;
export type PageBlueprintCompositionRealizationSupport = Readonly<{
  id: string;
  version: string;
  implementationFingerprint: string;
  resolve(input: PageBlueprintCompositionRealizationRequest): boolean;
}>;
export type PageBlueprintCompositionAuthority = Readonly<{
  owner: PageBlueprintCompositionOwner;
  candidate: unknown;
  componentDefinitions: readonly unknown[];
  support: PageBlueprintCompositionRealizationSupport;
  requiredAssetRoleCapacityEvidence: unknown;
}>;
export type StaticPageBlueprintCompositionAuthority = PageBlueprintCompositionAuthority &
  Readonly<{ owner: Readonly<{ kind: "static-page"; page: PageModel }> }>;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function freeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((entry) => {
    freeze(entry, seen);
  });
  return Object.freeze(value);
}
class CompositionError extends Error {}
function fail(rule: string): never {
  throw new CompositionError(`Compiled composition rejected: ${rule}`);
}
function bounded<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof CompositionError) throw error;
    fail("invalid composition or authority schema");
  }
}
function staticFamily(page: PageModel): Structural["pageFamilyId"] {
  if (page.pageFamily) {
    const definition = getPageFamilyDefinition(page.pageFamily.familyId);
    if (
      definition.pageType !== page.type ||
      definition.commerceContext !== page.pageFamily.commerceContext.kind ||
      definition.version !== page.pageFamily.familyVersion
    )
      fail("page family authority conflicts with owner type or context");
    switch (definition.routeClass) {
      case "root":
        return "home";
      case "collection-detail":
        return "collection";
      case "search":
        return "search";
      case "product-detail":
        return "product-detail";
      case "content":
      case "campaign":
        return "content-support";
      default:
        return "utility";
    }
  }
  // Existing legacy pages have no explicit family; their canonical type remains authoritative.
  switch (page.type) {
    case "home":
      return "home";
    case "collection":
      return "collection";
    case "product":
      return "product-detail";
    case "content":
      return "content-support";
    default:
      return fail("explicit page family required for this owner type");
  }
}
function unitKey(unit: Exclude<Unit, { kind: "anatomy" }>): string {
  return unit.kind === "section" ? `section:${unit.sectionId}` : `presentation:${unit.slotId}`;
}
function checkedAuthority(input: PageBlueprintCompositionAuthority) {
  const candidate = parsePageBlueprintV2CandidateAuthority(input.candidate);
  if (!input.support || typeof input.support.resolve !== "function")
    fail("missing realization support");
  const page =
    input.owner.kind === "static-page" ? pageModelSchema.parse(input.owner.page) : undefined;
  const archetype =
    input.owner.kind === "collection-search-archetype"
      ? dynamicCommerceCollectionSearchArchetypeSchema.parse(input.owner.archetype)
      : input.owner.kind === "product-detail-archetype"
        ? dynamicCommerceProductDetailArchetypeSchema.parse(input.owner.archetype)
        : undefined;
  if (!page && !archetype) fail("unknown canonical owner kind");
  const family = page
    ? staticFamily(page)
    : input.owner.kind === "collection-search-archetype"
      ? input.owner.context
      : "product-detail";
  if (
    input.owner.kind === "collection-search-archetype" &&
    (!archetype ||
      !("supportedContexts" in archetype) ||
      !archetype.supportedContexts.includes(input.owner.context))
  )
    fail("collection/search context is not supported by owner");
  if (candidate.structural.pageFamilyId !== family)
    fail("owner page family does not match selected blueprint");
  const pageType: PageType =
    page?.type ?? (input.owner.kind === "product-detail-archetype" ? "product" : "collection");
  if (input.componentDefinitions.length > 256) fail("component definition bound exceeded");
  const definitions = input.componentDefinitions.map(validateComponentDefinitionV2);
  const byType = new Map(definitions.map((definition) => [definition.type, definition]));
  if (byType.size !== definitions.length) fail("duplicate component definitions");
  const rawUnits = page
    ? page.sections.map((section) => ({ ...section, key: `section:${section.id}` }))
    : archetype!.componentPresentations.map((unit) => ({
        ...unit,
        key: `presentation:${unit.slotId}`,
      }));
  if (rawUnits.length > 1024) fail("owner inventory bound exceeded");
  const units: BoundUnit[] = rawUnits
    .map((unit) => {
      const definition = byType.get(unit.component);
      if (
        !definition ||
        !definition.supportedPageTypes.includes(pageType) ||
        !definition.variants.some((variant) => variant.id === unit.variant)
      )
        fail("unsupported component definition, variant or page type");
      return {
        key: unit.key,
        visible: unit.visible,
        component: unit.component,
        variant: unit.variant,
        definition,
      };
    })
    .sort((a, b) => compare(a.key, b.key));
  if (new Set(units.map((unit) => unit.key)).size !== units.length)
    fail("duplicate owner inventory reference");
  const owner = { kind: input.owner.kind, id: page?.id ?? archetype!.id };
  const bindingFingerprint = `compiled-page-blueprint-binding-${canonicalValueFingerprint({
    owner,
    pageType,
    family,
    explicitFamily: page?.pageFamily ?? null,
    units: units.map(({ definition, ...unit }) => ({
      ...unit,
      definitionFingerprint: canonicalValueFingerprint(definition),
    })),
  })}`;
  return { candidate, units, owner, bindingFingerprint };
}
function capacityProjection(
  candidate: Candidate,
  omissions: CompiledPageBlueprintCompositionV1["omissions"],
  evidence: unknown,
) {
  const parsed = pageBlueprintV2RequiredAssetRoleCapacityEvidenceV1Schema.parse(evidence);
  if (
    parsed.blueprintId !== candidate.structural.id ||
    parsed.blueprintVersion !== candidate.structural.version ||
    parsed.exactCandidateFingerprint !== candidate.candidateFingerprint
  )
    fail("stale asset capacity evidence");
  const required = candidate.assetRoleCompatibility.regionAssetRequirements.flatMap(
    ({ regionId, roleRequirements }) =>
      roleRequirements
        .filter((role) => role.requirement === "required")
        .map((role) => ({ regionId, role: role.role, minimum: role.cardinality.minimum })),
  );
  const capacities = new Map(
    parsed.requiredRoleCapacities.map((entry) => [
      `${entry.regionId}:${entry.role}`,
      entry.satisfiableMinimumCapacity,
    ]),
  );
  if (
    capacities.size !== required.length ||
    required.some(({ regionId, role }) => !capacities.has(`${regionId}:${role}`))
  )
    fail("incomplete asset capacity evidence");
  const shortfalls = [
    ...new Set(
      required
        .filter(({ regionId, role, minimum }) => capacities.get(`${regionId}:${role}`)! < minimum)
        .map((entry) => entry.regionId),
    ),
  ].sort(compare);
  const omitted = new Set(omissions.map((entry) => entry.regionId));
  if (
    omitted.size !== omissions.length ||
    JSON.stringify(shortfalls) !== JSON.stringify([...omitted].sort(compare))
  )
    fail("omissions do not exactly match capacity shortfalls");
  if (
    shortfalls.length &&
    candidate.omissionSubstitutionFallback.blueprintSubstitutionCandidates.length
  )
    fail("unresolved blueprint substitution before omission");
  const evidenceFingerprint = canonicalValueFingerprint({
    ...parsed,
    requiredRoleCapacities: [...parsed.requiredRoleCapacities].sort((a, b) =>
      compare(`${a.regionId}:${a.role}`, `${b.regionId}:${b.role}`),
    ),
  });
  for (const omission of omissions) {
    const region = candidate.structural.regions.find((entry) => entry.id === omission.regionId);
    const rule = candidate.omissionSubstitutionFallback.regionFallbackRules.find(
      (entry) => entry.regionId === omission.regionId,
    );
    if (
      region?.requirement !== "optional" ||
      rule?.terminalResolution !== "omit-region" ||
      rule.trigger !== "required-asset-role-cardinality-unsatisfied"
    )
      fail("omission requires optional region and exact omit-region fallback");
    if (omission.evidenceFingerprint !== evidenceFingerprint)
      fail("omission evidence fingerprint is stale");
  }
  const retained = (id: string) => !omitted.has(id);
  const structural = canonicalizePageBlueprintV2StructuralContract({
    ...candidate.structural,
    regions: candidate.structural.regions.filter((region) => retained(region.id)),
    relationships: candidate.structural.relationships.filter(
      (relation) => retained(relation.sourceRegionId) && retained(relation.targetRegionId),
    ),
    orderAlternatives: candidate.structural.orderAlternatives.map((order) => ({
      ...order,
      regionIds: order.regionIds.filter(retained),
    })),
  });
  const keys = new Set(structural.relationships.map(createPageBlueprintV2RegionRelationshipKey));
  const responsive = canonicalizePageBlueprintV2ResponsiveRuleContract(structural, {
    ...candidate.responsiveRules,
    breakpointRules: candidate.responsiveRules.breakpointRules.map((rule) => ({
      ...rule,
      regionProportionRules: rule.regionProportionRules.filter((region) =>
        retained(region.regionId),
      ),
      relationshipTransformations: rule.relationshipTransformations.filter((relation) =>
        keys.has(relation.relationshipKey),
      ),
    })),
  });
  return { structural, responsive };
}
function validate(
  input: unknown,
  authority: PageBlueprintCompositionAuthority,
): AcceptedCompiledPageBlueprintCompositionV1 {
  const composition = parseCompiledPageBlueprintCompositionV1(input);
  const checked = checkedAuthority(authority);
  const { candidate, units, owner, bindingFingerprint } = checked;
  if (composition.owner.kind !== owner.kind || composition.owner.id !== owner.id)
    fail("composition owner is not supplied canonical owner");
  if (
    composition.blueprint.blueprintId !== candidate.structural.id ||
    composition.blueprint.blueprintVersion !== candidate.structural.version ||
    composition.blueprint.candidateFingerprint !== candidate.candidateFingerprint
  )
    fail("blueprint reference is stale");
  if (composition.bindingFingerprint !== bindingFingerprint) fail("binding fingerprint is stale");
  if (
    composition.support.id !== authority.support.id ||
    composition.support.version !== authority.support.version ||
    composition.support.implementationFingerprint !== authority.support.implementationFingerprint
  )
    fail("realization support identity is stale");
  const { structural, responsive } = capacityProjection(
    candidate,
    composition.omissions,
    authority.requiredAssetRoleCapacityEvidence,
  );
  const context = { candidate, structural, owner, bindingFingerprint };
  function resolve(request: PageBlueprintCompositionRealizationRequest) {
    let resolved = false;
    try {
      resolved = authority.support.resolve(freeze(request)) === true;
    } catch {
      fail("realization resolver failed");
    }
    if (!resolved) fail(`unresolved ${request.kind} realization`);
  }
  const assignments = new Map(
    composition.regionAssignments.map((entry) => [entry.regionId, entry]),
  );
  if (assignments.size !== composition.regionAssignments.length)
    fail("duplicate region assignment");
  const assigned = new Set<string>();
  for (const region of structural.regions) {
    const assignment = assignments.get(region.id);
    if (!assignment) fail(`${region.requirement} region ${region.id} is unassigned`);
    if (
      assignment.units.length < region.cardinality.minimum ||
      assignment.units.length > region.cardinality.maximum
    )
      fail(`region cardinality unsatisfied for ${region.id}`);
    const regionUnits = assignment.units.map((unit) => {
      if (unit.kind === "anatomy") fail("anatomy realization is not executable");
      const key = unitKey(unit);
      const bound = units.find((entry) => entry.key === key);
      if (!bound || !bound.visible) fail("foreign or invisible unit reference");
      if (assigned.has(key)) fail("visible units must be assigned exactly once");
      if (!bound.definition.designCompatibility.allowedNarrativeRoles.includes(region.role))
        fail(`component narrative role unsupported for ${region.id}`);
      assigned.add(key);
      return bound;
    });
    resolve({
      ...context,
      kind: "region",
      realizationId: assignment.realizationId,
      region,
      units: regionUnits,
    });
  }
  if (assignments.size !== structural.regions.length) fail("unknown or omitted region assignment");
  if (assigned.size !== units.filter((unit) => unit.visible).length)
    fail("visible units must be assigned exactly once");
  const relationships = structural.relationships;
  function relations(
    entries: CompiledPageBlueprintCompositionV1["relationshipRealizations"],
    rule?: ResponsiveRule,
  ) {
    const selections = new Map(
      entries.map((entry) => [entry.relationshipKey, entry.realizationId]),
    );
    if (selections.size !== entries.length || selections.size !== relationships.length)
      fail("relationship coverage is incomplete");
    for (const relationship of relationships) {
      const key = createPageBlueprintV2RegionRelationshipKey(relationship);
      const realizationId = selections.get(key);
      if (!realizationId) fail("relationship coverage is incomplete");
      const transformation = rule
        ? rule.relationshipTransformations.find((entry) => entry.relationshipKey === key)!
            .transformation
        : "preserve";
      resolve({
        ...context,
        kind: "relationship",
        realizationId,
        relationship,
        transformation,
        ...(rule ? { breakpoint: rule.breakpoint } : {}),
      });
    }
  }
  relations(composition.relationshipRealizations);
  responsive.breakpointRules.forEach((rule, index) => {
    const selected = composition.breakpoints[index];
    if (
      selected.breakpoint !== rule.breakpoint ||
      selected.viewport !== rule.viewport ||
      selected.orderAlternativeId !== rule.orderAlternativeId ||
      selected.ruleFingerprint !== canonicalValueFingerprint(rule)
    )
      fail(`responsive rule mismatch at ${rule.breakpoint}`);
    const order = structural.orderAlternatives.find(
      (entry) => entry.id === selected.orderAlternativeId,
    );
    if (!order) fail("unregistered order alternative");
    resolve({
      ...context,
      kind: "breakpoint",
      realizationId: selected.orderAlternativeId,
      rule,
      order,
    });
    relations(selected.relationshipRealizations, rule);
  });
  if (composition.orderAlternativeId !== composition.breakpoints[3].orderAlternativeId)
    fail("global order must equal wide order");
  return composition as AcceptedCompiledPageBlueprintCompositionV1;
}
export function validateCompiledPageBlueprintComposition(
  input: unknown,
  authority: PageBlueprintCompositionAuthority,
): AcceptedCompiledPageBlueprintCompositionV1 {
  return bounded(() => validate(input, authority));
}
export function compileSelectedPageBlueprintComposition(
  selection: Omit<
    CompiledPageBlueprintCompositionMaterialV1,
    "blueprint" | "support" | "bindingFingerprint"
  >,
  authority: PageBlueprintCompositionAuthority,
): AcceptedCompiledPageBlueprintCompositionV1 {
  return bounded(() => {
    const { candidate, bindingFingerprint } = checkedAuthority(authority);
    return validate(
      createCompiledPageBlueprintCompositionV1({
        ...selection,
        blueprint: {
          contractVersion: "2.0.0",
          blueprintId: candidate.structural.id,
          blueprintVersion: candidate.structural.version,
          candidateFingerprint: candidate.candidateFingerprint,
        },
        support: {
          id: authority.support.id,
          version: authority.support.version,
          implementationFingerprint: authority.support.implementationFingerprint,
        },
        bindingFingerprint,
      }),
      authority,
    );
  });
}
