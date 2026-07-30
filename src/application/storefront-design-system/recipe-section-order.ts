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
  const order = new Map(recipe.sections.map((section, index) => [section.component, index]));
  const ordered = [...sections];
  const mappedPositions = ordered.flatMap((section, index) =>
    order.has(section.component) ? [index] : [],
  );
  const mappedSections = mappedPositions
    .map((index) => ({ section: ordered[index], originalIndex: index }))
    .sort(
      (left, right) =>
        order.get(left.section.component)! - order.get(right.section.component)! ||
        left.originalIndex - right.originalIndex,
    );

  mappedPositions.forEach((position, index) => {
    ordered[position] = mappedSections[index].section;
  });
  return ordered;
}
