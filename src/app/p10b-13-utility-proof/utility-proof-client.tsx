"use client";

import { useState } from "react";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import type { ExecutablePageBlueprintProfile } from "@/application/storefront-templates";
import type { CommerceUtilityIntent, CommerceUtilityRuntimeState } from "@/domain/commerce-utility";
import { brandSystemToCssVariables } from "@/domain/design-system";
import type { StorefrontSnapshot } from "@/domain/storefront";

function runtimeFor(
  state: NonNullable<ExecutablePageBlueprintProfile["commercialUtility"]>["state"],
  catalogue: CatalogueDisplayModel,
  scenario: string | undefined,
  actionCapabilities: "supported" | "none",
): CommerceUtilityRuntimeState | undefined {
  const actions = <T extends CommerceUtilityRuntimeState["actions"]>(value: T): T | [] =>
    actionCapabilities === "supported" ? value : [];
  const product = catalogue.products[0];
  if (state === "cart" && scenario === "unavailable") return undefined;
  if (state === "cart" && scenario === "loading")
    return {
      kind: "loading",
      revision: "loading-proof-r1",
      message: {
        en: "Retrieving current storefront information.",
        fi: "Haetaan ajantasaista kaupan tietoa.",
      },
      actions: [],
    };
  if (state === "cart" && scenario === "empty")
    return {
      kind: "cart",
      revision: "cart-empty-proof-r1",
      lines: [],
      actions: actions(["continue-shopping"]),
    };
  if (state === "cart")
    return {
      kind: "cart",
      revision: "cart-proof-r1",
      lines: [
        {
          lineId: "line_proof_01",
          productId: product.id,
          quantity: 1,
          minimumQuantity: 1,
          unitPrice: product.price,
          linePrice: product.price,
        },
      ],
      subtotal: product.price,
      total: product.price,
      actions: actions([
        "change-quantity",
        "remove-line",
        "continue-checkout",
        "continue-shopping",
      ]),
    };
  if (state === "checkout")
    return {
      kind: "checkout",
      revision: "checkout-proof-r1",
      boundaryLabel: {
        en: "Checkout continues through the canonical commerce authority.",
        fi: "Kassa jatkuu kanonisen kaupankäyntivaltuuden kautta.",
      },
      actions: actions(["continue-checkout", "continue-shopping"]),
    };
  if (state === "no-results")
    return {
      kind: "no-results",
      revision: "search-proof-r1",
      query: scenario === "filters" ? "" : "midnight ring",
      activeFilters:
        scenario === "query"
          ? []
          : [
              { en: "Gold", fi: "Kulta" },
              { en: "In stock", fi: "Saatavilla" },
            ],
      actions: actions(["clear-search", "clear-filters", "continue-shopping"]),
    };
  if (state === "empty")
    return {
      kind: "empty",
      revision: "empty-proof-r1",
      message: {
        en: "This collection is currently empty.",
        fi: "Tämä mallisto on tällä hetkellä tyhjä.",
      },
      actions: actions(["continue-shopping"]),
    };
  if (state === "error")
    return {
      kind: "error",
      revision: "error-proof-r1",
      message: {
        en: "We could not refresh this storefront state. Try again when ready.",
        fi: "Emme voineet päivittää tätä kaupan tilaa. Yritä uudelleen, kun olet valmis.",
      },
      recoverable: scenario !== "unrecoverable",
      actions: actions(["retry", "continue-shopping"]),
    };
  if (state === "loading")
    return {
      kind: "loading",
      revision: "loading-proof-r1",
      message: {
        en: "Retrieving current storefront information.",
        fi: "Haetaan ajantasaista kaupan tietoa.",
      },
      actions: [],
    };
  return {
    kind: "not-found",
    revision: "not-found-proof-r1",
    actions: actions(["return-home"]),
  };
}

export function P10B13UtilityProofClient({
  activeLocale,
  actionCapabilities,
  catalogue,
  handlerAuthority,
  profile,
  scenario,
  snapshot,
  utilityPageId,
}: {
  activeLocale: "en" | "fi";
  actionCapabilities: "supported" | "none";
  catalogue: CatalogueDisplayModel;
  handlerAuthority: "present" | "absent";
  profile: ExecutablePageBlueprintProfile;
  scenario?: string;
  snapshot: StorefrontSnapshot;
  utilityPageId: string;
}) {
  const [lastIntent, setLastIntent] = useState<CommerceUtilityIntent | null>(null);
  const runtime = runtimeFor(
    profile.commercialUtility!.state,
    catalogue,
    scenario,
    actionCapabilities,
  );
  const context = createStorefrontRenderContext({
    activeLocale,
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    catalogue,
    snapshot,
    renderTarget: "preview",
    ...(runtime ? { commerceUtilityRuntime: runtime } : {}),
    ...(handlerAuthority === "present" ? { onCommerceUtilityIntent: setLastIntent } : {}),
  });
  const page = snapshot.pages.find((candidate) => candidate.id === utilityPageId)!;
  return (
    <main
      data-p10b-13-profile={profile.id}
      data-profile-version={profile.version}
      data-structural-fingerprint={profile.commercialUtility!.structuralFingerprint}
      data-runtime-kind={runtime?.kind ?? "unavailable"}
      data-active-locale={activeLocale}
      data-action-capabilities={actionCapabilities}
      data-handler-authority={handlerAuthority}
      data-runtime-persisted={String(
        runtime ? JSON.stringify(snapshot).includes(runtime.revision) : false,
      )}
      data-shared-frame-profile={snapshot.sharedFrame!.profileId}
      style={brandSystemToCssVariables(snapshot.brandSystem)}
    >
      {renderStorefrontPage(page, context)}
      <output aria-live="polite" data-last-utility-action={lastIntent?.action ?? "none"}>
        {lastIntent?.action ?? ""}
      </output>
    </main>
  );
}
