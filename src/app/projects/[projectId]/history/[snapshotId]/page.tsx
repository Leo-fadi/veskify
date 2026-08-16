import { ProjectPreviewClient } from "../../project-preview-client";
import { notFound } from "next/navigation";
import { parsePreviewLocaleParameter, type PreviewRouteParameter } from "../../preview-mode";

export default async function HistoricalPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; snapshotId: string }>;
  searchParams?: Promise<{ locale?: PreviewRouteParameter }>;
}) {
  const { projectId, snapshotId } = await params;
  const locale = parsePreviewLocaleParameter((await searchParams)?.locale);
  if (!locale.valid) notFound();
  return (
    <ProjectPreviewClient
      historicalSnapshotId={snapshotId}
      projectId={projectId}
      snapshotKind="history"
      {...(locale.value ? { initialLocale: locale.value } : {})}
    />
  );
}
