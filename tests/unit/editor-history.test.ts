import { describe, expect, it } from "vitest";
import {
  applyCanonicalCommands,
  canDuplicateSection,
  canToggleSectionVisibility,
  CanonicalEditorHistory,
  createDuplicateSectionTransaction,
  createSectionVisibilityTransaction,
  deriveCanonicalCommandTransaction,
  duplicateCanonicalSection,
  setCanonicalSectionVisibility,
  UnsafeSectionActionError,
  type CanonicalCommandTransaction,
} from "@/application/editor-history";
import { createStorefrontRenderContext, validateRegisteredPage } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import type { PageModel } from "@/domain/storefront";

const draft = aurumNordicSeed.draftSnapshot;
const homepage = draft.pages.find((page) => page.type === "home")!;
const collectionPage = draft.pages.find((page) => page.type === "collection")!;
const context = createStorefrontRenderContext({
  activeLocale: "en",
  primaryLocale: "en",
  catalogue: aurumNordicSeed.catalogue,
  snapshot: draft,
});
const validator = (page: unknown) => validateRegisteredPage(page, context);

function history(options: { maxEntries?: number } = {}) {
  return new CanonicalEditorHistory({ ...options, validatePage: validator });
}

function renamed(page: PageModel, title: string) {
  return { ...structuredClone(page), title: { ...page.title, en: title } };
}

describe("canonical command transactions", () => {
  it("stores bounded commands rather than page snapshots and keeps payloads immutable", () => {
    const value = history();
    value.initialize(homepage);
    const edited = renamed(homepage, "Edited homepage");
    value.commit(edited, "Rename homepage");
    edited.title.en = "Mutated caller value";

    const transaction = value.inspectTransactions(homepage.id).past[0];
    expect(Object.keys(transaction).sort()).toEqual(["forward", "inverse", "label", "pageId"]);
    expect(transaction.label).toBe("Rename homepage");
    expect(transaction.forward).toEqual([
      { type: "patchPageMetadata", patch: { title: { en: "Edited homepage", fi: "Etusivu" } } },
    ]);
    expect(transaction.inverse[0].type).toBe("patchPageMetadata");
    expect(transaction.forward.every((command) => !("sections" in command))).toBe(true);
    transaction.forward.length = 0;
    expect(value.inspectTransactions(homepage.id).past[0].forward).toHaveLength(1);
    expect(value.current(homepage.id).title.en).toBe("Edited homepage");
  });

  it("records valid explicit forward and inverse commands", () => {
    const edited = renamed(homepage, "Command-based homepage");
    const transaction = deriveCanonicalCommandTransaction(homepage, edited, "Rename homepage");
    const forward = applyCanonicalCommands(homepage, transaction.forward, validator);
    const inverse = applyCanonicalCommands(forward, transaction.inverse, validator);

    expect(forward).toEqual(edited);
    expect(inverse).toEqual(homepage);
  });

  it("undoes and redoes manual section content and variant edits", () => {
    const value = history();
    value.initialize(homepage);
    const edited = structuredClone(homepage);
    const categories = edited.sections.find(
      (section) => section.component === "featuredCategories",
    )!;
    categories.variant = "grid";
    categories.content = {
      ...categories.content,
      heading: { en: "Shop by story", fi: "Valitse tarina" },
    };

    value.commit(edited, "Edit featured categories");
    expect(value.inspectTransactions(homepage.id).past[0].forward).toEqual([
      { type: "replaceSection", sectionId: categories.id, section: categories },
    ]);
    expect(value.undo(homepage.id)).toEqual(homepage);
    expect(value.redo(homepage.id)).toEqual(edited);
  });

  it("inverts insert, remove and reorder commands", () => {
    const value = history();
    value.initialize(homepage);
    const edited = structuredClone(homepage);
    const removed = edited.sections.splice(5, 1)[0];
    const inserted = structuredClone(removed);
    inserted.id = "section_home_campaign_replacement";
    edited.sections.splice(2, 0, inserted);
    edited.sections = [edited.sections.at(-1)!, ...edited.sections.slice(0, -1)];

    value.commit(edited, "Reshape homepage sections");
    const types = value
      .inspectTransactions(homepage.id)
      .past[0].forward.map((command) => command.type);
    expect(types).toEqual(["removeSection", "insertSection", "reorderSections"]);
    expect(value.undo(homepage.id)).toEqual(homepage);
    expect(value.redo(homepage.id)).toEqual(edited);
  });

  it("commits duplicate and visibility as direct invertible transactions", () => {
    const value = history();
    value.initialize(homepage);
    const hero = homepage.sections.find((section) => section.component === "hero")!;
    const duplicate = createDuplicateSectionTransaction({ page: homepage, sectionId: hero.id });
    const duplicated = value.commitTransaction(duplicate);
    expect(value.inspectTransactions(homepage.id).past[0]).toEqual(duplicate);
    expect(duplicated.sections).toHaveLength(homepage.sections.length + 1);
    expect(value.undo(homepage.id)).toEqual(homepage);
    expect(value.redo(homepage.id)).toEqual(duplicated);

    const visibility = createSectionVisibilityTransaction({
      page: duplicated,
      sectionId: hero.id,
      visible: false,
    });
    const hidden = value.commitTransaction(visibility);
    expect(hidden.sections.find((section) => section.id === hero.id)?.visible).toBe(false);
    expect(value.undo(homepage.id)).toEqual(duplicated);
    expect(value.redo(homepage.id)).toEqual(hidden);
  });

  it("keeps multiple changes in one manual handoff atomic", () => {
    const value = history();
    value.initialize(homepage);
    const edited = renamed(homepage, "One atomic handoff");
    edited.sections[2] = { ...edited.sections[2], visible: false };
    edited.sections = [
      edited.sections[0],
      edited.sections[2],
      edited.sections[1],
      ...edited.sections.slice(3),
    ];

    value.commit(edited, "Apply Puck handoff");
    expect(value.inspectTransactions(homepage.id).past).toHaveLength(1);
    expect(value.inspectTransactions(homepage.id).past[0].forward.length).toBeGreaterThan(1);
    expect(value.undo(homepage.id)).toEqual(homepage);
    expect(value.redo(homepage.id)).toEqual(edited);
  });

  it("keeps a multi-change accepted proposal atomic", () => {
    const value = history();
    value.initialize(homepage);
    const proposal = renamed(homepage, "Proposed homepage");
    proposal.sections[2] = {
      ...proposal.sections[2],
      content: { ...proposal.sections[2].content, body: { en: "Proposed body", fi: "Ehdotettu" } },
    };
    proposal.sections[3] = { ...proposal.sections[3], visible: false };

    value.commit(proposal, "Apply design proposal");
    const transactions = value.inspectTransactions(homepage.id).past;
    expect(transactions).toHaveLength(1);
    expect(transactions[0].label).toBe("Apply design proposal");
    expect(value.undo(homepage.id)).toEqual(homepage);
    expect(value.redo(homepage.id)).toEqual(proposal);
  });

  it("rolls back invalid forward and inverse transactions completely", () => {
    const value = history();
    value.initialize(homepage);
    const invalidForward: CanonicalCommandTransaction = {
      pageId: homepage.id,
      label: "Invalid forward",
      forward: [{ type: "removeSection", index: 0, sectionId: "missing_section" }],
      inverse: [
        { type: "reorderSections", sectionIds: homepage.sections.map((section) => section.id) },
      ],
    };
    expect(() => value.commitTransaction(invalidForward)).toThrow();
    expect(value.current(homepage.id)).toEqual(homepage);
    expect(value.inspectTransactions(homepage.id)).toEqual({ past: [], future: [] });

    const invalidInverse: CanonicalCommandTransaction = {
      pageId: homepage.id,
      label: "Invalid inverse",
      forward: [{ type: "patchPageMetadata", patch: { title: { en: "Changed", fi: "Muutos" } } }],
      inverse: [{ type: "removeSection", index: 0, sectionId: "missing_section" }],
    };
    expect(() => value.commitTransaction(invalidInverse)).toThrow();
    expect(value.current(homepage.id)).toEqual(homepage);
    expect(value.inspectTransactions(homepage.id)).toEqual({ past: [], future: [] });
  });

  it("leaves current page and stacks unchanged when Undo or Redo validation fails", () => {
    let rejectedTitle: string | undefined;
    const guardedValidator = (page: unknown) => {
      const validated = validator(page);
      if (validated.title.en === rejectedTitle) throw new Error("Rejected history result");
      return validated;
    };
    const value = new CanonicalEditorHistory({ validatePage: guardedValidator });
    value.initialize(homepage);
    const edited = renamed(homepage, "Edited for guarded history");
    value.commit(edited);

    rejectedTitle = homepage.title.en;
    const beforeFailedUndo = value.inspectTransactions(homepage.id);
    expect(() => value.undo(homepage.id)).toThrow("Rejected history result");
    expect(value.current(homepage.id)).toEqual(edited);
    expect(value.inspectTransactions(homepage.id)).toEqual(beforeFailedUndo);

    rejectedTitle = undefined;
    expect(value.undo(homepage.id)).toEqual(homepage);
    rejectedTitle = edited.title.en;
    const beforeFailedRedo = value.inspectTransactions(homepage.id);
    expect(() => value.redo(homepage.id)).toThrow("Rejected history result");
    expect(value.current(homepage.id)).toEqual(homepage);
    expect(value.inspectTransactions(homepage.id)).toEqual(beforeFailedRedo);
  });

  it("clears redo after a divergent transaction", () => {
    const value = history();
    value.initialize(homepage);
    value.commit(renamed(homepage, "First edit"));
    value.commit(renamed(homepage, "Second edit"));
    value.undo(homepage.id);
    value.commit(renamed(homepage, "Different edit"));
    expect(value.canRedo(homepage.id)).toBe(false);
  });

  it("bounds transaction history and keeps pages isolated", () => {
    const value = history({ maxEntries: 3 });
    value.initialize(homepage);
    value.initialize(collectionPage);
    for (const title of ["One", "Two", "Three", "Four"]) {
      value.commit(renamed(homepage, title));
    }
    expect(value.inspectTransactions(homepage.id).past).toHaveLength(3);
    expect(value.undo(homepage.id)?.title.en).toBe("Three");
    expect(value.undo(homepage.id)?.title.en).toBe("Two");
    expect(value.undo(homepage.id)?.title.en).toBe("One");
    expect(value.undo(homepage.id)).toBeUndefined();
    expect(value.current(collectionPage.id)).toEqual(collectionPage);
    expect(value.canUndo(collectionPage.id)).toBe(false);
  });

  it("rebases after Save without discarding command history and resets on Discard", () => {
    const value = history();
    value.initialize(homepage);
    const saved = renamed(homepage, "Saved edit");
    value.commit(saved);
    value.rebase(saved);
    expect(value.undo(homepage.id)).toEqual(homepage);
    expect(value.redo(homepage.id)).toEqual(saved);
    expect(value.reset(saved)).toEqual(saved);
    expect(value.inspectTransactions(homepage.id)).toEqual({ past: [], future: [] });
  });
});

describe("canonical section action guards", () => {
  it("duplicates with unique stable IDs immediately after the source", () => {
    const source = homepage.sections.find((section) => section.component === "hero")!;
    const first = duplicateCanonicalSection({ page: homepage, sectionId: source.id, context });
    const duplicate =
      first.sections[first.sections.findIndex((section) => section.id === source.id) + 1];
    const second = duplicateCanonicalSection({ page: first, sectionId: source.id, context });
    expect(duplicate.id).toBe(`${source.id}_copy`);
    expect({ ...duplicate, id: source.id }).toEqual(source);
    expect(second.sections.map((section) => section.id)).toContain(`${source.id}_copy_2`);
  });

  it("blocks hiding and duplicating visible required sections", () => {
    for (const component of ["header", "footer"]) {
      const section = homepage.sections.find((candidate) => candidate.component === component)!;
      expect(canDuplicateSection(section)).toBe(false);
      expect(canToggleSectionVisibility(section)).toBe(false);
      expect(() =>
        duplicateCanonicalSection({ page: homepage, sectionId: section.id, context }),
      ).toThrow(UnsafeSectionActionError);
      expect(() =>
        setCanonicalSectionVisibility({
          page: homepage,
          sectionId: section.id,
          visible: false,
          context,
        }),
      ).toThrow(UnsafeSectionActionError);
    }
  });

  it("allows a legacy-hidden required section to be shown with undo and redo", () => {
    const legacyPage = structuredClone(homepage);
    const header = legacyPage.sections.find((section) => section.component === "header")!;
    header.visible = false;
    validator(legacyPage);
    expect(canDuplicateSection(header)).toBe(false);
    expect(canToggleSectionVisibility(header)).toBe(true);
    const value = history();
    value.initialize(legacyPage);
    const transaction = createSectionVisibilityTransaction({
      page: legacyPage,
      sectionId: header.id,
      visible: true,
    });
    const shown = value.commitTransaction(transaction);
    expect(shown.sections.find((section) => section.id === header.id)?.visible).toBe(true);
    expect(value.undo(homepage.id)).toEqual(legacyPage);
    expect(value.redo(homepage.id)).toEqual(shown);
  });

  it("continues to hide and show ordinary optional sections", () => {
    const source = homepage.sections.find((section) => section.component === "hero")!;
    expect(canToggleSectionVisibility(source)).toBe(true);
    const hidden = setCanonicalSectionVisibility({
      page: homepage,
      sectionId: source.id,
      visible: false,
      context,
    });
    const shown = setCanonicalSectionVisibility({
      page: hidden,
      sectionId: source.id,
      visible: true,
      context,
    });
    expect(shown.sections.find((section) => section.id === source.id)).toEqual(source);
  });
});
