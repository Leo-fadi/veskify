import { createComponentCapabilityManifestAuthority } from "@/domain/component-platform";
import { veskifyComponentDefinitionsV2 } from "./v2-registry";

/**
 * The only live manifest projection. It is generated from the registered V2
 * definitions and exposes no registration or mutation operation.
 */
export const veskifyComponentCapabilityManifest = createComponentCapabilityManifestAuthority(
  veskifyComponentDefinitionsV2,
);
