import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "@/app/projects/new/onboarding-wizard";
import type { ApprovedStorefrontProjectResult } from "@/application/approved-storefront-project";
import { normalizeStorefrontDesignBriefInput, type CatalogueContext } from "@/domain/design-brief";
import {
  onboardingBriefIdForSession,
  onboardingSessionSchema,
  type OnboardingSession,
} from "@/domain/onboarding";
import { ONBOARDING_SESSION_STORAGE_KEY } from "@/services/onboarding";
import type { ProjectRepository } from "@/services/storage";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

const createdAt = "2026-07-19T10:00:00.000Z";

function reviewSession(
  catalogueContext: CatalogueContext = "controlled-demo-catalogue",
): OnboardingSession {
  const id = "onboarding_review_route";
  return onboardingSessionSchema.parse({
    schemaVersion: 2,
    id,
    creationPath: "new-storefront",
    activeStepId: "review-plan",
    completedStepIds: [
      "creation-path",
      "business-basics",
      "existing-sources",
      "visual-direction",
      "catalogue",
      "pages",
      "languages",
    ],
    skippedStepIds: ["brand-assets"],
    selectedLanguages: ["en", "fi"],
    primaryLanguage: "en",
    status: "active",
    createdAt,
    updatedAt: createdAt,
    designBrief: normalizeStorefrontDesignBriefInput({
      id: onboardingBriefIdForSession(id),
      createdAt,
      updatedAt: createdAt,
      creationContext: { type: "new-storefront" },
      businessIdentity: {
        businessName: "Northern Light Studio",
        shortDescription: "Considered jewellery for everyday wear.",
        industry: "jewellery",
        targetCustomer: "Customers looking for lasting Nordic design.",
        primaryMarket: "Finland",
      },
      brandDirection: {
        visualStyleDirection: "editorial",
        typographyDirection: "serif-led",
        imageryDirection: "product-focused",
        toneKeywords: ["elegant"],
      },
      catalogueContext,
      storefrontStructure: { pageTypes: ["home", "collection", "product"] },
      languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    }),
  });
}

function seedReviewSession() {
  localStorage.setItem(ONBOARDING_SESSION_STORAGE_KEY, JSON.stringify(reviewSession()));
}

function languageSession(): OnboardingSession {
  const review = reviewSession();
  return onboardingSessionSchema.parse({
    ...review,
    activeStepId: "languages",
    selectedLanguages: ["en"],
    primaryLanguage: "en",
    completedStepIds: review.completedStepIds.filter((stepId) => stepId !== "languages"),
    designBrief: {
      ...review.designBrief,
      languagePlan: { selectedLanguages: [], primaryLanguage: null },
    },
  });
}

const result: ApprovedStorefrontProjectResult = {
  projectId: "project_returned",
  editorRoute: "/returned/editor-route",
  draftSnapshotId: "snapshot_returned_draft",
  publishedSnapshotId: "snapshot_returned_published",
};

const repositoryFactory = () => ({}) as ProjectRepository;

describe("O-09 onboarding review and project creation route", () => {
  beforeEach(() => {
    localStorage.clear();
    routerPush.mockReset();
    seedReviewSession();
  });

  it("restores and renders the canonical review without creating a Project", async () => {
    const createProject = vi.fn();
    const mounted = render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Review your storefront plan" }),
    ).toBeVisible();
    for (const heading of [
      "What we understood",
      "Brand direction",
      "Storefront template",
      "Storefront pages",
      "Storefront languages",
      "Catalogue plan",
      "Warnings",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
    fireEvent.click(
      screen.getByRole("heading", { name: "What we understood" }).closest("summary")!,
    );
    expect(screen.getByText("Northern Light Studio")).toBeVisible();
    expect(createProject).not.toHaveBeenCalled();

    mounted.unmount();
    render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Review your storefront plan" }),
    ).toBeVisible();
    expect(createProject).not.toHaveBeenCalled();
  });

  it("uses the canonical P3-19 language service to reach O-09", async () => {
    localStorage.setItem(ONBOARDING_SESSION_STORAGE_KEY, JSON.stringify(languageSession()));
    render(<OnboardingWizard projectRepositoryFactory={repositoryFactory} />);

    expect(await screen.findByRole("heading", { name: "Storefront languages" })).toBeVisible();
    const english = screen.getByRole("checkbox", { name: "English" });
    expect(english).toBeChecked();
    expect(english).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Finnish" }));
    fireEvent.click(screen.getByRole("radio", { name: "Finnish" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByRole("heading", { name: "Review your storefront plan" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("heading", { name: "Storefront languages" }).closest("summary")!,
    );
    expect(screen.getByText("Finnish — Primary language")).toBeVisible();
  });

  it("serializes rapid O-08 edits and completes with the latest local language draft", async () => {
    localStorage.setItem(ONBOARDING_SESSION_STORAGE_KEY, JSON.stringify(languageSession()));
    render(<OnboardingWizard projectRepositoryFactory={repositoryFactory} />);

    await screen.findByRole("heading", { name: "Storefront languages" });
    act(() => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Finnish" }));
      fireEvent.click(screen.getByRole("radio", { name: "Finnish" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "English" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "English" }));
      fireEvent.click(
        screen
          .getAllByRole("radio", { name: "English" })
          .find((element) => element.getAttribute("name") === "primary-storefront-language")!,
      );
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });

    expect(
      await screen.findByRole("heading", { name: "Review your storefront plan" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("heading", { name: "Storefront languages" }).closest("summary")!,
    );
    expect(screen.getByText("English — Primary language")).toBeVisible();
    expect(screen.getByText("Finnish")).toBeVisible();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      selectedLanguages: ["en", "fi"],
      primaryLanguage: "en",
      designBrief: {
        languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
      },
    });
  });

  it("creates once after explicit confirmation, announces pending and uses editorRoute", async () => {
    let resolveCreation!: (value: ApprovedStorefrontProjectResult) => void;
    const createProject = vi.fn(
      () =>
        new Promise<ApprovedStorefrontProjectResult>((resolve) => {
          resolveCreation = resolve;
        }),
    );
    const mounted = render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );

    const confirm = await screen.findByRole("button", { name: "Create storefront project" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Creating project…" })).toBeDisabled();
    expect(routerPush).not.toHaveBeenCalled();

    resolveCreation(result);
    await waitFor(() => expect(routerPush).toHaveBeenCalledTimes(1));
    expect(routerPush).toHaveBeenCalledWith(result.editorRoute);
    expect(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY)).toBeNull();

    mounted.unmount();
    render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "How would you like to begin?" }),
    ).toBeVisible();
    expect(createProject).toHaveBeenCalledTimes(1);
  });

  it("blocks shell exits while creation is pending and restores them after failure", async () => {
    const user = userEvent.setup();
    let rejectCreation!: (reason?: unknown) => void;
    const createProject = vi.fn(
      () =>
        new Promise<ApprovedStorefrontProjectResult>((_resolve, reject) => {
          rejectCreation = reject;
        }),
    );
    render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );

    const confirm = await screen.findByRole("button", { name: "Create storefront project" });
    const saveExit = screen.getByRole("button", { name: "Save & exit" });
    const dashboard = screen.getByRole("link", { name: "Back to dashboard" });
    const globalHome = within(
      screen.getByRole("navigation", { name: "Global navigation" }),
    ).getByRole("link", { name: "Vesko home" });
    fireEvent.click(confirm);
    fireEvent.click(saveExit);
    dashboard.focus();
    await user.keyboard("{Enter}");
    fireEvent.click(globalHome);

    expect(saveExit).toBeDisabled();
    expect(dashboard).toHaveAttribute("aria-disabled", "true");
    expect(globalHome).toHaveAttribute("aria-disabled", "true");
    expect(routerPush).not.toHaveBeenCalled();

    rejectCreation(new Error("creation failed"));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(saveExit).toBeEnabled();
    expect(dashboard).not.toHaveAttribute("aria-disabled", "true");
    expect(globalHome).not.toHaveAttribute("aria-disabled", "true");
    expect(dashboard).toHaveAttribute("href", "/");
    expect(globalHome).toHaveAttribute("href", "/");
    expect(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY)).not.toBeNull();

    await user.click(globalHome);
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith("/");
  });

  it("retries failed session cleanup without creating a second Project", async () => {
    const user = userEvent.setup();
    const createProject = vi.fn().mockResolvedValue(result);
    const originalRemoveItem = Storage.prototype.removeItem.bind(localStorage);
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementationOnce(() => {
        throw new Error("storage unavailable");
      })
      .mockImplementation((key) => originalRemoveItem(key));
    render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Create storefront project" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({
      status: "completed",
    });

    await user.click(screen.getByRole("button", { name: "Try creating again" }));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith(result.editorRoute));
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ONBOARDING_SESSION_STORAGE_KEY)).toBeNull();
    removeItem.mockRestore();
  });

  it("preserves the review after failure and permits a localized retry", async () => {
    const user = userEvent.setup();
    const createProject = vi
      .fn()
      .mockRejectedValueOnce(new Error("repository detail must stay hidden"))
      .mockResolvedValueOnce(result);
    render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Create storefront project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not create your storefront project",
    );
    expect(screen.queryByText(/repository detail/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What we understood" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Try creating again" }));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith(result.editorRoute));
    expect(createProject).toHaveBeenCalledTimes(2);
  });

  it("supports Finnish review actions and keyboard confirmation", async () => {
    const user = userEvent.setup();
    const createProject = vi.fn().mockResolvedValue(result);
    render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );

    await screen.findByRole("heading", { name: "Review your storefront plan" });
    await user.click(screen.getByRole("radio", { name: "Suomi" }));
    const confirm = screen.getByRole("button", { name: "Luo verkkokauppaprojekti" });
    confirm.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));
  });

  it("allows empty-catalogue creation without demo persistence", async () => {
    localStorage.setItem(
      ONBOARDING_SESSION_STORAGE_KEY,
      JSON.stringify(reviewSession("empty-catalogue")),
    );
    const createProject = vi.fn().mockResolvedValue(result);
    render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Review your storefront plan" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Create storefront project" })).toBeEnabled();
    expect(screen.getByText("Start without products")).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Create storefront project" }));
    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));
  });

  it("blocks unresolved existing-catalogue creation without preparing demo persistence", async () => {
    const catalogueContext = "existing-vesko-catalogue" as const;
    localStorage.setItem(
      ONBOARDING_SESSION_STORAGE_KEY,
      JSON.stringify(reviewSession(catalogueContext)),
    );
    const createProject = vi.fn();
    render(
      <OnboardingWizard
        createProject={createProject}
        projectRepositoryFactory={repositoryFactory}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Review your storefront plan" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Create storefront project" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Blockers" })).toBeVisible();
    expect(createProject).not.toHaveBeenCalled();
  });
});
