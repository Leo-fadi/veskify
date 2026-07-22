import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell, Button, StatusPill, Tabs } from "@/components/ui";

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

  it("keeps Setup linked to onboarding only and disables it in project workspaces", () => {
    const { rerender } = render(
      <AppShell activeModule="setup" showModuleNav>
        Onboarding
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Setup" })).toHaveAttribute("href", "/projects/new");

    rerender(
      <AppShell activeModule="editor" projectId="project_aurum_nordic">
        Workspace
      </AppShell>,
    );
    const setup = screen.getByRole("link", { name: "Setup" });
    expect(setup).toHaveAttribute("aria-disabled", "true");
    expect(setup).not.toHaveAttribute("href", "/projects/new");
    fireEvent.click(setup);
    expect(window.location.pathname).not.toBe("/projects/new");
  });

  it("uses the compliant dark green for every primary button", () => {
    render(
      <>
        <Button>Primary button</Button>
        <Button href="/projects/new">Primary link</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Primary button" }).className).toContain(
      "buttonPrimary",
    );
    expect(screen.getByRole("link", { name: "Primary link" }).className).toContain("buttonPrimary");
  });

  it("supports the collapsed editor shell and local tool tabs", () => {
    const onSelect = vi.fn();
    render(
      <AppShell editorMode projectId="project_aurum_nordic">
        <Tabs
          items={[
            { active: true, id: "design", label: "Design" },
            { id: "ai", label: "AI assistant" },
          ]}
          label="Editor tools"
          onSelect={onSelect}
        />
      </AppShell>,
    );

    expect(screen.getByLabelText("Vesko home")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Design" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "AI assistant" }));
    expect(onSelect).toHaveBeenCalledWith("ai");
  });
});
