import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell, Button, StatusPill } from "@/components/ui";

describe("Vesko UI foundations", () => {
  it("provides the Storefront Studio module shell and distinct workspace actions", () => {
    render(
      <AppShell
        activeModule="editor"
        headerActions={
          <>
            <Button href="/projects/project_aurum_nordic">Preview storefront</Button>
            <Button>Save draft</Button>
            <Button href="/projects/project_aurum_nordic/publish" variant="secondary">
              Publish changes
            </Button>
          </>
        }
        projectId="project_aurum_nordic"
        projectName="Aurum Nordic"
      >
        <p>Workspace</p>
      </AppShell>,
    );

    expect(screen.getByText("Vesko")).toBeInTheDocument();
    expect(screen.getAllByText("Storefront Studio")).not.toHaveLength(0);
    expect(
      screen.getByRole("navigation", { name: "Storefront Studio modules" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editor" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Preview storefront" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Publish changes" })).toBeInTheDocument();
  });

  it("keeps statuses presentational and supports the bilingual shell", () => {
    const { rerender } = render(
      <StatusPill label="Draft differs from published" status="draft-different" />,
    );
    expect(screen.getByText("Draft differs from published")).toHaveAttribute(
      "data-status",
      "draft-different",
    );

    rerender(
      <AppShell locale="fi" showModuleNav={false}>
        Sisältö
      </AppShell>,
    );
    expect(screen.getAllByRole("link", { name: "Vesko-etusivu" })).not.toHaveLength(0);
    expect(screen.getAllByText("Storefront Studio")).not.toHaveLength(0);
  });
});
