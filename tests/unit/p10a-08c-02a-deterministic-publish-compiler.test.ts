import { describe, expect, it } from "vitest";
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
import { veskifyComponentCapabilityManifest } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
} from "@/domain/storefront";
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

function manualInput(): PublishCompilerInput {
  const value = aggregate();
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
  input.authority.approvedAssetFingerprint = `publish-approved-assets-${canonicalValueFingerprint(
    snapshot.pages.flatMap((page) =>
      page.sections.map((section) => ({
        pageId: page.id,
        sectionId: section.id,
        placements: section.approvedAssetPlacements,
        presentations: section.approvedAssetPresentations,
      })),
    ),
  )}`;
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
    accessibility.authority.localeAuthority.fingerprint = "stale-locale-authority";
    expectCompilerFailure(
      () => compileStorefrontPublication(accessibility),
      "critical-accessibility-failure",
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
