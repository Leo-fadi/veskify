import { describe, expect, it } from "vitest";
import { saveValidatedEditorDraft } from "@/application/draft-save";
import {
  changedPagesForActiveDraft,
  composeActiveEditorDraft,
  establishAcceptedAiReceiptClientAuthority,
  proposalStorefrontPreview,
  reconcileAcceptedAiReceiptClientAuthority,
} from "@/app/projects/[projectId]/editor/editor-draft-state";
import { aurumNordicSeed } from "@/data/seed";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";
import type { PageModel, StorefrontSnapshot } from "@/domain/storefront";

function contentPage(): PageModel {
  const brandStory = aurumNordicSeed.draftSnapshot.pages
    .find((page) => page.type === "home")!
    .sections.find((section) => section.component === "brandStory")!;
  return {
    id: "page_about_review",
    type: "content",
    slug: "/about",
    title: { en: "About", fi: "Tietoa" },
    seo: {
      title: { en: "About Aurum Nordic", fi: "Tietoa Aurum Nordicista" },
      metaDescription: { en: "About the studio.", fi: "Tietoa studiosta." },
    },
    sections: [{ ...structuredClone(brandStory), id: "section_about_story" }],
  };
}

function aggregateWithContentPage(): ProjectAggregate {
  const extra = contentPage();
  const withExtra = (snapshot: StorefrontSnapshot): StorefrontSnapshot => ({
    ...structuredClone(snapshot),
    pages: [
      structuredClone(snapshot.pages[0]),
      structuredClone(snapshot.pages[1]),
      structuredClone(extra),
      ...snapshot.pages.slice(2).map((page) => structuredClone(page)),
    ],
  });
  return {
    project: structuredClone(aurumNordicSeed.project),
    catalogue: structuredClone(aurumNordicSeed.catalogue),
    snapshots: [
      withExtra(aurumNordicSeed.publishedSnapshot),
      withExtra(aurumNordicSeed.draftSnapshot),
    ],
  };
}

function currentDraft(snapshot: StorefrontSnapshot) {
  return structuredClone(snapshot);
}

describe("P4-05D editor canonical draft state", () => {
  it("invalidates accepted-AI authority across every canonical mutation family", () => {
    const accepted = structuredClone(aurumNordicSeed.draftSnapshot);
    const authority = establishAcceptedAiReceiptClientAuthority(
      "accepted_receipt_exact_snapshot",
      accepted,
    );
    const homeIndex = accepted.pages.findIndex((page) => page.type === "home");
    const heroIndex = accepted.pages[homeIndex].sections.findIndex(
      (section) => section.component === "hero",
    );

    const contentChange = structuredClone(accepted);
    contentChange.pages[homeIndex].title.en = "Later merchant content";

    const addedSection = structuredClone(accepted);
    addedSection.pages[homeIndex].sections.splice(heroIndex + 1, 0, {
      ...structuredClone(addedSection.pages[homeIndex].sections[heroIndex]),
      id: "section_added_after_accepted_ai",
    });

    const removedSection = structuredClone(accepted);
    removedSection.pages[homeIndex].sections.splice(heroIndex, 1);

    const reorderedSections = structuredClone(accepted);
    const [moved] = reorderedSections.pages[homeIndex].sections.splice(heroIndex, 1);
    reorderedSections.pages[homeIndex].sections.splice(heroIndex + 1, 0, moved);

    const brandChange = structuredClone(accepted);
    brandChange.brandSystem.colors.primary = "#224466";

    const assetChange = structuredClone(accepted);
    const assetSection = assetChange.pages[homeIndex].sections[heroIndex];
    assetSection.content = {
      ...assetSection.content,
      approvedAssetId: "asset_assigned_after_accepted_ai",
    };

    expect(reconcileAcceptedAiReceiptClientAuthority(authority, accepted)).toBe(authority);
    for (const mutation of [
      contentChange,
      addedSection,
      removedSection,
      reorderedSections,
      brandChange,
      assetChange,
    ]) {
      expect(reconcileAcceptedAiReceiptClientAuthority(authority, mutation)).toBeUndefined();
    }
  });

  it("never resurrects invalidated authority after undo/redo and accepts only a newly established receipt", () => {
    const accepted = structuredClone(aurumNordicSeed.draftSnapshot);
    const firstAuthority = establishAcceptedAiReceiptClientAuthority(
      "accepted_receipt_first",
      accepted,
    );
    const divergent = structuredClone(accepted);
    divergent.brandSystem.spacing.density = "compact";

    const invalidated = reconcileAcceptedAiReceiptClientAuthority(firstAuthority, divergent);
    expect(invalidated).toBeUndefined();
    expect(reconcileAcceptedAiReceiptClientAuthority(invalidated, accepted)).toBeUndefined();
    expect(reconcileAcceptedAiReceiptClientAuthority(invalidated, divergent)).toBeUndefined();

    const secondAuthority = establishAcceptedAiReceiptClientAuthority(
      "accepted_receipt_second",
      divergent,
    );
    expect(reconcileAcceptedAiReceiptClientAuthority(secondAuthority, divergent)).toEqual(
      secondAuthority,
    );
    expect(secondAuthority.receiptId).not.toBe(firstAuthority.receiptId);
  });

  it("does not convert missing accepted-AI authority into manual publication authority", () => {
    const accepted = structuredClone(aurumNordicSeed.draftSnapshot);
    const authority = establishAcceptedAiReceiptClientAuthority(
      "accepted_receipt_manual_separation",
      accepted,
    );
    const changed = structuredClone(accepted);
    changed.pages[0].title.fi = "Kauppiaan myöhempi muutos";

    const reconciled = reconcileAcceptedAiReceiptClientAuthority(authority, changed);

    expect(reconciled).toBeUndefined();
    expect(reconciled).not.toEqual(expect.objectContaining({ kind: "manual" }));
  });

  it("derives changed pages from the complete storefront, not only editor-visible pages", async () => {
    const aggregate = aggregateWithContentPage();
    const draft = aggregate.snapshots.find(
      (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
    )!;
    const published = aggregate.snapshots.find(
      (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
    )!;
    const repository = new InMemoryProjectRepository([aggregate]);
    const home = structuredClone(draft.pages.find((page) => page.type === "home")!);
    const about = structuredClone(draft.pages.find((page) => page.id === "page_about_review")!);
    const product = structuredClone(draft.pages.find((page) => page.type === "product")!);
    const brandSystem = structuredClone(draft.brandSystem);
    home.title.en = "Accepted visible homepage";
    about.title.en = "Accepted non-editor page";
    brandSystem.colors.primary = "#78512F";

    const activeDraft = composeActiveEditorDraft({
      draft,
      sessionPages: { [home.id]: home, [about.id]: about },
      brandSystem,
    });
    const changedPages = changedPagesForActiveDraft({ baseDraft: draft, activeDraft });

    expect(changedPages.map((page) => page.id).sort()).toEqual([about.id, home.id].sort());

    const result = await saveValidatedEditorDraft({
      repository,
      projectId: aggregate.project.id,
      loadedDraft: currentDraft(draft),
      changedPages,
      brandSystem: activeDraft.brandSystem,
      primaryLocale: aggregate.project.primaryLocale,
      now: () => new Date("2026-07-21T12:00:00.000Z"),
      createSnapshotId: () => "snapshot_draft_complete_storefront_save",
    });

    expect(result.draft.pages.map((page) => page.id)).toEqual(draft.pages.map((page) => page.id));
    expect(result.draft.navigation).toEqual(draft.navigation);
    expect(result.draft.catalogueRef).toBe(draft.catalogueRef);
    expect(result.aggregate.catalogue).toEqual(aggregate.catalogue);
    expect(result.draft.pages.find((page) => page.id === home.id)?.title.en).toBe(
      "Accepted visible homepage",
    );
    expect(result.draft.pages.find((page) => page.id === about.id)?.title.en).toBe(
      "Accepted non-editor page",
    );
    expect(result.draft.pages.find((page) => page.id === product.id)).toEqual(product);
    expect(result.draft.brandSystem.colors.primary).toBe("#78512F");
    expect(
      result.aggregate.snapshots.find(
        (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
      ),
    ).toEqual(published);
    expect(await repository.get(aggregate.project.id)).toEqual(result.aggregate);
  });

  it("gates storefront preview projection to active pending ready review states", () => {
    const proposedStorefront = {
      pageOrder: aurumNordicSeed.draftSnapshot.pages.map((page) => page.id),
      pages: aurumNordicSeed.draftSnapshot.pages,
      navigation: aurumNordicSeed.draftSnapshot.navigation,
      brandSystem: aurumNordicSeed.draftSnapshot.brandSystem,
    };
    expect(
      proposalStorefrontPreview({
        proposal: { status: "pending", proposedStorefront },
        previewActive: true,
        visibleState: "proposalReady",
      }),
    ).toEqual(proposedStorefront);
    expect(
      proposalStorefrontPreview({
        proposal: { status: "pending", proposedStorefront },
        previewActive: false,
        visibleState: "stale",
      }),
    ).toBeUndefined();
    expect(
      proposalStorefrontPreview({
        proposal: { status: "pending", proposedStorefront },
        previewActive: true,
        visibleState: "failed",
      }),
    ).toBeUndefined();
    expect(
      proposalStorefrontPreview({
        proposal: { status: "accepted", proposedStorefront },
        previewActive: true,
        visibleState: "proposalReady",
      }),
    ).toBeUndefined();
  });
});
