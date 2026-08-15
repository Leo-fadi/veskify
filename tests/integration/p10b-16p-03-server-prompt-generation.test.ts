// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWholeStorefrontPlanningRouteHandler } from "@/app/api/ai/whole-storefront-proposals/handler";
import { createP10B16P03WholeStorefrontProposalRouteHandler } from "@/app/api/ai/whole-storefront-proposals/p10b-16p-03-composition.server";
import type { AiStorefrontProjection } from "@/application/ai-storefront";
import {
  PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
  PROMPTED_STOREFRONT_STUDIO_OPERATION,
  promptedStorefrontStudioGenerationRequestSchema,
  promptedStorefrontStudioGenerationResponseSchema,
} from "@/application/prompted-storefront-studio";
import { runPromptedStorefrontDesignCompilation } from "@/application/prompted-storefront-design-compiler";
import { promptedStorefrontPromptFingerprint } from "@/application/prompted-storefront-design-intent";
import {
  P10B16P03_DRAFT_ID,
  P10B16P03_PROJECT_ID,
  createP10B16P03RawKarvonenStudioFixture,
} from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
} from "@/domain/storefront";
import {
  P10B16P03_MOCK_PROMPTED_STOREFRONT_PROVIDER_ID,
  createP10B16P03MockPromptedStorefrontDesignIntentProvider,
  selectP10B16P03MockPromptScenario,
} from "@/integrations/ai/mock-prompted-storefront-design-intent-v2-provider.server";
import {
  createP10B16P03ServerPromptedStorefrontStudioAuthority,
  loadP10B16P03CurrentEvidenceReferences,
  loadP10B16P03InitialDraftAuthority,
} from "@/integrations/ai/prompted-storefront-studio-authority.server";
import { projectPromptedStorefrontCompilationToStudioProposal } from "@/integrations/ai/prompted-storefront-studio-handler.server";

const prompt =
  "Create a refined premium jewellery storefront with strong editorial storytelling, elegant product discovery, sophisticated configurable-product pages and restrained commercial hierarchy.";

type StructuralDimension =
  | "nonColourDesignDna"
  | "sharedFrame"
  | "homepage"
  | "pageSet"
  | "collection"
  | "productDetail"
  | "meaningfulVariants";

type StructuralProjection = Readonly<Record<StructuralDimension, string>>;

function pageFamilyProjection(
  snapshot: AiStorefrontProjection,
  familyId: "home" | "collection" | "product-detail",
): string {
  return canonicalValueString(
    snapshot.pages
      .filter((page) => page.pageFamily?.familyId === familyId)
      .map((page) => ({
        profileId: page.pageFamily?.profileId,
        sections: page.sections.map(({ component, variant }) => ({ component, variant })),
      })),
  );
}

function structuralProjection(snapshot: AiStorefrontProjection): StructuralProjection {
  const designDna = snapshot.brandSystem.designDna;
  const nonColourDesignDna = designDna
    ? Object.fromEntries(Object.entries(designDna).filter(([key]) => key !== "colour"))
    : null;

  return {
    nonColourDesignDna: canonicalValueString(nonColourDesignDna),
    sharedFrame: canonicalValueString(
      snapshot.sharedFrame
        ? {
            profileId: snapshot.sharedFrame.profileId,
            headerVariant: snapshot.sharedFrame.header.variant,
            footerVariant: snapshot.sharedFrame.footer.variant,
            announcementVariant: snapshot.sharedFrame.announcement?.variant,
          }
        : null,
    ),
    homepage: pageFamilyProjection(snapshot, "home"),
    pageSet: canonicalValueString(
      snapshot.pages.map((page) => ({
        familyId: page.pageFamily?.familyId,
        profileId: page.pageFamily?.profileId,
      })),
    ),
    collection: canonicalValueString(
      snapshot.dynamicCommercePresentation
        ? {
            collectionRouteMappings: snapshot.dynamicCommercePresentation.collectionRouteMappings,
            collectionContextRules: snapshot.dynamicCommercePresentation.collectionContextRules,
            searchArchetypeId: snapshot.dynamicCommercePresentation.searchArchetypeId,
          }
        : null,
    ),
    productDetail: canonicalValueString(
      snapshot.dynamicCommercePresentation
        ? {
            productTypeMappings: snapshot.dynamicCommercePresentation.productTypeMappings,
            productComplexityRules: snapshot.dynamicCommercePresentation.productComplexityRules,
            fallback: snapshot.dynamicCommercePresentation.fallbacks.productDetailArchetypeId,
          }
        : null,
    ),
    meaningfulVariants: canonicalValueString(
      snapshot.pages.flatMap((page) =>
        page.sections.map(({ component, variant }) => ({ component, variant })),
      ),
    ),
  };
}

function request(
  body: Record<string, unknown> = {},
  headers: Readonly<Record<string, string>> = {},
) {
  return new Request("http://localhost/api/ai/whole-storefront-proposals", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      operation: PROMPTED_STOREFRONT_STUDIO_OPERATION,
      contractVersion: PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
      requestId: "p10b16p03-studio-request",
      projectId: P10B16P03_PROJECT_ID,
      draftSnapshotId: P10B16P03_DRAFT_ID,
      draftRevision: 0,
      activeLocale: "en",
      targetScope: "storefront",
      merchantPrompt: prompt,
      ...body,
    }),
  });
}

describe("P10B-16P-03 canonical server prompt generation", () => {
  it("selects the bounded mock direction from semantic merchant intent with a safe default", () => {
    expect(selectP10B16P03MockPromptScenario("Give the brand an elegant story-led posture.")).toBe(
      "premium-editorial",
    );
    expect(
      selectP10B16P03MockPromptScenario(
        "Prioritise precise technical comparison in a dense catalogue.",
      ),
    ).toBe("modern-technical");
    expect(
      selectP10B16P03MockPromptScenario(
        "Keep the purchase path uncluttered, quiet and conversion-led.",
      ),
    ).toBe("minimal-commerce");
    expect(selectP10B16P03MockPromptScenario("Create a coherent complete storefront.")).toBe(
      "premium-editorial",
    );
    expect(selectP10B16P03MockPromptScenario("Use editorial and technical cues.")).toBe(
      "premium-editorial",
    );
  });

  it("resolves current evidence only from exact standalone server authority", async () => {
    const fixture = createP10B16P03RawKarvonenStudioFixture();
    const current = await loadP10B16P03CurrentEvidenceReferences({
      projectId: P10B16P03_PROJECT_ID,
      environment: { VESKIFY_RUNTIME_MODE: "standalone" },
    });
    expect(current).toEqual(fixture.approvedEvidenceReferences);
    current[0].revision = "locally-mutated";
    expect(
      await loadP10B16P03CurrentEvidenceReferences({
        projectId: P10B16P03_PROJECT_ID,
        environment: { VESKIFY_RUNTIME_MODE: "standalone" },
      }),
    ).toEqual(fixture.approvedEvidenceReferences);
    await expect(
      loadP10B16P03CurrentEvidenceReferences({
        projectId: "project_unknown",
        environment: { VESKIFY_RUNTIME_MODE: "standalone" },
      }),
    ).resolves.toEqual([]);
    await expect(
      loadP10B16P03CurrentEvidenceReferences({
        projectId: P10B16P03_PROJECT_ID,
        environment: { VESKIFY_RUNTIME_MODE: "integrated" },
      }),
    ).resolves.toEqual([]);
  });

  it("issues initial-generation draft authority only for the exact standalone raw project", async () => {
    const fixture = createP10B16P03RawKarvonenStudioFixture();
    await expect(
      loadP10B16P03InitialDraftAuthority({
        projectId: P10B16P03_PROJECT_ID,
        environment: { VESKIFY_RUNTIME_MODE: "standalone" },
      }),
    ).resolves.toEqual({
      draftSnapshotId: fixture.rawDraft.id,
      draftRevision: fixture.rawDraft.revision,
      contentFingerprint: canonicalStorefrontContentFingerprint(fixture.rawDraft),
    });
    await expect(
      loadP10B16P03InitialDraftAuthority({
        projectId: "project_unknown",
        environment: { VESKIFY_RUNTIME_MODE: "standalone" },
      }),
    ).resolves.toBeUndefined();
    await expect(
      loadP10B16P03InitialDraftAuthority({
        projectId: P10B16P03_PROJECT_ID,
        environment: { VESKIFY_RUNTIME_MODE: "integrated" },
      }),
    ).resolves.toBeUndefined();
  });

  it("compiles the exact raw server authority through the async reload boundary", async () => {
    const authority = createP10B16P03ServerPromptedStorefrontStudioAuthority();
    const parsedRequest = promptedStorefrontStudioGenerationRequestSchema.parse(
      await request().json(),
    );
    const context = await authority.resolve(parsedRequest, request());
    const current = await context.loadCurrentAuthority();
    const provider = createP10B16P03MockPromptedStorefrontDesignIntentProvider({
      scenario: "premium-editorial",
      compatibilityInput: current.compatibilityInput,
    });

    const result = await runPromptedStorefrontDesignCompilation({
      provider,
      loadCurrentAuthority: context.loadCurrentAuthority,
    });
    const proposal = projectPromptedStorefrontCompilationToStudioProposal({
      request: parsedRequest,
      result,
    });

    expect(result.evidence).toMatchObject({ materializationCount: 1 });
    expect(result.evidence.sourceProposalFingerprint).toBe(
      canonicalValueFingerprint(result.execution.synthesis.materialization.proposal),
    );
    expect(result.currentEvidenceReferences).toEqual(
      current.compatibilityInput.approvedEvidenceReferences,
    );
    expect(proposal.proposal.wholeStorefrontGeneration).toMatchObject({
      order: 0,
      operationType: "APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION",
      requestFingerprint: result.evidence.requestFingerprint,
      promptFingerprint: result.evidence.promptFingerprint,
      providerIntentFingerprint: result.evidence.providerIntentFingerprint,
      sourceProposalFingerprint: result.evidence.sourceProposalFingerprint,
      synthesisFingerprint: result.evidence.synthesisFingerprint,
      structuralFingerprint: result.evidence.structuralFingerprint,
      candidateSnapshotFingerprint: result.evidence.candidateSnapshotFingerprint,
      resultingSnapshotFingerprint: result.evidence.candidateSnapshotFingerprint,
    });
    expect(proposal.metadata.operationCount).toBe(1);
  }, 120_000);

  it("routes the exact compact request through one V2 provider call and one isolated proposal", async () => {
    const fixture = createP10B16P03RawKarvonenStudioFixture();
    const prompts: string[] = [];
    const route = createWholeStorefrontPlanningRouteHandler({
      promptedAuthority: createP10B16P03ServerPromptedStorefrontStudioAuthority(),
      selectPromptedProvider: vi.fn(() =>
        createP10B16P03MockPromptedStorefrontDesignIntentProvider({
          scenario: "premium-editorial",
          onRequest: (providerRequest) => prompts.push(providerRequest.merchantPrompt),
        }),
      ),
      environment: { VESKIFY_RUNTIME_MODE: "standalone" },
    });

    const response = await route(request());
    const body = promptedStorefrontStudioGenerationResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.lineage).toMatchObject({
      providerId: P10B16P03_MOCK_PROMPTED_STOREFRONT_PROVIDER_ID,
      providerCallCount: 1,
      retryCount: 0,
      materializationCount: 1,
    });
    expect(body.proposal.proposal.originalStorefront.pages).toEqual(fixture.rawDraft.pages);
    expect(body.proposal.proposal.proposedStorefront.pages.length).toBeGreaterThan(1);
    expect(body.proposal.proposal.wholeStorefrontGeneration).toMatchObject({
      target: {
        kind: "storefront",
        projectId: P10B16P03_PROJECT_ID,
        draftSnapshotId: P10B16P03_DRAFT_ID,
        draftRevision: 0,
      },
      permission: {
        skillId: "compilePromptedStorefrontDesignIntentV2",
        skillVersion: "2.0.0",
        skillScope: "storefront",
        operationTypes: ["APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION"],
      },
      sourceProposalFingerprint: body.lineage.sourceProposalFingerprint,
      candidateSnapshotFingerprint: body.lineage.candidateSnapshotFingerprint,
      resultingSnapshotFingerprint: body.lineage.candidateSnapshotFingerprint,
    });
    expect(body.currentEvidenceReferences).toEqual(fixture.approvedEvidenceReferences);
    expect(body.proposal.metadata.wholeStorefrontProposalFingerprint).toBe(
      body.lineage.sourceProposalFingerprint,
    );
    expect(prompts).toEqual([prompt]);
    expect(
      promptedStorefrontStudioGenerationResponseSchema.safeParse({
        ...body,
        lineage: {
          ...body.lineage,
          candidateSnapshotFingerprint: canonicalValueFingerprint({ spliced: true }),
        },
      }).success,
    ).toBe(false);
  }, 120_000);

  it("rejects browser-supplied authority, intents, decisions, operations and snapshots", async () => {
    const route = createP10B16P03WholeStorefrontProposalRouteHandler({
      environment: { VESKIFY_RUNTIME_MODE: "standalone" },
    });

    for (const forbidden of [
      "capabilityAuthority",
      "providerIntent",
      "compiledDecision",
      "operations",
      "snapshot",
    ]) {
      const response = await route(request({ [forbidden]: {} }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        ok: false,
        failure: { category: "validation", retryable: false },
      });
    }
  });

  it("produces distinct safe lineage for three semantic merchant directions", async () => {
    const route = createP10B16P03WholeStorefrontProposalRouteHandler({
      environment: { VESKIFY_RUNTIME_MODE: "standalone" },
    });
    const scenarios = [
      {
        id: "premium-editorial",
        prompt: "Create a story-led premium editorial jewellery storefront.",
      },
      {
        id: "modern-technical",
        prompt: "Create an information-rich technical catalogue storefront.",
      },
      {
        id: "minimal-commerce",
        prompt: "Create a restrained conversion-led minimal commerce storefront.",
      },
    ] as const;
    const outcomes: {
      scenarioId: (typeof scenarios)[number]["id"];
      lineage: Extract<
        ReturnType<typeof promptedStorefrontStudioGenerationResponseSchema.parse>,
        { ok: true }
      >["lineage"];
      structure: StructuralProjection;
    }[] = [];
    for (const [index, scenario] of scenarios.entries()) {
      const response = await route(
        request({
          requestId: `p10b16p03-scenario-${index + 1}`,
          merchantPrompt: scenario.prompt,
        }),
      );
      const body = promptedStorefrontStudioGenerationResponseSchema.parse(await response.json());
      expect(response.status, `${scenario.id}: ${JSON.stringify(body)}`).toBe(200);
      expect(body.ok).toBe(true);
      if (!body.ok) continue;
      expect(body.lineage.promptFingerprint).toBe(
        promptedStorefrontPromptFingerprint(scenario.prompt),
      );
      outcomes.push({
        scenarioId: scenario.id,
        lineage: body.lineage,
        structure: structuralProjection(body.proposal.proposal.proposedStorefront),
      });
    }

    expect(new Set(outcomes.map(({ lineage }) => lineage.providerIntentFingerprint))).toHaveLength(
      3,
    );
    expect(
      new Set(outcomes.map(({ lineage }) => lineage.compiledDecisionFingerprint)),
    ).toHaveLength(3);
    expect(new Set(outcomes.map(({ lineage }) => lineage.structuralFingerprint))).toHaveLength(3);
    expect(
      new Set(outcomes.map(({ lineage }) => lineage.candidateSnapshotFingerprint)),
    ).toHaveLength(3);

    const dimensions: StructuralDimension[] = [
      "nonColourDesignDna",
      "sharedFrame",
      "homepage",
      "pageSet",
      "collection",
      "productDetail",
      "meaningfulVariants",
    ];
    for (const [index, left] of outcomes.entries()) {
      for (const right of outcomes.slice(index + 1)) {
        const differingDimensions = dimensions.filter(
          (dimension) => left.structure[dimension] !== right.structure[dimension],
        );
        const differingSemanticDimensions = Object.entries(
          left.lineage.materialDimensionFingerprints,
        ).flatMap(([dimension, fingerprint]) =>
          right.lineage.materialDimensionFingerprints[
            dimension as keyof typeof right.lineage.materialDimensionFingerprints
          ] === fingerprint
            ? []
            : [`semantic:${dimension}`],
        );
        const materialDifferences = new Set([
          ...differingDimensions,
          ...differingSemanticDimensions,
        ]);
        expect(
          materialDifferences.size,
          `${left.scenarioId} and ${right.scenarioId} must differ across at least four supported structural dimensions`,
        ).toBeGreaterThanOrEqual(4);
      }
    }
  }, 120_000);

  it("fails closed in explicit integrated OpenAI mode and never falls back to the mock", async () => {
    const selectPromptedProvider = vi.fn();
    const route = createWholeStorefrontPlanningRouteHandler({
      selectPromptedProvider,
      environment: {
        VESKIFY_RUNTIME_MODE: "integrated",
        VESKIFY_AI_PROVIDER: "openai",
        VESKIFY_P10B_16P_03_MOCK_PROVIDER: "1",
        OPENAI_API_KEY: "not-used-because-authentication-authority-is-unavailable",
      },
    });
    const response = await route(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      failure: { category: "authenticationUnavailable", retryable: false },
    });
    expect(selectPromptedProvider).not.toHaveBeenCalled();
  });

  it.each([
    ["provider-refusal", 400, "validation"],
    ["malformed-output", 400, "validation"],
    ["strict-schema-invalid", 400, "validation"],
    ["unknown-capability", 400, "validation"],
    ["insufficient-material-intent", 400, "validation"],
    ["unsupported-hard-constraint", 400, "validation"],
    ["provider-timeout", 503, "providerUnavailable"],
    ["provider-transport", 503, "providerUnavailable"],
  ] as const)(
    "returns a typed %s failure after exactly one call with no retry or fallback",
    async (failure, expectedStatus, expectedCategory) => {
      let calls = 0;
      const route = createWholeStorefrontPlanningRouteHandler({
        promptedAuthority: createP10B16P03ServerPromptedStorefrontStudioAuthority(),
        selectPromptedProvider: () =>
          createP10B16P03MockPromptedStorefrontDesignIntentProvider({
            scenario: "premium-editorial",
            failure,
            onRequest: () => {
              calls += 1;
            },
          }),
        environment: { VESKIFY_RUNTIME_MODE: "standalone" },
      });

      const response = await route(request());

      expect(response.status).toBe(expectedStatus);
      expect(await response.json()).toEqual({
        ok: false,
        failure: {
          category: expectedCategory,
          retryable: expectedStatus === 503,
        },
      });
      expect(calls).toBe(1);
    },
  );

  it("rejects refreshed stale authority after one provider call and no materialized proposal", async () => {
    let loads = 0;
    let providerCalls = 0;
    const route = createWholeStorefrontPlanningRouteHandler({
      promptedAuthority: createP10B16P03ServerPromptedStorefrontStudioAuthority({
        loadFixture: () => {
          loads += 1;
          const fixture = createP10B16P03RawKarvonenStudioFixture();
          if (loads < 3) return fixture;
          const stale = {
            ...fixture,
            aggregate: structuredClone(fixture.aggregate),
          };
          const draft = stale.aggregate.snapshots.find(
            ({ id }) => id === stale.aggregate.project.draftSnapshotId,
          );
          if (!draft) throw new Error("Expected fixture draft.");
          draft.revision += 1;
          return stale;
        },
      }),
      selectPromptedProvider: () =>
        createP10B16P03MockPromptedStorefrontDesignIntentProvider({
          scenario: "premium-editorial",
          onRequest: () => {
            providerCalls += 1;
          },
        }),
      environment: { VESKIFY_RUNTIME_MODE: "standalone" },
    });

    const response = await route(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      failure: { category: "stale", retryable: false },
    });
    expect(providerCalls).toBe(1);
    expect(loads).toBe(3);
  });
});
