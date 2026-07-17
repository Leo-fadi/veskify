import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  confirmPublish,
  createPublishChangeSummary,
  InvalidPublishPreparationError,
  NoPublishableChangesError,
  preparePublish,
  publishChangeSummarySchema,
  publishPreparationSchema,
  StalePublishPreparationError,
} from "@/application/publishing";
import { aurumNordicSeed } from "@/data/seed";
import {
  canonicalStorefrontContentEqual,
  canonicalStorefrontContentFingerprint,
  canonicalStorefrontContentString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { InMemoryProjectRepository, type ProjectRepository } from "@/services/storage";

const projectId = aurumNordicSeed.project.id;
const preparedAt = new Date("2026-07-17T18:00:00.000Z");

function repository() {
  return new InMemoryProjectRepository([
    {
      project: structuredClone(aurumNordicSeed.project),
      catalogue: structuredClone(aurumNordicSeed.catalogue),
      snapshots: [
        structuredClone(aurumNordicSeed.publishedSnapshot),
        structuredClone(aurumNordicSeed.draftSnapshot),
      ],
    },
  ]);
}

async function saveChangedDraft(
  value: InMemoryProjectRepository,
  label: string,
  mutate: (draft: StorefrontSnapshot) => void = (draft) => {
    draft.pages[0].title.en = `Saved ${label}`;
  },
) {
  const aggregate = await value.get(projectId);
  const current = aggregate.snapshots.find(
    (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
  )!;
  const draft = structuredClone(current);
  draft.id = `snapshot_publish_test_${label}`;
  draft.createdAt = new Date(Date.parse(current.createdAt) + 1_000).toISOString();
  mutate(draft);
  await value.saveDraft(projectId, draft, {
    id: current.id,
    revision: current.revision,
  });
  return value.get(projectId);
}

async function meaningfulPreparation(value: InMemoryProjectRepository, label: string) {
  await saveChangedDraft(value, label);
  return preparePublish(projectId, value, {
    now: () => preparedAt,
    createPreparationId: () => `publish_preparation_${label}`,
  });
}

describe("P2-11 publishing preparation", () => {
  it("uses a deterministic SHA-256 fingerprint of canonical storefront content", () => {
    const canonical = canonicalStorefrontContentString(aurumNordicSeed.draftSnapshot);
    const expected = createHash("sha256").update(canonical).digest("hex");

    expect(canonicalStorefrontContentFingerprint(aurumNordicSeed.draftSnapshot)).toBe(
      `v1_${canonical.length}_${expected}`,
    );
  });

  it("prepares meaningful saved changes without writes and returns an immutable result", async () => {
    const value = repository();
    await saveChangedDraft(value, "meaningful");
    const before = await value.get(projectId);

    const preparation = await preparePublish(projectId, value, {
      now: () => preparedAt,
      createPreparationId: () => "publish_preparation_meaningful",
    });

    expect(publishPreparationSchema.parse(preparation)).toEqual(preparation);
    expect(preparation.publishPermitted).toBe(true);
    expect(preparation.preparedAt).toBe(preparedAt.toISOString());
    expect(preparation.expectedProjectRevision).toBe(before.project.revision);
    expect(preparation.expectedDraft.id).toBe(before.project.draftSnapshotId);
    expect(preparation.expectedPublished.id).toBe(before.project.publishedSnapshotId);
    expect(preparation.changeSummary.changedPages.map(({ pageId }) => pageId)).toContain(
      before.snapshots.find((snapshot) => snapshot.id === before.project.draftSnapshotId)!.pages[0]
        .id,
    );
    expect(Object.isFrozen(preparation)).toBe(true);
    expect(Object.isFrozen(preparation.changeSummary)).toBe(true);
    expect(await value.get(projectId)).toEqual(before);
  });

  it("returns a controlled no-changes preparation and cannot confirm it", async () => {
    const value = repository();
    const before = await value.get(projectId);
    const publish = vi.spyOn(value, "publish");

    const preparation = await preparePublish(projectId, value, { now: () => preparedAt });

    expect(preparation.publishPermitted).toBe(false);
    expect(preparation.changeSummary.totalChangedPages).toBe(0);
    expect(preparation.changeSummary.totalChangedSections).toBe(0);
    await expect(confirmPublish(preparation, value)).rejects.toBeInstanceOf(
      NoPublishableChangesError,
    );
    expect(publish).not.toHaveBeenCalled();
    expect(await value.get(projectId)).toEqual(before);
  });

  it("ignores snapshot identity metadata and object-key order", () => {
    const published = structuredClone(aurumNordicSeed.publishedSnapshot);
    const draft = structuredClone(published);
    draft.id = "snapshot_identity_only";
    draft.revision += 10;
    draft.createdAt = "2026-07-17T18:30:00.000Z";
    draft.createdBy = "agent";
    const hero = draft.pages[0].sections[2];
    hero.content = Object.fromEntries(Object.entries(hero.content).reverse());
    hero.props = Object.fromEntries(Object.entries(hero.props).reverse());

    expect(canonicalStorefrontContentEqual(published, draft)).toBe(true);
    expect(createPublishChangeSummary(published, draft)).toEqual(
      expect.objectContaining({
        totalChangedPages: 0,
        totalChangedSections: 0,
        brandSystemChanges: [],
        navigationChanges: [],
      }),
    );
  });

  it("summarizes brand and navigation changes deterministically without raw data", () => {
    const published = structuredClone(aurumNordicSeed.publishedSnapshot);
    const draft = structuredClone(published);
    draft.brandSystem.colors.accent = "#B58B3A";
    draft.brandSystem.typography.headingWeight = 700;
    draft.navigation.primary[0].label = {
      en: "New arrivals",
      fi: "Uutuudet",
    };

    const summary = createPublishChangeSummary(published, draft);

    expect(summary.brandSystemChanges).toEqual(["colors.accent", "typography.headingWeight"]);
    expect(summary.navigationChanges).toEqual(["primary"]);
    expect(summary.changedPages).toEqual([]);
    expect(JSON.stringify(summary)).not.toMatch(/1290|RING-AUR-585|inStock/);
    expect(publishChangeSummarySchema.parse(summary)).toEqual(summary);
  });

  it("summarizes page, section, order, variant, visibility, content and property changes", () => {
    const published = structuredClone(aurumNordicSeed.publishedSnapshot);
    const draft = structuredClone(published);
    const home = draft.pages.find((page) => page.type === "home")!;
    const beforeHome = published.pages.find((page) => page.id === home.id)!;
    home.title = { en: "Updated home", fi: "Päivitetty etusivu" };
    home.themeOverride = { spacing: { density: "airy" } };
    const hero = home.sections.find((section) => section.component === "hero")!;
    hero.variant = "split";
    hero.visible = false;
    hero.content = { ...hero.content, title: { en: "New hero", fi: "Uusi hero" } };
    hero.props = { ...hero.props, mediaPosition: "left" };
    hero.styleOverrides = { spacing: "spacious" };
    const heroIndex = home.sections.findIndex(({ id }) => id === hero.id);
    const next = home.sections[heroIndex + 1];
    home.sections.splice(heroIndex, 2, next, hero);
    const removed = home.sections.find((section) => section.component === "newsletter")!;
    home.sections = home.sections.filter(({ id }) => id !== removed.id);
    const added = structuredClone(
      beforeHome.sections.find((section) => section.component === "campaignBanner")!,
    );
    added.id = "section_publish_summary_added";
    home.sections.push(added);

    const summary = createPublishChangeSummary(published, draft);

    expect(summary.changedPages.map(({ pageId }) => pageId)).toContain(home.id);
    expect(summary.pageMetadataChanges[0].beforeTitle).toEqual(beforeHome.title);
    expect(summary.pageMetadataChanges[0].afterTitle).toEqual(home.title);
    expect(summary.pageThemeOverrideChanges).toHaveLength(1);
    expect(summary.sectionOrderChanges).toHaveLength(1);
    expect(summary.sectionVariantChanges).toEqual(
      expect.arrayContaining([expect.objectContaining({ sectionId: hero.id })]),
    );
    expect(summary.sectionVisibilityChanges).toEqual(
      expect.arrayContaining([expect.objectContaining({ sectionId: hero.id })]),
    );
    expect(summary.sectionContentChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectionId: hero.id, changedFields: ["title"] }),
      ]),
    );
    expect(summary.sectionPropertyChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionId: hero.id,
          changedFields: ["mediaPosition", "styleOverrides.spacing"],
        }),
      ]),
    );
    expect(summary.sectionsRemoved.map(({ sectionId }) => sectionId)).toContain(removed.id);
    expect(summary.sectionsAdded.map(({ sectionId }) => sectionId)).toContain(added.id);
    expect(summary.totalChangedSections).toBeGreaterThanOrEqual(4);
  });

  it("summarizes added and removed pages with their existing localized titles", () => {
    const published = structuredClone(aurumNordicSeed.publishedSnapshot);
    const draft = structuredClone(published);
    const removed = draft.pages.find((page) => page.type === "collection")!;
    draft.pages = draft.pages.filter(({ id }) => id !== removed.id);
    const added = structuredClone(draft.pages.find((page) => page.type === "product")!);
    added.id = "page_publish_added";
    added.slug = "/publish-added";
    added.title = { en: "New page", fi: "Uusi sivu" };
    added.sections = added.sections.map((section) => ({
      ...section,
      id: `${section.id}_publish_added`,
    }));
    draft.pages.push(added);

    const summary = createPublishChangeSummary(published, draft);

    expect(summary.pagesRemoved).toEqual([{ pageId: removed.id, title: removed.title }]);
    expect(summary.pagesAdded).toEqual([{ pageId: added.id, title: added.title }]);
    expect(summary.changedPages).toEqual(
      expect.arrayContaining([
        { pageId: removed.id, title: removed.title },
        { pageId: added.id, title: added.title },
      ]),
    );
  });
});

describe("P2-11 explicit publish confirmation", () => {
  it("requires a valid explicit preparation", async () => {
    await expect(confirmPublish({ projectId }, repository())).rejects.toBeInstanceOf(
      InvalidPublishPreparationError,
    );
  });

  it("publishes atomically into distinct clean published and synchronized draft snapshots", async () => {
    const value = repository();
    const preparation = await meaningfulPreparation(value, "success");
    const before = await value.get(projectId);
    const catalogueBefore = structuredClone(before.catalogue);

    const result = await confirmPublish(preparation, value);

    expect(result.aggregate).toEqual(await value.get(projectId));
    expect(result.aggregate.project.revision).toBe(before.project.revision + 1);
    expect(result.publishedSnapshot.id).not.toBe(result.synchronizedDraftSnapshot.id);
    expect(result.publishedSnapshot.revision).toBe(result.aggregate.project.revision);
    expect(result.synchronizedDraftSnapshot.revision).toBe(result.aggregate.project.revision);
    expect(
      canonicalStorefrontContentEqual(result.publishedSnapshot, result.synchronizedDraftSnapshot),
    ).toBe(true);
    expect(result.aggregate.snapshots.map(({ id }) => id)).toContain(
      preparation.expectedPublished.id,
    );
    expect(result.aggregate.catalogue).toEqual(catalogueBefore);
    expect(result.aggregate.snapshots).toHaveLength(before.snapshots.length + 2);
  });

  it("cancelling by dropping a preparation performs no write", async () => {
    const value = repository();
    await meaningfulPreparation(value, "cancelled");
    const beforeCancellation = await value.get(projectId);

    await Promise.resolve();

    expect(await value.get(projectId)).toEqual(beforeCancellation);
  });

  it("rejects a draft saved after preparation and preserves the newer draft", async () => {
    const value = repository();
    const preparation = await meaningfulPreparation(value, "stale_draft_base");
    await saveChangedDraft(value, "newer_draft");
    const beforeStaleConfirmation = await value.get(projectId);

    await expect(confirmPublish(preparation, value)).rejects.toBeInstanceOf(
      StalePublishPreparationError,
    );

    expect(await value.get(projectId)).toEqual(beforeStaleConfirmation);
  });

  it("rejects canonical draft drift even when its identity is reused", async () => {
    const value = repository();
    const preparation = await meaningfulPreparation(value, "same_identity_drift");
    const beforeDrift = await value.get(projectId);
    const current = beforeDrift.snapshots.find(
      (snapshot) => snapshot.id === beforeDrift.project.draftSnapshotId,
    )!;
    const rewritten = structuredClone(current);
    rewritten.pages[0].title.en = "Same identity, different prepared content";
    await value.saveDraft(projectId, rewritten, {
      id: current.id,
      revision: current.revision,
    });
    const afterDrift = await value.get(projectId);

    await expect(confirmPublish(preparation, value)).rejects.toBeInstanceOf(
      StalePublishPreparationError,
    );
    expect(await value.get(projectId)).toEqual(afterDrift);
  });

  it("rejects canonical published-base drift before calling publish", async () => {
    const value = repository();
    const preparation = await meaningfulPreparation(value, "published_content_drift");
    const before = await value.get(projectId);
    const publish = vi.spyOn(value, "publish");
    const drifting: ProjectRepository = {
      list: () => value.list(),
      get: async (id) => {
        const aggregate = await value.get(id);
        const published = aggregate.snapshots.find(
          (snapshot) => snapshot.id === aggregate.project.publishedSnapshotId,
        )!;
        published.pages[0].title.en = "Concurrent published content";
        return aggregate;
      },
      saveDraft: (id, snapshot, expected) => value.saveDraft(id, snapshot, expected),
      publish: (id, expectation) => value.publish(id, expectation),
      restore: (id, snapshotId) => value.restore(id, snapshotId),
    };

    await expect(confirmPublish(preparation, drifting)).rejects.toBeInstanceOf(
      StalePublishPreparationError,
    );
    expect(publish).not.toHaveBeenCalled();
    expect(await value.get(projectId)).toEqual(before);
  });

  it("rejects a same-identity mutation racing between confirmation read and atomic publish", async () => {
    const value = repository();
    const preparation = await meaningfulPreparation(value, "atomic_content_race");
    const racing: ProjectRepository = {
      list: () => value.list(),
      get: (id) => value.get(id),
      saveDraft: (id, snapshot, expected) => value.saveDraft(id, snapshot, expected),
      publish: async (id, expectation) => {
        const aggregate = await value.get(id);
        const current = aggregate.snapshots.find(
          (snapshot) => snapshot.id === aggregate.project.draftSnapshotId,
        )!;
        const rewritten = structuredClone(current);
        rewritten.pages[0].title.en = "Concurrent same-identity save";
        await value.saveDraft(id, rewritten, {
          id: current.id,
          revision: current.revision,
        });
        return value.publish(id, expectation);
      },
      restore: (id, snapshotId) => value.restore(id, snapshotId),
    };

    await expect(confirmPublish(preparation, racing)).rejects.toBeInstanceOf(
      StalePublishPreparationError,
    );
    const after = await value.get(projectId);
    expect(after.project.publishedSnapshotId).toBe(preparation.expectedPublished.id);
    expect(
      after.snapshots.find((snapshot) => snapshot.id === after.project.draftSnapshotId)?.pages[0]
        .title.en,
    ).toBe("Concurrent same-identity save");
  });

  it("allows two preparations but only the first current confirmation succeeds", async () => {
    const value = repository();
    await saveChangedDraft(value, "two_preparations");
    const first = await preparePublish(projectId, value, {
      now: () => preparedAt,
      createPreparationId: () => "publish_preparation_first",
    });
    const second = await preparePublish(projectId, value, {
      now: () => new Date(preparedAt.getTime() + 1_000),
      createPreparationId: () => "publish_preparation_second",
    });

    await confirmPublish(first, value);
    const afterFirst = await value.get(projectId);
    await expect(confirmPublish(second, value)).rejects.toBeInstanceOf(
      StalePublishPreparationError,
    );
    expect(await value.get(projectId)).toEqual(afterFirst);
  });

  it("rejects a preparation after another publish and later allows a fresh publish", async () => {
    const value = repository();
    await saveChangedDraft(value, "published_base_stale");
    const stale = await preparePublish(projectId, value, {
      createPreparationId: () => "publish_preparation_stale_published",
    });
    const current = await preparePublish(projectId, value, {
      createPreparationId: () => "publish_preparation_current_published",
    });
    await confirmPublish(current, value);
    const afterConcurrentPublish = await value.get(projectId);

    await expect(confirmPublish(stale, value)).rejects.toBeInstanceOf(StalePublishPreparationError);
    expect(await value.get(projectId)).toEqual(afterConcurrentPublish);

    await saveChangedDraft(value, "fresh_after_stale");
    const fresh = await preparePublish(projectId, value, {
      createPreparationId: () => "publish_preparation_fresh_after_stale",
    });
    const result = await confirmPublish(fresh, value);
    expect(result.aggregate.project.revision).toBe(afterConcurrentPublish.project.revision + 1);
  });

  it("retains protected commerce values and every previous published snapshot", async () => {
    const value = repository();
    const protectedBefore = structuredClone(aurumNordicSeed.catalogue.products).map(
      ({ id, sku, price, stockStatus, images }) => ({ id, sku, price, stockStatus, images }),
    );
    const publishedIds = new Set([aurumNordicSeed.project.publishedSnapshotId]);

    for (let index = 1; index <= 3; index += 1) {
      await saveChangedDraft(value, `history_${index}`);
      const preparation = await preparePublish(projectId, value, {
        createPreparationId: () => `publish_preparation_history_${index}`,
      });
      const result = await confirmPublish(preparation, value);
      publishedIds.add(result.publishedSnapshot.id);
    }

    const after = await value.get(projectId);
    expect(after.snapshots.map(({ id }) => id)).toEqual(expect.arrayContaining([...publishedIds]));
    expect(
      after.catalogue.products.map(({ id, sku, price, stockStatus, images }) => ({
        id,
        sku,
        price,
        stockStatus,
        images,
      })),
    ).toEqual(protectedBefore);
  });
});
