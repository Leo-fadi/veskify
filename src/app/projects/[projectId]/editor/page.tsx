import { ProjectEditorClient } from "./project-editor-client";
import { headers } from "next/headers";
import { P10B16P03_PROJECT_ID } from "@/data/demo/p10b-16p-03-studio-identity";
import { loadP905bLocalDemoEditorSession } from "@/integrations/ai/p9-05b-local-demo-authority.server";
import { loadP10bLiveSynthesisEditorSession } from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";
import {
  loadP10B16P03CurrentEvidenceReferences,
  loadP10B16P03InitialDraftAuthority,
} from "@/integrations/ai/prompted-storefront-studio-authority.server";
import {
  loadP10B16P04CurrentEvidenceReferences,
  loadP10B16P04InitialAggregateAuthority,
  loadP10B16P04InitialDraftAuthority,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";

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
  const httpHeaders = await headers();
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
  const p10b16p04Evidence = loadP10B16P04CurrentEvidenceReferences({
    projectId,
    httpHeaders,
  });
  const p10b16p04InitialAggregate = loadP10B16P04InitialAggregateAuthority({
    projectId,
    httpHeaders,
  });
  const initialEvidenceReferences = localDemoBridge
    ? []
    : (p10b16p04Evidence ?? (await loadP10B16P03CurrentEvidenceReferences({ projectId })));
  const promptedInitialDraftAuthority = localDemoBridge
    ? undefined
    : (loadP10B16P04InitialDraftAuthority({ projectId, httpHeaders }) ??
      (await loadP10B16P03InitialDraftAuthority({ projectId })));
  return (
    <ProjectEditorClient
      projectId={projectId}
      initialEvidenceReferences={initialEvidenceReferences}
      promptedInitialDraftAuthority={promptedInitialDraftAuthority}
      p10b16p04Acceptance={p10b16p04Evidence !== undefined}
      p10b16p04InitialAggregate={p10b16p04InitialAggregate}
      initialDesignAgentTarget={
        !localDemoBridge &&
        (projectId === P10B16P03_PROJECT_ID || p10b16p04InitialAggregate !== undefined)
          ? "storefront"
          : undefined
      }
      localDemoBridge={localDemoBridge ?? undefined}
    />
  );
}
