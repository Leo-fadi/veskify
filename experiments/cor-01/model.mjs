import manifest from "./input-manifest.json" with { type: "json" };
export { manifest };
export const products = Object.fromEntries(
  [...manifest.primaryFixture.products, ...manifest.transferFixture.products].map((p) => [p.id, p]),
);
export const pageNames = ["home", "collection", "product"];
export const localize = (value, locale) =>
  typeof value === "string" ? value : (value?.[locale] ?? value?.en ?? "");
export const copy = (value) => structuredClone(value);
const text = (value) => typeof value === "string" && value.length <= 4000;
const exact = (obj, keys) =>
  obj &&
  typeof obj === "object" &&
  !Array.isArray(obj) &&
  Object.keys(obj).every((k) => keys.includes(k));
const assetIds = new Set(
  manifest.assets.filter((a) => a.assetId !== "ring-10581426").map((a) => a.assetId),
);
export function productView(id, unknownType = false) {
  if (!Object.hasOwn(products, id)) return null;
  const product = copy(products[id]);
  if (unknownType) product.productType = manifest.unknownTypeExample.override.productType;
  return product;
}
export function selectionState(product, selection, locale = "en") {
  if (!product) return { valid: false, complete: false, available: false };
  const groups = product.orderOptions;
  const valid =
    exact(
      selection,
      groups.map((g) => g.id),
    ) &&
    Object.entries(selection).every(([key, value]) =>
      groups.find((g) => g.id === key)?.values.some((v) => localize(v, locale) === value),
    );
  return {
    valid: !!valid,
    complete: !!valid && groups.every((g) => !g.required || Boolean(selection[g.id])),
    available: product.stockStatus === "inStock",
  };
}
const item = (type, id, props) => ({ type, props: { id, ...props } });
export function createProject(site = "aurum", direction = "editorial", locale = "en") {
  const transfer = site === "arki";
  const pack = transfer ? manifest.transferFixture : manifest.primaryFixture;
  const ids = pack.products.map((p) => p.id);
  const en = locale === "en";
  const lead = item("Hero", "lead-home", {
    title: transfer
      ? en
        ? "Objects for ordinary moments"
        : "Esineitä arjen hetkiin"
      : localize(manifest.primaryFixture.copy.heading, locale),
    copy: transfer
      ? localize(pack.products[0].description, locale)
      : localize(manifest.primaryFixture.copy.introduction, locale),
    imageId: transfer ? "transfer-cup-set" : "hero-flatlay-29502931",
  });
  const rail = item("ProductRail", "products-home", {
    heading: en ? "The edit" : "Valikoima",
    productIds: ids.slice(0, 3).map((productId) => ({ productId })),
  });
  const story = item("EditorialStory", "story-home", {
    heading: en ? "A closer look" : "Lähempää katsottuna",
    copy: localize(pack.products[transfer ? 1 : 4].description, locale),
    imageId: transfer ? "transfer-rim-mug" : "editorial-33370257",
  });
  const data = (content) => ({ root: { props: {} }, content, zones: {} });
  return {
    version: 1,
    site,
    direction,
    locale,
    pages: {
      home: data(direction === "direct" ? [rail, lead, story] : [lead, rail, story]),
      collection: data([
        item("Intro", "intro-collection", {
          heading: en ? "The collection" : "Mallisto",
          copy: transfer
            ? localize(pack.products[0].description, locale)
            : manifest.longCopy[locale],
        }),
        item("ProductRail", "products-collection", {
          heading: en ? "All pieces" : "Kaikki tuotteet",
          productIds: ids.map((productId) => ({ productId })),
        }),
      ]),
      product: data([
        item("ProductDetail", "detail-product", {
          productId: ids[transfer ? 1 : 0],
          unknownType: false,
        }),
      ]),
    },
  };
}
export function reviseSection(project, sectionId = "story-home") {
  if (!isProject(project)) throw Error("Invalid project");
  const next = copy(project);
  const found = next.pages.home.content.find(
    (i) => i.props.id === sectionId && i.type === "EditorialStory",
  );
  if (!found || project.site !== "aurum") throw Error("Exact Aurum story target missing");
  Object.assign(found.props, {
    heading: project.locale === "en" ? "A little light, close to you" : "Ripaus valoa lähelläsi",
    copy: localize(
      products[manifest.unknownTypeExample.sourceProductId].description,
      project.locale,
    ),
    imageId: "necklace-34372548",
  });
  return next;
}
export function isData(data) {
  if (
    !exact(data, ["root", "content", "zones"]) ||
    !exact(data.root, ["props"]) ||
    !exact(data.root.props, []) ||
    (data.zones && !exact(data.zones, [])) ||
    !Array.isArray(data.content) ||
    data.content.length > 30
  )
    return false;
  const ids = new Set();
  return data.content.every((i) => {
    if (
      !exact(i, ["type", "props"]) ||
      !i.props ||
      typeof i.props.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(i.props.id) ||
      ids.has(i.props.id)
    )
      return false;
    ids.add(i.props.id);
    const p = i.props;
    if (i.type === "Hero" || i.type === "EditorialStory")
      return (
        exact(p, ["id", i.type === "Hero" ? "title" : "heading", "copy", "imageId"]) &&
        text(p.title ?? p.heading) &&
        text(p.copy) &&
        assetIds.has(p.imageId)
      );
    if (i.type === "Intro")
      return exact(p, ["id", "heading", "copy"]) && text(p.heading) && text(p.copy);
    if (i.type === "ProductRail")
      return (
        exact(p, ["id", "heading", "productIds"]) &&
        text(p.heading) &&
        Array.isArray(p.productIds) &&
        p.productIds.length <= 20 &&
        p.productIds.every(
          (entry) => exact(entry, ["productId"]) && Object.hasOwn(products, entry.productId),
        )
      );
    if (i.type === "ProductDetail")
      return (
        exact(p, ["id", "productId", "unknownType"]) &&
        Object.hasOwn(products, p.productId) &&
        typeof p.unknownType === "boolean"
      );
    return false;
  });
}
export function isProject(p) {
  return Boolean(
    exact(p, ["version", "site", "direction", "locale", "pages"]) &&
    p.version === 1 &&
    ["aurum", "arki"].includes(p.site) &&
    ["editorial", "direct"].includes(p.direction) &&
    ["en", "fi"].includes(p.locale) &&
    exact(p.pages, pageNames) &&
    pageNames.every((name) => isData(p.pages[name])),
  );
}
