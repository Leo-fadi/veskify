import { ProjectEditorClient } from "./project-editor-client";
import { P10B16P03_PROJECT_ID } from "@/data/demo/p10b-16p-03-studio-identity";
import { loadP905bLocalDemoEditorSession } from "@/integrations/ai/p9-05b-local-demo-authority.server";
import { loadP10bLiveSynthesisEditorSession } from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";
import {
  loadP10B16P03CurrentEvidenceReferences,
  loadP10B16P03InitialDraftAuthority,
} from "@/integrations/ai/prompted-storefront-studio-authority.server";

export default async function ProjectEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    "p9-05b-session"?: string;
    "p10b-16l-session"?: string;
  }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const p905bSessionId = query["p9-05b-session"];
  const p10b16lSessionId = query["p10b-16l-session"];
  const localDemoBridge =
    p905bSessionId && !p10b16lSessionId && projectId === "project_lumo_fresh"
      ? await loadP905bLocalDemoEditorSession({
          projectId,
          sessionId: p905bSessionId,
        })
          .then((bridge) => (bridge ? { ...bridge, kind: "p9-05b" as const } : null))
          .catch(() => null)
      : p10b16lSessionId && !p905bSessionId
        ? await loadP10bLiveSynthesisEditorSession({
            projectId,
            sessionId: p10b16lSessionId,
          }).catch(() => null)
        : null;
  const initialEvidenceReferences = localDemoBridge
    ? []
    : await loadP10B16P03CurrentEvidenceReferences({ projectId });
  const promptedInitialDraftAuthority = localDemoBridge
    ? undefined
    : await loadP10B16P03InitialDraftAuthority({ projectId });
  return (
    <ProjectEditorClient
      projectId={projectId}
      initialEvidenceReferences={initialEvidenceReferences}
      promptedInitialDraftAuthority={promptedInitialDraftAuthority}
      initialDesignAgentTarget={
        !localDemoBridge && projectId === P10B16P03_PROJECT_ID ? "storefront" : undefined
      }
      localDemoBridge={localDemoBridge ?? undefined}
    />
  );
}
