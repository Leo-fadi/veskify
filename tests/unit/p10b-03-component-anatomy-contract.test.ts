import { describe, expect, it } from "vitest";
import { skillCapabilityKnowledge } from "@/application/design-skills";
import {
  dynamicProductDetailDefinition,
  veskifyComponentCapabilityManifest,
  veskifyComponentDefinitionsV2,
} from "@/components/registry";
import {
  CommercialCapabilityError,
  componentCommercialAnatomySchema,
  componentSemanticRegionSchema,
  componentVariantStructuralClassificationSchema,
  createComponentCapabilityManifestAuthority,
  validateComponentDefinitionV2,
  type ComponentDefinitionV2,
} from "@/domain/component-platform";

function authority(definitions: readonly unknown[]) {
  return createComponentCapabilityManifestAuthority({
    componentDefinitions: definitions,
    executableProfiles: [],
    validateExecutableProfile: () => {
      throw new Error("No executable profiles are supplied to this focused anatomy authority.");
    },
  });
}

function mutableProductDefinition(): ComponentDefinitionV2 {
  return structuredClone(dynamicProductDetailDefinition);
}

function meaningfulProductDefinition(): ComponentDefinitionV2 {
  const definition = mutableProductDefinition();
  const anatomy = definition.commercialAnatomy;
  if (!anatomy) throw new Error("Expected registered dynamic PDP anatomy.");
  anatomy.responsiveTransformations.push({
    id: "stackPurchaseAtMobile",
    mode: "stack",
    breakpoints: ["mobile"],
    fromPresentationMode: "commerceBaseline",
    toPresentationMode: "editorialPurchaseStack",
    affectedRegions: ["media", "content", "actions"],
  });
  anatomy.compatibility.responsiveModes.push("stack");
  const editorial = anatomy.variants.find((variant) => variant.variantId === "editorial");
  if (!editorial) throw new Error("Expected editorial dynamic PDP variant metadata.");
  editorial.classification = "meaningfulStructuralVariant";
  editorial.materialDifferences = [
    "hierarchy",
    "regionArrangement",
    "ctaRelationship",
    "responsiveTransformation",
    "presentationMode",
  ];
  editorial.structure.regionOrder = [
    "frame",
    "content",
    "media",
    "heading",
    "merchandising",
    "price",
    "metadata",
    "actions",
  ];
  editorial.structure.ctaRelationship = "sticky";
  editorial.structure.responsiveTransformationIds = ["preserveRegistered", "stackPurchaseAtMobile"];
  editorial.structure.presentationMode = "editorialPurchaseStack";
  return validateComponentDefinitionV2(definition);
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return error instanceof CommercialCapabilityError ? error.code : "unexpected";
  }
  return undefined;
}

describe("P10B-03 component anatomy and meaningful variants", () => {
  it("validates the closed anatomy schema and semantic region vocabulary", () => {
    const anatomy = dynamicProductDetailDefinition.commercialAnatomy;
    expect(() => componentCommercialAnatomySchema.parse(anatomy)).not.toThrow();
    expect(componentSemanticRegionSchema.options).toEqual(
      expect.arrayContaining([
        "frame",
        "navigation",
        "media",
        "content",
        "heading",
        "body",
        "merchandising",
        "price",
        "metadata",
        "proof",
        "actions",
        "utility",
        "continuation",
      ]),
    );
  });

  it("fingerprints anatomy deterministically through generated capability authority", () => {
    const definition = meaningfulProductDefinition();
    const first = authority([definition]);
    const reordered = structuredClone(definition);
    const anatomy = reordered.commercialAnatomy;
    if (!anatomy) throw new Error("Expected commercial anatomy.");
    anatomy.parameters.reverse();
    anatomy.responsiveTransformations.reverse();
    anatomy.compatibility.brandPostures.reverse();
    anatomy.compatibility.responsiveModes.reverse();
    const second = authority([validateComponentDefinitionV2(reordered)]);

    expect(first.getCommercialAnatomy(definition.type)?.fingerprint).toBe(
      second.getCommercialAnatomy(definition.type)?.fingerprint,
    );
    expect(first.manifest.fingerprint).toBe(second.manifest.fingerprint);
  });

  it("rejects duplicate semantic regions", () => {
    const definition = mutableProductDefinition();
    const anatomy = definition.commercialAnatomy;
    if (!anatomy) throw new Error("Expected commercial anatomy.");
    anatomy.regions.push(structuredClone(anatomy.regions[0]));
    expect(() => validateComponentDefinitionV2(definition)).toThrow(/regions.*duplicates/i);
  });

  it("accepts a meaningful variant only when its registered structure realizes the declaration", () => {
    const definition = meaningfulProductDefinition();
    const capability = authority([definition]).requireCommercialReadyVariant({
      componentType: definition.type,
      variant: "editorial",
      expectedAnatomyIdentity: "dynamicProductDetail.anatomy",
      expectedAnatomyVersion: { major: 1, minor: 0, patch: 0 },
      pageType: "product",
      narrativeRole: "product-focus",
      assetRoles: ["productMainImage"],
    });
    expect(capability.variant.structuralClassification).toBe("meaningfulStructuralVariant");
    expect(capability.variant.materialDifferences).toContain("regionArrangement");
  });

  it("prevents a CSS or finishing-only alias from claiming meaningful structure", () => {
    const definition = mutableProductDefinition();
    const anatomy = definition.commercialAnatomy;
    if (!anatomy) throw new Error("Expected commercial anatomy.");
    const baseline = anatomy.variants.find((variant) => variant.variantId === "balanced");
    const compact = anatomy.variants.find((variant) => variant.variantId === "compact");
    if (!baseline || !compact) throw new Error("Expected baseline and compact variants.");
    compact.classification = "meaningfulStructuralVariant";
    compact.materialDifferences = ["presentationMode"];
    compact.finishingTokenIds = ["class.storeVariantCompact"];
    compact.structure = structuredClone(baseline.structure);
    expect(() => validateComponentDefinitionV2(definition)).toThrow(/does not realize/i);
  });

  it("requires the structural declaration to classify every registered variant", () => {
    const definition = meaningfulProductDefinition();
    const anatomy = definition.commercialAnatomy;
    if (!anatomy) throw new Error("Expected commercial anatomy.");
    anatomy.variants.pop();
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /classify every registered variant/i,
    );
  });

  it("accepts only typed P10B-01 responsive transformation vocabulary", () => {
    const definition = mutableProductDefinition();
    const anatomy = definition.commercialAnatomy;
    if (!anatomy) throw new Error("Expected commercial anatomy.");
    Reflect.set(anatomy.responsiveTransformations[0], "mode", "cssMediaQuery");
    expect(() => validateComponentDefinitionV2(definition)).toThrow();
  });

  it("fails closed for incompatible page families and narrative roles", () => {
    const definition = meaningfulProductDefinition();
    const generated = authority([definition]);
    expect(
      errorCode(() =>
        generated.requireCommercialReadyVariant({
          componentType: definition.type,
          variant: "editorial",
          pageType: "home",
        }),
      ),
    ).toBe("incompatiblePageFamily");
    expect(
      errorCode(() =>
        generated.requireCommercialReadyVariant({
          componentType: definition.type,
          variant: "editorial",
          narrativeRole: "orientation",
        }),
      ),
    ).toBe("incompatibleNarrativeRole");
  });

  it("rejects invalid and stale asset requirements", () => {
    const definition = meaningfulProductDefinition();
    const anatomy = definition.commercialAnatomy;
    if (!anatomy) throw new Error("Expected commercial anatomy.");
    anatomy.compatibility.assetRequirements[0].acceptedRoles = ["logo"];
    expect(() => validateComponentDefinitionV2(definition)).toThrow(/invalid or stale/i);
  });

  it("exposes anatomy, parameters, transformations, roles and assets in generated capability", () => {
    const entry = veskifyComponentCapabilityManifest.getByComponentType("dynamicProductDetail");
    expect(entry?.commercialAnatomy).toMatchObject({
      identity: "dynamicProductDetail.anatomy",
      contractVersion: "1.0.0",
    });
    expect(entry?.commercialAnatomy?.parameters.map((parameter) => parameter.kind)).toEqual(
      expect.arrayContaining([
        "structural",
        "semanticFinishing",
        "contentInput",
        "commerceBinding",
        "assetRole",
      ]),
    );
    expect(entry?.commercialAnatomy?.responsiveTransformations).toHaveLength(1);
    expect(entry?.commercialAnatomy?.compatibility.narrativeRoles).toContain("product-focus");
    expect(entry?.commercialAnatomy?.compatibility.assetRequirements[0].slotId).toBe(
      "productMedia",
    );
  });

  it("rejects missing and stale anatomy when commercial-ready capability is required", () => {
    const definition = meaningfulProductDefinition();
    const generated = authority([definition]);
    expect(
      errorCode(() =>
        generated.requireCommercialReadyVariant({
          componentType: definition.type,
          variant: "editorial",
          expectedAnatomyVersion: { major: 2, minor: 0, patch: 0 },
        }),
      ),
    ).toBe("staleAnatomy");

    const missing = structuredClone(definition);
    delete missing.commercialAnatomy;
    expect(
      errorCode(() =>
        authority([missing]).requireCommercialReadyVariant({
          componentType: definition.type,
          variant: "editorial",
        }),
      ),
    ).toBe("missingAnatomy");
  });

  it("classifies every current registry variant without false commercial-ready promotion", () => {
    expect(componentVariantStructuralClassificationSchema.options).toEqual([
      "meaningfulStructuralVariant",
      "finishingOnlyVariation",
      "compatibilityAlias",
      "legacySuperseded",
      "notYetP10BCommercialReady",
    ]);
    expect(veskifyComponentDefinitionsV2).toHaveLength(25);
    expect(
      veskifyComponentDefinitionsV2.reduce(
        (total, definition) => total + definition.variants.length,
        0,
      ),
    ).toBe(91);
    for (const definition of veskifyComponentDefinitionsV2) {
      const anatomy = definition.commercialAnatomy;
      expect(anatomy, definition.type).toBeDefined();
      expect(anatomy?.variants.map((variant) => variant.variantId).sort()).toEqual(
        definition.variants.map((variant) => variant.id).sort(),
      );
      const entry = veskifyComponentCapabilityManifest.getByComponentType(definition.type);
      expect(
        entry?.variants.every((variant) => variant.structuralClassification !== "unclassified"),
      ).toBe(true);
      expect(
        entry?.variants.every(
          (variant) =>
            variant.structuralClassification === "notYetP10BCommercialReady" &&
            variant.materialDifferences.length === 0,
        ),
      ).toBe(true);
    }
  });

  it("keeps current P10A capability consumers valid", () => {
    const reference = skillCapabilityKnowledge.getManifestReference();
    const components = skillCapabilityKnowledge.listCompatibleComponents({
      manifest: reference,
      pageType: "home",
    });
    expect(reference.version).toBe("1.2.0");
    expect(components.length).toBeGreaterThan(0);
    expect(components.every((component) => component.variants.length > 0)).toBe(true);
  });

  it("resolves anatomy migrations deterministically", () => {
    const definition = meaningfulProductDefinition();
    const anatomy = definition.commercialAnatomy;
    if (!anatomy) throw new Error("Expected commercial anatomy.");
    anatomy.version = { major: 2, minor: 0, patch: 0 };
    anatomy.migration = {
      policy: "migrationRequired",
      previousVersions: [{ major: 1, minor: 0, patch: 0 }],
      migrations: [
        {
          fromVersion: { major: 1, minor: 0, patch: 0 },
          toVersion: { major: 2, minor: 0, patch: 0 },
          strategy: "registeredFunction",
          migrationId: "dynamicProductDetailAnatomyV1ToV2",
        },
      ],
    };
    const parsed = validateComponentDefinitionV2(definition);
    const first = authority([parsed]);
    const second = authority([structuredClone(parsed)]);
    expect(
      first.getCommercialAnatomyMigration(definition.type, { major: 1, minor: 0, patch: 0 }),
    ).toEqual(
      second.getCommercialAnatomyMigration(definition.type, { major: 1, minor: 0, patch: 0 }),
    );
    expect(first.getCommercialAnatomy(definition.type)?.fingerprint).toBe(
      second.getCommercialAnatomy(definition.type)?.fingerprint,
    );
  });
});
