import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  resolveInstalledZodEsmClosure,
  resolveRuntimeImportClosure,
} from "../helpers/ar-02-runtime-import-closure";
import {
  observeProviderBoundaries,
  promptObservationRequest,
  providerObservationCommand,
} from "../helpers/ar-02j-provider-observation";
import { aurumNordicSeed } from "@/data/seed";
import { getComponentDescription } from "@/components/registry/component-descriptions";
import * as sources from "@/components/registry/component-description-sources";
import * as contentBridge from "@/components/registry/content-support-bridge";
import * as homepageMetadata from "@/components/registry/homepage-commerce-bridge-metadata";
import { getComponentDefinition, veskifyComponentRegistry } from "@/components/registry/registry";
import * as schemas from "@/application/design-operations/contract";
import * as operations from "@/application/design-operations/operations";
import * as proposals from "@/application/design-operations/proposals";
import * as compatibility from "@/application/design-operations";
import * as skills from "@/application/design-skills/contract";
import * as provider from "@/application/ai-provider/contract";
import * as permissions from "@/application/ai-storefront/validation";
import { buildAiStorefrontProviderRequest } from "@/application/ai-storefront-generation/request-builder";
import { planRegisteredTokenRefinement } from "@/application/ai-storefront-generation/token-refinement";
import { buildOpenAiProviderInput } from "@/integrations/ai/openai/prompt";

const roots = [
  "src/components/registry/component-description-sources.ts",
  "src/components/registry/component-descriptions.ts",
  "src/application/design-operations/contract.ts",
  "src/application/design-skills/contract.ts",
  "src/application/ai-provider/contract.ts",
  "src/integrations/ai/openai/prompt.ts",
  "src/application/ai-storefront-generation/component-contract-projection.ts",
];
const forbidden =
  /(?:\.tsx$|\.css$|^src\/(?:app|features|integrations\/puck)\/|^src\/components\/storefront\/|^src\/components\/registry\/(?:index|registry|contract|legacy-registry|renderer-observation|live-renderer-conformance|renderer-conformance)\.|^src\/application\/design-operations\/(?:operations|proposals|index)\.|^src\/application\/design-skills\/(?!contract\.)|^src\/application\/(?:whole-storefront-proposal-lifecycle|publishing|storefront-draft-persistence)\/|^src\/application\/bounded-storefront-synthesis\/(?:synthesizer|index)\.|^src\/application\/whole-storefront-generation-plan\/(?:index|complete-storefront-materializer)\.|^src\/application\/storefront-templates\/(?:index|materializer)\.|(?:^|\/)(?:react|react-dom|next|@puckeditor)(?:\/|$))/u;
const snapshot = aurumNordicSeed.draftSnapshot;
const page = snapshot.pages.find((candidate) => candidate.type === "home")!;
const sectionId = page.sections.find((section) => section.component === "hero")!.id;
const operationCases = [
  {
    type: "CHANGE_LOCALIZED_SECTION_TEXT",
    sectionId,
    field: "heading",
    locale: "fi",
    value: "Otsikko",
  },
  { type: "CHANGE_SECTION_VARIANT", sectionId, variant: "split" },
  { type: "CHANGE_BACKGROUND", sectionId, background: "background" },
  { type: "CHANGE_TYPOGRAPHY", sectionId, typography: "serif" },
  { type: "CHANGE_DENSITY", sectionId, density: "spacious" },
  { type: "CHANGE_SHAPE", sectionId, shape: "soft" },
  { type: "CHANGE_ALIGNMENT", sectionId, alignment: "center" },
  { type: "CHANGE_CTA_STYLE", sectionId, ctaPresentation: "primary" },
  { type: "APPLY_APPROVED_BRAND_COLOURS", colors: snapshot.brandSystem.colors },
  { type: "APPLY_APPROVED_BRAND_TYPOGRAPHY", typography: snapshot.brandSystem.typography },
  {
    type: "APPLY_REGISTERED_BRAND_SYSTEM",
    directionId: "premiumEditorial",
    brandSystem: snapshot.brandSystem,
  },
  { type: "ADD_APPROVED_SECTION", sectionId: "section_added", component: "hero" },
  { type: "REMOVE_OPTIONAL_SECTION", sectionId },
  { type: "REORDER_SECTIONS", sectionIds: [sectionId] },
  { type: "APPLY_REGISTERED_PAGE_SECTIONS", sections: page.sections, removedSectionIds: [] },
];

describe("AR-02J actual provider description/schema boundary", () => {
  it.each(roots)("resolves the complete pure runtime closure of %s", (root) => {
    const closure = resolveRuntimeImportClosure(root);
    expect(closure.runtimePaths.length).toBeGreaterThan(1);
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
    expect(closure.externalRuntimeImports.map(({ specifier }) => specifier)).toEqual(["zod"]);
  });

  it("checks the installed Zod ESM runtime as well as resolved CJS entries", () => {
    const closure = resolveInstalledZodEsmClosure();
    expect(closure.runtimePaths.length).toBeGreaterThan(1);
    expect(closure.runtimePaths.filter((path) => forbidden.test(path))).toEqual([]);
  });

  it("retains all runtime descriptions, ordered variants and shared metadata identities", () => {
    expect(Object.keys(veskifyComponentRegistry)).toHaveLength(29);
    for (const [key, definition] of Object.entries(veskifyComponentRegistry)) {
      const description = getComponentDescription(key);
      expect(Object.keys(description)).toEqual([
        "type",
        "label",
        "variants",
        "editorFields",
        "protectedFields",
      ]);
      expect(description).toEqual({
        type: definition.type,
        label: definition.label,
        variants: definition.variants,
        editorFields: definition.editorFields,
        protectedFields: definition.protectedFields,
      });
      expect(description.variants).toBe(definition.variants);
      expect(description.editorFields).toBe(definition.editorFields);
      expect(description.protectedFields).toBe(definition.protectedFields);
    }
    for (const [key, source] of Object.entries({
      ...sources.dynamicCommerceBridgeDescriptions,
      ...sources.homepageCommerceBridgeDescriptions,
      contentSupport: sources.contentSupportBridgeDescription,
    })) {
      const definition = getComponentDefinition(key);
      expect(definition.variants).toBe(source.variants);
      expect(definition.editorFields).toBe(source.editorFields);
      expect(definition.protectedFields).toBe(source.protectedFields);
    }
    expect(contentBridge.contentSupportBridgeComponentNames).toBe(
      sources.contentSupportBridgeComponentNames,
    );
    expect(contentBridge.contentSupportBridgeVariants).toBe(sources.contentSupportBridgeVariants);
    for (const name of homepageMetadata.homepageCommerceBridgeComponentNames)
      expect(sources.homepageCommerceBridgeDescriptions[name].variants).toBe(
        homepageMetadata.homepageCommerceBridgeVariants[name],
      );
  });

  it.each(["constructor", "__proto__", "toString", "unknown-component", ""])(
    "keeps own-property failure for %j",
    (component) => {
      expect(() => getComponentDescription(component)).toThrow(
        `Unknown storefront component: ${component}.`,
      );
      expect(() => getComponentDefinition(component)).toThrow(
        `Unknown storefront component: ${component}.`,
      );
    },
  );

  it("retains every public operation/proposal schema as the same instance", () => {
    for (const [name, schema] of Object.entries(schemas)) {
      expect(compatibility[name as keyof typeof compatibility]).toBe(schema);
      const old = name in operations ? operations : proposals;
      expect((old as Record<string, unknown>)[name]).toBe(schema);
    }
    expect(provider.aiProviderResponseSchema.shape.operations.element).toBe(
      schemas.designOperationSchema,
    );
    expect(skills.designSkillExecutionResultSchema.shape.operations.element).toBe(
      schemas.designOperationSchema,
    );
    expect(skills.designPlanSchema.shape.validation).toBe(schemas.proposalValidationResultSchema);
    expect(skills.designSkillExecutionResultSchema.shape.validation).toBe(
      schemas.proposalValidationResultSchema,
    );
    expect(schemas.designProposalSchema.shape.operations.element).toBe(
      schemas.designOperationSchema,
    );
  });

  it.each(operationCases)(
    "accepts $type and rejects unknown fields without changing its parsed value",
    (operation) => {
      expect(schemas.designOperationSchema.parse(operation)).toEqual(operation);
      expect(
        schemas.designOperationSchema.safeParse({ ...operation, unexpected: true }).success,
      ).toBe(false);
      expect(operations.designOperationSchema.safeParse(operation)).toEqual(
        schemas.designOperationSchema.safeParse(operation),
      );
    },
  );

  it("covers the full discriminated union and preserves optional absence", () => {
    expect(operationCases.map(({ type }) => type)).toEqual(
      skills.designOperationTypeSchema.options,
    );
    expect(
      schemas.designOperationSchema.safeParse({ type: "EXECUTE_CODE", code: "malicious" }).success,
    ).toBe(false);
    const added = schemas.addApprovedSectionOperationSchema.parse({
      type: "ADD_APPROVED_SECTION",
      sectionId: "section_added",
      component: "hero",
    });
    expect(Object.hasOwn(added, "index")).toBe(false);
    expect(Object.hasOwn(added, "variant")).toBe(false);
  });

  it("preserves BrandSystem direction/refinement exclusivity and canonical refinement validation", () => {
    const base = { type: "APPLY_REGISTERED_BRAND_SYSTEM", brandSystem: snapshot.brandSystem };
    const tokenRefinementPlan = planRegisteredTokenRefinement(
      "Use Georgia headings and Inter body text. Preserve layouts, sections, products and images.",
      snapshot.brandSystem,
    );
    expect(tokenRefinementPlan).not.toBeNull();
    expect(
      schemas.applyRegisteredBrandSystemOperationSchema.safeParse({
        ...base,
        refinementId: "validatedTokenRefinement",
        tokenRefinementPlan,
      }).success,
    ).toBe(true);
    for (const extra of [
      {},
      {
        directionId: "premiumEditorial",
        refinementId: "validatedTokenRefinement",
        tokenRefinementPlan,
      },
      { refinementId: "validatedTokenRefinement" },
      { directionId: "premiumEditorial", tokenRefinementPlan },
      { refinementId: "validatedTokenRefinement", tokenRefinementPlan: {} },
      {
        refinementId: "validatedTokenRefinement",
        tokenRefinementPlan,
        designSystemNarrowing: { spacingDensity: "standard", surfaceDepth: "flat" },
      },
    ]) {
      expect(
        schemas.applyRegisteredBrandSystemOperationSchema.safeParse({ ...base, ...extra }).success,
      ).toBe(false);
    }
  });

  it("preserves strict proposal and homepage-redesign contracts", () => {
    const proposal = {
      id: "proposal_12345678",
      originalPage: page,
      proposedPage: page,
      operations: [],
      summary: { en: "No changes", fi: "Ei muutoksia" },
      validation: { valid: true, errors: [] },
      status: "pending",
    };
    expect(schemas.designProposalSchema.parse(proposal)).toEqual(proposal);
    for (const change of [
      { unexpected: true },
      { id: "invalid" },
      { status: "published" },
      { validation: { valid: true, errors: [], ignored: true } },
      { operations: [{ type: "EXECUTE_CODE" }] },
    ])
      expect(schemas.designProposalSchema.safeParse({ ...proposal, ...change }).success).toBe(
        false,
      );
    const intent = { direction: "luxury", includeCampaign: false };
    expect(operations.homepageRedesignIntentSchema.parse(intent)).toEqual(intent);
    expect(schemas.homepageRedesignIntentSchema.safeParse({ ...intent, extra: true }).success).toBe(
      false,
    );
  });

  it("matches complete original descriptions, prompt bytes and request outcomes", () => {
    // Complete pre-edit bytes are retained externally; this portable digest checks all cases in CI.
    const result = observeProviderBoundaries();
    expect(Object.keys(result.prompts)).toHaveLength(241);
    expect(Object.keys(result.requests)).toHaveLength(18);
    expect(createHash("sha256").update(JSON.stringify(result)).digest("hex")).toBe(
      "493f111c688fe073814733f31b8bd339bf4b7aaacbb3238ceaf857f1e5a7ceae",
    );
    const optional = promptObservationRequest("hero", "en", "page");
    optional.page.sections[0].content = {};
    optional.page.sections[0].props = {};
    expect(buildOpenAiProviderInput(optional)).not.toContain('"content":{}');
    expect(buildOpenAiProviderInput(optional)).not.toContain('"props":{}');
  });

  it("still invokes real contextual component validation and fails when it rejects a permission", () => {
    const canonicalize = permissions.canonicalizeAiStorefrontPermissionGrants;
    const definition = getComponentDefinition("hero");
    const validate = vi.spyOn(definition, "validate");
    try {
      const request = buildAiStorefrontProviderRequest(providerObservationCommand(), 7);
      expect(validate).toHaveBeenCalled();
      expect(
        request.permissionGrants.some((grant) => grant.target.kind === "existingSection"),
      ).toBe(true);
      const gate = vi
        .spyOn(permissions, "canonicalizeAiStorefrontPermissionGrants")
        .mockImplementation((...args) => {
          expect(args[2]).toBeDefined();
          validate.mockImplementation(() => {
            throw new Error("AR-02J permission validation sentinel");
          });
          return canonicalize(...args);
        });
      try {
        expect(() => buildAiStorefrontProviderRequest(providerObservationCommand(), 8)).toThrow(
          "AR-02J permission validation sentinel",
        );
        expect(gate).toHaveBeenCalled();
      } finally {
        gate.mockRestore();
      }
    } finally {
      validate.mockRestore();
    }
  });
});
