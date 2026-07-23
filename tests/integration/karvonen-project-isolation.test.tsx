import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionPreviewClient } from "@/app/projects/[projectId]/collections/[collectionSlug]/collection-preview-client";
import { ProjectPreviewClient } from "@/app/projects/[projectId]/project-preview-client";
import { ProductPreviewClient } from "@/app/projects/[projectId]/products/[productSlug]/product-preview-client";
import { aurumNordicSeed, karvonenSeed } from "@/data/seed";
import {
  InMemoryProjectRepository,
  ProjectNotFoundError,
  type ProjectAggregate,
  type ProjectRepository,
} from "@/services/storage";

function aggregate(seed: typeof aurumNordicSeed | typeof karvonenSeed): ProjectAggregate {
  return {
    project: structuredClone(seed.project),
    catalogue: structuredClone(seed.catalogue),
    snapshots: [structuredClone(seed.publishedSnapshot), structuredClone(seed.draftSnapshot)],
  };
}

function repository(value: ProjectAggregate): ProjectRepository {
  return {
    list: vi.fn(),
    get: vi.fn(() => Promise.resolve(value)),
    create: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    restore: vi.fn(),
  };
}

describe("Karvonen project identity isolation", () => {
  it("renders the Karvonen preview, navigation, footer and locale content from the Karvonen aggregate", async () => {
    const value = aggregate(karvonenSeed);
    render(
      <ProjectPreviewClient
        projectId={value.project.id}
        repositoryFactory={() => repository(value)}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Korut" })).toBeVisible();
    expect(screen.getByText("Karvonen · Suomi")).toBeVisible();
    expect(screen.getByText("Current locale: FI")).toBeVisible();
    expect(screen.queryByText(/Aurum Nordic/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aurora/i)).not.toBeInTheDocument();
    const primaryNavigation = screen.getByRole("navigation", { name: "Päänavigaatio" });
    expect(within(primaryNavigation).getByRole("link", { name: "Etusivu" })).toHaveAttribute(
      "href",
      "/projects/project_karvonen",
    );
    expect(
      within(primaryNavigation).getByRole("link", { name: "Myrskyluodon Maija" }),
    ).toHaveAttribute("href", "/projects/project_karvonen/collections/myrskyluodon-maija");

    fireEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(await screen.findByRole("heading", { name: "Jewellery" })).toBeVisible();
    expect(screen.getByText("Current locale: EN")).toBeVisible();
  });

  it("keeps published and historical Karvonen previews on the same isolated storefront", async () => {
    const value = aggregate(karvonenSeed);
    const historicalSnapshotId = value.project.publishedSnapshotId;
    const routeRepository = repository(value);
    const { rerender } = render(
      <ProjectPreviewClient
        projectId={value.project.id}
        repositoryFactory={() => routeRepository}
        snapshotKind="published"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Korut" })).toBeVisible();
    expect(screen.getByText("Published storefront")).toBeVisible();
    expect(screen.queryByText(/Aurum Nordic/i)).not.toBeInTheDocument();

    rerender(
      <ProjectPreviewClient
        historicalSnapshotId={historicalSnapshotId}
        projectId={value.project.id}
        repositoryFactory={() => routeRepository}
        snapshotKind="history"
      />,
    );
    expect(await screen.findByText("Previous version")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Korut" })).toBeVisible();
    expect(screen.queryByText(/Aurum Nordic/i)).not.toBeInTheDocument();
  });

  it("resolves the direct Karvonen product route through canonical product data", async () => {
    const value = aggregate(karvonenSeed);
    render(
      <ProductPreviewClient
        productId={value.project.id}
        productSlug="guldviva-myrskyluodon-maija-sormus"
        repositoryFactory={() => repository(value)}
      />,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Guldviva Myrskyluodon Maija sormus" }),
    ).toBeVisible();
    expect(screen.getByText("BV012s")).toBeVisible();
    expect(
      document.querySelector('[data-component="dynamicProductDetail"]')?.textContent,
    ).toContain("129");
    expect(screen.queryByText(/Aurum Nordic|Aurora/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-component="dynamicProductDetail"]')).toBeTruthy();
  });

  it("resolves the direct Karvonen collection route through canonical collection data", async () => {
    const value = aggregate(karvonenSeed);
    render(
      <CollectionPreviewClient
        collectionSlug="myrskyluodon-maija"
        projectId={value.project.id}
        repositoryFactory={() => repository(value)}
      />,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Myrskyluodon Maija" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Guldviva Myrskyluodon Maija sormus" }),
    ).toBeVisible();
    expect(screen.queryByText(/Aurum Nordic|Aurora/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-component="dynamicCollectionCommerce"]')).toBeTruthy();
  });

  it("keeps Aurum Nordic separate and rejects unknown project IDs without a fallback", async () => {
    const repository = new InMemoryProjectRepository([
      aggregate(aurumNordicSeed),
      aggregate(karvonenSeed),
    ]);
    const aurum = await repository.get(aurumNordicSeed.project.id);
    const karvonen = await repository.get(karvonenSeed.project.id);

    expect(aurum.project.name).toBe("Aurum Nordic");
    expect(aurum.catalogue.products[0]?.id).toBe("product_aurora_ring_585");
    expect(karvonen.project.name).toBe("Karvonen");
    expect(karvonen.catalogue.products[0]?.id).toBe("product_karvonen_01");
    await expect(repository.get("project_unknown")).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});
