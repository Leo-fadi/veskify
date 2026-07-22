import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { generateGuidedStorefront } from "@/application/guided-storefront-generation";
import { createStorefrontGenerationReview } from "@/application/storefront-generation-review";
import { StorefrontGenerationReviewPanel } from "@/components/onboarding/storefront-generation-review-panel";
import {
  presentAssumptions,
  presentDiagnostics,
} from "@/components/onboarding/storefront-generation-review-presentation";
import { normalizeStorefrontDesignBriefInput } from "@/domain/design-brief";

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
  it("renders the canonical plan as compact merchant sections without internal identifiers", () => {
    const currentReview = review();
    const originalReview = structuredClone(currentReview);
    const { container } = renderPanel(currentReview);
    for (const heading of [
      "What we understood",
      "Brand direction",
      "Storefront template",
      "Storefront pages",
      "Storefront languages",
      "Catalogue plan",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText("North Star Jewellery")).toBeInTheDocument();
    expect(screen.getByText("Exact merchant copy.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /template_balanced_commerce|logo-available|when-not-requested|home\/announcement|home\/newsletter|product\/product-options|new-storefront|brief_panel_test|snapshot_panel_test|catalogue_panel_test/,
    );
    expect(currentReview).toEqual(originalReview);
  });

  it("deduplicates repeated stage warnings while preserving distinct fallback issues", () => {
    const currentReview = review();
    const repeatedLogoDiagnostics = currentReview.sourceDiagnostics.filter(
      ({ code, message }) =>
        code === "OPTIONAL_CAPABILITY_UNAVAILABLE" && message.includes("logo-available"),
    );
    expect(repeatedLogoDiagnostics.length).toBeGreaterThan(1);

    renderPanel(currentReview);
    expect(screen.getAllByText("Logo can be added later")).toHaveLength(1);
    expect(screen.getAllByText("Catalogue content")).toHaveLength(1);
  });

  it("uses concise catalogue copy and the unresolved catalogue blocker", () => {
    const currentReview = review({ catalogueContext: "existing-vesko-catalogue" });
    renderPanel(currentReview);

    expect(screen.getAllByText("Existing Vesko catalogue")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Catalogue plan" })).toBeInTheDocument();
    expect(screen.getByText("Connect your catalogue")).toBeInTheDocument();
    expect(
      screen.getAllByText(/We could not connect the selected Vesko catalogue yet/),
    ).toHaveLength(2);
    expect(screen.getByText("1 blocker")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create storefront project" })).toBeDisabled();
  });

  it("represents non-diagnostic language attention and keeps creation disabled in EN and FI", () => {
    const currentReview = review({ languagePlan: {} });
    const english = renderPanel(currentReview);

    expect(currentReview.blockers).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeVisible();
    expect(screen.getByText("1 blocker")).toBeVisible();
    expect(screen.queryByText("0 blockers")).not.toBeInTheDocument();
    expect(screen.getByText("Choose storefront languages")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create storefront project" })).toBeDisabled();
    english.unmount();

    renderPanel(currentReview, { locale: "fi" });
    expect(screen.getByText("1 estävä kohta")).toBeVisible();
    expect(screen.getByText("Valitse verkkokaupan kielet")).toBeVisible();
    expect(screen.getByRole("button", { name: "Luo verkkokauppaprojekti" })).toBeDisabled();
  });

  it("uses broad attention wording when canonical ineligibility has no countable source", () => {
    const currentReview = review();
    const uncountedReview = {
      ...currentReview,
      canCreateProject: false,
      languagePlan: { selectedLanguages: [], primaryLanguage: null },
    };
    const english = renderPanel(uncountedReview);

    expect(screen.getByText("Some required information still needs attention.")).toBeVisible();
    expect(screen.getByText("Attention required")).toBeVisible();
    expect(screen.queryByText("0 blockers")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create storefront project" })).toBeDisabled();
    english.unmount();

    renderPanel(uncountedReview, { locale: "fi" });
    expect(screen.getByText("Jotkin pakolliset tiedot vaativat vielä huomiota.")).toBeVisible();
    expect(screen.getByText("Huomiota tarvitaan")).toBeVisible();
    expect(screen.queryByText("0 estävää kohtaa")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Luo verkkokauppaprojekti" })).toBeDisabled();
  });

  it("orders blockers before warnings and compact notes", () => {
    renderPanel(review({ catalogueContext: "existing-vesko-catalogue" }));
    const blocker = screen.getByRole("heading", { name: "Blockers" });
    const warning = screen.getByRole("heading", { name: "Warnings" });
    const notes = screen.getByText("Defaults and notes");

    expect(
      blocker.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(warning.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows readiness and canonical presentation counts", () => {
    const currentReview = review();
    const diagnostics = presentDiagnostics(currentReview, "en");
    const noteCount = diagnostics.notes.length + presentAssumptions(currentReview, "en").length;
    renderPanel(currentReview);

    const readiness = screen.getByRole("heading", { name: "Ready to create" }).closest("section");
    expect(readiness).not.toBeNull();
    expect(within(readiness!).getByText(`${diagnostics.blockers.length} blockers`)).toBeVisible();
    expect(within(readiness!).getByText(`${diagnostics.warnings.length} warnings`)).toBeVisible();
    expect(within(readiness!).getByText(`${noteCount} notes`)).toBeVisible();
    expect(screen.getByRole("status", { name: "Ready to create" })).toHaveTextContent(
      "Ready to create",
    );
  });

  it("keeps the guarded Save & exit action in the review footer", () => {
    const onSaveExit = vi.fn();
    renderPanel(review(), { onSaveExit });

    const actions = screen.getByRole("contentinfo", { name: "Review actions" });
    const saveExit = within(actions).getByRole("button", { name: "Save & exit" });
    expect(saveExit).toBeEnabled();
    fireEvent.click(saveExit);
    expect(onSaveExit).toHaveBeenCalledTimes(1);
  });

  it.each(["controlled-demo-catalogue", "empty-catalogue"])(
    "keeps the %s plan creatable",
    (catalogueContext) => {
      renderPanel(review({ catalogueContext }));
      expect(screen.getByRole("button", { name: "Create storefront project" })).toBeEnabled();
    },
  );

  it("supports keyboard focus for blockers and completed details", async () => {
    const user = userEvent.setup();
    renderPanel(review({ catalogueContext: "existing-vesko-catalogue" }));

    const jump = screen.getByRole("button", { name: "Jump to blockers" });
    jump.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Blockers" }).closest("section")).toHaveFocus();

    const summary = screen.getByRole("heading", { name: "Brand direction" }).closest("summary");
    const details = summary?.closest("details");
    expect(details).not.toHaveAttribute("open");
    summary?.focus();
    fireEvent.click(summary!);
    expect(details).toHaveAttribute("open");
  });

  it("uses natural EN and FI brand-direction labels and copy", () => {
    const currentReview = review();
    const english = renderPanel(currentReview);
    expect(screen.getByText("Heading font")).toBeInTheDocument();
    expect(screen.getByText("Body font")).toBeInTheDocument();
    expect(screen.getAllByText("Georgia")).toHaveLength(2);
    expect(screen.getByText("Studio photography")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("Rounded")).toBeInTheDocument();
    expect(screen.getByText("Premium, warm and inspirational")).toBeInTheDocument();
    english.unmount();

    renderPanel(currentReview, { locale: "fi" });
    expect(screen.getByRole("heading", { name: "Valmis luotavaksi" })).toBeInTheDocument();
    expect(screen.getByText("Otsikkofontti")).toBeInTheDocument();
    expect(screen.getByText("Leipätekstin fontti")).toBeInTheDocument();
    expect(screen.getByText("Studiovalokuvaus")).toBeInTheDocument();
    expect(screen.getByText("Tasapainoinen")).toBeInTheDocument();
    expect(screen.getByText("Pyöristetty")).toBeInTheDocument();
    expect(screen.getByText("Premium, lämmin ja inspiroiva")).toBeInTheDocument();
  });

  it("renders supplied errors and preserves busy interaction semantics", () => {
    const error = "Project creation is temporarily unavailable.";
    const errorView = renderPanel(review(), { errorMessage: error });
    expect(screen.getByRole("alert")).toHaveTextContent(error);
    expect(screen.getByRole("button", { name: "Try creating again" })).toBeEnabled();
    errorView.unmount();

    const onBack = vi.fn();
    renderPanel(review(), { busy: true, onBack });
    expect(screen.getByRole("button", { name: "Creating project…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).not.toHaveBeenCalled();
  });

  it("calls confirmation only when the canonical review permits creation", () => {
    const onConfirm = vi.fn();
    renderPanel(review(), { onConfirmCreate: onConfirm });
    fireEvent.click(screen.getByRole("button", { name: "Create storefront project" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed reviews at the canonical boundary", () => {
    expect(() => renderPanel({ ...review(), sections: [] })).toThrow();
  });
});
