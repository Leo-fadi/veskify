import { describe, expect, it } from "vitest";
import {
  createInitialProjectAggregate,
  InitialProjectAggregateError,
} from "@/application/initial-project-aggregate";
import {
  createStorefrontGenerationReview,
  validateStorefrontGenerationReview,
  type StorefrontGenerationReview,
} from "@/application/storefront-generation-review";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { canonicalStorefrontContentEqual, canonicalValueString } from "@/domain/storefront";
import { validateProjectAggregate } from "@/services/storage/repository-validation";
import { initialAggregateFixture } from "../helpers/initial-project-aggregate";

function expectFactoryError(
  input: Parameters<typeof createInitialProjectAggregate>[0],
  code: InitialProjectAggregateError["code"],
) {
  try {
    createInitialProjectAggregate(input);
  } catch (error) {
    expect(error).toBeInstanceOf(InitialProjectAggregateError);
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function expectDeeplyFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach(expectDeeplyFrozen);
}

type SchemaValidReviewMutation = Readonly<{
  name: string;
  mutate: (review: StorefrontGenerationReview) => void;
}>;

const schemaValidReviewMutations: SchemaValidReviewMutation[] = [
  {
    name: "review ID",
    mutate: (review) => {
      review.id = "storefront-review-tampered";
    },
  },
  {
    name: "localized title",
    mutate: (review) => {
      review.title.fi = "Muokattu tarkistusotsikko";
    },
  },
  {
    name: "localized summary",
    mutate: (review) => {
      review.summary.en = "A different merchant-facing summary.";
    },
  },
  {
    name: "section summary",
    mutate: (review) => {
      review.sections[0].summary.en = "A different section summary.";
    },
  },
  {
    name: "fact value",
    mutate: (review) => {
      review.sections[0].facts[0].value = "brief_tampered";
    },
  },
  {
    name: "diagnostic context",
    mutate: (review) => {
      const diagnostic = review.sourceDiagnostics[0];
      diagnostic.context.en = "Changed diagnostic context";
      const warning = review.warnings.find(({ code }) => code === diagnostic.code);
      if (warning) warning.context.en = diagnostic.context.en;
    },
  },
  {
    name: "provenance",
    mutate: (review) => {
      review.provenance.storefrontMaterialization = "Unverified materialization source";
    },
  },
  {
    name: "schema-valid project-creation readiness",
    mutate: (review) => {
      review.pageSummaries = review.pageSummaries.filter(({ type }) => type !== "product");
      review.canCreateProject = false;
    },
  },
  {
    name: "reordered canonical facts",
    mutate: (review) => {
      review.sections[0].facts.reverse();
    },
  },
];

describe("createInitialProjectAggregate", () => {
  it("creates the deterministic synchronized ProjectAggregate without history", () => {
    const input = initialAggregateFixture();
    const aggregate = createInitialProjectAggregate(input);
    expect(validateProjectAggregate(aggregate)).toEqual(aggregate);
    expect(aggregate.project).toEqual({
      id: input.guidedGenerationPlan.projectId,
      name: input.brief.businessIdentity.businessName,
      mode: "merchant",
      industry: "jewellery",
      primaryLocale: "en",
      enabledLocales: ["en", "fi"],
      businessProfile: {
        name: input.brief.businessIdentity.businessName,
        description: input.brief.businessIdentity.shortDescription,
        audience: input.brief.businessIdentity.targetCustomer,
        market: input.brief.businessIdentity.primaryMarket,
        sourceReferences: [],
      },
      publishedSnapshotId: input.publishedSnapshotId,
      draftSnapshotId: input.guidedGenerationPlan.snapshotId,
      revision: 0,
      createdAt: input.guidedGenerationPlan.createdAt,
      updatedAt: input.guidedGenerationPlan.createdAt,
    });
    expect(aggregate.snapshots.map(({ id }) => id)).toEqual([
      input.publishedSnapshotId,
      input.guidedGenerationPlan.snapshotId,
    ]);
    const [published, draft] = aggregate.snapshots;
    expect(published).toMatchObject({ revision: 0, createdBy: "system" });
    expect(draft).toEqual(input.guidedGenerationPlan.generatedSnapshot);
    expect(draft.createdBy).toBe("agent");
    expect(canonicalStorefrontContentEqual(published, draft)).toBe(true);
    expect("snapshotHistoryMetadata" in aggregate).toBe(false);
  });

  it("accepts ready-with-warnings when the exact review allows creation", () => {
    const input = initialAggregateFixture({
      suffix: "warnings",
      catalogueContext: "controlled-demo-catalogue",
    });
    expect(input.guidedGenerationPlan.status).toBe("ready-with-warnings");
    expect(input.review.canCreateProject).toBe(true);
    expect(createInitialProjectAggregate(input).project.id).toBe(
      input.guidedGenerationPlan.projectId,
    );
  });

  it.each([
    ["jewellery", "jewellery"],
    ["watches", "jewellery"],
    ["fashion", "fashion"],
    ["beauty", "generic"],
    ["home", "generic"],
    ["food", "generic"],
    ["services", "generic"],
    ["electronics", "generic"],
    ["sports", "generic"],
    ["health", "generic"],
    ["other", "generic"],
  ] as const)("maps %s to the canonical %s project industry", (industry, expected) => {
    const input = initialAggregateFixture({ suffix: industry, industry });
    expect(createInitialProjectAggregate(input).project.industry).toBe(expected);
  });

  it("maps only the canonical redesign URL into source references", () => {
    const redesign = initialAggregateFixture({
      suffix: "redesign",
      creationContext: "redesign-existing-storefront",
      existingStorefrontUrl: "https://merchant.example/store",
    });
    const fresh = initialAggregateFixture({ suffix: "fresh" });
    expect(
      createInitialProjectAggregate(redesign).project.businessProfile.sourceReferences,
    ).toEqual(["https://merchant.example/store"]);
    expect(createInitialProjectAggregate(fresh).project.businessProfile.sourceReferences).toEqual(
      [],
    );
  });

  it("preserves locale order and explicit sales-demo mode", () => {
    const fixture = initialAggregateFixture({
      suffix: "locales",
      selectedLanguages: ["fi", "en"],
      primaryLanguage: "fi",
    });
    const aggregate = createInitialProjectAggregate({ ...fixture, mode: "salesDemo" });
    expect(aggregate.project).toMatchObject({
      mode: "salesDemo",
      primaryLocale: "fi",
      enabledLocales: ["fi", "en"],
    });
  });

  it("returns detached, deeply frozen and canonically deterministic aggregates", () => {
    const original = initialAggregateFixture({ suffix: "immutable" });
    const originalBefore = structuredClone(original);
    const detached = structuredClone(original);
    const first = createInitialProjectAggregate(detached);
    const second = createInitialProjectAggregate(structuredClone(original));
    const independentlyClonedReview = structuredClone(original.review);
    const third = createInitialProjectAggregate({ ...original, review: independentlyClonedReview });
    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(canonicalValueString(first)).toBe(canonicalValueString(second));
    expectDeeplyFrozen(first);
    expect(original).toEqual(originalBefore);
    expect(detached).toEqual(originalBefore);
    expect(independentlyClonedReview).toEqual(original.review);

    detached.catalogue.products[0].price.amount = 1;
    detached.brief.businessIdentity.businessName = "Changed after construction";
    expect(first.catalogue.products[0].price.amount).not.toBe(1);
    expect(first.project.name).toBe("Northern Light Studio");
    expect(() => {
      first.project.name = "Mutation attempt";
    }).toThrow();
  });

  it("rejects blocked plans, reviews, missing snapshots and not-run materialization", () => {
    const blocked = initialAggregateFixture({ suffix: "blocked", catalogueContext: null });
    expect(blocked.guidedGenerationPlan.status).toBe("blocked");
    expect(blocked.review.canCreateProject).toBe(false);
    expect(blocked.review.blockers.length).toBeGreaterThan(0);
    expect(blocked.guidedGenerationPlan.generatedSnapshot).toBeNull();
    expect(
      blocked.review.stageStatuses.find(({ stage }) => stage === "storefront-materialization")
        ?.status,
    ).toBe("not-run");
    expectFactoryError(blocked, "project-creation-not-allowed");
  });

  it.each(schemaValidReviewMutations)(
    "rejects a schema-valid review with changed $name",
    ({ mutate }) => {
      const input = initialAggregateFixture({
        suffix: "tampered-review",
        catalogueContext: "controlled-demo-catalogue",
      });
      const inputBefore = structuredClone(input);
      const review = structuredClone(input.review);
      mutate(review);
      expect(validateStorefrontGenerationReview(review)).toEqual(review);
      expectFactoryError({ ...input, review }, "inconsistent-generation-source");
      expect(input).toEqual(inputBefore);
    },
  );

  it("rejects same-ID changed briefs and full fingerprint mismatches", () => {
    const input = initialAggregateFixture({ suffix: "changed-brief" });
    const changedBrief = structuredClone(input.brief);
    changedBrief.businessIdentity.targetCustomer = "A different audience";
    expectFactoryError({ ...input, brief: changedBrief }, "inconsistent-generation-source");
  });

  it("rejects mismatched plan, review, brief and stage-plan provenance", () => {
    const input = initialAggregateFixture({ suffix: "source-a" });
    const other = initialAggregateFixture({ suffix: "source-b" });
    expectFactoryError({ ...input, review: other.review }, "inconsistent-generation-source");
    expectFactoryError({ ...input, brief: other.brief }, "inconsistent-generation-source");

    const changedStage = structuredClone(input.review);
    changedStage.materializationPlanId = "materialization_other";
    expectFactoryError({ ...input, review: changedStage }, "inconsistent-generation-source");
  });

  it("rejects mismatched review snapshot IDs and page summaries", () => {
    const input = initialAggregateFixture({ suffix: "review-mismatch" });
    const changedSnapshot = structuredClone(input.review);
    changedSnapshot.generatedSnapshotId = "snapshot_other";
    expectFactoryError({ ...input, review: changedSnapshot }, "inconsistent-generation-source");

    const changedPage = structuredClone(input.review);
    changedPage.pageSummaries[0].path = "/changed";
    expectFactoryError({ ...input, review: changedPage }, "inconsistent-generation-source");
  });

  it("rejects mismatched catalogue and duplicate snapshot identities", () => {
    const input = initialAggregateFixture({ suffix: "identity" });
    const catalogue = structuredClone(input.catalogue);
    catalogue.id = "catalogue_other";
    expectFactoryError({ ...input, catalogue }, "inconsistent-generation-source");
    expectFactoryError(
      { ...input, publishedSnapshotId: input.guidedGenerationPlan.snapshotId },
      "inconsistent-generation-source",
    );
  });

  it("rejects malformed scalar input, catalogue and guided snapshots", () => {
    const input = initialAggregateFixture({ suffix: "invalid-input" });
    expectFactoryError({ ...input, mode: "preview" as never }, "invalid-input");

    const malformedCatalogue = structuredClone(input.catalogue) as unknown as Record<
      string,
      unknown
    >;
    malformedCatalogue.products = [];
    expectFactoryError(
      { ...input, catalogue: malformedCatalogue as never },
      "invalid-project-aggregate",
    );

    const malformedPlan = structuredClone(input.guidedGenerationPlan);
    malformedPlan.generatedSnapshot!.pages = [];
    expectFactoryError({ ...input, guidedGenerationPlan: malformedPlan }, "invalid-input");
  });

  it("rejects invalid registered components and unresolved catalogue references", () => {
    const input = initialAggregateFixture({ suffix: "registry" });
    const invalidComponentPlan = structuredClone(input.guidedGenerationPlan);
    invalidComponentPlan.generatedSnapshot!.pages[0].sections[0].component = "unknownComponent";
    invalidComponentPlan.initialStorefrontGenerationPlan!.generatedSnapshot = structuredClone(
      invalidComponentPlan.generatedSnapshot,
    );
    const invalidComponentReview = createStorefrontGenerationReview(
      invalidComponentPlan,
      input.brief,
    );
    expectFactoryError(
      {
        ...input,
        guidedGenerationPlan: invalidComponentPlan,
        review: invalidComponentReview,
      },
      "invalid-project-aggregate",
    );

    const unresolved = structuredClone(input.catalogue);
    const referencedProduct = unresolved.products.find(
      ({ id }) => id === "product_aurora_ring_585",
    )!;
    referencedProduct.id = "product_replacement";
    unresolved.collections.forEach((collection) => {
      collection.productIds = collection.productIds.map((id) =>
        id === "product_aurora_ring_585" ? referencedProduct.id : id,
      );
    });
    expect(catalogueDisplayModelSchema.parse(unresolved)).toEqual(unresolved);
    expectFactoryError({ ...input, catalogue: unresolved }, "invalid-project-aggregate");
  });

  it("rejects corrupted project, timestamp and BrandSystem relationships", () => {
    const input = initialAggregateFixture({ suffix: "corruption" });
    for (const mutate of [
      (plan: typeof input.guidedGenerationPlan) => {
        plan.generatedSnapshot!.projectId = "project_other";
      },
      (plan: typeof input.guidedGenerationPlan) => {
        plan.generatedSnapshot!.createdAt = "2026-07-18T16:00:00.000Z";
      },
      (plan: typeof input.guidedGenerationPlan) => {
        plan.generatedSnapshot!.brandSystem.colors.primary = "#000000";
      },
    ]) {
      const plan = structuredClone(input.guidedGenerationPlan);
      mutate(plan);
      expectFactoryError({ ...input, guidedGenerationPlan: plan }, "invalid-input");
    }
  });
});
