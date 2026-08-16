import type { Project } from "@/domain/project";
import { localeSchema, type Locale } from "@/domain/shared";

export type SnapshotKind = "draft" | "published" | "history";
export type P10B16P04UtilityContext = "empty" | "populated";

export type PreviewRouteParameter = string | readonly string[] | undefined;
export type ParsedPreviewRouteParameter<T> =
  Readonly<{ valid: true; value?: T }> | Readonly<{ valid: false }>;

export function parsePreviewLocaleParameter(
  value: PreviewRouteParameter,
): ParsedPreviewRouteParameter<Locale> {
  if (value === undefined) return { valid: true };
  const parsed = localeSchema.safeParse(value);
  return parsed.success ? { valid: true, value: parsed.data } : { valid: false };
}

export function parseP10B16P04UtilityContextParameter(
  value: PreviewRouteParameter,
): ParsedPreviewRouteParameter<P10B16P04UtilityContext> {
  if (value === undefined) return { valid: true };
  return value === "empty" || value === "populated" ? { valid: true, value } : { valid: false };
}

export function previewNavigationSuffix({
  publishedSessionId,
  proposalCandidateFingerprint,
  p10b16p04UtilityContext,
  locale,
}: {
  publishedSessionId?: string;
  proposalCandidateFingerprint?: string;
  p10b16p04UtilityContext?: P10B16P04UtilityContext;
  locale?: Locale;
}): string {
  const parameters = new URLSearchParams();
  if (publishedSessionId) parameters.set("p9-05b-session", publishedSessionId);
  if (proposalCandidateFingerprint) {
    parameters.set("p10b-16p-04-proposal", proposalCandidateFingerprint);
  }
  if (p10b16p04UtilityContext) {
    parameters.set("p10b-16p-04-utility", p10b16p04UtilityContext);
  }
  if (locale) parameters.set("locale", locale);
  const query = parameters.toString();
  return query === "" ? "" : `?${query}`;
}

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
