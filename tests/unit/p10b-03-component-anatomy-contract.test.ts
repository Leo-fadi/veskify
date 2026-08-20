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
  if (!anatomy.compatibility.responsiveModes.includes("stack")) {
    anatomy.compatibility.responsiveModes.push("stack");
  }
  const editorial = anatomy.variants.find((variant) => variant.variantId === "editorial");
  if (!editorial) throw new Error("Expected editorial dynamic PDP variant metadata.");
  editorial.classification = "meaningfulStructuralVariant";
  delete editorial.aliasOf;
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
  editorial.structure.responsiveTransformationIds = [
    "pdpHighConsiderationReflow",
    "stackPurchaseAtMobile",
  ];
  editorial.structure.presentationMode = "editorialPurchaseStack";
  return validateComponentDefinitionV2(definition);
}

function anatomyOf(definition: ComponentDefinitionV2) {
  const anatomy = definition.commercialAnatomy;
  if (!anatomy) throw new Error("Expected registered commercial anatomy.");
  return anatomy;
}

function editorialStructureOf(definition: ComponentDefinitionV2) {
  const editorial = anatomyOf(definition).variants.find(
    (variant) => variant.variantId === "editorial",
  );
  if (!editorial) throw new Error("Expected editorial variant anatomy.");
  return editorial.structure;
}

function addContentInput(
  definition: ComponentDefinitionV2,
  reference: string,
  schemaProperties: Record<string, unknown>,
) {
  Object.assign(definition.contentSchema.properties, schemaProperties);
  anatomyOf(definition).parameters.push({
    id: `contentInput.content.${reference}`,
    kind: "contentInput",
    source: "content",
    reference,
  });
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
      expectedAnatomyVersion: { major: 1, minor: 2, patch: 0 },
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

  it("accepts normal mutable content inputs", () => {
    const definition = meaningfulProductDefinition();
    expect(anatomyOf(definition).parameters).toContainEqual(
      expect.objectContaining({
        kind: "contentInput",
        source: "content",
        reference: "supportingHeading",
      }),
    );
    expect(() => validateComponentDefinitionV2(definition)).not.toThrow();
  });

  it("rejects content inputs protected by component read-only authority", () => {
    const definition = meaningfulProductDefinition();
    definition.protectedFields.readOnlyPaths.push("content.trustItems");
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /Commercial mutable parameters cannot reference protected read-only authority/i,
    );
  });

  it("rejects content inputs overlapping canonical protected commerce authority", () => {
    const definition = meaningfulProductDefinition();
    addContentInput(definition, "productIds", {
      productIds: { type: "array", items: { type: "string" } },
    });
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /Commercial mutable parameters cannot reference protected read-only authority/i,
    );
  });

  it("rejects a mutable parent path that contains a protected child", () => {
    const definition = meaningfulProductDefinition();
    addContentInput(definition, "commercialBlock", {
      commercialBlock: {
        type: "object",
        properties: {
          label: { type: "string" },
          protectedValue: { type: "string" },
        },
        required: [],
        additionalProperties: false,
      },
    });
    definition.protectedFields.readOnlyPaths.push("content.commercialBlock.protectedValue");
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /Commercial mutable parameters cannot reference protected read-only authority/i,
    );
  });

  it("rejects a mutable child path beneath a protected parent", () => {
    const definition = meaningfulProductDefinition();
    addContentInput(definition, "commercialBlock.label", {
      commercialBlock: {
        type: "object",
        properties: { label: { type: "string" } },
        required: [],
        additionalProperties: false,
      },
    });
    definition.protectedFields.readOnlyPaths.push("content.commercialBlock");
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /Commercial mutable parameters cannot reference protected read-only authority/i,
    );
  });

  it("continues to reject protected structural and semantic-finishing paths", () => {
    const structural = meaningfulProductDefinition();
    structural.editablePresentationFields = structural.editablePresentationFields.filter(
      (field) => field.path !== "props.galleryLayout",
    );
    structural.protectedFields.readOnlyPaths.push("props.galleryLayout");
    expect(() => validateComponentDefinitionV2(structural)).toThrow(
      /Commercial mutable parameters cannot reference protected read-only authority/i,
    );

    const finishing = meaningfulProductDefinition();
    finishing.editablePresentationFields = finishing.editablePresentationFields.filter(
      (field) => field.path !== "styleOverrides.surfaceTreatment",
    );
    finishing.protectedFields.readOnlyPaths.push("styleOverrides.surfaceTreatment");
    expect(() => validateComponentDefinitionV2(finishing)).toThrow(
      /Commercial mutable parameters cannot reference protected read-only authority/i,
    );
  });

  it("keeps canonical commerce-binding and asset-role references legitimate", () => {
    const definition = meaningfulProductDefinition();
    definition.protectedFields.readOnlyPaths.push("primaryProduct", "productMedia");
    expect(anatomyOf(definition).parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "commerceBinding", reference: "primaryProduct" }),
        expect.objectContaining({ kind: "assetRole", reference: "productMedia" }),
      ]),
    );
    expect(() => validateComponentDefinitionV2(definition)).not.toThrow();
  });

  it("never generates a manifest that advertises protected mutable content", () => {
    const definition = meaningfulProductDefinition();
    definition.protectedFields.readOnlyPaths.push("content.trustItems");
    expect(() => authority([definition])).toThrow(
      /Commercial mutable parameters cannot reference protected read-only authority/i,
    );
  });

  it("accepts required and optional regions when they are realized", () => {
    const definition = meaningfulProductDefinition();
    const structure = editorialStructureOf(definition);
    expect(structure.regionOrder).toEqual(expect.arrayContaining(["frame", "metadata"]));
    expect(() => validateComponentDefinitionV2(definition)).not.toThrow();
  });

  it("rejects a required region missing from realized region order", () => {
    const definition = meaningfulProductDefinition();
    const structure = editorialStructureOf(definition);
    structure.regionOrder = structure.regionOrder.filter((region) => region !== "frame");
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /must realize required semantic region frame/i,
    );
  });

  it("rejects a required region declared as omitted", () => {
    const definition = meaningfulProductDefinition();
    const structure = editorialStructureOf(definition);
    structure.regionOrder = structure.regionOrder.filter((region) => region !== "frame");
    structure.omittedRegions.push("frame");
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /must realize required semantic region frame/i,
    );
  });

  it("allows an optional region to be explicitly omitted", () => {
    const definition = meaningfulProductDefinition();
    const structure = editorialStructureOf(definition);
    structure.regionOrder = structure.regionOrder.filter((region) => region !== "metadata");
    structure.omittedRegions.push("metadata");
    expect(() => validateComponentDefinitionV2(definition)).not.toThrow();
  });

  it("rejects a region that is simultaneously realized and omitted", () => {
    const definition = meaningfulProductDefinition();
    editorialStructureOf(definition).omittedRegions.push("metadata");
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /omitted region cannot remain in the realized region order/i,
    );
  });

  it("rejects asset placement into an omitted region", () => {
    const definition = meaningfulProductDefinition();
    const structure = editorialStructureOf(definition);
    structure.regionOrder = structure.regionOrder.filter((region) => region !== "media");
    structure.omittedRegions.push("media");
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /asset placement productMedia must target a realized, non-omitted region/i,
    );
  });

  it("accepts asset placement into a realized region", () => {
    const definition = meaningfulProductDefinition();
    const structure = editorialStructureOf(definition);
    expect(structure.assetPlacements).toContainEqual({
      slotId: "productMedia",
      region: "media",
    });
    expect(() => validateComponentDefinitionV2(definition)).not.toThrow();
  });

  it("continues to reject asset placement into an undeclared region", () => {
    const definition = meaningfulProductDefinition();
    editorialStructureOf(definition).assetPlacements[0].region = "utility";
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /references undeclared semantic region utility/i,
    );
  });

  it("cannot generate or return commercial-ready capability with incomplete required anatomy", () => {
    const definition = meaningfulProductDefinition();
    const structure = editorialStructureOf(definition);
    structure.regionOrder = structure.regionOrder.filter((region) => region !== "frame");
    expect(() => authority([definition])).toThrow(/must realize required semantic region frame/i);
  });

  it("keeps required-region validation independent of variant declaration order", () => {
    const definition = meaningfulProductDefinition();
    const structure = editorialStructureOf(definition);
    structure.regionOrder = structure.regionOrder.filter((region) => region !== "frame");
    const reversed = structuredClone(definition);
    anatomyOf(reversed).variants.reverse();
    expect(() => validateComponentDefinitionV2(definition)).toThrow(
      /must realize required semantic region frame/i,
    );
    expect(() => validateComponentDefinitionV2(reversed)).toThrow(
      /must realize required semantic region frame/i,
    );
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
    expect(entry?.commercialAnatomy?.responsiveTransformations).toHaveLength(4);
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
    expect(veskifyComponentDefinitionsV2).toHaveLength(29);
    expect(
      veskifyComponentDefinitionsV2.reduce(
        (total, definition) => total + definition.variants.length,
        0,
      ),
    ).toBe(126);
    const promotedCommercialDefinitions = new Set([
      "homepageHero",
      "homepagePromotion",
      "homepageEditorial",
      "homepageProof",
      "contentSupport",
      "dynamicProductDetail",
    ]);
    const p10b10CollectionVariants = new Set([
      "editorialDiscovery",
      "catalogueComparison",
      "campaignLedDiscovery",
      "denseSearch",
    ]);
    const contentSupportAliases: ReadonlyMap<string, string> = new Map([
      ["locationAppointments", "locationDirectory"],
      ["faqTopicGuide", "faqDisclosure"],
    ]);
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
      if (["header", "footer"].includes(definition.type)) {
        expect(
          entry?.variants.filter(
            (variant) => variant.structuralClassification === "meaningfulStructuralVariant",
          ).length,
        ).toBeGreaterThanOrEqual(4);
      } else if (["productGrid", "relatedProducts"].includes(definition.type)) {
        expect(
          entry?.variants.every(
            (variant) =>
              variant.structuralClassification === "legacySuperseded" &&
              variant.materialDifferences.length === 0,
          ),
        ).toBe(true);
      } else if (definition.type === "dynamicCollectionCommerce") {
        expect(
          entry?.variants.every((variant) =>
            p10b10CollectionVariants.has(variant.id)
              ? variant.structuralClassification === "meaningfulStructuralVariant" &&
                variant.materialDifferences.length >= 3
              : variant.structuralClassification === "notYetP10BCommercialReady" &&
                variant.materialDifferences.length === 0,
          ),
        ).toBe(true);
      } else if (definition.type === "commerceUtility") {
        expect(
          entry?.variants.every(
            (variant) =>
              variant.structuralClassification === "meaningfulStructuralVariant" &&
              variant.materialDifferences.length >= 1,
          ),
        ).toBe(true);
      } else if (definition.type === "contentSupport") {
        expect(
          entry?.variants.every((variant) => {
            const aliasOf = contentSupportAliases.get(variant.id);
            if (!aliasOf) {
              return (
                variant.structuralClassification === "meaningfulStructuralVariant" &&
                variant.materialDifferences.length >= 1
              );
            }
            const anatomyVariant = anatomy?.variants.find(
              ({ variantId }) => variantId === variant.id,
            );
            return (
              variant.structuralClassification === "compatibilityAlias" &&
              variant.materialDifferences.length === 0 &&
              anatomyVariant?.aliasOf === aliasOf
            );
          }),
        ).toBe(true);
      } else if (!promotedCommercialDefinitions.has(definition.type)) {
        expect(
          entry?.variants.every(
            (variant) =>
              variant.structuralClassification === "notYetP10BCommercialReady" &&
              variant.materialDifferences.length === 0,
          ),
        ).toBe(true);
      }
    }
  });

  it("keeps current P10A capability consumers valid", () => {
    const reference = skillCapabilityKnowledge.getManifestReference();
    const components = skillCapabilityKnowledge.listCompatibleComponents({
      manifest: reference,
      pageType: "home",
    });
    expect(reference.version).toBe("1.3.0");
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
