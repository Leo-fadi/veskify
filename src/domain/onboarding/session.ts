import { z } from "zod";
import { idSchema, isoDateTimeSchema, localeSchema } from "@/domain/shared";
import { getOnboardingStep } from "./steps";

export const ONBOARDING_SCHEMA_VERSION = 1 as const;

export const onboardingStepIds = [
  "creation-path",
  "business-basics",
  "existing-sources",
  "brand-assets",
  "visual-direction",
  "catalogue",
  "pages",
  "languages",
  "review-plan",
] as const;

export const onboardingStepIdSchema = z.enum(onboardingStepIds);
export const onboardingCreationPathSchema = z.enum([
  "new-storefront",
  "redesign-existing-storefront",
  "demo-preset",
]);
export const onboardingSessionStatusSchema = z.enum(["active", "completed"]);

const uniqueStepIds = (values: readonly string[]) => new Set(values).size === values.length;

export const onboardingSessionSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.literal(ONBOARDING_SCHEMA_VERSION),
    creationPath: onboardingCreationPathSchema.nullable(),
    activeStepId: onboardingStepIdSchema,
    completedStepIds: z.array(onboardingStepIdSchema),
    skippedStepIds: z.array(onboardingStepIdSchema),
    selectedLanguages: z.array(localeSchema).min(1).max(2),
    primaryLanguage: localeSchema,
    status: onboardingSessionStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((session, context) => {
    if (!uniqueStepIds(session.completedStepIds)) {
      context.addIssue({
        code: "custom",
        path: ["completedStepIds"],
        message: "Completed steps must be unique.",
      });
    }
    if (!uniqueStepIds(session.skippedStepIds)) {
      context.addIssue({
        code: "custom",
        path: ["skippedStepIds"],
        message: "Skipped steps must be unique.",
      });
    }
    if (session.completedStepIds.some((stepId) => session.skippedStepIds.includes(stepId))) {
      context.addIssue({
        code: "custom",
        path: ["skippedStepIds"],
        message: "A step cannot be both completed and skipped.",
      });
    }
    if (session.skippedStepIds.some((stepId) => !getOnboardingStep(stepId).optional)) {
      context.addIssue({
        code: "custom",
        path: ["skippedStepIds"],
        message: "Required steps cannot be skipped.",
      });
    }
    if (new Set(session.selectedLanguages).size !== session.selectedLanguages.length) {
      context.addIssue({
        code: "custom",
        path: ["selectedLanguages"],
        message: "Selected languages must be unique.",
      });
    }
    if (!session.selectedLanguages.includes(session.primaryLanguage)) {
      context.addIssue({
        code: "custom",
        path: ["primaryLanguage"],
        message: "The primary language must be selected.",
      });
    }
    if (Date.parse(session.updatedAt) < Date.parse(session.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "The updated timestamp cannot precede creation.",
      });
    }

    const activePosition = onboardingStepIds.indexOf(session.activeStepId);
    const resolved = new Set([...session.completedStepIds, ...session.skippedStepIds]);
    const unresolvedEarlierStep = onboardingStepIds
      .slice(0, activePosition)
      .find((stepId) => !resolved.has(stepId));
    if (unresolvedEarlierStep) {
      context.addIssue({
        code: "custom",
        path: ["activeStepId"],
        message: "The active step cannot jump over an unresolved step.",
      });
    }

    if (session.completedStepIds.includes("creation-path") && session.creationPath === null) {
      context.addIssue({
        code: "custom",
        path: ["creationPath"],
        message: "A completed creation-path step requires a selected path.",
      });
    }
    if (session.status === "completed") {
      const unresolvedStep = onboardingStepIds.find((stepId) => !resolved.has(stepId));
      if (unresolvedStep || session.activeStepId !== "review-plan") {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message: "A completed session must resolve every step and finish on review.",
        });
      }
    }
  });

export type OnboardingStepId = z.infer<typeof onboardingStepIdSchema>;
export type OnboardingCreationPath = z.infer<typeof onboardingCreationPathSchema>;
export type OnboardingSession = z.infer<typeof onboardingSessionSchema>;

export function cloneOnboardingSession(session: OnboardingSession): OnboardingSession {
  return structuredClone(onboardingSessionSchema.parse(session));
}
