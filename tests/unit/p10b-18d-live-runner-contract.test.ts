import { describe, expect, it } from "vitest";
import {
  P10B18D_ACCEPTANCE_PROJECT_ID,
  P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION,
  P10B18D_LIVE_ACCEPTANCE_MODEL,
  P10B18D_MOCK_MODEL,
  p10b18dConceptsForRunner,
  p10b18dExpectedAcceptanceStatus,
} from "../helpers/p10b-18d-live-commercial-acceptance";
import { parseP10B18DAcceptanceInspectionResponse } from "../helpers/p10b-18d-live-safe-evidence";
import {
  assertP10B18DDistinctPageRoles,
  buildP10B18DPreviewUrl,
  p10b18dCaptureSurfaces,
  p10b18dSafePreviewRouteIdentity,
  runP10B18DCandidateEvidenceSequence,
} from "../helpers/p10b-18d-preview-evidence";

function inspectionResponse(kind: "mock" | "openai") {
  const modelId = kind === "mock" ? P10B18D_MOCK_MODEL : P10B18D_LIVE_ACCEPTANCE_MODEL;
  return {
    ok: true,
    acceptance: {
      namespace: "p10b-16p-04-real-studio-design-intent-v2-acceptance",
      projectId: P10B18D_ACCEPTANCE_PROJECT_ID,
      callBudget: P10B18D_LIVE_ACCEPTANCE_CALLS_PER_SESSION,
      providerCallCount: 0,
      retryCount: 0,
      status: "ready",
      failureClassification: null,
      activeAttempt: null,
      failedAttempt: null,
      provider: {
        providerId: "openai-prompted-storefront-design-intent-v2",
        modelId,
        category: "eligible",
        credentialsAvailable: kind === "openai",
        timeoutMs: 120_000,
        boundedTimeout: true,
        retryCount: 0,
        internalTransportDiagnostic: "strip",
      },
      selectedTransport: {
        kind,
        providerId: "openai-prompted-storefront-design-intent-v2",
        modelId,
        internalTransportDiagnostic: "strip",
      },
      cases: [],
      internalAcceptanceDiagnostic: "strip",
    },
    acceptanceToken: "strip",
  };
}

describe("P10B-18D live runner response and execution contract", () => {
  it("unwraps the exact P04 inspection response and strips unrelated fields", () => {
    for (const kind of ["mock", "openai"] as const) {
      const parsed = parseP10B18DAcceptanceInspectionResponse(inspectionResponse(kind));
      expect(parsed).toMatchObject({
        projectId: P10B18D_ACCEPTANCE_PROJECT_ID,
        selectedTransport: { kind },
        providerCallCount: 0,
        cases: [],
      });
      expect(parsed).not.toHaveProperty("internalAcceptanceDiagnostic");
      expect(parsed.provider).not.toHaveProperty("internalTransportDiagnostic");
      expect(parsed.selectedTransport).not.toHaveProperty("internalTransportDiagnostic");
      expect(parsed).not.toHaveProperty("acceptanceToken");
    }
  });

  it("rejects an unwrapped, negative, or malformed inspection response", () => {
    const valid = inspectionResponse("mock");
    expect(() => parseP10B18DAcceptanceInspectionResponse(valid.acceptance)).toThrow();
    expect(() => parseP10B18DAcceptanceInspectionResponse({ ok: false })).toThrow();
    expect(() =>
      parseP10B18DAcceptanceInspectionResponse({
        ...valid,
        acceptance: { ...valid.acceptance, providerCallCount: undefined },
      }),
    ).toThrow();
  });

  it("limits the mocked runner to Concept 1 while preserving both live sessions", () => {
    expect(
      p10b18dConceptsForRunner({ sessionId: "A", live: false }).map(({ ordinal }) => ordinal),
    ).toEqual([1]);
    expect(() => p10b18dConceptsForRunner({ sessionId: "B", live: false })).toThrow(
      /restricted to Session A Concept 1/,
    );
    expect(p10b18dConceptsForRunner({ sessionId: "A", live: true })).toHaveLength(3);
    expect(p10b18dConceptsForRunner({ sessionId: "B", live: true })).toHaveLength(3);
  });

  it("resumes only after an already-consumed locked live concept", () => {
    expect(
      p10b18dConceptsForRunner({ sessionId: "A", live: true, resumeAfterOrdinal: 1 }).map(
        ({ ordinal }) => ordinal,
      ),
    ).toEqual([2, 3]);
    expect(
      p10b18dConceptsForRunner({ sessionId: "B", live: true, resumeAfterOrdinal: 4 }).map(
        ({ ordinal }) => ordinal,
      ),
    ).toEqual([5, 6]);
    expect(() =>
      p10b18dConceptsForRunner({ sessionId: "A", live: true, resumeAfterOrdinal: 4 }),
    ).toThrow(/outside the remaining session matrix/);
    expect(() =>
      p10b18dConceptsForRunner({ sessionId: "A", live: false, resumeAfterOrdinal: 1 }),
    ).toThrow(/cannot resume a live call matrix/);
  });

  it("derives terminal inspection status from calls made by the current process", () => {
    expect(p10b18dExpectedAcceptanceStatus(1)).toBe("ready");
    expect(p10b18dExpectedAcceptanceStatus(2)).toBe("ready");
    expect(p10b18dExpectedAcceptanceStatus(3)).toBe("complete");
    expect(() => p10b18dExpectedAcceptanceStatus(0)).toThrow(/outside the acceptance budget/);
    expect(() => p10b18dExpectedAcceptanceStatus(4)).toThrow(/outside the acceptance budget/);
  });

  it("captures candidate evidence before Reject or the full terminal lifecycle", async () => {
    const stages: string[] = [];
    await runP10B18DCandidateEvidenceSequence({
      persistSafeEvidence: () => {
        stages.push("persist-safe-evidence");
        return Promise.resolve();
      },
      captureCandidate: () => {
        stages.push("capture-candidate");
        return Promise.resolve();
      },
      assertControlContinuity: () => {
        stages.push("assert-control-continuity");
        return Promise.resolve();
      },
      completeTerminalLifecycle: () => {
        stages.push("terminal-lifecycle");
        return Promise.resolve();
      },
    });
    expect(stages).toEqual([
      "persist-safe-evidence",
      "capture-candidate",
      "assert-control-continuity",
      "terminal-lifecycle",
    ]);
  });

  it("keeps Studio control and evidence roles distinct through capture and close", async () => {
    const controlPage = {
      url: "/projects/project_p10b16p04_aurum_commercial_acceptance/editor?locale=en",
      documentMarker: "control-document",
      candidateFingerprint: "v1_123_candidate",
      rejectAvailable: true,
      closed: false,
    };
    const evidencePage = { url: "about:blank", closed: false };
    expect(() => assertP10B18DDistinctPageRoles(controlPage, controlPage)).toThrow(
      /must be distinct/,
    );
    expect(() => assertP10B18DDistinctPageRoles(controlPage, evidencePage)).not.toThrow();

    const initialControlState = { ...controlPage };
    await runP10B18DCandidateEvidenceSequence({
      persistSafeEvidence: () => Promise.resolve(),
      captureCandidate: () => {
        evidencePage.url =
          "/projects/project_p10b16p04_aurum_commercial_acceptance/cart?p10b-16p-04-proposal=v1_123_candidate&locale=en&p10b-16p-04-utility=populated";
        evidencePage.closed = true;
        return Promise.resolve();
      },
      assertControlContinuity: () => {
        expect(controlPage).toEqual(initialControlState);
        expect(evidencePage.closed).toBe(true);
        return Promise.resolve();
      },
      completeTerminalLifecycle: () => {
        controlPage.rejectAvailable = false;
        return Promise.resolve();
      },
    });
    expect(controlPage.url).toBe(initialControlState.url);
    expect(controlPage.candidateFingerprint).toBe(initialControlState.candidateFingerprint);
    expect(controlPage.closed).toBe(false);
    expect(controlPage.rejectAvailable).toBe(false);
  });

  it("binds every candidate surface to the exact proposal fingerprint", () => {
    const candidateFingerprint = "v1_123_candidate";
    for (const surface of p10b18dCaptureSurfaces) {
      const route = new URL(
        buildP10B18DPreviewUrl({
          baseUrl: "http://localhost:3144",
          surface,
          kind: "candidate",
          candidateFingerprint,
        }),
      );
      expect(route.searchParams.get("p10b-16p-04-proposal")).toBe(candidateFingerprint);
      expect(route.searchParams.get("locale")).toBe("en");
      expect(p10b18dSafePreviewRouteIdentity(route.toString())).toContain(candidateFingerprint);
      expect(p10b18dSafePreviewRouteIdentity(route.toString())).not.toMatch(
        /token|credential|secret/,
      );
    }
  });

  it("preserves cart utility and locale authority without mislabelling raw-draft routes", () => {
    const cart = p10b18dCaptureSurfaces.find(({ id }) => id === "cart");
    if (!cart) throw new Error("Expected the cart capture surface.");
    const candidate = new URL(
      buildP10B18DPreviewUrl({
        baseUrl: "http://localhost:3144",
        surface: cart,
        kind: "candidate",
        candidateFingerprint: "v1_123_candidate",
      }),
    );
    expect(candidate.searchParams.get("p10b-16p-04-utility")).toBe("populated");
    expect(candidate.searchParams.get("locale")).toBe("en");
    expect(candidate.searchParams.get("p10b-16p-04-proposal")).toBe("v1_123_candidate");

    const rawDraft = new URL(
      buildP10B18DPreviewUrl({
        baseUrl: "http://localhost:3144",
        surface: cart,
        kind: "raw-draft",
      }),
    );
    expect(rawDraft.searchParams.get("p10b-16p-04-utility")).toBe("populated");
    expect(rawDraft.searchParams.get("locale")).toBe("en");
    expect(rawDraft.searchParams.has("p10b-16p-04-proposal")).toBe(false);
  });

  it("permits exactly the two unconsumed calls after Concept 4", () => {
    const remaining = p10b18dConceptsForRunner({
      sessionId: "B",
      live: true,
      resumeAfterOrdinal: 4,
    });
    expect(remaining.map(({ ordinal }) => ordinal)).toEqual([5, 6]);
    expect(remaining).toHaveLength(2);
  });

  it("blocks Concepts 1-5 and permits exactly one final call after Concept 5", () => {
    const remaining = p10b18dConceptsForRunner({
      sessionId: "B",
      live: true,
      resumeAfterOrdinal: 5,
    });
    expect(remaining.map(({ ordinal }) => ordinal)).toEqual([6]);
    expect(remaining).toHaveLength(1);
  });
});
