import { describe, expect, it, vi } from "vitest";
import {
  createDeterministicMockAIProvider,
  type AIProvider,
  type AiOperationRequest,
  type AiProviderRequestOptions,
} from "@/application/ai-provider";
import { aurumNordicSeed } from "@/data/seed";
import {
  createProjectRepositoryAiAuthorityResolver,
  createServerAiProposalHandler,
  ServerAiAuthorityError,
} from "@/integrations/ai/server-authority";
import { InMemoryProjectRepository } from "@/services/storage";

const page = aurumNordicSeed.draftSnapshot.pages.find((candidate) => candidate.type === "home")!;
const heroId = page.sections.find((section) => section.component === "hero")!.id;

function repository() {
  return new InMemoryProjectRepository([
    {
      project: structuredClone(aurumNordicSeed.project),
      catalogue: structuredClone(aurumNordicSeed.catalogue),
      snapshots: [
        structuredClone(aurumNordicSeed.publishedSnapshot),
        structuredClone(aurumNordicSeed.draftSnapshot),
      ],
    },
  ]);
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    projectId: aurumNordicSeed.project.id,
    draftSnapshotId: aurumNordicSeed.draftSnapshot.id,
    draftRevision: aurumNordicSeed.draftSnapshot.revision,
    target: { type: "section", pageId: page.id, sectionId: heroId },
    activeLocale: "en",
    merchantInstruction: "Improve the hero.",
    ...overrides,
  };
}

function request(payload = body(), signal?: AbortSignal) {
  return new Request("http://localhost/api/ai/proposals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
}

function authority(value = repository()) {
  return createProjectRepositoryAiAuthorityResolver({
    repository: value,
    authorizer: { assertAuthorized: () => Promise.resolve() },
  });
}

class RecordingProvider implements AIProvider {
  calls: AiOperationRequest[] = [];
  signals: Array<AbortSignal | undefined> = [];
  readonly #inner = createDeterministicMockAIProvider();

  proposeChange(input: AiOperationRequest, options?: AiProviderRequestOptions) {
    this.calls.push(structuredClone(input));
    this.signals.push(options?.signal);
    return this.#inner.proposeChange(input);
  }
}

describe("P4-06 server AI authority boundary", () => {
  it("reconstructs operation and component permissions from canonical server state", async () => {
    const provider = new RecordingProvider();
    const handler = createServerAiProposalHandler({
      authority: authority(),
      selectProvider: () => provider,
    });
    const result = await handler(request());
    expect(result.status).toBe(200);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toMatchObject({
      projectId: aurumNordicSeed.project.id,
      draftSnapshotId: aurumNordicSeed.draftSnapshot.id,
      draftRevision: aurumNordicSeed.draftSnapshot.revision,
      target: { pageId: page.id, sectionId: heroId },
      allowedComponentTypes: ["hero"],
      allowedOperationTypes: ["CHANGE_LOCALIZED_SECTION_TEXT", "CHANGE_SECTION_VARIANT"],
    });
    expect(provider.calls[0].permissionGrants).toHaveLength(1);
    expect(provider.calls[0].permissionGrants[0]).toMatchObject({
      skillId: "improveHero",
      target: { sectionId: heroId, componentType: "hero" },
    });
  });

  it("rejects revision mismatch before provider invocation", async () => {
    const provider = new RecordingProvider();
    const handler = createServerAiProposalHandler({
      authority: authority(),
      selectProvider: () => provider,
    });
    const result = await handler(request(body({ draftRevision: 999 })));
    expect(result.status).toBe(409);
    expect(provider.calls).toHaveLength(0);
  });

  it("rejects target mismatch before provider invocation", async () => {
    const provider = new RecordingProvider();
    const handler = createServerAiProposalHandler({
      authority: authority(),
      selectProvider: () => provider,
    });
    const result = await handler(
      request(
        body({
          target: { type: "section", pageId: page.id, sectionId: "section_not_canonical" },
        }),
      ),
    );
    expect(result.status).toBe(409);
    expect(provider.calls).toHaveLength(0);
  });

  it.each(["permissionGrants", "allowedOperationTypes", "allowedComponentTypes"])(
    "rejects browser-supplied %s instead of trusting it",
    async (field) => {
      const provider = new RecordingProvider();
      const handler = createServerAiProposalHandler({
        authority: authority(),
        selectProvider: () => provider,
      });
      const result = await handler(request(body({ [field]: ["browser-bypass"] })));
      expect(result.status).toBe(400);
      expect(provider.calls).toHaveLength(0);
    },
  );

  it.each(["targetFingerprint", "permissionFingerprint"])(
    "rejects browser-supplied %s instead of using it for authority",
    async (field) => {
      const provider = new RecordingProvider();
      const handler = createServerAiProposalHandler({
        authority: authority(),
        selectProvider: () => provider,
      });
      const result = await handler(request(body({ [field]: "forged-browser-fingerprint" })));
      expect(result.status).toBe(400);
      expect(provider.calls).toHaveLength(0);
    },
  );

  it("requires server authorization before repository context is resolved", async () => {
    const provider = new RecordingProvider();
    const protectedAuthority = createProjectRepositoryAiAuthorityResolver({
      repository: repository(),
      authorizer: {
        assertAuthorized: () => Promise.reject(new ServerAiAuthorityError("unauthorized")),
      },
    });
    const handler = createServerAiProposalHandler({
      authority: protectedAuthority,
      selectProvider: () => provider,
    });
    const result = await handler(request());
    expect(result.status).toBe(401);
    expect(provider.calls).toHaveLength(0);
  });

  it("propagates request cancellation to the selected provider", async () => {
    const provider = new RecordingProvider();
    const handler = createServerAiProposalHandler({
      authority: authority(),
      selectProvider: () => provider,
    });
    const controller = new AbortController();
    const pending = handler(request(body(), controller.signal));
    controller.abort();
    await pending;
    expect(provider.signals[0]?.aborted).toBe(true);
  });

  it("does not mutate active, stored, or published state after provider failure", async () => {
    const value = repository();
    const before = await value.get(aurumNordicSeed.project.id);
    const provider: AIProvider = {
      proposeChange: () => Promise.reject(new Error("raw provider failure")),
    };
    const handler = createServerAiProposalHandler({
      authority: authority(value),
      selectProvider: () => provider,
    });
    const result = await handler(request());
    const payload: unknown = await result.json();
    const after = await value.get(aurumNordicSeed.project.id);
    expect(result.status).toBe(503);
    expect(payload).toEqual({
      ok: false,
      failure: { category: "unexpectedProviderFailure" },
    });
    expect(payload).not.toHaveProperty("proposal");
    expect(after).toEqual(before);
  });

  it("keeps provider selection server-owned and invokes it only after authority succeeds", async () => {
    const selectProvider = vi.fn(() => createDeterministicMockAIProvider());
    const handler = createServerAiProposalHandler({
      authority: authority(),
      selectProvider,
    });
    await handler(request());
    expect(selectProvider).toHaveBeenCalledOnce();

    const rejected = createServerAiProposalHandler({
      authority: {
        resolve: () => Promise.reject(new ServerAiAuthorityError("identityMismatch")),
      },
      selectProvider,
    });
    await rejected(request());
    expect(selectProvider).toHaveBeenCalledOnce();
  });
});
