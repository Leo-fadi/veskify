import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "@/app/projects/new/onboarding-wizard";
import { OnboardingService } from "@/application/onboarding";
import { onboardingSessionSchema } from "@/domain/onboarding";
import { ONBOARDING_SESSION_STORAGE_KEY, OnboardingStorageError } from "@/services/onboarding";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

async function reachCatalogue(user: ReturnType<typeof userEvent.setup>) {
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
  await screen.findByRole("heading", { name: "Visual direction" });
  await user.click(screen.getByRole("radio", { name: /Editorial/i }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Catalogue" });
}

async function reachBusinessBasics(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { name: "How would you like to begin?" });
  await user.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Business basics" });
}

async function reachRedesignSources(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { name: "How would you like to begin?" });
  await user.click(screen.getByRole("radio", { name: /Redesign an existing storefront/i }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Business name" }), {
    target: { value: "Aurum Nordic" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Short business description" }), {
    target: { value: "A Helsinki jewellery studio." },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Industry" }), {
    target: { value: "jewellery" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Target customer" }), {
    target: { value: "Customers looking for Nordic jewellery." },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Primary market" }), {
    target: { value: "Finland" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Existing sources" });
}

describe("guided onboarding route", () => {
  beforeEach(() => {
    localStorage.clear();
    routerPush.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders the Vesko setup shell with localized save state", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    expect(await screen.findByRole("img", { name: "Vesko" })).toBeVisible();
    expect(screen.getByText("Storefront setup")).toBeVisible();
    expect(await screen.findByRole("status", { name: "Save status" })).toHaveTextContent("Saved");
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Save & exit" })).toBeEnabled();
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.getByText("Verkkokaupan aloitus")).toBeVisible();
    expect(screen.getByRole("status", { name: "Tallennuksen tila" })).toHaveTextContent(
      "Tallennettu",
    );
    expect(screen.getByRole("button", { name: "Tallenna ja poistu" })).toBeEnabled();
  });

  it("renders named progress states and a stable action area in EN and FI", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);

    const rail = await screen.findByRole("complementary", { name: "Onboarding progress" });
    expect(
      within(rail).getByRole("listitem", { name: /How would you like to begin?/ }),
    ).toHaveAttribute("data-state", "current");
    expect(within(rail).getByRole("listitem", { name: /Business basics/ })).toHaveAttribute(
      "data-state",
      "upcoming",
    );
    expect(within(rail).getByRole("listitem", { name: /Storefront languages/ })).toHaveAttribute(
      "data-state",
      "upcoming",
    );

    const actions = screen.getByRole("contentinfo", { name: "Onboarding actions" });
    expect(within(actions).getByRole("button", { name: "Back" })).toBeDisabled();
    expect(within(actions).getByRole("button", { name: "Save & exit" })).toBeEnabled();
    expect(within(actions).getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
    await user.click(within(actions).getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Business basics" })).toBeVisible();
    expect(
      within(rail).getByRole("listitem", { name: /How would you like to begin?/ }),
    ).toHaveAttribute("data-state", "completed");
    expect(within(rail).getByRole("listitem", { name: /Business basics/ })).toHaveAttribute(
      "data-state",
      "current",
    );

    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(screen.getByRole("complementary", { name: "Aloituksen edistyminen" })).toBeVisible();
    expect(screen.getByRole("contentinfo", { name: "Aloituksen toiminnot" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tallenna ja poistu" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Jatka" })).toBeEnabled();
  });

  it("announces a focused local edit as unsaved before blur, then returns to Saved", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await reachBusinessBasics(user);

    const name = screen.getByRole("textbox", { name: "Business name" });
    name.focus();
    fireEvent.change(name, { target: { value: "North Star Studio" } });

    expect(name).toHaveFocus();
    expect(screen.getByRole("status", { name: "Save status" })).toHaveTextContent(
      "Unsaved changes",
    );

    fireEvent.blur(name);
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Save status" })).toHaveTextContent("Saved"),
    );
  });

  it("flushes a focused business field through the queue before Save & exit", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await reachBusinessBasics(user);

    const name = screen.getByRole("textbox", { name: "Business name" });
    name.focus();
    fireEvent.change(name, { target: { value: "Focused Studio" } });
    expect(name).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Save & exit" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      designBrief: { businessIdentity: { businessName: "Focused Studio" } },
    });
  });

  it("flushes a focused existing-source field before Back to dashboard", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await reachRedesignSources(user);

    const source = screen.getByRole("textbox", { name: "Current storefront address" });
    source.focus();
    fireEvent.change(source, { target: { value: "merchant.example/store" } });
    expect(source).toHaveFocus();
    fireEvent.click(screen.getByRole("link", { name: "Back to dashboard" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      designBrief: {
        creationContext: { existingStorefrontUrl: "https://merchant.example/store" },
      },
    });
  });

  it("keeps the latest rapid edit when an older blur save finishes later", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await reachBusinessBasics(user);

    let releaseOlderSave: () => void = () => undefined;
    const olderSave = new Promise<void>((resolve) => {
      releaseOlderSave = resolve;
    });
    vi.spyOn(OnboardingService.prototype, "updateBusinessIdentityField").mockImplementation(
      async (session, field, value) => {
        await olderSave;
        return onboardingSessionSchema.parse({
          ...session,
          designBrief: {
            ...session.designBrief,
            businessIdentity: { ...session.designBrief.businessIdentity, [field]: value },
          },
        });
      },
    );

    const name = screen.getByRole("textbox", { name: "Business name" });
    fireEvent.change(name, { target: { value: "Older value" } });
    fireEvent.blur(name);
    name.focus();
    fireEvent.change(name, { target: { value: "Latest value" } });
    releaseOlderSave();

    await waitFor(() => expect(name).toHaveValue("Latest value"));
    expect(screen.getByRole("status", { name: "Save status" })).toHaveTextContent(
      "Unsaved changes",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save & exit" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      designBrief: { businessIdentity: { businessName: "Latest value" } },
    });
  });

  it("prevents exit and exposes a Finnish error when focused-field persistence fails", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await reachBusinessBasics(user);
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    vi.spyOn(OnboardingService.prototype, "persistSession").mockRejectedValue(
      new OnboardingStorageError(),
    );

    const name = screen.getByRole("textbox", { name: "Yrityksen nimi" });
    name.focus();
    fireEvent.change(name, { target: { value: "Kesken Studio" } });
    fireEvent.click(screen.getByRole("button", { name: "Tallenna ja poistu" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ei voitu tallentaa/i);
    expect(screen.getByRole("status", { name: "Tallennuksen tila" })).toHaveTextContent(
      "Tallennus epäonnistui",
    );
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("queues Save & exit behind pending mutations and persists before navigation", async () => {
    const user = userEvent.setup();
    let releaseMutation: () => void = () => undefined;
    const pendingMutation = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    vi.spyOn(OnboardingService.prototype, "selectCreationPath").mockImplementation(
      async (session) => {
        await pendingMutation;
        return session;
      },
    );
    const persist = vi.spyOn(OnboardingService.prototype, "persistSession");
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
    await user.click(screen.getByRole("button", { name: "Save & exit" }));
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(persist).not.toHaveBeenCalled();
    releaseMutation();
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
    expect(persist).toHaveBeenCalledOnce();
  });

  it("prevents repeated Save & exit activation while persistence is pending", async () => {
    const user = userEvent.setup();
    let releaseSave: () => void = () => undefined;
    const persist = vi.spyOn(OnboardingService.prototype, "persistSession").mockImplementation(
      (session) =>
        new Promise((resolve) => {
          releaseSave = () => resolve(session);
        }),
    );
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("button", { name: "Save & exit" }));
    await user.click(screen.getByRole("button", { name: "Saving…" }));
    expect(persist).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
    const globalHome = within(
      screen.getByRole("navigation", { name: "Global navigation" }),
    ).getByRole("link", { name: "Vesko home" });
    expect(globalHome).toHaveAttribute("aria-disabled", "true");
    await user.click(globalHome);
    expect(routerPush).not.toHaveBeenCalled();
    releaseSave();
    await waitFor(() => expect(routerPush).toHaveBeenCalledOnce());
  });

  it("keeps the merchant on onboarding and announces a Save & exit failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(OnboardingService.prototype, "persistSession").mockRejectedValue(
      new OnboardingStorageError(),
    );
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("button", { name: "Save & exit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not save/i);
    expect(screen.getByText("Save failed")).toBeVisible();
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save & exit" })).toBeEnabled();
  });

  it("persists before keyboard navigation back to the dashboard", async () => {
    const user = userEvent.setup();
    let releaseSave: () => void = () => undefined;
    const persist = vi.spyOn(OnboardingService.prototype, "persistSession").mockImplementation(
      (session) =>
        new Promise((resolve) => {
          releaseSave = () => resolve(session);
        }),
    );
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    const dashboard = screen.getByRole("link", { name: "Back to dashboard" });
    dashboard.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(persist).toHaveBeenCalledOnce());
    expect(routerPush).not.toHaveBeenCalled();
    releaseSave();
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
  });

  it("announces the Finnish pending save state", async () => {
    const user = userEvent.setup();
    let releaseSave: () => void = () => undefined;
    vi.spyOn(OnboardingService.prototype, "persistSession").mockImplementation(
      (session) =>
        new Promise((resolve) => {
          releaseSave = () => resolve(session);
        }),
    );
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "How would you like to begin?" });
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    await user.click(screen.getByRole("button", { name: "Tallenna ja poistu" }));
    expect(screen.getByRole("status", { name: "Tallennuksen tila" })).toHaveTextContent(
      "Tallennetaan…",
    );
    releaseSave();
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
  });

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

  it("restores the canonical industry after returning through the new-store path", async () => {
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
    fireEvent.change(screen.getByRole("combobox", { name: "Industry" }), {
      target: { value: "jewellery" },
    });
    await user.type(
      screen.getByRole("textbox", { name: "Target customer" }),
      "Customers looking for Nordic jewellery.",
    );
    await user.type(screen.getByRole("textbox", { name: "Primary market" }), "Finland");
    await user.tab();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    await screen.findByRole("heading", { name: "How would you like to begin?" });
    fireEvent.click(screen.getByRole("radio", { name: /Create a new storefront/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Business basics" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Industry" })).toHaveValue("jewellery");
    expect(screen.getByRole("textbox", { name: "Business name" })).toHaveValue("Aurum Nordic");
    expect(screen.getByRole("textbox", { name: "Short business description" })).toHaveValue(
      "A Helsinki jewellery studio.",
    );
    expect(screen.getByRole("textbox", { name: "Target customer" })).toHaveValue(
      "Customers looking for Nordic jewellery.",
    );
    expect(screen.getByRole("textbox", { name: "Primary market" })).toHaveValue("Finland");
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      designBrief: { businessIdentity: { industry: "jewellery" } },
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Existing sources" })).toBeVisible();
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
      "serif-led",
    );
    await user.click(screen.getByRole("button", { name: "Elegant" }));
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
          typographyDirection: "serif-led",
          toneKeywords: ["elegant"],
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

  it("renders, accepts and field-saves every SDD 8.3 visual-direction choice", async () => {
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
    await screen.findByRole("heading", { name: "Visual direction" });

    const persistedBrief = () =>
      onboardingSessionSchema.parse(
        JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}"),
      ).designBrief;
    const tones = [
      ["Elegant", "elegant"],
      ["Modern", "modern"],
      ["Warm", "warm"],
      ["Bold", "bold"],
      ["Minimal", "minimal"],
      ["Playful", "playful"],
      ["Technical", "technical"],
    ] as const;
    for (const [label, value] of tones) {
      const choice = screen.getByRole("button", { name: new RegExp(`^${label}$`) });
      expect(choice).toBeVisible();
      await user.click(choice);
      await waitFor(() => expect(persistedBrief().brandDirection.toneKeywords).toEqual([value]));
      await user.click(choice);
      await waitFor(() => expect(persistedBrief().brandDirection.toneKeywords).toEqual([]));
    }

    const typography = screen.getByRole("combobox", { name: "Typography direction" });
    for (const [label, value] of [
      ["Serif-led", "serif-led"],
      ["Sans-led", "sans-led"],
      ["Mixed", "mixed"],
      ["Strong", "strong"],
      ["Soft", "soft"],
    ] as const) {
      expect(within(typography).getByRole("option", { name: label })).toBeVisible();
      await user.selectOptions(typography, value);
      await waitFor(() => expect(persistedBrief().brandDirection.typographyDirection).toBe(value));
    }

    const imagery = screen.getByRole("combobox", { name: "Imagery direction" });
    for (const [label, value] of [
      ["Studio", "studio"],
      ["Lifestyle", "lifestyle"],
      ["Editorial", "editorial"],
      ["Product-focused", "product-focused"],
      ["Mixed", "mixed"],
    ] as const) {
      expect(within(imagery).getByRole("option", { name: label })).toBeVisible();
      await user.selectOptions(imagery, value);
      await waitFor(() => expect(persistedBrief().brandDirection.imageryDirection).toBe(value));
    }

    const density = screen.getByRole("combobox", { name: "Visual density" });
    for (const [label, value] of [
      ["Airy", "airy"],
      ["Balanced", "balanced"],
      ["Compact", "compact"],
    ] as const) {
      expect(within(density).getByRole("option", { name: label })).toBeVisible();
      await user.selectOptions(density, value);
      await waitFor(() => expect(persistedBrief().generationPreferences.visualDensity).toBe(value));
    }

    const promotion = screen.getByRole("combobox", { name: "Promotion prominence" });
    for (const [label, value] of [
      ["Subtle", "subtle"],
      ["Balanced", "balanced"],
      ["Campaign-led", "campaign-led"],
    ] as const) {
      expect(within(promotion).getByRole("option", { name: label })).toBeVisible();
      await user.selectOptions(promotion, value);
      await waitFor(() =>
        expect(persistedBrief().generationPreferences.merchandisingEmphasis).toBe(value),
      );
    }
  }, 15_000);

  it("renders and keyboard-persists all canonical O-06 choices, then reaches Pages", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await reachCatalogue(user);

    const choices = [
      ["Existing Vesko catalogue", "existing-vesko-catalogue"],
      ["Demo catalogue", "controlled-demo-catalogue"],
      ["Empty catalogue", "empty-catalogue"],
    ] as const;
    for (const [label, value] of choices) {
      const option = screen.getByRole("radio", { name: new RegExp(label) });
      option.focus();
      fireEvent.keyDown(option, { key: " ", code: "Space" });
      fireEvent.keyUp(option, { key: " ", code: "Space" });
      await waitFor(() =>
        expect(screen.getByRole("radio", { name: new RegExp(label) })).toBeChecked(),
      );
      await waitFor(() =>
        expect(
          onboardingSessionSchema.parse(
            JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}"),
          ).designBrief.catalogueContext,
        ).toBe(value),
      );
    }

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Store pages" })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      activeStepId: "pages",
      completedStepIds: [
        "creation-path",
        "business-basics",
        "existing-sources",
        "visual-direction",
        "catalogue",
      ],
      skippedStepIds: ["brand-assets"],
      designBrief: { catalogueContext: "empty-catalogue" },
    });
  }, 15_000);

  it("shows an accessible validation error when O-06 continues without a choice", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await reachCatalogue(user);

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/catalogue option/i);
    const group = screen.getByRole("group", { name: "Catalogue context" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("aria-describedby", "catalogue-context-error");
    expect(screen.getByRole("alert")).toBeVisible();
  }, 15_000);

  it("preserves the selected context through Continue, Back and refresh", async () => {
    const user = userEvent.setup();
    const mounted = render(<OnboardingWizard />);
    await reachCatalogue(user);
    await user.click(screen.getByRole("radio", { name: /Demo catalogue/i }));
    await waitFor(() => {
      const selectedStored: unknown = JSON.parse(
        localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}",
      );
      expect(selectedStored).toMatchObject({
        designBrief: { catalogueContext: "controlled-demo-catalogue" },
      });
    });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Store pages" });
    mounted.unmount();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "Store pages" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Catalogue" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Demo catalogue/i })).toBeChecked();
    const resumedStored: unknown = JSON.parse(
      localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(resumedStored).toMatchObject({
      designBrief: { catalogueContext: "controlled-demo-catalogue" },
    });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Visual direction" })).toBeVisible();
  }, 15_000);

  it("skips O-06 with the empty-catalogue fallback and supports Finnish copy", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await reachCatalogue(user);
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(await screen.findByRole("heading", { name: "Tuoteluettelo" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Nykyinen Vesko-tuoteluettelo/i })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Demotuoteluettelo/i })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Tyhjä tuoteluettelo/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Ohita nyt" }));
    expect(await screen.findByRole("heading", { name: "Kaupan sivut" })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      activeStepId: "pages",
      completedStepIds: [
        "creation-path",
        "business-basics",
        "existing-sources",
        "visual-direction",
      ],
      skippedStepIds: ["brand-assets", "catalogue"],
      designBrief: { catalogueContext: "empty-catalogue" },
    });
  }, 15_000);

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

  it("renders canonical required O-07 pages, persists them and advances to O-08", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await reachCatalogue(user);
    await user.click(screen.getByRole("radio", { name: /Demo catalogue/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Store pages" })).toBeVisible();
    const group = screen.getByRole("group", { name: "Pages to generate" });
    expect(within(group).getByRole("checkbox", { name: /Homepage/i })).toBeChecked();
    expect(within(group).getByRole("checkbox", { name: /Collection \/ listing/i })).toBeChecked();
    expect(within(group).getByRole("checkbox", { name: /Product detail/i })).toBeChecked();
    expect(within(group).getAllByRole("checkbox")).toHaveLength(8);
    expect(within(group).getByRole("checkbox", { name: /Homepage/i })).toBeDisabled();
    expect(within(group).getByRole("checkbox", { name: /About/i })).toBeEnabled();
    await user.click(within(group).getByRole("checkbox", { name: /About/i }));
    expect(within(group).getByRole("checkbox", { name: /About/i })).toBeChecked();
    await user.click(within(group).getByRole("checkbox", { name: /About/i }));
    expect(within(group).getByRole("checkbox", { name: /About/i })).not.toBeChecked();
    await user.click(within(group).getByRole("checkbox", { name: /Content page/i }));
    expect(screen.queryByRole("button", { name: "Skip for now" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Storefront languages" })).toBeVisible();
    const persisted = JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}") as {
      activeStepId?: string;
      completedStepIds?: string[];
      designBrief?: { storefrontStructure?: { pageTypes?: string[] } };
    };
    expect(persisted.activeStepId).toBe("languages");
    expect(persisted.completedStepIds).toEqual(expect.arrayContaining(["pages"]));
    expect(persisted.designBrief?.storefrontStructure?.pageTypes).toEqual([
      "home",
      "collection",
      "product",
      "content",
    ]);
  });

  it("keeps O-07 choices through refresh, Back and Finnish labels", async () => {
    const user = userEvent.setup();
    const mounted = render(<OnboardingWizard />);
    await reachCatalogue(user);
    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(await screen.findByRole("heading", { name: "Store pages" })).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    expect(await screen.findByRole("heading", { name: "Kaupan sivut" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Etusivu/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Kokoelma \/ listaus/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Tuotesivu/i })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /Yhteystiedot/i }));
    expect(screen.getByRole("checkbox", { name: /Yhteystiedot/i })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Jatka" }));
    expect(await screen.findByRole("heading", { name: "Kaupan kielet" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Takaisin" }));
    expect(await screen.findByRole("heading", { name: "Kaupan sivut" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Etusivu/i })).toBeChecked();
    mounted.unmount();
    render(<OnboardingWizard />);
    await screen.findByRole("heading", { name: "Store pages" });
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    await screen.findByRole("heading", { name: "Kaupan sivut" });
    expect(screen.getByRole("checkbox", { name: /Tuotesivu/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Yhteystiedot/i })).toBeChecked();
  });
});
