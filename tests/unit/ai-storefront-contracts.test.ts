import { describe, expect, it } from "vitest";
import {
  aiOperationPermissionTargetSchema,
  type AiOperationPermissionGrant,
} from "@/application/ai-provider";
import {
  canonicalizeAiStorefrontPermissionGrants,
  canonicalizeAiStorefrontTarget,
  createAiStorefrontPermissionFingerprint,
  createAiStorefrontTargetFingerprint,
  validateAiStorefrontOperations,
} from "@/application/ai-storefront";
import { aurumNordicSeed } from "@/data/seed";

const snapshot = aurumNordicSeed.draftSnapshot;
const homePage = snapshot.pages.find((page) => page.type === "home")!;
const collectionPage = snapshot.pages.find((page) => page.type === "collection")!;
const hero = homePage.sections.find((section) => section.component === "hero")!;

const context = () => ({
  projectId: aurumNordicSeed.project.id,
  draftSnapshotId: snapshot.id,
  draftRevision: snapshot.revision,
  enabledLocales: ["en", "fi"] as const,
  activeLocale: "en" as const,
  storefront: {
    pageOrder: snapshot.pages.map((page) => page.id),
    pages: structuredClone(snapshot.pages),
    navigation: structuredClone(snapshot.navigation),
    brandSystem: structuredClone(snapshot.brandSystem),
  },
});

const target = () => ({
  scope: "storefront" as const,
  projectId: aurumNordicSeed.project.id,
  draftSnapshotId: snapshot.id,
  draftRevision: snapshot.revision,
  affectedPageIds: [collectionPage.id, homePage.id],
  affectedSectionTargets: [{ pageId: homePage.id, sectionId: hero.id }],
  designSystemTarget: {
    kind: "storefrontDesignSystem" as const,
    projectId: aurumNordicSeed.project.id,
  },
  enabledLocales: ["fi", "en"] as const,
  activeLocale: "en" as const,
});

const pageGrant = (pageId = homePage.id): AiOperationPermissionGrant => ({
  skillId: "restylePage",
  skillVersion: "1.0.0",
  skillScope: "page",
  operationTypes: ["REORDER_SECTIONS"],
  target: { kind: "page", pageId },
});

const sectionGrant: AiOperationPermissionGrant = {
  skillId: "improveHero",
  skillVersion: "1.0.0",
  skillScope: "section",
  operationTypes: ["CHANGE_SECTION_VARIANT"],
  target: {
    kind: "existingSection",
    pageId: homePage.id,
    sectionId: hero.id,
    componentType: hero.component,
  },
};

const globalGrant: AiOperationPermissionGrant = {
  skillId: "restyleStorefront",
  skillVersion: "1.0.0",
  skillScope: "brand",
  operationTypes: ["APPLY_APPROVED_BRAND_COLOURS"],
  target: {
    kind: "storefrontDesignSystem",
    projectId: aurumNordicSeed.project.id,
  },
};

describe("P4-05A whole-storefront AI contract foundations", () => {
  it("canonicalizes multi-page target identity deterministically", () => {
    const first = canonicalizeAiStorefrontTarget(target());
    const equivalent = canonicalizeAiStorefrontTarget({
      ...target(),
      affectedPageIds: [homePage.id, collectionPage.id],
      affectedSectionTargets: [{ pageId: homePage.id, sectionId: hero.id }],
      enabledLocales: ["en", "fi"],
    });
    expect(first).toEqual(equivalent);
    expect(first.affectedPageIds).toEqual([...first.affectedPageIds].sort());
  });

  it("fingerprints equivalent ordering identically and includes relevant storefront context", () => {
    const first = createAiStorefrontTargetFingerprint(context(), target());
    const reordered = createAiStorefrontTargetFingerprint(
      { ...context(), uiState: { selectedPageId: collectionPage.id, zoom: 0.8 } },
      {
        ...target(),
        affectedPageIds: [homePage.id, collectionPage.id],
        enabledLocales: ["en", "fi"],
      },
    );
    expect(reordered).toBe(first);

    const changedPage = context();
    changedPage.storefront.pages[0].title = {
      ...changedPage.storefront.pages[0].title,
      en: "Changed title",
    };
    expect(createAiStorefrontTargetFingerprint(changedPage, target())).not.toBe(first);

    const changedBrand = context();
    changedBrand.storefront.brandSystem.colors.accent = "#B8860B";
    expect(createAiStorefrontTargetFingerprint(changedBrand, target())).not.toBe(first);

    expect(
      createAiStorefrontPermissionFingerprint([globalGrant, sectionGrant], target(), context()),
    ).toBe(
      createAiStorefrontPermissionFingerprint([sectionGrant, globalGrant], target(), context()),
    );
  });

  it("excludes volatile UI state and unrelated commerce data from the fingerprint", () => {
    const withNoise = {
      ...context(),
      uiState: { selectedSectionId: hero.id, isPanelOpen: true },
      storefront: {
        ...context().storefront,
        uiState: { dragPreview: "temporary" },
        unrelatedCommerceData: { customerEmail: "secret@example.com", price: 999 },
      },
    };
    expect(createAiStorefrontTargetFingerprint(withNoise, target())).toBe(
      createAiStorefrontTargetFingerprint(context(), target()),
    );
  });

  it("keeps page grants target-bound and rejects section escape", () => {
    expect(() =>
      validateAiStorefrontOperations(
        [
          {
            order: 0,
            target: { kind: "page", pageId: collectionPage.id },
            operation: {
              type: "REORDER_SECTIONS",
              sectionIds: collectionPage.sections.map((section) => section.id),
            },
          },
        ],
        target(),
        [pageGrant()],
        context(),
      ),
    ).toThrow(/permission|target/i);

    expect(() =>
      validateAiStorefrontOperations(
        [
          {
            order: 0,
            target: { kind: "section", pageId: collectionPage.id, sectionId: hero.id },
            operation: { type: "CHANGE_SECTION_VARIANT", sectionId: hero.id, variant: "default" },
          },
        ],
        target(),
        [sectionGrant],
        context(),
      ),
    ).toThrow(/section.*target|permission/i);

    expect(() =>
      canonicalizeAiStorefrontPermissionGrants(
        [
          {
            ...sectionGrant,
            target: { ...sectionGrant.target, sectionId: "section_unknown" },
          },
        ],
        {
          ...target(),
          affectedSectionTargets: [{ pageId: homePage.id, sectionId: "section_unknown" }],
        },
        context(),
      ),
    ).toThrow(/existing-section|unknown section/i);
  });

  it("requires explicit global permission for storefront-level operations", () => {
    const operation = {
      order: 0,
      target: { kind: "storefrontDesignSystem" as const, projectId: aurumNordicSeed.project.id },
      operation: {
        type: "APPLY_APPROVED_BRAND_COLOURS" as const,
        colors: structuredClone(snapshot.brandSystem.colors),
      },
    };
    expect(() =>
      validateAiStorefrontOperations([operation], target(), [pageGrant()], context()),
    ).toThrow(/permission/i);
    expect(validateAiStorefrontOperations([operation], target(), [globalGrant], context())).toEqual(
      [operation],
    );
  });

  it("rejects duplicate or conflicting grants and preserves existing target schema compatibility", () => {
    expect(() =>
      canonicalizeAiStorefrontPermissionGrants(
        [sectionGrant, { ...sectionGrant, skillId: "anotherSkill" }],
        target(),
        context(),
      ),
    ).toThrow(/duplicate|conflicting/i);
    expect(aiOperationPermissionTargetSchema.parse({ kind: "page", pageId: homePage.id })).toEqual({
      kind: "page",
      pageId: homePage.id,
    });
    expect(
      aiOperationPermissionTargetSchema.parse({
        kind: "storefrontDesignSystem",
        projectId: aurumNordicSeed.project.id,
      }),
    ).toEqual({ kind: "storefrontDesignSystem", projectId: aurumNordicSeed.project.id });
  });
});
