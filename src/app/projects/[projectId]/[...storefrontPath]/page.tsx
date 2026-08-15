import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ProjectPreviewClient } from "../project-preview-client";
import { loadP10bLiveSynthesisPreviewSession } from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";
import { loadP10B16P03CurrentEvidenceReferences } from "@/integrations/ai/prompted-storefront-studio-authority.server";
import {
  loadP10B16P04CurrentEvidenceReferences,
  loadP10B16P04ProposalPreviewAuthority,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";

export default async function ProjectStorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; storefrontPath: string[] }>;
  searchParams: Promise<{
    "p10b-16l-session"?: string;
    "p10b-16p-04-proposal"?: string;
    "p10b-16p-04-utility"?: string;
  }>;
}) {
  const { projectId, storefrontPath } = await params;
  const httpHeaders = await headers();
  const query = await searchParams;
  const sessionId = query["p10b-16l-session"];
  const proposalFingerprint = query["p10b-16p-04-proposal"];
  const utilityContext = query["p10b-16p-04-utility"];
  if (sessionId && proposalFingerprint) notFound();
  const p10b16p04Evidence = loadP10B16P04CurrentEvidenceReferences({
    projectId,
    httpHeaders,
  });
  if (
    utilityContext !== undefined &&
    (p10b16p04Evidence === undefined || !["empty", "populated"].includes(utilityContext))
  )
    notFound();
  const bridge = sessionId
    ? await loadP10bLiveSynthesisPreviewSession({ projectId, sessionId }).catch(() => null)
    : null;
  if (sessionId && !bridge) notFound();
  const proposalAggregate = proposalFingerprint
    ? loadP10B16P04ProposalPreviewAuthority({
        projectId,
        candidateFingerprint: proposalFingerprint,
        httpHeaders,
      })
    : undefined;
  if (proposalFingerprint && !proposalAggregate) notFound();
  const initialEvidenceReferences =
    bridge?.evidenceReferences ??
    p10b16p04Evidence ??
    (await loadP10B16P03CurrentEvidenceReferences({ projectId }));
  return (
    <ProjectPreviewClient
      projectId={projectId}
      pageSlug={`/${storefrontPath.join("/")}`}
      initialEvidenceReferences={initialEvidenceReferences}
      {...(proposalAggregate
        ? {
            initialAggregate: proposalAggregate,
            proposalCandidateFingerprint: proposalFingerprint,
          }
        : bridge
          ? {
              draftSessionId: bridge.sessionId,
              initialAggregate: bridge.aggregate,
            }
          : {})}
      {...(utilityContext === "empty" || utilityContext === "populated"
        ? { p10b16p04UtilityContext: utilityContext }
        : {})}
    />
  );
}
