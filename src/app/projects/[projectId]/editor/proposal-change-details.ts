import type { DesignOperation, DesignProposal } from "@/application/design-operations";
import { getComponentDefinition } from "@/components/registry";
import type { Locale } from "@/domain/shared";
import type { PageModel, SectionInstance } from "@/domain/storefront";

const fieldNames: Record<string, Record<Locale, string>> = {
  body: { en: "supporting text", fi: "leipäteksti" },
  eyebrow: { en: "small heading", fi: "pieni otsikko" },
  heading: { en: "heading", fi: "otsikko" },
  title: { en: "main heading", fi: "pääotsikko" },
};

const optionNames: Record<string, Record<Locale, string>> = {
  inherit: { en: "existing", fi: "nykyinen" },
  background: { en: "page background", fi: "sivun tausta" },
  surface: { en: "light surface", fi: "vaalea pinta" },
  primary: { en: "primary brand colour", fi: "brändin pääväri" },
  secondary: { en: "secondary brand colour", fi: "brändin toissijainen väri" },
  accent: { en: "accent colour", fi: "korostusväri" },
  serif: { en: "serif", fi: "antiikva" },
  sans: { en: "sans serif", fi: "groteski" },
  strong: { en: "strong", fi: "vahva" },
  compact: { en: "compact", fi: "tiivis" },
  standard: { en: "standard", fi: "tavallinen" },
  spacious: { en: "spacious", fi: "väljä" },
  square: { en: "square", fi: "kulmikas" },
  soft: { en: "soft", fi: "pehmeä" },
  rounded: { en: "rounded", fi: "pyöristetty" },
  left: { en: "left", fi: "vasen" },
  center: { en: "centred", fi: "keskitetty" },
  text: { en: "text link", fi: "tekstilinkki" },
  editorial: { en: "editorial", fi: "toimituksellinen" },
  editorialCards: { en: "editorial cards", fi: "toimitukselliset kortit" },
  imageLed: { en: "image-led", fi: "kuvapainotteinen" },
  imageOverlay: { en: "image overlay", fi: "kuvan päälle aseteltu" },
  split: { en: "split", fi: "jaettu" },
  minimal: { en: "minimal", fi: "pelkistetty" },
  singleLine: { en: "single line", fi: "yksi rivi" },
  centered: { en: "centred", fi: "keskitetty" },
  columns: { en: "columns", fi: "palstat" },
  inline: { en: "inline", fi: "samalla rivillä" },
  card: { en: "card", fi: "kortti" },
  fullWidth: { en: "full width", fi: "täysleveä" },
};

const colourNames: Record<string, Record<Locale, string>> = {
  primary: { en: "primary", fi: "pääväri" },
  secondary: { en: "secondary", fi: "toissijainen" },
  accent: { en: "accent", fi: "korostus" },
  background: { en: "background", fi: "tausta" },
  surface: { en: "surface", fi: "pinta" },
  text: { en: "text", fi: "teksti" },
  mutedText: { en: "muted text", fi: "hillitty teksti" },
  border: { en: "border", fi: "reunus" },
};

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLocaleLowerCase();
}

function option(value: string, locale: Locale) {
  return optionNames[value]?.[locale] ?? humanize(value);
}

function localizedValue(value: unknown, locale: Locale, primaryLocale: Locale) {
  if (!value || typeof value !== "object") return undefined;
  const localized = value as Partial<Record<Locale, unknown>>;
  const preferred = localized[locale] ?? localized[primaryLocale] ?? localized.en ?? localized.fi;
  return typeof preferred === "string" ? preferred : undefined;
}

function sectionFor(page: PageModel, sectionId: string) {
  return page.sections.find((section) => section.id === sectionId);
}

function sectionName(section: SectionInstance | undefined, locale: Locale, primaryLocale: Locale) {
  if (!section) return locale === "fi" ? "valittu osio" : "selected section";
  for (const field of ["title", "heading", "eyebrow"]) {
    const value = localizedValue(section.content[field], locale, primaryLocale);
    if (value) return value;
  }
  return getComponentDefinition(section.component).label;
}

function sectionReference(
  proposal: DesignProposal,
  sectionId: string,
  locale: Locale,
  primaryLocale: Locale,
) {
  const section =
    sectionFor(proposal.proposedPage, sectionId) ?? sectionFor(proposal.originalPage, sectionId);
  const name = sectionName(section, locale, primaryLocale);
  return locale === "fi" ? `osio ”${name}”` : `“${name}” section`;
}

function languageName(language: Locale, locale: Locale) {
  if (locale === "fi") return language === "fi" ? "suomenkielinen" : "englanninkielinen";
  return language === "fi" ? "Finnish" : "English";
}

function detailForOperation(
  proposal: DesignProposal,
  operation: DesignOperation,
  locale: Locale,
  primaryLocale: Locale,
): string {
  const section =
    "sectionId" in operation
      ? sectionReference(proposal, operation.sectionId, locale, primaryLocale)
      : "";

  switch (operation.type) {
    case "CHANGE_LOCALIZED_SECTION_TEXT": {
      const field =
        fieldNames[operation.field]?.[locale] ??
        (locale === "fi" ? "teksti" : humanize(operation.field));
      return locale === "fi"
        ? `Päivitä ${section}: ${languageName(operation.locale, locale)} ${field} muotoon ”${operation.value}”.`
        : `Update the ${languageName(operation.locale, locale)} ${field} in the ${section} to “${operation.value}”.`;
    }
    case "CHANGE_SECTION_VARIANT":
      return locale === "fi"
        ? `Vaihda ${section}: asettelu ”${option(operation.variant, locale)}”.`
        : `Use the ${option(operation.variant, locale)} layout for the ${section}.`;
    case "CHANGE_BACKGROUND":
      return locale === "fi"
        ? `Vaihda ${section}: taustaksi ${option(operation.background, locale)}.`
        : `Change the ${section} background to ${option(operation.background, locale)}.`;
    case "CHANGE_TYPOGRAPHY":
      return locale === "fi"
        ? `Vaihda ${section}: typografiaksi ${option(operation.typography, locale)}.`
        : `Change the ${section} typography to ${option(operation.typography, locale)}.`;
    case "CHANGE_DENSITY":
      return locale === "fi"
        ? `Vaihda ${section}: väljyydeksi ${option(operation.density, locale)}.`
        : `Change the ${section} spacing to ${option(operation.density, locale)}.`;
    case "CHANGE_SHAPE":
      return locale === "fi"
        ? `Vaihda ${section}: muotokieleksi ${option(operation.shape, locale)}.`
        : `Change the ${section} shape treatment to ${option(operation.shape, locale)}.`;
    case "CHANGE_ALIGNMENT":
      return locale === "fi"
        ? `Vaihda ${section}: sisällön tasaus ”${option(operation.alignment, locale)}”.`
        : `Align the ${section} content to the ${option(operation.alignment, locale)}.`;
    case "CHANGE_CTA_STYLE":
      return locale === "fi"
        ? `Vaihda ${section}: toimintopainikkeeksi ${option(operation.ctaPresentation, locale)}.`
        : `Use the ${option(operation.ctaPresentation, locale)} call-to-action style in the ${section}.`;
    case "APPLY_APPROVED_BRAND_COLOURS": {
      const colours = Object.entries(operation.colors)
        .map(([name, value]) => `${colourNames[name]?.[locale] ?? humanize(name)} ${value}`)
        .join(", ");
      return locale === "fi"
        ? `Käytä hyväksyttyä brändipalettia: ${colours}.`
        : `Apply the approved brand palette: ${colours}.`;
    }
    case "ADD_APPROVED_SECTION": {
      const added = sectionReference(proposal, operation.sectionId, locale, primaryLocale);
      return locale === "fi"
        ? `Lisää ${added} ennen alatunnistetta.`
        : `Add the ${added} before the footer.`;
    }
    case "REMOVE_OPTIONAL_SECTION":
      return locale === "fi" ? `Poista ${section}.` : `Remove the ${section}.`;
    case "REORDER_SECTIONS": {
      const order = operation.sectionIds
        .map((sectionId) => sectionReference(proposal, sectionId, locale, primaryLocale))
        .join(", ");
      return locale === "fi"
        ? `Järjestä sivun osiot tähän järjestykseen: ${order}.`
        : `Reorder the page sections to: ${order}.`;
    }
  }
}

export function proposalChangeDetails(
  proposal: DesignProposal,
  locale: Locale,
  primaryLocale: Locale,
) {
  return proposal.operations.map((operation) =>
    detailForOperation(proposal, operation, locale, primaryLocale),
  );
}

export const proposalDetailsHeading: Record<Locale, string> = {
  en: "Proposed changes",
  fi: "Ehdotetut muutokset",
};
