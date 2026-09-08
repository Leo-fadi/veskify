import { EditorialHero } from "@/components/storefront/homepage-sections";
import { defineComponent } from "./contract";
import {
  aurumHeroContentSchema,
  aurumHeroMetadata,
  aurumHeroPropsSchema,
} from "./aurum-hero-metadata";

export { aurumHeroContentSchema, aurumHeroPropsSchema };

export const aurumHeroDefinition = defineComponent({
  ...aurumHeroMetadata,
  renderer: ({ variant, content, props, context }) => (
    <EditorialHero
      {...content}
      {...props}
      className={`store-vocabulary store-variant--${variant}`}
      context={context}
    />
  ),
});
