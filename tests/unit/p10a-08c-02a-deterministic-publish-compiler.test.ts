import { describe, expect, it, vi } from "vitest";
import {
  assertMatchingPublishCompilation,
  compileStorefrontPublication,
  confirmPublish,
  createCurrentPublishCompilerInput,
  preparePublish,
  preparedPublishCompilation,
  publicPublishPreparation,
  publicPublishPreparationSchema,
  type PublishCompilerError,
  type PublishCompilerInput,
} from "@/application/publishing";
import {
  veskifyComponentCapabilityManifest,
  veskifyComponentRegistry,
  veskifyComponentRegistryV2,
} from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { validateComponentAssetAssignments } from "@/domain/component-platform";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
import { InMemoryProjectRepository } from "@/services/storage";
import { migrateApprovedPresentationArtDirection } from "@/application/responsive-image-authority";
import { resolveBrandSystemDesignDna } from "@/domain/design-system";
import { createResponsiveImageAuthority } from "@/domain/asset-presentation";

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

function manualInput(value = aggregate()): PublishCompilerInput {
  return createCurrentPublishCompilerInput({
    aggregate: value,
    snapshot: value.snapshots[1],
    sourceAuthority: { kind: "manual" },
  });
}

function currentSnapshot(input: PublishCompilerInput) {
  return storefrontSnapshotSchema.parse(input.snapshot);
}

function replaceSnapshot(
  input: PublishCompilerInput,
  mutate: (snapshot: ReturnType<typeof currentSnapshot>) => void,
) {
  const snapshot = currentSnapshot(input);
  mutate(snapshot);
  input.snapshot = snapshot;
  input.sourceSnapshotFingerprint = canonicalStorefrontContentFingerprint(snapshot);
}

async function changedRepository() {
  const repository = new InMemoryProjectRepository([aggregate()]);
  const before = await repository.get(aurumNordicSeed.project.id);
  const current = before.snapshots.find(({ id }) => id === before.project.draftSnapshotId)!;
  const draft = structuredClone(current);
  draft.id = "snapshot_publish_compiler_changed";
  draft.pages[0].title.en = "Compiler authority changed draft";
  await repository.saveDraft(before.project.id, draft, {
    id: current.id,
    revision: current.revision,
  });
  return repository;
}

function expectCompilerFailure(action: () => unknown, code: PublishCompilerError["code"]) {
  expect(action).toThrowError(expect.objectContaining({ code }));
}

function localeInput(primaryLocale: "en" | "fi", enabledLocales: Array<"en" | "fi">) {
  const value = aggregate();
  value.project.primaryLocale = primaryLocale;
  value.project.enabledLocales = enabledLocales;
  return manualInput(value);
}

function duplicateRouteInput(pageType: "home" | "collection" | "product", padded = false) {
  const input = manualInput();
  const snapshot = currentSnapshot(input);
  const source = snapshot.pages.find((page) => page.type === pageType)!;
  const duplicate = structuredClone(source);
  duplicate.id = `page_duplicate_${pageType}`;
  duplicate.slug = padded ? ` ${source.slug} ` : source.slug;
  duplicate.sections.forEach((section, index) => {
    section.id = `section_duplicate_${pageType}_${index}`;
    section.approvedAssetPlacements = (section.approvedAssetPlacements ?? []).map((placement) => ({
      ...placement,
      pageId: duplicate.id,
      componentId: section.id,
    }));
  });
  snapshot.pages.push(duplicate);
  input.snapshot = snapshot;
  input.sourceSnapshotFingerprint = canonicalStorefrontContentFingerprint(snapshot);
  return input;
}

function placementAndPresentation({
  pageId,
  sectionId,
  componentType,
  slotId,
  role,
  index,
}: {
  pageId: string;
  sectionId: string;
  componentType: string;
  slotId: string;
  role: "heroDesktop" | "collectionImage";
  index: number;
}) {
  const assetId = `asset_publish_compiler_${index}`;
  const revision = `asset-revision-${index}`;
  const materialFingerprint = `asset-material-${index}`;
  return {
    placement: {
      type: "PLACE_APPROVED_SOURCE_ASSET" as const,
      pageId,
      componentId: sectionId,
      componentType,
      assetSlotId: slotId,
      assetId,
      role,
      assetRevision: revision,
      materialFingerprint,
      sourceReferenceId: `source_publish_compiler_${index}`,
      sourceProvenanceKind: "merchantProvided" as const,
      required: false,
    },
    presentation: {
      assetId,
      role,
      revision,
      materialFingerprint,
      asset: {
        id: assetId,
        url: `/seed-assets/publish-compiler-${index}.svg`,
        alt: { en: `Publish compiler asset ${index}` },
        decorative: false,
      },
    },
  };
}

function assetInput(componentType: "homepageHero" | "homepageFeaturedCollections", count: number) {
  const value = aggregate();
  const page = value.snapshots[1].pages.find((candidate) => candidate.type === "home")!;
  const section = page.sections[0];
  const definition = veskifyComponentRegistry[componentType];
  section.component = componentType;
  section.variant = definition.defaultVariant;
  section.content = structuredClone(definition.defaultContent);
  section.props = structuredClone(definition.defaultProps);
  const slotId = componentType === "homepageHero" ? "heroMedia" : "collectionMedia";
  const role = componentType === "homepageHero" ? "heroDesktop" : "collectionImage";
  const assets = Array.from({ length: count }, (_, index) =>
    placementAndPresentation({
      pageId: page.id,
      sectionId: section.id,
      componentType,
      slotId,
      role,
      index,
    }),
  );
  section.approvedAssetPlacements = assets.map(({ placement }) => placement);
  section.approvedAssetPresentations = assets.map(({ presentation }) => presentation);
  return { input: manualInput(value), value, section };
}

describe("P10A-08C-02A deterministic publish compiler authority", () => {
  it("produces byte-stable immutable result and receipt output for identical canonical input", () => {
    const input = manualInput();
    const first = compileStorefrontPublication(input);
    const second = compileStorefrontPublication(structuredClone(input));

    expect(canonicalValueString(first)).toBe(canonicalValueString(second));
    expect(first.result.runtimeFingerprint).toBe(second.result.runtimeFingerprint);
    expect(first.receipt.fingerprint).toBe(second.receipt.fingerprint);
    expect(first.receipt.sourceAuthorityKind).toBe("manual");
    expect(first.receipt.acceptedReceiptId).toBeNull();
    expect(Object.isFrozen(first.result.pages)).toBe(true);
  });

  it("derives Finnish, English-only, Finnish-only and bilingual locale authority from the project", () => {
    const finnishPrimary = compileStorefrontPublication(localeInput("fi", ["en", "fi"]));
    const englishOnly = compileStorefrontPublication(localeInput("en", ["en"]));
    const finnishOnly = compileStorefrontPublication(localeInput("fi", ["fi"]));

    expect(finnishPrimary.result.localeAuthority).toMatchObject({
      activeLocale: "fi",
      primaryLocale: "fi",
      supportedLocales: ["en", "fi"],
    });
    expect(englishOnly.result.localeAuthority.supportedLocales).toEqual(["en"]);
    expect(finnishOnly.result.localeAuthority).toMatchObject({
      activeLocale: "fi",
      primaryLocale: "fi",
      supportedLocales: ["fi"],
    });
    expect(finnishOnly.receipt.localeAuthority).toEqual(finnishOnly.result.localeAuthority);
  });

  it("canonicalizes locale order and changes result and receipt fingerprints with locale authority", () => {
    const ordered = compileStorefrontPublication(localeInput("en", ["en", "fi"]));
    const reversed = compileStorefrontPublication(localeInput("en", ["fi", "en"]));
    const finnish = compileStorefrontPublication(localeInput("fi", ["en", "fi"]));

    expect(canonicalValueString(reversed)).toBe(canonicalValueString(ordered));
    expect(reversed.result.localeAuthority.supportedLocales).toEqual(["en", "fi"]);
    expect(finnish.result.runtimeFingerprint).not.toBe(ordered.result.runtimeFingerprint);
    expect(finnish.receipt.fingerprint).not.toBe(ordered.receipt.fingerprint);
    expect(finnish.result.validationReportFingerprint).not.toBe(
      ordered.result.validationReportFingerprint,
    );
  });

  it("fails closed for disabled active, missing primary, duplicate and unsupported locales", () => {
    const disabledActive = manualInput();
    disabledActive.projectLocales.enabledLocales = ["en"];
    disabledActive.projectLocales.activeLocale = "fi";
    expectCompilerFailure(
      () => compileStorefrontPublication(disabledActive),
      "invalid-locale-authority",
    );

    const missingPrimary = manualInput();
    missingPrimary.projectLocales.enabledLocales = ["fi"];
    expectCompilerFailure(
      () => compileStorefrontPublication(missingPrimary),
      "invalid-locale-authority",
    );

    const duplicate = manualInput();
    duplicate.projectLocales.enabledLocales = ["en", "en"];
    expectCompilerFailure(
      () => compileStorefrontPublication(duplicate),
      "invalid-locale-authority",
    );

    const unsupported = manualInput();
    Reflect.set(unsupported.projectLocales.enabledLocales, 0, "sv");
    expectCompilerFailure(
      () => compileStorefrontPublication(unsupported),
      "invalid-locale-authority",
    );
  });

  it("rejects duplicate product, collection, homepage and normalized public routes", () => {
    for (const pageType of ["product", "collection", "home"] as const) {
      expectCompilerFailure(
        () => compileStorefrontPublication(duplicateRouteInput(pageType)),
        "duplicate-published-route",
      );
    }
    expectCompilerFailure(
      () => compileStorefrontPublication(duplicateRouteInput("product", true)),
      "duplicate-published-route",
    );
  });

  it("allows the same terminal slug in distinct product and collection route namespaces", () => {
    const value = aggregate();
    value.catalogue.collections[0].slug = "shared";
    value.snapshots[1].pages.find((page) => page.type === "collection")!.slug =
      "/collections/shared";
    value.snapshots[1].pages.find((page) => page.type === "product")!.slug = "/products/shared";

    const first = compileStorefrontPublication(manualInput(value));
    const second = compileStorefrontPublication(manualInput(structuredClone(value)));
    expect(first.receipt.navigationRoutesFingerprint).toBe(
      second.receipt.navigationRoutesFingerprint,
    );
  });

  it("enforces homepage hero max-one cardinality with the canonical V2 validator", () => {
    const legal = assetInput("homepageHero", 1);
    const legalCompilation = compileStorefrontPublication(legal.input);
    const assignments = (legal.section.approvedAssetPlacements ?? []).map((placement) => ({
      slotId: placement.assetSlotId,
      assetId: placement.assetId,
      role: placement.role,
    }));
    expect(() =>
      validateComponentAssetAssignments(
        assignments,
        veskifyComponentRegistryV2.get("homepageHero"),
      ),
    ).not.toThrow();
    expect(legalCompilation.receipt.approvedAssetFingerprint).toBe(
      legal.input.authority.approvedAssetFingerprint,
    );

    const excessive = assetInput("homepageHero", 2);
    expect(() =>
      validateComponentAssetAssignments(
        (excessive.section.approvedAssetPlacements ?? []).map((placement) => ({
          slotId: placement.assetSlotId,
          assetId: placement.assetId,
          role: placement.role,
        })),
        veskifyComponentRegistryV2.get("homepageHero"),
      ),
    ).toThrow(/Too many assets/i);
    expectCompilerFailure(
      () => compileStorefrontPublication(excessive.input),
      "invalid-approved-asset",
    );
  });

  it("preserves and revalidates exact responsive image authority in compiled pages", () => {
    const fixture = assetInput("homepageHero", 1);
    const placement = fixture.section.approvedAssetPlacements?.[0];
    const presentation = fixture.section.approvedAssetPresentations?.[0];
    if (!placement || !presentation) throw new Error("Missing approved image compiler fixture.");
    const authored = migrateApprovedPresentationArtDirection({
      presentation,
      placement,
      component: veskifyComponentRegistryV2.get("homepageHero"),
      variant: fixture.section.variant,
      dna: resolveBrandSystemDesignDna(fixture.value.snapshots[1].brandSystem),
      provenanceKind: "merchantProvided",
    });
    fixture.section.approvedAssetPresentations = [authored];

    const compilation = compileStorefrontPublication(manualInput(fixture.value));
    const compiledPresentation = compilation.result.pages
      .find(({ page }) => page.id === placement.pageId)
      ?.page.sections.find(({ id }) => id === placement.componentId)
      ?.approvedAssetPresentations?.[0];
    expect(compiledPresentation?.artDirection).toEqual(authored.artDirection);

    const stale = structuredClone(fixture.value);
    const staleAuthority = stale.snapshots[1].pages
      .find(({ id }) => id === placement.pageId)
      ?.sections.find(({ id }) => id === placement.componentId)
      ?.approvedAssetPresentations?.[0]?.artDirection;
    if (!staleAuthority) throw new Error("Missing stale image compiler fixture.");
    staleAuthority.sourceTreatment.focalPoint.x = 0.4;
    expectCompilerFailure(
      () => compileStorefrontPublication(manualInput(stale)),
      "malformed-compiler-input",
    );

    const reassigned = structuredClone(fixture.value);
    const reassignedAuthority = reassigned.snapshots[1].pages
      .find(({ id }) => id === placement.pageId)
      ?.sections.find(({ id }) => id === placement.componentId)
      ?.approvedAssetPresentations?.[0]?.artDirection;
    if (!reassignedAuthority) throw new Error("Missing reassigned image compiler fixture.");
    const { fingerprint, ...material } = reassignedAuthority;
    void fingerprint;
    material.source.sourceOwnerId = "source_reassigned";
    const reassignedPresentation = reassigned.snapshots[1].pages
      .find(({ id }) => id === placement.pageId)
      ?.sections.find(({ id }) => id === placement.componentId)?.approvedAssetPresentations?.[0];
    if (!reassignedPresentation) throw new Error("Missing reassigned presentation fixture.");
    reassignedPresentation.artDirection = createResponsiveImageAuthority(material);
    expectCompilerFailure(
      () => compileStorefrontPublication(manualInput(reassigned)),
      "invalid-approved-asset",
    );

    const provenanceUnknown = structuredClone(fixture.value);
    const provenanceUnknownPlacement = provenanceUnknown.snapshots[1].pages
      .find(({ id }) => id === placement.pageId)
      ?.sections.find(({ id }) => id === placement.componentId)?.approvedAssetPlacements?.[0];
    if (!provenanceUnknownPlacement) {
      throw new Error("Missing provenance-unknown compiler fixture.");
    }
    delete provenanceUnknownPlacement.sourceProvenanceKind;
    expectCompilerFailure(
      () => compileStorefrontPublication(manualInput(provenanceUnknown)),
      "invalid-approved-asset",
    );
  });

  it("accepts bounded multi-item slots and rejects excess, duplicate, role and presentation drift", () => {
    expect(() =>
      compileStorefrontPublication(assetInput("homepageFeaturedCollections", 2).input),
    ).not.toThrow();
    expectCompilerFailure(
      () => compileStorefrontPublication(assetInput("homepageFeaturedCollections", 65).input),
      "invalid-approved-asset",
    );

    const duplicate = assetInput("homepageHero", 2);
    const duplicatePlacements = duplicate.section.approvedAssetPlacements;
    if (!duplicatePlacements) throw new Error("Expected duplicate asset placements.");
    duplicatePlacements[1].assetId = duplicatePlacements[0].assetId;
    expect(() => compileStorefrontPublication(manualInput(duplicate.value))).toThrow();

    const wrongRole = assetInput("homepageHero", 1);
    const wrongRolePlacements = wrongRole.section.approvedAssetPlacements;
    const wrongRolePresentations = wrongRole.section.approvedAssetPresentations;
    if (!wrongRolePlacements || !wrongRolePresentations) {
      throw new Error("Expected role-validation asset fixtures.");
    }
    wrongRolePlacements[0].role = "collectionImage";
    wrongRolePresentations[0].role = "collectionImage";
    expectCompilerFailure(
      () => compileStorefrontPublication(manualInput(wrongRole.value)),
      "invalid-approved-asset",
    );

    const missingPresentation = assetInput("homepageHero", 1);
    missingPresentation.section.approvedAssetPresentations = [];
    expectCompilerFailure(
      () => compileStorefrontPublication(manualInput(missingPresentation.value)),
      "invalid-approved-asset",
    );
  });

  it("uses V2 minimum/required-slot rules without copying their policy", () => {
    const definition = structuredClone(veskifyComponentRegistryV2.get("homepageHero"));
    definition.assetSlots[0].required = true;
    definition.assetSlots[0].minItems = 1;
    expect(() => validateComponentAssetAssignments([], definition)).toThrow(
      /Missing required asset slot/i,
    );
    expect(() =>
      validateComponentAssetAssignments(
        [{ slotId: "heroMedia", assetId: "asset_invalid_role", role: "logo" }],
        definition,
      ),
    ).toThrow(/does not accept/i);
  });

  it("preserves accepted receipt lineage without changing the compiler", () => {
    const value = aggregate();
    const input = createCurrentPublishCompilerInput({
      aggregate: value,
      snapshot: value.snapshots[1],
      sourceAuthority: {
        kind: "accepted-ai",
        acceptedReceiptId: "accepted_receipt_compiler",
        acceptedReceiptFingerprint: "accepted-receipt-fingerprint",
        profileAuthorities: [],
      },
    });

    expect(compileStorefrontPublication(input).receipt).toMatchObject({
      sourceAuthorityKind: "accepted-ai",
      acceptedReceiptId: "accepted_receipt_compiler",
      acceptedReceiptFingerprint: "accepted-receipt-fingerprint",
      sourceSnapshotId: value.snapshots[1].id,
    });
  });

  it("rejects malformed input and unsupported compiler or snapshot versions", () => {
    expectCompilerFailure(
      () => compileStorefrontPublication({ contractVersion: "2.0.0" }),
      "unsupported-compiler-contract-version",
    );
    expectCompilerFailure(() => compileStorefrontPublication({}), "malformed-compiler-input");
    const input = manualInput();
    input.authority.snapshotContractVersion = "0.9.0";
    expectCompilerFailure(
      () => compileStorefrontPublication(input),
      "unsupported-snapshot-version",
    );
  });

  it("rejects stale source, manifest, registry and component-version authority", () => {
    const source = manualInput();
    source.sourceSnapshotFingerprint = "stale-source";
    expectCompilerFailure(() => compileStorefrontPublication(source), "stale-source-snapshot");

    const manifest = manualInput();
    manifest.authority.manifestFingerprint = "stale-manifest";
    expectCompilerFailure(() => compileStorefrontPublication(manifest), "stale-manifest");

    const registry = manualInput();
    registry.authority.registryFingerprint = "stale-registry";
    expectCompilerFailure(() => compileStorefrontPublication(registry), "stale-registry-authority");

    const version = manualInput();
    const componentType = currentSnapshot(version).pages[0].sections[0].component;
    const component = version.authority.componentAuthorities.find(
      (authority) => authority.componentType === componentType,
    )!;
    component.version.major += 1;
    expectCompilerFailure(() => compileStorefrontPublication(version), "unknown-component-version");
  });

  it("rejects unknown components, variants and renderer authority", () => {
    const component = manualInput();
    replaceSnapshot(component, (snapshot) => {
      snapshot.pages[0].sections[0].component = "unknownPublishComponent";
    });
    expectCompilerFailure(() => compileStorefrontPublication(component), "unknown-component");

    const variant = manualInput();
    replaceSnapshot(variant, (snapshot) => {
      snapshot.pages[0].sections[0].variant = "unknownPublishVariant";
    });
    expectCompilerFailure(
      () => compileStorefrontPublication(variant),
      "incompatible-component-variant-profile",
    );

    const renderer = manualInput();
    const componentType = currentSnapshot(renderer).pages[0].sections[0].component;
    const authority = renderer.authority.componentAuthorities.find(
      (candidate) => candidate.componentType === componentType,
    )!;
    authority.renderer.exportName = "UnknownPublishRenderer";
    expectCompilerFailure(() => compileStorefrontPublication(renderer), "unknown-renderer");
  });

  it("rejects unknown/stale profiles and profile ordering or omission", () => {
    const stale = manualInput();
    stale.authority.profileAuthorities = [
      { profileId: "unknown-profile", profileVersion: "1.0.0", fingerprint: "unknown" },
    ];
    expectCompilerFailure(() => compileStorefrontPublication(stale), "stale-profile-authority");

    const invalidOrder = manualInput();
    const snapshot = currentSnapshot(invalidOrder);
    const profile = veskifyComponentCapabilityManifest.manifest.profiles.find((candidate) =>
      snapshot.pages.some(
        (page) =>
          page.type === candidate.pageType &&
          page.sections.length > 1 &&
          page.sections.length === candidate.componentSelections.length &&
          page.sections.every(
            (section, index) =>
              candidate.componentSelections[index]?.componentType === section.component,
          ),
      ),
    );
    if (!profile) throw new Error("Expected materialized multi-slot PageBlueprint authority.");
    invalidOrder.authority.profileAuthorities = [
      {
        profileId: profile.profileId,
        profileVersion: profile.profileVersion,
        fingerprint: profile.fingerprint,
      },
    ];
    replaceSnapshot(invalidOrder, (current) => {
      const page = current.pages.find(
        (candidate) =>
          candidate.type === profile.pageType &&
          candidate.sections.length === profile.componentSelections.length &&
          candidate.sections.every(
            (section, index) =>
              profile.componentSelections[index]?.componentType === section.component,
          ),
      )!;
      [page.sections[0], page.sections[1]] = [page.sections[1], page.sections[0]];
    });
    expectCompilerFailure(
      () => compileStorefrontPublication(invalidOrder),
      "invalid-ordering-or-omission",
    );
  });

  it("rejects invalid content bindings and protected commerce truth", () => {
    const binding = manualInput();
    replaceSnapshot(binding, (snapshot) => {
      snapshot.pages[0].sections[0].content.unregisteredPublishBinding = "unknown";
    });
    expectCompilerFailure(() => compileStorefrontPublication(binding), "invalid-binding");

    const commerce = manualInput();
    replaceSnapshot(commerce, (snapshot) => {
      snapshot.pages[0].sections[0].content.price = { amount: 1, currency: "EUR" };
    });
    expectCompilerFailure(
      () => compileStorefrontPublication(commerce),
      "protected-commerce-violation",
    );
  });

  it("rejects navigation, product-media, approved-asset and locale authority drift", () => {
    const navigation = manualInput();
    navigation.authority.navigationRoutesFingerprint = "stale-navigation";
    expectCompilerFailure(
      () => compileStorefrontPublication(navigation),
      "navigation-route-violation",
    );

    const media = manualInput();
    media.authority.productMediaFingerprint = "stale-product-media";
    expectCompilerFailure(() => compileStorefrontPublication(media), "product-media-violation");

    const assets = manualInput();
    assets.authority.approvedAssetFingerprint = "stale-approved-assets";
    expectCompilerFailure(() => compileStorefrontPublication(assets), "invalid-approved-asset");

    const accessibility = manualInput();
    accessibility.projectLocales.enabledLocales = ["en"];
    accessibility.projectLocales.activeLocale = "fi";
    expectCompilerFailure(
      () => compileStorefrontPublication(accessibility),
      "invalid-locale-authority",
    );

    const missingAlternative = manualInput();
    const catalogue = catalogueDisplayModelSchema.parse(missingAlternative.catalogue);
    catalogue.products[0].images[0].decorative = false;
    delete catalogue.products[0].images[0].alt;
    missingAlternative.catalogue = catalogue;
    expectCompilerFailure(
      () => compileStorefrontPublication(missingAlternative),
      "critical-accessibility-failure",
    );
  });

  it("rejects unresolved migration authority", () => {
    const input = manualInput();
    input.authority.migrationStatus = "unresolved";
    expectCompilerFailure(() => compileStorefrontPublication(input), "unresolved-migration");
  });

  it("stores trusted compilation while returning only a bounded public preparation", async () => {
    const repository = await changedRepository();
    const preparation = await preparePublish(aurumNordicSeed.project.id, repository, {
      now: () => new Date("2026-08-06T08:00:00.000Z"),
      createPreparationId: () => "publish_preparation_compiler_authority",
    });
    const publicPreparation = publicPublishPreparation(preparation);

    expect(preparation.compilation.receipt.compiledResultFingerprint).toBe(
      preparation.compilation.resultIdentity.runtimeFingerprint,
    );
    expect(publicPublishPreparationSchema.parse(publicPreparation)).toEqual(publicPreparation);
    expect(publicPreparation).not.toHaveProperty("compilation");
  });

  it("recompiles at confirmation, rejects trusted receipt drift, and performs no write", async () => {
    const repository = await changedRepository();
    const preparation = await preparePublish(aurumNordicSeed.project.id, repository, {
      createPreparationId: () => "publish_preparation_compiler_drift",
    });
    const before = await repository.get(aurumNordicSeed.project.id);
    const drifted = structuredClone(preparation);
    drifted.compilation.receipt.fingerprint = "drifted-compile-receipt";

    await expect(confirmPublish(drifted, repository)).rejects.toMatchObject({
      code: "prepare-confirmation-compile-mismatch",
    });
    expect(await repository.get(aurumNordicSeed.project.id)).toEqual(before);
  });

  it("rejects locale authority drift between preparation and confirmation without publishing", async () => {
    const repository = await changedRepository();
    const preparation = await preparePublish(aurumNordicSeed.project.id, repository, {
      createPreparationId: () => "publish_preparation_locale_drift",
    });
    const driftedAggregate = await repository.get(aurumNordicSeed.project.id);
    driftedAggregate.project.primaryLocale = "fi";
    driftedAggregate.project.enabledLocales = ["fi"];
    const confirmationRepository = new InMemoryProjectRepository([driftedAggregate]);
    const publish = vi.spyOn(confirmationRepository, "publish");

    await expect(confirmPublish(preparation, confirmationRepository)).rejects.toMatchObject({
      code: "prepare-confirmation-compile-mismatch",
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("performs no publication write when asset cardinality fails during preparation", async () => {
    const invalid = assetInput("homepageHero", 2);
    const repository = new InMemoryProjectRepository([invalid.value]);
    const publish = vi.spyOn(repository, "publish");

    await expect(preparePublish(invalid.value.project.id, repository)).rejects.toMatchObject({
      code: "invalid-approved-asset",
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("accepts an exact fresh recompilation and rejects any result mismatch", () => {
    const prepared = preparedPublishCompilation(compileStorefrontPublication(manualInput()));
    const current = compileStorefrontPublication(manualInput());
    expect(() => assertMatchingPublishCompilation(prepared, current)).not.toThrow();

    const changed = structuredClone(prepared);
    changed.resultIdentity.runtimeFingerprint = `compiled-publication-${canonicalValueFingerprint("drift")}`;
    expectCompilerFailure(
      () => assertMatchingPublishCompilation(changed, current),
      "prepare-confirmation-compile-mismatch",
    );
  });
});
