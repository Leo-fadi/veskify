"use client";

import { Fragment } from "react";
import type {
  CollectionCommerceRoutePresentation,
  ProductCommerceRoutePresentation,
} from "@/integrations/storefront-commerce-routes";
import { renderRegisteredSection, type StorefrontRenderContext } from "@/components/registry";
import type { Locale } from "@/domain/shared";
import type { PageModel } from "@/domain/storefront";
import {
  renderDynamicCollectionCommerce,
  type CollectionFilterIntent,
  type CollectionNavigationIntent,
  type CollectionSortIntent,
  type ProductNavigationIntent,
} from "./dynamic-collection-commerce";
import {
  IntegratedDynamicProductDetail,
  type IntegratedDynamicProductDetailInput,
} from "./integrated-dynamic-product-detail";

type SharedRouteProps = Readonly<{
  page: PageModel;
  context: StorefrontRenderContext;
  activeLocale: Locale;
  primaryLocale: Locale;
  target: "preview" | "published";
}>;

function chrome(page: PageModel, context: StorefrontRenderContext, component: "header" | "footer") {
  if (context.sharedFrame) {
    return renderRegisteredSection(context.sharedFrame[component], context);
  }
  const section =
    page.sections.find((candidate) => candidate.visible && candidate.component === component) ??
    context.pages
      .find((candidate) => candidate.type === "home")
      ?.sections.find((candidate) => candidate.visible && candidate.component === component);
  return section ? renderRegisteredSection(section, context, page.type) : null;
}

function announcement(page: PageModel, context: StorefrontRenderContext) {
  if (context.sharedFrame) {
    return context.sharedFrame.announcement
      ? renderRegisteredSection(context.sharedFrame.announcement, context)
      : null;
  }
  const pageSection = page.sections.find(
    (candidate) => candidate.visible && candidate.component === "announcementBar",
  );
  if (pageSection) return renderRegisteredSection(pageSection, context, page.type);
  const home = context.pages.find((candidate) => candidate.type === "home");
  const homeSection = home?.sections.find(
    (candidate) => candidate.visible && candidate.component === "announcementBar",
  );
  return home && homeSection ? renderRegisteredSection(homeSection, context, home.type) : null;
}

export function StorefrontProductCommerceRoute(
  props: SharedRouteProps &
    Readonly<{
      presentation: ProductCommerceRoutePresentation;
      onPrimaryAction: IntegratedDynamicProductDetailInput["onPrimaryAction"];
    }>,
) {
  return (
    <Fragment>
      {announcement(props.page, props.context)}
      {chrome(props.page, props.context, "header")}
      <main>
        <IntegratedDynamicProductDetail
          activeLocale={props.activeLocale}
          instance={props.presentation.instance}
          onPrimaryAction={props.onPrimaryAction}
          primaryLocale={props.primaryLocale}
          productContext={props.presentation.productContext}
          projection={props.presentation.projection}
          resolveAssetUrl={props.presentation.resolveAssetUrl}
          resolver={props.presentation.resolver}
          target={props.target}
        />
      </main>
      {chrome(props.page, props.context, "footer")}
    </Fragment>
  );
}

export function StorefrontCollectionCommerceRoute(
  props: SharedRouteProps &
    Readonly<{
      presentation: CollectionCommerceRoutePresentation;
      onNavigateProduct: (intent: ProductNavigationIntent) => void;
      onNavigateCollection: (intent: CollectionNavigationIntent) => void;
      onFilterIntent: (intent: CollectionFilterIntent) => void;
      onSortIntent: (intent: CollectionSortIntent) => void;
    }>,
) {
  return (
    <Fragment>
      {announcement(props.page, props.context)}
      {chrome(props.page, props.context, "header")}
      {renderDynamicCollectionCommerce({
        target: props.target,
        instance: props.presentation.instance,
        projection: props.presentation.projection,
        activeLocale: props.activeLocale,
        primaryLocale: props.primaryLocale,
        loading: { status: "ready" },
        resolveAssetUrl: props.presentation.resolveAssetUrl,
        onNavigateProduct: props.onNavigateProduct,
        onNavigateCollection: props.onNavigateCollection,
        onFilterIntent: props.onFilterIntent,
        onSortIntent: props.onSortIntent,
      })}
      {chrome(props.page, props.context, "footer")}
    </Fragment>
  );
}
