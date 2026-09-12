import {
  skillCapabilityKnowledge as knowledge,
  listCurrentDesignSkillInventory,
} from "@/application/design-skills/capability-knowledge";
import { designSkillRegistry } from "@/application/design-skills/default-registry";
import { createDesignSkillRegistry } from "@/application/design-skills/registry";
import {
  governedSkillPackageRegistry as packages,
  createGovernedSkillPackageRegistry,
  type GovernedSkillAuthorityEnvelope,
} from "@/application/design-skills/governed-skill-packages";
import {
  commercialDesignGrammarKnowledge as grammar,
  adaptLegacyCommercialDesignGrammar,
} from "@/application/design-skills/commercial-design-grammar";
import { listExecutablePageBlueprintProfiles } from "@/application/storefront-templates/registry";
import { materializeExecutablePageBlueprint } from "@/application/storefront-templates/profile-materializer";
import { veskifyComponentDefinitionsV2 } from "@/components/registry/v2-registry";
import { aurumNordicBrandSystem } from "@/domain/design-system";
import type { PageType } from "@/domain/storefront";

export function observeCapabilityBoundaries() {
  const cases: Record<string, unknown> = {};
  function capture(name: string, run: () => unknown) {
    try {
      cases[name] = { value: run() };
    } catch (error) {
      cases[name] =
        error instanceof Error
          ? {
              error: {
                name: error.name,
                message: error.message,
                code: Reflect.get(error, "code") as unknown,
              },
            }
          : { error: String(error) };
    }
  }
  const manifest = knowledge.getManifestReference();
  const profiles = knowledge.listExecutableProfiles({ manifest });
  const components = knowledge.listCompatibleComponents({ manifest });
  const selections = profiles.flatMap((profile) =>
    profile.componentSelections.map((selection) => ({
      profileId: profile.profileId,
      slotId: selection.slotId,
      componentType: selection.componentType,
      variant: selection.defaultVariant,
    })),
  );
  capture("manifest", () => manifest);
  capture("profiles", () => profiles);
  capture("components", () => components);
  for (const pageType of [
    undefined,
    "home",
    "collection",
    "product",
    "content",
    "cart",
    "checkout",
    "landing",
    "unsupported",
  ] as const) {
    capture(`profiles/${pageType}`, () =>
      knowledge.listExecutableProfiles({ manifest, pageType: pageType as PageType }),
    );
    for (const profileId of [
      undefined,
      ...profiles.map((p) => p.profileId),
      "missing",
      "__proto__",
    ]) {
      capture(`components/${pageType}/${profileId}`, () =>
        knowledge.listCompatibleComponents({ manifest, pageType: pageType as PageType, profileId }),
      );
    }
  }
  for (const narrativeRole of [
    ...new Set(components.flatMap((c) => c.narrativeRoles)),
    "missing",
  ]) {
    capture(`role/${narrativeRole}`, () =>
      knowledge.listCompatibleComponents({
        manifest,
        narrativeRole: narrativeRole as Parameters<
          typeof knowledge.listCompatibleComponents
        >[0]["narrativeRole"],
      }),
    );
  }
  for (const profile of profiles)
    for (const selection of profile.componentSelections) {
      for (const variant of [...selection.variants, "missing", "__proto__"]) {
        capture(`selection/${profile.profileId}/${selection.slotId}/${variant}`, () =>
          knowledge.resolveSelection({
            manifest,
            profileId: profile.profileId,
            ...selection,
            variant,
          }),
        );
      }
    }
  const first = selections[0];
  for (const [field, value] of [
    ["profileId", "missing"],
    ["slotId", "missing"],
    ["componentType", "missing"],
    ["componentType", "header"],
    ["variant", "missing"],
  ]) {
    capture(`invalid-selection/${field}/${value}`, () =>
      knowledge.resolveSelection({ manifest, ...first, [field]: value }),
    );
  }
  for (const component of components)
    for (const parameterId of [...component.boundedParameterIds, "invented"]) {
      for (const value of [
        "compact",
        "standard",
        "wide",
        "left",
        "center",
        "plain",
        "none",
        "invalid",
        0,
        1,
        -1,
        100,
      ]) {
        capture(`parameter/${component.componentType}/${parameterId}/${value}`, () =>
          knowledge.validateBoundedParameter({
            manifest,
            componentType: component.componentType,
            parameterId,
            value,
          }),
        );
      }
    }
  for (const [label, selected] of [
    ["empty", []],
    ["complete", selections],
    ["reverse-duplicates", [...selections].reverse().concat(selections)],
  ] as const) {
    capture(`provider/${label}`, () =>
      knowledge.createProviderCapabilityContext({ manifest, selections: selected }),
    );
  }
  for (const reference of [
    { ...manifest, version: "999.0.0" },
    { ...manifest, fingerprint: "stale" },
  ]) {
    for (const [label, query] of Object.entries({
      profiles: () => knowledge.listExecutableProfiles({ manifest: reference }),
      components: () => knowledge.listCompatibleComponents({ manifest: reference }),
      selection: () => knowledge.resolveSelection({ ...first, manifest: reference }),
      bounded: () =>
        knowledge.validateBoundedParameter({
          manifest: reference,
          componentType: "missing",
          parameterId: "missing",
          value: 1,
        }),
      provider: () =>
        knowledge.createProviderCapabilityContext({ manifest: reference, selections: [] }),
    }))
      capture(`reference/${reference.version}/${reference.fingerprint}/${label}`, query);
  }
  capture("inventory/default", () => listCurrentDesignSkillInventory());
  capture("inventory/custom-empty", () =>
    listCurrentDesignSkillInventory(createDesignSkillRegistry([])),
  );
  capture("inventory/custom-subset", () =>
    listCurrentDesignSkillInventory(
      createDesignSkillRegistry(designSkillRegistry.list().slice(0, 3).reverse()),
    ),
  );
  capture("packages/list", () => packages.list());
  capture("packages/aliases", () => packages.listAliases());
  capture("packages/identity", () => ({
    version: packages.version,
    fingerprint: packages.fingerprint,
    manifest: packages.capabilityManifestReference(),
  }));
  capture(
    "packages/reversed-input",
    () =>
      createGovernedSkillPackageRegistry({
        descriptors: [...packages.list()].reverse(),
        aliases: [...packages.listAliases()].reverse(),
      }).fingerprint,
  );
  for (const id of [
    ...packages.list().map((p) => p.id),
    ...packages.listAliases().map((p) => p.id),
    "missing",
    "__proto__",
  ]) {
    for (const executionKind of ["initialGeneration", "followUpEditing"] as const)
      capture(`package/${id}/${executionKind}`, () => packages.resolve(id, executionKind));
  }
  const authority: GovernedSkillAuthorityEnvelope = {
    projectId: "project_boundary",
    projectRevision: 7,
    draftSnapshotId: "snapshot_boundary",
    draftRevision: 4,
    snapshotFingerprint: "snapshot-boundary",
    manifest,
    packageRegistry: { version: packages.version, fingerprint: packages.fingerprint },
    componentRegistryFingerprint: "component-boundary",
    commerceFingerprint: "commerce-boundary",
    approvedAssetFingerprint: "asset-boundary",
    locale: "en",
    requestIdentity: "boundary-request",
  };
  for (const descriptor of packages.list()) {
    const input = {
      executionKind: "followUpEditing",
      packageId: descriptor.id,
      packageVersion: descriptor.version,
      scope: descriptor.scope,
      authority,
      pages: [],
    };
    capture(`follow-up/${descriptor.id}`, () => packages.validateFollowUpEditing(input, authority));
    capture(`follow-up/${descriptor.id}/stale`, () =>
      packages.validateFollowUpEditing(input, { ...authority, draftRevision: 5 }),
    );
    capture(`follow-up/${descriptor.id}/unknown-field`, () =>
      packages.validateFollowUpEditing({ ...input, extra: true }, authority),
    );
  }
  const reference = grammar.getReference();
  capture("grammar/reference", () => reference);
  for (const domain of [
    undefined,
    "typography",
    "layout",
    "surface",
    "action",
    "control",
    "shape",
    "media",
    "responsive",
    "narrative",
    "missing",
  ])
    capture(`grammar/categories/${domain}`, () => grammar.listCategories({ reference, domain }));
  capture("grammar/empty", () => grammar.resolve({ reference, layers: [] }));
  capture("grammar/unknown-category", () =>
    grammar.resolve({
      reference,
      layers: [{ level: "instance", selections: { invented: "invalid" } }],
    }),
  );
  for (const category of grammar.listCategories({ reference }))
    for (const value of [...category.values, "invented"]) {
      capture(`grammar/value/${category.id}/${value}`, () =>
        grammar.resolve({
          reference,
          layers: [{ level: category.primaryOwner, selections: { [category.id]: value } }],
        }),
      );
    }
  for (const field of ["version", "fingerprint", "manifestFingerprint"])
    capture(`grammar/stale/${field}`, () =>
      grammar.listCategories({ reference: { ...reference, [field]: "stale" } }),
    );
  for (const pagePlan of listExecutablePageBlueprintProfiles()) {
    if (!pagePlan.profile) throw new Error("Missing current profile");
    const materialization = materializeExecutablePageBlueprint({
      pagePlan,
      componentDefinitions: veskifyComponentDefinitionsV2,
      availableBindingCategories: pagePlan.profile.requiredBindingCategories,
    });
    capture(`grammar/materialized/${materialization.profileId}`, () => materialization);
    for (const slot of materialization.slots) {
      const input = {
        reference,
        brandSystem: aurumNordicBrandSystem,
        materialization,
        slotId: slot.slotId,
      };
      capture(`grammar/adapt/${materialization.profileId}/${slot.slotId}`, () =>
        adaptLegacyCommercialDesignGrammar(input),
      );
      capture(`grammar/slot/${materialization.profileId}/${slot.slotId}`, () =>
        grammar.resolveMaterializedSlot(input),
      );
      capture(`grammar/override/${materialization.profileId}/${slot.slotId}`, () =>
        grammar.resolveMaterializedSlot({
          ...input,
          instanceSelections: { "media.focalPoint": "center" },
        }),
      );
    }
    const input = {
      reference,
      brandSystem: aurumNordicBrandSystem,
      materialization,
      slotId: materialization.slots[0]?.slotId ?? "missing",
    };
    for (const field of ["fingerprint", "profileVersion", "profileId"])
      capture(`grammar/materialization/${materialization.profileId}/${field}`, () =>
        grammar.resolveMaterializedSlot({
          ...input,
          materialization: { ...materialization, [field]: "stale" },
        }),
      );
    capture(`grammar/unknown-slot/${materialization.profileId}`, () =>
      grammar.resolveMaterializedSlot({ ...input, slotId: "missing" }),
    );
    capture(`grammar/invalid-brand/${materialization.profileId}`, () =>
      grammar.resolveMaterializedSlot({
        ...input,
        brandSystem: {} as typeof aurumNordicBrandSystem,
      }),
    );
  }
  return cases;
}
