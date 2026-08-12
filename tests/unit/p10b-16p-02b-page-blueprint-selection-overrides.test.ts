import { describe, expect, it } from "vitest";
import {
  getExecutablePageBlueprintProfile,
  materializeExecutablePageBlueprint,
  type ExecutablePageBlueprintMaterializationError,
} from "@/application/storefront-templates";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import {
  getBoundedParameterRuntimeProjectionAuthority,
  projectBoundedParametersToComponentRuntime,
} from "@/domain/component-platform";

const availableBindings = [
  "navigation",
  "projectBrandContext",
  "collectionList",
  "productList",
] as const;

function pagePlan() {
  const plan = getExecutablePageBlueprintProfile("homepage-editorial-storytelling");
  if (!plan) throw new Error("Missing commercial homepage profile fixture.");
  return plan;
}

function materialize(
  slotSelectionOverrides?: Parameters<
    typeof materializeExecutablePageBlueprint
  >[0]["slotSelectionOverrides"],
) {
  return materializeExecutablePageBlueprint({
    pagePlan: pagePlan(),
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: availableBindings,
    ...(slotSelectionOverrides === undefined ? {} : { slotSelectionOverrides }),
  });
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return (error as ExecutablePageBlueprintMaterializationError).code;
  }
  return undefined;
}

describe("P10B-16P-02B exact PageBlueprint slot selections", () => {
  it("preserves default materialization when no exact selections are supplied", () => {
    expect(materialize()).toEqual(materialize([]));
  });

  it("materializes a registered meaningful variant and instance-authorized parameters", () => {
    const baseline = materialize();
    const selected = materialize([
      {
        slotId: "hero",
        component: "homepageHero",
        variant: "fullBleedOverlay",
        boundedParameters: { mediaPlacement: "background" },
      },
    ]);

    expect(selected.slots.find(({ slotId }) => slotId === "hero")).toMatchObject({
      component: "homepageHero",
      variant: "fullBleedOverlay",
      boundedParameters: { mediaPlacement: "background" },
    });
    expect(selected.fingerprint).toMatch(/^page-blueprint-/);
    expect(selected.fingerprint).not.toBe(baseline.fingerprint);
    expect(
      materialize([
        {
          slotId: "hero",
          component: "homepageHero",
          variant: "fullBleedOverlay",
          boundedParameters: { mediaPlacement: "background" },
        },
      ]),
    ).toEqual(selected);
  });

  it("fails closed for unknown, duplicate, mismatched, or unregistered slot selections", () => {
    expect(
      errorCode(() =>
        materialize([
          { slotId: "missing", component: "homepageHero", variant: "fullBleedOverlay" },
        ]),
      ),
    ).toBe("incompatible-component");
    expect(
      errorCode(() =>
        materialize([
          { slotId: "hero", component: "homepageHero", variant: "fullBleedOverlay" },
          { slotId: "hero", component: "homepageHero", variant: "minimal" },
        ]),
      ),
    ).toBe("incompatible-component");
    expect(
      errorCode(() =>
        materialize([{ slotId: "hero", component: "homepageProof", variant: "fullBleedOverlay" }]),
      ),
    ).toBe("incompatible-component");
    expect(
      errorCode(() =>
        materialize([{ slotId: "hero", component: "homepageHero", variant: "notRegistered" }]),
      ),
    ).toBe("incompatible-component");
    expect(
      errorCode(() =>
        materialize([{ slotId: "hero", component: "homepageHero", variant: "minimal" }]),
      ),
    ).toBe("incompatible-component");
  });

  it("fails closed when bounded parameters are unknown, incompatible, or not instance-authorized", () => {
    const selection = (boundedParameters: Readonly<Record<string, string | number>>) => [
      {
        slotId: "hero",
        component: "homepageHero",
        variant: "fullBleedOverlay",
        boundedParameters,
      },
    ];

    expect(errorCode(() => materialize(selection({ missingParameter: "value" })))).toBe(
      "invalid-parameter",
    );
    expect(errorCode(() => materialize(selection({ filterPlacement: "sidebar" })))).toBe(
      "invalid-parameter",
    );
    expect(errorCode(() => materialize(selection({ layoutModel: "split" })))).toBe(
      "invalid-parameter",
    );
    expect(errorCode(() => materialize(selection({ density: "unsupported" })))).toBe(
      "invalid-parameter",
    );
    expect(errorCode(() => materialize(selection({ density: "standard" })))).toBe(
      "invalid-parameter",
    );
    expect(errorCode(() => materialize(selection({ mediaPlacement: "start" })))).toBe(
      "invalid-parameter",
    );
    expect(errorCode(() => materialize(selection({ surfaceTreatment: "layered" })))).toBe(
      "invalid-parameter",
    );

    const constrainedPlan = structuredClone(pagePlan());
    constrainedPlan.pageBlueprint.boundedParameterConstraints.push({
      parameterId: "surfaceTreatment",
      allowedValues: ["plain"],
    });
    expect(
      errorCode(() =>
        materializeExecutablePageBlueprint({
          pagePlan: constrainedPlan,
          componentDefinitions: veskifyComponentDefinitionsV2,
          availableBindingCategories: availableBindings,
          slotSelectionOverrides: selection({ surfaceTreatment: "soft" }),
        }),
      ),
    ).toBe("invalid-parameter");
  });

  it("projects only exact typed renderer fields", () => {
    expect(
      getBoundedParameterRuntimeProjectionAuthority("homepageFeaturedProducts", "columnCount"),
    ).toMatchObject({
      target: "props",
      targetField: "columns",
      numericRange: { minimum: 2, maximum: 4 },
    });
    expect(
      getBoundedParameterRuntimeProjectionAuthority("homepageHero", "mediaPlacement"),
    ).toMatchObject({
      target: "props",
      targetField: "mediaPosition",
      allowedValues: ["background"],
    });
    expect(
      getBoundedParameterRuntimeProjectionAuthority("homepageHero", "surfaceTreatment"),
    ).toBeNull();
    expect(
      projectBoundedParametersToComponentRuntime("homepageFeaturedProducts", {
        columnCount: 3,
      }),
    ).toEqual({ props: { columns: 3 }, styleOverrides: {} });
    expect(
      projectBoundedParametersToComponentRuntime("homepageFeaturedProducts", { columnCount: 1 }),
    ).toBeNull();
    expect(
      projectBoundedParametersToComponentRuntime("homepageEditorial", { columnCount: 2 }),
    ).toBeNull();
  });

  it("permits parameter projection on an unchanged default without upgrading its variant authority", () => {
    const selected = materialize([
      {
        slotId: "curated-products",
        component: "homepageFeaturedProducts",
        variant: "editorial",
        boundedParameters: { columnCount: 3 },
      },
    ]);
    expect(selected.slots.find(({ slotId }) => slotId === "curated-products")).toMatchObject({
      variant: "editorial",
      boundedParameters: { columnCount: 3 },
    });
    expect(
      errorCode(() =>
        materialize([
          {
            slotId: "curated-products",
            component: "homepageFeaturedProducts",
            variant: "editorial",
          },
        ]),
      ),
    ).toBe("incompatible-component");
  });
});
