type RecipeSection = { component: string };

/**
 * Applies a registered recipe's composition to the components it recognises
 * without moving compatibility sections that are outside that recipe. The
 * components themselves are not changed: their canonical content, bindings,
 * assets, visibility, and identities remain intact.
 */
export function orderSectionsForRecipe<Section extends RecipeSection>(
  sections: readonly Section[],
  recipe: { sections: readonly RecipeSection[] },
): Section[] {
  const recipePositionsByComponent = new Map<string, number[]>();
  recipe.sections.forEach((section, index) => {
    const positions = recipePositionsByComponent.get(section.component) ?? [];
    positions.push(index);
    recipePositionsByComponent.set(section.component, positions);
  });
  const seenOccurrences = new Map<string, number>();
  const ordered = [...sections];
  const mappedSections = ordered.flatMap((section, originalIndex) => {
    const occurrence = seenOccurrences.get(section.component) ?? 0;
    seenOccurrences.set(section.component, occurrence + 1);
    const recipePosition = recipePositionsByComponent.get(section.component)?.[occurrence];
    return recipePosition === undefined ? [] : [{ section, originalIndex, recipePosition }];
  });
  const mappedPositions = mappedSections.map((entry) => entry.originalIndex);
  mappedSections
    .sort(
      (left, right) =>
        left.recipePosition - right.recipePosition || left.originalIndex - right.originalIndex,
    )
    .forEach((entry, index) => {
      ordered[mappedPositions[index]] = entry.section;
    });

  return ordered;
}
