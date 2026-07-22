import {
  productPresentationContextSchema,
  type ProductPresentationContext,
} from "@/domain/component-platform";
import {
  deepFreeze,
  resolveProductOptions,
  textEntryViolatesHardConstraint,
} from "@/domain/product-presentation/resolve-product-options";
import {
  productOptionResolutionErrorSchema,
  productOptionSelectionIntentSchema,
  type CanonicalProductConfigurationResolver,
  type ProductOptionResolutionErrorCode,
  type ProductOptionResolutionOutcome,
  type ProductOptionResolutionResult,
  type ProductOptionSelectionIntent,
  type ProductOptionSelectionState,
  type ProductOptionWarning,
} from "@/domain/product-presentation/contracts";

type OptionGroup = ProductPresentationContext["optionGroups"][number];

export function initializeProductOptionEngine(
  contextInput: unknown,
  resolver?: CanonicalProductConfigurationResolver,
): ProductOptionResolutionOutcome {
  const contextResult = productPresentationContextSchema.safeParse(contextInput);
  if (!contextResult.success) {
    return resolveProductOptions({
      context: contextInput,
      selectionState: { selectedValues: [], textEntries: [] },
      resolver,
    });
  }
  const initialState: ProductOptionSelectionState = {
    selectedValues: contextResult.data.selectedValues.flatMap((selection) =>
      "valueId" in selection ? [{ groupId: selection.groupId, valueId: selection.valueId }] : [],
    ),
    textEntries: contextResult.data.selectedValues.flatMap((selection) =>
      "enteredText" in selection
        ? [{ groupId: selection.groupId, value: selection.enteredText }]
        : [],
    ),
  };
  const normalized = pruneDependentSelections(contextResult.data, initialState);
  return resolveProductOptions({
    context: contextResult.data,
    selectionState: normalized.state,
    resolver,
    warnings: normalized.warnings,
  });
}

export function applyProductOptionIntent(input: {
  context: unknown;
  previousResult: ProductOptionResolutionResult;
  intent: unknown;
  resolver?: CanonicalProductConfigurationResolver;
}): ProductOptionResolutionOutcome {
  const contextResult = productPresentationContextSchema.safeParse(input.context);
  if (!contextResult.success) {
    return preservePrevious(
      input.previousResult,
      "INVALID_CONTEXT",
      "Product presentation context is invalid.",
    );
  }
  const context = contextResult.data;
  if (
    input.previousResult.productId !== context.productId ||
    input.previousResult.catalogueRevision !== context.revision
  ) {
    return preservePrevious(
      input.previousResult,
      "STALE_RESULT",
      "The previous option result does not match the canonical product revision.",
    );
  }
  const intentResult = productOptionSelectionIntentSchema.safeParse(input.intent);
  if (!intentResult.success) {
    return preservePrevious(
      input.previousResult,
      "INVALID_INTENT",
      "Product option intent is invalid.",
    );
  }

  const groupById = new Map(context.optionGroups.map((group) => [group.id, group]));
  const group =
    "groupId" in intentResult.data ? groupById.get(intentResult.data.groupId) : undefined;
  if ("groupId" in intentResult.data && !group) {
    return preservePrevious(
      input.previousResult,
      "UNKNOWN_GROUP",
      `Unknown option group: ${intentResult.data.groupId}.`,
      intentResult.data.groupId,
    );
  }

  const state: ProductOptionSelectionState = {
    selectedValues: input.previousResult.selectedValues.map((selection) => ({ ...selection })),
    textEntries: input.previousResult.textEntryValues.map((entry) => ({
      groupId: entry.groupId,
      value: entry.value,
    })),
  };
  const intentFailure = applyIntentToState(state, intentResult.data, group, input.previousResult);
  if (intentFailure) {
    return preservePrevious(
      input.previousResult,
      intentFailure.code,
      intentFailure.message,
      intentFailure.groupId,
      intentFailure.valueId,
    );
  }

  const normalized = pruneDependentSelections(context, state);
  const next = resolveProductOptions({
    context,
    selectionState: normalized.state,
    resolver: input.resolver,
    warnings: normalized.warnings,
  });
  if (!next.ok) {
    return deepFreeze({ ...next, result: input.previousResult });
  }
  return next;
}

function applyIntentToState(
  state: ProductOptionSelectionState,
  intent: ProductOptionSelectionIntent,
  group: OptionGroup | undefined,
  previous: ProductOptionResolutionResult,
): {
  code: ProductOptionResolutionErrorCode;
  message: string;
  groupId?: string;
  valueId?: string;
} | null {
  if (intent.type === "resetSelections") {
    state.selectedValues = [];
    state.textEntries = [];
    return null;
  }
  if (!group) return null;
  if (intent.type === "selectEnumeratedValue") {
    if (group.presentation === "textInput") {
      return {
        code: "WRONG_OPTION_KIND",
        message: `Option group ${group.id} requires text entry.`,
        groupId: group.id,
      };
    }
    if (!group.values.some((value) => value.id === intent.valueId)) {
      return {
        code: "UNKNOWN_VALUE",
        message: `Unknown option value ${intent.valueId} for group ${group.id}.`,
        groupId: group.id,
        valueId: intent.valueId,
      };
    }
    if (!previous.dependencyState.find((state) => state.groupId === group.id)?.satisfied) {
      return {
        code: "DEPENDENCY_UNSATISFIED",
        message: `Option group ${group.id} has unmet dependencies.`,
        groupId: group.id,
      };
    }
    if (
      previous.disabledOptionValues.some(
        (value) => value.groupId === group.id && value.valueId === intent.valueId,
      )
    ) {
      return {
        code: "OPTION_DISABLED",
        message: `Option value ${intent.valueId} is unavailable.`,
        groupId: group.id,
        valueId: intent.valueId,
      };
    }
    state.selectedValues = [
      ...state.selectedValues.filter((selection) => selection.groupId !== group.id),
      { groupId: group.id, valueId: intent.valueId },
    ];
    return null;
  }
  if (intent.type === "clearOptionalSelection") {
    if (group.presentation === "textInput") {
      return {
        code: "WRONG_OPTION_KIND",
        message: `Option group ${group.id} requires a text-option intent.`,
        groupId: group.id,
      };
    }
    if (group.required) {
      return {
        code: "REQUIRED_SELECTION_CANNOT_BE_CLEARED",
        message: `Required option group ${group.id} cannot be cleared individually.`,
        groupId: group.id,
      };
    }
    state.selectedValues = state.selectedValues.filter(
      (selection) => selection.groupId !== group.id,
    );
    return null;
  }
  if (group.presentation !== "textInput") {
    return {
      code: "WRONG_OPTION_KIND",
      message: `Option group ${group.id} requires an enumerated value.`,
      groupId: group.id,
    };
  }
  if (intent.type === "clearTextOption") {
    state.textEntries = state.textEntries.filter((entry) => entry.groupId !== group.id);
    return null;
  }
  if (!previous.dependencyState.find((state) => state.groupId === group.id)?.satisfied) {
    return {
      code: "DEPENDENCY_UNSATISFIED",
      message: `Option group ${group.id} has unmet dependencies.`,
      groupId: group.id,
    };
  }
  const hardConstraint = textEntryViolatesHardConstraint(group, intent.value);
  if (hardConstraint) {
    return {
      code: "TEXT_CONSTRAINT_VIOLATION",
      message: hardConstraint,
      groupId: group.id,
    };
  }
  state.textEntries = [
    ...state.textEntries.filter((entry) => entry.groupId !== group.id),
    { groupId: group.id, value: intent.value },
  ];
  return null;
}

function pruneDependentSelections(
  context: ProductPresentationContext,
  input: ProductOptionSelectionState,
): { state: ProductOptionSelectionState; warnings: ProductOptionWarning[] } {
  const selected = new Map(input.selectedValues.map((selection) => [selection.groupId, selection]));
  const text = new Map(input.textEntries.map((entry) => [entry.groupId, entry]));
  const groups = new Map(context.optionGroups.map((group) => [group.id, group]));
  const warnings: ProductOptionWarning[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    context.optionGroups.forEach((group) => {
      if (!selected.has(group.id) && !text.has(group.id)) return;
      if (dependenciesSatisfied(group, groups, selected, text)) return;
      selected.delete(group.id);
      text.delete(group.id);
      warnings.push({
        code: "dependentSelectionCleared",
        groupId: group.id,
        message: `Selection for ${group.id} was cleared because its prerequisite changed.`,
      });
      changed = true;
    });
  }
  return {
    state: {
      selectedValues: context.optionGroups.flatMap((group) => {
        const selection = selected.get(group.id);
        return selection ? [selection] : [];
      }),
      textEntries: context.optionGroups.flatMap((group) => {
        const entry = text.get(group.id);
        return entry ? [entry] : [];
      }),
    },
    warnings,
  };
}

function dependenciesSatisfied(
  group: OptionGroup,
  groups: ReadonlyMap<string, OptionGroup>,
  selected: ReadonlyMap<string, { groupId: string; valueId: string }>,
  text: ReadonlyMap<string, { groupId: string; value: string }>,
) {
  return group.dependsOn.every((dependency) => {
    const dependencyGroup = groups.get(dependency.groupId);
    if (!dependencyGroup) return false;
    if (dependencyGroup.presentation === "textInput") {
      const entry = text.get(dependency.groupId);
      if (!entry || entry.value.length === 0) return false;
      const constraints = dependencyGroup.textEntryConstraints;
      return (
        constraints !== undefined &&
        Array.from(entry.value).length >= constraints.minLength &&
        textEntryViolatesHardConstraint(dependencyGroup, entry.value) === null
      );
    }
    const selection = selected.get(dependency.groupId);
    if (!selection) return false;
    return dependency.valueIds === undefined || dependency.valueIds.includes(selection.valueId);
  });
}

function preservePrevious(
  previous: ProductOptionResolutionResult,
  code: ProductOptionResolutionErrorCode,
  message: string,
  groupId?: string,
  valueId?: string,
): ProductOptionResolutionOutcome {
  const error = productOptionResolutionErrorSchema.parse({
    code,
    message,
    groupId,
    valueId,
  });
  return deepFreeze({ ok: false as const, error, result: previous });
}
