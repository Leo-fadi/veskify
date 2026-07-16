import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderStorefrontPage } from "@/components/storefront/storefront-page";
import { aurumNordicSeed } from "@/data/seed";
import { createAurumNordicProjectRepository } from "@/services/storage";

describe("hidden storefront sections", () => {
  it("keeps a hidden section in persisted canonical data but omits its rendered output", async () => {
    const repository = createAurumNordicProjectRepository();
    const draft = structuredClone(aurumNordicSeed.draftSnapshot);
    draft.id = "snapshot_hidden_hero";
    const homepage = draft.pages.find((page) => page.type === "home");
    if (!homepage) throw new Error("The seeded draft must contain a homepage.");
    homepage.sections[0].visible = false;

    await repository.saveDraft(aurumNordicSeed.project.id, draft);
    const stored = await repository.get(aurumNordicSeed.project.id);
    const storedDraft = stored.snapshots.find(
      (snapshot) => snapshot.id === stored.project.draftSnapshotId,
    );
    const storedHomepage = storedDraft?.pages.find((page) => page.type === "home");

    expect(storedHomepage?.sections).toHaveLength(1);
    expect(storedHomepage?.sections[0]?.visible).toBe(false);

    render(<>{renderStorefrontPage(storedHomepage, "en", stored.project.primaryLocale)}</>);
    expect(
      screen.queryByRole("heading", { name: "Made for northern light" }),
    ).not.toBeInTheDocument();
  });

  it("still validates hidden sections before filtering their output", () => {
    const homepage = structuredClone(aurumNordicSeed.draftSnapshot.pages[0]);
    homepage.sections[0].visible = false;
    homepage.sections[0].component = "unknownComponent";

    expect(() => renderStorefrontPage(homepage, "en", "en")).toThrow(
      "Unknown storefront component",
    );
  });
});
