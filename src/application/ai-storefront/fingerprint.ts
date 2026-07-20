import { z } from "zod";
import { canonicalValueFingerprint } from "@/domain/storefront";
import { canonicalLocaleOrder, idSchema, localeSchema } from "@/domain/shared";
import {
  aiStorefrontContextSchema,
  aiStorefrontProjectionSchema,
  type AiStorefrontContext,
  type AiStorefrontProposal,
  type AiStorefrontTarget,
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
    affectedPages,
    pageOrder: context.storefront.pageOrder,
    navigation: context.storefront.navigation,
    brandSystem: context.storefront.brandSystem,
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

export function createAiStorefrontPermissionFingerprint(
  grantsInput: unknown,
  targetInput?: unknown,
  contextInput?: unknown,
): string {
  const grants = canonicalizeAiStorefrontPermissionGrants(grantsInput, targetInput, contextInput);
  return `storefront-permissions-${canonicalValueFingerprint(grants)}`;
}

export function createAiStorefrontProposalId(
  requestId: string,
  targetFingerprint: string,
  permissionFingerprint: string,
  operations: AiStorefrontProposal["operations"],
) {
  const digest = canonicalValueFingerprint({
    requestId,
    targetFingerprint,
    permissionFingerprint,
    operations,
  });
  return `storefront_proposal_${digest.slice(-64, -56)}`;
}
