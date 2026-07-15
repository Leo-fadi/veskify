import { z } from "zod";
import { AurumHero } from "@/components/storefront/aurum-hero";
import { localizedTextSchema, localeSchema } from "@/domain/shared";
import { defineComponent } from "./contract";

export const aurumHeroContentSchema = z
  .object({
    eyebrow: localizedTextSchema,
    title: localizedTextSchema,
    body: localizedTextSchema,
  })
  .strict();

export const aurumHeroPropsSchema = z
  .object({
    activeLocale: localeSchema,
    primaryLocale: localeSchema,
  })
  .strict();

export const aurumHeroDefinition = defineComponent({
  type: "hero",
  label: "Aurum hero",
  allowedPageTypes: ["home", "landing"],
  variants: ["editorial"] as const,
  defaultVariant: "editorial",
  contentSchema: aurumHeroContentSchema,
  propsSchema: aurumHeroPropsSchema,
  defaultContent: {
    eyebrow: { en: "Aurum Nordic" },
    title: { en: "Nordic jewellery with a warm golden finish" },
    body: {
      en: "A controlled demo component rendered through Veskify-owned storefront code and configured through Puck.",
    },
  },
  defaultProps: { activeLocale: "en", primaryLocale: "en" },
  editorFields: {
    eyebrow: { source: "content", control: "text", label: "Small heading", localized: true },
    title: { source: "content", control: "text", label: "Main heading", localized: true },
    body: { source: "content", control: "textarea", label: "Supporting text", localized: true },
    activeLocale: {
      source: "props",
      control: "select",
      label: "Storefront language",
      options: [
        { label: "English", value: "en" },
        { label: "Finnish", value: "fi" },
      ],
    },
    primaryLocale: {
      source: "props",
      control: "select",
      label: "Primary language",
      options: [
        { label: "English", value: "en" },
        { label: "Finnish", value: "fi" },
      ],
    },
  },
  protectedFields: { readOnlyPaths: [] },
  renderer: ({ variant, content, props }) => (
    <AurumHero variant={variant} {...content} {...props} />
  ),
});
