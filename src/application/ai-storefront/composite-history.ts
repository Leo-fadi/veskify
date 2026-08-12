import { brandSystemSchema, type BrandSystem } from "@/domain/design-system";
import { idSchema, isoDateTimeSchema, localizedTextSchema } from "@/domain/shared";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  contentSupportFactDocumentSchema,
  dynamicCommercePresentationAuthoritySchema,
  navigationModelSchema,
  pageModelSchema,
  sharedFrameModelSchema,
  storefrontSnapshotSchema,
  type PageModel,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { z } from "zod";
import type { AiStorefrontReadyProposal } from "./contract";

const storefrontFingerprintSchema = z.string().regex(/^v1_\d+_[0-9a-f]{64}$/);

export const unaffectedStorefrontPageFingerprintSchema = z
  .object({
    pageId: idSchema,
    fingerprint: storefrontFingerprintSchema,
  })
  .strict();

const compositeStorefrontStructuralTransitionSchema = z
  .object({
    originalPageOrder: z.array(idSchema).min(1),
    resultingPageOrder: z.array(idSchema).min(1),
    originalNavigation: navigationModelSchema,
    resultingNavigation: navigationModelSchema,
    originalSharedFrame: sharedFrameModelSchema.optional(),
    resultingSharedFrame: sharedFrameModelSchema.optional(),
    originalDynamicCommercePresentation: dynamicCommercePresentationAuthoritySchema.optional(),
    resultingDynamicCommercePresentation: dynamicCommercePresentationAuthoritySchema.optional(),
    originalContentSupportFactDocuments: z.array(contentSupportFactDocumentSchema).optional(),
    resultingContentSupportFactDocuments: z.array(contentSupportFactDocumentSchema).optional(),
  })
  .strict();

export const compositeStorefrontHistoryTransactionSchema = z
  .object({
    transactionId: idSchema,
    proposalId: z.string().regex(/^storefront_proposal_[a-f0-9]{8}$/),
    projectId: idSchema,
    draftSnapshotId: idSchema,
    draftRevision: z.number().int().nonnegative(),
    acceptedAt: isoDateTimeSchema,
    summary: localizedTextSchema,
    affectedPageIds: z.array(idSchema).min(1),
    originalAffectedPages: z.array(pageModelSchema),
    resultingAffectedPages: z.array(pageModelSchema),
    originalDesignSystem: brandSystemSchema,
    resultingDesignSystem: brandSystemSchema,
    unaffectedPages: z.array(unaffectedStorefrontPageFingerprintSchema),
    structuralTransition: compositeStorefrontStructuralTransitionSchema.optional(),
    originalStorefrontFingerprint: storefrontFingerprintSchema,
    resultingStorefrontFingerprint: storefrontFingerprintSchema,
  })
  .strict()
  .superRefine((transaction, context) => {
    const affected = transaction.affectedPageIds;
    if (new Set(affected).size !== affected.length) {
      context.addIssue({
        code: "custom",
        path: ["affectedPageIds"],
        message: "Composite history affected page IDs must be unique.",
      });
    }
    if (transaction.structuralTransition) {
      for (const [key, pages, order] of [
        [
          "originalAffectedPages",
          transaction.originalAffectedPages,
          transaction.structuralTransition.originalPageOrder,
        ],
        [
          "resultingAffectedPages",
          transaction.resultingAffectedPages,
          transaction.structuralTransition.resultingPageOrder,
        ],
      ] as const) {
        if (
          pages.length !== order.length ||
          pages.some((page, index) => page.id !== order[index]) ||
          new Set(order).size !== order.length
        ) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "Structural history pages must match their exact canonical page order.",
          });
        }
      }
      if (transaction.unaffectedPages.length !== 0) {
        context.addIssue({
          code: "custom",
          path: ["unaffectedPages"],
          message: "Structural history transitions cannot declare unaffected page projections.",
        });
      }
      return;
    }
    for (const [key, pages] of [
      ["originalAffectedPages", transaction.originalAffectedPages],
      ["resultingAffectedPages", transaction.resultingAffectedPages],
    ] as const) {
      if (
        pages.length !== affected.length ||
        pages.some((page, index) => page.id !== affected[index])
      ) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Composite history pages must match the ordered affected page identities.",
        });
      }
    }
    const unaffectedIds = transaction.unaffectedPages.map((page) => page.pageId);
    if (new Set(unaffectedIds).size !== unaffectedIds.length) {
      context.addIssue({
        code: "custom",
        path: ["unaffectedPages"],
        message: "Composite history unaffected page identities must be unique.",
      });
    }
  });

export type CompositeStorefrontHistoryTransaction = z.infer<
  typeof compositeStorefrontHistoryTransactionSchema
>;

export type StorefrontSnapshotValidator = (snapshot: unknown) => StorefrontSnapshot;

export type CanonicalStorefrontHistoryOptions = {
  maxEntries?: number;
  validateSnapshot?: StorefrontSnapshotValidator;
};

type StorefrontHistoryState = {
  current: StorefrontSnapshot;
  past: CompositeStorefrontHistoryTransaction[];
  future: CompositeStorefrontHistoryTransaction[];
};

export class CompositeStorefrontHistoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CompositeStorefrontHistoryError";
  }
}

const cloneSnapshot = (snapshot: StorefrontSnapshot) => structuredClone(snapshot);
const cloneTransaction = (transaction: CompositeStorefrontHistoryTransaction) =>
  structuredClone(transaction);

function pageFingerprint(page: PageModel) {
  return canonicalValueFingerprint(page);
}

function unaffectedPages(snapshot: StorefrontSnapshot, affectedPageIds: readonly string[]) {
  const affected = new Set(affectedPageIds);
  return snapshot.pages
    .filter((page) => !affected.has(page.id))
    .map((page) => ({ pageId: page.id, fingerprint: pageFingerprint(page) }));
}

function assertUnchangedPages(
  snapshot: StorefrontSnapshot,
  expected: readonly { pageId: string; fingerprint: string }[],
) {
  const actual = expected.map(({ pageId }) => {
    const page = snapshot.pages.find((candidate) => candidate.id === pageId);
    if (!page) throw new CompositeStorefrontHistoryError("An unaffected page is missing.");
    return { pageId, fingerprint: pageFingerprint(page) };
  });
  if (canonicalValueString(actual) !== canonicalValueString(expected)) {
    throw new CompositeStorefrontHistoryError(
      "Composite history cannot change an unaffected storefront page.",
    );
  }
}

function stableTransactionId(proposalId: string, acceptedAt: string, originalFingerprint: string) {
  return `storefront_transaction_${canonicalValueFingerprint({
    proposalId,
    acceptedAt,
    originalFingerprint,
  })
    .split("_")
    .at(-1)!
    .slice(0, 12)}`;
}

export function deriveCompositeStorefrontHistoryTransaction({
  original: originalInput,
  resulting: resultingInput,
  proposal,
  acceptedAt,
  transactionId,
}: {
  original: StorefrontSnapshot;
  resulting: StorefrontSnapshot;
  proposal: AiStorefrontReadyProposal;
  acceptedAt: string;
  transactionId?: string;
}): CompositeStorefrontHistoryTransaction {
  const original = storefrontSnapshotSchema.parse(structuredClone(originalInput));
  const resulting = storefrontSnapshotSchema.parse(structuredClone(resultingInput));
  if (
    original.id !== resulting.id ||
    original.projectId !== resulting.projectId ||
    original.revision !== resulting.revision ||
    original.catalogueRef !== resulting.catalogueRef
  ) {
    throw new CompositeStorefrontHistoryError(
      "A composite history transaction must preserve canonical storefront identity.",
    );
  }
  const affectedPageIds = [...proposal.target.affectedPageIds];
  const originalById = new Map(original.pages.map((page) => [page.id, page]));
  const resultingById = new Map(resulting.pages.map((page) => [page.id, page]));
  const originalStorefrontFingerprint = canonicalStorefrontContentFingerprint(original);
  const resultingStorefrontFingerprint = canonicalStorefrontContentFingerprint(resulting);
  const originalPageOrder = original.pages.map(({ id }) => id);
  const resultingPageOrder = resulting.pages.map(({ id }) => id);
  const structuralTransition =
    canonicalValueString(originalPageOrder) !== canonicalValueString(resultingPageOrder) ||
    canonicalValueString(original.navigation) !== canonicalValueString(resulting.navigation) ||
    canonicalValueString(original.sharedFrame) !== canonicalValueString(resulting.sharedFrame) ||
    canonicalValueString(original.dynamicCommercePresentation) !==
      canonicalValueString(resulting.dynamicCommercePresentation) ||
    canonicalValueString(original.contentSupportFactDocuments) !==
      canonicalValueString(resulting.contentSupportFactDocuments);
  const transaction = compositeStorefrontHistoryTransactionSchema.parse({
    transactionId:
      transactionId ?? stableTransactionId(proposal.id, acceptedAt, originalStorefrontFingerprint),
    proposalId: proposal.id,
    projectId: original.projectId,
    draftSnapshotId: original.id,
    draftRevision: original.revision,
    acceptedAt,
    summary: structuredClone(proposal.summary),
    affectedPageIds,
    originalAffectedPages: structuralTransition
      ? structuredClone(original.pages)
      : affectedPageIds.map((pageId) => {
          const page = originalById.get(pageId);
          if (!page)
            throw new CompositeStorefrontHistoryError("An affected original page is missing.");
          return structuredClone(page);
        }),
    resultingAffectedPages: structuralTransition
      ? structuredClone(resulting.pages)
      : affectedPageIds.map((pageId) => {
          const page = resultingById.get(pageId);
          if (!page)
            throw new CompositeStorefrontHistoryError("An affected resulting page is missing.");
          return structuredClone(page);
        }),
    originalDesignSystem: structuredClone(original.brandSystem),
    resultingDesignSystem: structuredClone(resulting.brandSystem),
    unaffectedPages: structuralTransition ? [] : unaffectedPages(original, affectedPageIds),
    ...(structuralTransition
      ? {
          structuralTransition: {
            originalPageOrder,
            resultingPageOrder,
            originalNavigation: structuredClone(original.navigation),
            resultingNavigation: structuredClone(resulting.navigation),
            ...(original.sharedFrame
              ? { originalSharedFrame: structuredClone(original.sharedFrame) }
              : {}),
            ...(resulting.sharedFrame
              ? { resultingSharedFrame: structuredClone(resulting.sharedFrame) }
              : {}),
            ...(original.dynamicCommercePresentation
              ? {
                  originalDynamicCommercePresentation: structuredClone(
                    original.dynamicCommercePresentation,
                  ),
                }
              : {}),
            originalContentSupportFactDocuments: structuredClone(
              original.contentSupportFactDocuments,
            ),
            resultingContentSupportFactDocuments: structuredClone(
              resulting.contentSupportFactDocuments,
            ),
            ...(resulting.dynamicCommercePresentation
              ? {
                  resultingDynamicCommercePresentation: structuredClone(
                    resulting.dynamicCommercePresentation,
                  ),
                }
              : {}),
          },
        }
      : {}),
    originalStorefrontFingerprint,
    resultingStorefrontFingerprint,
  });
  assertUnchangedPages(resulting, transaction.unaffectedPages);
  return structuredClone(transaction);
}

function applyTransaction(
  snapshotInput: StorefrontSnapshot,
  transaction: CompositeStorefrontHistoryTransaction,
  direction: "forward" | "inverse",
  validateSnapshot: StorefrontSnapshotValidator,
) {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(snapshotInput));
  const expectedFingerprint =
    direction === "forward"
      ? transaction.originalStorefrontFingerprint
      : transaction.resultingStorefrontFingerprint;
  const resultingFingerprint =
    direction === "forward"
      ? transaction.resultingStorefrontFingerprint
      : transaction.originalStorefrontFingerprint;
  if (
    snapshot.projectId !== transaction.projectId ||
    snapshot.id !== transaction.draftSnapshotId ||
    snapshot.revision !== transaction.draftRevision ||
    canonicalStorefrontContentFingerprint(snapshot) !== expectedFingerprint
  ) {
    throw new CompositeStorefrontHistoryError(
      "The active storefront no longer matches this composite history transaction.",
    );
  }
  assertUnchangedPages(snapshot, transaction.unaffectedPages);
  const affectedPages =
    direction === "forward"
      ? transaction.resultingAffectedPages
      : transaction.originalAffectedPages;
  const pagesById = new Map(affectedPages.map((page) => [page.id, page]));
  const brandSystem: BrandSystem =
    direction === "forward" ? transaction.resultingDesignSystem : transaction.originalDesignSystem;
  const structural = transaction.structuralTransition;
  const {
    sharedFrame: _currentSharedFrame,
    dynamicCommercePresentation: _currentDynamicCommercePresentation,
    contentSupportFactDocuments: _currentContentSupportFactDocuments,
    ...snapshotBase
  } = structuredClone(snapshot);
  void _currentSharedFrame;
  void _currentDynamicCommercePresentation;
  void _currentContentSupportFactDocuments;
  const dynamicCommercePresentation = structural
    ? direction === "forward"
      ? structural.resultingDynamicCommercePresentation
      : structural.originalDynamicCommercePresentation
    : snapshot.dynamicCommercePresentation;
  const sharedFrame = structural
    ? direction === "forward"
      ? structural.resultingSharedFrame
      : structural.originalSharedFrame
    : snapshot.sharedFrame;
  const contentSupportFactDocuments = structural
    ? direction === "forward"
      ? (structural.resultingContentSupportFactDocuments ?? snapshot.contentSupportFactDocuments)
      : (structural.originalContentSupportFactDocuments ?? snapshot.contentSupportFactDocuments)
    : snapshot.contentSupportFactDocuments;
  const candidate = validateSnapshot({
    ...snapshotBase,
    pages: structural
      ? structuredClone(affectedPages)
      : snapshot.pages.map((page) => structuredClone(pagesById.get(page.id) ?? page)),
    navigation: structural
      ? structuredClone(
          direction === "forward" ? structural.resultingNavigation : structural.originalNavigation,
        )
      : structuredClone(snapshot.navigation),
    brandSystem: structuredClone(brandSystem),
    ...(sharedFrame ? { sharedFrame: structuredClone(sharedFrame) } : {}),
    ...(dynamicCommercePresentation
      ? { dynamicCommercePresentation: structuredClone(dynamicCommercePresentation) }
      : {}),
    contentSupportFactDocuments: structuredClone(contentSupportFactDocuments),
  });
  assertUnchangedPages(candidate, transaction.unaffectedPages);
  if (canonicalStorefrontContentFingerprint(candidate) !== resultingFingerprint) {
    throw new CompositeStorefrontHistoryError(
      "The composite history transaction did not restore the exact storefront state.",
    );
  }
  return structuredClone(candidate);
}

export class CanonicalStorefrontHistory {
  readonly #maxEntries: number;
  readonly #validateSnapshot: StorefrontSnapshotValidator;
  #state: StorefrontHistoryState | null = null;

  constructor(options: CanonicalStorefrontHistoryOptions = {}) {
    const {
      maxEntries = 50,
      validateSnapshot = (snapshot) => storefrontSnapshotSchema.parse(snapshot),
    } = options;
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new CompositeStorefrontHistoryError(
        "Canonical storefront history requires at least one transaction entry.",
      );
    }
    this.#maxEntries = maxEntries;
    this.#validateSnapshot = validateSnapshot;
  }

  #requiredState() {
    if (!this.#state) {
      throw new CompositeStorefrontHistoryError("Canonical storefront history is not initialized.");
    }
    return this.#state;
  }

  initialize(snapshotInput: unknown) {
    const snapshot = this.#validateSnapshot(structuredClone(snapshotInput));
    this.#state = { current: cloneSnapshot(snapshot), past: [], future: [] };
    return cloneSnapshot(snapshot);
  }

  current() {
    return cloneSnapshot(this.#requiredState().current);
  }

  rebaseCurrent(snapshotInput: unknown) {
    const state = this.#requiredState();
    const snapshot = this.#validateSnapshot(structuredClone(snapshotInput));
    if (
      snapshot.projectId !== state.current.projectId ||
      snapshot.id !== state.current.id ||
      snapshot.revision !== state.current.revision ||
      snapshot.catalogueRef !== state.current.catalogueRef ||
      canonicalValueString(snapshot.navigation) !==
        canonicalValueString(state.current.navigation) ||
      canonicalValueString(snapshot.pages.map((page) => page.id)) !==
        canonicalValueString(state.current.pages.map((page) => page.id))
    ) {
      throw new CompositeStorefrontHistoryError(
        "Canonical storefront history cannot be rebased onto a different storefront identity.",
      );
    }
    state.current = cloneSnapshot(snapshot);
    return cloneSnapshot(state.current);
  }

  inspectTransactions() {
    const state = this.#requiredState();
    return {
      past: state.past.map(cloneTransaction),
      future: state.future.map(cloneTransaction),
    };
  }

  canUndo() {
    return this.#requiredState().past.length > 0;
  }

  canRedo() {
    return this.#requiredState().future.length > 0;
  }

  hasProposal(proposalId: string) {
    const state = this.#requiredState();
    return [...state.past, ...state.future].some(
      (transaction) => transaction.proposalId === proposalId,
    );
  }

  commit(transactionInput: unknown) {
    const transaction = compositeStorefrontHistoryTransactionSchema.parse(
      structuredClone(transactionInput),
    );
    const state = this.#requiredState();
    if (
      [...state.past, ...state.future].some(
        (candidate) =>
          candidate.transactionId === transaction.transactionId ||
          candidate.proposalId === transaction.proposalId,
      )
    ) {
      throw new CompositeStorefrontHistoryError(
        "A storefront proposal can create only one composite history transaction.",
      );
    }
    const next = applyTransaction(state.current, transaction, "forward", this.#validateSnapshot);
    const reverted = applyTransaction(next, transaction, "inverse", this.#validateSnapshot);
    if (canonicalValueString(reverted) !== canonicalValueString(state.current)) {
      throw new CompositeStorefrontHistoryError(
        "The inverse storefront transaction does not restore the previous active draft.",
      );
    }
    state.past.push(cloneTransaction(transaction));
    if (state.past.length > this.#maxEntries) {
      state.past.splice(0, state.past.length - this.#maxEntries);
    }
    state.current = cloneSnapshot(next);
    state.future = [];
    return cloneSnapshot(next);
  }

  undo() {
    const state = this.#requiredState();
    const transaction = state.past.at(-1);
    if (!transaction) return undefined;
    const previous = applyTransaction(
      state.current,
      transaction,
      "inverse",
      this.#validateSnapshot,
    );
    state.past.pop();
    state.future.unshift(cloneTransaction(transaction));
    state.current = cloneSnapshot(previous);
    return cloneSnapshot(previous);
  }

  redo() {
    const state = this.#requiredState();
    const transaction = state.future[0];
    if (!transaction) return undefined;
    const next = applyTransaction(state.current, transaction, "forward", this.#validateSnapshot);
    state.future.shift();
    state.past.push(cloneTransaction(transaction));
    state.current = cloneSnapshot(next);
    return cloneSnapshot(next);
  }
}
