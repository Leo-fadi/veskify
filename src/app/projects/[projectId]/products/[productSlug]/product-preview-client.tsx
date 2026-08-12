"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { resolveDynamicCommerceRoutePage } from "@/application/dynamic-commerce-routes";
import {
  createCatalogueStorefrontCommerceRouteAdapter,
  type ProductCommerceRoutePresentation,
  type StorefrontCommerceRouteAdapter,
} from "@/integrations/storefront-commerce-routes";
import {
  createStorefrontRenderContext,
  validateRegisteredPage,
  type StorefrontRenderContext,
} from "@/components/registry";
import { StorefrontProductCommerceRoute } from "@/components/storefront/storefront-commerce-route";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import {
  validateDynamicProductDetailRoutePresentation,
  type ProductPrimaryActionIntentCallback,
} from "@/components/storefront/dynamic-product-detail";
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
type ProductPageModel = ProjectAggregate["snapshots"][number]["pages"][number];
type RouteRenderTarget = "preview" | "published";
type LoadState =
  | { status: "loading" }
  | {
      status:
        | "notFound"
        | "missingDraft"
        | "productNotFound"
        | "missingProductPage"
        | "failure"
        | "validationFailure";
    }
  | {
      status: "success";
      aggregate: ProjectAggregate;
      draft: ProjectAggregate["snapshots"][number];
      productPage: ProductPageModel;
      commercePresentation: ProductCommerceRoutePresentation | null;
      evidenceReferences: NonNullable<StorefrontRenderContext["evidenceReferences"]>;
    };

const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();
const defaultCommerceAdapter = createCatalogueStorefrontCommerceRouteAdapter();
const emptyEvidenceReferences: NonNullable<StorefrontRenderContext["evidenceReferences"]> = [];
const ignorePrimaryAction: ProductPrimaryActionIntentCallback = () => undefined;
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

type ProductPreviewClientProps = {
  productId: string;
  productSlug: string;
  repositoryFactory?: RepositoryFactory;
  snapshotKind?: SnapshotKind;
  /** Explicit route-render mode; snapshot selection remains independently governed by snapshotKind. */
  renderTarget?: RouteRenderTarget;
  historicalSnapshotId?: string;
  commerceAdapter?: StorefrontCommerceRouteAdapter;
  onPrimaryAction?: ProductPrimaryActionIntentCallback;
  publishedSessionId?: string;
  initialEvidenceReferences?: NonNullable<StorefrontRenderContext["evidenceReferences"]>;
};

export function ProductPreviewClient(props: ProductPreviewClientProps) {
  return <ProductPreviewLoader key={`${props.productId}:${props.productSlug}`} {...props} />;
}

function ProductPreviewLoader({
  productId: projectId,
  productSlug,
  repositoryFactory = defaultRepositoryFactory,
  snapshotKind = "draft",
  renderTarget,
  historicalSnapshotId,
  commerceAdapter = defaultCommerceAdapter,
  onPrimaryAction = ignorePrimaryAction,
  publishedSessionId,
  initialEvidenceReferences = emptyEvidenceReferences,
}: ProductPreviewClientProps) {
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
      ? loadP905bLocalDemoPublishedProjection({ projectId, sessionId: publishedSessionId }).then(
          ({ evidenceReferences, ...aggregate }) => ({ aggregate, evidenceReferences }),
        )
      : repository.current!.get(projectId).then((aggregate) => ({
          aggregate,
          evidenceReferences: structuredClone(initialEvidenceReferences),
        }))
    )
      .then(({ aggregate, evidenceReferences }) => {
        if (cancelled) return;
        const draft = aggregate.snapshots.find(
          (snapshot) =>
            snapshot.id ===
            selectedSnapshotId(aggregate.project, snapshotKind, historicalSnapshotId),
        );
        if (!draft) return setState({ status: "missingDraft" });
        try {
          const route = `/products/${productSlug}`;
          const dynamicRoute = draft.dynamicCommercePresentation?.routeInventory.find(
            (entry) => entry.kind === "product" && entry.route === route,
          );
          const productPage = draft.dynamicCommercePresentation
            ? dynamicRoute
              ? resolveDynamicCommerceRoutePage({
                  snapshot: draft,
                  catalogue: aggregate.catalogue,
                  routeId: dynamicRoute.id,
                }).page
              : undefined
            : draft.pages.find((page) => page.type === "product" && page.slug === route);
          if (!productPage) return setState({ status: "missingProductPage" });
          const dynamicProduct = productPage.sections.find(
            (section) => section.component === "dynamicProductDetail",
          );
          const canonicalProductId =
            (dynamicRoute?.kind === "product" ? dynamicRoute.productId : undefined) ??
            dynamicProduct?.content.productId ??
            productPage.sections.find((section) => section.component === "productInfo")?.content
              .productId;
          const product = aggregate.catalogue.products.find(
            (item) => item.id === canonicalProductId,
          );
          if (!product) return setState({ status: "productNotFound" });
          const context = createStorefrontRenderContext({
            activeLocale: aggregate.project.primaryLocale,
            primaryLocale: aggregate.project.primaryLocale,
            enabledLocales: aggregate.project.enabledLocales,
            catalogue: aggregate.catalogue,
            snapshot: draft,
            evidenceReferences,
            pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
            pagePathSuffix: publishedSessionId
              ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}`
              : "",
            renderTarget: effectiveRenderTarget,
          });
          validateRegisteredPage(productPage, context);
          const references = dynamicProduct
            ? [dynamicProduct.content.productId]
            : productPage.sections
                .filter((section) =>
                  ["productGallery", "productInfo", "productOptions"].includes(section.component),
                )
                .map((section) => section.content.productId);
          if (!references.length || references.some((reference) => reference !== product.id))
            throw new Error("Product page references do not match the canonical product.");
          void renderStorefrontPage(productPage, context);
          const commercePresentation = commerceAdapter.product({
            aggregate,
            evidenceReferences,
            snapshot: draft,
            page: productPage,
            product,
          });
          if (commercePresentation) {
            validateDynamicProductDetailRoutePresentation(
              commercePresentation.instance,
              commercePresentation.projection,
            );
            if (commercePresentation.productContext.productId !== product.id) {
              throw new Error("The dynamic product route resolved a different canonical product.");
            }
          }
          setActiveLocale(aggregate.project.primaryLocale);
          setState({
            status: "success",
            aggregate,
            draft,
            productPage,
            commercePresentation,
            evidenceReferences,
          });
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
    commerceAdapter,
    historicalSnapshotId,
    productSlug,
    projectId,
    effectiveRenderTarget,
    snapshotKind,
    publishedSessionId,
    initialEvidenceReferences,
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
        title="Loading product preview"
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
  if (state.status === "productNotFound")
    return (
      <StatusPanel
        title="Product not found"
        message="This product is not available in the saved demo catalogue."
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "missingProductPage")
    return (
      <StatusPanel
        title="Product page unavailable"
        message="The saved draft does not contain a page for this product yet."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "validationFailure")
    return (
      <StatusPanel
        title="Product page could not be displayed"
        message="Some saved product-page content needs attention before it can be shown safely."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status === "failure")
    return (
      <StatusPanel
        title="Storefront could not be loaded"
        message="We could not open the saved project. Your draft has not been changed."
        retry={retry}
        snapshotKind={snapshotKind}
      />
    );
  if (state.status !== "success") return null;

  const locale = activeLocale ?? state.aggregate.project.primaryLocale;
  const style = brandSystemToCssVariables(state.draft.brandSystem) as CSSProperties;
  const context = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: state.aggregate.project.primaryLocale,
    enabledLocales: state.aggregate.project.enabledLocales,
    onLocaleChange: setActiveLocale,
    catalogue: state.aggregate.catalogue,
    snapshot: state.draft,
    evidenceReferences: state.evidenceReferences,
    pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
    pagePathSuffix: publishedSessionId
      ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}`
      : "",
    renderTarget: effectiveRenderTarget,
  });
  return (
    <div className="project-preview" lang={locale} style={style}>
      <div
        className="project-preview__header"
        role="region"
        aria-label={`Vesko ${snapshotKind} preview controls`}
      >
        <div>
          <Link
            className="project-preview__back"
            href={`${previewPathPrefix(projectId, snapshotKind, historicalSnapshotId)}${
              publishedSessionId ? `?p9-05b-session=${encodeURIComponent(publishedSessionId)}` : ""
            }`}
          >
            Storefront home
          </Link>
          <p className="project-preview__name">{state.aggregate.project.name}</p>
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
                name="product-locale"
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
            ? "Previous version product storefront"
            : `${previewLabel(snapshotKind)} product storefront`
        }
        className="project-preview__storefront"
      >
        {state.commercePresentation ? (
          <StorefrontProductCommerceRoute
            activeLocale={locale}
            context={context}
            onPrimaryAction={onPrimaryAction}
            page={state.productPage}
            presentation={state.commercePresentation}
            primaryLocale={state.aggregate.project.primaryLocale}
            target={effectiveRenderTarget}
          />
        ) : (
          renderStorefrontPage(state.productPage, context)
        )}
      </div>
    </div>
  );
}
