import { describe, expect, it } from "vitest";

import {
  StorefrontProposalAcceptanceCoordinator,
  aiStorefrontProposalSchema,
  createAiStorefrontGenerationPermissionFingerprint,
  createAiStorefrontPermissionFingerprint,
  createAiStorefrontProposalId,
  createAiStorefrontTargetFingerprint,
  executeAiStorefrontProposal,
  projectAiStorefrontSnapshot,
  validateAiStorefrontProposal,
  type AiStorefrontOperation,
  type AiStorefrontPermissionGrant,
  type AiStorefrontProposal,
  type AiStorefrontTarget,
  type AiStorefrontWholeStorefrontGeneration,
} from "@/application/ai-storefront";
import { executeCoordinatedDirection } from "@/application/bounded-storefront-synthesis";
import { validateRegisteredSnapshot } from "@/components/registry";
import {
  createP10B16P03RawKarvonenStudioFixture,
  type P10B16P03RawKarvonenStudioFixture,
} from "@/data/demo/p10b-16p-03-studio-prompt-generation";
import {
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  canonicalValueString,
  type StorefrontSnapshot,
} from "@/domain/storefront";

type GenerationAuthority = Readonly<{
  fixture: P10B16P03RawKarvonenStudioFixture;
  candidate: StorefrontSnapshot;
  proposal: AiStorefrontProposal;
}>;

let cachedAuthority: GenerationAuthority | undefined;

function proposalContext(fixture: P10B16P03RawKarvonenStudioFixture) {
  return {
    projectId: fixture.rawDraft.projectId,
    draftSnapshotId: fixture.rawDraft.id,
    draftRevision: fixture.rawDraft.revision,
    enabledLocales: fixture.aggregate.project.enabledLocales,
    activeLocale: fixture.aggregate.project.primaryLocale,
    storefront: projectAiStorefrontSnapshot(fixture.rawDraft),
  };
}

function applicationContext(fixture: P10B16P03RawKarvonenStudioFixture) {
  return {
    activeDraft: structuredClone(fixture.rawDraft),
    catalogue: structuredClone(fixture.planningInput.catalogue),
    enabledLocales: fixture.aggregate.project.enabledLocales,
    activeLocale: fixture.aggregate.project.primaryLocale,
    primaryLocale: fixture.aggregate.project.primaryLocale,
  };
}

function canonicalGenerationAuthority(): GenerationAuthority {
  if (cachedAuthority) {
    return {
      fixture: createP10B16P03RawKarvonenStudioFixture(),
      candidate: structuredClone(cachedAuthority.candidate),
      proposal: structuredClone(cachedAuthority.proposal),
    };
  }

  const fixture = createP10B16P03RawKarvonenStudioFixture();
  const execution = executeCoordinatedDirection({
    planningInput: fixture.executionPlanningInput,
    siteMapDecision: fixture.siteMapDecision,
    approvedEvidenceReferences: fixture.approvedEvidenceReferences,
    pageEvidenceAuthority: fixture.pageEvidenceAuthority,
    contentFactAuthority: fixture.contentFactAuthority,
    approvedAssetPresentations: fixture.approvedAssetPresentations,
    directionRequest: {
      directionId: "premium-editorial",
      deterministicSeed: "p10b-16p-03-canonical-generation-transition-v1",
    },
  });
  const materialization = execution.synthesis.materialization;
  const candidate = validateRegisteredSnapshot(
    materialization.snapshot,
    fixture.planningInput.catalogue,
    fixture.aggregate.project.primaryLocale,
    fixture.aggregate.project.primaryLocale,
    fixture.aggregate.project.enabledLocales,
  );
  const context = proposalContext(fixture);
  const target: AiStorefrontTarget = {
    scope: "storefront",
    projectId: fixture.rawDraft.projectId,
    draftSnapshotId: fixture.rawDraft.id,
    draftRevision: fixture.rawDraft.revision,
    affectedPageIds: fixture.rawDraft.pages
      .map(({ id }) => id)
      .sort((left, right) => left.localeCompare(right)),
    affectedSectionTargets: [],
    designSystemTarget: {
      kind: "storefrontDesignSystem",
      projectId: fixture.rawDraft.projectId,
    },
    enabledLocales: [...fixture.aggregate.project.enabledLocales],
    activeLocale: fixture.aggregate.project.primaryLocale,
  };
  const originalStorefront = projectAiStorefrontSnapshot(fixture.rawDraft);
  const proposedStorefront = projectAiStorefrontSnapshot(candidate);
  const generationTarget = {
    kind: "storefront" as const,
    projectId: fixture.rawDraft.projectId,
    draftSnapshotId: fixture.rawDraft.id,
    draftRevision: fixture.rawDraft.revision,
  };
  const wholeStorefrontGeneration: AiStorefrontWholeStorefrontGeneration = {
    kind: "canonicalWholeStorefrontGeneration",
    contractVersion: "1.0.0",
    order: 0,
    operationType: "APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION",
    target: generationTarget,
    permission: {
      skillId: "compilePromptedStorefrontDesignIntentV2",
      skillVersion: "2.0.0",
      skillScope: "storefront",
      operationTypes: ["APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION"],
      target: generationTarget,
    },
    requestFingerprint: canonicalValueFingerprint({ request: "p10b-16p-03" }),
    promptFingerprint: canonicalValueFingerprint({ prompt: "p10b-16p-03" }),
    providerIntentFingerprint: canonicalValueFingerprint({ intent: "p10b-16p-03" }),
    sourceProposalFingerprint: canonicalValueFingerprint(materialization.proposal),
    synthesisFingerprint: execution.synthesis.decision.synthesisFingerprint,
    structuralFingerprint: canonicalValueFingerprint({
      structural: "p10b-16p-03",
      planFingerprint: materialization.plan.fingerprint,
    }),
    candidateSnapshotFingerprint: canonicalStorefrontContentFingerprint(candidate),
    sourceProjectionFingerprint: canonicalValueFingerprint(originalStorefront),
    operationProjectionFingerprint: canonicalValueFingerprint(originalStorefront),
    resultingProjectionFingerprint: canonicalValueFingerprint(proposedStorefront),
    resultingSnapshotFingerprint: canonicalStorefrontContentFingerprint(candidate),
    compiledDecisionFingerprint: canonicalValueFingerprint({
      kind: "p10b-16p-03-compiled-decision",
      planFingerprint: materialization.plan.fingerprint,
    }),
    materializationAuthorityFingerprint: canonicalValueFingerprint({
      kind: "p10b-16p-03-materialization-authority",
      planFingerprint: materialization.plan.fingerprint,
      snapshotFingerprint: canonicalStorefrontContentFingerprint(candidate),
    }),
  };
  const targetFingerprint = createAiStorefrontTargetFingerprint(context, target);
  const permissionFingerprint =
    createAiStorefrontGenerationPermissionFingerprint(wholeStorefrontGeneration);
  const operations: AiStorefrontOperation[] = [];
  const proposal = aiStorefrontProposalSchema.parse({
    id: createAiStorefrontProposalId(
      "request_p10b16p03_canonical_transition",
      targetFingerprint,
      permissionFingerprint,
      operations,
      [],
      undefined,
      wholeStorefrontGeneration,
    ),
    requestId: "request_p10b16p03_canonical_transition",
    projectId: fixture.rawDraft.projectId,
    draftSnapshotId: fixture.rawDraft.id,
    draftRevision: fixture.rawDraft.revision,
    target,
    originalStorefront,
    proposedStorefront,
    affectedPages: target.affectedPageIds.map((pageId) =>
      structuredClone(fixture.rawDraft.pages.find(({ id }) => id === pageId)!),
    ),
    affectedDesignState: null,
    permissionGrants: [],
    targetFingerprint,
    permissionFingerprint,
    operations,
    wholeStorefrontGeneration,
    summary: {
      en: "Create the complete governed storefront.",
      fi: "Luo valmis hallittu kauppapaikka.",
    },
    validation: { valid: true, errors: [] },
    status: "pending",
  });

  cachedAuthority = {
    fixture,
    candidate: structuredClone(candidate),
    proposal: structuredClone(proposal),
  };
  return {
    fixture: createP10B16P03RawKarvonenStudioFixture(),
    candidate: structuredClone(candidate),
    proposal: structuredClone(proposal),
  };
}

function thrownCode(action: () => unknown) {
  try {
    action();
    return null;
  } catch (error) {
    return error && typeof error === "object" && "code" in error ? error.code : null;
  }
}

function changedFingerprint(label: string) {
  return canonicalValueFingerprint({ tamperedP10B16P03Authority: label });
}

function rebindGenerationProposalId(proposal: AiStorefrontProposal) {
  proposal.id = createAiStorefrontProposalId(
    proposal.requestId,
    proposal.targetFingerprint,
    proposal.permissionFingerprint,
    proposal.operations,
    proposal.assetPlacementOperations,
    proposal.dynamicCommerceMigration,
    proposal.wholeStorefrontGeneration,
  );
}

function noOpPageAuthority(
  fixture: P10B16P03RawKarvonenStudioFixture,
): Readonly<{ operation: AiStorefrontOperation; grant: AiStorefrontPermissionGrant }> {
  const page = fixture.rawDraft.pages[0];
  return {
    operation: {
      order: 0,
      target: { kind: "page", pageId: page.id },
      operation: {
        type: "REORDER_SECTIONS",
        sectionIds: page.sections.map(({ id }) => id),
      },
    },
    grant: {
      skillId: "applyRegisteredWholeStorefrontDirection",
      skillVersion: "1.0.0",
      skillScope: "storefront",
      operationTypes: ["REORDER_SECTIONS"],
      target: { kind: "page", pageId: page.id },
    },
  };
}

function directMutationProposal(
  mutate: (projection: AiStorefrontProposal["proposedStorefront"]) => void,
) {
  const { fixture, proposal } = canonicalGenerationAuthority();
  const context = proposalContext(fixture);
  const { operation, grant } = noOpPageAuthority(fixture);
  const proposedStorefront = structuredClone(proposal.originalStorefront);
  mutate(proposedStorefront);
  const permissionGrants = [grant];
  const permissionFingerprint = createAiStorefrontPermissionFingerprint(
    permissionGrants,
    proposal.target,
    context,
  );
  return aiStorefrontProposalSchema.parse({
    ...structuredClone(proposal),
    id: createAiStorefrontProposalId(
      `${proposal.requestId}_direct`,
      proposal.targetFingerprint,
      permissionFingerprint,
      [operation],
    ),
    requestId: `${proposal.requestId}_direct`,
    proposedStorefront,
    permissionGrants,
    permissionFingerprint,
    operations: [operation],
    wholeStorefrontGeneration: undefined,
  });
}

describe("P10B-16P-03 canonical whole-storefront generation transition", () => {
  it("validates and executes one permitted structural operation with no generic edit operations", () => {
    const { fixture, candidate, proposal } = canonicalGenerationAuthority();
    const validated = validateAiStorefrontProposal(proposal, proposalContext(fixture));
    const applied = executeAiStorefrontProposal({
      proposal: validated,
      ...applicationContext(fixture),
    });

    expect(proposal.operations).toEqual([]);
    expect(proposal.permissionGrants).toEqual([]);
    expect(proposal.wholeStorefrontGeneration).toMatchObject({
      order: 0,
      operationType: "APPLY_CANONICAL_WHOLE_STOREFRONT_GENERATION",
      permission: {
        skillId: "compilePromptedStorefrontDesignIntentV2",
        skillVersion: "2.0.0",
        skillScope: "storefront",
      },
    });
    expect(proposal.affectedDesignState).toBeNull();
    expect(proposal.originalStorefront.pages).toHaveLength(1);
    expect(proposal.proposedStorefront.pages.length).toBeGreaterThan(1);
    expect(proposal.proposedStorefront.sharedFrame).toBeDefined();
    expect(proposal.proposedStorefront.contentSupportFactDocuments?.length).toBeGreaterThan(0);
    expect(proposal.proposedStorefront.dynamicCommercePresentation).toBeDefined();
    expect(canonicalValueString(applied)).toBe(canonicalValueString(candidate));
    expect(canonicalStorefrontContentFingerprint(applied)).toBe(
      proposal.wholeStorefrontGeneration?.resultingSnapshotFingerprint,
    );
  });

  it("fails closed for tampered source, result and exact snapshot fingerprints", () => {
    const { fixture, proposal } = canonicalGenerationAuthority();

    const staleSource = structuredClone(proposal);
    staleSource.wholeStorefrontGeneration!.sourceProjectionFingerprint =
      changedFingerprint("source");
    rebindGenerationProposalId(staleSource);
    expect(
      thrownCode(() => validateAiStorefrontProposal(staleSource, proposalContext(fixture))),
    ).toBe("invalid-whole-storefront-generation");

    const staleResult = structuredClone(proposal);
    staleResult.wholeStorefrontGeneration!.resultingProjectionFingerprint =
      changedFingerprint("result");
    rebindGenerationProposalId(staleResult);
    expect(
      thrownCode(() => validateAiStorefrontProposal(staleResult, proposalContext(fixture))),
    ).toBe("invalid-whole-storefront-generation");

    const staleSnapshot = structuredClone(proposal);
    const tamperedSnapshotFingerprint = changedFingerprint("snapshot");
    staleSnapshot.wholeStorefrontGeneration!.candidateSnapshotFingerprint =
      tamperedSnapshotFingerprint;
    staleSnapshot.wholeStorefrontGeneration!.resultingSnapshotFingerprint =
      tamperedSnapshotFingerprint;
    rebindGenerationProposalId(staleSnapshot);
    expect(
      thrownCode(() =>
        executeAiStorefrontProposal({
          proposal: staleSnapshot,
          ...applicationContext(fixture),
        }),
      ),
    ).toBe("final-projection-mismatch");
  });

  it("requires the server-minted structural operation to be the sole operation authority", () => {
    const { fixture, proposal } = canonicalGenerationAuthority();
    const { operation, grant } = noOpPageAuthority(fixture);

    expect(
      aiStorefrontProposalSchema.safeParse({
        ...proposal,
        operations: [operation],
      }).success,
    ).toBe(false);
    expect(
      aiStorefrontProposalSchema.safeParse({
        ...proposal,
        permissionGrants: [grant],
      }).success,
    ).toBe(false);
    expect(
      aiStorefrontProposalSchema.safeParse({
        ...proposal,
        wholeStorefrontGeneration: undefined,
      }).success,
    ).toBe(false);
  });

  it("rejects direct page-set, navigation, shared-frame and content-document mutations", () => {
    const { candidate } = canonicalGenerationAuthority();
    const pageSet = directMutationProposal((projection) => {
      projection.pages = structuredClone(projectAiStorefrontSnapshot(candidate).pages);
      projection.pageOrder = projection.pages.map(({ id }) => id);
      projection.navigation = structuredClone(candidate.navigation);
    });
    expect(
      thrownCode(() =>
        validateAiStorefrontProposal(
          pageSet,
          proposalContext(canonicalGenerationAuthority().fixture),
        ),
      ),
    ).toBe("page-order-mismatch");

    const navigation = directMutationProposal((projection) => {
      projection.navigation.primary.push({
        id: "nav_p10b16p03_direct_mutation",
        label: { en: "Generated home", fi: "Luotu etusivu" },
        target: { type: "page", pageId: projection.pageOrder[0] },
      });
    });
    expect(
      thrownCode(() =>
        validateAiStorefrontProposal(
          navigation,
          proposalContext(canonicalGenerationAuthority().fixture),
        ),
      ),
    ).toBe("navigation-mismatch");

    const sharedFrame = directMutationProposal((projection) => {
      projection.sharedFrame = structuredClone(candidate.sharedFrame);
    });
    expect(
      thrownCode(() =>
        validateAiStorefrontProposal(
          sharedFrame,
          proposalContext(canonicalGenerationAuthority().fixture),
        ),
      ),
    ).toBe("proposal-projection-mismatch");

    const contentDocuments = directMutationProposal((projection) => {
      projection.contentSupportFactDocuments = structuredClone(
        candidate.contentSupportFactDocuments,
      );
    });
    expect(
      thrownCode(() =>
        validateAiStorefrontProposal(
          contentDocuments,
          proposalContext(canonicalGenerationAuthority().fixture),
        ),
      ),
    ).toBe("proposal-projection-mismatch");
  });

  it("accepts once and undoes/redoes every structural root at exact content fingerprints", () => {
    const { fixture, candidate, proposal } = canonicalGenerationAuthority();
    const publishedSnapshot = fixture.aggregate.snapshots.find(
      ({ id }) => id === fixture.aggregate.project.publishedSnapshotId,
    );
    if (!publishedSnapshot) throw new Error("The P10B-16P-03 published baseline is missing.");
    const coordinator = new StorefrontProposalAcceptanceCoordinator({
      proposal,
      activeDraft: fixture.rawDraft,
      storedDraft: fixture.rawDraft,
      publishedSnapshot,
      catalogue: fixture.planningInput.catalogue,
      enabledLocales: fixture.aggregate.project.enabledLocales,
      activeLocale: fixture.aggregate.project.primaryLocale,
      primaryLocale: fixture.aggregate.project.primaryLocale,
      now: () => new Date("2026-08-12T10:00:00.000Z"),
    });

    const accepted = coordinator.accept();
    expect(accepted.state).toBe("accepted");
    expect(canonicalStorefrontContentFingerprint(accepted.activeDraft)).toBe(
      canonicalStorefrontContentFingerprint(candidate),
    );
    const structural = accepted.transaction?.structuralTransition;
    expect(structural?.originalSharedFrame).toEqual(fixture.rawDraft.sharedFrame);
    expect(structural?.resultingSharedFrame).toEqual(candidate.sharedFrame);
    expect(structural?.originalContentSupportFactDocuments).toEqual(
      fixture.rawDraft.contentSupportFactDocuments,
    );
    expect(structural?.resultingContentSupportFactDocuments).toEqual(
      candidate.contentSupportFactDocuments,
    );
    expect(structural?.originalDynamicCommercePresentation).toEqual(
      fixture.rawDraft.dynamicCommercePresentation,
    );
    expect(structural?.resultingDynamicCommercePresentation).toEqual(
      candidate.dynamicCommercePresentation,
    );

    const undone = coordinator.undo();
    expect(canonicalStorefrontContentFingerprint(undone!)).toBe(
      canonicalStorefrontContentFingerprint(fixture.rawDraft),
    );
    expect(undone?.sharedFrame).toEqual(fixture.rawDraft.sharedFrame);
    expect(undone?.contentSupportFactDocuments).toEqual(
      fixture.rawDraft.contentSupportFactDocuments,
    );
    expect(undone?.dynamicCommercePresentation).toEqual(
      fixture.rawDraft.dynamicCommercePresentation,
    );

    const redone = coordinator.redo();
    expect(canonicalStorefrontContentFingerprint(redone!)).toBe(
      canonicalStorefrontContentFingerprint(candidate),
    );
    expect(redone?.sharedFrame).toEqual(candidate.sharedFrame);
    expect(redone?.contentSupportFactDocuments).toEqual(candidate.contentSupportFactDocuments);
    expect(redone?.dynamicCommercePresentation).toEqual(candidate.dynamicCommercePresentation);
  });
});
