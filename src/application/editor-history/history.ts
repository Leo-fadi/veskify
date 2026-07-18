import { pageModelSchema, type PageModel } from "@/domain/storefront";
import {
  applyCanonicalCommands,
  deriveCanonicalCommandTransaction,
  type CanonicalCommandTransaction,
  type CanonicalPageValidator,
} from "./commands";

type PageHistory = {
  current: PageModel;
  past: CanonicalCommandTransaction[];
  future: CanonicalCommandTransaction[];
};

export type CanonicalEditorHistoryOptions = {
  maxEntries?: number;
  validatePage?: CanonicalPageValidator;
};

const clonePage = (page: PageModel) => structuredClone(page);
const cloneTransaction = (transaction: CanonicalCommandTransaction) => structuredClone(transaction);
const pagesEqual = (left: PageModel, right: PageModel) =>
  JSON.stringify(left) === JSON.stringify(right);

export class CanonicalEditorHistory {
  readonly #maxEntries: number;
  readonly #validatePage: CanonicalPageValidator;
  readonly #pages = new Map<string, PageHistory>();

  constructor(options: CanonicalEditorHistoryOptions = {}) {
    const { maxEntries = 50, validatePage = (page) => pageModelSchema.parse(page) } = options;
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("Canonical editor history requires at least one transaction entry.");
    }
    this.#maxEntries = maxEntries;
    this.#validatePage = validatePage;
  }

  #validated(page: unknown) {
    return clonePage(this.#validatePage(structuredClone(page)));
  }

  #history(pageId: string) {
    const history = this.#pages.get(pageId);
    if (!history) throw new Error(`Editor history is not initialized for page ${pageId}.`);
    return history;
  }

  initialize(pageInput: unknown) {
    const page = this.#validated(pageInput);
    this.#pages.set(page.id, { current: clonePage(page), past: [], future: [] });
    return clonePage(page);
  }

  current(pageId: string) {
    return clonePage(this.#history(pageId).current);
  }

  inspectTransactions(pageId: string) {
    const history = this.#history(pageId);
    return {
      past: history.past.map(cloneTransaction),
      future: history.future.map(cloneTransaction),
    };
  }

  canUndo(pageId: string) {
    return this.#history(pageId).past.length > 0;
  }

  canRedo(pageId: string) {
    return this.#history(pageId).future.length > 0;
  }

  commit(pageInput: unknown, label = "Edit page") {
    const page = this.#validated(pageInput);
    const history = this.#history(page.id);
    if (pagesEqual(page, history.current)) return clonePage(history.current);
    return this.commitTransaction(deriveCanonicalCommandTransaction(history.current, page, label));
  }

  commitTransaction(transactionInput: CanonicalCommandTransaction) {
    const transaction = cloneTransaction(transactionInput);
    const history = this.#history(transaction.pageId);
    if (
      !transaction.label.trim() ||
      transaction.forward.length === 0 ||
      transaction.inverse.length === 0
    ) {
      throw new Error("A history transaction requires a label and forward and inverse commands.");
    }

    const next = applyCanonicalCommands(history.current, transaction.forward, this.#validatePage);
    const reverted = applyCanonicalCommands(next, transaction.inverse, this.#validatePage);
    if (!pagesEqual(reverted, history.current)) {
      throw new Error("The inverse commands do not restore the previous canonical page.");
    }

    history.past.push(transaction);
    if (history.past.length > this.#maxEntries) {
      history.past.splice(0, history.past.length - this.#maxEntries);
    }
    history.current = clonePage(next);
    history.future = [];
    return clonePage(history.current);
  }

  undo(pageId: string) {
    const history = this.#history(pageId);
    const transaction = history.past.at(-1);
    if (!transaction) return undefined;
    const previous = applyCanonicalCommands(
      history.current,
      transaction.inverse,
      this.#validatePage,
    );
    history.past.pop();
    history.future.unshift(transaction);
    history.current = clonePage(previous);
    return clonePage(history.current);
  }

  redo(pageId: string) {
    const history = this.#history(pageId);
    const transaction = history.future[0];
    if (!transaction) return undefined;
    const next = applyCanonicalCommands(history.current, transaction.forward, this.#validatePage);
    history.future.shift();
    history.past.push(transaction);
    history.current = clonePage(next);
    return clonePage(history.current);
  }

  reset(pageInput: unknown) {
    const page = this.#validated(pageInput);
    const history = this.#history(page.id);
    history.current = clonePage(page);
    history.past = [];
    history.future = [];
    return clonePage(history.current);
  }

  rebase(pageInput: unknown) {
    const page = this.#validated(pageInput);
    const history = this.#pages.get(page.id);
    if (!history) return this.initialize(page);
    history.current = clonePage(page);
    return clonePage(history.current);
  }
}
