import { z } from "zod";
import { aiOperationPermissionGrantSchema } from "@/application/ai-provider";
import { canonicalLocaleOrder } from "@/domain/shared";
import { canonicalValueString } from "@/domain/storefront";
import {
  aiStorefrontContextSchema,
  aiStorefrontOperationSchema,
  aiStorefrontProposalSchema,
  aiStorefrontTargetSchema,
  type AiStorefrontContext,
  type AiStorefrontOperation,
  type AiStorefrontPermissionTarget,
  type AiStorefrontPermissionGrant,
  type AiStorefrontProposal,
  type AiStorefrontTarget,
} from "./contract";

export class AiStorefrontValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AiStorefrontValidationError";
  }
}

function invalid(code: string, message: string): never {
  throw new AiStorefrontValidationError(code, message);
}

function parse<T>(schema: z.ZodType<T>, input: unknown, message: string): T {
  try {
    return schema.parse(input);
  } catch {
    return invalid("invalid-contract", message);
  }
}

export function canonicalizeAiStorefrontTarget(input: unknown): AiStorefrontTarget {
  const target = parse(
    aiStorefrontTargetSchema,
    input,
    "The storefront AI target is incomplete or inconsistent.",
  );
  return {
    ...target,
    affectedPageIds: [...target.affectedPageIds].sort((left, right) => left.localeCompare(right)),
    affectedSectionTargets: [...target.affectedSectionTargets].sort(
      (left, right) =>
        left.pageId.localeCompare(right.pageId) || left.sectionId.localeCompare(right.sectionId),
    ),
    enabledLocales: canonicalLocaleOrder(target.enabledLocales),
  };
}

function parseContext(input: unknown): AiStorefrontContext {
  const context = parse(
    aiStorefrontContextSchema,
    input,
    "The active storefront context is incomplete or inconsistent.",
  );
  return { ...context, enabledLocales: canonicalLocaleOrder(context.enabledLocales) };
}

function targetKey(target: AiStorefrontPermissionTarget) {
  return canonicalValueString(target);
}

function assertTargetIdentity(target: AiStorefrontTarget, context?: AiStorefrontContext) {
  if (!context) return;
  if (
    context.projectId !== target.projectId ||
    context.draftSnapshotId !== target.draftSnapshotId ||
    context.draftRevision !== target.draftRevision ||
    context.activeLocale !== target.activeLocale ||
    canonicalValueString(context.enabledLocales) !== canonicalValueString(target.enabledLocales)
  ) {
    invalid("stale-context", "The storefront AI target does not match the active draft context.");
  }
}

function assertPageBelongsToTarget(target: AiStorefrontTarget, pageId: string) {
  if (!target.affectedPageIds.includes(pageId)) {
    invalid(
      "target-page-mismatch",
      "Every storefront operation and permission grant must target an affected page.",
    );
  }
}

function assertSectionBelongsToTarget(
  target: AiStorefrontTarget,
  pageId: string,
  sectionId: string,
) {
  assertPageBelongsToTarget(target, pageId);
  if (
    !target.affectedSectionTargets.some(
      (sectionTarget) => sectionTarget.pageId === pageId && sectionTarget.sectionId === sectionId,
    )
  ) {
    invalid(
      "target-section-mismatch",
      "Every section operation and section grant must target a declared storefront section.",
    );
  }
}

function assertContextPage(context: AiStorefrontContext, pageId: string) {
  if (!context.storefront.pages.some((page) => page.id === pageId)) {
    invalid("unknown-page", "The storefront context does not contain the declared page.");
  }
}

function assertContextGrantTarget(
  grantTarget: AiStorefrontPermissionTarget,
  context: AiStorefrontContext,
) {
  switch (grantTarget.kind) {
    case "page":
      assertContextPage(context, grantTarget.pageId);
      return;
    case "storefrontDesignSystem":
      if (grantTarget.projectId !== context.projectId) {
        invalid(
          "target-project-mismatch",
          "The storefront design-system grant must target the active project.",
        );
      }
      return;
    case "existingSection": {
      assertContextPage(context, grantTarget.pageId);
      const section = context.storefront.pages
        .find((page) => page.id === grantTarget.pageId)
        ?.sections.find((candidate) => candidate.id === grantTarget.sectionId);
      if (!section || section.component !== grantTarget.componentType) {
        invalid(
          "unknown-section",
          "Existing-section grants must match a section in the active storefront context.",
        );
      }
      return;
    }
    case "introducedSection": {
      assertContextPage(context, grantTarget.pageId);
      const sectionExists = context.storefront.pages
        .find((page) => page.id === grantTarget.pageId)
        ?.sections.some((candidate) => candidate.id === grantTarget.sectionId);
      if (sectionExists) {
        invalid(
          "duplicate-section",
          "Introduced-section grants cannot reuse an existing section identity.",
        );
      }
      return;
    }
  }
}

export function canonicalizeAiStorefrontPermissionGrants(
  input: unknown,
  targetInput?: unknown,
  contextInput?: unknown,
): AiStorefrontPermissionGrant[] {
  const grants = parse(
    z.array(aiOperationPermissionGrantSchema).min(1),
    input,
    "The storefront permission grants are incomplete or invalid.",
  );
  const target =
    targetInput === undefined ? undefined : canonicalizeAiStorefrontTarget(targetInput);
  const context = contextInput === undefined ? undefined : parseContext(contextInput);
  if (target) assertTargetIdentity(target, context);
  const keys = new Set<string>();
  const canonical = grants.map((grant) => {
    if (new Set(grant.operationTypes).size !== grant.operationTypes.length) {
      invalid("duplicate-operation-type", "A permission grant cannot repeat an operation type.");
    }
    if (target) {
      if (grant.target.kind === "storefrontDesignSystem") {
        if (
          target.designSystemTarget === null ||
          grant.target.projectId !== target.designSystemTarget.projectId
        ) {
          invalid(
            "target-global-mismatch",
            "Global grants require the declared storefront design-system target.",
          );
        }
      } else if (grant.target.kind === "page") {
        assertPageBelongsToTarget(target, grant.target.pageId);
      } else {
        assertSectionBelongsToTarget(target, grant.target.pageId, grant.target.sectionId);
      }
    }
    if (context) assertContextGrantTarget(grant.target, context);
    const operationTypes = [...grant.operationTypes].sort((left, right) =>
      left.localeCompare(right),
    );
    const normalized = { ...grant, operationTypes };
    for (const operationType of operationTypes) {
      const key = `${targetKey(grant.target)}:${operationType}`;
      if (keys.has(key)) {
        invalid(
          "duplicate-permission-grant",
          "Duplicate or conflicting permission grants are not allowed.",
        );
      }
      keys.add(key);
    }
    return normalized;
  });
  return canonical.sort((left, right) =>
    canonicalValueString(left).localeCompare(canonicalValueString(right)),
  );
}

function operationTarget(
  operation: AiStorefrontOperation["operation"],
): { kind: "storefrontDesignSystem" } | { kind: "page" } | { kind: "section" } {
  if (operation.type === "APPLY_APPROVED_BRAND_COLOURS") {
    return { kind: "storefrontDesignSystem" };
  }
  if (operation.type === "REORDER_SECTIONS") {
    return { kind: "page" };
  }
  if ("sectionId" in operation) {
    return { kind: "section" };
  }
  return { kind: "page" };
}

function findGrantForOperation(
  operation: AiStorefrontOperation,
  grants: readonly AiStorefrontPermissionGrant[],
  context?: AiStorefrontContext,
) {
  const derived = operationTarget(operation.operation);
  if (derived.kind === "storefrontDesignSystem") {
    return grants.some(
      (grant) =>
        grant.operationTypes.includes(operation.operation.type) &&
        grant.target.kind === "storefrontDesignSystem",
    );
  }
  const pageId =
    operation.target.kind === "page" || operation.target.kind === "section"
      ? operation.target.pageId
      : "";
  const sectionId = operation.target.kind === "section" ? operation.target.sectionId : undefined;
  const operationKind =
    operation.operation.type === "ADD_APPROVED_SECTION"
      ? "introducedSection"
      : derived.kind === "section"
        ? "existingSection"
        : "page";
  const componentType =
    operation.operation.type === "ADD_APPROVED_SECTION"
      ? operation.operation.component
      : context?.storefront.pages
          .find((page) => page.id === pageId)
          ?.sections.find((section) => section.id === sectionId)?.component;
  return grants.some(
    (grant) =>
      grant.operationTypes.includes(operation.operation.type) &&
      grant.target.kind === operationKind &&
      grant.target.pageId === pageId &&
      (operationKind === "page" ||
        (grant.target.kind !== "page" &&
          grant.target.sectionId === sectionId &&
          (componentType === undefined || grant.target.componentType === componentType))),
  );
}

export function validateAiStorefrontOperations(
  input: unknown,
  targetInput: unknown,
  grantsInput: unknown,
  contextInput?: unknown,
): AiStorefrontOperation[] {
  const target = canonicalizeAiStorefrontTarget(targetInput);
  const context = contextInput === undefined ? undefined : parseContext(contextInput);
  assertTargetIdentity(target, context);
  const grants = canonicalizeAiStorefrontPermissionGrants(grantsInput, target, context);
  const operations = parse(
    z.array(aiStorefrontOperationSchema).min(1),
    input,
    "The storefront operations are incomplete or invalid.",
  );
  operations.forEach((operation, index) => {
    if (operation.order !== index) {
      invalid(
        "non-deterministic-operation-order",
        "Storefront operations must have contiguous deterministic order values.",
      );
    }
    const declaredTarget = operation.target;
    const expectedKind = operationTarget(operation.operation).kind;
    if (declaredTarget.kind !== expectedKind) {
      invalid(
        "operation-target-mismatch",
        "The operation target kind must match the operation payload.",
      );
    }
    if (
      declaredTarget.kind === "section" &&
      "sectionId" in operation.operation &&
      operation.operation.sectionId !== declaredTarget.sectionId
    ) {
      invalid(
        "operation-section-mismatch",
        "The operation section identity must match its declared target.",
      );
    }
    if (declaredTarget.kind === "storefrontDesignSystem") {
      if (
        target.designSystemTarget === null ||
        declaredTarget.projectId !== target.designSystemTarget.projectId
      ) {
        invalid(
          "target-global-mismatch",
          "Global operations require the declared storefront design-system target.",
        );
      }
    } else if (declaredTarget.kind === "page") {
      assertPageBelongsToTarget(target, declaredTarget.pageId);
      if (context) assertContextPage(context, declaredTarget.pageId);
    } else {
      assertSectionBelongsToTarget(target, declaredTarget.pageId, declaredTarget.sectionId);
      if (context) {
        assertContextPage(context, declaredTarget.pageId);
        const section = context.storefront.pages
          .find((page) => page.id === declaredTarget.pageId)
          ?.sections.find((candidate) => candidate.id === declaredTarget.sectionId);
        if (operation.operation.type !== "ADD_APPROVED_SECTION" && !section) {
          invalid("unknown-section", "The operation targets an unknown storefront section.");
        }
        if (operation.operation.type === "ADD_APPROVED_SECTION" && section) {
          invalid("duplicate-section", "The operation introduces an existing section identity.");
        }
      }
    }
    if (
      operation.operation.type === "APPLY_APPROVED_BRAND_COLOURS" &&
      declaredTarget.kind !== "storefrontDesignSystem"
    ) {
      invalid(
        "global-target-required",
        "Storefront-level design operations require an explicit global target.",
      );
    }
    if (
      operation.operation.type !== "APPLY_APPROVED_BRAND_COLOURS" &&
      declaredTarget.kind === "storefrontDesignSystem"
    ) {
      invalid(
        "invalid-global-operation",
        "Only approved design-system operations may use the global target.",
      );
    }
    if (!findGrantForOperation(operation, grants, context)) {
      invalid(
        "permission-grant-mismatch",
        "The storefront operation is not covered by a target-bound permission grant.",
      );
    }
  });
  return operations;
}

export function validateAiStorefrontProposal(
  input: unknown,
  contextInput?: unknown,
): AiStorefrontProposal {
  const proposal = parse(
    aiStorefrontProposalSchema,
    input,
    "The storefront proposal envelope is incomplete or invalid.",
  );
  const target = canonicalizeAiStorefrontTarget(proposal.target);
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
  const affectedPageIds = proposal.affectedPages
    .map((page) => page.id)
    .sort((left, right) => left.localeCompare(right));
  if (canonicalValueString(affectedPageIds) !== canonicalValueString(target.affectedPageIds)) {
    invalid(
      "affected-pages-mismatch",
      "The proposal affected pages must match its declared target.",
    );
  }
  const originalPages = new Map(proposal.originalStorefront.pages.map((page) => [page.id, page]));
  const proposedPageIds = new Set(proposal.proposedStorefront.pages.map((page) => page.id));
  for (const page of proposal.affectedPages) {
    const originalPage = originalPages.get(page.id);
    if (!originalPage || !proposedPageIds.has(page.id)) {
      invalid(
        "affected-pages-mismatch",
        "Affected pages must exist in both storefront proposal projections.",
      );
    }
    if (canonicalValueString(originalPage) !== canonicalValueString(page)) {
      invalid(
        "original-page-mismatch",
        "Affected pages must match the proposal original storefront projection.",
      );
    }
  }
  const context = contextInput === undefined ? undefined : parseContext(contextInput);
  if (context) {
    assertTargetIdentity(target, context);
  }
  validateAiStorefrontOperations(proposal.operations, target, proposal.permissionGrants, context);
  return proposal;
}
