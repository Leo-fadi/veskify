import { expect, test, type Page } from "@playwright/test";
import {
  expectNoStorefrontHorizontalClipping,
  storefrontGeometryViolations,
} from "./storefront-geometry";

async function setAurumHomepageContentCount(page: Page, itemCount: number) {
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = (await indexedDB.databases()).find(
          (candidate) => candidate.name === "veskify",
        );
        return database?.version ?? 0;
      }),
    )
    .toBe(4);
  await page.evaluate(async (count) => {
    type StoredProject = {
      draftSnapshotId: string;
      publishedSnapshotId: string;
    };
    type StoredCollection = {
      id: string;
      slug: string;
      title: { en?: string; fi?: string };
      productIds: string[];
    };
    type StoredCatalogue = {
      id: string;
      products: Array<{ id: string }>;
      collections: StoredCollection[];
    };
    type StoredSection = {
      component: string;
      content: Record<string, unknown>;
    };
    type StoredSnapshot = {
      id: string;
      catalogueRef: string;
      pages: Array<{ type: string; sections: StoredSection[] }>;
    };
    const requestValue = <Value>(request: IDBRequest<Value>) =>
      new Promise<Value>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(
            new Error("Could not read the content-aware storefront fixture.", {
              cause: request.error,
            }),
          );
      });
    const open = indexedDB.open("veskify");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () =>
        reject(new Error("Could not open the storefront fixture database.", { cause: open.error }));
    });
    const requiredStores = ["projects", "catalogues", "snapshots"];
    const missingStores = requiredStores.filter(
      (storeName) => !database.objectStoreNames.contains(storeName),
    );
    if (missingStores.length > 0) {
      throw new Error(
        `Missing stores ${missingStores.join(", ")}; available: ${Array.from(database.objectStoreNames).join(", ")}`,
      );
    }
    const transaction = database.transaction(requiredStores, "readwrite");
    const project = await requestValue(
      transaction.objectStore("projects").get("project_aurum_nordic") as IDBRequest<
        StoredProject | undefined
      >,
    );
    if (!project) throw new Error("Missing Aurum project fixture.");
    const [draft, published] = await Promise.all([
      requestValue(
        transaction.objectStore("snapshots").get(project.draftSnapshotId) as IDBRequest<
          StoredSnapshot | undefined
        >,
      ),
      requestValue(
        transaction.objectStore("snapshots").get(project.publishedSnapshotId) as IDBRequest<
          StoredSnapshot | undefined
        >,
      ),
    ]);
    if (!draft || !published) {
      throw new Error("Missing Aurum content-aware fixture state.");
    }
    const catalogue = await requestValue(
      transaction.objectStore("catalogues").get(draft.catalogueRef) as IDBRequest<
        StoredCatalogue | undefined
      >,
    );
    if (!catalogue) throw new Error("Missing Aurum catalogue fixture.");
    const sourceCollection = catalogue.collections[0];
    while (catalogue.collections.length < count) {
      const index = catalogue.collections.length;
      catalogue.collections.push({
        ...structuredClone(sourceCollection),
        id: `collection_content_aware_${index}`,
        slug: `content-aware-${index}`,
        title: {
          en: `Content-aware collection ${index}`,
          fi: `Sisältötietoinen mallisto ${index}`,
        },
      });
    }
    const collectionIds = catalogue.collections.slice(0, count).map((collection) => collection.id);
    const productIds = catalogue.products.slice(0, count).map((product) => product.id);
    for (const snapshot of [draft, published]) {
      const home = snapshot.pages.find((candidate) => candidate.type === "home");
      const categories = home?.sections.find(
        (section) => section.component === "featuredCategories",
      );
      const products = home?.sections.find((section) => section.component === "productGrid");
      if (!categories || !products) {
        throw new Error("Missing content-aware homepage sections.");
      }
      categories.content = { ...categories.content, collectionIds };
      products.content = { ...products.content, productIds };
      transaction.objectStore("snapshots").put(snapshot);
    }
    transaction.objectStore("catalogues").put(catalogue);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(new Error("Could not update the storefront fixture.", { cause: transaction.error }));
      transaction.onabort = () =>
        reject(
          new Error("The storefront fixture update was aborted.", {
            cause: transaction.error,
          }),
        );
    });
    database.close();
  }, itemCount);
}

test("loads the Vesko Storefront Studio entry and exposes the working journeys", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Shape a storefront/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start storefront setup" })).toHaveAttribute(
    "href",
    "/projects/new",
  );
  await expect(page.getByRole("link", { name: "Continue editing storefront" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic/editor",
  );
  await expect(page.getByRole("link", { name: "Preview storefront" })).toHaveAttribute(
    "href",
    "/projects/project_aurum_nordic",
  );
  await expect(page.getByText(/Batch 1|stops before onboarding|editor is deferred/i)).toHaveCount(
    0,
  );
  await expect(page.getByText(/Veskify|Puck|Developer tools|Open visual editor/i)).toHaveCount(0);
});

test("loads the isolated Puck compatibility proof", async ({ page }) => {
  await page.goto("/puck-proof");

  await expect(page.getByRole("heading", { name: "Puck adapter proof" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Puck editor proof" })).toBeVisible();
  await expect(page.getByText(/Publishing remains deferred|No draft handoff/i)).toBeVisible();
});

test("loads the complete persisted homepage and switches locale by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects/project_aurum_nordic");

  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find your piece" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aurum favourites" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Light, held close" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quiet forms, lasting meaning" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notes from the north" })).toBeVisible();
  await expect(page.locator("header.store-header")).toHaveCount(1);
  await expect(page.locator("footer.store-footer")).toHaveCount(1);
  expect(
    await page
      .locator("header.store-header")
      .evaluate((header) =>
        Boolean(
          header.compareDocumentPosition(document.querySelector("main")!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  expect(
    await page
      .locator("footer.store-footer")
      .evaluate((footer) =>
        Boolean(
          document.querySelector("main")!.compareDocumentPosition(footer) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  await expect(page.getByText("1 290 €")).toBeVisible();
  const ringsLink = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Rings" });
  await ringsLink.focus();
  await expect(ringsLink).toBeFocused();
  const finnishControl = page.getByRole("radio", { name: "Suomi" });
  await finnishControl.focus();
  await expect(finnishControl).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Tehty pohjoiseen valoon" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Löydä oma korusi" })).toBeVisible();
  await expect(page.getByText("Current locale: FI")).toBeVisible();
  await expect(page.getByRole("region", { name: "Puck editor proof" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /publish|save|edit|delete/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Liity uutiskirjeeseen" }).click();
  await expect(page.getByText("Vain demo — sähköpostia ei lähetetä.")).toBeVisible();
  await expectNoStorefrontHorizontalClipping(page);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`renders without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projects/project_aurum_nordic");
    await expect(page.getByText("Draft preview")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Storefront language" })).toBeVisible();
    await expectNoStorefrontHorizontalClipping(page);
    await expect(page.locator("header.store-header")).toBeVisible();
    await expect(page.locator("footer.store-footer")).toBeVisible();
  });
}

for (const width of [375, 768, 1024, 1440]) {
  test(`balances 0, 1, 2, 3 and many homepage items at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.goto("/projects/project_aurum_nordic");
    for (const itemCount of [0, 1, 2, 3, 5]) {
      await setAurumHomepageContentCount(page, itemCount);
      await page.reload();
      await expect(page.getByText("Draft preview")).toBeVisible();
      if (itemCount === 0) {
        await expect(
          page.getByText("Collections will appear here when they are available."),
        ).toBeVisible();
        await expect(
          page.getByText("Products will appear here when they are available."),
        ).toBeVisible();
      } else {
        const categoryGrid = page.locator(`.category-grid[data-item-count="${itemCount}"]`);
        const productGrid = page.locator(`.product-grid[data-item-count="${itemCount}"]`);
        await expect(categoryGrid).toBeVisible();
        await expect(productGrid).toBeVisible();
        await expect(categoryGrid.locator(".category-card")).toHaveCount(itemCount);
        await expect(productGrid.locator(".product-card")).toHaveCount(itemCount);
        const [categoryColumns, productColumns] = await Promise.all([
          categoryGrid.evaluate(
            (grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length,
          ),
          productGrid.evaluate(
            (grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length,
          ),
        ]);
        const expectedCategoryColumns =
          width < 640 ? 1 : itemCount === 1 ? 1 : itemCount === 3 ? 3 : 2;
        const expectedProductColumns =
          width < 640 ? 1 : width < 1024 ? (itemCount === 1 ? 1 : 2) : Math.min(itemCount, 4);
        expect(categoryColumns).toBe(expectedCategoryColumns);
        expect(productColumns).toBe(expectedProductColumns);
      }
      await expectNoStorefrontHorizontalClipping(page);
      const screenshotName =
        (width === 1440 && itemCount === 1) ||
        (width === 1024 && itemCount === 2) ||
        (width === 768 && itemCount === 5)
          ? `content-aware-${itemCount === 5 ? "many" : `${itemCount}-item`}-${width}px.png`
          : undefined;
      if (screenshotName) {
        await page.screenshot({
          fullPage: true,
          path: testInfo.outputPath(screenshotName),
        });
      }
    }
  });
}

test("keeps Finnish storefront navigation and calls to action inside the tablet viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/projects/project_aurum_nordic");
  await expect(page.getByRole("heading", { name: "Made for northern light" })).toBeVisible();

  const finnish = page.getByRole("radio", { name: "Suomi" });
  await finnish.focus();
  await page.keyboard.press("Space");

  await expect(page.getByRole("heading", { name: "Tehty pohjoiseen valoon" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tutustu sormuksiin" })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Päänavigaatio" })
      .getByRole("link", { name: "Sormukset" }),
  ).toBeVisible();
  await expectNoStorefrontHorizontalClipping(page);
});

test("detects clipped storefront descendants while excluding decorative and inactive content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 500, height: 500 });
  await page.setContent(`
    <style>
      body { margin: 0; }
      .project-preview__storefront { width: 320px; overflow: hidden; }
      #oversized { width: 480px; }
      .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      .carousel { width: 240px; overflow-x: auto; }
      .carousel button { width: 480px; }
    </style>
    <main class="project-preview__storefront">
      <button id="contained">Contained action</button>
      <div aria-hidden="true" style="width: 480px">Decorative full bleed</div>
      <span class="visually-hidden">Screen reader helper</span>
      <dialog><button>Closed drawer action</button></dialog>
      <div class="carousel"><button>Scrollable carousel action</button></div>
      <button id="oversized">Oversized visible action</button>
    </main>
  `);

  const violations = await storefrontGeometryViolations(page);
  expect(violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        element: expect.stringContaining("button#oversized"),
        kind: "outside-boundary",
      }),
    ]),
  );
  expect(violations.map((violation) => violation.element).join("\n")).not.toMatch(
    /Decorative full bleed|Screen reader helper|Closed drawer action|Scrollable carousel action/,
  );

  await page.locator("#oversized").evaluate((element) => element.remove());
  await expectNoStorefrontHorizontalClipping(page);
});

for (const [name, brandName] of [
  ["long multi-word", "Pohjoisen käsityöläiskorujen ateljee"],
  ["long unbroken", "PohjoisenKäsityöläiskorujenAteljeeJaMuotoilustudio"],
] as const) {
  for (const width of [768, 1024]) {
    test(`keeps a ${name} merchant brand contained at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/projects/project_aurum_nordic");
      const brand = page.locator("header.store-header .store-brand");
      await brand.evaluate((element, value) => {
        element.textContent = value;
      }, brandName);

      await expect(brand).toHaveAccessibleName(brandName);
      await expectNoStorefrontHorizontalClipping(page);

      const [brandBox, navigationBox, toolsBox] = await Promise.all([
        brand.boundingBox(),
        page.locator("header.store-header nav").boundingBox(),
        page.locator(".store-header__tools").boundingBox(),
      ]);
      expect(brandBox).not.toBeNull();
      expect(navigationBox).not.toBeNull();
      expect(toolsBox).not.toBeNull();
      expect(brandBox!.x + brandBox!.width).toBeLessThanOrEqual(navigationBox!.x + 1);
      expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(toolsBox!.x + 1);
      expect(brandBox!.height).toBeLessThanOrEqual(144);
    });
  }
}
