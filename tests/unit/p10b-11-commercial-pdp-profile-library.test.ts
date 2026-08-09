import { describe, expect, it } from "vitest";
import {
  assertCommercialPdpEvidence,
  commercialPdpProfileIds,
  getCommercialPdpProfile,
  listCommercialPdpProfiles,
  materializeExecutablePageBlueprint,
  validateCommercialPdpProfileLibrary,
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
import {
  dynamicProductDetailDefinition,
  resolveDynamicProductDetailSupportingContent,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import { validateDynamicProductDetailRoutePresentation } from "@/components/storefront/dynamic-product-detail";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";
import {
  P9_05A_COMPLEX_PRODUCT_ID,
  P9_05A_SIMPLE_PRODUCT_ID,
  createP905aFreshMerchantFixture,
} from "@/data/demo/p9-05a-fresh-store-generation";
import {
  applyCommercialSharedFrame,
  canonicalStorefrontContentFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";

const directionByProfile = {
  "pdp-standard-commerce": "modernTechnical",
  "pdp-high-consideration": "premiumEditorial",
  "pdp-gallery-led": "premiumEditorial",
  "pdp-variant-led": "modernTechnical",
} as const;

function currentProfile(profileId: (typeof commercialPdpProfileIds)[number]) {
  const profile = getCommercialPdpProfile(profileId);
  if (!profile?.profile?.commercialProductDetail) {
    throw new Error(`Missing commercial PDP profile ${profileId}.`);
  }
  return profile;
}

function fixtureFor(
  profileId: (typeof commercialPdpProfileIds)[number],
  productId = P9_05A_COMPLEX_PRODUCT_ID,
) {
  const directionId = directionByProfile[profileId];
  const fixture = createP905aFreshMerchantFixture(directionId);
  const profile = currentProfile(profileId);
  const sourceDraft = structuredClone(fixture.planningInput.draft);
  const productPage = sourceDraft.pages.find((page) => page.type === "product");
  if (!productPage) throw new Error("Missing canonical product page.");
  productPage.sections
    .filter((section) =>
      ["productGallery", "productInfo", "productOptions"].includes(section.component),
    )
    .forEach((section) => {
      section.content.productId = productId;
    });
  const draft = applyCommercialSharedFrame(
    sourceDraft,
    profile.profile!.commercialProductDetail!.defaultSharedFrameProfileId,
  );
  const planningInput = { ...fixture.planningInput, draft };
  const plan = createWholeStorefrontGenerationPlan(planningInput, {
    directionId,
    pdpProfileId: profileId,
  });
  const proposal = compileWholeStorefrontProposal({ plan, planningInput });
  const snapshot = materializeWholeStorefrontRuntimeSnapshot({
    runtime: proposal.proposedStorefront,
    planningInput,
    approvedAssetPresentations: fixture.assetPresentations,
  });
  return { fixture, planningInput, plan, profile, proposal, snapshot };
}

function expectedEvidence(fixture: ReturnType<typeof createP905aFreshMerchantFixture>) {
  return [
    {
      source: "merchant-approved" as const,
      authorityId: fixture.brief.id,
      revision: String(fixture.brief.revision),
      status: "approved" as const,
      approvalAuthorityId: fixture.brief.approval.actorId!,
      approvalFingerprint: fixture.brief.approvedEvidenceFingerprint!,
    },
  ];
}

describe("P10B-11 commercial PDP profile library", () => {
  it("registers four governed PDP identities with materially different fingerprints", () => {
    const profiles = listCommercialPdpProfiles();
    expect(profiles).toHaveLength(4);
    expect(profiles.map((profile) => profile.profile!.id)).toEqual(commercialPdpProfileIds);
    expect(
      new Set(
        profiles.map((profile) => profile.profile!.commercialProductDetail!.structuralSignature),
      ).size,
    ).toBe(4);
    expect(
      new Set(
        profiles.map((profile) => profile.profile!.commercialProductDetail!.structuralFingerprint),
      ).size,
    ).toBe(4);
    expect(
      profiles.every((profile) =>
        profile.slots.every((slot) => slot.sectionType === "dynamicProductDetail"),
      ),
    ).toBe(true);
  });

  it("materializes every profile through the existing executable PageBlueprint and dynamic PDP authority", () => {
    for (const profileId of commercialPdpProfileIds) {
      const pagePlan = currentProfile(profileId);
      const materialization = materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: ["product"],
      });
      expect(materialization.profileId).toBe(profileId);
      expect(materialization.commercialProductDetail?.structuralFingerprint).toBe(
        pagePlan.profile!.commercialProductDetail!.structuralFingerprint,
      );
      expect(
        dynamicProductDetailDefinition.commercialAnatomy?.variants.find(
          (variant) =>
            variant.variantId ===
            pagePlan.profile!.commercialProductDetail!.dynamicProductDetailVariant,
        )?.classification,
      ).toBe("meaningfulStructuralVariant");
    }
  });

  it("plans a simple canonical product in every compatible PDP profile without a product-type fork", () => {
    for (const profileId of commercialPdpProfileIds) {
      const { plan, profile, snapshot } = fixtureFor(profileId, P9_05A_SIMPLE_PRODUCT_ID);
      const productPlan = plan.pagePlans.find((page) => page.role === "product-template")!;
      const component = productPlan.components.find(
        (entry) => "instance" in entry && entry.instance.component === "dynamicProductDetail",
      );
      if (!component || !("instance" in component)) throw new Error("Missing dynamic PDP plan.");
      expect(component.instance.bindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: "product", productId: P9_05A_SIMPLE_PRODUCT_ID }),
        ]),
      );
      expect(component.instance.variant).toBe(
        profile.profile!.commercialProductDetail!.dynamicProductDetailVariant,
      );
      expect(snapshot.pages.find((page) => page.type === "product")?.sections).toEqual(
        expect.arrayContaining([expect.objectContaining({ component: "dynamicProductDetail" })]),
      );
    }
  });

  it("preserves configurable-product option, price, availability, media and related-card authority", () => {
    for (const profileId of commercialPdpProfileIds) {
      const { fixture, plan, profile, proposal, snapshot } = fixtureFor(profileId);
      const authority = profile.profile!.commercialProductDetail!;
      const product = fixture.planningInput.catalogue.products.find(
        (entry) => entry.id === P9_05A_COMPLEX_PRODUCT_ID,
      )!;
      expect(product.orderOptions?.length).toBeGreaterThan(1);
      expect(product.variants.length).toBeGreaterThan(1);
      const productPlan = plan.pagePlans.find((page) => page.role === "product-template")!;
      const component = productPlan.components.find(
        (entry) => "instance" in entry && entry.instance.component === "dynamicProductDetail",
      );
      if (!component || !("instance" in component)) throw new Error("Missing dynamic PDP plan.");
      expect(component.instance.variant).toBe(authority.dynamicProductDetailVariant);
      expect(component.instance.props).toMatchObject({
        ...authority.dynamicProductDetailProps,
        relatedCardVariant: authority.relatedProductCardAnatomyId,
      });
      expect(component.instance.bindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: "product", productId: product.id }),
        ]),
      );
      expect(
        proposal.proposedStorefront.pages
          .flatMap((page) => page.components)
          .find((entry) => entry.id === component.instance.id),
      ).toMatchObject(component.instance);
      const productSection = snapshot.pages
        .find((page) => page.type === "product")!
        .sections.find((section) => section.component === "dynamicProductDetail")!;
      expect(productSection.variant).toBe(authority.dynamicProductDetailVariant);
      expect(productSection.props.relatedCardVariant).toBe(authority.relatedProductCardAnatomyId);
      expect(productSection.content.productId).toBe(product.id);
      expect(canonicalValueString(fixture.planningInput.catalogue)).toBe(
        canonicalValueString(fixture.aggregate.catalogue),
      );
    }
  });

  it("fails closed for stale, shallow or frame-incompatible PDP profile authority", () => {
    const profiles = listCommercialPdpProfiles();
    const stale = structuredClone(profiles[0]);
    stale.profile!.commercialProductDetail!.presentation = "gallery-led";
    expect(() => validateCommercialPdpProfileLibrary([stale, ...profiles.slice(1)])).toThrow(
      /stale structural authority/i,
    );
    expect(() => validateCommercialPdpProfileLibrary([...profiles, profiles[0]])).toThrow(
      /IDs must be unique/i,
    );
    const staleDefaultFrame = structuredClone(profiles[0]);
    staleDefaultFrame.profile!.commercialProductDetail!.defaultSharedFrameProfileId =
      "centered-minimal";
    expect(() =>
      validateCommercialPdpProfileLibrary([staleDefaultFrame, ...profiles.slice(1)]),
    ).toThrow(/stale structural authority/i);
    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    const wrongFrameDraft = applyCommercialSharedFrame(
      fixture.planningInput.draft,
      "compact-technical",
    );
    expect(() =>
      createWholeStorefrontGenerationPlan(
        { ...fixture.planningInput, draft: wrongFrameDraft },
        { directionId: "premiumEditorial", pdpProfileId: "pdp-high-consideration" },
      ),
    ).toThrow(/incompatible with shared frame/i);
  });

  it("grounds high-consideration support in current approved evidence and omits it when absent", () => {
    const fixture = createP905aFreshMerchantFixture("premiumEditorial");
    const content = {
      relatedHeading: { en: "Related", fi: "Liittyvät" },
      primaryActionLabel: { en: "Add to cart", fi: "Lisää ostoskoriin" },
      supportingHeading: { en: "Approved support", fi: "Hyväksytty tuki" },
      trustItems: [{ id: "support_1", title: { en: "Service", fi: "Palvelu" } }],
    };
    expect(() =>
      resolveDynamicProductDetailSupportingContent(content, { variant: "editorialSplit" }),
    ).toThrow(/current approved factual evidence/i);
    const evidence = expectedEvidence(fixture)[0];
    expect(
      resolveDynamicProductDetailSupportingContent(
        { ...content, supportingEvidence: evidence },
        { variant: "editorialSplit", currentEvidenceReferences: [evidence] },
      ).supportingEvidence,
    ).toEqual(evidence);
    expect(() =>
      assertCommercialPdpEvidence("pdp-standard-commerce", {
        canonicalCommerce: false,
        approvedMerchantEvidence: true,
      }),
    ).toThrow(/lacks required approved authority/i);
    expect(() =>
      assertCommercialPdpEvidence("pdp-high-consideration", {
        canonicalCommerce: true,
        approvedMerchantEvidence: false,
      }),
    ).not.toThrow();
  });

  it("threads current approval evidence into high-consideration PDP route projections", () => {
    const { fixture, snapshot } = fixtureFor("pdp-high-consideration");
    const evidence = expectedEvidence(fixture)[0];
    const page = structuredClone(snapshot.pages.find((entry) => entry.type === "product")!);
    const section = page.sections.find((entry) => entry.component === "dynamicProductDetail")!;
    section.content.supportingHeading = { en: "Approved support", fi: "Hyväksytty tuki" };
    section.content.supportingEvidence = evidence;
    const product = fixture.aggregate.catalogue.products.find(
      (entry) => entry.id === P9_05A_COMPLEX_PRODUCT_ID,
    )!;
    const presentation = createCatalogueStorefrontCommerceRouteAdapter().product({
      aggregate: fixture.aggregate,
      evidenceReferences: [evidence],
      snapshot,
      page,
      product,
    });
    expect(presentation?.projection.evidenceReferences).toEqual([evidence]);
    expect(() =>
      validateDynamicProductDetailRoutePresentation(
        presentation!.instance,
        presentation!.projection,
      ),
    ).not.toThrow();
  });

  it("preserves every profile through save, reload and publication", async () => {
    for (const profileId of commercialPdpProfileIds) {
      const { fixture, snapshot } = fixtureFor(profileId);
      expect(
        snapshot.pages.flatMap((page) =>
          page.sections
            .filter((section) =>
              ["announcementBar", "header", "footer"].includes(section.component),
            )
            .map((section) => `${page.type}:${section.component}`),
        ),
      ).toEqual([]);
      const repository = new InMemoryProjectRepository([fixture.aggregate]);
      await repository.saveDraft(snapshot.projectId, snapshot, {
        id: fixture.draft.id,
        revision: fixture.draft.revision,
      });
      const aggregate = await repository.get(snapshot.projectId);
      const saved = aggregate.snapshots.find(
        (entry) => entry.id === aggregate.project.draftSnapshotId,
      )!;
      expect(canonicalStorefrontContentFingerprint(saved)).toBe(
        canonicalStorefrontContentFingerprint(snapshot),
      );
      const publication = compileStorefrontPublication(
        createCurrentPublishCompilerInput({
          aggregate,
          snapshot: saved,
          sourceAuthority: { kind: "manual" },
          currentEvidenceReferences: expectedEvidence(fixture),
        }),
      );
      expect(
        publication.result.pages
          .find((entry) => entry.page.type === "product")!
          .page.sections.find((section) => section.component === "dynamicProductDetail")?.variant,
      ).toBe(
        snapshot.pages
          .find((page) => page.type === "product")!
          .sections.find((section) => section.component === "dynamicProductDetail")?.variant,
      );
      expect(storefrontSnapshotSchema.parse(structuredClone(saved))).toEqual(saved);
    }
  });

  it("registers concrete four-width responsive transformations for every profile", () => {
    for (const profile of listCommercialPdpProfiles()) {
      const responsive = profile.profile!.commercialProductDetail!.responsiveArchitecture;
      expect(responsive.map((entry) => entry.viewport)).toEqual([375, 768, 1024, 1440]);
      expect(responsive.slice(0, 2).every((entry) => entry.transformationIds.length === 1)).toBe(
        true,
      );
      expect(responsive.slice(2).every((entry) => entry.transformationIds.length === 0)).toBe(true);
    }
  });
});
