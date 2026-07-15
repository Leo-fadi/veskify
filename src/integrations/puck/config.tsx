import type { Config, Data } from "@puckeditor/core";
import { z } from "zod";
import { veskifyStorefrontComponents, veskifyComponentSchemas } from "./veskify-components";

type AurumHeroPuckProps = {
  eyebrow: string;
  title: string;
  body: string;
  activeLocale: "en" | "fi";
  primaryLocale: "en" | "fi";
};

export const veskifyPuckConfig = {
  components: {
    AurumHero: {
      label: "Aurum hero",
      fields: {
        eyebrow: { type: "text", label: "Small heading" },
        title: { type: "text", label: "Main heading" },
        body: { type: "textarea", label: "Supporting text" },
        activeLocale: {
          type: "select",
          label: "Storefront language",
          options: [
            { label: "English", value: "en" },
            { label: "Finnish", value: "fi" },
          ],
        },
        primaryLocale: {
          type: "select",
          label: "Primary language",
          options: [
            { label: "English", value: "en" },
            { label: "Finnish", value: "fi" },
          ],
        },
      },
      defaultProps: {
        eyebrow: "Aurum Nordic",
        title: "Nordic jewellery with a warm golden finish",
        body: "A controlled demo component rendered through Veskify-owned storefront code and configured through Puck.",
        activeLocale: "en",
        primaryLocale: "en",
      },
      render: ({ eyebrow, title, body, activeLocale, primaryLocale }) =>
        veskifyStorefrontComponents.AurumHero.render({
          variant: "editorial",
          eyebrow: { en: eyebrow },
          title: { en: title },
          body: { en: body },
          activeLocale,
          primaryLocale,
        }),
    },
  },
} satisfies Config<{ AurumHero: AurumHeroPuckProps }>;

export const initialPuckData = {
  content: [
    {
      type: "AurumHero",
      props: {
        id: "aurum_hero_demo",
        eyebrow: "Aurum Nordic",
        title: "Nordic jewellery with a warm golden finish",
        body: "This is a minimal Puck integration proof. It is not publishing or persisting data yet.",
        activeLocale: "en",
        primaryLocale: "en",
      },
    },
  ],
  root: { props: { title: "Aurum Nordic Puck proof" } },
} satisfies Data;

const puckAurumHeroItemSchema = z
  .object({
    type: z.literal("AurumHero"),
    props: z
      .object({
        id: z.string().optional(),
        eyebrow: z.string().min(1),
        title: z.string().min(1),
        body: z.string().min(1),
        activeLocale: z.enum(["en", "fi"]),
        primaryLocale: z.enum(["en", "fi"]),
      })
      .strict(),
  })
  .strict();

export const veskifyPuckDataSchema = z
  .object({
    content: z.array(puckAurumHeroItemSchema),
    root: z.object({ props: z.record(z.string(), z.unknown()).optional() }).optional(),
    zones: z.record(z.string(), z.array(puckAurumHeroItemSchema)).optional(),
  })
  .strict();

export type ValidatedPuckData = z.infer<typeof veskifyPuckDataSchema>;

export function validatePuckDraftPayload(data: Data): ValidatedPuckData {
  const parsed = veskifyPuckDataSchema.parse(data);

  for (const item of parsed.content) {
    veskifyComponentSchemas.AurumHero.parse({
      variant: "editorial",
      eyebrow: { en: item.props.eyebrow },
      title: { en: item.props.title },
      body: { en: item.props.body },
      activeLocale: item.props.activeLocale,
      primaryLocale: item.props.primaryLocale,
    });
  }

  return parsed;
}
