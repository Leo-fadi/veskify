import { notFound } from "next/navigation";
import { CollectionPreviewClient } from "./collection-preview-client";
import { ProjectPreviewClient } from "../../project-preview-client";
import { loadP10bLiveSynthesisPreviewSession } from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; collectionSlug: string }>;
  searchParams: Promise<{ "p10b-16l-session"?: string }>;
}) {
  const { projectId, collectionSlug } = await params;
  const sessionId = (await searchParams)["p10b-16l-session"];
  const bridge = sessionId
    ? await loadP10bLiveSynthesisPreviewSession({ projectId, sessionId }).catch(() => null)
    : null;
  if (sessionId && !bridge) notFound();
  if (bridge) {
    return (
      <ProjectPreviewClient
        projectId={projectId}
        pageSlug={`/collections/${collectionSlug}`}
        draftSessionId={bridge.sessionId}
        initialAggregate={bridge.aggregate}
        initialEvidenceReferences={bridge.evidenceReferences}
      />
    );
  }
  return <CollectionPreviewClient projectId={projectId} collectionSlug={collectionSlug} />;
}
