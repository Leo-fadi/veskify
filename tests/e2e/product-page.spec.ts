import { expect, test } from "@playwright/test";
import { expectNoStorefrontHorizontalClipping } from "./storefront-geometry";

const url = "/projects/project_aurum_nordic/products/aurora-ring-585";
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
] as const;

test("loads the bilingual Aurora product draft with visual-only controls", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
  await expect(page.getByText("Yellow gold", { exact: true })).toBeVisible();
  await expect(page.getByText("14K", { exact: true })).toBeVisible();
  await expect(page.getByText("€1,290")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart", exact: true })).toBeVisible();
  await expect(page.getByText(/0\/20 characters.*Enter 0-20 characters/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lumi Halo Ring" })).toBeVisible();
  await expect(page.locator('[data-component="dynamicProductDetail"]')).toBeVisible();
  const gallery = page.getByRole("region", { name: "Product gallery" });
  const firstImage = gallery.getByRole("button", { name: "View product image 1" });
  const secondImage = gallery.getByRole("button", { name: "View product image 2" });
  await secondImage.click();
  await expect(secondImage).toHaveAttribute("aria-pressed", "true");
  await expect(gallery.locator("figure img")).toHaveAttribute("alt", "Aurora ring side detail");
  await firstImage.focus();
  await page.keyboard.press("Enter");
  await expect(firstImage).toHaveAttribute("aria-pressed", "true");
  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { level: 1, name: "Aurora-sormus 585" })).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Materiaali, hoito ja toimitus" })).toBeVisible();
  await expectNoStorefrontHorizontalClipping(page);
  await expect(page.getByText(/Puck editor|property panel/i)).toHaveCount(0);
});

test("keeps product configuration controls reachable at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();

  const size = page.getByRole("button", { name: "17", exact: true });
  await size.scrollIntoViewIfNeeded();
  await size.focus();
  await expect(size).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(size).toHaveAttribute("aria-pressed", "true");

  const engraving = page.getByRole("textbox", { name: "Engraving Optional" });
  await engraving.scrollIntoViewIfNeeded();
  await engraving.fill("Aurum");
  await expect(engraving).toHaveValue("Aurum");
  await expectNoStorefrontHorizontalClipping(page);
});

for (const { width, height } of viewports) {
  test(`English product page has no horizontal clipping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: "Aurora Ring 585" })).toBeVisible();
    await expectNoStorefrontHorizontalClipping(page);
  });

  test(`Finnish product controls remain usable without clipping at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await page.getByRole("radio", { name: "Suomi" }).check();

    const productDetail = page.locator('[data-component="dynamicProductDetail"]');
    const heading = page.getByRole("heading", { level: 1, name: "Aurora-sormus 585" });
    const price = page.getByLabel("Hinta").getByText("1 290 €");
    const availability = productDetail.locator('p[aria-live="polite"]', {
      hasText: "Varastossa",
    });
    const sku = productDetail.locator("p").filter({ hasText: "RING-AUR-585" });
    const size = page.getByRole("button", { name: "17", exact: true });
    const engraving = page.getByRole("textbox", { name: "Kaiverrus Valinnainen" });
    const purchaseAction = page.getByRole("button", {
      name: "Lisää ostoskoriin",
      exact: true,
    });
    const galleryAction = page.getByRole("button", { name: "Näytä tuotekuva 1" });
    const specifications = page.getByRole("heading", { name: "Tekniset tiedot" });

    await expect(heading).toBeVisible();
    await expect(price).toBeVisible();
    await expect(availability).toBeVisible();
    await expect(sku).toBeVisible();
    await expect(page.getByRole("heading", { name: "Valitse tuotevaihtoehdot" })).toBeVisible();
    await expect(size).toBeVisible();
    await expect(size).toBeEnabled();
    await expect(engraving).toBeVisible();
    await expect(engraving).toBeEditable();
    await expect(purchaseAction).toBeDisabled();
    await expect(galleryAction).toBeVisible();
    await expect(specifications).toBeVisible();
    await expect(page.getByText("Materiaali, hoito ja toimitus")).toBeVisible();

    await galleryAction.focus();
    await expect(galleryAction).toBeFocused();
    await size.focus();
    await expect(size).toBeFocused();
    await size.click();
    await expect(size).toHaveAttribute("aria-pressed", "true");
    await expect(purchaseAction).toBeEnabled();
    await engraving.fill("Pohjoinen valo");
    await expect(engraving).toHaveValue("Pohjoinen valo");

    const [legend, sizeBox, engravingLabel, engravingBox] = await Promise.all([
      page.locator('[data-option-group-id="option_aurora_size"] legend').boundingBox(),
      size.boundingBox(),
      page.locator('[data-option-group-id="option_aurora_engraving"] label').boundingBox(),
      engraving.boundingBox(),
    ]);
    expect(legend).not.toBeNull();
    expect(sizeBox).not.toBeNull();
    expect(engravingLabel).not.toBeNull();
    expect(engravingBox).not.toBeNull();
    expect(legend!.y + legend!.height).toBeLessThanOrEqual(sizeBox!.y + 1);
    expect(engravingLabel!.y + engravingLabel!.height).toBeLessThanOrEqual(engravingBox!.y + 1);

    await expectNoStorefrontHorizontalClipping(page);
  });
}
