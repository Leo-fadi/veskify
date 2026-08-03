import {
  getExecutablePageBlueprintProfile,
  materializeExecutablePageBlueprint,
  sharedStorefrontFrameProfile,
  validateExecutablePageBlueprintRealization,
} from "@/application/storefront-templates";
import { veskifyComponentDefinitionsV2 } from "@/components/registry";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
} from "@/domain/storefront";
import {
  GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
  GoldenStoreEvaluationError,
  goldenStoreEvaluationInputSchema,
  goldenStoreEvaluationLifecycleStates,
  goldenStoreEvaluationLocales,
  goldenStoreEvaluationSurfaces,
  goldenStoreEvaluationViewports,
  type GoldenStoreDerivedLifecycleEvidence,
  type GoldenStoreEvaluationInput,
  type GoldenStoreEvaluationRun,
  type GoldenStoreEvaluationScenario,
  type GoldenStoreLifecycleEvidence,
  type GoldenStoreResponsiveEvidence,
  type WholeStorefrontPageBlueprintMaterialization,
} from "./contract";
import { wholeStorefrontPageBlueprintMaterializationSchema } from "@/application/whole-storefront-generation-plan";

type ParsedInput = GoldenStoreEvaluationInput;

function keyOf(
  value: Pick<GoldenStoreResponsiveEvidence, "lifecycle" | "surface" | "locale" | "viewport">,
): string {
  return [value.lifecycle, value.surface, value.locale, value.viewport].join(":");
}

function parseInput(input: unknown): ParsedInput {
  try {
    return goldenStoreEvaluationInputSchema.parse(input);
  } catch (cause) {
    throw new GoldenStoreEvaluationError(
      "invalid-input",
      "Golden-store evaluation input must contain valid canonical runtime evidence.",
      cause,
    );
  }
}

function lifecycleByState(input: ParsedInput) {
  const entries = new Map(input.lifecycle.map((entry) => [entry.state, entry]));
  if (entries.size !== goldenStoreEvaluationLifecycleStates.length) {
    throw new GoldenStoreEvaluationError(
      "invalid-input",
      "Golden-store evidence must contain each lifecycle observation exactly once.",
    );
  }
  for (const state of goldenStoreEvaluationLifecycleStates) {
    if (!entries.has(state)) {
      throw new GoldenStoreEvaluationError(
        "invalid-input",
        `Golden-store evidence is missing the ${state} lifecycle observation.`,
      );
    }
  }
  return entries;
}

function assertCurrentBaseline(input: ParsedInput): void {
  const snapshot = input.canonicalBaseline.snapshot;
  const fingerprint = canonicalStorefrontContentFingerprint(snapshot);
  if (fingerprint !== input.canonicalBaseline.snapshotFingerprint) {
    throw new GoldenStoreEvaluationError(
      "stale-baseline",
      "Golden-store baseline canonical fingerprint is stale.",
    );
  }
  if (snapshot.projectId !== input.fixture.projectId) {
    throw new GoldenStoreEvaluationError(
      "project-mismatch",
      "Golden-store fixture identity does not match the canonical baseline project.",
    );
  }
}

function deriveLifecycleEvidence(
  input: ParsedInput,
  entries: Map<(typeof goldenStoreEvaluationLifecycleStates)[number], GoldenStoreLifecycleEvidence>,
): Map<(typeof goldenStoreEvaluationLifecycleStates)[number], GoldenStoreDerivedLifecycleEvidence> {
  const derived = new Map<
    (typeof goldenStoreEvaluationLifecycleStates)[number],
    GoldenStoreDerivedLifecycleEvidence
  >();
  for (const state of goldenStoreEvaluationLifecycleStates) {
    const entry = entries.get(state)!;
    const snapshotFingerprint = canonicalStorefrontContentFingerprint(entry.snapshot);
    if (entry.snapshot.revision !== entry.revision) {
      throw new GoldenStoreEvaluationError(
        "snapshot-fingerprint",
        `${state} lifecycle revision metadata does not match its canonical snapshot.`,
      );
    }
    if (snapshotFingerprint !== entry.snapshotFingerprint) {
      throw new GoldenStoreEvaluationError(
        "snapshot-fingerprint",
        `${state} lifecycle snapshot fingerprint does not match its canonical snapshot.`,
      );
    }
    if (entry.snapshot.projectId !== input.fixture.projectId) {
      throw new GoldenStoreEvaluationError(
        "project-mismatch",
        `${state} lifecycle snapshot does not belong to the declared fixture project.`,
      );
    }
    derived.set(state, {
      state,
      snapshotId: entry.snapshot.id,
      projectId: entry.snapshot.projectId,
      revision: entry.snapshot.revision,
      snapshotFingerprint,
      navigationFingerprint: canonicalValueFingerprint(entry.snapshot.navigation),
      protectedCommerceFingerprint: canonicalValueFingerprint(entry.canonicalCommerce),
      approvedAssetFingerprint: canonicalValueFingerprint(entry.approvedAssets),
    });
  }
  return derived;
}

function assertCurrentManifest(input: ParsedInput): void {
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

function expectedMaterialization(
  materialization: WholeStorefrontPageBlueprintMaterialization,
): WholeStorefrontPageBlueprintMaterialization {
  const pagePlan = getExecutablePageBlueprintProfile(materialization.profileId);
  if (
    !pagePlan ||
    !pagePlan.profile ||
    pagePlan.pageType !== materialization.pageType ||
    pagePlan.profile.version !== materialization.profileVersion
  ) {
    throw new GoldenStoreEvaluationError(
      "stale-profile",
      `Golden-store materialization references an unavailable profile ${materialization.profileId}.`,
    );
  }
  try {
    return wholeStorefrontPageBlueprintMaterializationSchema.parse(
      materializeExecutablePageBlueprint({
        pagePlan,
        componentDefinitions: veskifyComponentDefinitionsV2,
        availableBindingCategories: pagePlan.profile.requiredBindingCategories,
      }),
    );
  } catch (cause) {
    throw new GoldenStoreEvaluationError(
      "stale-profile",
      `Golden-store materialization cannot be reproduced from ${materialization.profileId}.`,
      cause,
    );
  }
}

function assertCurrentProfiles(
  input: ParsedInput,
): Map<string, WholeStorefrontPageBlueprintMaterialization> {
  const pageTypes = ["home", "collection", "product"] as const;
  const byPageType = new Map<string, WholeStorefrontPageBlueprintMaterialization>();
  for (const pageType of pageTypes) {
    const materializations = input.pageBlueprintMaterializations.filter(
      (entry) => entry.pageType === pageType,
    );
    if (materializations.length !== 1) {
      throw new GoldenStoreEvaluationError(
        "stale-profile",
        `Golden-store evidence must capture one canonical ${pageType} PageBlueprint materialization.`,
      );
    }
    const materialization = materializations[0];
    const expected = expectedMaterialization(materialization);
    if (canonicalValueString(materialization) !== canonicalValueString(expected)) {
      throw new GoldenStoreEvaluationError(
        "stale-profile",
        `Golden-store materialization for ${materialization.profileId} differs from canonical P10A-03 materialization.`,
      );
    }
    byPageType.set(pageType, expected);
  }
  return byPageType;
}

function assertSharedFrame(snapshot: GoldenStoreLifecycleEvidence["snapshot"]): void {
  for (const pageType of ["home", "collection", "product"] as const) {
    const page = snapshot.pages.find((candidate) => candidate.type === pageType);
    if (!page) {
      throw new GoldenStoreEvaluationError(
        "stale-profile",
        `Golden-store snapshot has no ${pageType} page for shared-frame validation.`,
      );
    }
    for (const selection of sharedStorefrontFrameProfile.componentSelections) {
      const matching = page.sections.filter((section) => section.component === selection.component);
      if (matching.length !== 1 || !selection.variants.includes(matching[0].variant)) {
        throw new GoldenStoreEvaluationError(
          "stale-profile",
          `Golden-store ${pageType} page does not realize the current shared-frame ${selection.slotId}.`,
        );
      }
    }
  }
}

function assertSnapshotRealization(
  entries: Map<(typeof goldenStoreEvaluationLifecycleStates)[number], GoldenStoreLifecycleEvidence>,
  materializations: Map<string, WholeStorefrontPageBlueprintMaterialization>,
): void {
  for (const state of goldenStoreEvaluationLifecycleStates) {
    const snapshot = entries.get(state)!.snapshot;
    assertSharedFrame(snapshot);
    for (const pageType of ["home", "collection", "product"] as const) {
      const page = snapshot.pages.find((candidate) => candidate.type === pageType);
      const materialization = materializations.get(pageType);
      const pagePlan =
        materialization && getExecutablePageBlueprintProfile(materialization.profileId);
      if (!page || !materialization || !pagePlan) {
        throw new GoldenStoreEvaluationError(
          "stale-profile",
          `${state} lifecycle cannot realize the canonical ${pageType} PageBlueprint.`,
        );
      }
      try {
        validateExecutablePageBlueprintRealization({
          pagePlan,
          materialization,
          componentDefinitions: veskifyComponentDefinitionsV2,
          sections: page.sections,
        });
      } catch (cause) {
        throw new GoldenStoreEvaluationError(
          "stale-profile",
          `${state} lifecycle snapshot does not realize ${materialization.profileId}.`,
          cause,
        );
      }
    }
  }
}

function assertLifecycleParity(
  entries: Map<
    (typeof goldenStoreEvaluationLifecycleStates)[number],
    GoldenStoreDerivedLifecycleEvidence
  >,
): void {
  const transitions = [
    ["proposal-preview", "accepted-editor"],
    ["accepted-editor", "preview-route"],
    ["preview-route", "saved-reloaded"],
    ["saved-reloaded", "published"],
  ] as const;
  for (const [from, to] of transitions) {
    if (entries.get(from)!.snapshotFingerprint !== entries.get(to)!.snapshotFingerprint) {
      throw new GoldenStoreEvaluationError(
        "lifecycle-parity",
        `${from} and ${to} do not preserve the same canonical storefront projection.`,
      );
    }
  }
}

function assertProtectedState(
  entries: Map<
    (typeof goldenStoreEvaluationLifecycleStates)[number],
    GoldenStoreDerivedLifecycleEvidence
  >,
): void {
  const baseline = entries.get("proposal-preview")!;
  for (const entry of entries.values()) {
    if (
      entry.navigationFingerprint !== baseline.navigationFingerprint ||
      entry.protectedCommerceFingerprint !== baseline.protectedCommerceFingerprint ||
      entry.approvedAssetFingerprint !== baseline.approvedAssetFingerprint
    ) {
      throw new GoldenStoreEvaluationError(
        "protected-state",
        "Golden-store lifecycle evidence changed canonical navigation, commerce, or approved assets.",
      );
    }
  }
}

function profileIdFor(
  surface: GoldenStoreEvaluationScenario["surface"],
  materializations: Map<string, WholeStorefrontPageBlueprintMaterialization>,
): string {
  if (surface === "shared-frame") return sharedStorefrontFrameProfile.id;
  const profile = materializations.get(surface);
  if (!profile)
    throw new GoldenStoreEvaluationError("stale-profile", `Missing ${surface} profile.`);
  return profile.profileId;
}

function assertCompleteMatrix(
  input: ParsedInput,
  materializations: Map<string, WholeStorefrontPageBlueprintMaterialization>,
): GoldenStoreEvaluationScenario[] {
  const evidence = new Map<string, GoldenStoreResponsiveEvidence>();
  for (const entry of input.responsiveEvidence) {
    const key = keyOf(entry);
    if (evidence.has(key)) {
      throw new GoldenStoreEvaluationError(
        "incomplete-matrix",
        `Golden-store evidence contains duplicate ${key}.`,
      );
    }
    evidence.set(key, entry);
  }
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
            profileId: profileIdFor(surface, materializations),
            locale,
            viewport,
            evidenceReference: key,
            rendererOutputFingerprint: canonicalValueFingerprint(entry.rendererOutput),
            screenshotReference: entry.screenshotReference,
          });
        }
      }
    }
  }
  if (input.responsiveEvidence.length !== scenarios.length || evidence.size !== scenarios.length) {
    throw new GoldenStoreEvaluationError(
      "incomplete-matrix",
      "Golden-store evidence does not have exact required matrix coverage.",
    );
  }
  return scenarios;
}

/** Captures parsed canonical evidence with no provider or browser-storage side effect. */
export function runDeterministicGoldenStoreEvaluation(
  inputValue: unknown,
): GoldenStoreEvaluationRun {
  const input = parseInput(inputValue);
  assertCurrentBaseline(input);
  assertCurrentManifest(input);
  const lifecycle = lifecycleByState(input);
  const derivedLifecycle = deriveLifecycleEvidence(input, lifecycle);
  const materializations = assertCurrentProfiles(input);
  assertSnapshotRealization(lifecycle, materializations);
  assertProtectedState(derivedLifecycle);
  assertLifecycleParity(derivedLifecycle);
  const scenarios = assertCompleteMatrix(input, materializations);
  const projectedLifecycle = goldenStoreEvaluationLifecycleStates.map((state) =>
    derivedLifecycle.get(state)!,
  );
  const canonicalMaterializations = ["home", "collection", "product"].map((pageType) =>
    structuredClone(materializations.get(pageType)!),
  );
  const fingerprint = canonicalValueFingerprint({
    evaluationId: input.evaluationId,
    contractVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
    fixture: input.fixture,
    canonicalBaseline: {
      snapshotId: input.canonicalBaseline.snapshot.id,
      projectId: input.canonicalBaseline.snapshot.projectId,
      revision: input.canonicalBaseline.snapshot.revision,
      snapshotFingerprint: canonicalStorefrontContentFingerprint(input.canonicalBaseline.snapshot),
    },
    manifest: input.manifest,
    pageBlueprintMaterializations: canonicalMaterializations,
    lifecycle: projectedLifecycle,
    scenarios,
  });
  return Object.freeze({
    evaluationId: input.evaluationId,
    contractVersion: GOLDEN_STORE_EVALUATION_CONTRACT_VERSION,
    fixture: structuredClone(input.fixture),
    canonicalBaseline: {
      snapshotId: input.canonicalBaseline.snapshot.id,
      projectId: input.canonicalBaseline.snapshot.projectId,
      revision: input.canonicalBaseline.snapshot.revision,
      snapshotFingerprint: canonicalStorefrontContentFingerprint(input.canonicalBaseline.snapshot),
    },
    manifest: structuredClone(input.manifest),
    pageBlueprintMaterializations: canonicalMaterializations,
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
      brandSystemFingerprint: canonicalValueFingerprint(
        input.canonicalBaseline.snapshot.brandSystem,
      ),
    },
    humanVisualReview: { status: "not-reviewed" as const, reviewer: null, notes: null },
    futureProviderEvidence: { status: "not-run" as const, references: [] },
    outcome: "passed" as const,
    fingerprint,
  });
}
