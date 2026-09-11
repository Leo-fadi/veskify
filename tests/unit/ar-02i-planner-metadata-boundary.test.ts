import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { resolveRuntimeImportClosure } from "../helpers/ar-02-runtime-import-closure";
import { getHomepagePlanningDefaults } from "@/application/whole-storefront-generation-plan/homepage-planning-defaults";
import * as metadata from "@/components/registry/homepage-commerce-bridge-metadata";
import * as bridge from "@/components/registry/homepage-commerce-bridge";
import * as schemas from "@/components/registry/homepage-commerce";
import { homepageMetadataDefinitions } from "@/components/registry/homepage-metadata";
import { aurumHeroMetadataDefinitions } from "@/components/registry/aurum-hero-metadata";
import { getComponentDefinition } from "@/components/registry/registry";
import {
  listCommercialHomepageProfiles,
  storefrontTemplateDefinitions,
} from "@/application/storefront-templates/registry";
import { createWholeStorefrontRecipeContext } from "@/application/whole-storefront-generation-plan/recipe-context";
import {
  createWholeStorefrontGenerationPlan,
  createWholeStorefrontGenerationTarget,
  validateWholeStorefrontGenerationPlan,
} from "@/application/whole-storefront-generation-plan/planner";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { applyCommercialSharedFrame } from "@/domain/storefront";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const legacy = { ...homepageMetadataDefinitions, ...aurumHeroMetadataDefinitions };
const names = [...Object.keys(legacy), ...metadata.homepageCommerceBridgeComponentNames];
const roots = [
  "src/components/registry/homepage-commerce-bridge-metadata.ts",
  "src/application/whole-storefront-generation-plan/homepage-planning-defaults.ts",
  ...["planner", "contract", "recipe-context", "provider"].map(
    (name) => `src/application/whole-storefront-generation-plan/${name}.ts`,
  ),
];

describe("AR-02I existing planner metadata boundary", () => {
  it.each(roots)("resolves the complete renderer-free runtime closure of %s", (root) => {
    const closure = resolveRuntimeImportClosure(root);
    const forbidden =
      /(?:\.tsx$|\.css$|^src\/(?:app|features|integrations\/puck)\/|^src\/components\/storefront\/|^src\/components\/registry\/(?:index|registry|contract|legacy-registry|renderer-observation|live-renderer-conformance|renderer-conformance)\.|^src\/application\/(?:whole-storefront-proposal-lifecycle|publishing|design-operations)\/|^src\/application\/bounded-storefront-synthesis\/(?:synthesizer|index)\.|^src\/application\/whole-storefront-generation-plan\/(?:index|complete-storefront-materializer)\.|^src\/application\/storefront-templates\/(?:index|materializer)\.|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$))/u;
    expect(closure.runtimePaths.length).toBeGreaterThan(1);
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(closure.externalRuntimeImports.map((value) => value.specifier)).toEqual(["zod"]);
  });

  it("retains bridge value/schema identity and variant ordering through old and new entrypoints", () => {
    expect(bridge.homepageCommerceBridgeComponentNames).toBe(
      metadata.homepageCommerceBridgeComponentNames,
    );
    expect(bridge.homepageCommerceBridgeDefaults).toBe(metadata.homepageCommerceBridgeDefaults);
    expect(bridge.homepageCommerceBridgeVariants).toBe(metadata.homepageCommerceBridgeVariants);
    for (const name of metadata.homepageCommerceBridgeComponentNames) {
      const runtime = getComponentDefinition(name);
      expect(runtime).toBe(bridge.homepageCommerceBridgeDefinitions[name]);
      expect(runtime.contentSchema).toBe(schemas[`${name}ContentSchema`]);
      expect(runtime.propsSchema).toBe(schemas[`${name}PropsSchema`]);
      expect(runtime.defaultContent).toEqual(metadata.homepageCommerceBridgeDefaults[name].content);
      expect(runtime.defaultProps).toEqual(metadata.homepageCommerceBridgeDefaults[name].props);
      expect(runtime.variants).toEqual(metadata.homepageCommerceBridgeVariants[name]);
      expect(runtime.variants).toEqual(
        schemas[`${name}Definition`].variants.map((value) => value.id),
      );
    }
  });

  it("matches every complete parsed runtime default, including the bridge's second parse", () => {
    const before = JSON.stringify({ legacy, defaults: metadata.homepageCommerceBridgeDefaults });
    for (const name of names) {
      const runtime = getComponentDefinition(name);
      expect(getHomepagePlanningDefaults(name)).toEqual({
        defaultContent: runtime.defaultContent,
        defaultProps: runtime.defaultProps,
      });
      if (Object.hasOwn(legacy, name)) {
        const declaration = legacy[name as keyof typeof legacy];
        expect(getHomepagePlanningDefaults(name)).toEqual({
          defaultContent: declaration.contentSchema.parse(declaration.defaultContent),
          defaultProps: declaration.propsSchema.parse(declaration.defaultProps),
        });
      }
    }
    expect(getHomepagePlanningDefaults("brandStory").defaultProps).not.toEqual(
      legacy.brandStory.defaultProps,
    );
    expect(getHomepagePlanningDefaults("header").defaultProps).not.toEqual(
      legacy.header.defaultProps,
    );
    expect(JSON.stringify({ legacy, defaults: metadata.homepageCommerceBridgeDefaults })).toBe(
      before,
    );
  });

  it("covers every registered home slot before required/optional/shared-frame omissions", () => {
    const plans = [
      ...storefrontTemplateDefinitions.flatMap((template) =>
        template.pagePlans.filter((plan) => plan.pageType === "home"),
      ),
      ...listCommercialHomepageProfiles(),
    ];
    expect(plans.length).toBeGreaterThan(6);
    expect(plans.some((plan) => plan.slots.some((slot) => !slot.required))).toBe(true);
    const slots = new Set(plans.flatMap((plan) => plan.slots.map((slot) => slot.sectionType)));
    for (const required of ["header", "footer", "announcementBar", "newsletter"])
      expect(slots.has(required)).toBe(true);
    // The separate legacy brand-story lookup is preserved even though current
    // commercial profiles express brandStory as a homepageEditorial variant.
    expect(getHomepagePlanningDefaults("brandStory").defaultProps).toEqual(
      getComponentDefinition("brandStory").defaultProps,
    );
    for (const slot of slots)
      expect(getHomepagePlanningDefaults(slot)).toEqual({
        defaultContent: getComponentDefinition(slot).defaultContent,
        defaultProps: getComponentDefinition(slot).defaultProps,
      });
  });

  it.each(["__proto__", "constructor", "toString", "homepageHreo", ""])(
    "preserves own-property unknown-component failure for %j",
    (component) => {
      const error = (run: () => unknown) => {
        try {
          run();
          return null;
        } catch (cause) {
          return cause instanceof Error ? { name: cause.name, message: cause.message } : cause;
        }
      };
      expect(error(() => getHomepagePlanningDefaults(component))).toEqual(
        error(() => getComponentDefinition(component)),
      );
      expect(() => getHomepagePlanningDefaults(component)).toThrow(
        `Unknown storefront component: ${component}.`,
      );
    },
  );

  it("isolates returned normalized values without mutating upstream defaults or later requests", () => {
    for (const name of names) {
      const first = getHomepagePlanningDefaults(name);
      const original = structuredClone(first);
      const before = JSON.stringify({ legacy, defaults: metadata.homepageCommerceBridgeDefaults });
      Object.assign(first.defaultProps, { invalid: "mutation" });
      Object.assign(first.defaultContent, { invalid: "mutation" });
      expect(getHomepagePlanningDefaults(name)).toEqual(original);
      expect(JSON.stringify({ legacy, defaults: metadata.homepageCommerceBridgeDefaults })).toBe(
        before,
      );
    }
  });

  it("preserves independent recipe contexts and their complete actual-base value", () => {
    const first = createWholeStorefrontRecipeContext();
    const second = createWholeStorefrontRecipeContext();
    expect(first).not.toBe(second);
    expect(first.templates).not.toBe(second.templates);
    expect(first.designSystem).not.toBe(second.designSystem);
    expect(first).toEqual(second);
    expect(hash(first)).toBe("a069e07254b1f07af2f0e03db258a5815a5b7d1de7dea79d3a8b4f706117ae95");
  });

  it.each([
    [
      "premiumEditorial",
      "homepage-editorial-storytelling",
      "c320f9957757676e16535eb945f513bcf2149b644cb568f5e4e5e551953472ac",
    ],
    [
      "modernTechnical",
      "homepage-commerce-led-discovery",
      "938a16de2e37c41af20ca3ddc16e8a8d3801a47fffa58b98d42e1fc0dbee941b",
    ],
    [
      "warmApproachable",
      "homepage-minimal-brand-commerce",
      "a929e5b4eb37e3307a05c45accc13e576858b800c13009022e6506323526a360",
    ],
  ] as const)(
    "preserves complete base target/plan/validation for %s",
    (directionId, homepageProfileId, expected) => {
      const input = structuredClone(createP905aFreshMerchantFixture(directionId).planningInput);
      const profile = listCommercialHomepageProfiles().find(
        (value) => value.profile!.id === homepageProfileId,
      )!;
      input.draft = applyCommercialSharedFrame(
        input.draft,
        profile.profile!.commercialHomepage!.defaultSharedFrameProfileId,
      );
      const before = JSON.stringify(input);
      const target = createWholeStorefrontGenerationTarget(input);
      const plan = createWholeStorefrontGenerationPlan(input, { directionId, homepageProfileId });
      const validation = validateWholeStorefrontGenerationPlan(input, plan);
      expect(
        hash({
          target: { value: target },
          plan: { value: plan },
          validation: { value: validation },
        }),
      ).toBe(expected);
      expect(JSON.stringify(input)).toBe(before);
      plan.pagePlans[0].components.splice(0);
      expect(
        createWholeStorefrontGenerationPlan(input, { directionId, homepageProfileId }),
      ).toEqual(validation);
    },
  );
});
