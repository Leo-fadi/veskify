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

  it("validates a redesign URL, completes O-03, returns, and resumes it", async () => {
    const user = userEvent.setup();
    const mounted = render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Redesign an existing storefront/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
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
    const url = screen.getByRole("textbox", { name: "Current storefront address" });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(url).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(/current storefront address/i);

    await user.type(url, "http://merchant.example");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Existing sources" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(/HTTPS/i);

    await user.clear(url);
    await user.type(url, "merchant.example/store");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Brand assets" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Existing sources" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Current storefront address" })).toHaveValue(
      "https://merchant.example/store",
    );
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      activeStepId: "existing-sources",
      completedStepIds: ["creation-path", "business-basics", "existing-sources"],
    });

    mounted.unmount();
    render(<OnboardingWizard />);
    expect(await screen.findByRole("heading", { name: "Existing sources" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Current storefront address" })).toHaveValue(
      "https://merchant.example/store",
    );
  });

  it("persists a focused URL before Back without requiring a second click", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Redesign an existing storefront/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
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
    const url = screen.getByRole("textbox", { name: "Current storefront address" });
    await user.type(url, "merchant.example");
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { name: "Business basics" })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      activeStepId: "business-basics",
      designBrief: {
        creationContext: { existingStorefrontUrl: "https://merchant.example" },
      },
    });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Existing sources" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Current storefront address" })).toHaveValue(
      "https://merchant.example",
    );
  });

  it("clears a URL when Skip follows its blur save and keeps the skip queue handled", async () => {
    const user = userEvent.setup();
    const unhandledRejection = vi.fn();
    const persistedUrls: Array<string | null | undefined> = [];
    const originalSetItem = Storage.prototype.setItem.bind(localStorage);
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (key, value) {
        if (key === ONBOARDING_SESSION_STORAGE_KEY) {
          type StoredSession = {
            designBrief?: { creationContext?: { existingStorefrontUrl?: string | null } };
          };
          const session = JSON.parse(value) as unknown as StoredSession;
          persistedUrls.push(session.designBrief?.creationContext?.existingStorefrontUrl);
        }
        originalSetItem(key, value);
      });
    window.addEventListener("unhandledrejection", unhandledRejection);
    const mounted = render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Redesign an existing storefront/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
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

    const url = screen.getByRole("textbox", { name: "Current storefront address" });
    await user.type(url, "merchant.example/store");
    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(await screen.findByRole("heading", { name: "Brand assets" })).toBeVisible();
    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}"),
      ).toMatchObject({
        activeStepId: "brand-assets",
        completedStepIds: ["creation-path", "business-basics"],
        skippedStepIds: ["existing-sources"],
        designBrief: { creationContext: { existingStorefrontUrl: null } },
      });
    });
    expect(persistedUrls).toContain("https://merchant.example/store");
    expect(persistedUrls.at(-1)).toBeNull();
    expect(unhandledRejection).not.toHaveBeenCalled();
    setItem.mockRestore();
    window.removeEventListener("unhandledrejection", unhandledRejection);

    mounted.unmount();
    render(<OnboardingWizard />);
    expect(await screen.findByRole("heading", { name: "Brand assets" })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      designBrief: { creationContext: { existingStorefrontUrl: null } },
    });
  });

  it("shows the Finnish redesign URL form and localized validation", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Redesign an existing storefront/i }));
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    await user.click(screen.getByRole("button", { name: "Jatka" }));
    await user.type(screen.getByRole("textbox", { name: "Yrityksen nimi" }), "Aurum Nordic");
    await user.type(
      screen.getByRole("textbox", { name: "Lyhyt kuvaus yrityksestä" }),
      "Helsinkiläinen korustudio.",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Toimiala" }), "jewellery");
    await user.type(
      screen.getByRole("textbox", { name: "Kohdeasiakas" }),
      "Pohjoismaisista koruista kiinnostuneet.",
    );
    await user.type(screen.getByRole("textbox", { name: "Päämarkkina" }), "Suomi");
    await user.click(screen.getByRole("button", { name: "Jatka" }));
    expect(await screen.findByRole("heading", { name: "Nykyiset lähteet" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Nykyisen verkkokaupan osoite" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Jatka" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/nykyisen verkkokauppasi osoite/i);
  });

  it.each([
    ["Create a new storefront", /No existing storefront is needed/i],
    ["Use a demo preset", /demo uses controlled sample content/i],
  ])("allows %s to continue without a URL", async (path, information) => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: new RegExp(path, "i") }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
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
    expect(screen.getByText(information)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Brand assets" })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      designBrief: { creationContext: { existingStorefrontUrl: null } },
    });
  });

  it("clears a saved redesign URL when the merchant changes to a new-store path", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Redesign an existing storefront/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
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
    await user.type(
      screen.getByRole("textbox", { name: "Current storefront address" }),
      "merchant.example",
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      designBrief: { creationContext: { type: "new-storefront", existingStorefrontUrl: null } },
    });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Existing sources" })).toBeVisible();
    expect(screen.getByText(/No existing storefront is needed/i)).toBeVisible();
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

  it("completes O-05 in English, persists controlled choices, and renders Finnish labels", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
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
    await screen.findByRole("heading", { name: "Existing sources" });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Brand assets" });
    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(await screen.findByRole("heading", { name: "Visual direction" })).toBeVisible();
    const editorial = screen.getByRole("radio", { name: /Editorial/i });
    await user.click(editorial);
    expect(editorial).toBeChecked();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Typography direction" }),
      "serif",
    );
    await user.click(screen.getByRole("button", { name: "Storytelling" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Visual density" }), "airy");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Accessibility" }),
      "high-contrast",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Catalogue" })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      activeStepId: "catalogue",
      completedStepIds: [
        "creation-path",
        "business-basics",
        "existing-sources",
        "visual-direction",
      ],
      designBrief: {
        brandDirection: {
          visualStyleDirection: "editorial",
          typographyDirection: "serif",
          toneKeywords: ["storytelling"],
        },
        generationPreferences: {
          visualDensity: "airy",
          accessibilityPreference: "high-contrast",
        },
      },
    });

    await user.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "Visual direction" });
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(await screen.findByRole("heading", { name: "Visuaalinen suunta" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Kerronnallinen/i })).toBeVisible();
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
