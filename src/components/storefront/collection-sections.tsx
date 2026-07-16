import { resolveLocalizedText, type LocalizedText } from "@/domain/shared";
import type { StorefrontRenderContext } from "@/components/registry/contract";
import { StorefrontImage } from "./homepage-sections";
import styles from "./collection-sections.module.css";

const text = (value: LocalizedText, context: StorefrontRenderContext) =>
  resolveLocalizedText(value, context.activeLocale, context.primaryLocale);

export function CollectionHeader({
  collectionId,
  context,
}: {
  collectionId: string;
  context: StorefrontRenderContext;
}) {
  const collection = context.catalogue.collections.find((item) => item.id === collectionId)!;
  const representativeProduct = collection.productIds
    .map((id) => context.catalogue.products.find((product) => product.id === id))
    .find((product) => product?.images[0]);
  const media = representativeProduct?.images[0];

  return (
    <section className={styles.collectionHeader} aria-labelledby="collection-page-title">
      <div className={styles.collectionCopy}>
        <p className="store-eyebrow">
          {text({ en: "Aurum collection", fi: "Aurum-mallisto" }, context)}
        </p>
        <h1 id="collection-page-title">{text(collection.title, context)}</h1>
        <p>{text(collection.description, context)}</p>
      </div>
      {media ? (
        <StorefrontImage asset={media} className={styles.collectionMedia} context={context} />
      ) : (
        <p className={styles.empty}>
          {text(
            {
              en: "This collection is ready for products and imagery when they become available.",
              fi: "Tämä mallisto on valmis tuotteille ja kuville, kun niitä on saatavilla.",
            },
            context,
          )}
        </p>
      )}
    </section>
  );
}

const filterLabels = {
  material: { en: "Material", fi: "Materiaali" },
  metalColour: { en: "Metal colour", fi: "Metallin väri" },
  price: { en: "Price", fi: "Hinta" },
  availability: { en: "Availability", fi: "Saatavuus" },
  stoneShape: { en: "Stone shape", fi: "Kiven muoto" },
} satisfies Record<string, LocalizedText>;

export type JewelleryFilterToken = keyof typeof filterLabels;

export function FilterBar({
  filters,
  context,
}: {
  filters: JewelleryFilterToken[];
  context: StorefrontRenderContext;
}) {
  return (
    <section
      className={styles.filterBar}
      aria-label={text({ en: "Collection controls", fi: "Malliston valinnat" }, context)}
    >
      <fieldset>
        <legend>{text({ en: "Filter presentation", fi: "Suodatinten esittely" }, context)}</legend>
        {filters.map((filter) => (
          <button aria-pressed="false" key={filter} type="button">
            {text(filterLabels[filter], context)}
          </button>
        ))}
      </fieldset>
      <label>
        <span className="sr-only">
          {text({ en: "Sort presentation", fi: "Lajittelun esittely" }, context)}
        </span>
        <select aria-describedby="collection-filter-demo-note" defaultValue="featured">
          <option value="featured">{text({ en: "Featured", fi: "Suositellut" }, context)}</option>
          <option value="newest">{text({ en: "Newest", fi: "Uusimmat" }, context)}</option>
        </select>
      </label>
      <p className={styles.demoNote} id="collection-filter-demo-note">
        {text(
          {
            en: "Demo presentation only — filters and sorting do not change products.",
            fi: "Vain demoesittely — suodatus ja lajittelu eivät muuta tuotteita.",
          },
          context,
        )}
      </p>
    </section>
  );
}
