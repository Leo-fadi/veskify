import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  manifest,
  products,
  createProject,
  isProject,
  reviseSection,
  productView,
  selectionState,
} from "./model.mjs";
let total = 0;
function check(name, fn) {
  fn();
  total++;
  console.log(`ok ${total} - ${name}`);
}
const pendant = "vq01-aurum-quality-keha-pendant";
check("retained 5 primary / 2 transfer identities and known prices", () => {
  assert.equal(manifest.primaryFixture.products.length, 5);
  assert.equal(manifest.transferFixture.products.length, 2);
  assert.equal(products[pendant].price.amount, 79);
  assert.equal(products["vq01-aurum-quality-pallo-set"].price.amount, 96);
  assert.equal(products["vq01-arki-transfer-reuna-mug"].price.amount, 18);
  assert.equal(Object.keys(products).length, 7);
});
check("configurable selections are required and reject unknown group/value", () => {
  const p = productView(pendant);
  assert.equal(selectionState(p, {}).complete, false);
  assert.equal(selectionState(p, { length: "46 cm" }).complete, true);
  assert.equal(selectionState(p, { length: "90 cm" }).valid, false);
  assert.equal(selectionState(p, { price: "0" }).valid, false);
  assert.equal(selectionState(p, { length: "42 cm", size: "S" }).valid, false);
});
check("simple/unavailable/missing identities differ", () => {
  assert.equal(selectionState(productView("vq01-aurum-quality-rivi-bracelet"), {}).complete, true);
  assert.equal(selectionState(productView("vq01-aurum-quality-pallo-set"), {}).available, false);
  assert.equal(productView("unrecognized-id"), null);
  assert.equal(selectionState(null, {}).available, false);
});
check("unknown type retains all product data and generic configurable options", () => {
  const original = productView(pendant);
  const unknown = productView(pendant, true);
  assert.notEqual(unknown.productType, original.productType);
  unknown.productType = original.productType;
  assert.deepEqual(unknown, original);
  assert.equal(selectionState(productView(pendant, true), { length: "42 cm" }).complete, true);
});
check("fixture reads cannot mutate source products", () => {
  const before = JSON.stringify(products);
  const p = productView(pendant);
  p.price.amount = 0;
  p.orderOptions[0].values = [];
  assert.equal(JSON.stringify(products), before);
});
check("all site/direction/language documents round-trip as editable Puck data", () => {
  for (const site of ["aurum", "arki"])
    for (const direction of ["editorial", "direct"])
      for (const locale of ["en", "fi"]) {
        const p = createProject(site, direction, locale);
        assert.ok(isProject(p));
        assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
        assert.equal(
          p.pages.collection.content[1].props.productIds.length,
          site === "aurum" ? 5 : 2,
        );
      }
});
check("exact section revision preserves other sections/pages/theme and original", () => {
  const p = createProject();
  const before = JSON.stringify(p);
  const next = reviseSection(p);
  assert.notDeepEqual(next.pages.home.content[2], p.pages.home.content[2]);
  const restored = structuredClone(next);
  restored.pages.home.content[2] = p.pages.home.content[2];
  assert.deepEqual(restored, p);
  assert.equal(JSON.stringify(p), before);
  assert.equal(next.pages.home.content[2].props.imageId, "necklace-34372548");
  assert.throws(() => reviseSection(p, "no-target"));
});
check("duplicate section IDs and unknown component/asset fail closed", () => {
  for (const mutate of [
    (p) => (p.pages.home.content[1].props.id = "lead-home"),
    (p) => (p.pages.home.content[0].type = "Script"),
    (p) => (p.pages.home.content[0].props.imageId = "unlicensed"),
  ]) {
    const p = createProject();
    mutate(p);
    assert.equal(isProject(p), false);
  }
});
check("protected fields, nested invalid product references, unknown root data rejected", () => {
  for (const mutate of [
    (p) => (p.pages.product.content[0].props.price = 0),
    (p) => (p.pages.collection.content[1].props.productIds[0].productId = "missing"),
    (p) => (p.pages.home.root.props.currency = "USD"),
    (p) => (p.catalogue = {}),
    (p) => (p.pages.product.content[0].props.unknownType = "false"),
  ]) {
    const p = createProject();
    mutate(p);
    assert.equal(isProject(p), false);
  }
});
check("source and licensed asset identities retained without local private paths", () => {
  assert.equal(manifest.assets.length, 9);
  for (const a of manifest.assets) {
    assert.match(a.sha256, /^[a-f0-9]{64}$/);
    assert.ok(a.author);
    assert.match(a.sourceURL, /^https:\/\//);
    assert.match(a.licenseURL, /pexels.com\/license|creativecommons.org\/licenses\/by-sa\/4.0/);
  }
  assert.match(
    manifest.assets.find((a) => a.assetId === "watch-commons-modern").directObservation,
    /logo removal/,
  );
  assert.ok(manifest.longCopy.en.length > 200 && manifest.longCopy.fi.length > 200);
  assert.ok(manifest.requests.direct);
  assert.ok(manifest.storyboard.product);
  assert.ok(!JSON.stringify(manifest).includes("/Users/"));
});
console.log(
  JSON.stringify({
    checks: total,
    failed: 0,
    inputManifestSha256: createHash("sha256")
      .update(readFileSync(new URL("./input-manifest.json", import.meta.url)))
      .digest("hex"),
    scope:
      "Local research model only; browser execution required separately; no AI or visual acceptance.",
  }),
);
