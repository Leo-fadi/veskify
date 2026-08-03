import { describe, expect, it } from "vitest";
import { createApprovedGenerationAssetContextFingerprint } from "@/application/ai-storefront-generation";
import {
  GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
  GoldenStoreEvaluationError,
  goldenStoreEvaluationLifecycleStates,
  goldenStoreEvaluationLocales,
  goldenStoreEvaluationSurfaces,
  goldenStoreEvaluationViewports,
  runDeterministicGoldenStoreEvaluation,
} from "@/application/golden-store-evaluation";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront";

function snapshotRealizing(
  snapshot: ReturnType<typeof createP905aFreshMerchantFixture>["draft"],
  materializations: ReturnType<
    typeof createWholeStorefrontGenerationPlan
  >["pageBlueprintMaterializations"],
) {
  const realized = structuredClone(snapshot);
  for (const materialization of materializations) {
    const page = realized.pages.find((candidate) => candidate.type === materialization.pageType);
    if (!page) throw new Error(`Missing ${materialization.pageType} fixture page.`);
    page.sections = materialization.slots.map((slot) => ({
      id: `section_${page.id}_${slot.slotId}`,
      component: slot.component,
      variant: slot.variant,
      visible: true,
      content: {},
      props: {},
    }));
  }
  return realized;
}

function evaluationInput() {
  const fixture = createP905aFreshMerchantFixture("modernTechnical");
  const plan = createWholeStorefrontGenerationPlan(fixture.planningInput);
  const snapshot = snapshotRealizing(fixture.draft, plan.pageBlueprintMaterializations);
  const snapshotFingerprint = canonicalStorefrontContentFingerprint(snapshot);
  return {
    evaluationId: "p10a-07a-lumo-modern-technical",
    evaluationVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
    fixture: { fixtureId: "p9-05a-lumo", projectId: fixture.aggregate.project.id },
    canonicalBaseline: { snapshot: structuredClone(snapshot), snapshotFingerprint },
    manifest: {
      version: veskifyComponentCapabilityManifest.manifest.version,
      fingerprint: veskifyComponentCapabilityManifest.manifest.fingerprint,
    },
    pageBlueprintMaterializations: plan.pageBlueprintMaterializations,
    lifecycle: goldenStoreEvaluationLifecycleStates.map((state) => ({
      state,
      snapshot: structuredClone(snapshot),
      revision: snapshot.revision,
      snapshotFingerprint,
      canonicalCommerce: structuredClone(fixture.aggregate.catalogue),
      approvedAssets: structuredClone(fixture.assetContext),
    })),
    responsiveEvidence: goldenStoreEvaluationLifecycleStates.flatMap((lifecycle) =>
      goldenStoreEvaluationSurfaces.flatMap((surface) =>
        goldenStoreEvaluationLocales.flatMap((locale) =>
          goldenStoreEvaluationViewports.map((viewport) => ({
            lifecycle,
            surface,
            locale,
            viewport,
            responsiveStatus: "passed" as const,
            accessibilityStatus: "passed" as const,
            rendererOutput: {
              target:
                lifecycle === "proposal-preview"
                  ? "proposal"
                  : lifecycle === "accepted-editor"
                    ? "editor"
                    : lifecycle === "published"
                      ? "published"
                      : "preview",
              output: {
                lifecycle,
                surface,
                locale,
                viewport,
                snapshotFingerprint,
              },
            },
            screenshotReference: null,
          })),
        ),
      ),
    ),
  };
}

function validInput() {
  return evaluationInput();
}

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof GoldenStoreEvaluationError) return error.code;
    throw error;
  }
  throw new Error("Expected a deterministic evaluation failure.");
}

describe("P10A-07A deterministic golden-store evaluation harness", () => {
  it("requires proposal preview, accepted editor, preview route, saved/reloaded, and published observations", () => {
    const run = runDeterministicGoldenStoreEvaluation(validInput());
    expect(run.scenarios).toHaveLength(5 * 4 * 2 * 4);
    expect(run.scenarios).toContainEqual(
      expect.objectContaining({
        lifecycle: "preview-route",
        surface: "product",
        locale: "fi",
        viewport: 1440,
      }),
    );
  });

  it("captures canonical PageBlueprint roles, variants, bounded parameters, and binding categories", () => {
    const run = runDeterministicGoldenStoreEvaluation(validInput());
    expect(run.pageBlueprintMaterializations.map((entry) => entry.pageType).sort()).toEqual([
      "collection",
      "home",
      "product",
    ]);
    expect(run.structuralQualitySignals).toMatchObject({
      pageBlueprintRolesCaptured: true,
      componentVariantsCaptured: true,
      boundedParametersCaptured: true,
      commerceBindingsCaptured: true,
    });
  });

  it("is deterministic and omits timestamps from the canonical run fingerprint", () => {
    const first = runDeterministicGoldenStoreEvaluation(validInput());
    const second = runDeterministicGoldenStoreEvaluation(validInput());
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(JSON.stringify(first)).not.toContain("evaluatedAt");
  });

  it("fails closed for stale baseline and every lifecycle snapshot fingerprint", () => {
    const base = validInput();
    const input = {
      ...base,
      canonicalBaseline: { ...base.canonicalBaseline, snapshotFingerprint: "stale-baseline" },
    };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("stale-baseline");
    for (const state of goldenStoreEvaluationLifecycleStates) {
      const lifecycle = base.lifecycle.map((entry) =>
        entry.state === state ? { ...entry, snapshotFingerprint: "stale-snapshot" } : entry,
      );
      expect(errorCode(() => runDeterministicGoldenStoreEvaluation({ ...base, lifecycle }))).toBe(
        "snapshot-fingerprint",
      );
    }
  });

  it("fails closed for a stale capability manifest", () => {
    const base = validInput();
    const input = { ...base, manifest: { ...base.manifest, fingerprint: "stale-manifest" } };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("stale-manifest");
  });

  it("fails closed for stale materialization fingerprints, parameters, and narrative metadata", () => {
    const base = validInput();
    const mutations = [
      (materializations: typeof base.pageBlueprintMaterializations) => {
        materializations[0].fingerprint = "stale-profile";
      },
      (materializations: typeof base.pageBlueprintMaterializations) => {
        materializations[0].slots[0].boundedParameters = { columnCount: 99 };
      },
      (materializations: typeof base.pageBlueprintMaterializations) => {
        materializations[0].slots[0].narrativeRole = "brand-story";
      },
      (materializations: typeof base.pageBlueprintMaterializations) => {
        materializations[0].slots[0].visualWeight = "dominant";
      },
    ];
    for (const mutate of mutations) {
      const pageBlueprintMaterializations = structuredClone(base.pageBlueprintMaterializations);
      mutate(pageBlueprintMaterializations);
      expect(
        errorCode(() =>
          runDeterministicGoldenStoreEvaluation({ ...base, pageBlueprintMaterializations }),
        ),
      ).toBe("stale-profile");
    }
  });

  it("fails closed when preview-route is absent or any matrix evidence is missing", () => {
    const base = validInput();
    const input = {
      ...base,
      lifecycle: base.lifecycle.filter((entry) => entry.state !== "preview-route"),
    };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("invalid-input");
    expect(
      errorCode(() =>
        runDeterministicGoldenStoreEvaluation({
          ...base,
          responsiveEvidence: base.responsiveEvidence.slice(1),
        }),
      ),
    ).toBe("invalid-input");
  });

  it("fails closed for responsive or accessibility structural evidence", () => {
    const base = validInput();
    const input = {
      ...base,
      responsiveEvidence: base.responsiveEvidence.map((entry, index) =>
        index === 0 ? { ...entry, accessibilityStatus: "failed" as const } : entry,
      ),
    };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe(
      "failed-structural-evidence",
    );
  });

  it("derives protected navigation, commerce, and approved-asset fingerprints from canonical objects", () => {
    const base = validInput();
    const navigationChanged = structuredClone(base.lifecycle[0].snapshot);
    navigationChanged.navigation.primary.reverse();
    const input = {
      ...base,
      lifecycle: base.lifecycle.map((entry) =>
        entry.state === "proposal-preview"
          ? {
              ...entry,
              snapshot: navigationChanged,
              snapshotFingerprint: canonicalStorefrontContentFingerprint(navigationChanged),
            }
          : entry,
      ),
    };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("protected-state");

    const commerceChanged = structuredClone(base.lifecycle[0].canonicalCommerce);
    commerceChanged.products[0].price!.amount += 1;
    expect(
      errorCode(() =>
        runDeterministicGoldenStoreEvaluation({
          ...base,
          lifecycle: base.lifecycle.map((entry) =>
            entry.state === "accepted-editor"
              ? { ...entry, canonicalCommerce: commerceChanged }
              : entry,
          ),
        }),
      ),
    ).toBe("protected-state");

    const approvedAssets = structuredClone(base.lifecycle[0].approvedAssets);
    approvedAssets.assets[0].revision = "changed-revision";
    approvedAssets.fingerprint = createApprovedGenerationAssetContextFingerprint({
      briefId: approvedAssets.briefId,
      briefRevision: approvedAssets.briefRevision,
      approvedEvidenceFingerprint: approvedAssets.approvedEvidenceFingerprint,
      assetReviewFingerprint: approvedAssets.assetReviewFingerprint,
      assets: approvedAssets.assets,
    });
    expect(
      errorCode(() =>
        runDeterministicGoldenStoreEvaluation({
          ...base,
          lifecycle: base.lifecycle.map((entry) =>
            entry.state === "accepted-editor" ? { ...entry, approvedAssets } : entry,
          ),
        }),
      ),
    ).toBe("protected-state");
  });

  it("fails closed for every lifecycle parity transition", () => {
    const base = validInput();
    for (const state of [
      "accepted-editor",
      "preview-route",
      "saved-reloaded",
      "published",
    ] as const) {
      const changed = structuredClone(
        base.lifecycle.find((entry) => entry.state === state)!.snapshot,
      );
      changed.brandSystem.colors.primary = "#123456";
      const lifecycle = base.lifecycle.map((entry) =>
        entry.state === state
          ? {
              ...entry,
              snapshot: changed,
              snapshotFingerprint: canonicalStorefrontContentFingerprint(changed),
            }
          : entry,
      );
      expect(errorCode(() => runDeterministicGoldenStoreEvaluation({ ...base, lifecycle }))).toBe(
        "lifecycle-parity",
      );
    }
  });

  it("rejects malformed snapshots, cross-project relabeling, stale realization, and duplicate evidence", () => {
    const base = validInput();
    expect(
      errorCode(() =>
        runDeterministicGoldenStoreEvaluation({
          ...base,
          lifecycle: [
            { ...base.lifecycle[0], snapshot: { invalid: true } },
            ...base.lifecycle.slice(1),
          ],
        }),
      ),
    ).toBe("invalid-input");
    expect(
      errorCode(() =>
        runDeterministicGoldenStoreEvaluation({
          ...base,
          fixture: { ...base.fixture, projectId: "project_other" },
        }),
      ),
    ).toBe("project-mismatch");
    const unrelated = structuredClone(base.lifecycle[0].snapshot);
    unrelated.pages[0].sections.pop();
    expect(
      errorCode(() =>
        runDeterministicGoldenStoreEvaluation({
          ...base,
          lifecycle: base.lifecycle.map((entry) =>
            entry.state === "proposal-preview"
              ? {
                  ...entry,
                  snapshot: unrelated,
                  snapshotFingerprint: canonicalStorefrontContentFingerprint(unrelated),
                }
              : entry,
          ),
        }),
      ),
    ).toBe("stale-profile");
    expect(
      errorCode(() =>
        runDeterministicGoldenStoreEvaluation({
          ...base,
          responsiveEvidence: [...base.responsiveEvidence.slice(0, -1), base.responsiveEvidence[0]],
        }),
      ),
    ).toBe("incomplete-matrix");
  });

  it("retains derived renderer evidence in each scenario and run fingerprint", () => {
    const base = validInput();
    const first = runDeterministicGoldenStoreEvaluation(base);
    const responsiveEvidence = base.responsiveEvidence.map((entry, index) =>
      index === 0
        ? { ...entry, rendererOutput: { ...entry.rendererOutput, output: { changed: true } } }
        : entry,
    );
    const second = runDeterministicGoldenStoreEvaluation({ ...base, responsiveEvidence });
    expect(first.scenarios[0].rendererOutputFingerprint).not.toBe(
      second.scenarios[0].rendererOutputFingerprint,
    );
    expect(first.fingerprint).not.toBe(second.fingerprint);
  });

  it("records human visual review and provider evidence as explicit future placeholders", () => {
    const run = runDeterministicGoldenStoreEvaluation(validInput());
    expect(run.humanVisualReview).toEqual({ status: "not-reviewed", reviewer: null, notes: null });
    expect(run.futureProviderEvidence).toEqual({ status: "not-run", references: [] });
  });

  it("does not invoke a provider while evaluating canonical fixture evidence", () => {
    const run = runDeterministicGoldenStoreEvaluation(validInput());
    expect(run.outcome).toBe("passed");
  });
});
