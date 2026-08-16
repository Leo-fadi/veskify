"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import { createStorefrontRenderContext, type StorefrontRenderContext } from "@/components/registry";
import {
  renderStorefrontPage,
  validateStorefrontHomepage,
} from "@/components/storefront/storefront-page";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { CommerceUtilityRuntimeState } from "@/domain/commerce-utility";
import type { Locale } from "@/domain/shared";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import { createBrowserProjectRepository, ProjectNotFoundError } from "@/services/storage";
import { loadP905bLocalDemoPublishedProjection } from "@/integrations/ai/p9-05b-local-demo-client";
import {
  previewLabel,
  previewNavigationSuffix,
  previewPathPrefix,
  selectedSnapshotId,
  type P10B16P04UtilityContext,
  type SnapshotKind,
} from "./preview-mode";
import { HistoricalPreviewActions } from "./historical-preview-actions";

type RepositoryFactory = () => ProjectRepository;

type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "missingDraft" }
  | { status: "missingPage" }
  | { status: "failure" }
  | { status: "validationFailure" }
  | {
      status: "success";
      aggregate: ProjectAggregate;
      draft: ProjectAggregate["snapshots"][number];
      page: ProjectAggregate["snapshots"][number]["pages"][number];
      evidenceReferences: NonNullable<StorefrontRenderContext["evidenceReferences"]>;
    };

const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();
const emptyEvidenceReferences: NonNullable<StorefrontRenderContext["evidenceReferences"]> = [];

function p10b16p04CartRuntime(
  aggregate: ProjectAggregate,
  context: "empty" | "populated" | undefined,
): CommerceUtilityRuntimeState | undefined {
  if (!context) return undefined;
  if (context === "empty") {
    return {
      kind: "cart",
      revision: "p10b16p04-cart-empty-v1",
      lines: [],
      actions: ["continue-shopping"],
    };
  }
  const product = aggregate.catalogue.products.find(
    (candidate) => candidate.id === "product_sisu_automatic_watch",
  );
  if (!product?.price) return undefined;
  return {
    kind: "cart",
    revision: "p10b16p04-cart-populated-v1",
    lines: [
      {
        lineId: "p10b16p04-cart-line-sisu",
        productId: product.id,
        quantity: 1,
        minimumQuantity: 1,
        maximumQuantity: 3,
        unitPrice: product.price,
        linePrice: product.price,
      },
    ],
    subtotal: product.price,
    total: product.price,
    actions: ["change-quantity", "remove-line", "continue-shopping"],
  };
}

function StatusPanel({
  title,
  message,
  retry,
  returnToStoreHref,
  snapshotKind,
}: {
  title: string;
  message: string;
  retry?: () => void;
  returnToStoreHref: string;
  snapshotKind: SnapshotKind;
}) {
  return (
    <main className="project-state" role="main">
      <section aria-live="polite" className="project-state__panel">
        <p className="project-state__eyebrow">{previewLabel(snapshotKind)}</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {retry ? (
          <button className="project-retry" onClick={retry} type="button">
            Try again
          </button>
        ) : null}
        <Link href={returnToStoreHref}>Return to store</Link>
      </section>
    </main>
  );
}

export function ProjectPreviewClient({
  projectId,
  repositoryFactory = defaultRepositoryFactory,
  snapshotKind = "draft",
  historicalSnapshotId,
  initialAggregate,
  initialEvidenceReferences = emptyEvidenceReferences,
  publishedSessionId,
  pageSlug = "/",
  proposalCandidateFingerprint,
  p10b16p04UtilityContext,
  initialLocale,
}: {
  projectId: string;
  repositoryFactory?: RepositoryFactory;
  snapshotKind?: SnapshotKind;
  historicalSnapshotId?: string;
  initialAggregate?: ProjectAggregate;
  initialEvidenceReferences?: NonNullable<StorefrontRenderContext["evidenceReferences"]>;
  publishedSessionId?: string;
  pageSlug?: string;
  proposalCandidateFingerprint?: string;
  p10b16p04UtilityContext?: P10B16P04UtilityContext;
  initialLocale?: Locale;
}) {
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeLocale, setActiveLocale] = useState<Locale | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    const aggregateSource = initialAggregate
      ? Promise.resolve({
          aggregate: initialAggregate,
          evidenceReferences: initialEvidenceReferences,
        })
      : snapshotKind === "published" && publishedSessionId
        ? loadP905bLocalDemoPublishedProjection({
            projectId,
            sessionId: publishedSessionId,
          }).then(({ evidenceReferences, ...aggregate }) => ({ aggregate, evidenceReferences }))
        : repository.current!.get(projectId).then((aggregate) => ({
            aggregate,
            evidenceReferences: structuredClone(initialEvidenceReferences),
          }));
    aggregateSource
      .then(({ aggregate, evidenceReferences }) => {
        if (cancelled) return;
        const draft = aggregate.snapshots.find(
          (snapshot) =>
            snapshot.id ===
            selectedSnapshotId(aggregate.project, snapshotKind, historicalSnapshotId),
        );
        if (!draft) {
          setState({ status: "missingDraft" });
          return;
        }
        try {
          const initialActiveLocale =
            initialLocale && aggregate.project.enabledLocales.includes(initialLocale)
              ? initialLocale
              : aggregate.project.primaryLocale;
          const initialQuerySuffix = previewNavigationSuffix({
            publishedSessionId,
            proposalCandidateFingerprint,
            p10b16p04UtilityContext,
            ...(initialLocale ? { locale: initialActiveLocale } : {}),
          });
          const dynamicRoute = draft.dynamicCommercePresentation?.routeInventory.find(
            (candidate) => candidate.route === pageSlug,
          );
          const isDynamicCommercePath =
            pageSlug === "/search" ||
            pageSlug.startsWith("/collections/") ||
            pageSlug.startsWith("/products/");
          const page = dynamicRoute
            ? resolveDynamicCommerceRoutePage({
                snapshot: draft,
                catalogue: aggregate.catalogue,
                routeId: dynamicRoute.id,
              }).page
            : draft.dynamicCommercePresentation && isDynamicCommercePath
              ? undefined
              : draft.pages.find((candidate) => candidate.slug === pageSlug);
          if (!page) {
            setState({ status: "missingPage" });
            return;
          }
          if (page.type === "home") validateStorefrontHomepage(page);
          const context = createStorefrontRenderContext({
            activeLocale: initialActiveLocale,
            primaryLocale: aggregate.project.primaryLocale,
            enabledLocales: aggregate.project.enabledLocales,
            catalogue: aggregate.catalogue,
            snapshot: draft,
            evidenceReferences,
            pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
            pagePathSuffix: initialQuerySuffix,
            renderTarget: snapshotKind === "published" ? "published" : "preview",
            commerceUtilityRuntime: p10b16p04CartRuntime(aggregate, p10b16p04UtilityContext),
            ...(p10b16p04UtilityContext ? { onCommerceUtilityIntent: () => undefined } : {}),
          });
          void renderStorefrontPage(page, context);
          setActiveLocale(initialActiveLocale);
          setState({ status: "success", aggregate, draft, page, evidenceReferences });
        } catch {
          setState({ status: "validationFailure" });
          return;
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: error instanceof ProjectNotFoundError ? "notFound" : "failure",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    historicalSnapshotId,
    initialAggregate,
    initialEvidenceReferences,
    initialLocale,
    pageSlug,
    projectId,
    publishedSessionId,
    proposalCandidateFingerprint,
    p10b16p04UtilityContext,
    snapshotKind,
  ]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  };
  const returnToStoreHref = `/projects/${projectId}`;

  if (state.status === "loading") {
    return (
      <StatusPanel
        message="Preparing the saved storefront…"
        returnToStoreHref={returnToStoreHref}
        snapshotKind={snapshotKind}
        title="Loading your storefront"
      />
    );
  }
  if (state.status === "notFound") {
    return (
      <StatusPanel
        title="Project not found"
        message="We could not find this saved storefront on this device."
        returnToStoreHref={returnToStoreHref}
        snapshotKind={snapshotKind}
      />
    );
  }
  if (state.status === "missingDraft") {
    return (
      <StatusPanel
        title="Draft unavailable"
        message="This project does not currently have a draft storefront to preview."
        retry={retry}
        returnToStoreHref={returnToStoreHref}
        snapshotKind={snapshotKind}
      />
    );
  }
  if (state.status === "missingPage") {
    return (
      <StatusPanel
        title={pageSlug === "/" ? "Homepage unavailable" : "Page unavailable"}
        message={
          pageSlug === "/"
            ? "The saved draft does not contain a homepage yet."
            : "The saved draft does not contain this storefront page."
        }
        retry={retry}
        returnToStoreHref={returnToStoreHref}
        snapshotKind={snapshotKind}
      />
    );
  }
  if (state.status === "validationFailure") {
    return (
      <StatusPanel
        title="Storefront could not be displayed"
        message="Some saved storefront content needs attention before it can be shown safely."
        retry={retry}
        returnToStoreHref={returnToStoreHref}
        snapshotKind={snapshotKind}
      />
    );
  }
  if (state.status === "failure") {
    return (
      <StatusPanel
        title="Storefront could not be loaded"
        message="We could not open the saved project. Your draft has not been changed."
        retry={retry}
        returnToStoreHref={returnToStoreHref}
        snapshotKind={snapshotKind}
      />
    );
  }

  const locale = activeLocale ?? state.aggregate.project.primaryLocale;
  const previewQuerySuffix = previewNavigationSuffix({
    publishedSessionId,
    proposalCandidateFingerprint,
    p10b16p04UtilityContext,
    ...(initialLocale || locale !== state.aggregate.project.primaryLocale ? { locale } : {}),
  });
  const style = brandSystemToCssVariables(state.draft.brandSystem) as CSSProperties;
  const renderContext = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: state.aggregate.project.primaryLocale,
    enabledLocales: state.aggregate.project.enabledLocales,
    onLocaleChange: setActiveLocale,
    catalogue: state.aggregate.catalogue,
    snapshot: state.draft,
    evidenceReferences: state.evidenceReferences,
    pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
    pagePathSuffix: previewQuerySuffix,
    renderTarget: snapshotKind === "published" ? "published" : "preview",
    commerceUtilityRuntime: p10b16p04CartRuntime(state.aggregate, p10b16p04UtilityContext),
    ...(p10b16p04UtilityContext ? { onCommerceUtilityIntent: () => undefined } : {}),
  });

  return (
    <div className="project-preview" lang={locale} style={style}>
      <header className="project-preview__header">
        <div>
          <Link className="project-preview__back" href="/">
            Vesko home
          </Link>
          <h1>{state.aggregate.project.name}</h1>
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
                name="storefront-locale"
                onChange={() => setActiveLocale(enabledLocale)}
                type="radio"
                value={enabledLocale}
              />
              <span>{enabledLocale === "en" ? "English" : "Suomi"}</span>
            </label>
          ))}
        </fieldset>
      </header>
      <HistoricalPreviewActions
        locale={locale}
        projectId={projectId}
        snapshotId={historicalSnapshotId}
        snapshotKind={snapshotKind}
      />
      <div
        aria-label={
          snapshotKind === "history"
            ? "Previous version storefront"
            : snapshotKind === "published"
              ? "Published storefront"
              : "Draft storefront"
        }
        className="project-preview__storefront"
      >
        {renderStorefrontPage(state.page, renderContext)}
      </div>
    </div>
  );
}
