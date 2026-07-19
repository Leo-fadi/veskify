import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizardSource = readFileSync(
  resolve(process.cwd(), "src/app/projects/new/onboarding-wizard.tsx"),
  "utf8",
);

describe("Vesko onboarding shell boundary", () => {
  it("reuses the onboarding service and mutation queue without a second persistence path", () => {
    expect(wizardSource).toContain("new OnboardingMutationQueue()");
    expect(wizardSource).toContain("service.persistSession(currentSession)");
    expect(wizardSource).not.toContain("repository.save(");
    expect(wizardSource).not.toContain("localStorage");
    expect(wizardSource).not.toContain("ONBOARDING_SESSION_STORAGE_KEY");
  });
});
