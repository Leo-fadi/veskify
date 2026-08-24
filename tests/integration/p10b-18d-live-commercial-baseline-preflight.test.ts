// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createP10B16P04WholeStorefrontProposalRouteHandler } from "@/app/api/ai/whole-storefront-proposals/p10b-16p-04-composition.server";
import { StorefrontProposalAcceptanceCoordinator } from "@/application/ai-storefront";
import {
  PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
  PROMPTED_STOREFRONT_STUDIO_OPERATION,
  promptedStorefrontStudioGenerationResponseSchema,
} from "@/application/prompted-storefront-studio";
import { promptedStorefrontPromptFingerprint } from "@/application/prompted-storefront-design-intent";
import {
  P10B16P04_COMMERCIAL_CONTEXTS,
  P10B16P04_COMMERCIAL_DRAFT_ID,
  P10B16P04_COMMERCIAL_LOCALE,
  P10B16P04_COMMERCIAL_PROJECT_ID,
  createP10B16P04RawAurumCommercialFixture,
} from "@/data/demo/p10b-16p-04-commercial-acceptance";
import { canonicalStorefrontContentFingerprint, canonicalValueString } from "@/domain/storefront";
import {
  P10B_16P_04_ACCEPTANCE_TOKEN_HEADER,
  P10B_16P_04_LOCAL_ACCEPTANCE_FLAG,
  P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN,
  P10B_16P_04_MOCK_MODEL_ID,
  P10B_16P_04_MOCK_TRANSPORT_FLAG,
  P10B_16P_04_PROVIDER_CALL_BUDGET,
  inspectP10B16P04RealStudioAcceptance,
  loadP10B16P04ProposalPreviewAuthority,
  resetP10B16P04RealStudioAcceptanceStateForTests,
} from "@/integrations/ai/p10b-16p-04-real-studio-acceptance-authority.server";
import {
  P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION,
  P10B18D_LIVE_ACCEPTANCE_MAX_CALLS,
  p10b18dAcceptanceSessions,
  p10b18dConceptsForSession,
  p10b18dLockedConcepts,
  p10b18dNaturalLanguageIntentDifferences,
} from "../helpers/p10b-18d-live-commercial-acceptance";

const origin = "http://localhost:3118";
const acceptanceToken = "p10b18d-mocked-preflight-token-00000001";
const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_AI_PROVIDER: "openai",
  [P10B_16P_04_LOCAL_ACCEPTANCE_FLAG]: "1",
  [P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN]: acceptanceToken,
  [P10B_16P_04_MOCK_TRANSPORT_FLAG]: "1",
} as const;

function acceptanceHeaders(): Headers {
  return new Headers({ [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: acceptanceToken });
}

function proposalRequest(input: { requestId: string; merchantPrompt: string }): Request {
  return new Request(`${origin}/api/ai/whole-storefront-proposals`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      [P10B_16P_04_ACCEPTANCE_TOKEN_HEADER]: acceptanceToken,
    },
    body: JSON.stringify({
      operation: PROMPTED_STOREFRONT_STUDIO_OPERATION,
      contractVersion: PROMPTED_STOREFRONT_STUDIO_CONTRACT_VERSION,
      requestId: input.requestId,
      projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
      draftSnapshotId: P10B16P04_COMMERCIAL_DRAFT_ID,
      draftRevision: 0,
      activeLocale: P10B16P04_COMMERCIAL_LOCALE,
      targetScope: "storefront",
      merchantPrompt: input.merchantPrompt,
    }),
  });
}

function canonicalFingerprintLength(fingerprint: string, prefix: string): number {
  const match = new RegExp(`^${prefix}-v1_(\\d+)_`).exec(fingerprint);
  if (!match?.[1]) throw new Error(`Unexpected canonical fingerprint: ${fingerprint}.`);
  return Number(match[1]);
}

describe("P10B-18D live commercial baseline zero-call authority", () => {
  beforeEach(() => resetP10B16P04RealStudioAcceptanceStateForTests());

  it("keeps six materially distinct locked merchant intentions in two bounded sessions", () => {
    expect(p10b18dLockedConcepts).toHaveLength(P10B18D_LIVE_ACCEPTANCE_MAX_CALLS);
    expect(p10b18dAcceptanceSessions).toHaveLength(2);
    expect(p10b18dAcceptanceSessions.flatMap(({ conceptIds }) => conceptIds)).toEqual(
      p10b18dLockedConcepts.map(({ id }) => id),
    );
    expect(
      p10b18dAcceptanceSessions.every(
        ({ conceptIds }) => conceptIds.length === P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION,
      ),
    ).toBe(true);
    expect(new Set(p10b18dLockedConcepts.map(({ prompt }) => prompt)).size).toBe(6);
    expect(
      p10b18dNaturalLanguageIntentDifferences().every(
        ({ differingDimensions }) => differingDimensions.length >= 2,
      ),
    ).toBe(true);
    expect(p10b18dNaturalLanguageIntentDifferences()).toHaveLength(15);
    for (const { prompt } of p10b18dLockedConcepts) {
      expect(prompt).not.toMatch(
        /p10b|profile id|component id|blueprint id|frame id|anatomy id|registry key/i,
      );
    }
  });

  it.each(p10b18dAcceptanceSessions)(
    "executes mocked session $id through three isolated canonical Studio proposals",
    async ({ id: sessionId }) => {
      const fixture = createP10B16P04RawAurumCommercialFixture();
      const aggregateBefore = canonicalValueString(fixture.aggregate);
      const rawFingerprint = canonicalStorefrontContentFingerprint(fixture.rawDraft);
      const published = fixture.aggregate.snapshots.find(
        ({ id }) => id === fixture.aggregate.project.publishedSnapshotId,
      );
      if (!published) throw new Error("The P10B-18D fixture requires a published snapshot.");
      const route = createP10B16P04WholeStorefrontProposalRouteHandler({ environment });
      const concepts = p10b18dConceptsForSession(sessionId);
      const safeCases: Array<{
        conceptId: string;
        promptFingerprint: string;
        requestFingerprint: string;
        intentFingerprint: string;
        structuralFingerprint: string;
        candidateSnapshotFingerprint: string;
        providerEnvelopeCanonicalLength: number;
      }> = [];

      expect(inspectP10B16P04RealStudioAcceptance(environment)).toMatchObject({
        providerCallCount: 0,
        retryCount: 0,
        status: "ready",
        cases: [],
        selectedTransport: {
          kind: "mock",
          modelId: P10B_16P_04_MOCK_MODEL_ID,
        },
      });

      for (const [index, concept] of concepts.entries()) {
        const response = await route(
          proposalRequest({
            requestId: `p10b18d-mocked-${sessionId.toLowerCase()}-${concept.ordinal}`,
            merchantPrompt: concept.prompt,
          }),
        );
        const result = promptedStorefrontStudioGenerationResponseSchema.parse(
          await response.json(),
        );

        expect(response.status).toBe(200);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(`Mocked Concept ${concept.ordinal} failed to compile.`);
        expect(result.lineage).toMatchObject({
          providerId: "openai-prompted-storefront-design-intent-v2",
          modelId: P10B_16P_04_MOCK_MODEL_ID,
          providerCallCount: 1,
          retryCount: 0,
          materializationCount: 1,
          promptFingerprint: promptedStorefrontPromptFingerprint(concept.prompt),
        });
        expect(result.lineage.protectedCommerceAfterFingerprint).toBe(
          result.lineage.protectedCommerceBeforeFingerprint,
        );
        expect(result.lineage.protectedMediaAfterFingerprint).toBe(
          result.lineage.protectedMediaBeforeFingerprint,
        );
        expect(result.proposal.proposal.status).toBe("pending");
        expect(result.proposal.metadata.operationCount).toBe(1);
        expect(canonicalStorefrontContentFingerprint(fixture.rawDraft)).toBe(rawFingerprint);
        expect(canonicalValueString(fixture.aggregate)).toBe(aggregateBefore);

        const inspection = inspectP10B16P04RealStudioAcceptance(environment);
        expect(inspection).toMatchObject({
          providerCallCount: index + 1,
          retryCount: 0,
          failureClassification: null,
          activeAttempt: null,
          selectedTransport: {
            kind: "mock",
            providerId: "openai-prompted-storefront-design-intent-v2",
            modelId: P10B_16P_04_MOCK_MODEL_ID,
          },
        });
        expect(inspection.cases).toHaveLength(index + 1);
        const caseEvidence = inspection.cases[index];
        if (!caseEvidence)
          throw new Error(`Mocked Concept ${concept.ordinal} evidence is missing.`);
        expect(caseEvidence).toMatchObject({
          caseNumber: index + 1,
          providerCallCount: index + 1,
          retryCount: 0,
          promptFingerprint: promptedStorefrontPromptFingerprint(concept.prompt),
          requestFingerprint: result.lineage.requestFingerprint,
          intentFingerprint: result.lineage.providerIntentFingerprint,
          candidateSnapshotFingerprint: result.lineage.candidateSnapshotFingerprint,
          protectedCommerce: "unchanged",
          canonicalProductMedia: "unchanged",
          materializationCount: 1,
          sdkTransportEntryCount: 1,
        });
        expect(caseEvidence.currentAuthorityFingerprints.length).toBeGreaterThan(0);
        expect(caseEvidence.providerInputFingerprint).toMatch(/^openai-input-v1_/);
        expect(caseEvidence.providerSchemaFingerprint).toMatch(/^openai-semantic-schema-v1_/);
        const envelopeFingerprint = caseEvidence.providerRequestEnvelopeFingerprint;
        if (envelopeFingerprint === undefined) {
          throw new Error("Expected the provider request-envelope fingerprint.");
        }
        expect(envelopeFingerprint).toMatch(/^openai-envelope-v1_/);
        expect(caseEvidence.providerRequestFingerprint).toMatch(/^openai-response-v1_/);

        const proposalAggregate = loadP10B16P04ProposalPreviewAuthority({
          projectId: P10B16P04_COMMERCIAL_PROJECT_ID,
          candidateFingerprint: result.lineage.candidateSnapshotFingerprint,
          httpHeaders: acceptanceHeaders(),
          environment,
        });
        const proposalDraft = proposalAggregate?.snapshots.find(
          ({ id }) => id === proposalAggregate.project.draftSnapshotId,
        );
        if (!proposalDraft) {
          throw new Error(`Mocked Concept ${concept.ordinal} proposal authority is missing.`);
        }
        expect(canonicalStorefrontContentFingerprint(proposalDraft)).toBe(
          result.lineage.candidateSnapshotFingerprint,
        );
        expect(proposalDraft.pages.some(({ type }) => type === "home")).toBe(true);
        expect(proposalDraft.pages.some(({ type }) => type === "content")).toBe(true);
        expect(proposalDraft.pages.some(({ type }) => type === "cart")).toBe(true);
        expect(proposalDraft.pages.some(({ type }) => type === "checkout")).toBe(true);
        expect(caseEvidence.selection.staticContentSupportSelections.length).toBeGreaterThan(0);
        expect(caseEvidence.selection.utilityPresentationSelections.length).toBeGreaterThan(0);
        expect(caseEvidence.selection.profiles.homepage).toEqual(expect.any(String));
        expect(caseEvidence.selection.profiles.collection).toEqual(expect.any(String));
        expect(caseEvidence.selection.profiles.search).toEqual(expect.any(String));
        expect(caseEvidence.selection.profiles.productDetail).toEqual(expect.any(String));
        expect(caseEvidence.selection.dynamicCommerce.searchExecution).toBe(
          "canonical-transient-query-results",
        );

        const dynamicAuthority = proposalDraft.dynamicCommercePresentation;
        if (!dynamicAuthority) {
          throw new Error(`Mocked Concept ${concept.ordinal} dynamic authority is missing.`);
        }
        expect(dynamicAuthority.routeInventory.some(({ kind }) => kind === "collection")).toBe(
          true,
        );
        expect(dynamicAuthority.searchArchetypeId).toBe(
          caseEvidence.selection.dynamicCommerce.searchArchetypeId,
        );
        expect(
          dynamicAuthority.routeInventory.some(
            (route) =>
              route.kind === "product" &&
              route.productId === P10B16P04_COMMERCIAL_CONTEXTS.simpleProduct.productId,
          ),
        ).toBe(true);
        expect(
          dynamicAuthority.routeInventory.some(
            (route) =>
              route.kind === "product" &&
              route.productId === P10B16P04_COMMERCIAL_CONTEXTS.configurableProduct.productId,
          ),
        ).toBe(true);
        expect(
          caseEvidence.selection.dynamicCommerce.selectedArchetypes.standardSimple,
        ).toMatchObject({ component: "dynamicProductDetail" });
        expect(
          caseEvidence.selection.dynamicCommerce.selectedArchetypes.configurable,
        ).toMatchObject({ component: "dynamicProductDetail" });

        const coordinator = new StorefrontProposalAcceptanceCoordinator({
          proposal: result.proposal.proposal,
          activeDraft: fixture.rawDraft,
          storedDraft: fixture.rawDraft,
          publishedSnapshot: published,
          catalogue: fixture.aggregate.catalogue,
          enabledLocales: fixture.aggregate.project.enabledLocales,
          activeLocale: P10B16P04_COMMERCIAL_LOCALE,
          primaryLocale: fixture.aggregate.project.primaryLocale,
        });
        const rejected = coordinator.reject();
        expect(rejected.state).toBe("rejected");
        expect(rejected.transaction).toBeNull();
        expect(coordinator.inspectHistory()).toEqual({ past: [], future: [] });
        expect(canonicalStorefrontContentFingerprint(rejected.activeDraft)).toBe(rawFingerprint);
        expect(canonicalStorefrontContentFingerprint(rejected.storedDraft)).toBe(rawFingerprint);
        expect(canonicalValueString(fixture.aggregate)).toBe(aggregateBefore);

        safeCases.push({
          conceptId: concept.id,
          promptFingerprint: caseEvidence.promptFingerprint,
          requestFingerprint: caseEvidence.requestFingerprint,
          intentFingerprint: caseEvidence.intentFingerprint,
          structuralFingerprint: caseEvidence.structuralFingerprint,
          candidateSnapshotFingerprint: caseEvidence.candidateSnapshotFingerprint,
          providerEnvelopeCanonicalLength: canonicalFingerprintLength(
            envelopeFingerprint,
            "openai-envelope",
          ),
        });
      }

      expect(inspectP10B16P04RealStudioAcceptance(environment)).toMatchObject({
        providerCallCount: P10B_16P_04_PROVIDER_CALL_BUDGET,
        retryCount: 0,
        status: "complete",
        failureClassification: null,
        activeAttempt: null,
        failedAttempt: null,
      });
      expect(safeCases).toHaveLength(P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION);
      console.info(
        "P10B-18D zero-call mocked session evidence",
        JSON.stringify({ sessionId, realProviderCalls: 0, cases: safeCases }),
      );
    },
    120_000,
  );
});
