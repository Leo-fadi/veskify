import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { AURUM_NORDIC_PROJECT_ID } from "@/data/seed/identifiers";

describe("application shell", () => {
  it("renders the merchant Vesko entry surface with canonical working destinations", () => {
    render(<HomePage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /Shape a storefront/i }),
    ).toBeInTheDocument();

    const setup = screen.getByRole("link", { name: "Start storefront setup" });
    const editor = screen.getByRole("link", { name: "Continue editing storefront" });
    const preview = screen.getByRole("link", { name: "Preview storefront" });

    expect(setup).toHaveAttribute("href", "/projects/new");
    expect(editor).toHaveAttribute("href", `/projects/${AURUM_NORDIC_PROJECT_ID}/editor`);
    expect(preview).toHaveAttribute("href", `/projects/${AURUM_NORDIC_PROJECT_ID}`);
    expect([setup, editor, preview].every((link) => link.tagName === "A")).toBe(true);
    expect(
      screen.queryByText(/Veskify|Puck|Developer tools|Open visual editor|Controlled demo/i),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
