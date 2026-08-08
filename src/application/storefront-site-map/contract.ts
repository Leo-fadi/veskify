import { z } from "zod";
import { idSchema, localeSchema, localizedSeoSchema, localizedTextSchema } from "@/domain/shared";
import {
  pageFactEvidenceReferenceSchema,
  pageFamilyCommerceContextSchema,
  pageFamilyIdSchema,
} from "@/domain/storefront";

export const STOREFRONT_SITE_MAP_DECISION_VERSION = 1 as const;

export const siteMapNavigationPlacementSchema = z
  .object({
    area: z.enum(["primary", "footer"]),
    order: z.number().int().nonnegative(),
    label: localizedTextSchema,
  })
  .strict();

export const siteMapPageDecisionSchema = z
  .object({
    key: idSchema,
    familyId: pageFamilyIdSchema,
    familyVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    route: z.string().trim().min(1).max(200),
    required: z.boolean(),
    profile: z
      .object({
        id: z.string().trim().min(1).max(160),
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
      })
      .strict(),
    localeCoverage: z.array(localeSchema).min(1),
    title: localizedTextSchema,
    seo: localizedSeoSchema,
    commerceContext: pageFamilyCommerceContextSchema,
    navigation: z.array(siteMapNavigationPlacementSchema).max(2),
    parentKey: idSchema.optional(),
    existingPageId: idSchema.optional(),
    evidenceReferences: z.array(pageFactEvidenceReferenceSchema),
  })
  .strict()
  .superRefine((page, context) => {
    const areas = page.navigation.map(({ area }) => area);
    if (new Set(areas).size !== areas.length) {
      context.addIssue({
        code: "custom",
        path: ["navigation"],
        message: "A page can appear at most once in each navigation area.",
      });
    }
    if (new Set(page.localeCoverage).size !== page.localeCoverage.length) {
      context.addIssue({
        code: "custom",
        path: ["localeCoverage"],
        message: "Page locale coverage must be unique.",
      });
    }
  });

export const storefrontSiteMapDecisionSchema = z
  .object({
    schemaVersion: z.literal(STOREFRONT_SITE_MAP_DECISION_VERSION),
    projectId: idSchema,
    localeCoverage: z.array(localeSchema).min(1),
    sharedFrame: z
      .object({
        id: z.string().trim().min(1).max(160),
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
      })
      .strict(),
    pages: z.array(siteMapPageDecisionSchema).min(1),
  })
  .strict()
  .superRefine((decision, context) => {
    const keys = decision.pages.map(({ key }) => key);
    const routes = decision.pages.map(({ route }) => route);
    const existingPageIds = decision.pages.flatMap(({ existingPageId }) =>
      existingPageId ? [existingPageId] : [],
    );
    for (const [values, path, message] of [
      [keys, ["pages"], "Site-map page keys must be unique."],
      [routes, ["pages"], "Site-map routes must be unique."],
      [existingPageIds, ["pages"], "Existing page references must be unique."],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", path: [...path], message });
      }
    }
    if (new Set(decision.localeCoverage).size !== decision.localeCoverage.length) {
      context.addIssue({
        code: "custom",
        path: ["localeCoverage"],
        message: "Site-map locale coverage must be unique.",
      });
    }
  });

export type SiteMapPageDecision = z.infer<typeof siteMapPageDecisionSchema>;
export type StorefrontSiteMapDecision = z.infer<typeof storefrontSiteMapDecisionSchema>;
export type SiteMapNavigationPlacement = z.infer<typeof siteMapNavigationPlacementSchema>;
