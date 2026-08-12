import { describe, expect, it } from "vitest";
import { createPromptedStorefrontCapabilityAuthority } from "@/application/prompted-storefront-design-intent";
import {
  approveStorefrontDesignBrief,
  createStorefrontDesignBrief,
} from "@/application/source-discovery";
import { veskifyComponentCapabilityManifest } from "@/components/registry";
import { resolveBrandSystemDesignDna } from "@/domain/design-system";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

const now = "2026-08-12T08:00:00.000Z";

function capabilityAuthority() {
  const aggregate = p10b16p01DynamicCommerceAggregate();
  const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId);
  if (!draft) throw new Error("Missing current draft fixture.");
  const approvedBrief = approveStorefrontDesignBrief(
    createStorefrontDesignBrief({
      id: "brief_p10b_16p_02b_reachability",
      now,
      businessIdentity: {
        businessName: "Aurum Nordic",
        shortDescription: "A considered Nordic jewellery storefront.",
        industry: "jewellery",
        targetCustomer: "Design-conscious adults",
        primaryMarket: "Finland",
      },
      languagePlan: { selectedLanguages: ["fi", "en"], primaryLanguage: "en" },
      sourceReferenceIds: [],
      sourceEvidenceIds: [],
      materialEvidence: {
        sourceReferences: [],
        evidence: [],
        assetCandidates: [],
        reconciliation: null,
      },
      canonicalCommerceProjectionRef: aggregate.catalogue.id,
      pagePlan: { pageTypes: ["home", "collection", "product"] },
      approvedBrandDirection: {
        logoAssetRef: null,
        supportingImageAssetRefs: [],
        preferredBrandColours: ["#223344"],
        typographyDirection: "serif-led",
        visualStyleDirection: "editorial",
        imageryDirection: "studio",
        toneKeywords: ["warm"],
      },
      visualPriorities: ["Editorial hierarchy"],
      excludedClaims: ["No invented delivery promise"],
    }),
    { actorId: "merchant_p10b_16p_02b", approvedAt: now },
  );
  return {
    draft,
    authority: createPromptedStorefrontCapabilityAuthority({
      draft,
      catalogue: aggregate.catalogue,
      approvedBrief,
      approvedAssetContext: null,
    }),
  };
}

describe("P10B-16P-02B capability reachability truth", () => {
  it("advertises only values with an exact current canonical consumer as materially available", () => {
    const { draft, authority } = capabilityAuthority();
    const entries = new Map(
      authority.projection.capabilities.map((entry) => [entry.key, entry] as const),
    );

    expect(entries.get("design-dna.typography-scale.typography.scale.balanced")).toMatchObject({
      availability: "available",
    });
    expect(
      authority.referencesByPreferenceKey.get(
        "design-dna.typography-scale.typography.scale.balanced",
      ),
    ).toMatchObject({ authorityKind: "design-dna" });
    expect(entries.get("design-dna.typography-scale.typography.scale.expressive")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(entries.get("design-dna.typography-hierarchy.typography.role.display")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(entries.get("responsive.posture.responsive.transformation.carousel")).toMatchObject({
      availability: "registered-fail-closed",
    });
    expect(entries.get("homepage.narrative-role.narrative.role.introduction")).toMatchObject({
      availability: "registered-fail-closed",
    });

    const nonInstanceParameters = veskifyComponentCapabilityManifest.manifest.entries
      .flatMap(({ componentType, boundedParameters }) =>
        boundedParameters
          .filter(
            ({ authority: parameterAuthority }) => !parameterAuthority.instanceOverrideAllowed,
          )
          .map(({ id }) => `component.bounded-parameter.${componentType}.${id}`),
      )
      .filter((key) => entries.has(key));
    expect(nonInstanceParameters.length).toBeGreaterThan(0);
    expect(
      nonInstanceParameters.every(
        (key) => entries.get(key)?.availability === "registered-fail-closed",
      ),
    ).toBe(true);

    const dna = resolveBrandSystemDesignDna(draft.brandSystem);
    expect(entries.get(`responsive.image.ratio.${dna.media.ratio}`)).toMatchObject({
      availability: "available",
    });
    expect(entries.get(`responsive.crop.crop.${dna.media.crop}`)).toMatchObject({
      availability: "available",
    });
    expect(entries.get(`responsive.overlay.overlay.${dna.media.overlay}`)).toMatchObject({
      availability: "available",
    });
    expect(
      authority.projection.capabilities.some(
        ({ key, availability }) =>
          key.startsWith("responsive.image.ratio.") && availability === "evidence-dependent",
      ),
    ).toBe(true);
    expect(
      authority.projection.capabilities.find(
        ({ dimension }) => dimension === "collection-search.search-relationship",
      ),
    ).toMatchObject({ availability: "registered-fail-closed" });
  });
});
