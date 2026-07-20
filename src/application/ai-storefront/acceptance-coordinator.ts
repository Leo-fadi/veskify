import { validateRegisteredSnapshot } from "@/components/registry";
import { catalogueDisplayModelSchema, type CatalogueDisplayModel } from "@/domain/catalogue";
import { localeSchema, localizedTextSchema, type Locale } from "@/domain/shared";
import { canonicalValueString, type StorefrontSnapshot } from "@/domain/storefront";
import { z } from "zod";
import {
  aiStorefrontProposalSchema,
  aiStorefrontReadyProposalSchema,
  type AiStorefrontProposal,
} from "./contract";
import {
  CanonicalStorefrontHistory,
  deriveCompositeStorefrontHistoryTransaction,
  type CompositeStorefrontHistoryTransaction,
} from "./composite-history";
import {
  AiStorefrontApplicationError,
  createAiStorefrontApplicationContext,
  executeAiStorefrontProposal,
  type AiStorefrontApplicationContext,
} from "./executor";
import { AiStorefrontValidationError } from "./validation";

export const storefrontProposalAcceptanceStateSchema = z.enum([
  "ready",
  "accepted",
  "rejected",
  "failed",
  "stale",
  "closed",
]);

export const storefrontProposalAcceptanceFailureSchema = z
  .object({
    code: z.enum([
      "applicationFailed",
      "stale",
      "invalidProposal",
      "duplicateAcceptance",
      "terminalProposal",
    ]),
    message: localizedTextSchema,
    retryable: z.boolean(),
  })
  .strict();

export type StorefrontProposalAcceptanceState = z.infer<
  typeof storefrontProposalAcceptanceStateSchema
>;
export type StorefrontProposalAcceptanceFailure = z.infer<
  typeof storefrontProposalAcceptanceFailureSchema
>;

export type StorefrontProposalAcceptanceSnapshot = Readonly<{
  state: StorefrontProposalAcceptanceState;
  proposal: AiStorefrontProposal;
  activeDraft: StorefrontSnapshot;
  storedDraft: StorefrontSnapshot;
  publishedSnapshot: StorefrontSnapshot;
  failure: StorefrontProposalAcceptanceFailure | null;
  transaction: CompositeStorefrontHistoryTransaction | null;
}>;

const messages = {
  applicationFailed: {
    en: "The storefront proposal could not be applied safely. Your active draft is unchanged.",
    fi: "Kauppapaikan ehdotusta ei voitu ottaa turvallisesti käyttöön. Aktiivinen luonnos säilyi ennallaan.",
  },
  stale: {
    en: "The active storefront changed after this proposal was prepared. Create a new proposal.",
    fi: "Aktiivinen kauppapaikka muuttui ehdotuksen valmistelun jälkeen. Luo uusi ehdotus.",
  },
  invalidProposal: {
    en: "The storefront proposal is no longer valid for safe application.",
    fi: "Kauppapaikan ehdotus ei ole enää kelvollinen turvalliseen käyttöönottoon.",
  },
  duplicateAcceptance: {
    en: "This storefront proposal has already been applied.",
    fi: "Tämä kauppapaikan ehdotus on jo otettu käyttöön.",
  },
  terminalProposal: {
    en: "This storefront proposal is closed and cannot be applied.",
    fi: "Tämä kauppapaikan ehdotus on suljettu eikä sitä voi ottaa käyttöön.",
  },
} as const;

function failure(
  code: StorefrontProposalAcceptanceFailure["code"],
): StorefrontProposalAcceptanceFailure {
  return {
    code,
    message: messages[code],
    retryable: code === "applicationFailed",
  };
}

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current = error;
  while (current && !chain.includes(current)) {
    chain.push(current);
    current = current instanceof Error ? current.cause : undefined;
  }
  return chain;
}

function isStaleFailure(error: unknown) {
  const staleCodes = new Set([
    "stale-context",
    "stale-storefront",
    "proposal-identity-mismatch",
    "target-fingerprint-mismatch",
    "permission-fingerprint-mismatch",
    "active-storefront-fingerprint-mismatch",
  ]);
  return errorChain(error).some(
    (cause) =>
      (cause instanceof AiStorefrontValidationError ||
        cause instanceof AiStorefrontApplicationError) &&
      staleCodes.has(cause.code),
  );
}

export class StorefrontProposalAcceptanceCoordinator {
  readonly #catalogue: CatalogueDisplayModel;
  readonly #enabledLocales: Locale[];
  readonly #activeLocale: Locale;
  readonly #primaryLocale: Locale;
  readonly #storedDraft: StorefrontSnapshot;
  readonly #publishedSnapshot: StorefrontSnapshot;
  readonly #history: CanonicalStorefrontHistory;
  readonly #now: () => Date;
  readonly #createTransactionId?: (input: { proposalId: string; acceptedAt: string }) => string;
  #proposal: AiStorefrontProposal;
  #state: StorefrontProposalAcceptanceState;
  #failure: StorefrontProposalAcceptanceFailure | null = null;
  #transaction: CompositeStorefrontHistoryTransaction | null = null;

  constructor({
    proposal: proposalInput,
    activeDraft,
    storedDraft,
    publishedSnapshot,
    catalogue: catalogueInput,
    enabledLocales,
    activeLocale,
    primaryLocale,
    now = () => new Date(),
    createTransactionId,
  }: AiStorefrontApplicationContext & {
    proposal: unknown;
    storedDraft: StorefrontSnapshot;
    publishedSnapshot: StorefrontSnapshot;
    now?: () => Date;
    createTransactionId?: (input: { proposalId: string; acceptedAt: string }) => string;
  }) {
    this.#proposal = aiStorefrontProposalSchema.parse(structuredClone(proposalInput));
    const context = createAiStorefrontApplicationContext({
      activeDraft,
      catalogue: catalogueInput,
      enabledLocales,
      activeLocale,
      primaryLocale,
    });
    this.#catalogue = catalogueDisplayModelSchema.parse(structuredClone(context.catalogue));
    this.#enabledLocales = [...context.enabledLocales];
    this.#activeLocale = localeSchema.parse(context.activeLocale);
    this.#primaryLocale = localeSchema.parse(context.primaryLocale);
    this.#storedDraft = validateRegisteredSnapshot(
      structuredClone(storedDraft),
      this.#catalogue,
      this.#activeLocale,
      this.#primaryLocale,
    );
    this.#publishedSnapshot = validateRegisteredSnapshot(
      structuredClone(publishedSnapshot),
      this.#catalogue,
      this.#activeLocale,
      this.#primaryLocale,
    );
    if (
      [this.#storedDraft, this.#publishedSnapshot].some(
        (snapshot) =>
          snapshot.projectId !== context.activeDraft.projectId ||
          snapshot.catalogueRef !== context.activeDraft.catalogueRef,
      )
    ) {
      throw new AiStorefrontApplicationError(
        "invalid-application-context",
        "Active, stored, and published storefront state must belong to one project and catalogue.",
      );
    }
    this.#history = new CanonicalStorefrontHistory({
      validateSnapshot: (snapshot) =>
        validateRegisteredSnapshot(
          snapshot,
          this.#catalogue,
          this.#activeLocale,
          this.#primaryLocale,
        ),
    });
    this.#history.initialize(context.activeDraft);
    this.#state =
      this.#proposal.status === "pending"
        ? "ready"
        : this.#proposal.status === "accepted"
          ? "accepted"
          : "rejected";
    this.#now = now;
    this.#createTransactionId = createTransactionId;
  }

  inspect(): StorefrontProposalAcceptanceSnapshot {
    return structuredClone({
      state: this.#state,
      proposal: this.#proposal,
      activeDraft: this.#history.current(),
      storedDraft: this.#storedDraft,
      publishedSnapshot: this.#publishedSnapshot,
      failure: this.#failure,
      transaction: this.#transaction,
    });
  }

  inspectHistory() {
    return this.#history.inspectTransactions();
  }

  accept(): StorefrontProposalAcceptanceSnapshot {
    if (this.#state === "accepted" || this.#history.hasProposal(this.#proposal.id)) {
      this.#failure = failure("duplicateAcceptance");
      return this.inspect();
    }
    if (["rejected", "closed", "stale"].includes(this.#state)) {
      this.#failure = failure("terminalProposal");
      return this.inspect();
    }
    const original = this.#history.current();
    try {
      const resulting = executeAiStorefrontProposal({
        proposal: this.#proposal,
        activeDraft: original,
        catalogue: this.#catalogue,
        enabledLocales: this.#enabledLocales,
        activeLocale: this.#activeLocale,
        primaryLocale: this.#primaryLocale,
      });
      const ready = aiStorefrontReadyProposalSchema.parse(this.#proposal);
      const acceptedAt = this.#now().toISOString();
      const transaction = deriveCompositeStorefrontHistoryTransaction({
        original,
        resulting,
        proposal: ready,
        acceptedAt,
        transactionId: this.#createTransactionId?.({
          proposalId: this.#proposal.id,
          acceptedAt,
        }),
      });
      const committed = this.#history.commit(transaction);
      if (canonicalValueString(committed) !== canonicalValueString(resulting)) {
        throw new Error("Composite history did not commit the exact executed storefront.");
      }
      this.#proposal = aiStorefrontProposalSchema.parse({
        ...this.#proposal,
        status: "accepted",
      });
      this.#state = "accepted";
      this.#failure = null;
      this.#transaction = structuredClone(transaction);
      return this.inspect();
    } catch (cause) {
      const stale = isStaleFailure(cause);
      if (stale) {
        this.#proposal = aiStorefrontProposalSchema.parse({
          ...this.#proposal,
          status: "rejected",
        });
        this.#state = "stale";
        this.#failure = failure("stale");
      } else {
        this.#state = "failed";
        this.#failure = failure(
          cause instanceof AiStorefrontApplicationError && cause.code === "invalid-proposal"
            ? "invalidProposal"
            : "applicationFailed",
        );
      }
      return this.inspect();
    }
  }

  reject(): StorefrontProposalAcceptanceSnapshot {
    if (this.#state !== "ready" && this.#state !== "failed") {
      this.#failure = failure("terminalProposal");
      return this.inspect();
    }
    this.#proposal = aiStorefrontProposalSchema.parse({
      ...this.#proposal,
      status: "rejected",
    });
    this.#state = "rejected";
    this.#failure = null;
    return this.inspect();
  }

  close(): StorefrontProposalAcceptanceSnapshot {
    if (this.#state === "ready" || this.#state === "failed") {
      this.#proposal = aiStorefrontProposalSchema.parse({
        ...this.#proposal,
        status: "rejected",
      });
      this.#state = "closed";
      this.#failure = null;
    }
    return this.inspect();
  }

  undo(): StorefrontSnapshot | undefined {
    return this.#history.undo();
  }

  redo(): StorefrontSnapshot | undefined {
    return this.#history.redo();
  }
}
