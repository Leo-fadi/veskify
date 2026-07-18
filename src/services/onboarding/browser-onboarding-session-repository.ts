import {
  ONBOARDING_SCHEMA_VERSION,
  cloneOnboardingSession,
  onboardingSessionSchema,
  type OnboardingSession,
} from "@/domain/onboarding";
import {
  OnboardingStorageError,
  type OnboardingSessionLoadResult,
  type OnboardingSessionRepository,
} from "./onboarding-session-repository";

export const ONBOARDING_SESSION_STORAGE_KEY = "veskify:onboarding-session";

export type BrowserOnboardingSessionRepositoryOptions = {
  getStorage?: () => Storage | undefined;
};

function defaultStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export class BrowserOnboardingSessionRepository implements OnboardingSessionRepository {
  readonly #getStorage: () => Storage | undefined;

  constructor(options: BrowserOnboardingSessionRepositoryOptions = {}) {
    this.#getStorage = options.getStorage ?? defaultStorage;
  }

  load(): Promise<OnboardingSessionLoadResult> {
    const storage = this.#getStorage();
    if (!storage) return Promise.resolve({ status: "unavailable" });

    try {
      const stored = storage.getItem(ONBOARDING_SESSION_STORAGE_KEY);
      if (stored === null) return Promise.resolve({ status: "missing" });

      let value: unknown;
      try {
        value = JSON.parse(stored);
      } catch {
        return Promise.resolve({ status: "corrupt" });
      }

      if (
        typeof value === "object" &&
        value !== null &&
        "schemaVersion" in value &&
        value.schemaVersion !== ONBOARDING_SCHEMA_VERSION
      ) {
        return Promise.resolve({ status: "incompatible" });
      }

      const parsed = onboardingSessionSchema.safeParse(value);
      return Promise.resolve(
        parsed.success
          ? { status: "found", session: cloneOnboardingSession(parsed.data) }
          : { status: "corrupt" },
      );
    } catch {
      return Promise.resolve({ status: "unavailable" });
    }
  }

  save(session: OnboardingSession): Promise<void> {
    const storage = this.#getStorage();
    if (!storage) return Promise.reject(new OnboardingStorageError());
    try {
      const valid = cloneOnboardingSession(session);
      storage.setItem(ONBOARDING_SESSION_STORAGE_KEY, JSON.stringify(valid));
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(
        error instanceof OnboardingStorageError
          ? error
          : new OnboardingStorageError({ cause: error }),
      );
    }
  }

  clear(): Promise<void> {
    const storage = this.#getStorage();
    if (!storage) return Promise.reject(new OnboardingStorageError());
    try {
      storage.removeItem(ONBOARDING_SESSION_STORAGE_KEY);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(new OnboardingStorageError({ cause: error }));
    }
  }
}
