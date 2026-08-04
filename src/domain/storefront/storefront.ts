import { z } from "zod";
import { brandSystemSchema } from "@/domain/design-system";
import {
  idSchema,
  isoDateTimeSchema,
  localizedSeoSchema,
  localizedTextSchema,
  safeExternalUrlSchema,
} from "@/domain/shared";
import {
  approvedAssetPlacementOperationSchema,
  approvedAssetPresentationSchema,
} from "./approved-asset-placement";

const recordSchema = z.record(z.string(), z.unknown());
const componentTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][A-Za-z0-9]*$/, "Use a lower-camel-case component or variant token.");

export const allowedSectionOverridesSchema = z
  .object({
    alignment: z.enum(["left", "center", "right"]).optional(),
    spacing: z.enum(["compact", "standard", "spacious"]).optional(),
    contentWidth: z.enum(["narrow", "standard", "wide"]).optional(),
    surface: z.enum(["default", "surface", "primary", "secondary", "accent"]).optional(),
  })
  .strict();

const sectionInstanceInputSchema = z
  .object({
    id: idSchema,
    component: componentTokenSchema,
    variant: componentTokenSchema,
    visible: z.boolean(),
    content: recordSchema,
    props: recordSchema,
    styleOverrides: allowedSectionOverridesSchema.optional(),
    // Older snapshots predate approved source asset transport. Normalizing to
    // an explicit empty list keeps their serialized and fingerprinted shape
    // deterministic without assigning them new asset authority.
    approvedAssetPlacements: z.array(approvedAssetPlacementOperationSchema).optional(),
    approvedAssetPresentations: z.array(approvedAssetPresentationSchema).optional(),
  })
  .strict();

export const sectionInstanceSchema = sectionInstanceInputSchema.transform(
  (section): z.output<typeof sectionInstanceInputSchema> => ({
    ...section,
    approvedAssetPlacements: section.approvedAssetPlacements ?? [],
    approvedAssetPresentations: section.approvedAssetPresentations ?? [],
  }),
);

export const pageTypeSchema = z.enum([
  "home",
  "collection",
  "product",
  "content",
  "cart",
  "checkout",
  "landing",
]);

export const pageModelSchema = z
  .object({
    id: idSchema,
    type: pageTypeSchema,
    slug: z
      .string()
      .trim()
      .regex(/^\/$|^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/),
    title: localizedTextSchema,
    seo: localizedSeoSchema,
    themeOverride: brandSystemSchema.partial().optional(),
    sections: z.array(sectionInstanceSchema),
  })
  .strict()
  .superRefine((page, context) => {
    const sectionIds = page.sections.map((section) => section.id);
    if (new Set(sectionIds).size !== sectionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Section IDs must be unique within a page.",
        path: ["sections"],
      });
    }
    for (const component of ["header", "footer"] as const) {
      if (page.sections.filter((section) => section.component === component).length > 1) {
        context.addIssue({
          code: "custom",
          message: `A page must not contain more than one ${component}.`,
          path: ["sections"],
        });
      }
    }
    page.sections.forEach((section, sectionIndex) => {
      const placementSlots = new Set<string>();
      (section.approvedAssetPlacements ?? []).forEach((placement, placementIndex) => {
        if (placement.pageId !== page.id) {
          context.addIssue({
            code: "custom",
            path: ["sections", sectionIndex, "approvedAssetPlacements", placementIndex, "pageId"],
            message: "Approved asset placements must belong to their containing page.",
          });
        }
        if (placement.componentId !== section.id || placement.componentType !== section.component) {
          context.addIssue({
            code: "custom",
            path: ["sections", sectionIndex, "approvedAssetPlacements", placementIndex],
            message: "Approved asset placements must target their containing component.",
          });
        }
        if (placementSlots.has(placement.assetSlotId)) {
          context.addIssue({
            code: "custom",
            path: [
              "sections",
              sectionIndex,
              "approvedAssetPlacements",
              placementIndex,
              "assetSlotId",
            ],
            message: "A component cannot contain duplicate approved asset placements for one slot.",
          });
        }
        placementSlots.add(placement.assetSlotId);
      });
      (section.approvedAssetPresentations ?? []).forEach((presentation, presentationIndex) => {
        const placement = (section.approvedAssetPlacements ?? []).find(
          (candidate) => candidate.assetId === presentation.assetId,
        );
        if (
          !placement ||
          placement.role !== presentation.role ||
          placement.assetRevision !== presentation.revision ||
          placement.materialFingerprint !== presentation.materialFingerprint
        ) {
          context.addIssue({
            code: "custom",
            path: ["sections", sectionIndex, "approvedAssetPresentations", presentationIndex],
            message: "Approved asset presentations must match a containing approved placement.",
          });
        }
      });
    });
  });

const internalNavigationTargetSchema = z
  .object({ type: z.literal("page"), pageId: idSchema })
  .strict();
const externalNavigationTargetSchema = z
  .object({ type: z.literal("external"), url: safeExternalUrlSchema })
  .strict();

export const navigationItemSchema = z
  .object({
    id: idSchema,
    label: localizedTextSchema,
    target: z.discriminatedUnion("type", [
      internalNavigationTargetSchema,
      externalNavigationTargetSchema,
    ]),
  })
  .strict();

export const navigationModelSchema = z
  .object({
    primary: z.array(navigationItemSchema).max(12),
    footer: z.array(navigationItemSchema).max(30),
  })
  .strict()
  .superRefine((navigation, context) => {
    const itemIds = [...navigation.primary, ...navigation.footer].map((item) => item.id);
    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: "custom",
        message: "Navigation item IDs must be unique.",
        path: [],
      });
    }
  });

export const storefrontSnapshotSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    revision: z.number().int().nonnegative(),
    brandSystem: brandSystemSchema,
    navigation: navigationModelSchema,
    pages: z.array(pageModelSchema).min(1),
    catalogueRef: idSchema,
    createdAt: isoDateTimeSchema,
    createdBy: z.enum(["user", "agent", "system"]),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const pageIds = snapshot.pages.map((page) => page.id);
    if (new Set(pageIds).size !== pageIds.length) {
      context.addIssue({
        code: "custom",
        message: "Page IDs must be unique within a snapshot.",
        path: ["pages"],
      });
    }

    const sectionIds = snapshot.pages.flatMap((page) => page.sections.map((section) => section.id));
    if (new Set(sectionIds).size !== sectionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Section IDs must be unique within a snapshot.",
        path: ["pages"],
      });
    }

    const knownPageIds = new Set(pageIds);
    for (const [area, items] of Object.entries(snapshot.navigation)) {
      items.forEach((item, index) => {
        if (item.target.type === "page" && !knownPageIds.has(item.target.pageId)) {
          context.addIssue({
            code: "custom",
            message: "Navigation targets must resolve to a page in this snapshot.",
            path: ["navigation", area, index, "target", "pageId"],
          });
        }
      });
    }
  });

export type AllowedSectionOverrides = z.infer<typeof allowedSectionOverridesSchema>;
export type SectionInstance = z.infer<typeof sectionInstanceSchema>;
export type PageType = z.infer<typeof pageTypeSchema>;
export type PageModel = z.infer<typeof pageModelSchema>;
export type NavigationItem = z.infer<typeof navigationItemSchema>;
export type NavigationModel = z.infer<typeof navigationModelSchema>;
export type StorefrontSnapshot = z.infer<typeof storefrontSnapshotSchema>;
