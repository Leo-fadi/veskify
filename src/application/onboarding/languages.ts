import { canonicalLocaleOrder, localeSchema, type Locale } from "@/domain/shared";

export type OnboardingLanguageSelection = Readonly<{
  selectedLanguages: readonly Locale[];
  primaryLanguage: Locale;
}>;

export type OnboardingLanguageValidationCode =
  | "LANGUAGE_REQUIRED"
  | "LANGUAGE_UNSUPPORTED"
  | "LANGUAGE_DUPLICATE"
  | "PRIMARY_LANGUAGE_REQUIRED"
  | "PRIMARY_LANGUAGE_UNSUPPORTED"
  | "PRIMARY_LANGUAGE_NOT_SELECTED";

export class OnboardingLanguageValidationError extends Error {
  constructor(readonly code: OnboardingLanguageValidationCode) {
    super(code);
    this.name = "OnboardingLanguageValidationError";
  }
}

export function validateOnboardingLanguageSelection(input: unknown): OnboardingLanguageSelection {
  if (!input || typeof input !== "object") {
    throw new OnboardingLanguageValidationError("LANGUAGE_REQUIRED");
  }

  const candidate = input as {
    selectedLanguages?: unknown;
    primaryLanguage?: unknown;
  };
  if (!Array.isArray(candidate.selectedLanguages) || candidate.selectedLanguages.length === 0) {
    throw new OnboardingLanguageValidationError("LANGUAGE_REQUIRED");
  }

  const selectedLanguages = candidate.selectedLanguages.map((language) => {
    const parsed = localeSchema.safeParse(language);
    if (!parsed.success) {
      throw new OnboardingLanguageValidationError("LANGUAGE_UNSUPPORTED");
    }
    return parsed.data;
  });
  if (new Set(selectedLanguages).size !== selectedLanguages.length) {
    throw new OnboardingLanguageValidationError("LANGUAGE_DUPLICATE");
  }

  if (candidate.primaryLanguage === null || candidate.primaryLanguage === undefined) {
    throw new OnboardingLanguageValidationError("PRIMARY_LANGUAGE_REQUIRED");
  }
  const primaryResult = localeSchema.safeParse(candidate.primaryLanguage);
  if (!primaryResult.success) {
    throw new OnboardingLanguageValidationError("PRIMARY_LANGUAGE_UNSUPPORTED");
  }
  if (!selectedLanguages.includes(primaryResult.data)) {
    throw new OnboardingLanguageValidationError("PRIMARY_LANGUAGE_NOT_SELECTED");
  }

  return Object.freeze({
    selectedLanguages: Object.freeze(canonicalLocaleOrder(selectedLanguages)),
    primaryLanguage: primaryResult.data,
  });
}
