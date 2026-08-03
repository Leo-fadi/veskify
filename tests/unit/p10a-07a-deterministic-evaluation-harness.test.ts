import { describe, expect, it } from "vitest";
import {
  GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
  GoldenStoreEvaluationError,
  goldenStoreEvaluationLifecycleStates,
  goldenStoreEvaluationLocales,
  goldenStoreEvaluationSurfaces,
  goldenStoreEvaluationViewports,
  runDeterministicGoldenStoreEvaluation,
  type GoldenStoreEvaluationInput,
} from "@/application/golden-store-evaluation";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
} from "@/domain/storefront";

function evaluationInput(): GoldenStoreEvaluationInput {
  const fixture = createP905aFreshMerchantFixture("modernTechnical");
  const snapshot = fixture.draft;
  const snapshotFingerprint = canonicalStorefrontContentFingerprint(snapshot);
  const protectedCommerceFingerprint = canonicalValueFingerprint(fixture.aggregate.catalogue);
  const approvedAssetFingerprint = canonicalValueFingerprint(fixture.assetContext);
  const navigationFingerprint = canonicalValueFingerprint(snapshot.navigation);
  const plan = createWholeStorefrontGenerationPlan(fixture.planningInput);
  return {
    evaluationId: "p10a-07a-lumo-modern-technical",
    evaluationVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
    fixture: { fixtureId: "p9-05a-lumo", projectId: fixture.aggregate.project.id },
    canonicalBaseline: {
      snapshotId: snapshot.id,
      revision: snapshot.revision,
      fingerprint: snapshotFingerprint,
    },
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
      protectedCommerceFingerprint,
      approvedAssetFingerprint,
      navigationFingerprint,
      rendererOutputFingerprint: `renderer-${state}-${snapshotFingerprint}`,
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
            rendererOutputFingerprint: `renderer-${lifecycle}-${surface}-${locale}-${viewport}`,
            screenshotReference: null,
          })),
        ),
      ),
    ),
  };
}

function validInput(): GoldenStoreEvaluationInput {
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
  it("builds the complete 160-scenario lifecycle, surface, locale, and viewport matrix", () => {
    const run = runDeterministicGoldenStoreEvaluation(validInput());
    expect(run.scenarios).toHaveLength(5 * 4 * 2 * 4);
    expect(run.scenarios).toContainEqual(
      expect.objectContaining({
        lifecycle: "published",
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

  it("fails closed for a stale baseline revision or fingerprint", () => {
    const base = validInput();
    const input = { ...base, canonicalBaseline: { ...base.canonicalBaseline, revision: 99 } };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("stale-baseline");
  });

  it("fails closed for a stale capability manifest", () => {
    const base = validInput();
    const input = { ...base, manifest: { ...base.manifest, fingerprint: "stale-manifest" } };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("stale-manifest");
  });

  it("fails closed for a stale profile version, composition, or binding category", () => {
    const base = validInput();
    const input = {
      ...base,
      pageBlueprintMaterializations: base.pageBlueprintMaterializations.map((entry) =>
        entry.pageType === "home"
          ? { ...entry, profileVersion: "9.9.9", requiredBindingCategories: [] }
          : entry,
      ),
    };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("stale-profile");
  });

  it("fails closed when a lifecycle, locale, viewport, or page-surface evidence record is absent", () => {
    const base = validInput();
    const input = { ...base, responsiveEvidence: base.responsiveEvidence.slice(1) };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("incomplete-matrix");
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

  it("fails closed when protected commerce, approved assets, or navigation differ", () => {
    const base = validInput();
    const input = {
      ...base,
      lifecycle: base.lifecycle.map((entry) =>
        entry.state === "proposed-reviewable"
          ? { ...entry, approvedAssetFingerprint: "changed-approved-asset" }
          : entry,
      ),
    };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("protected-state");
  });

  it("fails closed when accepted, saved-reloaded, and published state lose parity", () => {
    const base = validInput();
    const input = {
      ...base,
      lifecycle: base.lifecycle.map((entry) =>
        entry.state === "published" ? { ...entry, snapshotFingerprint: "different" } : entry,
      ),
    };
    expect(errorCode(() => runDeterministicGoldenStoreEvaluation(input))).toBe("lifecycle-parity");
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
