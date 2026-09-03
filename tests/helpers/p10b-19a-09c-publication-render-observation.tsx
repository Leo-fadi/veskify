import { cleanup, render, waitFor } from "@testing-library/react";
import { expect } from "vitest";

import {
  resolveDynamicCommerceRoutePage,
  validateCurrentDynamicCommercePresentationAuthority,
} from "@/application/dynamic-commerce-routes/authority";
import { readLegacyV1HistoricalSnapshot } from "@/application/bounded-storefront-synthesis/legacy-v1-historical-snapshot-replay";
import {
  createLegacyV1StorefrontReplayReference,
  type LegacyV1CoordinatedDirectionReplayAliasId,
} from "@/application/bounded-storefront-synthesis/legacy-v1-replay-authority";
import {
  STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
  validateStorefrontSearchResultForRequest,
} from "@/application/storefront-search";
import { veskifyComponentCapabilityManifest } from "@/components/registry/capability-manifest";
import { createStorefrontRenderContext } from "@/components/registry/registry";
import {
  StorefrontCollectionCommerceRoute,
  StorefrontProductCommerceRoute,
  StorefrontSearchCommerceRoute,
} from "@/components/storefront/storefront-commerce-route";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import {
  createP10B16RepresentativeAuthority,
  createP10B16RepresentativeOutcome,
} from "@/data/demo/p10b-16-coordinated-directions";
import {
  canonicalStorefrontContentFingerprint,
  canonicalStorefrontSiteMapFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes/catalogue-adapter";
import {
  createStandaloneCatalogueProductSearchAdapter,
  createStandaloneStorefrontSearchAuthority,
} from "@/integrations/storefront-search/standalone-catalogue-adapter";
import type { ProjectAggregate } from "@/services/storage/project-repository";
import { previewPathPrefix } from "@/app/projects/[projectId]/preview-mode";
import { createP10B19A09BHistoricalRenderReplayEvidence } from "./p10b-19a-09b-render-observation";

export const P10B19A09C_BASE_COMMIT = "b32af02ff21c1bbbf754d23f4009e0b256610b41";
export const P10B19A09C_BASELINE_PATH =
  "/private/tmp/veskify-p10b-19a-09c-publication-baseline.json";

const directions = [
  ["premium-editorial", "legacy-v1:premium-editorial"],
  ["modern-technical", "legacy-v1:modern-technical"],
  ["minimal-commerce", "legacy-v1:minimal-commerce"],
] as const;
const locales = ["en", "fi"] as const;
const surfaces = [
  "home",
  "collection",
  "search",
  "product-detail",
  "content-support",
  "utility",
] as const;
const contentFamilies = new Set([
  "about",
  "contact",
  "store-locations",
  "faq",
  "shipping-information",
  "returns-information",
  "policy-legal",
  "campaign-editorial",
  "generic-content",
]);

type DirectionId = (typeof directions)[number][0];
type RenderTarget = "preview" | "published";

export type P10B19A09CHistoricalRenderReplaySource = Readonly<{
  directionId: DirectionId;
  aggregate: ProjectAggregate;
  snapshot: StorefrontSnapshot;
}>;

export type P10B19A09CPublicationRenderParitySource = Readonly<{
  directionId: DirectionId;
  aggregate: ProjectAggregate;
  historicalSnapshot: StorefrontSnapshot;
  publishedSnapshot: StorefrontSnapshot;
}>;

function rendererAuthorityFingerprint(): string {
  return `publish-renderers-${canonicalValueFingerprint(
    veskifyComponentCapabilityManifest.manifest.entries.map(
      ({ componentType, variants, renderer }) => ({
        componentType,
        variants: variants.map(({ id }) => id),
        renderer,
      }),
    ),
  )}`;
}

function representativeAggregate(snapshot: StorefrontSnapshot): ProjectAggregate {
  const { source } = createP10B16RepresentativeAuthority();
  const sourceAggregate = source.fixture.aggregate;
  const snapshots = sourceAggregate.snapshots.map((candidate) =>
    candidate.id === sourceAggregate.project.draftSnapshotId
      ? structuredClone(snapshot)
      : structuredClone(candidate),
  );
  return {
    project: structuredClone(sourceAggregate.project),
    catalogue: structuredClone(source.fixture.planningInput.catalogue),
    snapshots,
  };
}

function defaultRepresentativeSources(): readonly P10B19A09CHistoricalRenderReplaySource[] {
  return directions.map(([directionId]) => {
    const snapshot = createP10B16RepresentativeOutcome(directionId, 0).synthesis.materialization
      .snapshot;
    return {
      directionId,
      aggregate: representativeAggregate(snapshot),
      snapshot,
    };
  });
}

function pageAndRouteInventoryFingerprint(snapshot: StorefrontSnapshot): string {
  return canonicalStorefrontSiteMapFingerprint(snapshot);
}

function protectedFingerprints(aggregate: ProjectAggregate, snapshot: StorefrontSnapshot) {
  const approvedPresentations = [
    ...(snapshot.sharedFrame
      ? [
          snapshot.sharedFrame.announcement,
          snapshot.sharedFrame.header,
          snapshot.sharedFrame.footer,
        ]
          .filter((section): section is NonNullable<typeof section> => Boolean(section))
          .flatMap((section) =>
            (section.approvedAssetPresentations ?? []).map((presentation) => ({
              location: `shared-frame:${section.id}`,
              assetId: presentation.assetId,
              role: presentation.role,
              revision: presentation.revision,
              materialFingerprint: presentation.materialFingerprint,
            })),
          )
      : []),
    ...snapshot.pages.flatMap((page) =>
      page.sections.flatMap((section) =>
        (section.approvedAssetPresentations ?? []).map((presentation) => ({
          location: `page:${page.id}:section:${section.id}`,
          assetId: presentation.assetId,
          role: presentation.role,
          revision: presentation.revision,
          materialFingerprint: presentation.materialFingerprint,
        })),
      ),
    ),
    ...(snapshot.dynamicCommercePresentation
      ? [
          ...snapshot.dynamicCommercePresentation.collectionSearchArchetypes,
          ...snapshot.dynamicCommercePresentation.productDetailArchetypes,
        ].flatMap((archetype) =>
          archetype.componentPresentations.flatMap((presentation) =>
            (presentation.approvedAssetSelections ?? []).map((selection) => ({
              location: `archetype:${archetype.id}:slot:${presentation.slotId}`,
              assetId: selection.presentation.assetId,
              role: selection.presentation.role,
              revision: selection.presentation.revision,
              materialFingerprint: selection.presentation.materialFingerprint,
            })),
          ),
        )
      : []),
  ];
  return {
    commerce: canonicalValueFingerprint(aggregate.catalogue),
    productMedia: canonicalValueFingerprint(
      aggregate.catalogue.products.map(({ id, images }) => ({ id, images })),
    ),
    approvedPresentation: canonicalValueFingerprint(approvedPresentations),
  };
}

function resolvedSurface(
  surface: (typeof surfaces)[number],
  locale: (typeof locales)[number],
  aggregate: ProjectAggregate,
  snapshot: StorefrontSnapshot,
  renderTarget: RenderTarget,
) {
  const { source } = createP10B16RepresentativeAuthority();
  const authority = snapshot.dynamicCommercePresentation;
  const pathPrefix =
    renderTarget === "published"
      ? previewPathPrefix(aggregate.project.id, "published")
      : previewPathPrefix(aggregate.project.id, "history", snapshot.id);
  const commerceUtilityRuntime = {
    kind: "cart" as const,
    revision: "legacy-v1-historical-replay-empty-cart-v1",
    lines: [],
    actions: [],
  };
  const context = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: aggregate.project.primaryLocale,
    enabledLocales: aggregate.project.enabledLocales,
    catalogue: aggregate.catalogue,
    snapshot,
    evidenceReferences: source.approvedEvidenceReferences,
    pagePathPrefix: pathPrefix,
    pagePathSuffix: `?locale=${locale}`,
    renderTarget,
    ...(surface === "utility" ? { commerceUtilityRuntime } : {}),
  });
  if (surface === "home" || surface === "content-support" || surface === "utility") {
    const page =
      surface === "home"
        ? snapshot.pages.find(({ pageFamily }) => pageFamily?.familyId === "home")
        : surface === "content-support"
          ? snapshot.pages.find(({ pageFamily }) =>
              pageFamily ? contentFamilies.has(pageFamily.familyId) : false,
            )
          : snapshot.pages.find(({ pageFamily }) => pageFamily?.familyId === "cart");
    if (!page) throw new Error(`Missing representative ${surface} page.`);
    return {
      page,
      route: page.slug,
      archetype: null,
      routeExecutionAuthority: { page },
      node: renderStorefrontPage(page, context),
    };
  }
  if (!authority) throw new Error("Missing representative dynamic-commerce authority.");
  const kind = surface === "product-detail" ? "product" : surface;
  const route = authority.routeInventory.find(
    (candidate) =>
      candidate.kind === kind &&
      (surface !== "product-detail" || candidate.route === "/products/custom-halo-ring"),
  );
  if (!route) throw new Error(`Missing representative ${surface} route.`);
  if (surface === "collection" && route.kind === "collection") {
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue: aggregate.catalogue,
      routeId: route.id,
    });
    void renderStorefrontPage(resolved.page, context);
    const collection = aggregate.catalogue.collections.find(({ id }) => id === route.collectionId);
    if (!collection) throw new Error("Missing representative collection.");
    const presentation = createCatalogueStorefrontCommerceRouteAdapter().collection({
      aggregate,
      snapshot,
      page: resolved.page,
      collection,
    });
    if (!presentation) throw new Error("Missing current collection-route presentation.");
    return {
      page: resolved.page,
      route: route.route,
      archetype: resolved.archetype,
      routeExecutionAuthority: {
        instance: presentation.instance,
        projection: presentation.projection,
      },
      node: (
        <StorefrontCollectionCommerceRoute
          activeLocale={locale}
          context={context}
          onFilterIntent={() => undefined}
          onNavigateCollection={() => undefined}
          onNavigateProduct={() => undefined}
          onSortIntent={() => undefined}
          page={resolved.page}
          presentation={presentation}
          primaryLocale={aggregate.project.primaryLocale}
          target={renderTarget}
        />
      ),
    };
  }
  if (surface === "product-detail" && route.kind === "product") {
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue: aggregate.catalogue,
      routeId: route.id,
    });
    void renderStorefrontPage(resolved.page, context);
    const product = aggregate.catalogue.products.find(({ id }) => id === route.productId);
    if (!product) throw new Error("Missing representative product.");
    const presentation = createCatalogueStorefrontCommerceRouteAdapter().product({
      aggregate,
      snapshot,
      page: resolved.page,
      product,
    });
    if (!presentation) throw new Error("Missing current product-route presentation.");
    return {
      page: resolved.page,
      route: route.route,
      archetype: resolved.archetype,
      routeExecutionAuthority: {
        instance: presentation.instance,
        projection: presentation.projection,
        productContext: presentation.productContext,
      },
      node: (
        <StorefrontProductCommerceRoute
          activeLocale={locale}
          context={context}
          onPrimaryAction={() => undefined}
          page={resolved.page}
          presentation={presentation}
          primaryLocale={aggregate.project.primaryLocale}
          target={renderTarget}
        />
      ),
    };
  }
  if (surface === "search" && route.kind === "search") {
    const searchAuthority = createStandaloneStorefrontSearchAuthority({
      catalogue: aggregate.catalogue,
      primaryLocale: aggregate.project.primaryLocale,
      enabledLocales: aggregate.project.enabledLocales,
      productRoutes: authority.routeInventory.flatMap((candidate) =>
        candidate.kind === "product"
          ? [{ productId: candidate.productId, route: candidate.route }]
          : [],
      ),
    });
    const request = {
      contractVersion: STOREFRONT_SEARCH_REQUEST_CONTRACT_VERSION,
      rawQuery:
        aggregate.catalogue.products.find(({ sku }) => sku === "LUMO-STUD-01")?.sku ??
        (() => {
          throw new Error("The exact representative routed SKU is unavailable.");
        })(),
      locale,
      page: 1,
      pageSize: 24 as const,
      sort: "relevance" as const,
      filters: [],
    };
    const result = validateStorefrontSearchResultForRequest({
      result: createStandaloneCatalogueProductSearchAdapter({
        catalogue: aggregate.catalogue,
      }).search(request, searchAuthority),
      request,
      authority: searchAuthority,
    });
    const resolved = resolveDynamicCommerceRoutePage({
      snapshot,
      catalogue: aggregate.catalogue,
      routeId: route.id,
      searchBinding: {
        canonicalRevision: `canonical-commerce-${result.catalogueFingerprint}`,
        resultProductIds: result.productIds,
      },
    });
    const presentation = createCatalogueStorefrontCommerceRouteAdapter().search({
      aggregate,
      snapshot,
      page: resolved.page,
      results: result,
    });
    if (!presentation) throw new Error("Missing current search-route presentation.");
    return {
      page: resolved.page,
      route: route.route,
      archetype: resolved.archetype,
      routeExecutionAuthority: {
        instance: presentation.instance,
        projection: presentation.projection,
        search: presentation.search,
      },
      node: (
        <StorefrontSearchCommerceRoute
          activeLocale={locale}
          context={context}
          onContinueShopping={() => undefined}
          onNavigateProduct={() => undefined}
          page={resolved.page}
          presentation={presentation}
          primaryLocale={aggregate.project.primaryLocale}
          target={renderTarget}
        />
      ),
    };
  }
  throw new Error(`Unsupported representative ${surface} route.`);
}

function textFingerprint(value: string | null): string {
  return canonicalValueFingerprint((value ?? "").replace(/\s+/gu, " ").trim());
}

function accessibleName(element: Element, root: Element): string | null {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    return labelledBy
      .split(/\s+/u)
      .map((id) => root.querySelector(`#${CSS.escape(id)}`)?.textContent ?? "")
      .join(" ");
  }
  return element.getAttribute("aria-label") ?? element.textContent;
}

async function renderObservation(
  directionId: (typeof directions)[number][0],
  aliasId: LegacyV1CoordinatedDirectionReplayAliasId,
  surface: (typeof surfaces)[number],
  locale: (typeof locales)[number],
  aggregate: ProjectAggregate,
  snapshot: StorefrontSnapshot,
  renderTarget: RenderTarget,
) {
  const resolved = resolvedSurface(surface, locale, aggregate, snapshot, renderTarget);
  const view = render(<>{resolved.node}</>);
  const frameProfileId = snapshot.sharedFrame?.profileId;
  if (!frameProfileId) throw new Error("Missing representative shared frame.");
  const surfaceSelector =
    surface === "home"
      ? `main#storefront-main-content > [data-component][data-variant][data-render-target="${renderTarget}"]`
      : surface === "collection"
        ? `[data-component="dynamicCollectionCommerce"][data-render-target="${renderTarget}"][data-search-context="none"]`
        : surface === "search"
          ? `[data-component="dynamicCollectionCommerce"][data-render-target="${renderTarget}"][data-search-context="transient-canonical-results"]`
          : surface === "product-detail"
            ? `[data-component="dynamicProductDetail"][data-render-target="${renderTarget}"][data-variant]`
            : surface === "content-support"
              ? `[data-component="contentSupport"][data-render-target="${renderTarget}"][data-page-family][data-variant]`
              : '[data-utility-state="cart-empty"]';
  await waitFor(() => {
    expect(
      view.container.querySelector(
        `[data-frame-region="header"][data-frame-profile="${frameProfileId}"]`,
      ),
    ).not.toBeNull();
    expect(
      view.container.querySelector(
        `[data-frame-region="footer"][data-frame-profile="${frameProfileId}"]`,
      ),
    ).not.toBeNull();
    expect(view.container.querySelector(surfaceSelector)).not.toBeNull();
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    if (surface === "product-detail") {
      expect(
        view.container.querySelector(
          '[data-component="dynamicProductDetail"][data-resolution-state="loading"]',
        ),
      ).toBeNull();
    }
  });
  const document = view.container;
  const protectedAuthority = protectedFingerprints(aggregate, snapshot);
  const projection = {
    directionId,
    aliasId,
    surface,
    route: resolved.route,
    locale,
    renderTarget,
    page: {
      id: resolved.page.id,
      familyId: resolved.page.pageFamily?.familyId ?? null,
      familyVersion: resolved.page.pageFamily?.familyVersion ?? null,
      profileId: resolved.page.pageFamily?.profileId ?? null,
      profileVersion: resolved.page.pageFamily?.profileVersion ?? null,
      components: resolved.page.sections.map(({ component, variant, visible }) => ({
        component,
        variant,
        visible,
      })),
    },
    sharedFrame: snapshot.sharedFrame
      ? {
          profileId: snapshot.sharedFrame.profileId,
          profileVersion: snapshot.sharedFrame.profileVersion,
          authorityFingerprint: snapshot.sharedFrame.authorityFingerprint,
        }
      : null,
    archetype: resolved.archetype
      ? {
          id: resolved.archetype.id,
          version: resolved.archetype.archetypeVersion,
          profile: resolved.archetype.profile,
          components: resolved.archetype.componentPresentations.map(
            ({ component, variant, visible, anatomyId }) => ({
              component,
              variant,
              visible,
              anatomyId,
            }),
          ),
        }
      : null,
    routeExecutionAuthorityFingerprint: canonicalValueFingerprint(resolved.routeExecutionAuthority),
    rendered: {
      frameProfiles: [...document.querySelectorAll("[data-frame-profile]")].map((element) =>
        element.getAttribute("data-frame-profile"),
      ),
      renderTargets: [...document.querySelectorAll("[data-render-target]")].map((element) =>
        element.getAttribute("data-render-target"),
      ),
      componentVariantSequence: [...document.querySelectorAll("[data-component]")]
        .filter((element) => !element.parentElement?.closest("[data-component]"))
        .map((element) => ({
          component: element.getAttribute("data-component"),
          variant: element.getAttribute("data-variant"),
        })),
      headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((element) => ({
        level: element.tagName.toLocaleLowerCase(),
        accessibleNameFingerprint: textFingerprint(accessibleName(element, document)),
      })),
      actions: [...document.querySelectorAll("a,button")].map((element) => ({
        kind: element.tagName.toLocaleLowerCase(),
        accessibleNameFingerprint: textFingerprint(accessibleName(element, document)),
        href: element.getAttribute("href"),
        disabled: element.hasAttribute("disabled"),
      })),
      internalLinkTargets: [...document.querySelectorAll("a[href]")]
        .map((element) => element.getAttribute("href"))
        .filter((href): href is string => Boolean(href?.startsWith("/"))),
      commerceIdentities: [
        ...document.querySelectorAll("[data-product-id],[data-collection-id]"),
      ].map((element) => ({
        productId: element.getAttribute("data-product-id"),
        collectionId: element.getAttribute("data-collection-id"),
      })),
      media: [...document.querySelectorAll("img")].map((element) => ({
        sourceFingerprint: textFingerprint(element.getAttribute("src")),
        alternativeFingerprint: textFingerprint(element.getAttribute("alt")),
        role: element.closest("[data-asset-role]")?.getAttribute("data-asset-role") ?? null,
        revision:
          element.closest("[data-asset-revision]")?.getAttribute("data-asset-revision") ?? null,
      })),
    },
    protectedAuthority,
  };
  const observation = {
    surface,
    route: resolved.route,
    locale,
    renderTarget,
    pageFamilyId: resolved.page.pageFamily?.familyId ?? null,
    pageProfileId: resolved.page.pageFamily?.profileId ?? null,
    sharedFrameProfileId: snapshot.sharedFrame?.profileId ?? null,
    observationFingerprint: canonicalValueFingerprint(projection),
  };
  cleanup();
  return { observation, projection };
}

type RenderProjection = Awaited<ReturnType<typeof renderObservation>>["projection"];

function targetPathPrefix(
  aggregate: ProjectAggregate,
  snapshot: StorefrontSnapshot,
  renderTarget: RenderTarget,
): string {
  return renderTarget === "published"
    ? previewPathPrefix(aggregate.project.id, "published")
    : previewPathPrefix(aggregate.project.id, "history", snapshot.id);
}

function normalizeTargetSpecificPath(
  value: string | null,
  pathPrefix: string,
  pathSuffix: string,
): string | null {
  if (value === null || !value.startsWith(pathPrefix)) return value;
  let normalized = value.slice(pathPrefix.length);
  if (normalized.endsWith(pathSuffix)) {
    normalized = normalized.slice(0, -pathSuffix.length);
  }
  return normalized === "" ? "/" : normalized;
}

function normalizeRenderProjection({
  projection,
  aggregate,
  snapshot,
}: {
  projection: RenderProjection;
  aggregate: ProjectAggregate;
  snapshot: StorefrontSnapshot;
}) {
  const pathPrefix = targetPathPrefix(aggregate, snapshot, projection.renderTarget);
  const pathSuffix = `?locale=${projection.locale}`;
  const { renderTarget: _renderTarget, rendered, ...sharedProjection } = projection;
  const { renderTargets: _renderTargets, ...sharedRendered } = rendered;
  void _renderTarget;
  void _renderTargets;
  return {
    ...sharedProjection,
    rendered: {
      ...sharedRendered,
      actions: rendered.actions.map((action) => ({
        ...action,
        href: normalizeTargetSpecificPath(action.href, pathPrefix, pathSuffix),
      })),
      internalLinkTargets: rendered.internalLinkTargets.map((href) =>
        normalizeTargetSpecificPath(href, pathPrefix, pathSuffix),
      ),
    },
  };
}

export async function createP10B19A09CHistoricalRenderReplayEvidence(
  sources: readonly P10B19A09CHistoricalRenderReplaySource[] = defaultRepresentativeSources(),
) {
  const currentRendererAuthorityFingerprint = rendererAuthorityFingerprint();
  const representatives = [];
  let snapshotMutations = 0;
  let catalogueMutations = 0;

  for (const [directionId, aliasId] of directions) {
    const matchingSources = sources.filter((source) => source.directionId === directionId);
    if (matchingSources.length !== 1) {
      throw new Error(`Expected one exact ${directionId} historical replay source.`);
    }
    const source = matchingSources[0];
    const outcome = createP10B16RepresentativeOutcome(directionId, 0);
    const sourceSnapshot = source.snapshot;
    const sourceCatalogue = source.aggregate.catalogue;
    const sourceSnapshotBefore = canonicalValueString(sourceSnapshot);
    const sourceCatalogueBefore = canonicalValueString(sourceCatalogue);
    const replayReference = createLegacyV1StorefrontReplayReference({
      aliasId,
      sourceSelection: outcome.narrowing,
    });
    const readResult = readLegacyV1HistoricalSnapshot({
      snapshot: sourceSnapshot,
      catalogue: sourceCatalogue,
      replayReference,
    });
    const snapshot = readResult.snapshot as StorefrontSnapshot;
    validateCurrentDynamicCommercePresentationAuthority(snapshot);
    const aggregate = source.aggregate;
    const dynamic = snapshot.dynamicCommercePresentation;
    if (!snapshot.sharedFrame || !dynamic) throw new Error("Incomplete v1 representative.");
    const home = snapshot.pages.find(({ pageFamily }) => pageFamily?.familyId === "home");
    const collectionRoute = dynamic.routeInventory.find(({ kind }) => kind === "collection");
    const collectionMapping = collectionRoute
      ? dynamic.collectionRouteMappings.find(({ routeId }) => routeId === collectionRoute.id)
      : undefined;
    const collection = collectionMapping
      ? dynamic.collectionSearchArchetypes.find(({ id }) => id === collectionMapping.archetypeId)
      : undefined;
    const search = dynamic.collectionSearchArchetypes.find(
      ({ id }) => id === dynamic.searchArchetypeId,
    );
    const pdpProfiles = [
      ...new Set(
        dynamic.productTypeMappings.map(
          ({ archetypeId }) =>
            dynamic.productDetailArchetypes.find(({ id }) => id === archetypeId)?.profile.profileId,
        ),
      ),
    ].filter((profileId): profileId is string => Boolean(profileId));
    if (!home?.pageFamily || !collection || !search || pdpProfiles.length !== 1) {
      throw new Error("Representative v1 profile authority is incomplete or ambiguous.");
    }
    const protectedAuthority = protectedFingerprints(aggregate, snapshot);
    const renderObservations = [];
    for (const surface of surfaces) {
      for (const locale of locales) {
        const rendered = await renderObservation(
          directionId,
          aliasId,
          surface,
          locale,
          aggregate,
          snapshot,
          "published",
        );
        renderObservations.push(rendered.observation);
      }
    }
    representatives.push({
      directionId,
      aliasId,
      replayReferenceFingerprint: replayReference.replayFingerprint,
      sourceSnapshotId: snapshot.id,
      sourceSnapshotRevision: snapshot.revision,
      canonicalSourceSnapshotFingerprint: canonicalStorefrontContentFingerprint(snapshot),
      sharedFrameProfileId: snapshot.sharedFrame.profileId,
      homepageProfileId: home.pageFamily.profileId,
      collectionProfileId: collection.profile.profileId,
      searchProfileId: search.profile.profileId,
      pdpProfileId: pdpProfiles[0],
      pageAndDynamicRouteInventoryFingerprint: pageAndRouteInventoryFingerprint(snapshot),
      canonicalCommerceFingerprint: protectedAuthority.commerce,
      canonicalProductMediaFingerprint: protectedAuthority.productMedia,
      canonicalApprovedPresentationFingerprint: protectedAuthority.approvedPresentation,
      currentRendererAuthorityFingerprint,
      renderObservations,
    });
    snapshotMutations += canonicalValueString(sourceSnapshot) === sourceSnapshotBefore ? 0 : 1;
    catalogueMutations += canonicalValueString(sourceCatalogue) === sourceCatalogueBefore ? 0 : 1;
  }

  return {
    baseCommit: P10B19A09C_BASE_COMMIT,
    rendererAuthorityFingerprint: currentRendererAuthorityFingerprint,
    representatives,
    renderObservationCount: representatives.reduce(
      (count, representative) => count + representative.renderObservations.length,
      0,
    ),
    snapshotMutations,
    catalogueMutations,
  };
}

export async function createP10B19A09CPublicationRenderParityEvidence(
  sources: readonly P10B19A09CPublicationRenderParitySource[],
) {
  const acceptedPreviewEvidence = await createP10B19A09BHistoricalRenderReplayEvidence(
    sources.map(({ directionId, aggregate, historicalSnapshot }) => ({
      directionId,
      aggregate,
      snapshot: historicalSnapshot,
    })),
  );
  const representatives = [];
  let sourceAggregateMutations = 0;
  let historicalSnapshotMutations = 0;
  let publishedSnapshotMutations = 0;

  for (const [directionId, aliasId] of directions) {
    const matchingSources = sources.filter((source) => source.directionId === directionId);
    if (matchingSources.length !== 1) {
      throw new Error(`Expected one exact ${directionId} publication parity source.`);
    }
    const source = matchingSources[0];
    const acceptedRepresentative = acceptedPreviewEvidence.representatives.find(
      (representative) => representative.directionId === directionId,
    );
    if (!acceptedRepresentative) {
      throw new Error(`Missing accepted A-09B preview evidence for ${directionId}.`);
    }
    validateCurrentDynamicCommercePresentationAuthority(source.historicalSnapshot);
    validateCurrentDynamicCommercePresentationAuthority(source.publishedSnapshot);
    const aggregateBefore = canonicalValueString(source.aggregate);
    const historicalBefore = canonicalValueString(source.historicalSnapshot);
    const publishedBefore = canonicalValueString(source.publishedSnapshot);
    const parityObservations = [];
    let previewCompactObservationsMatchingA09B = 0;
    let normalizedStructuralMatches = 0;
    const publishedProtectedAuthority = protectedFingerprints(
      source.aggregate,
      source.publishedSnapshot,
    );

    for (const surface of surfaces) {
      for (const locale of locales) {
        const preview = await renderObservation(
          directionId,
          aliasId,
          surface,
          locale,
          source.aggregate,
          source.historicalSnapshot,
          "preview",
        );
        const published = await renderObservation(
          directionId,
          aliasId,
          surface,
          locale,
          source.aggregate,
          source.publishedSnapshot,
          "published",
        );
        const acceptedPreview = acceptedRepresentative.renderObservations.find(
          (observation) => observation.surface === surface && observation.locale === locale,
        );
        if (!acceptedPreview) {
          throw new Error(`Missing accepted A-09B ${directionId}/${surface}/${locale} evidence.`);
        }
        const previewMatchesAccepted =
          canonicalValueString(preview.observation) === canonicalValueString(acceptedPreview);
        previewCompactObservationsMatchingA09B += previewMatchesAccepted ? 1 : 0;
        const previewNormalizedAuthority = normalizeRenderProjection({
          projection: preview.projection,
          aggregate: source.aggregate,
          snapshot: source.historicalSnapshot,
        });
        const publishedNormalizedAuthority = normalizeRenderProjection({
          projection: published.projection,
          aggregate: source.aggregate,
          snapshot: source.publishedSnapshot,
        });
        const structurallyEquivalent =
          canonicalValueString(previewNormalizedAuthority) ===
          canonicalValueString(publishedNormalizedAuthority);
        normalizedStructuralMatches += structurallyEquivalent ? 1 : 0;
        parityObservations.push({
          surface,
          locale,
          previewObservation: preview.observation,
          acceptedA09BPreviewObservation: acceptedPreview,
          publishedObservation: published.observation,
          previewMatchesAcceptedA09B: previewMatchesAccepted,
          previewNormalizedAuthority,
          publishedNormalizedAuthority,
          previewNormalizedFingerprint: canonicalValueFingerprint(previewNormalizedAuthority),
          publishedNormalizedFingerprint: canonicalValueFingerprint(publishedNormalizedAuthority),
          structurallyEquivalent,
        });
      }
    }

    sourceAggregateMutations += canonicalValueString(source.aggregate) === aggregateBefore ? 0 : 1;
    historicalSnapshotMutations +=
      canonicalValueString(source.historicalSnapshot) === historicalBefore ? 0 : 1;
    publishedSnapshotMutations +=
      canonicalValueString(source.publishedSnapshot) === publishedBefore ? 0 : 1;
    representatives.push({
      directionId,
      aliasId,
      acceptedA09BPreviewRendererAuthorityFingerprint:
        acceptedRepresentative.currentRendererAuthorityFingerprint,
      currentRendererAuthorityFingerprint: rendererAuthorityFingerprint(),
      pageAndDynamicRouteInventoryFingerprint: pageAndRouteInventoryFingerprint(
        source.publishedSnapshot,
      ),
      canonicalCommerceFingerprint: publishedProtectedAuthority.commerce,
      canonicalProductMediaFingerprint: publishedProtectedAuthority.productMedia,
      canonicalApprovedPresentationFingerprint: publishedProtectedAuthority.approvedPresentation,
      previewCompactObservationsMatchingA09B,
      normalizedStructuralMatches,
      parityObservations,
    });
  }

  return {
    representatives,
    observationCount: representatives.reduce(
      (count, representative) => count + representative.parityObservations.length,
      0,
    ),
    previewCompactObservationsMatchingA09B: representatives.reduce(
      (count, representative) => count + representative.previewCompactObservationsMatchingA09B,
      0,
    ),
    normalizedStructuralMatches: representatives.reduce(
      (count, representative) => count + representative.normalizedStructuralMatches,
      0,
    ),
    sourceAggregateMutations,
    historicalSnapshotMutations,
    publishedSnapshotMutations,
    acceptedA09BPreviewEvidence: acceptedPreviewEvidence,
  };
}
