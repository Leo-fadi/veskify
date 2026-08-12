import { canonicalLocaleOrder } from "@/domain/shared";
import {
  applyBrandSystemFoundationPatch,
  migrateBrandSystemDesignDna,
} from "@/domain/design-system";
import { validateDesignOperationAgainstPage } from "@/application/design-operations";
import {
  applyRegisteredTokenRefinement,
  registeredBrandSystemForDirection,
  storefrontDesignSystemV1,
} from "@/application/storefront-design-system";
import { canonicalValueFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  aiStorefrontContextSchema,
  aiStorefrontReadyProposalSchema,
  type AiStorefrontContext,
  type AiStorefrontReadyProposal,
  type AiStorefrontTarget,
} from "./contract";
import {
  createAiStorefrontGenerationPermissionFingerprint,
  createAiStorefrontPermissionFingerprint,
  createAiStorefrontProposalId,
  createAiStorefrontTargetFingerprint,
} from "./fingerprint";
import {
  AiStorefrontValidationError,
  canonicalizeAiStorefrontTarget,
  validateAiStorefrontOperations,
} from "./validation";

function invalid(code: string, message: string): never {
  throw new AiStorefrontValidationError(code, message);
}

function parseContext(input: unknown): AiStorefrontContext {
  try {
    const context = aiStorefrontContextSchema.parse(input);
    return { ...context, enabledLocales: canonicalLocaleOrder(context.enabledLocales) };
  } catch {
    return invalid(
      "invalid-context",
      "The active storefront context is incomplete or inconsistent.",
    );
  }
}

function parseReadyProposal(input: unknown): AiStorefrontReadyProposal {
  try {
    return aiStorefrontReadyProposalSchema.parse(input);
  } catch {
    return invalid(
      "invalid-ready-proposal",
      "Only a successfully validated storefront proposal can advance to review.",
    );
  }
}

function assertProposalIdentity(
  proposal: AiStorefrontReadyProposal,
  target: AiStorefrontTarget,
  context: AiStorefrontContext,
) {
  if (
    proposal.projectId !== target.projectId ||
    proposal.draftSnapshotId !== target.draftSnapshotId ||
    proposal.draftRevision !== target.draftRevision
  ) {
    invalid(
      "proposal-identity-mismatch",
      "The proposal identity must match its storefront target.",
    );
  }
  if (canonicalValueString(proposal.target) !== canonicalValueString(target)) {
    invalid("non-canonical-target", "Storefront proposal targets must use canonical ordering.");
  }
  if (
    context.projectId !== target.projectId ||
    context.draftSnapshotId !== target.draftSnapshotId ||
    context.draftRevision !== target.draftRevision ||
    context.activeLocale !== target.activeLocale ||
    canonicalValueString(context.enabledLocales) !== canonicalValueString(target.enabledLocales)
  ) {
    invalid("stale-context", "The storefront proposal target no longer matches the active draft.");
  }
  if (
    canonicalValueString(proposal.originalStorefront) !== canonicalValueString(context.storefront)
  ) {
    invalid(
      "stale-storefront",
      "The proposal original storefront no longer matches the active storefront projection.",
    );
  }
}

function assertProposalFingerprints(
  proposal: AiStorefrontReadyProposal,
  target: AiStorefrontTarget,
  context: AiStorefrontContext,
) {
  const targetFingerprint = createAiStorefrontTargetFingerprint(context, target);
  if (proposal.targetFingerprint !== targetFingerprint) {
    invalid(
      "target-fingerprint-mismatch",
      "The storefront proposal target fingerprint is stale or invalid.",
    );
  }
  const permissionFingerprint = proposal.wholeStorefrontGeneration
    ? createAiStorefrontGenerationPermissionFingerprint(proposal.wholeStorefrontGeneration)
    : createAiStorefrontPermissionFingerprint(proposal.permissionGrants, target, context);
  if (proposal.permissionFingerprint !== permissionFingerprint) {
    invalid(
      "permission-fingerprint-mismatch",
      "The storefront proposal permission fingerprint is stale or invalid.",
    );
  }
  if (proposal.wholeStorefrontGeneration) {
    const expectedProposalId = createAiStorefrontProposalId(
      proposal.requestId,
      targetFingerprint,
      permissionFingerprint,
      proposal.operations,
      proposal.assetPlacementOperations,
      proposal.dynamicCommerceMigration,
      proposal.wholeStorefrontGeneration,
    );
    if (proposal.id !== expectedProposalId) {
      invalid(
        "proposal-fingerprint-mismatch",
        "The whole-storefront generation proposal does not bind its exact structural operation.",
      );
    }
  }
}

function assertProjectionPreservation(
  proposal: AiStorefrontReadyProposal,
  target: AiStorefrontTarget,
) {
  const original = proposal.originalStorefront;
  const proposed = proposal.proposedStorefront;
  const migration = proposal.dynamicCommerceMigration;
  const generation = proposal.wholeStorefrontGeneration;
  if (generation) {
    const allOriginalPageIds = [...original.pageOrder].sort((left, right) =>
      left.localeCompare(right),
    );
    if (
      target.scope !== "storefront" ||
      target.designSystemTarget === null ||
      canonicalValueString(target.affectedPageIds) !== canonicalValueString(allOriginalPageIds) ||
      generation.target.projectId !== target.projectId ||
      generation.target.draftSnapshotId !== target.draftSnapshotId ||
      generation.target.draftRevision !== target.draftRevision ||
      generation.sourceProjectionFingerprint !== canonicalValueFingerprint(original) ||
      generation.resultingProjectionFingerprint !== canonicalValueFingerprint(proposed) ||
      proposed.dynamicCommercePresentation === undefined
    ) {
      invalid(
        "invalid-whole-storefront-generation",
        "Canonical whole-storefront generation requires one exact reviewed storefront transition.",
      );
    }
  }
  if (migration) {
    const allOriginalPageIds = [...original.pageOrder].sort((left, right) =>
      left.localeCompare(right),
    );
    if (
      target.scope !== "storefront" ||
      target.designSystemTarget === null ||
      original.dynamicCommercePresentation !== undefined ||
      proposed.dynamicCommercePresentation === undefined ||
      canonicalValueString(target.affectedPageIds) !== canonicalValueString(allOriginalPageIds) ||
      migration.resultingProjectionFingerprint !== canonicalValueFingerprint(proposed) ||
      migration.resultingAuthorityFingerprint !==
        proposed.dynamicCommercePresentation.authorityFingerprint
    ) {
      invalid(
        "invalid-dynamic-commerce-migration",
        "Canonical dynamic-commerce migration requires an exact whole-storefront reviewed transition.",
      );
    }
  } else if (
    !generation &&
    canonicalValueString(original.dynamicCommercePresentation) !==
      canonicalValueString(proposed.dynamicCommercePresentation)
  ) {
    invalid(
      "unsupported-dynamic-commerce-transition",
      "Dynamic-commerce authority cannot change without an explicit canonical migration transition.",
    );
  }
  if (
    !migration &&
    !generation &&
    canonicalValueString(original.pageOrder) !== canonicalValueString(proposed.pageOrder)
  ) {
    invalid(
      "page-order-mismatch",
      "Storefront proposals cannot add, remove, or reorder pages without a supported operation.",
    );
  }
  const originalPageIds = original.pages.map((page) => page.id);
  const proposedPageIds = proposed.pages.map((page) => page.id);
  if (
    !migration &&
    !generation &&
    canonicalValueString(originalPageIds) !== canonicalValueString(proposedPageIds)
  ) {
    invalid(
      "page-set-mismatch",
      "Storefront proposals must preserve the complete canonical page set.",
    );
  }
  if (
    !migration &&
    !generation &&
    canonicalValueString(original.navigation) !== canonicalValueString(proposed.navigation)
  ) {
    invalid(
      "navigation-mismatch",
      "Navigation cannot change without an explicitly supported operation and grant.",
    );
  }
  if (
    target.designSystemTarget === null &&
    canonicalValueString(original.brandSystem) !== canonicalValueString(proposed.brandSystem)
  ) {
    invalid(
      "global-design-target-required",
      "Global design state cannot change without a storefront design-system target.",
    );
  }
  if (target.designSystemTarget === null && proposal.affectedDesignState !== null) {
    invalid(
      "global-design-target-required",
      "Affected global design state requires a storefront design-system target.",
    );
  }

  const affectedIds = new Set(target.affectedPageIds);
  const originalById = new Map(original.pages.map((page) => [page.id, page]));
  const affectedPageIds = proposal.affectedPages
    .map((page) => page.id)
    .sort((left, right) => left.localeCompare(right));
  if (canonicalValueString(affectedPageIds) !== canonicalValueString(target.affectedPageIds)) {
    invalid(
      "affected-pages-mismatch",
      "The proposal affected pages must match its declared storefront target.",
    );
  }
  for (const page of proposal.affectedPages) {
    const originalPage = originalById.get(page.id);
    if (!originalPage || canonicalValueString(originalPage) !== canonicalValueString(page)) {
      invalid(
        "original-page-mismatch",
        "Affected pages must match the proposal original storefront projection.",
      );
    }
  }
  if (generation) return;
  proposed.pages.forEach((page) => {
    if (affectedIds.has(page.id)) return;
    const originalPage = originalById.get(page.id);
    if (!originalPage || canonicalValueString(originalPage) !== canonicalValueString(page)) {
      invalid(
        "untargeted-page-mutation",
        "Pages outside the declared storefront target must remain unchanged.",
      );
    }
  });
}

function assertSupportedDesignStateProjection(proposal: AiStorefrontReadyProposal) {
  if (
    proposal.operations.some(
      (envelope) => envelope.operation.type === "APPLY_REGISTERED_BRAND_SYSTEM",
    )
  ) {
    return;
  }
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
}

function assertProjectionMatchesOperations(
  proposal: AiStorefrontReadyProposal,
  context: AiStorefrontContext,
) {
  const projected = structuredClone(context.storefront);
  let affectedDesignState: AiStorefrontReadyProposal["affectedDesignState"] = null;
  for (const envelope of proposal.operations) {
    if (envelope.operation.type === "APPLY_APPROVED_BRAND_COLOURS") {
      projected.brandSystem = applyBrandSystemFoundationPatch(projected.brandSystem, {
        colors: envelope.operation.colors,
      });
      affectedDesignState = {
        ...(affectedDesignState ?? {}),
        colors: structuredClone(envelope.operation.colors),
      };
      continue;
    }
    if (envelope.operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY") {
      projected.brandSystem = applyBrandSystemFoundationPatch(projected.brandSystem, {
        typography: envelope.operation.typography,
      });
      affectedDesignState = {
        ...(affectedDesignState ?? {}),
        typography: structuredClone(envelope.operation.typography),
      };
      continue;
    }
    if (envelope.operation.type === "APPLY_REGISTERED_BRAND_SYSTEM") {
      const registeredBrandSystem =
        envelope.operation.refinementId === "validatedTokenRefinement"
          ? applyRegisteredTokenRefinement(
              proposal.originalStorefront.brandSystem,
              envelope.operation.tokenRefinementPlan!,
            )
          : registeredBrandSystemForDirection(
              proposal.originalStorefront.brandSystem,
              storefrontDesignSystemV1,
              envelope.operation.directionId!,
              envelope.operation.designSystemNarrowing,
            );
      if (
        canonicalValueString(registeredBrandSystem) !==
        canonicalValueString(envelope.operation.brandSystem)
      ) {
        invalid(
          "invalid-global-operation",
          "The complete BrandSystem must be derived from the selected server-registered direction.",
        );
      }
      projected.brandSystem = structuredClone(envelope.operation.brandSystem);
      affectedDesignState = structuredClone(envelope.operation.brandSystem);
      continue;
    }
    if (envelope.target.kind === "storefrontDesignSystem") {
      invalid(
        "invalid-global-operation",
        "Only approved design-system operations may use the global target.",
      );
    }
    const pageId = envelope.target.pageId;
    const pageIndex = projected.pages.findIndex((page) => page.id === pageId);
    if (pageIndex < 0) {
      invalid("unknown-page", "The operation targets an unknown storefront page.");
    }
    try {
      projected.pages[pageIndex] = validateDesignOperationAgainstPage(
        projected.pages[pageIndex],
        envelope.operation,
      );
    } catch {
      invalid(
        "invalid-operation-projection",
        "The proposal operations cannot produce the declared storefront projection.",
      );
    }
  }
  if (
    canonicalValueString(affectedDesignState) !== canonicalValueString(proposal.affectedDesignState)
  ) {
    invalid(
      "proposal-projection-mismatch",
      "Affected design state must match exactly the global design changes derived from validated operations.",
    );
  }
  const migration = proposal.dynamicCommerceMigration;
  if (migration) {
    if (migration.legacyProjectionFingerprint !== canonicalValueFingerprint(projected)) {
      invalid(
        "dynamic-commerce-migration-projection-mismatch",
        "Canonical dynamic-commerce migration must bind the exact operation-produced legacy storefront.",
      );
    }
    return;
  }
  const generation = proposal.wholeStorefrontGeneration;
  if (generation) {
    if (
      generation.operationProjectionFingerprint !== canonicalValueFingerprint(projected) ||
      generation.resultingProjectionFingerprint !==
        canonicalValueFingerprint(proposal.proposedStorefront)
    ) {
      invalid(
        "whole-storefront-generation-projection-mismatch",
        "Canonical whole-storefront generation must bind its exact operation and result projections.",
      );
    }
    return;
  }
  if (canonicalValueString(projected) !== canonicalValueString(proposal.proposedStorefront)) {
    invalid(
      "proposal-projection-mismatch",
      "The proposed storefront must match exactly the storefront reproducible from its validated operations.",
    );
  }
}

export function validateAiStorefrontProposal(
  input: unknown,
  contextInput: unknown,
): AiStorefrontReadyProposal {
  const parsedProposal = parseReadyProposal(input);
  const hasLegacyBrandOperation = parsedProposal.operations.some(
    ({ operation }) =>
      operation.type === "APPLY_APPROVED_BRAND_COLOURS" ||
      operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY",
  );
  const proposal: AiStorefrontReadyProposal =
    hasLegacyBrandOperation && parsedProposal.proposedStorefront.brandSystem.designDna === undefined
      ? {
          ...parsedProposal,
          proposedStorefront: {
            ...parsedProposal.proposedStorefront,
            brandSystem: migrateBrandSystemDesignDna(parsedProposal.proposedStorefront.brandSystem),
          },
        }
      : parsedProposal;
  const context = parseContext(contextInput);
  const target = canonicalizeAiStorefrontTarget(proposal.target);
  assertProposalIdentity(proposal, target, context);
  assertProposalFingerprints(proposal, target, context);
  assertProjectionPreservation(proposal, target);
  if (!proposal.wholeStorefrontGeneration) assertSupportedDesignStateProjection(proposal);
  if (!proposal.wholeStorefrontGeneration) {
    validateAiStorefrontOperations(proposal.operations, target, proposal.permissionGrants, context);
  }
  assertProjectionMatchesOperations(proposal, context);
  return proposal;
}
