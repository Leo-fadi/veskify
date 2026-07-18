"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createStorefrontRenderContext, validateRegisteredPage } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { Locale } from "@/domain/shared";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import { createBrowserProjectRepository, ProjectNotFoundError } from "@/services/storage";
import {
  previewLabel,
  previewPathPrefix,
  selectedSnapshotId,
  type SnapshotKind,
} from "../../preview-mode";

type RepositoryFactory = () => ProjectRepository;
type ProductPageModel = ProjectAggregate["snapshots"][number]["pages"][number];
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
    };

const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();
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
        <Link href="/">Return to Veskify home</Link>
      </section>
    </main>
  );
}

type ProductPreviewClientProps = {
  productId: string;
  productSlug: string;
  repositoryFactory?: RepositoryFactory;
  snapshotKind?: SnapshotKind;
  historicalSnapshotId?: string;
};

export function ProductPreviewClient(props: ProductPreviewClientProps) {
  return <ProductPreviewLoader key={`${props.productId}:${props.productSlug}`} {...props} />;
}

function ProductPreviewLoader({
  productId: projectId,
  productSlug,
  repositoryFactory = defaultRepositoryFactory,
  snapshotKind = "draft",
  historicalSnapshotId,
}: ProductPreviewClientProps) {
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeLocale, setActiveLocale] = useState<Locale>();

  useEffect(() => {
    let cancelled = false;
    repository
      .current!.get(projectId)
      .then((aggregate) => {
        if (cancelled) return;
        const draft = aggregate.snapshots.find(
          (snapshot) =>
            snapshot.id ===
            selectedSnapshotId(aggregate.project, snapshotKind, historicalSnapshotId),
        );
        if (!draft) return setState({ status: "missingDraft" });
        const productPage = draft.pages.find(
          (page) => page.type === "product" && page.slug === `/products/${productSlug}`,
        );
        if (!productPage) return setState({ status: "missingProductPage" });
        const canonicalProductId = productPage.sections.find(
          (section) => section.component === "productInfo",
        )?.content.productId;
        const product = aggregate.catalogue.products.find((item) => item.id === canonicalProductId);
        if (!product) return setState({ status: "productNotFound" });
        try {
          const context = createStorefrontRenderContext({
            activeLocale: aggregate.project.primaryLocale,
            primaryLocale: aggregate.project.primaryLocale,
            catalogue: aggregate.catalogue,
            snapshot: draft,
            pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
          });
          validateRegisteredPage(productPage, context);
          const references = productPage.sections
            .filter((section) =>
              ["productGallery", "productInfo", "productOptions"].includes(section.component),
            )
            .map((section) => section.content.productId);
          if (!references.length || references.some((reference) => reference !== product.id))
            throw new Error("Product page references do not match the canonical product.");
          void renderStorefrontPage(productPage, context);
        } catch {
          return setState({ status: "validationFailure" });
        }
        setActiveLocale(aggregate.project.primaryLocale);
        setState({ status: "success", aggregate, draft, productPage });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ status: error instanceof ProjectNotFoundError ? "notFound" : "failure" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, historicalSnapshotId, productSlug, projectId, snapshotKind]);

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
    catalogue: state.aggregate.catalogue,
    snapshot: state.draft,
    pagePathPrefix: previewPathPrefix(projectId, snapshotKind, historicalSnapshotId),
  });
  return (
    <div className="project-preview" lang={locale} style={style}>
      <div
        className="project-preview__header"
        role="region"
        aria-label={`Veskify ${snapshotKind} preview controls`}
      >
        <div>
          <Link
            className="project-preview__back"
            href={previewPathPrefix(projectId, snapshotKind, historicalSnapshotId)}
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
      <div
        aria-label={
          snapshotKind === "history"
            ? "Previous version product storefront"
            : `${previewLabel(snapshotKind)} product storefront`
        }
        className="project-preview__storefront"
      >
        {renderStorefrontPage(state.productPage, context)}
      </div>
    </div>
  );
}
