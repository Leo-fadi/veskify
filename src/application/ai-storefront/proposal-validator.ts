import { canonicalLocaleOrder } from "@/domain/shared";
import { validateDesignOperationAgainstPage } from "@/application/design-operations";
import {
  applyRegisteredTokenRefinement,
  registeredBrandSystemForDirection,
  storefrontDesignSystemV1,
} from "@/application/storefront-design-system";
import { canonicalValueString } from "@/domain/storefront";
import {
  aiStorefrontContextSchema,
  aiStorefrontReadyProposalSchema,
  type AiStorefrontContext,
  type AiStorefrontReadyProposal,
  type AiStorefrontTarget,
} from "./contract";
import {
  createAiStorefrontPermissionFingerprint,
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
  const permissionFingerprint = createAiStorefrontPermissionFingerprint(
    proposal.permissionGrants,
    target,
    context,
  );
  if (proposal.permissionFingerprint !== permissionFingerprint) {
    invalid(
      "permission-fingerprint-mismatch",
      "The storefront proposal permission fingerprint is stale or invalid.",
    );
  }
}

function assertProjectionPreservation(
  proposal: AiStorefrontReadyProposal,
  target: AiStorefrontTarget,
) {
  const original = proposal.originalStorefront;
  const proposed = proposal.proposedStorefront;
  if (canonicalValueString(original.pageOrder) !== canonicalValueString(proposed.pageOrder)) {
    invalid(
      "page-order-mismatch",
      "Storefront proposals cannot add, remove, or reorder pages without a supported operation.",
    );
  }
  const originalPageIds = original.pages.map((page) => page.id);
  const proposedPageIds = proposed.pages.map((page) => page.id);
  if (canonicalValueString(originalPageIds) !== canonicalValueString(proposedPageIds)) {
    invalid(
      "page-set-mismatch",
      "Storefront proposals must preserve the complete canonical page set.",
    );
  }
  if (canonicalValueString(original.navigation) !== canonicalValueString(proposed.navigation)) {
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
      projected.brandSystem.colors = structuredClone(envelope.operation.colors);
      affectedDesignState = {
        ...(affectedDesignState ?? {}),
        colors: structuredClone(envelope.operation.colors),
      };
      continue;
    }
    if (envelope.operation.type === "APPLY_APPROVED_BRAND_TYPOGRAPHY") {
      projected.brandSystem.typography = structuredClone(envelope.operation.typography);
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
  const proposal = parseReadyProposal(input);
  const context = parseContext(contextInput);
  const target = canonicalizeAiStorefrontTarget(proposal.target);
  assertProposalIdentity(proposal, target, context);
  assertProposalFingerprints(proposal, target, context);
  assertProjectionPreservation(proposal, target);
  assertSupportedDesignStateProjection(proposal);
  validateAiStorefrontOperations(proposal.operations, target, proposal.permissionGrants, context);
  assertProjectionMatchesOperations(proposal, context);
  return proposal;
}
