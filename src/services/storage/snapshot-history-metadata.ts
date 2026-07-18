import { z } from "zod";
import { idSchema, localizedTextSchema } from "@/domain/shared";

export const snapshotHistoryReasonSchema = z.enum([
  "published",
  "publishedDraftSynchronized",
  "restored",
]);

export const snapshotHistoryMetadataSchema = z
  .object({
    snapshotId: idSchema,
    projectId: idSchema,
    reason: snapshotHistoryReasonSchema,
    summary: localizedTextSchema,
  })
  .strict();

export type SnapshotHistoryReason = z.infer<typeof snapshotHistoryReasonSchema>;
export type SnapshotHistoryMetadata = z.infer<typeof snapshotHistoryMetadataSchema>;

export function publishHistoryMetadata(
  projectId: string,
  publishedSnapshotId: string,
  synchronizedDraftSnapshotId: string,
): SnapshotHistoryMetadata[] {
  return [
    snapshotHistoryMetadataSchema.parse({
      snapshotId: publishedSnapshotId,
      projectId,
      reason: "published",
      summary: {
        en: "Saved storefront changes were published.",
        fi: "Tallennetut verkkokaupan muutokset julkaistiin.",
      },
    }),
    snapshotHistoryMetadataSchema.parse({
      snapshotId: synchronizedDraftSnapshotId,
      projectId,
      reason: "publishedDraftSynchronized",
      summary: {
        en: "The saved draft was synchronized with the published storefront.",
        fi: "Tallennettu luonnos synkronoitiin julkaistun verkkokaupan kanssa.",
      },
    }),
  ];
}

export function restoreHistoryMetadata(
  projectId: string,
  restoredSnapshotId: string,
): SnapshotHistoryMetadata {
  return snapshotHistoryMetadataSchema.parse({
    snapshotId: restoredSnapshotId,
    projectId,
    reason: "restored",
    summary: {
      en: "A previous storefront version was restored as a new saved draft.",
      fi: "Verkkokaupan aiempi versio palautettiin uudeksi tallennetuksi luonnokseksi.",
    },
  });
}
