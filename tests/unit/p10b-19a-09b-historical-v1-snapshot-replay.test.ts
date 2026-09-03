import { describe, expect, it } from "vitest";

import {
  LEGACY_V1_HISTORICAL_SNAPSHOT_READ_AUTHORITY_KIND,
  LEGACY_V1_HISTORICAL_SNAPSHOT_READ_RECEIPT_SCHEMA_VERSION,
  LegacyV1HistoricalSnapshotReadError,
  legacyV1HistoricalSnapshotSelectionFieldIds,
  parseLegacyV1HistoricalSnapshotReadReceipt,
  readLegacyV1HistoricalSnapshot,
  type LegacyV1HistoricalSnapshotReadErrorCode,
} from "@/application/bounded-storefront-synthesis/legacy-v1-historical-snapshot-replay";
import { createLegacyV1StorefrontReplayReference } from "@/application/bounded-storefront-synthesis/legacy-v1-replay-authority";
import { informationDensityPostureForDesignSystemSpacingDensity } from "@/application/bounded-storefront-synthesis/direction-registry";
import {
  createP10B16RepresentativeAuthority,
  createP10B16RepresentativeOutcome,
  P10B16_REPRESENTATIVE_DIRECTION_IDS,
} from "@/data/demo/p10b-16-coordinated-directions";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";

const aliases = {
  "premium-editorial": "legacy-v1:premium-editorial",
  "modern-technical": "legacy-v1:modern-technical",
  "minimal-commerce": "legacy-v1:minimal-commerce",
} as const;

const verifiedFields = [
  "designSystemSpacingDensity",
  "designSystemSurfaceDepth",
  "sharedFrameProfileId",
  "homepageProfileId",
  "collectionProfileId",
  "searchProfileId",
  "pdpProfileId",
] as const;

const unverifiedFields = [
  "directionId",
  "includedOptionalPageFamilyIds",
  "narrativePosture",
  "merchandisingPosture",
  "informationDensityPosture",
  "artDirectionPosture",
  "responsiveMode",
] as const;

type DirectionId = keyof typeof aliases;

function caseFor(directionId: DirectionId) {
  const source = createP10B16RepresentativeAuthority().source;
  const outcome = createP10B16RepresentativeOutcome(directionId, 0);
  return {
    directionId,
    aliasId: aliases[directionId],
    snapshot: structuredClone(outcome.synthesis.materialization.snapshot),
    catalogue: structuredClone(source.fixture.planningInput.catalogue),
    replayReference: createLegacyV1StorefrontReplayReference({
      aliasId: aliases[directionId],
      sourceSelection: outcome.narrowing,
    }),
    sourceSelection: structuredClone(outcome.narrowing),
  };
}

function expectReadError(
  operation: () => unknown,
  code: LegacyV1HistoricalSnapshotReadErrorCode,
): LegacyV1HistoricalSnapshotReadError {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(LegacyV1HistoricalSnapshotReadError);
    expect((error as LegacyV1HistoricalSnapshotReadError).code).toBe(code);
    return error as LegacyV1HistoricalSnapshotReadError;
  }
  throw new Error(`Expected ${code}.`);
}

function expectDeeplyFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value as Record<string, unknown>).forEach((entry) =>
    expectDeeplyFrozen(entry, seen),
  );
}

function read(directionId: DirectionId, withReference = false) {
  const fixture = caseFor(directionId);
  return {
    fixture,
    result: readLegacyV1HistoricalSnapshot({
      snapshot: fixture.snapshot,
      catalogue: fixture.catalogue,
      ...(withReference ? { replayReference: fixture.replayReference } : {}),
    }),
  };
}

describe("P10B-19A-09B canonical historical snapshot reads", () => {
  it.each(P10B16_REPRESENTATIVE_DIRECTION_IDS)(
    "reads %s through canonical authority without attribution or mutation",
    (directionId) => {
      const fixture = caseFor(directionId);
      const snapshotBefore = canonicalValueString(fixture.snapshot);
      const catalogueBefore = canonicalValueString(fixture.catalogue);
      const result = readLegacyV1HistoricalSnapshot({
        snapshot: fixture.snapshot,
        catalogue: fixture.catalogue,
      });

      expect(result.receipt).toMatchObject({
        receiptSchemaVersion: LEGACY_V1_HISTORICAL_SNAPSHOT_READ_RECEIPT_SCHEMA_VERSION,
        authorityKind: LEGACY_V1_HISTORICAL_SNAPSHOT_READ_AUTHORITY_KIND,
        readDisposition: "readable-unattributed",
        replayBinding: null,
        readNormalizationDisposition: "none",
      });
      expect(result.receipt.sourceSnapshot).toEqual({
        snapshotId: fixture.snapshot.id,
        projectId: fixture.snapshot.projectId,
        revision: fixture.snapshot.revision,
        catalogueRef: fixture.snapshot.catalogueRef,
        canonicalSnapshotFingerprint: canonicalStorefrontContentFingerprint(fixture.snapshot),
      });
      expect(result.snapshot).toEqual(fixture.snapshot);
      expect(result.snapshot).not.toBe(fixture.snapshot);
      expect(canonicalValueString(fixture.snapshot)).toBe(snapshotBefore);
      expect(canonicalValueString(fixture.catalogue)).toBe(catalogueBefore);
      expectDeeplyFrozen(result);
    },
  );

  it.each(P10B16_REPRESENTATIVE_DIRECTION_IDS)(
    "binds %s only through its exact supplied A-09A reference",
    (directionId) => {
      const fixture = caseFor(directionId);
      const replayReferenceBefore = canonicalValueString(fixture.replayReference);
      const first = readLegacyV1HistoricalSnapshot({
        snapshot: fixture.snapshot,
        catalogue: fixture.catalogue,
        replayReference: fixture.replayReference,
      });
      const second = readLegacyV1HistoricalSnapshot({
        replayReference: fixture.replayReference,
        catalogue: fixture.catalogue,
        snapshot: fixture.snapshot,
      });

      expect(first.receipt.readDisposition).toBe("readable-explicit-replay-binding");
      expect(first.receipt.replayBinding).toEqual({
        aliasId: fixture.aliasId,
        replayReferenceFingerprint: fixture.replayReference.replayFingerprint,
        verifiedPersistedSelectionFields: verifiedFields,
        unverifiedSelectionFields: unverifiedFields,
        persistedAuthorityProjectionFingerprint:
          first.receipt.persistedAuthorityProjectionFingerprint,
      });
      expect(first.receipt.receiptFingerprint).toMatch(
        /^legacy-v1-historical-snapshot-read-v1_[1-9][0-9]*_[a-f0-9]{64}$/,
      );
      expect(second.receipt).toEqual(first.receipt);
      expect(parseLegacyV1HistoricalSnapshotReadReceipt(first.receipt)).toEqual(first.receipt);
      expect([
        ...first.receipt.replayBinding!.verifiedPersistedSelectionFields,
        ...first.receipt.replayBinding!.unverifiedSelectionFields,
      ]).toEqual(expect.arrayContaining([...legacyV1HistoricalSnapshotSelectionFieldIds]));
      expect(canonicalValueString(fixture.replayReference)).toBe(replayReferenceBefore);
      expectDeeplyFrozen(first);
    },
  );

  it("records existing canonical defaults in memory without changing the historical input", () => {
    const fixture = caseFor("premium-editorial");
    const historical = structuredClone(fixture.snapshot) as Omit<
      StorefrontSnapshot,
      "contentSupportFactDocuments"
    > &
      Partial<Pick<StorefrontSnapshot, "contentSupportFactDocuments">>;
    delete historical.contentSupportFactDocuments;
    const before = canonicalValueString(historical);

    const result = readLegacyV1HistoricalSnapshot({
      snapshot: historical,
      catalogue: fixture.catalogue,
    });

    expect(result.receipt.readNormalizationDisposition).toBe("canonical-read-defaults");
    expect(result.snapshot.contentSupportFactDocuments).toEqual([]);
    expect("contentSupportFactDocuments" in historical).toBe(false);
    expect(canonicalValueString(historical)).toBe(before);
    expect(result.receipt.receiptFingerprint).not.toBe(
      readLegacyV1HistoricalSnapshot({
        snapshot: fixture.snapshot,
        catalogue: fixture.catalogue,
      }).receipt.receiptFingerprint,
    );
  });

  it("rejects malformed, future and invalid canonical snapshot authority", () => {
    const invalidCases: Array<{
      label: string;
      mutate: (snapshot: StorefrontSnapshot) => void;
    }> = [
      {
        label: "unknown root authority",
        mutate: (snapshot) => Object.assign(snapshot, { futureAuthority: "2.0.0" }),
      },
      {
        label: "unknown component",
        mutate: (snapshot) => {
          snapshot.pages[0].sections[0].component = "unknownComponent";
        },
      },
      {
        label: "unknown variant",
        mutate: (snapshot) => {
          snapshot.pages[0].sections[0].variant = "unknown-variant";
        },
      },
      {
        label: "unresolved navigation",
        mutate: (snapshot) => {
          snapshot.navigation.primary[0].target = { type: "page", pageId: "missing_page" };
        },
      },
      {
        label: "unresolved product",
        mutate: (snapshot) => {
          const route = snapshot.dynamicCommercePresentation!.routeInventory.find(
            (candidate) => candidate.kind === "product",
          )!;
          if (route.kind === "product") route.productId = "missing_product";
        },
      },
      {
        label: "unresolved collection",
        mutate: (snapshot) => {
          const route = snapshot.dynamicCommercePresentation!.routeInventory.find(
            (candidate) => candidate.kind === "collection",
          )!;
          if (route.kind === "collection") route.collectionId = "missing_collection";
        },
      },
      {
        label: "invalid approved placement",
        mutate: (snapshot) => {
          const section = snapshot.pages
            .flatMap(({ sections }) => sections)
            .find(({ approvedAssetPlacements }) => (approvedAssetPlacements?.length ?? 0) > 0)!;
          expect(section).toBeDefined();
          section.approvedAssetPlacements![0].pageId = "missing_page";
        },
      },
      {
        label: "invalid approved media lineage",
        mutate: (snapshot) => {
          const section = snapshot.pages
            .flatMap(({ sections }) => sections)
            .find((candidate) =>
              candidate.approvedAssetPresentations?.some(({ materialFingerprint }) =>
                candidate.approvedAssetPlacements?.some(
                  (placement) => placement.materialFingerprint === materialFingerprint,
                ),
              ),
            )!;
          expect(section).toBeDefined();
          section.approvedAssetPresentations![0].materialFingerprint = "tampered-media-lineage";
        },
      },
    ];
    const fixture = caseFor("premium-editorial");
    invalidCases.forEach(({ mutate }) => {
      const snapshot = structuredClone(fixture.snapshot);
      mutate(snapshot);
      expectReadError(
        () => readLegacyV1HistoricalSnapshot({ snapshot, catalogue: fixture.catalogue }),
        "invalid-legacy-v1-historical-snapshot",
      );
    });
    expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: { id: "snapshot_malformed" },
          catalogue: fixture.catalogue,
        }),
      "invalid-legacy-v1-historical-snapshot",
    );
    const unsafeIdentifier = "UNBOUNDED CUSTOMER TEXT ".repeat(100);
    const unsafeIdentifierError = expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: { id: unsafeIdentifier, revision: 7 },
          catalogue: fixture.catalogue,
        }),
      "invalid-legacy-v1-historical-snapshot",
    );
    expect(unsafeIdentifierError.safeIdentifiers).toEqual(["7"]);
    expect(canonicalValueString(unsafeIdentifierError.safeIdentifiers)).not.toContain(
      unsafeIdentifier,
    );
    expect(unsafeIdentifierError.cause).toBeUndefined();

    const unsafeComponent = structuredClone(fixture.snapshot);
    unsafeComponent.pages[0].sections[0].component = unsafeIdentifier;
    const unsafeComponentError = expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: unsafeComponent,
          catalogue: fixture.catalogue,
        }),
      "invalid-legacy-v1-historical-snapshot",
    );
    expect(unsafeComponentError.cause).toBeUndefined();
    expect(String(unsafeComponentError)).not.toContain(unsafeIdentifier);
  });

  it("distinguishes exact catalogue disagreement from other invalid reads", () => {
    const fixture = caseFor("premium-editorial");
    const snapshot = structuredClone(fixture.snapshot);
    snapshot.catalogueRef = "catalogue_other";
    const error = expectReadError(
      () => readLegacyV1HistoricalSnapshot({ snapshot, catalogue: fixture.catalogue }),
      "legacy-v1-historical-snapshot-catalogue-mismatch",
    );
    expect(error.safeIdentifiers).toEqual([snapshot.id, String(snapshot.revision)]);
    expect(error.safeIdentifiers).not.toContain(fixture.catalogue.id);
  });
});

describe("P10B-19A-09B explicit persisted-authority binding", () => {
  function referenceWith(
    directionId: DirectionId,
    changes: Partial<ReturnType<typeof caseFor>["sourceSelection"]>,
  ) {
    const fixture = caseFor(directionId);
    return {
      fixture,
      reference: createLegacyV1StorefrontReplayReference({
        aliasId: fixture.aliasId,
        sourceSelection: {
          ...fixture.sourceSelection,
          selectionId: `${fixture.sourceSelection.selectionId}_mismatch_case`,
          ...changes,
        },
      }),
    };
  }

  it("rejects malformed and stale explicit A-09A references", () => {
    const fixture = caseFor("premium-editorial");
    expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: fixture.snapshot,
          catalogue: fixture.catalogue,
          replayReference: { aliasId: fixture.aliasId },
        }),
      "invalid-legacy-v1-historical-replay-binding",
    );
    const stale = {
      ...fixture.replayReference,
      replayFingerprint: fixture.replayReference.replayFingerprint.replace(/[a-f0-9]$/u, "0"),
    };
    expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: fixture.snapshot,
          catalogue: fixture.catalogue,
          replayReference: stale,
        }),
      "invalid-legacy-v1-historical-replay-binding",
    );
  });

  it.each([
    ["sharedFrameProfileId", "editorial-masthead"],
    ["homepageProfileId", "homepage-editorial-storytelling"],
    ["collectionProfileId", "collection-campaign-led-discovery"],
    ["pdpProfileId", "pdp-gallery-led"],
  ] as const)("rejects conflicting persisted %s authority", (field, value) => {
    const { fixture, reference } = referenceWith("premium-editorial", { [field]: value });
    const error = expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: fixture.snapshot,
          catalogue: fixture.catalogue,
          replayReference: reference,
        }),
      "legacy-v1-historical-replay-authority-mismatch",
    );
    expect(error.safeIdentifiers).toContain(field);
  });

  it("rejects conflicting persisted search authority", () => {
    const { fixture, reference } = referenceWith("modern-technical", {
      searchProfileId: "collection-catalogue-comparison",
    });
    expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: fixture.snapshot,
          catalogue: fixture.catalogue,
          replayReference: reference,
        }),
      "legacy-v1-historical-replay-authority-mismatch",
    );
  });

  it("rejects conflicting spacing, surface and Design DNA compatibility", () => {
    const base = caseFor("premium-editorial");
    const spacing =
      base.sourceSelection.designSystemSpacingDensity === "standard" ? "spacious" : "standard";
    const spacingCase = referenceWith("premium-editorial", {
      designSystemSpacingDensity: spacing,
      informationDensityPosture: informationDensityPostureForDesignSystemSpacingDensity(spacing),
    });
    expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: spacingCase.fixture.snapshot,
          catalogue: spacingCase.fixture.catalogue,
          replayReference: spacingCase.reference,
        }),
      "legacy-v1-historical-replay-authority-mismatch",
    );

    const surfaceSnapshot = structuredClone(base.snapshot);
    surfaceSnapshot.brandSystem.visualSystem!.surfaceDepth = "flat";
    expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: surfaceSnapshot,
          catalogue: base.catalogue,
          replayReference: base.replayReference,
        }),
      "legacy-v1-historical-replay-authority-mismatch",
    );

    const dnaSnapshot = structuredClone(base.snapshot);
    dnaSnapshot.brandSystem.designDna = structuredClone(
      caseFor("modern-technical").snapshot.brandSystem.designDna,
    );
    expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: dnaSnapshot,
          catalogue: base.catalogue,
          replayReference: base.replayReference,
        }),
      "legacy-v1-historical-replay-authority-mismatch",
    );
  });

  it("never infers attribution from exact appearance and rejects a wrong exact alias", () => {
    const premium = caseFor("premium-editorial");
    const minimal = caseFor("minimal-commerce");
    expect(
      readLegacyV1HistoricalSnapshot({
        snapshot: premium.snapshot,
        catalogue: premium.catalogue,
      }).receipt.replayBinding,
    ).toBeNull();
    expectReadError(
      () =>
        readLegacyV1HistoricalSnapshot({
          snapshot: premium.snapshot,
          catalogue: premium.catalogue,
          replayReference: minimal.replayReference,
        }),
      "legacy-v1-historical-replay-authority-mismatch",
    );
  });

  it("retains changed executable authority even when its field is not persisted", () => {
    const fixture = caseFor("premium-editorial");
    const changedReference = createLegacyV1StorefrontReplayReference({
      aliasId: fixture.aliasId,
      sourceSelection: {
        ...fixture.sourceSelection,
        narrativePosture: "campaign-led",
      },
    });
    const original = readLegacyV1HistoricalSnapshot({
      snapshot: fixture.snapshot,
      catalogue: fixture.catalogue,
      replayReference: fixture.replayReference,
    });
    const changed = readLegacyV1HistoricalSnapshot({
      snapshot: fixture.snapshot,
      catalogue: fixture.catalogue,
      replayReference: changedReference,
    });

    expect(changedReference.replayFingerprint).not.toBe(fixture.replayReference.replayFingerprint);
    expect(changed.receipt.receiptFingerprint).not.toBe(original.receipt.receiptFingerprint);
    expect(changed.receipt.replayBinding?.unverifiedSelectionFields).toContain("narrativePosture");
  });
});

describe("P10B-19A-09B receipt identity", () => {
  it("excludes incidental selectionId while retaining executable and source identity", () => {
    const fixture = caseFor("premium-editorial");
    const changedSelectionId = createLegacyV1StorefrontReplayReference({
      aliasId: fixture.aliasId,
      sourceSelection: {
        ...fixture.sourceSelection,
        selectionId: `${fixture.sourceSelection.selectionId}_incidental`,
      },
    });
    const original = readLegacyV1HistoricalSnapshot({
      snapshot: fixture.snapshot,
      catalogue: fixture.catalogue,
      replayReference: fixture.replayReference,
    });
    const changed = readLegacyV1HistoricalSnapshot({
      snapshot: fixture.snapshot,
      catalogue: fixture.catalogue,
      replayReference: changedSelectionId,
    });
    expect(changedSelectionId.replayFingerprint).toBe(fixture.replayReference.replayFingerprint);
    expect(changed.receipt).toEqual(original.receipt);
    expect(canonicalValueString(original.receipt)).not.toContain("selectionId");
  });

  it("changes receipt identity with canonical snapshot content", () => {
    const fixture = caseFor("premium-editorial");
    const before = readLegacyV1HistoricalSnapshot({
      snapshot: fixture.snapshot,
      catalogue: fixture.catalogue,
    });
    const changedSnapshot = structuredClone(fixture.snapshot);
    changedSnapshot.pages[0].title.en = `${changedSnapshot.pages[0].title.en} revised`;
    const after = readLegacyV1HistoricalSnapshot({
      snapshot: changedSnapshot,
      catalogue: fixture.catalogue,
    });
    expect(after.receipt.sourceSnapshot.canonicalSnapshotFingerprint).not.toBe(
      before.receipt.sourceSnapshot.canonicalSnapshotFingerprint,
    );
    expect(after.receipt.receiptFingerprint).not.toBe(before.receipt.receiptFingerprint);
  });

  it("rejects stale and unknown receipt fields without retaining raw authority", () => {
    const { result } = read("premium-editorial", true);
    const stale = {
      ...result.receipt,
      receiptFingerprint: result.receipt.receiptFingerprint.replace(/[a-f0-9]$/u, "0"),
    };
    expectReadError(
      () => parseLegacyV1HistoricalSnapshotReadReceipt(stale),
      "stale-legacy-v1-historical-snapshot-receipt",
    );
    expectReadError(
      () =>
        parseLegacyV1HistoricalSnapshotReadReceipt({
          ...result.receipt,
          rawHtml: "<main>not receipt authority</main>",
        }),
      "stale-legacy-v1-historical-snapshot-receipt",
    );
    const serialized = canonicalValueString(result.receipt);
    [
      '"snapshot"',
      '"catalogue"',
      '"pages"',
      '"products"',
      '"prices"',
      '"assetUrl"',
      '"providerPayload"',
      '"rawHtml"',
      '"createdAt"',
    ].forEach((key) => expect(serialized).not.toContain(key));
  });

  it.each(["snapshotId", "projectId", "catalogueRef"] as const)(
    "rejects noncanonical whitespace in receipt source %s without fingerprint repair",
    (field) => {
      const { result } = read("premium-editorial", true);
      const noncanonicalReceipt = {
        ...result.receipt,
        sourceSnapshot: {
          ...result.receipt.sourceSnapshot,
          [field]: ` ${result.receipt.sourceSnapshot[field]} `,
        },
      };

      expectReadError(
        () => parseLegacyV1HistoricalSnapshotReadReceipt(noncanonicalReceipt),
        "stale-legacy-v1-historical-snapshot-receipt",
      );
    },
  );
});
