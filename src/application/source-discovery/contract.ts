import type {
  AssetCandidate,
  BrandReconstructionProposal,
  CanonicalCommerceProjection,
  SourceDiscoveryResult,
  SourceEvidence,
  SourceReference,
  StorefrontDesignBriefContract,
} from "@/domain/source-discovery";

export type SourceDiscoveryAdapterInput = Readonly<{ source: SourceReference }>;

export interface SourceDiscoveryAdapter {
  readonly id: string;
  discover(
    input: SourceDiscoveryAdapterInput,
  ): Promise<SourceDiscoveryResult> | SourceDiscoveryResult;
}

export type SourceDiscoveryApplicationErrorCode =
  | "invalid-url"
  | "unsupported-protocol"
  | "blocked-source"
  | "unavailable-source"
  | "timeout"
  | "no-reusable-evidence"
  | "conflicting-evidence"
  | "missing-canonical-vesko-projection"
  | "stale-brief-approval"
  | "invalid-contract"
  | "invalid-lifecycle";

export class SourceDiscoveryApplicationError extends Error {
  readonly code: SourceDiscoveryApplicationErrorCode;

  constructor(code: SourceDiscoveryApplicationErrorCode, message: string) {
    super(message);
    this.name = "SourceDiscoveryApplicationError";
    this.code = code;
  }
}

export type ReconcileStorefrontSourcesInput = Readonly<{
  source: SourceReference;
  discovery: SourceDiscoveryResult;
  canonicalCommerceProjection: CanonicalCommerceProjection | null;
}>;

export type ProposeBrandReconstructionInput = Readonly<{
  source: SourceReference;
  evidence: readonly SourceEvidence[];
  assetCandidates: readonly AssetCandidate[];
}>;

export type CreateStorefrontDesignBriefInput = Readonly<{
  id: string;
  now?: Date | string;
  businessIdentity?: unknown;
  languagePlan?: unknown;
  sourceReferenceIds: readonly string[];
  sourceEvidenceIds: readonly string[];
  canonicalCommerceProjectionRef?: string | null;
  brandProposal?: BrandReconstructionProposal | null;
  approvedBrandDirection?: unknown;
  approvedReusableAssetIds?: readonly string[];
  pagePlan?: unknown;
  navigationDirection?: readonly string[];
  homepageGoals?: readonly string[];
  collectionPageGoals?: readonly string[];
  productPageGoals?: readonly string[];
  visualPriorities?: readonly string[];
  contentAssumptions?: readonly string[];
  unresolvedItems?: readonly string[];
  materialUnresolvedBlockers?: readonly string[];
  excludedClaims?: readonly string[];
  generationPermissions?: Partial<StorefrontDesignBriefContract["generationPermissions"]>;
}>;

export type ApproveStorefrontDesignBriefInput = Readonly<{
  actorId: string;
  approvedAt?: Date | string;
  approvedBrandDirection?: unknown;
}>;

export type SupersedeStorefrontDesignBriefInput = Readonly<{
  now?: Date | string;
  sourceReferenceIds?: readonly string[];
  sourceEvidenceIds?: readonly string[];
  reason?: string;
}>;
