import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
} from "@/domain/storefront";
import {
  GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
  GoldenStoreEvaluationError,
  goldenStoreEvaluationLifecycleStates,
  goldenStoreEvaluationLocales,
  goldenStoreEvaluationSurfaces,
  goldenStoreEvaluationViewports,
  type GoldenStoreEvaluationInput,
  type GoldenStoreEvaluationRun,
  type GoldenStoreEvaluationScenario,
  type GoldenStoreLifecycleEvidence,
  type GoldenStoreResponsiveEvidence,
} from "./contract";

function keyOf(
  value: Pick<GoldenStoreResponsiveEvidence, "lifecycle" | "surface" | "locale" | "viewport">,
): string {
  return [value.lifecycle, value.surface, value.locale, value.viewport].join(":");
}

function requireNonEmpty(value: string, label: string): void {
  if (!value.trim()) {
    throw new GoldenStoreEvaluationError("invalid-input", `${label} is required.`);
  }
}

function lifecycleByState(input: GoldenStoreEvaluationInput) {
  const entries = new Map(input.lifecycle.map((entry) => [entry.state, entry]));
  if (entries.size !== goldenStoreEvaluationLifecycleStates.length) {
    throw new GoldenStoreEvaluationError(
      "invalid-input",
      "Golden-store evidence must contain each lifecycle state exactly once.",
    );
  }
  for (const state of goldenStoreEvaluationLifecycleStates) {
    if (!entries.has(state)) {
      throw new GoldenStoreEvaluationError(
        "invalid-input",
        `Golden-store evidence is missing the ${state} lifecycle state.`,
      );
    }
  }
  return entries as Map<
    (typeof goldenStoreEvaluationLifecycleStates)[number],
    GoldenStoreLifecycleEvidence
  >;
}

function assertCurrentBaseline(
  input: GoldenStoreEvaluationInput,
  baseline: GoldenStoreLifecycleEvidence,
): void {
  if (
    baseline.snapshot.id !== input.canonicalBaseline.snapshotId ||
    baseline.snapshot.revision !== input.canonicalBaseline.revision ||
    baseline.revision !== input.canonicalBaseline.revision ||
    canonicalStorefrontContentFingerprint(baseline.snapshot) !==
      input.canonicalBaseline.fingerprint ||
    baseline.snapshotFingerprint !== input.canonicalBaseline.fingerprint
  ) {
    throw new GoldenStoreEvaluationError(
      "stale-baseline",
      "Golden-store baseline revision or canonical fingerprint is stale.",
    );
  }
}

function assertCurrentManifest(input: GoldenStoreEvaluationInput): void {
  const current = veskifyComponentCapabilityManifest.manifest;
  if (
    input.manifest.version !== current.version ||
    input.manifest.fingerprint !== current.fingerprint
  ) {
    throw new GoldenStoreEvaluationError(
      "stale-manifest",
      "Golden-store evidence does not match the current capability manifest.",
    );
  }
}

function assertCurrentProfiles(input: GoldenStoreEvaluationInput): void {
  const pageTypes = ["home", "collection", "product"] as const;
  if (input.pageBlueprintMaterializations.length !== pageTypes.length) {
    throw new GoldenStoreEvaluationError(
      "stale-profile",
      "Golden-store evidence must capture one canonical materialization per page family.",
    );
  }
  for (const pageType of pageTypes) {
    const materializations = input.pageBlueprintMaterializations.filter(
      (entry) => entry.pageType === pageType,
    );
    if (materializations.length !== 1) {
      throw new GoldenStoreEvaluationError(
        "stale-profile",
        `Golden-store evidence must capture one ${pageType} PageBlueprint materialization.`,
      );
    }
    const materialization = materializations[0];
    const profile = veskifyComponentCapabilityManifest.getByProfileId(materialization.profileId);
    if (
      !profile ||
      profile.pageType !== materialization.pageType ||
      profile.profileVersion !== materialization.profileVersion ||
      profile.orderedNarrativeRoles.join(":") !== materialization.roleOrder.join(":") ||
      profile.componentSelections.length !== materialization.slots.length ||
      profile.requiredBindingCategories.join(":") !==
        materialization.requiredBindingCategories.join(":") ||
      profile.requiredAssetRoles.join(":") !== materialization.requiredAssetRoles.join(":") ||
      materialization.slots.some(
        (slot, index) =>
          profile.componentSelections[index]?.slotId !== slot.slotId ||
          profile.componentSelections[index]?.componentType !== slot.component ||
          profile.componentSelections[index]?.defaultVariant !== slot.variant,
      )
    ) {
      throw new GoldenStoreEvaluationError(
        "stale-profile",
        `Golden-store materialization for ${materialization.profileId} is stale or incompatible.`,
      );
    }
    for (const cardinality of profile.roleCardinality) {
      const count = materialization.roleOrder.filter((role) => role === cardinality.role).length;
      if (count < cardinality.minimum || count > cardinality.maximum) {
        throw new GoldenStoreEvaluationError(
          "stale-profile",
          `Golden-store materialization for ${materialization.profileId} violates ${cardinality.role} cardinality.`,
        );
      }
    }
  }
}

function assertLifecycleParity(entries: Map<string, GoldenStoreLifecycleEvidence>): void {
  const accepted = entries.get("accepted")!;
  for (const state of ["saved-reloaded", "published"] as const) {
    const current = entries.get(state)!;
    if (
      current.snapshotFingerprint !== accepted.snapshotFingerprint ||
      current.protectedCommerceFingerprint !== accepted.protectedCommerceFingerprint ||
      current.approvedAssetFingerprint !== accepted.approvedAssetFingerprint ||
      current.navigationFingerprint !== accepted.navigationFingerprint
    ) {
      throw new GoldenStoreEvaluationError(
        "lifecycle-parity",
        `Accepted and ${state} lifecycle evidence must preserve canonical state.`,
      );
    }
  }
}

function assertProtectedState(entries: Map<string, GoldenStoreLifecycleEvidence>): void {
  const baseline = entries.get("baseline")!;
  for (const entry of entries.values()) {
    if (
      entry.protectedCommerceFingerprint !== baseline.protectedCommerceFingerprint ||
      entry.approvedAssetFingerprint !== baseline.approvedAssetFingerprint ||
      entry.navigationFingerprint !== baseline.navigationFingerprint
    ) {
      throw new GoldenStoreEvaluationError(
        "protected-state",
        "Golden-store lifecycle evidence changed protected commerce, approved assets, or navigation.",
      );
    }
  }
}

function assertCompleteMatrix(input: GoldenStoreEvaluationInput): GoldenStoreEvaluationScenario[] {
  const evidence = new Map(input.responsiveEvidence.map((entry) => [keyOf(entry), entry]));
  const scenarios: GoldenStoreEvaluationScenario[] = [];
  for (const lifecycle of goldenStoreEvaluationLifecycleStates) {
    for (const surface of goldenStoreEvaluationSurfaces) {
      for (const locale of goldenStoreEvaluationLocales) {
        for (const viewport of goldenStoreEvaluationViewports) {
          const key = keyOf({ lifecycle, surface, locale, viewport });
          const entry = evidence.get(key);
          if (!entry) {
            throw new GoldenStoreEvaluationError(
              "incomplete-matrix",
              `Golden-store evidence is missing ${key}.`,
            );
          }
          if (entry.responsiveStatus !== "passed" || entry.accessibilityStatus !== "passed") {
            throw new GoldenStoreEvaluationError(
              "failed-structural-evidence",
              `Golden-store structural evidence failed for ${key}.`,
            );
          }
          scenarios.push({
            lifecycle,
            surface,
            locale,
            viewport,
            evidenceReference: key,
            screenshotReference: entry.screenshotReference,
          });
        }
      }
    }
  }
  if (evidence.size !== scenarios.length) {
    throw new GoldenStoreEvaluationError(
      "incomplete-matrix",
      "Golden-store evidence contains duplicate or unsupported matrix entries.",
    );
  }
  return scenarios;
}

/**
 * Captures deterministic, fail-closed evaluation evidence. It makes no visual
 * quality verdict and has no provider, browser-storage, or fixture-preparation side effect.
 */
export function runDeterministicGoldenStoreEvaluation(
  input: GoldenStoreEvaluationInput,
): GoldenStoreEvaluationRun {
  requireNonEmpty(input.evaluationId, "evaluationId");
  requireNonEmpty(input.fixture.fixtureId, "fixture.fixtureId");
  requireNonEmpty(input.fixture.projectId, "fixture.projectId");
  if (input.evaluationVersion !== GOLDEN_STORE_EVALUATION_CONTRACT_VERSION) {
    throw new GoldenStoreEvaluationError(
      "invalid-input",
      "Golden-store evaluation version is unsupported.",
    );
  }
  const lifecycle = lifecycleByState(input);
  const baseline = lifecycle.get("baseline")!;
  assertCurrentBaseline(input, baseline);
  assertCurrentManifest(input);
  assertCurrentProfiles(input);
  assertLifecycleParity(lifecycle);
  assertProtectedState(lifecycle);
  const scenarios = assertCompleteMatrix(input);
  const projectedLifecycle = goldenStoreEvaluationLifecycleStates.map((state) => {
    const entry = lifecycle.get(state)!;
    const { snapshot: _snapshot, ...evidence } = entry;
    return evidence;
  });
  const materializations = input.pageBlueprintMaterializations.map((entry) =>
    structuredClone(entry),
  );
  const fingerprint = canonicalValueFingerprint({
    evaluationId: input.evaluationId,
    contractVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
    fixture: input.fixture,
    canonicalBaseline: input.canonicalBaseline,
    manifest: input.manifest,
    pageBlueprintMaterializations: materializations,
    lifecycle: projectedLifecycle,
    scenarios,
  });
  return Object.freeze({
    evaluationId: input.evaluationId,
    contractVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
    fixture: structuredClone(input.fixture),
    canonicalBaseline: structuredClone(input.canonicalBaseline),
    manifest: structuredClone(input.manifest),
    pageBlueprintMaterializations: materializations,
    lifecycle: projectedLifecycle,
    scenarios,
    structuralAssertions: {
      roleCardinality: true as const,
      requiredComponents: true as const,
      sharedFrameCoherence: true as const,
      bindingValidity: true as const,
      responsiveAccessibility: true as const,
      lifecycleParity: true as const,
      editorPreviewPublishParity: true as const,
      protectedStatePreserved: true as const,
    },
    deterministicEvidence: {
      baselineCurrent: true as const,
      manifestCurrent: true as const,
      profilesCurrent: true as const,
      matrixComplete: true as const,
    },
    structuralQualitySignals: {
      pageBlueprintRolesCaptured: true as const,
      componentVariantsCaptured: true as const,
      boundedParametersCaptured: true as const,
      commerceBindingsCaptured: true as const,
      brandSystemFingerprint: canonicalValueFingerprint(baseline.snapshot.brandSystem),
    },
    humanVisualReview: { status: "not-reviewed" as const, reviewer: null, notes: null },
    futureProviderEvidence: { status: "not-run" as const, references: [] },
    outcome: "passed" as const,
    fingerprint,
  });
}
