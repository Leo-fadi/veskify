import { ProjectPreviewClient } from "../project-preview-client";
import { notFound } from "next/navigation";
import { parsePreviewLocaleParameter, type PreviewRouteParameter } from "../preview-mode";

export default async function PublishedProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ "p9-05b-session"?: string; locale?: PreviewRouteParameter }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const sessionId = query["p9-05b-session"];
  const locale = parsePreviewLocaleParameter(query.locale);
  if (!locale.valid) notFound();
  return (
    <ProjectPreviewClient
      projectId={projectId}
      publishedSessionId={projectId === "project_lumo_fresh" ? sessionId : undefined}
      snapshotKind="published"
      {...(locale.value ? { initialLocale: locale.value } : {})}
    />
  );
}
