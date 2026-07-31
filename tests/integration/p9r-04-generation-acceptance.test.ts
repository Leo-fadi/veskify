// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createWholeStorefrontGenerationPlan } from "@/application/whole-storefront-generation-plan";
import { classifyRegisteredWholeStorefrontDirectionRequest } from "@/application/ai-storefront-generation";
import { preparePublish, confirmPublish } from "@/application/publishing";
import { createStorefrontRenderContext } from "@/components/registry";
import {
  StorefrontCollectionCommerceRoute,
  StorefrontProductCommerceRoute,
} from "@/components/storefront/storefront-commerce-route";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import {
  createP905aFreshMerchantFixture,
  p905aProtectedCommerceBaseline,
} from "@/data/demo/p9-05a-fresh-store-generation";
import { canonicalValueString } from "@/domain/storefront";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";
import {
  assertP9r04MaterialStructuralDifference,
  compareP9r04Storefronts,
  p9r04CapabilityPathEvidence,
  p9r04ContentFingerprint,
  p9r04SnapshotFingerprint,
  P9R_04_LOCALES,
  P9R_04_MODERN_TECHNICAL_REQUEST,
  P9R_04_VIEWPORTS,
  projectP9r04Storefront,
} from "../helpers/p9r-04-generation-acceptance";
import {
  createP905aAcceptanceCoordinator,
  generateP905aInstructionScenarioFromBaseline,
  saveAndResolveP905aPreview,
} from "../helpers/p9-05a-generation-harness";

async function modernTechnicalScenario() {
  return generateP905aInstructionScenarioFromBaseline(
    "warmApproachable",
    P9R_04_MODERN_TECHNICAL_REQUEST,
  );
}

function renderedPages(
  snapshot: Awaited<ReturnType<typeof modernTechnicalScenario>>["fixture"]["draft"],
  generated: Awaited<ReturnType<typeof modernTechnicalScenario>>,
  locale: "en" | "fi",
) {
  const context = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: "fi",
    catalogue: generated.fixture.aggregate.catalogue,
    snapshot,
  });
  return Object.fromEntries(
    snapshot.pages.map((page) => [
      page.type,
      renderToStaticMarkup(renderStorefrontPage(page, context)),
    ]),
  );
}

describe("P9R-04 deterministic multi-page generation acceptance gate", () => {
  it("resets the canonical Lumo project deterministically with an approved brief and no generated state", () => {
    const first = createP905aFreshMerchantFixture("warmApproachable");
    const second = createP905aFreshMerchantFixture("warmApproachable");

    expect(p9r04SnapshotFingerprint(first.draft)).toBe(p9r04SnapshotFingerprint(second.draft));
    expect(first.draft).toEqual(second.draft);
    expect(first.draft.id).toBe("snapshot_lumo_fresh_draft");
    expect(first.aggregate.project.publishedSnapshotId).toBe("snapshot_lumo_fresh_published");
    expect(first.brief).toMatchObject({
      id: "brief_lumo_warm_approachable",
      revision: 1,
      status: "approved",
      approval: { status: "approved", approvedAt: "2026-07-28T09:00:00.000Z" },
    });
    expect(first.aggregate.snapshots).toHaveLength(2);
    expect(canonicalValueString(first)).not.toMatch(/aurum|karvonen/i);
  });

  it("derives exactly one modernTechnical plan from the exact merchant instruction and rejects an unapproved brief", async () => {
    const generated = await modernTechnicalScenario();
    const unapproved = structuredClone(generated.planningInput);
    unapproved.brief = {
      ...unapproved.brief,
      status: "needsReview",
    };

    expect(generated.request.instruction).toBe(P9R_04_MODERN_TECHNICAL_REQUEST);
    expect(generated.providerRequests).toEqual([
      expect.objectContaining({ merchantInstruction: P9R_04_MODERN_TECHNICAL_REQUEST }),
    ]);
    expect(generated.providerPlans).toHaveLength(1);
    expect(generated.plan.designSystemSelection.directionId).toBe("modernTechnical");
    expect(generated.plan).toMatchObject({
      briefId: generated.fixture.brief.id,
      briefRevision: generated.fixture.brief.revision,
      evidenceFingerprint: generated.fixture.brief.approvedEvidenceFingerprint,
      requestClass: "coordinatedStructuralDirection",
    });
    expect(generated.compiledProposal.preconditions).toMatchObject({
      briefRevision: generated.fixture.brief.revision,
      evidenceFingerprint: generated.fixture.brief.approvedEvidenceFingerprint,
    });
    expect(() => createWholeStorefrontGenerationPlan(unapproved)).toThrow(/approve/i);

    expect(generated.plan.requestClass).not.toBe("tokenOnlyRefinement");
    expect(
      classifyRegisteredWholeStorefrontDirectionRequest(
        "Make the storefront warm, premium, and minimal.",
      ),
    ).toEqual({ kind: "ambiguous" });
    expect(classifyRegisteredWholeStorefrontDirectionRequest("Change product prices.")).toEqual({
      kind: "protected-commerce",
    });
  });

  it("proves actual persisted shared-frame, homepage, collection, PDP, and design-system differences", async () => {
    const generated = await modernTechnicalScenario();
    const accepted = createP905aAcceptanceCoordinator(generated).accept();
    if (accepted.state !== "accepted") throw new Error("P9R-04 proposal acceptance failed.");

    const comparison = assertP9r04MaterialStructuralDifference(
      compareP9r04Storefronts(generated.fixture.draft, accepted.activeDraft),
    );

    expect(comparison.changed.sharedFrame).toEqual(
      expect.arrayContaining(["header", "footer", "surface"]),
    );
    expect(comparison.changed.homepage).toEqual(
      expect.arrayContaining(["recipeId", "sectionOrder", "hero"]),
    );
    expect(comparison.changed.collection).toEqual(
      expect.arrayContaining(["recipeId", "header", "commerce"]),
    );
    expect(comparison.changed.product).toEqual(
      expect.arrayContaining(["recipeId", "header", "commerce"]),
    );
    expect(comparison.changed.designSystem.length).toBeGreaterThanOrEqual(2);
    expect(projectP9r04Storefront(accepted.activeDraft)).toMatchObject({
      sharedFrame: { header: "header:compact", footer: "footer:compact" },
      homepage: { recipeId: "homeModernCommerce", hero: "hero:asymmetric" },
      collection: {
        recipeId: "collectionCommerce",
        commerce: { variant: "compact", filterLayout: "sidebar", gridDensity: "compact" },
      },
      product: {
        recipeId: "productVariantLed",
        commerce: {
          variant: "compact",
          galleryLayout: "thumbnails",
          optionDensity: "compact",
          attributeLayout: "table",
        },
      },
      designSystem: { spacingDensity: "compact", cornerTreatment: "square", surfaceDepth: "flat" },
    });
  });

  it("proves every claimed capability survives registry, planner, compiler, snapshot, and renderer", async () => {
    const generated = await modernTechnicalScenario();
    const accepted = createP905aAcceptanceCoordinator(generated).accept();
    if (accepted.state !== "accepted") throw new Error("P9R-04 proposal acceptance failed.");
    const evidence = p9r04CapabilityPathEvidence({
      plan: generated.plan,
      compiled: generated.compiledProposal,
      accepted: accepted.activeDraft,
    });
    const rendered = renderedPages(accepted.activeDraft, generated, "fi");

    expect(evidence).toHaveLength(6);
    evidence.forEach((entry) => {
      expect(entry).toMatchObject({
        direction: "modernTechnical",
        registered: true,
        plannerVisible: true,
        compilerPreserved: true,
        snapshotStored: true,
      });
      if (["dynamicCollectionCommerce", "dynamicProductDetail"].includes(entry.component)) {
        return;
      }
      const pageMarkup = rendered.home;
      const rendererMarker =
        entry.component === "header"
          ? "store-header"
          : entry.component === "hero"
            ? "store-hero"
            : entry.component === "productGrid"
              ? "product-grid"
              : entry.component === "footer"
                ? "store-footer"
                : null;
      if (!rendererMarker) {
        throw new Error(`P9R-04 has no registered static renderer marker for ${entry.component}.`);
      }
      expect(pageMarkup).toContain(rendererMarker);
      expect(pageMarkup).toContain(entry.variant);
    });

    const aggregate = {
      ...generated.fixture.aggregate,
      snapshots: [accepted.activeDraft],
    };
    const collectionPage = accepted.activeDraft.pages.find((page) => page.type === "collection");
    const productPage = accepted.activeDraft.pages.find((page) => page.type === "product");
    const collection = aggregate.catalogue.collections[0];
    const productId = productPage?.sections.find(
      (section) => section.component === "dynamicProductDetail",
    )?.content.productId;
    const product = aggregate.catalogue.products.find((candidate) => candidate.id === productId);
    if (!collectionPage || !productPage || !collection || !product) {
      throw new Error("P9R-04 requires accepted collection and product route targets.");
    }
    const adapter = createCatalogueStorefrontCommerceRouteAdapter();
    const collectionPresentation = adapter.collection({
      aggregate,
      snapshot: accepted.activeDraft,
      page: collectionPage,
      collection,
    });
    const productPresentation = adapter.product({
      aggregate,
      snapshot: accepted.activeDraft,
      page: productPage,
      product,
    });
    expect(
      {
        collection: collectionPresentation !== null,
        product: productPresentation !== null,
      },
      "P9R-04 requires each accepted dynamic commerce section to reach its route renderer.",
    ).toEqual({ collection: true, product: true });
    if (!collectionPresentation || !productPresentation) {
      throw new Error("P9R-04 accepted commerce sections are not renderer-visible.");
    }
    const canonicalFilterIds = [
      ...new Set(
        collection.productIds.flatMap((collectionProductId) => {
          const collectionProduct = aggregate.catalogue.products.find(
            (candidate) => candidate.id === collectionProductId,
          );
          if (!collectionProduct) throw new Error("P9R-04 collection product is unavailable.");
          return Object.keys(collectionProduct.attributes);
        }),
      ),
    ]
      .sort((left, right) => left.localeCompare(right))
      .map((filterId) => filterId.toLowerCase())
      .concat(["price", "availability"]);
    expect(
      collectionPresentation.projection.collections[0]?.filters.map((filter) => filter.id),
    ).toEqual(canonicalFilterIds);
    const routeContext = createStorefrontRenderContext({
      activeLocale: "fi",
      primaryLocale: "fi",
      catalogue: aggregate.catalogue,
      snapshot: accepted.activeDraft,
    });
    const collectionMarkup = renderToStaticMarkup(
      StorefrontCollectionCommerceRoute({
        page: collectionPage,
        context: routeContext,
        activeLocale: "fi",
        primaryLocale: "fi",
        presentation: collectionPresentation,
        target: "preview",
        onNavigateProduct: () => undefined,
        onNavigateCollection: () => undefined,
        onFilterIntent: () => undefined,
        onSortIntent: () => undefined,
      }),
    );
    const productMarkup = renderToStaticMarkup(
      StorefrontProductCommerceRoute({
        page: productPage,
        context: routeContext,
        activeLocale: "fi",
        primaryLocale: "fi",
        presentation: productPresentation,
        target: "preview",
        onPrimaryAction: () => undefined,
      }),
    );
    expect(collectionMarkup).toContain('data-component="dynamicCollectionCommerce"');
    expect(productMarkup).toContain('data-component="dynamicProductDetail"');
  });

  it("preserves protected commerce and approved asset identities through accepted state and registered renderers", async () => {
    const generated = await modernTechnicalScenario();
    const commerceBefore = p905aProtectedCommerceBaseline(generated.fixture.aggregate.catalogue);
    const approvedAssets = generated.fixture.assetContext.assets.map((asset) => ({
      assetId: asset.assetId,
      role: asset.role,
      revision: asset.revision,
      materialFingerprint: asset.materialFingerprint,
      provenance: asset.provenance,
    }));
    const accepted = createP905aAcceptanceCoordinator(generated).accept();
    if (accepted.state !== "accepted") throw new Error("P9R-04 proposal acceptance failed.");
    const rendered = renderedPages(accepted.activeDraft, generated, "fi");

    expect(p905aProtectedCommerceBaseline(generated.fixture.aggregate.catalogue)).toEqual(
      commerceBefore,
    );
    expect(canonicalValueString(accepted.activeDraft)).toContain("product_lumo_custom_ring");
    expect(canonicalValueString(accepted.activeDraft)).toContain("collection_lumo_jewellery");
    expect(canonicalValueString(generated.plan.canonicalCommerceBindings)).toContain(
      "product_lumo_custom_ring",
    );
    expect(rendered.collection).toContain("Kaari-nappikorvakorut");
    expect(rendered.product).toContain("Muokattava Halo-sormus");
    expect(rendered.product).toContain("890");
    approvedAssets.forEach((asset) => {
      expect(generated.fixture.brief.approvedAssetAssignments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            assetId: asset.assetId,
            role: asset.role,
            revision: asset.revision,
            fingerprint: asset.materialFingerprint,
          }),
        ]),
      );
    });
  });

  it("keeps review non-mutating and Accept, Undo, Redo, Save, Reload, Preview, and Publish exact", async () => {
    const generated = await modernTechnicalScenario();
    const baselineFingerprint = p9r04SnapshotFingerprint(generated.fixture.draft);
    const coordinator = createP905aAcceptanceCoordinator(generated);
    const reviewed = coordinator.inspect();

    expect(reviewed.state).toBe("ready");
    expect(p9r04SnapshotFingerprint(reviewed.activeDraft)).toBe(baselineFingerprint);
    expect(coordinator.inspectHistory()).toEqual({ past: [], future: [] });

    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    expect(coordinator.inspectHistory()).toMatchObject({ past: [expect.anything()], future: [] });
    const acceptedFingerprint = p9r04ContentFingerprint(accepted.activeDraft);
    expect(p9r04SnapshotFingerprint(coordinator.undo()!)).toBe(baselineFingerprint);
    expect(p9r04ContentFingerprint(coordinator.redo()!)).toBe(acceptedFingerprint);

    const saved = await saveAndResolveP905aPreview({ generated, accepted: accepted.activeDraft });
    expect(p9r04ContentFingerprint(saved.saved.draft)).toBe(acceptedFingerprint);
    expect(p9r04ContentFingerprint(saved.preview)).toBe(acceptedFingerprint);
    expect(Object.keys(renderedPages(saved.preview, generated, "en")).sort()).toEqual([
      "collection",
      "home",
      "product",
    ]);

    const preparation = await preparePublish(
      generated.fixture.aggregate.project.id,
      generated.repository,
      {
        now: () => new Date("2026-07-30T12:00:00.000Z"),
        createPreparationId: () => "publish_preparation_p9r_04",
      },
    );
    expect(preparation.publishPermitted).toBe(true);
    const published = await confirmPublish(preparation, generated.repository);
    expect(p9r04ContentFingerprint(published.publishedSnapshot)).toBe(acceptedFingerprint);
    expect(p9r04ContentFingerprint(published.synchronizedDraftSnapshot)).toBe(acceptedFingerprint);
  });

  it("keeps rejected proposals and the viewport/locale acceptance matrix explicit and deterministic", async () => {
    const generated = await modernTechnicalScenario();
    const coordinator = createP905aAcceptanceCoordinator(generated);
    const rejected = coordinator.reject();

    expect(rejected).toMatchObject({ state: "rejected", activeDraft: generated.fixture.draft });
    expect(coordinator.inspectHistory()).toEqual({ past: [], future: [] });
    expect(P9R_04_VIEWPORTS).toEqual([375, 768, 1024, 1440]);
    expect(P9R_04_LOCALES).toEqual(["en", "fi"]);
  });
});
