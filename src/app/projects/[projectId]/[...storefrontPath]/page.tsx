import { notFound } from "next/navigation";
import { ProjectPreviewClient } from "../project-preview-client";
import { loadP10bLiveSynthesisPreviewSession } from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";
import { loadP10B16P03CurrentEvidenceReferences } from "@/integrations/ai/prompted-storefront-studio-authority.server";

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
  const initialEvidenceReferences =
    bridge?.evidenceReferences ?? (await loadP10B16P03CurrentEvidenceReferences({ projectId }));
  return (
    <ProjectPreviewClient
      projectId={projectId}
      pageSlug={`/${storefrontPath.join("/")}`}
      initialEvidenceReferences={initialEvidenceReferences}
      {...(bridge
        ? {
            draftSessionId: bridge.sessionId,
            initialAggregate: bridge.aggregate,
          }
        : {})}
    />
  );
}
