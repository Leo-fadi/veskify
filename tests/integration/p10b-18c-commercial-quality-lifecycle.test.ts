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
  compileStorefrontPublication,
  createCurrentPublishCompilerInput,
} from "@/application/publishing";
import {
  PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
  PROMPTED_STOREFRONT_STUDIO_OPERATION,
  promptedStorefrontStudioGenerationResponseSchema,
} from "@/application/prompted-storefront-studio";
import { createDeterministicWholeStorefrontPlanningProvider } from "@/application/whole-storefront-generation-plan";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
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

const lifecycleCases = [
  {
    id: "rich-premium",
    providerScenario: "premium-editorial",
    expectedFrame: "editorial-masthead",
    prompt:
      "Create a refined rich premium editorial jewellery storefront with generous storytelling, approved support and a guided buying journey.",
  },
  {
    id: "sparse-modern",
    providerScenario: "modern-technical",
    expectedFrame: "compact-technical",
    prompt:
      "Create a restrained modern technical storefront that remains commercially complete when presentation evidence is sparse.",
  },
  {
    id: "minimal",
    providerScenario: "minimal-commerce",
    expectedFrame: "centered-minimal",
    prompt:
      "Create a minimal direct commerce storefront with low visual noise and a product-first mobile hierarchy.",
  },
  {
    id: "complex-configurable-pdp",
    providerScenario: "modern-technical",
    expectedFrame: "compact-technical",
    prompt:
      "Create a modern technical storefront with clear configuration, option and variant evaluation for the complex product journey.",
  },
  {
    id: "content-support-rich",
    providerScenario: "premium-editorial",
    expectedFrame: "editorial-masthead",
    prompt:
      "Create a premium editorial complete storefront with a truthful merchant story and approved content and support hierarchy.",
  },
] as const;

function request(caseId: string, merchantPrompt: string) {
  return new Request("http://localhost/api/ai/whole-storefront-proposals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation: PROMPTED_STOREFRONT_STUDIO_OPERATION,
      contractVersion: PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
      requestId: `p10b18c-${caseId}-request`,
      projectId: P10B16P03_PROJECT_ID,
      draftSnapshotId: P10B16P03_DRAFT_ID,
      draftRevision: 0,
      activeLocale: "en",
      targetScope: "storefront",
      merchantPrompt,
    }),
  });
}

function protectedMedia(
  catalogue: ReturnType<typeof createP10B16P03RawKarvonenStudioFixture>["aggregate"]["catalogue"],
) {
  return canonicalValueFingerprint(
    catalogue.products.map(({ id, images, variants }) => ({
      id,
      images,
      variants: variants.map(({ id: variantId, attributes }) => ({ variantId, attributes })),
    })),
  );
}

describe("P10B-18C representative canonical lifecycle", () => {
  it.each(lifecycleCases)(
    "$id preserves proposal through Accept, Undo, Redo, Save, reload, Preview and deterministic publication compilation",
    async ({ id, providerScenario, expectedFrame, prompt }) => {
      const fixture = createP10B16P03RawKarvonenStudioFixture();
      const rawFingerprint = canonicalStorefrontContentFingerprint(fixture.rawDraft);
      const catalogueBefore = canonicalValueFingerprint(fixture.aggregate.catalogue);
      const mediaBefore = protectedMedia(fixture.aggregate.catalogue);
      const published = fixture.aggregate.snapshots.find(
        ({ id: snapshotId }) => snapshotId === fixture.aggregate.project.publishedSnapshotId,
      );
      if (!published) throw new Error(`${id} requires the retained published snapshot.`);
      const publishedBefore = canonicalStorefrontContentFingerprint(published);
      let mockProviderExecutions = 0;
      const selectLegacyProvider = vi.fn(() =>
        createDeterministicWholeStorefrontPlanningProvider(),
      );
      const selectPromptedProvider = vi.fn(() =>
        createP10B16P03MockPromptedStorefrontDesignIntentProvider({
          scenario: providerScenario,
          onRequest: () => {
            mockProviderExecutions += 1;
          },
        }),
      );
      const route = createWholeStorefrontPlanningRouteHandler({
        promptedAuthority: createP10B16P03ServerPromptedStorefrontStudioAuthority(),
        selectPromptedProvider,
        selectProvider: selectLegacyProvider,
        environment: { VESKIFY_RUNTIME_MODE: "standalone" },
      });

      const response = await route(request(id, prompt));
      const result = promptedStorefrontStudioGenerationResponseSchema.parse(await response.json());
      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(selectPromptedProvider).toHaveBeenCalledTimes(1);
      expect(selectLegacyProvider).not.toHaveBeenCalled();
      expect(mockProviderExecutions).toBe(1);
      expect(result.lineage).toMatchObject({
        providerId: P10B16P03_MOCK_PROMPTED_STOREFRONT_PROVIDER_ID,
        providerCallCount: 1,
        retryCount: 0,
        materializationCount: 1,
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

      const coordinator = new StorefrontProposalAcceptanceCoordinator({
        proposal: result.proposal.proposal,
        activeDraft: fixture.rawDraft,
        storedDraft: fixture.rawDraft,
        publishedSnapshot: published,
        catalogue: fixture.aggregate.catalogue,
        enabledLocales: fixture.aggregate.project.enabledLocales,
        activeLocale: "en",
        primaryLocale: fixture.aggregate.project.primaryLocale,
        now: () => new Date("2026-08-20T10:00:00.000Z"),
        createTransactionId: () => `transaction_p10b18c_${id.replaceAll("-", "_")}`,
      });
      const accepted = coordinator.accept();
      expect(accepted.state, JSON.stringify(accepted.failure)).toBe("accepted");
      const acceptedFingerprint = canonicalStorefrontContentFingerprint(accepted.activeDraft);
      expect(acceptedFingerprint).toBe(result.lineage.candidateSnapshotFingerprint);
      expect(accepted.activeDraft.sharedFrame?.profileId).toBe(expectedFrame);
      expect(storefrontSnapshotSchema.parse(accepted.activeDraft)).toEqual(accepted.activeDraft);
      expect(canonicalStorefrontContentFingerprint(coordinator.undo()!)).toBe(rawFingerprint);
      expect(canonicalStorefrontContentFingerprint(coordinator.redo()!)).toBe(acceptedFingerprint);
      expect(mockProviderExecutions).toBe(1);

      const repository = new InMemoryProjectRepository([fixture.aggregate]);
      const saved = await saveValidatedEditorDraft({
        repository,
        projectId: fixture.aggregate.project.id,
        loadedDraft: fixture.rawDraft,
        replacementSnapshot: accepted.activeDraft,
        primaryLocale: fixture.aggregate.project.primaryLocale,
        evidenceReferences: fixture.approvedEvidenceReferences,
        now: () => new Date("2026-08-20T10:01:00.000Z"),
        createSnapshotId: () => `snapshot_p10b18c_${id.replaceAll("-", "_")}`,
      });
      const reloaded = await repository.get(fixture.aggregate.project.id);
      const reloadedDraft = reloaded.snapshots.find(
        ({ id: snapshotId }) => snapshotId === reloaded.project.draftSnapshotId,
      );
      const reloadedPublished = reloaded.snapshots.find(
        ({ id: snapshotId }) => snapshotId === reloaded.project.publishedSnapshotId,
      );
      if (!reloadedDraft || !reloadedPublished) throw new Error(`${id} did not reload.`);
      expect(canonicalStorefrontContentFingerprint(saved.draft)).toBe(acceptedFingerprint);
      expect(canonicalStorefrontContentFingerprint(reloadedDraft)).toBe(acceptedFingerprint);
      expect(canonicalStorefrontContentFingerprint(reloadedPublished)).toBe(publishedBefore);
      expect(canonicalValueFingerprint(reloaded.catalogue)).toBe(catalogueBefore);
      expect(protectedMedia(reloaded.catalogue)).toBe(mediaBefore);
      expect(validateCommercialSharedFrameSnapshot(reloadedDraft)).toEqual(reloadedDraft);
      expect(() =>
        validateCanonicalStorefrontSiteMap(reloadedDraft, {
          catalogue: reloaded.catalogue,
          enabledLocales: reloaded.project.enabledLocales,
        }),
      ).not.toThrow();

      const home = reloadedDraft.pages.find(({ type }) => type === "home");
      const collectionRoute = reloadedDraft.dynamicCommercePresentation?.routeInventory.find(
        ({ kind }) => kind === "collection",
      );
      const productRoutes =
        reloadedDraft.dynamicCommercePresentation?.routeInventory.filter(
          ({ kind }) => kind === "product",
        ) ?? [];
      const configurableRoute = productRoutes.find((route) => {
        if (route.kind !== "product") return false;
        const product = reloaded.catalogue.products.find(
          ({ id: productId }) => productId === route.productId,
        );
        return (
          product !== undefined &&
          (product.variants.length > 1 || Boolean(product.orderOptions?.length))
        );
      });
      if (!home || !collectionRoute || !configurableRoute) {
        throw new Error(`${id} lacks representative Preview routes.`);
      }
      const previewContext = createStorefrontRenderContext({
        activeLocale: reloaded.project.primaryLocale,
        primaryLocale: reloaded.project.primaryLocale,
        enabledLocales: reloaded.project.enabledLocales,
        catalogue: reloaded.catalogue,
        snapshot: reloadedDraft,
        evidenceReferences: fixture.approvedEvidenceReferences,
        pagePathPrefix: `/projects/${reloaded.project.id}`,
        pagePathSuffix: "",
        renderTarget: "preview",
      });
      expect(renderStorefrontPage(home, previewContext)).toBeTruthy();
      expect(
        resolveDynamicCommerceRoutePage({
          snapshot: reloadedDraft,
          catalogue: reloaded.catalogue,
          routeId: collectionRoute.id,
        }).page.sections.some(({ component }) => component === "dynamicCollectionCommerce"),
      ).toBe(true);
      expect(
        resolveDynamicCommerceRoutePage({
          snapshot: reloadedDraft,
          catalogue: reloaded.catalogue,
          routeId: configurableRoute.id,
        }).page.sections.some(({ component }) => component === "dynamicProductDetail"),
      ).toBe(true);

      if (id === "content-support-rich") {
        expect(reloadedDraft.contentSupportFactDocuments.length).toBeGreaterThan(0);
        expect(
          reloadedDraft.pages.some(({ sections }) =>
            sections.some(({ component }) => component === "contentSupport"),
          ),
        ).toBe(true);
      }

      const runtimeProjection = {
        searchQuery: "p10b18c-runtime-transient-search",
        utilityState: "p10b18c-runtime-transient-loading",
      };
      expect(canonicalValueString(reloadedDraft)).not.toContain(runtimeProjection.searchQuery);
      expect(canonicalValueString(reloadedDraft)).not.toContain(runtimeProjection.utilityState);
      expect(canonicalValueString(reloaded)).not.toContain(runtimeProjection.searchQuery);
      expect(canonicalValueString(reloaded)).not.toContain(runtimeProjection.utilityState);

      const compilerInput = createCurrentPublishCompilerInput({
        aggregate: reloaded,
        snapshot: reloadedDraft,
        sourceAuthority: { kind: "manual" },
        currentEvidenceReferences: fixture.approvedEvidenceReferences,
      });
      const firstCompilation = compileStorefrontPublication(compilerInput);
      const secondCompilation = compileStorefrontPublication(structuredClone(compilerInput));
      expect(canonicalValueString(secondCompilation.result)).toBe(
        canonicalValueString(firstCompilation.result),
      );
      expect(canonicalValueString(firstCompilation.result)).not.toContain(
        runtimeProjection.searchQuery,
      );
      expect(canonicalValueString(firstCompilation.result)).not.toContain(
        runtimeProjection.utilityState,
      );
      expect(mockProviderExecutions).toBe(1);
    },
    120_000,
  );
});
