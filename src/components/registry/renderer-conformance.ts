import {
  createRendererConformanceReportCore,
  type RendererConformanceInput,
  type RendererConformanceReport,
} from "./renderer-conformance-core";
import { veskifyComponentRegistry } from "./registry";

export {
  rendererConformanceFindingCategories,
  type RendererConformanceClassification,
  type RendererConformanceFinding,
  type RendererConformanceFindingCategory,
  type RendererConformanceInput,
  type RendererConformanceReport,
  type RendererRegistration,
  type RendererTarget,
  type RendererVariantCapability,
} from "./renderer-conformance-core";

/**
 * Produces a live report using the current V1 bridge map. The renderer-free
 * evaluator is available from renderer-conformance-core for deterministic use.
 */
export function createRendererConformanceReport(
  input: RendererConformanceInput,
): RendererConformanceReport {
  return createRendererConformanceReportCore(input, Object.keys(veskifyComponentRegistry));
}
