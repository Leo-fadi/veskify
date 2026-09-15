import {
  createPageBlueprintV2CandidateAuthority,
  type PageBlueprintV2CandidateAuthorityV1,
} from "@/application/storefront-templates/page-blueprint-v2-candidate-authority";
import {
  createPageBlueprintV2RegionRelationshipKey,
  type PageBlueprintV2RegionRelationshipKind,
  type PageBlueprintV2Region,
} from "@/application/storefront-templates/page-blueprint-v2-contract";
import { pageBlueprintV2ResponsiveRelationshipTransformationPolicy } from "@/application/storefront-templates/page-blueprint-v2-responsive-rule-contract";
import type {
  PageBlueprintCompositionAuthority,
  PageBlueprintCompositionRealizationRequest,
} from "@/application/storefront-templates/validate-page-blueprint-composition";
import type { PageBlueprintCompositionSelection } from "@/application/storefront-templates/compile-page-blueprint-composition";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { canonicalValueFingerprint } from "@/domain/storefront/canonical-storefront";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

const breakpoints = [
  ["mobile", 375],
  ["tablet", 768],
  ["desktop", 1024],
  ["wide", 1440],
] as const;
type Family = "home" | "collection" | "search" | "product-detail";
type Role = PageBlueprintV2Region["role"];
export function ar05aSupport(request: PageBlueprintCompositionRealizationRequest): boolean {
  if (
    !request.candidate.candidateFingerprint ||
    !request.bindingFingerprint ||
    !request.owner.id ||
    !Object.isFrozen(request)
  )
    return false;
  switch (request.kind) {
    case "region":
      return (
        request.realizationId === `whole-${request.region.id}` &&
        request.units.every((unit) => unit.visible && unit.definition.type === unit.component)
      );
    case "relationship":
      return (
        request.realizationId ===
        `relation-${request.relationship.relationshipKind}-${request.transformation}`
      );
    case "breakpoint":
      return (
        request.realizationId === request.rule.orderAlternativeId &&
        request.order.id === request.rule.orderAlternativeId &&
        request.order.regionIds.length === request.rule.regionProportionRules.length
      );
  }
}
export function ar05aFixture(
  options: {
    family?: Family;
    dynamic?: boolean;
    omission?: boolean;
    relationship?: PageBlueprintV2RegionRelationshipKind;
  } = {},
) {
  const family = options.family ?? "home";
  const pageType =
    family === "product-detail" ? "product" : family === "search" ? "collection" : family;
  const page = structuredClone(
    aurumNordicSeed.draftSnapshot.pages.find((entry) => entry.type === pageType)!,
  );
  const dynamic = p10b16p01DynamicCommerceAggregate().snapshots[1].dynamicCommercePresentation!;
  const owner: PageBlueprintCompositionAuthority["owner"] = !options.dynamic
    ? { kind: "static-page", page }
    : family === "product-detail"
      ? { kind: "product-detail-archetype", archetype: dynamic.productDetailArchetypes[0] }
      : {
          kind: "collection-search-archetype",
          archetype: dynamic.collectionSearchArchetypes[0],
          context: family === "search" ? "search" : "collection",
        };
  const roleByComponent: Record<string, Role> = {
    header: "orientation",
    hero: "orientation",
    collectionHeader: "orientation",
    filterBar: "primary-discovery",
    productGrid: "primary-discovery",
    productGallery: "product-focus",
    productInfo: "product-focus",
    productOptions: "conversion",
    footer: "continuation",
    relatedProducts: "continuation",
    imageText: "brand-story",
    benefitIcons: "trust",
    collectionGrid: "primary-discovery",
    newsletter: "continuation",
  };
  const groups = new Map<
    Role,
    PageBlueprintCompositionSelection["regionAssignments"][number]["units"]
  >();
  if (options.dynamic) {
    groups.set(family === "product-detail" ? "product-focus" : "orientation", [
      {
        kind: "presentation",
        slotId:
          family === "product-detail"
            ? dynamic.productDetailArchetypes[0].componentPresentations[0].slotId
            : dynamic.collectionSearchArchetypes[0].componentPresentations[0].slotId,
      },
    ]);
    groups.set(family === "product-detail" ? "conversion" : "primary-discovery", []);
  } else {
    for (const section of page.sections.filter((entry) => entry.visible)) {
      const definition = veskifyComponentDefinitionsV2.find(
        (entry) => entry.type === section.component,
      )!;
      const role =
        roleByComponent[section.component] ??
        definition.designCompatibility.allowedNarrativeRoles[0];
      if (!definition.designCompatibility.allowedNarrativeRoles.includes(role))
        throw new Error("Fixture role is not canonical component capability");
      groups.set(role, [...(groups.get(role) ?? []), { kind: "section", sectionId: section.id }]);
    }
  }
  const regions: PageBlueprintV2Region[] = [...groups].map(([role, units]) => ({
    id: role,
    role,
    requirement: "required",
    cardinality: { minimum: 1, ideal: Math.max(1, units.length), maximum: 32 },
    visualWeight: "medium",
  }));
  if (options.omission)
    regions.push({
      id: "asset-region",
      role: "brand-story",
      requirement: "optional",
      cardinality: { minimum: 0, ideal: 1, maximum: 1 },
      visualWeight: "medium",
    });
  const relationshipKind = options.relationship ?? "precedes";
  const relation = {
    sourceRegionId: regions[0].id,
    targetRegionId: regions[1].id,
    relationshipKind,
  };
  const transformation =
    pageBlueprintV2ResponsiveRelationshipTransformationPolicy[relationshipKind].at(-1)!;
  const candidate = createPageBlueprintV2CandidateAuthority({
    candidateSchemaVersion: "1.0.0",
    structural: {
      id: `ar05a-${family}`,
      version: "1.0.0",
      pageFamilyId: family,
      regions,
      relationships: [relation],
      orderAlternatives: [{ id: "default-order", regionIds: regions.map((entry) => entry.id) }],
      defaultOrderAlternativeId: "default-order",
    },
    assetRoleCompatibility: {
      contractSchemaVersion: "1.0.0",
      blueprintId: `ar05a-${family}`,
      blueprintVersion: "1.0.0",
      regionAssetRequirements: options.omission
        ? [
            {
              regionId: "asset-region",
              roleRequirements: ["editorialImage", "heroDesktop"].map((role) => ({
                role,
                requirement: "required",
                cardinality: { minimum: 1, ideal: 1, maximum: 2 },
              })),
            },
          ]
        : [],
    },
    responsiveRules: {
      contractSchemaVersion: "1.0.0",
      blueprintId: `ar05a-${family}`,
      blueprintVersion: "1.0.0",
      breakpointRules: breakpoints.map(([breakpoint, viewport]) => ({
        breakpoint,
        viewport,
        orderAlternativeId: "default-order",
        regionProportionRules: regions.map((entry) => ({
          regionId: entry.id,
          proportionMode: "preserve",
        })),
        relationshipTransformations: [
          {
            relationshipKey: createPageBlueprintV2RegionRelationshipKey(relation),
            transformation: breakpoint === "mobile" ? transformation : "preserve",
          },
        ],
      })),
    },
    omissionSubstitutionFallback: {
      contractSchemaVersion: "1.0.0",
      blueprintId: `ar05a-${family}`,
      blueprintVersion: "1.0.0",
      blueprintSubstitutionCandidates: [],
      regionFallbackRules: options.omission
        ? [
            {
              regionId: "asset-region",
              trigger: "required-asset-role-cardinality-unsatisfied",
              terminalResolution: "omit-region",
            },
          ]
        : [],
    },
  });
  // Actual legacy page has no approved editorial/hero placements for the optional region.
  // Capacity is derived from canonical placements, never the candidate's expected result.
  const availableApprovedAssets = page.sections.flatMap(
    (section) => section.approvedAssetPlacements ?? [],
  );
  const evidence = {
    blueprintId: candidate.structural.id,
    blueprintVersion: candidate.structural.version,
    exactCandidateFingerprint: candidate.candidateFingerprint,
    requiredRoleCapacities: candidate.assetRoleCompatibility.regionAssetRequirements.flatMap(
      ({ regionId, roleRequirements }) =>
        roleRequirements.map(({ role }) => ({
          regionId,
          role,
          satisfiableMinimumCapacity: availableApprovedAssets.filter((asset) => asset.role === role)
            .length,
        })),
    ),
  };
  evidence.requiredRoleCapacities.sort((a, b) => (a.role < b.role ? -1 : a.role > b.role ? 1 : 0));
  const authority: PageBlueprintCompositionAuthority = {
    owner,
    candidate,
    componentDefinitions: veskifyComponentDefinitionsV2,
    requiredAssetRoleCapacityEvidence: evidence,
    support: {
      id: "ar05a-test-support",
      version: "1.0.0",
      implementationFingerprint: "ar05a-test-support-fingerprint",
      resolve: ar05aSupport,
    },
  };
  const omissions = options.omission
    ? [{ regionId: "asset-region", evidenceFingerprint: canonicalValueFingerprint(evidence) }]
    : [];
  const selection: PageBlueprintCompositionSelection = {
    compositionVersion: "1.0.0",
    owner: {
      kind: owner.kind,
      id:
        owner.kind === "static-page"
          ? page.id
          : family === "product-detail"
            ? dynamic.productDetailArchetypes[0].id
            : dynamic.collectionSearchArchetypes[0].id,
    },
    orderAlternativeId: "default-order",
    regionAssignments: [...groups].map(([role, units]) => ({
      regionId: role,
      realizationId: `whole-${role}`,
      units,
    })),
    relationshipRealizations: [
      {
        relationshipKey: createPageBlueprintV2RegionRelationshipKey(relation),
        realizationId: `relation-${relationshipKind}-preserve`,
      },
    ],
    breakpoints: candidate.responsiveRules.breakpointRules.map((rule) => ({
      breakpoint: rule.breakpoint,
      viewport: rule.viewport,
      orderAlternativeId: rule.orderAlternativeId,
      ruleFingerprint: canonicalValueFingerprint({
        ...rule,
        regionProportionRules: rule.regionProportionRules.filter(
          (entry) => !omissions.some((omission) => omission.regionId === entry.regionId),
        ),
      }),
      relationshipRealizations: rule.relationshipTransformations.map((entry) => ({
        relationshipKey: entry.relationshipKey,
        realizationId: `relation-${relationshipKind}-${entry.transformation}`,
      })),
    })),
    omissions,
  };
  return { authority, selection, candidate, evidence, page, dynamic, availableApprovedAssets };
}
export function ar05aReplaceCandidate(
  fixture: ReturnType<typeof ar05aFixture>,
  replacement: PageBlueprintV2CandidateAuthorityV1,
) {
  fixture.authority = {
    ...fixture.authority,
    candidate: replacement,
    requiredAssetRoleCapacityEvidence: {
      ...fixture.evidence,
      exactCandidateFingerprint: replacement.candidateFingerprint,
    },
  };
}
