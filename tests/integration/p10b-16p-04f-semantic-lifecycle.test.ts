// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWholeStorefrontPlanningRouteHandler } from "@/app/api/ai/whole-storefront-proposals/handler";
import {
  StorefrontProposalAcceptanceCoordinator,
  projectAiStorefrontSnapshot,
} from "@/application/ai-storefront";
import { saveValidatedEditorDraft } from "@/application/draft-save";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import {
  PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
  PROMPTED_STOREFRONT_STUDIO_OPERATION,
  promptedStorefrontStudioGenerationResponseSchema,
} from "@/application/prompted-storefront-studio";
import { createDeterministicWholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import {
  P10B16P03_DRAFT_ID,
  P10B16P03_PROJECT_ID,
  createP10B16P03RawKarvonenStudioFixture,
} from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  storefrontSnapshotSchema,
  validateCanonicalStorefrontSiteMap,
  validateCommercialSharedFrameSnapshot,
} from "@/domain/storefront";
import {
  P10B16P03_MOCK_PROMPTED_STOREFRONT_PROVIDER_ID,
  createP10B16P03MockPromptedStorefrontDesignIntentProvider,
} from "@/integrations/ai/mock-prompted-storefront-design-intent-v2-provider.server";
import { createP10B16P03ServerPromptedStorefrontStudioAuthority } from "@/integrations/ai/prompted-storefront-studio-authority.server";
import { InMemoryProjectRepository } from "@/services/storage";

const scenarios = [
  {
    id: "premium-editorial",
    expectedFrame: "editorial-masthead",
    prompt:
      "Create a refined premium editorial jewellery storefront with generous storytelling, elegant discovery and restrained luxury hierarchy.",
  },
  {
    id: "modern-technical",
    expectedFrame: "compact-technical",
    prompt:
      "Create a modern technical jewellery storefront with catalogue comparison, dense product information and clear configurable-product guidance.",
  },
  {
    id: "minimal-commerce",
    expectedFrame: "centered-minimal",
    prompt:
      "Create a restrained minimal commerce jewellery storefront with fast discovery, low visual noise and a direct conversion-led hierarchy.",
  },
] as const;

function studioRequest({
  requestId,
  merchantPrompt,
}: {
  requestId: string;
  merchantPrompt: string;
}) {
  return new Request("http://localhost/api/ai/whole-storefront-proposals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation: PROMPTED_STOREFRONT_STUDIO_OPERATION,
      contractVersion: PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
      requestId,
      projectId: P10B16P03_PROJECT_ID,
      draftSnapshotId: P10B16P03_DRAFT_ID,
      draftRevision: 0,
      activeLocale: "en",
      targetScope: "storefront",
      merchantPrompt,
    }),
  });
}

function protectedCommerceFingerprint(catalogue: unknown) {
  return canonicalValueFingerprint(catalogue);
}

function protectedMediaFingerprint(
  catalogue: ReturnType<typeof createP10B16P03RawKarvonenStudioFixture>["aggregate"]["catalogue"],
) {
  return canonicalValueFingerprint(
    catalogue.products.map(({ id, images, variants }) => ({
      id,
      images,
      variants: variants.map(({ id: variantId, attributes }) => ({
        id: variantId,
        attributes,
      })),
    })),
  );
}

describe("P10B-16P-04F deterministic semantic Studio lifecycle", () => {
  it.each(scenarios)(
    "$id generates one isolated proposal and preserves it through the canonical lifecycle",
    async ({ id, prompt, expectedFrame }) => {
      const fixture = createP10B16P03RawKarvonenStudioFixture();
      const aggregateBefore = canonicalValueString(fixture.aggregate);
      const rawFingerprint = canonicalStorefrontContentFingerprint(fixture.rawDraft);
      const commerceBefore = protectedCommerceFingerprint(fixture.aggregate.catalogue);
      const mediaBefore = protectedMediaFingerprint(fixture.aggregate.catalogue);
      const published = fixture.aggregate.snapshots.find(
        ({ id: snapshotId }) => snapshotId === fixture.aggregate.project.publishedSnapshotId,
      );
      if (!published)
        throw new Error("The semantic lifecycle fixture requires a published snapshot.");
      const publishedBefore = canonicalStorefrontContentFingerprint(published);
      let providerCalls = 0;
      let routeFailure: unknown;
      const selectLegacyProvider = vi.fn(() =>
        createDeterministicWholeStorefrontPlanningProvider(),
      );
      const selectPromptedProvider = vi.fn(() =>
        createP10B16P03MockPromptedStorefrontDesignIntentProvider({
          scenario: id,
          onRequest: () => {
            providerCalls += 1;
          },
        }),
      );
      const route = createWholeStorefrontPlanningRouteHandler({
        promptedAuthority: createP10B16P03ServerPromptedStorefrontStudioAuthority(),
        selectPromptedProvider,
        selectProvider: selectLegacyProvider,
        promptedLifecycle: {
          failure: ({ error }) => {
            routeFailure = error;
          },
        },
        environment: { VESKIFY_RUNTIME_MODE: "standalone" },
      });

      const response = await route(
        studioRequest({ requestId: `p10b16p04f-${id}-request`, merchantPrompt: prompt }),
      );
      const result = promptedStorefrontStudioGenerationResponseSchema.parse(await response.json());

      const routeFailureSummary =
        routeFailure instanceof Error
          ? `${routeFailure.name}:${"code" in routeFailure ? String(routeFailure.code) : "none"}:${routeFailure.message}`
          : String(routeFailure);
      expect(response.status, `${JSON.stringify(result)}; ${routeFailureSummary}`).toBe(200);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(selectPromptedProvider).toHaveBeenCalledTimes(1);
      expect(selectLegacyProvider).not.toHaveBeenCalled();
      expect(providerCalls).toBe(1);
      expect(result.lineage).toMatchObject({
        providerId: P10B16P03_MOCK_PROMPTED_STOREFRONT_PROVIDER_ID,
        providerCallCount: 1,
        retryCount: 0,
        materializationCount: 1,
      });
      expect(result.proposal.metadata.operationCount).toBe(1);
      expect(result.proposal.proposal.status).toBe("pending");
      expect(result.proposal.proposal.proposedStorefront.sharedFrame?.profileId).toBe(
        expectedFrame,
      );
      expect(result.proposal.proposal.originalStorefront).toMatchObject({
        brandSystem: fixture.rawDraft.brandSystem,
        pages: fixture.rawDraft.pages,
        navigation: fixture.rawDraft.navigation,
        dynamicCommercePresentation: fixture.rawDraft.dynamicCommercePresentation,
      });
      expect(result.proposal.proposal.originalStorefront).toEqual(
        projectAiStorefrontSnapshot(fixture.rawDraft),
      );
      expect(result.lineage.protectedCommerceAfterFingerprint).toBe(
        result.lineage.protectedCommerceBeforeFingerprint,
      );
      expect(result.lineage.protectedMediaAfterFingerprint).toBe(
        result.lineage.protectedMediaBeforeFingerprint,
      );

      const rejectCoordinator = new StorefrontProposalAcceptanceCoordinator({
        proposal: result.proposal.proposal,
        activeDraft: fixture.rawDraft,
        storedDraft: fixture.rawDraft,
        publishedSnapshot: published,
        catalogue: fixture.aggregate.catalogue,
        enabledLocales: fixture.aggregate.project.enabledLocales,
        activeLocale: "en",
        primaryLocale: fixture.aggregate.project.primaryLocale,
      });
      const rejected = rejectCoordinator.reject();
      expect(rejected.state).toBe("rejected");
      expect(rejected.transaction).toBeNull();
      expect(rejectCoordinator.inspectHistory()).toEqual({ past: [], future: [] });
      expect(canonicalStorefrontContentFingerprint(rejected.activeDraft)).toBe(rawFingerprint);
      expect(canonicalStorefrontContentFingerprint(rejected.storedDraft)).toBe(rawFingerprint);
      expect(canonicalValueString(fixture.aggregate)).toBe(aggregateBefore);

      const acceptCoordinator = new StorefrontProposalAcceptanceCoordinator({
        proposal: result.proposal.proposal,
        activeDraft: fixture.rawDraft,
        storedDraft: fixture.rawDraft,
        publishedSnapshot: published,
        catalogue: fixture.aggregate.catalogue,
        enabledLocales: fixture.aggregate.project.enabledLocales,
        activeLocale: "en",
        primaryLocale: fixture.aggregate.project.primaryLocale,
        now: () => new Date("2026-08-13T10:00:00.000Z"),
        createTransactionId: () => `transaction_p10b16p04f_${id.replaceAll("-", "_")}`,
      });
      const accepted = acceptCoordinator.accept();
      const acceptedFingerprint = canonicalStorefrontContentFingerprint(accepted.activeDraft);
      expect(accepted.state, JSON.stringify(accepted.failure)).toBe("accepted");
      expect(storefrontSnapshotSchema.parse(accepted.activeDraft)).toEqual(accepted.activeDraft);
      expect(validateCommercialSharedFrameSnapshot(accepted.activeDraft)).toEqual(
        accepted.activeDraft,
      );
      expect(accepted.activeDraft.sharedFrame?.profileId).toBe(expectedFrame);
      expect(acceptedFingerprint).toBe(result.lineage.candidateSnapshotFingerprint);
      expect(acceptCoordinator.inspectHistory().past).toHaveLength(1);
      expect(canonicalStorefrontContentFingerprint(acceptCoordinator.undo()!)).toBe(rawFingerprint);
      expect(canonicalStorefrontContentFingerprint(acceptCoordinator.redo()!)).toBe(
        acceptedFingerprint,
      );
      expect(providerCalls).toBe(1);

      const repository = new InMemoryProjectRepository([fixture.aggregate]);
      const saved = await saveValidatedEditorDraft({
        repository,
        projectId: fixture.aggregate.project.id,
        loadedDraft: fixture.rawDraft,
        replacementSnapshot: accepted.activeDraft,
        primaryLocale: fixture.aggregate.project.primaryLocale,
        evidenceReferences: fixture.approvedEvidenceReferences,
        now: () => new Date("2026-08-13T10:01:00.000Z"),
        createSnapshotId: () => `snapshot_p10b16p04f_${id.replaceAll("-", "_")}`,
      });
      const reloaded = await repository.get(fixture.aggregate.project.id);
      const reloadedDraft = reloaded.snapshots.find(
        ({ id: snapshotId }) => snapshotId === reloaded.project.draftSnapshotId,
      );
      const reloadedPublished = reloaded.snapshots.find(
        ({ id: snapshotId }) => snapshotId === reloaded.project.publishedSnapshotId,
      );
      if (!reloadedDraft || !reloadedPublished) {
        throw new Error("The semantic lifecycle save must retain draft and published snapshots.");
      }
      expect(canonicalStorefrontContentFingerprint(saved.draft)).toBe(acceptedFingerprint);
      expect(canonicalStorefrontContentFingerprint(reloadedDraft)).toBe(acceptedFingerprint);
      expect(canonicalStorefrontContentFingerprint(reloadedPublished)).toBe(publishedBefore);
      expect(protectedCommerceFingerprint(reloaded.catalogue)).toBe(commerceBefore);
      expect(protectedMediaFingerprint(reloaded.catalogue)).toBe(mediaBefore);
      expect(storefrontSnapshotSchema.parse(reloadedDraft)).toEqual(reloadedDraft);
      expect(() =>
        validateCanonicalStorefrontSiteMap(reloadedDraft, {
          catalogue: reloaded.catalogue,
          enabledLocales: reloaded.project.enabledLocales,
        }),
      ).not.toThrow();
      expect(validateCommercialSharedFrameSnapshot(reloadedDraft)).toEqual(reloadedDraft);
      expect(reloadedDraft.sharedFrame?.profileId).toBe(expectedFrame);
      expect(reloadedDraft.pages.map((page) => page.pageFamily?.familyId).sort()).toEqual([
        "about",
        "cart",
        "checkout",
        "empty-state",
        "error-state",
        "home",
        "no-results",
        "not-found",
      ]);

      const routes = reloadedDraft.dynamicCommercePresentation?.routeInventory ?? [];
      const collectionRoute = routes.find((candidate) => candidate.kind === "collection");
      const productRoutes = routes.filter((candidate) => candidate.kind === "product");
      const simpleRoute = productRoutes.find((candidate) => {
        if (candidate.kind !== "product") return false;
        const product = reloaded.catalogue.products.find(
          ({ id: productId }) => productId === candidate.productId,
        );
        return (
          product !== undefined && product.variants.length <= 1 && !product.orderOptions?.length
        );
      });
      const configurableRoute = productRoutes.find((candidate) => {
        if (candidate.kind !== "product") return false;
        const product = reloaded.catalogue.products.find(
          ({ id: productId }) => productId === candidate.productId,
        );
        return (
          product !== undefined && (product.variants.length > 1 || !!product.orderOptions?.length)
        );
      });
      if (!collectionRoute || !simpleRoute || !configurableRoute) {
        throw new Error(
          "The semantic lifecycle fixture requires collection, simple-product and configurable-product preview routes.",
        );
      }

      const resolvedCollection = resolveDynamicCommerceRoutePage({
        snapshot: reloadedDraft,
        catalogue: reloaded.catalogue,
        routeId: collectionRoute.id,
      });
      const resolvedSimple = resolveDynamicCommerceRoutePage({
        snapshot: reloadedDraft,
        catalogue: reloaded.catalogue,
        routeId: simpleRoute.id,
      });
      const resolvedConfigurable = resolveDynamicCommerceRoutePage({
        snapshot: reloadedDraft,
        catalogue: reloaded.catalogue,
        routeId: configurableRoute.id,
      });
      expect(resolvedCollection.page.slug).toBe(collectionRoute.route);
      expect(
        resolvedCollection.page.sections.some(
          ({ component }) => component === "dynamicCollectionCommerce",
        ),
      ).toBe(true);
      for (const [resolved, route] of [
        [resolvedSimple, simpleRoute],
        [resolvedConfigurable, configurableRoute],
      ] as const) {
        expect(resolved.page.slug).toBe(route.route);
        expect(
          resolved.page.sections.some(({ component }) => component === "dynamicProductDetail"),
        ).toBe(true);
      }
      expect(providerCalls).toBe(1);
      expect(selectLegacyProvider).not.toHaveBeenCalled();
    },
    120_000,
  );
});
