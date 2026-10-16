import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect, test, type Request } from "@playwright/test";
import { p10b18dCaptureSurfaces } from "../helpers/p10b-18d-preview-evidence";
import { parseP10B18DAcceptanceInspectionResponse } from "../helpers/p10b-18d-live-safe-evidence";
import {
  ar06dCapture,
  ar06dHeader,
  ar06dHideDevelopmentTools,
  ar06dPreviewUrl,
  ar06dRecord,
  ar06dSettleMedia,
  ar06dStoredAuthority,
  ar06dSurfaceChecks,
} from "../helpers/ar-06d-review-browser";
import {
  ar10aActualFonts,
  ar10aMeasure,
  ar10aReadCandidateIdentity,
} from "../helpers/ar-10a-review-browser";

const output = process.env.AR10A_OUTPUT_DIR!,
  origin = process.env.AR10A_ORIGIN!,
  token = process.env.AR10A_ACCEPTANCE_TOKEN!;
const mode = process.env.AR10A_MODE;
const fingerprint = "v1_50184_0784a748aa03ccbb5e081601548c20c63070658d24a5e3fa5344ef6093da9061";
if (
  !["trace", "diagnostic", "about-diagnostic", "full"].includes(mode ?? "") ||
  Buffer.byteLength(token ?? "") < 32
)
  throw new Error("Missing offline execution assignment");

test("re-renders the pinned genuine candidate without generation or persistence", async () => {
  const browser = await chromium.connectOverCDP(process.env.AR10A_CDP_URL!);
  const context = browser.contexts()[0],
    page = await context.newPage();
  const scrub = (value: string) =>
    value.replaceAll(token, "[redacted]").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
  const safeUrl = (value: string) => {
    const url = new URL(value);
    return scrub(`${url.origin}${url.pathname}`);
  };
  let events: unknown[] = [],
    droppedEvents = 0,
    navigation = "initial";
  const pending = new Map<
    Request,
    { url: string; type: string; started: number; navigation: string }
  >();
  const observe = (value: Record<string, unknown>) => {
    if (events.length < 600) events.push({ observedDuring: navigation, ...value });
    else droppedEvents++;
  };
  page.on("pageerror", (error) => observe({ event: "pageerror", message: scrub(error.message) }));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      observe({
        event: "console",
        type: message.type(),
        message: scrub(message.text()).slice(0, 2000),
      });
  });
  page.on("request", (request) => {
    if (["document", "script", "fetch", "xhr"].includes(request.resourceType()))
      pending.set(request, {
        url: safeUrl(request.url()),
        type: request.resourceType(),
        started: Date.now(),
        navigation,
      });
  });
  page.on("response", (response) => {
    const request = response.request();
    if (pending.has(request))
      observe({
        event: "response",
        ...pending.get(request),
        status: response.status(),
        at: Date.now(),
      });
  });
  page.on("requestfinished", (request) => {
    pending.delete(request);
  });
  page.on("requestfailed", (request) => {
    observe({
      event: "requestfailed",
      url: safeUrl(request.url()),
      originatingNavigation: pending.get(request)?.navigation ?? "untracked-resource",
      error: scrub(request.failure()?.errorText ?? "unknown"),
    });
    pending.delete(request);
  });
  const loadingObservation = async () => ({
    at: new Date().toISOString(),
    url: safeUrl(page.url()),
    pending: [...pending.values()],
    pendingScope: "Cumulative; each request identifies its originating navigation",
    events,
    droppedEvents,
    document: await page.evaluate(
      (candidate) => ({
        readyState: document.readyState,
        visibility: document.visibilityState,
        focused: document.hasFocus(),
        storefrontCount: document.querySelectorAll(".project-preview__storefront").length,
        stateText: document.querySelector(".project-state")?.textContent?.slice(0, 3000) ?? null,
        scriptCount: document.scripts.length,
        serializedCandidatePresent: JSON.stringify(
          (window as typeof window & { __next_f?: unknown[] }).__next_f ?? [],
        ).includes(candidate),
        resources: performance
          .getEntriesByType("resource")
          .map((entry) => ({
            path: new URL(entry.name).pathname,
            duration: entry.duration,
            responseEnd: (entry as PerformanceResourceTiming).responseEnd,
            type: (entry as PerformanceResourceTiming).initiatorType,
          }))
          .slice(-256),
      }),
      fingerprint,
    ),
  });
  const forbidden: string[] = [];
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (
      url.origin !== origin ||
      (!["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
        !(request.method() === "POST" && url.pathname === "/__nextjs_disable_dev_indicator"))
    ) {
      forbidden.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue({ headers: { ...request.headers(), [ar06dHeader]: token } });
  });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await ar06dHideDevelopmentTools(page);
  const storedBefore = await ar06dStoredAuthority(page);
  const inspect = async () => {
    const response = await context.request.get(`${origin}/api/demo/p10b-16p-04`, {
      headers: { [ar06dHeader]: token },
    });
    expect(response.status()).toBe(200);
    return parseP10B18DAcceptanceInspectionResponse(await response.json());
  };
  expect((await inspect()).providerCallCount).toBe(0);
  const home = p10b18dCaptureSurfaces[0];
  const protectedUrl = ar06dPreviewUrl(origin, home, fingerprint, "en");
  expect((await context.request.get(protectedUrl)).status()).toBe(404);
  expect(
    (await context.request.get(protectedUrl, { headers: { [ar06dHeader]: "wrong" } })).status(),
  ).toBe(404);
  expect(
    (
      await context.request.get(ar06dPreviewUrl(origin, home, "unknown-candidate", "en"), {
        headers: { [ar06dHeader]: token },
      })
    ).status(),
  ).toBe(404);
  if (mode === "about-diagnostic") {
    const about = p10b18dCaptureSurfaces.find((surface) => surface.id === "about")!;
    await page.setViewportSize({ width: 375, height: 1000 });
    const started = Date.now(),
      deadline = started + 180_000;
    const stages: Record<string, unknown>[] = [];
    const mark = (stage: string, detail: Record<string, unknown> = {}) =>
      stages.push({
        stage,
        at: new Date().toISOString(),
        elapsedMs: Date.now() - started,
        ...detail,
      });
    const remaining = () => {
      const ms = deadline - Date.now();
      if (ms <= 0) throw new Error("About diagnostic total180second window exhausted");
      return ms;
    };
    try {
      for (const phase of ["first-unprepared", "subsequent-prepared"]) {
        navigation = `about-diagnostic-${phase}`;
        events = [];
        droppedEvents = 0;
        mark("request", { phase, candidateFingerprint: fingerprint, locale: "en", width: 375 });
        const response = await page.goto(ar06dPreviewUrl(origin, about, fingerprint, "en"), {
          waitUntil: "commit",
          timeout: remaining(),
        });
        mark("response-headers", {
          phase,
          status: response?.status(),
          timing: response?.request().timing(),
        });
        expect(response?.status()).toBe(200);
        await page.waitForLoadState("domcontentloaded", { timeout: remaining() });
        mark("domcontentloaded", { phase });
        await expect(page.locator(".project-preview__storefront")).toBeVisible({
          timeout: remaining(),
        });
        await expect(page.locator(".project-preview")).toHaveAttribute("lang", "en", {
          timeout: remaining(),
        });
        const identity = await ar10aReadCandidateIdentity(page, fingerprint);
        mark("candidate-ready", {
          phase,
          identity,
          timing: response?.request().timing(),
          document: await loadingObservation(),
        });
      }
      expect(await ar06dStoredAuthority(page)).toBe(storedBefore);
      expect((await inspect()).providerCallCount).toBe(0);
      expect(forbidden).toEqual([]);
    } catch (error) {
      mark("failure", {
        error: scrub(String(error)),
        url: safeUrl(page.url()),
        pending: [...pending.values()],
        events,
        droppedEvents,
      });
      throw error;
    } finally {
      await ar06dRecord(join(output, "about-diagnostic.json"), {
        diagnosticOnly: true,
        windowMs: 180_000,
        retainedDevCache: true,
        noOriginalFailureReclassified: true,
        candidateFingerprint: fingerprint,
        stages,
        elapsedMs: Date.now() - started,
      });
    }
    return;
  }
  await mkdir(join(output, "screenshots"));
  const cases = [],
    captures = [];
  for (const locale of ["en", "fi"] as const)
    for (const width of [375, 768, 1024, 1440])
      for (const surface of p10b18dCaptureSurfaces) {
        if (
          mode === "diagnostic" &&
          !(
            locale === "en" &&
            (width < 1024 || (width === 1024 && ["home", "collection"].includes(surface.id)))
          )
        )
          continue;
        if (
          mode === "trace" &&
          !(
            (surface.id === "home" && (locale === "en" || width === 375 || width === 1440)) ||
            (locale === "en" &&
              width === 1440 &&
              ["collection", "search", "simple-pdp"].includes(surface.id))
          )
        )
          continue;
        await page.setViewportSize({ width, height: 1000 });
        navigation = `${locale}-${width}-${surface.id}`;
        events = [];
        droppedEvents = 0;
        let response;
        try {
          response = await page.goto(ar06dPreviewUrl(origin, surface, fingerprint, locale), {
            waitUntil: "domcontentloaded",
          });
        } catch (error) {
          // Navigation may fail before a new document exists. Preserve Node-side
          // network/error observations without waiting for that document again.
          await ar06dRecord(join(output, `navigation-failure-${navigation}.json`), {
            at: new Date().toISOString(),
            phase: "navigation",
            error: scrub(String(error)),
            url: safeUrl(page.url()),
            pending: [...pending.values()],
            events,
            droppedEvents,
          });
          throw error;
        }
        expect(response?.status()).toBe(200);
        // Snapshot Node-side observations without delaying the original visibility
        // watchdog behind browser evaluation or a filesystem write.
        const beforeVisibility = structuredClone({
          at: new Date().toISOString(),
          pending: [...pending.values()],
          events,
          droppedEvents,
        });
        try {
          await expect(page.locator(".project-preview__storefront")).toBeVisible();
        } catch (error) {
          await ar06dRecord(
            join(output, `loading-failure-${locale}-${width}-${surface.id}.json`),
            await loadingObservation(),
          );
          throw error;
        } finally {
          await ar06dRecord(
            join(output, `loading-before-${locale}-${width}-${surface.id}.json`),
            beforeVisibility,
          );
        }
        await ar06dRecord(
          join(output, `loading-ready-${locale}-${width}-${surface.id}.json`),
          await loadingObservation(),
        );
        await ar06dSurfaceChecks(page, surface, locale);
        const media = await ar06dSettleMedia(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        const measured = await ar10aMeasure(page);
        const fonts = await ar10aActualFonts(page);
        const result = {
          surface: surface.id,
          locale,
          width,
          media,
          measured,
          fonts,
          candidateFingerprint: fingerprint,
        };
        cases.push(result);
        await ar06dRecord(join(output, `case-${locale}-${width}-${surface.id}.json`), result);
        const capture =
          mode === "full"
            ? width === 375 || width === 1440 || ["home", "configurable-pdp"].includes(surface.id)
            : mode === "trace" &&
              surface.id === "home" &&
              locale === "en" &&
              [375, 1440].includes(width);
        if (capture) {
          const entry = {
            ...(await ar06dCapture(
              page,
              join(output, "screenshots", `${locale}-${width}-${surface.id}.png`),
              media,
            )),
            surface: surface.id,
            locale,
            candidateFingerprint: fingerprint,
          };
          captures.push(entry);
          await ar06dRecord(
            join(output, `capture-${String(captures.length).padStart(2, "0")}.json`),
            entry,
          );
        }
        if (surface.id === "home") {
          const h1 = measured.nodes["[data-component='homepageHero'] h1"][0];
          const actions =
            measured.nodes["[data-component='homepageHero'] [data-region='actions']"][0];
          const hero = measured.nodes["[data-component='homepageHero']"][0];
          expect(parseFloat(h1.style["font-size"])).toBeGreaterThanOrEqual(32);
          if (width === 1440) {
            expect(h1.box.y).toBeLessThanOrEqual(500);
            expect(actions.box.bottom).toBeLessThanOrEqual(750);
            expect(hero.box.height).toBeLessThanOrEqual(760);
          }
          if (width === 375) {
            expect(h1.box.bottom).toBeLessThan(1000);
            expect(actions.box.bottom).toBeLessThan(1000);
            if (locale === "en") {
              expect(h1.box.y).toBeLessThanOrEqual(378.28125);
              expect(actions.box.bottom).toBeLessThanOrEqual(550.40625);
            }
          }
        }
        for (const card of measured.cards) {
          if (card.attributes["data-card-anatomy"] !== "horizontal") continue;
          const picture = card.descendants.find((node) => node.tag === "PICTURE");
          const image = card.descendants.find((node) => node.tag === "IMG");
          if (picture && image) {
            expect(Math.abs(picture.box.height - image.box.height)).toBeLessThanOrEqual(1);
            expect(Math.abs(picture.box.width - image.box.width)).toBeLessThanOrEqual(1);
          }
          if (surface.id === "home" && width === 375)
            expect(card.box.height).toBeLessThanOrEqual(480);
          if (surface.id === "search" && width === 1440)
            expect(card.box.height).toBeLessThanOrEqual(300);
        }
      }
  if (mode === "full") {
    expect(cases).toHaveLength(56);
    expect(captures).toHaveLength(36);
    for (const locale of ["en", "fi"] as const) {
      const surface = p10b18dCaptureSurfaces.find((s) => s.id === "search")!;
      await page.goto(ar06dPreviewUrl(origin, surface, fingerprint, locale));
      const input = page.locator('form[role="search"]:visible').first().getByRole("searchbox");
      await input.fill("Sisu Automatic Watch");
      await input.press("Enter");
      await expect(page.locator("[data-search-result-count]")).toHaveAttribute(
        "data-search-result-count",
        "1",
      );
      expect(new URL(page.url()).searchParams.get("locale")).toBe(locale);
      expect(new URL(page.url()).searchParams.get("p10b-16p-04-proposal")).toBe(fingerprint);
      await page
        .locator(".project-preview__storefront")
        .getByRole("button", {
          name: locale === "fi" ? "Näytä tuote" : "View product",
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(/\/products\/sisu-automatic-watch\?/);
      expect(new URL(page.url()).searchParams.get("p10b-16p-04-proposal")).toBe(fingerprint);
      const empty = new URL(ar06dPreviewUrl(origin, surface, fingerprint, locale));
      empty.searchParams.set("q", "ar10a-missing-approved-product");
      await page.goto(empty.toString());
      await expect(page.locator("[data-search-result-count]")).toHaveAttribute(
        "data-search-result-count",
        "0",
      );
    }
  } else expect(cases).toHaveLength(mode === "diagnostic" ? 16 : 9);
  expect(await ar06dStoredAuthority(page)).toBe(storedBefore);
  expect((await inspect()).providerCallCount).toBe(0);
  expect(forbidden).toEqual([]);
  await ar06dRecord(join(output, "browser-proof.json"), {
    mode,
    label:
      "Offline re-render of the preserved BATCH-18 generated candidate, not another generation",
    candidateFingerprint: fingerprint,
    sourceFingerprint: process.env.AR10A_SOURCE_FINGERPRINT,
    cases,
    captures,
    protectedPersistenceUnchanged: true,
    providerCallCount: 0,
    forbidden,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(protectedUrl);
  await ar06dSettleMedia(page);
});
