import { describe, expect, it } from "vitest";
import { skillCapabilityKnowledge } from "@/application/design-skills";
import {
  createGovernedSkillPackageRegistry,
  governedApprovedAssetReferenceSchema,
  governedInitialGenerationAuthoritySchema,
  governedSkillPackageRegistry,
  type GovernedEditingPageAuthority,
  type GovernedFollowUpEditingAuthority,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills/governed-skill-packages";

function currentAuthority(): GovernedSkillAuthorityEnvelope {
  return {
    projectId: "project_governed_skill",
    draftSnapshotId: "snapshot_governed_skill",
    draftRevision: 4,
    snapshotFingerprint: "snapshot-governed-skill-fingerprint",
    manifest: skillCapabilityKnowledge.getManifestReference(),
    packageRegistry: {
      version: governedSkillPackageRegistry.version,
      fingerprint: governedSkillPackageRegistry.fingerprint,
    },
    componentRegistryFingerprint: "component-registry-governed-skill",
    commerceFingerprint: "commerce-governed-skill",
    approvedAssetFingerprint: "approved-assets-governed-skill",
    locale: "en",
    requestIdentity: "governed-skill-request-001",
  };
}

function pageAuthority(pageType: "home" | "collection" | "product", componentType?: string) {
  const manifest = skillCapabilityKnowledge.getManifestReference();
  const profile = skillCapabilityKnowledge.listExecutableProfiles({ manifest, pageType })[0];
  if (!profile) throw new Error(`Expected a ${pageType} executable profile.`);
  const selection = componentType
    ? profile.componentSelections.find((candidate) => candidate.componentType === componentType)
    : profile.componentSelections[0];
  if (!selection) throw new Error(`Expected a ${componentType ?? "registered"} selection.`);
  return {
    pageId: `page_governed_${pageType}`,
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
  } satisfies GovernedEditingPageAuthority;
}

function followUp(
  packageId: GovernedFollowUpEditingAuthority["packageId"],
  pages: readonly GovernedEditingPageAuthority[],
): GovernedFollowUpEditingAuthority {
  const descriptor = governedSkillPackageRegistry.resolve(packageId, "followUpEditing").descriptor;
  return {
    executionKind: "followUpEditing",
    packageId,
    packageVersion: descriptor.version,
    scope: descriptor.scope,
    authority: currentAuthority(),
    pages: [...pages],
  };
}

function assetBackedPageAuthority(): GovernedEditingPageAuthority {
  const manifest = skillCapabilityKnowledge.getManifestReference();
  for (const profile of skillCapabilityKnowledge.listExecutableProfiles({ manifest })) {
    for (const selection of profile.componentSelections) {
      const resolved = skillCapabilityKnowledge.resolveSelection({
        manifest,
        profileId: profile.profileId,
        slotId: selection.slotId,
        componentType: selection.componentType,
        variant: selection.defaultVariant,
      });
      if (resolved.component.assetSlots.length === 0) continue;
      return {
        pageId: `page_governed_asset_${profile.pageType}`,
        pageType: profile.pageType,
        profile: {
          profileId: profile.profileId,
          fingerprint: profile.fingerprint,
          pageType: profile.pageType,
        },
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
  }
  throw new Error("Expected an executable profile selection with an asset slot.");
}

function resultCode(input: unknown, current = currentAuthority()) {
  const result = governedSkillPackageRegistry.validateFollowUpEditing(input, current);
  return result.valid ? undefined : result.failure.code;
}

describe("P10A-05B governed skill package registry", () => {
  it("registers exactly the four canonical packages and resolves only deprecated compatibility aliases", () => {
    expect(governedSkillPackageRegistry.list().map((entry) => entry.id)).toEqual([
      "addCampaignSection",
      "applyExactBrandPalette",
      "applyRegisteredWholeStorefrontDirection",
      "improveHero",
    ]);
    expect(
      governedSkillPackageRegistry.resolve("applyLuxuryStyle", "followUpEditing"),
    ).toMatchObject({
      descriptor: { id: "applyRegisteredWholeStorefrontDirection" },
      alias: { deprecated: true, directionId: "premiumEditorial" },
    });
    expect(
      governedSkillPackageRegistry.resolve("applyBrandPalette", "followUpEditing"),
    ).toMatchObject({
      descriptor: { id: "applyExactBrandPalette" },
      alias: { deprecated: true },
    });
    expect(createGovernedSkillPackageRegistry().fingerprint).toBe(
      governedSkillPackageRegistry.fingerprint,
    );
    expect(
      resultCode({
        ...followUp("applyExactBrandPalette", [{ ...pageAuthority("home"), selections: [] }]),
        packageId: "inventedPackage",
      }),
    ).toBe("unknownPackage");
    expect(() => governedSkillPackageRegistry.resolve("improveHero", "initialGeneration")).toThrow(
      expect.objectContaining({ code: "invalidExecutionKind" }),
    );
  });

  it("compares locale and exact request identity as typed freshness authority", () => {
    const input = followUp("improveHero", [pageAuthority("home", "hero")]);
    expect(resultCode(input)).toBeUndefined();
    expect(resultCode(input, { ...currentAuthority(), locale: "fi" })).toBe("staleLocaleAuthority");
    expect(resultCode(input, { ...currentAuthority(), requestIdentity: "other-request" })).toBe(
      "staleRequestIdentityAuthority",
    );
    expect(
      resultCode(input, { ...currentAuthority(), locale: "fi", requestIdentity: "other-request" }),
    ).toBe("staleLocaleAuthority");
    expect(
      resultCode({
        ...input,
        authority: { ...input.authority, requestIdentity: "governed-skill-request-001 " },
      }),
    ).toBe("staleRequestIdentityAuthority");
  });

  it("keeps initial-generation authority separately validated", () => {
    const home = pageAuthority("home", "hero");
    const initial = {
      executionKind: "initialGeneration",
      authority: currentAuthority(),
      brief: { briefId: "brief_governed_skill", revision: 2, fingerprint: "brief-fingerprint" },
      profiles: [home.profile],
      catalogueFingerprint: "catalogue-fingerprint",
      registeredDirectionId: "modernTechnical",
      outputContractId: "wholeStorefrontPlanningInput.v1",
    };
    expect(governedInitialGenerationAuthoritySchema.parse(initial).executionKind).toBe(
      "initialGeneration",
    );
    expect(
      governedSkillPackageRegistry.validateInitialGeneration(initial, currentAuthority()),
    ).toMatchObject({
      valid: true,
    });
  });

  it("validates optional supplied profiles directly even when selections are empty", () => {
    const home = pageAuthority("home", "hero");
    const optional = { ...home, selections: [] };
    const noProfile = { ...optional, profile: undefined };
    expect(resultCode(followUp("addCampaignSection", [noProfile]))).toBeUndefined();
    expect(resultCode(followUp("addCampaignSection", [optional]))).toBeUndefined();
    expect(
      resultCode(
        followUp("addCampaignSection", [
          { ...optional, profile: { ...home.profile, profileId: "unknown-profile" } },
        ]),
      ),
    ).toBe("staleProfileAuthority");
    expect(
      resultCode(
        followUp("addCampaignSection", [
          { ...optional, profile: { ...home.profile, fingerprint: "stale-profile" } },
        ]),
      ),
    ).toBe("staleProfileAuthority");
    expect(
      resultCode(
        followUp("addCampaignSection", [
          { ...optional, profile: { ...home.profile, pageType: "collection" } },
        ]),
      ),
    ).toBe("staleProfileAuthority");
  });

  it("limits improveHero to the registered hero selection and exact slot identity", () => {
    const hero = pageAuthority("home", "hero");
    expect(resultCode(followUp("improveHero", [hero]))).toBeUndefined();
    for (const componentType of ["header", "footer", "productGrid"] as const) {
      const profile =
        componentType === "productGrid"
          ? pageAuthority("home", componentType)
          : pageAuthority("home", componentType);
      expect(resultCode(followUp("improveHero", [profile]))).toBe("invalidSlotSelection");
    }
    expect(
      resultCode(
        followUp("improveHero", [
          { ...hero, selections: [{ ...hero.selections[0], slotId: "unknown-slot" }] },
        ]),
      ),
    ).toBe("invalidSlotSelection");
  });

  it("preserves governed failures while malformed and unexpected inputs remain invalidRequest", () => {
    const palette = followUp("applyExactBrandPalette", [
      { ...pageAuthority("home"), selections: [] },
    ]);
    expect(resultCode({ ...palette, packageVersion: "9.9.9" })).toBe("stalePackageAuthority");
    expect(
      resultCode({
        ...palette,
        authority: {
          ...palette.authority,
          packageRegistry: { ...palette.authority.packageRegistry, fingerprint: "stale" },
        },
      }),
    ).toBe("staleRegistryAuthority");
    expect(resultCode({ malformed: true })).toBe("invalidRequest");
    const registry = createGovernedSkillPackageRegistry({
      capabilityKnowledge: {
        ...skillCapabilityKnowledge,
        listExecutableProfiles: () => {
          throw new Error("unexpected capability failure");
        },
      },
    });
    const unexpected = registry.validateFollowUpEditing(palette, currentAuthority());
    expect(unexpected).toMatchObject({ valid: false, failure: { code: "invalidRequest" } });
  });

  it("enforces approved-asset roles, duplicates, and per-slot cardinality", () => {
    const base = assetBackedPageAuthority();
    const resolved = skillCapabilityKnowledge.resolveSelection({
      manifest: currentAuthority().manifest,
      ...base.selections[0],
    });
    const assetSlot = resolved.component.assetSlots[0];
    if (!assetSlot) throw new Error("Expected a registered hero asset slot.");
    const asset = governedApprovedAssetReferenceSchema.parse({
      targetSlotId: base.selections[0].slotId,
      assetSlotId: assetSlot.slotId,
      assetId: "asset_governed_skill",
      role: assetSlot.acceptedRoles[0],
      revision: "1",
      materialFingerprint: "asset-governed-fingerprint",
      required: assetSlot.required,
    });
    const withAsset = followUp("applyRegisteredWholeStorefrontDirection", [
      { ...base, approvedAssets: [asset] },
    ]);
    expect(resultCode(withAsset)).toBeUndefined();
    expect(
      resultCode({ ...withAsset, pages: [{ ...withAsset.pages[0], approvedAssets: [] }] }),
    ).toBeUndefined();
    expect(
      resultCode({
        ...withAsset,
        pages: [{ ...withAsset.pages[0], approvedAssets: [asset, asset] }],
      }),
    ).toBe("invalidApprovedAssetReference");
    const overflow = Array.from({ length: (assetSlot.maxItems ?? 1) + 1 }, (_, index) => ({
      ...asset,
      assetId: `asset_governed_${index}`,
    }));
    expect(
      resultCode({ ...withAsset, pages: [{ ...withAsset.pages[0], approvedAssets: overflow }] }),
    ).toBe("invalidApprovedAssetReference");
    const requiredRegistry = createGovernedSkillPackageRegistry({
      capabilityKnowledge: {
        ...skillCapabilityKnowledge,
        resolveSelection: (input) => {
          const selection = skillCapabilityKnowledge.resolveSelection(input);
          return {
            ...selection,
            component: {
              ...selection.component,
              assetSlots: selection.component.assetSlots.map((slot, index) =>
                index === 0 ? { ...slot, required: true, minItems: 1, maxItems: 1 } : slot,
              ),
            },
          };
        },
      },
    });
    const requiredAsset = { ...asset, required: true };
    expect(
      requiredRegistry.validateFollowUpEditing(
        { ...withAsset, pages: [{ ...withAsset.pages[0], approvedAssets: [] }] },
        currentAuthority(),
      ),
    ).toMatchObject({ valid: false, failure: { code: "invalidApprovedAssetReference" } });
    expect(
      requiredRegistry.validateFollowUpEditing(
        { ...withAsset, pages: [{ ...withAsset.pages[0], approvedAssets: [requiredAsset] }] },
        currentAuthority(),
      ),
    ).toMatchObject({ valid: true });
  });

  it("validates coordinated whole-storefront page authority while single-page packages fail closed", () => {
    const home = pageAuthority("home", "hero");
    const collection = pageAuthority("collection");
    const product = pageAuthority("product");
    const whole = followUp("applyRegisteredWholeStorefrontDirection", [product, home, collection]);
    const first = governedSkillPackageRegistry.validateFollowUpEditing(whole, currentAuthority());
    const second = governedSkillPackageRegistry.validateFollowUpEditing(
      { ...whole, pages: [collection, product, home] },
      currentAuthority(),
    );
    expect(first).toMatchObject({ valid: true });
    expect(second).toMatchObject({ valid: true });
    if (first.valid && second.valid)
      expect(first.value.outputFingerprint).toBe(second.value.outputFingerprint);
    expect(resultCode({ ...whole, pages: [home, { ...home, pageId: home.pageId }] })).toBe(
      "invalidRequest",
    );
    expect(
      resultCode({
        ...whole,
        pages: [{ ...home, selections: collection.selections }, collection, product],
      }),
    ).toBe("staleProfileAuthority");
    expect(resultCode(followUp("improveHero", [home, collection]))).toBe("invalidScope");
    expect(
      resultCode({
        ...whole,
        pages: [
          home,
          { ...collection, profile: { ...collection.profile, fingerprint: "stale" } },
          product,
        ],
      }),
    ).toBe("staleProfileAuthority");
  });
});
