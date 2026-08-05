import "server-only";

import { mkdir, open, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AcceptedSnapshotReceiptError,
  parseTrustedAcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceipt,
  type AcceptedSnapshotPublishReceiptRepository,
} from "./receipt";

/**
 * Narrow server persistence for immutable accepted-snapshot receipts. The
 * application boundary owns its directory; browser storage never receives a
 * receipt write capability.
 */
export class FileSystemAcceptedSnapshotPublishReceiptRepository implements AcceptedSnapshotPublishReceiptRepository {
  readonly #directory: string;

  constructor(directory: string) {
    this.#directory = directory;
  }

  #file(receiptId: string): string {
    return join(this.#directory, `${receiptId}.json`);
  }

  async createOnce(
    receiptInput: AcceptedSnapshotPublishReceipt,
  ): Promise<AcceptedSnapshotPublishReceipt> {
    const receipt = parseTrustedAcceptedSnapshotPublishReceipt(receiptInput);
    await mkdir(this.#directory, { recursive: true });
    const serialized = JSON.stringify(receipt);
    try {
      const handle = await open(this.#file(receipt.id), "wx");
      try {
        await handle.writeFile(serialized, "utf8");
      } finally {
        await handle.close();
      }
      return structuredClone(receipt);
    } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
      const existing = await this.get(receipt.id);
      const parsed = existing ? parseTrustedAcceptedSnapshotPublishReceipt(existing) : null;
      throw new AcceptedSnapshotReceiptError(
        parsed?.fingerprint === receipt.fingerprint ? "receipt-replay" : "receipt-collision",
      );
    }
  }

  async get(receiptId: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(this.#file(receiptId), "utf8")) as unknown;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
}
