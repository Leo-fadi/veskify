import { describe, expect, it } from "vitest";
import { prepareOnboardingProject } from "@/app/projects/new/onboarding-project-creation";
import { createApprovedStorefrontProject } from "@/application/approved-storefront-project";
import { aurumNordicSeed } from "@/data/seed";
import { normalizeStorefrontDesignBriefInput, type CatalogueContext } from "@/domain/design-brief";
import {
  ONBOARDING_SCHEMA_VERSION,
  createIdleUrlBriefWorkflow,
  onboardingBriefIdForSession,
  onboardingSessionSchema,
  type OnboardingSession,
} from "@/domain/onboarding";
import { InMemoryProjectRepository } from "@/services/storage";

const createdAt = "2026-07-19T10:00:00.000Z";

function reviewSession(catalogueContext: CatalogueContext): OnboardingSession {
  const id = `onboarding_catalogue_${catalogueContext}`;
  return onboardingSessionSchema.parse({
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    id,
    creationPath: "new-storefront",
    activeStepId: "review-plan",
    completedStepIds: [
      "creation-path",
      "business-basics",
      "existing-sources",
      "visual-direction",
      "catalogue",
      "pages",
      "languages",
    ],
    skippedStepIds: ["brand-assets"],
    selectedLanguages: ["en", "fi"],
    primaryLanguage: "en",
    status: "active",
    createdAt,
    updatedAt: createdAt,
    designBrief: normalizeStorefrontDesignBriefInput({
      id: onboardingBriefIdForSession(id),
      createdAt,
      updatedAt: createdAt,
      creationContext: { type: "new-storefront" },
      businessIdentity: {
        businessName: "Northern Light Studio",
        shortDescription: "Considered jewellery for everyday wear.",
        industry: "jewellery",
        targetCustomer: "Customers looking for lasting Nordic design.",
        primaryMarket: "Finland",
      },
      brandDirection: { visualStyleDirection: "editorial" },
      catalogueContext,
      storefrontStructure: { pageTypes: ["home", "collection", "product"] },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    }),
    urlBriefWorkflow: createIdleUrlBriefWorkflow({
      id: "url_workflow_project_creation",
      now: createdAt,
    }),
  });
}

describe("onboarding catalogue project preparation", () => {
  it("persists the deterministic Aurum catalogue only for the explicit demo plan", async () => {
    const prepared = prepareOnboardingProject(reviewSession("controlled-demo-catalogue"));
    const repository = new InMemoryProjectRepository([]);

    expect(prepared.review.canCreateProject).toBe(true);
    expect(prepared.creationInput).not.toBeNull();
    expect(prepared.creationInput?.catalogue.products.map(({ id }) => id)).toEqual(
      aurumNordicSeed.catalogue.products.map(({ id }) => id),
    );

    const result = await createApprovedStorefrontProject({
      ...prepared.creationInput!,
      repository,
    });
    const stored = await repository.get(result.projectId);
    expect(stored.catalogue).toEqual(prepared.creationInput?.catalogue);
    expect(stored.snapshots.every(({ catalogueRef }) => catalogueRef === stored.catalogue.id)).toBe(
      true,
    );
    expect(await repository.list()).toHaveLength(1);
  });

  it("persists an empty canonical catalogue without Aurum products, prices or IDs", async () => {
    const prepared = prepareOnboardingProject(reviewSession("empty-catalogue"));
    const repository = new InMemoryProjectRepository([]);

    expect(prepared.creationInput?.catalogue).toMatchObject({ products: [], collections: [] });
    const result = await createApprovedStorefrontProject({
      ...prepared.creationInput!,
      repository,
    });
    const stored = await repository.get(result.projectId);
    expect(stored.catalogue.products).toEqual([]);
    expect(stored.catalogue.collections).toEqual([]);
    expect(stored.catalogue).not.toEqual(
      expect.objectContaining({ id: aurumNordicSeed.catalogue.id }),
    );
    expect(await repository.list()).toHaveLength(1);
  });

  it("blocks an unresolved existing catalogue without preparing or persisting demo data", () => {
    const context = "existing-vesko-catalogue" as const;
    const blockerCode = "EXISTING_CATALOGUE_REFERENCE_UNRESOLVED";
    const prepared = prepareOnboardingProject(reviewSession(context));

    expect(prepared.creationInput).toBeNull();
    expect(prepared.review.catalogueContext).toBe(context);
    expect(prepared.review.canCreateProject).toBe(false);
    expect(prepared.review.blockers.map(({ code }) => code)).toContain(blockerCode);
    expect(prepared.review.sections.find(({ id }) => id === "catalogue")).toMatchObject({
      status: "blocked",
    });
  });
});
