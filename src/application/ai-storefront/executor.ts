import { validateDesignOperationAgainstPage } from "@/application/design-operations";
import { validateRegisteredSnapshot } from "@/components/registry";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { brandSystemSchema } from "@/domain/design-system";
import { canonicalLocaleOrder, localeSchema, type Locale } from "@/domain/shared";
import {
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  aiStorefrontContextSchema,
  aiStorefrontProposalSchema,
  type AiStorefrontContext,
  type AiStorefrontProjection,
  type AiStorefrontProposal,
  type AiStorefrontReadyProposal,
} from "./contract";
import { validateAiStorefrontProposal } from "./proposal-validator";

export type AiStorefrontApplicationErrorCode =
  | "invalid-application-context"
  | "invalid-proposal"
  | "terminal-proposal"
  | "active-storefront-fingerprint-mismatch"
  | "unsupported-design-state"
  | "design-state-permission-mismatch"
  | "operation-application-failed"
  | "final-storefront-validation-failed"
  | "final-projection-mismatch"
  | "storefront-preservation-failed";

export class AiStorefrontApplicationError extends Error {
  constructor(
    readonly code: AiStorefrontApplicationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AiStorefrontApplicationError";
  }
}

export type AiStorefrontApplicationContext = {
  activeDraft: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  enabledLocales: readonly Locale[];
  activeLocale: Locale;
  primaryLocale: Locale;
};

function invalid(code: AiStorefrontApplicationErrorCode, message: string, cause?: unknown): never {
  throw new AiStorefrontApplicationError(code, message, cause ? { cause } : undefined);
}

export function projectAiStorefrontSnapshot(snapshotInput: unknown): AiStorefrontProjection {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  return {
    pageOrder: snapshot.pages.map((page) => page.id),
    pages: structuredClone(snapshot.pages),
    navigation: structuredClone(snapshot.navigation),
    brandSystem: structuredClone(snapshot.brandSystem),
  };
}

export function createAiStorefrontApplicationContext({
  activeDraft: activeDraftInput,
  catalogue: catalogueInput,
  enabledLocales: enabledLocalesInput,
  activeLocale: activeLocaleInput,
  primaryLocale: primaryLocaleInput,
}: AiStorefrontApplicationContext): {
  activeDraft: StorefrontSnapshot;
  catalogue: CatalogueDisplayModel;
  enabledLocales: Locale[];
  activeLocale: Locale;
  primaryLocale: Locale;
  proposalContext: AiStorefrontContext;
} {
  try {
    const catalogue = catalogueDisplayModelSchema.parse(structuredClone(catalogueInput));
    const activeLocale = localeSchema.parse(activeLocaleInput);
    const primaryLocale = localeSchema.parse(primaryLocaleInput);
    const enabledLocales = canonicalLocaleOrder(
      enabledLocalesInput.map((locale) => localeSchema.parse(locale)),
    );
    if (
      enabledLocales.length !== enabledLocalesInput.length ||
      !enabledLocales.includes(activeLocale) ||
      !enabledLocales.includes(primaryLocale)
    ) {
      invalid(
        "invalid-application-context",
        "The active and primary storefront locales must be unique enabled locales.",
      );
    }
    const activeDraft = validateRegisteredSnapshot(
      structuredClone(activeDraftInput),
      catalogue,
      activeLocale,
      primaryLocale,
    );
    if (activeDraft.catalogueRef !== catalogue.id) {
      invalid(
        "invalid-application-context",
        "The active storefront and catalogue identities do not match.",
      );
    }
    const proposalContext = aiStorefrontContextSchema.parse({
      projectId: activeDraft.projectId,
      draftSnapshotId: activeDraft.id,
      draftRevision: activeDraft.revision,
      enabledLocales,
      activeLocale,
      storefront: projectAiStorefrontSnapshot(activeDraft),
    });
    return {
      activeDraft: structuredClone(activeDraft),
      catalogue: structuredClone(catalogue),
      enabledLocales,
      activeLocale,
      primaryLocale,
      proposalContext,
    };
  } catch (cause) {
    if (cause instanceof AiStorefrontApplicationError) throw cause;
    return invalid(
      "invalid-application-context",
      "The complete active storefront application context is invalid.",
      cause,
    );
  }
}

export function createAiStorefrontActiveFingerprint(snapshotInput: unknown): string {
  return `storefront-active-${canonicalValueFingerprint(
    projectAiStorefrontSnapshot(snapshotInput),
  )}`;
}

function assertPendingProposal(input: unknown): AiStorefrontProposal {
  let proposal: AiStorefrontProposal;
  try {
    proposal = aiStorefrontProposalSchema.parse(structuredClone(input));
  } catch (cause) {
    return invalid("invalid-proposal", "The storefront proposal is incomplete or invalid.", cause);
  }
  if (proposal.status !== "pending") {
    invalid(
      "terminal-proposal",
      "Only a pending storefront proposal can be applied to the active draft.",
    );
  }
  return proposal;
}

function assertActiveFingerprint(
  proposal: AiStorefrontReadyProposal,
  activeDraft: StorefrontSnapshot,
) {
  const active = createAiStorefrontActiveFingerprint(activeDraft);
  const original = `storefront-active-${canonicalValueFingerprint(proposal.originalStorefront)}`;
  if (active !== original) {
    invalid(
      "active-storefront-fingerprint-mismatch",
      "The active storefront changed after this proposal was prepared.",
    );
  }
}

function hasGlobalGrant(
  proposal: AiStorefrontReadyProposal,
  operationType: "APPLY_APPROVED_BRAND_COLOURS" | "CHANGE_TYPOGRAPHY",
) {
  return proposal.permissionGrants.some(
    (grant) =>
      grant.target.kind === "storefrontDesignSystem" &&
      grant.target.projectId === proposal.projectId &&
      grant.operationTypes.includes(operationType),
  );
}

function assertAffectedDesignState(proposal: AiStorefrontReadyProposal) {
  const original = proposal.originalStorefront.brandSystem;
  const proposed = proposal.proposedStorefront.brandSystem;
  for (const key of ["shape", "spacing", "imagery", "voice"] as const) {
    if (canonicalValueString(original[key]) !== canonicalValueString(proposed[key])) {
      invalid(
        "unsupported-design-state",
        "Whole-storefront application cannot change shape, spacing, imagery, or voice state.",
      );
    }
  }
  const affected = proposal.affectedDesignState;
  for (const key of ["colors", "typography"] as const) {
    const changed = canonicalValueString(original[key]) !== canonicalValueString(proposed[key]);
    if (
      changed !== (affected?.[key] !== undefined) ||
      (changed && canonicalValueString(affected?.[key]) !== canonicalValueString(proposed[key]))
    ) {
      invalid(
        "unsupported-design-state",
        "Affected design state must exactly describe every proposed colour and typography change.",
      );
    }
  }
}

function assertGlobalColourPayloads(proposal: AiStorefrontReadyProposal) {
  const affectedColors = proposal.affectedDesignState?.colors;
  const proposedColors = proposal.proposedStorefront.brandSystem.colors;
  const operationColourPayloads = proposal.operations.flatMap((operation) =>
    operation.operation.type === "APPLY_APPROVED_BRAND_COLOURS" ? [operation.operation.colors] : [],
  );
  if (operationColourPayloads.length === 0 && affectedColors === undefined) return;
  const affectedFingerprint =
    affectedColors === undefined ? null : canonicalValueFingerprint(affectedColors);
  const proposedFingerprint = canonicalValueFingerprint(proposedColors);
  if (
    affectedFingerprint === null ||
    operationColourPayloads.length === 0 ||
    affectedFingerprint !== proposedFingerprint ||
    operationColourPayloads.some(
      (colors) => canonicalValueFingerprint(colors) !== affectedFingerprint,
    )
  ) {
    invalid(
      "unsupported-design-state",
      "The global colour operation, affected design state, and proposed storefront colours must match exactly.",
    );
  }
}

function applyAffectedDesignState(
  candidate: StorefrontSnapshot,
  proposal: AiStorefrontReadyProposal,
) {
  const affected = proposal.affectedDesignState;
  if (affected === null) return;
  if (proposal.target.designSystemTarget === null) {
    invalid(
      "design-state-permission-mismatch",
      "Global design state requires an explicit storefront design-system target.",
    );
  }
  const keys = Object.keys(affected);
  if (keys.some((key) => key !== "colors" && key !== "typography")) {
    invalid(
      "unsupported-design-state",
      "Whole-storefront application supports only approved colour and typography state.",
    );
  }
  if (affected.colors) {
    if (!hasGlobalGrant(proposal, "APPLY_APPROVED_BRAND_COLOURS")) {
      invalid(
        "design-state-permission-mismatch",
        "Storefront colour changes require an explicit global colour grant.",
      );
    }
    candidate.brandSystem.colors = structuredClone(affected.colors);
  }
  if (affected.typography) {
    if (!hasGlobalGrant(proposal, "CHANGE_TYPOGRAPHY")) {
      invalid(
        "design-state-permission-mismatch",
        "Storefront typography changes require an explicit global typography grant.",
      );
    }
    candidate.brandSystem.typography = structuredClone(affected.typography);
  }
  try {
    candidate.brandSystem = brandSystemSchema.parse(candidate.brandSystem);
  } catch (cause) {
    invalid("unsupported-design-state", "The proposed storefront design state is invalid.", cause);
  }
}

function assertPreservedSnapshot(original: StorefrontSnapshot, candidate: StorefrontSnapshot) {
  if (
    original.id !== candidate.id ||
    original.projectId !== candidate.projectId ||
    original.revision !== candidate.revision ||
    original.catalogueRef !== candidate.catalogueRef ||
    original.createdAt !== candidate.createdAt ||
    original.createdBy !== candidate.createdBy ||
    canonicalValueString(original.navigation) !== canonicalValueString(candidate.navigation) ||
    canonicalValueString(original.pages.map((page) => page.id)) !==
      canonicalValueString(candidate.pages.map((page) => page.id))
  ) {
    invalid(
      "storefront-preservation-failed",
      "Storefront proposal application cannot change snapshot identity, pages, navigation, or catalogue identity.",
    );
  }
}

export function executeAiStorefrontProposal({
  proposal: proposalInput,
  ...applicationContext
}: AiStorefrontApplicationContext & { proposal: unknown }): StorefrontSnapshot {
  const context = createAiStorefrontApplicationContext(applicationContext);
  const pending = assertPendingProposal(proposalInput);
  let proposal: AiStorefrontReadyProposal;
  try {
    proposal = validateAiStorefrontProposal(pending, context.proposalContext);
  } catch (cause) {
    return invalid(
      "invalid-proposal",
      "The storefront proposal did not pass final acceptance validation.",
      cause,
    );
  }
  assertActiveFingerprint(proposal, context.activeDraft);
  assertGlobalColourPayloads(proposal);
  assertAffectedDesignState(proposal);

  let candidate = structuredClone(context.activeDraft);
  for (const operation of proposal.operations) {
    try {
      if (operation.target.kind === "storefrontDesignSystem") {
        if (operation.operation.type !== "APPLY_APPROVED_BRAND_COLOURS") {
          invalid(
            "operation-application-failed",
            "Only approved global colour operations can use the design-system operation target.",
          );
        }
        candidate.brandSystem.colors = structuredClone(operation.operation.colors);
        candidate.brandSystem = brandSystemSchema.parse(candidate.brandSystem);
      } else {
        const pageId = operation.target.pageId;
        const pageIndex = candidate.pages.findIndex((page) => page.id === pageId);
        if (pageIndex < 0) {
          invalid(
            "operation-application-failed",
            "A storefront operation targets a page outside the active draft.",
          );
        }
        candidate.pages[pageIndex] = validateDesignOperationAgainstPage(
          candidate.pages[pageIndex],
          operation.operation,
        );
      }
      candidate = storefrontSnapshotSchema.parse(candidate);
    } catch (cause) {
      if (cause instanceof AiStorefrontApplicationError) throw cause;
      return invalid(
        "operation-application-failed",
        `Storefront operation ${operation.order + 1} could not be applied safely.`,
        cause,
      );
    }
  }

  applyAffectedDesignState(candidate, proposal);
  assertPreservedSnapshot(context.activeDraft, candidate);

  let validated: StorefrontSnapshot;
  try {
    validated = validateRegisteredSnapshot(
      candidate,
      context.catalogue,
      context.activeLocale,
      context.primaryLocale,
    );
  } catch (cause) {
    return invalid(
      "final-storefront-validation-failed",
      "The complete proposed storefront failed final validation.",
      cause,
    );
  }
  if (
    canonicalValueString(projectAiStorefrontSnapshot(validated)) !==
    canonicalValueString(proposal.proposedStorefront)
  ) {
    invalid(
      "final-projection-mismatch",
      "Applied storefront operations do not reproduce the validated proposal projection.",
    );
  }
  return structuredClone(validated);
}
