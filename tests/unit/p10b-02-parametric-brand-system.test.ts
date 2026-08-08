import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adaptLegacyCommercialDesignGrammar,
  commercialDesignGrammarKnowledge,
} from "@/application/design-skills";
import {
  getExecutablePageBlueprintProfile,
  materializeExecutablePageBlueprint,
} from "@/application/storefront-templates";
import {
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import {
  applyBrandSystemFoundationPatch,
  aurumNordicBrandSystem,
  brandSystemDesignDnaFingerprint,
  brandSystemSchema,
  brandSystemToCssVariables,
  contrastRatio,
  designDnaFingerprint,
  designDnaSchema,
  migrateLegacyFoundationToDesignDna,
  migrateBrandSystemDesignDna,
  modernTechnicalDesignDna,
  normalizeDesignDna,
  premiumEditorialDesignDna,
  projectBrandSystemDesignDna,
  projectDesignDna,
  readableForegroundAcrossBackgrounds,
  standardTextContrastMinimum,
} from "@/domain/design-system";
import { InMemoryProjectRepository } from "@/services/storage";

function aggregate() {
  return {
    project: structuredClone(aurumNordicSeed.project),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    snapshots: [
      structuredClone(aurumNordicSeed.publishedSnapshot),
      structuredClone(aurumNordicSeed.draftSnapshot),
    ],
  };
}

function materialization() {
  const pagePlan = getExecutablePageBlueprintProfile("blueprint-balanced-home");
  if (!pagePlan?.profile) throw new Error("Expected the balanced homepage profile.");
  return materializeExecutablePageBlueprint({
    pagePlan,
    componentDefinitions: veskifyComponentDefinitionsV2,
    availableBindingCategories: pagePlan.profile.requiredBindingCategories,
  });
}

describe("P10B-02 parametric BrandSystem Design DNA", () => {
  it("validates the complete bounded merchant-wide authority", () => {
    expect(designDnaSchema.parse(premiumEditorialDesignDna)).toEqual(premiumEditorialDesignDna);
    expect(premiumEditorialDesignDna.typography.roles).toHaveProperty("price");
    expect(premiumEditorialDesignDna.spacing.containers).toEqual({
      reading: "narrow",
      content: "wide",
      commerce: "wide",
      wide: "full",
      fullWidth: "contained",
    });
  });

  it("normalizes and fingerprints identical DNA deterministically", () => {
    const reordered = JSON.parse(JSON.stringify(premiumEditorialDesignDna)) as unknown;
    expect(normalizeDesignDna(reordered)).toEqual(premiumEditorialDesignDna);
    expect(designDnaFingerprint(reordered)).toBe(designDnaFingerprint(premiumEditorialDesignDna));
    expect(projectDesignDna(reordered)).toEqual(projectDesignDna(premiumEditorialDesignDna));
  });

  it("migrates every legacy BrandSystem deterministically without changing legacy intent", () => {
    const first = migrateBrandSystemDesignDna(aurumNordicBrandSystem);
    const second = migrateBrandSystemDesignDna(structuredClone(aurumNordicBrandSystem));
    expect(first).toEqual(second);
    expect(first.designDna).toBeDefined();
    expect(first.colors).toEqual(aurumNordicBrandSystem.colors);
    expect(first.typography).toEqual(aurumNordicBrandSystem.typography);
    expect(brandSystemDesignDnaFingerprint(first)).toMatch(/^design-dna-/);
  });

  it("migrates black page, white surface and white legacy text across both backgrounds", () => {
    const legacy = brandSystemSchema.parse({
      ...aurumNordicBrandSystem,
      colors: {
        ...aurumNordicBrandSystem.colors,
        background: "#000000",
        surface: "#FFFFFF",
        text: "#FFFFFF",
        mutedText: "#F5F5F5",
      },
    });
    const first = migrateLegacyFoundationToDesignDna(legacy);
    const second = migrateLegacyFoundationToDesignDna(structuredClone(legacy));

    expect(designDnaSchema.parse(first)).toEqual(first);
    expect(second).toEqual(first);
    expect(designDnaFingerprint(second)).toBe(designDnaFingerprint(first));
    for (const foreground of [first.colour.text, first.colour.mutedText]) {
      for (const background of [first.colour.page, first.colour.surface]) {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(
          standardTextContrastMinimum,
        );
      }
    }
  });

  it("preserves a merchant foreground that is already valid across every required surface", () => {
    const legacy = brandSystemSchema.parse({
      ...aurumNordicBrandSystem,
      colors: {
        ...aurumNordicBrandSystem.colors,
        background: "#FFF8F0",
        surface: "#E7D8C8",
        text: "#201A17",
        mutedText: "#514942",
      },
    });
    const dna = migrateLegacyFoundationToDesignDna(legacy);

    expect(dna.colour.text).toBe("#201A17");
    expect(
      readableForegroundAcrossBackgrounds(
        [legacy.colors.background, legacy.colors.surface],
        [legacy.colors.text, "#111111"],
      ),
    ).toBe("#201A17");
  });

  it("keeps a valid legacy BrandSystem loadable when its original surfaces are unsatisfiable", () => {
    const legacy = brandSystemSchema.parse({
      ...aurumNordicBrandSystem,
      colors: {
        ...aurumNordicBrandSystem.colors,
        background: "#737373",
        surface: "#7B7B7B",
        text: "#FFFFFF",
        mutedText: "#111111",
      },
    });

    expect(() =>
      readableForegroundAcrossBackgrounds(
        [legacy.colors.background, legacy.colors.surface],
        [legacy.colors.text, legacy.colors.mutedText],
      ),
    ).toThrow(/No bounded foreground/);
    const migrated = migrateLegacyFoundationToDesignDna(legacy);
    expect(designDnaSchema.parse(migrated)).toEqual(migrated);
    expect(brandSystemToCssVariables(legacy)).toMatchObject({
      "--brand-color-background": "#737373",
      "--brand-color-surface": "#7B7B7B",
      "--brand-color-text": "#FFFFFF",
    });
  });

  it("provides materially different identities even when their colours are identical", () => {
    expect(premiumEditorialDesignDna.colour).toEqual(modernTechnicalDesignDna.colour);
    expect(premiumEditorialDesignDna.typography).not.toEqual(modernTechnicalDesignDna.typography);
    expect(premiumEditorialDesignDna.spacing).not.toEqual(modernTechnicalDesignDna.spacing);
    expect(premiumEditorialDesignDna.controls).not.toEqual(modernTechnicalDesignDna.controls);
    expect(projectDesignDna(premiumEditorialDesignDna).fingerprint).not.toBe(
      projectDesignDna(modernTechnicalDesignDna).fingerprint,
    );
  });

  it("projects one canonical identity across shared frame, homepage, collection and PDP", () => {
    const projection = projectBrandSystemDesignDna(
      brandSystemSchema.parse({
        ...aurumNordicBrandSystem,
        designDna: premiumEditorialDesignDna,
      }),
    );
    expect(projection.appliesTo).toEqual(["sharedFrame", "home", "collection", "product"]);
    expect(projection.cssVariables["--brand-font-display"]).toContain("Georgia");
    expect(projection.cssVariables["--brand-section-rhythm"]).toContain("clamp");
    expect(projection.cssVariables).toMatchObject({
      "--brand-container-commerce": "90rem",
      "--brand-control-height": "3.25rem",
      "--brand-media-ratio": "4 / 5",
    });
  });

  it("keeps compatibility aliases separate from semantic surface and density projection", () => {
    const compact = brandSystemSchema.parse({
      ...aurumNordicBrandSystem,
      spacing: { density: "compact" },
      colors: {
        ...aurumNordicBrandSystem.colors,
        background: "#FFF8F0",
        surface: "#E7D8C8",
        text: "#201A17",
      },
    });
    const variables = brandSystemToCssVariables(compact);

    expect(variables).toMatchObject({
      "--brand-color-background": "#FFF8F0",
      "--brand-color-surface": "#E7D8C8",
      "--brand-color-text": "#201A17",
      "--brand-spacing-density": "0.85",
      "--brand-density-global": "0.86",
      "--brand-surface-page": "#FFF8F0",
      "--brand-surface-default": "#E7D8C8",
      "--brand-surface-page-text": "#201A17",
    });
  });

  it("projects and consumes ordinary and contrast surface authority independently", () => {
    const contrastIdentity = structuredClone(premiumEditorialDesignDna);
    contrastIdentity.colour.contrastSurface = "#4A0033";
    contrastIdentity.colour.contrastText = "#FFFFFF";
    const brand = brandSystemSchema.parse({
      ...aurumNordicBrandSystem,
      designDna: contrastIdentity,
    });
    const variables = brandSystemToCssVariables(brand);
    const css = readFileSync("src/components/storefront/homepage-commerce.module.css", "utf8");

    expect(variables).toMatchObject({
      "--brand-surface-page": contrastIdentity.colour.page,
      "--brand-surface-page-text": contrastIdentity.colour.text,
      "--brand-surface-default": contrastIdentity.colour.surface,
      "--brand-surface-default-text": contrastIdentity.colour.text,
      "--brand-surface-contrast": "#4A0033",
      "--brand-surface-contrast-text": "#FFFFFF",
    });
    expect(css).toMatch(
      /\.surface_contrast\s*\{[\s\S]*background:\s*var\(--brand-surface-contrast\);[\s\S]*color:\s*var\(--brand-surface-contrast-text\);/,
    );
    expect(css).toMatch(
      /\.surface_plain\s*\{[\s\S]*background:\s*var\(--brand-surface-page\);[\s\S]*color:\s*var\(--brand-surface-page-text\);/,
    );
    expect(css).toContain("--brand-surface-contrast-muted-text");
    expect(variables["--brand-surface-contrast"]).not.toBe(variables["--brand-surface-default"]);
  });

  it("preserves explicit Design DNA through save and reload", async () => {
    const value = aggregate();
    const repository = new InMemoryProjectRepository([value]);
    const draft = structuredClone(value.snapshots[1]);
    draft.id = "snapshot_p10b_02_saved";
    draft.createdAt = "2026-08-08T08:00:00.000Z";
    draft.brandSystem = brandSystemSchema.parse({
      ...draft.brandSystem,
      designDna: premiumEditorialDesignDna,
    });
    await repository.saveDraft(value.project.id, draft, {
      id: value.snapshots[1].id,
      revision: value.snapshots[1].revision,
    });
    const reloaded = await repository.get(value.project.id);
    const saved = reloaded.snapshots.find(({ id }) => id === draft.id);
    expect(saved?.brandSystem.designDna).toEqual(premiumEditorialDesignDna);
    expect(saved?.brandSystem.colors).toEqual(draft.brandSystem.colors);
    expect(brandSystemToCssVariables(saved!.brandSystem)["--brand-color-text"]).toBe(
      draft.brandSystem.colors.text,
    );
  });

  it("preserves exact Design DNA in deterministic publication output", () => {
    const value = aggregate();
    value.snapshots[1].brandSystem = brandSystemSchema.parse({
      ...value.snapshots[1].brandSystem,
      designDna: modernTechnicalDesignDna,
    });
    const compilation = compileStorefrontPublication(
      createCurrentPublishCompilerInput({
        aggregate: value,
        snapshot: value.snapshots[1],
        sourceAuthority: { kind: "manual" },
      }),
    );
    expect(compilation.result.brandSystem.designDna).toEqual(modernTechnicalDesignDna);
    expect(compilation.result.brandSystem.colors).toEqual(value.snapshots[1].brandSystem.colors);
    expect(
      brandSystemToCssVariables(compilation.result.brandSystem)["--brand-density-global"],
    ).toBe(projectDesignDna(modernTechnicalDesignDna).cssVariables["--brand-density-global"]);
  });

  it("rejects unsupported fonts and arbitrary remote font authority", () => {
    const invalid = {
      ...structuredClone(premiumEditorialDesignDna),
      typography: {
        ...premiumEditorialDesignDna.typography,
        roles: {
          ...premiumEditorialDesignDna.typography.roles,
          display: {
            ...premiumEditorialDesignDna.typography.roles.display,
            font: "https://fonts.example.invalid/font.woff2",
          },
        },
      },
    };
    expect(() => designDnaSchema.parse(invalid)).toThrow();
  });

  it("rejects invalid type-scale ranges and arbitrary spacing", () => {
    const scale = {
      ...structuredClone(premiumEditorialDesignDna),
      typography: {
        ...premiumEditorialDesignDna.typography,
        scale: { ...premiumEditorialDesignDna.typography.scale, ratio: 1.9 },
      },
    };
    expect(() => designDnaSchema.parse(scale)).toThrow();
    const spacing = {
      ...structuredClone(premiumEditorialDesignDna),
      spacing: { ...premiumEditorialDesignDna.spacing, pageGutter: "37px" },
    };
    expect(() => designDnaSchema.parse(spacing)).toThrow();
  });

  it("rejects contrast-invalid required semantic pairs", () => {
    const invalid = structuredClone(premiumEditorialDesignDna);
    invalid.colour.primaryActionText = invalid.colour.primaryAction;
    expect(() => designDnaSchema.parse(invalid)).toThrow(/readable/);
  });

  it("rejects arbitrary CSS and stale Design DNA versions", () => {
    const css = { ...structuredClone(premiumEditorialDesignDna), css: "body { display: none }" };
    expect(() => designDnaSchema.parse(css)).toThrow();
    const stale = { ...structuredClone(premiumEditorialDesignDna), version: "0.9.0" };
    expect(() => designDnaSchema.parse(stale)).toThrow();
  });

  it("rejects invalid semantic font-pairing relationships", () => {
    const invalid = structuredClone(modernTechnicalDesignDna);
    invalid.typography.roles.heading.font = "georgia";
    expect(() => designDnaSchema.parse(invalid)).toThrow(/sans-led/);
  });

  it("rejects malformed legacy migration input", () => {
    expect(() => migrateBrandSystemDesignDna({ colors: {} })).toThrow();
  });

  it("prevents instance authority from broadening a BrandSystem-owned DNA category", () => {
    const current = materialization();
    const layers = adaptLegacyCommercialDesignGrammar({
      brandSystem: brandSystemSchema.parse({
        ...aurumNordicBrandSystem,
        designDna: premiumEditorialDesignDna,
      }),
      materialization: current,
      slotId: current.slots[0].slotId,
      instanceSelections: { "typography.posture": "technical" },
    });
    expect(() =>
      commercialDesignGrammarKnowledge.resolve({
        reference: commercialDesignGrammarKnowledge.getReference(),
        layers,
      }),
    ).toThrow(/PROHIBITED_GRAMMAR_AUTHORITY/);
  });

  it("changes identity and projection fingerprints for a material DNA change", () => {
    const changed = structuredClone(premiumEditorialDesignDna);
    changed.spacing.sectionRhythm = "compact";
    expect(designDnaFingerprint(changed)).not.toBe(designDnaFingerprint(premiumEditorialDesignDna));
    expect(projectDesignDna(changed).fingerprint).not.toBe(
      projectDesignDna(premiumEditorialDesignDna).fingerprint,
    );
  });

  it("synchronizes legacy global operations without discarding unrelated Design DNA", () => {
    const baseline = brandSystemSchema.parse({
      ...aurumNordicBrandSystem,
      designDna: premiumEditorialDesignDna,
    });
    const changed = applyBrandSystemFoundationPatch(baseline, {
      typography: {
        ...baseline.typography,
        headingFont: "inter",
        bodyFont: "system-sans",
      },
    });
    expect(changed.designDna?.typography.roles.heading.font).toBe("inter");
    expect(changed.designDna?.typography.roles.body.font).toBe("system-sans");
    expect(changed.designDna?.colour).toEqual(premiumEditorialDesignDna.colour);
    expect(changed.designDna?.spacing).toEqual(premiumEditorialDesignDna.spacing);
  });
});
