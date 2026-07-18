export type OnboardingMutationTask<Result> = () => Promise<Result>;

/** Serializes all persisted onboarding mutations while allowing handled recovery to pause later work. */
export class OnboardingMutationQueue {
  #tail: Promise<void> = Promise.resolve();
  #paused = false;

  enqueue<Result>(task: OnboardingMutationTask<Result>): Promise<Result | null> {
    const run = this.#tail.then(async () => {
      if (this.#paused) return null;
      return task();
    });
    this.#tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  pause(): void {
    this.#paused = true;
  }

  resume(): void {
    this.#paused = false;
  }

  whenIdle(): Promise<void> {
    return this.#tail;
  }
}
