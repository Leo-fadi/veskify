import { listExecutablePageBlueprintProfiles } from "@/application/storefront-templates/registry";
import {
  createRendererConformanceReport,
  type RendererConformanceReport,
} from "./renderer-conformance";
import { veskifyComponentCapabilityManifest } from "./capability-manifest";
import { veskifyComponentDefinitionsV2 } from "./v2-registry";
import { collectLiveRendererRegistrations } from "./renderer-observation";

export function createLiveRendererConformanceReport(): RendererConformanceReport {
  return createRendererConformanceReport({
    componentDefinitions: veskifyComponentDefinitionsV2,
    pagePlans: listExecutablePageBlueprintProfiles(),
    manifestAuthority: veskifyComponentCapabilityManifest,
    rendererRegistrations: collectLiveRendererRegistrations(),
  });
}
