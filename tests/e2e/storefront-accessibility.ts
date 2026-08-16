import { expect, type Locator, type Page } from "@playwright/test";
import { storefrontMainContentId } from "@/components/registry/contract";

const focusableSelector = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'summary:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export async function expectStorefrontSemanticIntegrity(root: Locator): Promise<void> {
  await expect(root.locator("main")).toHaveCount(1);
  await expect(root.locator("h1")).toHaveCount(1);
  await expect(root.locator(`main[id="${storefrontMainContentId}"]`)).toHaveCount(1);
  await expect(root.locator('header[data-frame-region="header"], header.store-header')).toHaveCount(
    1,
  );
  await expect(root.locator('footer[data-frame-region="footer"], footer.store-footer')).toHaveCount(
    1,
  );
  const headingLevels = await root
    .locator("h1, h2, h3, h4, h5, h6")
    .evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
  expect(headingLevels[0]).toBe(1);
  headingLevels.slice(1).forEach((level, index) => {
    expect(
      level - headingLevels[index],
      "Storefront headings must not skip levels.",
    ).toBeLessThanOrEqual(1);
  });
}

export async function expectStorefrontTouchGeometry(
  root: Locator,
  minimumTarget = 24,
): Promise<void> {
  const failures = await root.locator(focusableSelector).evaluateAll(
    (elements, minimum) =>
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (
          element.closest("[inert], [aria-hidden='true']") ||
          style.visibility === "hidden" ||
          style.display === "none" ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return [];
        }
        if (rect.width >= minimum && rect.height >= minimum) return [];
        return [
          `${element.tagName.toLowerCase()}[${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? "unnamed"}] ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        ];
      }),
    minimumTarget,
  );
  expect(failures, "Interactive storefront targets must have bounded usable geometry.").toEqual([]);
}

/** Tabs through the visible storefront and proves focus never leaves viewport geometry or traps. */
export async function expectBoundedStorefrontKeyboardTraversal({
  page,
  root,
  maximumSteps = 160,
}: {
  page: Page;
  root: Locator;
  maximumSteps?: number;
}): Promise<readonly string[]> {
  const expectedCount = await root.evaluate(
    (storefrontRoot, selector) =>
      [...storefrontRoot.querySelectorAll(selector)].filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          !element.closest("[inert], [aria-hidden='true']") &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0
        );
      }).length,
    focusableSelector,
  );
  if (expectedCount + 1 > maximumSteps) {
    throw new Error(
      `Storefront exposes ${expectedCount} focusable controls, exceeding the ${maximumSteps}-step keyboard budget.`,
    );
  }
  const first = root.locator(`a[href="#${storefrontMainContentId}"]`).first();
  await first.focus();
  await expect(first).toBeVisible();
  const firstState = await root.evaluate((storefrontRoot, selector) => {
    const elements = [...storefrontRoot.querySelectorAll(selector)].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        !element.closest("[inert], [aria-hidden='true']") &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    const active = storefrontRoot.ownerDocument.activeElement;
    return {
      index: elements.indexOf(active as Element),
      identity:
        active instanceof Element
          ? `${active.tagName.toLowerCase()}:${active.getAttribute("aria-label") ?? active.textContent?.trim().slice(0, 60) ?? ""}`
          : "unavailable",
    };
  }, focusableSelector);
  expect(firstState.index).toBeGreaterThanOrEqual(0);
  const visitedIndices = new Set<number>([firstState.index]);
  const visited = [firstState.identity];
  let exitedStorefront = false;
  for (let step = 0; step < expectedCount + 1; step += 1) {
    await page.keyboard.press("Tab");
    const state = await root.evaluate((storefrontRoot, selector) => {
      const active = storefrontRoot.ownerDocument.activeElement as HTMLElement | null;
      if (!active) return null;
      if (!storefrontRoot.contains(active)) return { insideStorefront: false } as const;
      const elements = [...storefrontRoot.querySelectorAll(selector)].filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          !element.closest("[inert], [aria-hidden='true']") &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0
        );
      });
      const rect = active.getBoundingClientRect();
      const style = getComputedStyle(active);
      return {
        insideStorefront: true,
        index: elements.indexOf(active),
        identity: `${active.tagName.toLowerCase()}:${active.getAttribute("aria-label") ?? active.textContent?.trim().slice(0, 60) ?? ""}`,
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.left < storefrontRoot.ownerDocument.defaultView!.innerWidth &&
          rect.top < storefrontRoot.ownerDocument.defaultView!.innerHeight &&
          style.visibility !== "hidden" &&
          style.display !== "none",
      };
    }, focusableSelector);
    if (!state) continue;
    if (!state.insideStorefront) {
      exitedStorefront = true;
      break;
    }
    expect(
      state.index,
      `Focused control ${state.identity} must be in the expected tab order.`,
    ).toBeGreaterThanOrEqual(0);
    expect(state.visible, `Focused control ${state.identity} must remain visible.`).toBe(true);
    expect(
      visitedIndices.has(state.index),
      `Keyboard focus repeated ${state.identity} before every storefront control was reached.`,
    ).toBe(false);
    visitedIndices.add(state.index);
    visited.push(state.identity);
  }
  expect(visitedIndices.size).toBe(expectedCount);
  expect(
    exitedStorefront,
    "Keyboard traversal must leave the storefront without trapping focus.",
  ).toBe(true);
  return visited;
}
