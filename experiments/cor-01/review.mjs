import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statfsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { createProject, isProject, products, manifest } from "./model.mjs";
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (entries, value, index, all) =>
        value.startsWith("--") ? [...entries, [value.slice(2), all[index + 1]]] : entries,
      [],
    ),
);
const base = args["base-url"] ?? "http://127.0.0.1:4317";
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.ok(args.output, "--output is required");
const out = resolve(args.output);
const ledgerPath = resolve(args.ledger ?? resolve(out, "../../RESOURCE-LEDGER.json"));
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
assert.ok(ledger.browserLaunches < ledger.browserLaunchLimit, "browser ceiling");
const disk = statfsSync(resolve(ledgerPath, ".."));
const free = disk.bavail * disk.bsize;
assert.ok(
  free > ledger.reserveBytes + 512 * 1024 * 1024,
  "next operation 512MiB plus single reserve",
);
for (const path of ["/", "/src/main.js", "/approved-assets/necklace-34372548.jpg"]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, `endpoint readiness ${path}`);
}
assert.ok(
  !existsSync(resolve(out, "result.json")),
  "Use a new evidence directory; preserve attempts",
);
mkdirSync(out, { recursive: true });
const report = {
  status: "RUNNING",
  at: new Date().toISOString(),
  steps: [],
  errors: [],
  requestsBlocked: [],
  screenshots: [],
  label: "Developer-directed native Puck only. No AI or owner visual acceptance.",
};
const persist = () =>
  writeFileSync(resolve(out, "result.json"), JSON.stringify(report, null, 2) + "\n");
const step = (name) => {
  report.steps.push(name);
  persist();
  console.log(name);
};
ledger.browserLaunches++;
ledger.attempts.push({
  operation: "Local native Puck browser review",
  at: report.at,
  output: out,
  freeBytesObserved: free,
  additionalPeakEstimateBytes: 512 * 1024 * 1024,
  result: "Attempt counted before launch",
});
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
persist();
let browser, page;
const save = async (project) => {
  const r = await fetch(base + "/research-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  assert.equal(r.status, 204);
};
const read = async () => {
  const r = await fetch(base + "/research-save");
  assert.equal(r.status, 200);
  return r.json();
};
const capture = async (name) => {
  await page.screenshot({ path: resolve(out, name + ".png"), fullPage: true });
  report.screenshots.push(name + ".png");
  persist();
};
const contextFor = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith("blob:")) return route.continue();
    report.requestsBlocked.push(url);
    return route.abort();
  });
  return context;
};
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  let context = await contextFor();
  page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  const initial = createProject();
  await save(initial);
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("status").filter({ hasText: "Reopened private research draft" }).waitFor();
  const frame = page.frameLocator("iframe").first();
  await frame.locator('[data-puck-component="story-home"]').click({ position: { x: 10, y: 10 } });
  await page
    .getByRole("textbox", { name: "Heading", exact: true })
    .fill("A little light, close to you");
  await page
    .getByRole("textbox", { name: "Body copy", exact: true })
    .fill(products[manifest.unknownTypeExample.sourceProductId].description.en);
  await page
    .getByRole("combobox", { name: "Image", exact: true })
    .selectOption("necklace-34372548");
  await page.getByRole("button", { name: "Save research draft", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved private research draft" }).waitFor();
  const edited = await read();
  assert.ok(isProject(edited));
  assert.equal(edited.pages.home.content[2].props.heading, "A little light, close to you");
  assert.equal(edited.pages.home.content[2].props.imageId, "necklace-34372548");
  const restored = structuredClone(edited);
  restored.pages.home.content[2] = initial.pages.home.content[2];
  assert.deepEqual(restored, initial, "only exact selected section changed");
  await capture("native-editor-selected-section");
  writeFileSync(resolve(out, "initial-project.json"), JSON.stringify(initial, null, 2) + "\n");
  writeFileSync(resolve(out, "edited-project.json"), JSON.stringify(edited, null, 2) + "\n");
  step("Native field edits changed only story-home; all other sections/pages/theme preserved");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export editable JSON" }).click();
  const download = await downloadPromise;
  await download.saveAs(resolve(out, "editable-export.json"));
  assert.deepEqual(JSON.parse(readFileSync(resolve(out, "editable-export.json"), "utf8")), edited);
  step("Editable export matches saved native data");
  const bad = structuredClone(edited);
  bad.pages.product.content[0].props.price = 1;
  const reject = await fetch(base + "/research-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bad),
  });
  assert.equal(reject.status, 422);
  assert.deepEqual(await read(), edited);
  step("Rejected protected-field write preserves previous durable save");
  await context.close();
  context = await contextFor();
  page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("status").filter({ hasText: "Reopened private research draft" }).waitFor();
  await page
    .frameLocator("iframe")
    .first()
    .getByRole("heading", { name: "A little light, close to you" })
    .waitFor();
  assert.deepEqual(await read(), edited);
  await capture("normal-reopen-editor");
  step("Closed browser context; new context reopens same durable editable project");
  await page.getByLabel("Fixture", { exact: true }).selectOption("arki");
  await page
    .getByLabel("Import editable JSON", { exact: true })
    .setInputFiles(resolve(out, "editable-export.json"));
  await page
    .frameLocator("iframe")
    .first()
    .getByRole("heading", { name: "A little light, close to you" })
    .waitFor();
  await page.getByRole("button", { name: "Save research draft", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved private research draft" }).waitFor();
  assert.deepEqual(await read(), edited);
  step("Export imports into native editor and saves unchanged");
  // Initial examples, revised page and contrasts are retained separately, never presented as generation.
  for (const [name, project] of [
    ["initial", initial],
    ["revised", edited],
    ["direct", createProject("aurum", "direct")],
    ["fi", createProject("aurum", "editorial", "fi")],
    ["transfer", createProject("arki", "direct")],
  ]) {
    await save(project);
    writeFileSync(resolve(out, name + "-project.json"), JSON.stringify(project, null, 2) + "\n");
    for (const surface of ["home", "collection", "product"]) {
      if (name === "revised" && surface !== "home") continue;
      for (const width of name === "initial" ? [375, 768, 1024, 1440] : [375, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${base}/?preview=1&page=${surface}`, { waitUntil: "networkidle" });
        await page.locator(".storefront").waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
          false,
          `${name}/${surface}/${width} overflow`,
        );
        const broken = await page
          .locator(".storefront img")
          .evaluateAll(
            (images) => images.filter((i) => !i.complete || i.naturalWidth === 0).length,
          );
        assert.equal(broken, 0, "approved images loaded");
        await capture(`${name}-${surface}-${width}`);
      }
    }
  }
  step(
    "Home/collection/PDP originals captured at four widths; FI, contrasting primary direction and sparse transfer also captured",
  );
  await save(initial);
  const pendant = manifest.unknownTypeExample.sourceProductId;
  await page.goto(`${base}/?preview=1&page=home`, { waitUntil: "networkidle" });
  await page.locator(".story a").click();
  assert.equal(
    await page.locator(".detail").getAttribute("data-product-id"),
    "vq01-aurum-quality-pallo-set",
  );
  assert.equal(await page.getByRole("status").innerText(), "Currently unavailable");
  await page.goto(`${base}/?preview=1&page=product&product=${pendant}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("radio", { name: "46 cm" }).check();
  assert.equal(await page.getByRole("status").innerText(), "Selection ready");
  await page.goto(`${base}/?preview=1&page=product&product=${pendant}&unknown=1`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("radio", { name: "42 cm" }).check();
  assert.equal(await page.getByRole("status").innerText(), "Selection ready");
  await capture("unknown-type-options");
  await page.goto(`${base}/?preview=1&page=product&product=vq01-aurum-quality-pallo-set`, {
    waitUntil: "networkidle",
  });
  assert.equal(await page.getByRole("status").innerText(), "Currently unavailable");
  await capture("unavailable-product");
  await page.goto(`${base}/?preview=1&page=product&product=missing`, { waitUntil: "networkidle" });
  assert.match(await page.getByRole("alert").innerText(), /Unknown product identity/);
  await save(createProject("arki", "direct", "fi"));
  await page.goto(`${base}/?preview=1&page=product`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: "M", exact: true }).check();
  assert.equal(await page.getByRole("status").innerText(), "Valinta valmis");
  await capture("transfer-fi-selection");
  step(
    "Generic required options, unknown type, unavailable/missing identity and FI transfer verified",
  );
  await save(edited);
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  await context.close();
  report.status = "PASS";
  report.savedProjectSha256 = createHash("sha256").update(JSON.stringify(edited)).digest("hex");
  persist();
} catch (error) {
  report.status = "FAIL";
  report.failure = error.stack;
  if (page)
    await page.screenshot({ path: resolve(out, "failure.png"), fullPage: true }).catch(() => {});
  persist();
  throw error;
} finally {
  await browser?.close();
}
