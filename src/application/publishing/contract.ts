import { z } from "zod";
import { idSchema, isoDateTimeSchema, localizedTextSchema } from "@/domain/shared";
import { preparedPublishCompilationSchema } from "./publish-compiler";

const pageReferenceSchema = z
  .object({
    pageId: idSchema,
    title: localizedTextSchema,
  })
  .strict();

const sectionReferenceSchema = z
  .object({
    pageId: idSchema,
    pageTitle: localizedTextSchema,
    sectionId: idSchema,
    component: z.string().trim().min(1).max(80),
  })
  .strict();

const sectionFieldChangeSchema = sectionReferenceSchema
  .extend({ changedFields: z.array(z.string().trim().min(1).max(160)).min(1) })
  .strict();

export const publishChangeSummarySchema = z
  .object({
    changedPages: z.array(pageReferenceSchema),
    pagesAdded: z.array(pageReferenceSchema),
    pagesRemoved: z.array(pageReferenceSchema),
    pageOrderChanged: z.boolean(),
    pageMetadataChanges: z.array(
      pageReferenceSchema
        .extend({
          beforeTitle: localizedTextSchema,
          afterTitle: localizedTextSchema,
          changedFields: z.array(z.enum(["type", "slug", "title", "seo"])).min(1),
        })
        .strict(),
    ),
    pageThemeOverrideChanges: z.array(pageReferenceSchema),
    sectionsAdded: z.array(sectionReferenceSchema),
    sectionsRemoved: z.array(sectionReferenceSchema),
    sectionOrderChanges: z.array(
      pageReferenceSchema
        .extend({
          beforeSectionIds: z.array(idSchema),
          afterSectionIds: z.array(idSchema),
        })
        .strict(),
    ),
    sectionComponentChanges: z.array(
      sectionReferenceSchema
        .extend({
          beforeComponent: z.string().trim().min(1).max(80),
          afterComponent: z.string().trim().min(1).max(80),
        })
        .strict(),
    ),
    sectionContentChanges: z.array(sectionFieldChangeSchema),
    sectionPropertyChanges: z.array(sectionFieldChangeSchema),
    sectionVariantChanges: z.array(
      sectionReferenceSchema
        .extend({
          beforeVariant: z.string().trim().min(1).max(80),
          afterVariant: z.string().trim().min(1).max(80),
        })
        .strict(),
    ),
    sectionVisibilityChanges: z.array(
      sectionReferenceSchema
        .extend({
          beforeVisible: z.boolean(),
          afterVisible: z.boolean(),
        })
        .strict(),
    ),
    brandSystemChanges: z.array(z.string().trim().min(1).max(160)),
    navigationChanges: z.array(z.enum(["primary", "footer"])),
    totalChangedPages: z.number().int().nonnegative(),
    totalChangedSections: z.number().int().nonnegative(),
  })
  .strict();

const preparedSnapshotExpectationSchema = z
  .object({
    id: idSchema,
    revision: z.number().int().nonnegative(),
    contentFingerprint: z.string().regex(/^v1_\d+_[0-9a-f]{64}$/),
  })
  .strict();

export const publicationAuthoritySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }).strict(),
  z
    .object({
      kind: z.literal("accepted-ai"),
      receiptId: idSchema,
      receiptFingerprint: z.string().trim().min(1).max(240),
      proposalId: idSchema,
      proposalRevision: z.number().int().nonnegative(),
      reviewRevision: z.number().int().nonnegative(),
      acceptedSnapshotId: idSchema,
      acceptedSnapshotFingerprint: z.string().trim().min(1).max(240),
    })
    .strict(),
]);

export const publicPublishPreparationSchema = z
  .object({
    preparationId: idSchema,
    projectId: idSchema,
    preparedAt: isoDateTimeSchema,
    expectedProjectRevision: z.number().int().nonnegative(),
    expectedDraft: preparedSnapshotExpectationSchema,
    expectedPublished: preparedSnapshotExpectationSchema,
    authority: publicationAuthoritySchema,
    changeSummary: publishChangeSummarySchema,
    publishPermitted: z.boolean(),
  })
  .strict();

export const publishPreparationSchema = publicPublishPreparationSchema
  .extend({
    compilation: preparedPublishCompilationSchema,
    expectedActivePublicationVersionId: idSchema.nullable(),
  })
  .strict();

export type PublishChangeSummary = z.infer<typeof publishChangeSummarySchema>;
export type PublicationAuthority = z.infer<typeof publicationAuthoritySchema>;
export type PublicPublishPreparation = z.infer<typeof publicPublishPreparationSchema>;
export type PublishPreparation = z.infer<typeof publishPreparationSchema>;

export function publicPublishPreparation(
  preparation: PublishPreparation,
): PublicPublishPreparation {
  const {
    compilation: trustedCompilation,
    expectedActivePublicationVersionId: trustedActiveVersion,
    ...publicPreparation
  } = preparation;
  void trustedCompilation;
  void trustedActiveVersion;
  return publicPublishPreparationSchema.parse(publicPreparation);
}

export class InvalidPublishPreparationError extends Error {
  readonly code = "INVALID_PUBLISH_PREPARATION";

  constructor(options?: ErrorOptions) {
    super("The publish preparation is invalid.", options);
    this.name = "InvalidPublishPreparationError";
  }
}

export class PublishPreparationValidationError extends Error {
  readonly code = "PUBLISH_PREPARATION_VALIDATION_FAILED";

  constructor(options?: ErrorOptions) {
    super("The saved storefront could not be prepared for publishing.", options);
    this.name = "PublishPreparationValidationError";
  }
}

export class NoPublishableChangesError extends Error {
  readonly code = "NO_PUBLISHABLE_CHANGES";

  constructor() {
    super("The saved draft has no storefront changes to publish.");
    this.name = "NoPublishableChangesError";
  }
}

export class StalePublishPreparationError extends Error {
  readonly code = "STALE_PUBLISH_PREPARATION";

  constructor() {
    super("The saved draft or published storefront changed after publication was prepared.");
    this.name = "StalePublishPreparationError";
  }
}

export class PublishConfirmationError extends Error {
  readonly code = "PUBLISH_CONFIRMATION_FAILED";

  constructor(options?: ErrorOptions) {
    super("The storefront could not be published.", options);
    this.name = "PublishConfirmationError";
  }
}
