import {
  catalogueContextSchema,
  deepFreeze,
  templateCapabilitySchema,
  type CatalogueContext,
  type StorefrontTemplateDefinition,
  type StorefrontTemplatePagePlan,
  type TemplateCapability,
} from "./contract";
import { getTemplateById } from "./registry";
import type { PageType } from "@/domain/storefront";

export type TemplateCompatibilityIssue = Readonly<{
  code:
    | "TEMPLATE_NOT_FOUND"
    | "MISSING_REQUIRED_CAPABILITY"
    | "UNSUPPORTED_CATALOGUE_CONTEXT"
    | "UNSUPPORTED_REQUESTED_PAGE";
  message: string;
  capability?: TemplateCapability;
  pageType?: PageType;
}>;

export type TemplateCompatibilityWarning = Readonly<{
  code:
    "OPTIONAL_CAPABILITY_UNAVAILABLE" | "EMPTY_CATALOGUE_MERCHANDISING" | "DEMO_CATALOGUE_CONTENT";
  message: string;
  capability?: TemplateCapability;
}>;

export type TemplateResolutionInput = Readonly<{
  templateId: string;
  catalogueContext: CatalogueContext;
  availableCapabilities: readonly TemplateCapability[];
  requestedPageTypes?: readonly PageType[];
}>;

export type ResolvedTemplatePlan = Readonly<{
  template: StorefrontTemplateDefinition;
  pagePlans: readonly StorefrontTemplatePagePlan[];
  catalogueContext: CatalogueContext;
  requestedPageTypes: readonly PageType[];
  errors: readonly TemplateCompatibilityIssue[];
  warnings: readonly TemplateCompatibilityWarning[];
  compatible: boolean;
}>;

export type TemplateResolutionResult =
  | { status: "resolved"; plan: ResolvedTemplatePlan }
  | { status: "not-found"; error: TemplateCompatibilityIssue };

function uniqueCapabilities(input: readonly TemplateCapability[]): readonly TemplateCapability[] {
  return [...new Set(input)].map((capability) => templateCapabilitySchema.parse(capability));
}

function issue(input: TemplateCompatibilityIssue): TemplateCompatibilityIssue {
  return Object.freeze({ ...input });
}

function warning(input: TemplateCompatibilityWarning): TemplateCompatibilityWarning {
  return Object.freeze({ ...input });
}

export function resolveTemplate(input: TemplateResolutionInput): TemplateResolutionResult {
  const template = getTemplateById(input.templateId);
  if (!template) {
    return {
      status: "not-found",
      error: issue({
        code: "TEMPLATE_NOT_FOUND",
        message: `Storefront template ${input.templateId} was not found.`,
      }),
    };
  }

  const catalogueContext = catalogueContextSchema.parse(input.catalogueContext);
  const capabilities = new Set(uniqueCapabilities(input.availableCapabilities));
  const requestedPageTypes = [...(input.requestedPageTypes ?? template.supportedPageTypes)];
  const errors: TemplateCompatibilityIssue[] = [];
  const warnings: TemplateCompatibilityWarning[] = [];

  if (!template.supportedCatalogueContexts.includes(catalogueContext)) {
    errors.push(
      issue({
        code: "UNSUPPORTED_CATALOGUE_CONTEXT",
        message: `Template ${template.id} does not support the ${catalogueContext} catalogue context.`,
      }),
    );
  }
  requestedPageTypes.forEach((pageType) => {
    if (!template.supportedPageTypes.includes(pageType)) {
      errors.push(
        issue({
          code: "UNSUPPORTED_REQUESTED_PAGE",
          message: `Template ${template.id} does not define a ${pageType} page plan.`,
          pageType,
        }),
      );
    }
  });
  template.requiredCapabilities.forEach((capability) => {
    if (!capabilities.has(capability)) {
      errors.push(
        issue({
          code: "MISSING_REQUIRED_CAPABILITY",
          message: `Template ${template.id} requires the ${capability} capability.`,
          capability,
        }),
      );
    }
  });
  template.optionalCapabilities.forEach((capability) => {
    if (!capabilities.has(capability)) {
      warnings.push(
        warning({
          code: "OPTIONAL_CAPABILITY_UNAVAILABLE",
          message: `Template ${template.id} will use safe defaults without ${capability}.`,
          capability,
        }),
      );
    }
  });
  if (catalogueContext === "empty") {
    warnings.push(
      warning({
        code: "EMPTY_CATALOGUE_MERCHANDISING",
        message:
          "Merchandising slots remain in the plan and will use an empty-state presentation until catalogue data exists.",
      }),
    );
  }
  if (catalogueContext === "demo") {
    warnings.push(
      warning({
        code: "DEMO_CATALOGUE_CONTENT",
        message:
          "Merchandising slots will use demo catalogue content until merchant data is available.",
      }),
    );
  }

  const selectedPlans = template.pagePlans
    .filter((pagePlan) => requestedPageTypes.includes(pagePlan.pageType))
    .map((pagePlan) => structuredClone(pagePlan));
  const plan: ResolvedTemplatePlan = deepFreeze({
    template,
    pagePlans: selectedPlans,
    catalogueContext,
    requestedPageTypes: [...requestedPageTypes],
    errors,
    warnings,
    compatible: errors.length === 0,
  });
  return { status: "resolved", plan };
}
