import { describe, expect, it } from "vitest";
import {
  STOREFRONT_TEMPLATE_SCHEMA_VERSION,
  cloneTemplateDefinition,
  resolveTemplate,
  getTemplateById,
  getTemplatePagePlan,
  listTemplates,
  storefrontTemplateDefinitionSchema,
  storefrontTemplateDefinitions,
  validateTemplateRegistry,
} from "@/application/storefront-templates";
import { veskifyComponentRegistry } from "@/components/registry";
import { supportedSectionManifest } from "@/components/registry/supported-vocabulary";

const requiredCapabilities = ["collection-pages-requested", "product-pages-requested"] as const;
const allCapabilities = [
  ...requiredCapabilities,
  "catalogue-available",
  "logo-available",
  "supporting-imagery-available",
] as const;

describe("controlled storefront template registry", () => {
  it("validates all initial templates with complete localized metadata and page coverage", () => {
    expect(storefrontTemplateDefinitions).toHaveLength(3);
    expect(validateTemplateRegistry()).toHaveLength(3);
    listTemplates().forEach((template) => {
      expect(template.schemaVersion).toBe(STOREFRONT_TEMPLATE_SCHEMA_VERSION);
      expect(template.supportedPageTypes).toEqual(["home", "collection", "product"]);
      expect(template.pagePlans.map((plan) => plan.pageType)).toEqual([
        "home",
        "collection",
        "product",
      ]);
      expect(template.name.en).toBeTruthy();
      expect(template.name.fi).toBeTruthy();
      expect(template.description.en).toBeTruthy();
      expect(template.description.fi).toBeTruthy();
    });
  });

  it("requires the complete controlled product foundation in every built-in template", () => {
    const requiredProductSections = ["productGallery", "productInfo", "benefitIcons", "imageText"];
    listTemplates().forEach((template) => {
      const product = template.pagePlans.find((plan) => plan.pageType === "product");
      expect(product).toBeDefined();
      if (!product) return;
      const sections = product.slots.map((slot) => slot.sectionType);
      requiredProductSections.forEach((section) => expect(sections).toContain(section));
      expect(sections).toContain("relatedProducts");
      requiredProductSections.forEach((section) => {
        const slot = product.slots.find((candidate) => candidate.sectionType === section);
        expect(slot?.required).toBe(true);
        expect(slot?.omitWhen).toBe("never");
      });
    });
  });

  it("keeps trust and details between product information and related products", () => {
    for (const templateId of [
      "template_balanced_commerce",
      "template_catalogue_forward_commerce",
    ]) {
      const plan = getTemplatePagePlan(templateId, "product");
      expect(plan?.slots.map((slot) => slot.sectionType)).toEqual([
        "header",
        "productGallery",
        "productInfo",
        "productOptions",
        "benefitIcons",
        "imageText",
        "relatedProducts",
        "footer",
      ]);
    }
  });

  it.each([
    ["benefitIcons", "benefitIcons"],
    ["imageText", "imageText"],
  ] as const)("rejects a product plan missing %s", (_label, sectionType) => {
    const changed = structuredClone(getTemplateById("template_balanced_commerce")!);
    const product = changed.pagePlans.find((plan) => plan.pageType === "product")!;
    product.slots = product.slots.filter((slot) => slot.sectionType !== sectionType);
    expect(() => validateTemplateRegistry([changed])).toThrow(
      `template_balanced_commerce/product requires ${sectionType}`,
    );
  });

  it("rejects duplicate template IDs and duplicate slot IDs", () => {
    const first = structuredClone(storefrontTemplateDefinitions[0]);
    expect(() => validateTemplateRegistry([first, first])).toThrow(/Template IDs/);

    const duplicateSlot = structuredClone(storefrontTemplateDefinitions[0]);
    duplicateSlot.pagePlans[0].slots[1].id = duplicateSlot.pagePlans[0].slots[0].id;
    expect(() => validateTemplateRegistry([duplicateSlot])).toThrow(/Slot IDs/);
  });

  it.each([
    [
      "unsupported section",
      (template: (typeof storefrontTemplateDefinitions)[number]) => {
        const changed = structuredClone(template);
        changed.pagePlans[0].slots[0].sectionType = "unknown-section";
        return changed;
      },
    ],
    [
      "unsupported variant",
      (template: (typeof storefrontTemplateDefinitions)[number]) => {
        const changed = structuredClone(template);
        changed.pagePlans[0].slots[0].allowedVariants = ["unknown-variant"];
        changed.pagePlans[0].slots[0].defaultVariant = "unknown-variant";
        return changed;
      },
    ],
    [
      "invalid footer ordering",
      (template: (typeof storefrontTemplateDefinitions)[number]) => {
        const changed = structuredClone(template);
        const home = changed.pagePlans[0];
        home.slots = [home.slots.at(-1)!, ...home.slots.slice(0, -1)];
        return changed;
      },
    ],
    [
      "omitted required hero",
      (template: (typeof storefrontTemplateDefinitions)[number]) => {
        const changed = structuredClone(template);
        const hero = changed.pagePlans[0].slots.find((slot) => slot.sectionType === "hero");
        if (!hero) throw new Error("Expected a hero slot.");
        hero.required = false;
        return changed;
      },
    ],
    [
      "duplicated protected header",
      (template: (typeof storefrontTemplateDefinitions)[number]) => {
        const changed = structuredClone(template);
        const home = changed.pagePlans[0];
        home.slots.splice(2, 0, { ...home.slots[1], id: "header-secondary" });
        return changed;
      },
    ],
  ])("rejects %s", (_name, mutate) => {
    expect(() => validateTemplateRegistry([mutate(storefrontTemplateDefinitions[0])])).toThrow();
  });

  it("rejects invalid required and default slot rules at schema validation", () => {
    const requiredWithOmission = structuredClone(storefrontTemplateDefinitions[0]);
    requiredWithOmission.pagePlans[0].slots[1].omitWhen = "when-not-requested";
    expect(() => storefrontTemplateDefinitionSchema.parse(requiredWithOmission)).toThrow(
      /Required slots/,
    );

    const invalidDefault = structuredClone(storefrontTemplateDefinitions[0]);
    invalidDefault.pagePlans[0].slots[1].defaultVariant = "not-allowed";
    expect(() => storefrontTemplateDefinitionSchema.parse(invalidDefault)).toThrow(
      /default variant/,
    );
  });

  it("keeps every referenced section and variant aligned with the executable renderer registry", () => {
    const approvedHeroVariants = ["editorial", "fullBleed", "asymmetric", "restrained"];
    expect(supportedSectionManifest.hero.variants).toEqual(approvedHeroVariants);
    listTemplates().forEach((template) =>
      template.pagePlans.forEach((plan) =>
        plan.slots.forEach((slot) => {
          const definition =
            veskifyComponentRegistry[slot.sectionType as keyof typeof veskifyComponentRegistry];
          expect(definition).toBeDefined();
          expect(definition.allowedPageTypes).toContain(plan.pageType);
          slot.allowedVariants.forEach((variant) => expect(definition.variants).toContain(variant));
        }),
      ),
    );
    listTemplates().forEach((template) => {
      const hero = template.pagePlans
        .find((plan) => plan.pageType === "home")
        ?.slots.find((slot) => slot.id === "hero");
      expect(hero).toBeDefined();
      if (!hero) return;
      const definition =
        veskifyComponentRegistry[hero.sectionType as keyof typeof veskifyComponentRegistry];
      expect(hero.allowedVariants).toEqual(definition.variants);
      approvedHeroVariants.forEach((variant) => expect(hero.allowedVariants).toContain(variant));
    });
    expect(Object.keys(supportedSectionManifest).sort()).toEqual(
      Object.keys(veskifyComponentRegistry).sort(),
    );
  });

  it("returns detached immutable values and protects registry state", () => {
    const first = listTemplates()[0];
    const second = listTemplates()[0];
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.pagePlans[0])).toBe(true);
    expect(Object.isFrozen(first.pagePlans[0].slots[0])).toBe(true);
    expect(() => {
      (first.pagePlans[0].slots[0] as { id: string }).id = "changed";
    }).toThrow();
    expect(listTemplates()[0].pagePlans[0].slots[0].id).toBe("announcement");
    expect(cloneTemplateDefinition(first)).not.toBe(first);
  });

  it("resolves each page plan by canonical template and page ID", () => {
    const template = getTemplateById("template_balanced_commerce");
    expect(template).toBeDefined();
    expect(getTemplatePagePlan("template_balanced_commerce", "collection")?.pageType).toBe(
      "collection",
    );
    expect(getTemplatePagePlan("template_balanced_commerce", "content")).toBeUndefined();
  });
});

describe("deterministic template resolution", () => {
  it("resolves an existing catalogue with no compatibility errors", () => {
    const result = resolveTemplate({
      templateId: "template_brand_led_editorial",
      catalogueContext: "existing",
      availableCapabilities: allCapabilities,
    });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.plan.compatible).toBe(true);
    expect(result.plan.errors).toEqual([]);
    expect(result.plan.pagePlans).toHaveLength(3);
  });

  it("returns structured missing-capability errors without throwing", () => {
    const result = resolveTemplate({
      templateId: "template_balanced_commerce",
      catalogueContext: "existing",
      availableCapabilities: [],
    });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.plan.compatible).toBe(false);
    expect(result.plan.errors.map((error) => error.code)).toEqual([
      "MISSING_REQUIRED_CAPABILITY",
      "MISSING_REQUIRED_CAPABILITY",
    ]);
  });

  it("returns non-blocking warnings for empty and demo catalogue contexts", () => {
    const empty = resolveTemplate({
      templateId: "template_catalogue_forward_commerce",
      catalogueContext: "empty",
      availableCapabilities: requiredCapabilities,
    });
    expect(empty).toMatchObject({ status: "resolved", plan: { compatible: true } });
    if (empty.status === "resolved") {
      expect(empty.plan.warnings.map((warning) => warning.code)).toContain(
        "EMPTY_CATALOGUE_MERCHANDISING",
      );
      expect(empty.plan.errors).toEqual([]);
    }

    const demo = resolveTemplate({
      templateId: "template_catalogue_forward_commerce",
      catalogueContext: "demo",
      availableCapabilities: requiredCapabilities,
    });
    if (demo.status === "resolved") {
      expect(demo.plan.warnings.map((warning) => warning.code)).toContain("DEMO_CATALOGUE_CONTENT");
    }
  });

  it("reports unsupported requested pages and unknown templates", () => {
    const pageResult = resolveTemplate({
      templateId: "template_balanced_commerce",
      catalogueContext: "existing",
      availableCapabilities: requiredCapabilities,
      requestedPageTypes: ["content"],
    });
    expect(pageResult).toMatchObject({
      status: "resolved",
      plan: {
        compatible: false,
        errors: [{ code: "UNSUPPORTED_REQUESTED_PAGE", pageType: "content" }],
      },
    });

    expect(
      resolveTemplate({
        templateId: "missing-template",
        catalogueContext: "existing",
        availableCapabilities: requiredCapabilities,
      }),
    ).toMatchObject({ status: "not-found", error: { code: "TEMPLATE_NOT_FOUND" } });
  });

  it("keeps a resolved plan immutable and filters requested page plans deterministically", () => {
    const result = resolveTemplate({
      templateId: "template_balanced_commerce",
      catalogueContext: "existing",
      availableCapabilities: requiredCapabilities,
      requestedPageTypes: ["home", "product"],
    });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.plan.pagePlans.map((plan) => plan.pageType)).toEqual(["home", "product"]);
    expect(Object.isFrozen(result.plan)).toBe(true);
    expect(Object.isFrozen(result.plan.pagePlans[0].slots[0])).toBe(true);
  });
});
