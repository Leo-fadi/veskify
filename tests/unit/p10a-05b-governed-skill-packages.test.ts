import { describe, expect, it } from "vitest";
import { skillCapabilityKnowledge } from "@/application/design-skills";
import {
  GOVERNED_SKILL_PACKAGE_REGISTRY_VERSION,
  createGovernedSkillPackageRegistry,
  governedApprovedAssetReferenceSchema,
  governedFollowUpEditingAuthoritySchema,
  governedInitialGenerationAuthoritySchema,
  governedSkillPackageAliasSchema,
  governedSkillPackageAliases,
  governedSkillPackageDescriptors,
  governedSkillPackageRegistry,
  type GovernedFollowUpEditingAuthority,
  type GovernedInitialGenerationAuthority,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills/governed-skill-packages";

function currentAuthority(): GovernedSkillAuthorityEnvelope {
  const manifest = skillCapabilityKnowledge.getManifestReference();
  return {
    projectId: "project_governed_skill",
    draftSnapshotId: "snapshot_governed_skill",
    draftRevision: 4,
    snapshotFingerprint: "snapshot-governed-skill-fingerprint",
    manifest,
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

function homeCapability() {
  const manifest = skillCapabilityKnowledge.getManifestReference();
  const profile = skillCapabilityKnowledge.listExecutableProfiles({
    manifest,
    pageType: "home",
  })[0];
  if (!profile) throw new Error("Expected a registered home profile.");
  const selection = profile.componentSelections.find(
    (candidate) => candidate.componentType === "hero",
  );
  if (!selection) throw new Error("Expected a registered hero selection.");
  return { manifest, profile, selection };
}

function initialAuthority(): GovernedInitialGenerationAuthority {
  const { profile } = homeCapability();
  return {
    executionKind: "initialGeneration",
    authority: currentAuthority(),
    brief: {
      briefId: "brief_governed_skill",
      revision: 2,
      fingerprint: "brief-governed-skill-fingerprint",
    },
    profiles: [
      { profileId: profile.profileId, fingerprint: profile.fingerprint, pageType: "home" },
    ],
    catalogueFingerprint: "catalogue-governed-skill-fingerprint",
    registeredDirectionId: "modernTechnical",
    outputContractId: "wholeStorefrontPlanningInput.v1",
  };
}

function followUpAuthority(): GovernedFollowUpEditingAuthority {
  const { profile, selection } = homeCapability();
  const descriptor = governedSkillPackageRegistry.resolve(
    "improveHero",
    "followUpEditing",
  ).descriptor;
  return {
    executionKind: "followUpEditing",
    packageId: descriptor.id,
    packageVersion: descriptor.version,
    scope: descriptor.scope,
    authority: currentAuthority(),
    page: {
      pageId: "page_governed_home",
      pageType: "home",
      profile: { profileId: profile.profileId, fingerprint: profile.fingerprint, pageType: "home" },
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

function assetBackedFollowUpAuthority(): GovernedFollowUpEditingAuthority {
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
      const assetSlot = resolved.component.assetSlots[0];
      if (!assetSlot) continue;
      const role = assetSlot.acceptedRoles[0];
      if (!role) continue;
      const descriptor = governedSkillPackageRegistry.resolve(
        "applyRegisteredWholeStorefrontDirection",
        "followUpEditing",
      ).descriptor;
      return {
        executionKind: "followUpEditing",
        packageId: descriptor.id,
        packageVersion: descriptor.version,
        scope: descriptor.scope,
        authority: currentAuthority(),
        page: {
          pageId: "page_governed_asset",
          pageType: profile.pageType,
          profile: {
            profileId: profile.profileId,
            fingerprint: profile.fingerprint,
            pageType: profile.pageType,
          },
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
        approvedAssets: [
          governedApprovedAssetReferenceSchema.parse({
            targetSlotId: selection.slotId,
            assetSlotId: assetSlot.slotId,
            assetId: "asset_governed_skill",
            role,
            revision: "1",
            materialFingerprint: "asset-governed-skill-fingerprint",
            required: assetSlot.required,
          }),
        ],
      };
    }
  }
  throw new Error("Expected a registered asset-backed executable profile selection.");
}

function failureCode(
  result: ReturnType<typeof governedSkillPackageRegistry.validateFollowUpEditing>,
) {
  return result.valid ? undefined : result.failure.code;
}

describe("P10A-05B governed skill package registry", () => {
  it("keeps initial-generation and follow-up-editing contracts independently typed and validated", () => {
    const initial = initialAuthority();
    const followUp = followUpAuthority();

    expect(governedInitialGenerationAuthoritySchema.parse(initial).executionKind).toBe(
      "initialGeneration",
    );
    expect(governedFollowUpEditingAuthoritySchema.parse(followUp).executionKind).toBe(
      "followUpEditing",
    );
    expect(governedInitialGenerationAuthoritySchema.safeParse(followUp).success).toBe(false);
    expect(governedFollowUpEditingAuthoritySchema.safeParse(initial).success).toBe(false);
    expect(
      governedSkillPackageRegistry.validateInitialGeneration(initial, currentAuthority()).valid,
    ).toBe(true);
    expect(
      governedSkillPackageRegistry.validateFollowUpEditing(followUp, currentAuthority()).valid,
    ).toBe(true);
  });

  it("registers exactly the four approved canonical follow-up packages", () => {
    expect(governedSkillPackageRegistry.list().map((descriptor) => descriptor.id)).toEqual([
      "addCampaignSection",
      "applyExactBrandPalette",
      "applyRegisteredWholeStorefrontDirection",
      "improveHero",
    ]);
    expect(
      governedSkillPackageRegistry
        .list()
        .every((descriptor) => descriptor.executionKind === "followUpEditing"),
    ).toBe(true);
    expect(() =>
      governedSkillPackageRegistry.resolve("coordinateWholeStorefront", "followUpEditing"),
    ).toThrow(expect.objectContaining({ code: "unknownPackage" }));
    expect(() =>
      governedSkillPackageRegistry.resolve("restyleWholeStorefront", "followUpEditing"),
    ).toThrow(expect.objectContaining({ code: "unknownPackage" }));
    expect(() =>
      governedSkillPackageRegistry.resolve("improveSelectedSection", "followUpEditing"),
    ).toThrow(expect.objectContaining({ code: "unknownPackage" }));
    expect(() =>
      governedSkillPackageRegistry.resolve("improveCurrentPage", "followUpEditing"),
    ).toThrow(expect.objectContaining({ code: "unknownPackage" }));
  });

  it("makes package descriptors and aliases deeply immutable with deterministic real-authority fingerprints", () => {
    const first = createGovernedSkillPackageRegistry();
    const second = createGovernedSkillPackageRegistry();
    const descriptors = first.list();
    const aliases = first.listAliases();

    expect(first.version).toBe(GOVERNED_SKILL_PACKAGE_REGISTRY_VERSION);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(Object.isFrozen(descriptors)).toBe(true);
    expect(Object.isFrozen(descriptors[0])).toBe(true);
    expect(Object.isFrozen(descriptors[0]?.supportedPageTypes)).toBe(true);
    expect(Object.isFrozen(aliases[0])).toBe(true);
    expect(Reflect.set(descriptors[0], "id", "inventedPackage")).toBe(false);
    expect(Reflect.set(descriptors[0].supportedPageTypes, 0, "invented")).toBe(false);

    const changedDescriptor = {
      ...governedSkillPackageDescriptors[0],
      version: "1.0.1",
    };
    const changed = createGovernedSkillPackageRegistry({
      descriptors: [changedDescriptor, ...governedSkillPackageDescriptors.slice(1)],
    });
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it("maps deprecated style names deterministically without creating independent authority", () => {
    expect(governedSkillPackageAliases).toHaveLength(5);
    expect(
      governedSkillPackageRegistry.resolve("applyLuxuryStyle", "followUpEditing"),
    ).toMatchObject({
      descriptor: { id: "applyRegisteredWholeStorefrontDirection" },
      alias: { deprecated: true, directionId: "premiumEditorial" },
    });
    expect(
      governedSkillPackageRegistry.resolve("applyMinimalNordicStyle", "followUpEditing"),
    ).toMatchObject({
      descriptor: { id: "applyRegisteredWholeStorefrontDirection" },
      alias: { deprecated: true, directionId: "modernTechnical" },
    });
    expect(
      governedSkillPackageRegistry.resolve("applyMinimalNordicStorefrontStyle", "followUpEditing"),
    ).toMatchObject({ descriptor: { id: "applyRegisteredWholeStorefrontDirection" } });
    expect(
      governedSkillPackageRegistry.resolve("applyWarmPremiumStorefrontStyle", "followUpEditing"),
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
    const compatibilityAuthority: GovernedFollowUpEditingAuthority = {
      ...followUpAuthority(),
      packageId: "applyBrandPalette",
      packageVersion: "1.0.0",
      scope: "designSystem",
      page: { pageId: "page_governed_home", pageType: "home" },
      selections: [],
    };
    expect(
      governedSkillPackageRegistry.validateFollowUpEditing(
        compatibilityAuthority,
        currentAuthority(),
      ),
    ).toMatchObject({
      valid: true,
      value: { package: { descriptor: { id: "applyExactBrandPalette" } } },
    });
    expect(() =>
      governedSkillPackageAliasSchema.parse({
        id: "orphanedLegacyStyle",
        canonicalPackageId: "notARegisteredPackage",
        deprecated: true,
      }),
    ).toThrow();
  });

  it("fails closed for unknown packages, invalid execution kinds, package versions, and stale registry authority", () => {
    const followUp = followUpAuthority();
    expect(() =>
      governedSkillPackageRegistry.resolve("inventedPackage", "followUpEditing"),
    ).toThrow(expect.objectContaining({ code: "unknownPackage" }));
    expect(() => governedSkillPackageRegistry.resolve("improveHero", "initialGeneration")).toThrow(
      expect.objectContaining({ code: "invalidExecutionKind" }),
    );
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          { ...followUp, packageVersion: "99.0.0" },
          currentAuthority(),
        ),
      ),
    ).toBe("stalePackageAuthority");
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          {
            ...followUp,
            authority: {
              ...followUp.authority,
              packageRegistry: {
                ...followUp.authority.packageRegistry,
                fingerprint: "stale-registry",
              },
            },
          },
          currentAuthority(),
        ),
      ),
    ).toBe("staleRegistryAuthority");
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          { ...followUp, scope: "currentPage" },
          currentAuthority(),
        ),
      ),
    ).toBe("invalidScope");
  });

  it("validates manifest, profile, draft, commerce, and approved-asset authority without exposing mutable commerce", () => {
    const initial = initialAuthority();
    const followUp = followUpAuthority();

    expect(
      governedSkillPackageRegistry.validateInitialGeneration(
        {
          ...initial,
          authority: {
            ...initial.authority,
            manifest: { ...initial.authority.manifest, fingerprint: "stale-manifest" },
          },
        },
        currentAuthority(),
      ),
    ).toMatchObject({ valid: false, failure: { code: "staleManifestAuthority" } });
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          {
            ...followUp,
            page: {
              ...followUp.page,
              profile: { ...followUp.page.profile!, fingerprint: "stale-profile" },
            },
          },
          currentAuthority(),
        ),
      ),
    ).toBe("staleProfileAuthority");
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          {
            ...followUp,
            authority: { ...followUp.authority, commerceFingerprint: "stale-commerce" },
          },
          currentAuthority(),
        ),
      ),
    ).toBe("staleCommerceAuthority");
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          {
            ...followUp,
            authority: { ...followUp.authority, approvedAssetFingerprint: "stale-assets" },
          },
          currentAuthority(),
        ),
      ),
    ).toBe("staleApprovedAssetAuthority");

    const result = governedSkillPackageRegistry.validateFollowUpEditing(
      followUp,
      currentAuthority(),
    );
    if (!result.valid) throw new Error("Expected current governed authority to validate.");
    expect(result.value.authority).not.toHaveProperty("catalogue");
    expect(result.value.authority).not.toHaveProperty("navigation");
    expect(result.value.authority).not.toHaveProperty("operations");
    expect(result.value.authority).not.toHaveProperty("proposal");
    expect(result.value.authority.authority).not.toHaveProperty("commerce");
    expect(result.value.authority.authority).not.toHaveProperty("approvedAssets");
  });

  it("validates exact profile/slot/component/variant, bounded parameters, bindings, and approved asset references through P10A-05A", () => {
    const followUp = followUpAuthority();
    const target = followUp.selections[0];
    const unsupportedSelection = {
      ...target,
      componentType: "inventedComponent",
    };
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          { ...followUp, selections: [unsupportedSelection] },
          currentAuthority(),
        ),
      ),
    ).toBe("invalidSlotSelection");
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          {
            ...followUp,
            boundedParameters: [
              { targetSlotId: target.slotId, parameterId: "inventedParameter", value: "invented" },
            ],
          },
          currentAuthority(),
        ),
      ),
    ).toBe("unauthorizedCapabilityReference");
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          {
            ...followUp,
            bindings: [
              {
                targetSlotId: target.slotId,
                bindingSlotId: "inventedBinding",
                sourceType: "product",
                fingerprint: "binding-fingerprint",
              },
            ],
          },
          currentAuthority(),
        ),
      ),
    ).toBe("unauthorizedCapabilityReference");
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          {
            ...followUp,
            approvedAssets: [
              {
                targetSlotId: target.slotId,
                assetSlotId: "inventedAssetSlot",
                assetId: "asset_governed_skill",
                role: "logo",
                revision: "1",
                materialFingerprint: "asset-fingerprint",
                required: false,
              },
            ],
          },
          currentAuthority(),
        ),
      ),
    ).toBe("unauthorizedCapabilityReference");
  });

  it("keeps approved asset roles and requiredness as immutable capability requirements", () => {
    const authority = assetBackedFollowUpAuthority();
    const asset = authority.approvedAssets[0];
    if (!asset) throw new Error("Expected a governed approved-asset reference.");

    expect(
      governedSkillPackageRegistry.validateFollowUpEditing(authority, currentAuthority()),
    ).toMatchObject({ valid: true });
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          { ...authority, approvedAssets: [{ ...asset, required: !asset.required }] },
          currentAuthority(),
        ),
      ),
    ).toBe("invalidApprovedAssetReference");
    expect(
      failureCode(
        governedSkillPackageRegistry.validateFollowUpEditing(
          {
            ...authority,
            authority: { ...authority.authority, approvedAssetFingerprint: null },
          },
          {
            ...currentAuthority(),
            approvedAssetFingerprint: null,
          },
        ),
      ),
    ).toBe("staleApprovedAssetAuthority");
  });
});
