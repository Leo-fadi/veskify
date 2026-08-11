// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { StorefrontProposalAcceptanceCoordinator } from "@/application/ai-storefront";
import { assembleValidatedEditorDraft, saveValidatedEditorDraft } from "@/application/draft-save";
import {
  BoundedStorefrontSynthesisError,
  CoordinatedStorefrontDirectionError,
  P10bLiveSynthesisIntentError,
  p10bLiveSynthesisIntentProviderRequestSchema,
  type CoordinatedStorefrontDirectionId,
  type P10bLiveSynthesisIntentProvider,
} from "@/application/bounded-storefront-synthesis";
import { createP10bLiveSynthesisGenerateHandler } from "@/app/api/demo/p10b-live/generate/handler";
import { createP10B16LRawKarvonenAcceptanceFixture } from "@/data/demo/p10b-16l-live-provider-acceptance";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import {
  acceptP10bLiveSynthesisProposal,
  generateP10bLiveSynthesisAcceptance,
  inspectP10bLiveSynthesisAcceptance,
  isP10bLiveSynthesisAcceptanceConfigured,
  loadP10bLiveSynthesisEditorSession,
  loadP10bLiveSynthesisPreviewSession,
  mapP10bLiveSynthesisGenerationError,
  P10bLiveSynthesisAcceptanceError,
  p10bLiveSynthesisAcceptanceSession,
  rejectP10bLiveSynthesisProposal,
  resetP10bLiveSynthesisAcceptance,
  selectP10bLiveSynthesisAcceptanceProviderConfiguration,
  synchronizeP10bLiveSynthesisAggregate,
} from "@/integrations/ai/p10b-live-synthesis-acceptance-authority.server";
import { InMemoryProjectRepository, type ProjectAggregate } from "@/services/storage";

const token = "p10b-16l-focused-local-acceptance-token";
const environment = {
  NODE_ENV: "test",
  VESKIFY_RUNTIME_MODE: "integrated",
  VESKIFY_P10B_16L_LOCAL_ACCEPTANCE: "1",
  VESKIFY_P10B_16L_LOCAL_ACCEPTANCE_TOKEN: token,
  VESKIFY_P10B_16L_MOCK_TRANSPORT: "1",
} as const;

function aggregateWithDraft(
  aggregate: ProjectAggregate,
  draft: StorefrontSnapshot,
): ProjectAggregate {
  return {
    ...structuredClone(aggregate),
    snapshots: aggregate.snapshots.map((snapshot) =>
      snapshot.id === aggregate.project.draftSnapshotId
        ? structuredClone(draft)
        : structuredClone(snapshot),
    ),
  };
}

async function generated(directionId: CoordinatedStorefrontDirectionId | null) {
  const session = p10bLiveSynthesisAcceptanceSession(environment);
  const metadata = await generateP10bLiveSynthesisAcceptance({
    ...session,
    merchantInstruction:
      directionId === null
        ? "Create a complete coherent storefront from the approved Karvonen merchant inputs."
        : `Create a complete ${directionId} storefront from the approved Karvonen inputs.`,
    requestedDirectionId: directionId,
    providerConfiguration: selectP10bLiveSynthesisAcceptanceProviderConfiguration(environment),
    environment,
  });
  return { session, metadata };
}

describe("P10B-16L local real-provider synthesis acceptance bridge", () => {
  beforeEach(async () => {
    await resetP10bLiveSynthesisAcceptance(environment);
  });

  it("starts raw, invokes current P10B-16/P10B-15 once, and bridges the exact complete proposal through review, undo, redo, accept, save and reload", async () => {
    const fixture = createP10B16LRawKarvonenAcceptanceFixture();
    const raw = await inspectP10bLiveSynthesisAcceptance(environment);
    expect(raw.rawPresentation).toEqual({
      pageCount: 1,
      sectionCount: 0,
      hasSharedFrame: false,
      hasDesignDna: false,
      hasPageFamilySelection: false,
    });

    const { session, metadata } = await generated("premium-editorial");
    expect(metadata).toMatchObject({
      providerId: "openai-p10b-complete-storefront-synthesis-intent",
      modelId: "mocked-p10b16l-structured-intent",
      providerCallCount: 1,
      directionId: "premium-editorial",
      protectedCommerce: "unchanged",
      canonicalProductMedia: "unchanged",
      approvedAssets: "unchanged",
      validation: "valid",
    });
    expect(metadata.executableIntentId).toMatch(/^coordinated-executable-intent-/);
    expect(metadata.executableIntentFingerprint).toMatch(/^p10b-live-executable-intent-/);
    expect(metadata.pageCount).toBe(28);
    expect(metadata.pageFamilyCounts).toMatchObject({
      home: 1,
      collection: fixture.planningInput.catalogue.collections.length,
      "product-detail": fixture.planningInput.catalogue.products.length,
      about: 1,
      cart: 1,
      checkout: 1,
      "no-results": 1,
      "error-state": 1,
      "not-found": 1,
    });
    expect(metadata.editorRoute).toContain("p10b-16l-session=");
    expect(metadata.editorRoute).not.toContain("p9-05b-session=");
    expect(await inspectP10bLiveSynthesisAcceptance(environment)).toMatchObject({
      aggregateFingerprint: raw.baselineFingerprint,
      generationStatus: "generated",
      rawPresentation: { pageCount: 1, sectionCount: 0 },
    });

    const bridge = await loadP10bLiveSynthesisEditorSession({ ...session, environment });
    expect(bridge).not.toBeNull();
    expect(bridge?.kind).toBe("p10b-16l");
    expect(bridge?.proposal).not.toBeNull();
    expect(await loadP10bLiveSynthesisPreviewSession({ ...session, environment })).toBeNull();
    expect(canonicalValueString(bridge?.aggregate.catalogue)).toBe(
      canonicalValueString(fixture.aggregate.catalogue),
    );
    const draft = bridge!.aggregate.snapshots.find(
      ({ id }) => id === bridge!.aggregate.project.draftSnapshotId,
    )!;
    const published = bridge!.aggregate.snapshots.find(
      ({ id }) => id === bridge!.aggregate.project.publishedSnapshotId,
    )!;
    const coordinator = new StorefrontProposalAcceptanceCoordinator({
      proposal: bridge!.proposal,
      activeDraft: draft,
      storedDraft: draft,
      publishedSnapshot: published,
      catalogue: bridge!.aggregate.catalogue,
      enabledLocales: bridge!.aggregate.project.enabledLocales,
      activeLocale: bridge!.aggregate.project.primaryLocale,
      primaryLocale: bridge!.aggregate.project.primaryLocale,
    });
    expect(coordinator.inspect().state).toBe("ready");
    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    expect(canonicalStorefrontContentFingerprint(accepted.activeDraft)).toBe(
      metadata.snapshotFingerprint,
    );
    expect(coordinator.undo()).toEqual(draft);
    expect(coordinator.redo()).toEqual(accepted.activeDraft);

    const rawUndoRepository = new InMemoryProjectRepository([bridge!.aggregate]);
    const savedRawUndo = await saveValidatedEditorDraft({
      repository: rawUndoRepository,
      projectId: bridge!.aggregate.project.id,
      loadedDraft: draft,
      replacementSnapshot: bridge!.rawDraft,
      primaryLocale: bridge!.aggregate.project.primaryLocale,
      evidenceReferences: bridge!.evidenceReferences,
      now: () => new Date("2026-08-10T11:55:00.000Z"),
      createSnapshotId: () => "snapshot_p10b16l_saved_raw_undo",
    });
    expect(canonicalStorefrontContentFingerprint(savedRawUndo.draft)).toBe(
      canonicalStorefrontContentFingerprint(bridge!.rawDraft),
    );
    expect(savedRawUndo.draft.pages).toHaveLength(1);
    expect(savedRawUndo.draft.sharedFrame).toBeUndefined();
    expect(savedRawUndo.draft.navigation).toEqual(bridge!.rawDraft.navigation);
    expect(savedRawUndo.draft.contentSupportFactDocuments).toEqual(
      bridge!.rawDraft.contentSupportFactDocuments,
    );

    expect(() =>
      assembleValidatedEditorDraft({
        baseDraft: draft,
        changedPages: accepted.activeDraft.pages,
        aggregate: bridge!.aggregate,
        primaryLocale: bridge!.aggregate.project.primaryLocale,
        brandSystem: accepted.activeDraft.brandSystem,
      }),
    ).toThrowError();
    expect(() =>
      assembleValidatedEditorDraft({
        baseDraft: draft,
        changedPages: accepted.activeDraft.pages,
        aggregate: bridge!.aggregate,
        primaryLocale: bridge!.aggregate.project.primaryLocale,
        brandSystem: accepted.activeDraft.brandSystem,
        evidenceReferences: bridge!.evidenceReferences.map((reference) => ({
          ...reference,
          revision: `${reference.revision}-stale`,
        })),
      }),
    ).toThrowError();
    const validatedAcceptedDraft = assembleValidatedEditorDraft({
      baseDraft: draft,
      changedPages: accepted.activeDraft.pages,
      aggregate: bridge!.aggregate,
      primaryLocale: bridge!.aggregate.project.primaryLocale,
      brandSystem: accepted.activeDraft.brandSystem,
      evidenceReferences: bridge!.evidenceReferences,
    });
    expect(canonicalStorefrontContentFingerprint(validatedAcceptedDraft)).toBe(
      metadata.snapshotFingerprint,
    );

    const committed = await acceptP10bLiveSynthesisProposal({
      ...session,
      proposalId: bridge!.proposal!.id,
      expectedRevision: bridge!.authoritativeRevision,
      acceptedSnapshot: accepted.activeDraft,
      environment,
    });
    expect(await loadP10bLiveSynthesisPreviewSession({ ...session, environment })).toBeNull();
    const stagingRepository = new InMemoryProjectRepository([
      aggregateWithDraft(bridge!.aggregate, accepted.activeDraft),
    ]);
    const prepared = await saveValidatedEditorDraft({
      repository: stagingRepository,
      projectId: bridge!.aggregate.project.id,
      loadedDraft: accepted.activeDraft,
      changedPages: accepted.activeDraft.pages,
      primaryLocale: bridge!.aggregate.project.primaryLocale,
      brandSystem: accepted.activeDraft.brandSystem,
      evidenceReferences: bridge!.evidenceReferences,
      now: () => new Date("2026-08-10T12:00:00.000Z"),
      createSnapshotId: () => "snapshot_p10b16l_saved_acceptance",
    });
    const saved = await synchronizeP10bLiveSynthesisAggregate({
      ...session,
      expectedRevision: committed.authoritativeRevision,
      mode: "saved",
      aggregate: prepared.aggregate,
      environment,
    });
    const reloaded = await loadP10bLiveSynthesisEditorSession({ ...session, environment });
    const reloadedDraft = reloaded!.aggregate.snapshots.find(
      ({ id }) => id === reloaded!.aggregate.project.draftSnapshotId,
    )!;
    expect(saved.authoritativeRevision).toBeGreaterThan(bridge!.authoritativeRevision);
    expect(reloaded?.proposal).toBeNull();
    expect(canonicalStorefrontContentFingerprint(reloadedDraft)).toBe(metadata.snapshotFingerprint);
    const preview = await loadP10bLiveSynthesisPreviewSession({ ...session, environment });
    const previewDraft = preview?.aggregate.snapshots.find(
      ({ id }) => id === preview.aggregate.project.draftSnapshotId,
    );
    expect(canonicalStorefrontContentFingerprint(previewDraft!)).toBe(metadata.snapshotFingerprint);
  }, 120_000);

  it("keeps synthesis scaffolding transient and restores the raw aggregate on rejection", async () => {
    const raw = await inspectP10bLiveSynthesisAcceptance(environment);
    const { session } = await generated("minimal-commerce");
    const pending = await loadP10bLiveSynthesisEditorSession({ ...session, environment });
    expect(
      pending?.aggregate.snapshots.find(
        ({ id }) => id === pending.aggregate.project.draftSnapshotId,
      )?.pages,
    ).toHaveLength(28);
    expect(pending?.proposal).not.toBeNull();
    expect(await inspectP10bLiveSynthesisAcceptance(environment)).toMatchObject({
      aggregateFingerprint: raw.baselineFingerprint,
      generationStatus: "generated",
    });

    const rejection = await rejectP10bLiveSynthesisProposal({
      ...session,
      proposalId: pending!.proposal!.id,
      expectedRevision: pending!.authoritativeRevision,
      environment,
    });
    const reloaded = await loadP10bLiveSynthesisEditorSession({ ...session, environment });
    const restoredDraft = reloaded!.aggregate.snapshots.find(
      ({ id }) => id === reloaded!.aggregate.project.draftSnapshotId,
    );
    expect(rejection.authoritativeRevision).toBeGreaterThan(pending!.authoritativeRevision);
    expect(reloaded?.proposal).toBeNull();
    expect(await loadP10bLiveSynthesisPreviewSession({ ...session, environment })).toBeNull();
    expect(restoredDraft?.pages).toHaveLength(1);
    expect(restoredDraft?.pages[0]?.sections).toEqual([]);
    expect(await inspectP10bLiveSynthesisAcceptance(environment)).toMatchObject({
      aggregateFingerprint: raw.baselineFingerprint,
      generationStatus: "rejected",
    });
  }, 120_000);

  it("produces structurally distinct named direction outcomes and supports provider choice", async () => {
    const fingerprints = new Map<CoordinatedStorefrontDirectionId, string>();
    for (const directionId of [
      "premium-editorial",
      "modern-technical",
      "minimal-commerce",
    ] as const) {
      await resetP10bLiveSynthesisAcceptance(environment);
      const { metadata } = await generated(directionId);
      expect(metadata.directionId).toBe(directionId);
      fingerprints.set(directionId, metadata.structuralDiversityFingerprint);
    }
    expect(new Set(fingerprints.values()).size).toBe(3);

    await resetP10bLiveSynthesisAcceptance(environment);
    const { metadata } = await generated(null);
    expect(metadata.directionId).toBe("modern-technical");
  }, 240_000);

  it("reuses preflight results only while post-provider authority remains exact", async () => {
    const session = p10bLiveSynthesisAcceptanceSession(environment);
    const acceptanceState = globalThis.__veskifyP10b16lLiveSynthesisAcceptanceState;
    if (!acceptanceState) throw new Error("The stale-authority test requires acceptance state.");
    const selectIntent = vi.fn<P10bLiveSynthesisIntentProvider["selectIntent"]>(async (request) => {
      const current = p10bLiveSynthesisIntentProviderRequestSchema.parse(request);
      const aggregate = await acceptanceState.repository.get(session.projectId);
      const draft = aggregate.snapshots.find(({ id }) => id === aggregate.project.draftSnapshotId);
      if (!draft) throw new Error("The stale-authority test requires the raw draft.");
      const changedDraft = structuredClone(draft);
      changedDraft.createdAt = "2026-08-10T10:00:00.001Z";
      await acceptanceState.repository.saveDraft(session.projectId, changedDraft, {
        id: draft.id,
        revision: draft.revision,
      });
      return {
        requestFingerprint: current.requestFingerprint,
        executableIntentId: current.executableIntents[0].intentId,
        executableIntentFingerprint: current.executableIntents[0].executableIntentFingerprint,
      };
    });
    const provider: P10bLiveSynthesisIntentProvider = {
      id: "post-provider-stale-authority-test",
      modelId: "mocked-post-provider-stale-authority",
      selectIntent,
    };

    await expect(
      generateP10bLiveSynthesisAcceptance({
        ...session,
        merchantInstruction: "Create a Premium Editorial storefront.",
        requestedDirectionId: "premium-editorial",
        providerConfiguration: { provider, modelId: provider.modelId, category: "eligible" },
        environment,
      }),
    ).rejects.toMatchObject({ code: "stale-authority" });
    expect(selectIntent).toHaveBeenCalledOnce();
    expect(await inspectP10bLiveSynthesisAcceptance(environment)).toMatchObject({
      authoritativeRevision: 0,
      generationStatus: "failed",
      providerCallCount: 1,
      rawPresentation: { pageCount: 1, sectionCount: 0 },
    });
    expect(
      (await loadP10bLiveSynthesisEditorSession({ ...session, environment }))?.proposal,
    ).toBeNull();
  }, 60_000);

  it("maps typed provider, coordinated-direction and synthesis failures to bounded safe categories", () => {
    const cases: Array<readonly [unknown, string]> = [
      [new P10bLiveSynthesisIntentError("stale-authority"), "stale-authority"],
      [new P10bLiveSynthesisIntentError("credentials-unavailable"), "provider-unavailable"],
      [new P10bLiveSynthesisIntentError("provider-unavailable"), "provider-unavailable"],
      [new P10bLiveSynthesisIntentError("provider-refusal"), "provider-response-invalid"],
      [new P10bLiveSynthesisIntentError("malformed-response"), "provider-response-invalid"],
      [new P10bLiveSynthesisIntentError("unsupported-selection"), "unsupported-provider-selection"],
      [
        new P10bLiveSynthesisIntentError("no-executable-compatible-intent"),
        "no-executable-compatible-intent",
      ],
      [new P10bLiveSynthesisIntentError("invalid-request"), "malformed-state"],
      [
        new CoordinatedStorefrontDirectionError(
          "stale-direction-authority",
          "raw stale direction detail",
        ),
        "stale-authority",
      ],
      [
        new CoordinatedStorefrontDirectionError(
          "invalid-direction-reference",
          "raw invalid direction detail",
        ),
        "malformed-state",
      ],
      [
        new CoordinatedStorefrontDirectionError(
          "unsupported-characteristic",
          "raw unsupported characteristic detail",
        ),
        "no-valid-coordinated-candidate",
      ],
      [
        new CoordinatedStorefrontDirectionError(
          "incompatible-direction",
          "raw incompatible direction detail",
        ),
        "no-valid-coordinated-candidate",
      ],
      [
        new CoordinatedStorefrontDirectionError("no-valid-diversity", "raw diversity detail"),
        "no-valid-coordinated-candidate",
      ],
      [
        new CoordinatedStorefrontDirectionError("unknown-direction", "raw unknown detail"),
        "malformed-state",
      ],
      [
        new BoundedStorefrontSynthesisError("stale-authority", "raw stale detail"),
        "stale-authority",
      ],
      [
        new BoundedStorefrontSynthesisError(
          "non-deterministic-selection",
          "raw non-deterministic detail",
        ),
        "malformed-state",
      ],
      [new Error("raw unknown internal detail"), "malformed-state"],
      [new P10bLiveSynthesisAcceptanceError("protected-commerce"), "protected-commerce"],
    ];
    for (const code of [
      "invalid-request",
      "unsupported-constraint",
      "incomplete-page-set",
      "missing-approved-evidence",
      "incompatible-frame-profile",
      "unsupported-narrative-role",
      "impossible-required-role",
      "invalid-component-capability",
      "invalid-bounded-override",
    ] as const) {
      cases.push([
        new BoundedStorefrontSynthesisError(code, `raw ${code} materialization detail`),
        "synthesis-materialization-failure",
      ]);
    }

    for (const [error, expectedCode] of cases) {
      expect(mapP10bLiveSynthesisGenerationError(error)).toMatchObject({ code: expectedCode });
    }
  });

  it("fails unsupported, stale, malformed and unavailable provider outcomes without raw-state mutation, retry or diagnostic leakage", async () => {
    const rawMessage = "raw-provider-message-must-not-be-retained";
    const rawPayload = "raw-provider-payload-must-not-be-retained";
    const cases = [
      {
        name: "malformed",
        code: "provider-response-invalid",
        select(request: unknown) {
          const current = p10bLiveSynthesisIntentProviderRequestSchema.parse(request);
          const option = current.executableIntents[0];
          return Promise.resolve({
            requestFingerprint: current.requestFingerprint,
            executableIntentId: option.intentId,
            executableIntentFingerprint: option.executableIntentFingerprint,
            rawProviderPayload: rawPayload,
          });
        },
      },
      {
        name: "unsupported",
        code: "unsupported-provider-selection",
        select(request: unknown) {
          const current = p10bLiveSynthesisIntentProviderRequestSchema.parse(request);
          return Promise.resolve({
            requestFingerprint: current.requestFingerprint,
            executableIntentId: `unadvertised-${rawPayload}`,
            executableIntentFingerprint: current.executableIntents[0].executableIntentFingerprint,
          });
        },
      },
      {
        name: "stale",
        code: "stale-authority",
        select(request: unknown) {
          const current = p10bLiveSynthesisIntentProviderRequestSchema.parse(request);
          return Promise.resolve({
            requestFingerprint: current.requestFingerprint,
            executableIntentId: current.executableIntents[0].intentId,
            executableIntentFingerprint: `stale-${rawPayload}`,
          });
        },
      },
      {
        name: "unavailable",
        code: "provider-unavailable",
        select() {
          return Promise.reject(new P10bLiveSynthesisIntentError("provider-unavailable"));
        },
      },
      {
        name: "unknown",
        code: "malformed-state",
        select() {
          return Promise.reject(
            Object.assign(new Error(rawMessage), { code: `raw-code-${rawPayload}` }),
          );
        },
      },
    ] as const;

    for (const entry of cases) {
      await resetP10bLiveSynthesisAcceptance(environment);
      const before = await inspectP10bLiveSynthesisAcceptance(environment);
      const session = p10bLiveSynthesisAcceptanceSession(environment);
      const calls = vi.fn();
      const provider: P10bLiveSynthesisIntentProvider = {
        id: `recording-${entry.name}-provider`,
        modelId: `mocked-${entry.name}-provider`,
        selectIntent(request) {
          calls();
          return entry.select(request);
        },
      };
      const diagnostic = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const merchantInstruction = `Create the ${entry.name} storefront without retaining this instruction.`;

      await expect(
        generateP10bLiveSynthesisAcceptance({
          ...session,
          merchantInstruction,
          requestedDirectionId: "premium-editorial",
          providerConfiguration: {
            provider,
            modelId: provider.modelId,
            category: "eligible",
          },
          environment,
        }),
      ).rejects.toMatchObject({ code: entry.code });
      expect(calls).toHaveBeenCalledOnce();

      const failed = await inspectP10bLiveSynthesisAcceptance(environment);
      expect(failed).toMatchObject({
        aggregateFingerprint: before.baselineFingerprint,
        authoritativeRevision: before.authoritativeRevision,
        generationStatus: "failed",
        providerCallCount: 1,
        rawPresentation: {
          pageCount: 1,
          sectionCount: 0,
          hasSharedFrame: false,
          hasDesignDna: false,
          hasPageFamilySelection: false,
        },
      });
      const editor = await loadP10bLiveSynthesisEditorSession({ ...session, environment });
      expect(editor?.proposal).toBeNull();
      expect(
        editor?.aggregate.snapshots.find(
          ({ id }) => id === editor.aggregate.project.draftSnapshotId,
        )?.pages,
      ).toHaveLength(1);

      await expect(
        generateP10bLiveSynthesisAcceptance({
          ...session,
          merchantInstruction: "A forbidden second attempt.",
          requestedDirectionId: "premium-editorial",
          providerConfiguration: {
            provider,
            modelId: provider.modelId,
            category: "eligible",
          },
          environment,
        }),
      ).rejects.toMatchObject({ code: "stale" });
      expect(calls).toHaveBeenCalledOnce();

      const retained = canonicalValueString(diagnostic.mock.calls);
      expect(retained).toContain(`"failureCode":"${entry.code}"`);
      expect(retained).not.toContain(rawMessage);
      expect(retained).not.toContain(rawPayload);
      expect(retained).not.toContain(merchantInstruction);
      expect(retained).not.toContain(session.sessionId);
      expect(retained).not.toContain(token);
      diagnostic.mockRestore();
    }
  }, 180_000);

  it("rejects unsafe route access before provider selection and cannot activate in production", async () => {
    const selected = vi.fn(() =>
      selectP10bLiveSynthesisAcceptanceProviderConfiguration(environment),
    );
    const handler = createP10bLiveSynthesisGenerateHandler({
      environment,
      selectProviderConfiguration: selected,
    });
    const session = p10bLiveSynthesisAcceptanceSession(environment);
    const request = (headers: Record<string, string>) =>
      new Request("http://p10b16l.test/api/demo/p10b-live/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...session,
          merchantInstruction: "Create the complete storefront.",
          requestedDirectionId: null,
        }),
      });
    expect(
      (
        await handler(
          request({
            origin: "https://attacker.example",
            "content-type": "application/json",
            "x-veskify-p10b-16l-acceptance-token": token,
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handler(
          request({ origin: "http://p10b16l.test", "content-type": "application/json" }),
        )
      ).status,
    ).toBe(403);
    expect(selected).not.toHaveBeenCalled();
    expect(
      isP10bLiveSynthesisAcceptanceConfigured({
        ...environment,
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("rejects accepted-snapshot and protected-commerce drift", async () => {
    const { session } = await generated("minimal-commerce");
    const bridge = (await loadP10bLiveSynthesisEditorSession({ ...session, environment }))!;
    const draft = bridge.aggregate.snapshots.find(
      ({ id }) => id === bridge.aggregate.project.draftSnapshotId,
    )!;
    const published = bridge.aggregate.snapshots.find(
      ({ id }) => id === bridge.aggregate.project.publishedSnapshotId,
    )!;
    const accepted = new StorefrontProposalAcceptanceCoordinator({
      proposal: bridge.proposal,
      activeDraft: draft,
      storedDraft: draft,
      publishedSnapshot: published,
      catalogue: bridge.aggregate.catalogue,
      enabledLocales: bridge.aggregate.project.enabledLocales,
      activeLocale: bridge.aggregate.project.primaryLocale,
      primaryLocale: bridge.aggregate.project.primaryLocale,
    }).accept();
    const changedSnapshot = structuredClone(accepted.activeDraft);
    changedSnapshot.navigation.primary = [];
    await expect(
      acceptP10bLiveSynthesisProposal({
        ...session,
        proposalId: bridge.proposal!.id,
        expectedRevision: bridge.authoritativeRevision,
        acceptedSnapshot: changedSnapshot,
        environment,
      }),
    ).rejects.toMatchObject({ code: "invalid" });

    const publishedIdentity = structuredClone(accepted.activeDraft);
    publishedIdentity.id = bridge.aggregate.project.publishedSnapshotId;
    await expect(
      acceptP10bLiveSynthesisProposal({
        ...session,
        proposalId: bridge.proposal!.id,
        expectedRevision: bridge.authoritativeRevision,
        acceptedSnapshot: publishedIdentity,
        environment,
      }),
    ).rejects.toMatchObject({ code: "invalid" });

    const committed = await acceptP10bLiveSynthesisProposal({
      ...session,
      proposalId: bridge.proposal!.id,
      expectedRevision: bridge.authoritativeRevision,
      acceptedSnapshot: accepted.activeDraft,
      environment,
    });
    const acceptedAggregate = aggregateWithDraft(bridge.aggregate, accepted.activeDraft);
    const beforeInvalidSynchronization = await inspectP10bLiveSynthesisAcceptance(environment);

    const changedPublishedPointer = structuredClone(acceptedAggregate);
    changedPublishedPointer.project.publishedSnapshotId = accepted.activeDraft.id;
    await expect(
      synchronizeP10bLiveSynthesisAggregate({
        ...session,
        expectedRevision: committed.authoritativeRevision,
        mode: "active",
        aggregate: changedPublishedPointer,
        environment,
      }),
    ).rejects.toMatchObject({ code: "invalid" });

    const changedPublishedSnapshot = structuredClone(acceptedAggregate);
    const publishedSnapshot = changedPublishedSnapshot.snapshots.find(
      ({ id }) => id === changedPublishedSnapshot.project.publishedSnapshotId,
    );
    if (!publishedSnapshot) throw new Error("The acceptance fixture needs a published snapshot.");
    publishedSnapshot.createdAt = "2026-08-10T09:00:01.000Z";
    await expect(
      synchronizeP10bLiveSynthesisAggregate({
        ...session,
        expectedRevision: committed.authoritativeRevision,
        mode: "active",
        aggregate: changedPublishedSnapshot,
        environment,
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(await inspectP10bLiveSynthesisAcceptance(environment)).toMatchObject({
      aggregateFingerprint: beforeInvalidSynchronization.aggregateFingerprint,
      authoritativeRevision: beforeInvalidSynchronization.authoritativeRevision,
    });

    const changedCommerce = structuredClone(acceptedAggregate);
    const firstProduct = changedCommerce.catalogue.products[0];
    if (!firstProduct?.price) throw new Error("The acceptance fixture needs priced commerce.");
    firstProduct.price.amount += 1;
    await expect(
      synchronizeP10bLiveSynthesisAggregate({
        ...session,
        expectedRevision: committed.authoritativeRevision,
        mode: "saved",
        aggregate: changedCommerce,
        environment,
      }),
    ).rejects.toMatchObject({ code: "protected-commerce" });
  }, 120_000);
});
