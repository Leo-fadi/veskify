import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SearchPreviewClient } from "./search-preview-client";
import {
  parseStorefrontSearchContextParameter,
  parseStorefrontSearchUtilityContextParameter,
  type StorefrontSearchRouteParameters,
} from "./search-route-parameters";
import { loadP10B16P03CurrentEvidenceReferences } from "@/integrations/ai/prompted-storefront-studio-authority.server";
import {
  loadP10B16P04CurrentEvidenceReferences,
  loadP10B16P04ProposalPreviewAuthority,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<StorefrontSearchRouteParameters>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const proposal = parseStorefrontSearchContextParameter(query, "p10b-16p-04-proposal");
  const utility = parseStorefrontSearchUtilityContextParameter(query);
  if (!proposal.valid || !utility.valid) notFound();
  const proposalFingerprint = proposal.value;
  const utilityContext = utility.value;
  const httpHeaders = await headers();
  const proposalAggregate = proposalFingerprint
    ? loadP10B16P04ProposalPreviewAuthority({
        projectId,
        candidateFingerprint: proposalFingerprint,
        httpHeaders,
      })
    : undefined;
  if (proposalFingerprint && !proposalAggregate) notFound();
  const p10b16p04Evidence = loadP10B16P04CurrentEvidenceReferences({ projectId, httpHeaders });
  if (utilityContext && !p10b16p04Evidence) notFound();
  const initialEvidenceReferences =
    p10b16p04Evidence ?? (await loadP10B16P03CurrentEvidenceReferences({ projectId }));
  return (
    <SearchPreviewClient
      initialEvidenceReferences={initialEvidenceReferences}
      projectId={projectId}
      searchParameters={query}
      {...(utilityContext ? { p10b16p04UtilityContext: utilityContext } : {})}
      {...(proposalAggregate
        ? {
            initialAggregate: proposalAggregate,
            proposalCandidateFingerprint: proposalFingerprint,
          }
        : {})}
    />
  );
}
