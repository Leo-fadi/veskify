import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("application shell", () => {
  it("renders an accessible Aurum Nordic foundation shell", () => {
    render(<HomePage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /Aurum Nordic/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review status/i })).toHaveAttribute("href", "#foundation-status");
    expect(screen.getByText(/stops before onboarding/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Aurum Nordic draft preview/i })).toHaveAttribute(
      "href",
      "/projects/project_aurum_nordic",
    );
  });
});
