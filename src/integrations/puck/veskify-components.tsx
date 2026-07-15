import { z } from "zod";
import { AurumHero, type AurumHeroProps } from "@/components/storefront/aurum-hero";
import { localizedTextSchema } from "@/domain/shared";

export const aurumHeroPropsSchema = z
  .object({
    variant: z.literal("editorial"),
    eyebrow: localizedTextSchema,
    title: localizedTextSchema,
    body: localizedTextSchema,
  })
  .strict();

export const veskifyComponentSchemas = {
  AurumHero: aurumHeroPropsSchema,
} as const;

export type VeskifyComponentType = keyof typeof veskifyComponentSchemas;

export const veskifyStorefrontComponents = {
  AurumHero: {
    schema: aurumHeroPropsSchema,
    render: (props: AurumHeroProps) => <AurumHero {...props} />,
  },
} as const;
