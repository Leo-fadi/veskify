import { z } from "zod";
import {
  assetRefSchema,
  localizedTextSchema,
  safeExternalUrlSchema,
} from "@/domain/shared/schemas";
import type { defineComponent } from "./contract";

const safeHrefSchema = z.union([z.string().regex(/^\/(?:[a-z0-9-]+\/?)*$/), safeExternalUrlSchema]);

export const aurumHeroContentSchema = z
  .object({
    eyebrow: localizedTextSchema,
    title: localizedTextSchema,
    body: localizedTextSchema,
    cta: z.object({ label: localizedTextSchema, href: safeHrefSchema }).strict(),
    media: assetRefSchema.refine((asset) => asset.url.startsWith("/seed-assets/"), {
      message: "Hero media must use a controlled local seed asset.",
    }),
  })
  .strict();

export const aurumHeroPropsSchema = z.object({ mediaPosition: z.enum(["left", "right"]) }).strict();

const variants = ["editorial", "fullBleed", "asymmetric", "restrained"] as const;
type AurumHeroMetadataInput = Omit<
  Parameters<
    typeof defineComponent<
      typeof aurumHeroContentSchema,
      typeof aurumHeroPropsSchema,
      typeof variants
    >
  >[0],
  "renderer" | "validateContext"
>;

/** Renderer-free declarative source for the legacy hero definition. */
export const aurumHeroMetadata = {
  type: "hero",
  label: "Hero",
  allowedPageTypes: ["home", "landing"],
  variants,
  defaultVariant: "editorial",
  contentSchema: aurumHeroContentSchema,
  propsSchema: aurumHeroPropsSchema,
  defaultContent: {
    eyebrow: { en: "Aurum Nordic", fi: "Aurum Nordic" },
    title: { en: "Made for northern light", fi: "Tehty pohjoiseen valoon" },
    body: { en: "Jewellery shaped by Nordic clarity.", fi: "Pohjoismaisen selkeitä koruja." },
    cta: {
      label: { en: "Explore the collection", fi: "Tutustu mallistoon" },
      href: "/collections/rings",
    },
    media: {
      id: "asset_hero_default",
      url: "/seed-assets/aurora-ring.svg",
      alt: { en: "Aurora gold ring", fi: "Aurora-kultasormus" },
      decorative: false,
    },
  },
  defaultProps: { mediaPosition: "right" },
  editorFields: {
    eyebrow: { source: "content", control: "text", label: "Small heading", localized: true },
    title: { source: "content", control: "text", label: "Main heading", localized: true },
    body: { source: "content", control: "textarea", label: "Supporting text", localized: true },
    mediaPosition: {
      source: "props",
      control: "select",
      label: "Media position",
      options: [
        { label: "Right", value: "right" },
        { label: "Left", value: "left" },
      ],
    },
  },
  protectedFields: { readOnlyPaths: ["media.url"] },
} as const satisfies AurumHeroMetadataInput;

/** Ordered metadata group for the later V2 adapter consumer. */
export const aurumHeroMetadataDefinitions = { hero: aurumHeroMetadata } as const;
