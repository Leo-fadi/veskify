import { homepageMetadataDefinitions } from "@/components/registry/homepage-metadata";
import { aurumHeroMetadataDefinitions } from "@/components/registry/aurum-hero-metadata";
import {
  homepageCommerceBridgeDefaults,
  type HomepageCommerceBridgeComponent,
} from "@/components/registry/homepage-commerce-bridge-metadata";

const legacyMetadata = { ...homepageMetadataDefinitions, ...aurumHeroMetadataDefinitions };

/** Defaults-only projection for the existing planner; component authority stays in V2. */
export function getHomepagePlanningDefaults(component: string): Readonly<{
  defaultContent: Readonly<Record<string, unknown>>;
  defaultProps: Readonly<Record<string, unknown>>;
}> {
  if (Object.hasOwn(legacyMetadata, component)) {
    const metadata = legacyMetadata[component as keyof typeof legacyMetadata];
    return {
      defaultContent: metadata.contentSchema.parse(metadata.defaultContent),
      defaultProps: metadata.propsSchema.parse(metadata.defaultProps),
    };
  }
  if (Object.hasOwn(homepageCommerceBridgeDefaults, component)) {
    const name = component as HomepageCommerceBridgeComponent;
    const defaults = homepageCommerceBridgeDefaults[name];
    return {
      defaultContent: structuredClone(defaults.content),
      defaultProps: structuredClone(defaults.props),
    };
  }
  throw new Error(`Unknown storefront component: ${component}.`);
}
