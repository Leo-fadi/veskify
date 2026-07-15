import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getComponentDefinition,
  renderRegisteredSection,
  validateRegisteredPage,
  validateRegisteredSection,
  validateRegisteredSnapshot,
  veskifyComponentRegistry,
} from "@/components/registry";
import { aurumNordicBrandSystem } from "@/domain/design-system";

const validHeroSection = {
  id: "section_hero",
  component: "hero",
  variant: "editorial",
  visible: true,
  content: {
    eyebrow: { en: "Aurum Nordic" },
    title: { en: "Made to last" },
    body: { en: "Jewellery with a Nordic point of view." },
  },
  props: { activeLocale: "en", primaryLocale: "en" },
};

const validPage = {
  id: "page_home",
  type: "home",
  slug: "/",
  title: { en: "Home" },
  seo: {
    title: { en: "Aurum Nordic" },
    metaDescription: { en: "Nordic jewellery" },
  },
  sections: [validHeroSection],
};

describe("Veskify component registry", () => {
  it("registers and validates the existing AurumHero component", () => {
    const section = validateRegisteredSection(validHeroSection, "home");

    expect(section.component).toBe("hero");
    expect(getComponentDefinition("hero")).toBe(veskifyComponentRegistry.hero);
  });

  it("rejects an unknown component type", () => {
    expect(() =>
      validateRegisteredSection({ ...validHeroSection, component: "unsafeEmbed" }, "home"),
    ).toThrow(/Unknown storefront component/i);
  });

  it("accepts valid variants and rejects unsupported variants", () => {
    expect(validateRegisteredSection(validHeroSection, "home").variant).toBe("editorial");
    expect(() =>
      validateRegisteredSection({ ...validHeroSection, variant: "fullBleed" }, "home"),
    ).toThrow(/Unsupported hero variant/i);
  });

  it("accepts valid content and rejects invalid content", () => {
    expect(validateRegisteredSection(validHeroSection, "home").content).toEqual(
      validHeroSection.content,
    );
    expect(() =>
      validateRegisteredSection(
        {
          ...validHeroSection,
          content: { eyebrow: { en: "Aurum" }, title: { en: "Missing body" } },
        },
        "home",
      ),
    ).toThrow();
  });

  it("accepts valid props and rejects invalid props before rendering", () => {
    expect(validateRegisteredSection(validHeroSection, "home").props).toEqual(
      validHeroSection.props,
    );
    expect(() =>
      renderRegisteredSection(
        { ...validHeroSection, props: { activeLocale: "sv", primaryLocale: "en" } },
        "home",
      ),
    ).toThrow();
  });

  it("renders AurumHero only after registry validation", () => {
    render(<>{renderRegisteredSection(validHeroSection, "home")}</>);

    expect(screen.getByRole("heading", { name: "Made to last" })).toBeInTheDocument();
  });

  it("rejects placement on a page type outside the registry contract", () => {
    expect(() => validateRegisteredSection(validHeroSection, "product")).toThrow(
      /not allowed on product pages/i,
    );
  });

  it("validates aggregate pages and rejects an invalid section", () => {
    expect(validateRegisteredPage(validPage).sections).toHaveLength(1);
    expect(() =>
      validateRegisteredPage({
        ...validPage,
        sections: [{ ...validHeroSection, component: "unknownSection" }],
      }),
    ).toThrow(/Unknown storefront component/i);
  });

  it("rejects an invalid registered section during snapshot validation", () => {
    expect(() =>
      validateRegisteredSnapshot({
        id: "snapshot_draft",
        projectId: "project_aurum",
        revision: 1,
        brandSystem: aurumNordicBrandSystem,
        navigation: { primary: [], footer: [] },
        pages: [{ ...validPage, sections: [{ ...validHeroSection, variant: "split" }] }],
        catalogueRef: "catalogue_aurum",
        createdAt: "2026-07-15T12:00:00+03:00",
        createdBy: "system",
      }),
    ).toThrow(/Unsupported hero variant/i);
  });
});
