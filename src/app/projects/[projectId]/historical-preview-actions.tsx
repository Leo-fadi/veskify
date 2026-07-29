import Link from "next/link";
import type { Locale } from "@/domain/shared";
import type { SnapshotKind } from "./preview-mode";

export function HistoricalPreviewActions({
  projectId,
  snapshotKind,
  snapshotId,
  locale,
}: {
  projectId: string;
  snapshotKind: SnapshotKind;
  snapshotId?: string;
  locale: Locale;
}) {
  if (snapshotKind !== "history" || !snapshotId) return null;
  const fi = locale === "fi";
  return (
    <nav
      aria-label={fi ? "Aiemman version toiminnot" : "Previous version actions"}
      className="historical-preview-actions"
    >
      <div>
        <a href={`/projects/${projectId}/history`}>
          {fi ? "Takaisin versiohistoriaan" : "Back to version history"}
        </a>
        <Link href={`/projects/${projectId}/history/${snapshotId}/restore`}>
          {fi ? "Palauta tämä versio" : "Restore this version"}
        </Link>
      </div>
      <p>
        {fi
          ? "Palautus luo uuden julkaisemattoman luonnoksen. Julkaistu verkkokauppa ei muutu."
          : "Restoring creates a new unpublished draft. Your published storefront stays unchanged."}
      </p>
    </nav>
  );
}
