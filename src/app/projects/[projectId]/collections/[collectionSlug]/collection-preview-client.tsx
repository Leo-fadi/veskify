"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  dynamicCommerceRouteForCollection,
  dynamicCommerceRouteForProduct,
  resolveDynamicCommerceRoutePage,
} from "@/application/dynamic-commerce-routes";
import {
  createCatalogueStorefrontCommerceRouteAdapter,
  type CollectionCommerceRoutePresentation,
  type StorefrontCommerceRouteAdapter,
} from "@/integrations/storefront-commerce-routes";
import { createStorefrontRenderContext } from "@/components/registry";
import {
  validateDynamicCollectionCommerceRoutePresentation,
  type CollectionFilterIntent,
  type CollectionNavigationIntent,
  type CollectionSortIntent,
  type ProductNavigationIntent,
} from "@/components/storefront/dynamic-collection-commerce";
import { StorefrontCollectionCommerceRoute } from "@/components/storefront/storefront-commerce-route";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { Locale } from "@/domain/shared";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import { createBrowserProjectRepository, ProjectNotFoundError } from "@/services/storage";
import { loadP905bLocalDemoPublishedProjection } from "@/integrations/ai/p9-05b-local-demo-client";
import {
  previewLabel,
  previewPathPrefix,
  selectedSnapshotId,
  type SnapshotKind,
} from "../../preview-mode";
import { HistoricalPreviewActions } from "../../historical-preview-actions";

type RepositoryFactory = () => ProjectRepository;
type Snapshot = ProjectAggregate["snapshots"][number];
type Page = Snapshot["pages"][number];
type RouteRenderTarget = "preview" | "published";

type LoadState =
  | { status: "loading" }
  | {
      status:
        | "notFound"
        | "missingDraft"
        | "collectionNotFound"
        | "missingPage"
        | "failure"
        | "validationFailure";
    }
  | {
      status: "success";
      aggregate: ProjectAggregate;
      draft: Snapshot;
      page: Page;
      commercePresentation: CollectionCommerceRoutePresentation | null;
    };

const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();
const defaultCommerceAdapter = createCatalogueStorefrontCommerceRouteAdapter();
const ignoreFilterIntent = () => undefined;
const ignoreSortIntent = () => undefined;

function StatusPanel({
  title,
  message,
  retry,
  snapshotKind,
}: {
  title: string;
  message: string;
  retry?: () => void;
  snapshotKind: SnapshotKind;
}) {
  return (
    <main className="project-state">
      <section aria-live="polite" className="project-state__panel">
        <p className="project-state__eyebrow">{previewLabel(snapshotKind)}</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {retry ? (
          <button className="project-retry" onClick={retry} type="button">
            Try again
          </button>
        ) : null}
        <Link href="/">Return to Vesko home</Link>
      </section>
    </main>
  );
}

export function CollectionPreviewClient({
  projectId,
  collectionSlug,
  repositoryFactory = defaultRepositoryFactory,
  snapshotKind = "draft",
  renderTarget,
  historicalSnapshotId,
  commerceAdapter = defaultCommerceAdapter,
  onNavigateProduct,
  onNavigateCollection,
  onFilterIntent = ignoreFilterIntent,
  onSortIntent = ignoreSortIntent,
  publishedSessionId,
}: {
  projectId: string;
  collectionSlug: string;
  repositoryFactory?: RepositoryFactory;
  snapshotKind?: SnapshotKind;
  /** Explicit route-render mode; snapshot selection remains independently governed by snapshotKind. */
  renderTarget?: RouteRenderTarget;
  historicalSnapshotId?: string;
  commerceAdapter?: StorefrontCommerceRouteAdapter;
  onNavigateProduct?: (intent: ProductNavigationIntent) => void;
  onNavigateCollection?: (intent: CollectionNavigationIntent) => void;
  onFilterIntent?: (intent: CollectionFilterIntent) => void;
  onSortIntent?: (intent: CollectionSortIntent) => void;
  publishedSessionId?: string;
}) {
  const effectiveRenderTarget =
    renderTarget ?? (snapshotKind === "published" ? "published" : "preview");
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeLocale, setActiveLocale] = useState<Locale>();

  useEffect(() => {
    let cancelled = false;
    (snapshotKind === "published" && publishedSessionId
      ? loadP905bLocalDemoPublishedProjection({ projectId, sessionId: publishedSessionId })
      : repository.current!.get(projectId)
    )
      .then((aggregate) => {
        if (cancelled) return;
        const draft = aggregate.snapshots.find(
          (snapshot) =>
            snapshot.id ===
            selectedSnapshotId(aggregate.project, snapshotKind, historicalSnapshotId),
        );
        if (!draft) return setState({ status: "missingDraft" });
        try {
          const route = `/collections/${collectionSlug}`;
          const dynamicRoute = draft.dynamicCommercePresentation?.routeInventory.find(
            (entry) => entry.kind === "collection" && entry.route === route,
          );
          const legacyCollection = draft.dynamicCommercePresentation
            ? undefined
            : aggregate.catalogue.collections.find(({ slug }) => slug === collectionSlug);
          if (!draft.dynamicCommercePresentation && !legacyCollection) {
            return setState({ status: "collectionNotFound" });
          }
          const page = draft.dynamicCommercePresentation
            ? dynamicRoute
              ? resolveDynamicCommerceRoutePage({
                  snapshot: draft,
                  catalogue: aggregate.catalogue,
                  routeId: dynamicRoute.id,
                }).page
              : undefined
            : draft.pages.find((item) => item.type === "collection" && item.slug === route);
          if (!page) return setState({ status: "missingPage" });
          const canonicalCollectionId =
            (dynamicRoute?.kind === "collection" ? dynamicRoute.collectionId : undefined) ??
            page.sections.find(
              (section) =>
                section.component === "dynamicCollectionCommerce" ||
                section.component === "collectionHeader",
            )?.content.collectionId;
          const collection = draft.dynamicCommercePresentation
            ? aggregate.catalogue.collections.find(({ id }) => id === canonicalCollectionId)
            : legacyCollection;
          if (!collection) return setState({ status: "collectionNotFound" });
          const context = createStorefrontRenderContext({
            activeLocale: aggregate.project.primaryLocale,
            primaryLocale: aggregate.project.primaryLocale,
            enabledLocales: aggregate.project.enabledLocales,
            catalogue: aggregate.catalogue,
            snapshot: draft,
            pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
            pagePathSuffix: publishedSessionId
              ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}`
              : "",
            renderTarget: effectiveRenderTarget,
          });
          void renderStorefrontPage(page, context);
          const commercePresentation = commerceAdapter.collection({
            aggregate,
            snapshot: draft,
            page,
            collection,
          });
          if (commercePresentation) {
            validateDynamicCollectionCommerceRoutePresentation(
              commercePresentation.instance,
              commercePresentation.projection,
            );
          }
          setActiveLocale(aggregate.project.primaryLocale);
          setState({ status: "success", aggregate, draft, page, commercePresentation });
          return;
        } catch {
          return setState({ status: "validationFailure" });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ status: error instanceof ProjectNotFoundError ? "notFound" : "failure" });
      });
    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    collectionSlug,
    commerceAdapter,
    historicalSnapshotId,
    projectId,
    effectiveRenderTarget,
    snapshotKind,
    publishedSessionId,
  ]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  if (state.status === "loading")
    return (
      <StatusPanel
        message="Preparing the saved storefront…"
        snapshotKind={snapshotKind}
        title="Loading the collection"
      />
    );
  if (state.status === "notFound")
    return (
      <StatusPanel
        title="Project not found"
        message="We could not find this saved storefront on this device."
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "missingDraft")
    return (
      <StatusPanel
        title="Draft unavailable"
        message="This project does not currently have a draft storefront to preview."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "collectionNotFound")
    return (
      <StatusPanel
        title="Collection not found"
        message="This collection is not available in the saved catalogue."
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "missingPage")
    return (
      <StatusPanel
        title="Collection page unavailable"
        message="The saved draft does not contain a page for this collection yet."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "validationFailure")
    return (
      <StatusPanel
        title="Collection could not be displayed"
        message="Some saved collection content needs attention before it can be shown safely."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "failure")
    return (
      <StatusPanel
        title="Collection could not be loaded"
        message="We could not open the saved project. Your draft has not been changed."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status !== "success") return null;

  const locale = activeLocale ?? state.aggregate.project.primaryLocale;
  const context = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: state.aggregate.project.primaryLocale,
    enabledLocales: state.aggregate.project.enabledLocales,
    onLocaleChange: setActiveLocale,
    catalogue: state.aggregate.catalogue,
    snapshot: state.draft,
    pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
    pagePathSuffix: publishedSessionId
      ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}`
      : "",
    renderTarget: effectiveRenderTarget,
  });
  const style = brandSystemToCssVariables(state.draft.brandSystem) as CSSProperties;
  const pathPrefix = previewPathPrefix(projectId, snapshotKind, historicalSnapshotId);
  const navigateProduct =
    onNavigateProduct ??
    ((intent: ProductNavigationIntent) => {
      const productRoute = state.draft.dynamicCommercePresentation
        ? dynamicCommerceRouteForProduct(state.draft, intent.productId)
        : state.draft.pages.find(
            (candidate) =>
              candidate.type === "product" &&
              candidate.sections.some(
                (section) =>
                  (section.component === "productInfo" ||
                    section.component === "dynamicProductDetail") &&
                  section.content.productId === intent.productId,
              ),
          )?.slug;
      if (productRoute)
        window.location.assign(
          `${pathPrefix}${productRoute}${
            publishedSessionId ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}` : ""
          }`,
        );
    });
  const navigateCollection =
    onNavigateCollection ??
    ((intent: CollectionNavigationIntent) => {
      const collectionRoute = state.draft.dynamicCommercePresentation
        ? dynamicCommerceRouteForCollection(state.draft, intent.collectionId)
        : state.draft.pages.find(
            (candidate) =>
              candidate.type === "collection" &&
              candidate.sections.some(
                (section) =>
                  (section.component === "collectionHeader" ||
                    section.component === "dynamicCollectionCommerce") &&
                  section.content.collectionId === intent.collectionId,
              ),
          )?.slug;
      if (collectionRoute)
        window.location.assign(
          `${pathPrefix}${collectionRoute}${
            publishedSessionId ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}` : ""
          }`,
        );
    });

  return (
    <div className="project-preview" lang={locale} style={style}>
      <div className="project-preview__header">
        <div>
          <Link
            className="project-preview__back"
            href={`${previewPathPrefix(projectId, snapshotKind, historicalSnapshotId)}${
              publishedSessionId ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}` : ""
            }`}
          >
            Storefront home
          </Link>
          <p className="project-preview__title">{state.aggregate.project.name}</p>
        </div>
        <div className="project-preview__status">
          <span>{previewLabel(snapshotKind)}</span>
          <span aria-live="polite">Current locale: {locale.toUpperCase()}</span>
        </div>
        <fieldset className="locale-control">
          <legend>Storefront language</legend>
          {state.aggregate.project.enabledLocales.map((enabledLocale) => (
            <label key={enabledLocale}>
              <input
                checked={locale === enabledLocale}
                name="collection-locale"
                onChange={() => setActiveLocale(enabledLocale)}
                type="radio"
                value={enabledLocale}
              />
              <span>{enabledLocale === "en" ? "English" : "Suomi"}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <HistoricalPreviewActions
        locale={locale}
        projectId={projectId}
        snapshotId={historicalSnapshotId}
        snapshotKind={snapshotKind}
      />
      <div
        aria-label={
          snapshotKind === "history"
            ? "Previous version collection storefront"
            : `${previewLabel(snapshotKind)} collection storefront`
        }
        className="project-preview__storefront"
      >
        {state.commercePresentation ? (
          <StorefrontCollectionCommerceRoute
            activeLocale={locale}
            context={context}
            onFilterIntent={onFilterIntent}
            onNavigateCollection={navigateCollection}
            onNavigateProduct={navigateProduct}
            onSortIntent={onSortIntent}
            page={state.page}
            presentation={state.commercePresentation}
            primaryLocale={state.aggregate.project.primaryLocale}
            target={effectiveRenderTarget}
          />
        ) : (
          renderStorefrontPage(state.page, context)
        )}
      </div>
    </div>
  );
}
