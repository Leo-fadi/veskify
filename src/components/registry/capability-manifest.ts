import { createComponentCapabilityManifestAuthority } from "@/domain/component-platform";
import { executablePageBlueprintProfileSchema } from "@/application/storefront-templates/contract";
import { listExecutablePageBlueprintProfiles } from "@/application/storefront-templates/registry";
import { veskifyComponentDefinitionsV2 } from "./v2-registry";

/**
 * The only live manifest projection. It is generated from the registered V2
 * definitions and exposes no registration or mutation operation.
 */
export const veskifyComponentCapabilityManifest = createComponentCapabilityManifestAuthority({
  componentDefinitions: veskifyComponentDefinitionsV2,
  executableProfiles: listExecutablePageBlueprintProfiles().map((pagePlan) => pagePlan.profile),
  validateExecutableProfile: (profile) => executablePageBlueprintProfileSchema.parse(profile),
});
