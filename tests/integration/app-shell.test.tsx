import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { AURUM_NORDIC_PROJECT_ID } from "@/data/seed/identifiers";

describe("application shell", () => {
  it("renders the accessible Veskify launchpad with canonical working destinations", () => {
    render(<HomePage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /Veskify storefront design demo/i }),
    ).toBeInTheDocument();

    const setup = screen.getByRole("link", { name: "Start storefront setup" });
    const editor = screen.getByRole("link", { name: "Open visual editor" });
    const preview = screen.getByRole("link", { name: "View storefront preview" });
    const puckProof = screen.getByRole("link", { name: "Open isolated Puck proof" });

    expect(setup).toHaveAttribute("href", "/projects/new");
    expect(editor).toHaveAttribute("href", `/projects/${AURUM_NORDIC_PROJECT_ID}/editor`);
    expect(preview).toHaveAttribute("href", `/projects/${AURUM_NORDIC_PROJECT_ID}`);
    expect(puckProof).toHaveAttribute("href", "/puck-proof");
    expect([setup, editor, preview, puckProof].every((link) => link.tagName === "A")).toBe(true);
    expect(
      screen.queryByText(/Batch 1|stops before onboarding|editor is deferred/i),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
