import { z } from "zod";
import { idSchema, localizedTextSchema } from "@/domain/shared";
import { canonicalValueFingerprint } from "./canonical-storefront";
import { pageFactEvidenceReferenceSchema } from "./page-fact-evidence";

export const contentSupportPageFamilyIds = [
  "about",
  "contact",
  "store-locations",
  "faq",
  "shipping-information",
  "returns-information",
  "policy-legal",
  "campaign-editorial",
  "generic-content",
] as const;

export const contentSupportPageFamilyIdSchema = z.enum(contentSupportPageFamilyIds);
export type ContentSupportPageFamilyId = z.infer<typeof contentSupportPageFamilyIdSchema>;

const factBlockIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][A-Za-z0-9]*(?:[._-][a-z][A-Za-z0-9]*)*$/);

const optionalLocalizedTextSchema = localizedTextSchema.optional();

export const contentSupportFactBlockSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("paragraph"),
      id: factBlockIdSchema,
      heading: optionalLocalizedTextSchema,
      body: localizedTextSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("contact-channel"),
      id: factBlockIdSchema,
      channel: z.enum(["email", "phone", "contact-form"]),
      label: localizedTextSchema,
      value: z.string().trim().min(1).max(240),
    })
    .strict()
    .superRefine((block, context) => {
      if (block.channel === "email" && !z.string().email().safeParse(block.value).success) {
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "Approved email contact facts must contain a valid email address.",
        });
      }
      if (block.channel === "phone" && !/^\+?[0-9][0-9 .()/-]{3,39}$/.test(block.value)) {
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "Approved phone contact facts must contain a bounded phone number.",
        });
      }
    }),
  z
    .object({
      kind: z.literal("location"),
      id: factBlockIdSchema,
      name: localizedTextSchema,
      addressLines: z.array(localizedTextSchema).min(1).max(6),
      openingHours: z.array(localizedTextSchema).max(7).default([]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("faq"),
      id: factBlockIdSchema,
      question: localizedTextSchema,
      answer: localizedTextSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("policy-section"),
      id: factBlockIdSchema,
      heading: localizedTextSchema,
      body: localizedTextSchema,
    })
    .strict(),
]);

export const contentSupportStorySchema = z
  .object({
    eyebrow: optionalLocalizedTextSchema,
    heading: localizedTextSchema,
    body: localizedTextSchema,
    steps: z
      .array(
        z
          .object({
            id: factBlockIdSchema,
            title: localizedTextSchema,
            description: localizedTextSchema,
          })
          .strict(),
      )
      .max(4)
      .default([]),
  })
  .strict()
  .superRefine((story, context) => {
    if (new Set(story.steps.map((step) => step.id)).size !== story.steps.length) {
      context.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Approved story step identifiers must be unique.",
      });
    }
  });

export const contentSupportCampaignSchema = z
  .object({
    eyebrow: optionalLocalizedTextSchema,
    heading: localizedTextSchema,
    description: localizedTextSchema,
    actionLabel: localizedTextSchema.optional(),
  })
  .strict();

const contentSupportFactPayloadBaseSchema = z
  .object({
    title: localizedTextSchema,
    introduction: optionalLocalizedTextSchema,
    blocks: z.array(contentSupportFactBlockSchema).max(16).default([]),
    story: contentSupportStorySchema.optional(),
    campaign: contentSupportCampaignSchema.optional(),
  })
  .strict();

export const contentSupportFactPayloadSchema = z
  .discriminatedUnion("familyId", [
    contentSupportFactPayloadBaseSchema.extend({ familyId: z.literal("about") }),
    contentSupportFactPayloadBaseSchema.extend({ familyId: z.literal("contact") }),
    contentSupportFactPayloadBaseSchema.extend({ familyId: z.literal("store-locations") }),
    contentSupportFactPayloadBaseSchema.extend({ familyId: z.literal("faq") }),
    contentSupportFactPayloadBaseSchema.extend({ familyId: z.literal("shipping-information") }),
    contentSupportFactPayloadBaseSchema.extend({ familyId: z.literal("returns-information") }),
    contentSupportFactPayloadBaseSchema.extend({ familyId: z.literal("policy-legal") }),
    contentSupportFactPayloadBaseSchema.extend({ familyId: z.literal("campaign-editorial") }),
    contentSupportFactPayloadBaseSchema.extend({ familyId: z.literal("generic-content") }),
  ])
  .superRefine((payload, context) => {
    const blocks = payload.blocks;
    const kinds = new Set(blocks.map((block) => block.kind));
    if (new Set(blocks.map((block) => block.id)).size !== blocks.length) {
      context.addIssue({
        code: "custom",
        path: ["blocks"],
        message: "Approved support-fact block identifiers must be unique.",
      });
    }
    const requireOnly = (allowed: readonly ContentSupportFactBlockKind[]) => {
      if (blocks.some((block) => !allowed.includes(block.kind))) {
        context.addIssue({
          code: "custom",
          path: ["blocks"],
          message: "The support-fact payload contains a block incompatible with its page family.",
        });
      }
    };
    switch (payload.familyId) {
      case "about":
        requireOnly(["paragraph"]);
        if (!payload.story) {
          context.addIssue({
            code: "custom",
            path: ["story"],
            message: "About facts require a story.",
          });
        }
        break;
      case "contact":
        requireOnly(["contact-channel", "paragraph"]);
        if (!kinds.has("contact-channel")) {
          context.addIssue({
            code: "custom",
            path: ["blocks"],
            message: "Contact facts require at least one approved contact channel.",
          });
        }
        break;
      case "store-locations":
        requireOnly(["location"]);
        if (!kinds.has("location")) {
          context.addIssue({
            code: "custom",
            path: ["blocks"],
            message: "Store-location facts require at least one approved location.",
          });
        }
        break;
      case "faq":
        requireOnly(["faq"]);
        if (!kinds.has("faq")) {
          context.addIssue({
            code: "custom",
            path: ["blocks"],
            message: "FAQ facts require questions.",
          });
        }
        break;
      case "shipping-information":
      case "returns-information":
      case "policy-legal":
        requireOnly(["policy-section"]);
        if (!kinds.has("policy-section")) {
          context.addIssue({
            code: "custom",
            path: ["blocks"],
            message: "Service and policy facts require approved sections.",
          });
        }
        break;
      case "campaign-editorial":
        requireOnly(["paragraph"]);
        if (!payload.campaign) {
          context.addIssue({
            code: "custom",
            path: ["campaign"],
            message: "Campaign facts require approved campaign copy.",
          });
        }
        break;
      case "generic-content":
        requireOnly(["paragraph"]);
        if (!payload.story && blocks.length === 0) {
          context.addIssue({
            code: "custom",
            path: ["blocks"],
            message: "Generic content requires approved bounded content.",
          });
        }
        break;
    }
  });

export type ContentSupportFactPayload = z.infer<typeof contentSupportFactPayloadSchema>;
export type ContentSupportFactBlock = z.infer<typeof contentSupportFactBlockSchema>;
export type ContentSupportFactBlockKind = ContentSupportFactBlock["kind"];
export type ContentSupportStory = z.infer<typeof contentSupportStorySchema>;
export type ContentSupportCampaign = z.infer<typeof contentSupportCampaignSchema>;

const contentSupportFactFingerprintSchema = z
  .string()
  .trim()
  .regex(/^content-support-facts-v1_[a-zA-Z0-9_-]+$/);

export const contentSupportFactDocumentSchema = z
  .object({
    id: idSchema,
    evidence: pageFactEvidenceReferenceSchema,
    payload: contentSupportFactPayloadSchema,
    fingerprint: contentSupportFactFingerprintSchema,
  })
  .strict()
  .superRefine((document, context) => {
    if (document.id !== document.evidence.authorityId) {
      context.addIssue({
        code: "custom",
        path: ["id"],
        message: "A support-fact document must retain its evidence authority identity.",
      });
    }
    const expected = createContentSupportFactFingerprint({
      id: document.id,
      evidence: document.evidence,
      payload: document.payload,
    });
    if (document.fingerprint !== expected) {
      context.addIssue({
        code: "custom",
        path: ["fingerprint"],
        message: "The support-fact document fingerprint is stale.",
      });
    }
  });

export type ContentSupportFactDocument = z.infer<typeof contentSupportFactDocumentSchema>;

export function createContentSupportFactFingerprint(
  input: Readonly<{
    id: string;
    evidence: z.input<typeof pageFactEvidenceReferenceSchema>;
    payload: ContentSupportFactPayload;
  }>,
): string {
  return `content-support-facts-v1_${canonicalValueFingerprint({
    id: input.id,
    evidence: pageFactEvidenceReferenceSchema.parse(input.evidence),
    payload: contentSupportFactPayloadSchema.parse(input.payload),
  })}`;
}

export function createContentSupportFactDocument(
  input: Readonly<{
    evidence: z.input<typeof pageFactEvidenceReferenceSchema>;
    payload: ContentSupportFactPayload;
  }>,
): ContentSupportFactDocument {
  const evidence = pageFactEvidenceReferenceSchema.parse(input.evidence);
  const payload = contentSupportFactPayloadSchema.parse(input.payload);
  return contentSupportFactDocumentSchema.parse({
    id: evidence.authorityId,
    evidence,
    payload,
    fingerprint: createContentSupportFactFingerprint({
      id: evidence.authorityId,
      evidence,
      payload,
    }),
  });
}
