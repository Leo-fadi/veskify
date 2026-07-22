"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

type TextDraftState = Readonly<{
  scope: string;
  values: Readonly<Record<string, string>>;
}>;

function initialTextDraftState(product: ProductPresentationContext): TextDraftState {
  return {
    scope: `${product.productId}:${product.revision}`,
    values: Object.fromEntries(
      product.optionGroups
        .filter((group) => group.presentation === "textInput")
        .map((group) => {
          const selected = product.selectedValues.find(
            (selection) => selection.groupId === group.id && "enteredText" in selection,
          );
          return [group.id, selected && "enteredText" in selected ? selected.enteredText : ""];
        }),
    ),
  };
}

function primaryActionPresentation(
  snapshot: ProductDetailResolutionSnapshot,
): ProductPrimaryActionPresentation {
  if (snapshot.phase === "loading") {
    return { enabled: false, state: "unavailable" };
  }
  const result = snapshot.result;
  if (!result) {
    return { enabled: false, state: "unavailable", message: unavailableMessage };
  }
  if (snapshot.phase === "failure" && result.canAddToCart) {
    return { enabled: true, state: "ready" };
  }
  if (result.canAddToCart) return { enabled: true, state: "ready" };
  if (result.incompleteRequiredGroupIds.length > 0) {
    return { enabled: false, state: "incomplete", message: incompleteMessage };
  }
  return { enabled: false, state: "unavailable", message: unavailableMessage };
}

export function IntegratedDynamicProductDetail(input: IntegratedDynamicProductDetailInput) {
  const draftScope = `${input.productContext.productId}:${input.productContext.revision}`;
  const initialDrafts = useMemo(
    () => initialTextDraftState(input.productContext),
    [input.productContext],
  );
  const [textDraftState, setTextDraftState] = useState<TextDraftState>(initialDrafts);
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

  const currentDraftState = textDraftState.scope === draftScope ? textDraftState : initialDrafts;

  const updateDraft = (groupId: string, value: string) => {
    setTextDraftState((current) => {
      const scoped = current.scope === draftScope ? current : initialDrafts;
      return { scope: draftScope, values: { ...scoped.values, [groupId]: value } };
    });
  };

  const reconcileDrafts = (settled: Awaited<ReturnType<typeof controller.dispatch>>) => {
    if (settled.kind !== "applied" || !settled.snapshot.result) return;
    const accepted = new Map(
      settled.snapshot.result.textEntryValues.map((entry) => [entry.groupId, entry.value]),
    );
    setTextDraftState({
      scope: draftScope,
      values: Object.fromEntries(
        input.productContext.optionGroups
          .filter((group) => group.presentation === "textInput")
          .map((group) => [group.id, accepted.get(group.id) ?? ""]),
      ),
    });
  };

  const settle = (pending: ReturnType<typeof controller.dispatch>) => {
    void pending.then((settled) => reconcileDrafts(settled));
  };

  useEffect(() => {
    void controller.initialize().then((settled) => reconcileDrafts(settled));
    // The controller identity already captures the canonical product scope and resolver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    textEntryDrafts: input.productContext.optionGroups
      .filter((group) => group.presentation === "textInput")
      .map((group) => ({ groupId: group.id, value: currentDraftState.values[group.id] ?? "" })),
    resolveAssetUrl: input.resolveAssetUrl,
    onSelectOption(groupId, valueId) {
      if (snapshot.phase === "loading") return;
      settle(controller.selectOption(groupId, valueId));
    },
    onClearOption(groupId) {
      if (snapshot.phase === "loading") return;
      settle(controller.clearOption(groupId));
    },
    onTextOptionChange(groupId, enteredValue) {
      updateDraft(groupId, enteredValue);
      if (enteredValue.length === 0) {
        settle(controller.clearText(groupId));
        return;
      }
      settle(controller.enterText(groupId, enteredValue));
    },
    onResetOptions() {
      const emptyDrafts = Object.fromEntries(
        input.productContext.optionGroups
          .filter((group) => group.presentation === "textInput")
          .map((group) => [group.id, ""]),
      );
      setTextDraftState({ scope: draftScope, values: emptyDrafts });
      settle(controller.reset());
    },
    onPrimaryAction: input.onPrimaryAction,
  });
}
