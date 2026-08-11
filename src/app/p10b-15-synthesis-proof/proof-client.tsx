"use client";

import { useState } from "react";
import { createStorefrontRenderContext } from "@/components/registry";
import { StorefrontProductCommerceRoute } from "@/components/storefront/storefront-commerce-route";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import type { CommerceUtilityIntent, CommerceUtilityRuntimeState } from "@/domain/commerce-utility";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { PageFactEvidenceReference, StorefrontSnapshot } from "@/domain/storefront";
import { createCatalogueStorefrontCommerceRouteAdapter } from "@/integrations/storefront-commerce-routes";
import type { ProjectAggregate } from "@/services/storage";

function utilityRuntime(
  familyId: string,
  aggregate: ProjectAggregate,
): CommerceUtilityRuntimeState | undefined {
  const product = aggregate.catalogue.products[0];
  if (familyId === "cart")
    return {
      kind: "cart",
      revision: "p10b15-cart-r1",
      lines: [
        {
          lineId: "p10b15-cart-line",
          productId: product.id,
          quantity: 1,
          minimumQuantity: 1,
          unitPrice: product.price,
          linePrice: product.price,
        },
      ],
      subtotal: product.price,
      total: product.price,
      actions: ["change-quantity", "remove-line", "continue-checkout"],
    };
  if (familyId === "checkout")
    return {
      kind: "checkout",
      revision: "p10b15-checkout-r1",
      boundaryLabel: {
        en: "Secure checkout continues with Vesko.",
        fi: "Turvallinen kassa jatkuu Veskossa.",
      },
      actions: ["continue-checkout"],
    };
  if (familyId === "no-results")
    return {
      kind: "no-results",
      revision: "p10b15-search-r1",
      query: "midnight ring",
      activeFilters: [{ en: "Gold", fi: "Kulta" }],
      actions: ["clear-search", "clear-filters"],
    };
  if (familyId === "empty-state")
    return {
      kind: "empty",
      revision: "p10b15-empty-r1",
      message: { en: "Nothing is here yet.", fi: "Täällä ei ole vielä mitään." },
      actions: ["continue-shopping"],
    };
  if (familyId === "error-state")
    return {
      kind: "error",
      revision: "p10b15-error-r1",
      message: { en: "We could not refresh this view.", fi: "Näkymää ei voitu päivittää." },
      recoverable: true,
      actions: ["retry"],
    };
  if (familyId === "not-found")
    return { kind: "not-found", revision: "p10b15-not-found-r1", actions: ["return-home"] };
  return undefined;
}

export function P10B15SynthesisProofClient({
  aggregate,
  evidenceReferences,
  intent,
  locale,
  page,
  snapshot,
  snapshotFingerprint,
  synthesisFingerprint,
  target,
  p10b16,
}: {
  aggregate: ProjectAggregate;
  evidenceReferences: readonly PageFactEvidenceReference[];
  intent: string;
  locale: "en" | "fi";
  page: StorefrontSnapshot["pages"][number];
  snapshot: StorefrontSnapshot;
  snapshotFingerprint: string;
  synthesisFingerprint: string;
  target: "proposal" | "editor" | "preview" | "published";
  p10b16?: Readonly<{
    directionId: string;
    alternative: number;
    directionFingerprint: string;
    diversityFingerprint: string;
  }>;
}) {
  const [lastUtilityIntent, setLastUtilityIntent] = useState<CommerceUtilityIntent | null>(null);
  const runtime = utilityRuntime(page.pageFamily!.familyId, aggregate);
  const renderTarget = target === "proposal" ? "preview" : target;
  const context = createStorefrontRenderContext({
    activeLocale: locale,
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    catalogue: aggregate.catalogue,
    snapshot,
    renderTarget,
    evidenceReferences,
    ...(runtime
      ? { commerceUtilityRuntime: runtime, onCommerceUtilityIntent: setLastUtilityIntent }
      : {}),
  });
  let rendered = renderStorefrontPage(page, context);
  if (page.pageFamily?.familyId === "product-detail") {
    const productId =
      page.pageFamily.commerceContext.kind === "product"
        ? page.pageFamily.commerceContext.productId
        : undefined;
    const product = aggregate.catalogue.products.find((candidate) => candidate.id === productId);
    const presentation = product
      ? createCatalogueStorefrontCommerceRouteAdapter().product({
          aggregate,
          evidenceReferences,
          snapshot,
          page,
          product,
        })
      : undefined;
    if (!product || !presentation) {
      throw new Error("The P10B-15 PDP proof requires current canonical product authority.");
    }
    rendered = (
      <StorefrontProductCommerceRoute
        activeLocale={locale}
        context={context}
        onPrimaryAction={() => undefined}
        page={page}
        presentation={presentation}
        primaryLocale="en"
        target={renderTarget === "published" ? "published" : "preview"}
      />
    );
  }
  return (
    <div
      data-page-family={page.pageFamily!.familyId}
      data-page-profile={page.pageFamily!.profileId}
      data-page-route={page.slug}
      data-p10b-15-synthesis={intent}
      data-p10b-16-direction={p10b16?.directionId}
      data-p10b-16-alternative={p10b16?.alternative}
      data-direction-fingerprint={p10b16?.directionFingerprint}
      data-diversity-fingerprint={p10b16?.diversityFingerprint}
      data-render-target={target}
      data-rendered-locale={locale}
      data-shared-frame-profile={snapshot.sharedFrame!.profileId}
      data-snapshot-fingerprint={snapshotFingerprint}
      data-synthesis-fingerprint={synthesisFingerprint}
      style={brandSystemToCssVariables(snapshot.brandSystem)}
    >
      {rendered}
      <output aria-live="polite" data-last-utility-action={lastUtilityIntent?.action ?? "none"}>
        {lastUtilityIntent?.action ?? ""}
      </output>
    </div>
  );
}
