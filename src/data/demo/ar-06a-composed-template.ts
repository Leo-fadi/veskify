"use client";

import { createElement, type ReactElement } from "react";
import {
  createComposedStorefrontCandidate,
  type StorefrontCompositionAuthorityResolver,
} from "@/application/storefront-templates/bind-storefront-composition";
import { createPageBlueprintV2CandidateAuthority } from "@/application/storefront-templates/page-blueprint-v2-candidate-authority";
import { createPageBlueprintV2RegionRelationshipKey } from "@/application/storefront-templates/page-blueprint-v2-contract";
import { renderComposedStorefrontPage } from "@/components/storefront/composed-storefront-page";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { applyCommercialSharedFrame } from "@/domain/storefront/commercial-shared-frame";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
} from "@/domain/storefront/canonical-storefront";
import { composedPageRealizationSupport } from "@/components/storefront/composed-page-realization";

export type Ar06aCompositionLayout = "stack" | "offset";
export type Ar06aLocale = "en" | "fi";

const regionSpecs = [
  ["orientation", "orientation", ["section_home_hero"]],
  ["primary-discovery", "primary-discovery", ["section_home_categories", "section_home_products"]],
  ["campaign", "campaign", ["section_home_campaign"]],
  ["brand-story", "brand-story", ["section_home_story"]],
  ["trust", "trust", ["section_home_benefits"]],
  ["continuation", "continuation", ["section_home_newsletter"]],
] as const;

const relationship = (
  sourceRegionId: string,
  relationshipKind: "precedes" | "pairs-with" | "offsets",
  targetRegionId: string,
) => ({
  sourceRegionId,
  relationshipKind,
  targetRegionId,
});

function candidateFor(layout: Ar06aCompositionLayout) {
  const ids = regionSpecs.map(([id]) => id);
  const precedes = ids
    .slice(0, -1)
    .map((id, index) => relationship(id, "precedes", ids[index + 1]));
  const paired = relationship("orientation", "pairs-with", "primary-discovery");
  const offset = relationship("orientation", "offsets", "primary-discovery");
  const relationships = layout === "offset" ? [...precedes, paired, offset] : precedes;
  const orderIds = layout === "offset" ? ["pair-stack", "pair-columns"] : ["section-flow"];
  const breakpointRules = [
    ["mobile", 375, layout === "offset" ? "pair-stack" : "section-flow"],
    ["tablet", 768, layout === "offset" ? "pair-stack" : "section-flow"],
    ["desktop", 1024, layout === "offset" ? "pair-columns" : "section-flow"],
    ["wide", 1440, layout === "offset" ? "pair-columns" : "section-flow"],
  ] as const;
  return createPageBlueprintV2CandidateAuthority({
    candidateSchemaVersion: "1.0.0",
    structural: {
      id: `ar06a-home-${layout}`,
      version: "1.0.0",
      pageFamilyId: "home",
      regions: regionSpecs.map(([id, role, sections]) => ({
        id,
        role,
        requirement: "required",
        cardinality: { minimum: 1, ideal: sections.length, maximum: sections.length },
        visualWeight: "medium",
      })),
      relationships,
      orderAlternatives: orderIds.map((id) => ({ id, regionIds: ids })),
      defaultOrderAlternativeId: orderIds[0],
    },
    assetRoleCompatibility: {
      contractSchemaVersion: "1.0.0",
      blueprintId: `ar06a-home-${layout}`,
      blueprintVersion: "1.0.0",
      regionAssetRequirements: [],
    },
    responsiveRules: {
      contractSchemaVersion: "1.0.0",
      blueprintId: `ar06a-home-${layout}`,
      blueprintVersion: "1.0.0",
      breakpointRules: breakpointRules.map(([breakpoint, viewport, orderAlternativeId]) => ({
        breakpoint,
        viewport,
        orderAlternativeId,
        regionProportionRules: ids.map((regionId) => ({ regionId, proportionMode: "preserve" })),
        relationshipTransformations: relationships.map((entry) => ({
          relationshipKey: createPageBlueprintV2RegionRelationshipKey(entry),
          transformation:
            entry.relationshipKind === "pairs-with"
              ? breakpoint === "mobile" || breakpoint === "tablet"
                ? "stack"
                : "preserve"
              : entry.relationshipKind === "offsets"
                ? breakpoint === "mobile" || breakpoint === "tablet"
                  ? "remove-offset"
                  : "preserve"
                : "preserve",
        })),
      })),
    },
    omissionSubstitutionFallback: {
      contractSchemaVersion: "1.0.0",
      blueprintId: `ar06a-home-${layout}`,
      blueprintVersion: "1.0.0",
      blueprintSubstitutionCandidates: [],
      regionFallbackRules: [],
    },
  });
}

function authorityFor(layout: Ar06aCompositionLayout): StorefrontCompositionAuthorityResolver {
  const candidate = candidateFor(layout);
  const evidence = {
    blueprintId: candidate.structural.id,
    blueprintVersion: candidate.structural.version,
    exactCandidateFingerprint: candidate.candidateFingerprint,
    requiredRoleCapacities: [],
  };
  return () => ({
    candidate,
    componentDefinitions: veskifyComponentDefinitionsV2,
    support: composedPageRealizationSupport,
    requiredAssetRoleCapacityEvidence: evidence,
  });
}

export function createAr06aComposedTemplate(layout: Ar06aCompositionLayout) {
  const base = applyCommercialSharedFrame(
    structuredClone(aurumNordicSeed.draftSnapshot),
    "centered-minimal",
  );
  const home = base.pages.find((page) => page.type === "home");
  if (!home) throw new Error("AR-06A fixture requires the canonical home page.");
  const candidate = candidateFor(layout);
  const relationships = candidate.structural.relationships;
  const resolver = authorityFor(layout);
  const composition = createComposedStorefrontCandidate(
    base,
    {
      expectedBase: {
        id: base.id,
        revision: base.revision,
        contentFingerprint: canonicalStorefrontContentFingerprint(base),
      },
      successor: {
        id: `${base.id}_ar06a_${layout}`,
        revision: base.revision + 1,
        projectId: base.projectId,
        catalogueRef: base.catalogueRef,
        createdAt: "2026-09-16T09:00:00+03:00",
        createdBy: "system",
      },
      assignments: [
        {
          selection: {
            compositionVersion: "1.0.0",
            owner: { kind: "static-page", id: home.id },
            orderAlternativeId: layout === "offset" ? "pair-columns" : "section-flow",
            regionAssignments: regionSpecs.map(([regionId, , sections]) => ({
              regionId,
              realizationId: "section-flow",
              units: sections.map((sectionId) => ({ kind: "section" as const, sectionId })),
            })),
            relationshipRealizations: relationships.map((entry) => ({
              relationshipKey: createPageBlueprintV2RegionRelationshipKey(entry),
              realizationId:
                entry.relationshipKind === "pairs-with"
                  ? "pair-columns"
                  : entry.relationshipKind === "offsets"
                    ? "offset-block-start"
                    : "precedes-preserve",
            })),
            breakpoints: candidate.responsiveRules.breakpointRules.map((rule) => ({
              breakpoint: rule.breakpoint,
              viewport: rule.viewport,
              orderAlternativeId: rule.orderAlternativeId,
              ruleFingerprint: canonicalValueFingerprint(rule),
              relationshipRealizations: rule.relationshipTransformations.map((entry) => ({
                relationshipKey: entry.relationshipKey,
                realizationId:
                  entry.transformation === "stack"
                    ? "pair-stack"
                    : entry.transformation === "remove-offset"
                      ? "offset-none"
                      : entry.relationshipKey.includes("pairs-with")
                        ? "pair-columns"
                        : entry.relationshipKey.includes("offsets")
                          ? "offset-block-start"
                          : "precedes-preserve",
              })),
            })),
            omissions: [],
          },
        },
      ],
    },
    resolver,
  );
  const composedHome = composition.pages.find((page) => page.id === home.id)!;
  if (!("composition" in composedHome)) throw new Error("Fixture composition was not bound.");
  const identities = Object.freeze({
    content: canonicalStorefrontContentFingerprint(base),
    brand: canonicalValueFingerprint(base.brandSystem),
    catalogue: canonicalValueFingerprint(aurumNordicSeed.catalogue),
    // Includes every retained section/brand/catalogue media reference, not a
    // fabricated screenshot descriptor or a second persisted content inventory.
    contentMedia: canonicalValueFingerprint({
      pages: base.pages,
      brand: base.brandSystem,
      catalogue: aurumNordicSeed.catalogue,
    }),
    composition: canonicalValueFingerprint(composedHome.composition),
    candidate: candidate.candidateFingerprint,
    support: composedPageRealizationSupport.implementationFingerprint,
  });
  return Object.freeze({
    snapshot: composition,
    catalogue: aurumNordicSeed.catalogue,
    resolver,
    homeId: home.id,
    identities,
  });
}

export function Ar06aComposedTemplatePreview({
  layout,
  locale,
}: Readonly<{ layout: Ar06aCompositionLayout; locale: Ar06aLocale }>): ReactElement {
  const fixture = createAr06aComposedTemplate(layout);
  return createElement(
    "div",
    {
      "data-ar06a-ready": "true",
      "data-ar06a-layout": layout,
      "data-active-locale": locale,
      ...Object.fromEntries(
        Object.entries(fixture.identities).map(([key, value]) => [
          `data-identity-${key.toLowerCase()}`,
          value,
        ]),
      ),
    },
    renderComposedStorefrontPage({
      snapshot: fixture.snapshot,
      pageId: fixture.homeId,
      catalogue: fixture.catalogue,
      activeLocale: locale,
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      resolveAuthority: fixture.resolver,
    }),
  );
}
