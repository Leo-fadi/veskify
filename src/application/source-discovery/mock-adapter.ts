import {
  assetCandidateSchema,
  sourceDiscoveryResultSchema,
  type SourceDiscoveryResult,
  type SourceReference,
} from "@/domain/source-discovery";
import type { SourceDiscoveryAdapter } from "./contract";

export class DeterministicMockSourceDiscoveryAdapter implements SourceDiscoveryAdapter {
  readonly id = "deterministic-source-discovery-mock";

  discover({ source }: { source: SourceReference }): SourceDiscoveryResult {
    const observedAt = source.discoveredAt;
    const evidence = [
      {
        id: `evidence_${source.id}_identity`,
        kind: "page-identity" as const,
        provenance: {
          sourceReferenceId: source.id,
          sourceUrl: source.url,
          documentUrl: source.url,
          observedAt,
          extractionLocation: "deterministic fixture page identity",
        },
        sourceUrl: source.url,
        confidence: 0.95,
        observedValue: { pageTitle: "Demo storefront", pageType: "home" },
        extractionMethod: "deterministic-fixture",
        locale: source.requestedLocale,
        warnings: [],
        uncertainty: { isUncertain: false, reason: null },
      },
      {
        id: `evidence_${source.id}_logo`,
        kind: "logo-candidate" as const,
        provenance: {
          sourceReferenceId: source.id,
          sourceUrl: source.url,
          documentUrl: source.url,
          observedAt,
          extractionLocation: "deterministic fixture logo",
        },
        sourceUrl: source.url,
        confidence: 0.9,
        observedValue: { assetId: `asset_${source.id}_logo` },
        extractionMethod: "deterministic-fixture",
        locale: null,
        warnings: [],
        uncertainty: { isUncertain: false, reason: null },
      },
    ];
    const asset = assetCandidateSchema.parse({
      id: `asset_${source.id}_logo`,
      role: "logo",
      source: { kind: "source-url", url: source.url },
      dimensions: null,
      mediaType: "image/svg+xml",
      provenance: {
        sourceReferenceId: source.id,
        sourceUrl: source.url,
        documentUrl: source.url,
        observedAt,
        extractionLocation: "deterministic fixture logo",
      },
      confidence: 0.9,
      proposedReusePurpose: "Use as the merchant logo after confirmation.",
      licensingUsageConfirmation: "pending",
      warnings: [],
      uncertainty: { isUncertain: true, reason: "Merchant approval is required before reuse." },
      fingerprint: null,
      duplicateOfAssetId: null,
    });
    return sourceDiscoveryResultSchema.parse({
      source,
      evidence,
      assetCandidates: [asset],
      warnings: [],
    });
  }
}

export function createDeterministicMockDiscoveryAdapter(): SourceDiscoveryAdapter {
  return new DeterministicMockSourceDiscoveryAdapter();
}
