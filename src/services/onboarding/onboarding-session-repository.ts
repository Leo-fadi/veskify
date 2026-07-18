import type { OnboardingSession } from "@/domain/onboarding";

export type OnboardingSessionLoadResult =
  | { status: "missing" }
  | { status: "found"; session: OnboardingSession }
  | { status: "corrupt" }
  | { status: "incompatible" }
  | { status: "unavailable" };

export interface OnboardingSessionRepository {
  load(): Promise<OnboardingSessionLoadResult>;
  save(session: OnboardingSession): Promise<void>;
  clear(): Promise<void>;
}

export class OnboardingStorageError extends Error {
  readonly code = "ONBOARDING_STORAGE_UNAVAILABLE";

  constructor(options?: ErrorOptions) {
    super("Onboarding storage is unavailable.", options);
    this.name = "OnboardingStorageError";
  }
}
