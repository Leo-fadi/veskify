import { applyProductOptionIntent, initializeProductOptionEngine } from "./product-option-engine";
import { deepFreeze } from "@/domain/product-presentation/resolve-product-options";
import {
  productOptionResolutionErrorSchema,
  type CanonicalProductConfigurationResolver,
  type ProductOptionResolutionError,
  type ProductOptionResolutionResult,
  type ProductOptionSelectionIntent,
  type ProductOptionWarning,
} from "@/domain/product-presentation/contracts";
import type { LocalizedText } from "@/domain/shared";

export type ProductDetailResolutionPhase = "loading" | "ready" | "failure";

export type ProductDetailMerchantWarning = Readonly<{
  code: ProductOptionWarning["code"];
  message: LocalizedText;
}>;

export type ProductDetailResolutionSnapshot = Readonly<{
  phase: ProductDetailResolutionPhase;
  requestSequence: number;
  result: ProductOptionResolutionResult | null;
  error: ProductOptionResolutionError | null;
  message: LocalizedText | null;
  warnings: readonly ProductDetailMerchantWarning[];
}>;

export type ProductDetailResolutionDispatchResult = Readonly<{
  kind: "applied" | "failed" | "stale";
  requestSequence: number;
  snapshot: ProductDetailResolutionSnapshot;
}>;

export type DynamicProductDetailController = Readonly<{
  getSnapshot(): ProductDetailResolutionSnapshot;
  subscribe(listener: () => void): () => void;
  initialize(): Promise<ProductDetailResolutionDispatchResult>;
  dispatch(intent: ProductOptionSelectionIntent): Promise<ProductDetailResolutionDispatchResult>;
  selectOption(groupId: string, valueId: string): Promise<ProductDetailResolutionDispatchResult>;
  clearOption(groupId: string): Promise<ProductDetailResolutionDispatchResult>;
  enterText(groupId: string, value: string): Promise<ProductDetailResolutionDispatchResult>;
  clearText(groupId: string): Promise<ProductDetailResolutionDispatchResult>;
  reset(): Promise<ProductDetailResolutionDispatchResult>;
}>;

const loadingMessage: LocalizedText = {
  en: "Updating product options…",
  fi: "Päivitetään tuotevalintoja…",
};

const errorMessages: Record<ProductOptionResolutionError["code"], LocalizedText> = {
  INVALID_CONTEXT: {
    en: "Product options are unavailable right now.",
    fi: "Tuotevalinnat eivät ole juuri nyt saatavilla.",
  },
  INVALID_INTENT: {
    en: "That option could not be applied. Your previous selection is unchanged.",
    fi: "Valintaa ei voitu tehdä. Aiempi valintasi säilyi ennallaan.",
  },
  STALE_RESULT: {
    en: "Product information changed. Refresh the options before continuing.",
    fi: "Tuotetiedot muuttuivat. Päivitä valinnat ennen jatkamista.",
  },
  UNKNOWN_GROUP: {
    en: "That product option is no longer available.",
    fi: "Tämä tuotevalinta ei ole enää saatavilla.",
  },
  UNKNOWN_VALUE: {
    en: "That option value is no longer available.",
    fi: "Tämä vaihtoehto ei ole enää saatavilla.",
  },
  WRONG_OPTION_KIND: {
    en: "That option could not be applied. Your previous selection is unchanged.",
    fi: "Valintaa ei voitu tehdä. Aiempi valintasi säilyi ennallaan.",
  },
  REQUIRED_SELECTION_CANNOT_BE_CLEARED: {
    en: "This required option needs a selection.",
    fi: "Tämä pakollinen vaihtoehto on valittava.",
  },
  DEPENDENCY_UNSATISFIED: {
    en: "Choose the required earlier options first.",
    fi: "Valitse ensin vaaditut aiemmat vaihtoehdot.",
  },
  OPTION_DISABLED: {
    en: "That combination is unavailable. Your previous selection is unchanged.",
    fi: "Tämä yhdistelmä ei ole saatavilla. Aiempi valintasi säilyi ennallaan.",
  },
  TEXT_CONSTRAINT_VIOLATION: {
    en: "Check the text option and try again.",
    fi: "Tarkista tekstivalinta ja yritä uudelleen.",
  },
  INVALID_SELECTION_STATE: {
    en: "Product options are not ready yet.",
    fi: "Tuotevalinnat eivät ole vielä valmiit.",
  },
  RESOLVER_FAILURE: {
    en: "Product options are temporarily unavailable. Your previous selection is unchanged.",
    fi: "Tuotevalinnat eivät ole tilapäisesti saatavilla. Aiempi valintasi säilyi ennallaan.",
  },
  INVALID_RESOLVER_RESULT: {
    en: "Product options could not be confirmed. Your previous selection is unchanged.",
    fi: "Tuotevalintoja ei voitu vahvistaa. Aiempi valintasi säilyi ennallaan.",
  },
};

const warningMessages: Record<ProductOptionWarning["code"], LocalizedText> = {
  dependentSelectionCleared: {
    en: "A dependent selection was cleared after an earlier option changed.",
    fi: "Riippuva valinta poistettiin aiemman vaihtoehdon muututtua.",
  },
  textEntryIncomplete: {
    en: "Check the text option before continuing.",
    fi: "Tarkista tekstivalinta ennen jatkamista.",
  },
  canonicalResolutionUnavailable: {
    en: "This product configuration cannot be confirmed right now.",
    fi: "Tätä tuotekokoonpanoa ei voida vahvistaa juuri nyt.",
  },
  configurationUnavailable: {
    en: "This product combination is unavailable.",
    fi: "Tämä tuoteyhdistelmä ei ole saatavilla.",
  },
  resolverWarning: {
    en: "Some product options need attention before continuing.",
    fi: "Jotkin tuotevalinnat vaativat huomiota ennen jatkamista.",
  },
};

function merchantWarnings(
  result: ProductOptionResolutionResult | null,
): readonly ProductDetailMerchantWarning[] {
  if (!result) return [];
  const seen = new Set<ProductOptionWarning["code"]>();
  return result.validationWarnings.flatMap((warning) => {
    if (seen.has(warning.code)) return [];
    seen.add(warning.code);
    return [{ code: warning.code, message: warningMessages[warning.code] }];
  });
}

function unexpectedFailure(): ProductOptionResolutionError {
  return productOptionResolutionErrorSchema.parse({
    code: "RESOLVER_FAILURE",
    message: "Product option resolution failed unexpectedly.",
  });
}

export function createDynamicProductDetailController(input: {
  context: unknown;
  resolver?: CanonicalProductConfigurationResolver;
}): DynamicProductDetailController {
  let latestRequestSequence = 0;
  let snapshot: ProductDetailResolutionSnapshot = deepFreeze({
    phase: "loading" as const,
    requestSequence: 0,
    result: null,
    error: null,
    message: loadingMessage,
    warnings: [],
  });
  const listeners = new Set<() => void>();

  const publish = (next: ProductDetailResolutionSnapshot) => {
    snapshot = deepFreeze(next);
    listeners.forEach((listener) => listener());
  };

  const execute = async (
    intent?: ProductOptionSelectionIntent,
  ): Promise<ProductDetailResolutionDispatchResult> => {
    const requestSequence = ++latestRequestSequence;
    const previousResult = snapshot.result;
    publish({
      phase: "loading",
      requestSequence,
      result: previousResult,
      error: null,
      message: loadingMessage,
      warnings: merchantWarnings(previousResult),
    });

    let outcome;
    try {
      if (intent === undefined) {
        outcome = await initializeProductOptionEngine(input.context, input.resolver);
      } else if (previousResult === null) {
        const error = productOptionResolutionErrorSchema.parse({
          code: "INVALID_SELECTION_STATE",
          message: "Product options must initialize before accepting selection intents.",
        });
        outcome = { ok: false as const, error, result: null };
      } else {
        outcome = await applyProductOptionIntent({
          context: input.context,
          previousResult,
          intent,
          resolver: input.resolver,
        });
      }
    } catch {
      outcome = { ok: false as const, error: unexpectedFailure(), result: previousResult };
    }

    if (requestSequence !== latestRequestSequence) {
      return deepFreeze({ kind: "stale" as const, requestSequence, snapshot });
    }

    if (!outcome.ok) {
      const preserved = outcome.result ?? previousResult;
      publish({
        phase: "failure",
        requestSequence,
        result: preserved,
        error: outcome.error,
        message: errorMessages[outcome.error.code],
        warnings: merchantWarnings(preserved),
      });
      return deepFreeze({ kind: "failed" as const, requestSequence, snapshot });
    }

    publish({
      phase: "ready",
      requestSequence,
      result: outcome.result,
      error: null,
      message: null,
      warnings: merchantWarnings(outcome.result),
    });
    return deepFreeze({ kind: "applied" as const, requestSequence, snapshot });
  };

  const dispatch = (intent: ProductOptionSelectionIntent) => execute(intent);

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    initialize: () => execute(),
    dispatch,
    selectOption: (groupId, valueId) =>
      dispatch({ type: "selectEnumeratedValue", groupId, valueId }),
    clearOption: (groupId) => dispatch({ type: "clearOptionalSelection", groupId }),
    enterText: (groupId, value) => dispatch({ type: "enterTextOption", groupId, value }),
    clearText: (groupId) => dispatch({ type: "clearTextOption", groupId }),
    reset: () => dispatch({ type: "resetSelections" }),
  };
}
