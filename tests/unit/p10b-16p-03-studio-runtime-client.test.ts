import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWholeStorefrontPlanningRouteHandler } from "@/app/api/ai/whole-storefront-proposals/handler";
import { createAiStorefrontProposalId } from "@/application/ai-storefront";
import { promptedStorefrontPromptFingerprint } from "@/application/prompted-storefront-design-intent";
import {
  PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
  PROMPTED_STOREFRONT_STUDIO_OPERATION,
  promptedStorefrontStudioGenerationRequestSchema,
  promptedStorefrontStudioGenerationResponseSchema,
} from "@/application/prompted-storefront-studio";
import {
  P10B16P03_DRAFT_ID,
  P10B16P03_PROJECT_ID,
} from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import {
  PromptedStorefrontStudioClientAbortedError,
  ServerPromptedStorefrontStudioClient,
} from "@/integrations/ai/whole-storefront-runtime-client";

const exactPrompt =
  "  Create a refined premium jewellery storefront with restrained commercial hierarchy.\n";

const request = () =>
  promptedStorefrontStudioGenerationRequestSchema.parse({
    operation: PROMPTED_STOREFRONT_STUDIO_OPERATION,
    contractVersion: PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
    requestId: "attempt_prompted_studio_client",
    projectId: P10B16P03_PROJECT_ID,
    draftSnapshotId: P10B16P03_DRAFT_ID,
    draftRevision: 0,
    activeLocale: "en",
    targetScope: "storefront",
    merchantPrompt: exactPrompt,
  });

afterEach(() => vi.unstubAllGlobals());

describe("P10B-16P-03 prompted Studio runtime client", () => {
  it("preserves a non-retryable missing-authentication boundary without another request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { ok: false, failure: { category: "authenticationUnavailable", retryable: false } },
          { status: 503 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new ServerPromptedStorefrontStudioClient().generateStorefront(request()),
    ).rejects.toMatchObject({
      category: "authenticationUnavailable",
      retryable: false,
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("posts only the strict compact operation with the exact prompt and never retries a failure", async () => {
    const fetchMock = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(
      Response.json(
        { ok: false, failure: { category: "providerUnavailable", retryable: true } },
        { status: 503 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const stages: string[] = [];

    await expect(
      new ServerPromptedStorefrontStudioClient().generateStorefront(request(), {
        onStage: (stage) => stages.push(stage),
      }),
    ).rejects.toMatchObject({
      category: "providerUnavailable",
      retryable: true,
      status: 503,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ai/whole-storefront-proposals");
    expect(init?.method).toBe("POST");
    if (typeof init?.body !== "string") throw new Error("Expected a serialized request body.");
    const submitted: unknown = JSON.parse(init.body) as unknown;
    if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
      throw new Error("Expected a compact request object.");
    }
    expect(submitted).toEqual(request());
    expect(Object.keys(submitted).sort()).toEqual([
      "activeLocale",
      "contractVersion",
      "draftRevision",
      "draftSnapshotId",
      "merchantPrompt",
      "operation",
      "projectId",
      "requestId",
      "targetScope",
    ]);
    expect(stages).toEqual(["requesting-design-intent"]);
  });

  it("fails closed on a malformed response without a fallback request", async () => {
    const fetchMock = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(Response.json({ ok: true }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new ServerPromptedStorefrontStudioClient().generateStorefront(request()),
    ).rejects.toMatchObject({
      category: "malformedResponse",
      retryable: false,
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an internally consistent response bound to a different exact prompt", async () => {
    const submittedRequest = request();
    const route = createWholeStorefrontPlanningRouteHandler({
      environment: { VESKIFY_RUNTIME_MODE: "standalone" },
    });
    const serverResponse = await route(
      new Request("http://localhost/api/ai/whole-storefront-proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submittedRequest),
      }),
    );
    const response = promptedStorefrontStudioGenerationResponseSchema.parse(
      await serverResponse.json(),
    );
    expect(response.ok).toBe(true);
    if (!response.ok) return;

    const wrongPromptFingerprint = promptedStorefrontPromptFingerprint(
      "Create a different storefront than the one the merchant requested.",
    );
    const generation = response.proposal.proposal.wholeStorefrontGeneration;
    if (!generation) throw new Error("Expected canonical generation lineage.");
    generation.promptFingerprint = wrongPromptFingerprint;
    response.lineage.promptFingerprint = wrongPromptFingerprint;
    response.proposal.proposal.id = createAiStorefrontProposalId(
      response.proposal.proposal.requestId,
      response.proposal.proposal.targetFingerprint,
      response.proposal.proposal.permissionFingerprint,
      response.proposal.proposal.operations,
      response.proposal.proposal.assetPlacementOperations,
      response.proposal.proposal.dynamicCommerceMigration,
      generation,
    );
    expect(promptedStorefrontStudioGenerationResponseSchema.safeParse(response).success).toBe(true);

    const fetchMock = vi.fn().mockResolvedValue(Response.json(response, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new ServerPromptedStorefrontStudioClient().generateStorefront(submittedRequest),
    ).rejects.toMatchObject({
      category: "malformedResponse",
      retryable: false,
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }, 120_000);

  it("reports browser cancellation distinctly and makes no replacement call", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      void url;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("", "AbortError")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const pending = new ServerPromptedStorefrontStudioClient().generateStorefront(request(), {
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(PromptedStorefrontStudioClientAbortedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
