"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  buildStorefrontSearchUrl,
  StorefrontSearchError,
  validateStorefrontSearchResultForRequest,
  type StorefrontProductSearchPort,
  type StorefrontSearchRequestV1,
} from "@/application/storefront-search";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import { createStorefrontRenderContext, type StorefrontRenderContext } from "@/components/registry";
import { StorefrontSearchCommerceRoute } from "@/components/storefront/storefront-commerce-route";
import type { ProductNavigationIntent } from "@/components/storefront/dynamic-collection-commerce";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import { createBrowserProjectRepository, ProjectNotFoundError } from "@/services/storage";
import {
  createCatalogueStorefrontCommerceRouteAdapter,
  type StorefrontSearchCommerceRouteAdapter,
  type StorefrontSearchCommerceRoutePresentation,
} from "@/integrations/storefront-commerce-routes";
import {
  createStandaloneCatalogueProductSearchAdapter,
  createStandaloneStorefrontSearchAuthority,
} from "@/integrations/storefront-search";
import { loadP905bLocalDemoPublishedProjection } from "@/integrations/ai/p9-05b-local-demo-client";
import {
  previewLabel,
  previewNavigationSuffix,
  previewPathPrefix,
  selectedSnapshotId,
  type P10B16P04UtilityContext,
  type SnapshotKind,
} from "../preview-mode";
import { HistoricalPreviewActions } from "../historical-preview-actions";
import {
  parseStorefrontSearchRouteRequest,
  type StorefrontSearchRouteParameters,
} from "./search-route-parameters";

type RepositoryFactory = () => ProjectRepository;
type SearchPortFactory = (aggregate: ProjectAggregate) => StorefrontProductSearchPort;
type Snapshot = ProjectAggregate["snapshots"][number];
type SearchPage = Snapshot["pages"][number];
type RouteRenderTarget = "preview" | "published";

type LoadState =
  | { status: "loading" }
  | {
      status:
        | "notFound"
        | "missingDraft"
        | "invalidRequest"
        | "searchUnavailable"
        | "failure"
        | "validationFailure";
    }
  | {
      status: "success";
      aggregate: ProjectAggregate;
      draft: Snapshot;
      page: SearchPage;
      request: StorefrontSearchRequestV1;
      presentation: StorefrontSearchCommerceRoutePresentation;
      evidenceReferences: NonNullable<StorefrontRenderContext["evidenceReferences"]>;
    };

const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();
const defaultSearchPortFactory: SearchPortFactory = ({ catalogue }) =>
  createStandaloneCatalogueProductSearchAdapter({ catalogue });
const defaultCommerceAdapter: StorefrontSearchCommerceRouteAdapter =
  createCatalogueStorefrontCommerceRouteAdapter();
const emptyEvidenceReferences: NonNullable<StorefrontRenderContext["evidenceReferences"]> = [];

const routeCopy = {
  en: {
    loadingTitle: "Loading search",
    loadingMessage: "Searching the current storefront catalogue…",
    notFoundTitle: "Project not found",
    notFoundMessage: "We could not find this saved storefront on this device.",
    missingTitle: "Storefront unavailable",
    missingMessage: "This project does not currently have the requested storefront version.",
    invalidTitle: "Search could not be used",
    invalidMessage: "Check the search query and try again. Your storefront has not been changed.",
    unavailableTitle: "Search unavailable",
    unavailableMessage: "Search is not available for this storefront version.",
    validationTitle: "Search could not be displayed",
    validationMessage:
      "The current search presentation could not be shown safely. Nothing was changed.",
    failureTitle: "Search could not be loaded",
    failureMessage: "We could not open the saved project. Your storefront has not been changed.",
    storefrontHome: "Storefront home",
    currentLocale: "Current locale",
  },
  fi: {
    loadingTitle: "Hakua ladataan",
    loadingMessage: "Haetaan nykyisestä verkkokaupan valikoimasta…",
    notFoundTitle: "Projektia ei löytynyt",
    notFoundMessage: "Tallennettua verkkokauppaa ei löytynyt tältä laitteelta.",
    missingTitle: "Verkkokauppa ei ole saatavilla",
    missingMessage: "Projektissa ei ole pyydettyä verkkokauppaversiota.",
    invalidTitle: "Hakua ei voitu käyttää",
    invalidMessage: "Tarkista hakukysely ja yritä uudelleen. Verkkokauppaa ei muutettu.",
    unavailableTitle: "Haku ei ole saatavilla",
    unavailableMessage: "Haku ei ole käytettävissä tässä verkkokauppaversiossa.",
    validationTitle: "Hakua ei voitu näyttää",
    validationMessage: "Nykyistä hakunäkymää ei voitu näyttää turvallisesti. Mitään ei muutettu.",
    failureTitle: "Hakua ei voitu ladata",
    failureMessage: "Tallennettua projektia ei voitu avata. Verkkokauppaa ei muutettu.",
    storefrontHome: "Verkkokaupan etusivu",
    currentLocale: "Nykyinen kieli",
  },
} as const;

function localizedPreviewLabel(snapshotKind: SnapshotKind, locale: "en" | "fi") {
  if (locale === "en") return previewLabel(snapshotKind);
  if (snapshotKind === "published") return "Julkaistu verkkokauppa";
  if (snapshotKind === "history") return "Aiempi versio";
  return "Luonnoksen esikatselu";
}

function StatusPanel({
  title,
  message,
  retry,
  snapshotKind,
  locale,
}: {
  title: string;
  message: string;
  retry?: () => void;
  snapshotKind: SnapshotKind;
  locale: "en" | "fi";
}) {
  return (
    <main className="project-state">
      <section aria-live="polite" className="project-state__panel">
        <p className="project-state__eyebrow">{localizedPreviewLabel(snapshotKind, locale)}</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {retry ? (
          <button className="project-retry" onClick={retry} type="button">
            {locale === "fi" ? "Yritä uudelleen" : "Try again"}
          </button>
        ) : null}
        <Link href="/">{locale === "fi" ? "Palaa Veskon etusivulle" : "Return to Vesko home"}</Link>
      </section>
    </main>
  );
}

export function SearchPreviewClient({
  projectId,
  searchParameters,
  repositoryFactory = defaultRepositoryFactory,
  searchPortFactory = defaultSearchPortFactory,
  commerceAdapter = defaultCommerceAdapter,
  snapshotKind = "draft",
  renderTarget,
  historicalSnapshotId,
  publishedSessionId,
  initialAggregate,
  proposalCandidateFingerprint,
  p10b16p04UtilityContext,
  initialEvidenceReferences = emptyEvidenceReferences,
  onNavigateProduct,
  onContinueShopping,
}: {
  projectId: string;
  searchParameters: StorefrontSearchRouteParameters;
  repositoryFactory?: RepositoryFactory;
  searchPortFactory?: SearchPortFactory;
  commerceAdapter?: StorefrontSearchCommerceRouteAdapter;
  snapshotKind?: SnapshotKind;
  renderTarget?: RouteRenderTarget;
  historicalSnapshotId?: string;
  publishedSessionId?: string;
  initialAggregate?: ProjectAggregate;
  proposalCandidateFingerprint?: string;
  p10b16p04UtilityContext?: P10B16P04UtilityContext;
  initialEvidenceReferences?: NonNullable<StorefrontRenderContext["evidenceReferences"]>;
  onNavigateProduct?: (intent: ProductNavigationIntent) => void;
  onContinueShopping?: () => void;
}) {
  const effectiveRenderTarget =
    renderTarget ?? (snapshotKind === "published" ? "published" : "preview");
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const requestedLocale = searchParameters.locale === "fi" ? "fi" : "en";
  const copy = routeCopy[requestedLocale];

  useEffect(() => {
    let cancelled = false;
    const aggregateSource = initialAggregate
      ? Promise.resolve({
          aggregate: structuredClone(initialAggregate),
          evidenceReferences: structuredClone(initialEvidenceReferences),
        })
      : snapshotKind === "published" && publishedSessionId
        ? loadP905bLocalDemoPublishedProjection({ projectId, sessionId: publishedSessionId }).then(
            ({ evidenceReferences, ...aggregate }) => ({ aggregate, evidenceReferences }),
          )
        : repository.current!.get(projectId).then((aggregate) => ({
            aggregate,
            evidenceReferences: structuredClone(initialEvidenceReferences),
          }));

    void aggregateSource
      .then(({ aggregate, evidenceReferences }) => {
        if (cancelled) return;
        const draft = aggregate.snapshots.find(
          (snapshot) =>
            snapshot.id ===
            selectedSnapshotId(aggregate.project, snapshotKind, historicalSnapshotId),
        );
        if (!draft) return setState({ status: "missingDraft" });
        const request = parseStorefrontSearchRouteRequest({
          parameters: searchParameters,
          primaryLocale: aggregate.project.primaryLocale,
          enabledLocales: aggregate.project.enabledLocales,
        });
        if (!request) return setState({ status: "invalidRequest" });
        try {
          const authority = draft.dynamicCommercePresentation;
          const searchRoute = authority?.routeInventory.find((route) => route.kind === "search");
          if (!authority || !searchRoute) return setState({ status: "searchUnavailable" });
          const searchAuthority = createStandaloneStorefrontSearchAuthority({
            catalogue: aggregate.catalogue,
            primaryLocale: aggregate.project.primaryLocale,
            enabledLocales: aggregate.project.enabledLocales,
            productRoutes: authority.routeInventory.flatMap((route) =>
              route.kind === "product" ? [{ productId: route.productId, route: route.route }] : [],
            ),
          });
          const results = validateStorefrontSearchResultForRequest({
            result: searchPortFactory(aggregate).search(request, searchAuthority),
            request,
            authority: searchAuthority,
          });
          const page = resolveDynamicCommerceRoutePage({
            snapshot: draft,
            catalogue: aggregate.catalogue,
            routeId: searchRoute.id,
            searchBinding: {
              canonicalRevision: `canonical-commerce-${results.catalogueFingerprint}`,
              resultProductIds: results.productIds,
            },
          }).page;
          const presentation = commerceAdapter.search({
            aggregate,
            snapshot: draft,
            page,
            results,
            evidenceReferences,
          });
          if (!presentation) return setState({ status: "validationFailure" });
          setState({
            status: "success",
            aggregate,
            draft,
            page,
            request,
            presentation,
            evidenceReferences,
          });
          return;
        } catch (error) {
          return setState({
            status:
              error instanceof StorefrontSearchError &&
              (error.code === "invalid-request" || error.code === "too-many-terms")
                ? "invalidRequest"
                : "validationFailure",
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: error instanceof ProjectNotFoundError ? "notFound" : "failure" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    commerceAdapter,
    historicalSnapshotId,
    initialAggregate,
    initialEvidenceReferences,
    projectId,
    publishedSessionId,
    searchParameters,
    searchPortFactory,
    snapshotKind,
  ]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  if (state.status === "loading") {
    return (
      <StatusPanel
        message={copy.loadingMessage}
        locale={requestedLocale}
        snapshotKind={snapshotKind}
        title={copy.loadingTitle}
      />
    );
  }
  if (state.status === "notFound") {
    return (
      <StatusPanel
        message={copy.notFoundMessage}
        locale={requestedLocale}
        snapshotKind={snapshotKind}
        title={copy.notFoundTitle}
      />
    );
  }
  if (state.status === "missingDraft") {
    return (
      <StatusPanel
        message={copy.missingMessage}
        locale={requestedLocale}
        retry={retry}
        snapshotKind={snapshotKind}
        title={copy.missingTitle}
      />
    );
  }
  if (state.status === "invalidRequest") {
    return (
      <StatusPanel
        message={copy.invalidMessage}
        locale={requestedLocale}
        snapshotKind={snapshotKind}
        title={copy.invalidTitle}
      />
    );
  }
  if (state.status === "searchUnavailable") {
    return (
      <StatusPanel
        message={copy.unavailableMessage}
        locale={requestedLocale}
        snapshotKind={snapshotKind}
        title={copy.unavailableTitle}
      />
    );
  }
  if (state.status === "validationFailure") {
    return (
      <StatusPanel
        message={copy.validationMessage}
        locale={requestedLocale}
        retry={retry}
        snapshotKind={snapshotKind}
        title={copy.validationTitle}
      />
    );
  }
  if (state.status === "failure") {
    return (
      <StatusPanel
        message={copy.failureMessage}
        locale={requestedLocale}
        retry={retry}
        snapshotKind={snapshotKind}
        title={copy.failureTitle}
      />
    );
  }
  if (state.status !== "success") return null;

  const suffix = previewNavigationSuffix({
    publishedSessionId,
    proposalCandidateFingerprint,
    p10b16p04UtilityContext,
    locale: state.request.locale,
  });
  const pathPrefix = previewPathPrefix(projectId, snapshotKind, historicalSnapshotId);
  const context = createStorefrontRenderContext({
    activeLocale: state.request.locale,
    primaryLocale: state.aggregate.project.primaryLocale,
    enabledLocales: state.aggregate.project.enabledLocales,
    onLocaleChange(nextLocale) {
      const searchRoute = state.draft.dynamicCommercePresentation?.routeInventory.find(
        (route) => route.kind === "search",
      );
      if (!searchRoute) return;
      const routePath = `${pathPrefix}${searchRoute.route}${suffix}`;
      window.location.assign(
        buildStorefrontSearchUrl({
          routePath,
          rawQuery: state.request.rawQuery,
          locale: nextLocale,
          pageSize: state.request.pageSize,
          sort: state.request.sort,
          filters: state.request.filters,
        }),
      );
    },
    catalogue: state.aggregate.catalogue,
    snapshot: state.draft,
    evidenceReferences: state.evidenceReferences,
    pagePathPrefix: pathPrefix,
    pagePathSuffix: suffix,
    renderTarget: effectiveRenderTarget,
    searchQuery: state.request.rawQuery,
  });
  const style = brandSystemToCssVariables(state.draft.brandSystem) as CSSProperties;
  const navigateProduct =
    onNavigateProduct ??
    ((intent: ProductNavigationIntent) => {
      const route = state.draft.dynamicCommercePresentation?.routeInventory.find(
        (candidate) => candidate.kind === "product" && candidate.productId === intent.productId,
      );
      if (route) window.location.assign(`${pathPrefix}${route.route}${suffix}`);
    });
  const continueShopping =
    onContinueShopping ??
    (() => {
      if (context.homePath) window.location.assign(context.homePath);
    });

  return (
    <div className="project-preview" lang={state.request.locale} style={style}>
      <div className="project-preview__header">
        <div>
          <Link className="project-preview__back" href={`${pathPrefix}${suffix}`}>
            {routeCopy[state.request.locale].storefrontHome}
          </Link>
          <p className="project-preview__title">{state.aggregate.project.name}</p>
        </div>
        <div className="project-preview__status">
          <span>{localizedPreviewLabel(snapshotKind, state.request.locale)}</span>
          <span aria-live="polite">
            {routeCopy[state.request.locale].currentLocale}: {state.request.locale.toUpperCase()}
          </span>
        </div>
      </div>
      <HistoricalPreviewActions
        locale={state.request.locale}
        projectId={projectId}
        snapshotId={historicalSnapshotId}
        snapshotKind={snapshotKind}
      />
      <div
        aria-label={
          state.request.locale === "fi"
            ? `${localizedPreviewLabel(snapshotKind, "fi")} — verkkokaupan haku`
            : `${previewLabel(snapshotKind)} search storefront`
        }
        className="project-preview__storefront"
      >
        <StorefrontSearchCommerceRoute
          activeLocale={state.request.locale}
          context={context}
          onContinueShopping={continueShopping}
          onNavigateProduct={navigateProduct}
          page={state.page}
          presentation={state.presentation}
          primaryLocale={state.aggregate.project.primaryLocale}
          target={effectiveRenderTarget}
        />
      </div>
    </div>
  );
}
