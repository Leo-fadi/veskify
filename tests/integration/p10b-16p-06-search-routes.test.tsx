import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchPreviewClient } from "@/app/projects/[projectId]/search/search-preview-client";
import {
  parseStorefrontSearchContextParameter,
  parseStorefrontSearchRouteRequest,
} from "@/app/projects/[projectId]/search/search-route-parameters";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront";
import type { LocalizedText } from "@/domain/shared";
import { createStandaloneCatalogueProductSearchAdapter } from "@/integrations/storefront-search";
import type { ProjectAggregate, ProjectRepository } from "@/services/storage";
import { p10b16p01DynamicCommerceAggregate } from "../fixtures/p10b-16p-01-dynamic-commerce";

function repository(value: ProjectAggregate): ProjectRepository {
  return {
    list: vi.fn(),
    get: vi.fn(() => Promise.resolve(structuredClone(value))),
    create: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    restore: vi.fn(),
  };
}

function localized(value: LocalizedText, locale: "en" | "fi") {
  return value[locale] ?? value.en ?? Object.values(value)[0] ?? "";
}

function aggregateWithDynamicPublishedSnapshot() {
  const aggregate = p10b16p01DynamicCommerceAggregate();
  const draft = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
  )!;
  const published = structuredClone(draft);
  published.id = aggregate.project.publishedSnapshotId!;
  aggregate.snapshots = [draft, published];
  return aggregate;
}

describe("P10B-16P-06 storefront search routes", () => {
  it("parses only bounded transient search state and rejects malformed supported parameters", () => {
    expect(
      parseStorefrontSearchRouteRequest({
        parameters: {
          q: "  Aurora   Ring  ",
          locale: "en",
          page: "2",
          pageSize: "12",
          sort: "title-ascending",
          "filter.brand": ["Aurum", "Karvonen"],
          unrelated: "ignored",
        },
        primaryLocale: "en",
        enabledLocales: ["en", "fi"],
      }),
    ).toMatchObject({
      rawQuery: "Aurora Ring",
      locale: "en",
      page: 2,
      pageSize: 12,
      sort: "title-ascending",
      filters: [{ field: "brand", values: ["Aurum", "Karvonen"] }],
    });
    expect(
      parseStorefrontSearchRouteRequest({
        parameters: { q: ["one", "two"], locale: "en" },
        primaryLocale: "en",
        enabledLocales: ["en", "fi"],
      }),
    ).toBeUndefined();
    expect(
      parseStorefrontSearchRouteRequest({
        parameters: { q: "ring", locale: "en", page: "0" },
        primaryLocale: "en",
        enabledLocales: ["en", "fi"],
      }),
    ).toBeUndefined();
    for (const parameters of [
      { q: "ring", locale: "en", pageSize: "13" },
      { q: "ring", locale: "en", sort: "unknown-sort" },
      { q: "ring", locale: "en", "filter.unknown": "value" },
      { q: "ring", locale: ["en", "fi"] },
    ]) {
      expect(
        parseStorefrontSearchRouteRequest({
          parameters,
          primaryLocale: "en",
          enabledLocales: ["en", "fi"],
        }),
      ).toBeUndefined();
    }
    expect(
      parseStorefrontSearchContextParameter({ "p9-05b-session": ["one", "two"] }, "p9-05b-session"),
    ).toEqual({ valid: false });
    expect(
      parseStorefrontSearchContextParameter({ "p10b-16p-04-proposal": "" }, "p10b-16p-04-proposal"),
    ).toEqual({ valid: false });
  });

  it("renders canonical proposal search results without persisting query state", async () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    const draft = aggregate.snapshots.find(
      (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
    )!;
    const product = aggregate.catalogue.products[0];
    const query = localized(product.title, "en");
    const beforeFingerprint = canonicalStorefrontContentFingerprint(draft);
    const onNavigateProduct = vi.fn();

    const view = render(
      <SearchPreviewClient
        initialAggregate={aggregate}
        onNavigateProduct={onNavigateProduct}
        projectId={aggregate.project.id}
        proposalCandidateFingerprint="candidate-safe-fingerprint"
        searchParameters={{ q: query, locale: "en" }}
      />,
    );

    expect(await screen.findByText(/Search results for/)).toHaveTextContent(query);
    expect(view.container.querySelector('[data-search-state="results"]')).toHaveAttribute(
      "data-search-result-count",
      "1",
    );
    expect(screen.getByText(query, { selector: "button" })).toBeVisible();
    const searchForms = screen.getAllByRole("search");
    expect(searchForms.length).toBeGreaterThan(0);
    for (const form of searchForms) {
      expect(form).toHaveAttribute("action", `/projects/${aggregate.project.id}/search`);
      expect(form).toHaveAttribute("method", "get");
      expect(within(form).getByRole("searchbox", { name: "Search products" })).toHaveValue(query);
      expect(form.querySelector('input[name="locale"]')).toHaveValue("en");
      expect(form.querySelector('input[name="p10b-16p-04-proposal"]')).toHaveValue(
        "candidate-safe-fingerprint",
      );
    }
    fireEvent.click(screen.getByRole("button", { name: "View product" }));
    expect(onNavigateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ type: "navigateToProduct", productId: product.id }),
    );
    const exactRoute = draft.dynamicCommercePresentation!.routeInventory.find(
      (route) => route.kind === "product" && route.productId === product.id,
    );
    expect(exactRoute?.route).toMatch(/^\/products\//u);
    expect(canonicalStorefrontContentFingerprint(draft)).toBe(beforeFingerprint);
    expect(JSON.stringify(draft)).not.toContain(query);
  });

  it("renders Finnish no-results without collection-only controls or identity", async () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    render(
      <SearchPreviewClient
        initialAggregate={aggregate}
        projectId={aggregate.project.id}
        searchParameters={{ q: "puuttuva-hakutulos", locale: "fi" }}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Hakutuloksia ei löytynyt" })).toBeVisible();
    expect(screen.getAllByText(/puuttuva-hakutulos/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("searchbox", { name: "Hae tuotteita" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Suodattimet")).not.toBeInTheDocument();
    expect(screen.queryByText("Lajittele")).not.toBeInTheDocument();
    expect(screen.queryByText(/mallisto/i)).not.toBeInTheDocument();
  });

  it("fails closed when an injected port returns a self-consistent result for another request", async () => {
    const aggregate = p10b16p01DynamicCommerceAggregate();
    render(
      <SearchPreviewClient
        initialAggregate={aggregate}
        projectId={aggregate.project.id}
        searchParameters={{ q: "ring", locale: "en" }}
        searchPortFactory={({ catalogue }) => {
          const adapter = createStandaloneCatalogueProductSearchAdapter({ catalogue });
          return {
            search(request, authority) {
              return adapter.search({ ...request, rawQuery: "different request" }, authority);
            },
          };
        }}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Search could not be displayed" }),
    ).toBeVisible();
    expect(screen.queryByText(/Search results for/)).not.toBeInTheDocument();
  });

  it.each([
    ["published", undefined, "Published storefront"],
    ["history", "draft_aurum_nordic", "Previous version"],
  ] as const)(
    "uses the same transient adapter in %s preview",
    async (snapshotKind, historicalId, label) => {
      const aggregate = aggregateWithDynamicPublishedSnapshot();
      const draft = aggregate.snapshots.find(
        (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
      )!;
      const historicalSnapshotId = snapshotKind === "history" ? draft.id : historicalId;
      const product = aggregate.catalogue.products[0];
      render(
        <SearchPreviewClient
          historicalSnapshotId={historicalSnapshotId}
          projectId={aggregate.project.id}
          repositoryFactory={() => repository(aggregate)}
          renderTarget={snapshotKind === "published" ? "published" : "preview"}
          searchParameters={{ q: localized(product.title, "en"), locale: "en" }}
          snapshotKind={snapshotKind}
        />,
      );

      expect(await screen.findByText(/Search results for/)).toBeVisible();
      expect(screen.getByText(label)).toBeVisible();
      const expectedPrefix =
        snapshotKind === "published"
          ? `/projects/${aggregate.project.id}/published/search`
          : `/projects/${aggregate.project.id}/history/${draft.id}/search`;
      for (const form of screen.getAllByRole("search")) {
        expect(form).toHaveAttribute("action", expectedPrefix);
      }
    },
  );
});
