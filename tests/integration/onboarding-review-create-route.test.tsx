import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "@/app/projects/new/onboarding-wizard";
import type { ApprovedStorefrontProjectResult } from "@/application/approved-storefront-project";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";
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

function reviewSession(): OnboardingSession {
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
      catalogueContext: "controlled-demo-catalogue",
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
      "Catalogue readiness",
      "Warnings",
      "Blockers",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
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
    const user = userEvent.setup();
    localStorage.setItem(ONBOARDING_SESSION_STORAGE_KEY, JSON.stringify(languageSession()));
    render(<OnboardingWizard projectRepositoryFactory={repositoryFactory} />);

    expect(await screen.findByRole("heading", { name: "Storefront languages" })).toBeVisible();
    const english = screen.getByRole("checkbox", { name: "English" });
    expect(english).toBeChecked();
    expect(english).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Finnish" }));
    await user.click(screen.getByRole("radio", { name: "Finnish" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByRole("heading", { name: "Review your storefront plan" }),
    ).toBeVisible();
    expect(screen.getByText("Finnish — Primary language")).toBeVisible();
  });

  it("creates once after explicit confirmation, announces pending and uses editorRoute", async () => {
    let resolveCreation!: (value: ApprovedStorefrontProjectResult) => void;
    const createProject = vi.fn(
      () =>
        new Promise<ApprovedStorefrontProjectResult>((resolve) => {
          resolveCreation = resolve;
        }),
    );
    render(
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
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith(result.editorRoute));
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
    expect(screen.getByText("Northern Light Studio")).toBeVisible();

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
});
