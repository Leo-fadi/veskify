import {
  canonicalizeAiStorefrontTarget,
  createAiStorefrontBaselineFingerprint,
  createAiStorefrontPermissionFingerprint,
  createAiStorefrontTargetFingerprint,
  type AiStorefrontContext,
  type AiStorefrontTarget,
} from "@/application/ai-storefront";
import { canonicalValueString } from "@/domain/storefront";
import {
  aiStorefrontGenerationFailureSchema,
  type AiStorefrontGenerationAnalytics,
  type AiStorefrontGenerationCommand,
  type AiStorefrontGenerationFailure,
  type AiStorefrontGenerationIdentity,
  type AiStorefrontGenerationResult,
  type AiStorefrontProviderRequest,
} from "./contract";
import {
  AiStorefrontProviderUnavailableError,
  AiStorefrontProviderValidationError,
  requestAiStorefrontProposal,
} from "./provider-boundary";
import {
  AiStorefrontRequestBuildError,
  aiStorefrontPendingRequestKey,
  buildAiStorefrontProviderRequest,
  parseAiStorefrontGenerationCommand,
} from "./request-builder";

const messages = {
  invalidCommand: {
    en: "The storefront request is incomplete. Check the selected pages and try again.",
    fi: "Kaupan pyyntö on puutteellinen. Tarkista valitut sivut ja yritä uudelleen.",
  },
  unsupportedRequest: {
    en: "That whole-storefront change is not supported yet. Choose an approved colour and typography direction.",
    fi: "Tätä koko kaupan muutosta ei vielä tueta. Valitse hyväksytty väri- ja typografiailme.",
  },
  providerUnavailable: {
    en: "The storefront design assistant is temporarily unavailable. Try again later.",
    fi: "Kaupan designavustaja ei ole juuri nyt käytettävissä. Yritä myöhemmin uudelleen.",
  },
  validationFailed: {
    en: "The storefront proposal could not be safely validated. The draft remains unchanged.",
    fi: "Kaupan ehdotusta ei voitu validoida turvallisesti. Luonnos säilyi ennallaan.",
  },
  staleDraft: {
    en: "A targeted storefront page or design setting changed. Create a new proposal.",
    fi: "Kohdistettu kaupan sivu tai designasetus muuttui. Luo uusi ehdotus.",
  },
  staleTarget: {
    en: "The storefront target changed while the proposal was being prepared.",
    fi: "Kaupan kohde muuttui ehdotuksen valmistelun aikana.",
  },
  superseded: {
    en: "A newer storefront proposal request replaced this one.",
    fi: "Uudempi kaupan ehdotuspyyntö korvasi tämän pyynnön.",
  },
} as const;

function failure(code: AiStorefrontGenerationFailure["code"]): AiStorefrontGenerationFailure {
  return aiStorefrontGenerationFailureSchema.parse({
    code,
    message: messages[code],
    retryable: code !== "superseded",
  });
}

type ActiveGeneration = {
  key: string;
  sequence: number;
  request: AiStorefrontProviderRequest;
  promise: Promise<AiStorefrontGenerationResult>;
};

export class AiStorefrontGenerationOrchestrator {
  readonly #currentIdentity: () => AiStorefrontGenerationIdentity;
  readonly #analytics?: AiStorefrontGenerationAnalytics;
  #sequence = 0;
  #active: ActiveGeneration | null = null;
  #state: "idle" | "generating" | "ready" | "failed" | "stale" | "superseded" = "idle";
  #proposal: AiStorefrontGenerationResult["proposal"] = null;
  #lastFailure: AiStorefrontGenerationFailure | null = null;

  constructor({
    currentIdentity,
    analytics,
  }: {
    currentIdentity: () => AiStorefrontGenerationIdentity;
    analytics?: AiStorefrontGenerationAnalytics;
  }) {
    this.#currentIdentity = currentIdentity;
    this.#analytics = analytics;
  }

  inspect() {
    return structuredClone({
      state: this.#state,
      proposal: this.#proposal,
      failure: this.#lastFailure,
    });
  }

  generate(commandInput: unknown): Promise<AiStorefrontGenerationResult> {
    let command: AiStorefrontGenerationCommand;
    try {
      command = parseAiStorefrontGenerationCommand(commandInput);
    } catch {
      this.#sequence += 1;
      this.#active = null;
      return Promise.resolve(this.#fail(null, "invalidCommand"));
    }
    const candidateSequence = this.#sequence + 1;
    let request: AiStorefrontProviderRequest;
    try {
      request = buildAiStorefrontProviderRequest(command, candidateSequence);
    } catch (error) {
      this.#sequence = candidateSequence;
      this.#active = null;
      const code =
        error instanceof AiStorefrontRequestBuildError && error.code === "unsupported-request"
          ? "unsupportedRequest"
          : error instanceof AiStorefrontRequestBuildError && error.code === "target-mismatch"
            ? "staleTarget"
            : "invalidCommand";
      return Promise.resolve(this.#fail(command, code));
    }
    const key = aiStorefrontPendingRequestKey(request);
    if (this.#active?.key === key) return this.#active.promise;

    this.#sequence = candidateSequence;
    const sequence = this.#sequence;
    const promise = this.#run(command, request, sequence).finally(() => {
      if (this.#active?.sequence === sequence) this.#active = null;
    });
    this.#active = { key, sequence, request, promise };
    return promise;
  }

  async #run(
    command: AiStorefrontGenerationCommand,
    request: AiStorefrontProviderRequest,
    sequence: number,
  ): Promise<AiStorefrontGenerationResult> {
    this.#state = "generating";
    this.#proposal = null;
    this.#lastFailure = null;
    this.#record({
      name: "storefront_prompt_submitted",
      projectId: command.projectId,
      requestId: request.requestId,
      requestSequence: sequence,
      providerId: request.providerId,
      targetFingerprint: request.targetFingerprint,
      affectedPageCount: request.target.affectedPageIds.length,
    });
    try {
      const response = await requestAiStorefrontProposal(command.provider, request);
      if (sequence !== this.#sequence) return this.#superseded(request);
      const staleCode = this.#staleCode(request);
      if (staleCode) {
        return this.#fail(
          command,
          staleCode,
          request,
          response.metadata.operationCount,
          response.metadata.durationMs,
        );
      }
      this.#state = "ready";
      this.#proposal = structuredClone(response.proposal);
      this.#record({
        name: "storefront_proposal_generated",
        projectId: command.projectId,
        requestId: request.requestId,
        requestSequence: sequence,
        providerId: response.providerId,
        targetFingerprint: request.targetFingerprint,
        affectedPageCount: request.target.affectedPageIds.length,
        operationCount: response.metadata.operationCount,
        durationMs: response.metadata.durationMs,
        validation: "valid",
      });
      return { state: "ready", proposal: structuredClone(response.proposal), failure: null };
    } catch (error) {
      if (sequence !== this.#sequence) return this.#superseded(request);
      return this.#fail(
        command,
        error instanceof AiStorefrontProviderUnavailableError
          ? "providerUnavailable"
          : error instanceof AiStorefrontProviderValidationError
            ? "validationFailed"
            : "validationFailed",
        request,
      );
    }
  }

  #staleCode(request: AiStorefrontProviderRequest): "staleDraft" | "staleTarget" | null {
    let currentContext: AiStorefrontContext;
    let currentTarget: AiStorefrontTarget;
    try {
      const current = this.#currentIdentity();
      currentContext = {
        ...current.context,
        enabledLocales: [...current.context.enabledLocales],
        storefront: structuredClone(current.context.storefront),
      };
      currentTarget = canonicalizeAiStorefrontTarget(current.target);
    } catch {
      return "staleDraft";
    }
    if (canonicalValueString(currentTarget) !== canonicalValueString(request.target)) {
      return "staleTarget";
    }
    try {
      const currentStorefrontBaselineFingerprint =
        createAiStorefrontBaselineFingerprint(currentContext);
      const currentTargetFingerprint = createAiStorefrontTargetFingerprint(
        currentContext,
        currentTarget,
      );
      const currentPermissionFingerprint = createAiStorefrontPermissionFingerprint(
        request.permissionGrants,
        currentTarget,
        currentContext,
      );
      return currentStorefrontBaselineFingerprint === request.storefrontBaselineFingerprint &&
        currentTargetFingerprint === request.targetFingerprint &&
        currentPermissionFingerprint === request.permissionFingerprint
        ? null
        : "staleDraft";
    } catch {
      return "staleDraft";
    }
  }

  #superseded(request: AiStorefrontProviderRequest): AiStorefrontGenerationResult {
    const superseded = failure("superseded");
    this.#record({
      name: "storefront_generation_superseded",
      projectId: request.target.projectId,
      requestId: request.requestId,
      requestSequence: request.requestSequence,
      providerId: request.providerId,
      targetFingerprint: request.targetFingerprint,
      affectedPageCount: request.target.affectedPageIds.length,
      validation: "invalid",
      failureCode: "superseded",
    });
    return { state: "superseded", proposal: null, failure: superseded };
  }

  #record(event: Parameters<AiStorefrontGenerationAnalytics["record"]>[0]): void {
    try {
      this.#analytics?.record(event);
    } catch {
      // Analytics is best-effort and cannot affect proposal generation.
    }
  }

  #fail(
    command: AiStorefrontGenerationCommand | null,
    code: AiStorefrontGenerationFailure["code"],
    request?: AiStorefrontProviderRequest,
    operationCount?: number,
    durationMs?: number,
  ): AiStorefrontGenerationResult {
    const state = code === "staleDraft" || code === "staleTarget" ? "stale" : "failed";
    const failed = failure(code);
    this.#state = state;
    this.#proposal = null;
    this.#lastFailure = failed;
    if (command) {
      this.#record({
        name: state === "stale" ? "storefront_generation_stale" : "storefront_generation_failed",
        projectId: command.projectId,
        ...(request ? { requestId: request.requestId } : {}),
        ...(request ? { requestSequence: request.requestSequence } : {}),
        providerId: command.providerId,
        ...(request ? { targetFingerprint: request.targetFingerprint } : {}),
        affectedPageCount: command.affectedPageIds.length,
        ...(operationCount === undefined ? {} : { operationCount }),
        ...(durationMs === undefined ? {} : { durationMs }),
        validation: "invalid",
        failureCode: code,
      });
    }
    return { state, proposal: null, failure: structuredClone(failed) };
  }
}
