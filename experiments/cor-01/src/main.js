import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Puck, Render } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import "./styles.css";
import {
  manifest,
  products,
  localize,
  productView,
  selectionState,
  createProject,
  reviseSection,
  isProject,
  pageNames,
} from "../model.mjs";
const image = (id) => `/approved-assets/${id}.jpg`;
const words = (locale, en, fi) => (locale === "fi" ? fi : en);
const price = (p, locale) =>
  new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-FI", {
    style: "currency",
    currency: p.price.currency,
  }).format(p.price.amount);
function ProductDetail({ productId, unknownType, locale }) {
  const p = productView(productId, unknownType);
  const [selection, setSelection] = useState({});
  useEffect(() => setSelection({}), [productId, locale]);
  if (!p)
    return (
      <section className="missing" role="alert">
        Unknown product identity. No commerce data is available.
      </section>
    );
  const state = selectionState(p, selection, locale);
  return (
    <section className="detail" data-product-id={p.id} data-product-type={p.productType}>
      <img src={image(p.assetId)} alt={localize(p.title, locale)} />
      <div>
        <p className="kicker">{p.brand}</p>
        <h1>{localize(p.title, locale)}</h1>
        <p className="price">{price(p, locale)}</p>
        <p>{localize(p.description, locale)}</p>
        <p className="stock">{localize(p.availabilityLabel, locale)}</p>
        {p.orderOptions.map((group) => (
          <fieldset key={group.id}>
            <legend>{localize(group.label, locale)}</legend>
            <div className="option-row">
              {group.values.map((option) => {
                const value = localize(option, locale);
                return (
                  <label key={value}>
                    <input
                      type="radio"
                      name={`${p.id}-${group.id}`}
                      value={value}
                      checked={selection[group.id] === value}
                      onChange={() => setSelection({ ...selection, [group.id]: value })}
                    />
                    {value}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <p role="status">
          {!state.available
            ? words(locale, "Currently unavailable", "Ei tällä hetkellä saatavilla")
            : !state.complete
              ? words(locale, "Choose an option", "Valitse vaihtoehto")
              : words(locale, "Selection ready", "Valinta valmis")}
        </p>
        <details>
          <summary>{words(locale, "Product details", "Tuotetiedot")}</summary>
          <p>{p.sku}</p>
          {Object.entries(p.attributes).map(([key, value]) => (
            <p key={key}>
              {key}: {localize(value, locale)}
            </p>
          ))}
        </details>
        {unknownType && (
          <p className="research-note">
            Synthetic unknown-type test: the generic renderer retains this product’s identity and
            options.
          </p>
        )}
        <p className="research-note">
          {words(
            locale,
            "Fictional fixture · no checkout or live inventory",
            "Kuvitteellinen aineisto · ei kassaa tai reaaliaikaista varastoa",
          )}
        </p>
      </div>
    </section>
  );
}
function makeConfig(project) {
  const { locale, direction, site } = project;
  const t = (en, fi) => words(locale, en, fi);
  const link = (page, productId) =>
    `?preview=1&page=${page}${productId ? `&product=${encodeURIComponent(productId)}` : ""}`;
  const assets = manifest.assets
    .filter((a) => a.assetId !== "ring-10581426")
    .map((a) => ({ label: a.assetId, value: a.assetId }));
  const productOptions = Object.values(products).map((p) => ({
    label: localize(p.title, locale),
    value: p.id,
  }));
  const text = { type: "text", label: "Heading" };
  const copy = { type: "textarea", label: "Body copy" };
  const imageField = { type: "select", label: "Image", options: assets };
  return {
    root: {
      render: ({ children }) => (
        <div className={`storefront ${direction}`} lang={locale}>
          <nav className="store-nav" aria-label="Store navigation">
            <a className="brand" href={link("home")}>
              {site === "aurum" ? "Aurum Nordic" : "Arki Objects"}
            </a>
            <div>
              <a href={link("collection")}>{t("The collection", "Mallisto")}</a>
              <a href={link("product")}>{t("A closer look", "Lähempää")}</a>
            </div>
          </nav>
          {children}
          <footer>
            <p>
              {site === "aurum" ? "Aurum Nordic" : "Arki Objects"} ·{" "}
              {t("Fictional research storefront", "Kuvitteellinen tutkimuskauppa")}
            </p>
            <details>
              <summary>{t("Photography credits", "Kuvien tekijät")}</summary>
              {manifest.assets.map((a) => (
                <p key={a.assetId}>
                  <a href={a.sourceURL}>
                    {a.author} · {a.assetId}
                  </a>{" "}
                  —{" "}
                  <a href={a.licenseURL}>
                    {a.licenseURL.includes("creativecommons") ? "CC BY-SA 4.0" : "Pexels License"}
                  </a>
                  {a.assetId === "watch-commons-modern"
                    ? " · Uploader disclosed prior logo removal; no research retouch."
                    : ""}
                </p>
              ))}
            </details>
          </footer>
        </div>
      ),
    },
    components: {
      Hero: {
        label: "Editorial lead",
        fields: { title: text, copy, imageId: imageField },
        defaultProps: {
          title: t("A little light", "Ripaus valoa"),
          copy: "",
          imageId: "hero-flatlay-29502931",
        },
        render: ({ title, copy, imageId }) => (
          <section className="hero">
            <div>
              <p className="kicker">{t("The everyday edit", "Arjen valikoima")}</p>
              <h1>{title}</h1>
              <p>{copy}</p>
              <a className="text-link" href={link("collection")}>
                {t("Explore the collection", "Tutustu mallistoon")} ↗
              </a>
            </div>
            <img
              src={image(imageId)}
              alt={t("Editorial composition", "Toimituksellinen asetelma")}
            />
          </section>
        ),
      },
      Intro: {
        label: "Collection introduction",
        fields: { heading: text, copy },
        defaultProps: { heading: "Collection", copy: "" },
        render: ({ heading, copy }) => (
          <section className="intro">
            <h1>{heading}</h1>
            <p>{copy}</p>
          </section>
        ),
      },
      ProductRail: {
        label: "Product selection",
        fields: {
          heading: text,
          productIds: {
            type: "array",
            label: "Products",
            arrayFields: {
              productId: { type: "select", label: "Product", options: productOptions },
            },
            defaultItemProps: { productId: productOptions[0].value },
          },
        },
        defaultProps: { heading: "The edit", productIds: [{ productId: productOptions[0].value }] },
        render: ({ heading, productIds }) => (
          <section className="rail">
            <div className="section-heading">
              <h2>{heading}</h2>
              <span>
                {productIds.length} {t("pieces", "tuotetta")}
              </span>
            </div>
            <div className="cards">
              {productIds.map(({ productId }, index) => {
                const p = productView(productId);
                return p ? (
                  <article className="card" key={`${productId}-${index}`} data-product-id={p.id}>
                    <a href={link("product", p.id)}>
                      <img src={image(p.assetId)} alt={localize(p.title, locale)} />
                      <div className="card-line">
                        <h3>{localize(p.title, locale)}</h3>
                        <span>{price(p, locale)}</span>
                      </div>
                    </a>
                    {p.stockStatus === "outOfStock" && (
                      <small>{localize(p.availabilityLabel, locale)}</small>
                    )}
                  </article>
                ) : (
                  <p key={index} role="alert">
                    Unknown product
                  </p>
                );
              })}
            </div>
          </section>
        ),
      },
      EditorialStory: {
        label: "Selected product story",
        fields: { heading: text, copy, imageId: imageField },
        defaultProps: { heading: "A closer look", copy: "", imageId: "necklace-34372548" },
        render: ({ heading, copy, imageId }) => (
          <section className="story">
            <img src={image(imageId)} alt={t("A closer product view", "Tuote lähempää")} />
            <div>
              <p className="kicker">{t("In focus", "Lähikuvassa")}</p>
              <h2>{heading}</h2>
              <p>{copy}</p>
              <a
                className="text-link"
                href={
                  Object.values(products).some((p) => p.assetId === imageId)
                    ? link("product", Object.values(products).find((p) => p.assetId === imageId).id)
                    : link("collection")
                }
              >
                {t("See the details", "Katso tiedot")} ↗
              </a>
            </div>
          </section>
        ),
      },
      ProductDetail: {
        label: "Fixture product detail",
        fields: {
          productId: { type: "select", label: "Product", options: productOptions },
          unknownType: {
            type: "radio",
            label: "Synthetic unknown type",
            options: [
              { label: "Off", value: false },
              { label: "On", value: true },
            ],
          },
        },
        defaultProps: { productId: productOptions[0].value, unknownType: false },
        render: (props) => <ProductDetail {...props} locale={locale} />,
      },
    },
  };
}
function App() {
  const [project, setProject] = useState(null);
  const [page, setPage] = useState("home");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("Loading local draft");
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  useEffect(() => {
    fetch("/research-save")
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw Error("Saved project unavailable");
        return response.json();
      })
      .then((saved) => {
        if (saved && !isProject(saved)) throw Error("Invalid saved project");
        setProject(saved ?? createProject());
        setStatus(saved ? "Reopened private research draft" : "Unsaved developer-directed example");
      })
      .catch((error) => setStatus(error.message));
  }, []);
  const config = useMemo(
    () => (project ? makeConfig(project) : null),
    [project?.locale, project?.direction, project?.site],
  );
  const replace = (next) => {
    setProject(next);
    setRevision((v) => v + 1);
    setStatus("Unsaved developer-directed example");
  };
  const save = async (next) => {
    try {
      if (!isProject(next)) throw Error("Invalid project; save refused");
      const response = await fetch("/research-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw Error(`Save refused (${response.status})`);
      setStatus("Saved private research draft");
    } catch (error) {
      setStatus(error.message);
    }
  };
  const exportJson = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
    );
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "puck-local-project.json",
    });
    a.click();
    URL.revokeObjectURL(url);
  };
  if (!project) return <p role="status">{status}</p>;
  if (preview) {
    const requested = params.get("page") ?? "home";
    const data = structuredClone(project.pages[pageNames.includes(requested) ? requested : "home"]);
    if (requested === "product" && params.has("product"))
      data.content[0].props.productId = params.get("product");
    if (params.has("unknown")) data.content[0].props.unknownType = true;
    return <Render config={config} data={data} />;
  }
  return (
    <main className="research">
      <header className="research-toolbar">
        <div>
          <strong>Developer-directed Puck editor study</strong>
          <p>Local feasibility · no AI output · no owner visual acceptance</p>
        </div>
        <div className="research-actions">
          <label>
            Direction{" "}
            <select
              aria-label="Direction"
              value={project.direction}
              onChange={(e) => replace(createProject(project.site, e.target.value, project.locale))}
            >
              <option value="editorial">Editorial</option>
              <option value="direct">Product-first</option>
            </select>
          </label>
          <label>
            Fixture{" "}
            <select
              aria-label="Fixture"
              value={project.site}
              onChange={(e) =>
                replace(createProject(e.target.value, project.direction, project.locale))
              }
            >
              <option value="aurum">Aurum</option>
              <option value="arki">Arki transfer</option>
            </select>
          </label>
          <label>
            Language{" "}
            <select
              aria-label="Language"
              value={project.locale}
              onChange={(e) =>
                replace(createProject(project.site, project.direction, e.target.value))
              }
            >
              <option value="en">EN</option>
              <option value="fi">FI</option>
            </select>
          </label>
          <label>
            Page{" "}
            <select aria-label="Page" value={page} onChange={(e) => setPage(e.target.value)}>
              {pageNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="research-actions">
          <button
            disabled={project.site !== "aurum"}
            onClick={() => replace(reviseSection(project))}
          >
            Apply prepared section revision
          </button>
          <button onClick={() => save(project)}>Save research draft</button>
          <button onClick={exportJson}>Export editable JSON</button>
          <label>
            Import editable JSON
            <input
              type="file"
              aria-label="Import editable JSON"
              accept="application/json"
              onChange={async (e) => {
                try {
                  const next = JSON.parse(await e.target.files[0].text());
                  if (!isProject(next)) throw Error("Invalid import");
                  replace(next);
                } catch (error) {
                  setStatus(error.message);
                }
              }}
            />
          </label>
          <a href={`?preview=1&page=${page}`} target="_blank" rel="noreferrer">
            Saved page preview ↗
          </a>
          <output role="status">{status}</output>
        </div>
      </header>
      <Puck
        key={`${page}-${revision}`}
        config={config}
        data={project.pages[page]}
        onChange={(data) =>
          setProject((current) => ({ ...current, pages: { ...current.pages, [page]: data } }))
        }
        onPublish={(data) => save({ ...project, pages: { ...project.pages, [page]: data } })}
      />
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
