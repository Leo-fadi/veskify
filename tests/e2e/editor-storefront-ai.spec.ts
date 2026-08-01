import { expect, test, type Locator, type Page } from "@playwright/test";
import { p905dExactTokenRefinementRequest } from "../fixtures/p9-05d-exact-token-refinement";
import { p9r07ExactDesignSystemRequest } from "../fixtures/p9r-07-design-system";
import { openEditorAssistant } from "./editor-assistant";

const editorUrl = "/projects/project_aurum_nordic/editor";
const storefrontInstruction =
  "Across the entire storefront, change only the global colour palette and typography. " +
  "Use primary #7B4A2D, secondary #2A1F1B, accent #C7975D, background #FFF9F3, surface #FFFFFF, text #211A17, muted text #6C5B52, and border #E3D3C7. " +
  "Use Georgia headings and Inter body text. Preserve every layout, section, product, image, route, and approved asset.";
const chronologicalTokenOnlyInstruction =
  "Change only the storefront colours and typography. Use #F6F1E8 for backgrounds, #2F3A32 for primary text and buttons, #A58F78 for secondary surfaces, and #D8C8B6 for borders. Use an elegant serif for headings and a clean sans-serif for body text. Preserve all layouts, sections, products and images.";
const chronologicalStructuralInstruction =
  "Redesign the whole storefront in a modern technical direction. Use compact spacing, crisp surfaces, commerce-focused collection cards, structured product discovery and a specification-led product-detail page. Preserve all catalogue data and approved assets.";

async function selectHomepageHero(page: Page) {
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  await canvas.getByText("Made for northern light", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeChecked({
    timeout: 3_000,
  });
  return canvas;
}

async function openSectionActions(sectionActions: Locator) {
  const details = sectionActions.locator("details");
  if (!(await details.evaluate((element: HTMLDetailsElement) => element.open))) {
    await sectionActions.locator("summary").click();
  }
  await expect(details).toHaveJSProperty("open", true);
  await expect(sectionActions.getByRole("button", { name: "Duplicate" })).toBeVisible();
}

async function openStorefrontProposal(page: Page, instruction = storefrontInstruction) {
  await openEditorAssistant(page);
  await page.getByRole("radio", { name: "Entire storefront" }).check();
  await page.getByLabel("Your request").fill(instruction);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/ai/whole-storefront-proposals") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create proposal" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page.getByLabel("Storefront design proposal")).toBeVisible();
  return response;
}

async function acceptStorefrontProposal(page: Page) {
  await page.getByRole("button", { name: "Accept and apply" }).click();
  await expect(page.getByRole("dialog", { name: "Apply this storefront proposal?" })).toBeVisible();
  await page.getByRole("button", { name: "Apply storefront proposal" }).click();
}

test("selected-section proposal uses the existing editor flow", async ({ page }) => {
  await page.goto(editorUrl);
  await selectHomepageHero(page);
  await page.getByLabel("Your request").fill("Improve the selected hero.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
});

test("selected-section target falls back to Current page when its section disappears", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await selectHomepageHero(page);

  await page.getByLabel("Storefront page").selectOption("page_collection_rings");

  await expect(page.getByRole("radio", { name: "Current page" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Selected section" })).toBeDisabled();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
});

test("current-page proposal uses the existing editor flow", async ({ page }) => {
  await page.goto(editorUrl);
  await expect(page.getByRole("radio", { name: "Current page" })).toBeChecked();
  await page.getByLabel("Your request").fill("Make the layout more minimal.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toContainText("Home");
});

test("entire-storefront proposal shows complete merchant review", async ({ page }) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  const review = page.getByLabel("Storefront design proposal");
  await expect(review).toContainText("Homepage");
  await expect(review).toContainText("Rings");
  await expect(review).toContainText("Aurora Ring 585");
  await expect(review).not.toContainText(/page_home|APPLY_APPROVED|storefront_proposal_/);
});

test("exact P9-05D token refinement issues one canonical storefront POST", async ({ page }) => {
  await page.goto(editorUrl);
  const canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  let postCount = 0;
  page.on("request", (request) => {
    if (
      request.url().includes("/api/ai/whole-storefront-proposals") &&
      request.method() === "POST"
    ) {
      postCount += 1;
    }
  });

  const response = await openStorefrontProposal(page, p905dExactTokenRefinementRequest);
  const body = response.request().postDataJSON() as {
    requestId: string;
    capability: string;
    tokenRefinementPlan: { spacing: unknown; preservePageStructure: boolean } | null;
  };
  expect(postCount).toBe(1);
  expect(body.requestId).toMatch(/^attempt_/);
  expect(body.capability).toBe("approvedColorTypographyDirection");
  expect(body.tokenRefinementPlan).toMatchObject({
    spacing: null,
    preservePageStructure: true,
    preserveComponentVariants: true,
    preserveApprovedAssets: true,
    preserveCanonicalCommerce: true,
    palette: {
      colors: {
        primary: "#201A17",
        secondary: "#C9A27A",
        accent: "#6B2E3D",
        background: "#FFF8F0",
        surface: "#E7D8C8",
        text: "#201A17",
        border: "#E7D8C8",
      },
    },
    typography: { headingFont: "system-serif", bodyFont: "system-sans" },
  });
  await acceptStorefrontProposal(page);
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#201A17");
  await expect(canvasRoot).toHaveCSS("--brand-color-text", "#201A17");
  await expect(canvasRoot).toHaveCSS("--brand-color-surface", "#E7D8C8");
  await expect(canvasRoot).toHaveCSS("--brand-color-border", "#E7D8C8");
  await expect(canvasRoot).toHaveCSS(
    "--brand-font-heading",
    'Georgia, Cambria, "Times New Roman", serif',
  );
  await expect(canvasRoot).toHaveCSS(
    "--brand-font-body",
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  );
  await expect(canvasRoot).toHaveCSS("--brand-spacing-density", "1");
});

test("entire-storefront Accept, Undo and Redo remain one editor action", async ({ page }) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  await acceptStorefrontProposal(page);
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
});

test("Save draft reloads the complete accepted storefront without changing Published", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  await acceptStorefrontProposal(page);
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();

  await page.reload();
  let canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");
  for (const pageId of ["page_collection_rings", "page_product_aurora"]) {
    await page.getByLabel("Storefront page").selectOption(pageId);
    canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
    await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");
  }
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");

  await page.goto("/projects/project_aurum_nordic/published");
  await expect(page.getByLabel("Published storefront")).toBeVisible();
  await expect(page.locator(".project-preview")).toHaveCSS("--brand-color-primary", "#8A5A2B");
});

test("Reject closes the storefront review without draft mutation", async ({ page }) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
});

test("stale storefront previews leave the canvas before normal editing resumes", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await openStorefrontProposal(page);
  await expect(page.getByLabel("Proposal preview canvas")).toBeVisible();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");

  await page.getByRole("radio", { name: "Suomi" }).check();

  await expect(page.getByLabel("Proposal preview canvas")).toHaveCount(0);
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await expect(page.getByLabel("Visual editor canvas")).toBeVisible();
  await expect(page.getByTestId("draft-status")).toHaveAccessibleName("Luonnoksen tila");
  await expect(page.getByTestId("draft-status")).toContainText("Ei tallentamattomia muutoksia");
});

test("accepted storefront history survives a later rejected proposal", async ({ page }) => {
  await page.goto(editorUrl);
  const canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await openStorefrontProposal(page);
  await acceptStorefrontProposal(page);
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");

  await page.getByRole("button", { name: "Start over" }).click();
  await openStorefrontProposal(page);
  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();

  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
});

test("multiple accepted storefront proposals undo and redo in chronological order", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await openStorefrontProposal(page, chronologicalTokenOnlyInstruction);
  await acceptStorefrontProposal(page);
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#2F3A32");
  await expect(canvasRoot).toHaveCSS("--brand-spacing-density", "1");

  await page.getByRole("button", { name: "Start over" }).click();
  await openStorefrontProposal(page, chronologicalStructuralInstruction);
  await acceptStorefrontProposal(page);
  await expect(page.getByTestId("draft-status")).toContainText("Unsaved changes");
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#2F3A32");
  await expect(canvasRoot).toHaveCSS("--brand-spacing-density", "0.85");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#2F3A32");
  await expect(canvasRoot).toHaveCSS("--brand-spacing-density", "1");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await expect(canvasRoot).toHaveCSS("--brand-spacing-density", "1");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#2F3A32");
  await expect(canvasRoot).toHaveCSS("--brand-spacing-density", "1");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#2F3A32");
  await expect(canvasRoot).toHaveCSS("--brand-spacing-density", "0.85");
});

test("page edits after storefront Accept are undone before the composite storefront change", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  const canvasRoot = page.frameLocator("iframe").locator("[data-veskify-canvas-root]");
  await openStorefrontProposal(page);
  await acceptStorefrontProposal(page);
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");

  await canvas.getByText("Made for northern light", { exact: true }).click();
  const sectionActions = page.getByLabel("Selected section actions");
  await openSectionActions(sectionActions);
  await sectionActions.getByRole("button", { name: "Duplicate" }).click();
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvas.getByText("Made for northern light", { exact: true })).toHaveCount(1);
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#7B4A2D");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvasRoot).toHaveCSS("--brand-color-primary", "#8A5A2B");
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
});

test("retryable storefront failure requires an explicit Retry", async ({ page }) => {
  await page.route("**/api/ai/whole-storefront-proposals", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        failure: { category: "providerUnavailable", retryable: true },
      }),
    }),
  );
  await page.goto(editorUrl);
  await page.getByRole("radio", { name: "Entire storefront" }).check();
  await page.getByLabel("Your request").fill(storefrontInstruction);
  await page.getByRole("button", { name: "Create proposal" }).click();
  const retry = page.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  await expect(retry).toBeFocused();
  await expect(page.getByTestId("draft-status")).toContainText("No unsaved changes");
});

test("target switch makes an old storefront proposal unusable", async ({ page }) => {
  await page.goto(editorUrl);
  await openStorefrontProposal(page);
  await page.getByRole("radio", { name: "Current page" }).check();
  await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept and apply" })).toHaveCount(0);
  await expect(page.getByLabel("Design request")).toHaveAttribute("data-agent-state", "superseded");
});

test("canonical context change makes a ready proposal stale and impossible to accept", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await page.getByLabel("Your request").fill("Make the layout more minimal.");
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page.getByLabel("Design proposal")).toBeVisible();
  await page.getByRole("radio", { name: "Suomi" }).check();
  await expect(page.getByTestId("design-proposal")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept and apply" })).toHaveCount(0);
});

test("target selector and storefront review actions are keyboard operable", async ({ page }) => {
  await page.goto(editorUrl);
  const currentPage = page.getByRole("radio", { name: "Current page" });
  await currentPage.focus();
  await currentPage.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Entire storefront" })).toBeChecked();
  await page.getByLabel("Your request").fill(storefrontInstruction);
  await page.getByLabel("Your request").press("Control+Enter");
  await expect(page.getByLabel("Storefront design proposal").getByRole("heading")).toBeFocused();
  await page.getByRole("button", { name: "Reject" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Storefront design proposal")).toHaveCount(0);
});

test("keeps compact confirmation focus and Escape ownership with the topmost modal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(editorUrl);
  await openStorefrontProposal(page);

  const drawer = page.getByRole("dialog", { name: "Contextual tools" });
  const accept = drawer.getByRole("button", { name: "Accept and apply" });
  await accept.click();
  const confirmation = page.getByRole("dialog", { name: "Apply this storefront proposal?" });
  const heading = confirmation.getByRole("heading");
  const apply = confirmation.getByRole("button", { name: "Apply storefront proposal" });
  const keepReviewing = confirmation.getByRole("button", { name: "Keep reviewing" });

  await expect(heading).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(keepReviewing).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(apply).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(keepReviewing).toBeFocused();
  await heading.focus();
  await page.keyboard.press("Tab");
  await expect(apply).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await expect(accept).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`storefront target and review have no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(editorUrl);
    await openStorefrontProposal(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test("P9R-07 exact design system reaches every rendered storefront surface and action", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const response = await openStorefrontProposal(page, p9r07ExactDesignSystemRequest);
  const responseBody = (await response.json()) as {
    proposal: {
      proposal: {
        target: { affectedPageIds: string[]; designSystemTarget: unknown };
        operations: Array<{ operation: { type: string } }>;
        originalStorefront: {
          navigation: unknown;
          pages: unknown;
          catalogueRef: string;
        };
        proposedStorefront: {
          navigation: unknown;
          pages: unknown;
          catalogueRef: string;
        };
      };
    };
  };
  const proposal = responseBody.proposal.proposal;

  expect(proposal.operations.map(({ operation }) => operation.type)).toEqual([
    "APPLY_APPROVED_BRAND_COLOURS",
    "APPLY_APPROVED_BRAND_TYPOGRAPHY",
  ]);
  expect(proposal.target.affectedPageIds).toHaveLength(3);
  expect(proposal.target.designSystemTarget).toBeTruthy();
  expect(proposal.proposedStorefront.pages).toEqual(proposal.originalStorefront.pages);
  expect(proposal.proposedStorefront.navigation).toEqual(proposal.originalStorefront.navigation);
  expect(proposal.proposedStorefront.catalogueRef).toBe(proposal.originalStorefront.catalogueRef);

  await acceptStorefrontProposal(page);
  const canvas = page.getByLabel("Visual editor canvas").frameLocator("iframe");
  const hero = canvas.locator(".store-hero");
  await expect(hero).toHaveCSS(
    "background-color",
    /^(?:rgb\(255, 255, 255\)|color\(srgb 1 1 1\))$/,
  );
  await expect(hero.getByRole("heading").first()).toHaveCSS("color", "rgb(17, 17, 17)");

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();

  await page.goto("/projects/project_aurum_nordic/collections/rings");
  await expect(page.getByRole("heading", { level: 1, name: "Rings" })).toBeVisible();
  await expect(page.locator("footer.store-footer")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".project-preview")).toHaveCSS("color", "rgb(17, 17, 17)");

  await page.goto("/projects/project_aurum_nordic/products/aurora-ring-585");
  await expect(page.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
  await expect(page.locator("footer.store-footer")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  const purchaseAction = page.getByRole("button", { name: "Add to cart", exact: true });
  await expect(purchaseAction).toBeDisabled();
  await expect(purchaseAction).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(purchaseAction).toHaveCSS("color", "rgb(17, 17, 17)");
  await page.getByRole("button", { name: "17", exact: true }).click();
  await expect(purchaseAction).toBeEnabled();
  await expect(purchaseAction).toHaveCSS("background-color", "rgb(181, 71, 8)");
  await expect(purchaseAction).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByText("1 290 €")).toBeVisible();
  await expect(
    page.locator('[data-component="dynamicProductDetail"] p[aria-live="polite"]', {
      hasText: "In stock",
    }),
  ).toBeVisible();
});
