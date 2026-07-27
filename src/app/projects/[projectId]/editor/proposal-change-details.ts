import type { DesignOperation, DesignProposal } from "@/application/design-operations";
import { getComponentDefinition } from "@/components/registry";
import type { Locale } from "@/domain/shared";
import type { PageModel, SectionInstance } from "@/domain/storefront";

export type ProposalChangeDetail = {
  sectionId: string | null;
  title: string;
  summary: string;
  operationIndexes: number[];
};

export type ProposalChangeDetails = {
  items: ProposalChangeDetail[];
  representedOperationIndexes: number[];
  complete: boolean;
};

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
  serif: { en: "premium serif", fi: "ylellinen antiikva" },
  sans: { en: "clean sans serif", fi: "selkeä groteski" },
  strong: { en: "strong", fi: "vahva" },
  compact: { en: "compact", fi: "tiivis" },
  standard: { en: "balanced", fi: "tasapainoinen" },
  spacious: { en: "more spacious", fi: "väljempi" },
  square: { en: "square", fi: "kulmikas" },
  soft: { en: "soft", fi: "pehmeä" },
  rounded: { en: "rounded", fi: "pyöristetty" },
  left: { en: "left-aligned", fi: "vasemmalle tasattu" },
  center: { en: "centred", fi: "keskitetty" },
  text: { en: "text link", fi: "tekstilinkki" },
  editorial: { en: "editorial", fi: "toimituksellinen" },
  editorialCards: { en: "editorial cards", fi: "toimitukselliset kortit" },
  imageLed: { en: "image-led", fi: "kuvapainotteinen" },
  imageOverlay: { en: "image overlay", fi: "kuvan päälle aseteltu" },
  split: { en: "split", fi: "jaettu" },
  minimal: { en: "minimal", fi: "pelkistetty" },
  singleLine: { en: "single-line", fi: "yksirivinen" },
  centered: { en: "centred", fi: "keskitetty" },
  columns: { en: "column", fi: "palsta" },
  inline: { en: "inline", fi: "samalla rivillä" },
  card: { en: "card", fi: "kortti" },
  fullWidth: { en: "full-width", fi: "täysleveä" },
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

export function localizedMerchantValue(value: unknown, locale: Locale, primaryLocale: Locale) {
  if (!value || typeof value !== "object") return undefined;
  const localized = value as Partial<Record<Locale, unknown>>;
  const preferred = localized[locale] ?? localized[primaryLocale] ?? localized.en ?? localized.fi;
  return typeof preferred === "string" && preferred.trim() ? preferred : undefined;
}

function sectionFor(page: PageModel, sectionId: string) {
  return page.sections.find((section) => section.id === sectionId);
}

export function merchantSectionName(
  section: SectionInstance | undefined,
  locale: Locale,
  primaryLocale: Locale,
) {
  if (!section) return locale === "fi" ? "Valittu osio" : "Selected section";
  for (const field of ["title", "heading", "eyebrow"]) {
    const value = localizedMerchantValue(section.content[field], locale, primaryLocale);
    if (value) return value;
  }
  return getComponentDefinition(section.component).label;
}

function detailTitle(
  proposal: DesignProposal,
  sectionId: string | null,
  locale: Locale,
  primaryLocale: Locale,
) {
  if (sectionId === null) {
    return (
      localizedMerchantValue(proposal.proposedPage.title, locale, primaryLocale) ??
      localizedMerchantValue(proposal.originalPage.title, locale, primaryLocale) ??
      (locale === "fi" ? "Nykyinen sivu" : "Current page")
    );
  }
  const section =
    sectionFor(proposal.proposedPage, sectionId) ?? sectionFor(proposal.originalPage, sectionId);
  return merchantSectionName(section, locale, primaryLocale);
}

function languageName(language: Locale, locale: Locale) {
  if (locale === "fi") return language === "fi" ? "suomenkielinen" : "englanninkielinen";
  return language === "fi" ? "Finnish" : "English";
}

function sentence(parts: string[], locale: Locale) {
  const uniqueParts = [...new Set(parts)];
  const last = uniqueParts.pop();
  if (!last) return "";
  const joined =
    uniqueParts.length === 0
      ? last
      : `${uniqueParts.join(", ")} ${locale === "fi" ? "ja" : "and"} ${last}`;
  return `${joined.charAt(0).toLocaleUpperCase(locale)}${joined.slice(1)}.`;
}

function operationTargets(
  proposal: DesignProposal,
  operation: DesignOperation,
): Array<string | null> {
  if ("sectionId" in operation) return [operation.sectionId];
  if (operation.type === "REORDER_SECTIONS") {
    const originalIndexes = new Map(
      proposal.originalPage.sections.map((section, index) => [section.id, index]),
    );
    const proposedIndexes = new Map(
      proposal.proposedPage.sections.map((section, index) => [section.id, index]),
    );
    return operation.sectionIds.filter((sectionId) => {
      const originalIndex = originalIndexes.get(sectionId);
      const proposedIndex = proposedIndexes.get(sectionId);
      return (
        originalIndex !== undefined &&
        proposedIndex !== undefined &&
        originalIndex !== proposedIndex
      );
    });
  }
  if (operation.type === "APPLY_APPROVED_BRAND_COLOURS") return [null];
  if (operation.type === "APPLY_REGISTERED_PAGE_SECTIONS") return [null];
  return [];
}

export function merchantOperationChangePart(
  operation: DesignOperation,
  sectionId: string | null,
  locale: Locale,
  proposedPage?: PageModel,
): string | undefined {
  switch (operation.type) {
    case "CHANGE_LOCALIZED_SECTION_TEXT": {
      const field = fieldNames[operation.field]?.[locale] ?? (locale === "fi" ? "teksti" : "text");
      return locale === "fi"
        ? `${languageName(operation.locale, locale)} ${field} muotoon ”${operation.value}”`
        : `${languageName(operation.locale, locale)} ${field} changed to “${operation.value}”`;
    }
    case "CHANGE_SECTION_VARIANT":
      return locale === "fi"
        ? `${option(operation.variant, locale)} asettelu`
        : `${option(operation.variant, locale)} layout`;
    case "CHANGE_BACKGROUND":
      return locale === "fi"
        ? `${option(operation.background, locale)} tausta`
        : `${option(operation.background, locale)} background`;
    case "CHANGE_TYPOGRAPHY":
      return locale === "fi"
        ? `${option(operation.typography, locale)} typografia`
        : `${option(operation.typography, locale)} typography`;
    case "CHANGE_DENSITY":
      return locale === "fi"
        ? `${option(operation.density, locale)} väljyys`
        : `${option(operation.density, locale)} spacing`;
    case "CHANGE_SHAPE":
      return locale === "fi"
        ? `${option(operation.shape, locale)} muotokieli`
        : `${option(operation.shape, locale)} shapes`;
    case "CHANGE_ALIGNMENT":
      return locale === "fi"
        ? `${option(operation.alignment, locale)} sisältö`
        : `${option(operation.alignment, locale)} content`;
    case "CHANGE_CTA_STYLE":
      return locale === "fi"
        ? `${option(operation.ctaPresentation, locale)} toimintopainike`
        : `${option(operation.ctaPresentation, locale)} call to action`;
    case "APPLY_APPROVED_BRAND_COLOURS": {
      const colours = Object.entries(operation.colors)
        .map(([name, value]) => `${colourNames[name]?.[locale] ?? humanize(name)} ${value}`)
        .join(", ");
      return locale === "fi"
        ? `hyväksytyt brändivärit: ${colours}`
        : `approved brand colours: ${colours}`;
    }
    case "APPLY_APPROVED_BRAND_TYPOGRAPHY":
      return locale === "fi"
        ? `hyväksytty bränditypografia: ${humanize(operation.typography.headingFont)} otsikoihin ja ${humanize(operation.typography.bodyFont)} leipätekstiin`
        : `approved brand typography: ${humanize(operation.typography.headingFont)} headings and ${humanize(operation.typography.bodyFont)} body text`;
    case "APPLY_REGISTERED_PAGE_SECTIONS": {
      const sectionCount = operation.sections.length;
      const removedSectionCount = operation.removedSectionIds.length;
      if (locale === "fi") {
        return `hyväksytty ${sectionCount} osion sivurakenne${
          removedSectionCount > 0 ? `, joka korvaa ${removedSectionCount} nykyistä osiota` : ""
        }`;
      }
      return `approved page composition with ${sectionCount} ${
        sectionCount === 1 ? "section" : "sections"
      }${
        removedSectionCount > 0
          ? `, replacing ${removedSectionCount} existing ${
              removedSectionCount === 1 ? "section" : "sections"
            }`
          : ""
      }`;
    }
    case "ADD_APPROVED_SECTION":
      return locale === "fi"
        ? `lisää tämä ${operation.variant ? `${option(operation.variant, locale)} ` : ""}osio`
        : `add this ${operation.variant ? `${option(operation.variant, locale)} ` : ""}section`;
    case "REMOVE_OPTIONAL_SECTION":
      return locale === "fi" ? "poista tämä osio" : "remove this section";
    case "REORDER_SECTIONS": {
      if (sectionId === null) return undefined;
      const position =
        proposedPage?.sections.findIndex((section) => section.id === sectionId) ?? -1;
      if (position < 0) return undefined;
      return locale === "fi"
        ? `uusi paikka sivulla: ${position + 1}`
        : `new page position: ${position + 1}`;
    }
  }
}

export function proposalChangeDetails(
  proposal: DesignProposal,
  locale: Locale,
  primaryLocale: Locale,
): ProposalChangeDetails {
  const groups = new Map<
    string,
    { sectionId: string | null; parts: string[]; operationIndexes: number[] }
  >();

  proposal.operations.forEach((operation, operationIndex) => {
    for (const sectionId of operationTargets(proposal, operation)) {
      const part = merchantOperationChangePart(operation, sectionId, locale, proposal.proposedPage);
      if (!part) continue;
      const key = sectionId ?? `page:${proposal.originalPage.id}`;
      const group = groups.get(key) ?? { sectionId, parts: [], operationIndexes: [] };
      group.parts.push(part);
      group.operationIndexes.push(operationIndex);
      groups.set(key, group);
    }
  });

  const items = [...groups.values()].map((group) => ({
    sectionId: group.sectionId,
    title: detailTitle(proposal, group.sectionId, locale, primaryLocale),
    summary: sentence(group.parts, locale),
    operationIndexes: [...new Set(group.operationIndexes)],
  }));
  const representedOperationIndexes = [
    ...new Set(items.flatMap((item) => item.operationIndexes)),
  ].sort((left, right) => left - right);

  return {
    items,
    representedOperationIndexes,
    complete:
      representedOperationIndexes.length === proposal.operations.length &&
      representedOperationIndexes.every((operationIndex, index) => operationIndex === index),
  };
}

export const proposalDetailsHeading: Record<Locale, string> = {
  en: "Proposed changes",
  fi: "Ehdotetut muutokset",
};
