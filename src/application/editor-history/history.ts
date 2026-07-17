import { pageModelSchema, type PageModel } from "@/domain/storefront";

export type CanonicalPageValidator = (page: unknown) => PageModel;

type PageHistory = {
  baseline: PageModel;
  past: PageModel[];
  current: PageModel;
  future: PageModel[];
};

export type CanonicalEditorHistoryOptions = {
  maxEntries?: number;
  validatePage?: CanonicalPageValidator;
};

const clone = (page: PageModel) => structuredClone(page);
const pagesEqual = (left: PageModel, right: PageModel) =>
  JSON.stringify(left) === JSON.stringify(right);

export class CanonicalEditorHistory {
  readonly #maxEntries: number;
  readonly #validatePage: CanonicalPageValidator;
  readonly #pages = new Map<string, PageHistory>();

  constructor(options: CanonicalEditorHistoryOptions = {}) {
    const { maxEntries = 50, validatePage = (page) => pageModelSchema.parse(page) } = options;
    if (!Number.isInteger(maxEntries) || maxEntries < 2) {
      throw new Error("Canonical editor history requires at least two entries.");
    }
    this.#maxEntries = maxEntries;
    this.#validatePage = validatePage;
  }

  #validated(page: unknown) {
    return clone(this.#validatePage(structuredClone(page)));
  }

  #history(pageId: string) {
    const history = this.#pages.get(pageId);
    if (!history) throw new Error(`Editor history is not initialized for page ${pageId}.`);
    return history;
  }

  initialize(pageInput: unknown) {
    const page = this.#validated(pageInput);
    this.#pages.set(page.id, {
      baseline: clone(page),
      past: [],
      current: clone(page),
      future: [],
    });
    return clone(page);
  }

  current(pageId: string) {
    return clone(this.#history(pageId).current);
  }

  baseline(pageId: string) {
    return clone(this.#history(pageId).baseline);
  }

  canUndo(pageId: string) {
    return this.#history(pageId).past.length > 0;
  }

  canRedo(pageId: string) {
    return this.#history(pageId).future.length > 0;
  }

  commit(pageInput: unknown) {
    const page = this.#validated(pageInput);
    const history = this.#history(page.id);
    if (pagesEqual(page, history.current)) return clone(history.current);
    history.past.push(clone(history.current));
    if (history.past.length >= this.#maxEntries) {
      history.past.splice(0, history.past.length - this.#maxEntries + 1);
    }
    history.current = clone(page);
    history.future = [];
    return clone(history.current);
  }

  undo(pageId: string) {
    const history = this.#history(pageId);
    const previous = history.past.pop();
    if (!previous) return undefined;
    history.future.unshift(clone(history.current));
    history.current = clone(previous);
    return clone(history.current);
  }

  redo(pageId: string) {
    const history = this.#history(pageId);
    const next = history.future.shift();
    if (!next) return undefined;
    history.past.push(clone(history.current));
    history.current = clone(next);
    return clone(history.current);
  }

  reset(pageId: string) {
    const history = this.#history(pageId);
    history.current = clone(history.baseline);
    history.past = [];
    history.future = [];
    return clone(history.current);
  }

  rebase(pageInput: unknown) {
    const page = this.#validated(pageInput);
    const history = this.#pages.get(page.id);
    if (!history) return this.initialize(page);
    history.baseline = clone(page);
    history.current = clone(page);
    return clone(history.current);
  }
}
