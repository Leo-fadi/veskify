import { describe, expect, it } from "vitest";
import { aurumNordicBrandSystem } from "@/domain/design-system";
import { projectSchema } from "@/domain/project";
import { storefrontSnapshotSchema } from "@/domain/storefront";

const businessProfile = {
  name: "Aurum Nordic",
  description: "A fictional Nordic jewellery retailer.",
  audience: "Customers seeking lasting Nordic jewellery.",
  market: "Finland",
  sourceReferences: [],
};

const homePage = {
  id: "page_home",
  type: "home" as const,
  slug: "/",
  title: { en: "Home", fi: "Etusivu" },
  seo: {
    title: { en: "Aurum Nordic", fi: "Aurum Nordic" },
    metaDescription: { en: "Nordic jewellery", fi: "Pohjoismaisia koruja" },
  },
  sections: [
    {
      id: "section_hero",
      component: "hero",
      variant: "editorial",
      visible: true,
      content: { title: { en: "Made to last", fi: "Tehty kestämään" } },
      props: {},
      styleOverrides: { alignment: "center" as const, spacing: "spacious" as const },
    },
  ],
};

const validSnapshot = {
  id: "snapshot_draft",
  projectId: "project_aurum",
  revision: 1,
  brandSystem: aurumNordicBrandSystem,
  navigation: {
    primary: [
      {
        id: "nav_home",
        label: { en: "Home", fi: "Etusivu" },
        target: { type: "page" as const, pageId: "page_home" },
      },
    ],
    footer: [],
  },
  pages: [homePage],
  catalogueRef: "catalogue_aurum",
  createdAt: "2026-07-15T12:00:00+03:00",
  createdBy: "system" as const,
};

describe("canonical domain models", () => {
  it("validates a project with separate draft and published snapshots", () => {
    expect(
      projectSchema.parse({
        id: "project_aurum",
        name: "Aurum Nordic",
        mode: "salesDemo",
        industry: "jewellery",
        primaryLocale: "fi",
        enabledLocales: ["fi", "en"],
        businessProfile,
        publishedSnapshotId: "snapshot_published",
        draftSnapshotId: "snapshot_draft",
        revision: 1,
        createdAt: "2026-07-15T12:00:00+03:00",
        updatedAt: "2026-07-15T12:05:00+03:00",
      }).draftSnapshotId,
    ).toBe("snapshot_draft");
  });

  it("rejects a primary locale that is not enabled", () => {
    expect(() =>
      projectSchema.parse({
        id: "project_aurum",
        name: "Aurum Nordic",
        mode: "merchant",
        industry: "jewellery",
        primaryLocale: "fi",
        enabledLocales: ["en"],
        businessProfile,
        publishedSnapshotId: "snapshot_published",
        draftSnapshotId: "snapshot_draft",
        revision: 0,
        createdAt: "2026-07-15T12:00:00+03:00",
        updatedAt: "2026-07-15T12:00:00+03:00",
      }),
    ).toThrow(/primary locale/i);
  });

  it("validates one canonical storefront snapshot", () => {
    expect(storefrontSnapshotSchema.parse(validSnapshot).pages).toHaveLength(1);
  });

  it("rejects duplicate section IDs across the snapshot", () => {
    const duplicateSectionSnapshot = {
      ...validSnapshot,
      pages: [
        homePage,
        {
          ...homePage,
          id: "page_about",
          type: "content" as const,
          slug: "/about",
        },
      ],
    };

    expect(() => storefrontSnapshotSchema.parse(duplicateSectionSnapshot)).toThrow(
      /Section IDs must be unique within a snapshot/i,
    );
  });

  it("rejects internal navigation targets that do not exist", () => {
    const brokenNavigationSnapshot = {
      ...validSnapshot,
      navigation: {
        ...validSnapshot.navigation,
        primary: [
          {
            ...validSnapshot.navigation.primary[0],
            target: { type: "page" as const, pageId: "page_missing" },
          },
        ],
      },
    };

    expect(() => storefrontSnapshotSchema.parse(brokenNavigationSnapshot)).toThrow(
      /Navigation targets must resolve/i,
    );
  });

  it("rejects arbitrary local style overrides", () => {
    const unsafeOverrideSnapshot = {
      ...validSnapshot,
      pages: [
        {
          ...homePage,
          sections: [
            {
              ...homePage.sections[0],
              styleOverrides: { css: "position: fixed" },
            },
          ],
        },
      ],
    };

    expect(() => storefrontSnapshotSchema.parse(unsafeOverrideSnapshot)).toThrow();
  });
});
