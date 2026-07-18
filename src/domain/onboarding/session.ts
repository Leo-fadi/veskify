import { z } from "zod";
import {
  createEmptyStorefrontDesignBrief,
  storefrontDesignBriefSchema,
  updateStorefrontDesignBriefArea,
  type StorefrontCreationContextType,
  type StorefrontDesignBrief,
} from "@/domain/design-brief";
import { idSchema, isoDateTimeSchema, localeSchema } from "@/domain/shared";
import { evaluateBusinessBasics } from "./business-basics";
import { validateExistingStorefrontSource } from "./existing-sources";
import { getOnboardingStep } from "./steps";

export const ONBOARDING_SCHEMA_VERSION = 2 as const;
export const PREVIOUS_ONBOARDING_SCHEMA_VERSION = 1 as const;

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

export type OnboardingStepId = z.infer<typeof onboardingStepIdSchema>;
export type OnboardingCreationPath = z.infer<typeof onboardingCreationPathSchema>;

export function creationPathToBriefContext(
  creationPath: OnboardingCreationPath | null,
): StorefrontCreationContextType | null {
  if (creationPath === "new-storefront") return "new-storefront";
  if (creationPath === "redesign-existing-storefront") return "redesign-existing-storefront";
  if (creationPath === "demo-preset") return "demo-storefront";
  return null;
}

const uniqueStepIds = (values: readonly string[]) => new Set(values).size === values.length;

const sessionWorkflowShape = {
  id: idSchema,
  creationPath: onboardingCreationPathSchema.nullable(),
  activeStepId: onboardingStepIdSchema,
  completedStepIds: z.array(onboardingStepIdSchema),
  skippedStepIds: z.array(onboardingStepIdSchema),
  selectedLanguages: z.array(localeSchema).min(1).max(2),
  primaryLanguage: localeSchema,
  status: onboardingSessionStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
} as const;

type SessionWorkflowFields = {
  creationPath: OnboardingCreationPath | null;
  activeStepId: OnboardingStepId;
  completedStepIds: OnboardingStepId[];
  skippedStepIds: OnboardingStepId[];
  selectedLanguages: string[];
  primaryLanguage: string;
  status: "active" | "completed";
};

type RefinementContext = {
  addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void;
};

function validateWorkflowInvariants(
  session: SessionWorkflowFields,
  context: RefinementContext,
): void {
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
}

const legacyOnboardingSessionSchema = z
  .object({ schemaVersion: z.literal(PREVIOUS_ONBOARDING_SCHEMA_VERSION), ...sessionWorkflowShape })
  .strict()
  .superRefine(validateWorkflowInvariants);

export const onboardingSessionSchema = z
  .object({
    schemaVersion: z.literal(ONBOARDING_SCHEMA_VERSION),
    ...sessionWorkflowShape,
    designBrief: storefrontDesignBriefSchema,
  })
  .strict()
  .superRefine((session, context) => {
    validateWorkflowInvariants(session, context);

    if (session.designBrief.status !== "collecting") {
      context.addIssue({
        code: "custom",
        path: ["designBrief", "status"],
        message: "An onboarding session must own a collecting design brief.",
      });
    }

    const expectedContext = creationPathToBriefContext(session.creationPath);
    if (session.designBrief.creationContext.type !== expectedContext) {
      context.addIssue({
        code: "custom",
        path: ["designBrief", "creationContext", "type"],
        message: "The creation path and design-brief context must agree.",
      });
    }
    if (Date.parse(session.designBrief.createdAt) !== Date.parse(session.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["designBrief", "createdAt"],
        message: "The design brief must preserve the onboarding creation timestamp.",
      });
    }
    if (Date.parse(session.designBrief.updatedAt) > Date.parse(session.updatedAt)) {
      context.addIssue({
        code: "custom",
        path: ["designBrief", "updatedAt"],
        message: "The session timestamp must not precede its design brief.",
      });
    }
    if (session.completedStepIds.includes("business-basics")) {
      const evaluation = evaluateBusinessBasics(session.designBrief);
      if (!evaluation.complete) {
        context.addIssue({
          code: "custom",
          path: ["completedStepIds"],
          message: "A completed business-basics step requires all required business information.",
        });
      }
    }

    const existingSourcesCompleted = session.completedStepIds.includes("existing-sources");
    const existingSourcesSkipped = session.skippedStepIds.includes("existing-sources");
    const existingStorefrontUrl = session.designBrief.creationContext.existingStorefrontUrl;
    const isRedesign = session.designBrief.creationContext.type === "redesign-existing-storefront";

    if (!isRedesign && existingStorefrontUrl !== null) {
      context.addIssue({
        code: "custom",
        path: ["designBrief", "creationContext", "existingStorefrontUrl"],
        message: "An existing storefront URL is only valid for a redesign path.",
      });
    }

    if (existingSourcesCompleted && isRedesign) {
      const validation = existingStorefrontUrl
        ? validateExistingStorefrontSource(existingStorefrontUrl)
        : null;
      if (!validation?.valid || validation.normalizedUrl !== existingStorefrontUrl) {
        context.addIssue({
          code: "custom",
          path: ["completedStepIds"],
          message: "A completed redesign existing-sources step requires a normalized HTTPS URL.",
        });
      }
    }

    if (existingSourcesSkipped && isRedesign && existingStorefrontUrl !== null) {
      context.addIssue({
        code: "custom",
        path: ["designBrief", "creationContext", "existingStorefrontUrl"],
        message: "A skipped redesign existing-sources step must not retain a URL.",
      });
    }
  });

export type OnboardingSession = z.infer<typeof onboardingSessionSchema>;
export type LegacyOnboardingSession = z.infer<typeof legacyOnboardingSessionSchema>;

export function onboardingBriefIdForSession(sessionId: string): string {
  return `${sessionId}_brief`.slice(0, 80);
}

function latestTimestamp(...timestamps: readonly string[]): string {
  return new Date(Math.max(...timestamps.map((timestamp) => Date.parse(timestamp)))).toISOString();
}

function migrationStepState(legacy: LegacyOnboardingSession, brief: StorefrontDesignBrief) {
  const businessComplete = evaluateBusinessBasics(brief).complete;
  const businessPosition = onboardingStepIds.indexOf("business-basics");
  if (businessComplete || !legacy.completedStepIds.includes("business-basics")) {
    return {
      activeStepId: legacy.activeStepId,
      completedStepIds: [...legacy.completedStepIds],
      skippedStepIds: [...legacy.skippedStepIds],
      status: legacy.status,
    } as const;
  }

  return {
    activeStepId: "business-basics" as const,
    completedStepIds: legacy.completedStepIds.filter(
      (stepId) => onboardingStepIds.indexOf(stepId) < businessPosition,
    ),
    skippedStepIds: legacy.skippedStepIds.filter(
      (stepId) => onboardingStepIds.indexOf(stepId) < businessPosition,
    ),
    status: "active" as const,
  };
}

/** Migrates the immediately previous P3-01 session format without inventing merchant data. */
export function migrateOnboardingSession(input: unknown): OnboardingSession {
  if (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    input.schemaVersion === ONBOARDING_SCHEMA_VERSION
  ) {
    return onboardingSessionSchema.parse(input);
  }

  const legacy = legacyOnboardingSessionSchema.parse(input);
  let brief = createEmptyStorefrontDesignBrief({
    id: onboardingBriefIdForSession(legacy.id),
    now: legacy.createdAt,
  });
  if (legacy.creationPath !== null) {
    brief = updateStorefrontDesignBriefArea(
      brief,
      "creationContext",
      { type: creationPathToBriefContext(legacy.creationPath) },
      legacy.updatedAt,
    );
  }
  const stepState = migrationStepState(legacy, brief);
  const updatedAt = latestTimestamp(legacy.updatedAt, brief.updatedAt);

  return onboardingSessionSchema.parse({
    ...legacy,
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    ...stepState,
    updatedAt,
    designBrief: brief,
  });
}

export function cloneOnboardingSession(session: OnboardingSession): OnboardingSession {
  return onboardingSessionSchema.parse(structuredClone(session));
}
