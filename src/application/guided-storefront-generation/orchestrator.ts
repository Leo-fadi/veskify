import { planBrandFoundation } from "@/application/brand-foundation";
import {
  InitialStorefrontMaterializationError,
  materializeInitialStorefront,
  planStorefrontTemplateSelection,
  type InitialStorefrontGenerationPlan,
  type StorefrontTemplateSelectionPlan,
} from "@/application/storefront-templates";
import {
  createStorefrontDesignBriefFingerprint,
  storefrontDesignBriefSchema,
} from "@/domain/design-brief";
import {
  canonicalValueString,
  storefrontSnapshotSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  cloneGuidedStorefrontGenerationPlan,
  GUIDED_STOREFRONT_GENERATION_SCHEMA_VERSION,
  guidedStorefrontGenerationInputSchema,
  guidedStorefrontGenerationPlanSchema,
  type GuidedStorefrontGenerationDiagnostic,
  type GuidedStorefrontGenerationInput,
  type GuidedStorefrontGenerationPlan,
  type GuidedStorefrontGenerationStage,
  GuidedStorefrontGenerationError,
} from "./contract";

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createGuidedStorefrontGenerationPlanId(
  input: GuidedStorefrontGenerationInput,
  stagePlanIds: Readonly<{
    brandFoundation: string;
    templateSelection: string | null;
    materialization: string | null;
  }>,
): string {
  return `guided-generation-${stableHash(
    canonicalValueString({
      schemaVersion: GUIDED_STOREFRONT_GENERATION_SCHEMA_VERSION,
      brief: input.brief,
      projectId: input.projectId,
      snapshotId: input.snapshotId,
      catalogueRef: input.catalogueRef,
      createdAt: input.createdAt,
      preferredTemplateId: input.preferredTemplateId ?? null,
      stagePlanIds,
    }),
  )}`;
}

type StageMessage = { code: string; message: string };

function diagnostic(
  stage: GuidedStorefrontGenerationStage,
  item: StageMessage,
  severity: GuidedStorefrontGenerationDiagnostic["severity"],
  planId: string | null,
): GuidedStorefrontGenerationDiagnostic {
  return { stage, code: item.code, message: item.message, severity, planId };
}

function uniqueDiagnostics(
  diagnostics: readonly GuidedStorefrontGenerationDiagnostic[],
): GuidedStorefrontGenerationDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((item) => {
    const key = `${item.stage}:${item.code}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stageDiagnostics(
  stage: GuidedStorefrontGenerationStage,
  status: "executed" | "not-run",
  diagnostics: readonly GuidedStorefrontGenerationDiagnostic[],
) {
  return { stage, status, diagnostics: [...diagnostics] };
}

function planFromStageMessages(
  stage: GuidedStorefrontGenerationStage,
  planId: string | null,
  warnings: readonly StageMessage[],
  blockers: readonly StageMessage[],
) {
  return [
    ...warnings.map((item) => diagnostic(stage, item, "warning", planId)),
    ...blockers.map((item) => diagnostic(stage, item, "blocker", planId)),
  ];
}

function consistencyError(message: string, cause?: unknown): never {
  throw new GuidedStorefrontGenerationError("inconsistent-stage", message, cause);
}

function assertPlanRelationships(
  input: GuidedStorefrontGenerationInput,
  brandPlan: ReturnType<typeof planBrandFoundation>,
  selection: StorefrontTemplateSelectionPlan,
  materialization: InitialStorefrontGenerationPlan,
  snapshot: StorefrontSnapshot,
) {
  if (brandPlan.briefId !== input.brief.id || selection.briefId !== input.brief.id)
    consistencyError("Guided generation stage brief IDs do not match the input brief.");
  if (materialization.templateSelectionPlanId !== selection.id)
    consistencyError(
      "Materialization does not reference the template selection produced by this run.",
    );
  if (materialization.selectedTemplateId !== selection.selectedTemplateId)
    consistencyError("Materialization selected template does not match template selection.");
  if (snapshot.id !== input.snapshotId || snapshot.projectId !== input.projectId)
    consistencyError("Generated snapshot identifiers do not match the explicit input identifiers.");
  if (snapshot.catalogueRef !== input.catalogueRef || snapshot.createdAt !== input.createdAt)
    consistencyError("Generated snapshot metadata does not match the explicit input values.");
  if (canonicalValueString(snapshot.brandSystem) !== canonicalValueString(brandPlan.brandSystem))
    consistencyError("Materialization did not use the BrandSystem produced by brand foundation.");
}

function finalize(
  input: GuidedStorefrontGenerationInput,
  brandPlan: ReturnType<typeof planBrandFoundation>,
  selection: StorefrontTemplateSelectionPlan | null,
  materialization: InitialStorefrontGenerationPlan | null,
  snapshot: StorefrontSnapshot | null,
  stageDiagnosticsList: ReturnType<typeof stageDiagnostics>[],
  diagnostics: GuidedStorefrontGenerationDiagnostic[],
  assumptions: string[],
  briefFingerprint: string,
): GuidedStorefrontGenerationPlan {
  const orderedDiagnostics = uniqueDiagnostics(diagnostics);
  const warnings = orderedDiagnostics.filter((item) => item.severity === "warning");
  const blockers = orderedDiagnostics.filter((item) => item.severity === "blocker");
  const status =
    blockers.length > 0
      ? "blocked"
      : snapshot === null
        ? "blocked"
        : warnings.length > 0
          ? "ready-with-warnings"
          : "ready";
  const plan = {
    schemaVersion: GUIDED_STOREFRONT_GENERATION_SCHEMA_VERSION,
    id: createGuidedStorefrontGenerationPlanId(input, {
      brandFoundation: brandPlan.id,
      templateSelection: selection?.id ?? null,
      materialization: materialization?.id ?? null,
    }),
    briefId: input.brief.id,
    briefFingerprint,
    status,
    projectId: input.projectId,
    snapshotId: input.snapshotId,
    catalogueRef: input.catalogueRef,
    createdAt: input.createdAt,
    brandFoundationPlan: brandPlan,
    templateSelectionPlan: selection,
    initialStorefrontGenerationPlan: materialization,
    generatedSnapshot: snapshot,
    stageDiagnostics: stageDiagnosticsList,
    diagnostics: orderedDiagnostics,
    assumptions,
    warnings,
    blockers,
    provenance: {
      brandFoundation: "P3-05 planBrandFoundation produced the canonical BrandSystem.",
      templateSelection: selection
        ? "P3-06 planStorefrontTemplateSelection produced the fresh controlled template selection."
        : "P3-06 was not run because the brand stage was blocked.",
      storefrontMaterialization: materialization
        ? "P3-08 materializeInitialStorefront produced the validated in-memory snapshot."
        : "P3-08 was not run because an earlier stage was blocked.",
    },
  };
  try {
    return cloneGuidedStorefrontGenerationPlan(guidedStorefrontGenerationPlanSchema.parse(plan));
  } catch (cause) {
    return consistencyError("Guided generation produced an invalid orchestration plan.", cause);
  }
}

export function generateGuidedStorefront(
  input: GuidedStorefrontGenerationInput,
): GuidedStorefrontGenerationPlan {
  let parsed: GuidedStorefrontGenerationInput;
  try {
    parsed = guidedStorefrontGenerationInputSchema.parse(input);
  } catch (cause) {
    throw new GuidedStorefrontGenerationError(
      "invalid-input",
      "Guided generation input is invalid.",
      cause,
    );
  }
  const brief = storefrontDesignBriefSchema.parse(parsed.brief);
  const briefFingerprint = createStorefrontDesignBriefFingerprint(brief);
  const brandPlan = planBrandFoundation(brief);
  const brandDiagnostics = planFromStageMessages(
    "brand-foundation",
    brandPlan.id,
    brandPlan.warnings.map((warning) => ({ code: warning.code, message: warning.message.en })),
    [],
  );
  const brandStage = stageDiagnostics("brand-foundation", "executed", brandDiagnostics);

  if (brandPlan.status === "blocked") {
    return finalize(
      parsed,
      brandPlan,
      null,
      null,
      null,
      [
        brandStage,
        stageDiagnostics("template-selection", "not-run", []),
        stageDiagnostics("storefront-materialization", "not-run", []),
      ],
      brandDiagnostics,
      [...brandPlan.assumptions.en],
      briefFingerprint,
    );
  }

  const selection = planStorefrontTemplateSelection({
    brief,
    preferredTemplateId: parsed.preferredTemplateId,
  });
  const selectionDiagnostics = planFromStageMessages(
    "template-selection",
    selection.id,
    selection.warnings,
    selection.blockers,
  );
  const selectionStage = stageDiagnostics("template-selection", "executed", selectionDiagnostics);
  const assumptions = [...brandPlan.assumptions.en, ...selection.assumptions];
  if (selection.status === "blocked") {
    return finalize(
      parsed,
      brandPlan,
      selection,
      null,
      null,
      [brandStage, selectionStage, stageDiagnostics("storefront-materialization", "not-run", [])],
      [...brandDiagnostics, ...selectionDiagnostics],
      assumptions,
      briefFingerprint,
    );
  }

  let materialization: InitialStorefrontGenerationPlan;
  try {
    materialization = materializeInitialStorefront({
      brief,
      templateSelectionPlan: selection,
      brandSystem: brandPlan.brandSystem,
      projectId: parsed.projectId,
      snapshotId: parsed.snapshotId,
      catalogueRef: parsed.catalogueRef,
      createdAt: parsed.createdAt,
    });
  } catch (cause) {
    if (!(cause instanceof InitialStorefrontMaterializationError)) throw cause;
    const item = diagnostic(
      "storefront-materialization",
      { code: cause.code, message: cause.message },
      "blocker",
      null,
    );
    return finalize(
      parsed,
      brandPlan,
      selection,
      null,
      null,
      [
        brandStage,
        selectionStage,
        stageDiagnostics("storefront-materialization", "executed", [item]),
      ],
      [...brandDiagnostics, ...selectionDiagnostics, item],
      assumptions,
      briefFingerprint,
    );
  }
  const materializationDiagnostics = planFromStageMessages(
    "storefront-materialization",
    materialization.id,
    materialization.warnings,
    materialization.blockers,
  );
  const materializationStage = stageDiagnostics(
    "storefront-materialization",
    "executed",
    materializationDiagnostics,
  );
  if (materialization.status === "blocked" || materialization.generatedSnapshot === null) {
    return finalize(
      parsed,
      brandPlan,
      selection,
      materialization,
      null,
      [brandStage, selectionStage, materializationStage],
      [...brandDiagnostics, ...selectionDiagnostics, ...materializationDiagnostics],
      assumptions,
      briefFingerprint,
    );
  }
  const snapshot = storefrontSnapshotSchema.parse(materialization.generatedSnapshot);
  assertPlanRelationships(parsed, brandPlan, selection, materialization, snapshot);
  return finalize(
    parsed,
    brandPlan,
    selection,
    materialization,
    snapshot,
    [brandStage, selectionStage, materializationStage],
    [...brandDiagnostics, ...selectionDiagnostics, ...materializationDiagnostics],
    assumptions,
    briefFingerprint,
  );
}
