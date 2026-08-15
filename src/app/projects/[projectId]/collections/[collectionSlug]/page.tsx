import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { CollectionPreviewClient } from "./collection-preview-client";
import { loadP10B16P03CurrentEvidenceReferences } from "@/integrations/ai/prompted-storefront-studio-authority.server";
import {
  loadP10B16P04CurrentEvidenceReferences,
  loadP10B16P04ProposalPreviewAuthority,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; collectionSlug: string }>;
  searchParams: Promise<{
    "p10b-16p-04-proposal"?: string;
  }>;
}) {
  const { projectId, collectionSlug } = await params;
  const httpHeaders = await headers();
  const query = await searchParams;
  const proposalFingerprint = query["p10b-16p-04-proposal"];
  const proposalAggregate = proposalFingerprint
    ? loadP10B16P04ProposalPreviewAuthority({
        projectId,
        candidateFingerprint: proposalFingerprint,
        httpHeaders,
      })
    : undefined;
  if (proposalFingerprint && !proposalAggregate) notFound();
  const initialEvidenceReferences =
    loadP10B16P04CurrentEvidenceReferences({ projectId, httpHeaders }) ??
    (await loadP10B16P03CurrentEvidenceReferences({ projectId }));
  return (
    <CollectionPreviewClient
      projectId={projectId}
      collectionSlug={collectionSlug}
      initialEvidenceReferences={initialEvidenceReferences}
      {...(proposalAggregate
        ? {
            initialAggregate: proposalAggregate,
            proposalCandidateFingerprint: proposalFingerprint,
          }
        : {})}
    />
  );
}
