import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { createAurumNordicProjectRepository } from "@/services/storage";

describe("hidden storefront sections", () => {
  it("keeps a hidden section in persisted canonical data but omits its rendered output", async () => {
    const repository = createAurumNordicProjectRepository();
    const draft = structuredClone(aurumNordicSeed.draftSnapshot);
    draft.id = "snapshot_hidden_hero";
    const homepage = draft.pages.find((page) => page.type === "home");
    if (!homepage) throw new Error("The seeded draft must contain a homepage.");
    homepage.sections[2].visible = false;

    await repository.saveDraft(aurumNordicSeed.project.id, draft);
    const stored = await repository.get(aurumNordicSeed.project.id);
    const storedDraft = stored.snapshots.find(
      (snapshot) => snapshot.id === stored.project.draftSnapshotId,
    );
    const storedHomepage = storedDraft?.pages.find((page) => page.type === "home");

    expect(storedHomepage?.sections).toHaveLength(10);
    expect(storedHomepage?.sections[2]?.visible).toBe(false);

    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: stored.project.primaryLocale,
      catalogue: stored.catalogue,
      snapshot: storedDraft!,
    });
    render(<>{renderStorefrontPage(storedHomepage, context)}</>);
    expect(
      screen.queryByRole("heading", { name: "Made for northern light" }),
    ).not.toBeInTheDocument();
  });

  it("still validates hidden sections before filtering their output", () => {
    const homepage = structuredClone(aurumNordicSeed.draftSnapshot.pages[0]);
    homepage.sections[2].visible = false;
    homepage.sections[2].component = "unknownComponent";

    const context = createStorefrontRenderContext({
      activeLocale: "en",
      primaryLocale: "en",
      catalogue: aurumNordicSeed.catalogue,
      snapshot: aurumNordicSeed.draftSnapshot,
    });
    expect(() => renderStorefrontPage(homepage, context)).toThrow("Unknown storefront component");
  });
});
