"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createDynamicProductDetailController,
  type ProductDetailResolutionSnapshot,
} from "@/application/product-presentation";
import type { ProductPresentationContext } from "@/domain/component-platform";
import type { CanonicalProductConfigurationResolver } from "@/domain/product-presentation";
import { resolveLocalizedText, type LocalizedText } from "@/domain/shared";
import {
  renderDynamicProductDetail,
  type DynamicProductDetailRendererInput,
  type ProductPrimaryActionPresentation,
} from "./dynamic-product-detail";

const incompleteMessage: LocalizedText = {
  en: "Complete the required product options before continuing.",
  fi: "Täytä pakolliset tuotevalinnat ennen jatkamista.",
};

const unavailableMessage: LocalizedText = {
  en: "This product configuration is not available.",
  fi: "Tämä tuotekokoonpano ei ole saatavilla.",
};

export type IntegratedDynamicProductDetailInput = Omit<
  DynamicProductDetailRendererInput,
  | "onSelectOption"
  | "onTextOptionChange"
  | "primaryAction"
  | "resolutionLifecycle"
  | "resolvedOptions"
> & {
  productContext: ProductPresentationContext;
  resolver?: CanonicalProductConfigurationResolver;
};

function primaryActionPresentation(
  snapshot: ProductDetailResolutionSnapshot,
): ProductPrimaryActionPresentation {
  if (snapshot.phase !== "ready") {
    return { enabled: false, state: "unavailable" };
  }
  const result = snapshot.result;
  if (!result) {
    return { enabled: false, state: "unavailable", message: unavailableMessage };
  }
  if (result.canAddToCart) return { enabled: true, state: "ready" };
  if (result.incompleteRequiredGroupIds.length > 0) {
    return { enabled: false, state: "incomplete", message: incompleteMessage };
  }
  return { enabled: false, state: "unavailable", message: unavailableMessage };
}

export function IntegratedDynamicProductDetail(input: IntegratedDynamicProductDetailInput) {
  const controller = useMemo(
    () =>
      createDynamicProductDetailController({
        context: input.productContext,
        resolver: input.resolver,
      }),
    [input.productContext, input.resolver],
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    void controller.initialize();
  }, [controller]);

  if (!snapshot.result) {
    const message = snapshot.message ?? unavailableMessage;
    return (
      <section
        aria-live="polite"
        data-component="dynamicProductDetail"
        data-resolution-state={snapshot.phase}
        role="status"
      >
        {resolveLocalizedText(message, input.activeLocale, input.primaryLocale)}
      </section>
    );
  }

  return renderDynamicProductDetail({
    target: input.target,
    instance: input.instance,
    projection: input.projection,
    activeLocale: input.activeLocale,
    primaryLocale: input.primaryLocale,
    primaryAction: primaryActionPresentation(snapshot),
    resolutionLifecycle: {
      state:
        snapshot.phase === "loading"
          ? "pending"
          : snapshot.phase === "failure"
            ? "failure"
            : "ready",
      message: snapshot.message ?? undefined,
      warnings: snapshot.warnings.map((warning) => warning.message),
    },
    resolvedOptions: snapshot.result,
    resolveAssetUrl: input.resolveAssetUrl,
    onSelectOption(groupId, valueId) {
      if (snapshot.phase === "loading") return;
      void controller.selectOption(groupId, valueId);
    },
    onTextOptionChange(groupId, enteredValue) {
      if (snapshot.phase === "loading") return;
      if (enteredValue.length === 0) {
        void controller.clearText(groupId);
        return;
      }
      void controller.enterText(groupId, enteredValue);
    },
    onPrimaryAction: input.onPrimaryAction,
  });
}
