import { describe, expect, it } from "vitest";
import {
  canDuplicateSection,
  canToggleSectionVisibility,
  CanonicalEditorHistory,
  duplicateCanonicalSection,
  setCanonicalSectionVisibility,
  UnsafeSectionActionError,
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

function renamed(page: PageModel, title: string) {
  return { ...structuredClone(page), title: { ...page.title, en: title } };
}

describe("canonical editor history", () => {
  it("initializes validated pages without leaking mutable references", () => {
    const input = structuredClone(homepage);
    const history = new CanonicalEditorHistory({ validatePage: validator });
    const initialized = history.initialize(input);
    input.title.en = "Mutated input";
    initialized.title.en = "Mutated return value";

    expect(history.current(homepage.id)).toEqual(homepage);
    const current = history.current(homepage.id);
    current.sections[0].visible = !current.sections[0].visible;
    expect(history.current(homepage.id)).toEqual(homepage);
  });

  it("commits, undoes and redoes canonical page values", () => {
    const history = new CanonicalEditorHistory({ validatePage: validator });
    history.initialize(homepage);
    const edited = renamed(homepage, "Edited homepage");
    history.commit(edited);

    expect(history.canUndo(homepage.id)).toBe(true);
    expect(history.undo(homepage.id)).toEqual(homepage);
    expect(history.canRedo(homepage.id)).toBe(true);
    expect(history.redo(homepage.id)).toEqual(edited);
  });

  it("clears redo when a divergent page is committed after undo", () => {
    const history = new CanonicalEditorHistory({ validatePage: validator });
    history.initialize(homepage);
    history.commit(renamed(homepage, "First edit"));
    history.commit(renamed(homepage, "Second edit"));
    history.undo(homepage.id);
    history.commit(renamed(homepage, "Different edit"));

    expect(history.canRedo(homepage.id)).toBe(false);
    expect(history.current(homepage.id).title.en).toBe("Different edit");
  });

  it("bounds retained page history", () => {
    const history = new CanonicalEditorHistory({ maxEntries: 3, validatePage: validator });
    history.initialize(homepage);
    for (const title of ["One", "Two", "Three", "Four"]) {
      history.commit(renamed(homepage, title));
    }

    expect(history.undo(homepage.id)?.title.en).toBe("Three");
    expect(history.undo(homepage.id)?.title.en).toBe("Two");
    expect(history.undo(homepage.id)).toBeUndefined();
  });

  it("keeps page histories isolated", () => {
    const history = new CanonicalEditorHistory({ validatePage: validator });
    history.initialize(homepage);
    history.initialize(collectionPage);
    history.commit(renamed(homepage, "Edited homepage"));

    expect(history.canUndo(homepage.id)).toBe(true);
    expect(history.canUndo(collectionPage.id)).toBe(false);
    expect(history.current(collectionPage.id)).toEqual(collectionPage);
  });

  it("rejects invalid pages without changing current history", () => {
    const history = new CanonicalEditorHistory({ validatePage: validator });
    history.initialize(homepage);
    expect(() =>
      history.commit({
        ...structuredClone(homepage),
        sections: [{ ...homepage.sections[0], component: "unknownComponent" }],
      }),
    ).toThrow();
    expect(history.current(homepage.id)).toEqual(homepage);
    expect(history.canUndo(homepage.id)).toBe(false);
  });

  it("resets to the saved baseline and rebases after save without discarding prior history", () => {
    const history = new CanonicalEditorHistory({ validatePage: validator });
    history.initialize(homepage);
    const saved = renamed(homepage, "Saved edit");
    history.commit(saved);
    history.rebase(saved);

    expect(history.baseline(homepage.id)).toEqual(saved);
    expect(history.undo(homepage.id)).toEqual(homepage);
    expect(history.redo(homepage.id)).toEqual(saved);
    history.undo(homepage.id);
    expect(history.reset(homepage.id)).toEqual(saved);
    expect(history.canUndo(homepage.id)).toBe(false);
    expect(history.canRedo(homepage.id)).toBe(false);
  });
});

describe("canonical section actions", () => {
  it("duplicates with unique stable IDs immediately after the source", () => {
    const source = homepage.sections.find((section) => section.component === "hero")!;
    const first = duplicateCanonicalSection({
      page: homepage,
      sectionId: source.id,
      context,
    });
    const duplicate =
      first.sections[first.sections.findIndex((section) => section.id === source.id) + 1];
    const second = duplicateCanonicalSection({
      page: first,
      sectionId: source.id,
      context,
    });

    expect(duplicate.id).toBe(`${source.id}_copy`);
    expect({ ...duplicate, id: source.id }).toEqual(source);
    expect(second.sections.map((section) => section.id)).toContain(`${source.id}_copy_2`);
    expect(new Set(second.sections.map((section) => section.id)).size).toBe(second.sections.length);
  });

  it("guards required single-instance sections from duplication or hiding", () => {
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

  it("hides and shows a section without changing its content, props or identity", () => {
    const source = homepage.sections.find((section) => section.component === "hero")!;
    const hiddenPage = setCanonicalSectionVisibility({
      page: homepage,
      sectionId: source.id,
      visible: false,
      context,
    });
    const hidden = hiddenPage.sections.find((section) => section.id === source.id)!;
    const shownPage = setCanonicalSectionVisibility({
      page: hiddenPage,
      sectionId: source.id,
      visible: true,
      context,
    });

    expect(hidden).toEqual({ ...source, visible: false });
    expect(shownPage.sections.find((section) => section.id === source.id)).toEqual(source);
    expect(homepage.sections.find((section) => section.id === source.id)).toEqual(source);
  });
});
