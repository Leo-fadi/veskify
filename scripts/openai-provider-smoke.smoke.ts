import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { requestAiProposal } from "@/application/ai-provider";
import { buildAiOperationRequest } from "@/application/ai-proposal-generation";
import { createStorefrontRenderContext } from "@/components/registry";
import { aurumNordicSeed } from "@/data/seed";
import { selectServerAiProvider } from "@/integrations/ai/openai/openai-client.server";

const smokeEnabled =
  process.env.VESKIFY_REAL_PROVIDER_SMOKE === "1" && Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!smokeEnabled)("opt-in real OpenAI provider smoke", () => {
  it("returns one validated, non-mutating proposal and prints safe metadata only", async () => {
    const page = aurumNordicSeed.draftSnapshot.pages.find(
      (candidate) => candidate.type === "home",
    )!;
    const heroId = page.sections.find((section) => section.component === "hero")!.id;
    const provider = selectServerAiProvider({
      environment: { ...process.env, VESKIFY_AI_PROVIDER: "openai" },
    });
    const canonicalRequest = buildAiOperationRequest({
      projectId: aurumNordicSeed.project.id,
      draftSnapshotId: aurumNordicSeed.draftSnapshot.id,
      draftRevision: aurumNordicSeed.draftSnapshot.revision,
      page: structuredClone(page),
      target: { type: "section", pageId: page.id, sectionId: heroId },
      merchantInstruction: "Make this hero heading feel warmer while keeping it concise.",
      activeLocale: "en",
      enabledLocales: [...aurumNordicSeed.project.enabledLocales],
      brandSystem: structuredClone(aurumNordicSeed.draftSnapshot.brandSystem),
      displayContext: createStorefrontRenderContext({
        activeLocale: "en",
        primaryLocale: aurumNordicSeed.project.primaryLocale,
        catalogue: aurumNordicSeed.catalogue,
        snapshot: aurumNordicSeed.draftSnapshot,
      }),
      importedContent: [],
      provider,
    });

    const before = structuredClone(aurumNordicSeed.draftSnapshot);
    const result = await requestAiProposal(provider, canonicalRequest);
    expect(result.proposal.metadata.validation).toBe("valid");
    expect(aurumNordicSeed.draftSnapshot).toEqual(before);
    console.info(
      JSON.stringify({
        providerId: result.proposal.providerId,
        providerRequestId: result.proposal.providerRequestId,
        operationCount: result.proposal.metadata.operationCount,
        durationMs: result.proposal.metadata.durationMs,
        validation: result.proposal.metadata.validation,
      }),
    );
  });
});
