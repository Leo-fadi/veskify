import { z } from "zod";
import { aiOperationPermissionGrantSchema } from "@/application/ai-provider";
import { validateDesignOperationAgainstPage } from "@/application/design-operations";
import { getComponentDefinition } from "@/components/registry";
import { canonicalLocaleOrder } from "@/domain/shared";
import { canonicalValueString, type PageModel } from "@/domain/storefront";
import {
  aiStorefrontContextSchema,
  aiStorefrontOperationSchema,
  aiStorefrontTargetSchema,
  type AiStorefrontContext,
  type AiStorefrontOperation,
  type AiStorefrontPermissionTarget,
  type AiStorefrontPermissionGrant,
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

function contextPage(context: AiStorefrontContext, pageId: string): PageModel {
  const page = context.storefront.pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    invalid("unknown-page", "The storefront context does not contain the declared page.");
  }
  return page;
}

function assertRegisteredComponent(componentType: string) {
  try {
    return getComponentDefinition(componentType);
  } catch {
    return invalid(
      "unknown-component",
      `The storefront permission references an unknown component: ${componentType}.`,
    );
  }
}

function assertContextGrantTarget(
  grantTarget: AiStorefrontPermissionTarget,
  context: AiStorefrontContext,
) {
  switch (grantTarget.kind) {
    case "page":
      contextPage(context, grantTarget.pageId);
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
      const page = contextPage(context, grantTarget.pageId);
      const definition = assertRegisteredComponent(grantTarget.componentType);
      const section = page.sections.find((candidate) => candidate.id === grantTarget.sectionId);
      if (!section || section.component !== grantTarget.componentType) {
        invalid(
          "unknown-section",
          "Existing-section grants must match a section in the active storefront context.",
        );
      }
      try {
        definition.validate(section, page.type);
      } catch (error) {
        invalid(
          "invalid-component-contract",
          error instanceof Error
            ? error.message
            : "The existing section does not satisfy its registered component contract.",
        );
      }
      return;
    }
    case "introducedSection": {
      const page = contextPage(context, grantTarget.pageId);
      const definition = assertRegisteredComponent(grantTarget.componentType);
      const sectionExists = context.storefront.pages.some((candidate) =>
        candidate.sections.some((section) => section.id === grantTarget.sectionId),
      );
      if (sectionExists) {
        invalid(
          "duplicate-section",
          "Introduced-section grants cannot reuse an existing section identity.",
        );
      }
      try {
        definition.validate(
          {
            id: grantTarget.sectionId,
            component: definition.type,
            variant: definition.defaultVariant,
            visible: true,
            content: structuredClone(definition.defaultContent),
            props: structuredClone(definition.defaultProps),
          },
          page.type,
        );
      } catch (error) {
        invalid(
          "invalid-component-contract",
          error instanceof Error
            ? error.message
            : "The introduced section is not allowed on its target page.",
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

type ResolvedOperationPermission =
  | { kind: "storefrontDesignSystem"; projectId: string }
  | { kind: "page"; pageId: string }
  | {
      kind: "existingSection" | "introducedSection";
      pageId: string;
      sectionId: string;
      componentType: string;
    };

function hasOperationGrant(
  operation: AiStorefrontOperation,
  permission: ResolvedOperationPermission,
  grants: readonly AiStorefrontPermissionGrant[],
) {
  return grants.some((grant) => {
    if (!grant.operationTypes.includes(operation.operation.type)) return false;
    if (permission.kind === "storefrontDesignSystem") {
      return (
        grant.target.kind === "storefrontDesignSystem" &&
        grant.target.projectId === permission.projectId
      );
    }
    if (permission.kind === "page") {
      return grant.target.kind === "page" && grant.target.pageId === permission.pageId;
    }
    return (
      grant.target.kind === permission.kind &&
      grant.target.pageId === permission.pageId &&
      grant.target.sectionId === permission.sectionId &&
      grant.target.componentType === permission.componentType
    );
  });
}

function validateOperationAgainstWorkingPage(
  workingPages: Map<string, PageModel>,
  pageId: string,
  operation: AiStorefrontOperation["operation"],
) {
  const page = workingPages.get(pageId);
  if (!page) invalid("unknown-page", "The operation targets an unknown storefront page.");
  try {
    const next = validateDesignOperationAgainstPage(page, operation);
    workingPages.set(pageId, next);
  } catch (error) {
    invalid(
      "invalid-operation",
      error instanceof Error
        ? error.message
        : "The operation does not satisfy the registered component contract.",
    );
  }
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
  const workingPages = new Map(
    context?.storefront.pages.map((page) => [page.id, structuredClone(page)]) ?? [],
  );
  const introducedSections = new Map<string, { pageId: string; componentType: string }>();
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
    let permission: ResolvedOperationPermission;
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
      permission = {
        kind: "storefrontDesignSystem",
        projectId: declaredTarget.projectId,
      };
    } else if (declaredTarget.kind === "page") {
      assertPageBelongsToTarget(target, declaredTarget.pageId);
      if (context) contextPage(context, declaredTarget.pageId);
      permission = { kind: "page", pageId: declaredTarget.pageId };
    } else {
      assertSectionBelongsToTarget(target, declaredTarget.pageId, declaredTarget.sectionId);
      const page = context ? contextPage(context, declaredTarget.pageId) : undefined;
      if (operation.operation.type === "ADD_APPROVED_SECTION") {
        if (
          introducedSections.has(declaredTarget.sectionId) ||
          context?.storefront.pages.some((candidate) =>
            candidate.sections.some((section) => section.id === declaredTarget.sectionId),
          )
        ) {
          invalid(
            "duplicate-section",
            "An introduced section identity must be new across the storefront.",
          );
        }
        assertRegisteredComponent(operation.operation.component);
        permission = {
          kind: "introducedSection",
          pageId: declaredTarget.pageId,
          sectionId: declaredTarget.sectionId,
          componentType: operation.operation.component,
        };
      } else {
        const introduced = introducedSections.get(declaredTarget.sectionId);
        if (introduced) {
          if (introduced.pageId !== declaredTarget.pageId) {
            invalid(
              "introduced-section-page-mismatch",
              "Introduced sections cannot be customized from another page.",
            );
          }
          permission = {
            kind: "introducedSection",
            pageId: introduced.pageId,
            sectionId: declaredTarget.sectionId,
            componentType: introduced.componentType,
          };
        } else {
          const currentPage = context ? workingPages.get(declaredTarget.pageId) : page;
          const section = currentPage?.sections.find(
            (candidate) => candidate.id === declaredTarget.sectionId,
          );
          if (!section) {
            invalid("unknown-section", "The operation targets an unknown storefront section.");
          }
          assertRegisteredComponent(section.component);
          permission = {
            kind: "existingSection",
            pageId: declaredTarget.pageId,
            sectionId: declaredTarget.sectionId,
            componentType: section.component,
          };
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
    if (!hasOperationGrant(operation, permission, grants)) {
      invalid(
        "permission-grant-mismatch",
        "The storefront operation is not covered by a target-bound permission grant.",
      );
    }
    if (context && declaredTarget.kind !== "storefrontDesignSystem") {
      validateOperationAgainstWorkingPage(workingPages, declaredTarget.pageId, operation.operation);
    }
    if (operation.operation.type === "ADD_APPROVED_SECTION") {
      if (permission.kind !== "introducedSection") {
        invalid(
          "operation-target-mismatch",
          "Added sections require an introduced-section permission target.",
        );
      }
      introducedSections.set(operation.operation.sectionId, {
        pageId: permission.pageId,
        componentType: operation.operation.component,
      });
    }
  });
  return operations;
}
