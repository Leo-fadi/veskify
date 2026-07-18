import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      designBrief: { creationContext: { type: "redesign-existing-storefront" } },
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Business basics" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Business name" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/highlighted fields/i);
    expect(screen.getByRole("textbox", { name: "Business name" })).toHaveFocus();

    await user.type(screen.getByRole("textbox", { name: "Business name" }), "Aurum Nordic");
    await user.type(
      screen.getByRole("textbox", { name: "Short business description" }),
      "A Helsinki jewellery studio.",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Industry" }), "jewellery");
    await user.type(
      screen.getByRole("textbox", { name: "Target customer" }),
      "Customers looking for Nordic jewellery.",
    );
    await user.type(screen.getByRole("textbox", { name: "Primary market" }), "Finland");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Existing sources" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Business basics" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Business name" })).toHaveValue("Aurum Nordic");
    const stored: unknown = JSON.parse(
      localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(stored).toMatchObject({
      designBrief: { businessIdentity: { businessName: "Aurum Nordic", industry: "jewellery" } },
    });
  });

  it("validates the Finnish Business basics form and keeps the first invalid field focused", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    await user.click(screen.getByRole("button", { name: "Jatka" }));

    expect(await screen.findByRole("heading", { name: "Yrityksen perustiedot" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Yrityksen nimi" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Jatka" }));
    expect(screen.getByRole("textbox", { name: "Yrityksen nimi" })).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(/korostetut kentät/i);
    expect(screen.getByRole("combobox", { name: "Toimiala" })).toHaveTextContent(
      "Valitse toimiala",
    );
  });

  it("preserves a partially completed O-02 form after refresh", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByRole("textbox", { name: "Business name" }), "Aurum Nordic");
    await user.tab();

    const stored: unknown = JSON.parse(
      localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(stored).toMatchObject({
      designBrief: { businessIdentity: { businessName: "Aurum Nordic" } },
    });
    expect(screen.getByRole("textbox", { name: "Business name" })).toHaveValue("Aurum Nordic");
  });

  it("saves a focused O-02 edit before Back and restores it without a second click", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const name = screen.getByRole("textbox", { name: "Business name" });
    await user.type(name, "Aurum Nordic");
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(
      await screen.findByRole("heading", { name: "How would you like to begin?" }),
    ).toBeVisible();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      activeStepId: "creation-path",
      designBrief: { businessIdentity: { businessName: "Aurum Nordic" } },
      completedStepIds: ["creation-path"],
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Business basics" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Business name" })).toHaveValue("Aurum Nordic");
  });

  it("keeps the in-memory form usable when a field save temporarily fails", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const name = screen.getByRole("textbox", { name: "Business name" });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Write blocked", "SecurityError");
    });
    fireEvent.change(name, { target: { value: "Aurum Nordic" } });
    fireEvent.blur(name);
    expect(
      await screen.findByRole("heading", { name: "We cannot access saved onboarding progress" }),
    ).toBeVisible();
    setItem.mockRestore();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Business basics" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Business name" })).toHaveValue("Aurum Nordic");
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
