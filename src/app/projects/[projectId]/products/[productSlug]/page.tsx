import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ProductPreviewClient } from "./product-preview-client";
import { ProjectPreviewClient } from "../../project-preview-client";
import { loadP10bLiveSynthesisPreviewSession } from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";
import { loadP10B16P03CurrentEvidenceReferences } from "@/integrations/ai/prompted-storefront-studio-authority.server";
import {
  loadP10B16P04CurrentEvidenceReferences,
  loadP10B16P04ProposalPreviewAuthority,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; productSlug: string }>;
  searchParams: Promise<{
    "p10b-16l-session"?: string;
    "p10b-16p-04-proposal"?: string;
  }>;
}) {
  const { projectId, productSlug } = await params;
  const httpHeaders = await headers();
  const query = await searchParams;
  const sessionId = query["p10b-16l-session"];
  const proposalFingerprint = query["p10b-16p-04-proposal"];
  if (sessionId && proposalFingerprint) notFound();
  const bridge = sessionId
    ? await loadP10bLiveSynthesisPreviewSession({ projectId, sessionId }).catch(() => null)
    : null;
  if (sessionId && !bridge) notFound();
  if (bridge) {
    return (
      <ProjectPreviewClient
        projectId={projectId}
        pageSlug={`/products/${productSlug}`}
        draftSessionId={bridge.sessionId}
        initialAggregate={bridge.aggregate}
        initialEvidenceReferences={bridge.evidenceReferences}
      />
    );
  }
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
    <ProductPreviewClient
      productId={projectId}
      productSlug={productSlug}
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
