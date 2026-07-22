import {
  productPresentationContextSchema,
  type ProductPresentationContext,
} from "@/domain/component-platform";
import {
  canonicalProductConfigurationInputSchema,
  canonicalProductConfigurationResultSchema,
  productOptionResolutionErrorSchema,
  productOptionResolutionResultSchema,
  productOptionSelectionStateSchema,
  type CanonicalProductConfigurationResolver,
  type ProductOptionResolutionErrorCode,
  type ProductOptionResolutionOutcome,
  type ProductOptionSelectionState,
  type ProductOptionWarning,
} from "./contracts";

type ResolutionInput = {
  context: unknown;
  selectionState: unknown;
  resolver?: CanonicalProductConfigurationResolver;
  warnings?: readonly ProductOptionWarning[];
};

type OptionGroup = ProductPresentationContext["optionGroups"][number];
type ResolutionFailure = Extract<ProductOptionResolutionOutcome, { ok: false }>;

const disabledReasonOrder = [
  "canonical",
  "dependency",
  "unavailableCombination",
  "resolver",
] as const;

export function resolveProductOptions(input: ResolutionInput): ProductOptionResolutionOutcome {
  const contextResult = productPresentationContextSchema.safeParse(input.context);
  if (!contextResult.success) {
    return failure("INVALID_CONTEXT", "Product presentation context is invalid.");
  }
  const stateResult = productOptionSelectionStateSchema.safeParse(input.selectionState);
  if (!stateResult.success) {
    return failure("INVALID_SELECTION_STATE", "Product option selection state is invalid.");
  }

  const context = contextResult.data;
  const normalized = normalizeSelectionState(context, stateResult.data);
  if (!normalized.ok) return normalized;
  const { selectedValues, textEntries } = normalized;
  const selectedByGroup = new Map(
    selectedValues.map((selection) => [selection.groupId, selection]),
  );
  const textByGroup = new Map(textEntries.map((entry) => [entry.groupId, entry]));
  const groupById = new Map(context.optionGroups.map((group) => [group.id, group]));

  const dependencyState = context.optionGroups.map((group) => {
    const unmetGroupIds = group.dependsOn.flatMap((dependency) => {
      const dependencyGroup = groupById.get(dependency.groupId);
      if (!dependencyGroup) return [dependency.groupId];
      if (dependencyGroup.presentation === "textInput") {
        const entry = textByGroup.get(dependency.groupId);
        return entry !== undefined && entry.valid && entry.value.length > 0
          ? []
          : [dependency.groupId];
      }
      const selection = selectedByGroup.get(dependency.groupId);
      if (!selection) return [dependency.groupId];
      return dependency.valueIds === undefined || dependency.valueIds.includes(selection.valueId)
        ? []
        : [dependency.groupId];
    });
    return {
      groupId: group.id,
      satisfied: unmetGroupIds.length === 0,
      unmetGroupIds,
    };
  });
  const dependencyByGroup = new Map(dependencyState.map((state) => [state.groupId, state]));

  for (const selection of [...selectedValues, ...textEntries]) {
    const dependency = dependencyByGroup.get(selection.groupId);
    if (dependency && !dependency.satisfied) {
      return failure(
        "DEPENDENCY_UNSATISFIED",
        `Option group ${selection.groupId} has unmet dependencies.`,
        selection.groupId,
      );
    }
  }

  const disabled = new Map<string, Set<(typeof disabledReasonOrder)[number]>>();
  const addDisabled = (
    groupId: string,
    valueId: string,
    reason: (typeof disabledReasonOrder)[number],
  ) => {
    const key = `${groupId}:${valueId}`;
    const reasons = disabled.get(key) ?? new Set<(typeof disabledReasonOrder)[number]>();
    reasons.add(reason);
    disabled.set(key, reasons);
  };

  context.optionGroups.forEach((group) => {
    if (group.presentation === "textInput") return;
    group.values.forEach((value) => {
      if (value.disabled) addDisabled(group.id, value.id, "canonical");
      if (!dependencyByGroup.get(group.id)?.satisfied) {
        addDisabled(group.id, value.id, "dependency");
      }
      context.unavailableCombinations.forEach((combination) => {
        const candidate = combination.selections.find(
          (selection) => selection.groupId === group.id && selection.valueId === value.id,
        );
        if (!candidate) return;
        const otherSelectionsMatch = combination.selections
          .filter((selection) => selection !== candidate)
          .every(
            (selection) => selectedByGroup.get(selection.groupId)?.valueId === selection.valueId,
          );
        if (otherSelectionsMatch) {
          addDisabled(group.id, value.id, "unavailableCombination");
        }
      });
    });
  });

  const selectedDisabled = selectedValues.find((selection) =>
    disabled.has(`${selection.groupId}:${selection.valueId}`),
  );
  if (selectedDisabled) {
    return failure(
      "OPTION_DISABLED",
      `Option value ${selectedDisabled.valueId} is unavailable for the current selection.`,
      selectedDisabled.groupId,
      selectedDisabled.valueId,
    );
  }

  const incompleteRequiredGroupIds = context.optionGroups.flatMap((group) => {
    if (!group.required) return [];
    if (!dependencyByGroup.get(group.id)?.satisfied) return [group.id];
    if (group.presentation === "textInput") {
      const entry = textByGroup.get(group.id);
      return entry !== undefined && entry.valid && entry.value.length > 0 ? [] : [group.id];
    }
    return selectedByGroup.has(group.id) ? [] : [group.id];
  });

  const validationWarnings: ProductOptionWarning[] = [
    ...(input.warnings ?? []),
    ...textEntries.flatMap((entry) =>
      entry.validationMessages.map((message) => ({
        code: "textEntryIncomplete" as const,
        groupId: entry.groupId,
        message,
      })),
    ),
  ];

  let canonicalResult: ReturnType<typeof canonicalProductConfigurationResultSchema.parse> | null =
    null;
  if (input.resolver === undefined) {
    validationWarnings.push({
      code: "canonicalResolutionUnavailable",
      message: "Canonical product configuration resolution is unavailable.",
    });
  } else {
    const resolverInput = deepFreeze(
      canonicalProductConfigurationInputSchema.parse({
        productId: context.productId,
        catalogueRevision: context.revision,
        selectedValues,
        textEntries: textEntries.map((entry) => ({ groupId: entry.groupId, value: entry.value })),
      }),
    );
    let rawResolverResult: unknown;
    try {
      rawResolverResult = input.resolver.resolve(resolverInput);
    } catch {
      return failure("RESOLVER_FAILURE", "Canonical product configuration resolution failed.");
    }
    const resolverResult = canonicalProductConfigurationResultSchema.safeParse(rawResolverResult);
    if (!resolverResult.success) {
      return failure(
        "INVALID_RESOLVER_RESULT",
        "Canonical product configuration resolver returned an invalid result.",
      );
    }
    canonicalResult = resolverResult.data;
    const referenceError = validateResolverReferences(context, canonicalResult);
    if (referenceError) return referenceError;
    canonicalResult.disabledOptionValues.forEach((value) =>
      addDisabled(value.groupId, value.valueId, "resolver"),
    );
    canonicalResult.warnings.forEach((message) =>
      validationWarnings.push({ code: "resolverWarning", message }),
    );
    if (!canonicalResult.purchasable && incompleteRequiredGroupIds.length === 0) {
      validationWarnings.push({
        code: "configurationUnavailable",
        message: "The selected canonical product configuration is not purchasable.",
      });
    }
  }

  const resolverDisabledSelection = selectedValues.find((selection) =>
    disabled.get(`${selection.groupId}:${selection.valueId}`)?.has("resolver"),
  );
  if (resolverDisabledSelection) {
    return failure(
      "OPTION_DISABLED",
      `Option value ${resolverDisabledSelection.valueId} is unavailable in the canonical configuration.`,
      resolverDisabledSelection.groupId,
      resolverDisabledSelection.valueId,
    );
  }

  const disabledOptionValues = context.optionGroups.flatMap((group) =>
    group.values.flatMap((value) => {
      const reasons = disabled.get(`${group.id}:${value.id}`);
      return reasons
        ? [
            {
              groupId: group.id,
              valueId: value.id,
              reasons: disabledReasonOrder.filter((reason) => reasons.has(reason)),
            },
          ]
        : [];
    }),
  );

  const selectedMediaReferences = resolveMediaReferences(context, canonicalResult?.mediaAssetIds);
  const allTextEntriesValid = textEntries.every((entry) => entry.valid);
  const result = productOptionResolutionResultSchema.parse({
    productId: context.productId,
    catalogueRevision: context.revision,
    selectedValues,
    textEntryValues: textEntries,
    incompleteRequiredGroupIds,
    disabledOptionValues,
    unavailableCombinations: context.unavailableCombinations,
    dependencyState,
    resolvedConfiguration: canonicalResult?.resolvedConfiguration,
    displayedPrice: canonicalResult?.price ?? context.price,
    displayedCompareAtPrice: canonicalResult?.compareAtPrice ?? context.compareAtPrice,
    displayedAvailability: canonicalResult?.availability ?? context.availability,
    selectedMediaReferences,
    validationWarnings,
    canAddToCart:
      incompleteRequiredGroupIds.length === 0 &&
      allTextEntriesValid &&
      canonicalResult?.purchasable === true,
  });
  return deepFreeze({ ok: true as const, result: deepFreeze(result) });
}

function normalizeSelectionState(
  context: ProductPresentationContext,
  state: ProductOptionSelectionState,
):
  | {
      ok: true;
      selectedValues: ProductOptionSelectionState["selectedValues"];
      textEntries: Array<{
        groupId: string;
        value: string;
        valid: boolean;
        validationMessages: string[];
      }>;
    }
  | ResolutionFailure {
  const groupById = new Map(context.optionGroups.map((group) => [group.id, group]));
  if (
    new Set(state.selectedValues.map((item) => item.groupId)).size !== state.selectedValues.length
  ) {
    return failure("INVALID_SELECTION_STATE", "Enumerated selection groups must be unique.");
  }
  if (new Set(state.textEntries.map((item) => item.groupId)).size !== state.textEntries.length) {
    return failure("INVALID_SELECTION_STATE", "Text-entry selection groups must be unique.");
  }

  for (const selection of state.selectedValues) {
    const group = groupById.get(selection.groupId);
    if (!group) {
      return failure(
        "UNKNOWN_GROUP",
        `Unknown option group: ${selection.groupId}.`,
        selection.groupId,
      );
    }
    if (group.presentation === "textInput") {
      return failure(
        "WRONG_OPTION_KIND",
        `Option group ${selection.groupId} requires text-entry state.`,
        selection.groupId,
      );
    }
    if (!group.values.some((value) => value.id === selection.valueId)) {
      return failure(
        "UNKNOWN_VALUE",
        `Unknown option value ${selection.valueId} for group ${selection.groupId}.`,
        selection.groupId,
        selection.valueId,
      );
    }
  }

  const textEntries: Array<{
    groupId: string;
    value: string;
    valid: boolean;
    validationMessages: string[];
  }> = [];
  for (const entry of state.textEntries) {
    const group = groupById.get(entry.groupId);
    if (!group) {
      return failure("UNKNOWN_GROUP", `Unknown option group: ${entry.groupId}.`, entry.groupId);
    }
    if (group.presentation !== "textInput") {
      return failure(
        "WRONG_OPTION_KIND",
        `Option group ${entry.groupId} requires an enumerated value.`,
        entry.groupId,
      );
    }
    textEntries.push({
      groupId: entry.groupId,
      value: entry.value,
      ...validateTextEntry(group, entry.value),
    });
  }

  const selectedByGroup = new Map(
    state.selectedValues.map((selection) => [selection.groupId, selection]),
  );
  const textByGroup = new Map(textEntries.map((entry) => [entry.groupId, entry] as const));
  return {
    ok: true,
    selectedValues: context.optionGroups.flatMap((group) => {
      const selection = selectedByGroup.get(group.id);
      return selection ? [selection] : [];
    }),
    textEntries: context.optionGroups.flatMap((group) => {
      const entry = textByGroup.get(group.id);
      return entry ? [entry] : [];
    }),
  };
}

function validateTextEntry(group: OptionGroup, value: string) {
  const constraints = group.textEntryConstraints;
  if (group.presentation !== "textInput" || constraints === undefined) {
    return { valid: false, validationMessages: ["Text-entry constraints are unavailable."] };
  }
  const messages: string[] = [];
  const length = Array.from(value).length;
  if (group.required && length === 0) messages.push("This option is required.");
  if (length > 0 && length < constraints.minLength) {
    messages.push(`Enter at least ${constraints.minLength} characters.`);
  }
  if (length > constraints.maxLength) {
    messages.push(`Enter no more than ${constraints.maxLength} characters.`);
  }
  if (!matchesCharacterPolicy(value, constraints.characterPolicy)) {
    messages.push(`Text must follow the ${constraints.characterPolicy} character policy.`);
  }
  return { valid: messages.length === 0, validationMessages: messages };
}

export function textEntryViolatesHardConstraint(group: OptionGroup, value: string): string | null {
  const constraints = group.textEntryConstraints;
  if (group.presentation !== "textInput" || constraints === undefined) {
    return "Text-entry constraints are unavailable.";
  }
  if (Array.from(value).length > constraints.maxLength) {
    return `Text exceeds the maximum length of ${constraints.maxLength}.`;
  }
  if (!matchesCharacterPolicy(value, constraints.characterPolicy)) {
    return `Text violates the ${constraints.characterPolicy} character policy.`;
  }
  return null;
}

function matchesCharacterPolicy(
  value: string,
  policy: "unicodeText" | "lettersAndSpaces" | "lettersNumbersAndSpaces" | "asciiPrintable",
) {
  if (policy === "unicodeText") return !/[\p{Cc}\p{Cf}]/u.test(value);
  if (policy === "lettersAndSpaces") return /^[\p{L}\p{M} '\u2019-]*$/u.test(value);
  if (policy === "lettersNumbersAndSpaces") {
    return /^[\p{L}\p{M}\p{N} .,\u2019'&-]*$/u.test(value);
  }
  return /^[\x20-\x7e]*$/.test(value);
}

function validateResolverReferences(
  context: ProductPresentationContext,
  result: ReturnType<typeof canonicalProductConfigurationResultSchema.parse>,
): ResolutionFailure | null {
  const groupById = new Map(context.optionGroups.map((group) => [group.id, group]));
  for (const disabled of result.disabledOptionValues) {
    const group = groupById.get(disabled.groupId);
    if (
      !group ||
      group.presentation === "textInput" ||
      !group.values.some((value) => value.id === disabled.valueId)
    ) {
      return failure(
        "INVALID_RESOLVER_RESULT",
        "Resolver-disabled values must reference canonical enumerated options.",
        disabled.groupId,
        disabled.valueId,
      );
    }
  }
  const knownMedia = new Set(context.media.map((media) => media.assetId));
  if (result.mediaAssetIds?.some((assetId) => !knownMedia.has(assetId))) {
    return failure(
      "INVALID_RESOLVER_RESULT",
      "Resolved media must reference canonical product media.",
    );
  }
  return null;
}

function resolveMediaReferences(
  context: ProductPresentationContext,
  mediaAssetIds: readonly string[] | undefined,
) {
  if (mediaAssetIds === undefined) return context.media;
  const byId = new Map(context.media.map((media) => [media.assetId, media]));
  return mediaAssetIds.flatMap((assetId) => {
    const media = byId.get(assetId);
    return media ? [media] : [];
  });
}

function failure(
  code: ProductOptionResolutionErrorCode,
  message: string,
  groupId?: string,
  valueId?: string,
): ResolutionFailure {
  const error = productOptionResolutionErrorSchema.parse({
    code,
    message,
    groupId,
    valueId,
  });
  return deepFreeze({ ok: false as const, error, result: null });
}

export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach((nested: unknown) => {
    deepFreeze(nested);
  });
  return value;
}
