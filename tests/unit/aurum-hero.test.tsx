import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AurumHero, type AurumHeroProps } from "@/components/storefront/aurum-hero";

const localizedProps: Omit<AurumHeroProps, "activeLocale" | "primaryLocale"> = {
  variant: "editorial",
  eyebrow: { en: "English eyebrow", fi: "Suomenkielinen yläotsikko" },
  title: { en: "English title", fi: "Suomenkielinen otsikko" },
  body: { en: "English body", fi: "Suomenkielinen teksti" },
};

describe("AurumHero localization", () => {
  it("renders English content for the active English locale", () => {
    render(<AurumHero {...localizedProps} activeLocale="en" primaryLocale="fi" />);

    expect(screen.getByRole("heading", { name: "English title" })).toBeInTheDocument();
    expect(screen.getByText("English eyebrow")).toBeInTheDocument();
    expect(screen.getByText("English body")).toBeInTheDocument();
  });

  it("renders Finnish content for the active Finnish locale", () => {
    render(<AurumHero {...localizedProps} activeLocale="fi" primaryLocale="en" />);

    expect(screen.getByRole("heading", { name: "Suomenkielinen otsikko" })).toBeInTheDocument();
    expect(screen.getByText("Suomenkielinen yläotsikko")).toBeInTheDocument();
    expect(screen.getByText("Suomenkielinen teksti")).toBeInTheDocument();
  });

  it("falls back to the project primary locale when active content is missing", () => {
    render(
      <AurumHero
        {...localizedProps}
        eyebrow={{ fi: "Ensisijainen yläotsikko" }}
        title={{ fi: "Ensisijainen otsikko" }}
        body={{ fi: "Ensisijainen teksti" }}
        activeLocale="en"
        primaryLocale="fi"
      />,
    );

    expect(screen.getByRole("heading", { name: "Ensisijainen otsikko" })).toBeInTheDocument();
    expect(screen.getByText("Ensisijainen yläotsikko")).toBeInTheDocument();
    expect(screen.getByText("Ensisijainen teksti")).toBeInTheDocument();
  });
});
