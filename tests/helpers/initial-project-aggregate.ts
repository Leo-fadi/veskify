import { generateGuidedStorefront } from "@/application/guided-storefront-generation";
import { createStorefrontGenerationReview } from "@/application/storefront-generation-review";
import { aurumNordicSeed } from "@/data/seed";
import {
  normalizeStorefrontDesignBriefInput,
  type CatalogueContext,
  type StorefrontIndustry,
} from "@/domain/design-brief";
import type { Locale } from "@/domain/shared";

export const initialAggregateCreatedAt = "2026-07-18T15:00:00.000Z";

export type InitialAggregateFixtureOptions = Readonly<{
  suffix?: string;
  industry?: StorefrontIndustry;
  catalogueContext?: CatalogueContext | null;
  creationContext?: "new-storefront" | "redesign-existing-storefront" | "demo-storefront";
  existingStorefrontUrl?: string | null;
  selectedLanguages?: Locale[];
  primaryLanguage?: Locale | null;
  projectId?: string;
  snapshotId?: string;
  catalogueId?: string;
  createdAt?: string;
}>;

export function initialAggregateFixture(options: InitialAggregateFixtureOptions = {}) {
  const suffix = options.suffix ?? "default";
  const createdAt = options.createdAt ?? initialAggregateCreatedAt;
  const creationContext = options.creationContext ?? "new-storefront";
  const catalogueContext =
    options.catalogueContext === undefined ? "controlled-demo-catalogue" : options.catalogueContext;
  const brief = normalizeStorefrontDesignBriefInput({
    id: `brief_initial_aggregate_${suffix}`,
    createdAt,
    updatedAt: createdAt,
    creationContext: {
      type: creationContext,
      existingStorefrontUrl:
        creationContext === "redesign-existing-storefront"
          ? (options.existingStorefrontUrl ?? "https://merchant.example/store")
          : null,
    },
    businessIdentity: {
      businessName: "Northern Light Studio",
      shortDescription: "Quietly considered jewellery for everyday wear.",
      industry: options.industry ?? "jewellery",
      targetCustomer: "Customers looking for lasting Nordic design.",
      primaryMarket: "Finland",
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: {
      selectedLanguages: options.selectedLanguages ?? ["en", "fi"],
      primaryLanguage: options.primaryLanguage === undefined ? "en" : options.primaryLanguage,
    },
    catalogueContext,
  });
  const catalogue = structuredClone(aurumNordicSeed.catalogue);
  catalogue.id = options.catalogueId ?? `catalogue_initial_aggregate_${suffix}`;
  const guidedGenerationPlan = generateGuidedStorefront({
    brief,
    projectId: options.projectId ?? `project_initial_aggregate_${suffix}`,
    snapshotId: options.snapshotId ?? `snapshot_initial_aggregate_draft_${suffix}`,
    catalogueRef: catalogue.id,
    createdAt,
  });
  const review = createStorefrontGenerationReview(guidedGenerationPlan, brief);
  return {
    guidedGenerationPlan,
    review,
    brief,
    catalogue,
    mode: "merchant" as const,
    publishedSnapshotId: `snapshot_initial_aggregate_0_published_${suffix}`,
  };
}
