import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";
import { generateGuidedStorefront } from "@/application/guided-storefront-generation";
import { createStorefrontGenerationReview } from "@/application/storefront-generation-review";
import { StorefrontGenerationReviewPanel } from "@/components/onboarding/storefront-generation-review-panel";

const createdAt = "2026-07-20T10:00:00.000Z";

function review(overrides: Record<string, unknown> = {}) {
  const brief = normalizeStorefrontDesignBriefInput({
    id: "brief_panel_test",
    createdAt,
    updatedAt: createdAt,
    creationContext: { type: "new-storefront" },
    businessIdentity: {
      businessName: "North Star Jewellery",
      shortDescription: "Exact merchant copy.",
      industry: "jewellery",
    },
    storefrontStructure: { pageTypes: ["home", "collection", "product"] },
    languagePlan: { selectedLanguages: ["en", "fi"], primaryLanguage: "en" },
    catalogueContext: "controlled-demo-catalogue",
    ...overrides,
  });
  const plan = generateGuidedStorefront({
    brief,
    projectId: "project_panel_test",
    snapshotId: "snapshot_panel_test",
    catalogueRef: "catalogue_panel_test",
    createdAt,
  });
  return createStorefrontGenerationReview(plan, brief);
}

function renderPanel(
  currentReview = review(),
  props: Partial<React.ComponentProps<typeof StorefrontGenerationReviewPanel>> = {},
) {
  return render(
    <StorefrontGenerationReviewPanel
      review={currentReview}
      locale="en"
      onBack={vi.fn()}
      onConfirmCreate={vi.fn()}
      {...props}
    />,
  );
}

describe("StorefrontGenerationReviewPanel", () => {
  it("renders all canonical sections in order with merchant facts", () => {
    renderPanel();
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings).toEqual(
      expect.arrayContaining([
        "What we understood",
        "Brand direction",
        "Storefront template",
        "Storefront pages",
        "Storefront languages",
        "Catalogue readiness",
        "Assumptions",
        "Warnings",
        "Blockers",
      ]),
    );
    expect(screen.getByText("North Star Jewellery")).toBeInTheDocument();
    expect(screen.getByText("Exact merchant copy.")).toBeInTheDocument();
    expect(
      screen.queryByText(
        /brief_panel_test|snapshot_panel_test|catalogue_panel_test|P3-05|brand-foundation/,
      ),
    ).not.toBeInTheDocument();
  });

  it("localizes system copy and preserves Finnish merchant values", () => {
    const currentReview = review({
      businessIdentity: {
        businessName: "Pohjoinen Studio",
        shortDescription: "Harkittuja koruja.",
        industry: "jewellery",
      },
      languagePlan: { selectedLanguages: ["fi"], primaryLanguage: "fi" },
    });
    renderPanel(currentReview, { locale: "fi" });
    expect(screen.getByRole("button", { name: "Takaisin" })).toBeInTheDocument();
    expect(screen.getByText("Pohjoinen Studio")).toBeInTheDocument();
    expect(screen.getByText("Harkittuja koruja.")).toBeInTheDocument();
    expect(screen.getByText(/suomi/)).toBeInTheDocument();
  });

  it("maps statuses, keeps not-applicable non-alarming, and renders pages without component IDs", () => {
    const currentReview = review();
    renderPanel(currentReview);
    expect(screen.getByText("Ready with notes")).toBeInTheDocument();
    expect(screen.getAllByText("Complete").length).toBeGreaterThan(0);
    expect(screen.getAllByText("There are no blockers.").length).toBeGreaterThan(0);
    expect(screen.queryByText("hero")).not.toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("renders diagnostics, assumptions and supplied errors without losing review context", () => {
    const currentReview = review({ catalogueContext: "empty-catalogue" });
    const error = "Project creation is temporarily unavailable.";
    renderPanel(currentReview, { errorMessage: error });
    expect(screen.getByRole("alert")).toHaveTextContent(error);
    expect(screen.getAllByText(/Merchandising slots remain/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/controlled defaults/).length).toBeGreaterThan(0);
  });

  it("enables confirmation only for canCreateProject and blocks busy activation", () => {
    const onConfirm = vi.fn();
    const onBack = vi.fn();
    const currentReview = review();
    const busyView = renderPanel(currentReview, { onConfirmCreate: onConfirm, onBack, busy: true });
    expect(screen.getByRole("button", { name: "Creating project…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).not.toHaveBeenCalled();
    busyView.unmount();
    const { unmount } = renderPanel(currentReview, { onConfirmCreate: onConfirm, onBack });
    fireEvent.click(screen.getByRole("button", { name: "Create storefront project" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("rejects malformed reviews at the canonical boundary", () => {
    expect(() => renderPanel({ ...review(), sections: [] })).toThrow();
  });
});
