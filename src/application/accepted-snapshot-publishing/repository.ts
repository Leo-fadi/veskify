import {
  AcceptedSnapshotReceiptError,
  acceptedSnapshotPublishReceiptSchema,
  parseTrustedAcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceiptRepository,
} from "./receipt";

/** Deterministic create-once adapter for server seams and tests; durable storage is deferred. */
export class InMemoryAcceptedSnapshotPublishReceiptRepository implements AcceptedSnapshotPublishReceiptRepository {
  readonly #items = new Map<string, AcceptedSnapshotPublishReceipt>();

  createOnce(
    receiptInput: AcceptedSnapshotPublishReceipt,
  ): Promise<AcceptedSnapshotPublishReceipt> {
    const receipt = parseTrustedAcceptedSnapshotPublishReceipt(receiptInput);
    const existing = this.#items.get(receipt.id);
    if (existing) {
      throw new AcceptedSnapshotReceiptError(
        existing.fingerprint === receipt.fingerprint ? "receipt-replay" : "receipt-collision",
      );
    }
    const persisted = acceptedSnapshotPublishReceiptSchema.parse(structuredClone(receipt));
    this.#items.set(persisted.id, persisted);
    return Promise.resolve(structuredClone(persisted));
  }

  get(receiptId: string): Promise<unknown> {
    const receipt = this.#items.get(receiptId);
    return Promise.resolve(receipt ? structuredClone(receipt) : null);
  }
}
