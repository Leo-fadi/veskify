import { describe, expect, it } from "vitest";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
} from "@/application/whole-storefront-generation-plan";
import {
  WholeStorefrontProposalAcceptanceCoordinator,
  createWholeStorefrontRuntimeState,
} from "@/application/whole-storefront-proposal-lifecycle";
import { planRegisteredTokenRefinement } from "@/application/ai-storefront-generation/token-refinement";
import {
  skillCapabilityKnowledge,
  executeGovernedFollowUpEditing,
  governedSkillPackageRegistry,
  type GovernedEditingPageAuthority,
  type GovernedFollowUpEditingRequest,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills";
import { homepageCommerceBridgeDefaults } from "@/components/registry";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";

function baseline(direction: "modernTechnical" | "premiumEditorial" = "modernTechnical") {
  const fixture = createP905aFreshMerchantFixture(direction);
  const planningInput = structuredClone(fixture.planningInput);
  const home = planningInput.draft.pages.find((page) => page.type === "home");
  const hero = home?.sections.find((section) => section.component === "hero");
  if (!home || !hero) throw new Error("Expected the Lumo homepage hero.");
  hero.component = "homepageHero";
  hero.variant = "editorial";
  hero.content = structuredClone(homepageCommerceBridgeDefaults.homepageHero.content);
  hero.props = structuredClone(homepageCommerceBridgeDefaults.homepageHero.props);
  const target = createWholeStorefrontGenerationTarget(planningInput);
  const authority: GovernedSkillAuthorityEnvelope = {
    projectId: planningInput.project.id,
    projectRevision: planningInput.project.revision,
    draftSnapshotId: planningInput.draft.id,
    draftRevision: planningInput.draft.revision,
    snapshotFingerprint: target.activeDraftFingerprint,
    manifest: skillCapabilityKnowledge.getManifestReference(),
    packageRegistry: {
      version: governedSkillPackageRegistry.version,
      fingerprint: governedSkillPackageRegistry.fingerprint,
    },
    componentRegistryFingerprint: target.registryFingerprint,
    commerceFingerprint: target.canonicalCommerceFingerprint,
    approvedAssetFingerprint: target.approvedAssetContextFingerprint,
    locale: "en",
    requestIdentity: "p10a-05d-02-follow-up-request",
  };
  const plan = createWholeStorefrontGenerationPlan(planningInput, { directionId: direction });
  return { planningInput, authority, plan };
}

function pageAuthority(
  source: ReturnType<typeof baseline>,
  pageType: "home" | "collection" | "product",
  componentType: string,
): GovernedEditingPageAuthority {
  const materialization = source.plan.pageBlueprintMaterializations.find(
    (candidate) => candidate.pageType === pageType,
  );
  if (!materialization) throw new Error(`Expected the ${pageType} materialization.`);
  const profile = skillCapabilityKnowledge
    .listExecutableProfiles({ manifest: source.authority.manifest, pageType })
    .find((candidate) => candidate.profileId === materialization.profileId);
  const selection = profile?.componentSelections.find(
    (candidate) => candidate.componentType === componentType,
  );
  const page = source.plan.target.pages.find((candidate) => candidate.type === pageType);
  if (!profile || !selection || !page)
    throw new Error("Expected current home capability authority.");
  return {
    pageId: page.id,
    pageType,
    profile: { profileId: profile.profileId, fingerprint: profile.fingerprint, pageType },
    selections: [
      {
        profileId: profile.profileId,
        slotId: selection.slotId,
        componentType: selection.componentType,
        variant: selection.defaultVariant,
      },
    ],
    boundedParameters: [],
    bindings: [],
    approvedAssets: [],
  };
}

function request(
  source: ReturnType<typeof baseline>,
  packageId: GovernedFollowUpEditingRequest["authority"]["packageId"],
  pages: readonly GovernedEditingPageAuthority[],
  extras: Pick<
    GovernedFollowUpEditingRequest,
    "registeredDirectionId" | "tokenRefinementPlan"
  > = {},
): GovernedFollowUpEditingRequest {
  const descriptor = governedSkillPackageRegistry.resolve(packageId, "followUpEditing").descriptor;
  return {
    authority: {
      executionKind: "followUpEditing",
      packageId,
      packageVersion: descriptor.version,
      scope: descriptor.scope,
      authority: structuredClone(source.authority),
      pages: [...pages],
    },
    planningInput: structuredClone(source.planningInput),
    ...extras,
  };
}

function execute(input: unknown, current: GovernedSkillAuthorityEnvelope) {
  return executeGovernedFollowUpEditing(input, current);
}

function failureCode(input: unknown, current: GovernedSkillAuthorityEnvelope) {
  const result = execute(input, current);
  return result.valid ? undefined : result.failure.code;
}

function paletteRefinement(source: ReturnType<typeof baseline>) {
  const refinement = planRegisteredTokenRefinement(
    "Set primary #B54708, secondary #111111, accent #B54708, background #FFFFFF, surface #FFFFFF, text #111111, muted text #333333, and border #111111. Preserve all layouts and commerce.",
    source.planningInput.draft.brandSystem,
  );
  if (!refinement) throw new Error("Expected a valid exact token refinement.");
  return refinement;
}

function heroWithCurrentBinding(source: ReturnType<typeof baseline>): GovernedEditingPageAuthority {
  const pageAuthorityValue = pageAuthority(source, "home", "homepageHero");
  const runtime = createWholeStorefrontRuntimeState({
    plan: source.plan,
    planningInput: source.planningInput,
  });
  const binding = runtime.pages
    .find((page) => page.type === "home")
    ?.components.find((component) => component.component === "homepageHero")?.bindings[0];
  if (!binding) throw new Error("Expected a canonical homepage hero binding.");
  return {
    ...pageAuthorityValue,
    bindings: [
      {
        targetSlotId: pageAuthorityValue.selections[0].slotId,
        bindingSlotId: binding.slotId,
        sourceType: binding.source,
        fingerprint: canonicalValueFingerprint(binding),
      },
    ],
  };
}

describe("P10A-05D-02 governed follow-up package integration", () => {
  it("resolves exactly the four governed follow-up packages through the existing aggregate proposal", () => {
    const source = baseline();
    const hero = pageAuthority(source, "home", "homepageHero");
    const palette = request(source, "applyExactBrandPalette", [], {
      tokenRefinementPlan: paletteRefinement(source),
    });
    const campaignSource = baseline("premiumEditorial");
    const campaign = request(campaignSource, "addCampaignSection", [
      pageAuthority(campaignSource, "home", "homepagePromotion"),
    ]);
    const direction = request(source, "applyRegisteredWholeStorefrontDirection", [hero], {
      registeredDirectionId: "modernTechnical",
    });
    const executionCases: ReadonlyArray<
      Readonly<{
        input: GovernedFollowUpEditingRequest;
        currentAuthority: GovernedSkillAuthorityEnvelope;
      }>
    > = [
      { input: palette, currentAuthority: source.authority },
      { input: request(source, "improveHero", [hero]), currentAuthority: source.authority },
      { input: campaign, currentAuthority: campaignSource.authority },
      { input: direction, currentAuthority: source.authority },
    ];
    for (const { input, currentAuthority } of executionCases) {
      const result = execute(input, currentAuthority);
      expect(result).toMatchObject({ valid: true });
      if (!result.valid) continue;
      expect(result.proposal.id).toMatch(/^whole_storefront_proposal_/);
      expect(result.coordinatedPlan.kind).toBe("governedFollowUp");
    }
  }, 15_000);

  it("keeps palette proposals token-only and preserves structure, bindings, assets and commerce", () => {
    const source = baseline();
    const result = execute(
      request(source, "applyExactBrandPalette", [], {
        tokenRefinementPlan: paletteRefinement(source),
      }),
      source.authority,
    );
    if (!result.valid) throw new Error(result.failure.message);
    expect(result.proposal.operations.map((entry) => entry.operation.type)).toEqual([
      "APPLY_REGISTERED_BRAND_SYSTEM",
      "RETAIN_NAVIGATION",
    ]);
    expect(result.proposal.proposedStorefront.pages).toEqual(
      result.proposal.originalStorefront.pages,
    );
    expect(result.proposal.proposedStorefront.approvedAssetPlacements).toEqual([]);
  });

  it("changes only the explicit canonical hero slot and preserves all unrelated runtime components", () => {
    const source = baseline();
    const result = execute(
      request(source, "improveHero", [pageAuthority(source, "home", "homepageHero")]),
      source.authority,
    );
    if (!result.valid) throw new Error(result.failure.message);
    const original = result.proposal.originalStorefront.pages.find((page) => page.type === "home");
    const proposed = result.proposal.proposedStorefront.pages.find((page) => page.type === "home");
    if (!original || !proposed) throw new Error("Expected governed home runtime pages.");
    expect(
      proposed.components.filter((component) => component.component !== "homepageHero"),
    ).toEqual(original.components.filter((component) => component.component !== "homepageHero"));
    expect(
      proposed.components.find((component) => component.component === "homepageHero")?.variant,
    ).toBe(pageAuthority(source, "home", "homepageHero").selections[0]?.variant);
  });

  it("inserts campaigns only at the registered promotion position", () => {
    const source = baseline("premiumEditorial");
    const result = execute(
      request(source, "addCampaignSection", [pageAuthority(source, "home", "homepagePromotion")]),
      source.authority,
    );
    if (!result.valid) throw new Error(result.failure.message);
    const proposed = result.proposal.proposedStorefront.pages.find((page) => page.type === "home");
    const materialization =
      result.coordinatedPlan.baselineGenerationPlan.pageBlueprintMaterializations.find(
        (entry) => entry.pageType === "home",
      );
    if (!proposed || !materialization) throw new Error("Expected governed campaign authority.");
    const promotion = proposed.components.findIndex(
      (component) => component.component === "homepagePromotion",
    );
    const promotionSlot = materialization.slots.findIndex((slot) => slot.slotId === "promotion");
    const following = materialization.slots
      .slice(promotionSlot + 1)
      .find((slot) =>
        proposed.components.some((component) => component.component === slot.component),
      );
    if (promotion < 0 || !following) throw new Error("Expected registered campaign placement.");
    expect(
      proposed.components.findIndex((component) => component.component === following.component),
    ).toBeGreaterThan(promotion);
  });

  it("resolves an optional campaign profile from the exact current materialization", () => {
    const source = baseline("premiumEditorial");
    const promotion = pageAuthority(source, "home", "homepagePromotion");
    const result = execute(
      request(source, "addCampaignSection", [{ ...promotion, profile: undefined }]),
      source.authority,
    );
    expect(result).toMatchObject({ valid: true });
  });

  it("maps composite collection and product PageBlueprint slots to their runtime components", () => {
    const source = baseline("premiumEditorial");
    const collection = pageAuthority(source, "collection", "collectionHeader");
    const product = pageAuthority(source, "product", "productGallery");
    const result = execute(
      request(source, "applyRegisteredWholeStorefrontDirection", [collection, product], {
        registeredDirectionId: "premiumEditorial",
      }),
      source.authority,
    );
    if (!result.valid) throw new Error(result.failure.message);
    const collectionPage = result.proposal.proposedStorefront.pages.find(
      (page) => page.type === "collection",
    );
    const productPage = result.proposal.proposedStorefront.pages.find(
      (page) => page.type === "product",
    );
    expect(
      collectionPage?.components.find(
        (component) => component.component === "dynamicCollectionCommerce",
      )?.variant,
    ).toBe(
      result.coordinatedPlan.baselineGenerationPlan.designSystemSelection.collectionPresentation
        .variant,
    );
    expect(
      productPage?.components.find((component) => component.component === "dynamicProductDetail")
        ?.variant,
    ).toBe(
      result.coordinatedPlan.baselineGenerationPlan.designSystemSelection.productPresentation
        .variant,
    );
  });

  it("fails closed for bounded parameter intents until they have a canonical runtime projection", () => {
    const source = baseline();
    const hero = pageAuthority(source, "home", "homepageHero");
    expect(
      failureCode(
        request(source, "improveHero", [
          {
            ...hero,
            boundedParameters: [
              {
                targetSlotId: hero.selections[0].slotId,
                parameterId: "density",
                value: "compact",
              },
            ],
          },
        ]),
        source.authority,
      ),
    ).toBe("unsupportedBoundedParameter");
  });

  it("fails closed for stale authority, wrong package scope, invalid slots and non-cloneable input", () => {
    const source = baseline();
    const hero = pageAuthority(source, "home", "homepageHero");
    const valid = request(source, "improveHero", [hero]);
    expect(
      execute(
        { ...valid, authority: { ...valid.authority, packageId: "unknown" } },
        source.authority,
      ),
    ).toMatchObject({
      valid: false,
      failure: { code: "unknownPackage" },
    });
    expect(
      execute(
        {
          ...valid,
          authority: {
            ...valid.authority,
            authority: {
              ...valid.authority.authority,
              manifest: { version: "9.9.9", fingerprint: "stale" },
            },
          },
        },
        source.authority,
      ),
    ).toMatchObject({ valid: false, failure: { code: "staleManifestAuthority" } });
    expect(
      execute(
        {
          ...valid,
          authority: {
            ...valid.authority,
            pages: [{ ...hero, selections: [{ ...hero.selections[0], slotId: "footer" }] }],
          },
        },
        source.authority,
      ),
    ).toMatchObject({ valid: false, failure: { code: "invalidSlotSelection" } });
    expect(
      execute({ authority: valid.authority, planningInput: () => undefined }, source.authority),
    ).toMatchObject({
      valid: false,
      failure: { code: "invalidRequest" },
    });
  });

  it("rejects non-follow-up, alias, direction, stale planning and contradictory profile authority before compilation", () => {
    const source = baseline();
    const hero = pageAuthority(source, "home", "homepageHero");
    const valid = request(source, "improveHero", [hero]);
    const direction = request(source, "applyRegisteredWholeStorefrontDirection", [hero], {
      registeredDirectionId: "premiumEditorial",
    });
    expect(
      failureCode(
        { ...valid, authority: { ...valid.authority, executionKind: "initialGeneration" } },
        source.authority,
      ),
    ).toBe("invalidRequest");
    expect(
      failureCode(
        request(source, "applyRegisteredWholeStorefrontDirection", [hero]),
        source.authority,
      ),
    ).toBe("invalidFollowUpExecution");
    expect(
      failureCode(
        {
          ...direction,
          authority: {
            ...direction.authority,
            packageId: "applyLuxuryStyle",
          },
        },
        source.authority,
      ),
    ).toBe("deprecatedAliasDirection");
    expect(
      failureCode(
        {
          ...valid,
          planningInput: {
            ...source.planningInput,
            project: {
              ...source.planningInput.project,
              revision: source.planningInput.project.revision + 1,
            },
          },
        },
        source.authority,
      ),
    ).toBe("stalePlanningAuthority");
    expect(
      failureCode(
        {
          ...valid,
          authority: {
            ...valid.authority,
            pages: [{ ...hero, profile: { ...hero.profile!, fingerprint: "stale-profile" } }],
          },
        },
        source.authority,
      ),
    ).toBe("staleProfileAuthority");
  });

  it("is deterministic for normalized authority and rejects duplicate declared page authority", () => {
    const source = baseline();
    const hero = pageAuthority(source, "home", "homepageHero");
    const input = request(source, "improveHero", [hero]);
    const first = execute(input, source.authority);
    const second = execute(structuredClone(input), source.authority);
    if (!first.valid || !second.valid) throw new Error("Expected deterministic governed proposal.");
    expect(second.outputFingerprint).toBe(first.outputFingerprint);
    expect(second.coordinatedPlan).toEqual(first.coordinatedPlan);
    expect(second.proposal).toEqual(first.proposal);
    expect(
      failureCode(
        {
          ...input,
          authority: { ...input.authority, pages: [hero, structuredClone(hero)] },
        },
        source.authority,
      ),
    ).toBe("invalidRequest");
  });

  it("requires binding references to preserve the exact current canonical binding", () => {
    const source = baseline();
    const hero = heroWithCurrentBinding(source);
    expect(execute(request(source, "improveHero", [hero]), source.authority)).toMatchObject({
      valid: true,
    });
    expect(
      failureCode(
        request(source, "improveHero", [
          { ...hero, bindings: [{ ...hero.bindings[0], fingerprint: "stale-binding" }] },
        ]),
        source.authority,
      ),
    ).toBe("invalidCanonicalBinding");
  });

  it("reuses review, atomic accept/reject/close, undo/redo and stale acceptance safeguards", () => {
    const source = baseline();
    const result = execute(
      request(source, "improveHero", [pageAuthority(source, "home", "homepageHero")]),
      source.authority,
    );
    if (!result.valid) throw new Error(result.failure.message);
    const protectedBefore = canonicalValueString({
      catalogue: source.planningInput.catalogue,
      navigation: source.planningInput.draft.navigation,
      assets: source.planningInput.approvedAssetContext,
    });
    const rejected = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal: result.proposal,
      currentInput: () => ({ plan: result.coordinatedPlan, planningInput: result.planningInput }),
    });
    expect(rejected.reject().state).toBe("rejected");
    expect(rejected.close().activeStorefront).toEqual(result.proposal.originalStorefront);
    const accepted = new WholeStorefrontProposalAcceptanceCoordinator({
      proposal: result.proposal,
      currentInput: () => ({ plan: result.coordinatedPlan, planningInput: result.planningInput }),
    });
    expect(accepted.accept().state).toBe("accepted");
    expect(accepted.undo()).toEqual(result.proposal.originalStorefront);
    expect(accepted.redo()).toEqual(result.proposal.proposedStorefront);
    expect(
      canonicalValueString({
        catalogue: source.planningInput.catalogue,
        navigation: source.planningInput.draft.navigation,
        assets: source.planningInput.approvedAssetContext,
      }),
    ).toBe(protectedBefore);
  });
});
