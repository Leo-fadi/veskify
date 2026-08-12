import { z } from "zod";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { canonicalLocaleOrder, idSchema, localeSchema } from "@/domain/shared";
import {
  aiStorefrontContextSchema,
  aiStorefrontProjectionSchema,
  type AiStorefrontContext,
  type AiStorefrontProposal,
  type AiStorefrontTarget,
  type AiStorefrontWholeStorefrontGeneration,
} from "./contract";
import {
  AiStorefrontValidationError,
  canonicalizeAiStorefrontPermissionGrants,
  canonicalizeAiStorefrontTarget,
} from "./validation";

const fingerprintContextInputSchema = z
  .object({
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    enabledLocales: z.array(localeSchema).min(1).max(2),
    activeLocale: localeSchema,
    storefront: aiStorefrontProjectionSchema.passthrough(),
  })
  .passthrough();

function parseFingerprintContext(input: unknown): AiStorefrontContext {
  try {
    const candidate = fingerprintContextInputSchema.parse(input);
    const parsed = aiStorefrontContextSchema.parse({
      projectId: candidate.projectId,
      draftSnapshotId: candidate.draftSnapshotId,
      draftRevision: candidate.draftRevision,
      enabledLocales: candidate.enabledLocales,
      activeLocale: candidate.activeLocale,
      storefront: {
        pageOrder: candidate.storefront.pageOrder,
        pages: candidate.storefront.pages,
        navigation: candidate.storefront.navigation,
        brandSystem: candidate.storefront.brandSystem,
        ...(candidate.storefront.sharedFrame
          ? { sharedFrame: candidate.storefront.sharedFrame }
          : {}),
        ...(candidate.storefront.dynamicCommercePresentation
          ? {
              dynamicCommercePresentation: candidate.storefront.dynamicCommercePresentation,
            }
          : {}),
        ...(candidate.storefront.contentSupportFactDocuments
          ? {
              contentSupportFactDocuments: candidate.storefront.contentSupportFactDocuments,
            }
          : {}),
      },
    });
    return { ...parsed, enabledLocales: canonicalLocaleOrder(parsed.enabledLocales) };
  } catch {
    throw new AiStorefrontValidationError(
      "invalid-context",
      "The storefront fingerprint context is incomplete or invalid.",
    );
  }
}

function assertTargetContext(target: AiStorefrontTarget, context: AiStorefrontContext) {
  if (
    target.projectId !== context.projectId ||
    target.draftSnapshotId !== context.draftSnapshotId ||
    target.draftRevision !== context.draftRevision ||
    target.activeLocale !== context.activeLocale ||
    JSON.stringify(target.enabledLocales) !== JSON.stringify(context.enabledLocales)
  ) {
    throw new AiStorefrontValidationError(
      "stale-context",
      "The storefront fingerprint target does not match the active context.",
    );
  }
}

function relevantTargetContext(context: AiStorefrontContext, target: AiStorefrontTarget) {
  const affectedPageIds = new Set(target.affectedPageIds);
  const affectedPages = context.storefront.pages.filter((page) => affectedPageIds.has(page.id));
  if (affectedPages.length !== affectedPageIds.size) {
    throw new AiStorefrontValidationError(
      "unknown-page",
      "The storefront fingerprint target references an unknown page.",
    );
  }
  return {
    projectId: context.projectId,
    draftSnapshotId: context.draftSnapshotId,
    draftRevision: context.draftRevision,
    enabledLocales: context.enabledLocales,
    activeLocale: context.activeLocale,
    affectedPageIds: target.affectedPageIds,
    affectedSectionTargets: target.affectedSectionTargets,
    designSystemTarget: target.designSystemTarget,
    affectedPages,
    pageOrder: context.storefront.pageOrder,
    navigation: context.storefront.navigation,
    brandSystem: context.storefront.brandSystem,
    ...(context.storefront.sharedFrame ? { sharedFrame: context.storefront.sharedFrame } : {}),
    ...(context.storefront.dynamicCommercePresentation
      ? {
          dynamicCommercePresentation: context.storefront.dynamicCommercePresentation,
        }
      : {}),
    ...(context.storefront.contentSupportFactDocuments
      ? {
          contentSupportFactDocuments: context.storefront.contentSupportFactDocuments,
        }
      : {}),
  };
}

export function createAiStorefrontTargetFingerprint(
  contextInput: unknown,
  targetInput: unknown,
): string {
  const context = parseFingerprintContext(contextInput);
  const target = canonicalizeAiStorefrontTarget(targetInput);
  assertTargetContext(target, context);
  return `storefront-target-${canonicalValueFingerprint(relevantTargetContext(context, target))}`;
}

export function createAiStorefrontBaselineFingerprint(contextInput: unknown): string {
  const context = parseFingerprintContext(contextInput);
  return `storefront-baseline-${canonicalValueFingerprint({
    projectId: context.projectId,
    draftSnapshotId: context.draftSnapshotId,
    draftRevision: context.draftRevision,
    enabledLocales: context.enabledLocales,
    activeLocale: context.activeLocale,
    storefront: context.storefront,
  })}`;
}

export function createAiStorefrontPermissionFingerprint(
  grantsInput: unknown,
  targetInput?: unknown,
  contextInput?: unknown,
): string {
  const grants = canonicalizeAiStorefrontPermissionGrants(grantsInput, targetInput, contextInput);
  return `storefront-permissions-${canonicalValueFingerprint(grants)}`;
}

/**
 * Canonical permission marker for the server-minted whole-storefront generation operation.
 * The registered structural operation has its own explicit permission contract because generic
 * page-edit grants cannot express an atomic page-set, frame, navigation and archetype transition.
 */
export function createAiStorefrontGenerationPermissionFingerprint(
  generation: AiStorefrontWholeStorefrontGeneration,
): string {
  return `storefront-permissions-${canonicalValueFingerprint({
    kind: generation.kind,
    contractVersion: generation.contractVersion,
    operationType: generation.operationType,
    target: generation.target,
    permission: generation.permission,
  })}`;
}

export function createAiStorefrontProposalId(
  requestId: string,
  targetFingerprint: string,
  permissionFingerprint: string,
  operations: AiStorefrontProposal["operations"],
  assetPlacementOperations: AiStorefrontProposal["assetPlacementOperations"] = [],
  dynamicCommerceMigration?: AiStorefrontProposal["dynamicCommerceMigration"],
  wholeStorefrontGeneration?: AiStorefrontProposal["wholeStorefrontGeneration"],
) {
  const digest = canonicalValueFingerprint({
    requestId,
    targetFingerprint,
    permissionFingerprint,
    operations,
    assetPlacementOperations: assetPlacementOperations ?? [],
    dynamicCommerceMigration: dynamicCommerceMigration ?? null,
    ...(wholeStorefrontGeneration ? { wholeStorefrontGeneration } : {}),
  });
  return `storefront_proposal_${digest.slice(-64, -56)}`;
}
