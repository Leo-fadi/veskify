import { describe, expect, it, vi } from "vitest";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
} from "@/application/whole-storefront-generation-plan";
import { planRegisteredTokenRefinement } from "@/application/ai-storefront-generation/token-refinement";
import {
  STRICT_SCOPE_ROUTER_CONTRACT_VERSION,
  governedSkillPackageRegistry,
  routeGovernedDesignRequest,
  skillCapabilityKnowledge,
  type GovernedEditingPageAuthority,
  type GovernedFollowUpEditingRequest,
  type GovernedInitialGenerationRequest,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills";
import { homepageCommerceBridgeDefaults } from "@/components/registry";
import { canonicalValueString } from "@/domain/storefront";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";

function baseline(direction: "modernTechnical" | "premiumEditorial" = "modernTechnical") {
  const fixture = createP905aFreshMerchantFixture(direction);
  const planningInput = structuredClone(fixture.planningInput);
  const home = planningInput.draft.pages.find((page) => page.type === "home");
  const hero = home?.sections.find((section) => section.component === "hero");
  if (!home || !hero) throw new Error("Expected a homepage hero.");
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
    requestIdentity: "p10a-06-strict-router-request",
  };
  return {
    planningInput,
    authority,
    plan: createWholeStorefrontGenerationPlan(planningInput, { directionId: direction }),
  };
}

function pageAuthority(
  source: ReturnType<typeof baseline>,
  pageType: "home" | "collection" | "product",
  componentType: string,
): GovernedEditingPageAuthority {
  const materialization = source.plan.pageBlueprintMaterializations.find(
    (candidate) => candidate.pageType === pageType,
  );
  const profile = skillCapabilityKnowledge
    .listExecutableProfiles({ manifest: source.authority.manifest, pageType })
    .find((candidate) => candidate.profileId === materialization?.profileId);
  const selection = profile?.componentSelections.find(
    (candidate) => candidate.componentType === componentType,
  );
  const page = source.plan.target.pages.find((candidate) => candidate.type === pageType);
  if (!profile || !selection || !page) throw new Error("Expected current page authority.");
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

function followUp(
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

function initial(source: ReturnType<typeof baseline>): GovernedInitialGenerationRequest {
  const descriptor = governedSkillPackageRegistry.resolve(
    "applyRegisteredWholeStorefrontDirection",
    "initialGeneration",
  ).descriptor;
  const profiles = source.plan.pageBlueprintMaterializations.map((materialization) => {
    const profile = skillCapabilityKnowledge
      .listExecutableProfiles({
        manifest: source.authority.manifest,
        pageType: materialization.pageType,
      })
      .find((candidate) => candidate.profileId === materialization.profileId);
    const page = source.plan.target.pages.find(
      (candidate) => candidate.type === materialization.pageType,
    );
    if (!profile || !page) throw new Error("Expected initial-generation profile authority.");
    return {
      pageId: page.id,
      pageType: materialization.pageType,
      profileId: profile.profileId,
      fingerprint: profile.fingerprint,
      materializationFingerprint: materialization.fingerprint,
    };
  });
  return {
    executionKind: "initialGeneration",
    packageId: descriptor.id,
    packageVersion: descriptor.version,
    authority: {
      executionKind: "initialGeneration",
      authority: structuredClone(source.authority),
      brief: {
        briefId: source.planningInput.brief.id,
        revision: source.planningInput.brief.revision,
        fingerprint: source.planningInput.brief.fingerprint,
      },
      profiles,
      catalogueFingerprint: source.authority.commerceFingerprint,
      registeredDirectionId: "modernTechnical",
      outputContractId: "wholeStorefrontPlanningInput.v1",
    },
    planningInput: structuredClone(source.planningInput),
  };
}

function request(
  input: Readonly<{
    merchantInstruction: string;
    declaredScope: "designSystem" | "exactSlot" | "pageInsertion" | "completeStorefront";
    initialGeneration?: GovernedInitialGenerationRequest;
    followUpEditing?: GovernedFollowUpEditingRequest;
    requestedPackageId?: string;
    declaredExecutionKind?: "initialGeneration" | "followUpEditing";
    declaredIntent?:
      | "createNewStorefront"
      | "exactBrandPalette"
      | "heroImprovement"
      | "campaignSection"
      | "registeredWholeStorefrontDirection";
    declaredPageIds?: readonly string[];
    declaredSlots?: readonly Readonly<{ pageId: string; slotId: string }>[];
  }>,
) {
  const authority = input.initialGeneration?.authority ?? input.followUpEditing?.authority;
  const pages =
    input.declaredPageIds ??
    (authority?.executionKind === "initialGeneration"
      ? authority.profiles.map((profile) => profile.pageId)
      : (authority?.pages.map((page) => page.pageId) ?? []));
  const slots =
    input.declaredSlots ??
    (authority?.executionKind === "followUpEditing"
      ? authority.pages.flatMap((page) =>
          page.selections.map((selection) => ({ pageId: page.pageId, slotId: selection.slotId })),
        )
      : []);
  return {
    contractVersion: STRICT_SCOPE_ROUTER_CONTRACT_VERSION,
    merchantInstruction: input.merchantInstruction,
    declaredScope: input.declaredScope,
    ...(input.requestedPackageId === undefined
      ? {}
      : { requestedPackageId: input.requestedPackageId }),
    ...(input.declaredExecutionKind === undefined
      ? {}
      : { declaredExecutionKind: input.declaredExecutionKind }),
    ...(input.declaredIntent === undefined ? {} : { declaredIntent: input.declaredIntent }),
    declaredPageIds: pages,
    declaredSlots: slots,
    ...(input.initialGeneration === undefined
      ? {}
      : { initialGeneration: input.initialGeneration }),
    ...(input.followUpEditing === undefined ? {} : { followUpEditing: input.followUpEditing }),
  };
}

function palette(source: ReturnType<typeof baseline>) {
  const tokenRefinementPlan = planRegisteredTokenRefinement(
    "Set primary #B54708, secondary #111111, accent #B54708, background #FFFFFF, surface #FFFFFF, text #111111, muted text #333333, and border #111111. Preserve all layouts and commerce.",
    source.planningInput.draft.brandSystem,
  );
  if (!tokenRefinementPlan) throw new Error("Expected a registered palette refinement.");
  return followUp(source, "applyExactBrandPalette", [], { tokenRefinementPlan });
}

describe("P10A-06 strict scope router", () => {
  it("routes explicit initial generation through P10A-05C without creating another proposal path", () => {
    const source = baseline();
    const result = routeGovernedDesignRequest(
      request({
        merchantInstruction: "Create a new storefront.",
        declaredScope: "completeStorefront",
        initialGeneration: initial(source),
      }),
      source.authority,
      { dispatch: true },
    );
    expect(result.outcome).toBe("initialGeneration");
    if (result.outcome !== "initialGeneration") return;
    expect(result.decision.packageId).toBe("applyRegisteredWholeStorefrontDirection");
    expect(result.execution?.valid).toBe(true);
    if (result.execution?.valid)
      expect(result.execution.plan.fingerprint).toMatch(/^whole-storefront-/);
  }, 15_000);

  it("routes palette-only authority and rejects structural mixing without widening scope", () => {
    const source = baseline();
    const input = palette(source);
    const routed = routeGovernedDesignRequest(
      request({
        merchantInstruction: "Apply approved brand palette.",
        declaredScope: "designSystem",
        followUpEditing: input,
      }),
      source.authority,
    );
    expect(routed).toMatchObject({
      outcome: "followUpEditing",
      decision: { packageId: "applyExactBrandPalette" },
    });
    expect(
      routeGovernedDesignRequest(
        request({
          merchantInstruction: "Apply approved brand palette and change the layout.",
          declaredScope: "designSystem",
          followUpEditing: input,
        }),
        source.authority,
      ),
    ).toMatchObject({ outcome: "clarificationRequired", reasonCode: "conflictingScopes" });
  });

  it("routes one exact hero slot through P10A-05D-02 and rejects ambiguous or non-hero authority", () => {
    const source = baseline();
    const hero = pageAuthority(source, "home", "homepageHero");
    const exact = followUp(source, "improveHero", [hero]);
    const routed = routeGovernedDesignRequest(
      request({
        merchantInstruction: "Improve this hero.",
        declaredScope: "exactSlot",
        followUpEditing: exact,
      }),
      source.authority,
      { dispatch: true },
    );
    expect(routed.outcome).toBe("followUpEditing");
    if (routed.outcome === "followUpEditing") expect(routed.execution?.valid).toBe(true);
    const nonHero = {
      ...hero,
      selections: [{ ...hero.selections[0], slotId: "header", componentType: "header" }],
    };
    for (const pages of [
      [{ ...hero, selections: [hero.selections[0], nonHero.selections[0]] }],
      [nonHero],
    ]) {
      expect(
        routeGovernedDesignRequest(
          request({
            merchantInstruction: "Improve this hero.",
            declaredScope: "exactSlot",
            followUpEditing: followUp(source, "improveHero", pages),
          }),
          source.authority,
        ),
      ).toMatchObject({ outcome: "clarificationRequired" });
    }
  }, 15_000);

  it("routes explicit campaign insertion but never turns a generic page request into one", () => {
    const source = baseline("premiumEditorial");
    const campaign = followUp(source, "addCampaignSection", [
      pageAuthority(source, "home", "homepagePromotion"),
    ]);
    expect(
      routeGovernedDesignRequest(
        request({
          merchantInstruction: "Add a campaign section.",
          declaredScope: "pageInsertion",
          followUpEditing: campaign,
        }),
        source.authority,
      ),
    ).toMatchObject({ outcome: "followUpEditing", decision: { packageId: "addCampaignSection" } });
    expect(
      routeGovernedDesignRequest(
        request({
          merchantInstruction: "Improve the page.",
          declaredScope: "pageInsertion",
          followUpEditing: campaign,
        }),
        source.authority,
      ),
    ).toMatchObject({ outcome: "clarificationRequired", reasonCode: "unsupportedRequest" });
  });

  it("requires explicit registered direction, exact declared pages, and canonical package authority", () => {
    const source = baseline();
    const hero = pageAuthority(source, "home", "homepageHero");
    const direction = followUp(source, "applyRegisteredWholeStorefrontDirection", [hero], {
      registeredDirectionId: "modernTechnical",
    });
    const base = request({
      merchantInstruction: "Apply registered storefront direction.",
      declaredScope: "completeStorefront",
      followUpEditing: direction,
    });
    expect(routeGovernedDesignRequest(base, source.authority)).toMatchObject({
      outcome: "followUpEditing",
      decision: {
        packageId: "applyRegisteredWholeStorefrontDirection",
        declaredPageIds: [hero.pageId],
      },
    });
    expect(
      routeGovernedDesignRequest(
        { ...base, followUpEditing: { ...direction, registeredDirectionId: undefined } },
        source.authority,
      ),
    ).toMatchObject({ outcome: "clarificationRequired", reasonCode: "missingRegisteredDirection" });
    expect(
      routeGovernedDesignRequest(
        { ...base, declaredPageIds: [hero.pageId, "page_undeclared"] },
        source.authority,
      ),
    ).toMatchObject({ outcome: "clarificationRequired", reasonCode: "missingPageAuthority" });
    expect(
      routeGovernedDesignRequest(
        { ...base, requestedPackageId: "applyLuxuryStyle" },
        source.authority,
      ),
    ).toMatchObject({ outcome: "clarificationRequired", reasonCode: "deprecatedAliasMisuse" });
  });

  it("does not widen slot or page scope, and requires clarification for conflicting executions or packages", () => {
    const source = baseline();
    const hero = pageAuthority(source, "home", "homepageHero");
    const follow = followUp(source, "improveHero", [hero]);
    const valid = request({
      merchantInstruction: "Improve this hero.",
      declaredScope: "exactSlot",
      followUpEditing: follow,
    });
    expect(
      routeGovernedDesignRequest({ ...valid, declaredScope: "pageInsertion" }, source.authority),
    ).toMatchObject({
      outcome: "clarificationRequired",
      reasonCode: "conflictingScopes",
    });
    expect(
      routeGovernedDesignRequest(
        { ...valid, merchantInstruction: "Create a new storefront and improve this hero." },
        source.authority,
      ),
    ).toMatchObject({ outcome: "clarificationRequired", reasonCode: "ambiguousPackage" });
    expect(
      routeGovernedDesignRequest(
        { ...valid, declaredExecutionKind: "initialGeneration" },
        source.authority,
      ),
    ).toMatchObject({ outcome: "clarificationRequired", reasonCode: "contradictoryExecutionKind" });
  });

  it("fails closed for protected commerce and publishing intents", () => {
    const source = baseline();
    const follow = followUp(source, "improveHero", [pageAuthority(source, "home", "homepageHero")]);
    for (const merchantInstruction of [
      "Change product price.",
      "Update stock.",
      "Change collection membership.",
      "Replace product media.",
      "Publish storefront.",
    ]) {
      expect(
        routeGovernedDesignRequest(
          request({ merchantInstruction, declaredScope: "exactSlot", followUpEditing: follow }),
          source.authority,
        ),
      ).toMatchObject({ outcome: "unsupported" });
    }
  });

  it("rejects stale authority before dispatch and returns typed non-cloneable failures", () => {
    const source = baseline();
    const follow = followUp(source, "improveHero", [pageAuthority(source, "home", "homepageHero")]);
    const stale = request({
      merchantInstruction: "Improve this hero.",
      declaredScope: "exactSlot",
      followUpEditing: {
        ...follow,
        authority: {
          ...follow.authority,
          authority: {
            ...follow.authority.authority,
            packageRegistry: { version: "9.9.9", fingerprint: "stale-registry" },
          },
        },
      },
    });
    expect(routeGovernedDesignRequest(stale, source.authority, { dispatch: true })).toMatchObject({
      outcome: "unsupported",
      reasonCode: "staleRegistryAuthority",
    });
    expect(routeGovernedDesignRequest({ input: () => undefined }, source.authority)).toMatchObject({
      outcome: "unsupported",
      reasonCode: "nonCloneableInput",
    });
  });

  it("is byte-stable and leaves source authority and proposal lifecycle state untouched without dispatch", () => {
    const source = baseline();
    const hero = pageAuthority(source, "home", "homepageHero");
    const input = request({
      merchantInstruction: "Improve this hero.",
      declaredScope: "exactSlot",
      followUpEditing: followUp(source, "improveHero", [hero]),
    });
    const before = canonicalValueString(source.planningInput);
    const first = routeGovernedDesignRequest(input, source.authority);
    const second = routeGovernedDesignRequest(structuredClone(input), source.authority);
    expect(first).toEqual(second);
    expect(canonicalValueString(source.planningInput)).toBe(before);
    expect("execution" in first).toBe(false);
    const provider = vi.fn();
    expect(provider).not.toHaveBeenCalled();
  });
});
