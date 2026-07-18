import type { Project } from "@/domain/project";

export type SnapshotKind = "draft" | "published" | "history";

export function selectedSnapshotId(
  project: Project,
  snapshotKind: SnapshotKind,
  historicalSnapshotId?: string,
): string | undefined {
  if (snapshotKind === "history") return historicalSnapshotId;
  return snapshotKind === "published" ? project.publishedSnapshotId : project.draftSnapshotId;
}

export function previewPathPrefix(
  projectId: string,
  snapshotKind: SnapshotKind,
  historicalSnapshotId?: string,
): string {
  if (snapshotKind === "history" && historicalSnapshotId) {
    return `/projects/${projectId}/history/${historicalSnapshotId}`;
  }
  return snapshotKind === "published"
    ? `/projects/${projectId}/published`
    : `/projects/${projectId}`;
}

export function previewLabel(snapshotKind: SnapshotKind): string {
  if (snapshotKind === "published") return "Published storefront";
  if (snapshotKind === "history") return "Previous version";
  return "Draft preview";
}
