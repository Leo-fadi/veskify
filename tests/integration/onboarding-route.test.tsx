import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "@/app/projects/new/onboarding-wizard";
import { ONBOARDING_SESSION_STORAGE_KEY } from "@/services/onboarding";

describe("guided onboarding route", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("exits loading when the first save fails and can retry after storage recovers", async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Write blocked", "SecurityError");
    });

    render(<OnboardingWizard />);

    expect(
      await screen.findByRole("heading", {
        name: "We cannot access saved onboarding progress",
      }),
    ).toBeVisible();
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry).toBeEnabled();

    setItem.mockRestore();
    await user.click(retry);
    expect(
      await screen.findByRole("heading", { name: "How would you like to begin?" }),
    ).toBeVisible();
  });

  it("selects and persists the real creation path, then continues and goes back", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);

    expect(
      await screen.findByRole("heading", { name: "How would you like to begin?" }),
    ).toBeVisible();
    await user.click(screen.getByRole("radio", { name: /Redesign an existing storefront/i }));
    expect(screen.getByRole("radio", { name: /Redesign an existing storefront/i })).toBeChecked();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      creationPath: "redesign-existing-storefront",
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Business basics" })).toBeVisible();
    expect(screen.getByText(/Nothing is saved for this step yet/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("heading", { name: "How would you like to begin?" }),
    ).toBeVisible();
    expect(screen.getByRole("radio", { name: /Redesign an existing storefront/i })).toBeChecked();
  });

  it("switches EN/FI without losing progress", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Use a demo preset/i }));
    await user.click(screen.getByRole("radio", { name: "Suomi" }));

    expect(await screen.findByRole("heading", { name: "Miten haluat aloittaa?" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Käytä demopohjaa/i })).toBeChecked();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      creationPath: "demo-preset",
    });
  });

  it("offers safe recovery for corrupt storage and reset confirmation", async () => {
    const user = userEvent.setup();
    localStorage.setItem(ONBOARDING_SESSION_STORAGE_KEY, "broken");
    render(<OnboardingWizard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/damaged/i);
    await user.click(screen.getByRole("button", { name: "Discard and restart" }));
    expect(screen.getByRole("dialog", { name: "Restart onboarding?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Yes, start over" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "How would you like to begin?" })).toBeVisible(),
    );
  });
});
