import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Locale = "en" | "fi";
type Viewport = 375 | 1440;

const evidenceDirectory = process.env.P10B18B05_EVIDENCE_DIR;
if (!evidenceDirectory) throw new Error("P10B-18B-05 requires a retained evidence directory.");
const captureDirectory = resolve(evidenceDirectory, "captures");
mkdirSync(captureDirectory, { recursive: true });

const profileTruth = [
  [
    "content-about-story",
    "about",
    "story opening > origin narrative > values",
    "approved fact document story/paragraphs",
    "optional approved editorial media",
    "none",
    "meaningfully-distinct",
    "aboutStory",
  ],
  [
    "content-about-process",
    "about",
    "process opening > ordered approved stages",
    "approved story steps",
    "none required",
    "none",
    "meaningfully-distinct",
    "aboutProcess",
  ],
  [
    "content-contact-channels",
    "contact",
    "fast channel identity > executable channel stack",
    "approved contact-channel blocks",
    "none",
    "mailto/tel only from exact facts",
    "meaningfully-distinct",
    "contactChannels",
  ],
  [
    "content-contact-directory",
    "contact",
    "directory opening > grouped channel records",
    "approved contact-channel blocks",
    "none",
    "mailto/tel only from exact facts",
    "meaningfully-distinct",
    "contactDirectory",
  ],
  [
    "content-location-directory",
    "store-locations",
    "location opening > address/hour cards",
    "approved location blocks",
    "none",
    "none",
    "contextually-distinct",
    "locationDirectory",
  ],
  [
    "content-location-appointments",
    "store-locations",
    "location directory alias",
    "approved location blocks",
    "none",
    "no appointment action authority",
    "reclassified",
    "locationDirectory",
  ],
  [
    "content-faq-disclosure",
    "faq",
    "FAQ opening > semantic disclosures",
    "approved FAQ blocks",
    "none",
    "none",
    "contextually-distinct",
    "faqDisclosure",
  ],
  [
    "content-faq-topic-guide",
    "faq",
    "FAQ disclosure alias",
    "approved FAQ blocks without topic authority",
    "none",
    "none",
    "reclassified",
    "faqDisclosure",
  ],
  [
    "content-service-details",
    "shipping/returns",
    "service opening > scannable detail cards",
    "approved policy-section blocks",
    "none",
    "none",
    "meaningfully-distinct",
    "serviceDetails",
  ],
  [
    "content-policy-reading",
    "policy-legal",
    "legal opening > deliberate long-form sequence",
    "approved policy-section blocks",
    "none",
    "none",
    "meaningfully-distinct",
    "policyReading",
  ],
  [
    "content-generic-reading",
    "generic-content",
    "narrow opening > intentional reading flow",
    "approved paragraphs",
    "none",
    "none",
    "contextually-distinct",
    "genericReading",
  ],
  [
    "content-generic-editorial",
    "generic-content",
    "editorial opening > story > supporting material",
    "approved story/paragraphs",
    "optional approved editorial media",
    "none",
    "evidence-limited",
    "genericEditorial",
  ],
  [
    "landing-campaign-editorial",
    "campaign-editorial",
    "campaign proposition > support > optional exact CTA",
    "approved campaign facts",
    "optional approved media",
    "exact canonical navigation pair",
    "contextually-distinct",
    "campaignEditorial",
  ],
  [
    "landing-campaign-image-led",
    "campaign-editorial",
    "approved art > campaign proposition > optional CTA",
    "approved campaign facts",
    "required exact approved presentation media",
    "exact canonical navigation pair",
    "evidence-limited",
    "campaignImageLed",
  ],
  [
    "landing-campaign-story",
    "campaign-editorial",
    "narrative opening > approved progression > proposition",
    "approved campaign story",
    "optional approved media",
    "exact canonical navigation pair",
    "evidence-limited",
    "campaignStory",
  ],
] as const;

const utilityTruth = [
  [
    "populated-cart",
    "identity > line items > controls > totals > checkout/continuation",
    "continue-checkout",
    "continue-shopping + line controls",
    "cart runtime",
    "stack lines and summary",
  ],
  [
    "empty-cart",
    "empty-cart identity > concise explanation > action",
    "continue-shopping",
    "none",
    "empty cart runtime",
    "single full-width action",
  ],
  [
    "unavailable-cart",
    "unavailable identity > explanation",
    "none",
    "none",
    "missing/unresolvable cart runtime",
    "compact fail-closed panel",
  ],
  [
    "checkout-boundary",
    "boundary identity > canonical continuation explanation > actions",
    "continue-checkout",
    "continue-shopping",
    "checkout runtime",
    "stacked boundary/actions",
  ],
  [
    "no-results",
    "result identity > exact query/filters > recovery",
    "clear-search or clear-filters",
    "continue-shopping",
    "no-results runtime",
    "stacked recovery and filter chips",
  ],
  [
    "generic-empty",
    "generic empty identity > message > continuation",
    "continue-shopping",
    "none",
    "empty runtime",
    "single full-width action",
  ],
  [
    "recoverable-error",
    "problem identity > safe message > recovery",
    "retry",
    "continue-shopping",
    "recoverable error runtime",
    "stacked recovery actions",
  ],
  [
    "not-found",
    "404 identity > useful explanation > return path",
    "return-home",
    "none",
    "not-found runtime",
    "large code scales down",
  ],
  [
    "loading",
    "progress identity > transient message",
    "none",
    "none",
    "loading runtime only",
    "compact branded progress",
  ],
] as const;

const contentRecords: unknown[] = [];
const utilityRecords: unknown[] = [];
let captureCount = 0;

function query(values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  return params.toString();
}

async function geometry(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const root = document.documentElement;
    const bounds = element.getBoundingClientRect();
    const visibleChildren = Array.from(
      element.querySelectorAll("section, article, header, aside, ol, ul"),
    )
      .map((child) => child.getBoundingClientRect())
      .filter((rect) => rect.height > 0)
      .sort((a, b) => a.top - b.top);
    let largestGap = 0;
    for (let index = 1; index < visibleChildren.length; index += 1) {
      largestGap = Math.max(
        largestGap,
        visibleChildren[index].top - visibleChildren[index - 1].bottom,
      );
    }
    return {
      viewportWidth: window.innerWidth,
      documentWidth: root.scrollWidth,
      documentHeight: root.scrollHeight,
      componentWidth: Math.round(bounds.width),
      componentHeight: Math.round(bounds.height),
      largestInternalGap: Math.max(0, Math.round(largestGap)),
    };
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = resolve(
    captureDirectory,
    `${String(captureCount + 1).padStart(2, "0")}-${name}.png`,
  );
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
  captureCount += 1;
  return path;
}

async function assertLocalRuntime(page: Page) {
  const external = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => {
        try {
          const url = new URL(name);
          return url.protocol.startsWith("http") && url.origin !== window.location.origin;
        } catch {
          return false;
        }
      }),
  );
  expect(external).toEqual([]);
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
}

test.describe.serial("P10B-18B-05 retained commercial quality matrix", () => {
  test("content/support matrix", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    const cases: ReadonlyArray<{
      id: string;
      profile: string;
      family?: string;
      locale: Locale;
      viewport: Viewport;
      media?: "approved";
      density?: "sparse";
      action?: "paired" | "label-only";
      capture?: boolean;
    }> = [
      {
        id: "about-story-mobile",
        profile: "content-about-story",
        locale: "en",
        viewport: 375,
        capture: true,
      },
      {
        id: "about-story-wide",
        profile: "content-about-story",
        locale: "en",
        viewport: 1440,
        capture: true,
      },
      {
        id: "about-story-sparse",
        profile: "content-about-story",
        locale: "en",
        viewport: 1440,
        density: "sparse",
      },
      {
        id: "about-process-wide",
        profile: "content-about-process",
        locale: "en",
        viewport: 1440,
        capture: true,
      },
      {
        id: "contact-channels-mobile",
        profile: "content-contact-channels",
        locale: "en",
        viewport: 375,
        capture: true,
      },
      {
        id: "contact-directory-wide",
        profile: "content-contact-directory",
        locale: "en",
        viewport: 1440,
        capture: true,
      },
      {
        id: "location-directory",
        profile: "content-location-directory",
        locale: "en",
        viewport: 1440,
        capture: true,
      },
      {
        id: "location-appointments-reclassified",
        profile: "content-location-appointments",
        locale: "en",
        viewport: 1440,
      },
      {
        id: "faq-disclosure-mobile",
        profile: "content-faq-disclosure",
        locale: "en",
        viewport: 375,
        capture: true,
      },
      {
        id: "faq-disclosure-wide",
        profile: "content-faq-disclosure",
        locale: "en",
        viewport: 1440,
        capture: true,
      },
      {
        id: "faq-topic-reclassified",
        profile: "content-faq-topic-guide",
        locale: "fi",
        viewport: 1440,
      },
      {
        id: "returns-service-mobile",
        profile: "content-service-details",
        family: "returns-information",
        locale: "en",
        viewport: 375,
        capture: true,
      },
      {
        id: "shipping-service-wide-fi",
        profile: "content-service-details",
        family: "shipping-information",
        locale: "fi",
        viewport: 1440,
        capture: true,
      },
      {
        id: "policy-mobile",
        profile: "content-policy-reading",
        locale: "en",
        viewport: 375,
        capture: true,
      },
      {
        id: "policy-wide-fi",
        profile: "content-policy-reading",
        locale: "fi",
        viewport: 1440,
        capture: true,
      },
      {
        id: "generic-reading",
        profile: "content-generic-reading",
        locale: "en",
        viewport: 1440,
        capture: true,
      },
      {
        id: "generic-editorial",
        profile: "content-generic-editorial",
        locale: "en",
        viewport: 1440,
        capture: true,
      },
      {
        id: "campaign-editorial",
        profile: "landing-campaign-editorial",
        locale: "en",
        viewport: 1440,
        action: "paired",
        capture: true,
      },
      {
        id: "campaign-image-mobile",
        profile: "landing-campaign-image-led",
        locale: "en",
        viewport: 375,
        media: "approved",
        action: "paired",
        capture: true,
      },
      {
        id: "campaign-image-wide-fi",
        profile: "landing-campaign-image-led",
        locale: "fi",
        viewport: 1440,
        media: "approved",
        action: "paired",
        capture: true,
      },
      {
        id: "campaign-image-no-media",
        profile: "landing-campaign-image-led",
        locale: "en",
        viewport: 1440,
        action: "paired",
        capture: true,
      },
      {
        id: "campaign-story",
        profile: "landing-campaign-story",
        locale: "en",
        viewport: 1440,
        action: "paired",
        capture: true,
      },
      {
        id: "campaign-label-only",
        profile: "landing-campaign-editorial",
        locale: "en",
        viewport: 1440,
        action: "label-only",
      },
      {
        id: "campaign-navigation-only",
        profile: "landing-campaign-editorial",
        locale: "en",
        viewport: 1440,
      },
    ];

    for (const entry of cases) {
      await page.setViewportSize({
        width: entry.viewport,
        height: entry.viewport === 375 ? 900 : 1000,
      });
      await page.goto(
        `/p10b-12-content-support-proof?${query({
          profile: entry.profile,
          family: entry.family,
          locale: entry.locale,
          media: entry.media,
          density: entry.density,
          action: entry.action,
        })}`,
      );
      const root = page.locator("[data-p10b-12-content-support-profile]");
      const component = page.locator('[data-component="contentSupport"]');
      await expect(root).toHaveAttribute("data-active-locale", entry.locale);
      await expect(component).toBeVisible();
      const expected = profileTruth.find(([profile]) => profile === entry.profile);
      if (!expected) throw new Error(`Missing truth record for ${entry.profile}.`);
      const observedVariant = await component.getAttribute("data-variant");
      const expectedVariant =
        entry.profile === "landing-campaign-image-led" && entry.media !== "approved"
          ? "campaignEditorial"
          : expected[7];
      expect(observedVariant).toBe(expectedVariant);

      if (entry.profile === "content-location-appointments") {
        await expect(component).toHaveAttribute("data-reclassified-from", "locationAppointments");
      }
      if (entry.profile === "content-faq-topic-guide") {
        await expect(component).toHaveAttribute("data-reclassified-from", "faqTopicGuide");
      }
      if (entry.profile === "landing-campaign-image-led" && entry.media !== "approved") {
        await expect(component).toHaveAttribute("data-reclassified-from", "campaignImageLed");
        await expect(component.locator("img")).toHaveCount(0);
      }
      if (entry.profile === "landing-campaign-image-led" && entry.media === "approved") {
        await expect(component).toHaveAttribute("data-variant", "campaignImageLed");
        await expect(component.locator("img")).toHaveCount(1);
      }
      if (entry.profile === "content-about-process") {
        expect(await component.locator("ol li").count()).toBeGreaterThanOrEqual(3);
      }
      if (entry.profile === "content-contact-channels") {
        expect(await component.locator('a[href^="mailto:"], a[href^="tel:"]').count()).toBe(3);
      }
      const campaignActions = component.locator('[data-content-support-action="campaign"]');
      if (entry.action === "paired") {
        await expect(campaignActions).toHaveCount(1);
        expect(await campaignActions.getAttribute("href")).not.toBe("#");
      } else {
        await expect(campaignActions).toHaveCount(0);
      }
      await assertLocalRuntime(page);
      const observedGeometry = await geometry(page, '[data-component="contentSupport"]');
      const screenshot = entry.capture ? await capture(page, testInfo, entry.id) : null;
      contentRecords.push({
        ...entry,
        expectedVariant,
        observedVariant,
        reclassifiedFrom: await component.getAttribute("data-reclassified-from"),
        semanticRegions: await component
          .locator("header, section, article, details, ol, ul, aside")
          .evaluateAll((nodes) => nodes.map((node) => node.tagName.toLowerCase())),
        approvedImageCount: await component.locator("img").count(),
        campaignActionCount: await campaignActions.count(),
        geometry: observedGeometry,
        screenshot,
      });
    }
    expect(errors).toEqual([]);
  });

  test("utility matrix", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const cases: ReadonlyArray<{
      id: string;
      profile: string;
      scenario?: string;
      locale: Locale;
      viewport: Viewport;
      expectedState: string;
      capture?: boolean;
      capabilities?: "none";
      handler?: "absent";
    }> = [
      {
        id: "cart-populated-mobile",
        profile: "commerce-utility-cart",
        locale: "en",
        viewport: 375,
        expectedState: "cart-populated",
        capture: true,
      },
      {
        id: "cart-populated-wide",
        profile: "commerce-utility-cart",
        locale: "en",
        viewport: 1440,
        expectedState: "cart-populated",
        capture: true,
      },
      {
        id: "cart-empty",
        profile: "commerce-utility-cart",
        scenario: "empty",
        locale: "fi",
        viewport: 1440,
        expectedState: "cart-empty",
        capture: true,
      },
      {
        id: "cart-unavailable",
        profile: "commerce-utility-cart",
        scenario: "unavailable",
        locale: "en",
        viewport: 1440,
        expectedState: "unavailable",
        capture: true,
      },
      {
        id: "checkout-boundary",
        profile: "commerce-utility-checkout",
        locale: "en",
        viewport: 1440,
        expectedState: "checkout",
        capture: true,
      },
      {
        id: "no-results-query",
        profile: "commerce-utility-no-results",
        scenario: "query",
        locale: "en",
        viewport: 1440,
        expectedState: "no-results",
        capture: true,
      },
      {
        id: "no-results-filters",
        profile: "commerce-utility-no-results",
        scenario: "filters",
        locale: "fi",
        viewport: 375,
        expectedState: "no-results",
        capture: true,
      },
      {
        id: "generic-empty",
        profile: "commerce-utility-empty",
        locale: "en",
        viewport: 1440,
        expectedState: "empty",
        capture: true,
      },
      {
        id: "recoverable-error",
        profile: "commerce-utility-error",
        locale: "en",
        viewport: 1440,
        expectedState: "error",
        capture: true,
      },
      {
        id: "not-found",
        profile: "commerce-utility-not-found",
        locale: "fi",
        viewport: 1440,
        expectedState: "not-found",
        capture: true,
      },
      {
        id: "loading",
        profile: "commerce-utility-cart",
        scenario: "loading",
        locale: "en",
        viewport: 375,
        expectedState: "loading",
        capture: true,
      },
      {
        id: "unrecoverable-error",
        profile: "commerce-utility-error",
        scenario: "unrecoverable",
        locale: "en",
        viewport: 1440,
        expectedState: "error",
      },
      {
        id: "unsupported-capabilities",
        profile: "commerce-utility-checkout",
        locale: "en",
        viewport: 1440,
        expectedState: "checkout",
        capabilities: "none",
      },
      {
        id: "missing-handler",
        profile: "commerce-utility-error",
        locale: "en",
        viewport: 1440,
        expectedState: "error",
        handler: "absent",
      },
    ];

    for (const entry of cases) {
      await page.setViewportSize({
        width: entry.viewport,
        height: entry.viewport === 375 ? 900 : 1000,
      });
      await page.goto(
        `/p10b-13-utility-proof?${query({
          profile: entry.profile,
          scenario: entry.scenario,
          locale: entry.locale,
          capabilities: entry.capabilities,
          handler: entry.handler,
        })}`,
      );
      const root = page.locator("[data-p10b-13-profile]");
      const state = page.locator("[data-utility-state]");
      await expect(root).toHaveAttribute("data-active-locale", entry.locale);
      await expect(root).toHaveAttribute("data-runtime-persisted", "false");
      await expect(state).toHaveAttribute("data-utility-state", entry.expectedState);
      await expect(state).toBeVisible();
      const actions = state.locator("[data-utility-action]");
      const primaryActions = state.locator('[data-utility-action][data-action-tone="primary"]');
      expect(await primaryActions.count()).toBeLessThanOrEqual(1);
      if (entry.capabilities === "none" || entry.handler === "absent") {
        await expect(actions).toHaveCount(0);
      }
      if (entry.expectedState === "unavailable" || entry.expectedState === "loading") {
        await expect(actions).toHaveCount(0);
      }
      if (entry.expectedState === "loading") {
        await expect(state).toHaveAttribute("role", "status");
        await expect(state).toHaveAttribute("aria-live", "polite");
        await expect(state).toHaveAttribute("aria-busy", "true");
      }
      if (entry.expectedState === "error") {
        await expect(state).toHaveAttribute("role", "alert");
        await expect(state).toHaveAttribute("aria-live", "assertive");
      }
      if (entry.id === "cart-populated-wide" || entry.id === "cart-populated-mobile") {
        await expect(state.locator('[data-utility-action="continue-checkout"]')).toHaveAttribute(
          "data-action-tone",
          "primary",
        );
        await expect(state.locator('[data-utility-action="continue-shopping"]')).toHaveAttribute(
          "data-action-tone",
          "secondary",
        );
      }
      if (entry.id === "checkout-boundary") {
        await expect(state.locator('[data-utility-action="continue-checkout"]')).toHaveAttribute(
          "data-action-tone",
          "primary",
        );
      }
      if (entry.id === "recoverable-error") {
        await expect(state.locator('[data-utility-action="retry"]')).toHaveAttribute(
          "data-action-tone",
          "primary",
        );
      }
      if (entry.id === "generic-empty") {
        await expect(state.locator('[data-utility-action="continue-shopping"]')).toHaveAttribute(
          "data-action-tone",
          "primary",
        );
      }
      if (entry.id === "not-found") {
        await expect(state.locator('[data-utility-action="return-home"]')).toHaveAttribute(
          "data-action-tone",
          "primary",
        );
      }
      await assertLocalRuntime(page);
      const observedGeometry = await geometry(page, "[data-utility-state]");
      const screenshot = entry.capture ? await capture(page, testInfo, entry.id) : null;
      utilityRecords.push({
        ...entry,
        observedRuntimeKind: await root.getAttribute("data-runtime-kind"),
        actions: await actions.evaluateAll((nodes) =>
          nodes.map((node) => ({
            id: node.getAttribute("data-utility-action"),
            tone: node.getAttribute("data-action-tone"),
          })),
        ),
        regions: await state
          .locator("[data-state-region], [data-cart-region]")
          .evaluateAll((nodes) =>
            nodes.map(
              (node) =>
                node.getAttribute("data-state-region") ?? node.getAttribute("data-cart-region"),
            ),
          ),
        geometry: observedGeometry,
        screenshot,
      });
    }
    expect(errors).toEqual([]);
    expect(captureCount).toBe(30);
  });

  test.afterAll(() => {
    const comparisons = [
      [
        "About/story generic composition",
        "origin/main reused one generic reading/story shell",
        "current story opening, origin narrative and values hierarchy",
        "about-story-wide.png",
      ],
      [
        "About story vs process collapse",
        "origin/main process passed an ignored prop and rendered no approved stages",
        "current process renders ordered approved stages; story remains narrative",
        "about-process-wide.png",
      ],
      [
        "FAQ collapse",
        "origin/main topic-guide claimed a separate profile without topic-group authority",
        "current generation explicitly aliases/reclassifies to semantic disclosure",
        "faq-disclosure-wide.png",
      ],
      [
        "Location appointment distinction",
        "origin/main appointment profile implied an independent appointment anatomy",
        "current generation reclassifies to location-directory authority with no booking promise",
        "location-directory.png",
      ],
      [
        "Image-led campaign missing media",
        "origin/main could retain image-led identity with blank/decorative media space",
        "current media-free generation becomes campaignEditorial; exact approved media retains campaignImageLed",
        "campaign-image-no-media.png",
      ],
      [
        "Generic utility shell/cart hierarchy",
        "origin/main non-cart states shared one centered heading/body shell and weak action dominance",
        "current states have dedicated anatomy and one truthful dominant action",
        "cart-populated-wide.png",
      ],
    ];
    const report = {
      task: "P10B-18B-05",
      runId: process.env.P10B18B05_EVIDENCE_RUN_ID,
      generatedAt: new Date().toISOString(),
      providerCalls: 0,
      veskoCalls: 0,
      realPublications: 0,
      captureCount,
      historicalScreenshotLimitation:
        "The frozen P10B-18A browser sample retained no content/support surfaces. Before states therefore use the exact origin/main source/DOM collapse audit, paired with current retained captures, rather than claiming unavailable historical screenshots.",
      profileTruth,
      utilityTruth,
      contentRecords,
      utilityRecords,
      comparisons,
    };
    writeFileSync(
      resolve(evidenceDirectory, "p10b-18b-05-evidence.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    writeFileSync(
      resolve(evidenceDirectory, "content-support-truth-table.json"),
      `${JSON.stringify(profileTruth, null, 2)}\n`,
    );
    writeFileSync(
      resolve(evidenceDirectory, "utility-state-table.json"),
      `${JSON.stringify(utilityTruth, null, 2)}\n`,
    );
    writeFileSync(
      resolve(evidenceDirectory, "before-after-comparisons.md"),
      [
        "# P10B-18B-05 before/after comparisons",
        "",
        "> Historical limitation: the frozen P10B-18A browser sample retained no content/support surfaces. The before column records the exact origin/main source/DOM audit; the after column is backed by the named current capture.",
        "",
        "| Comparison | Before authority/anatomy | Current result | Current capture |",
        "| --- | --- | --- | --- |",
        ...comparisons.map(
          ([name, before, after, screenshot]) =>
            `| ${name} | ${before} | ${after} | captures/${screenshot} |`,
        ),
        "",
      ].join("\n"),
    );
  });
});
