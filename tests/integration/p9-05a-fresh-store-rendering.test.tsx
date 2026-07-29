import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createStorefrontRenderContext } from "@/components/registry";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { resolveApprovedBrandStoryMedia } from "@/application/whole-storefront-generation-plan";
import { createP905aFreshMerchantFixture } from "@/data/demo/p9-05a-fresh-store-generation";
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
    const collectionGrid = rendered.container.querySelector(".category-grid");
    expect(collectionGrid).toHaveAttribute("data-content-layout", "single");
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

  it("rejects unresolved or unapproved brand-story asset IDs before rendering", () => {
    const fixture = createP905aFreshMerchantFixture("warmApproachable");
    const pagePlan = generated.plan.pagePlans.find((page) => page.role === "homepage");
    const story = pagePlan?.components.find(
      (
        component,
      ): component is Extract<(typeof pagePlan.components)[number], { instance: object }> =>
        "instance" in component && component.instance.component === "brandStory",
    );
    if (!story || !("instance" in story)) throw new Error("Missing warm BrandStory plan instance.");

    const unknown = structuredClone(story.instance);
    unknown.content.approvedAssetId = "asset_lumo_unapproved";
    unknown.assetAssignments[0] = {
      ...unknown.assetAssignments[0],
      assetId: "asset_lumo_unapproved",
    };
    expect(() =>
      resolveApprovedBrandStoryMedia(unknown, fixture.assetContext, fixture.assetPresentations),
    ).toThrow(/approved editorial asset assignment/i);

    const missingPresentation = structuredClone(story.instance);
    expect(() =>
      resolveApprovedBrandStoryMedia(missingPresentation, fixture.assetContext, []),
    ).toThrow(/unavailable from the approved asset authority/i);
  });
});
