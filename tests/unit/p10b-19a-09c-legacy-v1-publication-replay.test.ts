import { describe, expect, it } from "vitest";

import {
  expandDynamicCommerceRoutePages,
  resolveDynamicCommerceRoutePage,
} from "@/application/dynamic-commerce-routes";
import {
  readLegacyV1HistoricalSnapshot,
  type LegacyV1HistoricalSnapshotReadResultV1,
} from "@/application/bounded-storefront-synthesis/legacy-v1-historical-snapshot-replay";
import { createLegacyV1StorefrontReplayReference } from "@/application/bounded-storefront-synthesis/legacy-v1-replay-authority";
import {
  LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_AUTHORITY_KIND,
  LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_RECEIPT_SCHEMA_VERSION,
  LegacyV1HistoricalPublicationReplayError,
  assertLegacyV1HistoricalPublicationReplayCurrent,
  compileLegacyV1HistoricalPublicationReplay,
  legacyV1HistoricalPublicationReplayErrorCodes,
  parseLegacyV1HistoricalPublicationReplayReceipt,
  type LegacyV1HistoricalPublicationReplayErrorCode,
  type LegacyV1HistoricalPublicationReplayInput,
  type LegacyV1HistoricalPublicationReplayReceiptV1,
} from "@/application/publishing/legacy-v1-publication-replay";
import {
  publishCompilerContractVersion,
  publishCompilerVersion,
} from "@/application/publishing/publish-compiler";
import {
  createP10B16RepresentativeAuthority,
  createP10B16RepresentativeOutcome,
} from "@/data/demo/p10b-16-coordinated-directions";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { restoreHistoryMetadata, type ProjectAggregate } from "@/services/storage";
import { validateProjectAggregate } from "@/services/storage/repository-validation";

const representatives = [
  ["premium-editorial", "legacy-v1:premium-editorial"],
  ["modern-technical", "legacy-v1:modern-technical"],
  ["minimal-commerce", "legacy-v1:minimal-commerce"],
] as const;

type DirectionId = (typeof representatives)[number][0];
type AliasId = (typeof representatives)[number][1];

type ReplayFixture = Readonly<{
  directionId: DirectionId;
  aliasId: AliasId;
  aggregate: ProjectAggregate;
  historical: StorefrontSnapshot;
  historicalReadResult: LegacyV1HistoricalSnapshotReadResultV1;
  currentEvidenceReferences: LegacyV1HistoricalPublicationReplayInput["currentEvidenceReferences"];
  input: LegacyV1HistoricalPublicationReplayInput;
}>;

function snapshotById(aggregate: ProjectAggregate, snapshotId: string): StorefrontSnapshot {
  const snapshot = aggregate.snapshots.find(({ id }) => id === snapshotId);
  if (!snapshot) throw new Error(`Missing required snapshot ${snapshotId}.`);
  return snapshot;
}

function historicalAggregate(directionId: DirectionId): ProjectAggregate {
  const sourceAggregate = createP10B16RepresentativeAuthority().source.fixture.aggregate;
  const historical = structuredClone(
    createP10B16RepresentativeOutcome(directionId, 0).synthesis.materialization.snapshot,
  );
  const currentDraft = structuredClone(
    snapshotById(sourceAggregate, sourceAggregate.project.draftSnapshotId),
  );
  currentDraft.id = `snapshot_lumo_current_${directionId.replaceAll("-", "_")}`;
  const published = structuredClone(
    snapshotById(sourceAggregate, sourceAggregate.project.publishedSnapshotId),
  );
  const project = {
    ...structuredClone(sourceAggregate.project),
    draftSnapshotId: currentDraft.id,
  };
  return validateProjectAggregate({
    project,
    catalogue: structuredClone(sourceAggregate.catalogue),
    snapshots: [published, historical, currentDraft],
    snapshotHistoryMetadata: [restoreHistoryMetadata(project.id, historical.id)],
  });
}

function fixtureFor(directionId: DirectionId, attributed = true): ReplayFixture {
  const aliasId = representatives.find(([candidate]) => candidate === directionId)?.[1];
  if (!aliasId) throw new Error(`Missing alias for ${directionId}.`);
  const aggregate = historicalAggregate(directionId);
  const historicalId = createP10B16RepresentativeOutcome(directionId, 0).synthesis.materialization
    .snapshot.id;
  const historical = snapshotById(aggregate, historicalId);
  const outcome = createP10B16RepresentativeOutcome(directionId, 0);
  const historicalReadResult = readLegacyV1HistoricalSnapshot({
    snapshot: historical,
    catalogue: aggregate.catalogue,
    ...(attributed
      ? {
          replayReference: createLegacyV1StorefrontReplayReference({
            aliasId,
            sourceSelection: outcome.narrowing,
          }),
        }
      : {}),
  });
  const currentEvidenceReferences = structuredClone(
    createP10B16RepresentativeAuthority().source.approvedEvidenceReferences,
  );
  const input = { aggregate, historicalReadResult, currentEvidenceReferences };
  return {
    directionId,
    aliasId,
    aggregate,
    historical,
    historicalReadResult,
    currentEvidenceReferences,
    input,
  };
}

function replaceHistorical(
  aggregate: ProjectAggregate,
  historical: StorefrontSnapshot,
): ProjectAggregate {
  return validateProjectAggregate({
    ...structuredClone(aggregate),
    snapshots: aggregate.snapshots.map((snapshot) =>
      snapshot.id === historical.id ? structuredClone(historical) : structuredClone(snapshot),
    ),
  });
}

function staleFingerprint(value: string): string {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

function expectReplayError(
  operation: () => unknown,
  code: LegacyV1HistoricalPublicationReplayErrorCode,
): LegacyV1HistoricalPublicationReplayError {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(LegacyV1HistoricalPublicationReplayError);
    expect(error).toMatchObject({ code });
    return error as LegacyV1HistoricalPublicationReplayError;
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

function receiptWithCurrentFingerprint(
  receipt: LegacyV1HistoricalPublicationReplayReceiptV1,
  changes: Partial<LegacyV1HistoricalPublicationReplayReceiptV1>,
) {
  const changed = { ...structuredClone(receipt), ...changes };
  const { receiptFingerprint: _receiptFingerprint, ...material } = changed;
  void _receiptFingerprint;
  return {
    ...material,
    receiptFingerprint: `legacy-v1-historical-publication-replay-${canonicalValueFingerprint(material)}`,
  };
}

describe("P10B-19A-09C canonical historical publication replay", () => {
  it("exposes exactly five bounded fail-closed error codes", () => {
    expect(legacyV1HistoricalPublicationReplayErrorCodes).toStrictEqual([
      "invalid-legacy-v1-publication-replay-input",
      "legacy-v1-publication-source-mismatch",
      "legacy-v1-publication-compiler-failure",
      "legacy-v1-publication-migration-unresolved",
      "stale-legacy-v1-publication-replay-receipt",
    ]);
    const unsafe = "UNBOUNDED MERCHANT COPY ".repeat(100);
    const error = expectReplayError(
      () =>
        compileLegacyV1HistoricalPublicationReplay({
          aggregate: { merchantCopy: unsafe },
          historicalReadResult: { snapshot: unsafe },
          currentEvidenceReferences: [],
        }),
      "invalid-legacy-v1-publication-replay-input",
    );
    expect(error.message).not.toContain(unsafe);
    expect(canonicalValueString(error.safeIdentifiers)).not.toContain(unsafe);
  });

  it.each(representatives)(
    "compiles %s through the current manual published compiler without mutating source authority",
    (directionId, aliasId) => {
      const fixture = fixtureFor(directionId);
      const aggregateBefore = canonicalValueString(fixture.aggregate);
      const readResultBefore = canonicalValueString(fixture.historicalReadResult);
      const evidenceBefore = canonicalValueString(fixture.currentEvidenceReferences);

      const first = compileLegacyV1HistoricalPublicationReplay(fixture.input);
      const second = compileLegacyV1HistoricalPublicationReplay(fixture.input);

      expect(first).toStrictEqual(second);
      expect(first.receipt).toStrictEqual({
        receiptSchemaVersion: LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_RECEIPT_SCHEMA_VERSION,
        authorityKind: LEGACY_V1_HISTORICAL_PUBLICATION_REPLAY_AUTHORITY_KIND,
        historicalReadReceiptFingerprint: fixture.historicalReadResult.receipt.receiptFingerprint,
        readDisposition: "readable-explicit-replay-binding",
        replayBinding: {
          aliasId,
          replayReferenceFingerprint:
            fixture.historicalReadResult.receipt.replayBinding?.replayReferenceFingerprint,
        },
        sourceSnapshot: fixture.historicalReadResult.receipt.sourceSnapshot,
        compilerAuthority: {
          publishCompilerContractVersion,
          publishCompilerVersion,
          sourceAuthorityKind: "manual",
          rendererTarget: "published",
          compiledRuntimeFingerprint: first.compilation.result.runtimeFingerprint,
          validationReportFingerprint: first.compilation.result.validationReportFingerprint,
          compileReceiptFingerprint: first.compilation.receipt.fingerprint,
          migrationStatus: "current",
          migrationFingerprint: first.compilation.receipt.migrationFingerprint,
        },
        receiptFingerprint: first.receipt.receiptFingerprint,
      });
      expect(first.receipt.receiptFingerprint).toMatch(
        /^legacy-v1-historical-publication-replay-v1_[1-9][0-9]*_[a-f0-9]{64}$/u,
      );
      expect(first.compilation.receipt).toMatchObject({
        version: publishCompilerContractVersion,
        compilerVersion: publishCompilerVersion,
        sourceAuthorityKind: "manual",
        projectId: fixture.aggregate.project.id,
        projectRevision: fixture.aggregate.project.revision,
        draftId: fixture.historical.id,
        sourceSnapshotId: fixture.historical.id,
        sourceSnapshotRevision: fixture.historical.revision,
        sourceSnapshotFingerprint: canonicalStorefrontContentFingerprint(fixture.historical),
        migrationStatus: "current",
      });
      expect(first.compilation.result).toMatchObject({
        rendererTarget: "published",
        sourceSnapshot: {
          id: fixture.historical.id,
          revision: fixture.historical.revision,
          fingerprint: canonicalStorefrontContentFingerprint(fixture.historical),
        },
      });
      expect(fixture.aggregate.project.draftSnapshotId).not.toBe(fixture.historical.id);
      expect(canonicalValueString(fixture.aggregate)).toBe(aggregateBefore);
      expect(canonicalValueString(fixture.historicalReadResult)).toBe(readResultBefore);
      expect(canonicalValueString(fixture.currentEvidenceReferences)).toBe(evidenceBefore);
      expect(assertLegacyV1HistoricalPublicationReplayCurrent(fixture.input, first)).toStrictEqual(
        first,
      );
      expectDeeplyFrozen(first);
    },
  );

  it("retains truthful unattributed A-09B authority as a null replay binding", () => {
    const fixture = fixtureFor("premium-editorial", false);
    const result = compileLegacyV1HistoricalPublicationReplay(fixture.input);

    expect(result.receipt.readDisposition).toBe("readable-unattributed");
    expect(result.receipt.replayBinding).toBeNull();
    expect(result.compilation.receipt.sourceAuthorityKind).toBe("manual");
    expect(result.receipt.historicalReadReceiptFingerprint).toBe(
      fixture.historicalReadResult.receipt.receiptFingerprint,
    );
  });

  it("excludes selectionId while retaining executable replay-reference provenance", () => {
    const fixture = fixtureFor("premium-editorial");
    const outcome = createP10B16RepresentativeOutcome("premium-editorial", 0);
    const originalReference = createLegacyV1StorefrontReplayReference({
      aliasId: fixture.aliasId,
      sourceSelection: outcome.narrowing,
    });
    const changedSelectionReference = createLegacyV1StorefrontReplayReference({
      aliasId: fixture.aliasId,
      sourceSelection: {
        ...outcome.narrowing,
        selectionId: `${outcome.narrowing.selectionId}_incidental`,
      },
    });
    const changedExecutableReference = createLegacyV1StorefrontReplayReference({
      aliasId: fixture.aliasId,
      sourceSelection: { ...outcome.narrowing, narrativePosture: "campaign-led" },
    });
    const readWith = (replayReference: unknown) =>
      readLegacyV1HistoricalSnapshot({
        snapshot: fixture.historical,
        catalogue: fixture.aggregate.catalogue,
        replayReference,
      });
    const originalRead = readWith(originalReference);
    const changedSelectionRead = readWith(changedSelectionReference);
    const changedExecutableRead = readWith(changedExecutableReference);
    const inputWith = (
      historicalReadResult: LegacyV1HistoricalSnapshotReadResultV1,
    ): LegacyV1HistoricalPublicationReplayInput => ({
      ...fixture.input,
      historicalReadResult,
    });
    const original = compileLegacyV1HistoricalPublicationReplay(inputWith(originalRead));
    const changedSelection = compileLegacyV1HistoricalPublicationReplay(
      inputWith(changedSelectionRead),
    );
    const changedExecutable = compileLegacyV1HistoricalPublicationReplay(
      inputWith(changedExecutableRead),
    );

    expect(changedSelectionReference.replayFingerprint).toBe(originalReference.replayFingerprint);
    expect(changedSelectionRead.receipt).toStrictEqual(originalRead.receipt);
    expect(changedSelection).toStrictEqual(original);
    expect(canonicalValueString(changedSelection.receipt)).not.toContain("selectionId");
    expect(changedExecutableReference.replayFingerprint).not.toBe(
      originalReference.replayFingerprint,
    );
    expect(changedExecutable.compilation).toStrictEqual(original.compilation);
    expect(changedExecutable.receipt.receiptFingerprint).not.toBe(
      original.receipt.receiptFingerprint,
    );
  });

  it("makes changed canonical source content fingerprint-significant without write-back", () => {
    const fixture = fixtureFor("premium-editorial", false);
    const changedHistorical = structuredClone(fixture.historical);
    changedHistorical.pages[0].title.en = `${changedHistorical.pages[0].title.en} revised`;
    const changedAggregate = replaceHistorical(fixture.aggregate, changedHistorical);
    const changedRead = readLegacyV1HistoricalSnapshot({
      snapshot: changedHistorical,
      catalogue: changedAggregate.catalogue,
    });
    const changedInput = {
      aggregate: changedAggregate,
      historicalReadResult: changedRead,
      currentEvidenceReferences: fixture.currentEvidenceReferences,
    };

    const original = compileLegacyV1HistoricalPublicationReplay(fixture.input);
    const changed = compileLegacyV1HistoricalPublicationReplay(changedInput);

    expect(changed.receipt.sourceSnapshot.canonicalSnapshotFingerprint).not.toBe(
      original.receipt.sourceSnapshot.canonicalSnapshotFingerprint,
    );
    expect(changed.compilation.result.runtimeFingerprint).not.toBe(
      original.compilation.result.runtimeFingerprint,
    );
    expect(changed.receipt.receiptFingerprint).not.toBe(original.receipt.receiptFingerprint);
    expect(snapshotById(changedAggregate, changedHistorical.id)).toStrictEqual(changedHistorical);
  });
});

describe("P10B-19A-09C strict receipt and current-authority assertion", () => {
  it("strict-parses one exact deeply readonly bounded receipt", () => {
    const fixture = fixtureFor("modern-technical");
    const result = compileLegacyV1HistoricalPublicationReplay(fixture.input);
    const parsed = parseLegacyV1HistoricalPublicationReplayReceipt(result.receipt);

    expect(parsed).toStrictEqual(result.receipt);
    expect(Object.keys(parsed)).toStrictEqual([
      "receiptSchemaVersion",
      "authorityKind",
      "historicalReadReceiptFingerprint",
      "readDisposition",
      "replayBinding",
      "sourceSnapshot",
      "compilerAuthority",
      "receiptFingerprint",
    ]);
    expect(Object.keys(parsed.replayBinding ?? {})).toStrictEqual([
      "aliasId",
      "replayReferenceFingerprint",
    ]);
    expect(Object.keys(parsed.sourceSnapshot)).toStrictEqual([
      "snapshotId",
      "projectId",
      "revision",
      "catalogueRef",
      "canonicalSnapshotFingerprint",
    ]);
    expect(Object.keys(parsed.compilerAuthority)).toStrictEqual([
      "publishCompilerContractVersion",
      "publishCompilerVersion",
      "sourceAuthorityKind",
      "rendererTarget",
      "compiledRuntimeFingerprint",
      "validationReportFingerprint",
      "compileReceiptFingerprint",
      "migrationStatus",
      "migrationFingerprint",
    ]);
    expectDeeplyFrozen(parsed);
    const serialized = canonicalValueString(parsed);
    [
      "snapshot",
      "catalogue",
      "pages",
      "sections",
      "products",
      "collections",
      "prices",
      "inventory",
      "assetUrl",
      "rawCompilation",
      "compiledPages",
      "componentExecutions",
      "currentEvidenceReferences",
      "publicationOperation",
      "acceptedAiReceipt",
      "providerId",
      "providerPayload",
      "prompt",
      "merchantId",
      "projectName",
      "structuralFamilyId",
      "pageBlueprintV2Id",
      "visualRecipeId",
      "selectionReceipt",
      "migrationResult",
      "writeBack",
      "rawHtml",
      "screenshot",
      "publishedAt",
      "createdAt",
      "updatedAt",
    ].forEach((key) => expect(serialized).not.toContain(`"${key}"`));
  });

  it("rejects stale or expanded receipts without silent fingerprint repair", () => {
    const result = compileLegacyV1HistoricalPublicationReplay(fixtureFor("minimal-commerce").input);
    expectReplayError(
      () =>
        parseLegacyV1HistoricalPublicationReplayReceipt({
          ...result.receipt,
          receiptFingerprint: staleFingerprint(result.receipt.receiptFingerprint),
        }),
      "stale-legacy-v1-publication-replay-receipt",
    );
    expectReplayError(
      () =>
        parseLegacyV1HistoricalPublicationReplayReceipt({
          ...result.receipt,
          rawHtml: "<main>not receipt authority</main>",
        }),
      "stale-legacy-v1-publication-replay-receipt",
    );
  });

  it("fingerprints bounded compiler runtime and migration authority and rejects stale current results", () => {
    const fixture = fixtureFor("modern-technical");
    const result = compileLegacyV1HistoricalPublicationReplay(fixture.input);
    const changedRuntimeReceipt = receiptWithCurrentFingerprint(result.receipt, {
      compilerAuthority: {
        ...result.receipt.compilerAuthority,
        compiledRuntimeFingerprint: staleFingerprint(
          result.receipt.compilerAuthority.compiledRuntimeFingerprint,
        ),
      },
    });
    const changedMigrationReceipt = receiptWithCurrentFingerprint(result.receipt, {
      compilerAuthority: {
        ...result.receipt.compilerAuthority,
        migrationFingerprint: staleFingerprint(
          result.receipt.compilerAuthority.migrationFingerprint,
        ),
      },
    });

    expect(parseLegacyV1HistoricalPublicationReplayReceipt(changedRuntimeReceipt)).toStrictEqual(
      changedRuntimeReceipt,
    );
    expect(parseLegacyV1HistoricalPublicationReplayReceipt(changedMigrationReceipt)).toStrictEqual(
      changedMigrationReceipt,
    );
    expect(changedRuntimeReceipt.receiptFingerprint).not.toBe(result.receipt.receiptFingerprint);
    expect(changedMigrationReceipt.receiptFingerprint).not.toBe(result.receipt.receiptFingerprint);
    expectReplayError(
      () =>
        assertLegacyV1HistoricalPublicationReplayCurrent(fixture.input, {
          ...result,
          receipt: changedRuntimeReceipt,
        }),
      "stale-legacy-v1-publication-replay-receipt",
    );
    expectReplayError(
      () =>
        assertLegacyV1HistoricalPublicationReplayCurrent(fixture.input, {
          ...result,
          receipt: changedMigrationReceipt,
        }),
      "stale-legacy-v1-publication-replay-receipt",
    );
    expectReplayError(
      () =>
        assertLegacyV1HistoricalPublicationReplayCurrent(fixture.input, {
          ...result,
          compilation: {
            ...result.compilation,
            result: {
              ...result.compilation.result,
              runtimeFingerprint: staleFingerprint(result.compilation.result.runtimeFingerprint),
            },
          },
        }),
      "stale-legacy-v1-publication-replay-receipt",
    );
  });
});

describe("P10B-19A-09C fail-closed input and source binding", () => {
  it("rejects unknown envelopes, malformed aggregates and expanded A-09B results", () => {
    const fixture = fixtureFor("premium-editorial");
    const invalidDraftAggregate = structuredClone(fixture.aggregate);
    invalidDraftAggregate.project.draftSnapshotId = "snapshot_missing";
    const cases = [
      { ...fixture.input, extraAuthority: true },
      { ...fixture.input, aggregate: invalidDraftAggregate },
      {
        ...fixture.input,
        historicalReadResult: { ...fixture.historicalReadResult, repaired: true },
      },
    ];
    cases.forEach((input) =>
      expectReplayError(
        () => compileLegacyV1HistoricalPublicationReplay(input),
        "invalid-legacy-v1-publication-replay-input",
      ),
    );
  });

  it("rejects a stale A-09B receipt before compilation", () => {
    const fixture = fixtureFor("premium-editorial");
    expectReplayError(
      () =>
        compileLegacyV1HistoricalPublicationReplay({
          ...fixture.input,
          historicalReadResult: {
            ...fixture.historicalReadResult,
            receipt: {
              ...fixture.historicalReadResult.receipt,
              receiptFingerprint: staleFingerprint(
                fixture.historicalReadResult.receipt.receiptFingerprint,
              ),
            },
          },
        }),
      "invalid-legacy-v1-publication-replay-input",
    );
  });

  it.each([
    [
      "snapshot ID",
      (snapshot: StorefrontSnapshot) => {
        snapshot.id = "snapshot_p10b_19a_09c_other";
      },
    ],
    [
      "project ID",
      (snapshot: StorefrontSnapshot) => {
        snapshot.projectId = "project_p10b_19a_09c_other";
      },
    ],
    [
      "revision",
      (snapshot: StorefrontSnapshot) => {
        snapshot.revision += 1;
      },
    ],
    [
      "catalogue reference",
      (snapshot: StorefrontSnapshot) => {
        snapshot.catalogueRef = "catalogue_p10b_19a_09c_other";
      },
    ],
    [
      "canonical snapshot fingerprint",
      (snapshot: StorefrontSnapshot) => {
        snapshot.pages[0].title.en = `${snapshot.pages[0].title.en} mismatch`;
      },
    ],
  ] as const)("rejects a read snapshot with mismatched %s", (_label, mutate) => {
    const fixture = fixtureFor("premium-editorial");
    const mismatchedSnapshot = structuredClone(fixture.historical);
    mutate(mismatchedSnapshot);

    expectReplayError(
      () =>
        compileLegacyV1HistoricalPublicationReplay({
          ...fixture.input,
          historicalReadResult: {
            ...fixture.historicalReadResult,
            snapshot: mismatchedSnapshot,
          },
        }),
      "legacy-v1-publication-source-mismatch",
    );
  });

  it("rejects a missing source snapshot and valid foreign catalogue authority", () => {
    const fixture = fixtureFor("premium-editorial");
    const aggregateWithoutHistorical = validateProjectAggregate({
      ...structuredClone(fixture.aggregate),
      snapshots: fixture.aggregate.snapshots
        .filter(({ id }) => id !== fixture.historical.id)
        .map((snapshot) => structuredClone(snapshot)),
      snapshotHistoryMetadata: [],
    });
    expectReplayError(
      () =>
        compileLegacyV1HistoricalPublicationReplay({
          ...fixture.input,
          aggregate: aggregateWithoutHistorical,
        }),
      "legacy-v1-publication-source-mismatch",
    );

    const foreignCatalogue = structuredClone(fixture.aggregate.catalogue);
    foreignCatalogue.id = "catalogue_p10b_19a_09c_foreign";
    const foreignSnapshot = structuredClone(fixture.historical);
    foreignSnapshot.catalogueRef = foreignCatalogue.id;
    const foreignRead = readLegacyV1HistoricalSnapshot({
      snapshot: foreignSnapshot,
      catalogue: foreignCatalogue,
    });
    expectReplayError(
      () =>
        compileLegacyV1HistoricalPublicationReplay({
          ...fixture.input,
          historicalReadResult: foreignRead,
        }),
      "legacy-v1-publication-source-mismatch",
    );
  });

  it("maps current compiler rejection and unresolved migration to distinct bounded codes", () => {
    const fixture = fixtureFor("premium-editorial");
    expectReplayError(
      () =>
        compileLegacyV1HistoricalPublicationReplay({
          ...fixture.input,
          currentEvidenceReferences: [],
        }),
      "legacy-v1-publication-compiler-failure",
    );

    const expandedHistorical = expandDynamicCommerceRoutePages(
      fixture.historical,
      fixture.aggregate.catalogue,
    );
    const searchRoute = fixture.historical.dynamicCommercePresentation?.routeInventory.find(
      ({ kind }) => kind === "search",
    );
    if (!searchRoute) throw new Error("Missing representative search route.");
    const searchPage = resolveDynamicCommerceRoutePage({
      snapshot: fixture.historical,
      catalogue: fixture.aggregate.catalogue,
      routeId: searchRoute.id,
      searchBinding: {
        canonicalRevision: `canonical-commerce-${canonicalValueFingerprint(
          fixture.aggregate.catalogue,
        )}`,
        resultProductIds: [],
      },
    }).page;
    searchPage.sections[0].content = {
      ...searchPage.sections[0].content,
      collectionId: fixture.aggregate.catalogue.collections[0].id,
    };
    expandedHistorical.pages.push(searchPage);
    const homePage = expandedHistorical.pages.find(
      ({ pageFamily }) => pageFamily?.familyId === "home",
    );
    if (!homePage) throw new Error("Missing representative homepage.");
    expandedHistorical.pages
      .filter(({ id }) => !fixture.historical.pages.some((page) => page.id === id))
      .forEach((page) => {
        if (!page.pageFamily) throw new Error("Missing expanded page-family authority.");
        const navigationAreas = (["primary", "footer"] as const).filter((area) =>
          expandedHistorical.navigation[area].some(
            ({ target }) => target.type === "page" && target.pageId === page.id,
          ),
        );
        page.pageFamily.navigationAreas = [...navigationAreas];
        if (navigationAreas.length === 0) page.pageFamily.parentPageId = homePage.id;
      });
    const expandedAggregate = replaceHistorical(fixture.aggregate, expandedHistorical);
    const expandedRead = readLegacyV1HistoricalSnapshot({
      snapshot: expandedHistorical,
      catalogue: expandedAggregate.catalogue,
    });
    expectReplayError(
      () =>
        compileLegacyV1HistoricalPublicationReplay({
          aggregate: expandedAggregate,
          historicalReadResult: expandedRead,
          currentEvidenceReferences: fixture.currentEvidenceReferences,
        }),
      "legacy-v1-publication-migration-unresolved",
    );
  });
});
