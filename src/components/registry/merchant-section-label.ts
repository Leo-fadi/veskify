import type { Locale } from "@/domain/shared";
import type { PageModel, SectionInstance } from "@/domain/storefront";
import { getComponentDefinition } from "./registry";

const finnishSectionLabels: Readonly<Record<string, string>> = {
  announcementBar: "Ilmoituspalkki",
  header: "Kaupan ylätunniste",
  hero: "Hero-osio",
  featuredCategories: "Nostetut kategoriat",
  productGrid: "Tuoteruudukko",
  campaignBanner: "Kampanjabanneri",
  brandStory: "Bränditarina",
  benefits: "Edut",
  newsletter: "Uutiskirje",
  footer: "Kaupan alatunniste",
  collectionHeader: "Kokoelman yläosa",
  filterBar: "Kokoelman suodattimet",
  productGallery: "Tuotekuvasto",
  productInfo: "Tuotetiedot",
  productOptions: "Tuotevalinnat",
  imageText: "Kuva ja teksti",
  relatedProducts: "Liittyvät tuotteet",
};

export function merchantSectionTypeLabel(component: string, locale: Locale): string {
  if (locale === "fi" && finnishSectionLabels[component]) {
    return finnishSectionLabels[component];
  }
  return getComponentDefinition(component).label;
}

export function merchantEditorSectionLabel(
  page: PageModel,
  section: SectionInstance,
  locale: Locale,
): string {
  const matchingSections = page.sections.filter(
    (candidate) => candidate.component === section.component,
  );
  const instance = matchingSections.findIndex((candidate) => candidate.id === section.id) + 1;
  const base = merchantSectionTypeLabel(section.component, locale);
  if (instance <= 1) return base;
  return locale === "fi" ? `${base} — kopio ${instance}` : `${base} — Copy ${instance}`;
}
