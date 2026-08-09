import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createStorefrontRenderContext, renderRegisteredSection } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import {
  createP905aAcceptanceCoordinator,
  generateP905aScenario,
  saveAndResolveP905aPreview,
} from "../helpers/p9-05a-generation-harness";

const generated = await generateP905aScenario("warmApproachable");
const acceptedResult = createP905aAcceptanceCoordinator(generated).accept();
if (acceptedResult.state !== "accepted") {
  throw new Error("The warm P9-05A storefront proposal did not accept.");
}

function warmHome(snapshot = acceptedResult.activeDraft) {
  const home = snapshot.pages.find((page) => page.type === "home");
  if (!home) throw new Error("Missing P9-05A warm homepage.");
  return home;
}

function renderWarmHome(snapshot = acceptedResult.activeDraft) {
  return render(
    <>
      {renderStorefrontPage(
        warmHome(snapshot),
        createStorefrontRenderContext({
          activeLocale: "fi",
          primaryLocale: "fi",
          catalogue: generated.fixture.aggregate.catalogue,
          snapshot,
        }),
      )}
    </>,
  );
}

describe("P9-05A rendered warm-store isolation", () => {
  it("renders merchant-owned BrandStory copy and the approved story media", () => {
    const rendered = renderWarmHome();

    expect(screen.getByRole("heading", { name: "Lumo Atelier" })).toBeVisible();
    expect(
      screen.getByText(/Finnish small-batch jewellery studio combining careful craftsmanship/i),
    ).toBeVisible();
    expect(screen.queryByText(/Aurum/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Karvonen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/project_aurum|project_karvonen/i)).not.toBeInTheDocument();

    const storyImage = screen.getByAltText("Sormuksen viimeistely käsin");
    expect(storyImage).toHaveAttribute("src", "https://lumo.example/assets/craft.jpg");
    expect(storyImage).not.toHaveAttribute(
      "src",
      generated.fixture.aggregate.catalogue.products[1].images[0].url,
    );
    const collectionGrid = rendered.container.querySelector(
      "[data-component='homepageFeaturedCollections'] [data-item-count]",
    );
    expect(collectionGrid).toHaveAttribute("data-item-count", "1");
    expect(collectionGrid?.children).toHaveLength(1);
  });

  it("retains the rendered approved story media in the saved draft preview", async () => {
    const saved = await saveAndResolveP905aPreview({
      generated,
      accepted: acceptedResult.activeDraft,
    });
    renderWarmHome(saved.preview);
    expect(screen.getByAltText("Sormuksen viimeistely käsin")).toHaveAttribute(
      "src",
      "https://lumo.example/assets/craft.jpg",
    );
  });

  it("uses approved editorial placements with deterministic presentation fallback", () => {
    const snapshot = acceptedResult.activeDraft;
    const story = warmHome(snapshot).sections.find(
      (section) => section.component === "homepageEditorial",
    );
    if (!story) throw new Error("Missing warm homepageEditorial section.");
    const context = createStorefrontRenderContext({
      activeLocale: "fi",
      primaryLocale: "fi",
      catalogue: generated.fixture.aggregate.catalogue,
      snapshot,
    });

    const legacyFallback = structuredClone(story);
    legacyFallback.approvedAssetPresentations = [];
    const rendered = render(renderRegisteredSection(legacyFallback, context, "home"));
    expect(
      rendered.container.querySelector(
        '[data-component="homepageEditorial"][data-media-state="approved"]',
      ),
    ).toBeTruthy();
  });
});
