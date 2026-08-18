import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  commercialHomepageProfileIds,
  getCommercialHomepageProfile,
  listCommercialHomepageProfiles,
  materializeExecutablePageBlueprint,
  resolveCommercialHomepageProfileSlots,
  resolveCommercialHomepageSlotItemLimit,
  validateCommercialHomepageProfileLibrary,
} from "@/application/storefront-templates";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import {
  compileWholeStorefrontProposal,
  materializeWholeStorefrontRuntimeSnapshot,
} from "@/application/whole-storefront-proposal-lifecycle";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import { createApprovedGenerationAssetContextFingerprint } from "@/application/ai-storefront-generation";
import { createStorefrontRenderContext } from "@/components/registry";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  applyCommercialSharedFrame,
  canonicalStorefrontContentFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";

const directionByProfile = {
  "homepage-editorial-storytelling": "premiumEditorial",
  "homepage-commerce-led-discovery": "modernTechnical",
  "homepage-minimal-brand-commerce": "warmApproachable",
  "homepage-campaign-led": "premiumEditorial",
  "homepage-collection-gateway": "modernTechnical",
  "homepage-high-consideration": "warmApproachable",
} as const;

function currentProfile(profileId: (typeof commercialHomepageProfileIds)[number]) {
  const profile = getCommercialHomepageProfile(profileId);
  if (!profile?.profile?.commercialHomepage) throw new Error(`Missing profile ${profileId}.`);
  return profile;
}

function fixtureFor(profileId: (typeof commercialHomepageProfileIds)[number]) {
  const directionId = directionByProfile[profileId];
  const fixture = createP905aFreshMerchantFixture(directionId);
  const profile = currentProfile(profileId);
  const authority = profile.profile!.commercialHomepage!;
  const draft = applyCommercialSharedFrame(
    fixture.planningInput.draft,
    authority.defaultSharedFrameProfileId,
  );
  const planningInput = { ...fixture.planningInput, draft };
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId,
    homepageProfileId: profileId,
  });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const snapshot = materializeWholeStorefrontRuntimeSnapshot({
    runtime: proposal.proposedStorefront,
    planningInput,
    approvedAssetPresentations: fixture.assetPresentations,
  });
  return { fixture, plan, profile, proposal, snapshot };
}

describe("P10B-09 commercial homepage profile library", () => {
  it("registers six stable executable profile identities with materially distinct structures", () => {
    const profiles = listCommercialHomepageProfiles();
    expect(profiles).toHaveLength(6);
    expect(profiles.map((entry) => entry.profile!.id)).toEqual(commercialHomepageProfileIds);
    expect(
      new Set(profiles.map((entry) => entry.profile!.commercialHomepage!.structuralSignature)).size,
    ).toBe(6);
    expect(
      new Set(profiles.map((entry) => entry.profile!.commercialHomepage!.structuralFingerprint))
        .size,
    ).toBe(6);
    expect(profiles.every((entry) => entry.profile!.version === "1.0.0")).toBe(true);
  });

  it("materializes every profile through the existing executable PageBlueprint authority", () => {
    for (const profileId of commercialHomepageProfileIds) {
      const pagePlan = currentProfile(profileId);
      const materialization = materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: [
          "navigation",
          "projectBrandContext",
          "collectionList",
          "productList",
        ],
      });
      expect(materialization.profileId).toBe(profileId);
      expect(materialization.commercialHomepage?.structuralFingerprint).toBe(
        pagePlan.profile!.commercialHomepage!.structuralFingerprint,
      );
    }
  });

  it("rejects exact and shallow duplicates independently of colour choices", () => {
    const profiles = listCommercialHomepageProfiles();
    expect(() => validateCommercialHomepageProfileLibrary([...profiles, profiles[0]])).toThrow(
      /IDs must be unique|unique material structures/,
    );
    const shallow = structuredClone(profiles[0]);
    shallow.profile!.id = "homepage-shallow-copy";
    shallow.profile!.commercialHomepage!.structuralFingerprint = "homepage-profile-shallow-copy";
    expect(() =>
      validateCommercialHomepageProfileLibrary([...profiles.slice(0, 5), shallow]),
    ).toThrow(/shallow near-duplicates|unique material structures/);
    const colourOnly = structuredClone(profiles[0]);
    expect(colourOnly.profile!.commercialHomepage!.structuralSignature).toBe(
      profiles[0].profile!.commercialHomepage!.structuralSignature,
    );
  });

  it("rejects stale structural, narrative, responsive, card and cardinality authority", () => {
    const profiles = listCommercialHomepageProfiles();
    const replaceFirst = (replacement: (typeof profiles)[number]) => [
      replacement,
      ...profiles.slice(1),
    ];

    const unsupportedResponsive = structuredClone(profiles[0]);
    unsupportedResponsive.profile!.commercialHomepage!.responsiveArchitecture[0].transformationIds =
      ["unknownResponsiveTransformation"];
    expect(() =>
      validateCommercialHomepageProfileLibrary(replaceFirst(unsupportedResponsive)),
    ).toThrow(/responsive transformation .* unavailable/);

    const unsupportedBreakpoint = structuredClone(profiles[0]);
    unsupportedBreakpoint.profile!.commercialHomepage!.responsiveArchitecture[2].transformationIds =
      ["splitToStack"];
    expect(() =>
      validateCommercialHomepageProfileLibrary(replaceFirst(unsupportedBreakpoint)),
    ).toThrow(/splitToStack is not registered for desktop/);

    const incompatibleNarrative = structuredClone(profiles[0]);
    incompatibleNarrative.slots[0].narrativeRole = "primary-discovery";
    expect(() =>
      validateCommercialHomepageProfileLibrary(replaceFirst(incompatibleNarrative)),
    ).toThrow(/narrative role .* incompatible/);

    const invalidCard = structuredClone(profiles[0]);
    Reflect.set(invalidCard.profile!.commercialHomepage!, "productCardAnatomyId", "legacy-grid");
    expect(() => validateCommercialHomepageProfileLibrary(replaceFirst(invalidCard))).toThrow();

    const invalidCardinality = structuredClone(profiles[0]);
    invalidCardinality.profile!.commercialHomepage!.contentCardinality[0].slotId = "missing-slot";
    expect(() =>
      validateCommercialHomepageProfileLibrary(replaceFirst(invalidCardinality)),
    ).toThrow(/cardinality is invalid/);

    const staleFingerprint = structuredClone(profiles[0]);
    staleFingerprint.profile!.commercialHomepage!.merchandisingEmphasis = "product-discovery";
    expect(() => validateCommercialHomepageProfileLibrary(replaceFirst(staleFingerprint))).toThrow(
      /stale structural authority/,
    );
  });

  it("omits unsupported optional evidence cleanly and fails required roles closed", () => {
    const sparse = resolveCommercialHomepageProfileSlots("homepage-editorial-storytelling", {
      canonicalCommerce: true,
      canonicalProductCount: 2,
      canonicalCollectionCount: 1,
      approvedMerchantEvidence: false,
      approvedMediaSlotIds: [],
    });
    expect(sparse.omittedSlotIds).toEqual(["brand-story", "approved-proof"]);
    expect(sparse.includedSlotIds).toEqual(["hero", "curated-products", "continuation"]);
    expect(() =>
      resolveCommercialHomepageProfileSlots("homepage-campaign-led", {
        canonicalCommerce: true,
        canonicalProductCount: 2,
        canonicalCollectionCount: 1,
        approvedMerchantEvidence: false,
        approvedMediaSlotIds: [],
      }),
    ).toThrow(/hero lacks required approved authority/);
    expect(() =>
      resolveCommercialHomepageProfileSlots("homepage-collection-gateway", {
        canonicalCommerce: false,
        canonicalProductCount: 0,
        canonicalCollectionCount: 0,
        approvedMerchantEvidence: true,
        approvedMediaSlotIds: [],
      }),
    ).toThrow(/featured-collections lacks required approved authority/);
    expect(() =>
      resolveCommercialHomepageProfileSlots("homepage-commerce-led-discovery", {
        canonicalCommerce: true,
        canonicalProductCount: 1,
        canonicalCollectionCount: 1,
        approvedMerchantEvidence: true,
        approvedMediaSlotIds: [],
      }),
    ).toThrow(/product-discovery requires at least 2 products/);
    expect(
      resolveCommercialHomepageSlotItemLimit(
        "homepage-commerce-led-discovery",
        "product-discovery",
        "products",
        30,
      ),
    ).toBe(12);
  });

  it("fails required media per slot and repairs undersized preserved commerce canonically", () => {
    const campaignFixture = createP905aFreshMerchantFixture("premiumEditorial");
    const campaignProfile = currentProfile("homepage-campaign-led");
    const campaignDraft = applyCommercialSharedFrame(
      campaignFixture.planningInput.draft,
      campaignProfile.profile!.commercialHomepage!.defaultSharedFrameProfileId,
    );
    const currentAssetContext = campaignFixture.planningInput.approvedAssetContext;
    const unsupportedHomepageAssets = currentAssetContext.assets.map((asset) => ({
      ...asset,
      role: "logo" as const,
    }));
    const unsupportedHomepageContext = {
      ...currentAssetContext,
      assets: unsupportedHomepageAssets,
      fingerprint: createApprovedGenerationAssetContextFingerprint({
        ...currentAssetContext,
        assets: unsupportedHomepageAssets,
      }),
    };
    expect(() =>
      createWholeStorefrontGenerationPlan(
        {
          ...campaignFixture.planningInput,
          draft: campaignDraft,
          approvedAssetContext: unsupportedHomepageContext,
        },
        { directionId: "premiumEditorial", homepageProfileId: "homepage-campaign-led" },
      ),
    ).toThrow(/hero lacks required approved authority/);

    const commerceFixture = createP905aFreshMerchantFixture("modernTechnical");
    const commerceDraft = structuredClone(commerceFixture.planningInput.draft);
    const homepage = commerceDraft.pages.find((page) => page.type === "home")!;
    const productSection = homepage.sections.find(
      (section) => section.component === "productGrid",
    )!;
    productSection.content.productIds = [commerceFixture.planningInput.catalogue.products[0].id];
    const framedCommerceDraft = applyCommercialSharedFrame(commerceDraft, "commerce-utility");
    const plan = createWholeStorefrontGenerationPlan(
      { ...commerceFixture.planningInput, draft: framedCommerceDraft },
      {
        directionId: "modernTechnical",
        homepageProfileId: "homepage-commerce-led-discovery",
      },
    );
    const productPlan = plan.pagePlans
      .find((page) => page.role === "homepage")!
      .components.find(
        (component) =>
          "instance" in component && component.instance.component === "homepageFeaturedProducts",
      );
    if (!productPlan || !("instance" in productPlan)) throw new Error("Missing product plan.");
    const productBinding = productPlan.instance.bindings.find(
      (binding) => binding.source === "productList",
    );
    if (!productBinding || productBinding.source !== "productList") {
      throw new Error("Missing canonical product-list binding.");
    }
    expect(productBinding.productIds).toEqual(
      commerceFixture.planningInput.catalogue.products.map((product) => product.id),
    );
  });

  it("fails stale, component-incompatible, frame-incompatible and Design-DNA-broadening inputs", () => {
    const stale = structuredClone(currentProfile("homepage-minimal-brand-commerce"));
    stale.profile!.version = "2.0.0";
    expect(() =>
      materializeExecutablePageBlueprint({
        pagePlan: stale,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: [
          "navigation",
          "projectBrandContext",
          "collectionList",
          "productList",
        ],
      }),
    ).toThrow(/unsupported/);
    const missingHero = veskifyComponentDefinitionsV2.filter(
      (definition) => definition.type !== "homepageHero",
    );
    expect(() =>
      materializeExecutablePageBlueprint({
        pagePlan: currentProfile("homepage-minimal-brand-commerce"),
        componentDefinitions: missingHero,
        availableBindingCategories: [
          "navigation",
          "projectBrandContext",
          "collectionList",
          "productList",
        ],
      }),
    ).toThrow(/cannot materialize hero/);

    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    const wrongFrameDraft = applyCommercialSharedFrame(
      fixture.planningInput.draft,
      "compact-technical",
    );
    expect(() =>
      createWholeStorefrontGenerationPlan(
        { ...fixture.planningInput, draft: wrongFrameDraft },
        {
          directionId: "premiumEditorial",
          homepageProfileId: "homepage-editorial-storytelling",
        },
      ),
    ).toThrow(/incompatible with shared frame/);
    const minimalProfile = currentProfile("homepage-minimal-brand-commerce");
    const minimalDraft = applyCommercialSharedFrame(
      fixture.planningInput.draft,
      minimalProfile.profile!.commercialHomepage!.defaultSharedFrameProfileId,
    );
    expect(() =>
      createWholeStorefrontGenerationPlan(
        { ...fixture.planningInput, draft: minimalDraft },
        {
          directionId: "premiumEditorial",
          homepageProfileId: "homepage-minimal-brand-commerce",
        },
      ),
    ).toThrow(/cannot broaden the selected Design DNA/);
  });

  it("bounds rich catalogue selections without duplicating filler commerce", () => {
    const fixture = createP905aFreshMerchantFixture("modernTechnical");
    const planningInput = structuredClone(fixture.planningInput);
    const sourceProduct = planningInput.catalogue.products[0];
    for (let index = 0; index < 18; index += 1) {
      planningInput.catalogue.products.push({
        ...structuredClone(sourceProduct),
        id: `product_rich_${index}`,
        sku: `RICH-${index}`,
        title: { en: `Rich product ${index}`, fi: `Runsas tuote ${index}` },
        images: sourceProduct.images.map((image, imageIndex) => ({
          ...structuredClone(image),
          id: `media_rich_${index}_${imageIndex}`,
        })),
      });
    }
    const sourceCollection = planningInput.catalogue.collections[0];
    for (let index = 0; index < 9; index += 1) {
      planningInput.catalogue.collections.push({
        ...structuredClone(sourceCollection),
        id: `collection_rich_${index}`,
        slug: `rich-${index}`,
        title: { en: `Rich collection ${index}`, fi: `Runsas mallisto ${index}` },
      });
    }
    const homepage = planningInput.draft.pages.find((page) => page.type === "home")!;
    homepage.sections = homepage.sections.filter((section) =>
      ["header", "footer"].includes(section.component),
    );
    planningInput.draft = applyCommercialSharedFrame(planningInput.draft, "compact-technical");
    const plan = createWholeStorefrontGenerationPlan(planningInput, {
      directionId: "modernTechnical",
      homepageProfileId: "homepage-collection-gateway",
    });
    const homepageComponents = plan.pagePlans.find((page) => page.role === "homepage")!.components;
    const boundIds = (component: string, slotId: string) => {
      const selection = homepageComponents.find(
        (entry) => "instance" in entry && entry.instance.component === component,
      );
      if (!selection || !("instance" in selection)) throw new Error(`Missing ${component}.`);
      const binding = selection.instance.bindings.find((entry) => entry.slotId === slotId);
      if (!binding) throw new Error(`Missing ${slotId}.`);
      if (binding.source === "productList") return binding.productIds;
      if (binding.source === "collectionList") return binding.collectionIds;
      throw new Error(`Unexpected ${binding.source} authority for ${slotId}.`);
    };
    expect(boundIds("homepageFeaturedCollections", "collections")).toHaveLength(3);
    expect(boundIds("homepageCollectionNavigation", "collections")).toHaveLength(6);
    expect(boundIds("homepageFeaturedProducts", "products")).toHaveLength(4);
  });

  it("composes current P10B-07 storytelling and P10B-08 merchandising authority only", () => {
    for (const profile of listCommercialHomepageProfiles()) {
      const authority = profile.profile!.commercialHomepage!;
      expect(profile.slots.some((slot) => slot.sectionType === "homepageHero")).toBe(true);
      expect(
        profile.slots.some((slot) =>
          ["homepageEditorial", "homepagePromotion", "homepageProof", "homepageTrust"].includes(
            slot.sectionType,
          ),
        ),
      ).toBe(true);
      for (const slot of profile.slots.filter((entry) =>
        ["homepageHero", "homepageEditorial", "homepagePromotion", "homepageProof"].includes(
          entry.sectionType,
        ),
      )) {
        const capability = veskifyComponentCapabilityManifest.getByComponentType(slot.sectionType);
        expect(
          capability?.variants.find((variant) => variant.id === slot.defaultVariant)
            ?.structuralClassification,
        ).toBe("meaningfulStructuralVariant");
      }
      expect(authority.productCardAnatomyId).toMatch(
        /^(standard|editorial|compact|imageFirst|horizontal)$/,
      );
    }
  });

  it("plans, compiles, stores and renders all six through canonical lifecycle authority", () => {
    for (const profileId of commercialHomepageProfileIds) {
      const { fixture, plan, profile, snapshot } = fixtureFor(profileId);
      const homeMaterialization = plan.pageBlueprintMaterializations.find(
        (entry) => entry.pageType === "home",
      )!;
      expect(homeMaterialization.profileId).toBe(profileId);
      expect(snapshot.sharedFrame?.profileId).toBe(
        profile.profile!.commercialHomepage!.defaultSharedFrameProfileId,
      );
      const homepage = snapshot.pages.find((page) => page.type === "home")!;
      expect(
        homepage.sections
          .filter((section) => section.variant === "continuationCta")
          .map((section) => ({
            profileId,
            component: section.component,
            placements: section.approvedAssetPlacements ?? [],
            presentations: section.approvedAssetPresentations ?? [],
          })),
      ).toEqual([{ profileId, component: "homepageEditorial", placements: [], presentations: [] }]);
      const evidenceReferences = [
        {
          source: "merchant-approved" as const,
          authorityId: fixture.planningInput.brief.id,
          revision: String(fixture.planningInput.brief.revision),
          status: "approved" as const,
          approvalAuthorityId: fixture.planningInput.brief.approval.actorId!,
          approvalFingerprint: fixture.planningInput.brief.approvedEvidenceFingerprint!,
        },
      ];
      for (const renderTarget of ["editor", "preview", "published"] as const) {
        const context = createStorefrontRenderContext({
          activeLocale: "en",
          primaryLocale: "en",
          enabledLocales: ["en", "fi"],
          catalogue: fixture.aggregate.catalogue,
          snapshot,
          renderTarget,
          evidenceReferences,
        });
        const markup = renderToStaticMarkup(renderStorefrontPage(homepage, context));
        expect(markup).toContain('data-frame-profile="');
        expect(markup).toContain('data-component="homepageHero"');
        expect(markup).toContain(`data-render-target="${renderTarget}"`);
        expect(markup).toContain('data-region="section-heading"');
        expect(markup).toContain('data-region="product-grid"');
        expect(markup).toContain('data-surface="');
        expect(markup).toContain('data-card-context="homepageMerchandising"');
        expect(markup).toContain(
          `data-card-anatomy="${profile.profile!.commercialHomepage!.productCardAnatomyId}"`,
        );
      }
      expect(homepage.sections.some((section) => section.component === "productGrid")).toBe(false);
      const approvedAssetIds = new Set(fixture.assetContext.assets.map((asset) => asset.assetId));
      for (const section of homepage.sections) {
        for (const placement of section.approvedAssetPlacements ?? []) {
          expect(approvedAssetIds.has(placement.assetId)).toBe(true);
        }
        for (const presentation of section.approvedAssetPresentations ?? []) {
          expect(approvedAssetIds.has(presentation.assetId)).toBe(true);
        }
      }
      expect(storefrontSnapshotSchema.parse(structuredClone(snapshot))).toEqual(snapshot);
      expect(canonicalValueString(fixture.aggregate.catalogue)).toBe(
        canonicalValueString(fixture.planningInput.catalogue),
      );
    }
  });

  it("preserves all six through save/reload and deterministic publication", async () => {
    for (const profileId of commercialHomepageProfileIds) {
      const { fixture, snapshot } = fixtureFor(profileId);
      const repository = new InMemoryProjectRepository([fixture.aggregate]);
      await repository.saveDraft(snapshot.projectId, snapshot, {
        id: fixture.draft.id,
        revision: fixture.draft.revision,
      });
      const reloaded = await repository.get(snapshot.projectId);
      const draft = reloaded.snapshots.find(
        (entry) => entry.id === reloaded.project.draftSnapshotId,
      )!;
      expect(canonicalStorefrontContentFingerprint(draft)).toBe(
        canonicalStorefrontContentFingerprint(snapshot),
      );
      const currentEvidenceReferences = [
        {
          source: "merchant-approved" as const,
          authorityId: fixture.brief.id,
          revision: String(fixture.brief.revision),
          status: "approved" as const,
          approvalAuthorityId: fixture.brief.approval.actorId!,
          approvalFingerprint: fixture.brief.approvedEvidenceFingerprint!,
        },
      ];
      const publication = compileStorefrontPublication(
        createCurrentPublishCompilerInput({
          aggregate: reloaded,
          snapshot: draft,
          sourceAuthority: { kind: "manual" },
          currentEvidenceReferences,
        }),
      );
      expect(publication.result.sharedFrame.frame?.profileId).toBe(draft.sharedFrame?.profileId);
      expect(
        publication.result.pages
          .find((entry) => entry.page.type === "home")!
          .page.sections.map((section) => [section.component, section.variant]),
      ).toEqual(
        draft.pages
          .find((entry) => entry.type === "home")!
          .sections.map((section) => [section.component, section.variant]),
      );
    }
  });

  it("keeps existing P10A/P10B snapshots and legacy homepage profiles loadable without migration", () => {
    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    expect(storefrontSnapshotSchema.parse(structuredClone(fixture.draft))).toEqual(fixture.draft);
    const legacyPlan = createWholeStorefrontGenerationPlan(fixture.planningInput);
    const homeMaterialization = legacyPlan.pageBlueprintMaterializations.find(
      (entry) => entry.pageType === "home",
    )!;
    expect(homeMaterialization.commercialHomepage).toBeUndefined();
    expect(() =>
      compileWholeStorefrontProposal({ plan: legacyPlan, planningInput: fixture.planningInput }),
    ).not.toThrow();
  });
});
