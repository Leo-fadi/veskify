import { z } from "zod";
import { idSchema, isoDateTimeSchema, localeSchema } from "@/domain/shared";

export const businessProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2_000),
    audience: z.string().trim().min(1).max(500),
    market: z.string().trim().min(1).max(120),
    sourceReferences: z.array(z.string().trim().min(1).max(2_048)).max(50).default([]),
  })
  .strict();

export const projectSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(120),
    mode: z.enum(["merchant", "salesDemo"]),
    industry: z.enum(["jewellery", "fashion", "generic"]),
    primaryLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1).max(2),
    businessProfile: businessProfileSchema,
    publishedSnapshotId: idSchema,
    draftSnapshotId: idSchema,
    revision: z.number().int().nonnegative(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((project, context) => {
    if (!project.enabledLocales.includes(project.primaryLocale)) {
      context.addIssue({
        code: "custom",
        message: "The primary locale must be enabled.",
        path: ["primaryLocale"],
      });
    }

    if (new Set(project.enabledLocales).size !== project.enabledLocales.length) {
      context.addIssue({
        code: "custom",
        message: "Enabled locales must be unique.",
        path: ["enabledLocales"],
      });
    }

    if (project.publishedSnapshotId === project.draftSnapshotId) {
      context.addIssue({
        code: "custom",
        message: "Draft and published snapshots must remain separate.",
        path: ["draftSnapshotId"],
      });
    }

    if (Date.parse(project.updatedAt) < Date.parse(project.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "Updated time cannot precede created time.",
        path: ["updatedAt"],
      });
    }
  });

export type BusinessProfile = z.infer<typeof businessProfileSchema>;
export type Project = z.infer<typeof projectSchema>;
