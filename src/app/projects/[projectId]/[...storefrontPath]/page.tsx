import { notFound } from "next/navigation";
import { ProjectPreviewClient } from "../project-preview-client";
import { loadP10bLiveSynthesisPreviewSession } from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";

export default async function ProjectStorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; storefrontPath: string[] }>;
  searchParams: Promise<{ "p10b-16l-session"?: string }>;
}) {
  const { projectId, storefrontPath } = await params;
  const sessionId = (await searchParams)["p10b-16l-session"];
  const bridge = sessionId
    ? await loadP10bLiveSynthesisPreviewSession({ projectId, sessionId }).catch(() => null)
    : null;
  if (sessionId && !bridge) notFound();
  return (
    <ProjectPreviewClient
      projectId={projectId}
      pageSlug={`/${storefrontPath.join("/")}`}
      {...(bridge
        ? {
            draftSessionId: bridge.sessionId,
            initialAggregate: bridge.aggregate,
            initialEvidenceReferences: bridge.evidenceReferences,
          }
        : {})}
    />
  );
}
